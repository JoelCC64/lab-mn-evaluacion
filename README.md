# App de evaluación · Laboratorio de Mecánica Newtoniana (EPN, 2026B)

App web para el celular (PWA, funciona sin conexión). Sirve para evaluar en el aula y llevar las calificaciones de cada evento al Excel del semestre. El plan completo está en [PROYECTO_LABORATORIOS_v4.md](PROYECTO_LABORATORIOS_v4.md) y el avance en [PROGRESS.md](PROGRESS.md).

## Entorno (aislado; nada se instala de forma global)

```bash
scripts/crear-entorno.sh        # .venv con Python (uv) + Node 24 (nodeenv) + node_modules
source .venv/bin/activate       # node, npm y python del proyecto
```

`npm install` y `npm test` se niegan a correr con un Node que no sea el del `.venv`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas automáticas (configuración, calendario, lectura del Excel, respaldo, motor de notas, sorteo) |
| `npm run config` | Valida `/config` y actualiza `config/manifest.json` (después de agregar o editar una actividad) |
| `npm run ejemplo` | Regenera los Excel ficticios de `/datos-ejemplo` |
| `npm run vendor` | Copia a `src/vendor` las librerías para el navegador |
| `npm run servidor` | Sirve la app en http://localhost:8765 |

## Privacidad

- El repositorio solo tiene código y **datos ficticios**.
- El Excel real y los respaldos tienen datos de estudiantes y nunca entran aquí (lo impide el `.gitignore`).
- La app no guarda correos.
