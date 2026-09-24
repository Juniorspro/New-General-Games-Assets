// Un servidor chiquito para las pruebas: sirve nevada/ (y node_modules por el enlace).
// Los módulos ES no cargan por file://, por eso hace falta.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };

export async function servir(dir = RAIZ) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let f = path.join(dir, decodeURIComponent(u.pathname));
    if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, cerrar: () => srv.close() };
}

export async function navegador() {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
