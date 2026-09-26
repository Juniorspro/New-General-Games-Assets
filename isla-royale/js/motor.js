"use strict";
// ════════════════════════════════════════════════════════════════════════
// El motor: arma todo (con barra de progreso), maneja la cámara, el teclado
// y el mouse, dibuja el HUD que no es React (brújula, minimapa, números) y
// corre el bucle.
// ════════════════════════════════════════════════════════════════════════
const CALIDADES = {
  alta: { dpr: 1.75, sombra: 2048, pasto: 9000 },
  media: { dpr: 1.25, sombra: 1024, pasto: 4000 },
  baja: { dpr: 0.85, sombra: 0, pasto: 0 },
};

async function crearMotor({ lienzo, capa, progreso, alHud, alFin, alBloqueo, alTactil, alMapa, alPausa, alCalidad }) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !TOCABLE && (window.devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const camara = new THREE.PerspectiveCamera(72, 1, 0.1, 1600); camara.rotation.order = "YXZ";
  const isla = await crearIsla(20260925, progreso);
  const G = await construirEscena(renderer, isla, progreso);
  const V = crearVestibulo();
  const M = { isla, G, camara, renderer, P: null, opciones: Object.assign({}, OPCIONES_BASE), tactil: TOCABLE };
  instalarJuego(M);
  const { terreno } = isla;

  // ── efectos ──
  const particulas = [], colTmp = new THREE.Color(), v3 = new THREE.Vector3();
  M.chispas = (x, y, z, n, colores, vel = 4, vida = 0.5, grav = 9) => {
    if (Math.hypot(x - camara.position.x, z - camara.position.z) > 160) return;
    for (let i = 0; i < n && particulas.length < G.MAXP; i++) { colTmp.setHex(colores[i % colores.length]); particulas.push({ x, y, z, vx: (Math.random() - 0.5) * vel * 2, vy: Math.random() * vel, vz: (Math.random() - 0.5) * vel * 2, vida: vida * (0.6 + Math.random() * 0.6), r: colTmp.r, g: colTmp.g, b: colTmp.b, grav }); }
  };
  M.trazo = (a, r) => {
    if (Math.hypot(a.x - camara.position.x, a.z - camara.position.z) > 180) return;
    const tr = G.trazos.find((q) => q.vida <= 0); if (!tr) return;
    const len = Math.hypot(r.x - a.x, r.y - a.y, r.z - a.z); if (len < 0.5) return;
    tr.m.position.set(a.x, a.y, a.z); tr.m.lookAt(r.x, r.y, r.z); tr.m.scale.set(0.03, 0.03, len); tr.m.visible = true; tr.m.material.opacity = 0.9; tr.vida = 0.07;
  };
  M.fogonazo = (a, tam) => { const f = G.flashes.find((q) => q.vida <= 0); if (!f) return; f.s.position.set(a.x, a.y, a.z); f.s.scale.setScalar(tam); f.s.material.rotation = Math.random() * 6; f.s.visible = true; f.vida = 0.05; };
  M.luzBoca = (a) => { G.luzBoca.position.set(a.x, a.y, a.z); G.luzBoca.intensity = 6; };
  M.sonidoLejos = (p, fn, max = 170) => {
    const dx = p.x - camara.position.x, dz = p.z - camara.position.z, d = Math.hypot(dx, dz), yaw = camara.rotation.y;
    const lado = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    fn(Math.pow(clamp(1 - d / max, 0, 1), 1.6), clamp(lado / (d || 1), -1, 1) * 0.8);
  };
  M.dirCamara = () => { camara.getWorldDirection(v3); return { x: v3.x, y: v3.y, z: v3.z }; };
  M.lanzarConfeti = () => {
    const cols = ["#ffc62e", "#ff5d8f", "#3cb4ff", "#4ee06a", "#b46cff", "#ffffff"];
    M.P.confeti = Array.from({ length: 260 }, (_, i) => ({ x: Math.random(), y: -Math.random() * 1.2, vx: (Math.random() - 0.5) * 0.08, vy: 0.12 + Math.random() * 0.22, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: cols[i % cols.length], w: 6 + Math.random() * 8 }));
  };
  let elMira = null, miraT = 0;
  M.marcarAcierto = (cabeza) => { if (!elMira) return; elMira.classList.add("pego"); elMira.classList.toggle("cabeza", !!cabeza); miraT = 0.14; };
  function efectos(dt) {
    let i = 0; const { partPos, partCol, geoP, MAXP } = G;
    for (let k = particulas.length - 1; k >= 0; k--) { const q = particulas[k]; q.vida -= dt; if (q.vida <= 0) { particulas.splice(k, 1); continue; } q.vy -= q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    for (const q of particulas) { partPos[i * 3] = q.x; partPos[i * 3 + 1] = q.y; partPos[i * 3 + 2] = q.z; partCol[i * 3] = q.r; partCol[i * 3 + 1] = q.g; partCol[i * 3 + 2] = q.b; i++; }
    for (; i < MAXP; i++) partPos[i * 3 + 1] = -9999;
    geoP.attributes.position.needsUpdate = true; geoP.attributes.color.needsUpdate = true;
    for (const tr of G.trazos) if (tr.vida > 0) { tr.vida -= dt; tr.m.material.opacity = Math.max(0, tr.vida / 0.07) * 0.9; if (tr.vida <= 0) tr.m.visible = false; }
    for (const f of G.flashes) if (f.vida > 0) { f.vida -= dt; if (f.vida <= 0) f.s.visible = false; }
    G.luzBoca.intensity = Math.max(0, G.luzBoca.intensity - dt * 120);
    G.actualizarSacudidas(dt);
    // Balas de francotirador visibles.
    const P = M.P; G.balas.forEach((m, k) => { const q = P && P.proyectiles[k]; m.visible = !!q; if (q) m.position.set(q.x, q.y, q.z); });
  }

  // ════════════════════════════════════════════════════════════════════
  // Entrada
  // ════════════════════════════════════════════════════════════════════
  const entrada = { mx: 0, my: 0, dYaw: 0, dPitch: 0, mirar: { dx: 0, dy: 0, activa: false }, raton: false, dedo1: false, dedo2: false, apuntar: false, saltar: false, agachar: false, correr: false, usar: false, recargar: false, sel: null, rueda: 0, construir: false, pieza: null, material: false, baile: false };
  const teclas = new Set();
  let modo = "carga", bloqueado = false, sinBloqueo = false, pausado = false;
  M.entrada = entrada;
  const TECLAS_PIEZA = { KeyQ: "muro", F1: "muro", KeyZ: "piso", F2: "piso", KeyX: "escalera", F3: "escalera", KeyV: "techo", F4: "techo" };
  const abajo = (e) => {
    if (modo !== "juego" || e.target.tagName === "INPUT") return;
    if (e.code === "Escape") { if (!bloqueado) alPausa(); return; }
    if (e.repeat) return;
    teclas.add(e.code);
    const E = entrada;
    if (e.code === "Space") E.saltar = true; else if (e.code === "KeyC" || e.code === "ControlLeft") E.agachar = true; else if (e.code === "KeyE") E.usar = true; else if (e.code === "KeyR") E.recargar = true;
    else if (e.code.startsWith("Digit") && +e.code.slice(5) >= 1 && +e.code.slice(5) <= 5) E.sel = +e.code.slice(5); else if (e.code === "KeyF") E.sel = 0;
    else if (TECLAS_PIEZA[e.code]) E.pieza = TECLAS_PIEZA[e.code]; else if (e.code === "KeyB") E.construir = true; else if (e.code === "KeyG") E.baile = true; else if (e.code === "KeyM") alMapa();
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "F1", "F2", "F3", "F4", "Tab"].includes(e.code)) e.preventDefault();
  };
  const arriba = (e) => teclas.delete(e.code);
  const suelta = () => { teclas.clear(); entrada.raton = false; entrada.apuntar = false; };
  const ratonAbajo = (e) => {
    if (modo !== "juego" || e.pointerType === "touch" || pausado) return;
    Sonido.iniciar();
    if (!bloqueado && !sinBloqueo && lienzo.requestPointerLock) { try { const pr = lienzo.requestPointerLock(); if (pr && pr.catch) pr.catch(() => { sinBloqueo = true; alBloqueo(true); }); } catch (err) { sinBloqueo = true; alBloqueo(true); } }
    const yo = M.P && M.P.jugadores[0];
    if (e.button === 0) entrada.raton = true; else if (e.button === 2) { if (yo && yo.construyendo) entrada.material = true; else entrada.apuntar = true; }
  };
  const ratonArriba = (e) => { if (e.button === 0) entrada.raton = false; else if (e.button === 2) entrada.apuntar = false; };
  const ratonMueve = (e) => { if (modo !== "juego" || e.pointerType === "touch" || pausado) return; if (bloqueado || sinBloqueo) { entrada.dYaw += (e.movementX || 0) * 0.0024; entrada.dPitch += (e.movementY || 0) * 0.0024; } };
  const rueda = (e) => { if (modo === "juego") entrada.rueda += Math.sign(e.deltaY); };
  const cambioBloqueo = () => { bloqueado = document.pointerLockElement === lienzo; alBloqueo(bloqueado || sinBloqueo); if (!bloqueado && !sinBloqueo && modo === "juego" && M.P && !M.P.fin && !M.tactil) alPausa(); };
  const errorBloqueo = () => { sinBloqueo = true; alBloqueo(true); };
  const toque = (e) => { if (e.pointerType === "touch" && !M.tactil) { M.tactil = true; alTactil(true); } };
  addEventListener("keydown", abajo); addEventListener("keyup", arriba); addEventListener("blur", suelta); addEventListener("resize", ajustar);
  lienzo.addEventListener("pointerdown", ratonAbajo); addEventListener("pointerup", ratonArriba); addEventListener("pointermove", ratonMueve); addEventListener("pointerdown", toque, true);
  lienzo.addEventListener("wheel", rueda, { passive: true }); lienzo.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("pointerlockchange", cambioBloqueo); document.addEventListener("pointerlockerror", errorBloqueo);

  // ── la mira: a dónde apunta la cámara ──
  let distCam = 3.3;
  function dirApuntada(yo) {
    const d = M.dirCamara(), o = { x: camara.position.x + d.x * distCam, y: camara.position.y + d.y * distCam, z: camara.position.z + d.z * distCam };
    const r = M.rayo(o, d, 450, yo.id), b = M.boca(yo);
    let dx = r.x - b.x, dy = r.y - b.y, dz = r.z - b.z; const l = Math.hypot(dx, dy, dz) || 1;
    return { dir: { x: dx / l, y: dy / l, z: dz / l }, hit: r };
  }
  function asistencia(yo, dt, disparando) {
    let mejor = null, mejorA = disparando ? 0.13 : 0.06;
    const it = yo.inv[yo.sel]; if (!it || it.tipo !== "arma") return null;
    for (const o of M.P.jugadores) {
      if (o === yo || !o.vivo || o.estado !== "tierra") continue;
      const m = M.boca(yo), dx = o.x - m.x, dy = o.y + M.altura(o) * 0.7 - m.y, dz = o.z - m.z, d = Math.hypot(dx, dz);
      if (d > ARMAS[it.arma].alcance) continue;
      const a = Math.abs(angDif(Math.atan2(-dx, -dz) - yo.yaw)) + Math.abs(Math.atan2(dy, d) - yo.pitch) * 0.5;
      if (a < mejorA && M.lineaLibre(M.ojo(yo), M.pecho(o))) { mejorA = a; mejor = { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, d), a }; }
    }
    if (mejor && M.opciones.asistencia) { const k = Math.min(1, dt * (disparando ? 5 : 2)); yo.yaw += angDif(mejor.yaw - yo.yaw) * k; yo.pitch += (mejor.pitch - yo.pitch) * k; }
    return mejor;
  }
  let turbo = 0, autoT = 0, autoSi = false;
  // Convierte lo que tocó el jugador en órdenes para la simulación.
  function controlJugador(yo, dt) {
    const E = entrada, k = teclas, P = M.P, O = M.opciones, c = { wx: 0, wz: 0 };
    const pulso = (n) => { const v = E[n]; E[n] = false; return v; };
    if (P.fin && P.fin.gano) { E.dYaw = E.dPitch = 0; return c; }
    const sens = O.sens * (yo.apuntando ? O.sensMira * (1 / Math.max(1, zoomActual * 0.6)) : 1);
    yo.yaw -= E.dYaw * sens; yo.pitch = clamp(yo.pitch - E.dPitch * sens, -1.35, 1.3); E.dYaw = 0; E.dPitch = 0;
    if (E.mirar.activa) { yo.yaw -= E.mirar.dx * Math.abs(E.mirar.dx) * 2.8 * dt * sens; yo.pitch = clamp(yo.pitch - E.mirar.dy * Math.abs(E.mirar.dy) * 1.7 * dt * sens, -1.35, 1.3); }
    if (k.has("ArrowLeft")) yo.yaw += 2.2 * dt; if (k.has("ArrowRight")) yo.yaw -= 2.2 * dt;
    let ix = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + E.mx, iz = (k.has("KeyS") ? 1 : 0) - (k.has("KeyW") ? 1 : 0) + E.my;
    const fuerza = Math.hypot(E.mx, E.my), l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
    const s = Math.sin(yo.yaw), co = Math.cos(yo.yaw); c.wx = co * ix + s * iz; c.wz = -s * ix + co * iz;
    const saltar = pulso("saltar");
    if (yo.estado === "bus") { c.saltarBus = saltar; return c; }
    if (M.alAire(yo)) { c.abrir = saltar; return c; }
    c.saltar = saltar; c.agachar = pulso("agachar");
    c.corre = k.has("ShiftLeft") || k.has("ShiftRight") || E.correr || (M.tactil && O.autoCorrer && fuerza > 0.9 && E.my < -0.55);
    // Ranuras, construcción y materiales.
    const sel = E.sel; E.sel = null;
    if (sel !== null) { yo.construyendo = false; if (sel !== yo.sel) { yo.sel = sel; yo.recargando = 0; yo.cd = Math.max(yo.cd, 0.2); yo.curando = null; Sonido.boton(); } }
    if (E.rueda) { const dir = Math.sign(E.rueda); E.rueda = 0; if (yo.construyendo) { yo.pieza = PIEZAS[(PIEZAS.indexOf(yo.pieza) + dir + 4) % 4]; } else { yo.sel = (yo.sel + dir + 6) % 6; yo.recargando = 0; yo.curando = null; } }
    const pieza = E.pieza; E.pieza = null;
    if (pieza) { yo.construyendo = true; yo.pieza = pieza; yo.curando = null; yo.recargando = 0; }
    if (pulso("construir")) { yo.construyendo = !yo.construyendo; yo.curando = null; }
    if (pulso("material")) { yo.mat = LISTA_MAT[(LISTA_MAT.indexOf(yo.mat) + 1) % 3]; Sonido.boton(); }
    if (pulso("recargar")) M.recargar(yo);
    if (pulso("baile")) yo.baila = !yo.baila;
    if (Math.hypot(c.wx, c.wz) > 0.1 || E.raton || E.dedo1 || E.dedo2) yo.baila = false;
    if (yo.nadando) yo.construyendo = false;
    const it = yo.inv[yo.sel], arma = it && it.tipo === "arma";
    yo.apuntando = !!E.apuntar && arma && yo.estado === "tierra" && !yo.construyendo && !yo.nadando;
    // Usar: agarrar lo que está en la mira o abrir el cofre.
    if (pulso("usar") && P.interaccion) { const q = P.interaccion; if (q.tipo === "cofre") M.abrirCofre(q.obj, yo); else M.agarrar(yo, q.obj, true); }
    // Disparar o construir.
    let disparando = E.raton || E.dedo1 || E.dedo2;
    if (M.tactil && arma && yo.estado === "tierra" && !yo.construyendo) {
      const a = asistencia(yo, dt, disparando);
      // Disparo automático: si la mira está sobre alguien, tira sola.
      if (O.autoDisparo) { autoT -= dt; if (autoT <= 0) { autoT = 0.1; autoSi = !!(a && a.a < 0.05); } if (autoSi) disparando = true; }
    }
    turbo -= dt;
    if (yo.construyendo) { if (disparando && turbo <= 0) { M.construir(yo, yo.pieza); turbo = 0.14; } }
    else if (disparando && yo.estado === "tierra") { const d = arma ? dirApuntada(yo).dir : null; M.disparar(yo, d); }
    return c;
  }

  // ════════════════════════════════════════════════════════════════════
  // Cámara
  // ════════════════════════════════════════════════════════════════════
  let zoomActual = 1;
  function camaraJuego(dt) {
    const P = M.P, yo = P.jugadores[0], O = M.opciones;
    let foco = yo;
    if (!yo.vivo && P.espectando != null) { const e = P.jugadores[P.espectando]; if (e && e.vivo) foco = e; else { const vivo = P.jugadores.find((q) => q.vivo); if (vivo) { P.espectando = vivo.id; foco = vivo; } } }
    if (P.fin && P.fin.gano) {
      P.orbita += dt * 0.45;
      camara.position.set(yo.x + Math.sin(P.orbita) * 4.6, yo.y + 2, yo.z + Math.cos(P.orbita) * 4.6); camara.lookAt(yo.x, yo.y + 1.1, yo.z); zoomActual = 1; ponerFov(60, dt); return;
    }
    if (yo.estado === "bus") {
      const B = P.bus, k = clamp(B.t / B.dur, 0, 1), bx = lerp(B.ax, B.bx, k), bz = lerp(B.az, B.bz, k);
      const d = dirDe(yo.yaw, clamp(yo.pitch, -0.8, 0.3));
      camara.position.set(bx - d.x * 22, B.y + 5 - d.y * 22, bz - d.z * 22); camara.lookAt(bx, B.y + 2, bz); ponerFov(70, dt); return;
    }
    const aire = foco.estado === "cae" || foco.estado === "planea", apunta = foco === yo && yo.apuntando;
    const it = yo.inv[yo.sel], A = it && it.tipo === "arma" ? ARMAS[it.arma] : null;
    zoomActual = apunta && A ? A.zoom : 1;
    const mira = apunta && A && it.arma === "francotirador";
    distCam = lerp(distCam, aire ? 6.5 : mira ? 0.2 : apunta ? 1.9 : yo.construyendo ? 3.9 : 3.3, Math.min(1, dt * 8));
    const lado = aire ? 0 : apunta ? 0.6 : 0.75, alto = aire ? 2.2 : M.altura(foco) - 0.18;
    const yaw = foco === yo ? yo.yaw : foco.yaw, pitch = foco === yo ? yo.pitch : foco.pitch * 0.5 - 0.15;
    const d = dirDe(yaw, pitch), f = { x: foco.x + Math.cos(yaw) * lado, y: foco.y + alto, z: foco.z - Math.sin(yaw) * lado };
    if (!yo.vivo && foco === yo) f.y = yo.y + 1 + Math.min(3, yo.muerte * 1.5);
    const r = M.rayo(f, { x: -d.x, y: -d.y, z: -d.z }, distCam, foco.id, false, false), dd = Math.max(mira ? 0.1 : 0.6, Math.min(distCam, r.t - 0.25));
    let cx = f.x - d.x * dd, cy = f.y - d.y * dd, cz = f.z - d.z * dd;
    cy = Math.max(cy, terreno(cx, cz) + 0.35, -1.0);
    const sa = P.sacudida * 0.012; cx += (Math.random() - 0.5) * sa; cy += (Math.random() - 0.5) * sa;
    camara.position.set(cx, cy, cz); camara.rotation.set(pitch, yaw, 0);
    yo.malla.raiz.visible = yo.malla.raiz.visible && !mira;
    ponerFov((aire ? 80 : 72) / zoomActual, dt);
  }
  function ponerFov(f, dt) { if (Math.abs(camara.fov - f) > 0.05) { camara.fov = lerp(camara.fov, f, Math.min(1, dt * 12)); camara.updateProjectionMatrix(); } }

  // ════════════════════════════════════════════════════════════════════
  // HUD que se dibuja: brújula, minimapa, mapa grande, capa de números
  // ════════════════════════════════════════════════════════════════════
  let lienzoMini = null, lienzoGrande = null, lienzoBrujula = null;
  const g2 = capa.getContext("2d");
  const aMapa = (v, S) => ((v + 260) / 520) * S;
  function dibujarMapaGrande(cv) {
    const S = cv.width, g = cv.getContext("2d"), P = M.P;
    g.drawImage(G.imgMapa, 0, 0, S, S);
    g.font = `900 ${Math.max(11, S / 38)}px Nunito, sans-serif`; g.textAlign = "center"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.65)"; g.fillStyle = "#fff";
    for (const pu of isla.lugares) { g.strokeText(pu.nombre.toUpperCase(), aMapa(pu.x, S), aMapa(pu.z, S)); g.fillText(pu.nombre.toUpperCase(), aMapa(pu.x, S), aMapa(pu.z, S)); }
    if (!P) return;
    dibujarTormenta(g, S, (v) => aMapa(v, S), S / 520);
    const B = P.bus; if (B.t < B.dur) { g.setLineDash([8, 6]); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2; g.beginPath(); g.moveTo(aMapa(B.ax, S), aMapa(B.az, S)); g.lineTo(aMapa(B.bx, S), aMapa(B.bz, S)); g.stroke(); g.setLineDash([]); }
    if (P.marca) { g.fillStyle = "#ffe14a"; g.strokeStyle = "#000"; g.lineWidth = 2; g.beginPath(); g.arc(aMapa(P.marca.x, S), aMapa(P.marca.z, S), 7, 0, 7); g.fill(); g.stroke(); }
    flecha(g, aMapa(P.jugadores[0].x, S), aMapa(P.jugadores[0].z, S), P.jugadores[0].yaw, Math.max(1.2, S / 300));
  }
  function dibujarTormenta(g, S, a, k) {
    const T = M.P.tormenta;
    g.fillStyle = "rgba(128, 50, 240, 0.42)"; g.beginPath(); g.rect(-S, -S, S * 3, S * 3); g.arc(a(T.x), a(T.z), Math.max(0.5, T.r * k), 0, Math.PI * 2, true); g.fill("evenodd");
    g.strokeStyle = "rgba(210,160,255,0.95)"; g.lineWidth = 2; g.beginPath(); g.arc(a(T.x), a(T.z), Math.max(0.5, T.r * k), 0, 7); g.stroke();
    const sig = T.estado === "cierra" ? T.hacia : T.sig;
    if (sig && T.estado !== "fin") { g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(a(sig.x), a(sig.z), Math.max(1, sig.r * k), 0, 7); g.stroke(); }
    return sig;
  }
  function flecha(g, x, y, yaw, k) {
    const ang = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = "#ffc62e"; g.strokeStyle = "#1a1a1a"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(8 * k, 0); g.lineTo(-5 * k, 5 * k); g.lineTo(-2 * k, 0); g.lineTo(-5 * k, -5 * k); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  // El minimapa sigue al jugador (160 m de ancho), con la línea hacia la zona segura.
  function dibujarMini(cv) {
    const S = cv.width, g = cv.getContext("2d"), P = M.P, yo = P.jugadores[0], ancho = yo.estado === "bus" || M.alAire(yo) ? 360 : 170, k = S / ancho;
    const a = (v, c) => (v - c) * k + S / 2, ax = (v) => a(v, yo.x), az = (v) => a(v, yo.z);
    g.fillStyle = "#1a6fae"; g.fillRect(0, 0, S, S);
    const esc = 512 / 520, sx = (yo.x - ancho / 2 + 260) * esc, sz = (yo.z - ancho / 2 + 260) * esc;
    g.drawImage(G.imgMapa, sx, sz, ancho * esc, ancho * esc, 0, 0, S, S);
    const T = P.tormenta;
    g.save(); g.fillStyle = "rgba(128, 50, 240, 0.42)"; g.beginPath(); g.rect(0, 0, S, S); g.arc(ax(T.x), az(T.z), Math.max(0.5, T.r * k), 0, Math.PI * 2, true); g.fill("evenodd"); g.restore();
    g.strokeStyle = "rgba(210,160,255,0.95)"; g.lineWidth = 2; g.beginPath(); g.arc(ax(T.x), az(T.z), Math.max(0.5, T.r * k), 0, 7); g.stroke();
    const sig = T.estado === "cierra" ? T.hacia : T.sig;
    if (sig && T.estado !== "fin") {
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(ax(sig.x), az(sig.z), Math.max(1, sig.r * k), 0, 7); g.stroke();
      const d = Math.hypot(yo.x - sig.x, yo.z - sig.z);
      if (d > sig.r) { const tx = sig.x + ((yo.x - sig.x) / d) * sig.r, tz = sig.z + ((yo.z - sig.z) / d) * sig.r; g.setLineDash([4, 4]); g.strokeStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(ax(tx), az(tz)); g.stroke(); g.setLineDash([]); }
    }
    if (P.marca) { g.fillStyle = "#ffe14a"; g.beginPath(); g.arc(clamp(ax(P.marca.x), 5, S - 5), clamp(az(P.marca.z), 5, S - 5), 4, 0, 7); g.fill(); }
    flecha(g, S / 2, S / 2, yo.yaw, S / 150);
  }
  const PUNTOS = () => (IDIOMA === "en" ? ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] : ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]);
  function dibujarBrujula(cv) {
    const w = cv.width, h = cv.height, g = cv.getContext("2d"), P = M.P, yo = P.jugadores[0];
    g.clearRect(0, 0, w, h);
    // Rumbo en grados (0 = norte = -z).
    const rumbo = ((-yo.yaw * 180) / Math.PI % 360 + 360) % 360, ppg = w / 140;
    g.textAlign = "center"; g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,0,0,0.6)"; g.lineWidth = 3;
    for (let dgr = Math.floor((rumbo - 70) / 15) * 15; dgr <= rumbo + 70; dgr += 15) {
      const x = w / 2 + (dgr - rumbo) * ppg, dd = ((dgr % 360) + 360) % 360;
      if (dd % 45 === 0) { const txt = PUNTOS()[dd / 45]; g.font = `900 ${h * 0.42}px Nunito, sans-serif`; g.strokeText(txt, x, h * 0.55); g.fillText(txt, x, h * 0.55); }
      else { g.fillRect(x - 1, h * 0.25, 2, h * 0.25); g.font = `800 ${h * 0.26}px Nunito, sans-serif`; g.fillText(String(dd), x, h * 0.9); }
    }
    g.fillStyle = "#ffc62e"; g.beginPath(); g.moveTo(w / 2 - 6, 0); g.lineTo(w / 2 + 6, 0); g.lineTo(w / 2, 7); g.fill();
    const marcar = (x, z, color) => { let a = (Math.atan2(x - yo.x, -(z - yo.z)) * 180) / Math.PI - rumbo; a = ((a + 540) % 360) - 180; if (Math.abs(a) < 68) { g.fillStyle = color; g.beginPath(); g.arc(w / 2 + a * ppg, h * 0.12, 4, 0, 7); g.fill(); } };
    if (P.marca) marcar(P.marca.x, P.marca.z, "#ffe14a");
    const T = P.tormenta, sig = T.estado === "cierra" ? T.hacia : T.sig; if (sig && Math.hypot(yo.x - sig.x, yo.z - sig.z) > sig.r) marcar(sig.x, sig.z, "#ffffff");
  }
  function dibujarCapa(dt) {
    const w = capa.clientWidth, hh = capa.clientHeight, P = M.P;
    g2.clearRect(0, 0, w, hh);
    if (!P || modo !== "juego") return;
    g2.textAlign = "center"; g2.lineJoin = "round";
    P.numeros = P.numeros.filter((n) => (n.t -= dt) > 0);
    for (const n of P.numeros) {
      v3.set(n.x, n.y + (0.9 - n.t) * 0.8, n.z).project(camara); if (v3.z > 1) continue;
      const x = (v3.x * 0.5 + 0.5) * w + n.dx * (0.9 - n.t), y = (-v3.y * 0.5 + 0.5) * hh;
      g2.globalAlpha = Math.min(1, n.t * 3); g2.font = `400 ${n.grande ? 32 : 24}px "Luckiest Guy", "Arial Black", sans-serif`;
      g2.lineWidth = 5; g2.strokeStyle = "rgba(0,0,0,0.75)"; g2.strokeText(n.texto, x, y); g2.fillStyle = n.color; g2.fillText(n.texto, x, y);
    }
    g2.globalAlpha = 1;
    // De dónde vino el tiro: un arco rojo alrededor de la mira.
    if (P.danoDir) {
      const yo = P.jugadores[0], a = Math.atan2(P.danoDir.x - yo.x, -(P.danoDir.z - yo.z)) + yo.yaw;
      g2.strokeStyle = `rgba(255,50,70,${Math.min(1, P.danoDir.t) * 0.85})`; g2.lineWidth = 7; g2.beginPath(); g2.arc(w / 2, hh / 2, Math.min(w, hh) * 0.16, a - Math.PI / 2 - 0.35, a - Math.PI / 2 + 0.35); g2.stroke();
    }
    // La marca en el mundo.
    if (P.marca) { v3.set(P.marca.x, terreno(P.marca.x, P.marca.z) + 2, P.marca.z).project(camara); if (v3.z < 1) { const x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * hh, d = Math.round(Math.hypot(P.marca.x - camara.position.x, P.marca.z - camara.position.z)); g2.fillStyle = "#ffe14a"; g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x - 8, y - 14); g2.lineTo(x + 8, y - 14); g2.fill(); g2.font = "900 13px Nunito, sans-serif"; g2.lineWidth = 3; g2.strokeStyle = "rgba(0,0,0,0.7)"; g2.strokeText(d + " m", x, y - 18); g2.fillText(d + " m", x, y - 18); } }
    for (const c of P.confeti) {
      c.vy = Math.min(0.45, c.vy + 0.15 * dt); c.x += c.vx * dt + Math.sin(c.rot) * 0.02 * dt; c.y += c.vy * dt; c.rot += c.vr * dt; if (c.y > 1.1) { c.y = -0.1; c.x = Math.random(); }
      g2.save(); g2.translate(c.x * w, c.y * hh); g2.rotate(c.rot); g2.fillStyle = c.c; g2.fillRect(-c.w / 2, -c.w / 4, c.w, c.w / 2); g2.restore();
    }
  }

  // ── qué hay para agarrar o abrir ──
  function buscarInteraccion(yo) {
    const P = M.P; P.interaccion = null;
    if (!yo.vivo || yo.estado !== "tierra") return;
    const f = dirDe(yo.yaw, 0); let mejor = null, dm = 2.4;
    for (const c of P.cofres) { if (c.abierto) continue; const d = Math.hypot(c.x - yo.x, c.z - yo.z); if (d < 2.3 && Math.abs(c.y - yo.y) < 2 && d < dm) { dm = d; mejor = { tipo: "cofre", obj: c }; } }
    for (const b of P.botin) {
      if (b.item.tipo === "municion" || b.item.tipo === "material") continue;
      const dx = b.x - yo.x, dz = b.z - yo.z, d = Math.hypot(dx, dz); if (d > 2.4 || Math.abs(b.y - yo.y) > 2) continue;
      const frente = (dx * f.x + dz * f.z) / (d || 1); const pd = d - frente * 0.8; if (pd < dm) { dm = pd; mejor = { tipo: "botin", obj: b }; }
    }
    P.interaccion = mejor;
  }

  // ════════════════════════════════════════════════════════════════════
  // Calidad, tamaño y estado para el HUD
  // ════════════════════════════════════════════════════════════════════
  let calidadActual = "alta";
  function calidad(nombre) {
    calidadActual = nombre; const C = CALIDADES[nombre];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, C.dpr));
    G.sol.castShadow = C.sombra > 0;
    if (C.sombra > 0 && G.sol.shadow.mapSize.x !== C.sombra) { G.sol.shadow.mapSize.set(C.sombra, C.sombra); if (G.sol.shadow.map) { G.sol.shadow.map.dispose(); G.sol.shadow.map = null; } }
    G.pasto.count = Math.min(isla.pasto.length, C.pasto);
    G.escena.environment = C.sombra > 0 ? G.entorno : null; G.hemi.intensity = C.sombra > 0 ? 0.55 : 1.25;
    ajustar();
  }
  function ajustar() {
    const w = lienzo.clientWidth || innerWidth, hh = lienzo.clientHeight || innerHeight;
    renderer.setSize(w, hh, false); camara.aspect = w / hh; camara.updateProjectionMatrix(); V.camara.aspect = w / hh; V.camara.updateProjectionMatrix();
    const dpr = Math.min(2, window.devicePixelRatio || 1); capa.width = w * dpr; capa.height = hh * dpr; g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const itemHud = (it) => !it ? null : it.tipo === "pico" ? { icono: "pico", rareza: 1, nombre: t("pico") } : it.tipo === "arma" ? { icono: it.arma, rareza: it.rareza, mun: it.mun, nombre: t(it.arma) } : { icono: it.c, rareza: 0, cant: it.cant, nombre: t(it.c) };
  let fpsN = 0, fpsT = 0, fpsVal = 60;
  function estadoHud() {
    const P = M.P, yo = P.jugadores[0], T = P.tormenta, it = yo.inv[yo.sel], B = P.bus;
    const F = FASES_TORMENTA[Math.min(T.fase, FASES_TORMENTA.length - 1)];
    const q = P.interaccion;
    return {
      vida: Math.ceil(yo.vida), escudo: Math.ceil(yo.escudo), inv: yo.inv.map(itemHud), sel: yo.sel, reserva: it && it.tipo === "arma" ? yo.mun[ARMAS[it.arma].mun] : null,
      mats: Object.assign({}, yo.mats), mat: yo.mat, construyendo: yo.construyendo, pieza: yo.pieza, vivos: P.jugadores.filter((p) => p.vivo).length, bajas: yo.bajas,
      tormenta: { estado: T.estado, t: Math.max(0, Math.ceil(T.t)), fase: T.fase + 1, dano: F.dano },
      feed: P.feed.map((f) => ({ a: f.a, b: f.b, yo: f.yo, id: f.id })), aviso: P.aviso && P.aviso.texto, eliminacion: P.eliminacion && P.eliminacion.texto,
      interaccion: q ? (q.tipo === "cofre" ? { texto: t("abrir"), nombre: q.obj.tipo === "cofre" ? "🟨" : "", rareza: 4 } : { texto: yo.inv.slice(1).some((s) => !s) ? t("recoger") : t("cambiarPor"), nombre: M.nombreItem(q.obj.item) + (q.obj.item.cant > 1 ? " ×" + q.obj.item.cant : ""), rareza: q.obj.item.rareza || 0 }) : null,
      curando: yo.curando ? { nombre: t(yo.curando.c), k: 1 - yo.curando.t / yo.curando.total } : null, recarga: yo.recargando > 0 && it && it.tipo === "arma" ? 1 - yo.recargando / (ARMAS[it.arma].recarga * RAREZAS[it.rareza].recarga) : null,
      estado: yo.estado, altura: Math.max(0, Math.round(yo.y - M.sueloEn(yo.x, yo.z, yo.y))), busT: Math.max(0, Math.ceil(B.dur - B.t)), puedeSaltar: B.t > 2,
      enTormenta: yo.vivo && Math.hypot(yo.x - T.x, yo.z - T.z) > T.r && yo.estado === "tierra", apuntando: yo.apuntando, mira: yo.apuntando && it && it.arma === "francotirador", arma: it && it.tipo === "arma" ? it.arma : it ? it.tipo : null,
      dano: P.danoFlash > 0.3 ? P.danoId : 0, fin: !!P.fin, vivo: yo.vivo, nadando: yo.nadando, agachado: yo.agachado, espectando: P.espectando != null ? (P.jugadores[P.espectando] || {}).nombre : null,
      fps: M.opciones.fps ? fpsVal : null, pausado,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // Bucle
  // ════════════════════════════════════════════════════════════════════
  let ultimo = performance.now(), cuadro = 0, idA = 0, tiempo = 0, medir = null;
  function bucle(ahora) {
    idA = requestAnimationFrame(bucle);
    const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora; cuadro++; tiempo += dt;
    fpsN++; fpsT += dt; if (fpsT > 0.5) { fpsVal = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    if (modo === "vestibulo" || modo === "carga") {
      V.actualizar(dt, tiempo, M.opciones.traje);
      renderer.render(V.escena, V.camara); g2.clearRect(0, 0, capa.clientWidth, capa.clientHeight); return;
    }
    const P = M.P;
    G.uTiempo.value += dt; G.agua.material.uniforms.uT.value = G.uTiempo.value;
    if (!pausado) paso(dt);
    for (const n of G.nubes) { n.position.x += dt * 3; if (n.position.x > 420) n.position.x = -420; }
    efectos(dt);
    const yo = P.jugadores[0];
    const foco = yo.estado === "bus" ? { x: lerp(P.bus.ax, P.bus.bx, clamp(P.bus.t / P.bus.dur, 0, 1)), y: 0, z: lerp(P.bus.az, P.bus.bz, clamp(P.bus.t / P.bus.dur, 0, 1)) } : yo;
    G.sol.target.position.set(foco.x, Math.max(0, foco.y), foco.z); G.sol.position.set(foco.x + G.SOL.x * 160, Math.max(0, foco.y) + G.SOL.y * 160, foco.z + G.SOL.z * 160);
    G.cielo.position.copy(camara.position);
    renderer.render(G.escena, camara);
    dibujarCapa(dt);
    if (miraT > 0 && (miraT -= dt) <= 0 && elMira) elMira.classList.remove("pego", "cabeza");
    if (cuadro % 5 === 0) alHud(estadoHud());
    if (cuadro % 4 === 0) { if (lienzoMini) dibujarMini(lienzoMini); if (lienzoGrande) dibujarMapaGrande(lienzoGrande); }
    if (lienzoBrujula) dibujarBrujula(lienzoBrujula);
    // Medir los primeros segundos: si va trabado, bajar los gráficos.
    if (medir && P.t > 3) { medir.t += dt; medir.n++; if (medir.t > 4) { const fps = medir.n / medir.t; if (fps < 26 && calidadActual !== "baja") alCalidad(calidadActual === "alta" ? "media" : "baja", Math.round(fps)); medir = null; } }
  }
  function paso(dt) {
    const P = M.P, yo = P.jugadores[0];
    M.paso(dt, controlJugador);
    buscarInteraccion(yo);
    for (const p of P.jugadores) animar(p, dt, G.uTiempo.value);
    camaraJuego(dt);
    const T = P.tormenta; G.tormenta.visible = true; G.tormenta.scale.set(Math.max(0.1, T.r), 360, Math.max(0.1, T.r)); G.tormenta.position.set(T.x, 120, T.z);
    G.bus.visible = P.bus.t < P.bus.dur + 8; if (G.bus.visible) { const k = P.bus.t / P.bus.dur; G.bus.position.set(lerp(P.bus.ax, P.bus.bx, k), P.bus.y, lerp(P.bus.az, P.bus.bz, k)); G.bus.rotation.y = Math.atan2(P.bus.bx - P.bus.ax, P.bus.bz - P.bus.az); }
    // Fantasma de la pieza a construir.
    for (const k of PIEZAS) G.fantasma[k].visible = false;
    if (yo.construyendo && yo.vivo && yo.estado === "tierra") {
      const s = M.calcularPieza(yo, yo.pieza), f = G.fantasma[yo.pieza]; f.visible = true; f.material = s.valida ? G.matFantasma : G.matFantasmaMal; f.rotation.set(0, 0, 0);
      if (yo.pieza === "muro") { f.position.set(s.x, s.base, s.z); f.rotation.y = s.eje === "x" ? Math.PI / 2 : 0; } else { f.position.set(s.cx, s.base, s.cz); if (yo.pieza === "escalera") f.rotation.y = Math.atan2(-s.dx, -s.dz); }
    }
    // Sonidos de ambiente: tormenta, viento, motor del autobús, cofres cerca.
    Sonido.tormenta(yo.vivo && Math.hypot(yo.x - T.x, yo.z - T.z) > T.r ? 1 : 0);
    Sonido.viento(yo.vivo && M.alAire(yo) ? (yo.estado === "cae" ? 1 : 0.5) : 0);
    Sonido.motor(yo.estado === "bus" ? 1 : 0);
    let dc = 99; for (const c of P.cofres) if (!c.abierto && c.tipo === "cofre") { const d = Math.hypot(c.x - yo.x, c.z - yo.z) + Math.abs(c.y - yo.y) * 2; if (d < dc) dc = d; }
    Sonido.zumbidoCofre(yo.vivo && yo.estado === "tierra" ? clamp(1 - dc / 14, 0, 1) : 0);
    if (P.fin && !P.finAvisado) { P.finAvisado = true; setTimeout(() => alFin(P.fin), P.fin.gano ? 1500 : 2000); }
  }
  calidad(M.opciones.calidad); ajustar();
  progreso(0.95, "etapa_sombras"); await pausa();
  renderer.compile(G.escena, camara);
  idA = requestAnimationFrame(bucle);

  // Object.assign copiaría el valor del momento: el modo va como propiedad viva.
  Object.defineProperty(M, "modo", { get: () => modo });
  return Object.assign(M, {
    vestibulo() { modo = "vestibulo"; if (document.exitPointerLock && bloqueado) document.exitPointerLock(); Sonido.tormenta(0); Sonido.viento(0); Sonido.motor(0); Sonido.zumbidoCofre(0); pausado = false; },
    async prepararPartida() { M.nuevaPartida(M.opciones); await pausa(); renderer.compile(G.escena, camara); },
    empezar() { modo = "juego"; pausado = false; distCam = 3.3; camara.fov = 72; camara.updateProjectionMatrix(); medir = { t: 0, n: 0 }; for (const k in entrada) if (typeof entrada[k] === "boolean") entrada[k] = false; alHud(estadoHud()); },
    pausar(v) { pausado = v; if (v && document.exitPointerLock && bloqueado) document.exitPointerLock(); if (M.P) alHud(estadoHud()); },
    espectar() { const P = M.P; if (!P) return; const asesino = P.jugadores.find((q) => q.vivo && q.nombre === P.asesino) || P.jugadores.find((q) => q.vivo); P.espectando = asesino ? asesino.id : null; },
    marcar(x, z) { if (M.P) M.P.marca = M.P.marca && Math.hypot(M.P.marca.x - x, M.P.marca.z - z) < 12 ? null : { x, z }; },
    calidad, girarVestibulo: (d) => V.girar(d),
    ponerOpciones(o) { M.opciones = Object.assign({}, o); Sonido.ponerVolumen(o.volumen); },
    ponerMinimapa(c) { lienzoMini = c; if (c) c.width = c.height = 256; },
    ponerMapaGrande(c) { lienzoGrande = c; if (c) { c.width = c.height = 720; dibujarMapaGrande(c); } },
    ponerBrujula(c) { lienzoBrujula = c; if (c) { const r = c.getBoundingClientRect(); c.width = Math.max(200, r.width * 2); c.height = Math.max(24, r.height * 2); } },
    ponerMira(el) { elMira = el; },
    // Para las pruebas: avanza la simulación sin dibujar (el navegador de prueba no tiene placa de video).
    simular(seg) { for (let tt = 0; tt < seg && modo === "juego"; tt += 1 / 30) { paso(1 / 30); efectos(1 / 30); } },
    destruir() { cancelAnimationFrame(idA); removeEventListener("keydown", abajo); removeEventListener("keyup", arriba); removeEventListener("blur", suelta); removeEventListener("resize", ajustar); removeEventListener("pointerup", ratonArriba); removeEventListener("pointermove", ratonMueve); removeEventListener("pointerdown", toque, true); renderer.dispose(); },
  });
}
