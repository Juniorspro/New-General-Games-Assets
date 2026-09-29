// Prueba de los objetos: cada uno solo y las sinergias famosas, disparando en una sala con
// enemigos; tiene que andar sin errores, y cada arma tiene que hacer daño. Saca capturas.
import { abrir, guardarDataURL, salida } from "./comun.mjs";

const COMBOS = [
  ["rayo"], ["rayo", "laser"], ["rayo", "tercerOjo"], ["rayo", "ipecac"], ["rayo", "choco"], ["rayo", "soja"], ["rayo", "pulmon"],
  ["laser"], ["laser", "cuadruple"], ["laser", "hemo"], ["anillo"], ["anillo", "rayo"], ["anillo", "ludovico"],
  ["feto"], ["feto", "ipecac"], ["feto", "rayo"], ["feto", "laser"], ["feto", "polifemo"], ["epico"], ["epico", "laser"],
  ["ludovico"], ["ludovico", "laser"], ["ludovico", "rayo"], ["cuchillo"], ["cuchillo", "rayo"], ["cuchillo", "tercerOjo"],
  ["ipecac"], ["hemo"], ["choco"], ["pulmon"], ["soja", "tercerOjo"], ["almendra"], ["polifemo", "veinte"],
  ["grillo", "parasito", "fractura"], ["planeta", "carbon"], ["espejo", "proptosis"], ["bucle", "velo"], ["antigrav"],
  ["raizElectrica", "luzSanta", "amorDuro", "eutanasia"], ["ojoBelial", "cabezaDivina"], ["escarcha", "materiaOscura", "lentesAbuela"],
  ["hermanito", "hermanita", "bebeDemonio", "roboBebe", "incubo", "gordito", "cerebroPodrido", "sanguijuela", "bolsaCentavos"],
  ["moscaAmiga", "admiradora", "coronaMoscas", "angelGuardian", "bolaPelos"],
  ["sombreroRojo", "setaPicante", "hongoGigante"], ["luzSanta", "aureola", "rosario"], ["cuchillo", "lentesAbuela", "perfumeAbuela"],
  ["hormonas", "bolaVeloz", "virus"], ["libroSetas", "necronomicon"], ["gusanoOnda"], ["gusanoAnillo"], ["gusanoGancho"],
];

const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, tactil: false });
await pag.evaluate(() => { window.__SH.nueva(7); });
const resultados = [];
for (const combo of COMBOS) {
  const r = await pag.evaluate((combo) => {
    const S = window.__SH;
    S.nueva(7); S.sala("normal");
    const J = S.juego(), info = S.dar(...combo);
    const vida0 = J.enemigos.reduce((s, e) => s + e.vida, 0), n0 = J.enemigos.length;
    J.jug.inv = 99999;
    // mira hacia el enemigo más cercano y llora un rato (con cortes, para las armas que se cargan)
    // apunta cada cuadro desde lo que se maneja (la lágrima mansa, la mira del misil o Shumio)
    for (let k = 0; k < 5; k++) {
      for (let i = 0; i < 170; i++) {
        const e = J.enemigos[0], o = J.ludo || J.mira || J.jug;
        let dx = 1, dy = 0;
        if (e) { const ddx = e.x - o.x, ddy = e.y - (o === J.jug ? J.jug.y : o.y); if (Math.abs(ddx) > Math.abs(ddy)) { dx = Math.sign(ddx); dy = 0; } else { dx = 0; dy = Math.sign(ddy); } }
        if (J.ludo || J.mira) { const d = e ? Math.hypot(e.x - o.x, e.y - o.y) : 99; if (d < 4) { dx = 0; dy = 0; } }
        S.tirar(dx || (J.mira ? 0 : 1), dy, 1); if (J.mira && !dx && !dy) S.tirar(0, 0, 0);
        S.paso();
      }
      for (let i = 0; i < 25; i++) S.paso();
    }
    const vida1 = J.enemigos.reduce((s, e) => s + Math.max(0, e.vida), 0);
    return { combo, arma: info.arma, n: info.n, fr: +info.fr.toFixed(2), dano: +info.dano.toFixed(2), antes: +vida0.toFixed(1), despues: +vida1.toFixed(1), enemigos: [n0, J.enemigos.length], transf: J.jug.transf.slice() };
  }, combo);
  resultados.push(r);
  const FOTOS = ["rayo,laser", "rayo,tercerOjo", "anillo", "feto,rayo", "ludovico,laser", "cuchillo,rayo", "epico", "hemo", "hermanito,hermanita,bebeDemonio,roboBebe,incubo,gordito,cerebroPodrido,sanguijuela,bolsaCentavos", "planeta,carbon", "grillo,parasito,fractura", "moscaAmiga,admiradora,coronaMoscas,angelGuardian,bolaPelos"];
  if (FOTOS.includes(combo.join(","))) {
    // cargar (o mantener) y soltar: la foto sale unos cuadros después del disparo
    await pag.evaluate((combo) => {
      const S = window.__SH; S.nueva(7); S.sala("normal"); S.dar(...combo); const J = S.juego(); J.jug.inv = 99999; J.rotulos = [];
      const carga = ["rayo", "anillo", "cuchillo"].includes(J.jug.arma) ? Math.ceil(60 / J.jug.fr * (J.jug.arma === "rayo" ? 1 : 3)) + 4 : 30;
      S.tirar(1, 0, carga); for (let i = 0; i < carga + (J.jug.arma === "epico" ? 100 : 7); i++) S.paso();
      J.jug.inv = 0; S.dibujar();
    }, combo);
    await pag.screenshot({ path: salida(`obj-${combo[0]}${combo[1] ? "-" + combo[1] : ""}.png`) });
  }
}
guardarDataURL(await pag.evaluate(() => window.__SH.hojaDe("objetos")), "hoja-objetos.png");
guardarDataURL(await pag.evaluate(() => window.__SH.hojaDe("armas")), "hoja-armas.png");
console.log(await pag.evaluate(() => window.__SH.cuenta()));
for (const r of resultados) console.log(`${r.combo.join("+").padEnd(44)} ${r.arma.padEnd(9)} n=${r.n} fr=${r.fr} daño=${r.dano} vida ${r.antes}→${r.despues} enemigos ${r.enemigos.join("→")} ${r.transf.join(",")}`);
const sinDano = resultados.filter((r) => r.antes > 0 && r.despues >= r.antes && r.enemigos[1] >= r.enemigos[0]);
console.log(sinDano.length ? "SIN DAÑO: " + sinDano.map((r) => r.combo.join("+")).join(" | ") : "todas hacen daño");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].join("\n") : "sin errores");
await nav.close();

// los corazones negros: al romperse uno entero, 40 a todos los enemigos (80 con la página perdida)
{
  const { nav, pag, errores } = await abrir({ tactil: false });
  const r = await pag.evaluate(() => {
    const S = window.__SH, out = {};
    for (const pagina of [false, true]) {
      S.nueva(7); S.sala("normal"); const J = S.juego(), j = J.jug;
      if (pagina) S.dar("paginaPerdida");
      darNegras(j, 2); darEsporas(j, 1);
      for (const e of J.enemigos) { e.vida = e.max = 500; }
      const antes = J.enemigos.map((e) => e.vida);
      herirJugador(j, 1, "prueba"); j.inv = 0; herirJugador(j, 2, "prueba");
      out[pagina ? "conPagina" : "sinPagina"] = { almas: j.almas.join(""), dano: antes.map((v, i) => +(v - J.enemigos[i].vida).toFixed(1)) };
    }
    return out;
  });
  console.log("corazón negro:", JSON.stringify(r));
  const ok = r.sinPagina.dano.every((d) => d >= 40) && r.conPagina.dano.every((d) => d >= 80);
  console.log(ok ? "el corazón negro explota como en el original" : "EL CORAZÓN NEGRO NO EXPLOTA BIEN");
  console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores");
  await nav.close();
}
