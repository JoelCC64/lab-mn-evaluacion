// Pestaña «Retro» del taller: retroalimentación corta de la práctica anterior, grupo por grupo, con la versión corta
// del feedback (Fase 7: 2 o 3 líneas armadas con lo registrado) y la nota del profesor. Una casilla marca la retro
// como dada. El feedback completo de la práctica está en su pestaña «Feedback».
import { html, useApp, Chip, Aviso, enlace } from './base.js';
import { marcarRetro } from '../datos/acciones.js';
import { retroDelTaller } from '../nucleo/retro.js';
import { textoNotaGrupo } from '../nucleo/motor-vista.js';

const primerNombre = (nombre) => {
  const p = String(nombre).split(' ').filter(Boolean);
  return p[2] ?? p[0];   // «APELLIDO APELLIDO NOMBRE …»: el primer nombre
};

export function Retro({ ctx, evento }) {
  const r = retroDelTaller(ctx, evento);
  if (!r.practica) {
    return html`<${Aviso}>Este taller no tiene una práctica antes en el cronograma del curso: no lleva retroalimentación.<//>`;
  }
  const dadas = r.grupos.filter((g) => g.dada).length;
  const sinNada = r.grupos.every((g) => g.vacio);
  return html`
    <p class="tenue pequeno">
      Retroalimentación de <a class="negrita" href=${enlace('evento', r.practica.id)}>${r.practica.codigo} · ${r.practica.titulo}</a>,
      grupo por grupo, mientras los demás trabajan. ${dadas}/${r.grupos.length} dadas.
    </p>
    ${sinNada
      ? html`<${Aviso} tono="aviso">En ${r.practica.codigo} no hay nada registrado todavía (rúbrica, etiquetas ni notas).<//>`
      : html`<a class="boton chico ancho" href=${enlace('evento', r.practica.id, 'feedback')}>Feedback completo de ${r.practica.codigo} ›</a>`}
    ${r.grupos.map((g) => html`<${TarjetaRetro} key=${g.grupo} g=${g} taller=${evento} />`)}`;
}

function TarjetaRetro({ g, taller }) {
  const { db } = useApp();
  // La primera línea de la versión corta («Grupo 3 · 7.5/10») ya está en el encabezado de la tarjeta.
  const lineas = g.corto ? g.corto.split('\n').slice(1) : [];
  return html`
    <div class=${`tarjeta retro ${g.dada ? 'dada' : ''}`}>
      <div class="separado">
        <h3>Grupo ${g.grupo}</h3>
        ${g.revision?.penalizacion_total ? html`<${Chip} tono="mal">penalización total<//>`
          : g.nota.completo ? html`<${Chip} tono="info">${textoNotaGrupo(g.nota)}<//>` : html`<${Chip}>sin evaluar<//>`}
      </div>
      <div class="fila-flex pequeno">
        ${g.integrantes.map(({ estudiante, asistencia }) => html`
          <span class=${asistencia.falta ? 'tachado' : ''}>${primerNombre(estudiante.nombre)}${asistencia.falta ? html` <${Chip} tono="mal">faltó<//>` : ''}</span>`)}
      </div>
      ${lineas.length > 0 && html`<p class="texto-corto">${lineas.join('\n')}</p>`}
      ${g.notaProfesor && !lineas.some((l) => l.includes(g.notaProfesor)) && html`<blockquote class="retro-nota">${g.notaProfesor}</blockquote>`}
      <label class="interruptor">
        <span><b>Retro dada</b></span>
        <input type="checkbox" aria-label=${`Retro dada al grupo ${g.grupo}`} checked=${g.dada} onChange=${(e) => marcarRetro(db, taller.id, g.grupo, e.currentTarget.checked)} />
      </label>
    </div>`;
}
