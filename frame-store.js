'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FRAME_ID = /^f_[a-z0-9_]{4,48}$/;
const IMAGE_ID = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;
const MAX_FRAMES = 500;
const MAX_MEMBERS = 2000;

function validateFrames(value) {
  if (!Array.isArray(value) || value.length > MAX_FRAMES) throw new Error('Lista de frames inválida');
  const seen = new Set();
  return value.map(frame => {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame) ||
        typeof frame.id !== 'string' || !FRAME_ID.test(frame.id) || seen.has(frame.id) ||
        typeof frame.name !== 'string' || frame.name.trim().length < 1 ||
        frame.name.trim().length > 80 || !Array.isArray(frame.ids) ||
        frame.ids.length < 1 || frame.ids.length > MAX_MEMBERS ||
        frame.ids.some(id => typeof id !== 'string' || !IMAGE_ID.test(id))) {
      throw new Error('Frame ou membros inválidos');
    }
    seen.add(frame.id);
    return { id: frame.id, name: frame.name.trim(), ids: [...new Set(frame.ids)] };
  });
}

function readFrames(directory) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(directory, 'frames.json'), 'utf8'));
    return validateFrames(value);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[ClipVault] Frames não puderam ser lidos:', error.message);
    return [];
  }
}

function saveFrames(directory, value) {
  const verified = validateFrames(value);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'frames.json');
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(verified, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return true;
}

module.exports = { validateFrames, readFrames, saveFrames };
