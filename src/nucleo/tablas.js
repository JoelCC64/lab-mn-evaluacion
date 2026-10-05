// Nombres y claves de las tablas (sin dependencias, para el núcleo). La definición completa de la base está en src/db.js.

/** Tablas que indican que en un evento ya se registró algo (excluye los cambios de calendario). */
export const TABLAS_REGISTRO = [
  'grupos_evento', 'asistencia', 'pases', 'revisiones_grupo', 'puntajes', 'etiquetas', 'notas',
  'controles', 'revision_preparatorio', 'novedades_preparatorio', 'ajustes', 'retroalimentaciones', 'trabajos_casa',
  'recuperaciones', 'plic', 'feedback',
];

/** Tablas cuyas filas pertenecen a un evento (clave o índice «evento» = «PARALELO:CÓDIGO»). */
export const TABLAS_DE_EVENTO = [...TABLAS_REGISTRO, 'cambios_evento'];

/**
 * Campos de la clave primaria de cada tabla (los mismos de TABLAS en src/db.js; una prueba lo comprueba). Sirven para
 * reconocer la misma fila en dos dispositivos y para ordenar las columnas de los CSV.
 */
export const CLAVES = {
  estudiantes: ['id'],
  grupos_evento: ['evento', 'estudiante'],
  asistencia: ['evento', 'estudiante'],
  pases: ['evento'],
  revisiones_grupo: ['evento', 'grupo'],
  puntajes: ['evento', 'grupo', 'aspecto'],
  etiquetas: ['evento', 'grupo', 'etiqueta'],
  notas: ['evento', 'unidad', 'unidad_id'],
  controles: ['evento', 'estudiante'],
  revision_preparatorio: ['evento'],
  novedades_preparatorio: ['evento', 'estudiante'],
  ajustes: ['evento', 'estudiante'],
  retroalimentaciones: ['evento', 'grupo'],
  trabajos_casa: ['evento', 'unidad', 'unidad_id'],
  recuperaciones: ['evento', 'estudiante'],
  plic: ['evento', 'estudiante'],
  feedback: ['evento', 'unidad', 'unidad_id'],
  cambios_evento: ['evento'],
  importaciones: ['id'],
  meta: ['clave'],
};
