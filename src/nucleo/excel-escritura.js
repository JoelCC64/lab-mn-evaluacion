// Escritura en el Excel del semestre (Fase 3, Anexo J.2) sobre un libro de ExcelJS ya abierto.
// - La app solo escribe en sus zonas: sus columnas en cada hoja de curso (a la derecha de las columnas
//   existentes, tras una columna vacía) y sus hojas propias, que se reescriben completas.
// - Cada estudiante se ubica por su código, nunca por la posición de la fila.
// - La hoja oculta «_app» guarda lo último que la app escribió en cada celda de sus columnas y las celdas
//   que Joel decidió conservar («fijadas»). Así se detectan las ediciones a mano.
// Funciona igual en el navegador y en Node: recibe el libro ya abierto, no importa ExcelJS.

import { buscarEncabezados, textoCodigo, valorCelda } from './excel-lectura.js';
import { huella, limpiarTexto, normalizar, redondear } from './util.js';
import {
  COLUMNAS_DETALLE, asistenciaPorSemana, columnasDeLaApp, contextoConFijadas, eventosDelDetalle, filaDetalle,
  grupoActual, semanasConSesion, valoresDelEstudiante,
} from './resultados.js';

export const FORMATO_CONTROL = 1;
const ARGB = {
  zona: 'FF2F5D50', blanco: 'FFFFFFFF', franja: 'FFE3F1EC', azul: 'FF1F3A5F', gris: 'FF5A6270', ambar: 'FFFFF4D6',
};
const FILA_ENCABEZADOS_PROPIAS = 4;

/** Valor de una celda listo para comparar: números a 4 decimales, textos sin espacios de más, vacío = null. */
export function normal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? redondear(v, 4) : null;
  if (typeof v === 'boolean') return v ? 'VERDADERO' : 'FALSO';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = String(v).replace(/\s+/g, ' ').trim();
  if (t === '') return null;
  if (/^-?\d+([.,]\d+)?$/.test(t)) return redondear(Number(t.replace(',', '.')), 4);
  return t;
}

export const claveCelda = (hoja, codigo, clave) => `${hoja}|${codigo}|${clave}`;
const esNotaSobreDiez = (v) => typeof v === 'number' && v >= 0 && v <= 10;
const clonar = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

/** JSON con las claves ordenadas: dos estilos iguales dan el mismo texto aunque la librería cambie el orden. */
function estable(x) {
  if (Array.isArray(x)) return `[${x.map(estable).join(',')}]`;
  if (x && typeof x === 'object' && !(x instanceof Date)) {
    return `{${Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${estable(x[k])}`).join(',')}}`;
  }
  return JSON.stringify(x ?? null);
}

/** Letra de una columna (1 → A, 27 → AA). */
export function letra(n) {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function hojaDelCurso(wb, paralelo) {
  return wb.worksheets.find((ws) => limpiarTexto(ws.name).toUpperCase() === paralelo) ?? null;
}

/** Última columna usada en la hoja (con valor, con formato o con ancho propio). */
function ultimaColumna(ws) {
  let max = 0;
  ws.eachRow({ includeEmpty: true }, (fila) => { max = Math.max(max, fila.cellCount); });
  (ws.columns ?? []).forEach((col, i) => { if (col?.width !== undefined) max = Math.max(max, i + 1); });
  return max;
}

// ---------- Hoja de control «_app» ----------

/** Lee la hoja de control: { existe, formato, escrito, escritas: Map, fijadas: Map, huellas: Map }. */
export function leerControl(wb, cfg) {
  const ws = wb.getWorksheet(cfg.excel.escritura.hoja_control);
  const control = { existe: Boolean(ws), formato: null, escrito: null, escritas: new Map(), fijadas: new Map(), huellas: new Map() };
  if (!ws) return control;
  let enTabla = false;
  ws.eachRow((fila) => {
    const celda = (i) => valorCelda(fila.getCell(i));
    if (!enTabla) {
      const k = celda(1);
      if (k === 'formato') control.formato = celda(2);
      else if (k === 'escrito') control.escrito = celda(2);
      else if (k === 'tipo') enTabla = true;
      return;
    }
    const tipo = celda(1);
    if (tipo === 'huella') control.huellas.set(String(celda(2)), String(celda(5)));
    else if (tipo === 'celda' || tipo === 'fijada') {
      const k = claveCelda(celda(2), textoCodigo(celda(3)), celda(4));
      control[tipo === 'celda' ? 'escritas' : 'fijadas'].set(k, celda(5));
    }
  });
  return control;
}

// ---------- Zona de la app en una hoja de curso ----------

/**
 * Ubica la zona de la app: la columna con «Grupo actual» en la fila de encabezados; si no existe,
 * la primera escritura la pone después de la última columna usada, dejando una vacía.
 * Devuelve { enc, colCodigo, inicio, nueva, filas: Map(código → n.° de fila), repetidos } o { error }.
 */
export function ubicarZona(ws, cfg, columnas) {
  const enc = buscarEncabezados(ws, cfg.excel);
  if (!enc) return { error: 'no se encontró la fila de encabezados.' };
  const filaEnc = ws.getRow(enc.fila);
  const texto = (c) => normalizar(valorCelda(filaEnc.getCell(c)) ?? '');
  const max = ultimaColumna(ws);
  let inicio = null;
  for (let c = 1; c <= max; c++) if (texto(c) === normalizar(columnas[0].encabezado)) { inicio = c; break; }
  const nueva = inicio === null;
  if (nueva) inicio = max + 2;
  else {
    const i = columnas.findIndex((col, k) => texto(inicio + k) !== normalizar(col.encabezado));
    if (i >= 0) {
      return { error: `las columnas de la app no tienen la forma esperada: en ${letra(inicio + i)}${enc.fila} debería decir «${columnas[i].encabezado}». Revisa si se movió o renombró una columna.` };
    }
  }
  const filas = new Map();
  const repetidos = [];
  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const codigo = textoCodigo(valorCelda(ws.getRow(r).getCell(enc.columnas.codigo)));
    if (!codigo) continue;
    if (filas.has(codigo)) repetidos.push(codigo);
    else filas.set(codigo, r);
  }
  for (const c of repetidos) filas.delete(c);
  return { enc, colCodigo: enc.columnas.codigo, inicio, nueva, filas, repetidos };
}

// ---------- Plan de escritura ----------

/**
 * Prepara la escritura sin modificar el libro.
 * `cursos`: [{ curso, eventos, reg }] con lo registrado en la app. `decisiones`: Map(clave de celda →
 * 'conservar' | 'reemplazar') para las celdas editadas a mano. Devuelve el plan con las celdas de cada
 * hoja, los conflictos aún sin decidir, avisos, errores y el contenido de las hojas propias.
 */
export function planificarEscritura(wb, cfg, cursos, { hoy, decisiones = new Map() } = {}) {
  const esc = cfg.excel.escritura;
  const control = leerControl(wb, cfg);
  const plan = {
    hojas: [], propias: [], conflictos: [], bloqueos: [], avisos: [], errores: [], sinFila: [], sinApp: [], repetidos: [],
    control, celdasQueCambian: 0, sinCambios: false,
  };
  if (control.existe && control.formato !== FORMATO_CONTROL) {
    plan.bloqueos.push(`La hoja «${esc.hoja_control}» tiene un formato que esta versión de la app no conoce (${control.formato}). Actualiza la app antes de escribir.`);
  }
  const contextos = [];

  for (const { curso, eventos, reg } of cursos) {
    const ws = hojaDelCurso(wb, curso.paralelo);
    const columnas = columnasDeLaApp(cfg, curso, eventos);
    const u = ws ? ubicarZona(ws, cfg, columnas) : null;
    if (!ws) plan.avisos.push(`No hay hoja ${curso.paralelo} en el Excel: ese curso no se escribe.`);
    else if (u.error) plan.errores.push(`${ws.name}: ${u.error} No se escribe esta hoja.`);
    if (!ws || u.error) {
      contextos.push({ curso, ctx: contextoConFijadas(cfg, curso, eventos, reg) });
      continue;
    }
    const hoja = ws.name;
    for (const c of u.repetidos) plan.repetidos.push({ hoja, codigo: c });

    // 1) Lo que hay ahora en las celdas de la app.
    const actuales = new Map();
    for (const [codigo, fila] of u.filas) {
      const fil = ws.getRow(fila);
      actuales.set(codigo, new Map(columnas.map((col, i) => [col.clave, u.nueva ? null : normal(valorCelda(fil.getCell(u.inicio + i)))])));
    }
    const fijadaDe = (k) => (!u.nueva && control.fijadas.has(k) ? normal(control.fijadas.get(k)) : undefined);

    // 2) Notas de evento fijadas a mano (vigentes o conservadas ahora): cuentan como ajustes en el motor.
    const fijadasEvento = [];
    const fijadasPorEstudiante = new Map();
    for (const [codigo] of u.filas) {
      for (const col of columnas.filter((c) => c.tipo === 'evento')) {
        const k = claveCelda(hoja, codigo, col.clave);
        const actual = actuales.get(codigo).get(col.clave);
        const decision = decisiones.get(k);
        const vale = decision === 'conservar' || (decision !== 'reemplazar' && fijadaDe(k) !== undefined && fijadaDe(k) === actual);
        if (vale && esNotaSobreDiez(actual)) {
          fijadasEvento.push({ evento: col.evento, estudiante: codigo, valor: actual / 10 });
          if (!fijadasPorEstudiante.has(codigo)) fijadasPorEstudiante.set(codigo, new Set());
          fijadasPorEstudiante.get(codigo).add(col.evento);
        }
      }
    }

    // 3) Valores calculados y comparación con lo que hay (detecta ediciones a mano).
    const ctx = contextoConFijadas(cfg, curso, eventos, reg, fijadasEvento);
    contextos.push({ curso, ctx });
    const grupos = grupoActual(ctx);
    const celdas = [];
    for (const [codigo, fila] of u.filas) {
      const est = ctx.estudiantePorId.get(codigo);
      if (!est) { plan.sinApp.push({ hoja, fila, codigo }); continue; }
      const valores = valoresDelEstudiante(ctx, columnas, codigo, { hoy, grupos, fijadas: fijadasPorEstudiante.get(codigo) });
      columnas.forEach((col, i) => {
        const k = claveCelda(hoja, codigo, col.clave);
        const actual = actuales.get(codigo).get(col.clave);
        const calculado = valores.get(col.clave);
        const escrito = u.nueva ? null : normal(control.escritas.get(k) ?? null);
        const fijada = fijadaDe(k);
        const decision = decisiones.get(k);
        const celda = { k, fila, columna: u.inicio + i, col, codigo, valor: calculado, conservar: false, conflicto: null };
        if (decision === 'conservar') celda.conservar = true;
        else if (decision !== 'reemplazar') {
          if (fijada !== undefined) {
            if (fijada === actual) celda.conservar = true;
            else celda.conflicto = 'fijada';
          } else if (actual !== escrito && actual !== normal(calculado)) celda.conflicto = 'editada';
        }
        if (celda.conflicto) {
          plan.conflictos.push({
            clave: k, tipo: celda.conflicto, hoja, paralelo: curso.paralelo, codigo, nombre: est.nombre,
            columna: col.encabezado, tipoColumna: col.tipo, celda: `${letra(u.inicio + i)}${fila}`,
            actual, calculado: normal(calculado), anterior: celda.conflicto === 'fijada' ? fijada : escrito,
            sePuedeConservar: col.tipo !== 'evento' || esNotaSobreDiez(actual),
          });
          celda.conservar = true;   // mientras no se decida, la celda no se toca
        }
        celda.actual = actual;
        celda.cambia = !celda.conservar && normal(calculado) !== actual;
        if (celda.cambia) plan.celdasQueCambian += 1;
        celdas.push(celda);
      });
    }
    for (const e of reg.estudiantes) {
      if (e.estado !== 'baja' && !u.filas.has(e.codigo) && !u.repetidos.includes(e.codigo)) plan.sinFila.push({ hoja, codigo: e.codigo, nombre: e.nombre });
    }
    plan.hojas.push({ hoja, paralelo: curso.paralelo, columnas, ...u, celdas });
  }

  // 4) Hojas propias: se reescriben completas.
  plan.propias = [hojaAsistencia(cfg, contextos), hojaDetalle(cfg, contextos, hoy)];
  for (const p of plan.propias) {
    const ws = wb.getWorksheet(p.nombre);
    p.nueva = !ws;
    p.huella = huellaContenido(p);
    p.editada = Boolean(ws && control.huellas.has(p.nombre) && huellaHoja(ws) !== control.huellas.get(p.nombre));
    if (p.editada) plan.avisos.push(`La hoja «${p.nombre}» se editó a mano: la app la reescribe completa y esos cambios se perderán.`);
  }

  const fijadasAntes = [...control.fijadas.keys()].sort().join('\n');
  const fijadasAhora = plan.hojas.flatMap((h) => h.celdas.filter((c) => c.conservar && !c.conflicto).map((c) => c.k)).sort().join('\n');
  plan.sinCambios = control.existe && control.formato === FORMATO_CONTROL && !plan.conflictos.length && !plan.bloqueos.length
    && plan.hojas.every((h) => !h.nueva) && plan.celdasQueCambian === 0 && fijadasAntes === fijadasAhora
    && plan.propias.every((p) => !p.nueva && !p.editada && control.huellas.get(p.nombre) === p.huella);
  return plan;
}

// ---------- Hojas propias ----------

function hojaAsistencia(cfg, contextos) {
  const semanas = semanasConSesion(cfg);
  const filas = [], ambar = new Set();
  for (const { curso, ctx } of contextos) {
    const estudiantes = ctx.reg.estudiantes.filter((e) => e.estado !== 'baja')
      .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nombre.localeCompare(b.nombre, 'es'));
    for (const e of estudiantes) {
      const a = asistenciaPorSemana(ctx, e.id, semanas);
      if (e.estado === 'pendiente') ambar.add(filas.length);
      filas.push([curso.paralelo, e.numero ?? null, e.codigo, e.nombre, ...a.valores, a.asistencias, a.porcentaje]);
    }
  }
  return {
    nombre: cfg.excel.escritura.hoja_asistencia,
    titulo: 'Asistencia por semana · todos los cursos',
    subtitulo: `P presente · F no vino o salió · R se retiró antes · — sin clase o feriado · vacío: sin pase. ${cfg.excel.escritura.texto_zona}: se reescribe completa en cada escritura.`,
    columnas: [
      { encabezado: 'Paralelo', ancho: 9 }, { encabezado: 'N°', ancho: 5 }, { encabezado: 'Código único', ancho: 12 },
      { encabezado: 'Apellidos y nombres', ancho: 36 },
      ...semanas.map((s) => ({ encabezado: `S${s}`, ancho: 4.5, centrado: true })),
      { encabezado: 'Asistencias', ancho: 11, centrado: true }, { encabezado: '%', ancho: 7, formato: '0%', centrado: true },
    ],
    filas, ambar, congelarColumnas: 4,
  };
}

function hojaDetalle(cfg, contextos, hoy) {
  const filas = [], ambar = new Set();
  for (const { ctx } of contextos) {
    const estudiantes = ctx.reg.estudiantes.filter((e) => e.estado !== 'baja');
    for (const evento of eventosDelDetalle(ctx, hoy)) {
      const filasEvento = estudiantes.map((e) => ({ e, fila: filaDetalle(ctx, evento, e) }));
      filasEvento.sort((x, y) => String(x.fila[6] ?? '~').localeCompare(String(y.fila[6] ?? '~'), 'es', { numeric: true })
        || x.e.nombre.localeCompare(y.e.nombre, 'es'));
      for (const { e, fila } of filasEvento) {
        if (e.estado === 'pendiente') ambar.add(filas.length);
        filas.push(fila);
      }
    }
  }
  return {
    nombre: cfg.excel.escritura.hoja_detalle,
    titulo: 'Detalle por estudiante y evento · todo lo registrado en la app',
    subtitulo: `Notas sobre 10 · — el evento no se hizo en el curso. ${cfg.excel.escritura.texto_zona}: se reescribe completa en cada escritura.`,
    columnas: COLUMNAS_DETALLE.map((c, i) => ({ ...c, centrado: [3, 5, 6, 8, 11, 12].includes(i) })),
    filas, ambar, congelarColumnas: 3,
  };
}

const sinVaciosAlFinal = (xs) => { const r = [...xs]; while (r.length && r[r.length - 1] === null) r.pop(); return r; };

/** Huella del contenido planeado de una hoja propia (igual a la de la hoja ya escrita si nadie la tocó). */
function huellaContenido(p) {
  const filas = [[p.titulo], [p.subtitulo], [], p.columnas.map((c) => c.encabezado), ...p.filas];
  return huellaFilas(filas.map((f) => sinVaciosAlFinal(f.map(normal))));
}

function huellaHoja(ws) {
  const filas = [];
  ws.eachRow({ includeEmpty: true }, (fila, r) => {
    const valores = [];
    for (let c = 1; c <= fila.cellCount; c++) valores.push(normal(valorCelda(fila.getCell(c))));
    filas[r - 1] = sinVaciosAlFinal(valores);
  });
  return huellaFilas(Array.from(filas, (f) => f ?? []));
}

function huellaFilas(filas) {
  const r = [...filas];
  while (r.length && r[r.length - 1].length === 0) r.pop();
  return huella(JSON.stringify(r));
}

// ---------- Escritura ----------

/**
 * Escribe el plan en el libro (en memoria). Antes deben estar decididas todas las celdas editadas a mano.
 * `meta`: { app, ahora, config } para la hoja de control.
 */
export function aplicarEscritura(wb, cfg, plan, meta) {
  if (plan.conflictos.length) throw new Error('Hay celdas editadas a mano sin decidir.');
  if (plan.bloqueos.length) throw new Error(plan.bloqueos[0]);
  const esc = cfg.excel.escritura;
  for (const h of plan.hojas) {
    const ws = wb.getWorksheet(h.hoja);
    escribirCabecera(ws, h, esc.texto_zona);
    for (const c of h.celdas) if (!c.conservar) escribirCelda(ws, h, c);
  }
  // Hojas propias y de control: se quitan y se vuelven a crear al final del libro, en este orden.
  for (const nombre of [...plan.propias.map((p) => p.nombre), esc.hoja_control]) {
    const ws = wb.getWorksheet(nombre);
    if (ws) wb.removeWorksheet(ws.id);
  }
  for (const p of plan.propias) escribirHojaPropia(wb, p);
  escribirControl(wb, esc.hoja_control, plan, meta);
}

function escribirCabecera(ws, h, textoZona) {
  const filaEnc = h.enc.fila;
  const filaFranja = filaEnc - 1;
  let segmento = null;
  h.columnas.forEach((col, i) => {
    const c = h.inicio + i;
    ws.getColumn(c).width = col.ancho;
    const e = ws.getRow(filaEnc).getCell(c);
    e.value = col.encabezado;
    e.style = {
      font: { bold: true, color: { argb: ARGB.blanco } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.zona } },
      alignment: { vertical: 'middle', horizontal: col.tipo === 'observaciones' ? 'left' : 'center', wrapText: true },
    };
    if (filaFranja < 1) return;
    const seg = col.bimestre ?? col.clave;
    const f = ws.getRow(filaFranja).getCell(c);
    f.value = seg === segmento ? null
      : col.bimestre ? `${col.bimestre === 1 ? '1.er' : '2.º'} bimestre · notas sobre 10 · ${textoZona}` : textoZona;
    segmento = seg;
    f.style = {
      font: { italic: true, bold: true, color: { argb: ARGB.zona } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.franja } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    };
  });
}

function escribirCelda(ws, h, c) {
  const fila = ws.getRow(c.fila);
  const celda = fila.getCell(c.columna);
  const base = fila.getCell(h.colCodigo);
  celda.value = c.valor ?? null;
  const estilo = {
    alignment: c.col.tipo === 'observaciones' ? { vertical: 'middle', horizontal: 'left' } : { vertical: 'middle', horizontal: 'center' },
  };
  if (base.fill) estilo.fill = clonar(base.fill);
  if (base.border) estilo.border = clonar(base.border);
  if (c.col.formato) estilo.numFmt = c.col.formato;
  celda.style = estilo;
}

function escribirHojaPropia(wb, p) {
  const n = FILA_ENCABEZADOS_PROPIAS;
  const ws = wb.addWorksheet(p.nombre, {
    properties: { tabColor: { argb: ARGB.zona } },
    views: [{ state: 'frozen', xSplit: p.congelarColumnas ?? 0, ySplit: n }],
  });
  ws.getCell(1, 1).value = p.titulo;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: ARGB.azul } };
  ws.getCell(2, 1).value = p.subtitulo;
  ws.getCell(2, 1).font = { italic: true, color: { argb: ARGB.gris } };
  p.columnas.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.ancho;
    const e = ws.getRow(n).getCell(i + 1);
    e.value = col.encabezado;
    e.style = {
      font: { bold: true, color: { argb: ARGB.blanco } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.azul } },
      alignment: { vertical: 'middle', horizontal: col.centrado ? 'center' : 'left', wrapText: true },
    };
  });
  p.filas.forEach((valores, k) => {
    const fila = ws.getRow(n + 1 + k);
    valores.forEach((v, i) => {
      const col = p.columnas[i];
      const celda = fila.getCell(i + 1);
      celda.value = v ?? null;
      const estilo = {};
      if (col.formato) estilo.numFmt = col.formato;
      if (col.centrado) estilo.alignment = { horizontal: 'center' };
      if (p.ambar.has(k)) estilo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.ambar } };
      if (Object.keys(estilo).length) celda.style = estilo;
    });
  });
  ws.autoFilter = { from: { row: n, column: 1 }, to: { row: n, column: p.columnas.length } };
}

function escribirControl(wb, nombre, plan, { app, ahora, config }) {
  const ws = wb.addWorksheet(nombre, { state: 'hidden' });
  const filas = [
    ['Hoja de control de la app Lab MN. No la edites: guarda lo último que escribió la app para detectar los cambios hechos a mano.'],
    ['formato', FORMATO_CONTROL],
    ['app', app ?? null],
    ['escrito', ahora ?? null],
    ['configuración', config ?? null],
    [],
    ['tipo', 'hoja', 'código', 'clave', 'valor'],
  ];
  for (const h of plan.hojas) {
    for (const c of h.celdas) {
      const valor = c.conservar ? c.actual : normal(c.valor);
      filas.push(['celda', h.hoja, c.codigo, c.col.clave, valor]);
      if (c.conservar) filas.push(['fijada', h.hoja, c.codigo, c.col.clave, valor]);
    }
  }
  for (const p of plan.propias) filas.push(['huella', p.nombre, null, null, p.huella]);
  filas.forEach((valores, i) => { ws.getRow(i + 1).values = valores; });
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 26;
  ws.getColumn(5).width = 40;
}

// ---------- Verificación ----------

/**
 * Compara el libro original con el escrito (los dos recién leídos) fuera de las zonas de la app:
 * hojas, celdas (valor y formato), anchos, altos, paneles y celdas combinadas.
 * `zonas`: Map(nombre de hoja → Set de columnas de la app). `propias`: nombres de las hojas de la app.
 * Devuelve la lista de diferencias (vacía si todo quedó igual). Sin datos de las celdas, solo direcciones.
 */
export function compararLibros(a, b, { zonas, propias }) {
  const difs = [];
  const visibles = (wb) => wb.worksheets.filter((w) => !propias.has(w.name));
  const nombresA = visibles(a).map((w) => `${w.name}:${w.state}`);
  const nombresB = visibles(b).map((w) => `${w.name}:${w.state}`);
  if (nombresA.join('|') !== nombresB.join('|')) difs.push('Cambiaron las hojas del libro (nombres, orden o visibilidad).');
  for (const wa of visibles(a)) {
    const wb2 = b.getWorksheet(wa.name);
    if (!wb2) continue;
    const zona = zonas.get(wa.name) ?? new Set();
    const donde = (x) => `${wa.name}!${x}`;
    if (estable(wa.views) !== estable(wb2.views)) difs.push(`${wa.name}: cambiaron los paneles o la vista.`);
    if (JSON.stringify(Object.keys(wa._merges ?? {}).sort()) !== JSON.stringify(Object.keys(wb2._merges ?? {}).sort())) {
      difs.push(`${wa.name}: cambiaron las celdas combinadas.`);
    }
    const maxF = Math.max(wa.rowCount, wb2.rowCount);
    const maxC = Math.max(ultimaColumna(wa), ultimaColumna(wb2));
    for (let c = 1; c <= maxC; c++) {
      if (zona.has(c)) continue;
      if ((wa.getColumn(c).width ?? null) !== (wb2.getColumn(c).width ?? null)) difs.push(`${donde(letra(c))}: cambió el ancho.`);
    }
    for (let r = 1; r <= maxF; r++) {
      const fa = wa.getRow(r), fb = wb2.getRow(r);
      if ((fa.height ?? null) !== (fb.height ?? null)) difs.push(`${donde(r)}: cambió el alto de la fila.`);
      for (let c = 1; c <= maxC; c++) {
        if (zona.has(c)) continue;
        const ca = fa.getCell(c), cb = fb.getCell(c);
        if (estable(ca.value) !== estable(cb.value)) difs.push(`${donde(`${letra(c)}${r}`)}: cambió el valor.`);
        if (estable(ca.style ?? {}) !== estable(cb.style ?? {})) difs.push(`${donde(`${letra(c)}${r}`)}: cambió el formato.`);
      }
      if (difs.length > 50) return difs;
    }
  }
  return difs;
}

/** Zonas de la app del plan, para compararLibros. */
export function zonasDelPlan(plan) {
  return new Map(plan.hojas.map((h) => [h.hoja, new Set(h.columnas.map((_, i) => h.inicio + i))]));
}
