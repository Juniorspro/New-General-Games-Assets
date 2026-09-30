// Los niveles de Morfi: tres cajas de diez. Cada uno es una lista de cosas
// en el tablero de 320 × 480 (arriba es y = 0) y su solución: los cortes y
// toques que lo resuelven con las tres estrellas, en segundos desde que
// arranca. La prueba juega cada solución y revisa que Morfi coma con las
// tres estrellas: si un cambio en la física rompe un nivel, se entera.
//
//   caramelo  [x, y]                 dónde arranca
//   morfi     [x, y]                 sus pies (la boca queda 70 más arriba)
//   estrellas [[x, y] × 3]
//   hilos     [{ pin: [x, y], largo?, mueve?: { a, b, periodo } }]
//   clips     [[x, y, radio]]        alfiler con radio: al entrar, sale un hilo
//   globos    [[x, y]]
//   abanicos  [[x, y, ángulo]]       soplan hacia el ángulo (0 = derecha)
//   chinches  [[ax, ay, bx, by]]     una fila de chinches
//   sobres    [[[x, y, ang], [x, y, ang]]]  de a dos; se sale para donde mira
//   elasticos [[ax, ay, bx, by]]
//   sol       [[segundos, 'c', hilo] | [segundos, 'g'] | [segundos, 'a', abanico]]
//   ayuda     texto de ayuda la primera vez (clave de idioma.js)

const PI = Math.PI;

export const CAJAS = [
  { id: 'carton', color: '#c99a5f', estrellas: 0 },
  { id: 'cuaderno', color: '#8fb9e0', estrellas: 12 },
  { id: 'regalo', color: '#d95f7a', estrellas: 30 },
];

export const NIVELES = [
  // ── caja 1: cartón (hilos y clips) ────────────────────────────────────────
  { id: '1-1', ayuda: 'ayudaCortar', caramelo: [160, 175], morfi: [160, 445], estrellas: [[160, 250], [160, 300], [160, 350]], hilos: [{ pin: [160, 70] }], sol: [[0.5, 'c', 0]] },
  { id: '1-2', ayuda: 'ayudaHamaca', caramelo: [90, 200], morfi: [250, 445], estrellas: [[172, 240], [258, 232], [262, 291]], hilos: [{ pin: [50, 84] }, { pin: [200, 78] }], sol: [[0.77, 'c', 0], [2.13, 'c', 1]] },
  { id: '1-3', caramelo: [160, 150], morfi: [100, 445], estrellas: [[160, 195], [135, 246], [118, 305]], hilos: [{ pin: [60, 90], largo: 160 }, { pin: [260, 90], largo: 160 }, { pin: [160, 60] }], sol: [[0.79, 'c', 2], [1.23, 'c', 1], [1.44, 'c', 0]] },
  { id: '1-4', caramelo: [40, 200], morfi: [255, 445], estrellas: [[150, 239], [258, 252], [256, 312]], hilos: [{ pin: [150, 64] }], sol: [[1.16, 'c', 0]] },
  { id: '1-5', ayuda: 'ayudaClip', caramelo: [84, 140], morfi: [240, 445], estrellas: [[84, 280], [172, 326], [228, 255]], hilos: [{ pin: [84, 60] }], clips: [[150, 250, 80]], sol: [[0.5, 'c', 0], [1.56, 'c', 100]] },
  { id: '1-6', caramelo: [60, 120], morfi: [262, 445], estrellas: [[77, 277], [193, 222], [222, 332]], hilos: [{ pin: [60, 50] }], clips: [[122, 222, 72], [232, 262, 74]], sol: [[0.53, 'c', 0], [1.57, 'c', 100], [2.69, 'c', 101]] },
  { id: '1-7', caramelo: [220, 140], morfi: [96, 445], estrellas: [[216, 221], [214, 298], [150, 333]], hilos: [{ pin: [220, 84] }, { pin: [96, 100], largo: 236 }], sol: [[0.58, 'c', 0], [1.25, 'c', 1]] },
  { id: '1-8', caramelo: [280, 150], morfi: [120, 445], estrellas: [[87, 210], [60, 261], [106, 312]], hilos: [{ pin: [190, 60] }], clips: [[90, 210, 60]], sol: [[0.72, 'c', 0], [1.35, 'c', 100]] },
  { id: '1-9', caramelo: [160, 214], morfi: [70, 445], estrellas: [[102, 221], [60, 257], [58, 316]], hilos: [{ pin: [40, 124] }, { pin: [280, 124] }, { pin: [112, 62] }, { pin: [208, 62] }], sol: [[0.84, 'c', 1], [1.32, 'c', 3], [2.39, 'c', 2], [2.63, 'c', 0]] },
  { id: '1-10', caramelo: [70, 130], morfi: [90, 445], estrellas: [[148, 232], [252, 270], [145, 299]], hilos: [{ pin: [36, 52] }, { pin: [150, 60] }], clips: [[196, 232, 70]], sol: [[0.61, 'c', 0], [0.9, 'c', 1], [2.29, 'c', 100]] },
  // ── caja 2: cuaderno (globos, abanicos y chinches) ────────────────────────
  { id: '2-1', ayuda: 'ayudaGlobo', caramelo: [160, 140], morfi: [160, 445], estrellas: [[160, 205], [160, 92], [160, 322]], hilos: [{ pin: [160, 40] }], globos: [[160, 262]], sol: [[0.53, 'c', 0], [2.68, 'g']] },
  { id: '2-2', ayuda: 'ayudaAbanico', caramelo: [90, 150], morfi: [210, 445], estrellas: [[111, 178], [157, 229], [187, 294]], hilos: [{ pin: [90, 60] }], abanicos: [[30, 360, -0.85]], sol: [[0.53, 'c', 0], [0.73, 'a', 0]] },
  { id: '2-3', ayuda: 'ayudaChinches', caramelo: [160, 170], morfi: [60, 445], estrellas: [[89, 186], [49, 222], [50, 308]], hilos: [{ pin: [100, 70] }, { pin: [250, 60] }], chinches: [[90, 330, 230, 330]], sol: [[0.52, 'c', 1], [1.54, 'c', 0]] },
  { id: '2-4', caramelo: [70, 140], morfi: [215, 445], estrellas: [[70, 303], [170, 162], [210, 241]], hilos: [{ pin: [70, 60] }], globos: [[70, 320]], abanicos: [[26, 200, 0]], sol: [[0.58, 'c', 0], [2.58, 'a', 0], [3.32, 'g']] },
  { id: '2-5', caramelo: [70, 150], morfi: [265, 445], estrellas: [[70, 211], [198, 282], [151, 251]], hilos: [{ pin: [70, 60] }], abanicos: [[30, 300, -0.6]], chinches: [[0, 340, 170, 340]], sol: [[0.53, 'c', 0], [0.89, 'a', 0]] },
  { id: '2-6', caramelo: [110, 120], morfi: [250, 445], estrellas: [[193, 151], [245, 186], [247, 275]], hilos: [{ pin: [40, 60] }, { pin: [180, 60] }], clips: [[220, 230, 76]], chinches: [[60, 300, 170, 300]], sol: [[1.74, 'c', 0], [2.64, 'c', 1], [3.09, 'c', 100]] },
  { id: '2-7', caramelo: [250, 380], morfi: [70, 445], estrellas: [[250, 260], [145, 181], [104, 296]], hilos: [{ pin: [250, 440] }], clips: [[140, 170, 74]], globos: [[250, 380]], abanicos: [[296, 250, PI]], sol: [[0.73, 'c', 0], [2.19, 'a', 0], [2.77, 'g'], [2.98, 'c', 100]] },
  { id: '2-8', caramelo: [160, 250], morfi: [245, 445], estrellas: [[47, 185], [273, 185], [250, 305]], hilos: [{ pin: [160, 120] }], abanicos: [[20, 270, 0], [300, 270, PI]], sol: [[0.56, 'a', 0], [1.6, 'a', 1], [2.56, 'c', 0]] },
  { id: '2-9', caramelo: [160, 420], morfi: [260, 445], estrellas: [[160, 282], [220, 181], [252, 298]], hilos: [{ pin: [160, 470] }], globos: [[160, 420]], abanicos: [[30, 120, 0.3]], chinches: [[100, 380, 100, 180], [220, 380, 220, 250]], sol: [[0.91, 'c', 0], [2.88, 'a', 0], [3.34, 'g']] },
  { id: '2-10', caramelo: [80, 150], morfi: [220, 445], estrellas: [[80, 260], [180, 117], [227, 285]], hilos: [{ pin: [80, 60] }], globos: [[80, 300]], abanicos: [[30, 250, -0.5]], chinches: [[170, 210, 170, 470]], sol: [[0.57, 'c', 0], [2.18, 'a', 0], [2.63, 'g']] },
  // ── caja 3: papel de regalo (sobres, gomitas y alfileres que se mueven) ───
  { id: '3-1', ayuda: 'ayudaSobre', caramelo: [80, 150], morfi: [240, 445], estrellas: [[80, 187], [240, 282], [80, 242]], hilos: [{ pin: [80, 70] }], sobres: [[[80, 260, -PI / 2], [240, 240, PI / 2]]], sol: [[0.5, 'c', 0]] },
  { id: '3-2', ayuda: 'ayudaGomita', caramelo: [90, 150], morfi: [255, 445], estrellas: [[90, 278], [153, 157], [245, 241]], hilos: [{ pin: [90, 70] }], elasticos: [[40, 330, 150, 345]], sol: [[0.5, 'c', 0]] },
  { id: '3-3', ayuda: 'ayudaMueve', caramelo: [60, 170], morfi: [262, 445], estrellas: [[193, 208], [223, 275], [153, 170]], hilos: [{ pin: [60, 70], mueve: { a: [60, 70], b: [260, 70], periodo: 5 } }], sol: [[1.24, 'c', 0]] },
  { id: '3-4', caramelo: [230, 150], morfi: [140, 445], estrellas: [[230, 292], [167, 157], [140, 240]], hilos: [{ pin: [230, 70] }], sobres: [[[100, 176, PI], [140, 90, PI / 2]]], elasticos: [[170, 345, 280, 330]], sol: [[0.5, 'c', 0]] },
  { id: '3-5', caramelo: [60, 160], morfi: [230, 445], estrellas: [[178, 157], [203, 238], [218, 310]], hilos: [{ pin: [60, 70] }, { pin: [120, 60], mueve: { a: [120, 60], b: [260, 60], periodo: 2.6 } }], sol: [[0.92, 'c', 0], [1.12, 'c', 1]] },
  { id: '3-6', caramelo: [60, 120], morfi: [60, 355], estrellas: [[261, 214], [218, 252], [126, 248]], hilos: [{ pin: [160, 60] }], chinches: [[20, 470, 300, 470]], elasticos: [[210, 330, 290, 270]], sol: [[0.99, 'c', 0]] },
  { id: '3-7', caramelo: [70, 120], morfi: [250, 445], estrellas: [[70, 306], [158, 207], [228, 234]], hilos: [{ pin: [70, 50] }], clips: [[170, 230, 70]], sobres: [[[260, 200, PI], [80, 330, 0.2]]], sol: [[0.55, 'c', 0], [1.95, 'c', 100]] },
  { id: '3-8', caramelo: [80, 160], morfi: [215, 445], estrellas: [[172, 116], [180, 250], [188, 312]], hilos: [{ pin: [80, 250], mueve: { a: [80, 250], b: [240, 250], periodo: 2.6 } }], globos: [[80, 160]], chinches: [[20, 40, 300, 40]], sol: [[1.16, 'c', 0], [2.06, 'g']] },
  { id: '3-9', caramelo: [60, 150], morfi: [245, 445], estrellas: [[125, 254], [133, 192], [118, 317]], hilos: [{ pin: [60, 60], mueve: { a: [60, 60], b: [240, 60], periodo: 3.2 } }], chinches: [[20, 470, 190, 470]], elasticos: [[100, 360, 200, 360]], sol: [[0.5, 'c', 0]] },
  { id: '3-10', caramelo: [160, 120], morfi: [260, 285], estrellas: [[76, 150], [234, 346], [130, 145]], hilos: [{ pin: [100, 50] }, { pin: [200, 50], mueve: { a: [200, 50], b: [290, 50], periodo: 2.4 } }], sobres: [[[260, 150, PI / 2], [40, 150, 0]]], elasticos: [[180, 400, 290, 360]], sol: [[1.21, 'c', 0], [2.03, 'c', 1]] },
];

export const nivelPorId = (id) => NIVELES.find((n) => n.id === id);
export const cajaDe = (id) => CAJAS[+id.split('-')[0] - 1];
