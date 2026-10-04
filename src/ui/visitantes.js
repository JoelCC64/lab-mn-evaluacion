// Estudiantes de otros docentes que recuperan en esta sesión (Fase 6): se agregan a un grupo, se califican con él y
// la app arma el texto con la nota para su profesor (copiar o compartir; enviarlo en las 24 h siguientes).
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Aviso, Persona } from './base.js';
import { agregarVisitante, quitarVisitante } from '../datos/acciones.js';
import { notaEvento } from '../nucleo/motor.js';
import { textoParaSuProfesor, visitantesDelEvento } from '../nucleo/visitantes.js';
import { sobreDiez } from '../nucleo/motor-vista.js';

/** Formulario para agregar a un estudiante de otro curso al grupo `grupo` del evento. */
export function HojaVisitante({ evento, grupo, grupos, alCerrar }) {
  const { db, avisar } = useApp();
  const [datos, setDatos] = useState({ codigo: '', nombre: '', paralelo: '', profesor: '' });
  const campo = (k, etiqueta, extra = {}) => html`
    <div class="campo"><label>${etiqueta}</label>
      <input class="entrada" value=${datos[k]} onInput=${(e) => setDatos({ ...datos, [k]: e.currentTarget.value })} ...${extra} /></div>`;
  const guardar = async () => {
    try {
      await agregarVisitante(db, evento.id, grupos, grupo, datos);
      avisar(`Agregado al grupo ${grupo}.`, 'ok');
      alCerrar();
    } catch (e) { avisar(e.message, 'mal'); }
  };
  return html`
    <${Hoja} titulo=${`Recupera aquí · grupo ${grupo}`} alCerrar=${alCerrar}>
      <p class="tenue pequeno">Estudiante de otro docente que recupera ${evento.codigo} en esta sesión. Se califica con su grupo, no va al Excel y la app arma el texto con su nota para su profesor.</p>
      ${campo('codigo', 'Código único', { inputmode: 'numeric', autocomplete: 'off' })}
      ${campo('nombre', 'Apellidos y nombres', { autocapitalize: 'characters', autocomplete: 'off' })}
      ${campo('paralelo', 'Su paralelo (opcional)', { autocapitalize: 'characters', placeholder: 'Ej.: GR5XX' })}
      ${campo('profesor', 'Su profesor (opcional)')}
      <div class="botones">
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton primario" disabled=${!datos.codigo.trim() || !datos.nombre.trim()} onClick=${guardar}>Agregar</button>
      </div>
    <//>`;
}

/** Tarjeta del resumen: los visitantes del evento, su nota y el texto para su profesor. */
export function TarjetaVisitantes({ ctx, evento }) {
  const visitantes = visitantesDelEvento(ctx, evento);
  const [abierto, setAbierto] = useState(null);
  if (!visitantes.length) return null;
  return html`
    <div class="seccion-titulo">Recuperan aquí (otros cursos) · ${visitantes.length}</div>
    <div class="lista">
      ${visitantes.map((v) => {
        const n = notaEvento(ctx, evento, v.id);
        return html`
          <button class="fila" onClick=${() => setAbierto(v)}>
            <${Persona} estudiante=${v} detalle=${html`<${Chip} tono=${n.estado === 'calculada' ? 'ok' : ''}>${n.estado === 'calculada' ? `${sobreDiez(n.valor)}/10` : 'nota pendiente'}<//>`} />
            <span class="flecha">›</span>
          </button>`;
      })}
    </div>
    <p class="tenue pequeno">Envía la nota a su profesor en las 24 h siguientes: toca a cada uno para copiar o compartir el texto.</p>
    ${abierto && html`<${HojaTextoProfesor} ctx=${ctx} evento=${evento} visitante=${abierto} alCerrar=${() => setAbierto(null)} />`}`;
}

function HojaTextoProfesor({ ctx, evento, visitante, alCerrar }) {
  const { db, avisar } = useApp();
  const { texto, final } = textoParaSuProfesor(ctx, evento, visitante);
  const [quitando, setQuitando] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); avisar('Texto copiado.', 'ok'); } catch { avisar('No se pudo copiar: selecciona el texto y cópialo.', 'mal'); }
  };
  const compartir = async () => {
    try { await navigator.share({ text: texto }); } catch (e) { if (e?.name !== 'AbortError') copiar(); }
  };
  const quitar = async () => { await quitarVisitante(db, evento.id, visitante.id); avisar('Quitado del evento.'); alCerrar(); };
  return html`
    <${Hoja} titulo="Nota para su profesor" alCerrar=${alCerrar}>
      ${!final && html`<${Aviso} tono="aviso">La nota aún está pendiente: envía el texto cuando esté completa.<//>`}
      ${visitante.visita?.profesor && html`<p class="pequeno">Para: <b>${visitante.visita.profesor}</b></p>`}
      <textarea class="entrada texto-profesor" readonly rows="12" value=${texto}></textarea>
      <div class="botones">
        <button class="boton" onClick=${copiar}>Copiar</button>
        ${typeof navigator !== 'undefined' && navigator.share && html`<button class="boton primario" onClick=${compartir}>Compartir</button>`}
      </div>
      ${quitando
        ? html`<div class="botones"><button class="boton" onClick=${() => setQuitando(false)}>No</button><button class="boton peligro-fuerte" onClick=${quitar}>Sí, quitarlo del evento</button></div>`
        : html`<button class="boton chico" style="align-self:flex-start" onClick=${() => setQuitando(true)}>Quitar del evento (lo agregué por error)</button>`}
    <//>`;
}
