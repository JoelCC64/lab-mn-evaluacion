// Secciones del tablero de métricas (Fase 8) y la lámina para presentar. Cada sección tiene título, una nota
// breve y un dibujo en SVG para un ancho dado: la pantalla la dibuja al ancho del teléfono o de la Mac y la lámina
// (imagen o PDF) al ancho de una hoja A4. Solo usa datos agregados: ningún nombre ni código de estudiante.

import { apilar, apiladas, barras, colorNivel, color, documento, evolucion, numeros, parrafo, pct, tabla, texto } from './graficos.js';
import { nombreMetodologia } from './config.js';

const tonoDe = (m) => (m === 'SQI' ? 'sqi' : 'trad');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const subtitulo = (t, ancho) => parrafo(t, { ancho, tam: 12.5, peso: 700, tono: 'tenue' });

/** Segmentos de una escala (de lo más bajo a lo más alto), con su color. */
function segmentosEscala(niveles, textos = null) {
  return niveles.map((n, i) => {
    const c = colorNivel(i, niveles.length);
    return { texto: textos?.[i] ?? String(n), fondo: c.fondo, color: c.texto };
  });
}

/** Distribución de una actividad: una barra por criterio o aspecto. Si las escalas difieren (SQI), colores por posición. */
function distribucionRubrica(r, ancho) {
  const escalas = r.partes.map((p) => p.niveles.map((n) => n.nivel).join());
  const comun = new Set(escalas).size === 1;
  const filas = r.partes.map((p) => {
    const segs = segmentosEscala(p.niveles.map((n) => n.nivel));
    return { etiqueta: p.corto ?? p.nombre, conteos: p.niveles.map((n) => n.n), texto: pct(p.media), segmentos: segs };
  });
  const leyenda = comun
    ? segmentosEscala(r.partes[0].niveles.map((n) => n.nivel)).map((s, i, a) => ({ ...s, texto: i === a.length - 1 ? `${s.texto} (máx.)` : s.texto }))
    : segmentosEscala([0, 1, 2], ['0', 'intermedio', 'máximo']);
  return apiladas(filas, leyenda, { ancho });
}

/**
 * Secciones visibles para estas métricas: [{ id, titulo, nota, dibujar(ancho) → { svg, alto } }].
 * `cfg` da los nombres de las metodologías y los textos de la configuración.
 */
export function seccionesDelTablero(m, cfg) {
  const nombre = (x) => nombreMetodologia(cfg, x);
  const dos = m.metodologias.length > 1;
  const s = [];
  const g = m.generales;

  s.push({
    id: 'resumen', titulo: 'Resumen',
    dibujar: (ancho) => numeros([
      { valor: g.cursos, texto: g.cursos === 1 ? 'curso' : 'cursos' },
      { valor: g.estudiantes, texto: 'estudiantes' },
      { valor: g.sesiones, texto: g.abiertas ? 'sesiones' : 'sesiones con pase' },
      { valor: pct(g.asistencia), texto: 'asistencia' },
      { valor: g.grupos, texto: 'notas de grupo' },
      ...(m.trabajos.length ? [{ valor: g.trabajos, texto: 'TC calificados' }] : []),
      { valor: g.controles, texto: 'controles orales' },
    ], { ancho }),
  });

  if (m.advertencias.length) {
    s.push({
      id: 'advertencias', titulo: 'Antes de leer',
      dibujar: (ancho) => apilar(m.advertencias.map((a) => parrafo(a.texto, { ancho, tam: 12.5, tono: 'aviso', caja: 'avisoFondo' })), 6),
    });
  }

  const a = m.asistencia;
  if (a.porCurso.length > 1) {
    s.push({
      id: 'asistencia-cursos', titulo: 'Asistencia por curso',
      nota: `Vinieron (presentes y quienes se retiraron antes) sobre los registrados en el pase final.${dos ? ` Azul: ${nombre('TRAD')}; verde: ${nombre('SQI')}.` : ''}`,
      dibujar: (ancho) => barras(a.porCurso.map((x) => ({
        etiqueta: x.etiqueta, valor: x.asistencia, tono: tonoDe(x.metodologia),
        nota: `${plural(x.faltas, 'falta', 'faltas')} · ${x.retiros} se retiraron antes · ${x.n} registros`,
      })), { ancho }),
    });
  }
  if (a.porGrupo?.length) {
    s.push({
      id: 'asistencia-grupos', titulo: 'Asistencia por grupo',
      nota: 'Con el grupo de cada estudiante en cada sesión.',
      dibujar: (ancho) => barras(a.porGrupo.map((x) => ({ etiqueta: x.etiqueta, valor: x.asistencia, nota: `${plural(x.faltas, 'falta', 'faltas')} · ${x.retiros} se retiraron antes` })), { ancho }),
    });
  }
  if (a.porEvento.length) {
    s.push({
      id: 'asistencia-eventos', titulo: 'Asistencia y permanencia por sesión',
      nota: 'Barra: asistencia. Permanencia: de quienes vinieron, cuántos se quedaron hasta el final.',
      dibujar: (ancho) => barras(a.porEvento.map((x) => ({
        etiqueta: x.etiqueta, valor: x.asistencia,
        nota: `permanencia ${pct(x.permanencia)}${m.unCurso ? '' : ` · ${plural(x.cursos, 'curso', 'cursos')}`} · ${x.n} registros`,
      })), { ancho }),
    });
  }
  if (a.porDia.length > 1 || a.porFranja.length > 1) {
    s.push({
      id: 'asistencia-horario', titulo: 'Asistencia por día y franja horaria',
      nota: 'Cada día y cada franja reúne a pocos cursos: lee estas barras junto con las advertencias.',
      dibujar: (ancho) => apilar([
        subtitulo('Por día', ancho),
        barras(a.porDia.map((x) => ({ etiqueta: x.etiqueta, valor: x.asistencia, nota: x.cursos.join(', ') })), { ancho }),
        subtitulo('Por franja horaria', ancho),
        barras(a.porFranja.map((x) => ({
          etiqueta: x.etiqueta, valor: x.asistencia, tono: x.metodologias.length === 1 ? tonoDe(x.metodologias[0]) : 'azul',
          nota: `${x.metodologias.length === 1 && dos ? `solo ${nombre(x.metodologias[0])} · ` : ''}${x.cursos.join(', ')}`,
        })), { ancho }),
      ], 8),
    });
  }

  const evol = m.evolucion.filter((e) => e.puntos.length > 1);
  if (evol.length) {
    s.push({
      id: 'evolucion', titulo: 'Evolución entre eventos',
      nota: 'Columnas: nota media de los grupos (o de los TC) en cada actividad, de 0 a 100 %. Línea: asistencia a esa sesión. Cada metodología por separado.',
      dibujar: (ancho) => apilar(evol.flatMap((e) => [
        dos ? subtitulo(nombre(e.metodologia), ancho) : null,
        evolucion(e.puntos.map((p) => ({ etiqueta: p.codigo, nota: p.nota, asistencia: p.asistencia })), { ancho }),
      ]), 6),
    });
  }

  for (const r of m.rubricas) {
    const que = r.tipo === 'taller' ? 'evaluación integral' : r.metodologia === 'SQI' ? 'puntajes por aspecto' : 'puntajes por criterio';
    s.push({
      id: `rubrica-${r.clave}`, titulo: `${r.codigo} · ${nombre(r.metodologia)}: ${que}`,
      nota: `${r.titulo}. ${plural(r.grupos, 'grupo evaluado', 'grupos evaluados')} en ${plural(r.cursos, 'curso', 'cursos')}; nota media ${pct(r.media)}.${r.penalizados ? ` ${plural(r.penalizados, 'grupo', 'grupos')} con penalización total (fuera de la distribución).` : ''} A la derecha, el promedio de cada parte.`,
      dibujar: (ancho) => distribucionRubrica(r, ancho),
    });
  }

  if (m.etiquetas.length) {
    s.push({
      id: 'etiquetas', titulo: 'Etiquetas más marcadas',
      nota: 'Proporción de grupos evaluados que la recibieron. Verde: aciertos; rojo: errores.',
      dibujar: (ancho) => barras(m.etiquetas.map((t) => ({
        etiqueta: `${t.signo === '+' ? '+' : '−'} ${t.texto}`, valor: t.proporcion, tono: t.signo === '+' ? 'ok' : 'mal',
        nota: `${t.codigo}${dos ? ` · ${nombre(t.metodologia)}` : ''} · ${t.n} de ${t.de} grupos`,
      })), { ancho, arriba: true }),
    });
  }

  for (const t of m.trabajos) {
    s.push({
      id: `tc-${t.actividad}`, titulo: `${t.codigo}: entregas y puntaje por pregunta`,
      nota: `${t.titulo}. ${t.porCalificar} ${t.unidad} por calificar; nota media ${t.media === null ? '—' : `${(Math.round(t.media * 100) / 10).toFixed(1)}/10`}. Debajo, el promedio de cada pregunta, de la más baja a la más alta: ahí fallan.`,
      dibujar: (ancho) => apilar([
        apiladas([{ etiqueta: 'Entregas', conteos: [t.calificados, t.noEntregaron, t.pendientes], texto: '' }], [
          { texto: 'Calificados', fondo: color('ok'), color: '#FFFFFF' },
          { texto: 'No entregaron', fondo: color('mal'), color: '#FFFFFF' },
          { texto: 'Por calificar', fondo: color('borde'), color: color('texto') },
        ], { ancho, valorAncho: 0 }),
        barras(t.preguntas.map((q) => ({ etiqueta: `${q.id} · ${q.texto}`, valor: q.media, tono: q.media !== null && q.media < 0.6 ? 'mal' : 'azul' })), { ancho, arriba: true }),
      ], 12),
    });
  }

  const c = m.control;
  if (c.cobertura.length) {
    const variosBimestres = new Set(c.cobertura.map((x) => x.bimestre)).size > 1;
    s.push({
      id: 'control-cobertura', titulo: 'Control oral: cobertura',
      nota: 'Estudiantes con al menos un control oral en el bimestre. La meta es el 100 %.',
      dibujar: (ancho) => barras(c.cobertura.map((x) => ({
        etiqueta: m.unCurso ? `${variosBimestres ? `B${x.bimestre}` : 'Curso'}` : `${x.curso}${variosBimestres ? ` · B${x.bimestre}` : ''}`,
        valor: x.cobertura, texto: `${x.conControl}/${x.total}`, tono: x.cobertura >= 1 ? 'ok' : tonoDe(x.metodologia),
        nota: x.quedan ? (x.quedan === 1 ? 'queda 1 sesión del bimestre' : `quedan ${x.quedan} sesiones del bimestre`) : null,
      })), { ancho }),
    });
  }
  const respuestas = c.respuestas.reduce((x, r) => x + r.n, 0);
  const aprobaciones = c.aprobacion.aprobados + c.aprobacion.noAprobados;
  if (respuestas || aprobaciones) {
    s.push({
      id: 'control-resultados', titulo: 'Control oral: resultados',
      nota: `${plural(c.controles, 'control', 'controles')}${c.salieron ? `; ${c.salieron === 1 ? '1 estudiante salió' : `${c.salieron} estudiantes salieron`} de la clase` : ''}. Por concepto, cuando se registró (opcional en cada pregunta)${c.sinConcepto ? `; ${plural(c.sinConcepto, 'respuesta', 'respuestas')} sin concepto` : ''}.`,
      dibujar: (ancho) => apilar([
        respuestas ? apiladas([{ etiqueta: `${nombre('TRAD')}: respuestas`, conteos: c.respuestas.map((r) => r.n), texto: pct(c.media) }],
          segmentosEscala(c.respuestas.map((r) => r.nivel), c.respuestas.map((r, i, x) => (i === x.length - 1 ? `${r.nivel} (máx.)` : String(r.nivel)))), { ancho }) : null,
        aprobaciones ? apiladas([{ etiqueta: `${nombre('SQI')}: controles`, conteos: [c.aprobacion.noAprobados, c.aprobacion.aprobados], texto: pct(c.aprobacion.aprobados / aprobaciones) }],
          [{ texto: 'No aprobado', fondo: color('mal'), color: '#FFFFFF' }, { texto: 'Aprobado', fondo: color('ok'), color: '#FFFFFF' }], { ancho }) : null,
        ...(c.conceptos.length ? [
          subtitulo('Por concepto (de menor a mayor)', ancho),
          barras(c.conceptos.map((k) => ({
            etiqueta: `${k.codigo} · ${k.texto}`, valor: k.media, tono: k.media !== null && k.media < 0.6 ? 'mal' : tonoDe(k.metodologia),
            nota: `${dos ? `${nombre(k.metodologia)} · ` : ''}${k.califica ? `${plural(k.n, 'pregunta', 'preguntas')} · puntaje medio` : `${plural(k.n, 'control', 'controles')} · aprobados`}`,
          })), { ancho, arriba: true }),
        ] : []),
      ], 10),
    });
  }

  if (m.preparatorio.length) {
    const p = cfg.preparatorio;
    const nivelesTexto = { [Math.max(...p.escala)]: 'Completo', ...p.nombres_novedad };
    s.push({
      id: 'preparatorio', titulo: `Trabajo preparatorio (${nombre('TRAD')})`,
      nota: 'Por sesión: nivel de la revisión en la puerta y quienes faltaron. A la derecha, el promedio de quienes vinieron.',
      dibujar: (ancho) => {
        const niveles = m.preparatorio[0].niveles.map((n) => n.nivel);
        const segs = [...segmentosEscala([...niveles].reverse(), [...niveles].reverse().map((n) => nivelesTexto[n] ?? String(n)))].reverse();
        return apiladas(m.preparatorio.map((x) => ({ etiqueta: x.codigo, conteos: [...x.niveles.map((n) => n.n), x.faltas], texto: pct(x.media) })),
          [...segs, { texto: 'Faltó', fondo: color('borde'), color: color('texto') }], { ancho });
      },
    });
  }

  const f = m.feriados;
  if (f.total) {
    s.push({
      id: 'feriados', titulo: 'Feriados y sesiones sin clase',
      nota: f.sesiones
        ? `${plural(f.sesiones, 'sesión perdida', 'sesiones perdidas')} en ${f.cursos.length} de ${f.total} cursos (${f.conNota} con nota). Esas actividades no cuentan y su componente se renormaliza; además quedan menos sesiones para el control oral.${f.recuperadas ? ` ${plural(f.recuperadas, 'recuperación realizada', 'recuperaciones realizadas')}.` : ''}`
        : 'Ningún curso del alcance perdió sesiones en este periodo.',
      dibujar: (ancho) => apilar(f.cursos.map((x) => {
        const eventos = x.eventos.map((e) => `${e.codigo}${e.tc ? ` (y ${e.tc})` : ''}: ${e.motivo}${e.recuperaciones.realizadas ? ` · ${plural(e.recuperaciones.realizadas, 'recuperación', 'recuperaciones')}` : ''}`);
        const control = x.control.filter((k) => k.disponibles < k.previstas).map((k) => `control oral en ${k.disponibles} de ${k.previstas} sesiones del B${k.bimestre}`);
        return parrafo(`${x.curso}: ${[...eventos, ...control].join(' · ')}`, { ancho, tam: 12.5 });
      }), 6),
    });
  }

  if (m.cursosComparados.length > 1) {
    const conTC = m.cursosComparados.some((x) => x.trabajos !== null);
    const conPrep = m.cursosComparados.some((x) => x.preparatorio !== null);
    s.push({
      id: 'cursos', titulo: 'Comparación entre cursos',
      nota: 'Promedios normalizados, en %: asistencia, nota de grupo en prácticas y talleres, TC, cobertura del control oral y preparatorio. Compara mejor dentro de la misma metodología.',
      dibujar: (ancho) => {
        // En el teléfono no caben la metodología ni la franja (están en las secciones de asistencia).
        const angosto = ancho < 520;
        const v = (x) => (x === null || x === undefined ? '—' : angosto ? String(Math.round(x * 100)) : pct(x));
        const columnas = [
          { texto: 'Curso', ancho: 1.3 },
          ...(angosto ? [] : [{ texto: 'Met.', ancho: 0.8 }, { texto: 'Franja', ancho: 1.25 }]),
          { texto: 'Asist.', ancho: 0.85, alinear: 'end' }, { texto: 'Práct.', ancho: 0.85, alinear: 'end' }, { texto: 'Taller', ancho: 0.85, alinear: 'end' },
          ...(conTC ? [{ texto: 'TC', ancho: 0.7, alinear: 'end' }] : []),
          { texto: 'Control', ancho: 0.95, alinear: 'end' },
          ...(conPrep ? [{ texto: 'Prep.', ancho: 0.8, alinear: 'end' }] : []),
        ];
        return tabla(columnas, m.cursosComparados.map((x) => [
          x.curso,
          ...(angosto ? [] : [x.metodologia === 'SQI' ? 'SQI' : nombre(x.metodologia), x.franja.replace('–', '-')]),
          v(x.asistencia), v(x.practicas), v(x.talleres),
          ...(conTC ? [x.trabajos === null ? '' : v(x.trabajos)] : []),
          x.cobertura ? v(x.cobertura.valor) : '—',
          ...(conPrep ? [x.preparatorio === null ? '' : v(x.preparatorio)] : []),
        ]), { ancho, tam: angosto ? 11.5 : 12 });
      },
    });
  }

  if (m.comparacion) {
    const advertencia = m.advertencias.find((x) => x.id === 'metodologias')?.texto;
    s.push({
      id: 'metodologias', titulo: 'Comparación entre metodologías',
      nota: 'Solo notas normalizadas de componentes equivalentes: la nota de grupo en prácticas y en talleres. Nunca la nota total.',
      dibujar: (ancho) => apilar([
        ...m.comparacion.map((comp) => apilar([
          subtitulo(comp.nombre, ancho),
          barras(comp.porMetodologia.map((x) => ({
            etiqueta: nombre(x.metodologia), valor: x.media, tono: tonoDe(x.metodologia),
            nota: x.grupos ? `${plural(x.grupos, 'evaluación de grupo', 'evaluaciones de grupo')} en ${plural(x.cursos, 'curso', 'cursos')}` : 'sin evaluaciones',
          })), { ancho }),
        ], 6)),
        advertencia ? parrafo(advertencia, { ancho, tam: 12.5, tono: 'aviso', caja: 'avisoFondo' }) : null,
      ], 12),
    });
  }

  const r = m.riesgo.conteo;
  const umbral = cfg.metricas.riesgo;
  s.push({
    id: 'riesgo', titulo: 'Seguimiento',
    nota: `Estudiantes con ${umbral.faltas} o más faltas, con menos del ${Math.round(umbral.rendimiento_bajo * 100)} % en lo evaluado (desde ${umbral.rendimiento_minimo_actividades} actividades con nota) o sin control oral cuando ya no quedan sesiones; grupos con promedio bajo el ${Math.round(umbral.grupo_bajo * 100)} % o con penalización total. Aquí solo los conteos: los nombres están en la vista del profesor.`,
    dibujar: (ancho) => numeros([
      { valor: r.faltas, texto: `con ${umbral.faltas}+ faltas` },
      { valor: r.rendimiento, texto: `bajo ${Math.round(umbral.rendimiento_bajo * 100)} %` },
      { valor: r.control, texto: 'sin control oral' },
      { valor: r.grupos, texto: 'grupos por revisar' },
    ], { ancho }),
  });

  return s;
}

// ---------- Lámina para presentar (imagen o PDF) ----------

export const LAMINA = { ancho: 720, alto: 1018, margen: 36 };

/** Encabezado de la lámina: título, alcance y periodo, fecha y avisos. */
function encabezado({ titulo, detalle, fecha, demo, presentar }, ancho) {
  return apilar([
    parrafo(titulo, { ancho, tam: 22, peso: 700 }),
    parrafo(detalle, { ancho, tam: 13, tono: 'tenue' }),
    parrafo([`Generado el ${fecha}.`, presentar, demo ? 'Demostración: datos ficticios.' : null].filter(Boolean).join(' '), { ancho, tam: 11.5, tono: demo ? 'aviso' : 'tenue' }),
  ], 4);
}

function bloque(seccion, ancho) {
  const cabeza = parrafo(seccion.titulo, { ancho, tam: 15, peso: 700 });
  const nota = seccion.nota ? parrafo(seccion.nota, { ancho, tam: 11.5, tono: 'tenue' }) : null;
  const cuerpo = seccion.dibujar(ancho);
  const b = apilar([cabeza, nota, cuerpo], 8);
  return { svg: `<line x1="0" x2="${ancho}" y1="-10" y2="-10" style="stroke:${color('borde')}" stroke-width="1"/>${b.svg}`, alto: b.alto };
}

/**
 * Lámina en páginas A4 (SVG por página), sin cortar una sección entre páginas.
 * `cabecera`: { titulo, detalle, fecha, demo, presentar }. Devuelve [svg].
 */
export function laminaEnPaginas(secciones, cabecera, { ancho = LAMINA.ancho, alto = LAMINA.alto, margen = LAMINA.margen } = {}) {
  const util = ancho - 2 * margen;
  const pie = 22;
  const disponible = alto - 2 * margen - pie;
  const piezas = [encabezado(cabecera, util), ...secciones.map((s) => bloque(s, util))];
  const paginas = [];
  let actual = [];
  let y = 0;
  const cerrar = () => { if (actual.length) paginas.push(actual); actual = []; y = 0; };
  for (const p of piezas) {
    const sep = actual.length ? 26 : 0;
    if (actual.length && y + sep + p.alto > disponible) cerrar();
    const escala = p.alto > disponible ? disponible / p.alto : 1;
    actual.push({ ...p, y: y + (actual.length ? 26 : 0), escala });
    y += (actual.length > 1 ? 26 : 0) + p.alto * escala;
  }
  cerrar();
  return paginas.map((pagina, i) => {
    const cuerpo = pagina.map((p) => `<g transform="translate(${margen} ${margen + p.y})${p.escala < 1 ? ` scale(${p.escala})` : ''}">${p.svg}</g>`).join('');
    const numero = texto(ancho - margen, alto - margen + 6, `${cabecera.titulo} · ${i + 1} de ${paginas.length}`, { tam: 10, tono: 'tenue', ancla: 'end' });
    return documento({ svg: cuerpo + numero, alto }, ancho, { fondo: '#FFFFFF', titulo: cabecera.titulo });
  });
}

/** Lámina continua (una sola imagen larga). */
export function laminaContinua(secciones, cabecera, { ancho = LAMINA.ancho, margen = LAMINA.margen } = {}) {
  const util = ancho - 2 * margen;
  const cuerpo = apilar([encabezado(cabecera, util), ...secciones.map((s) => bloque(s, util))], 30);
  return documento({ svg: `<g transform="translate(${margen} ${margen})">${cuerpo.svg}</g>`, alto: cuerpo.alto + 2 * margen }, ancho, { fondo: '#FFFFFF', titulo: cabecera.titulo });
}

/** Texto plano de una lámina (para comprobar en las pruebas que no lleva nombres). */
export function textoDeSvg(svg) {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]).join('\n');
}

