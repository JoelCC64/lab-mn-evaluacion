// Respaldo completo (todas las tablas) como objeto JSON: exportar, validar y restaurar. Viaja dentro del respaldo del día
// (Excel), del respaldo completo (.zip, con un CSV por tabla) o solo, como .json.
import { ahoraISO } from '../db.js';

export const FORMATO = 'lab-mn-respaldo';
export const VERSION = 1;

export async function exportarRespaldo(db, { semestre, app, config, ahora = ahoraISO() }) {
  const tablas = {};
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) tablas[t.name] = await t.toArray();
  });
  return { formato: FORMATO, version: VERSION, semestre, creado: ahora, app, config, tablas };
}

/** Fecha y hora local para los nombres de archivo: «2026-10-04-1530». */
export function selloDeFecha(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}-${p(fecha.getHours())}${p(fecha.getMinutes())}`;
}

export function nombreArchivoRespaldo(semestre, fecha = new Date(), extension = 'json') {
  return `respaldo-lab-mn-${semestre}-${selloDeFecha(fecha)}.${extension}`;
}

/** Errores que impiden restaurar (lista vacía si el archivo sirve). */
export function validarRespaldo(obj, db, { semestre }) {
  const errores = [];
  if (!obj || typeof obj !== 'object') return ['El archivo no es un respaldo de la app.'];
  if (obj.formato !== FORMATO) errores.push('El archivo no es un respaldo de la app (formato desconocido).');
  if (obj.version !== VERSION) errores.push(`Versión de respaldo ${obj.version} no compatible (se espera ${VERSION}).`);
  if (obj.semestre !== semestre) errores.push(`El respaldo es del semestre ${obj.semestre}; la app está en ${semestre}.`);
  if (!obj.tablas || typeof obj.tablas !== 'object') errores.push('El respaldo no tiene tablas.');
  else {
    const conocidas = new Set(db.tables.map((t) => t.name));
    for (const [nombre, filas] of Object.entries(obj.tablas)) {
      if (!conocidas.has(nombre)) errores.push(`Tabla desconocida en el respaldo: ${nombre}.`);
      else if (!Array.isArray(filas)) errores.push(`La tabla ${nombre} no es una lista.`);
    }
  }
  return errores;
}

/** Cuántas filas tiene cada tabla del respaldo (para mostrar antes de restaurar). */
export function contarRespaldo(obj) {
  return Object.fromEntries(Object.entries(obj.tablas ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
}

/** Reemplaza TODO lo de este dispositivo por el contenido del respaldo (en una sola transacción). */
export async function restaurarRespaldo(db, obj) {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
    for (const [nombre, filas] of Object.entries(obj.tablas)) {
      if (filas.length) await db.table(nombre).bulkPut(filas);
    }
  });
}

/** Borra todos los datos del dispositivo (solo con confirmación explícita en la interfaz). */
export async function borrarTodo(db) {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
