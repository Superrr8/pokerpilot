'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSoundManager(overrides = {}) {
  const assetsFile = path.resolve(__dirname, '..', 'src', 'audio', 'micro-audio-assets.js');
  const file = path.resolve(__dirname, '..', 'src', 'audio', 'sound-manager.js');
  if (!fs.existsSync(assetsFile)) throw new Error('Required micro audio assets are missing');
  if (!fs.existsSync(file)) throw new Error('Required sound manager is missing');
  const sandbox = {
    window: {
      atob: value => Buffer.from(value, 'base64').toString('binary')
    },
    module: { exports: {} },
    exports: {},
    ...overrides
  };
  vm.createContext(sandbox, {
    name: 'PokerPilot sound manager sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(fs.readFileSync(assetsFile, 'utf8'), {
    filename: 'src/audio/micro-audio-assets.js'
  }).runInContext(sandbox, { timeout: 2_000 });
  new vm.Script(fs.readFileSync(file, 'utf8'), {
    filename: 'src/audio/sound-manager.js'
  }).runInContext(sandbox, { timeout: 2_000 });
  return sandbox.window.SoundManager || sandbox.module.exports;
}

module.exports = { loadSoundManager };
