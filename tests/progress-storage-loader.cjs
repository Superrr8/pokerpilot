'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} was not found`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} has no closing brace`);
}

function inlineStorageSource(html) {
  const constantsStart = html.indexOf("const STORAGE_KEY = ");
  const constantsEnd = html.indexOf('\n\n', constantsStart);
  if (constantsStart === -1 || constantsEnd === -1) {
    throw new Error('Storage keys were not found in index.html');
  }
  return [
    html.slice(constantsStart, constantsEnd),
    extractFunction(html, 'defaultProgress'),
    extractFunction(html, 'loadProgress'),
    extractFunction(html, 'saveProgress')
  ].join('\n\n');
}

function resetHandlerSource(html) {
  const start = html.indexOf("$('#resetProgress').addEventListener");
  const end = html.indexOf('\n\nfunction cardHTML', start);
  if (start === -1 || end === -1) {
    throw new Error('Reset progress handler was not found in index.html');
  }
  return html.slice(start, end);
}

function createProgressStorageHarness({
  initial = {},
  confirmResult = false
} = {}) {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const storagePath = path.join(root, 'src', 'storage', 'progress-storage.js');
  const courseDataPath = path.join(root, 'src', 'data', 'learning-course.js');
  const courseProgressPath = path.join(root, 'src', 'learning', 'course-progress.js');
  const liveModePath = path.join(root, 'src', 'live', 'live-mode.js');
  const source = fs.existsSync(storagePath)
    ? fs.readFileSync(storagePath, 'utf8')
    : inlineStorageSource(html);
  const learningSource = [
    fs.readFileSync(liveModePath, 'utf8'),
    fs.readFileSync(courseDataPath, 'utf8'),
    fs.readFileSync(courseProgressPath, 'utf8')
  ].join('\n');
  const values = new Map(Object.entries(initial));
  const operations = [];
  let resetHandler = null;
  let renderCount = 0;

  const localStorage = {
    getItem(key) {
      operations.push(['getItem', key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      operations.push(['setItem', key, String(value)]);
      values.set(key, String(value));
    },
    removeItem(key) {
      operations.push(['removeItem', key]);
      values.delete(key);
    },
    clear() {
      operations.push(['clear']);
      values.clear();
    }
  };
  const sandbox = {
    localStorage,
    confirm: () => confirmResult,
    renderProgress: () => { renderCount += 1; },
    $: selector => {
      if (selector !== '#resetProgress') {
        throw new Error(`Unexpected selector: ${selector}`);
      }
      return {
        addEventListener(event, handler) {
          if (event !== 'click') throw new Error(`Unexpected event: ${event}`);
          resetHandler = handler;
        }
      };
    },
    __operations: operations,
    __snapshot: () => Object.fromEntries(values),
    __getRenderCount: () => renderCount,
    __triggerReset: () => {
      if (!resetHandler) throw new Error('Reset handler was not registered');
      return resetHandler();
    },
    module: { exports: {} },
    exports: {}
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox, {
    name: 'PokerPilot progress storage contract sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(`
${learningSource}
${source}
let progress = loadProgress();
${resetHandlerSource(html)}
module.exports = {
  keys: { STORAGE_KEY, PREVIOUS_STORAGE_KEY, OLD_STORAGE_KEY, LEGACY_STORAGE_KEY },
  defaultProgress,
  loadProgress,
  saveProgress,
  getProgress: () => progress,
  setProgress: value => { progress = value; },
  triggerReset: __triggerReset,
  snapshot: __snapshot,
  operations: __operations,
  getRenderCount: __getRenderCount
};
`, {
    filename: fs.existsSync(storagePath)
      ? 'src/storage/progress-storage.js#contract'
      : 'index.html#progress-storage'
  }).runInContext(sandbox, { timeout: 2_000 });

  return sandbox.module.exports;
}

module.exports = { createProgressStorageHarness };
