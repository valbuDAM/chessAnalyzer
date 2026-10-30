// Vendors Stockfish (GPL-3.0) into public/engine/ (ADR-022). Run: npm run vendor:engine
// `--check` only verifies the files already there against the pinned hashes (CI, no network).
// To upgrade: change VERSION, empty the hashes, run twice and compare downloads, then pin the new ones (trust on first use).
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '19.0.1';
const BASE = `https://unpkg.com/stockfish@${VERSION}`;
const OUT = join(import.meta.dirname, '..', 'public', 'engine');

// [path inside the npm package, file name in public/engine/, sha256]
export const FILES = [
  [
    'bin/stockfish-19-lite-single.js',
    'stockfish-19-lite-single.js',
    'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a',
  ],
  [
    'bin/stockfish-19-lite-single.wasm',
    'stockfish-19-lite-single.wasm',
    'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de',
  ],
  [
    'bin/stockfish-19-lite.js',
    'stockfish-19-lite.js',
    'dac939ff529668e0168b2f615145ec18b029b753deb6963fd7319d788f964333',
  ],
  [
    'bin/stockfish-19-lite.wasm',
    'stockfish-19-lite.wasm',
    'ddf06cdaf0b8e35c11b40530e44db96c2a99c9029c8d621dd9fca97e4872770c',
  ],
  [
    'bin/stockfish-19-asm.js',
    'stockfish-19-asm.js',
    'c07dad9a00a89f4b1dcba3971d58d8078715556eac0212368e4aab510e1e27c9',
  ],
  ['Copying.txt', 'COPYING.txt', '0b383d5a63da644f628d99c33976ea6487ed89aaa59f0b3257992deac1171e6b'],
];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const matches = (bytes, expected) => sha256(bytes) === expected;

/** Files in `dir` that are missing or do not match their pinned SHA-256. */
export async function unverified(dir = OUT) {
  const bad = [];
  for (const [, name, hash] of FILES) {
    const bytes = await readFile(join(dir, name)).catch(() => null);
    if (!bytes || !matches(bytes, hash)) bad.push(name);
  }
  return bad;
}

async function vendor() {
  await mkdir(OUT, { recursive: true });
  for (const [from, name, hash] of FILES) {
    const target = join(OUT, name);
    const current = await readFile(target).catch(() => null);
    if (current && matches(current, hash)) continue;
    const res = await fetch(`${BASE}/${from}`);
    if (!res.ok) throw new Error(`${from}: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!matches(bytes, hash)) {
      await rm(target, { force: true });
      throw new Error(`${from}: SHA-256 mismatch (got ${sha256(bytes)})`);
    }
    await writeFile(target, bytes);
    console.log(`vendored ${name}`);
  }
  // GPL-3.0 §6: tell where the corresponding source is.
  await writeFile(
    join(OUT, 'SOURCE.txt'),
    `Stockfish ${VERSION} (WASM build by nmrugg/stockfish.js), GPL-3.0, see COPYING.txt.\n` +
      `Source: https://github.com/nmrugg/stockfish.js/releases/tag/v${VERSION}\n` +
      `Package: ${BASE}/\n` +
      'Vendored by scripts/vendor-engine.mjs.\n',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const bad = await unverified();
    if (bad.length) {
      console.error(`Not the pinned SHA-256: ${bad.join(', ')}. Run: npm run vendor:engine`);
      process.exitCode = 1;
    } else console.log('Engine files match the pinned SHA-256.');
  } else await vendor();
}
