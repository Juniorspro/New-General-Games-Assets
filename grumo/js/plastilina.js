// El kit de plastilina: lo que hace que todo parezca modelado a mano y
// fotografiado cuadro a cuadro.
//   - Formas orgánicas: el contorno de un grupo de celdas se saca entero
//     (no celda por celda), se redondean las esquinas y se le da un
//     temblequeo suave, como algo apretado con los dedos. Donde una pieza
//     toca otra (o la pared del set) el borde va recto y la esquina en
//     escuadra: así un bloque que se va a caer queda pegado al piso con una
//     unión como cualquier otra, sin avisar.
//   - Relieve de almohadón: luz adentro arriba a la izquierda, sombra adentro
//     abajo a la derecha, un brillo de plastilina y huellas digitales.
//   - El "hervor" del stop motion: cada pieza tiene 2 versiones con el
//     temblequeo distinto; se turnan con los cuadros.
//   - La foto: grano que cambia en cada cuadro, luz que titila apenas y viñeta.
// Lo caro se arma una vez y se guarda: por cuadro solo hay drawImage.
import { azar, hash, tono, rgba, clamp, suave } from './util.js';

const cache = new Map();
export function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
export function guardado(clave, fn) { if (!cache.has(clave)) cache.set(clave, fn()); return cache.get(clave); }
export function olvidar(prefijo) { for (const k of [...cache.keys()]) if (k.startsWith(prefijo)) cache.delete(k); }

// ── contornos de celdas ─────────────────────────────────────────────────────
// Los bordes entre celda llena y vacía, encadenados en vueltas cerradas (con
// lo lleno a la derecha al recorrerlas en pantalla, y para abajo). Cada
// vuelta es la lista de TODAS las esquinas de celda por donde pasa (lados de
// una celda): así se puede decidir lado por lado si va pegado a otra pieza.
export function contornos(lleno, cols, filas) {
  const L = (c, f) => c >= 0 && f >= 0 && c < cols && f < filas && lleno(c, f);
  const aristas = new Map();
  const poner = (x1, y1, x2, y2) => { const k = x1 + ',' + y1; if (!aristas.has(k)) aristas.set(k, []); aristas.get(k).push([x2, y2]); };
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    if (!L(c, f)) continue;
    if (!L(c, f - 1)) poner(c, f, c + 1, f);
    if (!L(c + 1, f)) poner(c + 1, f, c + 1, f + 1);
    if (!L(c, f + 1)) poner(c + 1, f + 1, c, f + 1);
    if (!L(c - 1, f)) poner(c, f + 1, c, f);
  }
  const vueltas = [];
  for (;;) {
    let arranque = null;
    for (const [k, v] of aristas) if (v.length) { arranque = k; break; }
    if (!arranque) break;
    const [sx, sy] = arranque.split(',').map(Number);
    const pts = [[sx, sy]];
    let x = sx, y = sy, dir = null;
    for (let guarda = 0; guarda < 20000; guarda++) {
      const salidas = aristas.get(x + ',' + y);
      if (!salidas || !salidas.length) break;
      // en un cruce en diagonal hay dos salidas: se dobla a la derecha (no se mezclan las vueltas)
      let i = 0;
      if (salidas.length > 1 && dir) {
        let mejor = -Infinity;
        salidas.forEach(([nx, ny], k) => { const giro = dir[0] * (ny - y) - dir[1] * (nx - x); if (giro > mejor) { mejor = giro; i = k; } });
      }
      const [nx, ny] = salidas.splice(i, 1)[0];
      dir = [nx - x, ny - y];
      x = nx; y = ny;
      if (x === sx && y === sy) break;
      pts.push([x, y]);
    }
    if (pts.length >= 4) vueltas.push(pts);
  }
  return vueltas;
}

// Una vuelta (esquinas de celda) → puntos densos en píxeles: los lados libres
// con temblequeo y sus esquinas redondeadas; los pegados, rectos.
// `pegado(x0, y0, x1, y1)` dice si el lado de una celda toca otra pieza.
export function vueltaOrganica(pts, esc, { radio = 0.26, radioAdentro = 0.12, ruido = 0.035, semilla = 1, cada = 0.08, pegado = () => false } = {}) {
  const n = pts.length;
  // los lados en tramos: misma dirección y mismo "pegado"
  const lados = pts.map((p, i) => { const q = pts[(i + 1) % n]; return { a: p, b: q, dx: q[0] - p[0], dy: q[1] - p[1], pegado: !!pegado(p[0], p[1], q[0], q[1]) }; });
  let s0 = lados.findIndex((l, i) => { const ant = lados[(i - 1 + n) % n]; return ant.dx !== l.dx || ant.dy !== l.dy || ant.pegado !== l.pegado; });
  if (s0 < 0) s0 = 0;
  const tramos = [];
  for (let k = 0; k < n; k++) {
    const l = lados[(s0 + k) % n], ult = tramos[tramos.length - 1];
    if (ult && ult.dx === l.dx && ult.dy === l.dy && ult.pegado === l.pegado) { ult.b = l.b; ult.largo++; }
    else tramos.push({ a: l.a, b: l.b, dx: l.dx, dy: l.dy, pegado: l.pegado, largo: 1 });
  }
  const T = tramos.length;
  // el radio de cada esquina (entre el tramo i y el i+1): solo si los dos lados están libres
  const radios = tramos.map((t, i) => {
    const u = tramos[(i + 1) % T];
    if (t.dx === u.dx && t.dy === u.dy) return 0;
    if (t.pegado || u.pegado) return 0;
    const giro = t.dx * u.dy - t.dy * u.dx;
    return Math.min(giro > 0 ? radio : radioAdentro, t.largo / 2, u.largo / 2);
  });
  const r = azar(semilla), fases = [r() * 6.28, r() * 6.28, r() * 6.28], frec = [1.3 + r(), 2.9 + r() * 2, 6 + r() * 3];
  const ondita = (s) => Math.sin(s * frec[0] + fases[0]) * 0.55 + Math.sin(s * frec[1] + fases[1]) * 0.3 + Math.sin(s * frec[2] + fases[2]) * 0.15;
  const out = [];
  let s = 0;
  tramos.forEach((t, i) => {
    const ant = tramos[(i - 1 + T) % T], sig = tramos[(i + 1) % T];
    const r0 = radios[(i - 1 + T) % T], r1 = radios[i];
    const ux = Math.sign(t.dx), uy = Math.sign(t.dy);
    const ini = [t.a[0] + ux * r0, t.a[1] + uy * r0], fin = [t.b[0] - ux * r1, t.b[1] - uy * r1];
    const largo = Math.hypot(fin[0] - ini[0], fin[1] - ini[1]), pasos = Math.max(1, Math.ceil(largo / cada));
    // el temblequeo se apaga cerca de donde el borde pasa a estar pegado
    const apaga0 = ant.pegado && !(ant.dx === t.dx && ant.dy === t.dy) ? 1 : ant.pegado ? 1 : 0, apaga1 = sig.pegado ? 1 : 0;
    for (let k = 0; k < pasos; k++) {
      const f = k / pasos, x = ini[0] + (fin[0] - ini[0]) * f, y = ini[1] + (fin[1] - ini[1]) * f;
      s += largo / pasos;
      let amp = t.pegado ? 0 : ruido;
      if (amp) {
        const d0 = f * largo, d1 = (1 - f) * largo;
        if (apaga0) amp *= suave(clamp(d0 / 0.4, 0, 1));
        if (apaga1) amp *= suave(clamp(d1 / 0.4, 0, 1));
      }
      const w = ondita(s) * amp;
      // afuera es la izquierda del recorrido: (uy, -ux)
      out.push([(x + uy * w) * esc, (y - ux * w) * esc]);
    }
    if (r1 > 0) {
      const vx = Math.sign(sig.dx), vy = Math.sign(sig.dy), p = t.b, c2 = [p[0] + vx * r1, p[1] + vy * r1];
      const pc = Math.max(2, Math.ceil((r1 * 1.6) / cada));
      for (let k = 0; k < pc; k++) {
        const f = k / pc, m = 1 - f;
        const x = m * m * fin[0] + 2 * m * f * p[0] + f * f * c2[0], y = m * m * fin[1] + 2 * m * f * p[1] + f * f * c2[1];
        const nx = m * uy + f * vy, ny = -(m * ux + f * vx), nl = Math.hypot(nx, ny) || 1;
        s += (r1 * 1.57) / pc;
        const w = ondita(s) * ruido;
        out.push([(x + (nx / nl) * w) * esc, (y + (ny / nl) * w) * esc]);
      }
    }
  });
  return out;
}
// un rectángulo con las puntas redondeadas (roundRect no está en los teléfonos viejos)
export function redondo(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
export function caminoDe(vueltas, ox = 0, oy = 0) {
  const p = new Path2D();
  for (const v of vueltas) {
    v.forEach(([x, y], i) => (i ? p.lineTo(x + ox, y + oy) : p.moveTo(x + ox, y + oy)));
    p.closePath();
  }
  return p;
}

// ── la textura: huellas digitales, rayones de palillo y motitas ───────────
export function huellas() {
  return guardado('huellas', () => {
    const N = 256, c = lienzo(N, N), g = c.getContext('2d'), r = azar(77);
    // se dibuja con copias alrededor del cuadro para que el patrón no tenga cortes
    const envuelto = (fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
    for (let k = 0; k < 7; k++) {
      const x = r() * N, y = r() * N, rx = 18 + r() * 16, ry = rx * (0.65 + r() * 0.2), ang = r() * Math.PI, anillos = 7 + Math.floor(r() * 5), abre = [];
      for (let a = 0; a < anillos; a++) abre.push(0.4 + r() * 0.8);
      envuelto(() => {
        g.save(); g.translate(x, y); g.rotate(ang);
        for (let a = 0; a < anillos; a++) {
          const k2 = (a + 1) / anillos;
          g.strokeStyle = a % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
          g.lineWidth = 1.1;
          g.beginPath();
          // un óvalo abierto (las huellas no cierran) con un temblor chiquito
          for (let t = abre[a]; t < Math.PI * 2 - 0.2; t += 0.12) {
            const w = 1 + Math.sin(t * 5 + a) * 0.03;
            g.lineTo(Math.cos(t) * rx * k2 * w, Math.sin(t) * ry * k2 * w);
          }
          g.stroke();
        }
        g.restore();
      });
    }
    // rayones de palillo: curvas cortas, con su borde claro al lado
    for (let k = 0; k < 16; k++) {
      const x = r() * N, y = r() * N, a = r() * Math.PI * 2, l = 8 + r() * 20, curva = (r() - 0.5) * 12;
      const mx = Math.cos(a) * l * 0.5 - Math.sin(a) * curva, my = Math.sin(a) * l * 0.5 + Math.cos(a) * curva;
      envuelto(() => {
        g.lineCap = 'round'; g.lineWidth = 1.3;
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + mx, y + my, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(x + 1, y + 1); g.quadraticCurveTo(x + 1 + mx, y + 1 + my, x + 1 + Math.cos(a) * l, y + 1 + Math.sin(a) * l); g.stroke();
      });
    }
    // motitas (pigmento y pelusa) y poros
    for (let k = 0; k < 520; k++) {
      const x = r() * N, y = r() * N, oscuro = r() < 0.6, rr = 0.4 + r() * 1.1, al = oscuro ? 0.06 + r() * 0.1 : 0.05 + r() * 0.08;
      g.fillStyle = oscuro ? `rgba(0,0,0,${al})` : `rgba(255,255,255,${al})`;
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
    return c;
  });
}

// El relieve de almohadón sobre lo que ya está pintado en `c` (solo toca lo
// pintado: todo va con source-atop). `camino` es la forma (Path2D, en
// píxeles de `c`) y `px` el tamaño de una celda en píxeles (el relieve se
// mide en celdas).
export function relieve(c, camino, color, px, { luz = 0.55, sombra = 0.6, brillo = 0.35, textura = 0.8, semilla = 1, hondo = 1, borde = 0.55 } = {}) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const hueco = lienzo(w, h), gh = hueco.getContext('2d'), esCamino = camino instanceof Path2D;
  // lo de afuera de la forma, para que su sombra caiga adentro (la forma
  // puede ser un camino o un lienzo con la silueta, como las letras)
  gh.fillStyle = '#000'; gh.fillRect(0, 0, w, h);
  gh.globalCompositeOperation = 'destination-out';
  if (esCamino) gh.fill(camino); else gh.drawImage(camino, 0, 0);
  const claro = tono(color, 0.6), oscuro = tono(color, -0.62), k = px * hondo;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  // cada pasada es la sombra de "lo de afuera" corrida hacia adentro: corrida
  // para abajo cae junto a los bordes de arriba, corrida para arriba junto a
  // los de abajo. La luz viene de arriba a la izquierda.
  const pasada = (col, a, dx, dy, borr) => { g.shadowColor = rgba(col, a); g.shadowBlur = borr; g.shadowOffsetX = dx; g.shadowOffsetY = dy; g.drawImage(hueco, 0, 0); };
  pasada(oscuro, sombra * 0.55, 0, 0, k * 0.09);                // el borde que se va para atrás (redondea todo)
  pasada(claro, luz, 0, k * 0.2, k * 0.26);                      // el labio de arriba, donde pega la luz
  pasada(oscuro, sombra, 0, -k * 0.16, k * 0.3);                 // la panza de abajo, en sombra
  pasada(claro, luz * 0.55, k * 0.1, 0, k * 0.18);               // el costado izquierdo, más claro
  pasada(oscuro, sombra * 0.5, -k * 0.1, 0, k * 0.2);            // y el derecho, más oscuro
  g.shadowColor = 'transparent';
  // un borde oscuro finito, donde la plastilina dobla para atrás
  if (borde > 0 && esCamino) { g.strokeStyle = rgba(tono(color, -0.55), borde); g.lineWidth = Math.max(1, px * 0.03); g.stroke(camino); }
  // las huellas, a la escala de la pieza (una huella es un tercio de celda)
  // y corridas según la semilla: cada pieza, las suyas
  if (textura > 0) {
    const r = azar(semilla), lado = Math.max(64, Math.round(px * 2.3)), x0 = -Math.floor(r() * lado), y0 = -Math.floor(r() * lado);
    g.globalAlpha = textura;
    for (let y = y0; y < h; y += lado) for (let x = x0; x < w; x += lado) g.drawImage(huellas(), x, y, lado, lado);
    g.globalAlpha = 1;
  }
  // el brillo de la plastilina: una línea blanda justo adentro del borde de
  // arriba a la izquierda (el trazo va afuera del lienzo y su sombra vuelve
  // corrida hacia adentro; la sombra no se mueve con el translate)
  if (brillo > 0 && esCamino) {
    g.shadowColor = `rgba(255,255,255,${brillo})`; g.shadowBlur = px * 0.08;
    g.shadowOffsetX = w * 3 + k * 0.1; g.shadowOffsetY = k * 0.13;
    g.translate(-w * 3, 0); g.lineWidth = px * 0.06; g.strokeStyle = '#fff'; g.stroke(camino);
  }
  g.restore();
}

// Una pieza: la forma rellena con su color y su relieve, más su sombra
// (borrosa, para pegarla corrida). `forma()` devuelve un Path2D en píxeles
// dentro de w × h. `m` es el margen que queda alrededor (lo usa pegar).
export function pieza(clave, w, h, forma, color, op = {}) {
  return guardado(clave, () => armarPieza(w, h, forma, color, op));
}
export function armarPieza(w, h, forma, color, op = {}) {
  const borroso = op.borroso ?? 6, m = Math.ceil(borroso * 2 + 4);
  const c = lienzo(w + 2 * m, h + 2 * m), g = c.getContext('2d');
  const camino = new Path2D(); camino.addPath(forma(), new DOMMatrix([1, 0, 0, 1, m, m]));
  g.fillStyle = color; g.fill(camino);
  op.pintar?.(g, m);                    // lo que va arriba del color antes del relieve (dibujos, vetas)
  relieve(c, camino, color, op.px ?? Math.min(w, h), op);
  op.encima?.(g, m);                    // lo que va arriba de todo (ojos, detalles de otro material)
  return { img: c, sombra: sombraDe(c, borroso, op.oscuridad ?? 0.4), m, w: c.width, h: c.height, camino };
}
// la sombra de un dibujo: la misma silueta, oscura y borrosa
export function sombraDe(c, borroso, alfa = 0.4) {
  const s = lienzo(c.width, c.height), gs = s.getContext('2d');
  // con shadowBlur y la figura corrida afuera: `filter` no está en todos los teléfonos
  gs.shadowColor = `rgba(30,18,8,${alfa})`; gs.shadowBlur = borroso * 2; gs.shadowOffsetX = 4000;
  gs.drawImage(c, -4000, 0);
  return s;
}
// pegar una pieza con su rincón de arriba a la izquierda (de la forma) en
// (x, y), con la sombra corrida hacia abajo a la derecha
export function pegar(g, p, x, y, { alto = 4, alfa = 1, sombra = true } = {}) {
  if (alfa < 1) { g.save(); g.globalAlpha = alfa; }
  if (sombra && alto > 0) g.drawImage(p.sombra, x - p.m + alto * 0.7, y - p.m + alto);
  g.drawImage(p.img, x - p.m, y - p.m);
  if (alfa < 1) g.restore();
}

// Una palabra (o letra) de plastilina: la letra gruesa del sistema, con un
// trazo redondo alrededor (así las puntas quedan romas, como amasadas), y
// el mismo relieve que las piezas. Devuelve la pieza con `m` (margen).
export function piezaTexto(clave, texto, px, color, { fuente = null, relleno = 0.16, op = {} } = {}) {
  return guardado(clave, () => {
    const f = fuente || `900 ${Math.round(px)}px ui-rounded, "Arial Rounded MT Bold", "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif`;
    const med = lienzo(4, 4).getContext('2d'); med.font = f;
    const ancho = Math.ceil(med.measureText(texto).width + px * relleno * 2), alto = Math.ceil(px * 1.25);
    const borroso = op.borroso ?? px * 0.05, m = Math.ceil(borroso * 2 + 4);
    const c = lienzo(ancho + 2 * m, alto + 2 * m), g = c.getContext('2d');
    g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.fillStyle = color; g.strokeStyle = color; g.lineWidth = px * relleno;
    g.fillText(texto, c.width / 2, c.height / 2 + px * 0.04); g.strokeText(texto, c.width / 2, c.height / 2 + px * 0.04);
    const silueta = lienzo(c.width, c.height); silueta.getContext('2d').drawImage(c, 0, 0);
    relieve(c, silueta, color, op.px ?? px * 0.5, { textura: 0.6, ...op });
    return { img: c, sombra: sombraDe(c, borroso, op.oscuridad ?? 0.45), m, w: c.width, h: c.height, ancho: c.width - 2 * m, alto: c.height - 2 * m };
  });
}

// ── la foto: grano, viñeta y la luz que titila ─────────────────────────────
// tres granos distintos que se turnan con los cuadros (el grano de película
// nunca está quieto)
export function granos() {
  return guardado('granos', () => [0, 1, 2].map((k) => {
    const N = 200, c = lienzo(N, N), g = c.getContext('2d'), r = azar(900 + k), img = g.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = r(), o = i * 4;
      if (v < 0.5) { img.data[o] = img.data[o + 1] = img.data[o + 2] = 0; img.data[o + 3] = Math.round(r() * 26); }
      else { img.data[o] = 255; img.data[o + 1] = 245; img.data[o + 2] = 225; img.data[o + 3] = Math.round(r() * 20); }
    }
    g.putImageData(img, 0, 0);
    return c;
  }));
}
const patrones = new WeakMap();
export function pintarGrano(g, W, H, cuadro, alfa = 1) {
  const lista = granos(), k = ((cuadro % 3) + 3) % 3;
  let pats = patrones.get(g);
  if (!pats) { pats = lista.map((c) => g.createPattern(c, 'repeat')); patrones.set(g, pats); }
  g.save();
  g.globalAlpha = alfa;
  // corrido en cada cuadro: no se ve el mismo puntito dos veces
  g.translate(Math.floor(hash(cuadro, 1) * 200), Math.floor(hash(cuadro, 2) * 200));
  g.fillStyle = pats[k]; g.fillRect(-200, -200, W + 400, H + 400);
  g.restore();
}
export function vineta(W, H, fuerza = 0.5) {
  return guardado(`vineta:${W}x${H}:${fuerza}`, () => {
    const c = lienzo(W, H), g = c.getContext('2d');
    const gr = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(20,10,4,${fuerza})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return c;
  });
}
// cuánto se pasa o le falta a la luz en este cuadro (la lámpara del set
// nunca da igual dos fotos seguidas): de −1 a 1
export const titila = (cuadro) => (hash(cuadro, 7) - 0.5) * 2;
export function pintarTitileo(g, W, H, cuadro, fuerza = 0.035) {
  const k = titila(cuadro) * fuerza;
  g.save();
  g.fillStyle = k > 0 ? `rgba(255,236,200,${k})` : `rgba(20,10,0,${-k})`;
  g.fillRect(0, 0, W, H);
  g.restore();
}
// Algo borroso (el fondo pintado, lejos de la cámara): se achica y se
// vuelve a agrandar con suavizado (el `filter: blur` no está en todos lados).
export function desenfocar(c, k = 3) {
  const w = Math.max(1, Math.round(c.width / k)), h = Math.max(1, Math.round(c.height / k));
  const chico = lienzo(w, h), gc = chico.getContext('2d');
  gc.imageSmoothingQuality = 'high'; gc.drawImage(c, 0, 0, w, h);
  const out = lienzo(c.width, c.height), go = out.getContext('2d');
  go.imageSmoothingQuality = 'high'; go.drawImage(chico, 0, 0, c.width, c.height);
  return out;
}
