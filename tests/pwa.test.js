// La PWA está completa y al día: sw.js con todos los archivos, íconos y manifiesto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { generar } from '../scripts/precache.mjs';
import { RAIZ } from './ayudas.js';

const leer = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8');

test('sw.js y src/version.js están al día (si falla: npm run build)', () => {
  const { sw, versionJs } = generar();
  assert.equal(leer('sw.js'), sw);
  assert.equal(leer('src/version.js'), versionJs);
});

test('el service worker guarda todo lo necesario para trabajar sin conexión', () => {
  const { archivos } = generar();
  for (const imprescindible of ['index.html', 'manifest.webmanifest', 'src/app.js', 'src/estilos.css',
    'src/vendor/preact-htm.js', 'src/vendor/dexie.js', 'src/vendor/exceljs.min.js', 'config/manifest.json',
    'config/actividades/P1-TRAD.json', 'icons/apple-touch-icon.png']) {
    assert.ok(archivos.includes(imprescindible), imprescindible);
  }
  for (const f of archivos) assert.ok(existsSync(path.join(RAIZ, f)), f);
  // Cada módulo importado por la app está en la lista.
  const js = archivos.filter((f) => f.endsWith('.js'));
  for (const f of js) {
    for (const [, imp] of leer(f).matchAll(/from '(\.[^']+)'/g)) {
      const destino = path.posix.normalize(path.posix.join(path.posix.dirname(f), imp));
      assert.ok(archivos.includes(destino), `${f} importa ${destino}, que no está en sw.js`);
    }
  }
});

test('manifiesto e índice listos para instalar en el iPhone', () => {
  const m = JSON.parse(leer('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  for (const i of m.icons) assert.ok(existsSync(path.join(RAIZ, i.src)), i.src);
  const html = leer('index.html');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /<script type="module" src="src\/app.js">/);
  assert.match(html, /lang="es"/);
});
