// ─────────────────────────────────────────────────────────────────────────────
// LO QUE SE JUNTA: gemas de experiencia (azul ≤2, verde ≤9, roja más), oro, pollo, cofres de los
// jefes y lo que sueltan los braseros (rosario, reloj, aspiradora, trebolito). Con más de 400 gemas
// en el piso no caen nuevas: su experiencia se junta en UNA gema roja (wiki), así no se traba.
// ─────────────────────────────────────────────────────────────────────────────

ENEMIGOS.brasero = { vida: 10, dano: 0, vel: 0, emp: 0, xp: 0, r: 5, spr: "brasero", brasero: 1 };
const TOPE_GEMAS = 400;

function soltarGema(x, y, xp) {
  if (J.gemas.length >= TOPE_GEMAS) {
    if (!J.rojaGrande || J.rojaGrande.juntada) { J.rojaGrande = { x, y, xp: 0, tipo: "roja", vuela: 0, v: 0 }; J.gemas.push(J.rojaGrande); }
    J.rojaGrande.xp += xp; return;
  }
  J.gemas.push({ x: x + (V.f() - 0.5) * 4, y, xp, tipo: xp <= 2 ? "azul" : xp <= 9 ? "verde" : "roja", vuela: 0, v: 0 });
}
function ganarXP(xp) {
  // en los niveles 20 y 40 (los "muros" de la curva) la experiencia vale doble hasta pasar (wiki)
  const extra = J.nivel === 20 || J.nivel === 40 ? 2 : 1;
  J.xp += xp * J.st.crec * extra;
  while (J.xp >= J.xpSig) { J.xp -= J.xpSig; J.nivel++; J.xpSig = xpPara(J.nivel); J.pendientes++; recalcular(); }
}
function ganarOro(n) { const v = Math.round(n * J.st.codicia); J.oro += v; sfx("moneda", 0.5); return v; }

function pasoRecoger(dt) {
  const j = J.jug, iman = J.st.iman * 0.9, im2 = iman * iman;
  for (let i = J.gemas.length - 1; i >= 0; i--) {
    const gm = J.gemas[i], dx = j.x - gm.x, dy = j.y - 4 - gm.y, d2 = dx * dx + dy * dy;
    if (!gm.vuela && d2 < im2) { gm.vuela = 1; gm.v = -60; }      // primero salta un poquito para atrás, después vuela
    if (gm.vuela) {
      gm.v = Math.min(420, gm.v + 700 * dt);
      const d = Math.sqrt(d2) || 1; gm.x += dx / d * gm.v * dt; gm.y += dy / d * gm.v * dt;
      if (d < 7) { ganarXP(gm.xp); sfx("gema", 0.35, gm.tipo === "azul" ? 1 : gm.tipo === "verde" ? 1.12 : 1.25); J.gemas.splice(i, 1); if (gm === J.rojaGrande) gm.juntada = true; }
    }
  }
  for (let i = J.cosas.length - 1; i >= 0; i--) {
    const c = J.cosas[i], dx = j.x - c.x, dy = j.y - 4 - c.y, d = Math.hypot(dx, dy);
    if (c.tipo !== "cofre" && (d < iman || c.vuela)) { c.vuela = 1; c.v = Math.min(360, (c.v || 0) + 600 * dt); c.x += dx / (d || 1) * c.v * dt; c.y += dy / (d || 1) * c.v * dt; }
    if (d < (c.tipo === "cofre" ? 12 : 8)) { J.cosas.splice(i, 1); levantar(c); }
  }
  // braseros: mientras haya pocos, cada segundo puede prenderse uno justo afuera de la pantalla
  J.brasT -= dt;
  if (J.brasT <= 0) {
    J.brasT = 1;
    const n = J.enemigos.reduce((s, e) => s + (e.d.brasero ? 1 : 0), 0);
    if (n < 2 && A.si(0.22 * J.st.suerte)) { const [x, y] = puntoAfuera(8); aparecer("brasero", x, y); }
  }
}
function levantar(c) {
  const j = J.jug;
  switch (c.tipo) {
    case "moneda": ganarOro(1); break;
    case "bolsa": ganarOro(10); break;
    case "bolsaRica": ganarOro(100); break;
    case "pollo": curar(30 * (1 + J.st.recup)); sfx("pollo", 0.6); break;
    case "corazoncito": curar(1); break;
    case "rosario":
      for (const e of J.enemigos) if (!e.d.jefe && !e.d.brasero && enPantalla(e.x, e.y, 8)) matar(e);
      J.destello = G.op.destellos ? 0.5 : 0; sfx("rosario"); break;
    case "reloj": J.congelado = 10; sfx("reloj"); break;
    case "aspiradora": for (const gm of J.gemas) { gm.vuela = 1; gm.v = 60; } sfx("iman"); break;
    case "trebolito": J.trebolitos = (J.trebolitos || 0) + 1; recalcular(); sfx("elegir", 0.6); break;
    case "cofre": abrirModalCofre(c); break;
  }
  if (c.tipo !== "cofre" && c.tipo !== "moneda") J.efectos.push({ tipo: "onda", x: j.x, y: j.y - 6, t: 0.25, t0: 0.25, r: 14, col: "#ffffff" });
}
/** Lo que suelta un brasero (tabla de pesos de la wiki; la suerte agranda todo menos el oro). */
function botinBrasero(x, y) {
  const tabla = BOTIN_BRASERO.filter(([, , min]) => J.nivel >= min).map(([k, p]) => [k, k === "moneda" || k === "bolsa" ? p : p * J.st.suerte]);
  let s = 0; for (const [, p] of tabla) s += p;
  let r = A.f() * s;
  for (const [k, p] of tabla) if ((r -= p) < 0) { J.cosas.push({ tipo: k, x, y }); return; }
}
