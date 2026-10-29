// Décimas de premio: dan un bono a la nota del bimestre (0.625 por punto de premio, hasta 0.5 por bimestre) y no tocan la
// nota de la práctica; pueden ser de un grupo (una fila por integrante presente) o de un estudiante; solo múltiplos de 0.1.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cerrarPase, guardarAjuste, guardarPuntaje, marcarAsistencia, otorgarDecimas, quitarDecimas } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { BONO_POR_PREMIO, BONO_TOPE, bonoDecimas, crearContexto, gruposDe, notaBimestre, notaEvento } from '../src/nucleo/motor.js';
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

const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('el premio da un bono al bimestre (0.625 por punto de premio) y no cambia la nota de la práctica', async () => {
  const k = await curso();
  const { eventos } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  await otorgarDecimas(k.db, t1.id, ['a'], { valor: 0.3, motivo: 'pregunta de incertidumbre' }, AHORA);
  await k.practica('P2', { baja: 0 });
  const { ctx } = await k.cargar();
  assert.equal(BONO_POR_PREMIO, 0.625);
  const a = bonoDecimas(ctx, 'a', t1.bimestre);
  assert.equal(a.premio, 0.3);
  cerca(a.puntos, 0.1875);
  assert.equal(a.topado, false);
  assert.equal(bonoDecimas(ctx, 'b', t1.bimestre).puntos, 0, 'quien no ganó no recibe');
  assert.equal(bonoDecimas(ctx, 'a', t1.bimestre === 1 ? 2 : 1).puntos, 0, 'solo en el bimestre donde se ganó');
  // La práctica queda con la nota de la rúbrica.
  const na = await k.nota('P2', 'a');
  const nb = await k.nota('P2', 'b');
  assert.equal(na.valor, nb.valor);
  assert.equal(na.decimas, undefined);
  // Y el bono entra en la nota del bimestre.
  const bim = notaBimestre(ctx, 'a', t1.bimestre);
  const sin = notaBimestre(ctx, 'b', t1.bimestre);
  cerca(bim.acumulada - sin.acumulada, 0.1875);
  if (bim.proyectada !== null) cerca(bim.proyectada - sin.proyectada, 0.1875);
  assert.equal(bim.bono.puntos, a.puntos);
});

test('tope de 0.5 por bimestre: varios premios se suman y después se topa; el 0.8 mayor vale justo 0.5', async () => {
  const k = await curso();
  const t1 = (await k.cargar()).eventos.find((e) => e.codigo === 'T1');
  await otorgarDecimas(k.db, t1.id, ['a'], { valor: 0.8 }, AHORA);
  await otorgarDecimas(k.db, t1.id, ['b'], { valor: 0.5 }, AHORA);
  await otorgarDecimas(k.db, t1.id, ['b'], { valor: 0.5 }, AHORA);
  const { ctx } = await k.cargar();
  cerca(bonoDecimas(ctx, 'a', t1.bimestre).puntos, BONO_TOPE);
  assert.equal(bonoDecimas(ctx, 'a', t1.bimestre).topado, false, '0.8 × 0.625 es justo 0.5');
  const b = bonoDecimas(ctx, 'b', t1.bimestre);
  assert.equal(b.premio, 1);
  assert.equal(b.puntos, BONO_TOPE);
  assert.equal(b.topado, true);
});

test('la nota del bimestre con bono no pasa de su total', async () => {
  const k = await curso();
  const { eventos, reg } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  await otorgarDecimas(k.db, t1.id, ['a'], { valor: 0.8 }, AHORA);
  await k.practica('P2');
  const { ctx } = await k.cargar();
  const chico = copia(cfg);
  chico.esquemas.TRAD_B1 = { ...chico.esquemas.TRAD_B1, total: 0.2 };
  const c2 = crearContexto(chico, ctx.curso, eventos, (await k.cargar()).reg);
  assert.equal(notaBimestre(c2, 'a', t1.bimestre).acumulada, 0.2);
  assert.ok(notaBimestre(ctx, 'a', t1.bimestre).acumulada > 0.5);
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
  const t1 = (await k.cargar()).eventos.find((e) => e.codigo === 'T1');
  for (const mal of [0.15, 0, -0.1, 0.25, 11, NaN]) await assert.rejects(otorgarDecimas(k.db, t1.id, ['a'], { valor: mal }), /de 0\.1 en 0\.1/);
  await assert.rejects(otorgarDecimas(k.db, t1.id, [], { valor: 0.1 }), /a quién/);
  await otorgarDecimas(k.db, t1.id, ['a'], { valor: 0.1 }, AHORA);
  await otorgarDecimas(k.db, t1.id, ['a'], { valor: 0.2 }, AHORA);
  await otorgarDecimas(k.db, (await k.cargar()).eventos.find((e) => e.codigo === 'P2').id, ['a'], { valor: 0.3 }, AHORA);
  const { ctx } = await k.cargar();
  cerca(bonoDecimas(ctx, 'a', t1.bimestre).premio, 0.6);
  cerca(bonoDecimas(ctx, 'a', t1.bimestre).puntos, 0.375);
});

test('el ajuste individual de la práctica no toca el bono; faltar a la práctica tampoco lo quita (el premio es del evento donde se ganó)', async () => {
  const k = await curso();
  const { eventos } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  await otorgarDecimas(k.db, t1.id, ['a', 'b'], { valor: 0.5 }, AHORA);
  const p2 = eventos.find((e) => e.codigo === 'P2');
  await guardarAjuste(k.db, p2.id, 'a', 0.5, 'a mano', AHORA);
  await k.practica('P2', { baja: 0, faltan: ['b'] });
  assert.equal((await k.nota('P2', 'a')).valor, 0.5);
  assert.equal((await k.nota('P2', 'b')).valor, 0, 'faltó a P2');
  const { ctx } = await k.cargar();
  cerca(bonoDecimas(ctx, 'a', t1.bimestre).puntos, 0.3125);
  cerca(bonoDecimas(ctx, 'b', t1.bimestre).puntos, 0.3125);
});

test('premio de grupo: quien faltó a la clase donde se ganó no recibe el bono (aunque su falta se marque después); el individual sí cuenta', async () => {
  const k = await curso();
  const { eventos, ctx: c0 } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  await otorgarDecimas(k.db, t1.id, ['a', 'b', 'c'], { valor: 0.3, unidad: 'grupo', grupo: '1' }, AHORA);
  await marcarAsistencia(k.db, t1.id, gruposDe(c0, t1), 'c', 'no_vino', null, AHORA);
  await marcarAsistencia(k.db, t1.id, gruposDe(c0, t1), 'd', 'no_vino', null, AHORA);
  await otorgarDecimas(k.db, t1.id, ['d'], { valor: 0.2 }, AHORA);
  const { ctx } = await k.cargar();
  cerca(bonoDecimas(ctx, 'a', t1.bimestre).puntos, 0.1875);
  assert.equal(bonoDecimas(ctx, 'c', t1.bimestre).puntos, 0, 'c faltó al T1: el premio del grupo no le cuenta');
  cerca(bonoDecimas(ctx, 'd', t1.bimestre).puntos, 0.125);
  // Si se corrige y c sí vino, el bono vuelve (se calcula cada vez).
  await marcarAsistencia(k.db, t1.id, null, 'c', 'presente', null, AHORA);
  cerca(bonoDecimas((await k.cargar()).ctx, 'c', t1.bimestre).puntos, 0.1875);
});
