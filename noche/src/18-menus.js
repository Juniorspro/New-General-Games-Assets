// ─────────────────────────────────────────────────────────────────────────────
// LOS MENÚS: portada (castillo, luna y murciélagos), principal, elegir cazador, elegir escenario,
// tienda de mejoras (el oro de las partidas se gasta acá, con la fórmula de precio del original),
// opciones y resultados con la tabla de daño por arma. Todo en el mismo kit de botones.
// ─────────────────────────────────────────────────────────────────────────────

let PANT = "portada", RES = null, SEL = { pj: "antonia", esc: "bosque", mejora: 0 }, MSJ = null;
const _murcis = Array.from({ length: 9 }, (_, i) => ({ x: V.f() * 300, y: 40 + V.f() * 160, v: 12 + V.f() * 18, f: V.f() * 2 }));

/** El fondo de la portada: cielo, luna, el castillo en la loma y el bosque. Se hornea por tamaño. */
function fondoPortada() {
  return hornear(`portada|${W}|${H}`, () => {
    const c = lienzoNuevo(W, H), q = c.getContext("2d");
    const gr = q.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#07050f"); gr.addColorStop(0.55, "#2a0a1e"); gr.addColorStop(1, "#4a0c14"); q.fillStyle = gr; q.fillRect(0, 0, W, H);
    const r = mulberry(7); q.fillStyle = "#e8e0ff"; for (let i = 0; i < 70; i++) q.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.6), 1, 1);
    // la luna de sangre, grande, detrás del título (con sus manchas)
    const mx = Math.round(W * 0.76), my = 52, mr = 36;
    const gl = q.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.4); gl.addColorStop(0, "rgba(255,70,50,0.32)"); gl.addColorStop(1, "rgba(255,70,50,0)"); q.fillStyle = gl; q.fillRect(0, 0, W, H);
    const pm = new Pix(mr * 2 + 2, mr * 2 + 2); pm.bola(mr + 1, mr + 1, mr, mr, ["#5a0a0e", "#8a1414", "#b82020", "#d8402c", "#f07050"]);
    const rm = mulberry(99); for (let i = 0; i < 14; i++) { const a = rm() * TAU, d = rm() * mr * 0.75, rr = 2 + rm() * 5, cxm = mr + 1 + Math.cos(a) * d, cym = mr + 1 + Math.sin(a) * d; for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy <= rr * rr) { const c = pm.g(cxm + xx, cym + yy); if (c) pm.p(cxm + xx, cym + yy, mezclar(c, "#3a0408", 0.28)); } }
    q.drawImage(pm.canvas(), Math.round(mx - mr - 1), Math.round(my - mr - 1));
    // el castillo, recortado contra la luna
    q.fillStyle = "#0c0610"; const bx = W * 0.5, by = H * 0.62;
    q.beginPath(); q.moveTo(0, by + 30); q.quadraticCurveTo(W * 0.3, by - 20, W * 0.55, by - 10); q.quadraticCurveTo(W * 0.8, by, W, by + 20); q.lineTo(W, H); q.lineTo(0, H); q.fill();
    for (const [x, w, h] of [[-40, 14, 70], [-24, 30, 44], [8, 12, 90], [22, 26, 52], [48, 10, 64]]) { q.fillRect(bx + x, by - h, w, h); for (let k = 0; k < w; k += 4) q.fillRect(bx + x + k, by - h - 3, 2, 3); }
    q.beginPath(); q.moveTo(bx + 6, by - 90); q.lineTo(bx + 14, by - 108); q.lineTo(bx + 22, by - 90); q.fill();
    q.fillStyle = "#ffcf60"; for (const [x, y] of [[12, -70], [30, -40], [-18, -30], [-34, -55], [52, -50]]) q.fillRect(bx + x, by + y, 2, 3);
    // el bosque abajo
    for (let i = 0; i < 16; i++) { const x = (i / 15) * W + (r() - 0.5) * 20, y = H * 0.8 + r() * 30, s = arbolSpr(i % 2); q.globalAlpha = 0.9; q.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height)); }
    q.globalAlpha = 1; q.fillStyle = "#08040a"; q.fillRect(0, H * 0.9, W, H * 0.1);
    return c;
  });
}
function dibujarFondoMenu(oscuro) {
  g.drawImage(fondoPortada(), 0, 0);
  for (const m of _murcis) { m.x += m.v / 60; if (m.x > W + 20) { m.x = -20; m.y = 40 + V.f() * 160; } m.f += 0.15; g.drawImage(enemigoSpr("murcielago", Math.floor(m.f) % 2, false), Math.round(m.x), Math.round(m.y + Math.sin(m.f) * 3)); }
  if (oscuro) { g.fillStyle = `rgba(4,2,10,${oscuro})`; g.fillRect(0, 0, W, H); }
}
/** El logo con su cinta de subtítulo; devuelve dónde termina. */
function titulo(y) {
  const fin = dibujarLogo(W / 2, y);
  const sub = IDIOMA === "es" ? "SOBREVIVÍ HASTA EL AMANECER" : "SURVIVE UNTIL DAWN", w = Math.round(anchoTexto(sub) + 26), yy = fin + 8;
  g.fillStyle = "rgba(10,2,6,0.78)"; g.fillRect(Math.round(W / 2 - w / 2), yy, w, 13);
  g.fillStyle = "#b8161e"; g.fillRect(Math.round(W / 2 - w / 2), yy, w, 1); g.fillRect(Math.round(W / 2 - w / 2), yy + 12, w, 1);
  g.fillStyle = "#ff6a5a"; g.fillRect(Math.round(W / 2 - w / 2) - 2, yy + 5, 3, 3); g.fillRect(Math.round(W / 2 + w / 2) - 1, yy + 5, 3, 3);
  texto(sub, W / 2, yy + 1, { grad: "#f4e4d8" });
  return yy + 13;
}
function oroArriba() {
  panel(W - 86, 4, 82, 18, "oscuro");
  g.drawImage(recogibleSpr("moneda"), W - 80, 9);
  texto(String(G.oro), W - 9, 6, { al: "der", grad: "amarillo" });
}

function pantallaPortada() {
  dibujarFondoMenu(0);
  const fin = titulo(Math.round(H * 0.09));
  if (Math.floor(performance.now() / 600) % 2) texto(L(matchMedia("(pointer: coarse)").matches ? TX.tocar : TX.tocarPC), W / 2, Math.max(fin + 40, Math.round(H * 0.5)), { escala: 1.3 });
  texto("v1.0", W - 4, H - 12, { al: "der", grad: "gris", sombra: 0 });
  if (IN.toques.length || EDGE.size) { IN.toques.length = 0; irA("menu"); sfx("elegir"); tocarTema("titulo"); }
}
function irA(p) { PANT = p; UI.pantallaFoco = null; MSJ = null; }

function pantallaMenu() {
  dibujarFondoMenu(0.25);
  const fin = titulo(26);
  oroArriba();
  uiEmpezar("menu");
  const bw = 150, x = W / 2 - bw / 2; let y = Math.max(fin + 22, Math.round(H * 0.42));
  boton(x, y, bw, 28, TX.empezar, () => irA("personajes"), { estilo: "rojo" }); y += 34;
  boton(x, y, bw, 26, TX.mejoras, () => irA("mejoras"), { estilo: "azul" }); y += 32;
  boton(x, y, bw, 26, TX.opciones, () => irA("opciones"), { estilo: "azul" }); y += 32;
  boton(x, y, bw, 26, IDIOMA === "es" ? "IDIOMA: ESPAÑOL" : "LANGUAGE: ENGLISH", () => cambiarIdioma(), { estilo: "oscuro" });
  parrafo(TX.creditos, W / 2, H - 30, W - 20, { al: "centro", grad: "gris" });
  uiProcesar(() => irA("portada"));
}

function pantallaPersonajes() {
  dibujarFondoMenu(0.6);
  oroArriba();
  texto(L(TX.elegirPj), 8, 6, { al: "izq", escala: 1.3 });
  uiEmpezar("personajes");
  const claves = Object.keys(PERSONAJES), cols = 4, cw = Math.floor((W - 12) / cols), ch = 46, y0 = 28;
  claves.forEach((k, i) => {
    const x = 6 + (i % cols) * cw, y = y0 + Math.floor(i / cols) * (ch + 3), tiene = !!G.personajes[k], sel = SEL.pj === k;
    boton(x, y, cw - 3, ch, "", () => { SEL.pj = k; sfx("mover"); }, { estilo: sel ? "rojo" : "tarjeta" });
    const s = cazadorSpr(k, Math.floor(performance.now() / 300) % 2 * (sel ? 1 : 0), false);
    if (tiene) g.drawImage(s, Math.round(x + (cw - 3) / 2 - s.width), y + 3, s.width * 2, s.height * 2 > ch - 6 ? ch - 6 : s.height * 2);
    else { g.globalAlpha = 0.9; g.drawImage(negro(s), Math.round(x + (cw - 3) / 2 - s.width), y + 3, s.width * 2, Math.min(ch - 6, s.height * 2)); g.globalAlpha = 1; texto(String(precioPersonaje(k)), x + (cw - 3) / 2, y + ch - 14, { grad: "amarillo" }); }
    if (tiene) g.drawImage(iconoSpr(PERSONAJES[k].arma), x + cw - 18, y + ch - 16);
  });
  // la ficha del elegido
  const P = PERSONAJES[SEL.pj], tiene = !!G.personajes[SEL.pj], fy = y0 + Math.ceil(claves.length / cols) * (ch + 3) + 4, fh = 92;
  panel(6, fy, W - 12, fh, "oscuro");
  texto(`${P.n} ${P.ap}`, 14, fy + 6, { al: "izq", grad: "oro" });
  marcoIcono(14, fy + 22, P.arma); texto(nombreDe(P.arma), 32, fy + 23, { al: "izq" });
  parrafo(P.bonus, 14, fy + 42, W - 32, { grad: "azul" });
  const rec = G.record[`${SEL.esc}|${SEL.pj}`];
  if (rec) texto(`${L(TX.record)}: ${reloj(rec.t)} · LV ${rec.nivel}`, W - 14, fy + fh - 15, { al: "der", grad: "gris" });
  const by = fy + fh + 6;
  boton(6, by, 80, 26, TX.volver, () => irA("menu"), { estilo: "gris" });
  if (tiene) boton(W - 146, by, 140, 26, IDIOMA === "es" ? "ELEGIR" : "SELECT", () => irA("escenarios"), { estilo: "rojo" });
  else { const pr = precioPersonaje(SEL.pj); boton(W - 146, by, 140, 26, `${L(TX.comprar)} ${pr}`, () => { if (G.oro >= pr) { G.oro -= pr; G.personajes[SEL.pj] = 1; guardar(); sfx("moneda"); } else { sfx("no"); MSJ = { txt: TX.sinDinero, t: 90 }; } }, { apagado: G.oro < pr, estilo: "verde" }); }
  mensaje(by + 34);
  uiProcesar(() => irA("menu"));
}
const _negros = new WeakMap();
function negro(c) { let b = _negros.get(c); if (b) return b; b = lienzoNuevo(c.width, c.height); const q = b.getContext("2d"); q.drawImage(c, 0, 0); q.globalCompositeOperation = "source-in"; q.fillStyle = "#08060c"; q.fillRect(0, 0, b.width, b.height); _negros.set(c, b); return b; }
function mensaje(y) { if (MSJ && MSJ.t-- > 0) texto(L(MSJ.txt), W / 2, y, { grad: "rojo" }); }

function escenarioAbierto(k) { const E = ESCENARIOS[k]; return !E.abre || (G.record[`${E.abre[0]}|t`] || 0) >= E.abre[1]; }
function pantallaEscenarios() {
  dibujarFondoMenu(0.6);
  oroArriba();
  texto(L(TX.elegirEsc), 8, 6, { al: "izq", escala: 1.3 });
  uiEmpezar("escenarios");
  let y = 30;
  for (const [k, E] of Object.entries(ESCENARIOS)) {
    const ab = escenarioAbierto(k), sel = SEL.esc === k, h = 96;
    boton(6, y, W - 12, h, "", () => { if (ab) { SEL.esc = k; sfx("mover"); } else sfx("no"); }, { estilo: sel ? "rojo" : "tarjeta" });
    // una ventanita del escenario
    const vx = 14, vy = y + 8, vw = 72, vh = h - 16;
    g.save(); g.beginPath(); g.rect(vx, vy, vw, vh); g.clip();
    for (let yy = 0; yy < vh; yy += BAL) for (let xx = 0; xx < vw; xx += BAL) g.drawImage(baldosaSpr(E.suelo, (xx + yy) / BAL % 6), vx + xx, vy + yy);
    g.drawImage(E.suelo === "pasto" ? arbolSpr(0) : lapidaSpr(0), vx + 30, vy + 20);
    g.drawImage(enemigoSpr(E.suelo === "pasto" ? "zombi" : "esqueleto", 0, true), vx + 6, vy + 44);
    if (!ab) { g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(vx, vy, vw, vh); }
    g.restore();
    texto(L(E.n), vx + vw + 8, y + 10, { al: "izq", grad: ab ? "oro" : "gris" });
    parrafo(ab ? E.d : TX.bloqueado, vx + vw + 8, y + 26, W - vx - vw - 30, { grad: "azul" });
    if (!ab) parrafo(E.d, vx + vw + 8, y + 40, W - vx - vw - 30, { grad: "gris" });
    y += h + 6;
  }
  const d = G.op.duracion || 30;
  boton(6, y, W - 12, 22, `${L(TX.duracion)}: ${d} min`, () => { G.op.duracion = d === 30 ? 15 : 30; guardar(); }, { estilo: "oscuro" }); y += 28;
  boton(6, y, 80, 26, TX.volver, () => irA("personajes"), { estilo: "gris" });
  boton(W - 146, y, 140, 26, TX.jugar, () => empezarPartida(), { estilo: "rojo" });
  uiProcesar(() => irA("personajes"));
}
function empezarPartida() {
  nuevaPartida(SEL.pj, SEL.esc);
  PANT = "juego"; UI.pantallaFoco = null;
  tocarTema(J.E.tema);
}

function pantallaMejoras() {
  dibujarFondoMenu(0.65);
  oroArriba();
  texto(L(TX.mejoras), 8, 6, { al: "izq", escala: 1.3 });
  uiEmpezar("mejoras");
  const cols = 5, cw = Math.floor((W - 12) / cols), ch = 40, y0 = 28;
  MEJORAS.forEach((m, i) => {
    const x = 6 + (i % cols) * cw, y = y0 + Math.floor(i / cols) * (ch + 3), rango = G.mejoras[m[0]] || 0, sel = SEL.mejora === i;
    boton(x, y, cw - 3, ch, "", () => { SEL.mejora = i; sfx("mover"); }, { estilo: sel ? "rojo" : rango >= m[3] ? "verde" : "tarjeta" });
    g.drawImage(iconoSpr(m[6]), Math.round(x + (cw - 3) / 2 - 14), y + 4, 28, 28);
    for (let r = 0; r < m[3]; r++) { g.fillStyle = r < rango ? "#ffe070" : "#1a1a30"; g.fillRect(Math.round(x + (cw - 3) / 2 - m[3] * 2.5 + r * 5), y + ch - 6, 4, 3); }
  });
  const m = MEJORAS[SEL.mejora], rango = G.mejoras[m[0]] || 0, fy = y0 + Math.ceil(MEJORAS.length / cols) * (ch + 3) + 4, fh = 64;
  panel(6, fy, W - 12, fh, "oscuro");
  texto(L(m[1]), 14, fy + 6, { al: "izq", grad: "oro" });
  texto(`${rango}/${m[3]}`, W - 14, fy + 6, { al: "der", grad: rango >= m[3] ? "amarillo" : "blanco" });
  parrafo(m[5], 14, fy + 22, W - 30, { grad: "azul" });
  const by = fy + fh + 6, pr = precioMejora(m[0]), lleno = rango >= m[3];
  boton(6, by, 70, 26, TX.volver, () => irA("menu"), { estilo: "gris" });
  boton(80, by, 76, 26, TX.devolver, () => { G.oro += G.gastado || 0; G.gastado = 0; G.mejoras = {}; guardar(); sfx("moneda"); }, { estilo: "oscuro", apagado: !G.gastado });
  boton(160, by, W - 166, 26, lleno ? TX.max : `${L(TX.comprar)} ${pr}`, () => {
    if (G.oro >= pr) { G.oro -= pr; G.gastado = (G.gastado || 0) + pr; G.mejoras[m[0]] = rango + 1; guardar(); sfx("elegir"); } else { sfx("no"); MSJ = { txt: TX.sinDinero, t: 90 }; }
  }, { estilo: "verde", apagado: lleno || G.oro < pr });
  mensaje(by + 34);
  uiProcesar(() => irA("menu"));
}

function pantallaOpciones() {
  dibujarFondoMenu(0.65);
  texto(L(TX.opciones), W / 2, 12, { escala: 2 });
  uiEmpezar("opciones");
  const bw = W - 40, x = 20; let y = 50;
  const vol = (k) => { G.op[k] = G.op[k] >= 1 ? 0 : Math.round((G.op[k] + 0.2) * 10) / 10; volumenes(); guardar(); if (k === "efectos") sfx("gema"); };
  const si = (v) => L(v ? TX.si : TX.no);
  boton(x, y, bw, 24, `${L(TX.musica)}: ${Math.round(G.op.musica * 100)}%`, () => vol("musica")); y += 30;
  boton(x, y, bw, 24, `${L(TX.efectos)}: ${Math.round(G.op.efectos * 100)}%`, () => vol("efectos")); y += 30;
  boton(x, y, bw, 24, `${L(TX.numeros)}: ${si(G.op.numeros)}`, () => { G.op.numeros = G.op.numeros ? 0 : 1; guardar(); }); y += 30;
  boton(x, y, bw, 24, `${L(TX.destellos)}: ${si(G.op.destellos)}`, () => { G.op.destellos = G.op.destellos ? 0 : 1; guardar(); }); y += 30;
  boton(x, y, bw, 24, IDIOMA === "es" ? "Idioma: Español" : "Language: English", () => cambiarIdioma()); y += 30;
  boton(x, y, bw, 24, `${L(TX.duracion)}: ${G.op.duracion || 30} min`, () => { G.op.duracion = (G.op.duracion || 30) === 30 ? 15 : 30; guardar(); }); y += 30;
  boton(x, y, bw, 24, TX.completa, () => { _completaPendiente = true; }); y += 38;
  boton(x, y, bw, 26, TX.volver, () => irA("menu"), { estilo: "gris" });
  uiProcesar(() => irA("menu"));
}

function pantallaResultados() {
  dibujarFondoMenu(0.72);
  const R = RES, x0 = 6, w = W - 12;
  texto(L(R.ganaste ? TX.sobreviviste : TX.moriste), W / 2, 8, { escala: 2, grad: R.ganaste ? "oro" : "rojo" });
  let y = 36;
  panel(x0, y, w, 96, "oscuro");
  // el cazador en su cajita, y los datos a la derecha (sin taparse)
  const s = cazadorSpr(R.pj, 0, false);
  g.fillStyle = "#101018"; g.fillRect(x0 + 7, y + 20, 48, 68); g.drawImage(s, x0 + 9, y + 22, s.width * 2, s.height * 2);
  texto(`${PERSONAJES[R.pj].n} · ${L(ESCENARIOS[R.esc].n)}`, x0 + 8, y + 5, { al: "izq", grad: "oro" });
  const filas = [[TX.tiempo, reloj(R.t)], [TX.oroGanado, String(R.oro)], [TX.nivelAlc, String(R.nivel)], [TX.muertos, String(R.kills)]];
  filas.forEach(([k, v], i) => { texto(L(k), x0 + 62, y + 22 + i * 16, { al: "izq", grad: "gris" }); texto(v, x0 + w - 8, y + 22 + i * 16, { al: "der", grad: i === 1 ? "amarillo" : "blanco" }); });
  y += 102;
  // la tabla de daño por arma (el mayor daño y el mayor DPS, en amarillo, como el original)
  const filasA = R.armas, mayorD = Math.max(1, ...filasA.map((a) => a.dano)), mayorP = Math.max(0.01, ...filasA.map((a) => a.dano / Math.max(1, a.tiempo)));
  const th = 22 + filasA.length * 18;
  panel(x0, y, w, th, "oscuro");
  texto(L(TX.arma), x0 + 8, y + 5, { al: "izq", grad: "gris" }); texto(L(TX.dano), x0 + 128, y + 5, { al: "der", grad: "gris" }); texto(L(TX.tiempoArma), x0 + 176, y + 5, { al: "der", grad: "gris" }); texto(L(TX.dps), x0 + w - 8, y + 5, { al: "der", grad: "gris" });
  filasA.forEach((a, i) => {
    const yy = y + 20 + i * 18, dps = a.dano / Math.max(1, a.tiempo);
    marcoIcono(x0 + 8, yy, a.k, a.nivel, a.nivel >= maxNivel(a.k));
    texto(esEvo(a.k) ? "" : String(a.nivel), x0 + 26, yy + 2, { al: "izq", grad: "blanco" });
    texto(corto(a.dano), x0 + 128, yy + 2, { al: "der", grad: a.dano === mayorD ? "amarillo" : "blanco" });
    texto(reloj(a.tiempo), x0 + 176, yy + 2, { al: "der" });
    texto(dps.toFixed(1), x0 + w - 8, yy + 2, { al: "der", grad: Math.abs(dps - mayorP) < 1e-6 ? "amarillo" : "blanco" });
  });
  y += th + 6;
  if (R.abre) { texto(IDIOMA === "es" ? "¡Se abrió el Cementerio Olvidado!" : "Forgotten Graveyard unlocked!", W / 2, y, { grad: "verde" }); y += 14; }
  uiEmpezar("resultados");
  boton(W / 2 - 60, Math.min(H - 32, y + 4), 120, 26, TX.listo, () => irA("menu"), { estilo: "azul" });
  uiProcesar(() => irA("menu"));
}
