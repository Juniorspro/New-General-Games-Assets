/* ============================================================================
   zonda/js/historia.js — lo que se dice en el cerro.
   Ayelén sube a buscar las cartas que el Zonda se llevó la noche que murió su
   abuela Rosa, la cartera del cerro durante cuarenta años. Los diálogos son
   cortos a propósito: en un teléfono se leen de a una línea.
   ========================================================================== */

const CAP_SUB = {
  1: 'Donde empieza el cerro',
  2: 'Lo que se quedó abajo',
  3: 'El hielo se acuerda',
  4: 'Lo que el viento se lleva',
};

/* q: quién habla (ayelen | zonda | rosa); c: cara (normal | triste | firme) */
const DIALOGOS = {
  inicio: [
    { q: 'ayelen', c: 'triste', t: 'La abuela Rosa subió este cerro cuarenta años, con la bolsa de las cartas al hombro.' },
    { q: 'ayelen', c: 'triste', t: 'La noche que se fue, se levantó el Zonda y se llevó la bolsa cerro arriba.' },
    { q: 'ayelen', c: 'firme', t: 'Voy a buscarlas. Y a dejar su piedra en la apacheta de la cumbre, como se hace.' },
  ],
  viento1: [
    { q: 'zonda', t: '¿Y vos quién sos, para subir de noche?' },
    { q: 'ayelen', c: 'firme', t: 'Ayelén. La nieta de Rosa.' },
    { q: 'zonda', t: 'Rosa ya no sube. Volvete. Lo que el viento se lleva, no vuelve.' },
    { q: 'ayelen', c: 'firme', t: 'Entonces voy a ir a buscarlo.' },
  ],
  apacheta1: [
    { q: 'ayelen', c: 'normal', t: 'Una apacheta. La abuela dejaba una piedra en cada una.' },
    { q: 'ayelen', c: 'normal', t: 'Dejo una. Para que el cerro me deje pasar.' },
    { q: 'zonda', t: 'El cerro no te debe nada, chiquita.' },
  ],
  mina: [
    { q: 'ayelen', c: 'normal', t: 'La mina de los Quispe. La abuela les subía las cartas de sus familias.' },
    { q: 'zonda', t: 'Hace treinta años que acá no entra nadie. Ni cartas, ni gente.' },
  ],
  mina2: [
    { q: 'ayelen', c: 'triste', t: 'Encontré cartas. Nunca las abrieron.' },
    { q: 'zonda', t: 'Porque ya no había quién. Las guardo yo. Alguien tiene que guardarlas.' },
    { q: 'ayelen', c: 'normal', t: '¿Vos te las llevaste para cuidarlas?' },
    { q: 'zonda', t: 'Seguí subiendo, si tanto querés saber.' },
  ],
  glaciar: [
    { q: 'ayelen', c: 'normal', t: 'Qué frío. La abuela decía que el hielo se acuerda de todo.' },
    { q: 'zonda', t: 'El hielo se acuerda. Yo me olvido. Por eso soplo.' },
  ],
  glaciar2: [
    { q: 'zonda', t: 'Rosa me pidió una cosa, la última vez que subió.' },
    { q: 'ayelen', c: 'normal', t: '¿Qué te pidió?' },
    { q: 'zonda', t: 'Que no te dejara subir sola. Y mirá: acá estás. Sola.' },
    { q: 'ayelen', c: 'firme', t: 'No estoy sola. Estás vos, que no parás de hablar.' },
  ],
  regalo: [
    { q: 'zonda', t: 'Allá arriba sopla más fuerte que yo. Sola no vas a poder.' },
    { q: 'zonda', t: 'Tomá. Te presto un aliento: dos veces vas a poder empujarte en el aire.' },
    { q: 'ayelen', c: 'normal', t: 'Gracias, Zonda.' },
    { q: 'zonda', t: 'No me agradezcas. Subí.' },
  ],
  lleva: [
    { q: 'zonda', t: 'Ahora no me pelees. Dejate llevar.' },
  ],
  cumbre: [
    { q: 'ayelen', c: 'normal', t: 'La cumbre.' },
    { q: 'zonda', t: 'La bolsa está en la apacheta. Rosa la dejó ahí. Yo nada más la cuidé.' },
  ],
  final: [
    { q: 'ayelen', c: 'triste', t: 'Hay una carta con mi nombre.' },
    { q: 'rosa', t: 'Ayelén: si estás leyendo esto, es que subiste. Yo ya sabía.' },
    { q: 'rosa', t: 'Dejá la piedra, mirá el sol y bajá liviana. El viento reparte lo que nosotros no podemos.' },
    { q: 'rosa', t: 'Te quiero. Rosa.' },
    { q: 'ayelen', c: 'normal', t: 'Zonda... ¿las repartís vos?' },
    { q: 'zonda', t: 'A cada una, a donde tenga que llegar.' },
  ],
};

/* las cartas perdidas, una por sala que tiene una L. La clave es la de la sala */
const CARTAS = {
  '1-1': { de: 'Tomás', a: 'su mamá', t: 'Mamá: llegué bien a la mina. Acá arriba el cielo está tan cerca que da miedo tocarlo. Mandame las medias de lana. Tomás, 1971.' },
  '1-2': { de: 'Anselmo', a: 'don Aurelio', t: 'Don Aurelio: le debo tres llamas y una disculpa. Las llamas las tengo. La disculpa se la digo en persona cuando baje.' },
  '1-3': { de: 'Julián', a: 'Elena', t: 'Querida Elena: el viento de acá me desordena todo, menos lo que siento. Esperame para el carnaval.' },
  '1-4': { de: 'el turno noche', a: 'Rosa', t: 'Rosa: gracias por subir con la nieve. Sin tus cartas esta mina sería solo un agujero.' },
  '1-5': { de: 'papá', a: 'su hija', t: 'Hija: en la apacheta de la Quebrada hay una piedra mía. Cuando pases, dejá una tuya al lado. Así nos acompañamos.' },
  '2-1': { de: 'Ramón', a: 'Martina', t: 'Martina: hoy encontramos plata. No mucha. Lo justo para el techo de la casa. Lo demás, para la fiesta.' },
  '2-2': { de: 'F. Quispe', a: 'el jefe de mina', t: 'Señor jefe: renuncio. Me voy a tocar el charango a Humahuaca. No me busquen. Lo que me deben, sí me lo pagan.' },
  '2-3': { de: 'Beto', a: 'Tito', t: 'Tito: la vagoneta de la veta norte arranca sola. Si subís, no te subas. Si te subís, agarrate.' },
  '2-4': { de: 'Nicanor', a: 'su mamita', t: 'Mamita: el pique es hondo pero la gente es buena. Comemos juntos, cantamos juntos. Extraño tu locro. Nicanor, 1983.' },
  '2-5': { de: 'la mina', a: 'quien la encuentre', t: 'Hoy cerramos la mina. Las cartas que no se entregaron quedan en la bolsa de Rosa. Ella va a saber qué hacer.' },
  '3-1': { de: 'una pastora de Iruya', a: 'Rosa', t: 'Rosa: el hielo guarda las huellas de los que subieron antes. Yo pisé en las tuyas.' },
  '3-2': { de: 'Esteban', a: 'su amor', t: 'Amor: si el viento en contra no me deja volver, vuelvo de espaldas. Pero vuelvo.' },
  '3-3': { de: 'el abuelo Ceferino', a: 'su nieto', t: 'Nieto: las ráfagas se aguantan agachado y contando hasta tres. Como las penas.' },
  '3-4': { de: 'Pedro', a: 'Clara', t: 'Clara: en el glaciar me vi reflejado mil veces. En ninguna estaba sin vos. Horrible. Volvé.' },
  '3-5': { de: 'Justina', a: 'Rosa', t: 'Rosa, amiga: si algún día no subís más, alguien de tu sangre va a subir por vos. Te conozco.' },
  '4-1': { de: 'alguien', a: 'alguien', t: 'La tormenta no es mala, dice mi abuela. Es el cielo que se pone a limpiar.' },
  '4-2': { de: 'un guía', a: 'Rosa', t: 'Dos alientos tiene el que sube acompañado: uno para él y otro para el que viene atrás.' },
  '4-3': { de: 'Tomás', a: 'su mamá', t: 'Mamá: llegué a la cumbre. No hay nada. Solo el sol, el viento y yo. Es lo más lindo que vi en mi vida. Tomás, 1972.' },
  '4-4': { de: 'Rosa', a: 'el viento', t: 'Al viento: gracias por llevarme cuando no podía. Rosa.' },
};

const CREDITOS = [
  'ZONDA',
  'Una chica, un cerro y el viento.',
  'Todo lo que se ve está dibujado con código y todo lo que suena, sintetizado: no hay una sola imagen ni un solo archivo de audio.',
  'Las salas se comprobaron con un resolvedor que usa la misma física del juego.',
  'Para Rosa, y para todas las carteras y carteros del cerro.',
];
