// Estudiante agregado en la app (matrícula extraordinaria): corregir su código o su nombre, o quitarlo si fue un error.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Hoja } from './base.js';
import { corregirEstudianteNuevo, quitarEstudianteNuevo } from '../datos/acciones.js';

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
        <p><b>${estudiante.nombre}</b> (${estudiante.codigo}) se agregó en la app. Si fue por error, se quita del curso con todo lo que
          se le registró (grupos, asistencia, controles, notas). Si dejó de venir, no lo quites: marca su asistencia como siempre.</p>
        <div class="botones">
          <button class="boton" onClick=${() => setQuitando(false)}>Cancelar</button>
          <button class="boton peligro-fuerte" onClick=${quitar}>Quitar</button>
        </div>
      <//>`;
  }
  return html`
    <${Hoja} titulo="Corregir estudiante" alCerrar=${alCerrar}>
      <p class="tenue pequeno">Agregado en la app. Lo que se le registró se conserva, también si cambias el código.</p>
      ${campo('codigo', 'Código único', { inputmode: 'numeric', autocomplete: 'off' })}
      ${campo('nombre', 'Apellidos y nombres', { autocapitalize: 'characters', autocomplete: 'off' })}
      <div class="botones">
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton primario" disabled=${!datos.codigo.trim() || !datos.nombre.trim()} onClick=${guardar}>Guardar</button>
      </div>
      <button class="boton chico" style="align-self:flex-start" onClick=${() => setQuitando(true)}>Quitar del curso (lo agregué por error)</button>
    <//>`;
}
