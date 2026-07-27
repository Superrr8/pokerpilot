'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPokerCore } = require('./poker-core-loader.cjs');
const { loadPreflopRanges } = require('./preflop-ranges-loader.cjs');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} was not found in index.html`);
  const paramsStart = source.indexOf('(', start);
  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    if (source[index] === '(') paramsDepth += 1;
    if (source[index] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }
  const bodyStart = source.indexOf('{', paramsEnd);
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

function extractConstLine(source, name) {
  const start = source.indexOf(`const ${name} =`);
  const end = source.indexOf('\n', start);
  if (start === -1 || end === -1) {
    throw new Error(`${name} was not found in index.html`);
  }
  return source.slice(start, end);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function loadTrainer({ seed = 0x5eed1234 } = {}) {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const C = loadPokerCore();
  const ranges = loadPreflopRanges();
  const context = { limpers: 1, opener: 'early' };
  const random = seededRandom(seed);
  const math = Object.create(Math);
  Object.defineProperty(math, 'random', { value: random });
  const sandbox = {
    C,
    ...ranges,
    Math: math,
    $: selector => {
      if (selector === '#anLimpers') return { value: String(context.limpers) };
      if (selector === '#anOpener') return { value: context.opener };
      throw new Error(`Unexpected trainer selector: ${selector}`);
    },
    module: { exports: {} },
    exports: {}
  };
  const functions = [
    'classInRange',
    'lineRangeFor',
    'escapeHTML',
    'validateAnalyzerNumbers',
    'validateAnalyzerPosition',
    'multiwayEquity',
    'analyzerDefaultRange',
    'analyzerTexture',
    'analyzerVillainContext',
    'analyzerPositionContext',
    'analyzerBetContext',
    'analyzerSeededRng',
    'analyzerDeterministicRng',
    'analyzerAlternatives',
    'analyzerResultContract',
    'analyzerPreflop',
    'analyzerPostflop'
  ].map(name => extractFunction(html, name));
  const source = [
    extractConstLine(html, 'money'),
    extractConstLine(html, 'pct'),
    ...functions,
    `module.exports = {
      analyzerPreflop,
      analyzerPostflop,
      analyzerDefaultRange,
      analyzerTexture,
      validateAnalyzerNumbers,
      validateAnalyzerPosition,
      setPreflopContext(value) { Object.assign(__trainerContext, value); }
    };`
  ].join('\n\n');
  sandbox.__trainerContext = context;

  vm.createContext(sandbox, {
    name: 'PokerPilot real trainer control-hand sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, {
    filename: 'index.html#real-trainer'
  }).runInContext(sandbox, { timeout: 2_000 });

  return { ...sandbox.module.exports, C };
}

module.exports = { loadTrainer, seededRandom };
