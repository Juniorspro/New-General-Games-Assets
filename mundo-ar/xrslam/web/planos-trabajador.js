// La detección de planos en su propio Worker: en una compu tarda ~0,3 s y en
// un teléfono más; en la página trabaría el dibujo.
//
//   recibe {tipo: "puntos", p: Float64Array, t}   puntos del SLAM (mundo de XRSLAM, z arriba)
//          {tipo: "detectar", cam: [x, y, z]}
//          {tipo: "borrar"}
//   manda  {tipo: "planos", planos, alturaPiso, tamano, ms}
import { MapaPlanos } from "./planos.js";

let mapa = new MapaPlanos();
onmessage = (e) => {
  const m = e.data;
  if (m.tipo === "puntos") mapa.agregar(m.p, m.t);
  else if (m.tipo === "borrar") mapa = new MapaPlanos();
  else if (m.tipo === "detectar") {
    const t0 = performance.now();
    const planos = mapa.detectar(m.cam);
    postMessage({ tipo: "planos", planos, alturaPiso: mapa.alturaPiso ?? null, tamano: mapa.tamano, ms: performance.now() - t0 });
  }
};
