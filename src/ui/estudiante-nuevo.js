// Estudiante agregado en la app (matrícula extraordinaria): corregir su código o su nombre, o quitarlo si fue un error.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo, Hoja, Persona } from './base.js';
import { corregirEstudianteNuevo, pasarEstudianteAlCurso, quitarEstudianteNuevo, sumarEstudianteAlCurso } from '../datos/acciones.js';

export function HojaCorregirNuevo({ estudiante, alCerrar }) {
  const { db, avisar } = useApp();
  const [datos, setDatos] = useState({ codigo: estudiante.codigo, nombre: estudiante.nombre });
  const [quitando, setQuitando] = useState(false);
  const campo = (k, etiqueta, extra = {}) => html`
    <div class="campo"><label>${etiqueta}</label>
      <input class="entrada" value=${datos[k]} onInput=${(e) => setDatos({ ...datos, [k]: e.currentTarget.value })} ...${extra} /></div>`;
  const guardar = async () => {
    try { await corregirEstudianteNuevo(db, estudiante.id, datos); avisar('Corregido.', 'ok'); alCerrar(); } catch (e) { avisar(e.message, 'mal'); }
  };
  const quitar = async () => {
    try { await quitarEstudianteNuevo(db, estudiante.id); avisar('Quitado del curso.'); alCerrar(); } catch (e) { avisar(e.message, 'mal'); }
  };
  if (quitando) {
    return html`
      <${Hoja} titulo="¿Quitarlo del curso?" alCerrar=${alCerrar}>
        ${estudiante.viene_de
          ? html`<p><b>${estudiante.nombre}</b> (${estudiante.codigo}) vino de ${estudiante.viene_de.curso}. Si fue por error, vuelve a ${estudiante.viene_de.curso}
              como estaba y se borra lo que se le registró en este curso. Lo de ${estudiante.viene_de.curso} no se toca.</p>`
          : html`<p><b>${estudiante.nombre}</b> (${estudiante.codigo}) se agregó en la app. Si fue por error, se quita del curso con todo lo que
              se le registró (grupos, asistencia, controles, notas). Si dejó de venir, no lo quites: marca su asistencia como siempre.</p>`}
        <div class="botones">
          <button class="boton" onClick=${() => setQuitando(false)}>Cancelar</button>
          <button class="boton peligro-fuerte" onClick=${quitar}>Quitar</button>
        </div>
      <//>`;
  }
  return html`
    <${Hoja} titulo="Corregir estudiante" alCerrar=${alCerrar}>
      <p class="tenue pequeno">${estudiante.viene_de ? `Pasó de ${estudiante.viene_de.curso}: aquí solo se corrige el nombre.` : 'Agregado en la app. Lo que se le registró se conserva, también si cambias el código.'}</p>
      ${campo('codigo', 'Código único', { inputmode: 'numeric', autocomplete: 'off', disabled: !!estudiante.viene_de })}
      ${campo('nombre', 'Apellidos y nombres', { autocapitalize: 'characters', autocomplete: 'off' })}
      <div class="botones">
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton primario" disabled=${!datos.codigo.trim() || !datos.nombre.trim()} onClick=${guardar}>Guardar</button>
      </div>
      <button class="boton chico" style="align-self:flex-start" onClick=${() => setQuitando(true)}>${estudiante.viene_de ? `Devolverlo a ${estudiante.viene_de.curso} (lo pasé por error)` : 'Quitar del curso (lo agregué por error)'}</button>
    <//>`;
}

/**
 * Suma un estudiante al curso desde la lista de estudiantes: uno nuevo (matrícula extraordinaria o de un curso de otro
 * docente: código y nombre) o uno de mis otros cursos (un cambio de paralelo: pasa de curso).
 */
export function HojaAgregarEstudiante({ paralelo, alCerrar }) {
  const [modo, setModo] = useState('nuevo');
  return html`
    <${Hoja} titulo=${`Agregar a ${paralelo}`} alCerrar=${alCerrar}>
      <div class="botones">
        <button class=${`boton chico ${modo === 'nuevo' ? 'primario' : ''}`} onClick=${() => setModo('nuevo')}>Nuevo o de otro docente</button>
        <button class=${`boton chico ${modo === 'mios' ? 'primario' : ''}`} onClick=${() => setModo('mios')}>De mis otros cursos</button>
      </div>
      ${modo === 'nuevo'
        ? html`<${PestanaNuevo} paralelo=${paralelo} alCerrar=${alCerrar} />`
        : html`<${PestanaMios} paralelo=${paralelo} alCerrar=${alCerrar} />`}
    <//>`;
}

function PestanaNuevo({ paralelo, alCerrar }) {
  const { db, avisar } = useApp();
  const [datos, setDatos] = useState({ codigo: '', nombre: '' });
  const campo = (k, etiqueta, extra = {}) => html`
    <div class="campo"><label>${etiqueta}</label>
      <input class="entrada" value=${datos[k]} onInput=${(e) => setDatos({ ...datos, [k]: e.currentTarget.value })} ...${extra} /></div>`;
  const guardar = async () => {
    try {
      await sumarEstudianteAlCurso(db, paralelo, datos);
      avisar(`Agregado a ${paralelo}.`, 'ok');
      alCerrar();
    } catch (e) { avisar(e.message, 'mal'); }
  };
  return html`
    <p class="tenue pequeno">Para quien no está en el Excel: matrícula extraordinaria o un estudiante de un curso de otro docente. Queda
      <b>pendiente de nómina</b> y sin grupo; el primer evento al que venga lo pone en uno. Leer el Excel no lo da de baja; cuando aparezca
      en el Excel, pasa a ser uno más.</p>
    ${campo('codigo', 'Código único', { inputmode: 'numeric', autocomplete: 'off' })}
    ${campo('nombre', 'Apellidos y nombres', { autocapitalize: 'characters', autocomplete: 'off' })}
    <div class="botones">
      <button class="boton" onClick=${alCerrar}>Cancelar</button>
      <button class="boton primario" disabled=${!datos.codigo.trim() || !datos.nombre.trim()} onClick=${guardar}>Agregar</button>
    </div>`;
}

function PestanaMios({ paralelo, alCerrar }) {
  const { cfg, db, avisar } = useApp();
  const todos = useVivo(() => db.estudiantes.toArray(), []);
  const otros = cfg.cursos.map((c) => c.paralelo).filter((p) => p !== paralelo);
  const [de, setDe] = useState(otros[0]);
  const [buscar, setBuscar] = useState('');
  const [elegido, setElegido] = useState(null);
  const norm = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const lista = (todos ?? [])
    .filter((e) => e.curso === de && e.estado !== 'baja' && e.estado !== 'visitante' && norm(`${e.nombre} ${e.codigo}`).includes(norm(buscar.trim())))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const pasar = async () => {
    try {
      await pasarEstudianteAlCurso(db, elegido.id, paralelo);
      avisar(`${elegido.nombre} pasó de ${elegido.curso} a ${paralelo}.`, 'ok');
      alCerrar();
    } catch (e) { avisar(e.message, 'mal'); }
  };
  if (elegido) {
    return html`
      <p><b>${elegido.nombre}</b> (${elegido.codigo}) pasa de <b>${elegido.curso}</b> a <b>${paralelo}</b>.</p>
      <p class="tenue pequeno">Deja de contar en ${elegido.curso} y queda en ${paralelo} como <b>pendiente</b>, sin grupo. Lo que se le registró en los eventos de
        ${elegido.curso} se conserva allá. Para que el cambio dure, quítalo también de la hoja de ${elegido.curso} del Excel y ponlo en la de ${paralelo}: si el
        Excel lo sigue trayendo en ${elegido.curso}, al leerlo volvería allá. Si fue un error, se devuelve desde su ficha («Corregir»).</p>
      <div class="botones">
        <button class="boton" onClick=${() => setElegido(null)}>Atrás</button>
        <button class="boton primario" onClick=${pasar}>Pasar a ${paralelo}</button>
      </div>`;
  }
  return html`
    <div class="campo"><label>Del curso</label>
      <select class="entrada" value=${de} onChange=${(e) => setDe(e.currentTarget.value)}>
        ${otros.map((p) => html`<option value=${p}>${p}</option>`)}
      </select></div>
    <div class="campo"><label>Buscar por nombre o código</label>
      <input class="entrada" value=${buscar} onInput=${(e) => setBuscar(e.currentTarget.value)} autocomplete="off" /></div>
    <div class="lista">
      ${todos === undefined ? html`<p class="tenue">Cargando…</p>` : lista.length === 0 ? html`<p class="tenue">Nadie coincide en ${de}.</p>` : lista.map((e) => html`
        <div class="fila">
          <${Persona} estudiante=${e} />
          <button class="boton chico" onClick=${() => setElegido(e)}>Pasar aquí</button>
        </div>`)}
    </div>
    <div class="botones"><button class="boton" onClick=${alCerrar}>Cancelar</button></div>`;
}
