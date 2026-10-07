// Cruza lo que usa un juego con lo que el motor sabe hacer, ANTES de jugarlo.
//
//   node herramientas/clickteam/cobertura.mjs RUTA/juego.json [--todo]
//
// Lee las tablas COND / ACC / EXPR de motor.js y recorre cada evento de cada
// pantalla. Lo que falta, en el motor no pasa: un evento que nunca se dispara
// o una acción ignorada. Sale con código 1 si falta algo.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const aqui = fileURLToPath(new URL(".", import.meta.url));
const ctx = vm.createContext({ console, globalThis: {} });
vm.runInContext(readFileSync(aqui + "motor.js", "utf8"), ctx);
const { COND, ACC, EXPR, claseDe } = ctx.globalThis.Clickteam;

const J = JSON.parse(readFileSync(process.argv[2], "utf8"));
const O = J.objetos;
const falta = new Map(), usos = { cond: 0, acc: 0, expr: 0 };
const anotar = (tipo, clave, donde) => {
  const k = tipo + " " + clave;
  if (!falta.has(k)) falta.set(k, { n: 0, donde });
  falta.get(k).n++;
};
// Tokens que resuelve el compilador directamente (constantes, paréntesis, coma).
const DIRECTOS = new Set(["-1/0", "-1/3", "-1/23", "-1/-1", "-1/-2", "-1/-3"]);

function tokens(v, donde) {
  if (!Array.isArray(v)) return;
  if (v.length === 2 && typeof v[0] === "number" && Array.isArray(v[1]) && v[1].every((t) => Array.isArray(t))) {
    for (const t of v[1]) {
      if (t[0] === 0) continue; // operador
      usos.expr++;
      let clave;
      if (t[0] >= 0 || t[0] === -7) {
        const cl = claseDe(O[t[2]]);
        clave = EXPR[cl + "/" + t[1]] ? cl + "/" + t[1] : "obj/" + t[1];
        if (!EXPR[clave]) anotar("expresión", cl + "/" + t[1], donde);
      } else {
        clave = t[0] + "/" + t[1];
        if (!DIRECTOS.has(clave) && !EXPR[clave]) anotar("expresión", clave, donde);
      }
    }
    return;
  }
  for (const x of v) tokens(x, donde);
}

J.frames.forEach((f, fi) => {
  (f.eventos || []).forEach((ev, ei) => {
    const donde = `${f.nombre} #${ei}`;
    for (const c of ev.c) {
      usos.cond++;
      const esObj = c[0] >= 0 || c[0] === -7;
      const clave = esObj ? "obj/" + c[1] : c[0] + "/" + c[1];
      if (!COND[clave]) anotar("condición", esObj ? `${claseDe(O[c[2]])} ${clave}` : clave, donde);
      c.slice(6).forEach((p) => tokens(p[1], donde));
    }
    for (const a of ev.a) {
      usos.acc++;
      if (a[0] < 0 && a[0] !== -7) {
        if (!ACC[a[0] + "/" + a[1]]) anotar("acción", a[0] + "/" + a[1], donde);
      } else {
        const cl = claseDe(O[a[2]]);
        if (!ACC[cl + "/" + a[1]] && !ACC["obj/" + a[1]]) anotar("acción", `${cl}/${a[1]}`, donde);
      }
      a.slice(6).forEach((p) => tokens(p[1], donde));
    }
  });
});

const total = [...falta.values()].reduce((s, x) => s + x.n, 0);
console.log(`${J.app.titulo}: ${usos.cond} condiciones, ${usos.acc} acciones, ${usos.expr} tokens de expresión`);
if (!falta.size) console.log("  ✓ el motor implementa todo lo que usa el juego");
else {
  console.log(`  ✗ faltan ${falta.size} cosas distintas (${total} usos):`);
  for (const [k, v] of [...falta].sort((a, b) => b[1].n - a[1].n)) console.log(`    ${k} ×${v.n}  (p. ej. ${v.donde})`);
}
process.exit(falta.size ? 1 : 0);
