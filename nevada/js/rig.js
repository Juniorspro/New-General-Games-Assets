/* ============================================================================
   nevada/js/rig.js — el esqueleto del tigre, armado acá.
   El riggeo automático de Rezona devuelve una caminata de perro con las patas
   en tijera (está anotado en perro/README.md), así que el modelo llega quieto
   y el esqueleto se arma midiendo la malla:
   - cada pata tiene DOS huesos: cadera (arriba de la pata, no en su centro,
     para que pendulee como una pata y no como una aguja) y rodilla, que
     dobla la mano hacia atrás en las delanteras y el garrón hacia adelante
     en las traseras, que es como doblan en un felino;
   - el cuerpo, la cabeza (con el cuello) y la cola, que en el tigre parado
     cuelga hasta el suelo por atrás de las patas: se la separa por el largo
     y no por la altura, si no el pie de la cola sería una quinta pata;
   - los pesos se suavizan en cada corte, si no la malla se parte.
   La caminata es la de un felino: paso lateral, una pata por vez (trasera
   izquierda, delantera izquierda, trasera derecha, delantera derecha), y no
   el trote cruzado del perro.
   ========================================================================== */
import * as THREE from 'three';

export function mallaPrincipal(raiz) {
  let m = null;
  raiz.traverse((o) => { if (o.isMesh && (!m || o.geometry.attributes.position.count > m.geometry.attributes.position.count)) m = o; });
  return m;
}

/* El tigre parado: largo en Z con la cabeza hacia +Z (medido en la hoja de
   pruebas), alto en Y. Devuelve la malla con piel y un paso(dt, vel) que
   mueve las patas según la distancia recorrida. */
export function rigTigre(malla, { depurar = false } = {}) {
  const g = malla.geometry;
  g.computeBoundingBox();
  const bb = g.boundingBox, min = bb.min, tam = bb.getSize(new THREE.Vector3());
  const pos = g.attributes.position, n = pos.count, v = new THREE.Vector3();

  const CORTE = min.y + tam.y * 0.47;          // la panza: abajo de esto, patas
  const RODILLA = min.y + tam.y * 0.23;        // mitad de la pata
  const h = (z) => (z - min.z) / tam.z;        // 0 en la cola, 1 en el hocico

  /* dónde empiezan las patas de atrás: lo más atrasado que toca el suelo sin
     ser la cola (la cola es finita y va por el centro) */
  let atrasPatas = 1;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y < min.y + tam.y * 0.08 && Math.abs(v.x - (min.x + tam.x / 2)) > tam.x * 0.12) atrasPatas = Math.min(atrasPatas, h(v.z));
  }
  const COLA = Math.max(0.04, atrasPatas - 0.015);
  const CABEZA = 0.80;
  const cx = min.x + tam.x / 2;

  /* región por vértice: 0..3 patas (0 trasera izq, 1 trasera der, 2 delantera izq, 3 delantera der), 4 cuerpo, 5 cabeza, 6 cola */
  const region = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    const l = h(v.z);
    if (l < COLA) region[i] = 6;
    else if (v.y < CORTE && l < CABEZA) region[i] = (l < 0.5 ? 0 : 2) + (v.x < cx ? 0 : 1);
    else if (l > CABEZA) region[i] = 5;
    else region[i] = 4;
  }
  /* cada pata es una columna, con el eje sacado de lo que está abajo de la
     rodilla (eso seguro es pata). Lo que queda abajo del corte pero lejos de
     esa columna es la panza, y va con el cuerpo: si no, al balancearse la
     pata la arrastra y bajo el tigre queda colgando una lona */
  const eje = Array.from({ length: 4 }, () => ({ x: 0, z: 0, n: 0, r: tam.z * 0.06 }));
  const distEje = [[], [], [], []];
  for (let paso = 0; paso < 2; paso++) {
    for (let i = 0; i < n; i++) {
      if (region[i] > 3) continue;
      v.fromBufferAttribute(pos, i);
      if (v.y > RODILLA) continue;
      const e = eje[region[i]];
      if (paso === 0) { e.x += v.x; e.z += v.z; e.n++; } else distEje[region[i]].push(Math.hypot(v.x - e.x, v.z - e.z));
    }
    if (paso === 0) eje.forEach((e) => { if (e.n) { e.x /= e.n; e.z /= e.n; } });
  }
  distEje.forEach((d, b) => { if (d.length) { d.sort((a, c) => a - c); eje[b].r = d[Math.floor(d.length * 0.9)]; } });
  const enColumna = (b, p) => {
    if (p.y <= RODILLA) return 1;
    const e = eje[b], x = (Math.hypot(p.x - e.x, p.z - e.z) - e.r * 1.3) / (e.r * 1.2);
    const k = Math.min(1, Math.max(0, x));
    return 1 - k * k * (3 - 2 * k);
  };

  const cen = Array.from({ length: 7 }, () => new THREE.Vector3()), cont = new Array(7).fill(0);
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i); cen[region[i]].add(v); cont[region[i]]++; }
  cen.forEach((c, b) => cont[b] && c.divideScalar(cont[b]));

  /* los huesos: cuerpo → caderas → rodillas; cuerpo → cuello/cabeza; cuerpo → cola */
  const cuerpo = new THREE.Bone(); cuerpo.position.copy(cen[4]);
  const huesos = [cuerpo];
  const caderas = [], rodillas = [];
  for (let b = 0; b < 4; b++) {
    const cad = new THREE.Bone(); cad.position.set(cen[b].x, CORTE, cen[b].z).sub(cen[4]);
    const rod = new THREE.Bone(); rod.position.set(0, RODILLA - CORTE, 0);
    cuerpo.add(cad); cad.add(rod);
    huesos.push(cad, rod); caderas.push(cad); rodillas.push(rod);
  }
  const cabeza = new THREE.Bone(); cabeza.position.set(cx, min.y + tam.y * 0.72, min.z + tam.z * CABEZA).sub(cen[4]);
  const cola = new THREE.Bone(); cola.position.set(cx, min.y + tam.y * 0.66, min.z + tam.z * (COLA + 0.02)).sub(cen[4]);
  cuerpo.add(cabeza, cola); huesos.push(cabeza, cola);
  const I_CAB = 9, I_COLA = 10;   // índices en huesos[]

  /* pesos: cada vértice entre su hueso y el de arriba, según lo cerca del corte */
  const idx = new Uint16Array(n * 4), pes = new Float32Array(n * 4);
  const M_CAD = tam.y * 0.1, M_ROD = tam.y * 0.07;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    const r = region[i], l = h(v.z);
    if (r < 4) {
      const iCad = 1 + r * 2, iRod = iCad + 1;
      const wCad = Math.min(1, Math.max(0, (CORTE - v.y) / M_CAD)) * enColumna(r, v);   // cuánto es pata y no cuerpo
      const wRod = Math.min(1, Math.max(0, (RODILLA + M_ROD * 0.5 - v.y) / M_ROD)); // cuánto es de abajo de la rodilla
      idx.set([iRod, iCad, 0, 0], i * 4);
      pes.set([wCad * wRod, wCad * (1 - wRod), 1 - wCad, 0], i * 4);
    } else if (r === 5) {
      const w = Math.min(1, Math.max(0, (l - CABEZA) / 0.07));
      idx.set([I_CAB, 0, 0, 0], i * 4); pes.set([w, 1 - w, 0, 0], i * 4);
    } else if (r === 6) {
      const w = Math.min(1, Math.max(0, (COLA - l) / 0.03));
      idx.set([I_COLA, 0, 0, 0], i * 4); pes.set([w, 1 - w, 0, 0], i * 4);
    } else { idx.set([0, 0, 0, 0], i * 4); pes.set([1, 0, 0, 0], i * 4); }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(pes, 4));
  if (depurar) {
    const PAL = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [0.8, 0.8, 0.8], [1, 0, 1], [0, 1, 1]];
    const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(PAL[region[i]], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  const piel = new THREE.SkinnedMesh(g, malla.material);
  piel.castShadow = true; piel.receiveShadow = true;
  piel.frustumCulled = false;
  piel.add(cuerpo);
  piel.bind(new THREE.Skeleton(huesos));
  malla.parent.add(piel);
  piel.position.copy(malla.position); piel.quaternion.copy(malla.quaternion); piel.scale.copy(malla.scale);
  malla.parent.remove(malla);

  const reposo = huesos.map((b) => b.position.clone());
  /* paso lateral: trasera izq 0, delantera izq ¼, trasera der ½, delantera der ¾ */
  const FASE = [0, 0.5, 0.25, 0.75].map((f) => f * Math.PI * 2);
  let ciclo = 0, tt = 0;
  const ZANCADA = tam.z * 0.62;
  return {
    piel, huesos,
    /** vel en unidades del modelo por segundo; zancada en las mismas unidades */
    paso(dt, vel, { zancada = ZANCADA, mira = 0 } = {}) {
      tt += dt;
      ciclo += (vel / zancada) * dt * Math.PI * 2;
      this.aplicar(vel, zancada, mira);
    },
    /** la pose de un instante, sin memoria (para la cinemática y sus fotos):
        lleva t segundos caminando y recorrió dist */
    pose(t, dist, vel, { zancada = ZANCADA, mira = 0 } = {}) {
      tt = t; ciclo = (dist / zancada) * Math.PI * 2;
      this.aplicar(vel, zancada, mira);
    },
    aplicar(vel, zancada, mira) {
      const anda = Math.min(1, vel / (zancada * 0.4));
      for (let b = 0; b < 4; b++) {
        const f = ciclo + FASE[b];
        const delantera = b >= 2;
        // la cadera va y viene; al volver para adelante la pata se levanta y dobla
        const vuelo = Math.max(0, -Math.sin(f));
        caderas[b].rotation.x = Math.cos(f) * (delantera ? 0.36 : 0.42) * anda;
        // (rotación en +x lleva lo de abajo hacia atrás: la mano delantera dobla
        // para atrás y el garrón trasero trae la pata para adelante)
        rodillas[b].rotation.x = vuelo * (delantera ? 0.8 : -0.6) * anda;
        caderas[b].position.y = reposo[1 + b * 2].y + vuelo * tam.y * 0.02 * anda;
      }
      // el lomo sube y baja dos veces por ciclo, y rola un poco con cada lado
      cuerpo.position.y = reposo[0].y + (Math.abs(Math.cos(ciclo)) - 0.5) * tam.y * 0.012 * anda;
      cuerpo.rotation.z = Math.sin(ciclo) * 0.025 * anda;
      // la cabeza va baja y firme (así camina un felino que acecha) y mira a donde le digan
      huesos[I_CAB].rotation.x = 0.06 * anda + Math.sin(ciclo * 2) * 0.02 * anda;
      huesos[I_CAB].rotation.y = mira * 0.5;
      // la cola se hamaca siempre, lenta
      huesos[I_COLA].rotation.y = Math.sin(tt * 1.4) * 0.22;
      huesos[I_COLA].rotation.x = -0.1 + Math.sin(tt * 0.9) * 0.06;
    },
  };
}

/* Un cuerpo quieto que respira, con una cabeza que puede mirar: para el tigre
   echado. La cabeza son los vértices dentro de una esfera alrededor de su
   centro (se pasa en coordenadas de la malla). */
export function rigEchado(malla, { centroCabeza, radioCabeza, cuello }) {
  const g = malla.geometry, pos = g.attributes.position, n = pos.count, v = new THREE.Vector3();
  const idx = new Uint16Array(n * 4), pes = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.distanceTo(centroCabeza);
    const w = Math.min(1, Math.max(0, (radioCabeza - d) / (radioCabeza * 0.35)));
    idx.set([1, 0, 0, 0], i * 4); pes.set([w, 1 - w, 0, 0], i * 4);
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(pes, 4));
  const raiz = new THREE.Bone();
  const cab = new THREE.Bone(); cab.position.copy(cuello); raiz.add(cab);
  const piel = new THREE.SkinnedMesh(g, malla.material);
  piel.castShadow = true; piel.receiveShadow = true; piel.frustumCulled = false;
  piel.add(raiz); piel.bind(new THREE.Skeleton([raiz, cab]));
  malla.parent.add(piel);
  piel.position.copy(malla.position); piel.quaternion.copy(malla.quaternion); piel.scale.copy(malla.scale);
  malla.parent.remove(malla);
  let tt = 0;
  return {
    piel,
    paso(dt, op = {}) { this.pose(tt + dt, op); },
    /** la pose a los t segundos, sin memoria */
    pose(t, { mira = 0, respira = 1 } = {}) {
      tt = t;
      const r = Math.sin(tt * 1.25) * 0.012 * respira;
      raiz.scale.set(1 + r * 0.6, 1 + r, 1);
      cab.rotation.y = mira + Math.sin(tt * 0.37) * 0.05;
      cab.rotation.x = Math.sin(tt * 0.51) * 0.03;
    },
  };
}
