// Archivos en el navegador: elegir, leer, compartir (iPhone) o descargar (Mac), y cargar ExcelJS a pedido.

let promesaExcelJS;

/** ExcelJS pesa ~1 MB: se carga solo cuando hace falta leer o escribir un Excel. */
export function cargarExcelJS() {
  promesaExcelJS ??= new Promise((resolver, rechazar) => {
    if (window.ExcelJS) { resolver(window.ExcelJS); return; }
    const s = document.createElement('script');
    s.src = 'src/vendor/exceljs.min.js';
    s.onload = () => resolver(window.ExcelJS);
    s.onerror = () => { promesaExcelJS = null; rechazar(new Error('No se pudo cargar el lector de Excel.')); };
    document.head.append(s);
  });
  return promesaExcelJS;
}

export async function abrirLibro(buffer) {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

/** Abre el selector de archivos y devuelve el archivo elegido (o null si se cancela). */
export function elegirArchivo(accept) {
  return new Promise((resolver) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => { resolver(input.files?.[0] ?? null); input.remove(); }, { once: true });
    input.addEventListener('cancel', () => { resolver(null); input.remove(); }, { once: true });
    document.body.append(input);
    input.click();
  });
}

export const ACEPTA_EXCEL = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const ACEPTA_JSON = '.json,application/json';

/** En el celular abre la hoja de compartir (AirDrop); en la Mac descarga el archivo. */
export async function compartirODescargar(nombre, contenido, tipo = 'application/json') {
  const archivo = new File([contenido], nombre, { type: tipo });
  const tactil = window.matchMedia?.('(pointer: coarse)').matches;
  if (tactil && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return 'compartido';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelado';
    }
  }
  descargar(nombre, contenido, tipo);
  return 'descargado';
}

/** Descarga un archivo (en la Mac va a «Descargas»). */
export function descargar(nombre, contenido, tipo = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------- Carpeta del Excel (Chrome en la Mac: API de acceso a archivos) ----------

/** ¿El navegador puede guardar sobre un archivo existente? (Chrome en la Mac sí; Safari del iPhone no). */
export const puedeGuardarSobreArchivos = () => typeof window.showDirectoryPicker === 'function';

export function elegirCarpeta() {
  return window.showDirectoryPicker({ id: 'excel-lab-mn', mode: 'readwrite' });
}

/** Permiso de lectura y escritura sobre la carpeta; con `pedir`, lo solicita (requiere un toque del usuario). */
export async function permisoCarpeta(carpeta, pedir = false) {
  const opciones = { mode: 'readwrite' };
  if ((await carpeta.queryPermission(opciones)) === 'granted') return true;
  return pedir ? (await carpeta.requestPermission(opciones)) === 'granted' : false;
}

/** Archivos .xlsx de la carpeta (sin los temporales de Excel «~$…»). */
export async function excelsDeLaCarpeta(carpeta) {
  const nombres = [];
  for await (const [nombre, h] of carpeta.entries()) {
    if (h.kind === 'file' && /\.xlsx$/i.test(nombre) && !nombre.startsWith('~$')) nombres.push(nombre);
  }
  return nombres.sort((a, b) => a.localeCompare(b, 'es'));
}

/** ¿Está abierto en Excel? Excel deja un archivo «~$…» junto al libro mientras lo tiene abierto. */
export async function excelAbierto(carpeta, nombre) {
  for await (const [n, h] of carpeta.entries()) {
    if (h.kind === 'file' && n.startsWith('~$') && (n === `~$${nombre}` || n.slice(2) === nombre.slice(2))) return true;
  }
  return false;
}

// Fecha del último respaldo en este dispositivo (preferencia local; puede no estar disponible).
const CLAVE_RESPALDO = 'lab-mn:ultimo-respaldo';
export function leerUltimoRespaldo(base) {
  try { return localStorage.getItem(`${CLAVE_RESPALDO}:${base}`); } catch { return null; }
}
export function guardarUltimoRespaldo(base, fecha) {
  try { localStorage.setItem(`${CLAVE_RESPALDO}:${base}`, fecha); } catch { /* sin almacenamiento */ }
}
