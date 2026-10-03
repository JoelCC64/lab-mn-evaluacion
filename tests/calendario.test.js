import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generarEventos, eventoSugerido, motivoSinClase, semanaDeFecha } from '../src/nucleo/calendario.js';
import { diaDeFecha } from '../src/nucleo/util.js';
import { configReal } from './ayudas.js';

const cfg = configReal();
const eventosDe = (paralelo) => generarEventos(cfg, cfg.cursoPorId[paralelo]);

test('cada curso tiene una sesión por semana de clase, en su día, con la actividad de su cronograma', () => {
  for (const curso of cfg.cursos) {
    const eventos = generarEventos(cfg, curso);
    const sesiones = eventos.filter((e) => e.sesion);
    // Semanas 1–18 menos el receso (14): 17 sesiones.
    assert.deepEqual(sesiones.map((e) => e.semana), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18], curso.paralelo);
    for (const e of sesiones) {
      assert.equal(diaDeFecha(e.fecha), curso.dia, `${e.id} cae en ${diaDeFecha(e.fecha)}`);
      assert.equal(semanaDeFecha(cfg, e.fecha), e.semana, e.id);
    }
    const conNota = eventos.filter((e) => e.con_nota).map((e) => e.codigo);
    const esperadas = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'PLIC'];
    if (curso.metodologia === 'SQI') esperadas.push('TC1', 'TC2', 'TC3', 'TC4', 'TC5', 'TC7');
    assert.deepEqual([...conNota].sort(), [...esperadas].sort(), curso.paralelo);
  }
});

test('cronogramas A y B: P1 en la semana 2 (A) o 4 (B); T1 en la 4 (A) o 2 (B)', () => {
  const a = eventosDe('GR2QB'), b = eventosDe('GR3QA');
  const sem = (ev, cod) => ev.find((e) => e.codigo === cod).semana;
  assert.equal(sem(a, 'P1'), 2); assert.equal(sem(a, 'T1'), 4);
  assert.equal(sem(b, 'P1'), 4); assert.equal(sem(b, 'T1'), 2);
  assert.equal(eventosDe('GR2QB').find((e) => e.codigo === 'P1').fecha, '2026-10-05');
  assert.equal(eventosDe('GR1QA').find((e) => e.codigo === 'P1').fecha, '2026-10-08');
});

test('las sesiones perdidas coinciden con el Anexo H.3', () => {
  const esperado = {
    GR2QB: ['T2', 'P5'], GR9EB: ['T2', 'P5'], GR3MB: ['T2', 'P5'],
    GR1AA: ['T2'], GR4EB: ['T2'],
    GR6CD: [], GR7SA: [],
    GR7EB: ['REFUERZO'],
    GR3QA: ['REFUERZO', 'T6'],
    GR1QA: ['P6'],
  };
  for (const curso of cfg.cursos) {
    const perdidas = generarEventos(cfg, curso).filter((e) => e.estado === 'feriado' && e.sesion).map((e) => e.codigo);
    assert.deepEqual(perdidas, esperado[curso.paralelo], curso.paralelo);
  }
});

test('motivos de los feriados y franjas de la Integración Politécnica', () => {
  const t2 = eventosDe('GR2QB').find((e) => e.codigo === 'T2');
  assert.equal(t2.motivo, 'Día de los Difuntos');
  assert.equal(eventosDe('GR1AA').find((e) => e.codigo === 'T2').motivo, 'Independencia de Cuenca');
  // Integración Politécnica (13–16 oct): solo 07:00–09:00 y 14:00–16:00 tienen clase.
  assert.equal(motivoSinClase(cfg, '2026-10-14', cfg.cursoPorId.GR7SA), null);
  assert.equal(motivoSinClase(cfg, '2026-10-14', cfg.cursoPorId.GR7EB), 'Integración Politécnica');
  assert.equal(motivoSinClase(cfg, '2026-10-12', cfg.cursoPorId.GR2QB), null); // el lunes 12 es normal
  assert.equal(motivoSinClase(cfg, '2026-12-30', cfg.cursoPorId.GR7SA), 'Receso');
});

test('el TC sigue a su práctica: si la práctica se pierde, el TC tampoco cuenta', () => {
  const curso = cfg.cursoPorId.GR1AA;
  const eventos = generarEventos(cfg, curso, [{ event_id: 'GR1AA:P2', estado: 'sin_clase', motivo: 'Clase suspendida' }]);
  const tc2 = eventos.find((e) => e.codigo === 'TC2');
  assert.equal(tc2.estado, 'sin_clase');
  assert.match(tc2.motivo, /P2/);
  assert.equal(eventos.find((e) => e.codigo === 'TC1').estado, 'normal');
  assert.equal(tc2.practica, 'GR1AA:P2');
  // Orden del Anexo J: P1, TC1, …, T1
  const orden = eventos.filter((e) => e.con_nota && e.bimestre === 1).map((e) => e.codigo);
  assert.deepEqual(orden, ['P1', 'TC1', 'T1', 'P2', 'TC2', 'T2', 'P3', 'TC3', 'T3']);
});

test('bimestre por actividad: P4 (A) y T4 (B) de la semana 9 cuentan en el 2.º', () => {
  const p4 = eventosDe('GR2QB').find((e) => e.codigo === 'P4');
  const t4 = eventosDe('GR3QA').find((e) => e.codigo === 'T4');
  assert.equal(p4.semana, 9); assert.equal(p4.bimestre, 2);
  assert.equal(t4.semana, 9); assert.equal(t4.bimestre, 2);
  assert.ok(p4.fecha <= cfg.semestre.fin_bimestre_1, 'la semana 9 aún es del 1.er bimestre en el calendario');
});

test('PLIC: jueves 21 de enero de 2027 para todos los cursos, 2.º bimestre', () => {
  for (const curso of cfg.cursos) {
    const plic = generarEventos(cfg, curso).find((e) => e.codigo === 'PLIC');
    assert.equal(plic.fecha, '2027-01-21');
    assert.equal(plic.bimestre, 2);
    assert.equal(plic.sesion, false);
  }
});

test('sesiones con control oral en el 1.er bimestre: GR2QB tiene 5 (pierde el T2)', () => {
  const sesionesB1 = eventosDe('GR2QB').filter((e) => ['practica', 'taller'].includes(e.tipo) && e.bimestre === 1 && e.estado === 'normal');
  assert.deepEqual(sesionesB1.map((e) => e.codigo), ['P1', 'T1', 'P2', 'P3', 'T3']);
});

test('evento sugerido: la sesión de la semana o la próxima', () => {
  const eventos = eventosDe('GR2QB');
  assert.equal(eventoSugerido(cfg, eventos, '2026-10-03').codigo, 'INTRO'); // sábado de la semana 1
  assert.equal(eventoSugerido(cfg, eventos, '2026-10-05').codigo, 'P1');
  assert.equal(eventoSugerido(cfg, eventos, '2026-10-08').codigo, 'P1');   // jueves de la semana 2
  assert.equal(eventoSugerido(cfg, eventos, '2026-12-30').codigo, 'T6');   // receso → la próxima
  assert.equal(eventoSugerido(cfg, eventos, '2027-03-01').codigo, 'REVISION');
});
