// Graba muestras del sonido (sin parlantes) en salida/audio/: cada pista (tranquila y pesada) y
// los efectos, para escucharlas y medirlas (que no saturen y que tengan cuerpo, no zumbido).
import { abrir, salida } from "./comun.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const { nav, pag, errores } = await abrir({ tactil: false });
mkdirSync(salida("audio"), { recursive: true });
const pistas = [["menu", 14, false], ["sotano", 14, false], ["sotano", 14, true], ["raices", 16, false], ["raices", 16, true], ["jefe", 12, true], ["calma", 12, false], ["pacto", 12, false], ["tienda", 10, false], ["secreta", 10, false], ["muerte", 12, false]];
for (const [p, s, pes] of pistas) {
  const b64 = await pag.evaluate(([p, s, pes]) => window.__SH.audioMuestra("musica", p, s, pes), [p, s, pes]);
  writeFileSync(salida(`audio/musica-${p}${pes ? "-pesada" : ""}.wav`), Buffer.from(b64, "base64"));
}
const efectos = ["lagrima", "chapoteo", "golpe", "dolor", "muere", "puertaAbre", "puertaCierra", "objeto", "malo", "moneda", "corazon", "llave", "recoger", "mecha", "explosion", "roca", "jefe", "secreto", "escupe", "capsula", "cargado", "activo", "pacto", "pozo", "rayo", "laser", "santa", "zumbido"];
const b64 = await pag.evaluate((e) => window.__SH.audioMuestra("sfx", e, e.length + 2), efectos);
writeFileSync(salida("audio/efectos.wav"), Buffer.from(b64, "base64"));
console.log("efectos en orden, uno por segundo:", efectos.join(", "));
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores");
await nav.close();
