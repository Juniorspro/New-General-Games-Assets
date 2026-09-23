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
    // cuanto: cuánto se dobla cada hueso cuando el animal baja la cabeza a
    // pastar (el cuello de la vaca de Rezona arranca recién en la nuca).
    vaca: { rot: Math.PI, medida: ["z", 2.35], centroZ: 0.3, andar: 1.55, cuanto: { cuello: 1.3, cabeza: 0.4 },
      roles: { cuello: "tripoHead_0", cabeza: "tripoHead_1", lomo: "tripoSpine_1" } },
    caballo: { rot: -Math.PI / 2, medida: ["z", 2.45], centroZ: 0.3, andar: 1.35, cuanto: { cuello: 1.0, cabeza: 0.5 },
      roles: { cuello: "tripoSpine_3", cabeza: "tripoHead_2", nuca: "tripoHead_1", lomo: "tripoSpine_1", cola: "tripoTail_0" } },
    guacho: { rot: null, medida: ["y", 1.74], centroZ: 0,
      roles: { cadera: "Hip", cabeza: "Head", brazoD: "R_Upperarm", codoD: "R_Forearm", manoD: "R_Hand",
        brazoI: "L_Upperarm", codoI: "L_Forearm", musloI: "L_Thigh", musloD: "R_Thigh", rodillaI: "L_Calf", rodillaD: "R_Calf", torso: "Spine01" } },
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

  M.cargar = async () => {
    const A = window.ARCHIVOS || {}, l = cargador();
    const nombres = Object.keys(AJUSTES).filter((n) => A[n + ".glb"]);
    await Promise.all(nombres.map((n) => new Promise((ok) => {
      l.parse(bytes(A[n + ".glb"]), "", (g) => { try { preparar(n, g); } catch (e) { console.warn("modelo " + n, e); } ok(); }, (e) => { console.warn("modelo " + n, e); ok(); });
    })));
    // Las animaciones del Guacho que vinieron aparte (mismo esqueleto).
    const gu = M.listos.guacho;
    if (gu) for (const n of ["idle", "run"]) {
      const j = A["clip-guacho-" + n + ".json"];
      if (j) { const c = THREE.AnimationClip.parse(typeof j === "string" ? JSON.parse(j) : j); c.name = n; gu.clips[n] = c; }
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
    M.listos[nombre] = { piv, clips, escala: s, tam: t.multiplyScalar(s) };
  }

  // Un clon listo para poner en la escena. tinte: multiplica el color base.
  M.clonar = (nombre, { tinte } = {}) => {
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
      }
    });
    const roles = {};
    for (const [r, n] of Object.entries(AJUSTES[nombre].roles || {})) if (huesos[n]) roles[r] = huesos[n];
    const r = { raiz, piv, huesos, roles, mallas, acciones: {}, mixer: null, andar: AJUSTES[nombre].andar || 1.4, cuanto: AJUSTES[nombre].cuanto || { cuello: 0.8, cabeza: 0.6 } };
    if (Object.keys(L.clips).length) {
      r.mixer = new THREE.AnimationMixer(piv);
      for (const [n, c] of Object.entries(L.clips)) {
        const a = r.mixer.clipAction(c);
        a.play(); a.setEffectiveWeight(0);
        r.acciones[n] = a;
      }
    }
    return r;
  };

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

  // A qué altura está el lomo (para el recado y el jinete): un rayo de arriba.
  M.alturaLomo = (m, z = 0) => {
    m.raiz.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(m.raiz.localToWorld(new V(0, 6, z)), new V(0, -1, 0).transformDirection(m.raiz.matrixWorld));
    const hit = ray.intersectObjects(m.mallas, false)[0];
    return hit ? m.raiz.worldToLocal(hit.point).y : null;
  };
})();
