// El sonido tiene que arrancar con el PRIMER toque de dedo, con la política real del navegador
// (acá no se usa --autoplay-policy=no-user-gesture-required, como en las otras pruebas).
import { chromium, salida } from "./comun.mjs";
import { readFileSync } from "node:fs";
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await nav.newContext({ viewport: { width: 800, height: 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const pag = await ctx.newPage(), errores = [];
pag.on("pageerror", (e) => errores.push(e.message));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
await pag.route("https://shumio.prueba/**", (q) => q.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
await pag.goto("https://shumio.prueba/");
await pag.waitForFunction(() => window.__SH && window.__SH.listo);
const antes = await pag.evaluate(() => (typeof AC !== "undefined" && AC ? AC.state : "sin audio"));
await pag.touchscreen.tap(400, 180);
await pag.waitForTimeout(600);
const despues = await pag.evaluate(() => ({ estado: AC ? AC.state : "sin audio", tema: Musica.tema, t: AC ? +AC.currentTime.toFixed(2) : 0, menu: estadoAudio(), error: AUDIO.error }));
await pag.touchscreen.tap(400, 180); await pag.waitForTimeout(1500);
// que salga señal DE VERDAD (en vivo, no grabada): el medidor a la salida, varias veces
const niveles = []; for (let i = 0; i < 12; i++) { niveles.push(await pag.evaluate(() => Math.round(nivelAudio()))); await pag.waitForTimeout(150); }
const luego = await pag.evaluate(() => ({ estado: AC.state, tema: Musica.tema, t: +AC.currentTime.toFixed(2), menu: estadoAudio() }));
console.log("nivel a la salida (dB, cada 150 ms):", niveles.join(" "), Math.max(...niveles) > -60 ? "→ sale sonido" : "→ NO SALE SEÑAL");
// la otra salida (por reproductor) también tiene que sacar señal
await pag.evaluate(() => cambiarSalida()); await pag.waitForTimeout(800);
const n2 = []; for (let i = 0; i < 8; i++) { n2.push(await pag.evaluate(() => Math.round(nivelAudio()))); await pag.waitForTimeout(150); }
console.log("por reproductor:", await pag.evaluate(() => ({ modo: modoSalida, pausado: SALIDA_EL && SALIDA_EL.paused, error: AUDIO.error })), n2.join(" "));
console.log("antes del toque:", antes, "| después del primer toque:", despues, "| después del segundo:", luego);
console.log(despues.estado === "running" ? "el sonido arranca con el primer toque" : "EL SONIDO NO ARRANCÓ");
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores");
await nav.close();
