// Notas del bimestre de un curso (Fase 6): una fila por estudiante con sus componentes y la nota acumulada o la
// proyectada (sin mezclarlas), lo que falta evaluar y el desglose de cada nota: qué entró, con qué peso, qué se
// excluyó y qué se ajustó, con su motivo.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Pantalla, Chip, Hoja, Aviso, Cargando, Persona, enlace } from './base.js';
import { useCurso, textoBimestre } from './curso-datos.js';
import { notaBimestre } from '../nucleo/motor.js';
import { activos } from '../nucleo/grupos.js';
import { esquemaDe, nombreMetodologia } from '../nucleo/config.js';
import { avisoControlCierre, bimestreEnCurso, pendientesDelBimestre } from '../nucleo/bimestre.js';
import { notaFinalDelBimestre } from '../nucleo/resultados.js';
import { sobreDiez } from '../nucleo/motor-vista.js';
import { fechaCorta, fechaLarga, hoyLocal, redondear } from '../nucleo/util.js';

/** Puntos con 2 decimales («1.22»), o «—». */
export const dos = (x) => (x === null || x === undefined ? '—' : redondear(x, 2).toFixed(2));
const apellidos = (n) => String(n).split(' ').filter(Boolean).slice(0, 2).join(' ');
const nombres = (n) => String(n).split(' ').filter(Boolean).slice(2).join(' ');

export function Notas({ paralelo }) {
  const { cfg } = useApp();
  const { curso, ctx, cargando } = useCurso(paralelo);
  const hoy = hoyLocal();
  const [bimestre, setBimestre] = useState(() => bimestreEnCurso(cfg, hoy)?.bimestre ?? 2);
  const [vista, setVista] = useState('acumulada');
  const [detalle, setDetalle] = useState(null);
  if (!curso) return html`<${Pantalla} titulo="Notas" atras="#/"><${Aviso} tono="mal">No existe el curso ${paralelo}.<//><//>`;
  const subtitulo = `${paralelo} · ${nombreMetodologia(cfg, curso.metodologia)} · cronograma ${curso.cronograma}`;
  if (cargando || !ctx) return html`<${Pantalla} titulo="Notas del bimestre" subtitulo=${subtitulo} atras=${enlace('curso', paralelo)}><${Cargando} /><//>`;

  const esquema = esquemaDe(cfg, curso.metodologia, bimestre);
  const comps = esquema.componentes.filter((c) => c.valor > 0);
  const filas = activos(ctx.reg.estudiantes).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((e) => ({ e, nb: notaBimestre(ctx, e.id, bimestre), final: notaFinalDelBimestre(ctx, e.id, bimestre) }));
  const completas = filas.filter((f) => f.final !== null).length;
  const { pendientes, porVenir } = pendientesDelBimestre(ctx, bimestre, hoy);
  const aviso = avisoControlCierre(ctx, bimestre, hoy);
  const envio = cfg.semestre.envio_notas[bimestre];
  const valor = (x) => (vista === 'acumulada' ? x.acumulada : x.proyectada);

  return html`
    <${Pantalla} titulo="Notas del bimestre" subtitulo=${subtitulo} atras=${enlace('curso', paralelo)}>
      <div class="segmentado" role="group" aria-label="Bimestre">
        ${[1, 2].map((b) => html`<button class=${bimestre === b ? 'elegido ok' : ''} onClick=${() => setBimestre(b)}>${textoBimestre(b)}</button>`)}
      </div>
      <div class="tarjeta">
        <div class="separado"><h2>${completas}/${filas.length} notas completas</h2><${Chip}>envío: ${fechaCorta(envio)}<//></div>
        <p class="tenue pequeno">Sobre ${esquema.total}. La nota completa es la que va al Excel y a coordinación (hasta el ${fechaLarga(envio)}).</p>
        ${pendientes.length > 0 && html`
          <div class="pequeno"><b>Faltan por evaluar:</b>
            <ul class="lista-pendientes">
              ${pendientes.map((p) => html`<li><a class="negrita enlace" href=${enlace('evento', p.evento.id)}>${p.evento.codigo}</a> · ${p.motivo} (${p.pendientes})</li>`)}
            </ul>
          </div>`}
        ${porVenir.length > 0 && html`<p class="tenue pequeno">Por venir: ${porVenir.map((e) => e.codigo).join(', ')}.</p>`}
      </div>
      ${aviso && html`
        <${Aviso} tono="aviso" titulo=${aviso.quedan ? `Quedan ${aviso.quedan} sesiones del ${textoBimestre(bimestre)}: ${aviso.sinControl.length} sin control oral` : `El ${textoBimestre(bimestre)} terminó: ${aviso.sinControl.length} sin control oral`}
          lista=${aviso.sinControl.map((e) => e.nombre)}>
          ${aviso.quedan ? 'Sortéalos primero en las sesiones que quedan.' : 'Su Planificación y conocimiento sale solo de los preparatorios, con una observación.'}
        <//>`}
      <div class="segmentado" role="group" aria-label="Nota">
        <button class=${vista === 'acumulada' ? 'elegido ok' : ''} onClick=${() => setVista('acumulada')}>Acumulada</button>
        <button class=${vista === 'proyectada' ? 'elegido ok' : ''} onClick=${() => setVista('proyectada')}>Proyectada</button>
      </div>
      <p class="tenue pequeno">${vista === 'acumulada'
        ? 'Acumulada: lo ya evaluado, con lo pendiente en 0.'
        : 'Proyectada: si lo que falta saliera como el promedio de lo ya evaluado («—» si aún no hay nada).'}</p>
      <div class="lista desplazable">
        <table class="tabla tabla-notas tabla-bimestre">
          <thead><tr>
            <th>Estudiante</th>
            ${comps.map((c) => html`<th class="num">${c.corto ?? c.nombre}</th>`)}
            <th class="num">Total</th>
          </tr></thead>
          <tbody>
            ${filas.map((f) => html`
              <tr onClick=${() => setDetalle(f.e.id)} style="cursor:pointer">
                <td class="nombre-celda">${apellidos(f.e.nombre)}${f.e.estado === 'pendiente' ? ' ·p' : ''}<span class="nombres">${nombres(f.e.nombre)}</span></td>
                ${f.nb.componentes.map((c) => html`<td class="num">${dos(valor(c))}</td>`)}
                <td class="num negrita">${dos(valor(f.nb))}${f.final !== null ? html`<span class="marca-final"> ✓</span>` : ''}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
      <p class="tenue pequeno">${comps.map((c) => `${c.corto ?? c.nombre}: ${c.nombre} (/${c.valor})`).join(' · ')}. ✓ nota completa · p = pendiente de nómina. Toca una fila para ver el desglose.</p>
      <a class="tarjeta" href=${enlace('curso', paralelo, 'revision')}>
        <div class="separado"><h2>Revisión de notas</h2><span class="flecha">›</span></div>
        <p class="tenue pequeno">Para mostrar en clase (semana 18): el desglose de un estudiante a la vez, sin las notas de los demás.</p>
      </a>
      ${detalle && html`<${HojaDesglose} ctx=${ctx} fila=${filas.find((f) => f.e.id === detalle)} bimestre=${bimestre} esquema=${esquema} cerrar=${() => setDetalle(null)} />`}
    <//>`;
}

function textoItem(i) {
  if (i.estado === 'calculada') return `${sobreDiez(i.valor)}/10${i.motivo ? ` · ${i.motivo}` : ''}`;
  if (i.estado === 'excluido') return `no cuenta · ${i.motivo}`;
  return `pendiente · ${i.motivo ?? 'sin evaluar'}`;
}

function HojaDesglose({ ctx, fila, bimestre, esquema, cerrar }) {
  if (!fila) return null;
  const { e, nb, final } = fila;
  return html`
    <${Hoja} titulo=${`Desglose · ${textoBimestre(bimestre)}`} alCerrar=${cerrar}>
      <${Persona} estudiante=${e} />
      <div class="resumen-numeros">
        <div><b>${dos(nb.acumulada)}</b><span>acumulada /${esquema.total}</span></div>
        <div><b>${dos(nb.proyectada)}</b><span>proyectada</span></div>
        <div><b>${final === null ? '—' : dos(final)}</b><span>${final === null ? 'final: falta evaluar' : 'final (Excel)'}</span></div>
      </div>
      ${nb.componentes.map((c) => html`<${Componente} c=${c} pesos=${esquema.componentes.find((x) => x.id === c.id)?.items} />`)}
      <button class="boton ancho" onClick=${cerrar}>Cerrar</button>
    <//>`;
}

/** Un componente del bimestre con su desglose (también en la revisión de notas). */
export function Componente({ c, pesos }) {
  const pct = (x) => `${Math.round((x ?? 0) * 100)} %`;
  const validos = (c.items ?? []).filter((i) => i.estado !== 'excluido' && i.estado !== 'sin_nota');
  const pesoTotal = validos.reduce((s, i) => s + i.peso, 0);
  return html`
    <div class="tarjeta desglose">
      <div class="separado">
        <h3>${c.nombre}</h3>
        <span class="pequeno"><b>${dos(c.acumulada)}</b> / ${c.valor}${c.proyectada !== null ? ` · proy. ${dos(c.proyectada)}` : ''}</span>
      </div>
      ${c.items && html`
        <ul class="desglose-items">
          ${c.items.filter((i) => i.estado !== 'sin_nota').map((i) => html`
            <li class=${i.estado}>
              <b>${i.codigo}</b>
              ${i.estado !== 'excluido' && pesoTotal > 0 && html`<span class="tenue"> · ${Math.round((i.peso / pesoTotal) * 100)} %</span>`}
              <span> · ${textoItem(i)}</span>
            </li>`)}
        </ul>`}
      ${c.preparatorios && html`
        <div class="pequeno"><b>Preparatorios</b> (${pct(pesos?.trabajo_preparatorio)}, promedio ${c.promedios.preparatorio === null ? '—' : sobreDiez(c.promedios.preparatorio)}):
          ${c.preparatorios.length ? c.preparatorios.map((p) => `${p.codigo} ${p.estado === 'calculada' ? `${p.nivel}/2` : 'pendiente'}`).join(' · ') : 'ninguno'}</div>
        <div class="pequeno"><b>Control oral</b> (${pct(pesos?.control_oral)}, promedio ${c.promedios.control === null ? '—' : sobreDiez(c.promedios.control)}):
          ${c.controles.length ? c.controles.map((x) => `${x.codigo} ${x.valor !== null && x.valor !== undefined ? sobreDiez(x.valor) : '—'}`).join(' · ') : 'sin control en el bimestre'}</div>`}
      ${!c.items && c.observaciones?.length > 0 && html`<p class="tenue pequeno">${c.observaciones.join(' · ')}</p>`}
    </div>`;
}
