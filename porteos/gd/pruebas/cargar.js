// Carga el motor (porteos/gd/src) en Node, sin pantalla, para el bot y las sondas.
// Los datos del juego salen de la entrega (portear.sh): GD_DATOS, o entrega-gd/gd/datos.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = process.env.GD_SRC || path.join(__dirname, '..', 'src');
for (const f of ['base.js', 'nivel.js', 'colores.js', 'triggers.js', 'jugador.js', 'juego.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f });
}
const DATOS = process.env.GD_DATOS || path.join(__dirname, '..', '..', '..', 'entrega-gd', 'gd', 'datos');
const datos = JSON.parse(fs.readFileSync(path.join(DATOS, 'datos.json'), 'utf8'));
async function nivel(n) {
  const txt = await GD.decodificarNivel(fs.readFileSync(path.join(DATOS, 'niveles', n + '.txt'), 'utf8'));
  return new GD.Nivel(txt, datos.objetos);
}
module.exports = { GD: globalThis.GD, datos, nivel };
