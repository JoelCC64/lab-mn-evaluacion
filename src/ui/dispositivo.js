// Ajustes de este dispositivo: no están en la configuración publicada ni viajan en el respaldo. Por ahora, el nombre
// del profesor para la columna PROFESOR de las hojas de coordinación y la firma del texto para otros profesores.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo } from './base.js';
import { guardarProfesor, leerProfesor } from '../datos/local.js';

/** Nombre del profesor guardado en este dispositivo: undefined mientras carga, null si no se ha escrito. */
export function useProfesor() {
  const { db } = useApp();
  return useVivo(() => leerProfesor(db), [db]);
}

/** Campo con el nombre del profesor. Se guarda con «Guardar» o con Intro; vacío lo borra. */
export function AjusteProfesor() {
  const { db, avisar } = useApp();
  const actual = useProfesor();
  const [texto, setTexto] = useState(null);   // null: sin editar (muestra lo guardado)
  const valor = texto ?? actual ?? '';
  const cambio = texto !== null && texto.replace(/\s+/g, ' ').trim() !== (actual ?? '');
  const guardar = async () => {
    try {
      await guardarProfesor(db, valor);
      setTexto(null);
      avisar(valor.trim() ? 'Nombre guardado en este dispositivo.' : 'Nombre borrado de este dispositivo.', 'ok');
    } catch (e) { avisar(e.message, 'mal'); }
  };
  return html`
    <div class="campo">
      <label for="ajuste-profesor">Tu nombre (columna PROFESOR y firma)</label>
      <div class="fila-flex">
        <input id="ajuste-profesor" class="entrada crece" value=${valor} placeholder="Ej.: Fis. Nombre Apellido" autocomplete="off"
          onInput=${(e) => setTexto(e.currentTarget.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && cambio) guardar(); }} />
        <button class="boton primario" disabled=${!cambio} onClick=${guardar}>Guardar</button>
      </div>
    </div>`;
}
