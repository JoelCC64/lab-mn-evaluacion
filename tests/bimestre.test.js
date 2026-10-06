// Nota bimestral y excepciones (Fase 6) contra la base: bimestres completos de Clásica y SQI comparados con el
// cálculo a mano (feriados, faltas, recuperación, estudiante sin control), PLIC, sesiones sin clase, estudiantes de
// otros cursos que recuperan aquí, pendientes antes del envío y hojas de coordinación.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cargarCursos } from '../src/datos/excel-datos.js';
import { planificarImportacion } from '../src/datos/importar.js';
import { exportarRespaldo } from '../src/datos/respaldo.js';
import {
  agregarAlControl, agregarVisitante, aprobarControl, cerrarPase, guardarNovedad, guardarPuntaje, guardarRecuperacion,
  marcarAsistencia, marcarEntrega, marcarHuboClase, marcarPlic, marcarPlicVarios, marcarRevisionPreparatorio, marcarSinClase,
  puntuarPregunta, puntuarTrabajo, quitarCambioEvento, quitarVisitante,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { activos, gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearContexto, notaBimestre, notaEvento, notaPreparatorio } from '../src/nucleo/motor.js';
import { candidatosSorteo } from '../src/nucleo/sorteo.js';
import { avisoControlCierre, bimestreEnCurso, pendientesDelBimestre } from '../src/nucleo/bimestre.js';
import { avanceEvaluacion } from '../src/nucleo/motor-vista.js';
import { estadoEvento } from '../src/nucleo/estado-evento.js';
import { textoParaSuProfesor, visitantesDelEvento } from '../src/nucleo/visitantes.js';
import { columnasDeLaApp, grupoActual, notaFinalDelBimestre, valoresDelEstudiante } from '../src/nucleo/resultados.js';
import { crearLibroRespaldo } from '../src/nucleo/respaldo-libro.js';
import { redondear } from '../src/nucleo/util.js';
import { configReal, copia } from './ayudas.js';

const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);
const AHORA = '2026-11-20T15:00:00.000Z';
const HOY = '2026-11-20';
const PROFESOR = 'Prof. Nombre Ficticio';   // ajuste del dispositivo (no está en la configuración)

/** Configuración real más P2, P3 (Clásica y SQI) y T2, T3, copiadas de P1 y T1 (sus guías aún no llegan). */
function configCompleta() {
  const c = copia(configReal());
  for (const cod of ['P2', 'P3']) {
    c.actividades[`${cod}-TRAD`] = { ...copia(c.actividades['P1-TRAD']), id: `${cod}-TRAD`, codigo: cod, etiquetas: [] };
    c.actividades[`${cod}-SQI`] = { ...copia(c.actividades['P1-SQI']), id: `${cod}-SQI`, codigo: cod, aspectos_aplicables: c.sqi.porPractica[cod], indicadores: {}, etiquetas: [] };
  }
  for (const cod of ['T2', 'T3']) c.actividades[cod] = { ...copia(c.actividades.T1), id: cod, codigo: cod, tareas: [], preguntas_discusion: [], etiquetas: [] };
  return c;
}
const cfg = configCompleta();
const SIN_GRUPO = cfg.asistencia.motivos.sin_grupo;

/** Curso con estudiantes ficticios en la base: `grupos` = { id: grupo }; `estados` = { id: 'pendiente' }. */
async function curso(paralelo, grupos, estados = {}) {
  const db = abrirBase(`bim-${randomUUID()}`);
  await db.estudiantes.bulkPut(Object.entries(grupos).map(([id, g], i) => ({
    id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} SEGUNDO NOMBRE${id.toUpperCase()}`,
    curso: paralelo, estado: estados[id] ?? 'nomina', grupo_excel: g, numero: i + 1,
  })));
  const c = cfg.cursoPorId[paralelo];
  const cargar = async () => {
    const reg = await registrosDelCurso(db, paralelo);
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return { reg, eventos, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  const evento = async (codigo) => (await cargar()).eventos.find((e) => e.codigo === codigo);
  const grupos_ = async (codigo) => { const { reg, eventos } = await cargar(); return gruposDelEvento(eventos.find((e) => e.codigo === codigo), eventos, reg).porEstudiante; };

  /** Una sesión completa: revisión en la puerta, controles, rúbrica de cada grupo, faltas y pase. */
  async function sesion(codigo, { niveles, faltan = [], retirados = [], novedades = [], controles = [] }) {
    const ev = await evento(codigo);
    const gr = await grupos_(codigo);
    await marcarRevisionPreparatorio(db, ev.id, true, AHORA);
    for (const [id, nivel] of novedades) await guardarNovedad(db, ev.id, id, { nivel }, cfg.preparatorio.motivo_no_ingresa, AHORA);
    for (const [id, r] of controles) {
      await agregarAlControl(db, ev.id, [id], {}, AHORA);
      if (Array.isArray(r)) for (const [i, p] of r.entries()) await puntuarPregunta(db, ev.id, id, i, p, AHORA);
      else await aprobarControl(db, ev.id, id, r, AHORA);
    }
    const config = cfg.actividades[ev.config];
    const partes = config.criterios ? config.criterios.map((x) => x.id) : config.aspectos_aplicables ?? ['integral'];
    for (const [grupo, n] of Object.entries(niveles)) for (const [i, p] of partes.entries()) await guardarPuntaje(db, ev.id, gr, grupo, p, n[i], AHORA);
    for (const id of faltan) await marcarAsistencia(db, ev.id, gr, id, 'no_vino', null, AHORA);
    for (const id of retirados) await marcarAsistencia(db, ev.id, gr, id, 'se_retiro_antes', null, AHORA);
    await cerrarPase(db, ev.id, gr, SIN_GRUPO, AHORA);
    return ev;
  }
  return { db, cargar, evento, grupos: grupos_, sesion };
}

/**
 * GR2QB (Clásica, cronograma A; el T2 cae en feriado) con el 1.er bimestre completo.
 * Grupo 1: a, b. Grupo 2: c, d y p (pendiente de nómina).
 */
async function clasicaB1() {
  const k = await curso('GR2QB', { a: '1', b: '1', c: '2', d: '2', p: '2' }, { p: 'pendiente' });
  await k.sesion('P1', { niveles: { 1: [4, 4, 2], 2: [3, 4, 4] }, novedades: [['a', 1]], controles: [['a', [2, 1]]] });
  await k.sesion('T1', { niveles: { 1: [2], 2: [1] }, controles: [['b', [2, 2]]] });
  await k.sesion('P2', { niveles: { 1: [4, 4, 4], 2: [2, 2, 2] }, faltan: ['d'] });
  await k.sesion('P3', { niveles: { 1: [3, 3, 3], 2: [4, 4, 4] }, faltan: ['b'], controles: [['d', [1, 1, 2]]] });
  await k.sesion('T3', { niveles: { 1: [1], 2: [2] }, retirados: ['c'] });
  // d faltó a P2 con justificación y recuperó en otra sesión con 8/10.
  await guardarRecuperacion(k.db, 'GR2QB:P2', 'd', { estado: 'realizada', nota: 0.8, detalle: 'GR3QA, jue 29 oct' }, AHORA);
  return k;
}

test('Clásica, 1.er bimestre completo: la nota de cada estudiante coincide con el cálculo a mano', async () => {
  const k = await clasicaB1();
  const { ctx } = await k.cargar();
  const nota = (id) => notaBimestre(ctx, id, 1);
  const comp = (id, c) => nota(id).componentes.find((x) => x.id === c);

  // a: preparatorios (1/2, 2, 2, 2, 2) → 0.9; control 3/4 → PyC = (0.4·0.9 + 0.6·0.75)·1.5 = 1.215.
  //    DDA = (0.75 + 1 + 0.75)/3 · 3.5 = 2.9167. Talleres = (1 + 0.75)/2 = 0.875 (T2 feriado). Total 5.0067.
  cerca(comp('a', 'planificacion_conocimiento').proyectada, 1.215);
  cerca(comp('a', 'diseno_datos_analisis').proyectada, (2.5 / 3) * 3.5);
  cerca(comp('a', 'talleres').proyectada, 0.875);
  // b: faltó a P3 → 0 en P3 y en su preparatorio. PyC = (0.4·0.8 + 0.6·1)·1.5 = 1.38; DDA = 1.75/3·3.5.
  cerca(comp('b', 'planificacion_conocimiento').proyectada, 1.38);
  cerca(comp('b', 'diseno_datos_analisis').proyectada, (1.75 / 3) * 3.5);
  // c: sin control oral en el bimestre → PyC solo con preparatorios = 1.5; se retiró antes del T3 (0.75).
  assert.equal(comp('c', 'planificacion_conocimiento').sinControl, true);
  cerca(comp('c', 'planificacion_conocimiento').proyectada, 1.5);
  cerca(comp('c', 'talleres').proyectada, 0.75);
  // d: recuperó P2 con 0.8 (su preparatorio de P2 no cuenta); control 4/6 → PyC = (0.4·1 + 0.6·2/3)·1.5 = 1.2.
  assert.equal(notaPreparatorio(ctx, ctx.eventoPorId.get('GR2QB:P2'), 'd').estado, 'excluido');
  cerca(comp('d', 'planificacion_conocimiento').proyectada, 1.2);
  cerca(comp('d', 'diseno_datos_analisis').proyectada, (2.75 / 3) * 3.5);

  const esperado = { a: 5.0066666667, b: 4.2966666667, c: 5.1083333333, d: 5.2833333333 };
  for (const [id, v] of Object.entries(esperado)) {
    cerca(nota(id).proyectada, v, `nota de ${id}`);
    assert.equal(nota(id).completo, id !== 'c', 'c no tuvo control: su PyC queda «incompleto», pero el bimestre cerró');
  }
  // En el Excel: la nota final con 2 decimales (redondeo usual), también para c (bimestre cerrado, solo preparatorios).
  assert.deepEqual(['a', 'b', 'c', 'd'].map((id) => redondear(notaFinalDelBimestre(ctx, id, 1), 2)), [5.01, 4.3, 5.11, 5.28]);
  const columnas = columnasDeLaApp(cfg, ctx.curso, ctx.eventos);
  const v = valoresDelEstudiante(ctx, columnas, 'c', { hoy: HOY, grupos: grupoActual(ctx) });
  assert.deepEqual([v.get('B1:planificacion_conocimiento'), v.get('B1:nota')], [1.5, 5.11]);
  assert.match(v.get('observaciones'), /B1: sin control oral/);
  assert.match(valoresDelEstudiante(ctx, columnas, 'd', { hoy: HOY, grupos: grupoActual(ctx) }).get('observaciones'), /P2: recuperada en otra sesión \(GR3QA, jue 29 oct\)/);
});

test('SQI, 1.er bimestre completo (GR1AA pierde el T2): prácticas 20/30/50, TC 40/25/35 y talleres', async () => {
  const k = await curso('GR1AA', { a: '1', b: '1', c: '2' });
  await k.sesion('P1', { niveles: { 1: [3, 1, 2], 2: [3, 3, 2] }, controles: [['a', true]] });
  await k.sesion('T1', { niveles: { 1: [2], 2: [1] } });
  await k.sesion('P2', { niveles: { 1: [3, 3, 2, 1], 2: [1, 1, 1, 0] }, faltan: ['b'] });
  await k.sesion('P3', { niveles: { 1: [3, 3, 3, 2], 2: [3, 2, 1, 1] } });
  await k.sesion('T3', { niveles: { 1: [2], 2: [2] } });
  const tc = async (codigo, grupo, puntos) => {
    const ev = await k.evento(codigo);
    if (puntos === null) return marcarEntrega(k.db, ev.id, 'grupo', grupo, false, AHORA);
    for (const [i, p] of cfg.actividades[ev.config].preguntas.entries()) await puntuarTrabajo(k.db, ev.id, 'grupo', grupo, p.id, puntos[i], AHORA);
  };
  await tc('TC1', '1', [1, 2, 1, 0.5, 1, 1, 1, 1]);      // 8.5
  await tc('TC1', '2', null);                            // no entregó
  await tc('TC2', '1', [2, 1.5, 0, 3]);                  // 6.5
  await tc('TC2', '2', [4, 1.5, 1.5, 3]);                // 10
  await tc('TC3', '1', [1, 2, 2, 3, 2]);                 // 10
  await tc('TC3', '2', [0, 2, 2, 3, 0]);                 // 7
  const { ctx } = await k.cargar();
  const nota = (id) => notaBimestre(ctx, id, 1);
  const comp = (id, c) => nota(id).componentes.find((x) => x.id === c).proyectada;

  cerca(comp('a', 'practicas'), (0.2 * (6 / 8) + 0.3 * (9 / 11) + 0.5 * 1) * 3);
  cerca(comp('b', 'practicas'), (0.2 * (6 / 8) + 0.5 * 1) * 3, 'b faltó a P2: 0');
  cerca(comp('c', 'practicas'), (0.2 * 1 + 0.3 * (3 / 11) + 0.5 * (7 / 11)) * 3);
  cerca(comp('a', 'trabajos_casa'), (0.4 * 0.85 + 0.25 * 0.65 + 0.35 * 1) * 2);
  cerca(comp('b', 'trabajos_casa'), (0.4 * 0.85 + 0.35 * 1) * 2, 'y 0 en el TC2 de su grupo');
  cerca(comp('c', 'trabajos_casa'), (0.25 * 1 + 0.35 * 0.7) * 2, 'su grupo no entregó el TC1');
  cerca(comp('c', 'talleres'), (0.75 + 1) / 2);
  assert.deepEqual(['a', 'b', 'c'].map((id) => redondear(notaFinalDelBimestre(ctx, id, 1), 2)), [5.39, 4.33, 3.67]);
  // El control oral de SQI no tiene nota, pero sin él queda la observación al cerrar el bimestre.
  const columnas = columnasDeLaApp(cfg, ctx.curso, ctx.eventos);
  const v = (id) => valoresDelEstudiante(ctx, columnas, id, { hoy: HOY, grupos: grupoActual(ctx) });
  assert.deepEqual([v('a').get('B1:control'), v('b').get('B1:control')], ['sí', 'no']);
  assert.match(v('b').get('observaciones'), /P2: no vino · TC2: no vino en la práctica .*B1: sin control oral/);
});

test('recuperaciones: solicitada (pendiente), no asistió (0), realizada (su nota); en un feriado es opcional', async () => {
  const k = await curso('GR2QB', { a: '1', b: '1' });
  await k.sesion('P1', { niveles: { 1: [4, 4, 4] }, faltan: ['b'] });
  let { ctx } = await k.cargar();
  const p1 = ctx.eventoPorId.get('GR2QB:P1');
  assert.deepEqual([notaEvento(ctx, p1, 'b').valor, notaEvento(ctx, p1, 'b').motivo], [0, 'no vino']);
  await guardarRecuperacion(k.db, p1.id, 'b', { estado: 'solicitada' }, AHORA);
  ({ ctx } = await k.cargar());
  assert.deepEqual([notaEvento(ctx, p1, 'b').estado, notaPreparatorio(ctx, p1, 'b').estado], ['pendiente', 'pendiente']);
  await guardarRecuperacion(k.db, p1.id, 'b', { estado: 'no_asistio' }, AHORA);
  ({ ctx } = await k.cargar());
  assert.deepEqual([notaEvento(ctx, p1, 'b').valor, notaEvento(ctx, p1, 'b').motivo, notaPreparatorio(ctx, p1, 'b').valor], [0, 'no asistió a la recuperación', 0]);
  await assert.rejects(guardarRecuperacion(k.db, p1.id, 'b', { estado: 'realizada', nota: 1.2 }, AHORA), /entre 0 y 10/);
  // Feriado (T2 de GR2QB): sin recuperar no cuenta; si la recupera, cuenta para él.
  await guardarRecuperacion(k.db, 'GR2QB:T2', 'a', { estado: 'solicitada', motivo: 'feriado' }, AHORA);
  ({ ctx } = await k.cargar());
  const t2 = ctx.eventoPorId.get('GR2QB:T2');
  assert.equal(notaEvento(ctx, t2, 'a').estado, 'excluido');
  await guardarRecuperacion(k.db, 'GR2QB:T2', 'a', { estado: 'realizada', nota: 0.9, motivo: 'feriado' }, AHORA);
  ({ ctx } = await k.cargar());
  assert.deepEqual([notaEvento(ctx, t2, 'a').valor, notaEvento(ctx, t2, 'a').motivo], [0.9, 'recuperada (Día de los Difuntos)']);
});

test('PLIC (2.º bimestre): 0.5 si lo completó de forma válida, 0 si no y pendiente sin registrar', async () => {
  const k = await curso('GR4EB', { a: '1', b: '1', c: '2' });
  let { ctx } = await k.cargar();
  const plic = (id) => notaBimestre(ctx, id, 2).componentes.find((x) => x.id === 'plic');
  assert.equal(plic('a').items[0].estado, 'pendiente');
  await marcarPlicVarios(k.db, 'GR4EB:PLIC', ['a', 'b', 'c'], true, AHORA);
  await marcarPlic(k.db, 'GR4EB:PLIC', 'b', false, AHORA);
  await marcarPlic(k.db, 'GR4EB:PLIC', 'c', null, AHORA);
  ({ ctx } = await k.cargar());
  assert.deepEqual([plic('a').proyectada, plic('b').proyectada], [0.5, 0]);
  assert.equal(plic('b').items[0].motivo, 'PLIC no válido o no rendido');
  assert.equal(plic('c').items[0].estado, 'pendiente');
  const ev = ctx.eventoPorId.get('GR4EB:PLIC');
  const est = estadoEvento(ev, ctx.reg, avanceEvaluacion(ctx, ev));
  assert.deepEqual([est.texto, est.detalle], ['En curso', '2/3 estudiantes']);
  await marcarPlic(k.db, 'GR4EB:PLIC', 'c', true, AHORA);
  ({ ctx } = await k.cargar());
  assert.equal(estadoEvento(ev, ctx.reg, avanceEvaluacion(ctx, ev)).texto, 'Calificado');
});

test('sesión sin clase: la actividad (y su TC) queda excluida y el componente se renormaliza; se puede deshacer', async () => {
  const k = await curso('GR1AA', { a: '1' });
  await k.sesion('P1', { niveles: { 1: [3, 1, 2] } });                 // 6/8
  await k.sesion('P3', { niveles: { 1: [3, 3, 1, 2] } });              // 9/11
  await marcarSinClase(k.db, 'GR1AA:P2', 'Suspensión de clases', AHORA);
  let { ctx } = await k.cargar();
  assert.deepEqual([ctx.eventoPorId.get('GR1AA:P2').estado, ctx.eventoPorId.get('GR1AA:TC2').estado], ['sin_clase', 'sin_clase']);
  const practicas = () => notaBimestre(ctx, 'a', 1).componentes.find((c) => c.id === 'practicas');
  cerca(practicas().proyectada, ((0.2 * 0.75 + 0.5 * (9 / 11)) / 0.7) * 3, 'P1 y P3 pesan 20/70 y 50/70');
  await assert.rejects(marcarSinClase(k.db, 'GR1AA:P2', '  ', AHORA), /motivo/);
  await quitarCambioEvento(k.db, 'GR1AA:P2');
  ({ ctx } = await k.cargar());
  assert.equal(ctx.eventoPorId.get('GR1AA:P2').estado, 'normal');
  // Un feriado del calendario en el que sí hubo clase.
  await marcarHuboClase(k.db, 'GR1AA:T2', AHORA);
  ({ ctx } = await k.cargar());
  assert.deepEqual([ctx.eventoPorId.get('GR1AA:T2').estado, ctx.eventoPorId.get('GR1AA:T2').motivo], ['normal', null]);
});

test('estudiante de otro curso que recupera aquí: se califica con su grupo, la app arma el texto y no va al Excel', async () => {
  const k = await curso('GR2QB', { a: '1', b: '1', c: '2' });
  const p1 = await k.evento('P1');
  const id = await agregarVisitante(k.db, p1.id, await k.grupos('P1'), '1', {
    codigo: '201912345', nombre: '  ruiz  pérez ana lucía ', paralelo: 'gr5xx', profesor: 'Prof. Ejemplo',
  }, AHORA);
  await assert.rejects(agregarVisitante(k.db, p1.id, await k.grupos('P1'), '1', { codigo: '1', nombre: 'x@y.example' }, AHORA), /correos/);
  let { ctx } = await k.cargar();
  const [v] = visitantesDelEvento(ctx, p1);
  assert.deepEqual([v.id, v.nombre, v.visita.paralelo], [id, 'RUIZ PÉREZ ANA LUCÍA', 'GR5XX']);
  assert.ok(!activos(ctx.reg.estudiantes).some((e) => e.id === id), 'no es estudiante del curso');
  assert.ok(!candidatosSorteo(ctx, p1).prioritarios.some((e) => e.id === id), 'no entra en el sorteo del control');

  await marcarRevisionPreparatorio(k.db, p1.id, true, AHORA);
  await k.sesion('P1', { niveles: { 1: [3, 4, 4], 2: [4, 4, 4] } });
  ({ ctx } = await k.cargar());
  cerca(notaEvento(ctx, p1, id).valor, 0.95, 'la nota de su grupo');
  assert.ok(!gruposDelEvento(ctx.eventoPorId.get('GR2QB:T1'), ctx.eventos, ctx.reg).porEstudiante.has(id), 'solo aparece en P1');
  const { texto, final } = textoParaSuProfesor(ctx, p1, v, PROFESOR);
  assert.equal(final, true);
  for (const linea of ['Estudiante: RUIZ PÉREZ ANA LUCÍA · código 201912345 · paralelo GR5XX', 'Sesión: GR2QB, lunes 5 de octubre de 2026, 09:00–11:00',
    'Asistencia: Presente', 'Nota de la actividad: 9.5/10 (diseño 3/4 · datos 4/4 · análisis 4/4)', 'Trabajo preparatorio: 2/2', PROFESOR]) {
    assert.ok(texto.includes(linea), `falta «${linea}» en:\n${texto}`);
  }
  assert.ok(!textoParaSuProfesor(ctx, p1, v).texto.includes(PROFESOR), 'sin el nombre en el dispositivo, el texto va sin firma');
  // No va al Excel ni a coordinación, y volver a leer el Excel no lo da de baja.
  const cursos = await cargarCursos(k.db, cfg);
  const wb = crearLibroRespaldo(ExcelJS, cfg, cursos, await exportarRespaldo(k.db, { semestre: '2026B', app: 'prueba', config: cfg.version, ahora: AHORA }), { hoy: HOY });
  const textoLibro = wb.worksheets.filter((w) => w.state === 'visible').map((w) => JSON.stringify(w.getSheetValues())).join('\n');
  assert.ok(textoLibro.includes('APELLIDOA SEGUNDO NOMBREA'), 'las hojas sí tienen a los estudiantes del curso');
  assert.ok(!textoLibro.includes('201912345'), 'el visitante no aparece en las hojas');
  const lectura = { cursos: { GR2QB: { estudiantes: ['a', 'b', 'c'].map((x, i) => ({ codigo: x, nombre: `APELLIDO${x.toUpperCase()} SEGUNDO NOMBRE${x.toUpperCase()}`, pendiente: false, grupo: x === 'c' ? '2' : '1', observacion: null, numero: i + 1 })) } } };
  assert.ok(!(await planificarImportacion(k.db, lectura)).cambios.some((x) => x.antes?.id === id));
  await quitarVisitante(k.db, p1.id, id);
  ({ ctx } = await k.cargar());
  assert.equal(visitantesDelEvento(ctx, p1).length, 0);
  assert.ok(!ctx.reg.asistencia.some((a) => a.estudiante === id));
});

test('antes del envío: bimestre en curso, eventos pendientes por evaluar y quién sigue sin control oral', async () => {
  assert.deepEqual(bimestreEnCurso(cfg, '2026-11-20'), { bimestre: 1, envio: '2026-12-01', dias: 11 });
  assert.equal(bimestreEnCurso(cfg, '2026-12-02').bimestre, 2);
  assert.equal(bimestreEnCurso(cfg, '2027-02-01'), null);

  const k = await curso('GR2QB', { a: '1', b: '1', c: '2' });
  await k.sesion('P1', { niveles: { 1: [4, 4, 4], 2: [4, 4, 4] }, controles: [['a', [2]]] });
  const t1 = await k.evento('T1');
  await guardarPuntaje(k.db, t1.id, await k.grupos('T1'), '1', 'integral', 2, AHORA);
  let { ctx } = await k.cargar();
  const { pendientes, porVenir } = pendientesDelBimestre(ctx, 1, '2026-10-26');
  assert.deepEqual(pendientes.map((p) => [p.evento.codigo, p.pendientes, p.motivo]), [['T1', 3, 'falta cerrar el pase'], ['P2', 3, 'falta cerrar el pase']]);
  assert.deepEqual(porVenir.map((e) => e.codigo), ['P3', 'T3'], 'el T2 es feriado en GR2QB');
  // A 2 sesiones del cierre (P3 y T3), el aviso lista a quienes siguen sin control oral.
  assert.equal(avisoControlCierre(ctx, 1, '2026-10-26'), null, 'aún quedan 3 sesiones');
  const aviso = avisoControlCierre(ctx, 1, '2026-11-09');
  assert.deepEqual([aviso.quedan, aviso.sinControl.map((e) => e.id)], [2, ['b', 'c']]);
});

test('hojas de coordinación: sus cuatro columnas, notas con 2 decimales, el profesor y los pendientes aparte', async () => {
  const k = await clasicaB1();
  const cursos = await cargarCursos(k.db, cfg);
  const respaldo = await exportarRespaldo(k.db, { semestre: '2026B', app: 'prueba', config: cfg.version, ahora: AHORA });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await crearLibroRespaldo(ExcelJS, cfg, cursos, respaldo, { hoy: HOY, profesor: PROFESOR }).xlsx.writeBuffer());
  const ws = wb.getWorksheet(cfg.excel.escritura.hojas_coordinacion[1]);
  assert.deepEqual(ws.getRow(4).values.slice(1), ['APELLIDOS Y NOMBRES', 'NÚMERO ÚNICO', 'NOTA(/6)', 'PROFESOR']);
  const filas = [];
  ws.eachRow((f, r) => { if (r > 4) filas.push(f.values.slice(1)); });
  assert.deepEqual(filas.slice(0, 4), [
    ['APELLIDOA SEGUNDO NOMBREA', 'a', 5.01, PROFESOR],
    ['APELLIDOB SEGUNDO NOMBREB', 'b', 4.3, PROFESOR],
    ['APELLIDOC SEGUNDO NOMBREC', 'c', 5.11, PROFESOR],
    ['APELLIDOD SEGUNDO NOMBRED', 'd', 5.28, PROFESOR],
  ]);
  assert.match(String(filas[4][0]), /^Pendientes de la lista final/);
  assert.equal(filas[5][0], 'APELLIDOP SEGUNDO NOMBREP');
  let filaP;
  ws.eachRow((f) => { if (f.getCell(1).value === 'APELLIDOP SEGUNDO NOMBREP') filaP = f; });
  assert.equal(filaP.getCell(1).fill.fgColor.argb, 'FFFFF4D6', 'el pendiente va en ámbar');
  assert.equal(filaP.getCell(3).numFmt, '0.00');
  for (const f of filas) if (typeof f[2] === 'number') assert.equal(f[2], redondear(f[2], 2));
  // El 2.º bimestre aún no tiene notas: la hoja existe con todos y la nota vacía.
  const b2 = wb.getWorksheet(cfg.excel.escritura.hojas_coordinacion[2]);
  assert.equal(b2.getRow(5).getCell(3).value, null);
  assert.match(String(b2.getCell(2, 1).value), /^0 de 5 notas completas/);
});
