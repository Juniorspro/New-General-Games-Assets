// Polvo y polen flotando en el aire.
//
// ES LO QUE HACE VISIBLE EL AIRE. En un bosque al atardecer los rayos de sol
// se ven porque hay algo flotando que los atraviesa; sin motas, el aire es
// vacío de computadora. Brillan casi nada de espaldas al sol y mucho de
// frente, como el polvo de verdad a contraluz.
//
// VIVEN EN UNA CAJA QUE VIAJA CON LA CÁMARA. Son 420 puntos en un cubo de
// 26 m; cuando uno se sale por un costado, el shader lo hace entrar por el
// opuesto (módulo). Así parecen llenar el bosque entero sin que haya que
// moverlas desde JavaScript ni sembrar un millón.
import * as THREE from "three";
import { NIEBLA_GLSL } from "./cielo.js";

export function armaMotas(sol) {
  const N = 420, L = 26;
  const pos = new Float32Array(N * 3), sem = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = Math.random() * L; pos[i * 3 + 1] = Math.random() * L * 0.45; pos[i * 3 + 2] = Math.random() * L;
    sem[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aS", new THREE.BufferAttribute(sem, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...NIEBLA_GLSL.uniforms,
      fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 },
      uT: { value: 0 }, uCentro: { value: new THREE.Vector3() }, uSol: { value: sol },
      uLado: { value: L },
    },
    vertexShader: `
      attribute float aS;
      uniform float uT, uLado;
      uniform vec3 uCentro;
      varying float vBrillo;
      varying vec3 vPosNiebla;
      varying vec3 vDirMundo;
      void main() {
        // deriva lenta y un poco de subibaja, cada una con su fase
        vec3 p = position + vec3(uT * (0.25 + aS * 0.2), sin(uT * 0.5 + aS * 30.0) * 0.4 + uT * 0.05, uT * 0.12);
        vec3 origen = uCentro - vec3(uLado * 0.5, 1.5, uLado * 0.5);
        p = origen + mod(p - origen, vec3(uLado, uLado * 0.45, uLado));
        // se apagan cerca de los bordes de la caja: si no, se ve dónde nacen
        vec3 rel = (p - uCentro) / vec3(uLado * 0.5, uLado * 0.3, uLado * 0.5);
        float borde = 1.0 - smoothstep(0.7, 1.0, max(abs(rel.x), max(abs(rel.y), abs(rel.z))));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vPosNiebla = mv.xyz;
        vDirMundo = normalize(p - cameraPosition);
        vBrillo = borde * (0.5 + 0.5 * sin(uT * (1.0 + aS * 2.0) + aS * 40.0));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.0 + aS * 1.2) * 50.0 / -mv.z, 1.0, 5.0);
      }`,
    fragmentShader: `
      #ifndef USE_FOG
      #define USE_FOG
      #endif
      ${NIEBLA_GLSL.PARS_F}
      uniform vec3 uSol;
      varying float vBrillo;
      varying vec3 vDirMundo;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float contra = pow(max(dot(vDirMundo, uSol), 0.0), 5.0);
        // de espaldas al sol casi no se ven: un punto blanco fijo en la sombra
        // parece nieve o un pixel muerto, no polvo
        float a = (1.0 - d * 2.0) * vBrillo * (0.012 + contra * 0.9);
        vec3 c = vec3(1.0, 0.82, 0.55) * (0.6 + contra * 3.0);
        gl_FragColor = vec4(nieblaDe(c, vPosNiebla) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  mat.fog = true;
  const puntos = new THREE.Points(g, mat);
  puntos.frustumCulled = false;
  puntos.name = "motas";
  puntos.renderOrder = 6;
  return {
    malla: puntos,
    paso(t, cam) { mat.uniforms.uT.value = t; mat.uniforms.uCentro.value.copy(cam.position); },
  };
}
