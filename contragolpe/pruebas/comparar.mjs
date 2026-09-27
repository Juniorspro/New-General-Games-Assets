// ¿Se ve igual? La misma partida (semilla 7, 16 s con piloto automático) en dos HTML armados, dibujada
// desde las mismas vistas (cada aparición mirando al centro del mapa, más una de cerca de un bot) sin el
// grano (que cambia con cada cuadro). Guarda las fotos en pruebas/salida/comparar/ y da la diferencia
// por vista: PSNR (dB; 40 o más no se distingue a ojo) y cuántos píxeles cambian más de 8/255.
//     node pruebas/comparar.mjs <antes.html> [después.html=contragolpe.html | apk] [calidad=1] [mapa=nuclear]
// ('apk': la versión de la APK, servida por http, con las texturas en ETC2)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { navegador, abrir, servirApk, SAL, RAIZ } from './comun.mjs';

const [antes, despues = path.join(RAIZ, 'contragolpe.html')] = process.argv.slice(2).filter((a) => !a.includes('='));
const A = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes('=')).map((a) => a.split('=')));
const dir = path.join(SAL, A.dir || 'comparar'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const nav = await navegador();
async function fotos(archivo, pre) {
  const srv = archivo === 'apk' ? await servirApk() : null;
  const { ctx, pag, errores } = await abrir(nav, `partida=bomba&bando=ct&sem=7${A.mapa ? '&mapa=' + A.mapa : ''}`, srv ? { url: srv.url } : { archivo: path.resolve(archivo) });
  /* (que lleguen las texturas: en la APK se piden con fetch) */
  await pag.waitForFunction(() => ASSET.pend <= ASSET.ok + ASSET.fallas.length, null, { timeout: 60000, polling: 200 }).catch(() => {});
  await pag.evaluate((c) => { G.graficos = 'fija'; CALIDAD = c; medir(); POST.grado.grano = 0; window.__C.autopiloto(true); window.__C.anda(60 * 16); }, +(A.calidad || 1));
  const n = await pag.evaluate(() => {
    const O = window.__C.OBRA(), sp = [...O.spawns.ct.slice(0, 2), ...O.spawns.t.slice(0, 2), ...O.spawns.dm.slice(0, 4)];
    let cx = 0, cz = 0; for (const s of sp) { cx += s.x; cz += s.z; } cx /= sp.length; cz /= sp.length;
    window.__vistas = sp.map((s) => [s.x, s.y + 1.63, s.z, Math.atan2(-(cx - s.x), -(cz - s.z)), -0.05]);
    /* de cerca: 3 m detrás de un bot vivo, mirándolo */
    const b = ACTORES.find((a) => a.vivo && !a.esJugador); if (b) { const p = b.c.pos; window.__vistas.push([p.x + 3 * Math.sin(b.yaw), p.y + 1.5, p.z + 3 * Math.cos(b.yaw), b.yaw, -0.12]); }
    return window.__vistas.length;
  });
  for (let i = 0; i < n; i++) {
    await pag.evaluate((i) => { const [x, y, z, yaw, pitch] = window.__vistas[i]; cam.position.set(x, y, z); cam.rotation.set(pitch, yaw, 0, 'YXZ'); cam.updateMatrixWorld(); for (let k = 0; k < 3; k++) dibujar(); }, i);
    await pag.screenshot({ path: path.join(dir, `${pre}-${i}.png`) });
  }
  const info = await pag.evaluate(() => { let c = 0, n = 0; for (const k in TEXS) { n++; if (TEXS[k].isCompressedTexture) c++; } return { texturas: n, etc2: c, placaEtc2: typeof etc2Placa === 'function' && etc2Placa(), fallas: ASSET.fallas.slice(0, 5) }; });
  console.log(pre, JSON.stringify(info));
  await ctx.close(); if (srv) srv.cerrar();
  return { n, errores };
}
const a = await fotos(antes, 'antes'), b = await fotos(despues, 'despues');
await nav.close();
/* la diferencia, con PIL */
const py = `
import sys, math
from PIL import Image, ImageChops
d = sys.argv[1]; n = int(sys.argv[2]); out = []
for i in range(n):
    A = Image.open(f'{d}/antes-{i}.png').convert('RGB'); B = Image.open(f'{d}/despues-{i}.png').convert('RGB')
    D = ImageChops.difference(A, B); h = D.convert('L').histogram(); px = A.size[0]*A.size[1]
    mse = sum(v*v*c for v, c in enumerate(D.convert('L').histogram()))/px
    out.append((i, 99.0 if mse == 0 else 10*math.log10(255*255/mse), sum(h[9:])/px*100))
    D.point(lambda v: min(255, v*8)).save(f'{d}/dif-{i}.png')
for i, p, m in out: print(f'vista {i}: PSNR {p:.1f} dB · {m:.2f} % de píxeles con más de 8/255')
print(f'peor: {min(p for _, p, _ in out):.1f} dB')
`;
console.log(execFileSync('python3', ['-c', py, dir, String(Math.min(a.n, b.n))], { encoding: 'utf8' }));
if (a.errores.length || b.errores.length) console.log('errores:', a.errores.slice(0, 3), b.errores.slice(0, 3));
