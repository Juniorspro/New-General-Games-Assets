// El escenario: el dragón con cuernos de placas, las alas de neón en red, las
// rocas con rayas azules, los láseres, la pista negra con su panel de LEDs y
// el piso que refleja.
//
// Todo se arma con código (cero archivos) y se une por material: son seis
// llamadas de dibujo para el escenario entero, más sus reflejos.
//
// LA REGLA DE LA LUZ. Nada del escenario tiene color propio salvo el negro:
// todo lo que brilla lee su color del grupo de luces que le toca (luces.js).
// Así una sola orden ("el fondo se pone azul") cambia el cielo, el borde de
// las siluetas, la niebla y el reflejo en el piso a la vez, como en el juego
// original.

import * as THREE from "../vendor/three.module.min.js";
import { G } from "./constantes.js";
import { unir, marcar, cinta, barra, prisma, cajaOrientada } from "./geo.js";
import { crearAzar } from "./azar.js";

export const PISO_Y = -3.0;          // el piso de abajo, el que refleja
export const PISTA = { ancho: 3.3, tope: 0.25, frente: -1.3, fondo: -52, base: -0.5 };

const LUZ_GLSL = /* glsl */`
uniform vec3 uLuzColor[8];
uniform float uLuzInt[8];
vec3 luzDe(float g) { int i = int(g + 0.5); return uLuzColor[i] * uLuzInt[i]; }
`;

// ─────────────────────────── materiales ───────────────────────────

function matOscuro(U, reflejo = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uBase: { value: new THREE.Color(0.012, 0.010, 0.022) }, uReflejo: { value: reflejo } },
    vertexShader: LUZ_GLSL + /* glsl */`
      attribute float aGrupo; attribute float aRayas;
      varying vec3 vPos; varying vec3 vNormal; varying vec3 vLuz; varying vec3 vFondo; varying float vRayas;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPos = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vLuz = luzDe(aGrupo);
        vFondo = uLuzColor[0] * uLuzInt[0];
        vRayas = aRayas;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBase; uniform float uReflejo;
      varying vec3 vPos; varying vec3 vNormal; varying vec3 vLuz; varying vec3 vFondo; varying float vRayas;
      void main() {
        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 3.0);
        vec3 c = uBase * (0.55 + 0.45 * max(n.y, 0.0));
        // El resplandor de atrás recorta las siluetas: sólo los bordes que
        // miran de costado se prenden, como una luz de contra.
        c += vFondo * (0.025 + fres * 0.30);
        // Las rayas: horizontales, cada ~1,1 m, sólo en las caras que miran a
        // la pista. En la cara de atrás no se ven y serían brillo gastado.
        float r = abs(fract(vPos.y * 0.62) - 0.5);
        float raya = smoothstep(0.055, 0.012, r);
        float cara = clamp(dot(n, normalize(vec3(-sign(vPos.x) * 0.9, 0.0, 1.0))) * 1.6, 0.0, 1.0);
        c += vLuz * raya * cara * vRayas * 1.5;
        float d = length(vPos - cameraPosition);
        float niebla = 1.0 - exp(-d * 0.011);
        c = mix(c, vFondo * 0.16, niebla * 0.85);
        gl_FragColor = vec4(c * uReflejo, 1.0);
      }`,
  });
}

function matNeon(U, reflejo = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uReflejo: { value: reflejo } },
    vertexShader: LUZ_GLSL + /* glsl */`
      attribute float aPerfil; attribute float aGrupo; attribute float aFuerza; attribute float aLargo; attribute float aFase;
      uniform float uTiempo;
      varying float vPerfil; varying vec3 vLuz;
      void main() {
        vPerfil = aPerfil;
        // Un brillo que recorre la cinta: las alas "respiran" aunque la luz
        // esté quieta.
        float onda = 0.82 + 0.18 * sin(aLargo * 18.0 - uTiempo * 5.0 + aFase);
        vLuz = luzDe(aGrupo) * aFuerza * onda;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uReflejo;
      varying float vPerfil; varying vec3 vLuz;
      void main() {
        float p = abs(vPerfil);
        float nucleo = 1.0 - smoothstep(0.0, 1.0, p);
        float i = nucleo * nucleo * 2.2 + (1.0 - smoothstep(0.2, 1.0, p)) * 0.35;
        gl_FragColor = vec4(vLuz * i * uReflejo, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

function matHaz(U, reflejo = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uReflejo: { value: reflejo } },
    vertexShader: LUZ_GLSL + /* glsl */`
      attribute vec3 aA; attribute vec3 aB; attribute vec2 aAncho;
      attribute float aLado; attribute float aFin; attribute float aGrupo; attribute float aFase;
      attribute float aTipo; attribute float aAng; attribute float aLargoHaz;
      uniform float uTiempo; uniform float uAbanico;
      varying float vU; varying float vV; varying vec3 vLuz;
      void main() {
        vec3 A = aA, B = aB;
        if (aTipo > 0.5) {
          float ang = aAng + sin(uAbanico + aFase) * 0.32;
          B = A + vec3(cos(ang), sin(ang), 0.0) * aLargoHaz;
        } else {
          float m = sin(uTiempo * 0.55 + aFase) * 0.4;
          A.x += m; B.x += m * 0.15;
        }
        vec3 Aw = (modelMatrix * vec4(A, 1.0)).xyz;
        vec3 Bw = (modelMatrix * vec4(B, 1.0)).xyz;
        vec3 P = mix(Aw, Bw, aFin);
        vec3 dir = normalize(Bw - Aw);
        vec3 aCam = normalize(cameraPosition - P);
        vec3 lado = normalize(cross(dir, aCam));
        P += lado * aLado * mix(aAncho.x, aAncho.y, aFin);
        vU = aLado; vV = aFin;
        vLuz = luzDe(aGrupo);
        gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uReflejo;
      varying float vU; varying float vV; varying vec3 vLuz;
      void main() {
        float u2 = vU * vU;
        float i = exp(-u2 * 5.0) * 0.55 + exp(-u2 * 70.0) * 3.2;
        i *= smoothstep(0.0, 0.03, vV) * (1.0 - smoothstep(0.45, 1.0, vV));
        gl_FragColor = vec4(vLuz * i * uReflejo, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

function matCielo(U) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uCentro: { value: new THREE.Vector2(0, 21) } },
    vertexShader: /* glsl */`
      varying vec2 vXY;
      void main() { vXY = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLuzColor[8]; uniform float uLuzInt[8]; uniform vec2 uCentro;
      varying vec2 vXY;
      void main() {
        vec3 f = uLuzColor[0] * uLuzInt[0];
        vec2 d = (vXY - uCentro) / vec2(95.0, 62.0);
        float r2 = dot(d, d);
        float halo = exp(-r2 * 2.2) * 0.55 + exp(-r2 * 12.0) * 0.6;
        // Una franja más clara a la altura del horizonte: la bruma del fondo.
        float bruma = exp(-abs(vXY.y - 2.0) / 22.0) * 0.45;
        vec3 c = f * (0.04 + halo + bruma * 0.7);
        c += uLuzColor[2] * uLuzInt[2] * exp(-r2 * 26.0) * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthWrite: false,
  });
}

function matTope(U) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: /* glsl */`
      uniform vec3 uLuzColor[8]; uniform float uLuzInt[8];
      varying vec3 vPos; varying vec3 vFondo; varying vec3 vPista;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz;
        vFondo = uLuzColor[0] * uLuzInt[0]; vPista = uLuzColor[5] * uLuzInt[5];
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vPos; varying vec3 vFondo; varying vec3 vPista;
      void main() {
        vec3 v = normalize(cameraPosition - vPos);
        // Vidrio negro: a medida que la mirada se acuesta refleja el fondo.
        float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 4.0);
        vec3 c = vec3(0.004, 0.0035, 0.008) + vFondo * fres * 0.16;
        // Líneas finas a lo largo, como las juntas de las placas.
        float linea = smoothstep(0.012, 0.0, abs(fract(vPos.x / 0.825 + 0.5) - 0.5) * 0.825);
        c += vPista * linea * 0.06;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

function matLed(U, texEspectro) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, tEspectro: { value: texEspectro } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLuzColor[8]; uniform float uLuzInt[8]; uniform float uTiempo;
      uniform sampler2D tEspectro;
      varying vec2 vUv;
      float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 celdas = vec2(58.0, 13.0);
        vec2 c = floor(vUv * celdas);
        vec2 f = fract(vUv * celdas);
        float cuadro = step(0.16, f.x) * step(f.x, 0.84) * step(0.16, f.y) * step(f.y, 0.84);
        // Espejado desde el centro, como un ecualizador de equipo de música.
        float col = abs(c.x - celdas.x * 0.5 + 0.5) / (celdas.x * 0.5);
        float nivel = texture2D(tEspectro, vec2(col * 0.94 + 0.03, 0.5)).r;
        float fila = (c.y + 0.5) / celdas.y;
        float prendido = step(fila, nivel * 1.05);
        float chispa = step(0.985, azar(c + floor(uTiempo * 7.0)));
        float h = azar(c * 1.7);
        vec3 tono = h < 0.45 ? uLuzColor[6] : (h < 0.8 ? uLuzColor[7] : vec3(1.0));
        vec3 base = vec3(0.012, 0.011, 0.02);
        float ralo = step(0.55, azar(c * 0.37 + floor(uTiempo * 3.0) * 0.01));
        vec3 luz = tono * (prendido * ralo * (0.25 + 0.9 * fila) + chispa * 1.1) * 0.9;
        gl_FragColor = vec4(base + luz * cuadro, 1.0);
      }`,
  });
}

function matPiso(U) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U },
    vertexShader: /* glsl */`
      varying vec3 vPos;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLuzColor[8]; uniform float uLuzInt[8];
      varying vec3 vPos;
      void main() {
        vec3 f = uLuzColor[0] * uLuzInt[0];
        float d = length(vPos.xz - cameraPosition.xz);
        vec3 c = vec3(0.004, 0.003, 0.008) + f * 0.02 * exp(-d * 0.02);
        // Opaco cerca (debajo de la cámara no hay nada que reflejar) y cada vez
        // más espejo hacia lo lejos, como un piso encerado.
        float a = mix(0.9, 0.62, smoothstep(2.0, 30.0, d));
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true, depthWrite: true,
  });
}

// ─────────────────────────── piezas ───────────────────────────

/** La cara del dragón, de frente: una máscara con corona de púas. */
function contornoCabeza() {
  const der = [
    [0, 17.6], [0.95, 14.1], [2.1, 16.7], [2.7, 13.5], [4.1, 15.3], [4.5, 12.7],
    [6.4, 13.6], [6.1, 10.9], [8.2, 10.3], [6.5, 8.7], [7.5, 6.2], [5.5, 5.8],
    [5.1, 3.5], [3.3, 1.9], [2.3, 0.3], [0.9, -0.8],
  ];
  const pts = [...der, [0, -0.2], ...der.slice(1).reverse().map(([x, y]) => [-x, y])];
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

function dragon(rng) {
  const oscuras = [], neones = [];
  const Z = -72;             // el plano de la cara
  const Y0 = 9.5;            // la pera
  const ESC = 1.25;

  const cara = new THREE.ExtrudeGeometry(contornoCabeza(), { depth: 4, bevelEnabled: false, curveSegments: 1 });
  cara.scale(ESC, ESC, 1);
  cara.translate(0, Y0, Z - 4);
  oscuras.push(marcar(marcar(cara, "aGrupo", G.ROCAS), "aRayas", 0));

  // La golilla de púas detrás de la cabeza: es lo que en el video se ve como
  // una corona dentada alrededor de la cara.
  for (let i = 0; i < 15; i++) {
    const a = Math.PI * (0.08 + 0.84 * (i / 14));
    const largo = 7 + rng() * 6;
    const pua = prisma(rng, { radio: 1.6, alto: largo, lados: 4, punta: 0.12, torcer: 0.1 });
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    pua.applyQuaternion(q);
    pua.translate(Math.cos(a) * 8.5, Y0 + 9 + Math.sin(a) * 7.5, Z - 7);
    oscuras.push(marcar(marcar(pua, "aGrupo", G.ROCAS), "aRayas", 0.35));
  }

  // Los cuernos: placas a lo largo de una espiral, con una franja violeta
  // entre placa y placa. Como un cuerno de carnero visto de frente.
  for (const lado of [-1, 1]) {
    const C = new THREE.Vector2(15.5 * lado, Y0 + 13.5);
    const N = 19;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const s2 = (i + 0.5) / (N - 1);
      const ang = (a) => lado > 0 ? THREE.MathUtils.degToRad(205 - a * 265) : THREE.MathUtils.degToRad(-25 + a * 265);
      const R = (a) => 11.5 - a * 6.2;
      const P = (a) => new THREE.Vector3(C.x + Math.cos(ang(a)) * R(a), C.y + Math.sin(ang(a)) * R(a), Z - 3 + Math.sin(a * Math.PI) * 5);
      const p = P(s), p2 = P(Math.min(1, s2));
      const tan = new THREE.Vector3().subVectors(P(Math.min(1, s + 0.02)), P(Math.max(0, s - 0.02))).normalize();
      const radial = new THREE.Vector3(p.x - C.x, p.y - C.y, 0).normalize();
      const grosor = 5.2 - s * 3.6;
      const placa = cajaOrientada(p, tan, radial, 1.55 + (1 - s) * 0.7, grosor, 3.2 - s * 1.2);
      oscuras.push(marcar(marcar(placa, "aGrupo", G.ROCAS), "aRayas", 0));
      if (i < N - 1) {
        // La franja: un poco más angosta que la placa y metida entre dos.
        const franja = cajaOrientada(p2.clone().add(radial.clone().multiplyScalar(-grosor * 0.08)),
          tan, radial, 0.28, grosor * 0.78, 2.2 - s * 0.8);
        neones.push(marcar(marcar(marcar(marcar(franja, "aPerfil", 0), "aGrupo", G.CUERNOS), "aFuerza", 1.6), "aLargo", s));
      }
    }
  }

  // Los ojos y las marcas en V de la cara.
  const plano = new THREE.Vector3(0, 0, 1);
  const zf = Z + 0.05;
  for (const lado of [-1, 1]) {
    const a = new THREE.Vector3(lado * 1.4 * ESC, Y0 + 8.9 * ESC, zf);
    const b = new THREE.Vector3(lado * 4.3 * ESC, Y0 + 10.2 * ESC, zf);
    neones.push(barra(a, b, 0.75, plano, { grupo: G.CUERNOS, fuerza: 2.4 }));
    const c = new THREE.Vector3(lado * 0.35 * ESC, Y0 + 5.2 * ESC, zf);
    const d = new THREE.Vector3(lado * 2.3 * ESC, Y0 + 7.4 * ESC, zf);
    neones.push(barra(c, d, 0.42, plano, { grupo: G.CUERNOS, fuerza: 1.8 }));
    const e = new THREE.Vector3(lado * 0.2 * ESC, Y0 + 2.4 * ESC, zf);
    const f = new THREE.Vector3(lado * 1.7 * ESC, Y0 + 4.3 * ESC, zf);
    neones.push(barra(e, f, 0.3, plano, { grupo: G.CUERNOS, fuerza: 1.3 }));
  }

  // Los hombros: dos moles oscuras que bajan hasta el piso detrás de la pista.
  for (const lado of [-1, 1]) {
    const hombro = prisma(rng, { radio: 9, alto: 22, lados: 5, punta: 0.3, torcer: 0.3 });
    hombro.translate(lado * 17, PISO_Y - 2, Z - 2);
    oscuras.push(marcar(marcar(hombro, "aGrupo", G.ROCAS), "aRayas", 0.8));
  }
  return { oscuras, neones };
}

function rocas(rng) {
  const out = [];
  // Cerca de la pista, a los dos lados: las paredes de piedra con rayas.
  for (const lado of [-1, 1]) {
    for (let z = -9; z > -68; z -= 4.2 + rng() * 3.5) {
      const lejos = -z / 68;
      const g = prisma(rng, {
        radio: 1.4 + rng() * 2.2 + lejos * 1.5,
        alto: 3 + rng() * 5 + lejos * 12,
        lados: 4 + Math.floor(rng() * 3), punta: 0.15 + rng() * 0.25, torcer: 0.35,
      });
      g.rotateZ(lado * (0.1 + rng() * 0.25));
      g.translate(lado * (6.2 + rng() * 4 + lejos * 6), PISO_Y - 0.5, z);
      out.push(marcar(marcar(g, "aGrupo", G.ROCAS), "aRayas", 1));
    }
    // Los gigantes del fondo.
    for (let k = 0; k < 6; k++) {
      const g = prisma(rng, { radio: 5 + rng() * 5, alto: 18 + rng() * 22, lados: 5, punta: 0.2, torcer: 0.3 });
      g.rotateZ(lado * (0.05 + rng() * 0.2));
      g.translate(lado * (19 + rng() * 16), PISO_Y - 1, -38 - k * 9 - rng() * 6);
      out.push(marcar(marcar(g, "aGrupo", G.ROCAS), "aRayas", 0.9));
    }
  }
  return out;
}

/** Un ala: una media luna tejida como una red (meridianos + paralelos). */
function ala(lado, raiz, escala, giroY, grupo) {
  const geos = [];
  const M = 5, N = 9;
  const T = new THREE.Vector2(1.6, 12.5), B = new THREE.Vector2(0.4, 0);
  const curva = (k, s) => {
    const panza = 3.2 + (k / M) * 4.6;
    const x = THREE.MathUtils.lerp(B.x, T.x, s) + Math.sin(Math.PI * s) * panza;
    const y = THREE.MathUtils.lerp(B.y, T.y, s) + Math.sin(Math.PI * s) * (k / M) * 1.4;
    return new THREE.Vector3(x * lado, y, 0);
  };
  for (let k = 0; k <= M; k++) {
    const pts = [];
    for (let j = 0; j <= 28; j++) pts.push(curva(k, j / 28));
    const exterior = k === M;
    geos.push(cinta(pts, exterior ? 0.22 : 0.1, { grupo, fuerza: exterior ? 0.95 : 0.55, fase: k }));
  }
  for (let j = 1; j < N; j++) {
    const s = j / N;
    const pts = [];
    for (let k = 0; k <= M; k++) pts.push(curva(k, s));
    geos.push(cinta(pts, 0.065, { grupo, fuerza: 0.42, fase: j * 0.7 }));
  }
  const g = unir(geos);
  g.scale(escala, escala, escala);
  g.rotateY(giroY);
  g.translate(raiz.x, raiz.y, raiz.z);
  return g;
}

function haces() {
  const A = [], B = [], ancho = [], lado = [], fin = [], grupo = [], fase = [], tipo = [], ang = [], largo = [];
  const pos = [];
  const agregar = (a, b, w0, w1, g, f, t, an, la) => {
    for (const [l, e] of [[-1, 0], [1, 0], [-1, 1], [-1, 1], [1, 0], [1, 1]]) {
      A.push(a.x, a.y, a.z); B.push(b.x, b.y, b.z); ancho.push(w0, w1);
      lado.push(l); fin.push(e); grupo.push(g); fase.push(f); tipo.push(t); ang.push(an); largo.push(la);
      pos.push(0, 0, 0);
    }
  };
  // Verticales: bajan del cielo y caen detrás del final de la pista.
  const xs = [-3.1, -2.0, -1.1, -0.35, 0.35, 1.1, 2.0, 3.1];
  xs.forEach((x, i) => {
    agregar(new THREE.Vector3(x * 1.3, 90, -58 - (i % 3) * 3), new THREE.Vector3(x, PISO_Y, -56 - (i % 3) * 3),
      0.22, 0.16, G.VERTICAL, i * 1.7, 0, 0, 0);
  });
  // Dos haces largos en diagonal desde arriba a los costados (los de las
  // esquinas del video).
  for (const s of [-1, 1]) {
    agregar(new THREE.Vector3(s * 26, 70, -40), new THREE.Vector3(s * 3, PISO_Y, -22), 0.3, 0.2, G.VERTICAL, s * 2.3, 0, 0, 0);
  }
  // El abanico: rayos que salen de atrás de la cabeza para todos lados.
  const O = new THREE.Vector3(0, 22.5, -80);
  const NR = 20;
  for (let i = 0; i < NR; i++) {
    const a = -0.15 + (i / (NR - 1)) * (Math.PI + 0.3);
    agregar(O, O, 0.25, 2.6, G.ABANICO, i * 0.9, 1, a, 150);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aA", new THREE.Float32BufferAttribute(A, 3));
  g.setAttribute("aB", new THREE.Float32BufferAttribute(B, 3));
  g.setAttribute("aAncho", new THREE.Float32BufferAttribute(ancho, 2));
  g.setAttribute("aLado", new THREE.Float32BufferAttribute(lado, 1));
  g.setAttribute("aFin", new THREE.Float32BufferAttribute(fin, 1));
  g.setAttribute("aGrupo", new THREE.Float32BufferAttribute(grupo, 1));
  g.setAttribute("aFase", new THREE.Float32BufferAttribute(fase, 1));
  g.setAttribute("aTipo", new THREE.Float32BufferAttribute(tipo, 1));
  g.setAttribute("aAng", new THREE.Float32BufferAttribute(ang, 1));
  g.setAttribute("aLargoHaz", new THREE.Float32BufferAttribute(largo, 1));
  return g;
}

function lucesPista() {
  const out = [];
  const arriba = new THREE.Vector3(0, 1, 0);
  const y = PISTA.tope + 0.004;
  const w = PISTA.ancho / 2;
  // Travesaños cada 2,6 m, más juntos hacia lo lejos no: parejos, que el
  // escorzo solo ya los junta.
  for (let z = PISTA.frente - 3.2, i = 0; z > PISTA.fondo + 1; z -= 2.6, i++) {
    out.push(barra(new THREE.Vector3(-w + 0.08, y, z), new THREE.Vector3(w - 0.08, y, z), 0.07, arriba,
      { grupo: G.PISTA, fuerza: 0.38, fase: i * 0.6 }));
  }
  // El borde de adelante (la línea blanca) y los dos laterales.
  out.push(barra(new THREE.Vector3(-w, y, PISTA.frente - 0.03), new THREE.Vector3(w, y, PISTA.frente - 0.03), 0.07, arriba,
    { grupo: G.PISTA, fuerza: 0.85 }));
  out.push(barra(new THREE.Vector3(-w, PISTA.tope - 0.02, PISTA.frente + 0.004), new THREE.Vector3(w, PISTA.tope - 0.02, PISTA.frente + 0.004), 0.05,
    new THREE.Vector3(0, 0, 1), { grupo: G.PISTA, fuerza: 0.55 }));
  for (const s of [-1, 1]) {
    out.push(barra(new THREE.Vector3(s * (w - 0.02), y, PISTA.frente), new THREE.Vector3(s * (w - 0.02), y, PISTA.fondo), 0.05, arriba,
      { grupo: G.PISTA, fuerza: 0.9 }));
  }
  return out;
}

// ─────────────────────────── el escenario ───────────────────────────

export class Escenario {
  constructor(motor, luces, semilla = 7) {
    this.motor = motor;
    this.luces = luces;
    const U = luces.uniforms;
    const rng = crearAzar(semilla);
    const raiz = new THREE.Group();
    this.raiz = raiz;
    motor.escena.add(raiz);

    // Cielo: un telón grande detrás de todo.
    const cielo = new THREE.Mesh(new THREE.PlaneGeometry(520, 300), matCielo(U));
    cielo.position.set(0, 60, -130);
    cielo.renderOrder = -10;
    raiz.add(cielo);

    // Siluetas oscuras (dragón, cuernos, rocas) en una sola malla.
    const drg = dragon(rng);
    const geoOscura = unir([...drg.oscuras, ...rocas(rng)], { aGrupo: G.ROCAS, aRayas: 0 });
    geoOscura.computeVertexNormals();
    this.oscuro = new THREE.Mesh(geoOscura, matOscuro(U));
    raiz.add(this.oscuro);

    // Neones: franjas de cuernos, ojos, alas y luces de pista.
    const alas = [
      ala(-1, new THREE.Vector3(-3.0, -0.6, -22), 0.78, 0.3, G.ALA_IZQ),
      ala(1, new THREE.Vector3(3.0, -0.6, -22), 0.78, -0.3, G.ALA_DER),
      ala(-1, new THREE.Vector3(-5.4, -1.8, -33), 1.08, 0.18, G.ALA_IZQ),
      ala(1, new THREE.Vector3(5.4, -1.8, -33), 1.08, -0.18, G.ALA_DER),
    ];
    const geoNeon = unir([...drg.neones, ...alas, ...lucesPista()], { aPerfil: 0, aFuerza: 1, aLargo: 0, aFase: 0 });
    this.neon = new THREE.Mesh(geoNeon, matNeon(U));
    this.neon.renderOrder = 3;
    raiz.add(this.neon);

    const geoHaz = haces();
    this.haz = new THREE.Mesh(geoHaz, matHaz(U));
    this.haz.frustumCulled = false;      // los vértices se mueven en el shader
    this.haz.renderOrder = 4;
    raiz.add(this.haz);

    // La pista: una losa negra con tope de vidrio y un panel de LEDs al frente.
    const largo = PISTA.frente - PISTA.fondo;
    const alto = PISTA.tope - PISTA.base;
    const losa = new THREE.BoxGeometry(PISTA.ancho, alto, largo);
    losa.translate(0, PISTA.base + alto / 2, PISTA.frente - largo / 2);
    const geoLosa = marcar(marcar(losa, "aGrupo", G.ROCAS), "aRayas", 0);
    this.losa = new THREE.Mesh(geoLosa, matOscuro(U));
    raiz.add(this.losa);

    const tope = new THREE.PlaneGeometry(PISTA.ancho - 0.02, largo);
    tope.rotateX(-Math.PI / 2);
    tope.translate(0, PISTA.tope + 0.001, PISTA.frente - largo / 2);
    this.tope = new THREE.Mesh(tope, matTope(U));
    raiz.add(this.tope);

    this.espectro = new Uint8Array(32 * 4);
    this.texEspectro = new THREE.DataTexture(this.espectro, 32, 1, THREE.RGBAFormat);
    this.texEspectro.magFilter = THREE.LinearFilter;
    this.texEspectro.minFilter = THREE.LinearFilter;
    this.texEspectro.needsUpdate = true;
    const led = new THREE.PlaneGeometry(PISTA.ancho - 0.1, alto - 0.12);
    led.translate(0, PISTA.base + alto / 2 - 0.02, PISTA.frente + 0.003);
    this.led = new THREE.Mesh(led, matLed(U, this.texEspectro));
    raiz.add(this.led);

    // El piso de abajo, y debajo de él los reflejos: copias espejadas de todo
    // lo que brilla. Es el truco barato del espejo: no se dibuja la escena dos
    // veces, sólo las luces, que en un escenario oscuro es lo único que se ve
    // reflejado.
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), matPiso(U));
    piso.rotation.x = -Math.PI / 2;
    piso.position.y = PISO_Y;
    piso.renderOrder = 2;
    raiz.add(piso);

    this.espejo = new THREE.Group();
    this.espejo.scale.y = -1;
    this.espejo.position.y = 2 * PISO_Y;
    const rNeon = new THREE.Mesh(geoNeon, matNeon(U, 0.2)); rNeon.renderOrder = 1;
    const rHaz = new THREE.Mesh(geoHaz, matHaz(U, 0.3)); rHaz.renderOrder = 1; rHaz.frustumCulled = false;
    this.espejo.add(rNeon, rHaz);
    raiz.add(this.espejo);
  }

  /** El espectro de la música al panel de LEDs: 32 bandas de 0 a 1. */
  ponerEspectro(bandas) {
    const e = this.espectro;
    for (let i = 0; i < 32; i++) {
      const v = Math.max(0, Math.min(255, Math.round((bandas[i] || 0) * 255)));
      e[i * 4] = v; e[i * 4 + 1] = v; e[i * 4 + 2] = v; e[i * 4 + 3] = 255;
    }
    this.texEspectro.needsUpdate = true;
  }
}
