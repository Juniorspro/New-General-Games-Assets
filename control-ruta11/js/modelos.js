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
    if (["pickup", "sedan", "compacto", "hatch", "camion", "moto"].includes(n)) grupo.traverse((o) => { if (o.isMesh && o.material && o.material.map) o.material = conPintura(o.material.clone(), aj.umbral); });
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
    if (color) o.traverse((m) => { if (m.isMesh && m.material && m.material.userData.pintura) { const u = m.material.userData.umbral.value, nm = m.material.clone(); nm.userData.pintura = { value: new THREE.Color(color) }; conPintura(nm, [u.x, u.y]); m.material = nm; } });
    return o;
  }
  return { cargar, clonar, listos, AJUSTES };
})();
