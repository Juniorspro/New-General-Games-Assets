import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
pg.on("pageerror", e=>console.log("ERR:",e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(()=>!!window.PIQUE,{timeout:90000});
await pg.evaluate(()=>localStorage.setItem("pique.v1",JSON.stringify({monedas:0,desbloqueado:6,niveles:{},ajustes:{sonido:false,musica:false,sacudida:true}})));
await pg.reload(); await pg.waitForFunction(()=>!!window.PIQUE,{timeout:90000});
await pg.screenshot({path:"/tmp/p5/menu.png"});
await pg.click("#btn-jugar"); await pg.waitForSelector("#p-mapa:not([hidden])");
await pg.screenshot({path:"/tmp/p5/mapa.png"});
for (const [id,nom] of [["1-1","llano"],["2-2","fantasma"],["3-1","desierto"],["6-4","castillo"]]) {
  const [m,n]=id.split("-").map(Number);
  await pg.evaluate(([m,n])=>window.PIQUE.empezar(m,n),[m,n]);
  await pg.waitForSelector("#p-juego:not([hidden])",{timeout:60000});
  await pg.evaluate(()=>{ const p=window.PIQUE.partida;
    const v=p.bichos.map(b=>b.vivo); p.bichos.forEach(b=>b.vivo=false);
    let prev=false, tope=Math.floor((p.nv.camino?.length??0)*0.38);
    for(let k=0;k<tope;k++){const t=p.nv.camino[k]; p.actualizar({toque:t,toqueNuevo:t&&!prev}); prev=t;}
    p.bichos.forEach((b,i)=>b.vivo=v[i]); p.camara(true); });
  await pg.waitForTimeout(400);
  await pg.screenshot({path:`/tmp/p5/${nom}.png`});
  console.log(nom, "ok");
  await pg.evaluate(()=>window.PIQUE.alMapa());
  await pg.waitForSelector("#p-mapa:not([hidden])");
}
await nav.close();
