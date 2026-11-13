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
    'marquee-box'];
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

  const first = img;
  const second = world.children[0].children.find(child =>
    child.tagName === 'img' && child.getAttribute('data-clipvault-id') === '2026-11-13/b.png');
  assert.ok(second, 'Segunda captura deve estar presente');
  assert.equal(elements['tool-pan'], undefined);
  assert.equal(elements['tool-select'], undefined);

  const onImage = (target, x = 75, y = 125, ctrlKey = false, shiftKey = false) => ({
    button: 0, pointerId: 4, target, clientX: x, clientY: y,
    ctrlKey, shiftKey, metaKey: false, preventDefault(){}, stopPropagation(){}
  });
  const onBackground = (button, x, y) => ({
    button, pointerId: 2, target: root, clientX: x, clientY: y,
    ctrlKey: false, shiftKey: false, metaKey: false, preventDefault(){}
  });

  // LMB na imagem: seleciona. Não copia automaticamente.
  img.onpointerdown(onImage(img));
  assert.equal(first.classList.contains('sel'), true);
  img.onpointerup();
  assert.deepEqual(copied, []);
  // Ctrl+C ainda copia explicitamente a imagem selecionada.
  keydown({ key:'c', ctrlKey:true, altKey:false, shiftKey:false, target:root,
    preventDefault(){}, repeat:false });
  for (let i = 0; i < 4; i++) await Promise.resolve();
  assert.deepEqual(copied, ['2026-11-13/a.png']);

  // LMB arrastado sobre imagem selecionada move a imagem, não o canvas.
  const initialX = Number.parseInt(img.style.left, 10);
  img.onpointerdown(onImage(img));
  img.onpointermove({ clientX: 95, clientY: 145 });
  img.onpointerup();
  assert.ok(Number.parseInt(img.style.left, 10) > initialX);
  assert.equal(first.classList.contains('sel'), true);

  // Clique simples no fundo desfaz a seleção.
  root.onpointerdown(onBackground(0, 900, 450));
  root.onpointerup();
  assert.equal(first.classList.contains('sel'), false);
  assert.equal(elements['selection-toolbar'].hidden, true);
  const transform = world.style.transform;
  assert.equal(transform.includes('translate(60px,60px)'), true,
    'LMB no fundo não pode mover a câmera');

  // RMB SEMPRE faz Pan, sem alternância de ferramenta.
  root.onpointerdown(onBackground(2, 100, 100));
  root.onpointermove({ clientX: 150, clientY: 125 });
  root.onpointerup();
  assert.ok(world.style.transform.startsWith('translate(110px,85px)'));
  keydown({ key:'Home', target:root, preventDefault(){} });
  assert.ok(world.style.transform.startsWith('translate(60px,60px)'));

  // LMB ARRASTADO NO FUNDO abre seleção de área sem qualquer botão/atalho.
  // Coordenadas cobrem as imagens a+b, mas não a imagem c.
  root.onpointerdown(onBackground(0, 60, 105));
  root.onpointermove({ clientX: 365, clientY: 229 });
  assert.equal(elements['marquee-box'].hidden, false);
  root.onpointerup();
  assert.equal(elements['marquee-box'].hidden, true);
  assert.equal(elements['selection-count'].textContent, '2 selecionadas');
  assert.equal(first.classList.contains('sel'), true);
  assert.equal(second.classList.contains('sel'), true);
  assert.equal(copied.length, 1, 'Selecionar área não deve copiar imagem');

  // Clicar novamente numa imagem selecionada preserva a seleção inteira.
  img.onpointerdown(onImage(img));
  img.onpointerup();
  assert.equal(elements['selection-count'].textContent, '2 selecionadas');

  // Arrastar qualquer imagem selecionada move o grupo, preservando spacing.
  const aBefore = Number.parseInt(first.style.left, 10);
  const bBefore = Number.parseInt(second.style.left, 10);
  img.onpointerdown(onImage(img));
  img.onpointermove({ clientX: 110, clientY: 145 });
  img.onpointerup();
  const aAfter = Number.parseInt(first.style.left, 10);
  const bAfter = Number.parseInt(second.style.left, 10);
  assert.equal(elements['selection-count'].textContent, '2 selecionadas');
  assert.ok(aAfter > aBefore && bAfter > bBefore);
  assert.equal(aAfter - aBefore, bAfter - bBefore,
    'O grupo precisa manter o espaçamento');
  assert.equal(copied.length, 1);

  // F cria um frame visual nomeável para ambas as imagens selecionadas.
  keydown({ key:'f', target:root,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,
    repeat:false,preventDefault(){} });
  const overlay = world.children.find(child => child.className === 'named-frame');
  assert.ok(overlay);
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

  // Remover o frame NÃO remove os arquivos nem as imagens do canvas.
  remove.onclick();
  assert.equal(persisted.at(-1).length, 0);
  assert.ok(world.children[0].children.includes(first));
  assert.ok(world.children[0].children.includes(second));
  assert.equal(copied.length, 1);
  assert.equal(elements['marquee-box'].hidden, true);

  console.log('ClipVault: LMB seleciona, arrasta imagem/grupo, seleciona área; RMB Pan e F frame OK.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
