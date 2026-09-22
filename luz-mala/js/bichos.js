/* ============================================================================
   luz-mala/js/bichos.js — los bichos del quebracho. Cada uno con UNA idea:
   cascarudo patrulla · mosquito embiste · grillo salta · chinche escupe ·
   hormiga soldado tapa con el escudo · polilla va a la luz · arañita cae.
   Personalidad por reglas simples; el azar, del m.rnd de la sala.
   ========================================================================== */

const BICHOS = {
  c: { tipo: 'cascarudo', w: 12, h: 8, vida: 2, suelta: 2 },
  m: { tipo: 'mosquito', w: 8, h: 6, vida: 1, suelta: 1, vuela: true },
  g: { tipo: 'grillo', w: 10, h: 8, vida: 3, suelta: 3 },
  x: { tipo: 'chinche', w: 12, h: 9, vida: 3, suelta: 3 },
  o: { tipo: 'hormiga', w: 12, h: 10, vida: 4, suelta: 4, escudo: true },
  p: { tipo: 'polilla', w: 10, h: 8, vida: 2, suelta: 2, vuela: true },
  a: { tipo: 'aranita', w: 7, h: 6, vida: 1, suelta: 1 },
  w: { tipo: 'obrera', w: 8, h: 6, vida: 1, suelta: 0 },
};

function crearBicho(c, px, py, m) {
  const d = BICHOS[c];
  const b = Object.assign({}, d, {
    x: px + 4 - (d.w >> 1), y: py + 8 - d.h, rx: 0, ry: 0, vx: 0, vy: 0, dir: -1, t: m ? m.rnd() * 2 : 0,
    est: 'anda', muerto: false, flash: 0, kbT: 0, kbx: 0, kby: 0, x0: px, y0: py, espera: 0,
  });
  if (c === 'a') { b.y = py; b.est = 'cuelga'; b.yTecho = py; }
  if (c === 'm' || c === 'p') { b.y = py; }
  return b;
}

function danarBicho(m, b, d, dx, dy) {
  b.vida -= d; b.flash = 0.12;
  b.kbT = 0.14; b.kbx = dx * 150; b.kby = dy ? dy * 120 : -40;
  eventoLM(m, 'pega', { x: b.x + b.w / 2, y: b.y + b.h / 2, tipo: b.tipo });
  if (b.vida <= 0) {
    b.muerto = true;
    soltarAmbar(m, b.x + b.w / 2, b.y + b.h / 2, b.suelta);
    eventoLM(m, 'bichoMuere', { x: b.x + b.w / 2, y: b.y + b.h / 2, tipo: b.tipo });
  }
}

function pasarBichos(m) {
  const p = m.p;
  for (const b of m.bichos) {
    if (b.muerto) continue;
    b.t += DT;
    if (b.flash > 0) b.flash -= DT;
    const dx = p.x + 4 - (b.x + b.w / 2), dy = p.y + 6 - (b.y + b.h / 2), dist = Math.hypot(dx, dy);
    if (b.kbT > 0) {
      b.kbT -= DT;
      moverXLM(m, b, b.kbx * DT);
      if (b.vuela) moverYLM(m, b, b.kby * DT, null, true);
      else { b.vy = Math.min(300, b.vy + 900 * DT); if (b.kby < 0 && b.kbT > 0.1) b.vy = b.kby; moverYLM(m, b, b.vy * DT, () => { b.vy = 0; }); }
      continue;
    }
    switch (b.tipo) {
      case 'cascarudo': case 'obrera': caminar(m, b, b.tipo === 'obrera' ? 48 : 26); break;
      case 'hormiga':
        if (b.est === 'carga') { b.espera -= DT; caminar(m, b, 105); if (b.espera <= 0) b.est = 'anda'; }
        else {
          caminar(m, b, 20);
          if (Math.abs(dy) < 14 && Math.abs(dx) < 80 && sig(dx) === b.dir && b.espera <= 0) { b.est = 'carga'; b.espera = 0.8; eventoLM(m, 'hormigaCarga', { x: b.x, y: b.y }); }
          b.espera -= DT;
        }
        break;
      case 'grillo': {
        const suelo = pisaLM(m, b);
        if (suelo && b.vy >= 0) {
          b.vx = 0; b.espera -= DT;
          if (dist < 130) b.dir = sig(dx) || b.dir;
          if (b.espera <= 0 && dist < 130) { b.vy = -230; b.vx = lim(dx * 1.1, -90, 90); b.espera = 0.8 + m.rnd() * 0.7; eventoLM(m, 'grilloSalta', { x: b.x, y: b.y }); }
        }
        b.vy = Math.min(300, b.vy + 900 * DT);
        moverXLM(m, b, b.vx * DT, () => { b.vx = -b.vx * 0.3; });
        moverYLM(m, b, b.vy * DT, () => { b.vy = 0; });
        break;
      }
      case 'chinche':
        b.dir = sig(dx) || b.dir;
        b.espera -= DT;
        if (b.espera <= 0 && dist < 150) {
          b.espera = 2.2;
          const t = 0.9, g = 500;
          m.balas.push({ x: b.x + b.w / 2, y: b.y, vx: dx / t, vy: (dy - 0.5 * g * t * t) / t, g, r: 2, vida: 3, tipo: 'baba', rompible: true });
          eventoLM(m, 'escupe', { x: b.x + b.w / 2, y: b.y });
        }
        b.vy = Math.min(300, b.vy + 900 * DT); moverYLM(m, b, b.vy * DT, () => { b.vy = 0; });
        break;
      case 'mosquito':
        if (b.est === 'anda') {
          const hx = b.x0 + Math.sin(b.t * 1.7) * 14, hy = b.y0 + Math.sin(b.t * 2.9) * 6;
          b.vx = (hx - b.x) * 3; b.vy = (hy - b.y) * 3;
          if (dist < 90 && b.espera <= 0) { b.est = 'embiste'; b.espera = 1.1; const k = 80 / (dist || 1); b.vx = dx * k; b.vy = dy * k; eventoLM(m, 'zumbido', { x: b.x, y: b.y }); }
          b.espera -= DT;
        } else { b.espera -= DT; if (b.espera <= 0) { b.est = 'anda'; b.espera = 0.8; } }
        b.dir = sig(b.vx) || b.dir;
        moverXLM(m, b, b.vx * DT, () => { b.vx = -b.vx; });
        moverYLM(m, b, b.vy * DT, () => { b.vy = -b.vy; }, true);
        break;
      case 'polilla': {
        /* la luz la atrae, pero da vueltas antes de tocarla */
        const a = b.t * 3.1, mx = dx + Math.cos(a) * 26, my = dy + Math.sin(a * 1.3) * 18;
        const md = Math.hypot(mx, my) || 1;
        const v = dist < 150 ? 58 : 18;
        b.vx = acercar(b.vx, mx / md * v, 160 * DT); b.vy = acercar(b.vy, my / md * v, 160 * DT);
        b.dir = sig(b.vx) || b.dir;
        moverXLM(m, b, b.vx * DT, () => { b.vx = -b.vx; });
        moverYLM(m, b, b.vy * DT, () => { b.vy = -b.vy; }, true);
        break;
      }
      case 'aranita':
        if (b.est === 'cuelga') {
          b.y = b.yTecho + Math.sin(b.t * 2) * 2;
          if (Math.abs(dx) < 22 && dy > 0) { b.est = 'cae'; b.vy = 40; eventoLM(m, 'aranaCae', { x: b.x, y: b.y }); }
        } else {
          b.vy = Math.min(260, b.vy + 700 * DT);
          if (pisaLM(m, b)) { b.est = 'camina'; caminar(m, b, 36, true); }
          else moverYLM(m, b, b.vy * DT, () => { b.vy = 0; });
        }
        break;
    }
  }
}

/* caminar por el piso: da vuelta contra una pared o al borde de un precipicio */
function caminar(m, b, v, perseguir) {
  if (perseguir) b.dir = sig(m.p.x + 4 - (b.x + b.w / 2)) || b.dir;
  const suelo = pisaLM(m, b);
  if (suelo) {
    const adelante = b.dir > 0 ? b.x + b.w : b.x - 1;
    const hayPiso = chocaLM(m, adelante, b.y + b.h, 1, 2) || sobrePlatLM(m, adelante, b.y, 1, b.h);
    if (!hayPiso || chocaLM(m, adelante, b.y, 1, b.h - 1)) b.dir = -b.dir;
  }
  moverXLM(m, b, b.dir * v * DT, () => { b.dir = -b.dir; });
  b.vy = Math.min(300, b.vy + 900 * DT);
  moverYLM(m, b, b.vy * DT, () => { b.vy = 0; });
}

function pasarBalas(m) {
  const p = m.p;
  for (let i = m.balas.length - 1; i >= 0; i--) {
    const b = m.balas[i];
    b.vida -= DT;
    b.vy += (b.g || 0) * DT;
    b.x += b.vx * DT; b.y += b.vy * DT;
    if (b.tipo === 'onda') { b.y = b.y0; }
    const choca = b.tipo !== 'onda' && b.tipo !== 'roca' && solidoLM(m, Math.floor(b.x / 8), Math.floor(b.y / 8));
    if (b.tipo === 'roca' && solidoLM(m, Math.floor(b.x / 8), Math.floor((b.y + b.r) / 8))) { b.vida = 0; eventoLM(m, 'rocaCae', { x: b.x, y: b.y }); }
    if (choca) { b.vida = 0; eventoLM(m, 'bala', { x: b.x, y: b.y, tipo: b.tipo }); }
    else if (!p.muerta && b.aviso <= 0 !== false && cruza(p.x + 1, p.y + 1, p.w - 2, p.h - 2, b.x - b.r, b.y - (b.alto || b.r), b.r * 2, (b.alto || b.r) * 2)) {
      if (lastimar(m, b.x, b.danio || 1)) b.vida = b.tipo === 'onda' ? b.vida : 0;
    }
    if (b.aviso > 0) b.aviso -= DT;
    if (b.vida <= 0 || b.y > m.h * 8 + 40 || b.x < -40 || b.x > m.w * 8 + 40) m.balas.splice(i, 1);
  }
}
