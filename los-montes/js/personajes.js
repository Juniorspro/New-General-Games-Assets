"use strict";
// ════════════════════════════════════════════════════════════════════════
// Personajes: el protagonista, los compañeros, los sobrevivientes y los
// montañeses. Con el modelo de Rezona se usan sus clips (quieto, caminar,
// correr) y encima se giran huesos para apuntar, agacharse, pegar o caer.
// Sin modelo, un cuerpo armado por código con las mismas "articulaciones":
// el resto del juego no se entera de cuál está usando.
// ════════════════════════════════════════════════════════════════════════
const Personajes = (() => {
  const V = THREE.Vector3, Q = THREE.Quaternion;
  // Colores del cuerpo de repuesto (y tamaño relativo).
  const PERFIL = {
    prota: { ropa: "#3a4430", acento: "#b8581c", piel: "#b3876a", pelo: "#2a2018", alto: 1.82, capucha: true },
    medica: { ropa: "#7a2320", acento: "#d9d4c8", piel: "#c49a7e", pelo: "#3b2a1c", alto: 1.68 },
    explorador: { ropa: "#445546", acento: "#8c8a70", piel: "#a8805f", pelo: "#1d1812", alto: 1.8, capucha: true },
    mecanico: { ropa: "#3c4a5a", acento: "#b58d2a", piel: "#b88c6d", pelo: "#4a3a2a", alto: 1.76 },
    sobreviviente1: { ropa: "#5b6a7a", acento: "#8c4b3a", piel: "#c9a184", pelo: "#6a4a2a", alto: 1.7 },
    sobreviviente2: { ropa: "#6b5238", acento: "#3a3a3a", piel: "#b9937a", pelo: "#9a9a9a", alto: 1.74 },
    mont_cazador: { ropa: "#4a3a28", acento: "#2b2016", piel: "#9d8a74", pelo: "#1a1510", alto: 1.84, deforme: 0.35 },
    mont_rapido: { ropa: "#5c4f45", acento: "#3a2e24", piel: "#c7b8a6", pelo: "#111", alto: 1.66, deforme: 0.5, flaco: true },
    mont_vigia: { ropa: "#3e3326", acento: "#6d5a3c", piel: "#a39078", pelo: "#2a2016", alto: 1.78, deforme: 0.3, gorro: true },
    mont_bruto: { ropa: "#2e2620", acento: "#6b1f1a", piel: "#93806a", pelo: "#111", alto: 2.3, deforme: 0.45, ancho: 1.45, mascara: true },
    mont_trampero: { ropa: "#4d4332", acento: "#6a5a3a", piel: "#a08c74", pelo: "#231a12", alto: 1.75, deforme: 0.4 },
    mont_lider: { ropa: "#2a2622", acento: "#d8cfbd", piel: "#8f7c68", pelo: "#ddd", alto: 2.05, deforme: 0.25, astas: true },
  };
  // ── Cuerpo de repuesto ──
  function mat(c, r = 0.85) { return new THREE.MeshStandardMaterial({ color: c, roughness: r }); }
  function pieza(geo, m, padre, x, y, z) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; padre.add(o); return o; }
  function articulacion(padre, x, y, z, nombre) { const g = new THREE.Group(); g.position.set(x, y, z); g.name = nombre; padre.add(g); return g; }
  function cuerpoRepuesto(tipo) {
    const P = PERFIL[tipo] || PERFIL.prota, k = P.alto / 1.8, an = (P.ancho || 1) * (P.flaco ? 0.8 : 1);
    const ropa = mat(P.ropa), acento = mat(P.acento), piel = mat(P.piel, 0.7), pelo = mat(P.pelo, 1);
    const raiz = new THREE.Group(), cuerpo = new THREE.Group(); raiz.add(cuerpo); cuerpo.scale.setScalar(k);
    const H = {};
    H.cadera = articulacion(cuerpo, 0, 0.95, 0, "cadera");
    H.torso = articulacion(H.cadera, 0, 0.08, 0, "torso");
    pieza(new THREE.CapsuleGeometry(0.2 * an, 0.38, 4, 10), ropa, H.torso, 0, 0.3, 0).scale.set(1.15, 1, 0.75);
    pieza(new THREE.BoxGeometry(0.44 * an, 0.07, 0.26), acento, H.torso, 0, 0.44, 0);
    if (tipo === "prota" || tipo === "explorador") pieza(new THREE.BoxGeometry(0.34, 0.46, 0.2), mat("#2b2a22"), H.torso, 0, 0.32, -0.22); // mochila
    if (P.mascara || tipo === "mont_bruto") pieza(new THREE.BoxGeometry(0.46 * an, 0.6, 0.05), mat("#5a2a22", 0.9), H.torso, 0, 0.2, 0.17); // delantal
    H.cuello = articulacion(H.torso, 0, 0.62, 0, "cuello");
    H.cabeza = articulacion(H.cuello, 0, 0.06, 0, "cabeza");
    const cab = pieza(new THREE.SphereGeometry(0.12, 12, 10), piel, H.cabeza, 0, 0.1, 0.01); cab.scale.set(1, 1.18, 1.05);
    if (P.deforme) { cab.scale.x *= 1 + P.deforme * 0.3; cab.position.x = P.deforme * 0.03; cab.rotation.z = P.deforme * 0.25; pieza(new THREE.SphereGeometry(0.055, 8, 6), piel, H.cabeza, -0.07, 0.16, 0.04); }
    if (P.capucha) pieza(new THREE.SphereGeometry(0.15, 12, 10, 0, 6.3, 0, 1.9), ropa, H.cabeza, 0, 0.12, -0.02);
    else pieza(new THREE.SphereGeometry(0.125, 10, 8, 0, 6.3, 0, 1.3), pelo, H.cabeza, 0, 0.14, -0.01);
    if (P.gorro) pieza(new THREE.CylinderGeometry(0.13, 0.14, 0.14, 10), mat("#5b4a36", 1), H.cabeza, 0, 0.24, 0);
    if (P.mascara) pieza(new THREE.SphereGeometry(0.13, 10, 8, 0, 3.2), mat("#6e5a44", 0.95), H.cabeza, 0, 0.1, 0.02).rotation.y = -1.57;
    if (P.astas) for (const s of [-1, 1]) { const a = pieza(new THREE.ConeGeometry(0.025, 0.5, 5), mat("#d9cfb9", 0.8), H.cabeza, s * 0.1, 0.4, 0); a.rotation.z = -s * 0.5; const b = pieza(new THREE.ConeGeometry(0.018, 0.25, 5), mat("#d9cfb9", 0.8), H.cabeza, s * 0.2, 0.5, 0.05); b.rotation.z = -s * 1.1; }
    // Ojos: dos puntitos que brillan apenas con la linterna (los montañeses).
    if (tipo.startsWith("mont")) for (const s of [-1, 1]) { const o = pieza(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshStandardMaterial({ color: "#ddd", emissive: "#443322" }), H.cabeza, s * 0.042, 0.12, 0.11); o.castShadow = false; }
    for (const [lado, s] of [["L", 1], ["R", -1]]) {
      const hombro = articulacion(H.torso, s * 0.24 * an, 0.52, 0, "brazo" + lado);
      pieza(new THREE.CapsuleGeometry(0.065 * an, 0.24, 4, 8), ropa, hombro, 0, -0.16, 0);
      const codo = articulacion(hombro, 0, -0.32, 0, "antebrazo" + lado);
      pieza(new THREE.CapsuleGeometry(0.055 * an, 0.22, 4, 8), ropa, codo, 0, -0.14, 0);
      const mano = articulacion(codo, 0, -0.3, 0, "mano" + lado); pieza(new THREE.SphereGeometry(0.05, 8, 6), piel, mano, 0, 0, 0);
      const muslo = articulacion(H.cadera, s * 0.11 * an, -0.04, 0, "muslo" + lado);
      pieza(new THREE.CapsuleGeometry(0.085 * an, 0.3, 4, 8), ropa, muslo, 0, -0.22, 0);
      const rodilla = articulacion(muslo, 0, -0.44, 0, "rodilla" + lado);
      pieza(new THREE.CapsuleGeometry(0.07 * an, 0.3, 4, 8), ropa, rodilla, 0, -0.2, 0);
      pieza(new THREE.BoxGeometry(0.11, 0.08, 0.24), mat("#1c1812", 0.9), rodilla, 0, -0.44, 0.04);
      H["brazo" + lado] = hombro; H["antebrazo" + lado] = codo; H["mano" + lado] = mano; H["muslo" + lado] = muslo; H["rodilla" + lado] = rodilla;
    }
    return { raiz, H };
  }
  // Huesos del rig de Rezona (mismos nombres en todos: ver control-ruta11).
  function huesosRig(o) {
    const b = (n) => o.getObjectByName(n);
    return { cadera: b("Hip"), torso: b("Spine01") || b("Spine"), cuello: b("Neck"), cabeza: b("Head"), brazoL: b("L_Upperarm"), brazoR: b("R_Upperarm"), antebrazoL: b("L_Forearm"), antebrazoR: b("R_Forearm"), manoL: b("L_Hand"), manoR: b("R_Hand"), musloL: b("L_Thigh"), musloR: b("R_Thigh"), rodillaL: b("L_Calf"), rodillaR: b("R_Calf") };
  }

  function crear(tipo) {
    const g = new THREE.Group(), cuerpo = new THREE.Group(); g.add(cuerpo);
    const o = Modelos.clonar(tipo), pj = { tipo, grupo: g, cuerpo, rig: false, fase: Math.random() * 6, peso: { idle: 1, walk: 0, run: 0 }, caida: 0, arma: null };
    if (o) {
      cuerpo.add(o); pj.rig = true; pj.modelo = o;
      pj.H = huesosRig(o); pj.mixer = new THREE.AnimationMixer(o);
      const L = Modelos.listos[tipo]; pj.velCaminar = L.velCaminar; pj.velCorrer = L.velCorrer;
      pj.acc = {};
      for (const clip of L.clips) { const n = /run/i.test(clip.name) ? "run" : /walk/i.test(clip.name) ? "walk" : /idle/i.test(clip.name) ? "idle" : null; if (n && !pj.acc[n]) { const a = pj.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(n === "idle" ? 1 : 0); pj.acc[n] = a; } }
      if (!pj.acc.run && pj.acc.walk) pj.acc.run = null;
    } else {
      const c = cuerpoRepuesto(tipo); cuerpo.add(c.raiz); pj.H = c.H; pj.velCaminar = 1.35; pj.velCorrer = 3.8;
    }
    pj.alto = (Modelos.AJUSTES[tipo] || {}).alto || 1.8;
    return pj;
  }
  // Girar un hueso sobre un eje del mundo (así da igual cómo trae los ejes cada rig).
  const qP = new Q(), qE = new Q(), eje = new V(), der = new V(), arr = new V(0, 1, 0), fr = new V();
  function girar(b, e, a) { if (!b || !a) return; b.parent.getWorldQuaternion(qP); qE.setFromAxisAngle(e, a); b.quaternion.premultiply(qP.clone().invert().multiply(qE).multiply(qP)); }
  // Arma en la mano derecha.
  function ponerArma(pj, malla) {
    if (pj.arma) pj.arma.parent && pj.arma.parent.remove(pj.arma);
    pj.arma = malla || null; if (!malla) return;
    const mano = pj.H.manoR; if (!mano) return;
    // En el rig, la mano está escalada por el modelo: se compensa.
    const s = new V(); mano.getWorldScale(s); malla.scale.setScalar(1 / Math.max(1e-3, s.x) * (pj.cuerpo.children[0].scale ? 1 : 1));
    mano.add(malla);
  }
  // e: { vel (m/s), agacha, apunta, arma ("pistola"|"escopeta"|"rifle"|"hacha"|null), golpe (0..1 o -1), herido (0..1), muerto, mira (pitch) }
  function animar(pj, dt, e) {
    const v = e.muerto ? 0 : e.vel;
    pj.fase += dt * (v / Math.max(0.5, pj.velCaminar)) * 3.2;
    if (pj.rig) {
      // Mezcla de clips según la velocidad.
      const quiere = { idle: v < 0.15 ? 1 : 0, walk: v >= 0.15 && (v < 2.4 || !pj.acc.run) ? 1 : 0, run: pj.acc.run && v >= 2.4 ? 1 : 0 };
      for (const n of ["idle", "walk", "run"]) {
        const a = pj.acc[n]; if (!a) continue;
        pj.peso[n] = lerp(pj.peso[n], quiere[n], Math.min(1, dt * 7)); a.setEffectiveWeight(pj.peso[n]);
        if (n === "walk") a.setEffectiveTimeScale(clamp(v / pj.velCaminar, 0.5, 2.2));
        if (n === "run") a.setEffectiveTimeScale(clamp(v / pj.velCorrer, 0.6, 1.8));
      }
      pj.mixer.update(dt);
    } else {
      // Caminata por código: péndulos de piernas y brazos.
      for (const k in pj.H) if (pj.H[k] && pj.H[k].isGroup) pj.H[k].rotation.set(0, 0, 0);
      const a = Math.sin(pj.fase) * clamp(v / 3, 0, 1) * (v > 2.4 ? 0.95 : 0.6);
      if (pj.H.musloL) { pj.H.musloL.rotation.x = -a; pj.H.musloR.rotation.x = a; pj.H.rodillaL.rotation.x = Math.max(0, a) * 1.1 + 0.05; pj.H.rodillaR.rotation.x = Math.max(0, -a) * 1.1 + 0.05; }
      if (pj.H.brazoL) { pj.H.brazoL.rotation.x = a * 0.8; pj.H.brazoR.rotation.x = -a * 0.8; pj.H.antebrazoL.rotation.x = -0.25; pj.H.antebrazoR.rotation.x = -0.25; }
      // Respiración quieto.
      if (pj.H.torso) pj.H.torso.rotation.x = Math.sin(pj.fase * 0.4 + performance.now() / 900) * 0.02 + (v > 2.4 ? 0.18 : 0);
      if (pj.H.cadera) pj.H.cadera.position.y = 0.95 + Math.abs(Math.sin(pj.fase)) * 0.03 * clamp(v, 0, 1);
    }
    // ── Encima del clip: agacharse, apuntar, pegar, cojear, caer ──
    pj.grupo.updateMatrixWorld(true);
    der.set(-1, 0, 0).applyQuaternion(pj.grupo.quaternion); fr.set(0, 0, 1).applyQuaternion(pj.grupo.quaternion);
    const H = pj.H;
    pj.agachado = lerp(pj.agachado || 0, e.agacha ? 1 : 0, Math.min(1, dt * 8));
    const ag = pj.agachado;
    if (ag > 0.01) { girar(H.musloL, der, -1.0 * ag); girar(H.musloR, der, -0.8 * ag); girar(H.rodillaL, der, 1.5 * ag); girar(H.rodillaR, der, 1.3 * ag); girar(H.torso, der, -0.35 * ag); }
    pj.cuerpo.position.y = -0.42 * ag * (pj.alto / 1.8);
    if (e.apunta && e.arma && e.arma !== "hacha") {
      // Brazos al frente; el torso sigue la mira arriba/abajo.
      const pitch = e.mira || 0, dos = e.arma !== "pistola";
      girar(H.torso, der, -pitch * 0.5);
      girar(H.brazoR, der, -1.35 - pitch * 0.6); girar(H.antebrazoR, der, -0.15);
      if (dos) { girar(H.brazoL, der, -1.25 - pitch * 0.6); girar(H.brazoL, arr, -0.55); girar(H.antebrazoL, der, -0.55); }
      else { girar(H.brazoL, der, -1.3 - pitch * 0.6); girar(H.brazoL, arr, -0.35); }
    }
    if (e.golpe >= 0) {
      // Hachazo o machetazo: arriba y atrás, y baja cruzando.
      const k = e.golpe, alza = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
      girar(H.brazoR, der, -2.6 * alza + (k > 0.35 ? -0.6 * (1 - alza) : 0)); girar(H.brazoR, fr, -0.4 * alza); girar(H.antebrazoR, der, -0.9 * alza);
      girar(H.torso, arr, (k < 0.35 ? 0.4 * alza : -0.5 * (1 - alza)));
    }
    if (e.herido > 0.4 && v > 0.1) girar(H.torso, fr, Math.sin(pj.fase) * 0.08 * e.herido);
    // Caída: el cuerpo se va de espaldas y queda en el piso.
    pj.caida = lerp(pj.caida, e.muerto ? 1 : 0, Math.min(1, dt * 3));
    pj.cuerpo.rotation.x = -pj.caida * 1.5; pj.cuerpo.position.y -= pj.caida * 0.1;
    if (e.miraCabeza && H.cabeza) girar(H.cabeza, arr, e.miraCabeza);
  }
  return { crear, animar, ponerArma, PERFIL };
})();
