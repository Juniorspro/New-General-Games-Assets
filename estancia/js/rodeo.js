// El rodeo grande: 500 vacas, 20 toros y 400 terneros repartidos en rodeos por
// el campo.
//
// Novecientos animales con el modelo de Rezona y su esqueleto no los mueve
// ningún navegador, así que van en dos niveles:
//  - Todos se simulan: pastan, caminan, se echan a la siesta, huyen de uno y
//    de los perros, y cada ternero anda al pie de su madre. Los lejos, un
//    cuarto por cuadro; los de cerca, todos los cuadros.
//  - Se dibujan con un modelo liviano instanciado (una sola llamada para los
//    920) que mueve las patas, la cabeza y la cola en el shader. Los que
//    quedan cerca de uno toman el modelo de Rezona con la marcha de verdad
//    (cuántos, según la calidad gráfica).
// La hacienda de trabajo (la que se enlaza, se cura y va a la manga) sigue
// siendo la de animales.js; el rodeo es el campo poblado.
"use strict";
(() => {
  const R = (E.rodeo = { lista: [], cuantos: { vacas: 500, toros: 20, terneros: 400 } });
  const V = THREE.Vector3;
  const CERCA = 36, SUELTA = 44;            // radio en que toma el modelo de Rezona (y lo suelta)

  // ── el modelo liviano ── en el marco del modelo, mirando a +z. El color
  // guarda qué parte es cada vértice (r = parte/10) y si es "blanco" (g).
  // Partes: 0 cuerpo, 1-4 patas (DI DD TI TD), 5 cabeza y cuello, 6 cola.
  const PIVOTES = [[0, 0, 0], [0.2, 0.86, 0.62], [-0.2, 0.86, 0.62], [0.2, 0.86, -0.6], [-0.2, 0.86, -0.6], [0, 1.18, 0.82], [0, 1.2, -0.98]];
  function geometriaVaca() {
    const partes = [];
    const pintar = (g, parte, blanco) => {
      g = g.index ? g.toNonIndexed() : g;
      const p = g.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { c[i * 3] = parte / 10; c[i * 3 + 1] = blanco(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3 + 2] = 0; }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      partes.push(g);
    };
    // El cuerpo: panza blanca abajo (Hereford), el lomo más alto adelante.
    const cuerpo = new THREE.SphereGeometry(1, 10, 7); cuerpo.scale(0.4, 0.46, 0.98); cuerpo.translate(0, 1.02, 0);
    pintar(cuerpo, 0, (x, y) => (y < 0.72 ? 1 : 0));
    const cruz = new THREE.SphereGeometry(1, 7, 5); cruz.scale(0.34, 0.3, 0.45); cruz.translate(0, 1.22, 0.5);
    pintar(cruz, 0, () => 0);
    // Cuello y cabeza (la cara blanca), con orejas y hocico.
    const cuello = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 8); cuello.rotateX(1.1); cuello.translate(0, 1.12, 0.98);
    pintar(cuello, 5, () => 0);
    const cabeza = new THREE.BoxGeometry(0.28, 0.32, 0.46); cabeza.translate(0, 0.98, 1.32);
    pintar(cabeza, 5, (x, y, z) => (z > 1.18 ? 1 : 0));
    const hocico = new THREE.BoxGeometry(0.22, 0.2, 0.14); hocico.translate(0, 0.9, 1.58);
    pintar(hocico, 5, () => 1);
    for (const s of [-1, 1]) { const o = new THREE.BoxGeometry(0.2, 0.06, 0.1); o.translate(s * 0.22, 1.12, 1.2); pintar(o, 5, () => 0); }
    // Las patas, con la caña blanca abajo.
    PIVOTES.slice(1, 5).forEach(([x, y, z], k) => {
      const p = new THREE.CylinderGeometry(0.075, 0.06, y, 6); p.translate(x, y / 2, z);
      pintar(p, k + 1, (px, py) => (py < 0.32 ? 1 : 0));
    });
    // La cola, con la borla blanca.
    const cola = new THREE.CylinderGeometry(0.025, 0.04, 0.8, 5); cola.translate(0, 0.8, -1.02);
    pintar(cola, 6, (x, y) => (y < 0.52 ? 1 : 0));
    return E.juntar(partes);
  }
  function materialVaca(uT) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.uniforms.uPiv = { value: PIVOTES.map((p) => new V(...p)) };
      sh.vertexShader = `attribute vec3 color; attribute vec3 aColA; attribute vec3 aColB; attribute vec4 aAnim;
        uniform float uT; uniform vec3 uPiv[7]; varying vec3 vColR;
        mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
        mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
        ` + sh.vertexShader
        .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
          // aAnim: x fase propia, y velocidad, z cabeza gacha (0..1), w echada (0..1)
          int parteP = int(floor(color.r * 10.0 + 0.5));
          float vel = aAnim.y, frec = 0.6 + 0.42 * vel, amp = clamp(vel * 0.32, 0.0, 0.55);
          float ph = (uT * frec + aAnim.x) * 6.2832;
          mat3 rotP = mat3(1.0); vec3 pivP = vec3(0.0);
          if (parteP >= 1 && parteP <= 4) {
            float of = parteP == 1 ? 0.25 : parteP == 2 ? 0.75 : parteP == 3 ? 0.0 : 0.5;
            float del = parteP <= 2 ? -1.0 : 1.0;
            pivP = uPiv[parteP];
            rotP = rotX(sin(ph + of * 6.2832) * amp + del * 1.45 * aAnim.w);
          } else if (parteP == 5) {
            pivP = uPiv[5];
            rotP = rotX(aAnim.z * 0.95 + sin(ph * 2.0) * 0.05 * amp);
          } else if (parteP == 6) {
            pivP = uPiv[6];
            rotP = rotZ(sin(uT * 2.1 + aAnim.x * 9.0) * 0.28);
          }
          objectNormal = rotP * objectNormal;
          vColR = mix(aColA, aColB, color.g);`)
        .replace("#include <begin_vertex>", `vec3 transformed = rotP * (position - pivP) + pivP;
          transformed.y -= 0.52 * aAnim.w;`);
      sh.fragmentShader = "varying vec3 vColR;\n" + sh.fragmentShader.replace("#include <color_fragment>", "diffuseColor.rgb *= vColR;");
    };
    m.customProgramCacheKey = () => "rodeo-vaca";
    return m;
  }

  // ── los rodeos: dónde pasta cada grupo ──
  function lugaresDeRodeo(n) {
    const T = E.terreno, L = E.lugares, az = E.azar(9191), cand = [];
    for (let k = 0; k < 900; k++) {
      const x = (az() * 2 - 1) * (L.limite - 50), z = (az() * 2 - 1) * (L.limite - 50);
      if (T.distEstancia(x, z) < 130 || Math.hypot(x - 115, z - 55) < 55 || T.estero(x, z) < 1.4) continue;
      if (T.monte(x, z) > 0.12 || T.agua(x, z) > 0 || T.distZanja(x, z) < 20 || T.distCamino(x, z) < 12) continue;
      cand.push({ x, z });
    }
    // Repartidos: cada uno, el candidato más lejos de los ya elegidos.
    const elegidos = [cand[0] || { x: 200, z: 200 }];
    while (elegidos.length < n && cand.length) {
      let mejor = null, dm = -1;
      for (const c of cand) { const d = Math.min(...elegidos.map((e) => Math.hypot(e.x - c.x, e.z - c.z))); if (d > dm) { dm = d; mejor = c; } }
      elegidos.push(mejor);
    }
    return elegidos;
  }

  // ── armar ──
  let malla, aAnim, aColA, aColB, uT = { value: 0 };
  const m4 = new THREE.Matrix4(), qY = new THREE.Quaternion(), eY = new V(0, 1, 0), sV = new V(), pV = new V();
  R.construir = () => {
    const A = E.animales, RZ = A.RAZAS, az = E.azar(4545), T = E.terreno;
    const grupos = lugaresDeRodeo(9);
    const razas = ["hereford", "hereford", "angus", "angus", "colorada", "braford", "brahman", "criolla"];
    const N = R.cuantos.vacas + R.cuantos.toros + R.cuantos.terneros;
    const nuevo = (k, raza, g) => {
      const ang = az() * Math.PI * 2, r = 4 + az() * 38, gr = grupos[g];
      const a = {
        k, raza, g, x: gr.x + Math.cos(ang) * r, z: gr.z + Math.sin(ang) * r, yaw: az() * 6.28, v: 0, est: "pasta", t: az() * 8, rumbo: az() * 6.28,
        fase: az(), cab: 0, echar: 0, pastando: az() < 0.7, arisca: 0.2 + az() * 0.4, num: 1000 + R.lista.length, madre: null, cuerpo: null,
        i: R.lista.length, px: 0, pz: 0, vAnim: 0, acum: 0,
      };
      a.px = a.x; a.pz = a.z;
      R.lista.push(a);
      return a;
    };
    const vacas = [];
    for (let i = 0; i < R.cuantos.vacas; i++) vacas.push(nuevo("vaca", razas[Math.floor(az() * razas.length)], i % grupos.length));
    for (let i = 0; i < R.cuantos.toros; i++) nuevo("toro", "angus", i % grupos.length);
    for (let i = 0; i < R.cuantos.terneros; i++) {
      const m = vacas[i % vacas.length], t = nuevo("ternero", m.raza, m.g);
      t.madre = m; t.x = m.x + 1.5; t.z = m.z + 1; t.px = t.x; t.pz = t.z;
    }
    // La malla instanciada: una llamada para todos.
    const geo = geometriaVaca();
    aAnim = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); aAnim.setUsage(THREE.DynamicDrawUsage);
    aColA = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    aColB = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    geo.setAttribute("aAnim", aAnim); geo.setAttribute("aColA", aColA); geo.setAttribute("aColB", aColB);
    malla = new THREE.InstancedMesh(geo, materialVaca(uT), N);
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Sin sombra propia: la caja de sombras cubre 55 m alrededor de uno, y los
    // de cerca ya tienen el modelo de Rezona (con sombra). Ahorra dibujar los
    // 920 otra vez en la pasada de sombras.
    malla.frustumCulled = false; malla.castShadow = false; malla.receiveShadow = true;
    for (const a of R.lista) {
      const rz = RZ[a.raza] || RZ.hereford, k = 0.85 + az() * 0.3;
      const ca = a.k === "toro" ? new THREE.Color(0.012, 0.011, 0.011) : rz.cuerpo.clone().multiplyScalar(k);
      const cb = a.k === "toro" ? ca : rz.guarda >= 0.5 ? rz.blanco : rz.manchas ? rz.blanco.clone().lerp(ca, 0.4) : ca;
      aColA.setXYZ(a.i, ca.r, ca.g, ca.b); aColB.setXYZ(a.i, cb.r, cb.g, cb.b);
      a.colA = ca; a.escala = a.k === "toro" ? 1.14 : a.k === "ternero" ? 0.52 : 0.95 + az() * 0.1;
      aAnim.setXYZW(a.i, a.fase, 0, 0, 0);
      poner(a);
    }
    E.motor.escena.add(malla);
    R.grupos = grupos;
  };
  function poner(a) {
    const y = E.terreno.altura(a.x, a.z);
    qY.setFromAxisAngle(eY, a.yaw);
    sV.setScalar(a.cuerpo ? 0 : a.escala);
    m4.compose(pV.set(a.x, y, a.z), qY, sV);
    malla.setMatrixAt(a.i, m4);
    aAnim.setXYZW(a.i, a.fase, a.cuerpo ? 0 : a.vAnim, a.cab, a.echar);
  }

  // ── la conducta ── lo mismo que la tropa de trabajo, más simple.
  function pensar(a, dt, J, hora) {
    const T = E.terreno, L = E.lugares;
    let obj = null, vel = 0, cab = 0, echa = false;
    // ¿Alguien encima? Uno (a caballo, menos) o un perro. Un toro no le afloja a un perro.
    const dj = Math.hypot(a.x - J.x, a.z - J.z), zona = (J.montado ? 12 : 8) * (1 + a.arisca);
    let intr = Math.max(0, (zona - dj) / zona), fx = (a.x - J.x) / (dj || 1), fz = (a.z - J.z) / (dj || 1);
    if (a.k !== "toro") for (const p of E.perros.lista) {
      const dp = Math.hypot(a.x - p.x, a.z - p.z), ip = Math.max(0, (7 - dp) / 7) * (p.v > 1 ? 1 : 0.6);
      if (ip > intr) { intr = ip; fx = (a.x - p.x) / (dp || 1); fz = (a.z - p.z) / (dp || 1); }
    }
    if (intr > 0) {
      a.est = "huye"; a.t = 2 + a.arisca * 4;
      obj = [fx, fz]; vel = 1 + intr * 3.5 + (intr > 0.5 ? 1.5 : 0);
    } else if (a.est === "huye" && a.t > 0) {
      a.t -= dt; obj = [Math.sin(a.yaw), Math.cos(a.yaw)]; vel = 2.2;
    } else if (a.k === "ternero" && a.madre) {
      a.est = "pasta";
      const m = a.madre, lado = a.num % 2 ? 1 : -1;
      const ox = m.x + Math.cos(m.yaw) * 1.5 * lado - Math.sin(m.yaw) * 0.6, oz = m.z - Math.sin(m.yaw) * 1.5 * lado - Math.cos(m.yaw) * 0.6;
      const dx = ox - a.x, dz = oz - a.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { obj = [dx / d, dz / d]; vel = d > 6 ? 3.8 : d > 2.5 ? 1.2 : 0.4; } else { echa = m.echar > 0.5; cab = m.cab; }
    } else {
      a.est = "pasta";
      const g = R.grupos[a.g];
      // La siesta: un tercio se echa donde está.
      if (hora > 12 && hora < 16.5 && a.num % 3 === 0) echa = true;
      else {
        a.t -= dt;
        if (a.t <= 0) {
          const dg = Math.hypot(g.x - a.x, g.z - a.z);
          a.rumbo = dg > 48 ? Math.atan2(g.x - a.x, g.z - a.z) + (Math.random() - 0.5) : a.yaw + (Math.random() - 0.5) * 2;
          a.t = 4 + Math.random() * 10; a.pastando = Math.random() < 0.72;
        }
        obj = [Math.sin(a.rumbo), Math.cos(a.rumbo)];
        vel = a.pastando ? 0.12 : 0.55; cab = a.pastando ? 1 : 0;
      }
    }
    if (obj) {
      const giro = E.angulo(Math.atan2(obj[0], obj[1]) - a.yaw);
      a.yaw += E.clamp(giro, -dt * (vel > 3 ? 2.4 : 1.4), dt * (vel > 3 ? 2.4 : 1.4));
    }
    const tope = a.k === "ternero" ? 5 : 7;
    a.v += (Math.min(vel, tope) - a.v) * Math.min(1, dt * 1.8);
    a.cab += (cab - a.cab) * Math.min(1, dt * 1.5);
    a.echar += ((echa && a.v < 0.15 ? 1 : 0) - a.echar) * Math.min(1, dt * (echa ? 0.8 : 1.5));
    // Moverse: el freno del terreno, el agua, el alambrado, las casas.
    const fr = T.freno(a.x, a.z) * (1 - a.echar);
    let nx = a.x + Math.sin(a.yaw) * a.v * fr * dt, nz = a.z + Math.cos(a.yaw) * a.v * fr * dt;
    if (T.agua(nx, nz) > 0.6) { nx = a.x; nz = a.z; a.rumbo += Math.PI; a.t = 3; }
    const lim = L.limite - 3;
    nx = E.clamp(nx, -lim, lim); nz = E.clamp(nz, -lim, lim);
    if (T.distEstancia(nx, nz) < 160) { const p = { x: nx, z: nz }; E.estancia.empujar(p, 0.55); nx = p.x; nz = p.z; }
    a.x = nx; a.z = nz;
  }

  // Separación entre los de cerca, con una grilla (920² pares no).
  const grilla = new Map();
  function separar(cerca) {
    grilla.clear();
    for (const a of cerca) { const k = Math.floor(a.x / 3) * 4096 + Math.floor(a.z / 3); let c = grilla.get(k); if (!c) grilla.set(k, (c = [])); c.push(a); }
    for (const a of cerca) {
      const cx = Math.floor(a.x / 3), cz = Math.floor(a.z / 3);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = grilla.get((cx + i) * 4096 + cz + j);
        if (!c) continue;
        for (const b of c) {
          if (b.i <= a.i) continue;
          const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.k === "ternero" || b.k === "ternero" ? 0.9 : 1.4;
          if (d < min && d > 1e-4) { const e = (min - d) / 2; a.x -= (dx / d) * e; a.z -= (dz / d) * e; b.x += (dx / d) * e; b.z += (dz / d) * e; }
        }
      }
    }
  }

  // ── los de cerca, con el modelo de Rezona ──
  const libres = { vaca: [], ternero: [], toro: [] }, usados = new Set();
  R.maxCerca = 0;
  function cuerpoNuevo(tipo) {
    const M = E.modelos, modelo = tipo === "toro" && M.hay("toro") ? "toro" : "vaca";
    if (!M.hay(modelo)) return null;
    const pj = tipo === "toro" ? null : { cuerpo: new THREE.Color(), blanco: new THREE.Color(), guarda: 1, manchas: 0, semilla: 0 };
    const piel = M.clonar(modelo, { sinClips: true, pelaje: pj });
    if (tipo === "ternero") { piel.piv.scale.multiplyScalar(0.52); piel.escalaExtra = 0.52; piel.raiz.updateMatrixWorld(true); }
    E.motor.escena.add(piel.raiz);
    E.marcha.preparar(piel, modelo);
    piel.raiz.visible = false;
    return { tipo, piel, pj, animal: null };
  }
  function asignar(a) {
    const tipo = a.k;
    let c = libres[tipo].pop();
    if (!c) {
      const enUso = [...usados].filter((u) => u.tipo === tipo).length + libres[tipo].length;
      const tope = tipo === "toro" ? Math.max(1, Math.round(R.maxCerca * 0.12)) : tipo === "ternero" ? Math.round(R.maxCerca * 0.33) : Math.round(R.maxCerca * 0.55);
      if (enUso >= tope) return;
      c = cuerpoNuevo(tipo);
      if (!c) return;
    }
    if (c.pj) {
      const rz = E.animales.RAZAS[a.raza] || E.animales.RAZAS.hereford;
      c.pj.cuerpo.copy(a.colA); c.pj.blanco.copy(rz.blanco); c.pj.guarda = rz.guarda; c.pj.manchas = rz.manchas || 0; c.pj.semilla = a.num % 50;
      // Los uniforms del pelaje se leen de este objeto (modelos.js, conPelaje).
      for (const m of c.piel.mallas) if (m.material.userData.shader) { const u = m.material.userData.shader.uniforms; u.uGuarda.value = c.pj.guarda; u.uManchas.value = c.pj.manchas; u.uSemilla.value = c.pj.semilla; }
    }
    c.animal = a; a.cuerpo = c; usados.add(c);
    c.piel.raiz.visible = true;
  }
  function soltar(a) {
    const c = a.cuerpo; if (!c) return;
    c.piel.raiz.visible = false; c.animal = null; a.cuerpo = null;
    usados.delete(c); libres[c.tipo].push(c);
  }

  // ── cada cuadro ──
  let turno = 0, proxCerca = 0;
  R.actualizar = (dt, t, J, hora) => {
    if (!malla) return;
    uT.value = t;
    turno = (turno + 1) % 4;
    const cam = E.motor.camara.position, cerca = [];
    for (const a of R.lista) {
      const d = Math.hypot(a.x - J.x, a.z - J.z);
      a.acum += dt;
      if (d < 70 || a.i % 4 === turno) {
        pensar(a, a.acum, J, hora); a.acum = 0;
        if (d < 70) cerca.push(a);
      }
    }
    separar(cerca);
    // Quiénes toman el modelo de Rezona: los más cerca de la cámara.
    proxCerca -= dt;
    if (proxCerca <= 0) {
      proxCerca = 0.35;
      for (const c of [...usados]) if (Math.hypot(c.animal.x - cam.x, c.animal.z - cam.z) > SUELTA || R.maxCerca === 0) soltar(c.animal);
      if (R.maxCerca > 0) {
        const cand = cerca.filter((a) => !a.cuerpo && Math.hypot(a.x - cam.x, a.z - cam.z) < CERCA).sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z) - Math.hypot(b.x - cam.x, b.z - cam.z));
        for (const a of cand) { if (usados.size >= R.maxCerca) break; asignar(a); }
      }
    }
    // Dibujar: la velocidad de verdad (para que las patas no patinen) y la
    // matriz de cada uno que se movió.
    for (const a of R.lista) {
      if (a.acum === 0 || a.cuerpo) {
        const vf = Math.hypot(a.x - a.px, a.z - a.pz) / Math.max(1e-3, dt * (Math.hypot(a.x - J.x, a.z - J.z) < 70 ? 1 : 4));
        a.vAnim += (vf - a.vAnim) * 0.3;
        a.px = a.x; a.pz = a.z;
        poner(a);
      }
    }
    malla.instanceMatrix.needsUpdate = true; aAnim.needsUpdate = true;
    for (const c of usados) {
      const a = c.animal, p = c.piel;
      p.raiz.position.set(a.x, E.terreno.altura(a.x, a.z), a.z);
      p.raiz.rotation.set(0, a.yaw, 0);
      E.marcha.animar(p, { v: a.vAnim, cabeza: a.cab, echar: a.echar, t, num: a.num, moscas: 1 }, dt);
    }
  };
  R.visible = (si) => { if (malla) malla.visible = si; };
})();
