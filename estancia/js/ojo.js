// El ojo de águila: enlazar se hace fácil, como el Dead Eye.
//
// Revoleando, con una vaca a tiro adelante (de 3,5 a 18 m), el tiempo se
// pone lento, el mundo se destiñe a sepia gris salvo alrededor del blanco, y
// una mira se clava en la cabeza de la vaca y se va cerrando. Con la mira
// cerrada, al soltar, la armada va guiada y cae sobre la cabeza sí o sí, y la
// cámara gira 90° para verla volar de costado, en cámara lenta, hasta que
// agarra. Sin mira cerrada, el tiro es el de siempre (la física manda).
"use strict";
(() => {
  const O = (E.ojo = { activo: 0, escala: 1, blanco: null, bloqueo: 0, cine: null, foco: new THREE.Vector3(0.5, 0.5, 0.2) });
  const V = THREE.Vector3;
  const LENTO = 0.3, LENTO_CINE = 0.35, CERRAR = 0.55;
  let mira, texto, avisoFijo = false, latido = 0;

  O.conectar = () => {
    mira = document.getElementById("ojoMira");
    texto = document.getElementById("ojoTexto");
  };

  // Las que se pueden enlazar: paradas o andando, no caídas ni ya enlazadas.
  const valida = (v) => !v.salud.muerta && !["tumbada", "levanta", "cepo", "manga", "enlazada"].includes(v.estado);
  const pos = new V(), ndc = new V();
  function buscar() {
    const J = E.jugador, cam = E.motor.camara, A = E.animales;
    let mejor = null, puntaje = Infinity;
    for (const v of A.vacas) {
      if (!valida(v)) continue;
      const d = Math.hypot(v.x - J.x, v.z - J.z);
      if (d < 3.5 || d > 18) continue;
      A.cabeza(v, pos);
      ndc.copy(pos).project(cam);
      if (ndc.z > 1 || Math.abs(ndc.x) > 0.6 || Math.abs(ndc.y) > 0.7) continue;
      // Lo más cerca del centro de la mira; la que ya está elegida tiene ventaja
      // (si no, con dos vacas parejas la mira salta de una a otra).
      const p = Math.hypot(ndc.x, ndc.y) + d * 0.01 - (v === O.blanco ? 0.2 : 0);
      if (p < puntaje) { puntaje = p; mejor = v; }
    }
    return mejor;
  }

  // Cada cuadro, con el dt de verdad (no el lento).
  O.actualizar = (dt) => {
    const Z = E.lazo;
    // Se puede apagar en Opciones, para el que quiere embocar a pulso.
    const revolea = Z && Z.estado === "revoleando" && Z.revoleo > 0.35 && (!E.opciones || E.opciones.ojo);
    const b = revolea ? buscar() : null;
    if (b !== O.blanco) { O.blanco = b; O.bloqueo = 0; avisoFijo = false; }
    if (b) {
      const antes = O.bloqueo;
      O.bloqueo = Math.min(1, O.bloqueo + dt / CERRAR);
      if (antes < 1 && O.bloqueo >= 1) {
        E.sonido && E.sonido.clic && E.sonido.clic();
        if (!avisoFijo && Math.random() < 0.5) E.juego.decir("apuntar");
        avisoFijo = true;
      }
    }
    const quiere = b || O.cine ? 1 : 0;
    O.activo += (quiere - O.activo) * Math.min(1, dt * (quiere ? 7 : 4));
    O.escala = O.cine ? LENTO_CINE : 1 - (1 - LENTO) * O.activo;
    // El latido, mientras se apunta.
    latido -= dt;
    if (O.activo > 0.5 && latido <= 0) { latido = 0.85; E.sonido && E.sonido.latido && E.sonido.latido(); }
    E.sonido && E.sonido.lento && E.sonido.lento(O.activo);
    if (O.cine) actualizarCine(dt);
    document.body.classList.toggle("ojo", O.activo > 0.3);
    document.body.classList.toggle("cine", !!O.cine);
    dibujarMira();
  };

  function dibujarMira() {
    if (!mira) return;
    const v = O.blanco && !O.cine ? O.blanco : null;
    if (!v || O.activo < 0.05) {
      mira.classList.remove("visible"); texto.classList.remove("visible");
      // En la toma de costado, el foco sigue a la vaca (si no, queda pintado donde estaba la mira).
      if (O.cine) {
        E.animales.cabeza(O.cine.v, pos);
        ndc.copy(pos).project(E.motor.camara);
        O.foco.set((ndc.x + 1) / 2, (ndc.y + 1) / 2, 0.2);
      } else O.foco.z = 0.2;
      return;
    }
    E.animales.cabeza(v, pos);
    pos.y -= 0.1;
    ndc.copy(pos).project(E.motor.camara);
    const x = (ndc.x + 1) / 2, y = (1 - ndc.y) / 2;
    mira.style.left = x * 100 + "%"; mira.style.top = y * 100 + "%";
    // La mira se cierra de 150 a 56 px mientras se fija.
    const tam = 150 - 94 * O.bloqueo;
    mira.style.width = mira.style.height = tam + "px";
    mira.classList.add("visible");
    mira.classList.toggle("fija", O.bloqueo >= 1);
    texto.textContent = O.bloqueo >= 1 ? "Soltá para tirar" : "Fijando…";
    texto.classList.add("visible");
    O.foco.set(x, 1 - y, 0.16 + 0.08 * (1 - O.bloqueo));
  }

  // ¿El tiro va guiado? Solo con la mira cerrada.
  O.guiado = () => (O.blanco && O.bloqueo >= 1 && valida(O.blanco) ? O.blanco : null);

  // ── la cámara que gira 90° ──
  O.empezarCine = (v) => { O.cine = { v, t: 0, fin: null }; };
  O.terminarCine = () => { if (O.cine && O.cine.fin === null) O.cine.fin = O.cine.t; };
  function actualizarCine(dt) {
    const c = O.cine;
    c.t += dt;
    const Z = E.lazo;
    // Termina un rato después de que agarró o erró (o si se estira de más).
    if (c.fin === null && (Z.estado === "enganchado" || Z.estado === "errado" || Z.estado === "guardado" || c.t > 7)) c.fin = c.t + (Z.estado === "enganchado" ? 0.9 : 0.4);
    if (c.fin !== null && c.t > c.fin + 0.55) O.cine = null;
  }
  // La mezcla (0..1) y el ángulo del giro, para jugador.js.
  O.cuadroCine = () => {
    const c = O.cine;
    if (!c) return null;
    // Al salir, primero vuelve a girar a espaldas del gaucho y recién ahí se funde
    // con la cámara de siempre (fundir de costado la hacía atravesarlo).
    const entra = E.suave(0, 0.25, c.t), sale = c.fin === null ? 1 : 1 - E.suave(c.fin + 0.3, c.fin + 0.55, c.t);
    const vuelve = c.fin === null ? 0 : E.suave(c.fin, c.fin + 0.4, c.t);
    return { v: c.v, mezcla: entra * sale, ang: (Math.PI / 2) * E.suave(0.05, 0.75, c.t) * (1 - vuelve) };
  }
})();
