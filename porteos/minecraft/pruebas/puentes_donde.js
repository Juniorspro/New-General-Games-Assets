const fs = require('fs'), vm = require('vm');
const dir = '/home/user/New-General-Games-Assets/porteos/minecraft/juego/';
for (const f of ['comun.js', 'nether.js']) vm.runInThisContext(fs.readFileSync(dir + f, 'utf8') + (f === 'nether.js' ? '\nglobalThis.C = C; globalThis.GenNether = GenNether;' : ''), { filename: f });
const g = new GenNether(+process.argv[2]);
const l = [];
for (let rx = -2; rx <= 1; rx++) for (let rz = -2; rz <= 1; rz++) { const f = g.fortaleza(rx, rz); if (!f) continue; f.piezas.forEach((p) => { if (p.t === 'cruce' || p.t === 'puente' || p.t === 'entrada' || p.t === 'verrugas') l.push({ t: p.t, b: p.b, f: p.f, d: Math.hypot(p.b[0], p.b[2]) }); }); }
l.sort((a, b) => a.d - b.d);
const tipos = {}; const r = [];
for (const p of l) { if ((tipos[p.t] || 0) < 2) { tipos[p.t] = (tipos[p.t] || 0) + 1; r.push(p); } }
console.log(JSON.stringify(r));
