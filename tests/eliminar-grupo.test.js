// Eliminar un grupo del evento: quien faltó queda sin grupo, los demás pasan a otro grupo, se borra lo registrado del
// grupo (y de sus TC y retroalimentación) y el cambio pasa a los eventos siguientes. Caso: se formaron 3 de 5 grupos.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { cerrarPase, eliminarGrupo, guardarPuntaje, alternarEtiqueta, guardarNotaProfesor, marcarAsistencia, revisarGrupo } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto, gruposDe } from '../src/nucleo/motor.js';
import { listaDeGrupos } from '../src/nucleo/grupos.js';
import { resumenEliminarGrupo, tieneRegistros } from '../src/nucleo/eliminar-grupo.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-10-19T14:30:00.000Z';

// 10 estudiantes en 5 grupos del Excel (2 por grupo): s1-s2 → 1, s3-s4 → 2, s5-s6 → 3, s7-s8 → 4, s9-s10 → 5.
async function curso() {
  const db = abrirBase(`elim-${randomUUID()}`);
  await db.estudiantes.bulkPut(Array.from({ length: 10 }, (_, i) => ({
    id: `s${i + 1}`, codigo: `s${i + 1}`, nombre: `APELLIDO NOMBRE${i + 1}`, curso: 'GR2QB', estado: 'nomina', grupo_excel: String(Math.floor(i / 2) + 1), numero: i + 1,
  })));
  const c = cfg.cursoPorId.GR2QB;
  const cargar = async () => {
    const reg = await registrosDelCurso(db, 'GR2QB');
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return { reg, eventos, ctx: crearContexto(cfg, c, eventos, reg) };
  };
  return { db, cargar };
}
const lista = (ctx, evento) => listaDeGrupos(gruposDe(ctx, evento), ctx.reg.estudiantes);

test('se formaron 3 de 5 grupos: se eliminan el 4 (nadie vino) y el 5 (vino uno, pasa al grupo 1) y quedan 1, 2 y 3', async () => {
  const k = await curso();
  let { ctx, eventos } = await k.cargar();
  const p1 = eventos.find((e) => e.codigo === 'P1');
  const t1 = eventos.find((e) => e.codigo === 'T1');
  const grupos = gruposDe(ctx, p1);
  for (const id of ['s7', 's8', 's9']) await marcarAsistencia(k.db, p1.id, grupos, id, 'no_vino', null, AHORA);
  // El grupo 5 ya estaba evaluado y revisado; el taller siguiente tiene una retroalimentación dada para él.
  await guardarPuntaje(k.db, p1.id, grupos, '5', 'planificacion', 1, AHORA);
  await alternarEtiqueta(k.db, p1.id, grupos, '5', 'una', AHORA);
  await guardarNotaProfesor(k.db, p1.id, 'grupo', '5', 'bien', AHORA);
  await revisarGrupo(k.db, p1.id, grupos, '5', { verificado: true }, AHORA);
  await k.db.retroalimentaciones.put({ evento: t1.id, grupo: '5', dada: true });
  await guardarPuntaje(k.db, p1.id, grupos, '1', 'planificacion', 2, AHORA);

  ({ ctx } = await k.cargar());
  const r4 = resumenEliminarGrupo(ctx, p1, '4');
  assert.deepEqual(r4.integrantes.map((i) => [i.estudiante.id, i.falta]), [['s7', true], ['s8', true]]);
  assert.equal(tieneRegistros(r4.borra), false, 'el grupo 4 no tiene nada registrado');
  const r5 = resumenEliminarGrupo(ctx, p1, '5');
  assert.deepEqual(r5.integrantes.map((i) => [i.estudiante.id, i.falta]), [['s10', false], ['s9', true]]);
  assert.deepEqual([r5.borra.puntajes, r5.borra.etiquetas, r5.borra.revision, r5.borra.notas, r5.borra.retro], [1, 1, true, 1, 1]);
  assert.ok(r5.talleres.includes(t1.id));

  await eliminarGrupo(k.db, p1.id, gruposDe(ctx, p1), '4', { destino: null, tcs: r4.tcs, talleres: r4.talleres }, AHORA);
  ({ ctx } = await k.cargar());
  await eliminarGrupo(k.db, p1.id, gruposDe(ctx, p1), '5', { destino: '1', tcs: r5.tcs, talleres: r5.talleres }, AHORA);

  ({ ctx } = await k.cargar());
  const { grupos: g, sinGrupo } = lista(ctx, p1);
  assert.deepEqual(g.map((x) => x.grupo), ['1', '2', '3']);
  assert.deepEqual(g[0].integrantes.map((e) => e.id).sort(), ['s1', 's10', 's2'], 'quien vino del grupo 5 pasó al 1');
  assert.deepEqual(sinGrupo.map((e) => e.id).sort(), ['s7', 's8', 's9'], 'quienes faltaron quedan sin grupo');
  assert.equal(await k.db.puntajes.where({ evento: p1.id, grupo: '5' }).count(), 0);
  assert.equal(await k.db.etiquetas.where('evento').equals(p1.id).filter((f) => f.grupo === '5').count(), 0);
  assert.equal(await k.db.revisiones_grupo.get([p1.id, '5']), undefined);
  assert.equal(await k.db.notas.get([p1.id, 'grupo', '5']), undefined);
  assert.equal(await k.db.retroalimentaciones.get([t1.id, '5']), undefined);
  assert.equal((await k.db.puntajes.get([p1.id, '1', 'planificacion'])).valor, 2, 'el grupo 1 conserva su evaluación');
  // La asistencia de quienes faltaron se conserva.
  assert.equal((await k.db.asistencia.get([p1.id, 's9'])).estado, 'no_vino');
  // Los eventos siguientes heredan los 3 grupos (y las 3 personas sin grupo).
  const { grupos: gT1, sinGrupo: sT1 } = lista(ctx, t1);
  assert.deepEqual(gT1.map((x) => x.grupo), ['1', '2', '3']);
  assert.equal(sT1.length, 3);
});

test('no se elimina un grupo con el pase cerrado ni hacia sí mismo', async () => {
  const k = await curso();
  let { ctx, eventos } = await k.cargar();
  const p1 = eventos.find((e) => e.codigo === 'P1');
  await assert.rejects(eliminarGrupo(k.db, p1.id, gruposDe(ctx, p1), '4', { destino: '4' }), /mismo grupo/);
  await cerrarPase(k.db, p1.id, gruposDe(ctx, p1), 'sin grupo al cerrar el pase', AHORA);
  ({ ctx } = await k.cargar());
  await assert.rejects(eliminarGrupo(k.db, p1.id, gruposDe(ctx, p1), '4', { destino: null }), /pase está cerrado/);
  assert.deepEqual(lista(ctx, p1).grupos.map((g) => g.grupo), ['1', '2', '3', '4', '5'], 'no cambió nada');
});
