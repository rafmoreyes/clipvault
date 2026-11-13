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
    const names = new Set();
    this.classList = {
      add: (...items) => items.forEach(name => names.add(name)),
      remove: (...items) => items.forEach(name => names.delete(name)),
      contains: name => names.has(name),
      toggle: (name, on) => {
        if (on === undefined) on = !names.has(name);
        if (on) names.add(name); else names.delete(name);
        return on;
      }
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text || ''; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener() {}
  setPointerCapture() {}
  focus() { this.focused = true; }
  select() { this.selected = true; }
}

async function run() {
  const ids = ['root','world','state','copy-feedback',
    'days-toggle','days-panel','days-close','days-search','days-list',
    'days-results','days-summary','days-latest','selection-toolbar',
    'selection-count','selection-export','selection-delete','selection-clear',
    'storage-toggle','storage-panel','storage-close','storage-status',
    'storage-days','storage-trash-list','storage-active-size','storage-active-count',
    'storage-cache-size','storage-trash-size','storage-clean','storage-empty','storage-refresh',
    'tool-pan','tool-select','marquee-box'];
  const elements = Object.fromEntries(ids.map(id => [id, new El()]));
  for (const id of ['days-panel','storage-panel','selection-toolbar','marquee-box']) elements[id].hidden = true;
  const data = [
    { id:'2026-11-13/a.png', w:100, h:100 },
    { id:'2026-11-13/b.png', w:100, h:100 },
    { id:'2026-11-13/c.png', w:100, h:100 }
  ];
  const copied = [], persisted = [];
  const vault = {
    load: async () => ({ items:data, layout:{}, frames:[], paused:false }),
    saveLayout: async () => {}, saveFrames: async value => {
      persisted.push(JSON.parse(JSON.stringify(value))); return true;
    },
    copyImage: async id => { copied.push(id); },
    onNew() {}, onPause() {}, delDay: async () => ({ deleted:[], failed:[] }),
    deleteMany: async () => ({ deleted:[], failed:[] }),
    exportMany: async () => ({ exported:0, failed:[], cancelled:true })
  };
  let keydown, frame;
  const script = fs.readFileSync(path.join(__dirname, '..', 'renderer/app.js'), 'utf8');
  vm.runInNewContext(script, {
    document: { getElementById: id => elements[id], createElement: tag => new El(tag) },
    window: { ClipVaultVisibility: { worldViewport, intersects },
      ClipVaultDateNav: dates, ClipVaultSelection: selection,
      innerWidth: 1400, innerHeight: 900, addEventListener() {} },
    vault, requestAnimationFrame: cb => { frame = cb; return 1; },
    addEventListener: (name, cb) => { if (name === 'keydown') keydown = cb; },
    setTimeout: () => 1, clearTimeout: () => {}, console
  });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  if (frame) frame();
  const root = elements.root, world = elements.world;
  const img = world.children[0].children.find(child => child.tagName === 'img');
  assert.ok(img, 'Capture deve estar presente e clicável');

  // Clique normal em imagem continua copiando.
  img.onpointerdown({ button:0, ctrlKey:false, shiftKey:false, metaKey:false,
    clientX:75,clientY:125,stopPropagation(){},preventDefault(){} });
  img.onpointerup();
  for (let i = 0; i < 3; i++) await Promise.resolve();
  assert.deepEqual(copied, ['2026-11-13/a.png']);

  // RMB no modo padrão deve fazer pan; LMB no fundo não faz pan.
  root.onpointerdown({ button:2, pointerId:1, clientX:100,clientY:100, preventDefault(){} });
  root.onpointermove({ clientX:150,clientY:125 });
  root.onpointerup();
  assert.ok(world.style.transform.startsWith('translate(110px,85px)'));
  root.onpointerdown({ button:0, clientX:100,clientY:100 });
  assert.ok(world.style.transform.startsWith('translate(110px,85px)'));
  keydown({ key:'Home', target:root, preventDefault(){} });
  assert.ok(world.style.transform.startsWith('translate(60px,60px)'));

  // No modo Select, RMB CONTINUA fazendo pan e nunca inicia retângulo.
  elements['tool-select'].onclick();
  assert.equal(elements['tool-select'].attributes['aria-pressed'], 'true');
  root.onpointerdown({ button:2, pointerId:2, clientX:100, clientY:100,
    ctrlKey:false, shiftKey:false, preventDefault(){} });
  root.onpointermove({ clientX:140, clientY:130 });
  assert.ok(world.style.transform.startsWith('translate(100px,90px)'));
  assert.equal(elements['marquee-box'].hidden, true, 'RMB nunca inicia seleção');
  root.onpointerup();
  keydown({ key:'Home', target:root, preventDefault(){} });

  // Select usa SEMPRE LMB, inclusive iniciando o arraste sobre uma imagem.
  let imageStoppedPropagation = false;
  const pointerOnImage = { button:0, pointerId:3, clientX:75, clientY:125,
    target:img, ctrlKey:false, shiftKey:false, metaKey:false,
    preventDefault(){}, stopPropagation(){ imageStoppedPropagation = true; } };
  img.onpointerdown(pointerOnImage);
  assert.equal(imageStoppedPropagation, false, 'LMB em Select deve chegar ao canvas');
  root.onpointerdown(pointerOnImage);
  root.onpointermove({ clientX:365, clientY:229 });
  assert.equal(elements['marquee-box'].hidden, false);
  root.onpointerup();
  assert.equal(elements['marquee-box'].hidden, true);
  assert.equal(elements['selection-count'].textContent, '2 selecionadas');
  assert.equal(copied.length, 1, 'Marquee não pode copiar no clipboard');
  assert.ok(world.style.transform.startsWith('translate(60px,60px)'), 'Seleção não pode mover o canvas');

  // F cria frame nomeável, sem mover os PNGs nem as posições.
  keydown({ key:'f', target:root,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,
    repeat:false,preventDefault(){} });
  const overlay = world.children.find(child => child.className === 'named-frame');
  assert.ok(overlay, 'Frame visual deve ser adicionado ao mundo');
  assert.equal(persisted.length, 1);
  assert.deepEqual(persisted[0][0].ids, ['2026-11-13/a.png','2026-11-13/b.png']);
  const bar = overlay.children[0];
  const label = bar.children[0], input = bar.children[1], remove = bar.children[2];
  assert.equal(input.hidden, false);
  assert.equal(input.focused, true);
  input.value = '  Estudos de FX ';
  input.onkeydown({ key:'Enter',preventDefault(){},stopPropagation(){} });
  assert.equal(label.textContent, 'Estudos de FX');
  assert.equal(persisted.at(-1)[0].name, 'Estudos de FX');
  assert.equal(elements['selection-toolbar'].hidden, true);

  // Frame pode ser removido sem pedir exclusão dos PNGs.
  remove.onclick();
  assert.equal(persisted.at(-1).length, 0);
  assert.equal(world.children.filter(child => child.tagName === 'div' && child.className === 'frame').length, 1);
  assert.equal(copied.length, 1);

  // Clique LMB sem arraste em Select escolhe a imagem (sem copiar).
  const singleClick = { button:0, pointerId:4, clientX:80, clientY:135,
    target:img, ctrlKey:false, shiftKey:false, metaKey:false,
    preventDefault(){},stopPropagation(){} };
  img.onpointerdown(singleClick);
  root.onpointerdown(singleClick);
  root.onpointerup();
  assert.equal(elements['selection-count'].textContent, '1 selecionada');
  assert.equal(copied.length, 1);

  // S alterna Select para modo normal; RMB sempre navegou nos dois modos.
  keydown({ key:'s',target:root,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,
    repeat:false,preventDefault(){} });
  assert.equal(elements['tool-pan'].attributes['aria-pressed'],'true');
  console.log('ClipVault: RMB sempre Pan, Select LMB (inclusive sobre imagem), F frame e clipboard OK.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
