// Datos: leer el Excel del semestre (con vista previa), asistencia de la semana 1, respaldo y restauración, y pasar
// eventos entre dispositivos.
import { useEffect, useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo, Pantalla, Aviso, Hoja, Chip, enlace } from './base.js';
import { leerAsistenciaSemana1, leerExcelSemestre } from '../nucleo/excel-lectura.js';
import { aplicarAsistenciaSemana1, aplicarExcelSemestre, planificarImportacion } from '../datos/importar.js';
import { borrarTodo, contarRespaldo, restaurarRespaldo } from '../datos/respaldo.js';
import { ACEPTA_RESPALDO, exportarRespaldoDelDia, marcarRespaldo, prepararRespaldoCompleto, useEstadoRespaldo } from './respaldo-dia.js';
import { AvisoPerdidas, EnviarEventos, VistaPaquete, abrirArchivoDeDatos, useEntrega } from './paquetes.js';
import { cambiosQueSePierdenAlRestaurar } from '../datos/paquete.js';
import { conteoTablas } from '../datos/consultas.js';
import { guardarLocal, leerLocal } from '../datos/local.js';
import { ACEPTA_EXCEL, abrirLibro, elegirArchivo } from './archivos.js';
import { AjusteProfesor } from './dispositivo.js';
import { simularClases } from '../datos/simulacion.js';
import { VERSION_APP } from '../version.js';

const ARCHIVO_DEMO = 'datos-ejemplo/Cursos_Lab_MN_2026B_EJEMPLO.xlsx';
const ASISTENCIA_DEMO = 'datos-ejemplo/Asistencia_Semana1_EJEMPLO.xlsx';

export function Datos() {
  const { cfg, db, demo, avisar } = useApp();
  const conteo = useVivo(() => conteoTablas(db), []);
  const [vista, setVista] = useState(null);       // vista previa pendiente de confirmar
  const [ocupado, setOcupado] = useState(null);
  const { ultimoRespaldo: ultimo, pendiente, dias, vencido } = useEstadoRespaldo(db.name, cfg.respaldo.recordatorio_dias);
  const { entregar, hoja } = useEntrega();

  async function conOcupado(texto, f) {
    setOcupado(texto);
    try { await f(); } catch (e) { console.error(e); avisar(e.message || String(e), 'mal'); } finally { setOcupado(null); }
  }

  const leerSemestre = (origen) => conOcupado('Leyendo el Excel…', async () => {
    const { nombre, buffer } = await origen();
    if (!buffer) return;
    const lectura = leerExcelSemestre(await abrirLibro(buffer), cfg);
    const plan = await planificarImportacion(db, lectura);
    setVista({ tipo: 'semestre', nombre, lectura, plan });
  });

  const leerSemana1 = (origen) => conOcupado('Leyendo la asistencia…', async () => {
    const { nombre, buffer } = await origen();
    if (!buffer) return;
    const lectura = leerAsistenciaSemana1(await abrirLibro(buffer), cfg);
    setVista({ tipo: 'semana1', nombre, lectura });
  });

  const delDispositivo = async () => {
    const f = await elegirArchivo(ACEPTA_EXCEL);
    return f ? { nombre: f.name, buffer: await f.arrayBuffer() } : {};
  };
  const deEjemplo = (ruta) => async () => {
    const r = await fetch(ruta);
    if (!r.ok) throw new Error('No se pudo abrir el Excel ficticio.');
    return { nombre: ruta.split('/').pop(), buffer: await r.arrayBuffer() };
  };

  const exportar = () => conOcupado('Preparando el respaldo…', async () => {
    const { resultado, nombre } = await exportarRespaldoDelDia({ cfg, db, demo });
    if (resultado !== 'cancelado') avisar(resultado === 'compartido' ? 'Respaldo compartido.' : `Respaldo guardado: ${nombre}`, 'ok');
  });

  const exportarCompleto = () => conOcupado('Preparando el respaldo completo…', async () => {
    const archivo = await prepararRespaldoCompleto({ cfg, db, demo });
    await entregar({
      ...archivo,
      detalle: 'Un .zip con todo en JSON (para restaurar) y un CSV por tabla (para Excel, Sheets, Python o R). Tiene datos de estudiantes.',
      alEntregar: () => marcarRespaldo(db.name, archivo.creado),
    });
  });

  const simular = (hastaSemana) => conOcupado('Simulando clases…', async () => {
    const r = await simularClases(db, cfg, { hastaSemana });
    avisar(r.eventos ? `Listo: ${r.eventos} eventos ficticios en ${r.cursos} cursos.` : 'No quedaban eventos sin registrar hasta esa semana.', 'ok');
  });

  // Un respaldo o un paquete de eventos: cada uno abre su vista, venga del botón que venga.
  const elegirArchivoDeDatos = (texto, acepta) => conOcupado(texto, async () => {
    const f = await elegirArchivo(acepta);
    if (f) setVista(await abrirArchivoDeDatos(f, { cfg, db, demo }));
  });

  return html`
    <${Pantalla} titulo="Datos" subtitulo=${demo ? 'Demostración con datos ficticios' : 'Excel, respaldo y restauración'} atras="#/">
      ${ocupado && html`<${Aviso}>${ocupado}<//>`}

      <div class="tarjeta">
        <h2>Excel del semestre</h2>
        <p class="tenue pequeno">
          Lee <b>${cfg.excel.archivo_semestre}</b>: código, apellidos y nombres, grupo de trabajo y observación. No lee los correos.
          Al volver a leerlo agrega a los nuevos y marca como «baja» a quien ya no está, sin borrar sus evaluaciones.
        </p>
        <button class="boton primario grande" disabled=${!!ocupado} onClick=${() => leerSemestre(delDispositivo)}>Elegir el Excel del semestre</button>
        ${demo && html`<button class="boton ancho" disabled=${!!ocupado} onClick=${() => leerSemestre(deEjemplo(ARCHIVO_DEMO))}>Usar el Excel ficticio</button>`}
      </div>

      <a class="tarjeta" href=${enlace('excel')}>
        <div class="separado"><h2>Escribir las notas en el Excel</h2><span class="flecha">›</span></div>
        <p class="tenue pequeno">En la Mac, con Chrome: importa el respaldo del iPhone y escribe la asistencia y las notas en el Excel, solo en las columnas y hojas de la app.</p>
      </a>

      <div class="tarjeta">
        <h2>Asistencia de la semana 1 <span class="tenue pequeno">(opcional)</span></h2>
        <p class="tenue pequeno">Lee la columna «Asistencia» de <b>${cfg.excel.archivo_asistencia_semana1}</b> y la registra en la Introducción de cada curso.</p>
        <button class="boton ancho" disabled=${!!ocupado} onClick=${() => leerSemana1(delDispositivo)}>Elegir el Excel de asistencia</button>
        ${demo && html`<button class="boton ancho" disabled=${!!ocupado} onClick=${() => leerSemana1(deEjemplo(ASISTENCIA_DEMO))}>Usar la asistencia ficticia</button>`}
      </div>

      <div class="tarjeta">
        <h2>Respaldo del día</h2>
        <p class="tenue pequeno">
          Un solo archivo Excel con todo lo registrado: notas por curso, asistencia y el detalle de cada evento, más los datos
          para restaurar. Súbelo a Drive al final de cada día (en el iPhone se abre la hoja de compartir: Drive, Archivos o AirDrop a la Mac).
          Tiene datos de estudiantes: guárdalo en un lugar seguro.
        </p>
        <p class="pequeno">Último respaldo en este dispositivo: <b>${ultimo ? new Date(ultimo).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca'}</b>
          ${pendiente ? html` · <span class=${vencido ? 'texto-mal' : 'texto-aviso'}>${vencido ? `hay registros sin respaldar desde hace ${dias} días` : 'hay registros sin respaldar'}</span>` : ''}</p>
        <button class="boton primario grande" disabled=${!!ocupado} onClick=${exportar}>Exportar el respaldo del día</button>
        <button class="boton ancho" disabled=${!!ocupado} onClick=${exportarCompleto}>Respaldo completo en CSV y JSON (.zip)</button>
        <button class="boton ancho" disabled=${!!ocupado} onClick=${() => elegirArchivoDeDatos('Leyendo el respaldo…', ACEPTA_RESPALDO)}>Restaurar un respaldo…</button>
        <p class="tenue pequeno">
          El respaldo completo trae cada tabla en CSV, para abrirla en Excel, Sheets, Python o R; también se puede restaurar.
          Para recuperar todo en otro dispositivo, abre la app ahí y restaura el último respaldo (Excel, .zip o JSON).
        </p>
      </div>

      <div class="tarjeta">
        <h2>Pasar eventos a otro dispositivo</h2>
        <p class="tenue pequeno">
          Lleva lo registrado en uno o varios eventos, por ejemplo los TC calificados en la Mac, al iPhone. El otro dispositivo
          muestra qué cambia y, al confirmar, reemplaza solo esos eventos. Los dos deben tener la nómina (el Excel del semestre leído).
        </p>
        <button class="boton ancho" disabled=${!!ocupado} onClick=${() => setVista({ tipo: 'enviar' })}>Enviar eventos…</button>
        <button class="boton ancho" disabled=${!!ocupado} onClick=${() => elegirArchivoDeDatos('Leyendo el paquete…', '.json,application/json')}>Recibir eventos…</button>
      </div>

      ${demo && html`
        <div class="tarjeta">
          <h2>Clases ficticias <span class="tenue pequeno">(solo en la demostración)</span></h2>
          <p class="tenue pequeno">
            Simula asistencia, preparatorio, control oral, rúbricas, etiquetas y TC en todos los cursos, para probar las métricas.
            Usa el Excel ficticio (cárgalo antes) y no toca lo que ya registraste a mano en la demostración.
          </p>
          <div class="botones">
            ${[[5, 'Hasta la semana 5'], [9, '1.er bimestre'], [cfg.semestre.semanas, 'Todo el semestre']].map(([s, t]) => html`
              <button class="boton chico" disabled=${!!ocupado || !conteo?.estudiantes} onClick=${() => simular(s)}>${t}</button>`)}
          </div>
        </div>`}

      <div class="tarjeta">
        <h2>Este dispositivo</h2>
        <p class="tenue pequeno">
          Tu nombre va en la columna PROFESOR de «${cfg.excel.escritura.hojas_coordinacion[1]}» y «${cfg.excel.escritura.hojas_coordinacion[2]}»
          y firma el texto para el profesor de un estudiante que recupera contigo. Se guarda solo en este dispositivo
          (no está en la app publicada ni en el respaldo): escríbelo en el iPhone y en la Mac.
        </p>
        <${AjusteProfesor} />
      </div>

      <div class="tarjeta">
        <h2>Esta app</h2>
        <table class="tabla">
          <tbody>
            <tr><td>Versión</td><td class="num">${VERSION_APP}</td></tr>
            <tr><td>Configuración</td><td class="num">${cfg.version}</td></tr>
            <tr><td>Semestre</td><td class="num">${cfg.semestre.semestre}</td></tr>
            <tr><td>Base local</td><td class="num">${db.name}</td></tr>
            <tr><td>Estudiantes</td><td class="num">${conteo?.estudiantes ?? '…'}</td></tr>
            <tr><td>Registros de clase</td><td class="num">${conteo ? Object.entries(conteo).filter(([k]) => !['estudiantes', 'importaciones', 'meta'].includes(k)).reduce((s, [, v]) => s + v, 0) : '…'}</td></tr>
          </tbody>
        </table>
        ${demo
          ? html`
            <button class="boton peligro ancho" onClick=${() => setVista({ tipo: 'borrar' })}>Borrar los datos de la demostración</button>
            <a class="boton ancho" href="./">Salir de la demostración</a>`
          : html`<a class="boton ancho" href="./?demo=1#/datos">Abrir la demostración (datos ficticios, aparte)</a>`}
      </div>

      ${vista?.tipo === 'semestre' && html`<${VistaSemestre} vista=${vista} cerrar=${() => setVista(null)} />`}
      ${vista?.tipo === 'semana1' && html`<${VistaSemana1} vista=${vista} cerrar=${() => setVista(null)} />`}
      ${(vista?.tipo === 'respaldo' || vista?.tipo === 'paquete') && html`<${VistaArchivo} vista=${vista} cerrar=${() => setVista(null)} />`}
      ${vista?.tipo === 'enviar' && html`<${EnviarEventos} cerrar=${() => setVista(null)} />`}
      ${hoja}
      ${vista?.tipo === 'borrar' && html`
        <${Hoja} titulo="¿Borrar los datos de la demostración?" alCerrar=${() => setVista(null)}>
          <p>Se borra todo lo de la base de demostración. Tus datos reales no se tocan (están en otra base).</p>
          <div class="botones">
            <button class="boton" onClick=${() => setVista(null)}>Cancelar</button>
            <button class="boton peligro-fuerte" onClick=${async () => { await borrarTodo(db); setVista(null); avisar('Demostración borrada.', 'ok'); }}>Borrar</button>
          </div>
        <//>`}
    <//>`;
}

function ListaAvisos({ errores, avisos }) {
  return html`
    ${errores.length > 0 && html`<${Aviso} tono="mal" titulo=${`${errores.length} error(es): esas filas no se guardan`} lista=${errores.slice(0, 30)} />`}
    ${avisos.length > 0 && html`<${Aviso} tono="aviso" titulo=${`${avisos.length} aviso(s)`} lista=${avisos.slice(0, 30)} />`}`;
}

function VistaSemestre({ vista, cerrar }) {
  const { db, avisar } = useApp();
  const { lectura, plan, nombre } = vista;
  const r = plan.resumen;
  const nada = plan.cambios.length === 0;
  const guardar = async () => {
    const res = await aplicarExcelSemestre(db, lectura, { archivo: nombre });
    cerrar();
    avisar(`Listo: ${res.resumen.total} estudiantes (${res.resumen.nuevos} nuevos, ${res.resumen.actualizados + res.resumen.reactivados} actualizados, ${res.resumen.bajas} de baja).`, 'ok');
  };
  return html`
    <${Hoja} titulo="Vista previa del Excel" alCerrar=${cerrar}>
      <p class="tenue pequeno">${nombre} · ${lectura.resumen.hojas} hojas de curso · ${lectura.resumen.estudiantes} estudiantes (${lectura.resumen.pendientes} pendientes)</p>
      <div class="resumen-numeros">
        <div><b>${r.nuevos}</b><span>nuevos</span></div>
        <div><b>${r.actualizados + r.reactivados}</b><span>actualizados</span></div>
        <div><b>${r.bajas}</b><span>de baja</span></div>
        <div><b>${r.sin_cambios}</b><span>sin cambios</span></div>
      </div>
      <div class="desplazable">
        <table class="tabla">
          <thead><tr><th>Curso</th><th class="num">Est.</th><th class="num">Pend.</th><th class="num">Nuevos</th><th class="num">Cambios</th><th class="num">Bajas</th></tr></thead>
          <tbody>${Object.entries(plan.porCurso).map(([p, c]) => html`
            <tr><td>${p}</td><td class="num">${c.total}</td><td class="num">${c.pendientes || ''}</td><td class="num">${c.nuevos || ''}</td><td class="num">${(c.actualizados + c.reactivados) || ''}</td><td class="num">${c.bajas || ''}</td></tr>`)}
          </tbody>
        </table>
      </div>
      <${ListaAvisos} errores=${lectura.errores} avisos=${lectura.avisos} />
      <div class="botones">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        <button class="boton primario" disabled=${nada} onClick=${guardar}>${nada ? 'No hay cambios' : 'Guardar'}</button>
      </div>
    <//>`;
}

function VistaSemana1({ vista, cerrar }) {
  const { cfg, db, avisar } = useApp();
  const { lectura, nombre } = vista;
  const cursos = Object.entries(lectura.cursos);
  const guardar = async () => {
    const res = await aplicarAsistenciaSemana1(db, cfg, lectura, { archivo: nombre });
    cerrar();
    avisar(`Semana 1: ${res.resumen.registros} registros${res.resumen.sin_clase ? `, ${res.resumen.sin_clase} curso(s) sin clase` : ''}${res.resumen.desconocidos ? `, ${res.resumen.desconocidos} códigos desconocidos` : ''}.`, res.resumen.desconocidos ? 'mal' : 'ok');
  };
  return html`
    <${Hoja} titulo="Asistencia de la semana 1" alCerrar=${cerrar}>
      <p class="tenue pequeno">${nombre}</p>
      <div class="desplazable">
        <table class="tabla">
          <thead><tr><th>Curso</th><th class="num">Presentes</th><th class="num">Faltas</th><th>Clase</th></tr></thead>
          <tbody>${cursos.map(([p, c]) => html`
            <tr><td>${p}</td><td class="num">${c.filas.filter((f) => f.estado === 'presente').length || ''}</td><td class="num">${c.filas.filter((f) => f.estado === 'no_vino').length || ''}</td><td>${c.sin_clase ? html`<${Chip} tono="aviso">sin clase<//>` : 'realizada'}</td></tr>`)}
          </tbody>
        </table>
      </div>
      <${ListaAvisos} errores=${lectura.errores} avisos=${lectura.avisos} />
      <div class="botones">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        <button class="boton primario" disabled=${!cursos.length} onClick=${guardar}>Registrar</button>
      </div>
    <//>`;
}

/** Vista de un archivo abierto en «Restaurar un respaldo…» o «Recibir eventos…» (también en la pantalla del Excel). */
export function VistaArchivo({ vista, cerrar }) {
  return vista.tipo === 'paquete' ? html`<${VistaPaquete} vista=${vista} cerrar=${cerrar} />` : html`<${VistaRespaldo} vista=${vista} cerrar=${cerrar} />`;
}

function VistaRespaldo({ vista, cerrar }) {
  const { db, avisar } = useApp();
  const { obj, errores, nombre } = vista;
  const conteo = errores.length ? {} : contarRespaldo(obj);
  // Cambios de este dispositivo que el respaldo no trae (se perderían al reemplazar todo).
  const [perdidas, setPerdidas] = useState(null);
  useEffect(() => {
    if (errores.length) return;
    (async () => {
      const desde = (await leerLocal(db, 'respaldo_importado'))?.creado ?? null;
      setPerdidas(await cambiosQueSePierdenAlRestaurar(db, obj, { desde }));
    })().catch((e) => { console.error(e); setPerdidas([]); });
  }, []);
  const restaurar = async () => {
    await restaurarRespaldo(db, obj);
    await guardarLocal(db, 'respaldo_importado', { creado: obj.creado, app: obj.app, archivo: nombre, importado: new Date().toISOString() });
    marcarRespaldo(db.name);   // los datos quedaron iguales a un archivo de respaldo
    cerrar();
    avisar('Respaldo restaurado.', 'ok');
  };
  return html`
    <${Hoja} titulo="Restaurar respaldo" alCerrar=${cerrar}>
      <p class="tenue pequeno">${nombre}</p>
      ${errores.length ? html`<${Aviso} tono="mal" titulo="No se puede restaurar" lista=${errores} />` : html`
        <p>Creado el <b>${new Date(obj.creado).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}</b> (app ${obj.app}). Tiene ${conteo.estudiantes ?? 0} estudiantes y ${Object.entries(conteo).filter(([k]) => !['estudiantes', 'importaciones', 'meta'].includes(k)).reduce((s, [, v]) => s + v, 0)} registros de clase.</p>
        <${AvisoPerdidas} perdidas=${perdidas} />
        <${Aviso} tono="mal" titulo="Reemplaza todo lo de este dispositivo">Lo que hay ahora en la app se pierde. Si dudas, exporta antes un respaldo de lo actual.<//>`}
      <div class="botones">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        ${!errores.length && html`<button class="boton peligro-fuerte" onClick=${restaurar}>Reemplazar todo</button>`}
      </div>
    <//>`;
}
