'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const MATERIAL = 'tactile-contact';
const ASSET_PATH = path.join(ROOT, 'src', 'audio', 'sonic-identity-assets.js');

// Each recipe is assembled from short, zero-centred analytic contact pulses.
// There is no random source, sustained tone or noise bed in this palette.
const RECIPES = Object.freeze([
  {
    name: 'tactile-tap', durationMs: 18, peak: 0.72,
    contacts: [[3, 0.34, 1, 'snap'], [5.2, 1.15, 0.28, 'body']]
  },
  {
    name: 'tactile-primary', durationMs: 30, peak: 0.76,
    contacts: [[3.2, 0.38, 1, 'snap'], [6.1, 1.35, 0.42, 'body'], [11.8, 1.9, 0.1, 'body']]
  },
  {
    name: 'tactile-success', durationMs: 58, peak: 0.74,
    contacts: [[3.2, 0.38, 0.9, 'snap'], [6, 1.3, 0.3, 'body'], [34, 0.4, 0.62, 'snap'], [37, 1.25, 0.2, 'body']]
  },
  {
    name: 'tactile-error', durationMs: 38, peak: 0.7,
    contacts: [[3.6, 0.52, 0.72, 'snap'], [7.2, 1.65, -0.46, 'body'], [15, 2.1, -0.11, 'body']]
  },
  {
    name: 'tactile-complete', durationMs: 64, peak: 0.76,
    contacts: [[3.2, 0.4, 0.82, 'snap'], [6.2, 1.45, 0.32, 'body'], [37, 0.38, 0.68, 'snap'], [40, 1.3, 0.22, 'body']]
  },
  {
    name: 'tactile-achievement', durationMs: 84, peak: 0.78,
    contacts: [[3.2, 0.4, 0.78, 'snap'], [6, 1.35, 0.3, 'body'], [31, 0.38, 0.62, 'snap'], [34, 1.25, 0.2, 'body'], [59, 0.36, 0.48, 'snap'], [62, 1.2, 0.16, 'body']]
  },
  {
    name: 'live-street', durationMs: 42, peak: 0.7,
    contacts: [[3.5, 0.48, 0.72, 'snap'], [7, 1.5, 0.28, 'body'], [19, 0.55, 0.26, 'snap']]
  },
  {
    name: 'live-commit', durationMs: 30, peak: 0.76,
    contacts: [[3.2, 0.4, 0.9, 'snap'], [6.4, 1.55, 0.44, 'body'], [12.5, 2, 0.12, 'body']]
  },
  {
    name: 'live-result', durationMs: 66, peak: 0.78,
    contacts: [[3.2, 0.42, 0.78, 'snap'], [6.5, 1.6, 0.36, 'body'], [38, 0.4, 0.65, 'snap'], [41.2, 1.45, 0.24, 'body']]
  }
]);

const AUDITION_ALIASES = Object.freeze({
  tap: 'tactile-tap',
  primary: 'tactile-primary',
  success: 'tactile-success',
  error: 'tactile-error',
  complete: 'tactile-complete',
  achievement: 'tactile-achievement',
  deal: 'tactile-tap',
  flop: 'live-street',
  turn: 'live-street',
  river: 'live-street',
  check: 'live-commit',
  fold: 'live-commit',
  call: 'live-commit',
  bet: 'live-commit',
  raise: 'live-commit',
  'all-in': 'live-commit',
  'pot-collect': 'tactile-tap',
  'pot-award': 'live-result',
  showdown: 'live-street',
  'hand-complete': 'live-result'
});

function contactPulse(elapsedMs, widthMs, shape) {
  const x = elapsedMs / widthMs;
  if (Math.abs(x) >= 4) return 0;
  const envelope = Math.exp(-0.5 * x * x);
  return shape === 'body' ? (1 - x * x) * envelope : -x * envelope;
}

function renderRecipe(recipe) {
  const frameCount = Math.round(recipe.durationMs * SAMPLE_RATE / 1000);
  const output = new Float64Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    const timeMs = index / SAMPLE_RATE * 1000;
    for (const [atMs, widthMs, level, shape] of recipe.contacts) {
      output[index] += contactPulse(timeMs - atMs, widthMs, shape) * level;
    }
  }

  const mean = output.reduce((sum, value) => sum + value, 0) / output.length;
  let largest = 0;
  for (let index = 0; index < output.length; index += 1) {
    output[index] -= mean;
    const edgeFrames = Math.round(SAMPLE_RATE * 0.0015);
    const edge = Math.min(1, index / edgeFrames, (output.length - 1 - index) / edgeFrames);
    const edgeWindow = edge * edge * (3 - 2 * edge);
    output[index] *= edgeWindow;
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
    `    '${recipe.name}': Object.freeze({ durationMs: ${recipe.durationMs}, channels: ${CHANNELS}, material: '${MATERIAL}', peak: ${metadata.peak}, rms: ${metadata.rms}, pcm: '${pcm.toString('base64')}' })`
  )).join(',\n');
  return `'use strict';\n\n// Generated by tools/audio-audition.cjs --build. These are pre-rendered\n// PCM16 tactile-contact assets; production playback does not synthesize waveforms.\n(function attachSonicIdentityAssets(root) {\n  const SAMPLE_RATE = ${SAMPLE_RATE};\n  const CHANNELS = ${CHANNELS};\n  const FORMAT = 'pcm-s16le-base64';\n  const ASSETS = Object.freeze({\n${records}\n  });\n  const TOTAL_PCM_BYTES = ${totalBytes};\n  const api = Object.freeze({ SAMPLE_RATE, CHANNELS, FORMAT, ASSETS, TOTAL_PCM_BYTES });\n  root.SonicIdentityAssets = api;\n  if (typeof module === 'object' && module.exports) module.exports = api;\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
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
