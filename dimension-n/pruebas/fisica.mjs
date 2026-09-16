// La física, que es el juego entero.
//
// Un ragdoll se rompe de formas que no se ven en una captura: un hueso que se
// estira un 30% queda "casi bien" en pantalla y hace que el muñeco se vaya
// desarmando a lo largo de un minuto. Y una NaN suelta no tira excepción: el
// cuerpo simplemente desaparece. Todo eso se mide acá, sin navegador, porque
// la física no necesita uno — y por eso también se puede medir.
import { TOPE_CAIDA, punto, palo, integrar, resolver } from "../js/verlet.js";
import { crearCuerpo, ovillar, RILO } from "../js/cuerpo.js";
import { construirNivel } from "../js/nivel.js";
import { Partida } from "../js/juego.js";
import { piloto } from "./_piloto.mjs";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

const nv = () => construirNivel();

// --- que no explote ------------------------------------------------------
{
  const p = new Partida(nv());
  // SE MIDE EN PÍXELES, no en porcentaje, y es una corrección de la prueba:
  // el guardapolvo de Rilo le tapa la pierna hasta la rodilla, así que su
  // canilla mide OCHO píxeles. Un 23% sobre ocho píxeles son menos de dos, que
  // nadie ve; el mismo 23% sobre el fémur de Tito serían tres y pico y sí se
  // notaría. Lo que hace que un muñeco se vea desarmado es el hueco en
  // píxeles, no la proporción — la prueba tiene que medir eso.
  //
  // Y se mide el ESTIRÓN aparte de la compresión: un hueso estirado es el
  // muñeco viniéndose abajo; comprimido es el ovillo, que es una pose y tiene
  // que poder.
  let estiron = 0, estironPc = 0, compresion = 0, cual = "";
  for (let i = 0; i < 6000; i++) {
    // Se lo zarandea a propósito: dirección al azar y bolita a destiempo, que
    // es lo peor que le puede hacer un jugador.
    p.paso({ mover: Math.sin(i / 7) + Math.sin(i / 3) * 0.5, bolita: i % 37 < 9 });
    for (const s of p.palos) {
      if (s.tipo !== "hueso") continue;
      const d = Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y);
      if (d - s.largo > estiron) {
        estiron = d - s.largo;
        estironPc = (d - s.largo) / s.largo;
        cual = `${s.a.nombre}–${s.b.nombre} de ${s.largo.toFixed(1)} px`;
      }
      compresion = Math.max(compresion, s.largo - d);
    }
  }
  const finito = p.puntos.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
  ch("6000 cuadros de maltrato y ningún punto se va a infinito", finito);
  // Dos píxeles y medio es lo que se empieza a ver: por debajo de eso, la
  // separación queda tapada por el solape con el que se dibujan las piezas.
  ch("ningún hueso se separa más de 2,5 px", estiron < 2.5,
     `el peor es ${cual}: ${estiron.toFixed(2)} px (${(estironPc * 100).toFixed(0)}%)`);
  ch("y la compresión se queda en lo que hace el ovillo", compresion < 4.5,
     `${compresion.toFixed(2)} px`);
  ch("nadie se fue del pasillo", p.puntos.every((q) => q.x > -40 && q.x < 400),
     `x entre ${Math.min(...p.puntos.map((q) => q.x)).toFixed(0)} y ${Math.max(...p.puntos.map((q) => q.x)).toFixed(0)}`);
}

// --- la soga tira, no empuja --------------------------------------------
{
  const p = new Partida(nv());
  let peor = 0, floja = 0;
  for (let i = 0; i < 3000; i++) {
    p.paso(piloto(p));
    const d = Math.hypot(p.soga.a.x - p.soga.b.x, p.soga.a.y - p.soga.b.y);
    peor = Math.max(peor, d / p.soga.largo);
    if (d < p.soga.largo * 0.75) floja++;
  }
  ch("la soga no se estira: Tito queda atado", peor < 1.08,
     `lo más que se estiró fue ${(peor * 100 - 100).toFixed(1)}%`);
  ch("y a veces queda floja, o sea que no es una barra", floja > 60,
     `${floja} cuadros de 3000 con la soga floja`);
}

// --- la velocidad de caída tiene tope -----------------------------------
{
  const c = crearCuerpo(180, 0, RILO);
  for (let i = 0; i < 400; i++) integrar(c.puntos), resolver(c.palos, 2);
  const v = c.p.pecho.y - c.p.pecho.py;
  ch("cayendo libre no pasa el tope de velocidad", v <= TOPE_CAIDA + 0.001,
     `${v.toFixed(2)} px por cuadro, tope ${TOPE_CAIDA}`);
  ch("y llega al tope, no se queda lento", v > TOPE_CAIDA - 0.3, `${v.toFixed(2)}`);
}

// --- hacerse bolita sirve -----------------------------------------------
// La misma caída, dos veces, con lo único distinto siendo la bolita.
{
  // EL MISMO GOLPE, dos veces. Dejarlo caer dos veces no sirve de prueba: el
  // ovillo le cambia la forma y termina pegando contra otra cosa, así que se
  // estarían comparando dos golpes distintos. Acá se le pasa exactamente la
  // misma velocidad contra la misma parte y lo único que cambia es la bolita.
  const p = new Partida(nv());
  const cobrar = (bol, parte) => {
    p.estado = "jugando"; p.integridad = 100; p.espera = 0; p.peor = null;
    p.rilo.bolita = bol;
    p.pegar(p.rilo.p[parte], 14);
    p.cobrar();
    return 100 - p.integridad;
  };
  const suelto = cobrar(0, "cabeza"), ovillo = cobrar(1, "cabeza");
  ch("hacerse bolita descuenta dos tercios del golpe",
     ovillo < suelto * 0.4 && ovillo > suelto * 0.28,
     `suelto ${suelto.toFixed(1)} · bolita ${ovillo.toFixed(1)}`);
  ch("pero no lo anula: no es un escudo", ovillo > 2, `${ovillo.toFixed(1)} de daño`);
  const pie = cobrar(0, "pieIzq");
  ch("caer de cabeza cuesta mucho más que caer de pie",
     suelto > pie * 2.5, `cabeza ${suelto.toFixed(1)} · pie ${pie.toFixed(1)}`);
  // Y un golpe flojo no cobra nada: si cobrara, bajar entero sería imposible.
  p.estado = "jugando"; p.integridad = 100; p.espera = 0; p.peor = null;
  p.rilo.bolita = 0; p.pegar(p.rilo.p.pecho, 5); p.cobrar();
  ch("un roce por debajo del umbral no cuesta nada", p.integridad === 100,
     `quedó en ${p.integridad}`);
}

// --- el ovillo encoge de verdad -----------------------------------------
{
  const c = crearCuerpo(180, 0, RILO);
  const alto = () => Math.max(...c.puntos.map((q) => q.y)) - Math.min(...c.puntos.map((q) => q.y));
  for (let i = 0; i < 60; i++) { ovillar(c, 0); integrar(c.puntos, 0); resolver(c.palos); }
  const suelto = alto();
  for (let i = 0; i < 90; i++) { ovillar(c, 1); integrar(c.puntos, 0); resolver(c.palos); }
  const ovillo = alto();
  ch("el cuerpo hecho bolita ocupa bastante menos", ovillo < suelto * 0.55,
     `${suelto.toFixed(0)} px → ${ovillo.toFixed(0)} px`);
}

// --- la física es determinista ------------------------------------------
// Sin esto no se puede aprender un tramo: el mismo salto daría distinto cada
// vez y repetir no serviría de nada.
{
  const correr = () => {
    const p = new Partida(nv());
    for (let i = 0; i < 1500; i++) p.paso({ mover: Math.sin(i / 11), bolita: i % 50 < 12 });
    return p.puntos.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`).join("|");
  };
  ch("dos corridas idénticas dan exactamente lo mismo", correr() === correr());
}

// --- lo que cuesta un cuadro --------------------------------------------
{
  const p = new Partida(nv());
  for (let i = 0; i < 300; i++) p.paso(piloto(p));   // calentar
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 3000; i++) p.paso(piloto(p));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 3000;
  ch("un cuadro de física entra holgado en el presupuesto de 16,6 ms",
     ms < 1.2, `${ms.toFixed(3)} ms · margen ${(16.6 / ms).toFixed(0)}x`);
}

console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
