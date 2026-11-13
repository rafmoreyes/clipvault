'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { worldViewport, intersects } = require('../renderer/visibility');
const dates = require('../renderer/date-nav');
const selection = require('../renderer/multi-select');

class El {
  constructor(tag='div') {
    this.tagName = tag; this.children = []; this.parent = null;
    this.style = {}; this.attributes = {}; this.hidden = false; this.value = ''; this.disabled = false;
    const names = new Set();
    this.classList = {
      add: (...items) => items.forEach(x => names.add(x)),
      remove: (...items) => items.forEach(x => names.delete(x)),
      contains: name => names.has(name)
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text || ''; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  setPointerCapture() {}
  addEventListener() {}
  focus() {}
  select() {}
}

async function run() {
  const keys = ['root','world','state','copy-feedback',
    'days-toggle','days-panel','days-close','days-search','days-list',
    'days-results','days-summary','days-latest','selection-toolbar',
    'selection-count','selection-export','selection-delete','selection-clear', 'marquee-box',
    'storage-toggle','storage-panel','storage-close','storage-status',
    'storage-days','storage-trash-list','storage-active-size','storage-active-count',
    'storage-cache-size','storage-trash-size','storage-clean','storage-empty','storage-refresh'
  ];
  const elements = Object.fromEntries(keys.map(id => [id, new El()]));
  elements['days-panel'].hidden = true;
  elements['storage-panel'].hidden = true;
  elements['selection-toolbar'].hidden = true;
  const oldId = '2026-11-12/old.png';
  const newId = '2026-11-13/new.png';
  const token = '00000000-0000-4000-8000-000000000001';
  let snapshot = {
    activeBytes: 3072, activeCount: 2, cacheBytes: 512, trashBytes: 0,
    days: [
      { day: '2026-11-13', count: 1, bytes: 2048 },
      { day: '2026-11-12', count: 1, bytes: 1024 }
    ],
    trashItems: []
  };
  const deleted = [], restored = [], emptied = [];
  const vault = {
    load: async () => ({ layout: { [oldId]: { x: 74, y: 25, w: 180 } },
      paused: false, items: [{ id: oldId, w: 200, h: 200 }, { id: newId, w: 300, h: 300 }] }),
    onNew() {}, onPause() {}, saveLayout: async () => {},
    copyImage: async () => {}, delDay: async () => ({ deleted: [], failed: [] }),
    deleteMany: async () => ({ deleted: [], failed: [] }),
    exportMany: async () => ({ exported: 0, failed: [], cancelled: true }),
    storageSnapshot: async () => snapshot,
    trashDays: async (dates, positions) => {
      deleted.push({ dates, positions });
      snapshot = {
        ...snapshot, activeCount: 1, activeBytes: 2048,
        trashBytes: 1024, days: snapshot.days.filter(item => item.day !== '2026-11-12'),
        trashItems: [{ token, id: oldId, bytes: 1024, date: '2026-11-13T19:01:00Z' }]
      };
      return { deleted: [oldId], failed: [] };
    },
    restoreTrash: async id => {
      restored.push(id);
      snapshot = {
        ...snapshot, activeCount: 2, activeBytes: 3072, trashBytes: 0,
        days: [...snapshot.days, { day: '2026-11-12', count: 1, bytes: 1024 }],
        trashItems: []
      };
      return { id: oldId, w: 200, h: 200, layout: { x: 74, y: 25, w: 180 } };
    },
    emptyTrash: async () => {
      emptied.push(true);
      snapshot = { ...snapshot, trashBytes: 0, trashItems: [] };
      return { removed: 1 };
    }
  };
  let keydown, frame;
  const code = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  vm.runInNewContext(code, {
    document: { getElementById: id => elements[id], createElement: tag => new El(tag) },
    window: {
      ClipVaultVisibility: { worldViewport, intersects }, ClipVaultDateNav: dates,
      ClipVaultSelection: selection, innerWidth: 1400, innerHeight: 900,
      addEventListener() {}
    },
    vault, requestAnimationFrame: cb => { frame = cb; return 1; },
    addEventListener: (name, cb) => { if (name === 'keydown') keydown = cb; },
    setTimeout: () => 1, clearTimeout: () => {}, console
  });
  for (let i = 0; i < 6; i++) await Promise.resolve();
  if (frame) frame();
  assert.equal(elements['storage-panel'].hidden, true);
  elements['storage-toggle'].onclick();
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(elements['storage-panel'].hidden, false);
  assert.equal(elements['storage-days'].children.length, 2);
  assert.equal(elements['storage-active-size'].textContent, '3,00 KB');
  assert.equal(elements['storage-clean'].disabled, true);

  elements['storage-days'].children[1].onclick();
  assert.equal(elements['storage-clean'].disabled, false);
  elements['storage-clean'].onclick();
  assert.equal(deleted.length, 0, 'A primeira ação deve pedir confirmação');
  assert.equal(elements['storage-clean'].classList.contains('confirm'), true);
  elements['storage-clean'].onclick();
  for (let i = 0; i < 18; i++) await Promise.resolve();
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].dates[0], '2026-11-12');
  assert.equal(deleted[0].positions[oldId].x, 74);
  assert.equal(elements['storage-days'].children.length, 1);
  assert.equal(elements['storage-trash-list'].children.length, 1);
  assert.equal(elements['storage-trash-size'].textContent, '1,00 KB');

  elements['storage-trash-list'].children[0].children[1].onclick();
  for (let i = 0; i < 18; i++) await Promise.resolve();
  assert.deepEqual(restored, [token]);
  assert.equal(elements['storage-days'].children.length, 2);
  assert.equal(elements['storage-trash-list'].children.length, 1);
  assert.equal(elements['storage-trash-list'].children[0].className, 'storage-empty-state');

  snapshot = { ...snapshot, trashBytes: 256,
    trashItems: [{ token, id: oldId, bytes: 256, date: '2026-11-13T19:01:00Z' }] };
  elements['storage-refresh'].onclick();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  elements['storage-empty'].onclick();
  assert.equal(emptied.length, 0, 'Esvaziar precisa de confirmação');
  elements['storage-empty'].onclick();
  for (let i = 0; i < 15; i++) await Promise.resolve();
  assert.equal(emptied.length, 1);
  assert.equal(elements['storage-empty'].disabled, true);
  keydown({ key: 'Escape', target: elements['storage-panel'], preventDefault() {} });
  assert.equal(elements['storage-panel'].hidden, true);
  assert.equal(elements['days-panel'].hidden, true);
  console.log('ClipVault 0.6: painel, totais, limpeza confirmada, restauração e lixeira OK.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
