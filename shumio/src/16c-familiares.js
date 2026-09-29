// ─────────────────────────────────────────────────────────────────────────────
// LOS FAMILIARES, como en el original: los que orbitan (tapan balas y pegan al tocar), los que
// siguen en fila detrás de Shumio y lloran hacia donde llora él (el íncubo copia su arma), los
// que se lanzan (el gordito, el cerebro), los que cazan (la sanguijuela, el pájaro, la araña) y
// las moscas y arañitas azules que se tiran solas contra el enemigo más cercano.
// Números de la wiki (Repentance): hermanito 1,88 lágr./s de 3,5; hermanita 1,36/s de 6; bebé
// demonio 3/s de 3,5; ángel guardián 7 por golpe; admiradora 5; gordito 3,5 por golpe.
// ─────────────────────────────────────────────────────────────────────────────

/** Una mosca (o arañita) azul: busca al enemigo más cercano, le pega y se muere. */
function moscaAzul(x, y, tipo = "mosca") { return { tipo: "moscaAzul", sub: tipo, x: x + V.ent(-6, 6), y: y + V.ent(-6, 6), t: 900, a: V.f() * TAU }; }

const ORBITALES = { mosca: { r: 20, v: 0.055, dano: 2.5, cada: 8 }, admiradora: { r: 30, v: 0.04, dano: 5, cada: 4 }, angel: { r: 22, v: 0.09, dano: 7, cada: 8 }, corona: { r: 16, v: 0.07, dano: 0, cada: 99 }, pelos: { r: 25, v: 0.05, dano: 5, cada: 8 } };
const SEGUIDORES = { hermanito: { cada: 32, dano: 3.5, color: "violeta" }, hermanita: { cada: 44, dano: 6, color: "sangre" }, demonio: { cada: 20, dano: 3.5, color: "sangre" }, robo: { cada: 60, dano: 3.5 }, incubo: {}, gordito: {}, cerebro: {}, sanguijuela: {}, bolsa: {}, aranaFam: {} };

function armarFamiliares() {
  const j = J.jug, viejos = J.familiares.filter((f) => f.tipo === "moscaAzul" || f.tipo === "pajaro");
  J.familiares = viejos;
  const lista = [];
  for (const id of j.objetos) { const d = OBJETOS[id]; if (d && d.fam) lista.push(d.fam); }
  if (j.f.cuchilloAtras) lista.push("cuchilloAtras");
  if (j.f.aranaFam) lista.push("aranaFam");
  let orb = 0, fila = 0;
  for (const tipo of lista) {
    const f = { tipo, x: j.x, y: j.y, t: 0, enfriar: 0, mirar: ABAJO };
    if (ORBITALES[tipo]) { f.orbital = true; f.k = orb++; f.bloquea = true; if (tipo === "corona") { J.familiares.push(f); f.k = orb++; J.familiares.push({ ...f, k: orb - 1 }); continue; } }
    else f.fila = fila++;
    J.familiares.push(f);
  }
  const n = J.familiares.filter((f) => f.orbital).length;
  for (const f of J.familiares) if (f.orbital) f.n = n;
}

/** El rastro de Shumio: los que lo siguen van en fila por donde él pasó. */
function rastroEn(k) { const R = J.rastro || []; return R[Math.min(R.length - 1, k)] || [J.jug.x, J.jug.y]; }

function actualizarFamiliares() {
  const j = J.jug, tira = !!(IN.dx || IN.dy) && J.congelado <= 0 && !j.muerto;
  J.rastro ||= [];
  if (Math.hypot(j.vx, j.vy) > 0.2 || !J.rastro.length) { J.rastro.unshift([j.x, j.y]); if (J.rastro.length > 120) J.rastro.pop(); }
  for (let i = J.familiares.length - 1; i >= 0; i--) {
    const f = J.familiares[i];
    f.t++;
    if (f.orbital) {
      const o = ORBITALES[f.tipo];
      f.a = J.t * o.v + (f.k / Math.max(1, f.n)) * TAU;
      f.x = j.x + Math.cos(f.a) * o.r; f.y = j.y - 4 + Math.sin(f.a) * o.r * 0.75;
      if (o.dano && f.t % o.cada === 0) for (const e of J.enemigos) if (blanco_(e) && dist(e.x, e.y - 4, f.x, f.y) < e.r + 5) danarEnemigo(e, o.dano);
      continue;
    }
    if (f.fila != null && !f.lanzado) {
      const [tx, ty] = rastroEn(8 + f.fila * 9);
      f.x += (tx - f.x) * 0.2; f.y += (ty + 2 - f.y) * 0.2;
    }
    if (f.enfriar > 0) f.enfriar--;
    switch (f.tipo) {
      case "hermanito": case "hermanita": {
        const s = SEGUIDORES[f.tipo];
        if (tira && f.enfriar <= 0) { f.mirar = j.mirar; f.enfriar = s.cada; lagrimaFamiliar(f, IN.dx, IN.dy, s.dano, s.color); }
        else if (!tira) f.mirar = ABAJO;
        break;
      }
      case "demonio": {   // dispara solo al más cercano que tenga a tiro
        const e = masCercano(f.x, f.y, 90);
        if (e && f.enfriar <= 0) { const a = Math.atan2(e.y - 4 - f.y, e.x - f.x); f.enfriar = 20; lagrimaFamiliar(f, Math.cos(a), Math.sin(a), 3.5, "sangre"); }
        break;
      }
      case "robo":
        if (tira && f.enfriar <= 0) { f.enfriar = 60; laser(j, f.x, f.y - 8, Math.atan2(IN.dy, IN.dx), { dano: 3.5, ancho: 2 }); SFX.laser(); }
        break;
      case "incubo":   // copia el arma de Shumio, a su misma cadencia
        if (tira && f.enfriar <= 0 && (j.arma === "lagrima" || j.arma === "laser" || j.arma === "feto" || j.arma === "rayo")) {
          f.enfriar = j.arma === "rayo" ? 60 / j.fr + 40 : cuadrosEntreLagrimas(j);
          disparar(j, IN.dx, IN.dy, { carga: 1 }, f);
        } else if (tira && f.enfriar <= 0) { f.enfriar = cuadrosEntreLagrimas(j); lagrimaFamiliar(f, IN.dx, IN.dy, danoDe(j), colorLagrima(j)); }
        break;
      case "gordito": case "cerebro": {   // se lanza hacia donde llorás, pega en el camino hasta la pared
        if (!f.lanzado && tira && f.enfriar <= 0) { f.lanzado = true; f.vx = IN.dx * 4; f.vy = IN.dy * 4; }
        if (f.lanzado) {
          f.x += f.vx; f.y += f.vy;
          for (const e of J.enemigos) if (blanco_(e) && dist(e.x, e.y - 4, f.x, f.y) < e.r + 6) {
            if (f.tipo === "cerebro") { explotar(f.x, f.y, true, false, { dano: 100, veneno: true, danoJug: 2 }); J.familiares.splice(i, 1); f.muerto = true; break; }
            if (f.t % 2 === 0) danarEnemigo(e, 3.5, f.vx * 0.5, f.vy * 0.5);
          }
          if (f.muerto) break;
          if (f.x < IX0 + 6 || f.x > IX1 - 6 || f.y < IY0 + 4 || f.y > IY1 - 4) { f.lanzado = false; f.enfriar = 60; f.x = lim(f.x, IX0 + 6, IX1 - 6); f.y = lim(f.y, IY0 + 4, IY1 - 4); }
        }
        break;
      }
      case "sanguijuela": case "aranaFam": {
        const e = masCercano(f.x, f.y, 80);
        if (e) {
          const d = dist(e.x, e.y, f.x, f.y) || 1; f.x += (e.x - f.x) / d * 1.1; f.y += (e.y - f.y) / d * 1.1;
          if (d < e.r + 5 && f.enfriar <= 0) {
            f.enfriar = f.tipo === "sanguijuela" ? 28 : 30;
            if (f.tipo === "sanguijuela") { danarEnemigo(e, 1.5); if (e.muerto) { curar(j, 1); SFX.corazon(); } }
            else { danarEnemigo(e, 1, 0, 0, A.uno([{ veneno: true }, { hielo: true }, { miedo: true }, { piedra: true }, { fuego: true }])); }
          }
        }
        break;
      }
      case "cuchilloAtras": {   // ¿sí, abuela?: el cuchillo que queda atrás, pega el doble
        const [tx, ty] = rastroEn(10); f.x += (tx - f.x) * 0.3; f.y += (ty - 6 - f.y) * 0.3;
        if (f.t % 3 === 0) for (const e of J.enemigos) if (blanco_(e) && dist(e.x, e.y - 4, f.x, f.y) < e.r + 5) danarEnemigo(e, danoDe(j) * 2);
        break;
      }
      case "pajaro": {
        const e = masCercano(f.x, f.y, 999);
        const tx = e ? e.x : j.x + Math.cos(f.t * 0.05) * 20, ty = e ? e.y - 6 : j.y - 18;
        const d = dist(tx, ty, f.x, f.y) || 1; f.x += (tx - f.x) / d * Math.min(1.6, d); f.y += (ty - f.y) / d * Math.min(1.6, d);
        if (e && d < e.r + 5 && f.t % 28 === 0) danarEnemigo(e, 2);
        break;
      }
      case "moscaAzul": {
        const e = masCercano(f.x, f.y, 1e9);
        const tx = e ? e.x : j.x + Math.cos(f.t * 0.05 + i) * 16, ty = e ? e.y - 4 : j.y - 6 + Math.sin(f.t * 0.05 + i) * 12;
        const d = dist(tx, ty, f.x, f.y) || 1, v = e ? (f.sub === "arana" ? 1.4 : 1.8) : 1.2;
        f.x += (tx - f.x) / d * Math.min(v, d); f.y += (ty - f.y) / d * Math.min(v, d);
        // la mosca azul pega el doble del daño de Shumio (mínimo 8, como en el original a daño base)
        if (e && d < e.r + 4) { danarEnemigo(e, Math.max(8, danoDe(j) * 2)); sangrar(f.x, f.y, 3, PAL.azul); J.familiares.splice(i, 1); continue; }
        if (--f.t <= 0 && !e) J.familiares.splice(i, 1);
        break;
      }
    }
  }
}
function masCercano(x, y, max) {
  let obj = null, md = max;
  for (const e of J.enemigos) { if (!blanco_(e)) continue; const d = dist(e.x, e.y, x, y); if (d < md) { md = d; obj = e; } }
  return obj;
}
function lagrimaFamiliar(f, dx, dy, dano, color) {
  const v = 3.1, a = Math.atan2(dy, dx);
  J.lagrimas.push({ x: f.x, y: f.y, cx: f.x, cy: f.y, z: 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 52, vidaMax: 52, r: dano > 5 ? 4 : 3, r0: 3, dano, dano0: dano, color, tipo: "lagrima", empuje: 1, tocados: null, dist: 0 });
}

function dibujarFamiliar(g, f) {
  const X = Math.round(f.x), Y = Math.round(f.y);
  let s;
  switch (f.tipo) {
    case "mosca": case "moscaAzul": case "corona":
      if (f.sub === "arana") { s = tinte(aranaSpr((f.t >> 2) & 1), "rgba(110,170,255,0.55)"); g.drawImage(sombra(3, 1), X - 3, Y + 2); g.drawImage(s, X - Math.floor(s.width / 2), Y + 3 - s.height); return; }
      s = tinte(mosquinSpr((f.t >> 1) & 1), "rgba(110,170,255,0.55)"); break;
    case "admiradora": s = tinte(mosquinSpr((f.t >> 1) & 1), "rgba(230,40,40,0.5)"); break;
    case "pajaro": s = tinte(mosquinSpr((f.t >> 2) & 1), "rgba(240,240,240,0.7)"); break;
    case "hermanito": case "hermanita": case "demonio": case "incubo": case "robo": {
      const pal = { hermanito: [PAL.piel, PAL.violeta, PAL.azul], hermanita: [PAL.piel, PAL.sangre, PAL.hongo], demonio: [["#1a0a0a", "#3a1414", "#5a2222", "#7a3434", "#a05050"], PAL.sangre, PAL.sangre], incubo: [["#140a1a", "#2a1434", "#46225a", "#643480", "#8a52a8"], PAL.violeta, PAL.sangre], robo: [PAL.hierro, PAL.hierro, PAL.azul] }[f.tipo];
      const sp = spritesShumio(pal[0], pal[1], pal[2], f.tipo);
      const cab = sp.cab[VISTA_CAB[f.mirar]][f.enfriar > (SEGUIDORES[f.tipo].cada || 30) - 6 ? 1 : 0];
      g.drawImage(sombra(5, 2), X - 5, Y + 2);
      if (f.tipo === "incubo") { g.globalAlpha = 0.85; g.drawImage(sp.cue.frente[0], X - 7, Y - 8); }
      g.drawImage(cab, X - 11, Y - 18 + Math.round(Math.sin(f.t * 0.1)));
      g.globalAlpha = 1;
      return;
    }
    default: s = familiarSpr(f.tipo, (f.t >> 3) & 1);
  }
  if (!s) return;
  if (f.tipo === "angel" || f.tipo === "pelos") s = familiarSpr(f.tipo, (f.t >> 3) & 1);
  if (f.tipo === "cuchilloAtras") { const c = cuchilloSpr(); g.save(); g.translate(X, Y); g.rotate(Math.atan2(J.jug.y - f.y, J.jug.x - f.x) + Math.PI); g.drawImage(c, -c.width / 2, -c.height / 2); g.restore(); return; }
  g.drawImage(sombra(3, 1), X - 3, Y + 6);
  g.drawImage(s, X - Math.floor(s.width / 2), Y - Math.floor(s.height / 2) - 4);
}
