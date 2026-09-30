// ─────────────────────────────────────────────────────────────────────────────
// LA PANTALLA. Como el original (480×270 agrandado sin suavizar), todo se dibuja en un lienzo chico
// y se agranda a escala ENTERA: la letra de píxeles de 8 queda nítida (con ×2,67 salía despareja).
// Acostado: en el teléfono del usuario (1600×720) queda ×3 → 533×240. El alto nunca baja de 240 y el
// ancho no de 440: si no entra, se baja la escala. La arena mide 384 de ancho, como allá.
// ─────────────────────────────────────────────────────────────────────────────

const lienzo = document.getElementById("lienzo");
const cxP = lienzo.getContext("2d", { alpha: false });
const cvM = document.createElement("canvas");
const g = cvM.getContext("2d");
let W = 533, H = 240, PX = 3, DPR = 1, OFX = 0, OFY = 0, PARADO = false;
// la arena (en píxeles del juego); se recalcula con la pantalla
const AR = { x1: 0, y1: 0, x2: 0, y2: 0, w: 384, h: 192, cx: 0, cy: 0 };

function medir() {
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  const fw = Math.round((lienzo.clientWidth || innerWidth) * DPR), fh = Math.round((lienzo.clientHeight || innerHeight) * DPR);
  if (lienzo.width !== fw || lienzo.height !== fh) { lienzo.width = fw; lienzo.height = fh; }
  PARADO = fh > fw * 1.05;
  // parado se dibuja igual, pero rotado 90°: el aviso de "girá el teléfono" se lee de costado
  const lw = PARADO ? fh : fw, lh = PARADO ? fw : fh;
  PX = Math.max(1, Math.floor(lh / 240));
  while (PX > 1 && Math.floor(lw / PX) < 440) PX--;
  const nw = Math.floor(lw / PX), nh = Math.floor(lh / PX);
  OFX = Math.floor((lw - nw * PX) / 2); OFY = Math.floor((lh - nh * PX) / 2);
  if (nw !== W || nh !== H || cvM.width !== nw) { W = nw; H = nh; cvM.width = W; cvM.height = H; }
  g.imageSmoothingEnabled = false; cxP.imageSmoothingEnabled = false;
  AR.w = 384; AR.h = Math.min(216, H - 46);
  AR.x1 = Math.round(W / 2 - AR.w / 2); AR.y1 = Math.round((H - AR.h) / 2) - 2;
  AR.x2 = AR.x1 + AR.w; AR.y2 = AR.y1 + AR.h; AR.cx = (AR.x1 + AR.x2) / 2; AR.cy = (AR.y1 + AR.y2) / 2;
}
new ResizeObserver(medir).observe(lienzo);
addEventListener("resize", medir);
medir();

function volcar() {
  cxP.setTransform(1, 0, 0, 1, 0, 0);
  cxP.fillStyle = "#292929"; cxP.fillRect(0, 0, lienzo.width, lienzo.height);
  if (PARADO) { cxP.setTransform(0, 1, -1, 0, lienzo.width, 0); }
  cxP.drawImage(cvM, 0, 0, W, H, OFX, OFY, W * PX, H * PX);
  cxP.setTransform(1, 0, 0, 1, 0, 0);
}
/** De la pantalla (px de CSS) a píxeles del juego, teniendo en cuenta si está rotado. */
function aJuego(clientX, clientY) {
  const r = lienzo.getBoundingClientRect();
  let x = (clientX - r.left) * DPR, y = (clientY - r.top) * DPR;
  if (PARADO) { const nx = y, ny = lienzo.width - x; x = nx; y = ny; }
  return { x: (x - OFX) / PX, y: (y - OFY) / PX };
}
function pedirCompleta() {
  const d = document.documentElement;
  try {
    if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: "hide" }).then(() => { try { screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} }).catch(() => {});
    else { try { screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} }
  } catch (e) { /* sin pantalla completa: se juega igual */ }
}
