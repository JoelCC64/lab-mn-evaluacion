// Arranque: configuración, base local (una por semestre; la demostración usa otra) y service worker.
import { html, render } from './vendor/preact-htm.js';
import { cargarConfig } from './nucleo/config.js';
import { abrirBase, nombreBase } from './db.js';
import { App } from './ui/app.js';
import { registrarServiceWorker } from './ui/pwa.js';

async function leerConfig(ruta) {
  const r = await fetch(`config/${ruta}`);
  if (!r.ok) throw new Error(`No se pudo leer config/${ruta} (${r.status}).`);
  return r.json();
}

async function iniciar() {
  const demo = new URLSearchParams(location.search).has('demo');
  const cfg = await cargarConfig(leerConfig);
  const db = abrirBase(nombreBase(cfg.semestre.semestre, { demo }));
  await db.open();
  // Pedir almacenamiento persistente: el navegador no borrará los datos por falta de espacio.
  navigator.storage?.persist?.().catch(() => {});
  document.title = demo ? 'Lab MN · Demostración' : 'Lab MN · Evaluación';
  // Solo en desarrollo (localhost): acceso a la configuración y a la base desde la consola.
  if (['localhost', '127.0.0.1'].includes(location.hostname)) window.__labmn = { cfg, db };
  const raiz = document.getElementById('app');
  raiz.textContent = '';
  render(html`<${App} cfg=${cfg} db=${db} demo=${demo} />`, raiz);
  registrarServiceWorker();
}

iniciar().catch((e) => {
  console.error(e);
  const app = document.getElementById('app');
  app.innerHTML = '<div class="error-fatal"><h1>No se pudo abrir la app</h1><p></p></div>';
  app.querySelector('p').textContent = e.message || String(e);
});
