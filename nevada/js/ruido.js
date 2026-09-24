/* ============================================================================
   nevada/js/ruido.js — azar con semilla y ruido de valor, iguales en JS y en
   GLSL. El suelo se calcula acá (para apoyar al tigre y a las ruedas) y en el
   shader del suelo (para pintar el camino): si las dos cuentas no fueran la
   misma, el tigre caminaría sobre un camino que no se ve donde se pisa.
   ========================================================================== */
export function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
}

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const suave = (t) => t * t * (3 - 2 * t);
export function ruido(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = suave(xf), v = suave(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * ruido(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}

/* EL CAMINO: una curva suave a lo largo de z. El auto está parado en z = 0 y
   se va por el camino hacia +z. */
export const caminoX = (z) => 2.2 * Math.sin(z * 0.021) + 1.1 * Math.sin(z * 0.047 + 1.3);
export const ANCHO_CAMINO = 3.4;

/* la altura del suelo en (x, z): lomitas de nieve que se aplanan en el camino y
   alrededor del auto, para que nada quede flotando ni enterrado */
export function alturaSuelo(x, z) {
  const dCam = Math.abs(x - caminoX(z));
  const plano = Math.min(1, Math.max(0, (dCam - ANCHO_CAMINO * 0.6) / 7));
  const cerca = Math.min(1, Math.max(0, (Math.hypot(x, z) - 7) / 10));
  const lomas = (fbm(x * 0.035 + 7, z * 0.035 - 3) - 0.5) * 3.2 + (fbm(x * 0.16, z * 0.16) - 0.5) * 0.45;
  const bordes = Math.exp(-((dCam - ANCHO_CAMINO * 0.72) ** 2) / 0.9) * 0.22;   // la nieve que el paso empujó a los costados
  return lomas * plano * (0.35 + 0.65 * cerca) + bordes + (fbm(x * 0.9, z * 0.9) - 0.5) * 0.05;
}

/* el mismo ruido y el mismo camino en GLSL */
export const GLSL_RUIDO = /* glsl */`
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vruido(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  float a = h21(i), b = h21(i+vec2(1,0)), c = h21(i+vec2(0,1)), d = h21(i+vec2(1,1));
  return a + (b-a)*u.x + (c-a)*u.y + (a-b-c+d)*u.x*u.y; }
float vfbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*vruido(p); p *= 2.03; a *= 0.5; } return s; }
float caminoX(float z){ return 2.2*sin(z*0.021) + 1.1*sin(z*0.047 + 1.3); }
`;
