// Núcleo: el espacio de nombres, el azar con semilla, el ruido y la entrada.
// Todo lo que ocupa lugar en el mundo sale de acá con semilla fija: con
// Math.random el algarrobo que ayer estaba al lado del tanque hoy estaría
// adentro del corral (GUIA-JUEGOS.md § 6.6).
"use strict";
const E = (window.E = {});

E.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
E.lerp = (a, b, t) => a + (b - a) * t;
E.suave = (a, b, v) => { const t = E.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
E.angulo = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// mulberry32. Con Math.imul y no con "*": los números de JavaScript
// redondean los bits bajos y el azar sale con patrones sin avisar.
E.azar = (semilla) => {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

E.hash2 = (i, j) => {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

E.ruido = (x, y) => {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = E.hash2(i, j), b = E.hash2(i + 1, j), c = E.hash2(i, j + 1), d = E.hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

E.fbm = (x, y, oct = 4) => {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += amp * E.ruido(x * f + o * 17.3, y * f - o * 9.1); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
};

// Texturas: primero las embebidas (ARCHIVOS), si no, la ruta relativa. El
// TextureLoader usa <img> y no fetch, así que anda con data: y desde file://.
E.textura = (nombre, { srgb = true, repetir = true } = {}) => {
  const t = new THREE.TextureLoader().load((window.ARCHIVOS && ARCHIVOS[nombre]) || "datos/" + nombre);
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
};

// Un lienzo como textura, para lo que se dibuja con código (hojas, pasto,
// huellas, la herida). Más nítido que una foto y no cuesta ni un crédito.
E.lienzo = (w, h, dibujar, { srgb = true, repetir = false } = {}) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  dibujar(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
};

// Juntar geometrías (posición, normal, uv, color) en una sola: un árbol entero
// es una sola llamada de dibujo por instancia.
E.juntar = (geos) => {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, ov * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, ov * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, ov * 3); else col.fill(1, ov * 3, (ov + n) * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov;
    else for (let i = 0; i < n; i++) idx[oi + i] = i + ov;
    oi += g.index ? g.index.count : n;
    ov += n;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  r.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  r.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  r.setAttribute("color", new THREE.BufferAttribute(col, 3));
  r.setIndex(new THREE.BufferAttribute(idx, 1));
  r.computeBoundingSphere();
  return r;
};

// Pinta toda una geometría de un color (atributo color), para E.juntar.
E.pintar = (g, r, v, b) => {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = v; c[i * 3 + 2] = b; }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
};

// Parchear un material sin pisar parches previos, con su clave de programa:
// onBeforeCompile es uno por material, y three reutiliza programas entre
// materiales con el mismo texto (GUIA-JUEGOS.md § 6.3).
E.parchear = (mat, clave, fn) => {
  const previo = mat.onBeforeCompile, clavePrevia = mat.customProgramCacheKey.call(mat);
  mat.onBeforeCompile = (sh, r) => { previo.call(mat, sh, r); fn(sh, r); };
  mat.customProgramCacheKey = () => clavePrevia + "|" + clave;
  mat.needsUpdate = true;
  return mat;
};

// ── la entrada ────────────────────────────────────────────────────────────
// Teclado, mouse con puntero bloqueado, y táctil: joystick donde cae el
// pulgar en la mitad izquierda, mirar con la derecha, cada dedo por su
// pointerId (si no, girar mientras se camina suelta el joystick).
E.entrada = (() => {
  const teclas = new Set(), recien = new Set();
  const e = {
    raton: { dx: 0, dy: 0, izq: false, der: false, izqRecien: false, izqSuelto: false, derRecien: false },
    palanca: { x: 0, y: 0, activa: false },
    botones: new Set(), botonesRecien: new Set(),
    tactil: false,
    tecla: (c) => teclas.has(c),
    pulsado: (c) => recien.has(c),
    boton: (n) => e.botones.has(n),
    botonPulsado: (n) => e.botonesRecien.has(n),
    finCuadro() {
      recien.clear(); e.botonesRecien.clear();
      e.raton.dx = e.raton.dy = 0;
      e.raton.izqRecien = e.raton.izqSuelto = e.raton.derRecien = false;
    },
    soltarTodo() { teclas.clear(); e.raton.izq = e.raton.der = false; e.botones.clear(); e.palanca.x = e.palanca.y = 0; e.palanca.activa = false; },
  };
  // Escribiendo en el chat (o en cualquier campo), las teclas no son del juego:
  // si no, escribir "hola" caminaba y la "e" montaba el caballo.
  const escribiendo = () => { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
  addEventListener("keydown", (ev) => {
    if (ev.repeat || escribiendo()) return;
    teclas.add(ev.code); recien.add(ev.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(ev.code)) ev.preventDefault();
  });
  addEventListener("keyup", (ev) => teclas.delete(ev.code));
  // Si la pestaña pierde el foco con una tecla apretada, el keyup no llega.
  addEventListener("blur", () => e.soltarTodo());
  return e;
})();

E.conectarEntrada = (lienzo) => {
  const en = E.entrada;
  lienzo.addEventListener("mousedown", (ev) => {
    if (en.tactil) return;
    if (document.pointerLockElement !== lienzo && E.juego && E.juego.corriendo && !E.juego.enMenu()) {
      try { lienzo.requestPointerLock(); } catch (e) { /* no importa */ }
    }
    if (ev.button === 0) { en.raton.izq = true; en.raton.izqRecien = true; }
    if (ev.button === 2) { en.raton.der = true; en.raton.derRecien = true; }
  });
  addEventListener("mouseup", (ev) => {
    if (ev.button === 0 && en.raton.izq) { en.raton.izq = false; en.raton.izqSuelto = true; }
    if (ev.button === 2) en.raton.der = false;
  });
  lienzo.addEventListener("contextmenu", (ev) => ev.preventDefault());
  addEventListener("mousemove", (ev) => {
    if (document.pointerLockElement === lienzo) { en.raton.dx += ev.movementX; en.raton.dy += ev.movementY; }
  });

  // Táctil
  const dedos = new Map();
  const palanca = document.getElementById("palanca"), perilla = palanca && palanca.firstElementChild;
  lienzo.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType !== "touch") return;
    en.tactil = true;
    document.body.classList.add("tactil");
    const izquierda = ev.clientX < innerWidth * 0.45;
    dedos.set(ev.pointerId, { x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, tipo: izquierda ? "palanca" : "mirar" });
    try { lienzo.setPointerCapture(ev.pointerId); } catch (e) { /* ya se fue */ }
    if (izquierda && palanca) {
      palanca.style.left = ev.clientX - 60 + "px"; palanca.style.top = ev.clientY - 60 + "px"; palanca.hidden = false;
      en.palanca.activa = true;
    }
  });
  lienzo.addEventListener("pointermove", (ev) => {
    const d = dedos.get(ev.pointerId);
    if (!d) return;
    if (d.tipo === "mirar") { en.raton.dx += (ev.clientX - d.x) * 1.6; en.raton.dy += (ev.clientY - d.y) * 1.6; }
    d.x = ev.clientX; d.y = ev.clientY;
    if (d.tipo === "palanca") {
      let vx = (d.x - d.x0) / 55, vy = (d.y - d.y0) / 55;
      const l = Math.hypot(vx, vy);
      if (l > 1) { vx /= l; vy /= l; }
      en.palanca.x = vx; en.palanca.y = vy;
      if (perilla) perilla.style.transform = `translate(${vx * 40}px, ${vy * 40}px)`;
    }
  });
  const fin = (ev) => {
    const d = dedos.get(ev.pointerId);
    if (!d) return;
    dedos.delete(ev.pointerId);
    if (d.tipo === "palanca") {
      en.palanca.x = en.palanca.y = 0; en.palanca.activa = false;
      if (palanca) palanca.hidden = true;
      if (perilla) perilla.style.transform = "";
    }
  };
  lienzo.addEventListener("pointerup", fin);
  lienzo.addEventListener("pointercancel", fin);

  // Botones táctiles: data-boton="accion" etc. Se mantienen apretados.
  document.querySelectorAll("[data-boton]").forEach((b) => {
    const n = b.dataset.boton;
    b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); en.botones.add(n); en.botonesRecien.add(n); b.classList.add("apretado"); });
    const soltar = () => { en.botones.delete(n); b.classList.remove("apretado"); };
    b.addEventListener("pointerup", soltar);
    b.addEventListener("pointercancel", soltar);
    b.addEventListener("pointerleave", soltar);
  });
};
