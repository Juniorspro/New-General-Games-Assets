// El cielo, el sol y la niebla.
//
// EL SOL SALE DE LA FOTO, NO AL REVÉS. La dirección de la luz se calcula del
// punto más brillante del panorama (lo mide procesar_assets.py y lo deja en
// datos.json). Si la luz se eligiera a ojo, las sombras apuntarían para un
// lado y el sol pintado estaría en otro, y eso el ojo lo nota aunque no sepa
// decir qué es lo raro.
//
// LA NIEBLA NO ES UN COLOR PAREJO. Al atardecer la bruma hacia el sol es
// dorada y la de espaldas al sol es azul, y además se junta en lo bajo: el
// lago y los valles quedan lechosos y las lomas limpias. Las dos cosas se
// suman a la niebla de three reemplazando sus trozos de shader; sin eso el
// fondo se ve como una pared gris a cierta distancia.
import * as THREE from "three";
import { parchear, reemplazar } from "./parche.js";

export const NIEBLA = {
  uNieblaSol: { value: new THREE.Color() },
  uSolVista: { value: new THREE.Vector3(0, 0, -1) },
  uVistaMundo: { value: new THREE.Matrix3() },
  uCamY: { value: 0 },
  uNieblaBase: { value: 0 },      // altura donde la bruma es más densa
  uNieblaCaida: { value: 0.11 },  // cada 1/0,11 = 9 m hacia arriba, e veces menos
  uNieblaAlta: { value: 0.0075 }, // densidad de la bruma baja, a la altura del lago
};

const PARS_V = `
#ifdef USE_FOG
  varying vec3 vPosNiebla;
#endif`;
const V = `
#ifdef USE_FOG
  vPosNiebla = mvPosition.xyz;
#endif`;
const PARS_F = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogDensity;
  uniform vec3 uNieblaSol;
  uniform vec3 uSolVista;
  uniform mat3 uVistaMundo;
  uniform float uCamY, uNieblaBase, uNieblaCaida, uNieblaAlta;
  varying vec3 vPosNiebla;
  vec3 nieblaDe(vec3 col, vec3 posVista) {
    float dist = length(posVista);
    vec3 dirV = posVista / max(dist, 1e-4);
    float dy = (uVistaMundo * dirV).y;
    // bruma baja: densidad a·e^(-b·(y - base)), integrada a lo largo del rayo
    float b = uNieblaCaida;
    float k = b * dy;
    float integ = abs(k) > 1e-4 ? (1.0 - exp(-k * dist)) / k : dist;
    float baja = uNieblaAlta * exp(-b * (uCamY - uNieblaBase)) * integ;
    float cantidad = 1.0 - exp(-(fogDensity * dist + baja));
    float sol = pow(max(dot(dirV, uSolVista), 0.0), 6.0);
    vec3 cn = mix(fogColor, uNieblaSol, sol * 0.9);
    return mix(col, cn, clamp(cantidad, 0.0, 1.0));
  }
#endif`;
const F = `
#ifdef USE_FOG
  gl_FragColor.rgb = nieblaDe(gl_FragColor.rgb, vPosNiebla);
#endif`;

/** Le pone a un material de three la niebla de este bosque. */
export function vestirNiebla(mat) {
  // UNA VEZ POR MATERIAL. La laja se usa para el mirador y para las lajas
  // repartidas: el mismo material pasaba dos veces por acá, y el segundo
  // parche ya no encontraba los trozos que el primero había reemplazado.
  if (mat.userData.niebla) return mat;
  mat.userData.niebla = true;
  return parchear(mat, "niebla1", (sh) => {
    Object.assign(sh.uniforms, NIEBLA);
    sh.vertexShader = reemplazar(sh.vertexShader, "#include <fog_pars_vertex>", PARS_V, "niebla");
    sh.vertexShader = reemplazar(sh.vertexShader, "#include <fog_vertex>", V, "niebla");
    sh.fragmentShader = reemplazar(sh.fragmentShader, "#include <fog_pars_fragment>", PARS_F, "niebla");
    sh.fragmentShader = reemplazar(sh.fragmentShader, "#include <fog_fragment>", F, "niebla");
  });
}

/** Lo mismo para un ShaderMaterial propio (el agua, el cielo). */
export const NIEBLA_GLSL = { PARS_F, uniforms: NIEBLA };

/** De (u,v) del panorama a una dirección, con la convención de three:
 *  u = atan(z,x)/2π + 0,5 ; v = asin(y)/π + 0,5 */
export function direccionDe(u, v) {
  const fi = (u - 0.5) * Math.PI * 2, el = (v - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(el) * Math.cos(fi), Math.sin(el), Math.cos(el) * Math.sin(fi));
}

export function armaCielo(texCielo, datos) {
  texCielo.generateMipmaps = false;           // ver abajo
  texCielo.minFilter = THREE.LinearFilter;
  const sol = direccionDe(datos.sol_u, datos.sol_v);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tCielo: { value: texCielo },
      uSol: { value: sol },
      uBrillo: { value: 1.25 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;        // siempre en el fondo, sin importar el radio
      }`,
    fragmentShader: `
      uniform sampler2D tCielo;
      uniform vec3 uSol;
      uniform float uBrillo;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        // SIN MIPMAPS A PROPÓSITO. El atan salta de +π a -π en la costura: la
        // derivada de u ahí es enorme, la tarjeta elige el mip más chico y se
        // ve una raya vertical de un pixel en el cielo. El panorama de 4096
        // mirado con 78° de campo ya viene a ~1 texel por pixel: no hacen
        // falta mips.
        vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        vec3 c = texture2D(tCielo, uv).rgb * uBrillo;
        // EL SOL DE LA FOTO NO QUEMA: está guardado en 8 bits, así que su
        // blanco vale lo mismo que una nube blanca. Se le suma un disco con
        // brillo de verdad (muy por encima de 1) para que el tono y los rayos
        // lo traten como la luz más fuerte de la escena.
        float cs = dot(d, uSol);
        c += vec3(1.0, 0.78, 0.5) * (smoothstep(0.99985, 0.99995, cs) * 40.0 + pow(max(cs, 0.0), 350.0) * 3.0 + pow(max(cs, 0.0), 12.0) * 0.35);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
  });
  const malla = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  malla.frustumCulled = false;
  malla.renderOrder = -1;
  malla.name = "cielo";
  return { malla, sol };
}

export function armaLuces(escena, datos, sombra) {
  const solFoto = direccionDe(datos.sol_u, datos.sol_v);
  // LA LUZ SALE DEL SOL PINTADO, y nunca más baja que 11°. Por debajo de eso
  // el piso del bosque queda en sombra entera salvo un par de manchas y no se
  // ve dónde se pisa. El panorama se procesó para que el sol quede a ~12°
  // (ver procesar_assets.py): luz y sol coinciden, y las sombras apuntan
  // exactamente para el lado contrario al que se ve el sol.
  const plano = new THREE.Vector2(solFoto.x, solFoto.z).normalize();
  const el = Math.max(THREE.MathUtils.degToRad(11), Math.asin(solFoto.y));
  const dirLuz = new THREE.Vector3(plano.x * Math.cos(el), Math.sin(el), plano.y * Math.cos(el));

  // EL AMBIENTE NO PUEDE GANARLE AL SOL. En la primera versión el cielo y el
  // reflejo del panorama sumaban más luz que el sol sobre el suelo, y todo
  // salía plano y lechoso, sin sombras que se leyeran. Al atardecer lo que da
  // forma es el contraste: el sol rasante dorado y la sombra azul y oscura.
  const sol = new THREE.DirectionalLight(new THREE.Color(1.0, 0.74, 0.5), 4.6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(sombra, sombra);
  const S = 34;
  Object.assign(sol.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 260 });
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.05;
  escena.add(sol, sol.target);

  const cielo = new THREE.HemisphereLight(new THREE.Color(0.5, 0.58, 0.74), new THREE.Color(0.16, 0.13, 0.08), 0.5);
  escena.add(cielo);

  const [nr, ng, nb] = datos.niebla, [sr, sg, sb] = datos.niebla_sol;
  // la niebla en lineal: el panorama se leyó en sRGB y se guardó en sRGB
  const niebla = new THREE.Color().setRGB(nr, ng, nb, THREE.SRGBColorSpace);
  NIEBLA.uNieblaSol.value.setRGB(sr * 1.12, sg * 1.02, sb * 0.92, THREE.SRGBColorSpace);
  escena.fog = new THREE.FogExp2(niebla, 0.003);
  return { sol, cielo, dirLuz, solFoto };
}

const _m4 = new THREE.Matrix4(), _v = new THREE.Vector3();

/** Una vez por cuadro: la niebla necesita saber hacia dónde mira la cámara,
 *  y la caja de sombra sigue al caminante. */
export function actualizarCielo(luces, cam, foco) {
  NIEBLA.uSolVista.value.copy(luces.solFoto).transformDirection(cam.matrixWorldInverse);
  NIEBLA.uVistaMundo.value.setFromMatrix4(cam.matrixWorld);
  NIEBLA.uCamY.value = cam.position.y;

  // LA CAJA DE SOMBRA AVANZA DE A UN TEXEL. Si sigue al caminante de forma
  // continua, cada cuadro el mapa de sombras cae medio pixel corrido y todos
  // los bordes de sombra titilan al caminar, como si el sol temblara.
  const sol = luces.sol;
  const tam = (sol.shadow.camera.right - sol.shadow.camera.left) / sol.shadow.mapSize.x;
  _m4.lookAt(_v.set(0, 0, 0), luces.dirLuz.clone().negate(), new THREE.Vector3(0, 1, 0));
  const inv = _m4.clone().invert();
  const p = foco.clone().applyMatrix4(inv);
  p.x = Math.round(p.x / tam) * tam; p.y = Math.round(p.y / tam) * tam;
  p.applyMatrix4(_m4);
  sol.target.position.copy(p);
  sol.position.copy(p).addScaledVector(luces.dirLuz, 120);
  sol.target.updateMatrixWorld();
}
