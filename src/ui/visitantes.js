// Estudiantes de otros docentes que recuperan en esta sesión (Fase 6): se agregan a un grupo, se califican con él y
// la app arma el texto con la nota para su profesor (copiar o compartir; enviarlo en las 24 h siguientes).
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo, Chip, Hoja, Aviso, Persona } from './base.js';
import { agregarVisitante, quitarVisitante } from '../datos/acciones.js';
import { notaEvento } from '../nucleo/motor.js';
import { textoParaSuProfesor, visitantesDelEvento } from '../nucleo/visitantes.js';
import { sobreDiez } from '../nucleo/motor-vista.js';
import { AjusteProfesor, useProfesor } from './dispositivo.js';

/** Formulario para agregar a un estudiante de otro curso al grupo `grupo` del evento. */
export function HojaVisitante({ evento, grupo, grupos, alCerrar }) {
  const [modo, setModo] = useState('otro');
  return html`
    <${Hoja} titulo=${`${evento.con_nota ? 'Recupera aquí' : 'Asiste aquí'} · grupo ${grupo}`} alCerrar=${alCerrar}>
      <div class="botones">
        <button class=${`boton chico ${modo === 'otro' ? 'primario' : ''}`} onClick=${() => setModo('otro')}>De otro docente</button>
        <button class=${`boton chico ${modo === 'mio' ? 'primario' : ''}`} onClick=${() => setModo('mio')}>De mis otros cursos</button>
      </div>
      ${modo === 'otro'
        ? html`<${FormularioOtroDocente} evento=${evento} grupo=${grupo} grupos=${grupos} alCerrar=${alCerrar} />`
        : html`<${DeMisCursos} evento=${evento} grupo=${grupo} grupos=${grupos} alCerrar=${alCerrar} />`}
    <//>`;
}

/** Un estudiante de otro de mis cursos (de la misma metodología): su nota de aquí pasa sola a su propio curso. */
function DeMisCursos({ evento, grupo, grupos, alCerrar }) {
  const { cfg, db, avisar } = useApp();
  const metodologia = cfg.cursoPorId[evento.curso]?.metodologia;
  const todos = useVivo(() => db.estudiantes.toArray(), []);
  const [buscar, setBuscar] = useState('');
  const norm = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const yaAqui = new Set((todos ?? []).filter((e) => e.estado === 'visitante' && e.visita?.evento === evento.id).map((e) => e.codigo));
  const lista = (todos ?? [])
    .filter((e) => e.estado !== 'baja' && e.estado !== 'visitante' && e.curso !== evento.curso && cfg.cursoPorId[e.curso]?.metodologia === metodologia
      && !yaAqui.has(e.codigo) && norm(`${e.nombre} ${e.codigo} ${e.curso}`).includes(norm(buscar.trim())))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, 12);
  const agregar = async (e) => {
    try {
      await agregarVisitante(db, evento.id, grupos, grupo, { codigo: e.codigo, nombre: e.nombre, paralelo: e.curso });
      avisar(`${e.nombre.split(' ')[0]} agregado al grupo ${grupo}; su nota pasa a ${e.curso}.`, 'ok');
      alCerrar();
    } catch (err) { avisar(err.message, 'mal'); }
  };
  return html`
    <p class="tenue pequeno">Estudiante de otro de tus cursos de ${metodologia === 'SQI' ? 'SQI' : 'la metodología clásica'} (solo se recupera con la misma metodología).
      ${evento.con_nota ? `Se califica con su grupo y su nota aparece sola en ${evento.codigo} de su curso.` : 'Sesión sin nota: queda su asistencia y las décimas que gane con su grupo, que se suman en su curso.'}</p>
    <div class="campo"><label>Buscar por nombre, código o curso</label>
      <input class="entrada" value=${buscar} onInput=${(e) => setBuscar(e.currentTarget.value)} autocomplete="off" /></div>
    <div class="lista">
      ${todos === undefined ? html`<p class="tenue">Cargando…</p>` : lista.length === 0 ? html`<p class="tenue">Nadie coincide.</p>` : lista.map((e) => html`
        <div class="fila">
          <${Persona} estudiante=${e} detalle=${html`<span>· ${e.curso}</span>`} />
          <button class="boton chico" onClick=${() => agregar(e)}>Agregar</button>
        </div>`)}
    </div>
    <div class="botones"><button class="boton" onClick=${alCerrar}>Cancelar</button></div>`;
}

function FormularioOtroDocente({ evento, grupo, grupos, alCerrar }) {
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
    <p class="tenue pequeno">${evento.con_nota
      ? `Estudiante de otro docente que recupera ${evento.codigo} en esta sesión. Se califica con su grupo, no va al Excel y la app arma el texto con su nota para su profesor.`
      : 'Estudiante de otro docente que asiste a esta sesión sin nota. No va al Excel; la app arma el texto con su asistencia y las décimas que gane, para su profesor.'}</p>
      ${campo('codigo', 'Código único', { inputmode: 'numeric', autocomplete: 'off' })}
      ${campo('nombre', 'Apellidos y nombres', { autocapitalize: 'characters', autocomplete: 'off' })}
      ${campo('paralelo', 'Su paralelo (opcional)', { autocapitalize: 'characters', placeholder: 'Ej.: GR5XX' })}
      ${campo('profesor', 'Su profesor (opcional)')}
      <div class="botones">
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton primario" disabled=${!datos.codigo.trim() || !datos.nombre.trim()} onClick=${guardar}>Agregar</button>
      </div>`;
}

/** ¿El visitante es de otro de mis cursos? (su nota pasa sola a ese curso: ver `recuperacionesVinculadas`) */
const esMio = (ctx, v) => Boolean(v.visita?.paralelo && ctx.cfg.cursoPorId[v.visita.paralelo] && v.visita.paralelo !== v.curso);

/** Tarjeta del resumen: los visitantes del evento, su nota y el texto para su profesor. */
export function TarjetaVisitantes({ ctx, evento }) {
  const visitantes = visitantesDelEvento(ctx, evento);
  const [abierto, setAbierto] = useState(null);
  if (!visitantes.length) return null;
  return html`
    <div class="seccion-titulo">${evento.con_nota ? 'Recuperan aquí' : 'Asisten aquí'} (otros cursos) · ${visitantes.length}</div>
    <div class="lista">
      ${visitantes.map((v) => {
        const n = notaEvento(ctx, evento, v.id);
        return html`
          <button class="fila" onClick=${() => setAbierto(v)}>
            <${Persona} estudiante=${v} detalle=${html`${esMio(ctx, v) && html`<${Chip} tono="info">mi estudiante · ${v.visita.paralelo}<//>`}${evento.con_nota && html`<${Chip} tono=${n.estado === 'calculada' ? 'ok' : ''}>${n.estado === 'calculada' ? `${sobreDiez(n.valor)}/10` : 'nota pendiente'}<//>`}`} />
            <span class="flecha">›</span>
          </button>`;
      })}
    </div>
    <p class="tenue pequeno">Envía ${evento.con_nota ? 'la nota' : 'la asistencia y las décimas'} a su profesor en las 24 h siguientes: toca a cada uno para copiar o compartir el texto.
      ${visitantes.some((v) => esMio(ctx, v)) ? ` Los de tus cursos no necesitan texto: ${evento.con_nota ? 'su nota ya aparece' : 'sus décimas ya cuentan'} en su propio curso.` : ''}</p>
    ${abierto && html`<${HojaTextoProfesor} ctx=${ctx} evento=${evento} visitante=${abierto} alCerrar=${() => setAbierto(null)} />`}`;
}

function HojaTextoProfesor({ ctx, evento, visitante, alCerrar }) {
  const { db, avisar } = useApp();
  const firma = useProfesor();
  const { texto, final } = textoParaSuProfesor(ctx, evento, visitante, firma);
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
      ${firma === null && html`
        <p class="tenue pequeno">El texto va sin firma. Escribe tu nombre (se guarda solo en este dispositivo):</p>
        <${AjusteProfesor} />`}
      <div class="botones">
        <button class="boton" onClick=${copiar}>Copiar</button>
        ${typeof navigator !== 'undefined' && navigator.share && html`<button class="boton primario" onClick=${compartir}>Compartir</button>`}
      </div>
      ${quitando
        ? html`<div class="botones"><button class="boton" onClick=${() => setQuitando(false)}>No</button><button class="boton peligro-fuerte" onClick=${quitar}>Sí, quitarlo del evento</button></div>`
        : html`<button class="boton chico" style="align-self:flex-start" onClick=${() => setQuitando(true)}>Quitar del evento (lo agregué por error)</button>`}
    <//>`;
}
