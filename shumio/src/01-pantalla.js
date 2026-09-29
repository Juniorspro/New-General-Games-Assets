// ─────────────────────────────────────────────────────────────────────────────
// LA PANTALLA: el mundo se dibuja chico (en píxeles de juego) y se agranda con una
// escala ENTERA (×2, ×3…), nunca ×2,7: si no, los píxeles salen de distinto tamaño y
// todo tiembla (guía 2D § 2). En un TCL 20 SE acostado (1600×720 píxeles de pantalla)
// da ×3 y un mundo de 534×240: entra la sala entera (368×224) y sobran los costados
// para los pulgares.
// ─────────────────────────────────────────────────────────────────────────────

const lienzo = document.getElementById("lienzo");
const cxP = lienzo.getContext("2d", { alpha: false });
const cvM = document.createElement("canvas");
const cxM = cvM.getContext("2d", { alpha: false });
const PANT = { W: 444, H: 200, PX: 3.6, k: 3, dw: 1600, dh: 720, ox: 0, oy: 0, vertical: false, salaX: 0, salaY: 0, girado: false, cssW: 0 };
// Medido en el video: en el original entran enteros los dos muros (arriba y abajo, con sus puertas)
// y el piso ocupa ~74 % del alto; la barra del jefe va sobre el muro de abajo (~95 % del alto).
// La sala mide 224 de alto: con 228 entra toda, con un filito de margen.
const VISTA_H = SALA_H + 4;
const ANCHO_MIN = SALA_W + 8;  // y de ancho, como mínimo: nunca se corta la sala por los costados
const cvK = document.createElement("canvas"), cxK = cvK.getContext("2d", { alpha: false });

function medir() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const vw = innerWidth, vh = innerHeight;
  // el juego es SIEMPRE horizontal: con el teléfono parado, el lienzo se gira 90° (se juega de costado
  // aunque el navegador no deje trabar la orientación)
  const girar = vh > vw * 1.05;
  if (girar !== PANT.girado || PANT.cssW !== (girar ? vh : vw)) {
    PANT.girado = girar;
    const st = lienzo.style;
    if (girar) { st.width = vh + "px"; st.height = vw + "px"; st.transformOrigin = "0 0"; st.transform = `translateX(${vw}px) rotate(90deg)`; }
    else { st.width = "100%"; st.height = "100%"; st.transform = ""; }
  }
  const cw = girar ? vh : vw, ch = girar ? vw : vh;
  PANT.cssW = cw;
  const dw = Math.round(cw * dpr), dh = Math.round(ch * dpr);
  PANT.vertical = false;
  // la cámara, como en el original: la sala entera llena el alto de la pantalla y el HUD va encima
  // de la pared y del margen de los costados
  let PX = dh / VISTA_H;
  if (dw / PX < ANCHO_MIN) PX = dw / ANCHO_MIN;
  if (dw === PANT.dw && dh === PANT.dh && Math.abs(PX - PANT.PX) < 1e-6 && lienzo.width === dw) return;
  PANT.dw = dw; PANT.dh = dh; PANT.PX = PX;
  lienzo.width = dw; lienzo.height = dh;
  PANT.W = Math.ceil(dw / PX); PANT.H = Math.ceil(dh / PX);
  PANT.ox = Math.floor((dw - PANT.W * PX) / 2); PANT.oy = Math.floor((dh - PANT.H * PX) / 2);
  cvM.width = PANT.W; cvM.height = PANT.H;
  // el agrandado en dos pasos: primero por un entero (píxeles duros), después el resto suavizado
  PANT.k = Math.max(1, Math.floor(PX));
  cvK.width = PANT.W * PANT.k; cvK.height = PANT.H * PANT.k;
  cxM.imageSmoothingEnabled = false; cxK.imageSmoothingEnabled = false;
  PANT.salaX = Math.floor((PANT.W - SALA_W) / 2);
  PANT.salaY = Math.floor((PANT.H - SALA_H) / 2);
  if (typeof alMedir === "function") alMedir();
}
new ResizeObserver(() => medir()).observe(document.documentElement);
addEventListener("resize", () => medir());
addEventListener("orientationchange", () => setTimeout(medir, 200));

/** Del punto de la pantalla (CSS) al mundo (píxeles de juego), también con el lienzo girado. */
function aMundo(clientX, clientY) {
  let u = clientX, v = clientY;
  if (PANT.girado) { u = clientY; v = innerWidth - clientX; }
  const dpr = PANT.dw / PANT.cssW;
  return { x: (u * dpr - PANT.ox) / PANT.PX, y: (v * dpr - PANT.oy) / PANT.PX };
}

// ── pantalla completa (y, si el navegador deja, la orientación trabada en horizontal) ──
function enPantallaCompleta() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
// El navegador sólo deja poner pantalla completa (y hacer sonar el audio) DENTRO de un gesto del
// usuario, y con el dedo el gesto cuenta recién al LEVANTARLO (pointerup/touchend), no al apoyarlo.
// Si se pide fuera de un gesto (el menú corre en el bucle del juego), queda pendiente y se cumple
// en el próximo gesto (02-entrada).
let _completaPendiente = null;
function gestoActivo() { const u = navigator.userActivation; return !u || u.isActive; }
function pantallaCompleta(activar = true) {
  if (!gestoActivo()) { _completaPendiente = activar; return; }
  _completaPendiente = null;
  try {
    if (activar && !enPantallaCompleta()) {
      const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen;
      const p = f && f.call(el, { navigationUI: "hide" });
      const trabar = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape").catch(() => {}); } catch (e) { /* no se puede */ } };
      if (p && p.then) p.then(trabar).catch(() => {}); else trabar();
    } else if (!activar && enPantallaCompleta()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } catch (e) { /* el navegador no deja */ }
}
document.addEventListener("fullscreenchange", () => setTimeout(medir, 100));

function presentar() {
  if (PANT.k === PANT.PX) { cxP.imageSmoothingEnabled = false; cxP.drawImage(cvM, 0, 0, PANT.W, PANT.H, PANT.ox, PANT.oy, PANT.W * PANT.PX, PANT.H * PANT.PX); return; }
  cxK.drawImage(cvM, 0, 0, PANT.W, PANT.H, 0, 0, cvK.width, cvK.height);
  cxP.imageSmoothingEnabled = true; cxP.imageSmoothingQuality = "medium";
  cxP.drawImage(cvK, 0, 0, cvK.width, cvK.height, PANT.ox, PANT.oy, Math.round(PANT.W * PANT.PX), Math.round(PANT.H * PANT.PX));
}
