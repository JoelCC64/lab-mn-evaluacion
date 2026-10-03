// Lectura mínima de un .xlsx como zip: lista de partes y contenido de una parte. Sirve para revisar,
// antes de escribir, si el Excel tiene algo que la librería de escritura no sabe conservar.
// `inflar(bytes)` descomprime deflate sin cabecera: en el navegador con DecompressionStream, en Node con zlib.

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
