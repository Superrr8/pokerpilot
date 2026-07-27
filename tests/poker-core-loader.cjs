'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPokerCore({ random } = {}) {
  const corePath = path.resolve(__dirname, '..', 'src', 'poker-core.js');
  const source = fs.readFileSync(corePath, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {}
  };
  if (random) {
    sandbox.Math = Object.create(Math);
    Object.defineProperty(sandbox.Math, 'random', { value: random });
  }

  vm.createContext(sandbox, {
    name: 'PokerCore regression-test sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, {
    filename: 'src/poker-core.js'
  }).runInContext(sandbox, { timeout: 2_000 });

  const core = sandbox.module.exports;
  if (!core || typeof core.eval5 !== 'function') {
    throw new Error('PokerCore was extracted, but its public API was not exported');
  }
  return core;
}

module.exports = { loadPokerCore };
