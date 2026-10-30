// Datos › «Notas escritas en las observaciones»: lista los grupos cuya observación es una nota y las pasa al campo de
// nota con decimales, con vista previa. Lo dudoso (cambia más del 30 %) viene sin marcar.
import { useEffect, useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip } from './base.js';
import { aplicarPropuestasDeObservaciones, leerPropuestasDeObservaciones } from '../datos/notas-observaciones.js';
import { textoPuntos } from '../nucleo/motor-vista.js';

const clave = (p) => `${p.evento.id}|${p.grupo}`;

export function NotasDeObservaciones() {
  const { db, cfg, avisar } = useApp();
  const [lista, setLista] = useState(null);
  const [marcadas, setMarcadas] = useState(new Set());
  const [ocupado, setOcupado] = useState(false);

  const leer = async () => {
    const propuestas = await leerPropuestasDeObservaciones(db, cfg);
    setLista(propuestas);
    setMarcadas(new Set(propuestas.filter((p) => !p.invalida && !p.revisar).map(clave)));
  };
  useEffect(() => { leer(); }, []);

  const alternar = (p) => setMarcadas((m) => { const x = new Set(m); if (!x.delete(clave(p))) x.add(clave(p)); return x; });
  const aplicar = async () => {
    setOcupado(true);
    try {
      const n = await aplicarPropuestasDeObservaciones(db, lista.filter((p) => marcadas.has(clave(p))));
      avisar(`${n} nota${n === 1 ? '' : 's'} pasada${n === 1 ? '' : 's'} del comentario al grupo.`);
      await leer();
    } finally { setOcupado(false); }
  };

  return html`
    <div class="tarjeta">
      <h2>Notas escritas en las observaciones</h2>
      <p class="tenue pequeno">
        Si escribiste la nota de un grupo en su observación («9.5», «1.8»), en una práctica, un taller o un trabajo en casa, aquí la
        pasas al campo de nota con decimales: queda fijada y reemplaza a la de la rúbrica (o a la de las preguntas del TC); el número se quita de la observación. Las dudosas (cambian más del 30 % del tope) vienen sin marcar.
      </p>
      ${lista === null ? html`<p class="tenue pequeno">Buscando…</p>`
        : !lista.length ? html`<p class="tenue pequeno">No hay observaciones con una nota por pasar.</p>`
        : html`
          <div class="lista">
            ${lista.map((p) => html`
              <label class="fila">
                <input type="checkbox" checked=${marcadas.has(clave(p))} disabled=${p.invalida} onChange=${() => alternar(p)} />
                <div class="principal">
                  <div class="linea1">${p.curso} · ${p.evento.codigo} · ${p.unidad === 'grupo' ? `grupo ${p.grupo}` : p.nombre}</div>
                  <div class="linea2 fila-flex">
                    <span>${p.actual === null ? 'sin nota' : textoPuntos(p.actual)} → <b>${textoPuntos(p.valor)}</b> / ${p.tope}</span>
                    ${p.invalida && html`<${Chip} tono="mal">pasa del tope<//>`}
                    ${p.revisar && html`<${Chip} tono="aviso">revisar<//>`}
                    ${p.resto && html`<span class="tenue pequeno">queda: «${p.resto.length > 40 ? `${p.resto.slice(0, 40)}…` : p.resto}»</span>`}
                  </div>
                </div>
              </label>`)}
          </div>
          <div class="botones">
            <button class="boton primario" disabled=${ocupado || !marcadas.size} onClick=${aplicar}>Pasar ${marcadas.size} nota${marcadas.size === 1 ? '' : 's'}</button>
          </div>`}
    </div>`;
}
