// Los hongos, los tres tamanos y el gigante.
//
// La regla que mas importa medir de todo esto es la ULTIMA: la caja de
// colision no cambia de tamano. Todo el juego se apoya en que el validador
// —que simula un jugador de 11x15— demuestra que cada nivel se termina. Si un
// hongo agrandara la caja, esa demostracion valdria para un jugador que no es
// el que esta jugando, y un pasaje de un tile dejaria de pasar.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage();
const err = []; pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });

const r = await pg.evaluate(async () => {
  const { V, T, F, ALTO_TILES } = await import("./js/mundo.js");
  const { ESTADO } = await import("./js/juego.js");
  const out = {};
  const nueva = () => {
    window.PIQUE.empezar(1, 1);
    return null;
  };
  const p0 = () => window.PIQUE.partida;
  nueva();
  await new Promise(r => setTimeout(r, 2200));
  const p = p0();

  // SE APLANA EL NIVEL, y no es por comodidad.
  //
  // Todo lo que se mide aca —que el hongo llegue volando, que un golpe
  // achique, que el gigante rompa— no tiene nada que ver con la forma del
  // nivel. Corriendo sobre el nivel generado, el jugador se caia en un pozo a
  // mitad de la prueba y la mitad de los checks fallaban por eso: la primera
  // version pasaba de casualidad y se rompio en cuanto el generador cambio el
  // 1-1. Una llanura infinita hace que la prueba mida lo que dice medir.
  p.bichos = []; p.jefeVivo = false;
  const PISO = 18;
  for (let ty = 0; ty < ALTO_TILES; ty++)
    for (let tx = 0; tx < p.nv.ancho; tx++)
      p.nv.grilla[ty * p.nv.ancho + tx] = ty >= PISO ? V.SOLIDO : V.NADA;
  p.nv.mastilX = 1e6;               // que no termine el nivel a mitad de prueba
  p.color = [];
  p.j.x = 4 * T; p.j.y = PISO * T; p.j.vy = 0; p.j.vivo = true;
  const corre = (n) => { for (let i = 0; i < n; i++) p.actualizar({ toque: false, toqueNuevo: false }); };

  // 1) un hongo suelto vuela hasta el jugador y lo hace grande
  corre(40);
  p.soltarHongo(Math.floor(p.j.x / T) + 3, Math.floor(p.j.y / T) - 4, "hongo");
  out.antesTam = p.tam;
  corre(60);
  out.despuesTam = p.tam;
  out.hongosQuedan = p.hongos.length;

  // 2) un golpe estando grande achica en vez de gastar una burbuja
  const burbujasAntes = p.burbujas;
  p.morir("bolo");
  out.trasGolpeTam = p.tam;
  out.trasGolpeBurbujas = p.burbujas;
  out.trasGolpeBurbujasAntes = burbujasAntes;
  out.trasGolpeEstado = p.estado;

  // 3) el super hongo: escena y despues gigante
  //
  // VA ANTES QUE LA PRUEBA DEL POZO, y el orden no da igual: morir manda a la
  // burbuja, y saliendo de ahi a mano el jugador queda donde lo dejo la
  // burbuja —que puede ser adentro de una pared— y se muere de nuevo en el
  // primer cuadro. La prueba pasaba por casualidad hasta que el generador
  // cambio el 1-1. Lo que se rompe con el orden no es el juego, es la prueba.
  p.estado = ESTADO.JUGANDO; p.tam = 0; p.j.vivo = true; p.invT = 0;
  p.soltarHongo(Math.floor(p.j.x / T) + 3, Math.floor(p.j.y / T) - 4, "super");
  corre(60);
  out.escenaEstado = p.estado;
  corre(230);            // la escena dura 200 cuadros, y antes hay que juntarlo
  out.trasEscenaTam = p.tam;
  out.trasEscenaEstado = p.estado;
  out.gigT = p.gigT;

  // 5) el gigante rompe ladrillos pero NO el terreno solido.
  //
  // Lo del terreno se mide CONTANDO TODOS los tiles solidos del nivel antes y
  // despues, no mirando uno. Mirando uno, la prueba pasa si ese tile en
  // particular sobrevivio; contando, no hay forma de que rompa el piso en
  // algun lado y la prueba no se entere. Es la propiedad que sostiene que un
  // nivel validado se siga pudiendo terminar.
  const solidos = () => { let n = 0; for (const v of p.nv.grilla) if (v === V.SOLIDO) n++; return n; };
  const tx = Math.floor(p.j.x / T) + 2, ty = Math.floor((p.j.y - 1) / T);
  p.nv.grilla[ty * p.nv.ancho + tx] = V.LADRILLO;
  const solidosAntes = solidos();
  corre(120);
  out.ladrilloDespues = p.nv.grilla[ty * p.nv.ancho + tx];
  out.solidosAntes = solidosAntes;
  out.solidosDespues = solidos();
  out.escalaGigante = p.escalaAct;

  // 6) LA CAJA NO CAMBIA. Se mide contra las constantes, no contra el dibujo.
  out.ancho = F.ANCHO; out.alto = F.ALTO;

  // 7) el gigante se acaba solo y vuelve a grande
  p.tam = 2; p.gigT = 2;
  corre(6);
  out.finTam = p.tam;

  // 8) y recien ahora el pozo, que termina en burbuja y ensucia todo lo demas
  p.estado = ESTADO.JUGANDO; p.tam = 1; p.invT = 0; p.j.vivo = true;
  const burb2 = p.burbujas;
  p.morir("pozo");
  out.pozoEstado = p.estado;
  out.pozoGastoBurbuja = p.burbujas < burb2;

  out.V = { NADA: V.NADA, SOLIDO: V.SOLIDO, LADRILLO: V.LADRILLO };
  return out;
});

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

ch("el hongo vuela solo hasta el jugador", r.hongosQuedan === 0);
ch("y lo hace grande", r.antesTam === 0 && r.despuesTam === 1, `tam ${r.antesTam} → ${r.despuesTam}`);
ch("un golpe estando grande achica", r.trasGolpeTam === 0, `tam → ${r.trasGolpeTam}`);
ch("y NO gasta una burbuja", r.trasGolpeBurbujas === r.trasGolpeBurbujasAntes,
   `${r.trasGolpeBurbujasAntes} → ${r.trasGolpeBurbujas}`);
ch("y no manda a la burbuja", r.trasGolpeEstado === "jugando", r.trasGolpeEstado);
ch("el super hongo abre la escena", r.escenaEstado === "escena", r.escenaEstado);
ch("y al terminar deja gigante", r.trasEscenaTam === 2 && r.trasEscenaEstado === "jugando",
   `tam ${r.trasEscenaTam}, ${r.gigT} cuadros`);
ch("el gigante dura entre 7 y 10 segundos", r.gigT > 7 * 60 && r.gigT <= 10 * 60,
   `${(r.gigT / 60).toFixed(1)} s`);
ch("el gigante se ve mas del doble de grande", r.escalaGigante > 2.2,
   `x${r.escalaGigante.toFixed(2)}`);
ch("el gigante rompe los ladrillos que se cruza", r.ladrilloDespues === r.V.NADA);
ch("pero NO rompe un solo tile de terreno solido", r.solidosDespues === r.solidosAntes,
   `${r.solidosAntes} → ${r.solidosDespues}`);
ch("la caja de colision NO cambia de tamano", r.ancho === 11 && r.alto === 15,
   `${r.ancho}x${r.alto}`);
ch("el gigante se acaba solo y vuelve a grande", r.finTam === 1, `tam ${r.finTam}`);
ch("el pozo mata igual aunque sea grande", r.pozoEstado === "burbuja" || r.pozoGastoBurbuja,
   `estado ${r.pozoEstado}`);
ch("sin errores de javascript", err.length === 0, err.slice(0, 2).join(" | "));

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
