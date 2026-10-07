/* ============================================================================
   motor2d/intro-jxs.js — LA intro de JXSTUDIOS para todos los juegos ("así las
   quiero a las intro", 07/10, mostrando la de La Cripta). Sacada tal cual de
   cripta/cripta.html (M_logojxs + M_intro + sonido › jingleJXS), sin depender
   de nada de ese juego salvo la fuente de píxeles (motor2d/fuente.js).

   En pixel art y rápida (2,1 s): una raya de luz abre la fibra de carbono, el
   monograma JXS se escribe en metal con chispas en las puntas, golpe (destello,
   sacudida, chispazo), una franja de brillo lo cruza, "JXSTUDIOS" se tipea y
   abajo "presenta". Después, el iris (círculo que se cierra y se abre).

   Uso:
     const intro = crearIntroJXS({ W, H, presenta: 'PRESENTA', vibrar });
     cada cuadro: intro.pasar(dt); intro.dibujar(g);   // g en píxeles del juego
     un toque: intro.saltar();  ¿terminó?: intro.listo
     con el audio andando (después de un toque no se puede antes): jingleJXS(ctx, destino)
     transiciones: irisJXS(g, W, H, cx, cy, r)

   Cada juego la viste a su estilo ("con su intro respectiva a su estilo", 07/10) con `estilo`:
   la misma coreografía, otro material. Todo es opcional (sin estilo = La Cripta):
     metal: [8 colores de arriba a abajo], filo, bisel, borde: '#rrggbb'
     sombra: { dx, dy, col }                  el monograma proyecta una sombra plana (filete)
     fondo(W, H, cx, cy) → lienzo             el fondo (por defecto la fibra de carbono)
     puntas: [colores], golpe: [colores], destello: 'rgba(...)'
     palabra: { col, borde }, presenta: color, negro: color del fondo
     antes(g, t, I) / despues(g, t, I)        dibujar algo más (I.cx, I.cy, I.ancho, I.yPalabra)
     jingle(ctx, bus, t0, tg, h)              otra música; h = { tono, soplo, f, T }
   ========================================================================== */

const IntroJXS_ = (() => {
  const CAJA = { w: 350, h: 172 };
  const GROSOR = 14.5;
  // el monograma: cuatro trazos de metal (A va abajo en el cruce: se dibuja primero)
  const TRAZOS = [
    { id: 'A', capa: 0, d: [['M', 40, 19], ['L', 114, 19], ['L', 176, 101], ['C', 194, 128, 222, 168, 268, 169], ['C', 310, 170, 342, 152, 342, 122]] },
    { id: 'J', capa: 0, d: [['M', 40, 43], ['L', 98, 43], ['L', 98, 116], ['C', 98, 148, 44, 158, 36, 124]] },
    { id: 'S', capa: 0, d: [['M', 312, 66], ['C', 306, 46, 288, 36, 266, 36], ['C', 242, 36, 226, 48, 226, 63], ['C', 226, 80, 248, 86, 272, 92], ['C', 302, 99, 320, 108, 320, 126], ['C', 320, 142, 300, 148, 272, 148], ['C', 246, 148, 226, 138, 216, 118]] },
    { id: 'B', capa: 1, d: [['M', 10, 130], ['C', 18, 158, 50, 168, 86, 166], ['C', 108, 165, 122, 158, 134, 142], ['L', 200, 46], ['C', 216, 24, 244, 12, 272, 12], ['C', 310, 12, 340, 30, 340, 62]] },
  ];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const salida = (t) => 1 - Math.pow(1 - t, 3);
  const salidaAtras = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

  function camino2d(t, esc, ox, oy) {
    const p = new Path2D();
    for (const [op, ...n] of t.d) {
      const q = n.map((v, i) => (i % 2 ? oy + v * esc : ox + v * esc));
      if (op === 'M') p.moveTo(q[0], q[1]);
      else if (op === 'L') p.lineTo(q[0], q[1]);
      else p.bezierCurveTo(q[0], q[1], q[2], q[3], q[4], q[5]);
    }
    return p;
  }
  function muestrear(t, cada) {
    const pts = [];
    let x = 0, y = 0;
    for (const [op, ...n] of t.d) {
      if (op === 'M') { x = n[0]; y = n[1]; pts.push([x, y]); continue; }
      if (op === 'L') {
        const [x1, y1] = n, largo = Math.hypot(x1 - x, y1 - y), k = Math.max(1, Math.ceil(largo / cada));
        for (let i = 1; i <= k; i++) pts.push([x + ((x1 - x) * i) / k, y + ((y1 - y) * i) / k]);
        x = x1; y = y1; continue;
      }
      const [c1x, c1y, c2x, c2y, x1, y1] = n;
      const aprox = Math.hypot(c1x - x, c1y - y) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x1 - c2x, y1 - c2y);
      const k = Math.max(2, Math.ceil(aprox / cada));
      for (let i = 1; i <= k; i++) {
        const s = i / k, r = 1 - s;
        pts.push([r * r * r * x + 3 * r * r * s * c1x + 3 * r * s * s * c2x + s * s * s * x1, r * r * r * y + 3 * r * r * s * c1y + 3 * r * s * s * c2y + s * s * s * y1]);
      }
      x = x1; y = y1;
    }
    return pts;
  }
  const largos = new Map();
  function largo(t) {
    if (largos.has(t.id)) return largos.get(t.id);
    const p = muestrear(t, 2);
    let l = 0;
    for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    largos.set(t.id, l);
    return l;
  }
  // el monograma en píxeles: se traza chico, se separa metal de borde por color y se
  // repinta en escalones de cromo con filo de luz y bisel en sombra
  function monogramaPixel(anchoPx, avance, E) {
    E = E || {};
    const esc = anchoPx / CAJA.w, alto = Math.ceil(CAJA.h * esc) + 4, ancho = Math.ceil(anchoPx) + 4;
    const c = document.createElement('canvas');
    c.width = ancho; c.height = alto;
    const g = c.getContext('2d');
    for (const capa of [0, 1]) for (const t of TRAZOS) {
      if (t.capa !== capa) continue;
      const p = camino2d(t, esc, 2, 2), l = largo(t) * esc;
      g.save();
      if (avance < 1) g.setLineDash([Math.max(0.01, l * avance), l + 10]);
      g.lineCap = 'butt';
      g.lineWidth = GROSOR * esc + 2.2; g.strokeStyle = '#ff0000'; g.stroke(p);
      g.lineWidth = GROSOR * esc; g.strokeStyle = '#00ff00'; g.stroke(p);
      g.restore();
    }
    const img = g.getImageData(0, 0, ancho, alto), d = img.data;
    const metal = new Uint8Array(ancho * alto), borde = new Uint8Array(ancho * alto);
    for (let i = 0; i < ancho * alto; i++) {
      if (d[i * 4 + 3] < 90) continue;
      if (d[i * 4 + 1] > 110) metal[i] = 1; else if (d[i * 4] > 110) borde[i] = 1;
    }
    const ESCALON = E.metal || ['#f4f5f8', '#d9dbe1', '#b7bbc4', '#8d929c', '#a9adb6', '#d3d6dc', '#9ea3ad', '#767b85'];
    const FILO = E.filo || '#ffffff', BISEL = E.bisel || '#5b5f68', BO = parseInt((E.borde || '#050608').slice(1), 16);
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x, k = i * 4;
      if (metal[i]) {
        const arriba = y > 0 && metal[i - ancho], abajo = y < alto - 1 && metal[i + ancho];
        const izq = x > 0 && metal[i - 1], der = x < ancho - 1 && metal[i + 1];
        let col = ESCALON[Math.min(ESCALON.length - 1, Math.floor(((y - 2) / (alto - 4)) * ESCALON.length))];
        if (!arriba || !izq) col = FILO;
        else if (!abajo || !der) col = BISEL;
        const n = parseInt(col.slice(1), 16);
        d[k] = n >> 16; d[k + 1] = (n >> 8) & 255; d[k + 2] = n & 255; d[k + 3] = 255;
      } else if (borde[i]) { d[k] = BO >> 16; d[k + 1] = (BO >> 8) & 255; d[k + 2] = BO & 255; d[k + 3] = 255; }
      else d[k + 3] = 0;
    }
    g.putImageData(img, 0, 0);
    if (E.sombra) {   // una sombra plana corrida, debajo del dibujo
      const s = document.createElement('canvas'); s.width = ancho + Math.abs(E.sombra.dx); s.height = alto + Math.abs(E.sombra.dy);
      const sg = s.getContext('2d');
      sg.drawImage(c, E.sombra.dx, E.sombra.dy); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = E.sombra.col; sg.fillRect(0, 0, s.width, s.height);
      sg.globalCompositeOperation = 'source-over'; sg.drawImage(c, 0, 0);
      g.clearRect(0, 0, ancho, alto); c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0);
      const m2 = new Uint8Array(c.width * c.height);
      for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) m2[y * c.width + x] = metal[y * ancho + x];
      c.mascara = m2; c.esc = esc;
      return c;
    }
    c.mascara = metal; c.esc = esc;
    return c;
  }
  const muestras = new Map();
  function puntas(avance) {
    const out = [];
    for (const t of TRAZOS) {
      if (!muestras.has(t.id)) {
        const p = muestrear(t, 2), acum = [0];
        for (let i = 1; i < p.length; i++) acum.push(acum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
        muestras.set(t.id, { p, acum });
      }
      const { p, acum } = muestras.get(t.id), meta = acum[acum.length - 1] * avance;
      let i = 1;
      while (i < acum.length - 1 && acum[i] < meta) i++;
      out.push(p[i]);
    }
    return out;
  }
  // la fibra de carbono de a píxel, con la reja de metal a 45° afuera del rombo
  function fondoCarbono(W, H, cx, cy, rombo) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const pon = (x, y, r, gg, b) => { const k = (y * W + x) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sarga = ((x >> 1) + (y >> 1)) % 4 < 2;
      const luz = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / Math.max(W, H));
      const v = (sarga ? 24 : 16) + Math.round(luz * 10);
      pon(x, y, v, v + 1, v + 3);
      const dr = Math.abs(x - cx) + Math.abs(y - cy) - rombo;
      if (dr >= 0 && dr < 3) { if (dr < 1) pon(x, y, 0x9a, 0xa0, 0xaa); else pon(x, y, 0x4d, 0x50, 0x58); continue; }
      if (dr < 2) continue;
      const u = x - cx + (y - cy), w = x - cx - (y - cy);
      const eu = ((u % 22) + 22) % 22, ev = ((w % 22) + 22) % 22;
      if (eu < 2 || ev < 2) { if (eu === 0 || ev === 0) pon(x, y, 0x7a, 0x7e, 0x88); else pon(x, y, 0x44, 0x47, 0x4f); }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  const T_CORTE = 0.12, T_ABRE = 0.42, T_TRAZA0 = 0.3, T_TRAZA1 = 0.86, T_GOLPE = 0.88;
  const T_BRILLO = [0.95, 1.35], T_LETRAS = 1.02, T_FIN = 2.1;

  function crear(o) {
    const W = o.W, H = o.H, cx = W >> 1, cy = Math.round(H * 0.42), E = o.estilo || {};
    const ancho = Math.round(Math.min(W * 0.66, H * 0.9, 120));
    const fondo = E.fondo ? E.fondo(W, H, cx, cy) : fondoCarbono(W, H, cx, cy, Math.min(W, H) * 0.44);
    const PUNTAS = E.puntas || ['#ffffff', '#ffd27a'], GOLPE = E.golpe || ['#ffffff', '#ffd27a', '#c9ccd4', '#7ad7ff'];
    let chispas = [], sacudida = 0, golpeado = false, letras = 0, pts = null, cache = { avance: -1, c: null };
    const I = {
      t: 0, listo: false, cx, cy, ancho, yPalabra: Math.round(cy + ancho * 0.29 + 4), W, H,
      saltar() { if (I.t > 0.35) I.listo = true; },
      pasar(dt) {
        I.t += dt;
        if (I.t > T_TRAZA0 && I.t < T_TRAZA1 && pts) {
          for (const [x, y] of pts) for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50;
            chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, t: 0, vida: 0.25 + Math.random() * 0.2, col: PUNTAS[(Math.random() * PUNTAS.length) | 0] });
          }
        }
        if (!golpeado && I.t >= T_GOLPE) {
          golpeado = true; sacudida = 4;
          if (o.vibrar) o.vibrar([30, 20, 40]);
          for (let k = 0; k < 70; k++) {
            const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120;
            chispas.push({ x: cx + (Math.random() - 0.5) * ancho, y: cy + (Math.random() - 0.5) * ancho * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, vida: 0.5 + Math.random() * 0.5, col: GOLPE[k % GOLPE.length] });
          }
        }
        letras = clamp(Math.floor((I.t - T_LETRAS) / 0.04) + 1, 0, 9);
        for (const c of chispas) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 120 * dt; c.vx *= 0.96; }
        chispas = chispas.filter((c) => c.t < c.vida);
        sacudida *= Math.pow(0.84, dt * 60);
        if (I.t >= T_FIN) I.listo = true;
      },
      dibujar(g) {
        const t = I.t;
        g.fillStyle = E.negro || '#05040b'; g.fillRect(0, 0, W, H);
        const s = Math.round(sacudida), sx = s ? Math.round((Math.random() * 2 - 1) * s) : 0, sy = s ? Math.round((Math.random() * 2 - 1) * s) : 0;
        if (t < T_CORTE) {
          const w = Math.round(W * t / T_CORTE);
          g.fillStyle = '#f6f3ff'; g.fillRect(Math.round(cx - w / 2), cy, w, 1);
          return;
        }
        const abre = clamp((t - T_CORTE) / (T_ABRE - T_CORTE), 0, 1), alto = Math.round((Math.max(cy, H - cy) + 4) * salidaAtras(abre));
        g.save(); g.beginPath(); g.rect(0, cy - alto, W, alto * 2); g.clip(); g.drawImage(fondo, sx, sy); if (E.antes) E.antes(g, t, I); g.restore();
        if (abre < 1) { g.fillStyle = '#d9dce3'; g.fillRect(0, cy - alto, W, 1); g.fillRect(0, cy + alto - 1, W, 1); }
        const avance = clamp((t - T_TRAZA0) / (T_TRAZA1 - T_TRAZA0), 0, 1);
        if (avance > 0) {
          const a = Math.round(avance * 40) / 40;
          if (cache.avance !== a) cache = { avance: a, c: monogramaPixel(ancho, a, E) };
          const m = cache.c, x0 = Math.round(cx - m.width / 2) + sx, y0 = Math.round(cy - m.height / 2) + sy;
          pts = avance < 1 ? puntas(avance).map(([px, py]) => [x0 + 2 + px * m.esc, y0 + 2 + py * m.esc]) : null;
          g.drawImage(m, x0, y0);
          if (t >= T_GOLPE && t < T_GOLPE + 0.06) { g.fillStyle = E.destello || 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, W, H); }
          if (t > T_BRILLO[0] && t < T_BRILLO[1]) {
            const k = (t - T_BRILLO[0]) / (T_BRILLO[1] - T_BRILLO[0]), bx = Math.round(-10 + k * (m.width + 20));
            g.fillStyle = 'rgba(255,255,255,0.6)';
            for (let y = 0; y < m.height; y++) for (let dx = -2; dx <= 2; dx++) {
              const px = bx + dx - Math.round(y * 0.5);
              if (px >= 0 && px < m.width && m.mascara[y * m.width + px]) g.fillRect(x0 + px, y0 + y, 1, 1);
            }
          }
        }
        if (letras > 0) {
          const esc = W >= 200 ? 2 : 1, palabra = 'JXSTUDIOS', an = anchoTexto(palabra) * esc;
          const x = Math.round(cx - an / 2), y = Math.round(cy + ancho * 0.29 + 4);
          const parte = palabra.slice(0, letras);
          if (E.palabraFondo) E.palabraFondo(g, t, I, letras);
          textoPx(g, parte, x + sx, y + sy, { col: (E.palabra && E.palabra.col) || '#e4e6ec', borde: (E.palabra && E.palabra.borde) || '#3d4048', escala: esc });
          if (letras < 9 && ((t * 20) | 0) % 2) { g.fillStyle = '#f6f3ff'; g.fillRect(x + anchoTexto(parte) * esc + esc, y, esc, 7 * esc); }
          if (t > T_LETRAS + 0.5) textoPx(g, o.presenta || 'PRESENTA', cx, y + 12 * esc, { alin: 'centro', col: E.presenta || '#8d88ad', borde: 'no' });
        }
        if (E.despues) E.despues(g, t, I);
        for (const c of chispas) {
          if (c.t > c.vida * 0.7 && ((c.t * 30) | 0) % 2) continue;
          g.fillStyle = c.col; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1);
        }
      },
    };
    return I;
  }

  // la música de la intro, agendada con el reloj del audio para que cada golpe caiga con su
  // cuadro: el corte (soplido), el metal que se escribe (cuatro zumbidos), el golpe (bombo grave +
  // campana de metal), el brillo (arpegio), las letras (tics) y un acorde que queda sonando
  function jingle(ctx, destino, E) {
    if (!ctx || ctx.state !== 'running') return null;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(destino || ctx.destination);
    const f = (n) => 440 * Math.pow(2, ({ C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[n[0]] + (+n.slice(1) - 4) * 12) / 12);
    const tono = (onda, f0, f1, dur, vol, t, ataque) => {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = onda; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + (ataque || 0.005)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(bus); o.start(t); o.stop(t + dur + 0.05);
    };
    const n = ctx.sampleRate, buf = ctx.createBuffer(1, n, n), dd = buf.getChannelData(0);
    for (let i = 0; i < n; i++) dd[i] = Math.random() * 2 - 1;
    const soplo = (dur, vol, tipo, f0, f1, t) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gn = ctx.createGain();
      s.buffer = buf; fl.type = tipo; fl.Q.value = 1.2; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(gn); gn.connect(bus); s.start(t); s.stop(t + dur + 0.05);
    };
    const t0 = ctx.currentTime + 0.03, tg = t0 + T_GOLPE;
    if (E && E.jingle) { E.jingle(ctx, bus, t0, tg, { tono, soplo, f, T: { T_LETRAS, T_GOLPE, T_FIN } }); return { cortar: () => bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05) }; }
    soplo(0.2, 0.12, 'bandpass', 700, 5200, t0);
    [0.3, 0.38, 0.46, 0.54].forEach((d, k) => tono('square', 240 + k * 70, 1300 + k * 240, 0.16, 0.035, t0 + d));
    tono('sine', 115, 30, 0.95, 0.55, tg);
    for (const [fr, v, d] of [[523, 0.08, 1.3], [1247, 0.05, 1], [2011, 0.035, 0.75], [3150, 0.025, 0.5], [4430, 0.015, 0.35]]) tono('sine', fr, 0, d, v, tg);
    soplo(0.4, 0.25, 'lowpass', 4200, 260, tg);
    ['C6', 'E6', 'G6', 'B6', 'D7', 'G7'].forEach((nn, k) => tono('triangle', f(nn), 0, 0.28, 0.05, tg + 0.07 + k * 0.035));
    for (let k = 0; k < 9; k++) tono('square', 1320 + (k % 3) * 110, 0, 0.022, 0.03, t0 + T_LETRAS + k * 0.04);
    for (const nn of ['C3', 'G3', 'E4', 'B4', 'D5']) tono('triangle', f(nn), 0, 1.35, 0.05, t0 + 1.1, 0.25);
    return { cortar: () => bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05) };
  }

  // el iris: negro afuera de un círculo de radio r, de a filas (borde de píxel)
  function iris(g, W, H, cx, cy, r) {
    g.fillStyle = '#05040b';
    if (r <= 0) { g.fillRect(0, 0, W, H); return; }
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - cy;
      if (Math.abs(dy) >= r) { g.fillRect(0, y, W, 1); continue; }
      const m = Math.sqrt(r * r - dy * dy), a = Math.round(cx - m), b = Math.round(cx + m);
      if (a > 0) g.fillRect(0, y, a, 1);
      if (b < W) g.fillRect(b, y, W - b, 1);
    }
  }
  return { crear, jingle, iris, salida, salidaAtras, DURA: T_FIN };
})();
const crearIntroJXS = IntroJXS_.crear, jingleJXS = IntroJXS_.jingle, irisJXS = IntroJXS_.iris;
