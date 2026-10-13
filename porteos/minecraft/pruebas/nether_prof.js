const fs = require('fs');
const dir = '/home/user/New-General-Games-Assets/porteos/minecraft/juego/';
const vm = require('vm'); for (const f of ['comun.js', 'nether.js']) vm.runInThisContext(fs.readFileSync(dir + f, 'utf8') + (f === 'nether.js' ? '\nglobalThis.C = C; globalThis.GenNether = GenNether;' : ''), { filename: f });
const g = new GenNether(777);
let t0 = Date.now();
for (let cx = 0; cx < 10; cx++) for (let cz = 0; cz < 10; cz++) { g.base.clear(); g.orden.length = 0; g.terreno(cx, cz); }
console.log('terreno: ' + ((Date.now() - t0) / 100).toFixed(1) + ' ms/trozo');
t0 = Date.now();
let n = 0; for (let i = 0; i < 100000; i++) n += g.densidad(i % 50, i % 17, (i / 50) | 0);
console.log('densidad: ' + ((Date.now() - t0) / 100000 * 425).toFixed(2) + ' ms por trozo (425 puntos)');
const ids = new Uint8Array(16 * 16 * 128), meta = new Uint8Array(ids.length), bio = new Uint8Array(256);
t0 = Date.now();
for (let cx = 0; cx < 10; cx++) for (let cz = 0; cz < 10; cz++) g.trozo(cx, cz, ids, meta, bio);
console.log('trozo completo (con caché de vecinos): ' + ((Date.now() - t0) / 100).toFixed(1) + ' ms/trozo');
// aire en la franja del medio y superficies en 60-65
let aire = 0, tot = 0, sup = 0, almas = 0, grava = 0;
for (let cx = 0; cx < 10; cx++) for (let cz = 0; cz < 10; cz++) {
  g.trozo(cx, cz, ids, meta, bio);
  for (let i = 0; i < ids.length; i++) { const y = i >> 8; if (y >= 40 && y < 100) { tot++; if (ids[i] === 0) aire++; } if (ids[i] === 88) almas++; if (ids[i] === 13) grava++; }
  for (let c = 0; c < 256; c++) for (let y = 60; y <= 65; y++) if (ids[(y << 8) | c] !== 0 && ids[((y + 1) << 8) | c] === 0) { sup++; break; }
}
console.log('aire en 40-100: ' + (aire / tot * 100).toFixed(1) + '% | columnas con superficie en 60-65: ' + (sup / 25600 * 100).toFixed(1) + '% | almas ' + almas + ' grava ' + grava);
{
  const ids2 = new Uint8Array(16 * 16 * 128);
  let t1 = Date.now();
  for (let i = 0; i < 100; i++) g.superficie(i, 0, ids2);
  console.log('superficie: ' + ((Date.now() - t1) / 100).toFixed(2) + ' ms/trozo');
  t1 = Date.now();
  for (let i = 0; i < 100; i++) { const az = new C.Azar(i); let s = 0; for (let k = 0; k < 65536; k++) s += az.ent(5); }
  console.log('65536 azar: ' + ((Date.now() - t1) / 100).toFixed(2) + ' ms');
  t1 = Date.now();
  for (let i = 0; i < 100; i++) for (let c = 0; c < 256; c++) g.rAlmas.oct2(c / 256, i / 256, 4, 0.5);
  console.log('256 oct2: ' + ((Date.now() - t1) / 100).toFixed(2) + ' ms');
}
