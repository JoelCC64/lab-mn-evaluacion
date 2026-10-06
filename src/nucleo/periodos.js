// Periodos de las métricas: día, semana del semestre, mes, bimestre o semestre. Funciones puras.
import { fechaADate, fechaLarga, sumarDias } from './util.js';
import { semanaDeFecha } from './calendario.js';

export const TIPOS_PERIODO = ['dia', 'semana', 'mes', 'bimestre', 'semestre'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const diaMes = (iso) => { const d = fechaADate(iso); return [d.getUTCDate(), MESES_CORTOS[d.getUTCMonth()]]; };

/** «5–11 oct» o «28 sep – 4 oct». */
function rangoCorto(desde, hasta) {
  const [d1, m1] = diaMes(desde);
  const [d2, m2] = diaMes(hasta);
  return m1 === m2 ? `${d1}–${d2} ${m1}` : `${d1} ${m1} – ${d2} ${m2}`;
}

/**
 * Periodo que contiene `fecha` ('AAAA-MM-DD'): { tipo, desde, hasta, bimestre, texto, clave }. Día, semana y mes
 * tienen fechas (desde/hasta, incluidas); bimestre y semestre no. La semana es la del semestre (de lunes a
 * domingo, desde el inicio de clases); fuera del semestre, la semana de lunes a domingo que contiene la fecha.
 */
export function periodoDe(cfg, tipo, fecha, bimestre = null) {
  if (tipo === 'semestre') return { tipo, desde: null, hasta: null, bimestre: null, texto: 'Semestre', clave: 'semestre' };
  if (tipo === 'bimestre') {
    const b = bimestre ?? (fecha > cfg.semestre.fin_bimestre_1 ? 2 : 1);
    return { tipo, desde: null, hasta: null, bimestre: b, texto: b === 1 ? '1.er bimestre' : '2.º bimestre', clave: `B${b}` };
  }
  if (tipo === 'dia') {
    const t = fechaLarga(fecha);
    return { tipo, desde: fecha, hasta: fecha, bimestre: null, texto: t.charAt(0).toUpperCase() + t.slice(1), clave: fecha };
  }
  if (tipo === 'semana') {
    const s = semanaDeFecha(cfg, fecha);
    const lunes = s ? sumarDias(cfg.semestre.inicio, (s - 1) * 7) : sumarDias(fecha, -((fechaADate(fecha).getUTCDay() + 6) % 7));
    const domingo = sumarDias(lunes, 6);
    return { tipo, desde: lunes, hasta: domingo, bimestre: null, semana: s, texto: `${s ? `Semana ${s}` : 'Semana'} · ${rangoCorto(lunes, domingo)}`, clave: s ? `S${s}` : lunes };
  }
  if (tipo === 'mes') {
    const d = fechaADate(fecha);
    const a = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const desde = `${a}-${String(m + 1).padStart(2, '0')}-01`;
    const hasta = sumarDias(m === 11 ? `${a + 1}-01-01` : `${a}-${String(m + 2).padStart(2, '0')}-01`, -1);
    return { tipo, desde, hasta, bimestre: null, texto: `${MESES[m].charAt(0).toUpperCase()}${MESES[m].slice(1)} de ${a}`, clave: desde.slice(0, 7) };
  }
  throw new Error(`Periodo desconocido: ${tipo}`);
}

/** El periodo anterior (paso −1) o el siguiente (+1) del mismo tipo. */
export function moverPeriodo(cfg, p, paso) {
  if (p.tipo === 'bimestre') return periodoDe(cfg, 'bimestre', null, p.bimestre === 1 ? 2 : 1);
  if (p.tipo === 'semestre') return p;
  if (p.tipo === 'dia') return periodoDe(cfg, 'dia', sumarDias(p.desde, paso));
  if (p.tipo === 'semana') return periodoDe(cfg, 'semana', sumarDias(p.desde, 7 * paso));
  return periodoDe(cfg, 'mes', paso > 0 ? sumarDias(p.hasta, 1) : sumarDias(p.desde, -1));
}

/** ¿El evento cae en el periodo? Por fecha (día, semana, mes) o por bimestre. */
export function enPeriodo(p, evento) {
  if (!p || p.tipo === 'semestre') return true;
  if (p.tipo === 'bimestre') return evento.bimestre === p.bimestre;
  return evento.fecha >= p.desde && evento.fecha <= p.hasta;
}
