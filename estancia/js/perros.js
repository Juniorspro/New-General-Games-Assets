// Los perros: Tigre, Negra y Chispa, que andan con el Guacho y le hacen caso.
//
// Órdenes (tecla, botón en el celular o el chat):
//   G  ¡Vengan!  — lo siguen, a los costados y atrás (a pie o a caballo).
//   X  ¡Quietos! — se echan donde están.
//   J  ¡Junten!  — se abren por detrás de la tropa y la arrean hacia uno.
//   B  ¡Busque!  — Tigre va a buscar la vaca que uno mira y la trae.
// La hacienda se aparta de un perro como de uno (animales.js, sentir): así
// arrean de verdad, empujando, y no con la vaca teletransportada.
"use strict";
(() => {
  const P = (E.perros = { lista: [], orden: "seguir", blanco: null });
  const V = THREE.Vector3;
  const PERROS = [
    { nombre: "Tigre", tinte: [1, 1, 1], escala: 1, tono: 1 },
    { nombre: "Negra", tinte: [0.3, 0.28, 0.27], escala: 0.93, tono: 1.12 },
    { nombre: "Chispa", tinte: [1.3, 1.12, 0.95], escala: 0.84, tono: 1.3 },
  ];
  P.ORDENES = {
    seguir: { texto: "¡Vengan!", voz: "perros", ayuda: "los perros te siguen" },
    quieto: { texto: "¡Quietos!", voz: "quietos", ayuda: "se echan donde están" },
    juntar: { texto: "¡Junten!", voz: "junten", ayuda: "arrean la tropa hacia vos" },
    traer: { texto: "¡Busque!", voz: "busquen", ayuda: "Tigre te trae la vaca que mirás" },
  };

  P.construir = () => {
    const M = E.modelos;
    if (!M || !M.hay("perro")) return;
    const J = E.jugador;
    PERROS.forEach((d, i) => {
      const piel = M.clonar("perro", { tinte: new THREE.Color(...d.tinte), sinClips: true });
      if (d.escala !== 1) { piel.piv.scale.multiplyScalar(d.escala); piel.escalaExtra = d.escala; piel.raiz.updateMatrixWorld(true); }
      E.motor.escena.add(piel.raiz);
      E.marcha.preparar(piel, "perro");
      P.lista.push({
        ...d, piel, i, x: J.x + 1.5 + i, z: J.z + 2.5, yaw: Math.PI, v: 0, vAnim: 0, px: null, pz: null,
        cabeza: 0, echar: 0, quieto: 0, proxLadrido: 3 + i * 2, mira: 0, num: 7 + i * 13, olfatea: 0,
      });
    });
  };

  // La vaca que uno está mirando (la más derecha en la mira, hasta 70 m).
  const adelante = new V();
  function vacaApuntada() {
    const J = E.jugador, A = E.animales;
    E.motor.camara.getWorldDirection(adelante); adelante.y = 0; adelante.normalize();
    let mejor = null, puntaje = -Infinity;
    for (const v of A.vacas) {
      if (v.salud.muerta || ["enlazada", "tumbada", "cepo", "manga"].includes(v.estado)) continue;
      const dx = v.x - J.x, dz = v.z - J.z, d = Math.hypot(dx, dz);
      if (d < 4 || d > 70) continue;
      const alin = (dx * adelante.x + dz * adelante.z) / d;
      if (alin < 0.85) continue;
      const p = alin * 3 - d / 70;
      if (p > puntaje) { puntaje = p; mejor = v; }
    }
    return mejor;
  }

  P.ordenar = (orden) => {
    if (!P.lista.length || !P.ORDENES[orden]) return false;
    const o = P.ORDENES[orden];
    if (orden === "traer") {
      P.blanco = vacaApuntada();
      if (!P.blanco) { E.juego.mostrar("No hay ninguna vaca adelante para ir a buscar. Mirá hacia una."); return false; }
    }
    P.orden = orden;
    P.inicioOrden = E.juego.t;
    E.juego.decir(o.voz);
    E.juego.mostrar(`${o.texto} — ${orden === "traer" ? `Tigre va a buscar la ${P.blanco.num}` : o.ayuda}.`);
    P.lista.forEach((d, k) => { d.proxLadrido = 0.5 + k * 0.3; d.quieto = 0; });
    return true;
  };
  const CICLO = ["seguir", "quieto", "juntar", "traer"];
  P.siguiente = () => P.ordenar(CICLO[(CICLO.indexOf(P.orden) + 1) % CICLO.length]);

  // ── cada cuadro ──
  const tmp = new V();
  P.actualizar = (dt, t, J) => {
    if (!P.lista.length) return;
    const A = E.animales, T = E.terreno;
    // El frente de uno: adonde mira la cámara (a caballo, adonde va el caballo).
    let fx, fz;
    if (J.montado) { const c = A.caballo; fx = Math.sin(c.yaw); fz = Math.cos(c.yaw); }
    else { E.motor.camara.getWorldDirection(tmp); tmp.y = 0; tmp.normalize(); fx = tmp.x; fz = tmp.z; }
    const px0 = J.montado ? A.caballo.x : J.x, pz0 = J.montado ? A.caballo.z : J.z;

    // ¿Terminó la orden?
    if (P.orden === "traer") {
      const v = P.blanco;
      if (!v || v.salud.muerta || ["enlazada", "tumbada", "cepo", "manga"].includes(v.estado)) P.orden = "seguir";
      else if (Math.hypot(v.x - px0, v.z - pz0) < 9) { E.juego.mostrar(`Tigre te trajo la ${v.num}.`); P.orden = "seguir"; }
    }
    // Juntar: cada perro se hace cargo de una de las más alejadas de uno y la
    // empuja para acá; al acercarse esa, toma la que sigue. (Abrirse en un
    // círculo detrás de la tropa no apretaba a nadie: la tropa está desparramada.)
    let asignadas = [];
    if (P.orden === "juntar") {
      const lejos = A.vacas.filter((v) => !v.salud.muerta && !v.ternero && !v.toro && !v.engorde && !["enlazada", "tumbada", "cepo", "manga", "corral", "come", "encierre"].includes(v.estado))
        .map((v) => [v, Math.hypot(v.x - px0, v.z - pz0)]).sort((a, b) => b[1] - a[1]);
      if (!lejos.length || lejos[0][1] < 22) { E.juego.mostrar("La hacienda está junta."); P.orden = "seguir"; }
      else if (t - (P.inicioOrden || 0) > 300) P.orden = "seguir";
      asignadas = lejos.slice(0, P.lista.length).map(([v]) => v);
    }

    for (const d of P.lista) {
      let tx = d.x, tz = d.z, vel = 0, echar = false;
      const orden = P.orden === "traer" && d.i !== 0 ? "seguir" : P.orden;
      if (orden === "quieto") echar = true;
      else if (orden === "traer") {
        // Por detrás de la vaca, del lado contrario a uno: la vaca se aparta
        // del perro y viene para acá.
        const v = P.blanco, hx = v.x - px0, hz = v.z - pz0, hl = Math.hypot(hx, hz) || 1;
        tx = v.x + (hx / hl) * 4 + Math.sin(t * 0.9) * 1.5 * (-hz / hl); tz = v.z + (hz / hl) * 4 + Math.sin(t * 0.9) * 1.5 * (hx / hl);
      } else if (orden === "juntar" && asignadas[d.i]) {
        const v = asignadas[d.i], hx = v.x - px0, hz = v.z - pz0, hl = Math.hypot(hx, hz) || 1;
        const lado = Math.sin(t * 0.8 + d.i * 2.1) * 2;
        tx = v.x + (hx / hl) * 3.5 - (hz / hl) * lado; tz = v.z + (hz / hl) * 3.5 + (hx / hl) * lado;
      } else {
        // Seguir: cada uno en su lugar, atrás y a los costados.
        const lado = (d.i - 1) * 1.1, r = J.montado ? 3.6 : 2.3;
        const ax = -fx * Math.cos(lado) - (-fz) * Math.sin(lado), az = -fz * Math.cos(lado) + (-fx) * Math.sin(lado);
        tx = px0 + ax * r; tz = pz0 + az * r;
      }
      const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz);
      if (!echar && dist > 0.7) {
        vel = Math.min(orden === "seguir" ? dist * 1.6 : 9, 10);
        if (orden === "seguir" && J.montado) vel = Math.min(10.5, Math.max(vel, A.caballo.vReal * 1.05));
        const giro = E.angulo(Math.atan2(dx, dz) - d.yaw);
        d.yaw += E.clamp(giro, -dt * 6, dt * 6);
        if (Math.abs(giro) > 1.6) vel *= 0.4;
      }
      d.v += (vel - d.v) * Math.min(1, dt * 4);
      d.x += Math.sin(d.yaw) * d.v * dt; d.z += Math.cos(d.yaw) * d.v * dt;
      // Choques: con la estancia, con los troncos y con la hacienda.
      const q = { x: d.x, z: d.z }; E.estancia.empujar(q, 0.3); d.x = q.x; d.z = q.z;
      for (const c of E.flora.cercanos(d.x, d.z)) {
        const ex = d.x - c.x, ez = d.z - c.z, el = Math.hypot(ex, ez), m = c.r + 0.35;
        if (el < m && el > 1e-3) { d.x = c.x + (ex / el) * m; d.z = c.z + (ez / el) * m; }
      }
      for (const v of A.vacas) {
        if (v.salud.muerta) continue;
        const ex = d.x - v.x, ez = d.z - v.z, el = Math.hypot(ex, ez), m = v.ternero ? 0.7 : 1.1;
        if (el < m && el > 1e-3) { d.x = v.x + (ex / el) * m; d.z = v.z + (ez / el) * m; }
      }
      // Quieto un rato, se echa; cada tanto olfatea el piso.
      d.quieto = d.v < 0.3 ? d.quieto + dt : 0;
      const echa = echar || d.quieto > 4;
      d.echar += ((echa ? 1 : 0) - d.echar) * Math.min(1, dt * (echa ? 1.5 : 4));
      d.olfatea -= dt;
      if (d.olfatea < -6 - d.i * 2) d.olfatea = 1.5 + Math.random() * 2;
      const cabezaObj = d.echar < 0.2 && d.olfatea > 0 && d.v < 2 ? 0.9 : 0;
      d.cabeza += (cabezaObj - d.cabeza) * Math.min(1, dt * 3);
      // Ladra al arrear (o apenas recibe la orden).
      d.proxLadrido -= dt;
      const arreando = orden === "juntar" || orden === "traer";
      if (d.proxLadrido <= 0) {
        d.proxLadrido = arreando ? 1.2 + Math.random() * 2.5 : 25 + Math.random() * 40;
        if (arreando || Math.random() < 0.3) { E.sonido.ladrido && E.sonido.ladrido(d.x, d.z, d.tono, arreando ? 2 : 1); d.ladra = 0.35; }
      }
      d.ladra = Math.max(0, d.ladra - dt);
      posar(d, dt, t, T);
    }
  };

  function posar(d, dt, t, T) {
    if (dt > 0 && d.px !== null) {
      const dx = d.x - d.px, dz = d.z - d.pz;
      const vf = E.clamp((dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw)) / dt, -4, 14);
      d.vAnim += (vf - d.vAnim) * Math.min(1, dt * 8);
    }
    d.px = d.x; d.pz = d.z;
    const p = d.piel;
    p.raiz.position.set(d.x, T.altura(d.x, d.z) - Math.min(0.4, T.agua(d.x, d.z) * 0.3), d.z);
    p.raiz.rotation.set(0, d.yaw, 0);
    // La cola: menea contento cerca de uno y parado; al correr, más tranquila.
    const contento = d.v < 1.5 ? 3.2 : 1.4;
    E.marcha.animar(p, {
      v: d.vAnim, cabeza: d.cabeza, echar: d.echar, mira: Math.sin(t * 0.6 + d.num) * 0.4 * (1 - d.cabeza) + (d.ladra > 0 ? Math.sin(t * 40) * 0.05 : 0),
      moscas: contento, t, num: d.num, tiron: d.ladra > 0 ? 0.4 : 0,
    }, dt);
  }

  P.visibles = (si) => { for (const d of P.lista) d.piel.raiz.visible = si; };
})();
