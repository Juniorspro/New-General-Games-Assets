// Las pruebas sin navegador: el mundo, los choques, el turbo, la comida, la
// simulación larga con bots y los textos.
//   node vibora/pruebas/logica.mjs
import { Mundo } from '../js/mundo.js';
import { Vibora } from '../js/vibora.js';
import { PIELES } from '../js/pieles.js';
import { TABLA, IDIOMAS } from '../js/idioma.js';
import { CANCIONES } from '../js/sonido.js';
import { FONDOS } from '../js/fondos.js';
import { trozos } from '../js/util.js';

let fallas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { fallas++; console.log('  FALLA:', m); } };
const vacio = () => { const m = new Mundo({ semilla: 3, bots: 0, comida: 0 }); return m; };
const piel = PIELES[0];

console.log('choques');
{
  // A viene por la izquierda hacia el cuerpo de B, que está parado de arriba a abajo
  const m = vacio();
  const b = new Vibora({ id: 1, nombre: 'B', piel, x: 0, y: -150, ang: Math.PI / 2, masa: 200 });
  for (let k = 0; k < 60; k++) b.pasar(1 / 60);          // que el cuerpo quede derecho
  b.x = 0; b.y = 60;
  const a = new Vibora({ id: 2, nombre: 'A', piel, x: -200, y: 0, ang: 0, masa: 20 });
  m.viboras.push(b, a);
  b.angObj = b.ang = Math.PI / 2;
  let murio = null;
  for (let k = 0; k < 120 && !murio; k++) { m.pasar(1 / 60); for (const e of m.sacarEventos()) if (e.tipo === 'muere') murio = e; }
  ok(murio && murio.v === a && murio.asesino === b, 'la cabeza de A contra el cuerpo de B mata a A: ' + (murio ? `${murio.v.nombre} por ${murio.asesino?.nombre}` : 'nadie murió'));
  ok(b.bajas === 1, 'B suma una baja: ' + b.bajas);
  ok(m.cantidadComida > 5, 'A se volvió comida: ' + m.cantidadComida);
}
{
  const m = vacio();
  const v = new Vibora({ id: 1, nombre: 'V', piel, x: m.radio - 60, y: 0, ang: 0, masa: 20 });
  m.viboras.push(v);
  let murio = null;
  for (let k = 0; k < 60 && !murio; k++) { m.pasar(1 / 60); for (const e of m.sacarEventos()) if (e.tipo === 'muere') murio = e; }
  ok(murio && murio.v === v && !murio.asesino, 'el borde mata');
}
{
  // una sola víbora dando vueltas no se choca a sí misma
  const m = vacio();
  const v = new Vibora({ id: 1, nombre: 'V', piel, x: 0, y: 0, ang: 0, masa: 600 });
  m.viboras.push(v);
  for (let k = 0; k < 600; k++) { v.angObj = v.ang + 1; m.pasar(1 / 60); }
  ok(v.viva, 'enroscarse no mata');
}

console.log('turbo y comida');
{
  const m = vacio();
  const v = new Vibora({ id: 1, nombre: 'V', piel, x: 0, y: 0, ang: 0, masa: 100 });
  m.viboras.push(v);
  for (let k = 0; k < 120; k++) { v.turbo = true; m.pasar(1 / 60); }
  ok(v.masa > 90 && v.masa < 93, 'dos segundos de turbo gastan 8 de masa: queda ' + v.masa.toFixed(1));
  ok(m.cantidadComida >= 4, 'el turbo deja comida atrás: ' + m.cantidadComida);
  const antes = v.masa;
  for (let k = 0; k < 60; k++) { v.turbo = true; m.pasar(1 / 60); }
  ok(v.masa <= antes, 'sigue gastando');
  const chica = new Vibora({ id: 2, nombre: 'C', piel, x: 500, y: 500, ang: 0, masa: 12 });
  m.viboras.push(chica);
  chica.turbo = true; m.pasar(1 / 60);
  ok(!chica.turbo, 'con 12 de masa no hay turbo');
}
{
  const m = vacio();
  const v = new Vibora({ id: 1, nombre: 'V', piel, x: 0, y: 0, ang: 0, masa: 10 });
  m.viboras.push(v);
  m.ponerComida(60, 0, 5, '#ff0000');
  // crecer estira el cuerpo de a poco (la cola deja de cortarse), no de golpe
  const n0 = v.n;
  let salto = 0;
  for (let k = 0; k < 30; k++) {
    const antes = v.n, masa = v.masa;
    m.pasar(1 / 60);
    if (v.masa !== masa) salto = v.n - antes;
  }
  ok(Math.abs(v.masa - 15) < 0.01 && m.cantidadComida === 0, 'come lo de adelante (5 de masa): ' + v.masa);
  ok(v.n > n0, 'el cuerpo se estiró: ' + n0 + ' → ' + v.n);
  ok(salto <= 2, 'en el paso que come crece a lo sumo lo que avanzó: ' + salto + ' puntos');
}

console.log('pasos que siguen al cuadro (60, 90 o 120 Hz)');
{
  const P = 1 / 60;
  for (const [dt, n] of [[1 / 120, 1], [1 / 90, 1], [1 / 60, 1], [1 / 30, 2], [0.1, 6]]) {
    const [k, d] = trozos(dt, P);
    ok(k === n && Math.abs(k * d - dt) < 1e-9 && d <= P + 1e-12, `trozos(${dt.toFixed(4)}): ${k} de ${d.toFixed(4)}`);
  }
  // un segundo a 60 y a 120 pasos: el mismo camino, el mismo largo y la cola que se acorta igual
  const a = new Vibora({ id: 1, nombre: 'a', piel, x: 0, y: 0, ang: 0, masa: 300 }), b = new Vibora({ id: 2, nombre: 'b', piel, x: 0, y: 0, ang: 0, masa: 300 });
  a.masa = b.masa = 100;
  for (let k = 0; k < 60; k++) a.pasar(1 / 60);
  for (let k = 0; k < 120; k++) b.pasar(1 / 120);
  ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.n - b.n) <= 1, `60 y 120 Hz: x ${a.x.toFixed(2)} y ${b.x.toFixed(2)}, cola ${a.n} y ${b.n}`);
  const m60 = new Mundo({ semilla: 5, bots: 0, comida: 900 }), m120 = new Mundo({ semilla: 5, bots: 0, comida: 900 });
  m60.comidaMeta = m120.comidaMeta = 1500;
  for (let k = 0; k < 30; k++) m60.pasar(1 / 60);
  for (let k = 0; k < 60; k++) m120.pasar(1 / 120);
  ok(m60.cantidadComida === m120.cantidadComida, `la comida se repone igual: ${m60.cantidadComida} y ${m120.cantidadComida}`);
}

console.log('simulación larga con bots');
for (const semilla of [1, 2, 3]) {
  const m = new Mundo({ semilla, bots: 22, comida: 1500, nivelBots: 2 });
  let muertes = 0, bordes = 0, nan = 0, max = 0, masaTotal0 = 0, masaMax = 0;
  const masaTotal = () => m.viboras.reduce((s, v) => s + v.masa, 0) + Array.from(m.fvivo).reduce((s, x, i) => s + (x ? m.fv[i] : 0), 0);
  masaTotal0 = masaTotal();
  const t0 = Date.now();
  for (let k = 0; k < 60 * 90; k++) {
    m.pasar(1 / 60);
    for (const e of m.sacarEventos()) if (e.tipo === 'muere') { muertes++; if (!e.asesino) bordes++; }
    if (k % 60 === 0) {
      for (const v of m.viboras) { if (!Number.isFinite(v.x + v.y + v.masa + v.ang)) nan++; max = Math.max(max, v.masa); }
      masaMax = Math.max(masaMax, masaTotal());
    }
  }
  const ms = (Date.now() - t0) / (60 * 90);
  ok(nan === 0, `semilla ${semilla}: ${nan} números rotos`);
  ok(max < 20000, `semilla ${semilla}: masa máxima ${max | 0} (tiene que quedar razonable)`);
  ok(masaMax < masaTotal0 * 3, `semilla ${semilla}: la masa del mundo no explota (${masaTotal0 | 0} → máx ${masaMax | 0})`);
  ok(muertes > 10, `semilla ${semilla}: los bots se comen entre ellos (${muertes} muertes)`);
  ok(bordes < muertes * 0.2, `semilla ${semilla}: pocos se matan contra el borde (${bordes} de ${muertes})`);
  ok(m.viboras.filter((v) => v.bot).length + m.esperando.length >= 22, `semilla ${semilla}: vuelven a nacer`);
  ok(m.cantidadComida > 800 && m.cantidadComida < 9000, `semilla ${semilla}: comida ${m.cantidadComida}`);
  console.log(`  semilla ${semilla}: 90 s con 22 bots picantes en ${(ms * 5400) | 0} ms (${ms.toFixed(3)} ms por paso), ${muertes} muertes (${bordes} en el borde), masa máxima ${max | 0}`);
}

console.log('textos, pieles, fondos y música');
for (const [k, fila] of Object.entries(TABLA)) ok(fila.length === IDIOMAS.length && fila.every((s) => typeof s === 'string' && s.length), 'texto ' + k);
for (const p of PIELES) ok(TABLA['piel_' + p.id], 'la piel ' + p.id + ' no tiene nombre');
for (const f of FONDOS) ok(TABLA['fondo_' + f], 'el fondo ' + f + ' no tiene nombre');
for (const [n, c] of Object.entries(CANCIONES)) for (const p of ['bajo', 'arpegio', 'bombo', 'caja', 'hat']) ok(c[p].length === 16, `${n}.${p}`);

console.log(fallas ? `\n${fallas} de ${total} comprobaciones fallaron` : `\n${total} comprobaciones, todas bien`);
process.exit(fallas ? 1 : 0);
