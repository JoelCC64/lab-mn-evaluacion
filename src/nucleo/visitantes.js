// Estudiantes de otros docentes que recuperan en una sesión de este curso (Fase 6). Se agregan al evento con su
// código y nombre, se califican con su grupo y la app arma el texto con la nota para su profesor (que Joel envía en
// las 24 h siguientes). No van al Excel ni cuentan en el curso. Funciones puras.
import { asistenciaDe, notaControl, notaEvento, notaPreparatorio } from './motor.js';
import { esVisitante } from './grupos.js';
import { fechaLarga, redondear } from './util.js';

/** Id de un visitante en un evento: «v-<código>-<paralelo>-<actividad>» (una fila por visita). */
export function idVisitante(evento, codigo) {
  return `v-${String(codigo).trim()}-${String(evento).replace(':', '-')}`;
}

/** Visitantes de un evento, por nombre. */
export function visitantesDelEvento(ctx, evento) {
  return ctx.reg.estudiantes.filter((e) => esVisitante(e) && e.visita?.evento === evento.id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

const sobreDiez = (v) => String(redondear(v * 10, 2));

/** Detalle de la nota del evento en texto: «diseño 3/4 · datos 4/4 · análisis 3/4». */
function partesEnTexto(n) {
  const partes = [];
  if (n.partes?.asistencia_permanencia !== undefined) partes.push(`asistencia y permanencia ${n.partes.asistencia_permanencia}`);
  for (const p of n.partes?.grupo?.partes ?? []) partes.push(`${p.corto} ${p.valor}/${p.max}`);
  return partes.join(' · ');
}

/**
 * Texto con la nota para el profesor del estudiante: { texto, final }. `final` es falso mientras la nota esté
 * pendiente (falta cerrar el pase o evaluar el grupo): conviene enviarlo cuando esté completa.
 */
export function textoParaSuProfesor(ctx, evento, visitante) {
  const cfg = ctx.cfg;
  const curso = ctx.curso;
  const n = notaEvento(ctx, evento, visitante.id);
  const asis = asistenciaDe(ctx, evento, visitante.id);
  const prep = notaPreparatorio(ctx, evento, visitante.id);
  const ctrl = notaControl(ctx, evento, visitante.id);
  const metodologia = cfg.semestre.metodologias[curso.metodologia] ?? curso.metodologia;
  const lineas = [
    `Recuperación en el Laboratorio de Mecánica Newtoniana (EPN, ${cfg.semestre.semestre})`,
    '',
    `Estudiante: ${visitante.nombre} · código ${visitante.codigo}${visitante.visita?.paralelo ? ` · paralelo ${visitante.visita.paralelo}` : ''}`,
    `Actividad: ${evento.codigo} · ${evento.titulo} (${metodologia})`,
    `Sesión: ${curso.paralelo}, ${fechaLarga(evento.fecha)}, ${curso.inicio}–${curso.fin}`,
    `Asistencia: ${asis.estado ? (cfg.asistencia.estados[asis.estado]?.texto ?? asis.estado) : 'sin registrar'}${asis.motivo ? ` (${asis.motivo})` : ''}`,
  ];
  if (n.estado === 'calculada') {
    const detalle = partesEnTexto(n);
    lineas.push(`Nota de la actividad: ${sobreDiez(n.valor)}/10${n.valor === 0 && n.motivo ? ` (${n.motivo})` : detalle ? ` (${detalle})` : ''}`);
    if (n.ajuste) lineas.push(`Ajuste: ${n.ajuste.motivo}`);
  } else {
    lineas.push(`Nota de la actividad: pendiente (${n.motivo})`);
  }
  if (prep.estado === 'calculada') lineas.push(`Trabajo preparatorio: ${prep.nivel}/2`);
  if (ctrl.estado === 'calculada') {
    lineas.push(`Control oral: ${ctrl.valor !== null && ctrl.valor !== undefined ? `${sobreDiez(ctrl.valor)}/10` : ctrl.aprobado ? 'aprobado' : 'no aprobado'}`);
  }
  if (asis.observacion) lineas.push(`Observación: ${asis.observacion}`);
  lineas.push('', cfg.semestre.profesor);
  return { texto: lineas.join('\n'), final: n.estado === 'calculada' };
}
