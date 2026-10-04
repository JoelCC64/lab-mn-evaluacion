// Métricas (Fase 8): tablero con datos ficticios de varios eventos y lámina exportable (imagen o PDF), sin nombres;
// asistencia, rúbricas, control oral por concepto, preparatorio, TC, riesgo, feriados, comparación entre cursos y
// metodologías (solo normalizada), advertencias obligatorias y el simulador de la demostración.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cargarCursos } from '../src/datos/excel-datos.js';
import { leerExcelSemestre } from '../src/nucleo/excel-lectura.js';
import { aplicarExcelSemestre } from '../src/datos/importar.js';
import { simularClases } from '../src/datos/simulacion.js';
import {
  agregarAlControl, alternarEtiqueta, aprobarControl, cerrarPase, elegirConcepto, guardarNovedad, guardarPuntaje,
  guardarRecuperacion, marcarAsistencia, marcarEntrega, marcarRevisionPreparatorio, puntuarPregunta, puntuarTrabajo, revisarGrupo,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { alcances, calcularMetricas, franjasDeUnaMetodologia } from '../src/nucleo/metricas.js';
import { laminaContinua, laminaEnPaginas, seccionesDelTablero, textoDeSvg } from '../src/nucleo/tablero.js';
import { anchoTexto, envolver, esc, recortar } from '../src/nucleo/graficos.js';
import { pdfDeImagenes, textoPdf } from '../src/nucleo/pdf.js';
import { leerConfigDisco, validarSemantica } from '../scripts/lib/config-disco.mjs';
import { EXCEL_EJEMPLO, configReal, copia } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-11-20T15:00:00.000Z';
const HOY = '2026-11-20';
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);
const SIN_GRUPO = cfg.asistencia.motivos.sin_grupo;

/** Base de demostración con el Excel ficticio y clases simuladas hasta la semana `hasta`. */
async function demoSimulada(hasta = 9, semilla = 7) {
  const db = abrirBase(`met-${randomUUID()}-demo`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_EJEMPLO);
  await aplicarExcelSemestre(db, leerExcelSemestre(wb, cfg), { ahora: AHORA });
  const r = await simularClases(db, cfg, { hastaSemana: hasta, semilla, ahora: AHORA });
  return { db, r };
}

/** Un curso con estudiantes ficticios: `grupos` = { id: grupo }. */
async function curso(db, paralelo, grupos) {
  await db.estudiantes.bulkPut(Object.entries(grupos).map(([id, g], i) => ({
    id: `${paralelo}-${id}`, codigo: `${paralelo}-${id}`, nombre: `APELLIDO${id.toUpperCase()} OTRO NOMBRE${id.toUpperCase()}`,
    curso: paralelo, estado: 'nomina', grupo_excel: g, numero: i + 1,
  })));
  const c = cfg.cursoPorId[paralelo];
  const evento = async (codigo) => {
    const reg = await registrosDelCurso(db, paralelo);
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    const e = eventos.find((x) => x.codigo === codigo);
    return { e, grupos: gruposDelEvento(e, eventos, reg).porEstudiante };
  };
  const id = (x) => `${paralelo}-${x}`;
  /** Sesión con niveles por grupo (en el orden de la rúbrica), faltas, retiros y cierre del pase. */
  async function sesion(codigo, { niveles = {}, faltan = [], retirados = [], etiquetas = {} } = {}) {
    const { e, grupos } = await evento(codigo);
    await marcarRevisionPreparatorio(db, e.id, true, AHORA);
    const config = cfg.actividades[e.config];
    const partes = config ? (config.criterios ? config.criterios.map((x) => x.id) : config.aspectos_aplicables ?? ['integral']) : [];
    for (const [g, n] of Object.entries(niveles)) for (const [i, p] of partes.entries()) await guardarPuntaje(db, e.id, grupos, g, p, n[i], AHORA);
    for (const [g, ts] of Object.entries(etiquetas)) for (const t of ts) await alternarEtiqueta(db, e.id, grupos, g, t, AHORA);
    for (const x of faltan) await marcarAsistencia(db, e.id, grupos, id(x), 'no_vino', null, AHORA);
    for (const x of retirados) await marcarAsistencia(db, e.id, grupos, id(x), 'se_retiro_antes', null, AHORA);
    await cerrarPase(db, e.id, grupos, SIN_GRUPO, AHORA);
    return e;
  }
  return { evento, sesion, id };
}

const metricas = async (db, opciones) => calcularMetricas(cfg, await cargarCursos(db, cfg), { hoy: HOY, bimestre: 1, ...opciones });

test('listo cuando: con datos ficticios de varios eventos se arma el tablero y la lámina (imagen y PDF) sin nombres', async () => {
  const { db, r } = await demoSimulada();
  assert.equal(r.cursos, 10);
  assert.ok(r.eventos >= 70, `eventos simulados: ${r.eventos}`);
  const cursos = await cargarCursos(db, cfg);
  const m = calcularMetricas(cfg, cursos, { alcance: 'todos', bimestre: 1, hoy: HOY });

  // Varios eventos: sesiones con pase en todos los cursos, rúbricas de P1 y T1, TC1–TC3, control y preparatorio.
  assert.equal(m.generales.cursos, 10);
  assert.ok(m.asistencia.porEvento.map((x) => x.codigo).join().includes('P1,T1'), m.asistencia.porEvento.map((x) => x.codigo).join());
  assert.ok(m.asistencia.porEvento.length >= 7);
  assert.deepEqual(m.rubricas.map((x) => x.clave), ['P1-TRAD|TRAD', 'P1-SQI|SQI', 'T1|TRAD', 'T1|SQI']);
  assert.deepEqual(m.trabajos.map((x) => x.codigo), ['TC1', 'TC2', 'TC3']);
  assert.equal(m.control.cobertura.length, 10);
  assert.ok(m.preparatorio.length >= 5, 'preparatorio en P1, T1, P2, T2/P3, T3 (Clásica)');
  assert.ok(m.evolucion.every((e) => e.puntos.length >= 5));
  assert.ok(m.control.conceptos.length > 0, 'conceptos del control registrados');
  assert.ok(m.etiquetas.length > 0);
  assert.equal(m.comparacion.length, 2);

  // Advertencias obligatorias: muestras pequeñas, franja de 07:00 solo SQI y metodologías (descripción, no causa).
  const adv = Object.fromEntries(m.advertencias.map((a) => [a.id, a.texto]));
  assert.match(adv.muestras, /unos 20 estudiantes por curso/);
  assert.match(adv.franjas, /^La franja 07:00–09:00 solo tiene cursos SQI; las franjas 09:00–11:00, 11:00–13:00, 14:00–16:00 y 16:00–18:00 solo tienen cursos Clásica\./);
  assert.match(adv.metodologias, /no es una comparación causal/);
  assert.match(adv.metodologias, /nunca la nota total/);

  // La lámina: páginas A4, con las advertencias y sin un solo nombre ni código de estudiante.
  const secciones = seccionesDelTablero(m, cfg);
  const cabecera = { titulo: 'Métricas · Lab. MN 2026B', detalle: 'Todos los cursos · 1.er bimestre', fecha: '20 de noviembre de 2026', demo: true, presentar: cfg.metricas.advertencias.presentar };
  const paginas = laminaEnPaginas(secciones, cabecera);
  assert.ok(paginas.length >= 3, `páginas: ${paginas.length}`);
  for (const p of paginas) {
    assert.match(p, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="720" height="1018"/);
    assert.ok(p.endsWith('</svg>'));
  }
  const continua = laminaContinua(secciones, cabecera);
  const texto = textoDeSvg(paginas.join('') + continua);
  const plano = texto.replace(/\s+/g, ' ');   // las frases largas van en varias líneas
  for (const t of ['Antes de leer', 'Asistencia por curso', 'Evolución entre eventos', 'P1 · Clásica: puntajes por criterio',
    'TC1: entregas y puntaje por pregunta', 'Control oral: cobertura', 'Control oral: resultados', 'Trabajo preparatorio (Clásica)',
    'Feriados y sesiones sin clase', 'Comparación entre cursos', 'Comparación entre metodologías', 'Seguimiento', 'no es una comparación causal']) {
    assert.ok(plano.includes(t), `falta «${t}» en la lámina`);
  }
  const estudiantes = cursos.flatMap((c) => c.reg.estudiantes);
  for (const e of estudiantes) {
    const apellido = e.nombre.split(' ')[0];
    assert.ok(!texto.includes(e.codigo), `código ${e.codigo} en la lámina`);
    assert.ok(!new RegExp(`\\b${apellido}\\b`).test(texto), `apellido ${apellido} en la lámina`);
  }
  // Ni siquiera dentro de atributos o textos ocultos del SVG.
  const crudo = paginas.join('') + continua;
  assert.ok(!estudiantes.some((e) => crudo.includes(e.codigo) || crudo.includes(e.nombre)));

  // PDF de varias páginas con imágenes (aquí, JPEG de prueba): estructura válida y desplazamientos correctos.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = pdfDeImagenes(paginas.map(() => ({ jpeg, ancho: 1800, alto: 2545 })), { titulo: cabecera.titulo });
  const crudoPdf = new TextDecoder('latin1').decode(pdf);
  assert.ok(crudoPdf.startsWith('%PDF-1.4'));
  assert.ok(crudoPdf.trimEnd().endsWith('%%EOF'));
  assert.match(crudoPdf, new RegExp(`/Count ${paginas.length} `));
  const xref = Number(/startxref\n(\d+)/.exec(crudoPdf)[1]);
  assert.ok(crudoPdf.slice(xref).startsWith('xref'));
  const offsets = [...crudoPdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((x) => Number(x[1]));
  assert.equal(offsets.length, 3 + 3 * paginas.length);
  offsets.forEach((o, i) => assert.ok(crudoPdf.slice(o).startsWith(`${i + 1} 0 obj`), `objeto ${i + 1}`));
});

test('el simulador solo trabaja en la demostración, no toca lo registrado a mano y con la misma semilla repite las clases', async () => {
  const real = abrirBase(`met-${randomUUID()}`);
  await assert.rejects(simularClases(real, cfg, {}), /solo se pueden simular en la demostración/);

  const db = abrirBase(`met-${randomUUID()}-demo`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_EJEMPLO);
  await aplicarExcelSemestre(db, leerExcelSemestre(wb, cfg), { ahora: AHORA });
  // Algo registrado a mano en P1 de GR2QB (sin cerrar el pase): el simulador no lo toca.
  await marcarRevisionPreparatorio(db, 'GR2QB:P1', true, AHORA);
  const antes = await registrosDelCurso(db, 'GR2QB');
  await simularClases(db, cfg, { hastaSemana: 5, semilla: 3, ahora: AHORA });
  const despues = await registrosDelCurso(db, 'GR2QB');
  assert.equal(despues.pases.some((p) => p.evento === 'GR2QB:P1'), false);
  assert.equal(despues.asistencia.filter((a) => a.evento === 'GR2QB:P1').length, antes.asistencia.filter((a) => a.evento === 'GR2QB:P1').length);
  assert.ok(despues.pases.some((p) => p.evento === 'GR2QB:T1' && p.cerrado));
  // Nada después de la semana 5.
  const eventos = generarEventos(cfg, cfg.cursoPorId.GR2QB, despues.cambios_evento);
  assert.ok(despues.pases.every((p) => eventos.find((e) => e.id === p.evento).semana <= 5));
  // Volver a simular no duplica ni cambia lo ya simulado.
  const n = (await registrosDelCurso(db, 'GR2QB')).puntajes.length;
  const r = await simularClases(db, cfg, { hastaSemana: 5, semilla: 3, ahora: AHORA });
  assert.equal((await registrosDelCurso(db, 'GR2QB')).puntajes.length, n);
  assert.equal(r.eventos, 0);

  const a = await demoSimulada(9, 11);
  const b = await demoSimulada(9, 11);
  const ma = await metricas(a.db, {});
  const mb = await metricas(b.db, {});
  assert.deepEqual(ma.generales, mb.generales);
  assert.deepEqual(ma.rubricas.map((x) => x.media), mb.rubricas.map((x) => x.media));
});

test('asistencia y permanencia por curso, sesión, día, franja, grupo y estudiante (con los conteos a mano)', async () => {
  const db = abrirBase(`met-${randomUUID()}`);
  const k = await curso(db, 'GR2QB', { a: '1', b: '1', c: '2', d: '2', e: '2' });
  await k.sesion('P1', { niveles: { 1: [4, 4, 4], 2: [2, 2, 2] }, faltan: ['a'], retirados: ['c'] });
  await k.sesion('T1', { niveles: { 1: [2], 2: [1] }, faltan: ['a', 'd'] });
  const m = await metricas(db, { alcance: 'GR2QB' });

  assert.equal(m.unCurso, true);
  assert.equal(m.asistencia.sesiones, 2);
  const t = m.asistencia.total;
  assert.deepEqual([t.n, t.presentes, t.retiros, t.faltas], [10, 6, 1, 3]);
  cerca(t.asistencia, 0.7);
  cerca(t.permanencia, 6 / 7);
  const [p1, t1] = m.asistencia.porEvento;
  assert.deepEqual([p1.codigo, p1.faltas, p1.retiros, t1.codigo, t1.faltas], ['P1', 1, 1, 'T1', 2]);
  cerca(p1.asistencia, 0.8);
  cerca(p1.permanencia, 3 / 4);
  assert.deepEqual(m.asistencia.porDia.map((x) => x.etiqueta), ['Lunes']);
  assert.deepEqual(m.asistencia.porFranja.map((x) => [x.etiqueta, x.metodologias]), [['09:00–11:00', ['TRAD']]]);
  assert.deepEqual(m.asistencia.porGrupo.map((x) => [x.etiqueta, x.faltas]), [['Grupo 1', 2], ['Grupo 2', 1]]);
  const a = m.asistencia.porEstudiante[0];
  assert.deepEqual([a.estudiante.id, a.faltas, a.faltasEn], ['GR2QB-a', 2, ['P1', 'T1']]);
  // Un solo curso y una sola metodología: sin advertencia de franjas ni de metodologías.
  assert.deepEqual(m.advertencias.map((x) => x.id), ['muestras']);
  // a faltó a las dos sesiones con nota: en riesgo por faltas (umbral 2). d faltó a una.
  const riesgo = new Map(m.riesgo.estudiantes.map((x) => [x.estudiante.id, x.motivos.map((y) => y.tipo)]));
  assert.ok(riesgo.get('GR2QB-a').includes('faltas'));
  assert.ok(!riesgo.get('GR2QB-d')?.includes('faltas'));
});

test('rúbricas: distribución por criterio y aspecto, etiquetas, penalización y comparación de metodologías normalizada', async () => {
  const db = abrirBase(`met-${randomUUID()}`);
  const trad = await curso(db, 'GR2QB', { a: '1', b: '1', c: '2', d: '2', e: '3', f: '3' });
  await trad.sesion('P1', { niveles: { 1: [4, 4, 4], 2: [2, 3, 1] }, etiquetas: { 1: ['montaje_ok'], 2: ['h_mal_medida', 'propagacion_mal'] } });
  const { e: p1, grupos } = await trad.evento('P1');
  await revisarGrupo(db, p1.id, grupos, '3', { penalizacion_total: true, motivo_penalizacion: 'Equipo no ordenado' }, AHORA);
  await trad.sesion('T1', { niveles: { 1: [2], 2: [1], 3: [0] } });
  const sqi = await curso(db, 'GR1AA', { a: '1', b: '1', c: '2', d: '2' });
  await sqi.sesion('P1', { niveles: { 1: [2, 2, 1], 2: [1, 0, 0] } });
  await sqi.sesion('T1', { niveles: { 1: [2], 2: [2] } });

  const m = await metricas(db, {});
  const rP1 = m.rubricas.find((x) => x.clave === 'P1-TRAD|TRAD');
  assert.deepEqual([rP1.grupos, rP1.penalizados], [3, 1]);
  const diseno = rP1.partes.find((p) => p.id === 'diseno');
  assert.deepEqual(diseno.niveles.map((n) => n.n), [0, 0, 1, 0, 1]);   // niveles 0–4: un 2 y un 4
  cerca(diseno.media, (2 / 4 + 1) / 2);
  // Nota media de P1 Clásica: grupo 1 = 1; grupo 2 = 0.2·0.5 + 0.3·0.75 + 0.5·0.25 = 0.45; grupo 3 = 0 (penalización).
  cerca(rP1.media, (1 + 0.45 + 0) / 3);
  assert.deepEqual(rP1.etiquetas.map((t) => [t.id, t.n, t.de]), [['h_mal_medida', 1, 3], ['montaje_ok', 1, 3], ['propagacion_mal', 1, 3]]);
  // SQI: escalas distintas por aspecto (2/1/0 y 1/0), una barra por aspecto.
  const rSqi = m.rubricas.find((x) => x.clave === 'P1-SQI|SQI');
  assert.deepEqual(rSqi.partes.map((p) => p.niveles.map((n) => n.nivel).join()), ['0,1,2', '0,1,2', '0,1']);
  // T1 por metodología, sin mezclar.
  assert.deepEqual(m.rubricas.filter((x) => x.codigo === 'T1').map((x) => [x.metodologia, x.grupos]), [['TRAD', 3], ['SQI', 2]]);

  // Comparación de metodologías: solo prácticas y talleres, normalizadas; nunca la nota total.
  const [practicas, talleres] = m.comparacion;
  assert.deepEqual([practicas.id, talleres.id], ['practicas', 'talleres']);
  const sq = practicas.porMetodologia.find((x) => x.metodologia === 'SQI');
  cerca(sq.media, (5 / 5 + 1 / 5) / 2);   // P1 SQI: 5 y 1 de los 5 puntos posibles (2 + 2 + 1)
  cerca(talleres.porMetodologia.find((x) => x.metodologia === 'TRAD').media, (1 + 0.5 + 0) / 3);
  assert.equal(m.comparacion.flatMap((c) => c.porMetodologia).some((x) => 'total' in x), false);
  // Un grupo con promedio bajo (grupo 3 de GR2QB: P1 penalizada y T1 en 0) aparece por revisar.
  assert.ok(m.riesgo.grupos.some((g) => g.curso === 'GR2QB' && g.grupo === '3' && g.motivos.some((x) => x.tipo === 'penalizacion')));
});

test('control oral: cobertura, respuestas 0/1/2 y resultados por concepto (Clásica), aprobados por concepto (SQI)', async () => {
  const db = abrirBase(`met-${randomUUID()}`);
  const trad = await curso(db, 'GR2QB', { a: '1', b: '1', c: '2', d: '2' });
  const { e } = await trad.evento('P1');
  await agregarAlControl(db, e.id, [trad.id('a'), trad.id('b')], {}, AHORA);
  await puntuarPregunta(db, e.id, trad.id('a'), 0, 2, AHORA);
  await puntuarPregunta(db, e.id, trad.id('a'), 1, 0, AHORA);
  await puntuarPregunta(db, e.id, trad.id('a'), 2, 1, AHORA);
  await elegirConcepto(db, e.id, trad.id('a'), 0, 'propagacion', AHORA);
  await elegirConcepto(db, e.id, trad.id('a'), 1, 'propagacion', AHORA);
  await elegirConcepto(db, e.id, trad.id('a'), 2, 'tipos_error', AHORA);
  await puntuarPregunta(db, e.id, trad.id('b'), 0, 1, AHORA);
  // Quitar una pregunta se lleva su concepto: b queda con una sola pregunta, sin concepto.
  await elegirConcepto(db, e.id, trad.id('b'), 1, 'procedimiento', AHORA);
  assert.deepEqual((await db.controles.get([e.id, trad.id('b')])).conceptos, [null, 'procedimiento']);
  await elegirConcepto(db, e.id, trad.id('b'), 1, null, AHORA);
  assert.deepEqual((await db.controles.get([e.id, trad.id('b')])).conceptos, []);
  await puntuarPregunta(db, e.id, trad.id('a'), 0, null, AHORA);
  assert.deepEqual((await db.controles.get([e.id, trad.id('a')])).conceptos, ['propagacion', 'tipos_error']);
  await trad.sesion('P1', { niveles: { 1: [3, 3, 3], 2: [3, 3, 3] } });

  const sqi = await curso(db, 'GR1AA', { a: '1', b: '1' });
  const { e: s1 } = await sqi.evento('P1');
  await agregarAlControl(db, s1.id, [sqi.id('a'), sqi.id('b')], {}, AHORA);
  await aprobarControl(db, s1.id, sqi.id('a'), true, AHORA);
  await elegirConcepto(db, s1.id, sqi.id('a'), 0, 'confiabilidad', AHORA);
  await aprobarControl(db, s1.id, sqi.id('b'), false, AHORA);
  await elegirConcepto(db, s1.id, sqi.id('b'), 0, 'confiabilidad', AHORA);
  await sqi.sesion('P1', { niveles: { 1: [2, 2, 1] } });

  const m = await metricas(db, {});
  const cob = Object.fromEntries(m.control.cobertura.map((c) => [c.curso, [c.conControl, c.total]]));
  assert.deepEqual(cob, { GR2QB: [2, 4], GR1AA: [2, 2] });
  assert.deepEqual(m.control.respuestas.map((r) => [r.nivel, r.n]), [[0, 1], [1, 2], [2, 0]]);
  assert.deepEqual(m.control.aprobacion, { aprobados: 1, noAprobados: 1 });
  const conceptos = Object.fromEntries(m.control.conceptos.map((c) => [`${c.metodologia}:${c.id}`, [c.media, c.n]]));
  assert.deepEqual(conceptos, { 'TRAD:propagacion': [0, 1], 'TRAD:tipos_error': [0.5, 1], 'SQI:confiabilidad': [0.5, 2] });
  assert.equal(m.control.sinConcepto, 1);   // la pregunta de b
  cerca(m.control.media, ((0 + 1) / 4 + 1 / 2) / 2);
});

test('trabajo preparatorio (Clásica) y TC (SQI): distribución por evento, entregas y dónde fallan', async () => {
  const db = abrirBase(`met-${randomUUID()}`);
  const trad = await curso(db, 'GR2QB', { a: '1', b: '1', c: '2', d: '2' });
  const { e } = await trad.evento('P1');
  await guardarNovedad(db, e.id, trad.id('b'), { nivel: 1 }, cfg.preparatorio.motivo_no_ingresa, AHORA);
  await guardarNovedad(db, e.id, trad.id('c'), { nivel: 0 }, cfg.preparatorio.motivo_no_ingresa, AHORA);
  await trad.sesion('P1', { niveles: { 1: [4, 4, 4], 2: [3, 3, 3] }, faltan: ['d'] });
  const sqi = await curso(db, 'GR1AA', { a: '1', b: '1', c: '2', d: '2', e: '3' });
  await sqi.sesion('P1', { niveles: { 1: [2, 2, 1], 2: [1, 1, 1] }, faltan: ['e'] });

  const m = await metricas(db, {});
  // Preparatorio de P1 en Clásica: a completo, b incompleto, c no lo hizo, d faltó. Nada de SQI.
  assert.deepEqual(m.preparatorio.map((x) => [x.codigo, x.niveles.map((n) => n.n), x.faltas]), [['P1', [1, 1, 1], 1]]);
  cerca(m.preparatorio[0].media, (1 + 0.5 + 0) / 3);

  // TC1: grupo 1 entrega con 2 preguntas perdidas, grupo 2 no entrega; el grupo 3 (todos faltaron) no se califica.
  const tc = cfg.actividades['TC1-SQI'];
  for (const q of tc.preguntas) await puntuarTrabajo(db, 'GR1AA:TC1', 'grupo', '1', q.id, ['1a', '2d'].includes(q.id) ? 0 : Math.max(...q.puntajes), AHORA);
  await marcarEntrega(db, 'GR1AA:TC1', 'grupo', '2', false, AHORA);
  const m2 = await metricas(db, {});
  const t = m2.trabajos.find((x) => x.codigo === 'TC1');
  assert.deepEqual([t.porCalificar, t.calificados, t.noEntregaron, t.pendientes], [2, 1, 1, 0]);
  cerca(t.media, (7 / 10 + 0) / 2);
  assert.deepEqual(t.preguntas.slice(0, 2).map((q) => [q.id, q.media]), [['1a', 0], ['2d', 0]]);
  assert.equal(t.preguntas.at(-1).media, 1);
});

test('feriados: sesiones perdidas, recuperaciones y sesiones que quedan para el control oral', async () => {
  const db = abrirBase(`met-${randomUUID()}`);
  const k = await curso(db, 'GR2QB', { a: '1', b: '1' });
  await guardarRecuperacion(db, 'GR2QB:T2', k.id('a'), { estado: 'realizada', nota: 0.9, detalle: 'GR3QA' }, AHORA);
  await k.sesion('P1', { niveles: { 1: [4, 4, 4] } });
  const m = await metricas(db, { alcance: 'GR2QB' });
  assert.equal(m.feriados.cursos.length, 1);
  const [t2] = m.feriados.cursos[0].eventos;
  assert.deepEqual([t2.codigo, t2.estado, t2.motivo, t2.recuperaciones.realizadas], ['T2', 'feriado', 'Día de los Difuntos', 1]);
  assert.deepEqual(m.feriados.cursos[0].control, [{ bimestre: 1, previstas: 6, disponibles: 5 }]);
  const texto = textoDeSvg(laminaContinua(seccionesDelTablero(m, cfg), { titulo: 'x', detalle: 'y', fecha: 'z', demo: false, presentar: 'p' }));
  assert.match(texto, /GR2QB: T2: Día de los Difuntos · 1 recuperación · control oral en 5 de 6 sesiones del B1/);
});

test('advertencia de franjas: se calcula desde los cursos (no está fija) y solo cuando hay dos metodologías', () => {
  assert.equal(franjasDeUnaMetodologia(cfg, cfg.cursos.filter((c) => c.metodologia === 'TRAD')), null);
  const mezcla = copia(cfg.cursos);
  mezcla.find((c) => c.paralelo === 'GR2QB').inicio = '07:00';
  mezcla.find((c) => c.paralelo === 'GR2QB').fin = '09:00';
  // Si un curso de Clásica pasara a las 07:00, esa franja dejaría de ser «solo SQI».
  assert.equal(franjasDeUnaMetodologia(cfg, mezcla), 'Las franjas 09:00–11:00, 11:00–13:00, 14:00–16:00 y 16:00–18:00 solo tienen cursos Clásica');
  assert.deepEqual(alcances(cfg).slice(0, 3).map((a) => a.id), ['todos', 'TRAD', 'SQI']);
});

test('gráficos y PDF: textos escapados, recortes y títulos con tildes', () => {
  assert.equal(esc('a < b & "c"'), 'a &lt; b &amp; &quot;c&quot;');
  const largo = 'Incertidumbre de las mediciones individuales, posición más alta';
  assert.ok(anchoTexto(recortar(largo, 120, 12), 12) <= 120);
  assert.ok(recortar(largo, 120, 12).endsWith('…'));
  const lineas = envolver(largo, 150, 12);
  assert.ok(lineas.length > 1 && lineas.every((l) => anchoTexto(l, 12) <= 150));
  assert.equal(envolver(largo, 150, 12, 2).length, 2);
  assert.equal(textoPdf('Mé'), '<FEFF004D00E9>');
});

test('configuración: conceptos del control con ids únicos y métricas válidas', () => {
  const { cfg: c } = leerConfigDisco();
  assert.deepEqual(validarSemantica(c), []);
  const mala = copia(c);
  mala.actividades['P1-TRAD'].conceptos_control.push({ id: 'propagacion', texto: 'Repetido' });
  assert.ok(validarSemantica(mala).some((e) => /conceptos del control repetidos/.test(e)));
  assert.ok(c.metricas.riesgo.faltas >= 1 && c.metricas.advertencias.franjas.includes('{detalle}'));
});
