// Base local (Dexie sobre fake-indexeddb): importación del Excel, relectura y respaldo.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';

import { abrirBase } from '../src/db.js';
import { leerAsistenciaSemana1, leerExcelSemestre } from '../src/nucleo/excel-lectura.js';
import { aplicarAsistenciaSemana1, aplicarExcelSemestre, planificarImportacion } from '../src/datos/importar.js';
import { borrarTodo, exportarRespaldo, restaurarRespaldo, validarRespaldo } from '../src/datos/respaldo.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { ASISTENCIA_EJEMPLO, EXCEL_EJEMPLO, configReal } from './ayudas.js';

const cfg = configReal();
const nuevaBase = () => abrirBase(`prueba-${randomUUID()}`);
const AHORA = '2026-10-05T12:00:00.000Z';

async function libroEjemplo() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_EJEMPLO);
  return wb;
}

async function baseConEjemplo() {
  const db = nuevaBase();
  await aplicarExcelSemestre(db, leerExcelSemestre(await libroEjemplo(), cfg), { archivo: 'ejemplo.xlsx', ahora: AHORA });
  return db;
}

/** Todo lo guardado, como texto (para buscar «@»). */
async function todoComoTexto(db) {
  return JSON.stringify(await exportarRespaldo(db, { semestre: '2026B', app: 'prueba', config: cfg.version, ahora: AHORA }));
}

test('importa el Excel ficticio: estudiantes por curso, pendientes y grupos del Excel', async () => {
  const db = await baseConEjemplo();
  assert.equal(await db.estudiantes.count(), 196);
  assert.equal(await db.estudiantes.where('estado').equals('pendiente').count(), 2);
  const gr1aa = await db.estudiantes.where('curso').equals('GR1AA').toArray();
  assert.equal(gr1aa.length, 20);
  assert.ok(gr1aa.every((e) => e.id === e.codigo && e.nombre && 'grupo_excel' in e));
  const [imp] = await db.importaciones.toArray();
  assert.equal(imp.tipo, 'excel_semestre');
  assert.equal(imp.resumen.nuevos, 196);
});

test('no se guarda ningún correo (ningún valor de la base contiene «@»)', async () => {
  const db = await baseConEjemplo();
  const wbAsis = new ExcelJS.Workbook();
  await wbAsis.xlsx.readFile(ASISTENCIA_EJEMPLO);
  await aplicarAsistenciaSemana1(db, cfg, leerAsistenciaSemana1(wbAsis, cfg), { ahora: AHORA });
  assert.ok(!(await todoComoTexto(db)).includes('@'));
});

test('al volver a leer: agrega nuevos, marca bajas, actualiza datos y no toca las evaluaciones', async () => {
  const db = await baseConEjemplo();
  const wb = await libroEjemplo();
  const ws = wb.getWorksheet('GR4EB');
  const codigoQueSale = String(ws.getRow(5).getCell(2).value);
  const filaPendiente = ws.getRow(ws.rowCount);
  assert.match(String(filaPendiente.getCell(8).value), /^Pendiente/);
  const codigoPendiente = String(filaPendiente.getCell(2).value);

  // Una evaluación ya registrada del estudiante que sale de la nómina.
  await db.asistencia.put({ evento: 'GR4EB:P1', estudiante: codigoQueSale, estado: 'presente', motivo: null, observacion: 'Está pero no trabaja', fecha: AHORA });

  ws.spliceRows(5, 1);                                                   // sale de la nómina
  let filaDelPendiente;
  ws.eachRow((fila) => { if (String(fila.getCell(2).value) === codigoPendiente) filaDelPendiente = fila; });
  filaDelPendiente.getCell(8).value = null;                              // el pendiente ya consta en la nómina
  const ultima = ws.rowCount + 1;
  ws.getRow(ultima).values = [99, 199999999, 'NUEVO ESTUDIANTE FICTICIO', 'x@y.example', 'A', 'Clásica', 2, null];
  ws.getRow(6).getCell(3).value = 'NOMBRE CORREGIDO FICTICIO';

  const plan = await aplicarExcelSemestre(db, leerExcelSemestre(wb, cfg), { ahora: '2026-10-20T12:00:00.000Z' });
  assert.equal(plan.resumen.nuevos, 1);
  assert.equal(plan.resumen.bajas, 1);
  assert.equal(plan.resumen.actualizados, 2);
  assert.equal((await db.estudiantes.get(codigoQueSale)).estado, 'baja');
  assert.equal((await db.estudiantes.get(codigoPendiente)).estado, 'nomina');
  assert.equal((await db.estudiantes.get('199999999')).curso, 'GR4EB');
  const evaluacion = await db.asistencia.get(['GR4EB:P1', codigoQueSale]);
  assert.equal(evaluacion.observacion, 'Está pero no trabaja', 'la evaluación sigue intacta');

  // Leer el mismo archivo otra vez no cambia nada.
  const otraVez = await planificarImportacion(db, leerExcelSemestre(wb, cfg));
  assert.equal(otraVez.cambios.length, 0);
  // Quien vuelve a aparecer se reactiva.
  const wb2 = await libroEjemplo();
  const plan2 = await planificarImportacion(db, leerExcelSemestre(wb2, cfg));
  assert.ok(plan2.cambios.some((c) => c.tipo === 'reactivado' && c.despues.id === codigoQueSale));
});

test('un archivo con solo algunas hojas no da de baja a los demás cursos', async () => {
  const db = await baseConEjemplo();
  const wb = await libroEjemplo();
  for (const nombre of ['GR9EB', 'GR3MB', 'GR1AA', 'GR4EB', 'GR6CD', 'GR7SA', 'GR7EB', 'GR3QA', 'GR1QA']) {
    wb.removeWorksheet(wb.getWorksheet(nombre).id);
  }
  const plan = await aplicarExcelSemestre(db, leerExcelSemestre(wb, cfg), { ahora: AHORA });
  assert.equal(plan.resumen.bajas, 0);
  assert.equal(await db.estudiantes.where('estado').equals('baja').count(), 0);
});

test('asistencia de la semana 1: presente/no vino con pase cerrado; GR2QB sin clase', async () => {
  const db = await baseConEjemplo();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ASISTENCIA_EJEMPLO);
  const { resumen } = await aplicarAsistenciaSemana1(db, cfg, leerAsistenciaSemana1(wb, cfg), { ahora: AHORA });
  assert.equal(resumen.sin_clase, 1);
  assert.equal(resumen.desconocidos, 0);
  assert.deepEqual(await db.cambios_evento.get('GR2QB:INTRO'), { evento: 'GR2QB:INTRO', estado: 'sin_clase', motivo: 'permiso de las autoridades', fecha: AHORA });
  const reg = await registrosDelCurso(db, 'GR9EB');
  assert.equal(reg.asistencia.length, 19);
  assert.equal(reg.asistencia.filter((a) => a.estado === 'no_vino').length, 3);
  assert.equal(reg.pases[0].cerrado, true);
});

test('respaldo: exportar, borrar todo, restaurar y obtener datos idénticos', async () => {
  const db = await baseConEjemplo();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ASISTENCIA_EJEMPLO);
  await aplicarAsistenciaSemana1(db, cfg, leerAsistenciaSemana1(wb, cfg), { ahora: AHORA });
  // Una fila en cada tabla de evento, para cubrir todas.
  const [e] = await db.estudiantes.where('curso').equals('GR2QB').toArray();
  const ev = 'GR2QB:P1';
  await db.grupos_evento.put({ evento: ev, estudiante: e.id, grupo: '1', fecha: AHORA });
  await db.revisiones_grupo.put({ evento: ev, grupo: '1', verificado: true, trabajo_firmado: true, penalizacion_total: false, motivo_penalizacion: null, fecha: AHORA });
  await db.puntajes.put({ evento: ev, grupo: '1', aspecto: 'diseno', valor: 3, fecha: AHORA });
  await db.etiquetas.put({ evento: ev, grupo: '1', etiqueta: 'montaje_ok', fecha: AHORA });
  await db.notas.put({ evento: ev, unidad: 'grupo', unidad_id: '1', texto: 'Buen montaje', fecha: AHORA });
  await db.controles.put({ evento: ev, estudiante: e.id, estado: 'respondio', puntajes: [2, 1], aprobado: null, orden: 1, manual: false, fecha: AHORA });
  await db.revision_preparatorio.put({ evento: ev, revisada: true, fecha: AHORA });
  await db.novedades_preparatorio.put({ evento: ev, estudiante: e.id, nivel: 1, no_ingresa: false, observacion: null, fecha: AHORA });
  await db.ajustes.put({ evento: ev, estudiante: e.id, valor: 0.5, motivo: 'prueba', fecha: AHORA });
  await db.meta.put({ clave: 'prueba', valor: 1 });

  const opciones = { semestre: '2026B', app: 'prueba', config: cfg.version, ahora: AHORA };
  const antes = await exportarRespaldo(db, opciones);
  for (const [tabla, filas] of Object.entries(antes.tablas)) assert.ok(filas.length > 0, `tabla ${tabla} vacía en la prueba`);

  const texto = JSON.stringify(antes);   // como viaja por AirDrop
  await borrarTodo(db);
  assert.equal(await db.estudiantes.count(), 0);

  const leido = JSON.parse(texto);
  assert.deepEqual(validarRespaldo(leido, db, { semestre: '2026B' }), []);
  await restaurarRespaldo(db, leido);
  const despues = await exportarRespaldo(db, opciones);
  assert.deepEqual(despues, antes);
});

test('el respaldo rechaza archivos de otro formato, versión o semestre', async () => {
  const db = nuevaBase();
  await db.open();
  assert.ok(validarRespaldo({ formato: 'otro' }, db, { semestre: '2026B' }).length > 0);
  const base = { formato: 'lab-mn-respaldo', version: 1, semestre: '2027A', tablas: {} };
  assert.ok(validarRespaldo(base, db, { semestre: '2026B' }).some((e) => e.includes('2027A')));
  assert.ok(validarRespaldo({ ...base, semestre: '2026B', tablas: { inventada: [] } }, db, { semestre: '2026B' }).some((e) => e.includes('inventada')));
});
