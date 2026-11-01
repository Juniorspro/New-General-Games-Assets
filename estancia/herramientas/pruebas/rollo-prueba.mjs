import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.evaluate(() => { __juego.empezar(); __juego.congelar(true); __juego.hora(10); const J = __juego.J(); J.camara = "tercera"; J.prueba = { az: 0 }; __juego.ir(20, 40, Math.PI * 0.75, -0.1); });
const foto = async (n, prep, pasos, mira) => {
  const info = await p.evaluate(([prep, pasos, mira]) => {
    eval(prep); const j = __juego; j.paso(1 / 30, pasos);
    const J = j.J(), cam = E.motor.camara, d = new THREE.Vector3(); cam.getWorldDirection(d);
    if (mira) { const c = new THREE.Vector3(J.x, E.terreno.altura(J.x, J.z), J.z); j.fotoDesde([c.x + mira[0], c.y + mira[1], c.z + mira[2]], [c.x, c.y + mira[3], c.z]); }
    else j.fotoDesde(cam.position.toArray(), cam.position.clone().add(d).toArray());
    return j.Z().estado;
  }, [prep, pasos, mira]);
  await p.screenshot({ path: `tiras/rollo-${n}.png` }); console.log(n, info);
};
await foto("00", "0", 2, [1.6, 1.3, 1.2, 1.0]);
await foto("01", "__juego.Z().equipar()", 10, [1.6, 1.3, 1.2, 1.0]);
await foto("02", "0", 30, [1.6, 1.3, 1.2, 1.0]);
await foto("03", "0", 20, [1.6, 1.3, 1.2, 1.0]);
await foto("04", "const c = E.animales.caballo, J = __juego.J(); c.x = J.x; c.z = J.z; c.yaw = 0.5; J.montar()", 5, [1.9, 1.8, 1.5, 1.4]);
await foto("05", "0", 20, [-2.2, 1.8, 1.5, 1.4]);
console.log(errores.length ? errores.join("\n") : "sin errores");
await b.close();
