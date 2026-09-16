// De donde sale cada archivo.
//
// Suelto, del disco o del servidor; empaquetado, de un mapa de data: URIs que
// arma empaquetar.py. Un solo lugar que lo decida evita que la mitad del
// codigo funcione desde file:// y la otra mitad no.
export const ruta = (p) => (globalThis.ARCHIVOS && globalThis.ARCHIVOS[p]) || p;
