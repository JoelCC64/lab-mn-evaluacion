// Estado de un evento para la navegación: feriado, sin clase, pendiente, en curso, pase hecho, evaluado.
import { TABLAS_REGISTRO } from './tablas.js';

/**
 * `evaluacion` (opcional, del motor): { grupos, evaluados } para mostrar «evaluado» y el avance.
 * Devuelve { clave, texto, tono, detalle }.
 */
export function estadoEvento(evento, reg, evaluacion = null) {
  if (evento.estado === 'feriado') return { clave: 'feriado', texto: 'Feriado', tono: 'aviso', detalle: evento.motivo };
  if (evento.estado === 'sin_clase') return { clave: 'sin_clase', texto: 'Sin clase', tono: 'aviso', detalle: evento.motivo };
  const completo = evaluacion && evaluacion.grupos > 0 && evaluacion.evaluados === evaluacion.grupos;
  const avance = evaluacion && evaluacion.grupos > 0 ? `${evaluacion.evaluados}/${evaluacion.grupos} ${evaluacion.nombre ?? 'grupos'}` : null;
  if (evento.tipo === 'trabajo_casa') {
    // Un TC no tiene pase propio: está calificado cuando todas sus unidades por calificar tienen nota.
    if (!evento.con_nota) return { clave: 'sin_nota', texto: 'Sin nota', tono: '', detalle: null };
    if (completo) return { clave: 'evaluado', texto: 'Calificado', tono: 'ok', detalle: avance };
    if ((reg.trabajos_casa ?? []).some((f) => f.evento === evento.id)) return { clave: 'en_curso', texto: 'En curso', tono: 'info', detalle: avance };
    return { clave: 'pendiente', texto: 'Pendiente', tono: '', detalle: null };
  }
  const pase = reg.pases.find((p) => p.evento === evento.id && p.cerrado);
  if (pase && (completo || !evaluacion)) {
    return { clave: completo ? 'evaluado' : 'pase_hecho', texto: completo ? 'Evaluado' : 'Pase hecho', tono: 'ok', detalle: avance };
  }
  if (pase) return { clave: 'pase_hecho', texto: 'Pase hecho', tono: 'ok', detalle: avance };
  const hayAlgo = TABLAS_REGISTRO.some((t) => (reg[t] ?? []).some((f) => f.evento === evento.id));
  if (hayAlgo) return { clave: 'en_curso', texto: 'En curso', tono: 'info', detalle: avance };
  return { clave: 'pendiente', texto: 'Pendiente', tono: '', detalle: null };
}
