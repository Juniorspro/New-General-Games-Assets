// Carga la física de LUZ MALA en Node (la misma que usa el juego) para las pruebas.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export function cargar() {
  const codigo = ["motor2d/base.js", "luz-mala/js/fisica.js", "luz-mala/js/bichos.js", "luz-mala/js/jefes.js", "luz-mala/js/salas.js"]
    .map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n")
    + "\n;globalThis.__L = { LF, LT, crearMundoLM, pasarChispa, pasarBichos, pasarBalas, pasarJefe, pasarAmbar, crearJefe, danarJefe, salidaDe, SALAS_LM, SALA_POR_ID, salaEn, ZONAS, JEFES, BICHOS, chocaLM, pisaLM, paredLM, lastimar };";
  const ctx = vm.createContext({ console, Math, Uint8Array, Int32Array, Object, Array, JSON, Set, Map });
  vm.runInContext(codigo, ctx, { filename: "luz-mala.js" });
  return ctx.__L;
}
