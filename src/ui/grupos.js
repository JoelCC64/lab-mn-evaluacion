// Pestaña «Grupos»: estado de cada grupo (evaluado, pase, firmado), estudiantes sin grupo y cierre del pase.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Aviso, enlace } from './base.js';
import { HojaMover } from './grupo.js';
import { cerrarPase, reabrirPase } from '../datos/acciones.js';
import { gruposDe, notaGrupo } from '../nucleo/motor.js';
import { listaDeGrupos } from '../nucleo/grupos.js';
import { seEvaluaPorGrupo, textoNotaGrupo } from '../nucleo/motor-vista.js';
import { preparatorioCalifica } from '../nucleo/config.js';

const hora = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

export function Grupos({ ctx, evento }) {
  const { cfg, db, avisar } = useApp();
  const grupos = gruposDe(ctx, evento);
  const { grupos: lista, sinGrupo } = listaDeGrupos(grupos, ctx.reg.estudiantes);
  const pase = ctx.pases.get(evento.id);
  const [cerrando, setCerrando] = useState(false);
  const [moviendo, setMoviendo] = useState(null);
  const conRubrica = seEvaluaPorGrupo(evento);

  if (!lista.length && !sinGrupo.length) {
    return html`<${Aviso} tono="aviso">Este curso no tiene estudiantes. Carga el Excel del semestre en <a class="negrita" href=${enlace('datos')}>Datos</a>.<//>`;
  }
  return html`
    ${pase?.cerrado
      ? html`<div class="tarjeta"><div class="separado"><${Chip} tono="ok">✓ Pase cerrado · ${hora(pase.cerrado_en)}<//>
          <button class="boton chico" onClick=${() => reabrirPase(db, evento.id)}>Reabrir</button></div></div>`
      : html`<p class="tenue pequeno">Al final de la clase, abre cada grupo: evalúa, revisa quién está y firma. Después cierra el pase.</p>`}

    <div class="lista">
      ${lista.map((g) => {
        const rev = ctx.revisiones.get(`${evento.id}|${g.grupo}`);
        const nota = conRubrica ? notaGrupo(ctx, evento, g.grupo) : null;
        const faltas = g.integrantes.filter((e) => ['no_vino', 'salio'].includes(ctx.asistencia.get(`${evento.id}|${e.id}`)?.estado)).length;
        return html`
          <a class="fila" href=${enlace('evento', evento.id, 'grupo', g.grupo)}>
            <span class="grupo-num">${g.grupo}</span>
            <div class="principal">
              <div class="linea1">${g.integrantes.map((e) => e.nombre.split(' ')[0]).join(' · ')}</div>
              <div class="linea2 fila-flex">
                ${nota && (rev?.penalizacion_total ? html`<${Chip} tono="mal">penalización<//>`
                  : nota.completo ? html`<${Chip} tono="ok">${textoNotaGrupo(nota)}<//>` : html`<${Chip}>sin evaluar<//>`)}
                ${rev?.verificado ? html`<${Chip} tono="ok">pase ✓<//>` : null}
                ${rev?.trabajo_firmado ? html`<${Chip} tono="info">firmado<//>` : null}
                ${faltas ? html`<${Chip} tono="mal">${faltas} falta${faltas > 1 ? 's' : ''}<//>` : null}
              </div>
            </div>
            <span class="flecha">›</span>
          </a>`;
      })}
    </div>

    ${sinGrupo.length > 0 && html`
      <div class="seccion-titulo">Sin grupo · ${sinGrupo.length}</div>
      <div class="lista">
        ${sinGrupo.map((e) => {
          const a = ctx.asistencia.get(`${evento.id}|${e.id}`);
          return html`
            <button class="fila" onClick=${() => setMoviendo(e)}>
              <span class="grupo-num vacio">–</span>
              <div class="principal">
                <div class="linea1">${e.nombre}</div>
                <div class="linea2">${a?.estado === 'no_vino' ? `no vino${a.motivo ? ` (${a.motivo})` : ''}` : 'tócalo para asignarle un grupo'}</div>
              </div>
            </button>`;
        })}
      </div>
      <p class="tenue pequeno">Al cerrar el pase, quien siga sin grupo queda como «no vino».</p>`}

    ${!pase?.cerrado && html`<button class="boton primario grande" onClick=${() => setCerrando(true)}>Cerrar pase</button>`}

    ${cerrando && html`<${HojaCerrar} ctx=${ctx} evento=${evento} lista=${lista} sinGrupo=${sinGrupo} grupos=${grupos}
      cerrar=${() => setCerrando(false)} alCerrar=${(c) => { setCerrando(false); avisar(`Pase cerrado: ${c.presentes} presentes por defecto${c.sin_grupo ? `; ${c.sin_grupo} sin grupo como «no vino»` : ''}.`, 'ok'); }} />`}
    ${moviendo && html`<${HojaMover} ctx=${ctx} evento=${evento} estudiante=${moviendo} cerrar=${() => setMoviendo(null)} />`}`;
}

function HojaCerrar({ ctx, evento, lista, sinGrupo, grupos, cerrar, alCerrar }) {
  const { cfg, db } = useApp();
  const sinVerificar = lista.filter((g) => !ctx.revisiones.get(`${evento.id}|${g.grupo}`)?.verificado);
  const conRubrica = seEvaluaPorGrupo(evento);
  const sinEvaluar = conRubrica ? lista.filter((g) => !notaGrupo(ctx, evento, g.grupo).completo) : [];
  const prepSinMarcar = preparatorioCalifica(cfg, ctx.curso.metodologia) && ['practica', 'taller'].includes(evento.tipo)
    && !ctx.revisionPrep.get(evento.id)?.revisada;
  const aceptar = async () => {
    const c = await cerrarPase(db, evento.id, grupos, cfg.asistencia.motivos.sin_grupo);
    alCerrar(c);
  };
  return html`
    <${Hoja} titulo="Cerrar el pase" alCerrar=${cerrar}>
      <p>Quien esté en un grupo y no tenga falta marcada queda <b>presente</b>. Con el pase cerrado se calculan las notas del evento.</p>
      ${sinVerificar.length > 0 && html`<${Aviso} tono="aviso" titulo=${sinVerificar.length === 1 ? `El grupo ${sinVerificar[0].grupo} no se revisó` : `${sinVerificar.length} grupos sin revisar (${sinVerificar.map((g) => g.grupo).join(', ')})`}>Sus integrantes sin falta marcada quedarán presentes.<//>`}
      ${sinGrupo.length > 0 && html`<${Aviso} tono="mal" titulo=${`${sinGrupo.length} estudiante(s) sin grupo quedarán como «no vino»`} lista=${sinGrupo.map((e) => e.nombre)} />`}
      ${sinEvaluar.length > 0 && html`<${Aviso} tono="aviso">${sinEvaluar.length === 1 ? `Falta evaluar el grupo ${sinEvaluar[0].grupo}: sus notas quedarán pendientes hasta que lo evalúes.` : `Falta evaluar los grupos ${sinEvaluar.map((g) => g.grupo).join(', ')}: sus notas quedarán pendientes hasta que los evalúes.`}<//>`}
      ${prepSinMarcar && html`<${Aviso} tono="aviso">La revisión del preparatorio no está marcada: el preparatorio de quienes no tienen novedad quedará pendiente.<//>`}
      <div class="botones">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        <button class="boton primario" onClick=${aceptar}>Cerrar pase</button>
      </div>
    <//>`;
}
