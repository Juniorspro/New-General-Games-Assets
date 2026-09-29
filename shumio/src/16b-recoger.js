// ─────────────────────────────────────────────────────────────────────────────
// LO QUE SE RECOGE: corazones rojos y de espora, monedas de 1 y de 5, bombas, llaves, cápsulas
// (el efecto de cada color se sortea por partida), baratijas, los pedestales y los cofres del
// original con sus tablas (wiki, Repentance): el común (78 % premios, 10 % baratija, 10 %
// cápsula…), el dorado (con llave, 20 % objeto), el de piedra (se abre con una explosión y da lo
// del dorado), el de pinchos (lastima medio corazón al abrirlo) y el rojo (del pacto: un objeto
// del diablo, arañas, bombas trampa, moscas azules, corazones de espora o cápsulas).
// ─────────────────────────────────────────────────────────────────────────────

// ── los recogibles ──
function recogible(t, x, y, sub) {
  if (t === "corazon" && !sub) sub = A.pesos([["rojo", 6], ["medio", 3], ["espora", 1]]);
  if (t === "moneda" && !sub) sub = A.si(0.1) ? 5 : 1;
  if (t === "capsula" && sub == null) sub = A.ent(0, COLORES_CAPSULA.length - 1);
  if (t === "cofre" && !sub) { const n = J.piso ? J.piso.n : 1; sub = A.pesos([["normal", 62], ["dorado", n >= 2 ? 22 : 14], ["piedra", 7], ["pinchos", 7], ["rojo", n >= 2 ? 5 : 2]]); }
  if (t === "baratija" && !sub) sub = sacarBaratija();
  return { t, sub, x, y, vx: 0, vy: 0, z: 0, vz: 0, r: 5, k: V.ent(0, 40) };
}
function pedestal(x, y, id) { return { t: "objeto", id, x, y, vx: 0, vy: 0, z: 0, vz: 0, r: 8, quieto: true, k: V.ent(0, 90) }; }

/** Tira algo al piso con un saltito. tipo: null (al azar), "espora" (corazón de espora), o un tipo. */
function soltarPremio(x, y, tipo) {
  let sub;
  if (tipo === "espora") { tipo = "corazon"; sub = "espora"; }
  if (!tipo) tipo = A.pesos([["moneda", 45], ["corazon", 25], ["bomba", 12], ["llave", 12], ["capsula", 6], ["baratija", 1]]);
  const c = recogible(tipo, x, y, sub);
  const a = V.f() * TAU; c.vx = Math.cos(a) * 1.4; c.vy = Math.sin(a) * 1.1; c.vz = 2.4; c.z = 2;
  J.sala.cosas.push(c);
  return c;
}

/** El premio de limpiar una sala (como en el original: la suerte ayuda). */
function premioSala() {
  const j = J.jug, n = A.f() + j.suerte * 0.03 + (j.f.dedoSuerte ? 0.1 : 0);
  if (j.f.tenedor && A.si(0.1 + j.suerte * 0.02)) { curar(j, 1); SFX.corazon(); }
  if (J.familiares.some((m) => m.tipo === "bolsa") && (J.salasLimpias = (J.salasLimpias || 0) + 1) % 2 === 0) { const m = J.familiares.find((q) => q.tipo === "bolsa"); soltarPremio(m.x, m.y, "moneda"); }
  if (n < 0.36) return;
  const tipo = A.pesos([["moneda", 30], ["corazon", 18], ["llave", 14], ["bomba", 14], ["cofre", j.f.colaGato ? 16 : 8], ["capsula", 8], ["baratija", 2]]);
  const [x, y] = lugarLibreCerca(cx(6), cy(3));
  const c = recogible(tipo, x, y);
  c.vz = 2; J.sala.cosas.push(c);
  if (tipo === "moneda" && A.si(0.25)) soltarPremio(x, y, "moneda");
}

function actualizarCosas() {
  const j = J.jug, C = J.sala.cosas;
  for (let i = C.length - 1; i >= 0; i--) {
    const c = C[i];
    c.k++;
    if (!c.quieto) {
      c.z += c.vz; c.vz -= 0.25;
      if (c.z <= 0) { c.z = 0; c.vz = Math.abs(c.vz) > 0.8 ? -c.vz * 0.35 : 0; }
      if (j.iman && !c.precio && ["moneda", "corazon", "bomba", "llave"].includes(c.t)) { const d = dist(j.x, j.y, c.x, c.y) || 1; if (d < 90) { c.vx += (j.x - c.x) / d * 0.18; c.vy += (j.y - c.y) / d * 0.18; } }
      c.vx *= 0.9; c.vy *= 0.9;
      moverEnSala(J.sala, c, c.vx, c.vy, false);
    }
    if (c.t === "trampilla") { if (!c.abierta && dist(j.x, j.y, c.x, c.y) > 20) c.abierta = true; if (c.abierta && dist(j.x, j.y, c.x, c.y) < 8 && !j.muerto && J.estado === "juego") bajarPiso(); continue; }
    if (j.muerto || c.z > 6) continue;
    const alcance = RADIO_SOLIDO[c.t] ? RADIO_SOLIDO[c.t] + j.r + 1.5 : 9;
    if (c.espera > 0) { c.espera--; continue; }       // lo que recién saltó de un cofre no se agarra al toque
    if (dist(j.x, j.y, c.x, c.y) > alcance) { c.tocando = false; c.avisado = false; continue; }
    if (tomar(c)) C.splice(i, 1);
  }
}

/** Shumio toca algo: ¿se lo lleva? (devuelve true si desaparece del piso) */
function tomar(c) {
  const j = J.jug;
  if (c.precio && c.t !== "objeto") {
    if (j.monedas < c.precio || !puedeUsar(c)) return false;
    j.monedas -= c.precio; SFX.moneda();
  }
  switch (c.t) {
    case "corazon": {
      if (c.sub === "espora" || c.sub === "esporaMedio") { if (!darEsporas(j, c.sub === "espora" ? 2 : 1)) return false; }
      else if (!curar(j, c.sub === "rojo" ? 2 : 1)) return false;
      SFX.corazon(); return true;
    }
    case "moneda": j.monedas = Math.min(99, j.monedas + (c.sub | 0)); SFX.moneda(); return true;
    case "bomba": j.bombas = Math.min(99, j.bombas + 1); SFX.recoger(); return true;
    case "llave": j.llaves = Math.min(99, j.llaves + 1); SFX.llave(); return true;
    case "capsula": {
      if (j.capsula != null) { const v = recogible("capsula", j.x, j.y + 10, j.capsula); v.vz = 2; v.vy = 1; J.sala.cosas.push(v); }
      j.capsula = c.sub; SFX.recoger(); return true;   // el nombre queda abajo a la derecha, como la píldora del original
    }
    case "cofre": {
      if (c.abierto) return false;
      if (c.sub === "piedra") { if (!c.avisado) { SFX.roca(); c.sacudida = 6; c.avisado = true; } return false; }   // sólo con una explosión
      if (c.sub === "dorado" && j.llaves <= 0 && !j.f.clip) {   // trabado: suena el candado y tiembla (una vez por toque)
        if (!c.avisado) { SFX.clic(); c.sacudida = 10; c.avisado = true; }
        return false;
      }
      if (c.sub === "dorado" && !j.f.clip) j.llaves--;
      abrirCofre(c);
      return false;
    }
    case "baratija": {
      if (j.baratija) { const v = recogible("baratija", j.x, j.y + 10, j.baratija); v.vz = 2; v.vy = 1; v.espera = 40; J.sala.cosas.push(v); }
      const antes = fotoCuentas(j);
      j.baratija = c.sub; recalcular(j); anotarCambios(antes);
      rotulo(BARATIJAS[c.sub].nombre, BARATIJAS[c.sub].lema); SFX.recoger(); return true;
    }
    case "cofreFinal": if (!c.abierto) { c.abierto = true; ganar(); } return false;
    case "objeto": return tomarObjeto(c);
  }
  return false;
}
/** Abre un cofre y tira lo de adentro hacia afuera, lejos de Shumio (tablas de la wiki). */
function abrirCofre(c) {
  const j = J.jug;
  c.abierto = true; c.quieto = true; SFX.llave(); SFX.recoger();
  if (c.sub === "pinchos") herirJugador(j, 1, "UN COFRE CON PINCHOS", cofreSpr("pinchos", false));
  const ang0 = Math.atan2(c.y - j.y, c.x - j.x);
  const tirar = (tipos) => tipos.forEach((t, i) => {
    const p = soltarPremio(c.x, c.y - 4, t), n = tipos.length, a = ang0 + (i - (n - 1) / 2) * 0.55 + (A.f() - 0.5) * 0.3, v = 1.6 + A.f() * 0.8;
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v * 0.8; p.vz = 3 + A.f(); p.espera = 26;
  });
  const tandas = () => { const out = []; const n = A.ent(2, 3) + (j.f.dedoSuerte && A.si(0.33) ? 1 : 0); for (let i = 0; i < n; i++) { const b = A.pesos([["moneda", 3], ["bomba", 1], ["llave", 1], ["corazon", 1]]); if (b === "moneda") for (let k = A.ent(1, 3); k > 0; k--) out.push("moneda"); else out.push(b); } return out; };
  if (c.sub === "rojo") {
    const r = A.pesos([["objeto", 10], ["aranas", 13], ["megaTrampa", 13], ["moscas", 7], ["aranitas", 7], ["espora1", 7.5], ["espora2", 7.5], ["trampas", 15], ["capsulas", 15], ["objeto2", 5]]);
    if (r === "objeto" || r === "objeto2") J.sala.cosas.push(pedestal(c.x, c.y - 18, sacarObjeto("rojo")));
    else if (r === "aranas") for (let i = 0; i < 2; i++) crearEnemigo("arana", c.x + (i ? 10 : -10), c.y);
    else if (r === "megaTrampa") J.bombas.push(Object.assign(nuevaBomba(j, c.x, c.y + 4, 0, 0, 60), { gorda: true, danoJug: 2 }));
    else if (r === "trampas") for (let i = 0; i < 2; i++) J.bombas.push(nuevaBomba(j, c.x + (i ? 10 : -10), c.y + 4, (i ? 1 : -1), 0.5, 60));
    else if (r === "moscas") for (let i = 0; i < 3; i++) J.familiares.push(moscaAzul(c.x, c.y));
    else if (r === "aranitas") for (let i = 0; i < 3; i++) J.familiares.push(moscaAzul(c.x, c.y, "arana"));
    else if (r === "espora1" || r === "espora2") tirar(r === "espora1" ? ["espora"] : ["espora", "espora"]);
    else tirar(["capsula", "capsula"]);
    return;
  }
  if ((c.sub === "dorado" || c.sub === "piedra") && A.si(0.2)) { J.sala.cosas.push(pedestal(c.x, c.y - 18, sacarObjeto("cofre"))); return; }
  const r = A.pesos([["premios", 78], ["baratija", 10], ["capsula", 10], ["cofre", 2]]);
  if (r === "premios") tirar(tandas());
  else if (r === "cofre") { const q = recogible("cofre", c.x, c.y + 14, A.si(0.5) ? "normal" : "dorado"); q.vz = 3; J.sala.cosas.push(q); }
  else tirar([r]);
}
function puedeUsar(c) {
  const j = J.jug;
  if (c.t === "corazon") return c.sub.startsWith("espora") ? j.esporas < 24 - j.cont : j.vida < j.cont;
  return true;
}

// ── dibujar lo que está en el piso ──
function dibujarCosa(g, c) {
  const X = Math.round(c.x), Y = Math.round(c.y), z = Math.round(c.z);
  let s = null;
  switch (c.t) {
    case "corazon": s = corazonSpr(c.sub); break;
    case "moneda": s = monedaSpr(Math.floor(c.k / 6) % 4, c.sub); break;
    case "bomba": s = bombaSpr(0.8); break;
    case "llave": s = llaveSpr(); break;
    case "capsula": s = capsulaSpr(c.sub); break;
    case "baratija": s = baratijaSpr(c.sub); break;
    case "cofre": s = cofreSpr(c.sub, !!c.abierto); if (c.sacudida > 0) { c.sacudida--; g.save(); g.translate(Math.round(Math.sin(c.sacudida * 2.2) * 1.5), 0); g.drawImage(sombra(8, 2), X - 8, Y); g.drawImage(s, X - Math.floor(s.width / 2), Y + 2 - s.height); g.restore(); return; } break;
    case "cofreFinal": { s = cofreSpr("dorado", !!c.abierto); const w = s.width * 2, h = s.height * 2; g.drawImage(sombra(16, 4), X - 16, Y - 2); g.drawImage(s, X - w / 2, Y + 2 - h, w, h); return; }
    case "trampilla": s = trampillaSpr(!!c.abierta); g.drawImage(s, X - 14, Y - 14); return;
    case "objeto": {
      g.drawImage(pedestalSpr(), X - 11, Y - 8);
      if (c.id) {
        const bob = Math.round(Math.sin(c.k * 0.07) * 2), ic = J.maldicion === "ciego" ? preguntaSpr() : iconoSpr(c.id);
        g.drawImage(sombra(5, 2), X - 5, Y - 12);
        g.drawImage(ic, X - 9, Y - 30 + bob);
      }
      dibujarPrecio(g, c, X, Y + 12);
      return;
    }
  }
  if (!s) return;
  g.drawImage(sombra(Math.max(3, (s.width >> 1) - 1), 2), X - Math.max(3, (s.width >> 1) - 1), Y);
  g.drawImage(s, X - Math.floor(s.width / 2), Y + 2 - s.height - z);
  if (c.precio) dibujarPrecio(g, c, X, Y + 6);
}
function dibujarPrecio(g, c, x, y) {
  if (c.precio && c.id !== null) {
    const n = cifrasSpr(c.precio), m = monedaChica();
    const w = n.width + m.width;
    g.drawImage(n, Math.round(x - w / 2), y); g.drawImage(m, Math.round(x - w / 2 + n.width), y);
  }
  if (c.pacto && c.id) {
    const h = corazonSpr("rojo", true), w = h.width * c.pacto;
    for (let i = 0; i < c.pacto; i++) g.drawImage(h, Math.round(x - w / 2 + i * h.width), y);
  }
}

/** El signo de pregunta rojo que tapa los objetos con la maldición del ciego (como en el video). */
function preguntaSpr() {
  return hornear("preguntaRoja", () => {
    const p = new Pix(18, 18), R = ["#5a0408", "#a8101a", "#e02632", "#ff6a70"];
    p.sello(4, 1, [".######.", "########", "###..###", "###..###", "....####", "...####.", "..####..", "..###...", "..###...", "........", "..###...", "..###..."].map((f) => f), { "#": R[2] });
    // el volumen: luz arriba a la izquierda, sombra abajo
    for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const c = p.g(x, y); if (!c) continue; if (!p.g(x - 1, y) || !p.g(x, y - 1)) p.p(x, y, R[3]); else if (!p.g(x + 1, y) || !p.g(x, y + 1)) p.p(x, y, R[1]); }
    p.contorno(PAL.tinta, true);
    return p.canvas();
  });
}
