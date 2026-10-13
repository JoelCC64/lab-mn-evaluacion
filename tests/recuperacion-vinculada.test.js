// Un estudiante de uno de mis cursos que recupera como visitante en otro de mis cursos (de la misma metodología) trae su
// nota a su propio curso, sin copiarla: se calcula cada vez, así que sigue lo último de la otra sesión.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { abrirBase } from '../src/db.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { agregarVisitante, guardarAjuste, guardarRecuperacion, marcarAsistencia } from '../src/datos/acciones.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto, gruposDe, notaEvento } from '../src/nucleo/motor.js';
import { idVisitante } from '../src/nucleo/visitantes.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const AHORA = '2026-10-15T14:30:00.000Z';

// GR7SA (miércoles, Clásica) tiene a «x1»; en GR1QA (jueves, Clásica) y en GR1AA (jueves, SQI) hay visitas con ese código.
async function escenario() {
  const db = abrirBase(`vinc-${randomUUID()}`);
  await db.estudiantes.bulkPut([
    { id: 'x1', codigo: 'x1', nombre: 'PEREZ ANA', curso: 'GR7SA', estado: 'nomina', grupo_excel: '1', numero: 1 },
    { id: 'x2', codigo: 'x2', nombre: 'LOPEZ LUIS', curso: 'GR7SA', estado: 'nomina', grupo_excel: '1', numero: 2 },
    { id: 'h1', codigo: 'h1', nombre: 'ANFITRION UNO', curso: 'GR1QA', estado: 'nomina', grupo_excel: '1', numero: 1 },
    { id: 's1', codigo: 's1', nombre: 'SQI UNO', curso: 'GR1AA', estado: 'nomina', grupo_excel: '1', numero: 1 },
  ]);
  const ev = (paralelo) => generarEventos(cfg, cfg.cursoPorId[paralelo]);
  const evento = (paralelo, codigo) => ev(paralelo).find((e) => e.codigo === codigo);
  const gruposDeEvento = async (paralelo, codigo) => {
    const reg = await registrosDelCurso(db, paralelo);
    const e = evento(paralelo, codigo);
    return gruposDe(crearContexto(cfg, cfg.cursoPorId[paralelo], ev(paralelo), reg), e);
  };
  const nota = async (paralelo, codigo, id) => {
    const reg = await registrosDelCurso(db, paralelo, cfg);
    const c = cfg.cursoPorId[paralelo];
    const eventos = generarEventos(cfg, c, reg.cambios_evento);
    return notaEvento(crearContexto(cfg, c, eventos, reg), eventos.find((e) => e.codigo === codigo), id);
  };
  const vinculadas = async (paralelo) => (await registrosDelCurso(db, paralelo, cfg)).recuperaciones.filter((r) => r.vinculada);
  return { db, evento, gruposDeEvento, nota, vinculadas };
}

test('la visita en GR1QA aparece en GR7SA: pendiente al principio y con su nota cuando está calculada', async () => {
  const k = await escenario();
  const host = k.evento('GR1QA', 'P1');
  await agregarVisitante(k.db, host.id, await k.gruposDeEvento('GR1QA', 'P1'), '1', { codigo: 'x1', nombre: 'Perez Ana', paralelo: 'GR7SA' }, AHORA);
  const visitante = idVisitante(host.id, 'x1');

  let v = await k.vinculadas('GR7SA');
  assert.equal(v.length, 1);
  assert.deepEqual([v[0].evento, v[0].estudiante, v[0].estado, v[0].nota], ['GR7SA:P1', 'x1', 'solicitada', null]);
  assert.match(v[0].detalle, /GR1QA.*nota pendiente/);
  assert.equal((await k.nota('GR7SA', 'P1', 'x1')).estado, 'pendiente');

  await guardarAjuste(k.db, host.id, visitante, 0.9, 'prueba', AHORA);
  v = await k.vinculadas('GR7SA');
  assert.deepEqual([v[0].estado, v[0].nota], ['realizada', 0.9]);
  const n = await k.nota('GR7SA', 'P1', 'x1');
  assert.deepEqual([n.estado, n.valor], ['calculada', 0.9]);
  assert.match(n.motivo, /recuperada en otra sesión \(GR1QA/);
  assert.equal((await k.nota('GR7SA', 'P1', 'x2')).estado, 'pendiente', 'los demás no cambian');

  // Se actualiza sola si la nota de la visita cambia.
  await guardarAjuste(k.db, host.id, visitante, 0.6, 'corrección', AHORA);
  assert.equal((await k.nota('GR7SA', 'P1', 'x1')).valor, 0.6);

  // Si en esa sesión no vino, cuenta 0 («no asistió a la recuperación»).
  await marcarAsistencia(k.db, host.id, null, visitante, 'no_vino', null, AHORA);
  const faltó = await k.nota('GR7SA', 'P1', 'x1');
  assert.deepEqual([faltó.estado, faltó.valor], ['calculada', 0]);
  assert.match(faltó.motivo, /no asistió a la recuperación/);
});

test('una recuperación escrita a mano manda sobre la vinculada', async () => {
  const k = await escenario();
  const host = k.evento('GR1QA', 'P1');
  await agregarVisitante(k.db, host.id, await k.gruposDeEvento('GR1QA', 'P1'), '1', { codigo: 'x1', nombre: 'Perez Ana' }, AHORA);
  await guardarAjuste(k.db, host.id, idVisitante(host.id, 'x1'), 0.9, 'prueba', AHORA);
  await guardarRecuperacion(k.db, 'GR7SA:P1', 'x1', { estado: 'realizada', nota: 0.5, detalle: 'a mano' }, AHORA);
  assert.equal((await k.nota('GR7SA', 'P1', 'x1')).valor, 0.5);
  assert.equal((await k.vinculadas('GR7SA')).length, 0);
});

test('no se vincula entre metodologías distintas, ni a quien no es de mi curso, ni sin la actividad en el curso', async () => {
  const k = await escenario();
  // GR1AA es SQI y GR7SA es Clásica: un cruce que la universidad no admite; no se vincula.
  const sqi = k.evento('GR1AA', 'P1');
  await agregarVisitante(k.db, sqi.id, await k.gruposDeEvento('GR1AA', 'P1'), '1', { codigo: 'x1', nombre: 'Perez Ana', paralelo: 'GR7SA' }, AHORA);
  // Un visitante que no es de mis cursos.
  const host = k.evento('GR1QA', 'P1');
  await agregarVisitante(k.db, host.id, await k.gruposDeEvento('GR1QA', 'P1'), '1', { codigo: '999', nombre: 'De Otro Docente' }, AHORA);
  assert.equal((await k.vinculadas('GR7SA')).length, 0);
  // Una sesión sin nota (la introducción) no vincula nada.
  const intro = k.evento('GR1QA', 'INTRO');
  await agregarVisitante(k.db, intro.id, await k.gruposDeEvento('GR1QA', 'INTRO'), '1', { codigo: 'x1', nombre: 'Perez Ana' }, AHORA);
  assert.equal((await k.vinculadas('GR7SA')).length, 0);
});

test('el curso anfitrión no recibe vínculos de vuelta (sin recursión) y sin cfg no hay vínculos', async () => {
  const k = await escenario();
  const host = k.evento('GR1QA', 'P1');
  await agregarVisitante(k.db, host.id, await k.gruposDeEvento('GR1QA', 'P1'), '1', { codigo: 'x1', nombre: 'Perez Ana' }, AHORA);
  assert.equal((await k.vinculadas('GR1QA')).length, 0);
  assert.equal((await registrosDelCurso(k.db, 'GR7SA')).recuperaciones.length, 0, 'sin cfg, la lectura es la de siempre');
});
