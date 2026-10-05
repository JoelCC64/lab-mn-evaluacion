// CSV (RFC 4180) para abrir las tablas de la app en cualquier programa: separador coma, punto decimal, UTF-8 con BOM
// (para que Excel reconozca las tildes) y fin de línea CRLF. Las listas y los objetos van como JSON en su celda.

export const BOM = '﻿';

export function celdaCsv(v) {
  if (v === null || v === undefined) return '';
  const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(t) || /^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Columnas de una tabla: primero las de la clave y después las demás, en el orden en que aparecen. */
export function columnasCsv(filas, clave = []) {
  const columnas = [...clave];
  const vistas = new Set(columnas);
  for (const f of filas) {
    for (const k of Object.keys(f)) {
      if (!vistas.has(k)) { vistas.add(k); columnas.push(k); }
    }
  }
  return columnas;
}

/** Texto CSV de una tabla (con BOM). Una tabla vacía tiene solo los encabezados de la clave. */
export function tablaCsv(filas, clave = []) {
  const columnas = columnasCsv(filas, clave);
  const lineas = [columnas.map(celdaCsv).join(','), ...filas.map((f) => columnas.map((c) => celdaCsv(f[c])).join(','))];
  return `${BOM}${lineas.join('\r\n')}\r\n`;
}

/** Lee un CSV como el de tablaCsv: lista de filas, cada una con sus celdas como texto. */
export function leerCsv(texto) {
  const t = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const filas = [];
  let fila = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i += 1; } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(celda); celda = ''; } else if (c === '\r' && t[i + 1] === '\n') {
      fila.push(celda); filas.push(fila); fila = []; celda = ''; i += 1;
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}
