// Aplica una lectura del Excel a la base local, sin tocar las evaluaciones.
import { ahoraISO } from '../db.js';

const CAMPOS_COMPARADOS = ['nombre', 'curso', 'estado', 'grupo_excel', 'observacion_excel', 'numero'];

/**
 * Compara la lectura con lo guardado. No escribe nada: sirve para mostrar qué cambiará.
 * Devuelve { cambios: [{ tipo, antes, despues }], resumen, porCurso }.
 */
export async function planificarImportacion(db, lectura) {
  const existentes = await db.estudiantes.toArray();
  const porId = new Map(existentes.map((e) => [e.id, e]));
  const vistos = new Set();
  const cambios = [];
  const porCurso = {};
  const contar = (curso, tipo) => {
    porCurso[curso] ??= { nuevos: 0, actualizados: 0, sin_cambios: 0, bajas: 0, reactivados: 0, total: 0, pendientes: 0 };
    porCurso[curso][tipo] += 1;
  };

  for (const [paralelo, curso] of Object.entries(lectura.cursos)) {
    for (const f of curso.estudiantes) {
      vistos.add(f.codigo);
      const despues = {
        id: f.codigo,
        codigo: f.codigo,
        nombre: f.nombre,
        curso: paralelo,
        estado: f.pendiente ? 'pendiente' : 'nomina',
        grupo_excel: f.grupo,
        observacion_excel: f.observacion,
        numero: f.numero,
      };
      contar(paralelo, 'total');
      if (f.pendiente) contar(paralelo, 'pendientes');
      const antes = porId.get(f.codigo);
      if (!antes) {
        cambios.push({ tipo: 'nuevo', despues });
        contar(paralelo, 'nuevos');
      } else if (CAMPOS_COMPARADOS.some((k) => (antes[k] ?? null) !== (despues[k] ?? null))) {
        const tipo = antes.estado === 'baja' ? 'reactivado' : 'actualizado';
        cambios.push({ tipo, antes, despues: { ...antes, ...despues } });
        contar(paralelo, tipo === 'reactivado' ? 'reactivados' : 'actualizados');
      } else {
        contar(paralelo, 'sin_cambios');
      }
    }
  }

  // Bajas: solo en cursos cuya hoja sí se leyó (un archivo incompleto no da de baja a nadie).
  for (const e of existentes) {
    if (lectura.cursos[e.curso] && !vistos.has(e.id) && e.estado !== 'baja') {
      cambios.push({ tipo: 'baja', antes: e, despues: { ...e, estado: 'baja' } });
      contar(e.curso, 'bajas');
    }
  }

  const resumen = { nuevos: 0, actualizados: 0, sin_cambios: 0, bajas: 0, reactivados: 0, total: 0, pendientes: 0 };
  for (const c of Object.values(porCurso)) for (const k of Object.keys(resumen)) resumen[k] += c[k];
  return { cambios, resumen, porCurso };
}

/** Guarda los estudiantes leídos del Excel. Devuelve el resumen de cambios. */
export async function aplicarExcelSemestre(db, lectura, { archivo = null, ahora = ahoraISO() } = {}) {
  return db.transaction('rw', db.estudiantes, db.importaciones, async () => {
    const plan = await planificarImportacion(db, lectura);
    const filas = plan.cambios.map((c) => ({ ...c.despues, actualizado: ahora }));
    if (filas.length) await db.estudiantes.bulkPut(filas);
    await db.importaciones.add({ fecha: ahora, tipo: 'excel_semestre', archivo, resumen: plan.resumen });
    return plan;
  });
}

/**
 * Registra la asistencia de la semana 1 (evento «PARALELO:INTRO»):
 * presente / no vino por estudiante y pase cerrado; si el curso no tuvo clase, la marca «sin clase».
 */
export async function aplicarAsistenciaSemana1(db, cfg, lectura, { archivo = null, ahora = ahoraISO() } = {}) {
  const actividad = cfg.excel.asistencia_semana1.actividad;
  const resumen = { cursos: 0, registros: 0, sin_clase: 0, desconocidos: 0 };
  const avisos = [];
  await db.transaction('rw', [db.estudiantes, db.asistencia, db.pases, db.cambios_evento, db.importaciones], async () => {
    const conocidos = new Set(await db.estudiantes.toCollection().primaryKeys());
    for (const [paralelo, curso] of Object.entries(lectura.cursos)) {
      const evento = `${paralelo}:${actividad}`;
      resumen.cursos += 1;
      if (curso.sin_clase) {
        await db.cambios_evento.put({ evento, estado: 'sin_clase', motivo: curso.sin_clase, fecha: ahora });
        resumen.sin_clase += 1;
        continue;
      }
      const filas = [];
      for (const f of curso.filas) {
        if (!conocidos.has(f.codigo)) {
          resumen.desconocidos += 1;
          avisos.push(`${paralelo}: el código ${f.codigo} no está en la app (lee primero el Excel del semestre).`);
          continue;
        }
        filas.push({ evento, estudiante: f.codigo, estado: f.estado, motivo: null, observacion: null, fecha: ahora });
      }
      await db.asistencia.bulkPut(filas);
      await db.pases.put({ evento, cerrado: true, cerrado_en: ahora, origen: 'asistencia_semana1' });
      resumen.registros += filas.length;
    }
    await db.importaciones.add({ fecha: ahora, tipo: 'asistencia_semana1', archivo, resumen });
  });
  return { resumen, avisos };
}
