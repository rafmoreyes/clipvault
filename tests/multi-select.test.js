'use strict';
const assert = require('node:assert/strict');
const { orderedIds, rangeBetween, dragPositions } = require('../renderer/multi-select');

const days = new Map([
  ['2026-11-12', { day: '2026-11-12', items: [{ id: 'old1' }, { id: 'old2' }] }],
  ['2026-11-13', { day: '2026-11-13', items: [{ id: 'new1' }, { id: 'new2' }, { id: 'new3' }] }]
]);
const ids = orderedIds(days);
assert.deepEqual(ids, ['new1', 'new2', 'new3', 'old1', 'old2']);
assert.deepEqual(rangeBetween(ids, 'new2', 'old1'), ['new2', 'new3', 'old1']);
assert.deepEqual(rangeBetween(ids, 'old1', 'new2'), ['new2', 'new3', 'old1']);
assert.deepEqual(rangeBetween(ids, 'notfound', 'new3'), ['new3']);
assert.deepEqual(rangeBetween(ids, 'new1', 'notfound'), []);
assert.deepEqual(dragPositions([], 10, 20), []);
const group = [{ id: 'a', x: 24, y: 30 }, { id: 'b', x: 110, y: 130 }];
assert.deepEqual(dragPositions(group, 25, 8), [
  { id: 'a', x: 49, y: 38 }, { id: 'b', x: 135, y: 138 }
]);
assert.deepEqual(dragPositions(group, -40, -80), [
  { id: 'a', x: 0, y: 0 }, { id: 'b', x: 86, y: 100 }
]);
assert.deepEqual(group, [{ id: 'a', x: 24, y: 30 }, { id: 'b', x: 110, y: 130 }]);
assert.deepEqual(dragPositions(group, NaN, 10), []);
console.log('ClipVault 0.5: intervalos, ordem cronologica e deslocamento de grupo OK.');
