// Paquete de eventos (Fase 9): pasa lo registrado en uno o varios eventos de un dispositivo a otro (por ejemplo, los TC
// calificados en la Mac, al iPhone). En el destino reemplaza esos eventos, previa confirmación; lo demás no se toca.
import { ahoraISO, TABLAS_DE_EVENTO } from '../db.js';
import { generarEventos } from '../nucleo/calendario.js';
import { cambiosQueSePerderian, compararEvento, eventoDelVisitante, registrosPorEvento, ultimoCambio } from '../nucleo/sincronia.js';
import { selloDeFecha } from './respaldo.js';

export const FORMATO_PAQUETE = 'lab-mn-paquete';
export const VERSION_PAQUETE = 1;

const TABLAS_PAQUETE = [...TABLAS_DE_EVENTO, 'estudiantes'];

/**
 * Lo registrado en los eventos `ids` (todos, con null): { tabla: filas }, con las tablas de evento y los visitantes de
 * esos eventos.
 */
export async function tablasDeEventos(db, ids = null) {
  const tablas = {};
  await db.transaction('r', TABLAS_PAQUETE, async () => {
    for (const t of TABLAS_DE_EVENTO) tablas[t] = await (ids ? db.table(t).where('evento').anyOf(ids) : db.table(t)).toArray();
    tablas.estudiantes = await db.estudiantes.where('estado').equals('visitante')
      .filter((e) => (ids ? ids.includes(eventoDelVisitante(e)) : Boolean(eventoDelVisitante(e)))).toArray();
  });
  return tablas;
}

/** Por evento con algo registrado: { registros, ultimo } (Map por id), para elegir qué enviar. */
export async function resumenPorEvento(db) {
  const m = new Map();
  for (const [evento, registros] of registrosPorEvento(await tablasDeEventos(db))) {
    m.set(evento, { registros: registros.length, ultimo: ultimoCambio(registros) });
  }
  return m;
}

/** Paquete con los eventos `ids` (solo las tablas que tienen algo). */
export async function exportarPaquete(db, ids, { semestre, app, config, demo = false, ahora = ahoraISO() }) {
  const eventos = [...new Set(ids)];
  if (!eventos.length) throw new Error('Elige al menos un evento.');
  const tablas = Object.fromEntries(Object.entries(await tablasDeEventos(db, eventos)).filter(([, f]) => f.length));
  return { formato: FORMATO_PAQUETE, version: VERSION_PAQUETE, semestre, demo: Boolean(demo), creado: ahora, app, config, eventos, tablas };
}

/** «eventos-lab-mn-2026B-GR7SA-TC1-2026-10-04-1530.json» o, con varios, «eventos-lab-mn-2026B-3-eventos-….json». */
export function nombreArchivoPaquete(semestre, eventos, fecha = new Date()) {
  const que = eventos.length === 1 ? eventos[0].replace(':', '-') : `${eventos.length}-eventos`;
  return `eventos-lab-mn-${semestre}-${que}-${selloDeFecha(fecha)}.json`;
}

/** Ids de los eventos que genera la configuración (no dependen de los cambios de calendario). */
export function idsDeEventos(cfg) {
  return new Set(cfg.cursos.flatMap((c) => generarEventos(cfg, c, []).map((e) => e.id)));
}

/** Estudiantes a los que se refiere el paquete (por id), sin contar a los visitantes que trae. */
function estudiantesDelPaquete(tablas) {
  const ids = new Set();
  for (const t of TABLAS_DE_EVENTO) {
    for (const f of tablas[t] ?? []) {
      if (f.estudiante !== undefined && f.estudiante !== null) ids.add(String(f.estudiante));
      if (f.unidad === 'estudiante') ids.add(String(f.unidad_id));
    }
  }
  for (const v of tablas.estudiantes ?? []) ids.delete(v.id);
  return [...ids];
}

/** Errores que impiden abrir el paquete en este dispositivo (lista vacía si sirve). */
export async function validarPaquete(obj, db, cfg, { demo = false } = {}) {
  if (!obj || typeof obj !== 'object' || obj.formato !== FORMATO_PAQUETE) return ['El archivo no es un paquete de eventos de la app.'];
  const errores = [];
  if (obj.version !== VERSION_PAQUETE) errores.push(`Versión de paquete ${obj.version} no compatible (se espera ${VERSION_PAQUETE}).`);
  if (obj.semestre !== cfg.semestre.semestre) errores.push(`El paquete es del semestre ${obj.semestre}; la app está en ${cfg.semestre.semestre}.`);
  if (Boolean(obj.demo) !== Boolean(demo)) {
    errores.push(obj.demo
      ? 'El paquete es de la demostración (datos ficticios): ábrelo en la demostración.'
      : 'El paquete tiene datos reales: no se abre en la demostración.');
  }
  if (!Array.isArray(obj.eventos) || !obj.eventos.length) errores.push('El paquete no tiene eventos.');
  if (!obj.tablas || typeof obj.tablas !== 'object') errores.push('El paquete no tiene tablas.');
  if (errores.length) return errores;

  const conocidos = idsDeEventos(cfg);
  const desconocidos = obj.eventos.filter((id) => !conocidos.has(id));
  if (desconocidos.length) errores.push(`Eventos que esta app no conoce: ${desconocidos.join(', ')}. ¿Está al día la app en los dos dispositivos?`);
  const eventos = new Set(obj.eventos);
  for (const [t, filas] of Object.entries(obj.tablas)) {
    if (!TABLAS_PAQUETE.includes(t)) { errores.push(`Tabla que no va en un paquete: ${t}.`); continue; }
    if (!Array.isArray(filas)) { errores.push(`La tabla ${t} no es una lista.`); continue; }
    const ajena = filas.find((f) => !eventos.has(t === 'estudiantes' ? eventoDelVisitante(f) : f?.evento));
    if (ajena) errores.push(t === 'estudiantes' ? 'El paquete trae estudiantes que no son visitantes de sus eventos.' : `La tabla ${t} trae registros de otro evento.`);
  }
  if (errores.length) return errores;

  const ids = estudiantesDelPaquete(obj.tablas);
  const aqui = new Set((await db.estudiantes.bulkGet(ids)).filter(Boolean).map((e) => e.id));
  const faltan = ids.filter((id) => !aqui.has(id));
  if (faltan.length) {
    errores.push(`${faltan.length === 1 ? 'Un estudiante del paquete no está' : `${faltan.length} estudiantes del paquete no están`} en este dispositivo `
      + `(${faltan.slice(0, 5).join(', ')}${faltan.length > 5 ? '…' : ''}). Lee aquí el Excel del semestre o restaura un respaldo reciente, y vuelve a abrir el paquete.`);
  }
  return errores;
}

/**
 * Por evento del paquete: lo que hay aquí y lo que trae, y cuántos cambios de aquí se perderían al reemplazarlo
 * (ver compararEvento). `desde`: cuándo se creó el último respaldo restaurado en este dispositivo, si lo hubo.
 */
export async function compararPaquete(db, obj, { desde = null } = {}) {
  const aqui = registrosPorEvento(await tablasDeEventos(db, obj.eventos));
  const llega = registrosPorEvento(obj.tablas);
  return obj.eventos.map((evento) => ({ evento, ...compararEvento(aqui.get(evento) ?? [], llega.get(evento) ?? [], { desde }) }));
}

/** Reemplaza los eventos del paquete por lo que trae (en una sola transacción). Lo demás no se toca. */
export async function aplicarPaquete(db, obj) {
  await db.transaction('rw', TABLAS_PAQUETE, async () => {
    for (const t of TABLAS_DE_EVENTO) await db.table(t).where('evento').anyOf(obj.eventos).delete();
    await db.estudiantes.where('estado').equals('visitante').filter((e) => obj.eventos.includes(eventoDelVisitante(e))).delete();
    for (const [t, filas] of Object.entries(obj.tablas)) {
      if (filas.length) await db.table(t).bulkPut(filas);
    }
  });
}

/**
 * Antes de restaurar un respaldo completo: eventos en los que este dispositivo tiene cambios que el respaldo no trae
 * (por ejemplo, TC calificados en la Mac que aún no pasaron al iPhone). [{ evento, perdidos, ultimoPerdido, … }].
 */
export async function cambiosQueSePierdenAlRestaurar(db, respaldo, { desde = null } = {}) {
  return cambiosQueSePerderian(await tablasDeEventos(db), respaldo.tablas ?? {}, { desde });
}
