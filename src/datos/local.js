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

/** Registro de una escritura en el Excel (solo conteos, sin datos de estudiantes). */
export async function registrarEscritura(db, resumen) {
  await baseLocal(db.name).escrituras.add({ fecha: new Date().toISOString(), ...resumen });
}

export async function ultimaEscritura(db) {
  return (await baseLocal(db.name).escrituras.orderBy('fecha').last()) ?? null;
}
