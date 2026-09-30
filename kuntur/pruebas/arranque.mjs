// Mide los cuadros del arranque de KUNTUR: la pantalla del idioma, el menú, la
// entrada al prólogo (el telón, el plano de lejos, la narración y la charla de
// la abuela) y los primeros 10 s de juego caminando y saltando.
//
//     node kuntur/herramientas/armar.mjs && node kuntur/pruebas/arranque.mjs [--movil] [--html otro.html] [--perfil] [--json salida.json]
//
// De cada tramo informa los cuadros (lo que tardó cada requestAnimationFrame),
// las tareas largas del hilo principal (PerformanceObserver 'longtask') y cuánto
// de eso fue WebGL que frena al hilo: compilar y enlazar shaders y subir
// texturas (se envuelven los métodos del contexto). Con --perfil además toma un
// perfil de CPU por CDP y dice qué funciones llenaron las tareas largas (con el
// armado --dev se leen los nombres).
// Acá se dibuja por software (SwiftShader): cada cuadro es lento de por sí, así
// que valen las comparaciones (antes y después, y cada pico contra la mediana
// de su tramo), no los milisegundos sueltos.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const movil = process.argv.includes("--movil"), perfil = process.argv.includes("--perfil");
const HTML = path.resolve(arg("--html") || path.join(AQUI, "../kuntur.html"));

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 720 } });
/* que no quede guardado de otra corrida (idioma, partida, opciones) */
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("limpio")) { localStorage.clear(); sessionStorage.setItem("limpio", "1"); } } catch (_) {} });
/* la medición, desde antes de que corra el juego */
await ctx.addInitScript(() => {
  const M = (window.__M = { cuadros: [], largas: [], marcas: [], gl: { shader: 0, tex: 0, nShader: 0, nTex: 0 } });
  M.marca = (n) => M.marcas.push({ n, t: performance.now() });
  M.marca("carga");
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) M.largas.push({ t: e.startTime, d: e.duration }); }).observe({ type: "longtask", buffered: true }); } catch (_) {}
  /* lo de WebGL que hace esperar al hilo principal */
  const envolver = (P, nombres, clase) => {
    for (const n of nombres) {
      const f = P[n]; if (!f) continue;
      P[n] = function () { const a = performance.now(); try { return f.apply(this, arguments); } finally { M.gl[clase] += performance.now() - a; if (n === "linkProgram" || n === "texImage2D" || n === "texStorage2D") M.gl[clase === "shader" ? "nShader" : "nTex"]++; } };
    }
  };
  /* qué programa se enlaza y cuándo (con --shaders): el nombre de three y sus define */
  M.progs = [];
  const fuente = new WeakMap();
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const ss = C.prototype.shaderSource, at = C.prototype.attachShader, lp = C.prototype.linkProgram, adj = new WeakMap();
    C.prototype.shaderSource = function (sh, src) { fuente.set(sh, src); return ss.apply(this, arguments); };
    C.prototype.attachShader = function (pr, sh) { (adj.get(pr) || adj.set(pr, []).get(pr)).push(sh); return at.apply(this, arguments); };
    C.prototype.linkProgram = function (pr) {
      const src = (adj.get(pr) || []).map((sh) => fuente.get(sh) || "").join("\n");
      const nombre = (/#define SHADER_NAME (\S+)/.exec(src) || [])[1] || "?";
      const defs = [...new Set((src.match(/#define (USE_\w+|ALPHATEST\w*|DOUBLE_SIDED|FLAT_SHADED|DEPTH_PACKING \d+|TONE_MAPPING)/g) || []).map((d) => d.slice(8)))];
      const K = window.__K;
      M.progs.push({ t: performance.now(), nombre, defs: defs.join(" "), e: K ? K.estado : "-" });
      return lp.apply(this, arguments);
    };
    envolver(C.prototype, ["compileShader", "linkProgram", "getProgramParameter", "getShaderParameter", "getProgramInfoLog", "getShaderInfoLog"], "shader");
    envolver(C.prototype, ["texImage2D", "texSubImage2D", "texStorage2D", "texImage3D", "generateMipmap"], "tex");
  }
  let ult = 0, g0 = { shader: 0, tex: 0, nShader: 0, nTex: 0 };
  const cuadro = (ts) => {
    requestAnimationFrame(cuadro);
    const g = M.gl;
    /* en qué andaba el juego (para leer los picos) */
    const K = window.__K, c = K && K.cap;
    const e = !K ? "-" : K.estado + (K.ui && K.ui.narrando ? "·narra" : "") + (K.charlaActual ? "·charla" : "") + (c && c.bloqueo ? "·escena" : "");
    if (ult) M.cuadros.push({ t: ts, d: ts - ult, sh: g.shader - g0.shader, tx: g.tex - g0.tex, ns: g.nShader - g0.nShader, nt: g.nTex - g0.nTex, e });
    ult = ts; g0 = { ...g };
  };
  requestAnimationFrame(cuadro);
});
const pag = await ctx.newPage();
const errores = [];
pag.on("pageerror", (e) => errores.push(e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push(m.text().slice(0, 200)); });
let cdp = null;
if (perfil) { cdp = await ctx.newCDPSession(pag); await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); }

const marca = (n) => pag.evaluate((n) => window.__M.marca(n), n);
const esperar = (fn, max = 60000, arg) => pag.waitForFunction(fn, arg, { timeout: max, polling: 100 });
const dormir = (ms) => pag.waitForTimeout(ms);
const tecla = (k) => pag.keyboard.press(k);

if (perfil) await cdp.send("Profiler.start");
await pag.goto("file://" + HTML);
/* 1. la pantalla del idioma, con la portada armándose atrás */
await esperar(() => window.__K && document.querySelector(".idioma .tag"));
await marca("idioma");
await dormir(3000);
/* 2. el menú: elegir idioma, se abre el telón y aparecen los boletos */
await marca("menu");
await tecla("Enter");
await esperar(() => window.__K.estado === "titulo" && document.querySelector(".boleto"));
await dormir(3500);
/* 3. empezar el viaje: telón, el capítulo, el plano de lejos, la narración y la charla */
await marca("prologo");
await tecla("Enter");
await esperar(() => window.__K.estado === "juego" && window.__K.ui.narrando, 90000);
for (let i = 0; i < 80; i++) {
  const s = await pag.evaluate(() => { const d = window.__K, c = d.cap; return { n: !!d.ui.narrando, ch: !!d.charlaActual, b: !!(c && c.bloqueo), q: !!(c && c.quieta) }; });
  if (!s.n && !s.ch && !s.b && !s.q) break;
  if (s.n || s.ch) await tecla("Enter");
  await dormir(s.ch ? 700 : 1100);
}
/* 4. diez segundos de juego: caminar a la derecha y saltar cada tanto */
await marca("juego");
await pag.keyboard.down("ArrowRight");
for (let i = 0; i < 10; i++) { await dormir(800); await tecla("Space"); await dormir(200); }
await pag.keyboard.up("ArrowRight");
await marca("fin");

const M = await pag.evaluate(() => ({ cuadros: window.__M.cuadros, largas: window.__M.largas, marcas: window.__M.marcas, progs: window.__M.progs, x: window.__K.cap && window.__K.cap.m.p.x }));
let perf = null, ahoraPag = 0;
if (perfil) { ahoraPag = await pag.evaluate(() => performance.now()); perf = (await cdp.send("Profiler.stop")).profile; }
await nav.close();

/* ---------------- el informe ---------------- */
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0; };
const r1 = (v) => Math.round(v);
const tramos = [];
for (let i = 0; i < M.marcas.length - 1; i++) {
  const a = M.marcas[i], b = M.marcas[i + 1];
  const cs = M.cuadros.filter((c) => c.t >= a.t && c.t < b.t), ds = cs.map((c) => c.d);
  const ls = M.largas.filter((l) => l.t >= a.t && l.t < b.t);
  const m = med(ds), max = Math.max(0, ...ds), peor = cs.find((c) => c.d === max);
  tramos.push({
    tramo: a.n, seg: +((b.t - a.t) / 1000).toFixed(1), cuadros: cs.length, mediana: r1(m), p95: r1(p95(ds)), max: r1(max),
    ">50ms": ds.filter((d) => d > 50).length, ">2xMed": ds.filter((d) => d > m * 2).length,
    largas: ls.length, largaMax: r1(Math.max(0, ...ls.map((l) => l.d))), largasMs: r1(ls.reduce((s, l) => s + l.d, 0)),
    shaderMs: r1(cs.reduce((s, c) => s + c.sh, 0)), progs: cs.reduce((s, c) => s + c.ns, 0), texMs: r1(cs.reduce((s, c) => s + c.tx, 0)), texs: cs.reduce((s, c) => s + c.nt, 0),
    peorCuadro: peor ? `${r1(peor.d)} ms (shader ${r1(peor.sh)}, tex ${r1(peor.tx)})` : "-",
  });
}
console.log(`KUNTUR arranque · ${movil ? "celular 390×844" : "escritorio 1280×720"} · ${path.basename(HTML)} · Killa llegó a x=${M.x && M.x.toFixed(1)}`);
console.table(tramos);
/* los 10 s de juego, que es lo que más se nota */
const j = tramos.find((t) => t.tramo === "juego");
if (j) console.log(`juego: cuadro más largo ${j.max} ms (mediana ${j.mediana}), ${j[">50ms"]} de ${j.cuadros} cuadros > 50 ms, ${j[">2xMed"]} > 2× la mediana, ${j.largas} tareas largas (la peor ${j.largaMax} ms), ${j.progs} shaders compilados, ${j.texs} texturas subidas`);
if (perf) {
  /* qué funciones (tiempo propio) cayeron adentro de las tareas largas de cada tramo */
  const nodos = new Map(perf.nodes.map((n) => [n.id, n]));
  let t = perf.startTime / 1000;
  const porTramo = {};
  /* los dos relojes son monótonos pero con otro cero: se alinean por el final del perfil (unos ms de error) */
  const aPag = (tp) => tp - perf.endTime / 1000 + ahoraPag;
  perf.samples.forEach((id, i) => {
    t += perf.timeDeltas[i] / 1000;
    const tp = aPag(t);
    if (!M.largas.some((l) => tp >= l.t && tp < l.t + l.d)) return;
    const tr = [...M.marcas].reverse().find((m) => m.t <= tp);
    const n = nodos.get(id), f = n.callFrame, k = `${f.functionName || "(anónima)"} :${f.lineNumber + 1}`;
    if (f.functionName === "(idle)" || f.functionName === "(program)") return;
    const q = (porTramo[tr ? tr.n : "?"] = porTramo[tr ? tr.n : "?"] || {});
    q[k] = (q[k] || 0) + perf.timeDeltas[i] / 1000;
  });
  for (const [tr, q] of Object.entries(porTramo)) {
    console.log(`\n— ${tr}: lo que llenó las tareas largas (ms de CPU propios)`);
    for (const [k, v] of Object.entries(q).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${String(Math.round(v)).padStart(6)}  ${k}`);
  }
}
if (process.argv.includes("--shaders")) {
  console.log("\nprogramas enlazados (tramo, ms desde que empezó, estado, nombre, define):");
  for (const q of M.progs) { const tr = [...M.marcas].reverse().find((m) => m.t <= q.t); console.log(`  ${(tr ? tr.n : "?").padEnd(8)} ${String(Math.round(q.t - (tr ? tr.t : 0))).padStart(6)}  ${q.e.padEnd(8)} ${q.nombre}  ${q.defs}`); }
}
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ tramos, cuadros: M.cuadros, largas: M.largas, marcas: M.marcas }, null, 1));
if (errores.length) console.log("errores:\n" + errores.join("\n"));
process.exit(errores.length ? 1 : 0);
