'use strict';
// Electron 44+: leitura assíncrona, apenas representações de imagem.
async function readClipboardImage(clipboard, nativeImage) {
  const items = await clipboard.read();
  if (!Array.isArray(items)) return null;
  const preference = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp', 'image/gif'];
  for (const item of items) {
    if (!item || !Array.isArray(item.types) || typeof item.getType !== 'function') continue;
    for (const type of preference) {
      if (!item.types.includes(type)) continue;
      try {
        const blob = await item.getType(type);
        if (!blob || typeof blob.arrayBuffer !== 'function') continue;
        const raw = Buffer.from(await blob.arrayBuffer());
        if (!raw.length) continue;
        const image = nativeImage.createFromBuffer(raw);
        if (!image || image.isEmpty()) continue;
        const { width, height } = image.getSize();
        if (!width || !height || width > 32768 || height > 32768) continue;
        const png = type === 'image/png' ? raw : image.toPNG();
        if (png.length) return { png, width, height };
      } catch { /* Tenta a próxima representação de imagem. */ }
    }
  }
  return null;
}
module.exports = { readClipboardImage };
