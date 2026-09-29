// ─────────────────────────────────────────────────────────────────────────────
// LOS MENÚS, EN PAPEL (la estética del original, con dibujo propio): hojas rasgadas clavadas
// con chinches sobre una pared de papel gris llena de garabatos desvaídos, todo escrito a mano
// con marcador. El título (el logo y una hoja con Shumio dibujado), el menú, cómo se juega, la
// pausa (opciones y la hoja de cuentas), "mi última voluntad" al morir y la carta del final.
// Se manejan con el dedo o con el teclado. También el aviso de "girá el teléfono".
// ─────────────────────────────────────────────────────────────────────────────

const MENU = { activo: null };
let registro = { partidas: 0, victorias: 0, muertes: 0, mejorPiso: 1, jefes: 0 };
try { Object.assign(registro, JSON.parse(localStorage.getItem("shumio-registro") || "{}")); } catch (e) { /* sin guardar */ }
function guardarRegistro() { try { localStorage.setItem("shumio-registro", JSON.stringify(registro)); } catch (e) { /* nada */ } }

const pct = (v) => Math.round(v * 100) + "%";
function reloj(cuadros) { const s = Math.floor(cuadros / 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
const TINTA_MANO = "#2b2326";

function abrirMenu(tipo) {
  const m = { tipo, sel: 0, t: 0, sobreJuego: tipo === "pausa" || tipo === "muerte", items: [], rects: [] };
  const completa = { texto: () => enPantallaCompleta() ? "SALIR DE PANTALLA COMPLETA" : "PANTALLA COMPLETA", hacer: () => pantallaCompleta(!enPantallaCompleta()) };
  const vol = () => [
    { texto: () => "MÚSICA " + pct(volMusica), cambiar: (d) => { volMusica = lim(Math.round((volMusica + d * 0.1) * 10) / 10, 0, 1); guardarVolumen(); } },
    { texto: () => "EFECTOS " + pct(volEfectos), cambiar: (d) => { volEfectos = lim(Math.round((volEfectos + d * 0.1) * 10) / 10, 0, 1); guardarVolumen(); SFX.moneda(); } },
  ];
  if (tipo === "titulo") { m.items = [{ texto: () => IN.usaTactil ? "TOCÁ PARA EMPEZAR" : "ENTER O CLIC", hacer: () => abrirMenu("principal") }]; Musica.poner("menu"); }
  if (tipo === "principal") Musica.poner("menu");
  if (tipo === "principal") m.items = [{ texto: () => "NUEVA PARTIDA", hacer: () => { MENU.activo = null; nuevaPartida(); } }, ...vol(), completa, { texto: () => "CÓMO SE JUEGA", hacer: () => abrirMenu("ayuda") }];
  if (tipo === "ayuda") m.items = [{ texto: () => "VOLVER", hacer: () => abrirMenu("principal") }];
  if (tipo === "pausa") m.items = [{ texto: () => "SEGUIR", hacer: () => { MENU.activo = null; } }, ...vol(), completa, { texto: () => "SALIR", hacer: () => { J = null; abrirMenu("principal"); } }];
  if (tipo === "muerte" || tipo === "victoria") m.items = [{ texto: () => "OTRA VEZ", hacer: () => { MENU.activo = null; nuevaPartida(); } }, { texto: () => "AL MENÚ", hacer: () => { J = null; abrirMenu("principal"); } }];
  if (tipo === "victoria") Musica.poner("menu");
  MENU.activo = m;
}

function pasoMenu() {
  const m = MENU.activo;
  m.t++;
  const n = m.items.length, it = () => m.items[m.sel];
  if (m.t < 12) return;   // que un toque de antes no active nada
  if (recien("kArrowUp") || recien("kKeyW")) { m.sel = (m.sel + n - 1) % n; SFX.clic(); }
  if (recien("kArrowDown") || recien("kKeyS")) { m.sel = (m.sel + 1) % n; SFX.clic(); }
  if ((recien("kArrowLeft") || recien("kKeyA")) && it().cambiar) it().cambiar(-1);
  if ((recien("kArrowRight") || recien("kKeyD")) && it().cambiar) it().cambiar(1);
  if (recien("aceptar")) activar(it());
  if (m.tipo === "pausa" && recien("pausa")) { MENU.activo = null; return; }
  if (m.tipo === "ayuda" && recien("pausa")) { abrirMenu("principal"); return; }
  // PC: el mouse elige lo que tiene abajo
  if (IN.movio) { IN.movio = false; m.rects.forEach((r, i) => { if (IN.px >= r.x - 12 && IN.px <= r.x + r.w + 6 && IN.py >= r.y - 2 && IN.py <= r.y + r.h + 2 && m.sel !== i) { m.sel = i; SFX.clic(); } }); }
  const tq = FLANCO.toque;
  if (tq) {
    if (m.tipo === "titulo") { activar(m.items[0]); return; }
    m.rects.forEach((r, i) => { if (tq.x >= r.x - 6 && tq.x <= r.x + r.w + 6 && tq.y >= r.y - 3 && tq.y <= r.y + r.h + 3) { m.sel = i; activar(m.items[i], true); } });
  }
}
function activar(it, tactil) {
  SFX.clic();
  if (it.hacer) it.hacer();
  else if (it.cambiar) it.cambiar(tactil ? (it.texto().includes("100%") ? -10 : 2) : 1);
}

/** La hoja tiene que entrar la opción más larga (con la flechita y el margen). */
function anchoOpciones(m, minimo) { return Math.max(minimo, ...m.items.map((it) => manoSpr(it.texto()).width + 34)); }
// ── piezas de papel ──
/** Una hoja clavada: el papel (que se mece apenas) y sus dos chinches. Devuelve dónde quedó. */
function hoja(g, x, y, w, h, semilla, tono = "blanco", mece = 0, chinches = 2) {
  const p = papelSpr(w, h, semilla, tono), dy = Math.round(Math.sin(mece) * 0.8);
  g.drawImage(p, Math.round(x - 3), Math.round(y - 3 + dy));
  const ch = chincheSpr();
  if (chinches >= 1) g.drawImage(ch, Math.round(x + w * 0.2 - 4), Math.round(y - 2 + dy));
  if (chinches >= 2) g.drawImage(ch, Math.round(x + w * 0.78 - 4), Math.round(y - 3 + dy));
  return dy;
}
/** Escribe a mano; alinear: "izq" | "centro". Devuelve el rectángulo (para tocarlo). */
function escribir(g, str, x, y, alinear = "izq", tinta = TINTA_MANO) {
  const s = manoSpr(str, { tinta });
  const X = alinear === "centro" ? Math.round(x - s.width / 2) : Math.round(x);
  g.drawImage(s, X, Math.round(y));
  return { x: X, y: Math.round(y), w: s.width, h: s.height };
}
/** El triangulito de tinta que marca la opción elegida. */
function flechita(g, x, y, t) {
  g.fillStyle = TINTA_MANO;
  const b = (t >> 4) & 1;
  for (let i = 0; i < 4; i++) g.fillRect(x + b, y + i, 1 + i * 1.4 | 0, 1), g.fillRect(x + b, y + 7 - i, 1 + i * 1.4 | 0, 1);
  g.fillRect(x + b, y + 4, 6, 1);
}
/** La lista de opciones sobre una hoja, con la flechita en la elegida. */
function opciones(g, m, x, y, paso = 17) {
  m.rects = m.items.map((it, i) => {
    const r = escribir(g, it.texto(), x + 10, y + i * paso);
    if (i === m.sel) flechita(g, x, y + i * paso + 5, m.t);
    return r;
  });
}

function dibujarMenu(g) {
  const m = MENU.activo, W = PANT.W, H = PANT.H;
  const fondoPared = () => g.drawImage(fondoMenuSpr(W, H), 0, 0);
  const mece = m.t * 0.05;
  if (m.tipo === "titulo") {
    fondoPared();
    // la hoja con Shumio dibujado cuelga debajo del logo, que la pisa (como en el original)
    const logo = logoSpr(), lx = Math.round(W / 2 - logo.width / 2), ly = 2;
    const hw = 156, hx = Math.round(W / 2 - hw / 2 + 6), hy = ly + logo.height - 44, hh = Math.min(H - hy - 6, 136);
    const dy = hoja(g, hx, hy, hw, hh, 7, "blanco", mece, 0);
    const llora = m.t % 80 < 10;
    const cx0 = Math.round(W / 2 + 6), base = hy + hh - 34 + dy, dib = dibujoShumio(llora ? 1 : 0);
    g.drawImage(dib, cx0 - 36, base - 78);
    // el piso y el charquito de lágrimas, trazados a mano
    g.fillStyle = TINTA_MANO;
    for (let x = -58; x <= 58; x++) { const y = Math.round(Math.sin(x * 0.11) * 0.8); if (Math.abs(x) > 26) g.fillRect(cx0 + x, base + 1 + y, 1, 2); }
    for (let k = 0; k < 40; k++) { const an = k / 40 * TAU, x = Math.round(cx0 + Math.cos(an) * 30), y = Math.round(base + 1 + Math.sin(an) * 4); if (Math.sin(an) > -0.35) g.fillRect(x, y, 2, 1); }
    for (let i = 0; i < 2; i++) { const k = (m.t + i * 40) % 80, ty = base - 30 + k * 0.5; if (k < 50) g.drawImage(gotitaDibujo(), cx0 + (i ? 5 : -15), Math.round(ty)); }
    escribir(g, m.items[0].texto(), cx0, base + 8, "centro");
    g.drawImage(logo, lx, ly);
    notaRegistro(g, W, H, mece);
    return;
  }
  if (m.tipo === "principal") {
    fondoPared();
    const logo = logoSpr(), lw = Math.round(logo.width * 0.5);
    g.drawImage(logo, 8, 6, lw, Math.round(logo.height * 0.5));
    const hw = anchoOpciones(m, 168), hh = m.items.length * 18 + 24, hx = Math.round(W / 2 - hw / 2 - 20), hy = Math.round(H / 2 - hh / 2) + 8;
    const dy = hoja(g, hx, hy, hw, hh, 3, "blanco", mece);
    opciones(g, m, hx + 16, hy + 14 + dy);
    notaRegistro(g, W, H, mece);
    return;
  }
  if (m.tipo === "ayuda") {
    fondoPared();
    const hw = Math.min(W - 40, 330), hh = H - 36, hx = Math.round(W / 2 - hw / 2), hy = 16;
    const dy = hoja(g, hx, hy, hw, hh, 11, "crema", mece);
    const lineas = IN.usaTactil
      ? ["PULGAR IZQUIERDO: CAMINAR", "PULGAR DERECHO: LLORAR (4 LADOS)", "BOTÓN GRANDE: BOMBA", "ARRIBA: OBJETO ACTIVO", "AL LADO: CÁPSULA"]
      : ["WASD: CAMINAR", "FLECHAS: LLORAR", "E: BOMBA   Q: CÁPSULA", "ESPACIO: OBJETO ACTIVO", "ESC: PAUSA"];
    lineas.forEach((l, i) => escribir(g, l, hx + 16, hy + 12 + i * 18 + dy));
    escribir(g, "LIMPIÁ LAS SALAS, BAJÁ 4 PISOS Y", hx + 16, hy + 12 + 5 * 18 + 6 + dy, "izq", "#6a1c1c");
    escribir(g, "HACÉ QUE MICELIA DEJE DE LLORAR.", hx + 16, hy + 12 + 6 * 18 + 6 + dy, "izq", "#6a1c1c");
    opciones(g, m, hx + hw - 90, hy + hh - 24 + dy);
    return;
  }
  if (m.tipo === "pausa") {
    g.fillStyle = "rgba(4,2,6,0.62)"; g.fillRect(0, 0, W, H);
    const j = J.jug;
    // la hoja de las opciones
    const hw = anchoOpciones(m, 150), hh = m.items.length * 18 + 40, hx = Math.round(Math.max(8, W * 0.5 - hw - 10)), hy = Math.round(H / 2 - hh / 2);
    let dy = hoja(g, hx, hy, hw, hh, 5, "blanco", mece);
    escribir(g, "PAUSA", hx + hw / 2, hy + 6 + dy, "centro", "#6a1c1c");
    opciones(g, m, hx + 14, hy + 26 + dy);
    // la hoja de las cuentas, con los objetos abajo
    const cw = 160, ch = Math.min(H - 20, 186), cx0 = Math.round(W * 0.5 + 6), cy0 = Math.round(H / 2 - ch / 2);
    dy = hoja(g, cx0, cy0, cw, ch, 9, "crema", mece + 1, 1);
    escribir(g, J.piso.nombre, cx0 + cw / 2, cy0 + 6 + dy, "centro");
    const cuentas = [["vel", velDe(j)], ["lag", lagrimasPorSeg(j)], ["dano", danoDe(j)], ["alc", j.alcance], ["tiro", j.velLag], ["suerte", j.suerte]];
    cuentas.forEach(([ic, v], i) => {
      const x = cx0 + 12 + (i % 2) * 74, y = cy0 + 26 + Math.floor(i / 2) * 17 + dy;
      g.drawImage(iconoHud(ic), x, y + 3); escribir(g, v.toFixed(2), x + 11, y);
    });
    escribir(g, "TIEMPO " + reloj(J.tiempo), cx0 + 12, cy0 + 80 + dy);
    const cols = 7;
    [...j.objetos, ...(j.activo ? [j.activo.id] : [])].slice(0, 21).forEach((id, i) => g.drawImage(iconoSpr(id), cx0 + 10 + (i % cols) * 20, cy0 + 100 + Math.floor(i / cols) * 20 + dy));
    return;
  }
  if (m.tipo === "muerte") {
    g.fillStyle = `rgba(20,2,4,${Math.min(0.82, m.t / 40)})`; g.fillRect(0, 0, W, H);
    ultimaVoluntad(g, m, mece);
    return;
  }
  if (m.tipo === "victoria") { fondoPared(); cartaFinal(g, m, mece); }
}

function notaRegistro(g, W, H, mece) {
  const r = registro, nw = 104, nh = 50, nx = W - nw - 10, ny = H - nh - 12;
  const dy = hoja(g, nx, ny, nw, nh, 13, "crema", mece + 2, 1);
  escribir(g, "PARTIDAS " + r.partidas, nx + 8, ny + 6 + dy);
  escribir(g, "GANADAS " + r.victorias, nx + 8, ny + 20 + dy);
  escribir(g, "PISO " + r.mejorPiso, nx + 8, ny + 34 + dy);
}

/** "Mi última voluntad": quién te mató (dibujado), dónde, y a quién le dejás tus cosas. */
function ultimaVoluntad(g, m, mece) {
  const W = PANT.W, H = PANT.H, j = J.jug;
  const hw = Math.min(W - 30, 300), hh = H - 22, hx = Math.round(W / 2 - hw / 2), hy = 10;
  const baja = Math.round(Math.max(0, 1 - m.t / 24) * -H);   // la hoja cae desde arriba
  const dy = hoja(g, hx, hy + baja, hw, hh, 17, "crema", mece) + baja;
  escribir(g, "MI ÚLTIMA VOLUNTAD", hx + hw / 2, hy + 6 + dy, "centro", "#6a1c1c");
  escribir(g, "ME MORÍ EN " + J.piso.nombre, hx + 14, hy + 26 + dy);
  escribir(g, "POR CULPA DE:", hx + 14, hy + 44 + dy);
  const quien = J.causaSpr ? garabato(J.causaSpr, TINTA_MANO, J.causaSpr.width > 40 ? 1 : J.causaSpr.width > 18 ? 2 : 3) : null;
  if (quien) g.drawImage(quien, Math.round(hx + hw * 0.72 - quien.width / 2), Math.round(hy + 60 - quien.height / 2 + dy));
  escribir(g, J.causa || "LA HUMEDAD", hx + 22, hy + 60 + dy);
  escribir(g, "Y LE DEJO MIS COSAS A MI HONGO:", hx + 14, hy + 82 + dy);
  const objs = [...j.objetos, ...(j.activo ? [j.activo.id] : [])];
  objs.slice(0, 12).forEach((id, i) => g.drawImage(garabato(iconoSpr(id), TINTA_MANO, 1, "#ecdfc8"), hx + 16 + i * 20, hy + 100 + dy));
  if (!objs.length) escribir(g, "(NO TENÍA NADA)", hx + 22, hy + 100 + dy, "izq", "#6e625a");
  escribir(g, reloj(J.tiempo) + "  ·  " + J.muertes + " BICHOS", hx + 14, hy + 124 + dy, "izq", "#6e625a");
  opciones(g, m, hx + 14, hy + hh - 40 + dy, 17);
}

function cartaFinal(g, m, mece) {
  const W = PANT.W, H = PANT.H, j = J.jug;
  const hw = Math.min(W - 30, 300), hh = H - 22, hx = Math.round(W / 2 - hw / 2), hy = 10;
  const dy = hoja(g, hx, hy, hw, hh, 19, "blanco", mece);
  escribir(g, "¡LO LOGRASTE!", hx + hw / 2, hy + 6 + dy, "centro", "#6a1c1c");
  escribir(g, "MICELIA YA NO LLORA.", hx + 14, hy + 26 + dy);
  escribir(g, "SHUMIO TAMPOCO.", hx + 14, hy + 42 + dy);
  const sp = spritesShumio(), cab = garabato(sp.cab.frente[0], TINTA_MANO, 2);
  g.drawImage(cab, Math.round(hx + hw - 64), hy + 22 + dy);
  escribir(g, reloj(J.tiempo) + "  ·  " + J.muertes + " BICHOS", hx + 14, hy + 64 + dy, "izq", "#6e625a");
  const objs = [...j.objetos, ...(j.activo ? [j.activo.id] : [])];
  objs.slice(0, 12).forEach((id, i) => g.drawImage(garabato(iconoSpr(id), TINTA_MANO, 1, "#f0ebe2"), hx + 16 + i * 20, hy + 86 + dy));
  opciones(g, m, hx + 14, hy + hh - 40 + dy, 17);
}

/** La presentación del jefe: Shumio y el jefe, con sus nombres escritos en tiras de papel. */
function dibujarVs(g) {
  const W = PANT.W, H = PANT.H, t = J.vs.t, u = Math.min(1, t / 14), e = 1 - Math.pow(1 - u, 3);
  const C = CAPITULOS[J.piso.cap];
  g.fillStyle = C.oscuro; g.fillRect(0, 0, W, H);
  // un foco de luz sucia detrás de cada uno, tramado
  const cy0 = Math.round(H / 2);
  g.fillStyle = C.piso[2];
  for (let y = 0; y < H; y += 2) for (let x = (y >> 1) & 1; x < W; x += 2) { const d = Math.min(Math.hypot(x - W * 0.25, y - cy0), Math.hypot(x - W * 0.73, y - cy0)); if (d < 70 + bayer(x, y) * 20) g.fillRect(x, y, 2, 2); }
  const sp = spritesShumio(), cab = sp.cab.frente[t % 40 < 6 ? 1 : 0];
  const ex = Math.round(lerp(-80, W * 0.25, e));
  g.drawImage(sombra(24, 6), ex - 24, cy0 + 28);
  g.drawImage(cab, ex - 33, cy0 - 40, 66, 66);
  const jefe = ENEMIGOS[J.vs.tipo].spr(J.jefes[0] || { k: 0, t: 0, dir: ABAJO });
  const esc = jefe.width > 70 ? 1 : 2, jx = Math.round(lerp(W + 80, W * 0.73, e));
  g.drawImage(sombra(30, 7), jx - 30, cy0 + 26);
  g.drawImage(jefe, Math.round(jx - jefe.width * esc / 2), cy0 + 32 - jefe.height * esc, jefe.width * esc, jefe.height * esc);
  const vs = bloqueSpr("VS", { grad: "rojo" });
  g.drawImage(vs, Math.round(W / 2 - vs.width), cy0 - 18, vs.width * 2, vs.height * 2);
  if (t > 12) {
    for (const [nombre, x, s] of [["SHUMIO", W * 0.25, 21], [NOMBRE_JEFE[J.vs.tipo], W * 0.73, 23]]) {
      const txt = manoSpr(nombre), pw = txt.width + 16;
      hoja(g, Math.round(x - pw / 2), H - 44, pw, 24, s, "blanco", t * 0.05, 0);
      g.drawImage(txt, Math.round(x - txt.width / 2), H - 40);
    }
  }
}

function dibujarGirar(g) {
  const W = PANT.W, H = PANT.H;
  g.drawImage(fondoMenuSpr(W, H), 0, 0);
  const t = performance.now() / 1000, a = (Math.sin(t * 2) * 0.5 + 0.5) * Math.PI / 2;
  const hw = Math.min(W - 16, 170), hx = Math.round(W / 2 - hw / 2), hy = Math.round(H / 2 - 44);
  hoja(g, hx, hy, hw, 88, 29, "blanco", t);
  g.save(); g.translate(Math.round(W / 2), hy + 34); g.rotate(a);
  g.fillStyle = TINTA_MANO; g.fillRect(-10, -16, 20, 32); g.fillStyle = "#e9e4dc"; g.fillRect(-8, -13, 16, 24);
  g.restore();
  escribir(g, "GIRÁ EL TELÉFONO", W / 2, hy + 62, "centro");
}
