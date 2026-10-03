// Evento: encabezado, pestañas de la clase (Puerta · Control · Grupos · Resumen) y avisos de estado.
import { useMemo } from '../vendor/preact-htm.js';
import { html, useApp, Pantalla, Aviso, Cargando, enlace } from './base.js';
import { useCurso, textoBimestre } from './curso-datos.js';
import { Puerta } from './puerta.js';
import { Control } from './control.js';
import { Grupos } from './grupos.js';
import { Resumen } from './resumen.js';
import { estadoEvento } from '../nucleo/estado-evento.js';
import { fechaCorta } from '../nucleo/util.js';

export function nombreEvento(evento) {
  return ['INTRO', 'REFUERZO', 'REVISION'].includes(evento.codigo) ? evento.titulo : `${evento.codigo} · ${evento.titulo}`;
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
  if (!evento.sesion || evento.estado !== 'normal') return [];
  const conPuerta = cfg.preparatorio.aplica_a.includes(evento.tipo);
  const conControl = cfg.controlOral.sesiones.includes(evento.tipo);
  return [
    conPuerta && { id: 'puerta', texto: 'Puerta' },
    conControl && { id: 'control', texto: 'Control' },
    { id: 'grupos', texto: 'Grupos' },
    { id: 'resumen', texto: 'Resumen' },
  ].filter(Boolean);
}

/** Primera pestaña con algo por hacer: puerta → control → grupos; con el pase cerrado, resumen. */
function pestanaPorDefecto(ctx, evento, pestanas) {
  const ids = pestanas.map((p) => p.id);
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
    if (p.id === 'grupos') return ctx.pases.get(evento.id)?.cerrado ? 'ok' : null;
    return null;
  };
  const barra = pestanas.length > 1 && html`
    <nav class="pestanas">
      ${pestanas.map((p) => html`
        <a class=${p.id === activa ? 'activa' : ''} href=${enlace('evento', evento.id, p.id)}>${p.texto}${punto(p) ? html`<span class=${`punto ${punto(p)}`}></span>` : null}</a>`)}
    </nav>`;

  return html`
    <${Pantalla} titulo=${nombreEvento(evento)} subtitulo=${subtituloEvento(evento)} atras=${enlace('curso', curso.paralelo)} pestanas=${barra}>
      <${AvisoDeEstado} evento=${evento} estado=${est} eventos=${eventos} />
      ${activa === 'puerta' && html`<${Puerta} ctx=${ctx} evento=${evento} />`}
      ${activa === 'control' && html`<${Control} ctx=${ctx} evento=${evento} />`}
      ${activa === 'grupos' && html`<${Grupos} ctx=${ctx} evento=${evento} />`}
      ${activa === 'resumen' && html`<${Resumen} ctx=${ctx} evento=${evento} />`}
    <//>`;
}

export function AvisoDeEstado({ evento, estado, eventos }) {
  if (estado.clave === 'feriado') return html`<${Aviso} tono="aviso" titulo="Feriado: ${estado.detalle}">Esta actividad no se hace en este curso y no cuenta en la nota del bimestre.<//>`;
  if (estado.clave === 'sin_clase') return html`<${Aviso} tono="aviso" titulo="Sin clase: ${estado.detalle}">Esta sesión no cuenta.<//>`;
  if (evento.tipo === 'trabajo_casa') {
    const practica = eventos.find((e) => e.id === evento.practica);
    return html`<${Aviso} titulo=${evento.con_nota ? 'Trabajo en casa (se califica en la Fase 5)' : 'Trabajo en casa sin nota'}>
      Usa los grupos y la asistencia de ${practica ? html`<a class="negrita" href=${enlace('evento', practica.id)}>${practica.codigo}</a>` : 'su práctica'}.
    <//>`;
  }
  if (evento.tipo === 'plic') return html`<${Aviso} titulo="PLIC (Fase 6)">Examen presencial controlado por un profesor; vale 0.5 si se completa de forma válida.<//>`;
  if (evento.tipo === 'sin_nota') return html`<${Aviso}>Sesión sin nota: solo se registra la asistencia (pase por grupo).<//>`;
  return null;
}
