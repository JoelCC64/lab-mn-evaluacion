// Feedback (Fase 7) contra la base: texto por grupo (lo mejor / a mejorar / sugerencia, con la nota del profesor tal
// cual y el control oral), tono por metodología, versión corta, resumen del curso, TC por pregunta, retroalimentación
// del taller, ediciones guardadas, plantillas validadas y que ningún texto lleve nombres ni códigos.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import {
  agregarAlControl, alternarEtiqueta, alternarEtiquetaTrabajo, aprobarControl, cerrarPase, guardarFeedback,
  guardarNotaProfesor, guardarPuntaje, marcarEntrega, marcarFeedbackCopiado, marcarRevisionPreparatorio, puntuarPregunta,
  puntuarTrabajo, restaurarFeedback, revisarGrupo,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearContexto } from '../src/nucleo/motor.js';
import { enMinuscula, feedbackDelEvento, textosJuntos, tieneFeedback } from '../src/nucleo/feedback.js';
import { retroDelTaller } from '../src/nucleo/retro.js';
import { validarSemantica } from '../scripts/lib/config-disco.mjs';
import { configReal, copia } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-10-20T15:00:00.000Z';
const SIN_GRUPO = cfg.asistencia.motivos.sin_grupo;

/** Curso con estudiantes ficticios (códigos de 9 dígitos y nombres propios, para comprobar que no salen en los textos). */
async function curso(paralelo, grupos) {
  const db = abrirBase(`fb-${randomUUID()}`);
  const ids = Object.keys(grupos);
  await db.estudiantes.bulkPut(ids.map((id, i) => ({
    id, codigo: id, nombre: `PRUEBA${i}APELLIDO OTRO${i} NOMBRE${i}`, curso: paralelo, estado: 'nomina', grupo_excel: grupos[id], numero: i + 1,
  })));
  const c = cfg.cursoPorId[paralelo];
  const cargar = async () => {
    const reg = await registrosDelCurso(db, paralelo);
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return { reg, eventos, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  const evento = async (codigo) => (await cargar()).eventos.find((e) => e.codigo === codigo);
  const grupos_ = async (codigo) => { const { reg, eventos } = await cargar(); return gruposDelEvento(eventos.find((e) => e.codigo === codigo), eventos, reg).porEstudiante; };
  /** Rúbrica de cada grupo (`niveles`), etiquetas, notas del profesor, controles y pase. */
  async function sesion(codigo, { niveles, etiquetas = {}, notas = {}, controles = [] }) {
    const ev = await evento(codigo);
    const gr = await grupos_(codigo);
    await marcarRevisionPreparatorio(db, ev.id, true, AHORA);
    for (const [id, r] of controles) {
      await agregarAlControl(db, ev.id, [id], {}, AHORA);
      if (Array.isArray(r)) for (const [i, p] of r.entries()) await puntuarPregunta(db, ev.id, id, i, p, AHORA);
      else await aprobarControl(db, ev.id, id, r, AHORA);
    }
    const config = cfg.actividades[ev.config];
    const partes = config.criterios ? config.criterios.map((x) => x.id) : config.aspectos_aplicables ?? ['integral'];
    for (const [grupo, n] of Object.entries(niveles)) for (const [i, p] of partes.entries()) await guardarPuntaje(db, ev.id, gr, grupo, p, n[i], AHORA);
    for (const [grupo, lista] of Object.entries(etiquetas)) for (const t of lista) await alternarEtiqueta(db, ev.id, gr, grupo, t, AHORA);
    for (const [grupo, texto] of Object.entries(notas)) await guardarNotaProfesor(db, ev.id, 'grupo', grupo, texto, AHORA);
    await cerrarPase(db, ev.id, gr, SIN_GRUPO, AHORA);
    return ev;
  }
  return { db, ids, cargar, evento, grupos: grupos_, sesion };
}

/** Ningún texto del feedback (grupos, versión corta y resumen) lleva nombres ni códigos de estudiantes. */
async function sinDatosPersonales(k, fb) {
  const { reg } = await k.cargar();
  const textos = [...fb.unidades.flatMap((u) => [u.texto, u.corto]), fb.resumen.texto].join('\n');
  for (const e of reg.estudiantes) {
    assert.ok(!textos.includes(e.codigo), `aparece el código ${e.codigo}`);
    for (const parte of e.nombre.split(' ')) assert.ok(!textos.includes(parte), `aparece «${parte}»`);
  }
}

const unidad = (fb, id) => fb.unidades.find((u) => u.id === id);
const seccion = (texto, titulo) => {
  const lineas = texto.split('\n');
  const i = lineas.indexOf(titulo);
  if (i < 0) return null;
  const fin = lineas.findIndex((l, j) => j > i && l === '');
  return lineas.slice(i + 1, fin < 0 ? undefined : fin).map((l) => l.replace(/^• /, ''));
};

/** GR2QB (Clásica): P1 con tres grupos evaluados, etiquetas, una nota del profesor y dos controles. */
async function clasicaP1() {
  const k = await curso('GR2QB', {
    201900001: '1', 201900002: '1', 201900003: '1', 201900004: '2', 201900005: '2', 201900006: '2', 201900007: '3', 201900008: '3',
  });
  const p1 = await k.sesion('P1', {
    niveles: { 1: [4, 4, 1], 2: [2, 3, 4], 3: [3, 2, 1] },
    etiquetas: { 1: ['tabla_ok', 'propagacion_mal', 'sin_comparar'], 3: ['montaje_ok', 'propagacion_mal'] },
    notas: { 1: 'Buen trabajo en equipo; revisen σ_m.' },
    controles: [['201900001', [2, 2]], ['201900004', [0, 1]]],
  });
  return { k, p1 };
}

test('Clásica: el texto de cada grupo sale de lo registrado, con «lo mejor / a mejorar / sugerencia» y la nota del profesor tal cual', async () => {
  const { k, p1 } = await clasicaP1();
  const { ctx } = await k.cargar();
  assert.equal(tieneFeedback(p1), true);
  const fb = feedbackDelEvento(ctx, p1);
  assert.deepEqual(fb.titulos, { mejor: 'Lo mejor', mejorar: 'A mejorar', sugerencia: 'Sugerencia' });
  assert.deepEqual(fb.unidades.map((u) => u.id), ['1', '2', '3']);

  // Grupo 1: diseño 4, datos 4, análisis 1 → 0.2 + 0.3 + 0.5·0.25 = 6.25/10.
  const g1 = unidad(fb, '1');
  const lineas = g1.texto.split('\n');
  assert.equal(lineas[0], 'Grupo 1 · GR2QB · P1 Errores en las medidas');
  assert.equal(lineas[1], 'Nota del grupo: 6.25/10 (diseño 4/4 · datos 4/4 · análisis 1/4)');
  // Lo mejor: la etiqueta positiva (datos ya la explica), el diseño al máximo y el control oral (2/2 en todo).
  assert.deepEqual(seccion(g1.texto, 'Lo mejor'), [
    'Tabla ordenada y con unidades.', 'Diseño experimental correcto desde el inicio.', 'En el control oral, las respuestas fueron correctas y justificadas.',
  ]);
  // A mejorar: las dos etiquetas negativas del análisis (la frase general del análisis no se repite).
  assert.deepEqual(seccion(g1.texto, 'A mejorar'), ['La propagación de la incertidumbre en h_exp fue incorrecta.', 'No compararon h_exp con h1 dentro de la incertidumbre.']);
  // Sugerencia (Clásica: concreta y correctiva): las plantillas de esas etiquetas.
  const sug = seccion(g1.texto, 'Sugerencia');
  assert.equal(sug.length, 2);
  assert.match(sug[0], /^En h_exp = g·t²\/2, la incertidumbre relativa de h es el doble de la del tiempo/);
  assert.match(sug[1], /^Comparen h_exp ± δh con h1/);
  assert.ok(sug.every((s) => !s.startsWith('¿')), 'en Clásica no se sugiere con preguntas');
  assert.equal(lineas.at(-1), 'Comentario del profesor: Buen trabajo en equipo; revisen σ_m.');

  // Grupo 2: diseño 2/4 (nota baja) → la frase del diseño; análisis 4/4 → lo mejor; el control oral salió mal (1/4).
  const g2 = unidad(fb, '2');
  assert.match(g2.texto, /Nota del grupo: 8\.25\/10 \(diseño 2\/4 · datos 3\/4 · análisis 4\/4\)/);
  assert.deepEqual(seccion(g2.texto, 'Lo mejor'), ['Análisis correcto, con incertidumbres y una discusión basada en sus datos.']);
  assert.deepEqual(seccion(g2.texto, 'A mejorar'), [
    'El diseño experimental necesitó correcciones (montaje, protocolo de medición o errores identificados antes de medir).',
    'En el control oral hubo respuestas incompletas o incorrectas sobre la guía y el coloquio.',
  ]);
  assert.equal(seccion(g2.texto, 'Sugerencia').length, 2);
  assert.ok(!g2.texto.includes('Comentario del profesor'));

  // Grupo 3: lo peor primero (análisis 1/4 con su etiqueta, luego datos 2/4).
  const g3 = unidad(fb, '3');
  assert.deepEqual(seccion(g3.texto, 'Lo mejor'), ['Montaje correcto y alturas verificadas.']);
  assert.deepEqual(seccion(g3.texto, 'A mejorar'), [
    'La propagación de la incertidumbre en h_exp fue incorrecta.',
    'La toma de datos quedó incompleta o desordenada (tabla, unidades o condiciones de medición).',
  ]);
  await sinDatosPersonales(k, fb);
});

test('versión corta (2 o 3 líneas) y resumen del curso con las etiquetas más marcadas y qué reforzar', async () => {
  const { k, p1 } = await clasicaP1();
  const { ctx } = await k.cargar();
  const fb = feedbackDelEvento(ctx, p1);
  for (const u of fb.unidades) assert.ok(u.corto.split('\n').length <= 3, u.corto);
  assert.deepEqual(unidad(fb, '1').corto.split('\n'), [
    'Grupo 1 · 6.25/10',
    'Lo mejor: tabla ordenada y con unidades. A mejorar: la propagación de la incertidumbre en h_exp fue incorrecta.',
    `Sugerencia: ${enMinuscula(cfg.actividades['P1-TRAD'].feedback.etiquetas.propagacion_mal.sugerencia)}`,
  ]);
  assert.equal(textosJuntos(fb, 'corto').split('\n\n').length, 3);

  const r = fb.resumen;
  assert.deepEqual([r.evaluadas, r.completas, r.total], [3, 3, 3]);
  assert.ok(Math.abs(r.promedio - 0.625) < 1e-9, 'promedio de los grupos: (6.25 + 8.25 + 4.25)/3');
  assert.deepEqual(r.partes.map((p) => [p.id, Math.round(p.promedio * 100) / 100]), [['analisis', 2], ['diseno', 3], ['datos', 3]]);
  assert.deepEqual(r.etiquetas.map((e) => [e.id, e.n]), [['propagacion_mal', 2], ['montaje_ok', 1], ['tabla_ok', 1], ['sin_comparar', 1]]);
  assert.deepEqual(r.control, { n: 2, promedio: 0.625 });
  assert.deepEqual(r.reforzar, ['Propagación de la incertidumbre en h_exp = g·t²/2.', 'Propagación de incertidumbres y discusión de los resultados con los datos propios.']);
  const t = r.texto.split('\n');
  assert.equal(t[0], 'Resumen del curso · GR2QB · P1 Errores en las medidas');
  assert.equal(t[1], '3 de 3 grupos evaluados · promedio de los grupos 6.25/10');
  assert.deepEqual(seccion(r.texto, 'Por sección (promedio)'), ['Análisis: 2/4', 'Diseño experimental: 3/4', 'Toma de datos: 3/4']);
  assert.equal(seccion(r.texto, 'Etiquetas más marcadas')[0], '− Propagación de incertidumbre incorrecta en h_exp: 2 de 3 grupos');
  assert.ok(t.includes('Control oral: 2 estudiantes · promedio 6.25/10'));
  assert.equal(seccion(r.texto, 'Qué reforzar').length, 2);
});

test('SQI: el tono invita a preguntar («Para explorar»), y sin nada que corregir propone una pregunta del banco', async () => {
  const k = await curso('GR1AA', { 202000001: '1', 202000002: '1', 202000003: '2', 202000004: '2' });
  const p1 = await k.sesion('P1', {
    niveles: { 1: [2, 1, 1], 2: [2, 2, 1] },
    etiquetas: { 1: ['registro_incompleto', 'justifica_eleccion'] },
    controles: [['202000001', true]],
  });
  const { ctx } = await k.cargar();
  const fb = feedbackDelEvento(ctx, p1);
  assert.equal(fb.titulos.sugerencia, 'Para explorar');
  const g1 = unidad(fb, '1');
  assert.match(g1.texto, /Nota del grupo: 8\/10 \(respuestas 2\/2 · ejecución 1\/2 · discusión 1\/1\)/);
  assert.deepEqual(seccion(g1.texto, 'Lo mejor'), [
    'Justificaron con razonamiento su elección de la medición más confiable.', 'Participaron en la discusión y la registraron.',
    'En el control oral mostraron que prepararon la guía.',
  ]);
  assert.deepEqual(seccion(g1.texto, 'A mejorar'), ['Registro sin unidades o incompleto.']);
  const explorar = seccion(g1.texto, 'Para explorar');
  assert.ok(explorar.length >= 1 && explorar.every((s) => s.startsWith('¿') || s.startsWith('Si ')), explorar.join('\n'));
  // Grupo 2: todo al máximo → nada que corregir y una pregunta del banco de la práctica para extender.
  const g2 = unidad(fb, '2');
  assert.deepEqual(seccion(g2.texto, 'A mejorar'), ['Nada que corregir en lo registrado.']);
  assert.deepEqual(seccion(g2.texto, 'Para explorar'), [cfg.actividades['P1-SQI'].preguntas_discusion[1]]);
  assert.equal(seccion(fb.resumen.texto, 'Por aspecto (promedio)')[0], 'Ejecución y registro de datos: 1.5/2');
  assert.ok(fb.resumen.texto.includes('Control oral: 1 de 1 aprobados'));
  await sinDatosPersonales(k, fb);
});

test('TC: el feedback va pregunta por pregunta y el resumen lista las preguntas con más errores', async () => {
  const k = await curso('GR1AA', { 202000001: '1', 202000002: '1', 202000003: '2', 202000004: '2', 202000005: '3', 202000006: '3' });
  await k.sesion('P1', { niveles: { 1: [2, 2, 1], 2: [2, 2, 1], 3: [2, 2, 1] } });
  const tc1 = await k.evento('TC1');
  const ids = cfg.actividades['TC1-SQI'].preguntas.map((p) => p.id);
  const calificar = async (grupo, puntajes) => { for (const [i, v] of puntajes.entries()) await puntuarTrabajo(k.db, tc1.id, 'grupo', grupo, ids[i], v, AHORA); };
  await calificar('1', [1, 2, 1, 0.5, 1, 1, 0, 1]);
  await alternarEtiquetaTrabajo(k.db, tc1.id, 'grupo', '1', 'confunde_inc_media', AHORA);
  await marcarEntrega(k.db, tc1.id, 'grupo', '2', false, AHORA);
  await calificar('3', [1, 0, 1, 1, 1, 1, 0, 2]);
  const { ctx } = await k.cargar();
  const fb = feedbackDelEvento(ctx, tc1);

  const g1 = unidad(fb, '1');
  assert.equal(g1.texto.split('\n')[0], 'Grupo 1 · GR1AA · TC1 Introducción');
  assert.equal(g1.texto.split('\n')[1], 'Nota del TC1: 7.5/10 (1a 1/1 · 1b 2/2 · 2a-i 1/1 · 2a-ii 0.5/1 · 2b-i 1/1 · 2b-ii 1/1 · 2c 0/1 · 2d 1/2)');
  assert.deepEqual(seccion(g1.texto, 'Lo mejor'), ['Puntaje completo en 1a, 1b, 2a-i, 2b-i y 2b-ii.']);
  // La etiqueta de 2c reemplaza la frase de la pregunta; después, lo que tiene puntaje parcial.
  assert.deepEqual(seccion(g1.texto, 'A mejorar'), [
    'Confundieron la incertidumbre individual con la de la media.',
    'La incertidumbre de las mediciones individuales desde la posición más baja no quedó bien calculada (2a-ii).',
    'La elección del método más confiable no se justificó con sus resultados (2d).',
  ]);
  assert.equal(seccion(g1.texto, 'Para explorar')[0], 'Si midieran 100 veces, ¿cuál de las dos incertidumbres se reduciría y cuál no? ¿Por qué?');
  assert.deepEqual(unidad(fb, '2').texto.split('\n').slice(1), ['Nota del TC1: 0/10 (no entregaron)', '', 'A mejorar', '• No entregaron el TC1: la nota es 0.']);
  assert.equal(unidad(fb, '2').corto, 'Grupo 2 · no entregó (0)\nA mejorar: no entregaron el TC1: la nota es 0.');

  const r = fb.resumen;
  assert.deepEqual([r.completas, r.noEntregaron], [3, 1]);
  assert.ok(Math.abs(r.promedio - 0.725) < 1e-9, 'promedio de los entregados: (7.5 + 7)/2');
  assert.deepEqual(r.preguntas.slice(0, 4).map((q) => [q.id, q.conError, q.n]), [['2c', 2, 2], ['1b', 1, 2], ['2a-ii', 1, 2], ['2d', 1, 2]]);
  assert.deepEqual(r.reforzar, [
    'Diferencia entre la incertidumbre individual y la de la media.',
    '1b: Los cinco objetivos de aprendizaje aplicados a sus intereses profesionales',
    'Incertidumbre de una medición individual (dispersión de los datos).',
  ]);
  const t = r.texto.split('\n');
  assert.equal(t[1], '3 de 3 grupos calificados · 1 no entregó · promedio de los trabajos entregados 7.25/10');
  assert.equal(seccion(r.texto, 'Preguntas con más errores')[0], '2c (Diferencia entre la incertidumbre individual y la de la media): 2 de 2 sin el puntaje completo · promedio 0/1');
  await sinDatosPersonales(k, fb);
});

test('taller: las plantillas con una frase por metodología y la retro del taller con la versión corta de la práctica anterior', async () => {
  const k = await curso('GR2QB', { 201900001: '1', 201900002: '1', 201900003: '2', 201900004: '2' });
  const p1 = await k.sesion('P1', { niveles: { 1: [4, 4, 1], 2: [3, 3, 3] }, etiquetas: { 1: ['propagacion_mal'] } });
  const t1 = await k.sesion('T1', { niveles: { 1: [1], 2: [2] }, etiquetas: { 1: ['confunde_exac_prec'] } });
  const { ctx } = await k.cargar();
  const fbT = feedbackDelEvento(ctx, t1);
  const g1 = unidad(fbT, '1');
  assert.equal(g1.texto.split('\n')[1], 'Evaluación integral del grupo: 1/2');
  // La etiqueta (sin parte) se refiere a la evaluación integral: su frase reemplaza la general.
  assert.deepEqual(seccion(g1.texto, 'A mejorar'), ['Confundieron exactitud con precisión.']);
  assert.match(seccion(g1.texto, 'Sugerencia')[0], /^Exactitud es cercanía al valor de referencia/, 'la variante de Clásica');
  assert.deepEqual(seccion(unidad(fbT, '2').texto, 'Lo mejor'), ['Buen trabajo en las tareas y en las preguntas del taller.']);
  assert.match(fbT.resumen.texto, /promedio de la evaluación integral 1\.5\/2/);

  // Retro del T1: la versión corta del feedback de P1, grupo por grupo.
  const retro = retroDelTaller(ctx, t1);
  const fbP = feedbackDelEvento(ctx, p1);
  assert.deepEqual(retro.grupos.map((g) => g.corto), fbP.unidades.map((u) => u.corto));
  assert.match(retro.grupos[0].corto, /^Grupo 1 · 6\.25\/10\n/);
});

test('el texto editado se guarda; si lo registrado cambia después, la app lo avisa; se puede volver al generado', async () => {
  const { k, p1 } = await clasicaP1();
  let { ctx } = await k.cargar();
  const generado = unidad(feedbackDelEvento(ctx, p1), '1').texto;
  await guardarFeedback(k.db, p1.id, 'grupo', '1', generado, generado, AHORA);
  ({ ctx } = await k.cargar());
  assert.equal(unidad(feedbackDelEvento(ctx, p1), '1').editado, false, 'igual al generado: no cuenta como edición');

  const editado = `${generado}\nNos vemos en el taller.`;
  await guardarFeedback(k.db, p1.id, 'grupo', '1', editado, generado, AHORA);
  await marcarFeedbackCopiado(k.db, p1.id, [{ unidad: 'grupo', id: '1' }, { unidad: 'grupo', id: '2' }], AHORA);
  ({ ctx } = await k.cargar());
  let u = unidad(feedbackDelEvento(ctx, p1), '1');
  assert.deepEqual([u.editado, u.texto, u.desactualizado, u.copiado], [true, editado, false, AHORA]);
  assert.equal(unidad(feedbackDelEvento(ctx, p1), '2').copiado, AHORA);

  // Cambia la rúbrica del grupo 1: el texto editado se conserva, con aviso.
  await guardarPuntaje(k.db, p1.id, await k.grupos('P1'), '1', 'analisis', 4, AHORA);
  ({ ctx } = await k.cargar());
  u = unidad(feedbackDelEvento(ctx, p1), '1');
  assert.deepEqual([u.editado, u.texto, u.desactualizado], [true, editado, true]);
  assert.match(u.generado, /Nota del grupo: 10\/10/);

  await restaurarFeedback(k.db, p1.id, 'grupo', '1', AHORA);
  ({ ctx } = await k.cargar());
  u = unidad(feedbackDelEvento(ctx, p1), '1');
  assert.deepEqual([u.editado, u.texto === u.generado, u.copiado], [false, true, AHORA]);
});

test('grupos sin evaluar no llevan texto; la penalización total va primero', async () => {
  const k = await curso('GR2QB', { 201900001: '1', 201900002: '1', 201900003: '2', 201900004: '2', 201900005: '3' });
  const p1 = await k.sesion('P1', { niveles: { 1: [4, 4, 4] } });
  await revisarGrupo(k.db, p1.id, await k.grupos('P1'), '1', { penalizacion_total: true, motivo_penalizacion: 'No desmontó ni guardó el equipo' }, AHORA);
  const { ctx } = await k.cargar();
  const fb = feedbackDelEvento(ctx, p1);
  assert.deepEqual(fb.unidades.map((u) => [u.id, u.vacio]), [['1', false], ['2', true], ['3', true]]);
  assert.equal(unidad(fb, '2').texto, '');
  assert.equal(textosJuntos(fb).match(/^Grupo \d+ · /gm).length, 1, 'copiar todos: solo los grupos con algo registrado');
  const g1 = unidad(fb, '1');
  assert.equal(g1.texto.split('\n')[1], 'Nota del grupo: 0/10 (penalización total)');
  assert.equal(seccion(g1.texto, 'A mejorar')[0], 'Penalización total en P1: No desmontó ni guardó el equipo. La nota es 0.');
  assert.equal(fb.resumen.texto.split('\n')[1], '1 de 3 grupos evaluados · promedio de los grupos 0/10');
});

test('las plantillas de feedback de la configuración se validan contra sus etiquetas y partes', () => {
  const c = copia(cfg);
  assert.deepEqual(validarSemantica(c), []);
  const fb = c.actividades['P1-TRAD'].feedback;
  fb.etiquetas.inventada = { sugerencia: 'x' };
  fb.etiquetas.tabla_ok = { mejorar: 'no' };
  fb.partes = { campo_inexistente: { mejorar: 'x' } };
  c.feedback.partes.SQI.otro = { mejor: 'x' };
  const errores = validarSemantica(c).join('\n');
  assert.match(errores, /etiqueta que no existe \(inventada\)/);
  assert.match(errores, /la etiqueta positiva tabla_ok no lleva «mejorar»/);
  assert.match(errores, /parte que no existe \(campo_inexistente\)/);
  assert.match(errores, /feedback: otro no es un aspecto SQI/);
  // El tono de SQI en las plantillas por defecto: las sugerencias son preguntas.
  for (const p of Object.values(cfg.feedback.partes.SQI)) assert.match(p.sugerencia, /¿.+\?/);
});

test('primera letra en minúscula tras dos puntos, salvo siglas, símbolos y números', () => {
  assert.equal(enMinuscula('Tabla ordenada.'), 'tabla ordenada.');
  assert.equal(enMinuscula('¿Qué esperaban?'), '¿qué esperaban?');
  assert.equal(enMinuscula('PLIC no válido.'), 'PLIC no válido.');
  assert.equal(enMinuscula('2c: diferencia'), '2c: diferencia');
  assert.equal(enMinuscula('h_exp mal calculada'), 'h_exp mal calculada');
});
