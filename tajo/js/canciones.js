// Las canciones, escritas nota por nota. Son originales: la letra, la
// melodía y los acordes son de este juego.
//
// Cómo se lee una frase de voz:  "¡cor:B4:2-tá!:E5:4 que:E5:2"
//   sílaba : nota : duración en semicorcheas. El guion une sílabas de una
//   misma palabra (así la pantalla muestra "¡CORTÁ!" entero); el espacio
//   separa palabras. "_:4" es un silencio.
// Cada frase va con [compás dentro de la sección, paso, texto, opciones].

export const DRAGON_VIOLETA = {
  id: "dragon-violeta",
  titulo: "Dragón Violeta",
  autor: "Tajo",
  bpm: 150,
  paleta: "dragon",
  arranque: 1.0,
  voces: [{ nombre: "voz" }, { nombre: "coro", octava: -1, volumen: 0.7, pan: -0.2 }],
  riffs: {
    // La llamada del principio, en mi menor.
    llamada: [[0, "E5", 4], [6, "G5", 2], [8, "B5", 4], [14, "A5", 2], [16, "G5", 2], [18, "E5", 2], [20, "D5", 2], [22, "E5", 8]],
    // El gancho de los vientos, sobre D y B7: termina en re sostenido para
    // caer en el mi del "¡cor-tá!" que viene.
    gancho: [[0, "A5", 2], [3, "A5", 1], [4, "F#5", 2], [6, "D5", 2], [8, "E5", 1], [10, "F#5", 2], [12, "A5", 4],
      [16, "B5", 2], [18, "A5", 1], [20, "F#5", 2], [22, "D#5", 2], [24, "F#5", 2], [26, "A5", 2], [28, "F#5", 2], [30, "D#5", 2]],
    // Las respuestas del verso, sobre A9 (dórico: do sostenido).
    resp: [[2, "C#5", 1], [3, "E5", 2], [6, "G5", 1], [7, "A5", 2], [10, "G5", 1], [11, "E5", 1], [12, "C#5", 2]],
    resp2: [[0, "C#5", 2], [2, "E5", 2], [4, "G5", 2], [6, "A5", 2], [8, "B5", 6]],
    cierre: [[0, "E5", 3], [4, "E5", 12]],
  },
  secciones: [
    {
      nombre: "Intro", tipo: "intro", compases: 4, intensidad: 0.2,
      acordes: "Em7 Em7 Cmaj7 Cmaj7", bateria: "intro", colchon: 1, volBateria: 0.7,
    },
    {
      nombre: "Intro", tipo: "intro", compases: 4, intensidad: 0.4,
      acordes: "Em7 Em7 D B7", bateria: "introB", bateriaFin: "redoble", bajo: "pulso", colchon: 0.8,
      solos: [[0, "llamada"]], riffs: [[2, "gancho"]], efectos: [[2, "subida", 2]],
    },
    {
      nombre: "Verso", tipo: "verso", compases: 16, intensidad: 0.55,
      acordes: "Em7 Em7 A9 A9", bateria: "funk", bateriaB: "funkB", bajo: "funk", guitarra: "funk", piano: true,
      riffs: [[2, "resp"], [6, "resp"], [10, "resp"], [14, "resp2"]],
      efectos: [[0, "impacto"]],
      voz: [
        [0, 2, "ba:B3:2-jo:D4:2 la:E4:2 luz:E4:4 de:D4:2 la:E4:2 ciu:G4:3-dad:E4:5"],
        [4, 2, "hay:B3:2 un:D4:2 dra:E4:2-gón:G4:4 que:A4:2 no:G4:2 se:E4:2 va:E4:6"],
        [8, 2, "tie:D4:2-ne:E4:2 las:G4:2 a:A4:2-las:B4:4 de:A4:2 ne:G4:2-ón:A4:6"],
        [12, 2, "y:B3:1 el:C4:1 co:D4:2-ra:E4:2-zón:G4:4 en:E4:2 el:D4:2 tam:E4:2-bor:E4:6"],
      ],
    },
    {
      nombre: "Pre-coro", tipo: "pre", compases: 8, intensidad: 0.7, apagonFinal: true,
      acordes: "Cmaj7 D6 Bm7 Em7 Cmaj7 D6 B7sus4 B7", bateria: "sube", bateriaFin: "redoble", bajo: "motor",
      colchon: 0.9, guitarra: "disco",
      efectos: [[0, "inverso", 1], [6, "subida", 2]],
      voz: [
        [0, 0, "le:E4:2-van:G4:2-tá:B4:4 las:A4:2 ma:G4:2-nos:A4:8"],
        [2, 0, "sen:F#4:2-tí:A4:2 có:B4:4-mo:A4:2 su:G4:2-be:F#4:8"],
        [4, 0, "el:E4:2 fue:G4:2-go:B4:4 vio:C5:2-le:B4:2-ta:A4:8"],
        [6, 0, "¡a:B4:2-ho:C5:2-ra!:B4:4 ¡a:B4:2-ho:D5:2-ra!:D#5:8"],
      ],
    },
    {
      nombre: "Coro", tipo: "coro", compases: 16, intensidad: 1.0, platillos: true,
      acordes: "Em7 Cmaj7 D B7", bateria: "disco", bateriaB: "discoB", bajo: "disco", guitarra: "disco", colchon: 0.55,
      riffs: [[2, "gancho"], [6, "gancho"], [10, "gancho"], [14, "gancho"]],
      efectos: [[0, "impacto"]],
      voz: [
        [0, 0, "¡cor:B4:2-tá!:E5:4 ¡cor:B4:2-tá!:E5:8 que:E5:2 la:D5:2 no:C5:2-che:B4:2 es:C5:2 nues:B4:3-tra:G4:3"],
        [4, 0, "¡cor:B4:2-tá!:E5:4 ¡cor:B4:2-tá!:E5:8 dra:E5:2-gón:D5:4 vio:C5:2-le:B4:2-ta:A4:6"],
        [8, 0, "¡cor:B4:2-tá!:E5:4 ¡cor:B4:2-tá!:E5:8 no:E5:2 mi:D5:2-res:C5:2 a:B4:2-trás:D5:8"],
        [12, 0, "bri:B4:2-lla:C5:2 la:B4:2 som:G4:2-bra:E4:8 dra:E5:2-gón:D5:4 vio:C5:2-le:B4:2-ta:B4:6"],
      ],
    },
    {
      nombre: "Puente", tipo: "puente", compases: 8, intensidad: 0.35, bombeo: false,
      acordes: "Cmaj7 Cmaj7 Bm7 Bm7 Am7 Am7 B7sus4 B7", bateria: "mitad", bateriaFin: "mitadFin", bajo: "largo",
      colchon: 1.2, piano: true, volBateria: 0.8,
      voz: [
        [0, 0, "si:E4:4 se:G4:4 a:B4:4-pa:A4:4-ga:G4:4 el:E4:4 mun:G4:4-do:E4:4"],
        [2, 0, "yo:F#4:4 te:A4:4 pren:B4:8-do:A4:4 con:G4:4 mi:F#4:4 luz:E4:4"],
        [4, 0, "si:E4:4 se:G4:4 a:A4:4-pa:C5:4-ga:B4:4 el:A4:4 mun:G4:4-do:A4:4"],
        [6, 0, "cor:B4:4-ta:B4:4-mos:C5:4 los:B4:4 dos:B4:16"],
      ],
    },
    {
      nombre: "Pre-coro", tipo: "pre", compases: 8, intensidad: 0.75, apagonFinal: true,
      acordes: "Cmaj7 D6 Bm7 Em7 Cmaj7 D6 B7sus4 B7", bateria: "sube", bateriaFin: "redoble", bajo: "motor",
      colchon: 0.9, guitarra: "disco",
      efectos: [[0, "impacto"], [6, "subida", 2]],
      voz: [
        [0, 0, "le:E4:2-van:G4:2-tá:B4:4 las:A4:2 ma:G4:2-nos:A4:8"],
        [2, 0, "que:F#4:2 no:A4:2 que:B4:4-de:A4:2 na:G4:2-da:F#4:8"],
        [4, 0, "sin:E4:2 cor:G4:2-tar:B4:4 al:C5:2 rit:B4:2-mo:A4:8"],
        [6, 0, "¡a:B4:2-ho:C5:2-ra!:B4:4 ¡a:B4:2-ho:D5:2-ra!:D#5:8"],
      ],
    },
    {
      nombre: "Coro final", tipo: "coro", compases: 16, intensidad: 1.0, platillos: true,
      acordes: "Em7 Cmaj7 D B7", bateria: "discoB", bajo: "disco", guitarra: "disco", colchon: 0.6,
      riffs: [[2, "gancho"], [6, "gancho"], [10, "gancho"], [14, "gancho"]],
      efectos: [[0, "impacto"]],
      voz: [
        [0, 0, "¡cor:B4:2-tá!:E5:4 ¡cor:B4:2-tá!:E5:8 que:E5:2 la:D5:2 no:C5:2-che:B4:2 es:C5:2 nues:B4:3-tra:G4:3"],
        [0, 0, "cor:B4:2-ta:E5:4 cor:B4:2-ta:E5:8", { coro: true }],
        [4, 0, "¡cor:B4:2-tá!:E5:4 ¡cor:B4:2-tá!:E5:8 dra:E5:2-gón:D5:4 vio:C5:2-le:B4:2-ta:A4:6"],
        [4, 0, "cor:B4:2-ta:E5:4 cor:B4:2-ta:E5:8", { coro: true }],
        [8, 0, "¡cor:B4:2-tá!:E5:4 ¡cor:B4:2-tá!:E5:8 no:E5:2 mi:D5:2-res:C5:2 a:B4:2-trás:D5:8"],
        [8, 0, "cor:B4:2-ta:E5:4 cor:B4:2-ta:E5:8", { coro: true }],
        [12, 0, "bri:B4:2-lla:C5:2 la:B4:2 som:G4:2-bra:E4:8 dra:E5:2-gón:D5:4 vio:C5:2-le:B4:2-ta:B4:6"],
      ],
    },
    {
      nombre: "Final", tipo: "outro", compases: 4, intensidad: 0.3,
      acordes: "Em7", bateria: "nada", bateriaFin: "nada", colchon: 1,
      riffs: [[0, "cierre"]], efectos: [[0, "impacto"]],
      voz: [[1, 0, "dra:E5:4-gón:D5:4 vio:B4:4-le:A4:4-ta:B4:16"]],
    },
  ],
};

export const CANCIONES = [DRAGON_VIOLETA];
