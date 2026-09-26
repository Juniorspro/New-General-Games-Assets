/* ============================================================================
   aeroplaza/js/vr-dibujo.js — cómo se dibuja el VR para que vaya a lo que dé la
   pantalla (120 donde hay 120) sin bajar los gráficos.
   - El mundo se dibuja UNA vez por cuadro, desde el medio de los dos ojos y un
     poco más abierto (MARGEN), con toda la cadena de efectos (brillo, color,
     viñeta, estilos retro). Antes, con visor, se dibujaba dos veces y sin
     efectos.
   - Ese dibujo guarda la profundidad (1/z en el alfa) y cada ojo lo reproyecta:
     por la pose de la cabeza de ESE instante (el "timewarp" de los visores: la
     cabeza no espera al mundo) y corrido 3,2 cm con la profundidad (el
     paralaje: lo cerca se corre más). Es lo que hacía Crysis 2 en 3D.
   - Si el celu no llega a dibujar el mundo en cada cuadro, se dibuja partido:
     la mitad de arriba en un cuadro y la de abajo en el siguiente, y cada
     cuadro reproyecta el último completo con la cabeza nueva. La cabeza va a
     la velocidad de la pantalla y el mundo a la mitad; es lo que hacen los
     visores cuando no llegan.
   - La reproyección escribe la profundidad de cada ojo: lo que va encima (las
     manos, el rayo, el menú) se dibuja por ojo, con su paralaje de verdad, y
     queda tapado por lo que tenga adelante.
   ========================================================================== */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const MARGEN = 0.1;          // cuánto más abierto se dibuja el medio (para girar la cabeza sin ver el borde)
export const OJOS = 0.064;          // entre los ojos, en metros
export const DENSO = 1.12;

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/* el pase de cada ojo: de la pantalla del ojo, al rayo; del rayo, al dibujo del medio */
const REPROYECTA = /* glsl */`
  uniform sampler2D tCuadro;
  uniform vec2 uTanR, uTanE, uTexel;
  uniform mat3 uRot;          // del ojo (ahora) al medio (cuando se dibujó)
  uniform vec3 uTras;         // dónde está el ojo, visto desde el medio dibujado
  uniform float uCerca, uLejos, uFino;
  varying vec2 vUv;
  vec2 aUv(vec3 p) { return (p.xy / max(1e-4, -p.z)) / uTanR * 0.5 + 0.5; }
  /* Catmull-Rom con 5 lecturas (la receta de las TAA): el reproyectado no se ablanda */
  vec3 fino(vec2 uv) {
    vec2 tam = 1.0 / uTexel, p = uv * tam, c = floor(p - 0.5) + 0.5, f = p - c;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2, t0 = (c - 1.0) * uTexel, t3 = (c + 2.0) * uTexel, t12 = (c + w2 / w12) * uTexel;
    vec3 r = texture2D(tCuadro, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y)
           + texture2D(tCuadro, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
           + texture2D(tCuadro, t12).rgb * (w12.x * w12.y)
           + texture2D(tCuadro, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
           + texture2D(tCuadro, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
    float s = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
    return max(r / s, 0.0);
  }
  void main() {
    vec3 d = uRot * vec3((vUv * 2.0 - 1.0) * uTanE, -1.0);
    /* el punto del rayo que cae en el dibujo: se arranca de lejos (sin paralaje) y se
       corrige tres veces con la profundidad que hay ahí */
    vec2 uv = aUv(d);
    float w = 0.0;
    for (int i = 0; i < 3; i++) {
      w = texture2D(tCuadro, uv).a;
      float z = 1.0 / max(w, 1e-4), l = (-z - uTras.z) / min(d.z, -1e-3);
      uv = aUv(uTras + d * l);
    }
    vec3 col = uFino > 0.5 ? fino(uv) : texture2D(tCuadro, uv).rgb;
    /* el borde (si la cabeza giró más que el margen): se funde a oscuro en vez de estirar */
    vec2 fuera = max(vec2(0.0), abs(uv - 0.5) - 0.5);
    col *= 1.0 - smoothstep(0.0, 0.04, max(fuera.x, fuera.y));
    gl_FragColor = vec4(col, 1.0);
    /* la profundidad en el ojo, para lo que se dibuja encima */
    float z = 1.0 / max(w, 1e-4), l = (-z - uTras.z) / min(d.z, -1e-3);
    vec3 P = transpose(uRot) * (d * l);
    float ze = max(uCerca, -P.z);
    gl_FragDepth = clamp((uLejos + uCerca - 2.0 * uLejos * uCerca / ze) / (uLejos - uCerca) * 0.5 + 0.5, 0.0, 1.0);
  }`;

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _t = new THREE.Vector2();

function rtCuadro() {
  return new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
}

export class DibujoVR {
  constructor(motor) {
    this.motor = motor;
    this.camR = new THREE.PerspectiveCamera(70, 1, 0.1, 2400);   // la del medio, la que dibuja el mundo
    this.camOjo = new THREE.PerspectiveCamera(70, 1, 0.1, 2400); // la de cada ojo, para lo de encima
    this.cuadros = [rtCuadro(), rtCuadro()];
    this.salida = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.escena = null; this.nEsc = -1;
    this.listo = null;            // el último dibujo completo: { rt, q, p, tanR }
    this.fase = 0;                // en el partido: 0 = arriba (y sombras), 1 = abajo (y efectos)
    this.modo = 'completo';
    this.poseR = { q: new THREE.Quaternion(), p: new THREE.Vector3() };
    const U = motor.pFinal.uniforms;
    /* el final de siempre (motor.js), pero con la profundidad en el alfa */
    this.matFinal = new THREE.ShaderMaterial({
      /* (los uniformes son los mismos objetos que los del final: lo que main.js les pone, llega;
         menos la resolución, que es la del dibujo del medio, y la viñeta, que va por ojo) */
      uniforms: Object.assign({}, U, { tProf: { value: null }, uCerca: { value: 0.1 }, uLejos: { value: 2400 }, uRes: { value: new THREE.Vector2(1, 1) }, uVin: { value: 1 + MARGEN } }),
      vertexShader: motor.pFinal.material.vertexShader,
      fragmentShader: motor.pFinal.material.fragmentShader
        .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse, tProf; uniform float uCerca, uLejos, uVin;')
        .replace('vec2 v = vUv - 0.5;', 'vec2 v = (vUv - 0.5) * uVin;')
        .replace('gl_FragColor = vec4(col, 1.0);', 'float pz = texture2D(tProf, vUv).x; gl_FragColor = vec4(col, (uLejos - pz * (uLejos - uCerca)) / (uCerca * uLejos));'),
      depthTest: false, depthWrite: false,
    });
    this.qFinal = new FullScreenQuad(this.matFinal);
    this.matOjo = new THREE.ShaderMaterial({
      uniforms: { tCuadro: { value: null }, uTanR: { value: new THREE.Vector2(1, 1) }, uTanE: { value: new THREE.Vector2(1, 1) }, uTexel: { value: new THREE.Vector2(1, 1) }, uRot: { value: new THREE.Matrix3() }, uTras: { value: new THREE.Vector3() }, uCerca: { value: 0.05 }, uLejos: { value: 2400 }, uFino: { value: 1 } },
      vertexShader: VERT, fragmentShader: REPROYECTA,
      depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true,
    });
    this.qOjo = new FullScreenQuad(this.matOjo);
    this.stats = { escenas: 0, ojos: 0, msEscena: 0 };
  }
  /* el tamaño del dibujo del medio: el de un ojo, un MARGEN más grande */
  medir(sbs, fov) {
    const M = this.motor, W = M.ancho, H = M.alto, dpr = M.dpr;
    /* en alta, el medio se dibuja un 12 % más denso: al reproyectarlo no se ablanda (medido: sin eso
       quedaba un 7 % menos nítido que dibujar el ojo derecho) */
    const ew = sbs ? W / 2 : W, eh = H, k = 1 + MARGEN, den = M.nombreCalidad === 'alta' ? DENSO : 1;
    const w = Math.max(16, Math.round(ew * dpr * k * den)), h = Math.max(16, Math.round(eh * dpr * k * den));
    this.sbs = sbs; this.ew = ew; this.eh = eh; this.fovE = fov;
    this.tanE = new THREE.Vector2(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * ew / eh, Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    this.tanR = this.tanE.clone().multiplyScalar(k);
    /* el brillo, a la cuarta parte del dibujo (como en la pantalla normal, motor.medir, que lo
       vuelve a poner si cambia la pantalla: por eso va siempre) */
    M.pBloom.setSize(Math.max(16, Math.round(w / 2)), Math.max(16, Math.round(h / 2)));
    M.pBloom.highPassUniforms.uPaso.value.set(1 / w, 1 / h);
    if (this.w === w && this.h === h && this.escena) return;
    this.w = w; this.h = h;
    this.escena?.dispose();
    /* el mundo, con su profundidad en una textura (y el suavizado de bordes, si la calidad lo trae) */
    this.escena = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: M.msaa || 0, depthTexture: new THREE.DepthTexture(w, h) });
    this.nEsc = M.msaa;
    for (const c of this.cuadros) c.setSize(w, h);
    this.salida.setSize(w, h);
    this.matOjo.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.matFinal.uniforms.uRes.value.set(w, h);
    this.listo = null; this.fase = 0;
  }
  /* la cámara del medio sale de la del juego (que ya tiene la cabeza puesta) */
  ponerCamR(camJuego) {
    const c = this.camR;
    c.position.copy(camJuego.position); c.quaternion.copy(camJuego.quaternion);
    c.near = camJuego.near; c.far = camJuego.far;
    c.fov = THREE.MathUtils.radToDeg(Math.atan(this.tanR.y) * 2); c.aspect = this.tanR.x / this.tanR.y;
    c.updateMatrixWorld(); c.clearViewOffset();
    this.poseR.q.copy(c.quaternion); this.poseR.p.copy(c.position);
  }
  /* un pedazo del mundo (y = desde arriba, alto = cuántas filas; en píxeles del dibujo) */
  mundo(y0, alto, sombras) {
    const M = this.motor, r = M.r, rt = this.escena, c = this.camR;
    const entero = y0 === 0 && alto === this.h;
    if (entero) { c.clearViewOffset(); rt.scissorTest = false; rt.viewport.set(0, 0, this.w, this.h); }
    else {
      c.setViewOffset(this.w, this.h, 0, y0, this.w, alto);
      /* (el viewport de los destinos va desde abajo) */
      rt.viewport.set(0, this.h - y0 - alto, this.w, alto); rt.scissor.copy(rt.viewport); rt.scissorTest = true;
    }
    r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = sombras;
    r.setRenderTarget(rt);
    r.render(M.escena, c);
    rt.scissorTest = false; rt.viewport.set(0, 0, this.w, this.h); c.clearViewOffset();
  }
  /* los efectos sobre el mundo entero, y la profundidad al alfa: queda un dibujo "listo" */
  efectos(dt) {
    const M = this.motor, r = M.r, i = this.listo && this.listo.rt === this.cuadros[0] ? 1 : 0, dst = this.cuadros[i];
    if (M.Q.bloom) { M.pBloom.renderToScreen = false; M.pBloom.render(r, null, this.escena, dt, false); }
    M.pSalida.renderToScreen = false; M.pSalida.render(r, this.salida, this.escena);
    const U = this.matFinal.uniforms;
    U.tDiffuse.value = this.salida.texture; U.tProf.value = this.escena.depthTexture;
    U.uCerca.value = this.camR.near; U.uLejos.value = this.camR.far;
    r.setRenderTarget(dst); this.qFinal.render(r);
    this.listo = { rt: dst, q: this.poseR.q.clone(), p: this.poseR.p.clone(), tanR: this.tanR.clone() };
    this.stats.escenas++;
  }
  /* un cuadro de pantalla. partido: el mundo se dibuja de a medias (arriba en un cuadro, abajo y
     los efectos en el siguiente); encima(ojo, i): lo que va por ojo (las manos); camJuego: la
     cabeza de ahora */
  cuadro(dt, camJuego, { partido = false, encima = null, fino = true } = {}) {
    const M = this.motor, r = M.r;
    if (this.nEsc !== M.msaa) { this.w = 0; this.medir(this.sbs, this.fovE); }
    const t0 = performance.now();
    /* las sombras, como en la pantalla (sombraCada: en el celu, un dibujo sí y uno no) */
    const sombras = () => !this.listo || ((this.nSombra = (this.nSombra || 0) + 1) % (M.Q.sombraCada || 1)) === 0;
    if (!partido || !this.listo) { this.ponerCamR(camJuego); this.mundo(0, this.h, sombras()); this.efectos(dt); this.fase = 0; }
    else if (this.fase === 0) { this.ponerCamR(camJuego); this.mundo(0, Math.floor(this.h / 2), sombras()); this.fase = 1; }
    else { const h2 = Math.floor(this.h / 2); this.mundo(h2, this.h - h2, false); this.efectos(dt); this.fase = 0; }
    this.stats.msEscena = performance.now() - t0;
    /* los ojos */
    const L = this.listo;
    r.setRenderTarget(null);
    r.getSize(_t);
    const W = _t.x, H = _t.y, n = this.sbs ? 2 : 1, U = this.matOjo.uniforms;
    U.tCuadro.value = L.rt.texture; U.uTanR.value.copy(L.tanR); U.uTanE.value.copy(this.tanE); U.uFino.value = fino ? 1 : 0;
    U.uCerca.value = 0.05; U.uLejos.value = camJuego.far;
    const qRi = _q.copy(L.q).invert();
    const auto = r.autoClear; r.autoClear = false;
    r.setScissorTest(true);
    for (let e = 0; e < n; e++) {
      const x = e * W / n, lado = n === 1 ? 0 : e === 0 ? -1 : 1;
      r.setViewport(x, 0, W / n, H); r.setScissor(x, 0, W / n, H);
      /* el ojo: la cabeza de ahora, corrida medio ojo al costado */
      const ojo = this.camOjo;
      ojo.position.set(lado * OJOS / 2, 0, 0).applyQuaternion(camJuego.quaternion).add(camJuego.position);
      ojo.quaternion.copy(camJuego.quaternion);
      /* uRot = (medio)^-1 · (ojo); uTras = (medio)^-1 · (ojo - medio) */
      _m4.makeRotationFromQuaternion(_q2.multiplyQuaternions(qRi, ojo.quaternion));
      U.uRot.value.setFromMatrix4(_m4);
      U.uTras.value.copy(_v.copy(ojo.position).sub(L.p).applyQuaternion(qRi));
      this.qOjo.render(r);   // (escribe todo el color y la profundidad: no hace falta borrar)
      if (encima) {
        ojo.near = 0.05; ojo.far = camJuego.far; ojo.fov = THREE.MathUtils.radToDeg(Math.atan(this.tanE.y) * 2); ojo.aspect = this.tanE.x / this.tanE.y;
        ojo.updateProjectionMatrix(); ojo.updateMatrixWorld();
        encima(ojo, e);
      }
    }
    r.setScissorTest(false); r.setViewport(0, 0, W, H); r.autoClear = auto;
    this.stats.ojos++;
  }
  soltar() { this.escena?.dispose(); this.escena = null; for (const c of this.cuadros) c.setSize(4, 4); this.salida.setSize(4, 4); this.w = 0; this.listo = null; }
}
