const { app, BrowserWindow, Tray, Menu, clipboard, ClipboardItem, nativeImage, protocol, net, ipcMain, session, globalShortcut } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { pathToFileURL } = require('url');
const { readClipboardImage } = require('./clipboard-image');
const { copyVaultImage } = require('./clipboard-out');

// Dados ficam FORA da pasta do projeto (nunca vao pro GitHub)
const DATA = path.join(os.homedir(), 'ClipVaultData');
const LAYOUT = path.join(DATA, 'layout.json');
const DAY = /^\d{4}-\d{2}-\d{2}$/, FILE = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;

protocol.registerSchemesAsPrivileged([{ scheme: 'vault', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

let win, tray, paused = false, lastHash = null;
let captureBusy = false, priming = false, generation = 0;
let copyPending = 0, copyQueue = Promise.resolve();
const two = n => String(n).padStart(2, '0');
const hashOf = png => crypto.createHash('sha256').update(png).digest('hex');
const icon = ([r, g, b]) => { const buf = Buffer.alloc(1024); for (let i = 0; i < 256; i++) buf.set([b, g, r, 255], i * 4); return nativeImage.createFromBitmap(buf, { width: 16, height: 16 }); };
const iconPath = () => app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, 'build', 'icon.png');
function trayIcon(isPaused) {
  if (isPaused) return icon([120, 120, 120]);
  const image = nativeImage.createFromPath(iconPath());
  return image.isEmpty() ? icon([94, 224, 193]) : image.resize({ width: 16, height: 16 });
}

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

async function tick() {
  if (paused || priming || captureBusy || copyPending > 0) return;
  captureBusy = true;
  const currentGeneration = generation;
  try {
    const result = await readClipboardImage(clipboard, nativeImage);
    if (paused || priming || currentGeneration !== generation) return;
    if (!result) { lastHash = null; return; }
    const { png, width, height } = result;
    const h = hashOf(png);
    if (h === lastHash) return;
    const d = new Date();
    const day = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
    const name = `${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}${String(d.getMilliseconds()).padStart(3, '0')}-${h.slice(0, 10)}.png`;
    const dir = path.join(DATA, day);
    await fs.promises.mkdir(dir, { recursive: true });
    if (paused || priming || currentGeneration !== generation) return;
    await fs.promises.writeFile(path.join(dir, name), png, { flag: 'wx' });
    lastHash = h;
    if (win && !win.isDestroyed()) win.webContents.send('new-image', { id: `${day}/${name}`, w: width, h: height });
  } catch (err) { console.error('[ClipVault] Falha na captura:', err); }
  finally { captureBusy = false; }
}

async function setPaused(p) {
  paused = Boolean(p);
  const currentGeneration = ++generation;
  priming = !paused;
  if (!paused) {
    try {
      const result = await readClipboardImage(clipboard, nativeImage);
      if (currentGeneration === generation) lastHash = result ? hashOf(result.png) : null;
    } catch (err) { console.error('[ClipVault] Falha ao inicializar clipboard:', err); }
    finally { if (currentGeneration === generation) priming = false; }
  }
  if (currentGeneration !== generation) return;
  tray.setImage(trayIcon(paused));
  tray.setToolTip(paused ? 'ClipVault (pausado)' : 'ClipVault (capturando)');
  tray.setContextMenu(buildMenu());
  if (win && !win.isDestroyed()) win.webContents.send('paused', paused);
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
    icon: fs.existsSync(iconPath()) ? iconPath() : undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false },
  });
  win.loadURL('vault://app/index.html');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('closed', () => { win = null; });
}

const fromUI = e => Boolean(e.senderFrame && e.senderFrame.url === 'vault://app/index.html');
ipcMain.handle('load', e => fromUI(e) ? { items: listAll(), layout: readLayout(), paused } : null);
// Copia apenas um PNG já salvo. A cópia não cria um novo item no Vault.
ipcMain.handle('copyImage', (e, id) => {
  if (!fromUI(e) || typeof id !== 'string' || !FILE.test(id)) throw new Error('Imagem inválida');
  copyPending++;
  ++generation; // invalida qualquer leitura do monitor já iniciada
  const job = copyQueue.then(async () => {
    const png = await copyVaultImage({ id, dataDirectory: DATA, clipboard, ClipboardItem });
    // O Windows pode recodificar um PNG ao colocá-lo no clipboard.
    // Usa a representação lida de volta para não registrar cópias duplicadas.
    let clipboardImage = null;
    try { clipboardImage = await readClipboardImage(clipboard, nativeImage); }
    catch (err) { console.warn('[ClipVault] Não foi possível conferir a imagem copiada:', err); }
    lastHash = hashOf(clipboardImage ? clipboardImage.png : png);
    return true;
  });
  copyQueue = job.catch(() => {});
  return job.finally(() => { copyPending--; });
});
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

app.whenReady().then(async () => {
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
  tray = new Tray(trayIcon(false));
  tray.on('click', openWin);
  await setPaused(false);
  globalShortcut.register('Control+Alt+P', () => { void setPaused(!paused); });
  setInterval(() => { void tick(); }, 700);
  openWin();
}).catch(err => { console.error('[ClipVault] Falha ao iniciar:', err); app.quit(); });
