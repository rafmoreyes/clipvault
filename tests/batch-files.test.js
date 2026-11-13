'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { validatedIds, exportImages, deleteImages, MAX_BATCH } = require('../batch-files');

async function run() {
  assert.equal(MAX_BATCH, 2000);
  assert.deepEqual(validatedIds(['2026-11-13/a.png','2026-11-13/a.png']), ['2026-11-13/a.png']);
  for (const invalid of [
    ['../bad.png'], ['2026-11-13/../../x.png'], ['2026-11-13/a.jpg'], [],
    Array.from({ length: MAX_BATCH + 1 }, () => '2026-11-13/a.png')
  ]) assert.throws(() => validatedIds(invalid));

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'clipvault-batch-'));
  const data = path.join(temp, 'ClipVaultData'), exportDir = path.join(temp, 'export');
  const ids = ['2026-11-12/same.png', '2026-11-13/same.png', '2026-11-13/other.png'];
  try {
    fs.mkdirSync(exportDir);
    for (let i = 0; i < ids.length; i++) {
      const source = path.join(data, ...ids[i].split('/'));
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.writeFileSync(source, Buffer.from('original_' + i));
    }
    const result = await exportImages(data, exportDir, ids);
    assert.equal(result.exported, 3);
    assert.deepEqual(result.failed, []);
    assert.deepEqual(
      fs.readdirSync(exportDir).sort(),
      ['other.png', 'same.png', 'same__02.png']
    );
    assert.equal(fs.readFileSync(path.join(exportDir,'same.png'),'utf8'), 'original_0');
    assert.equal(fs.readFileSync(path.join(exportDir,'same__02.png'),'utf8'), 'original_1');
    // Rodar de novo não substitui os arquivos exportados.
    const again = await exportImages(data, exportDir, [ids[0]]);
    assert.equal(again.exported, 1);
    assert.equal(fs.readFileSync(path.join(exportDir,'same.png'),'utf8'), 'original_0');
    assert.ok(fs.existsSync(path.join(exportDir, 'same__03.png')));
    await assert.rejects(exportImages(data, path.join(data,'2026-11-12'), [ids[0]]), /fora de ClipVaultData/);
    assert.ok(fs.existsSync(path.join(data, ...ids[0].split('/'))));

    const removed = [];
    const del = await deleteImages(data, [ids[0], ids[1]], async (_root, id) => { removed.push(id); });
    assert.deepEqual(del.deleted, [ids[0], ids[1]]);
    assert.deepEqual(del.failed, []);
    assert.deepEqual(removed, [ids[0], ids[1]]);
    assert.ok(fs.existsSync(path.join(data, ...ids[2].split('/'))));
    assert.equal(fs.existsSync(path.join(data, ...ids[0].split('/'))), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  console.log('ClipVault 0.5: exportação sem sobrescrita, validação e exclusão em lote OK.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
