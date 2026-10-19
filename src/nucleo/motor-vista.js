// Resúmenes del motor de notas para las pantallas.
import { asistenciaDe, gruposDe, notaGrupo, notaTrabajo, unidadTrabajo } from './motor.js';
import { activos, listaDeGrupos } from './grupos.js';
import { redondear } from './util.js';

/** Tipos de evento que se evalúan por grupo con una rúbrica (prácticas) o con la evaluación integral (talleres). */
export const EVALUADOS_POR_GRUPO = ['practica', 'taller'];

/** ¿El evento tiene evaluación por grupo configurada? */
export function seEvaluaPorGrupo(evento) {
  return EVALUADOS_POR_GRUPO.includes(evento.tipo) && Boolean(evento.config);
}

/** ¿El evento es un trabajo en casa que se califica (con nota, configurado y que se hace en el curso)? */
export function seCalificaTrabajo(evento) {
  return evento.tipo === 'trabajo_casa' && evento.con_nota && Boolean(evento.config) && evento.estado === 'normal';
}

/**
 * Avance de la evaluación: { grupos, evaluados } de una práctica o taller, o del TC y del PLIC (con `nombre`, 'grupos'
 * o 'estudiantes'; en un TC solo cuentan las unidades por calificar). null si no aplica.
 */
export function avanceEvaluacion(ctx, evento) {
  if (seCalificaTrabajo(evento)) {
    const unidades = unidadesDelTrabajo(ctx, evento).filter((u) => u.porCalificar);
    return {
      grupos: unidades.length,
      evaluados: unidades.filter((u) => u.nota.completo).length,
      nombre: unidadTrabajo(ctx.cfg.actividades[evento.config]) === 'grupo' ? 'grupos' : 'estudiantes',
    };
  }
  if (evento.tipo === 'plic' && evento.estado === 'normal') {
    const est = activos(ctx.reg.estudiantes);
    return { grupos: est.length, evaluados: est.filter((e) => ctx.plic.has(e.id)).length, nombre: 'estudiantes' };
  }
  if (!seEvaluaPorGrupo(evento) || evento.estado !== 'normal') return null;
  const { grupos } = listaDeGrupos(gruposDe(ctx, evento), ctx.reg.estudiantes);
  return { grupos: grupos.length, evaluados: grupos.filter((g) => notaGrupo(ctx, evento, g.grupo).completo).length };
}

/**
 * Unidades que se califican en un TC, en orden: los grupos de la práctica (o sus estudiantes, si el TC es
 * individual). Cada una: { unidad, id, grupo, integrantes: [{ estudiante, asistencia }], porCalificar, nota }.
 * No hace falta calificar a quien faltó a la práctica (recibe 0): un grupo en el que faltaron todos queda fuera.
 */
export function unidadesDelTrabajo(ctx, evento) {
  const unidad = unidadTrabajo(ctx.cfg.actividades[evento.config]);
  const { grupos, sinGrupo } = listaDeGrupos(gruposDe(ctx, evento), ctx.reg.estudiantes);
  const conAsistencia = (e) => ({ estudiante: e, asistencia: asistenciaDe(ctx, evento, e.id) });
  if (unidad === 'grupo') {
    return grupos.map((g) => {
      const integrantes = g.integrantes.map(conAsistencia);
      return {
        unidad, id: g.grupo, grupo: g.grupo, integrantes,
        porCalificar: integrantes.some((i) => !i.asistencia.falta),
        nota: notaTrabajo(ctx, evento, g.grupo),
      };
    });
  }
  const individuales = [...grupos.flatMap((g) => g.integrantes.map((e) => [e, g.grupo])), ...sinGrupo.map((e) => [e, null])];
  return individuales.map(([e, grupo]) => {
    const i = conAsistencia(e);
    return { unidad, id: e.id, grupo, integrantes: [i], porCalificar: !i.asistencia.falta, nota: notaTrabajo(ctx, evento, e.id) };
  });
}

/** Siguiente unidad por calificar después de `actual` (da la vuelta al llegar al final), o null si no queda ninguna. */
export function siguientePorCalificar(unidades, actual) {
  const i = unidades.findIndex((u) => u.id === actual);
  const orden = [...unidades.slice(i + 1), ...unidades.slice(0, Math.max(i, 0))];
  return orden.find((u) => u.porCalificar && !u.nota.completo && u.id !== actual)?.id ?? null;
}

/** Puntos con hasta 2 decimales, como texto: 8.5 → «8.5», 10 → «10». */
export function textoPuntos(x) {
  return String(redondear(x, 2));
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
