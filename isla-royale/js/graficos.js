"use strict";
// ════════════════════════════════════════════════════════════════════════
// Gráficos: texturas, mallas de la isla, personajes, armas, botín, íconos y
// el vestíbulo.
// ════════════════════════════════════════════════════════════════════════
const CELDA = 5, ALTO = 4; // la grilla de construcción (el original usa 5,12 × 3,84 m)

// ── texturas dibujadas en un canvas ──
function texCanvas(tam, dibujar, repetir, alto) {
  const c = document.createElement("canvas"); c.width = tam; c.height = alto || tam; dibujar(c.getContext("2d"), tam, alto || tam);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const TEX = {};
function texturas() {
  if (TEX.detalle) return TEX;
  TEX.detalle = texCanvas(256, (g, n) => {
    g.fillStyle = "#e4e4e4"; g.fillRect(0, 0, n, n); const r = azar(9);
    for (let i = 0; i < 3200; i++) { const x = r() * n, y = r() * n, l = 2 + r() * 5, a = -Math.PI / 2 + (r() - 0.5) * 0.9; g.strokeStyle = r() < 0.5 ? `rgba(40,60,20,${0.1 + r() * 0.18})` : `rgba(255,255,230,${0.12 + r() * 0.2})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.beginPath(); g.arc(r() * n, r() * n, 6 + r() * 18, 0, 7); g.fill(); }
  }, true);
  TEX.madera = texCanvas(256, (g, n) => {
    const r = azar(4);
    for (let i = 0; i < 5; i++) {
      const y = (i * n) / 5, tono = 180 + r() * 30; g.fillStyle = `rgb(${tono},${tono * 0.66},${tono * 0.38})`; g.fillRect(0, y, n, n / 5);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(90,50,20,${0.15 + r() * 0.2})`; g.beginPath(); const yy = y + 4 + r() * (n / 5 - 8); g.moveTo(0, yy); g.bezierCurveTo(n * 0.3, yy + (r() - 0.5) * 6, n * 0.6, yy + (r() - 0.5) * 6, n, yy); g.stroke(); }
      g.fillStyle = "rgba(60,30,10,0.75)"; g.fillRect(0, y, n, 3); g.fillStyle = "rgba(40,40,40,0.9)"; for (const x of [12, n - 16]) { g.beginPath(); g.arc(x, y + n / 10, 3, 0, 7); g.fill(); }
    }
    g.strokeStyle = "rgba(60,30,10,0.9)"; g.lineWidth = 6; g.strokeRect(3, 3, n - 6, n - 6);
  });
  TEX.piedra = texCanvas(256, (g, n) => {
    const r = azar(5); g.fillStyle = "#8f8a80"; g.fillRect(0, 0, n, n);
    for (let fila = 0; fila < 8; fila++) for (let col = -1; col < 5; col++) {
      const x = col * 64 + (fila % 2) * 32, y = fila * 32, t = 150 + r() * 50;
      g.fillStyle = `rgb(${t},${t * 0.95},${t * 0.88})`; g.fillRect(x + 2, y + 2, 60, 28);
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(x + 2, y + 2, 60, 4);
    }
    g.strokeStyle = "rgba(40,40,40,0.8)"; g.lineWidth = 6; g.strokeRect(3, 3, n - 6, n - 6);
  });
  TEX.metal = texCanvas(256, (g, n) => {
    const gr = g.createLinearGradient(0, 0, 32, 0); gr.addColorStop(0, "#9aa6b2"); gr.addColorStop(0.5, "#d2dae2"); gr.addColorStop(1, "#8a96a2");
    g.fillStyle = gr; for (let x = 0; x < n; x += 32) { g.save(); g.translate(x, 0); g.fillRect(0, 0, 32, n); g.restore(); }
    g.fillStyle = "rgba(60,40,20,0.25)"; const r = azar(6); for (let i = 0; i < 40; i++) g.fillRect(r() * n, r() * n, 2 + r() * 6, 2 + r() * 10);
    g.strokeStyle = "rgba(40,50,60,0.9)"; g.lineWidth = 8; g.strokeRect(4, 4, n - 8, n - 8);
  });
  TEX.asfalto = texCanvas(128, (g, n) => {
    g.fillStyle = "#56585c"; g.fillRect(0, 0, n, n); const r = azar(7);
    for (let i = 0; i < 900; i++) { const t = 60 + r() * 60; g.fillStyle = `rgba(${t},${t},${t},0.5)`; g.fillRect(r() * n, r() * n, 1.5, 1.5); }
    g.fillStyle = "#f2f2f2"; g.fillRect(n / 2 - 2, 0, 4, n * 0.55);
    g.fillStyle = "#e8d27a"; g.fillRect(4, 0, 3, n); g.fillRect(n - 7, 0, 3, n);
  }, true);
  TEX.brillo = texCanvas(64, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
  TEX.fogonazo = texCanvas(64, (g, n) => {
    g.translate(n / 2, n / 2);
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.fillStyle = "rgba(255,230,150,0.9)"; g.beginPath(); g.moveTo(-3, 0); g.lineTo(0, -n / 2); g.lineTo(3, 0); g.fill(); }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, n / 3); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "rgba(255,180,60,0)"); g.fillStyle = gr; g.fillRect(-n / 2, -n / 2, n, n);
  });
  TEX.haz = texCanvas(8, (g, n, al) => { const gr = g.createLinearGradient(0, al, 0, 0); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, al); }, false, 128);
  return TEX;
}

// ── armado de geometrías ──
function unir(lista) {
  const partes = lista.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0; for (const g of partes) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of partes) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + n) * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += n;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute("position", new THREE.BufferAttribute(pos, 3)); r.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); r.setAttribute("color", new THREE.BufferAttribute(col, 3)); r.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  r.computeBoundingSphere(); return r;
}
function pintar(geo, abajo, arriba) {
  const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, c1 = new THREE.Color(abajo), c2 = new THREE.Color(arriba || abajo);
  let mn = Infinity, mx = -Infinity; for (let i = 0; i < p.count; i++) { mn = Math.min(mn, p.getY(i)); mx = Math.max(mx, p.getY(i)); }
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(c1).lerp(c2, (p.getY(i) - mn) / (mx - mn || 1)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); return g;
}
const colorear = (g, c) => pintar(g, c, c);
function abollar(geo, k, semilla) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + semilla) * 43758.5453, f = 1 + (n - Math.floor(n) - 0.5) * k; p.setXYZ(i, x * f, y * f, z * f); }
  geo.computeVertexNormals(); return geo;
}
const cajaGeo = (mn, mx, color) => colorear(new THREE.BoxGeometry(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z).translate((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, (mn.z + mx.z) / 2), color);
function tejadoGeo(tj) {
  const corto = tj.eje === "x" ? tj.d : tj.w, largo = tj.eje === "x" ? tj.w : tj.d, forma = new THREE.Shape();
  forma.moveTo(-corto / 2, 0); forma.lineTo(corto / 2, 0); forma.lineTo(0, tj.alto); forma.closePath();
  const g = new THREE.ExtrudeGeometry(forma, { depth: largo, bevelEnabled: false }).translate(0, 0, -largo / 2);
  if (tj.eje === "x") g.rotateY(Math.PI / 2);
  return colorear(g.translate(tj.x, tj.y, tj.z), tj.color);
}

// ════════════════════════════════════════════════════════════════════════
// La escena de la isla
// ════════════════════════════════════════════════════════════════════════
async function construirEscena(renderer, isla, progreso) {
  const T = texturas(), { terreno } = isla;
  const escena = new THREE.Scene(), uTiempo = { value: 0 };
  const HORIZONTE = new THREE.Color().setRGB(0.78, 0.9, 1.0, THREE.LinearSRGBColorSpace);
  escena.fog = new THREE.Fog(HORIZONTE.clone(), 130, 620);
  const SOL = new THREE.Vector3(0.5, 0.78, 0.38).normalize();
  progreso(0.7, "etapa_escena"); await pausa();

  // Cielo: escribe el color crudo, igual que la niebla, así el horizonte empalma.
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uHor: { value: HORIZONTE }, uSol: { value: SOL } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uHor; uniform vec3 uSol;
      void main() {
        float y = vDir.y; vec3 c = mix(uHor, vec3(0.22, 0.52, 0.93), pow(clamp(y, 0.0, 1.0), 0.55));
        if (y < 0.0) c = mix(uHor, vec3(0.5, 0.72, 0.86), clamp(-y * 5.0, 0.0, 1.0));
        float s = max(dot(normalize(vDir), uSol), 0.0); c += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 3.0 + pow(s, 14.0) * 0.22);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  cielo.renderOrder = -1; cielo.frustumCulled = false; escena.add(cielo);
  const hemi = new THREE.HemisphereLight(0xd6ecff, 0x5d7f3e, 0.55); escena.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff0d8, 2.7);
  sol.shadow.camera.left = sol.shadow.camera.bottom = -50; sol.shadow.camera.right = sol.shadow.camera.top = 50;
  sol.shadow.camera.near = 1; sol.shadow.camera.far = 340; sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.04;
  escena.add(sol, sol.target);
  let entorno = null;
  { const pm = new THREE.PMREMGenerator(renderer), aparte = new THREE.Scene(); aparte.add(cielo.clone()); entorno = pm.fromScene(aparte, 0.02).texture; escena.environment = entorno; pm.dispose(); }

  // ── relieve ──
  const geoT = new THREE.PlaneGeometry((NG - 1) * RES, (NG - 1) * RES, NG - 1, NG - 1); geoT.rotateX(-Math.PI / 2);
  {
    const p = geoT.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, terreno(p.getX(i), p.getZ(i)));
    geoT.computeVertexNormals();
    const n = geoT.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const arena = new THREE.Color("#ecd9a0"), arenaMojada = new THREE.Color("#c7ac72"), pasto1 = new THREE.Color("#5fb13b"), pasto2 = new THREE.Color("#8cc84b"), pastoAlto = new THREE.Color("#4f9a3a");
    const roca = new THREE.Color("#8e9088"), plaza = new THREE.Color("#cdbb92"), fondo = new THREE.Color("#b89a66"), tierra = new THREE.Color("#a88a5a");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), cs = costa(x, z);
      if (y < 0.05) c.copy(fondo).lerp(arenaMojada, clamp(1 + y * 0.5, 0, 1));
      else {
        c.copy(pasto1).lerp(pasto2, clamp(isla.fbm(x / 30, z / 30) * 1.6 - 0.3, 0, 1)).lerp(pastoAlto, clamp((y - 6) / 8, 0, 0.6));
        c.lerp(roca, clamp((0.84 - n.getY(i)) * 5, 0, 1));
        c.lerp(y < 0.35 ? arenaMojada : arena, suave(26, 10, cs) * suave(2.4, 0.9, y));
        c.lerp(tierra, suave(6.5, 4, isla.cercaRuta(x, z)[0]) * 0.7);
        for (const pu of isla.lugares) c.lerp(plaza, suave(pu.radio * 0.8, pu.radio * 0.45, Math.hypot(x - pu.x, z - pu.z)) * 0.7);
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geoT.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const uv = geoT.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 130, uv.getY(i) * 130);
  }
  const suelo = new THREE.Mesh(geoT, new THREE.MeshStandardMaterial({ vertexColors: true, map: T.detalle, roughness: 0.95, envMapIntensity: 0.6 }));
  suelo.receiveShadow = true; escena.add(suelo);
  progreso(0.74, "etapa_escena"); await pausa();

  // ── rutas: una cinta de asfalto que sigue el suelo ──
  {
    const pos = [], uv = [], nor = [];
    for (const s of isla.rutas) {
      const L = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.ceil(L / 3), ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L, px = -uz * 3.4, pz = ux * 3.4;
      for (let k = 0; k < n; k++) {
        const quad = [k / n, (k + 1) / n].map((f) => { const x = lerp(s.ax, s.bx, f), z = lerp(s.az, s.bz, f); return [[x + px, z + pz], [x - px, z - pz], f * L / 7]; });
        const v = (q, lado) => { const [x, z] = q[lado]; return [x, Math.max(terreno(x, z), 0.1) + 0.07, z]; };
        const a = v(quad[0], 0), b = v(quad[0], 1), c = v(quad[1], 0), d = v(quad[1], 1);
        pos.push(...a, ...b, ...c, ...b, ...d, ...c);
        uv.push(0, quad[0][2], 1, quad[0][2], 0, quad[1][2], 1, quad[0][2], 1, quad[1][2], 0, quad[1][2]);
        for (let q = 0; q < 6; q++) nor.push(0, 1, 0);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: T.asfalto, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; escena.add(m);
  }

  // ── agua (sabe qué tan honda es por un mapa de alturas: espuma en la orilla) ──
  const datosAlto = new Uint8Array(NG * NG * 4);
  for (let i = 0; i < NG * NG; i++) { datosAlto[i * 4] = clamp(((isla.alturas[i] + 8) / 24) * 255, 0, 255); datosAlto[i * 4 + 3] = 255; }
  const texAlto = new THREE.DataTexture(datosAlto, NG, NG); texAlto.magFilter = texAlto.minFilter = THREE.LinearFilter; texAlto.needsUpdate = true;
  const TAM = (NG - 1) * RES;
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSol: { value: SOL }, uAlto: { value: null } }]),
    // Los #include tienen que ir solos en su renglón: son del preprocesador.
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vW; uniform float uT; uniform vec3 uSol; uniform sampler2D uAlto;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vW.xz; float t = uT; vec2 uv = (p - ${T0.toFixed(1)}) / ${TAM.toFixed(1)};
        float hT = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture2D(uAlto, uv).r * 24.0 - 8.0 : -8.0;
        float prof = max(0.0, -hT);
        vec3 n = normalize(vec3(sin(p.x * 0.35 + t * 1.3) * 0.05 + sin(p.y * 0.9 + p.x * 0.3 - t * 2.1) * 0.03, 1.0, cos(p.y * 0.3 - t * 1.1) * 0.05 + cos(p.x * 0.8 - p.y * 0.4 + t * 1.7) * 0.03));
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 c = mix(vec3(0.2, 0.78, 0.8), vec3(0.02, 0.26, 0.52), smoothstep(0.0, 6.0, prof));
        c = mix(c, vec3(0.72, 0.88, 1.0), fres * 0.65);
        float brillo = pow(max(dot(reflect(-uSol, n), v), 0.0), 160.0) * 2.2;
        float espuma = clamp(smoothstep(1.1, 0.0, prof) * (0.6 + 0.4 * sin(prof * 9.0 - t * 2.4 + p.x * 0.06 + p.y * 0.04)), 0.0, 1.0);
        c = mix(c, vec3(1.0), espuma * 0.75) + brillo;
        gl_FragColor = vec4(c, max(mix(0.5, 0.93, smoothstep(0.0, 3.5, prof)), espuma * 0.85));
        #include <fog_fragment>
      }`,
  }));
  agua.material.uniforms.uAlto.value = texAlto; agua.renderOrder = 1; escena.add(agua);

  // ── vegetación, rocas y autos (instanciados) ──
  const matVeg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  // Lo que queda pegado a la cámara (una copa, una roca) se deshace en puntitos: si no, tapa todo.
  matVeg.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
      float dCam = length(vViewPosition);
      if (dCam < 2.8 && dCam / 2.8 < fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453)) discard;`);
  };
  const o3 = new THREE.Object3D(), cTmp = new THREE.Color();
  const instanciar = (geo, lista, fn, sombra, mat) => {
    const m = new THREE.InstancedMesh(geo, mat || matVeg, Math.max(1, lista.length));
    lista.forEach((it, i) => { fn(it, o3, cTmp); o3.updateMatrix(); m.setMatrixAt(i, o3.matrix); m.setColorAt(i, cTmp); });
    m.count = lista.length; m.castShadow = sombra; m.receiveShadow = true; escena.add(m); return m;
  };
  const robles = isla.arboles.filter((a) => !a.pino), pinos = isla.arboles.filter((a) => a.pino);
  robles.forEach((a, i) => (a.ii = i)); pinos.forEach((a, i) => (a.ii = i));
  const geoTronco = pintar(new THREE.CylinderGeometry(0.22, 0.36, 4.4, 7).translate(0, 2.2, 0), "#5a3a22", "#8a5d3a");
  const copaRoble = unir([[0, 5.2, 0, 2.2], [-1.5, 4.4, 0.6, 1.6], [1.4, 4.6, -0.5, 1.7], [0.3, 4.3, 1.5, 1.5], [-0.4, 6.4, -0.3, 1.5]].map(([x, y, z, r], i) => pintar(abollar(new THREE.IcosahedronGeometry(r, 1), 0.18, i).translate(x, y, z), "#3f8a2c", "#9fdc6a")));
  const copaPino = unir([[2.3, 3.0, 2.2], [1.8, 2.6, 3.9], [1.25, 2.2, 5.3]].map(([r, hh, y]) => pintar(new THREE.ConeGeometry(r, hh, 8).translate(0, y, 0), "#2c6a34", "#5fae5a")));
  const ubicar = (a, o, tilt = 0) => { o.position.set(a.x, a.y0 - 0.2, a.z); o.rotation.set(tilt, a.rot, tilt * 0.5); o.scale.setScalar(a.s); };
  const colorRoble = (a, c) => { c.setHSL(0.24 + a.tono * 0.08, 0.55, a.tono < 0.12 ? 0.6 : 0.8); if (a.tono < 0.08) c.setHSL(0.08, 0.7, 0.75); };
  const troncos = instanciar(geoTronco, isla.arboles, (a, o, c) => { ubicar(a, o); c.setRGB(1, 1, 1); }, true);
  const copasR = instanciar(copaRoble, robles, (a, o, c) => { ubicar(a, o); colorRoble(a, c); }, true);
  const copasP = instanciar(copaPino, pinos, (a, o, c) => { ubicar(a, o); c.setHSL(0.3, 0.3, 0.75 + a.tono * 0.2); }, true);
  const geoRoca = pintar(abollar(new THREE.IcosahedronGeometry(1, 1), 0.5, 3), "#6f726c", "#b9bcb4");
  const ubicarRoca = (r, o) => { o.position.set(r.x, r.y0 + r.sy * 0.25, r.z); o.rotation.set(0, r.rot, 0); o.scale.set(r.s, r.sy, r.s * 0.85); };
  const instRocas = instanciar(geoRoca, isla.rocas, (r, o, c) => { ubicarRoca(r, o); c.setHSL(0.1, 0.05, 0.75 + r.tono * 0.25); }, true);
  instanciar(pintar(abollar(new THREE.IcosahedronGeometry(0.9, 1), 0.3, 7).scale(1, 0.75, 1), "#3a7f2a", "#8fd060"), isla.matas, (m, o, c) => { o.position.set(m.x, m.y0 + 0.35 * m.s, m.z); o.rotation.set(0, m.rot, 0); o.scale.setScalar(m.s); c.setHSL(0.25, 0.5, 0.75 + m.tono * 0.2); }, false);
  // Autos: carrocería pintable (color por instancia), vidrios y ruedas oscuros.
  const geoAuto = unir([
    colorear(new THREE.BoxGeometry(1.9, 0.75, 4.3).translate(0, 0.75, 0), "#ffffff"), colorear(new THREE.BoxGeometry(1.7, 0.7, 2.2).translate(0, 1.45, -0.2), "#ffffff"),
    colorear(new THREE.BoxGeometry(1.74, 0.5, 2.0).translate(0, 1.45, -0.2), "#27323c"),
    ...[[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.35], [0.95, 1.35]].map(([x, z]) => colorear(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12).rotateZ(Math.PI / 2).translate(x, 0.38, z), "#222222")),
    colorear(new THREE.BoxGeometry(1.5, 0.15, 0.1).translate(0, 0.8, 2.16), "#fff3c0"),
  ]);
  const matAuto = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
  const ubicarAuto = (a, o) => { o.position.set(a.x, a.y0, a.z); o.rotation.set(0, a.ang, 0); o.scale.setScalar(1); };
  const instAutos = instanciar(geoAuto, isla.autos, (a, o, c) => { ubicarAuto(a, o); c.set(a.color); }, true, matAuto);
  progreso(0.8, "etapa_escena"); await pausa();

  // El pasto: tres hojitas por mata, que se mecen con el viento en el vértice.
  const geoPasto = (() => {
    const pos = [], col = [], nor = [], base = new THREE.Color("#3f7f25"), punta = new THREE.Color("#b7e36e");
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI, ca = Math.cos(a), sa = Math.sin(a), incl = 0.12 * (k - 1); pos.push(-0.06 * ca, 0, -0.06 * sa, 0.06 * ca, 0, 0.06 * sa, incl * sa, 0.55, -incl * ca); col.push(base.r, base.g, base.b, base.r, base.g, base.b, punta.r, punta.g, punta.b); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return g;
  })();
  const matPasto = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  matPasto.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uTiempo;
    sh.vertexShader = "uniform float uT;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float fase = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
      transformed.x += sin(uT * 1.8 + fase) * 0.08 * position.y; transformed.z += cos(uT * 1.4 + fase) * 0.06 * position.y;`);
  };
  const pasto = instanciar(geoPasto, isla.pasto, (p, o, c) => { o.position.set(p.x, p.y0 - 0.03, p.z); o.rotation.set(0, p.rot, 0); o.scale.setScalar(p.s); c.setHSL(0.24, 0.3, 0.8 + p.tono * 0.2); }, false, matPasto);
  pasto.receiveShadow = false;

  // ── edificios (cada uno, una malla con color por vértice) y cajas sueltas ──
  const matCasa = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  for (const e of isla.edificios) {
    const partes = e.partes.map((c) => cajaGeo(c.min, c.max, c.piso ? (e.tipo === "galpon" ? "#8b8b86" : "#a27e5a") : c.color));
    if (e.tejado) partes.push(tejadoGeo(e.tejado));
    // Marcos blancos en puertas y ventanas.
    for (const hq of e.huecos) {
      const piso = e.y0 + 0.25, eje = hq.lado[0] === "x", sgn = hq.lado[1] === "+" ? 1 : -1;
      const cara = eje ? e.x + sgn * (e.w / 2 + 0.02) : e.z + sgn * (e.d / 2 + 0.02);
      const marco = (a, b, ya, yb) => { const mn = eje ? { x: cara - 0.06, y: piso + ya, z: e.z + a } : { x: e.x + a, y: piso + ya, z: cara - 0.06 }; const mx = eje ? { x: cara + 0.06, y: piso + yb, z: e.z + b } : { x: e.x + b, y: piso + yb, z: cara + 0.06 }; partes.push(cajaGeo(mn, mx, "#f7f7f2")); };
      marco(hq.c - hq.w / 2 - 0.12, hq.c - hq.w / 2, hq.y0, hq.y1 + 0.12); marco(hq.c + hq.w / 2, hq.c + hq.w / 2 + 0.12, hq.y0, hq.y1 + 0.12);
      marco(hq.c - hq.w / 2 - 0.12, hq.c + hq.w / 2 + 0.12, hq.y1, hq.y1 + 0.12); if (hq.y0 > 0) marco(hq.c - hq.w / 2 - 0.15, hq.c + hq.w / 2 + 0.15, hq.y0 - 0.1, hq.y0);
    }
    const m = new THREE.Mesh(unir(partes), matCasa); m.castShadow = m.receiveShadow = true; escena.add(m);
  }
  {
    const partes = isla.cajas.filter((c) => !c.edificio).map((c) => cajaGeo(c.min, c.max, c.color || "#999"));
    for (const pl of isla.plataformas) { const w = pl.max.x - pl.min.x, d = pl.max.z - pl.min.z; for (let f = 0; f <= 1.001; f += 0.125) for (const s of [0.1, 0.9]) { const x = w > d ? pl.min.x + w * f : pl.min.x + w * s, z = w > d ? pl.min.z + d * s : pl.min.z + d * f; partes.push(colorear(new THREE.CylinderGeometry(0.15, 0.15, 8, 6).translate(x, -3.2, z), "#6b4a2e")); } }
    if (partes.length) { const m = new THREE.Mesh(unir(partes), matCasa); m.castShadow = m.receiveShadow = true; escena.add(m); }
  }
  progreso(0.86, "etapa_escena"); await pausa();

  // ── nubes y autobús ──
  const nubes = [];
  { const r = azar(77), matNube = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#a8bccc", emissiveIntensity: 0.55, fog: false });
    for (let i = 0; i < 16; i++) { const partes = []; for (let k = 0; k < 7; k++) partes.push(new THREE.SphereGeometry(6 + r() * 7, 10, 8).scale(1, 0.6, 1).translate((r() - 0.5) * 26, (r() - 0.3) * 4, (r() - 0.5) * 14)); const m = new THREE.Mesh(unir(partes), matNube); m.position.set((r() - 0.5) * 800, 190 + r() * 50, (r() - 0.5) * 800); escena.add(m); nubes.push(m); } }
  const bus = new THREE.Group();
  {
    const partes = [colorear(new THREE.BoxGeometry(3, 2.4, 9).translate(0, 1.2, 0), "#2f7fe0"), colorear(new THREE.BoxGeometry(3.05, 0.8, 7.5).translate(0, 1.7, -0.3), "#bfe6ff"), colorear(new THREE.BoxGeometry(3.1, 0.3, 9.1).translate(0, 0.35, 0), "#ffc62e")];
    for (const [x, z] of [[-1.5, -3], [1.5, -3], [-1.5, 3], [1.5, 3]]) partes.push(colorear(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12).rotateZ(Math.PI / 2).translate(x, 0.1, z), "#222"));
    partes.push(colorear(new THREE.SphereGeometry(5, 18, 14).translate(0, 10, 0), "#e8f3ff"), colorear(new THREE.SphereGeometry(5.05, 18, 14, 0, Math.PI * 2, 0.9, 0.5).translate(0, 10, 0), "#ff7a3d"));
    for (const [x, z] of [[-1.2, -3], [1.2, -3], [-1.2, 3], [1.2, 3]]) partes.push(colorear(new THREE.CylinderGeometry(0.03, 0.03, 6, 4).translate(x, 5.4, z * 0.6), "#444"));
    const m = new THREE.Mesh(unir(partes), matCasa); m.castShadow = true; bus.add(m); bus.visible = false; escena.add(bus);
  }

  // ── tormenta ──
  const tormenta = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uT: uTiempo },
    vertexShader: `varying vec2 vUv; varying float vY; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec2 vUv; varying float vY; uniform float uT;
      void main() {
        float f = 0.5 + 0.5 * sin(vUv.x * 620.0 + vY * 0.08 - uT * 1.6) * sin(vUv.x * 160.0 - uT * 0.7 + vY * 0.03);
        float a = (0.32 + 0.22 * f) * smoothstep(300.0, 60.0, vY);
        gl_FragColor = vec4(mix(vec3(0.42, 0.14, 0.85), vec3(0.8, 0.55, 1.0), f), a);
      }`,
  }));
  tormenta.renderOrder = 2; tormenta.visible = false; escena.add(tormenta);

  // ── efectos ──
  const MAXP = 700, partPos = new Float32Array(MAXP * 3), partCol = new Float32Array(MAXP * 3);
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute("position", new THREE.BufferAttribute(partPos, 3).setUsage(THREE.DynamicDrawUsage)); geoP.setAttribute("color", new THREE.BufferAttribute(partCol, 3).setUsage(THREE.DynamicDrawUsage));
  const puntos = new THREE.Points(geoP, new THREE.PointsMaterial({ size: 0.22, map: T.brillo, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
  puntos.frustumCulled = false; escena.add(puntos);
  const trazos = [], geoTrazo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(geoTrazo, new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; escena.add(m); trazos.push({ m, vida: 0 }); }
  const flashes = [];
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.fogonazo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.visible = false; escena.add(s); flashes.push({ s, vida: 0 }); }
  const luzBoca = new THREE.PointLight(0xffc966, 0, 9, 2); escena.add(luzBoca);
  // Balas de francotirador (se ven viajar).
  const balas = [];
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe28a })); m.visible = false; escena.add(m); balas.push(m); }

  // ── construcción: materiales, piezas y el fantasma azul ──
  const matPieza = { madera: new THREE.MeshStandardMaterial({ map: T.madera, roughness: 0.8 }), piedra: new THREE.MeshStandardMaterial({ map: T.piedra, roughness: 0.9 }), metal: new THREE.MeshStandardMaterial({ map: T.metal, roughness: 0.45, metalness: 0.5 }) };
  const escalones = [];
  for (let k = 0; k < 8; k++) escalones.push(new THREE.BoxGeometry(CELDA, ALTO / 8, CELDA / 8).translate(0, (k + 0.5) * (ALTO / 8), CELDA / 2 - (k + 0.5) * (CELDA / 8)));
  escalones.push(new THREE.BoxGeometry(CELDA, 0.18, Math.hypot(CELDA, ALTO)).rotateX(Math.atan2(ALTO, CELDA)).translate(0, ALTO / 2 - 0.25, 0));
  const geoPieza = {
    muro: new THREE.BoxGeometry(CELDA, ALTO, 0.25).translate(0, ALTO / 2, 0),
    piso: new THREE.BoxGeometry(CELDA, 0.25, CELDA).translate(0, 0.125, 0),
    escalera: (() => { const g = unir(escalones); g.deleteAttribute("color"); return g; })(),
    techo: new THREE.ConeGeometry(CELDA * 0.7071, 1.8, 4, 1).rotateY(Math.PI / 4).translate(0, 0.9, 0),
  };
  const fantasma = {}, matFantasma = new THREE.MeshBasicMaterial({ color: 0x5ab4ff, transparent: true, opacity: 0.35, depthWrite: false });
  const matFantasmaMal = new THREE.MeshBasicMaterial({ color: 0xff5a6a, transparent: true, opacity: 0.35, depthWrite: false });
  for (const k of PIEZAS) { fantasma[k] = new THREE.Mesh(geoPieza[k], matFantasma); fantasma[k].visible = false; fantasma[k].renderOrder = 3; escena.add(fantasma[k]); }

  // ── imagen del mapa (vista de arriba, hecha una vez) ──
  const imgMapa = document.createElement("canvas"); imgMapa.width = imgMapa.height = 512;
  {
    const g = imgMapa.getContext("2d"), img = g.createImageData(512, 512), c = new THREE.Color(), L = 520, a0 = -260;
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const x = a0 + (i + 0.5) * (L / 512), z = a0 + (j + 0.5) * (L / 512), y = terreno(x, z), k = (j * 512 + i) * 4;
      if (y < 0) c.setRGB(0.1, 0.45 + y * 0.03, 0.72 + y * 0.02); else if (costa(x, z) < 14 && y < 2.2) c.setRGB(0.93, 0.85, 0.6);
      else c.setRGB(0.36 - y * 0.006, 0.68 - y * 0.009, 0.25 + y * 0.002);
      img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const a = (v) => ((v - a0) / L) * 512, s = 512 / L;
    g.strokeStyle = "#6b6d70"; g.lineWidth = 6.8 * s; g.lineCap = "round"; for (const r of isla.rutas) { g.beginPath(); g.moveTo(a(r.ax), a(r.az)); g.lineTo(a(r.bx), a(r.bz)); g.stroke(); }
    g.fillStyle = "rgba(30,90,30,0.55)"; for (const t of isla.arboles) { g.beginPath(); g.arc(a(t.x), a(t.z), 1.6, 0, 7); g.fill(); }
    for (const e of isla.edificios) { g.fillStyle = e.techo; g.fillRect(a(e.x - e.w / 2), a(e.z - e.d / 2), e.w * s, e.d * s); }
    for (const c2 of isla.cajas) if (!c2.edificio) { g.fillStyle = c2.color || "#999"; g.fillRect(a(c2.min.x), a(c2.min.z), (c2.max.x - c2.min.x) * s, (c2.max.z - c2.min.z) * s); }
  }
  progreso(0.9, "etapa_sombras"); await pausa();

  // Árboles, rocas y autos que se rompen: se esconden poniendo su instancia en escala cero.
  const cero = new THREE.Matrix4().makeScale(0, 0, 0), sacudidas = [];
  function quitarInstancia(o) {
    if (o.tipo === "arbol") { troncos.setMatrixAt(o.idx, cero); troncos.instanceMatrix.needsUpdate = true; const m = o.pino ? copasP : copasR; m.setMatrixAt(o.ii, cero); m.instanceMatrix.needsUpdate = true; }
    else if (o.tipo === "roca") { instRocas.setMatrixAt(o.idx, cero); instRocas.instanceMatrix.needsUpdate = true; }
    else if (o.tipo === "auto") { instAutos.setMatrixAt(o.idx, cero); instAutos.instanceMatrix.needsUpdate = true; }
  }
  function sacudir(o) { if (!sacudidas.some((s) => s.o === o)) sacudidas.push({ o, t: 0.25 }); }
  function actualizarSacudidas(dt) {
    for (let i = sacudidas.length - 1; i >= 0; i--) {
      const s = sacudidas[i], o = s.o; s.t -= dt; const tilt = s.t > 0 ? Math.sin(s.t * 60) * 0.04 * (s.t / 0.25) : 0;
      if (o.roto) { sacudidas.splice(i, 1); continue; }
      if (o.tipo === "arbol") { ubicar(o, o3, tilt); o3.updateMatrix(); troncos.setMatrixAt(o.idx, o3.matrix); troncos.instanceMatrix.needsUpdate = true; const m = o.pino ? copasP : copasR; m.setMatrixAt(o.ii, o3.matrix); m.instanceMatrix.needsUpdate = true; }
      else if (o.tipo === "roca") { ubicarRoca(o, o3); o3.rotation.x = tilt; o3.updateMatrix(); instRocas.setMatrixAt(o.idx, o3.matrix); instRocas.instanceMatrix.needsUpdate = true; }
      else if (o.tipo === "auto") { ubicarAuto(o, o3); o3.rotation.z = tilt; o3.updateMatrix(); instAutos.setMatrixAt(o.idx, o3.matrix); instAutos.instanceMatrix.needsUpdate = true; }
      if (s.t <= 0) sacudidas.splice(i, 1);
    }
  }
  function restaurarInstancias() {
    isla.arboles.forEach((a) => { ubicar(a, o3); o3.updateMatrix(); troncos.setMatrixAt(a.idx, o3.matrix); (a.pino ? copasP : copasR).setMatrixAt(a.ii, o3.matrix); });
    isla.rocas.forEach((r) => { ubicarRoca(r, o3); o3.updateMatrix(); instRocas.setMatrixAt(r.idx, o3.matrix); });
    isla.autos.forEach((a) => { ubicarAuto(a, o3); o3.updateMatrix(); instAutos.setMatrixAt(a.idx, o3.matrix); });
    for (const m of [troncos, copasR, copasP, instRocas, instAutos]) m.instanceMatrix.needsUpdate = true;
  }

  // ── cofres dorados y cajas de munición (base, tapa con bisagra atrás y un halo) ──
  const ORO = "#ffc53a", OSCURO = "#5a3514";
  const matCofre = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.3, emissive: "#4a2e00", emissiveIntensity: 0.5 });
  const matCajaMun = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const semi = (r, l) => new THREE.CylinderGeometry(r, r, l, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
  const geoCofre = unir([colorear(new THREE.BoxGeometry(0.95, 0.5, 0.6).translate(0, 0.25, 0), ORO), colorear(new THREE.BoxGeometry(0.08, 0.52, 0.62).translate(-0.3, 0.26, 0), OSCURO), colorear(new THREE.BoxGeometry(0.08, 0.52, 0.62).translate(0.3, 0.26, 0), OSCURO), colorear(new THREE.BoxGeometry(0.14, 0.16, 0.05).translate(0, 0.4, -0.31), "#fff2b0")]);
  const geoTapa = unir([colorear(semi(0.3, 0.95), ORO), colorear(semi(0.31, 0.08).translate(-0.3, 0, 0), OSCURO), colorear(semi(0.31, 0.08).translate(0.3, 0, 0), OSCURO)]).translate(0, 0, -0.3);
  const geoMun = unir([colorear(new THREE.BoxGeometry(0.8, 0.4, 0.5).translate(0, 0.2, 0), "#4f7a3a"), colorear(new THREE.BoxGeometry(0.82, 0.08, 0.52).translate(0, 0.3, 0), "#e8c64a")]);
  const geoMunTapa = colorear(new THREE.BoxGeometry(0.8, 0.08, 0.5).translate(0, 0.04, -0.25), "#3f6a2e");
  function mallaCofre(c, tipo) {
    const g = new THREE.Group(), cofre = tipo === "cofre";
    const base = new THREE.Mesh(cofre ? geoCofre : geoMun, cofre ? matCofre : matCajaMun), tapa = new THREE.Group(), tapaM = new THREE.Mesh(cofre ? geoTapa : geoMunTapa, cofre ? matCofre : matCajaMun);
    base.castShadow = tapaM.castShadow = true; tapa.position.set(0, cofre ? 0.5 : 0.4, cofre ? 0.3 : 0.25); tapa.add(tapaM); g.add(base, tapa);
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.brillo, color: cofre ? 0xffc850 : 0x9fe07f, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    aura.scale.setScalar(cofre ? 2.6 : 1.6); aura.position.y = 0.5; g.add(aura);
    g.position.set(c.x, c.y, c.z); g.rotation.y = c.rot; escena.add(g);
    return { grupo: g, tapa, aura };
  }

  return { mallaCofre, escena, uTiempo, SOL, cielo, hemi, sol, entorno, suelo, agua, pasto, tormenta, nubes, bus, puntos, geoP, partPos, partCol, MAXP, trazos, flashes, luzBoca, balas, matPieza, geoPieza, fantasma, matFantasma, matFantasmaMal, imgMapa, quitarInstancia, sacudir, actualizarSacudidas, restaurarInstancias };
}

// ════════════════════════════════════════════════════════════════════════
// Armas (en la mano y tiradas en el piso)
// ════════════════════════════════════════════════════════════════════════
let GA = null;
const MAT_RAREZA = [];
function geosArmas() {
  if (GA) return GA;
  const B = (x, y, z) => new THREE.BoxGeometry(x, y, z), C = (r, l, n = 8) => new THREE.CylinderGeometry(r, r, l, n).rotateX(Math.PI / 2);
  GA = {
    metal: new THREE.MeshStandardMaterial({ color: "#2a2d34", roughness: 0.45, metalness: 0.6 }), madera: new THREE.MeshStandardMaterial({ color: "#8a5a33", roughness: 0.7 }), gris: new THREE.MeshStandardMaterial({ color: "#5a606a", roughness: 0.5, metalness: 0.4 }),
    // [geometría, material ("metal" | "madera" | "gris" | "rareza"), x, y, z, rotX]
    rifle: [[B(0.07, 0.11, 0.5), "metal", 0, 0, -0.2], [C(0.018, 0.34), "metal", 0, 0.01, -0.6], [B(0.05, 0.17, 0.08), "rareza", 0, -0.12, -0.18, 0.2], [B(0.06, 0.13, 0.22), "gris", 0, -0.02, 0.13], [B(0.03, 0.05, 0.2), "metal", 0, 0.08, -0.18], [B(0.05, 0.06, 0.16), "rareza", 0, -0.04, -0.4]],
    escopeta: [[B(0.085, 0.11, 0.42), "metal", 0, 0, -0.15], [C(0.03, 0.4), "metal", 0, 0.02, -0.52], [B(0.075, 0.07, 0.18), "madera", 0, -0.06, -0.44], [B(0.06, 0.13, 0.26), "madera", 0, -0.03, 0.15], [B(0.09, 0.03, 0.3), "rareza", 0, 0.065, -0.15]],
    subfusil: [[B(0.07, 0.12, 0.32), "metal", 0, 0, -0.12], [C(0.02, 0.18), "metal", 0, 0.02, -0.36], [B(0.045, 0.22, 0.06), "rareza", 0, -0.16, -0.1], [B(0.03, 0.07, 0.2), "gris", 0, -0.02, 0.12], [B(0.04, 0.12, 0.05), "gris", 0, -0.09, 0.02]],
    pistola: [[B(0.045, 0.07, 0.22), "metal", 0, 0.02, -0.12], [B(0.045, 0.14, 0.07), "rareza", 0, -0.07, -0.02, 0.25]],
    francotirador: [[B(0.07, 0.1, 0.7), "metal", 0, 0, -0.25], [C(0.02, 0.6), "metal", 0, 0.01, -0.9], [C(0.035, 0.3), "gris", 0, 0.1, -0.25], [B(0.06, 0.14, 0.3), "rareza", 0, -0.02, 0.22], [B(0.04, 0.03, 0.08), "gris", 0.05, 0.04, -0.05]],
    pico: [[new THREE.CylinderGeometry(0.025, 0.03, 0.8, 8).translate(0, 0.3, 0), "madera", 0, 0, 0], [B(0.55, 0.08, 0.08), "rareza", 0, 0.68, 0], [new THREE.ConeGeometry(0.05, 0.18, 6).rotateZ(Math.PI / 2).translate(0.35, 0.68, 0), "gris", 0, 0, 0], [new THREE.ConeGeometry(0.05, 0.18, 6).rotateZ(-Math.PI / 2).translate(-0.35, 0.68, 0), "gris", 0, 0, 0]],
    vendas: [[new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12), "blanco", 0, 0, -0.1]],
    botiquin: [[B(0.28, 0.18, 0.12), "rojo", 0, 0, -0.1], [B(0.06, 0.02, 0.13), "blanco", 0, 0.1, -0.1], [B(0.02, 0.06, 0.13), "blanco", 0, 0.1, -0.1]],
    pocion: [[new THREE.SphereGeometry(0.08, 10, 8), "azul", 0, 0, -0.1], [new THREE.CylinderGeometry(0.025, 0.03, 0.08, 8).translate(0, 0.1, 0), "blanco", 0, 0, -0.1]],
    miniescudo: [[new THREE.CylinderGeometry(0.035, 0.04, 0.12, 8), "celeste", 0, 0, -0.1], [new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6).translate(0, 0.08, 0), "blanco", 0, 0, -0.1]],
  };
  const mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: e || "#000000", emissiveIntensity: 0.4 });
  Object.assign(GA, { blanco: mat("#f4f2ea"), rojo: mat("#e0413c"), azul: mat("#2f8cff", "#0a3a8a"), celeste: mat("#7fd3ff", "#1a5a8a") });
  RAREZAS.forEach((r, i) => (MAT_RAREZA[i] = new THREE.MeshStandardMaterial({ color: r.color, roughness: 0.4, metalness: 0.3, emissive: r.oscuro, emissiveIntensity: 0.35 })));
  return GA;
}
function modeloObjeto(tipo, rareza = 0) {
  const G = geosArmas(), g = new THREE.Group();
  for (const [geo, m, x, y, z, rx] of G[tipo]) { const o = new THREE.Mesh(geo, m === "rareza" ? MAT_RAREZA[rareza] : G[m]); o.position.set(x, y, z); if (rx) o.rotation.x = rx; o.castShadow = true; g.add(o); }
  return g;
}

// ── botín tirado: el objeto girando y un haz de luz del color de la rareza ──
let GB = null;
function mallaBotin(item) {
  if (!GB) {
    const T = texturas();
    GB = { haz: new THREE.CylinderGeometry(0.25, 0.25, 3, 8, 1, true).translate(0, 1.5, 0), hazMat: RAREZAS.map((r) => new THREE.MeshBasicMaterial({ color: r.color, map: T.haz, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
      caja: new THREE.BoxGeometry(0.34, 0.2, 0.22), cajaMat: {}, pila: new THREE.BoxGeometry(0.5, 0.12, 0.3) };
    for (const k in MUNICIONES) GB.cajaMat[k] = new THREE.MeshStandardMaterial({ color: MUNICIONES[k].color, roughness: 0.5 });
    for (const k in MATERIALES) GB.cajaMat[k] = new THREE.MeshStandardMaterial({ map: T[k], roughness: 0.8 });
  }
  const g = new THREE.Group(), giro = new THREE.Group(); g.add(giro);
  if (item.tipo === "arma") { const m = modeloObjeto(item.arma, item.rareza); m.scale.setScalar(1.4); m.rotation.y = Math.PI / 2; giro.add(m); giro.position.y = 0.45; const hz = new THREE.Mesh(GB.haz, GB.hazMat[item.rareza]); g.add(hz); }
  else if (item.tipo === "consumible") { const m = modeloObjeto(item.c); m.scale.setScalar(1.8); giro.add(m); giro.position.y = 0.4; const hz = new THREE.Mesh(GB.haz, GB.hazMat[item.c === "botiquin" || item.c === "pocion" ? 2 : 1]); hz.scale.set(0.8, 0.6, 0.8); g.add(hz); }
  else if (item.tipo === "municion") { const m = new THREE.Mesh(GB.caja, GB.cajaMat[item.m]); m.castShadow = true; giro.add(m); giro.position.y = 0.15; }
  else { for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(GB.pila, GB.cajaMat[item.mat]); m.position.y = k * 0.13; m.rotation.y = k * 0.3; m.castShadow = true; giro.add(m); } giro.position.y = 0.08; }
  g.userData.giro = giro;
  return g;
}

// ── íconos para el HUD (dibujados una vez en un canvas) ──
const ICONOS = {};
function icono(clave) {
  if (ICONOS[clave]) return ICONOS[clave];
  const c = document.createElement("canvas"); c.width = 128; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineJoin = "round"; g.lineCap = "round";
  const R = (x, y, w, h) => g.fillRect(x, y, w, h);
  const P = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  switch (clave) {
    case "rifle": R(18, 24, 70, 12); R(88, 27, 30, 5); P([[40, 36], [52, 36], [48, 56], [38, 56]]); P([[8, 22], [22, 24], [22, 38], [6, 44]]); R(44, 16, 26, 6); break;
    case "escopeta": R(30, 24, 60, 11); R(90, 26, 32, 7); R(70, 35, 22, 7); P([[6, 26], [32, 24], [32, 36], [10, 46]]); break;
    case "subfusil": R(34, 22, 50, 14); R(84, 25, 18, 6); R(52, 36, 10, 24); P([[14, 26], [34, 24], [34, 30], [16, 34]]); break;
    case "francotirador": R(12, 26, 88, 9); R(100, 28, 26, 4); R(42, 14, 34, 9); P([[4, 24], [20, 26], [20, 36], [2, 44]]); break;
    case "pistola": R(46, 20, 44, 12); P([[50, 32], [64, 32], [60, 54], [46, 54]]); break;
    case "pico": g.lineWidth = 7; g.beginPath(); g.moveTo(44, 58); g.lineTo(80, 10); g.stroke(); g.beginPath(); g.moveTo(52, 6); g.quadraticCurveTo(80, 0, 108, 22); g.lineWidth = 9; g.stroke(); break;
    case "vendas": g.beginPath(); g.arc(64, 32, 18, 0, 7); g.fill(); g.fillStyle = "#b8b4a8"; g.beginPath(); g.arc(64, 32, 7, 0, 7); g.fill(); break;
    case "botiquin": g.fillStyle = "#e0413c"; R(40, 16, 48, 34); g.fillStyle = "#fff"; R(60, 22, 8, 22); R(53, 29, 22, 8); break;
    case "pocion": g.fillStyle = "#2f8cff"; g.beginPath(); g.arc(64, 38, 16, 0, 7); g.fill(); g.fillStyle = "#fff"; R(59, 10, 10, 14); break;
    case "miniescudo": g.fillStyle = "#7fd3ff"; R(56, 20, 16, 32); g.fillStyle = "#fff"; R(59, 12, 10, 8); break;
    case "madera": g.fillStyle = "#c98f55"; R(36, 18, 56, 10); R(36, 30, 56, 10); R(36, 42, 56, 10); break;
    case "piedra": g.fillStyle = "#b8b3a8"; R(34, 18, 28, 14); R(64, 18, 28, 14); R(48, 34, 30, 14); break;
    case "metal": g.fillStyle = "#b8c4cf"; for (let k = 0; k < 5; k++) R(38 + k * 11, 16, 8, 34); break;
    case "muro": g.lineWidth = 5; g.strokeRect(38, 12, 52, 40); break;
    case "piso": g.lineWidth = 5; P([[24, 44], [64, 30], [104, 44], [64, 58]]); break;
    case "escalera": g.lineWidth = 5; for (let k = 0; k < 4; k++) R(40 + k * 12, 48 - k * 10, 12, 10 + k * 10); break;
    case "techo": P([[30, 50], [64, 12], [98, 50]]); break;
  }
  return (ICONOS[clave] = c.toDataURL());
}

// ════════════════════════════════════════════════════════════════════════
// Personajes: piezas con grupos por articulación
// ════════════════════════════════════════════════════════════════════════
let GEO = null;
function geos() {
  if (GEO) return GEO;
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
  GEO = {
    torso: cap(0.19, 0.26).scale(1, 1, 0.72), cadera: cap(0.165, 0.08).scale(1, 1, 0.8), cuello: new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8),
    cabeza: new THREE.SphereGeometry(0.15, 18, 14).scale(0.92, 1.05, 1),
    pelo: new THREE.SphereGeometry(0.16, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6).rotateX(0.6).scale(0.97, 1.05, 1.05), // inclinado: tapa la nuca, deja la cara
    ojo: new THREE.SphereGeometry(0.02, 6, 5), brazo: cap(0.058, 0.22), antebrazo: cap(0.05, 0.2), mano: new THREE.SphereGeometry(0.055, 8, 6),
    muslo: cap(0.085, 0.28), pierna: cap(0.07, 0.28), zapato: new THREE.BoxGeometry(0.12, 0.09, 0.26), mochila: new THREE.BoxGeometry(0.3, 0.36, 0.14),
    casco: new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), visera: new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16, 1, false, Math.PI * 0.6, Math.PI * 0.8),
    ala: new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), copa: new THREE.CylinderGeometry(0.13, 0.16, 0.16, 14), escafandra: new THREE.SphereGeometry(0.23, 18, 14), capucha: new THREE.SphereGeometry(0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72).rotateX(0.35),
    varilla: new THREE.CylinderGeometry(0.015, 0.015, 1.2, 5),
  };
  const ala = new THREE.BufferGeometry();
  ala.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0.1, -1.1, -1.7, -0.25, 0.7, 0, 0.25, 0.4, 0, 0.1, -1.1, 0, 0.25, 0.4, 1.7, -0.25, 0.7]), 3));
  ala.computeVertexNormals(); GEO.planeador = ala;
  return GEO;
}
function crearPersonaje(traje) {
  const G = geos();
  const m = (c, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.78 }, extra));
  const piel = m(traje.piel, { roughness: 0.6 }), ropa = m(traje.ropa), pant = m(traje.pantalon), pelo = m(traje.pelo, { roughness: 0.9 }), negro = m("#1d1f26", { roughness: 0.55 }), mochila = m(traje.mochila);
  const pieza = (geo, mat, x, y, z, padre) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; padre.add(o); return o; };
  const raiz = new THREE.Group(), cuerpo = new THREE.Group(); cuerpo.position.y = 0.95; raiz.add(cuerpo);
  pieza(G.cadera, pant, 0, 0.04, 0, cuerpo); pieza(G.torso, ropa, 0, 0.36, 0, cuerpo); pieza(G.mochila, mochila, 0, 0.4, 0.15, cuerpo); pieza(G.cuello, piel, 0, 0.66, 0, cuerpo);
  const cabeza = new THREE.Group(); cabeza.position.y = 0.8; cuerpo.add(cabeza);
  pieza(G.cabeza, piel, 0, 0, 0, cabeza);
  if (traje.gorro !== "escafandra" && traje.gorro !== "capucha") pieza(G.pelo, pelo, 0, 0.01, 0.01, cabeza);
  pieza(G.ojo, negro, -0.05, 0.015, -0.135, cabeza); pieza(G.ojo, negro, 0.05, 0.015, -0.135, cabeza);
  if (traje.gorro) {
    const gm = m(traje.gorroColor || "#444");
    if (traje.gorro === "casco") { pieza(G.casco, gm, 0, 0.02, 0, cabeza); }
    else if (traje.gorro === "gorra") { pieza(G.casco, gm, 0, 0.0, 0.01, cabeza).scale.set(0.95, 0.8, 0.95); pieza(G.visera, gm, 0, 0.04, -0.06, cabeza); }
    else if (traje.gorro === "sombrero") { pieza(G.ala, gm, 0, 0.1, 0, cabeza); pieza(G.copa, gm, 0, 0.18, 0, cabeza); }
    else if (traje.gorro === "capucha") { pieza(G.capucha, gm, 0, 0.01, 0.02, cabeza); }
    else if (traje.gorro === "escafandra") { pieza(G.escafandra, new THREE.MeshStandardMaterial({ color: gm.color, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 }), 0, 0.01, 0, cabeza).castShadow = false; }
  }
  const brazo = (lado) => {
    const hombro = new THREE.Group(); hombro.position.set(lado * 0.25, 0.58, 0); cuerpo.add(hombro);
    pieza(G.brazo, ropa, 0, -0.16, 0, hombro);
    const codo = new THREE.Group(); codo.position.y = -0.31; hombro.add(codo);
    pieza(G.antebrazo, piel, 0, -0.14, 0, codo); pieza(G.mano, piel, 0, -0.29, 0, codo);
    return [hombro, codo];
  };
  const pierna = (lado) => {
    const cad = new THREE.Group(); cad.position.set(lado * 0.1, 0, 0); cuerpo.add(cad);
    pieza(G.muslo, pant, 0, -0.22, 0, cad);
    const rod = new THREE.Group(); rod.position.y = -0.45; cad.add(rod);
    pieza(G.pierna, pant, 0, -0.2, 0, rod); pieza(G.zapato, negro, 0, -0.44, -0.04, rod);
    return [cad, rod];
  };
  const [hombroI, codoI] = brazo(-1), [hombroD, codoD] = brazo(1), [cadI, rodI] = pierna(-1), [cadD, rodD] = pierna(1);
  // En la mano: un grupo por cosa, se prende el que corresponde.
  const mano = new THREE.Group(); mano.position.set(0.1, 0.46, -0.2); cuerpo.add(mano);
  const enMano = {};
  const planeador = new THREE.Group(); planeador.position.y = 2.55; raiz.add(planeador);
  const tela = new THREE.Mesh(G.planeador, new THREE.MeshStandardMaterial({ color: traje.ropa, side: THREE.DoubleSide, roughness: 0.6 })); tela.castShadow = true; planeador.add(tela);
  for (const x of [-0.3, 0.3]) { const v = new THREE.Mesh(G.varilla, geosArmas().metal); v.position.set(x, -0.55, 0.1); v.rotation.z = x * 0.6; planeador.add(v); }
  planeador.visible = false;
  return { raiz, cuerpo, cabeza, hombroI, codoI, hombroD, codoD, cadI, rodI, cadD, rodD, mano, enMano, planeador, visto: null };
}
// Lo que tiene en la mano: arma (con su rareza), pico, consumible o nada.
function ponerEnMano(M, clave, rareza) {
  const k = clave ? clave + ":" + (rareza || 0) : null;
  if (M.visto === k) return; M.visto = k;
  for (const c of Object.values(M.enMano)) c.visible = false;
  if (!k) return;
  if (!M.enMano[k]) {
    const g = modeloObjeto(clave, rareza || 0);
    if (clave === "pico") { g.rotation.set(-0.3, 0, 0.2); g.position.set(0.02, -0.12, 0.05); }
    M.mano.add(g); M.enMano[k] = g;
  }
  M.enMano[k].visible = true;
}
function animar(p, dt, t) {
  const M = p.malla;
  M.raiz.position.set(p.x, p.y, p.z); M.raiz.rotation.y = p.yaw;
  M.planeador.visible = p.vivo && p.estado === "planea";
  M.raiz.visible = p.estado !== "bus" && (p.vivo || p.muerte < 2.2) && !p.oculto;
  if (!M.raiz.visible) return;
  const cosa = p.enMano ? p.enMano() : null;
  if (!p.vivo) {
    const k = Math.min(1, p.muerte / 0.6); M.cuerpo.rotation.set(k * 1.45, 0, 0); M.cuerpo.position.y = 0.95 - k * 0.72; return;
  }
  M.cuerpo.rotation.set(0, 0, 0); M.cuerpo.position.y = 0.95; M.cabeza.rotation.set(0, 0, 0);
  const brazosArma = (pt) => { M.hombroD.rotation.set(0.55 + pt, 0, -0.3); M.codoD.rotation.set(1.35, 0, 0); M.hombroI.rotation.set(1.25 + pt, 0, 0.62); M.codoI.rotation.set(0.3, 0, 0); };
  if (p.estado === "cae") {
    ponerEnMano(M, null); M.cuerpo.rotation.x = -1.25 + clamp(-p.pitch, 0, 1.2) * -0.2;
    M.hombroI.rotation.set(0.2, 0, -1.3); M.hombroD.rotation.set(0.2, 0, 1.3); M.codoI.rotation.set(0, 0, 0); M.codoD.rotation.set(0, 0, 0);
    M.cadI.rotation.set(-0.25, 0, -0.15); M.cadD.rotation.set(-0.25, 0, 0.15); M.rodI.rotation.x = M.rodD.rotation.x = -0.5; return;
  }
  if (p.estado === "planea") {
    ponerEnMano(M, null); M.cuerpo.rotation.x = -0.12;
    M.hombroI.rotation.set(2.95, 0, 0.22); M.hombroD.rotation.set(2.95, 0, -0.22); M.codoI.rotation.x = M.codoD.rotation.x = 0;
    const s = Math.sin(t * 3) * 0.15; M.cadI.rotation.set(s, 0, 0); M.cadD.rotation.set(-s, 0, 0); M.rodI.rotation.x = M.rodD.rotation.x = -0.3; return;
  }
  if (p.nadando) {
    ponerEnMano(M, null); M.cuerpo.rotation.x = -1.2; M.cuerpo.position.y = 0.35;
    const s = Math.sin(t * 5); M.hombroI.rotation.set(1.6 + s * 1.2, 0, -0.3); M.hombroD.rotation.set(1.6 - s * 1.2, 0, 0.3); M.codoI.rotation.x = M.codoD.rotation.x = 0.3;
    M.cadI.rotation.set(s * 0.4, 0, 0); M.cadD.rotation.set(-s * 0.4, 0, 0); M.rodI.rotation.x = M.rodD.rotation.x = -0.2; return;
  }
  if (p.baila) {
    ponerEnMano(M, null); const s = Math.sin(t * 8);
    M.cuerpo.rotation.y = Math.sin(t * 4) * 0.5; M.cuerpo.position.y = 0.95 + Math.abs(s) * 0.08;
    M.hombroI.rotation.set(2.6 + s * 0.4, 0, 0.5); M.hombroD.rotation.set(2.6 - s * 0.4, 0, -0.5); M.codoI.rotation.x = M.codoD.rotation.x = 0.6;
    M.cadI.rotation.set(s * 0.3, 0, 0); M.cadD.rotation.set(-s * 0.3, 0, 0); M.rodI.rotation.x = M.rodD.rotation.x = -0.3; return;
  }
  const vel = Math.hypot(p.vx, p.vz), k = Math.min(1, vel / 3), baja = p.agachado ? 0.32 : 0;
  p.fase += vel * dt * (p.corriendo ? 1.55 : 1.75);
  const s = Math.sin(p.fase);
  if (p.deslizando) {
    M.cuerpo.rotation.x = 0.55; M.cuerpo.position.y = 0.55;
    M.cadI.rotation.set(-1.1, 0, 0); M.cadD.rotation.set(-0.7, 0, 0); M.rodI.rotation.x = -0.2; M.rodD.rotation.x = -0.9;
  } else if (p.trepando > 0) {
    M.hombroI.rotation.set(2.8, 0, 0.3); M.hombroD.rotation.set(2.8, 0, -0.3); M.codoI.rotation.x = M.codoD.rotation.x = 0.8;
    M.cadI.rotation.set(1.0, 0, 0); M.cadD.rotation.set(0.3, 0, 0); M.rodI.rotation.x = -1.4; M.rodD.rotation.x = -0.6; ponerEnMano(M, null); return;
  } else if (p.enSuelo) {
    const amp = (p.corriendo ? 0.95 : 0.75) * k;
    M.cadI.rotation.set(s * amp - baja * 1.6, 0, 0); M.cadD.rotation.set(-s * amp - baja * 1.6, 0, 0);
    M.rodI.rotation.x = -Math.max(0, Math.sin(p.fase + 1.3)) * 1.1 * k - baja * 2.2; M.rodD.rotation.x = -Math.max(0, Math.sin(p.fase + 1.3 + Math.PI)) * 1.1 * k - baja * 2.2;
    M.cuerpo.position.y = 0.95 - baja + Math.abs(Math.cos(p.fase)) * 0.035 * k;
    M.cuerpo.rotation.x = p.corriendo ? -0.15 : baja * 0.4;
  } else { M.cadI.rotation.set(0.6, 0, 0); M.cadD.rotation.set(-0.15, 0, 0); M.rodI.rotation.x = -0.9; M.rodD.rotation.x = -0.4; }
  const pt = p.pitch;
  if (!cosa) { ponerEnMano(M, null); M.hombroI.rotation.set(s * 0.5 * k, 0, 0.1); M.hombroD.rotation.set(-s * 0.5 * k, 0, -0.1); M.codoI.rotation.x = M.codoD.rotation.x = 0.3; return; }
  ponerEnMano(M, cosa.clave, cosa.rareza);
  M.mano.rotation.set(0, 0, 0); M.mano.position.set(0.1, 0.46, -0.2);
  if (cosa.clave === "pico") {
    const g = p.golpe > 0 ? Math.sin((1 - p.golpe / 0.45) * Math.PI) : 0;
    M.hombroD.rotation.set(0.9 + g * 1.3 - (1 - g) * 0.2, 0, -0.2); M.codoD.rotation.set(0.6 - g * 0.5, 0, 0);
    M.hombroI.rotation.set(s * 0.5 * k, 0, 0.1); M.codoI.rotation.x = 0.3;
    M.mano.position.set(0.22, 0.2 + g * 0.1, -0.2 - g * 0.3); M.mano.rotation.set(-0.4 - g * 1.6, 0, 0);
  } else if (CONSUMIBLES[cosa.clave]) {
    const c = p.curando ? Math.sin(t * 6) * 0.1 : 0;
    M.hombroD.rotation.set(0.9 + c, 0, -0.35); M.codoD.rotation.set(1.3, 0, 0); M.hombroI.rotation.set(0.9 - c, 0, 0.35); M.codoI.rotation.set(1.3, 0, 0);
    M.mano.position.set(0, 0.42, -0.32);
  } else if (p.corriendo && !p.apuntando) {
    // Corriendo, el arma va baja y los brazos acompañan.
    M.hombroD.rotation.set(0.2 - s * 0.3, 0, -0.3); M.codoD.rotation.set(1.3, 0, 0); M.hombroI.rotation.set(0.5 + s * 0.3, 0, 0.5); M.codoI.rotation.set(1.0, 0, 0);
    M.mano.rotation.x = -0.7; M.mano.position.set(0.12, 0.3, -0.12);
  } else if (cosa.clave === "pistola") {
    M.hombroD.rotation.set(1.45 + pt, 0, -0.1); M.codoD.rotation.set(0.1, 0, 0); M.hombroI.rotation.set(1.35 + pt, 0, 0.45); M.codoI.rotation.set(0.35, 0, 0);
    M.mano.position.set(0.06, 0.52, -0.52); M.mano.rotation.x = pt;
  } else { brazosArma(pt); M.mano.rotation.x = pt; M.mano.position.z = -0.2 + p.patada * 0.07; }
  M.cabeza.rotation.x = pt * 0.6;
}

// ════════════════════════════════════════════════════════════════════════
// El vestíbulo: el personaje parado en una tarima con luz de escenario
// ════════════════════════════════════════════════════════════════════════
function crearVestibulo() {
  const escena = new THREE.Scene();
  const fondo = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vP; uniform float uT;
      void main() {
        float y = vP.y * 0.5 + 0.5; vec3 c = mix(vec3(0.16, 0.08, 0.42), vec3(0.2, 0.55, 1.0), smoothstep(0.2, 0.9, y));
        float rayos = pow(0.5 + 0.5 * sin(atan(vP.x, vP.z) * 14.0 + uT * 0.2), 6.0) * smoothstep(0.35, 0.8, y) * 0.25;
        c += vec3(0.9, 0.7, 1.0) * rayos;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  escena.add(fondo);
  escena.add(new THREE.HemisphereLight(0xb8d8ff, 0x3a2a6a, 1.1));
  const clave = new THREE.DirectionalLight(0xfff2de, 2.6); clave.position.set(2, 4, 3); clave.castShadow = true; clave.shadow.mapSize.set(1024, 1024);
  clave.shadow.camera.left = clave.shadow.camera.bottom = -3; clave.shadow.camera.right = clave.shadow.camera.top = 3; escena.add(clave);
  const contra = new THREE.DirectionalLight(0x7fb8ff, 2.2); contra.position.set(-3, 2, -3); escena.add(contra);
  const tarima = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.3, 48), new THREE.MeshStandardMaterial({ color: "#2b2f55", roughness: 0.4, metalness: 0.3 }));
  tarima.position.y = -0.15; tarima.receiveShadow = true; escena.add(tarima);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: "#ffc62e" })); aro.rotation.x = Math.PI / 2; aro.position.y = 0.01; escena.add(aro);
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 100); camara.position.set(0, 1.35, 5.2); camara.lookAt(0, 1.0, 0);
  let personaje = null, trajeActual = -1, giro = Math.PI - 0.35; // de frente a la cámara
  const falso = { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.05, vx: 0, vz: 0, vivo: true, estado: "tierra", enSuelo: true, fase: 0, patada: 0, golpe: 0, muerte: 0, enMano: () => null };
  return {
    escena, camara,
    girar(d) { giro += d; },
    actualizar(dt, t, traje) {
      if (traje !== trajeActual) { if (personaje) escena.remove(personaje.raiz); personaje = crearPersonaje(TRAJES[traje]); escena.add(personaje.raiz); trajeActual = traje; falso.malla = personaje; }
      fondo.material.uniforms.uT.value = t;
      falso.yaw = giro + Math.sin(t * 0.4) * 0.15;
      animar(falso, dt, t);
      // Respira y cambia el peso de pierna.
      personaje.cuerpo.position.y = 0.95 + Math.sin(t * 1.8) * 0.01; personaje.cabeza.rotation.y = Math.sin(t * 0.7) * 0.25;
      personaje.hombroI.rotation.set(0.05, 0, 0.12 + Math.sin(t * 1.8) * 0.02); personaje.hombroD.rotation.set(0.05, 0, -0.12 - Math.sin(t * 1.8) * 0.02); personaje.codoI.rotation.x = personaje.codoD.rotation.x = 0.2;
    },
  };
}
