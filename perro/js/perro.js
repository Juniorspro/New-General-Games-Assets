// El perro: cargarlo, pararlo derecho y hacerlo caminar.
//
// ═══════════════════════════════════════════════════════════════════════════
// DOS CAMINOS PARA ANIMARLO, Y EL SEGUNDO ES EL QUE SIEMPRE ESTA.
// ═══════════════════════════════════════════════════════════════════════════
// 1. Si el GLB viene con esqueleto y clips —o sea que el riggeo automatico
//    acepto el bicho— se usan esos clips con un AnimationMixer.
// 2. Si no viene con nada, se le arma un esqueleto ACA: los vertices se
//    reparten en regiones por su posicion (cuatro patas, cuerpo, cabeza, cola),
//    se crea un hueso por region y se pinta el peso de cada vertice segun a que
//    distancia esta de su hueso. De ahi sale una `SkinnedMesh` de verdad, que
//    se anima con senos y cosenos.
//
// EL CAMINO 2 EXISTE PORQUE EL RIGGEO AUTOMATICO ESTA HECHO PARA HUMANOIDES.
// Con un perro puede devolver un esqueleto con las piernas donde no van, o
// directamente fallar. Y sin esqueleto, un perro que se desliza por el pasto
// con las patas tiesas se ve peor que cualquier otra cosa del juego.
import * as THREE from "../vendor/three.module.min.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { M } from "./mundo.js";
import { ruta } from "./assets.js";
import { altura, normal } from "./terreno.js";

// ───────────────────────────────────────────────────────────────────────────
// DOS NUMEROS QUE SALEN DE MIRAR EL MODELO, NO DE SUPONERLO.
// Los generadores de imagen a 3D ignoran la orientacion que se les pide: el
// modelo sale mirando para donde quiere. `pruebas/orientar.mjs` lo renderiza a
// ocho angulos en una hoja y de ahi se leen los dos:
//
//  · GIRO_MODELO — cuanto girarlo para que el hocico apunte a donde camina.
//    Medido: a 0 rad el perro ya mira a +Z, que es adelante. Queda en 0.
//  · HOCICO — en que punta del eje largo esta la cabeza, +1 si esta en el
//    extremo mayor y -1 si esta en el menor. Medido: +1.
//    ESTE ES EL QUE MUERDE. Sin el, el rig le pone la cabeza a la cola y la
//    cola a la cabeza: el perro camina con el culo adelante moviendo las
//    orejas, y como la silueta es simetrica de lejos, en una captura no se ve.
// ───────────────────────────────────────────────────────────────────────────
export let GIRO_MODELO = 0;
export let HOCICO = 1;
export function ponGiroModelo(rad) { GIRO_MODELO = rad; }
export function ponHocico(s) { HOCICO = s < 0 ? -1 : 1; }

const CLIP = { quieto: ["idle", "quieto"], camina: ["walk", "walking", "camina"],
               corre: ["run", "running", "corre"] };

export function cargaPerro(esc, listo, falla) {
  new GLTFLoader().load(ruta("assets/perro.glb"), (gltf) => {
    const raiz = gltf.scene;

    // EL TAMAÑO SE NORMALIZA SIEMPRE. Los generadores ignoran las medidas en
    // centimetros que se les piden, asi que el modelo llega con la escala que
    // se le ocurrio; se mide la caja y se lleva al alto que pide el juego.
    const caja = new THREE.Box3().setFromObject(raiz);
    const tam = caja.getSize(new THREE.Vector3());
    const k = M.ALTO_PERRO / Math.max(0.0001, tam.y);
    raiz.scale.setScalar(k);

    // y despues se apoya: el centro en el origen y la panza en y=0
    const caja2 = new THREE.Box3().setFromObject(raiz);
    const c = caja2.getCenter(new THREE.Vector3());
    raiz.position.x -= c.x; raiz.position.z -= c.z;
    raiz.position.y -= caja2.min.y;

    raiz.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = false;   // se sombrea solo y se le raya el lomo
        if (o.material) { o.material.side = THREE.FrontSide; o.material.shadowSide = THREE.BackSide; }
      }
    });

    const pivote = new THREE.Group();
    pivote.add(raiz);
    esc.add(pivote);

    const conClips = gltf.animations && gltf.animations.length > 0;
    const bicho = conClips ? conMixer(pivote, raiz, gltf) : conRigPropio(pivote, raiz);
    bicho.pivote = pivote;
    bicho.conClips = conClips;
    listo(bicho);
  }, undefined, (e) => falla && falla(e));
}

/* --- camino 1: el GLB ya trae animaciones --------------------------------
   ═══════════════════════════════════════════════════════════════════════════
   EL SERVICIO DE RIGGEO DEVUELVE UNA SOLA ANIMACION: `preset:quadruped:walk`.
   ═══════════════════════════════════════════════════════════════════════════
   Se le pidieron walk, run e idle en tres llamadas distintas y las tres
   volvieron con el mismo preset de caminar (comprobado con `gltf-transform
   inspect` sobre los tres archivos). O sea que no hay clip de correr, y no lo
   va a haber.
   Correr NO es caminar rapido: si solo se acelera el clip, el perro mueve las
   patitas a toda velocidad con la misma zancada corta y se ve como una pelicula
   pasada de rosca. Lo que cambia de verdad al correr es que la zancada se ABRE,
   el cuerpo rebota mas y el bicho se inclina hacia adelante.
   Asi que el correr se arma SOBRE el clip de caminar: se acelera, y ademas se
   exagera lo que el clip ya hace en las patas, separando el hueso de su reposo
   mas de lo que el clip lo separa. Como sale del mismo movimiento, las patas
   siguen cayendo en la misma fase y no se desarma. */
function conMixer(pivote, raiz, gltf) {
  const mez = new THREE.AnimationMixer(raiz);
  const busca = (nombres) => gltf.animations.find((a) =>
    nombres.some((n) => a.name.toLowerCase().includes(n)));
  const acc = {};
  for (const k in CLIP) {
    const cl = busca(CLIP[k]);
    if (cl) { acc[k] = mez.clipAction(cl); acc[k].play(); acc[k].setEffectiveWeight(0); }
  }
  // Si no hay clip de caminar con ese nombre, se usa el primero que haya: mejor
  // el unico clip del archivo que ninguno.
  const andar = acc.camina || mez.clipAction(gltf.animations[0]);
  andar.play(); andar.setEffectiveWeight(1);

  /* QUE HUESOS SON PATAS. No hay nombres fiables —el preset los llama como se
     le ocurre—, asi que se miden: los huesos cuyo reposo cae en la mitad de
     abajo de la caja del bicho son las patas. Es la misma regla que usa el rig
     propio, y por eso las dos ramas se comportan igual. */
  const caja = new THREE.Box3().setFromObject(raiz);
  const corte = caja.min.y + (caja.max.y - caja.min.y) * 0.52;
  const patas = [], reposo = new Map();
  const mundo = new THREE.Vector3();
  raiz.updateMatrixWorld(true);
  raiz.traverse((o) => {
    if (!o.isBone) return;
    reposo.set(o, o.quaternion.clone());
    o.getWorldPosition(mundo);
    if (mundo.y < corte) patas.push(o);
  });
  let raizHueso = null;
  raiz.traverse((o) => { if (o.isBone && !raizHueso) raizHueso = o; });
  const reposoRaiz = raizHueso ? raizHueso.position.clone() : null;

  const Q = new THREE.Quaternion();
  let faseAnt = -1;

  return {
    paso(dt, vel, t) {
      const corre = vel > M.VEL_CORRE * 0.62;
      const andando = vel > 0.3;
      andar.setEffectiveWeight(andando ? 1 : 0.18);   // quieto: respira, no se clava
      // EL CLIP VA AL RITMO DEL PISO. Con la velocidad del clip fija el perro
      // patina: las patas van a un ritmo y el suelo pasa a otro. La division es
      // por la velocidad con la que el clip fue pensado, o sea la de caminar.
      andar.setEffectiveTimeScale(andando ? Math.max(0.35, vel / M.VEL_CAMINA * 0.62) : 0.5);
      mez.update(dt);

      if (andando) {
        // LA ZANCADA SE ABRE. `slerp` desde el reposo con factor mayor que 1
        // extrapola: el hueso se va MAS LEJOS de lo que el clip lo manda, que es
        // exactamente lo que distingue un trote de una caminata apurada.
        const k = corre ? 1.55 : 1.12;
        for (const h of patas) {
          const r = reposo.get(h);
          if (!r) continue;
          Q.copy(r).slerp(h.quaternion, k);
          h.quaternion.copy(Q);
        }
        if (raizHueso && reposoRaiz) {
          // el rebote del lomo, al doble de frecuencia que la zancada porque en
          // un trote hay dos apoyos por ciclo
          const f = andar.time / Math.max(0.001, andar.getClip().duration) * Math.PI * 4;
          raizHueso.position.y = reposoRaiz.y +
            Math.abs(Math.sin(f)) * (corre ? 0.055 : 0.018) * (caja.max.y - caja.min.y);
        }
      } else if (raizHueso && reposoRaiz) {
        raizHueso.position.y = reposoRaiz.y;
      }

      // LA PISADA SALE DE LA FASE DEL CLIP, no de un temporizador aparte: asi
      // el ruido cae cuando la pata toca y no un poco antes o un poco despues,
      // que es lo unico que lo hace creible.
      if (andando) {
        const dur = Math.max(0.001, andar.getClip().duration);
        const fase = Math.floor((andar.time / dur) * 4) % 4;   // cuatro apoyos
        if (fase !== faseAnt) { faseAnt = fase; return corre ? "fuerte" : "suave"; }
      } else faseAnt = -1;
      return null;
    },
    ladrido() {},
  };
}

/* --- camino 2: el esqueleto se arma aca ----------------------------------
   Se busca LA malla con mas vertices: los generadores a veces devuelven la
   malla buena mas un plano de suelo o un cubo suelto. */
function mallaPrincipal(raiz) {
  let m = null;
  raiz.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.attributes.position &&
        (!m || o.geometry.attributes.position.count > m.geometry.attributes.position.count)) m = o;
  });
  return m;
}

function conRigPropio(pivote, raiz) {
  const malla = mallaPrincipal(raiz);
  if (!malla) return { paso() {}, ladrido() {} };

  const g = malla.geometry;
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const tam = bb.getSize(new THREE.Vector3());
  const min = bb.min;

  // QUE EJE ES EL LARGO DEL PERRO. No se supone: se mide. El perro es mas
  // largo que ancho, asi que el eje horizontal mas grande es el del hocico a
  // la cola. Suponerlo es lo que hace que las patas queden en los costados.
  const largoEsX = tam.x >= tam.z;
  const L = largoEsX ? "x" : "z";       // a lo largo
  const A = largoEsX ? "z" : "x";       // a lo ancho
  const largo = largoEsX ? tam.x : tam.z;
  const ancho = largoEsX ? tam.z : tam.x;

  const pos = g.attributes.position;
  const v = new THREE.Vector3();

  // Las patas son lo de abajo; el resto es cuerpo, cabeza y cola.
  const CORTE_PATA = min.y + tam.y * 0.46;

  // A que region pertenece cada vertice. 0..3 patas, 4 cuerpo, 5 cabeza, 6 cola
  const HUESOS = 7;
  const region = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const l = (v[L] - min[L]) / largo;          // 0 en una punta, 1 en la otra
    const a = (v[A] - min[A]) / ancho;          // 0 un costado, 1 el otro
    // `h` va de 0 en la cola a 1 en el hocico, sea cual sea la punta en la que
    // el generador dejo la cabeza. Todo lo de abajo razona en ESTA coordenada
    // y no en la del modelo, asi que un modelo dado vuelta no invierte nada.
    const h = HOCICO > 0 ? l : 1 - l;
    if (v.y < CORTE_PATA) {
      region[i] = (h < 0.5 ? 0 : 2) + (a < 0.5 ? 0 : 1);   // traseras/delanteras, izq/der
    } else if (h > 0.80) region[i] = 5;          // la punta de adelante: cabeza
    else if (h < 0.14) region[i] = 6;            // la de atras: cola
    else region[i] = 4;
  }

  // El centro de cada region: de ahi cuelga su hueso.
  const cen = [], cont = new Array(HUESOS).fill(0);
  for (let b = 0; b < HUESOS; b++) cen.push(new THREE.Vector3());
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    cen[region[i]].add(v); cont[region[i]]++;
  }
  for (let b = 0; b < HUESOS; b++) if (cont[b]) cen[b].divideScalar(cont[b]);

  // LA CADERA DE CADA PATA VA ARRIBA DE LA PATA, NO EN SU CENTRO. Girando desde
  // el centro, la pata rota como una aguja de reloj clavada en la rodilla: el
  // pie sube y el muslo baja al mismo tiempo. Desde arriba, la pata pendulea
  // como una pata.
  for (let b = 0; b < 4; b++) cen[b].y = CORTE_PATA;

  const huesos = [];
  const cuerpo = new THREE.Bone();
  cuerpo.position.copy(cen[4]);
  huesos.push(cuerpo);
  for (let b = 0; b < HUESOS; b++) {
    if (b === 4) continue;
    const h = new THREE.Bone();
    h.position.copy(cen[b]).sub(cen[4]);   // relativo al cuerpo
    cuerpo.add(h);
    huesos.push(h);
  }
  // huesos[0]=cuerpo, 1..4 = patas 0..3, 5 = cabeza, 6 = cola
  const PATA = [1, 2, 3, 4], CABEZA = 5, COLA = 6;
  const aHueso = [1, 2, 3, 4, 0, CABEZA, COLA];   // region -> indice de hueso

  // EL PESO SE SUAVIZA EN EL BORDE DE LA REGION. Con peso 1 al hueso de su
  // region y nada mas, la malla se PARTE en la union de la pata con el cuerpo:
  // un vertice va con la pata y el de al lado se queda, y queda un tajo. Cada
  // vertice se reparte entre su hueso y el del cuerpo segun lo cerca que este
  // del corte.
  const idx = new Uint16Array(pos.count * 4);
  const pes = new Float32Array(pos.count * 4);
  const MARGEN = tam.y * 0.14;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = region[i], h = aHueso[r];
    let w = 1;
    if (r < 4) {
      // cerca del corte, la pata se mezcla con el cuerpo
      w = Math.min(1, Math.max(0, (CORTE_PATA - v.y) / MARGEN));
    } else if (r === 5 || r === 6) {
      const l = (v[L] - min[L]) / largo;
      const h = HOCICO > 0 ? l : 1 - l;
      const d = r === 5 ? (h - 0.80) : (0.14 - h);
      w = Math.min(1, Math.max(0, d / 0.12));
    }
    idx[i * 4] = h; pes[i * 4] = w;
    idx[i * 4 + 1] = 0; pes[i * 4 + 1] = 1 - w;   // el resto se lo lleva el cuerpo
  }
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(pes, 4));

  const piel = new THREE.SkinnedMesh(g, malla.material);
  piel.castShadow = true;
  piel.frustumCulled = false;     // al deformarse, la caja que three calcula
                                  // queda vieja y el perro desaparece de golpe
  const esq = new THREE.Skeleton(huesos);
  piel.add(cuerpo);
  piel.bind(esq);

  // La malla original se reemplaza por la de piel, en su mismo sitio.
  malla.parent.add(piel);
  piel.position.copy(malla.position);
  piel.quaternion.copy(malla.quaternion);
  piel.scale.copy(malla.scale);
  malla.parent.remove(malla);

  // El reposo de cada hueso, para animar SOBRE el y no desde cero.
  const reposo = huesos.map((h) => h.position.clone());
  const alturaPata = CORTE_PATA - min.y;

  // EL TROTE: las patas van cruzadas. Delantera izquierda con trasera derecha.
  // Es como camina un perro de verdad, y ademas es lo que lo mantiene parado:
  // con las dos de un lado a la vez el bicho se cae para ese lado.
  // Orden de las patas por region: 0 = frente-A, 1 = frente-B, 2 = atras-A,
  // 3 = atras-B. El cruce es 0 con 3 y 1 con 2.
  const FASE = [0, Math.PI, Math.PI, 0];

  // EL SIGNO DE TODO LO QUE SE INCLINA, EN UN SOLO SITIO. Junta las dos cosas
  // que cambian de modelo a modelo: sobre que eje esta el largo del bicho y en
  // que punta de ese eje quedo la cabeza. Repartido por las seis lineas que lo
  // usan, alcanza con equivocarse en una para que el perro corra inclinado
  // hacia atras y nadie sepa por que.
  const EJE = largoEsX ? "z" : "x";
  const SIG = (largoEsX ? 1 : -1) * HOCICO;

  let ciclo = 0, ladrandoT = -9, ultimaPisada = -1;
  return {
    /** @returns 'pisada' cuando una pata acaba de tocar el suelo */
    paso(dt, vel, t) {
      const corre = vel > M.VEL_CORRE * 0.62;
      const andando = vel > 0.25;
      // El ciclo avanza con la DISTANCIA recorrida, no con el tiempo: asi la
      // pata toca el suelo siempre en el mismo punto del piso y el perro no
      // patina. Es la misma razon por la que arriba se escala el clip.
      const largoPaso = corre ? 2.35 : 1.28;
      ciclo += (vel / largoPaso) * dt * Math.PI * 2;

      const amp = andando ? (corre ? 0.85 : 0.52) : 0;
      const sube = andando ? (corre ? 0.16 : 0.07) : 0;

      for (let i = 0; i < 4; i++) {
        const h = huesos[PATA[i]];
        const f = ciclo + FASE[i];
        h.rotation[EJE] = Math.sin(f) * amp * SIG;
        // la pata se encoge en el aire y se estira al apoyar
        h.position.y = reposo[PATA[i]].y + Math.max(0, Math.cos(f)) * sube * alturaPata;
      }

      // EL CUERPO SUBE AL DOBLE DE FRECUENCIA QUE LAS PATAS: en un trote hay
      // dos apoyos por ciclo, asi que el lomo rebota dos veces. A la misma
      // frecuencia se ve como si cojeara.
      const reb = andando ? Math.abs(Math.sin(ciclo)) * (corre ? 0.10 : 0.035) : 0;
      cuerpo.position.y = reposo[0].y + reb * M.ALTO_PERRO;
      // y se inclina hacia adelante cuando corre, como un bicho que empuja
      cuerpo.rotation[EJE] =
        ((corre ? -0.10 : andando ? -0.04 : 0) + Math.sin(ciclo * 2) * (andando ? 0.02 : 0)) * SIG;

      // la cabeza acompaña, y al ladrar se levanta
      const lad = Math.max(0, 1 - (t - ladrandoT) / 0.42);
      const cab = huesos[CABEZA];
      cab.rotation[EJE] = (Math.sin(ciclo) * (andando ? 0.05 : 0) + lad * 0.42) * SIG;
      cab.position.y = reposo[CABEZA].y + lad * 0.05 * M.ALTO_PERRO;

      // LA COLA SIEMPRE SE MUEVE, tambien quieto: un perro con la cola quieta
      // parece de piedra. Mas rapido cuando corre y mucho mas al ladrar.
      const vel_cola = andando ? (corre ? 15 : 9) : 4.5;
      huesos[COLA].rotation.y = Math.sin(t * vel_cola) * (0.32 + lad * 0.5);
      huesos[COLA].rotation[EJE] = (0.12 + lad * 0.3) * SIG;

      // Cuando una pata toca, hay pisada. Se avisa desde aca y no con un
      // temporizador aparte para que el sonido caiga cuando la pata TOCA.
      if (andando) {
        const mitad = Math.floor(ciclo / Math.PI);
        if (mitad !== ultimaPisada) { ultimaPisada = mitad; return corre ? "fuerte" : "suave"; }
      } else ultimaPisada = -1;
      return null;
    },
    ladrido(t) { ladrandoT = t; },
  };
}

/** Apoya y orienta al perro sobre el terreno. Aparte de la animacion a
 *  proposito: esto vale para los dos caminos. */
const N = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0);
const Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
export function apoya(pivote, x, z, rumbo) {
  pivote.position.set(x, altura(x, z), z);
  // El giro propio del modelo se suma al rumbo: uno es del arte y el otro del
  // juego, y mezclarlos en una sola variable hace que cambiar el modelo
  // obligue a tocar la logica.
  Q.setFromAxisAngle(ARRIBA, rumbo + GIRO_MODELO);
  // Y SE INCLINA CON LA PENDIENTE. Sin esto el perro va derecho como una tabla
  // por una loma y se le ven las patas hundidas de un lado.
  normal(x, z, N);
  Q2.setFromUnitVectors(ARRIBA, N);
  pivote.quaternion.copy(Q2).multiply(Q);
}
