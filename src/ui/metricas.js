// Métricas (Fase 8): tablero por alcance (todos los cursos, una metodología o un curso) y periodo, con dos vistas:
// «Para presentar» (agregada, sin nombres; es la que se exporta como imagen o PDF) y «Profesor» (agrega quién falta,
// quién está en riesgo y los grupos por revisar, con nombres). Las secciones salen de src/nucleo/tablero.js.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from '../vendor/preact-htm.js';
import { html, useApp, useVivo, Pantalla, Aviso, Cargando, Chip, Hoja, enlace } from './base.js';
import { cargarCursos } from '../datos/excel-datos.js';
import { alcances, calcularMetricas } from '../nucleo/metricas.js';
import { laminaContinua, laminaEnPaginas, seccionesDelTablero, textoPeriodo } from '../nucleo/tablero.js';
import { documento } from '../nucleo/graficos.js';
import { bimestreEnCurso } from '../nucleo/bimestre.js';
import { fechaLarga, hoyLocal } from '../nucleo/util.js';
import { compartirODescargar } from './archivos.js';
import { pdfDeLamina, pngDeLamina } from './exportar-lamina.js';

const PERIODOS = [{ id: 1, texto: '1.er bim.' }, { id: 2, texto: '2.º bim.' }, { id: null, texto: 'Semestre' }];
const apellidos = (n) => String(n).split(' ').filter(Boolean).slice(0, 2).join(' ');

export function Metricas({ alcance: inicial }) {
  const { cfg, db, demo } = useApp();
  const hoy = hoyLocal();
  const opciones = alcances(cfg);
  const [alcance, setAlcance] = useState(opciones.some((o) => o.id === inicial) ? inicial : 'todos');
  const [bimestre, setBimestre] = useState(() => bimestreEnCurso(cfg, hoy)?.bimestre ?? null);
  const [vista, setVista] = useState('presentar');
  const cursos = useVivo(() => cargarCursos(db, cfg), []);
  const m = useMemo(() => (cursos ? calcularMetricas(cfg, cursos, { alcance, bimestre, hoy }) : null), [cursos, alcance, bimestre]);
  const elegido = opciones.find((o) => o.id === alcance);
  const atras = cfg.cursoPorId[inicial] ? enlace('curso', inicial) : '#/';
  const subtitulo = `${elegido.texto} · ${textoPeriodo(bimestre)}`;
  if (!m) return html`<${Pantalla} titulo="Métricas" subtitulo=${subtitulo} atras=${atras}><${Cargando} /><//>`;

  const secciones = seccionesDelTablero(m, cfg);
  const profesor = vista === 'profesor';
  const cabecera = {
    titulo: `Métricas · Lab. MN ${cfg.semestre.semestre}`,
    detalle: `${elegido.id === 'todos' ? 'Todos los cursos' : elegido.texto}${elegido.id === 'todos' ? '' : ` (${elegido.detalle})`} · ${textoPeriodo(bimestre)}`,
    fecha: fechaLarga(hoy).replace(/^\S+ /, ''),
    demo,
    presentar: cfg.metricas.advertencias.presentar,
  };

  return html`
    <${Pantalla} titulo="Métricas" subtitulo=${subtitulo} atras=${atras}>
      <div class="tarjeta">
        <div class="campo">
          <label for="alcance-metricas">Cursos</label>
          <select id="alcance-metricas" class="entrada" value=${alcance} onChange=${(e) => setAlcance(e.currentTarget.value)}>
            ${opciones.map((o) => html`<option value=${o.id}>${o.texto} · ${o.detalle}</option>`)}
          </select>
        </div>
        <div class="segmentado" role="group" aria-label="Periodo">
          ${PERIODOS.map((p) => html`<button class=${bimestre === p.id ? 'elegido ok' : ''} onClick=${() => setBimestre(p.id)}>${p.texto}</button>`)}
        </div>
        <div class="segmentado" role="group" aria-label="Vista">
          <button class=${!profesor ? 'elegido ok' : ''} onClick=${() => setVista('presentar')}>Para presentar</button>
          <button class=${profesor ? 'elegido aviso' : ''} onClick=${() => setVista('profesor')}>Profesor (con nombres)</button>
        </div>
        <p class="tenue pequeno">${profesor
          ? 'Vista del profesor: agrega quién falta, quién está en riesgo y los grupos por revisar, con nombres. No la proyectes.'
          : cfg.metricas.advertencias.presentar}</p>
      </div>

      ${m.vacio && html`
        <${Aviso} tono="aviso" titulo="Aún no hay nada registrado aquí">
          Las métricas se arman con los pases cerrados, las rúbricas, los TC y los controles de este alcance y periodo.
          ${demo ? html` Para probarlas, simula clases ficticias en <a class="negrita" href=${enlace('datos')}>Datos</a>.` : ''}
        <//>`}

      ${!m.vacio && secciones.map((s) => (s.id === 'advertencias'
        ? html`<div class="tarjeta"><h2>${s.titulo}</h2>${m.advertencias.map((a) => html`<${Aviso} tono="aviso">${a.texto}<//>`)}</div>`
        : html`
          <div class="tarjeta" key=${s.id}>
            <h2>${s.titulo}</h2>
            ${s.nota && html`<p class="tenue pequeno">${s.nota}</p>`}
            <${Grafico} dibujar=${s.dibujar} titulo=${s.titulo} />
            ${profesor && s.id === 'asistencia-eventos' && html`<${FaltasPorEstudiante} m=${m} />`}
            ${profesor && s.id === 'riesgo' && html`<${Riesgo} m=${m} />`}
          </div>`))}

      ${!m.vacio && html`<${Exportar} secciones=${secciones} cabecera=${cabecera} nombre=${`metricas-lab-mn-${cfg.semestre.semestre}-${alcance}-${bimestre ? `B${bimestre}` : 'semestre'}-${hoy}`} />`}
    <//>`;
}

/** Un gráfico SVG al ancho real de su tarjeta (se vuelve a dibujar si cambia el ancho). */
function Grafico({ dibujar, titulo }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const c = caja.current;
    if (!c) return undefined;
    const medir = () => setAncho(Math.floor(c.clientWidth));
    medir();
    const o = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    o?.observe(c);
    return () => o?.disconnect();
  }, []);
  const svg = ancho > 0 ? documento(dibujar(ancho), ancho, { titulo }) : '';
  return html`<div class="grafico" ref=${caja} dangerouslySetInnerHTML=${{ __html: svg }} />`;
}

/** Vista del profesor: estudiantes con faltas o retiros en el periodo. */
function FaltasPorEstudiante({ m }) {
  const [todos, setTodos] = useState(false);
  const filas = m.asistencia.porEstudiante.filter((x) => x.faltas || x.retiros);
  if (!filas.length) return html`<p class="tenue pequeno">Nadie faltó ni se retiró antes en este periodo.</p>`;
  const visibles = todos ? filas : filas.slice(0, 12);
  return html`
    <div class="solo-profesor">
      <div class="separado"><h3>Quién falta</h3><${Chip} tono="aviso">con nombres<//></div>
      <div class="desplazable">
        <table class="tabla">
          <thead><tr><th>Estudiante</th>${!m.unCurso && html`<th>Curso</th>`}<th class="num">Faltas</th><th>Dónde</th></tr></thead>
          <tbody>
            ${visibles.map((x) => html`
              <tr>
                <td>${apellidos(x.estudiante.nombre)}</td>
                ${!m.unCurso && html`<td>${x.curso}</td>`}
                <td class="num">${x.faltas}${x.retiros ? html`<span class="tenue"> +${x.retiros}r</span>` : ''}</td>
                <td class="pequeno">${[...x.faltasEn, ...x.retirosEn.map((c) => `${c} (se retiró)`)].join(', ')}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
      ${filas.length > 12 && html`<button class="boton chico" onClick=${() => setTodos(!todos)}>${todos ? 'Ver menos' : `Ver los ${filas.length}`}</button>`}
      <p class="tenue pequeno">r = se retiró antes. Cuenta todas las sesiones con pase cerrado del periodo, también las sin nota.</p>
    </div>`;
}

/** Vista del profesor: estudiantes en riesgo y grupos por revisar, con el motivo. */
function Riesgo({ m }) {
  const { estudiantes, grupos } = m.riesgo;
  const [todos, setTodos] = useState(false);
  if (!estudiantes.length && !grupos.length) return html`<p class="tenue pequeno">Nadie en riesgo con los umbrales actuales.</p>`;
  const visibles = todos ? estudiantes : estudiantes.slice(0, 15);
  return html`
    <div class="solo-profesor">
      <div class="separado"><h3>Estudiantes (${estudiantes.length})</h3><${Chip} tono="aviso">con nombres<//></div>
      <ul class="lista-riesgo">
        ${visibles.map((x) => html`
          <li key=${x.estudiante.id}>
            <div><a class="enlace negrita" href=${enlace('curso', x.curso, 'notas')}>${x.estudiante.nombre}</a><span class="tenue pequeno"> · ${x.curso}</span></div>
            <div class="fila-flex">${x.motivos.map((k) => html`<${Chip} tono=${k.tipo === 'control' ? 'info' : 'mal'}>${k.texto}<//>`)}</div>
          </li>`)}
      </ul>
      ${estudiantes.length > 15 && html`<button class="boton chico" onClick=${() => setTodos(!todos)}>${todos ? 'Ver menos' : `Ver los ${estudiantes.length}`}</button>`}
      ${grupos.length > 0 && html`
        <h3>Grupos por revisar (${grupos.length})</h3>
        <ul class="lista-riesgo">
          ${grupos.map((g) => html`
            <li key=${`${g.curso}|${g.grupo}`}>
              <div><span class="negrita">${g.curso} · Grupo ${g.grupo}</span><span class="tenue pequeno"> · ${g.integrantes.map((e) => e.nombre.split(' ')[0]).join(', ')}</span></div>
              <div class="fila-flex">${g.motivos.map((k) => html`<${Chip} tono="mal">${k.texto}<//>`)}</div>
            </li>`)}
        </ul>`}
    </div>`;
}

/** Exportar la lámina para presentar (solo datos agregados) como imagen o PDF. */
function Exportar({ secciones, cabecera, nombre }) {
  const { avisar } = useApp();
  const [ocupado, setOcupado] = useState(null);
  const [listo, setListo] = useState(null);   // en el iPhone: archivo preparado, para compartirlo con un toque
  useEffect(() => setListo(null), [nombre]);
  const tactil = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  const preparar = async (tipo) => {
    setOcupado(tipo);
    try {
      const archivo = tipo === 'pdf'
        ? { nombre: `${nombre}.pdf`, blob: await pdfDeLamina(laminaEnPaginas(secciones, cabecera), cabecera.titulo), tipo: 'application/pdf' }
        : { nombre: `${nombre}.png`, blob: await pngDeLamina(laminaContinua(secciones, cabecera)), tipo: 'image/png' };
      if (tactil) setListo(archivo);
      else { await compartirODescargar(archivo.nombre, archivo.blob, archivo.tipo); avisar(`Guardado: ${archivo.nombre}`, 'ok'); }
    } catch (e) {
      console.error(e);
      avisar(e.message || String(e), 'mal');
    } finally {
      setOcupado(null);
    }
  };
  const compartir = async () => {
    const r = await compartirODescargar(listo.nombre, listo.blob, listo.tipo);
    if (r !== 'cancelado') setListo(null);
  };

  return html`
    <div class="tarjeta">
      <h2>Exportar para presentar</h2>
      <p class="tenue pequeno">Una lámina con las secciones de arriba, solo con datos agregados y sin nombres, siempre con las advertencias. Sirve para una reunión o para enviarla por correo.</p>
      <div class="botones">
        <button class="boton" disabled=${!!ocupado} onClick=${() => preparar('png')}>${ocupado === 'png' ? 'Preparando…' : 'Imagen (PNG)'}</button>
        <button class="boton primario" disabled=${!!ocupado} onClick=${() => preparar('pdf')}>${ocupado === 'pdf' ? 'Preparando…' : 'PDF'}</button>
      </div>
      ${listo && html`
        <${Hoja} titulo="Lámina lista" alCerrar=${() => setListo(null)}>
          <p>${listo.nombre} · ${Math.max(1, Math.round(listo.blob.size / 1024))} KB</p>
          <div class="botones">
            <button class="boton" onClick=${() => setListo(null)}>Cerrar</button>
            <button class="boton primario" onClick=${compartir}>Compartir o guardar</button>
          </div>
        <//>`}
    </div>`;
}
