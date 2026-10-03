// Valida toda la configuración y, si es válida, actualiza config/manifest.json.
// Uso: npm run config   (después de agregar o editar cualquier archivo de /config)

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  DIR_CONFIG, archivosDelManifiesto, construirManifiesto, crearValidador, esquemaParaArchivo,
  leerConfigDisco, validarSemantica,
} from './lib/config-disco.mjs';

const errores = [];
let manifiesto;
try {
  manifiesto = construirManifiesto();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const validar = crearValidador();
for (const ruta of archivosDelManifiesto(manifiesto)) {
  let datos;
  try {
    datos = JSON.parse(readFileSync(path.join(DIR_CONFIG, ruta), 'utf8'));
  } catch (e) {
    errores.push(`${ruta}: JSON inválido (${e.message})`);
    continue;
  }
  for (const e of validar(esquemaParaArchivo(ruta, manifiesto), datos)) errores.push(`${ruta}: ${e}`);
}

if (!errores.length) {
  const { cfg } = leerConfigDisco();
  errores.push(...validarSemantica(cfg));
}

if (errores.length) {
  console.error(`La configuración tiene ${errores.length} error(es):`);
  for (const e of errores) console.error(`  - ${e}`);
  process.exit(1);
}

const destino = path.join(DIR_CONFIG, 'manifest.json');
const nuevo = `${JSON.stringify(manifiesto, null, 2)}\n`;
const anterior = existsSync(destino) ? readFileSync(destino, 'utf8') : '';
if (nuevo !== anterior) writeFileSync(destino, nuevo);
console.log(`Configuración válida: ${archivosDelManifiesto(manifiesto).length} archivos · versión ${manifiesto.version}${nuevo !== anterior ? ' (manifiesto actualizado)' : ''}`);
