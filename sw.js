// Service worker de la app (GENERADO por scripts/precache.mjs desde scripts/sw-plantilla.js; no editar sw.js a mano).
// Guarda todos los archivos de la app para que funcione sin conexión.
// En localhost usa primero la red (desarrollo); publicada, usa primero lo guardado (rápido y sin conexión).

const VERSION = '0.12.1-5a347a22d9';
const CACHE = `lab-mn-${VERSION}`;
const ARCHIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icono-192.png",
  "icons/icono-512.png",
  "icons/icono-maskable-512.png",
  "src/app.js",
  "src/datos/acciones.js",
  "src/datos/consultas.js",
  "src/datos/excel-datos.js",
  "src/datos/importar.js",
  "src/datos/local.js",
  "src/datos/paquete.js",
  "src/datos/respaldo.js",
  "src/datos/simulacion.js",
  "src/db.js",
  "src/estilos.css",
  "src/nucleo/bimestre.js",
  "src/nucleo/calendario.js",
  "src/nucleo/config.js",
  "src/nucleo/csv.js",
  "src/nucleo/estado-evento.js",
  "src/nucleo/excel-escritura.js",
  "src/nucleo/excel-lectura.js",
  "src/nucleo/feedback.js",
  "src/nucleo/graficos.js",
  "src/nucleo/grupos.js",
  "src/nucleo/metricas.js",
  "src/nucleo/motor-vista.js",
  "src/nucleo/motor.js",
  "src/nucleo/pdf.js",
  "src/nucleo/periodos.js",
  "src/nucleo/respaldo-completo.js",
  "src/nucleo/respaldo-libro.js",
  "src/nucleo/resultados.js",
  "src/nucleo/retro.js",
  "src/nucleo/sincronia.js",
  "src/nucleo/sorteo.js",
  "src/nucleo/tablas.js",
  "src/nucleo/tablero.js",
  "src/nucleo/util.js",
  "src/nucleo/visitantes.js",
  "src/nucleo/zip.js",
  "src/ui/app.js",
  "src/ui/archivos.js",
  "src/ui/base.js",
  "src/ui/buscar.js",
  "src/ui/control.js",
  "src/ui/curso-datos.js",
  "src/ui/curso.js",
  "src/ui/datos.js",
  "src/ui/dispositivo.js",
  "src/ui/estudiante-nuevo.js",
  "src/ui/evento.js",
  "src/ui/excel.js",
  "src/ui/exportar-lamina.js",
  "src/ui/feedback.js",
  "src/ui/grupo.js",
  "src/ui/grupos.js",
  "src/ui/inicio.js",
  "src/ui/metricas.js",
  "src/ui/notas.js",
  "src/ui/paquetes.js",
  "src/ui/plic.js",
  "src/ui/puerta.js",
  "src/ui/pwa.js",
  "src/ui/recuperacion.js",
  "src/ui/respaldo-dia.js",
  "src/ui/resumen.js",
  "src/ui/retro.js",
  "src/ui/revision.js",
  "src/ui/trabajos.js",
  "src/ui/visitantes.js",
  "src/vendor/dexie.js",
  "src/vendor/exceljs.min.js",
  "src/vendor/htm.js",
  "src/vendor/preact-hooks.js",
  "src/vendor/preact-htm.js",
  "src/vendor/preact.js",
  "src/version.js",
  "config/actividades/P1-SQI.json",
  "config/actividades/P1-TRAD.json",
  "config/actividades/T1.json",
  "config/actividades/TC1-SQI.json",
  "config/actividades/TC2-SQI.json",
  "config/actividades/TC3-SQI.json",
  "config/actividades/TC4-SQI.json",
  "config/actividades/TC5-SQI.json",
  "config/actividades/TC6-SQI.json",
  "config/actividades/TC7-SQI.json",
  "config/actividades-catalogo.json",
  "config/asistencia.json",
  "config/control-oral.json",
  "config/cronogramas/A-SQI.json",
  "config/cronogramas/A-TRAD.json",
  "config/cronogramas/B-SQI.json",
  "config/cronogramas/B-TRAD.json",
  "config/cursos-2026B.json",
  "config/esquemas/SQI_B1.json",
  "config/esquemas/SQI_B2.json",
  "config/esquemas/TRAD_B1.json",
  "config/esquemas/TRAD_B2.json",
  "config/excel.json",
  "config/feedback.json",
  "config/manifest.json",
  "config/metricas.json",
  "config/planificacion-conocimiento.json",
  "config/respaldo.json",
  "config/semestre-2026B.json",
  "config/sqi/aspectos-por-practica.json",
  "config/sqi/aspectos.json",
  "config/trabajo-preparatorio.json",
  "datos-ejemplo/Asistencia_Semana1_EJEMPLO.xlsx",
  "datos-ejemplo/Cursos_Lab_MN_2026B_EJEMPLO.xlsx"
];
const LOCAL = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' })))));
  // Primera instalación: activar de una vez. Actualizaciones: esperar a que Joel toque «Actualizar».
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('lab-mn-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'activar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    const indice = new URL('index.html', self.registration.scope).href;
    e.respondWith(LOCAL ? redPrimero(req, indice) : guardadoPrimero(indice));
    return;
  }
  e.respondWith(LOCAL ? redPrimero(req) : guardadoPrimero(req));
});

async function guardadoPrimero(req) {
  const guardado = await caches.match(req, { ignoreSearch: true });
  return guardado ?? fetch(req);
}

async function redPrimero(req, alternativa) {
  try {
    const r = await fetch(req);
    if (r.ok && !alternativa) (await caches.open(CACHE)).put(req, r.clone());
    return r;
  } catch (error) {
    const guardado = await caches.match(alternativa ?? req, { ignoreSearch: true });
    if (guardado) return guardado;
    throw error;
  }
}
