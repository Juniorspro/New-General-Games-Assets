// El monte chaqueño: quebrachos, algarrobos, arbustos y pasto.
//
// GUIA-JUEGOS.md § 6.5: no se generan árboles enteros en 3D (la copa sale como
// un repollo). El esqueleto va por código y las hojas en tarjetas del tamaño de
// una ramita de verdad, con normales hacia afuera del tronco, oscuridad
// interior por color de vértice, contraluz, viento igual para tronco y copa, y
// alfa nítido en todos los mips.
"use strict";
(() => {
  const F = (E.flora = { arboles: [], choques: new Map() });
  const CELDA_CHOQUE = 10;

  // ── las hojas, dibujadas ──
  function ramita(g, x0, y0, ang, largo, grosor, colorTallo) {
    const x1 = x0 + Math.cos(ang) * largo, y1 = y0 + Math.sin(ang) * largo;
    g.strokeStyle = colorTallo; g.lineWidth = grosor; g.lineCap = "round";
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + Math.cos(ang + 1.3) * largo * 0.08, (y0 + y1) / 2, x1, y1); g.stroke();
    return [x1, y1];
  }
  function tarjetaHojas(tipo) {
    return E.lienzo(512, 512, (g, w, h) => {
      const az = E.azar(tipo === "quebracho" ? 11 : tipo === "algarrobo" ? 23 : 37);
      const tonos = {
        quebracho: ["#34422a", "#3e4d2d", "#485835", "#2c3a24", "#56643a"],
        algarrobo: ["#65703f", "#727c48", "#5b6638", "#80894f", "#6d7640"],
        arbusto: ["#4e5a30", "#5a6636", "#46512b", "#66703d", "#3f4a27"],
      }[tipo];
      const ramas = tipo === "arbusto" ? 9 : 7;
      for (let r = 0; r < ramas; r++) {
        // El tallo sale del centro de abajo: así la tarjeta se engancha a la rama
        // por el borde de abajo de la textura.
        const ang = -Math.PI / 2 + (az() - 0.5) * (tipo === "algarrobo" ? 1.9 : 1.5);
        const largo = h * (0.55 + az() * 0.35);
        const x0 = w / 2 + (az() - 0.5) * 40, y0 = h - 4;
        const [x1, y1] = ramita(g, x0, y0, ang, largo, 3 + az() * 2, "#4a3524");
        const n = tipo === "algarrobo" ? 26 : 34;
        for (let i = 0; i < n; i++) {
          const t = 0.2 + (i / n) * 0.8;
          const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
          const lado = i % 2 ? 1 : -1;
          g.fillStyle = tonos[Math.floor(az() * tonos.length)];
          if (tipo === "algarrobo") {
            // Hoja bipinnada: un raquis con folíolos chiquitos a los dos lados.
            const a2 = ang + lado * (0.9 + az() * 0.4), l2 = 26 + az() * 22;
            const qx = px + Math.cos(a2) * l2, qy = py + Math.sin(a2) * l2;
            g.strokeStyle = "#5d6437"; g.lineWidth = 1.2;
            g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke();
            for (let k = 0; k < 9; k++) {
              const u = k / 9, fx = px + (qx - px) * u, fy = py + (qy - py) * u;
              for (const s of [-1, 1]) {
                g.save(); g.translate(fx, fy); g.rotate(a2 + s * 1.2);
                g.beginPath(); g.ellipse(4.5, 0, 4.5, 1.4, 0, 0, Math.PI * 2); g.fill(); g.restore();
              }
            }
          } else {
            const a2 = ang + lado * (0.5 + az() * 0.7);
            const l = tipo === "quebracho" ? 13 + az() * 9 : 9 + az() * 6;
            g.save(); g.translate(px, py); g.rotate(a2);
            g.beginPath(); g.ellipse(l * 0.55, 0, l * 0.55, l * 0.16, 0, 0, Math.PI * 2); g.fill(); g.restore();
          }
        }
      }
    });
  }
  function tarjetaPasto() {
    return E.lienzo(256, 256, (g, w, h) => {
      const az = E.azar(5);
      const tonos = ["#c9b26a", "#b89f58", "#d8c48a", "#a4914f", "#8d8a4a", "#7c8144"];
      for (let i = 0; i < 60; i++) {
        const x0 = w / 2 + (az() - 0.5) * 70, lean = (az() - 0.5) * 1.6;
        const alto = h * (0.45 + az() * 0.55);
        g.strokeStyle = tonos[Math.floor(az() * tonos.length)];
        g.lineWidth = 1.5 + az() * 2;
        g.beginPath(); g.moveTo(x0, h);
        g.quadraticCurveTo(x0 + lean * alto * 0.3, h - alto * 0.6, x0 + lean * alto * 0.7, h - alto);
        g.stroke();
      }
    });
  }

  // Con los recortes de Rezona: cada tarjeta es un abanico de 4 o 5 ramas
  // (una sola rama deja la copa rala). El lienzo 2D guarda el color
  // premultiplicado y pierde el sangrado del recorte, así que se arma en un
  // DataTexture y se vuelve a sangrar el borde (§ 5.2): si no, los mips
  // meten negro en el contorno de cada hoja.
  const RAMAS = { quebracho: "rama-quebracho.webp", algarrobo: "rama-algarrobo.webp", arbusto: "rama-vinal.webp" };
  function ramaRezona(mat, tipo) {
    const dato = window.ARCHIVOS && ARCHIVOS[RAMAS[tipo]];
    if (!dato) return;
    const img = new Image();
    img.onload = () => {
      const N = img.width >= 1024 ? 1024 : 512, c = document.createElement("canvas");
      c.width = c.height = N;
      const g = c.getContext("2d"), az = E.azar(tipo.length * 17);
      // Las ramas enteras adentro del lienzo, con margen: si la punta se sale
      // del borde queda cortada en recto y la tarjeta se ve como un tablón.
      const n = tipo === "arbusto" ? 5 : 4, abre = tipo === "algarrobo" ? 0.9 : 0.8;
      for (let i = 0; i < n; i++) {
        const ang = (i / (n - 1) - 0.5) * abre + (az() - 0.5) * 0.12, sc = 0.6 + az() * 0.18;
        g.save(); g.translate(N / 2 + (az() - 0.5) * 40, N); g.rotate(ang); g.scale(sc * (az() < 0.5 ? -1 : 1), sc);
        g.drawImage(img, -N / 2, -N, N, N); g.restore();
      }
      const d = g.getImageData(0, 0, N, N).data;
      sangrar(d, N, 12);
      // Las filas al revés: un DataTexture no se da vuelta solo.
      const out = new Uint8Array(N * N * 4);
      for (let y = 0; y < N; y++) out.set(d.subarray((N - 1 - y) * N * 4, (N - y) * N * 4), y * N * 4);
      const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
      t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
      t.needsUpdate = true;
      mat.map = t;
    };
    img.src = dato;
  }
  // Rellena el color de los pixeles transparentes con el de sus vecinos
  // opacos, de a un pixel por pasada.
  function sangrar(d, N, pasadas) {
    let lleno = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) lleno[i] = d[i * 4 + 3] > 8 ? 1 : 0;
    for (let k = 0; k < pasadas; k++) {
      const nuevo = lleno.slice();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (lleno[i]) continue;
        let r = 0, gg = 0, b = 0, m = 0;
        for (const j of [i - 1, i + 1, i - N, i + N]) {
          if (j < 0 || j >= N * N || !lleno[j]) continue;
          r += d[j * 4]; gg += d[j * 4 + 1]; b += d[j * 4 + 2]; m++;
        }
        if (m) { d[i * 4] = r / m; d[i * 4 + 1] = gg / m; d[i * 4 + 2] = b / m; nuevo[i] = 1; }
      }
      lleno = nuevo;
    }
  }

  // ── materiales ──
  const uViento = { uTiempo: { value: 0 }, uRacha: { value: 0.5 }, uSolDirV: { value: new THREE.Vector3() }, uSolColor: { value: new THREE.Color() } };
  F.uniformes = uViento;
  const VIENTO = `
    #ifdef USE_INSTANCING
      vec2 fase = instanceMatrix[3].xz * 0.07;
    #else
      vec2 fase = vec2(0.0);
    #endif
    float alto = max(transformed.y, 0.0);
    float balanceo = (sin(uTiempo * 1.1 + fase.x) + 0.5 * sin(uTiempo * 2.3 + fase.y)) * (0.4 + uRacha);
    transformed.x += balanceo * 0.0022 * alto * alto;
    transformed.z += balanceo * 0.0014 * alto * alto;`;
  function parcheViento(mat, clave, hojas) {
    E.parchear(mat, clave, (sh) => {
      Object.assign(sh.uniforms, uViento);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTiempo, uRacha;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VIENTO + (hojas ? `
          transformed += normal * sin(uTiempo * 6.0 + position.x * 3.0 + position.z * 2.0) * 0.025 * (0.3 + uRacha);` : ""));
      if (!hojas) return;
      // DoubleSide da vuelta la normal en la cara de atrás: el pasto y las
      // hojas vistos de atrás quedaban negros. Una tarjeta se ilumina igual
      // de los dos lados.
      sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nnormal *= faceDirection;\n#endif");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uSolDirV, uSolColor;")
        // Alfa nítido en todos los mips: si no, de lejos el follaje se desvanece.
        .replace("#include <map_fragment>", `#include <map_fragment>
          // Con el tamaño real de la textura (las ramas de Rezona son de 1024)
          // y con tope: sin tope, de canto la tarjeta entera se volvía opaca
          // y se veía como un tablón.
          vec2 tam = vec2(textureSize(map, 0));
          vec2 dxm = dFdx(vMapUv * tam), dym = dFdy(vMapUv * tam);
          float mipN = max(0.0, 0.5 * log2(max(dot(dxm, dxm), dot(dym, dym))));
          diffuseColor.a *= 1.0 + min(mipN, 3.0) * 0.2;
          // Una tarjeta vista de canto es una tabla finita: se desvanece según
          // cuánto se la ve de perfil (la normal del plano, no la de luz).
          vec3 nPlano = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          float deFrente = abs(dot(nPlano, normalize(vViewPosition)));
          diffuseColor.a *= smoothstep(0.1, 0.32, deFrente);
          // Lo que queda a menos de 1,6 m de la cámara se tramea: si no, la
          // cámara vive adentro de las copas.
          float cercania = smoothstep(0.7, 1.6, length(vViewPosition));
          if (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > cercania) discard;`)
        // Contraluz: color × sol × pow(dot(-vista, sol), 5), tapado por el
        // color de vértice. Es lo que más dice "atardecer".
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          float contra = pow(max(dot(normalize(-vViewPosition), uSolDirV), 0.0), 5.0);
          totalEmissiveRadiance += diffuseColor.rgb * uSolColor * contra * 0.32 * vColor;`);
    });
    return mat;
  }
  function materiales() {
    const corteza = new THREE.MeshStandardMaterial({
      map: E.textura("corteza.webp"), normalMap: E.textura("corteza-n.webp", { srgb: false }),
      roughness: 0.92, vertexColors: true,
    });
    parcheViento(corteza, "corteza", false);
    // El algarrobo de Rezona vino rojizo y el vinal pálido: se tiñen al verde
    // oliva del monte chaqueño.
    const TINTE = { quebracho: 0xffffff, algarrobo: 0xb8f070, arbusto: 0xd0f0a0 };
    const hoja = (tipo) => {
      const m = parcheViento(new THREE.MeshStandardMaterial({
        map: tarjetaHojas(tipo), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.78, vertexColors: true,
      }), "hojas-" + tipo, true);
      if (window.ARCHIVOS && ARCHIVOS[RAMAS[tipo]]) { m.color.set(TINTE[tipo]); ramaRezona(m, tipo); }
      return m;
    };
    return { corteza, quebracho: hoja("quebracho"), algarrobo: hoja("algarrobo"), arbusto: hoja("arbusto") };
  }

  // ── geometría ──
  // Un tubo que se afina a lo largo de una polilínea. u da la vuelta, v sube
  // un metro por unidad de textura cada 2 m.
  function tubo(puntos, radios, lados, oscuro) {
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const up = new THREE.Vector3(), t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    let largo = 0;
    for (let i = 0; i < puntos.length; i++) {
      const p = puntos[i];
      if (i > 0) largo += p.distanceTo(puntos[i - 1]);
      t.copy(puntos[Math.min(i + 1, puntos.length - 1)]).sub(puntos[Math.max(i - 1, 0)]).normalize();
      up.set(0, 0, 1); if (Math.abs(t.z) > 0.9) up.set(1, 0, 0);
      a.crossVectors(t, up).normalize(); b.crossVectors(t, a).normalize();
      for (let k = 0; k <= lados; k++) {
        const ang = (k / lados) * Math.PI * 2;
        const nx = Math.cos(ang) * a.x + Math.sin(ang) * b.x, ny = Math.cos(ang) * a.y + Math.sin(ang) * b.y, nz = Math.cos(ang) * a.z + Math.sin(ang) * b.z;
        pos.push(p.x + nx * radios[i], p.y + ny * radios[i], p.z + nz * radios[i]);
        nor.push(nx, ny, nz);
        uv.push((k / lados) * Math.max(1, Math.round(radios[i] * 6)), largo / 2);
        const c = oscuro(p.y);
        col.push(c, c, c);
      }
    }
    for (let i = 0; i < puntos.length - 1; i++) for (let k = 0; k < lados; k++) {
      const q = i * (lados + 1) + k, r = q + lados + 1;
      idx.push(q, r, q + 1, r, r + 1, q + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }
  // Una tarjeta de hojas: el borde de abajo en "base", creciendo hacia "dir".
  // Normales hacia afuera del centro de la copa, no las del plano.
  function tarjeta(base, dir, ancho, alto, centro, yMin, yMax, cruzada, acum) {
    const d = dir.clone().normalize();
    const lado = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
    if (lado.lengthSq() < 0.01) lado.set(1, 0, 0);
    lado.normalize();
    if (cruzada) lado.applyAxisAngle(d, Math.PI / 2);
    const esq = [
      base.clone().addScaledVector(lado, -ancho / 2), base.clone().addScaledVector(lado, ancho / 2),
      base.clone().addScaledVector(lado, ancho / 2).addScaledVector(d, alto), base.clone().addScaledVector(lado, -ancho / 2).addScaledVector(d, alto),
    ];
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const o = acum.pos.length / 3;
    esq.forEach((p, i) => {
      acum.pos.push(p.x, p.y, p.z);
      const n = p.clone().sub(centro); n.y *= 0.6; n.y += 0.35 * n.length(); n.normalize();
      acum.nor.push(n.x, n.y, n.z);
      acum.uv.push(uvs[i][0], uvs[i][1]);
      // Oscuridad interior: lo de abajo y lo de adentro recibe menos luz.
      const altura = E.clamp((p.y - yMin) / Math.max(0.1, yMax - yMin), 0, 1);
      const afuera = E.clamp(p.clone().sub(centro).setY(0).length() / 4, 0, 1);
      const c = 0.42 + 0.58 * altura * (0.55 + 0.45 * afuera);
      acum.col.push(c, c, c);
    });
    acum.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  function geoTarjetas(acum) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(acum.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(acum.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(acum.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(acum.col, 3));
    g.setIndex(acum.idx);
    return g;
  }
  // Tronco + tarjetas en una geometría con dos grupos (corteza, hojas): una
  // sola malla instanciada por variante y por nivel de detalle.
  function unir(troncos, hojas) {
    const t = troncos.length ? E.juntar(troncos) : null;
    const h = geoTarjetas(hojas);
    const g = t ? E.juntar([t, h]) : E.juntar([h]);
    const nt = t ? t.index.count : 0;
    g.clearGroups();
    if (nt) g.addGroup(0, nt, 0);
    g.addGroup(nt, g.index.count - nt, 1);
    return g;
  }

  function quebracho(semilla, lejos) {
    const az = E.azar(semilla), V = THREE.Vector3;
    const alto = 7 + az() * 3.5, lados = lejos ? 4 : 8;
    const puntos = [], radios = [];
    // El tronco empieza 0,6 m bajo el suelo: en una loma, si no, un lado queda en el aire.
    const lean = new V((az() - 0.5) * 0.5, 0, (az() - 0.5) * 0.5);
    for (let i = 0; i <= (lejos ? 3 : 6); i++) {
      const f = i / (lejos ? 3 : 6);
      puntos.push(new V(lean.x * f * f * alto * 0.1 + Math.sin(f * 5 + semilla) * 0.12, -0.6 + f * (alto + 0.6), lean.z * f * f * alto * 0.1));
      radios.push(E.lerp(0.34, 0.12, f) + 0.2 * Math.exp(-f * 18));
    }
    const oscuro = (y) => 0.55 + 0.45 * E.clamp(y / alto, 0, 1);
    const troncos = [tubo(puntos, radios, lados, oscuro)];
    const hojas = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const cima = puntos[puntos.length - 1], centro = cima.clone().add(new V(0, 1.2, 0));
    const nRamas = 4 + Math.floor(az() * 3);
    for (let r = 0; r < nRamas; r++) {
      const ang = (r / nRamas) * Math.PI * 2 + az();
      const y0 = alto * (0.6 + az() * 0.35);
      const base = new V(puntos[0].x + lean.x * 0.3, y0, puntos[0].z + lean.z * 0.3);
      const dir = new V(Math.cos(ang), 0.8 + az() * 0.6, Math.sin(ang)).normalize();
      const largo = 2.4 + az() * 2.6;
      const fin = base.clone().addScaledVector(dir, largo);
      if (!lejos) troncos.push(tubo([base, base.clone().lerp(fin, 0.5).add(new V(0, 0.2, 0)), fin], [0.11, 0.07, 0.03], 5, oscuro));
      const n = lejos ? 3 : 8;
      for (let k = 0; k < n; k++) {
        const t = 0.35 + (k / n) * 0.75;
        const p = base.clone().lerp(fin, Math.min(t, 1)).add(new V((az() - 0.5) * 0.8, (az() - 0.5) * 0.6, (az() - 0.5) * 0.8));
        const d = dir.clone().add(new V((az() - 0.5) * 0.9, 0.3, (az() - 0.5) * 0.9));
        // Tamaño de ramita de verdad (~0,35 + 0,3 × largo, tope 1,35 m).
        const tam = Math.min(1.35, 0.35 + 0.3 * largo) * (lejos ? 2 : 1) * (0.85 + az() * 0.3);
        tarjeta(p, d, tam * 1.05, tam, centro, alto * 0.55, alto + 2.5, false, hojas);
        if (k % 2 === 0) tarjeta(p, d, tam * 1.05, tam, centro, alto * 0.55, alto + 2.5, true, hojas);
      }
    }
    return { geo: unir(troncos, hojas), radio: 0.4, hojas: "quebracho" };
  }

  function algarrobo(semilla, lejos) {
    const az = E.azar(semilla), V = THREE.Vector3;
    const lados = lejos ? 4 : 8;
    const tronco = 1.4 + az() * 1.2;
    const oscuro = (y) => 0.5 + 0.5 * E.clamp(y / 7, 0, 1);
    const troncos = [tubo([new V(0, -0.6, 0), new V(0.08, tronco * 0.5, 0.05), new V(0, tronco, 0)], [0.5, 0.38, 0.34], lados, oscuro)];
    const hojas = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const centro = new V(0, tronco + 3.2, 0);
    const nRamas = 3 + Math.floor(az() * 2);
    for (let r = 0; r < nRamas; r++) {
      const ang = (r / nRamas) * Math.PI * 2 + az() * 0.8;
      const abre = 0.75 + az() * 0.45;                         // cuánto se abre del vertical
      const dir = new V(Math.cos(ang) * Math.sin(abre), Math.cos(abre), Math.sin(ang) * Math.sin(abre)).normalize();
      const largo = 3.6 + az() * 2.2;
      const base = new V(0, tronco, 0);
      const medio = base.clone().addScaledVector(dir, largo * 0.55).add(new V(0, 0.4, 0));
      const fin = base.clone().addScaledVector(dir, largo).add(new V(0, 0.9, 0));
      troncos.push(tubo([base, medio, fin], [0.26, 0.15, 0.06], lejos ? 4 : 6, oscuro));
      // La copa en paraguas: tarjetas más bien acostadas, abiertas hacia afuera.
      const n = lejos ? 5 : 14;
      for (let k = 0; k < n; k++) {
        const p = medio.clone().lerp(fin, az()).add(new V((az() - 0.5) * 2.4, 0.3 + az() * 0.9, (az() - 0.5) * 2.4));
        const hacia = p.clone().sub(centro).setY(0).normalize();
        const d = new V(hacia.x, 0.35 + az() * 0.5, hacia.z);
        const tam = (1.0 + az() * 0.35) * (lejos ? 2 : 1);
        tarjeta(p, d, tam * 1.2, tam, centro, tronco + 1, tronco + 5.5, false, hojas);
        if (k % 2) tarjeta(p, d, tam * 1.2, tam, centro, tronco + 1, tronco + 5.5, true, hojas);
      }
    }
    return { geo: unir(troncos, hojas), radio: 0.5, hojas: "algarrobo" };
  }

  function arbusto(semilla, lejos) {
    const az = E.azar(semilla), V = THREE.Vector3;
    const hojas = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const alto = 1.4 + az() * 1.2, centro = new V(0, alto * 0.45, 0);
    const n = lejos ? 5 : 16;
    for (let k = 0; k < n; k++) {
      const ang = az() * Math.PI * 2, r = az() * 0.7;
      const base = new V(Math.cos(ang) * r, -0.05, Math.sin(ang) * r);
      const d = new V(Math.cos(ang) * 0.6, 1, Math.sin(ang) * 0.6);
      const tam = alto * (0.7 + az() * 0.4) * (lejos ? 1.4 : 1);
      tarjeta(base, d, tam * 1.1, tam, centro, 0, alto, k % 2 === 1, hojas);
    }
    return { geo: unir([], hojas), radio: 0, hojas: "arbusto" };
  }

  // ── sembrar ──
  F.construir = () => {
    const mats = (F.mats = materiales());
    const T = E.terreno, L = E.lugares;
    const variantes = [];
    const nueva = (fn, semilla) => {
      const cerca = fn(semilla, false), lejos = fn(semilla, true);
      const matsV = [mats.corteza, mats[cerca.hojas]];
      const v = { radio: cerca.radio, cerca: null, lejos: null, lista: [], matsV, geoCerca: cerca.geo, geoLejos: lejos.geo };
      variantes.push(v);
      return v;
    };
    const Q = [nueva(quebracho, 101), nueva(quebracho, 202), nueva(quebracho, 303)];
    const A = [nueva(algarrobo, 404), nueva(algarrobo, 505), nueva(algarrobo, 606)];
    const B = [nueva(arbusto, 707), nueva(arbusto, 808)];
    F.variantes = variantes;

    const az = E.azar(20260923);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), eje = new THREE.Vector3(0, 1, 0);
    const poner = (v, x, z, escala, esArbol) => {
      const y = T.altura(x, z);
      q.setFromAxisAngle(eje, az() * Math.PI * 2);
      s.set(escala, escala * (0.9 + az() * 0.2), escala);
      p.set(x, y, z);
      m4.compose(p, q, s);
      const arbol = { x, z, v, m: m4.toArray(new Float32Array(16)) };
      v.lista.push(arbol);
      F.arboles.push(arbol);
      if (esArbol) {
        const k = Math.floor(x / CELDA_CHOQUE) + "," + Math.floor(z / CELDA_CHOQUE);
        if (!F.choques.has(k)) F.choques.set(k, []);
        F.choques.get(k).push({ x, z, r: v.radio * escala });
      }
    };
    const libre = (x, z) => Math.abs(Math.abs(x) - L.limite) > 4 && Math.abs(Math.abs(z) - L.limite) > 4 && T.estero(x, z) > 1.12;
    // Árboles en celdas de 7 m con desplazamiento; algarrobos sueltos en el
    // campo abierto, que es donde la hacienda busca sombra a la siesta.
    for (let cz = -640; cz < 640; cz += 7) for (let cx = -640; cx < 640; cx += 7) {
      const x = cx + az() * 7, z = cz + az() * 7;
      if (!libre(x, z)) continue;
      const m = T.monte(x, z);
      const lejosEst = T.distEstancia(x, z);
      const r = az();
      if (r < m * 0.55) {
        const qb = az() < 0.5 ? Q : A;
        poner(qb[Math.floor(az() * 3)], x, z, 0.85 + az() * 0.4, true);
      } else if (r > 0.9965 && lejosEst > 45 && T.distCamino(x, z) > 8) {
        poner(A[Math.floor(az() * 3)], x, z, 1.05 + az() * 0.3, true);
      }
    }
    // Arbustos debajo del monte, en celdas de 5 m (solo se dibujan cerca).
    for (let cz = -460; cz < 460; cz += 5) for (let cx = -460; cx < 460; cx += 5) {
      const x = cx + az() * 5, z = cz + az() * 5;
      if (!libre(x, z)) continue;
      if (az() < T.monte(x, z) * 0.5) poner(B[Math.floor(az() * 2)], x, z, 0.8 + az() * 0.5, false);
    }
    // Una malla instanciada por variante y nivel de detalle.
    for (const v of variantes) {
      const max = v.lista.length;
      v.cerca = new THREE.InstancedMesh(v.geoCerca, v.matsV, Math.max(1, max));
      v.lejos = new THREE.InstancedMesh(v.geoLejos, v.matsV, Math.max(1, max));
      v.cerca.castShadow = true; v.cerca.receiveShadow = true;
      v.lejos.castShadow = false;
      for (const im of [v.cerca, v.lejos]) { im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); E.motor.escena.add(im); }
    }
    F.crearPasto();
    F.ultima = { x: 1e9, z: 1e9, dx: 0, dz: 0 };
  };

  // Qué se dibuja: cerca el completo hasta 95 m (el borde de la caja de
  // sombra, más o menos), lejos la versión de pocas tarjetas hasta 520 m, y
  // detrás de la cámara nada salvo lo que está a menos de 30 m, cuya sombra sí
  // puede verse (§ 6.6). Los arbustos solo cerca.
  F.actualizar = (cam, t) => {
    uViento.uTiempo.value = t;
    const ult = F.ultima;
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const giro = Math.acos(E.clamp(dir.x * ult.dx + dir.z * ult.dz, -1, 1));
    if (Math.hypot(cam.position.x - ult.x, cam.position.z - ult.z) < 5 && giro < 0.12) return;
    ult.x = cam.position.x; ult.z = cam.position.z;
    const l = Math.hypot(dir.x, dir.z) || 1; ult.dx = dir.x / l; ult.dz = dir.z / l;
    for (const v of F.variantes) { v.cerca.count = 0; v.lejos.count = 0; }
    const px = cam.position.x, pz = cam.position.z;
    for (const a of F.arboles) {
      const dx = a.x - px, dz = a.z - pz, d = Math.hypot(dx, dz);
      const esArbusto = a.v.radio === 0;
      if (d > (esArbusto ? 110 : 520)) continue;
      if (d > 30 && (dx * ult.dx + dz * ult.dz) / d < -0.35) continue;
      const im = d < (esArbusto ? 110 : 95) ? a.v.cerca : a.v.lejos;
      im.instanceMatrix.array.set(a.m, im.count * 16);
      im.count++;
    }
    for (const v of F.variantes) { v.cerca.instanceMatrix.needsUpdate = true; v.lejos.instanceMatrix.needsUpdate = true; }
  };

  // Choque con troncos: devuelve los círculos cercanos.
  F.cercanos = (x, z) => {
    const r = [];
    const i0 = Math.floor(x / CELDA_CHOQUE), j0 = Math.floor(z / CELDA_CHOQUE);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const c = F.choques.get(i + "," + j);
      if (c) r.push(...c);
    }
    return r;
  };
  // Sombra de árbol: para que las vacas busquen dónde echarse a la siesta.
  F.sombraCercana = (x, z, radio) => {
    let mejor = null, md = radio;
    for (const a of F.arboles) {
      if (a.v.radio === 0) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < md) { md = d; mejor = a; }
    }
    return mejor;
  };

  // ── el pasto ── matas instanciadas en celdas de 10 m alrededor del jugador,
  // sembradas con la semilla de cada celda: al volver a un lugar, las matas
  // están donde estaban (§ 6.6).
  // Cuántas matas como mucho: 121 celdas × 70 intentos × 1,5 (calidad ultra).
  const MAX_PASTO = 13000;
  F.densidadPasto = 1;
  F.crearPasto = () => {
    // La mata de espartillo de Rezona (ya viene sangrada), o la dibujada.
    const rz = !!(window.ARCHIVOS && ARCHIVOS["mata-espartillo.webp"]);
    const tex = rz ? E.textura("mata-espartillo.webp", { repetir: false }) : tarjetaPasto();
    // Las puntas del espartillo de Rezona tiran a lila: al sol del Chaco se
    // veía rosado. Un poco de paja dorada.
    const mat = parcheViento(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true, color: rz ? 0xf0dcae : 0xffffff }), "pasto", true);
    const q1 = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const q2 = q1.clone().rotateY(Math.PI / 2);
    for (const g of [q1, q2]) {
      const n = g.attributes.position.count, c = new Float32Array(n * 3), nor = g.attributes.normal.array;
      for (let i = 0; i < n; i++) {
        const y = g.attributes.position.getY(i);
        const v = 0.55 + 0.45 * y;
        c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
        nor[i * 3] = 0; nor[i * 3 + 1] = 1; nor[i * 3 + 2] = 0;           // normales hacia arriba: el pasto se ilumina como el suelo
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    }
    const geo = E.juntar([q1, q2]);
    F.pasto = new THREE.InstancedMesh(geo, mat, MAX_PASTO);
    F.pasto.count = 0;
    F.pasto.frustumCulled = false;
    F.pasto.receiveShadow = true;
    E.motor.escena.add(F.pasto);
    F.celdaPasto = null;
  };
  F.actualizarPasto = (pos) => {
    const C = 10, ci = Math.floor(pos.x / C), cj = Math.floor(pos.z / C);
    const k = ci + "," + cj;
    if (k === F.celdaPasto) return;
    F.celdaPasto = k;
    const T = E.terreno, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), eje = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (let j = cj - 5; j <= cj + 5; j++) for (let i = ci - 5; i <= ci + 5; i++) {
      const az = E.azar(Math.imul(i, 73856093) ^ Math.imul(j, 19349663));
      const intentos = Math.round(70 * F.densidadPasto);
      for (let t = 0; t < intentos && n < MAX_PASTO; t++) {
        const x = (i + az()) * C, z = (j + az()) * C;
        const pa = T.pasto(x, z);
        if (az() > pa * 1.15) continue;
        if (T.agua(x, z) > 0.05) continue;
        const alto = 0.35 + az() * 0.55 * (0.5 + pa);
        p.set(x, T.altura(x, z) - 0.03, z);
        q.setFromAxisAngle(eje, az() * Math.PI);
        s.set(alto * (0.9 + az() * 0.5), alto, alto * (0.9 + az() * 0.5));
        m4.compose(p, q, s);
        F.pasto.setMatrixAt(n++, m4);
      }
    }
    F.pasto.count = n;
    F.pasto.instanceMatrix.needsUpdate = true;
  };

  // Una vez por cuadro: el sol en espacio de vista para el contraluz.
  F.actualizarSol = (cam) => {
    uViento.uSolDirV.value.copy(E.motor.dirSol).transformDirection(cam.matrixWorldInverse);
    uViento.uSolColor.value.copy(E.motor.sol.color).multiplyScalar(Math.min(1, E.motor.sol.intensity / 3));
  };
})();
