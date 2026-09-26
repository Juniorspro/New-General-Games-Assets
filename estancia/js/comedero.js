// El encierre: un corral de tablas con el comedero de hormigón.
//
// El comedero es como los de un feedlot: una batea de hormigón sobre pilares
// de ladrillo, del lado de afuera del corral, con dos hilos de alambre por
// arriba; la hacienda mete la cabeza por debajo del alambre y come silo de
// maíz picado. Uno lo carga desde afuera, al lado de la silobolsa.
//
// Adentro hay ocho novillos de engorde, encerrados: si comen todos los días
// ganan kilos (y valen más al final de la temporada); si un día no se carga el
// comedero, pierden. Con el comedero cargado, la tropa de cerca también viene
// a comer: así se la junta cerca de las casas.
"use strict";
(() => {
  const K = (E.comedero = { nivel: 0, comieron: false });
  const V = THREE.Vector3;
  // El corral: 18 × 14 m, la batea en el lado norte (hacia el corral grande),
  // la tranquera al este (hacia el potrero).
  const X0 = 28, X1 = 46, Z0 = 32, Z1 = 46, PUERTA = { z0: 37.2, z1: 40.8 };
  K.caja = { X0, X1, Z0, Z1 };
  const SLOTS = 16, PASO = (X1 - X0 - 1.6) / (SLOTS - 1);
  K.dentro = (x, z) => x > X0 + 0.3 && x < X1 - 0.3 && z > Z0 + 0.3 && z < Z1 - 0.3;
  K.COSTO = 35000;

  function texSilo() {
    return E.lienzo(256, 256, (g, w, h) => {
      g.fillStyle = "#8a6a30"; g.fillRect(0, 0, w, h);
      const az = E.azar(4242);
      // Hebras cortas de chala, marlo y grano, de todos los tonos del maíz seco.
      for (let i = 0; i < 5200; i++) {
        const x = az() * w, y = az() * h, l = 2 + az() * 7, a = az() * Math.PI;
        const t = az();
        g.strokeStyle = t < 0.5 ? `rgba(${170 + az() * 60},${130 + az() * 50},${60 + az() * 30},0.9)` : t < 0.8 ? `rgba(${110 + az() * 40},${85 + az() * 30},${35 + az() * 20},0.9)` : `rgba(${140 + az() * 40},${140 + az() * 30},${60 + az() * 20},0.85)`;
        g.lineWidth = 0.8 + az() * 1.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${220 + az() * 30},${170 + az() * 40},${40 + az() * 30},0.9)`; g.fillRect(az() * w, az() * h, 2, 2); }
    }, { repetir: true });
  }
  function texHormigon() {
    return E.lienzo(256, 256, (g, w, h) => {
      g.fillStyle = "#8f8b83"; g.fillRect(0, 0, w, h);
      const az = E.azar(99);
      for (let i = 0; i < 9000; i++) { const c = 105 + az() * 60; g.fillStyle = `rgba(${c},${c - 3},${c - 8},${0.25 + az() * 0.3})`; g.fillRect(az() * w, az() * h, 1 + az() * 2, 1 + az() * 2); }
      // Manchas de humedad y de la comida, abajo.
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(90,80,60,${0.05 + az() * 0.1})`; g.beginPath(); g.ellipse(az() * w, h * (0.6 + az() * 0.4), 10 + az() * 30, 4 + az() * 10, 0, 0, Math.PI * 2); g.fill(); }
    }, { repetir: true });
  }
  function texLadrillo() {
    return E.lienzo(128, 128, (g, w, h) => {
      g.fillStyle = "#b9aea0"; g.fillRect(0, 0, w, h);
      const az = E.azar(7);
      for (let f = 0; f < 8; f++) for (let c = -1; c < 4; c++) {
        const x = c * 36 + (f % 2) * 18 + 2, y = f * 16 + 2;
        g.fillStyle = `rgb(${150 + az() * 40},${95 + az() * 30},${70 + az() * 20})`; g.fillRect(x, y, 33, 13);
      }
    }, { repetir: true });
  }

  K.construir = () => {
    const T = E.terreno, C = E.estancia, esc = E.motor.escena;
    const y0 = T.altura((X0 + X1) / 2, (Z0 + Z1) / 2);
    const madera = new THREE.MeshStandardMaterial({ color: 0x9a7a5a, roughness: 0.92 });
    const tablon = new THREE.MeshStandardMaterial({ color: 0x8c6d4f, roughness: 0.9 });
    const agrega = (m) => { m.castShadow = true; m.receiveShadow = true; esc.add(m); return m; };

    // ── el cerco: postes de quebracho y tres tablas (el lado del comedero,
    // postes y dos hilos de alambre, para que pase la cabeza) ──
    const postes = [];
    const lado = (ax, az, bx, bz, tablas, saltea) => {
      const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l / 2.4));
      for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
        if (saltea && saltea(x, z)) continue;
        postes.push([x, z]);
      }
      if (!tablas) return;
      const ang = Math.atan2(bz - az, bx - ax);
      for (const h of [0.45, 0.85, 1.25]) {
        const tramo = (x0, z0, x1, z1) => {
          const lt = Math.hypot(x1 - x0, z1 - z0);
          if (lt < 0.2) return;
          const m = agrega(new THREE.Mesh(new THREE.BoxGeometry(lt, 0.16, 0.05), tablon));
          m.position.set((x0 + x1) / 2, T.altura((x0 + x1) / 2, (z0 + z1) / 2) + h, (z0 + z1) / 2);
          m.rotation.y = -ang;
        };
        if (saltea) { tramo(ax, az, ax, PUERTA.z0); tramo(ax, PUERTA.z1, bx, bz); } else tramo(ax, az, bx, bz);
      }
    };
    const enPuerta = (x, z) => z > PUERTA.z0 + 0.1 && z < PUERTA.z1 - 0.1;
    lado(X0, Z0, X0, Z1, true);                      // oeste
    lado(X0, Z1, X1, Z1, true);                      // sur
    lado(X1, Z0, X1, Z1, true, enPuerta);            // este, con la tranquera
    lado(X0, Z0, X1, Z0, false);                     // norte: el del comedero
    const gp = new THREE.CylinderGeometry(0.07, 0.085, 1.9, 6);
    const ip = new THREE.InstancedMesh(gp, madera, postes.length), m4 = new THREE.Matrix4(), az = E.azar(3131);
    postes.forEach(([x, z], i) => { m4.compose(new V(x, T.altura(x, z) + 0.6, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((az() - 0.5) * 0.05, az() * 6, (az() - 0.5) * 0.05)), new V(1, 1, 1)); ip.setMatrixAt(i, m4); });
    ip.castShadow = true; ip.receiveShadow = true; esc.add(ip);
    // Los hilos de alambre del lado del comedero.
    const alambre = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.35 });
    for (const h of [1.3, 1.55]) { const w = agrega(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, X1 - X0, 4), alambre)); w.rotation.z = Math.PI / 2; w.position.set((X0 + X1) / 2, y0 + h, Z0); }
    // Choques: los cuatro lados; la tranquera es un segmento que se prende.
    const pared = (ax, az2, bx, bz, apagado = false) => { const s = { ax, az: az2, bx, bz, g: 0.12, apagado }; C.segmentos.push(s); return s; };
    pared(X0, Z0, X1, Z0); pared(X0, Z0, X0, Z1); pared(X0, Z1, X1, Z1);
    pared(X1, Z0, X1, PUERTA.z0); pared(X1, PUERTA.z1, X1, Z1);
    // La tranquera, de tablas, cerrada al empezar (los novillos están adentro).
    const tq = new THREE.Group();
    for (const h of [0.4, 0.8, 1.2]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, PUERTA.z1 - PUERTA.z0), tablon); t.position.set(0, h, (PUERTA.z1 - PUERTA.z0) / 2); t.castShadow = true; tq.add(t); }
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 3.9), tablon); diag.rotation.x = 0.3; diag.position.set(0, 0.8, (PUERTA.z1 - PUERTA.z0) / 2); tq.add(diag);
    tq.position.set(X1, T.altura(X1, PUERTA.z0), PUERTA.z0); esc.add(tq);
    K.tranquera = { grupo: tq, abierta: false, angulo: 0, segmento: pared(X1, PUERTA.z0, X1, PUERTA.z1, false) };
    C.puntos.push({ id: "tranqueraEncierre", x: X1 + 1.5, z: PUERTA.z1 + 1.2, r: 2.2, texto: "Abrir la tranquera del encierre" });

    // ── el comedero: batea de hormigón con el borde redondeado, sobre pilares ──
    const hormigon = new THREE.MeshStandardMaterial({ map: texHormigon(), roughness: 0.85 });
    hormigon.map.repeat.set(6, 1);
    const perfil = new THREE.Shape();
    // En el plano (z, y) del costado: el fondo, las paredes y el labio de afuera
    // más alto (el que se ve en la foto, redondeado).
    perfil.moveTo(-0.45, 0); perfil.lineTo(0.42, 0); perfil.lineTo(0.42, 0.3); perfil.quadraticCurveTo(0.42, 0.38, 0.35, 0.38);
    perfil.lineTo(0.3, 0.38); perfil.lineTo(0.3, 0.1); perfil.lineTo(-0.34, 0.1); perfil.lineTo(-0.34, 0.46);
    perfil.quadraticCurveTo(-0.34, 0.54, -0.4, 0.54); perfil.quadraticCurveTo(-0.46, 0.54, -0.46, 0.46); perfil.lineTo(-0.45, 0);
    const largo = X1 - X0 - 0.4;
    const gb = new THREE.ExtrudeGeometry(perfil, { depth: largo, bevelEnabled: false, curveSegments: 6 });
    // Girada así el labio alto queda del lado de afuera (el de la calle de
    // carga) y el bajo del lado de las vacas, como en un feedlot.
    gb.rotateY(-Math.PI / 2); gb.translate(X0 + 0.2 + largo, 0, 0);
    const zc = Z0 - 0.62, yb = y0 + 0.18;
    const batea = agrega(new THREE.Mesh(gb, hormigon));
    batea.position.set(0, yb, zc);
    // Los pilares de ladrillo.
    const ladrillo = new THREE.MeshStandardMaterial({ map: texLadrillo(), roughness: 0.9 });
    for (let x = X0 + 0.8; x < X1 - 0.3; x += 1.9) { const p = agrega(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.7), ladrillo)); p.position.set(x, T.altura(x, zc) + 0.07, zc); }
    // El silo adentro de la batea: una sábana con bultos que sube y baja con lo
    // que queda.
    const tex = texSilo(); tex.repeat.set(18, 1);
    const gs = new THREE.PlaneGeometry(largo - 0.05, 0.62, 90, 4); gs.rotateX(-Math.PI / 2);
    const pos = gs.attributes.position, azs = E.azar(55);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const borde = 1 - Math.abs(z) / 0.31; pos.setY(i, (0.04 + 0.05 * Math.sin(x * 2.3) * Math.sin(x * 0.7 + 1) + azs() * 0.03) * Math.max(0, borde) ** 0.5); }
    gs.computeVertexNormals();
    const silo = agrega(new THREE.Mesh(gs, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })));
    silo.position.set((X0 + X1) / 2, yb + 0.15, zc - 0.02);
    silo.castShadow = false;
    K.silo = silo; K.yVacio = yb + 0.09; K.yLleno = yb + 0.3;
    K.zBatea = zc;
    C.puntos.push({ id: "comederoHacienda", x: (X0 + X1) / 2, z: Z0 - 1.9, r: 3.2, texto: "Cargar el comedero con silo" });

    // ── la silobolsa: el tubo blanco de plástico donde se guarda el silo ──
    const bolsa = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 12, 24, 1), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.55 }));
    bolsa.rotation.z = Math.PI / 2; bolsa.scale.set(1, 1, 0.8);
    const bx = X0 - 2.5, bz = Z0 - 6.5;
    bolsa.position.set(bx - 6, T.altura(bx - 6, bz) + 0.75, bz); agrega(bolsa);
    const tapa = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), new THREE.MeshStandardMaterial({ color: 0x8a6a30, roughness: 1 }));
    tapa.rotation.y = Math.PI / 2; tapa.scale.set(0.8, 1, 1); tapa.position.set(bx + 0.01, T.altura(bx, bz) + 0.75, bz); esc.add(tapa);
    C.segmentos.push({ ax: bx - 12, az: bz, bx, bz, g: 0.95 });
    C.circulos.push({ x: bx, z: bz, r: 1.1 });

    K.fijarNivel(0.55);
  };

  K.fijarNivel = (n) => {
    K.nivel = E.clamp(n, 0, 1);
    if (!K.silo) return;
    K.silo.visible = K.nivel > 0.01;
    K.silo.position.y = E.lerp(K.yVacio, K.yLleno, K.nivel);
  };
  K.alternarTranquera = () => {
    const t = K.tranquera; t.abierta = !t.abierta; t.segmento.apagado = t.abierta;
    E.estancia.puntos.find((p) => p.id === "tranqueraEncierre").texto = t.abierta ? "Cerrar la tranquera del encierre" : "Abrir la tranquera del encierre";
  };

  // Cargar: un rato con la pala desde la silobolsa. La hacienda de cerca viene.
  K.cargar = () => {
    const G = E.juego;
    if (K.nivel > 0.85) { G.mostrar("El comedero ya está lleno."); return; }
    G.fundir(0.4, () => {
      K.fijarNivel(1);
      G.gastar(K.COSTO, "Silo");
      G.mostrar(`Cargaste el comedero con silo de maíz ($ ${new Intl.NumberFormat("es-AR").format(K.COSTO)}). La hacienda ya levanta la cabeza.`);
      llamar(160);
    });
  };
  // Las que están cerca y libres, a comer.
  function llamar(radio) {
    const A = E.animales;
    for (const v of A.vacas) {
      if (v.salud.muerta || v.ternero || v.salud.bichera) continue;
      if (!["pasta", "corral", "encierre"].includes(v.estado)) continue;
      if (Math.hypot(v.x - (X0 + X1) / 2, v.z - (Z0 + Z1) / 2) > radio) continue;
      if (!K.dentro(v.x, v.z) && !K.tranquera.abierta) continue;       // con la tranquera cerrada, solo las de adentro
      v.estado = "come"; v.t = 0;
    }
  }

  // El lugar de cada una en la batea (el primero libre, de a una por lugar).
  const ocupados = new Map();
  function lugar(v) {
    if (v.slot !== undefined && ocupados.get(v.slot) === v) return v.slot;
    for (let i = 0; i < SLOTS; i++) { const k = (i * 7 + (v.num || 0)) % SLOTS; if (!ocupados.has(k)) { ocupados.set(k, v); v.slot = k; return k; } }
    return null;
  }
  function soltar(v) { if (v.slot !== undefined && ocupados.get(v.slot) === v) ocupados.delete(v.slot); v.slot = undefined; }

  // Para animales.js: si esta vaca está en algo del encierre, a dónde va.
  // Devuelve { objetivo, vel, cabeza } o null.
  const puertaAfuera = { x: X1 + 4, z: (PUERTA.z0 + PUERTA.z1) / 2 }, puertaAdentro = { x: X1 - 2.5, z: (PUERTA.z0 + PUERTA.z1) / 2 };
  const hacia = (v, p, vel) => { const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz) || 1; return { objetivo: [dx / d, dz / d], vel: d < 0.4 ? 0 : vel, cabeza: 0, d }; };
  K.guiar = (v, dt) => {
    const adentro = K.dentro(v.x, v.z);
    if (v.estado === "come") {
      if (K.nivel <= 0.01) { soltar(v); v.estado = adentro && !K.tranquera.abierta ? "encierre" : "pasta"; return null; }
      if (!adentro) {
        if (!K.tranquera.abierta) { soltar(v); v.estado = "pasta"; return null; }
        // Primero a la tranquera, después adentro.
        const r = hacia(v, Math.abs(v.z - puertaAfuera.z) < 1.8 && v.x > X1 - 0.5 ? puertaAdentro : puertaAfuera, 1.1);
        return r;
      }
      const k = lugar(v);
      if (k === null) return { objetivo: [Math.sin(v.yaw), Math.cos(v.yaw)], vel: 0, cabeza: 0.3 };
      const sx = X0 + 0.8 + k * PASO, sz = Z0 + 0.78;
      const r = hacia(v, { x: sx, z: sz }, 0.9);
      if (r.d < 0.9) {
        // En su lugar: de frente a la batea, la cabeza abajo, comiendo.
        K.fijarNivel(K.nivel - dt * 0.00055);
        K.comieron = true;
        if (v.engorde) v.comioHoy = true;
        return { objetivo: [0, -1], vel: 0, cabeza: 0.75 };
      }
      return r;
    }
    soltar(v);
    // Encerradas: dan vueltas adentro; y si hay comida, van a comer.
    if (adentro && !K.tranquera.abierta) {
      if (K.nivel > 0.05) { v.estado = "come"; return K.guiar(v, dt); }
      v.estado = "encierre";
      if (v.t <= 0) { v.rumbo = Math.random() * Math.PI * 2; v.t = 5 + Math.random() * 8; }
      const cx = (X0 + X1) / 2 - v.x, cz = (Z0 + Z1) / 2 - v.z;
      const lejos = Math.abs(cx) > (X1 - X0) / 2 - 2.5 || Math.abs(cz) > (Z1 - Z0) / 2 - 2.5;
      const a = lejos ? Math.atan2(cx, cz) : v.rumbo;
      return { objetivo: [Math.sin(a), Math.cos(a)], vel: Math.random() < 0.5 ? 0.3 : 0.05, cabeza: 0.6 };
    }
    // Adentro con la tranquera abierta y sin comida: salen por la tranquera.
    if (adentro && v.estado === "pasta" && !v.engorde) return hacia(v, puertaAfuera, 0.8);
    return null;
  };

  // Cada tanto, con comida en la batea, las de cerca se acercan solas.
  let proxLlamado = 20;
  K.actualizar = (dt) => {
    proxLlamado -= dt;
    if (proxLlamado <= 0) { proxLlamado = 30; if (K.nivel > 0.2) llamar(70); }
    const t = K.tranquera;
    if (t) { const obj = t.abierta ? 1.9 : 0; t.angulo += (obj - t.angulo) * Math.min(1, dt * 3); t.grupo.rotation.y = t.angulo; }
  };

  // A la mañana: cómo les fue a los novillos.
  K.amanecer = () => {
    const A = E.animales, nov = A.vacas.filter((v) => v.engorde && !v.salud.muerta);
    let texto = "";
    if (!nov.length) return texto;
    const comieron = nov.filter((v) => v.comioHoy).length;
    for (const v of nov) { v.kilos = (v.kilos || 320) + (v.comioHoy ? 1.2 : -0.9) * 1; v.comioHoy = false; }
    const kg = Math.round(nov.reduce((s, v) => s + v.kilos, 0) / nov.length);
    texto += comieron === nov.length ? `Los novillos del encierre comieron bien: promedian ${kg} kg. ` : comieron ? `Solo ${comieron} de ${nov.length} novillos alcanzaron el comedero; promedian ${kg} kg. ` : `Los novillos del encierre pasaron el día sin comer: bajaron a ${kg} kg. Hay que cargarles el comedero. `;
    K.comieron = false;
    return texto;
  };
})();
