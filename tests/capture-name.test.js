'use strict';
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { captureFilename, saveCapturePng } = require('../capture-name');

async function run() {
  const date = new Date(2026, 10, 13, 15, 30, 42, 700);
  assert.equal(captureFilename(date, 1), '13_11_2026_15h30m_01.png');
  assert.equal(captureFilename(date, 2), '13_11_2026_15h30m_02.png');
  assert.equal(captureFilename(date, 12), '13_11_2026_15h30m_12.png');
  assert.equal(captureFilename(new Date(2026, 0, 1, 0, 0), 1), '01_01_2026_00h00m_01.png');
  assert.throws(() => captureFilename(new Date('invalid'), 1));
  assert.throws(() => captureFilename(date, 0));

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'clipvault-capture-name-'));
  try {
    const png1 = Buffer.from('first PNG (test only)');
    const png2 = Buffer.from('second PNG (test only)');
    const name1 = await saveCapturePng(folder, date, png1);
    const name2 = await saveCapturePng(folder, date, png2);
    assert.equal(name1, '13_11_2026_15h30m_01.png');
    assert.equal(name2, '13_11_2026_15h30m_02.png');
    assert.deepEqual(fs.readFileSync(path.join(folder, name1)), png1);

    // Simula um reinício e outra captura no mesmo minuto.
    const name3 = await saveCapturePng(folder, date, Buffer.from('third'));
    assert.equal(name3, '13_11_2026_15h30m_03.png');

    const minuteLater = new Date(2026, 10, 13, 15, 31, 0, 0);
    assert.equal(await saveCapturePng(folder, minuteLater, png1), '13_11_2026_15h31m_01.png');
    const names = fs.readdirSync(folder);
    assert.equal(names.length, 4);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
  console.log('ClipVault: nomes por data/minuto e sufixo sequencial OK.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
