// Gráficos en SVG (como texto), sin librerías: barras, barras apiladas (distribuciones), evolución, tablas y
// párrafos. Los usan la pantalla de métricas y la lámina que se exporta como imagen o PDF (Fase 8).
// Cada pieza devuelve { svg, alto } dibujada desde (0, 0) con el ancho pedido; `apilar` las pone una bajo otra.
// Los colores van como variables CSS con su valor claro de respaldo: en la app siguen el tema (claro u oscuro) y en
// la imagen exportada, que no tiene la hoja de estilos, quedan los valores claros.

export const FUENTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const COLORES = {
  texto: '#17202B', tenue: '#5A6270', borde: '#DCE2EA', pista: '#EDF1F6', fondo: '#FFFFFF', caja: '#F5F7FA',
  azul: '#2B5182', ok: '#1E7A46', mal: '#B42318', aviso: '#9A5800', avisoFondo: '#FFF2D2', sqi: '#0F766E', trad: '#1F3A5F',
};

/** Color por nombre (variable CSS con respaldo) o un color ya resuelto (#… o var(…)), que pasa tal cual. */
export const color = (nombre) => (/^(#|var\()/.test(nombre) ? nombre : `var(--g-${nombre},${COLORES[nombre]})`);

/** Colores de los niveles de una escala, de lo más bajo (rojo) a lo más alto (verde). Texto legible encima. */
const NIVELES = [
  { fondo: '#C92A2A', texto: '#FFFFFF' },
  { fondo: '#E8590C', texto: '#FFFFFF' },
  { fondo: '#F2B705', texto: '#17202B' },
  { fondo: '#82C91E', texto: '#17202B' },
  { fondo: '#2B8A3E', texto: '#FFFFFF' },
];

/** Color del nivel `i` de una escala de `n` niveles (0 = el más bajo). */
export function colorNivel(i, n) {
  if (n <= 1) return NIVELES[4];
  return NIVELES[Math.round((i / (n - 1)) * (NIVELES.length - 1))];
}

export function esc(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const r1 = (x) => Math.round(x * 10) / 10;

let medidor = null;   // contexto de un lienzo para medir texto (solo en el navegador)

function medirEnLienzo(t, tam) {
  if (medidor === null) {
    medidor = false;
    try { if (typeof document !== 'undefined') medidor = document.createElement('canvas').getContext('2d') ?? false; } catch { medidor = false; }
  }
  if (!medidor) return null;
  medidor.font = `${tam}px ${FUENTE}`;
  return medidor.measureText(t).width;
}

/**
 * Ancho de un texto en px. En el navegador se mide con un lienzo (la misma fuente con la que se dibuja y se exporta);
 * en Node, una estimación por tipo de letra. Con un pequeño margen, para que nada se salga del borde.
 */
export function anchoTexto(t, tam) {
  const s = String(t);
  const medido = medirEnLienzo(s, tam);
  if (medido !== null) return medido * 1.03;
  let w = 0;
  for (const c of s) w += /[MWmw@%—]/.test(c) ? 0.86 : /[A-ZÁÉÍÓÚÑ]/.test(c) ? 0.68 : /[0-9]/.test(c) ? 0.6 : /[iljtf.,:;·'|() ]/.test(c) ? 0.31 : 0.54;
  return w * tam * 1.03;
}

/** Recorta con «…» si no cabe en `max` px. */
export function recortar(t, max, tam) {
  const s = String(t ?? '');
  if (anchoTexto(s, tam) <= max) return s;
  let x = s;
  while (x.length > 1 && anchoTexto(`${x}…`, tam) > max) x = x.slice(0, -1);
  return `${x.trimEnd()}…`;
}

/** Parte un texto en líneas de hasta `max` px (la última se recorta si pasan de `lineas`). */
export function envolver(t, max, tam, lineas = Infinity) {
  const palabras = String(t ?? '').split(/\s+/).filter(Boolean);
  const salida = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (anchoTexto(prueba, tam) <= max || !actual) actual = prueba;
    else { salida.push(actual); actual = p; }
  }
  if (actual) salida.push(actual);
  if (salida.length > lineas) {
    const cortadas = salida.slice(0, lineas);
    cortadas[lineas - 1] = recortar(`${cortadas[lineas - 1]} ${salida.slice(lineas).join(' ')}`, max, tam);
    return cortadas;
  }
  return salida.map((l) => recortar(l, max, tam));
}

/** <text> con estilo. */
export function texto(x, y, t, { tam = 13, tono = 'texto', peso = 400, ancla = 'start', extra = '' } = {}) {
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${tam}" font-weight="${peso}" text-anchor="${ancla}" style="fill:${color(tono)}"${extra}>${esc(t)}</text>`;
}

function rect(x, y, w, h, tono, { radio = 0, extra = '' } = {}) {
  if (w <= 0 || h <= 0) return '';
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${radio}" style="fill:${color(tono)}"${extra}/>`;
}

export const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)} %`);

/** Pone piezas una debajo de otra, con `separacion` px entre ellas. */
export function apilar(piezas, separacion = 12) {
  let y = 0;
  const partes = [];
  for (const p of piezas.filter(Boolean)) {
    if (!p.alto) continue;
    if (partes.length) y += separacion;
    partes.push(`<g transform="translate(0 ${r1(y)})">${p.svg}</g>`);
    y += p.alto;
  }
  return { svg: partes.join(''), alto: y };
}

/** Documento SVG completo. `fondo`: color de fondo (en la lámina exportada, blanco). */
export function documento({ svg, alto }, ancho, { fondo = null, titulo = null } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${Math.ceil(alto)}" viewBox="0 0 ${ancho} ${Math.ceil(alto)}" font-family="${esc(FUENTE)}"${titulo ? ` role="img" aria-label="${esc(titulo)}"` : ''}>`
    + `${fondo ? `<rect width="100%" height="100%" fill="${fondo}"/>` : ''}${svg}</svg>`;
}

/** Párrafo con salto de línea; con `caja`, sobre un fondo (avisos). */
export function parrafo(t, { ancho, tam = 13, tono = 'texto', peso = 400, caja = null, interlineado = 1.35 } = {}) {
  const pad = caja ? 10 : 0;
  const lineas = envolver(t, ancho - 2 * pad, tam);
  const alto = lineas.length * tam * interlineado + 2 * pad + (caja ? 2 : 0);
  let svg = caja ? rect(0, 0, ancho, alto, caja, { radio: 8 }) : '';
  lineas.forEach((l, i) => { svg += texto(pad, pad + tam + i * tam * interlineado - 2, l, { tam, tono, peso }); });
  return { svg, alto };
}

/** Recuadros con números grandes: [{ valor, texto }]. */
export function numeros(items, { ancho, minimo = 104 } = {}) {
  const porFila = Math.max(1, Math.min(items.length, Math.floor((ancho + 8) / (minimo + 8))));
  const w = (ancho - 8 * (porFila - 1)) / porFila;
  const h = 54;
  let svg = '';
  items.forEach((it, i) => {
    const x = (i % porFila) * (w + 8);
    const y = Math.floor(i / porFila) * (h + 8);
    svg += rect(x, y, w, h, 'caja', { radio: 8 });
    svg += texto(x + 10, y + 25, recortar(it.valor, w - 20, 20), { tam: 20, peso: 700 });
    svg += texto(x + 10, y + 43, recortar(it.texto, w - 20, 11.5), { tam: 11.5, tono: 'tenue' });
  });
  return { svg, alto: Math.ceil(items.length / porFila) * (h + 8) - 8 };
}

/** Leyenda: [{ texto, tono }] en una o más líneas. */
function leyenda(items, ancho, tam = 11.5) {
  let x = 0; let y = 0; let svg = '';
  for (const it of items) {
    const w = 14 + anchoTexto(it.texto, tam) + 14;
    if (x > 0 && x + w > ancho) { x = 0; y += tam + 8; }
    svg += rect(x, y + 1, 10, 10, it.tono, { radio: 2 });
    svg += texto(x + 14, y + tam - 1, it.texto, { tam, tono: 'tenue' });
    x += w;
  }
  return { svg, alto: y + tam + 4 };
}

/** Ancho de la columna de etiquetas: el de la más larga, entre 48 px y el 38 % del ancho. */
function columnaEtiquetas(filas, ancho, tam) {
  const mayor = Math.max(0, ...filas.map((f) => anchoTexto(f.etiqueta, tam)));
  return Math.round(Math.min(ancho * 0.38, Math.max(48, mayor + 2)));
}

/**
 * Barras horizontales. filas: [{ etiqueta, valor (0…max o null), texto?, nota?, tono? }].
 * `arriba`: la etiqueta va en su propia línea, sobre la barra (para textos largos).
 */
export function barras(filas, { ancho, max = 1, formato = pct, arriba = false, tono = 'azul', tam = 12.5, valorAncho = 52 } = {}) {
  let y = 0; let svg = '';
  const etiquetaAncho = arriba ? 0 : columnaEtiquetas(filas, ancho, tam);
  const x0 = arriba ? 0 : etiquetaAncho + 10;
  const barraAncho = ancho - x0 - valorAncho - 6;
  const alto = 14;
  for (const f of filas) {
    let lineas = [];
    if (arriba) {
      lineas = envolver(f.etiqueta, ancho, tam, 2);
      lineas.forEach((l, i) => { svg += texto(0, y + tam + i * (tam + 3), l, { tam }); });
      y += lineas.length * (tam + 3) + 3;
    } else {
      svg += texto(0, y + alto - 2, recortar(f.etiqueta, etiquetaAncho, tam), { tam });
    }
    svg += rect(x0, y, barraAncho, alto, 'pista', { radio: 3 });
    if (f.valor !== null && f.valor !== undefined) svg += rect(x0, y, Math.max(2, (Math.min(f.valor, max) / max) * barraAncho), alto, f.tono ?? tono, { radio: 3 });
    svg += texto(ancho, y + alto - 2, f.texto ?? formato(f.valor), { tam, peso: 700, ancla: 'end' });
    y += alto;
    if (f.nota) {
      svg += texto(x0, y + 13, recortar(f.nota, ancho - x0, 11), { tam: 11, tono: 'tenue' });
      y += 15;
    }
    y += arriba ? 10 : 8;
  }
  return { svg, alto: Math.max(0, y - 8) };
}

/**
 * Barras apiladas (distribuciones). filas: [{ etiqueta, conteos: [n por segmento], texto?, nota?, segmentos? }];
 * segmentos: [{ texto, fondo, color }] en el mismo orden (una fila puede traer los suyos; la leyenda usa estos).
 * Cada barra se normaliza a su total.
 */
export function apiladas(filas, segmentos, { ancho, arriba = false, tam = 12.5, valorAncho = 52, conLeyenda = true } = {}) {
  const ley = conLeyenda ? leyenda(segmentos.map((s) => ({ texto: s.texto, tono: s.fondo })), ancho) : { svg: '', alto: 0 };
  let y = ley.alto + (conLeyenda ? 8 : 0); let svg = ley.svg;
  const etiquetaAncho = arriba ? 0 : columnaEtiquetas(filas, ancho, tam);
  const x0 = arriba ? 0 : etiquetaAncho + 10;
  const barraAncho = ancho - x0 - (valorAncho ? valorAncho + 6 : 0);
  const alto = 18;
  for (const f of filas) {
    if (arriba) {
      const lineas = envolver(f.etiqueta, ancho, tam, 2);
      lineas.forEach((l, i) => { svg += texto(0, y + tam + i * (tam + 3), l, { tam }); });
      y += lineas.length * (tam + 3) + 3;
    } else {
      svg += texto(0, y + alto - 4, recortar(f.etiqueta, etiquetaAncho, tam), { tam });
    }
    const total = f.conteos.reduce((s, n) => s + n, 0);
    let x = x0;
    if (!total) svg += rect(x0, y, barraAncho, alto, 'pista', { radio: 3 });
    const segs = f.segmentos ?? segmentos;
    f.conteos.forEach((n, i) => {
      if (!n) return;
      const w = (n / total) * barraAncho;
      svg += rect(x, y, w, alto, segs[i].fondo);
      if (w >= anchoTexto(String(n), 11) + 6) svg += texto(x + w / 2, y + alto - 5, String(n), { tam: 11, peso: 600, ancla: 'middle', tono: segs[i].color ?? '#FFFFFF' });
      x += w;
    });
    if (valorAncho) svg += texto(ancho, y + alto - 4, f.texto ?? '', { tam, peso: 700, ancla: 'end' });
    y += alto;
    if (f.nota) {
      svg += texto(x0, y + 13, recortar(f.nota, ancho - x0, 11), { tam: 11, tono: 'tenue' });
      y += 15;
    }
    y += arriba ? 10 : 8;
  }
  return { svg, alto: Math.max(0, y - 8) };
}

/**
 * Evolución entre eventos: columnas (nota media) y línea con puntos (asistencia), de 0 a 100 %.
 * puntos: [{ etiqueta, nota (0–1 o null), asistencia (0–1 o null) }].
 */
export function evolucion(puntos, { ancho, alto = 190, textos = { nota: 'Nota media', asistencia: 'Asistencia' } } = {}) {
  const ley = leyenda([{ texto: textos.nota, tono: 'azul' }, { texto: textos.asistencia, tono: 'ok' }], ancho);
  const top = ley.alto + 12;
  const izq = 42;
  const n = Math.max(puntos.length, 1);
  const paso = (ancho - izq) / n;
  const maxEtiqueta = Math.max(0, ...puntos.map((p) => anchoTexto(p.etiqueta, 11)));
  const rotar = maxEtiqueta > paso - 4;
  const abajo = rotar ? Math.min(60, maxEtiqueta + 8) : 18;
  const h = alto - top - abajo;
  const yDe = (v) => top + h - v * h;
  let svg = ley.svg;
  for (const v of [0, 0.5, 1]) {
    svg += `<line x1="${izq}" x2="${ancho}" y1="${r1(yDe(v))}" y2="${r1(yDe(v))}" style="stroke:${color('borde')}" stroke-width="1"${v === 0.5 ? ' stroke-dasharray="3 3"' : ''}/>`;
    svg += texto(izq - 6, yDe(v) + 4, `${v * 100} %`, { tam: 10.5, tono: 'tenue', ancla: 'end' });
  }
  const cw = Math.min(28, paso * 0.56);
  puntos.forEach((p, i) => {
    const cx = izq + paso * i + paso / 2;
    if (p.nota !== null && p.nota !== undefined) {
      svg += rect(cx - cw / 2, yDe(p.nota), cw, p.nota * h, 'azul', { radio: 2 });
      if (paso >= 26) svg += texto(cx, yDe(p.nota) - 4, Math.round(p.nota * 100), { tam: 10, tono: 'azul', ancla: 'middle', peso: 700 });
    }
    svg += rotar
      ? texto(cx + 4, top + h + 8, p.etiqueta, { tam: 11, ancla: 'end', extra: ` transform="rotate(-60 ${r1(cx + 4)} ${r1(top + h + 8)})"` })
      : texto(cx, top + h + 14, p.etiqueta, { tam: 11, ancla: 'middle' });
  });
  const conAsistencia = puntos.map((p, i) => ({ p, x: izq + paso * i + paso / 2 })).filter(({ p }) => p.asistencia !== null && p.asistencia !== undefined);
  if (conAsistencia.length > 1) {
    svg += `<polyline fill="none" style="stroke:${color('ok')}" stroke-width="2" points="${conAsistencia.map(({ p, x }) => `${r1(x)},${r1(yDe(p.asistencia))}`).join(' ')}"/>`;
  }
  for (const { p, x } of conAsistencia) svg += `<circle cx="${r1(x)}" cy="${r1(yDe(p.asistencia))}" r="3.5" style="fill:${color('ok')};stroke:${color('fondo')}" stroke-width="1.5"/>`;
  return { svg, alto };
}

/**
 * Tabla simple. columnas: [{ texto, ancho (fracción), alinear: 'start' | 'end' }]; filas: [[celdas]].
 * Las celdas son texto; se recortan si no caben.
 */
export function tabla(columnas, filas, { ancho, tam = 12 } = {}) {
  const total = columnas.reduce((s, c) => s + c.ancho, 0);
  const anchos = columnas.map((c) => (c.ancho / total) * ancho);
  const xs = anchos.map((_, i) => anchos.slice(0, i).reduce((s, w) => s + w, 0));
  const fila = 22;
  let svg = '';
  const celda = (t, i, y, opciones) => {
    const c = columnas[i];
    const derecha = c.alinear === 'end';
    const x = derecha ? xs[i] + anchos[i] - 4 : xs[i] + 4;
    return texto(x, y, recortar(t, anchos[i] - 8, opciones.tam ?? tam), { ...opciones, ancla: derecha ? 'end' : 'start' });
  };
  columnas.forEach((c, i) => { svg += celda(c.texto, i, 14, { tam: 10.5, tono: 'tenue', peso: 700 }); });
  svg += `<line x1="0" x2="${ancho}" y1="20" y2="20" style="stroke:${color('borde')}"/>`;
  filas.forEach((f, j) => {
    const y = 20 + j * fila;
    if (j % 2 === 1) svg += rect(0, y, ancho, fila, 'caja');
    f.forEach((t, i) => { svg += celda(t, i, y + 15, { tam, peso: i === 0 ? 600 : 400 }); });
  });
  return { svg, alto: 20 + filas.length * fila + 2 };
}
