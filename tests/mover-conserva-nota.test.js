// Mover a alguien de grupo: lo ya evaluado en eventos anteriores no cambia.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cerrarPase, guardarPuntaje, moverEstudiante } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto, gruposDe, notaEvento, rubrica } from '../src/nucleo/motor.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-10-19T14:30:00.000Z';

// GR2QB (Clásica A): P1 (sem. 2) y T1 (sem. 4). a, b y c en el grupo 1.
async function escenario() {
  const db = abrirBase(`mv-${randomUUID()}`);
  await db.estudiantes.bulkPut(['a', 'b', 'c'].map((id, i) => ({ id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} NOMBRE`, curso: 'GR2QB', estado: 'nomina', grupo_excel: '1', numero: i + 1 })));
  const c = cfg.cursoPorId.GR2QB;
  const cargar = async () => {
    const reg = await registrosDelCurso(db, 'GR2QB');
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return { eventos, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  const evaluar = async (codigo, grupo, nivel) => {
    const { ctx, eventos } = await cargar();
    const ev = eventos.find((e) => e.codigo === codigo);
    const grupos = gruposDe(ctx, ev);
    for (const p of rubrica(cfg, cfg.actividades[ev.config])) await guardarPuntaje(db, ev.id, grupos, grupo, p.id, nivel ?? Math.max(...p.escala), AHORA);
    return ev;
  };
  const nota = async (codigo, id) => { const { ctx, eventos } = await cargar(); return notaEvento(ctx, eventos.find((e) => e.codigo === codigo), id); };
  return { db, cargar, evaluar, nota };
}

test('mover a alguien en un evento posterior no cambia su nota de la práctica 1', async () => {
  const k = await escenario();
  const p1 = await k.evaluar('P1', '1');
  const { ctx } = await k.cargar();
  await cerrarPase(k.db, p1.id, gruposDe(ctx, p1), 'sin grupo', AHORA);
  const antes = await k.nota('P1', 'a');
  assert.equal(antes.estado, 'calculada');

  // En T1 llegan estudiantes nuevos y «a» pasa a un grupo nuevo.
  const { ctx: c2, eventos } = await k.cargar();
  const t1 = eventos.find((e) => e.codigo === 'T1');
  await moverEstudiante(k.db, t1.id, gruposDe(c2, t1), 'a', '6', AHORA);

  const despues = await k.nota('P1', 'a');
  assert.equal(despues.estado, 'calculada');
  assert.equal(despues.valor, antes.valor);
  assert.equal(despues.grupo, '1');
  const { ctx: c3 } = await k.cargar();
  assert.equal(gruposDe(c3, t1).get('a'), '6');
  assert.equal(gruposDe(c3, eventos.find((e) => e.codigo === 'P1')).get('a'), '1');
});
