// prueba del generador del Nether en node: tiempos, proporciones y que los bordes coincidan
const fs = require('fs');
const dir = '/home/user/New-General-Games-Assets/porteos/minecraft/juego/';
global.self = global;
const vm = require('vm'); for (const f of ['comun.js', 'nether.js']) vm.runInThisContext(fs.readFileSync(dir + f, 'utf8') + (f === 'nether.js' ? '\nglobalThis.C = C; globalThis.GenNether = GenNether;' : ''), { filename: f });
const g = new GenNether(12345);
const ids = new Uint8Array(16 * 16 * 128), meta = new Uint8Array(ids.length), bio = new Uint8Array(256);
let t0 = Date.now(), cuenta = {}, lavas = 0;
for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
  const l = g.trozo(cx, cz, ids, meta, bio); lavas += l.length / 3;
  for (let i = 0; i < ids.length; i++) cuenta[ids[i]] = (cuenta[ids[i]] || 0) + 1;
}
console.log('49 trozos en ' + (Date.now() - t0) + ' ms; cascadas ' + lavas);
const tot = 49 * ids.length;
console.log(Object.entries(cuenta).map(([k, v]) => k + ':' + (v / tot * 100).toFixed(2) + '%').join(' '));
// un corte vertical (x de 0 a 63, z = 8) en texto
const N = {0: ' ', 7: '#', 87: '.', 11: '~', 10: '~', 88: 's', 13: 'g', 89: 'O', 51: '^', 153: 'q', 213: 'm', 39: 'h', 40: 'h'};
const cols = [];
for (let cx = 0; cx < 4; cx++) { g.trozo(cx, 0, ids, meta, bio); cols.push(ids.slice()); }
for (let y = 127; y >= 0; y -= 2) {
  let fila = '';
  for (let x = 0; x < 64; x++) { const c = cols[x >> 4]; fila += N[c[(y << 8) | (8 << 4) | (x & 15)]] || '?'; }
  console.log(String(y).padStart(3) + ' ' + fila);
}
