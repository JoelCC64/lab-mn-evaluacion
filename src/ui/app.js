// Raíz de la interfaz: contexto, rutas, avisos flotantes y bandas (demostración, versión nueva).
import { useCallback, useEffect, useErrorBoundary, useRef, useState } from '../vendor/preact-htm.js';
import { html, Contexto, useApp, useRuta } from './base.js';
import { Inicio } from './inicio.js';
import { Curso } from './curso.js';
import { Evento } from './evento.js';
import { Grupo } from './grupo.js';
import { TrabajoCasa } from './trabajos.js';
import { Notas } from './notas.js';
import { RevisionNotas } from './revision.js';
import { Metricas } from './metricas.js';
import { Datos } from './datos.js';
import { Excel } from './excel.js';
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

  // Un error que nadie atrapó no debe pasar en silencio: se muestra, para saber qué pasó en el dispositivo.
  useEffect(() => {
    const mostrar = (e) => {
      const motivo = e.reason ?? e.error ?? e.message;
      if (motivo?.name === 'AbortError') return;
      if (/ResizeObserver/.test(String(motivo?.message ?? motivo))) return;   // aviso inofensivo del navegador
      avisar(`Error inesperado: ${motivo?.message || motivo || 'desconocido'}. Si algo deja de responder, cierra y vuelve a abrir la app.`, 'mal');
    };
    addEventListener('error', mostrar);
    addEventListener('unhandledrejection', mostrar);
    return () => { removeEventListener('error', mostrar); removeEventListener('unhandledrejection', mostrar); };
  }, [avisar]);

  return html`
    <${Contexto.Provider} value=${{ cfg, db, demo, avisar }}>
      ${demo && html`<div class="banda banda-demo">Demostración · datos ficticios (base aparte)</div>`}
      ${actualizar && html`
        <div class="banda banda-version">
          <span>Hay una versión nueva de la app.</span>
          <button class="boton chico primario" onClick=${() => actualizar()}>Actualizar</button>
        </div>`}
      <${Protegida}><${Rutas} /><//>
      ${aviso && html`<div class=${`flotante ${aviso.tono}`} role="status" onClick=${() => setAviso(null)}>${aviso.texto}</div>`}
    <//>`;
}

/**
 * Si una pantalla falla al dibujarse, muestra el error y una salida, en vez de dejar la app a medio dibujar
 * (con botones que ya no responden). Al cambiar de pantalla se vuelve a intentar.
 */
function Protegida({ children }) {
  const [error, reintentar] = useErrorBoundary((e) => console.error(e));
  useEffect(() => {
    if (!error) return undefined;
    const f = () => reintentar();
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, [error]);
  if (!error) return children;
  return html`
    <div class="error-fatal">
      <h1>Esta pantalla no se pudo mostrar</h1>
      <p>${error.message || String(error)}</p>
      <p class="pequeno">Tus datos no se pierden. Vuelve a Inicio; si sigue igual, cierra y vuelve a abrir la app.</p>
      <div class="botones" style="justify-content:center">
        <a class="boton primario" href="#/" onClick=${() => reintentar()}>Ir a Inicio</a>
        <button class="boton" onClick=${() => location.reload()}>Recargar</button>
      </div>
    </div>`;
}

function Rutas() {
  const { cfg } = useApp();
  const [pantalla, a, b, c] = useRuta();
  if (pantalla === 'datos') return html`<${Datos} />`;
  if (pantalla === 'excel') return html`<${Excel} />`;
  if (pantalla === 'metricas') return html`<${Metricas} alcance=${a} />`;
  if (pantalla === 'curso' && a && b === 'notas') return html`<${Notas} paralelo=${a} />`;
  if (pantalla === 'curso' && a && b === 'revision') return html`<${RevisionNotas} paralelo=${a} />`;
  if (pantalla === 'curso' && a) return html`<${Curso} paralelo=${a} />`;
  if (pantalla === 'evento' && a && ['grupo', 'estudiante'].includes(b) && c) {
    // Un trabajo en casa se califica por grupo (o por estudiante); lo demás es la pantalla del grupo en clase.
    if (cfg.catalogo[String(a).split(':')[1]]?.tipo === 'trabajo_casa') return html`<${TrabajoCasa} id=${a} unidadId=${c} />`;
    if (b === 'grupo') return html`<${Grupo} id=${a} grupo=${c} />`;
  }
  if (pantalla === 'evento' && a) return html`<${Evento} id=${a} pestana=${b} />`;
  return html`<${Inicio} />`;
}
