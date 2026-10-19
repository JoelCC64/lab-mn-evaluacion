// Pestaña «Puerta»: revisión del trabajo preparatorio uno por uno, antes de entrar (y, en talleres, quién no hizo el coloquio).
// «Revisión hecha: todos cumplieron» + solo las novedades. La nota (2) se calcula al cerrar el pase.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Persona, Aviso } from './base.js';
import { BuscarEstudiante } from './buscar.js';
import { borrarNovedad, guardarNovedad, marcarRevisionPreparatorio, marcarSinColoquio } from '../datos/acciones.js';
import { preparatorioCalifica } from '../nucleo/config.js';
import { activos } from '../nucleo/grupos.js';
import { gruposDe } from '../nucleo/motor.js';

const hora = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

export function Puerta({ ctx, evento }) {
  const { cfg, db, avisar } = useApp();
  const califica = preparatorioCalifica(cfg, ctx.curso.metodologia);
  const revision = ctx.revisionPrep.get(evento.id);
  const novedades = ctx.reg.novedades_preparatorio.filter((n) => n.evento === evento.id);
  const [elegido, setElegido] = useState(null);
  const estudiantes = activos(ctx.reg.estudiantes);
  const porId = ctx.estudiantePorId;

  const marcar = async (v) => {
    await marcarRevisionPreparatorio(db, evento.id, v);
    if (v) avisar('Revisión hecha: quien no tenga novedad recibe 2 al cerrar el pase.', 'ok');
  };

  return html`
    <div class="tarjeta">
      <h2>${califica ? 'Trabajo preparatorio' : 'Revisión en la puerta'}</h2>
      <p class="tenue pequeno">
        ${califica
          ? 'Revisa uno por uno en la puerta. Al cerrar el pase final, quien esté presente y no tenga novedad recibe 2; quien falte, 0.'
          : 'En SQI el preparatorio no tiene nota: aquí solo se anota quién no ingresa.'}
      </p>
      ${revision?.revisada
        ? html`<div class="separado"><${Chip} tono="ok">✓ Revisión hecha · ${hora(revision.fecha)}<//><button class="boton chico" onClick=${() => marcar(false)}>Deshacer</button></div>`
        : html`<button class="boton ok grande" onClick=${() => marcar(true)}>✓ Revisión hecha: todos cumplieron</button>`}
    </div>

    <div class="seccion-titulo">Novedades · ${novedades.length}</div>
    <${BuscarEstudiante} estudiantes=${estudiantes} alElegir=${setElegido} placeholder="Apellido de quien no cumplió…" />
    ${novedades.length > 0 && html`
      <div class="lista">
        ${novedades.map((n) => {
          const est = porId.get(n.estudiante);
          if (!est) return null;
          return html`
            <button class="fila" onClick=${() => setElegido(est)}>
              <${Persona} estudiante=${est} detalle=${html`
                ${califica && n.nivel !== null ? html`<${Chip} tono=${n.nivel === 0 ? 'mal' : 'aviso'}>${cfg.preparatorio.nombres_novedad[String(n.nivel)]} · ${n.nivel}<//>` : null}
                ${n.no_ingresa ? html`<${Chip} tono="mal">no ingresa<//>` : null}`} />
            </button>`;
        })}
      </div>`}
    ${evento.tipo === 'taller' && html`<${SinColoquio} ctx=${ctx} evento=${evento} />`}
    ${!revision?.revisada && califica && html`<${Aviso} tono="aviso">Si no marcas la revisión, el preparatorio de quienes no tienen novedad queda pendiente.<//>`}
    ${elegido && html`<${HojaNovedad} evento=${evento} estudiante=${elegido} califica=${califica}
      actual=${novedades.find((n) => n.estudiante === elegido.id)} cerrar=${() => setElegido(null)} />`}`;
}

/** Taller: quienes están en clase pero no hicieron el coloquio (asisten, pero el taller queda sin nota). */
function SinColoquio({ ctx, evento }) {
  const { db, avisar } = useApp();
  const [eligiendo, setEligiendo] = useState(false);
  const grupos = gruposDe(ctx, evento);
  const marcados = ctx.reg.asistencia.filter((a) => a.evento === evento.id && a.sin_coloquio)
    .map((a) => ctx.estudiantePorId.get(a.estudiante)).filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return html`
    <div class="seccion-titulo">Sin coloquio · ${marcados.length}</div>
    <div class="tarjeta">
      <p class="tenue pequeno">Revisión del coloquio en la puerta: si entra pero no lo hizo, la asistencia no cambia, pero no puede tener nota en este taller (0).</p>
      ${marcados.map((e) => html`
        <div class="separado">
          <${Persona} estudiante=${e} detalle=${html`<${Chip} tono="aviso">sin nota<//>`} />
          <button class="boton chico" onClick=${() => marcarSinColoquio(db, evento.id, grupos, e.id, false)}>Quitar</button>
        </div>`)}
      <button class="boton chico ancho" onClick=${() => setEligiendo(true)}>+ Registrar a alguien sin coloquio…</button>
    </div>
    ${eligiendo && html`
      <${Hoja} titulo="¿Quién no hizo el coloquio?" alCerrar=${() => setEligiendo(false)}>
        <${BuscarEstudiante} estudiantes=${activos(ctx.reg.estudiantes).filter((e) => !marcados.some((m) => m.id === e.id) && !ctx.asistencia.get(`${evento.id}|${e.id}`)?.estado?.match(/no_vino|salio/))}
          alElegir=${async (e) => { await marcarSinColoquio(db, evento.id, grupos, e.id, true); avisar(`${e.nombre.split(' ')[0]}: sin coloquio, sin nota en ${evento.codigo}.`); setEligiendo(false); }} />
      <//>`}`;
}

function HojaNovedad({ evento, estudiante, califica, actual, cerrar }) {
  const { cfg, db, avisar } = useApp();
  const [observacion, setObservacion] = useState(actual?.observacion ?? '');
  const motivo = cfg.preparatorio.motivo_no_ingresa;
  const guardar = async (nivel, noIngresa) => {
    await guardarNovedad(db, evento.id, estudiante.id, { nivel, no_ingresa: noIngresa, observacion }, motivo);
    cerrar();
    avisar(`${estudiante.nombre.split(' ')[0]}: ${noIngresa ? 'no ingresa (falta)' : cfg.preparatorio.nombres_novedad[String(nivel)].toLowerCase()}`);
  };
  const quitar = async () => {
    await borrarNovedad(db, evento.id, estudiante.id, motivo);
    cerrar();
  };
  const es = (nivel, noIngresa) => actual && actual.nivel === nivel && Boolean(actual.no_ingresa) === noIngresa;
  return html`
    <${Hoja} titulo="Novedad del preparatorio" alCerrar=${cerrar}>
      <${Persona} estudiante=${estudiante} />
      <div class="campo">
        <label>Observación (opcional)</label>
        <input class="entrada" value=${observacion} onInput=${(e) => setObservacion(e.currentTarget.value)} placeholder="Por ejemplo: trajo otra práctica" />
      </div>
      ${califica
        ? html`
          <button class=${`boton grande ${es(1, false) ? 'primario' : ''}`} onClick=${() => guardar(1, false)}>Incompleto · 1</button>
          <button class=${`boton grande ${es(0, false) ? 'primario' : ''}`} onClick=${() => guardar(0, false)}>No lo hizo · 0 (sí ingresa)</button>
          <button class=${`boton grande ${es(0, true) ? 'peligro-fuerte' : 'peligro'}`} onClick=${() => guardar(0, true)}>No lo hizo y no ingresa · falta</button>`
        : html`
          <button class=${`boton grande ${es(null, true) ? 'peligro-fuerte' : 'peligro'}`} onClick=${() => guardar(null, true)}>No ingresa · falta</button>`}
      <div class="botones">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        ${actual && html`<button class="boton" onClick=${quitar}>Quitar novedad</button>`}
      </div>
    <//>`;
}
