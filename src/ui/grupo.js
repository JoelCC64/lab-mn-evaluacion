// Grupo de un evento: integrantes (en la Fase 2: evaluación y pase final).
import { html, Pantalla, Aviso, Cargando, enlace, Persona } from './base.js';
import { useEvento, nombreEvento } from './evento.js';
import { gruposDelEvento, listaDeGrupos } from '../nucleo/grupos.js';

export function Grupo({ id, grupo }) {
  const { curso, reg, eventos, evento, cargando } = useEvento(id);
  if (!curso) return html`<${Pantalla} titulo="Grupo" atras="#/"><${Aviso} tono="mal">No existe el evento ${id}.<//><//>`;
  if (cargando || !evento) return html`<${Pantalla} titulo=${`Grupo ${grupo}`} atras=${enlace('evento', id)}><${Cargando} /><//>`;
  const { porEstudiante } = gruposDelEvento(evento, eventos, reg);
  const { grupos } = listaDeGrupos(porEstudiante, reg.estudiantes);
  const g = grupos.find((x) => x.grupo === grupo);
  return html`
    <${Pantalla} titulo=${`Grupo ${grupo}`} subtitulo=${`${nombreEvento(evento)} · ${evento.curso}`} atras=${enlace('evento', id)}>
      ${!g ? html`<${Aviso} tono="aviso">El grupo ${grupo} no tiene integrantes en este evento.<//>` : html`
        <div class="seccion-titulo">Integrantes · ${g.integrantes.length}</div>
        <div class="lista">${g.integrantes.map((e) => html`<div class="fila"><${Persona} estudiante=${e} /></div>`)}</div>`}
    <//>`;
}
