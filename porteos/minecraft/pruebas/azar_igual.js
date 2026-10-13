// el azar nuevo da exactamente lo mismo que el de antes
function Viejo(s) { this.s = s >>> 0; }
Viejo.prototype.sig = function () { var t = (this.s = (this.s + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fs = require('fs');
eval(fs.readFileSync('/home/user/New-General-Games-Assets/porteos/minecraft/juego/comun.js', 'utf8') + '\nglobal.C = C;');
let dif = 0;
for (const sem of [0, 1, -1, 12345, 0x7fffffff, 0x80000000, 0xffffffff, -123456789, 4294967296 + 7]) {
  const a = new Viejo(sem), b = new C.Azar(sem);
  for (let i = 0; i < 100000; i++) if (a.sig() !== b.sig()) dif++;
}
console.log('diferencias: ' + dif);
let t = Date.now(); const az = new C.Azar(9); let s = 0; for (let k = 0; k < 6553600; k++) s += az.ent(5); console.log('6,5 M azar: ' + (Date.now() - t) + ' ms');
