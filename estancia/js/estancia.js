// Las construcciones: rancho, galería, fogón, corral de palo a pique, manga,
// tanque australiano con molino y alambrado perimetral. Y lo que hace falta
// para chocar con ellas y usarlas.
"use strict";
(() => {
  const C = (E.estancia = { segmentos: [], circulos: [], puntos: [], animados: [] });
  const V = THREE.Vector3;

  // ── materiales ── las texturas de Rezona si están (datos.js), si no, dibujadas.
  // tam: cuántos metros ocupa una repetición, para que una pared de 6 m no
  // estire la textura (ver caja()).
  const hay = (n) => !!(window.ARCHIVOS && ARCHIVOS[n]);
  function matRezona(nombre, tam, extra) {
    if (!hay(nombre + ".webp")) return null;
    const m = new THREE.MeshStandardMaterial({ map: E.textura(nombre + ".webp"), normalMap: hay(nombre + "-n.webp") ? E.textura(nombre + "-n.webp", { srgb: false }) : null, ...extra });
    m.userData.tam = tam;
    return m;
  }
  // La tierra colorada que salpica la lluvia al pie de la pared: medio metro
  // de rojo que se esfuma hacia arriba (la altura del piso la pone el rancho).
  const pie = { value: 0 };
  function salpicado(m) {
    return E.parchear(m, "revoque-pie", (sh) => {
      sh.uniforms.uPie = pie;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vAltoMundo;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvAltoMundo = (modelMatrix * vec4(transformed, 1.0)).y;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uPie; varying float vAltoMundo;")
        .replace("#include <map_fragment>", "#include <map_fragment>\nfloat tierra = 1.0 - smoothstep(0.02, 0.65, vAltoMundo - uPie);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.42, 0.26), tierra * 0.8);");
    });
  }
  function matRevoque() {
    const rz = matRezona("revoque", 2.2, { roughness: 0.95 });
    if (rz) return salpicado(rz);
    const t = E.lienzo(512, 512, (g, w, h) => {
      g.fillStyle = "#d9cfbd"; g.fillRect(0, 0, w, h);
      const az = E.azar(3);
      for (let i = 0; i < 2600; i++) {
        const v = 180 + az() * 50;
        g.fillStyle = `rgba(${v},${v * 0.93},${v * 0.82},${0.08 + az() * 0.12})`;
        g.fillRect(az() * w, az() * h, 1 + az() * 6, 1 + az() * 4);
      }
      // Manchas de humedad y la tierra colorada que salpica desde abajo.
      for (let i = 0; i < 14; i++) {
        const x = az() * w, y = az() * h, r = 20 + az() * 70;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, "rgba(120,95,70,0.18)"); gr.addColorStop(1, "rgba(120,95,70,0)");
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const gr = g.createLinearGradient(0, h * 0.72, 0, h);
      gr.addColorStop(0, "rgba(150,70,35,0)"); gr.addColorStop(1, "rgba(150,70,35,0.55)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { repetir: true });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  }
  function matChapa() {
    const rz = matRezona("chapa", 1.6, { roughness: 0.55, metalness: 0.15 });
    if (rz) return rz;
    const t = E.lienzo(256, 256, (g, w, h) => {
      for (let x = 0; x < w; x++) {
        const v = 120 + 45 * Math.sin((x / w) * Math.PI * 2 * 8);
        g.fillStyle = `rgb(${v},${v * 1.01},${v * 1.03})`; g.fillRect(x, 0, 1, h);
      }
      const az = E.azar(8);
      for (let i = 0; i < 40; i++) {                       // óxido que chorrea
        g.fillStyle = `rgba(${120 + az() * 40},${55 + az() * 20},20,${0.15 + az() * 0.25})`;
        g.fillRect(az() * w, az() * h * 0.6, 2 + az() * 5, 20 + az() * 90);
      }
    }, { repetir: true });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.55 });
  }
  // Postes y horcones de quebracho: la corteza sin oscurecer (con el tinte
  // de antes, a la sombra de la galería quedaban negros).
  const madera = () => {
    const m = new THREE.MeshStandardMaterial({ map: E.textura("corteza.webp"), normalMap: E.textura("corteza-n.webp", { srgb: false }), roughness: 0.9, color: 0xf2e6d6 });
    return m;
  };
  const tablas = () => matRezona("tablas", 1.4, { roughness: 0.88 }) || new THREE.MeshStandardMaterial({
    map: E.lienzo(256, 256, (g, w, h) => {
      g.fillStyle = "#6e5a45"; g.fillRect(0, 0, w, h);
      const az = E.azar(4);
      for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(40,28,18,${0.15 + az() * 0.3})`; g.lineWidth = 1; const y = az() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); g.stroke(); }
    }, { repetir: true }), roughness: 0.88,
  });

  // Las caras de BoxGeometry van en orden +x, -x, +y, -y, +z, -z, cuatro
  // vértices cada una: se estira el uv de cada cara a su tamaño en metros.
  function uvEnMetros(g, w, h, d, tam) {
    const uv = g.attributes.uv, lados = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let i = 0; i < uv.count; i++) {
      const [a, b] = lados[Math.floor(i / 4)];
      uv.setXY(i, (uv.getX(i) * a) / tam, (uv.getY(i) * b) / tam);
    }
    return g;
  }
  function caja(w, h, d, mat, x, y, z, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (mat.userData.tam) uvEnMetros(g, w, h, d, mat.userData.tam);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    E.motor.escena.add(m);
    return m;
  }
  function poste(r, h, mat, x, z, hundido = 0.4) {
    const y = E.terreno.altura(x, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h + hundido, 7), mat);
    m.position.set(x, y + h / 2 - hundido / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    E.motor.escena.add(m);
    return m;
  }
  // Una pared que choca: segmento de a a b con grosor.
  const pared = (ax, az, bx, bz, grosor = 0.25) => C.segmentos.push({ ax, az, bx, bz, g: grosor });

  C.construir = () => {
    const T = E.terreno, L = E.lugares;
    const revoque = matRevoque(), chapa = matChapa(), mad = madera(), tab = tablas();

    // ── el rancho ── 8 × 5 m, frente al sur (+z), con galería.
    const R = L.rancho, y0 = T.altura(R.x, R.z);
    pie.value = y0;
    const W = 8, D = 5, H = 2.5, g = 0.3;
    caja(W, H, g, revoque, R.x, y0 + H / 2, R.z - D / 2);                          // fondo
    caja(g, H, D, revoque, R.x - W / 2, y0 + H / 2, R.z);                          // lado oeste
    caja(g, H, D, revoque, R.x + W / 2, y0 + H / 2, R.z);                          // lado este
    caja(3.2, H, g, revoque, R.x - 2.4, y0 + H / 2, R.z + D / 2);                  // frente, a los dos lados de la puerta
    caja(3.0, H, g, revoque, R.x + 2.5, y0 + H / 2, R.z + D / 2);
    caja(1.8, 0.5, g, revoque, R.x + 0.1, y0 + H - 0.25, R.z + D / 2);             // dintel
    pared(R.x - W / 2, R.z - D / 2, R.x + W / 2, R.z - D / 2, g);
    pared(R.x - W / 2, R.z - D / 2, R.x - W / 2, R.z + D / 2, g);
    pared(R.x + W / 2, R.z - D / 2, R.x + W / 2, R.z + D / 2, g);
    pared(R.x - W / 2, R.z + D / 2, R.x - 0.8, R.z + D / 2, g);
    pared(R.x + 1.0, R.z + D / 2, R.x + W / 2, R.z + D / 2, g);
    // Techo de chapa a un agua, que sigue sobre la galería.
    const techo = caja(W + 1.2, 0.06, D + 4.2, chapa, R.x, y0 + H + 0.35, R.z + 1.6);
    techo.rotation.x = -0.09;
    for (const [dx, dz] of [[-3.8, 5.6], [3.8, 5.6], [-1.3, 5.6], [1.3, 5.6]]) {
      poste(0.1, H + 0.1, mad, R.x + dx, R.z + dz, 0.3);                          // horcones de la galería
      C.circulos.push({ x: R.x + dx, z: R.z + dz, r: 0.18 });
    }
    // La mesa de la galería con el jarro y las galletas (la mesa de Rezona vino
    // rota, una cuña: queda la de tablas; las sillas y la pava las pone puesto.js).
    caja(1.6, 0.06, 0.8, tab, R.x - 1.5, y0 + 0.78, R.z + 3.8);
    for (const [dx, dz] of [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]]) caja(0.06, 0.76, 0.06, tab, R.x - 1.5 + dx, y0 + 0.38, R.z + 3.8 + dz);
    caja(1.8, 0.05, 0.35, tab, R.x - 1.5, y0 + 0.45, R.z + 4.55);                   // banco
    const jarro = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.13, 12), new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.7, roughness: 0.35 }));
    jarro.position.set(R.x - 1.75, y0 + 0.875, R.z + 3.75); E.motor.escena.add(jarro);
    const galleta = new THREE.MeshStandardMaterial({ color: 0xd9b778, roughness: 0.9 });
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), galleta); m.scale.y = 0.55; m.position.set(R.x - 1.3 + i * 0.09, y0 + 0.83, R.z + 3.85); E.motor.escena.add(m); }
    C.circulos.push({ x: R.x - 1.5, z: R.z + 3.9, r: 0.8 });
    C.puntos.push({ id: "mate", x: R.x - 1.5, z: R.z + 4.6, r: 1.8, texto: "Tomar mate cocido con galleta" });
    // Adentro: el catre con un cuero y la radio en un estante.
    caja(0.8, 0.05, 1.9, new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.95 }), R.x - 2.8, y0 + 0.45, R.z - 0.9);
    caja(0.9, 0.42, 2.0, tab, R.x - 2.8, y0 + 0.21, R.z - 0.9);
    C.circulos.push({ x: R.x - 2.8, z: R.z - 0.9, r: 0.7 });
    C.puntos.push({ id: "catre", x: R.x - 2.1, z: R.z - 0.6, r: 1.6, texto: "Dormir en el catre" });
    caja(0.9, 0.04, 0.3, tab, R.x + 3.3, y0 + 1.4, R.z - 2.2);
    caja(0.32, 0.2, 0.14, new THREE.MeshStandardMaterial({ color: 0x5a3b28, roughness: 0.6 }), R.x + 3.3, y0 + 1.52, R.z - 2.2);
    C.puntos.push({ id: "radio", x: R.x + 3.0, z: R.z - 1.6, r: 1.5, texto: "Prender la radio" });
    C.radio = new V(R.x + 3.3, y0 + 1.5, R.z - 2.2);

    // ── el fogón ── piedras, leña, el asador con el costillar y el hierro.
    const Fg = L.fogon, yf = T.altura(Fg.x, Fg.z);
    const piedra = new THREE.MeshStandardMaterial({ color: 0x6b625a, roughness: 0.95 });
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 3) * 0.03), piedra);
      m.position.set(Fg.x + Math.cos(a) * 0.62, yf + 0.08, Fg.z + Math.sin(a) * 0.62); m.castShadow = true;
      E.motor.escena.add(m);
    }
    const lenia = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1 });
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6), lenia); m.rotation.z = Math.PI / 2; m.rotation.y = i * 1.1; m.position.set(Fg.x, yf + 0.08, Fg.z); E.motor.escena.add(m); }
    // El asador en cruz, clavado de costado al fuego, con el costillar con cuero.
    const asador = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.8, roughness: 0.5 }));
    asador.position.set(Fg.x - 0.9, yf + 0.8, Fg.z); asador.rotation.z = 0.35; E.motor.escena.add(asador);
    // El costillar: carne dorada con las costillas marcadas, la grasa arriba y
    // lo quemado en los bordes (antes era una tabla roja lisa), y las puntas
    // de los huesos asomando.
    const texCostillar = E.lienzo(256, 320, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, "#5a2a14"); gr.addColorStop(0.2, "#9a5226"); gr.addColorStop(0.8, "#a85d2c"); gr.addColorStop(1, "#4a2210");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const az = E.azar(31);
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${60 + az() * 90},${25 + az() * 40},${10 + az() * 15},${0.15 + az() * 0.25})`; g.fillRect(az() * w, az() * h, 2 + az() * 5, 1 + az() * 3); }
      // Las costillas: franjas claras atravesadas, con la carne entre medio.
      for (let y = 22; y < h - 10; y += 38) {
        const hg = g.createLinearGradient(0, y - 7, 0, y + 7);
        hg.addColorStop(0, "rgba(60,25,10,0)"); hg.addColorStop(0.5, "rgba(214,190,150,0.85)"); hg.addColorStop(1, "rgba(60,25,10,0)");
        g.fillStyle = hg; g.fillRect(w * 0.08, y - 7, w * 0.84, 14);
      }
      // La grasa de arriba y lo tostado.
      g.fillStyle = "rgba(226,200,150,0.55)"; g.fillRect(0, 0, w, 14);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(20,8,4,${0.25 + az() * 0.4})`; g.beginPath(); g.ellipse(az() < 0.5 ? az() * 30 : w - az() * 30, az() * h, 3 + az() * 8, 2 + az() * 6, 0, 0, Math.PI * 2); g.fill(); }
    });
    const matCostillar = new THREE.MeshStandardMaterial({ map: texCostillar, roughness: 0.55 });
    const costillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.55), matCostillar);
    const hueso = new THREE.MeshStandardMaterial({ color: 0xe3d6bc, roughness: 0.6 });
    for (let k = 0; k < 8; k++) {
      const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.06, 6), hueso);
      pt.rotation.x = Math.PI / 2; pt.position.set(0, 0.35 - 0.035 - k * 0.083, 0.29);
      costillar.add(pt);
    }
    costillar.position.set(Fg.x - 0.78, yf + 0.95, Fg.z); costillar.rotation.z = 0.35; costillar.castShadow = true; E.motor.escena.add(costillar);
    C.costillar = costillar;
    // El hierro de marcar, con la punta en las brasas.
    const hierro = new THREE.Group();
    const vara = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), asador.material);
    vara.position.y = 0.55; hierro.add(vara);
    const marca = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 16), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.8, roughness: 0.4, emissive: 0xff4a10, emissiveIntensity: 0 }));
    marca.position.y = 0; hierro.add(marca);
    hierro.position.set(Fg.x + 0.3, yf + 0.1, Fg.z + 0.2); hierro.rotation.z = -0.9;
    E.motor.escena.add(hierro);
    C.hierro = { grupo: hierro, punta: marca };
    C.circulos.push({ x: Fg.x, z: Fg.z, r: 0.8 });
    C.puntos.push({ id: "fogon", x: Fg.x, z: Fg.z + 1.3, r: 1.9, texto: "Fogón" });
    // Fuego: llamas con valores por encima de 1 (satura como una cámara) y una
    // luz que tiembla, sin sombra.
    C.fuego = crearFuego(new V(Fg.x, yf + 0.05, Fg.z));

    // ── el corral de palo a pique ── postes de quebracho, uno pegado al otro.
    const Co = L.corral, yc = T.altura(Co.x, Co.z);
    const radio = Co.r, abertPuerta = 1.6, abertManga = 0.55;
    const postes = [];
    const vuelta = 2 * Math.PI * radio, n = Math.round(vuelta / 0.26);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const enPuerta = Math.abs(E.angulo(a - Co.puerta)) < abertPuerta / radio;
      const enManga = Math.abs(E.angulo(a)) < abertManga / radio;
      if (enPuerta || enManga) continue;
      postes.push([Co.x + Math.cos(a) * radio, Co.z + Math.sin(a) * radio]);
    }
    // Paredes de choque: el círculo en tramos, salteando las dos aberturas.
    const tramos = 60;
    for (let i = 0; i < tramos; i++) {
      const a0 = (i / tramos) * Math.PI * 2, a1 = ((i + 1) / tramos) * Math.PI * 2, am = (a0 + a1) / 2;
      if (Math.abs(E.angulo(am - Co.puerta)) < abertPuerta / radio || Math.abs(E.angulo(am)) < abertManga / radio) continue;
      pared(Co.x + Math.cos(a0) * radio, Co.z + Math.sin(a0) * radio, Co.x + Math.cos(a1) * radio, Co.z + Math.sin(a1) * radio, 0.3);
    }
    // La manga: dos filas de postes más bajos y más separados que los del
    // corral, con tres tablas, hasta el cepo. Del lado de la pasarela se
    // trabaja por encima: con los postes del corral (2 m, cada 35 cm) la
    // cámara de la manga no veía la vaca.
    const Mg = L.manga;
    for (let x = Mg.x0 - 2; x <= Mg.x1 + 0.01; x += 0.7) for (const s of [-1, 1]) postes.push([x, Mg.z + s * Mg.ancho / 2 + s * 0.12, 1.55]);
    pared(Co.x + radio - 0.2, Mg.z - Mg.ancho / 2 - 0.1, Mg.x1, Mg.z - Mg.ancho / 2 - 0.1, 0.2);
    pared(Co.x + radio - 0.2, Mg.z + Mg.ancho / 2 + 0.1, Mg.x1, Mg.z + Mg.ancho / 2 + 0.1, 0.2);
    pared(Mg.x1 + 0.3, Mg.z - 0.6, Mg.x1 + 0.3, Mg.z + 0.6, 0.2);                  // el cepo cierra la punta
    const gp = new THREE.CylinderGeometry(0.085, 0.1, 2.6, 6);
    const ip = new THREE.InstancedMesh(gp, mad, postes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V(), p = new V(), az = E.azar(77);
    postes.forEach(([x, z, bajo], i) => {
      const alto = bajo ? bajo + az() * 0.1 : 1.9 + az() * 0.35;
      p.set(x, T.altura(x, z) + alto / 2 - 0.35, z);
      q.setFromEuler(new THREE.Euler((az() - 0.5) * 0.06, az() * 6, (az() - 0.5) * 0.06));
      s.set(0.9 + az() * 0.3, alto / 2.2, 0.9 + az() * 0.3);
      m4.compose(p, q, s); ip.setMatrixAt(i, m4);
    });
    ip.castShadow = true; ip.receiveShadow = true;
    E.motor.escena.add(ip);
    for (const s2 of [-1, 1]) for (const h of [0.45, 0.85, 1.25]) caja(Mg.x1 - Mg.x0 + 2, 0.18, 0.04, tab, (Mg.x0 + Mg.x1) / 2 - 1, yc + h, Mg.z + s2 * (Mg.ancho / 2 + 0.2));
    // La pasarela: un tablón alto al costado, de donde se trabaja la vaca.
    caja(Mg.x1 - Mg.x0 + 1.5, 0.08, 0.55, tab, (Mg.x0 + Mg.x1) / 2 - 0.5, yc + 0.55, Mg.z - Mg.ancho / 2 - 0.62);
    for (let x = Mg.x0 - 0.5; x <= Mg.x1 + 0.6; x += 1.6) caja(0.1, 0.55, 0.1, tab, x, yc + 0.27, Mg.z - Mg.ancho / 2 - 0.62);
    // El cepo: un marco de tablas donde queda agarrada la cabeza.
    caja(0.12, 2, 0.12, tab, Mg.x1 + 0.3, yc + 1, Mg.z - 0.55);
    caja(0.12, 2, 0.12, tab, Mg.x1 + 0.3, yc + 1, Mg.z + 0.55);
    caja(0.12, 0.14, 1.3, tab, Mg.x1 + 0.3, yc + 1.95, Mg.z);
    C.puntos.push({ id: "manga", x: Mg.x1 - 1.5, z: Mg.z - 1.5, r: 2.2, texto: "Trabajar en la manga" });
    C.cepo = new V(Mg.x1 + 0.3, yc, Mg.z);
    // La tranquera del corral, de tablas, que se abre para afuera.
    const tranq = new THREE.Group();
    for (const h of [0.35, 0.75, 1.15, 1.55]) { const t = new THREE.Mesh(new THREE.BoxGeometry(abertPuerta * 2, 0.14, 0.05), tab); t.position.set(abertPuerta, h, 0); t.castShadow = true; tranq.add(t); }
    const bisagra = new V(Co.x + Math.cos(Co.puerta + abertPuerta / radio) * radio, yc, Co.z + Math.sin(Co.puerta + abertPuerta / radio) * radio);
    tranq.position.copy(bisagra);
    E.motor.escena.add(tranq);
    C.tranquera = { grupo: tranq, abierta: true, angulo: 0, bisagra, segmento: null };
    C.tranquera.segmento = { ax: bisagra.x, az: bisagra.z, bx: Co.x + Math.cos(Co.puerta - abertPuerta / radio) * radio, bz: Co.z + Math.sin(Co.puerta - abertPuerta / radio) * radio, g: 0.2, apagado: true };
    C.segmentos.push(C.tranquera.segmento);
    const sg = C.tranquera.segmento;
    // Cerrada, las tablas van de la bisagra al otro poste; abierta, quedan
    // hacia afuera del corral (-x), como una puerta abierta.
    C.tranquera.angCerrado = -Math.atan2(sg.bz - sg.az, sg.bx - sg.ax);
    C.tranquera.angAbierto = Math.PI;
    C.tranquera.angulo = C.tranquera.angAbierto;
    C.puntos.push({ id: "tranquera", x: Co.x - radio - 1.4, z: Co.z + 1.8, r: 2.2, texto: "Cerrar la tranquera del corral" });

    // ── el tanque australiano y el molino ──
    const Tq = L.tanque, yt = T.altura(Tq.x, Tq.z);
    // Chapa galvanizada, gris claro: sin mapa de entorno un metal refleja
    // negro (poco metal y más rugoso), y la chapa oxidada del techo lo dejaba
    // como un aro oscuro.
    const zinc = new THREE.MeshStandardMaterial({ color: 0xb4bcc2, metalness: 0.25, roughness: 0.45 });
    const pared2 = new THREE.Mesh(new THREE.CylinderGeometry(Tq.r, Tq.r, 1.3, 48, 1, true), zinc);
    pared2.position.set(Tq.x, yt + 0.65, Tq.z); pared2.castShadow = true; pared2.receiveShadow = true;
    pared2.material.side = THREE.DoubleSide;
    E.motor.escena.add(pared2);
    const aguaT = new THREE.Mesh(new THREE.CircleGeometry(Tq.r - 0.05, 48), E.terreno.aguaMalla.material);
    aguaT.rotation.x = -Math.PI / 2; aguaT.position.set(Tq.x, yt + 1.1, Tq.z); E.motor.escena.add(aguaT);
    C.circulos.push({ x: Tq.x, z: Tq.z, r: Tq.r + 0.1 });
    // El bebedero al costado, donde toman la hacienda, el caballo y uno.
    caja(4, 0.5, 0.7, zinc, Tq.x + Tq.r + 0.8, yt + 0.25, Tq.z, Math.PI / 2);
    const aguaB = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3.9), E.terreno.aguaMalla.material);
    aguaB.rotation.x = -Math.PI / 2; aguaB.position.set(Tq.x + Tq.r + 0.8, yt + 0.44, Tq.z); E.motor.escena.add(aguaB);
    C.circulos.push({ x: Tq.x + Tq.r + 0.8, z: Tq.z, r: 0.5 }, { x: Tq.x + Tq.r + 0.8, z: Tq.z + 1.5, r: 0.5 }, { x: Tq.x + Tq.r + 0.8, z: Tq.z - 1.5, r: 0.5 });
    C.puntos.push({ id: "tanque", x: Tq.x + Tq.r + 1.8, z: Tq.z, r: 2.4, texto: "Tomar agua en el bebedero" });
    C.bebedero = new V(Tq.x + Tq.r + 0.8, yt, Tq.z);
    // Molino: torre de hierro, rueda de aspas que gira con el viento y cola.
    const hierroM = new THREE.MeshStandardMaterial({ color: 0x5c5a55, metalness: 0.6, roughness: 0.6 });
    const mx = Tq.x - 2, mz = Tq.z - Tq.r - 3, ym = T.altura(mx, mz), alto = 9;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, alto, 5), hierroM);
      pata.position.set(mx + dx * 0.55, ym + alto / 2, mz + dz * 0.55);
      pata.rotation.z = -dx * 0.06; pata.rotation.x = dz * 0.06; pata.castShadow = true;
      E.motor.escena.add(pata);
      C.circulos.push({ x: mx + dx * 1.0, z: mz + dz * 1.0, r: 0.12 });
    }
    for (let h = 1.5; h < alto; h += 1.8) { const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.62 - h * 0.035, 0.02, 4, 4), hierroM); anillo.rotation.x = Math.PI / 2; anillo.rotation.z = Math.PI / 4; anillo.position.set(mx, ym + h, mz); E.motor.escena.add(anillo); }
    const cabeza = new THREE.Group(); cabeza.position.set(mx, ym + alto + 0.2, mz); E.motor.escena.add(cabeza);
    const rueda = new THREE.Group(); rueda.position.set(0, 0, 0.35); cabeza.add(rueda);
    for (let i = 0; i < 18; i++) {
      const aspa = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.25, 0.02), zinc);
      aspa.position.set(0, 0.95, 0); aspa.rotation.y = 0.5;
      const brazo = new THREE.Group(); brazo.rotation.z = (i / 18) * Math.PI * 2; brazo.add(aspa); rueda.add(brazo);
    }
    const aro = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.02, 4, 36), hierroM); rueda.add(aro);
    const cola = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 1.6), zinc); cola.position.set(0, 0.2, -1.5); cabeza.add(cola);
    cabeza.rotation.y = -0.6;
    C.animados.push((dt, t) => { rueda.rotation.z += dt * (1.2 + E.flora.uniformes.uRacha.value * 2.5); });

    // ── el alambrado perimetral ── postes cada 12 m y cinco hilos. Una
    // tranquera en el sur, donde entra el camino.
    const lim = L.limite, hilos = [];
    const lado = (x0, z0, x1, z1) => {
      const largo = Math.hypot(x1 - x0, z1 - z0), n2 = Math.round(largo / 12);
      for (let i = 0; i <= n2; i++) {
        const x = x0 + ((x1 - x0) * i) / n2, z = z0 + ((z1 - z0) * i) / n2;
        if (Math.abs(x - L.tranquera.x) < 2.5 && Math.abs(z - L.tranquera.z) < 1) continue;
        poste(0.07, 1.25, mad, x, z, 0.3);
      }
      for (let k = 0; k < 5; k++) {
        const h = 0.28 + k * 0.22;
        const pasos = n2 * 2;
        for (let i = 0; i < pasos; i++) {
          const xa = x0 + ((x1 - x0) * i) / pasos, za = z0 + ((z1 - z0) * i) / pasos;
          const xb = x0 + ((x1 - x0) * (i + 1)) / pasos, zb = z0 + ((z1 - z0) * (i + 1)) / pasos;
          if (Math.abs((xa + xb) / 2 - L.tranquera.x) < 2.3 && Math.abs((za + zb) / 2 - L.tranquera.z) < 1) continue;
          hilos.push(xa, T.altura(xa, za) + h, za, xb, T.altura(xb, zb) + h, zb);
        }
      }
      pared(x0, z0, x1, z1, 0.15);
    };
    lado(-lim, -lim, lim, -lim); lado(lim, -lim, lim, lim); lado(lim, lim, -lim, lim); lado(-lim, lim, -lim, -lim);
    const gh = new THREE.BufferGeometry();
    gh.setAttribute("position", new THREE.Float32BufferAttribute(hilos, 3));
    E.motor.escena.add(new THREE.LineSegments(gh, new THREE.LineBasicMaterial({ color: 0x8a8d8f })));
    // La tranquera de entrada (cerrada: el campo termina acá).
    for (const h of [0.3, 0.65, 1.0, 1.3]) caja(4.6, 0.12, 0.05, tab, L.tranquera.x, T.altura(0, lim) + h, lim);
    utiles();
  };

  // La chata al costado del rancho y los rollos de pasto al lado del corral
  // (modelos de Rezona; si no cargaron, no están y listo).
  function utiles() {
    const M = E.modelos, T = E.terreno, L = E.lugares;
    const poner = (nombre, x, z, yaw, colis) => {
      const m = M.clonar(nombre);
      if (!m) return null;
      m.raiz.position.set(x, T.altura(x, z) - 0.03, z);
      m.raiz.rotation.y = yaw;
      E.motor.escena.add(m.raiz);
      m.raiz.updateMatrixWorld(true);
      for (const [dx, dz, r] of colis) {
        const p = m.raiz.localToWorld(new V(dx, 0, dz));
        C.circulos.push({ x: p.x, z: p.z, r });
      }
      return m;
    };
    const R = L.rancho;
    poner("chata", R.x - 9.5, R.z + 3, 0.35, [[0, -1.7, 1.1], [0, 0, 1.1], [0, 1.7, 1.1]]);
    const Co = L.corral;
    const rollos = [[-4, -13.5, 0.1], [-2.3, -13.8, 0.05], [-0.6, -13.4, 0.15], [1.1, -13.9, 0.0], [-3.1, -15.4, 0.2], [-1.4, -15.3, 0.1]];
    for (const [dx, dz, yaw] of rollos) poner("rollo", Co.x + dx, Co.z + dz, yaw, [[0, 0, 0.8]]);
  }

  function crearFuego(base) {
    const grupo = new THREE.Group();
    grupo.position.copy(base);
    const luz = new THREE.PointLight(0xff7a30, 6, 14, 2);
    luz.position.set(0, 0.6, 0);
    grupo.add(luz);
    const tex = E.lienzo(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const llamas = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff8a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: true }));
      s.userData.fase = Math.random();
      grupo.add(s); llamas.push(s);
    }
    // El humo es oscuro: un gris "de humo" en HDR brilla como algodón (§ 6.9).
    const humos = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x2a2622, transparent: true, depthWrite: false, opacity: 0.25 }));
      s.userData.fase = i / 10; grupo.add(s); humos.push(s);
    }
    E.motor.escena.add(grupo);
    const f = { grupo, luz, encendido: 1 };
    C.animados.push((dt, t) => {
      const noche = 1 - E.suave(-2, 12, E.motor.elevacion);
      luz.intensity = (4 + Math.sin(t * 17) * 0.8 + Math.sin(t * 29) * 0.6) * (0.5 + noche * 1.5) * f.encendido;
      llamas.forEach((s) => {
        const u = (s.userData.fase + t * 0.9) % 1;
        s.position.set(Math.sin(u * 13 + s.userData.fase * 40) * 0.22 * (1 - u), 0.1 + u * 0.9, Math.cos(u * 11 + s.userData.fase * 30) * 0.22 * (1 - u));
        const tam = 0.45 * (1 - u) + 0.1;
        s.scale.set(tam, tam * 1.4, 1);
        // Rampa de temperatura: blanco amarillo abajo, naranja, rojo arriba.
        s.material.color.setRGB(3.2 - u * 1.5, 1.4 - u * 1.1, 0.35 - u * 0.3);
      });
      humos.forEach((s) => {
        const u = (s.userData.fase + t * 0.12) % 1;
        s.position.set(Math.sin(t * 0.3 + s.userData.fase * 9) * u * 0.8, 1 + u * 4, u * 0.6);
        s.scale.setScalar(0.6 + u * 2.2);
        s.material.opacity = 0.22 * (1 - u);
      });
    });
    return f;
  }

  // Abrir o cerrar la tranquera del corral.
  C.alternarTranquera = () => {
    const tq = C.tranquera;
    tq.abierta = !tq.abierta;
    tq.segmento.apagado = tq.abierta;
    const p = C.puntos.find((q) => q.id === "tranquera");
    p.texto = tq.abierta ? "Cerrar la tranquera del corral" : "Abrir la tranquera del corral";
  };

  C.actualizar = (dt, t) => {
    for (const f of C.animados) f(dt, t);
    const tq = C.tranquera;
    // Abierta, la tranquera queda contra el corral; cerrada, tapa la abertura.
    const objetivo = tq.abierta ? tq.angAbierto : tq.angCerrado;
    tq.angulo += E.angulo(objetivo - tq.angulo) * Math.min(1, dt * 3);
    tq.grupo.rotation.y = tq.angulo;
  };

  // ── choques ── empuje contra segmentos y círculos: contra un poste uno se
  // desliza en vez de quedar pegado (§ 6.8). Tres pasadas para los rincones.
  C.empujar = (p, radio) => {
    for (let pasada = 0; pasada < 3; pasada++) {
      for (const s of C.segmentos) {
        if (s.apagado) continue;
        const vx = s.bx - s.ax, vz = s.bz - s.az;
        const t = E.clamp(((p.x - s.ax) * vx + (p.z - s.az) * vz) / (vx * vx + vz * vz), 0, 1);
        const cx = s.ax + vx * t, cz = s.az + vz * t;
        const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), min = radio + s.g;
        if (d < min && d > 1e-5) { p.x = cx + (dx / d) * min; p.z = cz + (dz / d) * min; }
      }
      for (const c of C.circulos.concat(E.flora.cercanos(p.x, p.z))) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = radio + c.r;
        if (d < min && d > 1e-5) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
      }
    }
  };
  // ¿Está adentro del corral?
  C.enCorral = (x, z) => Math.hypot(x - E.lugares.corral.x, z - E.lugares.corral.z) < E.lugares.corral.r - 0.6;
  C.enManga = (x, z) => x > E.lugares.manga.x0 - 2 && x < E.lugares.manga.x1 + 0.5 && Math.abs(z - E.lugares.manga.z) < 0.8;
})();
