"use strict";
// ════════════════════════════════════════════════════════════════════════
// Modelos 3D de Rezona: se leen de datos.js (GLB con gzip), se llevan a su
// tamaño real, se apoyan en el piso mirando a +Z y se clonan por instancia.
// Los autos vienen blancos: un shader tiñe solo lo blanco (la chapa) con el
// color de cada vehículo, sin tocar vidrios, cubiertas ni cromados.
// ════════════════════════════════════════════════════════════════════════
const Modelos = (() => {
  // largo = medida a lo largo (m); alto = para árboles y personas; giro = si el frente quedó para atrás.
  const AJUSTES = {
    pickup: { largo: 5.3, giro: 0 }, sedan: { largo: 4.4, giro: 0 }, compacto: { largo: 4.35, giro: 0 }, hatch: { largo: 3.9, giro: 0, umbral: [0.3, 0.52] }, camion: { largo: 7.2, giro: 0 },
    moto: { largo: 1.9, giro: 0 }, patrullero: { largo: 5.3, giro: 0 }, motopol: { largo: 2.25, giro: 0 }, garita: { largo: 6.0, giro: 0 },
    algarrobo: { alto: 7.5 }, quebracho: { alto: 11 },
    cuatrigaucho: { largo: 2.05, giro: 0 }, cuatri: { largo: 2.05, giro: 0 },
    mayor: { alto: 1.70, rig: true, giro: -Math.PI / 2 }, joven: { alto: 1.77, rig: true, giro: -Math.PI / 2 }, camionero: { alto: 1.79, rig: true, giro: -Math.PI / 2 },
    senora: { alto: 1.60, rig: true, giro: -Math.PI / 2 }, gaucho: { alto: 1.74, rig: true, giro: -Math.PI / 2 },
    conductor: { alto: 1.76, rig: true, giro: -Math.PI / 2 }, conductora: { alto: 1.64, rig: true, giro: -Math.PI / 2 }, policia: { alto: 1.78, rig: true, giro: -Math.PI / 2 },
  };
  const listos = {};
  function bytes(dato) { const s = atob(dato.slice(dato.indexOf(",") + 1)), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  async function glb(n) {
    const A = window.ARCHIVOS || {};
    if (A[n + ".glb"]) return bytes(A[n + ".glb"]);
    if (!A[n + ".glb.gz"] || typeof DecompressionStream === "undefined") return null;
    const flujo = new Blob([bytes(A[n + ".glb.gz"])]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(flujo).arrayBuffer();
  }
  function cargador() {
    const l = new THREE.GLTFLoader();
    // Texturas como <img>, no con fetch: fetch falla desde file://.
    l.register((parser) => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: "texturas_como_imagen" }; });
    return l;
  }
  // Tinte de chapa: lo blanco y poco saturado toma el color de la pintura.
  // umbral: desde qué luminancia de la textura se considera chapa blanca (el Uno
  // de la segunda pasada vino con un blanco más gris y quedaba rosado).
  function conPintura(mat, umbral = [0.42, 0.68]) {
    mat.userData.pintura = mat.userData.pintura || { value: new THREE.Color(1, 1, 1) };
    mat.userData.umbral = { value: new THREE.Vector2(umbral[0], umbral[1]) };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPintura = mat.userData.pintura; sh.uniforms.uUmbral = mat.userData.umbral;
      sh.fragmentShader = "uniform vec3 uPintura; uniform vec2 uUmbral;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float sat = mx > 0.001 ? (mx - mn) / mx : 0.0, lum = dot(c, vec3(0.299, 0.587, 0.114));
          float k = smoothstep(uUmbral.x, uUmbral.y, lum) * (1.0 - smoothstep(0.08, 0.2, sat));
          diffuseColor.rgb = mix(c, uPintura * (0.35 + lum * 0.75), k); }`);
    };
    mat.customProgramCacheKey = () => "pintura";
    return mat;
  }
  function quitarAvance(clip, hueso, escala) {
    const tr = clip.tracks.find((x) => x.name === hueso + ".position");
    if (!tr) return 0;
    const v = tr.values, k0 = tr.times.length, t0 = tr.times[0], t1 = tr.times[k0 - 1];
    let avance = 0;
    for (let k = 0; k < 3; k++) {
      const d = v[(k0 - 1) * 3 + k] - v[k];
      if (Math.abs(d) < 0.02 || t1 <= t0) continue;
      avance = Math.max(avance, Math.abs(d));
      for (let i = 0; i < k0; i++) v[i * 3 + k] -= (d * (tr.times[i] - t0)) / (t1 - t0);
    }
    return (avance * escala) / Math.max(1e-3, clip.duration);
  }
  // ── Vidrios ──
  // Los autos de Rezona son una sola malla con los vidrios pintados en la textura.
  // Acá se separan: los triángulos oscuros de la franja de las ventanillas pasan a
  // un material de vidrio transparente, y los de la ventanilla del conductor
  // (lado +X, adelante) a otro que puede "bajar". Se anota el hueco para que el
  // juego arme la cabina y siente al conductor.
  // Zona de ventanillas medida en cada modelo: alto relativo [cintura, techo] y
  // largo relativo [atrás, adelante] de la cabina (el frente es +Z, de −0,5 a 0,5).
  const ZONA = {
    sedan: { y: [0.58, 0.95], z: [-0.33, 0.28] }, compacto: { y: [0.6, 0.95], z: [-0.33, 0.3] }, hatch: { y: [0.58, 0.96], z: [-0.45, 0.3] },
    pickup: { y: [0.6, 0.95], z: [-0.12, 0.33] }, patrullero: { y: [0.6, 0.93], z: [-0.14, 0.33] }, camion: { y: [0.43, 0.66], z: [0.22, 0.5] },
  };
  const VIDRIO = new THREE.MeshStandardMaterial({ color: "#16202a", roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false });
  function pixeles(img) {
    const c = document.createElement("canvas"), w = Math.min(512, img.width), h = Math.min(512, img.height); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); return { w, h, d: g.getImageData(0, 0, w, h).data };
  }
  function vidrioQueBaja() {
    const m = VIDRIO.clone(); m.userData.corte = { value: 99 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uCorte = m.userData.corte;
      sh.vertexShader = "varying float vAlto;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvAlto = (modelMatrix * vec4(transformed, 1.0)).y;");
      sh.fragmentShader = "varying float vAlto; uniform float uCorte;\n" + sh.fragmentShader.replace("void main() {", "void main() {\n if (vAlto > uCorte) discard;");
    };
    m.customProgramCacheKey = () => "vidrio-baja";
    return m;
  }
  function separarVidrios(n, grupo, tam) {
    grupo.updateMatrixWorld(true);
    const Z = ZONA[n], [b0, b1] = Z.y, V3 = THREE.Vector3, a = new V3(), b = new V3(), c = new V3(), e1 = new V3(), e2 = new V3();
    const hueco = new THREE.Box3(), puerta = new THREE.Box3();
    grupo.traverse((m) => {
      if (!m.isMesh || !m.material.map || !m.material.map.image || !m.geometry.index || !m.geometry.attributes.uv || m.userData.vidrio) return;
      let px; try { px = pixeles(m.material.map.image); } catch (err) { return; } // imagen "sucia" (file://): sin vidrios
      const geo = m.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index.array, M = m.matrixWorld, flip = m.material.map.flipY;
      const oscuro = (u, v) => { u -= Math.floor(u); v -= Math.floor(v); const x = Math.min(px.w - 1, (u * px.w) | 0), y = Math.min(px.h - 1, ((flip ? 1 - v : v) * px.h) | 0), i = (y * px.w + x) * 4; return Math.max(px.d[i], px.d[i + 1], px.d[i + 2]) < 138; }; // no es chapa blanca (vidrio, marco o goma)
      const nt = idx.length / 3, tipo = new Uint8Array(nt), cz = new Float32Array(nt), nx = new Float32Array(nt);
      let zmin = 1e9, zmax = -1e9;
      for (let t = 0; t < nt; t++) {
        const ia = idx[t * 3], ib = idx[t * 3 + 1], ic = idx[t * 3 + 2];
        a.fromBufferAttribute(pos, ia).applyMatrix4(M); b.fromBufferAttribute(pos, ib).applyMatrix4(M); c.fromBufferAttribute(pos, ic).applyMatrix4(M);
        const y = (a.y + b.y + c.y) / 3 / tam.y; if (y < b0 || y > b1) continue;
        const zr = (a.z + b.z + c.z) / 3 / tam.z, xr = Math.abs(a.x + b.x + c.x) / 3 / tam.x; if (zr < Z.z[0] || zr > Z.z[1] || xr > 0.43) continue; // fuera de la cabina o espejo
        const nrm = e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize(); if (nrm.y > 0.86 || nrm.y < -0.3) continue; // techo o panza
        const um = (uv.getX(ia) + uv.getX(ib) + uv.getX(ic)) / 3, vm = (uv.getY(ia) + uv.getY(ib) + uv.getY(ic)) / 3;
        const k = oscuro(uv.getX(ia), uv.getY(ia)) + oscuro(uv.getX(ib), uv.getY(ib)) + oscuro(uv.getX(ic), uv.getY(ic)) + 2 * oscuro(um, vm);
        if (k < 4) continue;
        tipo[t] = 1; cz[t] = (a.z + b.z + c.z) / 3; nx[t] = nrm.x;
        hueco.expandByPoint(a).expandByPoint(b).expandByPoint(c);
        if (nrm.x > 0.5) { zmin = Math.min(zmin, cz[t]); zmax = Math.max(zmax, cz[t]); }
      }
      // La del conductor: la de costado +X, en la mitad de adelante del vidrio lateral.
      const corte = zmin + 0.42 * (zmax - zmin);
      const cuerpo = [], vid = [], cond = [];
      for (let t = 0; t < nt; t++) {
        const tri = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
        if (!tipo[t]) cuerpo.push(...tri);
        else if (nx[t] > 0.5 && cz[t] > corte) { cond.push(...tri); for (const i of tri) puerta.expandByPoint(a.fromBufferAttribute(pos, i).applyMatrix4(M)); }
        else vid.push(...tri);
      }
      if (!vid.length && !cond.length) return;
      const parte = (ind) => { const g = new THREE.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(ind); return g; };
      m.geometry = parte(cuerpo);
      const mv = new THREE.Mesh(parte(vid), VIDRIO); mv.userData.vidrio = true; mv.renderOrder = 3; m.add(mv);
      if (cond.length) { const mc = new THREE.Mesh(parte(cond), vidrioQueBaja()); mc.userData.vidrio = true; mc.userData.vidrioConductor = true; mc.renderOrder = 3; m.add(mc); }
    });
    if (hueco.isEmpty()) return null;
    return { hueco, puerta: puerta.isEmpty() ? null : puerta };
  }
  function preparar(n, gltf) {
    const aj = AJUSTES[n], raiz = gltf.scene;
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material;
      if (m) { if (m.emissiveMap || (m.emissive && m.emissive.getHex())) { m.emissive = new THREE.Color(0); m.emissiveMap = null; } m.metalness = Math.min(m.metalness ?? 0, 0.3); m.roughness = Math.max(m.roughness ?? 1, 0.45); }
      if (o.isSkinnedMesh) o.frustumCulled = false;
    });
    // Tamaño y apoyo: medir la caja, escalar al tamaño real y dejarlo centrado sobre el piso.
    raiz.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(raiz), t = caja.getSize(new THREE.Vector3()), c = caja.getCenter(new THREE.Vector3());
    const grupo = new THREE.Group(), pivote = new THREE.Group(); pivote.add(raiz); grupo.add(pivote);
    let escala;
    if (aj.largo) {
      // Que el largo quede sobre Z (el frente para +Z; "giro" lo da vuelta si hace falta).
      const largoEnX = t.x > t.z; escala = aj.largo / Math.max(t.x, t.z);
      pivote.rotation.y = (largoEnX ? -Math.PI / 2 : 0) + (aj.giro || 0);
    } else { escala = aj.alto / t.y; pivote.rotation.y = aj.giro || 0; }
    raiz.position.set(-c.x, -caja.min.y, -c.z); pivote.scale.setScalar(escala);
    grupo.updateMatrixWorld(true);
    const final = new THREE.Box3().setFromObject(grupo);
    listos[n] = { escena: grupo, caja: final, tam: final.getSize(new THREE.Vector3()), clips: gltf.animations || [], rig: !!aj.rig, velCaminar: 1.2 };
    // La caminata de Rezona avanza la cadera (~1 m por vuelta) y vuelve de golpe:
    // se saca ese avance y se usa para saber a qué velocidad pasar el clip.
    if (aj.rig) {
      const hueso = raiz.getObjectByName("Root"), esc = hueso ? hueso.getWorldScale(new THREE.Vector3()).x : escala;
      for (const clip of listos[n].clips) { const v = quitarAvance(clip, "Hip", esc); if (clip.name === "walk" && v > 0.2) listos[n].velCaminar = v; }
    }
    // La textura del algarrobo vino muy oscura: de lejos era una mancha negra.
    if (n === "algarrobo") grupo.traverse((o) => { if (o.isMesh && o.material) o.material.color.setRGB(1.9, 2.0, 1.7); });
    if (["pickup", "sedan", "compacto", "hatch", "camion", "patrullero"].includes(n)) listos[n].vidrios = separarVidrios(n, grupo, listos[n].tam);
    if (["pickup", "sedan", "compacto", "hatch", "camion", "moto"].includes(n)) grupo.traverse((o) => { if (o.isMesh && o.material && o.material.map && !o.userData.vidrio) o.material = conPintura(o.material.clone(), aj.umbral); });
  }
  async function cargar(progreso) {
    const l = cargador(), nombres = Object.keys(AJUSTES);
    let hechos = 0;
    await Promise.all(nombres.map(async (n) => {
      let buf = null; try { buf = await glb(n); } catch (e) { console.warn("modelo " + n, e); }
      if (buf) await new Promise((ok) => l.parse(buf, "", (g) => { try { preparar(n, g); } catch (e) { console.warn("modelo " + n, e); } ok(); }, (e) => { console.warn("modelo " + n, e); ok(); }));
      hechos++; progreso && progreso(hechos / nombres.length);
    }));
    return listos;
  }
  // Una copia para poner en la escena (los autos con su propia pintura).
  function clonar(n, color) {
    const L = listos[n]; if (!L) return null;
    const o = L.rig ? THREE.SkeletonUtils.clone(L.escena) : L.escena.clone(true);
    o.traverse((m) => { if (m.userData && m.userData.vidrioConductor) m.material = vidrioQueBaja(); });
    if (color) o.traverse((m) => { if (m.isMesh && m.material && m.material.userData.pintura && m.material.userData.umbral) { const u = m.material.userData.umbral.value, nm = m.material.clone(); nm.userData.pintura = { value: new THREE.Color(color) }; conPintura(nm, [u.x, u.y]); m.material = nm; } });
    return o;
  }
  return { cargar, clonar, listos, AJUSTES };
})();
