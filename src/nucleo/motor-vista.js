// Resúmenes del motor de notas para las pantallas.
import { gruposDe, notaGrupo } from './motor.js';
import { listaDeGrupos } from './grupos.js';

/** Tipos de evento que se evalúan por grupo con una rúbrica (prácticas) o con la evaluación integral (talleres). */
export const EVALUADOS_POR_GRUPO = ['practica', 'taller'];

/** ¿El evento tiene evaluación por grupo configurada? */
export function seEvaluaPorGrupo(evento) {
  return EVALUADOS_POR_GRUPO.includes(evento.tipo) && Boolean(evento.config);
}

/** Avance de la evaluación por grupo de una práctica o taller: { grupos, evaluados }, o null si no aplica. */
export function avanceEvaluacion(ctx, evento) {
  if (!seEvaluaPorGrupo(evento) || evento.estado !== 'normal') return null;
  const { grupos } = listaDeGrupos(gruposDe(ctx, evento), ctx.reg.estudiantes);
  return { grupos: grupos.length, evaluados: grupos.filter((g) => notaGrupo(ctx, evento, g.grupo).completo).length };
}

/** Nota 0–1 como texto sobre 10 con hasta 2 decimales (redondeo usual): 0.575 → «5.75». */
export function sobreDiez(valor) {
  if (valor === null || valor === undefined) return '—';
  return String(Math.round(valor * 1000 + 1e-9) / 100);
}

/**
 * Nota del grupo como texto: en un taller, el nivel de la evaluación integral («1/2»); en una práctica, sobre 10.
 */
export function textoNotaGrupo(nota) {
  if (nota.partes?.length === 1 && nota.partes[0].id === 'integral' && !nota.penalizacion) {
    const p = nota.partes[0];
    return `${p.valor}/${p.max}`;
  }
  return `${sobreDiez(nota.valor)}/10`;
}
