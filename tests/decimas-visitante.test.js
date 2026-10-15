// Décimas ganadas por un visitante («recupera aquí») con el grupo de otro de mis cursos: cuentan en su propio curso, en la
// primera práctica propia posterior a la sesión donde las ganó, sin copiarse.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { agregarVisitante, marcarAsistencia, otorgarDecimas, quitarDecimas } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto, decimasDelEvento, destinoDecimas, gruposDe } from '../src/nucleo/motor.js';
import { idVisitante, textoParaSuProfesor } from '../src/nucleo/visitantes.js';
import { configReal, copia } from './ayudas.js';

const cfg = copia(configReal());
for (const cod of ['P2', 'P3']) cfg.actividades[`${cod}-TRAD`] = { ...copia(cfg.actividades['P1-TRAD']), id: `${cod}-TRAD`, codigo: cod, etiquetas: [] };
const AHORA = '2026-10-15T14:30:00.000Z';

async function escenario() {
  const db = abrirBase(`decv-${randomUUID()}`);
  await db.estudiantes.bulkPut([
    { id: 'x1', codigo: 'x1', nombre: 'PEREZ ANA', curso: 'GR7SA', estado: 'nomina', grupo_excel: '1', numero: 1 },
    { id: 'h1', codigo: 'h1', nombre: 'ANFITRION UNO', curso: 'GR1QA', estado: 'nomina', grupo_excel: '1', numero: 1 },
    { id: 's1', codigo: 's1', nombre: 'SQI UNO', curso: 'GR1AA', estado: 'nomina', grupo_excel: '1', numero: 1 },
  ]);
  const eventos = (p) => generarEventos(cfg, cfg.cursoPorId[p]);
  const evento = (p, cod) => eventos(p).find((e) => e.codigo === cod);
  const cargar = async (p, conVinculos = true) => {
    const reg = await registrosDelCurso(db, p, conVinculos ? cfg : null);
    const c = cfg.cursoPorId[p];
    const ev = generarEventos(cfg, c, reg.cambios_evento);
    return { reg, ev, ctx: crearContexto(cfg, c, ev, reg) };
  };
  const grupos = async (p, cod) => { const { ctx } = await cargar(p, false); return gruposDe(ctx, evento(p, cod)); };
  return { db, evento, cargar, grupos };
}

async function conVisita(k, paralelo = 'GR1QA', host = 'P1') {
  const e = k.evento(paralelo, host);
  await agregarVisitante(k.db, e.id, await k.grupos(paralelo, host), '1', { codigo: 'x1', nombre: 'Perez Ana', paralelo: 'GR7SA' }, AHORA);
  return { e, v: idVisitante(e.id, 'x1') };
}

test('el premio de grupo incluye a la visita y llega a su curso, en su primera práctica posterior a la sesión', async () => {
  const k = await escenario();
  const { e, v } = await conVisita(k);
  await otorgarDecimas(k.db, e.id, ['h1', v], { valor: 0.3, motivo: 'pregunta', unidad: 'grupo', grupo: '1' }, AHORA);

  const { ctx, ev } = await k.cargar('GR7SA');
  const filas = ctx.decimas.get('x1');
  assert.equal(filas.length, 1);
  assert.equal(filas[0].valor, 0.3);
  assert.equal(filas[0].evento, e.id);
  assert.equal(filas[0].vinculada.visitante, v);
  const destino = destinoDecimas(ctx, filas[0].evento, 'x1', filas[0].evento_fecha);
  assert.ok(destino && destino.tipo === 'practica' && destino.fecha > e.fecha);
  assert.equal(decimasDelEvento(ctx, destino, 'x1').total, 0.3);
  // La práctica recuperada (P1 de GR7SA) no recibe las décimas.
  assert.equal(decimasDelEvento(ctx, ev.find((x) => x.codigo === 'P1'), 'x1').total, 0);
  // No se copió nada a la base de GR7SA ni a sus lecturas sin vínculos.
  assert.equal((await registrosDelCurso(k.db, 'GR7SA')).decimas.length, 0);
});

test('en la sesión anfitriona la visita no tiene destino; quitar el premio lo quita también de su curso', async () => {
  const k = await escenario();
  const { e, v } = await conVisita(k);
  const lote = await otorgarDecimas(k.db, e.id, ['h1', v], { valor: 0.2, unidad: 'grupo', grupo: '1' }, AHORA);
  const { ctx } = await k.cargar('GR1QA');
  assert.equal(destinoDecimas(ctx, e.id, v), null);
  assert.equal((await k.cargar('GR7SA')).ctx.decimas.get('x1')?.length, 1);
  await quitarDecimas(k.db, e.id, lote);
  assert.equal((await k.cargar('GR7SA')).ctx.decimas.get('x1'), undefined);
});

test('si la visita faltó a la sesión, el premio de grupo no cuenta; uno individual sí', async () => {
  const k = await escenario();
  const { e, v } = await conVisita(k);
  await otorgarDecimas(k.db, e.id, ['h1', v], { valor: 0.3, unidad: 'grupo', grupo: '1' }, AHORA);
  await otorgarDecimas(k.db, e.id, [v], { valor: 0.1, unidad: 'estudiante' }, AHORA);
  await marcarAsistencia(k.db, e.id, await k.grupos('GR1QA', 'P1'), v, 'no_vino', null, AHORA);
  const filas = (await k.cargar('GR7SA')).ctx.decimas.get('x1');
  assert.deepEqual(filas.map((f) => f.valor), [0.1]);
});

test('no se vinculan décimas entre metodologías ni de quien no es de mi curso', async () => {
  const k = await escenario();
  const sqi = k.evento('GR1AA', 'P1');
  await agregarVisitante(k.db, sqi.id, await k.grupos('GR1AA', 'P1'), '1', { codigo: 'x1', nombre: 'Perez Ana' }, AHORA);
  await agregarVisitante(k.db, sqi.id, await k.grupos('GR1AA', 'P1'), '1', { codigo: '999', nombre: 'De Otro Docente' }, AHORA);
  await otorgarDecimas(k.db, sqi.id, [idVisitante(sqi.id, 'x1'), idVisitante(sqi.id, '999')], { valor: 0.3, unidad: 'grupo', grupo: '1' }, AHORA);
  assert.equal((await k.cargar('GR7SA')).ctx.decimas.get('x1'), undefined);
});

test('el texto para el profesor de una visita ajena menciona las décimas ganadas', async () => {
  const k = await escenario();
  const e = k.evento('GR1QA', 'P1');
  await agregarVisitante(k.db, e.id, await k.grupos('GR1QA', 'P1'), '1', { codigo: '999', nombre: 'De Otro Docente' }, AHORA);
  const v = idVisitante(e.id, '999');
  await otorgarDecimas(k.db, e.id, ['h1', v], { valor: 0.3, motivo: 'incertidumbre', unidad: 'grupo', grupo: '1' }, AHORA);
  const { ctx } = await k.cargar('GR1QA');
  const { texto } = textoParaSuProfesor(ctx, e, ctx.estudiantePorId.get(v));
  assert.match(texto, /Décimas ganadas con su grupo: \+0\.3.*incertidumbre/);
});

test('al refuerzo (sesión sin nota) puede asistir una visita: gana décimas con su grupo y llegan a su curso; su texto no habla de nota', async () => {
  const k = await escenario();
  const { e, v } = await conVisita(k, 'GR1QA', 'REFUERZO');
  assert.equal(e.con_nota, false);
  await otorgarDecimas(k.db, e.id, ['h1', v], { valor: 0.2, motivo: 'pregunta', unidad: 'grupo', grupo: '1' }, AHORA);
  const { ctx, ev } = await k.cargar('GR7SA');
  const f = ctx.decimas.get('x1');
  assert.equal(f.length, 1);
  const destino = destinoDecimas(ctx, f[0].evento, 'x1', f[0].evento_fecha);
  assert.equal(destino.tipo, 'practica');
  assert.equal(decimasDelEvento(ctx, destino, 'x1').total, 0.2);
  assert.equal((await registrosDelCurso(k.db, 'GR7SA', cfg)).recuperaciones.length, 0, 'sin nota no hay recuperación vinculada');
  const anfitrion = (await k.cargar('GR1QA')).ctx;
  const { texto, final } = textoParaSuProfesor(anfitrion, e, anfitrion.estudiantePorId.get(v));
  assert.equal(final, true);
  assert.doesNotMatch(texto, /Nota de la actividad/);
  assert.match(texto, /Sesión sin nota: REFUERZO/);
  assert.match(texto, /Décimas ganadas con su grupo: \+0\.2/);
});
