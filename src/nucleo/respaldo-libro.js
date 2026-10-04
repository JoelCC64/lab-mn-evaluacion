// Respaldo del día en un solo archivo Excel, para subirlo a Drive:
// - legible: «Léeme» (con lo registrado hoy), una hoja por curso con las notas, «Asistencia (app)» y «Detalle (app)»;
// - restaurable: la hoja oculta «_respaldo» guarda el respaldo completo de la app (el mismo JSON de siempre).
// Funciona en el navegador y en Node: recibe ExcelJS y los datos ya cargados.

import { aplicarEscritura, planificarEscritura } from './excel-escritura.js';
import { crearContexto } from './motor.js';
import { estadoEvento } from './estado-evento.js';
import { avanceEvaluacion } from './motor-vista.js';
import { fechaCorta, hoyLocal } from './util.js';

export const HOJA_RESPALDO = '_respaldo';
const FORMATO = 'lab-mn-respaldo-xlsx';
const VERSION = 1;
const TROZO = 30000;   // caracteres por celda (Excel admite hasta 32 767)
const ARGB = { azul: 'FF1F3A5F', blanco: 'FFFFFFFF', gris: 'FF5A6270', ambar: 'FFFFF4D6' };

/**
 * Libro de respaldo. `cursos`: [{ curso, eventos, reg }]; `respaldo`: el objeto de exportarRespaldo.
 * Devuelve el libro de ExcelJS (falta escribirlo con wb.xlsx.writeBuffer()).
 */
export function crearLibroRespaldo(ExcelJS, cfg, cursos, respaldo, { hoy, demo = false }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'App Lab MN';
  wb.created = new Date(respaldo.creado);
  const leeme = wb.addWorksheet('Léeme', { properties: { tabColor: { argb: ARGB.azul } } });

  // Una hoja por curso con la misma forma que el Excel del semestre; la app llena sus columnas como en la Mac.
  for (const { curso, reg } of cursos) {
    const ws = wb.addWorksheet(curso.paralelo, { views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }] });
    ws.getCell(1, 1).value = `${curso.paralelo} · ${curso.metodologia === 'SQI' ? 'SQI' : 'Clásica'} · cronograma ${curso.cronograma}`;
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: ARGB.azul } };
    ws.getCell(2, 1).value = 'Copia de lectura del respaldo de la app (no es el Excel del semestre).';
    ws.getCell(2, 1).font = { italic: true, color: { argb: ARGB.gris } };
    ['N°', 'Código único', 'Apellidos y nombres'].forEach((t, i) => {
      const c = ws.getCell(4, i + 1);
      c.value = t;
      c.style = { font: { bold: true, color: { argb: ARGB.blanco } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.azul } } };
    });
    [5, 13, 40].forEach((ancho, i) => { ws.getColumn(i + 1).width = ancho; });
    const estudiantes = reg.estudiantes.filter((e) => e.estado !== 'baja')
      .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nombre.localeCompare(b.nombre, 'es'));
    estudiantes.forEach((e, i) => {
      const fila = ws.getRow(5 + i);
      fila.getCell(1).value = e.numero ?? i + 1;
      fila.getCell(2).value = e.codigo;
      fila.getCell(3).value = e.nombre;
      if (e.estado === 'pendiente') {
        for (let c = 1; c <= 3; c++) fila.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.ambar } };
      }
    });
  }
  const plan = planificarEscritura(wb, cfg, cursos, { hoy });
  aplicarEscritura(wb, cfg, plan, { app: respaldo.app, ahora: respaldo.creado, config: respaldo.config });
  wb.removeWorksheet(wb.getWorksheet(cfg.excel.escritura.hoja_control).id);   // la hoja de control no hace falta aquí

  escribirLeeme(leeme, cfg, cursos, respaldo, { hoy, demo });
  escribirDatos(wb, respaldo);
  return wb;
}

/** Lo registrado en un día: eventos de ese día o con algo guardado ese día (hora local). */
export function actividadDelDia(cfg, cursos, hoy) {
  const filas = [];
  for (const { curso, eventos, reg } of cursos) {
    const tocados = new Set();
    for (const [tabla, lista] of Object.entries(reg)) {
      if (tabla === 'estudiantes' || !Array.isArray(lista)) continue;
      for (const f of lista) if (f.evento && f.fecha && hoyLocal(new Date(f.fecha)) === hoy) tocados.add(f.evento);
    }
    const ctx = crearContexto(cfg, curso, eventos, reg);
    for (const e of eventos.filter((x) => tocados.has(x.id) || (x.fecha === hoy && x.sesion))) {
      const est = estadoEvento(e, reg, avanceEvaluacion(ctx, e));
      const asis = reg.asistencia.filter((a) => a.evento === e.id && a.estado);
      const faltas = asis.filter((a) => cfg.asistencia.estados[a.estado]?.falta).length;
      filas.push([curso.paralelo, `${e.codigo} · ${e.titulo}`, est.texto, est.detalle ?? null, asis.length ? asis.length - faltas : null, asis.length ? faltas : null]);
    }
  }
  return filas;
}

function escribirLeeme(ws, cfg, cursos, respaldo, { hoy, demo }) {
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 11;
  ws.getColumn(6).width = 9;
  const creado = new Date(respaldo.creado);
  const linea = (fila, texto, estilo = {}) => { const c = ws.getCell(fila, 1); c.value = texto; c.font = estilo; };
  linea(1, `Respaldo de la app Lab MN · ${respaldo.semestre}${demo ? ' · DEMOSTRACIÓN (datos ficticios)' : ''}`, { bold: true, size: 14, color: { argb: ARGB.azul } });
  linea(2, `Creado el ${fechaCorta(hoyLocal(creado))} a las ${creado.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} · app ${respaldo.app} · configuración ${respaldo.config}`, { italic: true, color: { argb: ARGB.gris } });
  linea(4, 'Este archivo tiene TODO lo registrado en la app hasta este momento: estudiantes, grupos, asistencia, evaluaciones y notas.');
  linea(5, 'Para recuperar todo (por ejemplo, si algo le pasa al celular o a la Mac): abre la app › Datos › «Restaurar un respaldo…» y elige este archivo.');
  linea(6, 'Las hojas de los cursos, «Asistencia (app)» y «Detalle (app)» son solo para leer; editarlas no cambia lo que se restaura.');
  const estudiantes = respaldo.tablas.estudiantes?.length ?? 0;
  const registros = Object.entries(respaldo.tablas)
    .filter(([t]) => !['estudiantes', 'importaciones', 'meta'].includes(t))
    .reduce((s, [, filas]) => s + filas.length, 0);
  linea(7, `Contiene ${estudiantes} estudiantes y ${registros} registros de clase.`);

  linea(9, `Registros del ${fechaCorta(hoy)}`, { bold: true, color: { argb: ARGB.azul } });
  const enc = ['Paralelo', 'Evento', 'Estado', 'Avance', 'Presentes', 'Faltas'];
  enc.forEach((t, i) => {
    const c = ws.getCell(10, i + 1);
    c.value = t;
    c.style = { font: { bold: true, color: { argb: ARGB.blanco } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.azul } } };
  });
  const filas = actividadDelDia(cfg, cursos, hoy);
  if (!filas.length) linea(11, 'Nada registrado este día.', { italic: true, color: { argb: ARGB.gris } });
  filas.forEach((valores, k) => valores.forEach((v, i) => { ws.getCell(11 + k, i + 1).value = v; }));
}

/** Guarda el respaldo completo en la hoja oculta, en trozos de texto (sin cortar caracteres ni dejar espacios en los bordes). */
function escribirDatos(wb, respaldo) {
  const ws = wb.addWorksheet(HOJA_RESPALDO, { state: 'veryHidden' });
  ws.getCell(1, 1).value = 'Datos completos de la app (no editar). Se restauran con «Datos › Restaurar un respaldo…».';
  ws.getCell(2, 1).value = 'formato';
  ws.getCell(2, 2).value = FORMATO;
  ws.getCell(2, 3).value = VERSION;
  const texto = escaparParaXml(JSON.stringify(respaldo));
  const trozos = [];
  for (let i = 0; i < texto.length;) {
    let fin = Math.min(i + TROZO, texto.length);
    const malo = (k) => /\s/.test(texto[k - 1]) || /\s/.test(texto[k]);
    while (fin < texto.length && fin > i + 1 && malo(fin)) fin -= 1;
    trozos.push(texto.slice(i, fin));
    i = fin;
  }
  ws.getCell(3, 1).value = 'trozos';
  ws.getCell(3, 2).value = trozos.length;
  trozos.forEach((t, k) => { ws.getCell(4 + k, 1).value = t; });
}

const BARRA = String.fromCharCode(92);

/**
 * Escribe como escapes de JSON (el JSON se lee igual) los caracteres que no conviene guardar tal cual en el
 * XML del Excel: U+FFFE y U+FFFF (no válidos en XML) y los pares sustitutos de los emojis, que la compresión del zip
 * puede partir en dos cuando corre en Node.
 */
function escaparParaXml(texto) {
  let r = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    r += c === 0xfffe || c === 0xffff || (c >= 0xd800 && c <= 0xdfff) ? `${BARRA}u${c.toString(16).padStart(4, '0')}` : texto[i];
  }
  return r;
}

/** Respaldo guardado en un libro de respaldo (objeto como el de exportarRespaldo), o null si el libro no es uno. */
export function leerRespaldoDeLibro(wb) {
  const ws = wb.getWorksheet(HOJA_RESPALDO);
  if (!ws) return null;
  if (ws.getCell(2, 2).value !== FORMATO) throw new Error('El Excel no es un respaldo de la app (formato desconocido).');
  if (ws.getCell(2, 3).value !== VERSION) throw new Error(`Respaldo en Excel de una versión que esta app no conoce (${ws.getCell(2, 3).value}).`);
  const n = Number(ws.getCell(3, 2).value);
  let texto = '';
  for (let k = 0; k < n; k++) {
    const v = ws.getCell(4 + k, 1).value;
    if (typeof v !== 'string') throw new Error('El respaldo en Excel está incompleto o fue editado.');
    texto += v;
  }
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error('El respaldo en Excel está dañado.');
  }
}
