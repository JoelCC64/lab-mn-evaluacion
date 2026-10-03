import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { leerAsistenciaSemana1, leerExcelSemestre, sinCorreos } from '../src/nucleo/excel-lectura.js';
import { ASISTENCIA_EJEMPLO, EXCEL_EJEMPLO, configReal } from './ayudas.js';

const cfg = configReal();

async function abrir(ruta) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  return wb;
}

/** Libro mínimo con una hoja de curso armada a mano. */
function libro(hojas) {
  const wb = new ExcelJS.Workbook();
  for (const [nombre, filas] of Object.entries(hojas)) {
    const ws = wb.addWorksheet(nombre);
    filas.forEach((f, i) => { ws.getRow(i + 1).values = f; });
  }
  return wb;
}

test('lee el Excel ficticio: 10 cursos, códigos, nombres, grupos, observaciones y pendientes', async () => {
  const lectura = leerExcelSemestre(await abrir(EXCEL_EJEMPLO), cfg);
  assert.deepEqual(lectura.errores, []);
  assert.deepEqual(lectura.avisos, []);
  assert.equal(Object.keys(lectura.cursos).length, 10);
  assert.equal(lectura.resumen.estudiantes, 196);
  assert.equal(lectura.resumen.pendientes, 2);
  const gr4eb = lectura.cursos.GR4EB.estudiantes;
  assert.equal(gr4eb.length, 19);
  const pendiente = gr4eb.find((e) => e.pendiente);
  assert.match(pendiente.observacion, /^Pendiente de la lista final/);
  assert.ok(gr4eb.every((e) => /^1999\d{5}$/.test(e.codigo)));
  assert.ok(gr4eb.every((e) => typeof e.grupo === 'string' || e.grupo === null));
  assert.equal(lectura.cursos.GR9EB.estudiantes.filter((e) => e.grupo === null).length, 3);
});

test('nunca lee la columna de correo: ningún dato leído contiene «@»', async () => {
  const lectura = leerExcelSemestre(await abrir(EXCEL_EJEMPLO), cfg);
  assert.ok(!JSON.stringify(lectura).includes('@'));
  for (const curso of Object.values(lectura.cursos)) assert.ok(!curso.columnas.includes('correo'));
});

test('busca los encabezados por su texto (otra fila y otro orden de columnas)', () => {
  const wb = libro({
    GR1QA: [
      ['Título cualquiera'], [], [], [], [],
      ['Observación', 'Apellidos y nombres', 'E-mail', 'Grupo de trabajo', 'Código único'],
      [null, 'PÉREZ ANA', 'ana@x.example', 2, 199912345],
      ['Pendiente de la lista final', 'LÓPEZ LUIS', 'luis@x.example', '3', '199912346'],
    ],
  });
  const lectura = leerExcelSemestre(wb, cfg);
  assert.deepEqual(lectura.errores, []);
  const [a, b] = lectura.cursos.GR1QA.estudiantes;
  assert.deepEqual([a.codigo, a.nombre, a.grupo, a.pendiente], ['199912345', 'PÉREZ ANA', '2', false]);
  assert.deepEqual([b.codigo, b.grupo, b.pendiente], ['199912346', '3', true]);
  assert.equal(lectura.cursos.GR1QA.filaEncabezados, 6);
  assert.ok(lectura.avisos.some((x) => x.includes('Grupo A/B')), 'avisa que falta una columna opcional');
  assert.ok(!JSON.stringify(lectura).includes('@'));
});

test('avisa de hojas que no son cursos, de cursos sin hoja y de columnas obligatorias faltantes', () => {
  const wb = libro({
    Resumen: [['Algo']],
    'Hoja rara': [['x']],
    GR2QB: [[], [], [], ['N°', 'Apellidos y nombres', 'Grupo de trabajo']],
  });
  const lectura = leerExcelSemestre(wb, cfg);
  assert.ok(lectura.avisos.some((x) => x.includes('«Hoja rara»')));
  assert.ok(!lectura.avisos.some((x) => x.includes('Resumen')), 'la hoja Resumen se ignora sin aviso');
  assert.ok(lectura.errores.some((x) => x.startsWith('GR2QB') && x.includes('encabezados')));
  assert.ok(lectura.avisos.some((x) => x.includes('GR1AA') && x.includes('no cambian')));
});

test('detecta códigos repetidos, filas sin código y correos colados en el nombre o la observación', () => {
  const enc = ['N°', 'Código único', 'Apellidos y nombres', 'Correo institucional', 'Grupo A/B', 'Metodología', 'Grupo de trabajo', 'Observación'];
  const wb = libro({
    GR2QB: [[], [], [], enc,
      [1, 199900001, 'RUIZ ANA', 'a@x.example', 'A', 'Clásica', 1, 'Escribir a otra.cuenta@gmail.com'],
      [2, null, 'SIN CÓDIGO', null, 'A', 'Clásica', 1, null],
      [3, 199900002, { richText: [{ text: 'VACA ' }, { text: 'LUIS' }] }, null, 'A', 'Clásica', { formula: '1+1', result: 2 }, null]],
    GR9EB: [[], [], [], enc, [1, 199900001, 'RUIZ ANA', null, 'B', 'SQI', 1, null]],
  });
  const lectura = leerExcelSemestre(wb, cfg);
  assert.ok(lectura.errores.some((x) => x.includes('fila 6') && x.includes('código')));
  assert.ok(lectura.errores.some((x) => x.includes('199900001') && x.includes('ya aparece')));
  const [ana, luis] = lectura.cursos.GR2QB.estudiantes;
  assert.equal(ana.observacion, 'Escribir a [correo omitido]');
  assert.deepEqual([luis.nombre, luis.grupo], ['VACA LUIS', '2']);
  assert.ok(lectura.avisos.some((x) => x.includes('GR9EB') && x.includes('cronograma')));
  assert.ok(lectura.avisos.some((x) => x.includes('GR9EB') && x.includes('metodología')));
  assert.ok(!JSON.stringify(lectura).includes('@'));
  assert.equal(sinCorreos('a b@c.d e'), 'a [correo omitido] e');
});

test('lee la asistencia de la semana 1 (opcional): estados y cursos sin clase', async () => {
  const lectura = leerAsistenciaSemana1(await abrir(ASISTENCIA_EJEMPLO), cfg);
  assert.deepEqual(lectura.errores, []);
  assert.equal(lectura.cursos.GR2QB.sin_clase, 'permiso de las autoridades');
  assert.equal(lectura.cursos.GR2QB.filas.length, 0);
  const gr9eb = lectura.cursos.GR9EB.filas;
  assert.equal(gr9eb.length, 19);
  assert.equal(gr9eb.filter((f) => f.estado === 'no_vino').length, 3);
  const gr4eb = lectura.cursos.GR4EB.filas;
  assert.ok(gr4eb.some((f) => f.pendiente && f.estado === 'presente'), '«Asistió · pendiente» cuenta como presente');
  assert.ok(!JSON.stringify(lectura).includes('@'));
});

test('el Excel del semestre no sirve como asistencia de la semana 1 (falta la columna)', async () => {
  const lectura = leerAsistenciaSemana1(await abrir(EXCEL_EJEMPLO), cfg);
  assert.ok(lectura.errores.some((x) => x.includes('Asistencia')));
});
