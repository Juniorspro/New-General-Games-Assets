// CUANTOS CUADROS SALEN DE VERDAD, JUGANDO.
//
// QUE INSTRUMENTO SE USA Y POR QUE.
// Hay dos formas de medir esto y las dos mienten si se las usa sola.
//  · Cronometrar `dibujar()` sin más mide lo que tardó en ANOTAR las órdenes,
//    no en pintarlas: da 0,1 ms en una pantalla que va a 40 cuadros.
//  · Cronometrarlo con un `getImageData` al final obliga a rasterizar y el
//    número deja de ser ficción — pero llamándolo noventa veces seguidas
//    dentro de un mismo cuadro, cada lectura frena la cañería entera y el
//    navegador no puede solapar nada. Medido así, la tablet daba 21 ms por
//    cuadro mientras el juego corría a 60 sostenidos. El instrumento estaba
//    midiendo su propio freno.
// Lo que NO miente es contar cuadros contra el reloj de pared mientras se
// juega. Eso es lo que se exige acá; el costo del dibujo se informa al lado,
// como dato para saber dónde mirar si algún día baja.
import { chromium } from "playwright";
import { ch, cerrar } from "./_ch.mjs";
import path from "path";

const ARCHIVO = path.resolve(process.argv[2] || "ritmo-en-un-archivo.html");
const MINIMO = 55;      // cuadros por segundo sostenidos
const TARDE = 25;       // un cuadro que tarda más que esto se ve como un tirón

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
for (const [nombre, an, al, esc] of [["teléfono chico", 360, 640, 2],
                                     ["teléfono grande", 412, 915, 2],
                                     ["tablet", 768, 1024, 2]]) {
  const pg = await nav.newPage({ viewport: { width: an, height: al }, hasTouch: true, deviceScaleFactor: esc });
  await pg.goto("file://" + ARCHIVO);
  await pg.waitForTimeout(400);
  // la 9 es la más densa de las nueve: si aguanta esa, aguanta todas
  await pg.evaluate(() => { window.__ritmo.ir("menu"); window.__ritmo.empezar(9); });
  await pg.waitForTimeout(800);

  const f = await pg.evaluate(() => new Promise((listo) => {
    const t = [], jsMs = [];
    let prev = performance.now(); const t0 = prev;
    const tic = () => {
      const a = performance.now();
      t.push(a - prev); prev = a;
      if (a - t0 < 3000) requestAnimationFrame(tic);
      else {
        t.shift();                                   // el primero mide el arranque
        const ord = [...t].sort((x, y) => x - y);
        listo({ cuadros: t.length, segundos: (a - t0) / 1000,
                mediana: +ord[ord.length >> 1].toFixed(2),
                peor: +ord[ord.length - 1].toFixed(2),
                tarde: t.filter((v) => v > 25).length });
      }
    };
    requestAnimationFrame(tic);
  }));
  const fps = f.cuadros / f.segundos;
  ch(`${nombre}: sostiene los cuadros jugando la canción más densa`, fps >= MINIMO,
     `${fps.toFixed(1)} por segundo durante ${f.segundos.toFixed(1)} s · mediana ${f.mediana} ms`);
  ch(`${nombre}: casi ningún tirón`, f.tarde <= Math.max(2, f.cuadros * 0.02),
     `${f.tarde} cuadros de ${f.cuadros} por encima de ${TARDE} ms · el peor ${f.peor} ms`);

  const m = await pg.evaluate(() => window.__ritmo.medirDibujo(60));
  console.log(`      (dato: dibujar un cuadro cuesta ${m.neto} ms medido con vaciado forzado, ` +
              `con ${m.notas} notas en la carta)`);
  await pg.close();
}
await nav.close();
cerrar();
