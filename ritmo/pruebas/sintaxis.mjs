// LO QUE SE REVISA SIN ABRIR NADA: que todo cargue, que las tablas estén
// completas y que no haya quedado andamio de depuración adentro del juego.
import { ch, cerrar } from "./_ch.mjs";
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import path from "path";

const JS = path.resolve("js");
const archivos = readdirSync(JS).filter((a) => a.endsWith(".js")).sort();
ch("hay módulos que revisar", archivos.length >= 8, archivos.length + " archivos");

/* LA SINTAXIS SE REVISA SIN EJECUTAR, y por eso hay dos pasadas.
   `main.js` arma la pantalla apenas se lo importa: importarlo acá revienta con
   "document is not defined", que no es un error del archivo sino de estar
   corriéndolo donde no hay navegador. `node --check` lo analiza sin correrlo
   —pide extensión .mjs para tratarlo como módulo— y de main.js se encarga la
   prueba del archivo único, que sí lo abre en un navegador. */
const tmp = mkdtempSync(path.join(tmpdir(), "ritmo-sint-"));
for (const a of archivos) {
  const copia = path.join(tmp, a.replace(/\.js$/, ".mjs"));
  writeFileSync(copia, readFileSync(path.join(JS, a)));
  try { execFileSync(process.execPath, ["--check", copia], { stdio: "pipe" }); ch(`${a}: la sintaxis está bien`, true); }
  catch (e) { ch(`${a}: la sintaxis está bien`, false, String(e.stderr).split("\n")[2] || ""); }
}
// Los que no tocan el navegador tienen que poder importarse de verdad: eso
// caza los ciclos y los nombres mal exportados, que la sintaxis no ve.
for (const a of archivos.filter((x) => x !== "main.js")) {
  try { await import(path.join(JS, a)); ch(`${a}: se importa`, true); }
  catch (e) { ch(`${a}: se importa`, false, e.message.slice(0, 120)); }
}

const { faltantes } = await import("../js/idioma.js");
const f = faltantes();
ch("los tres idiomas tienen exactamente las mismas llaves", f.length === 0, f.slice(0, 3).join(" · "));

// EL EMPAQUETADOR LEE UNA LISTA A MANO. Un módulo nuevo que nadie agregó a
// `ORDEN` no entra al archivo único, y el juego anda perfecto servido y en
// blanco con doble clic, que es la forma más cara de enterarse.
const emp = readFileSync("empaquetar.py", "utf8");
const orden = emp.match(/ORDEN = \[([^\]]*)\]/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
const entrada = emp.match(/ENTRADA = "([^"]+)"/)[1];
const enLista = new Set([...orden, entrada]);
const sueltos = archivos.map((a) => a.replace(/\.js$/, "")).filter((m) => !enLista.has(m));
// `validar` es del validador y no del juego: no va al archivo único a propósito.
const esperadosFuera = ["validar"];
ch("todos los módulos del juego están en el empaquetador",
   sueltos.every((m) => esperadosFuera.includes(m)),
   sueltos.length ? "fuera: " + sueltos.join(", ") : "ninguno suelto");

// Nada de rastros: un console.log olvidado ensucia la consola de quien juegue.
const sucios = [];
for (const a of archivos) {
  const src = readFileSync(path.join(JS, a), "utf8");
  for (const [i, l] of src.split("\n").entries()) {
    if (/^\s*(console\.log|debugger|alert)\b/.test(l)) sucios.push(`${a}:${i + 1}`);
  }
}
ch("no quedó ningún rastro de depuración", sucios.length === 0, sucios.join(" "));
cerrar();
