"use strict";
// ════════════════════════════════════════════════════════════════════════
// El mundo: la Ruta Nacional 11 entre el monte chaqueño, el puesto de control
// (garita, motos azules, patrullero, conos y cebrado, como en la foto del
// puesto real), la Zona de Detenidos, la playa de secuestro, las luminarias y
// el cielo que pasa de la tarde a la noche.
// ════════════════════════════════════════════════════════════════════════
// Coordenadas: la ruta corre a lo largo de Z; los autos llegan desde −Z y van
// hacia +Z por el carril derecho. Mirando a +Z, la derecha es −X: el carril
// va en x = −1,9 y el puesto queda de ese lado. El conductor va a la
// izquierda (+X), así que al policía le toca pararse entre el auto y el eje,
// que por eso lleva la hilera de conos.
const RUTA = { carril: -1.9, parada: 0, ancho: 7.4 };
const PUESTO = { garita: [-10.5, 0, 3], zona: [-12.5, 0, -9], playa: [-22, 0, 24], patrullero: [-13.5, 0, 10] };

function texCanvas(tam, dibujar, repetir, alto) {
  const c = document.createElement("canvas"); c.width = tam; c.height = alto || tam; dibujar(c.getContext("2d"), tam, alto || tam);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function cartelTex(lineas, fondo, tinta, ancho = 512, alto = 160) {
  return texCanvas(ancho, (g, w, h) => {
    g.fillStyle = fondo; g.fillRect(0, 0, w, h); g.strokeStyle = tinta; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = tinta; g.textAlign = "center"; g.textBaseline = "middle";
    lineas.forEach((l, i) => { g.font = `900 ${i === 0 ? h * 0.3 : h * 0.18}px Arial, sans-serif`; g.fillText(l, w / 2, h * (lineas.length === 1 ? 0.5 : 0.36 + i * 0.34)); });
  }, false, alto);
}

function crearMundo(renderer) {
  const escena = new THREE.Scene();
  const cielo = { tarde: new THREE.Color("#f3b27a"), dia: new THREE.Color("#bfdcf2"), noche: new THREE.Color("#0b1330") };
  escena.fog = new THREE.Fog(new THREE.Color("#c9d9e6"), 60, 420);

  // ── cielo: degradé con sol y estrellas ──
  const uCielo = { uSol: { value: new THREE.Vector3(0, 1, 0) }, uHor: { value: new THREE.Color() }, uCen: { value: new THREE.Color() }, uNoche: { value: 0 } };
  const domo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: uCielo,
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
    fragmentShader: `varying vec3 vD; uniform vec3 uSol, uHor, uCen; uniform float uNoche;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        float y = max(vD.y, 0.0); vec3 c = mix(uHor, uCen, pow(y, 0.5));
        float s = max(dot(normalize(vD), normalize(uSol)), 0.0);
        c += vec3(1.0, 0.75, 0.45) * (pow(s, 600.0) * 4.0 + pow(s, 8.0) * 0.35) * (1.0 - uNoche);
        vec3 q = floor(vD * 380.0); float e = step(0.9975, h(q)) * uNoche * smoothstep(0.05, 0.3, vD.y);
        c += vec3(e);
        if (vD.y < 0.0) c = mix(uHor, uHor * 0.6, clamp(-vD.y * 6.0, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  domo.frustumCulled = false; domo.renderOrder = -1; escena.add(domo);

  // ── luces ──
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5b6a3a, 0.9); escena.add(hemi);
  const sol = new THREE.DirectionalLight(0xffe0b8, 2.4);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.03; escena.add(sol, sol.target);

  // ── campo ──
  const pasto = texCanvas(256, (g, n) => {
    g.fillStyle = "#6f8a3d"; g.fillRect(0, 0, n, n); const r = azar(3);
    for (let i = 0; i < 5000; i++) { const t = r(); g.fillStyle = t < 0.4 ? "rgba(60,80,25,0.5)" : t < 0.7 ? "rgba(140,150,70,0.45)" : "rgba(170,150,90,0.35)"; g.fillRect(r() * n, r() * n, 1 + r() * 2, 2 + r() * 4); }
  }, true);
  pasto.repeat.set(160, 160);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pasto, roughness: 1 }));
  suelo.receiveShadow = true; escena.add(suelo);
  // Banquina de tierra y el asfalto con sus líneas.
  const tierra = texCanvas(128, (g, n) => { g.fillStyle = "#a48a62"; g.fillRect(0, 0, n, n); const r = azar(5); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${90 + r() * 80},${70 + r() * 60},${50 + r() * 40},0.5)`; g.fillRect(r() * n, r() * n, 2, 2); } }, true);
  tierra.repeat.set(3, 200);
  const banquina = new THREE.Mesh(new THREE.PlaneGeometry(14, 1000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tierra, roughness: 1 }));
  banquina.position.y = 0.01; banquina.receiveShadow = true; escena.add(banquina);
  const asfalto = texCanvas(256, (g, n, h) => {
    g.fillStyle = "#3b3d41"; g.fillRect(0, 0, n, h); const r = azar(7);
    for (let i = 0; i < 4000; i++) { const t = 45 + r() * 40; g.fillStyle = `rgba(${t},${t},${t + 3},0.6)`; g.fillRect(r() * n, r() * h, 1.5, 1.5); }
    g.fillStyle = "#f2f2ec"; g.fillRect(n * 0.02, 0, n * 0.02, h); g.fillRect(n * 0.96, 0, n * 0.02, h); // bordes
    g.fillRect(n * 0.49, 0, n * 0.02, h * 0.5);                                                          // eje discontinuo
  }, true, 256);
  asfalto.repeat.set(1, 100);
  const calzada = new THREE.Mesh(new THREE.PlaneGeometry(RUTA.ancho, 1000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: asfalto, roughness: 0.92 }));
  calzada.position.y = 0.02; calzada.receiveShadow = true; escena.add(calzada);
  // Cebrado blanco en diagonal donde frenan los autos (como en la foto del puesto).
  const blanco = new THREE.MeshStandardMaterial({ color: "#f4f4ee", roughness: 0.8 });
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 4.3).rotateX(-Math.PI / 2), blanco); b.rotation.y = -0.75; b.position.set(RUTA.carril, 0.025, -4 - i * 1.5); b.receiveShadow = true; escena.add(b); }
  // Lomo de burro antes del control.
  const lomo = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.6, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#e0b62a", roughness: 0.8 }));
  lomo.scale.set(1, 0.18, 1); lomo.position.set(RUTA.carril, 0.02, -16); escena.add(lomo);

  // ── el puesto ──
  const colocar = (n, x, y, z, rot = 0, color) => { const o = Modelos.clonar(n, color); if (!o) return null; o.position.set(x, y, z); o.rotation.y = rot; escena.add(o); return o; };
  colocar("garita", PUESTO.garita[0], 0, PUESTO.garita[2], Math.PI / 2);
  for (let i = 0; i < 4; i++) colocar("motopol", -7.2, 0, -6.5 + i * 2.1, Math.PI / 2 - 0.25);
  const patrulleroParado = colocar("patrullero", PUESTO.patrullero[0], 0, PUESTO.patrullero[2], Math.PI / 2 + 0.35);
  // Carteles.
  const cartel = (lineas, fondo, tinta, x, z, rot, alto = 2.2, ancho = 3.2) => {
    const g = new THREE.Group();
    const tabla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * 0.31), new THREE.MeshStandardMaterial({ map: cartelTex(lineas, fondo, tinta), roughness: 0.7 }));
    tabla.position.y = alto; g.add(tabla);
    // El dorso, chapa lisa: con DoubleSide el texto se leía al revés desde atrás.
    const dorso = new THREE.Mesh(tabla.geometry, new THREE.MeshStandardMaterial({ color: "#8d9096", roughness: 0.6, metalness: 0.3 }));
    dorso.position.set(0, alto, -0.01); dorso.rotation.y = Math.PI; g.add(dorso);
    for (const dx of [-ancho * 0.4, ancho * 0.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, alto), new THREE.MeshStandardMaterial({ color: "#888" })); p.position.set(dx, alto / 2 - 0.25, -0.02); g.add(p); }
    g.position.set(x, 0, z); g.rotation.y = rot; escena.add(g); return g;
  };
  cartel(["CONTROL POLICIAL", "REDUZCA LA VELOCIDAD · 20 km/h"], "#1a4fa0", "#ffffff", -5.4, -34, Math.PI);
  cartel(["PARE"], "#c8102e", "#ffffff", -4.6, -1.5, Math.PI, 2, 1.6);
  cartel(["PUESTO CAMINERO", "RUTA NACIONAL 11 · PDCIA. ROCA"], "#f4f4ee", "#1a2a55", -14, 7, Math.PI / 2 + 0.2);
  // Conos a lo ancho del carril y a lo largo del eje.
  const cono = new THREE.Group();
  const perfil = [new THREE.Vector2(0.2, 0), new THREE.Vector2(0.18, 0.04), new THREE.Vector2(0.06, 0.7), new THREE.Vector2(0.0, 0.72)];
  const mc = new THREE.Mesh(new THREE.LatheGeometry(perfil, 12), new THREE.MeshStandardMaterial({ color: "#ff5a12", roughness: 0.6 })); mc.castShadow = true; cono.add(mc);
  for (const [y, r] of [[0.32, 0.125], [0.5, 0.09]]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.012, r + 0.012, 0.08, 12, 1, true), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 })); f.position.y = y; cono.add(f); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), new THREE.MeshStandardMaterial({ color: "#222" })); base.position.y = 0.02; cono.add(base);
  const conos = [];
  for (let i = 0; i < 5; i++) { const c = cono.clone(); c.position.set(-0.25 - i * 0.85, 0, RUTA.parada + 0.6); escena.add(c); conos.push(c); }
  for (let i = 0; i < 9; i++) { const c = cono.clone(); c.position.set(-0.15, 0, -16 + i * 1.8); escena.add(c); }
  // Zona de Detenidos: rectángulo amarillo, banco y cartel.
  const zona = new THREE.Group(); zona.position.set(PUESTO.zona[0], 0, PUESTO.zona[2]);
  const amarillo = new THREE.MeshStandardMaterial({ color: "#f2c318", roughness: 0.7 });
  for (const [w, d, x, z] of [[6, 0.15, 0, -2], [6, 0.15, 0, 2], [0.15, 4, -3, 0], [0.15, 4, 3, 0]]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), amarillo); l.position.set(x, 0.03, z); zona.add(l); }
  const banco = new THREE.Mesh(new THREE.BoxGeometry(5, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: "#6b4a2e" })); banco.position.set(0, 0.23, 1.6); banco.castShadow = true; zona.add(banco);
  escena.add(zona);
  cartel(["ZONA DE DETENIDOS"], "#f2c318", "#1a1a1a", PUESTO.zona[0], PUESTO.zona[2] + 2.6, Math.PI, 2.1, 2.8);
  // Playa de secuestro: ripio y postes.
  const ripio = new THREE.Mesh(new THREE.PlaneGeometry(18, 13).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tierra, color: "#c9c2b4", roughness: 1 }));
  ripio.position.set(PUESTO.playa[0], 0.015, PUESTO.playa[2]); ripio.receiveShadow = true; escena.add(ripio);
  cartel(["PLAYA DE SECUESTRO"], "#2b2f3a", "#ffffff", PUESTO.playa[0] + 9.5, PUESTO.playa[2] - 5, Math.PI / 2, 2, 2.8);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2), new THREE.MeshStandardMaterial({ color: "#8a8a8a" }));
  for (let i = 0; i <= 18; i += 2) for (const z of [-6.5, 6.5]) { const p = poste.clone(); p.position.set(PUESTO.playa[0] - 9 + i, 0.6, PUESTO.playa[2] + z); escena.add(p); }

  // ── luminarias LED y postes de luz con cables (como en la foto) ──
  const faroles = [];
  const matColumna = new THREE.MeshStandardMaterial({ color: "#c9ccd1", metalness: 0.4, roughness: 0.5 });
  const matLed = new THREE.MeshStandardMaterial({ color: "#222", emissive: "#fff2d8", emissiveIntensity: 0 });
  for (let z = -140; z <= 140; z += 35) {
    const g = new THREE.Group(); g.position.set(-5.6, 0, z);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 8), matColumna); col.position.y = 4.5; g.add(col);
    const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), matColumna); brazo.rotation.z = -Math.PI / 2 + 0.2; brazo.position.set(1.2, 9.1, 0); g.add(brazo);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.3), matLed); led.position.set(2.4, 9.3, 0); g.add(led);
    escena.add(g);
    if (Math.abs(z) <= 40) { const l = new THREE.PointLight(0xffe7c4, 0, 26, 1.6); l.position.set(-5.6 + 2.4, 8.9, z); escena.add(l); faroles.push(l); }
  }
  const madera = new THREE.MeshStandardMaterial({ color: "#5c4a38", roughness: 1 });
  const puntasCable = [];
  for (let z = -300; z <= 300; z += 50) {
    const g = new THREE.Group(); g.position.set(8, 0, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 10, 7), madera); p.position.y = 5; g.add(p);
    const cr = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), madera); cr.position.y = 9.4; g.add(cr);
    escena.add(g); puntasCable.push(z);
  }
  // Cables con catenaria.
  const lineaMat = new THREE.LineBasicMaterial({ color: "#2a2a2a" });
  for (const dx of [-1.1, 0, 1.1]) for (let i = 0; i < puntasCable.length - 1; i++) {
    const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(8 + dx, 9.45 - Math.sin(t * Math.PI) * 0.9, lerp(puntasCable[i], puntasCable[i + 1], t))); }
    escena.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineaMat));
  }

  // ── monte chaqueño: árboles de Rezona instanciados y matas ──
  const r = azar(11);
  const plantar = (n, cant, dmin, escala = 1) => {
    const L = Modelos.listos[n]; if (!L) return;
    const mallas = []; L.escena.updateMatrixWorld(true); L.escena.traverse((o) => { if (o.isMesh) mallas.push(o); });
    const puntos = [];
    for (let k = 0; k < cant * 6 && puntos.length < cant; k++) {
      const lado = r() < 0.5 ? -1 : 1, x = lado * (dmin + r() * 170), z = (r() - 0.5) * 700;
      if (x < -3 && x > -34 && z > -24 && z < 36) continue; // el puesto
      if (Math.abs(x - 8) < 3) continue;                   // la línea de postes
      puntos.push([x, z, (0.75 + r() * 0.6) * escala, r() * 6.3]);
    }
    // Los cercanos al puesto dan sombra; los lejanos no (la sombra solo cubre ±45 m
    // y el algarrobo tiene 7.600 triángulos: con sombra, cada árbol se dibujaba dos veces).
    // Van ordenados de cerca a lejos para que la calidad baja saque primero los del fondo.
    puntos.sort((a, b) => Math.hypot(a[0] + 10, a[1]) - Math.hypot(b[0] + 10, b[1]));
    const cerca = puntos.filter((p) => Math.hypot(p[0] + 10, p[1]) < 75), lejos = puntos.slice(cerca.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3();
    for (const [grupo, sombra] of [[cerca, true], [lejos, false]]) for (const m of mallas) {
      if (!grupo.length) continue;
      const inst = new THREE.InstancedMesh(m.geometry, m.material, grupo.length);
      grupo.forEach(([x, z, s, rot], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot); m4.compose(new THREE.Vector3(x, 0, z), q, e.set(s, s, s)); inst.setMatrixAt(i, m4.multiply(m.matrixWorld)); });
      inst.castShadow = sombra; inst.receiveShadow = true; escena.add(inst);
      if (!sombra) arboles.push({ inst, total: grupo.length });
    }
  };
  const arboles = [];
  // Densidad del monte lejano según la calidad (1 = todo).
  const densidad = (k) => { for (const a of arboles) a.inst.count = Math.max(1, Math.round(a.total * k)); };
  // El quebracho de Rezona quedó muy bien de cerca; el algarrobo, simplificado, solo
  // sirve de fondo: va lejos y más chico, como monte bajo.
  plantar("quebracho", 115, 11); plantar("algarrobo", 60, 70, 0.6);
  const mata = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: "#56722f", roughness: 1, flatShading: true }), 400);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 400; i++) { const lado = r() < 0.5 ? -1 : 1, x = lado * (9 + r() * 120), z = (r() - 0.5) * 600; const s = 0.5 + r() * 1.1; m4.makeScale(s * 1.3, s * 0.8, s * 1.3).setPosition(x < -3 && x > -34 && z > -24 && z < 36 ? x - 40 : x, s * 0.35, z); mata.setMatrixAt(i, m4); }
  mata.receiveShadow = true; escena.add(mata);

  // ── de la tarde a la noche ──
  // hora: 17 → 25 (la 1 de la mañana). Devuelve cuánta noche es (0..1).
  function ponerHora(hora, foco) {
    // Fin de septiembre en Presidencia Roca: sale ~7:00 y se pone ~19:25 (hora
    // argentina, mediodía solar ~13:10). alt: 1 al mediodía, 0 en el ocaso.
    const h = hora % 24, alt = Math.sin(((h - 7) / 12.4) * Math.PI);
    const noche = clamp(-alt * 3 + 0.15, 0, 1), atardecer = clamp(1 - Math.abs(alt) * 4, 0, 1) * (1 - noche);
    const azim = ((h - 7) / 12.4) * Math.PI;
    const dirSol = new THREE.Vector3(Math.cos(azim) * 0.9, Math.max(alt, -0.2), -0.35).normalize();
    uCielo.uSol.value.copy(dirSol);
    const hor = cielo.dia.clone().lerp(cielo.tarde, atardecer).lerp(cielo.noche.clone().multiplyScalar(1.6), noche);
    const cen = new THREE.Color("#4f8fd6").lerp(new THREE.Color("#3a4f8a"), atardecer).lerp(cielo.noche, noche);
    uCielo.uHor.value.copy(hor); uCielo.uCen.value.copy(cen); uCielo.uNoche.value = noche;
    escena.fog.color.copy(hor); escena.fog.near = lerp(60, 25, noche); escena.fog.far = lerp(420, 170, noche);
    sol.intensity = 2.6 * clamp(alt * 3, 0, 1); sol.color.set("#fff1dc").lerp(new THREE.Color("#ff9a55"), atardecer);
    const c = foco || new THREE.Vector3(); sol.position.set(c.x + dirSol.x * 120, Math.max(10, dirSol.y * 120), c.z + dirSol.z * 120); sol.target.position.copy(c);
    hemi.intensity = lerp(0.95, 0.12, noche); hemi.color.set("#cfe3ff").lerp(new THREE.Color("#5b6ea8"), noche);
    renderer.toneMappingExposure = lerp(1.0, 1.35, noche);
    for (const f of faroles) f.intensity = noche > 0.3 ? 30 : 0;
    matLed.emissiveIntensity = noche > 0.3 ? 2 : 0;
    return noche;
  }
  return { escena, sol, hemi, domo, conos, ponerHora, patrulleroParado, texCanvas, densidad };
}
