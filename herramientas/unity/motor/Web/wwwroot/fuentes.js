// porteo: los glifos de las fuentes dinámicas de Unity (UI.Text). El motor mide con el TTF y
// arma el atlas; acá cada glifo se dibuja con el canvas 2D usando la fuente original (FontFace).
export function crearFuentes() {
  const caras = new Map();   // id → FontFace
  let lienzo = null, ctx = null;

  function registrar(id, vista) {
    const bytes = vista.slice();
    vista.dispose();
    try {
      const cara = new FontFace('porteoFuente' + id, bytes.buffer);
      document.fonts.add(cara);
      cara.load().catch((e) => console.warn('porteo: fuente ' + id, e));
      caras.set(id, cara);
    } catch (e) { console.warn('porteo: fuente ' + id, e); }
  }

  // el glifo en w×h bytes de cobertura (fila 0 arriba), con la línea de base en (ox, oy)
  function rasterizar(id, codigo, tam, estilo, ox, oy, w, h, vista) {
    const cara = caras.get(id);
    if (!cara || cara.status !== 'loaded') { vista.dispose(); return false; }
    if (!lienzo) {
      lienzo = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(64, 64) : document.createElement('canvas');
      ctx = lienzo.getContext('2d', { willReadFrequently: true });
    }
    if (lienzo.width < w || lienzo.height < h) {
      lienzo.width = Math.max(lienzo.width, w); lienzo.height = Math.max(lienzo.height, h);
    }
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${estilo & 2 ? 'italic ' : ''}${estilo & 1 ? 'bold ' : ''}${tam}px porteoFuente${id}`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(String.fromCodePoint(codigo), ox, oy);
    const datos = ctx.getImageData(0, 0, w, h).data;
    const salida = new Uint8Array(w * h);
    for (let i = 0; i < salida.length; i++) salida[i] = datos[i * 4 + 3];
    vista.set(salida);
    vista.dispose();
    return true;
  }

  return { fuenteRegistrar: registrar, fuenteRasterizar: rasterizar };
}
