'use strict';
const path = require('node:path');
const fs = require('node:fs');

const IMAGE_ID = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a','hex');
const MAX_BYTES = 128 * 1024 * 1024;

async function copyVaultImage({ id, dataDirectory, clipboard, ClipboardItem }) {
  if (typeof id !== 'string' || !IMAGE_ID.test(id)) throw new Error('Imagem inválida');
  const fullPath = path.join(dataDirectory, ...id.split('/'));
  const stat = await fs.promises.stat(fullPath);
  if (!stat.isFile() || stat.size < 24 || stat.size > MAX_BYTES) throw new Error('Arquivo de imagem inválido');
  const png = await fs.promises.readFile(fullPath);
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Arquivo não é PNG');
  const blob = new Blob([new Uint8Array(png)], { type: 'image/png' });
  await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  return png;
}
module.exports = { copyVaultImage, IMAGE_ID };
