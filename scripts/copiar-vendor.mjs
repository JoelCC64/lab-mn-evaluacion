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
  // Preact 10 + hooks + htm en un solo módulo ES (sin import maps).
  { de: nm('htm', 'preact', 'standalone.module.js'), a: 'preact-htm.js', pkg: 'htm' },
  { de: nm('dexie', 'dist', 'dexie.mjs'), a: 'dexie.js', pkg: 'dexie' },
  // ExcelJS se carga como script clásico (global ExcelJS) solo al leer o escribir un Excel.
  { de: nm('exceljs', 'dist', 'exceljs.min.js'), a: 'exceljs.min.js', pkg: 'exceljs' },
];

for (const f of archivos) copyFileSync(f.de, path.join(destino, f.a));
for (const pkg of ['htm', 'dexie', 'exceljs']) copyFileSync(nm(pkg, 'LICENSE'), path.join(licencias, `${pkg}.txt`));

writeFileSync(path.join(licencias, 'preact.txt'), `The MIT License (MIT)

Copyright (c) 2015-present Jason Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);

const lista = archivos.map((f) => `- ${f.a}: ${f.pkg} ${version(f.pkg)}`).join('\n');
writeFileSync(path.join(destino, 'VERSIONES.md'),
  `# Librerías incluidas (copiadas por scripts/copiar-vendor.mjs; no editar a mano)\n\n${lista}\n- preact-htm.js incluye Preact 10 (MIT) dentro del paquete htm.\n\nLicencias en LICENCIAS/.\n`);
console.log(`Copiadas a src/vendor:\n${lista}`);
