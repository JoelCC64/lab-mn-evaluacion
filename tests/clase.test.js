// Una clase completa contra la base (Dexie sobre fake-indexeddb): puerta, control, evaluación, pase y notas.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import {
  agregarAlControl, alternarEtiqueta, borrarNovedad, cerrarPase, guardarAjuste, guardarNotaProfesor, guardarNovedad,
  guardarObservacion, guardarPuntaje, marcarAsistencia, marcarNoEsta, marcarRevisionPreparatorio, marcarSalio,
  moverEstudiante, puntuarPregunta, quitarDelControl, reabrirPase, revisarGrupo,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearContexto, notaControl, notaEvento, notaPreparatorio } from '../src/nucleo/motor.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const SIN_PREP = cfg.preparatorio.motivo_no_ingresa;
const SALIO = cfg.controlOral.salio.motivo_falta;
const SIN_GRUPO = cfg.asistencia.motivos.sin_grupo;
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);

/** GR2QB con 10 estudiantes ficticios: grupos 1 (a, b, c), 2 (d, e, f), 3 (g, h, i) y «j» sin grupo; «i» pendiente. */
async function cursoDePrueba() {
  const db = abrirBase(`clase-${randomUUID()}`);
  const grupos = { a: '1', b: '1', c: '1', d: '2', e: '2', f: '2', g: '3', h: '3', i: '3', j: null };
  await db.estudiantes.bulkPut(Object.entries(grupos).map(([id, g]) => ({
    id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} NOMBRE`, curso: 'GR2QB', estado: id === 'i' ? 'pendiente' : 'nomina', grupo_excel: g,
  })));
  const curso = cfg.cursoPorId.GR2QB;
  const eventos = generarEventos(cfg, curso);
  const cargar = async () => {
    const reg = await registrosDelCurso(db, 'GR2QB');
    return { reg, ctx: crearContexto(cfg, curso, eventos, reg) };
  };
  const p1 = eventos.find((e) => e.codigo === 'P1');
  const gruposP1 = async () => gruposDelEvento(p1, eventos, (await cargar()).reg).porEstudiante;
  return { db, eventos, p1, cargar, gruposP1 };
}

test('la primera evaluación de un grupo crea la instantánea de grupos del evento una sola vez', async () => {
  const { db, p1, gruposP1 } = await cursoDePrueba();
  await guardarPuntaje(db, p1.id, await gruposP1(), '1', 'diseno', 3);
  await guardarPuntaje(db, p1.id, await gruposP1(), '1', 'datos', 4);
  assert.equal(await db.grupos_evento.where('evento').equals(p1.id).count(), 10);
  assert.equal(await db.puntajes.count(), 2);
  await guardarPuntaje(db, p1.id, await gruposP1(), '1', 'datos', null);
  assert.equal(await db.puntajes.count(), 1, 'con null se borra el puntaje');
});

test('cerrar el pase: los de un grupo quedan presentes, quien no tiene grupo «no vino», lo ya marcado se respeta', async () => {
  const { db, p1, gruposP1, cargar } = await cursoDePrueba();
  await marcarAsistencia(db, p1.id, await gruposP1(), 'e', 'no_vino');
  const conteo = await cerrarPase(db, p1.id, await gruposP1(), SIN_GRUPO);
  assert.deepEqual(conteo, { presentes: 8, sin_grupo: 1, ya_registrados: 1 });
  const { reg } = await cargar();
  const estado = (id) => reg.asistencia.find((x) => x.estudiante === id);
  assert.equal(estado('a').estado, 'presente');
  assert.deepEqual([estado('j').estado, estado('j').motivo], ['no_vino', SIN_GRUPO]);
  assert.equal(estado('e').estado, 'no_vino');
  assert.equal(reg.pases[0].cerrado, true);
  await reabrirPase(db, p1.id);
  assert.equal((await db.pases.get(p1.id)).cerrado, false);
  assert.equal((await db.asistencia.get([p1.id, 'a'])).estado, 'presente', 'reabrir conserva lo registrado');
});

test('puerta: «no ingresa» deja la falta con motivo; al corregir la novedad, la falta se quita', async () => {
  const { db, p1 } = await cursoDePrueba();
  await guardarNovedad(db, p1.id, 'b', { nivel: 0, no_ingresa: true }, SIN_PREP);
  assert.deepEqual(await db.asistencia.get([p1.id, 'b']).then((x) => [x.estado, x.motivo]), ['no_vino', SIN_PREP]);
  await guardarNovedad(db, p1.id, 'b', { nivel: 1, no_ingresa: false }, SIN_PREP);
  assert.equal((await db.asistencia.get([p1.id, 'b'])).estado, null);
  await guardarNovedad(db, p1.id, 'c', { nivel: 0, no_ingresa: true }, SIN_PREP);
  await borrarNovedad(db, p1.id, 'c', SIN_PREP);
  assert.equal(await db.novedades_preparatorio.get([p1.id, 'c']), undefined);
  assert.equal((await db.asistencia.get([p1.id, 'c'])).estado, null);
});

test('control: sorteo en orden, puntajes por pregunta, «no está» y «salió» (falta); deshacer quita la falta', async () => {
  const { db, p1 } = await cursoDePrueba();
  await agregarAlControl(db, p1.id, ['a', 'd', 'g']);
  await agregarAlControl(db, p1.id, ['d', 'h']);
  const controles = await db.controles.where('evento').equals(p1.id).toArray();
  assert.deepEqual(controles.sort((x, y) => x.orden - y.orden).map((c) => [c.estudiante, c.orden]), [['a', 1], ['d', 2], ['g', 3], ['h', 4]]);
  await puntuarPregunta(db, p1.id, 'a', 0, 2);
  await puntuarPregunta(db, p1.id, 'a', 1, 1);
  assert.deepEqual((await db.controles.get([p1.id, 'a'])).puntajes, [2, 1]);
  await puntuarPregunta(db, p1.id, 'a', 1, null);
  assert.deepEqual((await db.controles.get([p1.id, 'a'])).puntajes, [2]);
  await marcarNoEsta(db, p1.id, 'g');
  assert.equal((await db.controles.get([p1.id, 'g'])).estado, 'no_esta');
  await marcarSalio(db, p1.id, 'd', SALIO);
  assert.deepEqual(await db.asistencia.get([p1.id, 'd']).then((x) => [x.estado, x.motivo]), ['salio', SALIO]);
  await quitarDelControl(db, p1.id, 'd', SALIO);
  assert.equal((await db.asistencia.get([p1.id, 'd'])).estado, null);
});

test('clase completa de P1 (Clásica): las notas coinciden con el cálculo manual', async () => {
  const { db, p1, eventos, gruposP1, cargar } = await cursoDePrueba();
  // Puerta: todos cumplieron salvo «b» (incompleto) y «c» (no lo hizo y no ingresa).
  await marcarRevisionPreparatorio(db, p1.id, true);
  await guardarNovedad(db, p1.id, 'b', { nivel: 1, no_ingresa: false }, SIN_PREP);
  await guardarNovedad(db, p1.id, 'c', { nivel: 0, no_ingresa: true }, SIN_PREP);
  // Control: «a» responde 2 y 1; «e» no está; «h» sale (no preparado).
  await agregarAlControl(db, p1.id, ['a', 'e', 'h']);
  await puntuarPregunta(db, p1.id, 'a', 0, 2);
  await puntuarPregunta(db, p1.id, 'a', 1, 1);
  await marcarNoEsta(db, p1.id, 'e');
  await marcarSalio(db, p1.id, 'h', SALIO);
  // Fin de clase: «j» (sin grupo) se suma al grupo 3; «g» se mueve al grupo 2; «f» no vino.
  await moverEstudiante(db, p1.id, await gruposP1(), 'j', '3');
  await moverEstudiante(db, p1.id, await gruposP1(), 'g', '2');
  await marcarAsistencia(db, p1.id, await gruposP1(), 'f', 'no_vino');
  await guardarObservacion(db, p1.id, 'i', 'Está pero no trabaja');
  // Evaluación: grupo 1 = 3/4/2 (0.70); grupo 2 = 4/4/4 (1.0); grupo 3 = 2/3/2 (0.575); el grupo 3 no ordenó el equipo.
  for (const [g, d, t, a] of [['1', 3, 4, 2], ['2', 4, 4, 4], ['3', 2, 3, 2]]) {
    await guardarPuntaje(db, p1.id, await gruposP1(), g, 'diseno', d);
    await guardarPuntaje(db, p1.id, await gruposP1(), g, 'datos', t);
    await guardarPuntaje(db, p1.id, await gruposP1(), g, 'analisis', a);
  }
  await alternarEtiqueta(db, p1.id, await gruposP1(), '1', 'montaje_ok');
  await guardarNotaProfesor(db, p1.id, 'grupo', '1', 'Buen montaje; revisar propagación.');
  await revisarGrupo(db, p1.id, await gruposP1(), '1', { verificado: true, trabajo_firmado: true });
  await revisarGrupo(db, p1.id, await gruposP1(), '3', { penalizacion_total: true, motivo_penalizacion: 'No guardó el equipo' });
  await guardarAjuste(db, p1.id, 'i', 0.4, 'Está pero no trabaja');
  await cerrarPase(db, p1.id, await gruposP1(), SIN_GRUPO);

  const { ctx } = await cargar();
  const nota = (id) => notaEvento(ctx, p1, id);
  // Práctica (0–1)
  cerca(nota('a').valor, 0.7);                          // grupo 1
  cerca(nota('b').valor, 0.7);                          // grupo 1 (su preparatorio es aparte)
  assert.deepEqual([nota('c').valor, nota('c').motivo], [0, 'no vino (sin preparatorio)']);
  cerca(nota('d').valor, 1);                            // grupo 2
  cerca(nota('e').valor, 1);                            // «no está» en el control, pero sí estuvo en la clase
  assert.deepEqual([nota('f').valor, nota('f').motivo], [0, 'no vino']);
  assert.equal(nota('g').grupo, '2');                   // movido: nota del grupo nuevo
  cerca(nota('g').valor, 1);
  assert.deepEqual([nota('h').valor, nota('h').motivo], [0, `salió (${SALIO})`]);
  assert.deepEqual([nota('i').valor, nota('i').valor_sin_ajuste, nota('i').pendiente_nomina], [0.4, 0, true]); // grupo 3 penalizado; ajuste explícito
  assert.equal(nota('j').grupo, '3');
  assert.deepEqual([nota('j').valor, nota('j').motivo], [0, 'penalización total (No guardó el equipo)']);
  // Preparatorio (nivel 0/1/2)
  const prep = (id) => notaPreparatorio(ctx, p1, id).nivel;
  assert.deepEqual(['a', 'b', 'c', 'f', 'h', 'j'].map(prep), [2, 1, 0, 0, 0, 2]);
  // Control
  cerca(notaControl(ctx, p1, 'a').valor, 0.75);
  assert.equal(notaControl(ctx, p1, 'e').estado, 'no_esta');
  assert.equal(notaControl(ctx, p1, 'h').valor, 0);
  // El siguiente evento hereda los cambios de grupo.
  const t1 = eventos.find((e) => e.codigo === 'T1');
  assert.equal(gruposDelEvento(t1, eventos, ctx.reg).porEstudiante.get('g'), '2');
  // Nada guardado contiene «@».
  for (const t of db.tables) assert.ok(!JSON.stringify(await t.toArray()).includes('@'), t.name);
});
