// Lo registrado en la app, curso por curso, listo para escribir el Excel.
import { registrosDelCurso } from './consultas.js';
import { generarEventos } from '../nucleo/calendario.js';

/** [{ curso, reg, eventos }] de todos los cursos configurados. */
export async function cargarCursos(db, cfg) {
  return Promise.all(cfg.cursos.map(async (curso) => {
    const reg = await registrosDelCurso(db, curso.paralelo);
    return { curso, reg, eventos: generarEventos(cfg, curso, reg.cambios_evento) };
  }));
}
