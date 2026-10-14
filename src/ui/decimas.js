// Décimas de premio: se dan a un grupo o a un estudiante por responder una pregunta compleja y se suman a la nota de la
// próxima práctica a la que asista cada uno (sin pasar de 10). Una fila por estudiante; un premio de grupo comparte lote.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Persona } from './base.js';
import { otorgarDecimas, quitarDecimas } from '../datos/acciones.js';
import { decimasDelEvento, destinoDecimas, premioCuenta } from '../nucleo/motor.js';

const VALORES = [0.1, 0.2, 0.3, 0.5, 1];
const texto = (v) => String(Math.round(v * 10) / 10);

/** Hoja para dar décimas a `estudiantes` (lista de estudiantes). `unidad`: 'grupo' o 'estudiante'. */
export function HojaDecimas({ ctx, evento, estudiantes, unidad, grupo = null, titulo, alCerrar }) {
  const { db, avisar } = useApp();
  const [valor, setValor] = useState(0.1);
  const [otro, setOtro] = useState('');
  const [motivo, setMotivo] = useState('');
  const v = otro.trim() !== '' ? Number(otro.replace(',', '.')) : valor;
  const valido = v > 0 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
  const destinos = [...new Set(estudiantes.map((e) => destinoDecimas(ctx, evento.id, e.id)?.codigo ?? null))];
  const donde = destinos.length === 1 && destinos[0] ? destinos[0] : destinos.every((d) => d === null) ? null : 'varias';
  const dar = async () => {
    try {
      await otorgarDecimas(db, evento.id, estudiantes.map((e) => e.id), { valor: v, motivo, unidad, grupo });
      avisar(`+${texto(v)} décimas ${unidad === 'grupo' ? `al grupo ${grupo}` : `a ${estudiantes[0].nombre.split(' ')[0]}`}.`, 'ok');
      alCerrar();
    } catch (e) { avisar(e.message, 'mal'); }
  };
  return html`
    <${Hoja} titulo=${titulo} alCerrar=${alCerrar}>
      <p class="tenue pequeno">${`Por responder una pregunta compleja. Se suman a la nota de ${
        donde === 'varias' ? 'la próxima práctica a la que asista cada uno' : donde ? `la práctica ${donde}` : 'la próxima práctica (aún no hay una)'
      } (si falta, pasan a la siguiente a la que asista). La nota no pasa de 10.`}</p>
      ${estudiantes.length > 1 && html`<p class="pequeno"><b>${estudiantes.length} presentes:</b> ${estudiantes.map((e) => e.nombre.split(' ')[0]).join(' · ')}</p>`}
      ${estudiantes.length === 1 && html`<${Persona} estudiante=${estudiantes[0]} />`}
      <div class="segmentado" role="group" aria-label="Décimas">
        ${VALORES.map((x) => html`<button class=${otro.trim() === '' && valor === x ? 'elegido ok' : ''} onClick=${() => { setOtro(''); setValor(x); }}>+${texto(x)}</button>`)}
      </div>
      <div class="campo"><label>Otro valor (múltiplo de 0.1)</label>
        <input class="entrada" inputmode="decimal" placeholder="0.4" value=${otro} onInput=${(e) => setOtro(e.currentTarget.value)} /></div>
      <div class="campo"><label>Pregunta o motivo (opcional)</label>
        <input class="entrada" placeholder="Ej.: incertidumbre de la media" value=${motivo} onInput=${(e) => setMotivo(e.currentTarget.value)} /></div>
      ${!valido && html`<p class="texto-aviso pequeno">Las décimas van de 0.1 en 0.1.</p>`}
      <div class="botones">
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton primario" disabled=${!valido || estudiantes.length === 0} onClick=${dar}>Dar +${valido ? texto(v) : '…'}</button>
      </div>
    <//>`;
}

/** Premios dados en este evento (Resumen): uno por lote, con a quiénes, el motivo, dónde cuentan y cómo quitarlo. */
export function DecimasDelEvento({ ctx, evento }) {
  const { db, avisar } = useApp();
  const filas = (ctx.reg.decimas ?? []).filter((f) => f.evento === evento.id);
  const [quitando, setQuitando] = useState(null);
  if (!filas.length) return null;
  const lotes = [...new Map(filas.map((f) => [f.lote, f])).keys()].map((lote) => {
    const del = filas.filter((f) => f.lote === lote);
    return { lote, del, primera: del[0] };
  }).sort((a, b) => a.primera.fecha.localeCompare(b.primera.fecha));
  const nombre = (id) => ctx.estudiantePorId.get(id)?.nombre ?? id;
  const quitar = async () => {
    await quitarDecimas(db, evento.id, quitando.lote);
    avisar('Décimas quitadas.');
    setQuitando(null);
  };
  return html`
    <div class="seccion-titulo">Décimas de premio · ${filas.length === 1 ? '1 estudiante' : `${filas.length} estudiantes`}</div>
    <div class="lista">
      ${lotes.map(({ lote, del, primera }) => {
        const validas = del.filter((f) => premioCuenta(ctx, f));
        const sinContar = del.length - validas.length;
        const destinos = [...new Set(validas.map((f) => destinoDecimas(ctx, evento.id, f.estudiante)?.codigo ?? '—'))];
        return html`
          <div class="fila">
            <div class="principal">
              <div class="linea1">+${texto(primera.valor)} · ${primera.unidad === 'grupo' ? `grupo ${primera.grupo ?? ''} (${validas.length})` : nombre(primera.estudiante)}</div>
              <div class="linea2">${`${primera.motivo ?? 'sin motivo'} · ${validas.length ? `cuentan en ${destinos.join(' / ')}` : 'no cuentan'}${sinContar ? ` · ${sinContar} sin contar por faltar` : ''}`}</div>
            </div>
            <button class="boton chico" onClick=${() => setQuitando({ lote, del })}>Quitar</button>
          </div>`;
      })}
    </div>
    ${quitando && html`
      <${Hoja} titulo="¿Quitar estas décimas?" alCerrar=${() => setQuitando(null)}>
        <p>Se quitan +${texto(quitando.del[0].valor)} de ${quitando.del.length === 1 ? nombre(quitando.del[0].estudiante) : `${quitando.del.length} estudiantes`}. No se puede deshacer.</p>
        <div class="botones">
          <button class="boton" onClick=${() => setQuitando(null)}>Cancelar</button>
          <button class="boton peligro-fuerte" onClick=${quitar}>Quitar</button>
        </div>
      <//>`}`;
}

/** Fila para la ficha del estudiante: lo que ganó aquí y lo que se suma en este evento (si hay). */
export function DecimasDeEstudiante({ ctx, evento, estudiante, nota }) {
  const ganadas = (ctx.decimas?.get(estudiante.id) ?? []).filter((f) => f.evento === evento.id);
  const entran = decimasDelEvento(ctx, evento, estudiante.id);
  const aplica = nota?.decimas;
  if (!ganadas.length && !entran.total) return null;
  const codigo = (id) => ctx.eventoPorId.get(id)?.codigo ?? id;
  return html`
    <div class="tarjeta">
      <h3>Décimas de premio</h3>
      ${entran.total > 0 && html`
        <p class="pequeno"><b>${aplica ? `En ${evento.codigo}: +${texto(aplica.aplicadas)}` : `Se suman en ${evento.codigo}: +${texto(entran.total)} (cuando su nota esté calculada)`}</b>${aplica && aplica.aplicadas < aplica.total ? ` de ${texto(aplica.total)} (la nota no pasa de 10)` : ''}${' · '}${
          entran.filas.map((f) => `${texto(f.valor)} de ${codigo(f.evento)}${f.motivo ? ` (${f.motivo})` : ''}`).join(' + ')}</p>`}
      ${ganadas.map((f) => (premioCuenta(ctx, f)
        ? html`<p class="pequeno">${`Ganó +${texto(f.valor)}${f.motivo ? ` (${f.motivo})` : ''} aquí; cuenta en `}<b>${destinoDecimas(ctx, evento.id, estudiante.id)?.codigo ?? 'la próxima práctica (aún sin práctica)'}</b>.</p>`
        : html`<p class="pequeno">${`+${texto(f.valor)} del grupo${f.motivo ? ` (${f.motivo})` : ''}: no cuenta, porque faltó a esta clase.`}</p>`))}
    </div>`;
}

/** Botón para dar décimas a un estudiante o a un grupo desde la pantalla del grupo. */
export function BotonDecimas({ ctx, evento, estudiantes, unidad, grupo = null, etiqueta, titulo }) {
  const [abierta, setAbierta] = useState(false);
  return html`
    <button class="boton chico" onClick=${() => setAbierta(true)}>${etiqueta}</button>
    ${abierta && html`<${HojaDecimas} ctx=${ctx} evento=${evento} estudiantes=${estudiantes} unidad=${unidad} grupo=${grupo} titulo=${titulo} alCerrar=${() => setAbierta(false)} />`}`;
}
