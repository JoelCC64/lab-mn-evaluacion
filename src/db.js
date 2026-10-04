// Base local (IndexedDB con Dexie). El modelo está documentado en docs/modelo-datos.md.
import Dexie from './vendor/dexie.js';
import { TABLAS_REGISTRO } from './nucleo/tablas.js';

export { Dexie };

/** Tablas y claves (la primera entrada es la clave primaria; las demás, índices). */
export const TABLAS = {
  estudiantes: 'id, curso, estado',
  grupos_evento: '[evento+estudiante], evento, estudiante',
  asistencia: '[evento+estudiante], evento, estudiante',
  pases: 'evento',
  revisiones_grupo: '[evento+grupo], evento',
  puntajes: '[evento+grupo+aspecto], evento, [evento+grupo]',
  etiquetas: '[evento+grupo+etiqueta], evento, [evento+grupo]',
  notas: '[evento+unidad+unidad_id], evento',
  controles: '[evento+estudiante], evento, estudiante',
  revision_preparatorio: 'evento',
  novedades_preparatorio: '[evento+estudiante], evento, estudiante',
  ajustes: '[evento+estudiante], evento, estudiante',
  retroalimentaciones: '[evento+grupo], evento',
  trabajos_casa: '[evento+unidad+unidad_id], evento',
  recuperaciones: '[evento+estudiante], evento, estudiante',
  plic: '[evento+estudiante], evento',
  cambios_evento: 'evento',
  importaciones: '++id, fecha',
  meta: 'clave',
};

/** Tablas cuyas filas pertenecen a un evento (clave o índice «evento» = «PARALELO:CÓDIGO»). */
export const TABLAS_DE_EVENTO = [...TABLAS_REGISTRO, 'cambios_evento'];

export function nombreBase(semestre, { demo = false } = {}) {
  return `lab-mn-${semestre}${demo ? '-demo' : ''}`;
}

/**
 * Versiones de la base. Una versión nueva solo agrega tablas o índices: Dexie actualiza la base del
 * dispositivo al abrirla, sin perder datos.
 * 1 (Fases 1–3) · 2 (Fase 4): retroalimentaciones · 3 (Fase 5): trabajos_casa · 4 (Fase 6): recuperaciones y plic.
 */
export const VERSION_BASE = 4;

/**
 * Abre la base. `alCambiar(tabla)` (opcional) se llama después de cada escritura que termina bien:
 * la interfaz lo usa para saber si hay registros sin respaldar.
 */
export function abrirBase(nombre, { alCambiar } = {}) {
  const db = new Dexie(nombre);
  db.version(VERSION_BASE).stores(TABLAS);
  if (alCambiar) {
    db.use({
      stack: 'dbcore',
      name: 'aviso-de-cambios',
      create: (abajo) => ({
        ...abajo,
        table: (tabla) => {
          const t = abajo.table(tabla);
          return { ...t, mutate: (req) => t.mutate(req).then((r) => { alCambiar(tabla); return r; }) };
        },
      }),
    });
  }
  return db;
}

/** Momento actual como texto ISO (inyectable en pruebas). */
export const ahoraISO = () => new Date().toISOString();
