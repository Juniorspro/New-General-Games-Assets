/* ============================================================================
   nevada/js/post.js — lo que convierte el render en "video": el bloom de las
   luces, y una pasada final en el espacio de pantalla con el desenfoque de
   zoom y el barrido de las transiciones, la aberración cromática, la gradación
   fría (casi blanco y negro, con los negros levantados y un poco de azul en
   las sombras, como el video de referencia), la viñeta y el grano.
   Todo sale de uniformes que maneja el director cuadro a cuadro.
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uZoom: { value: 0 }, uCentro: { value: new THREE.Vector2(0.5, 0.5) },
    uBarrido: { value: new THREE.Vector2(0, 0) },
    uAberracion: { value: 0.0015 },
    uSaturacion: { value: 0.5 }, uContraste: { value: 1.08 }, uLevanta: { value: 0.035 }, uFrio: { value: 0.035 },
    uVineta: { value: 0.42 }, uGrano: { value: 0.045 }, uTiempo: { value: 0 },
    uDestello: { value: 0 }, uNegro: { value: 0 }, uExposicion: { value: 1 },
    uArcilla: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uZoom, uAberracion, uSaturacion, uContraste, uLevanta, uFrio, uVineta, uGrano, uTiempo, uDestello, uNegro, uExposicion, uArcilla;
    uniform vec2 uCentro, uBarrido;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 muestra(vec2 uv){
      /* aberración: el rojo y el azul se corren hacia afuera, más en los bordes y en los barridos */
      vec2 d = (uv - 0.5);
      float k = uAberracion * (1.0 + dot(d, d) * 6.0) + length(uBarrido) * 0.08 + uZoom * 0.02;
      return vec3(texture2D(tDiffuse, uv - d * k).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + d * k).b);
    }
    void main(){
      vec3 c = vec3(0.0);
      /* desenfoque de zoom (hacia el centro) y barrido direccional, en una sola
         pasada: 14 muestras a lo largo de la suma de los dos movimientos */
      vec2 dz = (vUv - uCentro) * uZoom * 0.22;
      vec2 db = uBarrido;
      float j = h(vUv * 913.0 + uTiempo) - 0.5;
      const int N = 14;
      float peso = 0.0;
      for (int i = 0; i < N; i++){
        float t = (float(i) + j) / float(N - 1) - 0.5;
        float w = 1.0 - abs(t) * 0.8;
        c += muestra(vUv - dz * t - db * t) * w; peso += w;
      }
      c /= peso;
      c *= uExposicion;
      /* la gradación: casi monocromo y frío; la arcilla conserva sus colores */
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 g = mix(vec3(l), c, mix(uSaturacion, 1.0, uArcilla));
      g = (g - 0.5) * mix(uContraste, 1.0, uArcilla) + 0.5;
      g = g * (1.0 - uLevanta) + uLevanta;
      g += vec3(-0.6, -0.1, 0.9) * uFrio * (1.0 - smoothstep(0.0, 0.7, l)) * (1.0 - uArcilla);
      /* viñeta */
      vec2 q = vUv - 0.5; q.x *= 0.8;
      g *= 1.0 - uVineta * smoothstep(0.25, 0.85, length(q) * 1.35);
      /* grano de película, que cambia en cada cuadro */
      g += (h(vUv * vec2(1231.0, 977.0) + fract(uTiempo * 7.13)) - 0.5) * uGrano;
      g = mix(g, vec3(1.0), uDestello);
      g *= 1.0 - uNegro;
      gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
    }`,
};

export function armarPost(renderer, escena, camara) {
  const tam = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType });
  const comp = new EffectComposer(renderer, rt);
  const render = new RenderPass(escena, camara);
  const bloom = new UnrealBloomPass(new THREE.Vector2(tam.x, tam.y), 0.3, 0.5, 1.6);
  const salida = new OutputPass();
  const final = new ShaderPass(FINAL);
  comp.addPass(render); comp.addPass(bloom); comp.addPass(salida); comp.addPass(final);
  return {
    comp, bloom, u: final.uniforms, render,
    tamano(w, h) { comp.setSize(w, h); bloom.resolution.set(w, h); },
  };
}
