// Sirve el repo para Playwright y le mete el reloj propio al HTML del juego (y lo que pida la toma).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { RELOJ } from './reloj.mjs';
export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export async function servir({ conReloj = true } = {}) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST' && u.pathname === '/guardar') {
      const p = []; req.on('data', (c) => p.push(c));
      req.on('end', () => { const d = path.join(RAIZ, 'videos/medios', u.searchParams.get('a')); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, Buffer.concat(p)); res.end('ok'); });
      return;
    }
    const f = path.join(RAIZ, decodeURIComponent(u.pathname));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    if (f.endsWith('.html')) {
      let h = fs.readFileSync(f, 'utf8');
      if (conReloj && !u.searchParams.has('sinreloj')) h = h.replace('<head>', '<head>' + RELOJ);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(h); return;
    }
    res.writeHead(200); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${srv.address().port}`, cerrar: () => srv.close() };
}
