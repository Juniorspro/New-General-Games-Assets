import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
const camara = process.argv[2] || "tercera";
await p.evaluate((camara) => {
  __juego.empezar(); __juego.congelar(true);
  const j = __juego; j.hora(9); const J = j.J(), Z = j.Z(), A = j.A();
  for (const w of A.vacas) if (Math.hypot(w.x - 30, w.z - 40) < 40) w.x += 200;
  J.x = 30; J.z = 40; J.yaw = Math.PI; J.pitch = -0.08; J.camara = camara === "montado" ? "tercera" : camara; J.prueba = { az: 0 };
  if (camara === "montado") { const c = A.caballo; Object.assign(c, { x: 30, z: 40, yaw: 0, v: 0 }); J.montar(); }
  const v = A.vacas[2]; v.prueba = { v: 0.5 }; Object.assign(v, { x: 31, z: 50, yaw: 1.4, estado: "pasta", px: 31, pz: 50 }); v.salud.muerta = false;
  Z.estado = "guardado"; Z.tieneLazo = true; j.paso(1 / 30, 5); Z.empezarRevoleo(); window.vaca = v;
}, camara);
const cuadro = async (n, pasos) => {
  const info = await p.evaluate((pasos) => {
    const j = __juego; j.paso(1 / 30, pasos);
    const c = E.motor.camara, d = new THREE.Vector3(); c.getWorldDirection(d);
    j.fotoDesde(c.position.toArray(), c.position.clone().add(d).toArray());
    const O = E.ojo; return { ojo: O.activo.toFixed(2), escala: O.escala.toFixed(2), bloqueo: O.bloqueo.toFixed(2), blanco: !!O.blanco, cine: !!O.cine, lazo: j.Z().estado, vaca: window.vaca.estado };
  }, pasos);
  await p.screenshot({ path: `tiras/o-${camara}-${n}.png` });
  console.log(n, JSON.stringify(info));
};
await cuadro("00", 8); await cuadro("01", 12); await cuadro("02", 15);
await p.evaluate(() => { __juego.Z().tirar(); });
for (let i = 3; i < 16; i++) await cuadro(String(i).padStart(2, "0"), 12);
console.log(errores.length ? errores.join("\n") : "sin errores");
await b.close();
