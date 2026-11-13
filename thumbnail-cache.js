'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const IMAGE_ID = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;
const THUMB_SIZE = 512;
const inFlight = new Map();
const queue = [];
let active = 0;
const MAX_ACTIVE = 2;

function schedule(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    drain();
  });
}

function drain() {
  while (active < MAX_ACTIVE && queue.length) {
    const next = queue.shift();
    active++;
    Promise.resolve().then(next.task).then(next.resolve, next.reject)
      .finally(() => { active--; drain(); });
  }
}

async function maybeStat(file) {
  try { return await fs.promises.stat(file); }
  catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

async function createThumbnail(dataDir, id, nativeImage) {
  const source = path.join(dataDir, ...id.split('/'));
  const target = path.join(dataDir, '.thumbnails', ...id.split('/'));
  const sourceStat = await fs.promises.stat(source);
  if (!sourceStat.isFile()) throw new Error('Fonte nao e um arquivo');
  const cached = await maybeStat(target);
  if (cached?.isFile() && cached.size > 0 && cached.mtimeMs >= sourceStat.mtimeMs) return target;

  let image = await nativeImage.createThumbnailFromPath(source, { width: THUMB_SIZE, height: THUMB_SIZE });
  if (!image || image.isEmpty()) {
    // Fallback para PNGs sem miniatura disponível no Shell.
    image = nativeImage.createFromPath(source);
  }
  if (!image || image.isEmpty()) throw new Error('Nao foi possivel gerar miniatura');
  const { width, height } = image.getSize();
  if (!width || !height) throw new Error('Miniatura invalida');
  if (Math.max(width, height) > THUMB_SIZE) {
    image = image.resize({ width: Math.max(1, Math.round(width * THUMB_SIZE / Math.max(width, height))), quality: 'good' });
  }
  const buffer = image.toPNG();
  if (!buffer?.length) throw new Error('Miniatura vazia');
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  // Arquivo temporário evita que o renderer receba uma miniatura incompleta.
  const temporary = target + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  try {
    await fs.promises.writeFile(temporary, buffer, { flag: 'wx' });
    await fs.promises.rename(temporary, target);
  } finally {
    await fs.promises.rm(temporary, { force: true }).catch(() => {});
  }
  return target;
}

function getThumbnailPath(dataDir, id, nativeImage) {
  if (typeof id !== 'string' || !IMAGE_ID.test(id)) return Promise.reject(new Error('ID invalido'));
  const key = dataDir + '|' + id;
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = schedule(() => createThumbnail(dataDir, id, nativeImage));
  inFlight.set(key, promise);
  void promise.finally(() => { inFlight.delete(key); }).catch(() => {});
  return promise;
}

async function removeThumbnail(dataDir, id) {
  if (!IMAGE_ID.test(id)) return;
  const target = path.join(dataDir, '.thumbnails', ...id.split('/'));
  await fs.promises.rm(target, { force: true }).catch(() => {});
}

module.exports = { getThumbnailPath, removeThumbnail, THUMB_SIZE, IMAGE_ID };
