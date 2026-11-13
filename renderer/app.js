'use strict';

const $ = id => document.getElementById(id);
const root = $('root'), world = $('world'), state = $('state'), feedback = $('copy-feedback');
const modePan = $('tool-pan'), modeSelect = $('tool-select'), marqueeBox = $('marquee-box');
const daysToggle = $('days-toggle'), daysPanel = $('days-panel'), daysClose = $('days-close');
const daysSearch = $('days-search'), daysList = $('days-list'), daysResults = $('days-results');
const daysSummary = $('days-summary'), daysLatest = $('days-latest');
const selectionToolbar = $('selection-toolbar'), selectionCount = $('selection-count');
const selectionExport = $('selection-export'), selectionDelete = $('selection-delete'), selectionClear = $('selection-clear');
const storageToggle = $('storage-toggle'), storagePanel = $('storage-panel'), storageClose = $('storage-close');
const storageStatus = $('storage-status'), storageDays = $('storage-days'), storageTrashList = $('storage-trash-list');
const storageActiveSize = $('storage-active-size'), storageActiveCount = $('storage-active-count');
const storageCacheSize = $('storage-cache-size'), storageTrashSize = $('storage-trash-size');
const storageClean = $('storage-clean'), storageEmpty = $('storage-empty'), storageRefresh = $('storage-refresh');
const { worldViewport, intersects } = window.ClipVaultVisibility;
const { formatDay, filterDays } = window.ClipVaultDateNav;
const { orderedIds, rangeBetween, dragPositions, rectFromPoints, hitsRectangle } = window.ClipVaultSelection;

const MES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HEAD = 90, CELL = 320, GAP = 24, COLS = 5;
const IMAGE_ID = /^\d{4}-\d{2}-\d{2}\/[\w-]+\.png$/;
const THUMB_SIZE = 512;
const days = new Map(), itemById = new Map();
const namedFrames = new Map();
let frameCounter = 0, toolMode = 'pan';
let layout = {}, view = { x: 60, y: 60, k: 0.5 };
let sel = null, saveTimer, visibleFrame = 0, ready = false, positionChanged = false;
const selected = new Set();
let anchorId = null, multiMode = false, batchBusy = false, deleteArmed = false, deleteTimer;
let copySeq = 0, feedbackTimer;
let daysOpen = false, activeDay = null;
let storageOpen = false, storageBusy = false, storageSnapshotCache = null;
let storageConfirm = '', storageConfirmTimer = null, storageRefreshTimer = null;
const storageSelectedDays = new Set();
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

function dayStats() {
  return [...days.values()].map(D => ({ day: D.day, count: D.items.length }));
}
function renderDayList() {
  const stats = dayStats();
  const total = stats.reduce((sum, item) => sum + item.count, 0);
  daysSummary.textContent = stats.length + (stats.length === 1 ? ' dia' : ' dias') +
    ' · ' + total + (total === 1 ? ' imagem' : ' imagens');
  daysLatest.disabled = stats.length === 0;
  if (!daysOpen) return; // Não cria centenas de botões com o painel fechado.
  const found = filterDays(stats, daysSearch.value);
  daysResults.textContent = found.length === 0
    ? 'Nenhuma data encontrada'
    : found.length + (found.length === 1 ? ' dia encontrado' : ' dias encontrados');
  daysList.textContent = '';
  if (!found.length) {
    const empty = document.createElement('div');
    empty.className = 'days-empty';
    empty.textContent = stats.length ? 'Tente outra data ou mês.' : 'Copie uma imagem para começar.';
    daysList.append(empty);
    return;
  }
  for (const item of found) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'days-entry';
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', formatDay(item.day) + ': ' + item.count + ' imagens');
    if (item.day === activeDay) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'true');
    }
    const dateText = document.createElement('span');
    dateText.className = 'days-entry-date';
    dateText.textContent = formatDay(item.day);
    const counter = document.createElement('span');
    counter.className = 'days-entry-count';
    counter.textContent = String(item.count);
    button.append(dateText, counter);
    button.onclick = () => jumpToDay(item.day);
    daysList.append(button);
  }
}
function setDaysOpen(open, focusSearch = false) {
  if (open && storageOpen) setStorageOpen(false);
  daysOpen = Boolean(open);
  daysPanel.hidden = !daysOpen;
  daysToggle.setAttribute('aria-expanded', String(daysOpen));
  renderDayList();
  if (daysOpen && focusSearch) daysSearch.focus();
}
function jumpToDay(day) {
  const D = days.get(day);
  if (!D) return;
  activeDay = day;
  select(null);
  // Deixa o cabeçalho do dia visível à direita do painel recolhível.
  view.x = daysOpen ? 310 : 60;
  view.y = 76 - D.y * view.k;
  apply();
  renderDayList();
}
daysToggle.onclick = () => setDaysOpen(true, true);
daysClose.onclick = () => { setDaysOpen(false); daysToggle.focus(); };
daysSearch.oninput = renderDayList;
daysSearch.onkeydown = e => {
  if (e.key !== 'Enter') return;
  const first = filterDays(dayStats(), daysSearch.value)[0];
  if (first) jumpToDay(first.day);
};
daysLatest.onclick = () => {
  const newest = filterDays(dayStats(), '')[0];
  if (!newest) return;
  daysSearch.value = '';
  jumpToDay(newest.day);
};

function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return Math.round(value) + ' B';
  const sizes = ['KB', 'MB', 'GB', 'TB'];
  let unit = value / 1024, i = 0;
  while (unit >= 1024 && i < sizes.length - 1) { unit /= 1024; i++; }
  return (unit >= 10 ? unit.toFixed(1) : unit.toFixed(2)).replace('.', ',') + ' ' + sizes[i];
}
function snapshotPositions(ids) {
  const snapshot = {};
  for (const id of ids) {
    const p = layout[id];
    if (validLayout(p)) snapshot[id] = { x: p.x, y: p.y, w: p.w };
  }
  return snapshot;
}
function cancelStorageConfirm() {
  storageConfirm = '';
  clearTimeout(storageConfirmTimer);
  storageClean.classList.remove('confirm');
  storageEmpty.classList.remove('confirm');
  storageClean.textContent = 'Mover dias selecionados à lixeira';
  storageEmpty.textContent = 'Esvaziar lixeira';
}
function armStorageAction(which) {
  if (storageConfirm === which) return true;
  cancelStorageConfirm();
  storageConfirm = which;
  if (which === 'days') {
    storageClean.textContent = 'Confirmar envio à lixeira?';
    storageClean.classList.add('confirm');
  } else {
    storageEmpty.textContent = 'Confirmar exclusão definitiva?';
    storageEmpty.classList.add('confirm');
  }
  storageConfirmTimer = setTimeout(cancelStorageConfirm, 5000);
  return false;
}
function renderStorage(snapshot) {
  storageSnapshotCache = snapshot;
  storageActiveSize.textContent = formatBytes(snapshot.activeBytes);
  storageActiveCount.textContent = snapshot.activeCount + ' imagens';
  storageCacheSize.textContent = formatBytes(snapshot.cacheBytes);
  storageTrashSize.textContent = formatBytes(snapshot.trashBytes);
  const activeDays = new Set(snapshot.days.map(x => x.day));
  for (const day of [...storageSelectedDays]) if (!activeDays.has(day)) storageSelectedDays.delete(day);
  storageDays.textContent = '';
  if (!snapshot.days.length) {
    const empty = document.createElement('div');
    empty.className = 'storage-empty-state';
    empty.textContent = 'Ainda não há capturas armazenadas.';
    storageDays.append(empty);
  }
  for (const day of snapshot.days) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'storage-day';
    button.setAttribute('aria-pressed', String(storageSelectedDays.has(day.day)));
    if (storageSelectedDays.has(day.day)) button.classList.add('is-selected');
    const tick = document.createElement('span'); tick.className = 'storage-tick';
    tick.textContent = storageSelectedDays.has(day.day) ? '☑' : '□';
    const name = document.createElement('span'); name.className = 'storage-day-name';
    name.textContent = formatDay(day.day);
    const info = document.createElement('span'); info.className = 'storage-day-info';
    info.textContent = day.count + ' · ' + formatBytes(day.bytes);
    button.append(tick, name, info);
    button.onclick = () => {
      if (storageBusy) return;
      if (storageSelectedDays.has(day.day)) storageSelectedDays.delete(day.day);
      else storageSelectedDays.add(day.day);
      cancelStorageConfirm();
      renderStorage(storageSnapshotCache);
    };
    storageDays.append(button);
  }
  storageClean.disabled = storageBusy || !storageSelectedDays.size;
  storageTrashList.textContent = '';
  if (!snapshot.trashItems.length) {
    const empty = document.createElement('div');
    empty.className = 'storage-empty-state';
    empty.textContent = 'Lixeira vazia. Capturas excluídas poderão ser restauradas aqui.';
    storageTrashList.append(empty);
  }
  for (const item of snapshot.trashItems) {
    const row = document.createElement('div'); row.className = 'storage-trash-row';
    const labels = document.createElement('div'); labels.className = 'storage-trash-text';
    const filename = document.createElement('strong');
    filename.textContent = item.id.split('/').pop();
    filename.title = item.id;
    const details = document.createElement('small');
    details.textContent = formatDay(item.id.split('/')[0]) + ' · ' + formatBytes(item.bytes);
    labels.append(filename, details);
    const restore = document.createElement('button'); restore.type = 'button';
    restore.className = 'storage-restore';
    restore.textContent = 'Restaurar';
    restore.disabled = storageBusy;
    restore.onclick = () => { void restoreStorageItem(item.token); };
    row.append(labels, restore);
    storageTrashList.append(row);
  }
  storageEmpty.disabled = storageBusy || !snapshot.trashItems.length;
}
async function refreshStorage() {
  if (!storageOpen || storageBusy) return;
  storageStatus.textContent = 'Calculando espaço...';
  try {
    const snapshot = await vault.storageSnapshot();
    if (!storageOpen) return;
    renderStorage(snapshot);
    storageStatus.textContent = snapshot.days.length + ' dias · tudo salvo neste computador';
  } catch (err) {
    console.error('[ClipVault] Não foi possível calcular armazenamento:', err);
    storageStatus.textContent = 'Falha ao consultar armazenamento';
  }
}
function scheduleStorageRefresh() {
  if (!storageOpen) return;
  clearTimeout(storageRefreshTimer);
  storageRefreshTimer = setTimeout(() => { void refreshStorage(); }, 450);
}
function setStorageOpen(open) {
  if (open && daysOpen) setDaysOpen(false);
  storageOpen = Boolean(open);
  storagePanel.hidden = !storageOpen;
  storageToggle.setAttribute('aria-expanded', String(storageOpen));
  if (!storageOpen) {
    storageSelectedDays.clear();
    cancelStorageConfirm();
    clearTimeout(storageRefreshTimer);
    return;
  }
  select(null); // Mantém só uma barra flutuante por vez.
  void refreshStorage();
}
async function cleanStorageDays() {
  if (storageBusy || !storageSelectedDays.size) return;
  if (!armStorageAction('days')) return;
  const chosen = [...storageSelectedDays];
  const ids = chosen.flatMap(day => days.get(day)?.items.map(it => it.id) || []);
  const positions = snapshotPositions(ids);
  storageBusy = true; cancelStorageConfirm();
  storageClean.disabled = storageEmpty.disabled = true;
  try {
    const result = await vault.trashDays(chosen, positions);
    const moved = Array.isArray(result?.deleted) ? result.deleted : [];
    const failed = Array.isArray(result?.failed) ? result.failed : [];
    forgetItems(moved);
    storageSelectedDays.clear();
    showBatchFeedback(moved.length + ' imagens movidas à lixeira' +
      (failed.length ? ' · ' + failed.length + ' falharam' : ''), Boolean(failed.length));
  } catch (err) {
    console.error('[ClipVault] Falha ao limpar dias:', err);
    showBatchFeedback('Falha ao limpar dias', true);
  } finally {
    storageBusy = false;
    await refreshStorage();
  }
}
async function restoreStorageItem(token) {
  if (storageBusy) return;
  storageBusy = true;
  try {
    const item = await vault.restoreTrash(token);
    if (!item || !item.id || !item.w || !item.h) throw new Error('Restauração inválida');
    if (validLayout(item.layout)) layout[item.id] = item.layout;
    addBatch([item]);
    save();
    showBatchFeedback('Imagem restaurada no canvas');
  } catch (err) {
    console.error('[ClipVault] Falha ao restaurar imagem:', err);
    showBatchFeedback('Não foi possível restaurar a imagem', true);
  } finally {
    storageBusy = false;
    await refreshStorage();
  }
}
async function emptyStorageTrash() {
  if (storageBusy || !storageSnapshotCache?.trashItems.length) return;
  if (!armStorageAction('trash')) return;
  storageBusy = true; cancelStorageConfirm();
  storageEmpty.disabled = true;
  try {
    const result = await vault.emptyTrash();
    showBatchFeedback(result.removed + ' imagens removidas definitivamente');
  } catch (err) {
    console.error('[ClipVault] Falha ao esvaziar lixeira:', err);
    showBatchFeedback('Falha ao esvaziar a lixeira', true);
  } finally {
    storageBusy = false;
    await refreshStorage();
  }
}
storageToggle.onclick = () => setStorageOpen(true);
storageClose.onclick = () => { setStorageOpen(false); storageToggle.focus(); };
storageRefresh.onclick = () => { void refreshStorage(); };
storageClean.onclick = () => { void cleanStorageDays(); };
storageEmpty.onclick = () => { void emptyStorageTrash(); };

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
function cancelDeleteConfirm() {
  deleteArmed = false;
  clearTimeout(deleteTimer);
  selectionDelete.textContent = 'Apagar';
  selectionDelete.classList.remove('confirm');
}
function updateSelectionUI() {
  selectionToolbar.hidden = !multiMode || !selected.size;
  selectionCount.textContent = selected.size + (selected.size === 1 ? ' selecionada' : ' selecionadas');
  selectionExport.disabled = batchBusy || !selected.size;
  selectionDelete.disabled = batchBusy || !selected.size;
  selectionClear.disabled = batchBusy;
}
function changeSelection(next, primary, anchor, toolsVisible) {
  for (const id of selected) if (!next.has(id)) itemById.get(id)?.el?.classList.remove('sel');
  for (const id of next) if (!selected.has(id)) itemById.get(id)?.el?.classList.add('sel');
  selected.clear();
  for (const id of next) if (itemById.has(id)) selected.add(id);
  sel = selected.has(primary) ? primary : [...selected].at(-1) || null;
  anchorId = selected.has(anchor) ? anchor : sel;
  multiMode = Boolean(toolsVisible && selected.size);
  cancelDeleteConfirm();
  updateSelectionUI();
}
function select(id) {
  changeSelection(id && itemById.has(id) ? new Set([id]) : new Set(),
    id, id, false);
}
function selectModified(id, shift) {
  if (!itemById.has(id)) return;
  const next = new Set(selected);
  if (shift) {
    const start = anchorId && itemById.has(anchorId) ? anchorId : sel || id;
    for (const chosen of rangeBetween(orderedIds(days), start, id)) next.add(chosen);
    changeSelection(next, id, start, true);
  } else {
    if (next.has(id)) next.delete(id); else next.add(id);
    changeSelection(next, id, id, true);
  }
}
function discardSelected(ids) {
  if (!ids.length) return;
  const removed = new Set(ids), next = new Set([...selected].filter(id => !removed.has(id)));
  const primary = !removed.has(sel) ? sel : [...next].at(-1) || null;
  const anchor = !removed.has(anchorId) ? anchorId : primary;
  changeSelection(next, primary, anchor, multiMode);
}
function showBatchFeedback(message, isError = false) {
  const number = ++copySeq;
  clearTimeout(feedbackTimer);
  feedback.textContent = message;
  if (isError) feedback.classList.add('error'); else feedback.classList.remove('error');
  feedbackTimer = setTimeout(() => {
    if (number === copySeq) feedback.textContent = '';
  }, 5500);
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
      const ids = D.items.map(item => item.id);
      const result = await vault.delDay(day, snapshotPositions(ids));
      const moved = Array.isArray(result?.deleted) ? result.deleted : [];
      forgetItems(moved);
      if (result?.failed?.length) {
        showBatchFeedback(moved.length + ' movidas, ' + result.failed.length + ' falharam', true);
      } else {
        showBatchFeedback(moved.length + ' imagens movidas à lixeira');
      }
      scheduleStorageRefresh();
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
  renderDayList();
  updateNamedFrames();
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

function saveNamedFrames() {
  const frames = [...namedFrames.values()].map(frame => ({
    id: frame.id, name: frame.name, ids: [...frame.ids]
  }));
  void vault.saveFrames(frames).catch(err => {
    console.error('[ClipVault] Não foi possível salvar frames:', err);
    showBatchFeedback('Falha ao salvar os frames', true);
  });
}
function namedFrameBounds(frame) {
  const images = frame.ids.map(id => itemById.get(id)).filter(Boolean);
  if (!images.length) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const item of images) {
    const position = layout[item.id];
    if (!position) continue;
    const y = item.D.y + HEAD + position.y;
    left = Math.min(left, position.x);
    right = Math.max(right, position.x + position.w);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y + hOf(item));
  }
  if (!Number.isFinite(left)) return null;
  // Área acima da seleção reserva espaço para o nome sem mover os PNGs.
  return { left: Math.max(0, left - 22), top: top - 48,
    width: right - Math.max(0, left - 22) + 22,
    height: bottom - top + 70 };
}
function updateNamedFrames() {
  for (const frame of namedFrames.values()) {
    if (!frame.el) continue;
    const box = namedFrameBounds(frame);
    frame.el.hidden = !box;
    if (!box) continue;
    Object.assign(frame.el.style, {
      left: box.left + 'px',
      top: box.top + 'px',
      width: box.width + 'px',
      height: box.height + 'px'
    });
  }
}
function finishFrameEdit(frame, save) {
  if (!frame.editing) return;
  frame.editing = false;
  const newName = frame.input.value.trim().slice(0, 80);
  if (save && newName) frame.name = newName;
  frame.button.textContent = frame.name;
  frame.input.hidden = true;
  frame.button.hidden = false;
  saveNamedFrames();
}
function beginFrameEdit(frame) {
  if (frame.editing) return;
  frame.editing = true;
  frame.button.hidden = true;
  frame.input.hidden = false;
  frame.input.value = frame.name;
  frame.input.focus();
  frame.input.select();
}
function mountNamedFrame(frame) {
  const el = document.createElement('div');
  el.className = 'named-frame';
  const bar = document.createElement('div');
  bar.className = 'named-frame-bar';
  const name = document.createElement('button');
  name.className = 'named-frame-name';
  name.type = 'button';
  name.textContent = frame.name;
  name.title = 'Clique para renomear';
  const input = document.createElement('input');
  input.className = 'named-frame-input';
  input.type = 'text';
  input.maxLength = 80;
  input.hidden = true;
  input.setAttribute('aria-label', 'Nome do frame');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'named-frame-remove';
  remove.textContent = '×';
  remove.title = 'Remover apenas o frame, sem apagar imagens';
  remove.setAttribute('aria-label', 'Remover frame sem apagar imagens');
  frame.el = el; frame.button = name; frame.input = input; frame.editing = false;
  bar.onpointerdown = e => e.stopPropagation();
  name.onclick = () => beginFrameEdit(frame);
  input.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finishFrameEdit(frame, true); }
    if (e.key === 'Escape') { e.preventDefault(); finishFrameEdit(frame, false); }
  };
  input.onblur = () => finishFrameEdit(frame, true);
  remove.onclick = () => {
    if (frame.editing) finishFrameEdit(frame, false);
    namedFrames.delete(frame.id);
    frame.el.remove();
    saveNamedFrames();
  };
  bar.append(name, input, remove);
  el.append(bar);
  world.append(el);
}
function restoreNamedFrames(values) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (!value || typeof value.id !== 'string' || typeof value.name !== 'string' ||
        namedFrames.has(value.id) || !Array.isArray(value.ids)) continue;
    const ids = [...new Set(value.ids.filter(id => itemById.has(id)))];
    if (!ids.length) continue;
    const frame = { id: value.id, name: value.name, ids };
    namedFrames.set(frame.id, frame);
    mountNamedFrame(frame);
  }
  updateNamedFrames();
}
function discardNamedFrameMembers(ids) {
  const removed = new Set(ids);
  let dirty = false;
  for (const frame of [...namedFrames.values()]) {
    const kept = frame.ids.filter(id => !removed.has(id));
    if (kept.length === frame.ids.length) continue;
    dirty = true;
    frame.ids = kept;
    if (!kept.length) {
      frame.el?.remove();
      namedFrames.delete(frame.id);
    }
  }
  if (dirty) saveNamedFrames();
}
function createNamedFrame() {
  if (!selected.size) return;
  if (selected.size > 2000) {
    showBatchFeedback('Selecione no máximo 2.000 imagens por frame', true);
    return;
  }
  const ids = [...selected].filter(id => itemById.has(id));
  if (!ids.length) return;
  // Uma imagem participa de um frame nomeado por vez.
  for (const frame of [...namedFrames.values()]) {
    frame.ids = frame.ids.filter(id => !selected.has(id));
    if (!frame.ids.length) { frame.el?.remove(); namedFrames.delete(frame.id); }
  }
  const frame = {
    id: 'f_' + Date.now().toString(36) + '_' + (++frameCounter).toString(36),
    name: 'Frame ' + (namedFrames.size + 1),
    ids
  };
  namedFrames.set(frame.id, frame);
  mountNamedFrame(frame);
  updateNamedFrames();
  select(null);
  saveNamedFrames();
  beginFrameEdit(frame);
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
    // Select usa o botão esquerdo e precisa receber o gesto no canvas,
    // inclusive quando ele começa em cima de uma imagem.
    if (e.button !== 0 || toolMode === 'select') return;
    e.stopPropagation();
    if (batchBusy) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      selectModified(it.id, e.shiftKey);
      return; // Nunca copia uma imagem com Ctrl/Shift+Clique.
    }
    // Clicar numa imagem já selecionada permite mover todo o grupo.
    if (!selected.has(it.id)) select(it.id);
    const group = [...selected].map(id => itemById.get(id)).filter(Boolean);
    const origins = group.map(item => ({
      id: item.id, x: layout[item.id].x, y: layout[item.id].y
    }));
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    img.setPointerCapture(e.pointerId);
    for (const item of group) item.dragging = true;
    img.onpointermove = m => {
      const dx = m.clientX - sx, dy = m.clientY - sy;
      if (!moved && Math.hypot(dx, dy) <= 5) return;
      moved = true;
      const next = dragPositions(origins, dx / view.k, dy / view.k);
      let grows = false;
      for (const pos of next) {
        const item = itemById.get(pos.id);
        if (!item) continue;
        const p = layout[item.id];
        p.x = pos.x; p.y = pos.y;
        place(item);
        if (p.y + hOf(item) > item.D.bottom) {
          item.D.bottom = p.y + hOf(item);
          grows = true;
        }
      }
      if (grows) relayout();
      else updateNamedFrames();
    };
    const finish = cancelled => {
      img.onpointermove = img.onpointerup = img.onpointercancel = null;
      for (const item of group) item.dragging = false;
      if (moved) {
        for (const day of new Set(group.map(item => item.D))) recomputeBottom(day);
        relayout();
        save();
      } else if (!cancelled) {
        select(it.id);
        void copySelected(it.id);
      }
      scheduleVisible();
    };
    img.onpointerup = () => finish(false);
    img.onpointercancel = () => finish(true);
  };
}
function mount(it) {
  if (it.el) return;
  const img = document.createElement('img');
  img.className = 'it';
  img.draggable = false;
  img.decoding = 'async';
  img.setAttribute('data-clipvault-id', it.id);
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
  if (selected.has(it.id)) img.classList.add('sel');
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
function setToolMode(next) {
  toolMode = next === 'select' ? 'select' : 'pan';
  root.classList.toggle('select-mode', toolMode === 'select');
  modePan.classList.toggle('is-active', toolMode === 'pan');
  modeSelect.classList.toggle('is-active', toolMode === 'select');
  modePan.setAttribute('aria-pressed', String(toolMode === 'pan'));
  modeSelect.setAttribute('aria-pressed', String(toolMode === 'select'));
}
modePan.onclick = () => setToolMode('pan');
modeSelect.onclick = () => setToolMode('select');
root.addEventListener('contextmenu', e => e.preventDefault());

function worldFromScreen(x, y) {
  return { x: (x - view.x) / view.k, y: (y - view.y) / view.k };
}
function itemRects() {
  return [...itemById.values()].map(item => {
    const p = layout[item.id];
    const top = item.D.y + HEAD + p.y;
    return { id: item.id, left: p.x, right: p.x + p.w,
      top, bottom: top + hOf(item) };
  });
}
root.onpointerdown = e => {
  // Pan é SEMPRE RMB, seja qual for a ferramenta esquerda selecionada.
  if (e.button === 2) {
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    root.classList.add('pan');
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
    return;
  }

  if (batchBusy || storageBusy) return;
  if (e.button !== 0) return;
  if (toolMode !== 'select') {
    // Sem Select, LMB em área vazia limpa a seleção.
    select(null);
    return;
  }

  // Select é SEMPRE LMB. Os eventos que começam sobre imagens chegam
  // aqui porque bindDrag não os intercepta durante o modo Select.
  e.preventDefault();
  root.setPointerCapture(e.pointerId);
  const sx = e.clientX, sy = e.clientY;
  const clickedId = e.target?.getAttribute?.('data-clipvault-id');
  let moved = false, ex = sx, ey = sy;
  const selectedBefore = new Set(selected);
  marqueeBox.hidden = true;
  root.onpointermove = m => {
    ex = m.clientX; ey = m.clientY;
    if (!moved && Math.hypot(ex - sx, ey - sy) < 4) return;
    moved = true;
    const rect = rectFromPoints(sx, sy, ex, ey);
    Object.assign(marqueeBox.style, {
      left: rect.left + 'px', top: rect.top + 'px',
      width: (rect.right - rect.left) + 'px',
      height: (rect.bottom - rect.top) + 'px'
    });
    marqueeBox.hidden = false;
  };
  const stop = cancelled => {
    root.onpointermove = root.onpointerup = root.onpointercancel = null;
    marqueeBox.hidden = true;
    if (cancelled) return;
    if (!moved) {
      if (clickedId && itemById.has(clickedId)) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) selectModified(clickedId, Boolean(e.shiftKey));
        else changeSelection(new Set([clickedId]), clickedId, clickedId, true);
      } else if (!e.ctrlKey && !e.shiftKey && !e.metaKey) select(null);
      return;
    }
    const start = worldFromScreen(sx, sy);
    const finish = worldFromScreen(ex, ey);
    const rect = rectFromPoints(start.x, start.y, finish.x, finish.y);
    const ids = hitsRectangle(itemRects(), rect);
    const combined = (e.ctrlKey || e.shiftKey || e.metaKey)
      ? new Set(selectedBefore) : new Set();
    for (const id of ids) combined.add(id);
    const primary = ids.at(-1) || [...combined].at(-1) || null;
    changeSelection(combined, primary, primary, true);
  };
  root.onpointerup = () => stop(false);
  root.onpointercancel = () => stop(true);
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

function forgetItems(ids) {
  const affectedDays = new Set();
  for (const id of ids) {
    const item = itemById.get(id);
    if (!item) continue;
    unmount(item);
    const index = item.D.items.indexOf(item);
    if (index >= 0) item.D.items.splice(index, 1);
    affectedDays.add(item.D);
    itemById.delete(id);
    delete layout[id];
  }
  discardSelected(ids);
  discardNamedFrameMembers(ids);
  for (const D of affectedDays) {
    if (D.items.length === 0) {
      D.el.remove();
      days.delete(D.day);
    } else recomputeBottom(D);
  }
  if (ids.length) { save(); relayout(); scheduleStorageRefresh(); }
}
async function deleteSelection(ids) {
  if (!ids.length || batchBusy) return;
  cancelDeleteConfirm();
  batchBusy = true;
  updateSelectionUI();
  try {
    const result = await vault.deleteMany(ids, snapshotPositions(ids));
    const completed = Array.isArray(result?.deleted) ? result.deleted : [];
    const failed = Array.isArray(result?.failed) ? result.failed : [];
    forgetItems(completed);
    showBatchFeedback(failed.length
      ? completed.length + ' movidas à lixeira, ' + failed.length + ' falharam'
      : completed.length + (completed.length === 1 ? ' imagem movida à lixeira' : ' imagens movidas à lixeira'),
      failed.length > 0);
  } catch (err) {
    console.error('[ClipVault] Erro ao apagar seleção:', err);
    showBatchFeedback('Falha ao apagar imagens', true);
  } finally {
    batchBusy = false;
    updateSelectionUI();
  }
}
function requestDelete() {
  if (!selected.size || batchBusy) return;
  if (selected.size > 1 && !deleteArmed) {
    deleteArmed = true;
    selectionDelete.textContent = 'Confirmar exclusão?';
    selectionDelete.classList.add('confirm');
    deleteTimer = setTimeout(cancelDeleteConfirm, 5000);
    return;
  }
  void deleteSelection([...selected]);
}
async function exportSelection() {
  if (!selected.size || batchBusy) return;
  batchBusy = true;
  updateSelectionUI();
  try {
    const result = await vault.exportMany([...selected]);
    if (result?.cancelled) return;
    const failed = Array.isArray(result?.failed) ? result.failed.length : 0;
    const exported = Number(result?.exported) || 0;
    showBatchFeedback(failed
      ? exported + ' exportadas, ' + failed + ' falharam'
      : exported + (exported === 1 ? ' imagem exportada' : ' imagens exportadas'),
      failed > 0);
  } catch (err) {
    console.error('[ClipVault] Erro ao exportar seleção:', err);
    showBatchFeedback('Falha ao exportar. Escolha uma pasta fora de ClipVaultData.', true);
  } finally {
    batchBusy = false;
    updateSelectionUI();
  }
}
selectionDelete.onclick = requestDelete;
selectionExport.onclick = () => { void exportSelection(); };
selectionClear.onclick = () => select(null);

addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (e.ctrlKey && !e.altKey && !e.shiftKey && key === 'f') {
    e.preventDefault();
    setDaysOpen(true, true);
    daysSearch.select();
    return;
  }
  if (e.key === 'Escape' && daysOpen) {
    e.preventDefault();
    setDaysOpen(false);
    daysToggle.focus();
    return;
  }
  if (e.key === 'Escape' && storageOpen) {
    e.preventDefault();
    setStorageOpen(false);
    storageToggle.focus();
    return;
  }
  if (e.key === 'Escape' && selected.size && !batchBusy) {
    e.preventDefault();
    select(null);
    return;
  }
  // Não interfere com texto da pesquisa nem atalhos de botões.
  if (e.target?.closest?.('#days-panel') ||
      e.target?.closest?.('#storage-panel') ||
      e.target?.closest?.('#selection-toolbar') ||
      e.target?.matches?.('input, textarea, [contenteditable="true"]')) return;
  if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.repeat && key === 's') {
    e.preventDefault();
    setToolMode(toolMode === 'pan' ? 'select' : 'pan');
    return;
  }
  if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.repeat && key === 'f' && selected.size) {
    e.preventDefault();
    createNamedFrame();
    return;
  }
  if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'c' && selected.size) {
    e.preventDefault();
    if (!e.repeat && selected.size === 1) void copySelected(sel);
    else if (!e.repeat) showBatchFeedback('Ctrl+C copia uma imagem por vez');
    return;
  }
  if (e.key === 'Home') {
    view = { x: 60, y: 60, k: 0.5 };
    apply();
  }
  if (e.key === 'Delete' && !e.repeat) {
    e.preventDefault();
    requestDelete();
  }
});

vault.onNew(item => {
  if (!ready) { pendingNew.push(item); return; }
  addBatch([item]);
  scheduleStorageRefresh();
});
vault.onPause(setState);
vault.load().then(result => {
  if (!result) return;
  layout = result.layout && typeof result.layout === 'object' && !Array.isArray(result.layout)
    ? result.layout : {};
  setState(result.paused);
  addBatch([...result.items, ...pendingNew]);
  restoreNamedFrames(result.frames);
  pendingNew.length = 0;
  const first = filterDays(dayStats(), '')[0];
  if (!activeDay && first) activeDay = first.day;
  ready = true;
  apply();
}).catch(err => console.error('[ClipVault] Falha ao carregar:', err));
