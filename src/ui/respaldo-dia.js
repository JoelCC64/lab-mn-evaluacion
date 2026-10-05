// Respaldo del día: un solo archivo Excel (legible y restaurable) para subir a Drive. Respaldo completo: un .zip con el
// JSON y un CSV por tabla. También lee un respaldo (Excel, .zip o JSON) para restaurarlo, y lleva la cuenta de si hay
// registros sin respaldar en este dispositivo (y desde cuándo, para el recordatorio).
import { useEffect, useState } from '../vendor/preact-htm.js';
import { exportarRespaldo, nombreArchivoRespaldo, selloDeFecha } from '../datos/respaldo.js';
import { cargarCursos } from '../datos/excel-datos.js';
import { leerProfesor } from '../datos/local.js';
import { crearLibroRespaldo, leerRespaldoDeLibro } from '../nucleo/respaldo-libro.js';
import { archivosDelRespaldo, recordatorioDeRespaldo, respaldoDeZip } from '../nucleo/respaldo-completo.js';
import { comprimirEnNavegador, crearZip, inflarEnNavegador } from '../nucleo/zip.js';
import { hoyLocal } from '../nucleo/util.js';
import { abrirLibro, cargarExcelJS, compartirODescargar, guardarUltimoRespaldo, leerUltimoRespaldo } from './archivos.js';
import { VERSION_APP } from '../version.js';

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const ACEPTA_RESPALDO = `.xlsx,.zip,.json,application/json,application/zip,${TIPO_XLSX}`;

/**
 * Crea el respaldo del día y abre la hoja de compartir (iPhone: Drive, Archivos, AirDrop) o lo descarga (Mac).
 * Devuelve { resultado: 'compartido' | 'descargado' | 'cancelado', nombre, creado }.
 */
export async function exportarRespaldoDelDia({ cfg, db, demo }) {
  const ExcelJS = await cargarExcelJS();
  const respaldo = await exportarRespaldo(db, { semestre: cfg.semestre.semestre, app: VERSION_APP, config: cfg.version });
  const wb = crearLibroRespaldo(ExcelJS, cfg, await cargarCursos(db, cfg), respaldo, { hoy: hoyLocal(), demo, profesor: await leerProfesor(db) });
  const buffer = await wb.xlsx.writeBuffer();
  const nombre = nombreArchivoRespaldo(cfg.semestre.semestre + (demo ? '-demo' : ''), new Date(respaldo.creado), 'xlsx');
  const resultado = await compartirODescargar(nombre, buffer, TIPO_XLSX);
  if (resultado !== 'cancelado') marcarRespaldo(db.name, respaldo.creado);
  return { resultado, nombre, creado: respaldo.creado };
}

/**
 * Respaldo completo, listo para compartir o guardar: { nombre, blob, tipo, creado }. Un .zip con el JSON (restaurable)
 * y un CSV por tabla, con la fecha en los nombres.
 */
export async function prepararRespaldoCompleto({ cfg, db, demo }) {
  const respaldo = await exportarRespaldo(db, { semestre: cfg.semestre.semestre, app: VERSION_APP, config: cfg.version });
  const fecha = new Date(respaldo.creado);
  const base = nombreArchivoRespaldo(cfg.semestre.semestre + (demo ? '-demo' : ''), fecha, 'zip').replace(/\.zip$/, '');
  const archivos = archivosDelRespaldo(respaldo, { base, sello: selloDeFecha(fecha), demo });
  const zip = await crearZip(archivos, { comprimir: comprimirEnNavegador, fecha });
  return { nombre: `${base}.zip`, blob: new Blob([zip], { type: 'application/zip' }), tipo: 'application/zip', creado: respaldo.creado };
}

/** Lee un archivo de respaldo: el Excel del respaldo del día, el .zip del respaldo completo o un JSON. */
export async function leerArchivoDeRespaldo(archivo) {
  if (/\.zip$/i.test(archivo.name)) return respaldoDeZip(new Uint8Array(await archivo.arrayBuffer()), inflarEnNavegador);
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
const CLAVE_PRIMER_CAMBIO = 'lab-mn:primer-cambio';   // el primero después del último respaldo
const EVENTO = 'lab-mn:respaldo';

function leer(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

/** Anota que la base cambió (lo llama la base después de cada escritura). */
export function marcarCambio(base) {
  const ahora = new Date().toISOString();
  try {
    const respaldo = leerUltimoRespaldo(base);
    const primero = leer(`${CLAVE_PRIMER_CAMBIO}:${base}`);
    if (!primero || (respaldo && primero <= respaldo)) localStorage.setItem(`${CLAVE_PRIMER_CAMBIO}:${base}`, ahora);
    localStorage.setItem(`${CLAVE_CAMBIO}:${base}`, ahora);
  } catch { /* sin almacenamiento */ }
  dispatchEvent(new Event(EVENTO));
}

/** Anota un respaldo exportado (o restaurado: los datos quedan iguales a un archivo). */
export function marcarRespaldo(base, fecha = new Date().toISOString()) {
  guardarUltimoRespaldo(base, fecha);
  dispatchEvent(new Event(EVENTO));
}

/**
 * { ultimoRespaldo, ultimoCambio, pendiente, dias, vencido } de esta base, actualizado al momento. `limite`: los días
 * sin respaldar a partir de los cuales el recordatorio es urgente (config/respaldo.json).
 */
export function useEstadoRespaldo(base, limite = Infinity) {
  const leerEstado = () => {
    const ultimoRespaldo = leerUltimoRespaldo(base);
    const ultimoCambio = leer(`${CLAVE_CAMBIO}:${base}`);
    const primerCambio = leer(`${CLAVE_PRIMER_CAMBIO}:${base}`);
    return { ultimoRespaldo, ultimoCambio, ...recordatorioDeRespaldo({ ultimoRespaldo, ultimoCambio, primerCambio }, { limite }) };
  };
  const [estado, setEstado] = useState(leerEstado);
  useEffect(() => {
    let espera = null;
    const f = () => { clearTimeout(espera); espera = setTimeout(() => setEstado(leerEstado()), 300); };
    setEstado(leerEstado());
    addEventListener(EVENTO, f);
    document.addEventListener('visibilitychange', f);   // la app vuelve a primer plano (quizá otro día)
    return () => { removeEventListener(EVENTO, f); document.removeEventListener('visibilitychange', f); clearTimeout(espera); };
  }, [base, limite]);
  return estado;
}
