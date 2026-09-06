'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE_RATE = 16000;
const ASSET_PATH = path.join(ROOT, 'src', 'audio', 'micro-audio-assets.js');

const RECIPES = Object.freeze([
  { name: 'soft-tap', durationMs: 28, softLimitHz: 760, seed: 101, peak: 0.52, contacts: [[0, 5, 13, 240, 0.05, 1]] },
  { name: 'soft-press', durationMs: 42, softLimitHz: 720, seed: 103, peak: 0.58, contacts: [[0, 6, 22, 185, 0.09, 1]] },
  { name: 'soft-success', durationMs: 62, softLimitHz: 1050, seed: 107, peak: 0.56, contacts: [[0, 6, 28, 310, 0.06, 1], [28, 7, 20, 390, 0.05, 0.45]] },
  { name: 'soft-error', durationMs: 50, softLimitHz: 580, seed: 109, peak: 0.58, contacts: [[0, 7, 30, 155, 0.11, 1]] },
  { name: 'soft-complete', durationMs: 72, softLimitHz: 900, seed: 113, peak: 0.58, contacts: [[0, 7, 30, 230, 0.07, 1], [34, 8, 25, 285, 0.05, 0.48]] },
  { name: 'soft-achievement', durationMs: 96, softLimitHz: 1250, seed: 127, peak: 0.6, contacts: [[0, 7, 32, 280, 0.06, 1], [38, 8, 27, 350, 0.05, 0.5], [67, 8, 20, 420, 0.04, 0.28]] },
  { name: 'card-contact', durationMs: 32, softLimitHz: 980, seed: 131, peak: 0.5, contacts: [[0, 7, 20, 0, 0, 1]] },
  { name: 'card-flop', durationMs: 70, softLimitHz: 1050, seed: 137, peak: 0.54, contacts: [[0, 7, 22, 0, 0, 0.72], [18, 7, 22, 0, 0, 0.58], [36, 7, 24, 0, 0, 0.48]] },
  { name: 'card-release', durationMs: 48, softLimitHz: 820, seed: 139, peak: 0.5, contacts: [[0, 9, 34, 0, 0, 1]] },
  { name: 'chip-call', durationMs: 40, softLimitHz: 620, seed: 149, peak: 0.56, contacts: [[0, 7, 24, 255, 0.06, 1]] },
  { name: 'chip-bet', durationMs: 52, softLimitHz: 650, seed: 151, peak: 0.58, contacts: [[0, 7, 30, 205, 0.1, 1], [22, 7, 20, 275, 0.04, 0.26]] },
  { name: 'chip-raise', durationMs: 76, softLimitHz: 700, seed: 157, peak: 0.6, contacts: [[0, 8, 34, 190, 0.11, 1], [32, 8, 30, 245, 0.07, 0.48]] },
  { name: 'all-in', durationMs: 98, softLimitHz: 560, seed: 163, peak: 0.62, contacts: [[0, 9, 45, 150, 0.14, 1], [50, 9, 35, 215, 0.06, 0.42]] },
  { name: 'pot-move', durationMs: 64, softLimitHz: 620, seed: 167, peak: 0.54, contacts: [[0, 9, 28, 0, 0, 0.7], [20, 9, 25, 0, 0, 0.46], [39, 9, 20, 0, 0, 0.3]] },
  { name: 'pot-award', durationMs: 84, softLimitHz: 760, seed: 173, peak: 0.6, contacts: [[0, 8, 38, 210, 0.1, 1], [42, 9, 30, 285, 0.05, 0.42]] }
]);
const AUDITION_ALIASES = Object.freeze({
  tap: 'soft-tap',
  primary: 'soft-press',
  success: 'soft-success',
  error: 'soft-error',
  complete: 'soft-complete',
  achievement: 'soft-achievement',
  deal: 'card-contact',
  flop: 'card-flop',
  turn: 'card-contact',
  river: 'card-contact',
  check: 'soft-tap',
  fold: 'card-release',
  call: 'chip-call',
  bet: 'chip-bet',
  raise: 'chip-raise',
  'all-in': 'all-in',
  'pot-collect': 'pot-move',
  'pot-award': 'pot-award',
  showdown: 'card-release',
  'hand-complete': 'soft-complete'
});

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296 * 2 - 1;
  };
}

function renderRecipe(recipe) {
  const frameCount = Math.round(recipe.durationMs * SAMPLE_RATE / 1000);
  const output = new Float64Array(frameCount);
  recipe.contacts.forEach((contact, contactIndex) => {
    const [atMs, attackMs, decayMs, bodyHz, bodyLevel, level] = contact;
    const random = randomGenerator(recipe.seed + contactIndex * 997);
    const alpha = 1 - Math.exp(-2 * Math.PI * recipe.softLimitHz / SAMPLE_RATE);
    let smoothA = 0;
    let smoothB = 0;
    for (let index = 0; index < frameCount; index += 1) {
      const elapsedMs = index / SAMPLE_RATE * 1000 - atMs;
      if (elapsedMs < 0) continue;
      smoothA += alpha * (random() - smoothA);
      smoothB += alpha * (smoothA - smoothB);
      const attack = Math.min(1, elapsedMs / Math.max(1, attackMs));
      const decay = Math.exp(-elapsedMs / decayMs);
      const tailMs = recipe.durationMs - (index / SAMPLE_RATE * 1000);
      const tail = Math.min(1, Math.max(0, tailMs / 7));
      const body = bodyHz
        ? Math.sin(2 * Math.PI * bodyHz * elapsedMs / 1000) * bodyLevel
        : 0;
      output[index] += (smoothB * 0.86 + body) * attack * decay * tail * level;
    }
  });

  const mean = output.reduce((sum, value) => sum + value, 0) / output.length;
  let largest = 0;
  for (let index = 0; index < output.length; index += 1) {
    output[index] -= mean;
    const edgeFrames = Math.round(SAMPLE_RATE * 0.004);
    const edge = Math.min(1, index / edgeFrames, (output.length - 1 - index) / edgeFrames);
    const edgeWindow = edge * edge * (3 - 2 * edge);
    output[index] *= edgeWindow;
    largest = Math.max(largest, Math.abs(output[index]));
  }
  const scale = largest ? recipe.peak / largest : 0;
  const pcm = Buffer.alloc(output.length * 2);
  for (let index = 0; index < output.length; index += 1) {
    const softened = Math.tanh(output[index] * scale * 1.1) / Math.tanh(1.1);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, softened)) * 32767), index * 2);
  }
  return pcm;
}

function buildAssetModule() {
  const rendered = RECIPES.map(recipe => ({ recipe, pcm: renderRecipe(recipe) }));
  const totalBytes = rendered.reduce((sum, item) => sum + item.pcm.length, 0);
  const records = rendered.map(({ recipe, pcm }) => (
    `    '${recipe.name}': Object.freeze({ durationMs: ${recipe.durationMs}, softLimitHz: ${recipe.softLimitHz}, pcm: '${pcm.toString('base64')}' })`
  )).join(',\n');
  return `'use strict';\n\n// Generated by tools/audio-audition.cjs --build. These are pre-rendered\n// PCM16 micro-assets; production playback does not synthesize waveforms.\n(function attachMicroAudioAssets(root) {\n  const SAMPLE_RATE = ${SAMPLE_RATE};\n  const FORMAT = 'pcm-s16le-base64';\n  const ASSETS = Object.freeze({\n${records}\n  });\n  const TOTAL_PCM_BYTES = ${totalBytes};\n  const api = Object.freeze({ SAMPLE_RATE, FORMAT, ASSETS, TOTAL_PCM_BYTES });\n  root.MicroAudioAssets = api;\n  if (typeof module === 'object' && module.exports) module.exports = api;\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
}

function wavFromPcm(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function build() {
  fs.writeFileSync(ASSET_PATH, buildAssetModule());
  process.stdout.write(`Built ${RECIPES.length} micro-assets at ${ASSET_PATH}\n`);
}

function list() {
  process.stdout.write(`${Object.keys(AUDITION_ALIASES).join('\n')}\n`);
}

function audition(name, repeat) {
  const assetName = AUDITION_ALIASES[name] || name;
  const recipe = RECIPES.find(item => item.name === assetName);
  if (!recipe) throw new Error(`Unknown asset: ${name}. Use --list.`);
  if (process.platform !== 'darwin') throw new Error('Audition playback currently requires macOS afplay.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pokerelevate-audio-'));
  const file = path.join(directory, `${recipe.name}.wav`);
  fs.writeFileSync(file, wavFromPcm(renderRecipe(recipe)));
  try {
    for (let index = 0; index < repeat; index += 1) {
      const result = spawnSync('afplay', [file], { stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`afplay failed with status ${result.status}`);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
if (args.includes('--build')) build();
else if (args.includes('--list') || !args.length) list();
else audition(args[0], Math.max(1, Math.min(20, Number(args[1]) || 1)));
