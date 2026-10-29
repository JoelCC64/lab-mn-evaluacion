// Pasa a nota fijada las notas escritas en las observaciones de los grupos (ver `src/nucleo/notas-observaciones.js`).
import { registrosDelCurso } from './consultas.js';
import { fijarNotaGrupo, guardarNotaProfesor } from './acciones.js';
import { generarEventos } from '../nucleo/calendario.js';
import { crearContexto } from '../nucleo/motor.js';
import { propuestasDeObservaciones } from '../nucleo/notas-observaciones.js';

/** Propuestas de todos los cursos: [{ curso, ...propuesta }]. */
export async function leerPropuestasDeObservaciones(db, cfg) {
  const todas = [];
  for (const curso of cfg.cursos) {
    const reg = await registrosDelCurso(db, curso.paralelo, cfg);
    const ctx = crearContexto(cfg, curso, generarEventos(cfg, curso, reg.cambios_evento), reg);
    for (const p of propuestasDeObservaciones(ctx)) todas.push({ ...p, curso: curso.paralelo });
  }
  return todas;
}

/**
 * Fija la nota de cada propuesta y quita el número de la observación (si solo era el número, la observación se borra; si
 * había más texto, queda ese texto). Devuelve cuántas aplicó.
 */
export async function aplicarPropuestasDeObservaciones(db, propuestas, ahora = undefined) {
  let n = 0;
  for (const p of propuestas) {
    if (p.invalida) continue;
    await fijarNotaGrupo(db, p.evento.id, p.grupos, p.grupo, p.valor, p.tope, ahora);
    await guardarNotaProfesor(db, p.evento.id, 'grupo', p.grupo, p.resto, ahora);
    n += 1;
  }
  return n;
}
