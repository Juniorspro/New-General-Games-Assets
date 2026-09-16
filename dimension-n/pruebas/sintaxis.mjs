// Que todos los módulos compilen, antes de mirar nada más.
//
// Un error de sintaxis en un módulo ES no tira nada útil: el navegador carga
// una página en blanco y la única pista es "Unexpected token" en la consola,
// sin decir qué archivo. Importarlos de a uno dice cuál.
import { readdirSync } from "fs";
const malos = [];
for (const f of readdirSync(new URL("../js/", import.meta.url)).filter((f) => f.endsWith(".js"))) {
  // main.js y dibujo.js tocan el DOM al importarse: se compilan aparte.
  if (f === "main.js") continue;
  try { await import(`../js/${f}`); }
  catch (e) { malos.push(`${f}: ${e.message}`); }
}
// main.js necesita un documento para existir. Alcanza con comprobar que el
// archivo parsea, que es lo que esta prueba busca.
import { readFileSync } from "fs";
try {
  new (Object.getPrototypeOf(async function () {}).constructor)(
    readFileSync(new URL("../js/main.js", import.meta.url), "utf8")
      .replace(/^import .*$/gm, "").replace(/^export /gm, ""));
} catch (e) { malos.push(`main.js: ${e.message}`); }

if (malos.length) { console.log("  ✗ " + malos.join("\n  ✗ ")); process.exit(1); }
console.log("  ✓ todos los módulos compilan");
