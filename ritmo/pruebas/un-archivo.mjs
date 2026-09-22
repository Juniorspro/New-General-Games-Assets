// EL ARCHIVO UNICO, DESDE file:// — que es como lo va a abrir cualquiera.
// Servido por un servidor anda aunque falte la mitad del empaquetado: los
// módulos sueltos cargan igual. Esta prueba es la única que lo dice de verdad.
import { chromium } from "playwright";
import { ch, cerrar } from "./_ch.mjs";
import path from "path";

const ARCHIVO = path.resolve(process.argv[2] || "ritmo-en-un-archivo.html");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
const err = [], afuera = [];
pg.on("pageerror", (e) => err.push(e.message.slice(0, 140)));
pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 120)); });
pg.on("request", (r) => { const u = r.url();
  if (!u.startsWith("data:") && !u.startsWith("blob:") && u !== "file://" + ARCHIVO) afuera.push(u.slice(0, 70)); });

await pg.goto("file://" + ARCHIVO);
await pg.waitForTimeout(900);

ch("abre y expone la sonda", await pg.evaluate(() => typeof window.__ritmo === "object"));
ch("arranca en la pantalla de idiomas", (await pg.evaluate(() => window.__ritmo.pantallaActual())) === "idioma");
ch("no pide un solo archivo de afuera", afuera.length === 0, afuera[0] || "");

// se recorre el menú entero, como un dedo
await pg.click("#listaIdiomas button:nth-child(2)");
ch("elegir idioma lleva al menú", (await pg.evaluate(() => window.__ritmo.pantallaActual())) === "menu");
/* EL BOTON "VOLVER" ESTA EN TRES PANTALLAS A LA VEZ. Buscarlo por
   `[data-ir=menu]` a secas agarra el primero del documento, que suele ser el de
   una pantalla escondida, y el clic espera para siempre a que se haga visible.
   Se acota a la pantalla que está prendida. */
const volver = (p) => pg.click(`#p${p} [data-ir=menu]`);
for (const [boton, destino, pantalla] of [["#bComo", "como", "Como"],
                                          ["#bAjustes", "ajustes", "Ajustes"],
                                          ["#bJugar", "lista", "Lista"]]) {
  await pg.click(boton);
  ch(`el botón ${boton} lleva a ${destino}`,
     (await pg.evaluate(() => window.__ritmo.pantallaActual())) === destino);
  if (destino !== "lista") await volver(pantalla);
}

ch("sólo la primera canción está abierta",
   (await pg.evaluate(() => document.querySelectorAll(".pista.cerrada").length)) === 8);

// y se juega de verdad, con eventos de puntero
await pg.evaluate(() => window.__ritmo.empezar(1));
const r = await pg.evaluate(() => new Promise((listo) => {
  const R = window.__ritmo, z = document.querySelectorAll("#zonas div");
  const notas = R.carta(); let i = 0; const sueltas = [];
  const tic = () => {
    const t = R.tiempo();
    while (i < notas.length && notas[i].t <= t + 0.004) {
      const n = notas[i++], id = 30 + n.carril;
      z[n.carril].dispatchEvent(new PointerEvent("pointerdown", { pointerId: id, bubbles: true, cancelable: true }));
      sueltas.push({ c: n.carril, id, cuando: n.t + (n.largo || 0.04) });
    }
    for (let k = sueltas.length - 1; k >= 0; k--) if (sueltas[k].cuando <= t) {
      const s = sueltas.splice(k, 1)[0];
      z[s.c].dispatchEvent(new PointerEvent("pointerup", { pointerId: s.id, bubbles: true, cancelable: true }));
    }
    if (t > 14) { listo(R.estado()); return; }
    requestAnimationFrame(tic);
  };
  tic();
}));
ch("tocando por la pantalla, las notas entran", r.juzgadas > 8 && r.cuenta.error === 0,
   `${r.juzgadas} juzgadas, ${r.cuenta.perfecto} perfectas, ${r.cuenta.error} errores`);
ch("el puntaje sube", r.puntos > 0, `${r.puntos} puntos`);

ch("ningún error de JavaScript en todo el recorrido", err.length === 0, err[0] || "");
await nav.close();
cerrar();
