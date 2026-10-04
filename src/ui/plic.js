// PLIC (Fase 6): examen presencial del 2.º bimestre, controlado por un profesor. Por estudiante: completó de forma
// válida (0.5) o no (0). Casi todos lo completan: un botón marca a los que faltan y después se corrigen las excepciones.
import { useState } from '../vendor/preact-htm.js';
import { html, useApp, Hoja, Persona } from './base.js';
import { marcarPlic, marcarPlicVarios } from '../datos/acciones.js';
import { activos } from '../nucleo/grupos.js';
import { esquemaDe } from '../nucleo/config.js';
import { fechaLarga } from '../nucleo/util.js';

export function Plic({ ctx, evento }) {
  const { cfg, db, avisar } = useApp();
  const [confirmando, setConfirmando] = useState(false);
  const estudiantes = activos(ctx.reg.estudiantes).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const valor = esquemaDe(cfg, ctx.curso.metodologia, evento.bimestre)?.componentes.find((c) => c.id === 'plic')?.valor ?? 0.5;
  const estado = (id) => ctx.plic.get(id)?.completo_valido ?? null;
  const sinRegistrar = estudiantes.filter((e) => estado(e.id) === null);
  const validos = estudiantes.filter((e) => estado(e.id) === true).length;
  const marcarTodos = async () => {
    await marcarPlicVarios(db, evento.id, sinRegistrar.map((e) => e.id), true);
    setConfirmando(false);
    avisar(`${sinRegistrar.length} marcados como «completó».`, 'ok');
  };
  const p = cfg.semestre.plic;
  return html`
    <p class="tenue pequeno">
      ${fechaLarga(p.fecha)}, ${p.inicio}–${p.fin}: examen presencial, controlado por un profesor. Vale ${valor} si lo completó de forma
      individual, íntegra y reflexiva; 0 si no participó, no lo terminó o respondió al azar.
    </p>
    <div class="resumen-numeros">
      <div><b>${validos}</b><span>completaron</span></div>
      <div><b>${estudiantes.length - validos - sinRegistrar.length}</b><span>no válido</span></div>
      <div><b>${sinRegistrar.length}</b><span>sin registrar</span></div>
    </div>
    ${sinRegistrar.length > 0 && html`
      <button class="boton primario grande" onClick=${() => setConfirmando(true)}>
        Marcar ${sinRegistrar.length === estudiantes.length ? 'a todos' : `a los ${sinRegistrar.length} sin registrar`} como «completó»
      </button>`}
    <div class="lista">
      ${estudiantes.map((e) => {
        const v = estado(e.id);
        return html`
          <div class=${`integrante ${v === false ? 'falta' : ''}`} key=${e.id}>
            <${Persona} estudiante=${e} />
            <div class="segmentado" role="group" aria-label="PLIC">
              <button class=${v === true ? 'elegido ok' : ''} onClick=${() => v !== true && marcarPlic(db, evento.id, e.id, true)}>Completó · ${valor}</button>
              <button class=${v === false ? 'elegido mal' : ''} onClick=${() => v !== false && marcarPlic(db, evento.id, e.id, false)}>No válido · 0</button>
            </div>
          </div>`;
      })}
    </div>
    ${confirmando && html`
      <${Hoja} titulo="¿Marcar como «completó»?" alCerrar=${() => setConfirmando(false)}>
        <p>Los ${sinRegistrar.length} estudiantes sin registrar quedarán con el PLIC completo (${valor}). Después marca «No válido» a quien no participó, no lo terminó o respondió al azar.</p>
        <div class="botones">
          <button class="boton" onClick=${() => setConfirmando(false)}>Cancelar</button>
          <button class="boton primario" onClick=${marcarTodos}>Marcar</button>
        </div>
      <//>`}`;
}
