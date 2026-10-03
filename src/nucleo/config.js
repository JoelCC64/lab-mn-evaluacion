// Carga y consulta de la configuración (/config). Funciona en el navegador y en Node:
// quien llama entrega `leer(ruta)`, que devuelve el JSON de una ruta relativa a /config.

export async function cargarConfig(leer) {
  const manifiesto = await leer('manifest.json');
  const uno = (ruta) => leer(ruta);
  const varios = async (rutas) => Promise.all(rutas.map((r) => leer(r)));

  const [semestre, cursosArchivo, catalogo, cronogramas, esquemas, actividades, aspectos, porPractica,
    controlOral, preparatorio, pyc, asistencia, excel] = await Promise.all([
    uno(manifiesto.semestre), uno(manifiesto.cursos), uno(manifiesto.catalogo),
    varios(manifiesto.cronogramas), varios(manifiesto.esquemas), varios(manifiesto.actividades),
    uno(manifiesto.sqi_aspectos), uno(manifiesto.sqi_aspectos_por_practica),
    uno(manifiesto.control_oral), uno(manifiesto.trabajo_preparatorio),
    uno(manifiesto.planificacion_conocimiento), uno(manifiesto.asistencia), uno(manifiesto.excel),
  ]);

  return armarConfig({
    version: manifiesto.version, semestre, cursos: cursosArchivo.cursos, catalogo, cronogramas, esquemas,
    actividades, sqi: { aspectos, porPractica }, controlOral, preparatorio, pyc, asistencia, excel,
  });
}

/** Indexa las piezas de configuración ya leídas. */
export function armarConfig(p) {
  const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));
  return {
    version: p.version,
    semestre: p.semestre,
    cursos: p.cursos,
    cursoPorId: Object.fromEntries(p.cursos.map((c) => [c.paralelo, c])),
    catalogo: p.catalogo,
    cronogramas: porId(p.cronogramas),
    esquemas: porId(p.esquemas),
    actividades: porId(p.actividades),
    sqi: p.sqi,
    controlOral: p.controlOral,
    preparatorio: p.preparatorio,
    pyc: p.pyc,
    asistencia: p.asistencia,
    excel: p.excel,
  };
}

const incluye = (metodologia, m) => (Array.isArray(metodologia) ? metodologia.includes(m) : metodologia === m);

/** Configuración de la rúbrica de una actividad para una metodología, o null si aún no existe. */
export function configActividad(cfg, codigo, metodologia) {
  for (const a of Object.values(cfg.actividades)) {
    if (a.codigo === codigo && incluye(a.metodologia, metodologia)) return a;
  }
  return null;
}

export function esquemaDe(cfg, metodologia, bimestre) {
  return cfg.esquemas[`${metodologia}_B${bimestre}`] ?? null;
}

/** Bimestre de una actividad según los esquemas de nota (nunca por fecha). */
export function bimestreDeActividad(cfg, codigo, metodologia) {
  for (const e of Object.values(cfg.esquemas)) {
    if (e.metodologia !== metodologia) continue;
    for (const comp of e.componentes) {
      if ((comp.items && codigo in comp.items) || (comp.sin_nota ?? []).includes(codigo)) return e.bimestre;
    }
  }
  return null;
}

export function tituloActividad(cfg, codigo, metodologia) {
  const t = cfg.catalogo[codigo]?.titulo;
  if (!t) return codigo;
  return typeof t === 'string' ? t : t[metodologia];
}

export function nombreMetodologia(cfg, metodologia) {
  return cfg.semestre.metodologias[metodologia] ?? metodologia;
}

export function cronogramaDe(cfg, curso) {
  return cfg.cronogramas[`${curso.cronograma}-${curso.metodologia}`];
}

/** ¿El trabajo preparatorio o el control oral tienen nota en esta metodología? */
export function preparatorioCalifica(cfg, metodologia) {
  return Boolean(cfg.preparatorio.califica[metodologia]);
}

export function controlCalifica(cfg, metodologia) {
  return Boolean(cfg.controlOral.califica[metodologia]);
}
