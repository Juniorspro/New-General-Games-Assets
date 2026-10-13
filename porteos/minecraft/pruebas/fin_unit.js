const fs = require('fs'), vm = require('vm');
const dir = '/home/user/New-General-Games-Assets/porteos/minecraft/juego/';
for (const f of ['comun.js', 'fin.js']) vm.runInThisContext(fs.readFileSync(dir + f, 'utf8') + (f === 'fin.js' ? '\nglobalThis.C = C; globalThis.GenFin = GenFin;' : ''), { filename: f });
const g = new GenFin(12345);
console.log('pilares: ' + JSON.stringify(g.pilares));
console.log('podio en y ' + g.podio());
const ids = new Uint8Array(16 * 16 * 128), meta = new Uint8Array(ids.length), bio = new Uint8Array(256);
let t0 = Date.now(), cuenta = {};
for (let cx = -7; cx <= 6; cx++) for (let cz = -7; cz <= 6; cz++) { g.trozo(cx, cz, ids, meta, bio); for (let i = 0; i < ids.length; i++) cuenta[ids[i]] = (cuenta[ids[i]] || 0) + 1; }
console.log('196 trozos en ' + (Date.now() - t0) + ' ms: ' + JSON.stringify(cuenta));
// corte en z = 0, x de -112 a 111, alturas 0..127 cada 2
const N = { 0: ' ', 121: '.', 49: '#', 7: 'B', 101: '|', 50: 'i' };
const cols = {};
for (let cx = -7; cx <= 6; cx++) { g.trozo(cx, 0, ids, meta, bio); cols[cx] = ids.slice(); }
for (let y = 110; y >= 10; y -= 3) {
  let fila = '';
  for (let x = -112; x < 112; x += 2) { const c = cols[x >> 4]; fila += N[c[(y << 8) | (0 << 4) | (x & 15)]] || '?'; }
  console.log(String(y).padStart(3) + ' ' + fila);
}
// las islas de afuera: una muestra a 1200 bloques
t0 = Date.now(); let piedra = 0, coro = 0;
for (let cx = 75; cx < 85; cx++) for (let cz = -5; cz < 5; cz++) { g.trozo(cx, cz, ids, meta, bio); for (let i = 0; i < ids.length; i++) { if (ids[i] === 121) piedra++; if (ids[i] === 240 || ids[i] === 200) coro++; } }
console.log('afuera (100 trozos a 1200 bloques) en ' + (Date.now() - t0) + ' ms: piedra ' + piedra + ', coro ' + coro);
