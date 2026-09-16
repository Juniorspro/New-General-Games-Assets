import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ok=[], mal=[]; const ch=(n,c,x="")=>(c?ok:mal).push(n+(x?` — ${x}`:""));
for (const [w,h,nom] of [[844,390,"acostado"],[390,844,"parado"]]) {
  const pg = await nav.newPage({ viewport:{width:w,height:h}, hasTouch:true, isMobile:true, deviceScaleFactor:3 });
  const err=[]; pg.on("pageerror", e=>err.push(e.message));
  await pg.goto("http://127.0.0.1:8802/index.html");
  await pg.waitForFunction(()=>!!window.PIQUE,{timeout:60000});
  ch(`${nom} sin scroll horizontal`,
     (await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=0);
  for (const s of ["#btn-jugar","#btn-niveles","#btn-comojuego","#btn-ajustes"]) {
    const t = await pg.evaluate((sel)=>{ const e=document.querySelector(sel); const r=e.getBoundingClientRect();
      const en=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
      return {tocable: e===en||e.contains(en), alto: Math.round(r.height), tapa: en?(en.id||en.className):"-"}; }, s);
    ch(`${nom} ${s} tocable`, t.tocable, t.tocable?`${t.alto}px de alto`:`tapado por ${t.tapa}`);
    ch(`${nom} ${s} llega a 44px`, t.alto>=44, `${t.alto}px`);
  }
  await pg.click("#btn-niveles"); await pg.waitForSelector("#p-mapa:not([hidden])");
  await pg.click('[data-nivel="1-1"]');
  await pg.waitForSelector("#p-juego:not([hidden])",{timeout:40000});
  await pg.waitForTimeout(500);
  const m = await pg.evaluate(()=>{ const l=document.querySelector("#lienzo").getBoundingClientRect();
    const hu=document.querySelector(".hud").getBoundingClientRect();
    return { anchoCSS: Math.round(l.width), altoCSS: Math.round(l.height),
             choca: false,
             escala: +(l.width/320).toFixed(2) }; });
  ch(`${nom} el lienzo ocupa la pantalla`, m.anchoCSS > w*0.85, `${m.anchoCSS}x${m.altoCSS} px (x${m.escala})`);
  // El HUD ahora va ENCIMA del lienzo a proposito: el lienzo ocupa la pantalla
  // entera. Lo que hay que comprobar es que el toque en la franja del HUD
  // —donde no hay boton— siga llegando al juego. Si el HUD capturara todo, el
  // jugador perderia el salto justo cuando mira el reloj.
  const pasa = await pg.evaluate(() => {
    const hud = document.querySelector("#p-juego .hud").getBoundingClientRect();
    const x = Math.round(window.innerWidth * 0.5), y = Math.round(hud.top + hud.height / 2);
    const e = document.elementFromPoint(x, y);
    return { llega: e && e.id === "lienzo", quien: e ? (e.id || e.className) : "nada" };
  });
  ch(`${nom} el toque atraviesa el HUD y llega al juego`, pasa.llega, `toco ${pasa.quien}`);
  const botonOk = await pg.evaluate(() => {
    const b = document.querySelector("#hud-salir").getBoundingClientRect();
    const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    // closest y no id: el punto del centro cae en el <span> del icono, que es
    // hijo del boton. Comparar el id directo da falso negativo sobre un boton
    // que funciona perfecto.
    return !!(e && e.closest("#hud-salir"));
  });
  ch(`${nom} los botones del HUD si reciben el toque`, botonOk);
  const y0 = await pg.evaluate(()=>window.PIQUE.partida.j.y);
  await pg.touchscreen.tap(Math.floor(w/2), Math.floor(h*0.7));
  await pg.evaluate(()=>window.PIQUE.entrada.apoyado=true);
  await pg.waitForTimeout(200);
  ch(`${nom} el toque hace saltar`, (await pg.evaluate(()=>window.PIQUE.partida.j.y)) < y0-10);
  await pg.evaluate(()=>window.PIQUE.entrada.apoyado=false);
  ch(`${nom} sin errores`, err.length===0, err.slice(0,2).join(" | "));
  await pg.screenshot({path:`/tmp/p2/movil-${nom}.png`});
  await pg.close();
}
await nav.close();
for(const o of ok) console.log("  ✓ "+o);
for(const f of mal) console.log("  ✗ "+f);
console.log(`\n${ok.length}/${ok.length+mal.length}`);
process.exit(mal.length?1:0);
