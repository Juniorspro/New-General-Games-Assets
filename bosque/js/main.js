// Bosque: arranque, estados y el bucle de cada cuadro.
import * as THREE from "three";
import { CALIDADES, LUGARES, MUNDO } from "./config.js";
import { cargarTodo } from "./cargador.js";
import { armaTerreno, texturaRuido, mascara, enLago, MS_REJILLA } from "./terreno.js";
import { armaCielo, armaLuces, actualizarCielo, vestirNiebla } from "./cielo.js";
import { Bosque, VIENTO, SOL_VISTA, SOL_COLOR } from "./arboles.js";
import { Flora, JUGADOR } from "./flora.js";
import { Objetos } from "./props.js";
import { armaAgua } from "./agua.js";
import { Fuego } from "./fuego.js";
import { Colisiones } from "./colision.js";
import { Caminante } from "./personaje.js";
import { Camara } from "./camara.js";
import { armaControl, ENTRADA } from "./control.js";
import { Post } from "./post.js";
import { Osd } from "./osd.js";
import { Sonido } from "./audio.js";
import { Cintas } from "./cintas.js";
import { armaMotas } from "./motas.js";

const $ = (id) => document.getElementById(id);
const guardado = (() => { try { return JSON.parse(localStorage.getItem("bosque") || "{}"); } catch (_) { return {}; } })();
const guardar = (k, v) => { guardado[k] = v; try { localStorage.setItem("bosque", JSON.stringify(guardado)); } catch (_) {} };

function calidadInicial() {
  if (guardado.calidad && CALIDADES[guardado.calidad]) return guardado.calidad;
  const tactil = matchMedia("(pointer: coarse)").matches;
  const mem = navigator.deviceMemory || 4, nuc = navigator.hardwareConcurrency || 4;
  if (!tactil && nuc >= 6) return "alta";
  if (mem <= 3 || nuc <= 4) return "baja";
  return "media";
}

function fallar(e) {
  console.error(e);
  const el = $("error");
  el.hidden = false;
  el.textContent = "NO HAY SEÑAL\n\n" + (e && e.message ? e.message : String(e)) +
    "\n\nEste bosque necesita WebGL 2. Probá con Chrome o Firefox actualizados.";
  $("carga").hidden = true;
}

async function iniciar() {
  const lienzo = $("c");
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: "high-performance", stencil: false });
  if (!renderer.capabilities.isWebGL2) throw new Error("WebGL 2 no está disponible en este navegador.");
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.NoToneMapping;   // el tono lo pone post.js, al final
  renderer.info.autoReset = false;               // se cuentan las cuatro pasadas juntas

  let nivel = calidadInicial();
  let cal = CALIDADES[nivel];
  // PCFSoft ya no existe en esta versión de three: pedirlo cae a PCF con un aviso
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const { tex, glb, datos } = await cargarTodo(renderer, (f, que) => {
    $("cargaBarra").style.width = Math.round(f * 100) + "%";
    $("cargaTexto").textContent = `REBOBINANDO… ${Math.round(f * 100)}%`;
  });
  $("cargaTexto").textContent = "ARMANDO EL BOSQUE…";
  await new Promise((r) => setTimeout(r, 30));      // que se pinte el texto

  const t0 = performance.now();
  const escena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1100);
  tex.ruido = texturaRuido();

  const cielo = armaCielo(tex.cielo, datos.cielo);
  escena.add(cielo.malla);
  const luces = armaLuces(escena, datos.cielo, cal.sombra);
  SOL_COLOR.value.copy(luces.sol.color);
  // el reflejo difuso y especular del cielo, para todo lo que es PBR
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromEquirectangular(tex.cielo).texture;
  escena.environmentIntensity = 0.26;
  pmrem.dispose();

  const terreno = armaTerreno(tex);
  vestirNiebla(terreno.material);
  escena.add(terreno);

  const bosque = new Bosque(renderer, tex, cal);
  terreno.geometry.attributes.aMezcla.needsUpdate = true;   // ya con la sombra de las copas
  escena.add(bosque.grupo);
  const flora = new Flora(tex, cal, VIENTO);
  escena.add(flora.grupo);
  const colisiones = new Colisiones();
  const objetos = new Objetos(glb, bosque, colisiones);
  escena.add(objetos.grupo);
  const agua = armaAgua(tex, tex.cielo, luces.solFoto);
  escena.add(agua.malla);
  const fuego = new Fuego(objetos.fogata.position.clone().add(new THREE.Vector3(0, 0.08, 0)));
  escena.add(fuego.grupo);
  const cintas = new Cintas(glb.cinta, objetos);
  escena.add(cintas.grupo);
  const motas = armaMotas(luces.solFoto);
  escena.add(motas.malla);

  const caminante = new Caminante(glb.caminante);
  const I = LUGARES.inicio;
  const rumbo0 = Math.atan2(LUGARES.lago.x - I.x, LUGARES.lago.z - I.z);
  caminante.colocar(I.x, I.z, rumbo0);
  escena.add(caminante.raiz);
  const camara = new Camara(cam);
  camara.yaw = rumbo0;

  const post = new Post(renderer);
  const osd = new Osd();
  post.U.tOsd.value = osd.tex;
  const sonido = new Sonido();
  caminante.alPisar = (v, hondo) => sonido.paso(v, hondo, mascara(caminante.pos.x, caminante.pos.z, 0) > 0.45);

  const armado = performance.now() - t0;
  window.__bosque_entrada = ENTRADA;
  window.__bosque = {
    renderer, escena, cam, bosque, flora, objetos, caminante, camara, cintas, post, colisiones, luces,
    medidas: { rejillaMs: MS_REJILLA, armadoMs: armado, arbolesMs: bosque.ms, floraMs: flora.ms, objetosMs: objetos.ms,
               arboles: bosque.arboles.length, flora: flora.cuenta, colisiones: colisiones.n,
               trisArbol: bosque.tris, altoCaminante: caminante.altoMedido, flotante: post.flotante },
  };

  // ── estados ──
  let estado = "menu";          // menu | jugando | pausa
  let vhs = guardado.vhs !== false;
  const U = post.U;
  U.uVHS.value = vhs ? 1 : 0;
  let resDin = 1;               // escala dinámica según cuánto tarda cada cuadro
  let remedir = false;
  // ?fijo apaga la resolución que se adapta: las pruebas corren en un
  // navegador que dibuja por software y la bajaría al mínimo a los 2 s
  const fijo = new URLSearchParams(location.search).has("fijo");

  function medir() {
    const W = innerWidth, H = innerHeight;
    const corto = Math.min(W, H);
    // CON VHS SE DIBUJA A 480 LÍNEAS en el lado corto, lo que tiene una cinta.
    // Sin VHS, a la densidad de la pantalla hasta 1,5 y según la calidad.
    let esc = vhs ? Math.min(1.25, 480 / corto) : Math.min(devicePixelRatio || 1, 1.5) * cal.escala;
    esc *= resDin;
    let w = Math.round(W * esc), h = Math.round(H * esc);
    const tope = 2.3e6;
    if (w * h > tope) { const k = Math.sqrt(tope / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
    renderer.setSize(w, h, false);
    post.tamano(w, h);
    camara.ajustarFov(W / H);
    osd.tamano(W / H);
  }
  addEventListener("resize", medir);
  medir();

  const textoVHS = () => (vhs ? "VHS: SÍ" : "VHS: NO");
  const textoCal = () => "CALIDAD: " + nivel.toUpperCase();
  const refrescarBotones = () => {
    $("mVHS").textContent = $("pVHS").textContent = textoVHS();
    $("mCal").textContent = $("pCal").textContent = textoCal();
    $("pCuenta").textContent = `CINTAS ${cintas.tomadas}/5`;
  };
  const alternarVHS = () => { vhs = !vhs; U.uVHS.value = vhs ? 1 : 0; guardar("vhs", vhs); medir(); refrescarBotones(); };
  const cambiarCalidad = () => {
    // cambiar la calidad cambia cuántos árboles y plantas se arman: se guarda
    // y se recarga, que es más honesto que rearmar medio mundo en caliente
    const orden = ["baja", "media", "alta"];
    guardar("calidad", orden[(orden.indexOf(nivel) + 1) % 3]);
    location.reload();
  };
  for (const id of ["mVHS", "pVHS"]) $(id).addEventListener("click", alternarVHS);
  for (const id of ["mCal", "pCal"]) $(id).addEventListener("click", cambiarCalidad);

  function jugar() {
    sonido.arrancar();
    estado = "jugando";
    $("menu").hidden = true; $("pausa").hidden = true; $("hud").hidden = false;
    osd.play = 6;
    // en el teléfono: pantalla completa y acostado, si el navegador deja
    if (matchMedia("(pointer: coarse)").matches && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).then(() => screen.orientation?.lock?.("landscape")).catch(() => {});
    }
    sonido.silencio(false);
    medir();
  }
  function pausar() {
    if (estado !== "jugando") return;
    estado = "pausa";
    control.soltar();
    document.exitPointerLock?.();
    $("pausa").hidden = false; $("hud").hidden = true;
    refrescarBotones();
    sonido.silencio(true);
  }
  $("mJugar").addEventListener("click", jugar);
  $("pSeguir").addEventListener("click", jugar);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pausar(); });

  let aviso = 0, cintaCerca = null, azul = 0;
  function recoger() {
    if (estado !== "jugando" || !cintaCerca) return;
    const txt = cintas.tomar(cintaCerca);
    cintaCerca = null;
    $("bAccion").hidden = true;
    // el cartel de la cinta anterior se va ya: si no, durante el azul se lee
    // el texto viejo y parece que la cinta nueva dice lo mismo
    $("aviso").hidden = true; aviso = 0;
    sonido.recoger();
    osd.cintas = cintas.tomadas;
    azul = 1.6;                          // la pantalla azul de la casetera
    camara.sacudida = 1;
    setTimeout(() => {
      $("avisoTitulo").textContent = txt.titulo;
      $("avisoTexto").textContent = txt.texto;
      $("aviso").hidden = false;
      aviso = 9;
      osd.play = 5;
      if (cintas.tomadas === 5) setTimeout(() => {
        $("avisoTitulo").textContent = "FIN DE LA CINTA";
        $("avisoTexto").textContent = "Encontraste las cinco. El sol sigue ahí. Podés quedarte todo lo que quieras.";
        $("aviso").hidden = false; aviso = 10;
      }, 9500);
    }, 900);
  }
  const control = armaControl($("hud"), {
    mirar: (dx, dy) => camara.arrastrar(dx, dy),
    accion: recoger,
    vhs: alternarVHS,
    pausa: () => (estado === "jugando" ? pausar() : estado === "pausa" ? jugar() : null),
  });

  refrescarBotones();
  $("cargaTexto").textContent = "AJUSTANDO TRACKING…";
  medir();
  camara.vitrina(0, new THREE.Vector3(LUGARES.lago.x + 40, 1, LUGARES.lago.z + 48));
  await precompilar(renderer, escena, cam);
  // y una pasada completa de dibujo, que es la que arma la sombra y el cielo
  post.dibujar(escena, cam, 0);
  $("carga").hidden = true;
  if (estado === "menu") $("menu").hidden = false;

  // ── el cuadro ──
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const vitrina = new THREE.Vector3(LUGARES.lago.x + 40, 0, LUGARES.lago.z + 48);
  vitrina.y = 1.0;
  let antes = performance.now(), t = 0, interSuave = 0;
  const tiempos = [];
  let ultimoAjuste = 0;

  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    // EL PRIMER CUADRO PUEDE TENER TIEMPO NEGATIVO: la marca de requestAnimationFrame
    // es la del comienzo del cuadro, que puede ser ANTERIOR al performance.now()
    // que se tomó al armar. Con dt negativo el "azul de casetera" se prendía solo
    // y la partida arrancaba con la pantalla azul.
    const real = ahora - antes;
    let dt = Math.max(0, Math.min(0.05, real / 1000));
    antes = ahora;
    window.__bosque.cuadroReal = real;
    renderer.info.reset();
    // EL LIENZO SE CAMBIA DE TAMAÑO AL EMPEZAR EL CUADRO, NUNCA AL FINAL.
    // Cambiarle el tamaño lo borra; hecho después de dibujar, el navegador
    // mostraba ese lienzo vacío: un cuadro negro cada vez que la resolución
    // se adaptaba.
    if (remedir) { remedir = false; medir(); }
    if (estado === "pausa") dt = 0;
    t += dt;
    VIENTO.uT.value = t;

    if (estado === "jugando") {
      caminante.paso(dt, ENTRADA, camara.adelante(), colisiones, bosque);
      camara.paso(dt, caminante, bosque);
      JUGADOR.value.copy(caminante.pos);
      const { cinta, d } = cintas.cercana(caminante.pos);
      const puede = cinta && d < 2.3;
      if (puede !== !!cintaCerca) $("bAccion").hidden = !puede;
      cintaCerca = puede ? cinta : null;
      interSuave += (cintas.interferencia(caminante.pos) - interSuave) * Math.min(1, dt * 2);
    } else if (estado === "menu") {
      camara.vitrina(t, vitrina);
    }
    U.uInterferencia.value = vhs ? interSuave : 0;
    sonido.interferencia = interSuave;
    osd.aviso = interSuave > 0.55 && vhs ? "TRACKING" : "";
    azul = Math.max(0, azul - dt);
    U.uAzul.value = Math.min(1, azul * 1.5) * (azul > 0 ? 1 : 0);
    if (aviso > 0) { aviso -= dt; if (aviso <= 0) $("aviso").hidden = true; }

    cielo.malla.position.copy(cam.position);
    actualizarCielo(luces, cam, caminante.pos);
    SOL_VISTA.value.copy(luces.solFoto).transformDirection(cam.matrixWorldInverse);
    pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    bosque.actualizar(cam, frustum);
    flora.actualizar(cam, frustum);
    objetos.actualizar(cam, frustum);
    fuego.paso(t);
    motas.paso(t, cam);
    agua.mat.uniforms.uT.value = t;
    cintas.paso(dt);
    osd.paso(dt, vhs && estado !== "menu");
    post.sol(cam, luces.solFoto);
    post.dibujar(escena, cam, t);

    const dF = caminante.pos.distanceTo(fuego.grupo.position);
    const aF = Math.atan2(fuego.grupo.position.x - cam.position.x, fuego.grupo.position.z - cam.position.z) - camara.yaw;
    sonido.actualizar(dt, {
      dFuego: estado === "menu" ? 99 : dF,
      panFuego: -Math.sin(aF),
      cercaAgua: Math.max(0, 1 - Math.abs(enLago(caminante.pos.x, caminante.pos.z) - 1.05) / 0.25),
      enAbierto: enLago(caminante.pos.x, caminante.pos.z) < 1.4,
      vhs,
    });

    // RESOLUCIÓN QUE SE ADAPTA: si durante dos segundos el cuadro tarda más
    // de 40 ms, se dibuja un poco más chico; si sobra, se vuelve a subir.
    tiempos.push(dt);
    if (tiempos.length > 60) tiempos.shift();
    if (!fijo && estado === "jugando" && ahora - ultimoAjuste > 2000 && tiempos.length >= 60) {
      const medio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
      const antesRes = resDin;
      if (medio > 0.04 && resDin > 0.6) resDin = Math.max(0.6, resDin - 0.1);
      else if (medio < 0.022 && resDin < 1) resDin = Math.min(1, resDin + 0.1);
      if (resDin !== antesRes) remedir = true;
      ultimoAjuste = ahora;
    }
    window.__bosque.cuadroMs = dt * 1000;
    window.__bosque.estado = estado;
    window.__bosque.t = t;
  }
  bosque.actualizar(cam, frustum, true);
  requestAnimationFrame(cuadro);
}

/** Compila TODOS los shaders antes de mostrar el menú. Si no, cada material
 *  se compila la primera vez que aparece en pantalla: al llegar al claro se
 *  compilaban las flores y el cuadro se quedaba en negro un momento. */
async function precompilar(renderer, escena, cam) {
  const ocultos = [];
  escena.traverse((o) => { if (o.isInstancedMesh && o.count === 0) { o.count = 1; ocultos.push(o); } });
  try { await renderer.compileAsync(escena, cam); } catch (_) { renderer.compile(escena, cam); }
  for (const o of ocultos) o.count = 0;
}

iniciar().catch(fallar);
