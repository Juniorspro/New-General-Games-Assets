// EL RELOJ NO SE CORRE AUNQUE EL DIBUJO SE TRABE.
//
// Es LA propiedad de un juego de ritmo. Contando el tiempo con rAF, un teléfono
// que baja a 40 cuadros pierde milisegundos en cada vuelta y a los treinta
// segundos la música y las notas ya no coinciden: se siente como que el juego
// "no toma" los toques, y en realidad se corrió el reloj. Acá se traba el hilo
// a propósito y se exige que la canción haya seguido su curso igual.
import { chromium } from "playwright";
import { ch, cerrar } from "./_ch.mjs";
import path from "path";

const ARCHIVO = path.resolve(process.argv[2] || "ritmo-en-un-archivo.html");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
const err = [];
pg.on("pageerror", (e) => err.push(e.message.slice(0, 140)));
await pg.goto("file://" + ARCHIVO);
await pg.waitForTimeout(500);
await pg.evaluate(() => { window.__ritmo.ir("menu"); window.__ritmo.empezar(6); });
/* SE ESPERA A QUE LA MELODIA HAYA ARRANCADO. Trabando el hilo durante la intro
   no pasa ninguna nota, así que la prueba daba "0 errores de 0" y parecía que
   el juego perdía notas cuando lo que faltaba era llegar a tenerlas. */
await pg.evaluate(() => new Promise((listo) => {
  const R = window.__ritmo, primera = R.carta()[0].t;
  const esperar = () => (R.tiempo() > primera + 2 ? listo() : requestAnimationFrame(esperar));
  esperar();
}));

const r = await pg.evaluate(() => new Promise((listo) => {
  const R = window.__ritmo;
  const antes = R.tiempo();
  const pared0 = performance.now();
  // SE TRABA EL HILO A LO BRUTO: 700 ms sin ceder, que es lo que pasa cuando
  // el navegador recolecta basura o el teléfono decide hacer otra cosa.
  while (performance.now() - pared0 < 700) { /* a propósito */ }
  const pared = (performance.now() - pared0) / 1000;
  const despues = R.tiempo();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    listo({ antes, despues, pared, estado: R.estado() });
  }));
}));
const avanzo = r.despues - r.antes;
ch("con el hilo trabado 700 ms, la canción avanzó 700 ms",
   Math.abs(avanzo - r.pared) < 0.05,
   `pared ${(r.pared * 1000).toFixed(0)} ms · canción ${(avanzo * 1000).toFixed(0)} ms · diferencia ${((avanzo - r.pared) * 1000).toFixed(1)} ms`);
ch("las notas que pasaron durante la traba cuentan como error y no desaparecen",
   r.estado.juzgadas > 0 && r.estado.cuenta.error === r.estado.juzgadas,
   `${r.estado.cuenta.error} errores de ${r.estado.juzgadas} juzgadas`);

// Y sigue jugable después del bache: el que se traba no queda arruinado.
const sigue = await pg.evaluate(() => new Promise((listo) => {
  const R = window.__ritmo, z = document.querySelectorAll("#zonas div");
  const notas = R.carta(); const t0 = R.tiempo();
  let i = notas.findIndex((n) => n.t > t0 + 0.4);
  const sueltas = [];
  const tic = () => {
    const t = R.tiempo();
    while (i >= 0 && i < notas.length && notas[i].t <= t + 0.004) {
      const n = notas[i++], id = 40 + n.carril;
      z[n.carril].dispatchEvent(new PointerEvent("pointerdown", { pointerId: id, bubbles: true, cancelable: true }));
      sueltas.push({ c: n.carril, id, cuando: n.t + (n.largo || 0.04) });
    }
    for (let k = sueltas.length - 1; k >= 0; k--) if (sueltas[k].cuando <= t) {
      const s = sueltas.splice(k, 1)[0];
      z[s.c].dispatchEvent(new PointerEvent("pointerup", { pointerId: s.id, bubbles: true, cancelable: true }));
    }
    if (t > t0 + 8) { listo(R.estado()); return; }
    requestAnimationFrame(tic);
  };
  tic();
}));
const perfectasDespues = sigue.cuenta.perfecto;
ch("después del bache se vuelve a acertar", perfectasDespues > 5,
   `${perfectasDespues} perfectas después de la traba`);
ch("ningún error de JavaScript", err.length === 0, err[0] || "");
await nav.close();
cerrar();
