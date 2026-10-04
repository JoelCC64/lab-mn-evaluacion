// Datos: leer el Excel del semestre (con vista previa), asistencia de la semana 1, respaldo y restauración.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo, Pantalla, Aviso, Hoja, Chip, enlace } from './base.js';
import { leerAsistenciaSemana1, leerExcelSemestre } from '../nucleo/excel-lectura.js';
import { aplicarAsistenciaSemana1, aplicarExcelSemestre, planificarImportacion } from '../datos/importar.js';
import { borrarTodo, contarRespaldo, restaurarRespaldo, validarRespaldo } from '../datos/respaldo.js';
import { ACEPTA_RESPALDO, exportarRespaldoDelDia, leerArchivoDeRespaldo, marcarRespaldo, useEstadoRespaldo } from './respaldo-dia.js';
import { conteoTablas } from '../datos/consultas.js';
import { guardarLocal } from '../datos/local.js';
import { ACEPTA_EXCEL, abrirLibro, elegirArchivo } from './archivos.js';
import { VERSION_APP } from '../version.js';

const ARCHIVO_DEMO = 'datos-ejemplo/Cursos_Lab_MN_2026B_EJEMPLO.xlsx';
const ASISTENCIA_DEMO = 'datos-ejemplo/Asistencia_Semana1_EJEMPLO.xlsx';

export function Datos() {
  const { cfg, db, demo, avisar } = useApp();
  const conteo = useVivo(() => conteoTablas(db), []);
  const [vista, setVista] = useState(null);       // vista previa pendiente de confirmar
  const [ocupado, setOcupado] = useState(null);
  const { ultimoRespaldo: ultimo, pendiente } = useEstadoRespaldo(db.name);

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

  const elegirRespaldo = () => conOcupado('Leyendo el respaldo…', async () => {
    const f = await elegirArchivo(ACEPTA_RESPALDO);
    if (!f) return;
    const obj = await leerArchivoDeRespaldo(f);
    setVista({ tipo: 'respaldo', nombre: f.name, obj, errores: validarRespaldo(obj, db, { semestre: cfg.semestre.semestre }) });
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
          ${pendiente ? html` · <span class="texto-aviso">hay registros sin respaldar</span>` : ''}</p>
        <button class="boton primario grande" disabled=${!!ocupado} onClick=${exportar}>Exportar el respaldo del día</button>
        <button class="boton ancho" disabled=${!!ocupado} onClick=${elegirRespaldo}>Restaurar un respaldo…</button>
        <p class="tenue pequeno">Para recuperar todo en otro dispositivo, abre la app ahí y restaura el último respaldo (Excel, o JSON de versiones anteriores).</p>
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
      ${vista?.tipo === 'respaldo' && html`<${VistaRespaldo} vista=${vista} cerrar=${() => setVista(null)} />`}
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

export function VistaRespaldo({ vista, cerrar }) {
  const { db, avisar } = useApp();
  const { obj, errores, nombre } = vista;
  const conteo = errores.length ? {} : contarRespaldo(obj);
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
        <${Aviso} tono="mal" titulo="Reemplaza todo lo de este dispositivo">Lo que hay ahora en la app se pierde. Si dudas, exporta antes un respaldo de lo actual.<//>`}
      <div class="botones">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        ${!errores.length && html`<button class="boton peligro-fuerte" onClick=${restaurar}>Reemplazar todo</button>`}
      </div>
    <//>`;
}
