'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { worldViewport, intersects } = require('../renderer/visibility');
const dates = require('../renderer/date-nav');
const selection = require('../renderer/multi-select');

class El {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.parent = null;
    this.style = {}; this.attributes = {}; this.hidden = false;
    this.value = ''; this.disabled = false;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name)
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text || ''; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  removeAttribute(name) { delete this.attributes[name]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  setPointerCapture() {}
  addEventListener() {}
  focus() {}
  select() {}
}

const images = [
  { id: '2026-11-13/first.png', w: 100, h: 100 },
  { id: '2026-11-13/second.png', w: 100, h: 100 },
  { id: '2026-11-13/third.png', w: 100, h: 100 },
  { id: '2026-11-12/old.png', w: 100, h: 100 }
];
const keys = ['root','world','state','copy-feedback',
  'days-toggle','days-panel','days-close','days-search','days-list',
  'days-results','days-summary','days-latest','selection-toolbar',
  'selection-count','selection-export','selection-delete','selection-clear', 'marquee-box',
    'storage-toggle', 'storage-panel', 'storage-close', 'storage-status',
    'storage-days', 'storage-trash-list', 'storage-active-size', 'storage-active-count',
    'storage-cache-size', 'storage-trash-size', 'storage-clean', 'storage-empty', 'storage-refresh'];

async function run() {
  const elements = Object.fromEntries(keys.map(key => [key, new El()]));
  elements['days-panel'].hidden = true;
  elements['selection-toolbar'].hidden = true;
  elements['storage-panel'].hidden = true;
  let onKey, requestFrame;
  const copied = [], exported = [], removed = [];
  const vault = {
    load: async () => ({ layout: {}, paused: false, items: images }),
    onNew() {}, onPause() {}, saveLayout: async () => {},
    copyImage: async id => { copied.push(id); },
    exportMany: async ids => { exported.push([...ids]); return { exported: ids.length, failed: [], cancelled: false }; },
    deleteMany: async ids => {
      removed.push([...ids]);
      return { deleted: [...ids], failed: [] };
    },
    delDay: async () => {}
  };
  const document = { getElementById: id => elements[id], createElement: tag => new El(tag) };
  const script = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  vm.runInNewContext(script, {
    document,
    window: {
      ClipVaultVisibility: { worldViewport, intersects },
      ClipVaultDateNav: dates,
      ClipVaultSelection: selection,
      innerWidth: 1400, innerHeight: 900,
      addEventListener() {}
    },
    vault,
    requestAnimationFrame: cb => { requestFrame = cb; return 1; },
    addEventListener: (name, cb) => { if (name === 'keydown') onKey = cb; },
    setTimeout: () => 1,
    clearTimeout: () => {},
    console
  });
  await Promise.resolve();
  await Promise.resolve();
  if (requestFrame) requestFrame();
  const frames = elements.world.children;
  assert.equal(frames.length, 2);
  const firstDay = frames.find(frame => frame.children.some(item => item.tagName === 'img'));
  assert.ok(firstDay);
  const byId = id => {
    for (const frame of frames) {
      for (const img of frame.children) if (img.tagName === 'img' && img.src?.includes(id)) return img;
    }
    return null;
  };
  const one = byId('first.png'), two = byId('second.png'), three = byId('third.png');
  assert.ok(one && two && three);
  function pointer(img, { ctrlKey = false, shiftKey = false, x = 10, y = 10 } = {}) {
    img.onpointerdown({ button: 0, ctrlKey, shiftKey, clientX: x, clientY: y,
      preventDefault() {}, stopPropagation() {} });
  }
  pointer(one);
  one.onpointerup();
  await Promise.resolve();
  assert.deepEqual(copied, [], 'Clique simples seleciona e não copia automaticamente');
  assert.equal(one.classList.contains('sel'), true);
  assert.equal(elements['selection-toolbar'].hidden, true);
  // O fluxo de cópia continua disponível explicitamente pelo atalho Ctrl+C.
  onKey({ key:'c', ctrlKey:true, altKey:false, shiftKey:false,
    target:elements.root, preventDefault() {}, repeat:false });
  await Promise.resolve();
  assert.deepEqual(copied, ['2026-11-13/first.png']);

  pointer(two, { ctrlKey: true });
  assert.equal(copied.length, 1, 'Ctrl+Clique não altera o clipboard');
  assert.equal(elements['selection-toolbar'].hidden, false);
  assert.equal(elements['selection-count'].textContent, '2 selecionadas');
  pointer(three, { shiftKey: true });
  assert.equal(elements['selection-count'].textContent, '3 selecionadas');
  const before = Number.parseInt(one.style.left, 10);
  pointer(one, { x: 10, y: 10 });
  one.onpointerup();
  assert.equal(elements['selection-count'].textContent, '3 selecionadas',
    'Clicar numa imagem selecionada não desfaz a seleção múltipla');
  pointer(one, { x: 10, y: 10 });
  one.onpointermove({ clientX: 40, clientY: 30 });
  one.onpointerup();
  assert.equal(elements['selection-count'].textContent, '3 selecionadas');
  assert.ok(Number.parseInt(one.style.left, 10) > before, 'Arrastar grupo deve mover imagem');
  assert.equal(copied.length, 1, 'Arrastar grupo não copia imagem');

  elements['selection-export'].onclick();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(exported.length, 1);
  assert.equal(exported[0].length, 3);
  elements['selection-delete'].onclick();
  assert.equal(removed.length, 0, 'Exclusão em lote exige segunda confirmação');
  assert.equal(elements['selection-delete'].textContent, 'Confirmar exclusão?');
  elements['selection-delete'].onclick();
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(removed.length, 1);
  assert.equal(removed[0].length, 3);
  assert.equal(elements['selection-toolbar'].hidden, true);
  assert.equal(elements.world.children.length, 1);
  assert.equal(copied.length, 1);
  console.log('ClipVault: seleção por clique, Ctrl+C, grupo intacto, arraste, exportação e exclusão OK.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
