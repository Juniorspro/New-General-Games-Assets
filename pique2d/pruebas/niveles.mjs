// Los 24 niveles x 3 colores. Comprueba tres cosas:
//  1. que el nivel valide,
//  2. que el camino del validador se rehaga cuadro por cuadro en una partida
//     real (si no, "validado" no significa nada),
//  3. que NO quede ni una moneda fuera de alcance — que es el reclamo que
//     resulto ser cierto: antes quedaba el 10,9%, y en un nivel el 52%.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage();
const err = []; pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
const res = await pg.evaluate(async () => {
  const { NIVELES, idNivel, V, ALTO_TILES } = await import("./js/mundo.js");
  const { generarNivel, validar } = await import("./js/generador.js");
  const { Partida, ESTADO } = await import("./js/juego.js");
  const out = [];
  for (const cfg of NIVELES) for (const tier of ["rosa","violeta","negra"]) {
    const t0 = performance.now();
    const nv = generarNivel(cfg, tier);
    const ms = Math.round(performance.now() - t0);
    const r = validar(nv, cfg.seg * 60);
    const cerca = (tx,ty) => { for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)
      if(r.visitadas.has(`${tx+dx},${ty+dy}`))return true; return false; };
    let mon=0, inal=0;
    for(let ty=0;ty<ALTO_TILES;ty++)for(let tx=0;tx<nv.ancho;tx++)
      if(nv.grilla[ty*nv.ancho+tx]===V.MONEDA){mon++; if(!cerca(tx,ty))inal++;}
    const colorInal = nv.monedasColor.filter(m=>!cerca(m.tx,m.ty)).length;
    // Los premios de los bloques ?. Se comprueban DOS cosas: que haya hongos
    // —el reclamo fue "no hay casi hongos", y se conto: 1,3 bloques ? por
    // nivel y trece de veinticuatro en cero— y que cada premio este en un
    // bloque al que el jugador llega POR DEBAJO, que es como se golpea uno.
    const prem = Object.entries(nv.premios ?? {});
    const bajo = (tx,ty) => { for(let dx=-1;dx<=1;dx++) for(let dy=1;dy<=2;dy++)
      if(r.visitadas.has(`${tx+dx},${ty+dy}`))return true; return false; };
    const hongos = prem.filter(([,v])=>v==="hongo").length;
    const supers = prem.filter(([,v])=>v==="super").length;
    const premInal = prem.filter(([k])=>{ const [tx,ty]=k.split(",").map(Number); return !bajo(tx,ty); }).length;
    const p = new Partida(nv, tier, window.PIQUE.hojas, null);
    p.bichos = []; p.jefeVivo = false;
    let llego=false, prev=false;
    for (const t of nv.camino ?? []) {
      p.actualizar({ toque:t, toqueNuevo: t && !prev }); prev=t;
      if (p.estado===ESTADO.MASTIL||p.estado===ESTADO.GANADO){llego=true;break;}
      if (p.estado===ESTADO.PERDIDO) break;
    }
    out.push({ id: idNivel(cfg.m,cfg.n), tier, valido: !nv.validacion.fallo, ms,
               mon, inal, colorInal, color: nv.monedasColor.length, llego, estado: p.estado,
               hongos, supers, premInal });
  }
  return out;
});
const fallos = [];
let okV=0, okR=0, monT=0, inalT=0, peor=0, hongoT=0, supT=0;
for (const r of res) {
  if (r.valido) okV++; else fallos.push(`${r.id}/${r.tier}: no valido`);
  if (r.llego) okR++; else fallos.push(`${r.id}/${r.tier}: camino no rehecho (${r.estado})`);
  if (r.color !== 5) fallos.push(`${r.id}/${r.tier}: ${r.color} monedas de color`);
  if (r.inal) fallos.push(`${r.id}/${r.tier}: ${r.inal} monedas inalcanzables`);
  if (r.colorInal) fallos.push(`${r.id}/${r.tier}: ${r.colorInal} monedas de color inalcanzables`);
  if (!r.hongos) fallos.push(`${r.id}/${r.tier}: ni un hongo`);
  if (r.supers !== 1) fallos.push(`${r.id}/${r.tier}: ${r.supers} super hongos (tiene que ser 1)`);
  if (r.premInal) fallos.push(`${r.id}/${r.tier}: ${r.premInal} premios en bloques que no se golpean`);
  monT += r.mon; inalT += r.inal; peor = Math.max(peor, r.ms);
  hongoT += r.hongos; supT += r.supers;
}
console.log(`niveles validados: ${okV}/${res.length}`);
console.log(`caminos rehechos en el juego: ${okR}/${res.length}`);
console.log(`monedas inalcanzables: ${inalT} de ${monT}`);
console.log(`hongos: ${hongoT} en ${res.length} niveles (${(hongoT/res.length).toFixed(1)} por nivel) · ${supT} super`);
console.log(`peor generacion: ${peor} ms`);
console.log(`errores de javascript: ${err.length ? err.slice(0,3).join(" | ") : "ninguno"}`);
if (fallos.length) { console.log("FALLOS:"); fallos.slice(0,10).forEach(f=>console.log("  - "+f)); }
await nav.close();
process.exit(fallos.length || err.length ? 1 : 0);
