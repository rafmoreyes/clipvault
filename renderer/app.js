const $ = id => document.getElementById(id);
const root = $('root'), world = $('world'), state = $('state'), feedback = $('copy-feedback');
const MES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HEAD = 90, CELL = 320, GAP = 24, COLS = 5;
const days = new Map();
let layout = {}, view = { x: 60, y: 60, k: 0.5 }, sel = null, timer;
let copySeq = 0, feedbackTimer;

const fmt = d => { const [y, m, dd] = d.split('-'); return `${dd}-${MES[m - 1]}-${y.slice(2)}`; };
const apply = () => { world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; };
const save = () => { clearTimeout(timer); timer = setTimeout(() => vault.saveLayout(layout), 400); };
const hOf = it => layout[it.id].w * it.h / it.w;
const setState = p => { state.textContent = p ? 'Pausado' : 'Capturando'; state.className = p ? 'off' : ''; };

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
    console.error('[ClipVault] Falha ao copiar imagem:', err);
    feedback.textContent = 'Falha ao copiar imagem';
    feedback.classList.add('error');
  }
  feedbackTimer = setTimeout(() => { if (request === copySeq) feedback.textContent = ''; }, 5000);
}

function select(id) {
  for (const D of days.values()) for (const it of D.items) it.el.classList.toggle('sel', it.id === id);
  sel = id;
}

function makeDay(day) {
  const el = document.createElement('div'); el.className = 'frame';
  const head = document.createElement('div'); head.className = 'head';
  const title = document.createElement('span');
  const btn = document.createElement('button'); btn.textContent = 'Apagar dia';
  let t;
  btn.onpointerdown = e => e.stopPropagation();
  btn.onclick = () => {
    if (!btn.classList.contains('arm')) {
      btn.classList.add('arm'); btn.textContent = 'Confirmar?';
      t = setTimeout(() => { btn.classList.remove('arm'); btn.textContent = 'Apagar dia'; }, 3000);
      return;
    }
    clearTimeout(t); vault.delDay(day);
    for (const it of D.items) delete layout[it.id];
    el.remove(); days.delete(day); save(); relayout();
  };
  head.append(title, btn); el.append(head); world.append(el);
  const D = { day, el, title, items: [] };
  return D;
}

function place(it) {
  const p = layout[it.id];
  Object.assign(it.el.style, { left: p.x + 'px', top: HEAD + p.y + 'px', width: p.w + 'px', height: hOf(it) + 'px' });
}

function relayout() {
  let y = 0;
  for (const D of [...days.values()].sort((a, b) => b.day.localeCompare(a.day))) {
    const bottom = Math.max(0, ...D.items.map(it => layout[it.id].y + hOf(it)));
    const h = HEAD + bottom + GAP * 2;
    D.title.textContent = fmt(D.day);
    const n = document.createElement('i'); n.textContent = D.items.length + ' imagens'; D.title.append(n);
    Object.assign(D.el.style, { top: y + 'px', height: h + 'px' });
    y += h + 60;
  }
}

function bindDrag(it) {
  it.el.onpointerdown = e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(it.id);
    it.el.setPointerCapture(e.pointerId);
    const p = layout[it.id], sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y;
    let moved = false;
    it.el.onpointermove = m => {
      const dx = m.clientX - sx, dy = m.clientY - sy;
      if (!moved && Math.hypot(dx, dy) <= 5) return;
      moved = true;
      p.x = Math.max(0, Math.round(ox + dx / view.k));
      p.y = Math.max(0, Math.round(oy + dy / view.k));
      place(it); relayout();
    };
    const cleanup = () => { it.el.onpointermove = it.el.onpointerup = it.el.onpointercancel = null; };
    it.el.onpointerup = () => {
      cleanup();
      if (moved) save();
      else void copySelected(it.id); // clique coloca o PNG no clipboard
    };
    it.el.onpointercancel = () => { cleanup(); if (moved) save(); };
  };
}
function addItem({ id, w, h }) {
  const day = id.split('/')[0];
  let D = days.get(day);
  if (!D) { D = makeDay(day); days.set(day, D); }
  if (D.items.some(i => i.id === id)) return;
  if (!layout[id]) { // slot automatico em grade
    const n = D.items.length, s = Math.min(CELL / w, CELL / h, 2);
    layout[id] = { x: GAP + (n % COLS) * (CELL + GAP), y: GAP + Math.floor(n / COLS) * (CELL + GAP), w: Math.round(w * s) };
    save();
  }
  const el = document.createElement('img');
  el.className = 'it'; el.draggable = false; el.src = 'vault://data/' + id;
  const it = { id, w, h, el };
  D.items.push(it); D.el.append(el); place(it); bindDrag(it); relayout();
}

root.onpointerdown = e => {
  if (e.button !== 0) return;
  select(null); root.classList.add('pan'); root.setPointerCapture(e.pointerId);
  let lx = e.clientX, ly = e.clientY;
  root.onpointermove = m => { view.x += m.clientX - lx; view.y += m.clientY - ly; lx = m.clientX; ly = m.clientY; apply(); };
  root.onpointerup = () => { root.classList.remove('pan'); root.onpointermove = root.onpointerup = null; };
};
root.addEventListener('wheel', e => {
  e.preventDefault();
  const k = Math.min(4, Math.max(0.05, view.k * Math.exp(-e.deltaY * 0.0015)));
  view.x = e.clientX - (e.clientX - view.x) * (k / view.k);
  view.y = e.clientY - (e.clientY - view.y) * (k / view.k);
  view.k = k; apply();
}, { passive: false });

addEventListener('keydown', e => {
  if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'c' && sel) {
    e.preventDefault();
    if (!e.repeat) void copySelected(sel);
    return;
  }
  if (e.key === 'Home') { view = { x: 60, y: 60, k: 0.5 }; apply(); }
  if (e.key === 'Delete' && sel) {
    const id = sel, D = days.get(id.split('/')[0]), i = D.items.findIndex(x => x.id === id);
    vault.del([id]); D.items[i].el.remove(); D.items.splice(i, 1); delete layout[id]; sel = null;
    if (!D.items.length) { D.el.remove(); days.delete(D.day); }
    save(); relayout();
  }
});

vault.onNew(addItem);
vault.onPause(setState);
vault.load().then(r => { if (!r) return; layout = r.layout && typeof r.layout === 'object' && !Array.isArray(r.layout) ? r.layout : {}; setState(r.paused); r.items.forEach(addItem); apply(); }).catch(err => console.error('[ClipVault] Falha ao carregar:', err));
