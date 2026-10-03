// Resúmenes del motor de notas para las pantallas.
import { gruposDe, notaGrupo } from './motor.js';
import { listaDeGrupos } from './grupos.js';

/** Avance de la evaluación por grupo de una práctica: { grupos, evaluados }, o null si no aplica. */
export function avanceEvaluacion(ctx, evento) {
  if (evento.tipo !== 'practica' || evento.estado !== 'normal' || !evento.config) return null;
  const { grupos } = listaDeGrupos(gruposDe(ctx, evento), ctx.reg.estudiantes);
  return { grupos: grupos.length, evaluados: grupos.filter((g) => notaGrupo(ctx, evento, g.grupo).completo).length };
}

/** Nota 0–1 como texto sobre 10 con hasta 2 decimales (redondeo usual): 0.575 → «5.75». */
export function sobreDiez(valor) {
  if (valor === null || valor === undefined) return '—';
  return String(Math.round(valor * 1000 + 1e-9) / 100);
}
