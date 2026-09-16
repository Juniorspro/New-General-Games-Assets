// Desbloqueo y recuperacion ante errores.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport:{width:390,height:780}, hasTouch:true, isMobile:true });
const err=[]; pg.on("pageerror", e=>err.push(e.message));
const ok=[], mal=[]; const ch=(n,c,x="")=>(c?ok:mal).push(n+(x?` — ${x}`:""));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(()=>!!window.PIQUE,{timeout:60000});
await pg.evaluate(()=>localStorage.clear());
await pg.reload(); await pg.waitForFunction(()=>!!window.PIQUE,{timeout:60000});

await pg.tap("#btn-jugar"); await pg.waitForSelector("#p-mapa:not([hidden])");
const abiertos = () => pg.evaluate(()=>[...document.querySelectorAll(".nivel")].filter(b=>!b.disabled).map(b=>b.dataset.nivel));
ch("de arranque solo esta abierto el 1-1", JSON.stringify(await abiertos()) === '["1-1"]',
   JSON.stringify(await abiertos()));

// Ganar el 1-1 llevando al jugador al mastil.
await pg.tap('[data-nivel="1-1"]');
await pg.waitForSelector("#p-juego:not([hidden])",{timeout:40000});
await pg.evaluate(()=>{ const p=window.PIQUE.partida;
  p.bichos=[]; p.jefeVivo=false;
  p.j.x = p.nv.mastilX*16 + 2; p.j.y = (p.nv.pisoMastil - 5)*16; p.j.vy = 0; });
await pg.waitForSelector("#p-resultado:not([hidden])",{timeout:20000});
ch("gana al llegar al mastil", (await pg.textContent("#res-titulo")).includes("Llegaste"));
await pg.tap("#res-mapa"); await pg.waitForSelector("#p-mapa:not([hidden])");
const ab2 = await abiertos();
ch("ganar el 1-1 abre el 1-2 y nada mas", JSON.stringify(ab2) === '["1-1","1-2"]', JSON.stringify(ab2));
ch("no abre el mundo entero", !ab2.includes("1-4"));

// Un nivel cerrado no se puede tocar.
const cerrado = await pg.evaluate(()=>{ const b=document.querySelector('[data-nivel="1-3"]');
  return { deshabilitado: b.disabled, marca: b.classList.contains("cerrado") }; });
ch("el 1-3 esta cerrado y marcado", cerrado.deshabilitado && cerrado.marca);

// La guardia: se inyecta un error en la logica y el juego tiene que
// recuperarse en vez de quedarse quieto.
await pg.tap('[data-nivel="1-2"]');
await pg.waitForSelector("#p-juego:not([hidden])",{timeout:40000});
await pg.evaluate(()=>{ window.PIQUE.partida.actualizar = () => { throw new Error("falla de prueba"); }; });
await pg.waitForTimeout(1200);
const rec = await pg.evaluate(()=>({ resultado: !document.querySelector("#p-resultado").hidden,
  titulo: document.querySelector("#res-titulo").textContent,
  partida: !!window.PIQUE.partida }));
ch("un error en la logica no cuelga el juego", rec.resultado && !rec.partida,
   `${rec.titulo} · partida=${rec.partida}`);
await pg.tap("#res-mapa"); await pg.waitForSelector("#p-mapa:not([hidden])");
ch("y se puede volver al mapa despues del error", true);

await nav.close();
for(const o of ok) console.log("  ✓ "+o);
for(const f of mal) console.log("  ✗ "+f);
console.log(`\n${ok.length}/${ok.length+mal.length}`);
process.exit(mal.length?1:0);
