// Comprueba que npm y node se ejecutan desde el entorno del proyecto (.venv),
// para no instalar ni ejecutar nada con herramientas globales.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entorno = path.join(raiz, '.venv') + path.sep;

if (!process.execPath.startsWith(entorno)) {
  console.error(
    `\nEste proyecto usa su propio entorno (Node en .venv).\n` +
    `Node actual: ${process.execPath}\n\n` +
    `Actívalo con:  source .venv/bin/activate\n` +
    `o créalo con:  scripts/crear-entorno.sh\n`
  );
  process.exit(1);
}
