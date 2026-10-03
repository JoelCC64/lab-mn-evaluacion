// Genera sw.js (lista de archivos de la app + versión) y src/version.js.
// Uso: npm run build   (antes de publicar o de commitear cambios en la app)

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './lib/config-disco.mjs';

const r = (...p) => path.join(RAIZ, ...p);

function recorrer(dir, filtro) {
  const salida = [];
  for (const nombre of readdirSync(r(dir)).sort()) {
    const rel = `${dir}/${nombre}`;
    if (statSync(r(rel)).isDirectory()) salida.push(...recorrer(rel, filtro));
    else if (filtro(rel)) salida.push(rel);
  }
  return salida;
}

/** Archivos que la app necesita sin conexión (rutas relativas a la raíz). */
export function archivosDeLaApp() {
  return [
    'index.html',
    'manifest.webmanifest',
    ...recorrer('icons', (f) => f.endsWith('.png')),
    ...recorrer('src', (f) => /\.(js|css)$/.test(f) && !f.includes('/LICENCIAS/')),
    ...recorrer('config', (f) => f.endsWith('.json') && !f.startsWith('config/schemas/')),
    ...recorrer('datos-ejemplo', (f) => f.endsWith('.xlsx')),
  ];
}

export function versionDeLaApp() {
  return JSON.parse(readFileSync(r('package.json'), 'utf8')).version;
}

/** Contenido esperado de src/version.js y de sw.js. */
export function generar() {
  const versionJs = `// Versión de la app (la escribe scripts/precache.mjs desde package.json).\nexport const VERSION_APP = '${versionDeLaApp()}';\n`;
  const archivos = archivosDeLaApp();
  const h = createHash('sha256');
  for (const f of archivos) {
    h.update(f);
    h.update(f === 'src/version.js' ? versionJs : readFileSync(r(f)));
  }
  const version = `${versionDeLaApp()}-${h.digest('hex').slice(0, 10)}`;
  const lista = JSON.stringify(['./', ...archivos], null, 2);
  const sw = readFileSync(r('scripts', 'sw-plantilla.js'), 'utf8')
    .replace('__VERSION__', version)
    .replace('__ARCHIVOS__', lista);
  return { versionJs, sw, version, archivos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { versionJs, sw, version, archivos } = generar();
  const escribir = (rel, texto) => {
    if (!existsSync(r(rel)) || readFileSync(r(rel), 'utf8') !== texto) writeFileSync(r(rel), texto);
  };
  escribir('src/version.js', versionJs);
  escribir('sw.js', sw);
  console.log(`sw.js: ${archivos.length + 1} archivos · versión ${version}`);
}
