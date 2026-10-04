// Evento: encabezado, pestañas de la clase (Puerta · Control · [Retro] · Grupos · Resumen · Feedback) y avisos de estado.
import { useEffect, useMemo, useState } from '../vendor/preact-htm.js';
import { html, useApp, Pantalla, Aviso, Cargando, Hoja, enlace } from './base.js';
import { useCurso, textoBimestre } from './curso-datos.js';
import { Puerta } from './puerta.js';
import { Control } from './control.js';
import { Grupos } from './grupos.js';
import { Resumen } from './resumen.js';
import { Retro } from './retro.js';
import { Trabajos } from './trabajos.js';
import { Plic } from './plic.js';
import { Feedback } from './feedback.js';
import { RecuperacionesDelEvento } from './recuperacion.js';
import { marcarHuboClase, marcarSinClase, quitarCambioEvento } from '../datos/acciones.js';
import { retroDelTaller } from '../nucleo/retro.js';
import { tieneFeedback } from '../nucleo/feedback.js';
import { estadoEvento } from '../nucleo/estado-evento.js';
import { unidadTrabajo } from '../nucleo/motor.js';
import { avanceEvaluacion, seCalificaTrabajo } from '../nucleo/motor-vista.js';
import { fechaCorta } from '../nucleo/util.js';

/** ¿Todas las unidades por calificar del TC tienen nota? */
function trabajoCalificado(ctx, evento) {
  const a = avanceEvaluacion(ctx, evento);
  return Boolean(a && a.grupos > 0 && a.evaluados === a.grupos);
}

export function nombreEvento(evento) {
  const soloTitulo = ['INTRO', 'REFUERZO', 'REVISION'].includes(evento.codigo) || evento.titulo.startsWith(evento.codigo);
  return soloTitulo ? evento.titulo : `${evento.codigo} · ${evento.titulo}`;
}

export function subtituloEvento(evento) {
  return `${evento.curso} · ${fechaCorta(evento.fecha)} · semana ${evento.semana}${evento.con_nota ? ` · ${textoBimestre(evento.bimestre)}` : ''}`;
}

/** Carga el curso y el evento (con el contexto del motor de notas). */
export function useEvento(id) {
  const paralelo = String(id).split(':')[0];
  const datos = useCurso(paralelo);
  const evento = datos.eventos?.find((e) => e.id === id) ?? null;
  return { ...datos, evento };
}

/** Pestañas que aplican al evento. */
export function pestanasDe(cfg, evento) {
  if (seCalificaTrabajo(evento)) {
    const porGrupo = unidadTrabajo(cfg.actividades[evento.config]) === 'grupo';
    return [{ id: 'grupos', texto: porGrupo ? 'Grupos' : 'Estudiantes' }, { id: 'resumen', texto: 'Resumen' }, { id: 'feedback', texto: 'Feedback' }];
  }
  if (!evento.sesion || evento.estado !== 'normal') return [];
  const conPuerta = cfg.preparatorio.aplica_a.includes(evento.tipo);
  const conControl = cfg.controlOral.sesiones.includes(evento.tipo);
  const conRetro = Boolean(evento.config && cfg.actividades[evento.config]?.retro_practica_anterior);
  return [
    conPuerta && { id: 'puerta', texto: 'Puerta' },
    conControl && { id: 'control', texto: 'Control' },
    conRetro && { id: 'retro', texto: 'Retro' },
    { id: 'grupos', texto: 'Grupos' },
    { id: 'resumen', texto: 'Resumen' },
    tieneFeedback(evento) && { id: 'feedback', texto: 'Feedback' },
  ].filter(Boolean);
}

/** Primera pestaña con algo por hacer: puerta → control → grupos; con el pase cerrado, resumen. */
function pestanaPorDefecto(ctx, evento, pestanas) {
  const ids = pestanas.map((p) => p.id);
  if (seCalificaTrabajo(evento)) return trabajoCalificado(ctx, evento) ? 'resumen' : 'grupos';
  if (ctx.pases.get(evento.id)?.cerrado) return 'resumen';
  if (ids.includes('puerta') && !ctx.revisionPrep.get(evento.id)?.revisada) return 'puerta';
  if (ids.includes('control') && !ctx.reg.controles.some((c) => c.evento === evento.id)) return 'control';
  return 'grupos';
}

export function Evento({ id, pestana }) {
  const { cfg } = useApp();
  const { curso, ctx, eventos, evento, cargando } = useEvento(id);
  // La pestaña por defecto se elige una sola vez al abrir el evento (no salta mientras se registra).
  const listo = Boolean(ctx && evento);
  const porDefecto = useMemo(() => (listo ? pestanaPorDefecto(ctx, evento, pestanasDe(cfg, evento)) : null), [id, listo]);
  // En el iPhone las pestañas pueden no caber: la elegida se desliza a la vista.
  useEffect(() => { document.querySelector('.pestanas a.activa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [id, pestana, listo]);
  if (!curso || (!cargando && eventos && !evento)) {
    return html`<${Pantalla} titulo="Evento desconocido" atras="#/"><${Aviso} tono="mal">No existe el evento ${id}.<//><//>`;
  }
  if (cargando || !evento || !ctx) return html`<${Pantalla} titulo=${id} atras=${enlace('curso', curso.paralelo)}><${Cargando} /><//>`;

  const est = estadoEvento(evento, ctx.reg);
  const pestanas = pestanasDe(cfg, evento);
  const activa = pestanas.some((p) => p.id === pestana) ? pestana : (pestanas.length ? porDefecto : null);
  const punto = (p) => {
    if (p.id === 'puerta') return ctx.revisionPrep.get(evento.id)?.revisada ? 'ok' : null;
    if (p.id === 'control') return ctx.reg.controles.some((c) => c.evento === evento.id) ? 'ok' : null;
    if (p.id === 'grupos' && evento.tipo === 'trabajo_casa') return trabajoCalificado(ctx, evento) ? 'ok' : null;
    if (p.id === 'grupos') return ctx.pases.get(evento.id)?.cerrado ? 'ok' : null;
    if (p.id === 'retro') {
      const r = retroDelTaller(ctx, evento);
      return r.grupos.length && r.grupos.every((g) => g.dada) ? 'ok' : null;
    }
    return null;
  };
  const barra = pestanas.length > 1 && html`
    <nav class="pestanas">
      ${pestanas.map((p) => html`
        <a class=${p.id === activa ? 'activa' : ''} href=${enlace('evento', evento.id, p.id)}>${p.texto}${punto(p) ? html`<span class=${`punto ${punto(p)}`}></span>` : null}</a>`)}
    </nav>`;

  return html`
    <${Pantalla} titulo=${nombreEvento(evento)} subtitulo=${subtituloEvento(evento)} atras=${enlace('curso', curso.paralelo)} pestanas=${barra}
      acciones=${evento.sesion && html`<${MenuEvento} ctx=${ctx} evento=${evento} />`}>
      <${AvisoDeEstado} evento=${evento} estado=${est} eventos=${eventos} />
      ${evento.tipo === 'plic' && evento.estado === 'normal' && html`<${Plic} ctx=${ctx} evento=${evento} />`}
      ${evento.estado !== 'normal' && evento.con_nota && html`<${RecuperacionesDelEvento} ctx=${ctx} evento=${evento} />`}
      ${activa === 'puerta' && html`<${Puerta} ctx=${ctx} evento=${evento} />`}
      ${activa === 'control' && html`<${Control} ctx=${ctx} evento=${evento} />`}
      ${activa === 'retro' && html`<${Retro} ctx=${ctx} evento=${evento} />`}
      ${activa === 'grupos' && (evento.tipo === 'trabajo_casa' ? html`<${Trabajos} ctx=${ctx} evento=${evento} />` : html`<${Grupos} ctx=${ctx} evento=${evento} />`)}
      ${activa === 'resumen' && html`<${Resumen} ctx=${ctx} evento=${evento} />`}
      ${activa === 'feedback' && html`<${Feedback} ctx=${ctx} evento=${evento} />`}
    <//>`;
}

export function AvisoDeEstado({ evento, estado, eventos }) {
  const { cfg } = useApp();
  if (estado.clave === 'feriado') return html`<${Aviso} tono="aviso" titulo="Feriado: ${estado.detalle}">Esta actividad no se hace en este curso y no cuenta en la nota del bimestre.${evento.sesion ? ' Si el feriado se movió y sí hubo clase, usa el menú ⋯.' : ''}<//>`;
  if (estado.clave === 'sin_clase') return html`<${Aviso} tono="aviso" titulo="Sin clase: ${estado.detalle}">Esta sesión no cuenta en la nota${evento.cambio_manual && evento.sesion ? '. Se marcó a mano: se puede deshacer en el menú ⋯' : ''}.<//>`;
  if (evento.tipo === 'trabajo_casa') {
    const practica = eventos.find((e) => e.id === evento.practica);
    const enlacePractica = practica ? html`<a class="negrita" href=${enlace('evento', practica.id)}>${practica.codigo}</a>` : 'su práctica';
    if (!evento.con_nota) {
      return html`<${Aviso} titulo="Trabajo en casa sin nota">${cfg.actividades[evento.config]?.nota ?? 'No tiene nota propia.'}<//>`;
    }
    if (!evento.config) return html`<${Aviso} tono="aviso" titulo="Falta la configuración de este TC">Cuando esté cargada, se califica aquí con los grupos de ${enlacePractica}.<//>`;
    return html`<p class="tenue pequeno">Trabajo en casa de ${enlacePractica}: usa sus grupos y su asistencia (quien faltó tiene 0).</p>`;
  }
  if (evento.tipo === 'sin_nota') return html`<${Aviso}>Sesión sin nota: solo se registra la asistencia (pase por grupo).<//>`;
  return null;
}

/** Menú del evento (⋯): marcar la sesión sin clase, indicar que en un feriado sí hubo clase o deshacer el cambio. */
function MenuEvento({ ctx, evento }) {
  const { db, avisar } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('Clase suspendida');
  const cambio = ctx.reg.cambios_evento.find((c) => c.evento === evento.id) ?? null;
  const tc = ctx.eventos.find((e) => e.tipo === 'trabajo_casa' && e.practica === evento.id && e.con_nota);
  const hecho = (texto, tono) => { setAbierto(false); avisar(texto, tono); };
  return html`
    <button class="icono-boton" aria-label="Opciones del evento" onClick=${() => setAbierto(true)}>⋯</button>
    ${abierto && html`
      <${Hoja} titulo="Opciones de la sesión" alCerrar=${() => setAbierto(false)}>
        ${cambio
          ? html`
            <p>${cambio.estado === 'sin_clase' ? `Se marcó a mano sin clase (${cambio.motivo}).` : 'Se marcó a mano que sí hubo clase pese al calendario.'}</p>
            <button class="boton ancho" onClick=${async () => { await quitarCambioEvento(db, evento.id); hecho('La sesión vuelve a lo que dice el calendario.'); }}>Deshacer el cambio</button>`
          : evento.estado === 'feriado'
            ? html`
              <p>Según el calendario es feriado (${evento.motivo}). Si el feriado se movió y sí hubo clase, la actividad vuelve a contar.</p>
              <button class="boton primario ancho" onClick=${async () => { await marcarHuboClase(db, evento.id); hecho('La sesión vuelve a contar.', 'ok'); }}>Sí hubo clase</button>`
            : html`
              <p>Si esta sesión no tuvo clase (por ejemplo, una suspensión), sus actividades (${evento.codigo}${tc ? ` y ${tc.codigo}` : ''}) quedan fuera de la nota en ${evento.curso}, como en un feriado: las demás de cada componente se renormalizan.</p>
              <p class="tenue pequeno">Lo registrado no se borra y se puede deshacer.</p>
              <div class="campo"><label>Motivo</label><input class="entrada" value=${motivo} onInput=${(e) => setMotivo(e.currentTarget.value)} /></div>
              <button class="boton peligro-fuerte ancho" disabled=${!motivo.trim()}
                onClick=${async () => { await marcarSinClase(db, evento.id, motivo); hecho(`${evento.codigo}: sin clase.`); }}>Marcar sin clase</button>`}
        <button class="boton ancho" onClick=${() => setAbierto(false)}>Cerrar</button>
      <//>`}`;
}
