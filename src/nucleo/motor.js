// Motor de notas (§4 del plan). Funciones puras: reciben la configuración, el curso, sus eventos y lo
// registrado (`registrosDelCurso`). Las notas de actividad van de 0 a 1; nunca se guardan, se calculan.
// Cada resultado explica qué entró, con qué peso, qué se excluyó y qué se ajustó (transparencia).

import { agruparPor } from './util.js';
import { esquemaDe } from './config.js';
import { eventoBase, gruposDelEvento } from './grupos.js';

const FALTAS = ['no_vino', 'salio'];

/** Índices de lo registrado, para consultas rápidas. `reg` puede traer tablas de fases futuras. */
export function crearContexto(cfg, curso, eventos, reg) {
  const indice = (tabla, clave) => new Map((reg[tabla] ?? []).map((f) => [clave(f), f]));
  return {
    cfg,
    curso,
    eventos,
    reg,
    eventoPorId: new Map(eventos.map((e) => [e.id, e])),
    estudiantePorId: new Map(reg.estudiantes.map((e) => [e.id, e])),
    asistencia: indice('asistencia', (f) => `${f.evento}|${f.estudiante}`),
    pases: indice('pases', (f) => f.evento),
    revisiones: indice('revisiones_grupo', (f) => `${f.evento}|${f.grupo}`),
    puntajes: agruparPor(reg.puntajes ?? [], (f) => `${f.evento}|${f.grupo}`),
    controles: indice('controles', (f) => `${f.evento}|${f.estudiante}`),
    revisionPrep: indice('revision_preparatorio', (f) => f.evento),
    novedades: indice('novedades_preparatorio', (f) => `${f.evento}|${f.estudiante}`),
    ajustes: indice('ajustes', (f) => `${f.evento}|${f.estudiante}`),
    trabajosCasa: indice('trabajos_casa', (f) => `${f.evento}|${f.grupo}`),
    recuperaciones: indice('recuperaciones', (f) => `${f.evento}|${f.estudiante}`),
    plic: indice('plic', (f) => f.estudiante),
    cacheGrupos: new Map(),
  };
}

/** Grupo de cada estudiante en el evento (Map id → grupo | null). */
export function gruposDe(ctx, evento) {
  if (!ctx.cacheGrupos.has(evento.id)) {
    ctx.cacheGrupos.set(evento.id, gruposDelEvento(evento, ctx.eventos, ctx.reg).porEstudiante);
  }
  return ctx.cacheGrupos.get(evento.id);
}

/** Asistencia de un estudiante en un evento (un TC usa la de su práctica). */
export function asistenciaDe(ctx, evento, estudiante) {
  const base = eventoBase(evento, ctx.eventos);
  const fila = ctx.asistencia.get(`${base.id}|${estudiante}`);
  return {
    estado: fila?.estado ?? null,
    motivo: fila?.motivo ?? null,
    observacion: fila?.observacion ?? null,
    paseCerrado: Boolean(ctx.pases.get(base.id)?.cerrado),
    falta: FALTAS.includes(fila?.estado),
  };
}

function textoFalta(asis) {
  const base = asis.estado === 'salio' ? 'salió' : 'no vino';
  return asis.motivo ? `${base} (${asis.motivo})` : base;
}

/** Partes evaluables de la rúbrica de un grupo: criterios (Clásica), aspectos (SQI) o evaluación integral (taller). */
export function rubrica(cfg, config) {
  if (!config) return [];
  if (config.tipo === 'practica' && config.criterios) {
    return config.criterios.map((c) => ({ id: c.id, nombre: c.nombre, peso: c.peso, escala: c.escala, max: Math.max(...c.escala) }));
  }
  if (config.tipo === 'practica') {
    return config.aspectos_aplicables.map((a) => {
      const asp = cfg.sqi.aspectos[a];
      return { id: a, nombre: asp.nombre, peso: null, escala: asp.escala, max: Math.max(...asp.escala) };
    });
  }
  if (config.tipo === 'taller') {
    const ei = config.evaluacion_integral;
    return [{ id: 'integral', nombre: 'Evaluación integral', peso: null, escala: ei.escala, max: Math.max(...ei.escala) }];
  }
  return [];
}

/**
 * Nota de un grupo en una práctica o taller (0–1), o null si falta evaluar algo.
 * Clásica: Σ peso × nivel / nivel máx. SQI: puntos / máximo de los aspectos aplicables. Taller: integral / máx.
 */
export function notaGrupo(ctx, evento, grupo) {
  const config = evento.config ? ctx.cfg.actividades[evento.config] : null;
  const rev = ctx.revisiones.get(`${evento.id}|${grupo}`);
  if (rev?.penalizacion_total) {
    return { valor: 0, completo: true, penalizacion: true, motivo: rev.motivo_penalizacion || 'penalización total', partes: [] };
  }
  if (!config) return { valor: null, completo: false, sinConfig: true, partes: [] };
  const puntos = new Map((ctx.puntajes.get(`${evento.id}|${grupo}`) ?? []).map((p) => [p.aspecto, p.valor]));
  const partes = rubrica(ctx.cfg, config).map((r) => ({ ...r, valor: puntos.has(r.id) ? puntos.get(r.id) : null }));
  const faltan = partes.filter((p) => p.valor === null || p.valor === undefined);
  if (!partes.length || faltan.length) return { valor: null, completo: false, partes, faltan: faltan.map((p) => p.nombre) };
  const valor = partes[0].peso !== null
    ? partes.reduce((s, p) => s + (p.peso * p.valor) / p.max, 0)
    : partes.reduce((s, p) => s + p.valor, 0) / partes.reduce((s, p) => s + p.max, 0);
  return { valor, completo: true, partes };
}

function conAjuste(ctx, r) {
  const ajuste = ctx.ajustes.get(`${r.evento}|${r.estudiante}`);
  if (!ajuste) return r;
  return { ...r, estado: 'calculada', valor_sin_ajuste: r.valor, valor: ajuste.valor, ajuste, motivo: `ajuste: ${ajuste.motivo}` };
}

/**
 * Nota de un estudiante en un evento (0–1), con su estado:
 * 'calculada' · 'pendiente' (con el motivo) · 'excluido' (feriado o sin clase) · 'sin_nota'.
 */
export function notaEvento(ctx, evento, estudiante) {
  const est = ctx.estudiantePorId.get(estudiante);
  const r = {
    evento: evento.id, codigo: evento.codigo, estudiante, estado: 'pendiente', valor: null, motivo: null,
    grupo: null, asistencia: null, partes: {}, pendiente_nomina: est?.estado === 'pendiente',
  };
  if (!evento.con_nota) return { ...r, estado: 'sin_nota' };

  const rec = ctx.recuperaciones.get(`${evento.id}|${estudiante}`);
  if (evento.estado !== 'normal') {
    // Feriado: la actividad no cuenta, salvo que el estudiante la recupere (entonces cuenta para él).
    if (rec?.estado === 'realizada') return conAjuste(ctx, { ...r, estado: 'calculada', valor: rec.nota, motivo: `recuperada (${evento.motivo})`, recuperacion: rec });
    return { ...r, estado: 'excluido', motivo: evento.motivo };
  }
  if (rec) {
    if (rec.estado === 'realizada') return conAjuste(ctx, { ...r, estado: 'calculada', valor: rec.nota, motivo: 'recuperación', recuperacion: rec });
    if (rec.estado === 'no_asistio') return conAjuste(ctx, { ...r, estado: 'calculada', valor: 0, motivo: 'no asistió a la recuperación', recuperacion: rec });
    return conAjuste(ctx, { ...r, motivo: 'falta justificada: pendiente de la recuperación', recuperacion: rec });
  }

  if (evento.tipo === 'plic') {
    const p = ctx.plic.get(estudiante);
    if (!p) return conAjuste(ctx, { ...r, motivo: 'falta registrar el PLIC' });
    return conAjuste(ctx, { ...r, estado: 'calculada', valor: p.completo_valido ? 1 : 0, motivo: p.completo_valido ? null : 'PLIC no válido o no rendido' });
  }

  const asis = asistenciaDe(ctx, evento, estudiante);
  r.asistencia = asis.estado;
  r.grupo = gruposDe(ctx, evento).get(estudiante) ?? null;
  if (!asis.paseCerrado) return conAjuste(ctx, { ...r, motivo: evento.tipo === 'trabajo_casa' ? 'falta cerrar el pase de la práctica' : 'falta cerrar el pase' });
  if (asis.estado === null) return conAjuste(ctx, { ...r, motivo: 'no consta en el pase' });
  if (asis.falta) {
    const enLaPractica = evento.tipo === 'trabajo_casa' ? ' en la práctica' : '';
    return conAjuste(ctx, { ...r, estado: 'calculada', valor: 0, motivo: `${textoFalta(asis)}${enLaPractica}` });
  }

  const config = evento.config ? ctx.cfg.actividades[evento.config] : null;
  if (evento.tipo === 'practica') {
    if (r.grupo === null) return conAjuste(ctx, { ...r, motivo: 'sin grupo' });
    const g = notaGrupo(ctx, evento, r.grupo);
    r.partes = { grupo: g };
    if (g.valor === null) return conAjuste(ctx, { ...r, motivo: g.sinConfig ? 'falta la rúbrica de la actividad' : `falta evaluar el grupo ${r.grupo}` });
    return conAjuste(ctx, { ...r, estado: 'calculada', valor: g.valor, motivo: g.penalizacion ? `penalización total (${g.motivo})` : null });
  }

  if (evento.tipo === 'taller') {
    if (!config) return conAjuste(ctx, { ...r, motivo: 'falta la configuración del taller' });
    const ap = asis.estado === 'se_retiro_antes' ? config.asistencia_permanencia.se_retiro_antes : 1;
    const g = r.grupo === null ? null : notaGrupo(ctx, evento, r.grupo);
    r.partes = { asistencia_permanencia: ap, grupo: g };
    if (!g || g.valor === null) return conAjuste(ctx, { ...r, motivo: 'falta la evaluación integral del grupo' });
    const valor = config.pesos.asistencia_permanencia * ap + config.pesos.evaluacion_integral * g.valor;
    return conAjuste(ctx, { ...r, estado: 'calculada', valor, motivo: asis.estado === 'se_retiro_antes' ? 'se retiró antes' : null });
  }

  if (evento.tipo === 'trabajo_casa') {
    if (!config || config.sin_nota) return { ...r, estado: 'sin_nota' };
    const tc = r.grupo === null ? null : ctx.trabajosCasa.get(`${evento.id}|${r.grupo}`);
    if (!tc) return conAjuste(ctx, { ...r, motivo: 'falta registrar el trabajo en casa' });
    if (!tc.entregado) return conAjuste(ctx, { ...r, estado: 'calculada', valor: 0, motivo: 'no entregó' });
    const faltan = config.preguntas.filter((p) => tc.puntajes?.[p.id] === undefined || tc.puntajes?.[p.id] === null);
    if (faltan.length) return conAjuste(ctx, { ...r, motivo: `faltan ${faltan.length} pregunta(s) del TC` });
    const puntos = config.preguntas.reduce((s, p) => s + tc.puntajes[p.id], 0);
    return conAjuste(ctx, { ...r, estado: 'calculada', valor: puntos / config.escala_total, partes: { puntos } });
  }

  return { ...r, estado: 'sin_nota' };
}

/** Trabajo preparatorio (nivel 0/1/2 → nota nivel/2). Solo donde califica (Clásica). */
export function notaPreparatorio(ctx, evento, estudiante) {
  const p = ctx.cfg.preparatorio;
  if (!p.aplica_a.includes(evento.tipo) || !p.califica[ctx.curso.metodologia]) return { estado: 'sin_nota' };
  if (evento.estado !== 'normal') return { estado: 'excluido', motivo: evento.motivo };
  const max = Math.max(...p.escala);
  const asis = asistenciaDe(ctx, evento, estudiante);
  const nov = ctx.novedades.get(`${evento.id}|${estudiante}`);
  if (!asis.paseCerrado) return { estado: 'pendiente', motivo: 'falta cerrar el pase' };
  if (asis.falta) return { estado: 'calculada', nivel: p.si_no_vino, valor: p.si_no_vino / max, motivo: textoFalta(asis) };
  if (asis.estado === null) return { estado: 'pendiente', motivo: 'no consta en el pase' };
  if (nov && nov.nivel !== null && nov.nivel !== undefined) {
    return { estado: 'calculada', nivel: nov.nivel, valor: nov.nivel / max, motivo: p.nombres_novedad[String(nov.nivel)], novedad: nov };
  }
  if (!ctx.revisionPrep.get(evento.id)?.revisada) return { estado: 'pendiente', motivo: 'revisión del preparatorio sin marcar' };
  return { estado: 'calculada', nivel: p.por_defecto_presentes, valor: p.por_defecto_presentes / max };
}

/**
 * Control oral del estudiante en el evento. Clásica: Σ puntajes / (2 × preguntas). SQI: aprobado o no (sin nota).
 * Estados: 'calculada' (cuenta como control) · 'sorteado' · 'no_esta' · 'sin_control'.
 */
export function notaControl(ctx, evento, estudiante) {
  const co = ctx.cfg.controlOral;
  const fila = ctx.controles.get(`${evento.id}|${estudiante}`);
  if (!fila) return { estado: 'sin_control' };
  const califica = Boolean(co.califica[ctx.curso.metodologia]);
  if (fila.estado === 'salio') {
    if (!co.salio.cuenta_como_control) return { estado: 'sin_control', motivo: 'salió' };
    return { estado: 'calculada', valor: califica ? co.salio.nota : null, aprobado: false, salio: true, motivo: 'salió (no preparado)' };
  }
  if (fila.estado === 'no_esta') return { estado: 'no_esta' };
  if (fila.estado !== 'respondio') return { estado: 'sorteado' };
  if (califica) {
    const p = (fila.puntajes ?? []).filter((x) => x !== null && x !== undefined);
    if (!p.length) return { estado: 'sorteado' };
    const max = Math.max(...co.escala_pregunta);
    return { estado: 'calculada', valor: p.reduce((s, x) => s + x, 0) / (max * p.length), preguntas: p.length, puntajes: p };
  }
  if (fila.aprobado === null || fila.aprobado === undefined) return { estado: 'sorteado' };
  return { estado: 'calculada', valor: null, aprobado: fila.aprobado };
}

const suma = (xs) => xs.reduce((s, x) => s + x, 0);
const promedio = (xs) => (xs.length ? suma(xs) / xs.length : null);

/** Componente con actividades ponderadas (prácticas, TC, talleres, PLIC): renormaliza si se excluye alguna. */
function componentePorActividades(ctx, estudiante, comp) {
  const items = Object.entries(comp.items ?? {}).map(([codigo, peso]) => {
    const evento = ctx.eventos.find((e) => e.codigo === codigo);
    if (!evento) return { codigo, peso, estado: 'excluido', motivo: 'no está en el cronograma del curso' };
    const n = notaEvento(ctx, evento, estudiante);
    return { codigo, evento: evento.id, peso, estado: n.estado, valor: n.valor, motivo: n.motivo };
  });
  const validos = items.filter((i) => i.estado !== 'excluido' && i.estado !== 'sin_nota');
  const calculados = validos.filter((i) => i.estado === 'calculada');
  const pesoTotal = suma(validos.map((i) => i.peso));
  const pesoCalculado = suma(calculados.map((i) => i.peso));
  const puntos = suma(calculados.map((i) => i.peso * i.valor));
  return {
    id: comp.id,
    nombre: comp.nombre,
    valor: comp.valor,
    acumulada: pesoTotal > 0 ? (puntos / pesoTotal) * comp.valor : 0,
    proyectada: pesoCalculado > 0 ? (puntos / pesoCalculado) * comp.valor : null,
    completo: calculados.length === validos.length,
    items,
    observaciones: items.filter((i) => i.estado === 'excluido').map((i) => `${i.codigo}: ${i.motivo}`),
  };
}

/** Planificación y conocimiento (Clásica): 40 % promedio de preparatorios + 60 % promedio de controles. */
function componentePyC(ctx, estudiante, comp, bimestre) {
  const p = ctx.cfg.preparatorio;
  const sesiones = ctx.eventos.filter((e) => e.bimestre === bimestre && e.con_nota && p.aplica_a.includes(e.tipo));
  const preparatorios = sesiones
    .map((e) => ({ codigo: e.codigo, evento: e.id, ...notaPreparatorio(ctx, e, estudiante) }))
    .filter((x) => x.estado !== 'excluido' && x.estado !== 'sin_nota');
  const prepCalculados = preparatorios.filter((x) => x.estado === 'calculada');
  const controles = sesiones
    .map((e) => ({ codigo: e.codigo, evento: e.id, ...notaControl(ctx, e, estudiante) }))
    .filter((x) => x.estado === 'calculada');
  const wP = comp.items.trabajo_preparatorio;
  const wC = comp.items.control_oral;
  const promPrep = promedio(prepCalculados.map((x) => x.valor));
  const promCtrl = promedio(controles.map((x) => x.valor));
  const acumPrep = preparatorios.length ? suma(prepCalculados.map((x) => x.valor)) / preparatorios.length : 0;
  const observaciones = [];
  let proyectada = null;
  if (promPrep !== null && promCtrl !== null) proyectada = (wP * promPrep + wC * promCtrl) * comp.valor;
  else if (promPrep !== null) proyectada = promPrep * comp.valor;
  else if (promCtrl !== null) proyectada = promCtrl * comp.valor;
  if (promCtrl === null) observaciones.push('sin control oral en el bimestre: cuenta solo el preparatorio');
  const pendientesPrep = preparatorios.filter((x) => x.estado === 'pendiente');
  if (pendientesPrep.length) observaciones.push(`preparatorio pendiente en ${pendientesPrep.map((x) => x.codigo).join(', ')}`);
  return {
    id: comp.id,
    nombre: comp.nombre,
    valor: comp.valor,
    acumulada: (wP * acumPrep + wC * (promCtrl ?? 0)) * comp.valor,
    proyectada,
    completo: pendientesPrep.length === 0 && promCtrl !== null,
    sinControl: promCtrl === null,
    preparatorios,
    controles,
    promedios: { preparatorio: promPrep, control: promCtrl },
    observaciones,
  };
}

/**
 * Nota del bimestre de un estudiante: componentes con desglose, nota acumulada (lo pendiente cuenta 0)
 * y proyectada (lo pendiente no cuenta). Sin redondear: se redondea al mostrar y al escribir.
 */
export function notaBimestre(ctx, estudiante, bimestre) {
  const esquema = esquemaDe(ctx.cfg, ctx.curso.metodologia, bimestre);
  const componentes = esquema.componentes
    .filter((c) => c.valor > 0)
    .map((c) => (c.id === 'planificacion_conocimiento'
      ? componentePyC(ctx, estudiante, c, bimestre)
      : componentePorActividades(ctx, estudiante, c)));
  return {
    esquema: esquema.id,
    componentes,
    acumulada: suma(componentes.map((c) => c.acumulada)),
    proyectada: componentes.every((c) => c.proyectada !== null) ? suma(componentes.map((c) => c.proyectada)) : null,
    completo: componentes.every((c) => c.completo),
  };
}

/** Resumen de un evento por estudiante (pantalla «Resumen»): asistencia, nota, preparatorio y control. */
export function resumenEvento(ctx, evento) {
  const grupos = gruposDe(ctx, evento);
  const filas = [...grupos.keys()]
    .map((id) => ctx.estudiantePorId.get(id))
    .filter(Boolean)
    .map((est) => ({
      estudiante: est,
      grupo: grupos.get(est.id) ?? null,
      asistencia: asistenciaDe(ctx, evento, est.id),
      nota: notaEvento(ctx, evento, est.id),
      preparatorio: notaPreparatorio(ctx, evento, est.id),
      control: notaControl(ctx, evento, est.id),
    }));
  const avisos = [];
  const base = eventoBase(evento, ctx.eventos);
  if (evento.sesion && evento.estado === 'normal') {
    if (!ctx.pases.get(base.id)?.cerrado) avisos.push('El pase final no está cerrado: las notas siguen pendientes.');
    const p = ctx.cfg.preparatorio;
    if (p.aplica_a.includes(evento.tipo) && p.califica[ctx.curso.metodologia] && !ctx.revisionPrep.get(evento.id)?.revisada) {
      avisos.push('La revisión del preparatorio no está marcada: el preparatorio de quienes no tienen novedad queda pendiente.');
    }
  }
  return { filas, avisos };
}
