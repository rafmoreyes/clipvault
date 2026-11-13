'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { worldViewport, intersects } = require('../renderer/visibility');
const dates = require('../renderer/date-nav');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.parent = null;
    this.style = {};
    this.attributes = {};
    this.hidden = false;
    this.value = '';
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      contains: name => classes.has(name)
    };
  }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text || ''; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener() {}
  setPointerCapture() {}
}

async function run() {
  const keys = ['root', 'world', 'state', 'copy-feedback',
    'days-toggle', 'days-panel', 'days-close', 'days-search',
    'days-list', 'days-results', 'days-summary', 'days-latest'];
  const elements = Object.fromEntries(keys.map(key => [key, new FakeElement()]));
  elements['days-panel'].hidden = true;
  const document = {
    getElementById: id => elements[id],
    createElement: tag => new FakeElement(tag)
  };
  let keydown, newItem, frame;
  const log = [];
  const vault = {
    load: async () => ({
      layout: {}, paused: false, items: [
        { id: '2026-11-13/first.png', w: 900, h: 600 },
        { id: '2026-11-13/second.png', w: 900, h: 600 },
        { id: '2026-11-12/old.png', w: 900, h: 600 }
      ]
    }),
    onNew: fn => { newItem = fn; },
    onPause() {},
    saveLayout: async () => {},
    del: async ids => { log.push(ids); },
    delDay: async () => {},
    copyImage: async () => {}
  };
  const script = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  vm.runInNewContext(script, {
    document, window: {
      ClipVaultVisibility: { worldViewport, intersects },
      ClipVaultDateNav: dates,
      innerWidth: 1400, innerHeight: 900,
      addEventListener() {}
    },
    vault,
    requestAnimationFrame: cb => { frame = cb; return 1; },
    addEventListener: (kind, cb) => { if (kind === 'keydown') keydown = cb; },
    setTimeout: () => 1,
    clearTimeout: () => {},
    console
  });
  await Promise.resolve();
  await Promise.resolve();
  if (frame) frame();

  const button = elements['days-toggle'];
  const panel = elements['days-panel'];
  const search = elements['days-search'];
  const list = elements['days-list'];
  assert.equal(panel.hidden, true);
  assert.equal(list.children.length, 0, 'Painel fechado não cria botões de navegação');
  button.onclick();
  assert.equal(panel.hidden, false);
  assert.equal(button.attributes['aria-expanded'], 'true');
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].children[0].textContent, '13 nov 2026');
  assert.equal(list.children[0].children[1].textContent, '2');

  search.value = '12/11/2026';
  search.oninput();
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[0].textContent, '12 nov 2026');
  list.children[0].onclick();
  assert.ok(elements.world.style.transform.startsWith('translate(310px,'));
  assert.ok(list.children[0].classList.contains('is-active'));

  search.value = 'sem resultado';
  search.oninput();
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].className, 'days-empty');

  elements['days-latest'].onclick();
  assert.equal(search.value, '');
  assert.equal(list.children.length, 2);
  assert.ok(elements.world.style.transform.startsWith('translate(310px,76px)'));

  newItem({ id: '2026-11-14/new.png', w: 120, h: 120 });
  assert.equal(list.children.length, 3);
  assert.equal(list.children[0].children[0].textContent, '14 nov 2026');

  elements['days-close'].onclick();
  assert.equal(panel.hidden, true);
  assert.equal(list.children.length, 3); // Botões anteriores não alteram o canvas.
  let prevented = false;
  keydown({ key: 'f', ctrlKey: true, altKey: false, shiftKey: false,
    target: elements.root, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(panel.hidden, false);
  assert.equal(search.selected, true);
  keydown({ key: 'Escape', ctrlKey: false, target: search, preventDefault() {} });
  assert.equal(panel.hidden, true);
  assert.equal(log.length, 0);
  console.log('ClipVault 0.4: painel, pesquisa, salto, novas capturas e atalhos OK.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
