/* Posproceso al estilo UE 4.16: escena en HDR → autoexposición (media logarítmica medida en una textura chica),
   ColorCorrect (saturación/contraste/gamma/ganancia/desplazamiento), tonemap ACES, viñeta, grano y los efectos
   del paquete Chameleon que usa el juego (alcohol, droga, desenfoque). Lee volúmenes y cámara cada cuadro. */
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FS = `
precision highp float;
uniform sampler2D tCol; uniform float uExp, uVig, uGrano, uT, uAlc, uDrug, uBlur, uFundido;
uniform vec4 uSat, uCon, uGam, uGain, uOff; uniform vec2 uRes; uniform vec3 uColFundido;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
  const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
  c *= 1.0/0.6; c = I*c; c = RRTAndODTFit(c); c = O*c; return clamp(c,0.0,1.0);
}
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
vec3 muestra(vec2 uv){
  vec3 c = texture2D(tCol, uv).rgb;
  if (uBlur > 0.001) { vec2 d = uBlur / uRes * 2.0; c = (c*4.0 + texture2D(tCol, uv+vec2(d.x,0.)).rgb*2.0 + texture2D(tCol, uv-vec2(d.x,0.)).rgb*2.0 + texture2D(tCol, uv+vec2(0.,d.y)).rgb*2.0 + texture2D(tCol, uv-vec2(0.,d.y)).rgb*2.0
     + texture2D(tCol, uv+d).rgb + texture2D(tCol, uv-d).rgb + texture2D(tCol, uv+vec2(d.x,-d.y)).rgb + texture2D(tCol, uv+vec2(-d.x,d.y)).rgb)/16.0; }
  return c;
}
void main(){
  vec2 uv = vUv;
  if (uDrug > 0.001) uv += vec2(sin(uv.y*14.0 + uT*uDrug*1.3), cos(uv.x*11.0 + uT*uDrug)) * 0.006 * min(1.0, uDrug);
  vec3 c = muestra(uv);
  if (uAlc > 0.001) { vec2 o = vec2(sin(uT*1.7), cos(uT*1.3)) * uAlc * 0.04; c = mix(c, muestra(uv + o), 0.5); }
  c *= uExp;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(vec3(0.0), mix(vec3(l), c, uSat.xyz*uSat.w));
  c = pow(max(c, 1e-6)/0.18, uCon.xyz*uCon.w)*0.18;
  c = pow(c, 1.0/max(uGam.xyz*uGam.w, vec3(1e-3)));
  c = c*(uGain.xyz*uGain.w) + (uOff.xyz + uOff.w);
  c = aces(max(c, 0.0));
  vec2 p = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 1.15;
  float t2 = dot(p, p) * uVig; c *= 1.0/((1.0+t2)*(1.0+t2));
  c = srgb(c);
  c += (h(vUv*uRes + uT*61.0) - 0.5) * uGrano * 0.12;
  c = mix(c, uColFundido, uFundido);
  gl_FragColor = vec4(c, 1.0);
}`;
const FS_LUM = `precision highp float; uniform sampler2D tCol; varying vec2 vUv;
void main(){ vec3 c = texture2D(tCol, vUv).rgb; float l = max(1e-5, dot(c, vec3(0.2126,0.7152,0.0722))); gl_FragColor = vec4(clamp((log2(l)+16.0)/24.0, 0.0, 1.0), 0.0, 0.0, 1.0); }`;

const V4 = (v, d) => (v ? new THREE.Vector4(v.X ?? d, v.Y ?? d, v.Z ?? d, v.W ?? d) : new THREE.Vector4(d, d, d, d));
const DEF = { AutoExposureMinBrightness: 0.03, AutoExposureMaxBrightness: 2, AutoExposureBias: 0, AutoExposureSpeedUp: 3, AutoExposureSpeedDown: 1, VignetteIntensity: 0.4, GrainIntensity: 0 };

export class Post {
  constructor(renderer, M, opciones = {}) {
    this.r = renderer; this.M = M; this.k = opciones.k ?? 1.0; this.activo = true;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    this.rtLum = new THREE.WebGLRenderTarget(32, 18, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.buf = new Uint8Array(32 * 18 * 4);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.u = { tCol: { value: this.rt.texture }, uExp: { value: 1 }, uVig: { value: 0.4 }, uGrano: { value: 0 }, uT: { value: 0 }, uAlc: { value: 0 }, uDrug: { value: 0 }, uBlur: { value: 0 },
      uSat: { value: V4(null, 1) }, uCon: { value: V4(null, 1) }, uGam: { value: V4(null, 1) }, uGain: { value: V4(null, 1) }, uOff: { value: V4(null, 0) }, uRes: { value: new THREE.Vector2(1, 1) },
      uFundido: { value: 0 }, uColFundido: { value: new THREE.Color(0) } };
    this.quad = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false }));
    this.quadLum = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { tCol: { value: this.rt.texture } }, vertexShader: VS, fragmentShader: FS_LUM, depthTest: false, depthWrite: false }));
    this.escenaQ = new THREE.Scene(); this.camQ = new THREE.Camera();
    this.lumAdapt = null; this.cuadro = 0;
  }
  tam() { const s = new THREE.Vector2(); this.r.getDrawingBufferSize(s); if (s.x !== this.rt.width || s.y !== this.rt.height) this.rt.setSize(s.x, s.y); this.u.uRes.value.copy(s); }
  /* Ajustes efectivos: volúmenes sin límite por prioridad + cámara */
  ajustes() {
    const M = this.M, s = { ...DEF };
    const vols = M.actores.filter((a) => a.vivo && a.nat === 'PostProcessVolume' && a.ppOn !== false && (a.datos?.props?.bEnabled !== false || a.ppOn === true));
    vols.sort((a, b) => (a.datos?.props?.Priority ?? 0) - (b.datos?.props?.Priority ?? 0));
    const fundir = (set, peso = 1) => { if (!set) return; for (const [k, v] of Object.entries(set)) { if (k.startsWith('bOverride_')) continue; if (set['bOverride_' + k] !== true) continue; s[k] = v; } };
    for (const a of vols) fundir(a.pp || a.datos?.props?.Settings, a.ppPeso ?? 1);
    const cam = M.cm?.vista?.obj?.comps?.find((c) => /CameraComponent/.test(c.nat));
    if (cam) fundir(cam.pp || cam.nodo?.pp, cam.ppPeso ?? 1);
    return s;
  }
  chameleon() {
    const r = { alc: 0, drug: 0, blur: 0 };
    for (const a of this.M.actores) {
      if (!a.vivo || a.clase?.n !== 'Chameleon_C') continue;
      const pp = a.comps.find((c) => c.nat === 'PostProcessComponent');
      if (!a.v.Enabled || (pp && (pp.ppOn === false || (pp.ppPeso ?? 1) <= 0))) continue;
      const v = a.v;
      if (v.Alcohol) r.alc = Math.max(r.alc, +(v['Alcohol Offset'] ?? 0));
      if (v.Drug) r.drug = Math.max(r.drug, +(v['Drug Speed'] ?? 0));
      if (v.Blur) r.blur = Math.max(r.blur, +(v['Blur Amount'] ?? v['Blur Strength'] ?? 0) * 0.5);
    }
    return r;
  }
  medir() {
    this.r.setRenderTarget(this.rtLum); this.r.render(this.quadLum, this.camQ);
    this.r.readRenderTargetPixels(this.rtLum, 0, 0, 32, 18, this.buf);
    // como el histograma de UE 4.16: promedio entre el 80 % y el 98,3 % más claro (no de toda la imagen)
    const n = 32 * 18, v = this.lums || (this.lums = new Float32Array(n));
    for (let i = 0; i < n; i++) v[i] = this.buf[i * 4] / 255 * 24 - 16;
    v.sort();
    const a = Math.floor(n * 0.8), b = Math.ceil(n * 0.983);
    let s = 0; for (let i = a; i < b; i++) s += v[i];
    return Math.pow(2, s / (b - a));
  }
  render(escena, camara, dt) {
    if (!this.activo) { this.r.setRenderTarget(null); this.r.render(escena, camara); return; }
    this.tam();
    const tm = this.r.toneMapping; this.r.toneMapping = THREE.NoToneMapping;
    this.r.setRenderTarget(this.rt); this.r.render(escena, camara);
    const s = this.ajustes();
    if (this.cuadro++ % 8 === 0) {
      try { const l = this.medir(); this.lumMedida = l; } catch { this.lumMedida = this.lumMedida ?? 0.1; }
    }
    const meta = Math.min(s.AutoExposureMaxBrightness, Math.max(s.AutoExposureMinBrightness, this.lumMedida ?? 0.1));
    if (this.lumAdapt == null) this.lumAdapt = meta;
    const vel = meta > this.lumAdapt ? s.AutoExposureSpeedUp : s.AutoExposureSpeedDown;
    this.lumAdapt += (meta - this.lumAdapt) * Math.min(1, (dt || 0.016) * (vel || 1) * 1.5);
    const u = this.u;
    u.uExp.value = this.k * Math.pow(2, s.AutoExposureBias || 0) / Math.max(1e-4, this.lumAdapt) * 0.18;
    u.uSat.value = V4(s.ColorSaturation, 1); u.uCon.value = V4(s.ColorContrast, 1); u.uGam.value = V4(s.ColorGamma, 1); u.uGain.value = V4(s.ColorGain, 1); u.uOff.value = V4(s.ColorOffset, 0);
    u.uVig.value = s.VignetteIntensity ?? 0.4; u.uGrano.value = s.GrainIntensity ?? 0; u.uT.value += dt || 0.016;
    const ch = this.chameleon(); u.uAlc.value = ch.alc; u.uDrug.value = ch.drug; u.uBlur.value = ch.blur;
    this.r.setRenderTarget(null); this.r.render(this.quad, this.camQ);
    this.r.toneMapping = tm;
  }
  fundido(a, c) { this.u.uFundido.value = a; if (c) this.u.uColFundido.value.setRGB(c.R ?? 0, c.G ?? 0, c.B ?? 0); }
}
