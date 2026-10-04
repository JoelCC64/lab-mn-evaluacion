// Escritura en el Excel (Fase 3): prueba de ida y vuelta con el Excel ficticio, idempotencia,
// ediciones a mano, estudiantes que no coinciden y revisión de las partes del archivo.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import ExcelJS from 'exceljs';

import { abrirBase } from '../src/db.js';
import { leerAsistenciaSemana1, leerExcelSemestre, valorCelda } from '../src/nucleo/excel-lectura.js';
import { aplicarAsistenciaSemana1, aplicarExcelSemestre } from '../src/datos/importar.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cargarCursos } from '../src/datos/excel-datos.js';
import {
  agregarAlControl, cerrarPase, guardarNovedad, guardarPuntaje, marcarAsistencia, marcarEntrega, marcarRevisionPreparatorio,
  puntuarPregunta, puntuarTrabajo, aprobarControl,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento, listaDeGrupos } from '../src/nucleo/grupos.js';
import { crearContexto, notaEvento } from '../src/nucleo/motor.js';
import {
  aplicarEscritura, claveCelda, compararLibros, hojasPropiasDelPlan, leerControl, normal, planificarEscritura, zonasDelPlan,
} from '../src/nucleo/excel-escritura.js';
import { columnasDeLaApp, RAYA } from '../src/nucleo/resultados.js';
import { revisarPartesExcel } from '../src/nucleo/zip.js';
import { ASISTENCIA_EJEMPLO, EXCEL_EJEMPLO, RAIZ, configReal } from './ayudas.js';

const cfg = configReal();
const HOY = '2026-10-20';
const AHORA = '2026-10-20T18:00:00.000Z';
const META = { app: 'prueba', ahora: AHORA, config: cfg.version };
const ESC = cfg.excel.escritura;
const PROPIAS = new Set([ESC.hoja_asistencia, ESC.hoja_detalle, ESC.hojas_coordinacion[1], ESC.hojas_coordinacion[2], ESC.hoja_control]);
const inflar = async (b) => zlib.inflateRawSync(b);

async function libro(ruta = EXCEL_EJEMPLO) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  return wb;
}
async function libroDeBuffer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

/** Una clase completa en un evento: revisión en la puerta, control, rúbrica de todos los grupos y pase. */
async function clase(db, paralelo, codigo, { niveles, faltan = [], retirados = [], novedades = [], controles = [] }) {
  const curso = cfg.cursoPorId[paralelo];
  const reg = await registrosDelCurso(db, paralelo);
  const eventos = generarEventos(cfg, curso, reg.cambios_evento);
  const evento = eventos.find((e) => e.codigo === codigo);
  const grupos = gruposDelEvento(evento, eventos, reg).porEstudiante;
  await marcarRevisionPreparatorio(db, evento.id, true, AHORA);
  for (const [id, nivel] of novedades) await guardarNovedad(db, evento.id, id, { nivel }, cfg.preparatorio.motivo_no_ingresa, AHORA);
  for (const [id, respuesta] of controles) {
    await agregarAlControl(db, evento.id, [id], {}, AHORA);
    if (Array.isArray(respuesta)) for (const [i, p] of respuesta.entries()) await puntuarPregunta(db, evento.id, id, i, p, AHORA);
    else await aprobarControl(db, evento.id, id, respuesta, AHORA);
  }
  const config = cfg.actividades[evento.config];
  const partes = config.criterios ? config.criterios.map((c) => c.id) : config.aspectos_aplicables ?? ['integral'];
  for (const { grupo } of listaDeGrupos(grupos, reg.estudiantes).grupos) {
    const n = niveles(Number(grupo));
    for (const [i, p] of partes.entries()) await guardarPuntaje(db, evento.id, grupos, grupo, p, n[i], AHORA);
  }
  for (const id of faltan) await marcarAsistencia(db, evento.id, grupos, id, 'no_vino', null, AHORA);
  for (const id of retirados) await marcarAsistencia(db, evento.id, grupos, id, 'se_retiro_antes', null, AHORA);
  await cerrarPase(db, evento.id, grupos, cfg.asistencia.motivos.sin_grupo, AHORA);
  return { evento, grupos };
}

/** Califica un TC de todos los grupos de su práctica: `puntajes(grupo)` en el orden de las preguntas, o null (no entregó). */
async function trabajoEnCasa(db, paralelo, codigo, puntajes) {
  const reg = await registrosDelCurso(db, paralelo);
  const eventos = generarEventos(cfg, cfg.cursoPorId[paralelo], reg.cambios_evento);
  const evento = eventos.find((e) => e.codigo === codigo);
  const { preguntas } = cfg.actividades[evento.config];
  for (const { grupo } of listaDeGrupos(gruposDelEvento(evento, eventos, reg).porEstudiante, reg.estudiantes).grupos) {
    const p = puntajes(Number(grupo));
    if (!p) await marcarEntrega(db, evento.id, 'grupo', grupo, false, AHORA);
    else for (const [i, q] of preguntas.entries()) await puntuarTrabajo(db, evento.id, 'grupo', grupo, q.id, p[i], AHORA);
  }
}

/** Base con el Excel ficticio, la semana 1 y una P1 evaluada en GR2QB (Clásica) y GR1AA (SQI), con el TC1 de GR1AA. */
async function baseEvaluada() {
  const db = abrirBase(`excel-${randomUUID()}`);
  await aplicarExcelSemestre(db, leerExcelSemestre(await libro(), cfg), { ahora: AHORA });
  await aplicarAsistenciaSemana1(db, cfg, leerAsistenciaSemana1(await libro(ASISTENCIA_EJEMPLO), cfg), { ahora: AHORA });
  const gr2qb = (await db.estudiantes.where('curso').equals('GR2QB').sortBy('nombre'));
  const gr1aa = (await db.estudiantes.where('curso').equals('GR1AA').sortBy('nombre'));
  const conGrupo = (lista) => lista.filter((e) => e.grupo_excel !== null);
  const [ausente, retirado, conNovedad, controlado] = conGrupo(gr2qb);
  await clase(db, 'GR2QB', 'P1', {
    niveles: (g) => [g % 5, 4, 2], faltan: [ausente.id], retirados: [retirado.id],
    novedades: [[conNovedad.id, 1]], controles: [[controlado.id, [2, 1, 2]]],
  });
  const [ausenteSqi] = conGrupo(gr1aa);
  await clase(db, 'GR1AA', 'P1', { niveles: (g) => [2, g % 3, 1], faltan: [ausenteSqi.id], controles: [[conGrupo(gr1aa)[1].id, true]] });
  await trabajoEnCasa(db, 'GR1AA', 'TC1', (g) => (g === 2 ? null : [1, 2, 1, 0.5, 1, 1, 1, g % 2 ? 2 : 1]));
  return { db, gr2qb: { ausente, retirado, conNovedad, controlado }, gr1aa: { ausente: ausenteSqi, presente: conGrupo(gr1aa)[1] } };
}

/** Escribe con lo que hay en la base: devuelve { plan, buffer }. */
async function escribir(db, wb, { decisiones } = {}) {
  const plan = planificarEscritura(wb, cfg, await cargarCursos(db, cfg), { hoy: HOY, decisiones });
  aplicarEscritura(wb, cfg, plan, META);
  return { plan, buffer: await wb.xlsx.writeBuffer() };
}

function celdaDe(ws, plan, codigo, clave) {
  const h = plan.hojas.find((x) => x.hoja === ws.name);
  const i = h.columnas.findIndex((c) => c.clave === clave);
  return valorCelda(ws.getRow(h.filas.get(codigo)).getCell(h.inicio + i));
}

test('la zona de la app va a la derecha, tras una columna vacía, con los eventos en el orden del cronograma', () => {
  const cols = columnasDeLaApp(cfg, cfg.cursoPorId.GR1AA, generarEventos(cfg, cfg.cursoPorId.GR1AA));
  const b1 = cols.filter((c) => c.bimestre === 1).map((c) => c.encabezado);
  assert.deepEqual(b1, ['P1', 'TC1', 'T1', 'P2', 'TC2', 'T2', 'P3', 'TC3', 'T3', 'Control (sí/no)', 'Prácticas (/3)',
    'Trabajos en casa (/2)', 'Talleres (/1)', 'Nota B1 (/6)']);
  const trad = columnasDeLaApp(cfg, cfg.cursoPorId.GR2QB, generarEventos(cfg, cfg.cursoPorId.GR2QB));
  assert.deepEqual(trad.filter((c) => c.bimestre === 1).map((c) => c.encabezado), ['P1', 'T1', 'P2', 'T2', 'P3', 'T3',
    'Preparatorios (/10)', 'Control (/10)', 'Planificación y conocimiento (/1.5)', 'Diseño, datos y análisis (/3.5)', 'Talleres (/1)', 'Nota B1 (/6)']);
  assert.ok(trad.some((c) => c.encabezado === 'PLIC (/0.5)'), 'el PLIC es componente del 2.º bimestre');
  assert.equal(trad[0].encabezado, 'Grupo actual');
  assert.equal(trad.at(-1).encabezado, 'Observaciones de la app');
});

test('ida y vuelta: fuera de las zonas de la app todo queda idéntico (ExcelJS y openpyxl) y la zona tiene lo esperado', async () => {
  const { db, gr2qb, gr1aa } = await baseEvaluada();
  const wb = await libro();
  const { plan, buffer } = await escribir(db, wb);
  assert.deepEqual([plan.conflictos.length, plan.errores.length, plan.sinApp.length, plan.sinFila.length], [0, 0, 0, 0]);
  assert.equal(plan.hojas.length, 10);
  assert.ok(plan.hojas.every((h) => h.nueva && h.inicio === 10), 'la zona empieza en J (H es la última columna, I queda vacía)');

  const dir = mkdtempSync(path.join(tmpdir(), 'labmn-'));
  const salida = path.join(dir, 'escrito.xlsx');
  writeFileSync(salida, Buffer.from(buffer));

  // 1) Con ExcelJS (lo mismo que verifica la app antes de guardar).
  const original = await libro(), nuevo = await libro(salida);
  assert.deepEqual(compararLibros(original, nuevo, { zonas: zonasDelPlan(plan), propias: PROPIAS }), []);

  // 2) Con openpyxl, la librería que generó el Excel real (valores y formato de todas las celdas).
  const zonas = Object.fromEntries([...zonasDelPlan(plan)].map(([h, cols]) => [h, [...cols]]));
  const r = JSON.parse(execFileSync(path.join(RAIZ, '.venv/bin/python'), [
    path.join(RAIZ, 'scripts/comparar_excel.py'), EXCEL_EJEMPLO, salida, '--zonas', JSON.stringify(zonas), '--hojas-app', ...PROPIAS,
  ], { encoding: 'utf8' }));
  assert.deepEqual(r.diferencias, []);
  assert.ok(r.celdas_comparadas > 2000);

  // 3) La zona de la app tiene lo esperado.
  const ws = nuevo.getWorksheet('GR2QB');
  const h = plan.hojas.find((x) => x.hoja === 'GR2QB');
  assert.equal(valorCelda(ws.getRow(4).getCell(10)), 'Grupo actual');
  assert.match(String(valorCelda(ws.getRow(3).getCell(11))), /^1\.er bimestre/);
  const reg = await registrosDelCurso(db, 'GR2QB');
  const eventos = generarEventos(cfg, cfg.cursoPorId.GR2QB, reg.cambios_evento);
  const ctx = crearContexto(cfg, cfg.cursoPorId.GR2QB, eventos, reg);
  const p1 = eventos.find((e) => e.codigo === 'P1');
  for (const [codigo] of h.filas) {
    const n = notaEvento(ctx, p1, codigo);
    const esperado = n.estado === 'calculada' ? Math.round(n.valor * 1000 + 1e-9) / 100 : null;
    assert.equal(celdaDe(ws, plan, codigo, 'B1:P1'), esperado, `P1 de ${codigo}`);
    assert.equal(celdaDe(ws, plan, codigo, 'B1:T2'), RAYA, 'T2 se perdió por feriado en GR2QB');
    assert.equal(celdaDe(ws, plan, codigo, 'B1:P2'), null, 'P2 aún no se evalúa');
    assert.equal(celdaDe(ws, plan, codigo, 'B1:nota'), null, 'la nota del bimestre se escribe cuando está completa');
  }
  assert.equal(celdaDe(ws, plan, gr2qb.ausente.id, 'B1:P1'), 0);
  assert.match(celdaDe(ws, plan, gr2qb.ausente.id, 'observaciones'), /P1: no vino/);
  assert.match(celdaDe(ws, plan, gr2qb.ausente.id, 'observaciones'), /T2: no se hizo \(Día de los Difuntos\)/);
  assert.equal(celdaDe(ws, plan, gr2qb.controlado.id, 'B1:control'), 8.33, 'control 2 + 1 + 2 sobre 6');
  assert.equal(celdaDe(ws, plan, gr2qb.conNovedad.id, 'B1:preparatorios'), 5, 'preparatorio incompleto: 1/2');
  assert.equal(celdaDe(ws, plan, gr2qb.ausente.id, 'grupo_actual'), Number(gr2qb.ausente.grupo_excel));
  assert.equal(ws.getRow(h.filas.get(gr2qb.ausente.id)).getCell(11).numFmt, '0.00');

  const sqi = nuevo.getWorksheet('GR1AA');
  assert.equal(celdaDe(sqi, plan, gr1aa.ausente.id, 'B1:P1'), 0);
  assert.equal(celdaDe(sqi, plan, gr1aa.ausente.id, 'B1:TC1'), 0, 'quien faltó a P1 tiene 0 en el TC1');
  const regSqi = await registrosDelCurso(db, 'GR1AA');
  const evSqi = generarEventos(cfg, cfg.cursoPorId.GR1AA, regSqi.cambios_evento);
  const ctxSqi = crearContexto(cfg, cfg.cursoPorId.GR1AA, evSqi, regSqi);
  const tc1 = evSqi.find((e) => e.codigo === 'TC1');
  for (const [codigo] of plan.hojas.find((x) => x.hoja === 'GR1AA').filas) {
    const n = notaEvento(ctxSqi, tc1, codigo);
    assert.equal(n.estado, 'calculada', `TC1 de ${codigo} (${n.motivo})`);
    assert.equal(celdaDe(sqi, plan, codigo, 'B1:TC1'), Math.round(n.valor * 1000 + 1e-9) / 100, `TC1 de ${codigo}`);
  }
  const g = Number(gr1aa.presente.grupo_excel);
  assert.equal(celdaDe(sqi, plan, gr1aa.presente.id, 'B1:TC1'), g === 2 ? 0 : g % 2 ? 9.5 : 8.5, 'TC1 de su grupo');
  assert.equal(celdaDe(sqi, plan, gr1aa.presente.id, 'B1:trabajos_casa'), null, 'el componente se escribe con TC1, TC2 y TC3');
  assert.equal(celdaDe(sqi, plan, gr1aa.presente.id, 'B1:control'), 'sí');
  assert.equal(celdaDe(sqi, plan, gr1aa.ausente.id, 'B1:control'), null, 'sin control todavía (el bimestre no termina)');

  // 4) Hojas propias y de control.
  const asis = nuevo.getWorksheet(cfg.excel.escritura.hoja_asistencia);
  const encAsis = asis.getRow(4).values.slice(1);
  assert.deepEqual(encAsis.slice(0, 6), ['Paralelo', 'N°', 'Código único', 'Apellidos y nombres', 'S1', 'S2']);
  assert.equal(encAsis.at(-1), '%');
  const filaAsis = (codigo) => { let f; asis.eachRow((row) => { if (String(row.getCell(3).value) === codigo) f = row; }); return f; };
  assert.equal(filaAsis(gr2qb.ausente.id).getCell(5).value, RAYA, 'GR2QB no tuvo clase en la semana 1');
  assert.equal(filaAsis(gr2qb.ausente.id).getCell(6).value, 'F');
  assert.equal(filaAsis(gr2qb.retirado.id).getCell(6).value, 'R');
  assert.equal(filaAsis(gr2qb.controlado.id).getCell(6).value, 'P');
  const filasAsis = asis.rowCount - 4;
  assert.equal(filasAsis, 196, 'todos los estudiantes, curso por curso');

  const det = nuevo.getWorksheet(cfg.excel.escritura.hoja_detalle);
  let filaP1;
  det.eachRow((row, r) => { if (r > 4 && row.getCell(2).value === gr2qb.controlado.id && row.getCell(6).value === 'P1') filaP1 = row; });
  assert.match(String(filaP1.getCell(11).value), /^diseño \d · datos 4 · análisis 2$/);
  assert.equal(filaP1.getCell(10).value, '2 · 1 · 2 → 8.33/10');

  const control = nuevo.getWorksheet(cfg.excel.escritura.hoja_control);
  assert.equal(control.state, 'hidden');
  assert.equal(leerControl(nuevo, cfg).formato, 1);
  assert.deepEqual(nuevo.worksheets.slice(-PROPIAS.size).map((w) => w.name), [...PROPIAS]);
  assert.deepEqual([...hojasPropiasDelPlan(cfg, plan)].sort(), [...PROPIAS].sort(), 'la verificación antes de guardar conoce todas las hojas propias');

  // 5) Coordinación: sus cuatro columnas, todos los estudiantes (194 en nómina y aparte 2 pendientes) y el profesor.
  for (const b of [1, 2]) {
    const coord = nuevo.getWorksheet(ESC.hojas_coordinacion[b]);
    assert.deepEqual(coord.getRow(4).values.slice(1), cfg.semestre.formato_coordinacion);
    const filas = [];
    coord.eachRow((f, r) => { if (r > 4 && f.getCell(2).value !== null) filas.push(f); });
    assert.equal(filas.length, 196);
    assert.ok(filas.every((f) => f.getCell(4).value === cfg.semestre.profesor && f.getCell(3).value === null), 'sin notas: el bimestre no está completo');
    assert.ok(filas.slice(-2).every((f) => f.getCell(1).fill?.fgColor?.argb === 'FFFFF4D6'), 'los pendientes van al final, en ámbar');
  }
});

test('escribir dos veces seguidas no cambia nada', async () => {
  const { db } = await baseEvaluada();
  const { plan: primero, buffer } = await escribir(db, await libro());
  assert.equal(primero.sinCambios, false);
  const segundo = planificarEscritura(await libroDeBuffer(buffer), cfg, await cargarCursos(db, cfg), { hoy: HOY });
  assert.equal(segundo.sinCambios, true);
  assert.equal(segundo.celdasQueCambian, 0);
  assert.equal(segundo.conflictos.length, 0);
  // Aunque se fuerce la escritura, las zonas y las hojas propias quedan iguales.
  const wb2 = await libroDeBuffer(buffer);
  aplicarEscritura(wb2, cfg, segundo, { ...META, ahora: '2026-10-21T10:00:00.000Z' });
  const otra = await libroDeBuffer(await wb2.xlsx.writeBuffer());
  const antes = await libroDeBuffer(buffer);
  assert.deepEqual(compararLibros(antes, otra, { zonas: new Map(), propias: new Set([cfg.excel.escritura.hoja_control]) }), []);
});

test('una edición a mano en una celda de la app se detecta; se puede conservar (como ajuste) o reemplazar', async () => {
  const { db, gr2qb } = await baseEvaluada();
  const { plan, buffer } = await escribir(db, await libro());
  const id = gr2qb.controlado.id;
  const h = plan.hojas.find((x) => x.hoja === 'GR2QB');
  const colP1 = h.inicio + h.columnas.findIndex((c) => c.clave === 'B1:P1');
  const colObs = h.inicio + h.columnas.findIndex((c) => c.clave === 'observaciones');

  // Joel cambia a mano la P1 de un estudiante y escribe algo en las observaciones de otro.
  const editado = await libroDeBuffer(buffer);
  editado.getWorksheet('GR2QB').getRow(h.filas.get(id)).getCell(colP1).value = 9.5;
  editado.getWorksheet('GR2QB').getRow(h.filas.get(gr2qb.ausente.id)).getCell(colObs).value = 'Justificó con certificado';
  const conEdicion = Buffer.from(await editado.xlsx.writeBuffer());

  const plan2 = planificarEscritura(await libroDeBuffer(conEdicion), cfg, await cargarCursos(db, cfg), { hoy: HOY });
  assert.equal(plan2.conflictos.length, 2);
  const cP1 = plan2.conflictos.find((c) => c.codigo === id);
  assert.deepEqual([cP1.tipo, cP1.columna, cP1.actual, cP1.sePuedeConservar], ['editada', 'P1', 9.5, true]);
  assert.equal(cP1.celda, `K${h.filas.get(id)}`);
  assert.throws(() => aplicarEscritura(editado, cfg, plan2, META), /sin decidir/);

  // Conservar la P1 (queda fijada y cuenta como ajuste «editado en el Excel»); reemplazar la observación.
  const decisiones = new Map([[cP1.clave, 'conservar'], [plan2.conflictos.find((c) => c.codigo !== id).clave, 'reemplazar']]);
  const wb3 = await libroDeBuffer(conEdicion);
  const plan3 = planificarEscritura(wb3, cfg, await cargarCursos(db, cfg), { hoy: HOY, decisiones });
  assert.equal(plan3.conflictos.length, 0);
  aplicarEscritura(wb3, cfg, plan3, META);
  const buffer3 = await wb3.xlsx.writeBuffer();
  const escrito3 = await libroDeBuffer(buffer3);
  const ws3 = escrito3.getWorksheet('GR2QB');
  assert.equal(valorCelda(ws3.getRow(h.filas.get(id)).getCell(colP1)), 9.5, 'se conserva el valor de Joel');
  assert.match(valorCelda(ws3.getRow(h.filas.get(id)).getCell(colObs)), /P1: nota puesta a mano en el Excel/);
  assert.match(valorCelda(ws3.getRow(h.filas.get(gr2qb.ausente.id)).getCell(colObs)), /^P1: no vino/, 'la observación se reemplazó');
  assert.ok(leerControl(escrito3, cfg).fijadas.has(claveCelda('GR2QB', id, 'B1:P1')));

  // La siguiente escritura respeta la celda fijada sin volver a preguntar…
  const plan4 = planificarEscritura(await libroDeBuffer(buffer3), cfg, await cargarCursos(db, cfg), { hoy: HOY });
  assert.equal(plan4.conflictos.length, 0);
  assert.equal(plan4.sinCambios, true);
  // …y si Joel la vuelve a cambiar, pregunta otra vez; «reemplazar» devuelve la nota de la app.
  const otraVez = await libroDeBuffer(buffer3);
  otraVez.getWorksheet('GR2QB').getRow(h.filas.get(id)).getCell(colP1).value = 9;
  const buffer5 = Buffer.from(await otraVez.xlsx.writeBuffer());
  const plan5 = planificarEscritura(await libroDeBuffer(buffer5), cfg, await cargarCursos(db, cfg), { hoy: HOY });
  assert.deepEqual(plan5.conflictos.map((c) => [c.tipo, c.anterior, c.actual]), [['fijada', 9.5, 9]]);
  const wb6 = await libroDeBuffer(buffer5);
  const plan6 = planificarEscritura(wb6, cfg, await cargarCursos(db, cfg), { hoy: HOY, decisiones: new Map([[plan5.conflictos[0].clave, 'reemplazar']]) });
  aplicarEscritura(wb6, cfg, plan6, META);
  const escrito6 = await libroDeBuffer(await wb6.xlsx.writeBuffer());
  assert.equal(valorCelda(escrito6.getWorksheet('GR2QB').getRow(h.filas.get(id)).getCell(colP1)), celdaDe((await libroDeBuffer(buffer)).getWorksheet('GR2QB'), plan, id, 'B1:P1'));
  assert.equal(leerControl(escrito6, cfg).fijadas.size, 0);
});

test('un texto escrito a mano en una nota de evento no se puede conservar como nota', async () => {
  const { db, gr2qb } = await baseEvaluada();
  const { plan, buffer } = await escribir(db, await libro());
  const h = plan.hojas.find((x) => x.hoja === 'GR2QB');
  const wb = await libroDeBuffer(buffer);
  wb.getWorksheet('GR2QB').getRow(h.filas.get(gr2qb.controlado.id)).getCell(h.inicio + 1).value = 'revisar';
  const plan2 = planificarEscritura(await libroDeBuffer(await wb.xlsx.writeBuffer()), cfg, await cargarCursos(db, cfg), { hoy: HOY });
  assert.equal(plan2.conflictos[0].sePuedeConservar, false);
});

test('estudiantes que no coinciden, zona movida y hoja propia editada: se avisa y no se escribe lo dudoso', async () => {
  const { db } = await baseEvaluada();
  const { plan, buffer } = await escribir(db, await libro());
  const wb = await libroDeBuffer(buffer);
  // Un estudiante nuevo en el Excel (aún no leído por la app) y otro borrado del Excel.
  const ws = wb.getWorksheet('GR4EB');
  const h = plan.hojas.find((x) => x.hoja === 'GR4EB');
  const [codigoBorrado, filaBorrada] = [...h.filas][0];
  ws.getRow(filaBorrada).getCell(2).value = 199988888;
  // Un encabezado de la app renombrado en GR7SA.
  const h7 = plan.hojas.find((x) => x.hoja === 'GR7SA');
  wb.getWorksheet('GR7SA').getRow(4).getCell(h7.inicio + 1).value = 'P1 (corregida)';
  // Una celda de la hoja de asistencia editada a mano.
  wb.getWorksheet(cfg.excel.escritura.hoja_asistencia).getRow(5).getCell(6).value = 'X';

  const plan2 = planificarEscritura(await libroDeBuffer(await wb.xlsx.writeBuffer()), cfg, await cargarCursos(db, cfg), { hoy: HOY });
  assert.deepEqual(plan2.sinApp.map((x) => [x.hoja, x.codigo]), [['GR4EB', '199988888']]);
  assert.deepEqual(plan2.sinFila.map((x) => [x.hoja, x.codigo]), [['GR4EB', codigoBorrado]]);
  assert.ok(plan2.errores.some((e) => e.startsWith('GR7SA') && e.includes('«P1»')));
  assert.ok(!plan2.hojas.some((x) => x.hoja === 'GR7SA'), 'la hoja con la zona movida no se escribe');
  assert.ok(plan2.propias.find((p) => p.nombre === cfg.excel.escritura.hoja_asistencia).editada);
  assert.ok(plan2.avisos.some((a) => a.includes('se editó a mano')));
});

test('revisión de las partes del Excel: el ficticio se puede escribir; uno con gráficos o formato condicional avanzado, no', async () => {
  const { readFileSync } = await import('node:fs');
  const ficticio = await revisarPartesExcel(readFileSync(EXCEL_EJEMPLO), inflar);
  assert.deepEqual(ficticio.bloqueos, []);
  const conGrafico = zipDePrueba({
    'xl/workbook.xml': '<workbook/>',
    'xl/charts/chart1.xml': '<c:chartSpace/>',
    'xl/worksheets/sheet1.xml': '<worksheet><extLst><ext><x14:conditionalFormattings><x14:conditionalFormatting/></x14:conditionalFormattings></ext></extLst></worksheet>',
    'docProps/custom.xml': '<Properties/>',
  });
  const r = await revisarPartesExcel(conGrafico, inflar);
  assert.deepEqual(r.bloqueos.sort(), ['formato condicional avanzado (barras de datos, conjuntos de iconos)', 'gráficos'].sort());
  assert.equal(r.avisos.length, 1);
});

/** Zip mínimo (con compresión deflate) para probar la revisión de partes. */
function zipDePrueba(partes) {
  const locales = [], centrales = [];
  let offset = 0;
  for (const [nombre, texto] of Object.entries(partes)) {
    const datos = zlib.deflateRawSync(Buffer.from(texto));
    const n = Buffer.from(nombre);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(texto.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(texto.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
    locales.push(local, n, datos);
    centrales.push(central, n);
    offset += 30 + n.length + datos.length;
  }
  const dir = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(partes).length, 8); fin.writeUInt16LE(Object.keys(partes).length, 10);
  fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locales, dir, fin]));
}

test('normalización: 7,5 escrito como texto equivale a 7.5; vacío y espacios equivalen a nada', () => {
  assert.equal(normal('7,5'), 7.5);
  assert.equal(normal(' 7.50 '), 7.5);
  assert.equal(normal('   '), null);
  assert.equal(normal(RAYA), RAYA);
  assert.equal(normal(new Date(Date.UTC(2026, 9, 5))), '2026-10-05');
});
