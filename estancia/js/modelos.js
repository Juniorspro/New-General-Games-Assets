// Los modelos de Rezona: la vaca, el caballo y el Guacho con esqueleto y
// animación, la chata y los rollos.
//
// Vienen embebidos en datos.js como GLB (GUIA-JUEGOS.md § 10): se parsean desde
// la memoria, sin fetch, así el juego anda desde file://. Cada modelo se
// normaliza una vez: mira hacia +z, tiene el tamaño real y apoya en y = 0.
// Después se clona las veces que haga falta (SkeletonUtils: cada vaca tiene
// su propio esqueleto).
//
// Si un modelo no está, el juego usa el animal armado por código (el plan B de
// la guía): nadie depende de que esto cargue.
"use strict";
(() => {
  const M = (E.modelos = { listos: {} });
  const V = THREE.Vector3;

  // Cómo se acomoda cada uno. rot: giro en y para que mire a +z (null = se
  // calcula con los pies). medida: qué eje mide cuánto. centroZ: dónde queda el
  // centro de la caja, para que calce con el esqueleto lógico del animal.
  // roles: los huesos que el juego usa por nombre.
  const AJUSTES = {
    // La vaca y el caballo se mueven con marcha.js (su caminata de Rezona no
    // sirve); los roles son los huesos donde se ata el lazo.
    vaca: { rot: Math.PI, medida: ["z", 2.35], centroZ: 0.3,
      roles: { cuello: "bone_15", cabeza: "tripoHead_1", lomo: "tripoSpine_1" } },
    caballo: { rot: -Math.PI / 2, medida: ["z", 2.45], centroZ: 0.3,
      roles: { cuello: "tripoHead_1", cabeza: "tripoHead_3", lomo: "tripoSpine_1", cola: "tripoTail_0" } },
    guacho: { rot: null, medida: ["y", 1.74], centroZ: 0,
      roles: { cadera: "Hip", cabeza: "Head", brazoD: "R_Upperarm", codoD: "R_Forearm", manoD: "R_Hand",
        brazoI: "L_Upperarm", codoI: "L_Forearm", musloI: "L_Thigh", musloD: "R_Thigh", rodillaI: "L_Calf", rodillaD: "R_Calf", torso: "Spine01" } },
    // El toro viene como la vaca (la cabeza a -z); el perro, al revés.
    toro: { rot: Math.PI, medida: ["z", 2.6], centroZ: 0.3,
      roles: { cuello: "tripoHead_0", cabeza: "tripoHead_2", lomo: "tripoSpine_1" } },
    perro: { rot: 0, medida: ["y", 0.72], centroZ: 0, roles: { cabeza: "tripoHead_2", lomo: "tripoSpine_2" } },
    heladera: { rot: 0, medida: ["y", 1.55], centroZ: 0 },
    silla: { rot: 0, medida: ["y", 0.92], centroZ: 0 },
    pava: { rot: 0, medida: ["max", 0.26], centroZ: 0 },
    chata: { rot: Math.PI / 2, medida: ["z", 5.2], centroZ: 0 },
    rollo: { rot: 0, medida: ["max", 1.5], centroZ: 0 },
  };

  function bytes(dato) {
    const b64 = dato.slice(dato.indexOf(",") + 1), s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u.buffer;
  }

  function cargador() {
    const l = new THREE.GLTFLoader();
    // Las texturas como <img> y no con fetch: fetch falla desde file:// (§ 10).
    l.register((parser) => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: "texturas_como_imagen" }; });
    return l;
  }

  // Los GLB vienen comprimidos con gzip (armar_datos.py): se descomprimen con
  // DecompressionStream, que anda también desde file://.
  async function glb(A, n) {
    if (A[n + ".glb"]) return bytes(A[n + ".glb"]);
    if (!A[n + ".glb.gz"] || typeof DecompressionStream === "undefined") return null;
    const flujo = new Blob([bytes(A[n + ".glb.gz"])]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(flujo).arrayBuffer();
  }
  M.cargar = async () => {
    const A = window.ARCHIVOS || {}, l = cargador();
    const nombres = Object.keys(AJUSTES).filter((n) => A[n + ".glb"] || A[n + ".glb.gz"]);
    await Promise.all(nombres.map(async (n) => {
      let buf = null;
      try { buf = await glb(A, n); } catch (e) { console.warn("modelo " + n, e); }
      if (!buf) return;
      await new Promise((ok) => l.parse(buf, "", (g) => { try { preparar(n, g); } catch (e) { console.warn("modelo " + n, e); } ok(); }, (e) => { console.warn("modelo " + n, e); ok(); }));
    }));
    // Las animaciones del Guacho que vinieron aparte (mismo esqueleto).
    const gu = M.listos.guacho;
    if (gu) for (const n of ["idle", "run"]) {
      const j = A["clip-guacho-" + n + ".json"];
      if (!j) continue;
      const c = THREE.AnimationClip.parse(typeof j === "string" ? JSON.parse(j) : j); c.name = n; gu.clips[n] = c;
      // La carrera ya viene sin avance (se lo sacó armar_datos): 5 m por
      // vuelta de 1,27 s, medido antes de sacarlo.
      if (n === "run") gu.velClip.run = 3.9;
    }
    return nombres;
  };
  M.hay = (n) => !!M.listos[n];

  function preparar(nombre, g) {
    const aj = AJUSTES[nombre], esc = g.scene;
    esc.updateMatrixWorld(true);
    let rot = aj.rot;
    if (rot === null) {
      // El frente sale de los pies: del talón a la punta.
      const pie = esc.getObjectByName("L_Foot"), punta = esc.getObjectByName("L_ToeBase");
      const d = punta.getWorldPosition(new V()).sub(pie.getWorldPosition(new V()));
      rot = -Math.atan2(d.x, d.z);
    }
    // Primero se gira, después se mide la caja ya girada.
    const piv = new THREE.Group();
    piv.rotation.y = rot;
    piv.add(esc);
    piv.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(esc), t = caja.getSize(new V());
    const [eje, largo] = aj.medida;
    const s = largo / (eje === "max" ? Math.max(t.x, t.y, t.z) : t[eje]);
    const c = caja.getCenter(new V());
    // La escena queda así: raíz (la mueve el juego) > pivote (giro y escala) > gltf.
    const off = new V(-c.x, -caja.min.y, aj.centroZ / s - c.z);
    esc.position.add(off.clone().applyAxisAngle(new V(0, 1, 0), -rot));
    piv.scale.setScalar(s);
    piv.updateMatrixWorld(true);
    esc.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      // La caja de recorte de una malla con esqueleto es la del reposo (§ 4.3).
      if (o.isSkinnedMesh) o.frustumCulled = false;
      const m = o.material;
      if (m) { m.roughness = Math.max(m.roughness ?? 1, 0.7); m.metalness = 0; if (m.map) m.map.anisotropy = 4; }
    });
    const clips = {};
    for (const a of g.animations) clips[a.name.toLowerCase().includes("walk") || g.animations.length === 1 ? "walk" : a.name] = a;
    M.listos[nombre] = { piv, clips, escala: s, tam: t.multiplyScalar(s), velClip: {} };
    if (nombre === "guacho") avances(M.listos[nombre]);
  }

  // La caminata del Guacho trae avance de raíz: la cadera se va ~1 m para
  // adelante en cada vuelta y vuelve de golpe (el eje es la "y" de Root,
  // que viene girado). Se camina en el lugar —el avance lo pone el juego— y
  // lo que avanzaba da a qué velocidad hay que pasar el clip para que el pie
  // no patine.
  function quitarAvance(clip, hueso, escala) {
    const tr = clip.tracks.find((x) => x.name === hueso + ".position");
    if (!tr) return 0;
    const v = tr.values, n = tr.times.length, t0 = tr.times[0], t1 = tr.times[n - 1];
    let avance = 0;
    for (let k = 0; k < 3; k++) {
      const d = v[(n - 1) * 3 + k] - v[k];
      if (Math.abs(d) < 0.02 || t1 <= t0) continue;
      avance = Math.max(avance, Math.abs(d));
      for (let i = 0; i < n; i++) v[i * 3 + k] -= (d * (tr.times[i] - t0)) / (t1 - t0);
    }
    return (avance * escala) / Math.max(1e-3, clip.duration);
  }
  function avances(L) {
    const raiz = L.piv.getObjectByName("Root");
    const escala = raiz ? raiz.getWorldScale(new V()).x : L.escala;
    for (const [n, c] of Object.entries(L.clips)) {
      const vel = quitarAvance(c, "Hip", escala);
      if (vel > 0.2) L.velClip[n] = vel;
    }
  }

  // El pelaje de cada raza sobre la textura de la Hereford: la textura trae el
  // cuero colorado (luminancia lineal ~0,05) y lo blanco (~0,46) bien
  // separados, así que en el shader se reparte cada píxel entre "cuerpo" y
  // "blanco" y se pinta con los colores de la raza, conservando el sombreado
  // del pelo (la luminancia relativa). Multiplicar el color no alcanzaba: una
  // Angus quedaba colorada oscura con la cara blanca.
  // pelaje: { cuerpo, blanco (THREE.Color, lineales), guarda (0..1: cuánto de
  // lo blanco queda blanco), manchas (0..1, overa), semilla }
  function conPelaje(mat, pj) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCuerpo = { value: pj.cuerpo }; sh.uniforms.uBlanco = { value: pj.blanco };
      sh.uniforms.uGuarda = { value: pj.guarda }; sh.uniforms.uManchas = { value: pj.manchas || 0 }; sh.uniforms.uSemilla = { value: pj.semilla || 0 };
      sh.vertexShader = "varying vec3 vPosPelaje;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPosPelaje = position;");
      sh.fragmentShader = "varying vec3 vPosPelaje; uniform vec3 uCuerpo, uBlanco; uniform float uGuarda, uManchas, uSemilla;\n" + sh.fragmentShader.replace("#include <map_fragment>", `
        #ifdef USE_MAP
          vec4 texelColor = texture2D(map, vMapUv);
          float lumP = dot(texelColor.rgb, vec3(0.299, 0.587, 0.114));
          float blancoP = smoothstep(0.1, 0.28, lumP);
          float sombraP = clamp(mix(lumP / 0.048, lumP / 0.456, blancoP), 0.35, 1.7);
          vec3 q = vPosPelaje * 6.0 + uSemilla;
          float nP = sin(q.x * 1.3 + sin(q.z * 0.9)) * sin(q.z * 1.1 + 1.7 * sin(q.y * 1.4)) * sin(q.y * 1.7 + q.x * 0.5);
          float manchaP = uManchas * smoothstep(0.02, 0.16, nP);
          float b = max(blancoP * uGuarda, manchaP);
          texelColor.rgb = mix(uCuerpo, uBlanco, b) * sombraP;
          diffuseColor *= texelColor;
        #endif`);
    };
    mat.customProgramCacheKey = () => "pelaje";
  }

  // Un clon listo para poner en la escena. tinte: multiplica el color base.
  M.clonar = (nombre, { tinte, sinClips, pelaje } = {}) => {
    const L = M.listos[nombre];
    if (!L) return null;
    const raiz = new THREE.Group();
    const piv = THREE.SkeletonUtils.clone(L.piv);
    raiz.add(piv);
    const huesos = {}, mallas = [];
    piv.traverse((o) => {
      if (o.isBone) huesos[o.name] = o;
      if (o.isMesh) {
        mallas.push(o);
        if (tinte) { o.material = o.material.clone(); o.material.color.multiply(tinte); }
        if (pelaje) { o.material = o.material.clone(); conPelaje(o.material, pelaje); }
      }
    });
    const roles = {};
    for (const [r, n] of Object.entries(AJUSTES[nombre].roles || {})) if (huesos[n]) roles[r] = huesos[n];
    const r = { raiz, piv, huesos, roles, mallas, acciones: {}, mixer: null, velClip: L.velClip };
    // La pose de reposo: cada cuadro se vuelve a ella antes de animar, así un
    // giro sumado por código nunca se acumula en los huesos que el clip no toca.
    r.reposo = Object.values(huesos).map((h) => [h, h.quaternion.clone(), h.position.clone()]);
    // El recorte por cámara con una esfera medida en la pose de reposo y
    // agrandada: las animaciones van en el lugar, así que no se sale de ella.
    // Sin esto (frustumCulled = false) se dibujaban las 18 vacas siempre,
    // también detrás de la cámara y en la pasada de sombras.
    // La esfera es la misma para todos los clones: se mide una vez (recorrer
    // 20 mil vértices con esqueleto por cada vaca demoraba la carga).
    raiz.updateMatrixWorld(true);
    L.esferas = L.esferas || [];
    mallas.forEach((o, i) => {
      if (!o.isSkinnedMesh) return;
      o.frustumCulled = true;
      if (!L.esferas[i]) { o.computeBoundingSphere(); o.boundingSphere.radius *= 1.6; L.esferas[i] = o.boundingSphere.clone(); }
      else o.boundingSphere = L.esferas[i].clone();
    });
    if (!sinClips && Object.keys(L.clips).length) {
      r.mixer = new THREE.AnimationMixer(piv);
      for (const [n, c] of Object.entries(L.clips)) {
        const a = r.mixer.clipAction(c);
        a.play(); a.setEffectiveWeight(0);
        r.acciones[n] = a;
      }
    }
    return r;
  };

  M.reponer = (m) => { for (const [h, q, pos] of m.reposo) { h.quaternion.copy(q); h.position.copy(pos); } };

  // Gira un hueso alrededor de un eje de la raíz del modelo (x: el costado,
  // y: arriba, z: el frente), encima de lo que dejó la animación. Así no hace
  // falta saber cómo vienen orientados los huesos de cada modelo.
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qr = new THREE.Quaternion(), ejeW = new V();
  M.girar = (m, hueso, eje, ang) => {
    if (!hueso || !ang) return;
    m.raiz.getWorldQuaternion(qr);
    ejeW.copy(eje).applyQuaternion(qr);
    hueso.parent.getWorldQuaternion(qp);
    qa.setFromAxisAngle(ejeW, ang);
    // local' = padre⁻¹ · giro · padre · local
    hueso.quaternion.premultiply(qp.clone().invert().multiply(qa).multiply(qp));
    hueso.updateMatrixWorld(true);
  };
  M.X = new V(1, 0, 0); M.Y = new V(0, 1, 0); M.Z = new V(0, 0, 1);

  // Mezcla de acciones: pesos = { idle: 0.3, walk: 0.7 }, veloc = timeScale.
  M.mezclar = (m, pesos, veloc = {}) => {
    for (const [n, a] of Object.entries(m.acciones)) {
      a.setEffectiveWeight(pesos[n] || 0);
      a.setEffectiveTimeScale(veloc[n] ?? 1);
    }
  };

  // Pega un objeto (caravana, marca) al hueso más cercano del modelo, donde
  // cayó el rayo, mirando para afuera.
  M.pegar = (m, obj, punto, normal) => {
    let mejor = null, md = Infinity;
    const p = new V();
    for (const h of Object.values(m.huesos)) { const d = h.getWorldPosition(p).distanceTo(punto); if (d < md) { md = d; mejor = h; } }
    obj.position.copy(punto).addScaledVector(normal, 0.012);
    obj.lookAt(p.copy(punto).add(normal));
    (mejor || m.raiz).attach(obj);
  };

  // Para medir el modelo al cargar (el lomo, la panza, el recado): copias
  // quietas de las mallas. En reposo el esqueleto no mueve nada, y un rayo
  // contra una malla con esqueleto recalcula sus 20 mil triángulos: con las
  // copias, la carga bajó varios segundos.
  M.quietas = (m) => {
    if (m.quietas) return m.quietas;
    m.raiz.updateMatrixWorld(true);
    m.quietas = m.mallas.map((o) => {
      // Los vértices como los dibuja el esqueleto (la geometría cruda no
      // coincide: el modelo se escaló después de atarle el esqueleto).
      let geo = o.geometry;
      if (o.isSkinnedMesh) {
        const pos = o.geometry.attributes.position, arr = new Float32Array(pos.count * 3), v = new V();
        for (let i = 0; i < pos.count; i++) { o.getVertexPosition(i, v); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; }
        geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
        if (o.geometry.index) geo.setIndex(o.geometry.index);
      }
      const q = new THREE.Mesh(geo, o.material);
      q.matrixAutoUpdate = false; q.matrixWorld.copy(o.matrixWorld);
      return q;
    });
    return m.quietas;
  };
  // A qué altura está el lomo (para el recado y el jinete): un rayo de arriba.
  M.alturaLomo = (m, z = 0) => {
    m.raiz.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(m.raiz.localToWorld(new V(0, 6, z)), new V(0, -1, 0).transformDirection(m.raiz.matrixWorld));
    const hit = ray.intersectObjects(M.quietas(m), false)[0];
    return hit ? m.raiz.worldToLocal(hit.point).y : null;
  };
})();
