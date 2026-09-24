// La calidad gráfica, y el escaneo de cuadros por segundo que la elige.
//
// Al arrancar por primera vez se dibujan cuatro lugares del campo (el rancho,
// el corral, el monte y la tropa) en calidad alta y se mide cuántos cuadros por
// segundo salen de verdad (con requestAnimationFrame: lo que tarda la placa, no
// lo que tarda JavaScript en mandar). Si sobra, se prueba ultra; si falta, se
// baja a media y, si tampoco, a baja. Lo elegido se guarda en Opciones, y de
// ahí se puede cambiar o volver a medir.
"use strict";
(() => {
  const C = (E.calidad = {});
  const V = THREE.Vector3;

  // escala: resolución interna; tope: techo del devicePixelRatio (las pantallas
  // retina a 2× cuadruplican los píxeles); sombra: lado del mapa de sombras;
  // pasto: densidad de matas.
  C.NIVELES = {
    baja: { nombre: "Baja", escala: 0.6, tope: 1, sombra: 1024, pasto: 0.4 },
    media: { nombre: "Media", escala: 0.8, tope: 1.25, sombra: 1024, pasto: 0.7 },
    alta: { nombre: "Alta", escala: 1, tope: 1.5, sombra: 2048, pasto: 1 },
    ultra: { nombre: "Ultra", escala: 1, tope: 2, sombra: 4096, pasto: 1.5 },
  };
  C.nivel = "alta";
  C.cortar = false;                      // "Saltar": el escaneo lo mira en cada cuadro

  C.aplicar = (nombre) => {
    const n = C.NIVELES[nombre] || C.NIVELES.alta, M = E.motor;
    C.nivel = nombre in C.NIVELES ? nombre : "alta";
    M.escala = n.escala; M.tope = n.tope; M.piso = Math.max(0.5, n.escala - 0.3); M.lento = 0;
    if (M.sol.shadow.mapSize.x !== n.sombra) {
      M.sol.shadow.mapSize.set(n.sombra, n.sombra);
      // Sin mapa, three arma uno nuevo del tamaño pedido en el cuadro que sigue.
      if (M.sol.shadow.map) { M.sol.shadow.map.dispose(); M.sol.shadow.map = null; }
    }
    if (E.flora.densidadPasto !== n.pasto) { E.flora.densidadPasto = n.pasto; E.flora.celdaPasto = null; }
  };

  // Los lugares que se dibujan para medir: lo más pesado del juego.
  function vistas() {
    const L = E.lugares, T = E.terreno;
    const v = (x, z, alto, mx, mz) => ({ desde: new V(x, T.altura(x, z) + alto, z), mira: new V(mx, T.altura(mx, mz) + 1.2, mz) });
    return [
      v(L.rancho.x + 14, L.rancho.z + 22, 2.2, L.rancho.x, L.rancho.z),
      v(L.corral.x - 16, L.corral.z + 12, 3, L.corral.x, L.corral.z),
      v(130, -150, 1.7, 130 - Math.sin(0.6) * 20, -150 - Math.cos(0.6) * 20),
      v(95, 75, 1.7, 95 + Math.sin(2.2) * 20, 75 + Math.cos(2.2) * 20),
    ];
  }

  const cuadro = () => new Promise((r) => requestAnimationFrame(r));
  function dibujar(vista) {
    const cam = E.motor.camara;
    // Las manos de primera persona cuelgan de la cámara: en estas vistas no van.
    E.jugador.manos.visible = false;
    cam.position.copy(vista.desde); cam.lookAt(vista.mira); cam.updateMatrixWorld();
    E.flora.actualizar(cam, 0); E.flora.actualizarPasto(cam.position); E.flora.actualizarSol(cam);
    E.motor.acomodar();
    E.motor.dibujar(0, {});
  }

  // Cuadros por segundo de un nivel: medio segundo por lugar, sin contar los
  // primeros cuadros (acomodar el lienzo y rearmar las sombras traba). En una
  // compu muy lenta un cuadro solo ya pasa el medio segundo: por eso se miden
  // cuadros enteros y no se espera a juntar muchos.
  async function medirNivel(nombre, alMedir) {
    C.aplicar(nombre);
    const ms = [];
    for (const vista of vistas()) {
      for (let i = 0; i < 2; i++) { if (C.cortar) return 0; dibujar(vista); await cuadro(); }
      const t0 = performance.now();
      let n = 0;
      while (performance.now() - t0 < 500) { if (C.cortar) return 0; dibujar(vista); await cuadro(); n++; }
      ms.push((performance.now() - t0) / n);
      alMedir(nombre, 1000 / ms[ms.length - 1]);
    }
    // El lugar más pesado manda: si el monte va a 30, el juego va a 30 ahí.
    return 1000 / Math.max(...ms);
  }

  // El escaneo entero. alMedir(nivel, fps) va contando en pantalla.
  C.escanear = async (alMedir = () => {}) => {
    const r = { fps: {}, nivel: "alta" };
    const alta = (r.fps.alta = await medirNivel("alta", alMedir));
    if (C.cortar) return null;
    if (alta >= 55) {
      const ultra = (r.fps.ultra = await medirNivel("ultra", alMedir));
      r.nivel = ultra >= 50 ? "ultra" : "alta";
    } else if (alta >= 40) r.nivel = "alta";
    else if (alta >= 22) {
      const media = (r.fps.media = await medirNivel("media", alMedir));
      r.nivel = media >= 35 ? "media" : "baja";
      if (r.nivel === "baja") r.fps.baja = await medirNivel("baja", alMedir);
    } else {
      // Tan lejos que media no alcanza: directo a baja (en una compu así cada
      // nivel medido son varios segundos de espera).
      r.nivel = "baja";
      r.fps.baja = await medirNivel("baja", alMedir);
    }
    if (C.cortar) return null;
    r.fpsFinal = r.fps[r.nivel];
    C.aplicar(r.nivel);
    return r;
  };
})();
