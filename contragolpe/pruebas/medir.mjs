// Qué cuesta un cuadro de CONTRAGOLPE (en una partida de verdad: 5 contra 5, el jugador con piloto
// automático), con la calidad que se pida:
// - la carga (hasta que el juego está listo);
// - la lógica: ms por paso de 1/60 (bots, física, animación) y quién se los lleva (perfil de CPU);
// - el dibujo: ms por cuadro y por pasada (la escena, la sombra, el arma, el revelado), llamadas,
//   triángulos, programas;
// - la memoria: las texturas en la placa (lo que ocupan de verdad, con sus mips) y el heap de JS.
// Con SwiftShader los ms no son los de un teléfono: sirve la proporción entre partes y entre versiones.
//     node pruebas/medir.mjs [calidad=1] [archivo=contragolpe.html | apk=1] [ancho=800] [alto=360] [perfil=1] [flojo=6]
import fs from 'node:fs';
import path from 'node:path';
import { navegador, abrir, servirApk, SAL, RAIZ } from './comun.mjs';

const A = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const calidad = +(A.calidad || 1), archivo = A.archivo ? path.resolve(A.archivo) : path.join(RAIZ, 'contragolpe.html');
const nav = await navegador();
const t0 = Date.now();
const srv = A.apk ? await servirApk() : null;
const { ctx, pag, errores } = await abrir(nav, 'partida=bomba&bando=ct&sem=7', { archivo, url: srv && srv.url, ancho: +(A.ancho || 800), alto: +(A.alto || 360) });
await pag.waitForFunction(() => ASSET.pend <= ASSET.ok + ASSET.fallas.length, null, { timeout: 60000, polling: 200 }).catch(() => {});
const carga = Date.now() - t0;
/* el primer cuadro: ahí se compilan los programas que no se compilaron en la carga */
const primerCuadro = await pag.evaluate(() => { const gl = ren.getContext(), px = new Uint8Array(4), t = performance.now(); dibujar(); ren.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Math.round(performance.now() - t); });
const cdp = await ctx.newCDPSession(pag);

/* calidad fija, piloto automático, y hasta que termine el tiempo congelado y haya tiros */
await pag.evaluate((c) => { G.graficos = 'fija'; CALIDAD = c; medir(); window.__C.autopiloto(true); }, calidad);
await pag.evaluate(() => window.__C.anda(60 * 16));
await pag.evaluate(() => window.__cuadros(8));

/* la lógica: 240 pasos sin dibujar */
const logica = await pag.evaluate(() => { const t = performance.now(); window.__C.anda(240); return (performance.now() - t) / 240; });
let perfil = null;
if (A.perfil !== '0') {
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await pag.evaluate(() => window.__C.anda(240));
  const { profile } = await cdp.send('Profiler.stop');
  /* tiempo propio por función (las más caras) */
  const porId = new Map(profile.nodes.map((n) => [n.id, n])), propio = new Map();
  const dt = profile.timeDeltas; let tot = 0;
  profile.samples.forEach((id, i) => { const n = porId.get(id), f = n.callFrame, k = `${f.functionName || '(anónima)'}:${f.lineNumber + 1}`; const d = dt[i] || 0; tot += d; propio.set(k, (propio.get(k) || 0) + d); });
  perfil = [...propio].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / tot * 100).toFixed(1)}% ${k}`);
}

/* el dibujo, por pasada, desde varios lugares del mapa (cada aparición mirando al centro): cada
   ren.render con la placa esperada antes y después (leer un píxel de la pantalla espera todo lo anterior:
   gl.finish no espera a SwiftShader) */
const dibujo = await pag.evaluate(() => {
  const gl = ren.getContext(), orig = ren.render.bind(ren), por = {}, px = new Uint8Array(4);
  const espera = () => { const rt = ren.getRenderTarget(); ren.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ren.setRenderTarget(rt); };
  const nombre = (esc) => esc === escena ? 'escena' : esc === escVM ? 'arma' : esc === QESC ? 'pasada:' + (QUAD.material === MAT_FINAL ? 'final' : QUAD.material === MAT_BAJA ? 'baja' : QUAD.material === MAT_SUBE ? 'sube' : QUAD.material === MAT_ADAPTA ? 'adapta' : 'otra') : 'otra';
  ren.render = (esc, c) => { espera(); const t = performance.now(); orig(esc, c); espera(); const k = nombre(esc); por[k] = (por[k] || 0) + performance.now() - t; };
  const O = window.__C.OBRA(), sp = [...(O.spawns.ct || []).slice(0, 2), ...(O.spawns.t || []).slice(0, 2), ...(O.spawns.dm || []).slice(0, 4)];
  let cx = 0, cz = 0; for (const s of sp) { cx += s.x; cz += s.z; } cx /= sp.length; cz /= sp.length;
  const vistas = sp.map((s) => [s.x, s.y + 1.63, s.z, Math.atan2(-(cx - s.x), -(cz - s.z))]);
  ren.info.autoReset = false;
  /* (SwiftShader varía ±15 % de una vez a otra: de cada vista, lo menos de tres veces) */
  let total = 0, calls = 0, tris = 0, sombra = 0; const K = 3;
  const cronometrar = () => { const p = {}; ren.render = (esc, c) => { espera(); const t = performance.now(); orig(esc, c); espera(); const k = nombre(esc); p[k] = (p[k] || 0) + performance.now() - t; }; dibujar(); ren.render = orig; return p; };
  for (const [x, y, z, yaw] of vistas) {
    cam.position.set(x, y, z); cam.rotation.set(-0.05, yaw, 0, 'YXZ'); cam.updateMatrixWorld();
    ren.render = orig; dibujar(); espera();
    let mejor = 1e9; for (let k = 0; k < K; k++) { ren.info.reset(); const t = performance.now(); dibujar(); espera(); mejor = Math.min(mejor, performance.now() - t); }
    total += mejor; calls += ren.info.render.calls; tris += ren.info.render.triangles;
    const ps = []; for (let k = 0; k < K; k++) ps.push(cronometrar());
    for (const k in ps[0]) por[k] = (por[k] || 0) + Math.min(...ps.map((p) => p[k] || 0));
    /* la sombra: la escena con y sin actualizar el mapa de sombra */
    ren.setRenderTarget(POST.rt || null); let con = 1e9, sin = 1e9;
    for (let k = 0; k < K; k++) { espera(); let t = performance.now(); orig(escena, cam); espera(); con = Math.min(con, performance.now() - t);
      ren.shadowMap.autoUpdate = false; t = performance.now(); orig(escena, cam); espera(); sin = Math.min(sin, performance.now() - t); ren.shadowMap.autoUpdate = true; }
    sombra += con - sin;
  }
  ren.render = orig; ren.info.autoReset = true; ren.setRenderTarget(null);
  const N = vistas.length;
  for (const k in por) por[k] = +(por[k] / N).toFixed(1);
  const s = ren.getDrawingBufferSize(new THREE.Vector2());
  return { vistas: N, msCuadro: +(total / N).toFixed(1), porPasada: por, sombra: +(sombra / N).toFixed(1), llamadas: Math.round(calls / N), triangulos: Math.round(tris / N),
    programas: ren.info.programs.length, px: `${s.x}×${s.y}`, calidad: CALIDAD, post: POST.ok, bloom: CALIDAD >= 0.5 ? (CALIDAD >= 0.8 ? 5 : 4) : 0 };
});

/* la memoria de la placa: cada textura subida, con lo que ocupa */
const memoria = await pag.evaluate(() => {
  const vistas = new Set(); let bytes = 0, n = 0; const porTipo = {};
  const mira = (t, tipo) => { if (!t || vistas.has(t)) return; vistas.add(t); const p = ren.properties.get(t); if (!p || !p.__webglTexture) return; const im = t.image; if (!im) return;
    const w = im.width || 0, h = im.height || 0, mips = t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter && (t.generateMipmaps || t.isCompressedTexture);
    let b = w * h * (t.isCompressedTexture ? 0.5 : 4); if (t.type === THREE.HalfFloatType) b *= 2; if (mips) b *= 4 / 3;
    bytes += b; n++; porTipo[tipo] = (porTipo[tipo] || 0) + b; };
  escena.traverse((o) => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'lightMap', 'envMap']) mira(m[k], k); if (o.material && o.material.uniforms) for (const k in o.material.uniforms) { const v = o.material.uniforms[k].value; if (v && v.isTexture) mira(v, 'u:' + k); } });
  escVM.traverse((o) => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'envMap']) mira(m[k], 'vm:' + k); });
  for (const k in TEXS) mira(TEXS[k], 'TEXS');
  const mb = (x) => +(x / 1048576).toFixed(1);
  for (const k in porTipo) porTipo[k] = mb(porTipo[k]);
  if (window.gc) { window.gc(); window.gc(); }
  return { texturasMB: mb(bytes), texturas: n, porTipo, texGPU: ren.info.memory.textures, geometrias: ren.info.memory.geometries, heapMB: performance.memory ? mb(performance.memory.usedJSHeapSize) : null, TEX_MAX };
});


/* EL PROCESADOR DE UN CELU FLOJO: el hilo del juego 6 veces más lento (lo que usa Chrome para "gama
   baja"). Un cuadro entero sin esperar a la placa: la lógica de un paso y lo que three tarda en mandar
   el dibujo */
let flojo = null;
if (A.flojo !== '0') {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(A.flojo || 6) });
  flojo = await pag.evaluate(() => {
    const px = new Uint8Array(4), gl = ren.getContext();
    const espera = () => { ren.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    let tp = 0, td = 0, th = 0; const N = 30;
    for (let i = 0; i < N; i++) {
      espera();
      let t = performance.now(); pasar(); tp += performance.now() - t;
      t = performance.now(); dibujar(); td += performance.now() - t;
    }
    return { pasoMs: +(tp / N).toFixed(2), mandarDibujoMs: +(td / N).toFixed(2) };
  });
  if (A.perfil !== '0') {
    await cdp.send('Profiler.start');
    await pag.evaluate(() => { for (let i = 0; i < 30; i++) { pasar(); dibujar(); } });
    const { profile } = await cdp.send('Profiler.stop');
    const porId = new Map(profile.nodes.map((n) => [n.id, n])), propio = new Map(); let tot = 0;
    profile.samples.forEach((id, i) => { const f = porId.get(id).callFrame, k = `${f.functionName || '(anónima)'}:${f.lineNumber + 1}`, d = profile.timeDeltas[i] || 0; tot += d; propio.set(k, (propio.get(k) || 0) + d); });
    flojo.perfil = [...propio].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${(v / tot * 100).toFixed(1)}% ${k}`);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}

/* una foto del cuadro (desde la primera aparición de los CT, mirando al centro) */
await pag.evaluate(() => { const O = window.__C.OBRA(), s = O.spawns.ct[0]; cam.position.set(s.x, s.y + 1.63, s.z); cam.rotation.set(-0.05, s.yaw || 0, 0, 'YXZ'); cam.updateMatrixWorld(); dibujar(); });
const foto = path.join(SAL, `medir-${path.basename(archivo, '.html')}-${calidad}.png`);
await pag.screenshot({ path: foto });
const partida = await pag.evaluate(() => { const p = window.__C.partida(); return { fase: p.fase, ronda: p.ronda, vivos: p.actores.filter((a) => a.vivo).length }; });
console.log(JSON.stringify({ archivo: srv ? 'apk' : path.basename(archivo), cargaMs: carga, primerCuadroMs: primerCuadro, logicaMsPorPaso: +logica.toFixed(2), dibujo, memoria, partida, perfil, flojo, errores: errores.slice(0, 5), foto }, null, 1));
await ctx.close(); await nav.close(); if (srv) srv.cerrar();
