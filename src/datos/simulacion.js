// Clases ficticias para la demostración (Fase 8): llena la base de demostración con varias semanas de clase
// (asistencia, preparatorio, control oral, rúbricas, etiquetas y TC) para probar las métricas sin datos reales.
// Solo trabaja en la base de demostración y solo en eventos sin nada registrado: no toca lo registrado a mano.
// Usa un generador con semilla: la misma semilla da siempre las mismas clases.

import { ahoraISO } from '../db.js';
import { registrosDelCurso } from './consultas.js';
import { generarEventos } from '../nucleo/calendario.js';
import { activos, gruposDelEvento, listaDeGrupos } from '../nucleo/grupos.js';
import { crearContexto, rubrica } from '../nucleo/motor.js';
import { unidadesDelTrabajo } from '../nucleo/motor-vista.js';
import { aleatorioConSemilla, candidatosSorteo, sortear } from '../nucleo/sorteo.js';
import { controlCalifica, preparatorioCalifica } from '../nucleo/config.js';
import { TABLAS_REGISTRO } from '../nucleo/tablas.js';

/** Notas del profesor de ejemplo (genéricas, sin nombres). */
const NOTAS_FICTICIAS = [
  'Buen trabajo en equipo; todos participaron.',
  'Revisar las unidades en la tabla de datos.',
  'Les faltó tiempo para el análisis.',
  'Discusión ordenada; justificaron sus decisiones.',
];

const limitar = (x) => Math.min(1, Math.max(0, x));

/** Nivel de una escala según una habilidad 0–1 con algo de ruido (la escala se recorre de menor a mayor). */
function nivel(escala, habilidad, azar) {
  const orden = [...escala].sort((a, b) => a - b);
  const x = limitar(habilidad + (azar() - 0.5) * 0.35);
  return orden[Math.min(orden.length - 1, Math.floor(x * orden.length))];
}

/**
 * Simula las clases de todos los cursos con estudiantes hasta la semana `hastaSemana` (inclusive).
 * Devuelve { cursos, eventos } con lo simulado. `soloDemo: false` solo en las pruebas.
 */
export async function simularClases(db, cfg, { hastaSemana = 9, semilla = 2026, ahora = ahoraISO(), soloDemo = true } = {}) {
  if (soloDemo && !db.name.endsWith('-demo')) throw new Error('Las clases ficticias solo se pueden simular en la demostración.');
  const azar = aleatorioConSemilla(semilla);
  const resumen = { cursos: 0, eventos: 0 };
  for (const curso of cfg.cursos) {
    const reg = await registrosDelCurso(db, curso.paralelo);
    if (!activos(reg.estudiantes).length) continue;
    const { filas, eventos } = simularCurso(cfg, curso, reg, { hastaSemana, azar, ahora });
    if (!eventos) continue;
    const tablas = TABLAS_REGISTRO.filter((t) => filas[t].length);
    await db.transaction('rw', tablas.map((t) => db.table(t)), async () => {
      for (const t of tablas) await db.table(t).bulkPut(filas[t]);
    });
    resumen.cursos += 1;
    resumen.eventos += eventos;
  }
  return resumen;
}

/** Filas nuevas de un curso (en memoria): { filas: { tabla: [...] }, eventos: cuántos se simularon }. */
function simularCurso(cfg, curso, reg, { hastaSemana, azar, ahora }) {
  const mem = { ...reg };
  for (const t of TABLAS_REGISTRO) mem[t] = [...(reg[t] ?? [])];
  const filas = Object.fromEntries(TABLAS_REGISTRO.map((t) => [t, []]));
  const poner = (tabla, fila) => { filas[tabla].push(fila); mem[tabla].push(fila); };
  const eventos = generarEventos(cfg, curso, reg.cambios_evento);
  const ocupados = new Set(TABLAS_REGISTRO.flatMap((t) => (reg[t] ?? []).map((f) => f.evento)));
  const est = activos(reg.estudiantes);

  // Perfiles ficticios: la mayoría falta poco y unos pocos faltan seguido; cada grupo tiene un nivel que varía algo.
  const base = 0.03 + azar() * 0.06;
  const propension = new Map(est.map((e) => [e.id, azar() < 0.1 ? 0.22 + azar() * 0.2 : base * (0.4 + azar())]));
  const habilidadGrupo = new Map();
  const habilidad = (grupo) => {
    if (!habilidadGrupo.has(grupo)) habilidadGrupo.set(grupo, 0.55 + azar() * 0.43);
    const h = limitar(habilidadGrupo.get(grupo) + (azar() - 0.5) * 0.1);
    habilidadGrupo.set(grupo, h);
    return h;
  };

  let simulados = 0;
  for (const e of eventos) {
    if (e.semana > hastaSemana || e.estado !== 'normal' || ocupados.has(e.id) || e.tipo === 'plic') continue;
    if (e.sesion) {
      simularSesion(cfg, curso, e, eventos, est, mem, poner, { azar, ahora, propension, habilidad });
      simulados += 1;
    } else if (e.tipo === 'trabajo_casa' && e.con_nota && simularTrabajo(cfg, curso, e, eventos, mem, poner, { azar, ahora, habilidad })) {
      simulados += 1;
    }
  }
  return { filas, eventos: simulados };
}

function simularSesion(cfg, curso, e, eventos, est, mem, poner, { azar, ahora, propension, habilidad }) {
  const grupos = gruposDelEvento(e, eventos, mem).porEstudiante;
  // Quien llega sin grupo se suma al grupo más pequeño (como se haría en clase); la instantánea lo arrastra.
  for (const [id, grupo] of grupos) {
    if ((grupo ?? null) !== null) continue;
    const menor = listaDeGrupos(grupos, mem.estudiantes).grupos.sort((a, b) => a.integrantes.length - b.integrantes.length)[0];
    if (menor) grupos.set(id, menor.grupo);
  }
  for (const [estudiante, grupo] of grupos) poner('grupos_evento', { evento: e.id, estudiante, grupo: grupo ?? null, fecha: ahora });

  // Pase final: presentes, faltas, alguno que se retira antes; sin grupo = no vino.
  const estados = new Map();
  for (const s of est) {
    if (!grupos.has(s.id)) continue;
    const g = grupos.get(s.id);
    let estado = 'presente';
    if (g === null || g === undefined || azar() < propension.get(s.id)) estado = 'no_vino';
    else if (e.tipo !== 'sin_nota' && azar() < 0.025) estado = 'se_retiro_antes';
    estados.set(s.id, estado);
  }
  const presentes = est.filter((s) => estados.get(s.id) && estados.get(s.id) !== 'no_vino');

  // Revisión del preparatorio en la puerta (con nivel solo en Clásica).
  if (cfg.preparatorio.aplica_a.includes(e.tipo) && e.con_nota) {
    poner('revision_preparatorio', { evento: e.id, revisada: true, fecha: ahora });
    if (preparatorioCalifica(cfg, curso.metodologia)) {
      for (const s of presentes) {
        const r = azar();
        if (r < 0.08) poner('novedades_preparatorio', { evento: e.id, estudiante: s.id, nivel: r < 0.025 ? 0 : 1, no_ingresa: false, observacion: null, fecha: ahora });
      }
    }
  }

  // Asistencia antes del control: el sorteo no toma a quien faltó.
  const sinGrupo = cfg.asistencia.motivos.sin_grupo;
  for (const [id, estado] of estados) {
    poner('asistencia', { evento: e.id, estudiante: id, estado, motivo: estado === 'no_vino' && (grupos.get(id) ?? null) === null ? sinGrupo : null, observacion: null, fecha: ahora });
  }

  // Control oral: 3 o 4 sorteados, con prioridad a quien aún no tiene control en el bimestre.
  const config = e.config ? cfg.actividades[e.config] : null;
  if (cfg.controlOral.sesiones.includes(e.tipo) && e.con_nota) {
    const ctx = crearContexto(cfg, curso, eventos, mem);
    const elegidos = sortear(candidatosSorteo(ctx, e), azar() < 0.5 ? 3 : 4, azar);
    const conceptos = config?.conceptos_control ?? [];
    const califica = controlCalifica(cfg, curso.metodologia);
    const concepto = () => (conceptos.length && azar() < 0.75 ? conceptos[Math.floor(azar() * conceptos.length)].id : null);
    elegidos.forEach((s, i) => {
      const h = habilidad(grupos.get(s.id) ?? 'x');
      if (califica) {
        const k = 1 + Math.floor(azar() * 3);
        const puntajes = Array.from({ length: k }, () => nivel(cfg.controlOral.escala_pregunta, h, azar));
        poner('controles', { evento: e.id, estudiante: s.id, estado: 'respondio', puntajes, conceptos: puntajes.map(concepto), aprobado: null, orden: i + 1, manual: false, fecha: ahora });
      } else {
        const c = concepto();
        poner('controles', { evento: e.id, estudiante: s.id, estado: 'respondio', puntajes: [], conceptos: c ? [c] : [], aprobado: azar() < 0.55 + h * 0.4, orden: i + 1, manual: false, fecha: ahora });
      }
    });
  }

  // Evaluación de cada grupo con al menos un integrante presente (si la actividad ya tiene rúbrica).
  if (config && ['practica', 'taller'].includes(e.tipo)) {
    const partes = rubrica(cfg, config);
    const enlace = (t) => t.criterio ?? t.aspecto ?? null;
    for (const { grupo, integrantes } of listaDeGrupos(grupos, mem.estudiantes).grupos) {
      if (!integrantes.some((s) => presentes.includes(s))) continue;
      const h = habilidad(grupo);
      const revision = { evento: e.id, grupo, verificado: true, trabajo_firmado: true, penalizacion_total: false, motivo_penalizacion: null, fecha: ahora };
      if (e.tipo === 'practica' && config.penalizacion_total && azar() < 0.015) {
        poner('revisiones_grupo', { ...revision, penalizacion_total: true, motivo_penalizacion: 'Equipo no ordenado al final' });
        continue;
      }
      poner('revisiones_grupo', revision);
      const valores = new Map(partes.map((p) => {
        const v = nivel(p.escala, h, azar);
        poner('puntajes', { evento: e.id, grupo, aspecto: p.id, valor: v, fecha: ahora });
        return [p.id, v / p.max];
      }));
      const media = [...valores.values()].reduce((s, x) => s + x, 0) / valores.size;
      let marcadas = 0;
      for (const t of config.etiquetas ?? []) {
        if (marcadas >= 3) break;
        const frac = enlace(t) ? valores.get(enlace(t)) ?? media : media;
        const p = t.signo === '+' ? (frac >= 0.99 ? 0.4 : frac >= 0.7 ? 0.12 : 0) : (frac <= 0.5 ? 0.45 : frac < 0.8 ? 0.12 : 0.02);
        if (azar() < p) { poner('etiquetas', { evento: e.id, grupo, etiqueta: t.id, fecha: ahora }); marcadas += 1; }
      }
      if (azar() < 0.12) poner('notas', { evento: e.id, unidad: 'grupo', unidad_id: String(grupo), texto: NOTAS_FICTICIAS[Math.floor(azar() * NOTAS_FICTICIAS.length)], fecha: ahora });
    }
  }

  poner('pases', { evento: e.id, cerrado: true, cerrado_en: ahora });
}

/** TC de SQI: cada unidad con alguien presente en la práctica entrega (casi siempre) y se califica pregunta por pregunta. */
function simularTrabajo(cfg, curso, e, eventos, mem, poner, { azar, ahora, habilidad }) {
  const config = e.config ? cfg.actividades[e.config] : null;
  if (!config || config.sin_nota || !mem.pases.some((p) => p.evento === e.practica && p.cerrado)) return false;
  const ctx = crearContexto(cfg, curso, eventos, mem);
  for (const u of unidadesDelTrabajo(ctx, e)) {
    if (!u.porCalificar) continue;
    const h = habilidad(u.grupo ?? 'x');
    const puntajes = Object.fromEntries(config.preguntas.map((q) => [q.id, nivel(q.puntajes, h, azar)]));
    const etiquetas = (config.etiquetas ?? []).filter((t) => {
      const q = config.preguntas.find((x) => x.id === t.pregunta);
      const completo = puntajes[t.pregunta] === Math.max(...q.puntajes);
      return azar() < (t.signo === '+' ? (completo ? 0.35 : 0) : (completo ? 0 : 0.4));
    }).map((t) => t.id);
    poner('trabajos_casa', { evento: e.id, unidad: u.unidad, unidad_id: String(u.id), entregado: azar() > 0.06, puntajes, etiquetas, fecha: ahora });
  }
  return true;
}
