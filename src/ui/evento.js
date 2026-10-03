// Evento: encabezado común y lista de grupos (navegación Curso → Evento → Grupo).
import { html, useApp, Pantalla, Chip, Aviso, Cargando, enlace } from './base.js';
import { useCurso, textoBimestre } from './curso-datos.js';
import { gruposDelEvento, listaDeGrupos } from '../nucleo/grupos.js';
import { estadoEvento } from '../nucleo/estado-evento.js';
import { fechaCorta } from '../nucleo/util.js';

export function nombreEvento(evento) {
  return ['INTRO', 'REFUERZO', 'REVISION'].includes(evento.codigo) ? evento.titulo : `${evento.codigo} · ${evento.titulo}`;
}

export function subtituloEvento(evento) {
  return `${evento.curso} · ${fechaCorta(evento.fecha)} · semana ${evento.semana}${evento.con_nota ? ` · ${textoBimestre(evento.bimestre)}` : ''}`;
}

/** Carga el curso y el evento; muestra «Cargando» o un error si hace falta. */
export function useEvento(id) {
  const paralelo = String(id).split(':')[0];
  const datos = useCurso(paralelo);
  const evento = datos.eventos?.find((e) => e.id === id) ?? null;
  return { ...datos, evento };
}

export function Evento({ id }) {
  const { curso, reg, eventos, evento, cargando } = useEvento(id);
  if (!curso || (!cargando && eventos && !evento)) {
    return html`<${Pantalla} titulo="Evento desconocido" atras="#/"><${Aviso} tono="mal">No existe el evento ${id}.<//><//>`;
  }
  if (cargando || !evento) return html`<${Pantalla} titulo=${id} atras=${enlace('curso', curso.paralelo)}><${Cargando} /><//>`;
  const est = estadoEvento(evento, reg);
  return html`
    <${Pantalla} titulo=${nombreEvento(evento)} subtitulo=${subtituloEvento(evento)} atras=${enlace('curso', curso.paralelo)}>
      <${AvisoDeEstado} evento=${evento} estado=${est} eventos=${eventos} />
      ${evento.sesion && html`<${ListaGrupos} evento=${evento} eventos=${eventos} reg=${reg} />`}
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
  return null;
}

export function ListaGrupos({ evento, eventos, reg }) {
  const { porEstudiante, fuente } = gruposDelEvento(evento, eventos, reg);
  const { grupos, sinGrupo } = listaDeGrupos(porEstudiante, reg.estudiantes);
  const origen = fuente.tipo === 'excel' ? 'grupos del Excel' : fuente.tipo === 'anterior' ? `grupos de ${fuente.evento.split(':')[1]}` : 'grupos de este evento';
  if (!grupos.length && !sinGrupo.length) {
    return html`<${Aviso} tono="aviso">Este curso no tiene estudiantes. Carga el Excel del semestre en <a class="negrita" href=${enlace('datos')}>Datos</a>.<//>`;
  }
  return html`
    <div class="seccion-titulo"><span>Grupos · ${grupos.length}</span><span class="pequeno">${origen}</span></div>
    <div class="lista">
      ${grupos.map((g) => html`
        <a class="fila" href=${enlace('evento', evento.id, 'grupo', g.grupo)}>
          <span class="grupo-num">${g.grupo}</span>
          <div class="principal">
            <div class="linea1">${g.integrantes.map((e) => e.nombre.split(' ')[0]).join(' · ')}</div>
            <div class="linea2">${g.integrantes.length} integrantes${g.integrantes.some((e) => e.estado === 'pendiente') ? ' · con pendiente' : ''}</div>
          </div>
          <span class="flecha">›</span>
        </a>`)}
    </div>
    ${sinGrupo.length > 0 && html`
      <div class="seccion-titulo">Sin grupo · ${sinGrupo.length}</div>
      <div class="lista">
        ${sinGrupo.map((e) => html`<div class="fila"><span class="grupo-num vacio">–</span><div class="principal"><div class="linea1">${e.nombre}</div><div class="linea2">${e.codigo}${e.estado === 'pendiente' ? ' · pendiente' : ''}</div></div></div>`)}
      </div>`}`;
}
