// Grupo de un evento: evaluación con la rúbrica configurada, pase final de sus integrantes y cierre.
import { useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { html, useApp, Pantalla, Chip, Hoja, Aviso, Cargando, Persona, enlace, ir } from './base.js';
import { useEvento, nombreEvento } from './evento.js';
import {
  agregarEstudianteNuevo, alternarEtiqueta, guardarNotaProfesor, guardarObservacion, guardarPuntaje, marcarAsistencia, moverEstudiante, revisarGrupo,
} from '../datos/acciones.js';
import { gruposDe, notaControl, notaGrupo, rubrica } from '../nucleo/motor.js';
import { grupoNuevo, listaDeGrupos } from '../nucleo/grupos.js';
import { seEvaluaPorGrupo, sobreDiez, textoNotaGrupo } from '../nucleo/motor-vista.js';
import { preparatorioCalifica } from '../nucleo/config.js';
import { HojaVisitante } from './visitantes.js';

export function Grupo({ id, grupo }) {
  const { curso, ctx, evento, cargando } = useEvento(id);
  if (!curso) return html`<${Pantalla} titulo="Grupo" atras="#/"><${Aviso} tono="mal">No existe el evento ${id}.<//><//>`;
  if (cargando || !evento || !ctx) return html`<${Pantalla} titulo=${`Grupo ${grupo}`} atras=${enlace('evento', id, 'grupos')}><${Cargando} /><//>`;
  const grupos = gruposDe(ctx, evento);
  const { grupos: lista } = listaDeGrupos(grupos, ctx.reg.estudiantes);
  const g = lista.find((x) => x.grupo === grupo);
  const i = lista.findIndex((x) => x.grupo === grupo);
  const siguiente = lista[i + 1]?.grupo ?? null;
  const config = evento.config ? ctx.cfg.actividades[evento.config] : null;
  const conRubrica = seEvaluaPorGrupo(evento) && config;

  return html`
    <${Pantalla} titulo=${`Grupo ${grupo}`} subtitulo=${`${nombreEvento(evento)} · ${evento.curso}`} atras=${enlace('evento', id, 'grupos')}>
      ${!g && html`<${Aviso} tono="aviso">El grupo ${grupo} ya no tiene integrantes en este evento.<//>`}
      ${g && conRubrica && html`<${Evaluacion} key=${`ev-${grupo}`} ctx=${ctx} evento=${evento} grupo=${grupo} config=${config} grupos=${grupos} />`}
      ${g && html`<${Integrantes} key=${`in-${grupo}`} ctx=${ctx} evento=${evento} grupo=${grupo} integrantes=${g.integrantes} grupos=${grupos} />`}
      ${g && config && (config.cierre?.length || config.penalizacion_total) && html`<${Cierre} key=${`ci-${grupo}`} ctx=${ctx} evento=${evento} grupo=${grupo} grupos=${grupos} config=${config} />`}
      ${g && html`<${PieListo} ctx=${ctx} evento=${evento} grupo=${grupo} grupos=${grupos} siguiente=${siguiente} />`}
    <//>`;
}

// ---------- Evaluación con la rúbrica ----------

function Evaluacion({ ctx, evento, grupo, config, grupos }) {
  const { db } = useApp();
  const partes = rubrica(ctx.cfg, config);
  const nota = notaGrupo(ctx, evento, grupo);
  const puntos = new Map((ctx.puntajes.get(`${evento.id}|${grupo}`) ?? []).map((p) => [p.aspecto, p.valor]));
  const [abierto, setAbierto] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const penalizado = ctx.revisiones.get(`${evento.id}|${grupo}`)?.penalizacion_total;
  // Tocar un nivel siempre lo elige (un doble toque accidental no borra la nota).
  const elegir = (aspecto, v) => { if (puntos.get(aspecto) !== v) guardarPuntaje(db, evento.id, grupos, grupo, aspecto, v); };
  const borrarTodo = async () => {
    for (const p of partes) await guardarPuntaje(db, evento.id, grupos, grupo, p.id, null);
    setBorrando(false);
  };

  const esTaller = config.tipo === 'taller';
  const [num, den] = nota.completo ? textoNotaGrupo(nota).split('/') : [];
  return html`
    <div class="tarjeta">
      <div class="separado">
        <h2>Evaluación</h2>
        ${penalizado ? html`<${Chip} tono="mal">penalización total · 0<//>`
          : nota.completo ? html`<span class="nota-grande">${num}<span class="tenue pequeno"> /${den}</span></span>`
          : html`<${Chip}>faltan ${nota.faltan?.length ?? partes.length}<//>`}
      </div>
      ${esTaller && html`<p class="tenue pequeno">${explicacionTaller(config)}</p>`}
      ${partes.map((p) => html`
        <div class="criterio">
          <button class="criterio-titulo" onClick=${() => setAbierto(abierto === p.id ? null : p.id)}>
            <span>${p.nombre}</span>
            ${p.peso !== null ? html`<span class="peso">${Math.round(p.peso * 100)} %</span>` : html`<span class="peso">0–${p.max}</span>`}
            <span class="mas">${abierto === p.id ? 'ocultar' : 'ver guía'}</span>
          </button>
          ${abierto === p.id && html`<${Guia} ctx=${ctx} config=${config} parte=${p} />`}
          <div class="niveles">
            ${p.escala.map((v) => html`<button class=${puntos.get(p.id) === v ? 'elegido' : ''} onClick=${() => elegir(p.id, v)}>${v}</button>`)}
          </div>
        </div>`)}
      <${Preguntas} config=${config} abierto=${esTaller} />
      <${Etiquetas} ctx=${ctx} evento=${evento} grupo=${grupo} config=${config} grupos=${grupos} />
      <${NotaTexto} key=${`nota-${evento.id}-${grupo}`} evento=${evento} unidad="grupo" unidadId=${grupo}
        actual=${ctx.reg.notas.find((n) => n.evento === evento.id && n.unidad === 'grupo' && n.unidad_id === grupo)?.texto ?? ''} />
      ${puntos.size > 0 && html`<button class="boton chico" style="align-self:flex-start" onClick=${() => setBorrando(true)}>Borrar los puntajes de este grupo</button>`}
    </div>
    ${borrando && html`
      <${Hoja} titulo=${`¿Borrar los puntajes del grupo ${grupo}?`} alCerrar=${() => setBorrando(false)}>
        <p>Se quitan los puntajes de la rúbrica de este grupo en ${evento.codigo}. Las etiquetas, la nota del profesor y el pase no cambian.</p>
        <div class="botones">
          <button class="boton" onClick=${() => setBorrando(false)}>Cancelar</button>
          <button class="boton peligro-fuerte" onClick=${borrarTodo}>Borrar</button>
        </div>
      <//>`}`;
}

function Guia({ ctx, config, parte }) {
  if (config.tipo === 'taller') {
    return html`
      <div class="ayuda">
        ${config.evaluacion_integral.descripcion && html`<p>${config.evaluacion_integral.descripcion}</p>`}
        ${config.tareas?.length ? html`<b>Tareas del taller</b><ul>${config.tareas.map((t) => html`<li>${t.texto}</li>`)}</ul>` : null}
        <div class="tenue pequeno">Escala ${parte.escala.join(' / ')}: el nivel lo decide el profesor.</div>
      </div>`;
  }
  if (config.criterios) {
    const c = config.criterios.find((x) => x.id === parte.id);
    return html`
      <div class="ayuda">
        ${c.indicadores?.length ? html`<b>Indicadores</b><ul>${c.indicadores.map((t) => html`<li>${t}</li>`)}</ul>` : null}
        <dl>${Object.entries(c.niveles).sort(([a], [b]) => b - a).map(([n, t]) => html`<dt>${n}</dt><dd>${t}</dd>`)}</dl>
      </div>`;
  }
  const asp = ctx.cfg.sqi.aspectos[parte.id];
  const ind = config.indicadores?.[parte.id] ?? [];
  return html`
    <div class="ayuda">
      <div class="tenue pequeno">Aspecto ${asp.tipo}</div>
      ${ind.length ? html`<b>En esta práctica</b><ul>${ind.map((t) => html`<li>${t}</li>`)}</ul>` : null}
      <dl>${Object.entries(asp.descriptores).sort(([a], [b]) => b - a).map(([n, t]) => html`<dt>${n}</dt><dd>${t}</dd>`)}</dl>
    </div>`;
}

function explicacionTaller(config) {
  const pct = (x) => `${Math.round(x * 100)} %`;
  return [config.evaluacion_integral.descripcion,
    `Nota del taller: ${pct(config.pesos.asistencia_permanencia)} asistencia y permanencia (del pase) + ${pct(config.pesos.evaluacion_integral)} esta evaluación del grupo.`]
    .filter(Boolean).join(' ');
}

/** Banco de preguntas para la discusión con el grupo (de la configuración de la actividad). */
function Preguntas({ config, abierto: inicial }) {
  const preguntas = config.preguntas_discusion ?? [];
  const [abierto, setAbierto] = useState(inicial);
  if (!preguntas.length) return null;
  return html`
    <div>
      <button class="criterio-titulo" onClick=${() => setAbierto(!abierto)}>
        <span>Preguntas para la discusión (${preguntas.length})</span><span class="mas">${abierto ? 'ocultar' : 'ver'}</span>
      </button>
      ${abierto && html`<ol class="preguntas-banco">${preguntas.map((p) => html`<li>${p}</li>`)}</ol>`}
    </div>`;
}

function Etiquetas({ ctx, evento, grupo, config, grupos }) {
  const { db } = useApp();
  const etiquetas = config.etiquetas ?? [];
  if (!etiquetas.length) return null;
  const marcadas = new Set(ctx.reg.etiquetas.filter((t) => t.evento === evento.id && t.grupo === grupo).map((t) => t.etiqueta));
  return html`
    <div>
      <div class="seccion-titulo" style="margin-top:4px">Etiquetas rápidas</div>
      <div class="etiquetas">
        ${etiquetas.map((t) => html`
          <button class=${`etiqueta ${t.signo === '+' ? 'pos' : 'neg'} ${marcadas.has(t.id) ? 'elegida' : ''}`}
            onClick=${() => alternarEtiqueta(db, evento.id, grupos, grupo, t.id)}>
            <span class="signo">${t.signo === '+' ? '+' : '−'}</span>${t.texto}
          </button>`)}
      </div>
    </div>`;
}

/** Texto con guardado automático (al escribir, con pausa, y al salir del campo). Admite dictado del teclado. */
export function NotaTexto({ evento, unidad, unidadId, actual, etiqueta = 'Nota del profesor', placeholder = 'Escribe o dicta con el micrófono del teclado…' }) {
  const { db } = useApp();
  const [texto, setTexto] = useState(actual);
  const espera = useRef(null);
  const ultimo = useRef(actual);
  const guardar = async (t) => {
    if (t === ultimo.current) return;
    ultimo.current = t;
    await guardarNotaProfesor(db, evento.id, unidad, unidadId, t);
  };
  useEffect(() => () => clearTimeout(espera.current), []);
  return html`
    <div class="campo">
      <label>${etiqueta}</label>
      <textarea class="entrada" value=${texto} placeholder=${placeholder}
        onInput=${(e) => { const t = e.currentTarget.value; setTexto(t); clearTimeout(espera.current); espera.current = setTimeout(() => guardar(t), 700); }}
        onBlur=${() => { clearTimeout(espera.current); guardar(texto); }} />
    </div>`;
}

// ---------- Integrantes: pase final y observaciones ----------

const OPCIONES = [
  { estado: 'presente', texto: 'Presente', tono: 'ok' },
  { estado: 'no_vino', texto: 'No vino', tono: 'mal' },
  { estado: 'se_retiro_antes', texto: 'Se retiró', tono: 'aviso' },
];

function Integrantes({ ctx, evento, grupo, integrantes, grupos }) {
  const [moviendo, setMoviendo] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const ap = evento.tipo === 'taller' ? ctx.cfg.actividades[evento.config]?.asistencia_permanencia : null;
  return html`
    <div class="seccion-titulo">Integrantes · pase final</div>
    ${ap && html`<p class="tenue pequeno">Asistencia y permanencia: presente 1 · se retiró antes ${ap.se_retiro_antes} · no vino 0. Si alguien está pero no trabaja, anótalo en su observación.</p>`}
    <div class="lista">
      ${integrantes.map((e) => html`<${Integrante} key=${e.id} ctx=${ctx} evento=${evento} estudiante=${e} grupos=${grupos} alMover=${() => setMoviendo(e)} />`)}
    </div>
    <button class="boton ancho" onClick=${() => setAgregando(true)}>+ Agregar integrante</button>
    ${moviendo && html`<${HojaMover} ctx=${ctx} evento=${evento} estudiante=${moviendo} cerrar=${() => setMoviendo(null)} />`}
    ${agregando && html`<${HojaAgregar} ctx=${ctx} evento=${evento} grupo=${grupo} grupos=${grupos} cerrar=${() => setAgregando(false)} />`}`;
}

function Integrante({ ctx, evento, estudiante, grupos, alMover }) {
  const { cfg, db } = useApp();
  const a = ctx.asistencia.get(`${evento.id}|${estudiante.id}`);
  const estado = a?.estado ?? null;
  const paseCerrado = Boolean(ctx.pases.get(evento.id)?.cerrado);
  const [verObs, setVerObs] = useState(Boolean(a?.observacion));
  const novedad = ctx.novedades.get(`${evento.id}|${estudiante.id}`);
  const control = notaControl(ctx, evento, estudiante.id);
  const falta = estado === 'no_vino' || estado === 'salio';
  const marcar = (nuevo) => {
    if (nuevo === estado) return;
    marcarAsistencia(db, evento.id, grupos, estudiante.id, nuevo, null);
  };
  return html`
    <div class=${`integrante ${falta ? 'falta' : ''}`}>
      <div class="separado">
        <${Persona} estudiante=${estudiante} detalle=${html`
          ${novedad && preparatorioCalifica(cfg, ctx.curso.metodologia) && novedad.nivel !== null ? html`<${Chip} tono="aviso">prep. ${novedad.nivel}<//>` : null}
          ${control.estado === 'calculada' ? html`<${Chip} tono="info">control ${control.valor !== null ? sobreDiez(control.valor) : (control.aprobado ? '✓' : '✗')}<//>` : null}`} />
        <button class="boton chico" onClick=${alMover}>Mover</button>
      </div>
      ${estado === 'salio'
        ? html`<div class="separado"><${Chip} tono="mal">Salió (${a.motivo ?? 'control'})<//><span class="tenue pequeno">Se corrige en «Control»</span></div>`
        : html`
          <div class="segmentado" role="group" aria-label="Asistencia">
            ${OPCIONES.map((o) => {
              const elegido = estado === o.estado || (estado === null && o.estado === 'presente');
              const porDefecto = estado === null && o.estado === 'presente';
              return html`<button class=${`${elegido ? `elegido ${o.tono}` : ''} ${porDefecto && !paseCerrado ? 'por-defecto' : ''}`} onClick=${() => marcar(o.estado)}>${o.texto}</button>`;
            })}
          </div>
          ${a?.motivo && estado === 'no_vino' ? html`<span class="tenue pequeno">Motivo: ${a.motivo}</span>` : null}`}
      ${verObs
        ? html`<${Observacion} key=${`obs-${evento.id}-${estudiante.id}`} evento=${evento} estudiante=${estudiante} actual=${a?.observacion ?? ''} />`
        : html`<button class="boton chico" style="align-self:flex-start" onClick=${() => setVerObs(true)}>+ Observación</button>`}
    </div>`;
}

function Observacion({ evento, estudiante, actual }) {
  const { cfg, db } = useApp();
  const [texto, setTexto] = useState(actual);
  const espera = useRef(null);
  const guardar = (t) => guardarObservacion(db, evento.id, estudiante.id, t);
  const frases = cfg.asistencia.frases_observacion;
  const alternarFrase = (f) => {
    const partes = texto.split(';').map((x) => x.trim()).filter(Boolean);
    const nuevo = partes.includes(f) ? partes.filter((x) => x !== f) : [...partes, f];
    const t = nuevo.join('; ');
    setTexto(t);
    guardar(t);
  };
  useEffect(() => () => clearTimeout(espera.current), []);
  return html`
    <div class="frases">${frases.map((f) => html`<button class=${texto.includes(f) ? 'elegida' : ''} onClick=${() => alternarFrase(f)}>${f}</button>`)}</div>
    <input class="entrada" value=${texto} placeholder="Observación (no cambia la nota)"
      onInput=${(e) => { const t = e.currentTarget.value; setTexto(t); clearTimeout(espera.current); espera.current = setTimeout(() => guardar(t), 700); }}
      onBlur=${() => { clearTimeout(espera.current); guardar(texto); }} />`;
}

/** Mover a un estudiante a otro grupo (o sacarlo de todos). El cambio pasa a los eventos siguientes. */
export function HojaMover({ ctx, evento, estudiante, cerrar }) {
  const { db, avisar } = useApp();
  const grupos = gruposDe(ctx, evento);
  const { grupos: lista } = listaDeGrupos(grupos, ctx.reg.estudiantes);
  const actual = grupos.get(estudiante.id) ?? null;
  const nuevo = grupoNuevo(grupos);
  const mover = async (g) => {
    await moverEstudiante(db, evento.id, grupos, estudiante.id, g);
    cerrar();
    avisar(g === null ? `${estudiante.nombre.split(' ')[0]} quedó sin grupo.` : `${estudiante.nombre.split(' ')[0]} pasó al grupo ${g}.`);
  };
  return html`
    <${Hoja} titulo="Mover de grupo" alCerrar=${cerrar}>
      <${Persona} estudiante=${estudiante} detalle=${html`<span>· ${actual === null ? 'sin grupo' : `grupo ${actual}`}</span>`} />
      <p class="tenue pequeno">El cambio se conserva para los eventos siguientes.</p>
      <div class="lista">
        ${lista.filter((g) => g.grupo !== actual).map((g) => html`
          <button class="fila" onClick=${() => mover(g.grupo)}>
            <span class="grupo-num">${g.grupo}</span>
            <div class="principal"><div class="linea1">${g.integrantes.map((e) => e.nombre.split(' ')[0]).join(' · ')}</div>
            <div class="linea2">${g.integrantes.length} integrantes</div></div>
          </button>`)}
        <button class="fila" onClick=${() => mover(nuevo)}>
          <span class="grupo-num vacio">+</span><div class="principal"><div class="linea1">Grupo nuevo (${nuevo})</div></div>
        </button>
        ${actual !== null && html`
          <button class="fila" onClick=${() => mover(null)}>
            <span class="grupo-num vacio">–</span><div class="principal"><div class="linea1">Sin grupo</div><div class="linea2">al cerrar el pase cuenta como «no vino»</div></div>
          </button>`}
      </div>
      <button class="boton ancho" onClick=${cerrar}>Cancelar</button>
    <//>`;
}

function HojaAgregar({ ctx, evento, grupo, grupos, cerrar }) {
  const { db } = useApp();
  const [visitante, setVisitante] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  if (visitante) return html`<${HojaVisitante} evento=${evento} grupo=${grupo} grupos=${grupos} alCerrar=${cerrar} />`;
  if (nuevo) return html`<${HojaEstudianteNuevo} evento=${evento} grupo=${grupo} grupos=${grupos} alCerrar=${cerrar} />`;
  const { grupos: lista, sinGrupo } = listaDeGrupos(grupos, ctx.reg.estudiantes);
  const deOtros = lista.filter((g) => g.grupo !== grupo).flatMap((g) => g.integrantes.map((e) => ({ e, g: g.grupo })));
  const agregar = async (e) => { await moverEstudiante(db, evento.id, grupos, e.id, grupo); cerrar(); };
  return html`
    <${Hoja} titulo=${`Agregar al grupo ${grupo}`} alCerrar=${cerrar}>
      ${sinGrupo.length > 0 && html`
        <div class="seccion-titulo">Sin grupo</div>
        <div class="lista">${sinGrupo.map((e) => html`<button class="fila" onClick=${() => agregar(e)}><${Persona} estudiante=${e} /></button>`)}</div>`}
      <div class="seccion-titulo">De otros grupos</div>
      <div class="lista">${deOtros.map(({ e, g }) => html`<button class="fila" onClick=${() => agregar(e)}><${Persona} estudiante=${e} detalle=${html`<span>· grupo ${g}</span>`} /></button>`)}</div>
      <button class="boton ancho" onClick=${() => setNuevo(true)}>+ Estudiante nuevo en este curso (no está en el Excel)…</button>
      ${evento.con_nota && html`<button class="boton ancho" onClick=${() => setVisitante(true)}>+ Estudiante de otro curso (recupera aquí)…</button>`}
      <button class="boton ancho" onClick=${cerrar}>Cancelar</button>
    <//>`;
}

/** Estudiante que se suma al curso y no está en el Excel (por ejemplo, de matrícula extraordinaria). */
function HojaEstudianteNuevo({ evento, grupo, grupos, alCerrar }) {
  const { db, avisar } = useApp();
  const [datos, setDatos] = useState({ codigo: '', nombre: '' });
  const campo = (k, etiqueta, extra = {}) => html`
    <div class="campo"><label>${etiqueta}</label>
      <input class="entrada" value=${datos[k]} onInput=${(e) => setDatos({ ...datos, [k]: e.currentTarget.value })} ...${extra} /></div>`;
  const guardar = async () => {
    try {
      await agregarEstudianteNuevo(db, evento.id, grupos, grupo, datos);
      avisar(`Agregado a ${evento.curso}, grupo ${grupo}.`, 'ok');
      alCerrar();
    } catch (e) { avisar(e.message, 'mal'); }
  };
  return html`
    <${Hoja} titulo=${`Estudiante nuevo · grupo ${grupo}`} alCerrar=${alCerrar}>
      <p class="tenue pequeno">Se suma a ${evento.curso} desde esta sesión (por ejemplo, de matrícula extraordinaria). Queda <b>pendiente de nómina</b>:
        se evalúa como los demás, sigue en los eventos siguientes con su grupo y va a las hojas de la app en ámbar.
        Leer el Excel no lo da de baja; cuando aparezca en el Excel, pasa a ser uno más.</p>
      ${campo('codigo', 'Código único', { inputmode: 'numeric', autocomplete: 'off' })}
      ${campo('nombre', 'Apellidos y nombres', { autocapitalize: 'characters', autocomplete: 'off' })}
      <div class="botones">
        <button class="boton" onClick=${alCerrar}>Cancelar</button>
        <button class="boton primario" disabled=${!datos.codigo.trim() || !datos.nombre.trim()} onClick=${guardar}>Agregar</button>
      </div>
    <//>`;
}

// ---------- Cierre del grupo ----------

function Cierre({ ctx, evento, grupo, grupos, config }) {
  const { db } = useApp();
  const conFirma = config.cierre?.includes('trabajo_firmado');
  const conPenalizacion = Boolean(config.penalizacion_total);
  const rev = ctx.revisiones.get(`${evento.id}|${grupo}`) ?? {};
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState('No desmontó ni guardó el equipo');
  return html`
    <div class="tarjeta">
      ${conFirma && html`<label class="interruptor">
        <span><b>Trabajo firmado</b><br /><span class="tenue pequeno">Revisado y firmado al final de la clase</span></span>
        <input type="checkbox" checked=${Boolean(rev.trabajo_firmado)} onChange=${(e) => revisarGrupo(db, evento.id, grupos, grupo, { trabajo_firmado: e.currentTarget.checked })} />
      </label>`}
      ${conPenalizacion && html`<label class="interruptor">
        <span><b>Penalización total</b><br /><span class="tenue pequeno">${rev.penalizacion_total ? `0 en la práctica · ${rev.motivo_penalizacion}` : 'Si el grupo no desmonta y guarda el equipo (opcional)'}</span></span>
        <input type="checkbox" checked=${Boolean(rev.penalizacion_total)}
          onChange=${(e) => (e.currentTarget.checked ? setPidiendoMotivo(true) : revisarGrupo(db, evento.id, grupos, grupo, { penalizacion_total: false, motivo_penalizacion: null }))} />
      </label>`}
    </div>
    ${pidiendoMotivo && html`
      <${Hoja} titulo="Penalización total" alCerrar=${() => setPidiendoMotivo(false)}>
        <p>El grupo ${grupo} quedará con <b>0 en ${evento.codigo}</b>. Es a criterio del profesor.</p>
        <div class="campo"><label>Motivo</label><input class="entrada" value=${motivo} onInput=${(e) => setMotivo(e.currentTarget.value)} /></div>
        <div class="botones">
          <button class="boton" onClick=${() => setPidiendoMotivo(false)}>Cancelar</button>
          <button class="boton peligro-fuerte" disabled=${!motivo.trim()} onClick=${async () => { await revisarGrupo(db, evento.id, grupos, grupo, { penalizacion_total: true, motivo_penalizacion: motivo.trim() }); setPidiendoMotivo(false); }}>Aplicar</button>
        </div>
      <//>`}`;
}

function PieListo({ ctx, evento, grupo, grupos, siguiente }) {
  const { db } = useApp();
  const verificado = ctx.revisiones.get(`${evento.id}|${grupo}`)?.verificado;
  const listo = async () => {
    await revisarGrupo(db, evento.id, grupos, grupo, { verificado: true });
    if (siguiente) ir('evento', evento.id, 'grupo', siguiente);
    else ir('evento', evento.id, 'grupos');
  };
  return html`
    <div class="pie-fijo">
      <button class="boton primario grande" onClick=${listo}>${verificado ? '✓ ' : ''}Listo · ${siguiente ? `grupo ${siguiente} ›` : 'volver a los grupos'}</button>
    </div>`;
}
