// Que SUENE, y que el ladrido se oiga POR ENCIMA de la musica.
//
// Contar osciladores no sirve: un oscilador conectado a una ganancia en cero
// existe y no suena. Se cuelga un analizador de lo que sale por los parlantes.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
await pg.goto("http://127.0.0.1:8811/index.html");
await pg.waitForFunction(() => window.__perro && window.__perro.est().cargado, { timeout: 60000 });

let ok = 0, mal = 0;
const ch = (n,c,d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                             : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

// media sobre ventana larga para el fondo, pico para el acontecimiento
await pg.evaluate(() => {
  window.__med = (ms) => new Promise(k => { const v = [], t0 = performance.now();
    (function p(){ v.push(window.__perro.rms());
      performance.now()-t0 < ms ? requestAnimationFrame(p)
        : k(v.reduce((a,x)=>a+x,0)/v.length); })(); });
  window.__pico = (ms) => new Promise(k => { let m = 0; const t0 = performance.now();
    (function p(){ m = Math.max(m, window.__perro.rms());
      performance.now()-t0 < ms ? requestAnimationFrame(p) : k(m); })(); });
});

const antes = await pg.evaluate(() => window.__med(500));
ch("callado antes del primer gesto", antes < 0.0005, `rms ${antes.toFixed(5)}`);

await pg.click("#mJugar");
await pg.waitForTimeout(2500);
const au = await pg.evaluate(() => window.__perro.audio());
console.log("  estado del audio:", JSON.stringify(au));

const fondo = await pg.evaluate(() => window.__med(9000));
ch("en partida suena el fondo", fondo > 0.004, `rms ${fondo.toFixed(4)}`);

// SE FRENA EL DIBUJO PARA MEDIR EL LADRIDO. Con la tarjeta por software un
// cuadro tarda medio segundo y el ladrido dura 190 ms: el analizador, que se lee
// al ritmo del dibujo, se lo saltea entero. Sin esto la medicion dice 1,39x
// cuando lo que falla es el instrumento.
await pg.evaluate(() => window.__perro.dibujo(false));
await pg.waitForTimeout(300);

// El ladrido por el MISMO camino que el dedo.
const pico = await pg.evaluate(async () => {
  const p = window.__pico(1200);
  const b = document.querySelector("#bLadra");
  b.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true, pointerId:1, isPrimary:true}));
  return await p;
});
const ladrido = Math.sqrt(Math.max(0, pico*pico - fondo*fondo));
ch("el ladrido se oye POR ENCIMA del fondo", ladrido > fondo * 2,
   `ladrido ${ladrido.toFixed(4)} contra fondo ${fondo.toFixed(4)} = ${(ladrido/fondo).toFixed(2)}x`);
ch("el boton contó el ladrido", (await pg.evaluate(() => window.__perro.est().ladridos)) > 0);
await pg.evaluate(() => window.__perro.dibujo(true));

// LA ESPERA ENTRE LADRIDOS: apretando rapido no se tienen que apilar.
//
// LOS DIEZ TOQUES VAN SIN `await` EN EL MEDIO, TODOS EN EL MISMO TURNO. La
// primera version ponia `setTimeout(30)` entre uno y otro creyendo que eso eran
// 30 ms; medido, con la pagina dibujando cada uno tardaba entre 245 y 553 ms y
// los diez ocupaban 3,7 SEGUNDOS. O sea que la prueba decia "diez toques
// seguidos" y estaba haciendo diez toques espaciados, y fallaba contra un
// rebote que funcionaba bien. Sin `await`, los diez caen en el mismo
// milisegundo y la prueba mide lo que dice medir.
const n = await pg.evaluate(() => {
  const b = document.querySelector("#bLadra"), a = window.__perro.est().ladridos;
  for (let i = 0; i < 10; i++)
    b.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true, pointerId:1, isPrimary:true}));
  return window.__perro.est().ladridos - a;
});
ch("diez toques en el mismo instante dan un solo ladrido", n === 1, `dio ${n}`);

// En el menu el fondo tiene que sonar MAS que en partida: no compite con nada.
await pg.evaluate(() => window.__perro.pan("menu"));
await pg.waitForTimeout(2000);
const menu = await pg.evaluate(() => window.__med(7000));
ch("el menu suena mas fuerte que la partida", menu > fondo,
   `menu ${menu.toFixed(4)} contra partida ${fondo.toFixed(4)}`);

console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
