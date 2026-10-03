// Servidor estático para desarrollo: http://localhost:8765 (solo sirve los archivos de la app).
// Uso: npm run servidor        (con --red escucha en la red local, para abrirla desde otro equipo)

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { RAIZ } from './lib/config-disco.mjs';

const PUERTO = Number(process.env.PUERTO ?? 8765);
const HOST = process.argv.includes('--red') ? '0.0.0.0' : '127.0.0.1';
const PERMITIDOS = ['index.html', 'sw.js', 'manifest.webmanifest', 'icons/', 'src/', 'config/', 'datos-ejemplo/'];
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.md': 'text/plain; charset=utf-8',
};

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '') rel = 'index.html';
    const ruta = path.resolve(RAIZ, rel);
    const permitido = ruta.startsWith(RAIZ + path.sep) && PERMITIDOS.some((p) => rel === p || (p.endsWith('/') && rel.startsWith(p)));
    if (!permitido) { res.writeHead(404).end('No encontrado'); return; }
    const info = await stat(ruta).catch(() => null);
    if (!info?.isFile()) { res.writeHead(404).end('No encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(ruta)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(await readFile(ruta));
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

servidor.listen(PUERTO, HOST, () => console.log(`App en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PUERTO}`));
