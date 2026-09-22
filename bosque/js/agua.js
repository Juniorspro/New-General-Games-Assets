// El lago.
//
// EL REFLEJO SALE DEL MISMO PANORAMA QUE EL CIELO, más un truco: abajo del
// horizonte reflejado el agua se oscurece hacia el verde del bosque. Un reflejo
// de verdad del bosque pediría dibujar la escena dos veces por cuadro (una
// patas arriba), y en un teléfono eso es la mitad de los cuadros. Mirando el
// lago desde la orilla, lo que refleja la franja de abajo SIEMPRE es la línea
// de árboles de la orilla de enfrente: oscura y más o menos pareja. Ese es el
// reflejo que se finge, y en un atardecer con bruma no se distingue.
import * as THREE from "three";
import { MUNDO, LUGARES } from "./config.js";
import { altura } from "./terreno.js";
import { NIEBLA_GLSL } from "./cielo.js";

export function armaAgua(tex, texCielo, sol) {
  const L = LUGARES.lago;
  const lado = L.radio * 2.9;
  const g = new THREE.PlaneGeometry(lado, lado, 96, 96);
  g.rotateX(-Math.PI / 2);
  g.translate(L.x, MUNDO.AGUA, L.z);
  const pos = g.attributes.position;
  const hondo = new Float32Array(pos.count);
  for (let k = 0; k < pos.count; k++) hondo[k] = MUNDO.AGUA - altura(pos.getX(k), pos.getZ(k));
  g.setAttribute("aHondo", new THREE.BufferAttribute(hondo, 1));
  // los triángulos que quedan enteros debajo de la tierra no se dibujan: la
  // prueba de profundidad los descartaría igual, pero después de pintarlos
  const idx = g.index.array, nuevo = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (hondo[a] > -0.4 || hondo[b] > -0.4 || hondo[c] > -0.4) nuevo.push(a, b, c);
  }
  g.setIndex(nuevo);

  tex.aguaN.wrapS = tex.aguaN.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...NIEBLA_GLSL.uniforms,
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0 },
      tNormal: { value: tex.aguaN },
      tCielo: { value: texCielo },
      uSol: { value: sol },
      uSolColor: { value: new THREE.Color(1.0, 0.72, 0.45) },
      uT: { value: 0 },
      uBosque: { value: new THREE.Color(0.018, 0.028, 0.02) },
      uHondo: { value: new THREE.Color(0.012, 0.03, 0.03) },
    },
    vertexShader: `
      attribute float aHondo;
      varying float vHondo;
      varying vec3 vPosW;
      varying vec3 vPosNiebla;
      void main() {
        vHondo = aHondo;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPosW = w.xyz;
        vec4 mv = viewMatrix * w;
        vPosNiebla = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      #ifndef USE_FOG
      #define USE_FOG
      #endif
      ${NIEBLA_GLSL.PARS_F}
      uniform sampler2D tNormal, tCielo;
      uniform vec3 uSol, uSolColor, uBosque, uHondo;
      uniform float uT;
      varying float vHondo;
      varying vec3 vPosW;
      vec2 equirect(vec3 d) {
        return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
      }
      void main() {
        // dos capas de olas que viajan en direcciones distintas: una sola se
        // ve como una textura arrastrada, dos se ven como agua
        vec2 a = texture2D(tNormal, vPosW.xz * 0.045 + uT * vec2(0.011, 0.006)).xy * 2.0 - 1.0;
        vec2 b = texture2D(tNormal, vPosW.xz * 0.12 + uT * vec2(-0.009, 0.016)).xy * 2.0 - 1.0;
        vec3 V = normalize(cameraPosition - vPosW);
        // LAS OLAS SE APLANAN CON LA DISTANCIA. Lejos, cada pixel promedia
        // muchas olas, y con la normal a toda fuerza el reflejo salta entre
        // cielo y bosque de pixel a pixel: manchones blancos que titilan.
        float lejos = smoothstep(8.0, 70.0, length(cameraPosition - vPosW));
        float fuerza = mix(0.3, 0.07, lejos);
        vec3 N = normalize(vec3((a.x + b.x * 0.6) * fuerza, 1.0, (a.y + b.y * 0.6) * fuerza));
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 cielo = texture2D(tCielo, equirect(R)).rgb * 1.25;
        vec3 refl = mix(uBosque, cielo, smoothstep(0.02, 0.32, R.y));
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        // el camino de brillos hacia el sol: un lóbulo angosto y fuerte más
        // uno ancho y suave
        float cs = max(dot(R, uSol), 0.0);
        vec3 brillo = uSolColor * (pow(cs, 900.0) * 30.0 + pow(cs, 90.0) * 1.1);
        vec3 col = mix(uHondo, refl, F) + brillo;
        // en lo bajo se ve el fondo: el alfa sube con la profundidad
        float alfa = mix(max(F, 0.12), 1.0, smoothstep(0.1, 1.6, vHondo));
        // la línea de la orilla, apenas más clara: el agua que lame la tierra
        col += vec3(0.02, 0.02, 0.018) * (1.0 - smoothstep(0.0, 0.1, vHondo));
        gl_FragColor = vec4(nieblaDe(col, vPosNiebla), alfa);
      }`,
    transparent: true, depthWrite: false,
  });
  // three llena fogColor y fogDensity solo si el material dice que usa niebla
  mat.fog = true;
  const malla = new THREE.Mesh(g, mat);
  malla.name = "lago";
  malla.renderOrder = 2;
  return { malla, mat };
}
