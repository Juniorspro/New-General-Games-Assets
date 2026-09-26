// El puesto: la vida al final de la jornada.
//
// La galería con la mesa, las sillas, la pava y el mate; adentro la heladera;
// en el fogón la olla del guiso. Y el zaino: se ensucia andando (más en el
// barro y el agua), se lo baña con el balde en el tanque y se le da forraje en
// el comedero. Si se lo deja sucio o sin comer, al otro día se nota: amanece
// flaco (menos aliento) o con mataduras (rengo). Al llegar al puesto de tarde,
// el Guacho lo dice y el cartel recuerda lo que falta.
"use strict";
(() => {
  const P = (E.puesto = { vapores: [] });
  const V = THREE.Vector3;

  function modelo(nombre, x, y, z, rotY = 0) {
    const M = E.modelos;
    if (!M || !M.hay(nombre)) return null;
    const m = M.clonar(nombre);
    m.raiz.position.set(x, y, z); m.raiz.rotation.y = rotY;
    E.motor.escena.add(m.raiz);
    m.raiz.updateMatrixWorld(true);
    return m;
  }
  const alto = (m) => new THREE.Box3().setFromObject(m.raiz).max.y;

  P.construir = () => {
    const T = E.terreno, L = E.lugares, R = L.rancho, C = E.estancia, esc = E.motor.escena;
    const y0 = T.altura(R.x, R.z);
    // ── la galería: sillas en las cabeceras de la mesa de tablas, pava y mate ──
    const yMesa = y0 + 0.81;
    modelo("silla", R.x - 2.6, y0, R.z + 3.8, Math.PI / 2);
    modelo("silla", R.x - 0.4, y0, R.z + 3.8, -Math.PI / 2);
    P.pava = modelo("pava", R.x - 2.0, yMesa, R.z + 3.95, 0.6);
    // El mate: la calabaza forrada en cuero y la bombilla de alpaca.
    const mate = new THREE.Group();
    const calabaza = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.7 }));
    calabaza.scale.set(1, 1.15, 1); calabaza.position.y = 0.05; mate.add(calabaza);
    const yerba = new THREE.Mesh(new THREE.CircleGeometry(0.032, 12), new THREE.MeshStandardMaterial({ color: 0x5f7a2a, roughness: 1 }));
    yerba.rotation.x = -Math.PI / 2; yerba.position.y = 0.097; mate.add(yerba);
    const bombilla = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6), new THREE.MeshStandardMaterial({ color: 0xcfd2d4, metalness: 0.9, roughness: 0.3 }));
    bombilla.position.set(0.012, 0.13, 0); bombilla.rotation.z = -0.25; mate.add(bombilla);
    mate.position.set(R.x - 0.95, yMesa, R.z + 3.7); esc.add(mate);
    P.mate = mate;
    const pm = C.puntos.find((p) => p.id === "mate");
    if (pm) pm.texto = "Cebar unos mates";

    // ── adentro: la heladera contra la pared del este ──
    P.heladera = modelo("heladera", R.x + 3.35, y0, R.z + 0.9, -Math.PI / 2);
    C.circulos.push({ x: R.x + 3.35, z: R.z + 0.9, r: 0.45 });
    C.puntos.push({ id: "heladera", x: R.x + 2.5, z: R.z + 0.9, r: 1.4, texto: "Tomar agua fría de la heladera" });

    // ── el fogón: la olla del guiso (se ve cuando se cocina) ──
    const Fg = L.fogon, yf = T.altura(Fg.x, Fg.z);
    const olla = new THREE.Group();
    const hierroNegro = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, metalness: 0.6, roughness: 0.6 });
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.26, 16, 1, true), hierroNegro); cuerpo.position.y = 0.13; olla.add(cuerpo);
    const fondo = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), hierroNegro); fondo.rotation.x = -Math.PI / 2; fondo.position.y = 0.01; olla.add(fondo);
    const guiso = new THREE.Mesh(new THREE.CircleGeometry(0.19, 16), new THREE.MeshStandardMaterial({ color: 0x8a4a1c, roughness: 0.5 })); guiso.rotation.x = -Math.PI / 2; guiso.position.y = 0.2; olla.add(guiso);
    for (const k of [0, 1, 2]) { const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), hierroNegro); const a = (k / 3) * Math.PI * 2; pata.position.set(Math.cos(a) * 0.2, -0.1, Math.sin(a) * 0.2); olla.add(pata); }
    olla.position.set(Fg.x + 0.05, yf + 0.25, Fg.z - 0.05); olla.visible = false; esc.add(olla);
    P.olla = olla;

    // ── el comedero y el balde ──
    const mad = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 });
    const cx = R.x + 8.5, cz = R.z + 6.2, yc = T.altura(cx, cz);
    const comedero = new THREE.Group();
    const tabla = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mad); m.position.set(x, y, z); m.castShadow = true; comedero.add(m); };
    tabla(1.6, 0.04, 0.5, 0, 0.55, 0); tabla(1.6, 0.22, 0.04, 0, 0.66, 0.25); tabla(1.6, 0.22, 0.04, 0, 0.66, -0.25);
    for (const [x, z] of [[-0.7, 0.2], [0.7, 0.2], [-0.7, -0.2], [0.7, -0.2]]) tabla(0.07, 0.55, 0.07, x, 0.27, z);
    const pasto = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), new THREE.MeshStandardMaterial({ color: 0xb09a52, roughness: 1 }));
    pasto.scale.set(1.4, 0.28, 0.4); pasto.position.y = 0.62; pasto.visible = false; comedero.add(pasto);
    comedero.position.set(cx, yc, cz); comedero.rotation.y = 0.3; esc.add(comedero);
    P.comedero = { x: cx, z: cz, pasto };
    C.circulos.push({ x: cx, z: cz, r: 0.8 });
    C.puntos.push({ id: "comedero", x: cx - 1.2, z: cz + 0.4, r: 1.8, texto: "Darle forraje al zaino" });
    const Tq = L.tanque, bx = Tq.x + Tq.r + 1.2, bz = Tq.z + 1.4, yb = T.altura(bx, bz);
    const chapa = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.7, roughness: 0.45 });
    const balde = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 14, 1, true), chapa);
    balde.position.set(bx, yb + 0.15, bz); balde.castShadow = true; esc.add(balde);
    const asa = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 4, 16, Math.PI), chapa); asa.position.set(bx, yb + 0.3, bz); esc.add(asa);
    P.balde = balde;
  };

  // ── vapor ── unos copos que suben y se apagan (la pava, el mate, la olla).
  let texVapor;
  P.vapor = (pos, segundos = 20) => {
    if (!texVapor) texVapor = E.lienzo(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const copos = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texVapor, transparent: true, depthWrite: false, opacity: 0 }));
      s.scale.setScalar(0.12); E.motor.escena.add(s); copos.push({ s, fase: i / 6 });
    }
    P.vapores.push({ pos: pos.clone(), t: 0, dura: segundos, copos });
  };

  // ── el caballo ──
  P.actualizar = (dt, t) => {
    const c = E.animales.caballo, T = E.terreno;
    if (!c) return;
    // Andando se ensucia (el sudor y el polvo); en el barro o el agua, mucho más.
    const barro = T.agua(c.x, c.z) > 0.05 ? 1 : 0;
    c.sucio = E.clamp((c.sucio || 0) + (c.vReal * dt) / 2200 * (c.montado ? 1 : 0.3) + barro * c.vReal * dt * 0.004, 0, 1);
    pintarSucio(c);
    if (c.montado && c.sucio > 0.5 && P.avisoSucio !== E.juego.dia) { P.avisoSucio = E.juego.dia; E.juego.decir("caballoSucio"); }
    // El vapor.
    for (let k = P.vapores.length - 1; k >= 0; k--) {
      const v = P.vapores[k];
      v.t += dt;
      const apaga = 1 - E.suave(v.dura - 3, v.dura, v.t);
      for (const q of v.copos) {
        const u = (v.t * 0.35 + q.fase) % 1;
        q.s.position.set(v.pos.x + Math.sin(u * 7 + q.fase * 9) * 0.04, v.pos.y + u * 0.5, v.pos.z + Math.cos(u * 5 + q.fase * 7) * 0.04);
        q.s.scale.setScalar(0.08 + u * 0.22);
        q.s.material.opacity = Math.sin(Math.PI * u) * 0.45 * apaga;
      }
      if (v.t > v.dura) { for (const q of v.copos) { E.motor.escena.remove(q.s); q.s.material.dispose(); } P.vapores.splice(k, 1); }
    }
    // El forraje se termina de a poco.
    if (P.comedero && P.comedero.pasto.visible) {
      P.restoForraje = Math.max(0, (P.restoForraje || 0) - dt / 600);
      P.comedero.pasto.scale.y = 0.28 * Math.max(0.2, P.restoForraje);
      if (P.restoForraje <= 0) P.comedero.pasto.visible = false;
    }
  };
  // La mugre se ve: el pelo se apaga y tira a barro.
  const colorBarro = new THREE.Color(0.5, 0.36, 0.24);
  function pintarSucio(c) {
    const p = c.piel;
    if (!p) return;
    if (!p.coloresLimpios) {
      p.coloresLimpios = p.mallas.map((m) => { m.material = m.material.clone(); return m.material.color.clone(); });
    }
    const k = c.sucio * 0.55;
    if (Math.abs(k - (p.ultimoSucio ?? -1)) < 0.01) return;
    p.ultimoSucio = k;
    p.mallas.forEach((m, i) => m.material.color.copy(p.coloresLimpios[i]).lerp(colorBarro, k).multiplyScalar(1 - k * 0.3));
  }

  // ── acciones ──
  const G = () => E.juego;
  P.cebarMate = () => {
    const J = E.jugador;
    E.juego.decir("mate");
    if (P.mate) P.vapor(P.mate.getWorldPosition(new V()).add(new V(0, 0.1, 0)), 25);
    if (P.pava) P.vapor(P.pava.raiz.getWorldPosition(new V()).add(new V(0, 0.22, 0)), 25);
    G().fundir(0.35, () => { J.sed = Math.min(100, J.sed + 45); J.cansancio = Math.min(100, J.cansancio + 18); G().mostrar("Unos mates amargos con galleta, mirando el monte. Uno vuelve a ser persona."); });
  };
  P.aguaFria = () => {
    const J = E.jugador;
    E.juego.decir("heladera");
    G().fundir(0.05, () => { J.sed = 100; G().mostrar("Agua fría de la heladera: la gloria."); });
  };
  P.cocinar = () => {
    const J = E.jugador, Fg = E.lugares.fogon;
    E.juego.decir("comida");
    P.olla.visible = true;
    P.vapor(new V(Fg.x + 0.05, E.terreno.altura(Fg.x, Fg.z) + 0.5, Fg.z - 0.05), 40);
    G().fundir(0.8, () => {
      J.cansancio = Math.min(100, J.cansancio + 38); J.salud = Math.min(100, J.salud + 8); G().comio = true;
      G().mostrar("Guiso de arroz con carne y zapallo. Panza llena, corazón contento.");
      setTimeout(() => { P.olla.visible = false; }, 60000);
    });
  };
  P.banar = () => {
    const c = E.animales.caballo;
    E.juego.decir("banar");
    E.sonido.agua && E.sonido.agua();
    G().fundir(0.5, () => {
      c.sucio = 0; c.banado = G().dia;
      setTimeout(() => { E.juego.decir("banar"); }, 400);
      G().mostrar("Le echaste unos baldes y lo cepillaste. El zaino brilla.");
    });
  };
  P.forraje = () => {
    const c = E.animales.caballo, Cm = P.comedero;
    E.juego.decir("forraje");
    Cm.pasto.visible = true; P.restoForraje = 1; Cm.pasto.scale.y = 0.28;
    c.comido = G().dia;
    // El zaino viene solo al comedero (si no está montado).
    if (!c.montado) c.destino = { x: Cm.x - 1.4, z: Cm.z + 0.6 };
    G().mostrar("Un fardo de alfalfa en el comedero. El zaino ya viene.");
  };

  // Lo que se ofrece en el tanque: bañar al zaino (si está cerca y sucio) o tomar agua.
  P.puedeBanar = () => {
    const J = E.jugador, c = E.animales.caballo;
    return !J.montado && (c.sucio || 0) > 0.08 && Math.hypot(c.x - J.x, c.z - J.z) < 7;
  };

  // Al llegar al puesto de tarde: el Guacho lo dice y el cartel recuerda lo que falta.
  P.revisarLlegada = () => {
    const J = E.jugador, R = E.lugares.rancho, Gm = G();
    if (Gm.hora < 17 || P.avisoDia === Gm.dia) return;
    if (Math.hypot(J.x - R.x, J.z - R.z) > 14) return;
    P.avisoDia = Gm.dia;
    Gm.decir("puesto");
    setTimeout(() => Gm.mostrar("En el puesto: cebá unos mates en la mesa, prepará la comida en el fogón, y al zaino bañalo en el tanque y dale forraje en el comedero.", 7000), 1800);
  };
  P.pendientes = () => {
    const c = E.animales.caballo, Gm = G(), falta = [];
    if (Gm.hora < 16) return falta;
    if (c.banado !== Gm.dia && (c.sucio || 0) > 0.08) falta.push("bañar al zaino");
    if (c.comido !== Gm.dia) falta.push("darle forraje");
    return falta;
  };

  // A la mañana: cómo amaneció el zaino según lo que se hizo anoche. Se llama
  // con el día que terminó.
  P.amanecer = (diaAnterior) => {
    const c = E.animales.caballo;
    let texto = "";
    if (c.comido !== diaAnterior) {
      c.aliento = 0.6;
      texto += "El zaino amaneció flaco: anoche no le diste forraje, y hoy se va a cansar enseguida. ";
    }
    if ((c.sucio || 0) > 0.35 && c.banado !== diaAnterior) {
      if (Math.random() < 0.45) { c.lesion = Math.max(c.lesion, 1); texto += "Lo dejaste con el sudor y el barro encima: amaneció con mataduras en el lomo y rengo. "; }
      else texto += "El zaino sigue sucio desde ayer; si no lo bañás le van a salir mataduras. ";
    }
    if (c.comido === diaAnterior && c.banado === diaAnterior) texto += "El zaino amaneció limpio y comido, con ganas de trabajar. ";
    return texto;
  };
})();
