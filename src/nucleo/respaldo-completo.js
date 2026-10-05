// Respaldo completo (Fase 9): un .zip con todo en JSON (para restaurar) y cada tabla en CSV (para abrirla en Excel,
// Sheets, Python o R), con la fecha en los nombres. También el recordatorio de respaldo. Funciones puras.
import { CLAVES } from './tablas.js';
import { tablaCsv } from './csv.js';
import { entradasZip, leerParteZip } from './zip.js';
import { diasEntre, hoyLocal } from './util.js';

/**
 * Archivos del respaldo completo, dentro de una carpeta `base` («respaldo-lab-mn-2026B-2026-10-04-1530»):
 * el JSON, csv/<tabla>-<sello>.csv por cada tabla y LEEME.txt. `respaldo`: el objeto de exportarRespaldo.
 */
export function archivosDelRespaldo(respaldo, { base, sello, demo = false }) {
  const tablas = Object.keys(respaldo.tablas).sort();
  return [
    { nombre: `${base}/LEEME.txt`, contenido: leeme(respaldo, { base, sello, demo, tablas }) },
    { nombre: `${base}/${base}.json`, contenido: JSON.stringify(respaldo) },
    ...tablas.map((t) => ({ nombre: `${base}/csv/${t}-${sello}.csv`, contenido: tablaCsv(respaldo.tablas[t], CLAVES[t] ?? []) })),
  ];
}

function leeme(respaldo, { base, sello, demo, tablas }) {
  const creado = new Date(respaldo.creado);
  const ancho = Math.max(...tablas.map((t) => t.length));
  return [
    `Respaldo completo de la app Lab MN · ${respaldo.semestre}${demo ? ' · DEMOSTRACIÓN (datos ficticios)' : ''}`,
    `Creado el ${hoyLocal(creado)} a las ${creado.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} · app ${respaldo.app} · configuración ${respaldo.config}`,
    '',
    'Tiene datos de estudiantes (códigos, nombres, asistencia y evaluaciones): guárdalo en un lugar seguro.',
    '',
    `${base}.json`,
    '  Todo lo registrado en la app. Para recuperarlo: Datos › «Restaurar un respaldo…» y elige el .zip o este .json.',
    '',
    `csv/<tabla>-${sello}.csv`,
    '  Una tabla por archivo, para abrirla en Excel, Google Sheets, Python o R.',
    '  - UTF-8 (con BOM), separador coma, punto decimal, una fila por registro.',
    '  - Las primeras columnas son la clave de la tabla. Las listas y los objetos van como JSON en su celda.',
    '  - Las notas no se guardan: la app las calcula. Están en el respaldo del día (Excel).',
    `  - En Python: pandas.read_csv('csv/asistencia-${sello}.csv', encoding='utf-8-sig')`,
    '  - En Excel: Datos › Desde texto/CSV, origen UTF-8 y delimitador coma.',
    '  La descripción de cada tabla está en docs/modelo-datos.md, en el repositorio de la app.',
    '',
    'Tablas (filas):',
    ...tablas.map((t) => `  ${t.padEnd(ancho)}  ${respaldo.tablas[t].length}`),
    '',
  ].join('\r\n');
}

/** Respaldo (objeto JSON) guardado en un .zip del respaldo completo. `inflar`: descompresión deflate sin cabecera. */
export async function respaldoDeZip(bytes, inflar) {
  let entradas;
  try {
    entradas = entradasZip(bytes);
  } catch {
    throw new Error('El archivo .zip está dañado o no es un zip.');
  }
  const json = entradas.filter((e) => /\.json$/i.test(e.nombre) && !e.nombre.split('/').some((p) => p.startsWith('.') || p === '__MACOSX'));
  if (json.length !== 1) throw new Error('Ese .zip no es un respaldo completo de la app (debe tener un solo .json).');
  try {
    return JSON.parse(await leerParteZip(bytes, json[0], inflar));
  } catch {
    throw new Error('El respaldo dentro del .zip está dañado.');
  }
}

/**
 * Recordatorio de respaldo: { pendiente, dias, vencido }.
 * - pendiente: hay registros posteriores al último respaldo de este dispositivo.
 * - dias: días de calendario desde el último respaldo o, si nunca hubo uno, desde el primer cambio sin respaldar.
 * - vencido: pendiente y pasaron más de `limite` días.
 */
export function recordatorioDeRespaldo({ ultimoRespaldo = null, ultimoCambio = null, primerCambio = null }, { limite, ahora = new Date() }) {
  const pendiente = Boolean(ultimoCambio && (!ultimoRespaldo || ultimoCambio > ultimoRespaldo));
  const referencia = ultimoRespaldo ?? primerCambio ?? ultimoCambio;
  const dias = referencia ? Math.max(0, diasEntre(hoyLocal(new Date(referencia)), hoyLocal(ahora))) : 0;
  return { pendiente, dias, vencido: pendiente && dias > limite };
}
