// Prueba de Isla Royale: carga, idioma, vestíbulo (todas las pestañas), autobús, caída,
// palanca y mirada táctil, cofre, botín, pico, construcción, pelea, mira de francotirador,
// mapa, tormenta, victoria y la carrera con la partida anotada. Uso:
//   python3 herramientas/descargable/empaquetar.py isla-royale/index.html $S/isla-royale.html
//   PW=$(npm root -g)/playwright S=$S node isla-royale/prueba.mjs pc|tel|vertical [es|en|pt]
// Fotos en $S/tiras/. MENU=1 corta después del vestíbulo (para mirar textos en otro idioma).
// "vertical" es un teléfono parado (390×844): el juego tiene que verse acostado y la palanca
// tiene que mover al jugador hacia donde mira la cámara, aunque la pantalla esté girada.
// Avanza con __isla.simular(seg): SwiftShader dibuja a 1-3 cuadros por segundo.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const S = process.env.S, nom = process.argv[2] || "pc", idioma = process.argv[3] || "es";
const tactil = nom === "tel" || nom === "vertical";
const vista = nom === "vertical" ? { width: 390, height: 844 } : nom === "tel" ? { width: 844, height: 390 } : { width: 1100, height: 620 };
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: vista, hasTouch: tactil, isMobile: tactil });
const p = await ctx.newPage();
const errores = [], fallas = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message + " " + (e.stack || "").split("\n")[1]));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_FAILED")) errores.push(m.text().slice(0, 300)); });
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
const foto = (n) => p.screenshot({ path: `${S}/tiras/v4-${nom}-${idioma}-${n}.png`, timeout: 120000 });
const q = (fn, a) => p.evaluate(fn, a);
const revisar = (ok, txt) => { console.log((ok ? "OK   " : "FALLA") + " " + txt); if (!ok) fallas.push(txt); };
const t0 = Date.now();
const SONIDOS_CREDITOS_N = 2; // trueno y autobús: los únicos CC-BY de sonidos/manifiesto.json para isla
await p.goto("file://" + S + "/isla-royale.html");
await p.waitForTimeout(1500);
await foto("carga");
const giro = await q(() => ({ activo: GIRO.activo, ancho: GIRO.ancho, alto: GIRO.alto, clases: document.documentElement.className, transform: document.getElementById("raiz").style.transform }));
console.log("giro:", JSON.stringify(giro));
revisar(giro.activo === (nom === "vertical"), "girado solo en el teléfono parado");
if (nom === "vertical") revisar(giro.ancho === 844 && giro.alto === 390 && giro.clases.includes("bajo") && !giro.clases.includes("angosto"), "girado: tamaño lógico 844×390 con el diseño de teléfono acostado");

// Idioma: aparece cada vez, antes del menú.
await p.waitForSelector(".pantalla-idioma", { timeout: 180000 });
console.log("pantalla de idioma en", Date.now() - t0, "ms");
await p.waitForTimeout(1200);
await foto("idioma");
await p.click(`[data-idioma="${idioma}"]`);
await p.waitForTimeout(600);
revisar(await q((i) => document.documentElement.lang === i && !document.querySelector(".pantalla-idioma"), idioma), "idioma elegido: " + idioma);

// Sonidos: el clic del idioma arrancó el audio; las muestras se decodifican solas.
await p.waitForFunction(() => { const e = Sonido.estado(); return e.decodificados + e.fallidos >= e.total; }, null, { timeout: 60000 }).catch(() => {});
const snd = await q(() => Sonido.estado());
revisar(snd.total > 0 && snd.decodificados === snd.total && snd.fallidos === 0, `sonidos decodificados: ${snd.decodificados}/${snd.total} (fallidos ${snd.fallidos}); lazos grabados listos: ${snd.lazos.join(",")}`);

// Vestíbulo: todas las pestañas.
await p.waitForTimeout(1500);
await foto("vestibulo");
for (const k of ["casillero", "carrera", "pase", "opciones"]) { await p.click(`[data-pestana="${k}"]`); await p.waitForTimeout(1800); await foto("v-" + k); }
// Créditos de los sonidos (CC-BY): dentro de Opciones.
await p.click(".opciones-hoja .pestanas button:last-child"); await p.waitForTimeout(1200); await foto("v-creditos");
const creditos = await q(() => [...document.querySelectorAll("[data-credito]")].map((li) => li.textContent));
revisar(creditos.length === SONIDOS_CREDITOS_N, "créditos en pantalla: " + creditos.join(" | "));
await p.click(`[data-pestana="jugar"]`); await p.waitForTimeout(800);
if (process.env.MENU) { await b.close(); console.log(errores.slice(0, 12).join("\n") || "sin errores"); process.exit(fallas.length ? 1 : 0); }

// Coordenadas: la prueba piensa en el contenedor del juego y toca la pantalla.
// Girado, el punto (x, y) del juego está en (anchoVentana - y, x) de la pantalla.
const aPantalla = (x, y) => (giro.activo ? { x: vista.width - y, y: x } : { x, y });
const cdp = tactil ? await ctx.newCDPSession(p) : null;
const dedo = async (tipo, pts) => cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: pts.map(([x, y], i) => { const s = aPantalla(x, y); return { x: s.x, y: s.y, id: i + 1 }; }) });

await p.click("button.jugar"); await p.waitForTimeout(3500);
await foto("cargapartida");
await p.waitForFunction(() => __isla.modo === "juego", null, { timeout: 90000 });
await p.waitForTimeout(1500);
await foto("bus");
revisar((await q(() => Sonido.estado().niveles.motor || 0)) > 0.1, "lazo del autobús sonando en el autobús: " + (await q(() => Sonido.estado().niveles.motor)));
await q(() => { __isla.simular(4); __isla.entrada.saltar = true; __isla.simular(3); });
await p.waitForTimeout(800); await foto("cae");
revisar((await q(() => Sonido.estado().niveles.viento || 0)) > 0.1, "viento del planeador al caer: " + (await q(() => Sonido.estado().niveles.viento)));
console.log("caída:", await q(() => { const yo = __isla.P.jugadores[0]; return yo.estado + " " + yo.y.toFixed(0); }));
// De a un segundo y curando: a veces un bot cae al lado y mata al jugador apenas toca el piso.
await q(() => { for (let k = 0; k < 25; k++) { const yo = __isla.P.jugadores[0]; if (yo.vivo) { yo.vida = 100; yo.escudo = Math.max(yo.escudo, 50); } __isla.simular(1); } });
console.log("en tierra:", await q(() => __isla.P.jugadores.filter((j) => j.estado === "tierra").length + "/" + __isla.P.jugadores.length));

if (tactil) {
  // Un lugar abierto: lejos de casas y árboles, en tierra firme, para que nada frene al caminar.
  const lugar = await q(() => {
    const M = __isla, I = M.isla, yo = M.P.jugadores[0];
    const obst = I.arboles.concat(I.rocas, I.autos).map((o) => ({ x: o.x, z: o.z, r: (o.radio || 2.5) + 7 })).concat(I.lugares.map((o) => ({ x: o.x, z: o.z, r: 60 })), I.edificios.map((e) => ({ x: (e.min.x + e.max.x) / 2, z: (e.min.z + e.max.z) / 2, r: Math.hypot(e.max.x - e.min.x, e.max.z - e.min.z) / 2 + 8 })));
    for (let r = 60; r < 240; r += 12) for (let a = 0; a < 6.28; a += 0.4) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = I.terreno(x, z);
      if (h < 1.5 || Math.abs(I.terreno(x + 6, z) - h) > 1.2 || Math.abs(I.terreno(x, z + 6) - h) > 1.2) continue;
      if (obst.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)) continue;
      if (Math.abs(M.sueloEn(x, z, h + 1) - h) > 0.3) continue;
      yo.x = x; yo.z = z; yo.y = h + 0.05; yo.vx = yo.vz = yo.vy = 0; yo.estado = "tierra"; yo.yaw = 0.7; yo.pitch = 0; M.P.tormenta.x = x; M.P.tormenta.z = z; M.P.tormenta.r = 300;
      M.simular(0.4); return { x, z };
    }
    return null;
  });
  console.log("lugar abierto:", JSON.stringify(lugar));
  const pos = () => q(() => { const yo = __isla.P.jugadores[0]; return { x: yo.x, z: yo.z, yaw: yo.yaw }; });
  const probarPalanca = async (nombre, hacia, esperado) => {
    await q(() => { const yo = __isla.P.jugadores[0]; yo.vida = 100; yo.escudo = 100; });
    const a = await pos();
    await dedo("touchStart", [[120, 280]]); await p.waitForTimeout(150);
    await dedo("touchMove", [[120 + hacia[0], 280 + hacia[1]]]); await p.waitForTimeout(300);
    const e = await q(() => [__isla.entrada.mx, __isla.entrada.my]);
    await q(() => __isla.simular(1));
    const d = await pos();
    await dedo("touchEnd", []); await p.waitForTimeout(200);
    const dx = d.x - a.x, dz = d.z - a.z, l = Math.hypot(dx, dz);
    // La cámara mira hacia (-sen yaw, -cos yaw); su derecha es (cos yaw, -sen yaw).
    const f = esperado === "adelante" ? [-Math.sin(a.yaw), -Math.cos(a.yaw)] : [Math.cos(a.yaw), -Math.sin(a.yaw)];
    const cos = l ? (dx * f[0] + dz * f[1]) / l : 0;
    revisar(l > 2 && cos > 0.95, `palanca ${nombre}: entrada ${e.map((v) => v.toFixed(2))}, se movió ${l.toFixed(1)} m, coseno con "${esperado}" de la cámara ${cos.toFixed(3)}`);
  };
  await probarPalanca("hacia arriba del juego", [0, -80], "adelante");
  await probarPalanca("hacia la derecha del juego", [80, 0], "derecha");
  // Mirar: arrastrar hacia la derecha del juego gira a la derecha (el yaw baja).
  const y0 = (await pos()).yaw;
  // (470, 70): zona de mirar sin botones encima (más abajo están recargar y apuntar).
  await dedo("touchStart", [[470, 70]]); await p.waitForTimeout(120);
  for (let k = 1; k <= 4; k++) { await dedo("touchMove", [[470 + k * 25, 70]]); await p.waitForTimeout(80); }
  await q(() => __isla.simular(0.1));
  await dedo("touchEnd", []);
  const y1 = (await pos()).yaw;
  revisar(y1 - y0 < -0.3, `mirar: arrastre de 100 px a la derecha del juego → yaw ${(y1 - y0).toFixed(2)} rad`);
  await p.waitForTimeout(1500); await foto("tactil");
}

// Los bots pelean de verdad y a veces matan al jugador en medio del recorrido (le pasó a
// "vertical es"): se lo cura antes de cada paso para que la prueba llegue al final.
const curar = () => q(() => { const yo = __isla.P.jugadores[0]; if (yo.vivo) { yo.vida = 100; yo.escudo = 100; } });
// Al lado de un cofre en una casa.
await curar();
await q(() => { const P = __isla.P, yo = P.jugadores[0], c = P.cofres.find((c) => c.tipo === "cofre"); yo.x = c.x + 1.2; yo.z = c.z + 0.2; yo.y = c.y + 0.3; yo.estado = "tierra"; yo.yaw = Math.atan2(-(c.x - yo.x), -(c.z - yo.z)); __isla.simular(0.3); __isla.entrada.usar = true; __isla.simular(1.5); });
await p.waitForTimeout(3500); await foto("cofre");
console.log("cofre:", await q(() => { const P = __isla.P, yo = P.jugadores[0]; return JSON.stringify({ inv: yo.inv.map((i) => i && (i.arma || i.c || i.tipo)), mun: yo.mun, mats: yo.mats, cerca: P.botin.filter((b) => Math.hypot(b.x - yo.x, b.z - yo.z) < 4).map((b) => b.item.tipo) }); }));
// Agarrar todo lo que quedó cerca.
await q(() => { const P = __isla.P, yo = P.jugadores[0]; for (const b of P.botin.filter((b) => Math.hypot(b.x - yo.x, b.z - yo.z) < 5)) { yo.x = b.x; yo.z = b.z; __isla.simular(0.2); } });
console.log("inventario:", await q(() => { const yo = __isla.P.jugadores[0]; return JSON.stringify({ inv: yo.inv.map((i) => i && (i.arma || i.c || i.tipo) + (i.rareza != null ? "/" + i.rareza : "")), mun: yo.mun, mats: yo.mats }); }));
// Pico contra un árbol.
await curar();
await q(() => { const P = __isla.P, yo = P.jugadores[0], a = __isla.isla.arboles[5]; yo.x = a.x + 1.4; yo.z = a.z; yo.y = a.y0 + 0.5; yo.sel = 0; yo.yaw = Math.PI / 2; yo.pitch = 0.1; __isla.simular(0.3); __isla.entrada.raton = true; __isla.simular(2.5); __isla.entrada.raton = false; });
console.log("madera tras picar:", await q(() => __isla.P.jugadores[0].mats.madera));
await q(() => { const P = __isla.P, yo = P.jugadores[0]; yo.x += 8; __isla.simular(0.3); yo.mats.madera = Math.max(yo.mats.madera, 60); __isla.entrada.pieza = "muro"; __isla.entrada.raton = true; __isla.simular(0.2); __isla.entrada.raton = false; yo.yaw += Math.PI / 2; __isla.entrada.pieza = "escalera"; __isla.simular(0.1); __isla.entrada.raton = true; __isla.simular(0.2); __isla.entrada.raton = false; __isla.entrada.pieza = "piso"; yo.pitch = 0; __isla.simular(0.1); __isla.entrada.raton = true; __isla.simular(0.2); __isla.entrada.raton = false; __isla.simular(0.5); });
await p.waitForTimeout(3500); await foto("construye");
console.log("construcciones:", await q(() => __isla.P.estructuras.map((s) => s.tipo2).join(",")));
// Pelea: un bot enfrente, el jugador con un rifle.
await curar();
await q(() => { const P = __isla.P, yo = P.jugadores[0], bt = P.jugadores[1]; yo.construyendo = false; yo.inv[1] = { tipo: "arma", arma: "rifle", rareza: 3, mun: 30 }; yo.mun.mediana = 120; yo.sel = 1; yo.yaw += Math.PI; bt.vivo = true; bt.estado = "tierra"; bt.x = yo.x - Math.sin(yo.yaw) * 14; bt.z = yo.z - Math.cos(yo.yaw) * 14; bt.y = __isla.sueloEn(bt.x, bt.z, yo.y + 3, 5); bt.escudo = 50; bt.inv[1] = { tipo: "arma", arma: "escopeta", rareza: 1, mun: 5 }; bt.mun.cartuchos = 20; __isla.simular(0.4); yo.pitch = Math.atan2(bt.y + 1.2 - (yo.y + 1.4), 14); __isla.entrada.raton = true; __isla.simular(1.5); __isla.entrada.raton = false; });
await p.waitForTimeout(3500); await foto("pelea");
console.log("pelea:", await q(() => { const P = __isla.P, yo = P.jugadores[0], bt = P.jugadores[1]; return JSON.stringify({ yo: [yo.vida, yo.escudo], bot: [Math.round(bt.vida), Math.round(bt.escudo), bt.vivo], tiros: yo.tiros, aciertos: yo.aciertos.toFixed(1), feed: P.feed.map((f) => f.a + ">" + f.b) }); }));
// Francotirador y mapa.
await curar();
await q(() => { const yo = __isla.P.jugadores[0]; yo.inv[2] = { tipo: "arma", arma: "francotirador", rareza: 4, mun: 1 }; yo.mun.pesada = 12; yo.sel = 2; __isla.entrada.apuntar = true; __isla.simular(0.5); });
await p.waitForTimeout(3500); await foto("mira");
await q(() => { __isla.entrada.apuntar = false; __isla.alMapa(); });
await p.waitForTimeout(1500); await foto("mapa");
if (tactil) {
  // Tocar el mapa en el 25 % del ancho y el 75 % del alto del juego tiene que marcar (-130, 130).
  const r = await q(() => { const c = document.querySelector(".mapa-grande canvas"); return GIRO.rectLocal(c.getBoundingClientRect()); });
  const s = aPantalla(r.left + r.width * 0.25, r.top + r.height * 0.75);
  await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(400);
  const m = await q(() => __isla.P.marca);
  revisar(m && Math.abs(m.x + 130) < 4 && Math.abs(m.z - 130) < 4, "marca en el mapa: " + JSON.stringify(m && { x: Math.round(m.x), z: Math.round(m.z) }));
}
await q(() => __isla.alMapa());
// Olas: en la costa, con agua a menos de 22 m.
const olas = await q(() => { const M = __isla, I = M.isla, yo = M.P.jugadores[0]; let r = 0; while (I.terreno(r, 0) > -1.3 && r < 400) r += 2; yo.x = r - 12; yo.z = 0; yo.y = I.terreno(yo.x, 0) + 0.05; yo.estado = "tierra"; M.simular(1.2); return { x: yo.x, nivel: Sonido.estado().niveles.olas }; });
await p.waitForTimeout(2500);
const nivelOlas = await q(() => Sonido.estado().niveles.olas);
revisar(nivelOlas > 0.05, `olas en la costa (x ${olas.x.toFixed(0)}): ${nivelOlas}`);
// Tormenta y fin.
await q(() => { const P = __isla.P, yo = P.jugadores[0]; P.tormenta.x = yo.x + 80; P.tormenta.z = yo.z; P.tormenta.r = 40; __isla.simular(3.2); });
console.log("tormenta:", await q(() => { const yo = __isla.P.jugadores[0]; return `vida ${Math.round(yo.vida)} escudo ${Math.round(yo.escudo)}`; }));
await p.waitForTimeout(1200); await foto("tormenta");
revisar((await q(() => Sonido.estado().niveles.tormenta || 0)) > 0.3, "lazo de la tormenta adentro de la tormenta: " + (await q(() => Sonido.estado().niveles.tormenta)));
await q(() => { const P = __isla.P; P.jugadores[0].vida = 100; P.jugadores.slice(1).forEach((j) => { if (j.vivo) __isla.herir(j, 999, P.jugadores[0], false, "bala"); }); __isla.simular(0.4); });
await p.waitForTimeout(3500); await foto("fin");
console.log("fin:", await q(() => document.querySelector(".victoria")?.textContent + " | " + document.querySelector(".datos")?.innerText.replace(/\n/g, " ")));
// De vuelta al vestíbulo: la partida tiene que quedar en la carrera y en los desafíos.
await p.click(".botonera .jugar.sec:last-child"); await p.waitForTimeout(1500);
await p.click(`[data-pestana="carrera"]`); await p.waitForTimeout(1800); await foto("v-carrera-despues");
const carrera = await q(() => JSON.parse(localStorage.getItem("isla-royale:stats")));
revisar(carrera && carrera.partidas >= 1 && carrera.historial.length >= 1 && carrera.historial[0].gano, "carrera anotada: " + JSON.stringify(carrera && { partidas: carrera.partidas, victorias: carrera.victorias, mejorPuesto: carrera.mejorPuesto, recBajas: carrera.recBajas, historial: carrera.historial.length }));
await p.click(`[data-pestana="pase"]`); await p.waitForTimeout(1800); await foto("v-pase-despues");
// Los golpes que el recorrido no pisa (pico en piedra y metal, recarga): se llaman directo.
await q(() => { Sonido.pico("piedra"); Sonido.pico("metal"); Sonido.recarga(); });
const sonados = await q(() => Sonido.estado().sonados);
console.log("muestras que sonaron:", JSON.stringify(sonados));
const golpes = ["pasos_pasto", "disparo_pistola", "disparo_rifle", "disparo_escopeta", "disparo_franco", "recarga", "pico_madera", "pico_piedra", "pico_metal", "construir", "cofre", "cofre_brillo", "trueno", "ui_clic", "ui_confirmar", "victoria", "golpe_dano"];
const faltan = golpes.filter((g) => !Object.keys(sonados).some((id) => id === g || id.startsWith(g + "_")));
console.log("golpes grabados que no sonaron en este recorrido:", faltan.join(", ") || "ninguno");
await b.close();
console.log(errores.slice(0, 12).join("\n") || "sin errores");
console.log(fallas.length ? `${fallas.length} FALLAS` : "todo OK");
