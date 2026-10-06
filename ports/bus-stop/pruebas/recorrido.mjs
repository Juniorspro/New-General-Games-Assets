// Recorrido del juego entero sin manos: caminar, juntar una malla, una tele, un bicho que ataca,
// el colectivo que llega y el final. Fotos chicas en salida/.     node recorrido.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
(await import('node:fs')).mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
const PUERTO = 18000 + Math.floor(Math.random() * 2000);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, '../dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => { if (m.text().startsWith('dbg')) console.log(m.text()); });
let mal = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  MAL ') + m); if (!c) mal++; };
await p.goto(`http://127.0.0.1:${PUERTO}/index.html`);
await p.evaluate(() => localStorage.setItem('busstop.v1', JSON.stringify({ idioma: 'es' })));
await p.reload();
await p.waitForFunction(() => window.__bus?.listo, null, { timeout: 120000 });
await p.click('[data-b="jugar"]');
await p.waitForFunction(() => __bus.modo === 'jugando');
await p.waitForTimeout(1500);
const foto = (n) => p.screenshot({ path: path.join(AQUI, 'salida', n + '.jpg'), type: 'jpeg', quality: 55 });
// ayudas dentro de la página
await p.evaluate(() => {
  const J = __bus.juego;
  __bus.congelar = true;
  if (!J._ray) J.mirar(false);
  for (const m of J.mallas) m.fase = NaN;
  window.paso = (seg, inp = {}) => { const n = Math.round(seg * 30); for (let i = 0; i < n; i++) J.update(1 / 30, { x: 0, y: 0, mx: 0, my: 0, correr: false, saltar: false, usar: false, linterna: false, ...inp }, { sens: 1, invertir: false }); };
  window.apuntar = (T) => { const P = J.pos.clone(); P.y += 1.8; const d = T.clone().sub(P); J.yaw = Math.atan2(-d.x, -d.z); J.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); J.ubicarCamara(); };
  window.centro = (obj) => { const c = new obj.position.constructor(); let m = null; obj.traverse((o) => { if (!m && o.isMesh) m = o; }); if (m) { m.geometry.computeBoundingSphere(); return c.copy(m.geometry.boundingSphere.center).applyMatrix4(m.matrixWorld); } return obj.getWorldPosition(c); };
  window.alLado = (m) => { // un punto de la malla que se vea de frente desde 1,2 m (probando vértices)
    const P = m.geometry.attributes.position, c = centro(m), v = c.clone(); window.__R = J._ray.constructor;
    const ray = new window.__R(); ray.far = 2.4;
    for (let i = 0; i < P.count; i += 3) {
      v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
      const d = v.clone().sub(c); d.y = 0; if (d.length() < 0.01) continue; d.setLength(1.2);
      J.pos.set(v.x + d.x, 0, v.z + d.z); J.pos.y = __bus.S.alturaEn(J.pos.x, J.pos.z);
      const ojo = J.pos.clone(); ojo.y += 1.8;
      ray.set(ojo, v.clone().sub(ojo).normalize());
      const h = ray.intersectObject(m, false)[0];
      if (h && h.face && Math.abs(h.face.normal.clone().transformDirection(m.matrixWorld).dot(ray.ray.direction)) > 0.35) { J.est.vy = 0; apuntar(h.point); return h.point.clone(); }
    }
    return c; };
  window.cerca = (obj, dist) => { const c = centro(obj); const d = c.clone().sub(J.pos); d.y = 0; d.setLength(Math.max(0, d.length() - dist)); J.pos.add(d); J.pos.y = __bus.S.alturaEn(J.pos.x, J.pos.z); J.est.vy = 0; return c; };
});
// 1. caminar 2 s para adelante
const r1 = await p.evaluate(() => { const J = __bus.juego, a = J.pos.clone(); paso(2, { y: 1 }); return { d: +a.distanceTo(J.pos).toFixed(2), y: +J.pos.y.toFixed(2), suelo: J.est.suelo }; });
ok(r1.d > 6 && r1.d < 8.5, `camina 2 s: ${r1.d} m (4 m/s), y=${r1.y}, en el piso: ${r1.suelo}`);
const r1b = await p.evaluate(() => { const J = __bus.juego, a = J.pos.clone(); paso(1, { y: 1, correr: true }); return +a.distanceTo(J.pos).toFixed(2); });
ok(r1b > 4.5 && r1b < 6.5, `corre 1 s: ${r1b} m (6 m/s)`);
const r1c = await p.evaluate(() => { const J = __bus.juego; paso(0.2); const y0 = J.pos.y; let mx = 0; paso(0.03, { saltar: true }); for (let i = 0; i < 30; i++) { paso(1 / 30); mx = Math.max(mx, J.pos.y - y0); } return +mx.toFixed(2); });
ok(r1c > 0.6 && r1c < 1, `salta ${r1c} m`);
// 2. una malla glitcheada: mirarla de cerca, se pone roja, E la junta
const r2 = await p.evaluate(() => { const J = __bus.juego, m = J.mallas[0]; for (const b of J.bichos) b.raiz.position.y -= 1000; const s = alLado(m.m); window._s = s; paso(1 / 30); apuntar(s); const R = new (s.constructor === Object ? Object : window.__bus.escena.constructor)(); const ray = J._ray; ray.far = 100; const h = ray.intersectObject(m.m, false)[0]; const cam = J.camara.position; return { mirando: J.mirando, rojo: m.mats[0].color.getHexString(), hit: h && +h.distance.toFixed(2), dc: +cam.distanceTo(s).toFixed(2), rad: +(m.m.geometry.boundingSphere.radius * m.m.matrixWorld.getMaxScaleOnAxis()).toFixed(2), s: s.toArray().map(x=>+x.toFixed(1)), pos: J.pos.toArray().map(x=>+x.toFixed(1)), nombre: m.obj.name }; });
console.log(JSON.stringify(r2));
ok(r2.mirando === 'malla' && r2.rojo === 'ff0000', `la malla se mira y se pone roja (${r2.mirando}, #${r2.rojo})`);
await foto('r-malla');
const r2b = await p.evaluate(() => { const J = __bus.juego; const a = J.pos.toArray().map(x=>+x.toFixed(2)); apuntar(window._s); paso(1 / 30); const mi = J.mirando; const ray = J._ray; ray.far = 100; const hs = ray.intersectObjects(J.mallas.map((x) => x.m), false).slice(0, 2).map((h) => [J.mallas.findIndex((x) => x.m === h.object), +h.distance.toFixed(2)]); ray.far = 2.6; paso(1 / 30, { usar: true }); const cw = J.camara.getWorldPosition(window._s.clone()); const fw = J.camara.getWorldDirection(window._s.clone()); const dd = window._s.clone().sub(cw).normalize(); const m0 = J.mallas[0]; console.log('dbg', JSON.stringify({ cw: cw.toArray().map(x=>+x.toFixed(2)), dot: +fw.dot(dd).toFixed(4), s: window._s.toArray().map(x=>+x.toFixed(2)), vis: m0.obj.visible, mw: m0.m.matrixWorld.elements.slice(12, 15).map(x=>+x.toFixed(2)), hs, vivos: J.mallas.map((x) => +x.vivo).join(''), a, mi, est: J.estado, m: J.muertes, pos: J.pos.toArray().map(x=>+x.toFixed(2)), modo: __bus.modo })); for (const b of J.bichos) b.raiz.position.y += 1000; return { n: J.juntadas, txt: document.querySelector('#contador').textContent }; });
ok(r2b.n === 1, `con E se junta: ${r2b.n} (${r2b.txt})`);
// 3. una tele
await p.evaluate(() => { const S = __bus.S, J = __bus.juego; const tv = S.teles.find((t) => t.num === 4); const c = new tv.plano.position.constructor(); tv.plano.getWorldPosition(c); const n = new c.constructor(0, 0, 1).applyQuaternion(tv.plano.getWorldQuaternion(new tv.plano.quaternion.constructor())); J.pos.copy(c).addScaledVector(n, 1.6); J.pos.y = S.alturaEn(J.pos.x, J.pos.z); paso(1 / 30); apuntar(c); });
await p.waitForTimeout(500); await foto('r-tele');
// 4. un bicho: acercarse hasta que ataca y mata
const r4 = await p.evaluate(() => { const J = __bus.juego, B = J.bichos[0]; cerca(B.raiz, 14); apuntar(B.raiz.position.clone().setY(B.raiz.position.y + 2)); paso(0.5); const antes = B.atacando; let t = 0; while (!B.atacando && t < 5) { paso(0.1, { y: 1 }); t += 0.1; } const d0 = +B.raiz.position.distanceTo(J.pos).toFixed(1); const ds = []; for (let i = 0; i < 5; i++) { paso(0.1); ds.push(+B.raiz.position.distanceTo(J.pos).toFixed(1)); } return { antes, ataca: B.atacando, d: d0, ds, trig: !!B.trig, caja: B.trig && (() => { B.raiz.updateMatrixWorld(true); const bb = B.trig.geometry.boundingBox.clone().applyMatrix4(B.trig.matrixWorld); return [bb.min.toArray().map(x=>+x.toFixed(1)), bb.max.toArray().map(x=>+x.toFixed(1))]; })(), pos: J.pos.toArray().map(x=>+x.toFixed(1)) }; });
console.log(JSON.stringify(r4));
ok(!r4.antes && r4.ataca, `el bicho ataca al acercarse (a ${r4.d} m)`);
await p.waitForTimeout(300); await foto('r-bicho');
const r4b = await p.evaluate(() => { const J = __bus.juego, B = J.bichos[0]; let t = 0; while (B.vivo && t < 4) { paso(0.05); t += 0.05; } return { vivo: B.vivo, muertes: J.muertes, enInicio: J.pos.distanceTo(J.inicio) < 0.5, t: +t.toFixed(2) }; });
ok(!r4b.vivo && r4b.muertes === 1 && r4b.enInicio, `te alcanza en ${r4b.t} s: morís, volvés al principio y el bicho se borra`);
// 5. las 10: llega el colectivo
const r5 = await p.evaluate(() => { const J = __bus.juego; J.juntadas = 9; const m = J.mallas[1]; const s = alLado(m.m); paso(1 / 30); apuntar(s); paso(1 / 30); paso(1 / 30, { usar: true }); const e1 = J.busEstado; paso(31); return { e1, e2: J.busEstado, bus: J.bus.position.toArray().map((x) => +x.toFixed(1)) }; });
ok(r5.e1 === 'viniendo' && r5.e2 === 'parado', `con 10 llega el colectivo: ${r5.e1} → ${r5.e2} en ${r5.bus}`);
await p.evaluate(() => { const J = __bus.juego; J.pos.set(30, __bus.S.alturaEn(30, 9), 9); apuntar(J.bus.position.clone().setY(2)); paso(1 / 30); });
await p.waitForTimeout(500); await foto('r-colectivo');
// 6. subirse: la cámara del final y el colectivo se va
const r6 = await p.evaluate(() => { const J = __bus.juego; const c = J.bus.position.clone(); J.pos.set(c.x, __bus.S.alturaEn(c.x, 1.5), 1.5); paso(1 / 30); apuntar(c.clone().setY(1.6).setZ(-1)); paso(1 / 30); const m = J.mirando; paso(1 / 30, { usar: true }); return { m, estado: J.estado }; });
ok(r6.m === 'bus' && r6.estado === 'final', `"Sentate y apretá E": ${r6.m} → ${r6.estado}`);
await p.evaluate(() => paso(4)); await p.waitForTimeout(1500); await foto('r-final1'); await p.evaluate(() => { paso(6); __bus.congelar = false; });
await p.waitForFunction(() => document.querySelector('#pantallas').classList.contains('p-final'), null, { timeout: 60000 }).catch(() => {});
ok(await p.isVisible('.fin'), 'aparece la pantalla del final');
await foto('r-final2');
ok(errores.length === 0, 'sin errores' + (errores.length ? ': ' + errores[0] : ''));
console.log(mal ? `${mal} cosas para arreglar` : 'Todo bien');
await b.close(); srv.kill();
