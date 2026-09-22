// Los bichos. Todos inventados: cumplen roles del género sin parecerse a nadie.
//
// CADA UNO SE TIENE QUE LEER DE UN VISTAZO con cuarenta en pantalla, así que se
// distinguen por SILUETA y por CÓMO SE MUEVEN, no por detalle. El color sólo
// confirma lo que la forma ya dijo.
//
// Y CADA UNO TIENE QUE PEDIR ALGO DISTINTO. Un bestiario donde todos caminan
// derecho hacia vos es un solo bicho pintado de ocho colores: lo que hace que
// valga la pena mirar quién viene es que cada especie rompa una costumbre.

export const BICHOS = {
  // la masa: lenta, blanda, y viene de a montones. Enseña el juego.
  mota:      { r: 13, vida: 10,  vel: 92,  daño: 6,  xp: 1, color: "#8ad06a", forma: "gota",  peso: 1.0,
               patas: 2 },
  // la presión: corre casi tanto como vos, así que no se la deja atrás
  pua:       { r: 11, vida: 7,   vel: 122, daño: 9,  xp: 2, color: "#ff7a5c", forma: "punta", peso: 0.8,
               estela: true },
  // el muro: obliga a rodear en vez de atravesar
  caparazon: { r: 20, vida: 58,  vel: 62,  daño: 14, xp: 5, color: "#7d9bd6", forma: "placa", peso: 2.6,
               blindado: 0.45 },
  // el ruido: no va derecho, así que no se le puede apuntar de memoria
  zumbido:   { r: 12, vida: 14,  vel: 95,  daño: 8,  xp: 3, color: "#e8c65a", forma: "rombo", peso: 1.0,
               errante: true, alas: true },
  /* el que se parte: al morir deja dos crías. Castiga matar de lejos sin mirar
     lo que se acumula atrás. */
  saco:      { r: 22, vida: 46,  vel: 74,  daño: 10, xp: 4, color: "#c88fd6", forma: "gota",  peso: 2.0,
               parte: ["larva", "larva", "larva"] },
  larva:     { r: 8,  vida: 6,   vel: 118, daño: 5,  xp: 1, color: "#e2b0ec", forma: "punta", peso: 0.5 },
  /* el que guarda distancia y escupe. Es el único al que hay que IR a buscar:
     sin él, alejarse siempre es gratis. */
  escupidor: { r: 15, vida: 30,  vel: 80,  daño: 6,  xp: 4, color: "#6fd8c0", forma: "rombo", peso: 1.4,
               /* LA BALA VA LENTA A PROPOSITO. A 190 px/s no se esquivaba: salía y pegaba, y
   un daño que no se puede evitar no es dificultad, es un impuesto. A 150 se ve
   venir y se sale del camino, que es lo que este bicho tiene que enseñar. */
/* EL QUE DISPARA TAMBIEN TIENE TECHO, por la misma razón que el que acecha:
   no se acerca, así que no se gasta. Medido en la salina a los dos minutos:
   66 escupidores vivos, uno cada 2,8 segundos, son veintitrés balas por
   segundo. Eso no se esquiva, se sufre — y la prueba lo mostró clarísimo
   porque el robot mataba lo MISMO que en la pradera (174 contra 190) y llegaba
   al mismo nivel, pero terminaba con 48 de vida contra 134. No moría de
   hambre: se desangraba. Con diez a la vez son tres balas y media por segundo,
   que sí se leen. */
               distancia: 230, escupe: { cada: 2.8, daño: 6, vel: 150, r: 7 },
               maxVivos: 10, olvida: 900 },
  /* el que se queda quieto hasta que te acercás y entonces salta. Hace que
     cruzar un claro vacío deje de ser seguro. */
  /* EL QUE ACECHA NO SE MUEVE, Y POR ESO TIENE TECHO Y SE VA.
     Un bicho quieto no se acerca a que lo maten: se acumula. Medido, la etapa
     de la salina no la terminaba nadie —0 de 8, muriendo a los 82 segundos de
     345— porque a los dos minutos el mapa entero era un campo minado de
     acechos que nunca se gastaban. Van dos reglas: no puede haber más de
     `maxVivos` a la vez, y el que quedó lejísimos se levanta y se va, porque
     un acecho a novecientos píxeles no es una amenaza, es memoria ocupada. */
  acecho:    { r: 16, vida: 34,  vel: 0,   daño: 10, xp: 5, color: "#d6708f", forma: "placa", peso: 1.8,
               acecha: { radio: 170, impulso: 340, descanso: 1.5 }, maxVivos: 14, olvida: 950 },

  // ── jefes ──────────────────────────────────────────────────────────────
  // el primero: enorme y lento, y se deshace en motas. El remate es un momento.
  bulto:     { r: 44, vida: 1500, vel: 88, daño: 24, xp: 120, color: "#c264e0", forma: "placa", peso: 12,
               jefe: true, parte: ["mota","mota","mota","mota","mota","mota","mota","mota","mota","mota"] },
  // el segundo: rápido y con escolta. Obliga a elegir entre el jefe y el resto.
  madre:     { r: 40, vida: 2100, vel: 62, daño: 22, xp: 160, color: "#ff6ea9", forma: "gota",  peso: 10,
               jefe: true, cria: { cada: 2.4, tipo: "larva", cuantos: 3 } },
  // el tercero: se planta y escupe en abanico. El único que pega de lejos.
  torre:     { r: 46, vida: 2600, vel: 54, daño: 24, xp: 200, color: "#7cf6ff", forma: "placa", peso: 14,
               jefe: true, blindado: 0.3, abanico: { cada: 2.8, cuantos: 9, daño: 13, vel: 175, r: 7 } },
};

/* ── LAS ETAPAS ──────────────────────────────────────────────────────────────
   Cuatro, y cada una es un juego distinto con las mismas manos: cambian qué
   viene, con qué frecuencia, de qué color es todo y quién está al final.
   ESCRITAS A MANO. Una curva generada sube parejo, y lo que hace que seis
   minutos no se sientan largos no es la dificultad sino tener respiros y
   sorpresas en los lugares correctos. */
export const ETAPAS = [
  {
    id: 1, nombre: "pradera", largo: 300,
    piso: "#141021", reja: "rgba(255,255,255,.035)", borde: "#ff6ea9",
    niebla: "rgba(138,208,106,.05)",
    oleadas: [
      { desde:   0, cada: 1.10, tipos: ["mota"],                          porVez: 2 },
      { desde:  30, cada: 0.95, tipos: ["mota", "mota", "pua"],           porVez: 2 },
      { desde:  70, cada: 0.85, tipos: ["mota", "pua", "zumbido"],        porVez: 3 },
      { desde: 110, cada: 0.80, tipos: ["mota", "pua", "caparazon"],      porVez: 3 },
      { desde: 145, jefe: "bulto" },
      { desde: 160, cada: 1.30, tipos: ["mota"],                          porVez: 2 },   // respiro
      { desde: 195, cada: 0.70, tipos: ["pua", "zumbido", "caparazon"],   porVez: 4 },
      { desde: 245, cada: 0.60, tipos: ["mota", "pua", "zumbido", "caparazon"], porVez: 5 },
    ],
  },
  {
    id: 2, nombre: "nido", largo: 330,
    piso: "#1a1020", reja: "rgba(255,180,220,.045)", borde: "#ffcc4d",
    niebla: "rgba(200,143,214,.06)",
    oleadas: [
      { desde:   0, cada: 1.00, tipos: ["mota", "larva"],                 porVez: 3 },
      { desde:  35, cada: 0.90, tipos: ["saco", "larva"],                 porVez: 2 },
      { desde:  80, cada: 0.85, tipos: ["saco", "pua", "larva"],          porVez: 3 },
      { desde: 130, cada: 0.75, tipos: ["saco", "zumbido", "caparazon"],  porVez: 3 },
      { desde: 170, jefe: "madre" },
      { desde: 185, cada: 1.20, tipos: ["larva"],                         porVez: 3 },
      { desde: 220, cada: 0.62, tipos: ["saco", "pua", "larva", "zumbido"], porVez: 5 },
      { desde: 275, cada: 0.52, tipos: ["saco", "caparazon", "pua"],      porVez: 5 },
    ],
  },
  {
    id: 3, nombre: "salina", largo: 345,
    piso: "#101a1e", reja: "rgba(140,255,230,.05)", borde: "#6fd8c0",
    niebla: "rgba(111,216,192,.06)",
    /* LOS ESPECIALES SON EL CONDIMENTO, NO EL GRUESO.
       La primera versión de esta etapa era casi toda escupidores y acechos: los
       dos guardan distancia o no se mueven, así que había poquísimo para matar.
       Medido: nivel 4 a los dos minutos —contra 15 en las otras etapas— y 0 de
       8 partidas terminadas. No moría por dificultad, moría por hambre: sin
       bichos que se te vengan encima no hay gemas, sin gemas no hay niveles y
       sin niveles no hay con qué. Cada oleada lleva ahora masa que se acerca. */
    oleadas: [
      { desde:   0, cada: 1.05, tipos: ["mota", "mota", "acecho"],        porVez: 3 },
      { desde:  40, cada: 0.90, tipos: ["mota", "mota", "escupidor"],     porVez: 3 },
      { desde:  85, cada: 0.80, tipos: ["mota", "pua", "pua", "escupidor", "acecho"], porVez: 4 },
      { desde: 135, cada: 0.72, tipos: ["pua", "mota", "caparazon", "escupidor", "zumbido"], porVez: 4 },
      { desde: 180, jefe: "torre" },
      { desde: 196, cada: 1.20, tipos: ["mota", "acecho"],                porVez: 3 },
      { desde: 235, cada: 0.60, tipos: ["pua", "mota", "escupidor", "acecho", "zumbido"], porVez: 5 },
      { desde: 290, cada: 0.50, tipos: ["pua", "mota", "escupidor", "caparazon", "zumbido"], porVez: 6 },
    ],
  },
  {
    id: 4, nombre: "hervidero", largo: 380,
    piso: "#1c0f13", reja: "rgba(255,120,120,.05)", borde: "#ff5252",
    niebla: "rgba(255,90,110,.06)",
    oleadas: [
      { desde:   0, cada: 0.85, tipos: ["mota", "pua", "larva"],          porVez: 3 },
      { desde:  45, cada: 0.75, tipos: ["saco", "escupidor", "pua"],      porVez: 3 },
      { desde:  95, cada: 0.68, tipos: ["acecho", "caparazon", "zumbido"], porVez: 4 },
      { desde: 140, jefe: "bulto" },
      { desde: 155, cada: 0.70, tipos: ["saco", "pua", "escupidor"],      porVez: 4 },
      { desde: 200, jefe: "madre" },
      { desde: 215, cada: 0.62, tipos: ["acecho", "escupidor", "zumbido"], porVez: 4 },
      { desde: 280, jefe: "torre" },
      /* EL TRAMO FINAL AFLOJA LA ENTRADA, no la amenaza. El tercer jefe ya es
         el remate; encimarle además la oleada más densa del juego hacía que
         nadie —ni el robot que elige bien, que llegaba a nivel 21— viera el
         final. Con el jefe en pantalla, lo que falta no son más bichos. */
      { desde: 300, cada: 0.62, tipos: ["saco", "pua", "caparazon", "escupidor", "acecho"], porVez: 4 },
    ],
  },
];

/** Cuánta vida de más tienen los bichos a los `t` segundos, según la etapa. */
/* LA DUREZA POR ETAPA SUBE MENOS DE LO QUE PARECE NECESARIO. Con 0,28 por
   etapa, la cuarta empezaba con bichos casi al doble de vida Y con tres jefes:
   medido, el robot moría a los 121 segundos de 380 y no llegaba a ver la mitad
   del contenido que la etapa tiene para mostrar. La cuarta ya es más difícil
   por lo que manda —qué viene y cuántos—, no hace falta inflar también los
   números. */
export const dureza = (t, etapa = 1) => (1 + Math.min(2.2, t / 190)) * (1 + (etapa - 1) * 0.15);

/* EL TECHO DE BICHOS VIVOS, y por qué es balance y no optimización.
   Medido con un robot sobre doce partidas: sin techo se llegaba a 560 bichos a
   la vez y NINGUNA sobrevivía. Es una espiral: si no matás al ritmo al que
   entran, cada segundo entran más, y la partida ya está perdida dos minutos
   antes de que te toquen. Con techo, quedarse atrás se paga caro pero se
   remonta. Y de paso el cuadro deja de costar 15 ms. */
export const MAX_BICHOS = 200;

/* MAS BICHOS QUIERE DECIR QUE CADA UNO PEGUE MENOS.
   Al hacer que la horda llegue de verdad, el daño de contacto de antes se
   volvió una sentencia: con medio segundo de gracia entre golpe y golpe, estar
   rodeado eran veinte de daño por segundo y la barra entera en cinco segundos.
   Medido: 0 de 8 partidas terminadas en las dos últimas etapas, incluso
   eligiendo bien. El peligro de una horda tiene que ser que no te deja
   respirar, no que cada mota pegue como un jefe. */

/* LA VELOCIDAD VA POR PESO, y costó una ronda entera entenderlo.
   Subir a todos por igual arregló la densidad en pantalla pero rompió las dos
   últimas etapas: medido, 0 de 8 partidas terminadas incluso eligiendo bien,
   muriendo a los 123 segundos de 345. La culpa era del caparazón, que con 84
   corría casi tanto como el jugador siendo además el que más aguanta: un muro
   que además te persigue no se rodea, sólo se sufre. Lo chico corre, lo grande
   no — y lo grande sigue siendo peligroso porque no se muere. */

/* EL RECICLADO, y es lo que hace que el juego se VEA como lo que es.
   Medido con la pantalla de un teléfono: a los sesenta segundos había 56 bichos
   vivos y UNO en pantalla. El 2 %. La mediana estaba a 446 píxeles, o sea fuera
   de cámara, porque la masa es más lenta que el jugador y nunca cierra la
   distancia: se juntaba un anillo de bichos lejísimos mientras la pantalla se
   veía vacía. Un juego de hordas donde no se ve la horda.
   Dos cosas lo arreglan. Una es que la masa corra lo suficiente como para
   alcanzarte cuando frenás o girás —no más rápido que vos, pero cerca—. La
   otra es ésta: el que quedó demasiado lejos se levanta y vuelve a aparecer
   del otro lado, en el anillo de siempre. No se lo mata ni se lo regala: se lo
   mueve, y así los doscientos que el techo permite están siempre alrededor
   tuyo en vez de perdidos en un rincón del mapa. */
export const RECICLAR = 760;

/* LOS ELITES. Un bicho común al que le tocó la lotería: más grande, más duro y
   suelta un cofre. Están para que la pantalla tenga de vez en cuando un blanco
   que valga la pena perseguir en vez de sólo cosas de las que huir. */
export const ELITE = { vida: 7, r: 1.45, xp: 6, vel: 0.82, aura: "#ffd166" };
export const probElite = (t) => Math.min(0.055, 0.008 + t / 14000);
