"use strict";
// ════════════════════════════════════════════════════════════════════════
// El turno en el puesto: la fila de vehículos, el policía en primera persona,
// la inspección (ventanilla, documentos, alcoholímetro, baúl), las
// resoluciones y su puntaje, los detenidos, el patrullero y la radio.
// La interfaz (ui.js) lee `Juego.est` y llama a las acciones de acá.
// ════════════════════════════════════════════════════════════════════════
const Juego = (() => {
  const V = THREE.Vector3;
  let R = null, cam = null, M = null, escena = null, lienzo = null, opc = Object.assign({}, OPCIONES_BASE);
  let modo = "carga"; // carga | menu | jugando | fin
  let pausado = false, t = 0, tReal = 0, horaIni = 17, horaFin = 25, hora = 18.3, noche = 0;
  const yo = { x: -7.5, z: 1.5, yaw: -2.2, pitch: -0.05, bob: 0, paso: 0, mira: null };
  const tecla = {}, joy = { x: 0, z: 0 }, arrastre = { activo: false, id: null, x: 0, y: 0 };
  let correr = false, linterna = null, linternaOn = false;
  let cola = [], yendose = [], otros = [], personas = [], zona = [], compas = [];
  const secuestrados = []; // se quedan en la playa hasta el próximo turno
  let patrulla = null, parado = null, seguidor = null, arresto = null;
  let conductores = [], proximo = 0, esperaLlegada = 3, esperaOtro = 4, playa = 0;
  let registro = null, rnd = Math.random, hist = [], novedades = [], avisos = [], idAviso = 0, radioPlan = [];
  let panel = null, insp = null, finEn = -1, motivoFin = "";
  const subs = new Set();
  // Lo que pasa "en un rato" va con el reloj del juego (se frena en pausa y
  // sigue a simular() en las pruebas); con setTimeout los autos resueltos
  // quedaban parados mientras el bucle estaba ocupado.
  const tareas = []; let reloj = 0;
  const luego = (seg, fn) => tareas.push({ t: reloj + seg, fn });
  const est = { modo: "carga", hora: "18:00", reputacion: 100, recaudado: 0, atendidos: 0, total: 0, cola: 0, pista: null, acciones: [], panel: null, zona: 0, patrulla: null, linterna: false, bloqueado: false, avisos: [], radio: null, noche: 0, seguidor: false };
  let ultimoAviso = 0;

  // ── utilidades ──
  const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const texto = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };
  function avisar(ya) { const ahora = performance.now(); if (!ya && ahora - ultimoAviso < 120) return; if (ya && M) volcar(); ultimoAviso = ahora; for (const f of subs) f(); }
  function aviso(txt, tipo = "info", seg = 4.5) { avisos.push({ id: ++idAviso, texto: txt, tipo, hasta: tReal + seg }); avisar(true); }
  function radio(txt, tipo = "radio") { novedades.unshift({ hora: texto(hora), texto: txt, tipo }); est.radio = { texto: txt, hasta: tReal + 8, id: ++idAviso }; Sonido.radio(); avisar(true); }
  const cercaDe = (x, z, px, pz, r) => (x - px) ** 2 + (z - pz) ** 2 < r * r;

  // ── texturas chicas: patente, brillo de faro ──
  const PATENTES = new Map();
  function texPatente(txt) {
    if (PATENTES.has(txt)) return PATENTES.get(txt);
    const vieja = /^[A-Z]{3} \d{3}$/.test(txt);
    const tx = M.texCanvas(256, (g, w, h) => {
      g.fillStyle = vieja ? "#141414" : "#fbfbf7"; g.fillRect(0, 0, w, h);
      if (!vieja) { g.fillStyle = "#1d3f99"; g.fillRect(0, 0, w, h * 0.26); g.fillStyle = "#fff"; g.font = "700 14px Arial"; g.textAlign = "center"; g.fillText("REPÚBLICA ARGENTINA", w / 2, h * 0.19); }
      else { g.fillStyle = "#ddd"; g.font = "700 13px Arial"; g.textAlign = "center"; g.fillText("ARGENTINA", w / 2, h * 0.2); }
      g.fillStyle = vieja ? "#f2f2f2" : "#111"; g.font = "900 46px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, w / 2, h * 0.64);
      g.strokeStyle = vieja ? "#aaa" : "#222"; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    }, false, 84);
    PATENTES.set(txt, tx); return tx;
  }
  let texBrillo = null;
  function brillo() {
    if (texBrillo) return texBrillo;
    texBrillo = M.texCanvas(64, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
    return texBrillo;
  }
  const MAT = {};
  function materiales() {
    MAT.faro = new THREE.MeshBasicMaterial({ color: "#fff8e0", toneMapped: false });
    MAT.faroOff = new THREE.MeshStandardMaterial({ color: "#3a3a36", roughness: 0.3, metalness: 0.5 });
    MAT.stop = new THREE.MeshBasicMaterial({ color: "#c0160c", toneMapped: false });
    MAT.halo = new THREE.SpriteMaterial({ map: brillo(), color: "#fff1c8", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    MAT.haloRojo = new THREE.SpriteMaterial({ map: brillo(), color: "#ff3020", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    MAT.haz = new THREE.MeshBasicMaterial({ map: M.texCanvas(64, (g, n) => { const gr = g.createRadialGradient(n / 2, n * 0.15, 0, n / 2, n * 0.15, n * 0.85); gr.addColorStop(0, "rgba(255,240,200,0.9)"); gr.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, n); }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false });
    MAT.casco = new THREE.MeshStandardMaterial({ color: "#1c1c22", roughness: 0.35, metalness: 0.2 });
  }

  // ════════════════════════════════════════════════════════════════════
  // Vehículos
  // ════════════════════════════════════════════════════════════════════
  function armarVehiculo(malla, color, o = {}) {
    const L = Modelos.listos[malla], g = new THREE.Group();
    const m = Modelos.clonar(malla, color); if (m) g.add(m);
    const tam = L ? L.tam.clone() : new V(2, 1.5, 4.4);
    const v = { g, malla, tam, largo: tam.z, ancho: tam.x, x: RUTA.carril, z: -250, rumbo: 0, vel: 0, vmax: 16, ruta: null, estado: "cola", luces: [], freno: 0 };
    const moto = malla === "moto" || malla === "motopol", camion = malla === "camion";
    const y = tam.y * (camion ? 0.28 : moto ? 0.55 : 0.4), sep = moto ? 0 : tam.x / 2 - 0.32;
    const disco = new THREE.CircleGeometry(moto ? 0.09 : 0.11, 14), discoStop = new THREE.CircleGeometry(0.065, 12);
    const lados = moto ? [0] : [-1, 1], apagado = o.quemada ? (moto ? 0 : rnd() < 0.5 ? -1 : 1) : null;
    for (const l of lados) {
      const off = o.quemada && l === apagado;
      const f = new THREE.Mesh(disco, off ? MAT.faroOff : MAT.faro); f.position.set(l * sep, y, tam.z / 2 + 0.02); g.add(f);
      if (!off) { const s = new THREE.Sprite(MAT.halo); s.scale.setScalar(0.75); s.position.set(l * sep, y, tam.z / 2 + 0.12); g.add(s); v.luces.push(s); }
      const st = new THREE.Mesh(discoStop, MAT.stop); st.position.set(l * (moto ? 0 : sep), y + 0.05, -tam.z / 2 - 0.02); st.rotation.y = Math.PI; g.add(st);
      const hs = new THREE.Sprite(MAT.haloRojo); hs.scale.setScalar(0.24); hs.position.set(l * (moto ? 0 : sep), y + 0.05, -tam.z / 2 - 0.1); g.add(hs);
    }
    // El haz sobre el asfalto (se ve de noche).
    if (!o.sinHaz) { const haz = new THREE.Mesh(new THREE.PlaneGeometry(moto ? 2.2 : 3.4, 9).rotateX(-Math.PI / 2), MAT.haz); haz.position.set(0, 0.05, tam.z / 2 + 4.6); haz.renderOrder = 2; g.add(haz); }
    if (o.patente) {
      const pm = new THREE.MeshBasicMaterial({ map: texPatente(o.patente) });
      const trasera = new THREE.Mesh(new THREE.PlaneGeometry(moto ? 0.3 : 0.42, moto ? 0.1 : 0.14), pm); trasera.position.set(0, tam.y * (camion ? 0.2 : moto ? 0.45 : 0.3), -tam.z / 2 - 0.03); trasera.rotation.y = Math.PI; g.add(trasera);
      if (!moto) { const del = trasera.clone(); del.position.z = tam.z / 2 + 0.03; del.rotation.y = 0; del.position.y = tam.y * (camion ? 0.2 : 0.25); g.add(del); }
    }
    escena.add(g); poner(v);
    return v;
  }
  function poner(v) { v.g.position.set(v.x, lomo(v), v.z); v.g.rotation.y = v.rumbo; }
  // El lomo de burro: el auto sube un poco al pasar.
  function lomo(v) { if (Math.abs(v.x - RUTA.carril) > 1.5) return 0; const b = (z) => Math.max(0, 1 - Math.abs(z + 16) / 0.55) * 0.08; return b(v.z - v.largo * 0.3) + b(v.z + v.largo * 0.3); }
  function barraLuces(v) {
    const g = new THREE.Group(), y = v.tam.y * 0.97;
    const r = new THREE.MeshBasicMaterial({ color: "#ff1a1a", toneMapped: false }), a = new THREE.MeshBasicMaterial({ color: "#1f4dff", toneMapped: false });
    const caja = new THREE.BoxGeometry(0.46, 0.11, 0.22);
    const mr = new THREE.Mesh(caja, r), ma = new THREE.Mesh(caja, a); mr.position.set(-0.25, y, -0.1); ma.position.set(0.25, y, -0.1); g.add(mr, ma);
    const hr = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo(), color: "#ff2020", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const ha = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo(), color: "#2050ff", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    hr.position.set(-0.25, y + 0.05, -0.1); ha.position.set(0.25, y + 0.05, -0.1); hr.scale.setScalar(2.2); ha.scale.setScalar(2.2); g.add(hr, ha);
    v.g.add(g); v.barra = { r, a, hr, ha, fase: Math.random() * 9 };
  }
  function destellar(v) {
    if (!v.barra) return; const b = v.barra, f = Math.floor((tReal + b.fase) * 5) % 4, on1 = f === 0 || f === 2 ? 1 : 0.08, on2 = f === 1 || f === 3 ? 1 : 0.08;
    b.r.color.setRGB(on1, 0.05 * on1, 0.05 * on1); b.a.color.setRGB(0.1 * on2, 0.3 * on2, on2);
    b.hr.material.opacity = on1 * (0.35 + noche * 0.65); b.ha.material.opacity = on2 * (0.35 + noche * 0.65);
  }
  function quitarVehiculo(v) { escena.remove(v.g); if (v.jinete) quitarPersona(v.jinete); }

  // Vehículo nuevo del puesto, con su conductor.
  function llegaVehiculo() {
    const p = conductores[proximo++]; if (!p) return;
    const v = armarVehiculo(p.modelo.malla, p.color, { patente: p.patente, quemada: p.lucesQuemadas });
    v.p = p; v.estado = "llegando"; v.z = cola.length ? Math.min(-120, cola[cola.length - 1].z - 40) : -140; v.vel = 13; poner(v);
    if (p.modelo.tipo === "moto") {
      const pe = crearPersona(p.mujer ? "conductora" : "conductor", 0, -0.12, 0, v.g);
      if (pe) { v.jinete = pe; if (!p.sinCasco) ponerCasco(pe); }
    }
    cola.push(v);
    // Si la central lo tenía marcado, el aviso llega antes que él.
  }
  function paradaDe(v) { return RUTA.parada - 0.45 - v.largo / 2; }
  function hayPeaton(v, margen) {
    const dx = yo.x - v.x, dz = yo.z - v.z, s = Math.sin(v.rumbo), c = Math.cos(v.rumbo);
    const adelante = dx * s + dz * c, lado = dx * c - dz * s;
    return Math.abs(lado) < v.ancho / 2 + 0.45 && adelante > 0 && adelante < v.largo / 2 + margen ? adelante - v.largo / 2 : null;
  }
  function actualizarCola(dt) {
    for (let i = 0; i < cola.length; i++) {
      const v = cola[i];
      let obj = i === 0 ? paradaDe(v) : cola[i - 1].z - cola[i - 1].largo / 2 - 2.6 - v.largo / 2;
      for (const o of yendose.concat(patrulla ? [patrulla] : [])) if (Math.abs(o.x - v.x) < 2.4 && o.z > v.z) obj = Math.min(obj, o.z - o.largo / 2 - 2.6 - v.largo / 2);
      const pe = hayPeaton(v, 9); if (pe !== null) obj = Math.min(obj, v.z + pe - 1.3);
      if (v.estado === "parado") obj = v.z;
      const d = obj - v.z, deseada = d <= 0.02 ? 0 : Math.min(v.vmax, Math.sqrt(2 * 3.4 * d));
      const antes = v.vel; v.vel = Math.max(0, v.vel + clamp(deseada - v.vel, -8 * dt, 3.2 * dt));
      v.freno = v.vel < antes - 0.01 || v.vel < 0.1 ? 1 : 0;
      v.z = Math.min(v.z + v.vel * dt, Math.max(obj, v.z)); if (v.z >= obj - 0.01 && d >= 0) v.vel = Math.min(v.vel, 0.5);
      if (i === 0 && v.estado === "llegando" && Math.abs(v.z - paradaDe(v)) < 0.1) { v.estado = "parado"; v.vel = 0; parado = v; alLlegar(v); }
      poner(v);
    }
  }
  function alLlegar(v) {
    const p = v.p;
    insp = { v, p, dialogo: [], docs: false, soplo: null, baul: false, hallazgos: [], preguntas: {}, habla: 0, evita: 0, saludo: false, inicio: t };
    aviso(`Llegó ${p.modelo.nombre} ${p.colorNombre.toLowerCase()} · ${p.patente}`, "info", 3.5);
    avisar(true);
  }

  // Seguir una lista de puntos [x, z] frenando ante peatones y otros vehículos.
  function seguirRuta(v, dt) {
    const p = v.ruta && v.ruta[0];
    if (!p) { v.vel = Math.max(0, v.vel - 6 * dt); poner(v); return true; }
    const dx = p[0] - v.x, dz = p[1] - v.z, d = Math.hypot(dx, dz), ultimo = v.ruta.length === 1;
    let deseada = ultimo && !v.sigue ? Math.min(v.vmax, Math.sqrt(2 * 2.6 * Math.max(0, d - 0.15))) : v.vmax;
    const s = Math.sin(v.rumbo), c = Math.cos(v.rumbo);
    const frenoPor = (ox, oz, largo) => { const ex = ox - v.x, ez = oz - v.z, ad = ex * s + ez * c, la = ex * c - ez * s; if (ad > 0 && ad < v.largo / 2 + largo / 2 + 9 && Math.abs(la) < 2.1) deseada = Math.min(deseada, Math.max(0, (ad - v.largo / 2 - largo / 2 - 1.6) * 1.6)); };
    const pe = hayPeaton(v, 10); if (pe !== null) deseada = Math.min(deseada, Math.max(0, (pe - 1.4) * 1.6));
    for (const o of cola) if (o !== v) frenoPor(o.x, o.z, o.largo);
    for (const o of otros) if (o !== v) frenoPor(o.x, o.z, o.largo);
    for (const o of yendose) if (o !== v) frenoPor(o.x, o.z, o.largo);
    if (patrulla && patrulla !== v) frenoPor(patrulla.x, patrulla.z, patrulla.largo);
    const antes = v.vel; v.vel = Math.max(0, v.vel + clamp(deseada - v.vel, -8 * dt, 3 * dt)); v.freno = v.vel < antes - 0.01 || v.vel < 0.1 ? 1 : 0;
    const giro = ang(Math.atan2(dx, dz) - v.rumbo), maxGiro = (v.vel / 4.8) * dt;
    if (d > 0.4) v.rumbo = ang(v.rumbo + clamp(giro, -maxGiro, maxGiro));
    v.x += Math.sin(v.rumbo) * v.vel * dt; v.z += Math.cos(v.rumbo) * v.vel * dt;
    if (d < (ultimo ? 0.35 : 2.4)) { v.ruta.shift(); if (!v.ruta.length && v.rumboFinal !== undefined) v.rumbo = v.rumboFinal; }
    poner(v);
    return !v.ruta.length;
  }
  function despachar(v, destino) {
    if (cola.indexOf(v) < 0) return; // se reinició el turno mientras tanto
    cola.splice(cola.indexOf(v), 1); if (parado === v) parado = null;
    v.estado = destino; v.vmax = destino === "secuestro" ? 6 : 17; v.sigue = destino !== "secuestro";
    if (destino === "secuestro") {
      const k = playa++ % 8, fila = k < 4 ? 20.5 : 27.5, x = -16 - (k % 4) * 3.6;
      v.ruta = [[RUTA.carril, 9], [-8, 16.5], [-12, fila], [x, fila]]; v.rumboFinal = -Math.PI / 2;
    } else v.ruta = [[RUTA.carril, 420]];
    yendose.push(v);
  }
  function actualizarYendose(dt) {
    for (let i = yendose.length - 1; i >= 0; i--) {
      const v = yendose[i], listo = seguirRuta(v, dt);
      if (v.estado === "saliendo" && v.z > 330) { quitarVehiculo(v); yendose.splice(i, 1); }
      else if (v.estado === "secuestro" && listo && v.vel < 0.05) { yendose.splice(i, 1); v.estado = "secuestrado"; secuestrados.push(v); }
    }
  }
  // Tránsito de la otra mano: pasa sin parar (y frena si te parás adelante).
  function actualizarOtros(dt) {
    esperaOtro -= dt;
    if (esperaOtro <= 0 && otros.length < 3) {
      esperaOtro = 7 + Math.random() * 16;
      const m = elegir(Math.random, MODELOS), [, color] = elegir(Math.random, COLORES);
      const v = armarVehiculo(m.malla, color, { patente: patenteAzar(Math.random) });
      v.x = -RUTA.carril; v.z = 330; v.rumbo = Math.PI; v.vel = 18; v.vmax = m.tipo === "camion" ? 17 : 21; v.ruta = [[-RUTA.carril, -340]]; v.sigue = true; v.estado = "paso";
      if (m.tipo === "moto") { const pe = crearPersona(Math.random() < 0.3 ? "conductora" : "conductor", 0, -0.12, 0, v.g); if (pe) { v.jinete = pe; ponerCasco(pe); } }
      otros.push(v);
    }
    for (let i = otros.length - 1; i >= 0; i--) { const v = otros[i]; seguirRuta(v, dt); if (v.z < -330) { quitarVehiculo(v); otros.splice(i, 1); } }
  }

  // ════════════════════════════════════════════════════════════════════
  // Personas con esqueleto (conductores que bajan, policías, detenidos)
  // ════════════════════════════════════════════════════════════════════
  function crearPersona(n, x, z, rumbo, padre) {
    const o = Modelos.clonar(n); if (!o) return null;
    const L = Modelos.listos[n], mixer = new THREE.AnimationMixer(o), acc = {};
    for (const c of L.clips) acc[c.name] = mixer.clipAction(c);
    if (acc.idle) { acc.idle.play(); acc.idle.time = Math.random() * acc.idle.getClip().duration; }
    const pe = { n, o, mixer, acc, anim: "idle", x, z, rumbo, destino: null, seguir: false, vel: 1.3, velClip: L.velCaminar || 1.2, alFinal: null, padre };
    o.position.set(x, 0, z); o.rotation.y = rumbo; (padre || escena).add(o); personas.push(pe);
    return pe;
  }
  function quitarPersona(pe) { if (!pe) return; (pe.padre || escena).remove(pe.o); const i = personas.indexOf(pe); if (i >= 0) personas.splice(i, 1); }
  function animar(pe, nombre, escala = 1) {
    const a = pe.acc[nombre]; if (!a) return; a.timeScale = escala;
    if (pe.anim === nombre) return; const b = pe.acc[pe.anim]; a.reset().play(); if (b) a.crossFadeFrom(b, 0.25, false); pe.anim = nombre;
  }
  function ponerCasco(pe) {
    const cab = pe.o.getObjectByName("Head"); if (!cab) return;
    pe.o.updateMatrixWorld(true);
    const ws = cab.getWorldScale(new V()).x || 1, pos = cab.getWorldPosition(new V()).add(new V(0, 0.07, 0.01));
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), MAT.casco);
    casco.castShadow = true; cab.add(casco); casco.position.copy(cab.worldToLocal(pos)); casco.scale.setScalar(1 / ws);
    casco.quaternion.copy(cab.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(pe.o.getWorldQuaternion(new THREE.Quaternion())));
  }
  function actualizarPersonas(dt) {
    for (const pe of personas) {
      if (pe.seguir) {
        const dx = pe.x - yo.x, dz = pe.z - yo.z, d = Math.hypot(dx, dz);
        pe.destino = d > 1.9 ? [yo.x + (dx / d) * 1.4, yo.z + (dz / d) * 1.4] : null;
        pe.vel = d > 4 ? 2.6 : 1.4;
      }
      if (pe.destino) {
        const dx = pe.destino[0] - pe.x, dz = pe.destino[1] - pe.z, d = Math.hypot(dx, dz);
        if (d > 0.12) {
          const paso = Math.min(d, pe.vel * dt); pe.x += (dx / d) * paso; pe.z += (dz / d) * paso;
          pe.rumbo = ang(pe.rumbo + clamp(ang(Math.atan2(dx, dz) - pe.rumbo), -6 * dt, 6 * dt));
          animar(pe, "walk", pe.vel / pe.velClip);
        } else { pe.destino = null; animar(pe, "idle"); if (pe.alFinal) { const f = pe.alFinal; pe.alFinal = null; f(); } }
      } else {
        animar(pe, "idle");
        if (pe.mirarA) pe.rumbo = ang(pe.rumbo + clamp(ang(Math.atan2(pe.mirarA[0] - pe.x, pe.mirarA[1] - pe.z) - pe.rumbo), -3 * dt, 3 * dt));
      }
      if (!pe.padre) { pe.o.position.set(pe.x, 0, pe.z); pe.o.rotation.y = pe.rumbo; }
      // Los lejanos se animan menos seguido: con 15 personas el esqueleto pesa.
      const lejos = (pe.x - yo.x) ** 2 + (pe.z - yo.z) ** 2 > 900;
      pe.acum = (pe.acum || 0) + dt; if (!lejos || pe.acum > 0.1) { pe.mixer.update(pe.acum); pe.acum = 0; }
    }
  }
  // El conductor se baja por la puerta izquierda (+X, del lado del eje).
  function bajarConductor(v) {
    const p = v.p;
    if (v.jinete) { quitarPersona(v.jinete); v.jinete = null; }
    // Si el policía está parado en la puerta, se baja un poco más adelante (no encima).
    let z = v.z + v.largo * 0.08; if (cercaDe(yo.x, yo.z, v.x + v.ancho / 2 + 0.55, z, 1.2)) z = yo.z + 1.3;
    const pe = crearPersona(p.mujer ? "conductora" : "conductor", v.x + v.ancho / 2 + 0.55, z, Math.PI / 2);
    if (pe) { pe.p = p; pe.mirarA = [yo.x, yo.z]; if (p.modelo.tipo === "moto" && !p.sinCasco) ponerCasco(pe); }
    Sonido.puerta();
    return pe;
  }

  // ════════════════════════════════════════════════════════════════════
  // Patrullero que viene a buscar a los detenidos
  // ════════════════════════════════════════════════════════════════════
  function llamarPatrullero() {
    if (patrulla) { aviso("El patrullero ya está en camino.", "info"); return; }
    const esperan = zona.filter((pe) => pe.arrestado && !pe.subido);
    if (!esperan.length) { aviso(seguidor ? "Primero dejá al detenido en la Zona de Detenidos." : "No hay detenidos para trasladar.", "info"); return; }
    radio(`Puesto Ruta 11 a Central: solicito móvil para traslado de ${esperan.length} detenido${esperan.length > 1 ? "s" : ""}. — Central: recibido, el móvil 7 va en camino.`);
    // Viene del norte por su mano (x = +1,9, hacia −Z) y para frente a la zona:
    // los detenidos cruzan la ruta custodiados y el tránsito de esa mano espera.
    const v = armarVehiculo("patrullero", null, {}), lado = -RUTA.carril;
    v.x = lado; v.z = 300; v.rumbo = Math.PI; v.vel = 20; v.vmax = 20; v.estado = "patrulla"; v.sigue = false;
    v.ruta = [[lado, PUESTO.zona[2]]]; v.rumboFinal = Math.PI;
    barraLuces(v); poner(v); patrulla = v; v.fase = "viene"; Sonido.sirena(true);
    avisar(true);
  }
  function actualizarPatrulla(dt) {
    const v = patrulla; if (!v) return;
    destellar(v);
    const listo = seguirRuta(v, dt);
    if (v.fase === "viene" && listo && v.vel < 0.05) {
      v.fase = "carga"; Sonido.sirena(false); Sonido.puerta();
      const esperan = zona.filter((pe) => pe.arrestado && !pe.subido);
      v.faltan = esperan.length;
      esperan.forEach((pe, i) => { pe.destino = [v.x - v.ancho / 2 - 0.45, v.z + 0.4 - i * 0.55]; pe.vel = 1.2; pe.alFinal = () => { pe.subido = true; quitarPersona(pe); zona.splice(zona.indexOf(pe), 1); v.faltan--; sumar(10, "Detenido trasladado"); }; });
    } else if (v.fase === "carga" && v.faltan <= 0) {
      v.fase = "va"; Sonido.puerta(); radio("Móvil 7 a Central: detenidos a bordo, salimos para la comisaría."); v.sigue = true; v.vmax = 18;
      v.ruta = [[-RUTA.carril, -340]];
    } else if (v.fase === "va" && v.z < -320) { quitarVehiculo(v); patrulla = null; avisar(true); }
  }

  // ════════════════════════════════════════════════════════════════════
  // Inspección: lo que la interfaz le pide al juego
  // ════════════════════════════════════════════════════════════════════
  function decir(quien, txt) { if (!insp) return; insp.dialogo.push({ quien, texto: txt, id: ++idAviso }); avisar(true); }
  function contesta(txt, evita) {
    const p = insp.p, dur = Sonido.voz(txt, { mujer: p.mujer, borracho: p.estado === "borracho", nervioso: p.estado === "nervioso" || p.estado === "falso" });
    insp.habla = performance.now() + Math.max(900, dur * 1000); if (evita) insp.evita = performance.now() + 2200;
    decir("el", txt);
  }
  function saludo() {
    if (!insp || insp.saludo) return; insp.saludo = true;
    const p = insp.p, h = hora % 24, s = h >= 20 || h < 6 ? "Buenas noches" : h >= 12 ? "Buenas tardes" : "Buen día";
    const txt = p.estado === "borracho" ? arrastrar(`${s}, oficial... ¿todo bien?`, rnd) : p.estado === "nervioso" || p.estado === "falso" ? `${s}... ¿pasa algo, oficial?` : `${s}, oficial.`;
    const I = insp; luego(0.35, () => insp === I && contesta(txt));
  }
  const PREG = Object.fromEntries(PREGUNTAS);
  function preguntar(q) {
    if (!insp) return; const veces = insp.preguntas[q] || 0; insp.preguntas[q] = veces + 1;
    decir("yo", PREG[q]);
    const p = insp.p, evita = (p.estado === "nervioso" || p.estado === "falso") && (q === "baul" || q === "nombre" || q === "origen" || q === "motivo");
    const I = insp; luego(0.45, () => insp === I && contesta(responder(p, q, veces, rnd), evita));
  }
  function pedirDocs() {
    if (!insp || insp.docs) return; insp.docs = true; const d = insp.p.docs;
    decir("yo", "Documentación del vehículo y del conductor, por favor.");
    const faltan = [!d.licencia.presente && "la licencia", !d.cedula.presente && "la cédula", !d.seguro.presente && "el seguro"].filter(Boolean);
    const txt = faltan.length ? `Tenga... ${faltan.join(" y ")} no la${faltan.length > 1 ? "s" : ""} tengo acá, oficial. La dejé en casa.` : "Sí, oficial. Tenga, acá está todo.";
    const I = insp; luego(0.45, () => { if (insp !== I) return; contesta(insp.p.estado === "borracho" ? arrastrar(txt, rnd) : txt); Sonido.clic(); });
  }
  // El alcoholímetro mide lo que tomó, con un error chico de la lectura.
  function soplar() {
    if (!insp) return 0; const p = insp.p;
    decir("yo", "Sople fuerte y sostenido por la boquilla, hasta que le diga.");
    const lectura = p.alcohol > 0 ? clamp(p.alcohol + (rnd() - 0.5) * 0.06, 0, 2.5) : 0;
    insp.soplo = Math.round(lectura * 100) / 100;
    const I = insp; luego(0.3, () => insp === I && contesta(responder(p, "soplar", 0, rnd)));
    return insp.soplo;
  }
  function abrirBaul() {
    if (!insp || panel) return;
    if (!insp.baul) { insp.baul = true; const txt = responder(insp.p, "abrir", 0, rnd); Sonido.voz(txt, { mujer: insp.p.mujer, borracho: insp.p.estado === "borracho" }); aviso("«" + txt + "»", "voz", 3.5); decir("el", txt); }
    Sonido.baul(); abrirPanel("baul");
  }
  function secuestrar(obj) {
    if (!insp || !obj.ilegal || obj.visto) return; obj.visto = true; insp.hallazgos.push(obj);
    Sonido.hallazgo(); sumar(15, obj.ilegal === "drogas" ? "Hallazgo: paquete con sustancia" : "Hallazgo: arma de fuego");
    avisar(true);
  }
  function abrirPanel(nombre) {
    panel = nombre; if (document.pointerLockElement) document.exitPointerLock();
    if (nombre === "ventanilla") saludo();
    avisar(true);
  }
  function cerrarPanel() { panel = null; avisar(true); }

  // ── puntaje ──
  let reputacion = 100, recaudado = 0, atendidos = 0;
  function sumar(n, porque) { reputacion += n; aviso(`${n >= 0 ? "+" : ""}${n} · ${porque}`, n >= 0 ? "bien" : "mal", 4); if (reputacion < 0 && modo === "jugando" && finEn < 0) { motivoFin = "relevado"; finEn = t + 3; } }
  function nombreFalta(k, p) { return k === "sinCinturon" && p && p.modelo.tipo === "moto" ? "Sin casco reglamentario" : FALTAS[k].nombre; }
  function evaluar(p, decision, cargos) {
    const reales = faltasReales(p), correcta = resolucionCorrecta(reales);
    const lista = reales.map((k) => nombreFalta(k, p)).join(", ") || "sin faltas";
    let d = 0, ok = false, msg;
    if (decision === correcta) {
      ok = true;
      if (decision === "multar") {
        const leves = reales.filter((k) => LEVES.includes(k)), bien = cargos.filter((k) => leves.includes(k)).length, mal = cargos.filter((k) => !leves.includes(k)).length;
        d = Math.round((25 * bien) / Math.max(1, leves.length)) - 10 * mal; ok = mal === 0 && bien === leves.length;
        msg = ok ? "Multa correcta" : mal ? "Multa con cargos que no correspondían" : "Multa incompleta: se te pasó una falta";
      } else { d = { pasar: 25, retener: 50, arrestar: 100 }[decision]; msg = { pasar: "Estaba todo en regla", retener: "Vehículo retenido con razón", arrestar: "Arresto correcto" }[decision]; }
    } else if (decision === "arrestar") { d = -100; msg = "¡Arrestaste a alguien que no había cometido un delito!"; }
    else if (correcta === "arrestar") { d = decision === "retener" ? -50 : -80; msg = decision === "retener" ? "Correspondía arresto, no solo retener" : "Dejaste ir a alguien que tenía que quedar detenido"; }
    else if (decision === "retener") { d = -40; msg = "Retuviste un vehículo sin falta grave"; }
    else { d = -30; msg = correcta === "pasar" ? "Multaste sin motivo" : correcta === "multar" ? "Había faltas para multar" : "Había una falta grave: correspondía retener"; }
    return { d, ok, msg, correcta, reales, lista };
  }
  function resolver(decision, cargos = []) {
    if (!insp || insp.resuelto) return null;
    const { v, p } = insp; insp.resuelto = true;
    const ev = evaluar(p, decision, cargos);
    const monto = decision === "multar" ? cargos.reduce((s, k) => s + (FALTAS[k].monto || 0), 0) : 0;
    hist.push({ patente: p.patente, nombre: p.docs.dni.nombre, real: p.nombre, vehiculo: `${p.modelo.nombre} ${p.colorNombre.toLowerCase()}`, decision, correcta: ev.correcta, d: ev.d, ok: ev.ok, msg: ev.msg, faltas: ev.lista, monto, soplo: insp.soplo, hallazgos: insp.hallazgos.length, estado: p.estado });
    atendidos++; recaudado += monto;
    if (monto) Sonido.impresora();
    (ev.d >= 0 ? Sonido.bien : Sonido.mal)();
    sumar(ev.d, ev.msg);
    panel = null;
    if (decision === "pasar" || decision === "multar") {
      const txt = responder(p, decision === "multar" ? "multa" : "pasar", 0, rnd); Sonido.voz(txt, { mujer: p.mujer, borracho: p.estado === "borracho" }); aviso("«" + txt + "»", "voz", 3);
      luego(decision === "multar" ? 1.6 : 0.7, () => despachar(v, "saliendo"));
    } else {
      const pe = bajarConductor(v);
      if (pe) {
        if (decision === "retener") {
          pe.demorado = true; const k = zona.length; pe.destino = [PUESTO.zona[0] - 2 + (k % 5) * 1, PUESTO.zona[2] + 1.1]; pe.vel = 1.2; pe.mirarA = [0, PUESTO.zona[2]]; zona.push(pe);
        } else {
          const txt = responder(p, "esposas", 0, rnd); Sonido.voz(txt, { mujer: p.mujer, borracho: p.estado === "borracho" }); aviso("«" + txt + "»", "voz", 3);
          arresto = { pe, p, correcto: ev.correcta === "arrestar" };
          if (opc.ayudas) aviso("Acercate y esposalo [R]. Después llevalo a la Zona de Detenidos.", "info", 6);
        }
      }
      luego(1.8, () => despachar(v, "secuestro"));
    }
    insp = null; avisar(true);
    return ev;
  }

  // ════════════════════════════════════════════════════════════════════
  // Acciones del policía (teclas E, F, R, Q y botones del teléfono)
  // ════════════════════════════════════════════════════════════════════
  function puntos() {
    const v = parado; if (!v) return {};
    const moto = v.malla === "moto";
    return { ventanilla: [v.x + v.ancho / 2 + 0.5, v.z + (moto ? 0 : v.largo * 0.1)], baul: [v.x, v.z - v.largo / 2 - 0.7] };
  }
  function enZona(x, z) { return Math.abs(x - PUESTO.zona[0]) < 3.4 && Math.abs(z - PUESTO.zona[2]) < 2.4; }
  // Qué se puede hacer desde donde está parado el policía.
  function contexto() {
    const a = [];
    if (modo !== "jugando" || panel) return a;
    if (seguidor && (enZona(yo.x, yo.z) || enZona(seguidor.x, seguidor.z))) a.push({ tecla: "E", texto: "Dejar en la Zona de Detenidos", id: "zona" });
    if (arresto && !arresto.pe.esposado && cercaDe(yo.x, yo.z, arresto.pe.x, arresto.pe.z, 2.2)) a.push({ tecla: "R", texto: "Esposar", id: "esposar" });
    const P = puntos();
    if (parado && insp && !insp.resuelto) {
      if (cercaDe(yo.x, yo.z, P.ventanilla[0], P.ventanilla[1], 1.9)) a.push({ tecla: "E", texto: "Hablar con el conductor", id: "ventanilla" });
      if (cercaDe(yo.x, yo.z, P.baul[0], P.baul[1], 1.9)) a.push({ tecla: "F", texto: parado.malla === "camion" ? "Revisar la carga con la linterna" : parado.malla === "moto" ? "Revisar el baulito de la moto" : "Revisar el baúl con la linterna", id: "baul" });
    }
    return a;
  }
  function accion(tec) {
    if (modo !== "jugando" || pausado) return;
    Sonido.iniciar();
    const a = contexto().find((x) => x.tecla === tec);
    if (tec === "Q") { llamarPatrullero(); return; }
    if (!a) { if (tec === "F") { linternaOn = !linternaOn; Sonido.clic(); avisar(true); } return; }
    if (a.id === "ventanilla") abrirPanel("ventanilla");
    else if (a.id === "baul") abrirBaul();
    else if (a.id === "esposar") {
      const pe = arresto.pe; pe.esposado = true; pe.seguir = true; pe.mirarA = null; seguidor = pe; Sonido.esposas();
      // Cartelito arriba de la cabeza: el clip no tiene pose de esposado.
      const et = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.texCanvas(256, (g, w, h) => { g.fillStyle = "rgba(160,20,30,0.9)"; g.beginPath(); g.roundRect ? g.roundRect(4, 4, w - 8, h - 8, 18) : g.rect(4, 4, w - 8, h - 8); g.fill(); g.fillStyle = "#fff"; g.font = "800 34px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("⛓ DETENIDO", w / 2, h / 2 + 2); }, false, 64), depthTest: false, transparent: true }));
      et.scale.set(0.9, 0.225, 1); et.position.y = 2.05; et.renderOrder = 5; pe.o.add(et);
      aviso("Esposado. Llevalo a la Zona de Detenidos (el rectángulo amarillo).", "info", 5);
    } else if (a.id === "zona") {
      const pe = seguidor, k = zona.length; pe.seguir = false; pe.arrestado = true; pe.destino = [PUESTO.zona[0] - 2 + (k % 5), PUESTO.zona[2] + 1.1]; pe.vel = 1.2; pe.mirarA = [0, PUESTO.zona[2]];
      zona.push(pe); seguidor = null;
      sumar(arresto && arresto.correcto ? 10 : 0, "Detenido en la zona");
      arresto = null; if (opc.ayudas) aviso("Cuando quieras, llamá al patrullero [Q] para el traslado.", "info", 5);
    }
    avisar(true);
  }

  // ════════════════════════════════════════════════════════════════════
  // Entrada: teclado, mouse (con o sin captura) y toques
  // ════════════════════════════════════════════════════════════════════
  function escuchar() {
    addEventListener("keydown", (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      tecla[e.code] = true;
      if (e.code === "KeyE") accion("E"); else if (e.code === "KeyF") accion("F"); else if (e.code === "KeyR") accion("R"); else if (e.code === "KeyQ") accion("Q");
      else if (e.code === "Escape" && modo === "jugando") { if (panel) cerrarPanel(); else if (!pausado) pausar(true); }
      else if (e.code === "KeyP" && modo === "jugando" && !panel) pausar(!pausado);
      if (e.code === "ShiftLeft") correr = true;
    });
    addEventListener("keyup", (e) => { tecla[e.code] = false; if (e.code === "ShiftLeft") correr = false; });
    addEventListener("blur", () => { for (const k in tecla) tecla[k] = false; });
    lienzo.addEventListener("click", () => {
      Sonido.iniciar();
      if (modo === "jugando" && !panel && !pausado && !TOCABLE && !document.pointerLockElement && lienzo.requestPointerLock) { try { const r = lienzo.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* sin captura: se mira arrastrando */ } }
    });
    document.addEventListener("pointerlockchange", () => avisar(true));
    addEventListener("mousemove", (e) => { if (document.pointerLockElement === lienzo) girar(e.movementX, e.movementY, 0.0022); });
    lienzo.addEventListener("pointerdown", (e) => { if (document.pointerLockElement) return; arrastre.activo = true; arrastre.id = e.pointerId; arrastre.x = e.clientX; arrastre.y = e.clientY; });
    addEventListener("pointermove", (e) => { if (!arrastre.activo || e.pointerId !== arrastre.id) return; girar(e.clientX - arrastre.x, e.clientY - arrastre.y, TOCABLE ? 0.0055 : 0.004); arrastre.x = e.clientX; arrastre.y = e.clientY; });
    const soltar = (e) => { if (e.pointerId === arrastre.id) arrastre.activo = false; };
    addEventListener("pointerup", soltar); addEventListener("pointercancel", soltar);
    addEventListener("resize", ajustar);
  }
  function girar(dx, dy, k) { if (modo !== "jugando" || panel || pausado) return; yo.mira = null; yo.yaw -= dx * k * opc.sens; yo.pitch = clamp(yo.pitch - dy * k * opc.sens, -1.25, 1.1); }
  function ajustar() { if (!R) return; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 78 : 68; cam.updateProjectionMatrix(); }

  // ── movimiento del policía con choques simples contra vehículos y garita ──
  function obstaculos() {
    const o = [];
    for (const v of cola.concat(yendose, otros, patrulla ? [patrulla] : [])) o.push([v.x, v.z, v.ancho / 2 + 0.3, v.largo / 2 + 0.3, v.rumbo]);
    o.push([PUESTO.garita[0], PUESTO.garita[2], 3.2, 2.1, 0]);
    if (M.patrulleroParado) o.push([PUESTO.patrullero[0], PUESTO.patrullero[2], 1.6, 2.9, M.patrulleroParado.rotation.y]);
    return o;
  }
  function empujar() {
    for (const [cx, cz, hx, hz, r] of obstaculos()) {
      const s = Math.sin(r), c = Math.cos(r), dx = yo.x - cx, dz = yo.z - cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
        const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
        let nx = lx, nz = lz; if (px < pz) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz;
        yo.x = cx + nx * c + nz * s; yo.z = cz - nx * s + nz * c;
      }
    }
    yo.x = clamp(yo.x, -40, 14); yo.z = clamp(yo.z, -70, 60);
  }
  function moverYo(dt) {
    let ax = 0, az = 0;
    if (!panel && !pausado) {
      if (tecla.KeyW || tecla.ArrowUp) az += 1; if (tecla.KeyS || tecla.ArrowDown) az -= 1;
      if (tecla.KeyA || tecla.ArrowLeft) ax -= 1; if (tecla.KeyD || tecla.ArrowRight) ax += 1;
      ax += joy.x; az += joy.z;
    }
    const n = Math.hypot(ax, az); if (n > 1) { ax /= n; az /= n; }
    const vel = (correr || n > 0.95 && TOCABLE && joy.correr ? 5.4 : 3.1) * Math.min(1, n || 0);
    const s = Math.sin(yo.yaw), c = Math.cos(yo.yaw);
    const fx = -s, fz = -c, rx = c, rz = -s;
    const mx = (fx * az + rx * ax), mz = (fz * az + rz * ax), mn = Math.hypot(mx, mz) || 1;
    const px = yo.x, pz = yo.z;
    if (n > 0.05) { yo.x += (mx / mn) * vel * dt; yo.z += (mz / mn) * vel * dt; }
    empujar();
    const d = Math.hypot(yo.x - px, yo.z - pz); yo.paso += d; yo.bob += d * 2.3;
    if (yo.paso > (correr ? 0.85 : 0.68)) { yo.paso = 0; Sonido.paso(); }
  }
  function camaraYo(dt) {
    // Al abrir la ventanilla la vista va sola hacia el conductor.
    if (panel === "ventanilla" && parado) { const P = puntos(); yo.mira = [P.ventanilla[0] - 0.6, 1.2, P.ventanilla[1]]; }
    if (yo.mira) {
      const dx = yo.mira[0] - yo.x, dz = yo.mira[2] - yo.z, dy = yo.mira[1] - 1.66;
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      yo.yaw = ang(yo.yaw + ang(yaw - yo.yaw) * Math.min(1, dt * 6)); yo.pitch += (pitch - yo.pitch) * Math.min(1, dt * 6);
      if (!panel) yo.mira = null;
    }
    cam.position.set(yo.x, 1.66 + Math.sin(yo.bob) * 0.035, yo.z);
    cam.rotation.set(yo.pitch, yo.yaw, 0, "YXZ");
  }
  // En el menú: la cámara da vueltas despacio alrededor del puesto.
  function camaraMenu() {
    const a = tReal * 0.045 - 0.6;
    cam.position.set(-3 + Math.sin(a) * 26, 7.5, -4 + Math.cos(a) * 26); cam.lookAt(-3, 1.2, -2);
  }

  // ════════════════════════════════════════════════════════════════════
  // Radio: avisos de la central (algunos te anticipan a quién buscar)
  // ════════════════════════════════════════════════════════════════════
  const CHARLA = [
    "Central a móviles: se solicita precaución en ruta 11 por animales sueltos a la altura del km 1.030.",
    "Central a Puesto Ruta 11: se recuerda control de alcoholemia en toda la franja nocturna.",
    "Móvil 3 a Central: sin novedad en el acceso a Pampa del Indio.",
    "Central a móviles: visibilidad reducida por humo de quema en banquinas, km 1.042.",
    "Central a Puesto Ruta 11: recuerden labrar las actas con letra clara, por favor.",
    "Móvil 12 a Central: accidente menor en ruta 90, sin heridos. Tránsito normal.",
  ];
  function planearRadio(n) {
    radioPlan = [];
    conductores.forEach((p, i) => {
      if (!(p.robado || p.captura) || rnd() > 0.7) return;
      const txt = p.robado ? `Central a puestos: buscamos ${p.modelo.nombre} color ${p.colorNombre.toLowerCase()}, patente ${p.patente}, con pedido de secuestro. Puede circular con documentación adulterada.`
        : `Central a puestos: pedido de captura vigente a nombre de ${nombreLindo(p.nombre)} (${p.nombre}), ${p.edad} años. Se desplaza por ruta 11.`;
      radioPlan.push({ antesDe: Math.max(0, i - 1), texto: txt, tipo: "bolo" });
    });
    for (let k = 0; k < 3; k++) radioPlan.push({ enHora: horaIni + 0.6 + k * (horaFin - horaIni) / 3.4 + rnd() * 0.5, texto: elegir(rnd, CHARLA), tipo: "radio" });
  }
  function actualizarRadio() {
    for (let i = radioPlan.length - 1; i >= 0; i--) {
      const r = radioPlan[i];
      if ((r.antesDe !== undefined && proximo >= r.antesDe && t > 6) || (r.enHora && hora >= r.enHora)) { radio(r.texto, r.tipo); radioPlan.splice(i, 1); break; }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // El bucle
  // ════════════════════════════════════════════════════════════════════
  let ultimo = 0, raf = 0, congelado = false, msRender = 0;
  function paso(dt) {
    tReal += dt;
    if (modo === "jugando" && !pausado) {
      t += dt; hora = Math.min(horaFin, horaIni + (t / (opc.minutos * 60)) * (horaFin - horaIni));
      moverYo(dt);
      // Llegadas: hasta tres en la fila; si está vacía, enseguida.
      esperaLlegada -= dt;
      if (proximo < conductores.length && cola.length < 3 && (esperaLlegada <= 0 || cola.length === 0 && esperaLlegada < 10)) { llegaVehiculo(); esperaLlegada = 16 + rnd() * 14; }
      actualizarRadio();
      if (finEn < 0 && (hora >= horaFin || (proximo >= conductores.length && !cola.length && !seguidor && !arresto && !panel))) { motivoFin = hora >= horaFin ? "hora" : "todos"; finEn = t + 4; }
      if (finEn >= 0 && t >= finEn && !panel) terminar();
    }
    if (modo === "menu") hora = 19.1;
    if (!pausado) {
      reloj += dt;
      for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const f = tareas[i].fn; tareas.splice(i, 1); f(); }
      actualizarCola(dt); actualizarYendose(dt); actualizarOtros(dt); actualizarPatrulla(dt); actualizarPersonas(dt);
      if (M.patrulleroParado && M.patrulleroParado.userData.v) destellar(M.patrulleroParado.userData.v);
      conos(dt);
    }
    noche = M.ponerHora(hora, new V(yo.x, 0, yo.z));
    MAT.halo.opacity = 0.1 + noche * 0.85; MAT.haz.opacity = noche * 0.55; MAT.haloRojo.opacity = noche * 0.6;
    for (const v of cola.concat(yendose)) v.g.children.forEach((c) => { if (c.material === MAT.stop) c.scale.setScalar(v.freno ? 1.25 : 1); });
    linterna.intensity = linternaOn && modo === "jugando" ? 38 : 0;
    Sonido.ambiente(noche);
    // El motor que se oye es el del vehículo más cercano.
    let cerca = null, dm = 1e9; for (const v of cola.concat(yendose, otros, patrulla ? [patrulla] : [])) { const d = Math.hypot(v.x - yo.x, v.z - yo.z); if (d < dm) { dm = d; cerca = v; } }
    if (cerca) Sonido.motor(dm, Math.max(cerca.vel, 1.5), cerca.malla === "camion"); else Sonido.motor(999, 0, false);
    if (modo === "jugando") camaraYo(dt); else camaraMenu();
    volcar();
    avisar();
  }
  // Estado para la interfaz (también al instante tras una acción, sin esperar al cuadro).
  function volcar() {
    avisos = avisos.filter((a) => a.hasta > tReal);
    const acc = contexto();
    Object.assign(est, {
      modo, pausado, hora: texto(hora), reputacion, recaudado, atendidos, total: conductores.length, cola: cola.length, acciones: acc, pista: acc[0] || null,
      panel, zona: zona.filter((pe) => pe.arrestado).length, demorados: zona.filter((pe) => pe.demorado).length, patrulla: patrulla ? patrulla.fase : null, linterna: linternaOn, avisos,
      bloqueado: !!document.pointerLockElement, noche, seguidor: !!seguidor, arresto: !!(arresto && !arresto.pe.esposado), llegando: !!(cola[0] && cola[0].estado === "llegando"), parado: !!(parado && insp && !insp.resuelto), fin: finEn >= 0 ? Math.max(0, finEn - t) : null,
    });
    if (est.radio && est.radio.hasta < tReal) est.radio = null;
  }
  let abiertos = 0;
  function conos(dt) {
    const abrir = yendose.some((v) => Math.abs(v.x - RUTA.carril) < 2.2 && v.z > -12 && v.z < 7);
    abiertos = clamp(abiertos + (abrir ? 3 : -1.5) * dt, 0, 1);
    M.conos.forEach((c, i) => {
      if (!c.userData.base) c.userData.base = c.position.clone();
      const b = c.userData.base, k = suave(0, 1, abiertos);
      c.position.set(lerp(b.x, -4.15, k), 0, lerp(b.z, 1.3 + i * 0.6, k));
    });
  }
  function bucle(ahora) {
    raf = requestAnimationFrame(bucle);
    const dt = Math.min(0.05, (ahora - (ultimo || ahora)) / 1000); ultimo = ahora;
    if (congelado) return; // las pruebas avanzan a mano con simular()
    paso(dt);
    const t0 = performance.now(); R.render(escena, cam); msRender = msRender * 0.9 + (performance.now() - t0) * 0.1;
  }

  // ════════════════════════════════════════════════════════════════════
  // Arranque, turno y fin
  // ════════════════════════════════════════════════════════════════════
  function aplicarOpciones(o) {
    opc = Object.assign(opc, o || {});
    Sonido.ponerVolumen(opc.volumen);
    if (!R) return;
    const alta = opc.calidad === "alta", baja = opc.calidad === "baja";
    R.setPixelRatio(Math.min(devicePixelRatio || 1, alta ? 2 : baja ? 0.8 : 1.3));
    const sombras = !baja;
    if (R.shadowMap.enabled !== sombras) { R.shadowMap.enabled = sombras; escena.traverse((m) => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true)); }); }
    M.densidad(alta ? 1 : baja ? 0.3 : 0.6);
    M.sol.shadow.mapSize.set(alta ? 2048 : 1024, alta ? 2048 : 1024); if (M.sol.shadow.map) { M.sol.shadow.map.dispose(); M.sol.shadow.map = null; }
    ajustar();
  }
  function montar(canvas) {
    lienzo = canvas;
    R = new THREE.WebGLRenderer({ canvas, antialias: opc.calidad !== "baja", powerPreference: "high-performance" });
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    cam = new THREE.PerspectiveCamera(68, 1, 0.08, 1400);
    M = crearMundo(R); escena = M.escena; materiales();
    escena.add(cam);
    linterna = new THREE.SpotLight(0xfff3dc, 0, 30, 0.42, 0.55, 1.4); linterna.position.set(0.25, -0.2, 0); cam.add(linterna); cam.add(linterna.target); linterna.target.position.set(0, -0.5, -6);
    // El patrullero estacionado, con las balizas prendidas como en la foto.
    if (M.patrulleroParado) { const v = { g: M.patrulleroParado, tam: Modelos.listos.patrullero.tam }; barraLuces(v); M.patrulleroParado.userData.v = v; }
    // Compañeros: uno en la garita y otro cerca de las motos.
    compas = [crearPersona("policia", -8.3, -0.6, Math.PI / 2), crearPersona("policia", -6.0, -13.5, Math.PI / 2 - 0.4)].filter(Boolean);
    compas.forEach((pe) => (pe.mirarA = [0, pe.z - 6]));
    escuchar(); aplicarOpciones(opc);
    modo = "menu"; est.modo = modo;
    R.compile(escena, cam);
    requestAnimationFrame(bucle);
    window.__ruta = { Juego: api, simular, get yo() { return yo; }, get conductores() { return conductores; }, get parado() { return parado; }, get seguidor() { return seguidor; }, get otros() { return otros; }, get yendose() { return yendose; }, congelar(b) { congelado = b; }, get msRender() { return msRender; }, get info() { return R.info.render; }, get cola() { return cola; }, get insp() { return insp; }, get personas() { return personas; }, get zona() { return zona; }, get patrulla() { return patrulla; }, R, cam, get escena() { return escena; } };
  }
  function limpiar() {
    for (const v of cola.concat(yendose)) quitarVehiculo(v);
    for (const pe of personas.slice()) if (!compas.includes(pe) && !pe.padre) quitarPersona(pe);
    if (patrulla) { quitarVehiculo(patrulla); patrulla = null; Sonido.sirena(false); }
    tareas.length = 0; cola = []; yendose = []; zona = []; parado = null; seguidor = null; arresto = null; insp = null; panel = null;
  }
  function empezar(o) {
    aplicarOpciones(o); Sonido.iniciar();
    limpiar(); for (const v of secuestrados.splice(0)) quitarVehiculo(v);
    const turnos = { dia: [9, 17], tarde: [17, 25], noche: [21, 29] }; [horaIni, horaFin] = turnos[opc.turno] || turnos.tarde; hora = horaIni;
    rnd = azar((Date.now() ^ 0x5eed) >>> 0); registro = crearRegistro();
    // El 30 % sospechoso sale del generador; se pide al menos uno de cada tanto para que el turno tenga historias.
    for (let intento = 0; intento < 40; intento++) {
      registro = crearRegistro(); conductores = Array.from({ length: opc.vehiculos }, () => generarConductor(rnd, registro));
      const sos = conductores.filter((p) => p.sospechoso).length, borr = conductores.filter((p) => p.estado === "borracho").length;
      if (sos >= Math.max(2, Math.round(opc.vehiculos * 0.22)) && borr >= 1 && sos <= Math.round(opc.vehiculos * 0.45)) break;
    }
    // Personas del padrón que no pasan por el puesto (para que el sistema no tenga solo a los de hoy).
    for (let i = 0; i < 30; i++) { const m = rnd() < 0.3, e = 20 + Math.floor(rnd() * 50), nac = sumarDias(HOY, -e * 365); registro.agregarPersona({ dni: dniAzar(rnd, nac.getFullYear()), nombre: nombreAzar(rnd, m), nacimiento: nac, rostro: rostroAzar(rnd, m, e), captura: rnd() < 0.05, motivo: "Robo — Juzgado de Garantías de Resistencia", antecedentes: "Sin antecedentes" }); }
    proximo = 0; esperaLlegada = 2; t = 0; hist = []; novedades = []; avisos = []; reputacion = 100; recaudado = 0; atendidos = 0; finEn = -1; motivoFin = ""; playa = 0;
    yo.x = -6.8; yo.z = -2.5; yo.yaw = -1.2; yo.pitch = -0.05; yo.mira = null;
    planearRadio(conductores.length);
    modo = "jugando"; pausado = false;
    radio("Central a Puesto Ruta 11: comienza su turno. Control de documentación y alcoholemia. Buen servicio.");
    avisar(true);
  }
  function terminar() {
    if (modo !== "jugando") return;
    // Arrestos a medio hacer: el que no se esposó o no se llevó a la zona cuenta como fuga.
    if (arresto || seguidor) sumar(-20, "Un detenido quedó sin custodia al terminar el turno");
    const sinTrasladar = zona.filter((pe) => pe.arrestado && !pe.subido).length;
    const st = leer("stats", STATS_BASE);
    st.turnos++; st.mejor = Math.max(st.mejor, reputacion); st.arrestos += hist.filter((h) => h.decision === "arrestar" && h.ok).length; st.multas += hist.filter((h) => h.decision === "multar").length; st.hallazgos += hist.reduce((s, h) => s + h.hallazgos, 0);
    guardar("stats", st);
    resumenFinal = { hist: hist.slice(), reputacion, recaudado, atendidos, total: conductores.length, motivo: motivoFin, sinTrasladar, mejor: st.mejor, stats: st };
    modo = "fin"; panel = null; if (document.pointerLockElement) document.exitPointerLock();
    Sonido.sirena(false);
    avisar(true);
  }
  let resumenFinal = null;
  function pausar(b) { if (modo !== "jugando") return; pausado = b; if (b && document.pointerLockElement) document.exitPointerLock(); avisar(true); }
  function alMenu() { limpiar(); modo = "menu"; pausado = false; avisar(true); }
  // Para las pruebas: avanzar el mundo sin esperar al reloj.
  function simular(seg, pasoS = 1 / 30) { for (let s = 0; s < seg; s += pasoS) paso(pasoS); R.render(escena, cam); }

  const api = {
    est, montar, empezar, pausar, alMenu, accion, aplicarOpciones, preguntar, pedirDocs, soplar, resolver, abrirPanel, cerrarPanel, secuestrar, nombreFalta, evaluar,
    suscribir(f) { subs.add(f); return () => subs.delete(f); },
    mover(x, z, corriendo) { joy.x = x; joy.z = z; joy.correr = !!corriendo; },
    mirar(dx, dy) { girar(dx, dy, 0.006); },
    linterna() { accion("F"); },
    get insp() { return insp; }, get registro() { return registro; }, get novedades() { return novedades; }, get resumen() { return resumenFinal; }, get opciones() { return opc; }, get hoy() { return HOY; },
  };
  return api;
})();
