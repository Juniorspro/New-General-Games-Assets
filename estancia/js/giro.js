// El giro: con el teléfono parado, el juego se juega acostado igual. En vez de
// pedir pantalla completa y trabar la orientación (el iPhone no deja, y en
// Android sale un cartel que asusta y a veces no vuelve), se gira por CSS la
// caja que tiene el lienzo y toda la interfaz.
//
// Lo que el navegador NO gira solo son las coordenadas de los dedos: clientX y
// clientY siguen siendo de la pantalla. Los clics de los botones los resuelve
// él (sabe dónde quedó cada caja), pero toda cuenta propia con clientX/clientY
// o movementX/Y (la palanca, mirar arrastrando, los lienzos 2D, el mapa, tocar
// la vaca en la manga) tiene que pasar por acá.
//
// Va antes que todo lo demás: si se girara después de parsear los 13 MB de
// datos.js, la carga se vería de costado un buen rato.
"use strict";
(() => {
  const grueso = matchMedia("(pointer: coarse)");
  const G = (window.GIRO = {
    activo: false,
    // El tamaño lógico del juego (girado: el alto de la pantalla es el ancho).
    ancho: innerWidth, alto: innerHeight,
    // El ancho de pantalla con que se armó el giro: el mismo número que el
    // translateX, no el innerWidth de este momento (la barra del navegador lo
    // mueve y un píxel de diferencia corre todo lo que se toca).
    W: innerWidth,
    // Pantalla → juego. Con rotate(90deg) y el origen arriba a la izquierda, un
    // punto del juego (x, y) cae en la pantalla en (W − y, x).
    aLocal(x, y) { return G.activo ? { x: y, y: G.W - x } : { x, y }; },
    delta(dx, dy) { return G.activo ? { x: dy, y: -dx } : { x: dx, y: dy }; },
    // Un punto de la pantalla en coordenadas de un elemento de adentro, con su
    // tamaño sin girar. getBoundingClientRect da la caja ya girada: como el giro
    // es de 90°, sigue siendo un rectángulo y alcanza con cambiar los ejes.
    enElemento(x, y, el) {
      const r = el.getBoundingClientRect();
      if (!G.activo) return { x: x - r.left, y: y - r.top, w: r.width, h: r.height };
      const p = G.aLocal(x, y);
      return { x: p.x - r.top, y: p.y - (G.W - r.right), w: r.height, h: r.width };
    },
    acomodar,
  });

  // Escribiendo en el chat, el teclado del teléfono achica el alto de la
  // ventana: si se recalculara, la caja girada se aplastaba (o se desgiraba)
  // mientras uno escribe. Con un campo enfocado y el mismo ancho, no se toca.
  const escribiendo = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
  function acomodar() {
    const W = innerWidth, H = innerHeight;
    if (G.activo && W === G.W && escribiendo()) return;
    G.activo = grueso.matches && H > W;
    G.W = W;
    G.ancho = G.activo ? H : W;
    G.alto = G.activo ? W : H;
    document.documentElement.classList.toggle("girado", G.activo);
    const raiz = document.getElementById("raiz");
    if (!raiz) return;
    // En px y no con 100vh: la barra del navegador del teléfono cambia 100vh
    // y no avisa, y la caja girada quedaba corta o pasada.
    raiz.style.width = G.activo ? H + "px" : "";
    raiz.style.height = G.activo ? W + "px" : "";
    raiz.style.transform = G.activo ? `translateX(${W}px) rotate(90deg)` : "";
  }
  addEventListener("resize", acomodar);
  // En el iPhone, orientationchange llega antes de que cambien innerWidth e
  // innerHeight: se vuelve a medir un rato después.
  addEventListener("orientationchange", () => { acomodar(); setTimeout(acomodar, 300); });
  if (grueso.addEventListener) grueso.addEventListener("change", acomodar);
  acomodar();
})();
