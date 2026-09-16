import { chromium } from "playwright";
import fs from "fs";
const D="/tmp/g2"; fs.rmSync(D,{recursive:true,force:true}); fs.mkdirSync(D,{recursive:true});
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 390, height: 780 } });
pg.on("pageerror", e => console.log("ERROR:", e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pg.evaluate(() => localStorage.setItem("pique.v1", JSON.stringify({monedas:0,desbloqueado:6,niveles:{},ajustes:{sonido:false,musica:false,sacudida:true}})));
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pg.evaluate(() => window.PIQUE.empezar(1,1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
await pg.evaluate(() => {
  const p = window.PIQUE.partida;
  window.__i = 0;
  window.__av = (n) => { for (let k=0;k<n;k++){
    const t=p.nv.camino[window.__i]??false, pv=p.nv.camino[window.__i-1]??false;
    p.actualizar({toque:t, toqueNuevo:t&&!pv}); window.__i++; }
    p.dibujar(document.querySelector("#lienzo").getContext("2d")); };
});
const clip = await pg.evaluate(() => { const r=document.querySelector("#lienzo").getBoundingClientRect();
  return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}; });
for (let i=0;i<110;i++){ await pg.evaluate(()=>window.__av(2)); await pg.screenshot({path:`${D}/f_${String(i).padStart(3,"0")}.png`, clip}); }
console.log("cuadros:", fs.readdirSync(D).length);
await nav.close();
