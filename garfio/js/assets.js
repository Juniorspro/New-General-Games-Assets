// De donde sale cada archivo: del disco cuando el juego esta suelto, y de un
// mapa de data: URIs cuando esta empaquetado en un solo HTML. Un solo lugar que
// lo decida evita que la mitad del codigo ande desde file:// y la otra no.
export const ruta = (p) => (globalThis.ARCHIVOS && globalThis.ARCHIVOS[p]) || p;
