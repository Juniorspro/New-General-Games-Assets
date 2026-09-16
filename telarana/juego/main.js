import * as THREE from "three";
import { GLTFLoader }      from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader }      from "three/addons/loaders/RGBELoader.js";
import { EffectComposer }  from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }      from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass }      from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass }        from "three/addons/postprocessing/SMAAPass.js";
import { Ciudad, Jugador, Pose, ALCANCE } from "./juego.js";

const $ = (s) => document.querySelector(s);
const DURACION = 120;

/* ------------------------------------------------------------- render --- */
const ren = new THREE.WebGLRenderer({ antialias:false, powerPreference:"high-performance" });
ren.setSize(innerWidth, innerHeight);
ren.outputColorSpace = THREE.SRGBColorSpace;
ren.toneMapping = THREE.ACESFilmicToneMapping;
ren.toneMappingExposure = 0.72;
ren.shadowMap.enabled = true;
ren.shadowMap.type = THREE.PCFSoftShadowMap;
ren.info.autoReset = false;
document.body.appendChild(ren.domElement);

const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0xa8b6c6, 260, 1800);
const camara = new THREE.PerspectiveCamera(64, innerWidth/innerHeight, 0.4, 6000);

const sol = new THREE.DirectionalLight(0xffe9cf, 2.5);
sol.position.set(-260, 320, 180);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
const sc = sol.shadow.camera;
sc.left = -180; sc.right = 180; sc.top = 220; sc.bottom = -60; sc.near = 1; sc.far = 1000;
sol.shadow.bias = -0.0008; sol.shadow.normalBias = 0.8;
escena.add(sol, sol.target);

/* ------------------------------------------------------------- carga --- */
const PESOS = { cielo:.08, ciudad:.62, heroe:.22, orbe:.05, datos:.03 };
const hecho = {};
function avance(k, v){
  hecho[k] = v;
  const t = Object.keys(PESOS).reduce((a, k2) => a + (hecho[k2] || 0) * PESOS[k2], 0);
  $("#barraCarga i").style.width = (t * 100).toFixed(0) + "%";
}
const mirar = (k) => (e) => { if (e.lengthComputable) avance(k, e.loaded / e.total); };

const cargador = new GLTFLoader();
const pedir = (url, k) => new Promise((ok, mal) =>
  cargador.load(url, (g) => { avance(k, 1); ok(g); }, mirar(k), mal));

Promise.all([
  new Promise((ok, mal) => new RGBELoader().load("./cielo.hdr", (t) => { avance("cielo",1); ok(t); }, mirar("cielo"), mal)),
  pedir("./ciudad.glb", "ciudad"),
  pedir("./heroe.glb", "heroe"),
  pedir("./orbe.glb", "orbe"),
  fetch("./ciudad.json").then((r) => r.json()).then((j) => { avance("datos",1); return j; }),
]).then(arrancar).catch((e) => {
  $("#carga .bajada").textContent = "No se pudo cargar: " + (e && e.message || e);
});

/* ------------------------------------------------------------- juego --- */
let jugadorInicio = [0, 60, 0];
let ciudad, jugador, pose, mezclador, acciones = {}, heroe, hilo, orbes = [],
    compuesta, jugando = false, tiempo = DURACION, tomados = 0, puntaVel = 0, puntaAlt = 0;
const teclas = {};
let giroH = Math.PI, giroV = -0.22, tirando = false, hayEnganche = false;

const CALIDAD = {
  alta:  { escala: Math.min(devicePixelRatio, 2),   smaa:true,  sombras:true  },
  media: { escala: Math.min(devicePixelRatio, 1.4), smaa:false, sombras:true  },
  baja:  { escala: 1,                               smaa:false, sombras:false },
};
let calidad = "media";

function arrancar([cielo, gCiudad, gHeroe, gOrbe, datos]){
  cielo.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(ren);
  escena.environment = pmrem.fromEquirectangular(cielo).texture;
  escena.background = cielo;
  escena.backgroundBlurriness = 0.02;

  // tapa el hemisferio oscuro del HDRI por debajo del horizonte
  const horizonte = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000),
    new THREE.MeshBasicMaterial({ color: 0x8a8175 }));
  horizonte.rotation.x = -Math.PI/2; horizonte.position.y = -0.8;
  escena.add(horizonte);

  gCiudad.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    if (o.material) {
      o.material.envMapIntensity = 0.45;
      if (o.material.map) o.material.map.anisotropy = Math.min(8, ren.capabilities.getMaxAnisotropy());
    }
  });
  escena.add(gCiudad.scene);

  ciudad = new Ciudad(datos.cajas);
  jugador = new Jugador(ciudad, datos.arranque);
  jugadorInicio = datos.arranque;

  /* ---- héroe: se escala a 1,80 m y se le miden los pies ---- */
  heroe = gHeroe.scene;
  const caja = new THREE.Box3().setFromObject(heroe);
  const alto = caja.max.y - caja.min.y;
  const k = 1.8 / (alto || 1);
  heroe.scale.setScalar(k);
  heroe.position.y = -caja.min.y * k;
  const soporte = new THREE.Group();
  soporte.add(heroe);
  escena.add(soporte);
  heroe.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });

  mezclador = new THREE.AnimationMixer(heroe);
  for (const c of gHeroe.animations) {
    const nombre = c.name.replace("preset:", "");
    acciones[nombre] = mezclador.clipAction(c);
    acciones[nombre].play();
    acciones[nombre].setEffectiveWeight(nombre === "idle" ? 1 : 0);
  }
  pose = new Pose(heroe);
  jugador.soporte = soporte;

  /* ---- el hilo: un cilindro que se estira entre la mano y el ancla ---- */
  hilo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 5, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent:true, opacity:.92, fog:false }));
  hilo.geometry.translate(0, 0.5, 0);      // el origen queda en la punta
  hilo.visible = false;
  hilo.frustumCulled = false;
  escena.add(hilo);

  /* ---- orbes ---- */
  const molde = gOrbe.scene;
  const cajaO = new THREE.Box3().setFromObject(molde);
  const ko = 1.5 / Math.max(1e-3, cajaO.max.y - cajaO.min.y);
  molde.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material.emissive = new THREE.Color(0x2fd8ff);
    o.material.emissiveIntensity = 2.4;
    o.material.envMapIntensity = 0.6;
  });
  for (const p of datos.orbes) {
    const m = molde.clone(true);
    m.scale.setScalar(ko);
    m.position.set(p[0], p[1], p[2]);
    escena.add(m);
    orbes.push({ nodo: m, base: p[1], vivo: true });
  }
  $("#orbes").textContent = "0 / " + orbes.length;

  armarPost();
  $("#carga").classList.add("ido");
  setTimeout(() => { $("#carga").hidden = true; $("#inicio").hidden = false; }, 500);
  colocar(0);
  lazo();
}

function armarPost(){
  const c = CALIDAD[calidad];
  if (compuesta) compuesta.dispose();
  ren.setPixelRatio(c.escala);
  ren.shadowMap.enabled = c.sombras;
  compuesta = new EffectComposer(ren);
  compuesta.setSize(innerWidth, innerHeight);
  compuesta.addPass(new RenderPass(escena, camara));
  compuesta.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.7, 0.85));
  compuesta.addPass(new OutputPass());
  if (c.smaa) compuesta.addPass(new SMAAPass(innerWidth, innerHeight));
}

/* ------------------------------------------------------------ controles --- */
document.querySelectorAll("[data-calidad]").forEach((b) => b.addEventListener("click", () => {
  calidad = b.dataset.calidad;
  document.querySelectorAll("[data-calidad]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  if (compuesta) armarPost();
}));
$("#btJugar").addEventListener("click", empezar);
$("#btOtra").addEventListener("click", () => { $("#resultado").hidden = true; empezar(); });

function empezar(){
  $("#inicio").hidden = true;
  $("#hud").classList.add("on");
  tiempo = DURACION; tomados = 0; puntaVel = 0; puntaAlt = 0;
  for (const o of orbes) { o.vivo = true; o.nodo.visible = true; }
  $("#orbes").textContent = "0 / " + orbes.length;
  jugador.pos.set(jugadorInicio[0], jugadorInicio[1] + 28, jugadorInicio[2]); jugador.vel.set(0, 0, -14); jugador.soltar();
  jugando = true;
  ren.domElement.requestPointerLock();
}


addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== ren.domElement) return;
  giroH -= e.movementX * 0.0022;
  giroV = Math.max(-1.15, Math.min(0.95, giroV - e.movementY * 0.0019));
});
addEventListener("mousedown", (e) => { if (e.button === 0) tirar(true); });
addEventListener("mouseup",   (e) => { if (e.button === 0) tirar(false); });
addEventListener("keydown", (e) => {
  teclas[e.code] = true;
  if (e.code === "Space" && jugando) { e.preventDefault(); jugador.saltar(); }
});
addEventListener("keyup", (e) => { teclas[e.code] = false; });
addEventListener("resize", () => {
  camara.aspect = innerWidth/innerHeight; camara.updateProjectionMatrix();
  ren.setSize(innerWidth, innerHeight);
  if (compuesta) compuesta.setSize(innerWidth, innerHeight);
});

function tirar(si){
  tirando = si;
  if (!jugando) return;
  if (si) jugador.lanzar(dirCamara());
  else jugador.soltar();
}

const _d = new THREE.Vector3();
function dirCamara(){
  return _d.set(Math.sin(giroH) * Math.cos(giroV), Math.sin(giroV), Math.cos(giroH) * Math.cos(giroV)).normalize();
}

/* -------------------------------------------------------------- cámara --- */
const camObj = new THREE.Vector3();
function colocar(dt){
  const dir = dirCamara();
  const dist = 6.2 + Math.min(4, jugador.rapidez * 0.09);
  camObj.copy(jugador.pos)
        .addScaledVector(dir, -dist)
        .add(new THREE.Vector3(0, 1.5, 0));
  /* La cámara no atraviesa edificios. Dos pasos: primero se acorta el brazo
     hasta el primer choque del rayo; después, por si el rayo salió justo por
     una esquina, se comprueba que el punto final no haya quedado dentro de
     ninguna caja y se va acercando hasta que salga. Sin lo segundo la cámara
     se metía en la pared del edificio de al lado y se veía media pantalla
     negra. */
  const ojo = jugador.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
  const hacia = camObj.clone().sub(ojo);
  const l = hacia.length();
  const u = hacia.clone().normalize();
  const g = ciudad && ciudad.enganche(ojo, u, l);
  let brazo = g ? Math.max(1.5, g.dist - 0.5) : l;
  camObj.copy(ojo).addScaledVector(u, brazo);
  for (let i = 0; i < 8 && ciudad.dentro(camObj, 0.6); i++) {
    brazo *= 0.7;
    camObj.copy(ojo).addScaledVector(u, brazo);
  }
  if (brazo < 1.4) camObj.copy(ojo).addScaledVector(u, 1.4);
  const k = dt ? Math.min(1, dt * 9) : 1;
  camara.position.lerp(camObj, k);
  if (ciudad.dentro(camara.position, 0.3)) camara.position.copy(camObj);
  camara.lookAt(jugador.pos.x, jugador.pos.y + 0.9, jugador.pos.z);
}

/* ---------------------------------------------------------------- lazo --- */
const reloj = new THREE.Clock();
let t = 0;
function lazo(){
  requestAnimationFrame(lazo);
  const dt = Math.min(reloj.getDelta(), 1/25);
  t += dt;

  if (jugando) {
    // empuje relativo a la cámara
    const mov = new THREE.Vector3();
    const f = dirCamara(); f.y = 0; f.normalize();
    const d = new THREE.Vector3(f.z, 0, -f.x);
    if (teclas.KeyW) mov.add(f);
    if (teclas.KeyS) mov.sub(f);
    if (teclas.KeyA) mov.sub(d);
    if (teclas.KeyD) mov.add(d);
    if (mov.lengthSq() > 0) mov.normalize();

    jugador.paso(dt, mov, teclas.ShiftLeft || teclas.ShiftRight);
    if (tirando && !jugador.anclado) jugador.lanzar(dirCamara());

    tiempo -= dt;
    puntaVel = Math.max(puntaVel, jugador.rapidez);
    puntaAlt = Math.max(puntaAlt, jugador.pos.y);
    if (tiempo <= 0) terminar(false);

    // orbes
    for (const o of orbes) {
      if (!o.vivo) continue;
      o.nodo.rotation.y += dt * 1.3;
      o.nodo.position.y = o.base + Math.sin(t * 1.8 + o.base) * 0.5;
      if (o.nodo.position.distanceTo(jugador.pos) < 3.2) {
        o.vivo = false; o.nodo.visible = false; tomados++;
        $("#orbes").textContent = tomados + " / " + orbes.length;
        if (tomados >= orbes.length) terminar(true);
      }
    }
    pintarHud();
  }

  if (jugador) {
    // el cuerpo mira hacia donde va
    const s = jugador.soporte;
    s.position.copy(jugador.pos);
    s.position.y -= 1.75;
    const rumbo = Math.atan2(jugador.mirando.x, jugador.mirando.z);
    s.rotation.y += Math.atan2(Math.sin(rumbo - s.rotation.y), Math.cos(rumbo - s.rotation.y)) * Math.min(1, dt * 6);

    // mezcla de clips: quieto ↔ caminar, y saltar cuando está en el aire
    const vh = Math.hypot(jugador.vel.x, jugador.vel.z);
    const enAire = !jugador.enSuelo;
    const wCam = Math.min(1, vh / 7) * (enAire ? 0 : 1);
    if (acciones.walk) { acciones.walk.setEffectiveWeight(wCam); acciones.walk.setEffectiveTimeScale(0.6 + vh * 0.12); }
    if (acciones.idle) acciones.idle.setEffectiveWeight(enAire ? 0.15 : 1 - wCam);
    if (acciones.jump) acciones.jump.setEffectiveWeight(enAire && !jugador.anclado ? 0.85 : 0);
    mezclador.update(dt);
    if (pose && pose.tiene()) pose.aplicar(jugador.anclado ? 1 : 0, dt, jugador.brazo, null, heroe);

    // el hilo
    if (jugador.anclado) {
      const mano = pose.mano(jugador.brazo, new THREE.Vector3()) ||
                   jugador.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      const v = jugador.ancla.clone().sub(mano);
      hilo.position.copy(mano);
      hilo.scale.set(1, v.length(), 1);
      hilo.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), v.normalize());
      hilo.visible = true;
    } else hilo.visible = false;

    colocar(dt);
    sol.position.copy(jugador.pos).add(new THREE.Vector3(-260, 320, 180));
    sol.target.position.copy(jugador.pos);
    sol.target.updateMatrixWorld();
  }

  if (compuesta) { ren.info.reset(); compuesta.render(dt); }
}

function pintarHud(){
  const s = Math.max(0, Math.ceil(tiempo));
  $("#tiempo").textContent = Math.floor(s/60) + ":" + String(s % 60).padStart(2, "0");
  $("#reloj").classList.toggle("apura", s <= 15);
  $("#altura").textContent = Math.round(jugador.pos.y) + " m";
  const kmh = jugador.rapidez * 3.6;
  $("#velnum").textContent = Math.round(kmh);
  $("#velbar i").style.width = Math.min(100, kmh / 1.6) + "%";
  // la mira se cierra cuando hay dónde engancharse
  const ojo = jugador.pos.clone(); ojo.y += 0.4;
  hayEnganche = !!ciudad.enganche(ojo, dirCamara(), ALCANCE);
  $("#mira").classList.toggle("hay", hayEnganche);
}

function terminar(gano){
  jugando = false;
  document.exitPointerLock();
  $("#hud").classList.remove("on");
  $("#tituloFin").innerHTML = gano ? "Los <span>veintiocho</span>" : "Se acabó";
  $("#finOrbes").textContent = tomados;
  $("#finVel").textContent = Math.round(puntaVel * 3.6);
  $("#finAlt").textContent = Math.round(puntaAlt);
  $("#resultado").hidden = false;
}

window.juego = { get j(){ return jugador; }, get c(){ return ciudad; },
                 info: () => ({ pos: jugador.pos.toArray().map(Math.round),
                                anclado: jugador.anclado, orbes: orbes.length,
                                cajas: ciudad.cajas.length, llamadas: ren.info.render.calls }) };
