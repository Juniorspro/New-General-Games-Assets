/* ============================================================================
   aeroplaza/js/lentes.js — las lentes del visor (con SBS): cada ojo ya no es un
   rectángulo plano, es lo que se ve a través de una lupa.
   - LA LENTE AGRANDA MÁS LOS BORDES QUE EL CENTRO (almohadón): una grilla recta
     se ve curvada para afuera. Se corrige dibujando cada ojo "con barril"
     (curvado para adentro): cada punto de la pantalla, a r del centro de la
     lente, muestra lo que hay en la dirección tan = s·r·(1 + k1·(s·r)² +
     k2·(s·r)⁴) (el modelo de Cardboard: s es cuánto abarca la lente, k1 y k2 la
     curva). Así a través de la lente las rectas quedan rectas.
   - Cada ojo se dibuja primero entero y derecho, en su propio lienzo cuadrado
     (con el campo que hace falta para llegar al borde de la lente) y después un
     pase lo lleva a la pantalla con el barril, corrido al centro de SU lente
     (la separación y la altura de las lentes cambian con el visor y el celu).
   - Los colores: la lente separa un poco el rojo del azul en los bordes; se
     corrige leyendo cada color con otra escala.
   - El borde: afuera de la lente, negro (redondo, como en un visor).
   Los perfiles (Cardboard 1 y 2, un visor genérico, sin lentes) y lo que se
   ajusta a mano quedan guardados en este celu.
   ========================================================================== */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { t, sumar } from './textos.js';
import { Tablero } from './ventanas.js';

sumar({
  es: { le_titulo: 'Lentes del visor', le_texto: 'Elegí tu visor y ajustá hasta que las rectas se vean rectas y todo nítido. Se guarda en este celu.',
    le_plano: 'Sin lentes', le_plano_d: 'Las dos mitades planas, como antes', le_cardboard1: 'Cardboard 1', le_cardboard1_d: 'El de cartón de 2014', le_cardboard2: 'Cardboard 2', le_cardboard2_d: 'Cartón con botón (2015)',
    le_generico: 'Visor genérico', le_generico_d: 'VR Box, Shinecon y los de plástico', le_propio: 'A mi gusto', le_propio_d: 'Lo que ajustaste',
    le_k1: 'Curva', le_k2: 'Curva del borde', le_escala: 'Tamaño', le_separacion: 'Separación', le_alto: 'Altura', le_color: 'Colores', le_borde: 'Borde',
    le_grilla: 'Grilla de prueba', le_listo: 'Listo', le_probar: '👓 Probar con el visor', le_reset: 'Volver al perfil', le_menu: '👓 Lentes', le_solo_sbs: 'Las lentes son del modo con visor (SBS)',
    le_ayuda: 'Con el celu en el visor: tocá o pellizcá − y +, o mirá un botón un rato' },
  en: { le_titulo: 'Headset lenses', le_texto: 'Pick your headset and adjust until straight lines look straight and everything is sharp. Saved on this phone.',
    le_plano: 'No lenses', le_plano_d: 'Two flat halves, like before', le_cardboard1: 'Cardboard 1', le_cardboard1_d: 'The 2014 cardboard', le_cardboard2: 'Cardboard 2', le_cardboard2_d: 'Cardboard with button (2015)',
    le_generico: 'Generic headset', le_generico_d: 'VR Box, Shinecon and plastic ones', le_propio: 'My own', le_propio_d: 'What you adjusted',
    le_k1: 'Curve', le_k2: 'Edge curve', le_escala: 'Size', le_separacion: 'Separation', le_alto: 'Height', le_color: 'Colors', le_borde: 'Edge',
    le_grilla: 'Test grid', le_listo: 'Done', le_probar: '👓 Try it in the headset', le_reset: 'Back to preset', le_menu: '👓 Lenses', le_solo_sbs: 'Lenses are for headset mode (SBS)',
    le_ayuda: 'With the phone in the headset: touch or pinch − and +, or look at a button for a while' },
  pt: { le_titulo: 'Lentes dos óculos', le_texto: 'Escolha seus óculos e ajuste até as retas ficarem retas e tudo nítido. Fica salvo neste celular.',
    le_plano: 'Sem lentes', le_plano_d: 'As duas metades planas, como antes', le_cardboard1: 'Cardboard 1', le_cardboard1_d: 'O de papelão de 2014', le_cardboard2: 'Cardboard 2', le_cardboard2_d: 'Papelão com botão (2015)',
    le_generico: 'Óculos genérico', le_generico_d: 'VR Box, Shinecon e os de plástico', le_propio: 'Do meu jeito', le_propio_d: 'O que você ajustou',
    le_k1: 'Curva', le_k2: 'Curva da borda', le_escala: 'Tamanho', le_separacion: 'Separação', le_alto: 'Altura', le_color: 'Cores', le_borde: 'Borda',
    le_grilla: 'Grade de teste', le_listo: 'Pronto', le_probar: '👓 Testar nos óculos', le_reset: 'Voltar ao perfil', le_menu: '👓 Lentes', le_solo_sbs: 'As lentes são do modo com óculos (SBS)',
    le_ayuda: 'Com o celular nos óculos: toque ou faça a pinça no − e +, ou olhe um botão um tempo' },
});

/* los perfiles (los de Cardboard, de sus perfiles de visor; el genérico, un término medio de los de plástico) */
export const PERFILES = {
  plano: { k1: 0, k2: 0, escala: 1, separacion: 0, alto: 0, color: 0, borde: 9 },
  cardboard1: { k1: 0.441, k2: 0.156, escala: 0.9, separacion: 0, alto: 0, color: 0.01, borde: 1.12 },
  cardboard2: { k1: 0.34, k2: 0.55, escala: 0.82, separacion: 0, alto: 0, color: 0.012, borde: 1.08 },
  generico: { k1: 0.22, k2: 0.24, escala: 0.9, separacion: 0.02, alto: 0, color: 0.008, borde: 1.15 },
};
/* lo que se ajusta a mano: [de, a, paso] */
export const AJUSTES = { k1: [0, 0.9, 0.02], k2: [0, 0.9, 0.02], escala: [0.55, 1.4, 0.02], separacion: [-0.25, 0.25, 0.01], alto: [-0.25, 0.25, 0.01], color: [-0.03, 0.03, 0.002], borde: [0.7, 1.6, 0.02] };
const CLAVE = 'aeroplaza.lentes';
const TOPE_T = 2.2;          // lo más abierto que se dibuja cada ojo (tan del medio campo: ~131°)

/* tan que muestra un punto a r (en medios altos del ojo) del centro de la lente */
export const curva = (P, r) => { const x = P.escala * r, x2 = x * x; return x * (1 + P.k1 * x2 + P.k2 * x2 * x2); };
/* y al revés: a qué r de la pantalla cae una dirección de tan τ (Newton; la curva siempre sube) */
export function inversa(P, tau) {
  let r = tau / P.escala;
  for (let i = 0; i < 12; i++) { const x = P.escala * r, x2 = x * x, f = x * (1 + P.k1 * x2 + P.k2 * x2 * x2) - tau, df = P.escala * (1 + 3 * P.k1 * x2 + 5 * P.k2 * x2 * x2); r -= f / df; if (Math.abs(f) < 1e-6) break; }
  return r;
}

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = /* glsl */`
  uniform sampler2D tOjo; uniform vec2 uCentro; uniform float uAsp, uEsc, uK1, uK2, uT, uColor, uBorde, uGrilla;
  varying vec2 vUv;
  vec2 fuente(vec2 p, float k) { vec2 x = p * uEsc; float x2 = dot(x, x); return x * (1.0 + uK1 * x2 + uK2 * x2 * x2) * k / uT * 0.5 + 0.5; }
  float adentro(vec2 uv) { vec2 f = abs(uv - 0.5); return step(max(f.x, f.y), 0.5); }
  void main() {
    vec2 p = vec2((vUv.x * 2.0 - 1.0) * uAsp, vUv.y * 2.0 - 1.0) - uCentro;
    float r = length(p), borde = 1.0 - smoothstep(uBorde - 0.035, uBorde, r);
    vec2 uR = fuente(p, 1.0 - uColor), uG = fuente(p, 1.0), uB = fuente(p, 1.0 + uColor);
    vec3 c = vec3(texture2D(tOjo, uR).r * adentro(uR), texture2D(tOjo, uG).g * adentro(uG), texture2D(tOjo, uB).b * adentro(uB));
    /* (lo de cada ojo está en lineal, como todo lo que three dibuja a un lienzo: acá pasa a sRGB para la
       pantalla. Sin eso, con lentes todo salía oscuro y contrastado, vuelta 33) */
    c = sRGBTransferOETF(vec4(max(c, 0.0), 1.0)).rgb;
    /* (la grilla de prueba: rectas cada 0,4 de tan; a través de la lente tienen que verse rectas. Y el
       centro de la lente, un anillo: sirve para ajustar la separación y la altura) */
    if (uGrilla > 0.5) {
      vec2 q = (uG - 0.5) * 2.0 * uT / 0.4, g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), 1e-4);
      float l = 1.0 - min(min(g.x, g.y), 1.0);
      c = mix(c, vec3(1.0, 0.9, 0.25), l * 0.85);
      float rc = length(q) * 0.4, a = fwidth(rc);
      c = mix(c, vec3(1.0, 0.25, 0.3), smoothstep(0.045 + a, 0.045, rc) * smoothstep(0.02 - a, 0.02, rc));
    }
    gl_FragColor = vec4(c * borde, 1.0);
  }`;

export class Lentes {
  constructor() {
    this.tipo = 'generico'; this.P = { ...PERFILES.generico }; this.propio = null; this.grilla = false;
    try { const g = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (g && (PERFILES[g.tipo] || g.tipo === 'propio')) { this.tipo = g.tipo; this.P = { ...PERFILES.generico, ...(g.P || {}) }; this.propio = g.propio || (g.tipo === 'propio' ? { ...this.P } : null); } } catch { /* sin guardar */ }
    this.rt = [null, null]; this.lado = 0; this.T = 1;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tOjo: { value: null }, uCentro: { value: new THREE.Vector2() }, uAsp: { value: 1 }, uEsc: { value: 1 }, uK1: { value: 0 }, uK2: { value: 0 }, uT: { value: 1 }, uColor: { value: 0 }, uBorde: { value: 9 }, uGrilla: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  /* con lentes de verdad (sin lentes, el dibujo de siempre, sin el pase de más) */
  get activa() { return this.tipo !== 'plano'; }
  guardar() { try { localStorage.setItem(CLAVE, JSON.stringify({ tipo: this.tipo, P: this.P, propio: this.propio })); } catch { /* sin guardar */ } }
  /* un perfil; "a mi gusto" vuelve a lo último que se ajustó a mano */
  poner(tipo) { if (!PERFILES[tipo] && !(tipo === 'propio' && this.propio)) return; this.tipo = tipo; this.P = { ...(PERFILES[tipo] || this.propio) }; this.guardar(); }
  /* un ajuste a mano (paso: cuántos pasos, + o −): pasa a ser "a mi gusto" */
  ajustar(k, paso) {
    const [a, b, d] = AJUSTES[k]; if (this.tipo === 'plano') this.P = { ...PERFILES.generico };
    this.P[k] = +(Math.round(THREE.MathUtils.clamp(this.P[k] + paso * d, a, b) / d) * d).toFixed(4); this.tipo = 'propio'; this.propio = { ...this.P }; this.guardar();
  }
  /* (los deslizadores del menú) */
  fijar(k, v) { const [a, b] = AJUSTES[k]; if (this.tipo === 'plano') this.P = { ...PERFILES.generico }; this.P[k] = THREE.MathUtils.clamp(v, a, b); this.tipo = 'propio'; this.propio = { ...this.P }; this.guardar(); }
  /* el centro de la lente de cada ojo, en medios altos del ojo desde el centro de su mitad */
  centro(e, v = new THREE.Vector2()) { return v.set((e === 0 ? -1 : 1) * this.P.separacion, this.P.alto); }
  /* el tamaño del lienzo de cada ojo y cuánto abarca (tan del medio campo, T): lo que hace falta para
     llegar al punto de la mitad más lejos del centro de la lente (hasta el borde), sin pasarse de TOPE_T.
     El lado: que en el centro haya un píxel por píxel de pantalla (s/T en el centro) sin pasar de 1,25
     veces el alto del ojo (y 0,8 de eso fuera de la calidad alta) */
  medir(ew, eh, dpr, fino = true) {
    const asp = ew / eh, P = this.P, c = this.centro(0);
    const rx = asp + Math.abs(c.x), ry = 1 + Math.abs(c.y), rmax = Math.min(Math.hypot(rx, ry), P.borde);
    this.T = Math.min(TOPE_T, curva(P, rmax)); this.asp = asp;
    const lado = Math.round(Math.min(eh * dpr * this.T / P.escala, eh * dpr * 1.25) * (fino ? 1 : 0.8));
    if (lado !== this.lado) {
      this.lado = Math.max(64, lado);
      for (let i = 0; i < 2; i++) { this.rt[i]?.dispose(); this.rt[i] = new THREE.WebGLRenderTarget(this.lado, this.lado, { type: THREE.HalfFloatType, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); }
    }
    return this.T;
  }
  /* el campo vertical de cada ojo (grados) y su aspecto: el lienzo es cuadrado */
  get fovOjo() { return THREE.MathUtils.radToDeg(2 * Math.atan(this.T)); }
  /* los dos ojos (ya dibujados en rt[0] y rt[1]) a la pantalla, con el barril */
  componer(r, W, H) {
    const U = this.mat.uniforms, P = this.P;
    U.uAsp.value = this.asp; U.uEsc.value = P.escala; U.uK1.value = P.k1; U.uK2.value = P.k2; U.uT.value = this.T; U.uColor.value = P.color; U.uBorde.value = P.borde; U.uGrilla.value = this.grilla ? 1 : 0;
    r.setRenderTarget(null); r.setScissorTest(true);
    for (let e = 0; e < 2; e++) {
      const x = e * W / 2; r.setViewport(x, 0, W / 2, H); r.setScissor(x, 0, W / 2, H);
      U.tOjo.value = this.rt[e].texture; this.centro(e, U.uCentro.value);
      this.quad.render(r);
    }
    r.setScissorTest(false); r.setViewport(0, 0, W, H);
  }
  soltar() { for (let i = 0; i < 2; i++) { this.rt[i]?.dispose(); this.rt[i] = null; } this.lado = 0; }
}

/* ------------------------------------------ el panel para ajustarlas adentro del VR (con las manos o la mirada) */
const FILAS = ['k1', 'k2', 'escala', 'separacion', 'alto', 'color', 'borde'];
export class PanelLentes extends Tablero {
  constructor(L) {
    super(0.72, 0.52, 1024);
    this.L = L;
    const y0 = 118, alto = 70;
    this.botones = [];
    FILAS.forEach((k, i) => {
      const y = y0 + i * alto;
      this.botones.push({ id: `lente:${k}:-1`, texto: '−', x: 640, y, w: 110, h: 60 }, { id: `lente:${k}:1`, texto: '+', x: 880, y, w: 110, h: 60 });
    });
    const yb = y0 + FILAS.length * alto + 12;
    this.botones.push({ id: 'lente:perfil:-1', texto: '◀', x: 34, y: yb, w: 90, h: 70 }, { id: 'lente:perfil:1', texto: '▶', x: 404, y: yb, w: 90, h: 70 },
      { id: 'lente:grilla', texto: t('le_grilla'), x: 510, y: yb, w: 250, h: 70 }, { id: 'lente:listo', texto: t('le_listo'), principal: true, x: 776, y: yb, w: 214, h: 70 });
  }
  pintar() {
    const g = this.g, W = this.W, H = this.H, L = this.L;
    g.clearRect(0, 0, W, H);
    const c = g.createLinearGradient(0, 0, 0, H); c.addColorStop(0, 'rgba(236,250,255,0.95)'); c.addColorStop(1, 'rgba(150,214,246,0.92)');
    g.save(); g.shadowColor = 'rgba(40,150,220,0.45)'; g.shadowBlur = 26; g.fillStyle = c; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 40); g.fill(); g.restore();
    g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#0d3b5e'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '800 50px system-ui, sans-serif'; g.fillText('👓 ' + t('le_titulo'), 34, 70);
    g.font = '600 24px system-ui, sans-serif'; g.fillStyle = '#2a6f95'; g.fillText(t('le_ayuda'), 36, 102);
    FILAS.forEach((k, i) => {
      const y = 118 + i * 70, v = L.P[k];
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.roundRect(26, y - 2, W - 52, 64, 20); g.fill();
      g.fillStyle = '#0d3b5e'; g.font = '700 34px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t('le_' + k), 48, y + 31);
      /* (la barrita de dónde está entre lo menos y lo más) */
      const [a, b] = AJUSTES[k], f = (v - a) / (b - a);
      g.fillStyle = 'rgba(13,59,94,0.15)'; g.fillRect(360, y + 26, 250, 10); g.fillStyle = '#1a8fd8'; g.fillRect(360, y + 26, 250 * f, 10);
      g.textAlign = 'center'; g.font = '800 32px system-ui, sans-serif'; g.fillText(k === 'borde' && v >= 1.6 ? '—' : v.toFixed(k === 'color' ? 3 : 2), 815, y + 31);
    });
    const yb = 118 + FILAS.length * 70 + 12;
    g.textAlign = 'center'; g.font = '800 30px system-ui, sans-serif'; g.fillStyle = '#0d3b5e'; g.fillText(t('le_' + L.tipo), 264, yb + 36);
    for (const b of this.botones) if (b.id === 'lente:grilla') b.texto = t('le_grilla') + (L.grilla ? ' ✓' : '');
    this.dibujarBotones();
  }
}
export const ORDEN_PERFILES = ['plano', 'cardboard1', 'cardboard2', 'generico', 'propio'];
/* lo que hace un botón del panel (true si era de las lentes) */
export function accionLentes(L, id, panel) {
  if (!id.startsWith('lente:')) return false;
  const [, k, s] = id.split(':');
  if (k === 'perfil') {
    const O = ORDEN_PERFILES.filter((p) => p !== 'propio' || L.propio), n = O.length;
    L.poner(O[((O.indexOf(L.tipo) + +s) % n + n) % n]);
  }
  else if (k === 'grilla') L.grilla = !L.grilla;
  else if (k !== 'listo') L.ajustar(k, +s);
  if (panel) panel.sucio = true;
  return true;
}
