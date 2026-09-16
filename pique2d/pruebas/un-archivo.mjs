import { chromium } from "playwright";
import path from "path";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 900, height: 560 } });
const err = [];
pg.on("pageerror", e => err.push(e.message));
pg.on("console", m => { if (m.type()==="error") err.push("consola: "+m.text().slice(0,120)); });
const ok=[], mal=[]; const ch=(n,c,x="")=>(c?ok:mal).push(n+(x?` — ${x}`:""));
await pg.goto("file://" + path.resolve("pique-en-un-archivo.html"));
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
ch("abre desde file:// y arranca", true);
// El numero NO se escribe a mano: se pregunta cuantas hojas pide el juego.
// Escrito a mano, agregar una hoja deja la prueba en verde contando las de
// antes, que es como una prueba deja de probar.
const nHojas = await pg.evaluate(()=>Object.keys(window.PIQUE.hojas).length + window.PIQUE.faltan.length);
ch(`las ${nHojas} hojas de sprites cargaron del propio archivo`,
   (await pg.evaluate(()=>window.PIQUE.faltan)).length===0,
   JSON.stringify(await pg.evaluate(()=>window.PIQUE.faltan)));
const ext = await pg.evaluate(()=>[...document.querySelectorAll("link[href],script[src],img[src]")]
  .map(e=>e.getAttribute("href")||e.getAttribute("src")).filter(u=>u&&!u.startsWith("data:")));
ch("no pide ni un archivo suelto", ext.length===0, ext.join(", "));
await pg.click("#btn-jugar"); await pg.waitForSelector("#p-mapa:not([hidden])");
ch("el mapa lista los 24 niveles", (await pg.$$(".nivel")).length===24);
await pg.click('[data-nivel="1-1"]');
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
ch("genera y valida un nivel", /validado/.test(await pg.textContent("#hud-gen")), await pg.textContent("#hud-gen"));
const y0 = await pg.evaluate(()=>window.PIQUE.partida.j.y);
await pg.keyboard.down("Space"); await pg.waitForTimeout(220);
ch("salta", (await pg.evaluate(()=>window.PIQUE.partida.j.y)) < y0-12);
await pg.keyboard.up("Space");
const x0 = await pg.evaluate(()=>window.PIQUE.partida.j.x);
await pg.waitForTimeout(450);
ch("corre solo", (await pg.evaluate(()=>window.PIQUE.partida.j.x)) > x0+40);
const an = await pg.evaluate(()=>{ const h=window.PIQUE.hojas.heroe_correr;
  return h ? {n:h.n, cw:h.cw, rw:h.r.w, rh:h.r.h} : null; });
ch("la animacion de correr tiene 16 cuadros", an && an.n===16, JSON.stringify(an));
const nv = await pg.evaluate(()=>{ const o=[]; for(const c of window.PIQUE.NIVELES){
  const n=M_generador.generarNivel(c,"rosa"); o.push({ok:!n.validacion.fallo,col:n.monedasColor.length}); } return o; });
ch("los 24 niveles validan adentro del archivo", nv.every(x=>x.ok&&x.col===5), `${nv.filter(x=>x.ok).length}/24`);
ch("sobrevive sin poder guardar", await pg.evaluate(()=>{ const o=Storage.prototype.setItem;
  Storage.prototype.setItem=()=>{throw new Error("x")};
  try{M_guardado.guardar();return true}catch(e){return false}finally{Storage.prototype.setItem=o} }));
ch("sin errores de javascript", err.length===0, err.slice(0,2).join(" | "));
await nav.close();
for(const o of ok) console.log("  ✓ "+o);
for(const f of mal) console.log("  ✗ "+f);
console.log(`\n${ok.length}/${ok.length+mal.length}`);
process.exit(mal.length?1:0);
