// La hacienda y el caballo.
//
// Cada animal es UNA malla con esqueleto armado por código: cada parte (panza,
// cuello, cabeza, muslo, caña, cola) es rígida y va pegada a su hueso. Así una
// tropa de 18 vacas son 18 llamadas de dibujo y no 500, y las patas se mueven
// con la marcha que corresponde a la velocidad: paso, trote o galope.
//
// La conducta sale de la zona de fuga, que es como se arrea de verdad: si uno
// entra en la zona, la vaca se aparta; si entra rápido o muy adentro, dispara.
// Con eso solo, poniéndose del lado justo, se la lleva adonde uno quiere.
"use strict";
(() => {
  const A = (E.animales = { vacas: [], huellas: [], bostas: [] });
  const V = THREE.Vector3;

  // ── geometría con color ──
  function pintarPor(g, fn) {
    const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3), col = new THREE.Color();
    for (let i = 0; i < n; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), col); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g;
  }
  // Un tronco de cono a lo largo de -y (patas, cola) o de +z (cuello, cabeza).
  function cono(r0, r1, largo, eje = "y", lados = 8) {
    const g = new THREE.CylinderGeometry(r1, r0, largo, lados, 3);
    if (eje === "y") g.translate(0, -largo / 2, 0);
    else { g.rotateX(Math.PI / 2); g.translate(0, 0, largo / 2); }
    return g;
  }
  // La panza: un elipsoide deformado. Cruz alta adelante, panza que cuelga en
  // el medio, anca redonda.
  function panza(rx, ry, rz, joroba) {
    const g = new THREE.SphereGeometry(1, 22, 16);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * rx, y = p.getY(i) * ry, z = p.getZ(i) * rz;
      const f = z / rz;
      if (y > 0) y += joroba * Math.exp(-(((f - 0.55) / 0.22) ** 2)) * (y / ry);
      if (y < 0) y -= 0.07 * Math.exp(-((f / 0.5) ** 2)) * (-y / ry);
      x *= 1 - 0.12 * Math.max(0, f) ** 2;                        // más angosta adelante
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }

  // Arma un esqueleto y una malla con huesos rígidos a partir de partes.
  // huesos: [{ nombre, padre, pos: [x,y,z] }]; partes: [{ geo, hueso }]
  function armar(huesos, partes, mat) {
    const mapa = {}, lista = [];
    for (const h of huesos) {
      const b = new THREE.Bone();
      b.name = h.nombre;
      b.position.fromArray(h.pos);
      if (h.padre) mapa[h.padre].add(b);
      mapa[h.nombre] = b;
      lista.push(b);
    }
    const raiz = lista[0];
    raiz.updateMatrixWorld(true);
    const geos = [];
    for (const pt of partes) {
      const b = mapa[pt.hueso], idx = lista.indexOf(b);
      const g = pt.geo.clone().applyMatrix4(b.matrixWorld);
      const n = g.attributes.position.count;
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = idx; sw[i * 4] = 1; }
      g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
      geos.push(g);
    }
    const geo = juntarPiel(geos);
    const malla = new THREE.SkinnedMesh(geo, mat);
    malla.add(raiz);
    malla.bind(new THREE.Skeleton(lista));
    // Sobre una malla con esqueleto la caja de recorte es la de la pose de
    // reposo: sin esto desaparece en algunos cuadros (§ 4.3).
    malla.frustumCulled = false;
    malla.castShadow = true;
    malla.receiveShadow = true;
    return { malla, huesos: mapa };
  }
  A.armarMalla = (huesos, partes, mat) => armar(huesos, partes, mat);
  function juntarPiel(geos) {
    const base = E.juntar(geos);
    let nv = 0;
    for (const g of geos) nv += g.attributes.position.count;
    const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    let o = 0;
    for (const g of geos) { si.set(g.attributes.skinIndex.array, o * 4); sw.set(g.attributes.skinWeight.array, o * 4); o += g.attributes.position.count; }
    base.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
    base.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    return base;
  }

  // ── pelajes ──
  const C = (h) => new THREE.Color(h);
  const PELAJES = {
    hereford: { cuerpo: C("#6a2a14"), blanco: C("#e6ddd0"), hocico: C("#c08a80"), pezuna: C("#2a2420") },
    angus: { cuerpo: C("#141212"), blanco: C("#161413"), hocico: C("#1d1a19"), pezuna: C("#1a1716") },
    braford: { cuerpo: C("#7b3a1c"), blanco: C("#ddd2c2"), hocico: C("#2c2320"), pezuna: C("#2a2420") },
  };

  // ── la vaca ──
  function vacaMalla(tipo, semilla) {
    const az = E.azar(semilla), P = PELAJES[tipo];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
    const tono = 0.85 + az() * 0.3;
    const pelo = (col, base) => col.copy(base).multiplyScalar(tono * (0.92 + Math.random() * 0.12));
    const rx = 0.31, ry = 0.39, rz = 0.92;
    const joroba = tipo === "braford" ? 0.12 : 0.04;
    const alto = 0.93;                                  // centro de la panza
    const lp1 = 0.34, lp2 = 0.33;
    const huesos = [
      { nombre: "raiz", pos: [0, 0, 0] },
      { nombre: "cuerpo", padre: "raiz", pos: [0, alto, 0] },
      { nombre: "cuello", padre: "cuerpo", pos: [0, 0.18, 0.72] },
      { nombre: "cabeza", padre: "cuello", pos: [0, 0.08, 0.42] },
      { nombre: "cola", padre: "cuerpo", pos: [0, 0.3, -0.9] },
      { nombre: "cola2", padre: "cola", pos: [0, -0.42, 0] },
    ];
    const patas = [["DI", 0.17, 0.55], ["DD", -0.17, 0.55], ["TI", 0.17, -0.6], ["TD", -0.17, -0.6]];
    for (const [n, x, z] of patas) {
      huesos.push({ nombre: "muslo" + n, padre: "cuerpo", pos: [x, -0.2, z] });
      huesos.push({ nombre: "cana" + n, padre: "muslo" + n, pos: [0, -lp1, 0] });
    }
    const blanco = (col) => pelo(col, P.blanco);
    const rojo = (col) => pelo(col, P.cuerpo);
    const partes = [];
    partes.push({ hueso: "cuerpo", geo: pintarPor(panza(rx, ry, rz, joroba), (x, y, z, c) => {
      const f = z / rz;
      const panzaBlanca = y < -ry * 0.55 && Math.abs(x) < rx * 0.7;
      const pecho = f > 0.62 && y < 0.05;
      const cruz = tipo === "hereford" && f > 0.5 && y > ry * 0.8;
      (panzaBlanca || pecho || cruz ? blanco : rojo)(c);
    }) });
    partes.push({ hueso: "cuello", geo: pintarPor(cono(0.22, 0.17, 0.5, "z").rotateX(0.35), (x, y, z, c) => {
      (tipo === "hereford" && y > 0.1 ? blanco : y < -0.12 && tipo !== "angus" ? blanco : rojo)(c);
    }) });
    // La cabeza: el cráneo, el hocico, las orejas y a veces los cuernos.
    const craneo = cono(0.13, 0.1, 0.46, "z", 8).rotateX(0.55);
    pintarPor(craneo, (x, y, z, c) => ((tipo === "angus" ? rojo : blanco)(c)));
    const hocico = pintarPor(new THREE.SphereGeometry(0.1, 10, 8).scale(1.05, 0.8, 0.9).translate(0, -0.21, 0.38), (x, y, z, c) => c.copy(P.hocico));
    const orejaI = pintarPor(new THREE.SphereGeometry(0.07, 6, 4).scale(1.6, 0.35, 0.8).translate(0.17, 0.05, 0.02), (x, y, z, c) => rojo(c));
    const orejaD = orejaI.clone().scale(-1, 1, 1);
    partes.push({ hueso: "cabeza", geo: craneo }, { hueso: "cabeza", geo: hocico }, { hueso: "cabeza", geo: orejaI }, { hueso: "cabeza", geo: orejaD });
    const astada = tipo === "hereford" && az() < 0.5;
    if (astada) {
      for (const s of [1, -1]) {
        const cu = new THREE.ConeGeometry(0.035, 0.24, 6).rotateZ(-s * 1.1).translate(s * 0.15, 0.13, 0.0);
        partes.push({ hueso: "cabeza", geo: pintarPor(cu, (x, y, z, c) => c.set("#d8cfb8")) });
      }
    }
    partes.push({ hueso: "cola", geo: pintarPor(cono(0.035, 0.025, 0.42), (x, y, z, c) => rojo(c)) });
    partes.push({ hueso: "cola2", geo: pintarPor(cono(0.025, 0.05, 0.36, "y", 6), (x, y, z, c) => (y < -0.22 && tipo === "hereford" ? blanco : rojo)(c)) });
    for (const [n] of patas) {
      const tr = n[0] === "T";
      partes.push({ hueso: "muslo" + n, geo: pintarPor(cono(tr ? 0.13 : 0.11, 0.065, lp1 + 0.05, "y", 8), (x, y, z, c) => rojo(c)) });
      partes.push({ hueso: "cana" + n, geo: pintarPor(cono(0.055, 0.045, lp2, "y", 7), (x, y, z, c) => (tipo === "hereford" && y < -0.08 ? blanco : rojo)(c)) });
      partes.push({ hueso: "cana" + n, geo: pintarPor(new THREE.CylinderGeometry(0.05, 0.058, 0.07, 8).translate(0, -lp2 - 0.02, 0.01), (x, y, z, c) => c.copy(P.pezuna)) });
    }
    const r = armar(huesos, partes, mat);
    r.astada = astada;
    return r;
  }

  // ── el caballo ── criollo zaino, ensillado con recado.
  function caballoMalla() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
    const zaino = C("#40200f"), negro = C("#141110"), estrella = C("#ece6dc");
    const pelo = (c, b) => c.copy(b).multiplyScalar(0.94 + Math.random() * 0.1);
    const alto = 1.12, lp1 = 0.42, lp2 = 0.46;
    const huesos = [
      { nombre: "raiz", pos: [0, 0, 0] },
      { nombre: "cuerpo", padre: "raiz", pos: [0, alto, 0] },
      { nombre: "cuello", padre: "cuerpo", pos: [0, 0.2, 0.68] },
      { nombre: "cabeza", padre: "cuello", pos: [0, 0.52, 0.42] },
      { nombre: "cola", padre: "cuerpo", pos: [0, 0.2, -0.86] },
      { nombre: "cola2", padre: "cola", pos: [0, -0.4, -0.05] },
    ];
    const patas = [["DI", 0.15, 0.55], ["DD", -0.15, 0.55], ["TI", 0.15, -0.58], ["TD", -0.15, -0.58]];
    for (const [n, x, z] of patas) {
      huesos.push({ nombre: "muslo" + n, padre: "cuerpo", pos: [x, -0.15, z] });
      huesos.push({ nombre: "cana" + n, padre: "muslo" + n, pos: [0, -lp1, 0] });
    }
    const partes = [];
    partes.push({ hueso: "cuerpo", geo: pintarPor(panza(0.28, 0.33, 0.86, 0.05), (x, y, z, c) => pelo(c, zaino)) });
    partes.push({ hueso: "cuello", geo: pintarPor(cono(0.2, 0.12, 0.72, "z").rotateX(-0.85), (x, y, z, c) => pelo(c, zaino)) });
    // Crin: una lámina negra sobre el cuello.
    partes.push({ hueso: "cuello", geo: pintarPor(new THREE.BoxGeometry(0.04, 0.12, 0.72).rotateX(-0.85).translate(0, 0.32, 0.26), (x, y, z, c) => c.copy(negro)) });
    const craneo = cono(0.1, 0.07, 0.6, "z", 8).rotateX(1.05);
    partes.push({ hueso: "cabeza", geo: pintarPor(craneo, (x, y, z, c) => (z > 0.02 && z < 0.1 && y > -0.02 ? c.copy(estrella) : pelo(c, zaino))) });
    for (const s of [1, -1]) partes.push({ hueso: "cabeza", geo: pintarPor(new THREE.ConeGeometry(0.035, 0.14, 5).translate(s * 0.06, 0.1, -0.02), (x, y, z, c) => pelo(c, zaino)) });
    partes.push({ hueso: "cola", geo: pintarPor(cono(0.05, 0.07, 0.42), (x, y, z, c) => c.copy(negro)) });
    partes.push({ hueso: "cola2", geo: pintarPor(cono(0.07, 0.03, 0.5, "y", 6), (x, y, z, c) => c.copy(negro)) });
    for (const [n] of patas) {
      const tr = n[0] === "T";
      partes.push({ hueso: "muslo" + n, geo: pintarPor(cono(tr ? 0.12 : 0.1, 0.055, lp1 + 0.04), (x, y, z, c) => pelo(c, zaino)) });
      partes.push({ hueso: "cana" + n, geo: pintarPor(cono(0.045, 0.04, lp2), (x, y, z, c) => c.copy(negro)) });
      partes.push({ hueso: "cana" + n, geo: pintarPor(new THREE.CylinderGeometry(0.048, 0.058, 0.07, 8).translate(0, -lp2 - 0.02, 0.01), (x, y, z, c) => c.set("#222")) });
    }
    // El recado: bastos, cojinillo de oveja arriba y los estribos.
    partes.push({ hueso: "cuerpo", geo: pintarPor(new THREE.BoxGeometry(0.62, 0.1, 0.62).translate(0, 0.35, 0.08), (x, y, z, c) => c.set("#3b2616")) });
    partes.push({ hueso: "cuerpo", geo: pintarPor(new THREE.BoxGeometry(0.56, 0.08, 0.55).translate(0, 0.43, 0.08), (x, y, z, c) => c.set("#cfc2a8").multiplyScalar(0.9 + Math.random() * 0.15)) });
    partes.push({ hueso: "cuerpo", geo: pintarPor(new THREE.BoxGeometry(0.66, 0.05, 0.9).translate(0, 0.3, 0.05), (x, y, z, c) => c.set("#7a1e1a")) });
    for (const s of [1, -1]) {
      partes.push({ hueso: "cuerpo", geo: pintarPor(new THREE.BoxGeometry(0.015, 0.55, 0.03).translate(s * 0.33, 0.05, 0.12), (x, y, z, c) => c.set("#2a1a10")) });
      partes.push({ hueso: "cuerpo", geo: pintarPor(new THREE.TorusGeometry(0.06, 0.012, 4, 10).rotateY(Math.PI / 2).translate(s * 0.34, -0.25, 0.12), (x, y, z, c) => c.set("#777")) });
    }
    return armar(huesos, partes, mat);
  }

  // ── la marcha ── fase por distancia recorrida, patas desfasadas según el aire.
  const AIRES = {
    paso:   { zancada: 1.55, fases: { TI: 0, DI: 0.25, TD: 0.5, DD: 0.75 }, amp: 0.38, rodilla: 0.7, bote: 0.015 },
    trote:  { zancada: 2.4, fases: { DI: 0, TD: 0, DD: 0.5, TI: 0.5 }, amp: 0.55, rodilla: 1.0, bote: 0.04 },
    galope: { zancada: 3.6, fases: { TI: 0, TD: 0.1, DD: 0.45, DI: 0.55 }, amp: 0.75, rodilla: 1.2, bote: 0.07 },
  };
  function animarPatas(a, dt) {
    const v = a.vReal;
    const aire = v < 1.7 ? AIRES.paso : v < 4.6 ? AIRES.trote : AIRES.galope;
    a.fase = (a.fase + (v * dt) / aire.zancada) % 1;
    const quieto = E.suave(0.05, 0.35, v);
    const h = a.huesos;
    for (const n of ["DI", "DD", "TI", "TD"]) {
      const ph = (a.fase + aire.fases[n]) * Math.PI * 2;
      const tr = n[0] === "T";
      h["muslo" + n].rotation.x = Math.sin(ph) * aire.amp * quieto * (tr ? 0.9 : 1);
      // La rodilla (o el garrón) se dobla cuando la pata viaja hacia adelante.
      const dobla = Math.max(0, Math.cos(ph)) * aire.rodilla * quieto;
      h["cana" + n].rotation.x = dobla * (tr ? 0.7 : 1);
    }
    h.cuerpo.position.y = a.altoCuerpo + Math.abs(Math.sin(a.fase * Math.PI * 2)) * aire.bote * quieto;
    h.cuerpo.rotation.x = aire === AIRES.galope ? Math.sin(a.fase * Math.PI * 2) * 0.07 * quieto : 0;
  }

  // ── huellas, bosta y moscas ──
  function crearRastros() {
    const texH = E.lienzo(64, 64, (g, w, h) => {
      // Pezuña hendida: dos medialunas enfrentadas.
      g.fillStyle = "rgba(40,18,10,0.85)";
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * 8, h / 2, 7, 17, s * 0.12, 0, Math.PI * 2); g.fill(); }
    });
    const hueco = new THREE.PlaneGeometry(0.16, 0.2).rotateX(-Math.PI / 2);
    A.huellasFrescas = new THREE.InstancedMesh(hueco, new THREE.MeshStandardMaterial({ map: texH, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), 1600);
    A.huellasViejas = new THREE.InstancedMesh(hueco, new THREE.MeshStandardMaterial({ map: texH, transparent: true, opacity: 0.35, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), 1600);
    for (const im of [A.huellasFrescas, A.huellasViejas]) { im.count = 0; im.frustumCulled = false; im.receiveShadow = true; E.motor.escena.add(im); }
    const gB = new THREE.SphereGeometry(0.16, 10, 6).scale(1, 0.25, 1);
    A.bostaMalla = new THREE.InstancedMesh(gB, new THREE.MeshStandardMaterial({ color: 0x3a3320, roughness: 0.45 }), 200);
    A.bostaMalla.count = 0; A.bostaMalla.frustumCulled = false; A.bostaMalla.castShadow = true;
    E.motor.escena.add(A.bostaMalla);
    // Moscas: puntos negros que zumban sobre la bosta fresca y la herida.
    const n = 400;
    const gM = new THREE.BufferGeometry();
    gM.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    A.moscas = new THREE.Points(gM, new THREE.PointsMaterial({ color: 0x0a0a0a, size: 0.018, sizeAttenuation: true }));
    A.moscas.frustumCulled = false;
    E.motor.escena.add(A.moscas);
  }
  A.dejarHuella = (x, z, yaw, t) => {
    A.huellas.push({ x, z, yaw, t });
    if (A.huellas.length > 3000) A.huellas.shift();
  };
  A.dejarBosta = (x, z, t) => {
    A.bostas.push({ x, z, t });
    if (A.bostas.length > 200) A.bostas.shift();
    A.rehacerBosta();
  };
  A.rehacerBosta = () => {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V(1, 1, 1), p = new V();
    A.bostas.forEach((b, i) => { p.set(b.x, E.terreno.altura(b.x, b.z) + 0.01, b.z); m4.compose(p, q, s); A.bostaMalla.setMatrixAt(i, m4); });
    A.bostaMalla.count = A.bostas.length;
    A.bostaMalla.instanceMatrix.needsUpdate = true;
  };
  // Frescas: menos de 3 horas de juego. Las viejas se aclaran y a los dos
  // días desaparecen.
  A.rehacerHuellas = (tJuego) => {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V(1, 1, 1), p = new V(), eje = new V(0, 1, 0);
    let nf = 0, nv = 0;
    A.huellas = A.huellas.filter((h) => tJuego - h.t < 48);
    for (const h of A.huellas) {
      const fresca = tJuego - h.t < 3;
      const im = fresca ? A.huellasFrescas : A.huellasViejas;
      const k = fresca ? nf++ : nv++;
      if (k >= 1600) continue;
      p.set(h.x, E.terreno.altura(h.x, h.z) + 0.02, h.z);
      q.setFromAxisAngle(eje, h.yaw);
      m4.compose(p, q, s);
      im.setMatrixAt(k, m4);
    }
    A.huellasFrescas.count = Math.min(nf, 1600); A.huellasViejas.count = Math.min(nv, 1600);
    A.huellasFrescas.instanceMatrix.needsUpdate = A.huellasViejas.instanceMatrix.needsUpdate = true;
  };
  function moverMoscas(t, tJuego) {
    const focos = [];
    for (const b of A.bostas) if (tJuego - b.t < 5) focos.push([b.x, E.terreno.altura(b.x, b.z) + 0.25, b.z, 0.5]);
    for (const v of A.vacas) if (v.salud.bichera && !v.salud.muerta) {
      const h = A.puntoHerida(v, new V());
      focos.push([h.x, h.y, h.z, 0.45], [h.x, h.y, h.z, 0.7]);
    }
    const pos = A.moscas.geometry.attributes.position, n = pos.count;
    for (let i = 0; i < n; i++) {
      const f = focos.length ? focos[i % focos.length] : null;
      if (!f) { pos.setXYZ(i, 0, -100, 0); continue; }
      const a = t * (3 + (i % 7)) + i * 1.7, r = f[3] * (0.4 + ((i * 37) % 10) / 16);
      pos.setXYZ(i, f[0] + Math.cos(a) * r, f[1] + Math.sin(t * 5 + i) * 0.15 * r + r * 0.2, f[2] + Math.sin(a * 1.3) * r);
    }
    pos.needsUpdate = true;
  }

  // ── la piel de Rezona ── el animal de código sigue ahí, invisible: es el
  // esqueleto lógico que usan el lazo, la manga y la cura. El modelo lo copia
  // cuadro a cuadro (posición, giro, tumbe) y camina con su propia animación.
  const TINTES = { hereford: C("#ffffff"), angus: C("#2b2624"), braford: C("#e8cdb8") };
  function vestirCon(malla, nombre, tinte) {
    const M = E.modelos;
    const piel = M && M.hay(nombre) ? M.clonar(nombre, { tinte }) : null;
    if (!piel) return null;
    malla.material.visible = false;
    malla.castShadow = false;
    E.motor.escena.add(piel.raiz);
    return piel;
  }
  function recadoMalla() {
    const g = new THREE.Group();
    const m = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const pieza = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    pieza(new THREE.BoxGeometry(0.7, 0.04, 0.95), m(0x7a1e1a), 0, 0, 0);                        // la carona
    pieza(new THREE.BoxGeometry(0.6, 0.09, 0.62), m(0x3b2616, 0.7), 0, 0.06, 0.02);             // los bastos
    pieza(new THREE.BoxGeometry(0.56, 0.08, 0.55), m(0xcfc2a8, 1), 0, 0.13, 0.02);  // el cojinillo de oveja
    for (const s of [1, -1]) {
      pieza(new THREE.BoxGeometry(0.015, 0.6, 0.03), m(0x2a1a10), s * 0.35, -0.26, 0.1);        // la acción del estribo
      const e = pieza(new THREE.TorusGeometry(0.06, 0.012, 4, 10), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 }), s * 0.36, -0.58, 0.1);
      e.rotation.y = Math.PI / 2;
    }
    return g;
  }
  const qTmp = new THREE.Quaternion();
  function vestir(a, dt) {
    const p = a.piel, h = a.huesos, M = E.modelos;
    // De lejos, el animal de código (3 mil triángulos contra 19 mil) y sin
    // mezclador de animación: a 70 m no se nota y la tropa entera cuesta poco.
    const lejos = E.motor.camara.position.distanceToSquared(a.malla.position) > 70 * 70;
    p.raiz.visible = !lejos;
    a.malla.material.visible = lejos; a.malla.castShadow = lejos;
    if (lejos) return;
    const caido = a.estado === "tumbada" || a.estado === "levanta" || (a.salud && a.salud.muerta);
    p.raiz.position.copy(a.malla.position);
    p.raiz.quaternion.copy(a.malla.quaternion);
    // El bote del paso y el cabeceo del galope; la echada no (el modelo no
    // sabe plegar las patas: se queda parada, quieta).
    if (!caido) {
      p.raiz.position.y += h.cuerpo.position.y - a.altoCuerpo + (a.echar || 0) * 0.55;
      p.raiz.quaternion.multiply(qTmp.setFromAxisAngle(M.X, h.cuerpo.rotation.x));
    }
    if (p.mixer) {
      const v = caido ? 0 : a.vReal;
      M.mezclar(p, { walk: E.suave(0.04, 0.35, v) }, { walk: E.clamp(v * p.andar, 0.5, 4.2) });
      p.mixer.update(dt);
    }
    p.raiz.updateMatrixWorld(true);
    const r = p.roles;
    M.girar(p, r.cuello, M.X, h.cuello.rotation.x * p.cuanto.cuello);
    if (r.nuca) M.girar(p, r.nuca, M.X, h.cuello.rotation.x * 0.3);
    M.girar(p, r.cabeza, M.X, h.cabeza.rotation.x * p.cuanto.cabeza);
    M.girar(p, r.cabeza, M.Y, h.cabeza.rotation.y);
    if (r.cola) M.girar(p, r.cola, M.Y, h.cola.rotation.z * 1.5);
  }

  // ── la tropa ──
  const NOMBRES_BRAVA = new Set([4, 11]);
  A.construir = () => {
    crearRastros();
    const az = E.azar(1985);
    const L = E.lugares;
    for (let i = 0; i < 18; i++) {
      const tipo = i % 5 === 1 ? "angus" : i % 7 === 3 ? "braford" : "hereford";
      const { malla, huesos, astada } = vacaMalla(tipo, 500 + i);
      E.motor.escena.add(malla);
      const piel = vestirCon(malla, "vaca", TINTES[tipo].clone().multiplyScalar(0.88 + az() * 0.24));
      const ang = az() * Math.PI * 2, r = 30 + az() * 60;
      const v = {
        tipo, malla, huesos, astada, num: 200 + i * 7 + Math.floor(az() * 5),
        x: 110 + Math.cos(ang) * r, z: 60 + Math.sin(ang) * r, yaw: az() * Math.PI * 2,
        v: 0, vReal: 0, fase: az(), altoCuerpo: 0.93,
        estado: "pasta", t: az() * 10, rumbo: az() * Math.PI * 2, cabeza: 0,
        arisca: 0.3 + az() * 0.3, brava: NOMBRES_BRAVA.has(i) ? 0.8 : az() * 0.3,
        fatiga: 1, recorrido: 0, ultimaBosta: az() * 4, mugido: 5 + az() * 30,
        salud: { bichera: null, vacunada: false, desparasitada: false, caravana: false, marcada: false, muerta: false, curada: 0 },
        caravanaMalla: null, marcaMalla: null, piel,
      };
      A.vacas.push(v);
    }
    // La querencia de la tropa: el potrero donde pasta de día.
    A.querencia = { x: 115, z: 55 };
    const cab = caballoMalla();
    E.motor.escena.add(cab.malla);
    const pielC = vestirCon(cab.malla, "caballo", null);
    A.caballo = {
      malla: cab.malla, huesos: cab.huesos, x: L.rancho.x + 6, z: L.rancho.z + 7, yaw: -0.3, v: 0, vReal: 0, fase: 0, altoCuerpo: 1.12,
      aliento: 1, lesion: 0, montado: false, destino: null, cabeza: 0, t: 0, piel: pielC,
      // Dónde se sienta el jinete, sobre la raíz del caballo.
      sillaY: 1.59,
    };
    if (pielC) {
      const lomo = E.modelos.alturaLomo(pielC, 0.05) ?? 1.42;
      const recado = recadoMalla();
      recado.position.set(0, lomo - 0.02, 0.05);
      pielC.raiz.add(recado);
      A.caballo.sillaY = lomo + 0.15;
    }
  };

  // ── lo que el resto del juego necesita saber de una vaca ──
  const tmp = new V();
  A.cabeza = (a, destino) => (a.piel && a.piel.roles.cabeza ? a.piel.roles.cabeza.getWorldPosition(destino) : a.huesos.cabeza.localToWorld(destino.set(0, -0.08, 0.2)));
  A.cuello = (a, destino) => (a.piel && a.piel.roles.cuello ? a.piel.roles.cuello.getWorldPosition(destino) : a.huesos.cuello.getWorldPosition(destino));
  A.puntoHerida = (v, destino) => {
    const lado = v.salud.bichera ? v.salud.bichera.lado : 1;
    destino.set(lado * (v.piel ? v.piel.anchoHerida || 0.36 : 0.3), 0.05, -0.35);
    return v.huesos.cuerpo.localToWorld(destino);
  };
  A.cercana = (x, z, max, filtro = () => true) => {
    let mejor = null, md = max;
    for (const v of A.vacas) {
      if (v.salud.muerta || !filtro(v)) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < md) { md = d; mejor = v; }
    }
    return mejor;
  };

  A.enfermar = (v) => {
    v.salud.bichera = { dias: 0, lado: Math.random() < 0.5 ? 1 : -1, gusanos: 9 + Math.floor(Math.random() * 6) };
    v.arisca = Math.min(1, v.arisca + 0.35);
    v.estado = "esconde";
    // Una vaca agusanada se aparta de la tropa y se mete al monte, a la sombra.
    let mejor = null;
    const az = E.azar(Math.floor(Math.random() * 1e9));
    for (let k = 0; k < 60; k++) {
      const a = az() * Math.PI * 2, r = 80 + az() * 110;
      const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
      if (Math.abs(x) > 370 || Math.abs(z) > 370) continue;
      const m = E.terreno.monte(x, z);
      if (m > 0.55 && E.terreno.estero(x, z) > 1.2) { mejor = { x, z }; break; }
    }
    v.destino = mejor || { x: v.x + 60, z: v.z - 90 };
  };

  // ── conducta ──
  function sentir(v, jug) {
    const dx = v.x - jug.x, dz = v.z - jug.z, d = Math.hypot(dx, dz);
    // Zona de fuga: más chica si uno va a caballo (la hacienda está acostumbrada
    // al jinete), más grande si la vaca está arisca.
    const zona = (jug.montado ? 13 : 8.5) * (1 + v.arisca * 0.9);
    const intrusion = E.clamp((zona - d) / zona, 0, 1);
    return { d, dx: dx / (d || 1), dz: dz / (d || 1), intrusion, zona };
  }

  function evitarObstaculos(v, dx, dz) {
    // Mira 3 m adelante: si hay un tronco, un poste o agua honda, dobla.
    const T = E.terreno;
    for (let intento = 0; intento < 5; intento++) {
      const px = v.x + dx * 3, pz = v.z + dz * 3;
      let malo = T.agua(px, pz) > 0.9 || Math.abs(px) > E.lugares.limite - 2 || Math.abs(pz) > E.lugares.limite - 2;
      for (const c of E.flora.cercanos(px, pz)) if (Math.hypot(px - c.x, pz - c.z) < c.r + 0.8) malo = true;
      if (!malo) break;
      const a = (intento % 2 ? 1 : -1) * (0.6 + intento * 0.25);
      const nx = dx * Math.cos(a) - dz * Math.sin(a), nz = dx * Math.sin(a) + dz * Math.cos(a);
      dx = nx; dz = nz;
    }
    return [dx, dz];
  }

  function conducta(v, dt, jug, ctx) {
    if (v.salud.muerta) { v.v = 0; return; }
    v.t -= dt;
    const s = sentir(v, jug);
    let objetivo = null, vel = 0, cabezaBaja = 0;
    const est = v.estado;
    if (est === "enlazada" || est === "tumbada" || est === "manga" || est === "cepo") { v.v = 0; return; }
    if (est === "levanta") {
      if (v.t <= 0) { v.estado = "escapa"; v.t = 4; }
      v.v = 0; return;
    }

    // Embestida: una vaca brava, con uno a pie y cerca, carga.
    if (!jug.montado && v.brava > 0.6 && s.d < 6 && s.d > 1 && est !== "embiste" && Math.random() < dt * 0.25 * (v.salud.bichera ? 1.5 : 1)) {
      v.estado = "embiste"; v.t = 3.5;
      ctx.aviso(v, "embiste");
    }
    if (v.estado === "embiste") {
      objetivo = [-s.dx, -s.dz]; vel = 6.5;
      if (s.d < 1.4) { ctx.golpe(v, "cornada"); v.estado = "escapa"; v.t = 5; }
      if (v.t <= 0 || jug.montado) { v.estado = "escapa"; v.t = 3; }
    } else if (s.intrusion > 0) {
      // Adentro de la zona: se aparta. Si uno entra rápido o muy adentro,
      // dispara. La dirección es la de alejarse de uno, tirando un poco hacia
      // la tropa: así se arrea poniéndose del lado justo.
      const panico = s.intrusion > 0.55 || jug.vel > 5 || v.estado === "escapa";
      vel = panico ? 3.5 + v.arisca * 4 + s.intrusion * 2 : 0.8 + s.intrusion * 2.2;
      let dx = s.dx, dz = s.dz;
      if (!v.salud.bichera) {
        const qx = A.centroTropa.x - v.x, qz = A.centroTropa.z - v.z, ql = Math.hypot(qx, qz) || 1;
        dx += (qx / ql) * 0.25; dz += (qz / ql) * 0.25;
      }
      const l = Math.hypot(dx, dz); objetivo = [dx / l, dz / l];
      if (panico) { v.estado = "escapa"; v.t = 3 + v.arisca * 4; }
      // Patada: uno a pie, pegado a las patas de atrás de una vaca alterada.
      if (!jug.montado && s.d < 1.7 && v.estado === "escapa") {
        const atras = Math.cos(v.yaw) * s.dz * -1 + Math.sin(v.yaw) * s.dx * -1;
        if (atras > 0.5 && Math.random() < dt * 1.2) ctx.golpe(v, "patada");
      }
    } else if (v.estado === "escapa" && v.t > 0) {
      objetivo = [Math.sin(v.yaw), Math.cos(v.yaw)]; vel = 2.5;
    } else {
      if (v.estado === "escapa") v.estado = v.salud.bichera ? "esconde" : "pasta";
      const hora = ctx.hora;
      if (v.estado === "esconde" && v.destino) {
        const dx = v.destino.x - v.x, dz = v.destino.z - v.z, d = Math.hypot(dx, dz);
        if (d > 4) { objetivo = [dx / d, dz / d]; vel = 0.7; }
        else { vel = 0; cabezaBaja = 0.2; v.echada = true; }
      } else if (E.estancia.enCorral(v.x, v.z) && v.estado !== "saliendo") {
        v.estado = "corral";
        if (v.t <= 0) { v.rumbo = Math.random() * Math.PI * 2; v.t = 4 + Math.random() * 6; }
        objetivo = [Math.sin(v.rumbo), Math.cos(v.rumbo)]; vel = Math.random() < 0.5 ? 0.3 : 0;
      } else if (v.estado === "saliendo") {
        // Largada después de la manga: sale por la tranquera y vuelve al potrero.
        const L = E.lugares, px = L.corral.x - L.corral.r - 8, pz = L.corral.z;
        const dx = (v.x < L.corral.x - L.corral.r ? A.querencia.x : px) - v.x, dz = (v.x < L.corral.x - L.corral.r ? A.querencia.z : pz) - v.z, d = Math.hypot(dx, dz);
        objetivo = [dx / d, dz / d]; vel = 1.2;
        if (Math.hypot(v.x - A.querencia.x, v.z - A.querencia.z) < 30) v.estado = "pasta";
      } else if (hora > 12 && hora < 16.5 && v.estado !== "bebe") {
        // La siesta: a la sombra del algarrobo más cercano, a echarse.
        if (!v.sombra || v.t <= 0) { v.sombra = E.flora.sombraCercana(v.x, v.z, 90); v.t = 30; }
        if (v.sombra) {
          const a = (v.num * 1.7) % (Math.PI * 2);
          const sx = v.sombra.x + Math.cos(a) * 2.5, sz = v.sombra.z + Math.sin(a) * 2.5;
          const dx = sx - v.x, dz = sz - v.z, d = Math.hypot(dx, dz);
          if (d > 1.5) { objetivo = [dx / d, dz / d]; vel = 0.9; v.echada = false; }
          else { v.echada = true; }
        }
        if (ctx.sed && Math.random() < dt * 0.004) { v.estado = "bebe"; v.t = 200; }
      } else if (v.estado === "bebe") {
        const B = E.estancia.bebedero, dx = B.x + 1.5 - v.x, dz = B.z - v.z + ((v.num % 5) - 2) * 0.8, d = Math.hypot(dx, dz);
        if (d > 1.6) { objetivo = [dx / d, dz / d]; vel = 1.0; } else { cabezaBaja = 0.8; vel = 0; }
        if (v.t <= 0) { v.estado = "pasta"; v.t = 5; }
      } else {
        v.estado = "pasta"; v.echada = false;
        if (v.t <= 0) {
          // Se mueve de a poco, sin irse lejos de la tropa ni de la querencia.
          const qx = A.querencia.x - v.x, qz = A.querencia.z - v.z;
          const lejos = Math.hypot(qx, qz) > 70;
          v.rumbo = lejos ? Math.atan2(qx, qz) + (Math.random() - 0.5) : v.yaw + (Math.random() - 0.5) * 2;
          v.t = 4 + Math.random() * 10;
          v.pastando = Math.random() < 0.7;
        }
        objetivo = [Math.sin(v.rumbo), Math.cos(v.rumbo)];
        vel = v.pastando ? 0.12 : 0.55;
        cabezaBaja = v.pastando ? 1 : 0;
      }
    }
    if (objetivo) {
      let [dx, dz] = evitarObstaculos(v, objetivo[0], objetivo[1]);
      const deseado = Math.atan2(dx, dz);
      const giro = E.angulo(deseado - v.yaw);
      v.yaw += E.clamp(giro, -dt * (vel > 3 ? 2.4 : 1.4), dt * (vel > 3 ? 2.4 : 1.4));
    }
    // La bichera cansa: una vaca agusanada no corre como una sana.
    const tope = v.salud.bichera ? 4.8 : 8;
    v.v += (Math.min(vel, tope) * v.fatiga - v.v) * Math.min(1, dt * 1.8);
    v.cabezaObj = cabezaBaja;
  }

  function mover(a, dt) {
    const T = E.terreno, prevx = a.x, prevz = a.z;
    const fr = T.freno(a.x, a.z);
    a.x += Math.sin(a.yaw) * a.v * fr * dt;
    a.z += Math.cos(a.yaw) * a.v * fr * dt;
    const p = { x: a.x, z: a.z };
    E.estancia.empujar(p, 0.55);
    a.x = p.x; a.z = p.z;
    a.vReal = Math.hypot(a.x - prevx, a.z - prevz) / Math.max(dt, 1e-4);
  }

  function separar() {
    const vs = A.vacas;
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i], b = vs[j];
      if (a.salud.muerta || b.salud.muerta) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1.6 && d > 1e-4) {
        const e = (1.6 - d) / 2;
        if (a.estado !== "cepo" && a.estado !== "tumbada") { a.x -= (dx / d) * e; a.z -= (dz / d) * e; }
        if (b.estado !== "cepo" && b.estado !== "tumbada") { b.x += (dx / d) * e; b.z += (dz / d) * e; }
      }
    }
  }

  function posar(a, dt, t) {
    posarLogico(a, dt, t);
    if (a.piel) vestir(a, dt);
  }
  function posarLogico(a, dt, t) {
    const y = E.terreno.altura(a.x, a.z) - Math.min(0.6, E.terreno.agua(a.x, a.z) * 0.35);
    a.malla.position.set(a.x, y, a.z);
    a.malla.rotation.set(0, a.yaw, 0);
    const h = a.huesos;
    if (a.salud && a.salud.muerta) {
      a.malla.rotation.z = 1.45; a.malla.position.y = y + 0.32; return;
    }
    if (a.estado === "tumbada") {
      // Pialada: de costado, con las patas estiradas.
      a.tumbe = Math.min(1, (a.tumbe || 0) + dt * 2.5);
      a.malla.rotation.z = 1.4 * a.tumbe * (a.salud.bichera ? -a.salud.bichera.lado : 1);
      a.malla.position.y = y + 0.3 * a.tumbe;
      for (const n of ["DI", "DD", "TI", "TD"]) { h["muslo" + n].rotation.x = n[0] === "D" ? 0.6 : -0.5; h["cana" + n].rotation.x = 0; }
      h.cuello.rotation.x = -0.2;
      return;
    }
    if (a.estado === "levanta") {
      a.tumbe = Math.max(0, (a.tumbe || 0) - dt * 1.2);
      a.malla.rotation.z = 1.4 * a.tumbe * (a.salud.bichera ? -a.salud.bichera.lado : 1);
      a.malla.position.y = y + 0.3 * a.tumbe;
    }
    if (a.echada && a.vReal < 0.1) {
      // Echada rumiando: el cuerpo baja, las patas plegadas.
      a.echar = Math.min(1, (a.echar || 0) + dt * 0.8);
    } else a.echar = Math.max(0, (a.echar || 0) - dt * 1.5);
    animarPatas(a, dt);
    if (a.echar > 0) {
      h.cuerpo.position.y -= a.echar * 0.55;
      for (const n of ["DI", "DD", "TI", "TD"]) {
        h["muslo" + n].rotation.x = E.lerp(h["muslo" + n].rotation.x, n[0] === "D" ? -1.3 : 1.2, a.echar);
        h["cana" + n].rotation.x = E.lerp(h["cana" + n].rotation.x, n[0] === "D" ? 2.4 : -2.3, a.echar);
      }
    }
    a.cabeza += ((a.cabezaObj || 0) - a.cabeza) * Math.min(1, dt * 1.5);
    h.cuello.rotation.x = a.cabeza * 0.95 + Math.sin(t * 0.7 + (a.num || 0)) * 0.05;
    h.cabeza.rotation.x = a.cabeza * 0.35;
    h.cabeza.rotation.y = Math.sin(t * 0.3 + (a.num || 3) * 2) * 0.25 * (1 - a.cabeza);
    // La cola espanta moscas; más si está agusanada.
    const moscas = a.salud && a.salud.bichera ? 2.2 : 1;
    h.cola.rotation.z = Math.sin(t * 2.1 * moscas + (a.num || 0)) * 0.25 * moscas;
    h.cola.rotation.x = 0.15 + a.vReal * 0.08;
    h.cola2.rotation.z = Math.sin(t * 2.1 * moscas + 0.8 + (a.num || 0)) * 0.35 * moscas;
  }

  A.actualizar = (dt, t, jug, ctx) => {
    // El centro de la tropa, para que las que se apartan tiren hacia las otras.
    let cx = 0, cz = 0, n = 0;
    for (const v of A.vacas) if (!v.salud.muerta && !v.salud.bichera) { cx += v.x; cz += v.z; n++; }
    A.centroTropa = n ? { x: cx / n, z: cz / n } : A.querencia;
    for (const v of A.vacas) {
      conducta(v, dt, jug, ctx);
      if (!v.salud.muerta && v.estado !== "tumbada" && v.estado !== "cepo") mover(v, dt);
      // Huellas cada 0,9 m recorridos; bosta de vez en cuando; y la agusanada,
      // más seguido y blanda.
      v.recorrido += v.vReal * dt;
      if (v.recorrido > 0.9) {
        v.recorrido = 0;
        const lado = (v.huella = !v.huella) ? 0.16 : -0.16;
        A.dejarHuella(v.x + Math.cos(v.yaw) * lado, v.z - Math.sin(v.yaw) * lado, v.yaw, ctx.horasJuego);
      }
      v.ultimaBosta -= dt * ctx.escalaHoras;
      if (v.ultimaBosta <= 0 && v.vReal > 0.05) {
        v.ultimaBosta = v.salud.bichera ? 1.2 : 5 + Math.random() * 6;
        A.dejarBosta(v.x - Math.sin(v.yaw) * 0.9, v.z - Math.cos(v.yaw) * 0.9, ctx.horasJuego);
      }
      v.mugido -= dt;
      if (v.mugido <= 0) {
        v.mugido = (v.salud.bichera ? 9 : 25) + Math.random() * 50;
        ctx.mugir(v);
      }
    }
    separar();
    for (const v of A.vacas) { posar(v, dt, t); v.malla.updateMatrixWorld(true); }
    A.actualizarCaballo(dt, t, jug);
    moverMoscas(t, ctx.horasJuego);
  };

  // ── el caballo suelto ── si no se lo monta, se queda pastando donde se lo
  // dejó; con un silbido, viene.
  A.actualizarCaballo = (dt, t, jug) => {
    const c = A.caballo;
    if (!c.montado) {
      let vel = 0;
      if (c.destino) {
        const dx = c.destino.x - c.x, dz = c.destino.z - c.z, d = Math.hypot(dx, dz);
        if (d > 2.2) {
          const giro = E.angulo(Math.atan2(dx, dz) - c.yaw);
          c.yaw += E.clamp(giro, -dt * 1.5, dt * 1.5);
          vel = d > 12 ? 3.2 : 1.3;
        } else c.destino = null;
      }
      c.v += (vel * (c.lesion > 0 ? 0.5 : 1) - c.v) * Math.min(1, dt * 2);
      mover(c, dt);
      c.cabezaObj = vel === 0 ? 0.9 : 0;
      c.aliento = Math.min(1, c.aliento + dt * 0.012);
    }
    posar(c, dt, t);
    c.malla.updateMatrixWorld(true);
  };
})();
