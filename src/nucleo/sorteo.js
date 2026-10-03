// Control oral: cobertura del bimestre y sorteo (prioridad a quienes aún no tienen control).
import { activos } from './grupos.js';
import { asistenciaDe, notaControl } from './motor.js';

/** Sesiones del bimestre donde se hace control oral (prácticas y talleres que se realizan). */
export function sesionesDeControl(ctx, bimestre) {
  const tipos = ctx.cfg.controlOral.sesiones;
  return ctx.eventos.filter((e) => tipos.includes(e.tipo) && e.bimestre === bimestre && e.estado === 'normal' && e.con_nota);
}

/** Estudiantes con al menos un control válido en el bimestre (Set de ids). */
export function conControlEnBimestre(ctx, bimestre) {
  const ids = new Set();
  for (const e of sesionesDeControl(ctx, bimestre)) {
    for (const est of ctx.reg.estudiantes) {
      if (notaControl(ctx, e, est.id).estado === 'calculada') ids.add(est.id);
    }
  }
  return ids;
}

/**
 * Indicador de cobertura: «faltan N; quedan M sesiones (con esta); conviene sortear K por sesión».
 * `aviso` es verdadero si K pasa del máximo configurado (por defecto 4).
 */
export function coberturaControl(ctx, evento) {
  const co = ctx.cfg.controlOral;
  const bimestre = evento.bimestre;
  const est = activos(ctx.reg.estudiantes);
  const con = conControlEnBimestre(ctx, bimestre);
  const faltan = est.filter((e) => !con.has(e.id));
  const restantes = sesionesDeControl(ctx, bimestre).filter((e) => e.fecha >= evento.fecha);
  const quedan = restantes.length;
  const sugerido = faltan.length === 0 ? 0 : Math.ceil(faltan.length / Math.max(quedan, 1));
  return {
    bimestre,
    total: est.length,
    conControl: est.length - faltan.length,
    faltan: faltan.length,
    sinControl: faltan,
    quedan,
    sugerido,
    aviso: sugerido > co.aviso_si_sugerido_mayor_que,
    ultimaSesion: quedan <= 1,
  };
}

/**
 * Candidatos para sortear en este evento: estudiantes activos que no fueron sorteados aún en el evento,
 * que no quedaron fuera en la puerta y que no tienen falta registrada. Se separan en prioritarios
 * (sin control en el bimestre) y resto.
 */
export function candidatosSorteo(ctx, evento) {
  const con = conControlEnBimestre(ctx, evento.bimestre);
  const prioritarios = [];
  const resto = [];
  for (const e of activos(ctx.reg.estudiantes)) {
    if (ctx.controles.has(`${evento.id}|${e.id}`)) continue;
    if (ctx.novedades.get(`${evento.id}|${e.id}`)?.no_ingresa) continue;
    if (asistenciaDe(ctx, evento, e.id).falta) continue;
    (con.has(e.id) ? resto : prioritarios).push(e);
  }
  return { prioritarios, resto };
}

/** Elige `n` al azar: primero entre los prioritarios; si no alcanzan, completa con el resto. */
export function sortear({ prioritarios, resto }, n, aleatorio = aleatorioSeguro) {
  const elegidos = tomar(prioritarios, n, aleatorio);
  if (elegidos.length < n) elegidos.push(...tomar(resto, n - elegidos.length, aleatorio));
  return elegidos;
}

function tomar(lista, n, aleatorio) {
  const copia = [...lista];
  const salida = [];
  while (salida.length < n && copia.length) {
    const i = Math.floor(aleatorio() * copia.length);
    salida.push(copia.splice(i, 1)[0]);
  }
  return salida;
}

/** Número aleatorio uniforme en [0, 1) con el generador criptográfico del navegador o de Node. */
export function aleatorioSeguro() {
  const x = new Uint32Array(1);
  globalThis.crypto.getRandomValues(x);
  return x[0] / 2 ** 32;
}

/** Generador con semilla (para pruebas reproducibles). */
export function aleatorioConSemilla(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
