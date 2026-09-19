// El campo: lomas suaves de pasto.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA ALTURA SE CALCULA UNA SOLA VEZ Y SE GUARDA EN UNA REJILLA.
// ═══════════════════════════════════════════════════════════════════════════
// La tentacion es tener una funcion `altura(x,z)` que evalue el ruido y usarla
// en dos sitios: para levantar los vertices de la malla y para apoyar al perro.
// Eso se ve bien en una captura y esta mal: la malla es PLANA entre vertice y
// vertice, asi que en el medio de un cuadro la superficie que se ve esta por
// debajo de lo que dice la funcion. El perro flota en las lomas y se hunde en
// los valles, con un error que crece justo donde la pendiente es mas fuerte —
// o sea donde mas se nota.
//
// Aca el ruido se evalua UNA vez por vertice, se guarda, y `altura()` devuelve
// la interpolacion bilineal de ESA rejilla: exactamente el plano que dibuja la
// tarjeta. El perro apoya sobre lo que se ve, no sobre lo que se calculo.
import * as THREE from "../vendor/three.module.min.js";
import { M, SEMILLA } from "./mundo.js";

/* --- ruido ---------------------------------------------------------------
   Ruido de valor con interpolacion suave, sembrado. No hace falta Perlin: a
   esta escala se ven lomas, y lo que importa es que la derivada sea continua
   para que no queden aristas. */
// EL HASH VA CON `Math.imul` Y NO CON `*`.
//
// La primera version multiplicaba con `*` y usaba constantes de las que se
// escriben en un hash de C. En JavaScript los numeros son coma flotante de 64
// bits: cualquier producto de dos enteros grandes se pasa de los 53 bits que
// esa coma flotante puede representar exacto y empieza a REDONDEAR. Los bits de
// abajo —que son justamente los que un hash usa— se pierden.
// El sintoma no fue un error: `valor()` devolvia casi siempre lo mismo, el
// terreno salia PLANO y el perro aparecia parado a -7,4 en todo el campo. Un
// campo plano se ve como un campo, asi que desde una captura no hay forma de
// darse cuenta; se encontro midiendo la altura en dos puntos lejanos y viendo
// que daba el mismo numero.
// `Math.imul` hace la multiplicacion de enteros de 32 bits con desborde, que es
// lo que el hash necesita.
function mezclador(s) {
  const semilla = s | 0;
  return function (x, y) {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ semilla;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
}
const RUIDO = mezclador(SEMILLA);
const suave = (t) => t * t * (3 - 2 * t);

function valor(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = suave(x - xi), yf = suave(y - yi);
  const a = RUIDO(xi, yi), b = RUIDO(xi + 1, yi);
  const c = RUIDO(xi, yi + 1), d = RUIDO(xi + 1, yi + 1);
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
}

/* Cuatro octavas: la primera pone las lomas grandes y las otras el relieve
   chico. Mas de cuatro no se ve y cuesta igual. */
function fbm(x, y) {
  let v = 0, amp = 1, frec = 1, tot = 0;
  for (let i = 0; i < 4; i++) {
    v += valor(x * frec, y * frec) * amp;
    tot += amp; amp *= 0.5; frec *= 2.07;   // 2.07 y no 2: con el doble exacto
  }                                          // las octavas se alinean y se ve
  return v / tot;                            // un patron cuadriculado
}

const N = M.REJILLA + 1;
const ALT = new Float32Array(N * N);
const PASO = M.LADO / M.REJILLA;

for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = -M.LADO / 2 + i * PASO, z = -M.LADO / 2 + j * PASO;
    let h = (fbm(x * M.ESCALA_LOMA, z * M.ESCALA_LOMA) - 0.5) * 2 * M.ALTO_LOMA;
    // EL BORDE BAJA. Sin esto el campo termina en un acantilado recto contra el
    // cielo y se ve el truco; bajando los ultimos metros, el horizonte queda
    // limpio desde cualquier punto donde se pueda estar parado.
    const d = Math.max(Math.abs(x), Math.abs(z)) / (M.LADO / 2);
    if (d > 0.82) h -= (d - 0.82) / 0.18 * (h + M.ALTO_LOMA + 5);
    ALT[j * N + i] = h;
  }
}

/** La altura del suelo en un punto, interpolada de la MISMA rejilla que dibuja
 *  la malla. Fuera del campo devuelve el borde, que ya esta hundido. */
export function altura(x, z) {
  const fi = (x + M.LADO / 2) / PASO, fj = (z + M.LADO / 2) / PASO;
  const i = Math.max(0, Math.min(N - 2, Math.floor(fi)));
  const j = Math.max(0, Math.min(N - 2, Math.floor(fj)));
  const tx = Math.max(0, Math.min(1, fi - i)), tz = Math.max(0, Math.min(1, fj - j));
  const a = ALT[j * N + i],     b = ALT[j * N + i + 1];
  const c = ALT[(j + 1) * N + i], d = ALT[(j + 1) * N + i + 1];
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
}

/** La normal del suelo, sacada de la misma rejilla por diferencias centradas.
 *  Sirve para inclinar al perro con la pendiente. */
export function normal(x, z, fuera = new THREE.Vector3()) {
  const e = PASO;
  const hx = altura(x + e, z) - altura(x - e, z);
  const hz = altura(x, z + e) - altura(x, z - e);
  return fuera.set(-hx, 2 * e, -hz).normalize();
}

/** Hasta donde se puede caminar: adentro del borde que todavia esta alto. */
export const LIMITE = M.LADO / 2 * 0.80;

export function armaTerreno() {
  const g = new THREE.PlaneGeometry(M.LADO, M.LADO, M.REJILLA, M.REJILLA);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  // EL ORDEN DE LOS VERTICES DE PlaneGeometry DESPUES DE ROTAR: la fila j
  // avanza en +z y la columna i en +x, que es el mismo orden en que se lleno
  // ALT. Se copia por indice y no por posicion para no volver a interpolar.
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++)
      pos.setY(j * N + i, ALT[j * N + i]);
  pos.needsUpdate = true;
  g.computeVertexNormals();

  // EL COLOR VA EN LOS VERTICES Y NO EN UNA TEXTURA: un campo de 260 unidades
  // con una textura de pasto repetida se ve como una grilla desde el aire, y
  // una textura lo bastante grande para no repetirse no entra en memoria.
  // Variando el verde con la altura y con un poco de ruido, el ojo lee relieve.
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i, h = ALT[k];
      const t = Math.max(0, Math.min(1, (h + M.ALTO_LOMA) / (2 * M.ALTO_LOMA)));
      const ruidito = valor(i * 0.31, j * 0.31) * 0.09;
      // los valles mas oscuros y humedos, las lomas mas secas y claras
      // EL SUELO ES DEL COLOR DE LA BASE DE LAS MATAS, NO DE OTRO VERDE.
      // Con el suelo mas claro que el pasto, cada mata se recorta contra el
      // fondo y el campo se ve de pinches clavados en una alfombra. Igualando
      // el tono, las matas parecen salir de ahi.
      // El tono 0,235 y la luz 0,17 salen del color del pasto (0x6fae3d) con el
      // oscurecimiento que el shader le pone a la base (x0,52).
      c.setHSL(0.235 - t * 0.014 + ruidito * 0.05,
               0.44 + (1 - t) * 0.12,
               0.155 + t * 0.085 + ruidito * 0.8);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const malla = new THREE.Mesh(g, mat);
  malla.receiveShadow = true;
  malla.name = "terreno";
  return malla;
}
