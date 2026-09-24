// El lazo: la mecánica principal. Sin auto-apuntado.
//
// Es una cuerda de verdad (verlet): una armada de 20 nudos que se cierra en
// la presilla, y el lazo que sale de la mano. Revoleado, la armada gira sobre
// la cabeza y se abre con la velocidad; soltado, vuela con la velocidad del
// revoleo más la del caballo, y engancha solo si cae por encima de la cabeza.
// Enganchado, la cuerda tiene largo y tensión: la vaca tira a tirones, uno
// cobra, y si tira más de lo que aguanta la mano el lazo se resbala; si
// aguanta más de lo que aguanta el cuero, se corta.
"use strict";
(() => {
  const Z = (E.lazo = {
    estado: "guardado", angulo: 0, omega: 0, revoleo: 0, calidad: 0, tension: 0, largo: 0,
    vaca: null, desgaste: 0, tieneLazo: true, sobreTension: 0, pialando: null, errado: 0,
  });
  const V = THREE.Vector3;
  const NA = 20, NL = 34;                 // nudos de la armada y del lazo
  const LARGO_MAX = 14;                   // lo que da un lazo de 8 tientos, sin la armada
  const OMEGA_MAX = 13.5;                 // ~2,1 vueltas por segundo
  const armada = [], cuerda = [];
  for (let i = 0; i < NA; i++) armada.push({ p: new V(), q: new V() });
  for (let i = 0; i < NL; i++) cuerda.push({ p: new V(), q: new V() });
  let radioArmada = 0.7, circ = 2 * Math.PI * 0.7;

  // ── dibujo ── cada tramo, un cilindro instanciado.
  let malla;
  Z.construir = () => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7a5635, roughness: 0.75,
      // El trenzado: rayas oscuras en diagonal a lo largo del tramo.
      map: E.lienzo(16, 64, (c, w, h) => { c.fillStyle = "#b08a60"; c.fillRect(0, 0, w, h); c.strokeStyle = "#5a3d24"; c.lineWidth = 3; for (let y = -16; y < h + 16; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 8); c.stroke(); } }, { repetir: true }),
    });
    malla = new THREE.InstancedMesh(g, mat, NA + NL + 2);
    malla.count = 0; malla.frustumCulled = false; malla.castShadow = true;
    E.motor.escena.add(malla);
  };
  const m4 = new THREE.Matrix4(), qd = new THREE.Quaternion(), sd = new V(), eje = new V(0, 0, 1), dirT = new V();
  function tramo(i, a, b, grosor) {
    dirT.copy(b).sub(a);
    const l = dirT.length();
    if (l < 1e-4) { sd.set(0, 0, 0); m4.compose(a, qd.identity(), sd); malla.setMatrixAt(i, m4); return; }
    qd.setFromUnitVectors(eje, dirT.divideScalar(l));
    sd.set(grosor, grosor, l);
    m4.compose(a, qd, sd);
    malla.setMatrixAt(i, m4);
  }
  function dibujar(mano) {
    if (!malla) return;
    if (Z.estado === "guardado") { malla.count = 0; return; }
    let n = 0;
    for (let i = 0; i < NA; i++) tramo(n++, armada[i].p, armada[(i + 1) % NA].p, 0.011);
    tramo(n++, mano, cuerda[0].p, 0.011);
    for (let i = 0; i < NL - 1; i++) tramo(n++, cuerda[i].p, cuerda[i + 1].p, 0.011);
    tramo(n++, cuerda[NL - 1].p, armada[0].p, 0.011);
    malla.count = n;
    malla.instanceMatrix.needsUpdate = true;
  }

  // ── verlet ──
  const G = new V(0, -9.8, 0), tmp = new V(), tmp2 = new V(), cen = new V(), nor = new V();
  function integrar(nudos, dt, arrastre) {
    for (const n of nudos) {
      tmp.copy(n.p).sub(n.q).multiplyScalar(1 - arrastre);
      n.q.copy(n.p);
      n.p.add(tmp).addScaledVector(G, dt * dt);
    }
  }
  function distancia(a, b, largo, rigidez = 1, fijoA = false, fijoB = false) {
    tmp.copy(b.p).sub(a.p);
    const d = tmp.length();
    if (d < 1e-6) return;
    const dif = ((d - largo) / d) * rigidez;
    if (fijoA) b.p.addScaledVector(tmp, -dif);
    else if (fijoB) a.p.addScaledVector(tmp, dif);
    else { a.p.addScaledVector(tmp, dif * 0.5); b.p.addScaledVector(tmp, -dif * 0.5); }
  }
  // Rigidez de doblez: dos nudos salteados no se acercan a menos de "min".
  // Sin esto, la cuerda floja en el piso se plegaba en zigzag de punta.
  function separar(a, b, min, rigidez) {
    tmp.copy(b.p).sub(a.p);
    const d = tmp.length();
    if (d >= min || d < 1e-6) return;
    const dif = ((d - min) / d) * rigidez * 0.5;
    a.p.addScaledVector(tmp, dif); b.p.addScaledVector(tmp, -dif);
  }
  function suelo(n) {
    const h = E.terreno.altura(n.p.x, n.p.z) + 0.02;
    if (n.p.y < h) { n.p.y = h; tmp.copy(n.p).sub(n.q); n.q.x = n.p.x - tmp.x * 0.3; n.q.z = n.p.z - tmp.z * 0.3; n.q.y = n.p.y; }
  }
  function centroArmada(destino) {
    destino.set(0, 0, 0);
    for (const n of armada) destino.add(n.p);
    return destino.divideScalar(NA);
  }
  function normalArmada(destino) {
    centroArmada(cen);
    destino.set(0, 0, 0);
    for (let i = 0; i < NA; i++) {
      const a = tmp.copy(armada[i].p).sub(cen), b = tmp2.copy(armada[(i + 1) % NA].p).sub(cen);
      destino.add(a.cross(b));
    }
    if (destino.y < 0) destino.negate();
    return destino.normalize();
  }

  // ── acciones ──
  Z.equipar = () => {
    if (!Z.tieneLazo) { E.juego.decir("sinLazo"); return; }
    if (Z.estado === "guardado") { Z.estado = "listo"; colgar(); }
    else if (Z.estado === "listo") Z.estado = "guardado";
  };
  // La armada colgando de la mano, lista.
  function colgar() {
    const mano = E.jugador.mano(new V());
    for (let i = 0; i < NA; i++) { const a = (i / NA) * Math.PI * 2; armada[i].p.set(mano.x + Math.cos(a) * 0.3, mano.y - 0.6 + Math.sin(a) * 0.3, mano.z); armada[i].q.copy(armada[i].p); }
    for (let i = 0; i < NL; i++) { cuerda[i].p.copy(mano); cuerda[i].q.copy(mano); }
  }

  Z.empezarRevoleo = () => {
    if (Z.estado === "guardado") Z.equipar();
    if (Z.estado !== "listo") return;
    Z.estado = "revoleando"; Z.omega = 1; Z.revoleo = 0;
  };

  // Suelta: la armada sale con la velocidad del revoleo y la del caballo.
  Z.tirar = () => {
    if (Z.estado !== "revoleando") return;
    const J = E.jugador, dir = J.adelante(new V());
    // Con la mira del ojo de águila cerrada, el tiro va guiado: la armada
    // hace el arco hasta arriba de la cabeza de esa vaca y cae ceñida.
    const guia = E.ojo && E.ojo.guiado();
    if (guia) {
      const desde = centroArmada(new V()), hasta = E.animales.cabeza(guia, new V());
      Z.guiado = { v: guia, t: 0, dura: 0.45 + desde.distanceTo(hasta) / 18, desde, radio: radioArmada };
      Z.calidad = 1; Z.estado = "volando"; Z.vuelo = 0; Z.largo = 1.2;
      E.ojo.empezarCine(guia);
      E.sonido && E.sonido.zumbido(0);
      J.cansancio = Math.max(0, J.cansancio - 1.5);
      return;
    }
    Z.calidad = calidadActual();
    const vel = 7 + 9 * Z.calidad;
    const empuje = new V().copy(dir).multiplyScalar(vel).add(new V(0, vel * 0.22, 0));
    if (J.montado) { const c = E.animales.caballo; empuje.x += Math.sin(c.yaw) * c.vReal; empuje.z += Math.cos(c.yaw) * c.vReal; }
    const dt = 1 / 120;
    centroArmada(cen);
    for (const n of armada) {
      // Cada nudo sale con el empuje más su velocidad tangencial de giro: es lo
      // que mantiene la armada abierta en el aire.
      tmp.copy(n.p).sub(cen);
      const tang = new V(-tmp.z, 0, tmp.x).multiplyScalar(Z.omega * 0.35);
      n.q.copy(n.p).addScaledVector(empuje.clone().add(tang), -dt);
    }
    for (const n of cuerda) n.q.copy(n.p).addScaledVector(empuje, -dt * 0.6);
    Z.estado = "volando"; Z.vuelo = 0; Z.largo = 1.2;
    Z.radioObj = radioArmada;
    E.sonido && E.sonido.zumbido(0);
    E.jugador.cansancio = Math.max(0, E.jugador.cansancio - 1.5);
  };

  // La calidad del revoleo: velocidad cerca del tope y entre 1,1 y 3 segundos.
  // Revolear de más cansa el brazo y la armada se cierra.
  function calidadActual() {
    const vel = E.suave(0.55, 0.95, Z.omega / OMEGA_MAX);
    const tiempo = Z.revoleo < 1.1 ? E.suave(0.3, 1.1, Z.revoleo) : Z.revoleo > 3 ? 1 - E.suave(3, 5.5, Z.revoleo) : 1;
    const cansado = 0.6 + 0.4 * E.jugador.cansancio / 100;
    return E.clamp(vel * tiempo * cansado, 0, 1);
  }
  Z.calidadVisible = () => (Z.estado === "revoleando" ? calidadActual() : 0);

  Z.pialar = () => {
    if (Z.estado !== "enganchado" || !Z.vaca) return;
    if (Z.pialando) {
      // El juicio: la aguja tiene que estar en la ventana verde, que es cuando
      // la pata de atrás está en el aire.
      const ok = Math.abs(Z.pialando.aguja - Z.pialando.ventana) < 0.11;
      if (ok) {
        const v = Z.vaca;
        v.estado = "tumbada"; v.tumbe = 0;
        Z.estado = "atada"; Z.pialando = null; Z.tension = 0;
        E.juego.decir("pialada");
        E.sonido && E.sonido.golpeSeco();
      } else {
        Z.pialando = null; Z.espera = 1.6;
        Z.vaca.fatiga = Math.min(1, Z.vaca.fatiga + 0.12);
        Z.tiron = 1.4;                            // la vaca pega un tirón
        E.juego.decir("errarPial");
      }
      return;
    }
    if ((Z.espera || 0) > 0) return;
    if (Z.vaca.fatiga > 0.38) { E.juego.decir("todaviaNo"); return; }
    Z.pialando = { aguja: 0, ventana: 0.25 + Math.random() * 0.5, vel: 0.9 + Z.vaca.fatiga * 1.4 };
  };

  // Soltar la vaca atada: se levanta y dispara. El lazo vuelve a la mano.
  Z.soltar = () => {
    if (Z.estado !== "atada" || !Z.vaca) return;
    const v = Z.vaca;
    v.estado = "levanta"; v.t = 1.4;
    v.fatiga = 1;
    Z.vaca = null; Z.estado = "listo"; colgar();
  };

  function cortar(motivo) {
    const v = Z.vaca;
    if (v) { v.estado = "escapa"; v.t = 12; v.fatiga = 1; }
    Z.vaca = null; Z.estado = "guardado"; Z.tieneLazo = false; Z.tension = 0; Z.pialando = null; Z.guiado = null;
    E.juego.decir(motivo);
    E.sonido && E.sonido.chasquido();
  }

  // ── cada cuadro ──
  Z.actualizar = (dt, t) => {
    const J = E.jugador, A = E.animales;
    const mano = J.mano(new V());
    Z.espera = Math.max(0, (Z.espera || 0) - dt);
    if (Z.estado === "listo") {
      // Cuelga de la mano: física suelta, con la presilla pegada a la mano.
      paso(dt, mano, 0.6, false);
    } else if (Z.estado === "revoleando") {
      Z.revoleo += dt;
      Z.omega = Math.min(OMEGA_MAX, Z.omega + dt * (Z.omega < OMEGA_MAX * 0.8 ? 9 : 3));
      Z.angulo += Z.omega * dt;
      radioArmada = E.lerp(0.55, 1.15, E.suave(2, OMEGA_MAX, Z.omega));
      if (Z.revoleo > 3.5) { radioArmada *= 1 - E.suave(3.5, 6, Z.revoleo) * 0.4; J.cansancio = Math.max(0, J.cansancio - dt * 2); }
      // La armada gira sobre la cabeza, un poco adelante y a la derecha, y
      // apenas inclinada hacia donde se mira (el frente, más bajo). En
      // primera persona, más adelante y más baja: que el arco de adelante
      // pase por arriba de la vista y se vea. En tercera, sobre la mano del
      // Guacho, a pie o a caballo (antes, a caballo, giraba alrededor de la
      // cámara, cinco metros atrás).
      const dir = J.adelante(new V()); dir.y = 0; dir.normalize();
      const der = new V(-dir.z, 0, dir.x);
      const primera = J.camara === "primera";
      const centro = new V().copy(primera ? E.motor.camara.position : mano).add(new V(0, primera ? 0.3 : 0.45, 0))
        .addScaledVector(dir, primera ? 0.55 : 0.3).addScaledVector(der, primera ? 0.25 : 0.1);
      for (let i = 0; i < NA; i++) {
        const a = Z.angulo + (i / NA) * Math.PI * 2;
        const x = Math.cos(a) * radioArmada, z = Math.sin(a) * radioArmada;
        const inclina = -(primera ? 0.24 : 0.16) * (x * dir.x + z * dir.z) / radioArmada;
        armada[i].p.set(centro.x + x, centro.y + inclina, centro.z + z);
        armada[i].q.copy(armada[i].p);
      }
      circ = 2 * Math.PI * radioArmada;
      for (let i = 0; i < NL; i++) { cuerda[i].p.lerpVectors(mano, armada[0].p, i / (NL - 1)); cuerda[i].q.copy(cuerda[i].p); }
      E.sonido && E.sonido.zumbido(Z.omega / OMEGA_MAX);
    } else if (Z.estado === "volando" && Z.guiado) {
      vueloGuiado(dt, mano);
    } else if (Z.estado === "volando") {
      Z.vuelo += dt;
      Z.largo = Math.min(LARGO_MAX, Z.largo + dt * 14);          // el lazo se va dando de los rollos
      Z.radioObj = Math.max(0.55, Z.radioObj - dt * 0.18);
      const sub = 4, h = dt / sub;
      for (let k = 0; k < sub; k++) {
        const c0 = centroArmada(new V());
        paso(h, mano, 0.004, true);
        const c1 = centroArmada(new V());
        // ¿Engancha? La armada tiene que bajar por encima de la cabeza,
        // más o menos acostada, con el centro a menos de su radio.
        const n = normalArmada(new V());
        for (const v of A.vacas) {
          if (v.salud.muerta || v.estado === "tumbada" || v.estado === "cepo") continue;
          const hc = A.cabeza(v, new V());
          if (Math.hypot(c1.x - v.x, c1.z - v.z) > 5) continue;
          const dh = Math.hypot(c1.x - hc.x, c1.z - hc.z);
          const r = radioMedido(c1);
          // Más perdonador que antes (era 0,85 del radio y -0,05 de alto).
          if (dh < r * 1.1 && c0.y > hc.y - 0.25 && c1.y <= hc.y + 0.2 && Math.abs(n.y) > 0.35) { enganchar(v); return; }
        }
        if (c1.y < E.terreno.altura(c1.x, c1.z) + 0.15 || Z.vuelo > 2.6) { errar(c1); return; }
      }
    } else if (Z.estado === "errado") {
      Z.errado -= dt;
      // Erró: la cobra. El largo nunca pasa de lo que hay hasta la armada (la
      // cuerda de sobra se amontonaba en zigzag al lado de la mano) y se va
      // acortando: la armada vuelve arrastrándose por el piso.
      const hasta = centroArmada(cen).distanceTo(mano);
      Z.largo = Math.max(1.2, Math.min(Z.largo - dt * 7, hasta + 0.4));
      paso(dt, mano, 0.05, false, true);
      if (Z.errado <= 0) { Z.estado = "listo"; colgar(); }
    } else if (Z.estado === "enganchado") {
      forcejeo(dt, t, mano);
    } else if (Z.estado === "atada") {
      // El lazo queda atado de las patas: se dibuja de la mano (o el recado)
      // hasta el cuello, flojo.
      const v = Z.vaca;
      if (v) {
        const cu = A.cuello(v, new V());
        anudarArmada(cu, 0.2, v);
        paso(dt, mano, 0.1, false, false, cu);
      }
    }
    dibujar(mano);
  };

  function radioMedido(c) {
    let r = 0;
    for (const n of armada) r += Math.hypot(n.p.x - c.x, n.p.z - c.z);
    return r / NA;
  }

  // Un paso de la cuerda. Si "abierta", la armada se mantiene abierta hacia
  // su radio (se va cerrando sola en el vuelo); si no, cuelga.
  function paso(dt, mano, arrastre, abierta, enSuelo = false, fijo = null) {
    // Anudada al cuello, la armada la mueve la vaca, no la cuerda.
    if (!fijo) integrar(armada, dt, arrastre);
    integrar(cuerda, dt, arrastre);
    const seg = Z.estado === "volando" || Z.estado === "enganchado" || Z.estado === "atada" || Z.estado === "errado" ? Math.max(Z.largo, 0.8) / NL : 0.9 / NL;
    const tramoA = (abierta ? 2 * Math.PI * Z.radioObj : 2 * Math.PI * 0.32) / NA;
    for (let it = 0; it < 8; it++) {
      cuerda[0].p.copy(mano);
      for (let i = 0; i < NL - 1; i++) distancia(cuerda[i], cuerda[i + 1], seg, 1, i === 0);
      for (let i = 0; i < NL - 2; i++) separar(cuerda[i], cuerda[i + 2], seg * 1.55, 0.35);
      distancia(cuerda[NL - 1], armada[0], seg, 1, false, !!fijo);
      if (!fijo) for (let i = 0; i < NA; i++) distancia(armada[i], armada[(i + 1) % NA], tramoA, 1);
      if (abierta) {
        // Rigidez de la armada: los opuestos se mantienen a un diámetro.
        for (let i = 0; i < NA / 2; i++) distancia(armada[i], armada[i + NA / 2], Z.radioObj * 2, 0.35);
      }
      if (enSuelo || !abierta) { if (!fijo) for (const n of armada) suelo(n); for (const n of cuerda) suelo(n); }
    }
  }

  // La armada ceñida al cuello: en un plano de canto al cuello (que va para
  // adelante y un poco para arriba), y más ancha que el cuello de la vaca de
  // Rezona (con 0,22 m quedaba adentro y no se veía).
  const ejeCuello = new V(), ladoCuello = new V(), arribaCuello = new V();
  function anudarArmada(c, r, v) {
    const yaw = v ? v.yaw : 0;
    ejeCuello.set(Math.sin(yaw), 0.55, Math.cos(yaw)).normalize();
    ladoCuello.set(Math.cos(yaw), 0, -Math.sin(yaw));
    arribaCuello.crossVectors(ejeCuello, ladoCuello).normalize();
    const radio = v && v.piel ? r + 0.12 : r;
    for (let i = 0; i < NA; i++) {
      const a = (i / NA) * Math.PI * 2;
      armada[i].p.copy(c).addScaledVector(ladoCuello, Math.cos(a) * radio).addScaledVector(arribaCuello, Math.sin(a) * radio * 1.1);
      armada[i].q.copy(armada[i].p);
    }
  }

  function enganchar(v) {
    const J = E.jugador;
    Z.estado = "enganchado"; Z.vaca = v; v.estado = "enlazada";
    const cu = E.animales.cuello(v, new V()), mano = J.mano(new V());
    Z.largo = E.clamp(cu.distanceTo(mano) + 0.5, 3, LARGO_MAX);
    Z.tension = 0; Z.sobreTension = 0; Z.tiron = 0.8; Z.pialando = null;
    v.fatiga = Math.max(v.fatiga, 0.85);
    E.juego.decir("enlazada", v);
    E.sonido && E.sonido.mugido(v, 1.3);
  }
  // El vuelo guiado: la armada abierta y acostada, girando, sigue un arco del
  // centro de revoleo a medio metro arriba de la cabeza (que se mueve), baja
  // y engancha. La cuerda va de la mano a la armada, con panza.
  function vueloGuiado(dt, mano) {
    const g = Z.guiado, v = g.v;
    g.t += dt;
    const u = Math.min(1, g.t / g.dura), cab = E.animales.cabeza(v, new V());
    const suave = u * u * (3 - 2 * u);
    const c = new V().lerpVectors(g.desde, cab.clone().add(new V(0, 0.55, 0)), suave);
    c.y += (0.6 + g.desde.distanceTo(cab) * 0.04) * 4 * u * (1 - u);
    if (u > 0.82) c.y -= 0.7 * E.suave(0.82, 1, u);
    const r = E.lerp(g.radio, 0.6, u);
    Z.angulo += 9 * dt;
    for (let i = 0; i < NA; i++) {
      const a = Z.angulo + (i / NA) * Math.PI * 2;
      armada[i].p.set(c.x + Math.cos(a) * r, c.y + Math.sin(a * 2) * 0.03, c.z + Math.sin(a) * r);
      armada[i].q.copy(armada[i].p);
    }
    const panza = 0.35 * (1 - u) + 0.1;
    for (let i = 0; i < NL; i++) {
      const f = i / (NL - 1);
      cuerda[i].p.lerpVectors(mano, armada[0].p, f); cuerda[i].p.y -= panza * Math.sin(Math.PI * f);
      cuerda[i].q.copy(cuerda[i].p);
    }
    Z.largo = Math.min(LARGO_MAX, mano.distanceTo(c) + 0.6);
    if (u >= 1) { Z.guiado = null; enganchar(v); }
  }

  // Para las pruebas: enlazar una vaca sin tener que embocarla.
  Z.probarEnganche = (v) => { if (Z.estado === "guardado") Z.equipar(); enganchar(v); };
  function errar(c) {
    Z.estado = "errado"; Z.errado = 1.3;
    // La que estaba cerca se espanta.
    const v = E.animales.cercana(c.x, c.z, 9);
    if (v) { v.estado = "escapa"; v.t = 7; }
    E.juego.decir("errar");
  }

  // ── el forcejeo ──
  function forcejeo(dt, t, mano) {
    const J = E.jugador, v = Z.vaca, en = E.entrada;
    if (!v || v.salud.muerta) { Z.estado = "listo"; colgar(); return; }
    // La vaca tira para alejarse, a tirones. Cuanto más cansada, menos.
    Z.tiron = Math.max(0, (Z.tiron || 0) - dt * 1.6);
    if (Math.random() < dt * (0.5 + v.fatiga * 0.9)) Z.tiron = 0.6 + Math.random() * 0.8 * v.fatiga + v.brava * 0.3;
    const dx = v.x - J.x, dz = v.z - J.z, d0 = Math.hypot(dx, dz) || 1;
    const querer = (1.2 + 4.2 * v.fatiga) * (0.5 + Z.tiron) * (v.salud.bichera ? 0.8 : 1);
    // Una brava enlazada a veces carga contra uno, si está a pie y cerca.
    let carga = false;
    if (!J.montado && v.brava > 0.6 && Z.largo < 6 && v.fatiga > 0.5 && Math.random() < dt * 0.15) Z.carga = 1.2;
    if ((Z.carga || 0) > 0) { Z.carga -= dt; carga = true; }
    const dirx = carga ? -dx / d0 : dx / d0, dirz = carga ? -dz / d0 : dz / d0;
    v.yaw += E.clamp(E.angulo(Math.atan2(dirx, dirz) + Math.sin(t * 0.8 + v.num) * 0.6 - v.yaw), -dt * 2.2, dt * 2.2);
    v.v += ((carga ? 5 : querer) - v.v) * Math.min(1, dt * 3);
    const px = v.x, pz = v.z;
    v.x += Math.sin(v.yaw) * v.v * dt; v.z += Math.cos(v.yaw) * v.v * dt;
    const p = { x: v.x, z: v.z }; E.estancia.empujar(p, 0.55); v.x = p.x; v.z = p.z;
    if (carga && Math.hypot(v.x - J.x, v.z - J.z) < 1.4) { E.juego.golpe(v, "cornada"); Z.carga = 0; }

    // La cuerda: si la vaca pasa el largo, se la vuelve al largo y eso es tensión.
    const cu = E.animales.cuello(v, new V());
    const d = Math.hypot(cu.x - mano.x, cu.z - mano.z);
    let tension = 0.08 * E.clamp(d / Z.largo, 0, 1);
    if (d > Z.largo) {
      const f = Z.largo / d;
      const ox = mano.x + (cu.x - mano.x) * f - (cu.x - v.x), oz = mano.z + (cu.z - mano.z) * f - (cu.z - v.z);
      v.x = ox; v.z = oz;
      tension = E.clamp(0.2 + querer / 5 + (d - Z.largo) * 0.6, 0, 2.2);
    }
    v.vReal = Math.hypot(v.x - px, v.z - pz) / Math.max(dt, 1e-4);
    Z.tension += (tension - Z.tension) * Math.min(1, dt * 6);

    // Cobrar: botón derecho (o el botón táctil). Contra un tirón fuerte, cobrar
    // sube la tensión: ahí es donde se corta.
    const cobra = en.raton.der || en.boton("cobrar");
    if (cobra) {
      Z.largo = Math.max(2.2, Z.largo - dt * 1.3 * (1.1 - Math.min(1, Z.tension)));
      Z.tension += dt * 0.6 * Z.tiron;
      J.cansancio = Math.max(0, J.cansancio - dt * 1.2);
    }
    // Lo que aguanta la mano: a caballo, el recado aguanta mucho más. Si la
    // tensión pasa, el lazo se resbala; a pie, además, arrastra.
    const agarre = J.montado ? 1.3 : 0.82 * (J.costilla > 0 ? 0.75 : 1) * (0.6 + 0.4 * J.cansancio / 100);
    if (Z.tension > agarre) {
      const exceso = Z.tension - agarre;
      Z.largo = Math.min(LARGO_MAX, Z.largo + exceso * 3 * dt);
      J.cansancio = Math.max(0, J.cansancio - exceso * 4 * dt);
      if (!J.montado) {
        J.x += (dx / d0) * exceso * 1.2 * dt; J.z += (dz / d0) * exceso * 1.2 * dt;
      } else E.animales.caballo.aliento = Math.max(0, E.animales.caballo.aliento - exceso * 0.05 * dt);
      if (Z.largo >= LARGO_MAX - 0.01 && !J.montado && exceso > 0.25) { cortar("seFue"); return; }
    }
    // Lo que aguanta el cuero: más de 1,5 sostenido más de medio segundo.
    const resiste = 1.5 - Z.desgaste * 0.35;
    if (Z.tension > resiste) {
      Z.sobreTension += dt;
      Z.desgaste = Math.min(1, Z.desgaste + dt * 0.08);
      if (Z.sobreTension > 0.55) { cortar("cortado"); return; }
    } else Z.sobreTension = Math.max(0, Z.sobreTension - dt);
    // La vaca se cansa con la tensión.
    v.fatiga = Math.max(0.05, v.fatiga - dt * 0.05 * (0.4 + Z.tension));
    if (Z.pialando) {
      Z.pialando.aguja = (Math.sin(t * Math.PI * Z.pialando.vel) + 1) / 2;
    }

    anudarArmada(cu, 0.22, v);
    paso(dt, mano, 0.08, false, false, cu);
  }
})();
