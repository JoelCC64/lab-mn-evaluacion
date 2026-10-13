// Lecturas agrupadas de la base para las pantallas y el motor de notas.
import { TABLAS_DE_EVENTO } from '../db.js';
import { generarEventos } from '../nucleo/calendario.js';
import { asistenciaDe, crearContexto, notaEvento } from '../nucleo/motor.js';
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
  const porCodigo = new Map(reg.estudiantes.filter((e) => !esVisitante(e) && e.estado !== 'baja').map((e) => [e.codigo, e]));
  if (!porCodigo.size) return [];
  const visitas = (await db.estudiantes.where('estado').equals('visitante').toArray())
    .filter((v) => porCodigo.has(v.codigo) && v.curso !== curso.paralelo && cfg.cursoPorId[v.curso]?.metodologia === curso.metodologia);
  if (!visitas.length) return [];
  const eventosPropios = generarEventos(cfg, curso, reg.cambios_evento);
  const anfitriones = new Map();   // paralelo → { ctx, eventos }
  const filas = [];
  for (const v of visitas) {
    const [paraleloAnfitrion, codigoActividad] = String(v.visita?.evento ?? '').split(':');
    const propio = eventosPropios.find((e) => e.codigo === codigoActividad && e.con_nota);
    const cursoAnfitrion = cfg.cursoPorId[paraleloAnfitrion];
    if (!propio || !cursoAnfitrion || paraleloAnfitrion !== v.curso) continue;
    if (!anfitriones.has(paraleloAnfitrion)) {
      const regA = await registrosDelCurso(db, paraleloAnfitrion);   // sin vínculos: no hay recursión
      const eventosA = generarEventos(cfg, cursoAnfitrion, regA.cambios_evento);
      anfitriones.set(paraleloAnfitrion, { ctx: crearContexto(cfg, cursoAnfitrion, eventosA, regA), eventos: eventosA });
    }
    const { ctx, eventos } = anfitriones.get(paraleloAnfitrion);
    const eventoA = eventos.find((e) => e.id === v.visita.evento);
    if (!eventoA) continue;
    const nota = notaEvento(ctx, eventoA, v.id);
    const falto = asistenciaDe(ctx, eventoA, v.id).falta;
    const estudiante = porCodigo.get(v.codigo);
    const donde = `${paraleloAnfitrion}, ${fechaCorta(eventoA.fecha)}`;
    const estado = falto ? 'no_asistio' : nota.estado === 'calculada' ? 'realizada' : 'solicitada';
    filas.push({
      evento: propio.id, estudiante: estudiante.id, estado, nota: estado === 'realizada' ? nota.valor : null, motivo: 'justificada',
      detalle: estado === 'solicitada' ? `${donde} (nota pendiente)` : donde, fecha: null,
      vinculada: { evento: eventoA.id, visitante: v.id },
    });
  }
  return filas;
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
