// XRSLAM en un Web Worker: el SLAM tarda decenas de ms por cuadro y, si
// corriera en la página, trabaría el dibujo. Acá corre aparte y la página
// sólo recibe poses.
//
// Mensajes que recibe (en orden: el worker los atiende uno por uno):
//   {tipo: "crear", slam, sensor}              textos YAML
//   {tipo: "giro", d: Float64Array}            [t, x, y, z]*  rad/s
//   {tipo: "acel", d: Float64Array}            [t, x, y, z]*  m/s² con gravedad
//   {tipo: "cuadro", t, gris: ArrayBuffer, ancho}
// Mensajes que manda:
//   {tipo: "listo", ok}
//   {tipo: "pose", estado, t, camara: [x, y, z, qx, qy, qz, qw], ms}
//        cada vez que aparece una pose nueva (una imagen se procesa recién
//        cuando llega IMU posterior a ella: puede aparecer tras un "giro")
//   {tipo: "puntos", p: Float64Array}          cada 8 cuadros
//   {tipo: "libre", ms}                        ya se procesó el último cuadro
//        (XRSLAM lo procesa cuando el giróscopo Y el acelerómetro pasan su
//        hora); ms = lo que costó, IMU incluida. Recién ahí conviene mandar otro.
import XRSLAM from "./dist/xrslam.mjs";

let M = null, pImg = 0, tamImg = 0, pPose = 0, pPts = 0, pDiag = 0;
let ultimaT = -1, cuadros = 0, msCuadro = 0;
let estadoAvisado = -1;
let tPendiente = null, tGiro = -Infinity, tAcel = -Infinity, acumulado = 0;
const MAX_PUNTOS = 3000;
const listo = XRSLAM({ print: () => {}, printErr: (s) => { if (/error|fatal/i.test(s)) console.warn("[xrslam]", s); } })
  .then((m) => { M = m; pPose = M._malloc(8 * 8); pDiag = M._malloc(8 * 8); pPts = M._malloc(MAX_PUNTOS * 3 * 8); postMessage({ tipo: "cargado" }); })
  .catch((e) => { postMessage({ tipo: "error", mensaje: String(e && e.message ? e.message : e) }); throw e; });

function avisarPose() {
  const estado = M._xr_estado();
  if (estado !== 1) {
    if (estado !== estadoAvisado) postMessage({ tipo: "pose", estado, t: 0, camara: null, ms: msCuadro });
    estadoAvisado = estado;
    return;
  }
  estadoAvisado = estado;
  M._xr_pose(pPose, 1);
  const p = M.HEAPF64.subarray(pPose / 8, pPose / 8 + 8);
  if (p[0] <= ultimaT) return;
  const nq = p[4] * p[4] + p[5] * p[5] + p[6] * p[6] + p[7] * p[7];
  if (!(nq > 0.5)) return;
  ultimaT = p[0];
  postMessage({ tipo: "pose", estado, t: p[0], camara: Array.from(p.subarray(1, 8)), ms: msCuadro });
}

function quizasLibre() {
  if (tPendiente !== null && tGiro > tPendiente && tAcel > tPendiente) {
    msCuadro = acumulado; acumulado = 0; tPendiente = null;
    // Con el diagnóstico de la inicialización: por qué no arranca, si no arranca.
    M._xr_diag(pDiag);
    postMessage({ tipo: "libre", ms: msCuadro, diag: Array.from(M.HEAPF64.subarray(pDiag / 8, pDiag / 8 + 8)) });
  }
}

onmessage = async (e) => {
  await listo;
  const m = e.data, t0 = performance.now();
  atender(m);
  acumulado += performance.now() - t0;
  if (m.tipo === "giro" || m.tipo === "acel") quizasLibre();
};

function atender(m) {
  if (m.tipo === "crear") {
    const a = M.stringToNewUTF8(m.slam), b = M.stringToNewUTF8(m.sensor);
    const ok = M._xr_crear(a, b) === 1;
    M._free(a); M._free(b);
    ultimaT = -1; cuadros = 0; estadoAvisado = -1; tPendiente = null; tGiro = tAcel = -Infinity; acumulado = 0;
    postMessage({ tipo: "listo", ok });
  } else if (m.tipo === "giro" || m.tipo === "acel") {
    const d = m.d, f = m.tipo === "giro" ? M._xr_giro : M._xr_acel;
    for (let i = 0; i < d.length; i += 4) f(d[i], d[i + 1], d[i + 2], d[i + 3]);
    if (d.length) { const u = d[d.length - 4]; if (m.tipo === "giro") tGiro = u; else tAcel = u; }
    avisarPose();
  } else if (m.tipo === "cuadro") {
    const n = m.gris.byteLength;
    if (n !== tamImg) { if (pImg) M._free(pImg); pImg = M._malloc(n); tamImg = n; }
    M.HEAPU8.set(new Uint8Array(m.gris), pImg);
    M._xr_imagen(m.t, pImg, m.ancho);
    tPendiente = m.t;
    avisarPose();
    if (++cuadros % 8 === 0) {
      const k = M._xr_puntos(pPts, MAX_PUNTOS);
      postMessage({ tipo: "puntos", p: M.HEAPF64.slice(pPts / 8, pPts / 8 + k * 3) });
    }
  } else if (m.tipo === "destruir") {
    M._xr_destruir();
  }
}
