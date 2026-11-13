'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(base, 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(base, 'renderer', 'index.html'), 'utf8');

// The Electron vault:// protocol uses a strict allowlist for app assets.
// A script declared by index.html but absent from the allowlist makes
// initialization fail before clipboard callbacks are registered.
const match = main.match(/if\s*\(host\s*===\s*'app'\s*&&\s*!(\[[^\]]+\])\.includes\(relative\)\)/);
assert.ok(match, 'A allowlist de vault://app precisa continuar explícita');
const allowed = [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
assert.equal(allowed.length, new Set(allowed).size, 'A allowlist não pode ter duplicatas');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(item => item[1]);
const stylesheets = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)]
  .map(item => item[1]);
assert.ok(scripts.length > 0);
for (const resource of ['index.html', ...scripts, ...stylesheets]) {
  assert.ok(/^[a-z][\w-]*\.(?:js|css|html)$/.test(resource), 'Asset deve ser local: ' + resource);
  assert.ok(fs.existsSync(path.join(base, 'renderer', resource)), 'Asset inexistente: ' + resource);
  assert.ok(allowed.includes(resource), 'vault://app bloqueia asset declarado no HTML: ' + resource);
}
assert.ok(scripts.includes('multi-select.js'), 'A seleção múltipla precisa carregar');
assert.ok(allowed.includes('multi-select.js'), 'Permita o script da seleção no protocolo');
assert.ok(!allowed.includes('storage-manager.js'), 'O módulo de armazenamento deve ficar fora do renderer');
assert.ok(!allowed.includes('main.js'), 'O processo principal não pode ser servido no renderer');
console.log('ClipVault: todos os scripts e estilos declarados no HTML estão autorizados em vault://app.');
