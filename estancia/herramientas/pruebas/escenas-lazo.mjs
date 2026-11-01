const camJuego = `() => { const c = E.motor.camara, d = new THREE.Vector3(); c.getWorldDirection(d); return [c.position.toArray(), c.position.clone().add(d).toArray()]; }`;
const costado = (d = 5, h = 1.4) => `() => { const J = __juego.J(), y = E.terreno.altura(J.x, J.z); return [[J.x + ${d}, y + ${h}, J.z + 1.5], [J.x, y + 1.3, J.z + 2]]; }`;
const base = (camara, extra) => new Function(`
  const j = __juego; j.hora(10); const J = j.J(), Z = j.Z(), A = j.A();
  if (J.montado) J.desmontar();
  if (Z.vaca) { Z.vaca.estado = "pasta"; Z.vaca = null; }
  Z.estado = "guardado"; Z.tieneLazo = true;
  for (const w of A.vacas) if (Math.hypot(w.x - 30, w.z - 40) < 40) w.x += 200;
  J.x = 30; J.z = 40; J.yaw = Math.PI; J.pitch = -0.05; J.camara = "${camara}"; J.prueba = { az: 0 };
  window.suj = J; ${extra}
  j.paso(1/30, 10); return { lazo: Z.estado };`);
const enganche = `
  const v = A.vacas[0]; v.prueba = null; Object.assign(v, { x: 30, z: 47, yaw: 0, estado: "pasta", px: 30, pz: 47, vAnim: 0 }); v.salud.muerta = false; v.fatiga = 1;
  j.paso(1/30, 2); Z.probarEnganche(v); window.vaca = v;`;
export const escenas = [
  { n: "l-revoleo-3p", armar: base("tercera", "Z.empezarRevoleo();"), camara: costado(4.5), cuadros: 8, pasos: 3 },
  { n: "l-revoleo-1p", armar: base("primera", "Z.empezarRevoleo();"), camara: camJuego, cuadros: 4, pasos: 6 },
  { n: "l-tiro", armar: base("tercera", "Z.empezarRevoleo(); for (let i = 0; i < 60; i++) j.paso(1/30, 1); Z.tirar();"), camara: costado(6, 2.0), cuadros: 8, pasos: 3 },
  { n: "l-enganchado-3p", armar: base("tercera", enganche), camara: camJuego, cuadros: 8, pasos: 6 },
  { n: "l-enganchado-lado", armar: base("tercera", enganche), camara: `() => { const v = window.vaca, J = __juego.J(), y = E.terreno.altura(v.x, v.z); const mx = (v.x + J.x) / 2, mz = (v.z + J.z) / 2; return [[mx + 9, y + 2.2, mz], [mx, y + 0.8, mz]]; }`, cuadros: 8, pasos: 8 },
  { n: "l-atada", armar: base("tercera", enganche + " j.paso(1/30, 30); v.estado = 'tumbada'; v.tumbe = 0; Z.estado = 'atada'; Z.tension = 0;"), camara: `() => { const v = window.vaca, y = E.terreno.altura(v.x, v.z); return [[v.x + 4, y + 1.8, v.z - 1], [v.x, y + 0.4, v.z]]; }`, cuadros: 6, pasos: 10 },
];
