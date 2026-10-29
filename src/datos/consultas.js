// Lecturas agrupadas de la base para las pantallas y el motor de notas.
import { TABLAS_DE_EVENTO } from '../db.js';
import { generarEventos } from '../nucleo/calendario.js';
import { asistenciaDe, crearContexto, notaEvento, premioCuenta } from '../nucleo/motor.js';
import { esVisitante } from '../nucleo/grupos.js';
import { fechaCorta } from '../nucleo/util.js';

/**
 * Todo lo registrado de un curso: estudiantes y filas de cada tabla de evento con evento «PARALELO:…».
 * Con `cfg`, también las recuperaciones vinculadas: un estudiante del curso que recuperó una actividad como visitante en
 * otro de mis cursos (de la misma metodología) trae su nota de allí, sin copiarla (ver `recuperacionesVinculadas`).
 */
export async function registrosDelCurso(db, paralelo, cfg = null) {
  const prefijo = `${paralelo}:`;
  const [estudiantes, ...tablas] = await Promise.all([
    db.estudiantes.where('curso').equals(paralelo).toArray(),
    ...TABLAS_DE_EVENTO.map((t) => db.table(t).where('evento').startsWith(prefijo).toArray()),
  ]);
  const reg = { estudiantes };
  TABLAS_DE_EVENTO.forEach((t, i) => { reg[t] = tablas[i]; });
  if (cfg?.cursoPorId?.[paralelo]) {
    const vinculadas = await recuperacionesVinculadas(db, cfg, cfg.cursoPorId[paralelo], reg);
    // Una recuperación escrita a mano manda sobre la vinculada.
    const manuales = new Set(reg.recuperaciones.map((r) => `${r.evento}|${r.estudiante}`));
    reg.recuperaciones = [...reg.recuperaciones, ...vinculadas.filter((r) => !manuales.has(`${r.evento}|${r.estudiante}`))];
    reg.decimas = [...reg.decimas, ...await decimasVinculadas(db, cfg, cfg.cursoPorId[paralelo], reg)];
  }
  return reg;
}

/**
 * Recuperaciones vinculadas de un curso: por cada estudiante suyo que figura como visitante («recupera aquí») en un evento
 * de otro de mis cursos, una fila de `recuperaciones` para el mismo evento (misma actividad) de su curso, con la nota que
 * tiene allá. No se guarda: se calcula cada vez, así que siempre refleja lo último del otro curso.
 *  - Nota calculada → estado «realizada» con esa nota; «no vino» en esa sesión → «no_asistio» (0); si no, «solicitada».
 *  - Solo entre cursos de la misma metodología (SQI con SQI, Clásica con Clásica): una rúbrica no se traduce a la otra.
 * La fila lleva `vinculada: { evento, visitante }` (el evento donde recuperó y su id allí) y no existe en la base.
 */
export async function recuperacionesVinculadas(db, cfg, curso, reg) {
  const { visitas, porCodigo } = await visitasMias(db, cfg, curso, reg);
  if (!visitas.length) return [];
  const eventosPropios = generarEventos(cfg, curso, reg.cambios_evento);
  const filas = [];
  const memo = new Map();
  for (const v of visitas) {
    const propio = eventosPropios.find((e) => e.codigo === String(v.visita?.evento ?? '').split(':')[1] && e.con_nota);
    const anfitrion = await anfitrionDe(db, cfg, v, memo);
    if (!propio || !anfitrion) continue;
    const { ctx, eventoA } = anfitrion;
    const nota = notaEvento(ctx, eventoA, v.id);
    const falto = asistenciaDe(ctx, eventoA, v.id).falta;
    const estudiante = porCodigo.get(v.codigo);
    const donde = `${v.curso}, ${fechaCorta(eventoA.fecha)}`;
    const estado = falto ? 'no_asistio' : nota.estado === 'calculada' ? 'realizada' : 'solicitada';
    filas.push({
      evento: propio.id, estudiante: estudiante.id, estado, nota: estado === 'realizada' ? nota.valor : null, motivo: 'justificada',
      detalle: estado === 'solicitada' ? `${donde} (nota pendiente)` : donde, fecha: null,
      vinculada: { evento: eventoA.id, visitante: v.id },
    });
  }
  return filas;
}

/**
 * Décimas vinculadas: los premios que un estudiante de este curso ganó como visitante en otra de mis clases (misma
 * metodología) cuentan en su propio curso, como si los hubiera ganado aquí. Cada fila lleva el evento donde se ganó
 * (`evento`, con su `evento_fecha`, porque ese evento no está en este curso) y `vinculada`. Un premio de grupo no cuenta si
 * faltó a esa sesión. Cuentan en el bono de su bimestre (`evento_bimestre`, el del evento donde se ganaron). No se guardan.
 */
export async function decimasVinculadas(db, cfg, curso, reg) {
  const { visitas, porCodigo } = await visitasMias(db, cfg, curso, reg);
  const filas = [];
  const memo = new Map();
  for (const v of visitas) {
    const anfitrion = await anfitrionDe(db, cfg, v, memo);
    if (!anfitrion) continue;
    const { ctx, eventoA } = anfitrion;
    for (const f of ctx.reg.decimas ?? []) {
      if (f.estudiante !== v.id || f.evento !== eventoA.id || !premioCuenta(ctx, f)) continue;
      filas.push({ ...f, id: `${f.id}|vinculada`, estudiante: porCodigo.get(v.codigo).id, evento_fecha: eventoA.fecha, evento_bimestre: eventoA.bimestre, vinculada: { evento: eventoA.id, visitante: v.id } });
    }
  }
  return filas;
}

/** Mis visitantes: estudiantes de este curso (por código) que figuran como «recupera aquí» en otro curso de la misma metodología. */
async function visitasMias(db, cfg, curso, reg) {
  const porCodigo = new Map(reg.estudiantes.filter((e) => !esVisitante(e) && e.estado !== 'baja').map((e) => [e.codigo, e]));
  if (!porCodigo.size) return { visitas: [], porCodigo };
  const visitas = (await db.estudiantes.where('estado').equals('visitante').toArray())
    .filter((v) => porCodigo.has(v.codigo) && v.curso !== curso.paralelo && cfg.cursoPorId[v.curso]?.metodologia === curso.metodologia);
  return { visitas, porCodigo };
}

// Contexto del curso anfitrión (sin vínculos: no hay recursión); `memo` evita recargarlo por cada visitante de una misma lectura.
async function anfitrionDe(db, cfg, v, memo) {
  const paralelo = String(v.visita?.evento ?? '').split(':')[0];
  const cursoA = cfg.cursoPorId[paralelo];
  if (!cursoA || paralelo !== v.curso) return null;
  if (!memo.has(paralelo)) {
    const regA = await registrosDelCurso(db, paralelo);
    const eventos = generarEventos(cfg, cursoA, regA.cambios_evento);
    memo.set(paralelo, { ctx: crearContexto(cfg, cursoA, eventos, regA), eventos });
  }
  const { ctx, eventos } = memo.get(paralelo);
  const eventoA = eventos.find((e) => e.id === v.visita.evento);
  return eventoA ? { ctx, eventoA } : null;
}

/** Estudiantes por curso (para la pantalla de inicio). */
export async function conteoPorCurso(db) {
  const todos = await db.estudiantes.toArray();
  const c = {};
  for (const e of todos) {
    c[e.curso] ??= { nomina: 0, pendiente: 0, baja: 0, visitante: 0 };
    c[e.curso][e.estado] = (c[e.curso][e.estado] ?? 0) + 1;
  }
  return c;
}

/** Cuántas filas hay en cada tabla. */
export async function conteoTablas(db) {
  const salida = {};
  for (const t of db.tables) salida[t.name] = await t.count();
  return salida;
}
