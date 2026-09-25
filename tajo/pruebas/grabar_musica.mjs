// Graba cada canción fuera de línea y guarda el WAV (uso: node pruebas/grabar_musica.mjs [carpeta] [segundos])
import { chromium } from "playwright";
import fs from "fs";
const carpeta = process.argv[2] || ".";
const hasta = process.argv[3] && process.argv[3] !== "-" ? Number(process.argv[3]) : null;
const indice = Number(process.argv[4] || 0);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage();
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
pg.on("console", m => { if (m.type() === "error") console.log("CONSOLA:", m.text().slice(0, 300)); });
await pg.goto("http://127.0.0.1:8811/pruebas/musica.html");
await pg.waitForFunction(() => window.__listo === true);
const r = await pg.evaluate(async ([h, i]) => await window.grabar(i, 44100, h), [hasta, indice]);
fs.writeFileSync(`${carpeta}/cancion${indice}.wav`, Buffer.from(r.wav, "base64"));
delete r.wav;
console.log(JSON.stringify(r, null, 1));
await nav.close();
