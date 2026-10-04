// Motor de notas: casos mínimos del §4 del plan y de la Fase 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generarEventos } from '../src/nucleo/calendario.js';
import {
  crearContexto, notaBimestre, notaControl, notaEvento, notaGrupo, notaPreparatorio, notaTrabajo, resumenEvento,
} from '../src/nucleo/motor.js';
import { redondear } from '../src/nucleo/util.js';
import { configReal, copia } from './ayudas.js';

const cfg = configReal();
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);

/** Escenario de prueba: un curso, sus estudiantes (id → grupo del Excel) y lo registrado. */
function escenario(paralelo, grupos, { estados = {}, cfgUsada = cfg, cambios = [] } = {}) {
  const curso = cfgUsada.cursoPorId[paralelo];
  const eventos = generarEventos(cfgUsada, curso, cambios);
  const reg = {
    estudiantes: Object.entries(grupos).map(([id, g]) => ({
      id, codigo: id, nombre: `ESTUDIANTE ${id}`, curso: paralelo, estado: estados[id] ?? 'nomina', grupo_excel: g,
    })),
    grupos_evento: [], asistencia: [], pases: [], revisiones_grupo: [], puntajes: [], etiquetas: [], notas: [],
    controles: [], revision_preparatorio: [], novedades_preparatorio: [], ajustes: [], cambios_evento: cambios,
    trabajos_casa: [], recuperaciones: [], plic: [],
  };
  const e = (codigo) => eventos.find((x) => x.codigo === codigo);
  const id = (codigo) => `${paralelo}:${codigo}`;
  const api = {
    curso, eventos, reg, e,
    /** Pase cerrado: todos presentes salvo los indicados ({ id: 'no_vino' | 'salio' | 'se_retiro_antes' }). */
    pase(codigo, excepciones = {}) {
      for (const est of reg.estudiantes) {
        reg.asistencia.push({ evento: id(codigo), estudiante: est.id, estado: excepciones[est.id] ?? 'presente', motivo: null, observacion: null });
      }
      reg.pases.push({ evento: id(codigo), cerrado: true });
      return api;
    },
    puntos(codigo, grupo, valores) {
      for (const [aspecto, valor] of Object.entries(valores)) reg.puntajes.push({ evento: id(codigo), grupo, aspecto, valor });
      return api;
    },
    ctx: () => crearContexto(cfgUsada, curso, eventos, reg),
  };
  return api;
}

test('SQI P1: grupo con 4/5 → 0.8 × 0.60 = 0.48 puntos en Prácticas', () => {
  const s = escenario('GR1AA', { a: '1', b: '1', c: '1' }).pase('P1').puntos('P1', '1', { resp_pred_plan: 2, ejec_registro: 1, discusion: 1 });
  const ctx = s.ctx();
  cerca(notaGrupo(ctx, s.e('P1'), '1').valor, 0.8);
  const practicas = notaBimestre(ctx, 'a', 1).componentes.find((c) => c.id === 'practicas');
  cerca(practicas.acumulada, 0.48);
  cerca(practicas.proyectada, 2.4, 'proyectada: 0.8 × 3');
});

test('TC1 del grupo con 8.5/10 → 0.85 × 0.80 = 0.68 para cada integrante presente en P1', () => {
  const s = escenario('GR1AA', { a: '1', b: '1', c: '1' }).pase('P1');
  s.reg.trabajos_casa.push({ evento: 'GR1AA:TC1', unidad: 'grupo', unidad_id: '1', entregado: true,
    puntajes: { '1a': 1, '1b': 2, '2a-i': 1, '2a-ii': 0.5, '2b-i': 1, '2b-ii': 1, '2c': 1, '2d': 1 } });
  const ctx = s.ctx();
  cerca(notaEvento(ctx, s.e('TC1'), 'b').valor, 0.85);
  const tc = notaBimestre(ctx, 'b', 1).componentes.find((c) => c.id === 'trabajos_casa');
  cerca(tc.acumulada, 0.68);
});

test('SQI: quien «no vino» a P1 tiene 0 en P1 y 0 en TC1, aunque su grupo tenga nota', () => {
  const s = escenario('GR1AA', { a: '1', b: '1', c: '1' }).pase('P1', { c: 'no_vino' })
    .puntos('P1', '1', { resp_pred_plan: 2, ejec_registro: 2, discusion: 1 });
  s.reg.trabajos_casa.push({ evento: 'GR1AA:TC1', unidad: 'grupo', unidad_id: '1', entregado: true,
    puntajes: { '1a': 1, '1b': 2, '2a-i': 1, '2a-ii': 1, '2b-i': 1, '2b-ii': 1, '2c': 1, '2d': 2 } });
  const ctx = s.ctx();
  assert.equal(notaEvento(ctx, s.e('P1'), 'a').valor, 1);
  const p1 = notaEvento(ctx, s.e('P1'), 'c');
  const tc1 = notaEvento(ctx, s.e('TC1'), 'c');
  assert.deepEqual([p1.valor, p1.motivo], [0, 'no vino']);
  assert.deepEqual([tc1.valor, tc1.motivo], [0, 'no vino en la práctica']);
});

/** Fila de un TC (por grupo, salvo que se indique la unidad). */
const tc = (codigo, unidadId, puntajes, otros = {}) => ({
  evento: `GR1AA:${codigo}`, unidad: 'grupo', unidad_id: unidadId, entregado: true, puntajes, etiquetas: [], ...otros,
});
const TC1_COMPLETO = { '1a': 1, '1b': 2, '2a-i': 1, '2a-ii': 1, '2b-i': 1, '2b-ii': 1, '2c': 1, '2d': 2 };

test('TC1: componente = 40 % de 2 puntos = 0.80 como máximo; con TC1, TC2 y TC3 se pondera 40/25/35', () => {
  const s = escenario('GR1AA', { a: '1', b: '2' }).pase('P1').pase('P2').pase('P3');
  s.reg.trabajos_casa.push(tc('TC1', '1', TC1_COMPLETO));
  const comp = (ctx, id) => notaBimestre(ctx, id, 1).componentes.find((c) => c.id === 'trabajos_casa');
  let t = comp(s.ctx(), 'a');
  cerca(t.acumulada, 0.8, 'TC1 completo: 0.4 × 1 × 2');
  cerca(t.proyectada, 2, 'proyectada sobre lo ya calificado');
  assert.equal(t.completo, false);
  // Grupo 2 sin calificar: su TC1 queda pendiente y no suma.
  const b = notaEvento(s.ctx(), s.e('TC1'), 'b');
  assert.deepEqual([b.estado, b.motivo], ['pendiente', 'falta calificar el grupo 2']);
  // TC2 = 2 + 1.5 + 0 + 3 = 6.5/10 y TC3 = 10/10.
  s.reg.trabajos_casa.push(tc('TC2', '1', { 1: 2, '2a-i': 1.5, '2a-ii': 0, '2b': 3 }));
  s.reg.trabajos_casa.push(tc('TC3', '1', { '1a': 1, '1b': 2, '2a': 2, '2b': 3, '2c': 2 }));
  t = comp(s.ctx(), 'a');
  assert.equal(t.completo, true);
  cerca(t.proyectada, (0.4 * 1 + 0.25 * 0.65 + 0.35 * 1) * 2);
  cerca(t.acumulada, t.proyectada);
});

test('TC: «no entregó» vale 0 para los presentes en la práctica; quien faltó a la práctica tiene 0 por su falta', () => {
  const s = escenario('GR1AA', { a: '1', b: '1', c: '1' }).pase('P1', { c: 'no_vino' });
  s.reg.trabajos_casa.push(tc('TC1', '1', { '1a': 1, '1b': 2 }, { entregado: false }));
  const ctx = s.ctx();
  const a = notaEvento(ctx, s.e('TC1'), 'a');
  assert.deepEqual([a.estado, a.valor, a.motivo], ['calculada', 0, 'no entregó']);
  assert.deepEqual([notaEvento(ctx, s.e('TC1'), 'c').valor, notaEvento(ctx, s.e('TC1'), 'c').motivo], [0, 'no vino en la práctica']);
  const t = notaTrabajo(ctx, s.e('TC1'), '1');
  assert.deepEqual([t.registrado, t.entregado, t.completo, t.valor, t.puntos], [true, false, true, 0, 0], 'los puntajes se conservan, pero no cuentan');
});

test('TC: preguntas sin calificar dejan la nota pendiente; sin el pase de la práctica, también', () => {
  const s = escenario('GR1AA', { a: '1' });
  const { '2d': _, ...sin2d } = TC1_COMPLETO;
  s.reg.trabajos_casa.push(tc('TC1', '1', sin2d));
  let n = notaEvento(s.ctx(), s.e('TC1'), 'a');
  assert.deepEqual([n.estado, n.motivo], ['pendiente', 'falta cerrar el pase de la práctica']);
  assert.ok(resumenEvento(s.ctx(), s.e('TC1')).avisos.some((x) => x.startsWith('El pase de P1 no está cerrado')));
  s.pase('P1');
  n = notaEvento(s.ctx(), s.e('TC1'), 'a');
  assert.deepEqual([n.estado, n.motivo], ['pendiente', 'falta 1 pregunta por calificar']);
  const t = notaTrabajo(s.ctx(), s.e('TC1'), '1');
  assert.deepEqual([t.puntos, t.faltan], [8, ['2d']]);
  assert.deepEqual(resumenEvento(s.ctx(), s.e('TC1')).avisos, []);
});

test('TC individual (unidad configurable): cada estudiante con su propio trabajo', () => {
  const cfgInd = copia(cfg);
  cfgInd.actividades['TC1-SQI'].unidad_calificacion = 'estudiante';
  const s = escenario('GR1AA', { a: '1', b: '1' }, { cfgUsada: cfgInd }).pase('P1');
  s.reg.trabajos_casa.push(tc('TC1', 'a', TC1_COMPLETO, { unidad: 'estudiante' }));
  s.reg.trabajos_casa.push(tc('TC1', '1', TC1_COMPLETO));   // una fila por grupo no cuenta en un TC individual
  const ctx = s.ctx();
  assert.equal(notaEvento(ctx, s.e('TC1'), 'a').valor, 1);
  assert.deepEqual([notaEvento(ctx, s.e('TC1'), 'b').estado, notaEvento(ctx, s.e('TC1'), 'b').motivo], ['pendiente', 'falta calificar su trabajo']);
});

test('TC6 no tiene nota y no entra en el componente; un ajuste individual también vale en un TC', () => {
  const s = escenario('GR1AA', { a: '1' }).pase('P1').pase('P6');
  assert.equal(notaEvento(s.ctx(), s.e('TC6'), 'a').estado, 'sin_nota');
  const items = notaBimestre(s.ctx(), 'a', 2).componentes.find((c) => c.id === 'trabajos_casa').items.map((i) => i.codigo);
  assert.deepEqual(items, ['TC4', 'TC5', 'TC7']);
  s.reg.trabajos_casa.push(tc('TC1', '1', TC1_COMPLETO));
  s.reg.ajustes.push({ evento: 'GR1AA:TC1', estudiante: 'a', valor: 0.5, motivo: 'No participó en el TC' });
  const n = notaEvento(s.ctx(), s.e('TC1'), 'a');
  assert.deepEqual([n.valor, n.valor_sin_ajuste, n.motivo], [0.5, 1, 'ajuste: No participó en el TC']);
});

test('Clásica: diseño 3/4, datos 4/4 y análisis 2/4 → 0.15 + 0.30 + 0.25 = 0.70', () => {
  const s = escenario('GR2QB', { a: '1', b: '1' }).pase('P1').puntos('P1', '1', { diseno: 3, datos: 4, analisis: 2 });
  cerca(notaGrupo(s.ctx(), s.e('P1'), '1').valor, 0.7);
  cerca(notaEvento(s.ctx(), s.e('P1'), 'b').valor, 0.7);
});

test('Clásica: un grupo sin todas las secciones evaluadas queda pendiente', () => {
  const s = escenario('GR2QB', { a: '1' }).pase('P1').puntos('P1', '1', { diseno: 3, datos: 4 });
  const n = notaEvento(s.ctx(), s.e('P1'), 'a');
  assert.deepEqual([n.estado, n.motivo], ['pendiente', 'falta evaluar el grupo 1']);
  assert.deepEqual(notaGrupo(s.ctx(), s.e('P1'), '1').faltan, ['Análisis']);
});

test('Taller: asistencia completa y evaluación integral 1/2 → 0.75', () => {
  const s = escenario('GR2QB', { a: '1' }).pase('T1').puntos('T1', '1', { integral: 1 });
  cerca(notaEvento(s.ctx(), s.e('T1'), 'a').valor, 0.75);
});

test('Taller: «se retiró antes» con evaluación integral 2/2 → 0.5 × 0.5 + 0.5 × 1 = 0.75', () => {
  const s = escenario('GR2QB', { a: '1', b: '1' }).pase('T1', { a: 'se_retiro_antes' }).puntos('T1', '1', { integral: 2 });
  const n = notaEvento(s.ctx(), s.e('T1'), 'a');
  cerca(n.valor, 0.75);
  assert.equal(n.motivo, 'se retiró antes');
  cerca(notaEvento(s.ctx(), s.e('T1'), 'b').valor, 1);
});

test('Grupo con nota 0.9; un integrante «salió» tras el control → 0 para él, 0.9 para los demás', () => {
  const s = escenario('GR2QB', { a: '1', b: '1', c: '1' }).puntos('P1', '1', { diseno: 2, datos: 4, analisis: 4 }); // 0.1 + 0.3 + 0.5
  s.pase('P1', { c: 'salio' });
  s.reg.asistencia.find((x) => x.estudiante === 'c').motivo = 'no preparado en el control';
  s.reg.controles.push({ evento: 'GR2QB:P1', estudiante: 'c', estado: 'salio', puntajes: [0] });
  const ctx = s.ctx();
  cerca(notaEvento(ctx, s.e('P1'), 'a').valor, 0.9);
  const c = notaEvento(ctx, s.e('P1'), 'c');
  assert.deepEqual([c.valor, c.motivo], [0, 'salió (no preparado en el control)']);
  // «Salió» cuenta como control con nota 0 (configurable) y deja el preparatorio en 0.
  assert.deepEqual(notaControl(ctx, s.e('P1'), 'c').valor, 0);
  assert.equal(notaPreparatorio(ctx, s.e('P1'), 'c').nivel, 0);
});

test('Estudiante movido de grupo en la sesión: recibe la nota del grupo nuevo', () => {
  const s = escenario('GR2QB', { a: '1', b: '1', m: '1', x: '2' });
  for (const [estudiante, grupo] of Object.entries({ a: '1', b: '1', m: '2', x: '2' })) {
    s.reg.grupos_evento.push({ evento: 'GR2QB:P1', estudiante, grupo });
  }
  s.pase('P1').puntos('P1', '1', { diseno: 4, datos: 4, analisis: 4 }).puntos('P1', '2', { diseno: 2, datos: 2, analisis: 2 });
  const ctx = s.ctx();
  assert.equal(notaEvento(ctx, s.e('P1'), 'm').grupo, '2');
  cerca(notaEvento(ctx, s.e('P1'), 'm').valor, 0.5);
  // El cambio pasa al evento siguiente (T1 hereda los grupos de P1).
  assert.equal(notaEvento(ctx, s.e('T1'), 'm').grupo, '2');
});

test('Clásica que perdió el T2 por feriado: T1 = 1.0 y T3 = 0.75 → Talleres = 0.875', () => {
  const s = escenario('GR2QB', { a: '1' }).pase('T1').puntos('T1', '1', { integral: 2 }).pase('T3').puntos('T3', '1', { integral: 1 });
  // T2 y T3 aún no tienen configuración de taller: se usa la del T1 para la prueba.
  const cfg2 = copia(cfg);
  for (const c of ['T2', 'T3']) cfg2.actividades[c] = { ...copia(cfg.actividades.T1), id: c, codigo: c };
  const s2 = escenario('GR2QB', { a: '1' }, { cfgUsada: cfg2 });
  Object.assign(s2.reg, s.reg);
  assert.equal(s2.e('T2').estado, 'feriado');
  const talleres = notaBimestre(s2.ctx(), 'a', 1).componentes.find((c) => c.id === 'talleres');
  cerca(talleres.acumulada, 0.875);
  assert.ok(talleres.observaciones.some((o) => o.includes('Día de los Difuntos')));
});

test('Mismo curso: el estudiante que recuperó el T2 con 0.5 → Talleres = (1.0 + 0.5 + 0.75) / 3 = 0.75', () => {
  const cfg2 = copia(cfg);
  for (const c of ['T2', 'T3']) cfg2.actividades[c] = { ...copia(cfg.actividades.T1), id: c, codigo: c };
  const s = escenario('GR2QB', { a: '1', b: '1' }, { cfgUsada: cfg2 }).pase('T1').puntos('T1', '1', { integral: 2 }).pase('T3').puntos('T3', '1', { integral: 1 });
  s.reg.recuperaciones.push({ evento: 'GR2QB:T2', estudiante: 'a', estado: 'realizada', nota: 0.5 });
  const ctx = s.ctx();
  cerca(notaBimestre(ctx, 'a', 1).componentes.find((c) => c.id === 'talleres').acumulada, 0.75);
  cerca(notaBimestre(ctx, 'b', 1).componentes.find((c) => c.id === 'talleres').acumulada, 0.875, 'quien no recuperó');
});

test('Planificación y conocimiento: preparatorios con promedio 1.0 y control 0.5 → 1.05', () => {
  const s = escenario('GR2QB', { a: '1' });
  for (const c of ['P1', 'T1', 'P2', 'P3', 'T3']) {
    s.pase(c);
    s.reg.revision_preparatorio.push({ evento: `GR2QB:${c}`, revisada: true });
  }
  s.reg.controles.push({ evento: 'GR2QB:P2', estudiante: 'a', estado: 'respondio', puntajes: [1, 1] });
  const pyc = notaBimestre(s.ctx(), 'a', 1).componentes.find((c) => c.id === 'planificacion_conocimiento');
  cerca(pyc.promedios.preparatorio, 1);
  cerca(pyc.promedios.control, 0.5);
  cerca(pyc.proyectada, 1.05);
  cerca(pyc.acumulada, 1.05);
});

test('El bimestre se cierra sin control; preparatorios con promedio 0.75 → 0.75 × 1.5 = 1.125 → 1.13, con observación', () => {
  const s = escenario('GR2QB', { a: '1' });
  for (const c of ['P1', 'T1', 'P2', 'P3', 'T3']) s.pase(c);
  // Dos sesiones con «incompleto» (1), dos con la revisión hecha (2) y una sin revisión ni novedad (pendiente).
  s.reg.novedades_preparatorio.push({ evento: 'GR2QB:P1', estudiante: 'a', nivel: 1 }, { evento: 'GR2QB:T1', estudiante: 'a', nivel: 1 });
  s.reg.revision_preparatorio.push({ evento: 'GR2QB:P2', revisada: true }, { evento: 'GR2QB:P3', revisada: true });
  const pyc = notaBimestre(s.ctx(), 'a', 1).componentes.find((c) => c.id === 'planificacion_conocimiento');
  cerca(pyc.promedios.preparatorio, 0.75);
  cerca(pyc.proyectada, 1.125);
  assert.equal(redondear(pyc.proyectada), 1.13);
  assert.ok(pyc.sinControl);
  assert.ok(pyc.observaciones.some((o) => o.includes('sin control oral')));
  assert.ok(pyc.observaciones.some((o) => o.includes('T3')), 'avisa del preparatorio pendiente');
});

test('Preparatorio con la revisión hecha: presente sin novedad 2/2, «incompleto» 1/2, ausente 0', () => {
  const s = escenario('GR2QB', { a: '1', b: '1', c: '1' }).pase('P1', { c: 'no_vino' });
  s.reg.revision_preparatorio.push({ evento: 'GR2QB:P1', revisada: true });
  s.reg.novedades_preparatorio.push({ evento: 'GR2QB:P1', estudiante: 'b', nivel: 1, no_ingresa: false });
  const ctx = s.ctx();
  assert.deepEqual([notaPreparatorio(ctx, s.e('P1'), 'a').nivel, notaPreparatorio(ctx, s.e('P1'), 'a').valor], [2, 1]);
  assert.deepEqual([notaPreparatorio(ctx, s.e('P1'), 'b').nivel, notaPreparatorio(ctx, s.e('P1'), 'b').valor], [1, 0.5]);
  assert.deepEqual([notaPreparatorio(ctx, s.e('P1'), 'c').nivel, notaPreparatorio(ctx, s.e('P1'), 'c').valor], [0, 0]);
});

test('Preparatorio de una sesión sin la revisión marcada: pendiente, no entra en el promedio y la app avisa', () => {
  const s = escenario('GR2QB', { a: '1', b: '1' }).pase('P1');
  s.reg.novedades_preparatorio.push({ evento: 'GR2QB:P1', estudiante: 'b', nivel: 0, no_ingresa: false });
  const ctx = s.ctx();
  const a = notaPreparatorio(ctx, s.e('P1'), 'a');
  assert.deepEqual([a.estado, a.motivo], ['pendiente', 'revisión del preparatorio sin marcar']);
  assert.equal(notaPreparatorio(ctx, s.e('P1'), 'b').nivel, 0, 'la novedad sí cuenta');
  const pyc = notaBimestre(ctx, 'a', 1).componentes.find((c) => c.id === 'planificacion_conocimiento');
  assert.equal(pyc.promedios.preparatorio, null);
  assert.ok(resumenEvento(ctx, s.e('P1')).avisos.some((x) => x.includes('revisión del preparatorio')));
  // Antes de cerrar el pase, nada se calcula.
  const s2 = escenario('GR2QB', { a: '1' });
  s2.reg.revision_preparatorio.push({ evento: 'GR2QB:P1', revisada: true });
  assert.equal(notaPreparatorio(s2.ctx(), s2.e('P1'), 'a').estado, 'pendiente');
});

test('Curso SQI sin P2 (caso hipotético) → Prácticas = (0.2 × P1 + 0.5 × P3) / 0.7 × 3', () => {
  const s = escenario('GR1AA', { a: '1' }, { cambios: [{ evento: 'GR1AA:P2', estado: 'sin_clase', motivo: 'Suspensión' }] });
  s.pase('P1').puntos('P1', '1', { resp_pred_plan: 2, ejec_registro: 1, discusion: 1 });   // 0.8
  const cfg3 = copia(cfg);
  cfg3.actividades['P3-SQI'] = { ...copia(cfg.actividades['P1-SQI']), id: 'P3-SQI', codigo: 'P3', aspectos_aplicables: cfg.sqi.porPractica.P3, indicadores: {}, etiquetas: [] };
  const s3 = escenario('GR1AA', { a: '1' }, { cfgUsada: cfg3, cambios: s.reg.cambios_evento });
  Object.assign(s3.reg, s.reg);
  s3.pase('P3').puntos('P3', '1', { resp_pred_plan: 2, ejec_registro: 2, analisis: 1, discusion: 1, comunicacion: 0 }); // 6/8
  const practicas = notaBimestre(s3.ctx(), 'a', 1).componentes.find((c) => c.id === 'practicas');
  cerca(practicas.acumulada, ((0.2 * 0.8 + 0.5 * 0.75) / 0.7) * 3);
  assert.equal(practicas.items.find((i) => i.codigo === 'P2').estado, 'excluido');
  // El TC2 también queda excluido (sigue a su práctica).
  assert.equal(notaBimestre(s3.ctx(), 'a', 1).componentes.find((c) => c.id === 'trabajos_casa').items.find((i) => i.codigo === 'TC2').estado, 'excluido');
});

test('Penalización total: el grupo queda con 0 en la práctica, con motivo', () => {
  const s = escenario('GR2QB', { a: '1', b: '2' }).pase('P1')
    .puntos('P1', '1', { diseno: 4, datos: 4, analisis: 4 }).puntos('P1', '2', { diseno: 4, datos: 4, analisis: 4 });
  s.reg.revisiones_grupo.push({ evento: 'GR2QB:P1', grupo: '1', penalizacion_total: true, motivo_penalizacion: 'No desmontó el equipo' });
  const ctx = s.ctx();
  const a = notaEvento(ctx, s.e('P1'), 'a');
  assert.deepEqual([a.valor, a.motivo], [0, 'penalización total (No desmontó el equipo)']);
  assert.equal(notaEvento(ctx, s.e('P1'), 'b').valor, 1);
});

test('Ajuste individual explícito: reemplaza la nota del evento y conserva la calculada y el motivo', () => {
  const s = escenario('GR2QB', { a: '1' }).pase('P1').puntos('P1', '1', { diseno: 4, datos: 4, analisis: 4 });
  s.reg.ajustes.push({ evento: 'GR2QB:P1', estudiante: 'a', valor: 0.6, motivo: 'Está pero no trabaja' });
  const n = notaEvento(s.ctx(), s.e('P1'), 'a');
  assert.deepEqual([n.valor, n.valor_sin_ajuste, n.motivo], [0.6, 1, 'ajuste: Está pero no trabaja']);
});

test('Estudiante pendiente de nómina: se calcula igual y queda marcado', () => {
  const s = escenario('GR4EB', { a: '1', p: '1' }, { estados: { p: 'pendiente' } }).pase('P1').puntos('P1', '1', { diseno: 4, datos: 2, analisis: 4 });
  const n = notaEvento(s.ctx(), s.e('P1'), 'p');
  cerca(n.valor, 0.85);
  assert.equal(n.pendiente_nomina, true);
});

test('Sin pase cerrado no se calculan notas; con el pase cerrado, quien no consta queda pendiente', () => {
  const s = escenario('GR2QB', { a: '1', b: '1' }).puntos('P1', '1', { diseno: 4, datos: 4, analisis: 4 });
  assert.deepEqual([notaEvento(s.ctx(), s.e('P1'), 'a').estado, notaEvento(s.ctx(), s.e('P1'), 'a').motivo], ['pendiente', 'falta cerrar el pase']);
  s.reg.asistencia.push({ evento: 'GR2QB:P1', estudiante: 'a', estado: 'presente' });
  s.reg.pases.push({ evento: 'GR2QB:P1', cerrado: true });
  assert.equal(notaEvento(s.ctx(), s.e('P1'), 'a').valor, 1);
  assert.deepEqual([notaEvento(s.ctx(), s.e('P1'), 'b').estado, notaEvento(s.ctx(), s.e('P1'), 'b').motivo], ['pendiente', 'no consta en el pase']);
});

test('Control oral: Clásica Σ/(2 × preguntas); varios controles → promedio; SQI aprobado sin nota', () => {
  const s = escenario('GR2QB', { a: '1' }).pase('P1').pase('T1');
  s.reg.controles.push({ evento: 'GR2QB:P1', estudiante: 'a', estado: 'respondio', puntajes: [2, 1, 0] });
  s.reg.controles.push({ evento: 'GR2QB:T1', estudiante: 'a', estado: 'respondio', puntajes: [2] });
  const ctx = s.ctx();
  cerca(notaControl(ctx, s.e('P1'), 'a').valor, 0.5);
  const pyc = notaBimestre(ctx, 'a', 1).componentes.find((c) => c.id === 'planificacion_conocimiento');
  cerca(pyc.promedios.control, 0.75);
  const q = escenario('GR1AA', { a: '1' }).pase('P1');
  q.reg.controles.push({ evento: 'GR1AA:P1', estudiante: 'a', estado: 'respondio', aprobado: true });
  const c = notaControl(q.ctx(), q.e('P1'), 'a');
  assert.deepEqual([c.estado, c.valor, c.aprobado], ['calculada', null, true]);
  // Sorteado pero sin respuesta, o «no está»: no cuenta como control.
  q.reg.controles[0] = { evento: 'GR1AA:P1', estudiante: 'a', estado: 'no_esta' };
  assert.equal(notaControl(q.ctx(), q.e('P1'), 'a').estado, 'no_esta');
});

test('Nota del bimestre Clásica: suma de componentes, acumulada y proyectada sin mezclarlas', () => {
  const s = escenario('GR2QB', { a: '1' }).pase('P1').puntos('P1', '1', { diseno: 4, datos: 4, analisis: 2 }); // 0.75
  s.reg.revision_preparatorio.push({ evento: 'GR2QB:P1', revisada: true });
  s.reg.controles.push({ evento: 'GR2QB:P1', estudiante: 'a', estado: 'respondio', puntajes: [2, 2] });
  const b = notaBimestre(s.ctx(), 'a', 1);
  assert.deepEqual(b.componentes.map((c) => c.id), ['planificacion_conocimiento', 'diseno_datos_analisis', 'talleres']);
  const dda = b.componentes[1];
  cerca(dda.acumulada, (0.75 / 3) * 3.5, 'P1 vale un tercio de 3.5');
  cerca(dda.proyectada, 0.75 * 3.5);
  assert.equal(b.proyectada, null, 'sin talleres evaluados no hay proyección total');
  assert.equal(b.completo, false);
  cerca(b.acumulada, b.componentes.reduce((x, c) => x + c.acumulada, 0));
});
