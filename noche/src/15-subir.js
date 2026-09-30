// ─────────────────────────────────────────────────────────────────────────────
// SUBIR DE NIVEL Y ABRIR COFRES. Al subir: 3 opciones (4 con suerte: 1 − 1/suerte), entre armas y
// pasivos que no estén al máximo, con hasta 6 armas y 6 pasivos; lo que ya tenés sale más seguido.
// Si no queda nada: oro o pollo. Los cofres de los jefes dan 1, 3 o 5 cosas (tabla del jefe × suerte)
// y evolucionan lo que esté listo (arma en 8 + su pasivo), con su lluvia de oro y su música.
// ─────────────────────────────────────────────────────────────────────────────

function textoNivel(k, nivel) {
  if (PASIVOS[k]) return L(PASIVOS[k].d);
  if (nivel === 1) return L(ARMAS[k].d);
  const d = ARMAS[k].nv[nivel - 2], p = [];
  const pct = (v) => Math.round(v * 100) + "%";
  for (const [c, v] of Object.entries(d)) {
    if (c === "cant") p.push(IDIOMA === "es" ? (v > 1 ? `Dispara ${v} más.` : "Dispara uno más.") : `Fires ${v} more projectile${v > 1 ? "s" : ""}.`);
    if (c === "dano") p.push(IDIOMA === "es" ? `Daño base +${v}.` : `Base Damage up by ${v}.`);
    if (c === "area") p.push(IDIOMA === "es" ? `Área +${pct(v)}.` : `Base Area up by ${pct(v)}.`);
    if (c === "cd") p.push(IDIOMA === "es" ? `Recarga −${-v} s.` : `Cooldown reduced by ${-v} s.`);
    if (c === "perf") p.push(IDIOMA === "es" ? `Atraviesa ${v} enemigo más.` : `Passes through ${v} more enem${v > 1 ? "ies" : "y"}.`);
    if (c === "vel") p.push(IDIOMA === "es" ? `Velocidad +${pct(v)}.` : `Base Speed up by ${pct(v)}.`);
    if (c === "dur") p.push(IDIOMA === "es" ? `Dura ${v} s más.` : `Effect lasts ${v} s longer.`);
    if (c === "int") p.push(IDIOMA === "es" ? "Tira más seguido." : "Shorter delay between shots.");
  }
  return p.join(" ");
}
const tieneArmaBase = (k) => J.armas.some((a) => a.k === k || (EVOS[a.k] && EVOS[a.k].de === k));

function generarOpciones() {
  const pool = [], nArmas = J.armas.length, nPas = J.pasivos.length;
  for (const k of Object.keys(ARMAS)) {
    if (J.desterrados.has(k)) continue;
    const a = J.armas.find((x) => x.k === k);
    if (a && a.nivel < 8) pool.push({ k, tipo: "arma", nivel: a.nivel + 1, peso: 200 });
    else if (!tieneArmaBase(k) && nArmas < 6) pool.push({ k, tipo: "arma", nivel: 1, peso: 100 });
  }
  for (const [k, d] of Object.entries(PASIVOS)) {
    if (J.desterrados.has(k)) continue;
    const p = J.pasivos.find((x) => x.k === k), r = d.rareza || 100;
    if (p && p.nivel < d.max) pool.push({ k, tipo: "pasivo", nivel: p.nivel + 1, peso: r * 2 });
    else if (!p && nPas < 6) pool.push({ k, tipo: "pasivo", nivel: 1, peso: r });
  }
  const n = 3 + (A.si(1 - 1 / J.st.suerte) ? 1 : 0), ops = [];
  while (ops.length < n && pool.length) {
    let s = 0; for (const o of pool) s += o.peso;
    let r = A.f() * s, i = 0;
    for (; i < pool.length - 1; i++) if ((r -= pool[i].peso) < 0) break;
    ops.push(pool.splice(i, 1)[0]);
  }
  if (!ops.length) return [{ k: "oro", tipo: "oro" }, { k: "pollo", tipo: "pollo" }];
  return ops;
}
function abrirModalNivel() {
  J.modal = { tipo: "nivel", ops: generarOpciones(), desterrar: false, t: 0 };
  UI.pantallaFoco = null;
  sfx("subir", 0.8);
}
function elegirOpcion(op) {
  const m = J.modal;
  if (m.desterrar) {
    // desterrar: esa cosa no vuelve a salir en toda la partida
    J.desterrados.add(op.k); J.destierros--; m.desterrar = false;
    m.ops = m.ops.filter((o) => o !== op); if (!m.ops.length) m.ops = generarOpciones();
    sfx("no", 0.8); return;
  }
  if (op.tipo === "arma") darArma(op.k);
  else if (op.tipo === "pasivo") darPasivo(op.k);
  else if (op.tipo === "oro") ganarOro(25);
  else if (op.tipo === "pollo") curar(30);
  recalcular();
  sfx("elegir", 0.8);
  siguienteModal();
}
function siguienteModal() {
  J.pendientes = Math.max(0, J.pendientes - 1);
  if (J.pendientes > 0) abrirModalNivel();
  else { J.modal = null; J.jug.inv = Math.max(J.jug.inv, 0.6); }
}

// ── los cofres ──
function abrirModalCofre(c) {
  J.modal = { tipo: "cofre", fase: "cerrado", t: 0, c, items: [], oro: 0 };
  UI.pantallaFoco = null;
  sfx("cofre");
}
function resolverCofre(m) {
  const odds = COFRES_JEFE[m.c.jefe] || [0, 5, 40], s = J.st.suerte;
  // los primeros cofres de la partida siguen una secuencia fija (1-1-3-1-1-5), como el original la da en la partida guardada
  const fijo = [1, 1, 3, 1, 1, 5][J.cofres];
  let n = fijo || (A.si(odds[0] * s / 100) ? 5 : A.si(odds[1] * s / 100) ? 3 : 1);
  J.cofres++;
  const items = [];
  for (let i = 0; i < n; i++) {
    const evos = m.c.evo ? evolucionesPosibles() : [];
    if (evos.length) { const k = evos[0]; evolucionar(k); items.push({ k, evo: true }); continue; }
    const cands = [...J.armas.filter((a) => ARMAS[a.k] && a.nivel < 8).map((a) => ({ k: a.k, t: "a" })), ...J.pasivos.filter((p) => p.nivel < PASIVOS[p.k].max).map((p) => ({ k: p.k, t: "p" }))];
    if (!cands.length) { items.push({ k: "oro", bolsa: true }); J.oro += Math.round(25 * J.st.codicia); continue; }
    const c = A.uno(cands);
    if (c.t === "a") darArma(c.k); else darPasivo(c.k);
    items.push({ k: c.k, nivel: (J.armas.find((a) => a.k === c.k) || J.pasivos.find((p) => p.k === c.k)).nivel });
  }
  recalcular();
  const [lo, hi] = n === 5 ? [500, 1000] : n === 3 ? [300, 600] : [100, 200];
  m.oro = Math.round((lo + A.f() * (hi - lo)) * J.st.codicia); J.oro += m.oro;
  m.items = items; m.n = n;
  if (items.some((it) => it.evo)) sfx("evolucion", 0.8);
}
function pasoModal(dt) {
  const m = J.modal; m.t += dt;
  if (m.tipo === "cofre" && m.fase === "abriendo" && m.t > 1.2 + m.items.length * 0.45) { m.fase = "listo"; UI.pantallaFoco = null; }
}

// ── dibujo ──
function dibujarModalNivel() {
  const m = J.modal;
  g.fillStyle = "rgba(4,4,16,0.72)"; g.fillRect(0, 0, W, H);
  const n = m.ops.length, alto = 48, sep = 4, bot = (J.rerolls || J.saltos || J.destierros) ? 26 : 0;
  const total = 50 + n * (alto + sep) + bot + 6, x0 = 6, w = W - 12, y0 = Math.max(24, Math.round((H - total) / 2));
  panel(x0, y0, w, total, "oscuro");
  texto(L(TX.subiste), W / 2, y0 + 6, { grad: "oro", escala: 1 });
  // lo que ya tenés, en chiquito (para decidir mirando el armado)
  let ix = x0 + 8;
  for (const a of J.armas) { marcoIcono(ix, y0 + 20, a.k, a.nivel, a.nivel >= maxNivel(a.k)); ix += 15; }
  ix = x0 + 8 + 6 * 15 + 6;
  for (const p of J.pasivos) { if (ix > x0 + w - 20) break; marcoIcono(ix, y0 + 20, p.k, p.nivel, p.nivel >= maxNivel(p.k)); ix += 15; }
  uiEmpezar("nivel" + J.nivel + (m.desterrar ? "d" : "") + m.ops.length);
  let y = y0 + 40;
  for (const op of m.ops) {
    const f = boton(x0 + 6, y, w - 12, alto, "", () => elegirOpcion(op), { estilo: m.desterrar ? "rojo" : "tarjeta" });
    const ik = op.tipo === "oro" ? "oro" : op.tipo === "pollo" ? "pollo" : op.k;
    g.fillStyle = "#06081a"; g.fillRect(x0 + 12, y + 9, 30, 30);
    g.fillStyle = f ? "#ffe070" : "#5a78d8"; g.fillRect(x0 + 12, y + 9, 30, 1); g.fillRect(x0 + 12, y + 38, 30, 1); g.fillRect(x0 + 12, y + 9, 1, 30); g.fillRect(x0 + 41, y + 9, 1, 30);
    g.drawImage(iconoSpr(ik), x0 + 13, y + 10, 28, 28);
    const nombre = op.tipo === "oro" ? L(TX.oroPollo) : op.tipo === "pollo" ? L(TX.polloOp) : nombreDe(op.k);
    texto(nombre, x0 + 48, y + 5, { al: "izq", grad: "blanco" });
    if (op.tipo === "arma" || op.tipo === "pasivo") {
      if (op.nivel === 1) texto(L(TX.nuevo), x0 + w - 12, y + 5, { al: "der", grad: "amarillo" });
      else texto(`${L(TX.nivel)} ${op.nivel}`, x0 + w - 12, y + 5, { al: "der", grad: "gris" });
    }
    const desc = op.tipo === "oro" ? L(TX.oroOp) : op.tipo === "pollo" ? L(TX.curarOp) : textoNivel(op.k, op.nivel);
    renglones(desc, w - 64).slice(0, 3).forEach((r, i) => texto(r, x0 + 48, y + 18 + i * 9, { al: "izq", grad: "azul", sombra: 0 }));
    y += alto + sep;
  }
  if (bot) {
    const bw = Math.floor((w - 20) / 3);
    if (J.rerolls) boton(x0 + 6, y + 2, bw, 20, `${L(TX.reroll)} ${J.rerolls}`, () => { J.rerolls--; m.ops = generarOpciones(); sfx("mover"); }, { estilo: "verde" });
    if (J.saltos) boton(x0 + 10 + bw, y + 2, bw, 20, `${L(TX.saltar)} ${J.saltos}`, () => { J.saltos--; siguienteModal(); }, { estilo: "azul" });
    if (J.destierros) boton(x0 + 14 + bw * 2, y + 2, bw, 20, `${L(TX.desterrar)} ${J.destierros}`, () => { m.desterrar = !m.desterrar; }, { estilo: "rojo" });
  }
  uiProcesar(null);
}
function dibujarModalCofre() {
  const m = J.modal, cxx = W / 2, cyy = Math.round(H * 0.4);
  g.fillStyle = "rgba(4,2,12,0.8)"; g.fillRect(0, 0, W, H);
  texto(L(TX.cofre), W / 2, cyy - 110, { grad: "oro" });
  const abierto = m.fase !== "cerrado", tt = m.fase === "abriendo" ? m.t : m.fase === "listo" ? 9 : 0;
  if (abierto) {
    // los rayos de colores que giran detrás del cofre abierto
    const n = 14, rot = performance.now() / 1400;
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU, col = `hsla(${(i * 360 / n + performance.now() / 20) % 360},90%,65%,${Math.min(0.5, tt * 0.4)})`;
      g.fillStyle = col; g.beginPath(); g.moveTo(cxx, cyy); g.lineTo(cxx + Math.cos(a - 0.1) * 160, cyy + Math.sin(a - 0.1) * 160); g.lineTo(cxx + Math.cos(a + 0.1) * 160, cyy + Math.sin(a + 0.1) * 160); g.fill();
    }
    // monedas que saltan
    if (m.fase === "abriendo" && J.cuadro % 2 === 0) J.efectos.push({ tipo: "monedaMenu", x: cxx + (V.f() - 0.5) * 20, y: cyy, vx: (V.f() - 0.5) * 140, vy: -120 - V.f() * 120, t: 1, t0: 1 });
  }
  // (el juego está en pausa: las monedas del cofre se mueven acá, al dibujar)
  J.efectos = J.efectos.filter((f) => f.tipo !== "monedaMenu" || (f.t -= 1 / 60) > 0);
  for (const f of J.efectos) if (f.tipo === "monedaMenu") { f.vy += 300 / 60; f.x += f.vx / 60; f.y += f.vy / 60; g.drawImage(recogibleSpr("moneda"), Math.round(f.x), Math.round(f.y)); }
  const sc = 4, cs = cofreSpr(abierto);
  g.drawImage(cs, Math.round(cxx - cs.width * sc / 2), Math.round(cyy - cs.height * sc / 2 + 10), cs.width * sc, cs.height * sc);
  uiEmpezar("cofre" + m.fase);
  if (m.fase === "cerrado") {
    boton(W / 2 - 50, cyy + 60, 100, 26, TX.abrir, () => { m.fase = "abriendo"; m.t = 0; resolverCofre(m); AU.despues = AU.tema; tocarTema("tesoro", { bucle: false }); }, { estilo: "rojo" });
  } else {
    // las cosas salen del cofre una por una, en fila
    const vis = m.fase === "listo" ? m.items.length : Math.floor(Math.max(0, m.t - 0.8) / 0.45);
    const y0 = cyy + 50, ancho = Math.min(W - 16, 196);
    m.items.slice(0, vis).forEach((it, i) => {
      const y = y0 + i * 22;
      panel(W / 2 - ancho / 2, y, ancho, 20, it.evo ? "rojo" : "tarjeta");
      g.drawImage(iconoSpr(it.k), W / 2 - ancho / 2 + 4, y + 3);
      const nom = it.bolsa ? `+${Math.round(25 * J.st.codicia)} ${L(TX.oro)}` : nombreDe(it.k);
      texto(nom, W / 2 - ancho / 2 + 22, y + 3, { al: "izq", grad: it.evo ? "oro" : "blanco" });
      if (it.evo) texto(L(TX.evolucion), W / 2 + ancho / 2 - 5, y + 3, { al: "der", grad: "amarillo" });
      else if (it.nivel) texto(`${L(TX.nivel)} ${it.nivel}`, W / 2 + ancho / 2 - 5, y + 3, { al: "der", grad: "gris" });
    });
    const oroV = m.fase === "listo" ? m.oro : Math.round(m.oro * Math.min(1, m.t / (1 + m.items.length * 0.45)));
    texto(`+${oroV}`, W / 2 + 6, cyy - 90, { grad: "amarillo" });
    g.drawImage(recogibleSpr("moneda"), W / 2 - anchoTexto(`+${oroV}`) / 2 - 8, cyy - 88);
    if (m.fase === "listo") boton(W / 2 - 50, Math.min(H - 34, y0 + m.items.length * 22 + 8), 100, 26, TX.listo, () => { J.modal = null; J.efectos = J.efectos.filter((f) => f.tipo !== "monedaMenu"); if (J.pendientes > 0) abrirModalNivel(); }, { estilo: "azul" });
    else if (IN.toques.length) { m.fase = "listo"; IN.toques.length = 0; }
  }
  uiProcesar(null);
}
