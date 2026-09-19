// El terreno tiene que tener lomas de verdad, y el perro tiene que apoyar
// EXACTAMENTE sobre lo que se ve. Las dos cosas se miden.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 860 } });
await pg.goto("http://127.0.0.1:8811/index.html");
await pg.waitForFunction(() => window.__perro && window.__perro.est().cargado, { timeout: 60000 });

let ok = 0, mal = 0;
const ch = (n, c, d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                               : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

const r = await pg.evaluate(async () => {
  const { altura, LIMITE } = await import("/js/terreno.js");
  const v = [];
  for (let i = 0; i < 4000; i++) {
    const x = (Math.random()*2-1)*LIMITE, z = (Math.random()*2-1)*LIMITE;
    v.push(altura(x, z));
  }
  const min = Math.min(...v), max = Math.max(...v);
  const med = v.reduce((a,b)=>a+b,0)/v.length;
  const dist = new Set(v.map(x => x.toFixed(2))).size;
  // cuanto cambia la altura entre puntos vecinos: si da 0 el campo es plano
  let pend = 0;
  for (let i = 0; i < 500; i++) {
    const x = (Math.random()*2-1)*LIMITE*0.8, z = (Math.random()*2-1)*LIMITE*0.8;
    pend = Math.max(pend, Math.abs(altura(x+2, z) - altura(x, z)));
  }
  return { min:+min.toFixed(2), max:+max.toFixed(2), med:+med.toFixed(2), dist,
           pend:+pend.toFixed(3) };
});
ch("el campo tiene lomas y valles, no es plano", r.max - r.min > 5,
   `de ${r.min} a ${r.max}, ${r.dist} alturas distintas`);
ch("hay pendientes que se caminan", r.pend > 0.15 && r.pend < 4,
   `hasta ${r.pend} de subida cada 2 unidades`);

const peor = await pg.evaluate(() => window.__perro.pegadoAlSuelo(600));
ch("el perro apoya sobre el suelo que se ve", peor < 0.0005, `peor despegue ${peor}`);

console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
