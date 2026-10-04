// Pestaña «Feedback» (Fase 7): el texto de cada grupo (editable antes de copiarlo), la versión corta y el resumen
// del curso, armados con lo que la app registró. Los textos nombran al grupo solo por su número; los apellidos que
// se ven en la pantalla sirven para ubicar al grupo y no van en lo que se copia.
import { useEffect, useLayoutEffect, useRef, useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Aviso } from './base.js';
import { guardarFeedback, marcarFeedbackCopiado, restaurarFeedback } from '../datos/acciones.js';
import { feedbackDelEvento, textosJuntos } from '../nucleo/feedback.js';

const VISTAS = [{ id: 'grupos', texto: 'Por grupo' }, { id: 'corto', texto: 'Corto' }, { id: 'curso', texto: 'Curso' }];

/** Copia al portapapeles y avisa. Devuelve true si se copió. */
export async function copiarTexto(texto, avisar, mensaje = 'Texto copiado.') {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(mensaje, 'ok');
    return true;
  } catch {
    avisar('No se pudo copiar: selecciona el texto y cópialo.', 'mal');
    return false;
  }
}

const puedeCompartir = () => typeof navigator !== 'undefined' && Boolean(navigator.share);

export function Feedback({ ctx, evento }) {
  const { db, avisar } = useApp();
  const [vista, setVista] = useState('grupos');
  const fb = feedbackDelEvento(ctx, evento);
  if (!fb) return html`<${Aviso}>Este evento no lleva feedback.<//>`;
  const evaluadas = fb.unidades.filter((u) => !u.vacio);
  const porGrupo = fb.unidad === 'grupo';
  const copiarTodos = async () => {
    if (await copiarTexto(textosJuntos(fb), avisar, `${evaluadas.length} textos copiados.`)) {
      await marcarFeedbackCopiado(db, evento.id, evaluadas.map((u) => ({ unidad: u.unidad, id: u.id })));
    }
  };
  return html`
    <div class="segmentado" role="group" aria-label="Vista del feedback">
      ${VISTAS.map((v) => html`<button class=${vista === v.id ? 'elegido ok' : ''} onClick=${() => setVista(v.id)}>${v.texto}</button>`)}
    </div>
    ${!evaluadas.length && html`
      <${Aviso} tono="aviso">Todavía no hay nada registrado en ${evento.codigo}. El feedback se arma con la rúbrica, las etiquetas y la nota del profesor de cada ${porGrupo ? 'grupo' : 'estudiante'}.<//>`}
    ${vista === 'grupos' && evaluadas.length > 0 && html`
      <p class="tenue pequeno">Un texto por ${porGrupo ? 'grupo' : 'estudiante'}, armado con lo registrado. Puedes editarlo antes de copiarlo: lo editado se guarda.
        ${porGrupo ? ' El texto solo nombra el número del grupo.' : ''}</p>
      <button class="boton primario ancho" onClick=${copiarTodos}>Copiar todos (${evaluadas.length})</button>
      ${fb.unidades.map((u) => html`<${TarjetaFeedback} key=${`${u.unidad}|${u.id}`} u=${u} evento=${evento} />`)}`}
    ${vista === 'corto' && evaluadas.length > 0 && html`
      <p class="tenue pequeno">2 o 3 líneas por ${porGrupo ? 'grupo' : 'estudiante'}, para decirlas en voz alta (por ejemplo, al inicio del taller).</p>
      <button class="boton primario ancho" onClick=${() => copiarTexto(textosJuntos(fb, 'corto'), avisar, 'Versión corta copiada.')}>Copiar todo</button>
      ${evaluadas.map((u) => html`
        <div class="tarjeta" key=${`${u.unidad}|${u.id}`}>
          <${Integrantes} u=${u} />
          <p class="texto-corto">${u.corto}</p>
        </div>`)}`}
    ${vista === 'curso' && evaluadas.length > 0 && html`<${ResumenCurso} r=${fb.resumen} />`}`;
}

/** Apellidos de los integrantes (o el nombre, en un TC individual): solo para ubicar al grupo en la pantalla. */
function Integrantes({ u }) {
  if (!u.integrantes?.length) return null;
  const texto = u.unidad === 'grupo' ? u.integrantes.map((e) => String(e.nombre).split(' ')[0]).join(' · ') : u.integrantes[0].nombre;
  return html`<div class="tenue pequeno">${texto}</div>`;
}

function TarjetaFeedback({ u, evento }) {
  const { db, avisar } = useApp();
  const [texto, setTexto] = useState(u.texto);
  const enfocado = useRef(false);
  const espera = useRef(null);
  const ultimo = useRef(u.texto);
  const caja = useRef(null);
  // El cuadro crece con el texto: en el iPhone se desplaza la página, no el cuadro.
  useLayoutEffect(() => {
    const c = caja.current;
    if (c) { c.style.height = 'auto'; c.style.height = `${c.scrollHeight + 2}px`; }
  }, [texto]);
  // Si lo registrado cambia (o se vuelve al texto generado) mientras no se está escribiendo, se muestra lo nuevo.
  useEffect(() => {
    if (!enfocado.current) { setTexto(u.texto); ultimo.current = u.texto; }
  }, [u.texto]);
  useEffect(() => () => clearTimeout(espera.current), []);

  const guardar = async (t) => {
    if (t === ultimo.current) return;
    ultimo.current = t;
    await guardarFeedback(db, evento.id, u.unidad, u.id, t, u.generado);
  };
  const marcarCopiado = () => marcarFeedbackCopiado(db, evento.id, [{ unidad: u.unidad, id: u.id }]);
  const copiar = async () => {
    clearTimeout(espera.current);
    await guardar(texto);
    if (await copiarTexto(texto, avisar)) await marcarCopiado();
  };
  const compartir = async () => {
    clearTimeout(espera.current);
    await guardar(texto);
    try {
      await navigator.share({ text: texto });
      await marcarCopiado();
    } catch (e) {
      if (e?.name !== 'AbortError') copiar();
    }
  };
  const restaurar = async () => {
    clearTimeout(espera.current);
    enfocado.current = false;
    await restaurarFeedback(db, evento.id, u.unidad, u.id);
  };

  if (u.vacio) {
    return html`
      <div class="tarjeta atenuado">
        <div class="separado"><h3>${u.cabeza}</h3><${Chip}>sin evaluar<//></div>
        <${Integrantes} u=${u} />
      </div>`;
  }
  return html`
    <div class="tarjeta">
      <div class="separado">
        <h3>${u.cabeza}</h3>
        <div class="fila-flex">
          ${u.editado && html`<${Chip} tono="info">editado<//>`}
          ${u.copiado && html`<${Chip} tono="ok">copiado ✓<//>`}
          <${Chip}>${u.notaCorta}<//>
        </div>
      </div>
      <${Integrantes} u=${u} />
      ${u.desactualizado && html`
        <${Aviso} tono="aviso">
          Lo registrado cambió después de editar este texto.
          <button class="boton chico" style="margin-top:6px" onClick=${restaurar}>Usar el texto nuevo</button>
        <//>`}
      <textarea ref=${caja} class="entrada texto-feedback" aria-label=${`Feedback de ${u.cabeza}`} rows="6" value=${texto}
        onFocus=${() => { enfocado.current = true; }}
        onInput=${(e) => { const t = e.currentTarget.value; setTexto(t); clearTimeout(espera.current); espera.current = setTimeout(() => guardar(t), 700); }}
        onBlur=${() => { enfocado.current = false; clearTimeout(espera.current); guardar(texto); }} />
      <div class="botones">
        <button class="boton" onClick=${copiar}>Copiar</button>
        ${puedeCompartir() && html`<button class="boton primario" onClick=${compartir}>Compartir</button>`}
      </div>
      ${u.editado && !u.desactualizado && html`<button class="boton chico" style="align-self:flex-start" onClick=${restaurar}>Volver al texto generado</button>`}
    </div>`;
}

function ResumenCurso({ r }) {
  const { avisar } = useApp();
  const numeros = [
    [`${r.completas}/${r.total}`, r.nombre === 'grupos' ? 'grupos con nota' : 'con nota'],
    r.noEntregaron ? [r.noEntregaron, 'no entregaron'] : null,
    [r.reforzar.length, 'por reforzar'],
  ].filter(Boolean);
  return html`
    <div class="resumen-numeros">${numeros.map(([n, t]) => html`<div><b>${n}</b><span>${t}</span></div>`)}</div>
    <div class="tarjeta">
      <div class="separado">
        <h2>Resumen del curso</h2>
        <button class="boton chico" onClick=${() => copiarTexto(r.texto, avisar, 'Resumen copiado.')}>Copiar</button>
      </div>
      <p class="tenue pequeno">Sin nombres: sirve para comentarlo con el curso o en una reunión.</p>
      <div class="texto-resumen">${r.texto.split('\n').slice(1).join('\n').trim()}</div>
    </div>`;
}
