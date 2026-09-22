// Bajar todo lo que el bosque necesita, contando cuánto falta.
//
// LAS TEXTURAS DE COLOR VAN EN sRGB Y LAS DE NORMALES EN LINEAL. Si una normal
// se marca como sRGB, la tarjeta le "corrige" la curva al leerla y todas las
// normales se tuercen hacia un costado: el suelo entero parece iluminado desde
// abajo a la izquierda, sin ningún error en la consola.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const RAIZ = "datos/";

// EN EL ARCHIVO ÚNICO TODO VIENE ADENTRO. empaquetar deja cada textura y cada
// modelo en window.ARCHIVOS como data: URI. Abierto con doble clic (file://)
// el navegador no deja pedir nada a la carpeta de al lado —ni un fetch ni un
// GLB—, así que la dirección sale de ahí y no de datos/. El código es el mismo
// en las dos versiones: no hay una "de carpeta" y otra "de archivo" que se
// puedan desincronizar.
const donde = (archivo) => (window.ARCHIVOS && window.ARCHIVOS[archivo]) || RAIZ + archivo;

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
  // LAS TEXTURAS DE ADENTRO DE CADA GLB, COMO IMÁGENES Y NO CON fetch. Three
  // las lee por defecto con ImageBitmapLoader, que hace fetch() de una
  // dirección blob:. Donde la página corre con una política de seguridad que
  // no deja hacer fetch más que a sus propios archivos, ese fetch se bloquea
  // en silencio y el caminante sale sin textura. Un <img> con la misma
  // dirección blob: sí se permite. El cambio se hace desde un "plugin" porque
  // es el único punto donde se puede tocar el parser recién creado.
  gl.register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    return { name: "texturas_como_imagen" };
  });

  const textura = (nombre, archivo, espacio) => new Promise((ok, mal) => {
    tl.load(donde(archivo), (t) => {
      t.colorSpace = espacio;
      if (REPITEN.has(nombre)) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
      else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = Math.min(4, aniso); }
      avanzar(archivo); ok([nombre, t]);
    }, undefined, () => mal(new Error("no se pudo bajar " + archivo)));
  });
  const modelo = (nombre) => new Promise((ok, mal) => {
    const dir = donde(nombre + ".glb");
    const listo = (g) => { avanzar(nombre + ".glb"); ok([nombre, g]); };
    const error = (e) => mal(new Error("no se pudo leer " + nombre + ".glb: " + (e?.message || e)));
    // un GLB embebido se decodifica acá y se le pasa entero al parser: pedirlo
    // con fetch a una dirección data: es otro pedido que la política de
    // seguridad de la página puede bloquear
    if (dir.startsWith("data:")) {
      try {
        const b = atob(dir.slice(dir.indexOf(",") + 1));
        const bytes = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
        gl.parse(bytes.buffer, "", listo, error);
      } catch (e) { error(e); }
    } else gl.load(dir, listo, undefined, error);
  });
  const datos = (window.DATOS ? Promise.resolve(window.DATOS) : fetch(RAIZ + "datos.json").then((r) => r.json()))
    .then((d) => { avanzar("datos.json"); return d; });

  const [cols, nors, mods, d] = await Promise.all([
    Promise.all(Object.entries(COLOR).map(([n, a]) => textura(n, a, THREE.SRGBColorSpace))),
    Promise.all(Object.entries(NORMAL).map(([n, a]) => textura(n, a, THREE.NoColorSpace))),
    Promise.all(MODELOS.map(modelo)),
    datos,
  ]);
  return { tex: Object.fromEntries([...cols, ...nors]), glb: Object.fromEntries(mods), datos: d };
}
