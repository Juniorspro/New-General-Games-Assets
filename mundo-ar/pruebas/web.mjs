// Prueba la página web en Chromium con una cámara falsa: el video de ejemplo
// de AlvaAR (un recorrido real por una habitación) hecho mjpeg.
//
//   node pruebas/web.mjs <camara.mjpeg> <alva_ar.js> <carpeta con three.module.min.js y three.core.min.js> [ancho alto]
//
// three y AlvaAR se sirven desde disco (las mismas versiones que pide la
// página): la prueba no depende de la red.
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const [camara, alvaJs, threeDir, W = "360", H = "640"] = process.argv.slice(2);
const web = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "web");
const serv = http.createServer((q, r) => {
  const f = path.join(web, q.url === "/" ? "index.html" : q.url.split("?")[0]);
  if (!f.startsWith(web) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" }); r.end(fs.readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise(ok => serv.on("listening", ok));
const url = `http://127.0.0.1:${serv.address().port}/`;

const nav = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  `--use-file-for-fake-video-capture=${camara}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errores = [];
async function abrir(fov, extra = {}) {
  const ctx = await nav.newContext({ viewport: { width: +W, height: +H }, hasTouch: true, isMobile: true, permissions: ["camera"], ...extra });
  await ctx.route("https://cdn.jsdelivr.net/npm/three@0.186.1/build/*", (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(threeDir, path.basename(new URL(r.request().url()).pathname))) }));
  await ctx.route(/rawcdn\.githack\.com\/alanross\/AlvaAR\/.*alva_ar\.js$/, (r) => r.fulfill({ contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(alvaJs) }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text()); });
  p.on("requestfailed", (q) => errores.push("pedido fallido: " + q.url()));
  if (fov) await p.addInitScript((f) => localStorage.setItem("mundoar.fov", String(f)), fov);
  await p.goto(url);
  await p.waitForSelector("#modo-sin-camara");
  return { ctx, p };
}
const est = (p) => p.evaluate(() => window.__MUNDO.estado());
const esperar = (ms) => new Promise(ok => setTimeout(ok, ms));
let fallas = 0;
const ver = (ok, s) => { console.log((ok ? "✓ " : "✗ ") + s); if (!ok) fallas++; };

// ── la pantalla de inicio ──
{
  const { ctx, p } = await abrir();
  const botones = await p.$$eval("#modos button", (bs) => bs.map(b => ({ id: b.id, ok: !b.disabled, mejor: b.classList.contains("mejor") })));
  console.log("modos:", botones.map(b => `${b.id}${b.ok ? "" : "(no)"}${b.mejor ? "*" : ""}`).join(" "));
  ver(botones.find(b => b.id === "modo-slam").ok, "el SLAM está disponible (sin WebXR en Chromium de escritorio)");
  await p.screenshot({ path: "/tmp/mundo-inicio.png" });
  await ctx.close();
}

// ── como adentro del WebView de la app (el agente lleva "; wv)") ──
{
  const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36";
  const { ctx, p } = await abrir(0, { userAgent: ua });
  const detalle = await p.textContent("#detalle");
  const mejor = await p.$eval("#modos .mejor", (b) => b.id);
  ver(/WebView/.test(detalle) && mejor === "modo-slam", `WebView: "${detalle}" · recomendado ${mejor}`);
  await ctx.close();
}

// ── un navegador que nunca contesta la pantalla completa no traba el arranque ──
{
  const { ctx, p } = await abrir();
  await p.evaluate(() => { Element.prototype.requestFullscreen = () => new Promise(() => {}); });
  await p.click("#modo-sin-camara");
  await esperar(1500);
  ver((await est(p)).modo === "sin-camara", "arranca aunque requestFullscreen no conteste nunca");
  await ctx.close();
}

// ── sin cámara: el mundo solo, mirar arrastrando, tocar ──
{
  const { ctx, p } = await abrir();
  await p.click("#modo-sin-camara");
  await esperar(1200);
  let e = await est(p);
  ver(e.modo === "sin-camara" && e.anillo && e.blancos === 8, `sin cámara: anillo de ${e.blancos} blancos`);
  // Girar arrastrando hasta tener un blanco en el centro y tocarlo.
  let tocados = 0;
  for (let paso = 0; paso < 40 && tocados < 3; paso++) {
    const acierto = await p.evaluate(() => window.__MUNDO.tocarCentro());
    if (acierto) { tocados++; await esperar(400); continue; }
    await p.mouse.move(+W / 2, +H / 2); await p.mouse.down(); await p.mouse.move(+W / 2 - 15, +H / 2, { steps: 3 }); await p.mouse.up();
  }
  e = await est(p);
  ver(e.tocados >= 3 && e.puntos > 0, `sin cámara: ${e.tocados} tocados, ${e.puntos} puntos`);
  // Un toque hacia abajo pone la arena.
  await p.evaluate(() => { const c = window.__MUNDO.camara; c.rotation.set(-0.9, 0, 0); });
  await p.mouse.click(+W / 2, +H * 0.88);
  await esperar(300);
  e = await est(p);
  ver(e.arena, "sin cámara: un toque abajo pone la arena");
  await p.screenshot({ path: "/tmp/mundo-sin-camara.png" });
  await ctx.close();
}

// ── giróscopo con cámara: la cámara se abre y el mundo se dibuja encima ──
{
  const { ctx, p } = await abrir();
  await p.click("#modo-giro");
  await esperar(1500);
  const e = await est(p);
  const video = await p.evaluate(() => ({ w: document.querySelector("#video").videoWidth, h: document.querySelector("#video").videoHeight, oculto: document.querySelector("#video").hidden }));
  ver(e.modo === "giro" && video.w > 0 && !video.oculto, `giro: cámara abierta ${video.w}×${video.h}, anillo ${e.anillo}`);
  const lint = await p.textContent("#b-linterna");
  ver(/no hay/.test(lint), `linterna sin torch en la cámara falsa: "${lint}"`);
  await p.screenshot({ path: "/tmp/mundo-giro.png" });
  await ctx.close();
}

// ── SLAM: 6DoF con AlvaAR sobre el video ──
{
  const { ctx, p } = await abrir(75);
  await p.click("#modo-slam");
  await p.waitForFunction(() => window.__MUNDO.estado().recorte, null, { timeout: 20000 });
  const r = (await est(p)).recorte;
  const vid = await p.evaluate(() => [document.querySelector("#video").videoWidth, document.querySelector("#video").videoHeight]);
  console.log(`cámara ${vid.join("×")} → SLAM ${r.w}×${r.h} (campo ${r.fovH.toFixed(1)}°×${r.fovV.toFixed(1)}°) · cámara 3D ${r.fov3d.toFixed(1)}° vertical`);
  ver(Math.min(r.w, r.h) === 320 || Math.max(r.w, r.h) === 640, "el SLAM ve 320 px de lado corto (o 640 de largo)");
  const muestras = [];
  const t0 = Date.now();
  let arenaPedida = false;
  while (Date.now() - t0 < 22000) {
    await esperar(500);
    const e = await est(p);
    muestras.push(e);
    if (!arenaPedida && e.anillo && /OK/.test(e.seguimiento) && Date.now() - t0 > 6000) {
      await p.touchscreen.tap(+W / 2, +H * 0.72); arenaPedida = true;
    }
  }
  const ok = muestras.filter(m => /OK/.test(m.seguimiento));
  const recorrido = ok.length ? Math.max(...ok.map(m => Math.hypot(...m.pos.map((v, i) => v - ok[0].pos[i])))) : 0;
  const fpsMed = muestras.map(m => m.fps).sort((a, b) => a - b)[muestras.length >> 1];
  const ult = muestras[muestras.length - 1];
  console.log(`seguimiento OK en ${ok.length}/${muestras.length} muestras · la cámara recorrió ${recorrido.toFixed(2)} (unidades del SLAM) · ${fpsMed} cuadros/s de dibujo`);
  console.log("últimas:", muestras.slice(-4).map(m => `${m.seguimiento} [${m.pos.join(", ")}]`).join(" | "));
  ver(ok.length >= muestras.length * 0.5, "el SLAM sigue la cámara la mayor parte del tiempo");
  ver(recorrido > 0.05, "la posición se mueve (6DoF, no sólo giro)");
  ver(ult.anillo, "el anillo de blancos quedó puesto");
  ver(ult.arena, "un toque sobre el piso puso la arena (findPlane)");
  await p.screenshot({ path: "/tmp/mundo-slam.png" });
  await ctx.close();
}

ver(errores.length === 0, `sin errores en la página${errores.length ? ":\n  " + errores.join("\n  ") : ""}`);
await nav.close(); serv.close();
process.exit(fallas ? 1 : 0);
