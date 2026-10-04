// Inicio: aviso de respaldo, los cursos (los de hoy primero) y el acceso a «Datos».
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo, Pantalla, Chip, ChipMetodologia, Aviso, Cargando, enlace } from './base.js';
import { exportarRespaldoDelDia, useEstadoRespaldo } from './respaldo-dia.js';
import { conteoPorCurso } from '../datos/consultas.js';
import { generarEventos, eventoSugerido } from '../nucleo/calendario.js';
import { diaDeFecha, fechaCorta, hoyLocal } from '../nucleo/util.js';
import { horario } from './curso-datos.js';

export function Inicio() {
  const { cfg, db } = useApp();
  const conteo = useVivo(() => conteoPorCurso(db), []);
  if (conteo === undefined) return html`<${Pantalla} titulo="Lab. MN · ${cfg.semestre.semestre}"><${Cargando} /><//>`;

  const hoy = hoyLocal();
  const diaHoy = diaDeFecha(hoy);
  const sinDatos = Object.keys(conteo).length === 0;
  const deHoy = cfg.cursos.filter((c) => c.dia === diaHoy);
  const otros = cfg.cursos.filter((c) => c.dia !== diaHoy);

  const acciones = html`<a class="icono-boton texto-boton" href=${enlace('datos')}>Datos</a>`;
  return html`
    <${Pantalla} titulo="Lab. MN · ${cfg.semestre.semestre}" subtitulo="Evaluación y calificaciones" acciones=${acciones}>
      ${sinDatos && html`
        <div class="tarjeta destacada">
          <h2>Para empezar, carga el Excel del semestre</h2>
          <p class="tenue">La app lee de ahí los estudiantes (código y nombre) y los grupos de trabajo. No lee los correos.</p>
          <a class="boton primario grande" href=${enlace('datos')}>Ir a «Datos»</a>
        </div>`}
      ${!sinDatos && html`<${AvisoRespaldo} />`}
      ${deHoy.length > 0 && html`
        <div class="seccion-titulo">Hoy · ${fechaCorta(hoy)}</div>
        <div class="lista">${deHoy.map((c) => html`<${FilaCurso} curso=${c} conteo=${conteo[c.paralelo]} hoy=${hoy} destacada />`)}</div>`}
      <div class="seccion-titulo">${deHoy.length ? 'Los demás cursos' : 'Cursos'}</div>
      <div class="lista">${otros.map((c) => html`<${FilaCurso} curso=${c} conteo=${conteo[c.paralelo]} hoy=${hoy} />`)}</div>
    <//>`;
}

/** Recordatorio del respaldo del día: visible cuando hay registros que aún no están en un respaldo. */
function AvisoRespaldo() {
  const { cfg, db, demo, avisar } = useApp();
  const { ultimoRespaldo, ultimoCambio, pendiente } = useEstadoRespaldo(db.name);
  const [ocupado, setOcupado] = useState(false);
  const cuando = (iso) => {
    const d = new Date(iso);
    const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return hoyLocal(d) === hoyLocal() ? `hoy a las ${hora}` : `el ${fechaCorta(hoyLocal(d))} a las ${hora}`;
  };
  if (!pendiente && ultimoRespaldo) return html`<p class="tenue pequeno centro">Respaldo al día · ${cuando(ultimoRespaldo)}</p>`;
  const exportar = async () => {
    setOcupado(true);
    try {
      const { resultado } = await exportarRespaldoDelDia({ cfg, db, demo });
      if (resultado !== 'cancelado') avisar('Respaldo listo. Súbelo a Drive.', 'ok');
    } catch (e) { console.error(e); avisar(e.message || String(e), 'mal'); } finally { setOcupado(false); }
  };
  return html`
    <div class="tarjeta aviso-respaldo">
      <div class="negrita">${ultimoRespaldo ? 'Hay registros sin respaldar' : 'Aún no hay un respaldo de este dispositivo'}</div>
      <p class="pequeno">${ultimoCambio ? `Último cambio: ${cuando(ultimoCambio)}. ` : ''}Exporta el respaldo del día y súbelo a Drive.</p>
      <button class="boton primario ancho" disabled=${ocupado} onClick=${exportar}>${ocupado ? 'Preparando…' : 'Exportar el respaldo del día'}</button>
    </div>`;
}

function FilaCurso({ curso, conteo, hoy, destacada }) {
  const { cfg } = useApp();
  const sugerido = eventoSugerido(cfg, generarEventos(cfg, curso), hoy);
  const n = conteo ? conteo.nomina + conteo.pendiente : 0;
  return html`
    <a class="fila" href=${enlace('curso', curso.paralelo)}>
      <div class="principal">
        <div class="linea1 fila-flex">
          <span style=${destacada ? 'font-size:18px' : ''}>${curso.paralelo}</span>
          <${ChipMetodologia} metodologia=${curso.metodologia} />
          <${Chip}>Cron. ${curso.cronograma}<//>
        </div>
        <div class="linea2">
          ${horario(curso)} · ${n ? `${n} est.` : 'sin estudiantes'}${conteo?.pendiente ? ` (${conteo.pendiente} pend.)` : ''}
        </div>
        ${sugerido && html`<div class="linea2">Esta semana: <b>${sugerido.codigo}</b> · ${sugerido.titulo}${sugerido.estado !== 'normal' ? ` (${sugerido.estado === 'feriado' ? 'feriado' : 'sin clase'})` : ''}</div>`}
      </div>
      <span class="flecha">›</span>
    </a>`;
}
