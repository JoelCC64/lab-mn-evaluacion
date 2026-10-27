// Marca «AR» (ajustes razonables, Bienestar Estudiantil): solo una marca en el estudiante; sobrevive a leer el Excel
// otra vez y no cambia ninguna nota.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { aplicarExcelSemestre } from '../src/datos/importar.js';
import { marcarAjustesRazonables } from '../src/datos/acciones.js';

const AHORA = '2026-10-27T14:30:00.000Z';

test('marcar y desmarcar; la marca sobrevive a leer el Excel del semestre otra vez', async () => {
  const db = abrirBase(`ar-${randomUUID()}`);
  const lectura = (grupo) => ({ cursos: { GR1AA: { estudiantes: [{ codigo: '202600001', nombre: 'APELLIDO NOMBRE', pendiente: false, grupo, observacion: null, numero: 1 }] } } });
  await aplicarExcelSemestre(db, lectura('1'), { ahora: AHORA });
  assert.equal((await db.estudiantes.get('202600001')).ajustes_razonables, undefined);

  await marcarAjustesRazonables(db, '202600001', true, AHORA);
  assert.equal((await db.estudiantes.get('202600001')).ajustes_razonables, true);

  await aplicarExcelSemestre(db, lectura('2'), { ahora: AHORA });   // cambia su grupo en el Excel
  const e = await db.estudiantes.get('202600001');
  assert.equal(e.grupo_excel, '2');
  assert.equal(e.ajustes_razonables, true, 'la marca se conserva');

  await marcarAjustesRazonables(db, '202600001', false, AHORA);
  assert.equal('ajustes_razonables' in (await db.estudiantes.get('202600001')), false);
  await assert.rejects(marcarAjustesRazonables(db, 'no-existe', true, AHORA), /No existe/);
});
