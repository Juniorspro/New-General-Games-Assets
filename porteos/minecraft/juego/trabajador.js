// porteo: el trabajador del mundo (Web Worker): genera los trozos, calcula la luz (cielo y bloques) y
// arma las mallas de cada sub-trozo de 16x16x16 con el formato de vértices que esperan los shaders del
// juego (los de Tito): POSITION (4 x u16, en 1/256 de bloque, corrido un bloque para que entren las
// plantas desplazadas), COLOR (4 x u8: tinte del bioma x oclusión x sombra de la cara), TEXCOORD_0
// (2 x u16, en el atlas) y TEXCOORD_1 (2 x u8: luz de bloque y de cielo, como luz/16, igual que el
// juego: el shader de Tito toma "sol pleno" por uv1.y > 0.875). 20 bytes por vértice.
// La página le manda dónde está el jugador y los bloques que se ponen o sacan; él devuelve los
// bloques de cada trozo (para la física) y las mallas.
(function () {
  'use strict';
  var F = C.F, ALTO = C.ALTO;
  var OPACO, FRENA, LUZ, FORMA, CAPA;
  var gen = null, uv = null, BL = null, dist = 6;
  var trozos = new Map();     // clave numérica → trozo
  var centro = { cx: 0, cz: 0 };
  var guardados = new Map();  // bloques de trozos guardados (llegan de la página) por clave
  var parches = new Map();    // los cambios de un mundo de servidor (por clave: Map índice → [id, meta])
  var pendientes = [];        // bloques puestos por el jugador, por aplicar
  // los ajustes de gráficos del juego que cambian las mallas: "Iluminación suave" (oclusión y luz
  // promediada en las esquinas) y "Hojas llamativas" (sin ellas, las hojas son opacas: las texturas
  // .opaque del paquete, en la capa opaca y tapando a sus vecinas, mucho menos para dibujar)
  var suave = true, hojasLlamativas = true;
  function aplicarHojas() {
    var op = hojasLlamativas ? 0 : 1, capa = hojasLlamativas ? 1 : 0;
    OPACO[18] = OPACO[161] = op; CAPA[18] = CAPA[161] = capa;
  }

  function clave(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
  function trozo(cx, cz) { return trozos.get(clave(cx, cz)); }

  // ------------------------------------------------------------------------------------------
  // Texturas por cara: el nombre de terrain_texture.json y la variante según el meta del bloque
  // ------------------------------------------------------------------------------------------
  var CARAS = ['down', 'up', 'north', 'south', 'west', 'east'];
  var TEXCARA = [];   // [id][cara] → lista de rectángulos (variantes)
  function prepararTexturas() {
    for (var id = 0; id < 256; id++) {
      var b = C.bloques[id], t = b.tex, porCara = [];
      for (var c = 0; c < 6; c++) {
        var nombre = null;
        if (typeof t === 'string') nombre = t;
        else if (t) nombre = t[CARAS[c]] || (c >= 2 ? t.side : null) || t.side || t.up;
        porCara.push(nombre && uv[nombre] ? uv[nombre].filter(Boolean) : null);
      }
      TEXCARA[id] = porCara;
    }
  }
  var VACIO = [0, 0, 0, 0];
  function tex(id, cara, variante) {
    var l = TEXCARA[id][cara];
    if (!l || !l.length) return VACIO;
    return l[variante < l.length ? variante : 0];
  }

  // ------------------------------------------------------------------------------------------
  // Trozos
  // ------------------------------------------------------------------------------------------
  function nuevo(cx, cz) {
    var t = {
      cx: cx, cz: cz, ids: new Uint8Array(16 * 16 * ALTO), meta: new Uint8Array(16 * 16 * ALTO),
      luz: new Uint8Array(16 * 16 * ALTO), biomas: new Uint8Array(256), gen: false, luzOk: false,
      malla: 0, mallaHecha: 0, enviado: false
    };
    return t;
  }

  function generar(t) {
    var g = guardados.get(clave(t.cx, t.cz));
    gen.trozo(t.cx, t.cz, t.ids, t.meta, t.biomas);
    if (g) { t.ids.set(g.ids); t.meta.set(g.meta); }
    var pa = parches.get(clave(t.cx, t.cz));
    if (pa) pa.forEach(function (v, i) { t.ids[i] = v[0]; t.meta[i] = v[1]; });
    t.gen = true;
    // la copia para la página (física, guardar)
    postMessage({ t: 'trozo', cx: t.cx, cz: t.cz, ids: t.ids.slice(), meta: t.meta.slice(), biomas: t.biomas.slice() });
  }

  // ------------------------------------------------------------------------------------------
  // Luz: en una región de 3x3 trozos (con un borde que frena todo), cielo y bloques por separado,
  // propagando a lo ancho (cada paso pierde 1, o lo que frene el bloque)
  // ------------------------------------------------------------------------------------------
  var RW = 50, RH = ALTO + 2, RA = RW * RW;            // la región: 48 + borde, de alto 128 + borde
  var rid = new Uint8Array(RA * RH), rsky = new Uint8Array(RA * RH), rblk = new Uint8Array(RA * RH);
  var cola = new Int32Array(RA * RH);
  var BORDE = 1;    // piedra en el borde: no deja pasar nada

  function llenarRegion(cx, cz) {
    rid.fill(BORDE);
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var t = trozo(cx + dx, cz + dz), ox = 1 + (dx + 1) * 16, oz = 1 + (dz + 1) * 16;
        if (!t) continue;
        var ids = t.ids;
        for (var y = 0; y < ALTO; y++) {
          var base = (y + 1) * RA, src = y << 8;
          for (var z = 0; z < 16; z++) {
            var fila = base + (oz + z) * RW + ox, s = src + (z << 4);
            for (var x = 0; x < 16; x++) rid[fila + x] = ids[s + x];
          }
        }
      }
    }
    // arriba de todo, aire (el cielo entra por ahí)
    rid.fill(0, (RH - 1) * RA, RH * RA);
  }

  function propagar(luz, n) {
    var cab = 0;
    while (cab < n) {
      var i = cola[cab++], L = luz[i];
      if (L <= 1) continue;
      var v = i - 1;
      for (var k = 0; k < 6; k++) {
        v = k === 0 ? i - 1 : k === 1 ? i + 1 : k === 2 ? i - RW : k === 3 ? i + RW : k === 4 ? i - RA : i + RA;
        var f = FRENA[rid[v]];
        if (f >= 15) continue;
        var nl = L - (f > 1 ? f : 1);
        if (nl > luz[v]) { luz[v] = nl; cola[n++] = v; }
      }
    }
  }

  function iluminar(t) {
    llenarRegion(t.cx, t.cz);
    rsky.fill(0); rblk.fill(0);
    var n = 0, x, z, y, i;
    // el sol baja derecho hasta lo que lo frena
    var tope = new Uint8Array(RA);
    for (z = 1; z < RW - 1; z++) {
      for (x = 1; x < RW - 1; x++) {
        var c = z * RW + x, s = 15, primero = 0;
        rsky[(RH - 1) * RA + c] = 15;
        for (y = RH - 2; y >= 1; y--) {
          i = y * RA + c;
          var f = FRENA[rid[i]];
          if (f >= 15) { s = 0; if (!primero) primero = y; break; }
          if (f > 0) { s = s > f ? s - f : 0; if (!primero) primero = y; }
          rsky[i] = s;
          if (s === 0) break;
        }
        tope[c] = primero;
      }
    }
    // de dónde puede salir luz de costado: las celdas con sol que están debajo del tope de alguna
    // columna vecina
    for (z = 1; z < RW - 1; z++) {
      for (x = 1; x < RW - 1; x++) {
        c = z * RW + x;
        var m = Math.max(tope[c - 1], tope[c + 1], tope[c - RW], tope[c + RW], tope[c]);
        for (y = 1; y <= m + 1 && y < RH - 1; y++) {
          i = y * RA + c;
          if (rsky[i] > 1) cola[n++] = i;
        }
      }
    }
    propagar(rsky, n);
    // los bloques que dan luz
    n = 0;
    for (i = RA; i < (RH - 1) * RA; i++) {
      var l = LUZ[rid[i]];
      if (l) { rblk[i] = l; cola[n++] = i; }
    }
    if (n) propagar(rblk, n);
    // el centro de la región es el trozo
    var luz = t.luz;
    for (y = 0; y < ALTO; y++) {
      var base = (y + 1) * RA, dst = y << 8;
      for (z = 0; z < 16; z++) {
        var fila = base + (17 + z) * RW + 17, d = dst + (z << 4);
        for (x = 0; x < 16; x++) luz[d + x] = (rsky[fila + x] << 4) | rblk[fila + x];
      }
    }
    t.luzOk = true;
    t.malla = 0xFF;   // todos los sub-trozos, a rehacer
  }

  // ------------------------------------------------------------------------------------------
  // Mallas
  // ------------------------------------------------------------------------------------------
  var LW = 18, LA = LW * LW;      // copia local del sub-trozo con un bloque de borde
  var lid = new Uint8Array(LA * LW), lme = new Uint8Array(LA * LW), lsky = new Uint8Array(LA * LW), lblk = new Uint8Array(LA * LW);
  var lbio = new Uint8Array(LA);  // bioma por columna (con borde)

  function llenarLocal(cx, cz, sy) {
    var y0 = sy * 16 - 1;
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var t = trozo(cx + dx, cz + dz);
        // el rango de x/z de este vecino que cae en la copia local
        var xa = dx < 0 ? 15 : 0, xb = dx > 0 ? 0 : 15, za = dz < 0 ? 15 : 0, zb = dz > 0 ? 0 : 15;
        var lx0 = dx < 0 ? 0 : dx === 0 ? 1 : 17, lz0 = dz < 0 ? 0 : dz === 0 ? 1 : 17;
        for (var ly = 0; ly < LW; ly++) {
          var y = y0 + ly;
          for (var z = za; z <= zb; z++) {
            for (var x = xa; x <= xb; x++) {
              var li = ly * LA + (lz0 + z - za) * LW + lx0 + x - xa;
              if (!t || y < 0 || y >= ALTO) {
                lid[li] = y < 0 ? 7 : 0; lme[li] = 0; lsky[li] = y >= ALTO ? 15 : 0; lblk[li] = 0;
                continue;
              }
              var i = (y << 8) | (z << 4) | x, L = t.luz[i];
              lid[li] = t.ids[i]; lme[li] = t.meta[i]; lsky[li] = L >> 4; lblk[li] = L & 15;
              if (ly === 0) lbio[(lz0 + z - za) * LW + lx0 + x - xa] = t.biomas[(z << 4) | x];
            }
          }
        }
      }
    }
  }

  // salida: un búfer que crece, por capa
  function Salida() { this.buf = new ArrayBuffer(20 * 4 * 1024); this.dv = new DataView(this.buf); this.u8 = new Uint8Array(this.buf); this.n = 0; this.oy = 0; }
  // lugar para lo más que puede sacar un bloque (una cerca con todos sus brazos)
  Salida.prototype.lugar = function () {
    if ((this.n + 512) * 20 > this.buf.byteLength) {
      var b = new ArrayBuffer(this.buf.byteLength * 2);
      new Uint8Array(b).set(this.u8);
      this.buf = b; this.dv = new DataView(b); this.u8 = new Uint8Array(b);
    }
  };
  var salidas = [new Salida(), new Salida(), new Salida(), new Salida()];

  // un vértice: posición en bloques (relativa al sub-trozo), color, uv, luz (0..15, puede ser
  // fraccionaria por el suavizado)
  function vert(s, x, y, z, r, g, b, a, u, v, bl, sk) {
    var o = s.n * 20, dv = s.dv;
    dv.setUint16(o, Math.round((x + 1) * 256), true);
    dv.setUint16(o + 2, Math.round((y + s.oy + 1) * 256), true);
    dv.setUint16(o + 4, Math.round((z + 1) * 256), true);
    dv.setUint16(o + 6, 0, true);
    var u8 = s.u8;
    u8[o + 8] = r; u8[o + 9] = g; u8[o + 10] = b; u8[o + 11] = a;
    dv.setUint16(o + 12, Math.round(u * 65535), true);
    dv.setUint16(o + 14, Math.round(v * 65535), true);
    u8[o + 16] = Math.round(bl * 15.9375); u8[o + 17] = Math.round(sk * 15.9375);
    u8[o + 18] = 0; u8[o + 19] = 0;
    s.n++;
  }

  // las caras de un cubo: esquinas (en orden antihorario visto de afuera), normal, uv por esquina
  var CUBO = [
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], sombra: 0.5 },
    { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]], sombra: 1.0 },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], sombra: 0.8 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], sombra: 0.8 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], sombra: 0.6 },
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], sombra: 0.6 }
  ];
  // por cara y esquina: los desplazamientos (en la copia local) de las dos celdas de costado
  var VEC = [];
  (function () {
    for (var f = 0; f < 6; f++) {
      var cara = CUBO[f], n = cara.n, eje = n[0] ? 0 : n[1] ? 1 : 2, por = [];
      var otros = [0, 1, 2].filter(function (e) { return e !== eje; });
      for (var k = 0; k < 4; k++) {
        var esq = cara.c[k], d1 = [0, 0, 0], d2 = [0, 0, 0];
        d1[otros[0]] = esq[otros[0]] ? 1 : -1;
        d2[otros[1]] = esq[otros[1]] ? 1 : -1;
        por.push([d1[0] + d1[1] * LA + d1[2] * LW, d2[0] + d2[1] * LA + d2[2] * LW]);
      }
      VEC.push({ n: n[0] + n[1] * LA + n[2] * LW, esq: por });
    }
  })();

  // colores de bioma, con promedio de 3x3 columnas (transición suave)
  var tintes = new Float32Array(3);
  function tinte(tipo, lx, lz) {
    if (tipo === 4) { tintes[0] = 0x61 / 255; tintes[1] = 0x99 / 255; tintes[2] = 0x61 / 255; return; }   // abeto
    if (tipo === 5) { tintes[0] = 0x80 / 255; tintes[1] = 0xa7 / 255; tintes[2] = 0x55 / 255; return; }   // abedul
    var r = 0, g = 0, b = 0;
    for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
      var bio = Gen.BIOMAS[lbio[(lz + dz) * LW + lx + dx]] || Gen.BIOMAS[1];
      var c = tipo === 1 ? bio[1] : bio[2];
      r += c >> 16; g += (c >> 8) & 255; b += c & 255;
    }
    tintes[0] = r / 9 / 255; tintes[1] = g / 9 / 255; tintes[2] = b / 9 / 255;
  }

  // una cara de cubo entera con oclusión y luz suave (como el "smooth lighting" del juego)
  var aoE = new Float32Array(4), blE = new Float32Array(4), skE = new Float32Array(4);
  function caraCubo(s, li, lx, ly, lz, f, rect, tr, tg, tb, alfa, alto) {
    var V = VEC[f], ln = li + V.n, cara = CUBO[f];
    var b0 = lblk[ln], s0 = lsky[ln];
    for (var k = 0; k < 4; k++) {
      if (!suave) { aoE[k] = 1; blE[k] = b0; skE[k] = s0; continue; }
      var e = V.esq[k], c1 = ln + e[0], c2 = ln + e[1], cc = c1 + e[1];
      var o1 = OPACO[lid[c1]], o2 = OPACO[lid[c2]], oc = (o1 && o2) ? 1 : OPACO[lid[cc]];
      aoE[k] = (1 + (o1 ? 0.2 : 1) + (o2 ? 0.2 : 1) + (oc ? 0.2 : 1)) * 0.25;
      blE[k] = (b0 + (o1 ? b0 : lblk[c1]) + (o2 ? b0 : lblk[c2]) + (oc ? b0 : lblk[cc])) * 0.25;
      skE[k] = (s0 + (o1 ? s0 : lsky[c1]) + (o2 ? s0 : lsky[c2]) + (oc ? s0 : lsky[cc])) * 0.25;
    }
    var sh = cara.sombra, u0 = rect[0], v0 = rect[1], du = rect[2] - u0, dv = rect[3] - v0;
    // el triángulo se parte por la diagonal con menos oclusión (si no, la sombra se ve torcida)
    var ini = (aoE[0] + aoE[2] < aoE[1] + aoE[3]) ? 1 : 0;
    for (var q = 0; q < 4; q++) {
      k = (q + ini) & 3;
      var c = cara.c[k], m = aoE[k] * sh, t = cara.uv[k];
      var y = c[1];
      if (alto !== 1 && y === 1) y = alto;
      var tv = t[1];
      if (alto !== 1 && f > 1) tv = 1 - (1 - tv) * alto;   // el costado de un bloque bajo: la parte de abajo de la textura
      vert(s, lx + c[0], ly + y, lz + c[2], tr * m * 255, tg * m * 255, tb * m * 255, alfa, u0 + du * t[0], v0 + dv * tv, blE[k], skE[k]);
    }
  }

  // una caja cualquiera (losas, cercas, antorchas...): luz plana, la máxima de la celda y sus vecinas
  function luzPlana(li) {
    var b = lblk[li], s = lsky[li];
    for (var k = 0; k < 6; k++) {
      var v = li + VEC[k].n;
      if (lblk[v] > b) b = lblk[v];
      if (lsky[v] > s) s = lsky[v];
    }
    blE[0] = b; skE[0] = s;
  }
  function caja(s, li, lx, ly, lz, x0, y0, z0, x1, y1, z1, texs, tr, tg, tb, todas) {
    var bl = blE[0], sk = skE[0];
    var lim = [[x0, y0, z0], [x1, y1, z1]];
    for (var f = 0; f < 6; f++) {
      var cara = CUBO[f], n = cara.n;
      // una cara en el borde del bloque se tapa si el vecino es opaco
      if (!todas) {
        var enBorde = (n[0] < 0 && x0 === 0) || (n[0] > 0 && x1 === 1) || (n[1] < 0 && y0 === 0) || (n[1] > 0 && y1 === 1) ||
          (n[2] < 0 && z0 === 0) || (n[2] > 0 && z1 === 1);
        if (enBorde && OPACO[lid[li + VEC[f].n]]) continue;
      }
      var rect = texs[f];
      if (rect === VACIO) continue;
      var sh = cara.sombra, u0 = rect[0], v0 = rect[1], du = rect[2] - u0, dv = rect[3] - v0;
      for (var k = 0; k < 4; k++) {
        var c = cara.c[k];
        var px = lim[c[0]][0], py = lim[c[1]][1], pz = lim[c[2]][2];
        // la textura se recorta a la parte de la cara que ocupa la caja (como el juego)
        var tu, tv;
        if (f < 2) { tu = px; tv = pz; }
        else if (f < 4) { tu = f === 2 ? 1 - px : px; tv = 1 - py; }
        else { tu = f === 4 ? pz : 1 - pz; tv = 1 - py; }
        vert(s, lx + px, ly + py, lz + pz, tr * sh * 255, tg * sh * 255, tb * sh * 255, 255,
          u0 + du * tu, v0 + dv * tv, bl, sk);
      }
    }
  }

  // una cruz (plantas): dos planos en diagonal, de los dos lados (el shader descarta el alfa)
  function cruz(s, lx, ly, lz, rect, tr, tg, tb, dx, dz, alto) {
    var bl = blE[0], sk = skE[0], u0 = rect[0], v0 = rect[1], u1 = rect[2], v1 = rect[3];
    var a = 0.05, b = 0.95, h = alto || 1;   // de punta a punta, como el juego (0,5 ± 0,45)
    for (var p = 0; p < 2; p++) {
      var xa = lx + a + dx, za = lz + (p ? b : a) + dz, xb = lx + b + dx, zb = lz + (p ? a : b) + dz;
      // frente
      vert(s, xa, ly, za, tr * 255, tg * 255, tb * 255, 255, u0, v1, bl, sk);
      vert(s, xb, ly, zb, tr * 255, tg * 255, tb * 255, 255, u1, v1, bl, sk);
      vert(s, xb, ly + h, zb, tr * 255, tg * 255, tb * 255, 255, u1, v0, bl, sk);
      vert(s, xa, ly + h, za, tr * 255, tg * 255, tb * 255, 255, u0, v0, bl, sk);
      // dorso
      vert(s, xb, ly, zb, tr * 255, tg * 255, tb * 255, 255, u1, v1, bl, sk);
      vert(s, xa, ly, za, tr * 255, tg * 255, tb * 255, 255, u0, v1, bl, sk);
      vert(s, xa, ly + h, za, tr * 255, tg * 255, tb * 255, 255, u0, v0, bl, sk);
      vert(s, xb, ly + h, zb, tr * 255, tg * 255, tb * 255, 255, u1, v0, bl, sk);
    }
  }

  // un plano de los dos lados (escaleras de mano, enredaderas, rieles)
  function plano(s, p, rect, tr, tg, tb) {
    var bl = blE[0], sk = skE[0], u = [rect[0], rect[2], rect[2], rect[0]], v = [rect[3], rect[3], rect[1], rect[1]];
    for (var k = 0; k < 4; k++) vert(s, p[k][0], p[k][1], p[k][2], tr * 255, tg * 255, tb * 255, 255, u[k], v[k], bl, sk);
    for (k = 3; k >= 0; k--) vert(s, p[k][0], p[k][1], p[k][2], tr * 255, tg * 255, tb * 255, 255, u[k], v[k], bl, sk);
  }

  var seisTex = [VACIO, VACIO, VACIO, VACIO, VACIO, VACIO];
  function texsDe(id, variante) {
    for (var f = 0; f < 6; f++) seisTex[f] = tex(id, f, variante);
    return seisTex;
  }

  // altura del agua de una celda (0 = no es líquido)
  function altLiquido(id, m) {
    if (FORMA[id] !== F.liquido) return 0;
    var nivel = m & 7;
    return nivel === 0 ? 0.875 : Math.max(0.1, 0.875 - nivel / 8);
  }

  function mallar(t, sy) {
    llenarLocal(t.cx, t.cz, sy);
    // las alturas van relativas a la columna entera (0 a 128): la página junta los 8 sub-trozos de
    // una columna en un solo búfer y los dibuja con una llamada por capa
    for (var c = 0; c < C.CAPAS; c++) { salidas[c].n = 0; salidas[c].oy = sy * 16; }
    var dx, dz;
    for (var ly = 1; ly <= 16; ly++) {
      for (var lz = 1; lz <= 16; lz++) {
        for (var lx = 1; lx <= 16; lx++) {
          var li = ly * LA + lz * LW + lx, id = lid[li];
          if (id === 0) continue;
          var forma = FORMA[id];
          if (forma === F.nada) continue;
          var m = lme[li], b = C.bloques[id], capa = CAPA[id], s = salidas[capa];
          var x = lx - 1, y = ly - 1, z = lz - 1, tr = 1, tg = 1, tb = 1, f, rect, variante = m;
          s.lugar();
          if (b.tinte) {
            tinte(b.tinte === 2 && id === 18 ? ((m & 3) === 1 ? 4 : (m & 3) === 2 ? 5 : 2) : b.tinte, lx, lz);
            tr = tintes[0]; tg = tintes[1]; tb = tintes[2];
          }
          if (forma === F.cubo || forma === F.tronco) {
            // texturas y variantes según el bloque
            var hojas = id === 18 || id === 161;
            if (hojas) {
              variante = m & 3;
              // sin hojas llamativas: la variante opaca (la segunda mitad de la lista de texturas)
              if (!hojasLlamativas) variante += TEXCARA[id][0] ? TEXCARA[id][0].length >> 1 : 0;
            }
            if (id === 2) variante = Gen.BIOMAS[lbio[lz * LW + lx]][3];
            for (f = 0; f < 6; f++) {
              var vec = lid[li + VEC[f].n];
              if (OPACO[vec]) continue;
              // los vidrios no muestran la cara contra otro igual; el hielo tampoco
              if ((id === 20 || id === 79 || id === 90 || id === 241 || id === 207 || id === 165) && vec === id) continue;
              // ni las hojas contra otras hojas (como las "hojas inteligentes"): adentro de una copa no
              // se ven y en la selva o el bosque oscuro eran la mayor parte de lo dibujado (440.000
              // cuadrados de hojas a distancia 6 en la selva; así, una séptima parte)
              if (hojas && (vec === 18 || vec === 161)) continue;
              var cara = f;
              if (forma === F.tronco) {
                var eje = (m >> 2) & 3;   // 0 vertical, 1 este-oeste, 2 norte-sur
                if (eje === 1) cara = f < 2 ? 4 : f >= 4 ? 0 : f;
                else if (eje === 2) cara = f < 2 ? 2 : f === 2 || f === 3 ? 0 : f;
                variante = m & 3;
              }
              rect = tex(id, cara, variante);
              if (rect === VACIO) continue;
              var ttr = tr, ttg = tg, ttb = tb;
              if (id === 2 && f !== 1) { ttr = ttg = ttb = 1; }    // al pasto sólo se le tiñe arriba
              caraCubo(s, li, x, y, z, f, rect, ttr, ttg, ttb, 255, 1);
            }
          } else if (forma === F.liquido) {
            var alto = altLiquido(id, m);
            var arriba = lid[li + LA];
            if (FORMA[arriba] === F.liquido && ((arriba === 8 || arriba === 9) === (id === 8 || id === 9))) alto = 1;
            for (f = 0; f < 6; f++) {
              var vv = lid[li + VEC[f].n];
              if (OPACO[vv] && f !== 1) continue;
              if (FORMA[vv] === F.liquido && ((vv === 8 || vv === 9) === (id === 8 || id === 9))) continue;
              if (f === 1 && OPACO[vv] && alto === 1) continue;
              rect = tex(id, f, 0);
              if (id === 8 || id === 9) { tr = 1; tg = 1; tb = 1; }
              caraCubo(s, li, x, y, z, f, rect, tr, tg, tb, id === 8 || id === 9 ? 166 : 255, alto);
            }
          } else if (forma === F.cruz || forma === F.planta2 || forma === F.tallo) {
            luzPlana(li);
            variante = m;
            if (id === 6) variante = m & 7;
            var cara2 = 0;
            if (forma === F.planta2) { cara2 = (m & 8) ? 1 : 0; variante = m & 7; if (m & 8) variante = lme[li - LA] & 7; }
            rect = tex(id, cara2, variante);
            if (rect === VACIO) continue;
            // un corrimiento chico al azar por posición, como el pasto del juego
            var hh = ((lx * 3129871) ^ (lz * 116129781) ^ ly) >>> 0;
            dx = id === 31 || id === 175 ? ((hh & 15) / 15 - 0.5) * 0.3 : 0;
            dz = id === 31 || id === 175 ? (((hh >> 4) & 15) / 15 - 0.5) * 0.3 : 0;
            if (forma === F.planta2 && !(id === 175 && ((variante === 2) || (variante === 3)))) { tr = tg = tb = 1; }
            cruz(s, x, y, z, rect, tr, tg, tb, dx, dz, forma === F.tallo ? (m + 1) / 8 : 1);
          } else if (forma === F.surcos) {
            luzPlana(li);
            rect = tex(id, 0, m & 7);
            for (var p = 0; p < 4; p++) {
              var a = p < 2 ? 0.25 + (p & 1) * 0.5 : 0, eje2 = p < 2;
              var q0 = eje2 ? [x + a, z] : [x, z + 0.25 + (p & 1) * 0.5], q1 = eje2 ? [x + a, z + 1] : [x + 1, z + 0.25 + (p & 1) * 0.5];
              plano(s, [[q0[0], y - 1 / 16, q0[1]], [q1[0], y - 1 / 16, q1[1]], [q1[0], y + 15 / 16, q1[1]], [q0[0], y + 15 / 16, q0[1]]], rect, 1, 1, 1);
            }
          } else if (forma === F.losa) {
            luzPlana(li);
            var arribaL = (m & 8) !== 0;
            if (id === 26 || id === 92) arribaL = false;
            var tx = texsDe(id, m & 7);
            caja(s, li, x, y, z, 0, arribaL ? 0.5 : 0, 0, 1, arribaL ? 1 : (id === 92 ? 0.5 : 0.5625), 1, tx, 1, 1, 1);
          } else if (forma === F.escalera) {
            luzPlana(li);
            tx = texsDe(id, 0);
            var invertida = (m & 4) !== 0, dir = m & 3;
            caja(s, li, x, y, z, 0, invertida ? 0.5 : 0, 0, 1, invertida ? 1 : 0.5, 1, tx, 1, 1, 1);
            // el escalón: hacia el lado que mira (0 este, 1 oeste, 2 sur, 3 norte)
            var bx0 = dir === 0 ? 0.5 : 0, bx1 = dir === 1 ? 0.5 : 1, bz0 = dir === 2 ? 0.5 : 0, bz1 = dir === 3 ? 0.5 : 1;
            caja(s, li, x, y, z, bx0, invertida ? 0 : 0.5, bz0, bx1, invertida ? 0.5 : 1, bz1, tx, 1, 1, 1);
          } else if (forma === F.bajo || forma === F.capa || forma === F.alfombra) {
            luzPlana(li);
            var altoB = forma === F.bajo ? 15 / 16 : forma === F.alfombra ? 1 / 16 : ((m & 7) + 1) / 8;
            tx = texsDe(id, forma === F.alfombra ? m : 0);
            caja(s, li, x, y, z, 0, 0, 0, 1, altoB, 1, tx, 1, 1, 1);
          } else if (forma === F.cactus) {
            luzPlana(li);
            tx = texsDe(id, 0);
            caja(s, li, x, y, z, 1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16, tx, 1, 1, 1, true);
          } else if (forma === F.antorcha) {
            luzPlana(li);
            blE[0] = Math.max(blE[0], LUZ[id]);
            rect = tex(id, 0, 0);
            antorcha(s, x, y, z, m, rect);
          } else if (forma === F.pared) {
            luzPlana(li);
            rect = tex(id, 0, 0);
            if (id === 65) {
              // escalera de mano: pegada a la pared según el meta (2 norte, 3 sur, 4 oeste, 5 este)
              var e = 0.05;
              var P = m === 2 ? [[x + 1, y, z + 1 - e], [x, y, z + 1 - e], [x, y + 1, z + 1 - e], [x + 1, y + 1, z + 1 - e]]
                : m === 3 ? [[x, y, z + e], [x + 1, y, z + e], [x + 1, y + 1, z + e], [x, y + 1, z + e]]
                : m === 4 ? [[x + 1 - e, y, z], [x + 1 - e, y, z + 1], [x + 1 - e, y + 1, z + 1], [x + 1 - e, y + 1, z]]
                : [[x + e, y, z + 1], [x + e, y, z], [x + e, y + 1, z], [x + e, y + 1, z + 1]];
              plano(s, P, rect, 1, 1, 1);
            } else {
              // enredadera: en cada lado marcado (1 sur, 2 oeste, 4 norte, 8 este)
              var w = 0.05;
              if (m & 1) plano(s, [[x, y, z + 1 - w], [x + 1, y, z + 1 - w], [x + 1, y + 1, z + 1 - w], [x, y + 1, z + 1 - w]], rect, tr, tg, tb);
              if (m & 2) plano(s, [[x + w, y, z], [x + w, y, z + 1], [x + w, y + 1, z + 1], [x + w, y + 1, z]], rect, tr, tg, tb);
              if (m & 4) plano(s, [[x, y, z + w], [x + 1, y, z + w], [x + 1, y + 1, z + w], [x, y + 1, z + w]], rect, tr, tg, tb);
              if (m & 8) plano(s, [[x + 1 - w, y, z], [x + 1 - w, y, z + 1], [x + 1 - w, y + 1, z + 1], [x + 1 - w, y + 1, z]], rect, tr, tg, tb);
              if (!m) plano(s, [[x, y + 1 - w, z], [x + 1, y + 1 - w, z], [x + 1, y + 1 - w, z + 1], [x, y + 1 - w, z + 1]], rect, tr, tg, tb);
            }
          } else if (forma === F.nenufar) {
            luzPlana(li);
            rect = tex(id, 0, 0);
            plano(s, [[x, y + 0.02, z], [x + 1, y + 0.02, z], [x + 1, y + 0.02, z + 1], [x, y + 0.02, z + 1]], rect, tr, tg, tb);
          } else if (forma === F.riel) {
            luzPlana(li);
            rect = tex(id, 0, 0);
            plano(s, [[x, y + 0.02, z + 1], [x + 1, y + 0.02, z + 1], [x + 1, y + 0.02, z], [x, y + 0.02, z]], rect, 1, 1, 1);
          } else if (forma === F.cerca || forma === F.muro || forma === F.panel) {
            luzPlana(li);
            tx = texsDe(id, forma === F.cerca ? (id === 85 ? m : 0) : m);
            var grosor = forma === F.panel ? 1 / 16 : forma === F.muro ? 4 / 16 : 2 / 16, alt2 = forma === F.muro ? 13 / 16 : 1;
            var c0 = 0.5 - grosor, c1 = 0.5 + grosor;
            if (forma !== F.panel) caja(s, li, x, y, z, c0, 0, c0, c1, forma === F.muro ? 1 : 1, c1, tx, 1, 1, 1, true);
            var une = function (v) { return OPACO[v] || FORMA[v] === forma || (forma === F.panel && FORMA[v] === F.panel); };
            var bajo = forma === F.cerca ? 6 / 16 : 0, alto2 = forma === F.cerca ? 15 / 16 : alt2;
            var g0 = forma === F.cerca ? 0.5 - 1 / 16 : c0, g1 = forma === F.cerca ? 0.5 + 1 / 16 : c1;
            var nN = une(lid[li - LW]), nS = une(lid[li + LW]), nO = une(lid[li - 1]), nE = une(lid[li + 1]);
            if (forma === F.panel && !nN && !nS && !nO && !nE) { nN = nS = nO = nE = true; }
            if (nN) caja(s, li, x, y, z, g0, bajo, 0, g1, alto2, c0, tx, 1, 1, 1, true);
            if (nS) caja(s, li, x, y, z, g0, bajo, c1, g1, alto2, 1, tx, 1, 1, 1, true);
            if (nO) caja(s, li, x, y, z, 0, bajo, g0, c0, alto2, g1, tx, 1, 1, 1, true);
            if (nE) caja(s, li, x, y, z, c1, bajo, g0, 1, alto2, g1, tx, 1, 1, 1, true);
            if (forma === F.cerca) {
              if (nN) caja(s, li, x, y, z, g0, 12 / 16, 0, g1, 15 / 16, c0, tx, 1, 1, 1, true);
              if (nS) caja(s, li, x, y, z, g0, 12 / 16, c1, g1, 15 / 16, 1, tx, 1, 1, 1, true);
              if (nO) caja(s, li, x, y, z, 0, 12 / 16, g0, c0, 15 / 16, g1, tx, 1, 1, 1, true);
              if (nE) caja(s, li, x, y, z, c1, 12 / 16, g0, 1, 15 / 16, g1, tx, 1, 1, 1, true);
            }
          } else if (forma === F.puerta) {
            luzPlana(li);
            var superior = (m & 8) !== 0, mm = superior ? lme[li - LA] : m;
            var abierta = (mm & 4) !== 0, giro = mm & 3;
            rect = tex(id, superior ? 2 : 1, 0);
            tx = [rect, rect, rect, rect, rect, rect];
            var d2 = (giro + (abierta ? 1 : 0)) & 3, g = 3 / 16;
            if (d2 === 0) caja(s, li, x, y, z, 0, 0, 0, g, 1, 1, tx, 1, 1, 1, true);
            else if (d2 === 1) caja(s, li, x, y, z, 0, 0, 0, 1, 1, g, tx, 1, 1, 1, true);
            else if (d2 === 2) caja(s, li, x, y, z, 1 - g, 0, 0, 1, 1, 1, tx, 1, 1, 1, true);
            else caja(s, li, x, y, z, 0, 0, 1 - g, 1, 1, 1, tx, 1, 1, 1, true);
          } else if (forma === F.trampilla) {
            luzPlana(li);
            tx = texsDe(id, 0);
            if (m & 4) {
              var dd = m & 3;
              if (dd === 0) caja(s, li, x, y, z, 0, 0, 1 - 3 / 16, 1, 1, 1, tx, 1, 1, 1, true);
              else if (dd === 1) caja(s, li, x, y, z, 0, 0, 0, 1, 1, 3 / 16, tx, 1, 1, 1, true);
              else if (dd === 2) caja(s, li, x, y, z, 1 - 3 / 16, 0, 0, 1, 1, 1, tx, 1, 1, 1, true);
              else caja(s, li, x, y, z, 0, 0, 0, 3 / 16, 1, 1, tx, 1, 1, 1, true);
            } else caja(s, li, x, y, z, 0, (m & 8) ? 13 / 16 : 0, 0, 1, (m & 8) ? 1 : 3 / 16, 1, tx, 1, 1, 1, true);
          } else if (forma === F.fuego) {
            luzPlana(li);
            rect = tex(id, 0, 0);
            cruz(s, x, y, z, rect, 1, 1, 1, 0, 0, 1);
          }
        }
      }
    }
    var capas = [], cuantos = [];
    for (c = 0; c < C.CAPAS; c++) {
      var so = salidas[c];
      capas.push(so.buf.slice(0, so.n * 20));
      cuantos.push(so.n >> 2);
    }
    postMessage({ t: 'malla', cx: t.cx, cz: t.cz, sy: sy, capas: capas, quads: cuantos }, capas);
  }

  function antorcha(s, x, y, z, m, rect) {
    var bl = blE[0], sk = skE[0];
    var u0 = rect[0], v0 = rect[1], du = rect[2] - u0, dv = rect[3] - v0;
    // inclinada según el meta, como el juego: 1 pegada a la pared del oeste (mira al este), 2 a la del
    // este, 3 a la del norte, 4 a la del sur; 5 (o 0) parada en el piso. La base va contra la pared y
    // la punta se separa
    var ix = 0, iz = 0, sube = 0;
    if (m === 1) { ix = 0.4; sube = 0.2; } else if (m === 2) { ix = -0.4; sube = 0.2; }
    else if (m === 3) { iz = 0.4; sube = 0.2; } else if (m === 4) { iz = -0.4; sube = 0.2; }
    var cx = x + 0.5 - ix * 1.25, cz = z + 0.5 - iz * 1.25, y0 = y + sube, y1 = y0 + 10 / 16, lx = ix, lz = iz;
    var a = 1 / 16;
    // cuatro planos a 1/16 del centro, con la textura entera (el resto se descarta por alfa)
    var lados = [
      [[cx - 0.5, cz - a], [cx + 0.5, cz - a]], [[cx + 0.5, cz + a], [cx - 0.5, cz + a]],
      [[cx - a, cz + 0.5], [cx - a, cz - 0.5]], [[cx + a, cz - 0.5], [cx + a, cz + 0.5]]
    ];
    for (var k = 0; k < 4; k++) {
      var p0 = lados[k][0], p1 = lados[k][1];
      vert(s, p0[0], y0, p0[1], 255, 255, 255, 255, u0, v0 + dv * 1, bl, sk);
      vert(s, p1[0], y0, p1[1], 255, 255, 255, 255, u0 + du, v0 + dv * 1, bl, sk);
      vert(s, p1[0] + lx, y0 + 1, p1[1] + lz, 255, 255, 255, 255, u0 + du, v0, bl, sk);
      vert(s, p0[0] + lx, y0 + 1, p0[1] + lz, 255, 255, 255, 255, u0, v0, bl, sk);
    }
    // la punta
    var tx = cx + lx * 0.625, tz = cz + lz * 0.625;
    var su0 = u0 + du * 7 / 16, su1 = u0 + du * 9 / 16, sv0 = v0 + dv * 6 / 16, sv1 = v0 + dv * 8 / 16;
    vert(s, tx - a, y1, tz - a, 255, 255, 255, 255, su0, sv0, bl, sk);
    vert(s, tx - a, y1, tz + a, 255, 255, 255, 255, su0, sv1, bl, sk);
    vert(s, tx + a, y1, tz + a, 255, 255, 255, 255, su1, sv1, bl, sk);
    vert(s, tx + a, y1, tz - a, 255, 255, 255, 255, su1, sv0, bl, sk);
  }

  // ------------------------------------------------------------------------------------------
  // El bucle de trabajo: de a una cosa por vuelta, lo más cercano al jugador primero
  // ------------------------------------------------------------------------------------------
  function d2(t) { var dx = t.cx - centro.cx, dz = t.cz - centro.cz; return dx * dx + dz * dz; }
  function vecinosCon(t, prop) {
    for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
      var v = trozo(t.cx + dx, t.cz + dz);
      if (!v || !v[prop]) return false;
    }
    return true;
  }

  var listaGen = [];
  function planificar() {
    // los trozos que tiene que haber: generados hasta dist + 3 (la luz de uno necesita sus 8
    // vecinos generados, y la malla, sus 8 vecinos con luz)
    var R = dist + 3;
    listaGen.length = 0;
    for (var dz = -R; dz <= R; dz++) for (var dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      var cx = centro.cx + dx, cz = centro.cz + dz, k = clave(cx, cz);
      if (!trozos.has(k)) trozos.set(k, nuevo(cx, cz));
    }
    // los lejanos se van
    var lejos = (dist + 4.5) * (dist + 4.5);
    trozos.forEach(function (t, k) {
      if (d2(t) > lejos) {
        // uno que tocó el jugador se guarda: si vuelve, se genera y se le ponen sus bloques
        if (t.cambiado) guardados.set(k, { cx: t.cx, cz: t.cz, ids: t.ids, meta: t.meta });
        trozos.delete(k);
        postMessage({ t: 'fuera', cx: t.cx, cz: t.cz });
      }
    });
  }

  // ------------------------------------------------------------------------------------------
  // Líquidos: el agua y la lava corren como en Minecraft (BlockDynamicLiquid): cada bloque que no es
  // fuente toma el nivel de su vecino más alto + 1 (la lava + 2) y se seca si nadie lo alimenta; cae
  // si abajo hay lugar y si no se abre hacia los costados, prefiriendo el camino más corto a un
  // pozo (hasta 4 bloques); dos fuentes de agua juntas sobre algo firme hacen otra. El agua se
  // actualiza cada 5 pasos del juego (0,25 s) y la lava cada 30. Sólo se rehacen las mallas (la luz
  // queda como estaba: el agua apenas la frena) y la página recibe los bloques cambiados.
  // ------------------------------------------------------------------------------------------
  var agenda = new Map(), tickLiq = 0, ultimoLiq = Date.now(), pausa = false;
  var cambiosLiq = [], mallasLiq = new Map();
  var DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1], OPUESTO = [1, 0, 3, 2];
  function idEn(x, y, z) {
    if (y < 0) return 7;
    if (y >= ALTO) return 0;
    var t = trozo(x >> 4, z >> 4);
    if (!t || !t.gen) return -1;
    return t.ids[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  function metaEn(x, y, z) {
    if (y < 0 || y >= ALTO) return 0;
    var t = trozo(x >> 4, z >> 4);
    return t && t.gen ? t.meta[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0;
  }
  function esLiquido(b) { return b >= 8 && b <= 11; }
  function mismo(b, agua) { return agua ? (b === 8 || b === 9) : (b === 10 || b === 11); }
  function bloquea(b) { return b < 0 || (b > 0 && !esLiquido(b) && (C.SOLIDO[b] === 1 || b === 65 || b === 63 || b === 68)); }
  function puedeEntrar(b, agua) { return b >= 0 && !bloquea(b) && !mismo(b, agua); }
  function ponerLiq(x, y, z, id, m) {
    var t = trozo(x >> 4, z >> 4);
    if (!t || !t.gen || y < 0 || y >= ALTO) return;
    var i = (y << 8) | ((z & 15) << 4) | (x & 15);
    t.ids[i] = id; t.meta[i] = m; t.cambiado = true;
    cambiosLiq.push(x, y, z, id, m);
    marcar(t, y);
    var lx = x & 15, lz = z & 15;
    if (lx === 0) marcar(trozo(t.cx - 1, t.cz), y); else if (lx === 15) marcar(trozo(t.cx + 1, t.cz), y);
    if (lz === 0) marcar(trozo(t.cx, t.cz - 1), y); else if (lz === 15) marcar(trozo(t.cx, t.cz + 1), y);
    agendarCerca(x, y, z);
  }
  function marcar(t, y) {
    if (!t) return;
    var sy = y >> 4, m = 1 << sy;
    if ((y & 15) === 0 && sy > 0) m |= 1 << (sy - 1);
    if ((y & 15) === 15 && sy < 7) m |= 1 << (sy + 1);
    mallasLiq.set(t, (mallasLiq.get(t) || 0) | m);
  }
  function agendar(x, y, z) {
    var b = idEn(x, y, z);
    if (!esLiquido(b)) return;
    var k = ((x + 33554432) * 67108864 + (z + 33554432)) * 128 + y, cuando = tickLiq + (b <= 9 ? 5 : 30);
    var e = agenda.get(k);
    if (!e || e.t > cuando) agenda.set(k, { x: x, y: y, z: z, t: cuando });
  }
  function agendarCerca(x, y, z) {
    agendar(x, y, z); agendar(x + 1, y, z); agendar(x - 1, y, z); agendar(x, y, z + 1); agendar(x, y, z - 1);
    agendar(x, y + 1, z); agendar(x, y - 1, z);
  }
  // el costo de cada costado: a cuántos bloques hay un pozo (MC: getOptimalFlowDirections)
  function costo(x, y, z, dist, desde, agua) {
    var mejor = 1000;
    for (var d = 0; d < 4; d++) {
      if (d === OPUESTO[desde]) continue;
      var nx = x + DX[d], nz = z + DZ[d], b = idEn(nx, y, nz);
      if (bloquea(b) || (mismo(b, agua) && (metaEn(nx, y, nz) & 15) === 0)) continue;
      if (!bloquea(idEn(nx, y - 1, nz))) return dist;
      if (dist < 4) { var c = costo(nx, y, nz, dist + 1, d, agua); if (c < mejor) mejor = c; }
    }
    return mejor;
  }
  function correr(x, y, z) {
    var id = idEn(x, y, z);
    if (!esLiquido(id)) return;
    var agua = id <= 9, corre = agua ? 8 : 10, decae = agua ? 1 : 2;
    var m = metaEn(x, y, z), fuente = (m & 15) === 0;
    if (!fuente) {
      var minimo = 99, fuentes = 0;
      for (var d = 0; d < 4; d++) {
        var v = idEn(x + DX[d], y, z + DZ[d]);
        if (!mismo(v, agua)) continue;
        var mv = metaEn(x + DX[d], y, z + DZ[d]);
        if ((mv & 15) === 0) fuentes++;
        var nv = (mv & 8) ? 0 : (mv & 7);
        if (nv < minimo) minimo = nv;
      }
      var nuevo = minimo < 99 ? minimo + decae : -1;
      if (nuevo >= 8) nuevo = -1;
      if (mismo(idEn(x, y + 1, z), agua)) nuevo = 8;
      if (agua && fuentes >= 2) {
        var ab = idEn(x, y - 1, z);
        if (bloquea(ab) || (mismo(ab, true) && (metaEn(x, y - 1, z) & 15) === 0)) nuevo = 0;
      }
      if (nuevo !== (m & 15)) {
        if (nuevo < 0) { ponerLiq(x, y, z, 0, 0); return; }
        ponerLiq(x, y, z, nuevo === 0 ? (agua ? 9 : 11) : corre, nuevo);
        m = nuevo; fuente = nuevo === 0;
      }
    }
    var abajo = idEn(x, y - 1, z);
    if (y > 0 && puedeEntrar(abajo, agua)) {
      if (mismo(abajo, !agua)) ponerLiq(x, y - 1, z, agua ? ((metaEn(x, y - 1, z) & 15) === 0 ? 49 : 4) : 1, 0);
      else ponerLiq(x, y - 1, z, corre, 8);
      return;
    }
    if (!fuente && !bloquea(abajo)) return;
    var sig = (m & 8) ? decae : (m & 7) + decae;
    if (sig >= 8) return;
    var costos = [], menor = 1000;
    for (d = 0; d < 4; d++) {
      var nx = x + DX[d], nz = z + DZ[d], b = idEn(nx, y, nz), c = 1000;
      if (!bloquea(b) && !(mismo(b, agua) && (metaEn(nx, y, nz) & 15) === 0)) c = bloquea(idEn(nx, y - 1, nz)) ? costo(nx, y, nz, 1, d, agua) : 0;
      costos.push(c);
      if (c < menor) menor = c;
    }
    for (d = 0; d < 4; d++) {
      if (costos[d] !== menor || menor === 1000) continue;
      nx = x + DX[d]; nz = z + DZ[d]; b = idEn(nx, y, nz);
      if (!puedeEntrar(b, agua)) continue;
      if (mismo(b, !agua)) { ponerLiq(nx, y, nz, agua ? ((metaEn(nx, y, nz) & 15) === 0 ? 49 : 4) : 4, 0); continue; }
      ponerLiq(nx, y, nz, corre, sig);
    }
  }
  function liquidos() {
    var ahora = Date.now();
    if (pausa) { ultimoLiq = ahora; return; }
    var n = Math.floor((ahora - ultimoLiq) / 50);
    if (n <= 0) return;
    tickLiq += n; ultimoLiq += n * 50;
    if (!agenda.size) return;
    var toca = [];
    agenda.forEach(function (e, k) { if (e.t <= tickLiq && toca.length < 4000) { toca.push(e); agenda.delete(k); } });
    for (var i = 0; i < toca.length; i++) correr(toca[i].x, toca[i].y, toca[i].z);
    if (cambiosLiq.length) {
      postMessage({ t: 'bloques', lista: cambiosLiq });
      cambiosLiq = [];
    }
    mallasLiq.forEach(function (m, t) {
      for (var sy = 0; sy < 8; sy++) if (m & (1 << sy)) {
        if (t.luzOk && vecinosCon(t, 'luzOk')) mallar(t, sy);
        else t.malla |= 1 << sy;
      }
    });
    mallasLiq.clear();
  }

  var avisado = false;
  // el bucle de trabajo duerme cuando no hay nada que hacer: antes se volvía a llamar enseguida para
  // siempre y tenía un núcleo del teléfono ocupado al 100 % (calor, batería y menos CPU para el juego).
  // Se despierta con cada mensaje (el jugador se movió, puso un bloque) y, si hay agua corriendo, cada
  // 50 ms (un paso del juego)
  var programado = null, programadoEn = 0;
  function programar(ms) {
    var cuando = Date.now() + ms;
    if (programado !== null) {
      if (programadoEn <= cuando) return;
      clearTimeout(programado);
    }
    programadoEn = cuando;
    programado = setTimeout(function () { programado = null; unPaso(); }, ms);
  }
  var vueltas = 0;
  function unPaso() {
    var t0 = Date.now(), sinTrabajo = false;
    vueltas++;
    liquidos();
    while (Date.now() - t0 < 12) {
      // 1. lo que puso el jugador
      if (pendientes.length) { aplicarPendientes(); continue; }
      // 2. lo que hay que hacer, lo más cercano primero
      var mejor = null, mejorD = 1e9, que = 0;
      trozos.forEach(function (t) {
        var d = d2(t);
        if (d >= mejorD) return;
        if (!t.gen) { mejor = t; mejorD = d; que = 1; return; }
        var r2 = d;
        if (!t.luzOk && r2 <= (dist + 1.5) * (dist + 1.5) && vecinosCon(t, 'gen')) { mejor = t; mejorD = d; que = 2; return; }
        if (t.luzOk && t.malla && r2 <= (dist + 0.5) * (dist + 0.5) && vecinosCon(t, 'luzOk')) { mejor = t; mejorD = d; que = 3; }
      });
      if (!mejor) {
        if (!avisado) { avisado = true; postMessage({ t: 'listo' }); }
        sinTrabajo = true;
        break;
      }
      if (que === 1) generar(mejor);
      else if (que === 2) iluminar(mejor);
      else {
        // el sub-trozo pendiente más cercano a la altura del jugador
        var sy = -1, md = 99;
        for (var k = 0; k < 8; k++) if (mejor.malla & (1 << k)) {
          var dd = Math.abs(k - (centro.sy | 0));
          if (dd < md) { md = dd; sy = k; }
        }
        mejor.malla &= ~(1 << sy);
        mallar(mejor, sy);
        mejor.mallaHecha |= 1 << sy;
      }
    }
    // se cortó por tiempo (queda trabajo) o llegó algo mientras tanto: sigue ya; si no, duerme
    if (!sinTrabajo || pendientes.length) programar(0);
    else if (agenda.size && !pausa) programar(50);
  }

  // un bloque cambiado: los datos, la luz de los trozos que alcanza y las mallas que toca
  function aplicarPendientes() {
    var tocados = new Map();
    while (pendientes.length) {
      var p = pendientes.shift();
      var cx = Math.floor(p.x / 16), cz = Math.floor(p.z / 16), t = trozo(cx, cz);
      if (!t || !t.gen || p.y < 0 || p.y >= ALTO) continue;
      var lx = p.x - cx * 16, lz = p.z - cz * 16, i = (p.y << 8) | (lz << 4) | lx;
      t.ids[i] = p.id; t.meta[i] = p.m;
      t.cambiado = true;
      agendarCerca(p.x, p.y, p.z);
      // los trozos a menos de 15 bloques del cambio necesitan su luz de nuevo
      for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
        if (dx && (dx < 0 ? lx > 14 : lx < 1)) continue;
        if (dz && (dz < 0 ? lz > 14 : lz < 1)) continue;
        var v = trozo(cx + dx, cz + dz);
        if (v && v.luzOk) tocados.set(clave(v.cx, v.cz), { t: v, sy: p.y >> 4, x: lx, y: p.y, z: lz, dx: dx, dz: dz });
      }
    }
    tocados.forEach(function (o) {
      var antes = o.t.luz.slice();
      iluminar(o.t);
      // rehacer sólo los sub-trozos cuya luz o bloques cambiaron (y sus vecinos de arriba/abajo)
      var marca = 0;
      for (var sy = 0; sy < 8; sy++) {
        var a = sy << 12, b = a + 4096, cambio = false;
        for (var i = a; i < b; i++) if (antes[i] !== o.t.luz[i]) { cambio = true; break; }
        if (cambio) marca |= (1 << sy) | (sy > 0 ? 1 << (sy - 1) : 0) | (sy < 7 ? 1 << (sy + 1) : 0);
      }
      if (o.dx === 0 && o.dz === 0) {
        marca |= 1 << o.sy;
        if ((o.y & 15) === 0 && o.sy > 0) marca |= 1 << (o.sy - 1);
        if ((o.y & 15) === 15 && o.sy < 7) marca |= 1 << (o.sy + 1);
      } else marca |= 1 << o.sy;
      o.t.malla = marca & 0xFF;
      // ya mismo: así el bloque aparece en el cuadro siguiente
      for (sy = 0; sy < 8; sy++) if (o.t.malla & (1 << sy)) {
        if (vecinosCon(o.t, 'luzOk')) { mallar(o.t, sy); o.t.malla &= ~(1 << sy); }
      }
    });
  }

  onmessage = function (e) {
    var d = e.data;
    if (d.t === 'ini') {
      C.armarBloques(d.bloques);
      OPACO = C.OPACO; FRENA = C.FRENA; LUZ = C.LUZ; FORMA = C.FORMA; CAPA = C.CAPA;
      uv = d.uv; gen = new Gen(d.semilla, d.tipo); dist = d.dist || 6;
      if (d.suave !== undefined) suave = !!d.suave;
      if (d.hojas !== undefined) hojasLlamativas = !!d.hojas;
      prepararTexturas();
      aplicarHojas();
      centro = { cx: d.cx | 0, cz: d.cz | 0, sy: d.sy || 4 };
      planificar();
      programar(0);
    } else if (d.t === 'centro') {
      centro = { cx: d.cx, cz: d.cz, sy: d.sy };
      if (d.dist) dist = d.dist;
      planificar();
      programar(0);
    } else if (d.t === 'poner') {
      pendientes.push(d);
      programar(0);
    } else if (d.t === 'pausa') {
      pausa = !!d.v;
      if (!pausa) { ultimoLiq = Date.now(); programar(0); }
    } else if (d.t === 'graficos') {
      // cambiaron los ajustes: todas las mallas de nuevo (lo más cercano primero, como siempre)
      if (d.suave !== undefined) suave = !!d.suave;
      if (d.hojas !== undefined) hojasLlamativas = !!d.hojas;
      if (OPACO) {
        aplicarHojas();
        trozos.forEach(function (t) { if (t.luzOk) t.malla = 0xFF; });
        programar(0);
      }
    } else if (d.t === 'diag') {
      postMessage({ t: 'diag', vueltas: vueltas, agenda: agenda.size, trozos: trozos.size });
    } else if (d.t === 'luz') {
      // la luz donde está el jugador (para la mano y las partículas): cielo << 4 | bloques
      var tl = trozo(d.x >> 4, d.z >> 4), v = -1;
      if (tl && tl.luzOk && d.y >= 0 && d.y < ALTO) v = tl.luz[(d.y << 8) | ((d.z & 15) << 4) | (d.x & 15)];
      else if (d.y >= ALTO) v = 0xF0;
      postMessage({ t: 'luz', v: v });
    } else if (d.t === 'luces') {
      // la luz en varios lugares (los bichos y los otros jugadores; también dónde podría aparecer
      // un bicho): cielo << 4 | bloques, -1 si el trozo no está
      var v2 = [];
      for (var q = 0; q + 2 < d.p.length; q += 3) {
        var px = d.p[q], py = d.p[q + 1], pz = d.p[q + 2], tq = trozo(px >> 4, pz >> 4);
        if (py >= ALTO) v2.push(0xF0);
        else if (!tq || !tq.luzOk || py < 0) v2.push(-1);
        else v2.push(tq.luz[(py << 8) | ((pz & 15) << 4) | (px & 15)]);
      }
      postMessage({ t: 'luces', v: v2, pedido: d.pedido });
    } else if (d.t === 'parches') {
      // lo construido en un servidor: se aplica al generar el trozo (o ya, si está generado)
      for (var pi = 0; pi < d.lista.length; pi++) {
        var p = d.lista[pi], kp = clave(p.cx, p.cz), mp = parches.get(kp) || new Map();
        for (var j = 0; j + 2 < p.d.length; j += 3) mp.set(p.d[j], [p.d[j + 1], p.d[j + 2]]);
        parches.set(kp, mp);
      }
      programar(0);
    } else if (d.t === 'guardados') {
      for (var i = 0; i < d.lista.length; i++) {
        var g = d.lista[i];
        guardados.set(clave(g.cx, g.cz), g);
      }
    } else if (d.t === 'altura') {
      // la altura del terreno en un punto (para poner al jugador arriba al arrancar)
      var col = {};
      gen.columna(d.x, d.z, col);
      postMessage({ t: 'altura', x: d.x, z: d.z, alt: col.alt });
    }
  };
})();
