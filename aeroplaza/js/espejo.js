/* ============================================================================
   aeroplaza/js/espejo.js — EL ESPEJO DEL VR (vuelta 43, "que en VR todo el
   juego sea funcional"). Antes, una ventana, una charla o un menú de la
   interfaz plana sacaban del VR (en el visor no se veían). Ahora se leen del
   DOM tal cual están y se dibujan en un panel de vidrio Aero adentro del VR:
   - el título, el texto (lo que no es botón), el dibujo si hay uno (el mapa)
     y los botones como mosaicos; apretar un mosaico hace click() en el botón
     de verdad, así que todo sigue andando igual que en la pantalla (viajar,
     hablar, el parkour, los resultados, la tienda, las opciones…);
   - una charla: quién habla, lo que dice, sus respuestas y "▶ Seguir";
   - se vuelve a leer 4 veces por segundo (si cambió, se repinta);
   - va a 1,5 m, un poco abajo de los ojos, y sigue a la cabeza despacio (si
     caminás viene con vos; si mirás para otro lado más de 50°, se acomoda);
   - se toca como las ventanas (ventanas.js): con el rayo y un pellizco, la
     yema, o la mirada y un toque.
   Lo que no entra en un panel (los cuadros de texto, las barritas) queda
   afuera: se usa sin el visor. El probador y el telescopio son su propia
   escena 3D: esos sí sacan del VR.
   ========================================================================== */
import * as THREE from 'three';
import { Tablero } from './ventanas.js';
import { t, sumar } from './textos.js';

sumar({
  es: { esp_seguir: '▶ Seguir', esp_mas: 'Más ▶', esp_menos: '◀ Antes', esp_cerrar: 'Cerrar' },
  en: { esp_seguir: '▶ Next', esp_mas: 'More ▶', esp_menos: '◀ Back', esp_cerrar: 'Close' },
  pt: { esp_seguir: '▶ Seguir', esp_mas: 'Mais ▶', esp_menos: '◀ Voltar', esp_cerrar: 'Fechar' },
});

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
/* lo que cuenta como botón adentro de una ventana */
const BOTON = 'button, [data-a], [data-h], [role="button"], .boton, .mosaico, a[href], summary';
const LEJOS = 1.5, BAJA = 0.12, GIRA = 50 * Math.PI / 180;
const POR_PAGINA = 12;

/* ------------------------------------------ el panel: lo que se leyó, dibujado */
export class PanelEspejo extends Tablero {
  constructor() {
    super(1.3, 0.84, 1280);
    /* (encima de todo: una pared entre la cabeza y el panel no lo tapa, como la interfaz de un visor) */
    this.malla.material.depthTest = false; this.malla.renderOrder = 12;
    this.titulo = ''; this.lineas = []; this.dibujo = null; this.conCerrar = false; this.fuentes = []; this.pagina = 0; this.firma = '';
  }
  /* lo que dice el DOM: { titulo, texto, botones: [{ el, texto, principal, peligro, apagado }], dibujo, cerrar } */
  poner(L) {
    this.titulo = L.titulo; this.texto = L.texto; this.dibujo = L.dibujo || null; this.conCerrar = !!L.cerrar; this.fuentes = L.botones;
    const paginas = Math.max(1, Math.ceil(L.botones.length / POR_PAGINA)); if (this.pagina >= paginas) this.pagina = paginas - 1;
    this.armar(); this.sucio = true;
  }
  armar() {
    const W = this.W, H = this.H, B = this.fuentes, paginas = Math.ceil(B.length / POR_PAGINA);
    const vista = B.slice(this.pagina * POR_PAGINA, (this.pagina + 1) * POR_PAGINA).map((f, i) => ({ ...f, id: 'esp:' + (this.pagina * POR_PAGINA + i) }));
    if (paginas > 1) { if (this.pagina > 0) vista.push({ id: 'esp:menos', texto: t('esp_menos') }); if (this.pagina < paginas - 1) vista.push({ id: 'esp:mas', texto: t('esp_mas') }); }
    /* (los mosaicos abajo: 3 columnas, hasta 5 filas; la zona del texto se achica si hay muchos) */
    const cols = vista.length <= 2 ? Math.max(1, vista.length) : vista.length === 4 ? 2 : 3, filas = Math.ceil(vista.length / cols);
    const m = 40, gap = 16, alto = filas > 3 ? 70 : 92, gw = (W - m * 2 - gap * (cols - 1)) / cols;
    const y0 = H - m - filas * alto - (filas - 1) * gap;
    this.zonaTexto = [m, 132, W - m * 2, Math.max(60, y0 - 132 - 18)];
    this.botones = vista.map((f, i) => ({ ...f, x: m + (i % cols) * (gw + gap), y: y0 + Math.floor(i / cols) * (alto + gap), w: gw, h: alto }));
    if (this.conCerrar) this.botones.push({ id: 'esp:x', texto: '✕', x: W - 118, y: 26, w: 84, h: 72, peligro: true });
  }
  pintar() {
    const g = this.g, W = this.W, H = this.H; g.clearRect(0, 0, W, H);
    /* (el vidrio Aero, como ventanas.js) */
    g.save(); g.shadowColor = 'rgba(40,150,220,0.45)'; g.shadowBlur = 26;
    const c = g.createLinearGradient(0, 0, 0, H); c.addColorStop(0, 'rgba(236,250,255,0.95)'); c.addColorStop(1, 'rgba(150,214,246,0.92)');
    g.fillStyle = c; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 44); g.fill(); g.restore();
    const b = g.createLinearGradient(0, 8, 0, H * 0.4); b.addColorStop(0, 'rgba(255,255,255,0.85)'); b.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = b; g.beginPath(); g.roundRect(14, 14, W - 28, H * 0.36, 40); g.fill();
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 44); g.stroke();
    /* el título */
    g.fillStyle = '#0d3b5e'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    let tam = 58; g.font = `800 ${tam}px system-ui, sans-serif`;
    const maxT = W - 100 - (this.conCerrar ? 130 : 0);
    while (tam > 30 && g.measureText(this.titulo).width > maxT) { tam -= 4; g.font = `800 ${tam}px system-ui, sans-serif`; }
    g.fillText(this.titulo, 48, 96);
    /* el dibujo (el mapa) a la izquierda de la zona del texto, y el texto al lado */
    let [x, y, w, h] = this.zonaTexto;
    if (this.dibujo && this.dibujo.width > 0 && h > 80) {
      const k = Math.min(h / this.dibujo.height, (w * 0.55) / this.dibujo.width), dw = this.dibujo.width * k, dh = this.dibujo.height * k;
      try { g.drawImage(this.dibujo, x, y, dw, dh); } catch { /* (un lienzo sin permiso) */ }
      x += dw + 24; w -= dw + 24;
    }
    if (this.texto && w > 120) {
      g.fillStyle = '#16476b'; let tt = 36; g.font = `600 ${tt}px system-ui, sans-serif`;
      let lineas = envolver(g, this.texto, w);
      while (lineas.length * tt * 1.25 > h && tt > 22) { tt -= 2; g.font = `600 ${tt}px system-ui, sans-serif`; lineas = envolver(g, this.texto, w); }
      const n = Math.floor(h / (tt * 1.25)); if (lineas.length > n) { lineas = lineas.slice(0, n); lineas[n - 1] = lineas[n - 1].replace(/.?$/, '…'); }
      lineas.forEach((l, i) => g.fillText(l, x, y + tt + i * tt * 1.25));
    }
    this.dibujarBotones();
  }
}
function envolver(g, texto, ancho) {
  const out = [];
  for (const parrafo of String(texto).split('\n')) {
    let linea = '';
    for (const pal of parrafo.split(/\s+/)) {
      if (!pal) continue;
      const prueba = linea ? linea + ' ' + pal : pal;
      if (g.measureText(prueba).width <= ancho || !linea) linea = prueba; else { out.push(linea); linea = pal; }
    }
    if (linea) out.push(linea);
  }
  return out;
}

/* ------------------------------------------ leer el DOM */
function visible(el, raiz) {
  for (let e = el; e && e !== raiz.parentElement; e = e.parentElement) {
    if (e.hidden) return false;
    const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false;
  }
  return true;
}
const limpio = (s) => String(s || '').replace(/\s+/g, ' ').trim();
function textoDe(el) { return limpio(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent).slice(0, 44) || '•'; }
/* una ventana de UI.ventana (.velo › .ventana) */
export function leerVentana(velo) {
  const v = velo.querySelector('.ventana') || velo, cuerpo = v.querySelector('.cuerpo') || v;
  const titulo = limpio(v.querySelector('.cabeza h2, h2')?.textContent);
  const cerrar = v.querySelector('.cabeza [data-a=x]');
  const botones = [];
  for (const el of v.querySelectorAll(BOTON)) {
    if (el === cerrar || el.closest('.cabeza')) continue;
    if (el.parentElement?.closest(BOTON) && v.contains(el.parentElement.closest(BOTON))) continue;   // (uno adentro de otro: vale el de afuera)
    if (!visible(el, v)) continue;
    botones.push({ el, texto: textoDe(el), principal: el.classList.contains('primario'), peligro: el.classList.contains('peligro'), apagado: !!el.disabled });
  }
  /* el texto: lo que no está en un botón, de a bloques */
  const partes = [], andador = document.createTreeWalker(cuerpo, NodeFilter.SHOW_TEXT);
  let ultimoPadre = null, largo = 0;
  for (let n = andador.nextNode(); n && largo < 700; n = andador.nextNode()) {
    const x = limpio(n.textContent); if (!x) continue;
    const p = n.parentElement; if (!p || p.closest(BOTON) || p.closest('script,style') || !visible(p, v)) continue;
    const bloque = p.closest('p,li,h3,h4,div,section') || p;
    if (bloque !== ultimoPadre && partes.length) partes.push('\n');
    partes.push(x); ultimoPadre = bloque; largo += x.length;
  }
  const texto = partes.join(' ').replace(/ \n /g, '\n').replace(/\n+/g, '\n').trim();
  const dibujo = [...cuerpo.querySelectorAll('canvas')].find((c) => c.width > 60 && c.height > 60 && visible(c, v)) || null;
  return { titulo, texto, botones, dibujo, cerrar: cerrar ? { el: cerrar } : null };
}
/* una charla (UI.dialogo: .dialogo con .quien, .texto, .acciones y ▼ .sigue) */
export function leerDialogo(d) {
  const botones = [...d.querySelectorAll('.acciones button')].map((el) => ({ el, texto: textoDe(el), principal: el.classList.contains('primario') }));
  const sigue = d.querySelector('.sigue');
  if (sigue && sigue.style.display !== 'none' && !botones.length) botones.push({ el: d, texto: t('esp_seguir'), principal: true });
  return { titulo: '💬 ' + limpio(d.querySelector('.quien')?.textContent), texto: limpio(d.querySelector('.texto')?.textContent), botones, dibujo: null, cerrar: null };
}
const firmaDe = (L) => [L.titulo, L.texto, L.botones.map((b) => b.texto + (b.apagado ? '·' : '')).join('|'), L.dibujo ? 'd' : ''].join('#');

/* ------------------------------------------ el espejo */
export class Espejo {
  /* ventanas: las del mundo del juego (ventanas.js), donde va el panel; fuente(): lo que hay abierto (un .velo, un
     .dialogo o null) */
  constructor({ ventanas, fuente }) {
    this.ventanas = ventanas; this.fuente = fuente;
    this.panel = null; this.de = null; this.tLeer = 0; this.dir = new THREE.Vector3(0, 0, -1); this.nClicks = 0;
  }
  get abierto() { return !!this.panel && this.ventanas.pantalla === this.panel; }
  cuadro(dt, cabezaP, cabezaQ) {
    const f = this.fuente();
    if (!f) { this.cerrar(); return; }
    if (f !== this.de || !this.abierto) this.abrir(f, cabezaP, cabezaQ);
    this.tLeer -= dt;
    if (this.tLeer <= 0) { this.tLeer = 0.25; this.leer(); }
    /* (sigue a la cabeza: el mismo rumbo; si se mira más de GIRA para otro lado, se acomoda de a poco) */
    _a.set(0, 0, -1).applyQuaternion(cabezaQ); _a.y = 0; if (_a.lengthSq() > 1e-4) {
      _a.normalize();
      if (Math.acos(THREE.MathUtils.clamp(_a.dot(this.dir), -1, 1)) > GIRA) this.dir.lerp(_a, Math.min(1, dt * 2.5)).normalize();
    }
    const M = this.panel.malla, obj = _b.copy(cabezaP).addScaledVector(this.dir, LEJOS); obj.y = cabezaP.y - BAJA;
    M.position.lerp(obj, Math.min(1, dt * 6)); M.lookAt(cabezaP.x, M.position.y + (cabezaP.y - M.position.y) * 0.5, cabezaP.z);
  }
  abrir(f, cabezaP, cabezaQ) {
    this.de = f; this.panel = new PanelEspejo(); this.panel.pagina = 0;
    _a.set(0, 0, -1).applyQuaternion(cabezaQ); _a.y = 0; if (_a.lengthSq() < 1e-4) _a.set(0, 0, -1); this.dir.copy(_a.normalize());
    const pos = cabezaP.clone().addScaledVector(this.dir, LEJOS); pos.y = cabezaP.y - BAJA;
    this.ventanas.abrirTablero(this.panel, pos, cabezaP, 1);
    this.firma = ''; this.leer();
  }
  leer() {
    if (!this.panel || !this.de) return;
    const L = this.de.classList?.contains('dialogo') ? leerDialogo(this.de) : leerVentana(this.de);
    const k = firmaDe(L) + '#' + this.panel.pagina;
    this.L = L;
    if (k !== this.firma || L.dibujo) { this.firma = k; this.panel.poner(L); }
  }
  cerrar() {
    if (this.panel && this.ventanas.pantalla === this.panel) this.ventanas.cerrarPantalla();
    this.panel = null; this.de = null;
  }
  /* un mosaico apretado (el id que manda ventanas.js): el botón de verdad */
  accion(id) {
    if (!id.startsWith('esp:') || !this.panel || !this.L) return false;
    const k = id.slice(4);
    if (k === 'mas') { this.panel.pagina++; this.firma = ''; this.leer(); return true; }
    if (k === 'menos') { this.panel.pagina = Math.max(0, this.panel.pagina - 1); this.firma = ''; this.leer(); return true; }
    const f = k === 'x' ? this.L.cerrar : this.L.botones[+k];
    if (f?.el?.isConnected) { this.nClicks++; f.el.click(); }
    /* (lo que abrió o cerró se ve en la próxima lectura, enseguida) */
    this.tLeer = 0.05;
    return true;
  }
}
