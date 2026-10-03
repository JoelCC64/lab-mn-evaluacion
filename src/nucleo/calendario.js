// Eventos de cada curso a partir del cronograma (A/B × metodología), los feriados y el semestre.
// Un evento es una actividad de un curso: «GR2QB:P1», «GR1AA:TC1», «GR2QB:INTRO», «GR2QB:PLIC».
// Los eventos se calculan siempre desde la configuración; la base de datos solo guarda lo registrado
// y, si hace falta, cambios manuales de estado (por ejemplo, una clase suspendida).

import { DIAS, diaDeFecha, diasEntre, sumarDias } from './util.js';
import { bimestreDeActividad, configActividad, cronogramaDe, tituloActividad } from './config.js';

export const TIPOS_SESION = ['practica', 'taller', 'sin_nota'];

export function inicioDeSemana(cfg, semana) {
  return sumarDias(cfg.semestre.inicio, 7 * (semana - 1));
}

export function fechaDeSesion(cfg, semana, dia) {
  return sumarDias(inicioDeSemana(cfg, semana), DIAS.indexOf(dia));
}

/** Semana del semestre (1…N) de una fecha, o null si cae fuera. */
export function semanaDeFecha(cfg, fecha) {
  const d = diasEntre(cfg.semestre.inicio, fecha);
  if (d < 0) return null;
  const s = Math.floor(d / 7) + 1;
  return s > cfg.semestre.semanas ? null : s;
}

/** Motivo por el que un curso no tiene clase en una fecha (feriado, franja sin clase o receso), o null. */
export function motivoSinClase(cfg, fecha, curso) {
  const franja = `${curso.inicio}-${curso.fin}`;
  for (const f of cfg.semestre.feriados) {
    if (f.fecha) {
      if (f.fecha === fecha) return f.motivo;
    } else if (fecha >= f.desde && fecha <= f.hasta) {
      if (!f.franjas_con_clase || !f.franjas_con_clase.includes(franja)) return f.motivo;
    }
  }
  const r = cfg.semestre.receso;
  if (r && fecha >= r.desde && fecha <= r.hasta) return 'Receso';
  return null;
}

/**
 * Lista ordenada de eventos de un curso.
 * `cambios`: cambios manuales de estado guardados en la app, [{ event_id, estado, motivo }].
 */
export function generarEventos(cfg, curso, cambios = []) {
  const crono = cronogramaDe(cfg, curso);
  if (!crono) throw new Error(`No hay cronograma ${curso.cronograma}-${curso.metodologia} para ${curso.paralelo}`);
  const eventos = [];
  let orden = 0;

  for (const s of crono.semanas) {
    if (s.sin_clase) continue;
    const fechaSesion = fechaDeSesion(cfg, s.semana, curso.dia);
    const motivoSesion = motivoSinClase(cfg, fechaSesion, curso);

    for (const codigo of s.actividades) {
      const cat = cfg.catalogo[codigo];
      if (!cat) throw new Error(`La actividad ${codigo} del cronograma ${crono.id} no está en el catálogo`);
      const esPlic = cat.tipo === 'plic';
      const fecha = esPlic ? cfg.semestre.plic.fecha : fechaSesion;
      const motivo = esPlic ? null : motivoSesion;
      eventos.push({
        id: `${curso.paralelo}:${codigo}`,
        curso: curso.paralelo,
        metodologia: curso.metodologia,
        codigo,
        tipo: cat.tipo,
        titulo: tituloActividad(cfg, codigo, curso.metodologia),
        semana: s.semana,
        fecha,
        lugar: esPlic ? null : s.lugar,
        sesion: TIPOS_SESION.includes(cat.tipo),
        con_nota: cat.tipo !== 'sin_nota' && !cat.sin_nota,
        bimestre: cat.tipo === 'sin_nota'
          ? (fecha <= cfg.semestre.fin_bimestre_1 ? 1 : 2)
          : bimestreDeActividad(cfg, codigo, curso.metodologia),
        practica: cat.practica ? `${curso.paralelo}:${cat.practica}` : null,
        config: configActividad(cfg, codigo, curso.metodologia)?.id ?? null,
        estado: motivo ? 'feriado' : 'normal',
        motivo,
        cambio_manual: false,
        orden: orden++,
      });
    }
  }

  const porId = new Map(eventos.map((e) => [e.id, e]));
  for (const c of cambios) {
    const e = porId.get(c.event_id);
    if (!e) continue;
    e.estado = c.estado;
    e.motivo = c.motivo ?? null;
    e.cambio_manual = true;
  }
  // El trabajo en casa sigue a su práctica: si la práctica no se hizo, el TC tampoco cuenta.
  for (const e of eventos) {
    if (e.tipo !== 'trabajo_casa' || e.cambio_manual) continue;
    const p = porId.get(e.practica);
    if (p && p.estado !== 'normal') {
      e.estado = p.estado;
      e.motivo = `${p.codigo} no se hizo (${p.motivo})`;
    }
  }

  return eventos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden));
}

/** ¿El evento se realiza (no es feriado ni clase suspendida)? */
export function seRealiza(evento) {
  return evento.estado === 'normal';
}

/**
 * Evento que la app propone para hoy: de lunes a viernes, la sesión de esta semana (aunque ya haya
 * pasado, para terminar de cargarla); el fin de semana, o si esta semana no hay clase, la próxima
 * sesión; si el semestre terminó, la última.
 */
export function eventoSugerido(cfg, eventos, hoy) {
  const sesiones = eventos.filter((e) => e.sesion);
  if (!sesiones.length) return null;
  const finDeSemana = ['sabado', 'domingo'].includes(diaDeFecha(hoy));
  const semana = semanaDeFecha(cfg, hoy);
  const deEstaSemana = sesiones.find((e) => e.semana === semana);
  if (deEstaSemana && !finDeSemana) return deEstaSemana;
  return sesiones.find((e) => e.fecha >= hoy) ?? sesiones[sesiones.length - 1];
}
