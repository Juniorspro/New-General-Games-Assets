// ─────────────────────────────────────────────────────────────────────────────
// EL HUD, como en las capturas del original: arriba de todo la barra azul de experiencia con
// "LV" a la derecha; debajo, a la izquierda, las armas y los pasivos en cajitas; el reloj grande
// al centro; oro y enemigos vencidos a la derecha. La vida es una barrita roja bajo el cazador.
// ─────────────────────────────────────────────────────────────────────────────

function dibujarHUD() {
  // barra de experiencia
  const bh = 9;
  g.fillStyle = "#000"; g.fillRect(0, 0, W, bh + 1);
  g.fillStyle = "#0e1030"; g.fillRect(1, 1, W - 2, bh - 1);
  const k = lim(J.xp / J.xpSig, 0, 1), fw = Math.round((W - 2) * k);
  if (fw > 0) { g.fillStyle = "#2a58e8"; g.fillRect(1, 1, fw, bh - 1); g.fillStyle = "#7aa0ff"; g.fillRect(1, 1, fw, 2); g.fillStyle = "#1a3490"; g.fillRect(1, bh - 2, fw, 1); }
  texto(`LV ${J.nivel}`, W - 3, -1, { al: "der", grad: "blanco" });
  // armas y pasivos
  J.armas.forEach((a, i) => marcoIcono(2 + i * 15, bh + 3, a.k, a.nivel, a.nivel >= maxNivel(a.k)));
  J.pasivos.forEach((p, i) => marcoIcono(2 + i * 15, bh + 18, p.k, p.nivel, p.nivel >= maxNivel(p.k)));
  // el reloj
  texto(reloj(J.t), Math.round((94 + W - 48) / 2), bh + 3, { escala: 2, grad: J.t >= J.duracion ? "rojo" : "blanco" });
  // pausa, oro y enemigos
  uiEmpezar("hud");
  boton(W - 17, bh + 3, 15, 15, "", () => { J.pausa = true; UI.pantallaFoco = null; sfx("clic"); }, { estilo: "oscuro", sinFoco: true });
  g.fillStyle = "#f0f0f0"; g.fillRect(W - 12, bh + 7, 2, 7); g.fillRect(W - 8, bh + 7, 2, 7);
  texto(String(J.oro), W - 30, bh + 3, { al: "der", grad: "amarillo" });
  g.drawImage(recogibleSpr("moneda"), W - 28, bh + 5);
  texto(String(J.kills), W - 30, bh + 16, { al: "der" });
  g.drawImage(calaveraChica(), W - 28, bh + 17);
  if (!J.modal && !J.fin) uiProcesar(() => { J.pausa = true; UI.pantallaFoco = null; });
  // el cartel del centro (la parca, revivir)
  if (J.cartel && J.cartel.t > 0) {
    const a = Math.min(1, J.cartel.t * 2);
    g.globalAlpha = a * 0.7; g.fillStyle = "#000"; g.fillRect(0, 60, W, 22); g.globalAlpha = 1;
    texto(L(J.cartel.txt), W / 2, 65, { grad: J.cartel.rojo ? "rojo" : "oro", alfa: a });
  }
  // flechas hacia los cofres que no se ven
  for (const c of J.cosas) if (c.tipo === "cofre" && !enPantalla(c.x, c.y, -6)) flechaBorde(c.x, c.y, "#ffd040");
}
function calaveraChica() { return hornear("calChica", () => sello([".www.", "wewew", "wwwww", ".w.w."], PS, "#000000").canvas()); }
/** Una flechita en el borde de la pantalla apuntando a algo que está afuera. */
function flechaBorde(x, y, col) {
  const cx = J.cam.x + W / 2, cy = J.cam.y + H / 2, a = Math.atan2(y - cy, x - cx);
  const m = 10, px = lim(W / 2 + Math.cos(a) * W, m, W - m), py = lim(H / 2 + Math.sin(a) * H, 42, H - m);
  g.save(); g.translate(Math.round(px), Math.round(py)); g.rotate(a);
  g.fillStyle = "#000"; g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(4, 0); g.lineTo(-3, -3); g.lineTo(-3, 3); g.fill();
  g.restore();
}
/** El joystick: un aro donde apoyaste el dedo y la perilla adonde lo llevás. */
function dibujarPalo() {
  const pl = IN.palo; if (!pl || pl.mouse) return;
  g.globalAlpha = 0.35; g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.beginPath(); g.arc(pl.x0, pl.y0, RADIO_PALO, 0, TAU); g.stroke();
  g.globalAlpha = 0.5; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(pl.x, pl.y, 7, 0, TAU); g.fill(); g.globalAlpha = 1;
}

// ── la pausa: tu armado y tus números ──
function dibujarPausa() {
  g.fillStyle = "rgba(4,4,16,0.78)"; g.fillRect(0, 0, W, H);
  const x0 = 8, w = W - 16, y0 = 30, h = Math.min(H - 50, 400);
  panel(x0, y0, w, h, "oscuro");
  texto(L(TX.pausa), W / 2, y0 + 6, { grad: "oro", escala: 2 });
  let y = y0 + 34;
  texto(L(TX.armas), x0 + 8, y, { al: "izq", grad: "amarillo" }); y += 12;
  J.armas.forEach((a, i) => { marcoIcono(x0 + 8 + i * 34, y, a.k, a.nivel, a.nivel >= maxNivel(a.k)); texto(esEvo(a.k) ? "" : String(a.nivel), x0 + 25 + i * 34, y + 2, { al: "izq", grad: a.nivel >= maxNivel(a.k) ? "amarillo" : "blanco" }); });
  y += 18;
  texto(L(TX.pasivos), x0 + 8, y, { al: "izq", grad: "amarillo" }); y += 12;
  J.pasivos.forEach((p, i) => { marcoIcono(x0 + 8 + i * 34, y, p.k, p.nivel, p.nivel >= maxNivel(p.k)); texto(String(p.nivel), x0 + 25 + i * 34, y + 2, { al: "izq", grad: p.nivel >= maxNivel(p.k) ? "amarillo" : "blanco" }); });
  y += 20;
  texto(L(TX.stats), x0 + 8, y, { al: "izq", grad: "amarillo" }); y += 12;
  const st = J.st, pct = (v) => (v >= 1 ? "+" : "") + Math.round((v - 1) * 100) + "%";
  const filas = [["vidaMax", Math.round(st.vidaMax)], ["recup", st.recup.toFixed(1)], ["armadura", st.armadura], ["velMov", pct(st.velMov)], ["poder", pct(st.poder)], ["area", pct(st.area)], ["vel", pct(st.vel)], ["dur", pct(st.dur)],
    ["cant", st.cant], ["cd", pct(st.cd)], ["suerte", pct(st.suerte)], ["crec", pct(st.crec)], ["codicia", pct(st.codicia)], ["maldicion", pct(st.maldicion)], ["iman", Math.round(st.iman)], ["revivir", st.revivir - J.revividas]];
  const col = Math.floor((w - 16) / 2), paso = 11, filasCol = Math.ceil(filas.length / 2);
  filas.forEach(([k, v], i) => {
    const cxx = x0 + 8 + (i >= filasCol ? col : 0), yy = y + (i % filasCol) * paso;
    texto(L(NOMBRE_ST[k]), cxx, yy, { al: "izq", grad: "gris", sombra: 0 });
    texto(String(v), cxx + col - 6, yy, { al: "der", sombra: 0 });
  });
  y += filasCol * paso + 8;
  uiEmpezar("pausa");
  const bw = w - 40;
  boton(x0 + 20, y, bw, 22, TX.seguir, () => { J.pausa = false; }, { estilo: "azul" }); y += 26;
  boton(x0 + 20, y, bw, 22, `${L(TX.musica)}: ${Math.round(G.op.musica * 100)}%`, () => { G.op.musica = G.op.musica >= 1 ? 0 : Math.round((G.op.musica + 0.2) * 10) / 10; volumenes(); guardar(); }, { estilo: "oscuro" }); y += 26;
  boton(x0 + 20, y, bw, 22, `${L(TX.efectos)}: ${Math.round(G.op.efectos * 100)}%`, () => { G.op.efectos = G.op.efectos >= 1 ? 0 : Math.round((G.op.efectos + 0.2) * 10) / 10; volumenes(); guardar(); sfx("gema"); }, { estilo: "oscuro" }); y += 26;
  boton(x0 + 20, y, bw, 22, IDIOMA === "es" ? "Idioma: Español" : "Language: English", () => cambiarIdioma(), { estilo: "oscuro" }); y += 26;
  boton(x0 + 20, y, bw, 22, TX.salir, () => { J.pausa = false; morirRendido(); }, { estilo: "rojo" });
  uiProcesar(() => { J.pausa = false; });
}
function morirRendido() { J.revividas = 99; J.jug.vida = 0; J.fin = true; J.finT = 2; J.ganaste = false; pararTema(); }
