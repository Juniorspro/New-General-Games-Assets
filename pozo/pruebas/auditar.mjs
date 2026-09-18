import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, hasTouch: true });
const err = [];
pg.on("pageerror", e => err.push(e.message));
await pg.goto("file://" + process.argv[2]);
await pg.waitForTimeout(2500);
await (await pg.$("#idL button")).click();
await pg.waitForTimeout(2500);
console.log("  pisos:   ", JSON.stringify(await pg.evaluate(() => window.__pozo.auditar(60))).slice(0, 700));
console.log("  sprites: ", JSON.stringify(await pg.evaluate(() => window.__pozo.assets())).slice(0, 400));
console.log("  costo:   ", JSON.stringify(await pg.evaluate(() => window.__pozo.costo(120))));
console.log("  errores: ", err.length, err.slice(0,2).join(" | "));
await nav.close();
