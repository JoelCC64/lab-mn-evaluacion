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

// Casos del respaldo real (13-nov-2026): eventos que quedaban «por evaluar» para siempre en el aviso de Inicio.
test('«sin coloquio» a quien no tenía fila en el pase cerrado: presente y taller en 0 (no «no consta en el pase»)', async () => {
  const k = await escenario();
  await cerrarPase(k.db, k.t1.id, k.grupos, 'sin grupo', AHORA);
  // Fila vieja sin estado (como la dejaba la app antes) con la marca puesta después del cierre.
  await k.db.asistencia.put({ evento: k.t1.id, estudiante: 'c', estado: null, motivo: null, observacion: 'Sí vino', sin_coloquio: true, fecha: AHORA });
  await k.db.estudiantes.put({ id: 'c', codigo: 'c', nombre: 'APELLIDOC NOMBRE', curso: 'GR2QB', estado: 'pendiente', agregado: '2026-10-05T21:45:15.487Z' });
  const c = await k.nota('c');
  assert.equal(c.estado, 'calculada');
  assert.equal(c.valor, 0);
  assert.match(c.motivo, /no hizo el coloquio/);
  assert.equal(c.asistencia, 'presente');
  // Y la acción ya deja la fila como presente.
  await marcarSinColoquio(k.db, k.t1.id, k.grupos, 'd', true, AHORA);
  assert.equal((await k.db.asistencia.get([k.t1.id, 'd'])).estado, 'presente');
});

test('agregado al curso después de cerrar el pase: perdió la sesión (0, recuperable) y deja de estar «por evaluar»', async () => {
  const k = await escenario();
  await cerrarPase(k.db, k.t1.id, k.grupos, 'sin grupo', AHORA);
  await k.db.estudiantes.put({ id: 'n', codigo: 'n', nombre: 'NUEVO NUEVA ESTUDIANTE', curso: 'GR2QB', estado: 'pendiente', agregado: '2026-10-27T19:23:22.871Z' });
  let n = await k.nota('n');
  assert.equal(n.estado, 'calculada');
  assert.equal(n.valor, 0);
  assert.match(n.motivo, /aún no estaba en el curso/);
  // Agregado ANTES del cierre y sin fila: sigue pendiente (es un descuido del pase, no una ausencia).
  await k.db.estudiantes.put({ id: 'm', codigo: 'm', nombre: 'ANTES ANTES ESTUDIANTE', curso: 'GR2QB', estado: 'pendiente', agregado: '2026-10-05T21:45:15.487Z' });
  assert.equal((await k.nota('m')).estado, 'pendiente');
  // La recuperación manda sobre la ausencia.
  await k.db.recuperaciones.put({ evento: k.t1.id, estudiante: 'n', estado: 'realizada', nota: 0.7, motivo: 'justificada', detalle: 'otro curso', fecha: AHORA });
  n = await k.nota('n');
  assert.equal(n.valor, 0.7);
});
