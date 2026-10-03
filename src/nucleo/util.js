// Utilidades sin dependencias, compartidas por la app (navegador) y las pruebas (Node).

/** Redondeo usual a `decimales` (un 5 en la cifra siguiente sube: 1.125 → 1.13). */
export function redondear(x, decimales = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return x;
  const f = 10 ** decimales;
  // El 1e-9 absorbe el ruido binario (0.285 * 100 = 28.499999…) sin mover valores legítimos.
  const r = Math.round(x * f + 1e-9) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** Texto en minúsculas, sin tildes y con espacios simples (para buscar y comparar). */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Espacios simples y sin bordes, conservando mayúsculas y tildes. */
export function limpiarTexto(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim();
}

// ---- Fechas como texto ISO 'AAAA-MM-DD' (sin zonas horarias) ----

export function fechaADate(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function dateAFecha(date) {
  return date.toISOString().slice(0, 10);
}

export function sumarDias(iso, dias) {
  const d = fechaADate(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return dateAFecha(d);
}

export function diasEntre(desde, hasta) {
  return Math.round((fechaADate(hasta) - fechaADate(desde)) / 86400000);
}

/** Fecha local del dispositivo como 'AAAA-MM-DD'. */
export function hoyLocal(ahora = new Date()) {
  const a = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
export const DIAS_TEXTO = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

/** 'lunes' … 'domingo' de una fecha ISO. */
export function diaDeFecha(iso) {
  const js = fechaADate(iso).getUTCDay(); // 0 = domingo
  return DIAS[(js + 6) % 7];
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «lun 5 oct» */
export function fechaCorta(iso) {
  const d = fechaADate(iso);
  const dia = DIAS_TEXTO[diaDeFecha(iso)].slice(0, 3).toLowerCase();
  return `${dia} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** Suma de números ignorando null/undefined. */
export function suma(valores) {
  return valores.reduce((s, v) => (v === null || v === undefined ? s : s + v), 0);
}

export function agruparPor(lista, clave) {
  const m = new Map();
  for (const x of lista) {
    const k = typeof clave === 'function' ? clave(x) : x[clave];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/** Compara grupos como números cuando lo son («2» < «10»). */
export function compararGrupos(a, b) {
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b), 'es', { numeric: true });
}
