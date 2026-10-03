// Talleres (Fase 4) contra la base: pase, evaluación integral por grupo, nota del taller por estudiante,
// componente con un taller perdido por feriado y retroalimentación de la práctica anterior.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import {
  agregarAlControl, alternarEtiqueta, cerrarPase, guardarNotaProfesor, guardarNovedad, guardarPuntaje, marcarAsistencia,
  marcarRetro, marcarRevisionPreparatorio, puntuarPregunta,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearContexto, notaBimestre, notaControl, notaEvento, notaPreparatorio } from '../src/nucleo/motor.js';
import { avanceEvaluacion, textoNotaGrupo } from '../src/nucleo/motor-vista.js';
import { practicaAnterior, retroDelTaller } from '../src/nucleo/retro.js';
import { columnasDeLaApp, grupoActual, RAYA, valoresDelEstudiante } from '../src/nucleo/resultados.js';
import { configReal, copia } from './ayudas.js';

const cfg = configReal();
const SIN_GRUPO = cfg.asistencia.motivos.sin_grupo;
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);

/** Configuración con otro taller igual al T1 (las guías de T2–T7 aún no están cargadas). */
function conTaller(codigo) {
  const c = copia(cfg);
  c.actividades[codigo] = { ...c.actividades.T1, id: codigo, codigo, tareas: [], preguntas_discusion: [], etiquetas: [] };
  return c;
}

/** Curso con 10 estudiantes ficticios: grupos 1 (a, b, c), 2 (d, e, f), 3 (g, h, i) y «j» sin grupo. */
async function curso(paralelo, cfg = configReal()) {
  const db = abrirBase(`taller-${randomUUID()}`);
  const grupos = { a: '1', b: '1', c: '1', d: '2', e: '2', f: '2', g: '3', h: '3', i: '3', j: null };
  await db.estudiantes.bulkPut(Object.entries(grupos).map(([id, g]) => ({
    id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} SEGUNDO NOMBRE${id.toUpperCase()}`, curso: paralelo, estado: 'nomina', grupo_excel: g,
  })));
  const c = cfg.cursoPorId[paralelo];
  const eventos = generarEventos(cfg, c);
  const cargar = async () => {
    const reg = await registrosDelCurso(db, paralelo);
    return { reg, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  const evento = (codigo) => eventos.find((e) => e.codigo === codigo);
  const gruposDe = async (codigo) => gruposDelEvento(evento(codigo), eventos, (await cargar()).reg).porEstudiante;
  return { db, eventos, evento, cargar, gruposDe };
}

/** Taller con la evaluación integral de cada grupo y el pase. */
async function taller(c, codigo, { integral, faltan = [], retirados = [] }) {
  const ev = c.evento(codigo);
  const grupos = await c.gruposDe(codigo);
  for (const [grupo, nivel] of Object.entries(integral)) await guardarPuntaje(c.db, ev.id, grupos, grupo, 'integral', nivel);
  for (const id of faltan) await marcarAsistencia(c.db, ev.id, grupos, id, 'no_vino');
  for (const id of retirados) await marcarAsistencia(c.db, ev.id, grupos, id, 'se_retiro_antes');
  await cerrarPase(c.db, ev.id, grupos, SIN_GRUPO);
  return ev;
}

test('T1 (Clásica, cronograma B): pase, evaluación integral por grupo y nota del taller por estudiante', async () => {
  const c = await curso('GR3QA');
  const t1 = c.evento('T1');
  assert.equal(t1.semana, 2, 'en el cronograma B el T1 es la primera actividad con nota');
  assert.equal(t1.config, 'T1');
  const grupos = await c.gruposDe('T1');
  await marcarRevisionPreparatorio(c.db, t1.id, true);
  await guardarNovedad(c.db, t1.id, 'b', { nivel: 1 }, cfg.preparatorio.motivo_no_ingresa);
  await agregarAlControl(c.db, t1.id, ['c']);
  await puntuarPregunta(c.db, t1.id, 'c', 0, 2);
  await puntuarPregunta(c.db, t1.id, 'c', 1, 2);
  await guardarPuntaje(c.db, t1.id, grupos, '1', 'integral', 2);
  let { ctx } = await c.cargar();
  assert.deepEqual(avanceEvaluacion(ctx, t1), { grupos: 3, evaluados: 1 });
  await taller(c, 'T1', { integral: { 2: 1, 3: 2 }, faltan: ['e'], retirados: ['h'] });
  ({ ctx } = await c.cargar());
  assert.deepEqual(avanceEvaluacion(ctx, t1), { grupos: 3, evaluados: 3 });

  const nota = (id) => notaEvento(ctx, t1, id);
  cerca(nota('a').valor, 1.0, 'asistencia completa e integral 2/2');
  cerca(nota('d').valor, 0.75, 'asistencia completa e integral 1/2 (caso del §4)');
  cerca(nota('h').valor, 0.75, 'se retiró antes con integral 2/2 (caso del §4)');
  assert.equal(nota('h').motivo, 'se retiró antes');
  assert.deepEqual([nota('e').valor, nota('e').motivo], [0, 'no vino']);
  assert.deepEqual([nota('j').valor, nota('j').motivo], [0, `no vino (${SIN_GRUPO})`]);
  assert.equal(nota('a').partes.asistencia_permanencia, 1);
  assert.equal(nota('h').partes.asistencia_permanencia, 0.5);
  // Lo individual del taller (Clásica): preparatorio y control oral.
  assert.equal(notaPreparatorio(ctx, t1, 'b').nivel, 1);
  assert.equal(notaPreparatorio(ctx, t1, 'a').nivel, 2);
  cerca(notaControl(ctx, t1, 'c').valor, 1);
  // La nota del grupo se muestra como nivel de la evaluación integral.
  assert.equal(textoNotaGrupo({ partes: [{ id: 'integral', valor: 1, max: 2 }], valor: 0.5 }), '1/2');
  // Sin práctica antes: no hay retroalimentación.
  assert.equal(practicaAnterior(ctx, t1), null);
  assert.equal(retroDelTaller(ctx, t1).practica, null);
});

test('curso que perdió el T2 por feriado (GR2QB): el componente de talleres promedia T1 y T3', async () => {
  const cfgT3 = conTaller('T3');
  const c = await curso('GR2QB', cfgT3);
  assert.equal(c.evento('T2').estado, 'feriado');
  await taller(c, 'T1', { integral: { 1: 2, 2: 2, 3: 2 } });
  await taller(c, 'T3', { integral: { 1: 1, 2: 2, 3: 2 }, retirados: ['g'] });
  const { ctx } = await c.cargar();
  assert.equal(c.evento('T3').config, 'T3');
  const talleres = (id) => notaBimestre(ctx, id, 1).componentes.find((x) => x.id === 'talleres');
  // a: T1 = 1.0, T3 = 0.5 + 0.25 = 0.75 → (1.0 + 0.75) / 2 = 0.875 (caso del §4).
  const ta = talleres('a');
  assert.equal(ta.completo, true, 'T1 y T3 evaluados; T2 excluido');
  cerca(ta.proyectada, 0.875);
  assert.deepEqual(ta.items.map((i) => [i.codigo, i.estado]), [['T1', 'calculada'], ['T2', 'excluido'], ['T3', 'calculada']]);
  // g se retiró antes del T3: 0.5 × 0.5 + 0.5 × 1 = 0.75 → (1.0 + 0.75) / 2.
  cerca(talleres('g').proyectada, 0.875);
  cerca(talleres('d').proyectada, 1.0);
  // En el Excel: T2 con «—» y el componente redondeado a 2 decimales (la nota del bimestre aún no).
  const columnas = columnasDeLaApp(cfgT3, cfgT3.cursoPorId.GR2QB, c.eventos);
  const v = valoresDelEstudiante(ctx, columnas, 'a', { hoy: '2026-11-20', grupos: grupoActual(ctx) });
  assert.deepEqual([v.get('B1:T1'), v.get('B1:T2'), v.get('B1:T3')], [10, RAYA, 7.5]);
  assert.equal(v.get('B1:talleres'), 0.88);
  assert.equal(v.get('B1:nota'), null, 'faltan las prácticas');
  assert.match(v.get('observaciones'), /T2: no se hizo \(Día de los Difuntos\)/);
});

test('retroalimentación del T1: los grupos de P1 con su rúbrica, etiquetas, nota del profesor y control; casilla «dada»', async () => {
  const c = await curso('GR2QB');
  const p1 = c.evento('P1');
  const t1 = c.evento('T1');
  const gp1 = await c.gruposDe('P1');
  for (const [aspecto, v] of [['diseno', 3], ['datos', 4], ['analisis', 1]]) await guardarPuntaje(c.db, p1.id, gp1, '1', aspecto, v);
  const [etPos, etNeg] = [cfg.actividades['P1-TRAD'].etiquetas.find((t) => t.signo === '+'), cfg.actividades['P1-TRAD'].etiquetas.find((t) => t.signo === '-')];
  await alternarEtiqueta(c.db, p1.id, gp1, '1', etPos.id);
  await alternarEtiqueta(c.db, p1.id, gp1, '1', etNeg.id);
  await guardarNotaProfesor(c.db, p1.id, 'grupo', '1', 'Buen montaje; revisar la propagación de errores');
  await agregarAlControl(c.db, p1.id, ['a']);
  await puntuarPregunta(c.db, p1.id, 'a', 0, 1);
  await marcarAsistencia(c.db, p1.id, gp1, 'b', 'no_vino');
  await cerrarPase(c.db, p1.id, gp1, SIN_GRUPO);

  let { ctx } = await c.cargar();
  assert.equal(practicaAnterior(ctx, t1).id, p1.id);
  const r = retroDelTaller(ctx, t1);
  assert.equal(r.grupos.length, 3);
  const g1 = r.grupos[0];
  assert.equal(g1.grupo, '1');
  assert.deepEqual(g1.nota.partes.map((p) => [p.corto, p.valor, p.max]), [['diseño', 3, 4], ['datos', 4, 4], ['análisis', 1, 4]]);
  assert.deepEqual(g1.etiquetas.map((t) => t.id), [etPos.id, etNeg.id]);
  assert.equal(g1.notaProfesor, 'Buen montaje; revisar la propagación de errores');
  assert.equal(g1.integrantes.find((x) => x.estudiante.id === 'a').control.valor, 0.5);
  assert.ok(g1.integrantes.find((x) => x.estudiante.id === 'b').asistencia.falta);
  assert.equal(g1.dada, false);

  await marcarRetro(c.db, t1.id, '1', true);
  ({ ctx } = await c.cargar());
  assert.equal(retroDelTaller(ctx, t1).grupos[0].dada, true);
  assert.equal(retroDelTaller(ctx, t1).grupos[1].dada, false);
  await marcarRetro(c.db, t1.id, '1', false);
  ({ ctx } = await c.cargar());
  assert.equal(retroDelTaller(ctx, t1).grupos[0].dada, false);
});

test('la retroalimentación salta la práctica perdida por feriado y usa la anterior que sí se hizo', async () => {
  const c = await curso('GR2QB');
  const { ctx } = await c.cargar();
  // GR2QB pierde P5 (Fundación de Quito): la retro del T5 se arma con la última práctica que sí se hizo.
  const t6 = c.evento('T6');
  assert.equal(c.evento('P5').estado, 'feriado');
  assert.equal(practicaAnterior(ctx, t6).codigo, 'P6');
  const t5 = c.evento('T5');
  assert.equal(practicaAnterior(ctx, t5).codigo, 'P4', 'P5 se perdió: la retro del T5 es de P4');
});
