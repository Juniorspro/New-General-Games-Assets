// El pozo: que se pueda bajar, siempre.
//
// Un juego infinito tiene una falla que no se ve nunca mirando: cada tanto
// pone dos huecos tan separados que no se llega de uno al otro. El jugador no
// ve un error, ve que perdió — y culpa a sus dedos. Acá se comprueban las dos
// cosas por separado: que CADA PAR de huecos esté dentro de lo que se puede
// correr en el tiempo que dura la caída entre ellos (cien mil metros, a mano,
// con la misma cuenta que usa el generador pero sin su margen), y que un
// piloto tonto baje de verdad (jugándolo, con la física real).
import { Pozo } from "../js/pozo.js";
import { Partida } from "../js/juego.js";
import { F } from "../js/mundo.js";
import { bajar, bajarConDedo } from "./_piloto.mjs";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// --- alcanzable por construcción ----------------------------------------
let filas = 0, imposibles = [], angostasPegadas = 0, angostas = 0, estrecho = 1e9;
for (let s = 1; s <= 8; s++) {
  const p = new Pozo(s * 7919);
  p.generarHasta(100000);
  for (let i = 1; i < p.filas.length; i++) {
    const a = p.filas[i - 1], b = p.filas[i];
    filas++;
    if (b.angosto) angostas++;
    // Lo que se puede correr cayendo de a hasta b. Se usa la velocidad con la
    // que se cruza b: una fila angosta se cruza CERRADO, al triple de
    // velocidad y con un tercio del tiempo.
    const rapido = b.angosto || a.angosto;
    const vy = rapido ? F.TERMINAL_CERRADO : F.TERMINAL_ABIERTO;
    const vx = rapido ? F.VX_CERRADO : F.VX_ABIERTO;
    const puede = vx * ((b.y - a.y) / vy);
    if (Math.abs(b.x - a.x) > puede)
      imposibles.push(`${Math.round(b.y / 100)}m: hay que correr ${Math.round(Math.abs(b.x - a.x))} y se puede ${Math.round(puede)}`);
    if (a.angosto && b.angosto) angostasPegadas++;
    estrecho = Math.min(estrecho, b.hueco);
  }
}
ch(`las ${filas} filas de 8 pozos distintos se alcanzan una desde la otra`,
   imposibles.length === 0, imposibles.slice(0, 2).join(" · "));
ch("ninguna fila angosta viene pegada a otra angosta", angostasPegadas === 0,
   `${angostas} angostas en total`);
ch("ningún hueco baja del ancho del cuerpo más un margen",
   estrecho > F.CUERPO_AN + 6, `el más estrecho es de ${estrecho} px, el cuerpo mide ${F.CUERPO_AN}`);

// Una fila común tiene que poder pasarse SIN cerrar: si no, el paraguas
// abierto no serviría para nada y el juego sería apretar todo el tiempo.
let comunesAngostas = 0;
{
  const p = new Pozo(31337); p.generarHasta(100000);
  for (const f of p.filas) if (!f.angosto && f.hueco < F.ANCHO_ABIERTO + 8) comunesAngostas++;
}
ch("toda fila común se pasa con el paraguas abierto", comunesAngostas === 0,
   `${comunesAngostas} no`);

// --- y que se pueda jugar ------------------------------------------------
const corridas = [];
for (let s = 1; s <= 20; s++) corridas.push(bajar(Partida, s, 20000));
const metros = corridas.map((c) => c.metros);
const peor = Math.min(...metros), prom = Math.round(metros.reduce((a, b) => a + b) / metros.length);
ch("el piloto automático baja más de 250 m en las 20 semillas", peor >= 250,
   `el peor bajó ${peor} m, promedio ${prom} m`);

// Y que NO sea infinito para un robot tonto: un juego sin fin que un piloto de
// diez líneas baja para siempre no tiene curva de dificultad.
ch("y ninguna corrida es eterna: la dificultad sube de verdad",
   corridas.every((c) => !c.vivo), `${corridas.filter((c) => c.vivo).length} sobrevivieron al tope`);

// Y CON EL CONTROL DE VERDAD, que es otra cosa. Arriba el robot puede cerrar
// el paraguas y moverse por separado: eso prueba que los huecos se alcancen.
// Acá maneja con UN dedo, con la misma máquina que `main.js` — arrastrar abre
// el paraguas y maniobra, el dedo quieto lo cierra y hace caer— y eso prueba
// algo más difícil: que el pozo se baje con el control que tiene el jugador.
// Es la prueba que más veces atrapó un cambio de control que se sentía bien
// mirando el gameplay y hacía el juego imposible dos filas más abajo.
{
  const conDedo = [];
  for (let s = 1; s <= 30; s++) conDedo.push(bajarConDedo(Partida, s, 20000).metros);
  const peorD = Math.min(...conDedo);
  const promD = Math.round(conDedo.reduce((a, b) => a + b) / conDedo.length);
  ch("con UN dedo —el control de verdad— el robot baja más de 200 m siempre",
     peorD >= 200, `el peor bajó ${peorD} m, promedio ${promD} m`);
}

// El paraguas tiene que servir: cerrado se baja mucho más rápido.
{
  const lento = new Partida(5), rapido = new Partida(5);
  for (let i = 0; i < 240; i++) { lento.paso({ cerrar: false, mover: 0 }); }
  for (let i = 0; i < 240; i++) { rapido.paso({ cerrar: true, mover: 0 }); }
  ch("cerrando el paraguas se cae mucho más rápido",
     rapido.y > lento.y * 2.4, `${Math.round(lento.y)} px contra ${Math.round(rapido.y)} px en 4 segundos`);
}

console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
