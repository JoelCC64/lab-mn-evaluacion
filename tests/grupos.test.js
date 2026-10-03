import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento, grupoNuevo, listaDeGrupos } from '../src/nucleo/grupos.js';
import { configReal } from './ayudas.js';

const cfg = configReal();

function registros(extra = {}) {
  return {
    estudiantes: [
      { id: 'a', nombre: 'A', estado: 'nomina', grupo_excel: '1' },
      { id: 'b', nombre: 'B', estado: 'nomina', grupo_excel: '1' },
      { id: 'c', nombre: 'C', estado: 'nomina', grupo_excel: '2' },
      { id: 'd', nombre: 'D', estado: 'pendiente', grupo_excel: null },
      { id: 'x', nombre: 'X', estado: 'baja', grupo_excel: '2' },
    ],
    grupos_evento: [],
    ...extra,
  };
}

test('primer evento: los grupos vienen del Excel; los de baja no aparecen', () => {
  const eventos = generarEventos(cfg, cfg.cursoPorId.GR2QB);
  const p1 = eventos.find((e) => e.codigo === 'P1');
  const { porEstudiante, fuente } = gruposDelEvento(p1, eventos, registros());
  assert.equal(fuente.tipo, 'excel');
  assert.deepEqual(Object.fromEntries(porEstudiante), { a: '1', b: '1', c: '2', d: null });
  const lista = listaDeGrupos(porEstudiante, registros().estudiantes);
  assert.deepEqual(lista.grupos.map((g) => [g.grupo, g.integrantes.map((e) => e.id)]), [['1', ['a', 'b']], ['2', ['c']]]);
  assert.deepEqual(lista.sinGrupo.map((e) => e.id), ['d']);
});

test('un cambio de grupo pasa a los eventos siguientes, pero no a los anteriores', () => {
  const eventos = generarEventos(cfg, cfg.cursoPorId.GR2QB);
  const [p1, t1, p2] = ['P1', 'T1', 'P2'].map((c) => eventos.find((e) => e.codigo === c));
  // En T1 se movió a «b» al grupo 2 y se agregó a «d» al grupo 1.
  const reg = registros({
    grupos_evento: [
      { evento: t1.id, estudiante: 'a', grupo: '1' },
      { evento: t1.id, estudiante: 'b', grupo: '2' },
      { evento: t1.id, estudiante: 'c', grupo: '2' },
      { evento: t1.id, estudiante: 'd', grupo: '1' },
    ],
  });
  assert.equal(gruposDelEvento(p1, eventos, reg).fuente.tipo, 'excel');
  assert.equal(gruposDelEvento(p1, eventos, reg).porEstudiante.get('b'), '1', 'P1 (anterior) no cambia');
  const deP2 = gruposDelEvento(p2, eventos, reg);
  assert.deepEqual(deP2.fuente, { tipo: 'anterior', evento: t1.id });
  assert.equal(deP2.porEstudiante.get('b'), '2');
  assert.equal(deP2.porEstudiante.get('d'), '1');
});

test('el TC usa los grupos de su práctica', () => {
  const eventos = generarEventos(cfg, cfg.cursoPorId.GR1AA);
  const p1 = eventos.find((e) => e.codigo === 'P1');
  const tc1 = eventos.find((e) => e.codigo === 'TC1');
  const reg = registros({ grupos_evento: [{ evento: p1.id, estudiante: 'a', grupo: '7' }] });
  const { porEstudiante, fuente } = gruposDelEvento(tc1, eventos, reg);
  assert.deepEqual(fuente, { tipo: 'propia', evento: p1.id });
  assert.equal(porEstudiante.get('a'), '7');
  assert.equal(porEstudiante.get('b'), '1', 'quien no está en la instantánea toma el grupo del Excel');
});

test('grupo nuevo: el siguiente número libre', () => {
  assert.equal(grupoNuevo(new Map([['a', '1'], ['b', '6'], ['c', null]])), '7');
  assert.equal(grupoNuevo(new Map([['a', null]])), '1');
});
