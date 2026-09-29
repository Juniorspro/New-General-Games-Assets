// El menú: la isla de fondo, en 3D, con la cámara que se mece con el mouse y
// vuela a pantallas que están EN el mundo. Los números son los del tutorial
// de menús de @brutu_scripts: inclinación máxima 18°, vaivén de 1,5° con seno
// y coseno, velocidad 3 (el vaivén usa t·3 y la cámara se acerca a su
// objetivo con un factor dt·3). El estilo NO es el de su video (metal y neón
// en la oscuridad) sino el de la isla: playa, sol y madera.
//
// AJUSTES vuela a un cartel clavado en la arena y CRÉDITOS a uno en la punta
// del muelle: se tocan con el mouse sobre el cartel mismo (un rayo hasta la
// cara del cartel, y de ahí a la coordenada del lienzo que lo pinta).
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { mergeSimple } from './rocas.js';
import { t, IDIOMAS, idioma } from './idioma.js';
import { aApp, pantalla } from './pantalla.js';

const MAX_TILT = 18, INTENSIDAD = 1.5, VELOCIDAD = 3;
const g2r = THREE.MathUtils.degToRad;
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const ARRIBA = new THREE.Vector3(0, 1, 0);
const suave = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export function mirarDesde(pos, objetivo) {
  _m.lookAt(pos, objetivo, ARRIBA);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

// ── carteles: madera + un lienzo pintado a mano ─────────────────────────────
class Cartel {
  constructor(M, W, H, ancho, alto, altoPie) {
    this.W = W; this.H = H;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    // un poco de luz propia: de noche se sigue leyendo
    this.mat = matPixel('uv', { mapa: this.tex, tam: [W, H], emisivo: 0x262626 });
    this.grupo = new THREE.Group();
    const yc = altoPie + alto / 2;
    this.cara = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), this.mat);
    this.cara.position.set(0, yc, 0.066);
    this.cara.receiveShadow = true;
    const largoPata = altoPie + alto * 0.55 + 0.4;
    const madera = mergeSimple([
      new THREE.BoxGeometry(ancho + 0.26, alto + 0.26, 0.12).translate(0, yc, 0),
      new THREE.BoxGeometry(0.16, largoPata, 0.16).translate(-ancho / 2 + 0.3, largoPata / 2 - 0.4, -0.12),
      new THREE.BoxGeometry(0.16, largoPata, 0.16).translate(ancho / 2 - 0.3, largoPata / 2 - 0.4, -0.12),
      new THREE.BoxGeometry(ancho + 0.4, 0.1, 0.22).translate(0, yc + alto / 2 + 0.17, 0.02),
    ]);
    this.marco = new THREE.Mesh(madera, M.madera);
    this.marco.castShadow = this.marco.receiveShadow = true;
    this.grupo.add(this.marco, this.cara);
    this.centroLocal = new THREE.Vector3(0, yc, 0);
    this.botones = [];
    this.sobreBoton = null;
  }

  // Dónde se para la cámara para verlo entero.
  vista(dist) {
    const c = this.cara.getWorldPosition(new THREE.Vector3());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(this.grupo.quaternion);
    const pos = c.clone().addScaledVector(n, dist);
    return { pos, quat: mirarDesde(pos, c) };
  }

  boton(x, y, w, h, fn) { this.botones.push({ x, y, w, h, fn }); }
  buscar(x, y) { return this.botones.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null; }
  clic(x, y) { const b = this.buscar(x, y); if (!b) return false; b.fn(); this.dibujar(); return true; }
  sobre(x, y) {
    const b = this.buscar(x, y);
    if (b !== this.sobreBoton) { this.sobreBoton = b; this.dibujar(); }
    return !!b;
  }

  fondo(titulo) {
    const g = this.g, W = this.W, H = this.H;
    g.fillStyle = '#f3e2bb'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(138, 90, 43, 0.10)';
    for (let y = 10; y < H; y += 14) g.fillRect(0, y, W, 2);
    g.fillStyle = 'rgba(138, 90, 43, 0.07)';
    for (let y = 3; y < H; y += 14) g.fillRect(0, y, W, 1);
    g.strokeStyle = '#8a5a2b'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
    g.textBaseline = 'middle';
    g.font = 'italic 900 28px "Arial Black", "Segoe UI Black", Impact, sans-serif';
    g.fillStyle = '#1f5fb8'; g.fillText(titulo, 22, 34);
    g.fillStyle = '#ffffff'; g.fillText(titulo, 20, 31);
    this.botones = [];
  }

  botonTexto(x, y, w, h, texto, fn, activo = false) {
    const g = this.g;
    const i = this.botones.length;
    this.boton(x, y, w, h, fn);
    const sobre = this.sobreBoton && this.sobreBoton.x === x && this.sobreBoton.y === y;
    g.fillStyle = activo ? '#e8b42f' : sobre ? '#5aa0ff' : '#2a78ec';
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 3, w, 3);
    g.fillStyle = activo ? '#2a1d05' : '#ffffff';
    let tam = 16;
    do { g.font = `900 ${tam}px "Arial Black", "Segoe UI Black", Impact, sans-serif`; } while (g.measureText(texto).width > w - 6 && --tam > 9);
    g.textAlign = 'center'; g.fillText(texto, x + w / 2, y + h / 2); g.textAlign = 'left';
    return i;
  }
}

class CartelAjustes extends Cartel {
  constructor(M, J) {
    super(M, 384, 306, 2.4, 1.91, 0.9);
    this.J = J;
    this.dibujar();
  }
  dibujar() {
    const J = this.J, A = J.ajustes, g = this.g;
    this.fondo(t('aj.titulo'));
    const fila = (i) => 58 + i * 34;
    const etiqueta = (texto, y) => {
      g.fillStyle = '#3b2610';
      let tam = 17;
      do { g.font = `800 ${tam}px "Trebuchet MS", "Segoe UI", sans-serif`; } while (g.measureText(texto).width > 142 && --tam > 10);
      g.fillText(texto, 22, y + 13);
    };
    const barra = (i, clave, min, max, paso) => {
      const y = fila(i);
      etiqueta(t('aj.' + (clave === 'sens' ? 'mirar' : clave)), y);
      this.botonTexto(170, y, 28, 26, '−', () => { A[clave] = Math.max(min, +(A[clave] - paso).toFixed(2)); J.aplicarAjustes(); J.son.sfx('ui'); });
      const k = (A[clave] - min) / (max - min);
      for (let n = 0; n < 10; n++) {
        g.fillStyle = n < Math.round(k * 10) ? '#3fae4a' : 'rgba(59, 38, 16, 0.25)';
        g.fillRect(206 + n * 11, y + 4, 9, 18);
      }
      this.botonTexto(322, y, 28, 26, '+', () => { A[clave] = Math.min(max, +(A[clave] + paso).toFixed(2)); J.aplicarAjustes(); J.son.sfx('ui'); });
    };
    barra(0, 'musica', 0, 1, 0.1);
    barra(1, 'efectos', 0, 1, 0.1);
    barra(2, 'ambiente', 0, 1, 0.1);
    barra(3, 'sens', 0.3, 2.3, 0.2);
    const y4 = fila(4);
    etiqueta(t('aj.calidad'), y4);
    ['aj.baja', 'aj.media', 'aj.alta'].forEach((c, k) => this.botonTexto(170 + k * 62, y4, 58, 26, t(c), () => { A.calidad = k; J.aplicarAjustes(); J.son.sfx('ui'); }, A.calidad === k));
    const y5 = fila(5);
    etiqueta(t('aj.pixel'), y5);
    this.botonTexto(170, y5, 28, 26, '−', () => { A.pixel = Math.max(0, A.pixel - 1); J.aplicarAjustes(); J.son.sfx('ui'); });
    g.fillStyle = '#3b2610'; g.font = '900 16px "Arial Black", Impact, sans-serif'; g.textAlign = 'center';
    g.fillText(A.pixel ? `×${A.pixel}` : t('aj.auto'), 260, y5 + 13); g.textAlign = 'left';
    this.botonTexto(322, y5, 28, 26, '+', () => { A.pixel = Math.min(6, A.pixel + 1); J.aplicarAjustes(); J.son.sfx('ui'); });
    const y6 = fila(6);
    etiqueta(t('aj.idioma'), y6);
    Object.keys(IDIOMAS).forEach((c, k) => this.botonTexto(170 + k * 62, y6, 58, 26, c.toUpperCase(), () => { J.son.sfx('ui'); J.cambiarIdioma(c); }, idioma() === c));
    this.tex.needsUpdate = true;
  }
}

class CartelCreditos extends Cartel {
  constructor(M) {
    super(M, 384, 240, 2.4, 1.5, 0.95);
    this.dibujar();
  }
  dibujar() {
    const g = this.g;
    this.fondo(t('cr.titulo'));
    const F = '800 15px', f = '600 13px', A = '#1f5fb8', M = '#3b2610';
    const lineas = [[F, A, 'cr.1'], [f, M, 'cr.2'], [F, A, 'cr.3'], [f, M, 'cr.4'], [F, A, 'cr.5'], [f, M, 'cr.6'], [f, M, 'cr.7']].map(([a, b, c]) => [a, b, t(c)]);
    let y = 64;
    lineas.forEach(([fuente, color, texto], i) => {
      if (i > 0 && fuente.startsWith('800')) y += 8;
      g.font = `${fuente} "Trebuchet MS", "Segoe UI", sans-serif`;
      g.fillStyle = color; g.fillText(texto, 22, y, this.W - 40);
      y += 19;
    });
    this.tex.needsUpdate = true;
  }
}

// ── el menú ─────────────────────────────────────────────────────────────────
export class Menu {
  constructor(J) {
    this.J = J;
    this.el = document.getElementById('menu');
    this.elTitulo = document.getElementById('titulo');
    this.elOp = document.getElementById('opciones');
    this.elPie = document.getElementById('menuPie');
    this.elDom = document.getElementById('tableroDom');
    this.modo = null;
    this.t = 0;
    this.mouse = new THREE.Vector2();
    this.inc = new THREE.Vector2();          // inclinación suavizada (grados): x cabeceo, y giro
    this.meneo = 1;                          // 1 en el menú, menos en los carteles, 0 al entrar a jugar
    this.meneoObj = 1;
    this.base = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    this.vuelo = null;
    this.ray = new THREE.Raycaster();

    // los carteles, parte de la isla
    const M = J.mundo.M;
    this.ajustes = new CartelAjustes(M, J);
    this.creditos = new CartelCreditos(M);
    this.ubicar();
    J.escena.add(this.ajustes.grupo, this.creditos.grupo);

    addEventListener('pointermove', (ev) => {
      const [x, y] = aApp(ev.clientX, ev.clientY);
      this.mouse.set((x / pantalla.w) * 2 - 1, (y / pantalla.h) * 2 - 1);
      const c = this.cartelActivo();
      if (c && !this.vuelo) J.renderer.domElement.style.cursor = this.tocarCartel(c, ev, false) ? 'pointer' : '';
    });
    J.renderer.domElement.addEventListener('pointerdown', (ev) => {
      const c = this.cartelActivo();
      if (c && !this.vuelo) { J.son.iniciar(); this.tocarCartel(c, ev, true); }
    });
    // en la pausa el cartel se muestra plano, con su propio "volver" arriba
    this.volverDom = document.createElement('button');
    this.volverDom.className = 'volver';
    this.volverDom.textContent = t('menu.volver');
    this.volverDom.addEventListener('click', () => { J.son.sfx('uiSi'); this.abrir('pausa'); });
    this.elDom.appendChild(this.volverDom);
    // offsetX/Y ya vienen en el sistema del lienzo aunque la app esté girada
    this.elDom.addEventListener('pointerdown', (ev) => {
      if (ev.target !== this.ajustes.canvas) return;
      const cv = this.ajustes.canvas;
      this.ajustes.clic((ev.offsetX / cv.clientWidth) * cv.width, (ev.offsetY / cv.clientHeight) * cv.height);
      ev.preventDefault();
    });
    this.elDom.addEventListener('pointermove', (ev) => {
      if (ev.target !== this.ajustes.canvas) return;
      const cv = this.ajustes.canvas;
      this.elDom.style.cursor = this.ajustes.sobre((ev.offsetX / cv.clientWidth) * cv.width, (ev.offsetY / cv.clientHeight) * cv.height) ? 'pointer' : '';
    });
    addEventListener('keydown', (ev) => this.tecla(ev));
  }

  // Los carteles y los puntos de cámara salen de la choza y del muelle.
  ubicar() {
    const J = this.J, W = J.mundo, T = W.terreno;
    const C = W.choza.grupo.position.clone();
    const punta = W.muelle.punta.clone();
    const D = new THREE.Vector3(punta.x - C.x, 0, punta.z - C.z).normalize();   // hacia el mar
    const P = new THREE.Vector3(-D.z, 0, D.x);                                    // a lo largo de la playa
    this.D = D; this.P = P;
    const enPiso = (v) => { v.y = Math.max(T.altura(v.x, v.z), 0.1); return v; };
    // ajustes: clavado en la arena al costado de la choza, mirando al mar y un poco a la cámara
    const pa = enPiso(C.clone().addScaledVector(P, 7).addScaledVector(D, 0.5));
    this.ajustes.grupo.position.copy(pa).add({ x: 0, y: -0.12, z: 0 });
    const fa = D.clone().multiplyScalar(0.75).addScaledVector(P, -0.65).normalize();
    this.ajustes.grupo.rotation.y = Math.atan2(fa.x, fa.z);
    // créditos: en la punta del muelle, mirando a la isla
    const pc = punta.clone().addScaledVector(D, -0.4).addScaledVector(P, 0.25);
    this.creditos.grupo.position.copy(pc);
    const fc = D.clone().negate();
    this.creditos.grupo.rotation.y = Math.atan2(fc.x, fc.z);
    this.ajustes.grupo.updateMatrixWorld(true);
    this.creditos.grupo.updateMatrixWorld(true);
    // La toma principal: desde la arena, con la choza a la derecha y el muelle
    // entrando al mar. Se prueban tomas en orden de preferencia (elegidas
    // mirando capturas) y gana la primera con aire adelante: una roca o una
    // palmera a dos metros de la cámara tapa medio menú.
    const obst = [...W.rocas.decor, ...W.rocas.minables, ...W.veg.palmeras.map((p) => ({ x: p.x, z: p.z, r: 0.7 }))];
    const aireDe = (cp, mira) => {
      const f = new THREE.Vector3(mira.x - cp.x, 0, mira.z - cp.z).normalize();
      let aire = 12;
      for (const o of obst) {
        const dx = o.x - cp.x, dz = o.z - cp.z, t = dx * f.x + dz * f.z;
        if (t < -1 || t > 14) continue;
        if (Math.abs(dx * f.z - dz * f.x) - o.r < t * 1.2 + 1) aire = Math.min(aire, Math.max(0, Math.hypot(dx, dz) - o.r));
      }
      return aire;
    };
    // con el teléfono parado la pantalla es angosta: se mira más a la choza
    const parado = pantalla.w < pantalla.h;
    const tomas = parado
      ? [[-13, -3, 3.4, 2.5, -0.5], [-11, -5, 4.5, 2, 0], [-15, 0, 3, 3, -1]]
      : [[-12, -2, 3.0, 6, -2], [-10, -4, 4.5, 5, -1], [-14, 1, 2.6, 8, -4], [-9, 3, 2.4, 10, -3], [-16, -3, 3.4, 6, -3]];
    const q = new URLSearchParams(location.search).get('menuToma');
    if (q) tomas.unshift(q.split(',').map(Number));
    let elegida = null, mejorAire = -1;
    for (const [a, b, h, ma, mb] of tomas) {
      const cp = enPiso(C.clone().addScaledVector(P, a).addScaledVector(D, b));
      if (cp.y < 0.3 && !q) continue;
      cp.y += h;
      const mira = C.clone().addScaledVector(D, ma).addScaledVector(P, mb);
      mira.y = C.y + 1.1;
      const aire = q ? 99 : aireDe(cp, mira);
      if (aire > mejorAire) { mejorAire = aire; elegida = { cp, mira }; }
      if (aire >= 6) break;
    }
    const { cp, mira } = elegida;
    this.principal = { pos: cp, quat: mirarDesde(cp, mira) };
    this.vistaAjustes = this.ajustes.vista(2.75);
    this.vistaCreditos = this.creditos.vista(2.75);
  }

  cartelActivo() {
    if (this.modo === 'ajustes') return this.ajustes;
    return null;
  }

  tocarCartel(c, ev, clic) {
    const [x0, y0] = aApp(ev.clientX, ev.clientY);
    const ndc = new THREE.Vector2((x0 / pantalla.w) * 2 - 1, -(y0 / pantalla.h) * 2 + 1);
    this.ray.setFromCamera(ndc, this.J.camara);
    const hit = this.ray.intersectObject(c.cara, false)[0];
    if (!hit || !hit.uv) { if (!clic) c.sobre(-1, -1); return false; }
    const x = hit.uv.x * c.W, y = (1 - hit.uv.y) * c.H;
    return clic ? c.clic(x, y) : c.sobre(x, y);
  }

  // ── modos ────────────────────────────────────────────────────────────────
  abrir(modo, op = {}) {
    const J = this.J;
    const antes = this.modo;
    this.modo = modo;
    this.el.classList.remove('oculto');
    this.el.classList.toggle('pausa', modo === 'pausa' || modo === 'pausaAjustes');
    this.elDom.classList.toggle('oculto', modo !== 'pausaAjustes');
    if (op.desdeCamara) { this.base.pos.copy(J.camara.position); this.base.quat.copy(J.camara.quaternion); }
    this.textos();
    if (modo === 'principal' || modo === 'idioma') {
      this.meneoObj = 1;
      if (antes !== 'jugar' && antes !== 'confirmar' && antes !== 'idioma') this.volar(this.principal, antes ? 1.5 : 0);
    } else if (modo === 'ajustes') { this.meneoObj = 0.28; this.volar(this.vistaAjustes, 1.6); }
    else if (modo === 'creditos') { this.meneoObj = 0.35; this.volar(this.vistaCreditos, 1.8); }
    else if (modo === 'pausaAjustes' && this.ajustes.canvas.parentNode !== this.elDom) this.elDom.appendChild(this.ajustes.canvas);
  }

  // Título, opciones y pie del modo actual. Aparte de abrir(): al cambiar de
  // idioma se reescriben sin volver a volar la cámara.
  textos() {
    const J = this.J, modo = this.modo;
    const hay = J.hayPartida();
    const volver = (a) => ({ texto: t('menu.volver'), fn: () => this.abrir(a), chico: true });
    this.elTitulo.classList.toggle('oculto', modo === 'ajustes' || modo === 'creditos' || modo === 'pausaAjustes');
    this.volverDom.textContent = t('menu.volver');
    switch (modo) {
      case 'idioma':
        this.titulo(t('menu.la'), t('menu.isla'));
        this.opciones(Object.entries(IDIOMAS).map(([c, nombre]) => ({ texto: nombre.toUpperCase(), fn: () => { J.cambiarIdioma(c); this.abrir('principal'); } })));
        this.pie(t('menu.pieIdioma'));
        break;
      case 'principal':
        this.titulo(t('menu.la'), t('menu.isla'));
        this.opciones([
          { texto: t('menu.jugar'), fn: () => (hay ? this.abrir('jugar') : J.empezar(false)) },
          { texto: t('menu.ajustes'), fn: () => this.abrir('ajustes') },
          { texto: t('menu.creditos'), fn: () => this.abrir('creditos') },
        ]);
        this.pie(t('menu.pie'));
        break;
      case 'jugar':
        this.titulo(t('menu.la'), t('menu.isla'));
        this.opciones([
          { texto: t('menu.continuar'), fn: () => J.empezar(false) },
          { texto: t('menu.nueva'), fn: () => this.abrir('confirmar') },
          volver('principal'),
        ]);
        this.pie(J.resumenPartida());
        break;
      case 'confirmar':
        this.titulo(t('menu.deNuevo1'), t('menu.deNuevo2'));
        this.opciones([{ texto: t('menu.siBorrar'), fn: () => J.empezar(true) }, { texto: t('menu.no'), fn: () => this.abrir('jugar'), chico: true }]);
        this.pie(t('menu.pieBorrar'));
        break;
      case 'ajustes':
        this.opciones([volver('principal')]);
        this.pie(t('menu.pieCartel'));
        break;
      case 'creditos':
        this.opciones([volver('principal')]);
        this.pie(t('menu.pie'));
        break;
      case 'pausa':
        this.titulo(t('menu.pausa'), '');
        this.opciones([
          { texto: t('menu.continuar'), fn: () => J.continuar() },
          { texto: t('menu.ajustes'), fn: () => this.abrir('pausaAjustes') },
          { texto: t('menu.salir'), fn: () => J.salirAlMenu() },
        ]);
        this.pie(t('menu.pieGuarda'));
        break;
      case 'pausaAjustes':
        this.opciones([]);
        this.pie('');
        break;
      default: break;
    }
  }

  refrescar() {
    this.ajustes.dibujar();
    this.creditos.dibujar();
    if (this.modo && !(this.vuelo && this.vuelo.bloquea)) this.textos();
  }

  cerrar() {
    this.modo = null;
    this.el.classList.add('oculto');
    this.elDom.classList.add('oculto');
    this.J.renderer.domElement.style.cursor = '';
  }

  titulo(a, b) {
    this.elTitulo.innerHTML = '';
    for (const t of [a, b]) if (t) { const s = document.createElement('span'); s.textContent = t; this.elTitulo.appendChild(s); this.elTitulo.append(' '); }
  }
  pie(t) { this.elPie.textContent = t; }

  opciones(lista) {
    const J = this.J;
    this.elOp.innerHTML = '';
    for (const o of lista) {
      const b = document.createElement('button');
      b.textContent = o.texto;
      if (o.chico) b.className = 'chico';
      b.addEventListener('click', (ev) => { if (this.vuelo && this.vuelo.bloquea) return; J.son.iniciar(); J.son.sfx('uiSi'); o.fn(ev); });
      b.addEventListener('pointerenter', () => { J.son.sfx('ui'); for (const x of this.elOp.children) x.classList.remove('foco'); });
      this.elOp.appendChild(b);
    }
    this.foco = -1;
  }

  tecla(ev) {
    if (!this.modo || !this.J.estadoMenu()) return;
    if (ev.code === 'Escape' && this.modo === 'pausaAjustes') { this.abrir('pausa'); return; }
    const bs = [...this.elOp.children];
    if (!bs.length) return;
    if (ev.code === 'ArrowDown' || ev.code === 'ArrowUp') {
      this.foco = (this.foco + (ev.code === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length;
      bs.forEach((b, i) => b.classList.toggle('foco', i === this.foco));
      this.J.son.sfx('ui');
      ev.preventDefault();
    } else if ((ev.code === 'Enter' || ev.code === 'Space') && this.foco >= 0) { bs[this.foco].click(); ev.preventDefault(); }
    else if (ev.code === 'Escape') {
      const volver = bs.find((b) => b.textContent.startsWith('←'));
      if (volver) volver.click();
      else if (this.modo === 'pausa') this.J.continuar();
    }
  }

  // ── vuelos ───────────────────────────────────────────────────────────────
  volar(hacia, dur, alFin = null, bloquea = false) {
    if (!dur) { this.base.pos.copy(hacia.pos); this.base.quat.copy(hacia.quat); this.vuelo = null; if (alFin) alFin(); return; }
    const arco = Math.min(2.2, this.base.pos.distanceTo(hacia.pos) * 0.12);
    this.vuelo = { p0: this.base.pos.clone(), q0: this.base.quat.clone(), p1: hacia.pos.clone(), q1: hacia.quat.clone(), t: 0, dur, arco, alFin, bloquea };
  }

  // Del menú a los ojos del jugador: el meneo se apaga para que la última
  // imagen del vuelo sea exactamente la primera del juego.
  entrar(destino, alFin) {
    this.elOp.innerHTML = '';
    this.elTitulo.classList.add('oculto');
    this.pie('');
    this.meneoObj = 0;
    this.volar(destino, 1.5, alFin, true);
  }

  actualizar(dt) {
    const J = this.J;
    this.t += dt;
    const enPausa = this.modo === 'pausa' || this.modo === 'pausaAjustes';
    this.meneo += (this.meneoObj - this.meneo) * Math.min(1, dt * 2.5);
    if (this.vuelo) {
      const v = this.vuelo;
      v.t += dt;
      const u = Math.min(1, v.t / v.dur), k = suave(u);
      this.base.pos.lerpVectors(v.p0, v.p1, k);
      this.base.pos.y += Math.sin(Math.PI * k) * v.arco;
      this.base.quat.slerpQuaternions(v.q0, v.q1, k);
      if (u >= 1) { this.vuelo = null; if (v.alFin) v.alFin(); }
    }
    // inclinación hacia el mouse, suavizada con la velocidad del tutorial
    const objX = -this.mouse.y * MAX_TILT, objY = -this.mouse.x * MAX_TILT;
    const a = Math.min(1, dt * VELOCIDAD);
    this.inc.x += (objX - this.inc.x) * a;
    this.inc.y += (objY - this.inc.y) * a;
    // el texto se inclina con la cámara, como si estuviera en el mismo espacio
    const k = enPausa ? 0.5 : this.meneo;
    this.elTitulo.style.transform = `rotateY(${(-this.inc.y * 0.9 * k).toFixed(2)}deg) rotateX(${(this.inc.x * 0.7 * k).toFixed(2)}deg) rotate(-4deg)`;
    this.elOp.style.transform = `rotateY(${(-this.inc.y * 1.1 * k).toFixed(2)}deg) rotateX(${(this.inc.x * 0.8 * k).toFixed(2)}deg) rotate(-3deg)`;
    if (enPausa) return;
    const sx = Math.sin(this.t * VELOCIDAD) * INTENSIDAD, sy = Math.cos(this.t * VELOCIDAD) * INTENSIDAD;
    _e.set(g2r((this.inc.x + sx) * this.meneo), g2r((this.inc.y + sy) * this.meneo), 0, 'YXZ');
    // (la suavización dt·3 ya está en this.inc: suavizar dos veces la volvería gomosa)
    const cam = J.camara;
    cam.position.copy(this.base.pos);
    cam.quaternion.copy(this.base.quat).multiply(_q.setFromEuler(_e));
  }
}
