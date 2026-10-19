// Pestaña «Control»: control oral aleatorio con indicador de cobertura del bimestre.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Persona, Aviso } from './base.js';
import { BuscarEstudiante } from './buscar.js';
import {
  agregarAlControl, aprobarControl, elegirConcepto, marcarNoEsta, marcarSalio, puntuarPregunta, quitarDelControl, volverASorteado,
} from '../datos/acciones.js';
import { candidatosSorteo, coberturaControl, sortear } from '../nucleo/sorteo.js';
import { notaControl } from '../nucleo/motor.js';
import { controlCalifica } from '../nucleo/config.js';
import { activos } from '../nucleo/grupos.js';
import { sobreDiez } from '../nucleo/motor-vista.js';
import { textoBimestre } from './curso-datos.js';

export function Control({ ctx, evento }) {
  const { cfg, db, avisar } = useApp();
  const co = cfg.controlOral;
  const califica = controlCalifica(cfg, ctx.curso.metodologia);
  const cob = coberturaControl(ctx, evento);
  const [manual, setManual] = useState(false);
  const [salida, setSalida] = useState(null);
  const filas = ctx.reg.controles.filter((c) => c.evento === evento.id).sort((a, b) => a.orden - b.orden);

  const sortearN = async (n) => {
    const elegidos = sortear(candidatosSorteo(ctx, evento), n);
    if (!elegidos.length) { avisar('No quedan estudiantes para sortear.', 'mal'); return; }
    await agregarAlControl(db, evento.id, elegidos.map((e) => e.id));
    if (elegidos.length < n) avisar(`Solo quedaban ${elegidos.length} por sortear.`);
  };

  const noEsta = async (estudiante) => {
    await marcarNoEsta(db, evento.id, estudiante.id);
    // Se vuelve a sortear uno (sin contar a quien no está, que sigue pendiente para otra sesión).
    const reemplazo = sortear(candidatosSorteo(ctx, evento), 1);
    if (reemplazo.length) {
      await agregarAlControl(db, evento.id, [reemplazo[0].id]);
      avisar(`No está: se sorteó a ${reemplazo[0].nombre.split(' ')[0]}.`);
    } else avisar('No quedan estudiantes para sortear.', 'mal');
  };

  const sinControl = cob.sinControl.map((e) => e.id);
  return html`
    <div class="tarjeta">
      <div class="separado"><h2>Control oral</h2><${Chip} tono=${califica ? 'trad' : 'sqi'}>${califica ? 'con nota' : 'sin nota'}<//></div>
      <div class="resumen-numeros">
        <div><b>${cob.faltan}</b><span>sin control (de ${cob.total})</span></div>
        <div><b>${cob.quedan}</b><span>sesiones quedan</span></div>
        <div><b>${cob.sugerido}</b><span>conviene hoy</span></div>
      </div>
      <p class="tenue pequeno">${textoBimestre(cob.bimestre)}: faltan ${cob.faltan}; quedan ${cob.quedan} sesiones (con esta); conviene sortear ${cob.sugerido} por sesión.</p>
      ${cob.aviso && html`<${Aviso} tono="aviso">Hacen falta más de ${co.aviso_si_sugerido_mayor_que} por sesión para que todos tengan control este bimestre.<//>`}
      <div class="botones">
        ${co.estudiantes_por_sesion.map((n) => html`<button class="boton primario" onClick=${() => sortearN(n)}>Sortear ${n}</button>`)}
        <button class="boton" onClick=${() => sortearN(1)}>+1</button>
      </div>
      <button class="boton chico ancho" onClick=${() => setManual(true)}>Elegir a mano…</button>
    </div>

    ${filas.length > 0 && html`<div class="seccion-titulo">Sorteados · ${filas.length}</div>`}
    ${filas.map((f) => {
      const est = ctx.estudiantePorId.get(f.estudiante);
      return est && html`<${TarjetaControl} key=${f.estudiante} fila=${f} estudiante=${est} evento=${evento} ctx=${ctx}
        califica=${califica} sinControlAntes=${sinControl.includes(est.id)} alNoEsta=${() => noEsta(est)} alSalio=${() => setSalida(est)} />`;
    })}

    ${manual && html`
      <${Hoja} titulo="Elegir a mano" alCerrar=${() => setManual(false)}>
        <${BuscarEstudiante} estudiantes=${activos(ctx.reg.estudiantes).filter((e) => !filas.some((f) => f.estudiante === e.id))}
          detalle=${(e) => (sinControl.includes(e.id) ? html`<${Chip} tono="aviso">sin control<//>` : html`<${Chip} tono="ok">ya tiene control<//>`)}
          alElegir=${async (e) => { await agregarAlControl(db, evento.id, [e.id], { manual: true }); setManual(false); }} />
      <//>`}
    ${salida && html`
      <${Hoja} titulo="¿Salió de la clase?" alCerrar=${() => setSalida(null)}>
        <${Persona} estudiante=${salida} />
        <p>Si no está preparado y le pides que salga, queda como <b>falta</b> en esta actividad: pierde sus notas de ${evento.codigo}${califica ? ' y el control queda con 0' : ''}.</p>
        <div class="botones">
          <button class="boton" onClick=${() => setSalida(null)}>Cancelar</button>
          <button class="boton peligro-fuerte" onClick=${async () => { await marcarSalio(db, evento.id, salida.id, co.salio.motivo_falta); setSalida(null); }}>Salió</button>
        </div>
      <//>`}`;
}

function TarjetaControl({ fila, estudiante, evento, ctx, califica, sinControlAntes, alNoEsta, alSalio }) {
  const { cfg, db } = useApp();
  const co = cfg.controlOral;
  const nota = notaControl(ctx, evento, estudiante.id);
  const motivo = co.salio.motivo_falta;
  const escala = co.escala_pregunta;
  const puntajes = fila.puntajes ?? [];
  const conceptos = (evento.config && cfg.actividades[evento.config]?.conceptos_control) || [];

  if (fila.estado === 'no_esta' || fila.estado === 'salio') {
    return html`
      <div class="tarjeta control atenuado">
        <${Persona} estudiante=${estudiante} />
        <div class="separado">
          <${Chip} tono=${fila.estado === 'salio' ? 'mal' : ''}>${fila.estado === 'salio' ? 'Salió · falta en esta actividad' : 'No está · sigue pendiente'}<//>
          <button class="boton chico" onClick=${() => volverASorteado(db, evento.id, estudiante.id, motivo)}>${fila.estado === 'salio' ? 'Deshacer' : 'Sí está'}</button>
        </div>
      </div>`;
  }

  const filasPregunta = califica ? [...puntajes, ...(puntajes.length < co.max_preguntas_por_estudiante ? [null] : [])] : [];
  return html`
    <div class="tarjeta control">
      <div class="separado">
        <${Persona} estudiante=${estudiante} detalle=${sinControlAntes ? html`<${Chip} tono="aviso">primer control<//>` : null} />
        ${nota.estado === 'calculada' && (califica
          ? html`<span class="nota-grande">${sobreDiez(nota.valor)}</span>`
          : html`<${Chip} tono=${nota.aprobado ? 'ok' : 'mal'}>${nota.aprobado ? 'Aprobado' : 'No aprobado'}<//>`)}
      </div>
      ${califica && filasPregunta.map((p, i) => html`
        <div class="pregunta">
          <span class="num">P${i + 1}</span>
          <div class="niveles chicos">
            ${escala.map((v) => html`<button class=${p === v ? 'elegido' : ''} title=${co.descriptores?.[String(v)]}
              onClick=${() => puntuarPregunta(db, evento.id, estudiante.id, i, v)}>${v}</button>`)}
          </div>
          ${p !== null ? html`<button class="quitar" aria-label="Quitar pregunta" onClick=${() => puntuarPregunta(db, evento.id, estudiante.id, i, null)}>×</button>` : html`<span style="width:32px"></span>`}
        </div>
        <${Concepto} conceptos=${conceptos} valor=${fila.conceptos?.[i]} numero=${i + 1}
          alElegir=${(c) => elegirConcepto(db, evento.id, estudiante.id, i, c)} />`)}
      ${califica && html`<p class="tenue pequeno">2 = correcto y justificado · 1 = parcial o con ayuda · 0 = incorrecto o no responde</p>`}
      ${!califica && html`
        <div class="segmentado">
          <button class=${fila.aprobado === true ? 'elegido ok' : ''} onClick=${() => aprobarControl(db, evento.id, estudiante.id, fila.aprobado === true ? null : true)}>Aprobado</button>
          <button class=${fila.aprobado === false ? 'elegido mal' : ''} onClick=${() => aprobarControl(db, evento.id, estudiante.id, fila.aprobado === false ? null : false)}>No aprobado</button>
        </div>
        <${Concepto} conceptos=${conceptos} valor=${fila.conceptos?.[0]} alElegir=${(c) => elegirConcepto(db, evento.id, estudiante.id, 0, c)} />`}
      <div class="botones">
        <button class="boton chico" onClick=${alNoEsta}>No está</button>
        <button class="boton chico peligro" onClick=${alSalio}>Salió</button>
        <button class="boton chico" onClick=${() => quitarDelControl(db, evento.id, estudiante.id, motivo)}>Quitar</button>
      </div>
    </div>`;
}

/** Concepto de la pregunta (opcional): sirve para ver en las métricas en qué conceptos fallan. */
function Concepto({ conceptos, valor, numero, alElegir }) {
  if (!conceptos.length) return null;
  return html`
    <select class=${`concepto-control ${valor ? 'elegido' : ''} ${numero ? 'con-numero' : ''}`} value=${valor ?? ''}
      aria-label=${numero ? `Concepto de la pregunta ${numero}` : 'Concepto del control'}
      onChange=${(e) => alElegir(e.currentTarget.value || null)}>
      <option value="">${numero ? `Concepto de P${numero} (opcional)…` : 'Concepto (opcional)…'}</option>
      ${conceptos.map((c) => html`<option value=${c.id}>${c.texto}</option>`)}
    </select>`;
}
