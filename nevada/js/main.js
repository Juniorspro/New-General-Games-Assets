/* ============================================================================
   nevada/js/main.js — el lazo: idioma → título → cinemática → cámara libre.
   La cinemática va en un cuadro vertical 9:16 (como el TikTok de referencia):
   en un teléfono ocupa toda la pantalla y en la compu queda centrada.
   Cuando suena, el tiempo lo manda el reloj del audio, así los cortes caen
   en el golpe aunque algún cuadro se atrase.
   Para las pruebas: ?t=5.2 deja la escena quieta en ese instante, y
   window.__N.irA(t) hace lo mismo desde afuera.
   ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { armarEscena } from './escena.js';
import { cargarAuto, cargarTigres } from './modelos.js';
import { armarPost } from './post.js';
import { crearDirector, DURACION } from './director.js';
import { crearMusica } from './musica.js';
import { IDIOMAS, ponerIdioma, tr } from './textos.js';

const q = new URLSearchParams(location.search);
const tFijo = q.has('t') ? parseFloat(q.get('t')) : null;
const $ = (s) => document.querySelector(s);

/* ---------------- el lienzo, en 9:16 ---------------- */
const cuadro = $('#cuadro');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: tFijo !== null });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.get('calidad') === 'baja' ? 1 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
cuadro.appendChild(renderer.domElement);
const camara = new THREE.PerspectiveCamera(38, 9 / 16, 0.05, 600);

function medir() {
  const W = window.innerWidth, H = window.innerHeight;
  let w = Math.round(H * 9 / 16), h = H;
  if (w > W) { w = W; h = Math.round(W * 16 / 9); }
  if (q.has('ancho')) { w = +q.get('ancho'); h = Math.round(w * 16 / 9); }
  cuadro.style.width = w + 'px'; cuadro.style.height = h + 'px';
  renderer.setSize(w, h);
  camara.aspect = w / h; camara.updateProjectionMatrix();
  post?.tamano(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
}
let post = null;
window.addEventListener('resize', medir);
medir();

/* ---------------- el mundo ---------------- */
const listo = (async () => {
  const mundo = await armarEscena(renderer);
  const [auto, tigres] = await Promise.all([cargarAuto(), cargarTigres()]);
  if (auto) mundo.escena.add(auto.grupo);
  for (const k of ['parado', 'echado', 'ruge']) if (tigres[k]) mundo.escena.add(tigres[k].grupo);
  post = armarPost(renderer, mundo.escena, camara);
  medir();
  const musica = crearMusica();
  const director = crearDirector({ camara, post, mundo, auto, tigres, musica });
  // se compila todo una vez antes de mostrar nada (si no, el primer corte traba)
  renderer.compile(mundo.escena, camara);
  return { mundo, auto, tigres, director, musica };
})();

/* ---------------- los rótulos: dependen solo del tiempo, como la cinemática ---------------- */
const suave = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function rotulos(tt, activo = true) {
  const entra = suave((tt - 16.75) / 0.7), sale = 1 - suave((tt - 18.05) / 0.4);
  const ls = 0.2 + suave((tt - 16.5) / 2) * 0.14;
  const tit = $('#rTitulo');
  tit.style.opacity = activo ? entra * sale : 0;
  tit.style.letterSpacing = ls + 'em'; tit.style.paddingLeft = ls + 'em';
  tit.style.filter = `blur(${((1 - entra) * 8).toFixed(2)}px)`;
  $('#rFin').style.opacity = activo ? suave((tt - 17.15) / 0.6) * sale : 0;
  const desglose = activo && tt < 3;
  $('#rDesglose').style.opacity = desglose ? 1 : 0;
  if (desglose) $('#rTc').textContent = String(Math.floor(tt * 30)).padStart(4, '0');
}

/* ---------------- el estado ---------------- */
let modo = 'menu', t = 0, ultimo = performance.now(), control = null, sonido = true;
const reloj = { dt: 1 / 60 };

async function empezar(desde = 0) {
  const { musica, director } = await listo;
  $('#menu').classList.add('oculto'); $('#final').classList.add('oculto');
  if (control) { control.dispose(); control = null; }
  modo = 'cine'; t = desde;
  director.ponerArcilla(false);
  if (sonido) await musica.iniciar(desde);
}
function terminar() {
  modo = 'libre';
  rotulos(0, false);
  $('#final').classList.remove('oculto');
  listo.then(({ director, musica, auto }) => {
    musica.parar();
    // cámara libre alrededor del auto parado, con el tigre echado al lado
    director.irA(6.0);
    const P = director.P0;
    camara.position.set(P.x - 5.2, 1.4, 5.6);
    control = new OrbitControls(camara, renderer.domElement);
    control.target.set(P.x - 0.4, 0.6, 1.2);
    control.enableDamping = true; control.minDistance = 2.2; control.maxDistance = 16;
    control.maxPolarAngle = Math.PI * 0.49;
    control.update();
    const u = (post.u);
    u.uZoom.value = 0; u.uBarrido.value.set(0, 0); u.uDestello.value = 0; u.uNegro.value = 0; u.uExposicion.value = 1;
  });
}

/* ---------------- el lazo ---------------- */
function cuadroNuevo(ahora) {
  requestAnimationFrame(cuadroNuevo);
  const dt = Math.min(0.1, (ahora - ultimo) / 1000); ultimo = ahora;
  listo.then(({ director, musica, mundo, tigres }) => {
    if (tFijo !== null) return;
    if (modo === 'cine') {
      const ta = sonido ? musica.tiempo() : null;
      t = ta !== null ? ta : t + dt;
      if (t >= DURACION) { terminar(); return; }
      director.irA(t);
      rotulos(t);
      post.u.uTiempo.value = t;
    } else if (modo === 'libre' && control) {
      t += dt;
      control.update();
      mundo.copos.paso(t, camara, 1);
      if (tigres.echado) tigres.echado.rig.paso(dt, { mira: -0.2 });
      post.u.uTiempo.value = t;
    } else if (modo === 'menu') {
      // de fondo del menú, el plano del tigre echado, lento
      t += dt;
      director.irA(5.6 + (t * 0.05) % 1.3);   // la parte nítida del plano (antes queda la cola del desenfoque del corte)
      rotulos(0, false);
      post.u.uDestello.value = 0; post.u.uNegro.value = 0.35;
    }
    dibujar();
  });
}
requestAnimationFrame(cuadroNuevo);
const sinPost = q.has('sinpost');
let escenaActual = null;
function dibujar() { if (sinPost && escenaActual) renderer.render(escenaActual, camara); else post.comp.render(); }

/* ---------------- la interfaz ---------------- */
function textos() {
  document.documentElement.lang = document.body.dataset.idioma || 'es';
  document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = tr(e.dataset.t); });
}
function mostrarMenu() {
  $('#idioma').classList.add('oculto');
  $('#menu').classList.remove('oculto');
  textos();
}
document.querySelectorAll('#idioma button').forEach((b) => b.addEventListener('click', () => { ponerIdioma(b.dataset.i); document.body.dataset.idioma = b.dataset.i; mostrarMenu(); }));
$('#ver').addEventListener('click', async () => {
  $('#ver').disabled = true; $('#ver').textContent = tr('cargando');
  await listo;
  $('#ver').disabled = false; textos();
  empezar(0);
});
$('#otra').addEventListener('click', () => empezar(0));
$('#arcilla').addEventListener('click', async () => {
  const { director } = await listo;
  director.ponerArcilla(!director.arcilla);
  $('#arcilla').textContent = tr(director.arcilla ? 'render' : 'arcilla');
});
$('#sonido').addEventListener('click', async () => {
  sonido = !sonido;
  $('#sonido').classList.toggle('apagado', !sonido);
  const { musica } = await listo;
  if (!sonido) musica.parar(); else if (modo === 'cine') musica.iniciar(t);
});
textos();

/* ---------------- para las pruebas ---------------- */
window.__N = {
  listo: false,
  async irA(tt) { const { director } = await listo; modo = 'quieto'; director.irA(tt); rotulos(tt); post.u.uTiempo.value = tt; dibujar(); return director.planos.findIndex((p) => tt >= p.t0 && tt < p.t1); },
  /* depuración: poner la cámara a mano y ver un objeto solo */
  async mirar(pos, mira, fov = 38) { await listo; camara.position.set(...pos); camara.lookAt(...mira); camara.fov = fov; camara.updateProjectionMatrix(); dibujar(); },
  async info() { const w = await listo; const a = w.auto; const g = a.malla.geometry; g.computeBoundingBox();
    return { indices: g.index.count, vertices: g.attributes.position.count, caja: [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()], tam: a.tam.toArray(),
      ruedas: a.ruedas.map((r) => ({ pos: r.position.toArray(), radio: r.userData.radio, tri: r.geometry.index.count / 3 })) }; },
  async arcilla(si) { const w = await listo; w.director.ponerArcilla(si); dibujar(); },
  async solo(nombres) { const w = await listo; const todo = { auto: w.auto?.grupo, parado: w.tigres.parado?.grupo, echado: w.tigres.echado?.grupo, ruge: w.tigres.ruge?.grupo };
    for (const [k, o] of Object.entries(todo)) if (o) o.visible = nombres.includes(k); dibujar(); },
};
listo.then((w) => {
  const { director, mundo } = w;
  escenaActual = mundo.escena;
  if (q.has('depurar')) window.__N.objetos = { ...w, post, camara, renderer, dibujar };
  window.__N.listo = true;
  if (tFijo !== null) {
    $('#idioma').classList.add('oculto');
    modo = 'quieto';
    director.irA(tFijo); rotulos(tFijo); post.u.uTiempo.value = tFijo; dibujar();
  }
});
