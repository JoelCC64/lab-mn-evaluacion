// Décimas de premio: se suman a la nota de la próxima práctica a la que el estudiante asista (sin pasar de 10);
// pueden ser de un grupo (una fila por integrante presente) o de un estudiante; solo múltiplos de 0.1.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cerrarPase, guardarAjuste, guardarPuntaje, marcarAsistencia, otorgarDecimas, quitarDecimas } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto, decimasDelEvento, destinoDecimas, gruposDe, notaEvento } from '../src/nucleo/motor.js';
import { configReal, copia } from './ayudas.js';
import { rubrica } from '../src/nucleo/motor.js';

/** Configuración real más P2 y P3 (Clásica), copiadas de P1 (sus guías aún no llegan). */
function configCompleta() {
  const c = copia(configReal());
  for (const cod of ['P2', 'P3']) c.actividades[`${cod}-TRAD`] = { ...copia(c.actividades['P1-TRAD']), id: `${cod}-TRAD`, codigo: cod, etiquetas: [] };
  return c;
}
const cfg = configCompleta();
const AHORA = '2026-10-19T14:30:00.000Z';

// GR2QB (Clásica A): P1 (sem. 2), T1 (4), P2 (5), T2 (6), P3 (7)… Estudiantes a, b, c (grupo 1) y d (grupo 2).
async function curso() {
  const db = abrirBase(`dec-${randomUUID()}`);
  await db.estudiantes.bulkPut(['a', 'b', 'c', 'd'].map((id, i) => ({
    id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} NOMBRE`, curso: 'GR2QB', estado: 'nomina', grupo_excel: id === 'd' ? '2' : '1', numero: i + 1,
  })));
  const c = cfg.cursoPorId.GR2QB;
  const cargar = async () => {
    const reg = await registrosDelCurso(db, 'GR2QB');
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return { reg, eventos, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  // Cierra el pase de una práctica con todo evaluado al máximo (nota de práctica = 1) y las faltas indicadas.
  const practica = async (codigo, { faltan = [], baja = null } = {}) => {
    const { ctx, eventos } = await cargar();
    const ev = eventos.find((e) => e.codigo === codigo);
    const grupos = gruposDe(ctx, ev);
    for (const id of faltan) await marcarAsistencia(db, ev.id, grupos, id, 'no_vino', null, AHORA);
    const partes = rubrica(cfg, cfg.actividades[ev.config]);
    for (const g of ['1', '2']) {
      for (const [i, p] of partes.entries()) await guardarPuntaje(db, ev.id, grupos, g, p.id, baja !== null && i === 0 ? baja : Math.max(...p.escala), AHORA);
    }
    const { ctx: ctx2 } = await cargar();
    await cerrarPase(db, ev.id, gruposDe(ctx2, ev), 'sin grupo', AHORA);
    return ev;
  };
  const nota = async (codigo, id) => {
    const { ctx, eventos } = await cargar();
    return notaEvento(ctx, eventos.find((e) => e.codigo === codigo), id);
  };
  return { db, cargar, practica, nota };
}

test('décimas individuales: se suman a la próxima práctica (no al evento donde se ganaron) y el motivo lo explica', async () => {
  const k = await curso();
  const { eventos } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  await otorgarDecimas(k.db, t1.id, ['a'], { valor: 0.3, motivo: 'pregunta de incertidumbre' }, AHORA);
  const { ctx } = await k.cargar();
  assert.equal(destinoDecimas(ctx, t1.id, 'a').codigo, 'P2', 'después del T1 la próxima práctica es P2');
  assert.equal(decimasDelEvento(ctx, eventos.find((e) => e.codigo === 'P1'), 'a').total, 0, 'no cuentan hacia atrás');
  await k.practica('P2', { baja: 0 });
  const n = await k.nota('P2', 'a');
  const sin = await k.nota('P2', 'b');
  assert.equal(n.estado, 'calculada');
  assert.ok(Math.abs(n.valor - Math.min(1, sin.valor + 0.03)) < 1e-9, 'a recibe 0.3 décimas sobre 10 (0.03 en escala 0–1)');
  assert.match(n.motivo, /incluye \+0\.3 de décimas/);
  assert.equal(n.decimas.total, 0.3);
});

test('tope de 10: con la nota en 10 no se pasa; con menos solo suma lo que cabe', async () => {
  const k = await curso();
  const { eventos } = await k.cargar();
  await otorgarDecimas(k.db, eventos.find((e) => e.codigo === 'T1').id, ['a', 'b'], { valor: 0.5 }, AHORA);
  await k.practica('P2');
  const a = await k.nota('P2', 'a');
  assert.equal(a.valor, 1, 'no pasa de 10');
  assert.equal(a.decimas.aplicadas, 0, 'ya tenía 10: no se aplicó nada');
  assert.match(a.motivo, /ya tiene 10/);

  // Con la nota por debajo de 10, un premio grande se corta en 10 y se aplica solo lo que cabía.
  const k2 = await curso();
  await otorgarDecimas(k2.db, (await k2.cargar()).eventos.find((e) => e.codigo === 'T1').id, ['a'], { valor: 3 }, AHORA);
  await k2.practica('P2', { baja: 0 });
  const n = await k2.nota('P2', 'a');
  assert.ok(n.valor_sin_decimas < 1, 'la base no es 10');
  assert.equal(n.valor, Math.min(1, n.valor_sin_decimas + 0.3));
  assert.ok(Math.abs(n.decimas.aplicadas - (n.valor - n.valor_sin_decimas) * 10) < 1e-6);
  const b = await k2.nota('P2', 'b');
  assert.equal(b.valor_sin_decimas, undefined, 'quien no recibió décimas no cambia');
});

test('si falta a la práctica destino, las décimas pasan a la siguiente práctica a la que asista', async () => {
  const k = await curso();
  const { eventos } = await k.cargar();
  await otorgarDecimas(k.db, eventos.find((e) => e.codigo === 'T1').id, ['a'], { valor: 0.2 }, AHORA);
  await k.practica('P2', { faltan: ['a'] });
  const enP2 = await k.nota('P2', 'a');
  assert.equal(enP2.valor, 0, 'faltó: 0, sin décimas');
  assert.equal(enP2.decimas, undefined);
  let { ctx } = await k.cargar();
  assert.equal(destinoDecimas(ctx, eventos.find((e) => e.codigo === 'T1').id, 'a').codigo, 'P3', 'pasan a P3');
  await k.practica('P3', { baja: 0 });
  const enP3 = await k.nota('P3', 'a');
  assert.equal(enP3.decimas.total, 0.2);
  assert.match(enP3.motivo, /incluye/);
});

test('premio de grupo: una fila por integrante presente, mismo lote; se quita de una vez o de a uno', async () => {
  const k = await curso();
  const { eventos } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  const lote = await otorgarDecimas(k.db, t1.id, ['a', 'b', 'c'], { valor: 0.1, motivo: 'pregunta compleja', unidad: 'grupo', grupo: '1' }, AHORA);
  const filas = await k.db.decimas.toArray();
  assert.equal(filas.length, 3);
  assert.ok(filas.every((f) => f.lote === lote && f.unidad === 'grupo' && f.grupo === '1' && f.valor === 0.1));
  await quitarDecimas(k.db, t1.id, lote, 'b');
  assert.deepEqual((await k.db.decimas.toArray()).map((f) => f.estudiante).sort(), ['a', 'c']);
  await quitarDecimas(k.db, t1.id, lote);
  assert.equal(await k.db.decimas.count(), 0);
});

test('solo múltiplos de 0.1, y alguien a quien dárselas; varios premios se suman', async () => {
  const k = await curso();
  const t1 = (await k.cargar()).eventos.find((e) => e.codigo === 'T1').id;
  for (const mal of [0.15, 0, -0.1, 0.25, 11, NaN]) await assert.rejects(otorgarDecimas(k.db, t1, ['a'], { valor: mal }), /de 0\.1 en 0\.1/);
  await assert.rejects(otorgarDecimas(k.db, t1, [], { valor: 0.1 }), /a quién/);
  await otorgarDecimas(k.db, t1, ['a'], { valor: 0.1 }, AHORA);
  await otorgarDecimas(k.db, t1, ['a'], { valor: 0.2 }, AHORA);
  await otorgarDecimas(k.db, (await k.cargar()).eventos.find((e) => e.codigo === 'P2').id, ['a'], { valor: 0.3 }, AHORA);
  const { ctx, eventos } = await k.cargar();
  assert.equal(decimasDelEvento(ctx, eventos.find((e) => e.codigo === 'P2'), 'a').total, 0.3, 'las del T1 cuentan en P2');
  assert.equal(decimasDelEvento(ctx, eventos.find((e) => e.codigo === 'P3'), 'a').total, 0.3, 'las del P2 cuentan en P3');
  assert.equal(destinoDecimas(ctx, t1, 'a').codigo, 'P2');
});

test('el ajuste individual manda sobre las décimas; las décimas no aplican si hay penalización total ni a notas pendientes', async () => {
  const k = await curso();
  const { eventos } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  await otorgarDecimas(k.db, t1.id, ['a', 'b'], { valor: 0.5 }, AHORA);
  const p2 = eventos.find((e) => e.codigo === 'P2');
  assert.equal((await k.nota('P2', 'a')).estado, 'pendiente', 'sin pase cerrado la nota sigue pendiente');
  await guardarAjuste(k.db, p2.id, 'a', 0.5, 'a mano', AHORA);
  await k.practica('P2', { baja: 0 });
  const a = await k.nota('P2', 'a');
  assert.equal(a.valor, 0.5, 'el ajuste es la nota final');
  const b = await k.nota('P2', 'b');
  assert.ok(b.decimas.total === 0.5 && b.valor <= 1);
});
