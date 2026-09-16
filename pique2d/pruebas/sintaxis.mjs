// Comprobacion de sintaxis de todos los modulos.
//
// Existe porque un reemplazo masivo sobre el codigo fuente me piso las lineas
// de `import` y dejo `import { VISTA.ancho }`, que es un error de sintaxis. El
// juego cargaba una pagina en blanco y la unica pista era "Unexpected token
// '.'" en la consola del navegador. Esto lo caza en un segundo y sin abrir
// nada.
import { readdirSync } from "fs";
import { pathToFileURL } from "url";
import path from "path";
const dir = path.resolve("js");
let malos = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith(".js"))) {
  try { await import(pathToFileURL(path.join(dir, f)).href); }
  catch (e) {
    if (e instanceof SyntaxError) {
      console.log(`  ✗ ${f}: ${e.message.split("\n")[0]}`); malos++;
    }
    // Los que fallan por falta de `document` o `window` no son un problema:
    // son modulos de navegador y Node no tiene DOM.
  }
}
console.log(malos ? `\n${malos} modulos con error de sintaxis` : "  ✓ todos los modulos compilan");
process.exit(malos ? 1 : 0);
