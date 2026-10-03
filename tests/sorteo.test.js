// Sorteo del control oral y cobertura del bimestre.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generarEventos } from '../src/nucleo/calendario.js';
import { crearContexto } from '../src/nucleo/motor.js';
import { aleatorioConSemilla, candidatosSorteo, coberturaControl, sortear } from '../src/nucleo/sorteo.js';
import { configReal } from './ayudas.js';

const cfg = configReal();

function curso(paralelo, n) {
  const c = cfg.cursoPorId[paralelo];
  const eventos = generarEventos(cfg, c);
  const reg = {
    estudiantes: Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, codigo: `e${i + 1}`, nombre: `E ${i + 1}`, curso: paralelo, estado: 'nomina', grupo_excel: String(1 + Math.floor(i / 3)) })),
    grupos_evento: [], asistencia: [], pases: [], revisiones_grupo: [], puntajes: [], etiquetas: [], notas: [],
    controles: [], revision_preparatorio: [], novedades_preparatorio: [], ajustes: [], cambios_evento: [],
  };
  return { c, eventos, reg, ctx: () => crearContexto(cfg, c, eventos, reg) };
}

test('GR2QB (22 estudiantes, 5 sesiones en el 1.er bimestre): pide 5 en alguna sesión y cubre a todos', () => {
  const { eventos, reg, ctx } = curso('GR2QB', 22);
  const sesiones = eventos.filter((e) => ['practica', 'taller'].includes(e.tipo) && e.bimestre === 1 && e.estado === 'normal');
  assert.deepEqual(sesiones.map((e) => e.codigo), ['P1', 'T1', 'P2', 'P3', 'T3']);
  const aleatorio = aleatorioConSemilla(7);
  const sugeridos = [];
  for (const sesion of sesiones) {
    const cob = coberturaControl(ctx(), sesion);
    sugeridos.push(cob.sugerido);
    const elegidos = sortear(candidatosSorteo(ctx(), sesion), cob.sugerido, aleatorio);
    assert.equal(elegidos.length, cob.sugerido);
    for (const e of elegidos) reg.controles.push({ evento: sesion.id, estudiante: e.id, estado: 'respondio', puntajes: [2] });
  }
  assert.deepEqual(sugeridos, [5, 5, 4, 4, 4]);
  assert.ok(coberturaControl(ctx(), sesiones[0]).quedan === 5);
  const final = coberturaControl(ctx(), sesiones[4]);
  assert.equal(final.faltan, 0, 'todos tienen control al terminar el bimestre');
  assert.equal(new Set(reg.controles.map((c) => c.estudiante)).size, 22, 'nadie repitió mientras faltaban otros');
});

test('el indicador avisa cuando hacen falta más de 4 por sesión', () => {
  const { eventos, ctx } = curso('GR2QB', 22);
  const cob = coberturaControl(ctx(), eventos.find((e) => e.codigo === 'P1'));
  assert.deepEqual([cob.faltan, cob.quedan, cob.sugerido, cob.aviso], [22, 5, 5, true]);
  const { eventos: ev2, ctx: ctx2 } = curso('GR1QA', 17);
  // GR1QA no pierde sesiones en el 1.er bimestre: 6 sesiones → 3 por sesión.
  const c2 = coberturaControl(ctx2(), ev2.find((e) => e.codigo === 'P1'));
  assert.deepEqual([c2.quedan, c2.sugerido, c2.aviso], [6, 3, false]);
});

test('prioridad a quienes no tienen control; cuando todos lo tienen, se sortea entre todos', () => {
  const { eventos, reg, ctx } = curso('GR2QB', 6);
  const p1 = eventos.find((e) => e.codigo === 'P1');
  const t1 = eventos.find((e) => e.codigo === 'T1');
  for (const id of ['e1', 'e2', 'e3', 'e4']) reg.controles.push({ evento: p1.id, estudiante: id, estado: 'respondio', puntajes: [1] });
  const elegidos = sortear(candidatosSorteo(ctx(), t1), 3, aleatorioConSemilla(1));
  assert.deepEqual(elegidos.slice(0, 2).map((e) => e.id).sort(), ['e5', 'e6'], 'primero los que faltan');
  assert.equal(elegidos.length, 3, 'se completa con quienes ya tienen control');
  for (const id of ['e5', 'e6']) reg.controles.push({ evento: p1.id, estudiante: id, estado: 'respondio', puntajes: [2] });
  assert.equal(coberturaControl(ctx(), t1).faltan, 0);
  assert.equal(sortear(candidatosSorteo(ctx(), t1), 4, aleatorioConSemilla(2)).length, 4);
});

test('«no está»: se vuelve a sortear y el estudiante sigue pendiente; quien no ingresó o faltó no sale sorteado', () => {
  const { eventos, reg, ctx } = curso('GR2QB', 5);
  const p1 = eventos.find((e) => e.codigo === 'P1');
  reg.controles.push({ evento: p1.id, estudiante: 'e1', estado: 'no_esta', puntajes: [] });
  reg.novedades_preparatorio.push({ evento: p1.id, estudiante: 'e2', nivel: 0, no_ingresa: true });
  reg.asistencia.push({ evento: p1.id, estudiante: 'e3', estado: 'no_vino', motivo: 'sin preparatorio' });
  const { prioritarios, resto } = candidatosSorteo(ctx(), p1);
  assert.deepEqual(prioritarios.map((e) => e.id), ['e4', 'e5']);
  assert.equal(resto.length, 0);
  assert.equal(coberturaControl(ctx(), p1).faltan, 5, '«no está» no cuenta como control');
});

test('«salió» cuenta como control (con nota 0) y SQI cuenta el aprobado/no aprobado', () => {
  const { eventos, reg, ctx } = curso('GR2QB', 3);
  const p1 = eventos.find((e) => e.codigo === 'P1');
  reg.controles.push({ evento: p1.id, estudiante: 'e1', estado: 'salio', puntajes: [0] });
  reg.controles.push({ evento: p1.id, estudiante: 'e2', estado: 'sorteado', puntajes: [] });
  assert.equal(coberturaControl(ctx(), p1).faltan, 2);
  const q = curso('GR1AA', 3);
  const qp1 = q.eventos.find((e) => e.codigo === 'P1');
  q.reg.controles.push({ evento: qp1.id, estudiante: 'e1', estado: 'respondio', aprobado: false });
  assert.equal(coberturaControl(q.ctx(), qp1).faltan, 2);
});
