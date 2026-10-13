// las fortalezas: cuántas piezas, de qué tipo, cuánto tarda y un corte de la primera
const fs = require('fs'), vm = require('vm');
const dir = '/home/user/New-General-Games-Assets/porteos/minecraft/juego/';
for (const f of ['comun.js', 'nether.js']) vm.runInThisContext(fs.readFileSync(dir + f, 'utf8') + (f === 'nether.js' ? '\nglobalThis.C = C; globalThis.GenNether = GenNether;' : ''), { filename: f });
const g = new GenNether(12345);
let hechas = [];
let t0 = Date.now();
for (let rx = -3; rx <= 3; rx++) for (let rz = -3; rz <= 3; rz++) { const f = g.fortaleza(rx, rz); if (f) hechas.push([rx, rz, f]); }
console.log('49 regiones en ' + (Date.now() - t0) + ' ms: ' + hechas.length + ' fortalezas');
for (const [rx, rz, f] of hechas.slice(0, 4)) {
  const c = {}; f.piezas.forEach((p) => { c[p.t] = (c[p.t] || 0) + 1; });
  console.log('región ' + rx + ',' + rz + ': ' + f.piezas.length + ' piezas, caja ' + f.caja + ' | ' + JSON.stringify(c));
}
// dibujar los trozos de la primera fortaleza y medir
const f = hechas[0][2], ids = new Uint8Array(16 * 16 * 128), meta = new Uint8Array(ids.length), bio = new Uint8Array(256);
const cx0 = f.caja[0] >> 4, cx1 = f.caja[3] >> 4, cz0 = f.caja[2] >> 4, cz1 = f.caja[5] >> 4;
t0 = Date.now(); let n = 0, ladrillos = 0, extra = [];
for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) { const r = g.trozo(cx, cz, ids, meta, bio); n++; extra.push(...r.extra); for (let i = 0; i < ids.length; i++) if (ids[i] === 112) ladrillos++; }
console.log(n + ' trozos con la fortaleza en ' + (Date.now() - t0) + ' ms; ladrillos ' + ladrillos + '; cosas ' + JSON.stringify(extra.map((e) => e[3])));
