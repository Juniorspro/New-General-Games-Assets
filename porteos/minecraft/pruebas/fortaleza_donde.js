// dónde hay un puente de fortaleza cerca del origen para una semilla (número)
const fs = require('fs'), vm = require('vm');
const dir = '/home/user/New-General-Games-Assets/porteos/minecraft/juego/';
for (const f of ['comun.js', 'nether.js']) vm.runInThisContext(fs.readFileSync(dir + f, 'utf8') + (f === 'nether.js' ? '\nglobalThis.C = C; globalThis.GenNether = GenNether;' : ''), { filename: f });
const g = new GenNether(+process.argv[2]);
let mejor = null;
for (let rx = -2; rx <= 1; rx++) for (let rz = -2; rz <= 1; rz++) {
  const f = g.fortaleza(rx, rz); if (!f) continue;
  for (const p of f.piezas) {
    if (p.t !== 'trono' && p.t !== 'puente') continue;
    const cx = (p.b[0] + p.b[3]) / 2, cz = (p.b[2] + p.b[5]) / 2, d = Math.hypot(cx, cz);
    if (!mejor || (p.t === 'trono' && mejor.t !== 'trono') || (p.t === mejor.t && d < mejor.d)) mejor = { t: p.t, b: p.b, d, f: p.f };
  }
}
console.log(JSON.stringify(mejor));
