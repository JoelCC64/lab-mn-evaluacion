// Recuperaciones (Fase 6): un estudiante del curso recupera la actividad en otra sesión. Con falta justificada:
// se registra la nota recibida; si no asiste a la recuperación programada, 0. En un feriado es opcional: si la
// recupera, cuenta en su nota.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Persona } from './base.js';
import { BuscarEstudiante } from './buscar.js';
import { borrarRecuperacion, guardarRecuperacion } from '../datos/acciones.js';
import { activos } from '../nucleo/grupos.js';
import { redondear } from '../nucleo/util.js';

const TEXTO_ESTADO = { solicitada: 'solicitada', realizada: 'realizada', no_asistio: 'no asistió' };

/** Resumen corto de una recuperación: «realizada · 8/10 · GR3QA, jue 15 oct». */
export function textoRecuperacion(rec) {
  return [TEXTO_ESTADO[rec.estado] ?? rec.estado, rec.estado === 'realizada' ? `${redondear(rec.nota * 10, 2)}/10` : null, rec.detalle]
    .filter(Boolean).join(' · ');
}

/** Hoja para registrar o corregir la recuperación de un estudiante en un evento. */
export function HojaRecuperacion({ evento, estudiante, actual, alCerrar }) {
  const { db, avisar } = useApp();
  const feriado = evento.estado !== 'normal';
  const [estado, setEstado] = useState(actual?.estado ?? (feriado ? 'realizada' : 'solicitada'));
  const [nota, setNota] = useState(actual?.nota !== null && actual?.nota !== undefined ? String(redondear(actual.nota * 10, 2)) : '');
  const [detalle, setDetalle] = useState(actual?.detalle ?? '');
  const opciones = [['solicitada', 'Solicitada'], ['realizada', 'Realizada'], ...(feriado ? [] : [['no_asistio', 'No asistió · 0']])];
  const guardar = async () => {
    const v = estado === 'realizada' ? Number(String(nota).replace(',', '.')) / 10 : null;
    try {
      await guardarRecuperacion(db, evento.id, estudiante.id, { estado, nota: v, detalle, motivo: feriado ? 'feriado' : 'justificada' });
      avisar('Recuperación guardada.', 'ok');
      alCerrar();
    } catch (e) { avisar(e.message, 'mal'); }
  };
  const quitar = async () => { await borrarRecuperacion(db, evento.id, estudiante.id); avisar('Recuperación quitada.'); alCerrar(); };
  return html`
    <${Hoja} titulo=${`Recuperación de ${evento.codigo}`} alCerrar=${alCerrar}>
      <${Persona} estudiante=${estudiante} />
      <p class="tenue pequeno">${feriado
        ? `${evento.codigo} no se hizo en este curso (${evento.motivo}). Recuperarla es opcional: si la recupera, cuenta en su nota.`
        : 'Falta justificada: recupera en otra sesión. Mientras tanto su nota queda pendiente; si no asiste a la recuperación programada, 0.'}</p>
      <div class="segmentado" role="group" aria-label="Estado de la recuperación">
        ${opciones.map(([id, texto]) => html`
          <button class=${estado === id ? `elegido ${id === 'realizada' ? 'ok' : id === 'no_asistio' ? 'mal' : 'aviso'}` : ''} onClick=${() => setEstado(id)}>${texto}</button>`)}
      </div>
      ${estado === 'realizada' && html`
        <div class="campo"><label>Nota recibida (sobre 10)</label>
          <input class="entrada" inputmode="decimal" placeholder="0–10" value=${nota} onInput=${(e) => setNota(e.currentTarget.value)} /></div>`}
      <div class="campo"><label>Dónde y cuándo (opcional)</label>
        <input class="entrada" placeholder="Ej.: GR3QA, jue 15 oct" value=${detalle} onInput=${(e) => setDetalle(e.currentTarget.value)} /></div>
      ${!feriado && estado !== 'realizada' && html`<p class="tenue pequeno">${estado === 'solicitada' ? 'Nota y preparatorio de esta sesión: pendientes.' : 'Nota y preparatorio de esta sesión: 0.'}</p>`}
      ${!feriado && estado === 'realizada' && html`<p class="tenue pequeno">El preparatorio de esta sesión no se cuenta en su promedio (lo revisa la sesión de recuperación).</p>`}
      <div class="botones">
        ${actual && html`<button class="boton" onClick=${quitar}>Quitar</button>`}
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton primario" disabled=${estado === 'realizada' && nota === ''} onClick=${guardar}>Guardar</button>
      </div>
    <//>`;
}

/**
 * Recuperaciones de un evento que no se hizo en el curso (feriado o sin clase): las registradas y un buscador
 * para agregar otra.
 */
export function RecuperacionesDelEvento({ ctx, evento }) {
  const [abierta, setAbierta] = useState(null);
  const registradas = ctx.reg.recuperaciones.filter((r) => r.evento === evento.id);
  const porId = ctx.estudiantePorId;
  if (!evento.con_nota) return null;
  return html`
    <div class="seccion-titulo">Recuperaciones · ${registradas.length}</div>
    ${registradas.length > 0 && html`
      <div class="lista">
        ${registradas.map((r) => {
          const e = porId.get(r.estudiante);
          return e && html`
            <button class="fila" onClick=${() => setAbierta({ estudiante: e, actual: r })}>
              <${Persona} estudiante=${e} detalle=${html`<${Chip} tono=${r.estado === 'realizada' ? 'ok' : 'aviso'}>${textoRecuperacion(r)}<//>`} />
            </button>`;
        })}
      </div>`}
    <p class="tenue pequeno">Si alguien recupera ${evento.codigo} en otra sesión, búscalo y registra la nota recibida:</p>
    <${BuscarEstudiante} estudiantes=${activos(ctx.reg.estudiantes)} alElegir=${(e) => setAbierta({ estudiante: e, actual: ctx.recuperaciones.get(`${evento.id}|${e.id}`) ?? null })} />
    ${abierta && html`<${HojaRecuperacion} evento=${evento} estudiante=${abierta.estudiante} actual=${abierta.actual} alCerrar=${() => setAbierta(null)} />`}`;
}

/** Parte de la hoja de detalle de un estudiante (resumen del evento): su recuperación o el botón para registrarla. */
export function RecuperacionDelEstudiante({ ctx, evento, estudiante, falta }) {
  const [abierta, setAbierta] = useState(false);
  const rec = ctx.recuperaciones.get(`${evento.id}|${estudiante.id}`) ?? null;
  if (!rec && !falta) return null;
  return html`
    <div class="tarjeta">
      <div class="separado"><h3>Recuperación</h3>${rec && html`<${Chip} tono=${rec.estado === 'realizada' ? 'ok' : rec.estado === 'no_asistio' ? 'mal' : 'aviso'}>${textoRecuperacion(rec)}<//>`}</div>
      ${!rec && html`<p class="tenue pequeno">Si la falta es justificada (Bienestar Estudiantil) y recupera en otra sesión, regístralo aquí.</p>`}
      <button class="boton ancho" onClick=${() => setAbierta(true)}>${rec ? 'Corregir la recuperación' : 'Registrar recuperación…'}</button>
    </div>
    ${abierta && html`<${HojaRecuperacion} evento=${evento} estudiante=${estudiante} actual=${rec} alCerrar=${() => setAbierta(false)} />`}`;
}

