// Búsqueda rápida de un estudiante por las primeras letras de un apellido (o nombre).
import { useState } from '../vendor/preact-htm.js';
import { html, Persona } from './base.js';
import { normalizar } from '../nucleo/util.js';

/** Coincidencias: primero quien empieza por lo escrito; después quien tiene una palabra que empieza así. */
export function buscarEstudiantes(estudiantes, texto, limite = 6) {
  const q = normalizar(texto);
  if (!q) return [];
  const primero = [];
  const despues = [];
  for (const e of estudiantes) {
    const n = normalizar(e.nombre);
    if (n.startsWith(q)) primero.push(e);
    else if (n.split(' ').some((p) => p.startsWith(q)) || String(e.codigo).startsWith(q)) despues.push(e);
  }
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  return [...primero.sort(porNombre), ...despues.sort(porNombre)].slice(0, limite);
}

export function BuscarEstudiante({ estudiantes, alElegir, placeholder = 'Primeras letras del apellido…', detalle }) {
  const [texto, setTexto] = useState('');
  const resultados = buscarEstudiantes(estudiantes, texto);
  return html`
    <div class="campo">
      <input class="entrada" type="search" inputmode="search" autocomplete="off" autocapitalize="characters"
        placeholder=${placeholder} value=${texto} onInput=${(e) => setTexto(e.currentTarget.value)} />
    </div>
    ${texto && html`
      <div class="lista">
        ${resultados.length === 0 && html`<div class="fila tenue">Nadie coincide con «${texto}».</div>`}
        ${resultados.map((e) => html`
          <button class="fila" onClick=${() => { setTexto(''); alElegir(e); }}>
            <${Persona} estudiante=${e} detalle=${detalle?.(e)} />
          </button>`)}
      </div>`}`;
}
