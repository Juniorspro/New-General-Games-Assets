// Abre el juego en Chromium, lo recorre y saca capturas.
//
//     node pruebas/ver.mjs [salida] [ancho] [alto]
//
// Levanta su propio servidor sobre dist/ (los módulos y los fetch no andan
// desde file://). El navegador de acá dibuja por software (SwiftShader): los
// milisegundos por cuadro NO son los de un teléfono, y no se informan como
// tales. Lo que sí vale: que no haya errores, que cada cosa esté donde tiene
// que estar y cómo se ve.
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(AQUI, "dist");
const SALIDA = process.argv[2] || path.join(AQUI, "pruebas", "capturas");
const W = +(process.argv[3] || 960), H = +(process.argv[4] || 540);
fs.mkdirSync(SALIDA, { recursive: true });

const tipos = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".glb": "model/gltf-binary", ".json": "application/json" };
const srv = http.createServer((q, r) => {
  const f = path.join(DIST, decodeURIComponent(q.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const puerto = srv.address().port;

const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const pag = await nav.newPage({ viewport: { width: W, height: H } });
// calidad y VHS por argumento: por defecto alta y sin VHS, para mirar el render
const CAL = process.env.CAL || "alta";
await pag.addInitScript((c) => localStorage.setItem("bosque", JSON.stringify({ calidad: c, vhs: true })), CAL);
const errores = [];
pag.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errores.push(`[${m.type()}] ${m.text()}`); });
pag.on("pageerror", (e) => errores.push("[pageerror] " + e.message));

const t0 = Date.now();
await pag.goto(`http://127.0.0.1:${puerto}/?fijo`);
await pag.waitForFunction(() => (window.__bosque && !document.getElementById("menu").hidden) || !document.getElementById("error").hidden, null, { timeout: 240000 });
const med = await pag.evaluate(() => window.__bosque ? window.__bosque.medidas : { error: document.getElementById("error").textContent });
console.log("carga + armado:", ((Date.now() - t0) / 1000).toFixed(1), "s");
console.log(JSON.stringify({ ...med, trisArbol: JSON.stringify(med.trisArbol) }, null, 1));
if (med.error) { console.log(errores.slice(0, 5).join("\n").slice(0, 3000)); await nav.close(); srv.close(); process.exit(1); }

const esperar = (ms) => pag.waitForTimeout(ms);
const foto = async (n) => { await pag.screenshot({ path: path.join(SALIDA, n + ".png"), timeout: 240000 }); console.log("  →", n, "cuadro", await pag.evaluate(() => (window.__bosque.cuadroMs || 0).toFixed(0)), "ms"); };
await esperar(2500);
await foto("01-menu");

// jugar: sin VHS primero para ver el render limpio, después con VHS
await pag.evaluate(() => document.getElementById("mJugar").click());
await esperar(800);
const estado = () => pag.evaluate(() => {
  const b = window.__bosque, p = b.caminante.pos, c = b.cam.position;
  return { pos: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), cam: [c.x, c.y, c.z].map((v) => +v.toFixed(2)),
           vel: +b.caminante.vel.toFixed(2), visibles: b.bosque.visibles, ms: +(b.cuadroMs || 0).toFixed(1),
           tris: b.renderer.info.render.triangles, llamadas: b.renderer.info.render.calls };
});
console.log("inicio:", JSON.stringify(await estado()));
await foto("02-inicio-vhs");
await pag.keyboard.press("KeyV");
await esperar(600);
await foto("03-inicio-limpio");

// caminar hacia adelante 6 s y correr 6 s
await pag.keyboard.down("KeyW");
await esperar(6000);
console.log("caminando:", JSON.stringify(await estado()));
await foto("04-caminando");
await pag.keyboard.down("ShiftLeft");
await esperar(6000);
await pag.keyboard.up("ShiftLeft");
await pag.keyboard.up("KeyW");
await esperar(700);
console.log("corriendo:", JSON.stringify(await estado()));
await foto("05-despues-de-correr");

// teletransporte a los lugares, para verlos
const ir = async (x, z, yaw, n, pitch = 0.18) => {
  await pag.evaluate(([x, z, yaw, pitch]) => {
    const b = window.__bosque;
    b.caminante.colocar(x, z, yaw); b.camara.yaw = yaw; b.camara.pitch = pitch; b.camara.sinTocar = 0;
  }, [x, z, yaw, pitch]);
  await esperar(1800);
  await foto(n);
  console.log(n, JSON.stringify(await estado()));
};
await ir(10, 12, Math.atan2(22 - 10, -52 - 12), "06-orilla-lago");
// de frente al sol, mirando un poco para arriba: los rayos entre los troncos
await ir(4, 60, 2.955, "06b-contraluz", -0.12);
await ir(62, 30, Math.atan2(70 - 62, 6 - 30), "07-cabana");
await ir(55, 26, Math.atan2(58 - 55, 21 - 26), "08-fogata", 0.3);
await ir(-104, 58, Math.atan2(22 + 104, -52 - 58), "09-mirador", 0.05);
await ir(-50, 110, 1.2, "10-claro");
await ir(-28, -112, Math.PI, "11-abedules");
await ir(20, 70, 0.4, "12-bosque-cerrado", -0.3);
await pag.keyboard.press("KeyV");
await esperar(600);
await foto("13-bosque-cerrado-vhs");

// errores únicos, cortados: un shader roto repite su error cientos de veces
const unicos = [...new Set(errores.map((e) => e.split("\n").filter((l) => /ERROR|error|Error|warn/.test(l)).slice(0, 3).join(" | ").slice(0, 300)))];
console.log("\n" + (unicos.length ? unicos.slice(0, 25).join("\n") : "sin errores ni avisos en la consola"));
await nav.close();
srv.close();
