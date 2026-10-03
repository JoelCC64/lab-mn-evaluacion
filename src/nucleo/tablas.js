// Nombres de las tablas con registros de un evento (sin dependencias, para el núcleo).
// La definición completa de la base está en src/db.js.

/** Tablas que indican que en un evento ya se registró algo (excluye los cambios de calendario). */
export const TABLAS_REGISTRO = [
  'grupos_evento', 'asistencia', 'pases', 'revisiones_grupo', 'puntajes', 'etiquetas', 'notas',
  'controles', 'revision_preparatorio', 'novedades_preparatorio', 'ajustes',
];
