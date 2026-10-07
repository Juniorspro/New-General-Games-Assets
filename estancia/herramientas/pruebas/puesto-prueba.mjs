import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
const r0 = await p.evaluate(() => { __juego.empezar(); __juego.congelar(true); __juego.hora(17.5); return { modelos: ["mesa", "silla", "heladera", "pava", "perro", "toro"].map((n) => n + ":" + E.modelos.hay(n)).join(" ") }; });
console.log(JSON.stringify(r0));
let k = 0;
const foto = async (prep, pos, mira, pasos = 3) => {
  const info = await p.evaluate(([prep, pos, mira, pasos]) => {
    eval(prep); __juego.paso(1 / 30, pasos);
    const R = E.lugares.rancho, y = E.terreno.altura(R.x, R.z);
    __juego.fotoDesde([R.x + pos[0], y + pos[1], R.z + pos[2]], [R.x + mira[0], y + mira[1], R.z + mira[2]]);
    const c = E.animales.caballo; return `sucio ${(c.sucio || 0).toFixed(2)} comido ${c.comido} bañado ${c.banado} olla ${E.puesto.olla.visible} hud "${document.getElementById("hudObjetivos").innerText.replace(/\n/g, " / ")}" msg "${document.getElementById("mensaje").innerText}"`;
  }, [prep, pos, mira, pasos]);
  await p.screenshot({ path: `tiras/pu-${String(k++).padStart(2, "0")}.png` }); console.log(info);
};
// la galería
await foto("0", [0.5, 1.7, 7.5], [-1.5, 0.7, 3.8]);
// adentro: la heladera
await foto("0", [-1, 1.6, 1.5], [3.3, 0.8, 0.9]);
// el comedero con forraje y el caballo sucio
await foto("const c = E.animales.caballo; c.sucio = 0.9; E.puesto.forraje()", [4, 2, 12], [8.5, 0.6, 6.2], 30);
// el guiso en el fogón
await foto("E.puesto.cocinar()", [8, 1.6, 17], [11, 0.4, 14], 30);
// cebar mate (vapor)
await foto("E.puesto.cebarMate()", [-0.6, 1.3, 5.2], [-1.5, 0.8, 3.8], 20);
// bañar
await foto("const c = E.animales.caballo, J = __juego.J(), T = E.lugares.tanque; J.x = T.x + T.r + 2; J.z = T.z; c.x = J.x + 2; c.z = J.z; E.puesto.banar()", [4, 2, 12], [8.5, 0.6, 6.2], 400);
// amanecer: sin forraje ni baño el día siguiente
const txt = await p.evaluate(() => { const c = E.animales.caballo; c.comido = 0; c.banado = 0; c.sucio = 0.8; return E.puesto.amanecer(1) + " | aliento " + c.aliento + " lesion " + c.lesion; });
console.log("amanecer:", txt);
console.log(errores.join("\n") || "sin errores");
await b.close();
