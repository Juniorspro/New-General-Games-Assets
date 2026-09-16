// El pozo: siete capitulos, uno atras del otro, y la historia que los cuenta.
//
// EL NIVEL ES UNO SOLO Y ES SIEMPRE EL MISMO. La semilla esta escrita aca
// adentro, asi que "la fabrica de jarabe" tiene siempre las mismas aspas en el
// mismo lugar: se puede aprender, que es lo unico que hace que valga la pena
// repetir un tramo. Lo que se genera no es la sorpresa, es el tedio de escribir
// doscientas repisas a mano.
//
// LA GARANTIA DE QUE SE PUEDE PASAR. Cada fila de obstaculos se arma alrededor
// de un HUECO que se elige primero: las repisas se ponen a los costados del
// hueco y nunca encima. Por construccion no existe una fila tapada, y
// pruebas/nivel.mjs lo verifica fila por fila en vez de creerme.

export const ANCHO = 360;

// Un generador chico y propio. Math.random no sirve: el nivel tiene que ser
// el mismo hoy y el mes que viene.
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const CAPITULOS = [
  { nombre: "El garaje", alto: 1300, tipo: "simple",
    cielo: ["#161c2b", "#28324d"], pared: "#3c4866",
    dice: [["Rilo", "Bueno Tito, el portal quedó en el piso. Saltá."],
           ["Tito", "¿Y qué hay abajo, abuelo?"],
           ["Rilo", "Sí."]] },
  { nombre: "Las cañerías", alto: 1500, tipo: "repisas",
    cielo: ["#10201e", "#1d3a38"], pared: "#2f5c58",
    dice: [["Tito", "¡Esto son caños! ¡Caños de qué!"],
           ["Rilo", "De la dimensión Ñ. Acá el agua va para arriba."],
           ["Tito", "Eso no contesta nada."]] },
  { nombre: "La fábrica de jarabe", alto: 1600, tipo: "aspas",
    cielo: ["#2a1020", "#4d1f38"], pared: "#75304f",
    dice: [["Rilo", "No toques las aspas."],
           ["Tito", "¿Y si me tocan ellas a mí?"],
           ["Rilo", "Ahí sí es problema tuyo."]] },
  { nombre: "El vacío", alto: 1500, tipo: "islas",
    cielo: ["#0a0f22", "#141d3d"], pared: "#243055",
    dice: [["Tito", "No hay paredes. ¡No hay paredes!"],
           ["Rilo", "Apuntá bien entonces."]] },
  { nombre: "La panza", alto: 1500, tipo: "gelatina",
    cielo: ["#2b1a10", "#54331f"], pared: "#7a4c2c",
    dice: [["Tito", "Abuelo… esto late."],
           ["Rilo", "Es una panza, Tito. Tarde o temprano pasa."]] },
  { nombre: "El basural de dimensiones", alto: 1600, tipo: "mezcla",
    cielo: ["#1c1c12", "#3a3a22", "#4a4a2c"], pared: "#5e5e36",
    dice: [["Rilo", "Acá tiran las realidades que no funcionaron."],
           ["Tito", "Hay como cuarenta vos tirados ahí."],
           ["Rilo", "Treinta y ocho. Seguí."]] },
  { nombre: "La heladera", alto: 1400, tipo: "final",
    cielo: ["#0d2530", "#1b4a5c"], pared: "#2c7086",
    dice: [["Rilo", "Llegamos."],
           ["Tito", "¿Todo esto por una heladera?"],
           ["Rilo", "Por lo que hay adentro. Abrila."]] },
];

export const FINAL = [
  ["Tito", "…es un sánguche."],
  ["Rilo", "Es EL sánguche, Tito. En noventa realidades no existe."],
  ["Tito", "¿Y por qué me trajiste a mí?"],
  ["Rilo", "Porque lo vamos a comer a la mitad. No soy un monstruo."],
];

/**
 * Armar el pozo entero. Devuelve todo lo que el juego necesita del nivel y
 * nada mas: quien dibuja y quien choca leen de aca, no calculan nada propio.
 */
export function construirNivel() {
  const r = azar(137);
  const caps = [];
  const obst = [];
  const chatarra = [];
  const portales = [];
  const perfil = [];            // las paredes, muestreadas cada 100 px
  let y0 = 0;

  for (let i = 0; i < CAPITULOS.length; i++) {
    const c = CAPITULOS[i];
    const desde = y0, hasta = y0 + c.alto;
    caps.push({ ...c, i, desde, hasta });

    // Las paredes serpentean, pero nunca dejan el pasillo mas angosto que 150
    // px: con menos, el muneco extendido no entra ni de costado.
    for (let y = desde; y <= hasta; y += 100) {
      const t = (y - desde) / c.alto;
      const onda = Math.sin(y / 420 + i) * 34 + Math.sin(y / 170) * 12;
      // Cada capitulo tiene su ancho: el basural aprieta, el vacio se abre.
      // Con el mismo pasillo siempre, las paredes dejan de ser un obstaculo y
      // pasan a ser un marco.
      const ap = [0, 26, 14, -26, 38, 30, 18][i] || 0;
      let izq = 34 + onda + ap, der = ANCHO - 34 + onda - ap;
      if (c.tipo === "islas") { izq -= 24; der += 24; }
      izq = Math.max(6, Math.min(140, izq));
      der = Math.min(ANCHO - 6, Math.max(izq + 150, der));
      perfil.push({ y, izq, der, cap: i, t });
    }

    // Las filas. El hueco se elige PRIMERO y todo lo demas se acomoda a el.
    const paso = c.tipo === "islas" ? 300 : c.tipo === "aspas" ? 260 : 235;
    for (let y = desde + 150; y < hasta - 170; y += paso) {
      // Una de cada cuatro filas queda vacia. Un pozo con un obstaculo cada
      // 260 px sin excepcion no es dificil, es agotador: los respiros son lo
      // que hace que los tramos apretados se noten.
      if (r() < 0.15) { if (r() < 0.5) chatarra.push({ x: 0, y, tomada: false, centrar: true }); continue; }
      const w = paredEn(perfil, y);
      const HUECO = 108;
      const hx = w.izq + 16 + r() * Math.max(10, (w.der - w.izq) - 32 - HUECO);
      const izqAn = hx - w.izq, derAn = w.der - (hx + HUECO);

      if (c.tipo === "aspas" && r() < 0.62) {
        // Un aspa no tapa la fila: gira en el centro y hay que pasarle al lado
        // o cronometrarla. El largo se limita a un tercio del pasillo.
        const largo = Math.min(58, (w.der - w.izq) * 0.3);
        obst.push({ t: "aspa", x: (w.izq + w.der) / 2, y, largo,
                    vel: (r() < 0.5 ? -1 : 1) * (0.018 + r() * 0.016),
                    fase: r() * 6.28, grosor: 5 });
        if (r() < 0.5) chatarra.push({ x: hx + HUECO / 2, y: y - 60, tomada: false });
        continue;
      }
      const tipoIzq = elegir(c, r), tipoDer = elegir(c, r);
      if (izqAn > 24) obst.push({ t: tipoIzq, x: w.izq, y, an: izqAn, al: 16 });
      if (derAn > 24) obst.push({ t: tipoDer, x: hx + HUECO, y, an: derAn, al: 16 });
      if (c.tipo === "gelatina" && r() < 0.5)
        obst.push({ t: "gel", x: hx + HUECO / 2, y: y + 70, r: 40 + r() * 26 });
      if (r() < 0.55) chatarra.push({ x: hx + HUECO / 2, y: y - 46, tomada: false });
    }

    // El portal del final del capitulo, con SU PROPIO PISO alrededor.
    //
    // Sin el piso, el portal es un adorno que se puede errar por treinta
    // pixeles: se sigue de largo al capitulo siguiente sin punto de guardado,
    // sin el dialogo que cuenta la historia y —en el ultimo— sin final. Con
    // el piso, la unica forma de bajar es el agujero, asi que la historia no
    // se puede saltear por accidente.
    const py = hasta - 70;
    const wp = paredEn(perfil, py);
    const px = (wp.izq + wp.der) / 2;
    portales.push({ x: px, y: py, cap: i, r: 30, usado: false,
                    ultimo: i === CAPITULOS.length - 1 });
    const HP = 74;
    obst.push({ t: "repisa", x: 0, y: py + 14, an: px - HP / 2, al: 18 });
    obst.push({ t: "repisa", x: px + HP / 2, y: py + 14, an: ANCHO - (px + HP / 2), al: 18 });
    y0 = hasta;
  }

  // La chatarra de las filas vacias se centra recien aca, con las paredes ya
  // calculadas para esa altura.
  for (const ch of chatarra) if (ch.centrar) {
    const w = paredEn(perfil, ch.y); ch.x = (w.izq + w.der) / 2; ch.centrar = false;
  }

  // El piso del final. Existe para que el ultimo portal no se pueda saltear
  // cayendo de largo por el costado.
  const wf = paredEn(perfil, y0 - 10);
  obst.push({ t: "repisa", x: 0, y: y0, an: ANCHO, al: 40 });
  return { alto: y0, caps, obst, chatarra, portales, perfil, wf };
}

function elegir(c, r) {
  const x = r();
  if (c.tipo === "simple") return "repisa";
  if (c.tipo === "repisas") return x < 0.18 ? "pincho" : x < 0.34 ? "resorte" : "repisa";
  if (c.tipo === "aspas") return x < 0.3 ? "pincho" : "repisa";
  if (c.tipo === "islas") return "repisa";
  if (c.tipo === "gelatina") return x < 0.22 ? "resorte" : "repisa";
  if (c.tipo === "mezcla") return x < 0.3 ? "pincho" : x < 0.5 ? "resorte" : "repisa";
  return x < 0.2 ? "pincho" : "repisa";
}

/** Las paredes a una altura: interpolacion lineal entre las dos muestras. */
export function paredEn(perfil, y) {
  const i = Math.max(0, Math.min(perfil.length - 2, Math.floor(y / 100)));
  const a = perfil[i], b = perfil[i + 1] || a;
  const t = Math.max(0, Math.min(1, (y - a.y) / ((b.y - a.y) || 1)));
  return { izq: a.izq + (b.izq - a.izq) * t, der: a.der + (b.der - a.der) * t };
}

export const capituloEn = (nv, y) =>
  nv.caps.find((c) => y >= c.desde && y < c.hasta) || nv.caps[nv.caps.length - 1];
