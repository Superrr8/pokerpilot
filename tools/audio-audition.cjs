'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE_RATE = 48000;
const CHANNELS = 1;
const ASSET_PATH = path.join(ROOT, 'src', 'audio', 'sonic-identity-assets.js');

// Each asset is assembled from compact, smoothly gated physical wave packets.
// Different materials and cadences keep the vocabulary distinct while every
// sound remains local, deterministic and dry.
const RECIPES = Object.freeze([
  {
    name: 'tactile-tap', durationMs: 12, peak: 0.82,
    material: 'soft-keycap', character: 'dry-soft-tap',
    packets: [[0.35, 3.2, 1680, 0.58, 0.18], [1.1, 5.2, 820, 0.42, 0.12]]
  },
  {
    name: 'tactile-primary', durationMs: 16, peak: 0.84,
    material: 'weighted-keycap', character: 'full-primary-press',
    packets: [[0.35, 4.2, 1260, 0.46, 0.12], [0.9, 7.4, 510, 0.66, 0.08]]
  },
  {
    name: 'tactile-success', durationMs: 26, peak: 0.82,
    material: 'positive-mark', character: 'rising-confirmation',
    packets: [[0.4, 6.8, 560, 0.58, 0.1], [12.1, 6.8, 910, 0.68, 0.08]]
  },
  {
    name: 'tactile-error', durationMs: 24, peak: 0.8,
    material: 'caution-mark', character: 'descending-restraint',
    packets: [[0.4, 5.8, 760, 0.46, 0.08], [9.1, 7.5, 390, 0.7, 0.06]]
  },
  {
    name: 'tactile-complete', durationMs: 32, peak: 0.84,
    material: 'completion-mark', character: 'three-step-finish',
    packets: [[0.3, 5.8, 470, 0.5, 0.08], [9.8, 5.8, 680, 0.58, 0.08], [19.4, 6.2, 980, 0.62, 0.06]]
  },
  {
    name: 'tactile-achievement', durationMs: 38, peak: 0.86,
    material: 'achievement-mark', character: 'warm-rising-signature',
    packets: [[0.3, 6.2, 410, 0.42, 0.08], [9.9, 6.8, 650, 0.56, 0.08], [20.5, 7.6, 940, 0.7, 0.06]]
  },
  {
    name: 'live-card', durationMs: 14, peak: 0.8,
    material: 'card-flick', character: 'light-card-release',
    packets: [[0.25, 3.2, 1900, 0.56, 0.16], [1.2, 5.4, 1040, -0.38, 0.1]]
  },
  {
    name: 'live-neutral', durationMs: 14, peak: 0.8,
    material: 'felt-touch', character: 'muted-table-tap',
    packets: [[0.35, 4.0, 1120, 0.38, 0.08], [1.0, 6.2, 620, 0.58, 0.06]]
  },
  {
    name: 'live-commit', durationMs: 18, peak: 0.84,
    material: 'chip-seat', character: 'solid-chip-commit',
    packets: [[0.35, 5.0, 880, 0.4, 0.08], [0.9, 8.5, 350, 0.72, 0.05]]
  },
  {
    name: 'live-fold', durationMs: 17, peak: 0.8,
    material: 'felt-release', character: 'soft-downward-release',
    packets: [[0.3, 4.6, 1280, 0.4, 0.1], [6.0, 6.2, 480, -0.64, 0.05]]
  },
  {
    name: 'live-result', durationMs: 32, peak: 0.87,
    material: 'pot-settle', character: 'two-step-pot-result',
    packets: [[0.35, 7.5, 380, 0.62, 0.06], [14, 8.2, 690, 0.7, 0.06]]
  }
]);

const AUDITION_ALIASES = Object.freeze({
  tap: 'tactile-tap',
  primary: 'tactile-primary',
  success: 'tactile-success',
  error: 'tactile-error',
  complete: 'tactile-complete',
  achievement: 'tactile-achievement',
  deal: 'live-card',
  flop: 'live-card',
  turn: 'live-card',
  river: 'live-card',
  check: 'live-neutral',
  fold: 'live-fold',
  call: 'live-neutral',
  bet: 'live-commit',
  raise: 'live-commit',
  'all-in': 'live-commit',
  'pot-collect': 'live-neutral',
  'pot-award': 'live-result',
  showdown: 'live-card',
  'hand-complete': 'live-result'
});

function smoothPacket(elapsedMs, lengthMs, frequencyHz, color) {
  if (elapsedMs < 0 || elapsedMs >= lengthMs) return 0;
  const phase = elapsedMs / lengthMs;
  const window = Math.sin(Math.PI * phase) ** 2;
  const cycles = Math.max(2, Math.round(frequencyHz * lengthMs / 1000));
  const body = Math.sin(2 * Math.PI * cycles * phase);
  const overtone = Math.sin(2 * Math.PI * (cycles + 3) * phase);
  return window * (body + color * overtone) / (1 + Math.abs(color));
}

function renderRecipe(recipe) {
  const frameCount = Math.round(recipe.durationMs * SAMPLE_RATE / 1000);
  const output = new Float64Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    const timeMs = index / SAMPLE_RATE * 1000;
    for (const [atMs, lengthMs, frequencyHz, level, color] of recipe.packets) {
      output[index] += smoothPacket(timeMs - atMs, lengthMs, frequencyHz, color) * level;
    }
  }

  let largest = 0;
  for (let index = 0; index < output.length; index += 1) {
    largest = Math.max(largest, Math.abs(output[index]));
  }

  const scale = largest ? recipe.peak / largest : 0;
  const pcm = Buffer.alloc(output.length * 2);
  for (let index = 0; index < output.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, output[index] * scale));
    pcm.writeInt16LE(Math.round(sample * 32767), index * 2);
  }
  pcm.writeInt16LE(0, 0);
  pcm.writeInt16LE(0, pcm.length - 2);
  return pcm;
}

function metadataFor(pcm) {
  let peak = 0;
  let energy = 0;
  for (let offset = 0; offset < pcm.length; offset += 2) {
    const sample = pcm.readInt16LE(offset) / 32768;
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
  }
  return {
    peak: Number(peak.toFixed(4)),
    rms: Number(Math.sqrt(energy / (pcm.length / 2)).toFixed(4))
  };
}

function renderAll() {
  return RECIPES.map(recipe => {
    const pcm = renderRecipe(recipe);
    return { recipe, pcm, metadata: metadataFor(pcm) };
  });
}

function buildAssetModule() {
  const rendered = renderAll();
  const totalBytes = rendered.reduce((sum, item) => sum + item.pcm.length, 0);
  const records = rendered.map(({ recipe, pcm, metadata }) => (
    `    '${recipe.name}': Object.freeze({ durationMs: ${recipe.durationMs}, channels: ${CHANNELS}, material: '${recipe.material}', character: '${recipe.character}', peak: ${metadata.peak}, rms: ${metadata.rms}, pcm: '${pcm.toString('base64')}' })`
  )).join(',\n');
  return `'use strict';\n\n// Generated by tools/audio-audition.cjs --build. These are pre-rendered\n// PCM16 phone-forward micro-assets; production playback does not synthesize waveforms.\n(function attachSonicIdentityAssets(root) {\n  const SAMPLE_RATE = ${SAMPLE_RATE};\n  const CHANNELS = ${CHANNELS};\n  const FORMAT = 'pcm-s16le-base64';\n  const ASSETS = Object.freeze({\n${records}\n  });\n  const TOTAL_PCM_BYTES = ${totalBytes};\n  const api = Object.freeze({ SAMPLE_RATE, CHANNELS, FORMAT, ASSETS, TOTAL_PCM_BYTES });\n  root.SonicIdentityAssets = api;\n  if (typeof module === 'object' && module.exports) module.exports = api;\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
}

function wavFromPcm(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
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
  process.stdout.write(`Built ${RECIPES.length} sonic-identity assets at ${ASSET_PATH}\n`);
}

function list() {
  process.stdout.write(`${Object.keys(AUDITION_ALIASES).join('\n')}\n`);
}

function report() {
  const rows = renderAll().map(({ recipe, pcm, metadata }) => ({
    name: recipe.name,
    durationMs: recipe.durationMs,
    channels: CHANNELS,
    sampleRate: SAMPLE_RATE,
    bytes: pcm.length,
    ...metadata
  }));
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
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
else if (args.includes('--report')) report();
else if (args.includes('--list') || !args.length) list();
else audition(args[0], Math.max(1, Math.min(50, Number(args[1]) || 1)));
