// Estudiante nuevo agregado en la app (matrícula extraordinaria): entra al curso como pendiente, con su grupo desde
// el evento en que llegó; leer el Excel no lo da de baja y, si el Excel lo trae, pasa a ser uno más; se corrige su
// código o su nombre, y se quita si fue un error.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { aplicarExcelSemestre, planificarImportacion } from '../src/datos/importar.js';
import {
  agregarEstudianteNuevo, agregarAlControl, cerrarPase, corregirEstudianteNuevo, guardarAjuste, guardarObservacion, guardarPuntaje,
  puntuarPregunta, quitarEstudianteNuevo,
} from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { activos, gruposDelEvento } from '../src/nucleo/grupos.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-10-05T14:30:00.000Z';
const nombre = (x) => `APELLIDO${x.toUpperCase()} NOMBRE${x.toUpperCase()}`;

async function curso() {
  const db = abrirBase(`nuevo-${randomUUID()}`);
  await db.estudiantes.bulkPut(['a', 'b', 'c'].map((id, i) => ({
    id, codigo: id, nombre: nombre(id), curso: 'GR2QB', estado: 'nomina', grupo_excel: id === 'c' ? '2' : '1', numero: i + 1,
  })));
  await db.estudiantes.put({ id: '202620777', codigo: '202620777', nombre: 'OTRO CURSO', curso: 'GR1AA', estado: 'nomina', grupo_excel: '1', numero: 1 });
  const c = cfg.cursoPorId.GR2QB;
  const cargar = async () => {
    const reg = await registrosDelCurso(db, 'GR2QB');
    return { reg, eventos: generarEventos(cfg, c, reg.cambios_evento) };
  };
  const grupos = async (codigo) => {
    const { reg, eventos } = await cargar();
    return gruposDelEvento(eventos.find((e) => e.codigo === codigo), eventos, reg).porEstudiante;
  };
  return { db, cargar, grupos };
}

const lecturaExcel = (extra = []) => ({
  cursos: { GR2QB: { estudiantes: [...['a', 'b', 'c'], ...extra].map((x, i) => ({
    codigo: x, nombre: nombre(x), pendiente: false, grupo: x === 'c' ? '2' : '1', observacion: null, numero: i + 1,
  })) } },
});

test('estudiante nuevo: entra al curso pendiente, en su grupo y presente; sigue en los eventos siguientes', async () => {
  const k = await curso();
  const id = await agregarEstudianteNuevo(k.db, 'GR2QB:P1', await k.grupos('P1'), '2', { codigo: ' 2026 21999 ', nombre: '  pérez  ruiz ana ' }, AHORA);
  assert.equal(id, '202621999');
  const e = await k.db.estudiantes.get(id);
  assert.deepEqual([e.nombre, e.curso, e.estado, e.agregado], ['PÉREZ RUIZ ANA', 'GR2QB', 'pendiente', AHORA]);
  assert.equal((await k.db.asistencia.get(['GR2QB:P1', id])).estado, 'presente');

  const { reg } = await k.cargar();
  assert.ok(activos(reg.estudiantes).some((x) => x.id === id), 'cuenta en el curso');
  assert.equal((await k.grupos('P1')).get(id), '2');
  assert.equal((await k.grupos('T1')).get(id), '2', 'el grupo pasa a los eventos siguientes');
  assert.equal((await k.grupos('P1')).get('a'), '1', 'los demás no cambian');
});

test('estudiante nuevo: códigos repetidos, de otro curso, inválidos o con correo se rechazan', async () => {
  const k = await curso();
  const g = await k.grupos('P1');
  await assert.rejects(agregarEstudianteNuevo(k.db, 'GR2QB:P1', g, '1', { codigo: 'a', nombre: 'X' }), /solo números/);
  await assert.rejects(agregarEstudianteNuevo(k.db, 'GR2QB:P1', g, '1', { codigo: '202620777', nombre: 'X' }), /ya está en GR1AA/);
  await assert.rejects(agregarEstudianteNuevo(k.db, 'GR2QB:P1', g, '1', { codigo: '202621999', nombre: 'x@epn.example' }), /correos/);
  await assert.rejects(agregarEstudianteNuevo(k.db, 'GR2QB:P1', g, '1', { codigo: '', nombre: 'X' }), /Hacen falta/);
  await agregarEstudianteNuevo(k.db, 'GR2QB:P1', g, '1', { codigo: '202621999', nombre: 'X' }, AHORA);
  await assert.rejects(agregarEstudianteNuevo(k.db, 'GR2QB:P1', await k.grupos('P1'), '1', { codigo: '202621999', nombre: 'X' }), /ya está en este curso/);
});

test('estudiante nuevo: leer el Excel no lo da de baja; si el Excel lo trae, pasa a ser uno más', async () => {
  const k = await curso();
  const id = await agregarEstudianteNuevo(k.db, 'GR2QB:P1', await k.grupos('P1'), '1', { codigo: '202621999', nombre: 'X' }, AHORA);
  const plan = await planificarImportacion(k.db, lecturaExcel());
  assert.ok(!plan.cambios.some((c) => c.antes?.id === id), 'no es baja');
  assert.equal(plan.resumen.bajas, 0);

  await aplicarExcelSemestre(k.db, lecturaExcel([id]), { ahora: AHORA });
  const e = await k.db.estudiantes.get(id);
  assert.deepEqual([e.estado, e.agregado, e.nombre], ['nomina', null, nombre(id)]);
  assert.equal((await k.grupos('P1')).get(id), '1', 'conserva su grupo de la app');
  // Ya viene del Excel: si deja de estar, es baja como cualquiera.
  assert.equal((await planificarImportacion(k.db, lecturaExcel())).resumen.bajas, 1);
});

test('estudiante nuevo agregado por error: se quita con lo que se le registró; los demás no cambian', async () => {
  const k = await curso();
  const id = await agregarEstudianteNuevo(k.db, 'GR2QB:P1', await k.grupos('P1'), '1', { codigo: '202621999', nombre: 'X' }, AHORA);
  const g = await k.grupos('P1');
  await guardarPuntaje(k.db, 'GR2QB:P1', g, '1', 'diseno', 3, AHORA);
  await cerrarPase(k.db, 'GR2QB:P1', g, 'sin grupo', AHORA);
  await quitarEstudianteNuevo(k.db, id);
  assert.equal(await k.db.estudiantes.get(id), undefined);
  assert.equal(await k.db.grupos_evento.where('estudiante').equals(id).count(), 0);
  assert.equal(await k.db.asistencia.where('estudiante').equals(id).count(), 0);
  assert.equal(await k.db.asistencia.where('evento').equals('GR2QB:P1').count(), 3, 'el pase de los demás sigue');
  assert.equal(await k.db.puntajes.count(), 1);
  await assert.rejects(quitarEstudianteNuevo(k.db, 'a'), /agregados en la app/);
});

test('estudiante nuevo mal escrito: se corrige el nombre y el código, y lo registrado pasa al código nuevo', async () => {
  const k = await curso();
  const id = await agregarEstudianteNuevo(k.db, 'GR2QB:P1', await k.grupos('P1'), '2', { codigo: '202621999', nombre: 'PERES' }, AHORA);
  assert.equal(await corregirEstudianteNuevo(k.db, id, { codigo: id, nombre: ' pérez  ruiz ana ' }, AHORA), id);
  assert.equal((await k.db.estudiantes.get(id)).nombre, 'PÉREZ RUIZ ANA');

  await guardarObservacion(k.db, 'GR2QB:P1', id, 'llegó tarde', AHORA);
  await agregarAlControl(k.db, 'GR2QB:P1', [id], {}, AHORA);
  await puntuarPregunta(k.db, 'GR2QB:P1', id, 0, 2, AHORA);
  await guardarAjuste(k.db, 'GR2QB:P1', id, 0.8, 'prueba', AHORA);
  await cerrarPase(k.db, 'GR2QB:P1', await k.grupos('P1'), 'sin grupo', AHORA);

  const nuevo = await corregirEstudianteNuevo(k.db, id, { codigo: '202621998', nombre: 'PÉREZ RUIZ ANA' }, AHORA);
  assert.equal(nuevo, '202621998');
  assert.equal(await k.db.estudiantes.get(id), undefined);
  const e = await k.db.estudiantes.get(nuevo);
  assert.deepEqual([e.codigo, e.estado, e.agregado, e.curso], [nuevo, 'pendiente', AHORA, 'GR2QB']);
  for (const t of ['grupos_evento', 'asistencia', 'controles', 'ajustes']) {
    assert.equal(await k.db.table(t).where('estudiante').equals(id).count(), 0, `${t}: nada con el código viejo`);
    assert.equal(await k.db.table(t).where('estudiante').equals(nuevo).count(), 1, `${t}: pasó al código nuevo`);
  }
  const a = await k.db.asistencia.get(['GR2QB:P1', nuevo]);
  assert.deepEqual([a.estado, a.observacion], ['presente', 'llegó tarde']);
  assert.deepEqual((await k.db.controles.get(['GR2QB:P1', nuevo])).puntajes[0], 2);
  assert.equal((await k.grupos('P1')).get(nuevo), '2');
  assert.equal((await k.grupos('T1')).get(nuevo), '2');

  await assert.rejects(corregirEstudianteNuevo(k.db, nuevo, { codigo: 'a', nombre: 'X' }), /solo números/);
  await assert.rejects(corregirEstudianteNuevo(k.db, nuevo, { codigo: '202620777', nombre: 'X' }), /ya es de OTRO CURSO/);
  await assert.rejects(corregirEstudianteNuevo(k.db, 'a', { codigo: 'a', nombre: 'X' }), /en el Excel/);
});
