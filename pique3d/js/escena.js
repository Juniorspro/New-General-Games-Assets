// El mundo en tres dimensiones.
//
// La direccion sigue siendo 2D: el jugador corre en X y salta en Y, y nada se
// mueve en Z. Lo que es 3D es TODO lo que se ve — el terreno tiene volumen, la
// luz proyecta sombras de verdad, la camara tiene perspectiva y el fondo tiene
// profundidad. Eso es lo que se llama 2.5D y es a proposito: la profundidad
// hace que se vea bien, pero si ademas hubiera que apuntar en Z el juego
// dejaria de ser de un boton.
//
// UNA UNIDAD DEL MUNDO = UN TILE. La fisica trabaja en pixeles (16 por tile),
// asi que todo lo que entra al 3D se divide por T. Convertir en un solo lugar
// y no en cada linea es lo que evita el bug de "algo esta 16 veces mas lejos".

import * as THREE from "../vendor/three.module.min.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { T, V, ALTO_TILES, TEMAS, TILES_ANCHO, TILES_ALTO } from "./mundo.js";
import { ruta } from "./assets.js";

export const U = (px) => px / T;          // pixeles -> unidades del mundo
const PROF = 1;                            // grosor del terreno en Z

// --- renderer ------------------------------------------------------------
export function crearRenderer(lienzo) {
  const movil = matchMedia("(pointer: coarse)").matches;
  const ren = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: !movil,                     // en movil cuesta mas de lo que suma
    powerPreference: "high-performance",
    alpha: false,
  });
  // Tope de 2 en la densidad de pixeles. Un telefono moderno declara 3 o 3,5:
  // dibujar a esa resolucion cuesta el triple y NO se ve mejor, porque la
  // pantalla es de seis pulgadas.
  ren.setPixelRatio(Math.min(devicePixelRatio || 1, movil ? 1.75 : 2));
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.toneMapping = THREE.ACESFilmicToneMapping;
  ren.toneMappingExposure = 1.05;
  ren.shadowMap.enabled = true;
  ren.shadowMap.type = movil ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  return { ren, movil };
}

// --- escena base ---------------------------------------------------------
export function crearEscena(temaNombre, movil) {
  const tm = TEMAS[temaNombre];
  const esc = new THREE.Scene();

  // Cielo: un degrade en una esfera invertida. Un color plano de fondo deja el
  // horizonte muerto; el degrade da arriba y abajo sin costar nada.
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(300, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { arriba: { value: new THREE.Color(tm.cielo[0]) },
                  abajo: { value: new THREE.Color(tm.cielo[1]) } },
      vertexShader: `varying float h; void main(){ h = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 arriba; uniform vec3 abajo; varying float h;
        void main(){ gl_FragColor = vec4(mix(abajo, arriba, smoothstep(-0.25,0.6,h)), 1.0); }`,
    }));
  cielo.frustumCulled = false;
  esc.add(cielo);
  esc.fog = new THREE.FogExp2(new THREE.Color(tm.niebla), tm.nieblaDens);

  const hemi = new THREE.HemisphereLight(new THREE.Color(tm.cielo[0]),
                                         new THREE.Color(tm.ambiente), tm.ambInt);
  esc.add(hemi);

  const sol = new THREE.DirectionalLight(new THREE.Color(tm.luz), tm.luzInt);
  sol.castShadow = true;
  const s = movil ? 1024 : 2048;
  sol.shadow.mapSize.set(s, s);
  sol.shadow.camera.near = 1; sol.shadow.camera.far = 80;
  // La camara de sombra es ORTOGRAFICA y chica, y persigue al jugador. Una
  // caja que cubra el nivel entero reparte los mismos 2048 pixeles entre 200
  // tiles: la sombra sale hecha escalones y parece un error de dibujo.
  const c = sol.shadow.camera;
  c.left = -16; c.right = 16; c.top = 13; c.bottom = -13;
  sol.shadow.bias = -0.0012;
  sol.shadow.normalBias = 0.035;
  esc.add(sol, sol.target);

  const relleno = new THREE.DirectionalLight(new THREE.Color(tm.ambiente), 0.5);
  relleno.position.set(-4, 2, 6);
  esc.add(relleno);

  return { esc, sol, hemi, tm };
}

// --- camara --------------------------------------------------------------
export class Camara {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 400);
    this.x = 0; this.y = 0; this.dist = 20;
  }
  // La distancia se calcula para que SIEMPRE entren TILES_ANCHO de ancho y
  // TILES_ALTO de alto, sea cual sea la pantalla. Fijarla en un numero deja
  // al telefono en vertical viendo tres tiles: el jugador no ve lo que viene
  // y el juego se vuelve injusto por una razon que no tiene nada que ver con
  // el nivel.
  redimensionar(ancho, alto) {
    const asp = ancho / alto;
    this.cam.aspect = asp;
    const vFov = THREE.MathUtils.degToRad(this.cam.fov);
    const porAlto = (TILES_ALTO / 2) / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * asp);
    const porAncho = (TILES_ANCHO / 2) / Math.tan(hFov / 2);
    this.dist = Math.max(porAlto, porAncho);
    // Techo vertical. En un telefono parado, exigir 25 tiles de ancho obliga a
    // alejar tanto la camara que entran CINCUENTA Y CUATRO tiles de alto: el
    // nivel mide veinticuatro, asi que se ve el nivel entero y medio de vacio,
    // y el jugador queda del tamano de una hormiga. Se prefiere ver menos
    // ancho antes que eso; igual, en vertical el juego avisa que hay que girar.
    const distTope = (TILES_ALTO * 1.7 / 2) / Math.tan(vFov / 2);
    this.dist = Math.min(this.dist, distTope);
    this.cam.updateProjectionMatrix();
  }
  seguir(jx, jy, dt, brusco = false) {
    // Adelantado en X: el jugador corre para un lado, asi que la mitad util
    // de la pantalla es la de adelante.
    const objX = U(jx) + 3.2;
    const objY = -U(jy) + 1.6;
    const k = brusco ? 1 : 1 - Math.pow(0.0015, dt);
    this.x += (objX - this.x) * k;
    this.y += (objY - this.y) * k;
    this.cam.position.set(this.x, this.y + 1.2, this.dist);
    this.cam.lookAt(this.x, this.y - 0.4, 0);
  }
}

// --- texturas ------------------------------------------------------------
export function cargarTextura(url, repetir = 1) {
  const t = new THREE.TextureLoader().load(ruta(url));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(repetir, repetir);
  return t;
}

// --- el terreno ----------------------------------------------------------
// Se arma UNA malla con SOLO las caras que se ven, y las coordenadas de
// textura salen de la posicion en el mundo. Dos razones:
//
//  1. Con un cubo por tile y la textura entera en cada cara, un muro de
//     veinte tiles se ve como veinte estampillas repetidas — el ojo cuenta
//     los cubos. Con UV en espacio-mundo la textura corre continua y el muro
//     parece un muro.
//  2. Un nivel tiene ~2000 tiles solidos. Como cubos sueltos son 2000 objetos;
//     fusionados son uno, y el telefono dibuja uno.
//
// La cara de atras no se emite nunca: la camara esta siempre en +Z.
const CARAS = {
  frente: { n: [0, 0, 1],  v: [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]], uv: ["x","y"] },
  arriba: { n: [0, 1, 0],  v: [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]], uv: ["x","z"] },
  abajo:  { n: [0,-1, 0],  v: [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]], uv: ["x","z"] },
  izq:    { n: [-1,0, 0],  v: [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]], uv: ["z","y"] },
  der:    { n: [1, 0, 0],  v: [[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]], uv: ["z","y"] },
};

function agregarCara(datos, cara, cx, cy, escalaUV, tinte) {
  const { pos, nor, uv, idx, col } = datos;
  const base = pos.length / 3;
  for (const v of cara.v) {
    pos.push(cx + v[0], cy + v[1], v[2] * PROF);
    nor.push(...cara.n);
    const mundo = { x: cx + v[0], y: cy + v[1], z: v[2] * PROF };
    uv.push(mundo[cara.uv[0]] * escalaUV, mundo[cara.uv[1]] * escalaUV);
    col.push(tinte[0], tinte[1], tinte[2]);
  }
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const nuevoDatos = () => ({ pos: [], nor: [], uv: [], idx: [], col: [] });

function aGeometria(d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(d.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(d.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(d.col, 3));
  g.setIndex(d.idx);
  g.computeBoundingSphere();
  return g;
}

const SOLIDOS_TERRENO = new Set([V.SOLIDO]);

// Dos texturas y no una: la de arriba es la SUPERFICIE (pasto, arena, piedra
// pulida) y la de los costados es el CORTE del terreno (tierra, roca, tablas).
// Con una sola, el pasto trepaba por el paredon y se veia como cesped
// vertical — el ojo lo caza en el primer cuadro.
export function construirTerreno(nv, tm, texturaArriba, texturaLado) {
  const grupo = new THREE.Group();
  const lee = (tx, ty) => (tx < 0 || ty < 0 || tx >= nv.ancho || ty >= ALTO_TILES)
    ? V.NADA : nv.grilla[ty * nv.ancho + tx];
  // El eje Y del juego crece hacia ABAJO y el de three hacia ARRIBA. La
  // conversion va aca y en ningun otro lado.
  const mundoY = (ty) => -ty;

  const tierra = nuevoDatos(), tapa = nuevoDatos(), ladrillo = nuevoDatos(), plata = nuevoDatos();
  // El tinte por vertice es un BRILLO, no un color.
  //
  // La primera version tintaba cada cara con el color del tema. Eso multiplica
  // la textura: un marron #a86038 por una textura de pasto ambar da barro
  // rojo, y las ocho texturas generadas —que cada una trae su propio color—
  // terminaban todas del mismo tono sucio. Ahora la textura manda el color y
  // el tinte solo dice cuanta luz recibe esa cara: la de arriba entera, la de
  // frente un poco menos, los costados en sombra. Es lo que le da volumen al
  // cubo sin necesitar una segunda textura.
  const BRILLO = { arriba: 1.0, frente: 0.78, lado: 0.52, abajo: 0.34 };
  const gris = (k) => [k, k, k];
  // Una textura cada seis tiles. A cuatro, el patron se repetia tanto que el
  // muro parecia ruido; a seis se lee la piedra.
  const ESCALA_UV = 1 / 6;

  for (let ty = 0; ty < ALTO_TILES; ty++) {
    for (let tx = 0; tx < nv.ancho; tx++) {
      const v = lee(tx, ty);
      const cx = tx + 0.5, cy = mundoY(ty) - 0.5;
      if (SOLIDOS_TERRENO.has(v)) {
        const arribaLibre = !SOLIDOS_TERRENO.has(lee(tx, ty - 1));
        // La cara de frente se tinta distinto si tiene cielo encima: es lo que
        // dibuja el "borde de pasto" sin necesitar una segunda textura.
        // La cara de frente se aclara si tiene cielo encima: es lo que dibuja
        // el borde iluminado del suelo sin una segunda textura.
        agregarCara(tierra, CARAS.frente, cx, cy, ESCALA_UV, gris(arribaLibre ? BRILLO.frente * 1.15 : BRILLO.frente));
        if (arribaLibre) agregarCara(tapa, CARAS.arriba, cx, cy, ESCALA_UV, gris(BRILLO.arriba));
        if (!SOLIDOS_TERRENO.has(lee(tx, ty + 1))) agregarCara(tierra, CARAS.abajo, cx, cy, ESCALA_UV, gris(BRILLO.abajo));
        if (!SOLIDOS_TERRENO.has(lee(tx - 1, ty))) agregarCara(tierra, CARAS.izq, cx, cy, ESCALA_UV, gris(BRILLO.lado));
        if (!SOLIDOS_TERRENO.has(lee(tx + 1, ty))) agregarCara(tierra, CARAS.der, cx, cy, ESCALA_UV, gris(BRILLO.lado));
      } else if (v === V.LADRILLO) {
        for (const k of ["frente", "arriba", "abajo", "izq", "der"])
          agregarCara(ladrillo, CARAS[k], cx, cy, 0.5,
                      gris(k === "arriba" ? 1 : k === "frente" ? 0.82 : 0.6));
      } else if (v === V.PLATAFORMA) {
        // Fina y solo por arriba: el grosor cuenta la regla del juego.
        const alto = 0.28;
        for (const k of ["frente", "arriba", "izq", "der", "abajo"]) {
          const c = CARAS[k];
          const base = plata.pos.length / 3;
          for (const vv of c.v) {
            plata.pos.push(cx + vv[0], cy + 0.5 - alto / 2 + vv[1] * alto, vv[2] * PROF);
            plata.nor.push(...c.n);
            plata.uv.push((cx + vv[0]) * 0.5, (cy + vv[1]) * 0.5);
            plata.col.push(1, 1, 1);
          }
          plata.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }

  const hacer = (datos, tex) => {
    const m = new THREE.Mesh(aGeometria(datos), new THREE.MeshStandardMaterial({
      map: tex, vertexColors: true, roughness: tm.rugos, metalness: tm.metal }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  grupo.add(hacer(tierra, texturaLado || texturaArriba));
  if (tapa.pos.length) grupo.add(hacer(tapa, texturaArriba));

  if (ladrillo.pos.length) {
    const m = new THREE.Mesh(aGeometria(ladrillo), new THREE.MeshStandardMaterial({
      map: texturaLado || texturaArriba, vertexColors: true, color: 0xd8c8b0,
      roughness: 0.95, metalness: 0,
    }));
    m.castShadow = true; m.receiveShadow = true; grupo.add(m);
  }
  if (plata.pos.length) {
    const m = new THREE.Mesh(aGeometria(plata), new THREE.MeshStandardMaterial({
      color: new THREE.Color(tm.tapa), roughness: 0.6, metalness: 0.25,
      emissive: new THREE.Color(tm.tapa).multiplyScalar(0.18),
    }));
    m.castShadow = true; m.receiveShadow = true; grupo.add(m);
  }
  return grupo;
}

// --- cargar modelos ------------------------------------------------------
const cargador = new GLTFLoader();
const cache = new Map();

export function cargarModelo(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((ok, mal) => cargador.load(url, (g) => ok(g), undefined, mal));
  cache.set(url, p);
  return p;
}

/**
 * Normaliza un modelo: lo centra, lo escala a `alto` unidades y lo apoya en el
 * suelo. Sin esto cada modelo llega con su propia escala y origen —uno mide
 * 0,3 y otro 40— y colocarlos a mano es un numero magico por modelo que se
 * rompe en cuanto se regenera uno.
 */
export function normalizar(gltf, alto, mirarX = 1) {
  const raiz = gltf.scene.clone(true);
  const caja = new THREE.Box3().setFromObject(raiz);
  const tam = caja.getSize(new THREE.Vector3());
  const centro = caja.getCenter(new THREE.Vector3());
  const k = alto / Math.max(tam.y, 1e-6);
  raiz.scale.setScalar(k);
  raiz.position.set(-centro.x * k, -caja.min.y * k, -centro.z * k);
  const pivote = new THREE.Group();
  pivote.add(raiz);
  pivote.userData.anchoRel = (tam.x / Math.max(tam.y, 1e-6));
  pivote.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (mirarX < 0) pivote.scale.x = -1;
  return pivote;
}

export { THREE };

// --- decorado del nivel --------------------------------------------------
// Todo lo que no es terreno: bloques, tubos, puas, lava, rampas, monedas.
//
// Cada tipo va en UNA malla instanciada. Son pocas piezas de cada clase —unas
// decenas— pero como objetos sueltos son decenas de llamadas de dibujo por
// cuadro, y en un telefono las llamadas de dibujo cuestan mas que los
// triangulos. Instanciado, cada tipo es una sola.
//
// La moneda comun NO usa el modelo generado: son ciento cincuenta por nivel y
// el modelo tiene 2.500 triangulos, o sea 375.000 solo en monedas. Un cilindro
// de 32 sale igual de bien a ese tamano y cuesta 6.400. El modelo generado se
// guarda para las cinco de color, que si se miran de cerca.

function instanciar(geo, mat, cuantas) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(cuantas, 1));
  m.count = 0;
  m.castShadow = true; m.receiveShadow = true;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
      _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const poner = (malla, x, y, esc = 1, rotY = 0, rotZ = 0) => {
  _p.set(x, y, 0);
  _q.setFromEuler(new THREE.Euler(0, rotY, rotZ));
  _s.setScalar(esc);
  _m.compose(_p, _q, _s);
  malla.setMatrixAt(malla.count++, _m);
};

// Un prisma triangular para las rampas. BoxGeometry no sirve: una rampa
// dibujada como caja es una caja, y el jugador que la ve plana no entiende
// por que resbala.
function geoRampa(sube) {
  const g = new THREE.BufferGeometry();
  const a = sube ? [[-.5,-.5],[.5,-.5],[.5,.5]] : [[-.5,-.5],[.5,-.5],[-.5,.5]];
  const pos = [], nor = [], idx = [];
  for (const z of [0.5, -0.5])
    for (const [x, y] of a) { pos.push(x, y, z * PROF); nor.push(0, 0, Math.sign(z)); }
  idx.push(0, 1, 2, 5, 4, 3);
  // los tres costados
  const lados = [[0,1],[1,2],[2,0]];
  for (const [i, j] of lados) {
    const b = pos.length / 3;
    const p = [[...a[i], 0.5], [...a[j], 0.5], [...a[j], -0.5], [...a[i], -0.5]];
    const n = new THREE.Vector3(a[j][1] - a[i][1], a[i][0] - a[j][0], 0).normalize();
    for (const [x, y, z] of p) { pos.push(x, y, z * PROF); nor.push(n.x, n.y, 0); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

const geoDeModelo = (gltf) => {
  let g = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !g) g = o.geometry.clone(); });
  return g;
};
const matDeModelo = (gltf) => {
  let m = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !m) m = o.material; });
  return m;
};

export function construirDecorado(nv, tm, modelos) {
  const grupo = new THREE.Group();
  const lee = (tx, ty) => nv.grilla[ty * nv.ancho + tx];
  const cuenta = {};
  for (let i = 0; i < nv.grilla.length; i++) cuenta[nv.grilla[i]] = (cuenta[nv.grilla[i]] || 0) + 1;
  const n = (v) => cuenta[v] || 0;

  const cajita = new THREE.BoxGeometry(0.94, 0.94, PROF * 0.94);
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.2, ...o });

  const mallas = {};
  mallas[V.PREGUNTA] = instanciar(cajita, mat({ color: "#ffb43a", emissive: "#a35c00", emissiveIntensity: 0.6 }), n(V.PREGUNTA));
  mallas[V.USADO]    = instanciar(cajita, mat({ color: "#6b5230", roughness: 0.9, metalness: 0 }), n(V.PREGUNTA));
  mallas[V.PAUSA]    = instanciar(cajita, mat({ color: "#4fc3f7", emissive: "#0b5878", emissiveIntensity: 0.8 }), n(V.PAUSA));
  mallas[V.TIEMPO]   = instanciar(cajita, mat({ color: "#5ed88a", emissive: "#0d5a2c", emissiveIntensity: 0.7 }), n(V.TIEMPO));
  mallas[V.LARGO]    = instanciar(cajita, mat({ color: "#2f7fd0", emissive: "#0a3050", emissiveIntensity: 0.6 }), n(V.LARGO));
  mallas[V.VOLTERETA]= instanciar(cajita, mat({ color: "#c04fc0", emissive: "#4a0a4a", emissiveIntensity: 0.6 }), n(V.VOLTERETA));
  mallas[V.PINCHE]   = instanciar(new THREE.ConeGeometry(0.2, 0.9, 6), mat({ color: "#e8e4d8", roughness: 0.4, metalness: 0.5 }), n(V.PINCHE) * 3);
  mallas[V.RAMPA_SUBE] = instanciar(geoRampa(true), mat({ color: tm.tierra, roughness: tm.rugos }), n(V.RAMPA_SUBE));
  mallas[V.RAMPA_BAJA] = instanciar(geoRampa(false), mat({ color: tm.tierra, roughness: tm.rugos }), n(V.RAMPA_BAJA));

  const gTubo = modelos.conducto ? geoDeModelo(modelos.conducto) : new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const mTubo = modelos.conducto ? matDeModelo(modelos.conducto) : mat({ color: "#2a7f8f" });
  if (modelos.conducto) {
    gTubo.computeBoundingBox();
    const b = gTubo.boundingBox, t = b.getSize(new THREE.Vector3());
    const k = 1 / Math.max(t.x, t.y, t.z);
    gTubo.translate(-(b.min.x + t.x / 2), -b.min.y, -(b.min.z + t.z / 2));
    gTubo.scale(k, k, k);
  }
  mallas[V.TUBO] = instanciar(gTubo, mTubo, n(V.TUBO));

  const gRes = modelos.resorte ? geoDeModelo(modelos.resorte) : new THREE.CylinderGeometry(0.35, 0.4, 0.5, 10);
  const mRes = modelos.resorte ? matDeModelo(modelos.resorte) : mat({ color: "#d24b4b" });
  if (modelos.resorte) {
    gRes.computeBoundingBox();
    const b = gRes.boundingBox, t = b.getSize(new THREE.Vector3());
    const k = 0.75 / Math.max(t.y, 1e-6);
    gRes.translate(-(b.min.x + t.x / 2), -b.min.y, -(b.min.z + t.z / 2));
    gRes.scale(k, k, k);
  }
  mallas[V.RESORTE] = instanciar(gRes, mRes, n(V.RESORTE));

  // Monedas: cilindro de canto, girando. El material es emisivo para que se
  // vean tambien en los niveles oscuros, donde una moneda mate desaparece.
  const gMon = new THREE.CylinderGeometry(0.30, 0.30, 0.09, 16);
  gMon.rotateX(Math.PI / 2);
  const mallaMon = instanciar(gMon, mat({
    color: "#ffd447", emissive: "#8a5c00", emissiveIntensity: 0.55,
    roughness: 0.25, metalness: 0.75 }), n(V.MONEDA));
  mallaMon.castShadow = false;                // 150 sombras de moneda no aportan
  grupo.add(mallaMon);

  for (const k of Object.keys(mallas)) grupo.add(mallas[k]);

  // --- lava: un plano emisivo con olas por shader ------------------------
  const lavas = [];
  for (let ty = 0; ty < ALTO_TILES; ty++)
    for (let tx = 0; tx < nv.ancho; tx++)
      if (lee(tx, ty) === V.LAVA) lavas.push([tx, ty]);
  let matLava = null;
  if (lavas.length) {
    const g = new THREE.BoxGeometry(1, 1, PROF);
    matLava = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 } },
      vertexShader: `varying vec3 wp; varying vec2 vu;
        void main(){ vu = uv; wp = (modelMatrix * instanceMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float t; varying vec3 wp; varying vec2 vu;
        void main(){
          float o = sin(wp.x*2.2 + t*2.0)*0.5 + sin(wp.x*5.3 - t*1.3)*0.3;
          float f = smoothstep(0.1, 0.9, vu.y + o*0.12);
          vec3 c = mix(vec3(0.92,0.22,0.06), vec3(1.0,0.82,0.30), f);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const m = instanciar(g, matLava, lavas.length);
    m.castShadow = false;
    for (const [tx, ty] of lavas) poner(m, tx + 0.5, -ty - 0.5);
    m.instanceMatrix.needsUpdate = true;
    grupo.add(m);
  }

  // --- colocar todo ------------------------------------------------------
  const monedas = [];                       // {tx, ty, i} para poder apagarlas
  for (let ty = 0; ty < ALTO_TILES; ty++) {
    for (let tx = 0; tx < nv.ancho; tx++) {
      const v = lee(tx, ty);
      const x = tx + 0.5, y = -ty - 0.5;
      if (v === V.MONEDA) { monedas.push({ tx, ty, i: mallaMon.count }); poner(mallaMon, x, y); }
      else if (v === V.PINCHE) {
        for (let k = 0; k < 3; k++) poner(mallas[V.PINCHE], tx + 0.2 + k * 0.3, y - 0.05, 1, 0, 0);
      } else if (v === V.RAMPA_SUBE || v === V.RAMPA_BAJA) poner(mallas[v], x, y);
      else if (v === V.RESORTE) poner(mallas[v], x, y - 0.5);
      else if (v === V.TUBO) poner(mallas[v], x, y - 0.5);
      else if (mallas[v]) poner(mallas[v], x, y);
    }
  }
  for (const k of Object.keys(mallas)) mallas[k].instanceMatrix.needsUpdate = true;
  mallaMon.instanceMatrix.needsUpdate = true;

  // --- el mastil ---------------------------------------------------------
  const mastil = new THREE.Group();
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 10, 10),
    new THREE.MeshStandardMaterial({ color: "#dfe6ef", metalness: 0.8, roughness: 0.3 }));
  palo.position.set(nv.mastilX + 0.5, -nv.pisoMastil + 5, 0);
  palo.castShadow = true;
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#ffd447", emissive: "#6a4a00", emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.2 }));
  bola.position.set(nv.mastilX + 0.5, -nv.pisoMastil + 10, 0);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9),
    new THREE.MeshStandardMaterial({ color: "#e2495f", side: THREE.DoubleSide, roughness: 0.8 }));
  tela.position.set(nv.mastilX + 1.3, -nv.pisoMastil + 9.4, 0.02);
  mastil.add(palo, bola, tela);
  grupo.add(mastil);

  return { grupo, mallaMon, monedas, matLava, bandera: tela, bola };
}
