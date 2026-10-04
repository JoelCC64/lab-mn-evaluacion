// Excel del semestre (Mac, Chrome): trae el respaldo del iPhone y escribe la asistencia y las notas en el Excel,
// solo en las zonas de la app. Antes de guardar: revisa el archivo, muestra lo que cambia, pregunta por las
// celdas editadas a mano, comprueba que fuera de las zonas todo quede igual, exige que el Excel esté cerrado
// y descarga una copia del archivo tal como estaba. Después guarda sobre el mismo archivo.
import { useEffect, useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo, Pantalla, Aviso, Hoja, Chip, enlace } from './base.js';
import {
  ACEPTA_EXCEL, abrirLibro, descargar, elegirArchivo, elegirCarpeta, excelAbierto, excelsDeLaCarpeta,
  permisoCarpeta, puedeGuardarSobreArchivos,
} from './archivos.js';
import { ACEPTA_RESPALDO, leerArchivoDeRespaldo } from './respaldo-dia.js';
import { VistaRespaldo } from './datos.js';
import { cargarCursos } from '../datos/excel-datos.js';
import { borrarLocal, guardarLocal, leerLocal, registrarEscritura, ultimaEscritura } from '../datos/local.js';
import { conteoTablas } from '../datos/consultas.js';
import { validarRespaldo } from '../datos/respaldo.js';
import { hojasPropiasDelPlan, aplicarEscritura, compararLibros, letra, planificarEscritura, zonasDelPlan } from '../nucleo/excel-escritura.js';
import { inflarEnNavegador, revisarPartesExcel } from '../nucleo/zip.js';
import { hoyLocal } from '../nucleo/util.js';
import { VERSION_APP } from '../version.js';
import { AjusteProfesor, useProfesor } from './dispositivo.js';

const EXCEL_DEMO = 'datos-ejemplo/Cursos_Lab_MN_2026B_EJEMPLO.xlsx';
const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const fechaHora = (iso) => new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });

function sello(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())} ${p(fecha.getHours())}${p(fecha.getMinutes())}`;
}

export function Excel() {
  const { cfg, db, demo, avisar } = useApp();
  const conCarpeta = puedeGuardarSobreArchivos() && !demo;
  const conteo = useVivo(() => conteoTablas(db), []);
  const [respaldo, setRespaldo] = useState(null);       // último respaldo importado en este dispositivo
  const [escritura, setEscritura] = useState(null);     // última escritura en el Excel
  const [carpeta, setCarpeta] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [vistaRespaldo, setVistaRespaldo] = useState(null);
  const [revision, setRevision] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [resultado, setResultado] = useState(null);
  const profesor = useProfesor();                       // ajuste del dispositivo: columna PROFESOR de coordinación

  useEffect(() => {
    leerLocal(db, 'respaldo_importado').then(setRespaldo);
    ultimaEscritura(db).then(setEscritura);
    if (conCarpeta) {
      leerLocal(db, 'excel_carpeta').then(async (c) => {
        if (!c) return;
        setCarpeta(c);
        setArchivo(await leerLocal(db, 'excel_archivo'));
      });
    }
  }, []);

  async function conOcupado(texto, f) {
    setOcupado(texto);
    try { await f(); } catch (e) { console.error(e); avisar(e.message || String(e), 'mal'); } finally { setOcupado(null); }
  }

  const usarCarpeta = async (c) => {
    if (!(await permisoCarpeta(c, true))) throw new Error('Chrome no tiene permiso para editar esa carpeta.');
    const lista = await excelsDeLaCarpeta(c);
    if (!lista.length) throw new Error('En esa carpeta no hay archivos .xlsx.');
    const preferido = lista.find((n) => n === cfg.excel.archivo_semestre) ?? (lista.length === 1 ? lista[0] : null);
    setCarpeta(c); setArchivos(lista); setArchivo(preferido); setRevision(null); setResultado(null);
    await guardarLocal(db, 'excel_carpeta', c);
    if (preferido) await guardarLocal(db, 'excel_archivo', preferido);
  };

  const cambiarCarpeta = () => conOcupado('Abriendo la carpeta…', async () => {
    let c;
    try { c = await elegirCarpeta(); } catch (e) { if (e.name === 'AbortError') return; throw e; }
    await usarCarpeta(c);
  });

  const elegirArchivoDeCarpeta = async (nombre) => {
    setArchivo(nombre); setRevision(null); setResultado(null);
    await guardarLocal(db, 'excel_archivo', nombre);
  };

  const importarRespaldo = () => conOcupado('Leyendo el respaldo…', async () => {
    const f = await elegirArchivo(ACEPTA_RESPALDO);
    if (!f) return;
    const obj = await leerArchivoDeRespaldo(f);
    setVistaRespaldo({ nombre: f.name, obj, errores: validarRespaldo(obj, db, { semestre: cfg.semestre.semestre }) });
  });

  /** Lee el Excel (carpeta de la Mac, Excel ficticio o archivo elegido) y prepara la escritura. */
  const revisar = (origen, decisiones = new Map()) => conOcupado('Revisando el Excel…', async () => {
    setResultado(null);
    const fuente = await origen();
    if (!fuente) return;
    const partes = await revisarPartesExcel(fuente.bytes, inflarEnNavegador);
    const wb = await abrirLibro(fuente.bytes);
    const cursos = await cargarCursos(db, cfg);
    const plan = planificarEscritura(wb, cfg, cursos, { hoy: hoyLocal(), decisiones, profesor });
    setRevision({ ...fuente, partes, wb, cursos, plan, decisiones, origen });
  });

  // Si se escribe el nombre con una revisión a la vista, se vuelve a preparar con él.
  useEffect(() => {
    if (revision) setRevision({ ...revision, plan: planificarEscritura(revision.wb, cfg, revision.cursos, { hoy: hoyLocal(), decisiones: revision.decisiones, profesor }) });
  }, [profesor]);

  const desdeCarpeta = async () => {
    if (!carpeta || !archivo) throw new Error('Primero elige la carpeta y el archivo del Excel.');
    if (!(await permisoCarpeta(carpeta, true))) throw new Error('Chrome no tiene permiso para editar la carpeta del Excel.');
    const h = await carpeta.getFileHandle(archivo);
    const f = await h.getFile();
    return { tipo: 'carpeta', nombre: archivo, bytes: new Uint8Array(await f.arrayBuffer()), modificado: f.lastModified, h };
  };
  const desdeEjemplo = async () => {
    const r = await fetch(EXCEL_DEMO);
    if (!r.ok) throw new Error('No se pudo abrir el Excel ficticio.');
    return { tipo: 'descarga', nombre: EXCEL_DEMO.split('/').pop(), bytes: new Uint8Array(await r.arrayBuffer()) };
  };
  const desdeArchivo = async () => {
    const f = await elegirArchivo(ACEPTA_EXCEL);
    return f ? { tipo: 'descarga', nombre: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null;
  };

  /** Cambia la decisión de una o varias celdas y vuelve a preparar la escritura con el mismo archivo. */
  const decidir = (claves, decision) => {
    const decisiones = new Map(revision.decisiones);
    for (const k of claves) decisiones.set(k, decision);
    const plan = planificarEscritura(revision.wb, cfg, revision.cursos, { hoy: hoyLocal(), decisiones, profesor });
    setRevision({ ...revision, plan, decisiones });
  };

  const escribir = () => conOcupado('Escribiendo…', async () => {
    const r = revision;
    if (r.tipo === 'carpeta') {
      if (await excelAbierto(carpeta, r.nombre)) throw new Error(`«${r.nombre}» está abierto en Excel. Ciérralo y vuelve a tocar «Escribir».`);
      const actual = await r.h.getFile();
      if (actual.lastModified !== r.modificado) {
        setRevision(null);
        throw new Error('El Excel cambió desde la revisión. Vuelve a revisarlo antes de escribir.');
      }
    }
    // Se escribe sobre un libro recién leído (el de la revisión se usa para volver a planificar).
    const wb = await abrirLibro(r.bytes);
    const plan = planificarEscritura(wb, cfg, r.cursos, { hoy: hoyLocal(), decisiones: r.decisiones, profesor });
    if (plan.conflictos.length) throw new Error('Quedan celdas editadas a mano sin decidir.');
    aplicarEscritura(wb, cfg, plan, { app: VERSION_APP, ahora: new Date().toISOString(), config: cfg.version });
    const nuevo = new Uint8Array(await wb.xlsx.writeBuffer());

    // Verificación: fuera de las zonas de la app, el archivo nuevo debe ser idéntico al original.
    const propias = hojasPropiasDelPlan(cfg, plan);
    const difs = compararLibros(await abrirLibro(r.bytes), await abrirLibro(nuevo), { zonas: zonasDelPlan(plan), propias });
    if (difs.length) {
      console.error(difs);
      throw new Error(`No se escribió: la verificación encontró cambios fuera de las zonas de la app (${difs.slice(0, 3).join(' ')}).`);
    }

    const base = r.nombre.replace(/\.xlsx$/i, '');
    const celdas = plan.hojas.reduce((s, h) => s + h.celdas.filter((c) => !c.conservar).length, 0);
    const resumen = { archivo: r.nombre, hojas: plan.hojas.length, cambios: plan.celdasQueCambian, celdas };
    if (r.tipo === 'carpeta') {
      const copia = `${base} (antes de la app ${sello()}).xlsx`;
      descargar(copia, r.bytes, TIPO_XLSX);
      const w = await r.h.createWritable();
      await w.write(nuevo);
      await w.close();
      // Comprobación final: el archivo guardado ya no tiene nada por escribir.
      const guardado = await r.h.getFile();
      const despues = planificarEscritura(await abrirLibro(new Uint8Array(await guardado.arrayBuffer())), cfg, r.cursos, { hoy: hoyLocal(), profesor });
      await registrarEscritura(db, resumen);
      setEscritura(await ultimaEscritura(db));
      setResultado({ ...resumen, copia, verificado: despues.sinCambios });
    } else {
      const salida = `${base} (con notas ${sello()}).xlsx`;
      descargar(salida, nuevo, TIPO_XLSX);
      setResultado({ ...resumen, salida });
    }
    setRevision(null);
  });

  const registros = conteo ? Object.entries(conteo).filter(([k]) => !['estudiantes', 'importaciones', 'meta'].includes(k)).reduce((s, [, v]) => s + v, 0) : null;

  return html`
    <${Pantalla} titulo="Excel del semestre" subtitulo=${demo ? 'Demostración con el Excel ficticio' : 'Escribir asistencia y notas · Mac'} atras=${enlace('datos')}>
      ${ocupado && html`<${Aviso}>${ocupado}<//>`}
      ${!demo && !conCarpeta && html`
        <${Aviso} tono="aviso" titulo="Esto se hace en la Mac, con Chrome">
          Este navegador no puede guardar sobre el Excel. En el iPhone, exporta el respaldo en «Datos» y envíalo a la Mac por AirDrop;
          en la Mac, abre la app en Chrome y entra aquí.
        <//>`}

      ${profesor === null && html`
        <div class="tarjeta">
          <${Aviso} tono="aviso" titulo="Falta tu nombre para las hojas de coordinación">
            Va en la columna PROFESOR de «${cfg.excel.escritura.hojas_coordinacion[1]}» y «${cfg.excel.escritura.hojas_coordinacion[2]}».
            Se guarda solo en este dispositivo.
          <//>
          <${AjusteProfesor} />
        </div>`}

      <div class="tarjeta">
        <h2>1. Datos de la app</h2>
        <p class="pequeno">En este dispositivo: <b>${conteo?.estudiantes ?? '…'}</b> estudiantes y <b>${registros ?? '…'}</b> registros de clase.</p>
        <p class="tenue pequeno">${respaldo
          ? html`Último respaldo importado: <b>${fechaHora(respaldo.creado)}</b> (creado en el otro dispositivo; importado el ${fechaHora(respaldo.importado)}).`
          : 'Aún no se importó un respaldo aquí: se escriben los datos registrados en este dispositivo.'}</p>
        <button class="boton ancho" disabled=${!!ocupado} onClick=${importarRespaldo}>Importar el respaldo del iPhone…</button>
      </div>

      <div class="tarjeta">
        <h2>2. El Excel</h2>
        ${demo ? html`
          <p class="tenue pequeno">En la demostración se usa el Excel ficticio y el resultado se <b>descarga</b>: tu Excel real no se toca.
            Para probar las ediciones a mano, edita el archivo descargado y elígelo con «Otro archivo…».</p>
          <div class="botones">
            <button class="boton primario" disabled=${!!ocupado} onClick=${() => revisar(desdeEjemplo)}>Revisar con el Excel ficticio</button>
            <button class="boton" disabled=${!!ocupado} onClick=${() => revisar(desdeArchivo)}>Otro archivo…</button>
          </div>`
        : conCarpeta ? html`
          <p class="tenue pequeno">La app guarda sobre el mismo archivo. Elige la carpeta donde está <b>${cfg.excel.archivo_semestre}</b>; Chrome pedirá permiso para editarla.</p>
          ${carpeta && html`<p class="pequeno">Carpeta: <b>${carpeta.name}</b>${archivo ? html` · archivo: <b>${archivo}</b>` : ''}</p>`}
          ${carpeta && archivos.length > 1 && html`
            <select class="entrada" value=${archivo ?? ''} onChange=${(e) => elegirArchivoDeCarpeta(e.currentTarget.value)}>
              <option value="" disabled>Elige el archivo…</option>
              ${archivos.map((n) => html`<option value=${n}>${n}</option>`)}
            </select>`}
          <div class="botones">
            <button class="boton" disabled=${!!ocupado} onClick=${cambiarCarpeta}>${carpeta ? 'Cambiar de carpeta' : 'Elegir la carpeta del Excel'}</button>
            ${carpeta && html`<button class="boton" disabled=${!!ocupado} onClick=${async () => { await borrarLocal(db, 'excel_carpeta'); setCarpeta(null); setArchivo(null); setRevision(null); }}>Olvidar</button>`}
          </div>
          <button class="boton primario grande" disabled=${!!ocupado || !carpeta || !archivo} onClick=${() => revisar(desdeCarpeta)}>Revisar qué se escribirá</button>
          ${escritura && html`<p class="tenue pequeno">Última escritura: ${fechaHora(escritura.fecha)} · ${escritura.archivo} · ${escritura.cambios} celdas cambiaron.</p>`}`
        : null}
      </div>

      ${revision && html`<${Revision} revision=${revision} decidir=${decidir} escribir=${escribir} ocupado=${!!ocupado} />`}

      ${resultado && html`
        <${Aviso} tono="ok" titulo="Listo">
          ${resultado.salida
            ? html`Se descargó <b>${resultado.salida}</b>: ${resultado.cambios} celdas cambiaron en ${resultado.hojas} hojas de curso, y se reescribieron las hojas de la app.`
            : html`Se guardó <b>${resultado.archivo}</b>: ${resultado.cambios} celdas cambiaron en ${resultado.hojas} hojas de curso, y se reescribieron las hojas de la app.
              La copia del archivo anterior quedó en Descargas: <b>${resultado.copia}</b>.
              ${resultado.verificado ? ' Comprobado: el archivo guardado está al día.' : ''}`}
        <//>`}

      ${vistaRespaldo && html`<${VistaRespaldo} vista=${vistaRespaldo} cerrar=${() => { setVistaRespaldo(null); leerLocal(db, 'respaldo_importado').then(setRespaldo); }} />`}
    <//>`;
}

function Revision({ revision, decidir, escribir, ocupado }) {
  const { cfg } = useApp();
  const { plan, partes, nombre } = revision;
  const [confirmando, setConfirmando] = useState(false);
  const bloqueos = [...partes.bloqueos.map((b) => `El Excel tiene ${b}: la app no sabe conservarlo al guardar.`), ...plan.bloqueos];
  const pendientes = plan.conflictos.length;
  const puede = !bloqueos.length && !pendientes && !plan.sinCambios;
  const hojasPropias = enLista(plan.propias.map((p) => `«${p.nombre}»`));
  return html`
    <div class="seccion-titulo">Revisión · ${nombre}</div>
    ${bloqueos.length > 0 && html`<${Aviso} tono="mal" titulo="No se puede escribir este archivo" lista=${bloqueos} />`}
    ${partes.avisos.length > 0 && html`<${Aviso} tono="aviso" titulo="Al guardar se pierde" lista=${partes.avisos} />`}
    ${plan.errores.length > 0 && html`<${Aviso} tono="mal" titulo="Hojas que no se escriben" lista=${plan.errores} />`}
    ${plan.avisos.length > 0 && html`<${Aviso} tono="aviso" titulo="Avisos" lista=${plan.avisos} />`}
    ${plan.sinApp.length > 0 && html`<${Aviso} tono="aviso" titulo=${`${plan.sinApp.length} fila(s) del Excel con un código que la app no tiene: no se escriben`}
      lista=${plan.sinApp.map((x) => `${x.hoja}, fila ${x.fila}: ${x.codigo}`)}>Si es un estudiante nuevo, lee el Excel en el iPhone («Datos») y vuelve a pasar el respaldo.<//>`}
    ${plan.sinFila.length > 0 && html`<${Aviso} tono="aviso" titulo=${`${plan.sinFila.length} estudiante(s) de la app que no están en el Excel: no se escriben`}
      lista=${plan.sinFila.map((x) => `${x.hoja}: ${x.nombre} (${x.codigo})`)} />`}
    ${plan.repetidos.length > 0 && html`<${Aviso} tono="mal" titulo="Códigos repetidos en el Excel: esas filas no se escriben" lista=${plan.repetidos.map((x) => `${x.hoja}: ${x.codigo}`)} />`}

    <div class="lista desplazable">
      <table class="tabla">
        <thead><tr><th>Hoja</th><th class="num">Estudiantes</th><th class="num">Celdas que cambian</th><th>Zona</th></tr></thead>
        <tbody>${plan.hojas.map((h) => html`
          <tr><td>${h.hoja}</td><td class="num">${h.filas.size}</td>
            <td class="num">${h.celdas.filter((c) => c.cambia).length || ''}</td>
            <td>${h.nueva ? html`<${Chip} tono="info">se crea en ${letra(h.inicio)}<//>` : html`desde ${letra(h.inicio)}`}</td></tr>`)}
        </tbody>
      </table>
    </div>
    <p class="tenue pequeno">Además se reescriben completas las hojas ${hojasPropias} y la hoja oculta «${cfg.excel.escritura.hoja_control}».</p>

    ${pendientes > 0 && html`<${Conflictos} conflictos=${plan.conflictos} decidir=${decidir} />`}
    ${plan.sinCambios
      ? html`<${Aviso} tono="ok">El Excel ya está al día: no hay nada que escribir.<//>`
      : html`<button class="boton primario grande" disabled=${!puede || ocupado} onClick=${() => setConfirmando(true)}>
          ${pendientes ? `Decide ${pendientes === 1 ? 'la celda editada' : `las ${pendientes} celdas editadas`} para continuar` : 'Escribir en el Excel'}</button>`}
    ${confirmando && html`
      <${Hoja} titulo="Escribir en el Excel" alCerrar=${() => setConfirmando(false)}>
        ${revision.tipo === 'carpeta'
          ? html`<p><b>Cierra el Excel</b> antes de seguir. La app descarga una copia del archivo tal como está ahora y después guarda sobre <b>${nombre}</b>.</p>`
          : html`<p>Se descarga una copia del Excel con las notas. El archivo original no cambia.</p>`}
        <p class="tenue pequeno">Solo se escriben las columnas de la app (${plan.celdasQueCambian} celdas cambian) y sus hojas propias. Antes de guardar, la app comprueba que el resto del archivo quede idéntico.</p>
        <div class="botones">
          <button class="boton" onClick=${() => setConfirmando(false)}>Cancelar</button>
          <button class="boton primario" onClick=${() => { setConfirmando(false); escribir(); }}>Escribir</button>
        </div>
      <//>`}`;
}

function Conflictos({ conflictos, decidir }) {
  const conservables = conflictos.filter((c) => c.sePuedeConservar).map((c) => c.clave);
  const mostrar = (v) => (v === null || v === undefined ? 'vacía' : String(v));
  return html`
    <${Aviso} tono="aviso" titulo=${`${conflictos.length} celda(s) de la app editadas a mano en el Excel`}>
      Decide en cada una: <b>conservar</b> el valor del Excel (en una nota de evento cuenta como ajuste «editado en el Excel»)
      o <b>usar el de la app</b>.
    <//>
    <div class="botones">
      <button class="boton chico" disabled=${!conservables.length} onClick=${() => decidir(conservables, 'conservar')}>Conservar todas</button>
      <button class="boton chico" onClick=${() => decidir(conflictos.map((c) => c.clave), 'reemplazar')}>Usar las de la app en todas</button>
    </div>
    <div class="lista">
      ${conflictos.map((c) => html`
        <div class="fila" style="flex-direction:column;align-items:stretch">
          <div class="separado"><b>${c.hoja} · ${c.celda} · ${c.columna}</b><span class="tenue pequeno">${c.codigo}</span></div>
          <div class="pequeno">${c.nombre}</div>
          <div class="pequeno">En el Excel: <b>${mostrar(c.actual)}</b> · la app: <b>${mostrar(c.calculado)}</b>
            ${c.tipo === 'fijada' ? html` · antes conservaste <b>${mostrar(c.anterior)}</b>` : ''}</div>
          ${!c.sePuedeConservar && html`<div class="tenue pequeno">Una nota de evento solo se conserva si es un número de 0 a 10.</div>`}
          <div class="botones">
            <button class="boton chico" disabled=${!c.sePuedeConservar} onClick=${() => decidir([c.clave], 'conservar')}>Conservar el del Excel</button>
            <button class="boton chico" onClick=${() => decidir([c.clave], 'reemplazar')}>Usar el de la app</button>
          </div>
        </div>`)}
    </div>`;
}

/** «a», «a y b», «a, b y c». */
function enLista(xs) {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}
