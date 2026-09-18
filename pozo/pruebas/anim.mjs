// Que la animacion ANDE, no que este escrita. Una regla con un nombre de
// keyframe mal escrito no falla: simplemente no anima, y en una captura suelta
// se ve idéntica a una que sí anima.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, hasTouch: true });
await pg.goto("file://" + process.argv[2]);
await pg.waitForTimeout(2500);

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

// El navegador sabe que animaciones tiene corriendo: se le pregunta a el.
const corriendo = async (sel) => pg.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  return e.getAnimations({subtree:false}).map(a => a.animationName || a.constructor.name);
}, sel);

await (await pg.$("#idL button")).click();
await pg.waitForTimeout(120);

ch("el titulo anima al entrar", (await corriendo("#pMenu h1") || []).includes("pozoEntra"),
   JSON.stringify(await corriendo("#pMenu h1")));
ch("el boton principal late", (await corriendo("#pMenu .b.p") || []).some(a => a === "pozoPulso"),
   JSON.stringify(await corriendo("#pMenu .b.p")));
const polvo = await pg.evaluate(() => document.querySelector("#pMenu")
  .getAnimations({subtree:true}).map(a => a.animationName).filter(Boolean));
ch("el polvo cae", polvo.includes("pozoPolvo"), polvo.join(","));

// Y que el titulo DE VERDAD se mueva: dos capturas separadas en el tiempo.
await pg.waitForTimeout(1500);
const a = await pg.locator("#pMenu h1").screenshot();
await pg.waitForTimeout(2100);           // media vuelta del latido (4,2 s)
const b = await pg.locator("#pMenu h1").screenshot();
ch("el resplandor del titulo cambia con el tiempo", !a.equals(b),
   `${a.length} vs ${b.length} bytes`);

// Con movimiento reducido, nada se mueve solo.
const pg2 = await nav.newPage({ viewport:{width:412,height:892}, hasTouch:true,
                                reducedMotion:"reduce" });
await pg2.goto("file://" + process.argv[2]);
await pg2.waitForTimeout(2500);
await (await pg2.$("#idL button")).click();
await pg2.waitForTimeout(300);
const red = await pg2.evaluate(() => document.querySelector("#pMenu")
  .getAnimations({subtree:true}).map(a => a.animationName).filter(Boolean));
ch("con movimiento reducido no queda nada animandose solo", red.length === 0, red.join(","));

console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
