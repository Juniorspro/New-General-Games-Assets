// EN TELEFONOS DE VERDAD, PARADOS Y ACOSTADOS.
// Lo que se mide es lo que arruina un juego en la mano: que algo se salga de la
// pantalla, que la zona de toque quede chica para un pulgar, o que la línea de
// juicio quede tapada por la barra de abajo.
import { chromium } from "playwright";
import { ch, cerrar } from "./_ch.mjs";
import path from "path";

const ARCHIVO = path.resolve(process.argv[2] || "ritmo-en-un-archivo.html");
const TAMANOS = [
  ["iPhone SE parado", 320, 568], ["Android chico parado", 360, 640],
  ["iPhone 14 parado", 390, 844], ["Android grande parado", 412, 915],
  ["tablet parada", 768, 1024], ["teléfono acostado", 844, 390],
];
// 44 px es el mínimo que Apple y Google dan por bueno para algo que se toca.
const DEDO = 44;

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
for (const [nombre, an, al] of TAMANOS) {
  const pg = await nav.newPage({ viewport: { width: an, height: al }, hasTouch: true });
  const err = [];
  pg.on("pageerror", (e) => err.push(e.message.slice(0, 120)));
  await pg.goto("file://" + ARCHIVO);
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { window.__ritmo.ir("menu"); window.__ritmo.empezar(9); });
  await pg.waitForTimeout(700);

  const m = await pg.evaluate(() => {
    const z = [...document.querySelectorAll("#zonas div")].map((d) => d.getBoundingClientRect());
    const c = document.getElementById("lienzo").getBoundingClientRect();
    const hud = document.getElementById("hud").getBoundingClientRect();
    return {
      anchoZona: Math.min(...z.map((r) => r.width)),
      altoZona: Math.min(...z.map((r) => r.height)),
      zonaFuera: z.some((r) => r.left < -1 || r.right > innerWidth + 1),
      desborde: document.documentElement.scrollWidth - innerWidth,
      lienzo: [Math.round(c.width), Math.round(c.height)],
      hudAbajo: hud.bottom,
      alto: innerHeight,
    };
  });
  ch(`${nombre}: no se sale nada de la pantalla`, m.desborde <= 0 && !m.zonaFuera,
     `desborde ${m.desborde} px`);
  ch(`${nombre}: los carriles entran un pulgar`, m.anchoZona >= DEDO && m.altoZona >= DEDO * 3,
     `${Math.round(m.anchoZona)}×${Math.round(m.altoZona)} px`);
  ch(`${nombre}: el lienzo ocupa la pantalla`, m.lienzo[0] === an && m.lienzo[1] === al,
     `${m.lienzo.join("×")}`);
  ch(`${nombre}: el marcador no se come la pista`, m.hudAbajo < m.alto * 0.18,
     `termina a ${Math.round(m.hudAbajo)} px de ${m.alto}`);
  ch(`${nombre}: sin errores`, err.length === 0, err[0] || "");
  await pg.close();
}
await nav.close();
cerrar();
