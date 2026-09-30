// ─────────────────────────────────────────────────────────────────────────────
// LA PANTALLA: todo (mundo, HUD y letras, que también son de píxeles) se dibuja chico, a ~180 px
// de ancho, y se agranda a escala ENTERA (guía 2D § 2). Vertical: en el teléfono parado ocupa todo;
// en una pantalla acostada queda una columna al centro con el fondo de la paleta.
// ─────────────────────────────────────────────────────────────────────────────

const lienzo = document.getElementById("lienzo");
const cxP = lienzo.getContext("2d", { alpha: false });
const cvM = document.createElement("canvas");
const g = cvM.getContext("2d");
let W = 180, H = 400, PX = 4, DPR = 1, OFX = 0;
const ANCHO_OBJ = 180;

function medir() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const fw = Math.round((lienzo.clientWidth || innerWidth) * DPR), fh = Math.round((lienzo.clientHeight || innerHeight) * DPR);
  if (lienzo.width !== fw || lienzo.height !== fh) { lienzo.width = fw; lienzo.height = fh; }
  const col = Math.min(fw, Math.round(fh * 0.6));
  PX = Math.max(2, Math.round(col / ANCHO_OBJ));
  const nw = Math.ceil(Math.min(fw, col * 1.02) / PX), nh = Math.ceil(fh / PX);
  OFX = Math.floor((fw - nw * PX) / 2);
  if (nw !== W || nh !== H || cvM.width !== nw) { W = nw; H = nh; cvM.width = W; cvM.height = H; }
  g.imageSmoothingEnabled = false; cxP.imageSmoothingEnabled = false;
}
new ResizeObserver(medir).observe(lienzo);
addEventListener("resize", medir);
medir();

function volcar() {
  if (OFX > 0) { cxP.fillStyle = C_FONDO; cxP.fillRect(0, 0, lienzo.width, lienzo.height); cxP.fillStyle = C_ACENTO; cxP.fillRect(OFX - 3, 0, 2, lienzo.height); cxP.fillRect(OFX + W * PX + 1, 0, 2, lienzo.height); }
  cxP.drawImage(cvM, 0, 0, W, H, OFX, 0, W * PX, H * PX);
}
function aJuego(clientX, clientY) {
  const r = lienzo.getBoundingClientRect();
  return { x: ((clientX - r.left) * DPR - OFX) / PX, y: ((clientY - r.top) * DPR) / PX };
}
function pedirCompleta() {
  const d = document.documentElement;
  try { if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: "hide" }).then(() => { try { screen.orientation.lock("portrait").catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {}
}
