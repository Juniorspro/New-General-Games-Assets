// LAS MANOS POR LA CÁMARA, DE PUNTA A PUNTA: una cámara de mentira que muestra manos de verdad (las fotos
// de pruebas/manos moviéndose, comun.mjs › videoManos: 0-4 s una mano, 4-8 s dos, 8-11 s el pellizco,
// 11-13 s ninguna) y MediaPipe de verdad en sus workers. Se compara lo de antes (las fotos por el hilo
// del juego y cada red buscando siempre dos manos) con lo de ahora (el lector: las fotos directo de la
// cámara al worker; y una red busca una mano mientras se ve una sola):
// - cuánto tarda cada foto desde que se saca hasta que llega la mano, y cuántas por segundo;
// - que se vean las dos manos cuando aparecen (la segunda la encuentra la red que busca) y que se
//   suelten al irse;
// - que el reloj de las fotos del lector quede calibrado contra el de la cámara.
// (Los números son del contenedor, 4 núcleos sin GPU; en un celu cambian, la proporción no tanto.)
//     node pruebas/manos-directo.mjs
import { navegador, abrir, videoManos } from './comun.mjs';
const video = videoManos();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
if (!video) { console.log('(sin ffmpeg: no se puede armar la cámara de mentira; se saltea)'); process.exit(0); }
const nav = await navegador({ video });
const correr = async (cfg) => {
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 640, alto: 360, manos: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
  const r = await pag.evaluate(async (cfg) => {
    window.AEROPLAZA_MANOS = cfg;
    const A = window.__A, ev = [];
    /* (la mano del juego, con lo que llega, dibujada a cada cuadro con la cabeza quieta: en el video la
       mano es una foto que se mueve, su forma no cambia; lo que cambie la mano dibujada es error) */
    const M = A.manos, q0 = new A.THREE.Quaternion(), p0 = new A.THREE.Vector3(), ctx = { cabezaP: p0, cabezaQ: q0, interactivos: [], altura: () => -10, sePuede: () => true };
    M.activa = true; M.fuente = 'camara'; M.suavidad = 'media';
    const HU = [[1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [17, 18], [18, 19], [19, 20], [0, 5], [5, 9], [9, 13], [13, 17], [0, 17]];
    const CA = [[0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]];
    const medir = (P) => ({ l: HU.map(([i, j]) => Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2])), a: CA.flatMap((c) => c.slice(1, -1).map((b, k) => { const a = c[k], d = c[k + 2], u = [0, 1, 2].map((x) => P[b * 3 + x] - P[a * 3 + x]), v = [0, 1, 2].map((x) => P[d * 3 + x] - P[b * 3 + x]); return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1)))) * 180 / Math.PI; })) });
    const formas = { crudo: [], dibujo: [] };
    let t0f = 0;
    const cuadro = () => { const ahora = performance.now(); M.registrarCabeza(ahora, q0, p0, 0); M.actualizar(1 / 60, ahora, ctx); const v = M.manos.filter((m) => m.visible && m.alfa > 0.5); const rel = ahora - t0f; if (v.length === 1 && rel > 1500 && rel < 3800) formas.dibujo.push(medir(v[0].p)); if (window.__sigue) requestAnimationFrame(cuadro); };
    window.__sigue = true; requestAnimationFrame(cuadro);
    const mc = new A.ManosCamara({ alLlegar: (lista, t, llego, cupo) => { ev.push({ n: lista.length, t, llego, cupo, red: mc._red }); M.recibirCamara(lista, t, llego, cupo); const rel = llego - t0f; if (lista.length === 1 && rel > 1500 && rel < 3800) formas.crudo.push(medir(lista[0].puntos)); } });
    const rec = mc.recibir.bind(mc); window.__msgs = {}; mc.recibir = (d, red) => { mc._red = mc.redes.indexOf(red); mc._ms = d.ms; const k = mc._red + ':' + d.tipo + (d.error ? ':' + String(d.error).slice(0, 120) : ''); window.__msgs[k] = (window.__msgs[k] || 0) + 1; rec(d, red); };
    await mc.iniciarRed({ dos: true });
    const t1 = performance.now(); while ((mc.redes?.length || 0) < 2 && performance.now() - t1 < 30000) await new Promise((ok) => setTimeout(ok, 100));
    await mc.prender();
    const t0 = t0f = performance.now();
    await new Promise((ok) => setTimeout(ok, 13500));
    const out = { carrera: mc.carrera ? { fin: !!mc.carrera.fin, gpu: mc.carrera.gpu, porque: mc.carrera.porque, lista: !!mc.carrera.red, t0: mc.carrera.t0, med: mc.carrera.red ? JSON.stringify(mc.carrera.red.med) : null, cpu: JSON.stringify(mc.carrera.cpu?.med), cupo: mc.carrera.red?.cupo } : null, guardado: localStorage.getItem('aeroplaza.manosGPU'), msgs: window.__msgs, directo: mc.directo, reloj: mc.reloj, offMin: mc.stats.offMin, datos: mc.datos(), redes: mc.redes.map((x) => ({ cupo: x.cupo, apagada: !!x.apagada, ms1: x.med?.['1:1']?.ms, ms2: x.med?.['2:1']?.ms, n1: x.med?.['1:1']?.n || 0, n2: x.med?.['2:1']?.n || 0 })), apagada: mc.stats.segundaApagada, leidos: mc.stats.leidos, t0 };
    mc.soltar(); window.__sigue = false;
    /* cuánto cambia la forma: de cada hueso, el desvío de su largo (%); de cada nudillo, el de su ángulo (°) */
    const desvio = (F, k, rel) => { const ns = F[0]?.[k].length || 0, r = []; for (let j = 0; j < ns; j++) { const xs = F.map((f) => f[k][j]), m = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); r.push(rel ? sd / m * 100 : sd); } return r.reduce((a, b) => a + b, 0) / Math.max(1, r.length); };
    out.forma = { crudo: { huesos: desvio(formas.crudo, 'l', true), angulos: desvio(formas.crudo, 'a', false), n: formas.crudo.length }, dibujo: { huesos: desvio(formas.dibujo, 'l', true), angulos: desvio(formas.dibujo, 'a', false), n: formas.dibujo.length } };
    out.ev = ev.map((e) => ({ ...e, rel: e.llego - t0 }));
    return out;
  }, cfg);
  await ctx.close();
  return { ...r, errores };
};
const antes = await correr({ sinLector: true, siempreDos: true, gpu: 'no' }), ahora = await correr({ gpu: 'no' });
/* la carrera de la GPU (acá la placa es por software: tiene que perder, y la mano seguir) */
const carrera = await correr({});
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
const resumen = (r) => {
  const conMano = r.ev.filter((e) => e.n > 0 && e.rel > 500);
  /* (el atraso, en los tramos de una mano: con dos, las dos redes buscan dos, igual que antes) */
  const unaSola = r.ev.filter((e) => e.n === 1 && ((e.rel > 800 && e.rel < 3800) || (e.rel > 8600 && e.rel < 10800)));
  const lat = med(unaSola.map((e) => e.llego - e.t)), porSeg = r.ev.filter((e) => e.rel > 500).length / 13;
  /* por tramo del video (el video arranca cuando se abre la cámara: un poco antes de t0) */
  const tramo = (a, b) => r.ev.filter((e) => e.rel > a * 1000 && e.rel < b * 1000);
  const dos = tramo(4.6, 7.8), una = tramo(0.8, 3.8), ninguna = tramo(11.8, 13);
  return { lat, porSeg, conMano: conMano.length, dos: dos.filter((e) => e.n === 2).length / Math.max(1, dos.length), una: una.filter((e) => e.n === 1).length / Math.max(1, una.length), cupo1: una.filter((e) => e.cupo === 1).length / Math.max(1, una.length), ninguna: ninguna.filter((e) => e.n > 0).length, primeraDos: (dos.find((e) => e.n === 2)?.rel ?? NaN) - 4000 };
};
const A = resumen(antes), B = resumen(ahora);
if (process.env.DETALLE) for (const [n, r] of [['antes', antes], ['ahora', ahora]]) {
  const g = {}; for (const e of r.ev.filter((e) => e.n > 0 && e.rel > 500)) { const k = `red${e.red} cupo${e.cupo}`; (g[k] ||= []).push(e.llego - e.t); }
  console.log(n, Object.entries(g).map(([k, a]) => `${k}: ${a.length} fotos, mediana ${med(a).toFixed(0)} ms`).join(' · '));
}
const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '—');
console.log(`antes: ${f(A.lat)} ms de la foto a la mano (con una mano) · ${f(A.porSeg, 1)} fotos/s · ${antes.datos}`);
console.log(`ahora: ${f(B.lat)} ms de la foto a la mano (con una mano) · ${f(B.porSeg, 1)} fotos/s · ${ahora.datos}`);
prueba('las fotos van directo de la cámara al worker (sin el hilo del juego) y el reloj queda calibrado', ahora.directo && Number.isFinite(ahora.reloj) && Math.abs(ahora.reloj - ahora.offMin) < 10, `reloj ${f(ahora.reloj, 1)} · por la llegada ${f(ahora.offMin, 1)} ms`);
prueba('con una mano a la vista, la red busca una sola (la mayoría de las fotos)', B.cupo1 > 0.5 && B.una > 0.8, `${f(B.cupo1 * 100)} % de las fotos con una mano buscando una · la mano está en el ${f(B.una * 100)} %`);
prueba('una red buscando una mano tarda mucho menos que buscando dos (con una mano a la vista)', ahora.redes[0].ms1 < ahora.redes[0].ms2 * 0.75, ahora.redes.map((x) => `${f(x.ms1)} / ${f(x.ms2)} ms (${x.n1}/${x.n2} fotos)`).join(' · '));
prueba('las dos redes siguen andando (la segunda no se apaga sin razón)', !ahora.redes[1]?.apagada && !antes.redes[1]?.apagada, `antes ${antes.apagada || 'no'} · ahora ${ahora.apagada || 'no'}`);
prueba('cuando aparece la segunda mano se ve enseguida, y las dos se siguen', B.dos > 0.6 && B.primeraDos < 1500, `las dos en el ${f(B.dos * 100)} % de las fotos del tramo; la segunda a los ${f(B.primeraDos)} ms (antes ${f(A.dos * 100)} %)`);
prueba('sin manos a la vista no queda ninguna', B.ninguna === 0, `${B.ninguna} fotos con mano en el tramo vacío`);
prueba('con una mano, de la foto a la mano tarda mucho menos que antes', B.lat < A.lat * 0.8, `${f(A.lat)} → ${f(B.lat)} ms`);
const C = resumen(carrera);
if (process.env.DETALLE) console.log('carrera', JSON.stringify(carrera.carrera).slice(0, 300), 'msgs', JSON.stringify(carrera.msgs), carrera.errores.slice(0, 3));
prueba('la carrera de la GPU se corre y la pierde (acá la placa es por software); la mano sigue y queda guardado', carrera.carrera?.fin && carrera.carrera.gpu === false && !!carrera.guardado && C.una > 0.8, `${carrera.carrera?.porque} · la mano en el ${f(C.una * 100)} % de las fotos del tramo · ${carrera.datos}`);
const Fo = ahora.forma;
console.log(`forma (MediaPipe de verdad, la mano es una foto que se mueve): lo que llega, huesos ${f(Fo.crudo.huesos, 1)} % y nudillos ${f(Fo.crudo.angulos, 1)}° (${Fo.crudo.n} fotos) · lo dibujado, ${f(Fo.dibujo.huesos, 1)} % y ${f(Fo.dibujo.angulos, 1)}° (${Fo.dibujo.n} cuadros)`);
prueba('la mano dibujada cambia de forma mucho menos que lo que da MediaPipe (huesos y nudillos)', Fo.dibujo.n > 30 && Fo.dibujo.huesos < Fo.crudo.huesos * 0.5 && Fo.dibujo.angulos < Fo.crudo.angulos * 0.7, `huesos ${f(Fo.crudo.huesos, 1)} → ${f(Fo.dibujo.huesos, 1)} % · nudillos ${f(Fo.crudo.angulos, 1)} → ${f(Fo.dibujo.angulos, 1)}°`);
prueba('sin errores', ![...antes.errores, ...ahora.errores, ...carrera.errores].some((e) => !/ERR_FAILED|INFO: Created TensorFlow/.test(e)), [...antes.errores, ...ahora.errores, ...carrera.errores].filter((e) => !/ERR_FAILED|INFO: Created/.test(e)).slice(0, 2).join(' | '));
await nav.close();
console.log(`${bien} bien, ${mal} mal`);
