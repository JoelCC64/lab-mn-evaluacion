// Comparar lo registrado en un evento en dos dispositivos (paquete de eventos o respaldo completo). Funciones puras.
// Los registros de un evento son sus filas en las tablas de evento y sus visitantes (Fase 6), como { tabla, fila }.
import { CLAVES, TABLAS_DE_EVENTO } from './tablas.js';

/** Momento del último cambio de una fila (ISO) o null. Los pases guardan cuándo se cerraron o reabrieron; los visitantes, «actualizado». */
export function momento(fila) {
  let m = null;
  for (const x of [fila?.fecha, fila?.cerrado_en, fila?.reabierto_en, fila?.actualizado]) {
    if (typeof x === 'string' && (!m || x > m)) m = x;
  }
  return m;
}

/** El momento más reciente de una lista de registros, o null. */
export function ultimoCambio(registros) {
  let u = null;
  for (const r of registros) {
    const m = momento(r.fila);
    if (m && (!u || m > u)) u = m;
  }
  return u;
}

export const claveDeFila = (tabla, fila) => JSON.stringify((CLAVES[tabla] ?? []).map((c) => fila[c] ?? null));

/** Texto de un valor con las claves ordenadas y sin campos undefined: dos filas iguales dan el mismo texto. */
export function textoEstable(x) {
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? 'null' : textoEstable(v))).join(',')}]`;
  if (x && typeof x === 'object') {
    return `{${Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${textoEstable(x[k])}`).join(',')}}`;
  }
  return JSON.stringify(x ?? null);
}

/** Evento al que pertenece un visitante (estudiante de otro docente que recupera en una sesión), o null. */
export const eventoDelVisitante = (fila) => (fila?.estado === 'visitante' && fila.visita?.evento) || null;

/** Registros agrupados por evento: Map(evento → [{ tabla, fila }]). `tablas`: { tabla: filas }, como en un respaldo. */
export function registrosPorEvento(tablas) {
  const m = new Map();
  const agregar = (evento, tabla, fila) => {
    if (!m.has(evento)) m.set(evento, []);
    m.get(evento).push({ tabla, fila });
  };
  for (const t of TABLAS_DE_EVENTO) for (const f of tablas[t] ?? []) agregar(f.evento, t, f);
  for (const f of tablas.estudiantes ?? []) {
    const ev = eventoDelVisitante(f);
    if (ev) agregar(ev, 'estudiantes', f);
  }
  return m;
}

/**
 * Compara lo que hay aquí de un evento con lo que llega (paquete o respaldo) y cuenta lo que se perdería al reemplazarlo:
 * - una fila que llega con la misma clave, pero distinta y más antigua que la de aquí;
 * - una fila de aquí que no llega y se guardó después de `desde` (cuándo se creó el último respaldo restaurado en este
 *   dispositivo: lo posterior se registró aquí) o, si no se sabe, después de lo último que llega de ese evento.
 * Es una estimación: la app no guarda lo que se borró ni en qué dispositivo se registró cada fila.
 */
export function compararEvento(aqui, llega, { desde = null } = {}) {
  const k = (r) => `${r.tabla}|${claveDeFila(r.tabla, r.fila)}`;
  const entrantes = new Map(llega.map((r) => [k(r), r]));
  const ultimoLlega = ultimoCambio(llega);
  const corte = desde ?? ultimoLlega;
  let iguales = 0;
  const perdidos = [];
  for (const r of aqui) {
    const otro = entrantes.get(k(r));
    if (otro && textoEstable(otro.fila) === textoEstable(r.fila)) { iguales += 1; continue; }
    const m = momento(r.fila);
    if (!m) continue;
    if (otro ? (momento(otro.fila) ?? '') < m : !corte || m > corte) perdidos.push(r);
  }
  return {
    aqui: aqui.length,
    llega: llega.length,
    ultimoAqui: ultimoCambio(aqui),
    ultimoLlega,
    igual: iguales === aqui.length && aqui.length === llega.length,
    perdidos: perdidos.length,
    ultimoPerdido: ultimoCambio(perdidos),
  };
}

/**
 * Eventos en los que reemplazar lo de aquí (`tablasAqui`) por lo que llega (`tablasLlega`) perdería cambios:
 * [{ evento, ...compararEvento }]. Sin `eventos`, revisa todos los que tienen algo aquí (restaurar un respaldo).
 */
export function cambiosQueSePerderian(tablasAqui, tablasLlega, { desde = null, eventos = null } = {}) {
  const aqui = registrosPorEvento(tablasAqui);
  const llega = registrosPorEvento(tablasLlega);
  return (eventos ?? [...aqui.keys()])
    .map((evento) => ({ evento, ...compararEvento(aqui.get(evento) ?? [], llega.get(evento) ?? [], { desde }) }))
    .filter((c) => c.perdidos > 0);
}
