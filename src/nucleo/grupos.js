// Grupos de trabajo de cada evento (ver «Grupos de un evento» en docs/modelo-datos.md).
import { agruparPor, compararGrupos } from './util.js';

/** ¿Es un estudiante de otro docente que recupera en una sesión de este curso? (solo cuenta en ese evento) */
export const esVisitante = (e) => e?.estado === 'visitante';

/** Estudiantes del curso: los de la nómina y los pendientes (sin bajas ni visitantes de otros cursos). */
export const activos = (estudiantes) => estudiantes.filter((e) => e.estado !== 'baja' && !esVisitante(e));

/** Evento cuyos grupos y asistencia usa este evento (un TC usa los de su práctica). */
export function eventoBase(evento, eventos) {
  if (evento.tipo === 'trabajo_casa' && evento.practica) return eventos.find((e) => e.id === evento.practica) ?? evento;
  return evento;
}

/**
 * Grupos del evento: su instantánea; si no tiene, la del evento anterior más cercano; si no hay, los del Excel.
 * Devuelve { porEstudiante: Map(id → grupo | null), fuente: { tipo: 'propia' | 'anterior' | 'excel', evento } }.
 */
export function gruposDelEvento(evento, eventos, reg) {
  const base = eventoBase(evento, eventos);
  const instantaneas = agruparPor(reg.grupos_evento, 'evento');
  let filas = instantaneas.get(base.id);
  let fuente = filas ? { tipo: 'propia', evento: base.id } : null;
  if (!filas) {
    const i = eventos.findIndex((e) => e.id === base.id);
    for (let j = i - 1; j >= 0; j--) {
      const f = instantaneas.get(eventos[j].id);
      if (f) { filas = f; fuente = { tipo: 'anterior', evento: eventos[j].id }; break; }
    }
  }
  const deInstantanea = new Map((filas ?? []).map((f) => [f.estudiante, f.grupo ?? null]));
  const porEstudiante = new Map();
  for (const e of activos(reg.estudiantes)) {
    // Quien no está en la instantánea (por ejemplo, un estudiante nuevo) toma su grupo del Excel.
    porEstudiante.set(e.id, deInstantanea.has(e.id) ? deInstantanea.get(e.id) : (e.grupo_excel ?? null));
  }
  if (fuente?.tipo === 'propia') {
    // Quien estaba en el evento y después fue dado de baja sigue apareciendo en ese evento. Un visitante solo
    // aparece en el evento al que vino (no en el TC de esa práctica).
    const porId = new Map(reg.estudiantes.map((e) => [e.id, e]));
    for (const [id, g] of deInstantanea) {
      const e = porId.get(id);
      if (esVisitante(e) && e.visita?.evento !== evento.id) continue;
      if (!porEstudiante.has(id)) porEstudiante.set(id, g);
    }
  }
  return { porEstudiante, fuente: fuente ?? { tipo: 'excel', evento: null } };
}

/** { grupos: [{ grupo, integrantes }], sinGrupo } con grupos en orden numérico e integrantes por nombre. */
export function listaDeGrupos(porEstudiante, estudiantes) {
  const porId = new Map(estudiantes.map((e) => [e.id, e]));
  const grupos = new Map();
  const sinGrupo = [];
  for (const [id, g] of porEstudiante) {
    const e = porId.get(id);
    if (!e) continue;
    if (g === null || g === undefined) sinGrupo.push(e);
    else {
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(e);
    }
  }
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  return {
    grupos: [...grupos.entries()]
      .sort(([a], [b]) => compararGrupos(a, b))
      .map(([grupo, integrantes]) => ({ grupo, integrantes: integrantes.sort(porNombre) })),
    sinGrupo: sinGrupo.sort(porNombre),
  };
}

/** Siguiente número de grupo libre (para crear un grupo nuevo al mover a alguien). */
export function grupoNuevo(porEstudiante) {
  const usados = [...new Set([...porEstudiante.values()].filter((g) => g !== null))];
  const numeros = usados.map(Number).filter(Number.isFinite);
  return String(numeros.length ? Math.max(...numeros) + 1 : 1);
}
