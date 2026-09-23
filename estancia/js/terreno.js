// El terreno: tierra colorada, pasto seco, una zanja, un estero.
//
// El Chaco es plano: lomas de un metro y medio en cientos de metros. Lo que
// cambia el paisaje es lo que está encima (el monte, el pasto, el agua), no
// la altura.
//
// Una sola rejilla para la malla y para la física, interpolada por triángulo
// como la dibuja la placa (GUIA-JUEGOS.md § 6.4). La rejilla no es pareja:
// cada 3 m donde se juega (±420) y cada 12 m afuera, que es monte que solo
// está para que el horizonte no termine en el alambrado.
"use strict";
(() => {
  const T = (E.terreno = {});

  // Los lugares de la estancia, en metros. El norte es -z.
  const L = (E.lugares = {
    rancho: { x: 0, z: 22 },
    fogon: { x: 11, z: 36 },
    corral: { x: 42, z: 8, r: 12, puerta: Math.PI },   // la tranquera mira al rancho (-x)
    manga: { x0: 54, x1: 64, z: 8, ancho: 0.95 },
    tanque: { x: -36, z: -6, r: 5 },
    estero: { x: -165, z: -175, r: 52 },
    tranquera: { x: 0, z: 392 },
    limite: 390,                                          // el alambrado perimetral
    centro: { x: 14, z: 12 },                             // lo aplanado de la estancia
  });
  // La zanja cruza el campo de este a oeste al norte de las casas, con un vado
  // cerca de x = 10: para traer una vaca del monte hay que buscarlo o
  // meterla por el barro.
  const ZANJA = [[-440, -58], [-210, -96], [-40, -72], [120, -112], [300, -80], [440, -96]];
  const VADO = { x: 12, ancho: 9 };
  T.nivelAgua = -1.45;

  function distSeg(px, pz, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
    const t = E.clamp((wx * vx + wz * vz) / (vx * vx + vz * vz), 0, 1);
    return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
  }
  T.distZanja = (x, z) => {
    let d = 1e9;
    for (let i = 0; i < ZANJA.length - 1; i++) d = Math.min(d, distSeg(x, z, ZANJA[i][0], ZANJA[i][1], ZANJA[i + 1][0], ZANJA[i + 1][1]));
    return d;
  };
  T.enVado = (x) => Math.abs(x - VADO.x) < VADO.ancho;
  T.distCamino = (x, z) => (z < L.rancho.z + 12 ? 1e9 : Math.abs(x - 2.5 * Math.sin(z * 0.012)));
  T.distEstancia = (x, z) => Math.hypot(x - L.centro.x, z - L.centro.z);
  T.estero = (x, z) => {
    const a = Math.atan2(z - L.estero.z, x - L.estero.x);
    const r = L.estero.r * (1 + 0.18 * Math.sin(a * 3 + 1.2) + 0.1 * Math.sin(a * 7));
    return Math.hypot(x - L.estero.x, z - L.estero.z) / r;           // < 1 adentro
  };

  // Qué tan monte es un lugar (0 campo abierto, 1 monte cerrado). Lo usan la
  // flora para sembrar y el suelo para oscurecerse debajo de las copas.
  T.monte = (x, z) => {
    let m = E.suave(0.47, 0.62, E.fbm(x * 0.0052 + 11, z * 0.0052 - 3, 4));
    m *= E.suave(70, 110, T.distEstancia(x, z));
    m *= E.suave(7, 16, T.distCamino(x, z));
    m *= E.suave(1.05, 1.35, T.estero(x, z));
    m *= E.suave(4, 9, T.distZanja(x, z));
    return m;
  };

  // El pasto: manchas grandes, menos debajo del monte (hojarasca y sombra),
  // nada en el camino ni donde pisa la hacienda (corral, rancho, tanque). Lo
  // usan el suelo y las matas de pasto, así coinciden.
  T.pasto = (x, z, m = T.monte(x, z)) => {
    let p = E.suave(0.32, 0.62, E.fbm(x * 0.018 + 5, z * 0.018, 3));
    p = E.lerp(p, 0.15, m * 0.8);
    p *= E.suave(2.5, 6, T.distCamino(x, z));
    p *= E.suave(14, 22, Math.hypot(x - L.corral.x, z - L.corral.z));
    p *= E.suave(10, 18, Math.hypot(x - L.rancho.x, z - L.rancho.z));
    p *= E.suave(8, 14, Math.hypot(x - L.tanque.x, z - L.tanque.z));
    return p * E.suave(0.9, 1.25, T.estero(x, z));
  };

  function alturaCruda(x, z) {
    let h = (E.fbm(x * 0.0035, z * 0.0035, 4) - 0.5) * 3.2 + (E.fbm(x * 0.03, z * 0.03, 2) - 0.5) * 0.35;
    const hEst = 0.2;
    h = E.lerp(h, hEst, 1 - E.suave(58, 88, T.distEstancia(x, z)));
    const dz = T.distZanja(x, z);
    const hondo = T.enVado(x) ? 0.35 : 1.9;
    h -= hondo * Math.exp(-((dz / 2.4) ** 2));
    h += 0.28 * Math.exp(-(((dz - 4.2) / 1.5) ** 2));               // la tierra sacada, a los costados
    const de = T.estero(x, z);
    if (de < 1.4) h = E.lerp(h, T.nivelAgua - 1.0 * (1 - Math.min(de, 1) ** 2) + 0.35, 1 - E.suave(0.8, 1.35, de));
    return h;
  }

  // La rejilla desigual: coordenadas de columna por tramos.
  function ejes() {
    const xs = [];
    for (let x = -800; x < -420; x += 12) xs.push(x);
    for (let x = -420; x < 420; x += 3) xs.push(x);
    for (let x = 420; x <= 800; x += 12) xs.push(x);
    return xs;
  }
  const XS = ejes(), N = XS.length;
  function indice(v) {
    if (v <= -800) return 0;
    if (v >= 800) return N - 2;
    if (v < -420) return Math.floor((v + 800) / 12);
    if (v < 420) return 32 + Math.floor((v + 420) / 3);
    return Math.min(N - 2, 312 + Math.floor((v - 420) / 12));
  }

  T.construir = () => {
    const H = (T.H = new Float32Array(N * N));
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = alturaCruda(XS[i], XS[j]);

    const pos = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
    const mez = new Float32Array(N * N), hum = new Float32Array(N * N), mon = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = XS[i], z = XS[j];
      pos[k * 3] = x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
      const m = T.monte(x, z);
      mon[k] = m;
      mez[k] = T.pasto(x, z, m);
      const de = T.estero(x, z);
      hum[k] = Math.max(E.suave(1.3, 0.97, de), 0.85 * Math.exp(-((T.distZanja(x, z) / 2.2) ** 2)));
    }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let o = 0;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      // Diagonal de c a b, la misma que usa altura(): (i, j+1) a (i+1, j).
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = c; idx[o++] = d; idx[o++] = b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("aMezcla", new THREE.BufferAttribute(mez, 1));
    g.setAttribute("aHumedo", new THREE.BufferAttribute(hum, 1));
    g.setAttribute("aMonte", new THREE.BufferAttribute(mon, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: E.textura("suelo.webp"), normalMap: E.textura("suelo-n.webp", { srgb: false }),
      normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.96, metalness: 0,
    });
    const pasto = E.textura("pasto.webp"), pastoN = E.textura("pasto-n.webp", { srgb: false });
    // El barro de Rezona para la orilla del estero y los bajos; si no está,
    // el suelo oscurecido hace de barro.
    const hayBarro = !!(window.ARCHIVOS && ARCHIVOS["barro.webp"]);
    const barro = hayBarro ? E.textura("barro.webp") : pasto;
    // Mezcla por altura: gana la textura que "sobresale" en cada pixel. Un
    // degradé parejo parece pintura aguada. Y contra la repetición, cada
    // textura mezclada con ella misma girada y a otra escala según un ruido
    // grande (§ 6.4).
    E.parchear(mat, "terreno", (sh) => {
      sh.uniforms.mapPasto = { value: pasto };
      sh.uniforms.normalPasto = { value: pastoN };
      sh.uniforms.mapBarro = { value: barro };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aMezcla, aHumedo, aMonte;\nvarying float vMezcla, vHumedo, vMonte;\nvarying vec2 vMundo;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMezcla = aMezcla; vHumedo = aHumedo; vMonte = aMonte; vMundo = position.xz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          uniform sampler2D mapPasto, normalPasto, mapBarro;
          varying float vMezcla, vHumedo, vMonte;
          varying vec2 vMundo;
          float th2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float trn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(th2(i), th2(i+vec2(1,0)), f.x), mix(th2(i+vec2(0,1)), th2(i+vec2(1,1)), f.x), f.y); }
          vec2 girar(vec2 p){ return mat2(0.8, -0.6, 0.6, 0.8) * p * 0.73 + vec2(0.37, 0.61); }`)
        .replace("#include <map_fragment>", `
          float nG = trn(vMundo * 0.021);
          vec2 uvA = vMapUv, uvB = girar(vMapUv);
          vec4 cS = mix(texture2D(map, uvA), texture2D(map, uvB), smoothstep(0.35, 0.65, nG));
          vec4 cP = mix(texture2D(mapPasto, uvA * 0.9), texture2D(mapPasto, uvB * 1.1), smoothstep(0.35, 0.65, nG));
          float alS = dot(cS.rgb, vec3(0.33)), alP = dot(cP.rgb, vec3(0.33));
          float mPasto = smoothstep(-0.12, 0.12, (vMezcla - 0.5) * 1.3 + (alP - alS) * 0.9);
          vec4 cSuelo = mix(cS, cP, mPasto);
          cSuelo.rgb *= 0.86 + 0.26 * trn(vMundo * 0.045 + 7.0);             // variación de tono cada decenas de metros
          ${hayBarro ? `vec4 cB = texture2D(mapBarro, uvA * 1.3);
          float mB = smoothstep(-0.1, 0.1, (vHumedo - 0.45) * 1.4 + (dot(cB.rgb, vec3(0.33)) - dot(cSuelo.rgb, vec3(0.33))) * 0.7);
          cSuelo = mix(cSuelo, cB, mB);
          cSuelo.rgb *= mix(1.0, 0.75, vHumedo);` : "cSuelo.rgb *= mix(1.0, 0.5, vHumedo);"}           // barro húmedo, más oscuro
          cSuelo.rgb *= mix(1.0, 0.8, vMonte);                                // debajo de las copas
          diffuseColor *= cSuelo;`)
        .replace("#include <normal_fragment_maps>", `
          vec3 nS = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          vec3 nP = texture2D(normalPasto, vNormalMapUv * 0.9).xyz * 2.0 - 1.0;
          vec3 mapN = normalize(mix(nS, nP, mPasto));
          mapN.xy *= normalScale * (1.0 - vHumedo * 0.6);
          normal = normalize(tbn * mapN);`)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.35, vHumedo * 0.8);");
    });
    const malla = (T.malla = new THREE.Mesh(g, mat));
    malla.receiveShadow = true;
    E.motor.escena.add(malla);
    T.crearAgua();
  };

  // Altura por triángulo, igual que la malla.
  T.altura = (x, z) => {
    const i = indice(x), j = indice(z);
    const x0 = XS[i], x1 = XS[i + 1], z0 = XS[j], z1 = XS[j + 1];
    const u = E.clamp((x - x0) / (x1 - x0), 0, 1), v = E.clamp((z - z0) / (z1 - z0), 0, 1);
    const H = T.H, a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
    // triángulo (a, c, b) si u + v <= 1; si no (c, d, b)
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
  T.normal = (x, z, destino) => {
    const e = 0.6;
    const hx = T.altura(x + e, z) - T.altura(x - e, z), hz = T.altura(x, z + e) - T.altura(x, z - e);
    return destino.set(-hx, 2 * e, -hz).normalize();
  };
  // Profundidad del agua en ese punto (0 si está seco).
  T.agua = (x, z) => Math.max(0, T.nivelAgua - T.altura(x, z));
  // El barro y el agua frenan: 1 en seco, hasta 0,45 en el estero hondo.
  T.freno = (x, z) => {
    const p = T.agua(x, z);
    const dz = T.distZanja(x, z);
    const zanja = T.enVado(x) ? 0 : Math.exp(-((dz / 2.2) ** 2));
    return E.clamp(1 - p * 0.9 - zanja * 0.45, 0.4, 1);
  };

  // ── el estero ── Reflejo del cielo con Fresnel y olas chicas que viajan.
  T.crearAgua = () => {
    const u = E.motor.cielo.material.uniforms;
    const mat = new THREE.ShaderMaterial({
      transparent: true, fog: true, depthWrite: false,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTiempo: { value: 0 }, uZenit: { value: u.uZenit.value }, uHoriz: { value: u.uHoriz.value },
        uBrillo: { value: u.uBrillo.value }, uSolDir: { value: u.uSolDir.value },
      }]),
      vertexShader: `#include <fog_pars_vertex>
        varying vec3 vMundo;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vMundo = w.xyz;
          vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `#include <fog_pars_fragment>
        uniform float uTiempo; uniform vec3 uZenit, uHoriz, uBrillo, uSolDir;
        varying vec3 vMundo;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec3 v = normalize(cameraPosition - vMundo);
          float dist = length(cameraPosition - vMundo);
          // Olas aplanadas con la distancia: si no, el reflejo titila en manchones.
          float amp = 0.06 / (1.0 + dist * 0.05);
          vec2 p = vMundo.xz;
          float a = rn(p * 0.9 + vec2(uTiempo * 0.35, uTiempo * 0.2)) + rn(p * 2.3 - vec2(uTiempo * 0.5, -uTiempo * 0.3)) * 0.5;
          float b = rn(p * 0.9 + vec2(4.1, uTiempo * 0.3)) + rn(p * 2.3 + vec2(uTiempo * 0.45, 2.7)) * 0.5;
          vec3 n = normalize(vec3((a - 0.75) * amp * 8.0, 1.0, (b - 0.75) * amp * 8.0));
          vec3 r = reflect(-v, n);
          vec3 cielo = mix(uHoriz, uZenit, pow(clamp(r.y, 0.0, 1.0), 0.6));
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(v, n), 0.0), 5.0);
          vec3 fondo = vec3(0.055, 0.05, 0.03);                // agua de estero: té con barro
          vec3 col = mix(fondo, cielo * 0.9, fres);
          col += uBrillo * pow(max(dot(r, uSolDir), 0.0), 350.0) * 12.0;
          gl_FragColor = vec4(col, 0.93);
          #include <fog_fragment>
        }`,
    });
    const agua = (T.aguaMalla = new THREE.Mesh(new THREE.CircleGeometry(L.estero.r * 1.5, 72), mat));
    agua.rotation.x = -Math.PI / 2;
    agua.position.set(L.estero.x, T.nivelAgua, L.estero.z);
    E.motor.escena.add(agua);
  };
  T.actualizar = (t) => { if (T.aguaMalla) T.aguaMalla.material.uniforms.uTiempo.value = t; };
})();
