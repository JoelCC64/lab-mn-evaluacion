// Respaldo del día en Excel: legible (cursos, asistencia, detalle) y restaurable (hoja oculta con los datos).
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';

import { abrirBase } from '../src/db.js';
import { leerExcelSemestre } from '../src/nucleo/excel-lectura.js';
import { aplicarExcelSemestre } from '../src/datos/importar.js';
import { exportarRespaldo, restaurarRespaldo, validarRespaldo } from '../src/datos/respaldo.js';
import { cargarCursos } from '../src/datos/excel-datos.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cerrarPase, guardarObservacion, guardarPuntaje, marcarAsistencia } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearLibroRespaldo, leerRespaldoDeLibro, HOJA_RESPALDO } from '../src/nucleo/respaldo-libro.js';
import { EXCEL_EJEMPLO, configReal } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-10-05T17:00:00.000Z';   // lunes 5 de octubre (hora local)
const HOY = '2026-10-05';
const OPCIONES = { semestre: '2026B', app: 'prueba', config: cfg.version, ahora: AHORA };

async function libro(buffer) {
  const wb = new ExcelJS.Workbook();
  if (buffer) await wb.xlsx.load(buffer); else await wb.xlsx.readFile(EXCEL_EJEMPLO);
  return wb;
}

/** Base con el Excel ficticio y una P1 en GR2QB, con textos difíciles (emojis, espacios en los bordes, uno muy largo). */
async function baseConClase() {
  const db = abrirBase(`respaldo-libro-${randomUUID()}`);
  await aplicarExcelSemestre(db, leerExcelSemestre(await libro(), cfg), { ahora: AHORA });
  const reg = await registrosDelCurso(db, 'GR2QB');
  const eventos = generarEventos(cfg, cfg.cursoPorId.GR2QB, reg.cambios_evento);
  const p1 = eventos.find((e) => e.codigo === 'P1');
  const grupos = gruposDelEvento(p1, eventos, reg).porEstudiante;
  for (const [aspecto, v] of [['diseno', 3], ['datos', 4], ['analisis', 2]]) await guardarPuntaje(db, p1.id, grupos, '1', aspecto, v, AHORA);
  const [a, b] = reg.estudiantes.filter((e) => grupos.get(e.id) === '1');
  await marcarAsistencia(db, p1.id, grupos, a.id, 'no_vino', null, AHORA);
  await guardarObservacion(db, p1.id, b.id, 'Trabajo destacado 👏 · «muy bien»', AHORA);
  await cerrarPase(db, p1.id, grupos, cfg.asistencia.motivos.sin_grupo, AHORA);
  // Una nota larguísima, para que los datos ocupen varias celdas (con espacios y emojis en cualquier lugar).
  const largo = Array.from({ length: 4000 }, (_, i) => (i % 7 === 0 ? '🧪 ' : 'medición ') + i).join('  ');
  await db.notas.put({ evento: p1.id, unidad: 'grupo', unidad_id: '2', texto: ` ${largo} `, fecha: AHORA });
  return { db, p1, a, b };
}

test('el respaldo en Excel guarda exactamente los mismos datos que el JSON y se restaura igual', async () => {
  const { db } = await baseConClase();
  const respaldo = await exportarRespaldo(db, OPCIONES);
  assert.ok(JSON.stringify(respaldo).length > 60000, 'los datos ocupan varias celdas');
  const wb = crearLibroRespaldo(ExcelJS, cfg, await cargarCursos(db, cfg), respaldo, { hoy: HOY });
  const buffer = await wb.xlsx.writeBuffer();

  const leido = leerRespaldoDeLibro(await libro(buffer));
  assert.deepEqual(leido, respaldo);

  const otra = abrirBase(`restaurada-${randomUUID()}`);
  await otra.open();
  assert.deepEqual(validarRespaldo(leido, otra, { semestre: '2026B' }), []);
  await restaurarRespaldo(otra, leido);
  assert.deepEqual(await exportarRespaldo(otra, OPCIONES), respaldo);
});

test('el respaldo en Excel se puede leer: Léeme con lo del día, una hoja por curso con notas, asistencia y detalle', async () => {
  const { db, a, b } = await baseConClase();
  const respaldo = await exportarRespaldo(db, OPCIONES);
  const wb = await libro(await crearLibroRespaldo(ExcelJS, cfg, await cargarCursos(db, cfg), respaldo, { hoy: HOY }).xlsx.writeBuffer());
  const nombres = wb.worksheets.map((w) => w.name);
  assert.equal(nombres[0], 'Léeme');
  assert.deepEqual(nombres.slice(1, 11), cfg.cursos.map((c) => c.paralelo));
  assert.ok(nombres.includes(cfg.excel.escritura.hoja_asistencia) && nombres.includes(cfg.excel.escritura.hoja_detalle));
  assert.ok(!nombres.includes(cfg.excel.escritura.hoja_control), 'sin la hoja de control de la escritura');
  assert.equal(wb.getWorksheet(HOJA_RESPALDO).state, 'veryHidden');

  const leeme = wb.getWorksheet('Léeme');
  assert.match(String(leeme.getCell('A9').value), /^Registros del lun 5 oct/);
  assert.match(String(leeme.getCell('B11').value), /^P1 · /);
  assert.equal(leeme.getCell('A11').value, 'GR2QB');

  const ws = wb.getWorksheet('GR2QB');
  assert.deepEqual([1, 2, 3, 4, 5].map((c) => ws.getRow(4).getCell(c).value), ['N°', 'Código único', 'Apellidos y nombres', null, 'Grupo actual']);
  let filaA;
  ws.eachRow((fila) => { if (fila.getCell(2).value === a.id) filaA = fila; });
  assert.equal(filaA.getCell(6).value, 0, 'quien faltó tiene 0 en P1');
  assert.match(String(filaA.getCell(ws.getRow(4).values.indexOf('Observaciones de la app')).value), /P1: no vino/);
  const det = wb.getWorksheet(cfg.excel.escritura.hoja_detalle);
  let filaB;
  det.eachRow((fila) => { if (fila.getCell(2).value === b.id && fila.getCell(6).value === 'P1') filaB = fila; });
  assert.equal(filaB.getCell(15).value, 'Trabajo destacado 👏 · «muy bien»');
});

test('un Excel que no es un respaldo (por ejemplo, el del semestre) no se confunde con uno', async () => {
  assert.equal(leerRespaldoDeLibro(await libro()), null);
});

test('la base avisa después de cada escritura (para el recordatorio de respaldo)', async () => {
  const tablas = [];
  const db = abrirBase(`aviso-${randomUUID()}`, { alCambiar: (t) => tablas.push(t) });
  await db.estudiantes.put({ id: '1', codigo: '1', nombre: 'X', curso: 'GR2QB', estado: 'nomina' });
  await db.asistencia.put({ evento: 'GR2QB:P1', estudiante: '1', estado: 'presente' });
  await db.asistencia.delete(['GR2QB:P1', '1']);
  assert.deepEqual(tablas, ['estudiantes', 'asistencia', 'asistencia']);
  assert.equal(await db.estudiantes.count(), 1);
});
