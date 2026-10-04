// Trabajos en casa de SQI (Fase 5) contra la base: calificación pregunta por pregunta de todos los grupos de un
// curso, avance automático al siguiente grupo, «no entregó», etiquetas, componente y lo que va al Excel.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import {
  alternarEtiquetaTrabajo, borrarTrabajo, cerrarPase, guardarNotaProfesor, guardarPuntaje, marcarAsistencia, marcarEntrega,
  puntuarTrabajo,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearContexto, notaBimestre, notaEvento, notaTrabajo } from '../src/nucleo/motor.js';
import { avanceEvaluacion, siguientePorCalificar, unidadesDelTrabajo } from '../src/nucleo/motor-vista.js';
import { estadoEvento } from '../src/nucleo/estado-evento.js';
import { columnasDeLaApp, filaDetalle, grupoActual, valoresDelEstudiante } from '../src/nucleo/resultados.js';
import { configReal, copia } from './ayudas.js';

const cfg = configReal();
const SIN_GRUPO = cfg.asistencia.motivos.sin_grupo;
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);
const TC1 = cfg.actividades['TC1-SQI'];

/**
 * GR1AA con 14 estudiantes ficticios: grupos 1 (a, b, c), 2 (d, e, f), 3 (g, h, i), 4 (j, k) y 5 (l, m), y «n» sin
 * grupo. En P1 faltan «c» y todo el grupo 4; «n» queda «no vino» al cerrar el pase.
 */
async function cursoConP1(c = cfg) {
  const db = abrirBase(`tc-${randomUUID()}`);
  const grupos = { a: '1', b: '1', c: '1', d: '2', e: '2', f: '2', g: '3', h: '3', i: '3', j: '4', k: '4', l: '5', m: '5', n: null };
  await db.estudiantes.bulkPut(Object.entries(grupos).map(([id, g]) => ({
    id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} SEGUNDO NOMBRE${id.toUpperCase()}`, curso: 'GR1AA', estado: 'nomina', grupo_excel: g,
  })));
  const curso = c.cursoPorId.GR1AA;
  const eventos = generarEventos(c, curso);
  const evento = (codigo) => eventos.find((e) => e.codigo === codigo);
  const cargar = async () => crearContexto(c, curso, eventos, await registrosDelCurso(db, 'GR1AA'));
  const p1 = evento('P1');
  const gp1 = gruposDelEvento(p1, eventos, (await cargar()).reg).porEstudiante;
  for (const g of ['1', '2', '3', '5']) {
    for (const [aspecto, v] of [['resp_pred_plan', 2], ['ejec_registro', 2], ['discusion', 1]]) await guardarPuntaje(db, p1.id, gp1, g, aspecto, v);
  }
  for (const id of ['c', 'j', 'k']) await marcarAsistencia(db, p1.id, gp1, id, 'no_vino');
  await cerrarPase(db, p1.id, gp1, SIN_GRUPO);
  return { db, eventos, evento, cargar };
}

/** Califica todas las preguntas de un TC con los puntajes dados (en el orden de la configuración). */
async function calificar(db, evento, unidadId, puntajes, unidad = 'grupo') {
  for (const [i, p] of TC1.preguntas.entries()) await puntuarTrabajo(db, evento.id, unidad, unidadId, p.id, puntajes[i]);
}

test('TC1 de un curso: grupos de P1, quién faltó, avance automático, «no entregó», etiquetas y componente', async () => {
  const { db, evento, cargar } = await cursoConP1();
  const tc1 = evento('TC1');
  assert.equal(tc1.config, 'TC1-SQI');
  let ctx = await cargar();

  // Los grupos son los de P1; el grupo 4 faltó completo (0 sin calificar) y «c» faltó en el grupo 1.
  let unidades = unidadesDelTrabajo(ctx, tc1);
  assert.deepEqual(unidades.map((u) => [u.id, u.porCalificar]), [['1', true], ['2', true], ['3', true], ['4', false], ['5', true]]);
  assert.ok(unidades[0].integrantes.find((i) => i.estudiante.id === 'c').asistencia.falta);
  assert.deepEqual(avanceEvaluacion(ctx, tc1), { grupos: 4, evaluados: 0, nombre: 'grupos' });
  assert.deepEqual(estadoEvento(tc1, ctx.reg, avanceEvaluacion(ctx, tc1)).texto, 'Pendiente');
  assert.equal(siguientePorCalificar(unidades, null), '1');

  // Grupo 1: pregunta por pregunta (8.5/10, caso del §4), con dos etiquetas.
  await calificar(db, tc1, '1', [1, 2, 1, 0.5, 1, 1, 1, 1]);
  await alternarEtiquetaTrabajo(db, tc1.id, 'grupo', '1', 'confunde_inc_media');
  await alternarEtiquetaTrabajo(db, tc1.id, 'grupo', '1', 'relaciona_objetivos');
  await guardarNotaProfesor(db, tc1.id, 'grupo', '1', 'Revisar la incertidumbre de la media');
  ctx = await cargar();
  const t1 = notaTrabajo(ctx, tc1, '1');
  assert.deepEqual([t1.completo, t1.puntos, t1.total], [true, 8.5, 10]);
  assert.deepEqual(t1.etiquetas, ['confunde_inc_media', 'relaciona_objetivos']);
  unidades = unidadesDelTrabajo(ctx, tc1);
  assert.equal(siguientePorCalificar(unidades, '1'), '2', 'avance automático: del grupo 1 al 2');
  const est = estadoEvento(tc1, ctx.reg, avanceEvaluacion(ctx, tc1));
  assert.deepEqual([est.texto, est.detalle], ['En curso', '1/4 grupos']);

  // Grupo 3 a medias; grupo 2 no entregó; grupo 5 completo.
  await puntuarTrabajo(db, tc1.id, 'grupo', '3', '1a', 1);
  await marcarEntrega(db, tc1.id, 'grupo', '2', false);
  ctx = await cargar();
  unidades = unidadesDelTrabajo(ctx, tc1);
  assert.equal(siguientePorCalificar(unidades, '2'), '3', 'el 3 sigue pendiente');
  assert.equal(siguientePorCalificar(unidades, '5'), '3', 'al llegar al final da la vuelta');
  await calificar(db, tc1, '5', [1, 2, 1, 1, 1, 1, 1, 2]);
  await calificar(db, tc1, '3', [0, 2, 0.5, 0.5, 1, 1, 0, 1]);
  ctx = await cargar();
  unidades = unidadesDelTrabajo(ctx, tc1);
  assert.equal(siguientePorCalificar(unidades, '3'), null, 'no queda ninguno: vuelve a la lista');
  assert.deepEqual(avanceEvaluacion(ctx, tc1), { grupos: 4, evaluados: 4, nombre: 'grupos' });
  assert.equal(estadoEvento(tc1, ctx.reg, avanceEvaluacion(ctx, tc1)).texto, 'Calificado');

  // Notas por estudiante.
  const nota = (id) => notaEvento(ctx, tc1, id);
  cerca(nota('a').valor, 0.85);
  assert.deepEqual([nota('c').valor, nota('c').motivo], [0, 'no vino en la práctica']);
  assert.deepEqual([nota('d').valor, nota('d').motivo], [0, 'no entregó']);
  cerca(nota('g').valor, 0.6);
  assert.equal(nota('l').valor, 1);
  assert.deepEqual([nota('j').valor, nota('n').valor], [0, 0], 'grupo ausente y estudiante sin grupo');

  // Componente: TC1 = 40 % de 2 puntos (caso del §4: 0.85 × 0.80 = 0.68).
  const comp = notaBimestre(ctx, 'a', 1).componentes.find((c) => c.id === 'trabajos_casa');
  cerca(comp.acumulada, 0.68);
  cerca(notaBimestre(ctx, 'l', 1).componentes.find((c) => c.id === 'trabajos_casa').acumulada, 0.8, 'máximo del TC1');

  // Lo que va al Excel: la columna del TC1 y la fila del detalle (puntajes, nota del grupo, etiquetas, nota del profesor).
  const columnas = columnasDeLaApp(cfg, ctx.curso, ctx.eventos);
  const v = (id) => valoresDelEstudiante(ctx, columnas, id, { hoy: '2026-10-20', grupos: grupoActual(ctx) });
  assert.deepEqual(['a', 'c', 'd', 'g'].map((id) => v(id).get('B1:TC1')), [8.5, 0, 0, 6]);
  assert.match(v('d').get('observaciones'), /TC1: no entregó/);
  const fila = filaDetalle(ctx, tc1, ctx.estudiantePorId.get('a'));
  assert.equal(fila[5], 'TC1');
  assert.equal(fila[10], '1a 1 · 1b 2 · 2a-i 1 · 2a-ii 0.5 · 2b-i 1 · 2b-ii 1 · 2c 1 · 2d 1');
  assert.equal(fila[11], 8.5, 'nota del grupo');
  assert.equal(fila[12], 8.5);
  assert.equal(fila[14], 'Grupo: Revisar la incertidumbre de la media');
  assert.match(fila[15], /^− Confunde la incertidumbre individual con la incertidumbre de la media \(2c\) · \+ Relaciona/);
  assert.equal(filaDetalle(ctx, tc1, ctx.estudiantePorId.get('d'))[10], 'no entregó');

  // Corregir: el grupo 2 sí entregó (sus puntajes vacíos dejan el TC pendiente) y borrar lo del grupo 3.
  await marcarEntrega(db, tc1.id, 'grupo', '2', true);
  await borrarTrabajo(db, tc1.id, 'grupo', '3');
  ctx = await cargar();
  assert.deepEqual([notaEvento(ctx, tc1, 'd').estado, notaEvento(ctx, tc1, 'd').motivo], ['pendiente', 'faltan 8 preguntas por calificar']);
  assert.equal(notaTrabajo(ctx, tc1, '3').registrado, false);
  assert.deepEqual(avanceEvaluacion(ctx, tc1), { grupos: 4, evaluados: 2, nombre: 'grupos' });
});

test('TC individual: una unidad por estudiante (en el orden de los grupos) y quien faltó no se califica', async () => {
  const cfgInd = copia(cfg);
  cfgInd.actividades['TC1-SQI'].unidad_calificacion = 'estudiante';
  const { db, evento, cargar } = await cursoConP1(cfgInd);
  const tc1 = evento('TC1');
  let ctx = await cargar();
  const unidades = unidadesDelTrabajo(ctx, tc1);
  assert.deepEqual(unidades.slice(0, 4).map((u) => [u.id, u.grupo, u.porCalificar]), [['a', '1', true], ['b', '1', true], ['c', '1', false], ['d', '2', true]]);
  assert.deepEqual(unidades.at(-1).id, 'n', 'quien no tiene grupo va al final');
  assert.deepEqual(avanceEvaluacion(ctx, tc1), { grupos: 10, evaluados: 0, nombre: 'estudiantes' });
  await calificar(db, tc1, 'b', [1, 2, 1, 1, 1, 1, 1, 2], 'estudiante');
  ctx = await cargar();
  assert.equal(notaEvento(ctx, tc1, 'b').valor, 1);
  assert.equal(notaEvento(ctx, tc1, 'a').motivo, 'falta calificar su trabajo');
  assert.equal(siguientePorCalificar(unidadesDelTrabajo(ctx, tc1), 'b'), 'd', 'salta a «c», que faltó');
});
