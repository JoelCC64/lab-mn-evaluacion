// Ganchos y componentes comunes de la interfaz (Preact + htm, sin compilación).
import { html, createContext, useContext, useEffect, useState } from '../vendor/preact-htm.js';
import { liveQuery } from '../vendor/dexie.js';
import { nombreMetodologia } from '../nucleo/config.js';

export { html };

/** { cfg, db, demo, avisar } para toda la app. */
export const Contexto = createContext(null);
export const useApp = () => useContext(Contexto);

/** Resultado de una consulta a la base que se actualiza solo cuando cambian los datos. */
export function useVivo(consulta, deps) {
  const [estado, setEstado] = useState({ valor: undefined, error: null });
  useEffect(() => {
    const sub = liveQuery(consulta).subscribe({
      next: (valor) => setEstado({ valor, error: null }),
      error: (error) => { console.error(error); setEstado({ valor: undefined, error }); },
    });
    return () => sub.unsubscribe();
  }, deps);
  return estado.valor;
}

/** Ruta actual del hash: «#/evento/GR2QB:P1/grupo/3» → ['evento', 'GR2QB:P1', 'grupo', '3']. */
export function useRuta() {
  const leer = () => decodeURI(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  const [partes, setPartes] = useState(leer);
  useEffect(() => {
    const f = () => { setPartes(leer()); window.scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return partes;
}

export const enlace = (...partes) => `#/${partes.map((p) => encodeURI(String(p))).join('/')}`;
export const ir = (...partes) => { location.hash = enlace(...partes).slice(1); };

export function Pantalla({ titulo, subtitulo, atras, acciones, pestanas, children }) {
  return html`
    <header class="barra">
      ${atras
        ? html`<a class="icono-boton" href=${atras} aria-label="Volver">‹</a>`
        : html`<span style="width:6px"></span>`}
      <div class="titulos">
        <h1>${titulo}</h1>
        ${subtitulo && html`<div class="subtitulo">${subtitulo}</div>`}
      </div>
      ${acciones}
    </header>
    ${pestanas}
    <main class="contenido">${children}</main>
  `;
}

export function Chip({ tono = '', children, titulo }) {
  return html`<span class=${`chip ${tono}`} title=${titulo}>${children}</span>`;
}

export function ChipMetodologia({ metodologia }) {
  const { cfg } = useApp();
  return html`<${Chip} tono=${metodologia === 'SQI' ? 'sqi' : 'trad'}>${nombreMetodologia(cfg, metodologia)}<//>`;
}

export function Aviso({ tono = 'info', titulo, lista, children }) {
  return html`
    <div class=${`aviso-caja ${tono}`} role=${tono === 'mal' ? 'alert' : undefined}>
      ${titulo && html`<div class="negrita">${titulo}</div>`}
      ${children}
      ${lista?.length ? html`<ul>${lista.map((x) => html`<li>${x}</li>`)}</ul>` : null}
    </div>`;
}

/** Diálogo desde abajo (en la Mac, centrado). Se cierra tocando fuera o con Escape. */
export function Hoja({ titulo, alCerrar, children }) {
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') alCerrar(); };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [alCerrar]);
  return html`
    <div class="velo" onClick=${(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div class="hoja" role="dialog" aria-modal="true" aria-label=${titulo}>
        <div class="agarradera"></div>
        ${titulo && html`<h2>${titulo}</h2>`}
        ${children}
      </div>
    </div>`;
}

export function iniciales(nombre) {
  const p = String(nombre).split(' ').filter(Boolean);
  // «APELLIDO APELLIDO NOMBRE NOMBRE»: inicial del primer apellido y del primer nombre.
  return ((p[0]?.[0] ?? '') + (p[2]?.[0] ?? p[1]?.[0] ?? '')).toUpperCase();
}

export function Persona({ estudiante, detalle, children }) {
  return html`
    <div class="persona crece">
      <span class="inicial" aria-hidden="true">${iniciales(estudiante.nombre)}</span>
      <div class="crece">
        <div class="nombre">${estudiante.nombre}</div>
        <div class="codigo fila-flex">
          <span>${estudiante.codigo}</span>
          ${estudiante.estado === 'pendiente' && html`<${Chip} tono="aviso">pendiente<//>`}
          ${estudiante.estado === 'baja' && html`<${Chip} tono="mal">baja<//>`}
          ${estudiante.estado === 'visitante' && html`<${Chip} tono="info">otro curso${estudiante.visita?.paralelo ? ` · ${estudiante.visita.paralelo}` : ''}<//>`}
          ${detalle}
        </div>
      </div>
      ${children}
    </div>`;
}

export function Cargando({ texto = 'Cargando…' }) {
  return html`<p class="cargando">${texto}</p>`;
}
