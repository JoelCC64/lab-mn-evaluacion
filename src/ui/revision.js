// Revisión de notas (semana 18, Fase 7): el desglose del bimestre de un estudiante a la vez, en letra grande, para
// mostrarlo en clase. No muestra las notas de los demás: se pasa al siguiente con ‹ › o se busca por apellido.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Pantalla, Aviso, Cargando, Hoja, enlace } from './base.js';
import { useCurso, textoBimestre } from './curso-datos.js';
import { BuscarEstudiante } from './buscar.js';
import { Componente, dos } from './notas.js';
import { notaBimestre } from '../nucleo/motor.js';
import { activos } from '../nucleo/grupos.js';
import { esquemaDe, nombreMetodologia } from '../nucleo/config.js';
import { bimestreEnCurso } from '../nucleo/bimestre.js';
import { notaFinalDelBimestre } from '../nucleo/resultados.js';
import { hoyLocal } from '../nucleo/util.js';

export function RevisionNotas({ paralelo }) {
  const { cfg } = useApp();
  const { curso, ctx, cargando } = useCurso(paralelo);
  const [bimestre, setBimestre] = useState(() => bimestreEnCurso(cfg, hoyLocal())?.bimestre ?? 2);
  const [i, setI] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const atras = enlace('curso', paralelo, 'notas');
  if (!curso) return html`<${Pantalla} titulo="Revisión de notas" atras="#/"><${Aviso} tono="mal">No existe el curso ${paralelo}.<//><//>`;
  if (cargando || !ctx) return html`<${Pantalla} titulo="Revisión de notas" subtitulo=${paralelo} atras=${atras}><${Cargando} /><//>`;

  const lista = activos(ctx.reg.estudiantes).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (!lista.length) return html`<${Pantalla} titulo="Revisión de notas" subtitulo=${paralelo} atras=${atras}><${Aviso}>Este curso no tiene estudiantes.<//><//>`;
  const k = Math.min(i, lista.length - 1);
  const e = lista[k];
  const esquema = esquemaDe(cfg, curso.metodologia, bimestre);
  const nb = notaBimestre(ctx, e.id, bimestre);
  const final = notaFinalDelBimestre(ctx, e.id, bimestre);

  return html`
    <${Pantalla} titulo="Revisión de notas" subtitulo=${`${paralelo} · ${nombreMetodologia(cfg, curso.metodologia)}`} atras=${atras}>
      <div class="segmentado" role="group" aria-label="Bimestre">
        ${[1, 2].map((b) => html`<button class=${bimestre === b ? 'elegido ok' : ''} onClick=${() => setBimestre(b)}>${textoBimestre(b)}</button>`)}
      </div>
      <div class="tarjeta revision-cabeza">
        <div class="revision-nombre">${e.nombre}</div>
        <div class="tenue">${e.codigo}</div>
        <div class="revision-total"><b>${dos(final ?? nb.acumulada)}</b><span> / ${esquema.total}</span></div>
        <div class="tenue pequeno">${final !== null
          ? `Nota del ${textoBimestre(bimestre)}, la que va a coordinación.`
          : `Acumulada: aún falta evaluar algo (lo pendiente cuenta 0)${nb.proyectada !== null ? `; proyectada ${dos(nb.proyectada)}` : ''}.`}</div>
      </div>
      ${nb.componentes.map((c) => html`<${Componente} key=${c.id} c=${c} pesos=${esquema.componentes.find((x) => x.id === c.id)?.items} />`)}
      <div class="pie-fijo revision-nav">
        <button class="boton" aria-label="Anterior" disabled=${k === 0} onClick=${() => setI(k - 1)}>‹</button>
        <button class="boton crece" onClick=${() => setBuscando(true)}>${k + 1} de ${lista.length} · Buscar</button>
        <button class="boton" aria-label="Siguiente" disabled=${k === lista.length - 1} onClick=${() => setI(k + 1)}>›</button>
      </div>
      ${buscando && html`
        <${Hoja} titulo="Buscar estudiante" alCerrar=${() => setBuscando(false)}>
          <${BuscarEstudiante} estudiantes=${lista} alElegir=${(x) => { setI(lista.indexOf(x)); setBuscando(false); }} />
          <button class="boton ancho" onClick=${() => setBuscando(false)}>Cerrar</button>
        <//>`}
    <//>`;
}
