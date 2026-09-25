/* ============================================================================
   aeroplaza/js/delirio.js — LO EXTREMO DEL RUNNER (26/09: "el break core está
   god, me gustaría que fuera aún más extremo como el vídeo, con algún que otro
   screamer o letras estilo despierta, o wake up"). Un lienzo 2D arriba del
   juego (debajo de los botones) que dibuja, con la canción:
   - los SUSTOS: la cara de assets/susto.webp de golpe, cortada en tiras, con un
     grito sintetizado (tres, en golpes fuertes: 20,1 · 32,1 · 47,5 s, antes de que llegue el que corre bien).
     Se apagan en Opciones › Juego (G.opciones.sustos) y avisa al entrar.
   - las PALABRAS: DESPIERTA / WAKE UP / ACORDA… gigantes en cada golpe fuerte,
     con el rojo y el celeste corridos, tiras que saltan y líneas de tele; en
     los golpes medianos, una palabra de un cuadro (subliminal).
   - el RASTREO (el "blob tracking" de los edits): cajas de esquinas con su
     x:### y:###, líneas punteadas entre una y otra, y alguna con los colores
     dados vuelta. Siguen las cosas de la pista (runner.js › rastreables()).
   - el ARRASTRE: tiras de píxeles estirados para abajo (se copia el lienzo
     del juego en el mismo cuadro, antes de que se borre) y el eco del cuadro
     anterior en diferencia cuando ya está todo roto.
   - la CONSOLA: abajo a la izquierda se escribe sola (despertar.exe…).
   main.js: cuadro() después de dibujar; si el runner congela un cuadro (no se
   dibuja) no se copia el lienzo del juego, porque ya está vacío.
   ========================================================================== */
import * as THREE from 'three';
import { Sonido } from '../../brillo/js/sonido.js';
import { TEX } from './naturaleza.js';
import { sumar, t } from './textos.js';

sumar({
  es: { dl_palabras: 'DESPIERTA|¿SEGUÍS AHÍ?|NO ES REAL|CORRÉ|NO MIRES ATRÁS|ESTÁS SOÑANDO|DESPIERTA|NO TE DETENGAS', dl_figura: 'NO MIRES ATRÁS',
    dl_consola: 'C:\\AERO> iniciar sueño.exe|cargando cielo… OK|cargando cielo… ERROR 0x000F7A|la realidad no responde|¿seguís ahí?|no es real|despierta|despierta|DESPIERTA', dl_aviso: '⚠ destellos y sustos (se apagan en Opciones)', op_sustos: 'Sustos del runner' },
  en: { dl_palabras: 'WAKE UP|ARE YOU STILL THERE?|IT\'S NOT REAL|RUN|DON\'T LOOK BACK|YOU ARE DREAMING|WAKE UP|DON\'T STOP', dl_figura: 'DON\'T LOOK BACK',
    dl_consola: 'C:\\AERO> start dream.exe|loading sky… OK|loading sky… ERROR 0x000F7A|reality is not responding|are you still there?|it\'s not real|wake up|wake up|WAKE UP', dl_aviso: '⚠ flashes and jump scares (turn them off in Options)', op_sustos: 'Runner jump scares' },
  pt: { dl_palabras: 'ACORDA|VOCÊ AINDA ESTÁ AÍ?|NÃO É REAL|CORRA|NÃO OLHE PRA TRÁS|VOCÊ ESTÁ SONHANDO|ACORDA|NÃO PARE', dl_figura: 'NÃO OLHE PRA TRÁS',
    dl_consola: 'C:\\AERO> iniciar sonho.exe|carregando céu… OK|carregando céu… ERRO 0x000F7A|a realidade não responde|você ainda está aí?|não é real|acorda|acorda|ACORDA', dl_aviso: '⚠ flashes e sustos (desligue em Opções)', op_sustos: 'Sustos do runner' },
});

/* los sustos van en los golpes más fuertes de la canción (segundos desde el ¡YA!) */
export const SUSTOS = [20.1, 32.1, 47.5];   // (el que corre bien llega a los 52 s)
const INGLES = ['WAKE UP', 'WAKE UP', 'IT\'S NOT REAL', 'RUN', 'ERROR', 'AERO.EXE', 'SIGNAL LOST', '0xDEAD'];
const LETRA = '900 {n}px Impact, "Arial Black", "Helvetica Neue", sans-serif';
const azar = (a, b) => a + Math.random() * (b - a);

export class Delirio {
  constructor(motor, raiz) {
    this.motor = motor;
    const c = this.cv = document.createElement('canvas'); c.className = 'delirio';
    (raiz || document.getElementById('app') || document.body).appendChild(c);
    this.g = c.getContext('2d');
    this.eco = document.createElement('canvas'); this.eg = this.eco.getContext('2d');
    this.activo = false; this.W = 0; this.H = 0; this.k = 1;
    this.alSusto = null; this.alGolpe = null;
    this.reiniciar();
  }
  reiniciar() {
    this.hechos = new Set(); this.palabra = null; this.susto = null; this.tPal = 0; this.nPal = 0; this.arrastre = []; this.cajasInv = [];
    this.consola = []; this.tConsola = 0; this.nConsola = 0; this.idx = -1; this.tEco = 0; this.hayEco = false;
    this.stats = { sustos: 0, palabras: 0, sublim: 0, cajas: 0, ultima: '' };
  }
  get sustosPrendidos() { return window.__A?.G?.opciones?.sustos !== false; }
  apagar() { this.activo = false; this.cv.classList.remove('on'); this.g.clearRect(0, 0, this.cv.width, this.cv.height); }
  medir() {
    const W = this.motor.ancho || innerWidth, H = this.motor.alto || innerHeight, k = Math.min(this.motor.dpr || 1, 1.5);
    if (W === this.W && H === this.H && k === this.k) return;
    this.W = W; this.H = H; this.k = k;
    this.cv.width = Math.round(W * k); this.cv.height = Math.round(H * k);
    this.eco.width = Math.max(2, Math.round(W / 2)); this.eco.height = Math.max(2, Math.round(H / 2)); this.hayEco = false;
  }
  /* lo que se dice: en el idioma del juego, y a veces en inglés (como en el video) */
  proxima() {
    const L = t('dl_palabras').split('|'), n = this.nPal++;
    return n % 3 === 2 ? INGLES[(n / 3 | 0) % INGLES.length] : L[(n - (n / 3 | 0)) % L.length];
  }
  decir(texto, o = {}) {
    this.palabra = { texto, t: 0, dur: o.dur ?? azar(0.3, 0.5), tam: o.tam ?? 1, sub: !!o.sub, inv: !!o.inv, x: o.x ?? 0.5, y: o.y ?? 0.46, color: o.color || '#ffffff', semilla: Math.random() * 99 };
    if (o.sub) this.stats.sublim++; else { this.stats.palabras++; this.stats.ultima = texto; }
  }
  asustar() {
    this.susto = { t: 0, dur: 0.46, semilla: Math.random() * 99 };
    this.stats.sustos++;
    grito();
    this.alSusto?.();
  }

  /* un cuadro: R es el reino (el runner), cam la cámara, dibujar si se dibuja en pantalla,
     fresco si el lienzo del juego se dibujó en este mismo cuadro (se puede copiar) */
  cuadro(dt, R, cam, dibujar, fresco) {
    if (!R || !R.runner) { if (this.activo) this.apagar(); return; }
    if (!this.activo) { this.activo = true; this.cv.classList.add('on'); this.reiniciar(); }
    const E = R.runner, tm = E.fase === 'cuenta' ? 0 : E.tiempo, C = R.corrupcion || 0, P = R.pulsoAct || 0;
    if (E.fase === 'cuenta' && this.hechos.size) this.reiniciar();
    const corre = E.fase === 'corre', nuevo = tm !== this.tmAntes; this.tmAntes = tm;
    /* ---- los sustos, a su hora */
    if (corre && this.sustosPrendidos) for (const s of SUSTOS) if (tm >= s && tm < s + 0.6 && !this.hechos.has(s)) { this.hechos.add(s); this.asustar(); this.decir(s === SUSTOS[1] ? 'WAKE UP' : this.proxima(), { dur: 0.7, tam: 1.15, color: '#ff2a3c' }); }
    /* ---- los golpes de la canción (runner.js los marca: R.golpe 2 fuerte, 1 mediano) */
    this.tPal -= dt;
    if (R.golpe && nuevo && corre && C > 0.2) {
      if (R.golpe >= 2 && this.tPal <= 0 && !this.susto) { this.tPal = 0.62; this.decir(this.proxima(), { tam: azar(0.85, 1.1), inv: C > 0.55 && this.sustosPrendidos && Math.random() < 0.35 }); }
      else if (R.golpe === 1 && C > 0.3 && !this.palabra) this.decir(this.proxima(), { sub: true, dur: 0.07, tam: azar(0.35, 0.6), x: azar(0.2, 0.8), y: azar(0.25, 0.75) });
      /* tiras de píxeles estirados y cajas dadas vuelta */
      if (C > 0.3) for (let i = 0; i < (R.golpe >= 2 ? 2 : 1); i++) this.arrastre.push({ y: azar(0.15, 0.85), h: azar(0.03, 0.12) * (R.golpe >= 2 ? 1.5 : 1), t: 0, dur: azar(0.08, 0.18) });
      this.cajasInv = [Math.random() * 8 | 0, Math.random() * 8 | 0]; this.tInv = 0.18;
    }
    if (R.figura) { this.decir(t('dl_figura'), { dur: 0.5, tam: 0.55, color: '#ff2a3c', y: 0.3 }); R.figura = 0; }
    this.tInv = Math.max(0, (this.tInv || 0) - dt);
    /* ---- la consola se escribe sola desde un poco antes del drop */
    if (corre && tm > 13.5 && C < 0.99 && !E.fin) {
      this.tConsola -= dt;
      const L = t('dl_consola').split('|');
      if (this.tConsola <= 0 && this.nConsola < L.length) { this.consola.push({ s: L[this.nConsola++], n: 0 }); if (this.consola.length > 6) this.consola.shift(); this.tConsola = this.nConsola < 3 ? 2.6 : azar(3.2, 5.2); }
      for (const q of this.consola) q.n = Math.min(q.s.length, q.n + dt * 26);
    }
    if (this.palabra) { this.palabra.t += dt; if (this.palabra.t > this.palabra.dur) this.palabra = null; }
    if (this.susto) { this.susto.t += dt; if (this.susto.t > this.susto.dur) this.susto = null; }
    for (const a of this.arrastre) a.t += dt;
    this.arrastre = this.arrastre.filter((a) => a.t < a.dur);
    /* ---- las cajas del rastreo (se calculan aunque no se dibuje: las pruebas las cuentan) */
    const cajas = this.rastrear(R, cam, C);
    this.stats.cajas = cajas.length;
    if (!dibujar) return;
    this.medir();
    this.dibujar(dt, C, P, cajas, fresco, tm, E);
  }

  rastrear(R, cam, C) {
    if (C < 0.25 || !cam || !R.rastreables) return [];
    const yo = window.__A?.yo, jp = yo ? yo.p : null, out = [], v = new THREE.Vector3();
    const lista = R.rastreables(); lista.sort((a, b) => (b.raro ? 1 : 0) - (a.raro ? 1 : 0));   // (las figuras primero)
    for (const q of lista) {
      if (jp && (q.z < jp.z + 5 || q.z > jp.z + 120)) continue;
      v.set(q.x, q.y, q.z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      const d = jp ? Math.hypot(q.x - jp.x, q.y - jp.y, q.z - jp.z) : 30, sx = (v.x + 1) / 2, sy = (1 - v.y) / 2;
      /* (las de lejos se amontonan en el medio: una sola por lugar) */
      if (out.some((o) => Math.abs(o.sx - sx) < 0.07 && Math.abs(o.sy - sy) < 0.09)) continue;
      out.push({ sx, sy, d, tipo: q.tipo, id: q.id, raro: q.raro });
      if (out.length >= 7) break;
    }
    return out.sort((a, b) => a.d - b.d);
  }

  dibujar(dt, C, P, cajas, fresco, tm, E) {
    const { g, W, H, k } = this, gl = this.motor.r?.domElement, kg = gl ? gl.width / Math.max(1, W) : 1;
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    /* el eco del cuadro anterior (en diferencia): ya casi todo roto */
    if (fresco && gl && C > 0.6) {
      if (this.hayEco) { g.globalAlpha = Math.min(0.45, (C - 0.6) * 1.1) * (0.6 + P * 0.6); g.globalCompositeOperation = 'difference'; g.drawImage(this.eco, 0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      this.tEco -= dt; if (this.tEco <= 0) { this.tEco = 0.09; try { this.eg.drawImage(gl, 0, 0, this.eco.width, this.eco.height); this.hayEco = true; } catch { this.hayEco = false; } }
    }
    /* el arrastre: una fila del juego estirada para abajo */
    if (fresco && gl) for (const a of this.arrastre) {
      const y = a.y * H, h = a.h * H * Math.min(1, a.t / 0.04 + 0.3);
      try { g.drawImage(gl, 0, Math.floor(y * kg), gl.width, 2, 0, y, W, h); } catch { /* sin copia */ }
      g.fillStyle = 'rgba(255,0,220,0.08)'; g.fillRect(0, y, W, 1.5);
    }
    if (cajas.length) this.dibujarRastreo(g, W, H, C, P, cajas, fresco, gl, kg, tm);
    if (this.consola.length) this.dibujarConsola(g, W, H, C);
    if (this.susto) this.dibujarSusto(g, W, H, this.susto, fresco, gl, kg);
    if (this.palabra) this.dibujarPalabra(g, W, H, this.palabra);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  dibujarRastreo(g, W, H, C, P, cajas, fresco, gl, kg, tm) {
    const a = Math.min(1, (C - 0.25) / 0.15), fs = Math.max(8, Math.round(Math.min(W, H) / 60));
    g.font = `600 ${fs}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`; g.textBaseline = 'top';
    const pts = cajas.map((q) => ({ ...q, x: Math.round(q.sx * W / 3) * 3, y: Math.round(q.sy * H / 3) * 3, h: Math.max(10, Math.min(H * 0.2, H * 2.4 / Math.max(3, q.d))) }));
    /* las líneas entre una y otra */
    g.globalAlpha = a * 0.7; g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.setLineDash([3, 5]); g.lineDashOffset = -tm * 40;
    g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
    if (pts.length > 2) { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); g.lineTo(pts[2].x, pts[2].y); g.stroke(); }
    g.setLineDash([]);
    pts.forEach((q, i) => {
      const { x, y, h } = q, rojo = q.raro, col = rojo ? '#ff2a3c' : '#ffffff';
      /* alguna con lo de adentro dado vuelta (en el golpe) */
      if (fresco && gl && this.tInv > 0 && this.cajasInv.includes(i)) {
        g.globalAlpha = a; try { g.drawImage(gl, (x - h) * kg, (y - h) * kg, 2 * h * kg, 2 * h * kg, x - h, y - h, 2 * h, 2 * h); } catch { /* sin copia */ }
        g.globalCompositeOperation = 'difference'; g.fillStyle = '#ffffff'; g.fillRect(x - h, y - h, 2 * h, 2 * h); g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = rojo || this.tInv > 0 ? 2 : 1.25;
      const L = h * 0.38; g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = x + sx * h, cy = y + sy * h; g.moveTo(cx, cy - sy * L); g.lineTo(cx, cy); g.lineTo(cx - sx * L, cy); }
      g.stroke();
      g.fillStyle = col; g.fillRect(x - 1.5, y - 1.5, 3, 3);
      const et = rojo ? '??? 0x0000' : `${q.tipo.toUpperCase()}_${String(q.id).padStart(2, '0')}`, xy = `x:${String(Math.round(q.sx * 1000)).padStart(4, '0')} y:${String(Math.round(q.sy * 1000)).padStart(4, '0')}`;
      const wt = Math.max(g.measureText(et).width, g.measureText(xy).width) + 6;
      g.globalAlpha = a * 0.75; g.fillStyle = '#000000'; g.fillRect(x - h, y - h - fs * 2.3, wt, fs * 2.2);
      g.globalAlpha = a; g.fillStyle = col; g.fillText(et, x - h + 3, y - h - fs * 2.2); g.fillText(xy, x - h + 3, y - h - fs * 1.15);
    });
    g.globalAlpha = 1;
  }

  dibujarConsola(g, W, H, C) {
    const fs = Math.max(9, Math.round(Math.min(W, H) / 48)), x = 14, y0 = H - 16 - fs * 1.35 * this.consola.length - H * 0.12;
    g.font = `600 ${fs}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`; g.textBaseline = 'top';
    this.consola.forEach((q, i) => {
      const s = q.s.slice(0, Math.floor(q.n)), ult = i === this.consola.length - 1, rojo = /ERROR|ERRO|DESPIERTA|WAKE UP|ACORDA/.test(q.s);
      g.globalAlpha = 0.35 + 0.65 * ((i + 1) / this.consola.length);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x - 4, y0 + i * fs * 1.35 - 2, g.measureText(q.s).width + 16, fs * 1.3);
      g.fillStyle = rojo ? '#ff3b55' : C > 0.5 && Math.random() < 0.05 ? '#ff00dc' : '#bfffe9';
      g.fillText(s + (ult && Math.floor(performance.now() / 300) % 2 ? '█' : ''), x, y0 + i * fs * 1.35);
    });
    g.globalAlpha = 1;
  }

  dibujarPalabra(g, W, H, p) {
    const u = p.t / p.dur;
    /* el final titila */
    if (u > 0.6 && Math.floor(p.t * 30) % 2) return;
    let fs = Math.min(H * 0.3, W * 0.2) * p.tam;
    g.font = LETRA.replace('{n}', Math.round(fs)); const ancho = g.measureText(p.texto).width;
    if (ancho > W * 0.94) { fs *= W * 0.94 / ancho; g.font = LETRA.replace('{n}', Math.round(fs)); }
    const pop = 1 + Math.max(0, 1 - p.t / 0.08) * 0.18, cx = p.x * W + azar(-3, 3), cy = p.y * H + azar(-3, 3);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (p.inv) { g.globalAlpha = 0.92; g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); }
    g.save(); g.translate(cx, cy); g.scale(pop, pop);
    /* tiras que saltan de costado (cambian cada dos cuadros) */
    const N = p.sub ? 3 : 7, hT = fs * 1.1 / N, f = Math.floor(p.t * 30 / 2);
    for (let i = 0; i < N; i++) {
      const r = Math.sin(p.semilla + i * 12.9 + f * 7.3) * 43758.5453, dx = ((r - Math.floor(r)) - 0.5) * fs * (u < 0.2 ? 0.5 : 0.16);
      g.save(); g.beginPath(); g.rect(-W, -fs * 0.55 + i * hT, W * 2, hT + 0.5); g.clip();
      if (p.inv) { g.globalAlpha = 1; g.fillStyle = '#000000'; g.fillText(p.texto, dx, 0); }
      else {
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9;
        g.fillStyle = '#ff0038'; g.fillText(p.texto, dx - fs * 0.05, 0);
        g.fillStyle = '#00f0ff'; g.fillText(p.texto, dx + fs * 0.05, 0);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = p.color; g.fillText(p.texto, dx, 0);
      }
      g.restore();
    }
    /* las líneas de tele encima */
    g.globalAlpha = 0.35; g.fillStyle = '#000000';
    for (let y = -fs * 0.55; y < fs * 0.55; y += 4) g.fillRect(-W / 2, y, W, 1.5);
    g.restore();
    g.globalAlpha = 1; g.textAlign = 'left'; g.textBaseline = 'top';
  }

  dibujarSusto(g, W, H, s, fresco, gl, kg) {
    const u = s.t / s.dur, img = TEX.susto?.image;
    /* primero un destello blanco, después la cara en tiras, cada vez más cerca */
    if (s.t < 0.045) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); return; }
    g.fillStyle = '#000000'; g.globalAlpha = 0.9; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    const lado = Math.max(W, H) * (0.95 + u * 0.4), x0 = (W - lado) / 2 + azar(-12, 12), y0 = (H - lado) / 2 + azar(-12, 12);
    if (img) {
      const N = 11, hT = lado / N, iw = img.width || 512, ih = img.height || 512, f = Math.floor(s.t * 30 / 2);
      for (let i = 0; i < N; i++) {
        const r = Math.sin(s.semilla + i * 7.1 + f * 3.3) * 43758.5453, dx = ((r - Math.floor(r)) - 0.5) * (i % 3 === 0 ? 90 : 24);
        g.drawImage(img, 0, ih * i / N, iw, ih / N, x0 + dx, y0 + i * hT, lado, hT + 1);
      }
      g.globalCompositeOperation = 'difference'; g.globalAlpha = 0.45;
      g.drawImage(img, x0 + 14, y0, lado, lado);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    } else {
      /* sin la imagen: una cara dibujada */
      g.fillStyle = '#39e6ff'; g.beginPath(); g.arc(W / 2, H / 2, lado * 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(W / 2 + s2 * lado * 0.14, H / 2 - lado * 0.08, lado * 0.07, lado * 0.1, 0, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.arc(W / 2, H / 2 + lado * 0.02, lado * 0.24, 0.1 * Math.PI, 0.9 * Math.PI); g.lineWidth = lado * 0.04; g.strokeStyle = '#000'; g.stroke();
    }
    /* barras negras que cortan y el juego que se asoma */
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#000' : 'rgba(255,0,60,0.35)'; g.fillRect(0, azar(0, H), W, azar(2, 14)); }
    if (fresco && gl && u > 0.7) { g.globalAlpha = (u - 0.7) / 0.3; try { g.drawImage(gl, 0, 0, W, H); } catch { /* sin copia */ } g.globalAlpha = 1; }
  }
}

/* el grito: ruido con formantes de "aaa" y dos sierras que suben, saturadas, más un golpe grave */
export function grito() {
  const c = Sonido.ctx, out = Sonido.bEfectos;
  if (!c || !out || c.state !== 'running') return false;
  const t0 = c.currentTime, dur = 0.62;
  const sal = c.createGain(); sal.gain.setValueAtTime(0.0001, t0); sal.gain.exponentialRampToValueAtTime(0.9, t0 + 0.012); sal.gain.setValueAtTime(0.9, t0 + 0.3); sal.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const sat = c.createWaveShaper(), curva = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curva[i] = Math.tanh(x * 5); } sat.curve = curva;
  sat.connect(sal); sal.connect(out);
  /* las sierras (la voz), con vibrato rápido */
  const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 28; vg.gain.value = 38; vib.connect(vg);
  for (const [f, d] of [[520, 0], [781, 7]]) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = d;
    o.frequency.setValueAtTime(f * 0.7, t0); o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.12); o.frequency.exponentialRampToValueAtTime(f * 1.05, t0 + dur);
    vg.connect(o.frequency);
    const g = c.createGain(); g.gain.value = 0.16; o.connect(g); g.connect(sat); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  /* el aire: ruido por los formantes */
  const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const ruido = c.createBufferSource(); ruido.buffer = b;
  for (const [f, q, v] of [[850, 7, 0.9], [1250, 8, 0.7], [2900, 10, 0.5]]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = c.createGain(); g.gain.value = v; ruido.connect(bp); bp.connect(g); g.connect(sat); }
  ruido.start(t0); vib.start(t0); vib.stop(t0 + dur + 0.05);
  /* el golpe grave */
  const bo = c.createOscillator(), bg = c.createGain(); bo.frequency.setValueAtTime(90, t0); bo.frequency.exponentialRampToValueAtTime(28, t0 + 0.4);
  bg.gain.setValueAtTime(0.8, t0); bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45); bo.connect(bg); bg.connect(out); bo.start(t0); bo.stop(t0 + 0.5);
  return true;
}
