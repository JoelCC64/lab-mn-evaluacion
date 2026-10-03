// Ayudas compartidas por las pruebas (Node).
import path from 'node:path';
import { leerConfigDisco, RAIZ } from '../scripts/lib/config-disco.mjs';

export { RAIZ };
export const DATOS_EJEMPLO = path.join(RAIZ, 'datos-ejemplo');
export const EXCEL_EJEMPLO = path.join(DATOS_EJEMPLO, 'Cursos_Lab_MN_2026B_EJEMPLO.xlsx');
export const ASISTENCIA_EJEMPLO = path.join(DATOS_EJEMPLO, 'Asistencia_Semana1_EJEMPLO.xlsx');

let cache;
/** Configuración real del semestre, leída del disco como la arma la app. */
export function configReal() {
  cache ??= leerConfigDisco().cfg;
  return cache;
}

/** Copia profunda para modificar la configuración en una prueba sin afectar a las demás. */
export function copia(x) {
  return structuredClone(x);
}
