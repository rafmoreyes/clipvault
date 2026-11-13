'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { getThumbnailPath, removeThumbnail, THUMB_SIZE } = require('../thumbnail-cache');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clipvault-thumbs-'));
  const id = '2026-11-13/13_11_2026_15h30m_01.png';
  const source = path.join(root, ...id.split('/'));
  try {
    await fs.promises.mkdir(path.dirname(source), { recursive: true });
    await fs.promises.writeFile(source, Buffer.from('source image - test only'));
    let generated = 0;
    const fakeImage = {
      isEmpty: () => false,
      getSize: () => ({ width: 1024, height: 768 }),
      resize: opts => {
        assert.ok(opts.width <= THUMB_SIZE);
        return { toPNG: () => Buffer.from('miniatura'), isEmpty: () => false };
      }
    };
    const nativeImage = {
      createThumbnailFromPath: async (file, options) => {
        assert.equal(file, source);
        assert.equal(options.width, THUMB_SIZE);
        generated++;
        return fakeImage;
      },
      createFromPath: () => { throw new Error('Fallback desnecessario'); }
    };
    const all = await Promise.all(Array.from({ length: 12 }, () => getThumbnailPath(root, id, nativeImage)));
    assert.equal(new Set(all).size, 1);
    assert.equal(generated, 1);
    const thumb = all[0];
    assert.ok(thumb.includes('.thumbnails'));
    assert.equal(fs.readFileSync(thumb, 'utf8'), 'miniatura');
    assert.equal(await getThumbnailPath(root, id, nativeImage), thumb);
    assert.equal(generated, 1);

    const future = new Date(Date.now() + 10000);
    await fs.promises.utimes(source, future, future);
    assert.equal(await getThumbnailPath(root, id, nativeImage), thumb);
    assert.equal(generated, 2);

    await assert.rejects(getThumbnailPath(root, '../secret.png', nativeImage), /ID invalido/);
    await removeThumbnail(root, id);
    assert.equal(fs.existsSync(thumb), false);
    assert.equal(fs.existsSync(source), true);
    console.log('Miniaturas: cache local, invalidacao, concorrencia, exclusao e PNG original OK.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
