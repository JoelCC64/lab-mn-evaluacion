// El Excel ficticio tiene la forma del real (Anexo J) y no contiene datos reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { ASISTENCIA_EJEMPLO, EXCEL_EJEMPLO, configReal } from './ayudas.js';

const ENCABEZADOS = ['N°', 'Código único', 'Apellidos y nombres', 'Correo institucional', 'Grupo A/B', 'Metodología', 'Grupo de trabajo', 'Observación'];

async function abrir(ruta) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  return wb;
}

test('Excel ficticio del semestre: Resumen + 10 hojas de curso con la estructura exacta', async () => {
  const cfg = configReal();
  const wb = await abrir(EXCEL_EJEMPLO);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['Resumen', ...cfg.cursos.map((c) => c.paralelo)]);
  let pendientes = 0;
  for (const curso of cfg.cursos) {
    const ws = wb.getWorksheet(curso.paralelo);
    assert.deepEqual(ws.getRow(4).values.slice(1), ENCABEZADOS, curso.paralelo);
    assert.match(String(ws.getCell('A1').value), new RegExp(`^${curso.paralelo} · `));
    const filas = [];
    ws.eachRow((fila, n) => { if (n > 4) filas.push(fila); });
    const n = filas.length;
    assert.ok(n >= 17 && n <= 23, `${curso.paralelo}: ${n} filas`);
    const grupos = new Map();
    for (const f of filas) {
      const codigo = f.getCell(2).value;
      assert.match(String(codigo), /^1999\d{5}$/, 'los códigos ficticios empiezan con 1999');
      const correo = f.getCell(4).value;
      if (correo) assert.match(String(correo), /@epn\.example$/, 'los correos ficticios usan @epn.example');
      assert.equal(f.getCell(6).value, curso.metodologia === 'TRAD' ? 'Clásica' : 'SQI');
      assert.equal(f.getCell(5).value, curso.cronograma);
      const g = f.getCell(7).value;
      if (g !== null && g !== undefined) grupos.set(g, (grupos.get(g) ?? 0) + 1);
      if (String(f.getCell(8).value ?? '').startsWith('Pendiente')) pendientes += 1;
    }
    for (const [g, tam] of grupos) assert.ok(tam === 3 || tam === 4, `${curso.paralelo} grupo ${g}: ${tam}`);
  }
  assert.ok(pendientes >= 1 && pendientes <= 2, 'uno o dos pendientes');
  // Algo de formato: encabezado azul con texto blanco, columnas anchas y paneles fijos.
  const ws = wb.getWorksheet('GR2QB');
  assert.equal(ws.getCell('A4').fill.fgColor.argb.slice(-6), '1F3A5F'); // openpyxl guarda el alfa como 00, igual que el real
  assert.equal(ws.getColumn(3).width, 42);
  assert.equal(ws.views[0].state, 'frozen');
});

test('Excel ficticio de asistencia de la semana 1: misma estructura más la columna «Asistencia»', async () => {
  const wb = await abrir(ASISTENCIA_EJEMPLO);
  const ws = wb.getWorksheet('GR9EB');
  assert.deepEqual(ws.getRow(4).values.slice(1),
    ['N°', 'Código único', 'Apellidos y nombres', 'Grupo A/B', 'Metodología', 'Asistencia', 'Grupo de trabajo', 'Correo institucional', 'Observación']);
  assert.ok(wb.getWorksheet('Correos') && wb.getWorksheet('Observaciones'));
});
