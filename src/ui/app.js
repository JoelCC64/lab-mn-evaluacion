// Raíz de la interfaz: contexto, rutas, avisos flotantes y bandas (demostración, versión nueva).
import { useCallback, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { html, Contexto, useRuta } from './base.js';
import { Inicio } from './inicio.js';
import { Curso } from './curso.js';
import { Evento } from './evento.js';
import { Grupo } from './grupo.js';
import { Datos } from './datos.js';
import { escucharVersionNueva } from './pwa.js';

export function App({ cfg, db, demo }) {
  const [aviso, setAviso] = useState(null);
  const [actualizar, setActualizar] = useState(null);
  const temporizador = useRef(null);

  const avisar = useCallback((texto, tono = '') => {
    clearTimeout(temporizador.current);
    setAviso({ texto, tono });
    temporizador.current = setTimeout(() => setAviso(null), tono === 'mal' ? 6000 : 3200);
  }, []);

  useEffect(() => escucharVersionNueva((aplicar) => setActualizar(() => aplicar)), []);

  return html`
    <${Contexto.Provider} value=${{ cfg, db, demo, avisar }}>
      ${demo && html`<div class="banda banda-demo">Demostración · datos ficticios (base aparte)</div>`}
      ${actualizar && html`
        <div class="banda banda-version">
          <span>Hay una versión nueva de la app.</span>
          <button class="boton chico primario" onClick=${() => actualizar()}>Actualizar</button>
        </div>`}
      <${Rutas} />
      ${aviso && html`<div class=${`flotante ${aviso.tono}`} role="status" onClick=${() => setAviso(null)}>${aviso.texto}</div>`}
    <//>`;
}

function Rutas() {
  const [pantalla, a, b, c] = useRuta();
  if (pantalla === 'datos') return html`<${Datos} />`;
  if (pantalla === 'curso' && a) return html`<${Curso} paralelo=${a} />`;
  if (pantalla === 'evento' && a && b === 'grupo' && c) return html`<${Grupo} id=${a} grupo=${c} />`;
  if (pantalla === 'evento' && a) return html`<${Evento} id=${a} pestana=${b} />`;
  return html`<${Inicio} />`;
}
