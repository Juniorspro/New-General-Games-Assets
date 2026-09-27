// LAS MANOS DE UN VIDEO DE VERDAD (vuelta 24): lo que ve MediaPipe en un video filmado con el celu, como
// lo ve el juego (30 fotos por segundo, 320 de ancho, las mismas opciones), y cómo lo sigue js/manos.js.
//     node aeroplaza/herramientas/manos-video.mjs sacar <video.mp4> [salida.json]
//       pasa cada foto por MediaPipe (en Chromium, CPU), buscando una mano y buscando dos, y guarda lo
//       que devuelve (la imagen, la forma 3D, qué mano dice y con cuánta confianza). Tarda ~2 min.
//     node aeroplaza/herramientas/manos-video.mjs medir <salida.json> [manos.js] [la cámara tarda (ms) = 90]
//       se lo pasa a manos.js con el atraso de un celu (como manos-lento) y mide contra la imagen.
// Lo de verdad es la imagen de MediaPipe (lo preciso), suavizada sin atraso (±2 fotos, centrada). Mide:
// - ver: lo que se corre la mano dibujada de la imagen, en % del largo de la palma en la imagen (promedio y
//   5 % peor), cuadro a cuadro a 120 por segundo; centro (dónde está) y forma (lo demás, con el centro
//   en su lugar); y quieta, lo mismo (verQuieta);
// - estira: lo que se aleja cada hueso de su largo (el mediano del video), % (5 % peor y el peor);
// - dobla: los nudillos que se doblan para atrás (más de 25°, contra la palma), % de cuadros;
// - alReves: los cuadros en que la forma dibujada se dobla claro como la otra mano (más de 5 cm, la suma de
//   las cinco puntas); izq: dibujada como izquierda;
// - dobles: cuadros con dos manos; sin: cuadros sin mano cuando MediaPipe la ve;
// - tiembla: lo que se mueve de un cuadro al otro, quieta (mm).
// MP=1 (de entrada) usa lo que salió buscando una mano; DOS=1, buscando dos (ahí aparecen los fantasmas).
// El video y lo que sale NO se guardan en el repo (es la mano de quien pide): pruebas/salida está ignorada.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI);
const [modo, arg1, arg2, arg3] = process.argv.slice(2);

if (modo === 'sacar') {
  const { navegador, mediapipe } = await import('../pruebas/comun.mjs');
  const video = arg1, salida = arg2 || path.join(RAIZ, 'pruebas/salida/manos-video.json');
  const tmp = fs.mkdtempSync('/tmp/manos-video-');
  /* (30 fotos por segundo y 320 de ancho, como las toma el juego: manos-camara.js › ANCHO_RED) */
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', 'fps=30,scale=320:-2', '-q:v', '3', path.join(tmp, '%05d.jpg')]);
  const cuadros = fs.readdirSync(tmp).filter((f) => f.endsWith('.jpg')).sort();
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1', MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  const d = mediapipe(), nav = await navegador(), ctx = await nav.newContext(), pag = await ctx.newPage();
  const tipo = (f) => f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.task') ? 'application/octet-stream' : 'text/javascript';
  await ctx.route((u) => u.href.startsWith(MP + '/') || u.href === MODELO, (r) => {
    const u = r.request().url(), f = u === MODELO ? 'hand_landmarker.task' : u.slice(MP.length + 1);
    r.fulfill({ body: fs.readFileSync(path.join(d, f)), contentType: tipo(f), headers: { 'access-control-allow-origin': '*' } });
  });
  await pag.route('https://prueba.local/', (r) => r.fulfill({ body: '<!doctype html><title>manos</title>', contentType: 'text/html' }));
  await pag.goto('https://prueba.local/');
  await pag.evaluate(async ([MP, MODELO]) => {
    const { FilesetResolver, HandLandmarker } = await import(MP + '/vision_bundle.mjs');
    const fs = await FilesetResolver.forVisionTasks(MP + '/wasm');
    /* (las mismas opciones que el juego: manos-camara.js, el worker) */
    const op = (n) => ({ baseOptions: { modelAssetPath: MODELO, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: n, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
    window.__lm = [await HandLandmarker.createFromOptions(fs, op(1)), await HandLandmarker.createFromOptions(fs, op(2))];
  }, [MP, MODELO]);
  const out = { video: path.basename(video), fps: 30, cuadros: [] }, t0 = Date.now();
  for (const [k, f] of cuadros.entries()) {
    const url = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(tmp, f)).toString('base64');
    out.cuadros.push(await pag.evaluate(async ([url, ts]) => {
      const im = new Image(); im.src = url; await im.decode(); const bm = await createImageBitmap(im);
      const r = window.__lm.map((lm) => lm.detectForVideo(bm, ts)); bm.close();
      const manos = (x) => x.landmarks.map((L, h) => ({ img: L.flatMap((p) => [p.x, p.y, p.z]), mundo: x.worldLandmarks[h].flatMap((p) => [p.x, p.y, p.z]), derecha: x.handedness[h]?.[0]?.categoryName === 'Right', conf: x.handedness[h]?.[0]?.score ?? 0 }));
      return { t: ts, a: im.width / im.height, una: manos(r[0]), dos: manos(r[1]) };
    }, [url, Math.round(k * 1000 / 30) + 1]));
    if (k % 60 === 0) console.log(`${k}/${cuadros.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  fs.mkdirSync(path.dirname(salida), { recursive: true }); fs.writeFileSync(salida, JSON.stringify(out));
  const vio = (m) => out.cuadros.filter((c) => c[m].length).length, dos = out.cuadros.filter((c) => c.dos.length > 1).length;
  console.log(`${out.cuadros.length} fotos · con mano: ${vio('una')} (buscando una), ${vio('dos')} (buscando dos) · con dos manos: ${dos} → ${salida}`);
  await nav.close(); fs.rmSync(tmp, { recursive: true });
  process.exit(0);
}
if (modo !== 'medir') { console.log('node herramientas/manos-video.mjs sacar <video.mp4> [salida.json] | medir <salida.json> [manos.js] [ms]'); process.exit(1); }

/* ------------------------------------------------------------------ medir */
const lienzo = () => { const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => ((o[k] = v), true) }); return { width: 0, height: 0, getContext: () => ctx }; };
globalThis.document = { createElement: lienzo, documentElement: {} };
globalThis.window ??= {};
const { Manos } = await import(arg2 ? new URL(arg2, 'file://' + process.cwd() + '/').href : '../js/manos.js');
const THREE = await import('three');
const { puntosMano } = await import('../js/manos-camara.js');
const D = JSON.parse(fs.readFileSync(arg1));
const LCAM = +(arg3 ?? 90), RED = +(process.env.RED ?? 34), CUAL = process.env.DOS ? 'dos' : 'una', SUAVE = process.env.SUAVE || 'media';
const largo = Math.tan(33 * Math.PI / 180), K = D.cuadros.length, DT = 1000 / D.fps;
const tans = (a) => (a >= 1 ? [largo, largo / a] : [largo * a, largo]);
/* lo de verdad: la imagen de MediaPipe (buscando una), suavizada 1-2-1 sin atraso, y la profundidad de su forma */
const img = D.cuadros.map((c) => c.una[0]?.img || null);
const verdad = img.map((I, k) => {
  if (!I) return null;
  const a = img[k - 1], b = img[k + 1];
  return a && b ? I.map((v, i) => (a[i] + 2 * v + b[i]) / 4) : I.slice();
});
const hondo = D.cuadros.map((c) => { const h = c.una[0]; if (!h) return null; const [tx, ty] = tans(c.a), P = puntosMano(Float32Array.from([...h.img, ...h.mundo]), Float32Array.from([...h.img, ...h.mundo]), tx, ty, 0, 63); return P ? -P[2 * 0 + 2] : null; });
/* (la verdad a la hora t: entre las dos fotos de al lado; si falta una, nada) */
const verdadEn = (t) => { const f = t / DT, k = Math.floor(f), u = f - k; const A = verdad[k], B = verdad[k + 1]; if (!A || !B) return null; return { I: A.map((v, i) => v + (B[i] - v) * u), z: hondo[k] + (hondo[k + 1] - hondo[k]) * u, a: D.cuadros[k].a }; };
const HUESOS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const quir = (P) => { const s = (i, j) => [0, 1, 2].map((k) => P[i * 3 + k] - P[j * 3 + k]), a = s(5, 0), b = s(17, 0); let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
  return { q: [4, 8, 12, 16, 20].reduce((q, i) => { const d = s(i, 0); return q + d[0] * n[0] + d[1] * n[1] + d[2] * n[2]; }, 0), n }; };
/* (cada dedo doblado para el dorso más de 25°: la punta (del nudillo del medio a la punta) se va para el
   lado del dorso contra el primer hueso; n es la normal cruda, que en una derecha sale por la palma) */
const atras = (P, n) => { let peor = 0; for (const f of [5, 9, 13, 17]) {
  const u = [0, 1, 2].map((k) => P[(f + 1) * 3 + k] - P[f * 3 + k]), w = [0, 1, 2].map((k) => P[(f + 3) * 3 + k] - P[(f + 1) * 3 + k]), lu = Math.hypot(...u) || 1, lw = Math.hypot(...w) || 1;
  const d = (w[0] * n[0] + w[1] * n[1] + w[2] * n[2]) / lw - (u[0] * n[0] + u[1] * n[1] + u[2] * n[2]) / lu; peor = Math.min(peor, d); }
  return -Math.asin(Math.max(-1, Math.min(1, peor))) * 180 / Math.PI; };
const manos = new Manos(); manos.activa = true; manos.fuente = 'camara'; manos.suavidad = SUAVE;
const q0 = new THREE.Quaternion(), p0 = new THREE.Vector3(), ctx = { cabezaP: p0, cabezaQ: q0, interactivos: [], altura: () => -10, sePuede: () => true };
const R = { ver: [], peor: [], quieta: [], largos: HUESOS.map(() => []), alReves: 0, izq: 0, atras: 0, dobles: 0, sin: 0, vistos: 0, cuadros: 0, tiembla: [] };
let k = 0, antes = null, ultimaCruda = null;
for (let T = 0; T < K * DT + 300; T += 1000 / 120) {
  while (k < K && k * DT + LCAM + RED <= T) {
    const c = D.cuadros[k], [tx, ty] = tans(c.a);
    const lista = c[CUAL].map((h) => { const b = Float32Array.from([...h.img, ...h.mundo]); return { derecha: h.derecha, confianza: h.conf, puntos: puntosMano(b, b, tx, ty, 0, 63), img: Float32Array.from(h.img), forma: Float32Array.from(h.mundo) }; }).filter((m) => m.puntos);
    manos.recibirCamara(lista, k * DT, T, CUAL === 'dos' ? 2 : 1); k++;
    /* (CRUDO=1: la última foto tal cual, sin filtro: el piso de lo que se puede) */
    if (process.env.CRUDO && lista[0]) { const P = lista[0].puntos; ultimaCruda = Float32Array.from(P, (v, i) => (i % 3 === 2 ? v - 0.06 : v));
      /* (CRUDO=2: y pasada por el tamaño fijo y los huesos por el rayo, con la forma que aprendió la mano) */
      if (process.env.CRUDO === '2') { const M = manos.manos.find((x) => x.visible) || manos.manos[1]; if (M.forma) { M.escalar(ultimaCruda, [0, 0, -0.06]); M.alRayo(ultimaCruda, [0, 0, -0.06]); } } }
  }
  const tVer = T + 25;
  manos.registrarCabeza(tVer, q0, p0, 0); manos.actualizar(1 / 120, tVer, ctx);
  const V = verdadEn(tVer); if (!V) { antes = null; continue; }
  R.cuadros++;
  const dib = manos.manos.filter((M) => M.alfa > 0.02); if (dib.length > 1) R.dobles++;
  let M = process.env.CRUDO ? (ultimaCruda && { p: ultimaCruda, derecha: true }) : manos.manos.filter((M) => M.alfa >= 0.5).sort((a, b) => b.alfa - a.alfa)[0];
  /* (ETAPA=filtro: la mano que sale del filtro, antes del adelanto, el resorte y las anclas) */
  if (M && process.env.ETAPA === 'filtro') M = { p: M.euro.x, derecha: M.derecha };
  if (!M) { R.sin++; antes = null; continue; }
  R.vistos++;
  const [tx, ty] = tans(V.a), cam = [0, 0, -0.06];
  /* (la mano dibujada, vista desde la cámara, contra la imagen: en mm a la distancia de la mano) */
  /* (en la imagen, en % del largo de la palma en la imagen (de la muñeca al nudillo del medio): no depende
     de la profundidad, que con la mano cerca y cortada por el borde salta de 5 a 30 cm) */
  const A = [], B = [];
  for (let i = 0; i < 21; i++) {
    const x = M.p[i * 3] - cam[0], y = M.p[i * 3 + 1] - cam[1], z = M.p[i * 3 + 2] - cam[2];
    A.push([x / -z, -y / -z]); B.push([(V.I[i * 3] - 0.5) * 2 * tx, (V.I[i * 3 + 1] - 0.5) * 2 * ty]);
  }
  const palma = Math.hypot(B[9][0] - B[0][0], B[9][1] - B[0][1]) || 1, cA = [0, 5, 9, 13, 17].reduce((c, i) => [c[0] + A[i][0] / 5, c[1] + A[i][1] / 5], [0, 0]), cB = [0, 5, 9, 13, 17].reduce((c, i) => [c[0] + B[i][0] / 5, c[1] + B[i][1] / 5], [0, 0]);
  let s = 0, mx = 0, sf = 0;
  for (let i = 0; i < 21; i++) {
    const d = Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]) / palma * 100, f = Math.hypot(A[i][0] - cA[0] - B[i][0] + cB[0], A[i][1] - cA[1] - B[i][1] + cB[1]) / palma * 100;
    s += d; sf += f; mx = Math.max(mx, d);
  }
  R.ver.push(s / 21); R.peor.push(mx); (R.centro ||= []).push(Math.hypot(cA[0] - cB[0], cA[1] - cB[1]) / palma * 100); (R.forma ||= []).push(sf / 21);
  if (process.env.PUNTOS && Math.abs(tVer - +process.env.PUNTOS) < 4.2) { console.log('t', tVer.toFixed(0), 'palma', palma.toFixed(3)); for (const i of [0, 5, 9, 13, 17, 1, 4, 8, 12, 16, 20]) console.log(String(i).padStart(3), 'dib', A[i].map((v) => v.toFixed(3)).join(','), 'verdad', B[i].map((v) => v.toFixed(3)).join(','), 'dif %', ((Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]) / palma) * 100).toFixed(0), 'z', (-(M.p[i * 3 + 2] + 0.06)).toFixed(3)); }
  if (process.env.SEG) { const sg = Math.floor(tVer / 500); ((R.seg ||= {})[sg] ||= []).push([R.centro.at(-1), R.forma.at(-1)]); }
  if (process.env.TRAZA && R.vistos % 30 === 1) console.log((tVer / 1000).toFixed(2), 'centro', R.centro.at(-1).toFixed(0), '% · forma', R.forma.at(-1).toFixed(0), '% · z dib', (-(M.p[2] - cam[2])).toFixed(3), 'z foto', V.z.toFixed(3));
  HUESOS.forEach(([a, b], h) => R.largos[h].push(Math.hypot(M.p[a * 3] - M.p[b * 3], M.p[a * 3 + 1] - M.p[b * 3 + 1], M.p[a * 3 + 2] - M.p[b * 3 + 2])));
  if (process.env.ESTIRA) (R.cuando ||= []).push(tVer);
  const Q = quir(M.p); if (Q.q < -0.05) R.alReves++; if (!M.derecha) R.izq++; if (atras(M.p, Q.n) > 25) R.atras++;
  /* (quieta: la verdad casi no se mueve en ±0,1 s) */
  const V1 = verdadEn(tVer - 100), V2 = verdadEn(tVer + 100);
  if (V1 && V2) { const c = (X) => [0, 5, 9, 13, 17].reduce((a, i) => [a[0] + X.I[i * 3] / 5, a[1] + X.I[i * 3 + 1] / 5], [0, 0]), c1 = c(V1), c2 = c(V2);
    const vel = Math.hypot((c2[0] - c1[0]) * 2 * tx, (c2[1] - c1[1]) * 2 * ty) * V.z / 0.2;
    if (vel < 0.03) { R.quieta.push(s / 21); const cd = [0, 5, 9, 13, 17].reduce((a, i) => [a[0] + M.p[i * 3] / 5, a[1] + M.p[i * 3 + 1] / 5, a[2] + M.p[i * 3 + 2] / 5], [0, 0, 0]); if (antes) R.tiembla.push(Math.hypot(cd[0] - antes[0], cd[1] - antes[1]) * 1000); antes = cd; } else antes = null; }
}
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const media = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const estira = R.largos.map((L) => { const m = pct(L, 0.5); return L.map((l) => Math.abs(l / m - 1) * 100); }).flat();
const r = (x, d = 1) => +x.toFixed(d);
const out = { ver: r(media(R.ver)), verP95: r(pct(R.ver, 0.95)), centro: r(media(R.centro)), forma: r(media(R.forma)), formaP95: r(pct(R.forma, 0.95)), peorP95: r(pct(R.peor, 0.95)), verQuieta: r(media(R.quieta)), estiraP95: r(pct(estira, 0.95)), estiraMax: r(pct(estira, 0.999)),
  alReves: r(100 * R.alReves / Math.max(1, R.vistos)), izq: r(100 * R.izq / Math.max(1, R.vistos)), atras: r(100 * R.atras / Math.max(1, R.vistos)), dobles: r(100 * R.dobles / R.cuadros), sin: r(100 * R.sin / R.cuadros), tiembla: r(Math.sqrt(media(R.tiembla.map((x) => x * x))), 2) };
/* (ESTIRA=1: en qué momentos y qué huesos se estiran más del 20 %) */
if (process.env.ESTIRA) { const m = R.largos.map((L) => pct(L, 0.5)), v = [];
  R.cuando.forEach((t, i) => R.largos.forEach((L, h) => { const e = Math.abs(L[i] / m[h] - 1) * 100; if (e > 20) v.push(`${(t / 1000).toFixed(2)}s ${HUESOS[h].join('-')} ${e.toFixed(0)}%`); }));
  const T = {}; for (const x of v) { const k = x.split("s ")[0]; T[(+k).toFixed(1)] = (T[(+k).toFixed(1)] || 0) + 1; } console.log(v.length, "estirados, por décima de s:", JSON.stringify(T)); }
if (process.env.SEG) console.log(Object.entries(R.seg).map(([k, v]) => `${(k / 2).toFixed(1)}s ${media(v.map((x) => x[0])).toFixed(0)}/${media(v.map((x) => x[1])).toFixed(0)}`).join(' · '));
console.log(JSON.stringify(out));
