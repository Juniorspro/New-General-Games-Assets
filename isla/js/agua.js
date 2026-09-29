// El mar: turquesa donde es bajo, azul donde es hondo, transparente para ver
// la arena y las cáusticas del fondo, con espuma en la orilla. Pixelado en el
// mundo como todo lo demás: el agua también tiene texels.
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
  col = mix(col, cielo, fres * 0.65);
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
  float alfa = mix(0.32, 0.94, smoothstep(0.0, 4.5, prof));
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
      uPoco: { value: new THREE.Color(0x8ff3e8) },
      uMedio: { value: new THREE.Color(0x2cc3dc) },
      uHondo: { value: new THREE.Color(0x0b66b5) },
      uCenit: cielo.uni.uCenit,
      uNoche: cielo.uni.uNoche,
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
