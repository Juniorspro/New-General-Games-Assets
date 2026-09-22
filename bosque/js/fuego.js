// El fuego de la fogata: llamas, chispas, humo y la luz que tiembla.
//
// LAS LLAMAS NO SON UNA TEXTURA: son ruido que sube, recortado con una forma
// de gota y pintado con la rampa de temperatura (blanco-amarillo abajo, rojo
// arriba). Una textura de fuego animada por cuadros se ve en loop a los tres
// segundos; el ruido no se repite nunca.
//
// Y BRILLAN DE VERDAD: el color vale hasta 6 veces el blanco. El cuadro se
// dibuja en coma flotante y el tono se aplica al final, así que el fuego
// satura como satura una cámara, en vez de quedar como un dibujo naranja.
import * as THREE from "three";

const RUIDO = `
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n(p); p *= 2.1; a *= 0.5; } return v; }`;

export class Fuego {
  constructor(donde) {
    this.grupo = new THREE.Group();
    this.grupo.position.copy(donde);
    this.grupo.name = "fuego";
    this.t = { value: 0 };

    // llamas: tres planos que miran a la cámara, cada uno con su semilla
    const matLlama = (semilla) => new THREE.ShaderMaterial({
      uniforms: { uT: this.t, uS: { value: semilla } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          // siempre de frente a la cámara, girando solo alrededor de y
          vec3 der = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
          vec3 cen = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 p = cen + der * position.x + vec3(0.0, position.y, 0.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uT, uS;
        varying vec2 vUv;
        ${RUIDO}
        void main() {
          vec2 p = vUv;
          float r = fbm(vec2(p.x * 3.5 + uS, p.y * 2.2 - uT * 2.3 + uS));
          float r2 = fbm(vec2(p.x * 6.0 - uS, p.y * 4.0 - uT * 3.7));
          // la forma: ancha abajo, en punta arriba, y el ruido la come
          float ancho = mix(0.42, 0.04, pow(p.y, 0.8));
          float borde = abs(p.x - 0.5 + (r - 0.5) * 0.25 * p.y);
          float forma = smoothstep(ancho, ancho * 0.35, borde) * smoothstep(1.0, 0.25, p.y + r * 0.45);
          forma *= smoothstep(0.0, 0.08, p.y);
          float calor = forma * (0.75 + r2 * 0.5);
          vec3 c = mix(vec3(1.4, 0.18, 0.02), vec3(2.6, 1.1, 0.25), smoothstep(0.1, 0.5, calor));
          c = mix(c, vec3(6.0, 4.4, 2.2), smoothstep(0.55, 0.95, calor));
          gl_FragColor = vec4(c * calor, calor);
          if (calor < 0.01) discard;
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    for (let k = 0; k < 3; k++) {
      const g = new THREE.PlaneGeometry(0.95 - k * 0.18, 1.35 - k * 0.2);
      g.translate(0, (1.35 - k * 0.2) / 2 + 0.12, 0);
      const m = new THREE.Mesh(g, matLlama(k * 13.7));
      m.position.set((k - 1) * 0.12, 0, (k % 2) * 0.1 - 0.05);
      m.renderOrder = 5;
      m.frustumCulled = false;
      this.grupo.add(m);
    }

    // chispas: puntos que suben, se apagan y vuelven a nacer abajo
    const N = 60;
    const semillas = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { semillas[i * 3] = Math.random(); semillas[i * 3 + 1] = Math.random(); semillas[i * 3 + 2] = Math.random(); }
    const gCh = new THREE.BufferGeometry();
    gCh.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    gCh.setAttribute("aS", new THREE.BufferAttribute(semillas, 3));
    const matCh = new THREE.ShaderMaterial({
      uniforms: { uT: this.t },
      vertexShader: `
        attribute vec3 aS;
        uniform float uT;
        varying float vVida;
        void main() {
          float vida = fract(uT * (0.22 + aS.z * 0.25) + aS.x);
          vVida = 1.0 - vida;
          vec3 p = vec3((aS.x - 0.5) * 0.5 + sin(uT * 2.0 + aS.y * 6.0) * 0.15 * vida,
                        0.25 + vida * (2.8 + aS.y * 1.5),
                        (aS.y - 0.5) * 0.5 + cos(uT * 1.7 + aS.x * 6.0) * 0.15 * vida);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + aS.z * 2.5) * (18.0 / -mv.z);
        }`,
      fragmentShader: `
        varying float vVida;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vec3(4.0, 1.6, 0.4) * vVida * vVida, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ch = new THREE.Points(gCh, matCh);
    ch.frustumCulled = false;
    this.grupo.add(ch);

    // humo: planos grises que suben, se abren y se van con el viento
    const matHumo = new THREE.ShaderMaterial({
      uniforms: { uT: this.t },
      vertexShader: `
        attribute float aS;
        uniform float uT;
        varying float vVida;
        varying vec2 vUv;
        void main() {
          float vida = fract(uT * 0.09 + aS);
          vVida = vida;
          vUv = uv;
          vec3 der = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
          float tam = 0.9 + vida * 4.2;
          vec3 cen = (modelMatrix * vec4(vida * 2.2 + sin(aS * 20.0) * 0.4, 1.4 + vida * 7.0, vida * 1.2, 1.0)).xyz;
          vec3 p = cen + der * position.x * tam + vec3(0.0, position.y * tam, 0.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uT;
        varying float vVida;
        varying vec2 vUv;
        ${RUIDO}
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float r = fbm(vUv * 3.0 + vec2(uT * 0.1, -uT * 0.2));
          // EL HUMO ES OSCURO. Pintado con un gris "de humo" salía blanco:
          // el cuadro está en coma flotante y todo el bosque a la sombra vale
          // 0,05, así que un 0,16 brillaba como bolitas de algodón.
          float a = smoothstep(1.0, 0.1, d + (r - 0.5) * 0.7) * smoothstep(0.0, 0.2, vVida) * (1.0 - vVida) * 0.13;
          gl_FragColor = vec4(vec3(0.045, 0.043, 0.04), a);
        }`,
      transparent: true, depthWrite: false,
    });
    const H = 8;
    const gH = new THREE.BufferGeometry();
    const pos = [], uv = [], s = [], idx = [];
    for (let i = 0; i < H; i++) {
      const b = i * 4, si = i / H;
      pos.push(-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      s.push(si, si, si, si);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    gH.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    gH.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    gH.setAttribute("aS", new THREE.Float32BufferAttribute(s, 1));
    gH.setIndex(idx);
    const humo = new THREE.Mesh(gH, matHumo);
    humo.frustumCulled = false;
    humo.renderOrder = 4;
    this.grupo.add(humo);

    // la luz: naranja, que tiembla. Sin sombra: una luz puntual con sombra son
    // seis dibujos más de la escena por cuadro.
    this.luz = new THREE.PointLight(new THREE.Color(1.0, 0.55, 0.22), 5, 14, 1.6);
    this.luz.position.set(0, 0.8, 0);
    this.grupo.add(this.luz);
  }

  paso(t) {
    this.t.value = t;
    // el temblor: dos senos que no se sincronizan nunca más un poco de azar
    const f = 0.8 + Math.sin(t * 13.1) * 0.08 + Math.sin(t * 7.3 + 1.3) * 0.1 + Math.random() * 0.08;
    this.luz.intensity = 5.2 * f;
    this.luz.position.x = Math.sin(t * 5.1) * 0.05;
  }
}
