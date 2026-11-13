'use strict';
const fs = require('node:fs');
const path = require('node:path');

const pad2 = n => String(n).padStart(2, '0');

function captureFilename(date, sequence) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('Data de captura inválida');
  }
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 99999) {
    throw new RangeError('Sequência de captura inválida');
  }
  return [
    pad2(date.getDate()),
    pad2(date.getMonth() + 1),
    String(date.getFullYear()),
    pad2(date.getHours()) + 'h' + pad2(date.getMinutes()) + 'm',
    pad2(sequence)
  ].join('_') + '.png';
}

// Reserva um nome livre sem sobrescrever outras imagens, mesmo após reiniciar.
async function saveCapturePng(directory, date, png, fileSystem = fs.promises) {
  for (let sequence = 1; sequence <= 99999; sequence++) {
    const filename = captureFilename(date, sequence);
    try {
      await fileSystem.writeFile(path.join(directory, filename), png, { flag: 'wx' });
      return filename;
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
    }
  }
  throw new Error('Não há mais nomes disponíveis para este minuto');
}

module.exports = { captureFilename, saveCapturePng };
