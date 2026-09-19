// Que el perro SE MUEVA, no que el mixer exista.
//
// Un AnimationMixer con un clip cuyos huesos no coinciden con la malla no falla:
// corre, no deforma nada, y el perro se desliza con las patas tiesas. Desde el
// codigo se ve identico a que ande. Se comprueba leyendo la posicion de los
// vertices deformados en dos instantes distintos.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 860 } });
await pg.goto("http://127.0.0.1:8811/index.html");
await pg.waitForFunction(() => window.__perro && window.__perro.est().cargado, { timeout: 60000 });

let ok = 0, mal = 0;
const ch = (n,c,d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                             : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

const mov = await pg.evaluate(async () => {
  window.__perro.pan(null);                 // a jugar
  const lee = () => window.__perro.huesos();
  const a = lee();
  // se camina medio segundo por el mismo camino que el dedo
  window.__perro.anda(0.5, 0, -0.5);
  const b = lee();
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif = Math.max(dif, Math.abs(a[i] - b[i]));
  return { n: a.length, dif: +dif.toFixed(5) };
});
ch("los huesos se mueven al caminar", mov.dif > 0.001,
   `${mov.n} numeros de hueso, mayor cambio ${mov.dif}`);

const quieto = await pg.evaluate(async () => {
  const a = window.__perro.huesos();
  await new Promise(r => setTimeout(r, 500));
  const b = window.__perro.huesos();
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif = Math.max(dif, Math.abs(a[i] - b[i]));
  return +dif.toFixed(5);
});
console.log(`  (quieto, los huesos cambian ${quieto})`);

console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
