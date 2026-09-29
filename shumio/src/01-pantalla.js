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
const PANT = { W: 534, H: 240, PX: 3, dw: 1600, dh: 720, ox: 0, oy: 0, vertical: false, salaX: 0, salaY: 0 };
const ALTO_MIN = 236;   // la sala (224) y un margen

function medir() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = lienzo.clientWidth || innerWidth, ch = lienzo.clientHeight || innerHeight;
  const dw = Math.round(cw * dpr), dh = Math.round(ch * dpr);
  PANT.vertical = ch > cw * 1.05;
  // el lado que manda es el alto (acostado); parado, el ancho (para mostrar "girá el teléfono")
  const PX = Math.max(1, Math.floor((PANT.vertical ? dw * 0.62 : dh) / ALTO_MIN));
  if (dw === PANT.dw && dh === PANT.dh && PX === PANT.PX && lienzo.width === dw) return;
  PANT.dw = dw; PANT.dh = dh; PANT.PX = PX;
  lienzo.width = dw; lienzo.height = dh;
  PANT.W = Math.ceil(dw / PX); PANT.H = Math.ceil(dh / PX);
  PANT.ox = Math.floor((dw - PANT.W * PX) / 2); PANT.oy = Math.floor((dh - PANT.H * PX) / 2);
  cvM.width = PANT.W; cvM.height = PANT.H;
  cxM.imageSmoothingEnabled = false; cxP.imageSmoothingEnabled = false;
  PANT.salaX = Math.floor((PANT.W - SALA_W) / 2);
  PANT.salaY = Math.floor((PANT.H - SALA_H) / 2);
  if (typeof alMedir === "function") alMedir();
}
new ResizeObserver(() => medir()).observe(lienzo);
addEventListener("orientationchange", () => setTimeout(medir, 200));

/** Del punto de la pantalla (CSS) al mundo (píxeles de juego). */
function aMundo(clientX, clientY) {
  const dpr = PANT.dw / (lienzo.clientWidth || innerWidth);
  return { x: (clientX * dpr - PANT.ox) / PANT.PX, y: (clientY * dpr - PANT.oy) / PANT.PX };
}

function presentar() {
  cxP.drawImage(cvM, 0, 0, PANT.W, PANT.H, PANT.ox, PANT.oy, PANT.W * PANT.PX, PANT.H * PANT.PX);
}
