/* ============================================================================
   aeroplaza/js/ventanas.js — la pantalla y las ventanas que se tocan con las
   manos (en VR): paneles de vidrio Aero en el mundo, dibujados en un lienzo.
   - LA PANTALLA: el tablero grande con los botones (jugar, abrir ventanas,
     volver a escanear…). Lo que hace cada botón lo decide quien la abre.
   - LAS VENTANAS DE PRUEBA: reloj, pizarra, burbujas y "dónde estoy" (la que
     muestra el 6DoF: cuánto te moviste y a cuánto está). Se agarran por la
     barra con un pellizco y se dejan donde sea; cerca de una pared se pegan.
   - CÓMO SE TOCAN (como un Quest): con la yema del índice (se aprieta al
     cruzar el vidrio), con el rayo y un pellizco, o con la mirada (el punto
     del centro) y un toque en la pantalla o quedándose 1,4 s encima.
   Sirve igual en tu cuarto (js/espacio.js, con ARCore: las ventanas quedan
   donde las dejaste mientras caminás) y en el mundo del juego (sin 6DoF).
   ========================================================================== */
import * as THREE from 'three';
import { t, sumar, idioma } from './textos.js';

sumar({
  es: { vt_pantalla: 'Tu espacio', vt_jugar: 'Jugar AEROPLAZA', vt_reloj: 'Reloj', vt_pizarra: 'Pizarra', vt_burbujas: 'Burbujas', vt_lugar: 'Dónde estoy', vt_escaneo: 'Ver el escaneo', vt_reescanear: 'Escanear de nuevo', vt_medir: 'Medir mis manos', vt_salir: 'Salir', vt_cerrar_todo: 'Cerrar ventanas', vt_volver: 'Volver al juego',
    vt_borrar: 'Borrar', vt_puntos: '{n} burbujas', vt_toca: 'Tocá las burbujas', vt_estas: 'Estás a {d} m', vt_moviste: 'Te moviste {d} m desde que la abriste', vt_alto: 'Está a {d} m del piso', vt_6dof: 'Caminá alrededor: la ventana se queda en su lugar',
    vt_sin6dof: 'Sin 6DoF: la ventana está en el mundo del juego', vt_barra: 'Pellizcá la barra para moverla', vt_pegada: 'Pegada a la pared', vt_hola: 'Tocá con la yema del índice, o apuntá y pellizcá' },
  en: { vt_pantalla: 'Your space', vt_jugar: 'Play AEROPLAZA', vt_reloj: 'Clock', vt_pizarra: 'Whiteboard', vt_burbujas: 'Bubbles', vt_lugar: 'Where am I', vt_escaneo: 'Show the scan', vt_reescanear: 'Scan again', vt_medir: 'Measure my hands', vt_salir: 'Exit', vt_cerrar_todo: 'Close windows', vt_volver: 'Back to the game',
    vt_borrar: 'Clear', vt_puntos: '{n} bubbles', vt_toca: 'Touch the bubbles', vt_estas: 'You are {d} m away', vt_moviste: 'You moved {d} m since you opened it', vt_alto: 'It is {d} m above the floor', vt_6dof: 'Walk around: the window stays in place',
    vt_sin6dof: 'No 6DoF: the window lives in the game world', vt_barra: 'Pinch the bar to move it', vt_pegada: 'Stuck to the wall', vt_hola: 'Touch with your index fingertip, or point and pinch' },
  pt: { vt_pantalla: 'Seu espaço', vt_jugar: 'Jogar AEROPLAZA', vt_reloj: 'Relógio', vt_pizarra: 'Lousa', vt_burbujas: 'Bolhas', vt_lugar: 'Onde estou', vt_escaneo: 'Ver o escaneamento', vt_reescanear: 'Escanear de novo', vt_medir: 'Medir minhas mãos', vt_salir: 'Sair', vt_cerrar_todo: 'Fechar janelas', vt_volver: 'Voltar ao jogo',
    vt_borrar: 'Apagar', vt_puntos: '{n} bolhas', vt_toca: 'Toque as bolhas', vt_estas: 'Você está a {d} m', vt_moviste: 'Você andou {d} m desde que a abriu', vt_alto: 'Está a {d} m do chão', vt_6dof: 'Ande em volta: a janela fica no lugar',
    vt_sin6dof: 'Sem 6DoF: a janela está no mundo do jogo', vt_barra: 'Faça a pinça na barra para movê-la', vt_pegada: 'Grudada na parede', vt_hola: 'Toque com a ponta do indicador, ou aponte e faça a pinça' },
});

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4();
const APRIETA = 0.006;      // la yema aprieta al cruzar el vidrio (m, de adelante hacia atrás)
const CERCA = 0.035;        // hasta dónde de la yema al vidrio cuenta como tocar
const QUIETA = 1.4;         // s mirando un botón para apretarlo con la mirada
const PEGA = 0.22;          // m de una pared para pegarse
const fmt = (x) => x.toLocaleString(idioma() === 'en' ? 'en' : idioma() === 'pt' ? 'pt-BR' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------------ lo que dibuja el vidrio Aero */
function redondo(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function vidrio(g, x, y, w, h, r, tono = 'celeste') {
  const T = { celeste: ['rgba(236,250,255,0.94)', 'rgba(150,214,246,0.9)', '#2a9fd8'], verde: ['rgba(236,255,244,0.95)', 'rgba(140,226,178,0.9)', '#23a36a'], lila: ['rgba(246,240,255,0.95)', 'rgba(196,176,250,0.9)', '#7b5fe0'] }[tono] || [];
  /* (el halo de afuera, el cuerpo en degradé y el brillo de arriba, como el vidrio de Windows 7) */
  g.save(); g.shadowColor = 'rgba(40,150,220,0.45)'; g.shadowBlur = 26;
  const c = g.createLinearGradient(0, y, 0, y + h); c.addColorStop(0, T[0]); c.addColorStop(1, T[1]);
  g.fillStyle = c; redondo(g, x, y, w, h, r); g.fill(); g.restore();
  const b = g.createLinearGradient(0, y, 0, y + h * 0.5); b.addColorStop(0, 'rgba(255,255,255,0.85)'); b.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = b; redondo(g, x + 6, y + 6, w - 12, h * 0.46, r - 4); g.fill();
  g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.95)'; redondo(g, x, y, w, h, r); g.stroke();
  g.lineWidth = 2; g.strokeStyle = T[2] + '88'; redondo(g, x + 3, y + 3, w - 6, h - 6, r - 3); g.stroke();
}
function boton(g, b, { sobre = false, apretado = false, principal = false, peligro = false, apagado = false, carga = 0 } = {}) {
  const { x, w, h } = b, y = b.y + (apretado ? 4 : 0), r = Math.min(h / 2, 30);
  const c = g.createLinearGradient(0, y, 0, y + h);
  const [c0, c1] = apagado ? ['#eef3f6', '#c9d5dc'] : peligro ? (sobre ? ['#ffe3de', '#ff8a78'] : ['#fff0ec', '#ffb2a5']) : principal ? (sobre ? ['#d9fff0', '#34d08e'] : ['#e9fff6', '#6fe0ad']) : (sobre ? ['#ffffff', '#8fd6ff'] : ['#f4fbff', '#b9e3fb']);
  c.addColorStop(0, c0); c.addColorStop(1, c1);
  g.save(); g.shadowColor = sobre ? 'rgba(20,150,230,0.6)' : 'rgba(10,60,110,0.25)'; g.shadowBlur = sobre ? 22 : 10; g.shadowOffsetY = apretado ? 1 : 4;
  g.fillStyle = c; redondo(g, x, y, w, h, r); g.fill(); g.restore();
  const brillo = g.createLinearGradient(0, y, 0, y + h * 0.55); brillo.addColorStop(0, 'rgba(255,255,255,0.9)'); brillo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = brillo; redondo(g, x + 5, y + 4, w - 10, h * 0.5, r - 3); g.fill();
  g.lineWidth = sobre ? 5 : 3; g.strokeStyle = sobre ? '#1b9be0' : 'rgba(255,255,255,0.95)'; redondo(g, x, y, w, h, r); g.stroke();
  /* (la carga de la mirada: un borde que se va llenando) */
  if (carga > 0) { g.lineWidth = 7; g.strokeStyle = '#ffd23f'; g.beginPath(); g.moveTo(x + r, y + h); g.lineTo(x + r + (w - 2 * r) * carga, y + h); g.stroke(); }
  g.fillStyle = apagado ? '#8aa0ad' : peligro ? '#8a1c10' : '#0d3b5e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let tam = Math.round(h * 0.36); g.font = `800 ${tam}px system-ui, sans-serif`;
  while (tam > 14 && g.measureText(b.texto).width > w - 24) { tam -= 2; g.font = `800 ${tam}px system-ui, sans-serif`; }
  g.fillText(b.texto, x + w / 2, y + h / 2 + 2);
  if (b.icono) { g.font = `${Math.round(h * 0.42)}px system-ui, sans-serif`; }
}

/* ------------------------------------------ un tablero: un plano con su lienzo */
export class Tablero {
  constructor(ancho, alto, pxAncho = 1024) {
    this.ancho = ancho; this.alto = alto; this.W = pxAncho; this.H = Math.round(pxAncho * alto / ancho);
    this.lienzo = document.createElement('canvas'); this.lienzo.width = this.W; this.lienzo.height = this.H;
    this.g = this.lienzo.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.lienzo); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    this.malla.renderOrder = 8; this.malla.userData.tablero = this;
    this.botones = []; this.sobre = null; this.apretado = null; this.carga = 0; this.sucio = true; this.nace = 0;
  }
  /* un punto del mundo, en píxeles del lienzo, y su distancia al vidrio (positiva adelante) */
  local(p) {
    _m.copy(this.malla.matrixWorld).invert(); _a.copy(p).applyMatrix4(_m);
    return { u: (_a.x / this.ancho + 0.5) * this.W, v: (0.5 - _a.y / this.alto) * this.H, prof: _a.z, dentro: Math.abs(_a.x) <= this.ancho / 2 && Math.abs(_a.y) <= this.alto / 2 };
  }
  rayo(o, d) {
    _n.set(0, 0, 1).applyQuaternion(this.malla.getWorldQuaternion(new THREE.Quaternion()));
    const den = _n.dot(d); if (Math.abs(den) < 1e-4) return null;
    const k = this.malla.getWorldPosition(_b).sub(o).dot(_n) / den; if (k < 0.05 || k > 8) return null;
    const p = o.clone().addScaledVector(d, k), L = this.local(p);
    return L.dentro ? { ...L, p, k, tab: this } : null;
  }
  boton(u, v) { return this.botones.find((b) => !b.apagado && u >= b.x && u <= b.x + b.w && v >= b.y && v <= b.y + b.h) || null; }
  ponerSobre(b, carga = 0) { if (b !== this.sobre || Math.abs(carga - this.carga) > 0.04) { this.sobre = b; this.carga = carga; this.sucio = true; } }
  apretar(b) { this.apretado = b; this.sucio = true; clearTimeout(this._tA); this._tA = setTimeout(() => { this.apretado = null; this.sucio = true; }, 170); }
  dibujarBotones() { for (const b of this.botones) boton(this.g, b, { sobre: b === this.sobre, apretado: b === this.apretado, principal: b.principal, peligro: b.peligro, apagado: b.apagado, carga: b === this.sobre ? this.carga : 0 }); }
  refrescar() { if (this.sucio) { this.sucio = false; this.pintar(); this.tex.needsUpdate = true; } }
  pintar() {}
  soltar() { this.tex.dispose(); this.malla.geometry.dispose(); this.malla.material.dispose(); this.malla.removeFromParent(); }
}

/* ------------------------------------------ la pantalla grande con los botones */
export class Pantalla extends Tablero {
  /* opciones: [{ id, texto, principal, peligro }] (dos columnas de mosaicos) */
  constructor(titulo, opciones, sub = '') {
    super(1.1, 0.62, 1280);
    this.titulo = titulo; this.sub = sub; this.opciones = opciones; this.marcadas = new Set();
    this.armar();
  }
  armar() {
    const cols = 3, m = 44, arriba = 176, gw = (this.W - m * 2 - (cols - 1) * 20) / cols, filas = Math.ceil(this.opciones.length / cols), gh = Math.min(112, (this.H - arriba - m - (filas - 1) * 16) / filas);
    this.botones = this.opciones.map((o, i) => ({ ...o, x: m + (i % cols) * (gw + 20), y: arriba + Math.floor(i / cols) * (gh + 16), w: gw, h: gh, texto: o.texto }));
    this.sucio = true;
  }
  marcar(id, si) { if (si) this.marcadas.add(id); else this.marcadas.delete(id); for (const b of this.botones) if (b.id === id) b.texto = (this.opciones.find((o) => o.id === id)?.texto || '') + (si ? ' ✓' : ''); this.sucio = true; }
  pintar() {
    const g = this.g, W = this.W, H = this.H; g.clearRect(0, 0, W, H);
    vidrio(g, 8, 8, W - 16, H - 16, 44);
    /* (la esfera de Aero del título) */
    const e = g.createRadialGradient(92, 82, 4, 100, 92, 46); e.addColorStop(0, '#ffffff'); e.addColorStop(0.35, '#8ef0ff'); e.addColorStop(1, '#1a8fd8');
    g.fillStyle = e; g.beginPath(); g.arc(100, 94, 44, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#0d3b5e'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '800 64px system-ui, sans-serif'; g.fillText(this.titulo, 166, 112);
    if (this.sub) { g.font = '600 32px system-ui, sans-serif'; g.fillStyle = '#2a6f95'; g.fillText(this.sub, 168, 154); }
    this.dibujarBotones();
  }
}

/* ------------------------------------------ una ventana de prueba */
export class Ventana extends Tablero {
  constructor(tipo, { conSeis = true } = {}) {
    super(0.44, 0.32, 768);
    this.tipo = tipo; this.conSeis = conSeis; this.barra = 78; this.pegada = false;
    this.cerrar = { x: this.W - 78, y: 12, w: 58, h: 54 };
    this.titulo = t('vt_' + tipo);
    this.t = 0; this.tPinta = 0; this.puntos = 0; this.origen = null; this.cabeza = new THREE.Vector3(); this.piso = null;
    if (tipo === 'pizarra') {
      this.tinta = document.createElement('canvas'); this.tinta.width = this.W; this.tinta.height = this.H - this.barra; this.color = '#1a8fd8'; this.trazo = null;
      const c = ['#1a8fd8', '#ff5c8a', '#34c77b', '#ffb020'];
      this.botones = c.map((col, i) => ({ id: 'color', col, x: 24 + i * 80, y: this.H - 84, w: 64, h: 64, texto: '' })).concat([{ id: 'borrar', x: this.W - 210, y: this.H - 84, w: 186, h: 64, texto: t('vt_borrar') }]);
    }
    if (tipo === 'burbujas') this.burbujas = Array.from({ length: 7 }, () => this.burbujaNueva(true));
    if (tipo === 'lugar') {
      /* (una esferita de vidrio que flota delante: con 6DoF se ve el paralaje al moverse) */
      this.orbe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), new THREE.MeshBasicMaterial({ color: '#8ef0ff', transparent: true, opacity: 0.85, toneMapped: false }));
      this.orbe.position.set(0.16, 0.2, 0.08); this.malla.add(this.orbe);
    }
  }
  burbujaNueva(al = false) { return { x: 60 + Math.random() * (this.W - 120), y: al ? this.barra + 40 + Math.random() * (this.H - this.barra - 60) : this.H + 40, r: 22 + Math.random() * 26, v: 40 + Math.random() * 50, fase: Math.random() * 6, pop: 0 }; }
  enBarra(u, v) { return v >= 0 && v <= this.barra; }
  enCerrar(u, v) { const c = this.cerrar; return u >= c.x && u <= c.x + c.w && v >= c.y && v <= c.y + c.h; }
  /* un toque en el contenido (u, v en píxeles); arrastra: sigue apretando (la pizarra dibuja) */
  tocar(u, v, arrastra = false) {
    if (this.tipo === 'pizarra') {
      const b = !arrastra && this.boton(u, v);
      if (b) { if (b.id === 'borrar') this.tinta.getContext('2d').clearRect(0, 0, this.tinta.width, this.tinta.height); else this.color = b.col; this.apretar(b); return 'boton'; }
      const g = this.tinta.getContext('2d'), y = v - this.barra;
      if (y < 0 || v > this.H - 96) { this.trazo = null; return null; }
      g.strokeStyle = this.color; g.lineWidth = 10; g.lineCap = g.lineJoin = 'round';
      g.beginPath(); if (this.trazo && arrastra) g.moveTo(this.trazo[0], this.trazo[1]); else g.moveTo(u - 0.1, y); g.lineTo(u, y); g.stroke();
      this.trazo = [u, y]; this.sucio = true; return 'pinta';
    }
    if (this.tipo === 'burbujas' && !arrastra) {
      for (const b of this.burbujas) if (!b.pop && Math.hypot(u - b.x, v - b.y) < b.r + 16) { b.pop = 0.001; this.puntos++; this.sucio = true; return 'pop'; }
    }
    return null;
  }
  finTrazo() { if (this.trazo) this.trazo = null; }
  cuadro(dt, cabezaP) {
    this.t += dt;
    if (this.tipo === 'reloj') { const s = Math.floor(Date.now() / 1000); if (s !== this._s) { this._s = s; this.sucio = true; } }
    if (this.tipo === 'burbujas') {
      for (const b of this.burbujas) { if (b.pop) { b.pop += dt * 4; if (b.pop > 1) Object.assign(b, this.burbujaNueva()); } else { b.y -= b.v * dt; b.fase += dt * 2; if (b.y < this.barra - b.r) Object.assign(b, this.burbujaNueva()); } }
      this.tPinta += dt; if (this.tPinta > 1 / 24) { this.tPinta = 0; this.sucio = true; }
    }
    if (this.tipo === 'lugar') {
      this.cabeza.copy(cabezaP); if (!this.origen) this.origen = cabezaP.clone();
      this.tPinta += dt; if (this.tPinta > 0.2) { this.tPinta = 0; this.sucio = true; }
      this.orbe.position.y = 0.2 + Math.sin(this.t * 1.6) * 0.015;
    }
  }
  pintar() {
    const g = this.g, W = this.W, H = this.H; g.clearRect(0, 0, W, H);
    vidrio(g, 6, 6, W - 12, H - 12, 34, this.tipo === 'pizarra' ? 'verde' : this.tipo === 'burbujas' ? 'lila' : 'celeste');
    /* la barra: de donde se agarra */
    const bg = g.createLinearGradient(0, 6, 0, this.barra); bg.addColorStop(0, 'rgba(255,255,255,0.7)'); bg.addColorStop(1, 'rgba(140,210,245,0.55)');
    g.fillStyle = bg; redondo(g, 12, 12, W - 24, this.barra - 12, 26); g.fill();
    g.fillStyle = '#0d3b5e'; g.font = '800 36px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(this.titulo, 34, 46);
    g.fillStyle = 'rgba(13,59,94,0.35)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(W / 2 - 24 + i * 24, 30, 5, 0, 7); g.fill(); }
    const c = this.cerrar, s = this.sobre === 'cerrar';
    const cg = g.createLinearGradient(0, c.y, 0, c.y + c.h); cg.addColorStop(0, s ? '#ffb0a0' : '#ffd5cc'); cg.addColorStop(1, s ? '#e2412b' : '#f07a66');
    g.fillStyle = cg; redondo(g, c.x, c.y, c.w, c.h, 16); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(c.x + 18, c.y + 16); g.lineTo(c.x + c.w - 18, c.y + c.h - 16); g.moveTo(c.x + c.w - 18, c.y + 16); g.lineTo(c.x + 18, c.y + c.h - 16); g.stroke();
    const y0 = this.barra + 10, cx = W / 2;
    g.textAlign = 'center'; g.fillStyle = '#0d3b5e';
    if (this.tipo === 'reloj') {
      const d = new Date(), r = 150, cy = y0 + 180;
      const f = g.createRadialGradient(cx - 40, cy - 50, 10, cx, cy, r); f.addColorStop(0, '#ffffff'); f.addColorStop(1, '#bfe9ff');
      g.fillStyle = f; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.strokeStyle = '#2a9fd8'; g.lineWidth = 6; g.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.strokeStyle = '#2a6f95'; g.lineWidth = i % 3 ? 3 : 7; g.beginPath(); g.moveTo(cx + Math.sin(a) * (r - 14), cy - Math.cos(a) * (r - 14)); g.lineTo(cx + Math.sin(a) * (r - 30), cy - Math.cos(a) * (r - 30)); g.stroke(); }
      const aguja = (a, l, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l); g.stroke(); };
      const hh = d.getHours() % 12 + d.getMinutes() / 60, mm = d.getMinutes() + d.getSeconds() / 60;
      aguja(hh / 12 * Math.PI * 2, 78, 11, '#0d3b5e'); aguja(mm / 60 * Math.PI * 2, 118, 7, '#1a8fd8'); aguja(d.getSeconds() / 60 * Math.PI * 2, 128, 3, '#ff5c8a');
      g.fillStyle = '#0d3b5e'; g.font = '800 34px system-ui, sans-serif'; g.fillText(d.toLocaleTimeString(), cx, H - 40);
    } else if (this.tipo === 'pizarra') {
      g.fillStyle = 'rgba(255,255,255,0.88)'; redondo(g, 18, y0, W - 36, H - y0 - 104, 20); g.fill();
      g.drawImage(this.tinta, 0, this.barra);
      if (!this._pinto) { g.fillStyle = 'rgba(13,59,94,0.35)'; g.font = '700 30px system-ui, sans-serif'; g.fillText('✍ ' + t('vt_hola'), cx, y0 + 150); }
      for (const b of this.botones) {
        if (b.id === 'color') { g.fillStyle = b.col; g.beginPath(); g.arc(b.x + 32, b.y + 32, b === this.apretado ? 26 : 30, 0, 7); g.fill(); g.lineWidth = this.color === b.col ? 8 : 3; g.strokeStyle = '#fff'; g.stroke(); }
        else boton(g, b, { sobre: b === this.sobre, apretado: b === this.apretado });
      }
    } else if (this.tipo === 'burbujas') {
      for (const b of this.burbujas) {
        const r = b.pop ? b.r * (1 + b.pop) : b.r + Math.sin(b.fase) * 2, a = b.pop ? 1 - b.pop : 1, x = b.x + Math.sin(b.fase) * 8;
        g.globalAlpha = a; const bb = g.createRadialGradient(x - r * 0.35, b.y - r * 0.4, r * 0.1, x, b.y, r); bb.addColorStop(0, 'rgba(255,255,255,0.95)'); bb.addColorStop(0.6, 'rgba(160,230,255,0.35)'); bb.addColorStop(1, 'rgba(120,120,255,0.55)');
        g.fillStyle = bb; g.beginPath(); g.arc(x, b.y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke(); g.globalAlpha = 1;
      }
      g.fillStyle = '#3d2a8a'; g.font = '800 34px system-ui, sans-serif'; g.fillText(this.puntos ? t('vt_puntos', { n: this.puntos }) : t('vt_toca'), cx, H - 34);
    } else if (this.tipo === 'lugar') {
      const p = this.malla.getWorldPosition(_c), d = p.distanceTo(this.cabeza), mov = this.origen ? this.origen.distanceTo(this.cabeza) : 0;
      g.font = '800 58px system-ui, sans-serif'; g.fillText(t('vt_estas', { d: fmt(d) }), cx, y0 + 80);
      g.font = '600 30px system-ui, sans-serif'; g.fillStyle = '#2a6f95';
      g.fillText(t('vt_moviste', { d: fmt(mov) }), cx, y0 + 140);
      if (this.piso != null) g.fillText(t('vt_alto', { d: fmt(p.y - this.piso) }), cx, y0 + 184);
      g.fillStyle = this.conSeis ? '#23a36a' : '#8a6a10'; g.font = '800 28px system-ui, sans-serif';
      g.fillText(this.pegada ? '📌 ' + t('vt_pegada') : (this.conSeis ? '🧭 ' + t('vt_6dof') : '🎮 ' + t('vt_sin6dof')), cx, H - 70);
      g.fillStyle = 'rgba(13,59,94,0.5)'; g.font = '600 24px system-ui, sans-serif'; g.fillText(t('vt_barra'), cx, H - 32);
    }
  }
}

/* ------------------------------------------ todo junto: la pantalla, las ventanas y los punteros */
export class Ventanas {
  /* conSeis: con 6DoF (tu cuarto); paredes(): los planos donde se pegan [{ p, n }] (n horizontal, hacia afuera);
     piso(): la altura del piso (o null); alSonar(nombre); alAccion(id) (los botones de la pantalla) */
  constructor({ conSeis = true, paredes = null, piso = null, alSonar = () => {}, alAccion = () => {} } = {}) {
    this.grupo = new THREE.Group(); this.grupo.name = 'ventanas';
    this.conSeis = conSeis; this.paredes = paredes; this.piso = piso; this.alSonar = alSonar; this.alAccion = alAccion;
    this.pantalla = null; this.lista = []; this.agarres = new Map(); this.previo = new Map(); this.apunta = [null, null]; this.mirada = { b: null, tab: null, t: 0 };
    this.nAbiertas = 0;
  }
  get tableros() { return (this.pantalla && this.pantalla.malla.visible ? [this.pantalla] : []).concat(this.lista); }
  get hayAlgo() { return this.tableros.length > 0; }
  abrirPantalla(titulo, opciones, pos, mirar, sub = '') {
    if (this.pantalla) this.pantalla.soltar();
    const P = this.pantalla = new Pantalla(titulo, opciones, sub);
    P.malla.position.copy(pos); P.malla.lookAt(mirar.x, pos.y + (mirar.y - pos.y) * 0.4, mirar.z); P.nace = 0; P.malla.scale.setScalar(0.01);
    this.grupo.add(P.malla); this.alSonar('aviso');
    return P;
  }
  cerrarPantalla() { if (this.pantalla) { this.pantalla.soltar(); this.pantalla = null; } }
  /* una ventana nueva delante de la cara, un poco corrida de las anteriores */
  abrir(tipo, cabezaP, cabezaQ) {
    const V = new Ventana(tipo, { conSeis: this.conSeis }), k = this.nAbiertas++ % 5;
    _a.set(0, 0, -1).applyQuaternion(cabezaQ); _a.y = 0; if (_a.lengthSq() < 1e-4) _a.set(0, 0, -1); _a.normalize();
    _b.set(-_a.z, 0, _a.x);
    V.malla.position.copy(cabezaP).addScaledVector(_a, 0.62 + k * 0.03).addScaledVector(_b, (k - 2) * 0.12); V.malla.position.y += -0.06 + (k % 2) * 0.1;
    V.malla.lookAt(cabezaP); V.nace = 0; V.malla.scale.setScalar(0.01);
    if (this.piso) V.piso = this.piso();
    this.grupo.add(V.malla); this.lista.push(V); this.alSonar('sesion');
    return V;
  }
  cerrar(V) { const i = this.lista.indexOf(V); if (i >= 0) this.lista.splice(i, 1); for (const [k, a] of this.agarres) if (a.V === V) this.agarres.delete(k); V.soltar(); this.alSonar('pop'); }
  cerrarTodas() { for (const V of this.lista.slice()) this.cerrar(V); }
  limpiar() { this.cerrarTodas(); this.cerrarPantalla(); }
  /* lo tocado por la yema (el más cerca del vidrio) */
  alDedo(yema) {
    let mejor = null;
    for (const T of this.tableros) { const L = T.local(yema); if (L.dentro && L.prof < CERCA && L.prof > -0.05 && (!mejor || Math.abs(L.prof) < Math.abs(mejor.prof))) mejor = { ...L, tab: T }; }
    return mejor;
  }
  alRayo(o, d) { let mejor = null; for (const T of this.tableros) { const r = T.rayo(o, d); if (r && (!mejor || r.k < mejor.k)) mejor = r; } return mejor; }
  /* un aprieto en (u, v) del tablero T */
  pulsar(T, u, v, p) {
    if (T instanceof Ventana) {
      if (T.enCerrar(u, v)) { this.cerrar(T); return; }
      if (T.enBarra(u, v)) return;
      const r = T.tocar(u, v); if (r === 'pop') this.alSonar('pop'); else if (r === 'boton') this.alSonar('elegir'); else if (r === 'pinta') T._pinto = true;
      return;
    }
    const b = T.boton(u, v); if (!b) return;
    T.apretar(b); this.alSonar('elegir'); this.alAccion(b.id, p);
  }
  /* cada cuadro. punteros: [{ id, o, d, yema, pellizca, empezo, solto, clic }] (las manos y la mirada) */
  actualizar(dt, cabezaP, cabezaQ, punteros) {
    for (const T of this.tableros) {
      /* (aparecen creciendo, con un rebote) */
      if (T.nace < 1) { T.nace = Math.min(1, T.nace + dt / 0.32); const x = T.nace, s = 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2); T.malla.scale.setScalar(Math.max(0.01, s)); }
      if (T instanceof Ventana) T.cuadro(dt, cabezaP);
    }
    /* (las cuentas con el vidrio usan su matriz del mundo: que sea la de este cuadro y no la del último dibujo) */
    this.grupo.updateMatrixWorld(true);
    const sobre = new Map();
    for (const p of punteros) {
      const k = p.id; this.apunta[k === 'mirada' ? 2 : k] = null;
      /* 1) arrastrando una ventana (se agarró por la barra): sigue al rayo a la misma distancia */
      const A = this.agarres.get(k);
      if (A) {
        if (!p.pellizca || !this.lista.includes(A.V)) { this.agarres.delete(k); if (this.lista.includes(A.V)) this.dejar(A.V, cabezaP); continue; }
        /* (apuntando a una pared mientras se la lleva, va a la pared, como en un Quest: con el rayo solo
           no se la puede llevar más lejos de donde se agarró) */
        const w = this.enPared(p.o, p.d);
        if (w) { A.V.malla.position.copy(w.p).addScaledVector(w.n, 0.012); A.V.malla.lookAt(_b.copy(A.V.malla.position).add(w.n)); if (!A.V.pegada) { A.V.pegada = true; A.V.sucio = true; } this.apunta[k] = w.p.clone(); continue; }
        const obj = p.o.clone().addScaledVector(p.d, A.k).sub(A.off);
        A.V.malla.position.lerp(obj, Math.min(1, dt * 18)); A.V.malla.lookAt(cabezaP); if (A.V.pegada) { A.V.pegada = false; A.V.sucio = true; }
        this.apunta[k] = p.o.clone().addScaledVector(p.d, A.k); continue;
      }
      /* 2) la yema, si está sobre un vidrio */
      if (p.yema) {
        const L = this.alDedo(p.yema), clave = k + ':dedo', antes = this.previo.get(clave);
        if (L) {
          const T = L.tab, b = T.boton?.(L.u, L.v) || (T instanceof Ventana && T.enCerrar(L.u, L.v) ? 'cerrar' : null);
          if (b) sobre.set(T, { b, carga: 0 });
          if (antes && antes.tab === T && antes.prof > APRIETA && L.prof <= APRIETA) this.pulsar(T, L.u, L.v, p);
          else if (T instanceof Ventana && T.tipo === 'pizarra' && L.prof <= APRIETA && antes?.tab === T && antes.prof <= APRIETA) { T.tocar(L.u, L.v, true); T._pinto = true; }
          this.previo.set(clave, { tab: T, prof: L.prof }); this.apunta[k] = p.yema.clone();
          continue;
        }
        if (antes?.tab instanceof Ventana) antes.tab.finTrazo();
        this.previo.delete(clave);
      }
      /* 3) el rayo (o la mirada) */
      if (!p.o || !p.d) continue;
      const r = this.alRayo(p.o, p.d);
      if (!r) { if (k === 'mirada') this.mirada = { b: null, tab: null, t: 0 }; continue; }
      const T = r.tab, esV = T instanceof Ventana, b = T.boton?.(r.u, r.v) || (esV && T.enCerrar(r.u, r.v) ? 'cerrar' : null);
      this.apunta[k === 'mirada' ? 2 : k] = r.p;
      let carga = 0;
      if (k === 'mirada') {
        /* (la mirada: un toque en la pantalla, o quedarse encima de un botón QUIETA s) */
        if (this.mirada.b === b && this.mirada.tab === T && b) this.mirada.t += dt; else this.mirada = { b, tab: T, t: 0 };
        carga = b ? Math.min(1, this.mirada.t / QUIETA) : 0;
        if (p.clic || (b && this.mirada.t >= QUIETA)) { this.mirada.t = -1.2; if (esV && T.enBarra(r.u, r.v) && !T.enCerrar(r.u, r.v)) this.traerAdelante(T, cabezaP, cabezaQ); else this.pulsar(T, r.u, r.v, p); }
      } else if (p.empezo) {
        if (esV && T.enBarra(r.u, r.v) && !T.enCerrar(r.u, r.v)) { this.agarres.set(k, { V: T, k: r.k, off: r.p.clone().sub(T.malla.position) }); this.alSonar('elegir'); }
        else this.pulsar(T, r.u, r.v, p);
      } else if (p.pellizca && esV && T.tipo === 'pizarra') { T.tocar(r.u, r.v, true); T._pinto = true; }
      if (b && !sobre.has(T)) sobre.set(T, { b, carga });
    }
    /* lo que queda iluminado: lo que tiene algo encima (un botón, o la X de una ventana) */
    for (const T of this.tableros) {
      const s = sobre.get(T);
      if (s?.b === 'cerrar') { if (T.sobre !== 'cerrar') { T.sobre = 'cerrar'; T.sucio = true; } }
      else if (s) T.ponerSobre(s.b, s.carga);
      else if (T.sobre) { T.sobre = null; T.carga = 0; T.sucio = true; }
      T.refrescar();
    }
  }
  /* dónde toca el rayo la pared más cercana (hasta 4 m, y a menos de 3 m del centro de la pared) */
  enPared(o, d) {
    let mejor = null;
    for (const w of this.paredes?.() || []) {
      const den = w.n.dot(d); if (den > -0.15) continue;   // (de frente, desde adentro del cuarto)
      const k = _a.copy(w.p).sub(o).dot(w.n) / den; if (k < 0.3 || k > 4) continue;
      const p = o.clone().addScaledVector(d, k); if (p.distanceTo(w.p) > 3) continue;
      if (!mejor || k < mejor.k) mejor = { p, n: w.n, k };
    }
    return mejor;
  }
  /* soltar una ventana: cerca de una pared, se pega (derecha y un centímetro afuera) */
  dejar(V, cabezaP) {
    const P = this.paredes?.() || [];
    let mejor = null, md = PEGA;
    const c = V.malla.position;
    for (const w of P) { const d = Math.abs(_a.copy(c).sub(w.p).dot(w.n)); if (d < md) { md = d; mejor = w; } }
    if (mejor) {
      const d = _a.copy(c).sub(mejor.p).dot(mejor.n);
      c.addScaledVector(mejor.n, 0.012 - d);
      V.malla.lookAt(_b.copy(c).add(mejor.n)); V.pegada = true; V.sucio = true; this.alSonar('entra');
    } else { V.malla.lookAt(cabezaP); if (V.pegada) { V.pegada = false; V.sucio = true; } }
  }
  /* (con la mirada no se puede arrastrar: tocar la barra la trae delante de la cara) */
  traerAdelante(V, cabezaP, cabezaQ) {
    _a.set(0, 0, -1).applyQuaternion(cabezaQ); V.malla.position.copy(cabezaP).addScaledVector(_a, 0.6); V.malla.lookAt(cabezaP); V.pegada = false; this.alSonar('elegir');
  }
}
