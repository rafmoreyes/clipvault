const { app, BrowserWindow, Tray, Menu, clipboard, nativeImage, protocol, net, ipcMain, session, globalShortcut } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { pathToFileURL } = require('url');

// Dados ficam FORA da pasta do projeto (nunca vao pro GitHub)
const DATA = path.join(os.homedir(), 'ClipVaultData');
const LAYOUT = path.join(DATA, 'layout.json');
const DAY = /^\d{4}-\d{2}-\d{2}$/, FILE = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;

protocol.registerSchemesAsPrivileged([{ scheme: 'vault', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

let win, tray, paused = false, lastHash = null;
const two = n => String(n).padStart(2, '0');
const hashOf = img => crypto.createHash('sha256').update(img.toBitmap()).digest('hex');
const icon = ([r, g, b]) => { const buf = Buffer.alloc(1024); for (let i = 0; i < 256; i++) buf.set([b, g, r, 255], i * 4); return nativeImage.createFromBitmap(buf, { width: 16, height: 16 }); };

function dims(f) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(f, 'r');
  try {
    if (fs.readSync(fd, b, 0, 24, 0) !== 24 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG invalido');
  } finally { fs.closeSync(fd); }
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  if (!w || !h || w > 32768 || h > 32768) throw new Error('Dimensoes invalidas');
  return { w, h };
}
function listAll() {
  const out = [];
  if (!fs.existsSync(DATA)) return out;
  for (const d of fs.readdirSync(DATA)) {
    if (!DAY.test(d)) continue;
    const dir = path.join(DATA, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^[\w-]+\.png$/.test(f)) continue;
      try { out.push({ id: `${d}/${f}`, ...dims(path.join(DATA, d, f)) }); } catch {}
    }
  }
  return out;
}
const readLayout = () => { try { const l = JSON.parse(fs.readFileSync(LAYOUT, 'utf8')); return l && typeof l === 'object' && !Array.isArray(l) ? l : {}; } catch { return {}; } };

function tick() {
  if (paused) return;
  try {
    // Le apenas a representacao de imagem do clipboard; texto nunca e lido.
    const img = clipboard.readImage();
    if (img.isEmpty()) { lastHash = null; return; }
    const h = hashOf(img);
    if (h === lastHash) return;
    const png = img.toPNG(), size = img.getSize();
    const d = new Date();
    const day = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
    const name = `${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}${String(d.getMilliseconds()).padStart(3, '0')}-${h.slice(0, 10)}.png`;
    const dir = path.join(DATA, day);
    fs.mkdirSync(dir, { recursive: true });
    lastHash = h;
    fs.writeFile(path.join(dir, name), png, err => {
      if (err) { console.error('[ClipVault] Falha ao salvar imagem:', err); return; }
      if (win && !win.isDestroyed()) win.webContents.send('new-image', { id: `${day}/${name}`, w: size.width, h: size.height });
    });
  } catch (err) { console.error('[ClipVault] Falha na captura:', err); }
}
function setPaused(p) {
  paused = p;
  if (!p) { const i = clipboard.readImage(); lastHash = i.isEmpty() ? null : hashOf(i); } // ignora o que foi copiado na pausa
  tray.setImage(icon(p ? [120, 120, 120] : [94, 224, 193]));
  tray.setToolTip(p ? 'ClipVault (pausado)' : 'ClipVault (capturando)');
  tray.setContextMenu(buildMenu());
  if (win) win.webContents.send('paused', p);
}
const buildMenu = () => Menu.buildFromTemplate([
  { label: 'Abrir canvas', click: openWin },
  { label: paused ? 'Retomar captura' : 'Pausar captura', click: () => setPaused(!paused) },
  { type: 'separator' },
  { label: 'Sair', click: () => app.exit(0) },
]);

function openWin() {
  if (win) { win.show(); win.focus(); return; }
  win = new BrowserWindow({
    width: 1400, height: 900, backgroundColor: '#12151c', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false },
  });
  win.loadURL('vault://app/index.html');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('closed', () => { win = null; });
}

const fromUI = e => Boolean(e.senderFrame && e.senderFrame.url === 'vault://app/index.html');
ipcMain.handle('load', e => fromUI(e) ? { items: listAll(), layout: readLayout(), paused } : null);
ipcMain.handle('saveLayout', (e, l) => {
  if (!fromUI(e) || !l || typeof l !== 'object' || Array.isArray(l)) return;
  fs.writeFileSync(LAYOUT + '.tmp', JSON.stringify(l)); fs.renameSync(LAYOUT + '.tmp', LAYOUT);
});
ipcMain.handle('del', (e, ids) => {
  if (!fromUI(e) || !Array.isArray(ids)) return;
  for (const id of ids) if (FILE.test(id)) fs.rmSync(path.join(DATA, id), { force: true });
});
ipcMain.handle('delDay', (e, d) => {
  if (fromUI(e) && DAY.test(d)) fs.rmSync(path.join(DATA, d), { recursive: true, force: true });
});

app.on('second-instance', openWin);
app.on('window-all-closed', () => {}); // continua rodando na bandeja

app.whenReady().then(() => {
  fs.mkdirSync(DATA, { recursive: true });
  // Sem rede: so o protocolo interno (vault://) e permitido
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(vault|file|devtools|data):/.test(d.url) }));
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  protocol.handle('vault', req => {
    const u = new URL(req.url);
    const base = u.hostname === 'app' ? path.join(__dirname, 'renderer') : u.hostname === 'data' ? DATA : null;
    if (!base) return new Response('', { status: 404 });
    let relative;
    try { relative = decodeURIComponent(u.pathname).replace(/^\/+/, ''); }
    catch { return new Response('', { status: 400 }); }
    // Somente assets do app e PNGs capturados podem ser servidos.
    if (u.hostname === 'app' && !['index.html', 'app.js', 'style.css'].includes(relative)) return new Response('', { status: 403 });
    if (u.hostname === 'data' && !FILE.test(relative)) return new Response('', { status: 403 });
    const f = path.resolve(base, relative);
    const inside = path.relative(base, f);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(f).toString());
  });
  tray = new Tray(icon([94, 224, 193]));
  tray.on('click', openWin);
  const cur = clipboard.readImage();
  lastHash = cur.isEmpty() ? null : hashOf(cur); // nao salva o que ja estava no clipboard ao abrir
  setPaused(false);
  globalShortcut.register('Control+Alt+P', () => setPaused(!paused));
  setInterval(tick, 700);
  openWin();
});
