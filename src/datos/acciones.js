// Escrituras de la clase: cada toque guarda su fila de inmediato (no hay botón «guardar»).
// `grupos` es el Map estudiante → grupo resuelto para el evento (gruposDelEvento); con él se crea la
// instantánea de grupos la primera vez que se registra algo de grupo en el evento.
import { ahoraISO } from '../db.js';
import { idVisitante } from '../nucleo/visitantes.js';

// ---------- Grupos ----------

/** Crea la instantánea de grupos del evento si aún no existe (dentro de una transacción). */
export async function asegurarInstantanea(db, evento, grupos, ahora = ahoraISO()) {
  await db.transaction('rw', db.grupos_evento, async () => {
    if (await db.grupos_evento.where('evento').equals(evento).count()) return;
    await db.grupos_evento.bulkPut([...grupos].map(([estudiante, grupo]) => ({ evento, estudiante, grupo: grupo ?? null, fecha: ahora })));
  });
}

/** Mueve a un estudiante a otro grupo (o a «sin grupo» con null). El cambio pasa a los eventos siguientes. */
export async function moverEstudiante(db, evento, grupos, estudiante, grupo, ahora = ahoraISO()) {
  await asegurarInstantanea(db, evento, grupos, ahora);
  await db.grupos_evento.put({ evento, estudiante, grupo: grupo ?? null, fecha: ahora });
}

// ---------- Evaluación del grupo ----------

export async function guardarPuntaje(db, evento, grupos, grupo, aspecto, valor, ahora = ahoraISO()) {
  await asegurarInstantanea(db, evento, grupos, ahora);
  if (valor === null || valor === undefined) await db.puntajes.delete([evento, grupo, aspecto]);
  else await db.puntajes.put({ evento, grupo, aspecto, valor, fecha: ahora });
}

export async function alternarEtiqueta(db, evento, grupos, grupo, etiqueta, ahora = ahoraISO()) {
  await asegurarInstantanea(db, evento, grupos, ahora);
  const clave = [evento, grupo, etiqueta];
  if (await db.etiquetas.get(clave)) await db.etiquetas.delete(clave);
  else await db.etiquetas.put({ evento, grupo, etiqueta, fecha: ahora });
}

/** Nota del profesor (escrita o dictada) de un grupo o de un estudiante. Vacía = se borra. */
export async function guardarNotaProfesor(db, evento, unidad, unidadId, texto, ahora = ahoraISO()) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) await db.notas.delete([evento, unidad, String(unidadId)]);
  else await db.notas.put({ evento, unidad, unidad_id: String(unidadId), texto: limpio, fecha: ahora });
}

/** Verificado (pase del grupo), trabajo firmado y penalización total con motivo. */
export async function revisarGrupo(db, evento, grupos, grupo, cambios, ahora = ahoraISO()) {
  await asegurarInstantanea(db, evento, grupos, ahora);
  await db.transaction('rw', db.revisiones_grupo, async () => {
    const actual = (await db.revisiones_grupo.get([evento, grupo])) ?? {
      evento, grupo, verificado: false, trabajo_firmado: false, penalizacion_total: false, motivo_penalizacion: null,
    };
    await db.revisiones_grupo.put({ ...actual, ...cambios, fecha: ahora });
  });
}

// ---------- Asistencia (pase final) ----------

/** Estado de asistencia de un estudiante (presente, no_vino, salio, se_retiro_antes; null = sin registro). */
export async function marcarAsistencia(db, evento, grupos, estudiante, estado, motivo = null, ahora = ahoraISO()) {
  if (grupos) await asegurarInstantanea(db, evento, grupos, ahora);
  await db.transaction('rw', db.asistencia, async () => {
    const actual = (await db.asistencia.get([evento, estudiante])) ?? { evento, estudiante, observacion: null };
    await db.asistencia.put({ ...actual, estado, motivo: estado === 'presente' ? null : motivo, fecha: ahora });
  });
}

/** Observación del estudiante en el evento (no cambia la nota por sí sola). */
export async function guardarObservacion(db, evento, estudiante, texto, ahora = ahoraISO()) {
  await db.transaction('rw', db.asistencia, async () => {
    const actual = (await db.asistencia.get([evento, estudiante])) ?? { evento, estudiante, estado: null, motivo: null };
    await db.asistencia.put({ ...actual, observacion: String(texto ?? '').trim() || null, fecha: ahora });
  });
}

/**
 * Cierra el pase: quien está en un grupo y no tiene registro queda presente; quien no quedó en
 * ningún grupo queda como «no vino» con el motivo indicado. Devuelve cuántos de cada uno.
 */
export async function cerrarPase(db, evento, grupos, motivoSinGrupo, ahora = ahoraISO()) {
  const conteo = { presentes: 0, sin_grupo: 0, ya_registrados: 0 };
  await db.transaction('rw', db.grupos_evento, db.asistencia, db.pases, async () => {
    await asegurarInstantanea(db, evento, grupos, ahora);
    const filas = new Map((await db.asistencia.where('evento').equals(evento).toArray()).map((f) => [f.estudiante, f]));
    const nuevas = [];
    for (const [estudiante, grupo] of grupos) {
      const f = filas.get(estudiante);
      if (f?.estado) { conteo.ya_registrados += 1; continue; }
      const sinGrupo = grupo === null || grupo === undefined;
      nuevas.push({
        ...(f ?? { evento, estudiante, observacion: null }),
        estado: sinGrupo ? 'no_vino' : 'presente',
        motivo: sinGrupo ? motivoSinGrupo : null,
        fecha: ahora,
      });
      conteo[sinGrupo ? 'sin_grupo' : 'presentes'] += 1;
    }
    if (nuevas.length) await db.asistencia.bulkPut(nuevas);
    await db.pases.put({ evento, cerrado: true, cerrado_en: ahora });
  });
  return conteo;
}

/** Reabre el pase para corregirlo (conserva lo registrado). */
export async function reabrirPase(db, evento, ahora = ahoraISO()) {
  const actual = (await db.pases.get(evento)) ?? { evento };
  await db.pases.put({ ...actual, cerrado: false, reabierto_en: ahora });
}

// ---------- Revisión del preparatorio en la puerta ----------

export async function marcarRevisionPreparatorio(db, evento, revisada, ahora = ahoraISO()) {
  await db.revision_preparatorio.put({ evento, revisada: Boolean(revisada), fecha: ahora });
}

/**
 * Novedad de la revisión en la puerta: nivel (1 incompleto, 0 no lo hizo; null en SQI), «no ingresa»
 * (queda como falta con el motivo del preparatorio) y observación.
 */
export async function guardarNovedad(db, evento, estudiante, { nivel = null, no_ingresa = false, observacion = null }, motivoNoIngresa, ahora = ahoraISO()) {
  await db.transaction('rw', db.novedades_preparatorio, db.asistencia, async () => {
    await db.novedades_preparatorio.put({ evento, estudiante, nivel, no_ingresa: Boolean(no_ingresa), observacion: observacion?.trim() || null, fecha: ahora });
    const a = await db.asistencia.get([evento, estudiante]);
    if (no_ingresa) {
      await db.asistencia.put({ ...(a ?? { evento, estudiante, observacion: null }), estado: 'no_vino', motivo: motivoNoIngresa, fecha: ahora });
    } else if (a?.estado === 'no_vino' && a.motivo === motivoNoIngresa) {
      await db.asistencia.put({ ...a, estado: null, motivo: null, fecha: ahora });
    }
  });
}

export async function borrarNovedad(db, evento, estudiante, motivoNoIngresa, ahora = ahoraISO()) {
  await db.transaction('rw', db.novedades_preparatorio, db.asistencia, async () => {
    await db.novedades_preparatorio.delete([evento, estudiante]);
    const a = await db.asistencia.get([evento, estudiante]);
    if (a?.estado === 'no_vino' && a.motivo === motivoNoIngresa) await db.asistencia.put({ ...a, estado: null, motivo: null, fecha: ahora });
  });
}

// ---------- Control oral ----------

/** Agrega estudiantes sorteados (o elegidos a mano) al control del evento. */
export async function agregarAlControl(db, evento, estudiantes, { manual = false } = {}, ahora = ahoraISO()) {
  await db.transaction('rw', db.controles, async () => {
    const actuales = await db.controles.where('evento').equals(evento).toArray();
    let orden = actuales.reduce((m, c) => Math.max(m, c.orden ?? 0), 0);
    for (const estudiante of estudiantes) {
      if (actuales.some((c) => c.estudiante === estudiante)) continue;
      await db.controles.put({ evento, estudiante, estado: 'sorteado', puntajes: [], aprobado: null, orden: ++orden, manual, fecha: ahora });
    }
  });
}

async function cambiarControl(db, evento, estudiante, f, ahora) {
  await db.transaction('rw', db.controles, async () => {
    const actual = await db.controles.get([evento, estudiante]);
    if (!actual) return;
    await db.controles.put({ ...actual, ...f(actual), fecha: ahora });
  });
}

/** Puntaje de la pregunta `indice` (Clásica, 0/1/2). Con null se quita esa pregunta. */
export async function puntuarPregunta(db, evento, estudiante, indice, puntaje, ahora = ahoraISO()) {
  await cambiarControl(db, evento, estudiante, (c) => {
    const p = [...(c.puntajes ?? [])];
    if (puntaje === null || puntaje === undefined) p.splice(indice, 1);
    else p[indice] = puntaje;
    const limpios = p.filter((x) => x !== null && x !== undefined);
    return { puntajes: limpios, estado: limpios.length ? 'respondio' : 'sorteado' };
  }, ahora);
}

/** SQI: aprobado (true), no aprobado (false) o sin responder (null). */
export async function aprobarControl(db, evento, estudiante, aprobado, ahora = ahoraISO()) {
  await cambiarControl(db, evento, estudiante, () => ({ aprobado, estado: aprobado === null ? 'sorteado' : 'respondio' }), ahora);
}

export async function marcarNoEsta(db, evento, estudiante, ahora = ahoraISO()) {
  await cambiarControl(db, evento, estudiante, () => ({ estado: 'no_esta' }), ahora);
}

/** «Salió»: el profesor le pidió salir. Queda como falta en el evento. */
export async function marcarSalio(db, evento, estudiante, motivo, ahora = ahoraISO()) {
  await db.transaction('rw', db.controles, db.asistencia, async () => {
    await cambiarControl(db, evento, estudiante, () => ({ estado: 'salio' }), ahora);
    const a = (await db.asistencia.get([evento, estudiante])) ?? { evento, estudiante, observacion: null };
    await db.asistencia.put({ ...a, estado: 'salio', motivo, fecha: ahora });
  });
}

/** Vuelve a «sorteado» (corrige un «no está» o un «salió» por error). */
export async function volverASorteado(db, evento, estudiante, motivoSalio, ahora = ahoraISO()) {
  await db.transaction('rw', db.controles, db.asistencia, async () => {
    await cambiarControl(db, evento, estudiante, (c) => ({ estado: (c.puntajes?.length || c.aprobado !== null) ? 'respondio' : 'sorteado' }), ahora);
    const a = await db.asistencia.get([evento, estudiante]);
    if (a?.estado === 'salio' && a.motivo === motivoSalio) await db.asistencia.put({ ...a, estado: null, motivo: null, fecha: ahora });
  });
}

/** Quita al estudiante del control de este evento (deshace el sorteo). */
export async function quitarDelControl(db, evento, estudiante, motivoSalio, ahora = ahoraISO()) {
  await db.transaction('rw', db.controles, db.asistencia, async () => {
    await db.controles.delete([evento, estudiante]);
    const a = await db.asistencia.get([evento, estudiante]);
    if (a?.estado === 'salio' && a.motivo === motivoSalio) await db.asistencia.put({ ...a, estado: null, motivo: null, fecha: ahora });
  });
}

// ---------- Retroalimentación de la práctica anterior (taller) ----------

/** Marca (o desmarca) que el grupo de la práctica ya recibió su retroalimentación en el taller `evento`. */
export async function marcarRetro(db, evento, grupo, dada, ahora = ahoraISO()) {
  if (dada) await db.retroalimentaciones.put({ evento, grupo: String(grupo), dada: true, fecha: ahora });
  else await db.retroalimentaciones.delete([evento, String(grupo)]);
}

// ---------- Feedback (Fase 7) ----------
// Una fila por evento y unidad (grupo, o estudiante en un TC individual) solo si el profesor editó el texto generado o
// lo copió. `base` es el texto generado al editar: si lo registrado cambia después, la app avisa.

async function cambiarFeedback(db, evento, unidad, unidadId, f, ahora) {
  const id = String(unidadId);
  await db.transaction('rw', db.feedback, async () => {
    const actual = (await db.feedback.get([evento, unidad, id])) ?? { evento, unidad, unidad_id: id, texto: null, base: null, copiado: null };
    await db.feedback.put({ ...actual, ...f(actual), fecha: ahora });
  });
}

/** Guarda el texto editado. Si queda igual al generado (o vacío), vuelve al generado. */
export async function guardarFeedback(db, evento, unidad, unidadId, texto, generado, ahora = ahoraISO()) {
  const limpio = String(texto ?? '').trim();
  const propio = limpio && limpio !== String(generado ?? '').trim();
  await cambiarFeedback(db, evento, unidad, unidadId, () => (propio ? { texto: limpio, base: generado } : { texto: null, base: null }), ahora);
}

/** Descarta lo editado: el texto vuelve a ser el generado con lo registrado. */
export async function restaurarFeedback(db, evento, unidad, unidadId, ahora = ahoraISO()) {
  await cambiarFeedback(db, evento, unidad, unidadId, () => ({ texto: null, base: null }), ahora);
}

/** Marca como copiados (o compartidos) los textos de una o varias unidades: [{ unidad, id }]. */
export async function marcarFeedbackCopiado(db, evento, unidades, ahora = ahoraISO()) {
  for (const u of unidades) await cambiarFeedback(db, evento, u.unidad, u.id, () => ({ copiado: ahora }), ahora);
}

// ---------- Trabajos en casa (TC) ----------
// Una fila por TC y unidad (`unidad` = 'grupo' con el número de grupo, o 'estudiante' con su id): si entregó,
// el puntaje de cada pregunta y las etiquetas marcadas. Los grupos son los de la práctica: no se crea instantánea.

async function cambiarTrabajo(db, evento, unidad, unidadId, f, ahora) {
  const id = String(unidadId);
  await db.transaction('rw', db.trabajos_casa, async () => {
    const actual = (await db.trabajos_casa.get([evento, unidad, id]))
      ?? { evento, unidad, unidad_id: id, entregado: true, puntajes: {}, etiquetas: [] };
    await db.trabajos_casa.put({ ...actual, ...f(actual), fecha: ahora });
  });
}

/** Puntaje de una pregunta (un toque por nivel). Calificar una pregunta deja el trabajo como entregado. */
export async function puntuarTrabajo(db, evento, unidad, unidadId, pregunta, valor, ahora = ahoraISO()) {
  await cambiarTrabajo(db, evento, unidad, unidadId, (t) => ({ entregado: true, puntajes: { ...t.puntajes, [pregunta]: valor } }), ahora);
}

/** Entregó (true) o no entregó (false, vale 0). Los puntajes se conservan por si fue un toque equivocado. */
export async function marcarEntrega(db, evento, unidad, unidadId, entregado, ahora = ahoraISO()) {
  await cambiarTrabajo(db, evento, unidad, unidadId, () => ({ entregado: Boolean(entregado) }), ahora);
}

/** Marca o desmarca una etiqueta rápida (error común de una pregunta). */
export async function alternarEtiquetaTrabajo(db, evento, unidad, unidadId, etiqueta, ahora = ahoraISO()) {
  await cambiarTrabajo(db, evento, unidad, unidadId, (t) => ({
    etiquetas: t.etiquetas.includes(etiqueta) ? t.etiquetas.filter((x) => x !== etiqueta) : [...t.etiquetas, etiqueta],
  }), ahora);
}

/** Borra lo registrado del TC de la unidad (la nota del profesor se conserva). */
export async function borrarTrabajo(db, evento, unidad, unidadId) {
  await db.trabajos_casa.delete([evento, unidad, String(unidadId)]);
}

// ---------- Calendario: sesiones sin clase (Fase 6) ----------
// Lo registrado en el evento no se borra: si se deshace el cambio, vuelve a contar.

/** Marca una sesión como «sin clase» (clase suspendida u otro motivo): sus actividades quedan excluidas en el curso. */
export async function marcarSinClase(db, evento, motivo, ahora = ahoraISO()) {
  const m = String(motivo ?? '').trim();
  if (!m) throw new Error('Escribe el motivo (por ejemplo, «Clase suspendida»).');
  await db.cambios_evento.put({ evento, estado: 'sin_clase', motivo: m, fecha: ahora });
}

/** Un feriado del calendario en el que sí hubo clase: la actividad vuelve a contar. */
export async function marcarHuboClase(db, evento, ahora = ahoraISO()) {
  await db.cambios_evento.put({ evento, estado: 'normal', motivo: 'hubo clase pese al calendario', fecha: ahora });
}

/** Deshace un cambio manual: el evento vuelve a lo que dice el calendario. */
export async function quitarCambioEvento(db, evento) {
  await db.cambios_evento.delete(evento);
}

// ---------- Recuperaciones (Fase 6) ----------

export const ESTADOS_RECUPERACION = ['solicitada', 'realizada', 'no_asistio'];

/**
 * Recuperación de un estudiante en otra sesión: `estado` solicitada · realizada (con `nota` 0–1) · no_asistio (0).
 * `motivo`: 'justificada' (falta con justificación) o 'feriado'. `detalle`: dónde y cuándo (texto libre).
 */
export async function guardarRecuperacion(db, evento, estudiante, { estado, nota = null, detalle = null, motivo = 'justificada' }, ahora = ahoraISO()) {
  if (!ESTADOS_RECUPERACION.includes(estado)) throw new Error(`Estado de recuperación desconocido: ${estado}`);
  if (estado === 'realizada' && !(nota >= 0 && nota <= 1)) throw new Error('La nota de la recuperación debe estar entre 0 y 10.');
  await db.recuperaciones.put({
    evento, estudiante, estado, nota: estado === 'realizada' ? nota : null, motivo,
    detalle: String(detalle ?? '').trim() || null, fecha: ahora,
  });
}

export async function borrarRecuperacion(db, evento, estudiante) {
  await db.recuperaciones.delete([evento, estudiante]);
}

// ---------- PLIC (Fase 6) ----------

/** PLIC de un estudiante: completó de forma válida (true), no válido (false) o sin registrar (null). */
export async function marcarPlic(db, evento, estudiante, valido, ahora = ahoraISO()) {
  if (valido === null || valido === undefined) await db.plic.delete([evento, estudiante]);
  else await db.plic.put({ evento, estudiante, completo_valido: Boolean(valido), fecha: ahora });
}

/** Marca a varios estudiantes de una vez (por ejemplo, a todos los que faltan como «completó»). */
export async function marcarPlicVarios(db, evento, estudiantes, valido, ahora = ahoraISO()) {
  await db.plic.bulkPut(estudiantes.map((estudiante) => ({ evento, estudiante, completo_valido: Boolean(valido), fecha: ahora })));
}

// ---------- Estudiantes de otros cursos que recuperan aquí (Fase 6) ----------

/**
 * Agrega a un estudiante de otro docente al grupo `grupo` del evento, para calificarlo con su grupo. Queda como
 * «visitante»: solo aparece en ese evento y no va al Excel. Devuelve su id.
 */
export async function agregarVisitante(db, evento, grupos, grupo, { codigo, nombre, paralelo = null, profesor = null }, ahora = ahoraISO()) {
  const datos = { codigo: String(codigo ?? '').trim(), nombre: limpiar(nombre).toUpperCase(), paralelo: limpiar(paralelo).toUpperCase() || null, profesor: limpiar(profesor) || null };
  if (!datos.codigo || !datos.nombre) throw new Error('Hacen falta el código y los apellidos y nombres.');
  if (Object.values(datos).some((v) => String(v ?? '').includes('@'))) throw new Error('La app no guarda correos.');
  const id = idVisitante(evento, datos.codigo);
  await db.estudiantes.put({
    id, codigo: datos.codigo, nombre: datos.nombre, curso: evento.split(':')[0], estado: 'visitante', grupo_excel: null, numero: null,
    observacion_excel: null, visita: { evento, paralelo: datos.paralelo, profesor: datos.profesor }, actualizado: ahora,
  });
  await moverEstudiante(db, evento, grupos, id, grupo, ahora);
  // Está en la sala para recuperar: queda presente (aunque el pase ya esté cerrado); se corrige como a cualquiera.
  await marcarAsistencia(db, evento, null, id, 'presente', null, ahora);
  return id;
}

/** Quita a un visitante del evento con todo lo que se le registró ahí. */
export async function quitarVisitante(db, evento, id) {
  const tablas = [db.estudiantes, db.grupos_evento, db.asistencia, db.controles, db.novedades_preparatorio, db.ajustes, db.notas, db.recuperaciones];
  await db.transaction('rw', tablas, async () => {
    await db.estudiantes.delete(id);
    for (const t of [db.grupos_evento, db.asistencia, db.controles, db.novedades_preparatorio, db.ajustes, db.recuperaciones]) await t.delete([evento, id]);
    await db.notas.delete([evento, 'estudiante', id]);
  });
}

const limpiar = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

// ---------- Ajuste individual ----------

/** Ajuste explícito de la nota del evento (0–1), siempre con motivo. */
export async function guardarAjuste(db, evento, estudiante, valor, motivo, ahora = ahoraISO()) {
  if (!String(motivo ?? '').trim()) throw new Error('El ajuste necesita un motivo.');
  if (!(valor >= 0 && valor <= 1)) throw new Error('La nota ajustada debe estar entre 0 y 10.');
  await db.ajustes.put({ evento, estudiante, valor, motivo: motivo.trim(), fecha: ahora });
}

export async function borrarAjuste(db, evento, estudiante) {
  await db.ajustes.delete([evento, estudiante]);
}
