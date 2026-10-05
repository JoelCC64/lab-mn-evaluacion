// Zip mínimo:
// - lectura de un .xlsx (lista de partes y contenido de una parte), para revisar antes de escribir si el Excel tiene algo
//   que la librería de escritura no sabe conservar, y para leer el respaldo completo (.zip);
// - escritura del respaldo completo (Fase 9).
// `inflar(bytes)` y `comprimir(bytes)` usan deflate sin cabecera: en el navegador con DecompressionStream y
// CompressionStream, en Node con zlib.

const leer16 = (b, i) => b[i] | (b[i + 1] << 8);
const leer32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Partes del zip, leídas del directorio central: [{ nombre, metodo, comprimido, tamano, inicioLocal }]. */
export function entradasZip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Fin del directorio central: firma 0x06054b50, dentro de los últimos 64 KB + 22 bytes.
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (leer32(b, i) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no es un .xlsx válido (no es un zip).');
  const total = leer16(b, fin + 10);
  let p = leer32(b, fin + 16);
  const entradas = [];
  for (let k = 0; k < total; k++) {
    if (leer32(b, p) !== 0x02014b50) throw new Error('El archivo .xlsx está dañado (directorio del zip).');
    const n = leer16(b, p + 28), extra = leer16(b, p + 30), comentario = leer16(b, p + 32);
    entradas.push({
      nombre: new TextDecoder().decode(b.subarray(p + 46, p + 46 + n)),
      metodo: leer16(b, p + 10),
      comprimido: leer32(b, p + 20),
      tamano: leer32(b, p + 24),
      inicioLocal: leer32(b, p + 42),
    });
    p += 46 + n + extra + comentario;
  }
  return entradas;
}

/** Contenido (texto) de una parte del zip. */
export async function leerParteZip(bytes, entrada, inflar) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const p = entrada.inicioLocal;
  if (leer32(b, p) !== 0x04034b50) throw new Error(`El archivo .xlsx está dañado (${entrada.nombre}).`);
  const inicio = p + 30 + leer16(b, p + 26) + leer16(b, p + 28);
  const datos = b.subarray(inicio, inicio + entrada.comprimido);
  const crudo = entrada.metodo === 0 ? datos : await inflar(datos);
  return new TextDecoder().decode(crudo);
}

/** Descompresión en el navegador (Chrome 103+, Safari 16.4+). */
export async function inflarEnNavegador(datos) {
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Compresión en el navegador (Chrome 80+, Safari 16.4+). */
export async function comprimirEnNavegador(datos) {
  const flujo = new Blob([datos]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

let tablaCrc = null;

/** CRC-32 (el del formato zip). */
export function crc32(bytes) {
  tablaCrc ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = tablaCrc[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Arma un .zip con `archivos` [{ nombre, contenido (texto o bytes) }]. Con `comprimir`, cada archivo va comprimido si
 * así ocupa menos; sin ella, va tal cual. `fecha`: la de los archivos, en hora local. Devuelve los bytes del zip.
 */
export async function crearZip(archivos, { comprimir = null, fecha = new Date() } = {}) {
  const utf8 = new TextEncoder();
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  const partes = [];
  const directorio = [];
  let posicion = 0;
  for (const a of archivos) {
    const nombre = utf8.encode(a.nombre);
    const datos = typeof a.contenido === 'string' ? utf8.encode(a.contenido) : new Uint8Array(a.contenido);
    const crc = crc32(datos);
    let metodo = 0;
    let guardado = datos;
    if (comprimir) {
      const z = await comprimir(datos);
      if (z.length < datos.length) { metodo = 8; guardado = z; }
    }
    // Campos comunes de la cabecera local y del directorio central: versión 2.0, nombres en UTF-8 (bit 11), método,
    // fecha y hora, CRC, tamaños y largo del nombre.
    const comunes = (v, i) => {
      v.setUint16(i, 20, true);
      v.setUint16(i + 2, 0x0800, true);
      v.setUint16(i + 4, metodo, true);
      v.setUint16(i + 6, hora, true);
      v.setUint16(i + 8, dia, true);
      v.setUint32(i + 10, crc, true);
      v.setUint32(i + 14, guardado.length, true);
      v.setUint32(i + 18, datos.length, true);
      v.setUint16(i + 22, nombre.length, true);
    };
    const local = new Uint8Array(30 + nombre.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    comunes(vl, 4);
    local.set(nombre, 30);
    const central = new Uint8Array(46 + nombre.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    comunes(vc, 6);
    vc.setUint32(42, posicion, true);
    central.set(nombre, 46);
    partes.push(local, guardado);
    directorio.push(central);
    posicion += local.length + guardado.length;
  }
  const largoDirectorio = directorio.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, archivos.length, true);
  vf.setUint16(10, archivos.length, true);
  vf.setUint32(12, largoDirectorio, true);
  vf.setUint32(16, posicion, true);
  const zip = new Uint8Array(posicion + largoDirectorio + fin.length);
  let p = 0;
  for (const x of [...partes, ...directorio, fin]) { zip.set(x, p); p += x.length; }
  return zip;
}

// Partes que la librería de escritura (ExcelJS) no conserva: si el Excel las tiene, no se escribe.
const NO_SE_CONSERVAN = [
  [/^xl\/charts\//, 'gráficos'],
  [/^xl\/drawings\/drawing\d+\.xml$/, 'dibujos, imágenes o formas'],
  [/^xl\/pivot(Tables|Cache)\//, 'tablas dinámicas'],
  [/^xl\/tables\//, 'tablas de Excel (Insertar › Tabla)'],
  [/^xl\/externalLinks\//, 'vínculos a otros libros'],
  [/vbaProject\.bin$/, 'macros'],
  [/^xl\/(slicers|slicerCaches|timelines|timelineCaches)\//, 'segmentaciones o escalas de tiempo'],
  [/^xl\/threadedComments\//, 'comentarios con respuestas'],
  [/^xl\/(embeddings|activeX|ctrlProps)\//, 'objetos incrustados o controles'],
  [/^xl\/model\//, 'modelo de datos'],
];
// Partes que se pierden sin afectar las celdas: se avisa, pero se puede escribir.
const SE_PIERDEN = [
  [/^docProps\/custom\.xml$/, 'propiedades personalizadas del archivo (por ejemplo, una etiqueta de confidencialidad)'],
  [/^customXml\//, 'datos XML personalizados'],
  [/^xl\/printerSettings\//, 'la configuración de la impresora'],
  [/^xl\/comments\d+\.xml$/, 'el tamaño de los cuadros de las notas de celda (el texto de las notas se conserva)'],
];
// Funciones de Excel 2010+ guardadas en extLst de las hojas, que la librería descarta.
const EXT_HOJA = [
  [/<x14:conditionalFormatting/, 'formato condicional avanzado (barras de datos, conjuntos de iconos)'],
  [/<x14:dataValidations/, 'validaciones de datos que usan otras hojas'],
  [/<x14:sparklineGroups/, 'minigráficos'],
];

/**
 * Revisa lo que tiene el Excel antes de escribir.
 * Devuelve { bloqueos: [texto], avisos: [texto] }: con bloqueos, la app no debe escribir el archivo.
 */
export async function revisarPartesExcel(bytes, inflar) {
  const entradas = entradasZip(bytes);
  const bloqueos = new Set(), avisos = new Set();
  for (const e of entradas) {
    for (const [re, texto] of NO_SE_CONSERVAN) if (re.test(e.nombre)) bloqueos.add(texto);
    for (const [re, texto] of SE_PIERDEN) if (re.test(e.nombre)) avisos.add(texto);
  }
  for (const e of entradas.filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x.nombre))) {
    const xml = await leerParteZip(bytes, e, inflar);
    if (!xml.includes('<extLst')) continue;
    for (const [re, texto] of EXT_HOJA) if (re.test(xml)) bloqueos.add(texto);
  }
  return { bloqueos: [...bloqueos], avisos: [...avisos], partes: entradas.length };
}
