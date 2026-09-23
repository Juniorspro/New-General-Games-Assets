// Que cada hueco en el borde de una sala dé a un hueco de la sala vecina,
// baldosa por baldosa, y que ninguna sala se pise con otra.
//     node luz-mala/pruebas/conexiones.mjs [--mapa]
import { cargar } from "./cargar.mjs";
const L = cargar();
const S = L.SALAS_LM;
let mal = 0;
const libre = (s, x, y) => { const c = s.mapa[y][x]; return c !== "#" && c !== "B"; };
const salaDe = (wx, wy) => S.find((s) => wx >= s.pos[0] && wx < s.pos[0] + s.tam[0] && wy >= s.pos[1] && wy < s.pos[1] + s.tam[1]);
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  const a = S[i], b = S[j];
  if (a.pos[0] < b.pos[0] + b.tam[0] && b.pos[0] < a.pos[0] + a.tam[0] && a.pos[1] < b.pos[1] + b.tam[1] && b.pos[1] < a.pos[1] + a.tam[1]) { console.log(`MAL  ${a.id} y ${b.id} se pisan`); mal++; }
}
for (const s of S) {
  const [W, H] = s.tam, [X, Y] = s.pos;
  const bordes = [];
  for (let y = 0; y < H; y++) { bordes.push([0, y, -1, 0]); bordes.push([W - 1, y, 1, 0]); }
  for (let x = 0; x < W; x++) { bordes.push([x, 0, 0, -1]); bordes.push([x, H - 1, 0, 1]); }
  const huecos = {};
  for (const [x, y, dx, dy] of bordes) {
    if (!libre(s, x, y)) continue;
    const wx = X + x + dx, wy = Y + y + dy, v = salaDe(wx, wy);
    const lado = dx < 0 ? "izq" : dx > 0 ? "der" : dy < 0 ? "arr" : "aba";
    if (!v) { console.log(`MAL  ${s.id} tiene un hueco ${lado} en (${x},${y}) que da al vacío`); mal++; continue; }
    if (!libre(v, wx - v.pos[0], wy - v.pos[1])) { console.log(`MAL  ${s.id} (${x},${y}) ${lado} da contra la pared de ${v.id} en (${wx - v.pos[0]},${wy - v.pos[1]})`); mal++; continue; }
    (huecos[lado + " → " + v.id] ||= []).push(dx ? y : x);
  }
  for (const [k, v] of Object.entries(huecos)) console.log(`ok   ${s.id.padEnd(3)} ${k.padEnd(10)} ${dxRango(v)}`);
}
function dxRango(v) { return v.length === 1 ? `en ${v[0]}` : `de ${Math.min(...v)} a ${Math.max(...v)}`; }
if (process.argv.includes("--mapa")) for (const s of S) console.log(`\n${s.id} ${s.nombre} en (${s.pos}) ${s.tam.join("×")}\n` + s.mapa.map((f) => "   " + f).join("\n"));
console.log(mal ? `${mal} problema(s)` : "todas las salas encajan");
process.exit(mal ? 1 : 0);
