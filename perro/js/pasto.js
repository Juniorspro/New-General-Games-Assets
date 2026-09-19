// El pasto: decenas de miles de matas que se mueven con el viento.
//
// ═══════════════════════════════════════════════════════════════════════════
// UNA SOLA MALLA INSTANCIADA, Y EL VIENTO EN LA TARJETA.
// ═══════════════════════════════════════════════════════════════════════════
// Cuarenta mil matas son cuarenta mil objetos si se hacen mal: cuarenta mil
// llamadas de dibujo por cuadro y el telefono no llega ni a diez cuadros por
// segundo. Con `InstancedMesh` es UNA llamada, y la posicion de cada mata viaja
// como un atributo.
// Y EL VAIVEN NO SE CALCULA EN JAVASCRIPT. Moverlas desde el bucle obliga a
// tocar cuarenta mil matrices por cuadro y subirlas a la tarjeta enteras. El
// vaiven se hace en el shader del vertice: la tarjeta lo resuelve en paralelo y
// desde el bucle solo se manda UN numero, el tiempo.
import * as THREE from "../vendor/three.module.min.js";
import { M } from "./mundo.js";
import { altura } from "./terreno.js";

/* Una mata: tres tiras cruzadas no, UNA hoja de cuatro triangulos que se
   afina hacia la punta. Cruzar hojas duplica el dibujo para que se vea desde
   todos lados; a esta densidad no hace falta, porque las matas vecinas ya
   tapan los huecos y cuestan la mitad. */
function hojaGeom() {
  // EL TAMAÑO DE UNA MATA, EN UNIDADES DEL MUNDO. El perro mide 1,35 de alto;
  // la primera version tenia la mata en 1 y con la variacion llegaba a 1,4, o
  // sea que el pasto era mas alto que el perro y parecia un juncal. A 0,34 le
  // llega a la panza, que es lo que hace que se vea campo.
  const alto = 0.34, ancho = 0.030, seg = 4;

  // CADA INSTANCIA ES UN MATOJO DE TRES HOJAS, NO UNA HOJA SUELTA.
  //
  // Con una hoja por instancia, doce mil matas sobre un disco de radio 30 dan
  // cuatro por metro cuadrado: de lejos se ve pasto ralo y de cerca se ven
  // pinches sueltos. Subir la cuenta de instancias es lo caro —cada una es una
  // matriz que hay que componer y subir cada vez que se resiembra—, pero
  // agregar triangulos DENTRO de la instancia es casi gratis: la geometria se
  // sube una sola vez y la tarjeta la repite.
  // Tres hojas abiertas en abanico triplican lo que tapa cada mata sin tocar el
  // trabajo por instancia.
  const HOJAS = 3;
  const pos = [], uv = [], idx = [];
  for (let h = 0; h < HOJAS; h++) {
    const giro = (h / HOJAS) * Math.PI * 2 + 0.4;
    const cos = Math.cos(giro), sin = Math.sin(giro);
    const sep = 0.035;                       // cuanto se abren desde el centro
    const esc = h === 0 ? 1 : 0.76 + h * 0.07;
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const w = ancho * (1 - t * 0.92);
      const curva = t * t * 0.16 * esc;
      // la hoja se dibuja en su eje y se gira al lugar que le toca del abanico
      for (const lado of [-1, 1]) {
        const x = lado * w, z = curva;
        pos.push(cos * x - sin * (z + sep) , t * alto * esc, sin * x + cos * (z + sep));
        uv.push(lado < 0 ? 0 : 1, t);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function armaPasto(cuantas) {
  const g = hojaGeom();

  // Cada mata lleva su semilla: sin esto todas se doblan al mismo tiempo y el
  // campo late como una sola cosa en vez de ondular.
  const semillas = new Float32Array(cuantas);
  const altos = new Float32Array(cuantas);
  const tintes = new Float32Array(cuantas);

  const mat = new THREE.MeshLambertMaterial({
    color: 0x6fae3d, side: THREE.DoubleSide,
  });

  // `onBeforeCompile` en vez de un ShaderMaterial propio: asi el pasto sigue
  // recibiendo la luz y la niebla del resto de la escena sin reescribir el
  // modelo de iluminacion entero.
  const reloj = { value: 0 };
  const viento = { value: M.VIENTO };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = reloj;
    sh.uniforms.uViento = viento;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        uniform float uT;
        uniform float uViento;
        attribute float aSemilla;
        attribute float aAlto;
        attribute float aTinte;
        varying float vTinte;
        varying float vY;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vTinte = aTinte;
        vY = uv.y;
        transformed.y *= aAlto;
        // EL DOBLEZ CRECE CON LA ALTURA AL CUADRADO: la base de la mata esta
        // clavada en la tierra y la punta es la que viaja. Con un doblez
        // parejo la mata se desliza entera y parece que patina.
        float f = uv.y * uv.y;
        float fase = aSemilla * 6.2831;
        // dos ondas de distinto largo: una es la racha que cruza el campo y la
        // otra el temblor propio de cada mata
        float racha = sin(uT * ${M.VIENTO_VEL.toFixed(2)} + instanceMatrix[3][0] * 0.09
                        + instanceMatrix[3][2] * 0.07);
        float propio = sin(uT * 2.7 + fase);
        float d = (racha * 0.75 + propio * 0.25) * uViento * f;
        transformed.x += d * 0.55;
        transformed.z += d * 0.42;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying float vTinte;
        varying float vY;`)
      // La punta mas clara y la base mas oscura. Es lo que hace que un campo
      // de un solo color se lea como pasto y no como alfombra.
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
        gl_FragColor.rgb *= mix(0.52, 1.18, vY) * vTinte;`);
  };

  const malla = new THREE.InstancedMesh(g, mat, cuantas);
  malla.castShadow = false;      // cuarenta mil sombras no se pagan, y el
  malla.receiveShadow = false;   // pasto ya se oscurece con la niebla y el tinte
  malla.frustumCulled = false;   // se resiembra alrededor del perro: la caja
                                 // que three calcula queda vieja y las hace
                                 // desaparecer de golpe
  malla.name = "pasto";

  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), eje = new THREE.Vector3(0, 1, 0);

  // Donde esta sembrada cada mata respecto del perro. Se guarda aparte para
  // poder MOVER el manchon entero sin volver a sortear nada.
  const rx = new Float32Array(cuantas), rz = new Float32Array(cuantas);
  for (let i = 0; i < cuantas; i++) {
    // Reparto en disco por raiz: sorteando el radio plano, las matas se
    // amontonan en el centro y el borde queda pelado.
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * M.PASTO_RADIO;
    rx[i] = Math.cos(a) * r; rz[i] = Math.sin(a) * r;
    semillas[i] = Math.random();
    altos[i] = 0.62 + Math.random() * 0.80;
    tintes[i] = 0.82 + Math.random() * 0.36;
  }
  g.setAttribute("aSemilla", new THREE.InstancedBufferAttribute(semillas, 1));
  g.setAttribute("aAlto", new THREE.InstancedBufferAttribute(altos, 1));
  g.setAttribute("aTinte", new THREE.InstancedBufferAttribute(tintes, 1));

  let cx = 1e9, cz = 1e9;      // centro del manchon sembrado

  /** Vuelve a apoyar todas las matas alrededor de (px,pz). Es lo unico que
   *  cuesta, y por eso solo se hace cuando el perro se corrio de verdad. */
  function resiembra(px, pz) {
    for (let i = 0; i < cuantas; i++) {
      const x = px + rx[i], z = pz + rz[i];
      p.set(x, altura(x, z), z);
      q.setFromAxisAngle(eje, semillas[i] * Math.PI * 2);
      s.set(1, 1, 1);
      m.compose(p, q, s);
      malla.setMatrixAt(i, m);
    }
    malla.instanceMatrix.needsUpdate = true;
    cx = px; cz = pz;
  }

  return {
    malla,
    /** @param t segundos desde que arranco; @param px,pz donde esta el perro */
    paso(t, px, pz) {
      reloj.value = t;
      // RESEMBRAR SOLO CUANDO HACE FALTA. Hacerlo todos los cuadros cuesta
      // cuarenta mil composiciones de matriz por cuadro para nada: hasta que el
      // perro no se corrio unos metros, el manchon de antes sigue sirviendo.
      const d = Math.hypot(px - cx, pz - cz);
      if (d > M.PASTO_RADIO * 0.12) resiembra(px, pz);
    },
    resiembra,
  };
}

/** Cuantas matas aguanta este aparato.
 *
 *  SE DECIDE MIRANDO EL APARATO Y NO CON UN NUMERO FIJO: la misma cifra que va
 *  fluida en una compu deja un telefono a doce cuadros por segundo. No hay una
 *  forma honesta de preguntar "cuanta tarjeta tenes", asi que se usa lo que si
 *  se puede saber —nucleos, memoria y si es pantalla tactil— y despues el
 *  bucle ajusta segun lo que mide de verdad. */
export function cuantasMatas() {
  const n = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const tactil = matchMedia("(pointer: coarse)").matches;
  let v = M.PASTO_MAX;
  if (tactil) v *= 0.42;
  if (n <= 4) v *= 0.62;
  if (mem <= 4) v *= 0.70;
  return Math.max(M.PASTO_MIN, Math.round(v));
}
