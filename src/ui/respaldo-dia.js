// Respaldo del día: un solo archivo Excel (legible y restaurable) para subir a Drive. También lee un respaldo
// (Excel o JSON) para restaurarlo, y lleva la cuenta de si hay registros sin respaldar en este dispositivo.
import { useEffect, useState } from '../vendor/preact-htm.js';
import { exportarRespaldo, nombreArchivoRespaldo } from '../datos/respaldo.js';
import { cargarCursos } from '../datos/excel-datos.js';
import { crearLibroRespaldo, leerRespaldoDeLibro } from '../nucleo/respaldo-libro.js';
import { hoyLocal } from '../nucleo/util.js';
import { abrirLibro, cargarExcelJS, compartirODescargar, guardarUltimoRespaldo, leerUltimoRespaldo } from './archivos.js';
import { VERSION_APP } from '../version.js';

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const ACEPTA_RESPALDO = `.xlsx,.json,application/json,${TIPO_XLSX}`;

/**
 * Crea el respaldo del día y abre la hoja de compartir (iPhone: Drive, Archivos, AirDrop) o lo descarga (Mac).
 * Devuelve { resultado: 'compartido' | 'descargado' | 'cancelado', nombre, creado }.
 */
export async function exportarRespaldoDelDia({ cfg, db, demo }) {
  const ExcelJS = await cargarExcelJS();
  const respaldo = await exportarRespaldo(db, { semestre: cfg.semestre.semestre, app: VERSION_APP, config: cfg.version });
  const wb = crearLibroRespaldo(ExcelJS, cfg, await cargarCursos(db, cfg), respaldo, { hoy: hoyLocal(), demo });
  const buffer = await wb.xlsx.writeBuffer();
  const nombre = nombreArchivoRespaldo(cfg.semestre.semestre + (demo ? '-demo' : ''), new Date(respaldo.creado), 'xlsx');
  const resultado = await compartirODescargar(nombre, buffer, TIPO_XLSX);
  if (resultado !== 'cancelado') marcarRespaldo(db.name, respaldo.creado);
  return { resultado, nombre, creado: respaldo.creado };
}

/** Lee un archivo de respaldo: el Excel del respaldo del día o el JSON (formato anterior). */
export async function leerArchivoDeRespaldo(archivo) {
  if (/\.xlsx$/i.test(archivo.name)) {
    const obj = leerRespaldoDeLibro(await abrirLibro(await archivo.arrayBuffer()));
    if (!obj) throw new Error('Ese Excel no es un respaldo de la app (no tiene la hoja de datos). ¿Es el Excel del semestre?');
    return obj;
  }
  try {
    return JSON.parse(await archivo.text());
  } catch {
    throw new Error('El archivo no es un respaldo de la app.');
  }
}

// ---------- ¿Hay registros sin respaldar? (preferencia local de este dispositivo) ----------

const CLAVE_CAMBIO = 'lab-mn:ultimo-cambio';
const EVENTO = 'lab-mn:respaldo';

function leer(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

/** Anota que la base cambió (lo llama la base después de cada escritura). */
export function marcarCambio(base) {
  try { localStorage.setItem(`${CLAVE_CAMBIO}:${base}`, new Date().toISOString()); } catch { /* sin almacenamiento */ }
  dispatchEvent(new Event(EVENTO));
}

/** Anota un respaldo exportado (o restaurado: los datos quedan iguales a un archivo). */
export function marcarRespaldo(base, fecha = new Date().toISOString()) {
  guardarUltimoRespaldo(base, fecha);
  dispatchEvent(new Event(EVENTO));
}

/** { ultimoRespaldo, ultimoCambio, pendiente } de esta base, actualizado al momento. */
export function useEstadoRespaldo(base) {
  const leerEstado = () => {
    const ultimoRespaldo = leerUltimoRespaldo(base);
    const ultimoCambio = leer(`${CLAVE_CAMBIO}:${base}`);
    return { ultimoRespaldo, ultimoCambio, pendiente: Boolean(ultimoCambio && (!ultimoRespaldo || ultimoCambio > ultimoRespaldo)) };
  };
  const [estado, setEstado] = useState(leerEstado);
  useEffect(() => {
    let espera = null;
    const f = () => { clearTimeout(espera); espera = setTimeout(() => setEstado(leerEstado()), 300); };
    addEventListener(EVENTO, f);
    return () => { removeEventListener(EVENTO, f); clearTimeout(espera); };
  }, [base]);
  return estado;
}
