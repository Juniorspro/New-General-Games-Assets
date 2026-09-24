// La marcha de la vaca y el caballo de Rezona, por código.
//
// La caminata que trae el rig de Rezona no sirve: en la vaca mueve UNA sola
// pata delantera (la otra quedó con nombre genérico, bone_9..13, y la
// animación no la conoce) y mueve la cola como si fuera la cuarta pata. Y no
// hay trote ni galope: acelerada ×4, la caminata patina. Así que las patas se
// mueven acá, sobre los huesos de verdad, con la marcha que corresponde a la
// velocidad — la misma idea que el animal armado por código (animales.js).
//
// Cada pata es una cadena de dos tramos (arriba→rodilla o garrón, y de ahí al
// casco) resuelta con IK en el plano del costado: el casco apoyado se queda
// clavado en el piso mientras el cuerpo pasa por encima, y en el aire hace un
// arco. Las patas del modelo vienen casi rectas en reposo, así que para que el
// casco alcance el piso adelante y atrás el cuerpo baja un poco al trotar y
// al galopar, como hace un animal de verdad.
//
// Cada cuadro se arranca de la pose de reposo: los giros se suman encima y
// nunca se acumulan de un cuadro al otro (el bug de los cuellos que giraban).
"use strict";
(() => {
  const Mc = (E.marcha = {});
  const V = THREE.Vector3;

  // Los huesos, por nombre, mirados en el esqueleto (no en el nombre que les
  // puso Rezona: en la vaca "tripo1_Left_Limb" es la cola). En el marco del
  // modelo: +z adelante, +x a la izquierda del animal.
  // patas: [delantera o trasera, arriba (de donde cuelga la pata), medio
  //         (babilla o codo: solo para las posturas), bajo (rodilla o garrón:
  //         donde se dobla), punta (el menudillo: lo que pisa)]
  const ESQUELETOS = {
    vaca: {
      patas: {
        DI: ["del", "tripo0_Right_Limb_1", "tripo0_Right_Limb_3", "tripo0_Right_Limb_4", "tripo0_Right_Limb_5"],
        DD: ["del", "bone_9", "bone_11", "bone_12", "bone_13"],
        TI: ["tra", "tripo0_Left_Limb_0", "tripo0_Left_Limb_1", "tripo0_Left_Limb_2", "tripo0_Left_Limb_4"],
        TD: ["tra", "tripo1_Right_Limb_0", "tripo1_Right_Limb_1", "tripo1_Right_Limb_2", "tripo1_Right_Limb_4"],
      },
      // Cuánto gira cada hueso del cuello (radianes) con la cabeza gacha del
      // todo, a pastar: la vaca tiene el cuello corto y casi horizontal.
      cuello: [["bone_14", 0.68], ["bone_15", 0.4], ["tripoHead_0", 0.27]],
      cabeza: "tripoHead_0",
      orejas: ["bone_17"],
      cola: ["bone_29", "bone_30", "tripo1_Left_Limb_0", "tripo1_Left_Limb_1"],
      bajaEchada: 0.6,
    },
    caballo: {
      patas: {
        DI: ["del", "tripo0_Left_Limb_0", "tripo0_Left_Limb_1", "tripo0_Left_Limb_2", "tripo0_Left_Limb_4"],
        DD: ["del", "tripo0_Right_Limb_0", "tripo0_Right_Limb_1", "tripo0_Right_Limb_2", "tripo0_Right_Limb_4"],
        TI: ["tra", "tripo1_Left_Limb_0", "tripo1_Left_Limb_1", "tripo1_Left_Limb_2", "tripo1_Left_Limb_4"],
        TD: ["tra", "tripo1_Right_Limb_0", "tripo1_Right_Limb_1", "tripo1_Right_Limb_2", "tripo1_Right_Limb_4"],
      },
      // El caballo lo lleva parado y la base del cuello está pesada en el
      // último hueso del lomo, del que cuelgan las manos: para llegar al pasto
      // baja desde ahí (si no, se enrosca como un caballito de mar) y las
      // manos se contra-giran para que sigan verticales.
      // La cabeza se contra-gira: con el cuello para abajo, si acompaña queda
      // doblada hacia el pecho en vez de apuntar al pasto.
      cuello: [["tripoSpine_3", 1.35], ["tripoHead_0", 0.22], ["tripoHead_1", 0.1], ["tripoHead_3", -0.5]],
      hombros: "tripoSpine_3",
      cabeza: "tripoHead_3",
      orejas: [],
      cola: ["tripoTail_0", "bone_33"],
      bajaEchada: 0.55,
    },
  };

  // Los aires. beta: qué parte de la vuelta la pata está apoyada. of: el
  // desfasaje de cada pata. f: vueltas por segundo según la velocidad (sube
  // con la velocidad para que el tranco no se haga más largo que la pata).
  // alza: cuánto sube el casco en el aire.
  const AIRES = {
    paso: { beta: 0.62, alza: 0.1, agacha: 0.03, of: { TI: 0, DI: 0.25, TD: 0.5, DD: 0.75 }, f: (v) => 0.6 + 0.42 * v },
    trote: { beta: 0.48, alza: 0.18, agacha: 0.07, of: { DI: 0, TD: 0, DD: 0.5, TI: 0.5 }, f: (v) => 1.3 + 0.17 * v },
    galope: { beta: 0.38, alza: 0.24, agacha: 0.12, of: { TI: 0, TD: 0.1, DI: 0.45, DD: 0.55 }, f: (v) => 1.45 + 0.19 * v },
  };

  // Ángulo de un tramo en el plano del costado, medido desde "para abajo":
  // positivo es hacia atrás (así gira un hueso con E.modelos.girar sobre +x).
  const ang = (dy, dz) => Math.atan2(-dz, -dy);

  Mc.preparar = (p, especie) => {
    const esq = ESQUELETOS[especie];
    if (!esq) return;
    p.raiz.updateMatrixWorld(true);
    const H = (n) => p.huesos[n] || null;
    const enModelo = (h) => p.raiz.worldToLocal(h.getWorldPosition(new V()));
    p.patas = {};
    for (const [k, [tipo, ...nombres]] of Object.entries(esq.patas)) {
      const b = nombres.map(H);
      if (b.some((x) => !x)) { p.patas = null; break; }
      const [arriba, , bajo, punta] = b;
      const P0 = enModelo(arriba), J = enModelo(bajo), T = enModelo(punta);
      p.patas[k] = {
        tipo, b, P0, T0: T,
        L1: Math.hypot(J.y - P0.y, J.z - P0.z), L2: Math.hypot(T.y - J.y, T.z - J.z),
        u0: ang(J.y - P0.y, J.z - P0.z), l0: ang(T.y - J.y, T.z - J.z),
        // La rodilla de adelante dobla para adelante; el garrón, para atrás.
        dobla: tipo === "del" ? -1 : 1,
      };
    }
    p.cuelloB = esq.cuello.map(([n, k]) => [H(n), k]).filter(([h]) => h);
    // Los agregados (cabeceo al andar, estirarse contra el lazo) se reparten
    // en proporción a cuánto gira cada hueso.
    const suma = p.cuelloB.reduce((a, [, k]) => a + Math.abs(k), 0) || 1;
    p.cuelloB = p.cuelloB.map(([h, k]) => [h, k, Math.abs(k) / suma]);
    p.hombrosB = esq.hombros ? H(esq.hombros) : null;
    p.cabezaB = H(esq.cabeza);
    p.orejasB = esq.orejas.map(H).filter(Boolean);
    p.colaB = esq.cola.map(H).filter(Boolean);
    // Cuánto baja para echarse: hasta apoyar la panza, medida con un rayo
    // desde el piso entre las patas (a ojo quedaba flotando).
    // (una vez por especie: todas las vacas son el mismo modelo)
    if (esq.panza === undefined) {
      const panza = (z) => {
        const o = p.raiz.localToWorld(new V(0, 0.02, z)), dir = new V(0, 1, 0).transformDirection(p.raiz.matrixWorld);
        const hit = new THREE.Raycaster(o, dir, 0, 3).intersectObjects(E.modelos.quietas(p), false)[0];
        return hit ? p.raiz.worldToLocal(hit.point.clone()).y : Infinity;
      };
      esq.panza = Math.min(panza(-0.15), panza(0.1), panza(0.35));
    }
    p.bajaEchada = isFinite(esq.panza) ? esq.panza + 0.04 : esq.bajaEchada;

    p.fase = Math.random();
    p.agacha = 0;
  };

  // En qué punto de su vuelta está una pata: s va de -1 (adelante) a +1
  // (atrás); alto, cuánto sube (en el aire).
  function pierna(fase, of, beta) {
    const ph = (((fase + of) % 1) + 1) % 1;
    if (ph < beta) return [2 * (ph / beta) - 1, 0];
    const u = (ph - beta) / (1 - beta), s = u * u * (3 - 2 * u);
    return [1 - 2 * s, Math.sin(Math.PI * u)];
  }

  // IK de dos tramos: devuelve [giro de arriba, giro de la rodilla] para que
  // la punta llegue a (y, z) en el marco del modelo.
  function ik(pt, y, z) {
    const dy = y - pt.P0.y, dz = z - pt.P0.z;
    const d = E.clamp(Math.hypot(dy, dz), Math.abs(pt.L1 - pt.L2) + 1e-3, pt.L1 + pt.L2 - 1e-3);
    const al = Math.acos(E.clamp((pt.L1 * pt.L1 + d * d - pt.L2 * pt.L2) / (2 * pt.L1 * d), -1, 1));
    const u = ang(dy, dz) + pt.dobla * al;
    const jy = pt.P0.y - pt.L1 * Math.cos(u), jz = pt.P0.z - pt.L1 * Math.sin(u);
    const l = ang(y - jy, z - jz);
    const du = u - pt.u0;
    return [du, l - pt.l0 - du];
  }

  const qT = new THREE.Quaternion();
  // e: { v (con signo, m/s), cabeza (0..1), echar, tumbe, tumbeT, muerta,
  //      tiron (0..1), cepo, mira (giro de la cabeza), moscas, t, num }
  Mc.animar = (p, e, dt) => {
    if (!p.patas) return;
    const M = E.modelos, X = M.X, Y = M.Y, Z = M.Z, g = (h, eje, a) => M.girar(p, h, eje, a);
    M.reponer(p);
    const va = Math.abs(e.v);
    // Qué aire, mezclado: nunca se salta de uno a otro de golpe.
    const aTrote = E.suave(1.7, 2.4, va), aGalope = E.suave(4.6, 5.6, va);
    const w = { paso: 1 - aTrote, trote: aTrote * (1 - aGalope), galope: aGalope };
    let f = 0, beta = 0, alza = 0, tope = 0;
    for (const [n, a] of Object.entries(AIRES)) { f += w[n] * a.f(va); beta += w[n] * a.beta; alza += w[n] * a.alza; tope += w[n] * a.agacha; }
    const quieto = E.suave(0.03, 0.3, va);
    if (quieto > 0) p.fase = (((p.fase + f * dt * Math.sign(e.v)) % 1) + 1) % 1;
    // Lo que avanza el casco apoyado tiene que ser lo que avanza el cuerpo:
    // si no, patina. S es el largo del apoyo.
    const S = (va * beta) / Math.max(f, 0.3);
    const caido = e.tumbe || e.muerta ? 1 : 0;
    const echar = e.echar || 0;
    const mover = quieto * (1 - echar) * (1 - caido);

    // Cuánto tiene que bajar el cuerpo para que la pata más corta llegue al
    // piso en las puntas del tranco (suavizado: el cuerpo no salta). Con un
    // tope por aire: agachada del todo camina como en cuclillas; lo que falta
    // lo pone el casco, que en la punta del tranco apenas se despega.
    let baja = 0;
    for (const pt of Object.values(p.patas)) {
      const h0 = pt.P0.y - pt.T0.y, dzm = Math.abs(pt.T0.z - pt.P0.z) + S / 2;
      const alcanza = Math.sqrt(Math.max(0, (pt.L1 + pt.L2) ** 2 * 0.985 - dzm * dzm));
      baja = Math.max(baja, h0 - alcanza);
    }
    p.agacha += (Math.min(tope, baja) * mover - p.agacha) * Math.min(1, dt * 4);

    // El cuerpo: el bote del paso, el cabeceo del galope, abajo si se echa.
    const ph = p.fase * Math.PI * 2;
    const bote = mover * (w.paso * -0.012 * Math.cos(2 * ph) + w.trote * 0.03 * Math.cos(2 * ph) + w.galope * 0.05 * Math.sin(ph));
    const cabeceo = mover * w.galope * 0.05 * Math.sin(ph + 1.2);
    const o = bote - p.agacha - echar * p.bajaEchada;
    p.raiz.position.y += o;
    if (cabeceo) p.raiz.quaternion.multiply(qT.setFromAxisAngle(X, cabeceo));
    p.raiz.updateMatrixWorld(true);
    const cb = Math.cos(cabeceo), sb = Math.sin(cabeceo);

    // El cuello: baja a pastar, cabecea al paso y al galope; al tirar del
    // lazo va estirado.
    const nodo = mover * (w.paso * 0.06 * Math.sin(2 * ph) + w.galope * 0.12 * Math.sin(ph + 0.4));
    const extra = nodo - (e.tiron || 0) * 0.35 - (e.muerta ? 0.4 : 0) + echar * 0.15;
    // Primero el cuello (antes que las patas): si baja desde el hueso del que
    // cuelgan las manos, las manos se contra-giran después.
    let contra = 0;
    for (const [h, rad, parte] of p.cuelloB) {
      const a = (e.cabeza || 0) * rad + extra * parte;
      g(h, X, a);
      if (h === p.hombrosB) contra = a;
    }
    for (const [k, pt] of Object.entries(p.patas)) {
      const [arriba, medio, bajo, punta] = pt.b, del = pt.tipo === "del";
      let du = 0, dl = 0, flick = 0;
      if (mover > 0.001) {
        let s = 0, alto = 0;
        for (const [n, a] of Object.entries(AIRES)) {
          if (w[n] < 0.001) continue;
          const [sn, an] = pierna(p.fase, a.of[k], a.beta);
          s += w[n] * sn; alto += w[n] * an;
        }
        // El casco, en el marco del modelo: el piso quedó a -o (el cuerpo
        // bajó o subió) y el cabeceo lo inclina.
        const z = pt.T0.z - s * (S / 2);
        const yMundo = pt.T0.y + alto * alza - o;
        const y = (yMundo + z * sb) / cb;
        [du, dl] = ik(pt, y, z);
        du *= mover; dl *= mover;
        flick = alto * mover;
      }
      // Posturas: plegada (echada), estirada (tumbada o muerta), afirmada
      // contra el lazo, forcejeando en el cepo.
      if (echar > 0) {
        if (del) { du += -1.25 * echar; dl += 2.7 * echar; }
        else { du += -1.0 * echar; dl += -2.3 * echar; }
      }
      if (caido) {
        const patalea = e.muerta ? 0 : Math.max(0, 1 - (e.tumbeT || 0) / 6) * Math.sin(e.t * 7 + (del ? 0 : 1.7) + (k[1] === "I" ? 0 : 2.4));
        du += del ? -0.55 + 0.25 * patalea : 0.5 + 0.25 * patalea;
        dl += del ? 0.2 : -0.1;
      }
      if (e.tiron) du += (del ? -0.3 : 0.25) * e.tiron * (1 - caido);
      if (e.cepo) du += Math.sin(e.t * 2.3 + (k === "DI" ? 0 : k === "DD" ? 2 : k === "TI" ? 4 : 1)) * 0.06 * e.cepo;
      g(arriba, X, du - (del ? contra : 0));
      if (!del && echar > 0) g(medio, X, 2.0 * echar);
      g(bajo, X, dl);
      // El casco se voltea un poco en el aire (el menudillo).
      g(punta, X, (del ? 0.6 : 0.5) * flick);
    }

    if (p.cabezaB) g(p.cabezaB, Y, (e.mira || 0) * (1 - (e.cabeza || 0) * 0.7));
    for (const oreja of p.orejasB) g(oreja, Z, Math.max(0, Math.sin(e.t * 0.9 + e.num * 3) - 0.85) * 2.5);

    // La cola espanta moscas (de costado: gira sobre el eje del frente) y se
    // levanta al galope.
    const mos = e.moscas || 1;
    p.colaB.forEach((h, i) => {
      g(h, Z, Math.sin(e.t * 2.1 * mos + e.num - i * 0.5) * (i ? 0.18 : 0.22) * mos);
      if (i === 0) g(h, X, 0.1 + 0.5 * w.galope * mover + (caido ? 0.3 : 0));
    });
  };
})();
