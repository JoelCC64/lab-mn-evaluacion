// Lo que la app escribe en el Excel (Anexo J.2), calculado con el motor de notas: las columnas de la app en
// cada hoja de curso y las filas de las hojas «Asistencia (app)» y «Detalle (app)». Funciones puras.
//
// Valores: número (2 decimales) si está evaluado; null (celda vacía) si falta evaluar o hacer el pase;
// «—» si el evento no se hizo en el curso (feriado o sin clase); 0 si el estudiante faltó (el motivo va
// en las observaciones). Los componentes y la nota del bimestre se escriben solo cuando están completos.

import { fechaADate, redondear } from './util.js';
import { controlCalifica, esquemaDe } from './config.js';
import { TIPOS_SESION } from './calendario.js';
import { gruposDelEvento } from './grupos.js';
import {
  asistenciaDe, crearContexto, gruposDe, notaBimestre, notaControl, notaEvento, notaGrupo, notaPreparatorio,
} from './motor.js';

/** Valor de una celda de un evento que no se hizo en el curso (feriado o sin clase). */
export const RAYA = '—';
export const MOTIVO_EXCEL = 'editado en el Excel';

const sobreDiez = (v) => (v === null || v === undefined ? null : redondear(v * 10, 2));
const promedio = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Columnas de la app en la hoja de un curso, en orden: «Grupo actual»; por bimestre, una columna por evento
 * con nota (orden del cronograma), los componentes y la nota; al final, «Observaciones de la app».
 * Cada columna: { clave, encabezado, tipo, bimestre, evento?, componente?, formato?, ancho }.
 */
export function columnasDeLaApp(cfg, curso, eventos) {
  const cols = [{ clave: 'grupo_actual', encabezado: 'Grupo actual', tipo: 'grupo', bimestre: null, ancho: 8 }];
  for (const b of [1, 2]) {
    const esquema = esquemaDe(cfg, curso.metodologia, b);
    for (const e of eventos) {
      if (!e.con_nota || e.bimestre !== b || e.tipo === 'plic') continue;   // el PLIC va como componente
      cols.push({ clave: `B${b}:${e.codigo}`, encabezado: e.codigo, tipo: 'evento', bimestre: b, evento: e.id, formato: '0.00', ancho: 7 });
    }
    if (!controlCalifica(cfg, curso.metodologia)) {
      cols.push({ clave: `B${b}:control`, encabezado: 'Control (sí/no)', tipo: 'control_si_no', bimestre: b, ancho: 9 });
    }
    for (const comp of esquema.componentes) {
      if (!(comp.valor > 0)) continue;
      if (comp.id === 'planificacion_conocimiento') {
        cols.push({ clave: `B${b}:preparatorios`, encabezado: 'Preparatorios (/10)', tipo: 'preparatorios', bimestre: b, formato: '0.00', ancho: 13 });
        cols.push({ clave: `B${b}:control`, encabezado: 'Control (/10)', tipo: 'control', bimestre: b, formato: '0.00', ancho: 10 });
      }
      cols.push({
        clave: `B${b}:${comp.id}`, encabezado: `${comp.nombre} (/${comp.valor})`, tipo: 'componente', componente: comp.id,
        bimestre: b, formato: '0.00', ancho: 14,
      });
    }
    cols.push({ clave: `B${b}:nota`, encabezado: `Nota B${b} (/${esquema.total})`, tipo: 'nota', bimestre: b, formato: '0.00', ancho: 10 });
  }
  cols.push({ clave: 'observaciones', encabezado: 'Observaciones de la app', tipo: 'observaciones', bimestre: null, ancho: 60 });
  return cols;
}

/** ¿Ya se cerró el pase de todas las sesiones (prácticas y talleres) del bimestre que se hicieron? */
export function bimestreTerminado(ctx, bimestre) {
  const sesiones = ctx.eventos.filter((e) => e.bimestre === bimestre && ctx.cfg.controlOral.sesiones.includes(e.tipo) && e.estado === 'normal');
  return sesiones.length > 0 && sesiones.every((e) => ctx.pases.get(e.id)?.cerrado);
}

/** Grupo de cada estudiante en la instantánea más reciente (o el del Excel si aún no hay ninguna). */
export function grupoActual(ctx) {
  const ultimo = ctx.eventos[ctx.eventos.length - 1];
  return ultimo ? gruposDelEvento(ultimo, ctx.eventos, ctx.reg).porEstudiante : new Map();
}

/**
 * Contexto del motor con las notas de evento que Joel fijó a mano en el Excel, aplicadas como ajustes con
 * motivo «editado en el Excel». `fijadas`: [{ evento, estudiante, valor (0–1) }].
 */
export function contextoConFijadas(cfg, curso, eventos, reg, fijadas = []) {
  if (!fijadas.length) return crearContexto(cfg, curso, eventos, reg);
  const claves = new Set(fijadas.map((f) => `${f.evento}|${f.estudiante}`));
  const ajustes = [
    ...(reg.ajustes ?? []).filter((a) => !claves.has(`${a.evento}|${a.estudiante}`)),
    ...fijadas.map((f) => ({ evento: f.evento, estudiante: f.estudiante, valor: f.valor, motivo: MOTIVO_EXCEL, excel: true })),
  ];
  return crearContexto(cfg, curso, eventos, { ...reg, ajustes });
}

/** Valor final de un componente para el Excel, o null si aún no está completo. */
function valorComponente(comp, terminado) {
  if (comp.completo) return comp.proyectada;    // con todo evaluado, la proyectada es la nota final
  // Bimestre cerrado sin control oral: cuenta solo el preparatorio (con observación).
  if (comp.sinControl && terminado && !comp.preparatorios.some((p) => p.estado === 'pendiente')) return comp.proyectada;
  return null;
}

function tuvoControl(ctx, id, bimestre) {
  return ctx.eventos.some((e) => e.bimestre === bimestre && ctx.cfg.controlOral.sesiones.includes(e.tipo)
    && notaControl(ctx, e, id).estado === 'calculada');
}

/** Texto de observación de un evento para el Excel, o null si no hay nada que explicar. */
function observacionEvento(evento, n, hoy) {
  if (n.estado === 'excluido') return `${evento.codigo}: no se hizo (${n.motivo})`;
  if (n.estado === 'calculada') {
    if (n.ajuste?.excel) return null;   // va con el texto de la celda fijada
    if (n.ajuste) return `${evento.codigo}: ajuste (${n.ajuste.motivo})`;
    if (n.motivo) return `${evento.codigo}: ${n.motivo}`;
    return null;
  }
  if (n.estado === 'pendiente' && evento.fecha < hoy) return `${evento.codigo}: pendiente (${n.motivo})`;
  return null;
}

/** «P1: no vino · T2: no se hizo (feriado) · B1: sin control oral». */
function observaciones(ctx, id, { hoy, fijadas }) {
  const partes = [];
  if (ctx.estudiantePorId.get(id)?.estado === 'pendiente') partes.push('pendiente de nómina');
  for (const e of ctx.eventos) {
    if (!e.con_nota) continue;
    if (fijadas?.has(e.id)) { partes.push(`${e.codigo}: nota puesta a mano en el Excel`); continue; }
    const t = observacionEvento(e, notaEvento(ctx, e, id), hoy);
    if (t) partes.push(t);
  }
  for (const b of [1, 2]) {
    if (bimestreTerminado(ctx, b) && !tuvoControl(ctx, id, b)) partes.push(`B${b}: sin control oral`);
  }
  return partes.length ? partes.join(' · ') : null;
}

const grupoComoValor = (g) => (g === null || g === undefined ? null : /^\d+$/.test(String(g)) ? Number(g) : String(g));

/**
 * Valores de las columnas de la app para un estudiante: Map(clave → valor).
 * `grupos`: grupoActual(ctx). `fijadas`: Set de ids de evento con la nota fijada a mano en el Excel.
 */
export function valoresDelEstudiante(ctx, columnas, id, { hoy, grupos, fijadas = new Set() }) {
  const valores = new Map();
  const bimestres = new Map();
  const del = (b) => {
    if (!bimestres.has(b)) {
      const nb = notaBimestre(ctx, id, b);
      const terminado = bimestreTerminado(ctx, b);
      const porId = new Map(nb.componentes.map((c) => [c.id, c]));
      const finales = nb.componentes.map((c) => valorComponente(c, terminado));
      bimestres.set(b, { porId, terminado, nota: finales.every((v) => v !== null && v !== undefined) ? finales.reduce((s, v) => s + v, 0) : null });
    }
    return bimestres.get(b);
  };
  for (const col of columnas) {
    let v = null;
    if (col.tipo === 'grupo') v = grupoComoValor(grupos.get(id));
    else if (col.tipo === 'evento') {
      const n = notaEvento(ctx, ctx.eventoPorId.get(col.evento), id);
      v = n.estado === 'calculada' ? sobreDiez(n.valor) : n.estado === 'excluido' ? RAYA : null;
    } else if (col.tipo === 'control_si_no') {
      v = tuvoControl(ctx, id, col.bimestre) ? 'sí' : bimestreTerminado(ctx, col.bimestre) ? 'no' : null;
    } else if (col.tipo === 'preparatorios') {
      const pyc = del(col.bimestre).porId.get('planificacion_conocimiento');
      v = sobreDiez(promedio(pyc.preparatorios.filter((p) => p.estado === 'calculada').map((p) => p.valor)));
    } else if (col.tipo === 'control') {
      const pyc = del(col.bimestre).porId.get('planificacion_conocimiento');
      v = sobreDiez(pyc.promedios.control);
    } else if (col.tipo === 'componente') {
      const d = del(col.bimestre);
      const comp = d.porId.get(col.componente);
      v = comp ? redondear(valorComponente(comp, d.terminado), 2) : null;
    } else if (col.tipo === 'nota') {
      v = redondear(del(col.bimestre).nota, 2);
    } else if (col.tipo === 'observaciones') {
      v = observaciones(ctx, id, { hoy, fijadas });
    }
    valores.set(col.clave, v ?? null);
  }
  return valores;
}

// ---------- Hoja «Asistencia (app)» ----------

/** Semanas con alguna sesión en los cronogramas (S1 … S18). */
export function semanasConSesion(cfg) {
  let max = 0;
  for (const c of Object.values(cfg.cronogramas)) {
    for (const s of c.semanas) {
      if (!s.sin_clase && s.actividades.some((a) => TIPOS_SESION.includes(cfg.catalogo[a]?.tipo))) max = Math.max(max, s.semana);
    }
  }
  return Array.from({ length: max }, (_, i) => i + 1);
}

/**
 * Asistencia de un estudiante por semana: P (presente), F (no vino o salió), R (se retiró antes),
 * «—» (sin clase o feriado), null (sin pase). Más asistencias (P + R) y porcentaje sobre las sesiones con pase.
 */
export function asistenciaPorSemana(ctx, id, semanas) {
  const estados = ctx.cfg.asistencia.estados;
  let asistio = 0, registradas = 0;
  const valores = semanas.map((s) => {
    const e = ctx.eventos.find((x) => x.sesion && x.semana === s);
    if (!e || e.estado !== 'normal') return RAYA;
    if (!ctx.pases.get(e.id)?.cerrado) return null;
    const estado = ctx.asistencia.get(`${e.id}|${id}`)?.estado ?? null;
    if (!estado || !estados[estado]) return null;
    registradas += 1;
    if (!estados[estado].falta) asistio += 1;
    return estados[estado].abrev;
  });
  return { valores, asistencias: registradas ? asistio : null, porcentaje: registradas ? asistio / registradas : null };
}

// ---------- Hoja «Detalle (app)» ----------

export const COLUMNAS_DETALLE = [
  { encabezado: 'Paralelo', ancho: 9 }, { encabezado: 'Código único', ancho: 12 }, { encabezado: 'Apellidos y nombres', ancho: 36 },
  { encabezado: 'Semana', ancho: 8 }, { encabezado: 'Fecha', ancho: 11, formato: 'dd/mm/yyyy' }, { encabezado: 'Evento', ancho: 8 },
  { encabezado: 'Grupo', ancho: 7 }, { encabezado: 'Asistencia', ancho: 22 }, { encabezado: 'Preparatorio', ancho: 12 },
  { encabezado: 'Control', ancho: 16 }, { encabezado: 'Puntajes', ancho: 34 }, { encabezado: 'Nota del grupo', ancho: 10, formato: '0.00' },
  { encabezado: 'Nota del evento (/10)', ancho: 11, formato: '0.00' }, { encabezado: 'Motivo', ancho: 34 },
  { encabezado: 'Observación del profesor', ancho: 44 }, { encabezado: 'Etiquetas', ancho: 44 },
];

function textoAsistencia(ctx, evento, id) {
  const a = asistenciaDe(ctx, evento, id);
  if (!a.estado) return null;
  const texto = ctx.cfg.asistencia.estados[a.estado]?.texto ?? a.estado;
  return a.motivo ? `${texto} (${a.motivo})` : texto;
}

function textoControl(ctx, evento, id) {
  const c = notaControl(ctx, evento, id);
  if (c.estado === 'sin_control') return null;
  if (c.estado === 'no_esta') return 'no estaba';
  if (c.estado === 'sorteado') return 'sorteado, sin respuesta';
  if (c.salio) return 'salió (no preparado)';
  if (c.valor !== null && c.valor !== undefined) return `${c.puntajes.join(' · ')} → ${redondear(c.valor * 10, 2)}/10`;
  return c.aprobado ? 'aprobado' : 'no aprobado';
}

/** Una fila de «Detalle (app)»: todo lo registrado de un estudiante en un evento. */
export function filaDetalle(ctx, evento, estudiante) {
  const id = estudiante.id;
  const config = evento.config ? ctx.cfg.actividades[evento.config] : null;
  const grupo = gruposDe(ctx, evento).get(id) ?? null;
  const n = notaEvento(ctx, evento, id);
  const prep = notaPreparatorio(ctx, evento, id);
  let puntajes = null, notaDelGrupo = null, etiquetas = null, notaProfesor = null;
  if (grupo !== null && ['practica', 'taller'].includes(evento.tipo) && evento.estado === 'normal') {
    const g = notaGrupo(ctx, evento, grupo);
    puntajes = g.partes.filter((p) => p.valor !== null && p.valor !== undefined).map((p) => `${p.corto} ${p.valor}`).join(' · ') || null;
    if (g.penalizacion) puntajes = `penalización total (${g.motivo})`;
    notaDelGrupo = g.completo ? sobreDiez(g.valor) : null;
    const marcadas = new Set(ctx.reg.etiquetas.filter((t) => t.evento === evento.id && t.grupo === grupo).map((t) => t.etiqueta));
    etiquetas = (config?.etiquetas ?? []).filter((t) => marcadas.has(t.id)).map((t) => `${t.signo === '+' ? '+' : '−'} ${t.texto}`).join(' · ') || null;
    notaProfesor = ctx.reg.notas.find((x) => x.evento === evento.id && x.unidad === 'grupo' && x.unidad_id === grupo)?.texto ?? null;
  }
  if (evento.tipo === 'trabajo_casa' && grupo !== null) {
    const tc = ctx.trabajosCasa.get(`${evento.id}|${grupo}`);
    if (tc) puntajes = tc.entregado ? Object.entries(tc.puntajes ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ') || null : 'no entregó';
  }
  const obsEstudiante = ctx.asistencia.get(`${evento.id}|${id}`)?.observacion ?? null;
  const notaEstudiante = ctx.reg.notas.find((x) => x.evento === evento.id && x.unidad === 'estudiante' && x.unidad_id === id)?.texto ?? null;
  const observacion = [obsEstudiante, notaEstudiante, notaProfesor && `Grupo: ${notaProfesor}`].filter(Boolean).join(' · ') || null;
  return [
    evento.curso, estudiante.codigo, estudiante.nombre, evento.semana, fechaADate(evento.fecha), evento.codigo,
    grupo === null ? null : grupoComoValor(grupo),
    evento.estado === 'normal' ? textoAsistencia(ctx, evento, id) : null,
    prep.estado === 'calculada' ? prep.nivel : prep.estado === 'pendiente' ? 'pendiente' : null,
    textoControl(ctx, evento, id),
    puntajes,
    notaDelGrupo,
    n.estado === 'calculada' ? sobreDiez(n.valor) : n.estado === 'excluido' ? RAYA : null,
    n.motivo ?? null,
    observacion,
    etiquetas,
  ];
}

/** Eventos que van al detalle: los que ya ocurrieron (o tienen algo registrado), en orden del calendario. */
export function eventosDelDetalle(ctx, hoy) {
  const conRegistro = new Set([...ctx.pases.keys(), ...ctx.reg.asistencia.map((a) => a.evento)]);
  return ctx.eventos.filter((e) => (e.sesion || e.tipo === 'trabajo_casa' || e.tipo === 'plic') && (e.fecha <= hoy || conRegistro.has(e.id)));
}
