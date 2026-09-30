// Hoja de sprites en grande (×5): cada cazador en sus 3 poses y cada enemigo en sus 2 cuadros.
import { abrir, guardarDataURL } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800 });
const url = await pag.evaluate(() => {
  const E = 5, filas = [];
  for (const k of Object.keys(PERSONAJES)) filas.push([0, 1, 2].map((f) => cazadorSpr(k, f, false)));
  for (const k of Object.keys(CUERPOS)) filas.push([0, 1].map((f) => enemigoSpr(k, f, false)).concat([enemigoSpr(k, 0, true)]));
  const cols = 2, celda = 36 * E, ancho = cols * 3 * celda, alto = Math.ceil(filas.length / cols) * celda;
  const c = document.createElement("canvas"); c.width = ancho; c.height = alto; const q = c.getContext("2d"); q.imageSmoothingEnabled = false;
  q.fillStyle = "#3e6624"; q.fillRect(0, 0, ancho, alto);
  filas.forEach((fila, i) => fila.forEach((s, j) => { const x = ((i % cols) * 3 + j) * celda, y = Math.floor(i / cols) * celda; q.drawImage(s, x + (celda - s.width * E) / 2, y + (celda - s.height * E) / 2, s.width * E, s.height * E); }));
  return c.toDataURL();
});
guardarDataURL(url, "hoja-sprites.png");
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores");
await nav.close();
