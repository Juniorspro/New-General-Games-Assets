// Bajar todo lo que el bosque necesita, contando cuánto falta.
//
// LAS TEXTURAS DE COLOR VAN EN sRGB Y LAS DE NORMALES EN LINEAL. Si una normal
// se marca como sRGB, la tarjeta le "corrige" la curva al leerla y todas las
// normales se tuercen hacia un costado: el suelo entero parece iluminado desde
// abajo a la izquierda, sin ningún error en la consola.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const RAIZ = "datos/";

const COLOR = {
  cielo: "cielo.webp", suelo: "suelo.webp", musgo: "musgo.webp", sendero: "sendero.webp", roca: "roca.webp",
  cortezaAbeto: "corteza-abeto.webp", cortezaAbedul: "corteza-abedul.webp",
  ramaAbeto: "rama-abeto.webp", ramaPicea: "rama-picea.webp", helecho: "helecho.webp",
  pasto: "pasto.webp", hojasAbedul: "hojas-abedul.webp", flores: "flores.webp",
};
const NORMAL = {
  sueloN: "suelo-n.webp", musgoN: "musgo-n.webp", senderoN: "sendero-n.webp", rocaN: "roca-n.webp",
  cortezaAbetoN: "corteza-abeto-n.webp", cortezaAbedulN: "corteza-abedul-n.webp", aguaN: "agua-n.webp",
};
const MODELOS = ["roca", "laja", "tronco", "tocon", "cabana", "fogata", "cinta", "caminante"];
// las que se repiten como baldosa; el resto son tarjetas y van con el borde fijo
const REPITEN = new Set(["suelo", "musgo", "sendero", "roca", "cortezaAbeto", "cortezaAbedul", "sueloN", "musgoN", "senderoN", "rocaN", "cortezaAbetoN", "cortezaAbedulN", "aguaN"]);

export async function cargarTodo(renderer, alAvanzar) {
  const total = Object.keys(COLOR).length + Object.keys(NORMAL).length + MODELOS.length + 1;
  let hechos = 0;
  const avanzar = (que) => { hechos++; alAvanzar(hechos / total, que); };
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tl = new THREE.TextureLoader();
  const gl = new GLTFLoader();

  const textura = (nombre, archivo, espacio) => new Promise((ok, mal) => {
    tl.load(RAIZ + archivo, (t) => {
      t.colorSpace = espacio;
      if (REPITEN.has(nombre)) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
      else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = Math.min(4, aniso); }
      avanzar(archivo); ok([nombre, t]);
    }, undefined, () => mal(new Error("no se pudo bajar " + archivo)));
  });
  const modelo = (nombre) => new Promise((ok, mal) => {
    gl.load(RAIZ + nombre + ".glb", (g) => { avanzar(nombre + ".glb"); ok([nombre, g]); }, undefined,
      (e) => mal(new Error("no se pudo bajar " + nombre + ".glb: " + (e?.message || e))));
  });
  const datos = fetch(RAIZ + "datos.json").then((r) => r.json()).then((d) => { avanzar("datos.json"); return d; });

  const [cols, nors, mods, d] = await Promise.all([
    Promise.all(Object.entries(COLOR).map(([n, a]) => textura(n, a, THREE.SRGBColorSpace))),
    Promise.all(Object.entries(NORMAL).map(([n, a]) => textura(n, a, THREE.NoColorSpace))),
    Promise.all(MODELOS.map(modelo)),
    datos,
  ]);
  return { tex: Object.fromEntries([...cols, ...nors]), glb: Object.fromEntries(mods), datos: d };
}
