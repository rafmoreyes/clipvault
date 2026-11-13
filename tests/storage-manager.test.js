'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  storageSnapshot, listTrash, trashImages, trashDays, restoreTrash,
  emptyTrash, cleanLayout
} = require('../storage-manager');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clipvault-storage-'));
  const file = id => path.join(root, ...id.split('/'));
  const images = {
    a: '2026-11-13/13_11_2026_15h30m_01.png',
    b: '2026-11-13/13_11_2026_15h30m_02.png',
    c: '2026-11-12/12_11_2026_20h15m_01.png',
    d: '2026-11-11/11_11_2026_09h01m_01.png'
  };
  const layout = { [images.a]: { x: 42, y: 70, w: 320 } };
  const PNG = n => Buffer.alloc(n, 19);
  try {
    for (const [key, id] of Object.entries(images)) {
      await fs.promises.mkdir(path.dirname(file(id)), { recursive: true });
      await fs.promises.writeFile(file(id), PNG(key === 'a' ? 180 : key === 'b' ? 120 : 240));
    }
    const thumb = path.join(root, '.thumbnails', '2026-11-13', 'one.png');
    await fs.promises.mkdir(path.dirname(thumb), { recursive: true });
    await fs.promises.writeFile(thumb, PNG(30));
    let stats = await storageSnapshot(root);
    assert.equal(stats.activeCount, 4);
    assert.equal(stats.activeBytes, 180 + 120 + 240 + 240);
    assert.equal(stats.cacheBytes, 30);
    assert.equal(stats.trashBytes, 0);
    assert.deepEqual(stats.days.map(x => x.day), ['2026-11-13', '2026-11-12', '2026-11-11']);

    const removedThumbnails = [];
    const first = await trashImages(root, [images.a], layout, async (_, id) => {
      removedThumbnails.push(id);
    });
    assert.deepEqual(first.deleted, [images.a]);
    assert.deepEqual(first.failed, []);
    assert.equal(fs.existsSync(file(images.a)), false);
    assert.deepEqual(removedThumbnails, [images.a]);
    stats = await storageSnapshot(root);
    assert.equal(stats.activeCount, 3);
    assert.equal(stats.trashBytes, 180);
    assert.equal(stats.trashItems.length, 1);
    assert.deepEqual(stats.trashItems[0].layout, layout[images.a]);

    const trashToken = stats.trashItems[0].token;
    const restored = await restoreTrash(root, trashToken);
    assert.equal(restored.id, images.a);
    assert.deepEqual(restored.layout, layout[images.a]);
    assert.equal(fs.existsSync(file(images.a)), true);
    assert.equal((await listTrash(root)).length, 0);

    const again = await trashImages(root, [images.a], layout, async () => {});
    assert.equal(again.deleted.length, 1);
    await fs.promises.writeFile(file(images.a), PNG(321));
    const collision = (await listTrash(root))[0];
    const recovered = await restoreTrash(root, collision.token);
    assert.equal(recovered.id, '2026-11-13/13_11_2026_15h30m_01_restored_01.png');
    assert.equal((await fs.promises.stat(file(images.a))).size, 321);
    assert.equal((await fs.promises.stat(file(recovered.id))).size, 180);

    const batch = await trashDays(root, ['2026-11-12', '2026-11-11'], {}, async () => {});
    assert.equal(batch.deleted.length, 2);
    assert.equal(batch.failed.length, 0);
    assert.ok(fs.existsSync(file(images.b)));
    const beforeEmpty = await storageSnapshot(root);
    assert.equal(beforeEmpty.trashItems.length, 2);
    assert.equal(beforeEmpty.trashBytes, 480);
    const empty = await emptyTrash(root);
    assert.equal(empty.removed, 2);
    const after = await storageSnapshot(root);
    assert.equal(after.trashItems.length, 0);
    assert.equal(after.trashBytes, 0);
    assert.ok(fs.existsSync(file(images.b)));
    assert.ok(fs.existsSync(file(recovered.id)));
    assert.equal((await fs.promises.stat(file(recovered.id))).size, 180);

    const partial = await trashImages(root, [images.b, images.c], {}, async () => {});
    assert.deepEqual(partial.deleted, [images.b]);
    assert.deepEqual(partial.failed, [images.c]);
    assert.ok((await listTrash(root)).length === 1);
    await assert.rejects(restoreTrash(root, '../bad-token'), /Entrada inválida/);
    await assert.rejects(trashDays(root, ['../../outside'], {}, async () => {}), /Datas inválidas/);
    assert.equal(cleanLayout({ [images.a]: { x: -1, y: 1, w: 12 } }, images.a), null);
    assert.equal(cleanLayout({}, images.a), null);
    console.log('ClipVault 0.6: medição, lixeira, restauração, colisões e limpeza segura OK.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
