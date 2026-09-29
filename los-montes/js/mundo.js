"use strict";
// ════════════════════════════════════════════════════════════════════════
// Mundo: suelo, agua, cascadas, cielo con luna, niebla y bosque. La niebla
// es por altura (ShaderChunk parcheado): espesa abajo, entre los pinos y el
// agua, y rala arriba, así las cumbres nevadas se ven como en la referencia.
// ════════════════════════════════════════════════════════════════════════

// ── Niebla por altura para todos los materiales de three ──
// La de three (FogExp2) es igual en todas direcciones: a 200 m tapaba el 94 % y las
// montañas no existían. Esta integra una niebla que se afina con la altura a lo largo
// del rayo cámara→punto: el valle y el lago quedan en la bruma, las cumbres se ven.
// Hacia la luna la niebla se aclara (luz que rebota en la bruma), como en la referencia.
// Se arma con viewMatrix y mvPosition (no con `transformed`): así anda igual con
// instancias, esqueletos y sprites, que no tienen `transformed`.
// La luna, baja (25°) y al nornoreste: en las vistas al norte queda arriba a la derecha del cerro.
const NIEBLA = { base: 0, caida: 1 / 30, bruma: 0.00011, luna: [0.45, 0.42, -0.79] };
(() => {
  const C = THREE.ShaderChunk, n = (v) => v.toFixed(6), L = new THREE.Vector3(...NIEBLA.luna).normalize();
  C.fog_pars_vertex = "#ifdef USE_FOG\n varying vec3 vFogMundo;\n#endif";
  C.fog_vertex = `#ifdef USE_FOG
    vFogMundo = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
  #endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; varying vec3 vFogMundo;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear; uniform float fogFar;
    #endif
  #endif`;
  C.fog_fragment = `#ifdef USE_FOG
    vec3 fogRay = vFogMundo - cameraPosition; float fogDist = length(fogRay);
    #ifdef FOG_EXP2
      // Densidad fogDensity·e^(−b·(y−base)): la integral sobre el rayo es cerrada.
      float fogB = ${n(NIEBLA.caida)}, fogDy = fogRay.y * fogB;
      float fogK = abs(fogDy) > 1e-3 ? (1.0 - exp(-fogDy)) / fogDy : 1.0;
      float fogOpt = fogDensity * exp(-(cameraPosition.y - ${n(NIEBLA.base)}) * fogB) * fogK * fogDist + fogDist * ${n(NIEBLA.bruma)};
      float fogFactor = 1.0 - exp(-fogOpt);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, fogDist);
    #endif
    float fogLuna = pow(max(dot(fogRay / max(fogDist, 1e-3), vec3(${n(L.x)}, ${n(L.y)}, ${n(L.z)})), 0.0), 6.0);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * (1.0 + 1.1 * fogLuna) + vec3(0.012, 0.016, 0.024) * fogLuna, fogFactor);
  #endif`;
})();

const Texturas = (() => {
  const cache = {};
  function lienzo(n, dibujar, repetir = true) {
    const c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d");
    dibujar(g, n); const t = new THREE.CanvasTexture(c);
    if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // Ruido que empalma en los bordes (para repetir sin costura).
  function ruidoTile(n, escala, oct = 4, semilla = 1) {
    const d = new Float32Array(n * n), r = azar(semilla), off = r() * 100;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let s = 0, a = 0.5, f = escala, t = 0;
      for (let o = 0; o < oct; o++) {
        const u = i / n, v = j / n, p = f;
        // Mezcla de cuatro muestras desplazadas un período: empalma.
        const m = (x, y) => Ruido.valor(x + off, y + off * 1.3);
        const v1 = m(u * p, v * p), v2 = m((u - 1) * p, v * p), v3 = m(u * p, (v - 1) * p), v4 = m((u - 1) * p, (v - 1) * p);
        s += a * lerp(lerp(v1, v2, u), lerp(v3, v4, u), v); t += a; a *= 0.5; f *= 2;
      }
      d[j * n + i] = s / t;
    }
    return d;
  }
  return {
    detalle() { return cache.det || (cache.det = lienzo(256, (g, n) => {
      const d = ruidoTile(n, 8, 5, 3), im = g.createImageData(n, n);
      for (let i = 0; i < n * n; i++) { const v = 150 + d[i] * 90; im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
      // Piedritas y ramitas.
      const r = azar(9); for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${r() < 0.5 ? "30,26,20" : "210,205,195"},${0.18 + r() * 0.25})`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
    })); },
    aguaNormal() { return cache.agua || (cache.agua = (() => {
      const n = 256, d = ruidoTile(n, 6, 4, 7), c = document.createElement("canvas"); c.width = c.height = n;
      const g = c.getContext("2d"), im = g.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const h = (x, y) => d[((y + n) % n) * n + ((x + n) % n)], dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1), k = (j * n + i) * 4;
        im.data[k] = 128 + dx * 300; im.data[k + 1] = 128 + dy * 300; im.data[k + 2] = 255; im.data[k + 3] = 255;
      }
      g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    })()); },
    // Chorro de la cascada y espuma del río: vetas verticales blancas.
    vetas() { return cache.vetas || (cache.vetas = lienzo(128, (g, n) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, n, n); const r = azar(4);
      for (let k = 0; k < 160; k++) { const x = r() * n, w = 1 + r() * 3, a = 0.25 + r() * 0.6; const gr = g.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, `rgba(255,255,255,0)`); gr.addColorStop(r() * 0.5 + 0.2, `rgba(235,242,250,${a})`); gr.addColorStop(1, `rgba(255,255,255,0)`); g.fillStyle = gr; g.fillRect(x, 0, w, n); }
    })); },
    // Chorro: vetas que corren de arriba abajo sin cortarse (la textura empalma en v).
    // Chorro: vetas que corren de arriba abajo sin cortarse (la textura empalma en v) y
    // bordes que se deshacen (sin eso, de lejos la cascada era una franja blanca de ruta).
    chorro() { return cache.chorro || (cache.chorro = lienzo(128, (g, n) => {
      const im = g.createImageData(n, n), r = azar(6), vetas = [];
      for (let k = 0; k < 34; k++) vetas.push([n * (0.12 + r() * 0.76), 0.8 + r() * 2.4, 0.3 + r() * 0.6, r() * 6.28, 1 + Math.floor(r() * 3)]);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const u = i / (n - 1), borde = Math.pow(Math.sin(Math.PI * u), 0.8);
        let a = 0.18;
        for (const [x, w, al, fase, f] of vetas) { const dx = i - x; if (Math.abs(dx) < w * 2.5) a += al * Math.exp(-(dx * dx) / (w * w)) * (0.55 + 0.45 * Math.sin((j / n) * 6.2832 * f + fase)); }
        const k = (j * n + i) * 4; im.data[k] = 236; im.data[k + 1] = 242; im.data[k + 2] = 250; im.data[k + 3] = Math.min(255, a * borde * 235);
      }
      g.putImageData(im, 0, 0);
    })); },
    bocanada() { return cache.boca || (cache.boca = lienzo(128, (g, n) => {
      const d = ruidoTile(n, 3, 4, 11), im = g.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const dx = i / n - 0.5, dy = j / n - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2; const a = clamp((1 - r) * (0.55 + d[j * n + i] * 0.9), 0, 1); const k = (j * n + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = a * a * 255; }
      g.putImageData(im, 0, 0);
    }, false)); },
    // Troncos y tablas para lo que se arma por código (puente, interiores, cruces).
    madera(tono = "#4a3a2a") { const k = "mad" + tono; return cache[k] || (cache[k] = lienzo(256, (g, n) => {
      g.fillStyle = tono; g.fillRect(0, 0, n, n); const r = azar(tono.length * 7);
      for (let y = 0; y < n; y += 32) { g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, y, n, 2); }
      for (let k2 = 0; k2 < 500; k2++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,235,200"},${0.04 + r() * 0.08})`; g.fillRect(r() * n, r() * n, 20 + r() * 80, 1); }
      for (let k2 = 0; k2 < 12; k2++) { g.fillStyle = "rgba(20,12,6,0.5)"; g.beginPath(); g.ellipse(r() * n, r() * n, 3 + r() * 4, 2, 0, 0, 7); g.fill(); }
    })); },
    // Pintura amarilla de máquina vieja: chapa pareja con óxido en manchas y chorreado.
    pintura() { return cache.pintura || (cache.pintura = lienzo(256, (g, n) => {
      const d = ruidoTile(n, 6, 5, 31), im = g.createImageData(n, n);
      for (let i = 0; i < n * n; i++) { const o = clamp((d[i] - 0.52) * 5, 0, 1), y = i / n / n; const k = i * 4; im.data[k] = lerp(222, 96, o); im.data[k + 1] = lerp(214, 58, o); im.data[k + 2] = lerp(196, 34, o) - y * 20; im.data[k + 3] = 255; }
      g.putImageData(im, 0, 0); const r = azar(5);
      for (let k = 0; k < 40; k++) { const x = r() * n, l = 20 + r() * 90; const gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, "rgba(90,50,25,0.45)"); gr.addColorStop(1, "rgba(90,50,25,0)"); g.fillStyle = gr; g.save(); g.translate(x, r() * n); g.fillRect(0, 0, 1 + r() * 2, l); g.restore(); }
    })); },
    piedra() { return cache.piedra || (cache.piedra = lienzo(256, (g, n) => {
      const d = ruidoTile(n, 5, 5, 21), im = g.createImageData(n, n);
      for (let i = 0; i < n * n; i++) { const v = 88 + d[i] * 70; im.data[i * 4] = v; im.data[i * 4 + 1] = v * 0.98; im.data[i * 4 + 2] = v * 0.95; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
    })); },
    lienzo,
  };
})();

const Mundo = (() => {
  let escena, calidad, luna, hemi, cielo, lagoMat, rioMat, matSuelo, cascadas = [], nieblas = [], tiempo = 0;
  const LUNA_DIR = new THREE.Vector3(...NIEBLA.luna).normalize();
  // Trampa de iluminador: la luna se ve al nornoreste (arriba a la derecha del cerro, como
  // en la referencia) pero la luz viene del estesudeste. Con la luz de donde está el disco,
  // las caras del cerro que miran al valle quedaban a contraluz y el cerro no se veía.
  const LUZ_DIR = new THREE.Vector3(0.5, 0.62, 0.6).normalize();
  const COLOR_NIEBLA = new THREE.Color("#1d2531");
  // En r160 las luces son físicas (la difusa va dividida por π): 1,35 de luna era como
  // 0,43 de las de antes y las montañas quedaban negras. Así la nieve se platea.
  const LUZ = { luna: 2.9, hemi: 2.1 };
  const BOSQUE_LEJOS = new THREE.Color("#1e2c22");

  // ── Suelo ──
  function colorSuelo(x, z, h, pend, lineaArboles = 290) {
    // pend: 0 plano, 1 vertical.
    const c = new THREE.Color();
    // Colores de día (albedo de verdad): la noche la pone la luz. Antes estaban oscurecidos
    // de antemano y, con la luna encima, el suelo quedaba negro.
    const pasto = new THREE.Color("#4b5a3a"), tierra = new THREE.Color("#51473a"), roca = new THREE.Color("#6f7174"), nieve = new THREE.Color("#e9eef4"), barro = new THREE.Color("#5b4d3c");
    const n = Ruido.fbm(x / 35, z / 35, 3);
    c.copy(pasto).lerp(tierra, clamp(0.45 + n * 0.8, 0, 1));
    const dr = Terreno.distRuta(x, z); if (dr < 6) c.lerp(barro, suave(6, 2, dr) * 0.9);
    c.lerp(roca, suave(0.35, 0.62, pend + n * 0.08));
    if (h > 90) c.lerp(roca, suave(90, 170, h) * 0.8);
    // Nieve: arriba y en lo plano; en los paredones se ve la roca.
    const kn = suave(230 + n * 60, 330, h) * (1 - suave(0.55, 0.85, pend));
    c.lerp(nieve, kn);
    // Donde hay monte (la misma densidad que usa crearBosque), el suelo es oscuro: de
    // lejos, donde ya no se dibujan los pinos, las laderas siguen viéndose de bosque.
    const dens = Ruido.fbm(x / 160 + 11, z / 160, 3);
    if (h > 1 && h < lineaArboles) c.lerp(BOSQUE_LEJOS, suave(-0.25, 0.1, dens) * (1 - suave(0.32, 0.5, pend)) * (1 - suave(lineaArboles - 60, lineaArboles, h)) * 0.8);
    // Orillas: barro mojado y oscuro.
    if (h < 1.2) c.multiplyScalar(0.75);
    return c;
  }
  function crearSuelo() {
    const seg = { alta: 360, media: 260, baja: 180 }[calidad], lado = MAPA.lado;
    const geo = new THREE.PlaneGeometry(lado, lado, seg, seg).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) pos.setY(i, Terreno.altura(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const c = colorSuelo(pos.getX(i), pos.getZ(i), pos.getY(i), 1 - nor.getY(i));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    // Detalle repetido en coordenadas del mundo (no en UV: el valle mide 1,7 km).
    const det = Texturas.detalle();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDet = { value: det };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vMundo;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D uDet; varying vec3 vMundo;")
        .replace("#include <color_fragment>", `#include <color_fragment>
          float d1 = texture2D(uDet, vMundo.xz * 0.21).r, d2 = texture2D(uDet, vMundo.xz * 0.037).r;
          diffuseColor.rgb *= 0.55 + d1 * 0.55 + (d2 - 0.55) * 0.5;`);
    };
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.name = "suelo";
    escena.add(m);
    // Faldón de 30 m hacia abajo en el borde: la cordillera de afuera tiene otra grilla y
    // entre las dos quedarían rendijas por donde se vería el cielo.
    const P = [], C = [], I = [], L = lado / 2, n = seg + 1;
    const borde = [];
    for (let i = 0; i < n; i++) borde.push(i);                      // norte (z = −L), de oeste a este
    for (let j = 1; j < n; j++) borde.push(j * n + seg);            // este
    for (let i = seg - 1; i >= 0; i--) borde.push(seg * n + i);     // sur
    for (let j = seg - 1; j >= 0; j--) borde.push(j * n);           // oeste, vuelve al principio
    for (const k of borde) { const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k); P.push(x, y, z, x, y - 30, z); C.push(col[k * 3], col[k * 3 + 1], col[k * 3 + 2], col[k * 3] * 0.6, col[k * 3 + 1] * 0.6, col[k * 3 + 2] * 0.6); }
    for (let i = 0; i < borde.length - 1; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 2, a + 1, a + 3, a, a + 2, a + 1, a + 2, a + 3, a + 1); }
    const gf = new THREE.BufferGeometry(); gf.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); gf.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); gf.setIndex(I);
    const nf = new Float32Array(P.length); for (let i = 1; i < nf.length; i += 3) nf[i] = 1; gf.setAttribute("normal", new THREE.BufferAttribute(nf, 3));
    escena.add(new THREE.Mesh(gf, mat));
    matSuelo = mat;
  }

  // ── La cordillera de afuera ──
  // El relieve sigue más allá del mapa (la misma función, así en el borde no hay costura)
  // y, cuanto más lejos, crestas más altas y nevadas: hasta ~2,5 km de alto a 3 km. Sin
  // esto el valle terminaba en el cielo. Grilla que se abre hacia afuera: ~35 mil triángulos.
  function alturaLejos(x, z) {
    const h = Terreno.altura(x, z), dq = Math.max(Math.abs(x), Math.abs(z)) - MAPA.lado / 2;
    if (dq <= 0) return h;
    const k = suave(0, 1500, dq), norte = 0.7 + 0.6 * suave(300, -2400, z);
    return h + k * (380 + 1300 * Ruido.crestas(x / 560 + 1.7, z / 560 - 4.1, 5)) * norte;
  }
  function crearCordillera() {
    const L = MAPA.lado / 2, R = 3450, afuera = [];
    for (let v = L, paso = 21; v < R; v += paso, paso = Math.min(170, paso * 1.075)) afuera.push(v);
    afuera.push(R);
    const adentro = []; for (let k = 1; k < 80; k++) adentro.push(-L + (k * 2 * L) / 80);
    const ejes = [...afuera.map((v) => -v).reverse(), ...adentro, ...afuera], n = ejes.length;
    const P = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = ejes[i], z = ejes[j]; P.set([x, alturaLejos(x, z), z], (j * n + i) * 3); }
    const I = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const cx = (ejes[i] + ejes[i + 1]) / 2, cz = (ejes[j] + ejes[j + 1]) / 2;
      if (Math.abs(cx) < L && Math.abs(cz) < L) continue; // adentro está el suelo de verdad
      const a = j * n + i; I.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals();
    const nor = geo.attributes.normal, col = new Float32Array(n * n * 3);
    for (let k = 0; k < n * n; k++) {
      const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2], dq = Math.max(Math.abs(x), Math.abs(z)) - L;
      const c = colorSuelo(x, z, y, 1 - nor.getY(k), 290 + 330 * suave(0, 1400, dq)); col.set([c.r, c.g, c.b], k * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, matSuelo); m.name = "cordillera"; m.receiveShadow = true; escena.add(m);
  }

  // ── Agua ──
  function crearAgua() {
    const nrm = Texturas.aguaNormal();
    lagoMat = new THREE.MeshPhongMaterial({ color: "#0b1219", specular: "#8fa6c4", shininess: 90, normalMap: nrm, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.93 });
    const lago = new THREE.Mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2), lagoMat);
    lago.scale.set(MAPA.lago.rx * 1.45, 1, MAPA.lago.rz * 1.45); lago.position.set(MAPA.lago.x, 0, MAPA.lago.z); lago.receiveShadow = true;
    escena.add(lago);
    // Río: una cinta que sigue la polilínea; la textura corre con la corriente.
    const pts = MAPA.rio.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curva = new THREE.CatmullRomCurve3(pts), N = 260, w = MAPA.anchoRio * 0.62;
    const P = [], U = [], I = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = curva.getPointAt(t), tg = curva.getTangentAt(t), lx = -tg.z, lz = tg.x;
      for (const s of [-1, 1]) { const x = p.x + lx * w * s, z = p.z + lz * w * s; P.push(x, 0.22, z); U.push(s * 0.5 + 0.5, t * 90); }
      if (i < N) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const esp = Texturas.vetas().clone(); esp.needsUpdate = true; esp.repeat.set(3, 1);
    rioMat = new THREE.MeshPhongMaterial({ color: "#0f1a22", specular: "#9fb3cc", shininess: 70, normalMap: nrm, normalScale: new THREE.Vector2(0.6, 0.6), emissive: "#101820", emissiveMap: esp, transparent: true, opacity: 0.94 });
    const rio = new THREE.Mesh(g, rioMat); rio.receiveShadow = true; escena.add(rio);
    // Cascadas: una cinta pegada a la roca que baja por la línea de máxima pendiente
    // (el camino del agua), con vetas que corren. Antes era un plano vertical parado
    // delante del acantilado y, con la niebla, se veían barras blancas flotando.
    const tx = Texturas.chorro(); tx.wrapS = THREE.ClampToEdgeWrapping; tx.repeat.set(1, 1);
    // Sin luz propia: el blanco puro de noche brillaba más que la luna.
    const matC = new THREE.MeshBasicMaterial({ color: "#76869a", map: tx, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const rocio = [];
    const todas = [...MAPA.cascadas.map((c) => ({ x: c.x, z: c.z - 16, ancho: c.ancho })), ...MAPA.cascadasAltas.map((c) => ({ ...c, alta: true }))];
    for (const c of todas) {
      const camino = bajada(c.x, c.z);
      if (camino.length < 4) continue;
      const P = [], U = [], I = []; let largo = 0;
      camino.forEach((p, k) => {
        const q = camino[Math.min(k + 1, camino.length - 1)], o = camino[Math.max(k - 1, 0)];
        let dx = q.x - o.x, dz = q.z - o.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        if (k) largo += Math.hypot(p.x - camino[k - 1].x, p.y - camino[k - 1].y, p.z - camino[k - 1].z);
        // Más angosta arriba, se abre al caer.
        const w = c.ancho * (c.alta ? 1.9 : 1.25) * (0.45 + 0.55 * (k / camino.length)), nrm = Terreno.normal(p.x, p.z, 2);
        for (const s of [-1, 1]) P.push(p.x - dz * w * 0.5 * s + nrm.x * 1.1, p.y + nrm.y * 1.1, p.z + dx * w * 0.5 * s + nrm.z * 1.1), U.push(s * 0.5 + 0.5, largo / 14);
        if (k < camino.length - 1) { const a = k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
      escena.add(new THREE.Mesh(g, matC));
      const pie = camino[camino.length - 1];
      for (let k = 3; k < camino.length - 2; k += 6) { const p = camino[k]; rocio.push([p.x, p.y + 2, p.z, Math.random() * 100]); }
      cascadas.push({ tx, x: pie.x, z: pie.z, y: Math.max(0.2, pie.y), alto: camino[0].y - pie.y });
      for (let k = 0; k < 7; k++) rocio.push([pie.x + (Math.random() - 0.5) * c.ancho * 1.6, Math.max(0.2, pie.y) + 1 + k * 1.6, pie.z + (Math.random() - 0.5) * 6, Math.random() * 100]);
    }
    bocanadas(rocio, { color: "#b9c6d6", cerca: [3, 14], lejos: [700, 1100], tam: [9, 12], aspecto: 0.8, alfa: 0.4, deriva: 0.15 });
  }
  // El camino del agua desde (x, z): pasos de 4 m cuesta abajo hasta el lago, el río o
  // un llano (donde se ensancharía en un arroyo que acá no hace falta).
  function bajada(x, z) {
    const camino = [];
    for (let k = 0; k < 220; k++) {
      const y = Terreno.altura(x, z); camino.push({ x, y, z });
      if (y < 0.6 || Terreno.enAgua(x, z)) break;
      const e = 2, gx = Terreno.altura(x + e, z) - Terreno.altura(x - e, z), gz = Terreno.altura(x, z + e) - Terreno.altura(x, z - e), g = Math.hypot(gx, gz);
      if (g < 0.06 && k > 6) break;                       // se acabó la pendiente
      x -= (gx / (g || 1)) * 4; z -= (gz / (g || 1)) * 4;
    }
    return camino;
  }

  // ── Cielo ──
  // El horizonte tiene que ser el mismo color que la niebla (en sRGB: la niebla se mezcla
  // después del tone mapping) para que la cordillera lejana se funda con el cielo.
  function crearCielo() {
    const horiz = new THREE.Color(); COLOR_NIEBLA.getRGB(horiz, THREE.SRGBColorSpace);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uT: { value: 0 }, uLuna: { value: LUNA_DIR }, uNiebla: { value: new THREE.Vector3(horiz.r, horiz.g, horiz.b) } },
      vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }",
      fragmentShader: `varying vec3 vD; uniform float uT; uniform vec3 uLuna; uniform vec3 uNiebla;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
        void main(){
          vec3 d = normalize(vD); float y = max(d.y, 0.0);
          float m = dot(d, uLuna), fl = pow(max(m, 0.0), 6.0);
          vec3 horiz = uNiebla * (1.0 + 1.1 * fl) + vec3(0.012, 0.016, 0.024) * fl;
          vec3 c = mix(horiz, vec3(0.045, 0.055, 0.082), smoothstep(0.0, 0.45, y));
          // Estrellas, apagadas por las nubes y por el resplandor de la luna.
          vec2 sp = d.xz / (d.y + 0.25) * 90.0; float st = step(0.9972, h(floor(sp))) * smoothstep(0.08, 0.4, y) * (1.0 - smoothstep(0.93, 0.99, m));
          // Luna llena, grande como en la referencia, con su halo.
          float disco = smoothstep(0.99935, 0.99955, m), halo = pow(max(m, 0.0), 220.0) * 0.6 + pow(max(m, 0.0), 14.0) * 0.1;
          float mar = n(d.xy * 900.0) * disco;
          // Nubes pesadas que pasan despacio; se iluminan del lado de la luna y en los bordes.
          vec2 q = d.xz / (d.y + 0.16) * 1.3 + vec2(uT * 0.004, uT * 0.0015);
          float nb = smoothstep(0.44, 0.8, fbm(q)), borde = smoothstep(0.35, 0.62, fbm(q * 1.7 + 3.0));
          vec3 nube = mix(vec3(0.075, 0.085, 0.105), vec3(0.4, 0.43, 0.5), clamp(halo * 3.2 + borde * 0.26 + fl * 0.45, 0.0, 1.0));
          c += vec3(0.85, 0.88, 0.95) * st * (1.0 - nb);
          c += (vec3(0.97, 0.97, 1.0) - mar * 0.12) * disco * (1.0 - nb * 0.7) + vec3(0.55, 0.62, 0.78) * halo;
          c = mix(c, nube, nb * smoothstep(0.015, 0.2, y) * 0.92);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    cielo = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 16), mat); cielo.renderOrder = -1; cielo.frustumCulled = false;
    escena.add(cielo);
  }

  // ── Luz de luna ──
  function crearLuces() {
    // Luces físicas de three r160: con 0,55 de luna el suelo quedaba negro. Oscuro, pero que se lea.
    luna = new THREE.DirectionalLight("#b3c6e6", LUZ.luna);
    luna.castShadow = calidad !== "baja";
    const s = { alta: 2048, media: 1024, baja: 512 }[calidad];
    luna.shadow.mapSize.set(s, s); const c = luna.shadow.camera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 1; c.far = 600;
    luna.shadow.bias = -0.0006; luna.shadow.normalBias = 0.4;
    escena.add(luna, luna.target);
    hemi = new THREE.HemisphereLight("#41557d", "#17150f", LUZ.hemi); escena.add(hemi);
    // Densidad a ras del lago (y = 0); a 30 m de altura es un tercio, a 90 m casi nada.
    // En baja, más espesa: tapa el borde donde se cortan los pinos.
    escena.fog = new THREE.FogExp2(COLOR_NIEBLA, { alta: 0.0068, media: 0.0074, baja: 0.0095 }[calidad]);
    escena.background = COLOR_NIEBLA;
  }

  // ── Bocanadas: planos que miran a la cámara, con una textura de nube ──
  // Una sola malla instanciada por familia: niebla a ras del suelo, nubes bajas que abrazan
  // las laderas (se ven de lejos y se deshacen al acercarse) y el rocío al pie de las cascadas.
  function bocanadas(puntos, o) {
    const N = puntos.length, geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTex: { value: Texturas.bocanada() }, uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uColor: { value: new THREE.Color(o.color) },
        uCerca: { value: new THREE.Vector2(...o.cerca) }, uLejos: { value: new THREE.Vector2(...o.lejos) }, uTam: { value: new THREE.Vector3(o.tam[0], o.tam[1], o.aspecto) }, uAlfa: { value: o.alfa }, uDeriva: { value: o.deriva ?? 1 } },
      vertexShader: `attribute vec4 aDato; uniform vec3 uCam; uniform float uT; uniform vec2 uCerca; uniform vec2 uLejos; uniform vec3 uTam; uniform float uDeriva; varying vec2 vUv; varying float vA;
        void main(){ vUv = uv; vec3 c = aDato.xyz; c.x += sin(uT * 0.05 + aDato.w) * 6.0 * uDeriva; c.z += cos(uT * 0.04 + aDato.w * 1.3) * 5.0 * uDeriva;
          float d = distance(c, uCam); vA = smoothstep(uCerca.x, uCerca.y, d) * (1.0 - smoothstep(uLejos.x, uLejos.y, d));
          vec3 der = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          float esc = uTam.x + fract(aDato.w * 7.1) * uTam.y; vec3 p = c + der * position.x * esc + vec3(0.0, 1.0, 0.0) * position.y * esc * uTam.z;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: "uniform sampler2D uTex; uniform vec3 uColor; uniform float uAlfa; varying vec2 vUv; varying float vA; void main(){ float a = texture2D(uTex, vUv).a * vA * uAlfa; if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }",
    });
    const ig = new THREE.InstancedBufferGeometry().copy(geo); ig.instanceCount = N;
    const dato = new Float32Array(N * 4); puntos.forEach((p, i) => dato.set(p, i * 4));
    ig.setAttribute("aDato", new THREE.InstancedBufferAttribute(dato, 4));
    const m = new THREE.Mesh(ig, mat); m.frustumCulled = false; m.renderOrder = o.orden ?? 5; escena.add(m); nieblas.push(m);
    return m;
  }
  function crearNieblas() {
    const r = azar(77), N = { alta: 240, media: 150, baja: 70 }[calidad], pts = [];
    for (let i = 0; i < N; i++) {
      let x, z;
      // Un tercio sobre el lago y el río; el resto en el valle.
      if (i % 3 === 0) { const a = r() * 6.28, k = Math.sqrt(r()); x = MAPA.lago.x + Math.cos(a) * MAPA.lago.rx * 1.2 * k; z = MAPA.lago.z + Math.sin(a) * MAPA.lago.rz * 1.2 * k; }
      else { x = (r() - 0.5) * 1000; z = (r() - 0.5) * 1000 + 100; }
      pts.push([x, Math.max(0, Terreno.altura(x, z)) + 2 + r() * 5, z, r() * 100]);
    }
    bocanadas(pts, { color: "#7d8ba0", cerca: [4, 22], lejos: [170, 260], tam: [26, 30], aspecto: 0.34, alfa: 0.22 });
    // (Hubo nubes bajas pegadas a las laderas: juntas formaban una meseta gris chata delante
    // del cerro. La bruma de las cascadas y la niebla del valle alcanzan.)
  }

  // ── Bosque ──
  // Pino de respaldo (si falta el modelo de Rezona): tronco y cinco conos ralos.
  function pinoProcedural(bajo) {
    const partes = [], r = azar(bajo ? 3 : 5);
    const tronco = new THREE.CylinderGeometry(0.18, 0.42, 20, 6).translate(0, 10, 0); partes.push([tronco, "#2b2119"]);
    const pisos = bajo ? 3 : 6;
    for (let i = 0; i < pisos; i++) {
      const k = i / pisos, rad = lerp(4.2, 1.2, k) * (0.9 + r() * 0.2), alt = lerp(7, 4, k);
      const cono = new THREE.ConeGeometry(rad, alt, bajo ? 6 : 9).translate(0, 4 + k * 17 + alt / 2, 0);
      const p = cono.attributes.position; for (let j = 0; j < p.count; j++) { p.setX(j, p.getX(j) + (r() - 0.5) * 0.5); p.setZ(j, p.getZ(j) + (r() - 0.5) * 0.5); }
      partes.push([cono, i % 2 ? "#15201a" : "#1a2a1f"]);
    }
    // Una sola geometría con color por vértice.
    const geos = partes.map(([g, c]) => { g = g.toNonIndexed(); const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let j = 0; j < n; j++) a.set([col.r, col.g, col.b], j * 3); g.setAttribute("color", new THREE.BufferAttribute(a, 3)); g.deleteAttribute("uv"); return g; });
    const g = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeGeometries(geos) : unir(geos);
    g.computeVertexNormals(); return g;
  }
  function unir(geos) {
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
    for (const g of geos) { P.set(g.attributes.position.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.BufferAttribute(P, 3)); out.setAttribute("color", new THREE.BufferAttribute(C, 3)); return out;
  }
  // ¿Se puede poner un árbol acá? Lejos de rutas, agua y lugares, y bajo la línea de árboles.
  function libre(x, z, margen = 0) {
    if (Terreno.distRuta(x, z) < 7 + margen || Terreno.distRio(x, z) < MAPA.anchoRio + 3) return false;
    const e = ((x - MAPA.lago.x) / MAPA.lago.rx) ** 2 + ((z - MAPA.lago.z) / MAPA.lago.rz) ** 2; if (e < 1.35) return false;
    for (const k in MAPA.lugares) { const l = MAPA.lugares[k]; if (Math.hypot(x - l.x, z - l.z) < l.r + 4 + margen) return false; }
    return true;
  }
  // ── Bosque en tres distancias ──
  // Cerca, el pino 1 de Rezona entero (2.500 triángulos: con ~70 alcanza). Hasta el
  // borde del valle, un impostor: dos planos cruzados con la foto de ese mismo pino,
  // sacada al cargar (8 triángulos). Más allá, el suelo oscuro del monte. Los de cerca
  // se recalculan al moverse: salen del impostor (escala 0) y entran a la malla entera.
  // Antes eran conos por código cerca y más conos lejos: 600 mil triángulos y de lejos
  // el bosque se cortaba a los 360 m.
  const bosque = { todos: [], parcelas: [], grilla: new Map(), cerca: null, cercanos: new Set(), ultimo: new THREE.Vector3(1e9, 0, 0), reloj: 0 };
  function fotoPino(R, arbol) {
    arbol.geo.computeBoundingBox(); const b = arbol.geo.boundingBox, t = b.getSize(new THREE.Vector3());
    const ancho = Math.max(t.x, t.z, t.y / 2), alto = ancho * 2;
    const rt = new THREE.WebGLRenderTarget(256, 512, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const mats = (Array.isArray(arbol.mat) ? arbol.mat : [arbol.mat]).map((m) => new THREE.MeshBasicMaterial({ map: m.map || null, vertexColors: !!m.vertexColors, color: m.map || m.vertexColors ? "#ffffff" : m.color }));
    const esc = new THREE.Scene(), m = new THREE.Mesh(arbol.geo, mats.length > 1 ? mats : mats[0]); esc.add(m);
    const cam = new THREE.OrthographicCamera(-ancho / 2, ancho / 2, b.min.y + alto, b.min.y, 0.1, 400); cam.position.set((b.min.x + b.max.x) / 2, 0, 200); cam.lookAt((b.min.x + b.max.x) / 2, 0, 0);
    const antes = R.getClearAlpha(), cAntes = R.getClearColor(new THREE.Color());
    R.setRenderTarget(rt); R.setClearColor(0x0d1511, 0); R.clear(); R.render(esc, cam); R.setRenderTarget(null); R.setClearColor(cAntes, antes);
    mats.forEach((x) => x.dispose());
    // Dos planos cruzados, cada uno de ida y vuelta (normales para arriba: si no, la cara
    // de atrás daba la normal para abajo y el pino salía negro de un lado).
    const P = [], N = [], U = [], I = [], cx = (b.min.x + b.max.x) / 2;
    for (const [dx, dz] of [[1, 0], [0, 1]]) for (const lado of [1, -1]) {
      const o = P.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const x = (u - 0.5) * ancho; P.push(cx + x * dx, b.min.y + v * alto, x * dz); N.push(0, 1, 0); U.push(u, v); }
      I.push(...(lado > 0 ? [o, o + 1, o + 2, o, o + 2, o + 3] : [o, o + 2, o + 1, o, o + 3, o + 2]));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    return { geo: g, mat: new THREE.MeshLambertMaterial({ map: rt.texture, alphaTest: 0.42, transparent: false }) };
  }
  function crearBosque(R) {
    const paso = { alta: 6.2, media: 7.5, baja: 9.5 }[calidad], r = azar(2024), PAR = 120;
    const porParcela = new Map();
    for (let z = -560; z < 820; z += paso) for (let x = -700; x < 700; x += paso) {
      const px = x + (r() - 0.5) * paso * 0.9, pz = z + (r() - 0.5) * paso * 0.9;
      const dens = Ruido.fbm(px / 160 + 11, pz / 160, 3);
      if (dens < -0.18 + r() * 0.25) continue;
      if (!libre(px, pz)) continue;
      const h = Terreno.altura(px, pz); if (h > 290 || h < 0.8) continue;
      const nrm = Terreno.normal(px, pz, 2); if (nrm.y < 0.78) continue;
      const clave = Math.floor(px / PAR) + "," + Math.floor(pz / PAR);
      if (!porParcela.has(clave)) porParcela.set(clave, []);
      const esc = 0.7 + r() * 0.55;
      porParcela.get(clave).push([px, h - 0.3, pz, r() * 6.28, esc]);
    }
    const entero = Modelos.geoArbol("pino1") || { geo: pinoProcedural(false), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }) };
    const imp = fotoPino(R, entero);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    for (const [clave, lista] of porParcela) {
      const [ix, iz] = clave.split(",").map(Number), malla = new THREE.InstancedMesh(imp.geo, imp.mat, lista.length);
      const par = { cx: (ix + 0.5) * PAR, cz: (iz + 0.5) * PAR, malla, sucia: false };
      lista.forEach(([x, y, z, rot, e], i) => {
        q.setFromAxisAngle(Y, rot); s.set(e, e * (0.9 + (i % 5) * 0.05), e); p.set(x, y, z); m4.compose(p, q, s); malla.setMatrixAt(i, m4);
        const id = bosque.todos.length; bosque.todos.push({ x, z, e, m: m4.clone(), par, i });
        const k = Math.floor(x / 20) + "," + Math.floor(z / 20); if (!bosque.grilla.has(k)) bosque.grilla.set(k, []); bosque.grilla.get(k).push(id);
      });
      malla.castShadow = calidad !== "baja"; malla.receiveShadow = false; malla.computeBoundingSphere(); escena.add(malla); bosque.parcelas.push(par);
    }
    bosque.cerca = new THREE.InstancedMesh(entero.geo, entero.mat, 400); bosque.cerca.count = 0; bosque.cerca.frustumCulled = false;
    bosque.cerca.castShadow = true; bosque.cerca.receiveShadow = true; escena.add(bosque.cerca);
    // Troncos para chocar: los pinos son círculos de ~0,6 m.
    for (const a of bosque.todos) Colision.circulo(a.x, a.z, 0.45 * a.e + 0.15, "arbol");
    return bosque.todos.length;
  }
  const CERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function actualizarBosque(dt, cam) {
    const R_CERCA = { alta: 46, media: 34, baja: 22 }[calidad], LEJOS = { alta: 1400, media: 700, baja: 420 }[calidad];
    for (const par of bosque.parcelas) par.malla.visible = Math.hypot(par.cx - cam.position.x, par.cz - cam.position.z) < LEJOS;
    bosque.reloj -= dt;
    if (bosque.reloj > 0 && bosque.ultimo.distanceToSquared(cam.position) < 9) return;
    bosque.reloj = 0.3; bosque.ultimo.copy(cam.position);
    const nuevos = new Set(), cx = Math.floor(cam.position.x / 20), cz = Math.floor(cam.position.z / 20), n = Math.ceil(R_CERCA / 20);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const id of bosque.grilla.get(cx + i + "," + (cz + j)) || []) { const a = bosque.todos[id]; if (Math.hypot(a.x - cam.position.x, a.z - cam.position.z) < R_CERCA) nuevos.add(id); }
    for (const id of bosque.cercanos) if (!nuevos.has(id)) { const a = bosque.todos[id]; a.par.malla.setMatrixAt(a.i, a.m); a.par.sucia = true; }
    for (const id of nuevos) if (!bosque.cercanos.has(id)) { const a = bosque.todos[id]; a.par.malla.setMatrixAt(a.i, CERO); a.par.sucia = true; }
    for (const par of bosque.parcelas) if (par.sucia) { par.malla.instanceMatrix.needsUpdate = true; par.sucia = false; }
    let k = 0; for (const id of nuevos) { if (k >= 400) break; bosque.cerca.setMatrixAt(k++, bosque.todos[id].m); }
    bosque.cerca.count = k; bosque.cerca.instanceMatrix.needsUpdate = true; bosque.cercanos = nuevos;
  }
  // Rocas grandes y troncos caídos (para esconderse y para chocar). Por parcelas de 240 m
  // que se apagan lejos; las chicas son roca 1 y las grandes, la laja (roca 2).
  const piedras = [];
  function crearRocas() {
    const r = azar(88), N = { alta: 300, media: 220, baja: 130 }[calidad], PAR = 240;
    const r1 = Modelos.geoArbol("roca1") || { geo: new THREE.DodecahedronGeometry(1, 1).translate(0, 0.8, 0), mat: new THREE.MeshStandardMaterial({ color: "#4e5050", map: Texturas.piedra(), roughness: 0.95, flatShading: true }) };
    const r2 = Modelos.geoArbol("roca2") || r1;
    const grupos = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (let k = 0; k < N * 4 && n < N; k++) {
      const x = (r() - 0.5) * 1300, z = (r() - 0.5) * 1200 + 100; if (!libre(x, z, 2)) continue;
      const h = Terreno.altura(x, z); if (h > 320) continue;
      const grande = r() < 0.15, tam = grande ? 0.9 + r() * 0.8 : 0.5 + r() * 1.1;
      // Los modelos ya vienen a su tamaño (roca 1: 1,6 m de alto; roca 2: 2,2 m): tam escala.
      e.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, h - 0.25 * tam, z), q, new THREE.Vector3(tam * (0.9 + r() * 0.3), tam * (0.8 + r() * 0.3), tam));
      const clave = Math.floor(x / PAR) + "," + Math.floor(z / PAR) + (grande ? "g" : "c");
      if (!grupos.has(clave)) grupos.set(clave, { cx: (Math.floor(x / PAR) + 0.5) * PAR, cz: (Math.floor(z / PAR) + 0.5) * PAR, grande, m: [] });
      grupos.get(clave).m.push(m4.clone()); n++;
      if (grande) Colision.circulo(x, z, 3.2 * tam, "roca"); else if (tam > 0.8) Colision.circulo(x, z, 0.95 * tam, "roca");
    }
    for (const gr of grupos.values()) {
      const f = gr.grande ? r2 : r1, im = new THREE.InstancedMesh(f.geo, f.mat, gr.m.length);
      gr.m.forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); escena.add(im);
      piedras.push({ cx: gr.cx, cz: gr.cz, im });
    }
    // Las piedras del río, que rompen el agua en rápidos (como en la referencia).
    const NP = { alta: 130, media: 100, baja: 60 }[calidad], rio = new THREE.InstancedMesh(r1.geo, r1.mat, NP); let np = 0;
    for (let k = 0; k < 900 && np < NP; k++) {
      const t = r(), i = Math.floor(t * (MAPA.rio.length - 1)), f = t * (MAPA.rio.length - 1) - i, [ax, az] = MAPA.rio[i], [bx, bz] = MAPA.rio[i + 1];
      const x = lerp(ax, bx, f) + (r() - 0.5) * MAPA.anchoRio * 1.6, z = lerp(az, bz, f) + (r() - 0.5) * 6;
      if (Math.hypot(x - MAPA.puente.x, z - MAPA.puente.z) < 8) continue;
      const tam = 0.35 + r() * 0.7; e.set(r() * 0.4, r() * 6, r() * 0.4); q.setFromEuler(e);
      // La roca 1 mide 1,6 m: con 0,7 de alto asoma apenas sobre el agua (y = 0,22).
      m4.compose(new THREE.Vector3(x, 0.3 - tam, z), q, new THREE.Vector3(tam * 1.3, tam * 0.7, tam)); rio.setMatrixAt(np++, m4);
    }
    rio.count = np; rio.castShadow = true; rio.computeBoundingSphere(); escena.add(rio);
  }

  function montar(esc, cal, R) {
    escena = esc; calidad = cal;
    crearLuces(); crearCielo(); crearSuelo(); crearCordillera(); crearAgua(); crearNieblas(); crearRocas();
    const n = crearBosque(R);
    return { arboles: n };
  }
  // Cada cuadro: el cielo corre, el agua se mueve, la sombra sigue al que mira.
  const V = new THREE.Vector3();
  function actualizar(dt, cam, foco) {
    tiempo += dt;
    cielo.position.copy(cam.position); cielo.material.uniforms.uT.value = tiempo;
    if (lagoMat.normalMap) lagoMat.normalMap.offset.set(tiempo * 0.004, tiempo * 0.002);
    if (rioMat.emissiveMap) rioMat.emissiveMap.offset.y = -tiempo * 0.9;
    if (cascadas.length) cascadas[0].tx.offset.y = tiempo * 1.4;
    for (const m of nieblas) { m.material.uniforms.uCam.value.copy(cam.position); m.material.uniforms.uT.value = tiempo; }
    // La sombra de la luna, en una caja de 140 m alrededor de lo que se mira.
    V.copy(foco).addScaledVector(LUZ_DIR, 250); luna.position.copy(V); luna.target.position.copy(foco);
    actualizarBosque(dt, cam);
    const lejosPiedra = { alta: 420, media: 320, baja: 220 }[calidad];
    for (const p of piedras) p.im.visible = Math.hypot(p.cx - cam.position.x, p.cz - cam.position.z) < lejosPiedra;
  }
  return { montar, actualizar, cascadas: () => cascadas, libre, LUNA_DIR, COLOR_NIEBLA, LUZ, bosque, get hemi() { return hemi; }, get luna() { return luna; } };
})();
