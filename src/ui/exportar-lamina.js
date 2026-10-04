// Exportar la lámina de métricas (Fase 8): el SVG se dibuja en un lienzo del navegador y sale como PNG, o como
// JPEG por página dentro de un PDF (src/nucleo/pdf.js). Sin librerías.
import { pdfDeImagenes } from '../nucleo/pdf.js';

/** Límite de píxeles de un lienzo en Safari del iPhone (más grande, el dibujo sale en blanco). */
const MAX_PIXELES = 16_000_000;

function medidas(svg) {
  const ancho = Number(/width="([\d.]+)"/.exec(svg)?.[1]);
  const alto = Number(/height="([\d.]+)"/.exec(svg)?.[1]);
  if (!ancho || !alto) throw new Error('La lámina no tiene medidas.');
  return { ancho, alto };
}

function cargarImagen(svg) {
  return new Promise((listo, fallo) => {
    const img = new Image();
    img.onload = () => listo(img);
    img.onerror = () => fallo(new Error('No se pudo dibujar la lámina.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function lienzo(svg, escala) {
  const { ancho, alto } = medidas(svg);
  const e = Math.min(escala, Math.sqrt(MAX_PIXELES / (ancho * alto)));
  const img = await cargarImagen(svg);
  const c = document.createElement('canvas');
  c.width = Math.round(ancho * e);
  c.height = Math.round(alto * e);
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const aBlob = (c, tipo, calidad) => new Promise((listo, fallo) => {
  c.toBlob((b) => (b ? listo(b) : fallo(new Error('No se pudo crear la imagen.'))), tipo, calidad);
});

/** PNG de una lámina continua (al doble de resolución, si cabe). */
export async function pngDeLamina(svg) {
  const c = await lienzo(svg, 2);
  const blob = await aBlob(c, 'image/png');
  c.width = 0; c.height = 0;   // libera la memoria del lienzo (iPhone)
  return blob;
}

/** PDF con una página A4 por SVG (cada página a unos 220 ppp). */
export async function pdfDeLamina(paginas, titulo) {
  const imagenes = [];
  for (const svg of paginas) {
    const c = await lienzo(svg, 2.5);
    const jpeg = new Uint8Array(await (await aBlob(c, 'image/jpeg', 0.9)).arrayBuffer());
    imagenes.push({ jpeg, ancho: c.width, alto: c.height });
    c.width = 0; c.height = 0;
  }
  return new Blob([pdfDeImagenes(imagenes, { titulo })], { type: 'application/pdf' });
}
