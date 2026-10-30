// Nota con decimales de un trabajo en casa (nota fijada): manda sobre las preguntas y el descuento, que se conservan; «no
// entregó» sigue mandando. La herramienta de Datos pasa los números de las observaciones de un TC a nota fijada.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import {
  cerrarPase, descontarTrabajo, fijarNotaTrabajo, guardarNotaProfesor, guardarPuntaje, marcarEntrega, puntuarTrabajo,
} from '../src/datos/acciones.js';
import { aplicarPropuestasDeObservaciones, leerPropuestasDeObservaciones } from '../src/datos/notas-observaciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearContexto, notaBimestre, notaEvento, notaTrabajo, topeDeNota } from '../src/nucleo/motor.js';
import { unidadesDelTrabajo } from '../src/nucleo/motor-vista.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const SIN_GRUPO = cfg.asistencia.motivos.sin_grupo;
const TC1 = cfg.actividades['TC1-SQI'];
const AHORA = '2026-10-20T14:30:00.000Z';

// GR1AA: grupo 1 (a, b), grupo 2 (c, d). P1 evaluada y con el pase cerrado.
async function curso() {
  const db = abrirBase(`tcf-${randomUUID()}`);
  const grupos = { a: '1', b: '1', c: '2', d: '2' };
  await db.estudiantes.bulkPut(Object.entries(grupos).map(([id, g]) => ({
    id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} NOMBRE${id.toUpperCase()}`, curso: 'GR1AA', estado: 'nomina', grupo_excel: g,
  })));
  const c = cfg.cursoPorId.GR1AA;
  const eventos = generarEventos(cfg, c);
  const tc1 = eventos.find((e) => e.codigo === 'TC1');
  const cargar = async () => crearContexto(cfg, c, eventos, await registrosDelCurso(db, 'GR1AA', cfg));
  const p1 = eventos.find((e) => e.codigo === 'P1');
  const gp1 = gruposDelEvento(p1, eventos, (await cargar()).reg).porEstudiante;
  for (const g of ['1', '2']) for (const [a, v] of [['resp_pred_plan', 2], ['ejec_registro', 2], ['discusion', 1]]) await guardarPuntaje(db, p1.id, gp1, g, a, v);
  await cerrarPase(db, p1.id, gp1, SIN_GRUPO);
  return { db, tc1, cargar };
}
const calificar = async (db, tc, id, puntajes) => { for (const [i, p] of TC1.preguntas.entries()) await puntuarTrabajo(db, tc.id, 'grupo', id, p.id, puntajes[i], AHORA); };
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('TC: el tope de la nota es la escala total', () => {
  assert.equal(topeDeNota(TC1), 10);
});

test('TC: la nota fijada manda sobre las preguntas y el descuento; quitarla vuelve a las preguntas', async () => {
  const { db, tc1, cargar } = await curso();
  await calificar(db, tc1, '1', [1, 2, 1, 1, 1, 1, 1, 2]);                 // 10
  await descontarTrabajo(db, tc1.id, 'grupo', '1', 1, 'ortografía', AHORA);  // 9
  let t = notaTrabajo(await cargar(), tc1, '1');
  assert.deepEqual([t.puntos, t.fijada], [9, undefined]);

  await fijarNotaTrabajo(db, tc1.id, 'grupo', '1', 9.456, 10, AHORA);
  const ctx = await cargar();
  t = notaTrabajo(ctx, tc1, '1');
  assert.deepEqual([t.fijada, t.completo, t.puntos, t.nota_fijada, t.puntos_rubrica, t.descuento], [true, true, 9.46, 9.46, 9, 0]);
  cerca(t.valor, 0.946);
  cerca(notaEvento(ctx, tc1, 'a').valor, 0.946);
  assert.deepEqual(t.partes.map((p) => p.valor), [1, 2, 1, 1, 1, 1, 1, 2], 'las preguntas se conservan');

  await fijarNotaTrabajo(db, tc1.id, 'grupo', '1', null, 10, AHORA);
  t = notaTrabajo(await cargar(), tc1, '1');
  assert.deepEqual([t.puntos, t.fijada, t.descuento], [9, undefined, 1], 'el descuento vuelve');
});

test('TC: una nota fijada completa un trabajo sin preguntas, cuenta en el bimestre y «no entregó» sigue mandando', async () => {
  const { db, tc1, cargar } = await curso();
  assert.equal(notaTrabajo(await cargar(), tc1, '2').registrado, false);
  await fijarNotaTrabajo(db, tc1.id, 'grupo', '2', 8.5, 10, AHORA);
  let ctx = await cargar();
  let t = notaTrabajo(ctx, tc1, '2');
  assert.deepEqual([t.completo, t.puntos, t.puntos_rubrica], [true, 8.5, null]);
  assert.equal(unidadesDelTrabajo(ctx, tc1).find((u) => u.id === '2').nota.completo, true);
  const comp = notaBimestre(ctx, 'c', 1).componentes.find((c) => c.id === 'trabajos_casa');
  cerca(comp.acumulada, 0.85 * 0.4 * 2);

  await marcarEntrega(db, tc1.id, 'grupo', '2', false, AHORA);
  ctx = await cargar();
  t = notaTrabajo(ctx, tc1, '2');
  assert.deepEqual([t.entregado, t.puntos, t.valor], [false, 0, 0]);
  assert.equal(notaEvento(ctx, tc1, 'c').valor, 0);
  await marcarEntrega(db, tc1.id, 'grupo', '2', true, AHORA);
  assert.equal(notaTrabajo(await cargar(), tc1, '2').puntos, 8.5, 'la nota fijada se conserva');
});

test('TC: la nota fijada debe estar entre 0 y la escala total', async () => {
  const { db, tc1 } = await curso();
  await assert.rejects(fijarNotaTrabajo(db, tc1.id, 'grupo', '1', 10.5, 10, AHORA), /0 a 10/);
  await assert.rejects(fijarNotaTrabajo(db, tc1.id, 'grupo', '1', -1, 10, AHORA), /0 a 10/);
});

test('TC: la herramienta de Datos pasa las notas de las observaciones de un TC', async () => {
  const { db, tc1, cargar } = await curso();
  await calificar(db, tc1, '1', [1, 2, 1, 1, 1, 1, 1, 2]);               // 10; el comentario dice 9.5
  await guardarNotaProfesor(db, tc1.id, 'grupo', '1', '9.5', AHORA);
  await guardarNotaProfesor(db, tc1.id, 'grupo', '2', 'Entregó tarde\n8,25', AHORA);

  const propuestas = (await leerPropuestasDeObservaciones(db, cfg)).filter((p) => p.evento.id === tc1.id);
  assert.deepEqual(propuestas.map((p) => [p.unidad, p.grupo, p.valor, p.actual, p.tope, p.resto]), [
    ['grupo', '1', 9.5, 10, 10, ''],
    ['grupo', '2', 8.25, null, 10, 'Entregó tarde'],
  ]);
  assert.equal(await aplicarPropuestasDeObservaciones(db, propuestas, AHORA), 2);

  const ctx = await cargar();
  assert.deepEqual([notaTrabajo(ctx, tc1, '1').puntos, notaTrabajo(ctx, tc1, '2').puntos], [9.5, 8.25]);
  assert.equal(ctx.reg.notas.find((n) => n.evento === tc1.id && n.unidad_id === '1'), undefined, 'el número sale de la observación');
  assert.equal(ctx.reg.notas.find((n) => n.evento === tc1.id && n.unidad_id === '2').texto, 'Entregó tarde');
  assert.deepEqual((await leerPropuestasDeObservaciones(db, cfg)).filter((p) => p.evento.id === tc1.id), [], 'ya no quedan por pasar');
});
