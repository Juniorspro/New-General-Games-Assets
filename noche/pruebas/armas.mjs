// Cada arma y cada evolución, sola, contra una ronda de zombis quietos: tiene que hacer daño.
// Además: capturas de subir de nivel, del cofre (cerrado, abriendo, listo) y de una multitud.
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800, dpr: 2, tactil: true });
const foto = (n) => pag.screenshot({ path: salida(n + ".png") });
const ks = await pag.evaluate(() => [...Object.keys(ARMAS), ...Object.keys(EVOS)]);
const res = [];
for (const k of ks) {
  const r = await pag.evaluate((k) => {
    const S = window.__NC; S.nueva("antonia", "bosque", 3);
    J.armas = []; J.enemigos = []; S.dar(k); J.jug.inv = 1e9;
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, d = 20 + (i % 3) * 25; aparecer("zombi", J.jug.x + Math.cos(a) * d, J.jug.y + Math.sin(a) * d, { vel: 0 }); }
    for (const e of J.enemigos) { e.vida = e.max = 1e6; }
    for (let i = 0; i < 300; i++) { J.t = Math.min(J.t, 1); J.minuto = 0; J.spawnT = 99; J.pendientes = 0; pasoJuego(1 / 60); }
    return { k, dano: Math.round(J.armas[0].dano), proys: J.proys.length };
  }, k);
  res.push(r);
  if (["carmesi", "sagrada", "milfilos", "espiral", "celeste", "visperas", "averno", "devora", "marea", "sinmanana", "tormenta", "libro", "ajo", "agua", "hacha", "rayo"].includes(k)) { await pag.evaluate(() => window.__NC.dibujar()); await foto("arma-" + k); }
}
console.log(res.map((r) => `${r.k.padEnd(10)} daño=${r.dano}`).join("\n"));
const sin = res.filter((r) => r.dano <= 0);
console.log(sin.length ? "SIN DAÑO: " + sin.map((r) => r.k).join(", ") : "todas hacen daño");
// subir de nivel
await pag.evaluate(() => { const S = window.__NC; S.nueva("isolda", "bosque", 5); S.dar("ajo", "espinaca", "alas"); J.rerolls = 2; J.saltos = 1; J.destierros = 3; J.pendientes = 1; J.st.suerte = 5; abrirModalNivel(); S.dibujar(); });
await foto("modal-nivel");
// el cofre: arma al 8 + su pasivo = evolución
await pag.evaluate(() => { const S = window.__NC; S.nueva("antonia", "bosque", 5); for (let i = 0; i < 7; i++) darArma("latigo"); S.dar("corazon", "varita"); J.cofres = 2; S.cofre(true); pasoJuego(1 / 60); S.dibujar(); });
await foto("cofre-cerrado");
await pag.evaluate(() => { const S = window.__NC; S.tocar(W / 2, Math.round(H * 0.4) + 70); for (let i = 0; i < 50; i++) S.dibujar(); });
await foto("cofre-abriendo");
await pag.evaluate(() => { const S = window.__NC; J.modal.t = 99; pasoModal(0); S.dibujar(); });
await foto("cofre-listo");
console.log("después del cofre:", await pag.evaluate(() => J.armas.map((a) => a.k + a.nivel).join(" ")));
// una multitud de minuto 15 con un armado grande
await pag.evaluate(() => {
  const S = window.__NC; S.nueva("gaspar", "bosque", 11); J.t = 15 * 60 + 5; J.minuto = 15; J.nivel = 45; J.xpSig = xpPara(45);
  S.dar("milfilos", "sagrada", "visperas", "ajo", "rayo", "agua", "espinaca", "tomo", "candelabro", "brazal", "hechizo", "duplicador");
  for (let i = 0; i < 280; i++) aparecer(A.uno(["lobizon", "murcielagoGig", "barroVerde", "zombi", "esqueleto"]));
  J.jug.inv = 1e9; for (let i = 0; i < 200; i++) { J.pendientes = 0; pasoJuego(1 / 60); }
  S.dibujar();
});
await foto("multitud");
const m = await pag.evaluate(() => { const t = performance.now(); for (let i = 0; i < 120; i++) { J.pendientes = 0; pasoJuego(1 / 60); } const paso = (performance.now() - t) / 120; const t2 = performance.now(); for (let i = 0; i < 30; i++) window.__NC.dibujar(); return { ene: J.enemigos.length, proys: J.proys.length, paso: +paso.toFixed(2), dibujo: +((performance.now() - t2) / 30).toFixed(2) }; });
console.log("multitud:", JSON.stringify(m));
await pag.evaluate(() => { J.pausa = true; window.__NC.dibujar(); }); await foto("pausa");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 20).join("\n") : "sin errores");
await nav.close();
