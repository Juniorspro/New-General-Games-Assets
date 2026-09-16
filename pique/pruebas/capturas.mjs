// Saca capturas de cada tema, jugando un pedazo real de cada nivel.
import { chromium } from "playwright";
import fs from "fs";

const destino = process.argv[2] || "/tmp/tiro";
fs.mkdirSync(destino, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 960, height: 620 } });
await pg.goto("http://127.0.0.1:8799/index.html");
await pg.waitForFunction(() => !!window.PIQUE);
// Abrir todos los mundos para poder visitarlos.
await pg.evaluate(() => {
  localStorage.setItem("pique.v1", JSON.stringify({ monedas: 1240, desbloqueado: 6, niveles: {},
    ajustes: { sonido: false, musica: false, sacudida: true } }));
});
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE);

await pg.screenshot({ path: `${destino}/01-inicio.png` });
await pg.click("#btn-jugar"); await pg.waitForSelector("#p-mapa:not([hidden])");
await pg.screenshot({ path: `${destino}/02-mapa.png`, fullPage: false });
await pg.click("#btn-comojuego").catch(() => {});

// Cada tema, jugado un rato con el camino del validador para que la foto
// muestre la mitad del nivel y no siempre la largada.
const tiros = [["1-1", "llano"], ["1-2", "subte"], ["1-3", "cielo"], ["2-2", "fantasma"],
               ["3-1", "desierto"], ["4-1", "torre"], ["4-4", "nave"], ["6-4", "castillo"]];
let i = 3;
for (const [id, tema] of tiros) {
  const [m, n] = id.split("-").map(Number);
  await pg.evaluate(() => window.PIQUE.alMapa());
  await pg.waitForSelector("#p-mapa:not([hidden])");
  await pg.evaluate(([m, n]) => window.PIQUE.empezar(m, n), [m, n]);
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 25000 });
  // Adelantar hasta cerca de la mitad, sin enemigos, para que no muera.
  await pg.evaluate((frac) => {
    const p = window.PIQUE.partida;
    const bichos = p.bichos; p.bichos = [];
    let previo = false, tope = Math.floor(p.nv.camino.length * frac);
    for (let k = 0; k < tope; k++) {
      const t = p.nv.camino[k];
      p.actualizar({ toque: t, toqueNuevo: t && !previo }); previo = t;
    }
    p.bichos = bichos;            // se devuelven para que salgan en la foto
    p.camX = Math.max(0, p.j.x - 152); p.camY = Math.max(0, Math.min(24*16-256, p.j.y - 158));
  }, 0.45);
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${destino}/${String(i).padStart(2, "0")}-${tema}.png`,
                        clip: await pg.evaluate(() => {
                          const r = document.querySelector(".escena").getBoundingClientRect();
                          return { x: r.x, y: r.y, width: r.width, height: r.height };
                        }) });
  console.log(`${id} ${tema}: listo`);
  i++;
}
await nav.close();
