'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunction(html, name) {
  const start = html.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const paramsStart = html.indexOf('(', start);
  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < html.length; index += 1) {
    if (html[index] === '(') paramsDepth += 1;
    if (html[index] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }
  const bodyStart = html.indexOf('{', paramsEnd);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    if (html[index] === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }
  throw new Error(`${name} has no closing brace in index.html`);
}

function loadAppFunction(name, globals = {}) {
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const source = extractFunction(html, name);
  if (!source) return null;
  const sandbox = { ...globals, module: { exports: {} } };
  vm.createContext(sandbox, {
    name: `PokerPilot ${name} test sandbox`,
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(`${source}\nmodule.exports = ${name};`, {
    filename: `index.html#${name}`
  }).runInContext(sandbox, { timeout: 2_000 });
  return sandbox.module.exports;
}

function loadMultiwayEquity({ core, random }) {
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const start = html.indexOf('function multiwayEquity(');
  const end = html.indexOf('function analyzerDefaultRange(', start);

  if (start === -1 || end === -1) {
    throw new Error('multiwayEquity was not found in index.html');
  }

  const source = html.slice(start, end);
  const sandbox = {
    C: core,
    sample: array => array[Math.floor(random() * array.length)],
    module: { exports: {} }
  };

  vm.createContext(sandbox, {
    name: 'PokerPilot multiwayEquity test sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(`${source}\nmodule.exports = multiwayEquity;`, {
    filename: 'index.html#multiwayEquity'
  }).runInContext(sandbox, { timeout: 2_000 });

  return sandbox.module.exports;
}

module.exports = { loadAppFunction, loadMultiwayEquity };
