// ─────────────────────────────────────────────────────────────────────────────
// EL HUD DE LA ARENA, medido en las capturas: "wave: 5/5" grande arriba a la derecha (el número en
// amarillo), una píldora de 14×4 por héroe abajo a la izquierda (la vida adentro y la recarga como
// una rayita debajo), la cuenta regresiva al medio y "arena clear!" que ondula.
// ─────────────────────────────────────────────────────────────────────────────

function dibujarHUD(dt) {
  const es = IDIOMA === "es";
  // arriba a la derecha: la oleada (o el jefe)
  if (M.jefeNivel) {
    const e = M.jefe;
    texto(es ? "[red]jefe" : "[red]boss", AR.x2 - 2, 3, { al: "der", esc: 2 });
    if (e && !e.muerto) { const w = 120, x = Math.round(AR.cx - w / 2), k = lim(e.hp / e.maxhp, 0, 1); cajaRed(x - 1, 6, w + 2, 6, "#1d1d1d", 2); cajaRed(x, 7, Math.max(1, w * k), 4, COL[e.colorD] || COL.red, 2); }
  } else {
    const ola = Math.min(M.oleada, M.maxOleadas), sc = M.golpeOla > 0 ? 2 : 2;
    const w = texto(`[fg]${es ? "oleada" : "wave"}: [yellow]${ola}/${M.maxOleadas}`, AR.x2 - 2, 3 - (M.golpeOla > 0 ? 1 : 0), { al: "der", esc: sc });
  }
  // arriba a la izquierda: pausa, nivel y oro
  const px = 4, py = 4;
  cajaRed(px, py, 14, 14, rampa("bg", 6), 3); caja(px + 4, py + 4, 2, 6, COL.fg); caja(px + 8, py + 4, 2, 6, COL.fg);
  if (tocado(0, 0, 26, 26) || recien("atras")) { M.pausa = true; sfx("clic"); }
  texto(`[fg]${es ? "nv." : "lv."}[yellow]${J.nivel}  [fg]${es ? "oro" : "gold"}: [yellow]${J.oro}`, px + 20, py + 4, { al: "izq" });
  // abajo: las píldoras de vida y recarga
  M.vib.forEach((u, i) => {
    const x = AR.x1 + 1 + i * 22, y = AR.y2 + 8;
    const c = u.muerto ? rampa("bg", 5) : u.flash > 0 ? COL.fg : rampa(u.col, -2);
    marco(x, y, 16, 6, c, 3);
    if (!u.muerto && u.hp > 0) cajaRed(x + 1, y + 1, Math.max(2, 14 * (u.hp / u.maxhp)), 4, c, 2);
    if (!u.muerto && ATQ[u.id] && !ATQ[u.id].pasivo && !ATQ[u.id].aura) { const k = u.cdTotal ? lim(1 - u.t / u.cdTotal, 0, 1) : 1; caja(x, y + 8, 16 * k, 1, c); }
  });
  // la cuenta regresiva
  if (M.fase === "cuenta" && M.cuenta > 0) {
    const k = 1 - M.cuentaT, esc = 3 + (k > 0.8 ? 1 : 0);
    texto(`[fg]${M.cuenta}`, AR.cx, AR.cy - 40, { esc });
  }
  if (M.fase === "limpio") {
    texto(es ? "[fg]¡arena limpia!" : "[fg]arena clear!", AR.cx, AR.cy - 44, { esc: 2, ola: 1.5 });
    const r = M.resumen;
    if (r && M.finT > 0.6) texto(`[yellow]+${r.gan}[fg] ${es ? "de oro" : "gold"}   [yellow]+${r.inter}[fg] ${es ? "de interés" : "interest"}${r.junt ? `   [yellow]+${r.junt}[fg] ${es ? "juntado" : "picked up"}` : ""}`, AR.cx, AR.cy - 18, { alfa: Math.min(1, (M.finT - 0.6) * 3) });
  }
  // los dedos: una flechita en el costado que se está apretando (se ve qué entendió el juego)
  if (IN.tactil) {
    if (IN.izq) { g.fillStyle = alfa("fg", 0.25); g.beginPath(); g.moveTo(8, H / 2); g.lineTo(16, H / 2 - 8); g.lineTo(16, H / 2 + 8); g.fill(); }
    if (IN.der) { g.fillStyle = alfa("fg", 0.25); g.beginPath(); g.moveTo(W - 8, H / 2); g.lineTo(W - 16, H / 2 - 8); g.lineTo(W - 16, H / 2 + 8); g.fill(); }
  }
}
/** El cartel del primer nivel, escrito en el piso (como el "<- or a / -> or d" del original). */
function dibujarAyudaPiso() {
  if (J.nivel !== 1 || M.t > 14) return;
  const es = IDIOMA === "es", a = Math.min(1, (14 - M.t) / 2) * 0.9, tact = IN.tactil || matchMedia("(pointer: coarse)").matches;
  const izq = tact ? (es ? "mantené la mitad izquierda" : "hold the left half") : "<- / a", der = tact ? (es ? "mantené la mitad derecha" : "hold the right half") : "-> / d";
  texto(`[bg10]${izq}`, AR.cx - AR.w / 4, AR.cy + 12, { alfa: a });
  texto(`[bg10]${der}`, AR.cx + AR.w / 4, AR.cy + 12, { alfa: a });
  texto(es ? "[bg10]dobla a la izquierda" : "[bg10]turn left", AR.cx - AR.w / 4, AR.cy + 24, { alfa: a });
  texto(es ? "[bg10]dobla a la derecha" : "[bg10]turn right", AR.cx + AR.w / 4, AR.cy + 24, { alfa: a });
}
