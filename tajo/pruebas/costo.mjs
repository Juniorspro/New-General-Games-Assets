// Costo de un cuadro en la placa: llamadas de dibujo y triángulos (todas las
// pasadas), en la portada y en el coro más cargado de cada canción.
// Los cuadros por segundo de este navegador (SwiftShader) no dicen nada de un
// teléfono y no se informan como si dijeran.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.625 });
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
await pg.goto("http://127.0.0.1:8811/index.html?fijo");
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true);
console.log("portada:", JSON.stringify(await pg.evaluate(() => window.__TAJO.info())));
for (const [c, t] of [[0, 60], [1, 45], [2, 50]]) {
  const r = await pg.evaluate(([c, t]) => {
    const T = window.__TAJO; T.congelar(true);
    T.jugar(c, "expertoMas", { bot: true, reloj: t - 3 });
    T.simular(3, 1 / 30);
    return { cancion: T.canciones[c].titulo, bloquesVivos: T.juego.notas.filter(n => n.visible && n.estado === 1).length, trozos: T.juego.trozos.length,
      chispas: T.juego.particulas.vivas.length, ...T.info() };
  }, [c, t]);
  console.log(JSON.stringify(r));
}
await nav.close();
