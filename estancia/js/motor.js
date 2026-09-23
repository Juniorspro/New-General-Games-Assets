// El motor: renderer, cielo, sol, niebla y la pasada final.
//
// La regla de GUIA-JUEGOS.md § 0: se ve bien por la luz. Un sol que manda (la
// luz ambiente nunca le gana sobre el suelo), niebla del mismo color que el
// horizonte, HDR con AgX al final y un post con identidad. Acá la identidad
// es el calor: el aire tiembla sobre el campo lejano a la siesta.
"use strict";
(() => {
  const M = (E.motor = {});

  // La hora del día manda todo. Claves por elevación del sol, en grados:
  //                 -12        -4         2          8          20         45
  const CLAVES = {
    e:      [-12, -4, 2, 8, 20, 45],
    zenit:  ["#04060c", "#101a34", "#2a4879", "#3a67a4", "#4474b2", "#4978b4"],
    horiz:  ["#080a12", "#5e4454", "#d0865a", "#dcae84", "#c6c4ba", "#bcc1bf"],
    brillo: ["#000000", "#ff5a22", "#ff7f36", "#ffab68", "#ffe9c8", "#fff2dc"],
    sol:    ["#000000", "#000000", "#ff8e4a", "#ffbe82", "#ffeed8", "#fff5e8"],
    solI:   [0, 0, 1.3, 3.1, 4.3, 4.9],
    hemiI:  [0.05, 0.1, 0.28, 0.42, 0.52, 0.58],
  };
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  function clave(nombre, e, destino) {
    const k = CLAVES.e;
    let i = 0;
    while (i < k.length - 2 && e > k[i + 1]) i++;
    const t = E.clamp((e - k[i]) / (k[i + 1] - k[i]), 0, 1);
    const v = CLAVES[nombre];
    if (typeof v[0] === "number") return E.lerp(v[i], v[i + 1], t);
    tmpA.set(v[i]); tmpB.set(v[i + 1]);
    return destino.copy(tmpA).lerp(tmpB, t);
  }

  M.iniciar = (lienzo) => {
    const r = (M.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: "high-performance" }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    // El tono lo pone la pasada final (AgX); la escena se dibuja lineal en HDR.
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.info.autoReset = false;

    M.escena = new THREE.Scene();
    M.camara = new THREE.PerspectiveCamera(70, 1, 0.12, 4000);
    M.escena.fog = new THREE.FogExp2(0xbcc1bf, 0.002);

    // Sol que manda, con sombra en una caja que sigue al jugador de a un texel.
    M.sol = new THREE.DirectionalLight(0xffffff, 4);
    M.sol.castShadow = true;
    M.sol.shadow.mapSize.set(2048, 2048);
    const sc = M.sol.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400;
    M.sol.shadow.bias = -0.0006;
    M.sol.shadow.normalBias = 0.05;
    M.escena.add(M.sol, M.sol.target);
    M.hemi = new THREE.HemisphereLight(0x8fa3bd, 0x3a2418, 0.5);
    M.escena.add(M.hemi);
    // Luna: un relleno azul muy bajo para que la noche no sea negro puro.
    M.luna = new THREE.DirectionalLight(0x6f86b8, 0);
    M.luna.position.set(-40, 80, 30);
    M.escena.add(M.luna);

    M.crearCielo();
    M.crearPost();
    M.dirSol = new THREE.Vector3(0, 1, 0);
    M.calor = 0;
    M.escala = matchMedia("(pointer: coarse)").matches ? 0.7 : 1;
    M.lento = 0;
  };

  // ── el cielo ──
  M.crearCielo = () => {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uZenit: { value: new THREE.Color() }, uHoriz: { value: new THREE.Color() },
        uBrillo: { value: new THREE.Color() }, uSolDir: { value: new THREE.Vector3(0, 1, 0) },
        uSolI: { value: 1 }, uNoche: { value: 0 }, uTiempo: { value: 0 }, uNubes: { value: 0.35 },
      },
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uZenit, uHoriz, uBrillo, uSolDir; uniform float uSolI, uNoche, uTiempo, uNubes;
        varying vec3 vDir;
        float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * rn(p); p *= 2.07; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          float t = pow(1.0 - max(h, 0.0), 4.0);
          vec3 col = mix(uZenit, uHoriz, t);
          float cs = max(dot(d, uSolDir), 0.0);
          // El resplandor del sol se abre sobre el horizonte: al amanecer tiñe
          // media bóveda, a mediodía es solo un halo.
          col += uBrillo * (pow(cs, 10.0) * 0.55 + pow(cs, 2.5) * 0.35 * t);
          if (h < 0.0) col = mix(uHoriz, uHoriz * 0.55, clamp(-h * 5.0, 0.0, 1.0));
          // Nubes de cúmulo bajas, proyectadas sobre un techo plano.
          if (h > 0.01) {
            vec2 uv = d.xz / (h + 0.08) * 0.9 + vec2(uTiempo * 0.004, uTiempo * 0.0015);
            float n = fbm(uv);
            float c = smoothstep(0.62 - uNubes * 0.25, 0.85, n) * smoothstep(0.01, 0.25, h);
            vec3 cn = mix(uHoriz * 1.15 + uZenit * 0.2, uBrillo * 1.3 + uHoriz * 0.4, pow(cs, 3.0));
            cn *= 0.75 + 0.35 * smoothstep(0.55, 0.9, n);
            col = mix(col, cn, c * 0.85);
          }
          // El disco del sol, en HDR: satura como una cámara.
          col += uBrillo * smoothstep(0.99955, 0.99985, cs) * 30.0 * uSolI;
          if (uNoche > 0.0 && h > 0.0) {
            vec3 p = floor(d * 380.0);
            float s = step(0.9982, h3(p)) * (0.5 + 0.5 * sin(uTiempo * 3.0 + h3(p + 1.0) * 60.0));
            col += vec3(s) * uNoche * 1.4 * smoothstep(0.0, 0.3, h);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    M.cielo = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat);
    M.cielo.renderOrder = -10;
    M.cielo.frustumCulled = false;
    M.escena.add(M.cielo);
  };

  // ── la hora ──
  // Verano chaqueño: sale a las 6, se pone a las 19:30, a mediodía el sol casi
  // encima (27° de latitud sur, 86° de elevación). El norte es -z.
  M.solDe = (hora) => {
    const f = (hora - 6) / 13.5;
    const e = f >= -0.15 && f <= 1.15 ? 86 * Math.sin(Math.PI * E.clamp(f, -0.15, 1.15)) : -30;
    const az = Math.PI * f;
    const er = (e * Math.PI) / 180;
    return { e, dir: new THREE.Vector3(Math.cos(az) * Math.cos(er), Math.sin(er), -Math.sin(az) * Math.cos(er)).normalize() };
  };
  M.temperatura = (hora) => 23 + 17 * Math.pow(Math.max(0, Math.sin((Math.PI * (hora - 8)) / 14)), 1.2);

  const colH = new THREE.Color(), colB = new THREE.Color(), colS = new THREE.Color(), colZ = new THREE.Color();
  M.actualizarHora = (hora, t) => {
    const { e, dir } = M.solDe(hora);
    M.dirSol.copy(dir);
    M.elevacion = e;
    const u = M.cielo.material.uniforms;
    clave("zenit", e, colZ); clave("horiz", e, colH); clave("brillo", e, colB); clave("sol", e, colS);
    u.uZenit.value.copy(colZ); u.uHoriz.value.copy(colH); u.uBrillo.value.copy(colB);
    u.uSolDir.value.copy(dir); u.uSolI.value = E.suave(-3, 4, e);
    u.uNoche.value = 1 - E.suave(-10, -2, e);
    u.uTiempo.value = t;
    M.sol.color.copy(colS);
    M.sol.intensity = clave("solI", e);
    M.hemi.intensity = clave("hemiI", e);
    M.hemi.color.copy(colZ).lerp(colH, 0.4);
    M.luna.intensity = 0.18 * (1 - E.suave(-8, 0, e));
    M.temp = M.temperatura(hora);
    M.calor = E.suave(31, 40, M.temp);
    // La niebla es el horizonte, un poco teñida hacia el sol. Si no coincide,
    // el horizonte se ve como la línea donde termina el mundo. A la siesta,
    // con el polvo, se cierra un poco más.
    M.escena.fog.color.copy(colH).lerp(colB, 0.18);
    M.escena.fog.density = 0.0017 + 0.0011 * M.calor + 0.0012 * (1 - E.suave(-6, 6, e));
  };

  // Caja de sombra que sigue al jugador de a un texel: si se mueve de forma
  // continua, cada cuadro el mapa cae medio pixel corrido y los bordes titilan.
  const der = new THREE.Vector3(), arr = new THREE.Vector3(), foco = new THREE.Vector3();
  M.seguirSombra = (p) => {
    const d = M.dirSol.y > 0.05 ? M.dirSol : foco.set(0.3, 0.9, -0.3).normalize();
    der.set(0, 1, 0).cross(d).normalize();
    if (der.lengthSq() < 1e-4) der.set(1, 0, 0);
    arr.copy(d).cross(der).normalize();
    const texel = 110 / 2048;
    const a = Math.round(p.dot(der) / texel) * texel, b = Math.round(p.dot(arr) / texel) * texel, c = p.dot(d);
    foco.copy(der).multiplyScalar(a).addScaledVector(arr, b).addScaledVector(d, c);
    M.sol.target.position.copy(foco);
    M.sol.position.copy(foco).addScaledVector(d, 150);
    M.sol.target.updateMatrixWorld();
  };

  // ── la pasada final ──
  M.crearPost = () => {
    M.rt = null;
    M.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tProf: { value: null }, uCerca: { value: 0.12 }, uLejos: { value: 4000 },
        uTiempo: { value: 0 }, uCalor: { value: 0 }, uSed: { value: 0 }, uDolor: { value: 0 },
        uNegro: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform sampler2D tColor, tProf; uniform float uCerca, uLejos, uTiempo, uCalor, uSed, uDolor, uNegro; uniform vec2 uRes;
        varying vec2 vUv;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
        float distancia(float z){ float n = z * 2.0 - 1.0; return 2.0 * uCerca * uLejos / (uLejos + uCerca - n * (uLejos - uCerca)); }
        void main(){
          vec2 uv = vUv;
          // Calor: el aire tiembla sobre lo lejano, sobre todo en la franja del
          // horizonte. Se mide con la profundidad: lo cercano no tiembla.
          float d = distancia(texture2D(tProf, uv).x);
          float lejos = smoothstep(18.0, 220.0, d) * (1.0 - smoothstep(0.62, 0.85, uv.y));
          vec2 onda = vec2(rn(uv * vec2(14.0, 70.0) + vec2(0.0, uTiempo * 1.7)), rn(uv * vec2(11.0, 55.0) - vec2(uTiempo * 0.4, uTiempo * 1.3))) - 0.5;
          uv += onda * 0.0045 * uCalor * lejos;
          vec3 col = texture2D(tColor, uv).rgb;
          // Sed: se borronea y se destiñe.
          if (uSed > 0.001) {
            vec2 px = 1.0 / uRes * (1.0 + 5.0 * uSed);
            vec3 b = (texture2D(tColor, uv + vec2(px.x, 0.0)).rgb + texture2D(tColor, uv - vec2(px.x, 0.0)).rgb +
                      texture2D(tColor, uv + vec2(0.0, px.y)).rgb + texture2D(tColor, uv - vec2(0.0, px.y)).rgb) * 0.25;
            col = mix(col, b, uSed);
            col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), uSed * 0.6);
          }
          float v = length((vUv - 0.5) * vec2(1.25, 1.0));
          col *= mix(1.0, smoothstep(1.05, 0.25, v), 0.5 + uSed * 0.4);
          col = mix(col, col * vec3(1.4, 0.35, 0.3), uDolor * smoothstep(0.2, 0.9, v));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          // Grano de película, en el espacio de la pantalla y ya revelado.
          gl_FragColor.rgb += (h2(vUv * uRes + fract(uTiempo) * 91.7) - 0.5) * 0.045;
          gl_FragColor.rgb *= 1.0 - uNegro;
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), M.postMat);
    quad.frustumCulled = false;
    M.postEscena = new THREE.Scene();
    M.postEscena.add(quad);
    M.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  };

  // El lienzo se cambia de tamaño al EMPEZAR el cuadro: cambiarlo lo borra, y
  // hecho después de dibujar, el navegador muestra un cuadro negro.
  M.acomodar = () => {
    const r = M.renderer, lienzo = r.domElement;
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h) return;
    const pr = Math.min(devicePixelRatio || 1, 2) * M.escala;
    const W = Math.round(w * pr), H = Math.round(h * pr);
    if (!M.rt || M.rt.width !== W || M.rt.height !== H) {
      r.setSize(w, h, false);
      r.setPixelRatio(pr);
      if (M.rt) M.rt.dispose();
      const hdr = r.capabilities.isWebGL2;
      M.rt = new THREE.WebGLRenderTarget(W, H, {
        type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
        depthTexture: new THREE.DepthTexture(W, H),
      });
      M.postMat.uniforms.tColor.value = M.rt.texture;
      M.postMat.uniforms.tProf.value = M.rt.depthTexture;
      M.postMat.uniforms.uRes.value.set(W, H);
      M.camara.aspect = w / h;
      // Campo fijo en horizontal: con el vertical fijo, en un teléfono parado
      // se ve una rodaja del mundo (GUIA-JUEGOS.md § 6.8).
      const horiz = (78 * Math.PI) / 180;
      M.camara.fov = E.clamp((2 * Math.atan(Math.tan(horiz / 2) / M.camara.aspect) * 180) / Math.PI, 50, 95);
      M.camara.updateProjectionMatrix();
    }
  };

  // Resolución que se adapta: si el cuadro pasa de 40 ms durante 2 s, baja.
  M.medir = (dtReal, fijo) => {
    if (fijo) return;
    if (dtReal > 0.04) M.lento += dtReal; else M.lento = Math.max(0, M.lento - dtReal * 0.5);
    if (M.lento > 2 && M.escala > 0.6) { M.escala = Math.max(0.6, M.escala - 0.1); M.lento = 0; }
  };

  M.dibujar = (t, efectos) => {
    const r = M.renderer, u = M.postMat.uniforms;
    r.info.reset();
    M.cielo.position.copy(M.camara.position);
    r.setRenderTarget(M.rt);
    r.render(M.escena, M.camara);
    r.setRenderTarget(null);
    u.uTiempo.value = t; u.uCalor.value = M.calor;
    u.uCerca.value = M.camara.near; u.uLejos.value = M.camara.far;
    u.uSed.value = efectos.sed || 0; u.uDolor.value = efectos.dolor || 0; u.uNegro.value = efectos.negro || 0;
    r.render(M.postEscena, M.postCam);
  };
})();
