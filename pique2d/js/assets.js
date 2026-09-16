// Indireccion para las rutas de assets: en la version de carpeta devuelve la
// ruta tal cual; en la de archivo unico, el empaquetador registra un mapa de
// ruta -> data: URI y el juego sigue igual. Existe para que NO haya dos
// versiones del codigo, que es como se llega a que una ande y la otra no.
let MAPA = {};
export const ruta = (u) => MAPA[u] ?? u;
export function registrar(m) { MAPA = m; }
