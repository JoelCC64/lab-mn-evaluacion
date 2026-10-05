// Respaldo completo y varios dispositivos (Fase 9): respaldo en .zip (JSON y un CSV por tabla, con la fecha en los
// nombres), paquete de eventos entre dos dispositivos, aviso de lo que se perdería al reemplazar y recordatorio.
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import zlib from 'node:zlib';
import ExcelJS from 'exceljs';

import { TABLAS, TABLAS_DE_EVENTO, abrirBase } from '../src/db.js';
import { aplicarExcelSemestre } from '../src/datos/importar.js';
import { leerExcelSemestre } from '../src/nucleo/excel-lectura.js';
import { simularClases } from '../src/datos/simulacion.js';
import { borrarTodo, exportarRespaldo, nombreArchivoRespaldo, restaurarRespaldo, selloDeFecha, validarRespaldo } from '../src/datos/respaldo.js';
import {
  aplicarPaquete, cambiosQueSePierdenAlRestaurar, compararPaquete, exportarPaquete, nombreArchivoPaquete, resumenPorEvento,
  tablasDeEventos, validarPaquete,
} from '../src/datos/paquete.js';
import { guardarLocal } from '../src/datos/local.js';
import {
  agregarVisitante, alternarEtiqueta, alternarEtiquetaTrabajo, guardarAjuste, guardarFeedback, guardarRecuperacion, marcarEntrega,
  marcarPlic, marcarRetro, marcarSinClase, puntuarTrabajo,
} from '../src/datos/acciones.js';
import { registrosDelCurso } from '../src/datos/consultas.js';
import { generarEventos } from '../src/nucleo/calendario.js';
import { gruposDelEvento } from '../src/nucleo/grupos.js';
import { crearContexto, notaEvento } from '../src/nucleo/motor.js';
import { unidadesDelTrabajo } from '../src/nucleo/motor-vista.js';
import { CLAVES } from '../src/nucleo/tablas.js';
import { BOM, celdaCsv, leerCsv, tablaCsv } from '../src/nucleo/csv.js';
import { crc32, crearZip, entradasZip, leerParteZip } from '../src/nucleo/zip.js';
import { archivosDelRespaldo, recordatorioDeRespaldo, respaldoDeZip } from '../src/nucleo/respaldo-completo.js';
import { compararEvento, textoEstable } from '../src/nucleo/sincronia.js';
import { crearValidador, leerConfigDisco } from '../scripts/lib/config-disco.mjs';
import { EXCEL_EJEMPLO, configReal } from './ayudas.js';

const cfg = configReal();
const CLASES = '2026-10-20T15:00:00.000Z';      // momento de las clases simuladas
const RESPALDO = '2026-10-20T16:00:00.000Z';    // respaldo del iPhone que la Mac restaura
const EN_LA_MAC = '2026-10-21T01:00:00.000Z';   // calificación en la Mac
const comprimir = (b) => new Uint8Array(zlib.deflateRawSync(b));
const inflar = (b) => new Uint8Array(zlib.inflateRawSync(b));
const opciones = (ahora) => ({ semestre: '2026B', app: 'prueba', config: cfg.version, ahora });
const opcionesPaquete = (ahora) => ({ ...opciones(ahora), demo: true });
const TC = 'GR6CD:TC1';
const P1 = 'GR2QB:P1';

/** Base de demostración con el Excel ficticio y clases simuladas hasta la semana `hasta` (0 = sin clases). */
async function demo(hasta = 5, nombre = 'resp') {
  const db = abrirBase(`${nombre}-${randomUUID()}-demo`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_EJEMPLO);
  await aplicarExcelSemestre(db, leerExcelSemestre(wb, cfg), { ahora: CLASES });
  if (hasta) await simularClases(db, cfg, { hastaSemana: hasta, semilla: 11, ahora: CLASES });
  return db;
}

/** Contexto del motor y grupos de un evento. */
async function contexto(db, paralelo, codigo) {
  const curso = cfg.cursoPorId[paralelo];
  const reg = await registrosDelCurso(db, paralelo);
  const eventos = generarEventos(cfg, curso, reg.cambios_evento);
  const evento = eventos.find((e) => e.codigo === codigo);
  return { ctx: crearContexto(cfg, curso, eventos, reg), evento, grupos: gruposDelEvento(evento, eventos, reg).porEstudiante };
}

/** Filas ordenadas de cada tabla, para comparar dos dispositivos. */
const ordenar = (tablas) => Object.fromEntries(Object.entries(tablas).filter(([, f]) => f.length)
  .map(([t, filas]) => [t, filas.map(textoEstable).sort()]));

/** Respaldo sin lo de los eventos `ids` (sus filas y sus visitantes). */
function sinEventos(respaldo, ids) {
  const tablas = Object.fromEntries(Object.entries(respaldo.tablas).map(([t, filas]) => [t, filas.filter((f) =>
    (TABLAS_DE_EVENTO.includes(t) ? !ids.includes(f.evento) : !(t === 'estudiantes' && ids.includes(f.visita?.evento))))]));
  return { ...respaldo, tablas };
}

/**
 * El iPhone tiene clases hasta la semana 5, sin el TC1 de GR6CD. La Mac restaura su respaldo, califica ese TC1 y agrega
 * en P1 de GR2QB un visitante y una etiqueta. Devuelve los dos dispositivos, el respaldo y el paquete de la Mac.
 */
async function dosDispositivos() {
  const iphone = await demo(5, 'iphone');
  await iphone.trabajos_casa.where('evento').equals(TC).delete();
  const respaldo = await exportarRespaldo(iphone, opciones(RESPALDO));
  const mac = abrirBase(`mac-${randomUUID()}-demo`);
  await restaurarRespaldo(mac, JSON.parse(JSON.stringify(respaldo)));
  await guardarLocal(mac, 'respaldo_importado', { creado: respaldo.creado });

  const { ctx, evento } = await contexto(mac, 'GR6CD', 'TC1');
  const preguntas = cfg.actividades[evento.config].preguntas;
  const unidades = unidadesDelTrabajo(ctx, evento).filter((u) => u.porCalificar);
  assert.ok(unidades.length >= 3, 'el TC1 tiene grupos por calificar');
  for (const [k, u] of unidades.entries()) {
    for (const [j, q] of preguntas.entries()) await puntuarTrabajo(mac, TC, u.unidad, u.id, q.id, q.puntajes[(k + j) % q.puntajes.length], EN_LA_MAC);
  }
  await marcarEntrega(mac, TC, unidades[1].unidad, unidades[1].id, false, EN_LA_MAC);
  const etiquetaTc = cfg.actividades[evento.config].etiquetas[0].id;
  await alternarEtiquetaTrabajo(mac, TC, unidades[0].unidad, unidades[0].id, etiquetaTc, EN_LA_MAC);

  const p1 = await contexto(mac, 'GR2QB', 'P1');
  await agregarVisitante(mac, P1, p1.grupos, '1', { codigo: '201900999', nombre: 'Visitante Ficticio Uno', paralelo: 'GR5ZZ' }, EN_LA_MAC);
  await alternarEtiqueta(mac, P1, p1.grupos, '2', 'h_mal_medida', EN_LA_MAC);

  const paquete = JSON.parse(JSON.stringify(await exportarPaquete(mac, [TC, P1], opcionesPaquete('2026-10-21T02:00:00.000Z'))));
  return { iphone, mac, respaldo, paquete };
}

test('Listo cuando (1): respaldo completo en .zip (JSON y un CSV por tabla): exportar, borrar todo, restaurar y datos idénticos', async () => {
  const db = await demo(9);
  // Lo que la simulación no llena: visitante, ajuste, recuperación, PLIC, feedback, retro, sin clase, meta y textos difíciles.
  const p1 = await contexto(db, 'GR2QB', 'P1');
  const [e1, e2] = [...p1.grupos.keys()];
  await agregarVisitante(db, P1, p1.grupos, '1', { codigo: '201900999', nombre: 'Visitante Ficticio', paralelo: 'GR5ZZ' }, CLASES);
  await guardarAjuste(db, P1, e1, 0.5, 'Ajuste ficticio', CLASES);
  await guardarRecuperacion(db, 'GR2QB:T1', e2, { estado: 'realizada', nota: 0.8, detalle: 'GR3QA, jue 15 oct' }, CLASES);
  await marcarPlic(db, 'GR2QB:PLIC', e1, true, CLASES);
  await guardarFeedback(db, P1, 'grupo', '1', 'Texto editado, con "comillas"', 'Texto generado', CLASES);
  await marcarRetro(db, 'GR2QB:T1', '1', true, CLASES);
  await marcarSinClase(db, 'GR2QB:P6', 'Clase suspendida', CLASES);
  await db.notas.put({ evento: P1, unidad: 'grupo', unidad_id: '3', texto: ' Dijo "hola", luego:\r\nñandú 🙂; 1,5 ', fecha: CLASES });
  await db.meta.put({ clave: 'prueba', valor: { lista: [1, null, 'a,b'] } });

  const antes = await exportarRespaldo(db, opciones(RESPALDO));
  for (const [t, filas] of Object.entries(antes.tablas)) assert.ok(filas.length > 0, `tabla ${t} vacía en la prueba`);

  const fecha = new Date(2026, 9, 20, 15, 30);
  const sello = selloDeFecha(fecha);
  assert.equal(sello, '2026-10-20-1530');
  const base = nombreArchivoRespaldo('2026B-demo', fecha, 'zip').replace(/\.zip$/, '');
  assert.equal(base, 'respaldo-lab-mn-2026B-demo-2026-10-20-1530');
  const archivos = archivosDelRespaldo(antes, { base, sello, demo: true });
  const zip = await crearZip(archivos, { comprimir, fecha });

  // Un JSON, un CSV por tabla (con la fecha en el nombre) y el LÉEME.
  const entradas = entradasZip(zip);
  assert.deepEqual(entradas.map((e) => e.nombre).sort(), [
    `${base}/LEEME.txt`, `${base}/${base}.json`, ...Object.keys(TABLAS).map((t) => `${base}/csv/${t}-${sello}.csv`),
  ].sort());
  // Va comprimido lo que así ocupa menos (el JSON y los CSV grandes); un archivo muy pequeño va tal cual.
  assert.equal(entradas.find((e) => e.nombre.endsWith('.json')).metodo, 8);
  assert.ok(entradas.filter((e) => e.metodo === 8).length > entradas.length / 2);
  assert.ok(entradas.every((e) => e.metodo === 8 || e.tamano < 200));
  // Cada parte se lee igual a como se escribió (TextDecoder quita el BOM de los CSV al leer; los bytes sí lo llevan).
  for (const a of archivos) {
    const entrada = entradas.find((e) => e.nombre === a.nombre);
    assert.equal(await leerParteZip(zip, entrada, inflar), a.contenido.replace(/^\uFEFF/, ''));
    if (a.nombre.endsWith('.csv')) {
      const p = entrada.inicioLocal;
      const inicio = p + 30 + zip[p + 26] + (zip[p + 27] << 8) + zip[p + 28] + (zip[p + 29] << 8);
      const crudo = entrada.metodo === 8 ? inflar(zip.subarray(inicio, inicio + entrada.comprimido)) : zip.subarray(inicio, inicio + entrada.comprimido);
      assert.deepEqual([...crudo.subarray(0, 3)], [0xef, 0xbb, 0xbf], `BOM en ${a.nombre}`);
      assert.equal(zlib.crc32(crudo), new DataView(zip.buffer).getUint32(p + 14, true), `CRC de ${a.nombre}`);
    }
  }
  const leeme = archivos[0].contenido;
  assert.match(leeme, /DEMOSTRACIÓN/);
  assert.match(leeme, /datos de estudiantes/);
  assert.match(leeme, new RegExp(`asistencia\\s+${antes.tablas.asistencia.length}\\r\\n`));

  // Cada CSV: BOM, CRLF, la clave primero, una fila por registro y cada celda como el valor (listas y objetos en JSON).
  for (const t of Object.keys(TABLAS)) {
    const texto = archivos.find((a) => a.nombre === `${base}/csv/${t}-${sello}.csv`).contenido;
    assert.ok(texto.startsWith(BOM) && texto.endsWith('\r\n'), t);
    const [enc, ...filas] = leerCsv(texto);
    assert.deepEqual(enc.slice(0, CLAVES[t].length), CLAVES[t], `clave de ${t}`);
    assert.equal(filas.length, antes.tablas[t].length, `filas de ${t}`);
    antes.tablas[t].forEach((f, i) => {
      assert.equal(filas[i].length, enc.length);
      enc.forEach((c, j) => {
        const v = f[c];
        assert.equal(filas[i][j], v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v), `${t}[${i}].${c}`);
      });
    });
  }
  assert.ok(!archivos.some((a) => a.contenido.includes('@')), 'sin correos');

  await borrarTodo(db);
  assert.equal(await db.estudiantes.count(), 0);
  const leido = await respaldoDeZip(zip, inflar);
  assert.deepEqual(validarRespaldo(leido, db, { semestre: '2026B' }), []);
  await restaurarRespaldo(db, leido);
  assert.deepEqual(await exportarRespaldo(db, opciones(RESPALDO)), antes);
});

test('Listo cuando (2): un paquete de eventos pasa de un dispositivo a otro sin perder nada', async () => {
  const { iphone, mac, paquete } = await dosDispositivos();
  const antes = await exportarRespaldo(iphone, opciones(RESPALDO));
  assert.equal(nombreArchivoPaquete('2026B-demo', [TC], new Date(2026, 9, 21, 9, 5)), 'eventos-lab-mn-2026B-demo-GR6CD-TC1-2026-10-21-0905.json');
  assert.equal(nombreArchivoPaquete('2026B', [TC, P1], new Date(2026, 9, 21, 9, 5)), 'eventos-lab-mn-2026B-2-eventos-2026-10-21-0905.json');
  // Solo tablas de evento con algo (y el visitante), y solo filas de sus dos eventos.
  for (const [t, filas] of Object.entries(paquete.tablas)) {
    assert.ok([...TABLAS_DE_EVENTO, 'estudiantes'].includes(t) && filas.length > 0, t);
    if (t !== 'estudiantes') assert.ok(filas.every((f) => [TC, P1].includes(f.evento)), t);
  }
  assert.ok(paquete.tablas.trabajos_casa.every((f) => f.evento === TC));
  assert.equal(paquete.tablas.estudiantes.length, 1, 'lleva al visitante');
  assert.equal(paquete.tablas.estudiantes[0].visita.evento, P1);

  assert.deepEqual(await validarPaquete(paquete, iphone, cfg, { demo: true }), []);
  const comparacion = await compararPaquete(iphone, paquete);
  assert.deepEqual(comparacion.map((c) => [c.evento, c.igual, c.perdidos]), [[TC, false, 0], [P1, false, 0]]);
  assert.equal(comparacion[0].aqui, 0, 'en el iPhone el TC1 no estaba calificado');
  assert.equal(comparacion[0].ultimoLlega, EN_LA_MAC);

  await aplicarPaquete(iphone, paquete);
  // Los dos eventos quedan idénticos en los dos dispositivos, con el visitante.
  assert.deepEqual(ordenar(await tablasDeEventos(iphone, [TC, P1])), ordenar(await tablasDeEventos(mac, [TC, P1])));
  // Las notas que calcula la app también.
  for (const [paralelo, codigo] of [['GR6CD', 'TC1'], ['GR2QB', 'P1']]) {
    const a = await contexto(iphone, paralelo, codigo);
    const b = await contexto(mac, paralelo, codigo);
    const notasA = a.ctx.reg.estudiantes.map((e) => notaEvento(a.ctx, a.evento, e.id));
    assert.deepEqual(notasA, b.ctx.reg.estudiantes.map((e) => notaEvento(b.ctx, b.evento, e.id)));
    assert.ok(notasA.some((n) => n.estado === 'calculada' && n.valor > 0), `${paralelo} ${codigo} tiene notas`);
  }
  // Lo demás del iPhone no cambió.
  assert.deepEqual(sinEventos(await exportarRespaldo(iphone, opciones(RESPALDO)), [TC, P1]), sinEventos(antes, [TC, P1]));
  // Recibirlo otra vez no cambia nada.
  assert.ok((await compararPaquete(iphone, paquete)).every((c) => c.igual && !c.perdidos));
  const resumen = await resumenPorEvento(iphone);
  assert.equal(resumen.get(TC).ultimo, EN_LA_MAC);
});

test('avisa lo que se perdería: cambios de aquí más recientes que el paquete, o que el respaldo que se restaura no trae', async () => {
  const { iphone, mac, respaldo, paquete } = await dosDispositivos();

  // En la Mac, restaurar el respaldo viejo del iPhone perdería el TC1 calificado y el visitante.
  const desde = respaldo.creado;
  const perdidas = await cambiosQueSePierdenAlRestaurar(mac, respaldo, { desde });
  assert.deepEqual(perdidas.map((c) => c.evento).sort(), [P1, TC].sort());
  assert.equal(perdidas.find((c) => c.evento === TC).ultimoPerdido, EN_LA_MAC);
  assert.deepEqual((await cambiosQueSePierdenAlRestaurar(mac, respaldo)).map((c) => c.evento).sort(), [P1, TC].sort(), 'también sin saber la base');

  // Si el iPhone recibe el paquete y hace un respaldo nuevo, restaurarlo en la Mac no pierde nada.
  await aplicarPaquete(iphone, paquete);
  const nuevo = await exportarRespaldo(iphone, opciones('2026-10-21T03:00:00.000Z'));
  assert.deepEqual(await cambiosQueSePierdenAlRestaurar(mac, nuevo, { desde }), []);

  // La Mac corrige una pregunta y manda un paquete nuevo: lo que el iPhone recibió antes no cuenta como pérdida.
  const { ctx, evento } = await contexto(mac, 'GR6CD', 'TC1');
  const u = unidadesDelTrabajo(ctx, evento).find((x) => x.porCalificar);
  const q = cfg.actividades[evento.config].preguntas[0];
  await puntuarTrabajo(mac, TC, u.unidad, u.id, q.id, 0, '2026-10-21T04:00:00.000Z');
  const paquete2 = JSON.parse(JSON.stringify(await exportarPaquete(mac, [TC], opcionesPaquete('2026-10-21T04:05:00.000Z'))));
  const c2 = await compararPaquete(iphone, paquete2);
  assert.deepEqual(c2.map((c) => [c.igual, c.perdidos]), [[false, 0]]);

  // Si el iPhone califica algo después del paquete, recibir el paquete viejo lo perdería: se avisa.
  const otra = unidadesDelTrabajo((await contexto(iphone, 'GR6CD', 'TC1')).ctx, evento).filter((x) => x.porCalificar)[2];
  await puntuarTrabajo(iphone, TC, otra.unidad, otra.id, q.id, 0, '2026-10-21T05:00:00.000Z');
  const c3 = await compararPaquete(iphone, paquete2);
  assert.equal(c3[0].perdidos, 1);
  assert.equal(c3[0].ultimoPerdido, '2026-10-21T05:00:00.000Z');
  // Una fila que el paquete no trae y es posterior a lo último del paquete también cuenta.
  await iphone.notas.put({ evento: TC, unidad: 'grupo', unidad_id: String(otra.id), texto: 'Nota hecha en el iPhone', fecha: '2026-10-21T06:00:00.000Z' });
  assert.equal((await compararPaquete(iphone, paquete2))[0].perdidos, 2);
  // Aplicarlo igual (el profesor confirmó) deja el evento como en la Mac.
  await aplicarPaquete(iphone, paquete2);
  assert.deepEqual(ordenar(await tablasDeEventos(iphone, [TC])), ordenar(await tablasDeEventos(mac, [TC])));
});

test('compararEvento: misma clave más reciente aquí, filas que no llegan y la base del dispositivo', () => {
  const fila = (estudiante, fecha, extra = {}) => ({ tabla: 'asistencia', fila: { evento: 'X:P1', estudiante, estado: 'presente', fecha, ...extra } });
  const llega = [fila('a', '2026-10-20T10:00:00Z'), fila('b', '2026-10-20T12:00:00Z')];
  // Igual.
  assert.deepEqual(compararEvento(llega, llega).igual, true);
  // Aquí «a» cambió después (se perdería); «c» no llega y es posterior a lo último del paquete (se perdería).
  const aqui = [fila('a', '2026-10-20T13:00:00Z', { estado: 'no_vino' }), fila('b', '2026-10-20T12:00:00Z'), fila('c', '2026-10-20T14:00:00Z')];
  const c = compararEvento(aqui, llega);
  assert.deepEqual([c.igual, c.perdidos, c.ultimoPerdido, c.ultimoAqui, c.ultimoLlega], [false, 2, '2026-10-20T14:00:00Z', '2026-10-20T14:00:00Z', '2026-10-20T12:00:00Z']);
  // «c» anterior a lo último del paquete: se toma como borrada en el otro dispositivo; con la base del dispositivo
  // (respaldo restaurado antes), sí cuenta.
  const viejo = [fila('c', '2026-10-20T11:00:00Z')];
  assert.equal(compararEvento(viejo, llega).perdidos, 0);
  assert.equal(compararEvento(viejo, llega, { desde: '2026-10-20T09:00:00Z' }).perdidos, 1);
  // Una versión más nueva en el paquete reemplaza sin pérdida.
  assert.equal(compararEvento([fila('a', '2026-10-20T09:00:00Z', { estado: 'no_vino' })], llega).perdidos, 0);
  // El paquete no trae nada: se borra todo lo de aquí.
  assert.equal(compararEvento(llega, []).perdidos, 2);
  // Los pases guardan cuándo se cerraron.
  const pase = { tabla: 'pases', fila: { evento: 'X:P1', cerrado: false, cerrado_en: '2026-10-20T10:00:00Z', reabierto_en: '2026-10-20T15:00:00Z' } };
  assert.equal(compararEvento([pase], []).ultimoPerdido, '2026-10-20T15:00:00Z');
});

test('el paquete se rechaza si no es de este semestre, de la demostración o de eventos conocidos, o si faltan estudiantes', async () => {
  const { iphone, paquete } = await dosDispositivos();
  const valida = (obj, demo = true) => validarPaquete(obj, iphone, cfg, { demo });
  const copia = () => JSON.parse(JSON.stringify(paquete));
  assert.deepEqual(await valida({ formato: 'lab-mn-respaldo', version: 1 }), ['El archivo no es un paquete de eventos de la app.']);
  assert.match((await valida({ ...copia(), semestre: '2027A' })).join(' '), /2027A/);
  assert.match((await valida({ ...copia(), version: 9 })).join(' '), /Versión de paquete 9/);
  assert.match((await valida(copia(), false)).join(' '), /demostración/);
  assert.match((await valida({ ...copia(), demo: false })).join(' '), /datos reales/);
  assert.match((await valida({ ...copia(), eventos: [TC, P1, 'GR2QB:P99'] })).join(' '), /GR2QB:P99/);
  const ajena = copia();
  ajena.tablas.trabajos_casa.push({ ...ajena.tablas.trabajos_casa[0], evento: 'GR1AA:TC1' });
  assert.match((await valida(ajena)).join(' '), /trabajos_casa trae registros de otro evento/);
  const conMeta = copia();
  conMeta.tablas.meta = [{ clave: 'x' }];
  assert.match((await valida(conMeta)).join(' '), /no va en un paquete: meta/);

  // Un estudiante del paquete que no está en este dispositivo (la nómina no se leyó aquí).
  const id = paquete.tablas.asistencia.find((a) => !a.estudiante.startsWith('v-')).estudiante;
  await iphone.estudiantes.delete(id);
  const errores = await valida(copia());
  assert.equal(errores.length, 1);
  assert.match(errores[0], new RegExp(`Un estudiante del paquete no está en este dispositivo \\(${id}\\)`));
  // Nada se aplicó.
  assert.equal(await iphone.trabajos_casa.where('evento').equals(TC).count(), 0);
});

test('recordatorio de respaldo: pendiente y urgente cuando pasan más de N días sin respaldar', () => {
  const iso = (d, h = 10) => new Date(2026, 9, d, h, 0).toISOString();
  const r = (estado, d) => recordatorioDeRespaldo(estado, { limite: 2, ahora: new Date(2026, 9, d, 18, 0) });
  assert.deepEqual(r({}, 10), { pendiente: false, dias: 0, vencido: false });
  assert.deepEqual(r({ ultimoRespaldo: iso(1, 20), ultimoCambio: iso(1, 19) }, 10), { pendiente: false, dias: 9, vencido: false }, 'sin cambios nuevos no urge');
  const conCambios = { ultimoRespaldo: iso(5, 20), ultimoCambio: iso(6), primerCambio: iso(6) };
  assert.deepEqual(r(conCambios, 6), { pendiente: true, dias: 1, vencido: false });
  assert.deepEqual(r(conCambios, 7), { pendiente: true, dias: 2, vencido: false });
  assert.deepEqual(r(conCambios, 8), { pendiente: true, dias: 3, vencido: true });
  // Sin ningún respaldo: cuenta desde el primer cambio.
  assert.deepEqual(r({ ultimoCambio: iso(9), primerCambio: iso(4) }, 9), { pendiente: true, dias: 5, vencido: true });
  assert.deepEqual(r({ ultimoCambio: iso(9), primerCambio: iso(9) }, 9), { pendiente: true, dias: 0, vencido: false });
});

test('CSV y zip: comillas, saltos de línea y tildes; CRC, sin comprimir y errores al leer', async () => {
  assert.equal(celdaCsv(null), '');
  assert.equal(celdaCsv(0), '0');
  assert.equal(celdaCsv(-0.25), '-0.25');
  assert.equal(celdaCsv(false), 'false');
  assert.equal(celdaCsv('simple'), 'simple');
  assert.equal(celdaCsv('a,b'), '"a,b"');
  assert.equal(celdaCsv('dijo "sí"'), '"dijo ""sí"""');
  assert.equal(celdaCsv(' borde'), '" borde"');
  assert.equal(celdaCsv([2, null, 1]), '"[2,null,1]"');
  assert.equal(celdaCsv({ '1a': 1 }), '"{""1a"":1}"');
  const filas = [{ id: '1', texto: 'uno\r\ndos, "tres"', n: 1.5 }, { id: '2', extra: ['ñ', '🙂'] }];
  const csv = tablaCsv(filas, ['id']);
  assert.deepEqual(leerCsv(csv), [['id', 'texto', 'n', 'extra'], ['1', 'uno\r\ndos, "tres"', '1.5', ''], ['2', '', '', '["ñ","🙂"]']]);
  assert.equal(tablaCsv([], ['evento', 'estudiante']), `${BOM}evento,estudiante\r\n`);

  const datos = randomBytes(5000);
  assert.equal(crc32(datos), zlib.crc32(datos));
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);

  const sinComprimir = await crearZip([{ nombre: 'a/b.txt', contenido: 'hola ñ' }, { nombre: 'a/c.bin', contenido: datos }]);
  const e = entradasZip(sinComprimir);
  assert.deepEqual(e.map((x) => [x.nombre, x.metodo, x.tamano]), [['a/b.txt', 0, 7], ['a/c.bin', 0, 5000]]);
  assert.equal(await leerParteZip(sinComprimir, e[0], inflar), 'hola ñ');
  // El zip lo lee también zlib, parte por parte, con su CRC (cabecera local: CRC en el byte 14).
  const vista = new DataView(sinComprimir.buffer);
  assert.equal(vista.getUint32(e[1].inicioLocal + 14, true), zlib.crc32(datos));

  await assert.rejects(respaldoDeZip(new Uint8Array([1, 2, 3]), inflar), /dañado o no es un zip/);
  await assert.rejects(respaldoDeZip(sinComprimir, inflar), /no es un respaldo completo/);
  const dos = await crearZip([{ nombre: 'x/a.json', contenido: '{}' }, { nombre: 'x/b.json', contenido: '{}' }]);
  await assert.rejects(respaldoDeZip(dos, inflar), /un solo \.json/);
  // Los archivos que agrega el Finder al volver a comprimir («__MACOSX», «._…») no cuentan.
  const conMac = await crearZip([{ nombre: 'x/r.json', contenido: '{"formato":"lab-mn-respaldo"}' }, { nombre: '__MACOSX/x/._r.json', contenido: 'basura' }]);
  assert.deepEqual(await respaldoDeZip(conMac, inflar), { formato: 'lab-mn-respaldo' });
});

test('las claves de cada tabla coinciden con la definición de la base', () => {
  for (const [t, def] of Object.entries(TABLAS)) {
    const primaria = def.split(',')[0].trim().replace(/^\+\+/, '');
    const campos = primaria.startsWith('[') ? primaria.slice(1, -1).split('+') : [primaria];
    assert.deepEqual(CLAVES[t], campos, t);
  }
  assert.deepEqual(Object.keys(CLAVES).sort(), Object.keys(TABLAS).sort());
  for (const t of TABLAS_DE_EVENTO) assert.ok(TABLAS[t].includes('evento'), `${t} tiene índice por evento`);
});

test('configuración del respaldo: recordatorio en días, validado por su esquema', () => {
  assert.equal(cfg.respaldo.recordatorio_dias, 2);
  const { archivos } = leerConfigDisco();
  const validar = crearValidador();
  assert.deepEqual(validar('respaldo.schema.json', archivos['respaldo.json']), []);
  assert.ok(validar('respaldo.schema.json', { id: 'respaldo', recordatorio_dias: -1 }).length > 0);
  assert.ok(validar('respaldo.schema.json', { id: 'respaldo' }).length > 0);
});
