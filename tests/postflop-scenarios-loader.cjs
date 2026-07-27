'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPostflopScenarios() {
  const root = path.resolve(__dirname, '..');
  const dataPath = path.join(root, 'src', 'data', 'postflop-scenarios.js');
  const sandbox = { module: { exports: {} }, exports: {} };
  let source;

  if (fs.existsSync(dataPath)) {
    source = fs.readFileSync(dataPath, 'utf8');
  } else {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const start = html.indexOf('const STUDY_SPOTS = ');
    const end = html.indexOf('\n\nfunction computeStudyMath', start);
    if (start === -1 || end === -1) {
      throw new Error('STUDY_SPOTS was not found in index.html');
    }
    source = `${html.slice(start, end)}\nmodule.exports = STUDY_SPOTS;`;
  }

  vm.createContext(sandbox, {
    name: 'PokerPilot postflop scenarios test sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, {
    filename: fs.existsSync(dataPath)
      ? 'src/data/postflop-scenarios.js'
      : 'index.html#STUDY_SPOTS'
  }).runInContext(sandbox, { timeout: 2_000 });

  if (!Array.isArray(sandbox.module.exports)) {
    throw new Error('Postflop scenarios did not export an array');
  }
  return sandbox.module.exports;
}

module.exports = { loadPostflopScenarios };
