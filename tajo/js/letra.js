// La letra flotando delante del dragón, una palabra por vez, como en el video.
//
// Cada palabra se dibuja una sola vez en un lienzo (con su color y un halo) y
// se guarda: las del coro se repiten diez veces y no se vuelven a dibujar. El
// brillo de neón lo pone el revelado: la textura se multiplica por más de 1 y
// el bloom hace el resto.

import * as THREE from "../vendor/three.module.min.js";

const ANCHO = 1024, ALTO = 256;
const FUENTE = `"Montserrat", "Arial Black", "Roboto", system-ui, sans-serif`;

export class Letra {
  constructor(escena, { y = 6.3, z = -15, alto = 1.45 } = {}) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { tMapa: { value: null }, uFuerza: { value: 0 }, uEscala: { value: 1 } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tMapa; uniform float uFuerza;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tMapa, vUv);
          gl_FragColor = vec4(c.rgb * uFuerza, 1.0);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.malla.position.set(0, y, z);
    this.malla.renderOrder = 5;
    this.malla.visible = false;
    this.alto = alto;
    escena.add(this.malla);
    this.cache = new Map();
    this.lista = [];
    this.i = 0;
    this.actual = null;
    this.desde = 0;
  }

  cargar(letra) { this.lista = letra || []; this.i = 0; this.actual = null; this.malla.visible = false; }

  _textura(texto, color) {
    const k = texto + "|" + color;
    if (this.cache.has(k)) return this.cache.get(k);
    const lz = document.createElement("canvas");
    lz.width = ANCHO; lz.height = ALTO;
    const g = lz.getContext("2d");
    let tam = 168;
    g.font = `900 ${tam}px ${FUENTE}`;
    let w = g.measureText(texto).width;
    if (w > ANCHO - 60) { tam = Math.floor(tam * (ANCHO - 60) / w); g.font = `900 ${tam}px ${FUENTE}`; w = g.measureText(texto).width; }
    g.textAlign = "center"; g.textBaseline = "middle";
    const cx = ANCHO / 2, cy = ALTO / 2 + tam * 0.04;
    // Halo propio (el bloom se suma encima) y el tubo: color con centro claro.
    g.shadowColor = color; g.shadowBlur = 14;
    g.fillStyle = color;
    g.fillText(texto, cx, cy);
    g.shadowBlur = 0;
    const grad = g.createLinearGradient(0, cy - tam / 2, 0, cy + tam / 2);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.45, color); grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.globalAlpha = 0.55;
    g.fillText(texto, cx, cy);
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(lz);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const res = { tex, proporcion: Math.min(ANCHO, w + 80) / ALTO, ancho: ANCHO / ALTO };
    this.cache.set(k, res);
    if (this.cache.size > 90) { const primero = this.cache.keys().next().value; this.cache.get(primero).tex.dispose(); this.cache.delete(primero); }
    return res;
  }

  actualizar(t) {
    const l = this.lista;
    if (this.i > 0 && l[this.i - 1] && l[this.i - 1].t > t) { this.i = 0; }
    while (this.i < l.length && l[this.i].t <= t) this.i++;
    const w = l[this.i - 1];
    if (!w || t > w.hasta) { this.malla.visible = false; this.actual = null; return; }
    if (this.actual !== w) {
      this.actual = w;
      const { tex, ancho } = this._textura(w.texto, w.color);
      this.material.uniforms.tMapa.value = tex;
      this.malla.scale.set(this.alto * ancho, this.alto, 1);
      this.base = this.malla.scale.clone();
    }
    this.malla.visible = true;
    // Entra de golpe un poco más grande y se asienta; se apaga al final.
    const d = t - w.t;
    const pop = 1 + 0.14 * Math.exp(-d / 0.07);
    this.malla.scale.set(this.base.x * pop, this.base.y * pop, 1);
    const entra = Math.min(1, d / 0.04);
    const sale = Math.min(1, Math.max(0, (w.hasta - t) / 0.12));
    this.material.uniforms.uFuerza.value = 1.05 * entra * sale;
  }

  ocultar() { this.malla.visible = false; }
}
