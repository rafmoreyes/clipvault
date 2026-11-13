'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateFrames, readFrames, saveFrames } = require('../frame-store');

const id1 = '2026-11-13/13_11_2026_15h30m_01.png';
const id2 = '2026-11-12/12_11_2026_11h25m_02.png';
const frames = [{ id: 'f_abcde_1', name: '  Estudos de shader  ', ids: [id1, id2, id1] }];
assert.deepEqual(validateFrames(frames), [
  { id: 'f_abcde_1', name: 'Estudos de shader', ids: [id1, id2] }
]);
assert.throws(() => validateFrames([{ id: '../escape', name: 'x', ids: [id1] }]));
assert.throws(() => validateFrames([{ id: 'f_abcde_1', name: '', ids: [id1] }]));
assert.throws(() => validateFrames([{ id: 'f_abcde_1', name: 'x', ids: ['../private.png'] }]));
assert.throws(() => validateFrames([{ id: 'f_abcde_1', name: 'x', ids: [] }]));
assert.throws(() => validateFrames([frames[0], frames[0]]));
assert.throws(() => validateFrames([{ id: 'f_abcde_1', name: 'x'.repeat(81), ids: [id1] }]));
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'clipvault-frames-'));
try {
  assert.deepEqual(readFrames(data), []);
  saveFrames(data, frames);
  const saved = readFrames(data);
  assert.deepEqual(saved, validateFrames(frames));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data,'frames.json'),'utf8')), saved);
  saveFrames(data, []);
  assert.deepEqual(readFrames(data), []);
  assert.equal(fs.existsSync(path.join(data,'frames.json')), true);
} finally { fs.rmSync(data, { recursive: true, force: true }); }
console.log('ClipVault: frames nomeados válidos, persistência local e validação de IDs OK.');
