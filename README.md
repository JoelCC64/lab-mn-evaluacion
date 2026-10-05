# App de evaluación · Laboratorio de Mecánica Newtoniana (EPN, 2026B)

App web para el celular (PWA, funciona sin conexión). Sirve para evaluar en el aula y llevar las calificaciones de cada evento al Excel del semestre. El plan completo está en [PROYECTO_LABORATORIOS_v4.md](PROYECTO_LABORATORIOS_v4.md) y el avance en [PROGRESS.md](PROGRESS.md).

- **App publicada:** https://joelcc64.github.io/lab-mn-evaluacion/ (en el iPhone: Safari › Compartir › «Agregar a inicio»).
- **Demostración con datos ficticios:** la misma dirección con `?demo=1`, que usa una base aparte.
- **En clase:** todo ocurre en el iPhone, sin conexión. Para pasar las notas al Excel: respaldo por AirDrop a la Mac y, en Chrome, «Datos › Escribir las notas en el Excel» (ver [docs/excel.md](docs/excel.md)).
- **Respaldo del día:** «Exportar el respaldo del día» crea un solo Excel con todo (para leer y para restaurar). Súbelo a Drive cada día; la app avisa en Inicio si hay registros sin respaldar, y en rojo si pasan más de 2 días.
- **Respaldo completo y varios dispositivos:** en «Datos», un .zip con todo en JSON y cada tabla en CSV, y «Enviar eventos…» / «Recibir eventos…» para pasar eventos sueltos entre el iPhone y la Mac, por ejemplo los TC calificados en la Mac (ver [docs/respaldo.md](docs/respaldo.md)).
- **Feedback:** pestaña «Feedback» de cada evento evaluado: texto por grupo, versión corta y resumen del curso, armados con lo registrado (ver [docs/feedback.md](docs/feedback.md)).
- **Métricas:** «Inicio › Métricas» o «Métricas del curso»: asistencia, rúbricas, control oral, TC, riesgo y comparaciones, para presentar (sin nombres; se exporta como imagen o PDF) o en detalle (ver [docs/metricas.md](docs/metricas.md)).
- **Tu nombre** (columna PROFESOR de coordinación) es un ajuste de cada dispositivo, en «Datos › Este dispositivo»: no está en este repositorio.

## Entorno (aislado; nada se instala de forma global)

```bash
scripts/crear-entorno.sh        # .venv con Python (uv) + Node 24 (nodeenv) + node_modules
source .venv/bin/activate       # node, npm y python del proyecto
```

`npm install` y `npm test` se niegan a correr con un Node que no sea el del `.venv`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas automáticas (configuración, calendario, lectura y escritura del Excel, respaldo, motor de notas, sorteo, talleres, trabajos en casa, nota bimestral, coordinación, feedback, métricas, respaldo completo y paquetes de eventos) |
| `npm run config` | Valida `/config` y actualiza `config/manifest.json` (después de agregar o editar una actividad) |
| `npm run ejemplo` | Regenera los Excel ficticios de `/datos-ejemplo` |
| `npm run vendor` | Copia a `src/vendor` las librerías para el navegador |
| `npm run build` | Valida la configuración y regenera `sw.js` y `src/version.js` (antes de cada commit que cambie la app) |
| `npm run servidor` | Sirve la app en http://localhost:8765 |

## Publicar (GitHub Pages)

GitHub Pages publica la rama `main` tal cual: cada `git push` actualiza la app, y el iPhone ofrece «Actualizar» la próxima vez que la abre.

```bash
scripts/instalar-gh.sh          # una vez: GitHub CLI dentro de .venv (versión fija, suma verificada)
scripts/gh.sh auth login        # una vez: iniciar sesión (lo hace Joel)
npm run build && npm test && git push origin main --tags
```

## Privacidad

- El repositorio solo tiene código y **datos ficticios**.
- El Excel real, los respaldos (Excel, .zip o JSON) y los paquetes de eventos tienen datos de estudiantes y nunca entran aquí (lo impide el `.gitignore`).
- La app no guarda correos.
