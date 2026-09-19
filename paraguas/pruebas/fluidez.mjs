// QUE EL JUEGO SE ACOMODE AL APARATO.
//
// "Va lag" depende del telefono, asi que no alcanza con medir acá y dar un
// numero: hay que comprobar que el juego SE DA CUENTA y baja la resolucion.
// Se frena el procesador con el protocolo de depuracion, que es lo mas parecido
// a un telefono barato que se puede hacer desde una compu.
import { chromium } from "playwright";
let ok = 0, mal = 0;
const ch = (n,c,d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                             : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });

async function correr(freno, dpr) {
  const pg = await nav.newPage({ viewport: { width: 412, height: 892 },
                                 hasTouch: true, deviceScaleFactor: dpr });
  const cdp = await pg.context().newCDPSession(pg);
  if (freno > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: freno });
  await pg.goto("http://127.0.0.1:8813/index.html");
  await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 40000 });
  const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
  if (idi) { await idi.click(); await pg.waitForTimeout(400); }
  await pg.click("#m-jugar");
  await pg.waitForTimeout(12000);   // tiempo para que se acomode
  const r = await pg.evaluate(() => ({ cal: window.PARAGUAS.calidad(),
                                       lz: window.PARAGUAS.lienzo() }));
  const fps = await pg.evaluate(() => window.PARAGUAS.fps(3000));
  await pg.close();
  return { ...r, fps };
}

// Maquina libre: no tiene por que bajar nada.
const libre = await correr(1, 2);
ch("con la maquina libre se queda en la mejor calidad", libre.cal.paso === 0,
   `paso ${libre.cal.paso}, lienzo ${libre.lz.w}x${libre.lz.h}, ${libre.fps} fps`);

// Procesador frenado seis veces: tiene que bajar.
const lento = await correr(6, 3);
ch("con el procesador frenado baja la resolucion sola", lento.cal.paso > 0,
   `paso ${lento.cal.paso} (factor ${lento.cal.factor}), lienzo ${lento.lz.w}x${lento.lz.h}, ${lento.fps} fps`);
ch("y el lienzo queda mas chico que a calidad plena",
   lento.lz.w < Math.round(412 * Math.min(3, 2)),
   `${lento.lz.w} px de ancho contra ${Math.round(412 * 2)} a calidad plena`);

// QUE NO OSCILE. Una calidad que sube y baja sola cada dos segundos se ve peor
// que cualquiera de las dos: la imagen cambia de nitidez todo el tiempo. Con el
// procesador a medio freno —justo en el borde, que es donde oscilaria— se mira
// que despues de acomodarse se quede quieta.
{
  const pg = await nav.newPage({ viewport: { width: 412, height: 892 },
                                 hasTouch: true, deviceScaleFactor: 2 });
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 3 });
  await pg.goto("http://127.0.0.1:8813/index.html");
  await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 40000 });
  const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
  if (idi) { await idi.click(); await pg.waitForTimeout(400); }
  await pg.click("#m-jugar");
  await pg.waitForTimeout(10000);                 // que se acomode
  const pasos = [];
  for (let i = 0; i < 8; i++) {
    pasos.push(await pg.evaluate(() => window.PARAGUAS.calidad().paso));
    await pg.waitForTimeout(1200);
  }
  const distintos = new Set(pasos).size;
  ch("una vez acomodada, la calidad se queda quieta", distintos <= 2,
     `pasos observados: ${pasos.join(",")}`);
  await pg.close();
}

console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
