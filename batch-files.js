'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_BATCH = 2000;
const FILE_ID = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;

function validatedIds(ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_BATCH ||
      ids.some(id => typeof id !== 'string' || !FILE_ID.test(id))) {
    throw new Error('Seleção de imagens inválida');
  }
  return [...new Set(ids)];
}

function insideDirectory(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return !relative || (relative !== '..' &&
    !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

async function exportImages(dataDirectory, destination, ids) {
  const selected = validatedIds(ids);
  const folder = path.resolve(destination);
  if (insideDirectory(dataDirectory, folder)) {
    throw new Error('Escolha uma pasta fora de ClipVaultData para exportar');
  }
  const dirStat = await fs.promises.stat(folder);
  if (!dirStat.isDirectory()) throw new Error('Destino não é uma pasta');
  let exported = 0;
  const failed = [];
  for (const id of selected) {
    const source = path.join(dataDirectory, ...id.split('/'));
    const fileName = path.basename(source);
    try {
      const stat = await fs.promises.lstat(source);
      if (!stat.isFile()) throw new Error('Origem não é arquivo PNG');
      let completed = false;
      for (let n = 1; n <= 9999; n++) {
        const targetName = n === 1 ? fileName :
          fileName.slice(0, -4) + '__' + String(n).padStart(2, '0') + '.png';
        try {
          await fs.promises.copyFile(
            source, path.join(folder, targetName), fs.constants.COPYFILE_EXCL
          );
          exported++;
          completed = true;
          break;
        } catch (err) {
          if (err.code !== 'EEXIST') throw err;
        }
      }
      if (!completed) throw new Error('Sem nome disponível no destino');
    } catch (err) {
      failed.push(id);
    }
  }
  return { exported, failed, cancelled: false };
}

async function deleteImages(dataDirectory, ids, removeThumbnail) {
  const selected = validatedIds(ids);
  const deleted = [], failed = [];
  for (const id of selected) {
    try {
      await fs.promises.rm(path.join(dataDirectory, ...id.split('/')), { force: true });
      await removeThumbnail(dataDirectory, id);
      deleted.push(id);
    } catch (err) {
      failed.push(id);
    }
  }
  return { deleted, failed };
}

module.exports = { validatedIds, exportImages, deleteImages, MAX_BATCH };
