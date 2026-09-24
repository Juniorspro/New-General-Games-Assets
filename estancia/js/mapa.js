// El mapa del campo: M (o el botón) lo abre. Se ve la estancia entera desde
// arriba, con el monte, el pasto, la zanja, el estero, el alambrado, los
// edificios y el pueblo; uno (la flecha), el zaino, los perros y la hacienda
// (las agusanadas en rojo). Tocando un lugar de la lista o del mapa se marca el
// destino: en el mundo aparece una columna de luz, arriba una brújula con la
// distancia, y en la esquina un minimapa que gira con uno.
"use strict";
(() => {
  const MP = (E.mapa = { abierto: false, destino: null });
  const $ = (id) => document.getElementById(id);
  // Lo que abarca el mapa (m): la estancia y el pueblo, que queda al sur.
  const X0 = -420, X1 = 420, Z0 = -420, Z1 = 500, RES = 2.2;     // RES: metros por píxel del fondo
  let fondo = null, lienzo, g, mini, gm, zoom = 1, centro = { x: 0, z: 40 }, arrastre = null;

  // Los lugares a los que se puede ir.
  MP.lugares = () => {
    const L = E.lugares, K = E.comedero && E.comedero.caja, lista = [
      { id: "casco", nombre: "Casco de la estancia", corto: "Casco", x: L.rancho.x, z: L.rancho.z + 6, icono: "casa" },
      { id: "corral", nombre: "Corral y manga", corto: "Corral", x: L.corral.x - L.corral.r - 2.5, z: L.corral.z + 1, icono: "corral" },
      { id: "comedero", nombre: "Comedero (encierre)", corto: "Comedero", x: K ? (K.X0 + K.X1) / 2 : 37, z: K ? K.Z0 - 2 : 30, icono: "comedero" },
      { id: "aguada", nombre: "Aguada: tanque y molino", corto: "Aguada", x: L.tanque.x + L.tanque.r + 2, z: L.tanque.z, icono: "agua" },
      { id: "estero", nombre: "Estero (aguada natural)", corto: "Estero", x: L.estero.x + L.estero.r * 0.9, z: L.estero.z + L.estero.r * 0.5, icono: "agua" },
      { id: "fogon", nombre: "Fogón", corto: "Fogón", x: L.fogon.x, z: L.fogon.z + 1.5, icono: "fuego" },
      { id: "tranquera", nombre: "Tranquera de entrada", corto: "Tranquera", x: L.tranquera.x, z: L.tranquera.z - 3, icono: "tranquera" },
      { id: "pueblo", nombre: L.pueblo.nombre + " (el pueblo)", corto: "Pueblo", x: L.pueblo.x - 4, z: L.pueblo.z - 6, icono: "pueblo" },
    ];
    const c = E.animales.caballo;
    if (c && !c.montado) lista.push({ id: "caballo", nombre: "El zaino", corto: "Zaino", x: c.x, z: c.z, icono: "caballo", vivo: true });
    for (const v of E.animales.vacas) if (v.salud.bichera && !v.salud.muerta) lista.push({ id: "vaca" + v.num, nombre: `La ${v.num} (con bichera)`, corto: `La ${v.num}`, x: v.x, z: v.z, icono: "vaca", vivo: v });
    return lista;
  };

  // ── el fondo: el terreno visto desde arriba, una vez ──
  function armarFondo() {
    const T = E.terreno, w = Math.round((X1 - X0) / RES), h = Math.round((Z1 - Z0) / RES);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const cx = c.getContext("2d"), img = cx.createImageData(w, h), d = img.data;
    const tierra = [168, 88, 52], pasto = [190, 168, 102], monte = [70, 84, 46], agua = [72, 108, 128], afuera = [150, 120, 80];
    const lim = E.lugares.limite;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = X0 + (i + 0.5) * RES, z = Z0 + (j + 0.5) * RES;
      const m = T.monte(x, z), p = T.pasto(x, z, m), a = T.agua(x, z);
      // Sombreado del relieve: la luz del noroeste.
      const hs = (T.altura(x - 1.5, z - 1.5) - T.altura(x + 1.5, z + 1.5)) * 0.9;
      let r = tierra[0], gg = tierra[1], b = tierra[2];
      r += (pasto[0] - r) * p; gg += (pasto[1] - gg) * p; b += (pasto[2] - b) * p;
      r += (monte[0] - r) * m; gg += (monte[1] - gg) * m; b += (monte[2] - b) * m;
      if (a > 0.02) { const k = Math.min(1, a * 3 + 0.4); r += (agua[0] - r) * k; gg += (agua[1] - gg) * k; b += (agua[2] - b) * k; }
      if (T.distCamino(x, z) < 2.5) { r = 214; gg = 170; b = 122; }
      if (Math.abs(x) > lim || Math.abs(z) > lim) { r = r * 0.8 + afuera[0] * 0.2; gg = gg * 0.8 + afuera[1] * 0.2; b = b * 0.8 + afuera[2] * 0.2; }
      const k = 1 + E.clamp(hs, -0.25, 0.25);
      const o = (j * w + i) * 4;
      d[o] = r * k; d[o + 1] = gg * k; d[o + 2] = b * k; d[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    // El alambrado, los edificios y los corrales encima.
    const aPx = (x, z) => [(x - X0) / RES, (z - Z0) / RES];
    cx.strokeStyle = "rgba(40,30,20,0.8)"; cx.lineWidth = 1.5; cx.setLineDash([4, 3]);
    const [a0, b0] = aPx(-lim, -lim), [a1, b1] = aPx(lim, lim); cx.strokeRect(a0, b0, a1 - a0, b1 - b0); cx.setLineDash([]);
    const L = E.lugares;
    cx.fillStyle = "#e9e0cc"; cx.strokeStyle = "#3a2a1d"; cx.lineWidth = 1;
    const rect = (x, z, w2, d2) => { const [p, q] = aPx(x - w2 / 2, z - d2 / 2); cx.fillRect(p, q, w2 / RES, d2 / RES); cx.strokeRect(p, q, w2 / RES, d2 / RES); };
    rect(L.rancho.x, L.rancho.z, 8, 5);
    for (const e of (E.estancia.pueblo || { edificios: [] }).edificios) rect(e.x, e.z, e.w, e.d);
    const [ccx, ccz] = aPx(L.corral.x, L.corral.z); cx.beginPath(); cx.arc(ccx, ccz, L.corral.r / RES, 0, Math.PI * 2); cx.stroke();
    const [tqx, tqz] = aPx(L.tanque.x, L.tanque.z); cx.fillStyle = "#9cc3d6"; cx.beginPath(); cx.arc(tqx, tqz, L.tanque.r / RES, 0, Math.PI * 2); cx.fill(); cx.stroke();
    if (E.comedero && E.comedero.caja) { const K = E.comedero.caja, [p, q] = aPx(K.X0, K.Z0); cx.strokeRect(p, q, (K.X1 - K.X0) / RES, (K.Z1 - K.Z0) / RES); cx.fillStyle = "#b9b4aa"; cx.fillRect(p, q - 1.2 / RES - 1, (K.X1 - K.X0) / RES, 2); }
    fondo = c;
  }

  // ── dibujar ──
  const ICONOS = { casa: "⌂", corral: "◯", comedero: "▭", agua: "≈", fuego: "✶", tranquera: "╫", pueblo: "✚", caballo: "♞", vaca: "!" };
  function aPantalla(x, z, W, H) {
    const esc = zoom * Math.min(W / (X1 - X0), H / (Z1 - Z0));
    return [W / 2 + (x - centro.x) * esc, H / 2 + (z - centro.z) * esc, esc];
  }
  function aMundo(px, pz, W, H) {
    const esc = zoom * Math.min(W / (X1 - X0), H / (Z1 - Z0));
    return [centro.x + (px - W / 2) / esc, centro.z + (pz - H / 2) / esc];
  }
  function dibujarMapa() {
    if (!MP.abierto) return;
    const W = lienzo.width, H = lienzo.height, dpr = W / lienzo.clientWidth;
    g.fillStyle = "#1a130e"; g.fillRect(0, 0, W, H);
    const [ax, az, esc] = aPantalla(X0, Z0, W, H);
    g.imageSmoothingEnabled = true;
    g.drawImage(fondo, ax, az, (X1 - X0) * esc, (Z1 - Z0) * esc);
    // El rodeo grande, en puntitos.
    g.fillStyle = "rgba(70,45,30,0.7)";
    for (const a of E.rodeo.lista) { const [x, z] = aPantalla(a.x, a.z, W, H); g.fillRect(x - 0.8 * dpr, z - 0.8 * dpr, (a.k === "ternero" ? 1.2 : 1.8) * dpr, (a.k === "ternero" ? 1.2 : 1.8) * dpr); }
    // La hacienda de trabajo.
    for (const v of E.animales.vacas) {
      if (v.salud.muerta) continue;
      const [x, z] = aPantalla(v.x, v.z, W, H);
      g.fillStyle = v.salud.bichera ? "#ff4a3a" : v.toro ? "#222" : "rgba(60,35,25,0.85)";
      g.beginPath(); g.arc(x, z, (v.salud.bichera ? 3.5 : v.ternero ? 1.4 : 2.2) * dpr, 0, Math.PI * 2); g.fill();
    }
    for (const p of E.perros.lista) { const [x, z] = aPantalla(p.x, p.z, W, H); g.fillStyle = "#f0c23a"; g.fillRect(x - 1.5 * dpr, z - 1.5 * dpr, 3 * dpr, 3 * dpr); }
    // Los lugares, con su nombre.
    g.textAlign = "center"; g.textBaseline = "top";
    for (const l of MP.lugares()) {
      const [x, z] = aPantalla(l.x, l.z, W, H), sel = MP.destino && MP.destino.id === l.id;
      g.fillStyle = sel ? "#d8743f" : "rgba(21,16,12,0.85)";
      g.beginPath(); g.arc(x, z, 11 * dpr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#efe6d4"; g.lineWidth = 1.5 * dpr; g.stroke();
      g.fillStyle = "#efe6d4"; g.font = `${13 * dpr}px "Barlow Condensed", sans-serif`; g.textBaseline = "middle";
      g.fillText(ICONOS[l.icono] || "•", x, z + 0.5 * dpr);
      g.textBaseline = "top"; g.font = `700 ${13 * dpr}px "Barlow Condensed", sans-serif`;
      g.lineWidth = 3 * dpr; g.strokeStyle = "rgba(0,0,0,0.75)"; g.strokeText(l.corto, x, z + 13 * dpr); g.fillText(l.corto, x, z + 13 * dpr);
    }
    // Uno: la flecha hacia donde mira.
    const J = E.jugador, [jx, jz] = aPantalla(J.x, J.z, W, H), f = new THREE.Vector3(); E.motor.camara.getWorldDirection(f);
    const ang = Math.atan2(f.x, f.z);
    g.save(); g.translate(jx, jz); g.rotate(-ang + Math.PI);
    g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(0, -10 * dpr); g.lineTo(7 * dpr, 8 * dpr); g.lineTo(0, 4 * dpr); g.lineTo(-7 * dpr, 8 * dpr); g.closePath(); g.stroke(); g.fill();
    g.restore();
    // La línea al destino.
    if (MP.destino) {
      const [dx, dz] = aPantalla(MP.destino.x, MP.destino.z, W, H);
      g.strokeStyle = "rgba(216,116,63,0.9)"; g.lineWidth = 2.5 * dpr; g.setLineDash([8 * dpr, 6 * dpr]);
      g.beginPath(); g.moveTo(jx, jz); g.lineTo(dx, dz); g.stroke(); g.setLineDash([]);
    }
    // La rosa de los vientos y la escala.
    g.fillStyle = "#efe6d4"; g.font = `700 ${16 * dpr}px Anton, sans-serif`; g.textAlign = "center";
    g.fillText("N", W - 34 * dpr, 16 * dpr);
    g.beginPath(); g.moveTo(W - 34 * dpr, 38 * dpr); g.lineTo(W - 40 * dpr, 54 * dpr); g.lineTo(W - 28 * dpr, 54 * dpr); g.closePath(); g.fill();
    const cien = 100 * esc;
    g.fillRect(20 * dpr, H - 26 * dpr, cien, 3 * dpr); g.textAlign = "left"; g.font = `${13 * dpr}px "Barlow Condensed", sans-serif`; g.fillText("100 m", 20 * dpr, H - 46 * dpr);
  }

  // ── el minimapa: 160 m alrededor, gira con uno ──
  function dibujarMini() {
    if (!gm || !fondo) return;
    const W = mini.width, R = W / 2, J = E.jugador, alcance = 90, esc = R / alcance;
    const f = new THREE.Vector3(); E.motor.camara.getWorldDirection(f);
    const ang = Math.atan2(f.x, f.z);
    gm.save();
    gm.clearRect(0, 0, W, W);
    gm.beginPath(); gm.arc(R, R, R - 2, 0, Math.PI * 2); gm.clip();
    gm.translate(R, R); gm.rotate(ang - Math.PI);
    gm.drawImage(fondo, (X0 - J.x) * esc, (Z0 - J.z) * esc, (X1 - X0) * esc, (Z1 - Z0) * esc);
    gm.fillStyle = "rgba(70,45,30,0.75)";
    for (const a of E.rodeo.lista) if (Math.abs(a.x - J.x) < alcance && Math.abs(a.z - J.z) < alcance) gm.fillRect((a.x - J.x) * esc - 1, (a.z - J.z) * esc - 1, 2, 2);
    for (const v of E.animales.vacas) {
      if (v.salud.muerta || Math.abs(v.x - J.x) > alcance || Math.abs(v.z - J.z) > alcance) continue;
      gm.fillStyle = v.salud.bichera ? "#ff4a3a" : "rgba(50,30,20,0.9)";
      gm.beginPath(); gm.arc((v.x - J.x) * esc, (v.z - J.z) * esc, v.salud.bichera ? 3 : 1.8, 0, Math.PI * 2); gm.fill();
    }
    if (MP.destino) {
      let dx = (MP.destino.x - J.x) * esc, dz = (MP.destino.z - J.z) * esc;
      const l = Math.hypot(dx, dz), tope = R - 9;
      if (l > tope) { dx *= tope / l; dz *= tope / l; }
      gm.fillStyle = "#d8743f"; gm.strokeStyle = "#fff"; gm.lineWidth = 2;
      gm.beginPath(); gm.arc(dx, dz, 6, 0, Math.PI * 2); gm.fill(); gm.stroke();
    }
    gm.restore();
    // Uno en el centro, siempre para arriba; y la N girando en el borde.
    gm.fillStyle = "#fff"; gm.strokeStyle = "#000"; gm.lineWidth = 1.5;
    gm.beginPath(); gm.moveTo(R, R - 8); gm.lineTo(R + 5.5, R + 6); gm.lineTo(R, R + 3); gm.lineTo(R - 5.5, R + 6); gm.closePath(); gm.stroke(); gm.fill();
    // El norte del mundo (0, -1) girado igual que el mapa.
    const th = ang - Math.PI;
    gm.font = "700 13px Anton, sans-serif"; gm.textAlign = "center"; gm.textBaseline = "middle"; gm.fillStyle = "#f0c23a";
    gm.fillText("N", R + (R - 11) * Math.sin(th), R - (R - 11) * Math.cos(th));
  }

  // ── el destino ── la columna de luz y la brújula de arriba.
  let columna, anillo;
  function armarColumna() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    columna = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 40, 16, 1, true).translate(0, 20, 0), mat);
    anillo = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32).rotateX(-Math.PI / 2), mat.clone());
    anillo.material.opacity = 0.8;
    columna.visible = anillo.visible = false;
    columna.renderOrder = anillo.renderOrder = 5;
    E.motor.escena.add(columna, anillo);
  }
  MP.ir = (lugar) => {
    MP.destino = lugar;
    if (!columna) armarColumna();
    columna.visible = anillo.visible = !!lugar;
    if (lugar) E.juego.mostrar(`Destino marcado: ${lugar.nombre}. Seguí la columna de luz.`);
    $("brujula").hidden = !lugar;
  };
  MP.buscar = (texto) => {
    const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!t) return null;
    return MP.lugares().find((l) => l.id.startsWith(t) || l.corto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").startsWith(t) || l.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t)) || null;
  };

  let proxMini = 0;
  MP.actualizar = (dt, t) => {
    if (!fondo) return;
    const J = E.jugador, d = MP.destino;
    if (d) {
      if (d.vivo) { const o = d.vivo === true ? E.animales.caballo : d.vivo; d.x = o.x; d.z = o.z; }
      const y = E.terreno.altura(d.x, d.z);
      columna.position.set(d.x, y, d.z); anillo.position.set(d.x, y + 0.08, d.z);
      columna.material.opacity = 0.25 + 0.1 * Math.sin(t * 3);
      anillo.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
      const dist = Math.hypot(d.x - J.x, d.z - J.z);
      // La brújula: la flecha hacia el destino, relativa a donde mira uno.
      const f = new THREE.Vector3(); E.motor.camara.getWorldDirection(f);
      const a = Math.atan2(d.x - J.x, d.z - J.z) - Math.atan2(f.x, f.z);
      $("brujulaFlecha").style.transform = `rotate(${-a}rad)`;
      $("brujulaTexto").textContent = `${d.corto} · ${dist < 1000 ? Math.round(dist) + " m" : (dist / 1000).toFixed(1) + " km"}`;
      if (dist < (d.vivo ? 4 : 7)) { E.juego.mostrar(`Llegaste: ${d.nombre}.`); MP.ir(null); }
    }
    // El minimapa, a 15 cuadros por segundo: no hace falta más.
    proxMini -= dt;
    if (proxMini <= 0 && E.juego.corriendo) { proxMini = 1 / 15; dibujarMini(); }
    dibujarMapa();
  };

  // ── la interfaz ──
  MP.conectar = () => {
    lienzo = $("mapaLienzo"); g = lienzo.getContext("2d");
    mini = $("minimapa"); gm = mini.getContext("2d");
    const ajustar = () => { const r = lienzo.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); lienzo.width = Math.max(1, r.width * dpr); lienzo.height = Math.max(1, r.height * dpr); };
    addEventListener("resize", () => MP.abierto && ajustar());
    $("mapaCerrar").onclick = () => MP.cerrar();
    $("mapaMas").onclick = () => { zoom = Math.min(8, zoom * 1.6); };
    $("mapaMenos").onclick = () => { zoom = Math.max(1, zoom / 1.6); if (zoom === 1) centro = { x: 0, z: 40 }; };
    $("mapaYo").onclick = () => { centro = { x: E.jugador.x, z: E.jugador.z }; zoom = Math.max(zoom, 4); };
    $("mapaSacar").onclick = () => MP.ir(null);
    lienzo.addEventListener("wheel", (ev) => { ev.preventDefault(); zoom = E.clamp(zoom * (ev.deltaY < 0 ? 1.2 : 1 / 1.2), 1, 8); }, { passive: false });
    lienzo.addEventListener("pointerdown", (ev) => { arrastre = { x: ev.clientX, y: ev.clientY, cx: centro.x, cz: centro.z, movio: false }; lienzo.setPointerCapture(ev.pointerId); });
    lienzo.addEventListener("pointermove", (ev) => {
      if (!arrastre) return;
      const dpr = lienzo.width / lienzo.clientWidth, esc = zoom * Math.min(lienzo.width / (X1 - X0), lienzo.height / (Z1 - Z0)) / dpr;
      const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y;
      if (Math.hypot(dx, dy) > 4) arrastre.movio = true;
      centro = { x: arrastre.cx - dx / esc, z: arrastre.cz - dy / esc };
    });
    lienzo.addEventListener("pointerup", (ev) => {
      const a = arrastre; arrastre = null;
      if (!a || a.movio) return;
      // Un toque: el lugar más cercano (si está cerca), si no, un punto suelto.
      const r = lienzo.getBoundingClientRect(), dpr = lienzo.width / r.width;
      const [x, z] = aMundo((ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr, lienzo.width, lienzo.height);
      const esc = zoom * Math.min(lienzo.width / (X1 - X0), lienzo.height / (Z1 - Z0)) / dpr;
      let mejor = null, dmin = 22 / esc;
      for (const l of MP.lugares()) { const d = Math.hypot(l.x - x, l.z - z); if (d < dmin) { dmin = d; mejor = l; } }
      MP.ir(mejor || { id: "punto", nombre: "el punto marcado", corto: "Punto", x, z });
      pintarLista();
    });
    MP._ajustar = ajustar;
    addEventListener("keydown", (ev) => {
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      if (ev.code === "KeyM" && !ev.repeat && E.juego.corriendo) { if (MP.abierto) MP.cerrar(); else if (!E.juego.enMenu()) MP.abrir(); }
      if (ev.code === "Escape" && MP.abierto) MP.cerrar();
    });
    mini.addEventListener("click", () => MP.abrir());
  };
  function pintarLista() {
    const ul = $("mapaLista"); ul.innerHTML = "";
    const J = E.jugador;
    for (const l of MP.lugares()) {
      const li = document.createElement("li"), d = Math.hypot(l.x - J.x, l.z - J.z);
      li.className = MP.destino && MP.destino.id === l.id ? "elegido" : "";
      li.innerHTML = `<b>${ICONOS[l.icono] || "•"}</b><span>${l.nombre}</span><small>${d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(1) + " km"} · ${E.trabajo.rumbo(l.x, l.z)}</small>`;
      li.onclick = () => { MP.ir(l); pintarLista(); };
      ul.appendChild(li);
    }
  }
  MP.abrir = () => {
    if (!fondo) armarFondo();
    MP.abierto = true;
    $("mapa").hidden = false;
    E.juego.soltarPuntero();
    MP._ajustar();
    pintarLista();
  };
  MP.cerrar = () => {
    MP.abierto = false;
    $("mapa").hidden = true;
    if (!E.entrada.tactil && E.juego.corriendo && !E.juego.enMenu()) { try { $("lienzo").requestPointerLock(); } catch (e) { /* no importa */ } }
  };
  MP.preparar = () => { armarFondo(); if (!columna) armarColumna(); };
})();
