// PDF mínimo con una imagen JPEG por página (la lámina de métricas, Fase 8). Sin librerías: el JPEG va tal cual
// (filtro DCTDecode). Cada página mide `anchoPt` de ancho (A4 por defecto) y el alto que da la proporción de su imagen.

const codificar = (t) => new TextEncoder().encode(t);

/** Texto del diccionario /Info en UTF-16BE (admite tildes y emojis). */
export function textoPdf(t) {
  let hex = 'FEFF';
  for (const c of String(t ?? '')) {
    const cp = c.codePointAt(0);
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
    } else hex += cp.toString(16).padStart(4, '0');
  }
  return `<${hex.toUpperCase()}>`;
}

/**
 * Bytes de un PDF con una página por imagen. paginas: [{ jpeg: Uint8Array, ancho, alto }] (en píxeles, los del JPEG).
 */
export function pdfDeImagenes(paginas, { titulo = '', productor = 'Lab. MN · app de evaluación', anchoPt = 595.28 } = {}) {
  if (!paginas.length) throw new Error('El PDF necesita al menos una página.');
  const partes = [];
  const offsets = [];
  let largo = 0;
  const poner = (x) => { const b = typeof x === 'string' ? codificar(x) : x; partes.push(b); largo += b.length; };
  const objeto = (n, ...cuerpo) => {
    offsets[n] = largo;
    poner(`${n} 0 obj\n`);
    for (const c of cuerpo) poner(c);
    poner('\nendobj\n');
  };

  poner('%PDF-1.4\n%âãÏÓ\n');
  // 1 catálogo · 2 árbol de páginas · 3 información · por página i: 4+3i página, 5+3i contenido, 6+3i imagen.
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objeto(2, `<< /Type /Pages /Kids [${paginas.map((_, i) => `${4 + 3 * i} 0 R`).join(' ')}] /Count ${paginas.length} >>`);
  objeto(3, `<< /Title ${textoPdf(titulo)} /Producer ${textoPdf(productor)} >>`);
  paginas.forEach((p, i) => {
    const w = Number(anchoPt.toFixed(2));
    const h = Number(((anchoPt * p.alto) / p.ancho).toFixed(2));
    const contenido = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    objeto(4 + 3 * i, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${6 + 3 * i} 0 R >> >> /Contents ${5 + 3 * i} 0 R >>`);
    objeto(5 + 3 * i, `<< /Length ${codificar(contenido).length} >>\nstream\n`, contenido, '\nendstream');
    objeto(6 + 3 * i, `<< /Type /XObject /Subtype /Image /Width ${p.ancho} /Height ${p.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream');
  });

  const inicioXref = largo;
  const total = 4 + 3 * paginas.length;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  poner(xref);
  poner(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);

  const salida = new Uint8Array(largo);
  let o = 0;
  for (const b of partes) { salida.set(b, o); o += b.length; }
  return salida;
}
