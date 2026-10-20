// Los animales van hacia +z; la cámara al costado izquierdo (+x), del lado del sol.
const lado = (d = 5, h = 1.0, dz = 0) => `() => { const a = window.suj, y = E.terreno.altura(a.x, a.z); return [[a.x + ${d}, y + ${h}, a.z + ${dz}], [a.x, y + ${h} - 0.3, a.z]]; }`;
const vaca = (v, extra = "", pre = "") => new Function(`
  const j = __juego; j.hora(10);
  const A = j.A(); for (const w of A.vacas) if (w !== A.vacas[0] && Math.abs(w.x - 60) < 40) w.x += 300;
  const a = A.vacas[0]; Object.assign(a, { x: 60, z: 20, yaw: 0, px: 60, pz: 20, vAnim: ${v} }); a.prueba = { v: ${v} ${extra} };
  a.salud.bichera = null; a.salud.muerta = false; a.estado = "pasta"; ${pre}
  const J = j.J(); if (J.montado) J.desmontar(); J.x = 20; J.z = 60; window.suj = a; j.paso(1/30, 25);
  return { tipo: a.tipo, v: a.vAnim.toFixed(2) };`);
const caballo = (v, extra = "") => new Function(`
  const j = __juego; j.hora(10); const J = j.J(); if (J.montado) J.desmontar(); J.x = 20; J.z = 60;
  const c = j.A().caballo; Object.assign(c, { x: 60, z: -30, yaw: 0, destino: null, px: 60, pz: -30, vAnim: ${v} }); c.prueba = { v: ${v} ${extra} };
  window.suj = c; j.paso(1/30, 25); return { v: c.vAnim.toFixed(2) };`);
const guacho = (az, corre, ax = 0, yaw = "Math.PI") => new Function(`
  const j = __juego; j.hora(10); const J = j.J();
  if (J.montado) J.desmontar();
  J.x = 30; J.z = 40; J.yaw = ${yaw}; J.rumbo = Math.PI * 0; J.camara = "tercera"; J.prueba = { az: ${az}, ax: ${ax}, corre: ${corre} };
  window.suj = J; j.paso(1/30, 25); return { vel: J.vel.toFixed(2), vAd: (J.vAdelante || 0).toFixed(2), rumbo: J.rumbo.toFixed(2) };`);
const montado = (paso, corre) => new Function(`
  const j = __juego; j.hora(10); const J = j.J(); const c = j.A().caballo;
  if (!J.montado) { c.x = 30; c.z = -40; c.yaw = 0; c.prueba = null; J.montar(); }
  c.x = 30; c.z = -40; c.yaw = 0; J.yaw = Math.PI; J.alPaso = ${paso}; J.camara = "tercera"; J.prueba = { az: 1, corre: ${corre} };
  window.suj = c; j.paso(1/30, 60); return { v: c.vReal.toFixed(2) };`);
export const escenas = [
  { n: "m-vaca-paso", armar: vaca(1.2), camara: lado(4.5), cuadros: 12, pasos: 3 },
  { n: "m-vaca-trote", armar: vaca(3.5), camara: lado(4.5), cuadros: 12, pasos: 2 },
  { n: "m-vaca-galope", armar: vaca(7.5), camara: lado(5.5), cuadros: 12, pasos: 1 },
  { n: "m-vaca-pasta", armar: vaca(0, ", cabeza: 1"), camara: lado(4), cuadros: 4, pasos: 20 },
  { n: "m-vaca-echada", armar: vaca(0, ", echada: true"), camara: lado(4), cuadros: 4, pasos: 20 },
  { n: "m-vaca-tumbada", armar: vaca(0, ", estado: 'tumbada'"), camara: lado(4, 1.2), cuadros: 4, pasos: 20 },
  { n: "m-vaca-muerta", armar: vaca(0, "", "a.salud.muerta = true;"), camara: lado(4, 1.2), cuadros: 2, pasos: 20 },
  { n: "m-caballo-paso", armar: caballo(1.7), camara: lado(4.5), cuadros: 12, pasos: 3 },
  { n: "m-caballo-trote", armar: caballo(3.9), camara: lado(4.5), cuadros: 12, pasos: 2 },
  { n: "m-caballo-galope", armar: caballo(8.8), camara: lado(6), cuadros: 12, pasos: 1 },
  { n: "m-caballo-pasta", armar: caballo(0, ", cabeza: 0.9"), camara: lado(4), cuadros: 4, pasos: 20 },
  { n: "m-guacho-quieto", armar: guacho(0, false), camara: lado(3.2, 1.2), cuadros: 8, pasos: 20 },
  { n: "m-guacho-camina", armar: guacho(1, false), camara: lado(3.2, 1.2), cuadros: 12, pasos: 3 },
  { n: "m-guacho-corre", armar: guacho(1, true), camara: lado(3.8, 1.2), cuadros: 12, pasos: 2 },
  { n: "m-guacho-costado", armar: guacho(0, false, 1), camara: lado(3.2, 1.2), cuadros: 6, pasos: 4 },
  { n: "m-montado-paso", armar: montado(true, false), camara: lado(5, 1.6), cuadros: 12, pasos: 3 },
  { n: "m-montado-trote", armar: montado(false, false), camara: lado(5, 1.6), cuadros: 12, pasos: 2 },
  { n: "m-montado-galope", armar: montado(false, true), camara: lado(6.5, 1.6), cuadros: 12, pasos: 1 },
];
