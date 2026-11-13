'use strict';

// Pure helpers for selection, range ordering and group movement.
// No file access, network, browser APIs or Electron dependencies.
(function (root) {
  function orderedIds(days) {
    return [...days.values()]
      .sort((a, b) => b.day.localeCompare(a.day))
      .flatMap(day => day.items.map(item => item.id));
  }
  function rangeBetween(ids, anchor, target) {
    const left = ids.indexOf(anchor), right = ids.indexOf(target);
    if (right < 0) return [];
    if (left < 0) return [target];
    return ids.slice(Math.min(left, right), Math.max(left, right) + 1);
  }
  // Keep every item in its original daily frame, preserving relative spacing.
  // Clamp the same delta for the entire selection to avoid tearing groups apart.
  function dragPositions(entries, dx, dy) {
    if (!entries.length) return [];
    if (![dx, dy].every(Number.isFinite)) return [];
    const minX = Math.min(...entries.map(entry => entry.x));
    const minY = Math.min(...entries.map(entry => entry.y));
    const moveX = Math.max(-minX, Math.round(dx));
    const moveY = Math.max(-minY, Math.round(dy));
    return entries.map(entry => ({ id: entry.id,
      x: Math.round(entry.x + moveX), y: Math.round(entry.y + moveY) }));
  }
  function rectFromPoints(ax, ay, bx, by) {
    return { left: Math.min(ax, bx), top: Math.min(ay, by),
      right: Math.max(ax, bx), bottom: Math.max(ay, by) };
  }
  function hitsRectangle(entries, rect) {
    return entries.filter(entry =>
      entry.left <= rect.right && entry.right >= rect.left &&
      entry.top <= rect.bottom && entry.bottom >= rect.top
    ).map(entry => entry.id);
  }
  const api = { orderedIds, rangeBetween, dragPositions, rectFromPoints, hitsRectangle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClipVaultSelection = api;
})(typeof window !== 'undefined' ? window : globalThis);
