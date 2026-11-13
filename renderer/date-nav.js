'use strict';

// Formatação e busca por datas sem dependências ou acesso a arquivos.
// Também é usado pelos testes Node.
(function (root) {
  const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const SHORT = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'
  ];
  const normalize = value => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');

  function dateParts(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const [year, month, date] = day.split('-');
    const index = Number(month) - 1;
    if (index < 0 || index >= 12 || Number(date) < 1 || Number(date) > 31) return null;
    return { year, month, date, index };
  }

  function formatDay(day) {
    const p = dateParts(day);
    if (!p) return day;
    return p.date + ' ' + SHORT[p.index] + ' ' + p.year;
  }

  function matchesDay(day, query) {
    const q = normalize(query).replace(/[_.,-]/g, '/');
    if (!q) return true;
    const p = dateParts(day);
    if (!p) return false;
    const normalizedForms = [
      day, p.date + '/' + p.month + '/' + p.year,
      p.date + '/' + p.month,
      p.month + '/' + p.year,
      p.year + '/' + p.month,
      p.date + ' ' + SHORT[p.index] + ' ' + p.year,
      p.date + ' ' + MONTHS[p.index] + ' ' + p.year,
      SHORT[p.index] + ' ' + p.year,
      MONTHS[p.index] + ' ' + p.year,
      MONTHS[p.index], SHORT[p.index], p.year
    ].map(x => normalize(x).replace(/[_.,-]/g, '/'));
    return normalizedForms.some(value => value.includes(q));
  }

  function filterDays(items, query) {
    return [...items]
      .filter(item => item && dateParts(item.day) && Number.isFinite(item.count))
      .sort((a, b) => b.day.localeCompare(a.day))
      .filter(item => matchesDay(item.day, query));
  }

  const api = { formatDay, matchesDay, filterDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClipVaultDateNav = api;
})(typeof window !== 'undefined' ? window : globalThis);
