// Prueba de Los Montes: carga, idioma, menú, intro, juego (mirar, caminar, entrar a una cabaña,
// tomar, leer, disparar), camioneta, mina y final. Uso:
//   python3 herramientas/descargable/empaquetar.py los-montes/index.html $S/los-montes.html
//   PW=$(npm root -g)/playwright S=$S node los-montes/prueba.mjs pc|tel|vertical [es|en|pt]
// Congela el bucle y avanza con __montes.simular(seg): SwiftShader dibuja a 1–3 cuadros por segundo.
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const S = process.env.S, nom = process.argv[2] || "pc", tel = nom !== "pc", vertical = nom === "vertical", idioma = process.argv[3] || "es", solo = process.env.SOLO;
fs.mkdirSync(S + "/montes", { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: vertical ? { width: 390, height: 844 } : tel ? { width: 844, height: 390 } : { width: 1200, height: 680 }, hasTouch: tel, isMobile: tel });
const errores = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" | ")));
p.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !m.text().includes("ERR_FAILED") && !m.text().includes("deprecated")) errores.push(m.type() + ": " + m.text().slice(0, 300)); });
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
const foto = (n) => p.screenshot({ path: `${S}/montes/${nom}-${idioma}-${n}.png`, timeout: 120000 });
const q = (fn, a) => p.evaluate(fn, a);
const t0 = Date.now();
await p.goto("file://" + S + "/los-montes.html");
await p.waitForTimeout(1500); await foto("01carga");
await p.waitForFunction(() => typeof Juego !== "undefined" && Juego.est.modo === "menu", null, { timeout: 240000 }).catch(async (e) => { console.log("NO LLEGÓ AL MENÚ", errores.join("\n")); await foto("00error"); process.exit(1); });
console.log("menú en", Date.now() - t0, "ms");
await p.waitForTimeout(5000); await foto("02idioma");
await p.click(`.idioma-btn >> nth=${["es", "en", "pt"].indexOf(idioma)}`); await p.waitForTimeout(5000); await foto("03menu");
if (solo === "menu") { for (const [i, n] of [[1, "coop"], [3, "diario"], [5, "opciones"], [6, "ayuda"]]) { await p.click(`.menu-tabs button >> nth=${i}`); await p.waitForTimeout(4000); await foto("04" + n); } console.log("errores:", errores.length ? errores.join("\n") : "ninguno"); await b.close(); process.exit(0); }
// Partida con intro: unas fotos del sobrevuelo.
await q(() => Juego.congelar(true));
await p.click(".boton.grande"); await p.waitForTimeout(300);
for (const [s, n] of [[3, "05intro-a"], [12, "06intro-b"], [14, "07intro-c"]]) { await q((s) => Juego.simular(s, 1 / 10), s); await p.waitForTimeout(600); await foto(n); }
await q(() => Juego.saltarIntro()); await q(() => Juego.simular(0.5)); await p.waitForTimeout(800); await foto("08juego");
console.log("info:", JSON.stringify(await q(() => ({ modo: Juego.est.modo, yo: [Juego.yo.x, Juego.yo.y, Juego.yo.z].map((v) => +v.toFixed(1)), tri: Juego.R.info.render.triangles, calls: Juego.R.info.render.calls, sonido: Sonido.estado() }))));
console.log("errores:", errores.length ? errores.join("\n") : "ninguno");
console.log("tiempo total", Math.round((Date.now() - t0) / 1000), "s");
await b.close();
