'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validatedIds, MAX_BATCH } = require('./batch-files');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FILE = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;
const TRASH_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const trashFolder = data => path.join(data, '.trash');

async function entriesOrEmpty(folder) {
  try { return await fs.promises.readdir(folder, { withFileTypes: true }); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
}

function cleanLayout(layout, id) {
  const p = layout && typeof layout === 'object' ? layout[id] : null;
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
      !Number.isFinite(p.w) || p.x < 0 || p.y < 0 || p.w <= 0 ||
      p.x > 10000000 || p.y > 10000000 || p.w > 50000) return null;
  return { x: p.x, y: p.y, w: p.w };
}

async function listTrash(data) {
  const out = [];
  for (const folder of await entriesOrEmpty(trashFolder(data))) {
    if (!folder.isDirectory() || !TRASH_TOKEN.test(folder.name)) continue;
    const entry = path.join(trashFolder(data), folder.name);
    try {
      const meta = JSON.parse(await fs.promises.readFile(path.join(entry, 'meta.json'), 'utf8'));
      if (!meta || !FILE.test(meta.id)) continue;
      const payload = await fs.promises.lstat(path.join(entry, 'image.png'));
      if (!payload.isFile()) continue;
      out.push({ token: folder.name, id: meta.id, date: meta.date,
        bytes: payload.size, layout: cleanLayout({ [meta.id]: meta.layout }, meta.id) });
    } catch (err) {
      // Não remove arquivos órfãos automaticamente; são recuperáveis manualmente.
      if (err.code !== 'ENOENT') console.warn('[ClipVault] Entrada na lixeira indisponível:', folder.name);
    }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.token.localeCompare(a.token));
}

async function bytesInFolder(folder, recursive) {
  let total = 0;
  for (const entry of await entriesOrEmpty(folder)) {
    const item = path.join(folder, entry.name);
    if (entry.isFile()) {
      try { const stat = await fs.promises.stat(item); total += stat.size; }
      catch (err) { if (err.code !== 'ENOENT') throw err; }
    } else if (recursive && entry.isDirectory()) {
      total += await bytesInFolder(item, true);
    }
  }
  return total;
}

async function storageSnapshot(data) {
  const days = [], all = await entriesOrEmpty(data);
  for (const entry of all) {
    if (!entry.isDirectory() || !DAY.test(entry.name)) continue;
    let bytes = 0, count = 0;
    for (const file of await entriesOrEmpty(path.join(data, entry.name))) {
      if (!file.isFile() || !/^[\w-]+\.png$/.test(file.name)) continue;
      try {
        const stat = await fs.promises.stat(path.join(data, entry.name, file.name));
        bytes += stat.size; count++;
      } catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
    if (count) days.push({ day: entry.name, count, bytes });
  }
  days.sort((a, b) => b.day.localeCompare(a.day));
  const trashItems = await listTrash(data);
  return {
    days,
    activeBytes: days.reduce((sum, d) => sum + d.bytes, 0),
    activeCount: days.reduce((sum, d) => sum + d.count, 0),
    cacheBytes: await bytesInFolder(path.join(data, '.thumbnails'), true),
    trashBytes: trashItems.reduce((sum, item) => sum + item.bytes, 0),
    trashItems
  };
}

async function trashImages(data, ids, layout, removeThumbnail) {
  const selected = validatedIds(ids), deleted = [], failed = [];
  await fs.promises.mkdir(trashFolder(data), { recursive: true });
  for (const id of selected) {
    const from = path.join(data, ...id.split('/'));
    const token = crypto.randomUUID();
    const folder = path.join(trashFolder(data), token);
    try {
      const stat = await fs.promises.lstat(from);
      if (!stat.isFile()) throw new Error('Arquivo não é PNG regular');
      await fs.promises.mkdir(folder);
      const meta = { id, date: new Date().toISOString(), layout: cleanLayout(layout, id) };
      // Metadados são gravados antes de mover o PNG. Um crash nunca apaga o original.
      await fs.promises.writeFile(path.join(folder, 'meta.json'), JSON.stringify(meta), { flag: 'wx' });
      await fs.promises.rename(from, path.join(folder, 'image.png'));
      deleted.push(id);
      if (typeof removeThumbnail === 'function') {
        try { await removeThumbnail(data, id); }
        catch (err) { console.warn('[ClipVault] Falha ao limpar miniatura:', err); }
      }
    } catch (err) {
      failed.push(id);
      // Um arquivo movido fica sempre junto do meta.json: nunca apague um
      // diretório se seu payload existir, mesmo que tenha havido falha.
      try {
        await fs.promises.access(path.join(folder, 'image.png'));
      } catch {
        await fs.promises.rm(folder, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
  return { deleted, failed };
}

async function trashDays(data, dates, layout, removeThumbnail) {
  if (!Array.isArray(dates) || !dates.length || dates.length > 366 ||
      dates.some(day => typeof day !== 'string' || !DAY.test(day))) {
    throw new Error('Datas inválidas para limpeza');
  }
  const ids = [];
  for (const day of new Set(dates)) {
    for (const file of await entriesOrEmpty(path.join(data, day))) {
      if (file.isFile() && /^[\w-]+\.png$/.test(file.name)) ids.push(day + '/' + file.name);
      if (ids.length > MAX_BATCH) throw new Error('Selecione no máximo 2.000 imagens por operação');
    }
  }
  if (!ids.length) return { deleted: [], failed: [] };
  const result = await trashImages(data, ids, layout, removeThumbnail);
  for (const day of new Set(dates)) {
    await fs.promises.rmdir(path.join(data, day)).catch(() => {});
  }
  return result;
}

async function restoreTrash(data, token) {
  if (typeof token !== 'string' || !TRASH_TOKEN.test(token)) throw new Error('Entrada inválida');
  const folder = path.join(trashFolder(data), token);
  const meta = JSON.parse(await fs.promises.readFile(path.join(folder, 'meta.json'), 'utf8'));
  if (!meta || !FILE.test(meta.id)) throw new Error('Metadados de lixeira inválidos');
  const source = path.join(folder, 'image.png');
  const stat = await fs.promises.lstat(source);
  if (!stat.isFile()) throw new Error('Arquivo da lixeira indisponível');

  const [day, originalName] = meta.id.split('/');
  const destination = path.join(data, day);
  await fs.promises.mkdir(destination, { recursive: true });
  let restored = null;
  for (let i = 0; i < 10000; i++) {
    const name = i === 0 ? originalName :
      originalName.slice(0, -4) + '_restored_' + String(i).padStart(2, '0') + '.png';
    const target = path.join(destination, name);
    try {
      // COPYFILE_EXCL evita sobrescrever a captura que por acaso use o mesmo nome.
      await fs.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
      restored = { id: day + '/' + name, layout: cleanLayout({ [meta.id]: meta.layout }, meta.id) };
      break;
    } catch (err) { if (err.code !== 'EEXIST') throw err; }
  }
  if (!restored) throw new Error('Nenhum nome disponível para restaurar');
  await fs.promises.rm(source);
  await fs.promises.rm(folder, { recursive: true, force: true });
  return restored;
}

async function emptyTrash(data) {
  const items = await listTrash(data);
  let removed = 0;
  for (const item of items) {
    await fs.promises.rm(path.join(trashFolder(data), item.token), { recursive: true, force: true });
    removed++;
  }
  return { removed };
}

module.exports = { storageSnapshot, listTrash, trashImages, trashDays,
  restoreTrash, emptyTrash, cleanLayout, DAY };
