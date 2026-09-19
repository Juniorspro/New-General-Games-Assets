// El dedo: un joystick y un boton de ladrar.
//
// EL JOYSTICK SE AGARRA DESDE CUALQUIER PUNTO DE LA MITAD IZQUIERDA, no solo
// desde el circulo dibujado. Un pulgar no mira: se apoya donde cae y espera que
// funcione. El circulo se MUEVE a donde se apoyo el dedo, que es lo que hace
// que no haya que buscarlo nunca.
//
// Y CADA DEDO TIENE SU TAREA: el `pointerId` del que maneja no es el del que
// ladra. Sin eso, ladrar mientras se corre suelta el joystick — y el sintoma
// es "a veces el perro se para solo", que no se encuentra nunca.
import { M } from "./mundo.js";

export const ENT = { x: 0, y: 0, fuerza: 0, ladra: false };

export function armaControl(cont, alLadrar) {
  const joy = cont.querySelector("#joy");
  const bola = cont.querySelector("#joyP");
  const bLadra = cont.querySelector("#bLadra");

  let dedoJoy = null, cx = 0, cy = 0;
  const RADIO = 56;                 // hasta donde llega la bola, en pixeles

  const centra = (x, y) => {
    cx = x; cy = y;
    joy.style.left = (x - 66) + "px";
    joy.style.top = (y - 66) + "px";
    joy.classList.add("on");
  };
  const mueve = (x, y) => {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > RADIO) { dx = dx / d * RADIO; dy = dy / d * RADIO; }
    bola.style.transform = `translate(${dx}px,${dy}px)`;
    // LA FUERZA ES LA FRACCION DEL RECORRIDO, NO LA DISTANCIA EN PIXELES: en
    // una pantalla mas densa los mismos milimetros son mas pixeles, y con
    // pixeles el perro correria distinto segun el telefono.
    ENT.fuerza = Math.min(1, d / RADIO);
    if (ENT.fuerza > 0.001) { ENT.x = dx / (RADIO * ENT.fuerza); ENT.y = dy / (RADIO * ENT.fuerza); }
  };
  const suelta = () => {
    dedoJoy = null;
    ENT.x = ENT.y = ENT.fuerza = 0;
    bola.style.transform = "translate(0,0)";
    joy.classList.remove("on");
  };

  cont.addEventListener("pointerdown", (ev) => {
    if (ev.target === bLadra || bLadra.contains(ev.target)) return;
    if (dedoJoy !== null) return;
    dedoJoy = ev.pointerId;
    // `setPointerCapture` puede tirar si el puntero ya se fue entre el evento y
    // esta linea. No es un caso raro en un telefono con el dedo al borde.
    try { cont.setPointerCapture(ev.pointerId); } catch (e) {}
    centra(ev.clientX, ev.clientY);
    mueve(ev.clientX, ev.clientY);
    ev.preventDefault();
  });
  cont.addEventListener("pointermove", (ev) => {
    if (ev.pointerId !== dedoJoy) return;
    mueve(ev.clientX, ev.clientY);
    ev.preventDefault();
  });
  for (const ev of ["pointerup", "pointercancel"])
    cont.addEventListener(ev, (e) => { if (e.pointerId === dedoJoy) suelta(); });

  /* --- ladrar --- */
  let ultimo = -9;
  const pide = (ev) => {
    if (ev) ev.preventDefault();
    const t = performance.now() / 1000;
    // LA ESPERA ENTRE LADRIDOS NO ES UN CAPRICHO: apretando rapido se apilan
    // diez ladridos encima y suena a lata, no a perro.
    if (t - ultimo < M.LADRA_ESPERA) return;
    ultimo = t;
    bLadra.classList.remove("pum"); void bLadra.offsetWidth; bLadra.classList.add("pum");
    alLadrar();
  };
  bLadra.addEventListener("pointerdown", pide);

  /* --- teclado, para probar en la compu --- */
  const tec = {};
  addEventListener("keydown", (e) => {
    if (e.code === "Space") { pide(e); return; }
    tec[e.code] = true; deTeclas();
  });
  addEventListener("keyup", (e) => { tec[e.code] = false; deTeclas(); });
  function deTeclas() {
    const x = (tec.KeyD || tec.ArrowRight ? 1 : 0) - (tec.KeyA || tec.ArrowLeft ? 1 : 0);
    const y = (tec.KeyS || tec.ArrowDown ? 1 : 0) - (tec.KeyW || tec.ArrowUp ? 1 : 0);
    if (!x && !y) { if (dedoJoy === null) { ENT.x = ENT.y = ENT.fuerza = 0; } return; }
    const d = Math.hypot(x, y);
    ENT.x = x / d; ENT.y = y / d;
    // Con teclas se corre apretando shift; sin eso no habria forma de caminar.
    ENT.fuerza = (tec.ShiftLeft || tec.ShiftRight) ? 1 : M.UMBRAL_CORRE * 0.8;
  }

  return { suelta };
}
