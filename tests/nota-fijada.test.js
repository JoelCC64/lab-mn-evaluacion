// Nota con decimales de un grupo (nota fijada) y notas escritas en las observaciones: la fijada manda sobre la rúbrica
// (práctica sobre 10, taller sobre el máximo de la escala), se conserva la rúbrica, las décimas de premio se suman encima
// y la penalización total sigue mandando. La herramienta de Datos pasa los números de las observaciones a nota fijada.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import {
  cerrarPase, fijarNotaGrupo, guardarNotaProfesor, guardarPuntaje, otorgarDecimas, revisarGrupo,
} from '../src/datos/acciones.js';
import { aplicarPropuestasDeObservaciones, leerPropuestasDeObservaciones } from '../src/datos/notas-observaciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto, gruposDe, notaEvento, notaGrupo, rubrica } from '../src/nucleo/motor.js';
import { textoNotaGrupo } from '../src/nucleo/motor-vista.js';
import { notaEnObservacion } from '../src/nucleo/notas-observaciones.js';
import { configReal, copia } from './ayudas.js';

function configCompleta() {
  const c = copia(configReal());
  for (const cod of ['P2', 'P3']) c.actividades[`${cod}-TRAD`] = { ...copia(c.actividades['P1-TRAD']), id: `${cod}-TRAD`, codigo: cod, etiquetas: [] };
  return c;
}
const cfg = configCompleta();
const AHORA = '2026-10-19T14:30:00.000Z';

// GR2QB (Clásica A): P1 (sem. 2), T1 (4), P2 (5)… Estudiantes a, b (grupo 1) y c (grupo 2).
async function curso() {
  const db = abrirBase(`fija-${randomUUID()}`);
  await db.estudiantes.bulkPut(['a', 'b', 'c'].map((id, i) => ({
    id, codigo: id, nombre: `APELLIDO${id.toUpperCase()} NOMBRE`, curso: 'GR2QB', estado: 'nomina', grupo_excel: id === 'c' ? '2' : '1', numero: i + 1,
  })));
  const c = cfg.cursoPorId.GR2QB;
  const cargar = async () => {
    const reg = await registrosDelCurso(db, 'GR2QB', cfg);
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return { reg, eventos, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  const evento = async (codigo) => (await cargar()).eventos.find((e) => e.codigo === codigo);
  // Evalúa los dos grupos con el nivel dado en cada criterio y cierra el pase.
  const sesion = async (codigo, nivel) => {
    const ev = await evento(codigo);
    const { ctx } = await cargar();
    const grupos = gruposDe(ctx, ev);
    for (const g of ['1', '2']) for (const p of rubrica(cfg, cfg.actividades[ev.config])) await guardarPuntaje(db, ev.id, grupos, g, p.id, nivel, AHORA);
    await cerrarPase(db, ev.id, gruposDe((await cargar()).ctx, ev), 'sin grupo', AHORA);
    return { ev, grupos };
  };
  const nota = async (codigo, id) => { const { ctx, eventos } = await cargar(); return notaEvento(ctx, eventos.find((e) => e.codigo === codigo), id); };
  return { db, cargar, evento, sesion, nota };
}

test('práctica: la nota fijada (sobre 10) manda sobre la rúbrica, que se conserva; quitarla vuelve a la rúbrica', async () => {
  const k = await curso();
  const { ev, grupos } = await k.sesion('P1', 3);                 // 3 de 4 en los tres criterios → 7.5
  assert.equal((await k.nota('P1', 'a')).valor, 0.75);
  await fijarNotaGrupo(k.db, ev.id, grupos, '1', 8.25, 10, AHORA);
  assert.equal((await k.nota('P1', 'a')).valor, 0.825);
  assert.equal((await k.nota('P1', 'b')).valor, 0.825, 'todo el grupo');
  assert.equal((await k.nota('P1', 'c')).valor, 0.75, 'el otro grupo no cambia');
  const { ctx } = await k.cargar();
  const g = notaGrupo(ctx, ev, '1');
  assert.deepEqual([g.fijada, g.nota_fijada, g.tope, g.valor_rubrica], [true, 8.25, 10, 0.75]);
  assert.equal(g.partes.length, 3, 'la rúbrica se conserva');
  assert.equal(textoNotaGrupo(g), '8.25/10');
  await fijarNotaGrupo(k.db, ev.id, grupos, '1', null, 10, AHORA);
  assert.equal((await k.nota('P1', 'a')).valor, 0.75);
  assert.equal((await k.db.revisiones_grupo.get([ev.id, '1'])).nota_fijada, undefined);
});

test('taller: la nota se fija sobre el máximo de la escala (1.8 de 2); el estudiante recibe 0.5 + 0.5 × 0.9', async () => {
  const k = await curso();
  const { ev, grupos } = await k.sesion('T1', 2);
  assert.equal((await k.nota('T1', 'a')).valor, 1);
  await fijarNotaGrupo(k.db, ev.id, grupos, '1', 1.8, 2, AHORA);
  const n = await k.nota('T1', 'a');
  assert.ok(Math.abs(n.valor - 0.95) < 1e-9);
  assert.equal(textoNotaGrupo(n.partes.grupo), '1.8/2');
});

test('límites: no se acepta fuera de 0–tope; con decimales se redondea a centésimas', async () => {
  const k = await curso();
  const { ev, grupos } = await k.sesion('P1', 4);
  await assert.rejects(() => fijarNotaGrupo(k.db, ev.id, grupos, '1', 10.5, 10, AHORA));
  await assert.rejects(() => fijarNotaGrupo(k.db, ev.id, grupos, '1', -1, 10, AHORA));
  await fijarNotaGrupo(k.db, ev.id, grupos, '1', 9.256, 10, AHORA);
  assert.equal((await k.db.revisiones_grupo.get([ev.id, '1'])).nota_fijada, 9.26);
});

test('las décimas de premio se suman sobre la nota fijada; la penalización total manda sobre ambas', async () => {
  const k = await curso();
  const t1 = await k.evento('T1');
  await otorgarDecimas(k.db, t1.id, ['a'], { valor: 0.5 }, AHORA);
  const { ev, grupos } = await k.sesion('P2', 3);
  await fijarNotaGrupo(k.db, ev.id, grupos, '1', 9, 10, AHORA);
  const a = await k.nota('P2', 'a');
  assert.ok(Math.abs(a.valor - 0.95) < 1e-9, '9 + 0.5');
  assert.ok(Math.abs((await k.nota('P2', 'b')).valor - 0.9) < 1e-9);
  await revisarGrupo(k.db, ev.id, grupos, '1', { penalizacion_total: true, motivo_penalizacion: 'x' }, AHORA);
  assert.equal((await k.nota('P2', 'b')).valor, 0);
});

test('una nota fijada deja evaluado al grupo aunque falte la rúbrica', async () => {
  const k = await curso();
  const ev = await k.evento('P1');
  const { ctx } = await k.cargar();
  const grupos = gruposDe(ctx, ev);
  assert.equal(notaGrupo(ctx, ev, '1').completo, false);
  await fijarNotaGrupo(k.db, ev.id, grupos, '1', 7, 10, AHORA);
  const g = notaGrupo((await k.cargar()).ctx, ev, '1');
  assert.deepEqual([g.completo, g.valor, g.valor_rubrica], [true, 0.7, null]);
});

test('notaEnObservacion: solo el número entero o solo en la última línea; las frases con cifras no cuentan', () => {
  assert.deepEqual(notaEnObservacion('9.5'), { valor: 9.5, resto: '' });
  assert.deepEqual(notaEnObservacion(' 8,25 '), { valor: 8.25, resto: '' });
  assert.deepEqual(notaEnObservacion('8.0'), { valor: 8, resto: '' });
  assert.deepEqual(notaEnObservacion('-Sin desviación estándar\n-Cálculos de dt\n-8.50'), { valor: 8.5, resto: '-Sin desviación estándar\n-Cálculos de dt' });
  for (const t of ['Alturas mal tomadas, falla por 2 cm', 'Grupo 3', 'Midieron 3 tiempos para 4 alturas', '-8.5', 'Bien\nmal 8 cm', '', null]) assert.equal(notaEnObservacion(t), null, String(t));
});

test('herramienta de Datos: pasa los números de las observaciones a nota fijada y limpia la observación', async () => {
  const k = await curso();
  const p1 = await k.sesion('P1', 3);                // 7.5
  const t1 = await k.sesion('T1', 2);                // 2/2
  const nota = (ev, g, txt) => guardarNotaProfesor(k.db, ev.id, 'grupo', g, txt, AHORA);
  await nota(p1.ev, '1', '9.5');
  await nota(p1.ev, '2', 'Alturas mal tomadas, falla por 2 cm');
  await nota(t1.ev, '1', '1.8');
  await nota(t1.ev, '2', '0.9');                      // baja mucho: queda «revisar»
  await guardarNotaProfesor(k.db, p1.ev.id, 'grupo', '3', '12', AHORA);   // fuera del tope
  const props = await leerPropuestasDeObservaciones(k.db, cfg);
  const clave = (p) => `${p.evento.codigo}-${p.grupo}`;
  assert.deepEqual(props.map(clave).sort(), ['P1-1', 'P1-3', 'T1-1', 'T1-2']);
  const por = Object.fromEntries(props.map((p) => [clave(p), p]));
  assert.deepEqual([por['P1-1'].actual, por['P1-1'].valor, por['P1-1'].tope, por['P1-1'].revisar], [7.5, 9.5, 10, false]);
  assert.deepEqual([por['T1-1'].actual, por['T1-1'].valor, por['T1-1'].tope], [2, 1.8, 2]);
  assert.equal(por['T1-2'].revisar, true, '2 → 0.9 es más del 30 % del tope');
  assert.equal(por['P1-3'].invalida, true);

  const n = await aplicarPropuestasDeObservaciones(k.db, props.filter((p) => !p.invalida && !p.revisar), AHORA);
  assert.equal(n, 2);
  assert.equal((await k.nota('P1', 'a')).valor, 0.95);
  assert.ok(Math.abs((await k.nota('T1', 'a')).valor - 0.95) < 1e-9);
  assert.equal(await k.db.notas.get([p1.ev.id, 'grupo', '1']), undefined, 'el número se quitó de la observación');
  assert.ok(await k.db.notas.get([p1.ev.id, 'grupo', '2']), 'las frases no se tocan');
  // Ya aplicadas: no se vuelven a proponer.
  assert.deepEqual((await leerPropuestasDeObservaciones(k.db, cfg)).map(clave).sort(), ['P1-3', 'T1-2']);
});
