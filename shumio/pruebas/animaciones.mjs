// La animación de levantar un objeto (cuadro por cuadro) y lo que se empuja cuando no se puede agarrar.
import { abrir, salida, guardarDataURL } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, tactil: false });
// 1) levantar: agarra un objeto de un pedestal y se fotografía cada tanto
const hoja = await pag.evaluate(() => {
  const S = window.__SH; S.nueva(4); const J = S.juego(), j = J.jug; J.rotulos = []; J.congelado = 1e9;
  const c = pedestal(j.x, j.y - 26, "rayo"); J.sala.cosas.push(c); tomarObjeto(c);
  const fotos = [], cuadros = [0, 3, 6, 9, 14, 24, 40, 47, 49];
  const lienzo = lienzoNuevo(cuadros.length * 44, 64), g = lienzo.getContext("2d");
  let e = 0;
  for (const k of cuadros) {
    while (e < k) { j.tSostiene--; e++; }
    const t = lienzoNuevo(SALA_W, SALA_H), gt = t.getContext("2d"); gt.drawImage(J.sala.fondo, 0, 0); dibujarJugador(gt, j);
    g.drawImage(t, j.x - 22, j.y - 54, 44, 64, fotos.length * 44, 0, 44, 64); fotos.push(k);
  }
  const z = 4, o = lienzoNuevo(lienzo.width * z, lienzo.height * z), go = o.getContext("2d"); go.imageSmoothingEnabled = false; go.drawImage(lienzo, 0, 0, o.width, o.height);
  return o.toDataURL();
});
guardarDataURL(hoja, "anim-levantar.png");
// 2) empujar: con la vida llena, un corazón rojo delante; Shumio camina contra él
const emp = await pag.evaluate(() => {
  const S = window.__SH; S.nueva(4); const J = S.juego(), j = J.jug; J.congelado = 0;
  const c = recogible("corazon", j.x + 20, j.y, "rojo"); J.sala.cosas.push(c);
  const x0 = c.x, minimo = [];
  for (let i = 0; i < 50; i++) { IN.teclas.add("der"); S.paso(); minimo.push(Math.hypot(c.x - j.x, c.y - j.y)); }
  IN.teclas.delete("der");
  return { sigue: J.sala.cosas.includes(c), movio: +(c.x - x0).toFixed(1), distanciaMinima: +Math.min(...minimo).toFixed(1), vida: j.vida + "/" + j.cont };
});
console.log("corazón con la vida llena:", emp, emp.sigue && emp.movio > 10 && emp.distanciaMinima >= 8 ? "→ se empuja" : "→ NO SE EMPUJA");
// 3) si falta vida, el mismo corazón se agarra
const agarra = await pag.evaluate(() => {
  const S = window.__SH; S.nueva(4); const J = S.juego(), j = J.jug; j.vida = 4;
  const c = recogible("corazon", j.x + 20, j.y, "rojo"); J.sala.cosas.push(c);
  for (let i = 0; i < 40; i++) { IN.teclas.add("der"); S.paso(); }
  IN.teclas.delete("der");
  return { sigue: J.sala.cosas.includes(c), vida: j.vida + "/" + j.cont };
});
console.log("corazón con vida faltante:", agarra, !agarra.sigue ? "→ se agarra" : "→ NO SE AGARRA");
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores");
await nav.close();
