// ─────────────────────────────────────────────────────────────────────────────
// LA PANTALLA: el juego se dibuja chico (~240 px de ancho) en un lienzo aparte y se agranda a escala
// ENTERA (guía 2D § 2: con ×2,7 los píxeles salen de distinto tamaño y todo tiembla al moverse).
// Es vertical: en el teléfono parado ocupa todo; en una pantalla acostada queda una columna 9:16.
// ─────────────────────────────────────────────────────────────────────────────

const lienzo = document.getElementById("lienzo");
const cxP = lienzo.getContext("2d", { alpha: false });
const cvM = document.createElement("canvas");
const gM = cvM.getContext("2d");
// Dos pasadas por cuadro: el MUNDO (pixel art) se dibuja chico en gM y se agranda a escala entera;
// después la INTERFAZ (HUD, menús, textos) se dibuja directo en la pantalla con la misma escala
// puesta como transformación: los sprites salen igual de pixelados, pero las letras se dibujan a la
// resolución real, nítidas, como en el original. `g` apunta a la pasada en curso.
let g = gM;
let W = 240, H = 480, PX = 3, DPR = 1, OFX = 0, ANCHO_COL = 0;
const ANCHO_OBJ = 240;                    // lo que se ve de mundo a lo ancho, como el original en vertical

function medir() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const cw = lienzo.clientWidth || innerWidth, ch = lienzo.clientHeight || innerHeight;
  const fw = Math.round(cw * DPR), fh = Math.round(ch * DPR);
  if (lienzo.width !== fw || lienzo.height !== fh) { lienzo.width = fw; lienzo.height = fh; }
  // columna vertical: si la pantalla es más ancha que 10:16, se encierra al centro
  ANCHO_COL = Math.min(fw, Math.round(fh * 0.62));
  PX = Math.max(2, Math.round(ANCHO_COL / ANCHO_OBJ));
  const nw = Math.ceil(ANCHO_COL / PX), nh = Math.ceil(fh / PX);
  OFX = Math.floor((fw - nw * PX) / 2);
  if (nw !== W || nh !== H || cvM.width !== nw) { W = nw; H = nh; cvM.width = W; cvM.height = H; }
  gM.imageSmoothingEnabled = false; cxP.imageSmoothingEnabled = false;
}
// el lienzo medido una sola vez, antes del layout, deja el juego aplastado (guía 2D § 2): observar y revisar
new ResizeObserver(medir).observe(lienzo);
addEventListener("resize", medir);
medir();

let _marco = null;
/** Empieza el cuadro: el marco de los costados (pantalla acostada) y el mundo a la pasada chica. */
function empezarCuadro() {
  cxP.setTransform(1, 0, 0, 1, 0, 0);
  if (OFX > 0) {
    if (!_marco || _marco.w !== lienzo.width || _marco.h !== lienzo.height) {
      const c = document.createElement("canvas"); c.width = lienzo.width; c.height = lienzo.height;
      const q = c.getContext("2d"), gr = q.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.width * 0.7);
      gr.addColorStop(0, "#1a0d18"); gr.addColorStop(1, "#040306"); q.fillStyle = gr; q.fillRect(0, 0, c.width, c.height);
      q.fillStyle = "#6a4a2a"; q.fillRect(OFX - 2, 0, 2, c.height); q.fillRect(OFX + W * PX, 0, 2, c.height);
      _marco = { c, w: c.width, h: c.height };
    }
    cxP.drawImage(_marco.c, 0, 0);
  }
  g = gM;
}
/** Pasa el mundo chico a la pantalla y deja `g` en la pasada de interfaz (escala PX, recortada a la columna). */
function aPantalla(conMundo) {
  cxP.setTransform(1, 0, 0, 1, 0, 0);
  if (conMundo) cxP.drawImage(cvM, 0, 0, W, H, OFX, 0, W * PX, H * PX);
  cxP.save();
  cxP.beginPath(); cxP.rect(OFX, 0, W * PX, H * PX); cxP.clip();
  cxP.setTransform(PX, 0, 0, PX, OFX, 0);
  cxP.imageSmoothingEnabled = false;
  g = cxP;
}
function terminarCuadro() { if (g === cxP) cxP.restore(); g = gM; }
/** De un punto de la pantalla (px CSS) al lienzo chico. */
function aJuego(clientX, clientY) {
  const r = lienzo.getBoundingClientRect();
  return { x: ((clientX - r.left) * DPR - OFX) / PX, y: ((clientY - r.top) * DPR) / PX };
}

// pantalla completa: sólo se puede pedir en un gesto de verdad (en Android, pointerup/touchend/click)
function pedirCompleta() {
  const d = document.documentElement;
  try { if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: "hide" }).then(() => { try { screen.orientation.lock("portrait").catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {}
}
