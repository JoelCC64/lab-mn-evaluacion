// Feedback (Fase 7): el texto de cada grupo, su versión corta y el resumen del curso de un evento, armados SOLO con
// lo que la app registró: puntajes por criterio o aspecto, etiquetas, nota del profesor (tal cual), control oral y
// puntajes por pregunta de los TC. Las frases salen de la configuración: las plantillas de cada actividad
// (`feedback`) y, por defecto, config/feedback.json, con el tono de cada metodología (Clásica: concreto y
// correctivo; SQI: invita a preguntar). Los textos identifican al grupo solo por su número: nunca llevan nombres ni
// códigos. Funciones puras sobre el contexto del motor.
import { gruposDe, notaControl, notaGrupo, rubrica, unidadTrabajo } from './motor.js';
import { listaDeGrupos } from './grupos.js';
import { seCalificaTrabajo, seEvaluaPorGrupo, sobreDiez, textoPuntos, unidadesDelTrabajo } from './motor-vista.js';
import { enLista, redondear } from './util.js';

/** ¿El evento tiene feedback? Prácticas y talleres evaluados por grupo y TC que se califican, si se hicieron. */
export function tieneFeedback(evento) {
  return evento.estado === 'normal' && (seEvaluaPorGrupo(evento) || seCalificaTrabajo(evento));
}

// ---------- Textos ----------

/** Texto de una plantilla para la metodología: uno común o uno por metodología ({ TRAD, SQI }). */
const porTono = (x, m) => (x !== null && typeof x === 'object' ? x[m] ?? null : x ?? null);
const conPunto = (t) => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
const promedio = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const dos = (x) => String(redondear(x, 2));

/** Primera letra en minúscula para seguir tras dos puntos («Lo mejor: tabla…»), salvo siglas, símbolos o números. */
export function enMinuscula(t) {
  const m = /^([¿¡]?)(\S+)/.exec(t);
  if (!m) return t;
  if (/[\d_]/.test(m[2]) || (m[2].match(/[A-ZÁÉÍÓÚÑ]/g) ?? []).length > 1) return t;
  const i = m[1].length;
  return t.slice(0, i) + t.charAt(i).toLowerCase() + t.slice(i + 1);
}

function tituloEvento(evento) {
  return evento.titulo.startsWith(evento.codigo) ? evento.titulo : `${evento.codigo} ${evento.titulo}`;
}

// ---------- Plantillas ----------

/** Plantilla de una parte de la rúbrica: la de la actividad sobre la de config/feedback.json (por metodología). */
function plantillaParte(ctx, config, id) {
  return { ...(ctx.cfg.feedback.partes[ctx.curso.metodologia]?.[id] ?? {}), ...(config.feedback?.partes?.[id] ?? {}) };
}

/** Plantilla de una pregunta de un TC: la de la actividad sobre la de los TC en config/feedback.json. */
function plantillaPregunta(ctx, config, id) {
  return { ...(ctx.cfg.feedback.trabajo_casa?.[ctx.curso.metodologia] ?? {}), ...(config.feedback?.partes?.[id] ?? {}) };
}

const plantillaEtiqueta = (config, id) => config.feedback?.etiquetas?.[id] ?? {};

// ---------- Lo mejor y a mejorar ----------
// Cada elemento: { texto, sugerencia, reforzar, r (nota/máximo de su parte, para ordenar), orden }.

/** Etiquetas marcadas: las positivas van a «lo mejor» y las negativas a «a mejorar», con las frases de su plantilla. */
function deEtiquetas(etiquetas, { m, config, vinculo, ratio, orden, plantillaDe }) {
  const mejor = [], mejorar = [];
  etiquetas.forEach((t, i) => {
    const pid = vinculo(t);
    const pt = plantillaEtiqueta(config, t.id);
    const pp = pid ? plantillaDe(pid) : {};
    const o = (orden.get(pid) ?? 99) * 100 + i;
    if (t.signo === '+') {
      mejor.push({ texto: porTono(pt.mejor, m) ?? t.texto, sugerencia: porTono(pt.sugerencia, m), orden: o });
    } else {
      mejorar.push({
        texto: porTono(pt.mejorar, m) ?? t.texto,
        sugerencia: porTono(pt.sugerencia, m) ?? porTono(pp.sugerencia, m),
        reforzar: porTono(pt.reforzar, m) ?? porTono(pp.reforzar, m) ?? t.texto,
        r: ratio.get(pid) ?? 1, orden: o,
      });
    }
  });
  return { mejor, mejorar };
}

/** Práctica o taller: etiquetas y partes de la rúbrica (al máximo, «lo mejor»; con nota baja, «a mejorar»). */
function itemsDeRubrica(ctx, config, partes, etiquetas) {
  const m = ctx.curso.metodologia;
  const umbral = ctx.cfg.feedback.umbral_bajo;
  // En un taller la rúbrica tiene una sola parte (la evaluación integral): sus etiquetas se refieren a ella.
  const unica = partes.length === 1 ? partes[0].id : null;
  const vinculo = (t) => t.criterio ?? t.aspecto ?? unica;
  const ratio = new Map(partes.filter((p) => p.valor !== null).map((p) => [p.id, p.valor / p.max]));
  const orden = new Map(partes.map((p, i) => [p.id, i]));
  const plantillaDe = (id) => plantillaParte(ctx, config, id);
  const { mejor, mejorar } = deEtiquetas(etiquetas, { m, config, vinculo, ratio, orden, plantillaDe });
  partes.forEach((p, i) => {
    if (p.valor === null) return;
    const r = p.valor / p.max;
    const pp = plantillaDe(p.id);
    const conEtiqueta = (signo) => etiquetas.some((t) => t.signo === signo && vinculo(t) === p.id);
    // Una etiqueta ya dice lo de su parte: la frase general de la parte solo va si no hay etiquetas que la expliquen.
    if (r === 1 && !conEtiqueta('+') && !conEtiqueta('-')) mejor.push({ texto: porTono(pp.mejor, m) ?? `${p.nombre}: ${p.valor}/${p.max}`, orden: 10000 + i });
    if (r <= umbral && !conEtiqueta('-')) {
      mejorar.push({
        texto: porTono(pp.mejorar, m) ?? `${p.nombre}: ${p.valor}/${p.max}`,
        sugerencia: porTono(pp.sugerencia, m), reforzar: porTono(pp.reforzar, m) ?? p.nombre, r, orden: i * 100 + 99,
      });
    }
  });
  return { mejor, mejorar };
}

/** TC: etiquetas y preguntas (todas las de puntaje completo en un solo elemento; cada una sin puntaje completo, aparte). */
function itemsDeTrabajo(ctx, config, n) {
  const m = ctx.curso.metodologia;
  const marcadas = new Set(n.etiquetas);
  const etiquetas = (config.etiquetas ?? []).filter((t) => marcadas.has(t.id));
  const vinculo = (t) => t.pregunta ?? null;
  const ratio = new Map(n.partes.filter((p) => p.valor !== null).map((p) => [p.id, p.valor / p.max]));
  const orden = new Map(n.partes.map((p, i) => [p.id, i]));
  const plantillaDe = (id) => plantillaPregunta(ctx, config, id);
  const { mejor, mejorar } = deEtiquetas(etiquetas, { m, config, vinculo, ratio, orden, plantillaDe });
  const completas = n.partes.filter((p) => p.valor !== null && p.valor === p.max).map((p) => p.id);
  if (completas.length) mejor.push({ texto: `Puntaje completo en ${enLista(completas)}`, orden: 10000 });
  n.partes.forEach((p, i) => {
    if (p.valor === null || p.valor === p.max) return;
    if (etiquetas.some((t) => t.signo === '-' && t.pregunta === p.id)) return;
    const pp = plantillaDe(p.id);
    mejorar.push({
      texto: porTono(pp.mejorar, m) ?? `${p.id}: ${p.texto} (${textoPuntos(p.valor)}/${textoPuntos(p.max)})`,
      sugerencia: porTono(pp.sugerencia, m), reforzar: porTono(pp.reforzar, m) ?? `${p.id}: ${p.texto}`,
      r: p.valor / p.max, orden: i * 100 + 99,
    });
  });
  return { mejor, mejorar };
}

/** Control oral de los integrantes en el evento (sin decir quién): todos bien, «lo mejor»; alguno mal, «a mejorar». */
function itemControl(ctx, controles) {
  if (!controles.length) return {};
  const m = ctx.curso.metodologia;
  const p = ctx.cfg.feedback.control[m];
  const valores = controles.map((c) => (c.valor !== null && c.valor !== undefined ? c.valor : c.aprobado ? 1 : 0));
  if (valores.every((v) => v >= 0.75)) return { mejor: { texto: porTono(p.mejor, m), orden: 20000 } };
  if (valores.some((v) => v < 0.5)) {
    // Va después de lo del trabajo del grupo (r = 1): el control es individual.
    return { mejorar: { texto: porTono(p.mejorar, m), sugerencia: porTono(p.sugerencia, m), reforzar: porTono(p.reforzar, m), r: 1, orden: 20000 } };
  }
  return {};
}

const porOrden = (a, b) => a.orden - b.orden;
const porGravedad = (a, b) => (a.r ?? 1) - (b.r ?? 1) || a.orden - b.orden;

/**
 * Sugerencias: las de lo que hay que mejorar (sin repetir). Si nada tiene plantilla, la general del tono. En SQI, con
 * la evaluación completa y nada que corregir, una pregunta para extender: la de una etiqueta positiva o una del banco
 * de la actividad.
 */
function sugerenciasDe(ctx, config, { mejor, mejorar, completo }, numero) {
  const m = ctx.curso.metodologia;
  const fb = ctx.cfg.feedback;
  const lista = [];
  const agregar = (t) => { if (t && !lista.includes(t)) lista.push(t); };
  for (const it of mejorar) agregar(it.sugerencia);
  // La sugerencia general es sobre el trabajo: no aplica a «no entregaron» ni a la penalización total.
  if (!lista.length && mejorar.some((it) => !it.sinSugerencia)) agregar(fb.tono[m].sugerencia_general);
  if (!mejorar.length && completo && m === 'SQI') {
    for (const it of mejor) agregar(it.sugerencia);
    const banco = config.preguntas_discusion ?? [];
    if (!lista.length && banco.length) agregar(banco[(Math.max(numero, 1) - 1) % banco.length]);
  }
  return lista.slice(0, fb.maximo.sugerencia);
}

// ---------- Unidades (grupos o, en un TC individual, estudiantes) ----------

function notaDelProfesor(ctx, evento, unidad, id) {
  return ctx.reg.notas.find((n) => n.evento === evento.id && n.unidad === unidad && n.unidad_id === String(id))?.texto ?? null;
}

/** Grupo de una práctica o un taller. */
function unidadDeGrupo(ctx, evento, config, { grupo, integrantes }) {
  const puntos = new Map((ctx.puntajes.get(`${evento.id}|${grupo}`) ?? []).map((p) => [p.aspecto, p.valor]));
  const partes = rubrica(ctx.cfg, config).map((p) => ({ ...p, valor: puntos.has(p.id) ? puntos.get(p.id) : null }));
  const nota = notaGrupo(ctx, evento, grupo);
  const rev = ctx.revisiones.get(`${evento.id}|${grupo}`);
  const marcadas = new Set(ctx.reg.etiquetas.filter((t) => t.evento === evento.id && t.grupo === grupo).map((t) => t.etiqueta));
  const etiquetas = (config.etiquetas ?? []).filter((t) => marcadas.has(t.id));
  const comentario = notaDelProfesor(ctx, evento, 'grupo', grupo);
  const controles = integrantes.map((e) => notaControl(ctx, evento, e.id)).filter((c) => c.estado === 'calculada');
  const { mejor, mejorar } = itemsDeRubrica(ctx, config, partes, etiquetas);
  const ctrl = itemControl(ctx, controles);
  if (ctrl.mejor) mejor.push(ctrl.mejor);
  if (ctrl.mejorar) mejorar.push(ctrl.mejorar);
  if (rev?.penalizacion_total) {
    mejorar.push({ texto: `Penalización total en ${evento.codigo}: ${rev.motivo_penalizacion || 'a criterio del profesor'}. La nota es 0`, r: -1, orden: -1, sinSugerencia: true });
  }
  const esTaller = config.tipo === 'taller';
  const conValor = partes.filter((p) => p.valor !== null);
  let notaTexto, notaCorta;
  if (rev?.penalizacion_total) {
    notaTexto = 'Nota del grupo: 0/10 (penalización total)';
    notaCorta = '0/10 (penalización total)';
  } else if (!nota.completo) {
    const faltan = partes.filter((p) => p.valor === null).map((p) => p.corto);
    notaTexto = `${esTaller ? 'Evaluación integral del grupo' : 'Nota del grupo'}: pendiente${faltan.length && !esTaller ? ` (falta: ${enLista(faltan)})` : ''}`;
    notaCorta = 'nota pendiente';
  } else if (esTaller) {
    notaTexto = `Evaluación integral del grupo: ${partes[0].valor}/${partes[0].max}`;
    notaCorta = `${partes[0].valor}/${partes[0].max}`;
  } else {
    notaTexto = `Nota del grupo: ${sobreDiez(nota.valor)}/10 (${conValor.map((p) => `${p.corto} ${p.valor}/${p.max}`).join(' · ')})`;
    notaCorta = `${sobreDiez(nota.valor)}/10`;
  }
  return {
    unidad: 'grupo', id: grupo, grupo, integrantes,
    vacio: !conValor.length && !etiquetas.length && !comentario && !rev?.penalizacion_total,
    completo: Boolean(nota.completo),
    nota, partes, etiquetas, controles,
    encabezado: `Grupo ${grupo} · ${evento.curso} · ${tituloEvento(evento)}`,
    cabeza: `Grupo ${grupo}`,
    notaTexto, notaCorta, comentario,
    mejor: mejor.sort(porOrden), mejorar: mejorar.sort(porGravedad),
  };
}

/** Grupo (o estudiante) de un TC. */
function unidadDeTrabajo(ctx, evento, config, u) {
  const n = u.nota;
  const comentario = notaDelProfesor(ctx, evento, u.unidad, u.id);
  const total = n.total ?? 10;
  let mejor = [], mejorar = [], notaTexto, notaCorta;
  if (n.registrado && n.entregado === false) {
    mejorar = [{ texto: `No entregaron el ${evento.codigo}: la nota es 0`, r: 0, orden: 0, sinSugerencia: true }];
    notaTexto = `Nota del ${evento.codigo}: 0/${total} (no entregaron)`;
    notaCorta = 'no entregó (0)';
  } else {
    ({ mejor, mejorar } = itemsDeTrabajo(ctx, config, n));
    const conValor = n.partes.filter((p) => p.valor !== null);
    notaTexto = n.completo
      ? `Nota del ${evento.codigo}: ${textoPuntos(n.puntos)}/${total} (${conValor.map((p) => `${p.id} ${textoPuntos(p.valor)}/${textoPuntos(p.max)}`).join(' · ')})`
      : `Nota del ${evento.codigo}: pendiente (${n.faltan.length === 1 ? 'falta 1 pregunta' : `faltan ${n.faltan.length} preguntas`})`;
    notaCorta = n.completo ? `${textoPuntos(n.puntos)}/${total}` : 'nota pendiente';
  }
  const individual = u.unidad === 'estudiante';
  return {
    unidad: u.unidad, id: u.id, grupo: u.grupo, integrantes: u.integrantes.map((i) => i.estudiante),
    vacio: !n.registrado && !comentario,
    completo: Boolean(n.completo),
    nota: n, partes: n.partes, etiquetas: n.etiquetas, controles: [],
    encabezado: individual ? `${tituloEvento(evento)} · ${evento.curso} · trabajo individual` : `Grupo ${u.id} · ${evento.curso} · ${tituloEvento(evento)}`,
    cabeza: individual ? evento.codigo : `Grupo ${u.id}`,
    notaTexto, notaCorta, comentario,
    mejor: mejor.sort(porOrden), mejorar: mejorar.sort(porGravedad),
  };
}

/** Texto completo, con la estructura «lo mejor / a mejorar / sugerencia» y el comentario del profesor tal cual. */
function textoCompleto(ctx, u) {
  const tono = ctx.cfg.feedback.tono[ctx.curso.metodologia];
  const t = tono.titulos;
  const vinetas = (xs) => xs.map((x) => `• ${conPunto(x)}`);
  const lineas = [u.encabezado, u.notaTexto];
  if (u.mejor.length) lineas.push('', t.mejor, ...vinetas(u.mejor));
  if (u.mejorar.length) lineas.push('', t.mejorar, ...vinetas(u.mejorar));
  else if (u.completo) lineas.push('', t.mejorar, ...vinetas([tono.sin_mejorar]));
  if (u.sugerencias.length) lineas.push('', t.sugerencia, ...vinetas(u.sugerencias));
  if (u.comentario) lineas.push('', `Comentario del profesor: ${u.comentario}`);
  return lineas.join('\n');
}

/** Versión corta (2 o 3 líneas) para la retroalimentación oral al inicio del taller. */
function textoCorto(ctx, u) {
  const t = ctx.cfg.feedback.tono[ctx.curso.metodologia].titulos;
  const frase = (titulo, x) => `${titulo}: ${enMinuscula(conPunto(x))}`;
  const lineas = [`${u.cabeza} · ${u.notaCorta}`];
  const medio = [];
  if (u.mejor[0]) medio.push(frase(t.mejor, u.mejor[0]));
  if (u.mejorar[0]) medio.push(frase(t.mejorar, u.mejorar[0]));
  if (!medio.length && u.comentario) medio.push(`Comentario: ${u.comentario}`);
  if (medio.length) lineas.push(medio.join(' '));
  if (u.sugerencias[0]) lineas.push(frase(t.sugerencia, u.sugerencias[0]));
  return lineas.join('\n');
}

/** Completa una unidad con sus sugerencias y textos, y con lo que el profesor editó y copió (tabla `feedback`). */
function terminar(ctx, evento, config, u, guardados) {
  const numero = Number.parseInt(u.grupo ?? '', 10) || 0;
  const conTextos = {
    ...u,
    mejor: u.mejor.slice(0, ctx.cfg.feedback.maximo.mejor),
    sugerencias: sugerenciasDe(ctx, config, u, numero),
  };
  const items = (xs) => xs.map((x) => x.texto);
  const base = { ...conTextos, mejor: items(conTextos.mejor), mejorar: items(conTextos.mejorar) };
  const generado = u.vacio ? '' : textoCompleto(ctx, base);
  const fila = guardados.get(`${u.unidad}|${u.id}`);
  const editado = Boolean(fila?.texto);
  return {
    ...base,
    reforzar: u.mejorar.map((x) => x.reforzar).filter(Boolean),
    generado,
    texto: editado ? fila.texto : generado,
    editado,
    desactualizado: editado && fila.base !== generado,
    copiado: fila?.copiado ?? null,
    corto: u.vacio ? '' : textoCorto(ctx, base),
  };
}

// ---------- Resumen del curso ----------

function resumenDelCurso(ctx, evento, config, unidades) {
  const m = ctx.curso.metodologia;
  const fb = ctx.cfg.feedback;
  const esTC = evento.tipo === 'trabajo_casa';
  const nombre = unidades[0]?.unidad === 'estudiante' ? 'estudiantes' : 'grupos';
  const evaluadas = unidades.filter((u) => !u.vacio);
  const r = { nombre, total: unidades.length, evaluadas: evaluadas.length, completas: 0, promedio: null, partes: [], preguntas: [], etiquetas: [], control: null, noEntregaron: 0, reforzar: [] };

  // Etiquetas más marcadas (en un TC, solo de los trabajos entregados).
  const conEtiquetas = esTC ? evaluadas.filter((u) => u.nota.registrado && u.nota.entregado !== false) : evaluadas;
  const conteo = new Map();
  for (const u of conEtiquetas) for (const t of u.etiquetas) conteo.set(t.id ?? t, (conteo.get(t.id ?? t) ?? 0) + 1);
  r.etiquetas = (config.etiquetas ?? []).filter((t) => conteo.has(t.id))
    .map((t, i) => ({ id: t.id, signo: t.signo, texto: t.texto, n: conteo.get(t.id), i }))
    .sort((a, b) => b.n - a.n || a.i - b.i);

  const candidatos = [];   // qué reforzar, en orden de prioridad
  if (esTC) {
    const entregadas = evaluadas.filter((u) => u.nota.registrado && u.nota.entregado !== false);
    r.noEntregaron = evaluadas.filter((u) => u.nota.registrado && u.nota.entregado === false).length;
    const completas = entregadas.filter((u) => u.nota.completo);
    r.completas = completas.length + r.noEntregaron;
    r.promedio = promedio(completas.map((u) => u.nota.valor));
    r.preguntas = (config.preguntas ?? []).map((q, i) => {
      const max = Math.max(...q.puntajes);
      const valores = entregadas.map((u) => u.nota.partes.find((p) => p.id === q.id)?.valor).filter((v) => v !== null && v !== undefined);
      const pp = plantillaPregunta(ctx, config, q.id);
      return { id: q.id, texto: q.texto, max, n: valores.length, conError: valores.filter((v) => v < max).length,
        promedio: promedio(valores), reforzar: porTono(pp.reforzar, m) ?? `${q.id}: ${q.texto}`, i };
    }).sort((a, b) => (b.n ? b.conError / b.n : 0) - (a.n ? a.conError / a.n : 0) || (a.promedio ?? 0) / a.max - (b.promedio ?? 0) / b.max || a.i - b.i);
    for (const q of r.preguntas) if (q.n && q.conError / q.n >= 0.5) candidatos.push(q.reforzar);
  } else {
    const completas = evaluadas.filter((u) => u.nota.completo);
    r.completas = completas.length;
    r.promedio = promedio(completas.map((u) => u.nota.valor));
    r.partes = rubrica(ctx.cfg, config).map((p, i) => {
      const valores = evaluadas.map((u) => u.partes.find((x) => x.id === p.id)?.valor).filter((v) => v !== null && v !== undefined);
      const pp = plantillaParte(ctx, config, p.id);
      return { id: p.id, nombre: p.nombre, corto: p.corto, max: p.max, n: valores.length, promedio: promedio(valores),
        reforzar: porTono(pp.reforzar, m) ?? p.nombre, i };
    }).sort((a, b) => (a.promedio ?? Infinity) / a.max - (b.promedio ?? Infinity) / b.max || a.i - b.i);
    // Control oral de la sesión (todos los estudiantes con control registrado).
    const controles = ctx.reg.controles.filter((c) => c.evento === evento.id)
      .map((c) => notaControl(ctx, evento, c.estudiante)).filter((c) => c.estado === 'calculada');
    if (controles.length) {
      const califica = Boolean(ctx.cfg.controlOral.califica[m]);
      r.control = califica
        ? { n: controles.length, promedio: promedio(controles.map((c) => c.valor)) }
        : { n: controles.length, aprobados: controles.filter((c) => c.aprobado).length };
    }
  }

  // Qué reforzar: TC con más errores, etiquetas negativas repetidas, partes débiles y control oral.
  const minimo = Math.min(2, Math.max(evaluadas.length, 1));
  for (const e of r.etiquetas) {
    if (e.signo !== '-' || e.n < minimo) continue;
    const t = (config.etiquetas ?? []).find((x) => x.id === e.id);
    const pid = t.criterio ?? t.aspecto ?? t.pregunta ?? (r.partes.length === 1 ? r.partes[0].id : null);
    const pp = pid ? (esTC ? plantillaPregunta(ctx, config, pid) : plantillaParte(ctx, config, pid)) : {};
    candidatos.push(porTono(plantillaEtiqueta(config, e.id).reforzar, m) ?? porTono(pp.reforzar, m) ?? e.texto);
  }
  for (const p of r.partes) if (p.n && p.promedio / p.max <= fb.umbral_bajo) candidatos.push(p.reforzar);
  if (r.control && (r.control.promedio !== undefined ? r.control.promedio < 0.5 : r.control.aprobados / r.control.n < 0.5)) {
    candidatos.push(porTono(fb.control[m].reforzar, m));
  }
  r.reforzar = [...new Set(candidatos.filter(Boolean))].slice(0, 3);
  r.texto = textoResumen(ctx, evento, config, r);
  return r;
}

function textoResumen(ctx, evento, config, r) {
  const m = ctx.curso.metodologia;
  const esTC = evento.tipo === 'trabajo_casa';
  const esTaller = config.tipo === 'taller';
  const lineas = [`Resumen del curso · ${evento.curso} · ${tituloEvento(evento)}`];
  const cabeza = [`${r.completas} de ${r.total} ${r.nombre} ${esTC ? 'calificados' : 'evaluados'}`];
  if (r.noEntregaron) cabeza.push(`${r.noEntregaron} no ${r.noEntregaron === 1 ? 'entregó' : 'entregaron'}`);
  if (r.promedio !== null) {
    if (esTaller) cabeza.push(`promedio de la evaluación integral ${dos(r.promedio * r.partes[0].max)}/${r.partes[0].max}`);
    else cabeza.push(esTC ? `promedio de los trabajos entregados ${dos(r.promedio * 10)}/10` : `promedio de los grupos ${sobreDiez(r.promedio)}/10`);
  }
  lineas.push(cabeza.join(' · '));
  const partes = r.partes.filter((p) => p.n);
  if (!esTaller && partes.length) {
    lineas.push('', m === 'SQI' ? 'Por aspecto (promedio)' : 'Por sección (promedio)', ...partes.map((p) => `• ${p.nombre}: ${dos(p.promedio)}/${p.max}`));
  }
  const conError = r.preguntas.filter((q) => q.conError > 0).slice(0, 3);
  if (conError.length) {
    lineas.push('', 'Preguntas con más errores', ...conError.map((q) => `• ${q.id} (${q.texto}): ${q.conError} de ${q.n} sin el puntaje completo · promedio ${dos(q.promedio)}/${textoPuntos(q.max)}`));
  }
  if (r.etiquetas.length) {
    lineas.push('', 'Etiquetas más marcadas', ...r.etiquetas.slice(0, 6).map((e) => `• ${e.signo === '+' ? '+' : '−'} ${e.texto}: ${e.n} de ${r.evaluadas} ${r.nombre}`));
  }
  if (r.control) {
    lineas.push('', r.control.promedio !== undefined
      ? `Control oral: ${r.control.n} ${r.control.n === 1 ? 'estudiante' : 'estudiantes'} · promedio ${sobreDiez(r.control.promedio)}/10`
      : `Control oral: ${r.control.aprobados} de ${r.control.n} aprobados`);
  }
  lineas.push('', 'Qué reforzar', ...(r.reforzar.length ? r.reforzar.map((x) => `• ${conPunto(x)}`) : ['• Nada en particular según lo registrado.']));
  return lineas.join('\n');
}

// ---------- Evento ----------

/**
 * Feedback de un evento: { metodologia, titulos, unidades, resumen }, o null si el evento no lleva feedback.
 * Cada unidad: { unidad, id, grupo, integrantes (solo para la pantalla), vacio, notaCorta, mejor, mejorar,
 * sugerencias, comentario, texto (el editado o el generado), generado, editado, desactualizado, copiado, corto }.
 */
export function feedbackDelEvento(ctx, evento) {
  if (!tieneFeedback(evento)) return null;
  const config = ctx.cfg.actividades[evento.config];
  const guardados = new Map((ctx.reg.feedback ?? []).filter((f) => f.evento === evento.id).map((f) => [`${f.unidad}|${f.unidad_id}`, f]));
  const crudas = evento.tipo === 'trabajo_casa'
    ? unidadesDelTrabajo(ctx, evento).filter((u) => u.porCalificar).map((u) => unidadDeTrabajo(ctx, evento, config, u))
    : listaDeGrupos(gruposDe(ctx, evento), ctx.reg.estudiantes).grupos.map((g) => unidadDeGrupo(ctx, evento, config, g));
  const unidades = crudas.map((u) => terminar(ctx, evento, config, u, guardados));
  return {
    metodologia: ctx.curso.metodologia,
    titulos: ctx.cfg.feedback.tono[ctx.curso.metodologia].titulos,
    unidad: evento.tipo === 'trabajo_casa' ? unidadTrabajo(config) : 'grupo',
    unidades,
    resumen: resumenDelCurso(ctx, evento, config, crudas),
  };
}

/** Todos los textos de un evento para copiarlos juntos (los grupos sin evaluar no van). */
export function textosJuntos(fb, campo = 'texto') {
  return fb.unidades.filter((u) => !u.vacio).map((u) => u[campo]).join('\n\n');
}
