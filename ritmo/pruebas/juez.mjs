// EL JUEZ, CON UN ROBOT QUE TOCA CON LA PUNTERIA QUE SE LE PIDA.
// Las ventanas son la promesa del juego: si el que toca 40 ms tarde no saca
// "perfecto", el número que dice el resultado no significa nada.
import { ch, cerrar } from "./_ch.mjs";
import { Partida, VENTANAS, ESTRELLAS } from "../js/juego.js";

/** Juega la canción entera con un desvío fijo. */
function robot(id, desvio) {
  const p = new Partida(id);
  for (const n of p.notas) {
    const t = n.t + desvio;
    p.avanzar(t);
    p.tocar(n.carril, t);
    if (n.largo) p.soltar(n.carril, t + n.largo);
  }
  p.avanzar(p.tema.duracion + 3);
  return p;
}

const perfecto = robot(5, 0);
ch("tocando justo, sale perfecto", perfecto.precision() === 1 && perfecto.cuenta.error === 0,
   `${perfecto.cuenta.perfecto} perfectas de ${perfecto.notas.length}, 3 estrellas: ${perfecto.estrellas() === 3}`);
ch("tocando justo, no falla ni una", perfecto.limpia(), `combo ${perfecto.mejorCombo}`);

// Justo adentro y justo afuera de cada ventana. El borde es lo único que se
// puede medir sin opinar.
const casos = [
  [VENTANAS.perfecto - 0.002, "perfecto"],
  [VENTANAS.perfecto + 0.002, "bien"],
  [VENTANAS.bien - 0.002, "bien"],
  [VENTANAS.bien + 0.002, "rozo"],
  [VENTANAS.rozo - 0.002, "rozo"],
  [VENTANAS.rozo + 0.004, "error"],
];
for (const [d, esperado] of casos) {
  for (const signo of [1, -1]) {
    const p = robot(3, d * signo);
    const cae = ["perfecto", "bien", "rozo", "error"].find((k) => p.cuenta[k] === p.notas.length);
    ch(`a ${(d * signo * 1000).toFixed(0)} ms cae en "${esperado}"`, cae === esperado,
       cae ? `todas ${cae}` : `mezcladas: ${JSON.stringify(p.cuenta)}`);
  }
}

// ADELANTARSE MUCHO NO ES UN ERROR. Tocar antes de que la nota exista no toca
// nada; castigarlo convierte los nervios en una bola de nieve.
const p = new Partida(2);
p.avanzar(0);
ch("tocar sin nada cerca no cuenta como error", p.tocar(0, 0) === null && p.cuenta.error === 0);

// No tocar nada en toda la canción: todas errores, 0 %, 0 estrellas.
const nulo = new Partida(2);
nulo.avanzar(nulo.tema.duracion + 3);
ch("sin tocar, todo sale error", nulo.cuenta.error === nulo.notas.length && nulo.precision() === 0,
   `${nulo.cuenta.error} errores, ${nulo.estrellas()} estrellas`);

// Las estrellas, contra los umbrales declarados.
for (const [i, u] of ESTRELLAS.entries()) {
  const justo = new Partida(2);
  // se fabrica la precisión pedida tocando perfecto una parte y nada el resto
  const n = justo.notas.length, buenas = Math.ceil(u * n);
  for (const [k, nota] of justo.notas.entries()) {
    justo.avanzar(nota.t);
    if (k < buenas) justo.tocar(nota.carril, nota.t);
  }
  justo.avanzar(justo.tema.duracion + 3);
  ch(`con ${Math.round(u * 100)} % de perfectas se ganan ${i + 1} estrellas`,
     justo.estrellas() >= i + 1, `precisión ${(justo.precision() * 100).toFixed(1)} %`);
}

// La racha se corta con un error y el multiplicador vuelve a uno.
const corte = new Partida(2);
for (const [k, n] of corte.notas.entries()) {
  corte.avanzar(n.t);
  if (k !== 5) corte.tocar(n.carril, n.t);
}
corte.avanzar(corte.tema.duracion + 3);
ch("un error corta la racha", corte.mejorCombo < corte.notas.length && corte.cuenta.error === 1,
   `mejor racha ${corte.mejorCombo} de ${corte.notas.length}`);
ch("una pasada con un error no cuenta como limpia", !corte.limpia());

cerrar();
