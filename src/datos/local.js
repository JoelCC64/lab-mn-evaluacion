// Datos de este dispositivo que NO viajan en el respaldo: la carpeta del Excel (Chrome en la Mac), el
// último respaldo importado y el registro de las escrituras en el Excel. Una base aparte por cada base de
// la app (la demostración tiene la suya), para que restaurar un respaldo no los borre.
import Dexie from '../vendor/dexie.js';

const bases = new Map();

export function baseLocal(nombreBase) {
  const nombre = `${nombreBase}-local`;
  if (!bases.has(nombre)) {
    const db = new Dexie(nombre);
    db.version(1).stores({ datos: 'clave', escrituras: '++id, fecha' });
    bases.set(nombre, db);
  }
  return bases.get(nombre);
}

export async function leerLocal(db, clave) {
  return (await baseLocal(db.name).datos.get(clave))?.valor ?? null;
}

export async function guardarLocal(db, clave, valor) {
  await baseLocal(db.name).datos.put({ clave, valor });
}

export async function borrarLocal(db, clave) {
  await baseLocal(db.name).datos.delete(clave);
}

// ---------- Ajustes del dispositivo ----------

const CLAVE_PROFESOR = 'profesor';

/**
 * Nombre del profesor, para la columna PROFESOR de las hojas de coordinación y la firma del texto para otros
 * profesores. Es un ajuste de cada dispositivo: no está en la configuración (el repositorio es público) ni viaja
 * en el respaldo. null si no se ha escrito.
 */
export async function leerProfesor(db) {
  const v = await leerLocal(db, CLAVE_PROFESOR);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Guarda el nombre del profesor (vacío = se borra). */
export async function guardarProfesor(db, nombre) {
  const limpio = String(nombre ?? '').replace(/\s+/g, ' ').trim();
  if (limpio.includes('@')) throw new Error('Escribe tu nombre, no un correo: la app no guarda correos.');
  if (limpio) await guardarLocal(db, CLAVE_PROFESOR, limpio);
  else await borrarLocal(db, CLAVE_PROFESOR);
}

/** Registro de una escritura en el Excel (solo conteos, sin datos de estudiantes). */
export async function registrarEscritura(db, resumen) {
  await baseLocal(db.name).escrituras.add({ fecha: new Date().toISOString(), ...resumen });
}

export async function ultimaEscritura(db) {
  return (await baseLocal(db.name).escrituras.orderBy('fecha').last()) ?? null;
}
