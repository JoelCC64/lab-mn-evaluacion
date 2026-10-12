// Eliminar un grupo de un evento: qué integrantes tiene, qué se borraría con él y en qué otros eventos hay datos de ese
// grupo (los TC de la práctica y la retroalimentación del taller siguiente usan el mismo número). Funciones puras.
import { asistenciaDe, gruposDe } from './motor.js';
import { practicaAnterior } from './retro.js';

const FALTAS = ['no_vino', 'salio'];

/**
 * { integrantes: [{ estudiante, falta }], tcs, talleres, borra: { puntajes, etiquetas, revision, notas, feedback, trabajos,
 * retro } }. `tcs` son los TC de esta práctica y `talleres`, los talleres cuya práctica anterior es este evento.
 */
export function resumenEliminarGrupo(ctx, evento, grupo) {
  const grupos = gruposDe(ctx, evento);
  const integrantes = ctx.reg.estudiantes
    .filter((e) => grupos.get(e.id) === grupo)
    .map((estudiante) => ({ estudiante, falta: FALTAS.includes(asistenciaDe(ctx, evento, estudiante.id).estado) }))
    .sort((a, b) => a.estudiante.nombre.localeCompare(b.estudiante.nombre, 'es'));
  const tcs = ctx.eventos.filter((e) => e.tipo === 'trabajo_casa' && e.practica === evento.id).map((e) => e.id);
  const talleres = ctx.eventos.filter((e) => e.tipo === 'taller' && practicaAnterior(ctx, e)?.id === evento.id).map((e) => e.id);
  const con = [evento.id, ...tcs];
  const delGrupo = (f) => f.unidad === 'grupo' && String(f.unidad_id) === String(grupo);
  const reg = ctx.reg;
  return {
    integrantes, tcs, talleres,
    borra: {
      puntajes: reg.puntajes.filter((f) => f.evento === evento.id && f.grupo === grupo).length,
      etiquetas: reg.etiquetas.filter((f) => f.evento === evento.id && f.grupo === grupo).length,
      revision: reg.revisiones_grupo.some((f) => f.evento === evento.id && f.grupo === grupo),
      notas: reg.notas.filter((f) => con.includes(f.evento) && delGrupo(f)).length,
      feedback: (reg.feedback ?? []).filter((f) => con.includes(f.evento) && delGrupo(f)).length,
      trabajos: (reg.trabajos_casa ?? []).filter((f) => tcs.includes(f.evento) && delGrupo(f)).length,
      retro: (reg.retroalimentaciones ?? []).filter((f) => talleres.includes(f.evento) && f.grupo === grupo).length,
    },
  };
}

/** ¿Hay algo registrado en el grupo (evaluación, etiquetas, notas…)? Para pedir una confirmación más fuerte. */
export const tieneRegistros = (borra) => Boolean(borra.puntajes || borra.etiquetas || borra.revision || borra.notas || borra.feedback || borra.trabajos);
