/* ---------------------------------------------------------------------------
   La mascota en 3D.

   El modelo tiene rig: 41 huesos y dos animaciones grabadas, `preset:idle` y
   `preset:jump`. Encima va una capa hecha por código, y las dos cosas conviven
   porque tocan lugares distintos: el esqueleto mueve las partes por dentro y el
   código mueve, gira y escala al muñeco entero desde un envoltorio. Si el
   código tocara los huesos, pisaría a la animación en cada cuadro.

   LA PIXELACIÓN es del renderizador, no un filtro encima: el lienzo dibuja a
   LADO px de lado y el CSS lo estira con `image-rendering: pixelated`. De paso
   tapa lo que la reconstrucción hizo mal —la malla sale de una sola foto y de
   cerca se le ven los bultos— y deja el mismo escalonado que el personaje ya
   tiene en el pelo y el visor.

   Si no hay WebGL o el modelo no baja, se saca el lienzo y queda la imagen que
   ya estaba en el HTML. Un cuadro vacío sería peor que una foto.
   --------------------------------------------------------------------------- */
import * as THREE from "../vendor/three.module.min.3e690ac7.js";
import { GLTFLoader } from "../vendor/GLTFLoader.09d91253.js";

const lienzo = document.getElementById("lienzo");
const respaldo = document.getElementById("respaldo");
const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Cuántos píxeles de verdad tiene el muñeco. Es lo único que hay que tocar
   para que se vea más o menos pixelado. */
const LADO = 128;
/* El modelo salió mirando a un costado: la reconstrucción no respeta la
   orientación de la foto. */
const FRENTE = 4.71;
/* Cuánto sube el flote, en unidades de la escena. Entra en el encuadre. */
const FLOTE = .05;

function morir(e){ lienzo.remove(); console.error(e); }

let motor;
try {
  motor = new THREE.WebGLRenderer({ canvas:lienzo, antialias:false, alpha:true });
} catch (e) { morir(e); throw e; }
/* Sin esto, en una pantalla retina el buffer saldría al doble y se perdería la
   mitad de la pixelación. */
motor.setPixelRatio(1);
motor.setSize(LADO, LADO, false);   /* `false`: three no toca el CSS del lienzo */
motor.outputColorSpace = THREE.SRGBColorSpace;

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(30, 1, .1, 100);
escena.add(new THREE.HemisphereLight(0xdff6ff, 0x2b6ba8, 2.1));
const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(2, 3, 4);
const relleno = new THREE.DirectionalLight(0xa8d8ff, .9); relleno.position.set(-3, 1, -2);
escena.add(sol, relleno);

/* ---------- cargar ---------- */
let cuna, mezclador, aIdle, aSalto, encuadre;

try {
  const gltf = await new GLTFLoader().loadAsync(lienzo.dataset.modelo);
  const raiz = gltf.scene;

  mezclador = new THREE.AnimationMixer(raiz);
  const clip = (n) => gltf.animations.find(a => a.name === n) || null;
  aIdle  = clip("preset:idle") && mezclador.clipAction(clip("preset:idle"));
  aSalto = clip("preset:jump") && mezclador.clipAction(clip("preset:jump"));

  /* --- el encuadre ---
     `Box3.setFromObject` sobre una malla con skin devuelve la caja de la pose
     de amarre, que no es la que se ve. Y medir una sola pose tampoco alcanza:
     el salto levanta al muñeco medio cuerpo y se salía del cuadro. Así que se
     recorren LAS DOS animaciones, se juntan las posiciones de todos los huesos
     en cada muestra, y de esa caja sale el encuadre. Los huesos van adentro del
     cuerpo, así que después se agranda para que no le corte la ropa. */
  const caja = new THREE.Box3(), punto = new THREE.Vector3();
  let huesos = 0;
  const juntar = () => {
    raiz.updateWorldMatrix(true, true);
    let n = 0;
    raiz.traverse(o => { if (o.isBone) { caja.expandByPoint(o.getWorldPosition(punto)); n++; } });
    huesos = n;          /* uno solo, no la suma de todas las muestras */
  };
  const acciones = [aIdle, aSalto].filter(Boolean);
  for (const a of acciones) {
    for (const b of acciones) { b.reset(); b.setEffectiveWeight(b === a ? 1 : 0); b.play(); }
    const dur = a.getClip().duration || 1;
    for (let i = 0; i <= 14; i++) { mezclador.setTime(dur * i / 14); juntar(); }
  }
  if (!huesos) caja.setFromObject(raiz);   /* por si algún día viene sin rig */

  const tam = caja.getSize(new THREE.Vector3());
  caja.expandByVector(tam.multiplyScalar(.15));
  const medio = caja.getCenter(new THREE.Vector3());
  const lado = Math.max(...caja.getSize(new THREE.Vector3()).toArray());
  const e = 1.6 / lado;                    /* tamaño cómodo para las luces */
  raiz.position.sub(medio);

  /* La escala va en un envoltorio, no en el nodo del skin: tocarle la escala a
     un nodo con esqueleto desalinea los huesos de la malla. */
  cuna = new THREE.Group();
  const escalador = new THREE.Group();
  escalador.scale.setScalar(e);
  escalador.add(raiz);
  cuna.add(escalador);
  escena.add(cuna);

  /* La cámara se calcula, no se elige a mano: distancia a la que una esfera de
     ese radio entra justo en el campo de visión, más margen para el flote, la
     respiración y el cabeceo. Antes era un 3.9 puesto a ojo, y por eso
     recortaba. */
  const radio = caja.getBoundingSphere(new THREE.Sphere()).radius * e + FLOTE + .04;
  const dist = radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2)) * 1.06;
  camara.position.set(0, 0, dist);
  camara.updateProjectionMatrix();
  encuadre = { radio:+radio.toFixed(3), dist:+dist.toFixed(3), huesos, escala:+e.toFixed(3) };

  /* volver a la pose de reposo */
  mezclador.setTime(0);
  for (const b of acciones) { b.stop(); b.setEffectiveWeight(1); }
  if (aIdle) aIdle.reset().play();
  if (aSalto) { aSalto.setLoop(THREE.LoopOnce, 1); aSalto.clampWhenFinished = true; aSalto.stop(); }
  mezclador.update(0);

  respaldo.hidden = true;
  lienzo.hidden = false;
} catch (e) { morir(e); throw e; }

/* ---------- el salto ----------
   La mezcla entre reposo y salto se hace A MANO, con un número que se acerca
   solo en cada cuadro. `crossFadeTo` de three programa el fundido en su propio
   planificador y acá fundía al revés: el salto se quedaba en peso 0 y su reloj
   no avanzaba nunca, así que el toque no hacía nada. Un número que se puede
   leer y comprobar vale más que el atajo de la biblioteca.

   0 = todo reposo · 1 = todo salto */
let mezcla = 0, mezclaObj = 0, saltando = false;

function saltar(){
  if (!aSalto || saltando) return false;
  saltando = true;
  aSalto.reset().play();
  mezcla = Math.max(mezcla, .2);   /* arranca con peso: en 0 su reloj no corre */
  mezclaObj = 1;
  return true;
}
if (mezclador) mezclador.addEventListener("finished", (ev) => {
  if (ev.action !== aSalto) return;
  saltando = false;
  mezclaObj = 0;                   /* el cuadro lo funde de vuelta al reposo */
  if (aIdle) aIdle.paused = false;
});

/* ---------- lo que anima por código ---------- */
let giro = FRENTE, giroObj = FRENTE, velGiro = 0;
let inclina = 0, inclinaObj = 0;
let arrastrando = false, ultimoX = 0, bajoEn = 0, bajoX = 0;

function apuntar(ev){
  if (arrastrando) return;
  const c = lienzo.getBoundingClientRect();
  const dx = (ev.clientX - (c.left + c.width / 2)) / c.width;
  const dy = (ev.clientY - (c.top + c.height / 2)) / c.height;
  giroObj = FRENTE + Math.max(-.7, Math.min(.7, dx * 1.6));
  inclinaObj = Math.max(-.2, Math.min(.2, dy * .45));
}
addEventListener("pointermove", apuntar);
addEventListener("pointerleave", () => { giroObj = FRENTE; inclinaObj = 0; });

lienzo.addEventListener("pointerdown", ev => {
  arrastrando = true; ultimoX = ev.clientX; velGiro = 0;
  bajoEn = performance.now(); bajoX = ev.clientX;
  lienzo.setPointerCapture(ev.pointerId);
});
lienzo.addEventListener("pointermove", ev => {
  if (!arrastrando) return;
  const d = (ev.clientX - ultimoX) * .012;
  giro += d; giroObj = giro; velGiro = d;   /* la última velocidad es la inercia */
  ultimoX = ev.clientX;
});
lienzo.addEventListener("pointercancel", () => { arrastrando = false; });
/* Un toque corto y sin corrimiento es un salto; si no, saltaría cada vez que
   alguien la gira. */
lienzo.addEventListener("pointerup", ev => {
  arrastrando = false;
  if (performance.now() - bajoEn < 400 && Math.abs(ev.clientX - bajoX) < 9) saltar();
});

/* Un asa chica: sirve para que una prueba pueda comprobar que el salto salta de
   verdad, y para dispararlo desde la consola. No cambia lo que hace la página. */
window.mascota = { saltar, info: () => ({
  encuadre, saltando, mezcla:+mezcla.toFixed(2),
  idle:  aIdle  ? { corriendo:aIdle.isRunning(),  peso:+aIdle.getEffectiveWeight().toFixed(2)  } : null,
  salto: aSalto ? { corriendo:aSalto.isRunning(), peso:+aSalto.getEffectiveWeight().toFixed(2),
                    t:+aSalto.time.toFixed(2), dura:+aSalto.getClip().duration.toFixed(2) } : null,
}) };

/* ---------- el cuadro ---------- */
const reloj = new THREE.Clock();
let t = 0;

function cuadro(){
  requestAnimationFrame(cuadro);
  /* OJO con el orden: `getElapsedTime()` de three llama a `getDelta()` por
     dentro y se lo come. Pidiéndolos en el orden contrario, `getDelta()`
     devolvía casi cero y todo lo que depende del tiempo —los resortes, la
     mezcla entre reposo y salto— se quedaba clavado. El reloj propio se lleva
     acá y el delta se pide UNA sola vez. */
  const d = Math.min(reloj.getDelta(), .05);
  t += d;

  /* el esqueleto avanza siempre: quieto sería un maniquí, no una mascota.
     Lo que se apaga con `prefers-reduced-motion` es la capa de encima. */
  /* los pesos, antes de avanzar: el mezclador saltea lo que está en cero */
  if (aSalto) {
    mezcla += (mezclaObj - mezcla) * Math.min(1, d * 11);
    if (mezclaObj === 0 && mezcla < .01) { mezcla = 0; if (!saltando) aSalto.stop(); }
    aSalto.setEffectiveWeight(mezcla);
    if (aIdle) aIdle.setEffectiveWeight(1 - mezcla);
  }
  mezclador.update(d);

  if (suave) {
    if (!arrastrando && Math.abs(velGiro) > .0002) {
      giro += velGiro; velGiro *= .93; giroObj = giro;
    }
    giro += (giroObj - giro) * Math.min(1, d * 6);
    inclina += (inclinaObj - inclina) * Math.min(1, d * 5);

    const flote  = Math.sin(t * (Math.PI * 2 / 4)) * FLOTE;
    const aire   = Math.sin(t * (Math.PI * 2 / 2));
    const vaiven = Math.sin(t * (Math.PI * 2 / 6)) * .04;

    cuna.rotation.set(inclina, giro, vaiven);
    cuna.position.y = flote;
    /* respirar: sube un poco y se angosta lo mismo, para no cambiar de volumen */
    const r = aire * .01;
    cuna.scale.set(1 - r * .5, 1 + r, 1 - r * .5);
  } else {
    giro += (giroObj - giro) * Math.min(1, d * 6);
    cuna.rotation.set(0, giro, 0);
  }

  motor.render(escena, camara);
}
cuadro();
