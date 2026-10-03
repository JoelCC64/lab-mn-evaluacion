// Lectura del Excel del semestre (Anexo J.1) sobre un libro de ExcelJS ya abierto.
// Lee código, nombre, grupo A/B, metodología, grupo de trabajo, observación y (si existe) asistencia.
// La columna de correo NO se lee. Funciona igual en el navegador y en Node.

import { limpiarTexto, normalizar } from './util.js';

/** Valor simple de una celda de ExcelJS (texto, número, fecha o null). */
export function valorCelda(celda) {
  let v = celda?.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if (Array.isArray(v.richText)) v = v.richText.map((t) => t.text).join('');
    else if ('result' in v) v = v.result ?? null;            // fórmula
    else if ('text' in v) v = v.text;                         // hipervínculo
    else if ('error' in v) v = null;
    else v = null;
  }
  if (typeof v === 'string') {
    const t = limpiarTexto(v);
    return t === '' ? null : t;
  }
  return v;
}

const CORREO = /[^\s@]+@[^\s@]+/g;

/** Quita cualquier correo que se haya colado en un texto (la app nunca guarda «@»). */
export function sinCorreos(texto) {
  if (texto === null || texto === undefined) return texto;
  return String(texto).replace(CORREO, '[correo omitido]').replace(/@/g, ' ');
}

/** Código único como texto (9 dígitos), o null si la celda no tiene un código. */
export function textoCodigo(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : null;
  const t = String(v).replace(/\s+/g, '');
  return t === '' ? null : t;
}

function textoGrupo(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return String(v);
  const t = limpiarTexto(v);
  return t === '' ? null : t;
}

/** Busca la fila de encabezados por su texto y devuelve { fila, columnas: { clave: n° de columna } }. */
export function buscarEncabezados(ws, cfgExcel) {
  const alias = Object.fromEntries(
    Object.entries(cfgExcel.columnas).map(([clave, nombres]) => [clave, nombres.map(normalizar)]),
  );
  const prohibidas = cfgExcel.columnas_que_no_se_leen.map(normalizar);
  for (let r = 1; r <= cfgExcel.buscar_encabezados_hasta_fila; r++) {
    const fila = ws.getRow(r);
    const columnas = {};
    for (let c = 1; c <= Math.max(fila.cellCount, ws.columnCount); c++) {
      const texto = normalizar(valorCelda(fila.getCell(c)) ?? '');
      if (!texto || prohibidas.includes(texto)) continue;
      for (const [clave, nombres] of Object.entries(alias)) {
        if (!(clave in columnas) && nombres.includes(texto)) columnas[clave] = c;
      }
    }
    if (cfgExcel.obligatorias.every((k) => k in columnas)) return { fila: r, columnas };
  }
  return null;
}

/**
 * Lee el Excel del semestre.
 * Devuelve { cursos: { PARALELO: { hoja, estudiantes, avisos } }, avisos, errores, resumen }.
 * Cada estudiante: { codigo, nombre, curso, pendiente, grupo, observacion, numero, fila, cronograma, metodologia, asistencia }.
 */
export function leerExcelSemestre(wb, cfg) {
  const cx = cfg.excel;
  const resultado = { cursos: {}, avisos: [], errores: [], resumen: { hojas: 0, estudiantes: 0, pendientes: 0 } };
  const ignoradas = [...cx.hojas_ignoradas, ...cx.hojas_app].map(normalizar);
  const codigos = new Map(); // código → hoja donde apareció primero

  for (const ws of wb.worksheets) {
    const nombreHoja = limpiarTexto(ws.name);
    const curso = cfg.cursoPorId[nombreHoja] ?? cfg.cursoPorId[nombreHoja.toUpperCase()];
    if (!curso) {
      if (!ignoradas.includes(normalizar(nombreHoja))) {
        resultado.avisos.push(`La hoja «${nombreHoja}» no corresponde a un curso configurado; no se leyó.`);
      }
      continue;
    }
    const hoja = leerHojaCurso(ws, curso, cfg);
    resultado.errores.push(...hoja.errores);
    resultado.avisos.push(...hoja.avisos);
    const estudiantes = [];
    for (const e of hoja.estudiantes) {
      const previo = codigos.get(e.codigo);
      if (previo) {
        resultado.errores.push(`${curso.paralelo}, fila ${e.fila}: el código ${e.codigo} ya aparece en ${previo}; no se leyó esta fila.`);
        continue;
      }
      codigos.set(e.codigo, `${curso.paralelo} (fila ${e.fila})`);
      estudiantes.push(e);
    }
    if (hoja.encabezados) {
      resultado.cursos[curso.paralelo] = { hoja: nombreHoja, filaEncabezados: hoja.encabezados.fila, columnas: Object.keys(hoja.encabezados.columnas), estudiantes };
      resultado.resumen.hojas += 1;
      resultado.resumen.estudiantes += estudiantes.length;
      resultado.resumen.pendientes += estudiantes.filter((e) => e.pendiente).length;
    }
  }

  for (const c of cfg.cursos) {
    if (!resultado.cursos[c.paralelo]) {
      resultado.avisos.push(`No se encontró la hoja del curso ${c.paralelo}; sus estudiantes no cambian.`);
    }
  }
  return resultado;
}

function leerHojaCurso(ws, curso, cfg) {
  const cx = cfg.excel;
  const p = curso.paralelo;
  const out = { estudiantes: [], avisos: [], errores: [], encabezados: null };
  const enc = buscarEncabezados(ws, cx);
  if (!enc) {
    out.errores.push(`${p}: no se encontró la fila de encabezados (${cx.obligatorias.map((k) => `«${cx.columnas[k][0]}»`).join(' y ')}) en las primeras ${cx.buscar_encabezados_hasta_fila} filas.`);
    return out;
  }
  out.encabezados = enc;
  for (const clave of ['grupo', 'cronograma', 'metodologia', 'observacion']) {
    if (!(clave in enc.columnas)) out.avisos.push(`${p}: falta la columna «${cx.columnas[clave][0]}».`);
  }

  const metodologiaEsperada = curso.metodologia;
  const textoMetodologia = Object.fromEntries(Object.entries(cx.metodologia_texto).map(([k, v]) => [normalizar(k), v]));
  const prefijoPendiente = normalizar(cx.pendiente_prefijo);
  let avisoCronograma = false, avisoMetodologia = false, avisoCorreo = false;
  const col = enc.columnas;
  const leer = (fila, clave) => (clave in col ? valorCelda(fila.getCell(col[clave])) : null);

  for (let r = enc.fila + 1; r <= ws.rowCount; r++) {
    const fila = ws.getRow(r);
    const codigoBruto = leer(fila, 'codigo');
    const nombreBruto = leer(fila, 'nombre');
    if (codigoBruto === null && nombreBruto === null) continue; // fila vacía
    const codigo = textoCodigo(codigoBruto);
    if (!codigo) {
      out.errores.push(`${p}, fila ${r}: falta el código único (o no es un número entero); no se leyó la fila.`);
      continue;
    }
    if (!nombreBruto) {
      out.errores.push(`${p}, fila ${r}: falta el nombre del código ${codigo}; no se leyó la fila.`);
      continue;
    }
    if (!/^\d{9}$/.test(codigo)) out.avisos.push(`${p}, fila ${r}: el código ${codigo} no tiene 9 dígitos.`);

    let nombre = limpiarTexto(nombreBruto);
    let observacion = leer(fila, 'observacion');
    if (String(nombre).includes('@') || String(observacion ?? '').includes('@')) {
      nombre = limpiarTexto(sinCorreos(nombre));
      observacion = observacion === null ? null : limpiarTexto(sinCorreos(observacion));
      if (!avisoCorreo) out.avisos.push(`${p}: había correos dentro del nombre o la observación; se omitieron.`);
      avisoCorreo = true;
    }

    const cronograma = leer(fila, 'cronograma');
    if (cronograma !== null && String(cronograma).toUpperCase() !== curso.cronograma && !avisoCronograma) {
      out.avisos.push(`${p}: el Excel dice cronograma «${cronograma}», la configuración dice ${curso.cronograma}. Manda la configuración.`);
      avisoCronograma = true;
    }
    const metodologiaTexto = leer(fila, 'metodologia');
    const metodologia = metodologiaTexto === null ? null : textoMetodologia[normalizar(metodologiaTexto)] ?? null;
    if (metodologiaTexto !== null && metodologia !== metodologiaEsperada && !avisoMetodologia) {
      out.avisos.push(`${p}: el Excel dice metodología «${metodologiaTexto}», la configuración dice ${metodologiaEsperada}. Manda la configuración.`);
      avisoMetodologia = true;
    }

    const numero = leer(fila, 'numero');
    out.estudiantes.push({
      codigo,
      nombre,
      curso: p,
      pendiente: observacion !== null && normalizar(observacion).startsWith(prefijoPendiente),
      grupo: textoGrupo(leer(fila, 'grupo')),
      observacion,
      numero: typeof numero === 'number' ? numero : null,
      fila: r,
      asistencia: leer(fila, 'asistencia'),
    });
  }
  return out;
}

/**
 * Asistencia de la semana 1 (`Asistencia_Semana1_Lab_MN_2026B.xlsx`): misma lectura más la columna «Asistencia».
 * Devuelve { cursos: { PARALELO: { sin_clase: motivo|null, filas: [{ codigo, estado }] } }, avisos, errores }.
 */
export function leerAsistenciaSemana1(wb, cfg) {
  const lectura = leerExcelSemestre(wb, cfg);
  const reglas = cfg.excel.asistencia_semana1.valores.map((v) => ({ ...v, empieza: normalizar(v.empieza) }));
  const salida = { cursos: {}, avisos: [...lectura.avisos], errores: [...lectura.errores] };
  for (const [p, curso] of Object.entries(lectura.cursos)) {
    if (!curso.columnas.includes('asistencia')) {
      salida.errores.push(`${p}: falta la columna «Asistencia»; ¿es el Excel de asistencia de la semana 1?`);
      continue;
    }
    const filas = [];
    let sinClase = null;
    for (const e of curso.estudiantes) {
      const texto = e.asistencia ?? '';
      const regla = reglas.find((x) => normalizar(texto).startsWith(x.empieza));
      if (!regla) {
        salida.avisos.push(`${p}, fila ${e.fila}: asistencia «${texto}» no reconocida; no se registró.`);
        continue;
      }
      if (regla.estado === 'sin_clase') {
        sinClase = texto.match(/\((.*)\)/)?.[1] ?? texto;
        continue;
      }
      filas.push({ codigo: e.codigo, estado: regla.estado, pendiente: e.pendiente });
    }
    salida.cursos[p] = { sin_clase: filas.length ? null : sinClase, filas };
  }
  return salida;
}
