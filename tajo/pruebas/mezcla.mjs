// Mide el volumen de cada instrumento por separado en un tramo de la canción.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage();
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
await pg.goto("http://127.0.0.1:8811/pruebas/musica.html");
await pg.waitForFunction(() => window.__listo === true);
const grupos = {
  bombo: ["bombo"], caja: ["caja", "palmas"], hats: ["hat"], platillo: ["platillo"], bajo: ["bajo"],
  guitarra: ["guitarra", "rasguidoMudo"], piano: ["piano"], colchon: ["colchon"], bronce: ["bronce"],
  solista: ["solista"], voz: ["silaba"], efectos: ["subida", "impacto", "inverso"],
};
const tramos = { verso: [13.8, 13.8 + 12.8], coro: [52.2, 52.2 + 12.8], puente: [77.8, 77.8 + 12.8] };
for (const [nt, [a, b]] of Object.entries(tramos)) {
  const fila = [];
  for (const [ng, lista] of Object.entries(grupos)) {
    const r = await pg.evaluate(async ([l, a, b]) => { const x = await window.grabar(0, 44100, b - a, l, a); return { total: x.total, pico: x.pico }; }, [lista, a, b]);
    fila.push(`${ng}:${r.total < -90 ? "—" : r.total.toFixed(1)}`);
  }
  console.log(nt.padEnd(7), fila.join("  "));
}
await nav.close();
