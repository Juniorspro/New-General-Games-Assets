// Partida entera de Los Montes, a mano por la API del juego (sin mouse): objetos, pistas,
// jaulas, refugio y guardado, arreglo de la camioneta, manejo, grúa (troncos y la jaula
// colgada), mina, cueva, tranquera, subir a la gente, fuga y final; después una muerte.
// Cada paso dice BIEN o MAL con su dato. Uso:
//   python3 herramientas/descargable/empaquetar.py los-montes/index.html $S/los-montes.html
//   PW=$(npm root -g)/playwright S=$S node los-montes/prueba-completa.mjs
// El jugador va con invulnerabilidad salvo en la prueba de la muerte: lo que se prueba
// es que cada cosa se pueda hacer, no la pelea (eso lo mira prueba.mjs con fotos).
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const S = process.env.S;
fs.mkdirSync(S + "/montes", { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errores = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" | ")));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_FAILED")) errores.push(m.text().slice(0, 300)); });
await p.route("**/*", (r) => (r.request().url().startsWith("file://") ? r.continue() : r.abort()));
await p.goto("file://" + S + "/los-montes.html");
await p.waitForFunction(() => typeof Juego !== "undefined" && Juego.est.modo === "menu", null, { timeout: 240000 });
await p.waitForTimeout(4000);
await p.click(".idioma-btn >> nth=0"); await p.waitForTimeout(4500);
await p.evaluate(() => { Juego.congelar(true); Juego.aplicarOpciones({ verIntro: false }); });
await p.click(".boton.grande"); await p.waitForTimeout(500);
await p.evaluate(() => { Juego.saltarIntro(); Juego.simular(0.3); });

// Ayudas adentro de la página.
await p.evaluate(() => {
  const J = Juego, yo = J.yo;
  // Sin dibujar en cada paso (SwiftShader tarda 1–3 s por cuadro): las fotos dibujan aparte.
  const sim = J.simular; J.simular = (s, p1 = 1 / 30) => sim(s, p1, false);
  window.__p = {
    // Pararse a `d` metros de (tx, tz), mirándolo.
    ir(tx, tz, zona = "ext", d = 1.2, desde = null) {
      // Cerrar un panel pide el puntero; sin pantalla eso falla y el juego se pausa solo.
      J.est.pausado = false; J.est.panel = null;
      if (yo.zona !== zona) J.setZona(zona);
      const a = desde ?? Math.random() * 6.28, x = tx + Math.sin(a) * d, z = tz + Math.cos(a) * d;
      yo.x = x; yo.z = z; yo.yaw = Math.atan2(-(tx - x), -(tz - z)); yo.invul = 1e9;
      J.simular(0.25);
      return J.est.accion ? J.est.accion.texto : null;
    },
    // Apretar E (y sostenerla si es larga).
    usar(seg = 0) { J.accion(true); J.simular(seg || 0.1); J.accion(false); J.simular(0.1); return J.est.accion ? J.est.accion.texto : null; },
    // Busca dónde estacionar (de culata al blanco) y cómo poner la grúa para que el gancho
    // quede sobre (tx, ty, tz); devuelve la distancia que logró.
    apuntarGrua(tx, ty, tz, mide) {
      const k = Lugares.camionetas[0], G = k.grua; let mejor = null;
      const poner = (x, z, rumbo) => { k.rumbo = rumbo; k.g.rotation.set(0, rumbo, 0); k.g.position.set(x, Terreno.altura(x, z), z); Colision.mover(k.col, x, z, rumbo); };
      for (const r of [3, 4, 5]) for (let a = 0; a < 6.28; a += 0.52) {
        const x = tx + Math.sin(a) * r, z = tz + Math.cos(a) * r, rumbo = Math.atan2(tx - x, tz - z) + Math.PI; poner(x, z, rumbo);
        for (let gi = -0.9; gi <= 0.9; gi += 0.15) for (const al of [0, 0.25, 0.5, 0.8, 1.05]) for (const la of [1, 2.5, 4, 9]) {
          G.giro = gi; G.alza = al; G.largo = la; J.simular(1 / 60);
          const d = mide(G.gancho.position); if (!mejor || d < mejor.d) mejor = { d, x, z, rumbo, gi, al, la };
        }
      }
      poner(mejor.x, mejor.z, mejor.rumbo); G.giro = mejor.gi; G.alza = mejor.al; G.largo = mejor.la; J.simular(1 / 30);
      return mejor.d;
    },
    probarLados(tx, tz, zona, d, cond, seg = 0, hecho = () => false) { let r = null; for (let k = 0; k < 8 && !hecho(); k++) { const t = this.ir(tx, tz, zona, d, (k / 8) * 6.28); if (cond(t)) r = this.usar(seg) ?? "ok"; } return r; },
  };
});
const q = (fn, a) => p.evaluate(fn, a);
const res = [];
const paso = (nombre, ok, dato) => { res.push([ok ? "BIEN" : "MAL ", nombre, dato]); console.log(ok ? "BIEN" : "MAL ", nombre, JSON.stringify(dato)); };
const foto = async (n) => { await q(() => Juego.R.render(Juego.escena, Juego.cam)); return p.screenshot({ path: `${S}/montes/completa-${n}.png`, timeout: 120000 }); };

// 1 · Objetos de afuera y de las cabañas (los de la mina y la cueva, cuando se entra).
let r = await q(() => {
  const L = Lugares, J = Juego; let ok = 0, falla = [];
  for (const o of L.objetos) {
    if (o.zona === "mina" || o.zona === "cueva") continue;
    const t = __p.probarLados(o.x, o.z, o.zona, 0.9, (t) => t && /Tomar|Agarrar/i.test(t), 0, () => o.tomado);
    if (o.tomado) ok++; else falla.push(o.tipo + "@" + o.zona + " (" + (t || J.est.accion?.texto || "nada") + ")");
  }
  return { ok, total: L.objetos.filter((o) => o.zona !== "mina" && o.zona !== "cueva").length, falla, inv: J.est.inv, armas: J.est.armas };
});
paso("tomar objetos de afuera y de las cabañas", r.ok === r.total, r);

// 2 · Pistas (las 12 del diario, salvo las de bajo tierra).
r = await q(() => {
  const L = Lugares, J = Juego; let ok = 0, falla = [];
  for (const pi of L.pistas) {
    if (pi.zona === "mina" || pi.zona === "cueva") continue;
    __p.probarLados(pi.x, pi.z, pi.zona, 0.9, (t) => t && /Leer/i.test(t), 0, () => pi.leida);
    if (pi.leida) ok++; else falla.push(pi.id + "@" + pi.zona);
    if (J.est.panel) J.cerrarPanel();
  }
  return { ok, total: L.pistas.filter((x) => x.zona !== "mina" && x.zona !== "cueva").length, falla, nota: J.est.nota };
});
paso("leer pistas de la superficie", r.ok === r.total, r);

// 3 · Jaulas de afuera y la persona atada.
r = await q(() => {
  const out = [];
  for (const s of Aliados.sobrev()) {
    if (s.zona !== "ext" && !s.zona.startsWith("cab")) continue;
    if (s.jaula && s.jaula.colgada) continue;
    const x = s.jaula ? s.jaula.x : s.x, z = s.jaula ? s.jaula.z : s.z;
    __p.probarLados(x, z, s.zona, 1.6, (t) => t && /Abrir|Desatar/i.test(t), 3.5, () => s.estado !== "preso" && s.estado !== "atado");
    out.push(s.nombre + ":" + s.estado);
  }
  return { out, rescatados: Juego.est.rescatados };
});
paso("abrir jaulas de afuera y desatar a la de la cabaña", r.out.every((x) => /sigue/.test(x)), r);
await foto("1-rescatados");

// 4 · Refugio: entrar con la gente (quedan a salvo) y guardar en la cama.
r = await q(() => {
  const J = Juego, ref = Aliados.refugio(), pu = Lugares.puertas.find((x) => x.cab === ref);
  __p.ir(pu.x, pu.z, "ext", 1.0); const t = J.est.accion?.texto; __p.usar();
  const zona = J.yo.zona; J.simular(0.5);
  const [bx, bz] = [ref.x + 2.8 * Math.cos(ref.rumbo) - 1.5 * Math.sin(ref.rumbo), ref.z - 2.8 * Math.sin(ref.rumbo) - 1.5 * Math.cos(ref.rumbo)];
  const tc = __p.probarLados(bx, bz, zona, 0.8, (t) => t && /Descansar|Dormir|guardar/i.test(t), 0, () => J.hayGuardada());
  return { texto: t, zona, aSalvo: J.est.aSalvo, cama: tc, guardada: J.hayGuardada(), extVisible: ref.ext.visible, intVisible: ref.int.g.visible };
});
paso("entrar al refugio: zona interior y gente a salvo", r.zona === "cab0" && r.aSalvo >= 1 && !r.extVisible && r.intVisible, r);
paso("guardar en la cama del refugio", r.guardada, r);
await foto("2-refugio");
await q(() => { const pu = Lugares.puertas.find((x) => x.cab === Aliados.refugio()); __p.ir(pu.dentro.x, pu.dentro.z, "cab0", 0.5); __p.usar(); });

// 5 · Camioneta de la grúa: colocar piezas con herramientas.
r = await q(() => {
  const J = Juego, k = Lugares.camionetas[0];
  J.est.inv.herramientas = Math.max(1, J.est.inv.herramientas); for (const pz of ["repuesto", "rueda", "bidon"]) J.est.inv[pz] = Math.max(1, J.est.inv[pz] || 0);
  const lado = { x: k.g.position.x + Math.cos(k.rumbo) * 1.6, z: k.g.position.z - Math.sin(k.rumbo) * 1.6 };
  const textos = [];
  for (let i = 0; i < 4 && !k.reparada; i++) { __p.ir(lado.x, lado.z, "ext", 1.0); textos.push(J.est.accion?.texto); __p.usar(4); }
  return { reparada: k.reparada, faltan: k.faltan, textos };
});
paso("arreglar la camioneta de la grúa", r.reparada, r);

// 6 · Manejar.
r = await q(() => {
  const J = Juego, k = Lugares.camionetas[0];
  const lado = { x: k.g.position.x + Math.cos(k.rumbo) * 1.6, z: k.g.position.z - Math.sin(k.rumbo) * 1.6 };
  __p.ir(lado.x, lado.z, "ext", 1.0); __p.usar();
  const x0 = k.g.position.x, z0 = k.g.position.z; J.entrada.teclas.KeyW = true; J.simular(4); J.entrada.teclas.KeyW = false; J.simular(1);
  return { manejando: J.est.manejando, recorrido: +Math.hypot(k.g.position.x - x0, k.g.position.z - z0).toFixed(1) };
});
paso("subir y manejar", r.manejando && r.recorrido > 5, r);
await foto("3-manejando");

// 7 · Grúa: enganchar los dos troncos de la salida y sacarlos de la ruta.
for (const id of ["troncoSalida1", "troncoSalida2"]) {
  r = await q((id) => {
    const J = Juego, k = Lugares.camionetas[0], G = k.grua, o = Lugares.obstaculos.find((x) => x.id === id);
    if (!J.est.grua) Vehiculos.alternarGrua();
    const eje = (h) => { const sx = Math.sin(o.rumbo), sz = Math.cos(o.rumbo), dx = h.x - o.o.position.x, dz = h.z - o.o.position.z, t = Math.max(-3.8, Math.min(3.8, dx * sx + dz * sz)); return Math.hypot(dx - sx * t, dz - sz * t) + Math.abs(o.o.position.y - h.y) * 0.2; };
    const d = __p.apuntarGrua(o.x, o.y, o.z, eje);
    J.entrada.enganchar = true; J.simular(0.2);
    const colgado = !!G.colgado;
    // Girar la grúa del todo a un costado y soltar: tiene que quedar fuera de la ruta.
    G.giro = G.giro > 0 ? -1.2 : 1.2; J.simular(0.2); J.entrada.enganchar = true; J.simular(0.2);
    return { d: +d.toFixed(2), colgado, suelto: o.suelto, distRuta: +Terreno.distRuta(o.o.position.x, o.o.position.z).toFixed(1), objetivo: J.est.objetivo };
  }, id);
  paso("grúa: enganchar " + id, r.colgado, r);
  paso("grúa: soltar " + id + " fuera de la ruta", r.suelto, r);
}
await foto("4-grua");

// 8 · La jaula colgada del aserradero: bajarla con la grúa y abrirla.
r = await q(() => {
  const J = Juego, k = Lugares.camionetas[0], G = k.grua, s = Aliados.sobrev().find((x) => x.jaula && x.jaula.colgada), j = s.jaula;
  if (!J.est.grua) Vehiculos.alternarGrua();
  const d = __p.apuntarGrua(j.x, j.g.position.y + 2.2, j.z, (h) => Math.hypot(h.x - j.x, h.z - j.z) + Math.abs(j.g.position.y + 2.2 - h.y) * 0.5);
  J.entrada.enganchar = true; J.simular(0.2);
  const enganchada = !!G.colgado; J.entrada.enganchar = true; J.simular(0.2);
  Vehiculos.alternarGrua(); Vehiculos.bajar(); J.simular(0.2);
  __p.probarLados(j.x, j.z, "ext", 1.6, (t) => t && /Abrir/i.test(t), 3.5, () => s.estado !== "preso");
  return { d: +d.toFixed(2), enganchada, colgada: j.colgada, estado: s.estado };
});
paso("bajar la jaula colgada con la grúa y abrirla", !r.colgada && r.estado === "sigue", r);

// 9 · Mina: entrar, objetos y pistas de adentro, la jaula; y la cueva.
for (const zona of ["mina", "cueva"]) {
  r = await q((zona) => {
    const J = Juego, pu = Lugares.puertas.find((x) => x.zonaDentro === zona);
    __p.ir(pu.x, pu.z, "ext", 1.0); const t = J.est.accion?.texto; __p.usar();
    const entro = J.yo.zona === zona;
    let obj = 0, pis = 0;
    for (const o of Lugares.objetos.filter((o) => o.zona === zona)) { __p.probarLados(o.x, o.z, zona, 0.9, (t) => t && /Tomar|Agarrar/i.test(t)); if (o.tomado) obj++; }
    for (const pi of Lugares.pistas.filter((x) => x.zona === zona)) { __p.probarLados(pi.x, pi.z, zona, 0.9, (t) => t && /Leer/i.test(t)); if (pi.leida) pis++; if (J.est.panel) J.cerrarPanel(); }
    const s = Aliados.sobrev().find((x) => x.jaula && x.jaula.zona === zona);
    if (s) __p.probarLados(s.jaula.x, s.jaula.z, zona, 1.6, (t) => t && /Abrir/i.test(t), 3.5);
    const datos = { texto: t, entro, obj: obj + "/" + Lugares.objetos.filter((o) => o.zona === zona).length, pistas: pis + "/" + Lugares.pistas.filter((x) => x.zona === zona).length, sobreviviente: s && s.estado };
    // Salir.
    __p.ir(pu.dentro.x, pu.dentro.z, zona, 0.6); __p.usar(); datos.salio = J.yo.zona === "ext";
    return datos;
  }, zona);
  paso(zona + ": entrar, revisar, rescatar y salir", r.entro && r.salio && (!r.sobreviviente || r.sobreviviente === "sigue") && !/^0\//.test(r.obj), r);
  await q(() => Juego.simular(0.5));
}
await foto("5-afuera");

// 10 · Tranquera, gente a bordo y fuga.
r = await q(() => {
  const J = Juego, Z = Lugares.zonas.salida;
  J.est.inv.herramientas = Math.max(1, J.est.inv.herramientas);
  __p.probarLados(Z.x, Z.z, "ext", 2.4, (t) => t && /cadena|tranquera/i.test(t), 3.6);
  const abierta = Z.abierta;
  // Todos los que siguen, al refugio; después la camioneta va a buscarlos.
  const ref = Aliados.refugio(), pu = Lugares.puertas.find((x) => x.cab === ref);
  __p.ir(pu.x, pu.z, "ext", 1.0); __p.usar(); __p.ir(pu.dentro.x, pu.dentro.z, ref.int.zona, 0.5); __p.usar();
  const k = Lugares.camionetas[0]; k.g.position.set(ref.x + 8, Terreno.altura(ref.x + 8, ref.z), ref.z); Colision.mover(k.col, ref.x + 8, ref.z, 0); k.combustible = 100;
  const lado = { x: k.g.position.x + Math.cos(k.rumbo) * 1.6, z: k.g.position.z - Math.sin(k.rumbo) * 1.6 };
  __p.ir(lado.x, lado.z, "ext", 1.0); __p.usar();
  const tSubir = J.est.accion?.texto; __p.usar();
  const aBordo = Aliados.aBordo();
  // Hasta la tranquera por la ruta y afuera.
  const S = MAPA.lugares.salida; k.rumbo = 0; k.g.position.set(S.x, Terreno.altura(S.x, S.z - 15), S.z - 15); Colision.mover(k.col, S.x, S.z - 15, 0);
  J.entrada.teclas.KeyW = true; for (let i = 0; i < 40 && J.est.modo === "jugando"; i++) J.simular(0.25); J.entrada.teclas.KeyW = false;
  return { abierta, tSubir, aBordo, modo: J.est.modo, resumen: J.est.resumen };
});
paso("abrir la tranquera con herramientas", r.abierta, r);
paso("subir a la gente a la camioneta", r.aBordo >= 3, r);
paso("escapar por la tranquera y ver el final", r.modo === "fin" && r.resumen && r.resumen.gano, r);
await q(() => Juego.congelar(false)); await p.waitForTimeout(5000); await foto("6-final");

// 11 · Continuar la partida guardada.
r = await q(() => { Juego.congelar(true); Juego.continuar({ ...Juego.opc }); Juego.simular(0.3); return { modo: Juego.est.modo, zona: Juego.yo.zona, aSalvo: Juego.est.aSalvo, armas: Juego.est.armas }; });
paso("continuar desde lo guardado", r.modo === "jugando" && r.aSalvo >= 1, r);

// 12 · Morir.
r = await q(() => { Juego.yo.invul = 0; Juego.danarJugador(500, null, "cazador"); return Juego.yo.vivo; });
await q(() => Juego.congelar(false)); await p.waitForTimeout(4000);
r = await q(() => ({ modo: Juego.est.modo, resumen: Juego.est.resumen }));
paso("morir y ver la pantalla de muerte", r.modo === "fin" && r.resumen && !r.resumen.gano, r);
await foto("7-muerte");

console.log("errores:", errores.length ? errores.join("\n") : "ninguno");
console.log("RESUMEN:", res.filter((x) => x[0] === "BIEN").length, "bien,", res.filter((x) => x[0] !== "BIEN").length, "mal");
await b.close();
