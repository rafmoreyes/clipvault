'use strict';
const assert = require('node:assert/strict');
const { formatDay, matchesDay, filterDays } = require('../renderer/date-nav');

assert.equal(formatDay('2026-11-13'), '13 nov 2026');
assert.equal(formatDay('2026-03-01'), '01 mar 2026');
assert.equal(matchesDay('2026-11-13', '13/11/2026'), true);
assert.equal(matchesDay('2026-11-13', '13_11_2026'), true);
assert.equal(matchesDay('2026-11-13', '2026-11'), true);
assert.equal(matchesDay('2026-11-13', '13/11'), true);
assert.equal(matchesDay('2026-11-13', 'novembro'), true);
assert.equal(matchesDay('2026-11-13', 'NOV'), true);
assert.equal(matchesDay('2026-03-01', 'MARÇO'), true);
assert.equal(matchesDay('2026-11-13', 'dezembro'), false);
assert.equal(matchesDay('2026-11-13', ''), true);

const days = [
  { day: '2026-01-10', count: 1 },
  { day: '2026-11-13', count: 7 },
  { day: '2026-11-12', count: 3 },
  { day: '2025-11-13', count: 2 }
];
assert.deepEqual(filterDays(days, '').map(item => item.day),
  ['2026-11-13', '2026-11-12', '2026-01-10', '2025-11-13']);
assert.deepEqual(filterDays(days, 'nov 2026').map(item => item.day),
  ['2026-11-13', '2026-11-12']);
assert.deepEqual(filterDays(days, '2026-11-12').map(item => item.day), ['2026-11-12']);
assert.equal(filterDays(days, 'fevereiro').length, 0);
assert.equal(days[0].day, '2026-01-10'); // Não altera a ordem original.
console.log('ClipVault 0.4: filtros, formatos de data e ordenação aprovados.');
