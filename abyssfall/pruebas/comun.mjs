// Lo común de las pruebas: Chromium con el juego armado servido en un origen https de mentira.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const { chromium, devices } = require(process.env.PLAYWRIGHT || "../../mundo-ar/node_modules/playwright");
export const salida = (n) => { mkdirSync(new URL("../salida/", import.meta.url), { recursive: true }); return new URL(`../salida/${n}`, import.meta.url).pathname; };
export async function abrir({ ancho = 800, alto = 360, dpr = 2, tactil = true, query = "" } = {}) {
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: dpr, hasTouch: tactil, isMobile: tactil });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(e.message));
  pag.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errores.push(m.text()); });
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  await pag.route("https://abyss.prueba/**", (q) => q.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  await pag.goto("https://abyss.prueba/" + query);
  await pag.waitForFunction(() => window.__AB && window.__AB.listo, null, { timeout: 30000 });
  return { nav, pag, errores };
}
export function guardarDataURL(url, archivo) { writeFileSync(salida(archivo), Buffer.from(url.split(",")[1], "base64")); }
