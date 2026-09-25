// Cuánto cuesta cada instrumento: tiempo de grabar 12,8 s de coro sólo con él.
// Es la mejor aproximación al trabajo del hilo de audio en vivo.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage();
await pg.goto("http://127.0.0.1:8811/pruebas/musica.html");
await pg.waitForFunction(() => window.__listo === true);
const grupos = { nada: ["-"], bombo: ["bombo"], caja: ["caja", "palmas"], hats: ["hat"], platillo: ["platillo"], bajo: ["bajo"],
  guitarra: ["guitarra", "rasguidoMudo"], piano: ["piano"], colchon: ["colchon"], bronce: ["bronce"], voz: ["silaba"], todo: null };
const [a, b] = [52.2, 65.0];
for (const [ng, lista] of Object.entries(grupos)) {
  const r = await pg.evaluate(async ([l, a, b]) => { const x = await window.grabar(0, 44100, b - a, l, a); return x.msGrabar; }, [lista, a, b]);
  console.log(ng.padEnd(9), String(r).padStart(6), "ms para", (b - a).toFixed(1), "s →", (r / ((b - a) * 10)).toFixed(1), "% de tiempo real");
}
await nav.close();
