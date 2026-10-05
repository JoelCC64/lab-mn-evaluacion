// Lectura de /config desde el disco, manifiesto y validación (esquemas JSON + reglas cruzadas).
// Solo para Node (scripts y pruebas). La app usa src/nucleo/config.js con fetch.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { armarConfig, bimestreDeActividad } from '../../src/nucleo/config.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_CONFIG = path.join(RAIZ, 'config');

const json = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const listar = (dir, raiz = DIR_CONFIG) =>
  existsSync(path.join(raiz, dir))
    ? readdirSync(path.join(raiz, dir)).filter((f) => f.endsWith('.json')).sort().map((f) => `${dir}/${f}`)
    : [];

/** Manifiesto con la lista de archivos de configuración y una versión (hash del contenido). */
export function construirManifiesto(raiz = DIR_CONFIG) {
  const sueltos = readdirSync(raiz).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
  const unico = (prefijo) => {
    const hallados = sueltos.filter((f) => f.startsWith(prefijo));
    if (hallados.length !== 1) {
      throw new Error(`Debe haber exactamente un archivo ${prefijo}*.json en /config (hay ${hallados.length})`);
    }
    return hallados[0];
  };
  const m = {
    aviso: 'Generado por «npm run config». No editar a mano.',
    version: '',
    semestre: unico('semestre-'),
    cursos: unico('cursos-'),
    catalogo: 'actividades-catalogo.json',
    cronogramas: listar('cronogramas', raiz),
    esquemas: listar('esquemas', raiz),
    actividades: listar('actividades', raiz),
    sqi_aspectos: 'sqi/aspectos.json',
    sqi_aspectos_por_practica: 'sqi/aspectos-por-practica.json',
    control_oral: 'control-oral.json',
    trabajo_preparatorio: 'trabajo-preparatorio.json',
    planificacion_conocimiento: 'planificacion-conocimiento.json',
    asistencia: 'asistencia.json',
    excel: 'excel.json',
    feedback: 'feedback.json',
    metricas: 'metricas.json',
    respaldo: 'respaldo.json',
  };
  const h = createHash('sha256');
  for (const ruta of archivosDelManifiesto(m)) {
    h.update(ruta);
    h.update(readFileSync(path.join(raiz, ruta)));
  }
  m.version = h.digest('hex').slice(0, 12);
  return m;
}

export function archivosDelManifiesto(m) {
  return [m.semestre, m.cursos, m.catalogo, ...m.cronogramas, ...m.esquemas, ...m.actividades,
    m.sqi_aspectos, m.sqi_aspectos_por_practica, m.control_oral, m.trabajo_preparatorio,
    m.planificacion_conocimiento, m.asistencia, m.excel, m.feedback, m.metricas, m.respaldo];
}

/** Esquema JSON que valida cada archivo del manifiesto. */
export function esquemaParaArchivo(ruta, m) {
  if (ruta === m.semestre) return 'semestre.schema.json';
  if (ruta === m.cursos) return 'cursos.schema.json';
  if (ruta === m.catalogo) return 'catalogo.schema.json';
  if (ruta.startsWith('cronogramas/')) return 'cronograma.schema.json';
  if (ruta.startsWith('esquemas/')) return 'esquema-nota.schema.json';
  if (ruta.startsWith('actividades/')) return 'actividad.schema.json';
  return {
    [m.sqi_aspectos]: 'aspectos-sqi.schema.json',
    [m.sqi_aspectos_por_practica]: 'aspectos-por-practica.schema.json',
    [m.control_oral]: 'control-oral.schema.json',
    [m.trabajo_preparatorio]: 'trabajo-preparatorio.schema.json',
    [m.planificacion_conocimiento]: 'planificacion-conocimiento.schema.json',
    [m.asistencia]: 'asistencia.schema.json',
    [m.excel]: 'excel.schema.json',
    [m.feedback]: 'feedback.schema.json',
    [m.metricas]: 'metricas.schema.json',
    [m.respaldo]: 'respaldo.schema.json',
  }[ruta];
}

export function crearValidador(raiz = DIR_CONFIG) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false, allowUnionTypes: true });
  for (const f of readdirSync(path.join(raiz, 'schemas')).filter((x) => x.endsWith('.schema.json'))) {
    ajv.addSchema(json(path.join(raiz, 'schemas', f)), f);
  }
  return (nombreEsquema, datos) => {
    const validar = ajv.getSchema(nombreEsquema);
    if (!validar) throw new Error(`No existe el esquema ${nombreEsquema}`);
    const ok = validar(datos);
    return ok ? [] : validar.errors.map((e) => `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);
  };
}

/** Lee la configuración desde el disco con el mismo armado que usa la app. */
export function leerConfigDisco(raiz = DIR_CONFIG) {
  const m = construirManifiesto(raiz);
  const leer = (r) => json(path.join(raiz, r));
  return {
    manifiesto: m,
    archivos: Object.fromEntries(archivosDelManifiesto(m).map((r) => [r, leer(r)])),
    cfg: armarConfig({
      version: m.version,
      semestre: leer(m.semestre),
      cursos: leer(m.cursos).cursos,
      catalogo: leer(m.catalogo),
      cronogramas: m.cronogramas.map(leer),
      esquemas: m.esquemas.map(leer),
      actividades: m.actividades.map(leer),
      sqi: { aspectos: leer(m.sqi_aspectos), porPractica: leer(m.sqi_aspectos_por_practica) },
      controlOral: leer(m.control_oral),
      preparatorio: leer(m.trabajo_preparatorio),
      pyc: leer(m.planificacion_conocimiento),
      asistencia: leer(m.asistencia),
      excel: leer(m.excel),
      feedback: leer(m.feedback),
      metricas: leer(m.metricas),
      respaldo: leer(m.respaldo),
    }),
  };
}

const casiIgual = (a, b) => Math.abs(a - b) < 1e-9;

/** Partes evaluables de una actividad: criterios (Clásica), aspectos (SQI), «integral» (taller) o preguntas (TC). */
function partesDeActividad(a) {
  if (a.tipo === 'practica') return a.criterios ? a.criterios.map((c) => c.id) : a.aspectos_aplicables;
  if (a.tipo === 'taller') return ['integral'];
  return (a.preguntas ?? []).map((p) => p.id);
}
const maximo = (escala) => Math.max(...escala);

/** Reglas que un esquema JSON no puede expresar (sumas, referencias cruzadas). Devuelve la lista de errores. */
export function validarSemantica(cfg) {
  const err = [];
  const { catalogo } = cfg;

  // Cursos
  const paralelos = cfg.cursos.map((c) => c.paralelo);
  if (new Set(paralelos).size !== paralelos.length) err.push('cursos: paralelos repetidos');
  for (const c of cfg.cursos) {
    if (!cfg.cronogramas[`${c.cronograma}-${c.metodologia}`]) err.push(`cursos: ${c.paralelo} no tiene cronograma ${c.cronograma}-${c.metodologia}`);
    if (c.inicio >= c.fin) err.push(`cursos: ${c.paralelo} termina antes de empezar`);
  }

  // Cronogramas
  for (const cr of Object.values(cfg.cronogramas)) {
    if (cr.id !== `${cr.cronograma}-${cr.metodologia}`) err.push(`cronograma ${cr.id}: id no coincide con cronograma y metodología`);
    const semanas = cr.semanas.map((s) => s.semana);
    const esperadas = Array.from({ length: cfg.semestre.semanas }, (_, i) => i + 1);
    if (semanas.join() !== esperadas.join()) err.push(`cronograma ${cr.id}: debe listar las semanas 1 a ${cfg.semestre.semanas} en orden`);
    for (const s of cr.semanas) {
      for (const cod of s.actividades ?? []) {
        if (!catalogo[cod]) { err.push(`cronograma ${cr.id}: ${cod} no está en el catálogo`); continue; }
        if (catalogo[cod].tipo === 'trabajo_casa' && cr.metodologia !== 'SQI') err.push(`cronograma ${cr.id}: ${cod} solo existe en SQI`);
        if (catalogo[cod].tipo !== 'sin_nota' && !catalogo[cod].sin_nota && !bimestreDeActividad(cfg, cod, cr.metodologia)) {
          err.push(`cronograma ${cr.id}: ${cod} no aparece en ningún esquema de nota ${cr.metodologia}`);
        }
      }
      const sesiones = (s.actividades ?? []).filter((c) => ['practica', 'taller', 'sin_nota'].includes(catalogo[c]?.tipo));
      if (s.actividades && sesiones.length !== 1) err.push(`cronograma ${cr.id}, semana ${s.semana}: debe haber exactamente una sesión (práctica, taller o sin nota)`);
    }
  }

  // Esquemas de nota
  for (const e of Object.values(cfg.esquemas)) {
    if (e.id !== `${e.metodologia}_B${e.bimestre}`) err.push(`esquema ${e.id}: id no coincide con metodología y bimestre`);
    const total = e.componentes.reduce((s, c) => s + c.valor, 0);
    if (!casiIgual(total, e.total)) err.push(`esquema ${e.id}: los componentes suman ${total}, no ${e.total}`);
    for (const c of e.componentes) {
      for (const cod of Object.keys(c.items ?? {})) {
        if (['trabajo_preparatorio', 'control_oral'].includes(cod)) continue;
        if (!catalogo[cod]) err.push(`esquema ${e.id}: ${cod} no está en el catálogo`);
      }
      if (c.items && ['practicas', 'trabajos_casa'].includes(c.id)) {
        const s = Object.values(c.items).reduce((a, b) => a + b, 0);
        if (!casiIgual(s, 1)) err.push(`esquema ${e.id}, ${c.id}: las ponderaciones suman ${s}, no 1`);
      }
      if (c.id === 'planificacion_conocimiento') {
        const s = Object.values(c.items).reduce((a, b) => a + b, 0);
        if (!casiIgual(s, 1)) err.push(`esquema ${e.id}: Planificación y conocimiento suma ${s}, no 1`);
        if (!casiIgual(c.items.trabajo_preparatorio, cfg.pyc.pesos.trabajo_preparatorio) || !casiIgual(c.items.control_oral, cfg.pyc.pesos.control_oral)) {
          err.push(`esquema ${e.id}: pesos de Planificación y conocimiento distintos de planificacion-conocimiento.json`);
        }
      }
      if (c.secciones) {
        const s = Object.values(c.secciones).reduce((a, b) => a + b, 0);
        if (!casiIgual(s, 1)) err.push(`esquema ${e.id}: las secciones suman ${s}, no 1`);
      }
    }
  }

  // Actividades
  const vistos = new Set();
  for (const a of Object.values(cfg.actividades)) {
    const metodologias = Array.isArray(a.metodologia) ? a.metodologia : [a.metodologia];
    const id = `actividad ${a.id}`;
    const cat = catalogo[a.codigo];
    if (!cat) { err.push(`${id}: el código ${a.codigo} no está en el catálogo`); continue; }
    if (cat.tipo !== a.tipo) err.push(`${id}: tipo ${a.tipo} distinto del catálogo (${cat.tipo})`);
    for (const m of metodologias) {
      const clave = `${a.codigo}/${m}`;
      if (vistos.has(clave)) err.push(`${id}: hay dos configuraciones de ${a.codigo} para ${m}`);
      vistos.add(clave);
      const b = bimestreDeActividad(cfg, a.codigo, m);
      if (b !== a.bimestre) err.push(`${id}: bimestre ${a.bimestre} distinto del esquema ${m} (${b})`);
    }

    if (a.tipo === 'practica' && a.metodologia === 'TRAD') {
      const s = a.criterios.reduce((x, c) => x + c.peso, 0);
      if (!casiIgual(s, 1)) err.push(`${id}: los pesos de los criterios suman ${s}, no 1`);
      const comp = cfg.esquemas[`TRAD_B${a.bimestre}`]?.componentes.find((c) => c.id === a.componente);
      for (const c of a.criterios) {
        if (comp?.secciones && !casiIgual(comp.secciones[c.id] ?? -1, c.peso)) err.push(`${id}: el peso de ${c.id} no coincide con las secciones del esquema`);
        if (maximo(c.escala) !== 4 || Math.min(...c.escala) !== 0) err.push(`${id}: ${c.id} debe usar la escala 0–4`);
        for (const nivel of Object.keys(c.niveles)) {
          if (!c.escala.includes(Number(nivel))) err.push(`${id}: el nivel ${nivel} de ${c.id} no está en la escala`);
        }
      }
      const ids = new Set(a.criterios.map((c) => c.id));
      for (const t of a.etiquetas ?? []) if (!ids.has(t.criterio)) err.push(`${id}: la etiqueta ${t.id} apunta a un criterio inexistente (${t.criterio})`);
    }

    if (a.tipo === 'practica' && a.metodologia === 'SQI') {
      const esperados = cfg.sqi.porPractica[a.codigo];
      if (!esperados || esperados.join() !== a.aspectos_aplicables.join()) err.push(`${id}: aspectos aplicables distintos de los oficiales (${esperados?.join(', ')})`);
      for (const asp of a.aspectos_aplicables) if (!cfg.sqi.aspectos[asp]) err.push(`${id}: aspecto ${asp} no está en el catálogo SQI`);
      for (const k of Object.keys(a.indicadores ?? {})) if (!a.aspectos_aplicables.includes(k)) err.push(`${id}: indicadores de un aspecto que no aplica (${k})`);
      for (const t of a.etiquetas ?? []) if (!a.aspectos_aplicables.includes(t.aspecto)) err.push(`${id}: la etiqueta ${t.id} apunta a un aspecto que no aplica (${t.aspecto})`);
    }

    if (a.tipo === 'taller') {
      const s = a.pesos.asistencia_permanencia + a.pesos.evaluacion_integral;
      if (!casiIgual(s, 1)) err.push(`${id}: los pesos del taller suman ${s}, no 1`);
    }

    if (a.tipo === 'trabajo_casa') {
      if (cat.practica !== a.practica) err.push(`${id}: práctica ${a.practica} distinta del catálogo (${cat.practica})`);
      if (!a.sin_nota) {
        const total = a.preguntas.reduce((x, p) => x + maximo(p.puntajes), 0);
        if (!casiIgual(total, a.escala_total)) err.push(`${id}: los puntajes máximos suman ${total}, no ${a.escala_total}`);
        if (a.escala_total !== 10) err.push(`${id}: los TC se califican sobre 10`);
        for (const p of a.preguntas) {
          const ordenados = [...p.puntajes].sort((x, y) => y - x);
          if (ordenados.join() !== p.puntajes.join() || p.puntajes.at(-1) !== 0) err.push(`${id}: la pregunta ${p.id} debe listar sus puntajes de mayor a menor y terminar en 0`);
        }
        const ids = a.preguntas.map((p) => p.id);
        if (new Set(ids).size !== ids.length) err.push(`${id}: preguntas repetidas`);
        for (const t of a.etiquetas ?? []) if (!ids.includes(t.pregunta)) err.push(`${id}: la etiqueta ${t.id} apunta a una pregunta inexistente (${t.pregunta})`);
        const comp = cfg.esquemas[`SQI_B${a.bimestre}`]?.componentes.find((c) => c.id === 'trabajos_casa');
        if (!comp || !casiIgual(comp.items[a.codigo] ?? -1, a.ponderacion)) err.push(`${id}: la ponderación ${a.ponderacion} no coincide con el esquema SQI_B${a.bimestre}`);
      } else if (!(cfg.esquemas[`SQI_B${a.bimestre}`]?.componentes.find((c) => c.id === 'trabajos_casa')?.sin_nota ?? []).includes(a.codigo)) {
        err.push(`${id}: está sin nota, pero el esquema no lo lista en «sin_nota»`);
      }
    }
  }

  // Plantillas de feedback (Fase 7): cada plantilla apunta a una etiqueta o a una parte que existen en la actividad.
  for (const a of Object.values(cfg.actividades)) {
    if (!a.feedback) continue;
    const id = `actividad ${a.id}`;
    const etiquetas = new Map((a.etiquetas ?? []).map((t) => [t.id, t]));
    for (const [tid, p] of Object.entries(a.feedback.etiquetas ?? {})) {
      const t = etiquetas.get(tid);
      if (!t) { err.push(`${id}: el feedback tiene una plantilla para una etiqueta que no existe (${tid})`); continue; }
      if (t.signo === '+' && (p.mejorar || p.reforzar)) err.push(`${id}: la etiqueta positiva ${tid} no lleva «mejorar» ni «reforzar»`);
      if (t.signo === '-' && p.mejor) err.push(`${id}: la etiqueta negativa ${tid} no lleva «mejor»`);
    }
    const partes = partesDeActividad(a);
    for (const pid of Object.keys(a.feedback.partes ?? {})) {
      if (!partes.includes(pid)) err.push(`${id}: el feedback tiene una plantilla para una parte que no existe (${pid})`);
    }
  }
  for (const k of Object.keys(cfg.feedback.partes.SQI)) {
    if (k !== 'integral' && !cfg.sqi.aspectos[k]) err.push(`feedback: ${k} no es un aspecto SQI`);
  }

  // Conceptos del control oral (Fase 8): ids únicos en cada actividad.
  for (const a of Object.values(cfg.actividades)) {
    const ids = (a.conceptos_control ?? []).map((c) => c.id);
    if (new Set(ids).size !== ids.length) err.push(`actividad ${a.id}: conceptos del control repetidos`);
  }

  // Control oral, preparatorio y Planificación y conocimiento
  const s = cfg.pyc.pesos.trabajo_preparatorio + cfg.pyc.pesos.control_oral;
  if (!casiIgual(s, 1)) err.push(`planificacion-conocimiento: los pesos suman ${s}, no 1`);
  for (const n of cfg.preparatorio.novedades) if (!cfg.preparatorio.escala.includes(n)) err.push(`trabajo-preparatorio: la novedad ${n} no está en la escala`);
  if (!cfg.preparatorio.escala.includes(cfg.preparatorio.por_defecto_presentes)) err.push('trabajo-preparatorio: el valor por defecto no está en la escala');
  if (Math.max(...cfg.controlOral.estudiantes_por_sesion) > cfg.controlOral.aviso_si_sugerido_mayor_que) err.push('control-oral: el aviso debe ser al menos el máximo de estudiantes por sesión');

  return err;
}
