// Métricas del semestre (Fase 8): agregados de lo registrado por curso, evento, día, franja y metodología.
// Funciones puras sobre lo que devuelve `cargarCursos`. Todo es agregado y sin nombres, salvo `riesgo` y `detalle`,
// que llevan estudiantes y solo se muestran en la vista del profesor (nunca en la lámina para presentar).
// Las notas van normalizadas (0–1): la del grupo en prácticas y talleres y la de cada unidad en los TC.

import { asistenciaDe, crearContexto, gruposDe, notaBimestre, notaControl, notaGrupo, notaPreparatorio, rubrica } from './motor.js';
import { activos, listaDeGrupos } from './grupos.js';
import { seCalificaTrabajo, unidadesDelTrabajo } from './motor-vista.js';
import { conControlEnBimestre, sesionesDeControl } from './sorteo.js';
import { avisoControlCierre } from './bimestre.js';
import { controlCalifica, nombreMetodologia, preparatorioCalifica } from './config.js';
import { DIAS, DIAS_TEXTO, agruparPor, compararGrupos, enLista } from './util.js';
import { enPeriodo, periodoDe } from './periodos.js';

export const METODOLOGIAS = ['TRAD', 'SQI'];
const ESTADOS = ['presente', 'se_retiro_antes', 'no_vino', 'salio'];
const ORDEN_TIPO = { sin_nota: 0, practica: 1, trabajo_casa: 2, taller: 3 };

const promedio = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const porSemana = (a, b) => a.semana - b.semana || ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] || String(a.codigo).localeCompare(String(b.codigo));
export const franjaDe = (curso) => `${curso.inicio}–${curso.fin}`;

/** Alcances del tablero: todos los cursos, una metodología o un curso. */
export function alcances(cfg) {
  const de = (m) => cfg.cursos.filter((c) => c.metodologia === m);
  return [
    { id: 'todos', texto: 'Todos los cursos', detalle: `${cfg.cursos.length} cursos` },
    ...METODOLOGIAS.filter((m) => de(m).length).map((m) => ({ id: m, texto: nombreMetodologia(cfg, m), detalle: `${de(m).length} cursos` })),
    ...cfg.cursos.map((c) => ({ id: c.paralelo, texto: c.paralelo, detalle: nombreMetodologia(cfg, c.metodologia) })),
  ];
}

const enAlcance = (curso, alcance) => alcance === 'todos' || alcance === curso.metodologia || alcance === curso.paralelo;

// ---------- Asistencia y permanencia ----------

const nuevaAsistencia = () => ({ n: 0, presentes: 0, retiros: 0, faltas: 0 });

function anotar(c, estado) {
  c.n += 1;
  if (estado === 'presente') c.presentes += 1;
  else if (estado === 'se_retiro_antes') c.retiros += 1;
  else c.faltas += 1;
}

/** Asistencia = vinieron / registrados; permanencia = se quedaron hasta el final / vinieron. */
function conTasas(c) {
  const vinieron = c.presentes + c.retiros;
  return { ...c, asistencia: c.n ? vinieron / c.n : null, permanencia: vinieron ? c.presentes / vinieron : null };
}

/**
 * Asistencia de las sesiones del periodo. Cuenta las de pase cerrado y, mientras tanto, las ya empezadas (con algo
 * registrado y fecha hasta hoy): en ellas, quien está en un grupo y no tiene falta marcada cuenta como presente, igual
 * que al cerrar el pase; quien no tiene grupo aún no cuenta. Así las métricas se actualizan durante el día.
 */
function metricasAsistencia(datos, delBimestre, unCurso, hoy = null) {
  const total = nuevaAsistencia();
  const porCurso = new Map(); const porEvento = new Map(); const porDia = new Map(); const porFranja = new Map();
  const porGrupo = new Map(); const porEstudiante = new Map();
  let sesiones = 0;
  let abiertas = 0;
  const de = (mapa, clave, inicial) => {
    if (!mapa.has(clave)) mapa.set(clave, { clave, ...inicial(), ...nuevaAsistencia() });
    return mapa.get(clave);
  };
  for (const { curso, ctx, est } of datos) {
    const conRegistro = new Set([...ctx.reg.grupos_evento, ...ctx.reg.asistencia].map((f) => f.evento));
    for (const e of ctx.eventos) {
      if (!e.sesion || e.estado !== 'normal' || !delBimestre(e)) continue;
      const cerrado = Boolean(ctx.pases.get(e.id)?.cerrado);
      const abierta = !cerrado && hoy !== null && e.fecha <= hoy && conRegistro.has(e.id);
      if (!cerrado && !abierta) continue;
      sesiones += 1;
      if (abierta) abiertas += 1;
      const grupos = gruposDe(ctx, e);
      for (const s of est) {
        let estado = ctx.asistencia.get(`${e.id}|${s.id}`)?.estado;
        if (!estado && abierta && (grupos.get(s.id) ?? null) !== null) estado = 'presente';
        if (!ESTADOS.includes(estado)) continue;
        anotar(total, estado);
        anotar(de(porCurso, curso.paralelo, () => ({ etiqueta: curso.paralelo, metodologia: curso.metodologia })), estado);
        const ev = de(porEvento, e.codigo, () => ({ etiqueta: e.codigo, codigo: e.codigo, tipo: e.tipo, semana: e.semana, conNota: e.con_nota, cursos: new Set() }));
        ev.semana = Math.min(ev.semana, e.semana);
        ev.cursos.add(curso.paralelo);
        anotar(ev, estado);
        anotar(de(porDia, curso.dia, () => ({ etiqueta: DIAS_TEXTO[curso.dia], cursos: new Set() })), estado);
        porDia.get(curso.dia).cursos.add(curso.paralelo);
        const f = de(porFranja, franjaDe(curso), () => ({ etiqueta: franjaDe(curso), metodologias: new Set(), cursos: new Set() }));
        f.metodologias.add(curso.metodologia);
        f.cursos.add(curso.paralelo);
        anotar(f, estado);
        if (unCurso) {
          const g = grupos.get(s.id) ?? null;
          anotar(de(porGrupo, g ?? '—', () => ({ etiqueta: g === null ? 'Sin grupo' : `Grupo ${g}`, grupo: g })), estado);
        }
        const pe = de(porEstudiante, s.id, () => ({ estudiante: s, curso: curso.paralelo, faltasEn: [], retirosEn: [] }));
        anotar(pe, estado);
        if (estado === 'no_vino' || estado === 'salio') pe.faltasEn.push(e.codigo);
        if (estado === 'se_retiro_antes') pe.retirosEn.push(e.codigo);
      }
    }
  }
  const lista = (mapa, orden) => [...mapa.values()].map(conTasas).sort(orden);
  const ordenCursos = new Map(datos.map((d, i) => [d.curso.paralelo, i]));
  return {
    sesiones,
    abiertas,
    total: conTasas(total),
    porCurso: lista(porCurso, (a, b) => ordenCursos.get(a.clave) - ordenCursos.get(b.clave)),
    porEvento: lista(porEvento, porSemana).map((x) => ({ ...x, cursos: x.cursos.size })),
    porDia: lista(porDia, (a, b) => DIAS.indexOf(a.clave) - DIAS.indexOf(b.clave)).map((x) => ({ ...x, cursos: [...x.cursos] })),
    porFranja: lista(porFranja, (a, b) => a.clave.localeCompare(b.clave))
      .map((x) => ({ ...x, metodologias: METODOLOGIAS.filter((m) => x.metodologias.has(m)), cursos: [...x.cursos] })),
    porGrupo: unCurso ? lista(porGrupo, (a, b) => (a.grupo === null) - (b.grupo === null) || compararGrupos(a.grupo, b.grupo)) : null,
    porEstudiante: lista(porEstudiante, (a, b) => b.faltas - a.faltas || b.retiros - a.retiros || a.estudiante.nombre.localeCompare(b.estudiante.nombre, 'es')),
  };
}

// ---------- Rúbricas, etiquetas y notas de grupo (prácticas y talleres) ----------

function metricasRubricas(cfg, datos, delBimestre, notasCurso) {
  const porActividad = new Map();
  for (const { curso, ctx } of datos) {
    const marcadas = agruparPor(ctx.reg.etiquetas ?? [], (t) => `${t.evento}|${t.grupo}`);
    for (const e of ctx.eventos) {
      if (!['practica', 'taller'].includes(e.tipo) || !e.config || e.estado !== 'normal' || !delBimestre(e)) continue;
      const config = cfg.actividades[e.config];
      const clave = `${e.config}|${curso.metodologia}`;
      if (!porActividad.has(clave)) {
        porActividad.set(clave, {
          clave, actividad: e.config, codigo: e.codigo, tipo: e.tipo, titulo: e.titulo, metodologia: curso.metodologia, semana: e.semana,
          grupos: 0, penalizados: 0, notas: [], cursos: new Set(), etiquetas: new Map(),
          partes: new Map(rubrica(cfg, config).map((p) => [p.id, { ...p, conteo: new Map(p.escala.map((v) => [v, 0])), suma: 0, n: 0 }])),
          config,
        });
      }
      const a = porActividad.get(clave);
      a.semana = Math.min(a.semana, e.semana);
      for (const g of listaDeGrupos(gruposDe(ctx, e), ctx.reg.estudiantes).grupos) {
        const nota = notaGrupo(ctx, e, g.grupo);
        if (!nota.completo) continue;
        a.grupos += 1;
        a.notas.push(nota.valor);
        a.cursos.add(curso.paralelo);
        notasCurso(curso.paralelo, e.tipo).push(nota.valor);
        for (const t of marcadas.get(`${e.id}|${g.grupo}`) ?? []) a.etiquetas.set(t.etiqueta, (a.etiquetas.get(t.etiqueta) ?? 0) + 1);
        if (nota.penalizacion) { a.penalizados += 1; continue; }
        for (const p of nota.partes) {
          const parte = a.partes.get(p.id);
          if (!parte) continue;
          parte.conteo.set(p.valor, (parte.conteo.get(p.valor) ?? 0) + 1);
          parte.suma += p.valor / p.max;
          parte.n += 1;
        }
      }
    }
  }
  return [...porActividad.values()]
    .filter((a) => a.grupos > 0)
    .sort((a, b) => porSemana(a, b) || METODOLOGIAS.indexOf(a.metodologia) - METODOLOGIAS.indexOf(b.metodologia))
    .map((a) => ({
      clave: a.clave, actividad: a.actividad, codigo: a.codigo, tipo: a.tipo, titulo: a.titulo, metodologia: a.metodologia, semana: a.semana,
      grupos: a.grupos, penalizados: a.penalizados, cursos: a.cursos.size, media: promedio(a.notas), notas: a.notas,
      partes: [...a.partes.values()].map((p) => ({
        id: p.id, nombre: p.nombre, corto: p.corto, max: p.max,
        niveles: [...p.conteo.entries()].sort((x, y) => x[0] - y[0]).map(([nivel, n]) => ({ nivel, n })),
        n: p.n, media: p.n ? p.suma / p.n : null,
      })),
      etiquetas: listaEtiquetas(a.config.etiquetas, a.etiquetas, a.grupos, a.codigo, a.metodologia),
    }));
}

function listaEtiquetas(definidas = [], conteo, de, codigo, metodologia) {
  const porId = new Map((definidas ?? []).map((t) => [t.id, t]));
  return [...conteo.entries()]
    .filter(([id]) => porId.has(id))
    .map(([id, n]) => ({ id, texto: porId.get(id).texto, signo: porId.get(id).signo, n, de, proporcion: n / de, codigo, metodologia }))
    .sort((a, b) => b.n - a.n || a.texto.localeCompare(b.texto, 'es'));
}

// ---------- Trabajos en casa (TC) ----------

function metricasTrabajos(cfg, datos, delBimestre, notasCurso) {
  const porTC = new Map();
  for (const { curso, ctx } of datos) {
    for (const e of ctx.eventos) {
      if (!seCalificaTrabajo(e) || !delBimestre(e)) continue;
      const config = cfg.actividades[e.config];
      if (!porTC.has(e.config)) {
        porTC.set(e.config, {
          actividad: e.config, codigo: e.codigo, tipo: e.tipo, titulo: e.titulo, metodologia: curso.metodologia, semana: e.semana,
          unidad: config.unidad_calificacion === 'estudiante' ? 'estudiantes' : 'grupos',
          porCalificar: 0, calificados: 0, noEntregaron: 0, pendientes: 0, notas: [], cursos: new Set(), etiquetas: new Map(),
          preguntas: new Map(config.preguntas.map((p) => [p.id, { id: p.id, texto: p.texto, max: Math.max(...p.puntajes), suma: 0, n: 0 }])),
          config,
        });
      }
      const t = porTC.get(e.config);
      t.semana = Math.min(t.semana, e.semana);
      for (const u of unidadesDelTrabajo(ctx, e)) {
        if (!u.porCalificar) continue;
        t.porCalificar += 1;
        const n = u.nota;
        if (!n.registrado || !n.completo) { t.pendientes += 1; continue; }
        t.cursos.add(curso.paralelo);
        if (n.entregado === false) { t.noEntregaron += 1; t.notas.push(0); notasCurso(curso.paralelo, 'trabajo_casa').push(0); continue; }
        t.calificados += 1;
        t.notas.push(n.valor);
        notasCurso(curso.paralelo, 'trabajo_casa').push(n.valor);
        for (const id of n.etiquetas) t.etiquetas.set(id, (t.etiquetas.get(id) ?? 0) + 1);
        for (const p of n.partes) {
          const q = t.preguntas.get(p.id);
          if (q && p.valor !== null) { q.suma += p.valor / q.max; q.n += 1; }
        }
      }
    }
  }
  return [...porTC.values()]
    .filter((t) => t.porCalificar > 0)
    .sort(porSemana)
    .map((t) => ({
      actividad: t.actividad, codigo: t.codigo, tipo: t.tipo, titulo: t.titulo, metodologia: t.metodologia, semana: t.semana, unidad: t.unidad,
      porCalificar: t.porCalificar, calificados: t.calificados, noEntregaron: t.noEntregaron, pendientes: t.pendientes,
      cursos: t.cursos.size, media: promedio(t.notas), notas: t.notas,
      preguntas: [...t.preguntas.values()].map((q) => ({ id: q.id, texto: q.texto, n: q.n, media: q.n ? q.suma / q.n : null }))
        .sort((a, b) => (a.media ?? 2) - (b.media ?? 2)),
      etiquetas: listaEtiquetas(t.config.etiquetas, t.etiquetas, t.calificados, t.codigo, t.metodologia),
    }));
}

// ---------- Control oral ----------

function metricasControl(cfg, datos, bimestres, delBimestre, hoy) {
  const co = cfg.controlOral;
  const cobertura = [];
  const escala = [...co.escala_pregunta].sort((a, b) => a - b);
  const respuestas = new Map(escala.map((v) => [v, 0]));
  const aprobacion = { aprobados: 0, noAprobados: 0 };
  const conceptos = new Map();
  const notas = [];
  let controles = 0; let salieron = 0; let sinConcepto = 0;
  for (const { curso, ctx, est } of datos) {
    for (const b of bimestres) {
      const sesiones = sesionesDeControl(ctx, b);
      const realizadas = sesiones.filter((e) => ctx.pases.get(e.id)?.cerrado);
      if (!realizadas.length) continue;
      const con = conControlEnBimestre(ctx, b);
      const conControl = est.filter((s) => con.has(s.id)).length;
      cobertura.push({
        curso: curso.paralelo, metodologia: curso.metodologia, bimestre: b, total: est.length, conControl,
        cobertura: est.length ? conControl / est.length : null, realizadas: realizadas.length,
        quedan: sesiones.filter((e) => e.fecha >= hoy && !ctx.pases.get(e.id)?.cerrado).length,
      });
    }
    const califica = controlCalifica(cfg, curso.metodologia);
    const filasPorEvento = agruparPor(ctx.reg.controles ?? [], 'evento');
    for (const e of ctx.eventos) {
      if (!co.sesiones.includes(e.tipo) || !e.con_nota || e.estado !== 'normal' || !delBimestre(e)) continue;
      const textos = new Map(((e.config && cfg.actividades[e.config]?.conceptos_control) || []).map((c) => [c.id, c.texto]));
      const anotarConcepto = (id, valor) => {
        if (!id || !textos.has(id)) { sinConcepto += 1; return; }
        const clave = `${curso.metodologia}|${e.codigo}|${id}`;
        if (!conceptos.has(clave)) {
          conceptos.set(clave, { clave, codigo: e.codigo, id, texto: textos.get(id), metodologia: curso.metodologia, califica, semana: e.semana, suma: 0, n: 0 });
        }
        const c = conceptos.get(clave);
        c.suma += valor;
        c.n += 1;
      };
      for (const fila of filasPorEvento.get(e.id) ?? []) {
        const s = ctx.estudiantePorId.get(fila.estudiante);
        if (!s || s.estado === 'visitante') continue;
        const n = notaControl(ctx, e, fila.estudiante);
        if (n.estado !== 'calculada') continue;
        controles += 1;
        if (n.salio) { salieron += 1; continue; }
        if (califica) {
          notas.push(n.valor);
          const max = Math.max(...escala);
          (fila.puntajes ?? []).forEach((p, i) => {
            if (p === null || p === undefined) return;
            respuestas.set(p, (respuestas.get(p) ?? 0) + 1);
            anotarConcepto(fila.conceptos?.[i], p / max);
          });
        } else {
          aprobacion[n.aprobado ? 'aprobados' : 'noAprobados'] += 1;
          anotarConcepto(fila.conceptos?.[0], n.aprobado ? 1 : 0);
        }
      }
    }
  }
  return {
    cobertura,
    controles,
    salieron,
    media: promedio(notas),
    respuestas: escala.map((nivel) => ({ nivel, n: respuestas.get(nivel) })),
    aprobacion,
    conceptos: [...conceptos.values()]
      .map((c) => ({ ...c, media: c.n ? c.suma / c.n : null }))
      .sort((a, b) => METODOLOGIAS.indexOf(a.metodologia) - METODOLOGIAS.indexOf(b.metodologia) || a.semana - b.semana || a.media - b.media),
    sinConcepto,
  };
}

// ---------- Trabajo preparatorio (Clásica) ----------

function metricasPreparatorio(cfg, datos, delBimestre, notasCurso) {
  const p = cfg.preparatorio;
  const escala = [...p.escala].sort((a, b) => b - a);
  const porEvento = new Map();
  for (const { curso, ctx, est } of datos) {
    if (!preparatorioCalifica(cfg, curso.metodologia)) continue;
    for (const e of ctx.eventos) {
      if (!p.aplica_a.includes(e.tipo) || !e.con_nota || e.estado !== 'normal' || !delBimestre(e) || !ctx.pases.get(e.id)?.cerrado) continue;
      if (!porEvento.has(e.codigo)) porEvento.set(e.codigo, { codigo: e.codigo, tipo: e.tipo, semana: e.semana, niveles: new Map(escala.map((v) => [v, 0])), faltas: 0, n: 0, suma: 0, cursos: new Set() });
      const x = porEvento.get(e.codigo);
      x.semana = Math.min(x.semana, e.semana);
      x.cursos.add(curso.paralelo);
      for (const s of est) {
        const asis = asistenciaDe(ctx, e, s.id);
        if (asis.estado === null) continue;
        if (asis.falta) { x.faltas += 1; continue; }
        const r = notaPreparatorio(ctx, e, s.id);
        if (r.estado !== 'calculada') continue;
        x.niveles.set(r.nivel, (x.niveles.get(r.nivel) ?? 0) + 1);
        x.n += 1;
        x.suma += r.valor;
        notasCurso(curso.paralelo, 'preparatorio').push(r.valor);
      }
    }
  }
  return [...porEvento.values()].sort(porSemana).map((x) => ({
    codigo: x.codigo, tipo: x.tipo, semana: x.semana, cursos: x.cursos.size, n: x.n, faltas: x.faltas, media: x.n ? x.suma / x.n : null,
    niveles: escala.map((nivel) => ({ nivel, n: x.niveles.get(nivel) })),
  }));
}

// ---------- Feriados y sesiones sin clase ----------

function metricasFeriados(cfg, datos, bimestres, delBimestre) {
  const tiposControl = cfg.controlOral.sesiones;
  const cursos = datos.map(({ curso, ctx }) => {
    const perdidas = ctx.eventos.filter((e) => e.sesion && e.estado !== 'normal' && delBimestre(e));
    const recuperaciones = agruparPor(ctx.reg.recuperaciones ?? [], 'evento');
    const eventos = perdidas.map((e) => {
      const tc = ctx.eventos.find((t) => t.tipo === 'trabajo_casa' && t.practica === e.id && t.con_nota);
      const recs = [...(recuperaciones.get(e.id) ?? []), ...(tc ? recuperaciones.get(tc.id) ?? [] : [])];
      return {
        codigo: e.codigo, tipo: e.tipo, semana: e.semana, estado: e.estado, motivo: e.motivo, conNota: e.con_nota, tc: tc?.codigo ?? null,
        recuperaciones: { realizadas: recs.filter((r) => r.estado === 'realizada').length, solicitadas: recs.filter((r) => r.estado === 'solicitada').length },
      };
    });
    const control = bimestres.map((b) => ({
      bimestre: b,
      previstas: ctx.eventos.filter((e) => tiposControl.includes(e.tipo) && e.con_nota && e.bimestre === b).length,
      disponibles: sesionesDeControl(ctx, b).length,
    }));
    return { curso: curso.paralelo, metodologia: curso.metodologia, eventos, control };
  });
  const afectados = cursos.filter((c) => c.eventos.length);
  return {
    cursos: afectados,
    sinPerdidas: cursos.length - afectados.length,
    total: cursos.length,
    sesiones: afectados.reduce((s, c) => s + c.eventos.length, 0),
    conNota: afectados.reduce((s, c) => s + c.eventos.filter((e) => e.conNota).length, 0),
    recuperadas: afectados.reduce((s, c) => s + c.eventos.reduce((x, e) => x + e.recuperaciones.realizadas, 0), 0),
  };
}

// ---------- Estudiantes y grupos en riesgo (vista del profesor) ----------

function metricasRiesgo(cfg, datos, bimestres, delBimestre, hoy) {
  const r = cfg.metricas.riesgo;
  const estudiantes = [];
  const grupos = [];
  for (const { curso, ctx, est } of datos) {
    const sesiones = ctx.eventos.filter((e) => ['practica', 'taller'].includes(e.tipo) && e.con_nota && e.estado === 'normal' && delBimestre(e) && ctx.pases.get(e.id)?.cerrado);
    const avisos = bimestres.map((b) => avisoControlCierre(ctx, b, hoy)).filter(Boolean);
    for (const s of est) {
      const motivos = [];
      const faltas = sesiones.filter((e) => asistenciaDe(ctx, e, s.id).falta).map((e) => e.codigo);
      if (faltas.length >= r.faltas) motivos.push({ tipo: 'faltas', texto: `${faltas.length} faltas (${faltas.join(', ')})` });
      // Rendimiento: lo proyectado sobre lo posible en los componentes con algo evaluado; solo con varias actividades
      // con nota (con una sola, una falta deja el componente en 0 y la proyección exagera).
      let proyectada = 0; let valor = 0; let actividades = 0;
      for (const b of bimestres) {
        for (const c of notaBimestre(ctx, s.id, b).componentes) {
          if (c.proyectada !== null) { proyectada += c.proyectada; valor += c.valor; }
          actividades += (c.items ?? []).filter((i) => i.estado === 'calculada').length;
        }
      }
      if (valor > 0 && actividades >= r.rendimiento_minimo_actividades && proyectada / valor < r.rendimiento_bajo) {
        motivos.push({ tipo: 'rendimiento', texto: `${Math.round((proyectada / valor) * 100)} % en lo evaluado`, valor: proyectada / valor });
      }
      for (const a of avisos) {
        if (a.sinControl.some((x) => x.id === s.id)) motivos.push({ tipo: 'control', texto: a.quedan ? `sin control oral (quedan ${a.quedan} sesiones)` : 'sin control oral al cierre' });
      }
      if (motivos.length) estudiantes.push({ estudiante: s, curso: curso.paralelo, motivos });
    }
    const porGrupo = new Map();
    for (const e of ctx.eventos) {
      if (!['practica', 'taller'].includes(e.tipo) || !e.config || e.estado !== 'normal' || !delBimestre(e)) continue;
      for (const g of listaDeGrupos(gruposDe(ctx, e), ctx.reg.estudiantes).grupos) {
        const nota = notaGrupo(ctx, e, g.grupo);
        if (!nota.completo) continue;
        if (!porGrupo.has(g.grupo)) porGrupo.set(g.grupo, { notas: [], penalizaciones: [], integrantes: g.integrantes });
        const x = porGrupo.get(g.grupo);
        x.notas.push({ codigo: e.codigo, valor: nota.valor });
        if (nota.penalizacion) x.penalizaciones.push(e.codigo);
        x.integrantes = g.integrantes;   // los del evento más reciente
      }
    }
    for (const [grupo, x] of porGrupo) {
      const media = promedio(x.notas.map((n) => n.valor));
      const motivos = [];
      if (x.notas.length >= r.grupo_minimo_actividades && media < r.grupo_bajo) motivos.push({ tipo: 'nota', texto: `promedio ${Math.round(media * 100)} % en ${x.notas.length} actividades` });
      if (x.penalizaciones.length) motivos.push({ tipo: 'penalizacion', texto: `penalización total en ${x.penalizaciones.join(', ')}` });
      if (motivos.length) grupos.push({ curso: curso.paralelo, grupo, media, n: x.notas.length, motivos, integrantes: x.integrantes });
    }
  }
  const cuenta = (tipo) => estudiantes.filter((e) => e.motivos.some((m) => m.tipo === tipo)).length;
  grupos.sort((a, b) => a.curso.localeCompare(b.curso) || compararGrupos(a.grupo, b.grupo));
  return {
    estudiantes,
    grupos,
    conteo: { estudiantes: estudiantes.length, faltas: cuenta('faltas'), rendimiento: cuenta('rendimiento'), control: cuenta('control'), grupos: grupos.length },
  };
}

// ---------- Advertencias obligatorias ----------

/** «La franja 07:00–09:00 solo tiene cursos SQI; las franjas … solo tienen cursos Clásica», o null si alguna mezcla. */
export function franjasDeUnaMetodologia(cfg, cursos) {
  const porFranja = new Map();
  for (const c of cursos) {
    const f = franjaDe(c);
    if (!porFranja.has(f)) porFranja.set(f, new Set());
    porFranja.get(f).add(c.metodologia);
  }
  if (new Set(cursos.map((c) => c.metodologia)).size < 2) return null;
  const solas = new Map();
  for (const [f, ms] of [...porFranja.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (ms.size !== 1) continue;
    const m = [...ms][0];
    if (!solas.has(m)) solas.set(m, []);
    solas.get(m).push(f);
  }
  if (!solas.size) return null;
  const texto = [...solas.entries()]
    .sort((a, b) => a[1].length - b[1].length)
    .map(([m, fs]) => `${fs.length === 1 ? 'la franja' : 'las franjas'} ${enLista(fs)} solo ${fs.length === 1 ? 'tiene' : 'tienen'} cursos ${nombreMetodologia(cfg, m)}`)
    .join('; ');
  return texto[0].toUpperCase() + texto.slice(1);
}

function advertencias(cfg, datos) {
  const a = cfg.metricas.advertencias;
  const lista = [];
  if (!datos.length) return lista;
  const n = Math.round(datos.reduce((s, d) => s + d.est.length, 0) / datos.length);
  lista.push({ id: 'muestras', texto: a.muestras.replace('{n}', n) });
  const franjas = franjasDeUnaMetodologia(cfg, datos.map((d) => d.curso));
  if (franjas) lista.push({ id: 'franjas', texto: a.franjas.replace('{detalle}', franjas) });
  if (new Set(datos.map((d) => d.curso.metodologia)).size > 1) lista.push({ id: 'metodologias', texto: a.metodologias });
  return lista;
}

// ---------- Tablero ----------

/**
 * Todas las métricas de un alcance ('todos', 'TRAD', 'SQI' o un paralelo) y un periodo: `periodo` (ver periodos.js:
 * día, semana, mes, bimestre o semestre) o, si no se da, `bimestre` (1, 2 o null = semestre).
 * `cursos`: lo que devuelve cargarCursos ([{ curso, reg, eventos }]). `hoy`: 'AAAA-MM-DD' (sesiones en curso y avisos).
 */
export function calcularMetricas(cfg, cursos, { alcance = 'todos', bimestre = null, periodo = null, hoy }) {
  periodo ??= bimestre ? periodoDe(cfg, 'bimestre', null, bimestre) : periodoDe(cfg, 'semestre');
  const datos = cursos
    .filter(({ curso }) => enAlcance(curso, alcance))
    .map(({ curso, reg, eventos }) => ({ curso, ctx: crearContexto(cfg, curso, eventos, reg), est: activos(reg.estudiantes) }))
    .filter((d) => d.est.length);
  const delBimestre = (e) => enPeriodo(periodo, e);
  // Bimestres del periodo (cobertura del control, riesgo): el elegido, los dos, o los de las fechas del periodo.
  const bimestres = periodo.tipo === 'bimestre' ? [periodo.bimestre] : periodo.tipo === 'semestre' ? [1, 2]
    : [...new Set([periodo.desde, periodo.hasta].map((f) => (f > cfg.semestre.fin_bimestre_1 ? 2 : 1)))];
  const unCurso = datos.length === 1 && alcance === datos[0].curso.paralelo;
  const metodologias = METODOLOGIAS.filter((m) => datos.some((d) => d.curso.metodologia === m));

  // Notas normalizadas por curso y tipo, para comparar cursos y metodologías.
  const notasPorCurso = new Map();
  const notasCurso = (paralelo, tipo) => {
    if (!notasPorCurso.has(paralelo)) notasPorCurso.set(paralelo, { practica: [], taller: [], trabajo_casa: [], preparatorio: [] });
    return notasPorCurso.get(paralelo)[tipo];
  };

  const asistencia = metricasAsistencia(datos, delBimestre, unCurso, hoy);
  const rubricas = metricasRubricas(cfg, datos, delBimestre, notasCurso);
  const trabajos = metricasTrabajos(cfg, datos, delBimestre, notasCurso);
  const control = metricasControl(cfg, datos, bimestres, delBimestre, hoy);
  const preparatorio = metricasPreparatorio(cfg, datos, delBimestre, notasCurso);
  const feriados = metricasFeriados(cfg, datos, bimestres, delBimestre);
  const riesgo = metricasRiesgo(cfg, datos, bimestres, delBimestre, hoy);

  // Evolución entre eventos: asistencia de cada sesión con nota y nota media, por metodología (no se mezclan).
  const evolucion = metodologias.map((m) => {
    const puntos = new Map();
    const punto = (x) => {
      if (!puntos.has(x.codigo)) puntos.set(x.codigo, { codigo: x.codigo, tipo: x.tipo, semana: x.semana, asistencia: null, nota: null, nNotas: 0, notas: [] });
      const p = puntos.get(x.codigo);
      p.semana = Math.min(p.semana, x.semana);
      return p;
    };
    const asisM = metricasAsistencia(datos.filter((d) => d.curso.metodologia === m), delBimestre, false, hoy);
    for (const x of asisM.porEvento) if (x.conNota) punto(x).asistencia = x.asistencia;
    for (const x of [...rubricas, ...trabajos]) if (x.metodologia === m) punto(x).notas.push(...x.notas);
    return {
      metodologia: m,
      puntos: [...puntos.values()].sort(porSemana).map(({ notas, ...p }) => ({ ...p, nota: promedio(notas), nNotas: notas.length })),
    };
  });

  const cursosComparados = datos.map(({ curso }) => {
    const n = notasPorCurso.get(curso.paralelo) ?? { practica: [], taller: [], trabajo_casa: [], preparatorio: [] };
    const cob = control.cobertura.filter((c) => c.curso === curso.paralelo).at(-1) ?? null;
    return {
      curso: curso.paralelo, metodologia: curso.metodologia, dia: DIAS_TEXTO[curso.dia], franja: franjaDe(curso),
      estudiantes: datos.find((d) => d.curso === curso).est.length,
      asistencia: asistencia.porCurso.find((x) => x.clave === curso.paralelo)?.asistencia ?? null,
      practicas: promedio(n.practica), talleres: promedio(n.taller), trabajos: promedio(n.trabajo_casa),
      preparatorio: promedio(n.preparatorio), cobertura: cob ? { bimestre: cob.bimestre, valor: cob.cobertura } : null,
      riesgo: riesgo.estudiantes.filter((e) => e.curso === curso.paralelo).length,
    };
  });

  // Comparación entre metodologías: solo componentes equivalentes (prácticas y talleres), normalizados.
  const comparacion = metodologias.length < 2 ? null : [
    { id: 'practicas', nombre: 'Prácticas', tipo: 'practica' },
    { id: 'talleres', nombre: 'Talleres', tipo: 'taller' },
  ].map((comp) => ({
    ...comp,
    porMetodologia: metodologias.map((m) => {
      const cursosM = datos.filter((d) => d.curso.metodologia === m).map((d) => d.curso.paralelo);
      const notas = cursosM.flatMap((p) => notasPorCurso.get(p)?.[comp.tipo] ?? []);
      return { metodologia: m, media: promedio(notas), grupos: notas.length, cursos: cursosM.filter((p) => (notasPorCurso.get(p)?.[comp.tipo] ?? []).length).length };
    }),
  }));

  const etiquetas = [...rubricas, ...trabajos].flatMap((x) => x.etiquetas)
    .sort((a, b) => b.proporcion - a.proporcion || b.n - a.n)
    .slice(0, cfg.metricas.etiquetas_maximo);

  return {
    alcance,
    bimestre: periodo.bimestre,
    periodo,
    unCurso,
    metodologias,
    cursos: datos.map((d) => d.curso.paralelo),
    vacio: asistencia.sesiones === 0 && !rubricas.length && !trabajos.length,
    generales: {
      cursos: datos.length,
      estudiantes: datos.reduce((s, d) => s + d.est.length, 0),
      sesiones: asistencia.sesiones,
      abiertas: asistencia.abiertas,
      asistencia: asistencia.total.asistencia,
      grupos: rubricas.reduce((s, r) => s + r.grupos, 0),
      trabajos: trabajos.reduce((s, t) => s + t.calificados + t.noEntregaron, 0),
      controles: control.controles,
    },
    advertencias: [
      ...(asistencia.abiertas ? [{ id: 'en_curso', texto: `${asistencia.abiertas === 1 ? 'Una sesión tiene' : `${asistencia.abiertas} sesiones tienen`} el pase abierto: su asistencia es provisional (quien está en un grupo cuenta como presente) hasta cerrarlo.` }] : []),
      ...advertencias(cfg, datos),
    ],
    asistencia,
    evolucion,
    rubricas,
    etiquetas,
    trabajos,
    control,
    preparatorio,
    feriados,
    cursosComparados,
    comparacion,
    riesgo,
  };
}
