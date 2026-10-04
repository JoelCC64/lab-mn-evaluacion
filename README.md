# App de evaluación · Laboratorio de Mecánica Newtoniana (EPN, 2026B)

App web para el celular (PWA, funciona sin conexión). Sirve para evaluar en el aula y llevar las calificaciones de cada evento al Excel del semestre. El plan completo está en [PROYECTO_LABORATORIOS_v4.md](PROYECTO_LABORATORIOS_v4.md) y el avance en [PROGRESS.md](PROGRESS.md).

- **App publicada:** https://joelcc64.github.io/lab-mn-evaluacion/ (en el iPhone: Safari › Compartir › «Agregar a inicio»).
- **Demostración con datos ficticios:** la misma dirección con `?demo=1`, que usa una base aparte.
- **En clase:** todo ocurre en el iPhone, sin conexión. Para pasar las notas al Excel: respaldo por AirDrop a la Mac y, en Chrome, «Datos › Escribir las notas en el Excel» (ver [docs/excel.md](docs/excel.md)).
- **Respaldo del día:** «Exportar el respaldo del día» crea un solo Excel con todo (para leer y para restaurar). Súbelo a Drive cada día; la app avisa en Inicio si hay registros sin respaldar.

## Entorno (aislado; nada se instala de forma global)

```bash
scripts/crear-entorno.sh        # .venv con Python (uv) + Node 24 (nodeenv) + node_modules
source .venv/bin/activate       # node, npm y python del proyecto
```

`npm install` y `npm test` se niegan a correr con un Node que no sea el del `.venv`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas automáticas (configuración, calendario, lectura y escritura del Excel, respaldo, motor de notas, sorteo, talleres, trabajos en casa, nota bimestral y coordinación) |
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
- El Excel real y los respaldos tienen datos de estudiantes y nunca entran aquí (lo impide el `.gitignore`).
- La app no guarda correos.
