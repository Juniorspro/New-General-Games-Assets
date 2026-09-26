// El Guacho: a pie y a caballo, primera y tercera persona, y el cuerpo que se
// cansa, se deshidrata y se quiebra.
"use strict";
(() => {
  const J = (E.jugador = {});
  const V = THREE.Vector3;

  // ── el cuerpo del Guacho, para la tercera persona ──
  function guachoMalla() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const C = (h) => new THREE.Color(h);
    const camisa = C("#c9c1b2"), bombacha = C("#5f5444"), piel = C("#9a6444"), negro = C("#161514"), faja = C("#1d1b1a"), panuelo = C("#7d1c17"), plata = C("#b9b6ae");
    const pinta = (g, col) => E.pintar(g, col.r, col.g, col.b);
    const huesos = [
      { nombre: "raiz", pos: [0, 0, 0] },
      { nombre: "cadera", padre: "raiz", pos: [0, 0.98, 0] },
      { nombre: "torso", padre: "cadera", pos: [0, 0.08, 0] },
      { nombre: "cabeza", padre: "torso", pos: [0, 0.56, 0.02] },
      { nombre: "hombroI", padre: "torso", pos: [0.22, 0.46, 0] },
      { nombre: "codoI", padre: "hombroI", pos: [0, -0.3, 0] },
      { nombre: "hombroD", padre: "torso", pos: [-0.22, 0.46, 0] },
      { nombre: "codoD", padre: "hombroD", pos: [0, -0.3, 0] },
      { nombre: "piernaI", padre: "cadera", pos: [0.11, -0.02, 0] },
      { nombre: "rodillaI", padre: "piernaI", pos: [0, -0.46, 0] },
      { nombre: "piernaD", padre: "cadera", pos: [-0.11, -0.02, 0] },
      { nombre: "rodillaD", padre: "piernaD", pos: [0, -0.46, 0] },
    ];
    const cil = (r0, r1, l, lados = 8) => new THREE.CylinderGeometry(r1, r0, l, lados).translate(0, -l / 2, 0);
    const partes = [
      { hueso: "torso", geo: pinta(new THREE.CylinderGeometry(0.19, 0.17, 0.5, 10).scale(1, 1, 0.72).translate(0, 0.26, 0), camisa) },
      { hueso: "torso", geo: pinta(new THREE.CylinderGeometry(0.075, 0.08, 0.1, 8).translate(0, 0.54, 0.01), piel) },           // cuello
      { hueso: "torso", geo: pinta(new THREE.TorusGeometry(0.08, 0.025, 5, 10).rotateX(Math.PI / 2).translate(0, 0.52, 0.01), panuelo) },
      { hueso: "cadera", geo: pinta(new THREE.CylinderGeometry(0.19, 0.19, 0.13, 10).scale(1, 1, 0.75).translate(0, 0.02, 0), faja) },
      // La rastra: la hebilla y las monedas de plata en la faja.
      { hueso: "cadera", geo: pinta(new THREE.BoxGeometry(0.14, 0.07, 0.02).translate(0, 0.02, 0.145), plata) },
      // El facón atravesado atrás, en la cintura.
      { hueso: "cadera", geo: pinta(new THREE.BoxGeometry(0.34, 0.03, 0.012).translate(-0.02, 0.03, -0.155), plata) },
      { hueso: "cadera", geo: pinta(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 6).rotateZ(Math.PI / 2).translate(0.21, 0.03, -0.155), C("#3b2a1d")) },
      { hueso: "cabeza", geo: pinta(new THREE.SphereGeometry(0.11, 12, 10).scale(0.92, 1.1, 1).translate(0, 0.1, 0.01), piel) },
      { hueso: "cabeza", geo: pinta(new THREE.BoxGeometry(0.1, 0.018, 0.03).translate(0, 0.055, 0.1), C("#2a1d15")) },             // bigote
      // La boina, chata y caída de un lado.
      { hueso: "cabeza", geo: pinta(new THREE.CylinderGeometry(0.135, 0.125, 0.05, 14).rotateZ(0.14).translate(0.01, 0.2, -0.005), negro) },
    ];
    for (const s of ["I", "D"]) {
      const sg = s === "I" ? 1 : -1;
      partes.push({ hueso: "hombro" + s, geo: pinta(cil(0.06, 0.05, 0.31), camisa) });
      partes.push({ hueso: "codo" + s, geo: pinta(cil(0.05, 0.042, 0.27), camisa) });
      partes.push({ hueso: "codo" + s, geo: pinta(new THREE.SphereGeometry(0.045, 8, 6).scale(0.8, 1.1, 0.6).translate(0, -0.31, 0), piel) });
      // La bombacha: ancha arriba y fruncida en el tobillo.
      partes.push({ hueso: "pierna" + s, geo: pinta(cil(0.12, 0.09, 0.47, 9), bombacha) });
      partes.push({ hueso: "rodilla" + s, geo: pinta(cil(0.09, 0.055, 0.44, 9), bombacha) });
      partes.push({ hueso: "rodilla" + s, geo: pinta(new THREE.BoxGeometry(0.09, 0.06, 0.24).translate(sg * 0.0, -0.46, 0.05), C("#2a2826")) });   // alpargata
    }
    const armar = E.animales.armarMalla;
    return armar(huesos, partes, mat);
  }

  // ── las manos en primera persona ──
  function manosPrimera() {
    const g = new THREE.Group();
    const piel = new THREE.MeshStandardMaterial({ color: 0x8f5a3c, roughness: 0.7 });
    const manga = new THREE.MeshStandardMaterial({ color: 0xc9c1b2, roughness: 0.9 });
    const brazo = new THREE.Group();
    const ante = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 8).rotateX(Math.PI / 2).translate(0, 0, -0.17), manga);
    const mano = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6).scale(0.9, 0.7, 1.3).translate(0, 0, -0.37), piel);
    brazo.add(ante, mano);
    // Adentro del cuadro: con la mano a 0,26 abajo y 0,1 adelante quedaba
    // fuera de la vista y en primera persona no se veía qué se tenía en la mano.
    brazo.position.set(0.2, -0.2, -0.12);
    g.add(brazo);
    // La mano izquierda con los rollos del lazo.
    const izq = new THREE.Group();
    izq.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6).scale(1, 0.7, 1.2), piel));
    const tiento = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.1 + i * 0.008, 0.006, 4, 20), tiento); r.rotation.y = Math.PI / 2; r.position.set(0, -0.08, 0.01 * i); izq.add(r); }
    izq.position.set(-0.21, -0.21, -0.44);
    g.add(izq);
    g.userData = { brazo, izq, mano };
    return g;
  }

  J.iniciar = () => {
    const L = E.lugares;
    Object.assign(J, {
      x: L.rancho.x + 2, z: L.rancho.z + 6, yaw: Math.PI, pitch: -0.05, vel: 0, montado: false,
      camara: "primera", sed: 100, cansancio: 100, salud: 100, costilla: 0, dolor: 0, alPaso: false,
      bloqueado: null, bob: 0, ultimoArrastre: 0, dist3: 3.7,
    });
    const g = guachoMalla();
    J.cuerpo = g.malla; J.huesos = g.huesos;
    E.motor.escena.add(J.cuerpo);
    // El Guacho de Rezona, si cargó: el de código queda de esqueleto lógico.
    J.piel = E.modelos && E.modelos.hay("guacho") ? E.modelos.clonar("guacho") : null;
    J.caderaAlto = 0.98;
    if (J.piel) {
      J.cuerpo.material.visible = false; J.cuerpo.castShadow = false;
      E.motor.escena.add(J.piel.raiz);
      J.piel.raiz.updateMatrixWorld(true);
      if (J.piel.roles.cadera) {
        J.caderaLocal = J.piel.raiz.worldToLocal(J.piel.roles.cadera.getWorldPosition(new V()));
        J.caderaAlto = J.caderaLocal.y;
      }
    }
    J.rumbo = J.yaw + Math.PI;
    J.manos = manosPrimera();
    E.motor.camara.add(J.manos);
    E.motor.escena.add(E.motor.camara);
  };

  // Dónde está la mano del lazo (a caballo, el lazo va atado al recado).
  // Dónde se sienta el jinete: sobre el recado, que va pegado al modelo del
  // caballo y sigue su bote y su cabeceo.
  J.asiento = (destino) => {
    const c = E.animales.caballo;
    if (c.recado) return c.recado.localToWorld(destino.copy(c.recado.userData.asiento));
    return destino.set(c.malla.position.x, c.malla.position.y + c.sillaY + (c.huesos.cuerpo.position.y - c.altoCuerpo), c.malla.position.z);
  };
  // De dónde sale el lazo: de la mano, y a caballo, una vez que agarró, del
  // recado (se ata a la cabeza del recado y el caballo tira).
  J.mano = (destino) => {
    const c = E.animales.caballo, lz = E.lazo;
    const atado = J.montado && lz && (lz.estado === "enganchado" || lz.estado === "atada");
    if (atado || (J.montado && J.camara !== "primera" && !J.piel)) {
      if (c.recado) return c.recado.localToWorld(destino.copy(c.recado.userData.asiento).add(tmp2.set(0, 0.12, 0.3)));
      return c.huesos.cuerpo.localToWorld(destino.set(0, 0.5, 0.35));
    }
    // (en la toma de cine del ojo de águila se ve al Guacho de afuera: la mano
    // es la del cuerpo, no la de primera persona, que va pegada a la cámara)
    const cine = E.ojo && E.ojo.cine;
    if (J.camara === "primera" && !cine) return J.manos.userData.mano.getWorldPosition(destino);
    if (J.piel && J.piel.roles.manoD) return J.piel.roles.manoD.getWorldPosition(destino);
    return J.huesos.codoD.localToWorld(destino.set(0, -0.32, 0));
  };
  J.adelante = (destino) => E.motor.camara.getWorldDirection(destino);

  J.golpe = (tipo) => {
    const dano = tipo === "cornada" ? 32 : 22;
    J.salud = Math.max(0, J.salud - dano);
    J.dolor = 1;
    // Una patada en el costado quiebra una costilla bastante seguido.
    if (tipo === "patada" && Math.random() < 0.45) J.costilla = 2;
    if (tipo === "cornada" && Math.random() < 0.3) J.costilla = 2;
    return dano;
  };

  // En la portada la cámara da vueltas lejos: el Guacho se ve de cuerpo entero,
  // quieto y respirando, sin las manos de primera persona.
  J.portada = (dt, t) => {
    J.cuerpo.visible = true;
    if (J.piel) J.piel.raiz.visible = true;
    J.manos.visible = false;
    posarCuerpo(dt, t);
  };
  J.montar = () => {
    const c = E.animales.caballo;
    J.montado = true; c.montado = true; c.destino = null;
    // El caballo avanza hacia (sin, cos) de su rumbo y la cámara hacia
    // (-sin, -cos) del suyo: mirar adonde va el caballo es rumbo + π. Con los
    // dos iguales se montaba mirando para atrás.
    J.yaw = c.yaw + Math.PI;
  };
  J.desmontar = () => {
    const c = E.animales.caballo;
    J.montado = false; c.montado = false;
    // Se baja por la izquierda, como se debe.
    J.x = c.x + Math.cos(c.yaw) * 1.1; J.z = c.z - Math.sin(c.yaw) * 1.1;
    c.v = 0;
  };

  const tmp = new V(), tmp2 = new V();
  const sensib = () => (E.opciones ? E.opciones.sensib : 1);
  J.actualizar = (dt, t, ctx) => {
    const en = E.entrada, T = E.terreno, c = E.animales.caballo;
    const libre = !J.bloqueado;
    // Mirar
    if (libre || J.bloqueado === "lazo") {
      J.yaw -= en.raton.dx * 0.0022 * sensib();
      J.pitch = E.clamp(J.pitch - en.raton.dy * 0.0022 * sensib(), -1.35, 1.2);
      if (en.raton.dx || en.raton.dy) J.ultimoArrastre = t;
    }
    // Caminar (teclado o palanca)
    let ax = 0, az = 0;
    if (libre) {
      if (en.tecla("KeyW") || en.tecla("ArrowUp")) az += 1;
      if (en.tecla("KeyS") || en.tecla("ArrowDown")) az -= 1;
      if (en.tecla("KeyA") || en.tecla("ArrowLeft")) ax -= 1;
      if (en.tecla("KeyD") || en.tecla("ArrowRight")) ax += 1;
      if (en.palanca.activa) { ax += en.palanca.x; az -= en.palanca.y; }
    }
    // Para las pruebas: la palanca y el Shift, forzados.
    if (J.prueba) { ax = J.prueba.ax || 0; az = J.prueba.az || 0; }
    const l = Math.hypot(ax, az);
    if (l > 1) { ax /= l; az /= l; }
    const corre = J.prueba ? !!J.prueba.corre : en.tecla("ShiftLeft") || en.tecla("ShiftRight") || (en.palanca.activa && Math.hypot(en.palanca.x, en.palanca.y) > 0.95);
    if (en.pulsado("KeyC") && J.montado) J.alPaso = !J.alPaso;

    if (J.montado) {
      // A caballo: adelante con W, la dirección sigue a la mirada. Al trote por
      // defecto, al paso con C (para arrear sin espantar), al galope con Shift.
      let objetivo = 0;
      if (az > 0.1) objetivo = corre && c.aliento > 0.02 ? 8.8 : J.alPaso ? 1.7 : 3.9;
      if (az < -0.1) objetivo = -1.0;
      if (c.lesion > 0) objetivo = Math.min(objetivo, 2.4);
      if (J.bloqueado === "lazo" && E.lazo.estado === "enganchado") objetivo = Math.min(objetivo, 1.7);
      c.v += (objetivo * (0.55 + 0.45 * J.salud / 100) - c.v) * Math.min(1, dt * (objetivo > c.v ? 1.4 : 2.5));
      if (Math.abs(c.v) > 0.3 || ax) {
        const giro = E.angulo(J.yaw + Math.PI - c.yaw) + ax * -0.9;
        c.yaw += E.clamp(giro, -dt * 1.9, dt * 1.9);
      }
      // El aliento del caballo: el galope lo gasta, parado se repone. Si se lo
      // exige sin aire, se lesiona.
      const galopa = c.v > 6;
      c.aliento = E.clamp(c.aliento + dt * (galopa ? -0.055 : c.v > 3 ? -0.008 : 0.03), 0, 1);
      if (galopa && c.aliento < 0.03) {
        J.exigido = (J.exigido || 0) + dt;
        if (J.exigido > 3 && !c.lesion) { c.lesion = 2; ctx.aviso("lesion"); }
      } else J.exigido = 0;
      const prev = { x: c.x, z: c.z };
      const fr = T.freno(c.x, c.z);
      c.x += Math.sin(c.yaw) * c.v * fr * dt; c.z += Math.cos(c.yaw) * c.v * fr * dt;
      const p = { x: c.x, z: c.z }; E.estancia.empujar(p, 0.6); c.x = p.x; c.z = p.z;
      // Contra la hacienda: el caballo empuja y la vaca se corre.
      for (const v of E.animales.vacas) {
        if (v.salud.muerta) continue;
        const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz);
        if (d < 1.5 && d > 1e-4) { c.x -= (dx / d) * (1.5 - d) * 0.5; c.z -= (dz / d) * (1.5 - d) * 0.5; if (v.estado !== "tumbada" && v.estado !== "cepo") { v.x += (dx / d) * (1.5 - d) * 0.5; v.z += (dz / d) * (1.5 - d) * 0.5; } }
      }
      c.vReal = Math.hypot(c.x - prev.x, c.z - prev.z) / Math.max(dt, 1e-4);
      J.x = c.x; J.z = c.z; J.vel = c.vReal;
      J.rumbo = c.yaw; J.vAdelante = 0;
    } else {
      const velPie = corre && J.cansancio > 8 && J.costilla <= 0 ? 4.4 : corre && J.costilla > 0 ? 2.2 : 1.6;
      const sd = Math.sin(J.yaw), cd = Math.cos(J.yaw);
      // Adelante es -z de la cámara, o sea (−sin yaw, −cos yaw).
      const vx = (-sd * az + cd * ax) * velPie, vz = (-cd * az - sd * ax) * velPie;
      const fr = T.freno(J.x, J.z);
      const prev = { x: J.x, z: J.z };
      J.x += vx * fr * dt; J.z += vz * fr * dt;
      const p = { x: J.x, z: J.z }; E.estancia.empujar(p, 0.32);
      for (const v of E.animales.vacas) {
        if (v.salud.muerta) continue;
        const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz);
        if (d < 1.0 && d > 1e-4) { p.x = v.x + (dx / d) * 1.0; p.z = v.z + (dz / d) * 1.0; }
      }
      const dc = Math.hypot(p.x - c.x, p.z - c.z);
      if (dc < 0.9 && dc > 1e-4) { p.x = c.x + ((p.x - c.x) / dc) * 0.9; p.z = c.z + ((p.z - c.z) / dc) * 0.9; }
      J.x = p.x; J.z = p.z;
      J.vel = Math.hypot(J.x - prev.x, J.z - prev.z) / Math.max(dt, 1e-4);
      // Para dónde mira el cuerpo (en tercera persona se ve): hacia donde
      // camina, salvo con el lazo en la mano, que mira adonde apunta la
      // cámara (y si la vaca lo arrastra, camina para atrás).
      const lz = E.lazo, apunta = lz && (lz.estado === "revoleando" || lz.estado === "volando" || lz.estado === "enganchado");
      const mov = Math.hypot(vx, vz) > 0.1;
      const quiere = apunta ? J.yaw + Math.PI : mov ? Math.atan2(vx, vz) : J.rumbo;
      J.rumbo += E.angulo(quiere - J.rumbo) * Math.min(1, dt * 9);
      J.vAdelante = dt > 0 ? ((J.x - prev.x) * Math.sin(J.rumbo) + (J.z - prev.z) * Math.cos(J.rumbo)) / dt : 0;
      if (corre && J.vel > 3) J.cansancio = Math.max(0, J.cansancio - dt * 0.9);
    }
    J.corriendo = corre && J.vel > 3;

    // ── el cuerpo ── (horas de juego que pasaron en este cuadro: ctx.dh)
    const esfuerzo = J.corriendo ? 1.7 : E.lazo && E.lazo.estado === "enganchado" ? 1.5 : 1;
    J.sed = Math.max(0, J.sed - ctx.dh * 60 * (0.1 + 0.34 * E.motor.calor) * esfuerzo);
    J.cansancio = Math.max(0, J.cansancio - ctx.dh * 60 * 0.012 * esfuerzo);
    if (J.vel < 0.2 && !J.bloqueado) J.cansancio = Math.min(100, J.cansancio + dt * 0.25);
    J.salud = Math.min(100, J.salud + ctx.dh * 2);
    J.dolor = Math.max(0, J.dolor - dt * 1.4);

    colocarCamara(dt, t);
  };

  // ── la cámara ──
  const objetivo = new V(), deseada = new V();
  function colocarCamara(dt, t) {
    const cam = E.motor.camara, T = E.terreno, c = E.animales.caballo;
    const suelo = T.altura(J.x, J.z);
    // Un temblor de mano: respiración + el golpe de cada paso, apenas.
    J.bob += J.vel * dt * (J.montado ? 0.9 : 1.6);
    const paso = Math.sin(J.bob * Math.PI) * (J.montado ? 0.035 + Math.min(c.vReal, 9) * 0.006 : 0.03) * E.suave(0.3, 1.5, J.vel);
    const resp = Math.sin(t * 1.3) * 0.006 * (1 + (100 - J.cansancio) / 60);
    const ojo = J.montado ? J.asiento(tmp).y + 0.68 : suelo + 1.66;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(J.pitch + resp, J.yaw, 0, "YXZ"));
    if (J.camara === "primera") {
      cam.position.set(J.x, ojo + paso, J.z);
      cam.quaternion.copy(q);
      J.cuerpo.visible = false;
      if (J.piel) J.piel.raiz.visible = false;
      J.manos.visible = true;
    } else {
      // Por encima del hombro, 3,7 m, corrida 0,42 a la derecha. Se acerca
      // instantánea ante un choque y se aleja lenta.
      objetivo.set(J.x, ojo - 0.25, J.z);
      const atras = new V(0, 0, 1).applyQuaternion(q), der = new V(1, 0, 0).applyQuaternion(q);
      let d = J.montado ? 5 : 3.7;
      let libre = d;
      for (let k = 1; k <= 10; k++) {
        const f = (k / 10) * d;
        deseada.copy(objetivo).addScaledVector(atras, f).addScaledVector(der, 0.42);
        if (deseada.y < T.altura(deseada.x, deseada.z) + 0.3) { libre = f - 0.3; break; }
        let choca = false;
        for (const cc of E.flora.cercanos(deseada.x, deseada.z)) if (Math.hypot(deseada.x - cc.x, deseada.z - cc.z) < cc.r + 0.25) choca = true;
        if (choca) { libre = f - 0.4; break; }
      }
      J.dist3 = libre < J.dist3 ? libre : J.dist3 + (libre - J.dist3) * Math.min(1, dt * 1.2);
      cam.position.copy(objetivo).addScaledVector(atras, J.dist3).addScaledVector(der, 0.42);
      cam.quaternion.copy(q);
      J.cuerpo.visible = true;
      if (J.piel) J.piel.raiz.visible = true;
      J.manos.visible = false;
    }
    tomaDeCine(cam, ojo);
    posarCuerpo(dt, t);
    animarManos(dt, t);
  }

  // El ojo de águila: al tirar guiado, la cámara gira 90° alrededor del punto
  // medio entre el Guacho y la vaca, para ver volar la armada de costado.
  const pivote = new V(), orbita = new V(), haciaVaca = new V(), costado = new V(), qCine = new THREE.Quaternion(), mCine = new THREE.Matrix4();
  function tomaDeCine(cam, ojo) {
    const cq = E.ojo && E.ojo.cuadroCine();
    if (!cq) return;
    const T = E.terreno, cab = E.animales.cabeza(cq.v, tmp2);
    pivote.set(J.x, ojo - 0.4, J.z).lerp(cab, 0.5);
    haciaVaca.set(cab.x - J.x, 0, cab.z - J.z);
    const dist = haciaVaca.length() || 1;
    haciaVaca.divideScalar(dist);
    costado.set(-haciaVaca.z, 0, haciaVaca.x);
    const ds = E.clamp(dist * 0.85, 4.5, 12);
    orbita.copy(pivote).addScaledVector(haciaVaca, -ds * Math.cos(cq.ang)).addScaledVector(costado, ds * Math.sin(cq.ang));
    orbita.y = Math.max(pivote.y + 1.0, T.altura(orbita.x, orbita.z) + 1.2);
    cam.position.lerp(orbita, cq.mezcla);
    mCine.lookAt(cam.position, pivote, cam.up);
    qCine.setFromRotationMatrix(mCine);
    cam.quaternion.slerp(qCine, cq.mezcla);
    if (cq.mezcla > 0.3) {
      J.cuerpo.visible = true;
      if (J.piel) J.piel.raiz.visible = true;
      J.manos.visible = false;
    }
  }

  function posarCuerpo(dt, t) {
    const h = J.huesos, c = E.animales.caballo;
    if (J.montado) {
      // Sentado en el recado, las piernas abiertas alrededor del caballo.
      J.cuerpo.position.copy(J.asiento(tmp));
      J.cuerpo.position.y -= 0.98;
      J.cuerpo.rotation.set(0, c.yaw, 0);
      h.piernaI.rotation.set(-1.25, 0, 0.55); h.piernaD.rotation.set(-1.25, 0, -0.55);
      h.rodillaI.rotation.x = 1.35; h.rodillaD.rotation.x = 1.35;
      h.torso.rotation.x = Math.sin(c.fase * Math.PI * 4) * 0.04 * E.suave(1, 5, c.vReal);
    } else {
      J.cuerpo.position.set(J.x, E.terreno.altura(J.x, J.z), J.z);
      J.cuerpo.rotation.set(0, J.rumbo ?? J.yaw + Math.PI, 0);
      const f = J.bob * Math.PI, a = E.suave(0.2, 1.5, J.vel) * (J.corriendo ? 0.9 : 0.5);
      h.piernaI.rotation.set(Math.sin(f) * a, 0, 0); h.piernaD.rotation.set(-Math.sin(f) * a, 0, 0);
      h.rodillaI.rotation.x = Math.max(0, -Math.cos(f)) * a * 1.4; h.rodillaD.rotation.x = Math.max(0, Math.cos(f)) * a * 1.4;
      h.hombroI.rotation.x = -Math.sin(f) * a * 0.7;
      h.torso.rotation.x = J.corriendo ? 0.15 : 0.02;
    }
    // El brazo del lazo: arriba y girando al revolear, adelante al tirar.
    const lz = E.lazo;
    if (lz && lz.estado === "revoleando") {
      h.hombroD.rotation.set(Math.PI - 0.3 + Math.sin(lz.angulo) * 0.25, 0, Math.cos(lz.angulo) * 0.3);
      h.codoD.rotation.x = -0.4;
    } else if (lz && lz.estado === "enganchado") {
      h.hombroD.rotation.set(-0.9, 0, 0); h.codoD.rotation.x = -0.6;
      h.hombroI.rotation.set(-0.8, 0, 0); h.codoI.rotation.x = -0.5;
    } else {
      h.hombroD.rotation.set(J.montado ? -0.4 : Math.sin(J.bob * Math.PI) * 0.35 * E.suave(0.2, 1.5, J.vel), 0, 0);
      h.codoD.rotation.x = -0.25;
    }
    if (J.piel && J.piel.raiz.visible) vestir(dt);
  }

  // El modelo de Rezona: quieto, caminando o corriendo según la velocidad, y
  // encima lo que la animación no trae (sentarse en el recado, revolear).
  const qS = new THREE.Quaternion(), vS = new V();
  function vestir(dt) {
    const p = J.piel, M = E.modelos, r = p.roles, lz = E.lazo, c = E.animales.caballo;
    M.reponer(p);
    if (J.montado) {
      // La cadera del modelo exactamente sobre el recado, girada con el
      // caballo (bote y cabeceo incluidos).
      p.raiz.quaternion.copy(c.piel ? c.piel.raiz.quaternion : qS.setFromEuler(new THREE.Euler(0, c.yaw, 0)));
      p.raiz.position.copy(J.asiento(vS)).sub(tmp.copy(J.caderaLocal || new V(0, J.caderaAlto, 0)).applyQuaternion(p.raiz.quaternion));
    } else {
      p.raiz.position.copy(J.cuerpo.position);
      p.raiz.quaternion.copy(J.cuerpo.quaternion);
    }
    // Quieto, caminando o corriendo, a la velocidad del clip: el pie apoyado
    // tiene que ir para atrás a lo mismo que el cuerpo va para adelante.
    const v = J.montado ? 0 : Math.abs(J.vAdelante || 0), atras = (J.vAdelante || 0) < -0.05 ? -1 : 1;
    const anda = E.suave(0.15, 1.0, v), corre = p.acciones.run ? E.suave(2.5, 3.6, v) : 0;
    const vc = p.velClip || {};
    M.mezclar(p, { idle: 1 - anda, walk: anda * (1 - corre), run: anda * corre },
      { idle: J.montado ? 0 : 1, walk: atras * E.clamp(v / (vc.walk || 1.3), 0.5, 2.4), run: atras * E.clamp(v / (vc.run || 3.9), 0.7, 1.6) });
    p.mixer.update(dt);
    if (J.montado && r.cadera) {
      // Sentado no hay "quieto": el quieto de Rezona pasa el peso de una
      // pierna a la otra y la cadera se hamacaba sobre el recado. Cadera y
      // piernas en reposo, y encima la pose de montar.
      for (const n of ["Hip", "L_Thigh", "R_Thigh", "L_Calf", "R_Calf", "L_Foot", "R_Foot"]) {
        const h = p.huesos[n], rp = p.reposo.find((x) => x[0] === h);
        if (rp) { h.quaternion.copy(rp[1]); h.position.copy(rp[2]); }
      }
    }
    p.raiz.updateMatrixWorld(true);
    if (J.montado) {
      // Los muslos adelante y abiertos, las rodillas dobladas, los pies al
      // estribo; al galope, el cuerpo se echa adelante.
      for (const [muslo, rodilla, pie] of [[r.musloI, r.rodillaI, p.huesos.L_Foot], [r.musloD, r.rodillaD, p.huesos.R_Foot]]) {
        if (!muslo) continue;
        const lado = Math.sign(p.raiz.worldToLocal(muslo.getWorldPosition(tmp)).x) || 1;
        M.girar(p, muslo, M.X, -1.2);
        M.girar(p, muslo, M.Z, 0.36 * lado);
        M.girar(p, rodilla, M.X, 1.05);
        M.girar(p, pie, M.X, -0.25);
      }
      const galopa = E.suave(5, 8, c.vReal || 0);
      M.girar(p, r.torso, M.X, 0.08 + 0.22 * galopa);
    }
    // El brazo del lazo: arriba y girando al revolear, adelante al tirar.
    if (lz && lz.estado === "revoleando") {
      M.girar(p, r.brazoD, M.X, -(Math.PI - 0.35) + Math.sin(lz.angulo) * 0.25);
      M.girar(p, r.brazoD, M.Z, Math.cos(lz.angulo) * 0.3);
      M.girar(p, r.codoD, M.X, -0.35);
    } else if (lz && lz.estado === "enganchado") {
      M.girar(p, r.brazoD, M.X, -1.0); M.girar(p, r.codoD, M.X, -0.5);
      M.girar(p, r.brazoI, M.X, -0.9); M.girar(p, r.codoI, M.X, -0.4);
    } else if (J.montado) {
      // Las riendas: las dos manos adelante, a la altura de la cruz.
      // (y hacia adentro: sin esto el brazo derecho quedaba abierto al costado)
      M.girar(p, r.brazoD, M.X, -0.5); M.girar(p, r.brazoI, M.X, -0.5);
      M.girar(p, r.brazoD, M.Z, 0.3); M.girar(p, r.brazoI, M.Z, -0.3);
      M.girar(p, r.codoD, M.X, -0.7); M.girar(p, r.codoI, M.X, -0.7);
    }
  }

  function animarManos(dt, t) {
    const u = J.manos.userData, lz = E.lazo;
    const base = new V(0.2, -0.2, -0.12);
    if (lz && lz.estado === "revoleando") {
      // El brazo sube desde abajo a la derecha y la mano gira a la altura de
      // los ojos, en el borde de la vista (antes quedaba arriba, afuera del
      // cuadro, y solo se veía la manga).
      u.brazo.position.set(0.26 + Math.cos(lz.angulo) * 0.05, -0.33 + Math.sin(lz.angulo) * 0.04, -0.2);
      u.brazo.rotation.set(1.1, 0, -0.15);
    } else if (lz && lz.estado === "enganchado") {
      u.brazo.position.set(0.16, -0.2 + Math.sin(t * 9) * 0.01 * lz.tension, -0.3);
      u.brazo.rotation.set(-0.2, 0, 0);
    } else {
      u.brazo.position.copy(base).add(tmp.set(0, Math.sin(J.bob * Math.PI) * 0.01, 0));
      u.brazo.rotation.set(0, 0, 0);
    }
  }
})();
