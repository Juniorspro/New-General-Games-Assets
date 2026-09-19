// El archivo unico tiene que andar con DOBLE CLIC. Se abre desde file:// y se
// exige que no pida NINGUN archivo suelto: un 404 contra file:// no avisa nada
// y la pantalla igual se ve bien, asi que sin esta comprobacion un empaquetado
// a medias pasa desapercibido.
import { chromium } from "playwright";
const ARCH = process.argv[2];
let ok = 0, mal = 0;
const ch = (n,c,d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                             : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
const err = [], sueltos = [];
pg.on("pageerror", e => err.push(e.message));
pg.on("console", m => { if (m.type()==="error") err.push("consola: "+m.text().slice(0,160)); });
// Los `blob:` NO son archivos sueltos: los fabrica el cargador de GLB a partir
// del propio data URI que ya esta adentro del HTML. Contarlos como pedidos
// externos hacia fallar una prueba que estaba bien.
pg.on("request", r => { const u = r.url();
  if (!u.startsWith("data:") && !u.startsWith("blob:") && u !== "file://" + ARCH)
    sueltos.push(u.slice(0,110)); });

await pg.goto("file://" + ARCH);
await pg.waitForFunction(() => window.__perro && window.__perro.est().cargado, { timeout: 90000 })
  .catch(() => {});
await pg.waitForTimeout(2500);

const e = await pg.evaluate(() => window.__perro.est());
ch("el perro carga desde el archivo unico", e.cargado, JSON.stringify(e));
ch("usa el esqueleto con animaciones", e.conClips === true);
ch("no pide ningun archivo suelto", sueltos.length === 0, sueltos.slice(0,3).join(" | "));

await pg.click("#mJugar");
await pg.waitForTimeout(400);
const a = await pg.evaluate(() => window.__perro.anda(1.2, 0, -1));
ch("el perro camina", a.rec > 4, `recorrio ${a.rec} en 1,2 s a ${a.vel}`);
ch("y da pasos", a.pasos > 0, `${a.pasos} pisadas`);

// EL BANNER DEL MENU TIENE QUE SER UN data: URI. Si quedo como ruta relativa,
// desde file:// no carga, el fondo de respaldo tapa el agujero y la tarjeta se
// ve entera igual: no hay forma de notarlo mirando.
const banner = await pg.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--banner").slice(0, 24));
ch("el banner va embebido, no por ruta", banner.includes("data:"), banner);

ch("sin errores de javascript", err.length === 0, err.slice(0,3).join(" | "));
console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
