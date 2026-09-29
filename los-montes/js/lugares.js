"use strict";
// ════════════════════════════════════════════════════════════════════════
// Lugares del valle y lo que hay en cada uno: cabañas (con interior), las
// camionetas, el puente, la mina, el aserradero, el cementerio, el
// campamento, la cueva, la torre caída y la tranquera de salida. También
// dónde van los objetos, las pistas, los secuestrados y los montañeses.
// Cada interior es una zona propia (Colision): se entra por la puerta.
// ════════════════════════════════════════════════════════════════════════
const Lugares = (() => {
  const V = THREE.Vector3;
  let escena, calidad;
  const cabanas = [], camionetas = [], objetos = [], pistas = [], jaulas = [], obstaculos = [], luces = [], puertas = [], zonas = {};
  const faroles = [];

  // ── Materiales ──
  const M = {};
  function mats() {
    M.tronco = new THREE.MeshStandardMaterial({ color: "#7a6048", map: Texturas.madera("#5a4432"), roughness: 0.92 });
    M.tabla = new THREE.MeshStandardMaterial({ color: "#8a7258", map: Texturas.madera("#4e3d2c"), roughness: 0.9 });
    M.techo = new THREE.MeshStandardMaterial({ color: "#3b3834", map: Texturas.madera("#2e2b28"), roughness: 0.95 });
    M.piedra = new THREE.MeshStandardMaterial({ color: "#6a6660", map: Texturas.piedra(), roughness: 0.95 });
    M.oxido = new THREE.MeshStandardMaterial({ color: "#6b4a32", roughness: 0.75, metalness: 0.35 });
    M.chapa = new THREE.MeshStandardMaterial({ color: "#5a5a55", roughness: 0.7, metalness: 0.4 });
    M.goma = new THREE.MeshStandardMaterial({ color: "#161514", roughness: 0.95 });
    M.ventana = new THREE.MeshStandardMaterial({ color: "#2a1c0c", emissive: "#e89a45", emissiveIntensity: 1.6 });
    M.ventanaApagada = new THREE.MeshStandardMaterial({ color: "#0b0d10", roughness: 0.2, metalness: 0.4 });
    M.tela = new THREE.MeshStandardMaterial({ color: "#5c5444", roughness: 1, side: THREE.DoubleSide });
    M.hueso = new THREE.MeshStandardMaterial({ color: "#cfc6b0", roughness: 0.8 });
    M.alambre = new THREE.MeshStandardMaterial({ color: "#6a6a66", roughness: 0.5, metalness: 0.6 });
    M.papel = new THREE.MeshStandardMaterial({ color: "#d8cfb6", emissive: "#2a2618", roughness: 1 });
    M.fuego = new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    M.sangre = new THREE.MeshStandardMaterial({ color: "#2a0806", roughness: 0.4, transparent: true, opacity: 0.85 });
  }
  const caja = (w, h, d, m, x = 0, y = 0, z = 0, padre) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (padre || escena).add(o); return o; };
  const cil = (r1, r2, h, m, x = 0, y = 0, z = 0, padre, seg = 8) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (padre || escena).add(o); return o; };
  const suelo = (x, z) => Math.max(Terreno.altura(x, z), 0);
  function poner(o, x, z, rumbo = 0, dy = 0) { o.position.set(x, suelo(x, z) + dy, z); o.rotation.y = rumbo; escena.add(o); return o; }
  // Un modelo de Rezona si está; si no, lo que arme la función de repuesto.
  function modeloO(n, repuesto) { const o = Modelos.clonar(n); return o || repuesto(); }

  // ── Farol de querosén: luz cálida que el director puede apagar ──
  function farol(x, y, z, padre, intensidad = 6, zona = "ext") {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m = Modelos.clonar("farol"); if (m) g.add(m); else { cil(0.07, 0.09, 0.22, M.oxido, 0, 0.11, 0, g, 6); cil(0.05, 0.05, 0.12, M.ventana, 0, 0.13, 0, g, 6); }
    (padre || escena).add(g);
    const f = { g, base: intensidad, prendido: true, zona, parpadeo: Math.random() * 10, color: 0xffab5c, alcance: 16, pos: new V(), brillo: 1 }; faroles.push(f); return f;
  }

  // ── Cabaña de troncos (repuesto por código) con puerta al frente (+Z) ──
  function cabanaRepuesto(ruina) {
    const g = new THREE.Group(), W = 8, D = 6.2, H = 2.9;
    for (let y = 0.2; y < H; y += 0.34) {
      for (const [x, z, l, rot] of [[0, -D / 2, W, 0], [-W / 2, 0, D, 1.57], [W / 2, 0, D, 1.57]]) { const t = cil(0.18, 0.18, l + 0.5, M.tronco, x, y, z, g, 7); t.rotation.z = 1.57; if (rot) t.rotation.y = 1.57; }
      // Frente con hueco de puerta y ventanas.
      for (const [x0, x1] of [[-W / 2, -0.7], [0.7, W / 2]]) { if (y > 1.1 && y < 2.0) continue; const t = cil(0.18, 0.18, x1 - x0, M.tronco, (x0 + x1) / 2, y, D / 2, g, 7); t.rotation.z = 1.57; }
    }
    // Ventanas del frente (entre troncos) y puerta.
    for (const x of [-2.4, 2.4]) caja(1.1, 0.8, 0.12, M.ventana, x, 1.55, D / 2, g).userData.ventana = true;
    caja(1.2, 2.1, 0.1, M.tabla, 0, 1.05, D / 2 + 0.05, g).userData.puerta = true;
    // Techo a dos aguas (hundido si es ruina).
    for (const s of [-1, 1]) { const t = caja(W + 1.2, 0.14, D / 2 + 1.4, M.techo, 0, H + 0.9, s * (D / 4 + 0.35), g); t.rotation.x = s * (ruina ? 0.2 : 0.55); if (ruina && s > 0) { t.rotation.z = 0.3; t.position.y -= 0.8; } }
    // Hastiales, chimenea de piedra y porche.
    cil(0.55, 0.65, H + 2.8, M.piedra, W / 2 - 1.1, (H + 2.8) / 2, -D / 2 + 0.6, g, 6);
    caja(W, 0.12, 2.2, M.tabla, 0, 0.2, D / 2 + 1.1, g);
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) cil(0.1, 0.1, 2.4, M.tronco, x, 1.3, D / 2 + 2, g, 6);
    caja(W, 0.12, 2.4, M.techo, 0, 2.55, D / 2 + 1.2, g).rotation.x = -0.2;
    return g;
  }
  // Interior de una cabaña: piso, paredes con ventanas, muebles y lo que esconde.
  function interior(c, r) {
    const g = new THREE.Group(), W = 7.4, D = 5.6, H = 2.8; g.visible = false;
    caja(W, 0.1, D, M.tabla, 0, 0.05, 0, g);
    caja(W, 0.1, D, M.techo, 0, H, 0, g);
    for (const [x, z, w, d] of [[0, -D / 2, W, 0.2], [-W / 2, 0, 0.2, D], [W / 2, 0, 0.2, D], [-2.3, D / 2, 2.8, 0.2], [2.3, D / 2, 2.8, 0.2]]) caja(w, H, d, M.tronco, x, H / 2, z, g);
    caja(1.6, 0.8, 0.2, M.tronco, 0, H - 0.4, D / 2, g); // dintel
    for (const x of [-2.4, 2.4]) { const v = caja(1.0, 0.7, 0.05, c.habitada ? M.ventana : M.ventanaApagada, x, 1.55, D / 2 - 0.12, g); v.userData.ventana = true; }
    const zona = "cab" + c.i; zonas[zona] = { tipo: "cabana", c, suelo: c.y, techo: c.y + H, ancho: W, fondo: D };
    const col = (x, z, w, d, tipo = "pared") => Colision.caja(c.x + x * Math.cos(c.rumbo) + z * Math.sin(c.rumbo), c.z - x * Math.sin(c.rumbo) + z * Math.cos(c.rumbo), w, d, c.rumbo, { zona, tipo });
    col(0, -D / 2, W, 0.3); col(-W / 2, 0, 0.3, D); col(W / 2, 0, 0.3, D); col(-2.3, D / 2, 2.8, 0.3); col(2.3, D / 2, 2.8, 0.3);
    // Muebles: mesa, sillas, cama, estantes, cocina a leña. Algunas cabañas, lo que no se tendría que ver.
    caja(1.4, 0.08, 0.9, M.tabla, -1.2, 0.78, -0.2, g); for (const [x, z] of [[-1.8, -0.55], [-0.6, -0.55], [-1.8, 0.15], [-0.6, 0.15]]) caja(0.07, 0.78, 0.07, M.tabla, x, 0.39, z, g); col(-1.2, -0.2, 1.4, 0.9, "mueble");
    caja(0.9, 0.45, 1.9, M.tela, 2.8, 0.3, -1.5, g); col(2.8, -1.5, 0.9, 1.9, "mueble");
    caja(1.8, 1.6, 0.4, M.tabla, -2.6, 0.8, -2.5, g); col(-2.6, -2.5, 1.8, 0.4, "mueble");
    cil(0.35, 0.4, 0.8, M.oxido, 2.9, 0.4, 1.4, g, 8); col(2.9, 1.4, 0.8, 0.8, "mueble");
    if (c.secreto) {
      // Por fuera parece normal. Adentro: ganchos, huesos y ropa de gente que no volvió.
      for (let k = 0; k < 4; k++) { cil(0.01, 0.01, 0.8, M.alambre, -3 + k * 0.5, H - 0.4, -2.5, g, 4); caja(0.08, 0.05, 0.02, M.alambre, -3 + k * 0.5, H - 0.82, -2.5, g); }
      for (let k = 0; k < 6; k++) { const h = caja(0.3 + r() * 0.3, 0.05, 0.05, M.hueso, (r() - 0.5) * 5, 0.13, (r() - 0.5) * 3.5, g); h.rotation.y = r() * 3; }
      const mancha = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16).rotateX(-Math.PI / 2), M.sangre); mancha.position.set(0.5, 0.11, 0.9); g.add(mancha);
      for (let k = 0; k < 5; k++) caja(0.3, 0.2, 0.2, [M.tela, M.goma, M.chapa][k % 3], -2.8 + k * 0.4, 1.7, -2.5, g); // mochilas y zapatillas en el estante
    }
    g.position.set(c.x, c.y, c.z); g.rotation.y = c.rumbo; escena.add(g);
    const luz = farol(-1.2, 0.85, -0.2, g, c.habitada ? 5 : 3, zona);
    return { g, zona, luz };
  }
  function cabana(i, x, z, rumbo, extra = {}) {
    const y = suelo(x, z), r = azar(100 + i);
    const c = { i, x, z, y, rumbo, habitada: !!extra.habitada, secreto: !!extra.secreto, ruina: !!extra.ruina, nombre: extra.nombre || "cabana" };
    const ext = modeloO(extra.ruina ? "cabana_ruina" : "cabana", () => cabanaRepuesto(extra.ruina));
    ext.position.set(x, y, z); ext.rotation.y = rumbo; escena.add(ext); c.ext = ext;
    c.ventanas = []; ext.traverse((o) => { if (o.userData && o.userData.ventana) c.ventanas.push(o); });
    // Luz de ventana desde afuera (cálida) si está habitada.
    if (c.habitada) { const f = { g: null, base: 7, prendido: true, zona: "ext", parpadeo: i, color: 0xff9f4a, alcance: 14, pos: new V(x + Math.sin(rumbo) * 3.6, y + 1.6, z + Math.cos(rumbo) * 3.6), brillo: 1, cab: c }; faroles.push(f); c.luzVentana = f; }
    Colision.caja(x, z, 8.6, 6.8, rumbo, { tipo: "cabana", dueno: c });
    c.int = interior(c, r);
    // La puerta, en el porche.
    const px = x + Math.sin(rumbo) * 3.9, pz = z + Math.cos(rumbo) * 3.9;
    puertas.push({ x: px, z: pz, rumbo, zonaFuera: "ext", zonaDentro: c.int.zona, cab: c, dentro: { x: x + Math.sin(rumbo) * 2.1, z: z + Math.cos(rumbo) * 2.1 }, fuera: { x: x + Math.sin(rumbo) * 4.9, z: z + Math.cos(rumbo) * 4.9 }, trabada: !!extra.trabada, yawDentro: rumbo, yawFuera: rumbo + Math.PI });
    cabanas.push(c); return c;
  }

  // ── Camionetas ──
  function camionetaRepuesto(vieja) {
    const g = new THREE.Group(), pint = new THREE.MeshStandardMaterial({ color: vieja ? "#4a3d2e" : "#5d5a3c", roughness: 0.6, metalness: 0.3 });
    caja(1.9, 0.5, 5.0, M.oxido, 0, 0.75, 0, g);
    caja(1.9, 0.9, 1.8, pint, 0, 1.45, 1.5, g); caja(1.8, 0.75, 1.6, pint, 0, 1.3, 2.3, g).scale.set(1, 0.8, 1);
    caja(1.7, 0.55, 1.2, M.ventanaApagada, 0, 1.75, 1.15, g);
    caja(1.9, 0.4, 2.7, pint, 0, 1.2, -1.1, g);
    for (const [x, z] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.5], [0.95, -1.5]]) { if (vieja && z < 0 && x > 0) continue; const w = cil(0.42, 0.42, 0.3, M.goma, x, 0.42, z, g, 12); w.rotation.z = 1.57; }
    for (const x of [-0.6, 0.6]) { const f = caja(0.25, 0.18, 0.05, new THREE.MeshStandardMaterial({ color: "#222", emissive: "#000" }), x, 1.25, 3.05, g); f.userData.faro = true; }
    return g;
  }
  function gruaRepuesto() {
    const g = new THREE.Group(), amar = new THREE.MeshStandardMaterial({ color: "#8a7630", roughness: 0.6, metalness: 0.4 });
    const base = new THREE.Group(); g.add(base); cil(0.45, 0.55, 0.6, amar, 0, 0.3, 0, base, 10);
    const pluma = new THREE.Group(); pluma.position.y = 0.7; base.add(pluma);
    caja(0.35, 0.35, 4.2, amar, 0, 0, 2.0, pluma); caja(0.2, 0.2, 2.5, M.chapa, 0, 0.3, 1.2, pluma);
    const punta = new THREE.Group(); punta.position.set(0, 0, 4.1); pluma.add(punta);
    g.userData.base = base; g.userData.pluma = pluma; g.userData.punta = punta; return g;
  }
  function camioneta(i, x, z, rumbo, tipo, extra = {}) {
    const y = suelo(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rumbo; escena.add(g);
    const cuerpo = modeloO(tipo, () => camionetaRepuesto(tipo === "camioneta_vieja")); g.add(cuerpo);
    const k = { i, tipo, g, x, z, y, rumbo, vel: 0, dir: 0, rota: extra.rota ?? true, faltan: extra.faltan || [], caliente: !!extra.caliente, combustible: extra.combustible ?? 0, grua: null, faros: [] };
    if (tipo === "camioneta_grua") {
      const gr = Modelos.clonar("grua");
      let base, pluma, punta;
      if (gr) { base = new THREE.Group(); base.add(gr); pluma = gr; punta = new THREE.Group(); punta.position.set(0, 1.8, 3.2); gr.add(punta); }
      else { const r = gruaRepuesto(); base = r.userData.base; pluma = r.userData.pluma; punta = r.userData.punta; base.parent.remove(base); }
      base.position.set(0, 1.35, -1.6); g.add(base);
      // Gancho y cable (el cable se estira cada cuadro).
      const gancho = new THREE.Group(); caja(0.14, 0.3, 0.14, M.chapa, 0, -0.15, 0, gancho); escena.add(gancho);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), M.alambre); escena.add(cable);
      k.grua = { base, pluma, punta, gancho, cable, giro: 0, alza: 0.35, largo: 3, colgado: null };
    }
    // Faros: luces que se prenden si arranca (o solas, de noche, en la del motor caliente).
    k.farosPrendidos = false;
    const L = Modelos.listos[tipo];
    k.largo = L ? L.tam.z : 5; k.ancho = L ? L.tam.x : 1.9;
    k.col = Colision.caja(x, z, k.ancho + 0.2, k.largo, rumbo, { tipo: "camioneta", alto: 1.1, dueno: k });
    camionetas.push(k); return k;
  }

  // ── Obstáculos que mueve la grúa: troncos caídos sobre la ruta ──
  function troncoCaido(x, z, rumbo, id) {
    const o = modeloO("tronco", () => { const g = new THREE.Group(); const t = cil(0.55, 0.65, 9, M.tronco, 0, 0, 0, g, 9); t.rotation.x = 1.57; for (let k = 0; k < 4; k++) { const r = cil(0.08, 0.14, 1.5, M.tronco, (k % 2 ? 0.5 : -0.5), 0.3, -3 + k * 2, g, 5); r.rotation.z = k % 2 ? -0.8 : 0.8; } return g; });
    const y = suelo(x, z) + 0.55; o.position.set(x, y, z); o.rotation.y = rumbo; escena.add(o);
    const col = Colision.caja(x, z, 1.3, 9, rumbo, { tipo: "tronco", alto: 1.2 });
    const ob = { id, o, x, z, y, rumbo, col, levantable: true, suelto: false, peso: 1 }; obstaculos.push(ob); return ob;
  }

  // ── Puente del claro ──
  function puente() {
    const P = MAPA.puente, g = new THREE.Group(), L = P.largo, y0 = 1.6;
    for (let k = -L / 2; k < L / 2; k += 0.42) { const t = caja(3.2, 0.1, 0.36, M.tabla, 0, y0, k, g); t.rotation.z = (Math.random() - 0.5) * 0.04; }
    for (const s of [-1, 1]) {
      caja(0.14, 0.14, L, M.tronco, s * 1.65, y0 + 0.95, 0, g); caja(0.2, 0.3, L, M.tronco, s * 1.4, y0 - 0.2, 0, g);
      for (let k = -L / 2; k <= L / 2; k += 2.5) cil(0.1, 0.1, 1.1, M.tronco, s * 1.65, y0 + 0.45, k, g, 6);
    }
    for (const k of [-L / 2 + 2, 0, L / 2 - 2]) for (const s of [-1, 1]) cil(0.22, 0.26, 4, M.tronco, s * 1.3, y0 - 2, k, g, 7);
    // El puente cruza el río de oeste a este: se gira 90°.
    g.position.set(P.x, 0, P.z); g.rotation.y = Math.PI / 2; escena.add(g);
    for (const s of [-1, 1]) Colision.caja(P.x, P.z + s * 1.75, L, 0.3, 0, { tipo: "baranda" });
    zonas.puente = { x: P.x, z: P.z, y: y0 + 0.05, medio: L / 2, ancho: 1.6 };
  }

  // ── La mina: la entrada en la ladera y los túneles (zona "mina", bajo tierra) ──
  const MINA = { x: -700, z: -60, y: -60 }; // el interior está lejos y abajo: nada del valle se ve adentro
  function mina(r) {
    const L = MAPA.lugares.mina, ex = L.x - 18, ez = L.z, ey = suelo(ex, ez), rumbo = Math.PI / 2;
    const ent = modeloO("mina_entrada", () => {
      const g = new THREE.Group();
      for (const s of [-1, 1]) cil(0.22, 0.25, 4.2, M.tronco, s * 1.8, 2.1, 0, g, 7);
      const d = cil(0.22, 0.22, 4.4, M.tronco, 0, 4.2, 0, g, 7); d.rotation.z = 1.57;
      caja(3.4, 3.9, 0.3, new THREE.MeshBasicMaterial({ color: "#000" }), 0, 2, -0.3, g);
      const m = caja(12, 9, 5, M.piedra, 0, 3.5, -3, g); m.scale.set(1, 1, 1);
      caja(4.4, 0.4, 0.3, M.tabla, 0, 4.7, 0.2, g).rotation.z = 0.08; return g;
    });
    ent.position.set(ex, ey, ez); ent.rotation.y = rumbo; escena.add(ent);
    Colision.caja(ex - 3, ez, 6, 12, 0, { tipo: "roca" });
    // Vías que salen de la boca y una vagoneta volcada.
    for (let k = 0; k < 14; k++) caja(0.2, 0.08, 1.4, M.tabla, ex + 2 + k * 0.8, suelo(ex + 2 + k * 0.8, ez) + 0.04, ez, null);
    const vag = modeloO("vagoneta", () => { const g = new THREE.Group(); caja(1, 0.7, 1.6, M.oxido, 0, 0.6, 0, g); return g; }); poner(vag, ex + 12, ez + 2.5, 0.6); vag.rotation.z = 0.5;
    puertas.push({ x: ex + 1.8, z: ez, rumbo, zonaFuera: "ext", zonaDentro: "mina", dentro: { x: MINA.x + 2, z: MINA.z }, fuera: { x: ex + 4.5, z: ez }, bajo: true, yawDentro: -Math.PI / 2, yawFuera: -Math.PI / 2 });
    // Túneles: una red de galerías con puntales, vías y goteras. Todo en la zona "mina".
    const tramos = [[0, 0, 60, 0], [60, 0, 60, 45], [60, 45, 105, 45], [30, 0, 30, -40], [30, -40, 75, -40], [105, 45, 105, 10]];
    zonas.mina = { tipo: "mina", suelo: MINA.y, tramos: tramos.map(([a, b, c, d]) => [MINA.x + a, MINA.z + b, MINA.x + c, MINA.z + d]) };
    const g = new THREE.Group(); g.visible = false; escena.add(g); zonas.mina.grupo = g;
    const W = 3.6, H = 3.2;
    for (const [a, b, c, d] of zonas.mina.tramos) {
      const lx = c - a, lz = d - b, l = Math.hypot(lx, lz), rot = Math.atan2(lx, lz), cx = (a + c) / 2, cz = (b + d) / 2;
      const t = new THREE.Group(); t.position.set(cx, MINA.y, cz); t.rotation.y = rot; g.add(t);
      caja(W, 0.2, l + W, M.piedra, 0, -0.1, 0, t); caja(W + 1, 0.4, l + W, M.piedra, 0, H + 0.2, 0, t);
      const otros = zonas.mina.tramos.filter((q) => q[0] !== a || q[1] !== b || q[2] !== c || q[3] !== d);
      for (let k = -l / 2 - W / 2; k < l / 2 + W / 2; k += 1.5) for (const s of [-1, 1]) {
        const lxw = s * (W / 2 + 0.25), wx = cx + Math.cos(rot) * lxw + Math.sin(rot) * (k + 0.75), wz = cz - Math.sin(rot) * lxw + Math.cos(rot) * (k + 0.75);
        if (otros.some(([p, q, u, w2]) => Terreno.aLinea(wx, wz, [[p, q], [u, w2]]).d < W / 2 + 0.2)) continue;
        caja(0.5, H, 1.52, M.piedra, lxw, H / 2, k + 0.75, t);
      }
      for (let k = -l / 2; k <= l / 2; k += 3.2) { for (const s of [-1, 1]) cil(0.13, 0.13, H, M.tronco, s * (W / 2 - 0.15), H / 2, k, t, 6); const d2 = caja(W, 0.22, 0.25, M.tronco, 0, H - 0.1, k, t); d2.rotation.z = (r() - 0.5) * 0.08; }
      for (let k = -l / 2; k < l / 2; k += 0.9) caja(1.2, 0.06, 0.16, M.tabla, 0, 0.05, k, t);
      for (const s of [-0.5, 0.5]) caja(0.06, 0.06, l, M.oxido, s, 0.1, 0, t);
    }
    for (const [x, z] of [[MINA.x + 20, MINA.z], [MINA.x + 60, MINA.z + 25], [MINA.x + 95, MINA.z + 45], [MINA.x + 50, MINA.z - 40]]) farol(x, MINA.y + 2.3, z + 1.5, null, 3.5, "mina");
    // Lo que hay en el fondo: huesos viejos y el "altar".
    for (let k = 0; k < 20; k++) { const h = caja(0.25 + r() * 0.35, 0.06, 0.06, M.hueso, MINA.x + 100 + r() * 8 - 4, MINA.y + 0.1, MINA.z + 45 + r() * 3 - 1.5, g); h.rotation.y = r() * 3; }
    return { ex, ez };
  }
  // ── La cueva, detrás de la cascada chica ──
  const CUEVA = { x: 700, z: -300, y: -40 };
  function cueva(r) {
    const C = MAPA.cascadas[1], ex = C.x + 10, ez = C.z + 6, ey = suelo(ex, ez);
    caja(3, 3, 0.4, new THREE.MeshBasicMaterial({ color: "#000" }), ex, ey + 1.5, ez - 0.5, null);
    puertas.push({ x: ex, z: ez + 1, rumbo: 0, zonaFuera: "ext", zonaDentro: "cueva", dentro: { x: CUEVA.x, z: CUEVA.z + 12 }, fuera: { x: ex, z: ez + 3.5 }, bajo: true, yawDentro: 0, yawFuera: Math.PI });
    const g = new THREE.Group(); g.visible = false; escena.add(g);
    zonas.cueva = { tipo: "cueva", suelo: CUEVA.y, grupo: g, centro: [CUEVA.x, CUEVA.z], radio: 13 };
    const sala = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 12, 0, 6.3, 0, 1.7), new THREE.MeshStandardMaterial({ color: "#3a3835", map: Texturas.piedra(), roughness: 1, side: THREE.BackSide }));
    sala.scale.set(1, 0.42, 1); sala.position.set(CUEVA.x, CUEVA.y, CUEVA.z); g.add(sala);
    const piso = new THREE.Mesh(new THREE.CircleGeometry(14, 24).rotateX(-Math.PI / 2), M.piedra); piso.position.set(CUEVA.x, CUEVA.y + 0.02, CUEVA.z); g.add(piso);
    for (let k = 0; k < 12; k++) { const e = cil(0.02, 0.35, 1.5 + r() * 1.5, M.piedra, CUEVA.x + (r() - 0.5) * 18, CUEVA.y + 5, CUEVA.z + (r() - 0.5) * 18, g, 5); e.rotation.x = Math.PI; }
    farol(CUEVA.x - 4, CUEVA.y + 0.2, CUEVA.z - 3, null, 3, "cueva");
  }

  // ── Aserradero: galpón abierto de chapa y madera, la sierra y los troncos ──
  function aserradero(r) {
    const A = MAPA.lugares.aserradero, y = suelo(A.x, A.z), g = new THREE.Group(); g.position.set(A.x, y, A.z); g.rotation.y = -0.2; escena.add(g);
    const W = 24, D = 14, H = 6;
    for (let x = -W / 2; x <= W / 2; x += 4) for (const z of [-D / 2, D / 2]) cil(0.2, 0.22, H, M.tronco, x, H / 2, z, g, 6);
    for (const s of [-1, 1]) { const t = caja(W + 2, 0.1, D / 2 + 1.2, M.chapa, 0, H + 1.2, s * D / 4, g); t.rotation.x = s * 0.32; }
    caja(W, H * 0.6, 0.15, M.chapa, 0, H * 0.3, -D / 2, g);
    const sierra = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 32), M.chapa); sierra.rotation.x = 1.57; sierra.position.set(0, 1.9, 0); g.add(sierra);
    caja(9, 0.9, 1.2, M.tabla, 0, 0.9, 0, g);
    for (let k = 0; k < 7; k++) { const t = cil(0.35, 0.4, 6, M.tronco, -8 + (k % 3) * 0.8, 0.4 + Math.floor(k / 3) * 0.7, 4 + (k % 2) * 0.1, g, 8); t.rotation.z = 1.57; }
    const L = new THREE.Vector3();
    const col = (x, z, w, d, tipo = "pared") => { L.set(x, 0, z).applyAxisAngle(new V(0, 1, 0), g.rotation.y); Colision.caja(A.x + L.x, A.z + L.z, w, d, g.rotation.y, { tipo }); };
    col(0, -D / 2, W, 0.4); col(0, 0, 9, 1.4, "mueble"); col(-7.6, 4, 3, 6.5, "mueble");
    // El galpón cerrado de atrás (modelo de Rezona, si está).
    const galpon = Modelos.clonar("aserradero"); if (galpon) { poner(galpon, A.x - 8, A.z - 26, -0.2); Colision.caja(A.x - 8, A.z - 26, 22, 12, -0.2, { tipo: "cabana" }); }
    const torre = Modelos.clonar("torre_agua"); if (torre) { poner(torre, A.x + 22, A.z - 12); Colision.circulo(A.x + 22, A.z - 12, 2.2, "roca"); }
    farol(3, 1.4, 0.5, g, 5);
    // Un camión forestal viejo, para esconderse detrás.
    const cm = Modelos.clonar("camion_maderero"); if (cm) { poner(cm, A.x + 18, A.z + 14, 1.2); Colision.caja(A.x + 18, A.z + 14, 2.6, 8.5, 1.2, { tipo: "camioneta" }); }
    return g;
  }

  // ── Cementerio improvisado ──
  function cementerio(r) {
    const C = MAPA.lugares.cementerio;
    for (let k = 0; k < 22; k++) {
      const x = C.x + (k % 6 - 2.5) * 2.6 + (r() - 0.5), z = C.z + (Math.floor(k / 6) - 1.5) * 3 + (r() - 0.5);
      const g = new THREE.Group(); const alto = 1 + r() * 0.5; caja(0.1, alto, 0.08, M.tabla, 0, alto / 2, 0, g); caja(0.6, 0.09, 0.08, M.tabla, 0, alto * 0.72, 0, g);
      g.rotation.z = (r() - 0.5) * 0.35; poner(g, x, z, (r() - 0.5) * 0.4);
      const monticulo = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6, 0, 6.3, 0, 1.2), new THREE.MeshStandardMaterial({ color: "#2b261e", roughness: 1 }));
      monticulo.scale.set(0.55, 0.22, 1.1); poner(monticulo, x, z + 1.2, 0, -0.05);
    }
    const cr = Modelos.clonar("cruces"); if (cr) poner(cr, C.x + 12, C.z - 6, 0.3);
    // Una cruz nueva, con tierra removida.
    farol(C.x - 8, suelo(C.x - 8, C.z + 6) + 0.1, C.z + 6, null, 2.5);
  }

  // ── Campamento de los montañeses (lo más hondo del bosque) ──
  function campamento(r) {
    const C = MAPA.lugares.campamento, y = suelo(C.x, C.z);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 6.28 + 0.3, x = C.x + Math.cos(a) * 14, z = C.z + Math.sin(a) * 14;
      const t = modeloO("tienda", () => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 6, 1, true), M.tela); c.position.y = 1.3; c.castShadow = true; g.add(c); return g; });
      poner(t, x, z, -a + 1.57); Colision.circulo(x, z, 2.1, "cabana");
    }
    // Fogata grande, con un trípode.
    const fg = new THREE.Group(); fg.position.set(C.x, y, C.z); escena.add(fg);
    for (let k = 0; k < 8; k++) { const t = cil(0.08, 0.1, 1.2, M.tronco, Math.cos(k) * 0.4, 0.15, Math.sin(k) * 0.4, fg, 5); t.rotation.z = 1.4; t.rotation.y = k; }
    const llama = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8, 1, true), M.fuego); llama.position.y = 0.8; fg.add(llama);
    faroles.push({ g: null, base: 16, prendido: true, zona: "ext", parpadeo: 0, fuego: llama, color: 0xff8a3a, alcance: 30, pos: new V(C.x, y + 1.4, C.z), brillo: 1 });
    Colision.circulo(C.x, C.z, 1.3, "roca");
    for (const s of [-1, 1]) { const p = cil(0.05, 0.05, 2.4, M.tronco, s * 1.1, 1.2, 0, fg, 4); p.rotation.z = s * 0.35; }
    // Tótems: palos con cráneos de ciervo (y algo más). Marcan el territorio.
    for (let k = 0; k < 8; k++) {
      const a = r() * 6.28, d = 20 + r() * 30, x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
      const g = new THREE.Group(); cil(0.06, 0.08, 2.6, M.tronco, 0, 1.3, 0, g, 5);
      const cr = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.hueso); cr.position.y = 2.7; cr.scale.set(1, 0.8, 1.4); g.add(cr);
      for (const s of [-1, 1]) { const as = cil(0.015, 0.03, 0.6, M.hueso, s * 0.2, 3.0, 0, g, 4); as.rotation.z = -s * 0.6; }
      poner(g, x, z, r() * 6);
    }
  }
  function jaula(x, z, zona = "ext", yBase = null, extra = {}) {
    const y = yBase ?? suelo(x, z), g = new THREE.Group(); g.position.set(x, y, z); escena.add(g);
    const m = Modelos.clonar("jaula");
    if (m) g.add(m);
    else { caja(2, 0.1, 2, M.tabla, 0, 0.05, 0, g); caja(2, 0.1, 2, M.tabla, 0, 2.1, 0, g); for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28; cil(0.04, 0.04, 2.1, M.tronco, Math.cos(a) * 1.4 * 0.71, 1.05, Math.sin(a) * 1.4 * 0.71, g, 4); } }
    const j = { x, z, y, zona, g, abierta: false, candado: extra.candado ?? true, sobreviviente: null, colgada: !!extra.colgada };
    j.col = Colision.caja(x, z, 2.1, 2.1, 0, { zona, tipo: "jaula", dueno: j });
    if (zona !== "ext") { const zg = zonas[zona] && zonas[zona].grupo; if (zg) { escena.remove(g); zg.add(g); } }
    jaulas.push(j); return j;
  }

  // ── Torre caída del guardaparques y la tranquera de salida ──
  function torre(r) {
    const T = MAPA.lugares.torre, g = new THREE.Group();
    for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) cil(0.13, 0.16, 11, M.tronco, x, 5.5, z, g, 6);
    caja(4.2, 2.4, 4.2, M.tabla, 0, 12, 0, g); caja(4.8, 0.2, 4.8, M.techo, 0, 13.4, 0, g);
    g.rotation.z = 1.25; poner(g, T.x, T.z, 0.4, 1.6); Colision.caja(T.x + 6, T.z - 2, 14, 5, 0.4, { tipo: "cabana" });
  }
  function salida() {
    const S = MAPA.lugares.salida, y = suelo(S.x, S.z), g = new THREE.Group(); g.position.set(S.x, y, S.z); escena.add(g);
    for (const s of [-1, 1]) cil(0.22, 0.25, 2.2, M.tronco, s * 4.2, 1.1, 0, g, 7);
    const tq = new THREE.Group(); g.add(tq); for (let k = 0; k < 5; k++) caja(8, 0.12, 0.08, M.tabla, 0, 0.35 + k * 0.3, 0, tq); caja(0.1, 1.6, 0.1, M.tabla, 0, 1, 0, tq);
    const cad = cil(0.05, 0.05, 0.5, M.alambre, 0, 1.1, 0.1, g, 6); cad.rotation.z = 1.57;
    const col = Colision.caja(S.x, S.z, 9, 0.5, 0, { tipo: "tranquera" });
    zonas.salida = { g, tq, col, abierta: false, x: S.x, z: S.z };
    // Cartel viejo de la maderera.
    const c = new THREE.Group(); caja(2.4, 1, 0.08, M.tabla, 0, 2.2, 0, c); cil(0.07, 0.07, 2.2, M.tronco, -1, 1.1, 0, c, 5); cil(0.07, 0.07, 2.2, M.tronco, 1, 1.1, 0, c, 5); poner(c, S.x + 7, S.z - 3, 0.4);
  }

  // ════════ Contenido: objetos, pistas, secuestrados ════════
  // tipo de objeto: arma, municion (por arma), botiquin, venda, bateria, bidon, lata, herramientas, repuesto, rueda.
  function objeto(tipo, x, z, zona = "ext", extra = {}) {
    const y = extra.y ?? (zona === "ext" ? suelo(x, z) : (zonas[zona] ? zonas[zona].suelo ?? zonas[zona].c?.y : 0));
    const nombreModelo = { botiquin: "botiquin", venda: "botiquin", bateria: "bateria", bidon: "bidon", lata: "lata", herramientas: "herramientas", repuesto: "repuesto", municion: "municion", pistola: "pistola", escopeta: "escopeta", rifle: "rifle", hacha: "hacha" }[tipo];
    let m = nombreModelo ? Modelos.clonar(nombreModelo) : null;
    if (!m) {
      const col = { botiquin: "#b52a22", venda: "#e0ddd2", bateria: "#c8a23a", bidon: "#7a2a1a", lata: "#8a8a80", herramientas: "#9a3a1a", repuesto: "#2a2a2a", municion: "#6a5a2a", rueda: "#111", pistola: "#222", escopeta: "#3a2a1a", rifle: "#3a2a1a", hacha: "#6b5a3a" }[tipo] || "#777";
      const dim = { bidon: [0.3, 0.45, 0.2], repuesto: [0.3, 0.22, 0.18], herramientas: [0.5, 0.2, 0.22], rueda: [0.7, 0.7, 0.25], escopeta: [0.12, 0.08, 1.0], rifle: [0.12, 0.08, 1.1], hacha: [0.1, 0.05, 0.7] }[tipo] || [0.22, 0.14, 0.16];
      m = new THREE.Mesh(new THREE.BoxGeometry(...dim), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.2 })); m.position.y = dim[1] / 2; m.castShadow = true;
      if (tipo === "rueda") m.rotation.x = 1.57;
    }
    const g = new THREE.Group(); g.add(m); g.position.set(x, y + (extra.alto || 0), z); g.rotation.y = Math.random() * 6;
    const padre = zona === "ext" ? escena : (zonas[zona] && (zonas[zona].grupo || zonas[zona].c?.int?.g));
    if (padre && padre !== escena) { g.position.sub(padre.position); if (padre.rotation.y) g.position.applyAxisAngle(new V(0, 1, 0), -padre.rotation.y); padre.add(g); } else escena.add(g);
    const o = { tipo, x, z, y, zona, g, cant: extra.cant || 1, arma: extra.arma, tomado: false }; objetos.push(o); return o;
  }
  function pista(id, x, z, zona = "ext", alto = 0) {
    const y = zona === "ext" ? suelo(x, z) : (zonas[zona].suelo ?? zonas[zona].c.y);
    const g = new THREE.Group(); const hoja = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32).rotateX(-Math.PI / 2), M.papel); hoja.position.y = 0.02; g.add(hoja);
    g.position.set(x, y + alto, z); g.rotation.y = Math.random() * 6;
    const padre = zona === "ext" ? escena : (zonas[zona].grupo || zonas[zona].c.int.g);
    if (padre !== escena) { g.position.sub(padre.position); if (padre.rotation.y) g.position.applyAxisAngle(new V(0, 1, 0), -padre.rotation.y); padre.add(g); } else escena.add(g);
    const p = { id, x, z, y: y + alto, zona, g, leida: false }; pistas.push(p); return p;
  }
  // Punto dentro de una cabaña (coordenadas locales → mundo).
  function enCabana(c, lx, lz) { return [c.x + lx * Math.cos(c.rumbo) + lz * Math.sin(c.rumbo), c.z - lx * Math.sin(c.rumbo) + lz * Math.cos(c.rumbo)]; }

  function montar(esc, cal) {
    escena = esc; calidad = cal; mats();
    const r = azar(1974), L = MAPA.lugares;
    // Las cabañas del claro, como en la referencia: una a la izquierda del camino y otra en la loma.
    const c0 = cabana(0, L.claro.x - 14, L.claro.z - 4, 0.9, { habitada: true, nombre: "claroOeste" });
    const c1 = cabana(1, L.cabanaEste.x, L.cabanaEste.z, -0.5, { habitada: true, secreto: true, nombre: "cabanaEste" });
    const c2 = cabana(2, L.lagoCabana.x, L.lagoCabana.z, 0.3, { habitada: false, nombre: "lagoCabana" });
    const c3 = cabana(3, L.claro.x + 10, L.claro.z - 22, 0.2, { ruina: true, nombre: "claroRuina" });
    const c4 = cabana(4, L.campamento.x - 30, L.campamento.z - 25, 0.8, { habitada: true, secreto: true, nombre: "campCabana", trabada: true });
    const c5 = cabana(5, 250, -90, -1.2, { habitada: true, nombre: "cabanaNorte" });
    const c6 = cabana(6, -250, 250, 1.8, { ruina: true, nombre: "cabanaBosque" });
    // Las camionetas del claro: la de la grúa (rota), una abandonada y una con el motor todavía caliente.
    const kGrua = camioneta(0, L.claro.x + 8, L.claro.z + 8, -2.3, "camioneta_grua", { rota: true, faltan: ["repuesto", "rueda", "bidon"] });
    const kVieja = camioneta(1, L.claro.x - 20, L.claro.z + 14, 0.4, "camioneta_vieja", { rota: true, faltan: ["todo"] });
    const kCaliente = camioneta(2, L.claro.x + 22, L.claro.z - 8, 1.9, "camioneta_grua", { rota: true, caliente: true, faltan: ["llave"] });
    camioneta(3, L.aserradero.x - 20, L.aserradero.z + 20, 0.9, "camioneta_vieja", { rota: true, faltan: ["todo"] });
    camioneta(4, -330, 70, 2.6, "camioneta_vieja", { rota: true, faltan: ["todo"] });
    puente(); mina(r); cueva(r); aserradero(r); cementerio(r); campamento(r); torre(r); salida();
    // Troncos caídos: cortan el ramal de la mina y la ruta de salida. Se sacan con la grúa.
    troncoCaido(-262, 110, 0.6, "troncoMina"); troncoCaido(-10, 620, 1.35, "troncoSalida1"); troncoCaido(-2, 640, 1.5, "troncoSalida2");
    // Faroles del claro y del porche.
    farol(L.claro.x - 1, suelo(L.claro.x - 1, L.claro.z + 2) + 1.4, L.claro.z + 2, null, 5);
    farol(MAPA.puente.x + 11, suelo(MAPA.puente.x + 11, MAPA.puente.z) + 1.5, MAPA.puente.z, null, 4.5);
    // ── Secuestrados ──
    const JAULAS = [
      jaula(L.campamento.x + 6, L.campamento.z - 3), jaula(L.campamento.x - 5, L.campamento.z + 6),
      jaula(MINA.x + 102, MINA.z + 45, "mina", MINA.y), jaula(L.aserradero.x + 4, L.aserradero.z + 9, "ext", null, { colgada: true }),
      jaula(CUEVA.x + 5, CUEVA.z - 4, "cueva", CUEVA.y, { candado: false }),
    ];
    // Uno más, atado adentro de la cabaña del lago (sin jaula).
    const [lx, lz] = enCabana(c2, 2.6, -1.8);
    // ── Objetos ──
    objeto("hacha", L.claro.x - 3, L.claro.z + 6, "ext");
    objeto("pistola", ...enCabana(c0, -1.2, -0.2), c0.int.zona, { alto: 0.83, cant: 8 });
    objeto("bateria", ...enCabana(c0, -2.5, -2.4), c0.int.zona, { alto: 0.9 });
    objeto("lata", ...enCabana(c0, -2.8, -2.4), c0.int.zona, { alto: 1.5 });
    objeto("botiquin", ...enCabana(c3, 1, -1), c3.int.zona);
    objeto("municion", ...enCabana(c3, -2, 1), c3.int.zona, { arma: "pistola", cant: 12 });
    objeto("herramientas", ...enCabana(c1, 2.8, 1.4), c1.int.zona, { alto: 0.85 });
    objeto("escopeta", ...enCabana(c1, -2.6, -2.5), c1.int.zona, { alto: 1.2, cant: 4 });
    objeto("rueda", L.claro.x - 22, L.claro.z + 18, "ext");
    objeto("repuesto", L.aserradero.x + 2, L.aserradero.z - 4, "ext", { alto: 0.95 });
    objeto("bidon", L.aserradero.x - 10, L.aserradero.z + 3, "ext");
    objeto("bidon", L.mina.x + 14, L.mina.z - 6, "ext");
    objeto("rifle", MINA.x + 58, MINA.z + 44, "mina", { cant: 5 });
    objeto("municion", MINA.x + 30, MINA.z - 38, "mina", { arma: "rifle", cant: 10 });
    objeto("municion", ...enCabana(c5, -2.5, -2.5), c5.int.zona, { arma: "escopeta", cant: 6, alto: 1.6 });
    objeto("botiquin", ...enCabana(c5, 2.8, -1.5), c5.int.zona, { alto: 0.55 });
    objeto("bateria", CUEVA.x - 3, CUEVA.z - 5, "cueva");
    objeto("lata", ...enCabana(c2, -1.2, -0.2), c2.int.zona, { alto: 0.83 });
    objeto("venda", ...enCabana(c2, -2.6, -2.5), c2.int.zona, { alto: 1.2 });
    objeto("municion", L.cementerio.x - 6, L.cementerio.z + 5, "ext", { arma: "pistola", cant: 10 });
    objeto("bateria", MAPA.lugares.torre.x + 4, MAPA.lugares.torre.z + 3, "ext");
    objeto("venda", L.campamento.x - 12, L.campamento.z + 8, "ext");
    objeto("lata", ...enCabana(c6, 0, 0), c6.int.zona);
    objeto("municion", ...enCabana(c6, 2.5, -2), c6.int.zona, { arma: "escopeta", cant: 5 });
    objeto("bateria", L.claro.x + 22, L.claro.z - 5, "ext");
    // ── Pistas: la historia del valle, de 1958 a hoy ──
    pista("p1", L.claro.x + 2, L.claro.z + 4);                      // cartel de la maderera, 1958
    pista("p2", ...enCabana(c0, -1.0, -0.1), c0.int.zona, 0.84);   // carta de un obrero, 1961
    pista("p3", MINA.x + 45, MINA.z + 2, "mina");                  // parte del capataz: la avalancha, 1962
    pista("p4", ...enCabana(c3, 0.5, 1.5), c3.int.zona);           // diario del médico de la compañía, invierno 1963
    pista("p5", L.cementerio.x + 1, L.cementerio.z - 2);           // lista de cruces, 1963–1964
    pista("p6", L.aserradero.x - 3, L.aserradero.z - 2, "ext", 1.0); // recorte de diario: excursionistas perdidos, 1974
    pista("p7", MAPA.lugares.torre.x + 2, MAPA.lugares.torre.z - 1); // libreta de guardaparques, 1989
    pista("p8", ...enCabana(c1, 0.3, 1.0), c1.int.zona);           // fotos de gente que no volvió
    pista("p9", CUEVA.x + 2, CUEVA.z + 3, "cueva");                // dibujos en la roca: "la montaña pide"
    pista("p10", ...enCabana(c5, -1.2, -0.3), c5.int.zona, 0.84);  // denuncia de desaparición, 2003
    pista("p11", L.campamento.x + 2, L.campamento.z - 10);         // el cuaderno del líder
    pista("p12", MINA.x + 104, MINA.z + 46, "mina");               // la última: la lista de nombres, con los de hoy
    return { cabanas, camionetas, jaulas: JAULAS, atado: { x: lx, z: lz, zona: c2.int.zona, y: c2.y }, kGrua, kCaliente, kVieja };
  }
  // En la mina y la cueva no hay paredes para chocar: uno queda adentro de las galerías.
  function restringir(zona, p, radio) {
    const Z = zonas[zona]; if (!Z) return;
    if (Z.tipo === "mina") {
      let mejor = null, dm = 1e9;
      for (const tr of Z.tramos) { const r = Terreno.aLinea(p.x, p.z, [[tr[0], tr[1]], [tr[2], tr[3]]]); if (r.d < dm) { dm = r.d; mejor = tr; } }
      const lim = 1.8 - radio; if (dm <= lim) return;
      const [a, b, c, d] = mejor, dx = c - a, dz = d - b, l2 = dx * dx + dz * dz, t = clamp(((p.x - a) * dx + (p.z - b) * dz) / l2, 0, 1), qx = a + dx * t, qz = b + dz * t;
      p.x = qx + ((p.x - qx) / dm) * lim; p.z = qz + ((p.z - qz) / dm) * lim;
    } else if (Z.tipo === "cueva") {
      const [cx, cz] = Z.centro, d = Math.hypot(p.x - cx, p.z - cz), lim = Z.radio - radio;
      if (d > lim) { p.x = cx + ((p.x - cx) / d) * lim; p.z = cz + ((p.z - cz) / d) * lim; }
    }
  }
  // Pocas luces de verdad (cambiar la cantidad recompila los shaders): las más
  // cercanas de la zona donde está la cámara toman las fuentes de los faroles.
  const pool = [];
  function actualizar(dt, t, cam, zona) {
    if (!pool.length) for (let i = 0; i < { alta: 7, media: 5, baja: 3 }[calidad]; i++) { const L = new THREE.PointLight(0xffab5c, 0, 16, 1.6); escena.add(L); pool.push(L); }
    const cand = [];
    for (const f of faroles) {
      if (f.g) f.g.getWorldPosition(f.pos);
      f.brillo = lerp(f.brillo, f.prendido ? 1 : 0, Math.min(1, dt * (f.prendido ? 2 : 6)));
      if (f.fuego) { f.fuego.visible = f.brillo > 0.1; f.fuego.scale.set(1, 0.9 + 0.2 * Math.sin(t * 9), 1); }
      if (f.zona !== zona || f.brillo < 0.02) continue;
      const d = f.pos.distanceTo(cam); if (d < 90) cand.push([d, f]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    pool.forEach((L, i) => {
      const c = cand[i]; if (!c) { L.intensity = 0; return; }
      const f = c[1], p = 0.88 + 0.12 * Math.sin(t * 13 + f.parpadeo) * Math.sin(t * 7.3 + f.parpadeo * 2);
      L.position.copy(f.pos); L.color.setHex(f.color); L.distance = f.alcance; L.intensity = f.base * p * f.brillo * suave(90, 60, c[0]);
    });
  }
  function apagarCabana(c) {
    c.apagada = true;
    for (const v of c.ventanas) v.material = M.ventanaApagada;
    for (const f of faroles) if (f.zona === c.int.zona || f.cab === c) f.prendido = false;
  }
  return { montar, actualizar, apagarCabana, restringir, objeto, farol, cabanas, camionetas, objetos, pistas, jaulas, obstaculos, faroles, puertas, zonas, MINA, CUEVA, M };
})();
