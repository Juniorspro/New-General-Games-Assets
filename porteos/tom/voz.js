// La voz de Tom: lo que dijiste, más agudo, como el ZtxPlugin del juego (tempo, pitch y rate de
// TomTalkBackSettings: pitch 1,65; tempo 0,85, y 1,25 cuando Tom está cansado).
//
// Cambiar el tono sin cambiar la duración = estirar el tiempo (WSOLA: pedazos de 40 ms que se pisan
// 8 ms, cada uno corrido hasta ±7,5 ms para que empalme con el anterior) y después leer más rápido
// (remuestrear). tempo es cuánto dura el resultado respecto de lo grabado.

export function estirar(x, factor, sr) {
  const N = Math.max(16, Math.round(0.040 * sr));      // largo de cada pedazo
  const O = Math.max(4, Math.round(0.008 * sr));       // lo que se pisan
  const S = Math.max(2, Math.round(0.015 * sr));       // ventana de búsqueda
  const hs = N - O;
  const ha = hs / factor;
  const y = new Float32Array(Math.ceil(x.length * factor) + N + O);
  let pos = 0, natural = 0;
  for (let k = 0; ; k++) {
    const ideal = Math.round(k * ha);
    if (ideal + N + S >= x.length) break;
    let mejor = ideal;
    if (k > 0) {
      let bc = -Infinity;
      const desde = Math.max(0, ideal - (S >> 1)), hasta = ideal + (S >> 1);
      for (let p = desde; p <= hasta; p++) {
        let c = 0, e = 1e-9;
        for (let i = 0; i < O; i++) { const v = x[p + i]; c += v * x[natural + i]; e += v * v; }
        const cn = c / Math.sqrt(e);
        if (cn > bc) { bc = cn; mejor = p; }
      }
    }
    for (let i = 0; i < O; i++) { const w = i / O; y[pos + i] = y[pos + i] * (1 - w) + x[mejor + i] * w; }
    for (let i = O; i < N; i++) y[pos + i] = x[mejor + i];
    pos += hs;
    natural = mejor + hs;
  }
  return y.subarray(0, pos + O);
}

// Leer factor veces más rápido (interpolación lineal): más agudo y más corto.
export function remuestrear(x, factor) {
  const n = Math.floor((x.length - 1) / factor);
  const y = new Float32Array(Math.max(0, n));
  for (let i = 0; i < n; i++) {
    const t = i * factor, j = t | 0, f = t - j;
    y[i] = x[j] * (1 - f) + x[j + 1] * f;
  }
  return y;
}

export function vozTom(x, sr, { pitch = 1.65, tempo = 0.85, rate = 1 } = {}) {
  const p = pitch * rate;
  // con un poco de silencio al final para que no se coma el último pedazo
  const relleno = new Float32Array(x.length + Math.round(0.06 * sr));
  relleno.set(x);
  const y = remuestrear(estirar(relleno, tempo * p, sr), p);
  return y.subarray(0, Math.min(y.length, Math.round(x.length * tempo)));
}
