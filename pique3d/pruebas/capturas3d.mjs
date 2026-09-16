// Una captura por tema, jugando un pedazo real del nivel.
import { chromium } from "playwright";
import fs from "fs";
const destino = process.argv[2] || "/tmp/t3";
fs.mkdirSync(destino, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 1000, height: 560 } });
pg.on("pageerror", e => console.log("ERROR:", e.message));
await pg.goto("http://127.0.0.1:8801/index.html");
await pg.waitForFunction(() => !!window.PIQUE3D, { timeout: 60000 });
await pg.evaluate(() => localStorage.setItem("pique.v1", JSON.stringify({
  monedas: 2140, desbloqueado: 6, niveles: {}, ajustes: { sonido: false, musica: false, sacudida: true } })));
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE3D, { timeout: 60000 });
await pg.screenshot({ path: `${destino}/01-inicio.png` });
await pg.click("#btn-jugar"); await pg.waitForSelector("#p-mapa:not([hidden])");
await pg.screenshot({ path: `${destino}/02-mapa.png` });

const tiros = [["1-1","llano"],["1-2","subte"],["1-3","cielo"],["2-2","fantasma"],
               ["3-1","desierto"],["4-1","torre"],["4-4","nave"],["6-4","castillo"]];
let i = 3;
for (const [id, tema] of tiros) {
  const [m, n] = id.split("-").map(Number);
  await pg.evaluate(([m,n]) => window.PIQUE3D.empezar(m,n), [m,n]);
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
  // Adelantar por el camino del validador, sin bichos, hasta la mitad.
  await pg.evaluate((frac) => {
    const p = window.PIQUE3D.partida;
    const vivos = p.bichos.map(b => b.vivo); p.bichos.forEach(b => b.vivo = false);
    let prev = false;
    const tope = Math.floor((p.nv.camino?.length ?? 0) * frac);
    for (let k = 0; k < tope; k++) { const t = p.nv.camino[k];
      p.actualizar({ toque: t, toqueNuevo: t && !prev }, 1/60); prev = t; }
    p.bichos.forEach((b,i2) => b.vivo = vivos[i2]);
    p.cam.seguir(p.j.x, p.j.y, 1, true);
  }, 0.45);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${destino}/${String(i).padStart(2,"0")}-${tema}.png` });
  console.log(`${id} ${tema}: listo`);
  i++;
  await pg.evaluate(() => window.PIQUE3D.alMapa());
  await pg.waitForSelector("#p-mapa:not([hidden])");
}
await nav.close();
