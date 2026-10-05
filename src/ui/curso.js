// Curso: el evento de esta semana, todos los eventos por bimestre (con su estado) y los estudiantes.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Pantalla, Chip, ChipMetodologia, Aviso, Cargando, Hoja, enlace, Persona } from './base.js';
import { quitarEstudianteNuevo } from '../datos/acciones.js';
import { useCurso, textoBimestre, horario } from './curso-datos.js';
import { nombreEvento } from './evento.js';
import { eventoSugerido, semanaDeFecha } from '../nucleo/calendario.js';
import { estadoEvento } from '../nucleo/estado-evento.js';
import { avanceEvaluacion } from '../nucleo/motor-vista.js';
import { fechaCorta, hoyLocal, compararGrupos } from '../nucleo/util.js';
import { nombreMetodologia } from '../nucleo/config.js';
import { activos as delCurso } from '../nucleo/grupos.js';
import { avisoControlCierre, bimestreEnCurso, pendientesDelBimestre } from '../nucleo/bimestre.js';

export function Curso({ paralelo }) {
  const { cfg } = useApp();
  const { curso, reg, eventos, ctx, cargando } = useCurso(paralelo);
  if (!curso) return html`<${Pantalla} titulo="Curso desconocido" atras="#/"><${Aviso} tono="mal">No existe el curso ${paralelo}.<//><//>`;
  const subtitulo = `${nombreMetodologia(cfg, curso.metodologia)} · Cronograma ${curso.cronograma} · ${horario(curso, true)}`;
  if (cargando || !eventos) return html`<${Pantalla} titulo=${paralelo} subtitulo=${subtitulo} atras="#/"><${Cargando} /><//>`;

  const hoy = hoyLocal();
  const sugerido = eventoSugerido(cfg, eventos, hoy);
  const activos = delCurso(reg.estudiantes);
  const enCurso = bimestreEnCurso(cfg, hoy);
  const porBimestre = [1, 2].map((b) => ({ b, eventos: eventos.filter((e) => e.bimestre === b) }));

  return html`
    <${Pantalla} titulo=${paralelo} subtitulo=${subtitulo} atras="#/">
      ${activos.length === 0 && html`
        <${Aviso} tono="aviso" titulo="Este curso aún no tiene estudiantes">
          Carga el Excel del semestre en <a class="negrita" href=${enlace('datos')}>Datos</a>.
        <//>`}
      ${sugerido && html`
        <a class="tarjeta destacada" href=${enlace('evento', sugerido.id)}>
          <div class="separado">
            <span class="tenue pequeno negrita">${etiquetaSugerido(cfg, sugerido, hoy)} · ${fechaCorta(sugerido.fecha)}</span>
            <${EstadoChip} evento=${sugerido} ctx=${ctx} />
          </div>
          <h2>${sugerido.codigo} · ${sugerido.titulo}</h2>
          <div class="tenue pequeno">Semana ${sugerido.semana} · ${sugerido.lugar === 'lab' ? 'laboratorio' : 'aula'} · ${textoBimestre(sugerido.bimestre)}</div>
        </a>`}
      ${activos.length > 0 && html`<${TarjetaNotas} ctx=${ctx} paralelo=${paralelo} enCurso=${enCurso} hoy=${hoy} />`}
      ${activos.length > 0 && html`
        <a class="tarjeta" href=${enlace('metricas', paralelo)}>
          <div class="separado"><h2>Métricas del curso</h2><span class="flecha">›</span></div>
          <div class="tenue pequeno">Asistencia, rúbricas, control oral y evolución entre eventos; para presentar o en detalle.</div>
        </a>`}
      ${porBimestre.map(({ b, eventos: lista }) => html`
        <div class="seccion-titulo">${textoBimestre(b)}</div>
        <div class="lista">${lista.map((e) => html`<${FilaEvento} evento=${e} ctx=${ctx} />`)}</div>`)}
      <${Estudiantes} estudiantes=${reg.estudiantes} />
    <//>`;
}

function etiquetaSugerido(cfg, evento, hoy) {
  if (evento.fecha === hoy) return 'HOY';
  if (evento.fecha > hoy) return 'PRÓXIMA SESIÓN';
  return evento.semana === semanaDeFecha(cfg, hoy) ? 'ESTA SEMANA' : 'ÚLTIMA SESIÓN';
}

function EstadoChip({ evento, ctx }) {
  const e = estadoEvento(evento, ctx.reg, avanceEvaluacion(ctx, evento));
  return html`<${Chip} tono=${e.tono} titulo=${e.detalle}>${e.texto}<//>`;
}

function FilaEvento({ evento, ctx }) {
  const est = estadoEvento(evento, ctx.reg, avanceEvaluacion(ctx, evento));
  const esTC = evento.tipo === 'trabajo_casa';
  const secundaria = evento.tipo === 'sin_nota' || evento.tipo === 'plic' || (esTC && !evento.con_nota);
  const lugar = evento.lugar ? (evento.lugar === 'lab' ? 'lab.' : 'aula') : '';
  // Un TC va bajo su práctica (misma fecha): se muestra como trabajo en casa, con su avance.
  const detalle = esTC ? 'en casa'
    : [fechaCorta(evento.fecha), lugar, evento.con_nota ? null : 'sin nota'].filter(Boolean).join(' · ');
  return html`
    <a class=${`fila ${secundaria ? 'atenuada' : ''} ${evento.tipo === 'trabajo_casa' ? 'sangria' : ''}`} href=${enlace('evento', evento.id)}>
      ${evento.tipo === 'trabajo_casa' ? null : html`<span class="semana"><b>${evento.semana}</b>sem</span>`}
      <div class="principal">
        <div class="linea1">${nombreEvento(evento)}</div>
        <div class="linea2">${detalle}${est.detalle ? ` · ${est.detalle}` : ''}</div>
      </div>
      <${Chip} tono=${est.tono}>${est.texto}<//>
    </a>`;
}

/** Acceso a las notas del bimestre, con lo que falta evaluar y el aviso de control oral al cierre. */
function TarjetaNotas({ ctx, paralelo, enCurso, hoy }) {
  const b = enCurso?.bimestre ?? 2;
  const { pendientes } = pendientesDelBimestre(ctx, b, hoy);
  const aviso = avisoControlCierre(ctx, b, hoy);
  return html`
    <a class="tarjeta" href=${enlace('curso', paralelo, 'notas')}>
      <div class="separado"><h2>Notas del ${textoBimestre(b)}</h2><span class="flecha">›</span></div>
      <div class="tenue pequeno">${pendientes.length ? `Faltan por evaluar: ${pendientes.map((p) => p.evento.codigo).join(', ')}` : 'Al día con lo que ya pasó'}${enCurso ? ` · envío: ${fechaCorta(enCurso.envio)}` : ''}</div>
      ${aviso && html`<div class="texto-aviso pequeno">${aviso.sinControl.length} sin control oral ${aviso.quedan ? `y quedan ${aviso.quedan} sesiones` : 'al cierre'}</div>`}
    </a>`;
}

function Estudiantes({ estudiantes }) {
  const [abierto, setAbierto] = useState(false);
  const [quitando, setQuitando] = useState(null);
  const activos = delCurso(estudiantes);
  const bajas = estudiantes.filter((e) => e.estado === 'baja');
  const orden = [...activos].sort((a, b) => compararGrupos(a.grupo_excel ?? '999', b.grupo_excel ?? '999') || a.nombre.localeCompare(b.nombre, 'es'));
  return html`
    <div class="seccion-titulo">
      <span>Estudiantes · ${activos.length}${bajas.length ? ` (+${bajas.length} de baja)` : ''}</span>
      <button class="boton chico" onClick=${() => setAbierto(!abierto)}>${abierto ? 'Ocultar' : 'Ver'}</button>
    </div>
    ${abierto && html`
      <div class="lista">
        ${[...orden, ...bajas].map((e) => html`
          <div class="fila">
            <${Persona} estudiante=${e} detalle=${e.agregado ? null : e.grupo_excel ? html`<span>· grupo del Excel ${e.grupo_excel}</span>` : html`<span>· sin grupo en el Excel</span>`} />
            ${e.agregado && html`<button class="boton chico" onClick=${() => setQuitando(e)}>Quitar</button>`}
          </div>`)}
      </div>
      ${quitando && html`<${HojaQuitarNuevo} estudiante=${quitando} alCerrar=${() => setQuitando(null)} />`}
      <p class="tenue pequeno">Los grupos del Excel solo sirven para el primer evento; después mandan los grupos de la app.</p>`}`;
}

/** Quitar a un estudiante agregado en la app por error (con todo lo que se le registró). */
function HojaQuitarNuevo({ estudiante, alCerrar }) {
  const { db, avisar } = useApp();
  const quitar = async () => {
    try { await quitarEstudianteNuevo(db, estudiante.id); avisar('Quitado del curso.'); alCerrar(); } catch (e) { avisar(e.message, 'mal'); }
  };
  return html`
    <${Hoja} titulo="¿Quitarlo del curso?" alCerrar=${alCerrar}>
      <${Persona} estudiante=${estudiante} />
      <p>Se agregó en la app. Si fue por error, se quita del curso con todo lo que se le registró (grupos, asistencia, controles, notas).
        Si dejó de venir, no lo quites: marca su asistencia como siempre.</p>
      <div class="botones">
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton peligro-fuerte" onClick=${quitar}>Quitar</button>
      </div>
    <//>`;
}
