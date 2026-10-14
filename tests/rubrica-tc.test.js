// Criterios de la rúbrica de los trabajos en casa SQI (reglamento para profesores, Tablas 7 a 12): cada pregunta dice qué
// se evalúa y qué vale cada nivel. Los puntajes no cambian: solo se muestran los criterios al calificar.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { notaTrabajo } from '../src/nucleo/motor.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const TC = ['TC1', 'TC2', 'TC3', 'TC4', 'TC5', 'TC7'];   // TC6 no tiene rúbrica: no es evaluable en sí mismo

test('cada pregunta de TC1–TC5 y TC7 trae su aspecto y los criterios de cada nivel; el parcial existe solo si hay puntaje parcial', () => {
  for (const cod of TC) {
    const c = cfg.actividades[`${cod}-SQI`];
    assert.equal(c.preguntas.reduce((s, p) => s + Math.max(...p.puntajes), 0), 10, `${cod} suma 10`);
    for (const p of c.preguntas) {
      assert.ok(p.aspecto?.length > 10, `${cod} ${p.id} tiene aspecto`);
      assert.ok(p.criterios.completo && p.criterios.sin, `${cod} ${p.id} tiene criterio completo y sin puntaje`);
      assert.equal(p.criterios.parcial !== null, p.puntajes.length === 3, `${cod} ${p.id}: parcial solo con puntaje parcial`);
    }
  }
  assert.equal(cfg.actividades['TC6-SQI'].preguntas, undefined);
});

test('puntajes del TC1 de la Tabla 7 del reglamento', () => {
  const p = Object.fromEntries(cfg.actividades['TC1-SQI'].preguntas.map((q) => [q.id, q.puntajes]));
  assert.deepEqual(p, { '1a': [1, 0], '1b': [2, 0], '2a-i': [1, 0.5, 0], '2a-ii': [1, 0.5, 0], '2b-i': [1, 0.5, 0], '2b-ii': [1, 0.5, 0], '2c': [1, 0], '2d': [2, 1, 0] });
  assert.equal(cfg.actividades['TC1-SQI'].ponderacion, 0.4);
  const d = cfg.actividades['TC1-SQI'].preguntas.find((q) => q.id === '2d').criterios;
  assert.equal(d.parcial, 'Conclusión correcta con justificación incompleta.');
});

test('la nota del TC lleva los criterios a la pantalla (partes) sin cambiar la nota', () => {
  const ev = { id: 'GR1AA:TC1', config: 'TC1-SQI', tipo: 'trabajo_casa' };
  const ctx = { cfg, trabajosCasa: new Map(), cacheGrupos: new Map() };
  const n = notaTrabajo(ctx, ev, '1');
  assert.equal(n.partes.length, 8);
  assert.ok(n.partes.every((p) => p.aspecto && p.criterios));
  assert.equal(n.valor, null, 'sin calificar no hay nota');
});
