// Hojas de sprites agrandados, para mirar el arte: node pruebas/hoja.mjs [grupo]
import { abrir, guardarDataURL } from "./comun.mjs";
const grupo = process.argv[2] || "shumio";
const { nav, pag, errores } = await abrir();
const url = await pag.evaluate((grupo) => window.__SH.hojaDe ? window.__SH.hojaDe(grupo) : null, grupo);
if (url) guardarDataURL(url, `hoja-${grupo}.png`);
console.log(url ? `✓ salida/hoja-${grupo}.png` : "✗ sin hoja", errores.length ? errores : "");
await nav.close();
