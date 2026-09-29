"use strict";
// ════════════════════════════════════════════════════════════════════════
// Mundo: suelo, agua, cascadas, cielo con luna, niebla y bosque. La niebla
// es por altura (ShaderChunk parcheado): espesa abajo, entre los pinos y el
// agua, y rala arriba, así las cumbres nevadas se ven como en la referencia.
// ════════════════════════════════════════════════════════════════════════

// ── Niebla por altura para todos los materiales de three ──
(() => {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = "#ifdef USE_FOG\n varying float vFogDepth; varying float vFogAlt;\n#endif";
  C.fog_vertex = `#ifdef USE_FOG
    vFogDepth = - mvPosition.z;
    vec4 fogWp = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      fogWp = instanceMatrix * fogWp;
    #endif
    vFogAlt = (modelMatrix * fogWp).y;
  #endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; varying float vFogDepth; varying float vFogAlt;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear; uniform float fogFar;
    #endif
  #endif`;
  C.fog_fragment = `#ifdef USE_FOG
    #ifdef FOG_EXP2
      // Más densa a ras del suelo y del agua; arriba de 250 m casi no hay.
      float fogDens = fogDensity * mix(1.25, 0.1, smoothstep(6.0, 260.0, vFogAlt));
      float fogFactor = 1.0 - exp(- fogDens * fogDens * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
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
    piedra() { return cache.piedra || (cache.piedra = lienzo(256, (g, n) => {
      const d = ruidoTile(n, 5, 5, 21), im = g.createImageData(n, n);
      for (let i = 0; i < n * n; i++) { const v = 88 + d[i] * 70; im.data[i * 4] = v; im.data[i * 4 + 1] = v * 0.98; im.data[i * 4 + 2] = v * 0.95; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
    })); },
    lienzo,
  };
})();

const Mundo = (() => {
  let escena, calidad, luna, hemi, cielo, lagoMat, rioMat, cascadas = [], nieblas = null, arboles = [], tiempo = 0;
  const LUNA_DIR = new THREE.Vector3(-0.35, 0.62, -0.7).normalize();
  const COLOR_NIEBLA = new THREE.Color("#1a212d");

  // ── Suelo ──
  function colorSuelo(x, z, h, pend) {
    // pend: 0 plano, 1 vertical.
    const c = new THREE.Color();
    const pasto = new THREE.Color("#2a3522"), tierra = new THREE.Color("#2f2a20"), roca = new THREE.Color("#4d4f52"), nieve = new THREE.Color("#d9e1ea"), barro = new THREE.Color("#3a3226");
    const n = Ruido.fbm(x / 35, z / 35, 3);
    c.copy(pasto).lerp(tierra, clamp(0.45 + n * 0.8, 0, 1));
    const dr = Terreno.distRuta(x, z); if (dr < 6) c.lerp(barro, suave(6, 2, dr) * 0.9);
    c.lerp(roca, suave(0.35, 0.62, pend + n * 0.08));
    if (h > 90) c.lerp(roca, suave(90, 170, h) * 0.8);
    // Nieve: arriba y en lo plano; en los paredones se ve la roca.
    const kn = suave(230 + n * 60, 330, h) * (1 - suave(0.55, 0.85, pend));
    c.lerp(nieve, kn);
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
    // Cascadas: cinta vertical con vetas que bajan, y bocanadas de rocío al pie.
    for (const c of MAPA.cascadas) {
      const tx = Texturas.vetas().clone(); tx.needsUpdate = true; tx.repeat.set(2, 1.5);
      const mat = new THREE.MeshBasicMaterial({ color: "#c9d6e4", map: tx, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: true });
      const hTop = Terreno.altura(c.x, c.z - 8), hPie = Math.max(0.2, Terreno.altura(c.x, c.z + 14));
      const alto = Math.max(20, hTop - hPie + 2);
      // Un poco curvada hacia afuera, como agua que se despega del borde.
      const geo = new THREE.PlaneGeometry(c.ancho, alto, 1, 12), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 0.5 - p.getY(i) / alto; p.setZ(i, (k + 0.5) ** 2 * 7); }
      const m = new THREE.Mesh(geo, mat); m.position.set(c.x, hPie + alto / 2, c.z + 2); escena.add(m);
      cascadas.push({ tx, x: c.x, z: c.z + 9, y: hPie });
    }
  }

  // ── Cielo ──
  function crearCielo() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uT: { value: 0 }, uLuna: { value: LUNA_DIR }, uNiebla: { value: COLOR_NIEBLA } },
      vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }",
      fragmentShader: `varying vec3 vD; uniform float uT; uniform vec3 uLuna; uniform vec3 uNiebla;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
        void main(){
          vec3 d = normalize(vD); float y = max(d.y, 0.0);
          vec3 c = mix(uNiebla * 1.05, vec3(0.035,0.045,0.07), smoothstep(0.0, 0.5, y));
          // Estrellas, apagadas por las nubes.
          vec2 sp = d.xz / (d.y + 0.25) * 90.0; float st = step(0.9975, h(floor(sp))) * smoothstep(0.1, 0.4, y);
          // Luna llena y su halo.
          float m = dot(d, uLuna); float disco = smoothstep(0.99955, 0.9997, m); float halo = pow(max(m, 0.0), 180.0) * 0.55 + pow(max(m,0.0), 12.0) * 0.08;
          // Nubes pesadas que pasan despacio; se iluminan del lado de la luna.
          vec2 q = d.xz / (d.y + 0.18) * 1.4 + vec2(uT * 0.004, uT * 0.0015);
          float nb = smoothstep(0.42, 0.78, fbm(q)); float borde = smoothstep(0.35, 0.6, fbm(q * 1.7 + 3.0));
          vec3 nube = mix(vec3(0.05,0.06,0.08), vec3(0.32,0.35,0.42), clamp(halo * 3.0 + borde * 0.25, 0.0, 1.0));
          c += vec3(0.85,0.88,0.95) * st * (1.0 - nb);
          c += vec3(0.95,0.96,1.0) * disco * (1.0 - nb * 0.85) + vec3(0.55,0.62,0.78) * halo;
          c = mix(c, nube, nb * smoothstep(0.02, 0.18, y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    cielo = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), mat); cielo.renderOrder = -1; cielo.frustumCulled = false;
    escena.add(cielo);
  }

  // ── Luz de luna ──
  function crearLuces() {
    luna = new THREE.DirectionalLight("#a9bddf", 0.55);
    luna.castShadow = calidad !== "baja";
    const s = { alta: 2048, media: 1024, baja: 512 }[calidad];
    luna.shadow.mapSize.set(s, s); const c = luna.shadow.camera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 1; c.far = 600;
    luna.shadow.bias = -0.0006; luna.shadow.normalBias = 0.4;
    escena.add(luna, luna.target);
    hemi = new THREE.HemisphereLight("#2b3a55", "#0a0c09", 0.42); escena.add(hemi);
    escena.fog = new THREE.FogExp2(COLOR_NIEBLA, { alta: 0.0085, media: 0.0098, baja: 0.0125 }[calidad]);
    escena.background = COLOR_NIEBLA;
  }

  // ── Niebla que se mueve: bocanadas grandes a ras del suelo, más sobre el agua ──
  function crearNieblas() {
    const N = { alta: 240, media: 150, baja: 70 }[calidad], r = azar(77);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTex: { value: Texturas.bocanada() }, uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uColor: { value: new THREE.Color("#7d8ba0") } },
      vertexShader: `attribute vec4 aDato; uniform vec3 uCam; uniform float uT; varying vec2 vUv; varying float vA;
        void main(){ vUv = uv; vec3 c = aDato.xyz; c.x += sin(uT * 0.05 + aDato.w) * 6.0; c.z += cos(uT * 0.04 + aDato.w * 1.3) * 5.0;
          float d = distance(c.xz, uCam.xz); vA = smoothstep(4.0, 22.0, d) * (1.0 - smoothstep(170.0, 260.0, d));
          vec3 der = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 arr = vec3(0.0, 1.0, 0.0);
          float esc = 26.0 + fract(aDato.w * 7.1) * 30.0; vec3 p = c + der * position.x * esc + arr * position.y * esc * 0.34;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: "uniform sampler2D uTex; uniform vec3 uColor; varying vec2 vUv; varying float vA; void main(){ float a = texture2D(uTex, vUv).a * vA * 0.22; gl_FragColor = vec4(uColor, a); }",
    });
    const ig = new THREE.InstancedBufferGeometry().copy(geo); ig.instanceCount = N;
    const dato = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      let x, z;
      // Un tercio sobre el lago y el río; el resto en el valle.
      if (i % 3 === 0) { const a = r() * 6.28, k = Math.sqrt(r()); x = MAPA.lago.x + Math.cos(a) * MAPA.lago.rx * 1.2 * k; z = MAPA.lago.z + Math.sin(a) * MAPA.lago.rz * 1.2 * k; }
      else { x = (r() - 0.5) * 1000; z = (r() - 0.5) * 1000 + 100; }
      dato.set([x, Math.max(0, Terreno.altura(x, z)) + 2 + r() * 5, z, r() * 100], i * 4);
    }
    ig.setAttribute("aDato", new THREE.InstancedBufferAttribute(dato, 4));
    nieblas = new THREE.Mesh(ig, mat); nieblas.frustumCulled = false; nieblas.renderOrder = 5; escena.add(nieblas);
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
  // Los árboles van por parcelas de 120 m: cerca, el pino entero; lejos, el bajo; más lejos, nada (la niebla).
  function crearBosque() {
    const paso = { alta: 6.2, media: 7.5, baja: 9.5 }[calidad], r = azar(2024), PAR = 120;
    const parcelas = new Map(); const pos = [];
    for (let z = -560; z < 820; z += paso) for (let x = -700; x < 700; x += paso) {
      const px = x + (r() - 0.5) * paso * 0.9, pz = z + (r() - 0.5) * paso * 0.9;
      const dens = Ruido.fbm(px / 160 + 11, pz / 160, 3);
      if (dens < -0.18 + r() * 0.25) continue;
      if (!libre(px, pz)) continue;
      const h = Terreno.altura(px, pz); if (h > 290 || h < 0.8) continue;
      const nrm = Terreno.normal(px, pz, 2); if (nrm.y < 0.78) continue;
      const clave = Math.floor(px / PAR) + "," + Math.floor(pz / PAR);
      if (!parcelas.has(clave)) parcelas.set(clave, []);
      const esc = 0.7 + r() * 0.55;
      parcelas.get(clave).push([px, h - 0.3, pz, r() * 6.28, esc]); pos.push([px, pz, esc]);
    }
    const mAlto = Modelos.geoArbol("pino1") || { geo: pinoProcedural(false), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }) };
    const mBajo = { geo: pinoProcedural(true), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }) };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    for (const [clave, lista] of parcelas) {
      const [ix, iz] = clave.split(",").map(Number), cx = (ix + 0.5) * PAR, cz = (iz + 0.5) * PAR;
      const alto = new THREE.InstancedMesh(mAlto.geo, mAlto.mat, lista.length), bajo = new THREE.InstancedMesh(mBajo.geo, mBajo.mat, lista.length);
      lista.forEach(([x, y, z, rot, e], i) => { q.setFromAxisAngle(Y, rot); s.set(e, e * (0.9 + (i % 5) * 0.05), e); p.set(x, y, z); m4.compose(p, q, s); alto.setMatrixAt(i, m4); bajo.setMatrixAt(i, m4); });
      alto.castShadow = true; alto.receiveShadow = true; bajo.castShadow = false;
      for (const m of [alto, bajo]) { m.computeBoundingSphere(); escena.add(m); }
      arboles.push({ cx, cz, alto, bajo });
    }
    // Troncos para chocar: los pinos son círculos de ~0,6 m.
    for (const [x, z, e] of pos) Colision.circulo(x, z, 0.45 * e + 0.15, "arbol");
    return pos.length;
  }
  // Rocas grandes y troncos caídos (para esconderse y para chocar).
  function crearRocas() {
    const r = azar(88), N = { alta: 420, media: 300, baja: 180 }[calidad];
    const geo = Modelos.geoArbol("roca1") || { geo: new THREE.DodecahedronGeometry(1, 1), mat: new THREE.MeshStandardMaterial({ color: "#4e5050", map: Texturas.piedra(), roughness: 0.95, flatShading: true }) };
    const im = new THREE.InstancedMesh(geo.geo, geo.mat, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0;
    for (let k = 0; k < N * 4 && n < N; k++) {
      const x = (r() - 0.5) * 1300, z = (r() - 0.5) * 1200 + 100; if (!libre(x, z, 2)) continue;
      const h = Terreno.altura(x, z); if (h > 320) continue;
      const tam = r() < 0.15 ? 2.5 + r() * 3 : 0.6 + r() * 1.4;
      e.set(r() * 3, r() * 6, r() * 3); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, h - tam * 0.3, z), q, new THREE.Vector3(tam * (1 + r() * 0.4), tam * 0.75, tam));
      im.setMatrixAt(n++, m4); if (tam > 1.1) Colision.circulo(x, z, tam * 0.95, "roca");
    }
    im.count = n; im.castShadow = true; im.receiveShadow = true; escena.add(im);
    // Las piedras del río, que rompen el agua en rápidos (como en la referencia).
    const piedras = new THREE.InstancedMesh(geo.geo, geo.mat, 160); let np = 0;
    for (let k = 0; k < 900 && np < 160; k++) {
      const t = r(), i = Math.floor(t * (MAPA.rio.length - 1)), f = t * (MAPA.rio.length - 1) - i, [ax, az] = MAPA.rio[i], [bx, bz] = MAPA.rio[i + 1];
      const x = lerp(ax, bx, f) + (r() - 0.5) * MAPA.anchoRio * 1.6, z = lerp(az, bz, f) + (r() - 0.5) * 6;
      if (Math.hypot(x - MAPA.puente.x, z - MAPA.puente.z) < 8) continue;
      const tam = 0.5 + r() * 1.3; e.set(r(), r() * 6, r()); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, -0.2 + tam * 0.25, z), q, new THREE.Vector3(tam * 1.3, tam * 0.7, tam)); piedras.setMatrixAt(np++, m4);
    }
    piedras.count = np; piedras.castShadow = true; escena.add(piedras);
  }

  function montar(esc, cal) {
    escena = esc; calidad = cal;
    crearLuces(); crearCielo(); crearSuelo(); crearAgua(); crearNieblas(); crearRocas();
    const n = crearBosque();
    return { arboles: n };
  }
  // Cada cuadro: el cielo corre, el agua se mueve, la sombra sigue al que mira.
  const V = new THREE.Vector3();
  function actualizar(dt, cam, foco) {
    tiempo += dt;
    cielo.position.copy(cam.position); cielo.material.uniforms.uT.value = tiempo;
    if (lagoMat.normalMap) lagoMat.normalMap.offset.set(tiempo * 0.004, tiempo * 0.002);
    if (rioMat.emissiveMap) rioMat.emissiveMap.offset.y = -tiempo * 0.9;
    for (const c of cascadas) c.tx.offset.y = tiempo * 1.1;
    nieblas.material.uniforms.uCam.value.copy(cam.position); nieblas.material.uniforms.uT.value = tiempo;
    // La sombra de la luna, en una caja de 140 m alrededor de lo que se mira.
    V.copy(foco).addScaledVector(LUNA_DIR, 250); luna.position.copy(V); luna.target.position.copy(foco);
    // Pinos: entero cerca, bajo lejos, nada detrás de la niebla.
    const lejos = { alta: 360, media: 300, baja: 230 }[calidad], cerca = { alta: 150, media: 110, baja: 80 }[calidad];
    for (const a of arboles) { const d = Math.hypot(a.cx - cam.position.x, a.cz - cam.position.z); a.alto.visible = d < cerca; a.bajo.visible = d >= cerca && d < lejos; }
  }
  return { montar, actualizar, cascadas: () => cascadas, libre, LUNA_DIR, COLOR_NIEBLA, get hemi() { return hemi; }, get luna() { return luna; } };
})();
