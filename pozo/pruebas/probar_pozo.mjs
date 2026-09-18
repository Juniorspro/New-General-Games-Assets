// Comprueba lo que el usuario oye y ve, no lo que el codigo dice que hace.
import { chromium } from "playwright";
const ARCH = process.argv[2];
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, hasTouch: true });
const err = [];
pg.on("pageerror", e => err.push(e.message));
pg.on("console", m => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 140)); });

await pg.addInitScript(() => {
  const O = window.AudioContext || window.webkitAudioContext;
  window.__ana = null;
  function P(...a) {
    const c = new O(...a);
    if (!window.__ana) {
      const an = c.createAnalyser(); an.fftSize = 2048; window.__ana = an;
      const cn = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (d, ...r) {
        if (d === c.destination) { try { cn.call(this, an); } catch (e) {} }
        return cn.call(this, d, ...r); };
    }
    return c; }
  P.prototype = O.prototype;
  window.AudioContext = window.webkitAudioContext = P;
  window.__rms = (ms) => new Promise(k => { const an = window.__ana; if (!an) return k(null);
    const b = new Float32Array(an.fftSize), v = [], t0 = performance.now();
    (function p(){ an.getFloatTimeDomainData(b); let s = 0;
      for (let i = 0; i < b.length; i++) s += b[i]*b[i]; v.push(Math.sqrt(s/b.length));
      performance.now()-t0 < ms ? requestAnimationFrame(p)
        : k(v.reduce((a,x)=>a+x,0)/v.length); })(); });
});

await pg.goto("file://" + ARCH);
await pg.waitForTimeout(2500);
await (await pg.$("#idL button")).click();
await pg.waitForTimeout(5000);

const au = await pg.evaluate(() => window.__pozo.audio());
ch("las 19 muestras decodifican, ninguna falla", au.n === 19 && au.mal === 0, JSON.stringify(au));
ch("en el menu suena la pista del menu", au.mus === "m_menu");

// La cama mide 9 s de bucle en el original; con pistas de 35-38 s hay que medir
// una ventana larga o el numero baila con el tramo que toque.
const menu = await pg.evaluate(() => window.__rms(9000));
ch("el menu suena", menu > .012, `rms ${menu.toFixed(4)}`);

await pg.click("#mJugar");
await pg.waitForTimeout(3000);
const au2 = await pg.evaluate(() => window.__pozo.audio());
ch("al jugar cambia a la pista de pelea", au2.mus === "m_pelea");
const juego = await pg.evaluate(() => window.__rms(9000));
ch("en partida suena", juego > .004, `rms ${juego.toFixed(4)}`);

// LA REGLA DEL PROPIO JUEGO: el fondo tiene que quedar DEBAJO del acontecimiento.
const disp = await pg.evaluate(async () => {
  const an = window.__ana, b = new Float32Array(an.fftSize); let pico = 0;
  const t0 = performance.now();
  document.querySelector("#bTira").dispatchEvent(new PointerEvent("pointerdown", {bubbles:true, pointerId:1, isPrimary:true}));
  while (performance.now() - t0 < 900) {
    an.getFloatTimeDomainData(b); let s = 0;
    for (let i = 0; i < b.length; i++) s += b[i]*b[i];
    pico = Math.max(pico, Math.sqrt(s / b.length));
    await new Promise(r => requestAnimationFrame(r));
  }
  document.querySelector("#bTira").dispatchEvent(new PointerEvent("pointerup", {bubbles:true, pointerId:1, isPrimary:true}));
  return pico; });
ch("el disparo se oye POR ENCIMA de la musica", disp > juego * 1.6,
   `disparo ${disp.toFixed(4)} contra fondo ${juego.toFixed(4)} = ${(disp/juego).toFixed(2)}x`);

ch("sin errores de javascript", err.length === 0, err.slice(0, 3).join(" | "));
console.log(`\n  ${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
