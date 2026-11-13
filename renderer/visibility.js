'use strict';
(function (root) {
  const OVERSCAN_PX = 360;

  function worldViewport(view, width, height, margin = OVERSCAN_PX) {
    const k = Math.max(0.01, view.k);
    const padding = margin / k;
    return {
      left: -view.x / k - padding,
      top: -view.y / k - padding,
      right: (width - view.x) / k + padding,
      bottom: (height - view.y) / k + padding
    };
  }

  function intersects(a, b) {
    return a.left <= b.right && a.right >= b.left &&
      a.top <= b.bottom && a.bottom >= b.top;
  }

  const api = { worldViewport, intersects, OVERSCAN_PX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClipVaultVisibility = api;
})(typeof window !== 'undefined' ? window : globalThis);
