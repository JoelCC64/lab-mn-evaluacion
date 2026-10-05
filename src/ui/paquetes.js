// Pasar eventos entre dispositivos (Fase 9): elegir y enviar un paquete, abrirlo en el otro dispositivo con la
// comparación de lo que cambia, y entregar archivos (compartir en el iPhone, descargar en la Mac).
import { useEffect, useMemo, useState } from '../vendor/preact-htm.js';
import { html, useApp, Aviso, Cargando, Hoja } from './base.js';
import { nombreEvento } from './evento.js';
import { compartirODescargar } from './archivos.js';
import { leerArchivoDeRespaldo } from './respaldo-dia.js';
import { leerLocal } from '../datos/local.js';
import { validarRespaldo } from '../datos/respaldo.js';
import {
  FORMATO_PAQUETE, aplicarPaquete, compararPaquete, exportarPaquete, nombreArchivoPaquete, resumenPorEvento, validarPaquete,
} from '../datos/paquete.js';
import { generarEventos } from '../nucleo/calendario.js';
import { fechaCorta, hoyLocal } from '../nucleo/util.js';
import { VERSION_APP } from '../version.js';

/** «hoy 15:30» o «lun 5 oct 15:30». */
export function momentoCorto(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  return hoyLocal(d) === hoyLocal() ? `hoy ${hora}` : `${fechaCorta(hoyLocal(d))} ${hora}`;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const tamano = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Eventos de la configuración por id (los nombres no dependen de los cambios de calendario). */
export function useEventosPorId() {
  const { cfg } = useApp();
  return useMemo(() => new Map(cfg.cursos.flatMap((c) => generarEventos(cfg, c, []).map((e) => [e.id, e]))), [cfg]);
}

const textoEvento = (porId, id) => {
  const e = porId.get(id);
  return e ? `${e.curso} · ${nombreEvento(e)}` : id;
};

/**
 * Entrega de un archivo ya preparado ({ nombre, blob, tipo, alEntregar? }). En la Mac se descarga enseguida. En el
 * iPhone, la hoja de compartir pide un toque reciente: se muestra «Archivo listo» y se comparte con un segundo toque.
 * Devuelve { entregar, hoja }: `hoja` se pinta en el componente que usa el gancho.
 */
export function useEntrega() {
  const { avisar } = useApp();
  const [listo, setListo] = useState(null);
  const tactil = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const enviar = async (archivo) => {
    const r = await compartirODescargar(archivo.nombre, archivo.blob, archivo.tipo);
    if (r === 'cancelado') return false;
    archivo.alEntregar?.(r);
    avisar(r === 'compartido' ? `Listo: ${archivo.nombre}` : `Guardado: ${archivo.nombre}`, 'ok');
    return true;
  };
  const entregar = async (archivo) => { if (tactil) setListo(archivo); else await enviar(archivo); };
  const hoja = listo && html`
    <${Hoja} titulo="Archivo listo" alCerrar=${() => setListo(null)}>
      <p><b>${listo.nombre}</b> · ${tamano(listo.blob.size)}</p>
      ${listo.detalle && html`<p class="tenue pequeno">${listo.detalle}</p>`}
      <div class="botones">
        <button class="boton" onClick=${() => setListo(null)}>Cerrar</button>
        <button class="boton primario" onClick=${async () => { if (await enviar(listo)) setListo(null); }}>Compartir o guardar</button>
      </div>
    <//>`;
  return { entregar, hoja };
}

/** Paquete con los eventos `ids`, listo para entregar. */
export async function prepararPaquete({ cfg, db, demo, ids }) {
  const paquete = await exportarPaquete(db, ids, { semestre: cfg.semestre.semestre, app: VERSION_APP, config: cfg.version, demo });
  const nombre = nombreArchivoPaquete(cfg.semestre.semestre + (demo ? '-demo' : ''), paquete.eventos, new Date(paquete.creado));
  return {
    nombre, tipo: 'application/json', blob: new Blob([JSON.stringify(paquete)], { type: 'application/json' }),
    detalle: 'Ábrelo en el otro dispositivo: Datos › «Recibir eventos…». Tiene datos de estudiantes.',
  };
}

/** Hoja para elegir los eventos y enviarlos en un paquete. */
export function EnviarEventos({ cerrar }) {
  const { cfg, db, demo, avisar } = useApp();
  const porId = useEventosPorId();
  const { entregar, hoja } = useEntrega();
  const [datos, setDatos] = useState(null);
  const [elegidos, setElegidos] = useState(new Set());
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const resumen = await resumenPorEvento(db);
      const desde = (await leerLocal(db, 'respaldo_importado'))?.creado ?? null;
      const hoy = hoyLocal();
      const cursos = cfg.cursos.map((c) => ({
        curso: c,
        eventos: generarEventos(cfg, c, []).filter((e) => resumen.has(e.id)).map((e) => ({ evento: e, ...resumen.get(e.id) })),
      })).filter((c) => c.eventos.length);
      const marcados = cursos.flatMap((c) => c.eventos)
        .filter((x) => x.ultimo && (desde ? x.ultimo > desde : hoyLocal(new Date(x.ultimo)) === hoy))
        .map((x) => x.evento.id);
      setDatos({ cursos, desde });
      setElegidos(new Set(marcados));
    })().catch((e) => { console.error(e); avisar(e.message || String(e), 'mal'); });
  }, []);

  const todos = () => datos?.cursos.flatMap((c) => c.eventos.map((x) => x.evento.id)) ?? [];
  const alternar = (id) => {
    const s = new Set(elegidos);
    if (s.has(id)) s.delete(id); else s.add(id);
    setElegidos(s);
  };
  const enviar = async () => {
    setOcupado(true);
    try {
      const ids = todos().filter((id) => elegidos.has(id));
      await entregar(await prepararPaquete({ cfg, db, demo, ids }));
    } catch (e) { console.error(e); avisar(e.message || String(e), 'mal'); } finally { setOcupado(false); }
  };

  return html`
    <${Hoja} titulo="Enviar eventos a otro dispositivo" alCerrar=${cerrar}>
      <p class="tenue pequeno">
        El paquete lleva todo lo registrado en esos eventos. El otro dispositivo los reemplaza por lo que lleva el
        paquete: antes muestra qué cambia y pide confirmación. Lo demás no se toca.
      </p>
      ${!datos ? html`<${Cargando} />` : !datos.cursos.length ? html`<${Aviso}>Aún no hay nada registrado en este dispositivo.<//>` : html`
        <p class="pequeno">${datos.desde
          ? `Ya marcados: los que cambiaron aquí después del respaldo que restauraste (creado ${momentoCorto(datos.desde)}).`
          : 'Ya marcados: los que cambiaron hoy.'}</p>
        <div class="fila-flex">
          <button class="boton chico" onClick=${() => setElegidos(new Set(todos()))}>Todos</button>
          <button class="boton chico" onClick=${() => setElegidos(new Set())}>Ninguno</button>
        </div>
        <div class="lista-eleccion">
          ${datos.cursos.map((c) => html`
            <div class="seccion-titulo">${c.curso.paralelo}</div>
            ${c.eventos.map((x) => html`
              <label class="interruptor">
                <span><b>${nombreEvento(x.evento)}</b><br />
                  <span class="tenue pequeno">${plural(x.registros, 'registro', 'registros')} · último cambio ${momentoCorto(x.ultimo)}</span></span>
                <input type="checkbox" checked=${elegidos.has(x.evento.id)} onChange=${() => alternar(x.evento.id)} />
              </label>`)}`)}
        </div>`}
      <div class="botones pie-hoja">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        <button class="boton primario" disabled=${ocupado || !elegidos.size} onClick=${enviar}>
          ${ocupado ? 'Preparando…' : elegidos.size ? `Enviar ${plural(elegidos.size, 'evento', 'eventos')}` : 'Elige eventos'}
        </button>
      </div>
      ${hoja}
    <//>`;
}

/**
 * Lee un archivo elegido en «Restaurar un respaldo…» o «Recibir eventos…» y prepara su vista: { tipo: 'respaldo' |
 * 'paquete', nombre, obj, errores }.
 */
export async function abrirArchivoDeDatos(archivo, { cfg, db, demo }) {
  const obj = await leerArchivoDeRespaldo(archivo);
  if (obj?.formato === FORMATO_PAQUETE) return { tipo: 'paquete', nombre: archivo.name, obj, errores: await validarPaquete(obj, db, cfg, { demo }) };
  return { tipo: 'respaldo', nombre: archivo.name, obj, errores: validarRespaldo(obj, db, { semestre: cfg.semestre.semestre }) };
}

function textoComparacion(c) {
  if (!c.llega && !c.aqui) return 'Sin registros aquí ni en el paquete.';
  if (!c.llega) return `El paquete no trae registros: se borra lo de aquí (${plural(c.aqui, 'registro', 'registros')}).`;
  if (!c.aqui) return `Nuevo aquí: ${plural(c.llega, 'registro', 'registros')} (último cambio ${momentoCorto(c.ultimoLlega)}).`;
  if (c.igual) return 'Igual a lo que hay aquí.';
  return `Aquí: ${plural(c.aqui, 'registro', 'registros')} (último cambio ${momentoCorto(c.ultimoAqui)}). `
    + `Paquete: ${plural(c.llega, 'registro', 'registros')} (último cambio ${momentoCorto(c.ultimoLlega)}).`;
}

/** Confirmación al recibir un paquete: qué cambia en cada evento y si se perdería algo de aquí. */
export function VistaPaquete({ vista, cerrar }) {
  const { db, avisar } = useApp();
  const porId = useEventosPorId();
  const { obj, errores, nombre } = vista;
  const [comparacion, setComparacion] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (errores.length) return;
    (async () => {
      const desde = (await leerLocal(db, 'respaldo_importado'))?.creado ?? null;
      setComparacion(await compararPaquete(db, obj, { desde }));
    })().catch((e) => { console.error(e); avisar(e.message || String(e), 'mal'); });
  }, []);

  const cambian = comparacion?.filter((c) => !c.igual) ?? [];
  const conPerdidas = comparacion?.filter((c) => c.perdidos > 0) ?? [];
  const aplicar = async () => {
    setOcupado(true);
    try {
      await aplicarPaquete(db, obj);
      cerrar();
      avisar(`Listo: ${plural(cambian.length, 'evento actualizado', 'eventos actualizados')}.`, 'ok');
    } catch (e) { console.error(e); avisar(e.message || String(e), 'mal'); setOcupado(false); }
  };

  return html`
    <${Hoja} titulo="Recibir eventos" alCerrar=${cerrar}>
      <p class="tenue pequeno">${nombre}${obj?.creado ? ` · creado ${momentoCorto(obj.creado)} (app ${obj.app})` : ''}</p>
      ${errores.length ? html`<${Aviso} tono="mal" titulo="No se puede abrir" lista=${errores} />` : !comparacion ? html`<${Cargando} />` : html`
        <ul class="lista-paquete">
          ${comparacion.map((c) => html`
            <li>
              <div class="negrita">${textoEvento(porId, c.evento)}</div>
              <div class="tenue pequeno">${textoComparacion(c)}</div>
              ${c.perdidos > 0 && html`<div class="pequeno texto-mal">
                Aquí hay ${plural(c.perdidos, 'cambio', 'cambios')} que el paquete no trae (el último, ${momentoCorto(c.ultimoPerdido)}): se perdería${c.perdidos === 1 ? '' : 'n'}.
              </div>`}
            </li>`)}
        </ul>
        ${conPerdidas.length > 0 && html`
          <${Aviso} tono="mal" titulo="Se perderían cambios de este dispositivo">
            Si los hiciste aquí, envíalos antes al otro dispositivo y pide desde allá un paquete nuevo. Si son cambios que ya
            no valen, puedes reemplazar igual.
          <//>`}
        ${cambian.length > 0 && html`<p class="pequeno">Se reemplaza lo de ${cambian.length === 1 ? 'ese evento' : `esos ${cambian.length} eventos`} en este dispositivo por lo que trae el paquete. Lo demás no se toca.</p>`}`}
      <div class="botones pie-hoja">
        <button class="boton" onClick=${cerrar}>Cancelar</button>
        ${!errores.length && comparacion && html`
          <button class=${`boton ${conPerdidas.length ? 'peligro-fuerte' : 'primario'}`} disabled=${ocupado || !cambian.length} onClick=${aplicar}>
            ${!cambian.length ? 'No hay cambios' : ocupado ? 'Guardando…' : `Reemplazar ${plural(cambian.length, 'evento', 'eventos')}`}
          </button>`}
      </div>
    <//>`;
}

/** Aviso al restaurar un respaldo completo: eventos con cambios de aquí que el respaldo no trae. */
export function AvisoPerdidas({ perdidas }) {
  const porId = useEventosPorId();
  if (!perdidas?.length) return null;
  return html`
    <${Aviso} tono="mal" titulo="Este dispositivo tiene cambios que el respaldo no trae"
      lista=${perdidas.map((c) => `${textoEvento(porId, c.evento)}: ${plural(c.perdidos, 'cambio', 'cambios')} (el último, ${momentoCorto(c.ultimoPerdido)})`)}>
      Si los hiciste aquí (por ejemplo, TC calificados en la Mac), envíalos antes con Datos › «Enviar eventos…» al
      dispositivo del que viene el respaldo, o se perderán.
    <//>`;
}
