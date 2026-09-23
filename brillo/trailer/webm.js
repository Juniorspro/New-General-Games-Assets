/* ============================================================================
   brillo/trailer/webm.js — un muxer WebM chiquito: VP9 + Opus.
   Recibe los pedazos que dan VideoEncoder y AudioEncoder (WebCodecs) y arma
   el archivo: cabecera EBML, Segment con SeekHead, Info, Tracks, un Cluster
   por cada cuadro clave del video (con el audio intercalado por tiempo) y
   Cues al final, así el video se puede adelantar y atrasar.
   Los tiempos van en milisegundos (TimecodeScale = 1 ms).
   ========================================================================== */
const texto = new TextEncoder();

/* el largo de un elemento en el formato "vint" de EBML */
function vintTam(n) {
  for (let b = 1; b <= 8; b++) if (n < 2 ** (7 * b) - 1) { const a = new Uint8Array(b); let x = n; for (let i = b - 1; i >= 0; i--) { a[i] = x & 0xff; x = Math.floor(x / 256); } a[0] |= 1 << (8 - b); return a; }
  throw new Error('elemento demasiado grande');
}
/* un largo de 8 bytes fijo (para lo que se completa después) */
function vint8(n) { const a = new Uint8Array(8); let x = n; for (let i = 7; i >= 0; i--) { a[i] = x & 0xff; x = Math.floor(x / 256); } a[0] |= 0x01; return a; }
function idBytes(id) { const b = []; let x = id; while (x > 0) { b.unshift(x & 0xff); x = Math.floor(x / 256); } return new Uint8Array(b); }
function uint(n, bytes = 0) { const b = []; let x = n; do { b.unshift(x & 0xff); x = Math.floor(x / 256); } while (x > 0); while (b.length < bytes) b.unshift(0); return new Uint8Array(b); }
function flotante(f) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, f); return b; }
const juntar = (partes) => { let n = 0; for (const p of partes) n += p.length; const a = new Uint8Array(n); let o = 0; for (const p of partes) { a.set(p, o); o += p.length; } return a; };
/* un elemento: id + largo + contenido (el contenido puede ser una lista de elementos) */
function el(id, contenido) {
  const c = contenido instanceof Uint8Array ? contenido : juntar(contenido);
  return juntar([idBytes(id), vintTam(c.length), c]);
}
const U = (id, n, bytes) => el(id, uint(n, bytes));
const F = (id, f) => el(id, flotante(f));
const S = (id, s) => el(id, texto.encode(s));

export class MuxerWebM {
  /* v: { ancho, alto }, a: { canales, frecuencia, opusHead (Uint8Array), retardo (muestras) } o null */
  constructor(v, a) { this.v = v; this.a = a; this.video = []; this.audio = []; }
  /* ms: el tiempo del cuadro; clave: si es cuadro clave; datos: Uint8Array */
  cuadro(ms, clave, datos) { this.video.push({ ms, clave, datos }); }
  sonido(ms, datos) { this.audio.push({ ms, datos }); }
  armar(duracionMs) {
    const { v, a } = this;
    const cabecera = el(0x1a45dfa3, [U(0x4286, 1), U(0x42f7, 1), U(0x42f2, 4), U(0x42f3, 8), S(0x4282, 'webm'), U(0x4287, 4), U(0x4285, 2)]);
    const info = el(0x1549a966, [U(0x2ad7b1, 1000000), F(0x4489, duracionMs), S(0x4d80, 'brillo-trailer'), S(0x5741, 'brillo-trailer')]);
    const pistas = [el(0xae, [U(0xd7, 1), U(0x73c5, 1), U(0x83, 1), S(0x86, 'V_VP9'), el(0xe0, [U(0xb0, v.ancho), U(0xba, v.alto)])])];
    if (a) pistas.push(el(0xae, [U(0xd7, 2), U(0x73c5, 2), U(0x83, 2), S(0x86, 'A_OPUS'), el(0x63a2, a.opusHead), U(0x56aa, Math.round(a.retardo / a.frecuencia * 1e9)), U(0x56bb, 80000000), el(0xe1, [F(0xb5, a.frecuencia), U(0x9f, a.canales)])]));
    const tracks = el(0x1654ae6b, pistas);
    /* los clusters: uno por cuadro clave del video, con todo lo que cae entre ese y el siguiente */
    const eventos = [...this.video.map((q) => ({ ...q, pista: 1 })), ...this.audio.map((q) => ({ ...q, pista: 2, clave: true }))].sort((x, y) => x.ms - y.ms || x.pista - y.pista);
    const clusters = [], cues = [];
    let actual = null;
    const cerrar = () => { if (actual) clusters.push(actual); };
    for (const e of eventos) {
      const nuevo = !actual || (e.pista === 1 && e.clave) || e.ms - actual.ms > 30000;
      if (nuevo) { cerrar(); actual = { ms: Math.round(e.ms), bloques: [] }; }
      const rel = Math.round(e.ms) - actual.ms;
      const cab = new Uint8Array(4); cab[0] = 0x80 | e.pista; new DataView(cab.buffer).setInt16(1, rel); cab[3] = e.clave ? 0x80 : 0;
      actual.bloques.push(el(0xa3, juntar([cab, e.datos])));
    }
    cerrar();
    /* el SeekHead tiene tamaño fijo (posiciones de 8 bytes), así se puede calcular antes */
    const seek = (id, pos) => el(0x4dbb, [el(0x53ab, idBytes(id)), U(0x53ac, pos, 8)]);
    const tamSeek = el(0x114d9b74, [seek(0x1549a966, 0), seek(0x1654ae6b, 0), seek(0x1c53bb6b, 0)]).length;
    const posInfo = tamSeek, posTracks = posInfo + info.length;
    let pos = posTracks + tracks.length;
    const bytesClusters = clusters.map((c) => {
      const b = el(0x1f43b675, [U(0xe7, c.ms), ...c.bloques]);
      cues.push(el(0xbb, [U(0xb3, c.ms), el(0xb7, [U(0xf7, 1), U(0xf1, pos)])]));
      pos += b.length;
      return b;
    });
    const posCues = pos;
    const seekHead = el(0x114d9b74, [seek(0x1549a966, posInfo), seek(0x1654ae6b, posTracks), seek(0x1c53bb6b, posCues)]);
    const cuesEl = el(0x1c53bb6b, cues);
    const cuerpo = [seekHead, info, tracks, ...bytesClusters, cuesEl];
    const largo = cuerpo.reduce((s, b) => s + b.length, 0);
    return new Blob([cabecera, juntar([idBytes(0x18538067), vint8(largo)]), ...cuerpo], { type: 'video/webm' });
  }
}

/* la cabecera OpusHead (RFC 7845) para el CodecPrivate */
export function opusHead(canales, frecuencia, retardo) {
  const b = new Uint8Array(19), d = new DataView(b.buffer);
  b.set(texto.encode('OpusHead'), 0); b[8] = 1; b[9] = canales;
  d.setUint16(10, retardo, true); d.setUint32(12, frecuencia, true); d.setInt16(16, 0, true); b[18] = 0;
  return b;
}
