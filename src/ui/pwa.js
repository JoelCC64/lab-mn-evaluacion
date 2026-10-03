// Registro del service worker y aviso de versión nueva. La app nunca se recarga sola en medio de una clase:
// cuando hay una versión nueva, muestra una banda y espera a que Joel toque «Actualizar».

let pedirActivacion = null;
const oyentes = new Set();
let actualizacionPedida = false;

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
