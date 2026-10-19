// Taller: quien está en clase pero no hizo el coloquio conserva su asistencia y queda sin nota (0).
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cerrarPase, guardarAjuste, guardarPuntaje, marcarAsistencia, marcarSinColoquio } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto, gruposDe, notaEvento, rubrica } from '../src/nucleo/motor.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-10-19T14:30:00.000Z';

// GR2QB (Clásica A): T1 en la semana 4. a y b en el grupo 1.
async function escenario() {
  const db = abrirBase(`sc-${randomUUID()}`);
  await db.estudiantes.bulkPut(['a', 'b'].map((id, i) => ({ id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} NOMBRE`, curso: 'GR2QB', estado: 'nomina', grupo_excel: '1', numero: i + 1 })));
  const c = cfg.cursoPorId.GR2QB;
  const cargar = async () => {
    const reg = await registrosDelCurso(db, 'GR2QB');
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return { eventos, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  const { ctx, eventos } = await cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  const grupos = gruposDe(ctx, t1);
  for (const p of rubrica(cfg, cfg.actividades[t1.config])) await guardarPuntaje(db, t1.id, grupos, '1', p.id, Math.max(...p.escala), AHORA);
  const nota = async (id) => { const x = await cargar(); return notaEvento(x.ctx, t1, id); };
  return { db, t1, grupos, cargar, nota };
}

test('sin coloquio: sigue presente, pero el taller queda en 0 con el motivo; quitarlo devuelve la nota', async () => {
  const k = await escenario();
  await marcarSinColoquio(k.db, k.t1.id, k.grupos, 'b', true, AHORA);
  await cerrarPase(k.db, k.t1.id, k.grupos, 'sin grupo', AHORA);

  let b = await k.nota('b');
  assert.equal(b.estado, 'calculada');
  assert.equal(b.valor, 0);
  assert.match(b.motivo, /no hizo el coloquio/);
  assert.equal(b.asistencia, 'presente', 'la asistencia no cambia');
  const a = await k.nota('a');
  assert.ok(a.valor > 0, 'su compañero conserva la nota del grupo');
  const { ctx } = await k.cargar();
  assert.equal(ctx.asistencia.get(`${k.t1.id}|b`).sin_coloquio, true);

  await marcarSinColoquio(k.db, k.t1.id, k.grupos, 'b', false, AHORA);
  b = await k.nota('b');
  assert.ok(b.valor > 0);
  assert.equal((await k.cargar()).ctx.asistencia.get(`${k.t1.id}|b`).sin_coloquio, undefined);
});

test('la marca se conserva al cambiar la asistencia; el ajuste individual manda', async () => {
  const k = await escenario();
  await marcarSinColoquio(k.db, k.t1.id, k.grupos, 'b', true, AHORA);
  await marcarAsistencia(k.db, k.t1.id, k.grupos, 'b', 'se_retiro_antes', null, AHORA);
  await cerrarPase(k.db, k.t1.id, k.grupos, 'sin grupo', AHORA);
  assert.equal((await k.nota('b')).valor, 0);
  assert.equal((await k.nota('b')).asistencia, 'se_retiro_antes');
  await guardarAjuste(k.db, k.t1.id, 'b', 0.3, 'revisión', AHORA);
  assert.equal((await k.nota('b')).valor, 0.3);
});
