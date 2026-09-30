// KUNTUR con el teléfono parado, probado con toques de verdad (CDP Input.dispatchTouchEvent)
// en un Chromium que se hace pasar por celular (390×844, isMobile, hasTouch):
//   - parado no se gira, y la vista y la bandeja de los dedos no se pisan;
//   - se elige idioma, se recorren los menús y se pasa la charla del principio tocando;
//   - se camina con el joystick y se salta con la pluma (con el mundo congelado, de a pasos);
//   - la pausa, las opciones y el editor de los controles (arrastrar un botón guarda posV y no pos);
//   - nada se sale de la pantalla en 390×844, 360×740 y 412×915 (menús, pausa, globos, créditos);
//   - acostado (844×390) sigue igual que antes, y "Girado" en las opciones sigue girando;
//   - ningún error en la consola.
// Las capturas van a kuntur/pruebas/salida/ (no se commitean).
//     node kuntur/herramientas/armar.mjs && node kuntur/pruebas/vertical.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SALIDA = path.join(AQUI, "salida");
fs.mkdirSync(SALIDA, { recursive: true });
const HTML = path.resolve(process.argv[2] || path.join(AQUI, "../kuntur.html"));

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const pag = await ctx.newPage();
const errores = [];
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 300)); });
const cdp = await ctx.newCDPSession(pag);
let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; return ok; };
const esperar = (fn, arg, max = 180000) => pag.waitForFunction(fn, arg, { timeout: max, polling: 150 });
const dormir = (ms) => pag.waitForTimeout(ms);
const foto = (n) => pag.screenshot({ path: path.join(SALIDA, n + ".png") });

/* ---------------- los dedos: cada uno con su id; los que faltan en un touchMove se sueltan ---------------- */
const dedos = new Map();
const mandar = (type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [...dedos.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id })) });
const apoyar = async (id, x, y) => { dedos.set(id, { x, y }); await mandar("touchStart"); };
const mover = async (id, x, y) => { dedos.set(id, { x, y }); await mandar("touchMove"); };
const levantar = async (id) => { dedos.delete(id); await mandar(dedos.size ? "touchMove" : "touchEnd"); };
const tocar = async (x, y) => { await apoyar(9, x, y); await dormir(60); await levantar(9); };
const centro = (sel) => pag.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
const tocarEl = async (sel) => { const c = await centro(sel); if (!c) throw new Error("no está " + sel); await tocar(c.x, c.y); return c; };
/* un boleto del menú por su clave (data-k) o por su texto */
const tocarBoleto = async (k) => { const c = await pag.evaluate((k) => { const b = [...document.querySelectorAll(".boleto")].find((e) => e.dataset.k === k || e.textContent.includes(k)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, k); if (!c) throw new Error("no está el boleto " + k); await tocar(c.x, c.y); };

/* ---------------- ¿algo se sale? ----------------
   Del menú que se está viendo, cada elemento visible tiene que entrar en la pantalla (a lo
   ancho, sin desborde horizontal) y no quedar cortado; en los paneles con lista, sin scroll. */
const desborde = (nombre, sel) => pag.evaluate(({ sel }) => {
  const W = innerWidth, H = innerHeight, malos = [];
  if (document.documentElement.scrollWidth > W + 1 || document.body.scrollWidth > W + 1) malos.push("scroll horizontal " + document.documentElement.scrollWidth);
  for (const raiz of document.querySelectorAll(sel)) {
    for (const e of [raiz, ...raiz.querySelectorAll("*")]) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) malos.push(`${e.className || e.tagName} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]`);
    }
    for (const e of raiz.querySelectorAll(".tablero")) if (e.scrollHeight > e.clientHeight + 2) malos.push(`tablero con scroll ${e.scrollHeight}>${e.clientHeight}`);
  }
  return malos.slice(0, 6);
}, { sel }).then((m) => ver(!m.length, `${nombre}: nada se sale de ${pag.viewportSize().width}×${pag.viewportSize().height}${m.length ? " — " + m.join(" · ") : ""}`));

/* ---------------- 1. el idioma ---------------- */
await pag.goto("file://" + HTML);
await esperar(() => window.__K && document.querySelectorAll(".idioma .tag").length === 3);
await dormir(1800);
const est = await pag.evaluate(() => ({ app: document.getElementById("app").style.transform, clases: document.documentElement.className, giro: window.__K.op.parado }));
ver(est.app === "" && est.clases.includes("vertical") && !est.clases.includes("girado"), `parado no se gira (#app "${est.app}", clases "${est.clases}", de fábrica "${est.giro}")`);
await foto("v-idioma");
await desborde("idioma", ".idioma");
await tocarEl(".idioma .tag:nth-child(1)");
await esperar(() => window.__K.estado === "titulo" && !document.querySelector(".telon").classList.contains("cerrado"));
await dormir(2200);

/* ---------------- 2. la vista y la bandeja ---------------- */
const caja = await pag.evaluate(() => { const c = document.getElementById("c").getBoundingClientRect(), b = document.querySelector(".bandeja").getBoundingClientRect(), t = document.querySelector(".telon").getBoundingClientRect(); return { c: [c.top, c.bottom, c.width], b: [b.top, b.bottom], t: t.bottom, H: innerHeight, W: innerWidth, fov: window.__K.E.camara.fov, asp: window.__K.E.camara.aspect }; });
ver(caja.c[1] <= caja.b[0] + 0.5 && caja.b[1] >= caja.H - 0.5 && caja.c[2] === caja.W, `la vista (0–${Math.round(caja.c[1])} px) y la bandeja (${Math.round(caja.b[0])}–${Math.round(caja.b[1])} px) no se pisan`);
ver(caja.c[1] / caja.H > 0.6 && caja.c[1] / caja.H < 0.67, `la vista ocupa el ${Math.round(caja.c[1] / caja.H * 100)} % del alto`);
ver(Math.abs(caja.t - caja.b[0]) < 1, "el telón tapa solo el escenario (termina donde empieza la bandeja)");
ver(caja.fov === 44 && caja.asp < 1, `la cámara parada: fov ${caja.fov}°, aspecto ${caja.asp.toFixed(2)}`);
await foto("v-titulo");
await desborde("título", ".capa");

/* ---------------- 3. los menús del título ---------------- */
/* los boletos del título entran de costado (~1,3 s): se espera a que estén quietos para tocarlos */
const alTitulo = () => esperar(() => document.querySelector(".titulo .boleto") && [...document.querySelectorAll(".titulo .boleto")].every((b) => b.getAnimations().every((a) => a.playState !== "running" || a.effect.getTiming().iterations === Infinity)));
const menus = async (sufijo) => {
  await alTitulo(); await tocarBoleto("capitulos"); await dormir(900);
  ver(await pag.evaluate(() => !!document.querySelector(".mapa")), "se abre el mapa de los capítulos");
  await foto("v-mapa" + sufijo); await desborde("mapa", ".capa");
  await tocarEl(".mapa .boleto.chico"); await alTitulo();
  await tocarBoleto("coplas"); await dormir(900);
  ver(await pag.evaluate(() => !!document.querySelector(".cuaderno")), "se abre el cuaderno de coplas");
  await foto("v-coplas" + sufijo); await desborde("coplas", ".capa");
  await tocarEl(".cuaderno .nav .boleto:nth-child(2)"); await alTitulo();
  await tocarBoleto("opciones"); await dormir(900);
  ver(await pag.evaluate(() => !!document.querySelector(".tablero")), "se abren las opciones");
  await foto("v-opciones" + sufijo); await desborde("opciones", ".capa");
  await tocarEl(".tablero > .boleto.chico"); await alTitulo();
  await tocarBoleto("creditos"); await dormir(2600);
  await foto("v-creditos" + sufijo); await desborde("créditos", ".creditos");
  await tocarEl(".creditos"); await esperar(() => !document.querySelector(".creditos")); await alTitulo();
};
await menus("");
await alTitulo();
const filaGiro = await pag.evaluate(() => { const K = window.__K; return K.op.parado; });
ver(filaGiro === "vertical", "Opciones › Teléfono parado queda en Vertical de fábrica");

/* ---------------- 4. empezar: la narración y la charla, tocando ---------------- */
await alTitulo(); await tocarBoleto("empezar");
await esperar(() => window.__K.estado === "juego" && window.__K.ui.narrando);
await dormir(3500);
await foto("v-narracion"); await desborde("narración", ".narra");
for (let i = 0; i < 40 && await pag.evaluate(() => !!window.__K.ui.narrando); i++) { await tocarEl(".narra"); await dormir(1200); }
await esperar(() => window.__K.charlaActual && window.__K.charlaActual.globo);
await dormir(2500);
await foto("v-charla");
const globo = await pag.evaluate(() => { const g = document.querySelector(".globo").getBoundingClientRect(), b = document.querySelector(".bandeja").getBoundingClientRect(); return { l: g.left, r: g.right, t: g.top, b: g.bottom, bandeja: b.top, W: innerWidth }; });
ver(globo.l >= 0 && globo.r <= globo.W && globo.b <= globo.bandeja, `el globito de la charla entra en la vista (${Math.round(globo.l)}–${Math.round(globo.r)} × ${Math.round(globo.t)}–${Math.round(globo.b)}, bandeja en ${Math.round(globo.bandeja)})`);
/* la charla se pasa tocando la bandeja (el pulgar ya está ahí) */
const bandeja = await centro(".bandeja");
let lineas = 0;
for (let i = 0; i < 80 && await pag.evaluate(() => !!window.__K.charlaActual); i++) { await tocar(bandeja.x, bandeja.y + 40); await dormir(900); lineas++; }
const tras = await pag.evaluate(() => ({ ch: !!window.__K.charlaActual, b: window.__K.cap.bloqueo }));
ver(!tras.ch, `la charla del principio se pasó tocando la bandeja (${lineas} toques)`);
await esperar(() => !window.__K.cap.bloqueo && !window.__K.charlaActual);
await pag.evaluate(() => { window.__K.congelado = true; });
await pag.evaluate(() => window.__K.pintar()); await dormir(500);

/* ---------------- 5. el juego: los controles en la bandeja, caminar y saltar ---------------- */
const ctl = await pag.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s).getBoundingClientRect(); return { l: e.left, t: e.top, r: e.right, b: e.bottom, x: e.left + e.width / 2, y: e.top + e.height / 2 }; };
  return { ve: document.querySelector(".tactil").classList.contains("ve"), pal: r(".zonaPal .aro"), zona: r(".zonaPal"), salto: r(".bSalto"), accion: r(".bAccion"), pausa: r(".bPausa"), c: r("#c"), bandeja: r(".bandeja") };
});
ver(ctl.ve, "los controles de dedo se ven");
const adentro = (q) => q.t >= ctl.bandeja.t - 0.5 && q.b <= ctl.bandeja.b + 0.5 && q.t >= ctl.c.b - 0.5;
ver(["pal", "salto", "accion", "pausa", "zona"].every((k) => adentro(ctl[k])), "joystick, pluma, mano, pausa y la zona del joystick están en la bandeja (ninguno sobre la vista)");
ver(ctl.pal.x < 390 / 2 && ctl.salto.x > 390 / 2 && ctl.accion.x > 390 / 2, "el joystick a la izquierda, los botones a la derecha");
await foto("v-juego");
const paso = (n) => pag.evaluate((n) => { for (let i = 0; i < n; i++) window.__K.logica(1 / 60); window.__K.pintar(); }, n);
const killa = () => pag.evaluate(() => { const p = window.__K.cap.m.p; return { x: p.x, y: p.y, vy: p.vy, suelo: p.enSuelo }; });
await paso(20);
const k0 = await killa();
await apoyar(1, ctl.pal.x, ctl.pal.y); await paso(2);
await mover(1, ctl.pal.x + 25, ctl.pal.y); await paso(2);
await mover(1, ctl.pal.x + 50, ctl.pal.y + 2); await paso(60);
const k1 = await killa();
ver(k1.x > k0.x + 1, `camina con el joystick: x ${k0.x.toFixed(2)} → ${k1.x.toFixed(2)}`);
/* saltar sin soltar el joystick: dos dedos */
await apoyar(2, ctl.salto.x, ctl.salto.y); await paso(6);
const k2 = await killa();
ver(!k2.suelo && k2.y > k1.y + 0.2, `salta con la pluma mientras camina: y ${k1.y.toFixed(2)} → ${k2.y.toFixed(2)}`);
await foto("v-salto");
await levantar(2); await paso(50);
await levantar(1); await paso(10);
const k3 = await killa();
ver(k3.suelo, "cae de vuelta al suelo");

/* ---------------- 6. la pausa, las opciones y el editor de los controles ---------------- */
await tocar(ctl.pausa.x, ctl.pausa.y); await dormir(900);
ver(await pag.evaluate(() => window.__K.pausado && !!document.querySelector(".pausa")), "la pausa se abre con su botón");
await foto("v-pausa"); await desborde("pausa", ".capa");
await tocarBoleto("opciones"); await dormir(900);
const antes = await pag.evaluate(() => JSON.stringify(window.__K.op.tactil.pos));
await pag.evaluate(() => { const f = [...document.querySelectorAll(".fila.abre")].pop(); f.scrollIntoView(); });
await tocarEl(".fila.abre"); await dormir(1200);
ver(await pag.evaluate(() => document.querySelector(".tactil").classList.contains("editando") && !!document.querySelector(".acomoda")), "se abre el editor de los controles");
await foto("v-editor"); await desborde("editor", ".acomoda");
const s0 = await centro(".bSalto");
await apoyar(3, s0.x, s0.y); await dormir(80);
for (let i = 1; i <= 6; i++) { await mover(3, s0.x - i * 9, s0.y - i * 6); await dormir(40); }
await levantar(3); await dormir(300);
const s1 = await centro(".bSalto");
const op = await pag.evaluate(() => ({ posV: window.__K.op.tactil.posV, pos: JSON.stringify(window.__K.op.tactil.pos), guardado: JSON.parse(localStorage.getItem("kuntur:opciones") || "{}") }));
ver(Math.hypot(s1.x - s0.x, s1.y - s0.y) > 30 && op.posV.salto, `se arrastra la pluma en el editor: (${Math.round(s0.x)}, ${Math.round(s0.y)}) → (${Math.round(s1.x)}, ${Math.round(s1.y)}), posV.salto = ${JSON.stringify(op.posV.salto)}`);
ver(op.pos === antes && op.guardado.tactil && op.guardado.tactil.posV && op.guardado.tactil.posV.salto, "se guarda en posV (y pos, la de acostado, no se toca)");
await foto("v-editor-movido");
await tocarEl(".acomoda .chip.listo"); await dormir(900);
await tocarEl(".tablero > .boleto.chico"); await dormir(700);
await tocarBoleto("continuar"); await dormir(500);
ver(await pag.evaluate(() => !window.__K.pausado), "sigue el juego");

/* ---------------- 7. otros tamaños ---------------- */
for (const [w, h] of [[360, 740], [412, 915], [390, 844]]) {
  await pag.setViewportSize({ width: w, height: h }); await dormir(700);
  await pag.evaluate(() => window.__K.pintar());
  const r = await pag.evaluate(() => { const c = document.getElementById("c").getBoundingClientRect(), b = document.querySelector(".bandeja").getBoundingClientRect(), s = document.querySelector(".bSalto").getBoundingClientRect(); return { cb: c.bottom, bt: b.top, sb: s.bottom, st: s.top, H: innerHeight }; });
  ver(r.cb <= r.bt + 0.5 && r.st >= r.bt && r.sb <= r.H, `${w}×${h}: vista hasta ${Math.round(r.cb)}, bandeja desde ${Math.round(r.bt)}, la pluma adentro`);
  if (w === 390) break;
  await foto(`v-juego-${w}`);
  await pag.evaluate(() => window.__K.pausar()); await dormir(900);
  await foto(`v-pausa-${w}`); await desborde("pausa", ".capa");
  await pag.evaluate(() => { window.__K.ui.limpiar(); window.__K.pausado = false; });
}
/* una charla con los globitos en el más angosto */
await pag.setViewportSize({ width: 360, height: 740 }); await dormir(700);
await pag.evaluate(() => { const K = window.__K; K.congelado = false; K.charla("casa", { hasta: 3 }); });
await esperar(() => window.__K.charlaActual && window.__K.charlaActual.globo);
await pag.evaluate(() => { const K = window.__K; K.charlaActual.globo.completar(); K.congelado = true; for (let i = 0; i < 10; i++) K.logica(1 / 60); K.pintar(); });
await dormir(700);
await foto("v-charla-360"); await desborde("globito", ".globo");
await pag.evaluate(() => { const K = window.__K; while (K.charlaActual) K.siguienteLinea(); });
/* el título y sus menús en los otros dos tamaños */
await pag.evaluate(() => { window.__K.congelado = false; window.__K.salirAlTitulo(); });
await esperar(() => window.__K.estado === "titulo" && !document.querySelector(".telon").classList.contains("cerrado") && document.querySelector(".boleto"));
await dormir(1800);
for (const [w, h] of [[360, 740], [412, 915]]) {
  await pag.setViewportSize({ width: w, height: h }); await dormir(900);
  await foto(`v-titulo-${w}`); await desborde("título", ".capa");
  await menus("-" + w);
}

/* ---------------- 8. girado sigue andando, como opción ---------------- */
await pag.setViewportSize({ width: 390, height: 844 }); await dormir(700);
await alTitulo(); await tocarBoleto("opciones"); await dormir(900);
/* la fila de "Teléfono parado": un toque la pasa a "Girado (auto)", otro a "Girado" */
const iGiro = await pag.evaluate(() => [...document.querySelectorAll(".fila")].findIndex((f) => /parado|Upright|em pé/.test(f.textContent)));
ver(iGiro >= 0, "está la fila Teléfono parado");
await tocarEl(`.tablero .fila:nth-of-type(${iGiro + 1})`); await dormir(500);
await tocarEl(`.tablero .fila:nth-of-type(${iGiro + 1})`); await dormir(900);
const gir = await pag.evaluate(() => ({ app: document.getElementById("app").style.transform, clases: document.documentElement.className, parado: window.__K.op.parado, fila: [...document.querySelectorAll(".fila")].find((f) => /parado/.test(f.textContent)).textContent }));
ver(gir.app.includes("rotate(90deg)") && gir.clases.includes("girado") && !gir.clases.includes("vertical"), `con "Girado" vuelve a jugarse de costado (#app "${gir.app}", fila "${gir.fila.trim()}")`);
await foto("v-girado");
/* y de vuelta a vertical (dos toques más: al revés, vertical) */
/* (la fila se redibuja con cada cambio: se la busca de nuevo antes de cada toque) */
for (let k = 0; k < 2; k++) { await pag.evaluate((i) => document.querySelectorAll(".tablero .fila")[i].click(), iGiro); await dormir(500); }
await dormir(400);
ver(await pag.evaluate(() => document.documentElement.classList.contains("vertical") && window.__K.op.parado === "vertical"), "y vuelve a vertical");
await tocarEl(".tablero > .boleto.chico"); await dormir(700);

/* ---------------- 9. acostado, igual que antes ---------------- */
await pag.setViewportSize({ width: 844, height: 390 }); await dormir(900);
await alTitulo(); await tocarBoleto("seguir").catch(() => tocarBoleto("empezar"));
await esperar(() => window.__K.estado === "juego" && window.__K.cap && !window.__K.ui.narrando || (window.__K.ui.narrando && true));
for (let i = 0; i < 60; i++) {
  const s = await pag.evaluate(() => { const K = window.__K, c = K.cap; return { j: K.estado === "juego", n: !!K.ui.narrando, ch: !!K.charlaActual, b: !!(c && c.bloqueo), q: !!(c && c.quieta) }; });
  if (s.j && !s.n && !s.ch && !s.b && !s.q) break;
  if (s.n) await pag.evaluate(() => window.__K.ui.narrando && window.__K.ui.narrando());
  if (s.ch) await pag.evaluate(() => { const K = window.__K; if (K.charlaActual) K.siguienteLinea(); });
  await dormir(700);
}
await pag.evaluate(() => { window.__K.congelado = true; window.__K.ui.verTactil(true); for (let i = 0; i < 10; i++) window.__K.logica(1 / 60); window.__K.pintar(); });
await dormir(500);
const hz = await pag.evaluate(() => {
  const K = window.__K, c = document.getElementById("c").getBoundingClientRect(), r = (s) => { const e = document.querySelector(s).getBoundingClientRect(); return [Math.round(e.left + e.width / 2), Math.round(e.top + e.height / 2), Math.round(e.width)]; };
  return { clases: document.documentElement.className, app: document.getElementById("app").style.transform, c: [c.left, c.top, c.width, c.height], bandeja: getComputedStyle(document.querySelector(".bandeja")).display, fov: K.E.camara.fov, salto: r(".bSalto"), accion: r(".bAccion"), pausa: r(".bPausa"), pal: r(".zonaPal .aro"), telon: document.querySelector(".telon").getBoundingClientRect().bottom, pos: K.op.tactil.pos };
});
/* lo de siempre (ui.centro sin posición guardada): pal [izq+66, h−126], salto [der−56, h−72], mano [der−142, h−116], pausa [der−33, arr+27] */
const W = 844, H = 390, izq = W * 0.067, der = W - W * 0.067, arr = Math.max(56, H * 0.09);
const esperado = { pal: [izq + 66, H - 126, 88], salto: [der - 56, H - 72, 76], accion: [der - 142, H - 116, 64], pausa: [der - 33, arr + 27, 46] };
const igual = Object.entries(esperado).every(([k, [x, y, s]]) => Math.abs(hz[k][0] - x) <= 1 && Math.abs(hz[k][1] - y) <= 1 && Math.abs(hz[k][2] - s) <= 1);
ver(!hz.clases.includes("vertical") && !hz.clases.includes("girado") && hz.app === "", `acostado: sin giro ni modo vertical ("${hz.clases}")`);
ver(hz.c[0] === 0 && hz.c[1] === 0 && hz.c[2] === W && hz.c[3] === H && hz.bandeja === "none" && hz.telon === H, `acostado: el dibujo en toda la pantalla (${hz.c.join("×")}), sin bandeja, el telón entero`);
ver(hz.fov === 30, `acostado: la cámara con fov ${hz.fov}° como siempre`);
ver(igual && !Object.keys(hz.pos).length, `acostado: los controles donde estaban (pluma ${hz.salto}, mano ${hz.accion}, pausa ${hz.pausa}, palanca ${hz.pal})`);
await foto("h-juego");
await pag.evaluate(() => window.__K.pausar()); await dormir(900);
await foto("h-pausa"); await desborde("pausa acostado", ".capa");

if (errores.length) console.log(errores.join("\n"));
ver(!errores.length, `sin errores en la consola${errores.length ? " (" + errores.length + ")" : ""}`);
console.log(fallas ? `${fallas} problema(s)` : "parado y acostado, todo en su lugar");
await nav.close();
process.exit(fallas ? 1 : 0);
