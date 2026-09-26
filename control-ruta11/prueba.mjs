// Prueba de Control Policial: Ruta 11. Carga, menú, turno, llegada, ventanilla,
// documentos, tablet, alcoholímetro, baúl, resolución, arresto, zona, patrullero
// y resumen. Uso (pc o tel):
//   python3 herramientas/descargable/empaquetar.py control-ruta11/index.html $S/control-ruta11.html
//   PW=$(npm root -g)/playwright S=$S node control-ruta11/prueba.mjs pc     (fotos en $S/tiras/)
// Avanza con __ruta.simular(seg): SwiftShader dibuja a 1-3 cuadros por segundo.
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const S = process.env.S, nom = process.argv[2] || "pc", tel = nom === "tel", solo = process.argv[3] || "todo";
fs.mkdirSync(S + "/tiras", { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: tel ? { width: 844, height: 390 } : { width: 1200, height: 680 }, hasTouch: tel, isMobile: tel });
const errores = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" | ")));
p.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !m.text().includes("ERR_FAILED")) errores.push(m.type() + ": " + m.text().slice(0, 300)); });
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
const foto = (n) => p.screenshot({ path: `${S}/tiras/r11-${nom}-${n}.png`, timeout: 120000 });
const q = (fn, a) => p.evaluate(fn, a);
const t0 = Date.now();
await p.goto("file://" + S + "/control-ruta11.html");
await p.waitForTimeout(1200); await foto("1carga");
await p.waitForFunction(() => window.__ruta && __ruta.Juego.est.modo === "menu", null, { timeout: 180000 });
console.log("menú en", Date.now() - t0, "ms");
await p.waitForTimeout(2500); await foto("2menu");
await p.click("text=Empezar turno"); await p.waitForTimeout(500);
// Congelado: el bucle no dibuja solo; cada simular() avanza y dibuja un cuadro. Así la interfaz
// no espera detrás de cuadros de SwiftShader de 1 s.
await q(() => __ruta.congelar(true));
const medir = (n) => q(() => { __ruta.simular(0.05); const t = performance.now(); __ruta.R.render(__ruta.escena, __ruta.cam); return { ms: Math.round(performance.now() - t), ...__ruta.info }; });
await q(() => __ruta.simular(1)); await p.waitForTimeout(800); await foto("3inicio");
console.log("conductores:", await q(() => __ruta.conductores.map((c) => c.estado + (c.identidad ? "/falso" : "") + (c.captura ? "/captura" : "") + (c.robado ? "/robado" : "") + (c.baul.some((o) => o.ilegal) ? "/baul" : "") + ":" + resolucionCorrecta(faltasReales(c))).join(" ")));
// Hasta que para el primero.
for (let i = 0; i < 30 && !(await q(() => !!__ruta.parado)); i++) await q(() => __ruta.simular(2));
console.log("parado:", await q(() => { const v = __ruta.parado; return v && `${v.p.modelo.nombre} z=${v.z.toFixed(2)} x=${v.x}`; }));
// Mirar el auto desde atrás de la fila y de frente.
await q(() => { const y = __ruta.yo, v = __ruta.parado; y.x = v.x + 1.2; y.z = v.z + v.largo / 2 + 4; y.yaw = Math.atan2(-(v.x - y.x), -(v.z - y.z)); y.pitch = -0.15; __ruta.simular(0.1); });
await p.waitForTimeout(600); await foto("4frente");
await q(() => { const y = __ruta.yo, v = __ruta.parado; y.x = v.x + 3; y.z = v.z - v.largo / 2 - 3; y.yaw = Math.atan2(-(v.x - y.x), -(v.z - y.z)); y.pitch = -0.1; __ruta.simular(0.1); });
await p.waitForTimeout(600); await foto("5atras");
// A la ventanilla.
await q(() => { const y = __ruta.yo, v = __ruta.parado; y.x = v.x + v.ancho / 2 + 0.8; y.z = v.z + v.largo * 0.1; y.yaw = Math.PI / 2; __ruta.simular(0.2); });
console.log("acciones:", JSON.stringify(await q(() => __ruta.Juego.est.acciones)));
await p.keyboard.press("e"); await q(() => __ruta.simular(0.5)); await p.waitForTimeout(1500); await foto("6ventanilla");
await p.click("text=Pedir documentación"); await p.waitForTimeout(900); await foto("7docs");
await p.click("button.preg >> nth=0"); await p.waitForTimeout(900);
await p.click("button.preg >> nth=4"); await p.waitForTimeout(900);
await p.click("role=tab[name='Tablet']"); await p.click("text=Usar el DNI presentado"); await p.waitForTimeout(600); await foto("8tablet");
await p.click("text=Vehículos"); await p.click("text=Patente del vehículo"); await p.waitForTimeout(500); await foto("8tablet-veh");
await p.click("role=tab[name='Alcoholímetro']"); await p.click("text=Hacer soplar"); await p.waitForTimeout(3300); await foto("9alco");
await p.click("role=tab[name='Resolver']"); await p.waitForTimeout(300);
const correcta = await q(() => resolucionCorrecta(faltasReales(__ruta.insp.p)));
const reales = await q(() => faltasReales(__ruta.insp.p));
console.log("correcta:", correcta, reales);
await p.click(`button.opcion.${correcta}`);
if (correcta !== "pasar") for (const k of reales) { const n = await q((k) => __ruta.Juego.nombreFalta(k, __ruta.insp.p), k); const l = p.locator("label.cargo", { hasText: n }); if (await l.count()) await l.click(); }
await p.waitForTimeout(300); await foto("10resolver");
await p.click(".resolver > button.boton"); await p.waitForTimeout(800); await foto("11resuelto");
console.log("rep:", await q(() => __ruta.Juego.est.reputacion), "atendidos:", await q(() => __ruta.Juego.est.atendidos));
await q(() => __ruta.simular(4)); await p.waitForTimeout(600); await foto("12despues");
// Segundo: le metemos droga escondida para probar baúl y arresto.
for (let i = 0; i < 30 && !(await q(() => !!(__ruta.parado && __ruta.insp))); i++) await q(() => __ruta.simular(2));
await q(() => { const p = __ruta.insp.p; p.baul.push({ nombre: "Paquete rectangular encintado", color: "#c9b27a", ilegal: "drogas", escondido: true }); });
await q(() => { const y = __ruta.yo, v = __ruta.parado; y.x = v.x + 0.3; y.z = v.z - v.largo / 2 - 1.2; y.yaw = Math.PI; y.pitch = -0.35; __ruta.simular(0.2); });
await p.waitForTimeout(300); await foto("13atras-moto");
console.log("acciones atrás:", JSON.stringify(await q(() => __ruta.Juego.est.acciones)));
await p.keyboard.press("f"); await p.waitForTimeout(1200); await foto("13baul");
// Mover las cosas de arriba para destapar el paquete y secuestrarlo.
const caja = await p.locator("canvas.baul-lienzo").boundingBox();
const esc = Math.min(caja.width / 820, caja.height / 500), ox = caja.x + (caja.width - 820 * esc) / 2, oy = caja.y + (caja.height - 500 * esc) / 2;
// Sacar de encima lo que tape al paquete, hasta que quede arriba de todo.
for (let i = 0; i < 8; i++) {
  const r = await q(() => { const c = __ruta.insp.baulCosas, pq = c.find((o) => o.o && o.o.ilegal), cx = pq.x + pq.w / 2, cy = pq.y + pq.h / 2; for (let k = c.length - 1; k >= 0; k--) { const o = c[k]; if (cx > o.x && cx < o.x + o.w && cy > o.y && cy < o.y + o.h) return { cx, cy, arriba: o === pq }; } return { cx, cy, arriba: true }; });
  await p.mouse.move(ox + r.cx * esc, oy + r.cy * esc);
  if (r.arriba) break;
  await p.mouse.down(); await p.mouse.move(ox + (i % 2 ? 90 : 740) * esc, oy + 430 * esc, { steps: 4 }); await p.mouse.up();
  await p.mouse.move(ox + r.cx * esc, oy + r.cy * esc);
}
await p.waitForTimeout(400); await foto("14baul-destapado");
await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(600); await foto("15baul-secuestro");
console.log("hallazgos:", await q(() => __ruta.insp.hallazgos.length));
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
await q(() => { const y = __ruta.yo, v = __ruta.parado; y.x = v.x + v.ancho / 2 + 0.8; y.z = v.z + v.largo * 0.1; __ruta.simular(0.2); });
await p.keyboard.press("e"); await p.waitForTimeout(500);
await p.click("role=tab[name='Resolver']"); await p.click("button.opcion.arrestar"); await p.click("label.cargo >> text=estupefacientes"); await p.click(".resolver > button.boton");
await q(() => __ruta.simular(1)); await p.waitForTimeout(600); await foto("16arresto");
await q(() => { const y = __ruta.yo, pe = __ruta.personas.find((x) => x.p && !x.esposado && !x.demorado); y.x = pe.x + 1; y.z = pe.z; y.yaw = Math.PI / 2; __ruta.simular(0.2); });
console.log("acciones arresto:", JSON.stringify(await q(() => __ruta.Juego.est.acciones)));
await p.keyboard.press("r"); await q(() => __ruta.simular(0.3));
// Caminar a la zona: lo llevamos en pasos para que el detenido siga.
for (let i = 0; i < 12; i++) await q(() => { const y = __ruta.yo, zx = PUESTO.zona[0], zz = PUESTO.zona[2]; const dx = zx - y.x, dz = zz - y.z, d = Math.hypot(dx, dz); if (d > 0.5) { y.x += dx / d * Math.min(d, 1.4); y.z += dz / d * Math.min(d, 1.4); } __ruta.simular(0.5); });
await q(() => { const y = __ruta.yo; y.yaw = Math.PI * 0.1; y.pitch = -0.2; __ruta.simular(1.5); });
await p.waitForTimeout(500); await foto("17zona");
console.log("acciones zona:", JSON.stringify(await q(() => __ruta.Juego.est.acciones)));
await p.keyboard.press("e"); await q(() => __ruta.simular(3));
await p.keyboard.press("q"); await q(() => __ruta.simular(1));
console.log("patrulla:", await q(() => __ruta.patrulla && __ruta.patrulla.fase));
for (let i = 0; i < 20 && (await q(() => __ruta.patrulla && __ruta.patrulla.fase === "viene")); i++) await q(() => __ruta.simular(1.5));
await q(() => { const y = __ruta.yo; y.x = -8; y.z = -2; y.yaw = -Math.PI * 0.62; y.pitch = -0.1; __ruta.simular(3); });
await p.waitForTimeout(500); await foto("18patrullero");
for (let i = 0; i < 20 && (await q(() => __ruta.patrulla && __ruta.patrulla.fase !== "va")); i++) await q(() => __ruta.simular(1.5));
console.log("patrulla después:", await q(() => __ruta.patrulla && __ruta.patrulla.fase), "zona:", await q(() => __ruta.zona.length), "rep:", await q(() => __ruta.Juego.est.reputacion));
// Vista de la playa de secuestro y de noche.
await q(() => { const y = __ruta.yo; y.x = -9; y.z = 12; y.yaw = Math.PI * 0.35; y.pitch = -0.2; __ruta.simular(0.3); });
await p.waitForTimeout(500); await foto("19playa");
// Hasta el final del turno resolviendo lo que venga con la decisión correcta.
for (let n = 0; n < 70; n++) {
  const m = await q(() => __ruta.Juego.est.modo); if (m !== "jugando") break;
  await q(() => {
    if (__ruta.insp && !__ruta.insp.resuelto) { const c = resolucionCorrecta(faltasReales(__ruta.insp.p)); __ruta.Juego.resolver(c, faltasReales(__ruta.insp.p).filter((k) => FALTAS[k].gravedad === "leve")); }
    const pe = __ruta.personas.find((x) => x.p && !x.esposado && !x.demorado && !x.arrestado);
    if (pe) { const y = __ruta.yo; y.x = pe.x + 1; y.z = pe.z; __ruta.simular(0.1); __ruta.Juego.accion("R"); y.x = PUESTO.zona[0]; y.z = PUESTO.zona[2]; __ruta.simular(4); pe.x = y.x + 0.5; pe.z = y.z; __ruta.simular(0.2); __ruta.Juego.accion("E"); }
    __ruta.simular(20);
  });
  if (n === 9 && (await q(() => __ruta.Juego.est.modo)) === "jugando") { await q(() => { const y = __ruta.yo; y.x = -0.4; y.z = -12; y.yaw = Math.PI; y.pitch = 0; __ruta.simular(0.1); }); console.log("render noche:", JSON.stringify(await medir())); await foto("21noche"); }
  if (n === 6) { await q(() => { const y = __ruta.yo; y.x = 0.4; y.z = -8; y.yaw = Math.PI * 0.95; y.pitch = 0; __ruta.simular(0.1); }); await p.waitForTimeout(500); await foto("20tarde"); }
}
console.log("hora:", await q(() => __ruta.Juego.est.hora), "modo:", await q(() => __ruta.Juego.est.modo));
console.log("render:", JSON.stringify(await medir()));
await q(() => __ruta.simular(6)); await p.waitForTimeout(800); await foto("22resumen");
console.log("resumen:", await q(() => { const r = __ruta.Juego.resumen; return r && JSON.stringify({ rep: r.reputacion, at: r.atendidos, tot: r.total, rec: r.recaudado, mal: r.hist.filter((h) => !h.ok).map((h) => h.decision + "≠" + h.correcta + " " + h.msg) }); }));
console.log("errores:", errores.length ? errores.join("\n") : "ninguno");
console.log("tiempo total", ((Date.now() - t0) / 1000).toFixed(0), "s");
await b.close();
