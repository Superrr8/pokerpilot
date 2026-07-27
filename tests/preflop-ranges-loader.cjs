'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RANGE_NAMES = [
  'OPEN_RANGES',
  'ISO_RANGES',
  'DEFEND_VS_EARLY',
  'DEFEND_VS_LATE',
  'VS_3BET'
];

function loadPreflopRanges() {
  const root = path.resolve(__dirname, '..');
  const dataPath = path.join(root, 'src', 'data', 'preflop-ranges.js');
  const sandbox = { module: { exports: {} }, exports: {} };
  let source;
  let filename;

  if (fs.existsSync(dataPath)) {
    source = fs.readFileSync(dataPath, 'utf8');
    filename = 'src/data/preflop-ranges.js';
  } else {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const start = html.indexOf('const OPEN_RANGES = ');
    const endMarker = 'const VS_3BET = ';
    const endStart = html.indexOf(endMarker, start);
    const end = html.indexOf(';', endStart) + 1;
    if (start === -1 || endStart === -1 || end === 0) {
      throw new Error('Static preflop ranges were not found in index.html');
    }
    source = `${html.slice(start, end)}
module.exports = { ${RANGE_NAMES.join(', ')} };`;
    filename = 'index.html#preflop-ranges';
  }

  vm.createContext(sandbox, {
    name: 'PokerPilot preflop ranges test sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, { filename }).runInContext(sandbox, { timeout: 2_000 });

  const ranges = sandbox.module.exports;
  if (!ranges || RANGE_NAMES.some(name => !ranges[name])) {
    throw new Error('Preflop range structures were not exported');
  }
  return ranges;
}

module.exports = { RANGE_NAMES, loadPreflopRanges };
