// Trabajos en casa de SQI (Fase 5): la lista de los grupos de la práctica (o de sus estudiantes, si el TC es
// individual) y la calificación pregunta por pregunta, con la suma a la vista y avance automático al siguiente.
import { useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { html, useApp, Pantalla, Chip, Hoja, Aviso, Cargando, enlace, ir } from './base.js';
import { useEvento } from './evento.js';
import { NotaTexto } from './grupo.js';
import { alternarEtiquetaTrabajo, borrarTrabajo, marcarEntrega, puntuarTrabajo } from '../datos/acciones.js';
import { leerLocal } from '../datos/local.js';
import { eventoBase } from '../nucleo/grupos.js';
import { unidadTrabajo } from '../nucleo/motor.js';
import { seCalificaTrabajo, siguientePorCalificar, textoPuntos, unidadesDelTrabajo } from '../nucleo/motor-vista.js';

/** Espera antes de pasar solo a la siguiente unidad (deja ver la suma y permite quedarse). */
const ESPERA_AVANCE = 1500;

const primerApellido = (nombre) => String(nombre).split(' ')[0];

/** Texto corto de la unidad: «grupo 3» o el nombre del estudiante. */
function nombreUnidad(u) {
  if (!u) return '';
  return u.unidad === 'grupo' ? `grupo ${u.id}` : u.integrantes[0].estudiante.nombre;
}

function rutaUnidad(evento, u) {
  return enlace('evento', evento.id, u.unidad === 'grupo' ? 'grupo' : 'estudiante', u.id);
}

/** ¿La app corre en un iPhone o iPad? (el iPad se presenta como «Macintosh», pero con pantalla táctil) */
const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * ¿Este dispositivo trabaja con una copia importada del iPhone (la Mac)? Lo que se registre aquí se pierde con el
 * próximo respaldo que se importe. En el iPhone no se avisa: allí una restauración es una recuperación.
 */
function useCopiaImportada() {
  const { db } = useApp();
  const [copia, setCopia] = useState(null);
  useEffect(() => {
    if (esIOS()) return;
    leerLocal(db, 'respaldo_importado').then(setCopia).catch(() => setCopia(null));
  }, [db]);
  return copia;
}

function ChipNota({ u, practica }) {
  const n = u.nota;
  if (!u.porCalificar) return html`<${Chip} tono="mal">${u.unidad === 'grupo' ? 'todos faltaron' : 'faltó'} a ${practica.codigo} · 0<//>`;
  if (!n.registrado) return html`<${Chip}>sin calificar<//>`;
  if (n.entregado === false) return html`<${Chip} tono="mal">no entregó · 0<//>`;
  if (!n.completo) return html`<${Chip} tono="info">${textoPuntos(n.puntos)} · faltan ${n.faltan.length}<//>`;
  return html`<${Chip} tono="ok">${textoPuntos(n.puntos)}/${n.total}<//>`;
}

// ---------- Pestaña «Grupos» del TC ----------

export function Trabajos({ ctx, evento }) {
  const config = ctx.cfg.actividades[evento.config];
  const porGrupo = unidadTrabajo(config) === 'grupo';
  const unidades = unidadesDelTrabajo(ctx, evento);
  const practica = eventoBase(evento, ctx.eventos);
  const paseCerrado = Boolean(ctx.pases.get(practica.id)?.cerrado);
  const porCalificar = unidades.filter((u) => u.porCalificar);
  const listos = porCalificar.filter((u) => u.nota.completo).length;
  const siguiente = unidades.find((u) => u.id === siguientePorCalificar(unidades, null));
  const copia = useCopiaImportada();

  if (!unidades.length) {
    return html`<${Aviso} tono="aviso">Este curso no tiene estudiantes. Carga el Excel del semestre en <a class="negrita" href=${enlace('datos')}>Datos</a>.<//>`;
  }
  return html`
    ${copia && html`
      <${Aviso} tono="aviso" titulo="Este dispositivo tiene una copia del iPhone">
        Lo que califiques aquí no pasa al iPhone y se reemplaza con el próximo respaldo que importes. Califica los TC en el iPhone.
      <//>`}
    ${!paseCerrado && html`
      <${Aviso} tono="aviso">
        El pase de <a class="negrita" href=${enlace('evento', practica.id)}>${practica.codigo}</a> no está cerrado: puedes calificar,
        pero las notas del ${evento.codigo} quedan pendientes hasta cerrarlo.
      <//>`}
    <div class="tarjeta">
      <div class="separado">
        <h2>${listos}/${porCalificar.length} ${porGrupo ? 'grupos' : 'estudiantes'} calificados</h2>
        ${porCalificar.length > 0 && listos === porCalificar.length && html`<${Chip} tono="ok">✓ listo<//>`}
      </div>
      <p class="tenue pequeno">
        Sobre ${config.escala_total}, pregunta por pregunta (${config.preguntas.length} preguntas)${porGrupo ? ', por grupo' : ''}.
        Sin penalización por entrega tardía. Quien faltó a ${practica.codigo} tiene 0.
      </p>
      ${siguiente && html`
        <a class="boton primario grande" href=${rutaUnidad(evento, siguiente)}>${listos ? 'Seguir' : 'Empezar'} · ${nombreUnidad(siguiente)} ›</a>`}
    </div>
    <div class="lista">
      ${unidades.map((u) => html`<${FilaUnidad} key=${u.id} u=${u} evento=${evento} practica=${practica} />`)}
    </div>`;
}

function FilaUnidad({ u, evento, practica }) {
  const faltaron = u.integrantes.filter((i) => i.asistencia.falta).length;
  const linea1 = u.unidad === 'grupo' ? u.integrantes.map((i) => primerApellido(i.estudiante.nombre)).join(' · ') : u.integrantes[0].estudiante.nombre;
  return html`
    <a class=${`fila ${u.porCalificar ? '' : 'atenuada'}`} href=${rutaUnidad(evento, u)}>
      <span class=${`grupo-num ${u.grupo === null ? 'vacio' : ''}`}>${u.grupo ?? '–'}</span>
      <div class="principal">
        <div class="linea1">${linea1}</div>
        <div class="linea2 fila-flex">
          <${ChipNota} u=${u} practica=${practica} />
          ${u.porCalificar && u.unidad === 'grupo' && faltaron > 0 && html`<${Chip} tono="mal">${faltaron} faltó a ${practica.codigo}<//>`}
        </div>
      </div>
      <span class="flecha">›</span>
    </a>`;
}

// ---------- Calificación de un grupo (o estudiante) ----------

/** Pantalla de un TC para una unidad: `#/evento/GR1AA:TC1/grupo/3` (o `/estudiante/<código>`). */
export function TrabajoCasa({ id, unidadId }) {
  const { curso, ctx, evento, cargando } = useEvento(id);
  if (!curso) return html`<${Pantalla} titulo="Trabajo en casa" atras="#/"><${Aviso} tono="mal">No existe el evento ${id}.<//><//>`;
  if (cargando || !evento || !ctx) return html`<${Pantalla} titulo=${id} atras=${enlace('evento', id, 'grupos')}><${Cargando} /><//>`;
  if (!seCalificaTrabajo(evento)) {
    return html`<${Pantalla} titulo=${evento.codigo} atras=${enlace('evento', id)}><${Aviso} tono="aviso">Este trabajo en casa no se califica en este curso.<//><//>`;
  }
  return html`<${Calificacion} key=${`${id}|${unidadId}`} ctx=${ctx} evento=${evento} unidadId=${unidadId} />`;
}

function Calificacion({ ctx, evento, unidadId }) {
  const { db, avisar } = useApp();
  const config = ctx.cfg.actividades[evento.config];
  const unidades = unidadesDelTrabajo(ctx, evento);
  const u = unidades.find((x) => x.id === unidadId) ?? null;
  const unidad = unidadTrabajo(config);
  const practica = eventoBase(evento, ctx.eventos);
  const siguiente = unidades.find((x) => x.id === siguientePorCalificar(unidades, unidadId)) ?? null;
  const completo = Boolean(u?.nota.completo);
  const listos = unidades.filter((x) => x.porCalificar && x.nota.completo).length;
  const total = unidades.filter((x) => x.porCalificar).length;

  // Avance automático: cuando un toque completa la calificación, pasa solo a la siguiente unidad por calificar.
  const [avanzando, setAvanzando] = useState(false);
  const temporizador = useRef(null);
  const tocado = useRef(false);
  const previo = useRef(completo);
  const siguienteActual = useRef(siguiente);
  siguienteActual.current = siguiente;
  const cancelar = () => { clearTimeout(temporizador.current); setAvanzando(false); };
  const irA = (destino) => {
    cancelar();
    if (destino) ir('evento', evento.id, destino.unidad === 'grupo' ? 'grupo' : 'estudiante', destino.id);
    else ir('evento', evento.id, 'resumen');
  };
  useEffect(() => {
    if (completo && !previo.current && tocado.current) {
      setAvanzando(true);
      temporizador.current = setTimeout(() => {
        const destino = siguienteActual.current;
        irA(destino);
        if (!destino) avisar(`${evento.codigo} calificado: ${total} ${unidad === 'grupo' ? 'grupos' : 'estudiantes'}.`, 'ok');
      }, ESPERA_AVANCE);
    }
    if (!completo) cancelar();
    previo.current = completo;
  }, [completo]);
  useEffect(() => () => clearTimeout(temporizador.current), []);
  /** Cada toque cancela un avance en curso (Joel sigue trabajando en esta unidad). */
  const tocar = (accion) => { tocado.current = true; cancelar(); return accion(); };

  const titulo = unidad === 'grupo' ? `Grupo ${unidadId}` : (u?.integrantes[0].estudiante.nombre ?? unidadId);
  const subtitulo = `${evento.codigo} · ${evento.curso} · ${listos}/${total} calificados`;
  const atras = enlace('evento', evento.id, 'grupos');
  if (!u) {
    return html`<${Pantalla} titulo=${titulo} subtitulo=${subtitulo} atras=${atras}>
      <${Aviso} tono="aviso">${unidad === 'grupo' ? `El grupo ${unidadId} no está en ${practica.codigo}.` : `Ese estudiante no está en ${practica.codigo}.`}<//>
    <//>`;
  }
  const n = u.nota;
  const suma = u.porCalificar && html`
    <div class=${`suma-tc ${n.entregado === false ? 'no-entrego' : completo ? 'completa' : ''}`} aria-live="polite">
      <b>${textoPuntos(n.entregado === false ? 0 : n.puntos)}<span>/${config.escala_total}</span></b>
      <small>${n.entregado === false ? 'no entregó' : completo ? '✓ completa' : `faltan ${n.faltan.length}`}</small>
    </div>`;

  return html`
    <${Pantalla} titulo=${titulo} subtitulo=${subtitulo} atras=${atras} acciones=${suma}>
      ${!ctx.pases.get(practica.id)?.cerrado && html`<${Aviso} tono="aviso">El pase de ${practica.codigo} no está cerrado: esta nota queda pendiente hasta cerrarlo.<//>`}
      <${Integrantes} u=${u} evento=${evento} practica=${practica} />
      ${u.porCalificar
        ? html`
          <${Entrega} n=${n} alElegir=${(v) => tocar(() => marcarEntrega(db, evento.id, unidad, unidadId, v))} />
          <${Preguntas} n=${n} config=${config}
            alPuntuar=${(p, v) => tocar(() => { if (p.valor !== v || n.entregado === false) puntuarTrabajo(db, evento.id, unidad, unidadId, p.id, v); })}
            alEtiquetar=${(t) => tocar(() => alternarEtiquetaTrabajo(db, evento.id, unidad, unidadId, t))} />
          <div onfocusin=${cancelar}>
            <${NotaTexto} key=${`nota-${evento.id}-${unidadId}`} evento=${evento} unidad=${unidad} unidadId=${unidadId}
              actual=${ctx.reg.notas.find((x) => x.evento === evento.id && x.unidad === unidad && x.unidad_id === String(unidadId))?.texto ?? ''} />
          </div>
          ${n.registrado && html`<${Borrar} alBorrar=${() => tocar(async () => { await borrarTrabajo(db, evento.id, unidad, unidadId); avisar('Calificación borrada.'); })} />`}`
        : html`<${Aviso} tono="mal">${unidad === 'grupo' ? `Todos faltaron a ${practica.codigo}` : `Faltó a ${practica.codigo}`}: tiene 0 en el ${evento.codigo} y no hace falta calificarlo.<//>`}
      <div class="pie-fijo">
        ${avanzando
          ? html`
            <div class="avance-auto" role="status">
              <span class="crece">${[
                `✓ ${n.entregado === false ? 'No entregó' : `${textoPuntos(n.puntos)}/${config.escala_total}`}`,
                siguiente ? `pasando al ${nombreUnidad(siguiente)}…` : 'todo calificado, vamos al resumen…',
              ].join(' · ')}</span>
              <button class="boton chico" onClick=${cancelar}>Quedarme</button>
              <span class="barra-avance" style=${`animation-duration:${ESPERA_AVANCE}ms`}></span>
            </div>`
          : html`
            <button class="boton primario grande" onClick=${() => irA(siguiente)}>
              ${siguiente ? `Siguiente · ${nombreUnidad(siguiente)} ›` : 'Terminar · ver el resumen'}
            </button>`}
      </div>
    <//>`;
}

function Integrantes({ u, evento, practica }) {
  const chip = (a) => {
    if (a.falta) return html`<${Chip} tono="mal">${a.estado === 'salio' ? 'salió' : 'no vino'} a ${practica.codigo} · 0<//>`;
    if (a.estado === 'se_retiro_antes') return html`<${Chip} tono="aviso">se retiró antes<//>`;
    if (!a.estado) return html`<${Chip}>sin pase<//>`;
    return null;
  };
  return html`
    <div class="tarjeta">
      <div class="separado">
        <h3>${u.unidad === 'grupo' ? `Integrantes en ${practica.codigo}` : `En ${practica.codigo}`}</h3>
        ${u.grupo !== null && html`<a class="pequeno negrita enlace" href=${enlace('evento', practica.id, 'grupo', u.grupo)}>Asistencia ›</a>`}
      </div>
      <ul class="integrantes-tc">
        ${u.integrantes.map(({ estudiante, asistencia }) => html`
          <li class=${asistencia.falta ? 'falta' : ''}><span class="crece">${estudiante.nombre}</span>${chip(asistencia)}</li>`)}
      </ul>
    </div>`;
}

function Entrega({ n, alElegir }) {
  const entrego = n.entregado !== false;
  return html`
    <div class="segmentado" role="group" aria-label="Entrega">
      <button class=${`${entrego && n.registrado ? 'elegido ok' : ''} ${!n.registrado ? 'por-defecto' : ''}`} onClick=${() => (n.registrado && entrego ? null : alElegir(true))}>Entregó</button>
      <button class=${n.entregado === false ? 'elegido mal' : ''} onClick=${() => (n.entregado === false ? null : alElegir(false))}>No entregó (0)</button>
    </div>`;
}

function Preguntas({ n, config, alPuntuar, alEtiquetar }) {
  const marcadas = new Set(n.etiquetas);
  return html`
    <div class=${`tarjeta tc-preguntas ${n.entregado === false ? 'atenuado' : ''}`}>
      ${n.partes.map((p) => {
        const etiquetas = (config.etiquetas ?? []).filter((t) => t.pregunta === p.id);
        return html`
          <div class=${`tc-pregunta ${p.valor === null ? 'pendiente' : ''}`} key=${p.id}>
            <div class="tc-enunciado"><b>${p.id}</b><span>${p.texto}</span></div>
            <div class="niveles chicos">
              ${p.puntajes.map((v) => html`<button class=${p.valor === v ? 'elegido' : ''} onClick=${() => alPuntuar(p, v)}>${v}</button>`)}
            </div>
            ${etiquetas.length > 0 && html`
              <div class="etiquetas">
                ${etiquetas.map((t) => html`
                  <button class=${`etiqueta ${t.signo === '+' ? 'pos' : 'neg'} ${marcadas.has(t.id) ? 'elegida' : ''}`} onClick=${() => alEtiquetar(t.id)}>
                    <span class="signo">${t.signo === '+' ? '+' : '−'}</span>${t.texto}
                  </button>`)}
              </div>`}
          </div>`;
      })}
    </div>`;
}

function Borrar({ alBorrar }) {
  const [preguntando, setPreguntando] = useState(false);
  return html`
    <button class="boton chico" style="align-self:flex-start" onClick=${() => setPreguntando(true)}>Borrar esta calificación</button>
    ${preguntando && html`
      <${Hoja} titulo="¿Borrar esta calificación?" alCerrar=${() => setPreguntando(false)}>
        <p>Se quitan la entrega, los puntajes y las etiquetas de este trabajo. La nota del profesor se conserva.</p>
        <div class="botones">
          <button class="boton" onClick=${() => setPreguntando(false)}>Cancelar</button>
          <button class="boton peligro-fuerte" onClick=${async () => { setPreguntando(false); await alBorrar(); }}>Borrar</button>
        </div>
      <//>`}`;
}
