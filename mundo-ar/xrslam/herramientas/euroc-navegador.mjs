// La página de XRSLAM en Chromium, reproduciendo EuRoC a velocidad real:
// Worker, WebAssembly, calibración y dibujo como en el teléfono, pero con los
// cuadros y la IMU de la secuencia. Guarda la trayectoria y capturas.
//
//   node euroc-navegador.mjs <carpeta exportada> <salida> [segundos] [calibrar]
// (three se sirve desde disco: THREE_DIR con three.module.min.js y three.core.min.js)
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const [datos, salida, segTxt, calibrar, extra] = process.argv.slice(2);
const web = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "web");
const threeDir = process.env.THREE_DIR || path.join(process.env.HOME, ".cache/mundo-ar/pruebas");
fs.mkdirSync(salida, { recursive: true });
const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".yaml": "text/plain" };
const serv = http.createServer((q, r) => {
  const url = decodeURIComponent(q.url.split("?")[0]);
  // La página pide three a ../../../tajo/vendor: desde la raíz del servidor queda en /tajo/.
  const raiz = path.join(web, "..", "..", "..");
  const f = url.startsWith("/euroc/") ? path.join(datos, url.slice(7)) : url.startsWith("/tajo/") ? path.join(raiz, url) : path.join(web, url === "/" ? "index.html" : url);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  const tam = fs.statSync(f).size, rango = q.headers.range && /bytes=(\d+)-(\d+)/.exec(q.headers.range);
  const cab = { "content-type": tipos[path.extname(f)] || "application/octet-stream" };
  if (rango) {
    const a = Number(rango[1]), b = Math.min(Number(rango[2]), tam - 1);
    const buf = Buffer.alloc(b - a + 1), fd = fs.openSync(f, "r"); fs.readSync(fd, buf, 0, buf.length, a); fs.closeSync(fd);
    r.writeHead(206, { ...cab, "content-range": `bytes ${a}-${b}/${tam}` }); return r.end(buf);
  }
  r.writeHead(200, cab); fs.createReadStream(f).pipe(r);
}).listen(0, "127.0.0.1");
await new Promise((ok) => serv.on("listening", ok));

const nav = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 800, height: 450 } });
await ctx.route("https://cdn.jsdelivr.net/npm/three@0.186.1/build/*", (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(threeDir, path.basename(new URL(r.request().url()).pathname))) }));
if (process.env.BLOQUEAR) await ctx.route(new RegExp(process.env.BLOQUEAR), (r) => r.abort());
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errores.push(m.text()); });
await p.goto(`http://127.0.0.1:${serv.address().port}/?prueba=euroc&datos=/euroc${calibrar ? "&calibrar=1" : ""}${extra ? "&" + extra : ""}`);
const listo = await p.waitForFunction(() => !document.querySelector("#empezar").disabled, null, { timeout: Number(process.env.ESPERA || 60000) }).then(() => true, () => false);
if (!listo) {
  console.log("no cargó. En pantalla:", await p.evaluate(() => (document.querySelector("#falla") || {}).textContent || "(nada)"));
  console.log("botón:", await p.textContent("#empezar"));
  await nav.close(); serv.close(); process.exit(0);
}
await p.click("#empezar");
const seg = Number(segTxt || 150), t0 = Date.now(), muestras = [];
let captura = 0;
while (Date.now() - t0 < seg * 1000) {
  await new Promise((ok) => setTimeout(ok, 2000));
  const e = await p.evaluate(() => window.__XR.estado());
  muestras.push(e);
  if ((Date.now() - t0) / 1000 > 12 + captura * 30 && captura < 4) await p.screenshot({ path: path.join(salida, `captura-${captura++}.png`) });
  if (await p.evaluate(() => window.__XR.fin && window.__XR.fin())) break;
}
const poses = await p.evaluate(() => window.__XR.poses);
fs.writeFileSync(path.join(salida, "trayectoria.tum"), poses.map((q) => q.map((v, i) => v.toFixed(i ? 9 : 6)).join(" ")).join("\n") + "\n");
const ult = muestras[muestras.length - 1];
const med = (k) => { const v = muestras.filter((m) => m.fase === "slam").map((m) => m[k]).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : 0; };
console.log(`poses ${poses.length} · SLAM ${med("fpsSlam")} cuadros/s (mediana) · ${med("msSlam").toFixed(0)} ms por cuadro · dibujo ${med("fpsDib")}/s · ${ult.ancho}×${ult.alto}`);
if (ult.calib) console.log(`calibración: desfase ${(ult.calib.desfase * 1000).toFixed(1)} ms · focal ${ult.calib.focal.toFixed(1)} px · r² ${ult.calib.calidad.toFixed(3)}${ult.calib.qbc ? " · q_bc [" + ult.calib.qbc.map((v) => v.toFixed(3)).join(", ") + "]" : ""}`);
console.log("aviso al final:", await p.evaluate(() => document.querySelector("#aviso").firstChild.textContent));
console.log(`anillo ${ult.anillo} · piso ${ult.pisoY === null ? "—" : ult.pisoY.toFixed(2)} · errores ${errores.length ? "\n  " + errores.slice(0, 8).join("\n  ") : 0}`);
await nav.close(); serv.close();
process.exit(0);
