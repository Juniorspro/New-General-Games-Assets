// Saca cada Gl.programa("vs", "fs") de los .java de la app, con el archivo del que salió.
import { readFileSync, readdirSync } from "node:fs";

export function extraerProgramas() {
const dir = new URL("../src/com/juniorspro/nexoxr/", import.meta.url);
  const programas = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".java"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    let i = 0;
    while ((i = src.indexOf("Gl.programa(", i)) >= 0) {
      // hasta el paréntesis que cierra, saltando lo que está adentro de las comillas
      let j = i + "Gl.programa(".length, prof = 1, texto = "";
      while (prof > 0) {
        const c = src[j];
        if (c === '"') { let k = j + 1; while (src[k] !== '"') k += src[k] === "\\" ? 2 : 1; texto += src.slice(j, k + 1); j = k + 1; continue; }
        if (c === "/" && src[j + 1] === "/") { while (src[j] !== "\n") j++; continue; }
        if (c === "(") prof++;
        if (c === ")") prof--;
        if (prof > 0) texto += c;
        j++;
      }
      i = j;
      // los argumentos son literales de Java unidos con +: en JS se evalúan igual
      let args;
      try { args = Function(`"use strict"; return [${texto}];`)(); } catch (e) { continue; }   // (Entornos arma los suyos con constantes: los compila la vista previa)
      const oes = (s) => s.replace(/#extension GL_OES_EGL_image_external : require\n?/g, "").replace(/samplerExternalOES/g, "sampler2D");
      programas.push({ archivo: f, vs: oes(args[0]), fs: oes(args[1]) });
    }
  }
  return programas;
}
