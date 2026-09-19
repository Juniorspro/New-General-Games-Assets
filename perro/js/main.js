// El juego.
import * as THREE from "../vendor/three.module.min.js";
import { M } from "./mundo.js";
import { armaEscena, sigueSombra } from "./escena.js";
import { armaCamara } from "./camara.js";
import { armaControl, ENT } from "./control.js";
import { cargaPerro, apoya, ponGiroModelo, ponHocico } from "./perro.js";
import { altura, LIMITE } from "./terreno.js";
import * as AU from "./audio.js";
import { ruta } from "./assets.js";

const $ = (s) => document.querySelector(s);
const lienzo = $("#c");

// LAS IMAGENES DEL MENU SE PONEN DESDE EL JS Y NO EN EL CSS. Adentro del HTML
// de un solo archivo las rutas se reemplazan por base64, y `ruta()` es la unica
// puerta que sabe hacerlo: escritas en la hoja de estilo habria que enseñarle
// al empaquetador a reescribir CSS tambien.
// LA RUTA SE VUELVE ABSOLUTA ANTES DE METERLA EN LA VARIABLE. Una `url()`
// relativa adentro de una variable CSS NO se resuelve contra el documento: se
// resuelve contra la hoja de estilo donde la variable se USA. Como la hoja vive
// en `css/`, `assets/banner.webp` se convertia en `css/assets/banner.webp` y
// daba 404 — sin romper nada, porque el banner tiene un color de respaldo y la
// tarjeta se veia entera igual.
// Con `new URL(..., location.href)` queda absoluta y no depende de donde este
// la hoja. Y en el archivo unico `ruta()` ya devuelve un `data:`, que es
// absoluto de por si.
for (const [prop, arch] of [["--banner", "assets/banner.webp"], ["--pata", "assets/huella.webp"]]) {
  const r = ruta(arch);
  const abs = r.startsWith("data:") ? r : new URL(r, location.href).href;
  document.documentElement.style.setProperty(prop, `url("${abs}")`);
}

const { ren, esc, cam, sol, pasto } = armaEscena(lienzo);
const camara = armaCamara(cam);

// El estado del perro. Un objeto y no seis variables sueltas: asi la sonda de
// las pruebas lo lee entero y no hay que exportar seis cosas.
const P = { x: 0, z: 0, y: 0, vel: 0, rumbo: 0, rumboMov: 0, ladridos: 0, pasos: 0 };
let bicho = null, modo = "menu", t0 = performance.now() / 1000, tAnt = t0;

/* ---------- el perro ---------- */
ponGiroModelo(0);   // medido con pruebas/orientar.mjs
ponHocico(1);
cargaPerro(esc, (b) => {
  bicho = b;
  apoya(b.pivote, P.x, P.z, P.rumbo);
  $("#cargando").hidden = true;
  document.body.classList.add("listo");
}, () => {
  // SI EL MODELO NO CARGA, EL JUEGO NO SE QUEDA EN LA PANTALLA DE CARGA. Se
  // avisa y se deja entrar igual: el campo, el pasto y el cielo andan sin el.
  $("#cargando").textContent = "No se pudo cargar el perro";
  document.body.classList.add("listo");
});

/* ---------- el dedo ---------- */
armaControl($("#dedo"), () => {
  if (modo !== "juega") return;
  P.ladridos++;
  AU.ladra(P.vel > M.VEL_CORRE * 0.5);
  if (bicho) bicho.ladrido(performance.now() / 1000 - t0);
});

/* ---------- pantallas ---------- */
function verPan(id) {
  document.querySelectorAll(".pan").forEach((p) => p.classList.toggle("on", "#" + p.id === id));
  document.body.classList.toggle("jugando", id === null);
}

function alMenu() {
  modo = "menu";
  verPan("#pMenu");
  AU.nivel(false);
  AU.musica("menu");
}
function juega() {
  modo = "juega";
  verPan(null);
  AU.nivel(true);
  AU.musica("camina");
}

$("#mJugar").addEventListener("click", () => { AU.toque(); juega(); });
$("#mVolver").addEventListener("click", () => { AU.toque(); alMenu(); });
$("#bPausa").addEventListener("pointerdown", (e) => { e.preventDefault(); AU.toque(); alMenu(); });

// El audio despierta con el primer gesto, sea cual sea. En captura sobre el
// documento y no boton por boton: repartido, el proximo boton que se agregue se
// olvida de despertarlo y el juego arranca mudo sin que nadie sepa por que.
let despierto = false;
for (const ev of ["pointerdown", "click", "keydown"])
  document.addEventListener(ev, () => {
    if (despierto) return;
    despierto = true;
    AU.despierta();
    AU.nivel(modo === "juega");
    AU.musica(modo === "juega" ? "camina" : "menu");
  }, { capture: true });

/* ---------- el paso ---------- */
// LA MUSICA CAMBIA CON LO QUE HACE EL PERRO, pero no en el cuadro exacto en que
// cruza el umbral: sin un margen, trotando justo en el limite la pista se pasa
// de una a otra varias veces por segundo y suena a radio mal sintonizada.
let pistaAct = "menu", tPista = 0;
function eligePista(t) {
  if (modo !== "juega") return;
  const q = P.vel > M.VEL_CORRE * 0.66 ? "corre" : "camina";
  if (q === pistaAct) { tPista = t; return; }
  if (t - tPista < 1.1) return;      // hay que sostenerlo mas de un segundo
  pistaAct = q; tPista = t;
  AU.musica(q);
}

const DIR = new THREE.Vector3();

function paso(dt, t) {
  if (modo === "juega") {
    // Adonde quiere ir el dedo. En el plano del piso: el joystick da una
    // direccion en pantalla y la camara mira desde atras, asi que arriba es
    // adelante y derecha es derecha sin mas cuentas.
    const f = ENT.fuerza;
    if (f > 0.04) {
      P.rumboMov = Math.atan2(ENT.x, -ENT.y);
      const quiere = f < M.UMBRAL_CORRE
        ? M.VEL_CAMINA * (f / M.UMBRAL_CORRE)
        : M.VEL_CAMINA + (M.VEL_CORRE - M.VEL_CAMINA) *
          ((f - M.UMBRAL_CORRE) / (1 - M.UMBRAL_CORRE));
      P.vel += (quiere - P.vel) * Math.min(1, M.ACEL * dt);
      // EL PERRO ENCARA ANTES DE ARRANCAR. Girando de golpe se ve como si
      // patinara de costado; girando con una velocidad propia, arranca a
      // caminar en la direccion vieja y va enderezando.
      let d = P.rumboMov - P.rumbo;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      P.rumbo += Math.max(-M.GIRO * dt, Math.min(M.GIRO * dt, d));
    } else {
      P.vel += (0 - P.vel) * Math.min(1, M.FRENO * dt);
      if (P.vel < 0.02) P.vel = 0;
    }

    if (P.vel > 0) {
      // Se avanza hacia donde MIRA el perro, no hacia donde apunta el dedo: es
      // lo que hace que el giro se vea como un giro y no como un desplazamiento
      // lateral.
      DIR.set(Math.sin(P.rumbo), 0, Math.cos(P.rumbo));
      const nx = P.x + DIR.x * P.vel * dt, nz = P.z + DIR.z * P.vel * dt;
      const d = Math.hypot(nx, nz);
      if (d < LIMITE) { P.x = nx; P.z = nz; }
      else P.vel *= 0.5;      // se frena contra el borde en vez de clavarse
    }
    eligePista(t);
  }

  P.y = altura(P.x, P.z);

  if (bicho) {
    const ev = bicho.paso(dt, P.vel, t);
    if (ev) { P.pasos++; AU.pisada(ev === "fuerte"); }
    apoya(bicho.pivote, P.x, P.z, P.rumbo);
  }

  pasto.paso(t, P.x, P.z);
  sigueSombra(sol, P.x, P.y, P.z);

  if (modo === "juega") camara.paso(dt, P.x, P.z, P.rumboMov, P.vel > 0.3);
  else camara.vitrina(t, P.x, P.z);
}

// PARA PODER MEDIR EL AUDIO. El analizador se lee al ritmo del dibujo, y con
// la tarjeta por software un cuadro tarda entre 250 y 500 ms: un ladrido dura
// 190 ms y cae ENTERO entre dos lecturas. El instrumento se pierde el golpe y
// dice que el ladrido es flojo cuando el problema es que no lo vio.
// Frenando el dibujo, el bucle de medicion corre a milisegundos y ve el pico.
// No cambia nada de lo que se juega: nadie llama a esto desde el juego.
let dibujando = true;
function cuadro() {
  requestAnimationFrame(cuadro);
  if (!dibujando) return;
  const ahora = performance.now() / 1000;
  // EL PASO SE TAPA EN 1/20 DE SEGUNDO. Al volver de una pestaña en segundo
  // plano, `dt` vale varios segundos y el perro aparece del otro lado del
  // campo; peor, el pasto se resiembra una vez por cada metro de ese salto.
  const dt = Math.min(0.05, ahora - tAnt);
  tAnt = ahora;
  paso(dt, ahora - t0);
  ren.render(esc, cam);
}

alMenu();
pasto.resiembra(0, 0);
requestAnimationFrame(cuadro);

/* ============================================================
   LAS SONDAS. Una afirmacion sin numero no vale.
   ============================================================ */
globalThis.__perro = {
  est: () => ({ modo, vel: +P.vel.toFixed(2), x: +P.x.toFixed(2), z: +P.z.toFixed(2),
                y: +P.y.toFixed(2), rumbo: +P.rumbo.toFixed(2),
                ladridos: P.ladridos, pasos: P.pasos,
                cargado: !!bicho, conClips: bicho ? bicho.conClips : null }),
  audio: () => AU.estado(),
  rms: () => AU.rms(),
  /** Mueve al perro POR EL MISMO CAMINO que el dedo: con dos caminos, la prueba
   *  estaria probando otra cosa que la que se juega. */
  anda(seg, x, y) {
    ENT.x = x; ENT.y = y; ENT.fuerza = Math.min(1, Math.hypot(x, y));
    const a = { x: P.x, z: P.z };
    const n = Math.round(seg / 0.016);
    for (let i = 0; i < n; i++) paso(0.016, (performance.now() / 1000 - t0) + i * 0.016);
    ENT.x = ENT.y = ENT.fuerza = 0;
    return { rec: +Math.hypot(P.x - a.x, P.z - a.z).toFixed(2), vel: +P.vel.toFixed(2),
             pasos: P.pasos };
  },
  /** Cuanto cuesta un cuadro entero, dibujo incluido. */
  costo(n = 90) {
    const t = performance.now();
    for (let i = 0; i < n; i++) { paso(0.016, i * 0.016); ren.render(esc, cam); }
    return { ms: +((performance.now() - t) / n).toFixed(3), n };
  },
  /** Cuanto se despega el perro del suelo que se ve. Si esto no da ~0, el
   *  terreno y la consulta de altura no son la misma superficie. */
  pegadoAlSuelo(n = 400) {
    let peor = 0;
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * LIMITE, z = (Math.random() * 2 - 1) * LIMITE;
      apoya(bicho.pivote, x, z, 0);
      peor = Math.max(peor, Math.abs(bicho.pivote.position.y - altura(x, z)));
    }
    apoya(bicho.pivote, P.x, P.z, P.rumbo);
    return +peor.toFixed(5);
  },
  /** Las matrices del esqueleto, en crudo. Es la unica forma honesta de
   *  comprobar que la animacion DEFORMA la malla: un mixer con un clip cuyos
   *  huesos no coinciden corre igual, no mueve nada, y desde el codigo se ve
   *  identico a que funcione. */
  huesos() {
    const v = [];
    if (bicho) bicho.pivote.traverse((o) => {
      if (o.isBone) v.push(o.position.x, o.position.y, o.position.z,
                           o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w);
    });
    return v;
  },
  pan: (id) => { id ? alMenu() : juega(); return modo; },
  pasto: () => pasto.malla.count,
  /** Solo para medir: frena el dibujo sin tocar el audio. */
  dibujo: (v) => { dibujando = v; return dibujando; },
  P,
};
