// Lecturas agrupadas de la base para las pantallas y el motor de notas.
import { TABLAS_DE_EVENTO } from '../db.js';

/** Todo lo registrado de un curso: estudiantes y filas de cada tabla de evento con evento «PARALELO:…». */
export async function registrosDelCurso(db, paralelo) {
  const prefijo = `${paralelo}:`;
  const [estudiantes, ...tablas] = await Promise.all([
    db.estudiantes.where('curso').equals(paralelo).toArray(),
    ...TABLAS_DE_EVENTO.map((t) => db.table(t).where('evento').startsWith(prefijo).toArray()),
  ]);
  const reg = { estudiantes };
  TABLAS_DE_EVENTO.forEach((t, i) => { reg[t] = tablas[i]; });
  return reg;
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
