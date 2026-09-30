// BRILLO con el celular parado: que se juegue en vertical de verdad, que los
// dedos no tapen el juego, que nada se corte y que acostado quede igual.
//
//     node brillo/pruebas/vertical.mjs [--rapido]
//
// Abre brillo.html (el armado: correr antes herramientas/armar.mjs) en Chromium
// como un teléfono (isMobile, hasTouch, 3 píxeles por punto) y toca con dedos
// de verdad por CDP (Input.dispatchTouchEvent). Las capturas van a
// pruebas/salida/ (no se commitea). El navegador de acá dibuja por software
// (SwiftShader): los cuadros por segundo no son los de un teléfono; lo que
// vale es la cuenta de píxeles, que no haya errores y dónde queda cada cosa.
// --rapido: solo 390x844 y el acostado (sin los otros dos tamaños).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { TEXTOS, IDIOMAS } from "../js/textos.js";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HTML = "file://" + path.join(AQUI, "brillo.html");
const SALIDA = path.join(AQUI, "pruebas", "salida");
fs.mkdirSync(SALIDA, { recursive: true });
const RAPIDO = process.argv.includes("--rapido");

/* acostado en 844x390, medido con el armado de antes del 30/09 (sin el vertical):
   tiene que dar lo mismo, píxel por píxel de CSS */
const ANTES_ACOSTADO = { juego: [622, 288], lienzo: [1, 0, 842, 390], canvas: [2527, 1170], aro: [46, 248, 98, 98], salto: [736, 271, 82, 82], pausa: [787, 18, 43, 43], zona: [1, 70, 421, 320] };
/* y girado (la opción de antes), en 390x844 */
const ANTES_GIRADO = { juego: [622, 288], lienzo: [0, 1, 390, 842], aro: [45, 46, 98, 98], salto: [37, 736, 82, 82], pausa: [330, 787, 43, 43] };

let fallas = 0, pasadas = 0;
const bien = (si, que, dato = "") => { if (si) pasadas++; else fallas++; console.log(`${si ? "  ok " : "  MAL"} ${que}${dato !== "" ? " · " + (typeof dato === "string" ? dato : JSON.stringify(dato)) : ""}`); return si; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const navegador = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

/* un teléfono nuevo (con su propio localStorage) */
async function telefono(W, H, guardado = {}) {
  const ctx = await navegador.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  await p.addInitScript((g) => { if (sessionStorage.getItem("ya")) return; sessionStorage.setItem("ya", "1"); for (const [k, v] of Object.entries(g)) localStorage.setItem(k, JSON.stringify(v)); }, guardado);
  await p.goto(HTML);
  await p.waitForFunction(() => window.__brillo && document.querySelector(".burbujaIdioma"));
  const cdp = await ctx.newCDPSession(p);
  const T = {
    p, ctx, cdp, errores, W, H,
    /* un toque cortito donde se diga */
    async tocar(x, y, ms = 70) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await p.waitForTimeout(ms);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await p.waitForTimeout(120);
    },
    async tocarEl(sel, i = 0) { const c = await T.quieto(sel, null, i); if (!c) throw new Error("no está: " + sel); await T.tocar(c[0], c[1]); },
    /* el centro de algo cuando dejó de moverse: las ventanas y las píldoras entran con una
       animación, y acá el toque llega tarde (el hilo está cargado): si se toca a mitad de
       camino, el dedo cae en el hueco entre dos píldoras */
    async quieto(sel, txt, i = 0) {
      let antes = null;
      for (let k = 0; k < 40; k++) {
        const c = await p.evaluate(([s, t, i]) => { const l = [...document.querySelectorAll(s)].filter((q) => t == null || q.textContent.includes(t)); const e = l[t == null ? i : 0]; if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height]; }, [sel, txt, i]);
        if (!c) return null;
        if (antes && c.every((v, j) => Math.abs(v - antes[j]) < 0.5)) return c;
        antes = c; await p.waitForTimeout(90);
      }
      return antes;
    },
    async centro(sel, i = 0) { return p.evaluate(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, [sel, i]); },
    async caja(sel, i = 0) { return p.evaluate(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }, [sel, i]); },
    /* dedos que se quedan apoyados: lista de { id, x, y } */
    async dedos(tipo, puntos) { await cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: puntos }); },
    async foto(nombre) { await p.screenshot({ path: path.join(SALIDA, `${nombre}.png`), scale: "css" }); },
    /* esperar tiempo de juego (acá cada cuadro tarda lo que tarda) */
    async juegoT(s) { const t0 = await p.evaluate(() => window.__brillo.N.t); await p.waitForFunction((t) => window.__brillo.N.t >= t, t0 + s, { timeout: 60000 }); },
    async hasta(fn, arg, ms = 30000) { await p.waitForFunction(fn, arg, { timeout: ms }); },
    /* el menú del título, ya quieto (las píldoras entran con una animación de casi un segundo) */
    async menu() { await p.waitForFunction(() => document.querySelector(".menu .pildora") && !window.__brillo.ui.capa.querySelector(".ventana"), null, { timeout: 30000 }); await p.waitForTimeout(1100); },
    /* el pedido de un pulgar sobre un botón de pill por su texto */
    async tocarTexto(sel, txt) {
      const c = await T.quieto(sel, txt);
      if (!c) throw new Error(`no está "${txt}" en ${sel}`);
      await T.tocar(c[0], c[1]);
      await p.waitForTimeout(150);
    },
    /* tocar y esperar lo que tiene que pasar. Acá el hilo de la página anda muy
       cargado (dibuja por software) y a veces un toque se pierde: se toca otra
       vez, y se cuenta, así se ve si pasa seguido */
    async pulsar(sel, txt, cond, arg) {
      for (let i = 0; i < 3; i++) {
        await p.waitForTimeout(350);
        if (txt == null) await T.tocarEl(sel); else await T.tocarTexto(sel, txt);
        if (await p.waitForFunction(cond, arg, { timeout: 4000 }).then(() => true).catch(() => false)) return;
        T.reintentos = (T.reintentos || 0) + 1;
        console.log(`  ·   (toque perdido en ${txt || sel}: otra vez)`);
      }
      throw new Error(`tocar ${txt || sel} no hizo nada`);
    },
  };
  return T;
}

/* nada se sale de la pantalla ni se corta: ni scroll de costado, ni cajas
   afuera, ni texto que no entra en su botón */
async function sinDesborde(T, que) {
  const r = await T.p.evaluate(() => {
    const W = innerWidth, H = innerHeight, malos = [];
    const doc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const visible = (e) => { const c = getComputedStyle(e); return c.display !== "none" && c.visibility !== "hidden" && +c.opacity > 0.05 && e.getClientRects().length; };
    const raices = document.querySelectorAll(".capa > *, .chat, .avisos > *, .hud, .tactil.ve > *, .tactil.editando > *, .narra .hoja, .mensaje, .cartelMundo, .creditos .rollo");
    for (const raiz of raices) {
      if (!visible(raiz)) continue;
      for (const e of [raiz, ...raiz.querySelectorAll("*")]) {
        if (!visible(e) || e.closest(".oculto, .sale")) continue;
        const q = e.getBoundingClientRect();
        if (q.width < 1 || q.height < 1) continue;
        /* lo que cuelga de un contenedor que recorta (las líneas viejas del chat) no cuenta */
        const recorta = e.parentElement && e.parentElement.closest(".lineas, .cuerpo");
        if (!recorta && (q.left < -1 || q.right > W + 1 || q.top < -1 || q.bottom > H + 1)) malos.push(`${e.className || e.tagName} afuera [${Math.round(q.left)},${Math.round(q.top)},${Math.round(q.right)},${Math.round(q.bottom)}]`);
        /* (la burbuja del idioma no: su aro tornasolado gira y "desborda" en diagonal, pero se ve redondo) */
        if (e.matches("button:not(.burbujaIdioma), .pildora, .fila, .chip, .icono, .emo, .elegi, .lema, .barra span, .aviso span") && e.scrollWidth > e.clientWidth + 1) malos.push(`${e.className || e.tagName} no entra (${e.scrollWidth}>${e.clientWidth}): ${e.textContent.trim().slice(0, 30)}`);
      }
    }
    return { doc, W, malos: [...new Set(malos)].slice(0, 8) };
  });
  bien(r.doc <= r.W && !r.malos.length, `${que}: sin desborde (${T.W}x${T.H})`, r.malos.length ? r.malos.join(" | ") : `ancho del documento ${r.doc} de ${r.W}`);
}

/* elegir idioma tocando la burbuja y esperar el título */
async function hastaTitulo(T, i = 0, foto) {
  await T.tocarEl(".burbujaIdioma", i);
  if (foto) { await T.hasta(() => document.querySelector(".ventana.inicio")); await T.p.waitForTimeout(700); await T.foto(foto); await sinDesborde(T, "iniciando sesión"); }
  await T.hasta(() => window.__brillo.estado === "titulo" && document.querySelector(".menu .pildora"));
  await T.menu();
}

/* tocar el juego hasta que termine lo que se está contando (narración, charlas y escenas) */
async function pasarEscenas(T, alCharla) {
  const t0 = Date.now();
  let charlas = 0, vistas = new Set();
  while (Date.now() - t0 < 240000) {
    const e = await T.p.evaluate(() => { const d = window.__brillo; return { narra: !!d.ui.narrando, charla: !!d.charlaR, listo: d.charlaR ? d.charlaR.listo : false, guion: d.guion, t: d.N.t, dedos: document.querySelector(".tactil").classList.contains("ve"), txt: d.charlaR && d.charlaR.texto }; });
    if (!e.narra && !e.charla && !e.guion && e.dedos) break;
    if (e.charla && !vistas.has(e.txt)) { vistas.add(e.txt); charlas++; if (alCharla) await alCharla(charlas); }
    if (e.narra || e.charla) await T.tocar(T.W / 2, (await T.p.evaluate(() => window.__Pantalla.lienzo.y + window.__Pantalla.lienzo.h * 0.4)));
    else await T.p.waitForTimeout(300);
    await T.p.waitForTimeout(e.charla && !e.listo ? 150 : 250);
  }
  return charlas;
}

/* la charla en vertical: en la consola, y el zoom con los dos adentro */
async function mirarCharla(T, nombre) {
  await T.p.waitForFunction(() => window.__brillo.cine.k > 0.93 && window.__brillo.charlaR && window.__brillo.charlaR.listo, null, { timeout: 60000 }).catch(() => {});
  const r = await T.p.evaluate(() => {
    const d = window.__brillo, N = d.N, P = window.__Pantalla, w = P.w, h = P.h;
    const V = d.vistaCine(0, w, h).vista || { x: 0.5, y: 0.5, z: 1 };
    /* dónde queda cada uno en la pantalla ya con el zoom (0-1), con su caja de muñequito */
    const en = (x, y) => { const s = N.aPantalla(x, y); return { x: (s.x / w - V.x) * V.z + 0.5, y: (s.y / h - V.y) * V.z + 0.5 }; };
    const caja = (o) => [en(o.x - 12, o.y - 32), en(o.x + 12, o.y)];
    const adentro = (c) => c[0].x >= 0 && c[1].x <= 1 && c[0].y >= 0 && c[1].y <= 1;
    const C = d.cine.con, chat = document.querySelector(".chat").getBoundingClientRect();
    return { z: +V.z.toFixed(2), nick: adentro(caja(N.m.p)), otro: C ? adentro(caja(C)) : null, con: C ? (C.orig || C.id || C.quien) : null, chatArriba: Math.round(chat.top), chatAbajo: Math.round(chat.bottom), cy: Math.round(P.controles.y), alto: innerHeight };
  });
  await T.foto(nombre);
  bien(r.chatArriba >= r.cy - 1 && r.chatAbajo <= r.alto, "la charla va en la consola, no tapa el juego", `chat ${r.chatArriba}-${r.chatAbajo}, consola desde ${r.cy}`);
  bien(r.nick && (r.otro === null || r.otro), `el zoom de la charla encuadra a los dos`, `zoom ${r.z}× · Nick ${r.nick ? "adentro" : "AFUERA"} · ${r.con || "solo Nick"} ${r.otro === null ? "" : r.otro ? "adentro" : "AFUERA"}`);
}

/* la partida de prueba: la Colina hecha y algunos guiños, para que el título tenga todo */
const PARTIDA = { mundo: "arrecife", en: null, juntadas: ["colina:G40,9", "colina:G120,6"], rotos: {}, habil: { zumbido: true }, hechos: ["colina"] };

/* ============================ 390x844: la prueba entera ============================ */
{
  console.log("\n390x844, parado");
  const T = await telefono(390, 844, { "brillo:partida": PARTIDA });
  const { p } = T;
  const giro = await p.evaluate(() => ({ clases: document.documentElement.className, tr: getComputedStyle(document.getElementById("app")).transform, vertical: window.__Pantalla.vertical }));
  bien(giro.vertical && !/girado/.test(giro.clases) && giro.tr === "none", "parado no se gira: vertical de verdad", giro);
  await T.foto("v390-1-idioma"); await sinDesborde(T, "idioma");
  await hastaTitulo(T, 0, "v390-1b-sesion");
  await T.foto("v390-2-titulo"); await sinDesborde(T, "título");
  /* la forma: el juego arriba a lo ancho, la consola abajo, sin pisarse */
  const forma = await p.evaluate(() => { const P = window.__Pantalla, c = document.getElementById("c").getBoundingClientRect(), k = document.querySelector(".consola").getBoundingClientRect(); return { juego: [P.w, P.h], base: [window.__brillo.base.width, window.__brillo.base.height], lienzo: [c.x, c.y, c.width, c.height].map(Math.round), consola: [k.x, k.y, k.width, k.height].map(Math.round), canvas: [document.getElementById("c").width, document.getElementById("c").height], pxJuego: +(c.width / P.w).toFixed(3), H: innerHeight }; });
  bien(forma.lienzo[0] <= 1 && forma.lienzo[2] >= 388, "el juego va de lado a lado", forma.lienzo);
  bien(forma.juego[0] >= 300 && forma.juego[0] <= 360 && forma.juego[1] === 416 && igual(forma.base, forma.juego), "la resolución del juego parado", `${forma.juego.join("x")} píxeles del juego, ${forma.pxJuego} px CSS cada uno`);
  bien(forma.lienzo[1] + forma.lienzo[3] <= forma.consola[1] + 0.5, "el juego y la consola no se pisan", `juego hasta ${forma.lienzo[1] + forma.lienzo[3]}, consola desde ${forma.consola[1]}`);
  const parte = (forma.lienzo[3] / forma.H * 100).toFixed(0);
  bien(parte >= 58 && parte <= 66, "el juego ocupa ~60 % del alto", `${parte} %`);

  /* las opciones desde el título: el giro dice Vertical */
  await T.pulsar(".menu .pildora", "Opciones", () => document.querySelector(".ventana.opciones"));
  await p.waitForTimeout(500);
  const filaGiro = await p.evaluate(() => [...document.querySelectorAll(".fila")].map((f) => f.textContent).find((t) => t.includes("Celular parado")) || "");
  bien(/Vertical/.test(filaGiro), "en opciones, el celular parado viene en Vertical", filaGiro.replace(/\s+/g, " "));
  await T.foto("v390-3-opciones"); await sinDesborde(T, "opciones");
  /* el editor de los dedos, parado */
  await T.pulsar(".fila", "Controles de dedo", () => document.querySelector(".tactil.editando .acomoda"));
  await p.waitForTimeout(500);
  await T.foto("v390-4-editor"); await sinDesborde(T, "editor de los dedos");
  const barra = await T.caja(".acomoda"), cons = await T.caja(".consola");
  bien(barra[1] + barra[3] <= cons[1], "la barra del editor queda arriba, sobre el juego", `barra hasta ${barra[1] + barra[3]}, consola desde ${cons[1]}`);
  /* arrastrar saltar con el dedo: 60 px a la izquierda y 30 para arriba */
  const s0 = await T.centro(".bSalto");
  await T.dedos("touchStart", [{ x: s0[0], y: s0[1], id: 1 }]);
  for (let i = 1; i <= 6; i++) { await T.dedos("touchMove", [{ x: s0[0] - i * 10, y: s0[1] - i * 5, id: 1 }]); await p.waitForTimeout(40); }
  await T.dedos("touchEnd", []);
  await p.waitForTimeout(200);
  const s1 = await T.centro(".bSalto");
  const opc = await p.evaluate(() => JSON.parse(localStorage.getItem("brillo:opciones")).tactil);
  bien(Math.abs(s1[0] - (s0[0] - 60)) < 3 && Math.abs(s1[1] - (s0[1] - 30)) < 3, "el editor mueve saltar con el dedo", `${s0.map(Math.round)} → ${s1.map(Math.round)}`);
  bien(opc.posV && opc.posV.salto && !Object.keys(opc.pos || {}).length, "se guarda en posV y lo de acostado (pos) queda como estaba", { posV: opc.posV, pos: opc.pos });
  /* restablecer y listo */
  await T.tocarEl('.acomoda [data-k="reset"]');
  await T.pulsar('.acomoda [data-k="listo"]', null, () => document.querySelector(".ventana.opciones"));
  await T.pulsar(".ventana .pildora", "Volver", () => document.querySelector(".menu .pildora") && !document.querySelector(".capa .ventana"));
  await T.menu();
  /* mundos y guiños */
  await T.pulsar(".menu .pildora", "Mundos", () => document.querySelector(".ventana.mundos"));
  await p.waitForTimeout(600);
  await T.foto("v390-5-mundos"); await sinDesborde(T, "mundos");
  await T.pulsar(".ventana .x", null, () => document.querySelector(".menu .pildora") && !document.querySelector(".capa .ventana"));
  await T.menu();
  await T.pulsar(".menu .pildora", "Guiños", () => document.querySelector(".ventana.guinos"));
  await p.waitForTimeout(600);
  await T.foto("v390-6-guinos"); await sinDesborde(T, "guiños");
  await T.pulsar(".ventana .pildora", "Volver", () => document.querySelector(".menu .pildora") && !document.querySelector(".capa .ventana"));
  await T.menu();

  /* partida nueva (dos toques): la narración, las charlas con Mora y a jugar */
  await T.pulsar(".menu .pildora", "Partida nueva", () => document.querySelector(".menu").textContent.includes("?"));
  await T.pulsar(".menu .pildora", "Empezar de cero", () => window.__brillo.estado !== "titulo");
  await T.hasta(() => window.__brillo.estado === "jugando" && window.__brillo.ui.narrando, null, 60000);
  await p.waitForTimeout(1200);
  await T.foto("v390-7-narracion"); await sinDesborde(T, "narración");
  const charlas = await pasarEscenas(T, async (n) => { if (n === 1) { await mirarCharla(T, "v390-8-charla"); await sinDesborde(T, "charla"); } });
  bien(charlas >= 3, "se pasaron las charlas del comienzo tocando", `${charlas} líneas distintas`);

  /* jugando: los dedos en la consola, ninguno encima del juego */
  await T.juegoT(4.2);
  const ctl = await p.evaluate(() => {
    const c = document.getElementById("c").getBoundingClientRect(), k = document.querySelector(".consola").getBoundingClientRect();
    return ["aro", "bSalto", "bZumbido", "bPausa"].map((s) => { const e = document.querySelector("." + s); if (!e || getComputedStyle(e).display === "none") return [s, null]; const r = e.getBoundingClientRect(); return [s, [r.left, r.top, r.right, r.bottom].map(Math.round), r.top >= k.top - 0.5 && r.bottom <= k.bottom + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5, r.top >= c.bottom - 0.5]; });
  });
  bien(ctl.every(([, r, dentro, abajo]) => r === null || (dentro && abajo)), "los dedos van en la consola, debajo del juego", ctl.map(([s, r]) => `${s} ${r ? r.join(",") : "oculto"}`).join(" · "));
  const tam = await p.evaluate(() => ({ aro: document.querySelector(".aro").offsetWidth, salto: document.querySelector(".bSalto").offsetWidth }));
  bien(tam.aro >= 110 && tam.salto >= 80, "los controles son grandes para el pulgar", `joystick ${tam.aro} px, saltar ${tam.salto} px`);
  await T.foto("v390-9-jugando"); await sinDesborde(T, "juego con los dedos y los avisos");
  const aviso = await p.evaluate(() => { const a = document.querySelector(".aviso"); const k = document.querySelector(".consola").getBoundingClientRect(); if (!a) return null; const r = a.getBoundingClientRect(); return { abajo: Math.round(r.bottom), cy: Math.round(k.top), der: Math.round(r.right) }; });
  bien(aviso && aviso.abajo <= aviso.cy && aviso.der <= 390, "el aviso de ayuda queda en el juego, arriba de la consola", aviso);
  const hud = await T.caja(".hud");
  bien(hud && hud[1] >= 0 && hud[1] + hud[3] <= forma.lienzo[3], "lo de arriba (gotitas y guiños) adentro del juego", hud);

  /* caminar con el joystick (el dedo se apoya y va para la derecha) y saltar */
  const zona = await T.caja(".zonaPal"), aro = await T.centro(".aro");
  const x0 = await p.evaluate(() => window.__brillo.N.m.p.x);
  await T.dedos("touchStart", [{ x: aro[0], y: aro[1], id: 3 }]);
  for (let i = 1; i <= 5; i++) { await T.dedos("touchMove", [{ x: aro[0] + i * 12, y: aro[1], id: 3 }]); await p.waitForTimeout(30); }
  await T.juegoT(1.2);
  const x1 = await p.evaluate(() => window.__brillo.N.m.p.x);
  bien(x1 - x0 > 60, "camina con el joystick", `x ${x0.toFixed(0)} → ${x1.toFixed(0)} en 1,2 s de juego`);
  const mira = await p.evaluate(() => { const N = window.__brillo.N, w = window.__Pantalla.w; return { mira: Math.round(N.mira), delante: Math.round(N.cam.x + w - N.m.p.x), w }; });
  bien(mira.delante >= mira.w * 0.6, "corriendo, la cámara deja ver adelante", `mira ${mira.mira} px · se ven ${mira.delante} px por delante de Nick (de ${mira.w})`);
  /* saltar mientras camina: dos dedos a la vez */
  const sb = await T.centro(".bSalto"), y0 = await p.evaluate(() => window.__brillo.N.m.p.y);
  await T.dedos("touchStart", [{ x: aro[0] + 60, y: aro[1], id: 3 }, { x: sb[0], y: sb[1], id: 4 }]);
  let yMin = y0;
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(60); yMin = Math.min(yMin, await p.evaluate(() => window.__brillo.N.m.p.y)); }
  await T.dedos("touchEnd", [{ x: aro[0] + 60, y: aro[1], id: 3 }]);
  await T.juegoT(0.6);
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(60); yMin = Math.min(yMin, await p.evaluate(() => window.__brillo.N.m.p.y)); }
  await T.dedos("touchEnd", []);
  bien(y0 - yMin > 25, "salta con el botón (con el joystick apretado a la vez)", `subió ${(y0 - yMin).toFixed(0)} px`);
  await T.foto("v390-10-salto");

  /* la pausa con el botón de la consola, y el editor desde la pausa */
  await T.juegoT(0.5);
  await T.pulsar(".bPausa", null, () => window.__brillo.pausado && document.querySelector(".ventana.pausa"));
  await p.waitForTimeout(500);
  await T.foto("v390-11-pausa"); await sinDesborde(T, "pausa");
  await T.pulsar(".ventana.pausa .pildora", "Opciones", () => document.querySelector(".ventana.opciones"));
  await T.pulsar(".fila", "Controles de dedo", () => document.querySelector(".tactil.editando .acomoda"));
  await p.waitForTimeout(400);
  await T.foto("v390-12-editor-pausa");
  bien(true, "el editor de los dedos abre desde la pausa");
  await T.pulsar('.acomoda [data-k="listo"]', null, () => document.querySelector(".ventana.opciones"));
  await T.pulsar(".ventana .pildora", "Volver", () => document.querySelector(".ventana.pausa"));
  await T.pulsar(".ventana.pausa .pildora", "Seguir", () => !window.__brillo.pausado);

  /* un mensaje de Mora (la ventana verde), como al final del mundo: con la escena en marcha */
  await p.evaluate(() => { const j = window.__brillo.j; j.guion(true); j.mensaje("mora1").then(() => j.guion(false)); });
  await T.hasta(() => document.querySelector(".mensaje.ve"));
  await p.waitForTimeout(700);
  await T.foto("v390-13-mensaje"); await sinDesborde(T, "mensaje sin conexión");
  const msj = await p.evaluate(() => ({ m: document.querySelector(".mensaje").getBoundingClientRect().top, cy: window.__Pantalla.controles.y }));
  bien(msj.m >= msj.cy - 1, "el mensaje de Mora va en la consola", `${Math.round(msj.m)} ≥ ${Math.round(msj.cy)}`);
  await pasarEscenas(T);
  /* una charla con el otro lejos (Tito a 200 px): el zoom no se acerca, pero la cámara va al medio y entran los dos */
  await p.evaluate(() => { const d = window.__brillo, m = d.N.m; Object.assign(m.p, { x: 600, y: 336, vx: 0, vy: 0 }); d.j.charla("tito"); });
  await T.juegoT(1.5);
  await mirarCharla(T, "v390-15-charla-lejos");
  await pasarEscenas(T);

  /* los cuadros por segundo y cuántos píxeles se trabajan (acá, por software), en calidad alta fija */
  await p.evaluate(() => { const d = window.__brillo; d.opc.calidad = "alta"; d.ponerCalidad(); });
  await p.waitForTimeout(600);
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  const px = await p.evaluate(() => { const P = window.__Pantalla, c = document.getElementById("c"); return { juego: P.w * P.h, pantalla: c.width * c.height }; });
  console.log(`  ·   parado: ${fps.toFixed(1)} cuadros/s acá · ${px.juego} píxeles del juego (los efectos) · ${px.pantalla} de pantalla (una lectura cada uno)`);
  globalThis.parado = { fps, px };
  bien(!T.errores.length, "sin errores en la consola", T.errores.slice(0, 3).join(" | "));

  /* la opción de antes: girar y jugar acostado con el celular parado */
  await p.evaluate(() => { window.__brillo.opc.giro = "auto"; window.__Pantalla.ponerGiro("auto"); });
  await p.waitForTimeout(700);
  const gir = await p.evaluate(() => { const P = window.__Pantalla, c = document.getElementById("c").getBoundingClientRect(), r = (s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x, q.y, q.width, q.height].map(Math.round); }; return { girado: P.girado, vertical: P.vertical, juego: [P.w, P.h], lienzo: [c.x, c.y, c.width, c.height].map(Math.round), aro: r(".aro"), salto: r(".bSalto"), pausa: r(".bPausa"), tr: getComputedStyle(document.getElementById("app")).transform !== "none" }; });
  const { girado, vertical, tr, ...medidas } = gir;
  bien(girado && !vertical && tr && igual(medidas, ANTES_GIRADO), "la opción 'de costado' gira como antes", medidas);
  await T.foto("v390-14-girado");
  await T.ctx.close();
}

/* ============================ los otros dos tamaños ============================ */
/* 360x740 en inglés y 412x915 en portugués: los textos salen de textos.js */
if (!RAPIDO) for (const [W, H, idioma] of [[360, 740, "en"], [412, 915, "pt"]]) {
  console.log(`\n${W}x${H}, parado, en ${idioma}`);
  const U = TEXTOS[idioma].ui;
  /* con las opciones de antes del 30/09 (giro 'auto' de fábrica y los dedos acomodados acostado) */
  const T = await telefono(W, H, { "brillo:partida": PARTIDA, "brillo:opciones": { v: 2, musica: 7, efectos: 8, estilo: "aero", calidad: "auto", calidadAuto: "alta", giro: "auto", tactil: { modo: "fija", alfa: 0.7, vib: true, pos: { salto: { x: 0.9, y: 0.7 } }, tam: { pal: 1.2, salto: 1, zumbido: 1, pausa: 1 } } } });
  const { p } = T;
  const mig = await p.evaluate(() => ({ giro: window.__brillo.opc.giro, pos: window.__brillo.opc.tactil.pos, tam: window.__brillo.opc.tactil.tam.pal, vertical: window.__Pantalla.vertical }));
  bien(mig.vertical && mig.giro === "vertical" && mig.pos.salto && mig.tam === 1.2, "las opciones viejas pasan a vertical y el acomodo acostado se conserva", mig);
  await T.foto(`v${W}-1-idioma`); await sinDesborde(T, "idioma");
  await hastaTitulo(T, IDIOMAS.findIndex(([l]) => l === idioma));
  await T.foto(`v${W}-2-titulo`); await sinDesborde(T, "título");
  await T.pulsar(".menu .pildora", U.opciones, () => document.querySelector(".ventana.opciones"));
  await p.waitForTimeout(500);
  await T.foto(`v${W}-3-opciones`); await sinDesborde(T, "opciones");
  /* cada valor del celular parado tiene que entrar en su fila (se prueban sin girar la pantalla) */
  const entran = await p.evaluate(([giro, valores]) => {
    const f = [...document.querySelectorAll(".fila")].find((q) => q.textContent.includes(giro)), b = f.querySelector(".v b"), antes = b.textContent;
    const r = valores.map((v) => { b.textContent = v; return [v, f.scrollWidth <= f.clientWidth + 1 && f.getBoundingClientRect().right <= innerWidth]; });
    b.textContent = antes;
    return r;
  }, [U.giro, [U.giroVertical, U.giroAuto, U.giroNormal, U.giroReves]]);
  bien(entran.every(([, si]) => si), "los cuatro valores del celular parado entran en la fila", entran.map(([v, si]) => `${v}${si ? "" : " (NO)"}`).join(" · "));
  await T.pulsar(".fila", U.tactiles, () => document.querySelector(".tactil.editando .acomoda"));
  await p.waitForTimeout(500);
  await T.foto(`v${W}-4-editor`); await sinDesborde(T, "editor de los dedos");
  await T.pulsar('.acomoda [data-k="listo"]', null, () => document.querySelector(".ventana.opciones"));
  await T.pulsar(".ventana .pildora", U.volver, () => document.querySelector(".menu .pildora") && !document.querySelector(".capa .ventana"));
  await T.menu();
  await T.pulsar(".menu .pildora", U.mundos, () => document.querySelector(".ventana.mundos"));
  await p.waitForTimeout(600);
  await T.foto(`v${W}-5-mundos`); await sinDesborde(T, "mundos");
  await T.pulsar(".ventana .x", null, () => document.querySelector(".menu .pildora") && !document.querySelector(".capa .ventana"));
  await T.menu();
  await T.pulsar(".menu .pildora", U.guinos, () => document.querySelector(".ventana.guinos"));
  await p.waitForTimeout(600);
  await T.foto(`v${W}-6-guinos`); await sinDesborde(T, "guiños");
  await T.pulsar(".ventana .pildora", U.volver, () => document.querySelector(".menu .pildora") && !document.querySelector(".capa .ventana"));
  await T.menu();
  /* la Colina de cero: narración, charla, juego y pausa */
  await T.pulsar(".menu .pildora", U.nuevo, () => document.querySelector(".menu").textContent.includes("?"));
  await T.pulsar(".menu .pildora", U.nuevoSeguro.slice(0, 8), () => window.__brillo.estado !== "titulo");
  await T.hasta(() => window.__brillo.ui.narrando, null, 60000);
  await p.waitForTimeout(1000);
  await sinDesborde(T, "narración");
  await pasarEscenas(T, async (n) => { if (n === 2) { await mirarCharla(T, `v${W}-7-charla`); await sinDesborde(T, "charla"); } });
  await T.juegoT(4.2);
  await T.foto(`v${W}-8-jugando`); await sinDesborde(T, "juego con los dedos y los avisos");
  await T.pulsar(".bPausa", null, () => document.querySelector(".ventana.pausa"));
  await p.waitForTimeout(500);
  await T.foto(`v${W}-9-pausa`); await sinDesborde(T, "pausa");
  /* cerrar sesión (al título) y los créditos desde el menú */
  await T.pulsar(".ventana.pausa .pildora", U.salir, () => window.__brillo.estado === "titulo");
  await T.menu();
  await T.pulsar(".menu .pildora", U.creditos, () => document.querySelector(".creditos.ve"));
  await p.waitForTimeout(900);
  await T.foto(`v${W}-10-creditos`); await sinDesborde(T, "créditos");
  bien(!T.errores.length, "sin errores en la consola", T.errores.slice(0, 3).join(" | "));
  await T.ctx.close();
}

/* ============================ acostado: igual que antes ============================ */
{
  console.log("\n844x390, acostado");
  const T = await telefono(844, 390);
  const { p } = T;
  await hastaTitulo(T);
  await T.foto("h844-1-titulo");
  await p.evaluate(() => { const d = window.__brillo; d.partida = { mundo: "colina", en: null, juntadas: [], rotos: {}, habil: {}, hechos: ["colina"] }; d.jugar("colina", null); });
  await T.hasta(() => window.__brillo.estado === "jugando" && document.querySelector(".tactil.ve"), null, 60000);
  await p.waitForTimeout(2000);
  const m = await p.evaluate(() => {
    const P = window.__Pantalla, c = document.getElementById("c"), r = (s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x, q.y, q.width, q.height].map(Math.round); };
    const q = c.getBoundingClientRect();
    return { juego: [P.w, P.h], lienzo: [q.x, q.y, q.width, q.height].map(Math.round), canvas: [c.width, c.height], aro: r(".aro"), salto: r(".bSalto"), pausa: r(".bPausa"), zona: r(".zonaPal"), vertical: P.vertical, consola: getComputedStyle(document.querySelector(".consola")).display };
  });
  const { vertical, consola, ...medidas } = m;
  bien(!vertical && consola === "none", "acostado no hay consola ni vertical");
  for (const k of Object.keys(ANTES_ACOSTADO)) bien(igual(medidas[k], ANTES_ACOSTADO[k]), `acostado: ${k} igual que antes`, medidas[k]);
  await T.foto("h844-2-jugando");
  /* una charla acostado: abajo, como siempre */
  await p.evaluate(() => { window.__brillo.j.charla(null, { lineas: [["nick", "Probando, probando :)"]], con: "nick" }); });
  await T.hasta(() => window.__brillo.charlaR && window.__brillo.charlaR.listo);
  await p.waitForTimeout(600);
  /* va arriba si Nick está en la parte de abajo del juego, si no abajo: la regla de siempre */
  const ch = await p.evaluate(() => { const d = window.__brillo, q = d.N.aPantalla(d.N.m.p.x, d.N.m.p.y), c = document.querySelector(".chat"), r = c.getBoundingClientRect(); return { arriba: c.classList.contains("arriba"), debe: q.y > window.__Pantalla.h * 0.56, caja: [r.x, r.y, r.width, r.height].map(Math.round), fotos: getComputedStyle(c.querySelector(".fotos")).display }; });
  bien(ch.arriba === ch.debe && ch.caja[1] >= 0 && ch.caja[1] + ch.caja[3] <= 390 && ch.caja[2] <= 460 && ch.fotos === "none", "acostado, la charla es la de siempre (arriba o abajo según Nick, sin fotos)", ch);
  await T.foto("h844-3-charla");
  await pasarEscenas(T);
  await p.evaluate(() => { const d = window.__brillo; d.opc.calidad = "alta"; d.ponerCalidad(); });
  await p.waitForTimeout(600);
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  const px = await p.evaluate(() => { const P = window.__Pantalla, c = document.getElementById("c"); return { juego: P.w * P.h, pantalla: c.width * c.height }; });
  console.log(`  · acostado: ${fps.toFixed(1)} cuadros/s acá · ${px.juego} píxeles del juego · ${px.pantalla} de pantalla`);
  if (globalThis.parado) bien(globalThis.parado.px.juego <= px.juego && globalThis.parado.px.pantalla <= px.pantalla, "parado se trabajan menos píxeles que acostado (los efectos van a la resolución del juego)", `${globalThis.parado.px.juego} vs ${px.juego} del juego · ${globalThis.parado.px.pantalla} vs ${px.pantalla} de pantalla`);
  bien(!T.errores.length, "sin errores en la consola", T.errores.slice(0, 3).join(" | "));
  await T.ctx.close();
}

await navegador.close();
console.log(`\n${pasadas} bien, ${fallas} mal · capturas en ${path.relative(process.cwd(), SALIDA) || SALIDA}`);
process.exit(fallas ? 1 : 0);
