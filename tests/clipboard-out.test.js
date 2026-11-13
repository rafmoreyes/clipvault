'use strict';
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { copyVaultImage } = require('../clipboard-out');

class MockClipboardItem {
  constructor(data) { this.data = data; }
}
async function test() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipvault-out-'));
  const day = path.join(dir, '2026-11-13');
  try {
    fs.mkdirSync(day);
    const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(24)]);
    fs.writeFileSync(path.join(day,'image.png'),png);
    let writes = 0;
    let copied;
    const clipboard = { write: async items => {
      writes++;
      assert.equal(items.length, 1);
      assert.equal(items[0].data['image/png'].type, 'image/png');
      copied = Buffer.from(await items[0].data['image/png'].arrayBuffer());
    }};
    const copiedPng = await copyVaultImage({ id:'2026-11-13/image.png', dataDirectory:dir, clipboard, ClipboardItem:MockClipboardItem });
    assert.deepEqual(copiedPng, png);
    assert.deepEqual(copied, png);
    assert.equal(writes, 1);
    for (const id of ['../x.png','2026-11-13/../../x.png','2026-11-13/a.jpg','']) {
      await assert.rejects(copyVaultImage({id,dataDirectory:dir,clipboard,ClipboardItem:MockClipboardItem}));
    }
    assert.equal(writes,1);
    console.log('Clipboard write: imagem original, tipo PNG e caminhos validados.');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
test().catch(err => { console.error(err); process.exitCode = 1; });
