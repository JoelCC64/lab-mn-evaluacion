// Retroalimentación de la práctica anterior al inicio del taller (Fase 4): lo que la app registró en esa
// práctica, grupo por grupo (integrantes, rúbrica, etiquetas, nota del profesor y control oral).
// Funciones puras sobre el contexto del motor.
import { asistenciaDe, gruposDe, notaControl, notaGrupo } from './motor.js';
import { listaDeGrupos } from './grupos.js';

/** Última práctica del curso anterior al taller que sí se hizo (no feriado ni sin clase), o null. */
export function practicaAnterior(ctx, taller) {
  const i = ctx.eventos.findIndex((e) => e.id === taller.id);
  for (let j = i - 1; j >= 0; j--) {
    const e = ctx.eventos[j];
    if (e.tipo === 'practica' && e.estado === 'normal') return e;
  }
  return null;
}

/**
 * Datos para la retroalimentación: { practica, config, grupos: [{ grupo, integrantes, nota, etiquetas,
 * notaProfesor, revision, dada }] }. `practica` es null si el taller no tiene una práctica antes.
 */
export function retroDelTaller(ctx, taller) {
  const practica = practicaAnterior(ctx, taller);
  if (!practica) return { practica: null, config: null, grupos: [] };
  const config = practica.config ? ctx.cfg.actividades[practica.config] : null;
  const { grupos } = listaDeGrupos(gruposDe(ctx, practica), ctx.reg.estudiantes);
  const dadas = new Set((ctx.reg.retroalimentaciones ?? []).filter((r) => r.evento === taller.id && r.dada).map((r) => r.grupo));
  return {
    practica,
    config,
    grupos: grupos.map(({ grupo, integrantes }) => {
      const marcadas = new Set(ctx.reg.etiquetas.filter((t) => t.evento === practica.id && t.grupo === grupo).map((t) => t.etiqueta));
      return {
        grupo,
        integrantes: integrantes.map((e) => ({
          estudiante: e,
          asistencia: asistenciaDe(ctx, practica, e.id),
          control: notaControl(ctx, practica, e.id),
        })),
        nota: notaGrupo(ctx, practica, grupo),
        etiquetas: (config?.etiquetas ?? []).filter((t) => marcadas.has(t.id)),
        notaProfesor: ctx.reg.notas.find((n) => n.evento === practica.id && n.unidad === 'grupo' && n.unidad_id === grupo)?.texto ?? null,
        revision: ctx.revisiones.get(`${practica.id}|${grupo}`) ?? null,
        dada: dadas.has(grupo),
      };
    }),
  };
}
