// Las texturas ETC2 de la APK (herramientas/etc2.py): cada .etc2 se descomprime con el decodificador del juego
// (js/02b-etc2.js, el que usa si la placa no sabe ETC2) y se compara con el webp original (dado vuelta como lo sube
// el juego). Da la PSNR del nivel 0 y del 2 (lo que se ve de lejos): 30 dB o más es lo normal de ETC2 en fotos.
// Si los colores o el orden de los bloques estuvieran mal, daría menos de 15.
//     node pruebas/etc2.mjs [filtro]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { RAIZ } from './comun.mjs';

const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(RAIZ, 'fuente/js/02b-etc2.js'), 'utf8') + ';this.etc2Leer = etc2Leer; this.etc2ARGBA = etc2ARGBA;', ctx);
const filtro = process.argv[2] || '';
const cache = path.join(RAIZ, '.cache/etc2');
const lista = []; const junta = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) junta(p); else if (f.endsWith('.etc2') && p.includes(filtro)) lista.push(p); } };
junta(cache);
let peor = 99, mal = 0;
for (const p of lista.sort()) {
  const id = path.relative(cache, p).replace(/\.etc2$/, ''), voltear = id.startsWith('tex/');
  const buf = fs.readFileSync(p), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), E = ctx.etc2Leer(ab);
  const psnr = [];
  for (const l of [0, 2]) {
    const m = E.mips[l], px = ctx.etc2ARGBA(m.data, m.width, m.height);
    /* el original, en el mismo nivel (promedios de 2×2 como etc2.py) */
    const raw = execFileSync('python3', ['-c', `
import sys; from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
if sys.argv[2] == '1': im = im.transpose(Image.FLIP_TOP_BOTTOM)
for _ in range(int(sys.argv[3])): w, h = max(1, im.size[0]//2), max(1, im.size[1]//2); im = im.reduce((im.size[0]//w, im.size[1]//h))
sys.stdout.buffer.write(im.tobytes())`, path.join(RAIZ, 'assets', id + '.webp'), voltear ? '1' : '0', String(l)], { maxBuffer: 1 << 26 });
    let s = 0; const n = m.width * m.height;
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const d = px[i * 4 + c] - raw[i * 3 + c]; s += d * d; }
    psnr.push(10 * Math.log10(255 * 255 / (s / (n * 3) || 1e-9)));
  }
  peor = Math.min(peor, psnr[0]); if (psnr[0] < 15) mal++;
  console.log(`${id}: ${E.w}×${E.h}, ${E.mips.length} niveles · PSNR ${psnr[0].toFixed(1)} dB (nivel 2: ${psnr[1].toFixed(1)})`);
}
console.log(`${lista.length} texturas · la peor ${peor.toFixed(1)} dB${mal ? ` · ${mal} MAL` : ''}`);
process.exit(mal ? 1 : 0);
