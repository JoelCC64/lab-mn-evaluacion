import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DIR_CONFIG, archivosDelManifiesto, construirManifiesto, crearValidador, esquemaParaArchivo,
  leerConfigDisco, validarSemantica,
} from '../scripts/lib/config-disco.mjs';
import { cargarConfig, configActividad, bimestreDeActividad } from '../src/nucleo/config.js';
import { configReal, copia } from './ayudas.js';

const leerJSON = (ruta) => JSON.parse(readFileSync(path.join(DIR_CONFIG, ruta), 'utf8'));

test('el manifiesto está al día (si falla: npm run config)', () => {
  const enDisco = leerJSON('manifest.json');
  assert.deepEqual(enDisco, construirManifiesto());
});

test('cada archivo de configuración cumple su esquema JSON', () => {
  const m = construirManifiesto();
  const validar = crearValidador();
  for (const ruta of archivosDelManifiesto(m)) {
    assert.deepEqual(validar(esquemaParaArchivo(ruta, m), leerJSON(ruta)), [], ruta);
  }
});

test('las reglas cruzadas se cumplen (pesos, sumas, referencias)', () => {
  assert.deepEqual(validarSemantica(configReal()), []);
});

test('la app carga la configuración igual que el validador', async () => {
  const cfg = await cargarConfig(async (r) => leerJSON(r));
  assert.deepEqual(cfg, leerConfigDisco().cfg);
  assert.equal(cfg.cursos.length, 10);
  assert.equal(cfg.cursos.filter((c) => c.metodologia === 'SQI').length, 2);
  assert.equal(cfg.cursos.filter((c) => c.cronograma === 'B').length, 2);
});

test('configuraciones reales de las primeras actividades (Anexos B, C, D y G)', () => {
  const cfg = configReal();
  assert.equal(configActividad(cfg, 'P1', 'TRAD').id, 'P1-TRAD');
  assert.equal(configActividad(cfg, 'P1', 'SQI').id, 'P1-SQI');
  assert.equal(configActividad(cfg, 'T1', 'TRAD').id, 'T1');
  assert.equal(configActividad(cfg, 'T1', 'SQI').id, 'T1');
  for (const n of [1, 2, 3, 4, 5, 6, 7]) assert.ok(configActividad(cfg, `TC${n}`, 'SQI'), `TC${n}`);
  // P1 Clásica: tres secciones 20/30/50 con escala 0–4; el análisis es una sola sección.
  const p1 = configActividad(cfg, 'P1', 'TRAD');
  assert.deepEqual(p1.criterios.map((c) => [c.id, c.peso]), [['diseno', 0.2], ['datos', 0.3], ['analisis', 0.5]]);
  // P1 SQI: máximo 5 (2 + 2 + 1).
  const p1s = configActividad(cfg, 'P1', 'SQI');
  const max = p1s.aspectos_aplicables.reduce((s, a) => s + Math.max(...cfg.sqi.aspectos[a].escala), 0);
  assert.equal(max, 5);
});

test('el bimestre se asigna por actividad, no por fecha', () => {
  const cfg = configReal();
  assert.equal(bimestreDeActividad(cfg, 'P3', 'TRAD'), 1);
  assert.equal(bimestreDeActividad(cfg, 'P4', 'TRAD'), 2);
  assert.equal(bimestreDeActividad(cfg, 'T4', 'SQI'), 2);
  assert.equal(bimestreDeActividad(cfg, 'TC3', 'SQI'), 1);
  assert.equal(bimestreDeActividad(cfg, 'TC6', 'SQI'), 2);
  assert.equal(bimestreDeActividad(cfg, 'PLIC', 'TRAD'), 2);
});

// --- Casos que deben fallar: el validador detecta errores reales de configuración ---

test('detecta un TC cuyos puntajes no suman 10', () => {
  const cfg = copia(configReal());
  cfg.actividades['TC2-SQI'].preguntas[0].puntajes = [3, 1.5, 0];
  assert.ok(validarSemantica(cfg).some((e) => e.includes('TC2-SQI') && e.includes('suman 9')));
});

test('detecta una práctica SQI con aspectos que no son los oficiales', () => {
  const cfg = copia(configReal());
  cfg.actividades['P1-SQI'].aspectos_aplicables = ['resp_pred_plan', 'ejec_registro', 'analisis'];
  assert.ok(validarSemantica(cfg).some((e) => e.includes('P1-SQI') && e.includes('aspectos aplicables')));
});

test('detecta pesos de Clásica que no suman 1 y escalas distintas de 0–4', () => {
  const cfg = copia(configReal());
  cfg.actividades['P1-TRAD'].criterios[0].peso = 0.25;
  cfg.actividades['P1-TRAD'].criterios[1].escala = [0, 1, 2];
  const errores = validarSemantica(cfg);
  assert.ok(errores.some((e) => e.includes('suman 1.05')));
  assert.ok(errores.some((e) => e.includes('escala 0–4')));
});

test('detecta una etiqueta que apunta a un criterio inexistente', () => {
  const cfg = copia(configReal());
  cfg.actividades['P1-TRAD'].etiquetas[0].criterio = 'analisis_tratamiento';
  assert.ok(validarSemantica(cfg).some((e) => e.includes('criterio inexistente')));
});

test('detecta un cronograma con una semana faltante o una actividad sin esquema', () => {
  const cfg = copia(configReal());
  cfg.cronogramas['A-TRAD'].semanas.splice(4, 1);
  cfg.cronogramas['B-TRAD'].semanas[1].actividades = ['T9'];
  cfg.catalogo.T9 = { tipo: 'taller', titulo: 'Taller inventado' };
  const errores = validarSemantica(cfg);
  assert.ok(errores.some((e) => e.includes('A-TRAD') && e.includes('semanas')));
  assert.ok(errores.some((e) => e.includes('T9') && e.includes('esquema')));
});

test('el esquema JSON rechaza campos desconocidos y tipos inválidos', () => {
  const validar = crearValidador();
  const p1 = leerJSON('actividades/P1-TRAD.json');
  assert.ok(validar('actividad.schema.json', { ...p1, criterio: [] }).length > 0);
  const tc = leerJSON('actividades/TC1-SQI.json');
  assert.ok(validar('actividad.schema.json', { ...tc, preguntas: [{ id: '1a', texto: 'x' }] }).length > 0);
  const sem = leerJSON('semestre-2026B.json');
  assert.ok(validar('semestre.schema.json', { ...sem, inicio: '2026-13-01' }).length > 0);
});
