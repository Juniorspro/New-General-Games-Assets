/* ============================================================================
   brillo/js/juego.js — un nivel andando: la física, la cámara y el dibujo.
   Dibuja en orden: el fondo (parallax), las burbujas de atrás, el piso, lo
   que está en el piso (tablones, hongos, bloques planos, estática), las
   cosas (gotitas, guiños, sesiones, el orbe, plataformas, burbujas grandes,
   planitos), los vecinos, Nick, los efectos, el agua (encima: todo lo que
   está adentro queda teñido) y lo de adelante (pasto y burbujas grandes).
   ========================================================================== */
import { crearMundo, paso, revivir, baldosa, B, T, K, NADA, plataformaEn, burbujasDe, planitoEn, auroraBrilla, auroraFalta } from './fisica.js';
import { NIVELES } from './niveles.js';
import { Fondo } from './fondos.js';
import { pintarNivel } from './tiles.js';
import { cuadro, cuadrosDe } from './personajes.js';
import { gota, guino, sesion, orbe, plataforma, tablon, hongo, planito, bloquePlano, estatica, aurora } from './objetos.js';
import { BurbujasAmbiente, pastoFrente, Destellos, burbuja } from './efectos.js';

const suave = (k, dt) => 1 - Math.pow(k, dt * 60);

export class Nivel {
  constructor(id, o = {}) {
    this.id = id;
    const N = this.N = NIVELES[id];
    this.m = crearMundo(N, o);
    this.fondo = new Fondo(N.mundo, 7);
    const m = this.m;
    this.capa = pintarNivel(m.W, m.H, (x, y) => m.tiles[y * m.W + x] === B.PISO, N.estilo || 'colina');
    /* lo que se dibuja encima del piso, baldosa por baldosa */
    this.encima = [];
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const b = m.tiles[y * m.W + x];
      if (b === B.TABLON || b === B.PLANO || b === B.ESTATICA || b === B.HONGO || b === B.AURORA) this.encima.push({ x, y, b, i: y * m.W + x });
    }
    /* el agua, en tiras por fila (para teñir y dibujar la superficie) */
    this.agua = [];
    for (let y = 0; y < m.H; y++) { let a = -1; for (let x = 0; x <= m.W; x++) { const es = x < m.W && m.tiles[y * m.W + x] === B.AGUA; if (es && a < 0) a = x; if (!es && a >= 0) { this.agua.push({ x0: a, x1: x, y, sup: y === 0 || m.tiles[(y - 1) * m.W + a] !== B.AGUA }); a = -1; } } }
    this.npcs = (N.npcs || []).map((v) => ({ ...v, anim: 'quieto', f: 0, habla: false, visible: v.visible !== false }));
    this.cam = { x: 0, y: 0 }; this.mira = 0;
    this.burbujas = new BurbujasAmbiente(N.burbujas ?? 34, 11);
    this.pasto = pastoFrente(900, 5, N.mundo);
    this.fx = new Destellos();
    this.ondas = []; this.trozos = []; this.letreros = []; this.pops = [];
    this.t = 0; this.sacudon = 0; this.hongoAplaste = new Map();
    this.quieto = false; this.alEvento = null;
    /* los que aparecen en las escenas (el Plano): { x, y (los pies), img(t), visible } */
    this.actores = []; this.orbeTomado = false;
    this.parpado = 0; this.tParpado = 2;
    this.fase = 0; this.tAterriza = 0;
    this.camara(0, true);
  }

  /* ---------------- un paso de física (60 por segundo) ---------------- */
  paso(inp) {
    const m = this.m;
    if (this.quieto) return;
    paso(m, this.entrada ? this.entrada(m.p) : inp || NADA);
    if (m.p.muerto && m.p.tMuerto > K.MUERTO) revivir(m);
    for (const e of m.eventos) this.efecto(e);
    m.eventos.length = 0;
  }
  efecto(e) {
    const m = this.m, p = m.p;
    switch (e.t) {
      case 'zumbido':
        this.ondas.push({ x: e.x, y: e.y, t: 0 }); this.sacudon = Math.max(this.sacudon, 0.25);
        for (const [tx, ty] of e.rotos) this.romper(tx, ty);
        break;
      case 'restaura': this.pops.push({ x: e.x, y: e.y, t: 0 }); this.fx.soltar(e.x, e.y, 12, { v: 70, col: '#ffffff' }); break;
      case 'gota': this.fx.soltar(e.x, e.y, 5, { v: 35, col: '#c8f6fd', tam: 1 }); this.letreros.push({ x: e.x, y: e.y - 6, t: 0, txt: '+1' }); break;
      case 'guino': this.fx.soltar(e.x, e.y, 18, { v: 80, col: '#fff5b8' }); this.ondas.push({ x: e.x, y: e.y, t: 0, dorada: true }); break;
      case 'sesion': this.fx.soltar(e.x, e.y - 14, 14, { v: 60, col: '#a6ee6a' }); break;
      case 'hongo': this.hongoAplaste.set(Math.floor(e.x / T), 12); break;
      case 'aterriza': this.tAterriza = 0.1; break;
      case 'muere': this.sacudon = 0.3; break;
      case 'revive': this.fx.soltar(e.x, e.y - 14, 16, { v: 60, col: '#8cc8ff' }); break;
      case 'agua': case 'saleAgua': this.fx.soltar(e.x, Math.floor(e.y / T) * T, 10, { v: 55, col: '#c8f6fd', sube: 40, tam: 1 }); break;
      case 'burbuja': case 'entra': case 'sale': this.fx.soltar(e.x, e.y, 6, { v: 30, col: '#ffffff', tam: 1 }); break;
    }
    if (this.alEvento) this.alEvento(e, this);
  }
  /* un bloque plano se rompe: los pedazos grises saltan y se vuelven burbujas de colores */
  romper(tx, ty) {
    for (let i = 0; i < 6; i++) this.trozos.push({ x: tx * T + 4 + (i % 3) * 4, y: ty * T + 4 + Math.floor(i / 3) * 6, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, t: 0, col: ['#ff82ba', '#6fd845', '#55a5fb', '#ffdb2e', '#a67bfb', '#4fd8f2'][i] });
  }

  /* ---------------- la cámara ---------------- */
  camara(dt, ya) {
    const p = this.m.p, m = this.m;
    const w = this.w || 640, h = this.h || 360;
    this.mira += ((Math.abs(p.vx) > 0.6 ? p.dir * 46 : this.mira * 0.9 / 46 * 46) - this.mira) * (ya ? 1 : suave(0.965, dt));
    let tx = p.x - w / 2 + this.mira, ty = p.y - h * 0.6;
    if (this.encuadre) { tx = this.encuadre.x - w / 2; ty = this.encuadre.y - h / 2; }
    tx = Math.max(0, Math.min(m.W * T - w, tx));
    ty = Math.max(0, Math.min(m.H * T - h, ty));
    if (m.H * T < h) ty = (m.H * T - h) / 2;
    const k = ya ? 1 : suave(this.encuadre ? 0.95 : 0.88, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * (ya ? 1 : suave(0.92, dt));
  }

  /* ---------------- lo que se anima con el tiempo real ---------------- */
  cuadro(dt) {
    this.t += dt;
    this.camara(dt);
    this.fx.pasar(dt);
    for (const o of this.ondas) o.t += dt;
    this.ondas = this.ondas.filter((o) => o.t < 0.5);
    for (const q of this.trozos) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; }
    this.trozos = this.trozos.filter((q) => q.t < 1.1);
    for (const q of this.letreros) q.t += dt;
    this.letreros = this.letreros.filter((q) => q.t < 0.8);
    for (const q of this.pops) q.t += dt;
    this.pops = this.pops.filter((q) => q.t < 1.4);
    this.sacudon = Math.max(0, this.sacudon - dt);
    this.tAterriza -= dt;
    for (const [k, v] of this.hongoAplaste) { if (v <= 0) this.hongoAplaste.delete(k); else this.hongoAplaste.set(k, v - 1); }
    /* el parpadeo */
    this.tParpado -= dt;
    if (this.tParpado < 0) { this.parpado = 0.12; this.tParpado = 2 + Math.random() * 3; }
    if (this.parpado > 0) this.parpado -= dt;
    const p = this.m.p;
    this.fase += Math.abs(p.vx) * dt * 60;
  }

  /* qué dibujo le toca a Nick */
  poseNick() {
    const p = this.m.p, t = this.t;
    if (p.muerto) return ['gris', 'triste', Math.floor(t * 4)];
    if (p.enBurbuja || p.flotando) return ['nick', 'flota', Math.floor(t * 6)];
    if (p.zumbido > 0) return ['nick', 'zumbido', Math.floor(t * 30)];
    if (p.enAgua) return ['nick', 'nada', Math.floor(t * 8)];
    if (!p.enSuelo) return ['nick', p.vy < 0 ? 'salta' : 'cae', Math.floor(t * 8)];
    if (this.tAterriza > 0) return ['nick', 'aterriza', 0];
    if (Math.abs(p.vx) > 0.4) return ['nick', 'corre', Math.floor(this.fase / 7)];
    if (this.parpado > 0) return ['nick', 'parpadea', 0];
    return ['nick', this.gestoNick || 'quieto', Math.floor(t * 6)];
  }

  /* ---------------- dibujar ---------------- */
  dibujar(g, w, h) {
    this.w = w; this.h = h;
    const m = this.m, t = this.t;
    const sac = this.sacudon > 0 ? Math.round((Math.random() - 0.5) * this.sacudon * 16) : 0;
    const cam = { x: Math.round(this.cam.x) + sac, y: Math.round(this.cam.y) };
    this.fondo.atras(g, cam, t, w, h, (m.H * T - h));
    this.burbujas.dibujar(g, cam, t, w, h, 'atras');
    this.capa.dibujar(g, cam, w, h);
    const X = (x) => Math.round(x - cam.x), Y = (y) => Math.round(y - cam.y);
    const f = Math.floor(t * 8);
    /* lo que está en las baldosas */
    for (const q of this.encima) {
      const x = q.x * T - cam.x, y = q.y * T - cam.y;
      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
      if (q.b === B.AURORA) aurora(g, Math.round(x), Math.round(y), auroraBrilla(m, q.x, m.t), auroraFalta(m, q.x, m.t), t, q.x);
      else if (q.b === B.TABLON) { const izq = m.tiles[q.i - 1] !== B.TABLON, der = m.tiles[q.i + 1] !== B.TABLON; g.drawImage(tablon(izq, der), Math.round(x), Math.round(y)); }
      else if (q.b === B.PLANO) { if (!m.rotos.has(q.i)) g.drawImage(bloquePlano(), Math.round(x), Math.round(y)); }
      else if (q.b === B.ESTATICA) estatica(g, Math.round(x), Math.round(y), f);
      else if (q.b === B.HONGO) { const a = this.hongoAplaste.get(q.x) || 0; g.drawImage(hongo(a > 8 ? 1 : a > 4 ? 2 : a > 0 ? 3 : 0), Math.round(x - 2), Math.round(y - 2)); }
    }
    /* las plataformas que se mueven y las burbujas grandes */
    for (const q of m.plataformas) { const a = plataformaEn(q, m.t); g.drawImage(plataforma(q.w), X(a.x), Y(a.y)); }
    for (const q of m.burbujeros) {
      g.fillStyle = '#e6eff7'; g.fillRect(X(q.x - 8), Y(q.y + 4), 16, 6);
      for (const b of burbujasDe(q, m.t)) { const img = burbuja(b.r); g.globalAlpha = 0.9; g.drawImage(img, X(b.x - img.width / 2), Y(b.y - img.height / 2)); g.globalAlpha = 1; }
    }
    /* gotitas, guiños, sesiones y el orbe */
    for (const q of m.gotas) if (!q.tomada) g.drawImage(gota(f + (q.x >> 4)), X(q.x - 5), Y(q.y - 7 + Math.sin(t * 3 + q.x * 0.1) * 1.5));
    for (const q of m.guinos) if (!q.tomado) { const img = guino(Math.floor(t * 1.5) % 3 === 0 ? 1 : 0); g.drawImage(img, X(q.x - 10), Y(q.y - 10 + Math.sin(t * 2.2) * 2)); }
    for (const s of m.sesiones) g.drawImage(sesion(m.p.checkpoint.id === s.id, f), X(s.x - 12), Y(s.y - 28));
    if (m.salida && !this.orbeTomado) { const img = orbe(this.N.mundo, Math.floor(t * 6)); g.drawImage(img, X(m.salida.x - 18), Y(m.salida.y - 44 + Math.sin(t * 1.6) * 3)); }
    /* los planitos */
    for (const q of m.planitos) { if (m.restaurados.has(q.id)) continue; const e = planitoEn(q, m.t); g.drawImage(planito(Math.floor(m.t / 12), e.dir), X(e.x - 8), Y(e.y - 16)); }
    /* los vecinos */
    for (const v of this.npcs) if (v.visible) g.drawImage(cuadro(v.id, v.anim, Math.floor(t * (v.anim === 'habla' ? 8 : 6)), v.mira < 0), X(v.x - 15), Y(v.y - 35));
    for (const a of this.actores) if (a.visible !== false) { const img = a.img(t); g.drawImage(img, X(a.x - img.width / 2), Y(a.y - img.height)); }
    /* Nick */
    const p = m.p;
    const [quien, anim, fr] = this.poseNick();
    const muerto = p.muerto;
    if (!muerto || p.tMuerto < 40) {
      g.globalAlpha = muerto ? Math.max(0, 1 - p.tMuerto / 40) : 1;
      g.drawImage(cuadro(quien, anim, fr, p.dir < 0), X(p.x - 15), Y(p.y - 35 + (muerto ? -p.tMuerto * 0.3 : 0)));
      g.globalAlpha = 1;
    }
    if (p.flotando || p.enBurbuja) { const img = burbuja(p.enBurbuja ? 22 : 19); g.globalAlpha = 0.85; g.drawImage(img, X(p.x - img.width / 2), Y(p.y - p.h / 2 - img.height / 2 - 2)); g.globalAlpha = 1; }
    /* los efectos */
    for (const o of this.ondas) {
      const r = 6 + o.t * (o.dorada ? 90 : 140), a = 1 - o.t / 0.5;
      g.globalAlpha = a * 0.9; g.strokeStyle = o.dorada ? '#fff5b8' : '#c9e7ff'; g.lineWidth = 2;
      g.beginPath(); g.arc(X(o.x), Y(o.y), r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = a * 0.5; g.beginPath(); g.arc(X(o.x), Y(o.y), r * 0.7, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    }
    for (const q of this.trozos) {
      const k = Math.min(1, q.t / 0.5);
      if (k < 1) { g.fillStyle = '#9aa0a8'; g.fillRect(X(q.x), Y(q.y), 4, 4); }
      const img = burbuja(3 + k * 2); g.globalAlpha = k * (1 - Math.max(0, q.t - 0.8) / 0.3);
      g.drawImage(img, X(q.x - img.width / 2), Y(q.y - img.height / 2)); g.globalAlpha = 1;
      if (k >= 1) { g.fillStyle = q.col; g.globalAlpha = 0.5; g.fillRect(X(q.x) - 1, Y(q.y) - 1, 2, 2); g.globalAlpha = 1; }
    }
    for (const q of this.pops) {
      /* un planito restaurado: estalla en burbujitas de colores que suben */
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, r = 4 + q.t * 30;
        const img = burbuja(2 + (i % 3));
        g.globalAlpha = Math.max(0, 1 - q.t / 1.4);
        g.drawImage(img, X(q.x + Math.cos(a) * r - img.width / 2), Y(q.y + Math.sin(a) * r * 0.6 - q.t * 40 - img.height / 2));
      }
      g.globalAlpha = 1;
    }
    this.fx.dibujar(g, cam);
    g.font = 'bold 8px sans-serif'; g.textAlign = 'center';
    for (const q of this.letreros) { g.globalAlpha = 1 - q.t / 0.8; g.fillStyle = '#ffffff'; g.fillText(q.txt, X(q.x), Y(q.y - q.t * 20)); }
    g.globalAlpha = 1;
    /* el agua, encima de todo lo que tiene adentro */
    const mar = !!this.N.mar;
    for (const a of this.agua) {
      const x0 = X(a.x0 * T), x1 = X(a.x1 * T), y0 = Y(a.y * T);
      if (x1 < 0 || x0 > w || y0 > h || y0 < -T) continue;
      g.fillStyle = a.sup ? 'rgba(60,190,240,0.38)' : mar ? 'rgba(40,170,230,0.14)' : 'rgba(30,150,220,0.45)';
      g.fillRect(x0, y0, x1 - x0, T);
      /* donde el agua toca el aire de costado (las cúpulas), un filo de vidrio */
      if (mar) {
        g.fillStyle = 'rgba(225,250,255,0.55)';
        if (m.tiles[a.y * m.W + a.x0 - 1] === B.VACIO) g.fillRect(x0, y0, 1, T);
        if (a.x1 < m.W && m.tiles[a.y * m.W + a.x1] === B.VACIO) g.fillRect(x1 - 1, y0, 1, T);
      }
      if (a.sup) {
        /* la superficie que se mueve, con su filo de luz */
        for (let x = x0; x < x1; x++) {
          const o = Math.round(Math.sin((x + cam.x) * 0.18 + t * 3) * 1.2 + Math.sin((x + cam.x) * 0.07 - t * 1.7));
          g.fillStyle = 'rgba(230,250,255,0.85)'; g.fillRect(x, y0 + o, 1, 1);
          g.fillStyle = 'rgba(160,230,255,0.5)'; g.fillRect(x, y0 + o + 1, 1, 2);
        }
      } else {
        /* la luz del fondo (cáusticas) que se mueve */
        const pas = mar ? 4 : 2, xa = Math.max(x0, 0), xb = Math.min(x1, w);
        g.fillStyle = 'rgba(210,250,255,0.35)';
        for (let x = xa - ((xa + cam.x) % pas + pas) % pas; x < xb; x += pas) for (let y = y0; y < y0 + T; y += pas) {
          const c = Math.sin((x + cam.x) * 0.23 + t * 1.3) + Math.sin((y + cam.y) * 0.31 - t * 1.1) + Math.sin((x + y + cam.x) * 0.11 + t);
          if (c > 2.2) g.fillRect(x, y, pas, 1);
        }
      }
    }
    /* lo de adelante: pasto alto y burbujas grandes */
    if (this.pasto) {
      const per = this.pasto.width, ox = -(((cam.x * 1.25) % per) + per) % per;
      const yp = h - this.pasto.height + 30 + Math.round((m.H * T - h - cam.y) * 1.25);
      if (yp < h) for (let x = Math.round(ox); x < w; x += per) g.drawImage(this.pasto, x, yp);
    }
    this.burbujas.dibujar(g, cam, t, w, h, 'frente');
    this.camVista = cam;
  }
  /* dónde está algo del mundo en la pantalla del juego */
  aPantalla(x, y) { const c = this.camVista || this.cam; return { x: x - c.x, y: y - c.y }; }
}
