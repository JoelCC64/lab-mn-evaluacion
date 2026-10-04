// Nota del bimestre en las pantallas (Fase 6): qué falta evaluar antes del envío a coordinación, quién sigue sin
// control oral cuando se acerca el cierre y el bimestre que corresponde a una fecha. Funciones puras.
import { notaEvento } from './motor.js';
import { activos } from './grupos.js';
import { conControlEnBimestre, sesionesDeControl } from './sorteo.js';
import { diasEntre } from './util.js';

/**
 * Bimestre cuyas notas se están preparando en `hoy`: el 1.º hasta su fecha de envío; después, el 2.º hasta la suya.
 * Devuelve { bimestre, envio, dias } (días hasta el envío; negativo si ya pasó) o null si el semestre terminó.
 */
export function bimestreEnCurso(cfg, hoy) {
  for (const b of [1, 2]) {
    const envio = cfg.semestre.envio_notas[b];
    if (hoy <= envio) return { bimestre: b, envio, dias: diasEntre(hoy, envio) };
  }
  return null;
}

/** «falta evaluar el grupo 3» → «falta evaluar algunos grupos» (para resumir los motivos de un evento). */
const motivoGeneral = (m) => String(m ?? '').replace(/\b(el|del) grupo \S+$/, 'algunos grupos');

/**
 * Eventos del bimestre que ya ocurrieron (fecha ≤ hoy) y aún tienen notas pendientes, con cuántas y el motivo
 * más frecuente: { pendientes: [{ evento, pendientes, motivo }], porVenir: [eventos con nota que aún no ocurren] }.
 */
export function pendientesDelBimestre(ctx, bimestre, hoy) {
  const estudiantes = activos(ctx.reg.estudiantes);
  const pendientes = [];
  const porVenir = [];
  for (const e of ctx.eventos) {
    if (!e.con_nota || e.bimestre !== bimestre || e.estado !== 'normal') continue;
    if (e.fecha > hoy) { porVenir.push(e); continue; }
    const motivos = new Map();
    for (const est of estudiantes) {
      const n = notaEvento(ctx, e, est.id);
      if (n.estado !== 'pendiente') continue;
      const m = motivoGeneral(n.motivo);
      motivos.set(m, (motivos.get(m) ?? 0) + 1);
    }
    const total = [...motivos.values()].reduce((s, x) => s + x, 0);
    if (total) pendientes.push({ evento: e, pendientes: total, motivo: [...motivos.entries()].sort((a, b) => b[1] - a[1])[0][0] });
  }
  return { pendientes, porVenir };
}

/**
 * Aviso de cierre del bimestre: cuando quedan pocas sesiones (`aviso_cierre_sesiones` en control-oral.json, contando
 * la de hoy), quiénes siguen sin control oral. { bimestre, quedan, sinControl } o null si no hace falta avisar.
 */
export function avisoControlCierre(ctx, bimestre, hoy) {
  const limite = ctx.cfg.controlOral.aviso_cierre_sesiones ?? 2;
  const sesiones = sesionesDeControl(ctx, bimestre);
  if (!sesiones.length) return null;
  const quedan = sesiones.filter((e) => e.fecha >= hoy).length;
  if (quedan > limite) return null;
  const con = conControlEnBimestre(ctx, bimestre);
  const sinControl = activos(ctx.reg.estudiantes).filter((e) => !con.has(e.id));
  return sinControl.length ? { bimestre, quedan, sinControl } : null;
}
