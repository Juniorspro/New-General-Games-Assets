"use strict";
// ════════════════════════════════════════════════════════════════════════
// Camionetas: la de la grúa se arregla de a poco (batería, rueda, nafta, con
// herramientas) y después se maneja. La grúa saca los troncos de la ruta y
// baja la jaula colgada del aserradero. Otra tiene el motor todavía caliente:
// alguien la usó hace un rato. Las viejas tienen cosas en la guantera.
// ════════════════════════════════════════════════════════════════════════
const Vehiculos = (() => {
  const V = THREE.Vector3;
  let escena, datos, kGrua, kCaliente, manejada = null, enGrua = false, tFaros = 0, farosCaliente = 0, revisadas = new Set();
  const PIEZAS = ["repuesto", "rueda", "bidon"];
  function montar(esc, d) { escena = esc; datos = d; kGrua = d.kGrua; kCaliente = d.kCaliente; }
  function reiniciar() {
    manejada = null; enGrua = false; revisadas = new Set(); farosCaliente = 0;
    for (const k of Lugares.camionetas) { k.vel = 0; k.dir = 0; k.farosPrendidos = false; }
    kGrua.faltan = [...PIEZAS]; kGrua.combustible = 0; kGrua.reparada = false;
    Object.assign(kGrua.grua, { giro: 0, alza: 0.35, largo: 3, colgado: null });
    for (const o of Lugares.obstaculos) { o.suelto = false; o.colgado = false; o.col.activo = true; o.o.position.set(o.x, o.y, o.z); o.o.rotation.set(0, o.rumbo, 0); Colision.mover(o.col, o.x, o.z); }
    const k = kGrua; if (k.g0) { k.g.position.copy(k.g0.p); k.rumbo = k.g0.r; k.g.rotation.set(0, k.rumbo, 0); Colision.mover(k.col, k.g0.p.x, k.g0.p.z, k.rumbo); } else k.g0 = { p: k.g.position.clone(), r: k.rumbo };
    Juego.est.manejando = false; Juego.est.grua = false;
  }
  function estadoGrua() { return { reparada: kGrua.reparada, faltan: kGrua.faltan }; }

  function interacciones(yo) {
    if (yo.zona !== "ext") return [];
    const out = [], J = Juego.est;
    for (const k of Lugares.camionetas) {
      const lado = { x: k.g.position.x + Math.cos(k.rumbo) * 1.6, z: k.g.position.z - Math.sin(k.rumbo) * 1.6 };
      if (k === kGrua) {
        if (!k.reparada) {
          const tiene = k.faltan.find((p) => J.inv[p] > 0);
          if (!J.inv.herramientas) out.push({ ...lado, r: 3.4, tipo: "reparar", texto: T("acc.repararSin", { f: k.faltan.map((p) => T("item." + p)).join(", ") }), hacer() { Juego.aviso(T("av.faltaHerramienta"), "mal"); } });
          else if (tiene) out.push({ ...lado, r: 3.4, tipo: "reparar", mecanica: true, largo: 3.5, texto: T("acc.colocar", { o: T("item." + tiene) }), hacer() { colocar(k, tiene); } });
          else out.push({ ...lado, r: 3.4, tipo: "reparar", texto: T("acc.faltan", { f: k.faltan.map((p) => T("item." + p)).join(", ") }), hacer() { Juego.aviso(T("acc.faltan", { f: k.faltan.map((p) => T("item." + p)).join(", ") }), "info"); } });
        } else out.push({ ...lado, r: 3.4, tipo: "subir", texto: T("acc.subir"), hacer() { subir(k); } });
      } else if (k === kCaliente) {
        out.push({ ...lado, r: 3.4, tipo: "examinar", texto: T("acc.examinar"), hacer() { Juego.subtitulo(T("dice.motorCaliente"), 6, T("quien.yo")); Director.susto(0.2); if (!revisadas.has(k.i)) { revisadas.add(k.i); J.inv.bateria = (J.inv.bateria || 0) + 1; Juego.aviso(T("av.tomaste", { o: T("item.bateria") }), "bien"); } } });
      } else if (!revisadas.has(k.i)) {
        out.push({ ...lado, r: 3.4, tipo: "guantera", largo: 1.5, texto: T("acc.guantera"), hacer() { revisadas.add(k.i); const it = ["municion_pistola", "venda", "lata", "bateria"][k.i % 4]; J.inv[it] = (J.inv[it] || 0) + (it.startsWith("municion") ? 6 : 1); Juego.aviso(T("av.tomaste", { o: T("item." + it) }), "bien"); Sonido.golpe("puerta_auto"); } });
      }
    }
    return out;
  }
  function colocar(k, pieza) {
    const J = Juego.est; J.inv[pieza]--; k.faltan = k.faltan.filter((p) => p !== pieza);
    if (pieza === "bidon") k.combustible = 100;
    Sonido.golpe(pieza === "bidon" ? "bidon" : "herramienta");
    if (!k.faltan.length) { k.reparada = true; Juego.aviso(T("av.reparada"), "bien", 5); Sonido.golpe("motor_arranca"); Juego.ruido(k.g.position.x, k.g.position.z, 60, "ext", "motor"); }
    else Juego.aviso(T("av.faltanPiezas", { f: k.faltan.map((p) => T("item." + p)).join(", ") }), "info", 4);
    Juego.objetivo();
  }
  function subir(k) {
    manejada = k; Juego.est.manejando = true; k.farosPrendidos = true; Sonido.golpe("puerta_auto"); Sonido.motor(true);
    Juego.aviso(TOCABLE ? T("av.manejarTactil") : T("av.manejar"), "info", 5);
  }
  function bajar() {
    if (!manejada) return; const k = manejada;
    const y = Juego.yo; y.x = k.g.position.x + Math.cos(k.rumbo) * 1.8; y.z = k.g.position.z - Math.sin(k.rumbo) * 1.8; y.yaw = k.rumbo + Math.PI;
    manejada = null; enGrua = false; Juego.est.manejando = false; Juego.est.grua = false; k.vel = 0; Sonido.motor(false); Sonido.golpe("puerta_auto");
  }
  function interaccionManejando() {
    const k = manejada; if (!k) return null;
    const x = k.g.position.x, z = k.g.position.z, ref = Aliados.refugio();
    if (Aliados.paraSubir() > 0 && Math.hypot(x - ref.x, z - ref.z) < 22) return { tipo: "subirGente", texto: T("acc.subirGente", { n: Aliados.paraSubir() }), hacer() { const n = Aliados.subir(); Juego.aviso(T("av.aBordo", { n }), "bien", 4); Juego.objetivo(); } };
    if (Math.abs(k.vel) < 0.5) return { tipo: "grua", texto: enGrua ? T("acc.salirGrua") : T("acc.usarGrua"), hacer() { alternarGrua(); } };
    return null;
  }
  function alternarGrua() { enGrua = !enGrua; Juego.est.grua = enGrua; Sonido.grua(enGrua); if (enGrua) Juego.aviso(TOCABLE ? T("av.gruaTactil") : T("av.grua"), "info", 6); }

  // ════ Manejo ════
  const pp = new V(), n = new V(), up = new V(0, 1, 0);
  function actualizar(dt, yo, entrada) {
    // La del motor caliente prende los faros sola, de noche, cuando no la mirás.
    const dC = Math.hypot(yo.x - kCaliente.g.position.x, yo.z - kCaliente.g.position.z);
    if (farosCaliente > 0) farosCaliente -= dt;
    else if (!manejada && yo.zona === "ext" && dC > 35 && dC < 110 && Math.random() < dt * 0.004) { farosCaliente = 2.5 + Math.random() * 2; Sonido.en("motor_arranca", kCaliente.g.position.x, 1, kCaliente.g.position.z, 0.8); }
    if (!manejada) return;
    const k = manejada, t = entrada.teclas;
    if (enGrua) { operarGrua(dt, entrada); return; }
    let ac = (t.KeyW || t.ArrowUp ? 1 : 0) - (t.KeyS || t.ArrowDown ? 1 : 0), gi = (t.KeyA || t.ArrowLeft ? 1 : 0) - (t.KeyD || t.ArrowRight ? 1 : 0);
    if (entrada.mover[0] || entrada.mover[1]) { ac = -entrada.mover[1]; gi = -entrada.mover[0]; }
    const x = k.g.position.x, z = k.g.position.z;
    const enRuta = Terreno.distRuta(x, z) < 5, agua = Terreno.enAgua(x, z), puente = Math.abs(z - MAPA.puente.z) < 2 && Math.abs(x - MAPA.puente.x) < MAPA.puente.largo / 2;
    const vmax = (enRuta || puente ? 15 : 8) * (agua === "rio" && !puente ? 0.12 : agua === "vado" ? 0.5 : 1) * (k.combustible > 0 ? 1 : 0);
    if (ac > 0) k.vel = Math.min(vmax, k.vel + dt * 5 * ac); else if (ac < 0) k.vel = Math.max(-4, k.vel + dt * (k.vel > 0 ? 10 : 3) * ac); else k.vel *= 1 - dt * 0.9;
    if (Math.abs(k.vel) > vmax) k.vel = lerp(k.vel, Math.sign(k.vel) * vmax, dt * 3);
    k.dir = lerp(k.dir, gi * 0.55, Math.min(1, dt * 4));
    k.rumbo += (k.vel / 3.1) * Math.tan(k.dir) * dt;
    k.combustible = Math.max(0, k.combustible - Math.abs(k.vel) * dt * 0.015);
    pp.set(x + Math.sin(k.rumbo) * k.vel * dt, 0, z + Math.cos(k.rumbo) * k.vel * dt);
    // Choca como una caja; si choca fuerte, se frena y hace ruido.
    k.col.activo = false;
    const antes = pp.clone(); const c = Colision.resolver(pp, 1.3, "ext", 0.5); if (c && c.tipo !== "arbol" || c && Math.abs(k.vel) > 6) { if (Math.abs(k.vel) > 4) { Sonido.golpe("choque"); Juego.ruido(x, z, 50, "ext", "choque"); } k.vel *= 0.3; }
    if (c && c.tipo === "tranquera") { k.vel = 0; pp.copy(antes).set(x, 0, z); }
    k.col.activo = true;
    const px = pp.x, pz = pp.z;
    const y = puente ? Lugares.zonas.puente.y : Math.max(Terreno.altura(px, pz), agua ? -0.6 : -99);
    k.g.position.set(px, lerp(k.g.position.y, y, Math.min(1, dt * 10)), pz);
    // Se acomoda a la pendiente.
    n.copy(Terreno.normal(px, pz, 2)); const q = new THREE.Quaternion().setFromUnitVectors(up, puente ? up : n), qr = new THREE.Quaternion().setFromAxisAngle(up, k.rumbo);
    k.g.quaternion.copy(q.multiply(qr));
    Colision.mover(k.col, px, pz, k.rumbo);
    yo.x = px; yo.z = pz; yo.y = y;
    Sonido.motorVel(Math.abs(k.vel) / 15, ac !== 0);
    if (t.KeyH || entrada.bocina) { if (!k.boc) { k.boc = true; Sonido.en("bocina", px, y + 1, pz, 1); Juego.ruido(px, pz, 110, "ext", "bocina"); } } else k.boc = false;
    Juego.ruido(px, pz, 30 + Math.abs(k.vel) * 3, "ext", "motor");
    // Escape: por la tranquera abierta, hacia afuera, con la ruta despejada.
    const S = MAPA.lugares.salida;
    if (Lugares.zonas.salida.abierta && pz > S.z + 4 && Math.abs(px - S.x) < 12) Juego.escapar();
    // Troncos: frenan en seco.
    for (const o of Lugares.obstaculos) if (!o.suelto && !o.colgado && Math.hypot(o.o.position.x - px, o.o.position.z - pz) < 4.2) { k.vel = Math.min(k.vel, 0); }
  }
  // ════ La grúa ════
  const punta = new V();
  function operarGrua(dt, entrada) {
    const k = manejada, G = k.grua; if (!G) { alternarGrua(); return; }
    const t = entrada.teclas;
    let gx = (t.KeyA || t.ArrowLeft ? 1 : 0) - (t.KeyD || t.ArrowRight ? 1 : 0), gy = (t.KeyW || t.ArrowUp ? 1 : 0) - (t.KeyS || t.ArrowDown ? 1 : 0);
    if (entrada.mover[0] || entrada.mover[1]) { gx = -entrada.mover[0]; gy = -entrada.mover[1]; }
    const cable = (t.KeyQ || entrada.cableBaja ? 1 : 0) - (t.KeyR || entrada.cableSube ? 1 : 0);
    G.giro += gx * dt * 0.7; G.alza = clamp(G.alza + gy * dt * 0.4, -0.05, 1.1); G.largo = clamp(G.largo + cable * dt * 2.2, 0.5, 9);
    if (gx || gy || cable) Sonido.gruaMueve(true); else Sonido.gruaMueve(false);
    G.base.rotation.y = G.giro; G.pluma.rotation.x = -G.alza;
    k.g.updateMatrixWorld(true); G.punta.getWorldPosition(punta);
    const piso = Terreno.altura(punta.x, punta.z);
    const gy2 = Math.max(piso + 0.3, punta.y - G.largo);
    G.gancho.position.set(punta.x, gy2, punta.z);
    const med = (punta.y + gy2) / 2; G.cable.position.set(punta.x, med, punta.z); G.cable.scale.y = Math.max(0.1, punta.y - gy2);
    if (G.colgado) {
      const o = G.colgado; o.o.position.set(punta.x, gy2 - 0.6, punta.z);
      if (o.jaula) { o.jaula.g.position.set(o.jaula.x, gy2 - 2.2, o.jaula.z); }
    }
    if (t.KeyE && !G.teclaE || entrada.enganchar) { G.teclaE = true; entrada.enganchar = false; engancharSoltar(G); }
    if (!t.KeyE) G.teclaE = false;
  }
  function engancharSoltar(G) {
    const h = G.gancho.position;
    if (G.colgado) {
      const o = G.colgado; G.colgado = null; Sonido.golpe("cadena");
      if (o.jaula) { Aliados.bajarJaula(o.jaula); Juego.aviso(T("av.jaulaBajada"), "bien"); return; }
      const y = Terreno.altura(h.x, h.z) + 0.55; o.o.position.set(h.x, y, h.z); Colision.mover(o.col, h.x, h.z); o.col.activo = true; o.colgado = false;
      // Sacado de la ruta: el camino queda libre.
      if (Terreno.distRuta(h.x, h.z) > 6) { o.suelto = true; o.col.activo = false; Juego.aviso(T("av.caminoLibre"), "bien", 4); Juego.objetivo(); }
      Juego.ruido(h.x, h.z, 40, "ext", "golpe");
      return;
    }
    // ¿Qué hay cerca del gancho? Un tronco o la jaula colgada del aserradero.
    for (const o of Lugares.obstaculos) if (!o.suelto && Math.hypot(o.o.position.x - h.x, o.o.position.z - h.z) < 2.4 && Math.abs(o.o.position.y - h.y) < 2.5) { G.colgado = o; o.colgado = true; o.col.activo = false; Sonido.golpe("cadena"); Juego.aviso(T("av.enganchado"), "info"); return; }
    for (const j of datos.jaulas) if (j.colgada && Math.hypot(j.x - h.x, j.z - h.z) < 2.5 && Math.abs(j.g.position.y + 2.2 - h.y) < 3) { G.colgado = { o: new THREE.Object3D(), jaula: j }; Sonido.golpe("cadena"); Juego.aviso(T("av.enganchado"), "info"); return; }
    Juego.aviso(T("av.nadaQueEnganchar"), "mal", 2);
  }
  // ════ Cámara ════
  const cObj = new V(), cMira = new V();
  function camara(cam, dt, yo) {
    const k = manejada; if (!k) return;
    const p = k.g.position;
    if (enGrua) { const G = k.grua; cObj.set(p.x + Math.sin(k.rumbo + G.giro + 1.9) * 9, p.y + 6, p.z + Math.cos(k.rumbo + G.giro + 1.9) * 9); cMira.copy(G.gancho.position); }
    else { cObj.set(p.x - Math.sin(k.rumbo) * 8.5, p.y + 3.6, p.z - Math.cos(k.rumbo) * 8.5); cObj.y = Math.max(cObj.y, Terreno.altura(cObj.x, cObj.z) + 1.2); cMira.set(p.x + Math.sin(k.rumbo) * 6, p.y + 1.4, p.z + Math.cos(k.rumbo) * 6); }
    cam.position.lerp(cObj, 1 - Math.exp(-dt * 5)); cam.lookAt(cMira);
    if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
  }
  // Los dos faros de verdad van a la camioneta que se maneja (o a la del motor caliente, cuando se prende sola).
  function faros(pool) {
    const k = manejada && manejada.farosPrendidos ? manejada : farosCaliente > 0 ? kCaliente : null;
    pool.forEach((L, i) => {
      if (!k) { L.intensity = 0; return; }
      const s = i ? 0.6 : -0.6, g = k.g; g.updateMatrixWorld(true);
      L.position.set(s, 1.25, 2.6).applyMatrix4(g.matrixWorld); L.target.position.set(s * 2, 0.2, 18).applyMatrix4(g.matrixWorld);
      L.intensity = k === kCaliente ? (Math.random() < 0.1 ? 0 : 120) : 160;
    });
  }
  function guardar() { return { faltan: kGrua.faltan, reparada: kGrua.reparada, comb: kGrua.combustible, x: kGrua.g.position.x, z: kGrua.g.position.z, rumbo: kGrua.rumbo, obst: Lugares.obstaculos.map((o) => ({ x: o.o.position.x, z: o.o.position.z, suelto: o.suelto })), revisadas: [...revisadas] }; }
  function cargar(g) {
    if (!g) return; kGrua.faltan = g.faltan; kGrua.reparada = g.reparada; kGrua.combustible = g.comb; kGrua.rumbo = g.rumbo; kGrua.g.position.set(g.x, Terreno.altura(g.x, g.z), g.z); kGrua.g.rotation.y = g.rumbo; Colision.mover(kGrua.col, g.x, g.z, g.rumbo);
    g.obst.forEach((s, i) => { const o = Lugares.obstaculos[i]; if (!o) return; o.o.position.set(s.x, Terreno.altura(s.x, s.z) + 0.55, s.z); o.suelto = s.suelto; Colision.mover(o.col, s.x, s.z); o.col.activo = !s.suelto; });
    revisadas = new Set(g.revisadas);
  }
  return { montar, reiniciar, interacciones, interaccionManejando, actualizar, camara, faros, estadoGrua, bajar, alternarGrua, guardar, cargar, get manejada() { return manejada; }, get enGrua() { return enGrua; } };
})();
