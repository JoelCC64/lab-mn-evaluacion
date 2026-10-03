// Pestaña «Retro» del taller: retroalimentación corta de la práctica anterior, grupo por grupo, armada con lo que
// la app registró (rúbrica, etiquetas, nota del profesor y control oral). Una casilla marca la retro como dada.
import { html, useApp, Chip, Aviso, enlace } from './base.js';
import { marcarRetro } from '../datos/acciones.js';
import { retroDelTaller } from '../nucleo/retro.js';
import { sobreDiez, textoNotaGrupo } from '../nucleo/motor-vista.js';

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
  const sinNada = r.grupos.every((g) => !g.nota.partes?.some((p) => p.valor !== null && p.valor !== undefined) && !g.etiquetas.length && !g.notaProfesor);
  return html`
    <p class="tenue pequeno">
      Retroalimentación de <a class="negrita" href=${enlace('evento', r.practica.id)}>${r.practica.codigo} · ${r.practica.titulo}</a>,
      grupo por grupo, mientras los demás trabajan. ${dadas}/${r.grupos.length} dadas.
    </p>
    ${sinNada && html`<${Aviso} tono="aviso">En ${r.practica.codigo} no hay nada registrado todavía (rúbrica, etiquetas ni notas).<//>`}
    ${r.grupos.map((g) => html`<${TarjetaRetro} key=${g.grupo} g=${g} taller=${evento} />`)}`;
}

function TarjetaRetro({ g, taller }) {
  const { db } = useApp();
  const conValor = (g.nota.partes ?? []).filter((p) => p.valor !== null && p.valor !== undefined);
  const tono = (p) => (p.valor === p.max ? 'ok' : p.valor / p.max < 0.5 ? 'mal' : 'aviso');
  return html`
    <div class=${`tarjeta retro ${g.dada ? 'dada' : ''}`}>
      <div class="separado">
        <h3>Grupo ${g.grupo}</h3>
        ${g.revision?.penalizacion_total ? html`<${Chip} tono="mal">penalización total<//>`
          : g.nota.completo ? html`<${Chip} tono="info">${textoNotaGrupo(g.nota)}<//>` : html`<${Chip}>sin evaluar<//>`}
      </div>
      <div class="fila-flex pequeno">
        ${g.integrantes.map(({ estudiante, asistencia, control }) => html`
          <span class=${asistencia.falta ? 'tachado' : ''}>${primerNombre(estudiante.nombre)}${control.estado === 'calculada'
            ? html` <${Chip} tono=${control.valor === null ? (control.aprobado ? 'ok' : 'mal') : control.valor >= 0.75 ? 'ok' : control.valor >= 0.5 ? 'aviso' : 'mal'}>control ${control.valor === null ? (control.aprobado ? '✓' : '✗') : sobreDiez(control.valor)}<//>`
            : ''}${asistencia.falta ? html` <${Chip} tono="mal">faltó<//>` : ''}</span>`)}
      </div>
      ${conValor.length > 0 && html`
        <div class="fila-flex">${conValor.map((p) => html`<${Chip} tono=${tono(p)}>${p.corto} ${p.valor}/${p.max}<//>`)}</div>`}
      ${g.etiquetas.length > 0 && html`
        <ul class="retro-etiquetas">${g.etiquetas.map((t) => html`<li class=${t.signo === '+' ? 'pos' : 'neg'}><span>${t.signo === '+' ? '+' : '−'}</span> ${t.texto}</li>`)}</ul>`}
      ${g.notaProfesor && html`<blockquote class="retro-nota">${g.notaProfesor}</blockquote>`}
      <label class="interruptor">
        <span><b>Retro dada</b></span>
        <input type="checkbox" aria-label=${`Retro dada al grupo ${g.grupo}`} checked=${g.dada} onChange=${(e) => marcarRetro(db, taller.id, g.grupo, e.currentTarget.checked)} />
      </label>
    </div>`;
}
