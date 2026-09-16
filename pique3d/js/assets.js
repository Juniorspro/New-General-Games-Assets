// Indireccion para las rutas de assets.
//
// En la version de carpeta devuelve la ruta tal cual. En la de archivo unico,
// el empaquetador registra un mapa de ruta -> data: URI y todo el juego sigue
// funcionando sin cambiar una linea: los cargadores de three, el de GLB y el
// fetch del audio aceptan data: igual que una ruta.
//
// Existe para que NO haya dos versiones del codigo. Dos versiones es como se
// llega a que una ande y la otra no, y a que nadie se entere hasta que alguien
// abre la que no.
let MAPA = {};
export const ruta = (u) => MAPA[u] ?? u;
export function registrar(m) { MAPA = m; }
export const embebido = () => Object.keys(MAPA).length > 0;
