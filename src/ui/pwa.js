// Registro del service worker y aviso de versión nueva. La app nunca se recarga sola en medio de una clase:
// cuando hay una versión nueva, muestra una banda y espera a que Joel toque «Actualizar».

let pedirActivacion = null;
const oyentes = new Set();
let actualizacionPedida = false;
let registro = null;

function anunciar(sw) {
  pedirActivacion = () => {
    actualizacionPedida = true;
    sw.postMessage({ tipo: 'activar' });
  };
  for (const f of oyentes) f(pedirActivacion);
}

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    registro = reg;
    if (reg.waiting && navigator.serviceWorker.controller) anunciar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) anunciar(sw);
      });
    });
    // Buscar versiones nuevas al volver a la app.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('No se pudo registrar el service worker:', e));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (actualizacionPedida) location.reload();
  });
}

/** Llama a `f(aplicar)` cuando hay una versión nueva lista. Devuelve la función para dejar de escuchar. */
export function escucharVersionNueva(f) {
  oyentes.add(f);
  if (pedirActivacion) f(pedirActivacion);
  return () => oyentes.delete(f);
}

/**
 * Busca ahora una versión nueva (el botón de «Datos»). Devuelve 'nueva' (ya se anunció la banda «Actualizar»),
 * 'al_dia' o 'sin_sw' (sin service worker: navegador sin soporte o modo de desarrollo).
 */
export async function buscarVersionNueva() {
  if (!registro) return 'sin_sw';
  await registro.update();
  const sw = registro.waiting ?? registro.installing;
  if (!sw || !navigator.serviceWorker.controller) return 'al_dia';
  if (sw.state === 'installed') { anunciar(sw); return 'nueva'; }
  await new Promise((fin) => {   // aún se está descargando: esperar a que termine (o falle)
    sw.addEventListener('statechange', () => { if (['installed', 'redundant'].includes(sw.state)) fin(); });
  });
  if (registro.waiting) { anunciar(registro.waiting); return 'nueva'; }
  return 'al_dia';
}
