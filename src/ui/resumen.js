// Pestaña «Resumen»: nota de cada estudiante en el evento, con el motivo de cada 0, pendiente o exclusión.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Chip, Hoja, Aviso, Persona } from './base.js';
import { borrarAjuste, guardarAjuste } from '../datos/acciones.js';
import { resumenEvento } from '../nucleo/motor.js';
import { sobreDiez } from '../nucleo/motor-vista.js';
import { compararGrupos } from '../nucleo/util.js';
import { controlCalifica, preparatorioCalifica } from '../nucleo/config.js';

const TEXTO_ASISTENCIA = { presente: 'P', no_vino: 'F', salio: 'F', se_retiro_antes: 'R' };

export function Resumen({ ctx, evento }) {
  const { cfg } = useApp();
  const { filas, avisos } = resumenEvento(ctx, evento);
  const [detalle, setDetalle] = useState(null);
  const conNota = evento.con_nota;
  const conPrep = preparatorioCalifica(cfg, ctx.curso.metodologia) && cfg.preparatorio.aplica_a.includes(evento.tipo);
  const conControl = cfg.controlOral.sesiones.includes(evento.tipo);
  const ctrlNota = controlCalifica(cfg, ctx.curso.metodologia);
  const orden = [...filas].sort((a, b) => compararGrupos(a.grupo ?? '999', b.grupo ?? '999') || a.estudiante.nombre.localeCompare(b.estudiante.nombre, 'es'));
  const presentes = filas.filter((f) => ['presente', 'se_retiro_antes'].includes(f.asistencia.estado)).length;
  const faltas = filas.filter((f) => f.asistencia.falta).length;
  const pendientes = filas.filter((f) => f.nota.estado === 'pendiente').length;

  return html`
    ${avisos.map((a) => html`<${Aviso} tono="aviso">${a}<//>`)}
    <div class="resumen-numeros">
      <div><b>${presentes}</b><span>presentes</span></div>
      <div><b>${faltas}</b><span>faltas</span></div>
      ${conNota && html`<div><b>${pendientes}</b><span>notas pendientes</span></div>`}
    </div>
    <div class="lista desplazable">
      <table class="tabla tabla-notas">
        <thead><tr>
          <th>Estudiante</th><th class="num">G</th><th class="num">As.</th>
          ${conNota && html`<th class="num">Nota</th>`}${conPrep && html`<th class="num">Prep.</th>`}${conControl && html`<th class="num">Ctrl.</th>`}
        </tr></thead>
        <tbody>
          ${orden.map((f) => html`
            <tr onClick=${() => setDetalle(f)} style="cursor:pointer">
              <td class="nombre-celda">${apellidos(f.estudiante.nombre)}${f.estudiante.estado === 'pendiente' ? ' ·p' : ''}
                <span class="nombres">${nombres(f.estudiante.nombre)}</span>
                ${motivoFila(f) && html`<span class="motivo">${motivoFila(f)}</span>`}</td>
              <td class="num">${f.grupo ?? '–'}</td>
              <td class="num">${TEXTO_ASISTENCIA[f.asistencia.estado] ?? '·'}</td>
              ${conNota && html`<td class="num negrita">${f.nota.estado === 'calculada' ? sobreDiez(f.nota.valor) : f.nota.estado === 'excluido' ? '—' : '…'}</td>`}
              ${conPrep && html`<td class="num">${f.preparatorio.estado === 'calculada' ? f.preparatorio.nivel : '…'}</td>`}
              ${conControl && html`<td class="num">${f.control.estado === 'calculada' ? (ctrlNota ? sobreDiez(f.control.valor) : (f.control.aprobado ? '✓' : '✗')) : f.control.estado === 'no_esta' ? 'n/e' : ''}</td>`}
            </tr>`)}
        </tbody>
      </table>
    </div>
    <p class="tenue pequeno">As.: P presente · F falta · R se retiró antes. Nota sobre 10 · «…» pendiente · p = pendiente de nómina. Toca una fila para ver el detalle o registrar un ajuste.</p>
    ${detalle && html`<${HojaDetalle} fila=${filas.find((f) => f.estudiante.id === detalle.estudiante.id) ?? detalle} evento=${evento} ctx=${ctx} cerrar=${() => setDetalle(null)} />`}`;
}

// «APELLIDO APELLIDO NOMBRE NOMBRE»: solo para mostrar (los datos no separan apellidos y nombres).
const palabras = (n) => String(n).split(' ').filter(Boolean);
const apellidos = (n) => palabras(n).slice(0, 2).join(' ');
const nombres = (n) => palabras(n).slice(2).join(' ');

function motivoFila(f) {
  if (f.nota.estado === 'calculada' && f.nota.valor === 0) return f.nota.motivo;
  if (f.nota.ajuste) return f.nota.motivo;
  if (f.nota.estado === 'pendiente') return f.nota.motivo;
  if (f.nota.estado === 'excluido') return f.nota.motivo;
  if (f.asistencia.falta) return f.asistencia.motivo ? `falta: ${f.asistencia.motivo}` : 'falta';
  if (f.asistencia.observacion) return f.asistencia.observacion;
  return null;
}

function HojaDetalle({ fila, evento, ctx, cerrar }) {
  const { db, avisar } = useApp();
  const { nota, preparatorio, control, asistencia } = fila;
  const [valor, setValor] = useState(nota.ajuste ? String(Math.round(nota.ajuste.valor * 1000) / 100) : '');
  const [motivo, setMotivo] = useState(nota.ajuste?.motivo ?? '');
  const guardar = async () => {
    const v = Number(String(valor).replace(',', '.'));
    try {
      await guardarAjuste(db, evento.id, fila.estudiante.id, v / 10, motivo);
      avisar('Ajuste guardado.', 'ok');
      cerrar();
    } catch (e) { avisar(e.message, 'mal'); }
  };
  const partes = nota.partes?.grupo?.partes ?? [];
  return html`
    <${Hoja} titulo="Detalle" alCerrar=${cerrar}>
      <${Persona} estudiante=${fila.estudiante} />
      <table class="tabla"><tbody>
        <tr><td>Grupo</td><td>${fila.grupo ?? 'sin grupo'}</td></tr>
        <tr><td>Asistencia</td><td>${asistencia.estado ? (ctx.cfg.asistencia.estados[asistencia.estado]?.texto ?? asistencia.estado) : 'sin registro'}${asistencia.motivo ? ` (${asistencia.motivo})` : ''}</td></tr>
        ${asistencia.observacion && html`<tr><td>Observación</td><td>${asistencia.observacion}</td></tr>`}
        ${evento.con_nota && html`<tr><td>Nota del evento</td><td><b>${nota.estado === 'calculada' ? `${sobreDiez(nota.valor)}/10` : nota.estado}</b>${nota.motivo ? ` · ${nota.motivo}` : ''}</td></tr>`}
        ${nota.valor_sin_ajuste !== undefined && html`<tr><td>Sin el ajuste</td><td>${sobreDiez(nota.valor_sin_ajuste)}/10</td></tr>`}
        ${nota.partes?.asistencia_permanencia !== undefined && html`<tr><td>Asistencia y permanencia</td><td>${nota.partes.asistencia_permanencia}${nota.partes.asistencia_permanencia < 1 ? ' (se retiró antes)' : ''}</td></tr>`}
        ${partes.length > 0 && html`<tr><td>${evento.tipo === 'taller' ? 'Evaluación del grupo' : 'Rúbrica del grupo'}</td><td>${partes.map((p) => `${p.nombre}: ${p.valor ?? '—'}/${p.max}`).join(' · ')}</td></tr>`}
        ${preparatorio.estado !== 'sin_nota' && html`<tr><td>Preparatorio</td><td>${preparatorio.estado === 'calculada' ? `${preparatorio.nivel}/2` : preparatorio.estado}${preparatorio.motivo ? ` · ${preparatorio.motivo}` : ''}</td></tr>`}
        ${control.estado !== 'sin_control' && html`<tr><td>Control oral</td><td>${control.estado === 'calculada' ? (control.valor !== null ? `${sobreDiez(control.valor)}/10 (${(control.puntajes ?? []).join(', ') || control.motivo})` : (control.aprobado ? 'aprobado' : 'no aprobado')) : control.estado}</td></tr>`}
      </tbody></table>
      ${evento.con_nota && evento.tipo !== 'trabajo_casa' && html`
        <div class="tarjeta">
          <h3>Ajuste individual</h3>
          <p class="tenue pequeno">Reemplaza la nota de este evento para este estudiante. Siempre con motivo.</p>
          <div class="fila-flex">
            <input class="entrada" style="max-width:110px" inputmode="decimal" placeholder="0–10" value=${valor} onInput=${(e) => setValor(e.currentTarget.value)} />
            <input class="entrada crece" placeholder="Motivo" value=${motivo} onInput=${(e) => setMotivo(e.currentTarget.value)} />
          </div>
          <div class="botones">
            ${nota.ajuste && html`<button class="boton" onClick=${async () => { await borrarAjuste(db, evento.id, fila.estudiante.id); cerrar(); }}>Quitar ajuste</button>`}
            <button class="boton primario" disabled=${valor === '' || !motivo.trim()} onClick=${guardar}>Guardar ajuste</button>
          </div>
        </div>`}
      <button class="boton ancho" onClick=${cerrar}>Cerrar</button>
    <//>`;
}
