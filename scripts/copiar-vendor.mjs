// Copia a src/vendor las versiones para navegador de las librerías (la app no tiene paso de compilación).
// Uso: npm run vendor   (después de actualizar una dependencia en package.json)

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './lib/config-disco.mjs';

const nm = (...p) => path.join(RAIZ, 'node_modules', ...p);
const destino = path.join(RAIZ, 'src', 'vendor');
const licencias = path.join(destino, 'LICENCIAS');
mkdirSync(licencias, { recursive: true });

const version = (pkg) => JSON.parse(readFileSync(nm(pkg, 'package.json'), 'utf8')).version;

const archivos = [
  // Preact 10 + hooks + htm como módulos ES (los hooks importan «preact»: se reescribe a la ruta local).
  { de: nm('preact', 'dist', 'preact.module.js'), a: 'preact.js', pkg: 'preact' },
  { de: nm('preact', 'hooks', 'dist', 'hooks.module.js'), a: 'preact-hooks.js', pkg: 'preact', reemplazos: [['from"preact"', 'from"./preact.js"']] },
  { de: nm('htm', 'dist', 'htm.module.js'), a: 'htm.js', pkg: 'htm' },
  { de: nm('dexie', 'dist', 'dexie.mjs'), a: 'dexie.js', pkg: 'dexie' },
  // ExcelJS se carga como script clásico (global ExcelJS) solo al leer o escribir un Excel.
  { de: nm('exceljs', 'dist', 'exceljs.min.js'), a: 'exceljs.min.js', pkg: 'exceljs' },
];

for (const f of archivos) {
  let texto = readFileSync(f.de, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*\s*$/, '\n');
  for (const [de, a] of f.reemplazos ?? []) {
    if (!texto.includes(de)) throw new Error(`${f.a}: no se encontró «${de}»`);
    texto = texto.split(de).join(a);
  }
  writeFileSync(path.join(destino, f.a), texto);
}
for (const pkg of ['preact', 'htm', 'dexie', 'exceljs']) copyFileSync(nm(pkg, 'LICENSE'), path.join(licencias, `${pkg}.txt`));

// Punto de entrada único para la interfaz: Preact, sus hooks y `html` (htm).
writeFileSync(path.join(destino, 'preact-htm.js'), `// Preact + hooks + htm (generado por scripts/copiar-vendor.mjs; no editar a mano).
import { h, render, createContext, Component, Fragment } from './preact.js';
import {
  useState, useReducer, useEffect, useLayoutEffect, useRef, useImperativeHandle, useMemo, useCallback, useContext,
  useDebugValue, useErrorBoundary,
} from './preact-hooks.js';
import htm from './htm.js';

export const html = htm.bind(h);
export {
  h, render, createContext, Component, Fragment, useState, useReducer, useEffect, useLayoutEffect, useRef,
  useImperativeHandle, useMemo, useCallback, useContext, useDebugValue, useErrorBoundary,
};
`);

const lista = archivos.map((f) => `- ${f.a}: ${f.pkg} ${version(f.pkg)}`).join('\n');
writeFileSync(path.join(destino, 'VERSIONES.md'),
  `# Librerías incluidas (copiadas por scripts/copiar-vendor.mjs; no editar a mano)\n\n${lista}\n- preact-htm.js: punto de entrada (Preact + hooks + htm).\n\nLicencias en LICENCIAS/.\n`);
console.log(`Copiadas a src/vendor:\n${lista}`);
