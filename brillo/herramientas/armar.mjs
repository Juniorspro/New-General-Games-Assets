// Arma BRILLO en un solo HTML que abre con doble clic y anda sin internet.
//
//     node brillo/herramientas/armar.mjs [--dev]
//
// Usa el esbuild de node_modules (el de la raíz o, en el repo, el de bosque/).
// El CSS entra en <!--CSS--> y el código, empaquetado en un IIFE, en <!--JS-->.
// Con --dev no se minifica (para leer los errores).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAIZ = path.resolve(AQUI, "..");
/* los módulos: los de esta carpeta, los de la raíz (npm install en la raíz del
   zip) o los de bosque/ (en el repo, ya instalados) */
const MODULOS = [path.join(AQUI, "node_modules"), path.join(RAIZ, "node_modules"), path.join(RAIZ, "bosque/node_modules")].find((d) => fs.existsSync(path.join(d, "esbuild")));
if (!MODULOS) { console.error("Faltan esbuild: corré npm install en la carpeta de arriba (ver LEEME.md)."); process.exit(1); }
const require = createRequire(path.join(MODULOS, "x.js"));
const esbuild = require("esbuild");
const dev = process.argv.includes("--dev");

/* LAS CANCIONES GRABADAS (musica/*.mp3, las que manda quien pide) son de
   otros (Nintendo) y el repo es público: el brillo.html que se commitea va sin
   ellas, con los temas sintetizados. Si los MP3 están (no se commitean), sale
   además brillo-con-canciones.html, que es el que se le entrega. Los MP3
   entran como bytes (loader binary) por un módulo que se arma acá. */
const MUSICA = path.join(AQUI, "musica");
function canciones(conCanciones) {
  return {
    name: "canciones",
    setup(b) {
      b.onResolve({ filter: /^canciones-datos$/ }, () => ({ path: "canciones-datos", namespace: "canciones" }));
      b.onLoad({ filter: /.*/, namespace: "canciones" }, () => {
        const lista = fs.existsSync(path.join(MUSICA, "canciones.json")) ? JSON.parse(fs.readFileSync(path.join(MUSICA, "canciones.json"), "utf8")) : {};
        const hay = conCanciones ? Object.entries(lista).filter(([, c]) => fs.existsSync(path.join(MUSICA, c.archivo))) : [];
        const imp = hay.map(([, c], i) => `import d${i} from ${JSON.stringify(path.join(MUSICA, c.archivo))};`).join("\n");
        const exp = hay.map(([t, c], i) => `${JSON.stringify(t)}: { ...${JSON.stringify(c)}, datos: d${i} }`).join(",\n");
        return { contents: `${imp}\nexport default {\n${exp}\n};`, resolveDir: MUSICA, loader: "js" };
      });
    },
  };
}
async function armar(conCanciones, destino) {
  const r = await esbuild.build({
    entryPoints: [path.join(AQUI, "js/main.js")],
    bundle: true, minify: !dev, format: "iife", target: "es2020", write: false,
    legalComments: "none", metafile: true,
    loader: { ".mp3": "binary" }, plugins: [canciones(conCanciones)],
  });
  let codigo = r.outputFiles[0].text;
  /* un "</script" adentro del código cerraría la etiqueta a mitad del archivo */
  codigo = codigo.replace(/<\/script/gi, "<\\/script");
  const css = fs.readFileSync(path.join(AQUI, "brillo.css"), "utf8");
  let html = fs.readFileSync(path.join(AQUI, "index.html"), "utf8");
  if (!html.includes("<!--CSS-->") || !html.includes("<!--JS-->")) throw new Error("index.html necesita <!--CSS--> y <!--JS-->");
  html = html.replace("<!--CSS-->", () => `<style>\n${css}\n</style>`).replace("<!--JS-->", () => `<script>\n${codigo}\n</script>`);
  fs.writeFileSync(destino, html);
  const mp3 = Object.keys(r.metafile.inputs).filter((f) => f.endsWith(".mp3")).length;
  const propio = Object.values(r.metafile.inputs).reduce((s, v) => s + v.bytes, 0);
  console.log(`${path.relative(RAIZ, destino)}: ${(fs.statSync(destino).size / 1024).toFixed(0)} KB · código ${(propio / 1024).toFixed(0)} KB · ${mp3} canciones grabadas${dev ? " · sin minificar" : ""}`);
  return mp3;
}
await armar(false, path.join(AQUI, "brillo.html"));
const hayMp3 = fs.existsSync(MUSICA) && fs.readdirSync(MUSICA).some((f) => f.endsWith(".mp3"));
if (hayMp3) await armar(true, path.join(AQUI, "brillo-con-canciones.html"));
