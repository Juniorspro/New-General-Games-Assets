"use strict";
// ════════════════════════════════════════════════════════════════════════
// Modelos 3D de Rezona: se leen de datos.js (GLB con gzip), se llevan a su
// tamaño real, se apoyan en el piso mirando a +Z y se clonan por instancia.
// Si falta uno (todavía no se generó, o el navegador no descomprime), el
// juego usa lo que arma por código: nunca se queda sin algo que mostrar.
// ════════════════════════════════════════════════════════════════════════
const Modelos = (() => {
  // alto (personas, árboles, cosas altas) o largo (vehículos, cabañas); giro si el frente quedó para otro lado.
  // Medidos en las tiras de 4 vistas (herramientas/AJUSTES.md): los personajes de Tripo
  // miran a +X (giro −90°), escopeta y rifle apuntan a −Z, la boca de la mina mira a +X.
  const AJUSTES = {
    prota: { alto: 1.82, rig: true, giro: -Math.PI / 2 }, medica: { alto: 1.68, rig: true, giro: -Math.PI / 2 }, explorador: { alto: 1.8, rig: true, giro: -Math.PI / 2 }, mecanico: { alto: 1.76, rig: true, giro: -Math.PI / 2 },
    sobreviviente1: { alto: 1.7, rig: true, giro: -Math.PI / 2 }, sobreviviente2: { alto: 1.74, rig: true, giro: -Math.PI / 2 },
    mont_cazador: { alto: 1.84, rig: true, giro: -Math.PI / 2 }, mont_rapido: { alto: 1.66, rig: true, giro: -Math.PI / 2 }, mont_vigia: { alto: 1.78, rig: true, giro: -Math.PI / 2 },
    mont_bruto: { alto: 2.3, rig: true, giro: -Math.PI / 2 }, mont_trampero: { alto: 1.75, rig: true, giro: -Math.PI / 2 }, mont_lider: { alto: 2.05, rig: true, giro: -Math.PI / 2 },
    camioneta_grua: { largo: 5.2, giro: 0 }, grua: { alto: 1.9, giro: 0 }, camioneta_vieja: { largo: 5.0, giro: 0 }, camion_maderero: { largo: 8.5, giro: 0 },
    cabana: { largo: 9.5, giro: 0 }, cabana_ruina: { largo: 8.5, giro: -Math.PI / 2 }, puente: { largo: 22, giro: 0 }, mina_entrada: { alto: 6.5, giro: -Math.PI / 2 }, vagoneta: { largo: 1.8, giro: 0 },
    pino1: { alto: 22, arbol: true }, pino2: { alto: 19, arbol: true }, roca1: { alto: 1.6, arbol: true }, roca2: { alto: 2.2, arbol: true }, tronco: { largo: 8, giro: 0 },
    aserradero: { largo: 26, giro: 0 }, tienda: { largo: 4.2, giro: 0 }, cruces: { largo: 5, giro: 0 }, jaula: { alto: 2.1, giro: 0 }, trampa_oso: { largo: 0.55, giro: 0 },
    farol: { alto: 0.42, giro: 0 }, torre_agua: { alto: 12, giro: 0 },
    pistola: { largo: 0.22, giro: 0, inclina: 0.35 }, escopeta: { largo: 1.05, giro: Math.PI }, rifle: { largo: 1.15, giro: Math.PI }, hacha: { largo: 0.75, giro: 0 }, linterna: { largo: 0.25, giro: 0 },
    botiquin: { largo: 0.36, giro: 0 }, bateria: { largo: 0.12, giro: 0 }, bidon: { alto: 0.5, giro: 0 }, municion: { largo: 0.3, giro: 0 }, lata: { alto: 0.12, giro: 0 },
    herramientas: { largo: 0.5, giro: 0 }, repuesto: { largo: 0.3, giro: 0 },
  };
  // Ajustes finos anotados por el que armó los modelos (si existen, pisan los de arriba).
  if (window.AJUSTES_MODELOS) for (const k in AJUSTES_MODELOS) AJUSTES[k] = Object.assign({}, AJUSTES[k] || {}, AJUSTES_MODELOS[k]);
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
  // La caminata de Rezona avanza la cadera y vuelve de golpe: se saca el avance.
  function quitarAvance(clip, escala) {
    const tr = clip.tracks.find((x) => /(^|\.)(Hip|Hips|hip|pelvis)\.position$/.test(x.name)) || clip.tracks.find((x) => x.name.endsWith(".position"));
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
      if (m) { if (m.emissive && m.emissive.getHex()) m.emissive = new THREE.Color(0); m.emissiveMap = null; m.metalness = Math.min(m.metalness ?? 0, 0.35); m.roughness = Math.max(m.roughness ?? 1, 0.5); }
      if (o.isSkinnedMesh) o.frustumCulled = false;
    });
    raiz.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(raiz, true), t = caja.getSize(new THREE.Vector3()), c = caja.getCenter(new THREE.Vector3());
    const grupo = new THREE.Group(), pivote = new THREE.Group(); pivote.add(raiz); grupo.add(pivote);
    let escala;
    if (aj.largo) { const largoEnX = t.x > t.z; escala = aj.largo / Math.max(t.x, t.z); pivote.rotation.y = (largoEnX ? -Math.PI / 2 : 0) + (aj.giro || 0); }
    else { escala = aj.alto / t.y; pivote.rotation.y = aj.giro || 0; }
    // inclina: cabeceo para lo que Tripo sacó torcido (la pistola vino apuntando 20° arriba).
    if (aj.inclina) { pivote.rotation.x = aj.inclina; pivote.rotation.order = "YXZ"; }
    raiz.position.set(-c.x, -caja.min.y, -c.z); pivote.scale.setScalar(escala);
    grupo.updateMatrixWorld(true);
    const final = new THREE.Box3().setFromObject(grupo, true);
    const L = listos[n] = { escena: grupo, caja: final, tam: final.getSize(new THREE.Vector3()), clips: gltf.animations || [], rig: !!aj.rig, velCaminar: 1.3, velCorrer: 3.6 };
    if (aj.rig) for (const clip of L.clips) {
      const v = quitarAvance(clip, escala);
      if (/walk/i.test(clip.name) && v > 0.2) L.velCaminar = v;
      if (/run/i.test(clip.name) && v > 0.5) L.velCorrer = v;
    }
  }
  async function cargar(progreso) {
    const l = cargador(), A = window.ARCHIVOS || {}, nombres = Object.keys(AJUSTES).filter((n) => A[n + ".glb"] || A[n + ".glb.gz"]);
    let hechos = 0;
    await Promise.all(nombres.map(async (n) => {
      let buf = null; try { buf = await glb(n); } catch (e) { console.warn("modelo " + n, e); }
      if (buf) await new Promise((ok) => l.parse(buf, "", (g) => { try { preparar(n, g); } catch (e) { console.warn("modelo " + n, e); } ok(); }, (e) => { console.warn("modelo " + n, e); ok(); }));
      hechos++; progreso && progreso(hechos / Math.max(1, nombres.length));
    }));
    if (!nombres.length) progreso && progreso(1);
    return listos;
  }
  function clonar(n) {
    const L = listos[n]; if (!L) return null;
    return L.rig ? THREE.SkeletonUtils.clone(L.escena) : L.escena.clone(true);
  }
  // Para instanciar de a miles (pinos, rocas): todas las mallas del modelo en una
  // geometría con grupos por material, ya en su tamaño y apoyada en el piso.
  // (Lejos se usa el pino bajo hecho por código: saltear triángulos deja agujeros.)
  const cacheArbol = {};
  function geoArbol(n) {
    const L = listos[n]; if (!L) return null;
    const k = n; if (cacheArbol[k]) return cacheArbol[k];
    const partes = [], mats = [];
    L.escena.updateMatrixWorld(true);
    L.escena.traverse((o) => {
      if (!o.isMesh) return;
      let mi = mats.indexOf(o.material); if (mi < 0) { mats.push(o.material); mi = mats.length - 1; }
      partes.push([o, mi]);
    });
    // Vértice por vértice a Float32: los GLB vienen cuantizados (enteros de 16 bits
    // normalizados) y geometry.applyMatrix4 escribía el resultado en el mismo entero,
    // recortado a [−1, 1]: el pino de 22 m quedaba en un cubo de 2 m.
    const geo = new THREE.BufferGeometry(), v = new THREE.Vector3(), nm = new THREE.Matrix3(); let base = 0; const P = [], N = [], U = [], I = [];
    for (const [o, mi] of partes) {
      const g = o.geometry, p = g.attributes.position, nn = g.attributes.normal, uu = g.attributes.uv, idx = g.index ? g.index.array : [...Array(p.count).keys()];
      nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); P.push(v.x, v.y, v.z);
        if (nn) { v.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 1, 0);
        U.push(uu ? uu.getX(i) : 0, uu ? uu.getY(i) : 0);
      }
      const ini = I.length; for (let i = 0; i < idx.length; i += 3) I.push(idx[i] + base, idx[i + 1] + base, idx[i + 2] + base);
      geo.addGroup(ini, I.length - ini, mi); base += p.count;
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
    return (cacheArbol[k] = { geo, mat: mats.length === 1 ? mats[0] : mats });
  }
  // Máscara de ventanas: lo claro y cálido de la textura de color (las ventanas prendidas
  // que pintó Tripo, amarillo pálido). Es el emissiveMap de la cabaña: así se prende y se
  // apaga sin inventar vidrios encima del modelo. Umbral medido sobre la textura de la
  // cabaña (r > 125, r − b > 40, g > 80: ~1 % de la textura).
  const mascaras = {};
  function mascaraVentanas(n) {
    if (n in mascaras) return mascaras[n];
    let mapa = null; const L = listos[n];
    if (L) L.escena.traverse((o) => { if (!mapa && o.isMesh && o.material && o.material.map) mapa = o.material.map; });
    const img = mapa && mapa.image; if (!img) return (mascaras[n] = null);
    const T = 512, c = document.createElement("canvas"); c.width = c.height = T; const g = c.getContext("2d");
    g.drawImage(img, 0, 0, T, T); const d = g.getImageData(0, 0, T, T), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const on = p[i] > 125 && p[i] - p[i + 2] > 40 && p[i + 1] > 80; p[i] = on ? 255 : 0; p[i + 1] = on ? 190 : 0; p[i + 2] = on ? 120 : 0; p[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = mapa.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = mapa.wrapS; t.wrapT = mapa.wrapT;
    return (mascaras[n] = t);
  }
  return { cargar, clonar, geoArbol, mascaraVentanas, listos, AJUSTES };
})();
