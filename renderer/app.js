'use strict';

const $ = id => document.getElementById(id);
const root = $('root'), world = $('world'), state = $('state'), feedback = $('copy-feedback');
const { worldViewport, intersects } = window.ClipVaultVisibility;

const MES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HEAD = 90, CELL = 320, GAP = 24, COLS = 5;
const IMAGE_ID = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;
const THUMB_SIZE = 512;
const days = new Map(), itemById = new Map();
let layout = {}, view = { x: 60, y: 60, k: 0.5 };
let sel = null, saveTimer, visibleFrame = 0, ready = false, positionChanged = false;
let copySeq = 0, feedbackTimer;
const pendingNew = [];

const fmt = day => {
  const [y, m, dd] = day.split('-');
  return dd + '-' + MES[Number(m) - 1] + '-' + y.slice(2);
};
const hOf = it => layout[it.id].w * it.h / it.w;
const setState = paused => {
  state.textContent = paused ? 'Pausado' : 'Capturando';
  state.className = paused ? 'off' : '';
};
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void vault.saveLayout(layout).catch(console.error); }, 400);
}
function apply() {
  world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
  scheduleVisible();
}
function scheduleVisible() {
  if (visibleFrame || !ready) return;
  visibleFrame = requestAnimationFrame(() => {
    visibleFrame = 0;
    refreshVisible();
  });
}

async function copySelected(id) {
  if (!id) return;
  const request = ++copySeq;
  clearTimeout(feedbackTimer);
  feedback.textContent = 'Copiando imagem...';
  feedback.classList.remove('error');
  try {
    await vault.copyImage(id);
    if (request !== copySeq) return;
    feedback.textContent = '✓ Copiada! Ctrl+V para colar em outro aplicativo';
  } catch (err) {
    if (request !== copySeq) return;
    console.error('[ClipVault] Falha ao copiar:', err);
    feedback.textContent = 'Falha ao copiar imagem';
    feedback.classList.add('error');
  }
  feedbackTimer = setTimeout(() => {
    if (request === copySeq) feedback.textContent = '';
  }, 5000);
}
function select(id) {
  if (sel && itemById.get(sel)?.el) itemById.get(sel).el.classList.remove('sel');
  sel = id;
  if (sel && itemById.get(sel)?.el) itemById.get(sel).el.classList.add('sel');
}
function validLayout(position) {
  return position && Number.isFinite(position.x) && Number.isFinite(position.y) &&
    Number.isFinite(position.w) && position.w > 0 && position.x >= 0 && position.y >= 0;
}
function makeDay(day) {
  const el = document.createElement('div');
  el.className = 'frame';
  const head = document.createElement('div'); head.className = 'head';
  const title = document.createElement('span');
  const button = document.createElement('button'); button.textContent = 'Apagar dia';
  const D = { day, el, title, items: [], mounted: new Set(), y: 0, height: 0, bottom: 0 };
  let confirmation;
  button.onpointerdown = e => e.stopPropagation();
  button.onclick = async () => {
    if (!button.classList.contains('arm')) {
      button.classList.add('arm');
      button.textContent = 'Confirmar?';
      confirmation = setTimeout(() => {
        button.classList.remove('arm');
        button.textContent = 'Apagar dia';
      }, 3000);
      return;
    }
    clearTimeout(confirmation);
    button.disabled = true;
    try {
      await vault.delDay(day);
      for (const it of D.items) {
        unmount(it);
        itemById.delete(it.id);
        delete layout[it.id];
      }
      if (sel && sel.startsWith(day + '/')) sel = null;
      D.el.remove();
      days.delete(day);
      save();
      relayout();
    } catch (err) {
      console.error('[ClipVault] Falha ao apagar dia:', err);
      button.disabled = false;
      button.classList.remove('arm');
      button.textContent = 'Falha. Tentar novamente';
    }
  };
  head.append(title, button);
  el.append(head);
  world.append(el);
  days.set(day, D);
  return D;
}
function recomputeBottom(D) {
  let bottom = 0;
  for (const it of D.items) {
    const p = layout[it.id];
    bottom = Math.max(bottom, p.y + hOf(it));
  }
  D.bottom = bottom;
}
function relayout() {
  let y = 0;
  const ordered = [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
  for (const D of ordered) {
    D.y = y;
    D.height = HEAD + D.bottom + GAP * 2;
    D.title.textContent = fmt(D.day);
    const count = document.createElement('i');
    count.textContent = D.items.length + ' imagens';
    D.title.append(count);
    Object.assign(D.el.style, { top: D.y + 'px', height: D.height + 'px' });
    y += D.height + 60;
  }
  scheduleVisible();
}
function place(it) {
  if (!it.el) return;
  const p = layout[it.id];
  Object.assign(it.el.style, {
    left: p.x + 'px',
    top: HEAD + p.y + 'px',
    width: p.w + 'px',
    height: hOf(it) + 'px'
  });
}
function preferredSrc(it) {
  const onScreenSize = Math.max(layout[it.id].w, hOf(it)) * view.k;
  if (it.thumbnailUnavailable) return 'vault://data/' + it.id;
  return (Math.max(it.w, it.h) > THUMB_SIZE && onScreenSize > THUMB_SIZE)
    ? 'vault://data/' + it.id
    : 'vault://thumb/' + it.id;
}
function assignSource(it) {
  const desired = preferredSrc(it);
  if (it.source === desired) return;
  it.source = desired;
  it.el.src = desired;
}
function bindDrag(it) {
  const img = it.el;
  img.onpointerdown = e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(it.id);
    img.setPointerCapture(e.pointerId);
    const p = layout[it.id], sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y;
    let moved = false;
    it.dragging = true;
    img.onpointermove = m => {
      const dx = m.clientX - sx, dy = m.clientY - sy;
      if (!moved && Math.hypot(dx, dy) <= 5) return;
      moved = true;
      p.x = Math.max(0, Math.round(ox + dx / view.k));
      p.y = Math.max(0, Math.round(oy + dy / view.k));
      place(it);
      if (p.y + hOf(it) > it.D.bottom) {
        it.D.bottom = p.y + hOf(it);
        relayout();
      }
    };
    const cleanup = () => {
      it.dragging = false;
      img.onpointermove = img.onpointerup = img.onpointercancel = null;
    };
    img.onpointerup = () => {
      cleanup();
      if (moved) {
        recomputeBottom(it.D);
        relayout();
        save();
      } else void copySelected(it.id);
      scheduleVisible();
    };
    img.onpointercancel = () => {
      cleanup();
      if (moved) {
        recomputeBottom(it.D);
        relayout();
        save();
      }
      scheduleVisible();
    };
  };
}
function mount(it) {
  if (it.el) return;
  const img = document.createElement('img');
  img.className = 'it';
  img.draggable = false;
  img.decoding = 'async';
  img.alt = '';
  it.el = img;
  it.D.mounted.add(it);
  img.onerror = () => {
    if (it.el !== img) return;
    // Se o cache falhar, evita tentar de novo a cada movimento do canvas.
    if (it.source === 'vault://thumb/' + it.id) {
      it.thumbnailUnavailable = true;
      it.source = 'vault://data/' + it.id;
      img.src = it.source;
    }
  };
  place(it);
  bindDrag(it);
  it.D.el.append(img);
  if (sel === it.id) img.classList.add('sel');
  assignSource(it);
}
function unmount(it) {
  if (!it.el || it.dragging) return;
  const img = it.el;
  img.onerror = null;
  img.onpointerdown = img.onpointermove = img.onpointerup = img.onpointercancel = null;
  img.remove();
  img.removeAttribute('src');
  it.el = null;
  it.source = null;
  it.D.mounted.delete(it);
}
function refreshVisible() {
  const bounds = worldViewport(view, window.innerWidth, window.innerHeight);
  for (const D of days.values()) {
    const frame = { left: 0, right: 1750, top: D.y, bottom: D.y + D.height };
    if (!intersects(bounds, frame)) {
      for (const it of [...D.mounted]) unmount(it);
      continue;
    }
    for (const it of D.items) {
      const p = layout[it.id], height = hOf(it);
      const rect = { left: p.x, right: p.x + p.w,
        top: D.y + HEAD + p.y, bottom: D.y + HEAD + p.y + height };
      if (intersects(bounds, rect)) {
        mount(it);
        if (!it.dragging) assignSource(it);
      } else unmount(it);
    }
  }
}
function addItem({ id, w, h }) {
  if (typeof id !== 'string' || !IMAGE_ID.test(id) || itemById.has(id)) return;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
  const day = id.split('/')[0];
  const D = days.get(day) || makeDay(day);
  if (!validLayout(layout[id])) {
    const index = D.items.length, scale = Math.min(CELL / w, CELL / h, 2);
    layout[id] = { x: GAP + (index % COLS) * (CELL + GAP),
      y: GAP + Math.floor(index / COLS) * (CELL + GAP),
      w: Math.max(1, Math.round(w * scale)) };
    positionChanged = true;
  }
  const it = { id, w, h, D, el: null, source: null, dragging: false };
  D.items.push(it);
  itemById.set(id, it);
  D.bottom = Math.max(D.bottom, layout[id].y + hOf(it));
}
function addBatch(items) {
  for (const item of items) addItem(item);
  relayout();
  if (positionChanged) { positionChanged = false; save(); }
}
root.onpointerdown = e => {
  if (e.button !== 0) return;
  select(null);
  root.classList.add('pan');
  root.setPointerCapture(e.pointerId);
  let lx = e.clientX, ly = e.clientY;
  root.onpointermove = m => {
    view.x += m.clientX - lx;
    view.y += m.clientY - ly;
    lx = m.clientX; ly = m.clientY;
    apply();
  };
  const stop = () => {
    root.classList.remove('pan');
    root.onpointermove = root.onpointerup = root.onpointercancel = null;
  };
  root.onpointerup = stop;
  root.onpointercancel = stop;
};
root.addEventListener('wheel', e => {
  e.preventDefault();
  const k = Math.min(4, Math.max(0.05, view.k * Math.exp(-e.deltaY * 0.0015)));
  view.x = e.clientX - (e.clientX - view.x) * (k / view.k);
  view.y = e.clientY - (e.clientY - view.y) * (k / view.k);
  view.k = k;
  apply();
}, { passive: false });
window.addEventListener('resize', scheduleVisible);

async function deleteSelected() {
  if (!sel) return;
  const id = sel, it = itemById.get(id);
  if (!it) return;
  try {
    await vault.del([id]);
    unmount(it);
    it.D.items.splice(it.D.items.indexOf(it), 1);
    itemById.delete(id);
    delete layout[id];
    sel = null;
    if (!it.D.items.length) {
      it.D.el.remove();
      days.delete(it.D.day);
    } else recomputeBottom(it.D);
    save();
    relayout();
  } catch (err) { console.error('[ClipVault] Falha ao excluir imagem:', err); }
}
addEventListener('keydown', e => {
  if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'c' && sel) {
    e.preventDefault();
    if (!e.repeat) void copySelected(sel);
    return;
  }
  if (e.key === 'Home') {
    view = { x: 60, y: 60, k: 0.5 };
    apply();
  }
  if (e.key === 'Delete' && !e.repeat) void deleteSelected();
});

vault.onNew(item => {
  if (!ready) { pendingNew.push(item); return; }
  addBatch([item]);
});
vault.onPause(setState);
vault.load().then(result => {
  if (!result) return;
  layout = result.layout && typeof result.layout === 'object' && !Array.isArray(result.layout)
    ? result.layout : {};
  setState(result.paused);
  addBatch([...result.items, ...pendingNew]);
  pendingNew.length = 0;
  ready = true;
  apply();
}).catch(err => console.error('[ClipVault] Falha ao carregar:', err));
