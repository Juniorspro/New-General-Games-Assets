const fs = require('fs'), vm = require('vm');
const dir = '/home/user/New-General-Games-Assets/porteos/minecraft/juego/';
for (const f of ['comun.js', 'fin.js']) vm.runInThisContext(fs.readFileSync(dir + f, 'utf8') + (f === 'fin.js' ? '\nglobalThis.C = C; globalThis.GenFin = GenFin;' : ''), { filename: f });
for (const sem of [12345, 777, 31337]) {
  const g = new GenFin(sem);
  // por anillo de radio: qué parte de las columnas tiene piedra
  const an = {};
  for (let x = -128; x < 128; x += 2) for (let z = -128; z < 128; z += 2) { const r = Math.round(Math.hypot(x, z) / 16) * 16; an[r] = an[r] || [0, 0]; an[r][1]++; if (g.tope(x, z) > 0) an[r][0]++; }
  let alt = []; for (const r of [0, 20, 40, 60, 80]) alt.push(r + ':' + g.tope(r, 0));
  console.log(sem + ' | ' + Object.keys(an).sort((a, b) => a - b).map((r) => r + ':' + Math.round(an[r][0] / an[r][1] * 100) + '%').join(' ') + ' | tope ' + alt.join(' '));
}
