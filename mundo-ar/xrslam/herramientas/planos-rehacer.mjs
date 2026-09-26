// Vuelve a detectar planos sobre un mapa guardado por planos-euroc.mjs.
//   node planos-rehacer.mjs <salida de planos-euroc>
import fs from "fs";
import path from "path";
import { MapaPlanos } from "../web/planos.js";
const dir = process.argv[2];
const { cam, celdas } = JSON.parse(fs.readFileSync(path.join(dir, "mapa.json"), "utf8"));
const m = new MapaPlanos();
celdas.forEach((c, i) => m.celdas.set(String(i), c));
const opc = process.env.PLANARIDAD ? { planaridad: Number(process.env.PLANARIDAD) } : {};
const t0 = performance.now(), planos = m.detectar(cam, opc);
fs.writeFileSync(path.join(dir, "planos.json"), JSON.stringify(planos));
console.log(`${celdas.length} vóxeles · ${planos.length} planos · ${(performance.now() - t0).toFixed(0)} ms` + (m.diag ? " · " + JSON.stringify(m.diag) : ""));
