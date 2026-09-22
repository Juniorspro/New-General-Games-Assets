// El dedo, el mouse y el teclado.
//
// LA MITAD IZQUIERDA ES EL JOYSTICK Y LA DERECHA LA CÁMARA. El joystick
// aparece donde apoyás el pulgar: un pulgar no mira, se apoya donde cae, y un
// círculo fijo que hay que ir a buscar es un joystick que falla la mitad de
// las veces. Empujado a fondo, corre: un botón de correr es un dedo más, y en
// un teléfono sostenido con dos manos no hay un dedo más.
//
// CADA DEDO TIENE SU TAREA, por su pointerId. Sin eso, girar la cámara
// mientras se camina suelta el joystick (el segundo dedo "le roba" el toque),
// y el síntoma es "a veces se para solo", que no se encuentra nunca.
export const ENTRADA = { x: 0, y: 0, fuerza: 0, correr: false };

export function armaControl(zona, acciones) {
  const joy = document.getElementById("joy"), bola = document.getElementById("joyBola");
  const RADIO = 58;
  let dedoJoy = null, dedoCam = null, cx = 0, cy = 0, ux = 0, uy = 0;
  const tec = {};

  const mover = (x, y) => {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > RADIO) { dx = dx / d * RADIO; dy = dy / d * RADIO; }
    bola.style.transform = `translate(${dx}px, ${dy}px)`;
    // LA FUERZA ES LA FRACCIÓN DEL RECORRIDO, NO LOS PIXELES: en una pantalla
    // más densa los mismos milímetros son más pixeles, y el caminante correría
    // distinto según el teléfono.
    ENTRADA.fuerza = Math.min(1, d / RADIO);
    if (d > 1) { ENTRADA.x = dx / d; ENTRADA.y = dy / d; }
  };
  const soltarJoy = () => {
    dedoJoy = null;
    ENTRADA.x = ENTRADA.y = ENTRADA.fuerza = 0;
    bola.style.transform = "translate(0,0)";
    joy.classList.remove("on");
  };

  zona.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const izquierda = e.clientX < innerWidth * 0.45 && e.pointerType !== "mouse";
    // setPointerCapture tira si el puntero ya no está activo: pasa con un dedo
    // que apoya y levanta en el mismo cuadro. Si tira ANTES de anotar el
    // toque, el toque se pierde entero.
    if (izquierda && dedoJoy === null) {
      dedoJoy = e.pointerId; cx = e.clientX; cy = e.clientY;
      joy.style.left = cx - 66 + "px"; joy.style.top = cy - 66 + "px";
      joy.classList.add("on");
      mover(cx, cy);
    } else if (dedoCam === null) {
      dedoCam = e.pointerId; ux = e.clientX; uy = e.clientY;
    }
    try { zona.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  zona.addEventListener("pointermove", (e) => {
    if (e.pointerId === dedoJoy) mover(e.clientX, e.clientY);
    else if (e.pointerId === dedoCam) {
      acciones.mirar(e.clientX - ux, e.clientY - uy);
      ux = e.clientX; uy = e.clientY;
    } else if (document.pointerLockElement === zona) {
      acciones.mirar(e.movementX * 0.8, e.movementY * 0.8);
    }
  });
  const fin = (e) => {
    if (e.pointerId === dedoJoy) soltarJoy();
    if (e.pointerId === dedoCam) dedoCam = null;
  };
  zona.addEventListener("pointerup", fin);
  zona.addEventListener("pointercancel", fin);
  // si la pestaña pierde el foco con una tecla apretada, el keyup no llega
  // nunca y el caminante se va solo para un lado
  addEventListener("blur", () => { for (const k in tec) tec[k] = false; deTeclas(); soltarJoy(); dedoCam = null; });

  addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "KeyE" || e.code === "Enter") acciones.accion();
    if (e.code === "KeyV") acciones.vhs();
    if (e.code === "Escape" || e.code === "KeyP") acciones.pausa();
    tec[e.code] = true; deTeclas();
  });
  addEventListener("keyup", (e) => { tec[e.code] = false; deTeclas(); });
  function deTeclas() {
    const x = (tec.KeyD || tec.ArrowRight ? 1 : 0) - (tec.KeyA || tec.ArrowLeft ? 1 : 0);
    const y = (tec.KeyS || tec.ArrowDown ? 1 : 0) - (tec.KeyW || tec.ArrowUp ? 1 : 0);
    ENTRADA.correr = !!(tec.ShiftLeft || tec.ShiftRight);
    if (dedoJoy !== null) return;
    if (!x && !y) { ENTRADA.x = ENTRADA.y = ENTRADA.fuerza = 0; return; }
    const d = Math.hypot(x, y);
    ENTRADA.x = x / d; ENTRADA.y = y / d; ENTRADA.fuerza = ENTRADA.correr ? 1 : 0.7;
  }

  // en la compu: clic y el mouse gira la cámara sin tener que arrastrar
  zona.addEventListener("click", (e) => {
    if (matchMedia("(pointer: fine)").matches && !e.target.closest("button")) zona.requestPointerLock?.();
  });

  document.getElementById("bAccion").addEventListener("pointerdown", (e) => { e.preventDefault(); acciones.accion(); });
  document.getElementById("bPausa").addEventListener("pointerdown", (e) => { e.preventDefault(); acciones.pausa(); });
  return { soltar: () => { soltarJoy(); dedoCam = null; } };
}
