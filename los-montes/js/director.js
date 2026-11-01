"use strict";
// ════════════════════════════════════════════════════════════════════════
// El director de miedo. El terror de Los Montes es tensión más que ataques:
// una curva que sube con el tiempo tranquilo, la oscuridad y el bosque, y
// que se descarga con un evento (una rama, una figura entre los pinos, una
// luz que se apaga, huellas, un grito lejos). Después, calma; y otra vez.
// ════════════════════════════════════════════════════════════════════════
const Director = (() => {
  const V = THREE.Vector3;
  let escena, tension = 0, calma = 25, enCombate = false, tCombate = 0, opc = {}, huellas = [], sangres = [], polvos = [], ultimoEvento = "", eventos = 0;
  let matHuella, matSangre;
  function montar(esc) {
    escena = esc;
    matHuella = new THREE.MeshStandardMaterial({ color: "#15110c", roughness: 1, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    matSangre = new THREE.MeshStandardMaterial({ color: "#2b0705", roughness: 0.35, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }
  function reiniciar(o) { opc = o || {}; tension = 0.1; calma = 30; enCombate = false; for (const h of [...huellas, ...sangres]) escena.remove(h); huellas = []; sangres = []; eventos = 0; }
  function susto(k) { tension = Math.max(0, tension - k); calma = Math.max(calma, 10); }
  function combate(on) { if (on) { enCombate = true; tCombate = 12; Sonido.musica("combate"); } else if (enCombate) { tCombate = Math.min(tCombate, 4); } }
  // ── Eventos ──
  const EVENTOS = {
    rama(yo) { const a = yo.yaw + (Math.random() < 0.5 ? 1 : -1) * (1.6 + Math.random()), d = 12 + Math.random() * 10; Sonido.en("rama", yo.x + Math.sin(a) * d, yo.y + 0.3, yo.z + Math.cos(a) * d, 1); },
    figura(yo) {
      // Una figura quieta entre los pinos, adelante y al costado, a 35–60 m.
      for (let k = 0; k < 12; k++) {
        const a = yo.yaw + Math.PI + (Math.random() - 0.5) * 1.6, d = 34 + Math.random() * 26, x = yo.x - Math.sin(yo.yaw) * d + (Math.random() - 0.5) * 20, z = yo.z - Math.cos(yo.yaw) * d + (Math.random() - 0.5) * 20;
        if (!Mundo.libre(x, z) || Terreno.enAgua(x, z)) continue;
        if (Colision.espesura(x, z, 6) < 2) continue; // tiene que estar entre árboles
        Enemigos.aparicion(x, z); return true;
      }
      return false;
    },
    luz(yo) {
      // Se apaga la cabaña habitada más cercana (si la estás mirando, mejor).
      let mejor = null, dm = 1e9; for (const c of Lugares.cabanas) { if (c.apagada || !c.habitada) continue; const d = Math.hypot(c.x - yo.x, c.z - yo.z); if (d < dm) { dm = d; mejor = c; } }
      if (!mejor || dm > 95 || dm < 12) return false;
      Lugares.apagarCabana(mejor); Sonido.en("puerta_golpe", mejor.x, mejor.y + 1, mejor.z, 0.9); return true;
    },
    grito(yo) { const a = Math.random() * 6.28; Sonido.en("grito_lejano", yo.x + Math.sin(a) * 120, yo.y + 10, yo.z + Math.cos(a) * 120, 1); },
    pasos(yo) { const a = yo.yaw + (Math.random() < 0.5 ? 1.2 : -1.2); Sonido.pasosCorriendo(yo.x + Math.sin(a) * 16, yo.y, yo.z + Math.cos(a) * 16, yo.x + Math.sin(a + 1.5) * 18, yo.z + Math.cos(a + 1.5) * 18); },
    susurro(yo) { if (Juego.est.linterna) return false; Sonido.en("susurro", yo.x + Math.sin(yo.yaw) * 3, yo.y + 1.6, yo.z + Math.cos(yo.yaw) * 3, 0.7); return true; },
    huellas(yo) {
      // Pies descalzos que cruzan el camino, adelante, y se meten en el bosque.
      const fx = -Math.sin(yo.yaw), fz = -Math.cos(yo.yaw), ox = yo.x + fx * 9, oz = yo.z + fz * 9, lx = -fz, lz = fx;
      for (let k = -8; k <= 8; k++) {
        const x = ox + lx * k * 0.7 + fx * (k % 2) * 0.25, z = oz + lz * k * 0.7 + fz * (k % 2) * 0.25;
        const h = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.26).rotateX(-Math.PI / 2), matHuella);
        h.position.set(x, Terreno.altura(x, z) + 0.03, z); h.rotation.y = Math.atan2(lx, lz); escena.add(h); huellas.push(h);
      }
      while (huellas.length > 80) escena.remove(huellas.shift());
      return true;
    },
    acecho(yo) { return !!Enemigos.acechador(yo); },
    puerta(yo) { let mejor = null, dm = 1e9; for (const p of Lugares.puertas) { if (p.bajo) continue; const d = Math.hypot(p.x - yo.x, p.z - yo.z); if (d < dm && d > 10) { dm = d; mejor = p; } } if (!mejor || dm > 60) return false; Sonido.en("puerta_golpe", mejor.x, 1, mejor.z, 1); return true; },
    // Alguien silba lejos, entre los árboles: no es un pájaro.
    silbido(yo) { const a = yo.yaw + Math.PI + (Math.random() - 0.5) * 2, d = 45 + Math.random() * 40; Sonido.en("silbido", yo.x - Math.sin(a) * d, yo.y + 2, yo.z - Math.cos(a) * d, 0.8); },
    risa(yo) { if (Juego.est.linterna && Math.random() < 0.5) return false; const a = Math.random() * 6.28, d = 18 + Math.random() * 14; Sonido.en("risa", yo.x + Math.sin(a) * d, yo.y + 1.5, yo.z + Math.cos(a) * d, 0.7); },
    lobo(yo) { const a = Math.random() * 6.28; Sonido.en("lobo", yo.x + Math.sin(a) * 200, yo.y + 30, yo.z + Math.cos(a) * 200, 0.8); },
    campana(yo) { if (eventos < 6) return false; Sonido.en("campana", MAPA.lugares.campamento.x, 20, MAPA.lugares.campamento.z, 0.5); return true; },
  };
  // Qué conviene según dónde estás.
  function elegir(yo) {
    const J = Juego.est, bosque = yo.zona === "ext" && Colision.espesura(yo.x, yo.z, 14) > 6, dentro = yo.zona !== "ext";
    const pesos = dentro ? { rama: 0, figura: 0, luz: 0, grito: 1, pasos: 2, susurro: 2, huellas: 0, acecho: 0, puerta: 0, campana: 1, silbido: 0, risa: 1, lobo: 0 }
      : { rama: 3, figura: bosque ? 3 : 1.5, luz: 1.5, grito: 1.5, pasos: bosque ? 2 : 0.5, susurro: 1, huellas: bosque ? 0.5 : 1.5, acecho: eventos > 2 ? 1.2 : 0, puerta: 1, campana: 0.5, silbido: 1, risa: eventos > 1 ? 1 : 0, lobo: 0.6 };
    pesos[ultimoEvento] = 0;
    const tot = Object.values(pesos).reduce((a, b) => a + b, 0); let r = Math.random() * tot;
    for (const k in pesos) { r -= pesos[k]; if (r <= 0) return k; }
    return "rama";
  }
  function actualizar(dt, yo, t) {
    const J = Juego.est;
    if (enCombate) { tCombate -= dt; if (tCombate <= 0 && J.alerta < 0.8) { enCombate = false; Sonido.musica("tension"); calma = 20; } return; }
    // La tensión sube sola, más en la oscuridad y en el bosque; con compañeros, un poco menos.
    const oscuro = J.linterna ? 0.7 : 1.4, bosque = yo.zona === "ext" && Colision.espesura(yo.x, yo.z, 12) > 5 ? 1.3 : 0.8, gente = 1 - Math.min(0.35, (J.aliados.length) * 0.12);
    tension = Math.min(1, tension + dt * 0.012 * oscuro * bosque * gente);
    calma -= dt;
    Sonido.tension(tension, J.alerta);
    if (calma <= 0 && tension > 0.45 && !J.manejando && Math.random() < dt * 0.25) {
      const ev = elegir(yo), ok = EVENTOS[ev](yo);
      if (ok !== false) { ultimoEvento = ev; eventos++; tension *= 0.35; calma = 22 + Math.random() * 30; }
    }
    // Las marcas y la sangre se borran de a poco.
    for (const p of polvos) { p.vida -= dt; p.m.material.opacity = Math.max(0, p.vida); p.m.scale.multiplyScalar(1 + dt * 1.5); if (p.vida <= 0) escena.remove(p.m); }
    polvos = polvos.filter((p) => p.vida > 0);
  }
  // Salpicadura oscura en el piso (sin exagerar).
  function sangre(x, y, z, zona) {
    if (zona !== "ext" && Lugares.zonas[zona] && Lugares.zonas[zona].tipo !== "cabana") { /* en la mina, igual */ }
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.25, 10).rotateX(-Math.PI / 2), matSangre);
    const piso = Juego.alturaPies(x, z, zona);
    s.position.set(x + (Math.random() - 0.5) * 0.6, piso + 0.02, z + (Math.random() - 0.5) * 0.6); escena.add(s); sangres.push(s);
    while (sangres.length > 60) escena.remove(sangres.shift());
  }
  // Donde pega una bala: una nubecita de polvo.
  function marcaDisparo(p) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: "#8a8070", transparent: true, opacity: 0.6, depthWrite: false }));
    m.position.copy(p); escena.add(m); polvos.push({ m, vida: 0.6 });
  }
  return { montar, reiniciar, actualizar, susto, combate, sangre, marcaDisparo, get tension() { return tension; }, EVENTOS };
})();
