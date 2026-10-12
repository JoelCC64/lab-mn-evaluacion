// Eliminar un grupo de un evento (por ejemplo, llegaron menos estudiantes de los previstos y se rehacen los grupos).
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Aviso, Persona, ir } from './base.js';
import { eliminarGrupo } from '../datos/acciones.js';
import { gruposDe } from '../nucleo/motor.js';
import { listaDeGrupos } from '../nucleo/grupos.js';
import { resumenEliminarGrupo, tieneRegistros } from '../nucleo/eliminar-grupo.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function BotonEliminarGrupo({ ctx, evento, grupo }) {
  const [abierta, setAbierta] = useState(false);
  return html`
    <button class="boton chico" style="align-self:flex-start" onClick=${() => setAbierta(true)}>Eliminar este grupo…</button>
    ${abierta && html`<${HojaEliminarGrupo} ctx=${ctx} evento=${evento} grupo=${grupo} cerrar=${() => setAbierta(false)} />`}`;
}

function HojaEliminarGrupo({ ctx, evento, grupo, cerrar }) {
  const { db, avisar } = useApp();
  const grupos = gruposDe(ctx, evento);
  const r = resumenEliminarGrupo(ctx, evento, grupo);
  const presentes = r.integrantes.filter((i) => !i.falta);
  const faltaron = r.integrantes.filter((i) => i.falta);
  const otros = listaDeGrupos(grupos, ctx.reg.estudiantes).grupos.filter((g) => g.grupo !== grupo);
  const cerrado = ctx.pases.get(evento.id)?.cerrado;
  // Destino de quienes sí vinieron: undefined = aún sin elegir; null = sin grupo.
  const [destino, setDestino] = useState(presentes.length === 0 ? null : undefined);
  const b = r.borra;
  const registros = [
    b.puntajes && plural(b.puntajes, 'puntaje de la rúbrica', 'puntajes de la rúbrica'),
    b.etiquetas && plural(b.etiquetas, 'etiqueta', 'etiquetas'),
    b.revision && 'el pase y la firma del grupo',
    b.notas && plural(b.notas, 'nota del profesor', 'notas del profesor'),
    b.feedback && 'el feedback editado',
    b.trabajos && plural(b.trabajos, 'entrega de un trabajo en casa', 'entregas de trabajos en casa'),
    b.retro && 'la retroalimentación dada en el taller siguiente',
  ].filter(Boolean);
  const eliminar = async () => {
    try {
      await eliminarGrupo(db, evento.id, grupos, grupo, { destino, tcs: r.tcs, talleres: r.talleres });
      avisar(`Grupo ${grupo} eliminado.`, 'ok');
      cerrar();
      ir('evento', evento.id, 'grupos');
    } catch (e) { avisar(e.message, 'mal'); }
  };
  if (cerrado) {
    return html`
      <${Hoja} titulo=${`Eliminar el grupo ${grupo}`} alCerrar=${cerrar}>
        <${Aviso} tono="aviso">El pase de ${evento.codigo} está cerrado. Reábrelo en la pestaña «Grupos» para eliminar un grupo.<//>
        <button class="boton ancho" onClick=${cerrar}>Entendido</button>
      <//>`;
  }
  return html`
    <${Hoja} titulo=${`Eliminar el grupo ${grupo}`} alCerrar=${cerrar}>
      <p class="tenue pequeno">El grupo deja de existir en este evento y en los siguientes que aún no tengan sus propios grupos. Úsalo, por ejemplo, si llegaron menos
        estudiantes y vas a rehacer los grupos.</p>
      <div class="lista">
        ${r.integrantes.map((i) => html`<div class="fila"><${Persona} estudiante=${i.estudiante} detalle=${i.falta ? html`<${Chip} tono="mal">no vino<//>` : null} /></div>`)}
        ${r.integrantes.length === 0 && html`<div class="fila tenue">El grupo no tiene integrantes.</div>`}
      </div>
      ${faltaron.length > 0 && html`<p class="pequeno">${plural(faltaron.length, 'integrante que no vino queda', 'integrantes que no vinieron quedan')} <b>sin grupo</b>.</p>`}
      ${presentes.length > 0 && html`
        <p class="pequeno"><b>${plural(presentes.length, 'integrante pasa', 'integrantes pasan')} a:</b></p>
        <div class="lista">
          ${otros.map((g) => html`
            <button class=${`fila ${destino === g.grupo ? 'elegida' : ''}`} onClick=${() => setDestino(g.grupo)}>
              <span class="grupo-num">${g.grupo}</span>
              <div class="principal"><div class="linea1">${g.integrantes.map((e) => e.nombre.split(' ')[0]).join(' · ')}</div>
              <div class="linea2">${g.integrantes.length} integrantes${destino === g.grupo ? ' · elegido ✓' : ''}</div></div>
            </button>`)}
          <button class=${`fila ${destino === null ? 'elegida' : ''}`} onClick=${() => setDestino(null)}>
            <span class="grupo-num vacio">–</span>
            <div class="principal"><div class="linea1">Sin grupo</div>
            <div class="linea2">${destino === null ? 'elegido ✓ · ' : ''}al cerrar el pase cuenta como «no vino»; asígnalos antes</div></div>
          </button>
        </div>
        <p class="tenue pequeno">Para repartirlos en varios grupos, elige «Sin grupo» y muévelos uno por uno desde «Grupos».</p>`}
      ${registros.length > 0
        ? html`<${Aviso} tono="mal" titulo="Se borra lo registrado de este grupo">${registros.join('; ')}. No se puede deshacer.<//>`
        : html`<p class="tenue pequeno">Este grupo no tiene nada registrado: no se borra ninguna nota.</p>`}
      <div class="botones">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        <button class="boton peligro-fuerte" disabled=${destino === undefined} onClick=${eliminar}>${destino === undefined ? 'Elige a dónde pasan' : 'Eliminar el grupo'}</button>
      </div>
    <//>`;
}
