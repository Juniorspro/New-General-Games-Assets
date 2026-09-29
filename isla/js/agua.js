// El mar: turquesa donde es bajo, azul donde es hondo, transparente para ver
// la arena y las cáusticas del fondo, con espuma en la orilla. Pixelado en el
// mundo como todo lo demás: el agua también tiene texels.
//
// Refleja de verdad, como en el original (las nubes y la luna en el mar de
// noche): una cámara espejada bajo el nivel del agua dibuja lo que está en la
// capa 1 (cielo, nubes, palmeras, choza, muelle) en una textura chica, y el
// agua la lee proyectando su punto con esa cámara, corrido por las ondas.
import * as THREE from '../vendor/three.module.min.js';
import { LUZ, LUZ_GLSL } from './material.js';
import { MITAD, TAM } from './terreno.js';

const VERT = /* glsl */ `
varying vec3 vMundo;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vMundo = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`;

const FRAG = /* glsl */ `
#include <packing>
uniform float uT;
uniform float uNivelAgua;
uniform sampler2D uAlturas;
uniform vec4 uRect;
uniform vec3 uPoco;
uniform vec3 uMedio;
uniform vec3 uHondo;
uniform vec3 uCenit;
uniform float uNoche;
uniform sampler2D uReflejo;
uniform mat4 uMatReflejo;
uniform float uHayReflejo;
varying vec3 vMundo;
${LUZ_GLSL}
void main() {
  vec3 p = vMundo;
  vec2 t = p.xz * 12.0;
  vec2 c = floor(t) + 0.5;
  vec3 pc = vec3(c.x / 12.0, uNivelAgua, c.y / 12.0);
  vec2 uv = (pc.xz - uRect.xy) * uRect.zw;
  float h = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? -9.5 : texture2D(uAlturas, uv).r;
  float prof = uNivelAgua - h;
  if (prof < -0.02) discard;
  vec2 g = vec2(
    cos(pc.x * 0.8 + uT * 1.2) * 0.05 + cos((pc.x + pc.z) * 0.5 + uT * 0.8) * 0.03 + cos(pc.x * 2.3 - uT * 2.1) * 0.015,
    cos(pc.z * 0.7 - uT * 1.0) * 0.05 + cos((pc.x + pc.z) * 0.5 + uT * 0.8) * 0.03 + cos(pc.z * 2.1 + uT * 1.7) * 0.015);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - pc);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 col = mix(uPoco, uMedio, smoothstep(0.4, 2.6, prof));
  col = mix(col, uHondo, smoothstep(2.6, 8.0, prof));
  float sombra;
  vec3 luz = luzEn(pc, vec3(0.0, 1.0, 0.0), sombra);
  col *= luz;
  vec3 R = reflect(-V, n);
  vec3 cielo = mix(uNieblaColor, uCenit, clamp(R.y * 1.6, 0.0, 1.0));
  if (uHayReflejo > 0.5) {
    // el punto del agua, corrido por la onda, visto desde la cámara espejada:
    // de cerca las ondas lo rompen en rayas, de lejos queda casi espejo
    vec4 pr = uMatReflejo * vec4(pc.x + n.x * 1.6, uNivelAgua, pc.z + n.z * 1.6, 1.0);
    cielo = texture2DProj(uReflejo, pr).rgb;
  }
  // lo hondo refleja más que lo bajo, donde se ve la arena
  float kr = mix(fres * 0.65, 0.32 + fres * 0.6, smoothstep(0.8, 5.0, prof));
  col = mix(col, cielo, kr);
  col += uSolColor * pow(max(dot(R, uSolDir), 0.0), 350.0) * 2.5;
  // destellos sueltos en los texels, como sol sobre el agua
  float dest = h12(c + floor(uT * 2.5) * 7.13);
  col += vec3(1.0) * step(0.9975, dest) * step(0.5, prof) * (1.0 - uNoche) * 0.9;
  // espuma: una línea que va y viene en la orilla
  float ola = 0.16 + 0.08 * sin(uT * 1.25 + (pc.x + pc.z) * 0.35);
  float espuma = 1.0 - step(ola, prof);
  float espuma2 = step(ola + 0.07, prof) * (1.0 - step(ola + 0.12, prof)) * step(0.5, h12(c * 0.5 + 3.0));
  vec3 blanco = vec3(0.96, 0.99, 1.0) * (luz * 0.7 + 0.25);
  col = mix(col, blanco, max(espuma, espuma2 * 0.8));
  float alfa = mix(0.42, 0.95, smoothstep(0.0, 4.0, prof));
  alfa = max(alfa, fres * 0.75);
  alfa = max(alfa, max(espuma, espuma2 * 0.8));
  gl_FragColor = vec4(terminar(col, pc), alfa);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function crearAgua(terreno, cielo) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...LUZ,
      uAlturas: { value: terreno.texAltura },
      uRect: { value: new THREE.Vector4(-MITAD, -MITAD, 1 / TAM, 1 / TAM) },
      uPoco: { value: new THREE.Color(0x66e6da) },
      uMedio: { value: new THREE.Color(0x18b4d4) },
      uHondo: { value: new THREE.Color(0x0a4ea6) },
      uCenit: cielo.uni.uCenit,
      uNoche: cielo.uni.uNoche,
      uReflejo: { value: null },
      uMatReflejo: { value: new THREE.Matrix4() },
      uHayReflejo: { value: 0 },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false,
  });
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), mat);
  agua.renderOrder = 2;
  agua.frustumCulled = false;
  agua.userData.agua = true;
  return agua;
}

// La cámara espejada y su textura. La imagen es un cuarto de la pantalla: el
// reflejo se rompe en ondas y más detalle no se nota.
const _v = new THREE.Vector3(), _u = new THREE.Vector3();
export class Reflejo {
  constructor(agua) {
    this.agua = agua;
    this.rt = new THREE.WebGLRenderTarget(256, 144, { depthBuffer: true });
    this.cam = new THREE.PerspectiveCamera();
    this.cam.layers.set(1);
    this.activo = true;
    const U = agua.material.uniforms;
    U.uReflejo.value = this.rt.texture;
    this.mat = U.uMatReflejo.value;
  }

  tamano(w, h) { this.rt.setSize(Math.max(64, Math.round(w / 4)), Math.max(36, Math.round(h / 4))); }

  dibujar(renderer, escena, camara, domo, nivel = 0) {
    const U = this.agua.material.uniforms;
    U.uHayReflejo.value = this.activo ? 1 : 0;
    if (!this.activo) return;
    const c = this.cam;
    const fwd = camara.getWorldDirection(_v);
    c.position.set(camara.position.x, 2 * nivel - camara.position.y, camara.position.z);
    _u.set(0, 1, 0).applyQuaternion(camara.quaternion);
    c.up.set(_u.x, -_u.y, _u.z);
    c.lookAt(camara.position.x + fwd.x, 2 * nivel - (camara.position.y + fwd.y), camara.position.z + fwd.z);
    c.projectionMatrix.copy(camara.projectionMatrix);
    c.projectionMatrixInverse.copy(camara.projectionMatrixInverse);
    c.updateMatrixWorld();
    this.mat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
    // el cielo sigue a la cámara que mira: se centra en la espejada mientras tanto
    const antes = domo.position.clone();
    domo.position.copy(c.position); domo.updateMatrixWorld();
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;   // la sombra ya está: no se vuelve a dibujar
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(escena, c);
    renderer.setRenderTarget(null);
    renderer.shadowMap.autoUpdate = auto;
    domo.position.copy(antes); domo.updateMatrixWorld();
  }
}
