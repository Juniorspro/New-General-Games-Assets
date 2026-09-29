// El material de la isla: píxeles anclados al MUNDO, no a la pantalla.
//
// Cada fragmento busca el centro del texel en el que cae y calcula la luz, la
// sombra y el color ahí, no en su propia posición. Así un texel entero sale de
// un solo color: de cerca los píxeles son grandes y de lejos chicos, siempre
// del mismo tamaño en metros ("la pixelación se hace más fuerte cuando te
// acercás", como dice el autor en sus videos). Las sombras, al calcularse en el
// centro del texel, quedan escalonadas en la misma grilla que la textura.
//
// El centro del texel se saca con derivadas: si t = uv·tamaño, entonces
// t(pantalla + Δ) ≈ t + dFdx(t)·Δx + dFdy(t)·Δy; resolviendo ese 2×2 se sabe
// cuánto hay que moverse en pantalla para llegar al centro, y con dFdx/dFdy de
// la posición de mundo, dónde queda ese punto en el mundo.
import * as THREE from '../vendor/three.module.min.js';

// Uniforms compartidos por TODOS los materiales: el mismo objeto {value} en
// cada uno, así que cambiar la hora del día cambia la isla entera de una vez.
export const LUZ = {
  uT: { value: 0 },
  uSolDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
  uSolColor: { value: new THREE.Color(1.0, 0.95, 0.86) },
  uCielo: { value: new THREE.Color(0.55, 0.68, 0.85) },
  uSuelo: { value: new THREE.Color(0.52, 0.47, 0.36) },
  uSombraMapa: { value: null },
  uSombraMatriz: { value: new THREE.Matrix4() },
  uSombraActiva: { value: 0 },
  uSombraSesgo: { value: 0.0006 },
  uNieblaColor: { value: new THREE.Color(0.75, 0.87, 0.98) },
  uNieblaDens: { value: 0.0022 },
  uLucesPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -999, 0, 1)) },
  uLucesColor: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
  uTexeles: { value: 16 },
  uSatur: { value: 1.12 },
  uNivelAgua: { value: 0 },
};

export const VERT = /* glsl */ `
uniform float uT;
uniform float uViento;
uniform float uAltoViento;
varying vec3 vMundo;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
#ifdef BARI
attribute vec3 aBari;
varying vec3 vBari;
#endif
void main() {
  vec4 local = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 mundo = modelMatrix * local;
  #ifdef VIENTO
    vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #ifdef USE_INSTANCING
      base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #endif
    #ifdef VIENTO_UV
      float alto = uv.x;
    #else
      float alto = max(position.y, 0.0) / uAltoViento;
    #endif
    float k = alto * alto;
    float fase = dot(base.xz, vec2(0.13, 0.11));
    float rafaga = 0.6 + 0.4 * sin(uT * 0.5 - dot(base.xz, vec2(0.02, 0.015)));
    float s = sin(uT * 1.6 + fase) * 0.55 + sin(uT * 2.7 + fase * 1.7) * 0.25;
    mundo.xz += vec2(0.8, 0.6) * s * rafaga * k * uViento;
  #endif
  vMundo = mundo.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  vUv = uv;
  vColor = vec3(1.0);
  #ifdef USE_COLOR
    vColor = color;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor;
  #endif
  #ifdef BARI
    vBari = aBari;
  #endif
  gl_Position = projectionMatrix * viewMatrix * mundo;
}
`;

// La luz, compartida por el material común y por los especiales (gemas, agua).
export const LUZ_GLSL = /* glsl */ `
uniform vec3 uSolDir;
uniform vec3 uSolColor;
uniform vec3 uCielo;
uniform vec3 uSuelo;
uniform sampler2D uSombraMapa;
uniform mat4 uSombraMatriz;
uniform float uSombraActiva;
uniform float uSombraSesgo;
uniform vec3 uNieblaColor;
uniform float uNieblaDens;
uniform vec4 uLucesPos[4];
uniform vec4 uLucesColor[4];
uniform float uSatur;

float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float sombraEn(vec3 pc, vec3 n) {
  if (uSombraActiva < 0.5) return 1.0;
  vec4 sc = uSombraMatriz * vec4(pc + n * 0.06, 1.0);
  vec3 sp = sc.xyz / sc.w;
  if (sp.x <= 0.0 || sp.x >= 1.0 || sp.y <= 0.0 || sp.y >= 1.0 || sp.z >= 1.0) return 1.0;
  float prof = unpackRGBAToDepth(texture2D(uSombraMapa, sp.xy));
  return step(sp.z - uSombraSesgo, prof);
}

vec3 luzEn(vec3 pc, vec3 n, out float sombra) {
  float ndl = dot(n, uSolDir);
  sombra = ndl > 0.0 ? sombraEn(pc, n) : 0.0;
  vec3 amb = mix(uSuelo, uCielo, n.y * 0.5 + 0.5);
  vec3 luz = amb + uSolColor * max(ndl, 0.0) * sombra;
  for (int i = 0; i < 4; i++) {
    vec4 lp = uLucesPos[i];
    vec4 lc = uLucesColor[i];
    if (lc.a > 0.0) {
      vec3 L = lp.xyz - pc;
      float d = length(L);
      float att = clamp(1.0 - d / lp.w, 0.0, 1.0);
      att *= att;
      luz += lc.rgb * lc.a * att * (0.4 + 0.6 * max(dot(n, L / max(d, 1e-3)), 0.0));
    }
  }
  return luz;
}

vec3 terminar(vec3 col, vec3 pc) {
  float d = length(pc - cameraPosition);
  float niebla = 1.0 - exp(-pow(d * uNieblaDens, 2.0));
  col = mix(col, uNieblaColor, clamp(niebla, 0.0, 1.0));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  return mix(vec3(l), col, uSatur);
}

// Centro del texel en el mundo, dada una coordenada t en texels.
vec2 hastaCentro(vec2 t) {
  vec2 c = floor(t) + 0.5;
  vec2 d = c - t;
  vec2 tx = dFdx(t), ty = dFdy(t);
  float det = tx.x * ty.y - ty.x * tx.y;
  vec2 s = vec2(0.0);
  if (abs(det) > 1e-12) s = vec2(ty.y * d.x - ty.x * d.y, -tx.y * d.x + tx.x * d.y) / det;
  return clamp(s, vec2(-3.0), vec2(3.0));
}

// Coordenada de texel para las superficies sin UV: el plano dominante.
vec2 planoMundo(vec3 p, vec3 n) {
  vec3 an = abs(n);
  if (an.y >= an.x && an.y >= an.z) return p.xz;
  if (an.x >= an.z) return p.zy;
  return p.xy;
}
`;

export const FRAG = /* glsl */ `
#include <packing>
uniform float uT;
uniform float uTexeles;
uniform float uNivelAgua;
uniform sampler2D uMapa;
uniform vec2 uMapaTam;
uniform vec3 uColor;
uniform vec3 uEmisivo;
uniform float uAlfaCorte;
uniform float uBrillo;
uniform float uBorde;
varying vec3 vMundo;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
#ifdef BARI
varying vec3 vBari;
#endif
#ifdef TERRENO
uniform sampler2D uMapaMat;
uniform vec4 uMapaMatRect;
uniform sampler2D uTexArena;
uniform sampler2D uTexPasto;
uniform sampler2D uTexTierra;
uniform sampler2D uTexRoca;
#endif
${LUZ_GLSL}

void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 p = vMundo;
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  vec2 s = vec2(0.0);
  vec4 albedo = vec4(uColor * vColor, 1.0);
  vec2 cel = vec2(0.0);

#if defined(TEX_UV)
  vec2 t = vUv * uMapaTam;
  s = hastaCentro(t);
  cel = floor(t) + 0.5;
  albedo *= texture2D(uMapa, cel / uMapaTam);
#elif defined(TEX_MUNDO) || defined(TERRENO)
  vec2 t = planoMundo(p, n) * uTexeles;
  s = hastaCentro(t);
  cel = floor(t) + 0.5;
  #ifdef TEX_MUNDO
    albedo *= texture2D(uMapa, cel / uMapaTam);
  #endif
#else
  // sin textura: igual se ilumina por texel para que no quede liso
  vec2 t = planoMundo(p, n) * uTexeles;
  s = hastaCentro(t);
  cel = floor(t) + 0.5;
#endif

  vec3 pc = p + dpx * s.x + dpy * s.y;
  vec3 nc = normalize(n + dFdx(n) * s.x + dFdy(n) * s.y);

#ifdef TERRENO
  vec2 uvMat = (pc.xz - uMapaMatRect.xy) * uMapaMatRect.zw;
  vec2 m = texture2D(uMapaMat, uvMat).rg;
  vec2 celMundo = floor(pc.xz * uTexeles);
  float ruido = h12(celMundo) - 0.5;
  float ruidoG = h12(floor(pc.xz * uTexeles * 0.25) + 7.0) - 0.5;
  float esPasto = step(0.5 + ruido * 0.3 + ruidoG * 0.25, m.r);
  float esTierra = step(0.5 + ruido * 0.3, m.g);
  vec2 uvT = cel / 32.0;
  vec3 colT = texture2D(uTexArena, uvT).rgb;
  float hAgua = pc.y - uNivelAgua;
  colT *= mix(vec3(1.0), vec3(0.88, 0.85, 0.8), step(hAgua, 0.22));
  colT = mix(colT, texture2D(uTexPasto, uvT).rgb, esPasto * step(0.25, hAgua));
  colT = mix(colT, texture2D(uTexTierra, uvT).rgb, esTierra);
  colT = mix(colT, texture2D(uTexRoca, uvT).rgb, step(nc.y, 0.64));
  if (hAgua < 0.0) {
    vec2 q = celMundo / uTexeles * 1.7;
    float cau = pow(abs(sin(q.x * 1.3 + sin(q.y * 1.1 + uT * 0.9) * 1.5) * sin(q.y * 1.2 + sin(q.x * 0.9 - uT * 0.7) * 1.4)), 6.0);
    float prof = clamp(-hAgua / 3.5, 0.0, 1.0);
    colT = mix(colT, colT * vec3(0.7, 0.9, 0.95), prof * 0.7);
    colT += vec3(0.5, 0.6, 0.58) * cau * (1.0 - prof * 0.75);
  }
  albedo = vec4(colT, 1.0);
#endif

#ifdef BARI
  vec3 b = vBari + dFdx(vBari) * s.x + dFdy(vBari) * s.y;
  float borde = min(min(b.x, b.y), b.z);
  float ancho = max(fwidth(b.x) + fwidth(b.y), 1e-4) * 0.6;
  albedo.rgb = mix(albedo.rgb * (1.0 + uBorde), albedo.rgb, step(ancho, borde));
#endif

  if (albedo.a < uAlfaCorte) discard;

  float sombra;
  vec3 luz = luzEn(pc, nc, sombra);
  vec3 col = albedo.rgb * luz + uEmisivo;
  if (uBrillo > 0.0) {
    vec3 V = normalize(cameraPosition - pc);
    vec3 H = normalize(uSolDir + V);
    col += uSolColor * pow(max(dot(nc, H), 0.0), 48.0) * uBrillo * sombra;
  }
  gl_FragColor = vec4(terminar(col, pc), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Textura de canvas lista para píxeles: nítida de cerca, con mips de lejos
// (sin mips, la arena lejana titila como estática al caminar).
export function pixelar(tex, repetir = true) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repetir) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const cacheMat = new Map();

/**
 * Material pixelado.
 * modo: 'uv' (textura con UV), 'mundo' (textura en el plano dominante), 'liso'
 * op: { mapa, tam:[w,h], color, emisivo, viento, altoViento, alfa, brillo, bari, borde,
 *       lados: THREE.DoubleSide, colores (vertexColors), texeles, clave }
 */
export function matPixel(modo = 'liso', op = {}) {
  const clave = op.clave;
  if (clave && cacheMat.has(clave)) return cacheMat.get(clave);
  const defines = {};
  if (modo === 'uv') defines.TEX_UV = '';
  if (modo === 'mundo') defines.TEX_MUNDO = '';
  if (op.viento) defines.VIENTO = '';
  if (op.vientoUv) defines.VIENTO_UV = '';
  if (op.bari) defines.BARI = '';
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...LUZ,
      uMapa: { value: op.mapa || null },
      uMapaTam: { value: new THREE.Vector2(...(op.tam || [16, 16])) },
      uColor: { value: new THREE.Color(op.color ?? 0xffffff) },
      uEmisivo: { value: new THREE.Color(op.emisivo ?? 0x000000) },
      uAlfaCorte: { value: op.alfa ?? 0.0 },
      uBrillo: { value: op.brillo ?? 0 },
      uBorde: { value: op.borde ?? 0.5 },
      uViento: { value: op.viento ?? 0 },
      uAltoViento: { value: op.altoViento ?? 1 },
      ...(op.texeles ? { uTexeles: { value: op.texeles } } : {}),
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    side: op.lados ?? THREE.FrontSide,
    vertexColors: !!op.colores,
    transparent: false,
  });
  if (clave) cacheMat.set(clave, m);
  return m;
}

// Material de terreno: arena, pasto, tierra y roca según el mapa de materiales.
export function matTerreno(mapaMat, rect, tex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...LUZ,
      uMapa: { value: null },
      uMapaTam: { value: new THREE.Vector2(32, 32) },
      uColor: { value: new THREE.Color(0xffffff) },
      uEmisivo: { value: new THREE.Color(0x000000) },
      uAlfaCorte: { value: 0 },
      uBrillo: { value: 0 },
      uBorde: { value: 0 },
      uViento: { value: 0 },
      uAltoViento: { value: 1 },
      uMapaMat: { value: mapaMat },
      uMapaMatRect: { value: new THREE.Vector4(...rect) },
      uTexArena: { value: tex.arena },
      uTexPasto: { value: tex.pastoSuelo },
      uTexTierra: { value: tex.tierra },
      uTexRoca: { value: tex.roca },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { TERRENO: '' },
  });
}
