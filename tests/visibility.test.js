'use strict';
const assert = require('node:assert/strict');
const { worldViewport, intersects } = require('../renderer/visibility');

const screen = worldViewport({ x: 0, y: 0, k: 1 }, 1200, 800, 0);
assert.deepEqual(screen, { left: 0, top: 0, right: 1200, bottom: 800 });
assert.equal(intersects(screen, { left: 100, right: 320, top: 100, bottom: 300 }), true);
assert.equal(intersects(screen, { left: 3000, right: 3300, top: 0, bottom: 200 }), false);

const panned = worldViewport({ x: -1200, y: -800, k: 1 }, 1200, 800, 0);
assert.equal(panned.left, 1200);
assert.equal(panned.top, 800);
const zoomed = worldViewport({ x: 0, y: 0, k: 2 }, 1200, 800, 0);
assert.equal(zoomed.right, 600);
assert.equal(zoomed.bottom, 400);

// Simula 10.000 capturas em linhas de uma grade; o renderer só deve
// materializar as imagens que cruzam a viewport.
const bounds = worldViewport({ x: 60, y: 60, k: 0.5 }, 1400, 900);
let visible = 0;
for (let i = 0; i < 10000; i++) {
  const x = 24 + (i % 5) * 344;
  const y = 114 + Math.floor(i / 5) * 344;
  if (intersects(bounds, { left: x, right: x + 320, top: y, bottom: y + 320 })) visible++;
}
assert.ok(visible > 0 && visible < 100, 'Viewport deveria renderizar menos de 100 itens visíveis');
console.log('Viewport: pan, zoom e visibilidade de 10.000 itens OK (visíveis: ' + visible + ').');
