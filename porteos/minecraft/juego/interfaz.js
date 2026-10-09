// porteo: la interfaz de la 1.2, dibujada en un lienzo 2D encima del 3D con los dibujos del juego
// (textures/ui con sus "nineslice", gui.png para la barra y los controles táctiles, la fuente
// default8.png) y armada como sus pantallas de ui/*.json: el título con el logo y la frase amarilla,
// Jugar con las pestañas Mundos / Amigos / Servidores, crear un mundo, los ajustes, la pausa, el
// inventario creativo, el chat y la pantalla de muerte. Los controles táctiles son los de MCPE:
// cruceta abajo a la izquierda, arrastrar para mirar, tocar un bloque para poner, mantener para
// romper. En la computadora: mouse (con el puntero bloqueado), WASD, espacio, shift, rueda y 1-9.
var Interfaz = (function () {
  'use strict';
  var I = {};
  var hud, ctx, img = {}, UI = {}, E = 3, W = 0, H = 0, dpr = 1;
  I.pantalla = 'cargando';
  I.botones = [];          // lo tocable de la pantalla actual: {x, y, w, h, accion}
  I.acciones = {};         // los manejadores que pone principal.js
  I.textos = {};           // los del juego en el idioma elegido
  I.idioma = 'es';
  var sucio = true;
  I.sucio = function () { sucio = true; };

  // ------------------------------------------------------------------------------------------
  // Textos: los del juego (sus .lang) y los del port (textos.js); %s, %1$s, %1 y %d como el juego
  // ------------------------------------------------------------------------------------------
  I.t = function (k, d) { var v = I.textos[k]; return v !== undefined && v !== '' ? v : (d !== undefined ? d : k); };
  I.tp = function (k) { var l = Textos[I.idioma] || Textos.es; return l[k] !== undefined ? l[k] : (Textos.es[k] || k); };
  I.f = function (s) {
    var args = Array.prototype.slice.call(arguments, 1), n = 0;
    return String(s).replace(/%(\d+)\$[sd]|%(\d+)|%[sd]/g, function (m, a, b) {
      var i = a ? +a - 1 : b ? +b - 1 : n++;
      return args[i] !== undefined ? args[i] : '';
    });
  };

  // ------------------------------------------------------------------------------------------
  // La fuente de Minecraft (default8.png, 16x16 de 8x8, con el orden de caracteres del juego). Lo
  // que no está en la fuente (©) se escribe con la del navegador
  // ------------------------------------------------------------------------------------------
  var MAPA = 'ÀÁÂÈÊËÍÓÔÕÚßãõğİıŒœŞşŴŵžȇ\u0000\u0000\u0000\u0000\u0000\u0000\u0000 !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u0000ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»';
  var anchoLetra = new Uint8Array(256), letra = {};
  var fuentes = {};      // la fuente teñida por color (caché)
  function prepararFuente() {
    var im = img.fuente, c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    var d = x.getImageData(0, 0, c.width, c.height).data, celda = im.width / 16;
    for (var i = 0; i < 256; i++) {
      var cx = (i & 15) * celda, cy = (i >> 4) * celda, ancho = 0;
      for (var col = celda - 1; col >= 0 && !ancho; col--)
        for (var f = 0; f < celda; f++) if (d[((cy + f) * c.width + cx + col) * 4 + 3] > 0) { ancho = col + 1; break; }
      anchoLetra[i] = ancho;
    }
    for (i = 0; i < MAPA.length; i++) if (MAPA[i] !== '\u0000') letra[MAPA[i]] = i;
    anchoLetra[32] = 3;
    fuentes['#ffffff'] = c;
  }
  function fuenteColor(color) {
    if (fuentes[color]) return fuentes[color];
    var b = fuentes['#ffffff'], c = document.createElement('canvas');
    c.width = b.width; c.height = b.height;
    var x = c.getContext('2d');
    x.drawImage(b, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    fuentes[color] = c;
    return c;
  }
  function anchoAjeno(ch, esc) { ctx.font = 'bold ' + Math.round(8 * esc) + 'px sans-serif'; return ctx.measureText(ch).width + esc; }
  I.anchoTexto = function (s, esc) {
    esc = esc || E;
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var k = letra[s[i]];
      w += k === undefined ? anchoAjeno(s[i], esc) : (anchoLetra[k] + 1) * esc;
    }
    return w;
  };
  // el texto con su sombra (un píxel abajo a la derecha, al 25 %), como el juego
  I.texto = function (s, x, y, color, esc, alineado, sinSombra) {
    esc = esc || E;
    s = String(s);
    var w = I.anchoTexto(s, esc);
    if (alineado === 'centro') x -= w / 2; else if (alineado === 'der') x -= w;
    if (!sinSombra) dibujarTexto(s, x + esc, y + esc, sombraDe(color || '#ffffff'), esc);
    dibujarTexto(s, x, y, color || '#ffffff', esc);
    return w;
  };
  // recortado con "…" si no entra en ancho
  I.textoCorto = function (s, x, y, ancho, color, esc, alineado, sinSombra) {
    s = String(s);
    esc = esc || E;
    if (I.anchoTexto(s, esc) > ancho) {
      while (s.length > 1 && I.anchoTexto(s + '...', esc) > ancho) s = s.slice(0, -1);
      s += '...';
    }
    return I.texto(s, x, y, color, esc, alineado, sinSombra);
  };
  function sombraDe(c) {
    var n = parseInt(c.slice(1), 16);
    var r = (n >> 16) >> 2, g = ((n >> 8) & 255) >> 2, b = (n & 255) >> 2;
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function dibujarTexto(s, x, y, color, esc) {
    var f = fuenteColor(color), celda = f.width / 16;
    for (var i = 0; i < s.length; i++) {
      var k = letra[s[i]];
      if (k === undefined) {
        ctx.font = 'bold ' + Math.round(8 * esc) + 'px sans-serif';
        ctx.fillStyle = color; ctx.textBaseline = 'top';
        ctx.fillText(s[i], Math.round(x), Math.round(y - esc * 0.5));
        x += anchoAjeno(s[i], esc);
        continue;
      }
      if (k !== 32) ctx.drawImage(f, (k & 15) * celda, (k >> 4) * celda, anchoLetra[k], celda, Math.round(x), Math.round(y), anchoLetra[k] * esc, celda * esc);
      x += (anchoLetra[k] + 1) * esc;
    }
  }
  // un texto partido en líneas que entren en ancho
  I.lineas = function (s, ancho, esc) {
    var palabras = String(s).split(' '), l = [], act = '';
    for (var i = 0; i < palabras.length; i++) {
      var p = act ? act + ' ' + palabras[i] : palabras[i];
      if (act && I.anchoTexto(p, esc) > ancho) { l.push(act); act = palabras[i]; } else act = p;
    }
    if (act) l.push(act);
    return l;
  };

  // ------------------------------------------------------------------------------------------
  // Los dibujos de la interfaz de la 1.2 (un atlas con sus "nineslice": las esquinas quedan del
  // tamaño de la escala y lo de adentro se estira)
  // ------------------------------------------------------------------------------------------
  var tenidas = {};
  function pieza(n) { return UI[n]; }
  I.dibujo = function (n, x, y, w, h, alfa) {
    var p = UI[n];
    if (!p) return;
    if (alfa !== undefined) ctx.globalAlpha = alfa;
    ctx.drawImage(img.ui, p[0], p[1], p[2], p[3], Math.round(x), Math.round(y), Math.round(w === undefined ? p[2] * E : w), Math.round(h === undefined ? p[3] * E : h));
    ctx.globalAlpha = 1;
  };
  function fuenteDe(n, color) {
    // una pieza teñida (el borde blanco de los botones: oscuro o blanco según el estado)
    if (!color) return { im: img.ui, p: UI[n] };
    var k = n + color;
    if (!tenidas[k]) {
      var p = UI[n], c = document.createElement('canvas');
      c.width = p[2]; c.height = p[3];
      var x = c.getContext('2d');
      x.drawImage(img.ui, p[0], p[1], p[2], p[3], 0, 0, p[2], p[3]);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, p[2], p[3]);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(img.ui, p[0], p[1], p[2], p[3], 0, 0, p[2], p[3]);
      tenidas[k] = { im: c, p: [0, 0, p[2], p[3], p[4]] };
    }
    return tenidas[k];
  }
  function nueve(n, x, y, w, h, color, alfa) {
    var f = fuenteDe(n, color), p = f.p;
    if (!p) return;
    var ns = p[4];
    if (!ns) { ctx.drawImage(f.im, p[0], p[1], p[2], p[3], Math.round(x), Math.round(y), Math.round(w), Math.round(h)); return; }
    if (alfa !== undefined) ctx.globalAlpha = alfa;
    var l = ns[0], t = ns[1], r = ns[2], b = ns[3], e = E;
    var sx = [p[0], p[0] + l, p[0] + p[2] - r], sw = [l, p[2] - l - r, r];
    var sy = [p[1], p[1] + t, p[1] + p[3] - b], sh = [t, p[3] - t - b, b];
    var x0 = Math.round(x), y0 = Math.round(y), x3 = Math.round(x + w), y3 = Math.round(y + h);
    var x1 = Math.min(x3, x0 + l * e), x2 = Math.max(x1, x3 - r * e), y1 = Math.min(y3, y0 + t * e), y2 = Math.max(y1, y3 - b * e);
    var dx = [x0, x1, x2], dw = [x1 - x0, x2 - x1, x3 - x2], dy = [y0, y1, y2], dh = [y1 - y0, y2 - y1, y3 - y2];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      if (sw[i] <= 0 || sh[j] <= 0 || dw[i] <= 0 || dh[j] <= 0) continue;
      ctx.drawImage(f.im, sx[i], sy[j], sw[i], sh[j], dx[i], dy[j], dw[i], dh[j]);
    }
    ctx.globalAlpha = 1;
  }
  I.nueve = nueve;

  // los botones de la 1.2: el borde (focus_border_white: oscuro, o blanco apretado) y adentro el
  // botón claro o el oscuro; el texto sin sombra, gris en los claros y blanco apretado
  var GRIS = '#4c4c4c';
  function botonClaro(x, y, w, h, texto, estado, extra) {
    extra = extra || {};
    var bloqueado = extra.bloqueado;
    nueve('focus_border_white', x, y, w, h, estado && !bloqueado ? '#ffffff' : '#131313');
    var t = bloqueado ? 'disabledButtonNoBorder' : estado === 2 ? 'button_borderless_lightpressed' : estado === 1 ? 'button_borderless_lighthover' : 'button_borderless_light';
    nueve(t, x + E, y + E, w - 2 * E, h - 2 * E);
    var dy = estado === 2 ? E : 0, color = bloqueado ? '#b3b3b3' : estado ? '#ffffff' : GRIS;
    if (extra.icono) {
      var ic = UI[extra.icono], esc = extra.escIcono || 1, iw = ic ? ic[2] * E * esc : 0, ih = ic ? ic[3] * E * esc : 0;
      var tw = texto ? I.anchoTexto(texto) + 4 * E : 0, sx = x + (w - iw - tw) / 2;
      if (ic) I.dibujo(extra.icono, sx, y + (h - ih) / 2 + dy, iw, ih);
      if (texto) I.texto(texto, sx + iw + 4 * E, y + h / 2 - 4 * E + dy, color, E, null, true);
      return;
    }
    if (texto) I.textoCorto(texto, x + w / 2, y + h / 2 - 4 * E + dy, w - 6 * E, color, E, 'centro', true);
  }
  function botonOscuro(x, y, w, h, texto, estado, extra) {
    nueve('focus_border_white', x, y, w, h, estado ? '#ffffff' : '#131313');
    var t = estado === 2 ? 'button_borderless_darkpressed' : estado === 1 ? 'button_borderless_darkhover' : 'button_borderless_dark';
    nueve(t, x + E, y + E, w - 2 * E, h - 2 * E);
    if (texto) I.textoCorto(texto, x + w / 2, y + h / 2 - 4 * E + (estado === 2 ? E : 0), w - 6 * E, '#ffffff', E, 'centro', true);
    void extra;
  }
  I.botonClaro = botonClaro;
  // el fondo de los paneles (dialog_background_hollow_4 con su relleno "control" al 80 %)
  function panel(x, y, w, h) {
    ctx.globalAlpha = 0.8;
    I.dibujo('control', x + 8 * E, y + 8 * E, w - 16 * E, h - 16 * E);
    ctx.globalAlpha = 1;
    nueve('dialog_background_hollow_4', x, y, w, h);
  }
  function panelOpaco(x, y, w, h) { nueve('dialog_background_opaque', x, y, w, h); }
  // el encabezado de las pantallas (header_bar) con el título y la flecha para volver
  function encabezado(titulo, accionVolver, alto) {
    var h = alto || 24 * E;
    nueve('header_bar', 0, 0, W, h);
    I.texto(titulo, W / 2, (h - 8 * E) / 2 - E, '#ffffff', E, 'centro');
    if (accionVolver) {
      var b = botonDe(2 * E, 2 * E, h - 6 * E + 8 * E, h - 6 * E, '', accionVolver, { oscuro: true });
      // la flecha "<"
      flecha(b.x + b.w / 2, b.y + b.h / 2, apretadoEs(b));
    }
    return h;
  }
  function flecha(cx, cy, apretado) {
    ctx.fillStyle = '#ffffff';
    var s = E, dy = apretado ? E : 0;
    for (var i = 0; i < 4; i++) {
      ctx.fillRect(Math.round(cx - 2 * s + i * s), Math.round(cy - i * s - s / 2 + dy), s, s);
      ctx.fillRect(Math.round(cx - 2 * s + i * s), Math.round(cy + i * s - s / 2 + dy), s, s);
    }
  }
  function interruptor(x, y, on) { I.dibujo(on ? 'toggle_on' : 'toggle_off', x, y, 30 * E, 16 * E); }
  function campo(x, y, w, h, texto, placeholder, activo) {
    nueve(activo ? 'edit_box_indent_hover' : 'edit_box_indent', x, y, w, h);
    if (texto) I.textoCorto(texto, x + 4 * E, y + h / 2 - 4 * E, w - 8 * E, '#ffffff', E);
    else if (placeholder) I.textoCorto(placeholder, x + 4 * E, y + h / 2 - 4 * E, w - 8 * E, '#808080', E, null, true);
  }

  // ------------------------------------------------------------------------------------------
  // Dibujos de gui.png (la barra rápida, la cruceta, saltar, volar, pausa, chat, "...")
  // ------------------------------------------------------------------------------------------
  var S = {
    pausa: [200, 64, 18, 18], chat: [200, 82, 18, 18], tres: [227, 247, 29, 9],
    arriba: [0, 107, 26, 26], izq: [26, 107, 26, 26], abajo: [52, 107, 26, 26], der: [78, 107, 26, 26], saltar: [104, 107, 26, 26],
    arribaIzq: [0, 133, 26, 26], arribaDer: [26, 133, 26, 26], volarArriba: [52, 133, 26, 26], volarAbajo: [78, 133, 26, 26], agachar: [104, 133, 26, 26]
  };
  function sprite(nombre, x, y, esc, alfa) {
    var s = S[nombre];
    if (alfa !== undefined) ctx.globalAlpha = alfa;
    ctx.drawImage(img.gui, s[0], s[1], s[2], s[3], Math.round(x), Math.round(y), s[2] * (esc || E), s[3] * (esc || E));
    ctx.globalAlpha = 1;
  }
  // la barra rápida de la 1.2: las nueve casillas (hotbar_0..8 entre sus dos tapas) y la elegida
  function barra(bx, by) {
    I.dibujo('hotbar_start_cap', bx, by);
    for (var i = 0; i < 9; i++) I.dibujo('hotbar_' + i, bx + E + i * 20 * E, by);
    I.dibujo('hotbar_end_cap', bx + 181 * E, by);
  }

  // ------------------------------------------------------------------------------------------
  // Íconos de los bloques: un cubo isométrico con las tres caras (arriba, izquierda y derecha) de su
  // textura "de mano" (carried_textures) o la del mundo, como en la barra del juego; las plantas y
  // lo que no es un cubo, la textura plana. Los huevos de los bichos: el huevo con sus dos colores
  // ------------------------------------------------------------------------------------------
  var iconos = null, iconosPos = {}, LADO = 32;
  I.iconoDe = function (id, m) { return iconosPos[id + ':' + m]; };
  I.prepararIconos = function (lista, datos) {
    var cols = 32, filas = Math.ceil(lista.length / cols);
    iconos = document.createElement('canvas');
    iconos.width = cols * LADO; iconos.height = filas * LADO;
    var x = iconos.getContext('2d'), at = img.terreno, AW = at.width, AH = at.height, uv = datos.atlas.uv;
    x.imageSmoothingEnabled = false;
    function rect(nombre, variante) {
      var l = uv[nombre];
      if (!l) return null;
      l = l.filter(Boolean);
      if (!l.length) return null;
      var r = l[variante < l.length ? variante : 0];
      return [r[0] * AW, r[1] * AH, (r[2] - r[0]) * AW, (r[3] - r[1]) * AH];
    }
    function caraTex(b, cara, m) {
      var llevada = b.texMano && (typeof b.texMano === 'string' || b.texMano[cara] || b.texMano.side);
      var t = llevada ? b.texMano : b.tex;
      if (!t) return null;
      var n = typeof t === 'string' ? t : (t[cara] || t.side || t.up);
      return rect(n, m);
    }
    var tmp = document.createElement('canvas'), tx = tmp.getContext('2d');
    lista.forEach(function (it, n) {
      var ox = (n % cols) * LADO, oy = Math.floor(n / cols) * LADO;
      iconosPos[it.id + ':' + it.m] = [ox, oy];
      if (it.huevo) { huevo(x, ox, oy, it.huevo); return; }
      var b = C.bloques[it.id], f = C.FORMA[it.id];
      // las texturas "de mano" (carried) ya traen su color: ésas no se tiñen
      var tn = b.texMano ? 0 : b.tinte;
      var plano = f === C.F.cruz || f === C.F.antorcha || f === C.F.pared || f === C.F.riel || f === C.F.planta2 ||
        f === C.F.puerta || f === C.F.surcos || f === C.F.nenufar || f === C.F.panel || f === C.F.fuego || f === C.F.tallo;
      var m = it.m;
      if (it.id === 18 || it.id === 161) m = it.m & 3;
      if (plano) {
        var r = caraTex(b, f === C.F.planta2 ? 'up' : f === C.F.puerta ? 'side' : 'up', f === C.F.planta2 ? m & 7 : m) || caraTex(b, 'side', m);
        if (!r) return;
        x.drawImage(at, r[0], r[1], r[2], r[3], ox + 4, oy + 4, LADO - 8, LADO - 8);
        if (tn) tenir(x, ox + 4, oy + 4, LADO - 8, LADO - 8, tn);
        return;
      }
      var arriba = caraTex(b, 'up', m), lado = caraTex(b, 'side', m) || arriba, frente = caraTex(b, 'south', m) || lado;
      if (C.FORMA[it.id] === C.F.tronco) { arriba = caraTex(b, 'up', m & 3); lado = caraTex(b, 'side', m & 3); frente = lado; }
      if (!arriba) return;
      var alto = f === C.F.losa ? 0.5 : f === C.F.capa ? 0.125 : f === C.F.alfombra ? 0.0625 : 1;
      var L = LADO - 2, cx = ox + 1, cy = oy + 1 + (1 - alto) * L / 2;
      cara(x, arriba, [cx + L / 2, cy, cx + L, cy + L / 4, cx, cy + L / 4], 1, tn === 1 || tn === 2 ? tn : 0, alto, true);
      cara(x, frente, [cx, cy + L / 4, cx + L / 2, cy + L / 2, cx, cy + L / 4 + L / 2 * alto], 0.8, tn === 2 ? 2 : 0, alto);
      cara(x, lado, [cx + L / 2, cy + L / 2, cx + L, cy + L / 4, cx + L / 2, cy + L / 2 + L / 2 * alto], 0.6, tn === 2 ? 2 : 0, alto);
    });
    function cara(x, r, p, sombra, tinte, alto, arriba) {
      if (!r) return;
      var sh = arriba ? r[3] : r[3] * alto, sy = arriba ? r[1] : r[1] + r[3] * (1 - alto);
      tmp.width = r[2]; tmp.height = sh;
      tx.imageSmoothingEnabled = false;
      tx.drawImage(at, r[0], sy, r[2], sh, 0, 0, r[2], sh);
      if (tinte) tenir(tx, 0, 0, r[2], sh, tinte);
      tx.globalCompositeOperation = 'source-atop';
      tx.fillStyle = 'rgba(0,0,0,' + (1 - sombra) + ')'; tx.fillRect(0, 0, r[2], sh);
      tx.globalCompositeOperation = 'source-over';
      x.save();
      x.setTransform((p[2] - p[0]) / r[2], (p[3] - p[1]) / r[2], (p[4] - p[0]) / sh, (p[5] - p[1]) / sh, p[0], p[1]);
      x.drawImage(tmp, 0, 0);
      x.restore();
    }
    function tenir(x, a, b, w, h, tinte) {
      x.save();
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = tinte === 1 ? '#91bd59' : '#77ab2f';
      x.fillRect(a, b, w, h);
      x.restore();
    }
    // el huevo: spawn_egg teñido con el color de fondo y spawn_egg_overlay con el de las manchas
    function huevo(x, ox, oy, colores) {
      [['spawn_egg', colores[0]], ['spawn_egg_overlay', colores[1]]].forEach(function (par) {
        var im = img[par[0]];
        if (!im) return;
        tmp.width = im.width; tmp.height = im.height;
        tx.imageSmoothingEnabled = false;
        tx.drawImage(im, 0, 0);
        tx.globalCompositeOperation = 'multiply';
        tx.fillStyle = '#' + ('00000' + par[1].toString(16)).slice(-6); tx.fillRect(0, 0, im.width, im.height);
        tx.globalCompositeOperation = 'destination-in'; tx.drawImage(im, 0, 0);
        tx.globalCompositeOperation = 'source-over';
        x.drawImage(tmp, ox + 4, oy + 4, LADO - 8, LADO - 8);
      });
    }
  };
  function icono(id, m, x, y, lado) {
    var p = iconosPos[id + ':' + m] || iconosPos[id + ':0'];
    if (!p || !iconos) return;
    ctx.drawImage(iconos, p[0], p[1], LADO, LADO, Math.round(x), Math.round(y), lado, lado);
  }
  I.icono = icono;

  // ------------------------------------------------------------------------------------------
  // Tamaño y escala (un píxel de la interfaz = E píxeles de la pantalla, como la escala del juego)
  // ------------------------------------------------------------------------------------------
  I.iniciar = function (lienzoHud, imagenes, ui) {
    hud = lienzoHud; ctx = hud.getContext('2d'); img = imagenes; UI = ui || {};
    prepararFuente();
    ajustar();
    addEventListener('resize', function () { ajustar(); sucio = true; });
    entrada();
  };
  I.ponerUI = function (imagenes, ui) { for (var k in imagenes) img[k] = imagenes[k]; UI = ui; sucio = true; };
  function ajustar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(hud.clientWidth * dpr); H = Math.round(hud.clientHeight * dpr);
    hud.width = W; hud.height = H;
    ctx.imageSmoothingEnabled = false;
    // como la escala del juego en un teléfono acostado: la barra rápida ocupa ~40 % del ancho
    E = Math.max(2, Math.min(Math.floor(W / 320), Math.floor(H / 180)));
    sucio = true;
  }

  // ------------------------------------------------------------------------------------------
  // HUD del juego
  // ------------------------------------------------------------------------------------------
  I.juego = {
    barra: [], elegido: 0, creativo: true, volando: false, vida: 20, conVida: false, fps: 0, mostrarFps: false,
    mensaje: '', mensajeHasta: 0, nombreItem: '', nombreHasta: 0, dano: 0, red: null, nombres: [], chat: []
  };
  var pulsados = {};        // botones de la cruceta apretados (por nombre)
  var crucetaBotones = [];
  function corazones(x, y, vida, parpadea) {
    for (var i = 0; i < 10; i++) {
      var hx = x + i * 8 * E;
      I.dibujo('heart_background', hx, y);
      if (parpadea) I.dibujo('heart_blink', hx, y);
      if (vida > i * 2 + 1) I.dibujo('heart', hx, y);
      else if (vida > i * 2) I.dibujo('heart_half', hx, y);
    }
  }
  function dibujarJuego() {
    var j = I.juego, ahora = performance.now();
    var o = I.opc || {}, oculta = o.ocultarInterfaz;
    // barra rápida, abajo al medio ("Ocultar interfaz de juego" la saca, como el juego)
    var bw = 182 * E, bx = Math.round((W - bw) / 2), by = H - 22 * E;
    if (!oculta) {
      barra(bx, by);
      for (var i = 0; i < 9; i++) {
        var it = j.barra[i];
        if (it) icono(it.id, it.m, bx + (3 + i * 20) * E, by + 3 * E, 16 * E);
      }
      I.dibujo('selected_hotbar_slot', bx - E + j.elegido * 20 * E, by - E);
    }
    I.botones.push({ x: bx, y: by, w: bw, h: 22 * E, accion: 'barra', bx: bx });
    // "..." el inventario, a la derecha de la barra
    var tx = bx + bw + 2 * E, tw = 22 * E;
    if (!oculta) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(tx, by, tw, 22 * E);
      sprite('tres', tx + (tw - 29 * E * 0.6) / 2, by + 9 * E, E * 0.6);
    }
    I.botones.push({ x: tx, y: by, w: tw, h: 22 * E, accion: 'inventario' });
    // la vida (en los servidores, donde se pelea)
    if (j.conVida && !oculta) corazones(bx, by - 11 * E, j.vida, ahora < j.parpadeoHasta);
    // pausa y chat, arriba a la derecha (como la 1.2)
    var pw = 18 * E;
    sprite('pausa', W - pw - 4 * E, 4 * E);
    I.botones.push({ x: W - pw - 6 * E, y: 0, w: pw + 6 * E, h: pw + 8 * E, accion: 'pausa' });
    if (j.red) {
      sprite('chat', W - 2 * pw - 8 * E, 4 * E);
      I.botones.push({ x: W - 2 * pw - 10 * E, y: 0, w: pw + 4 * E, h: pw + 8 * E, accion: 'abrirChat' });
    }
    // los controles táctiles como MCPE: la cruceta abajo a un costado con agacharse (el botón
    // redondo: se prende y se apaga) en el medio, y saltar aparte, grande, abajo del otro costado;
    // volando, subir y bajar van ahí. "Para zurdos" los da vuelta, "Intercambiar salto y agacharse"
    // cambia esos dos de lugar y "Tamaño de botón" los agranda o achica
    var c = 26 * E * 0.95 * (o.tamBoton || 1), m = 8 * E;
    var cx = o.zurdo ? W - 3 * c - m : m, cy = H - 3 * c - m;
    var gc = c * 1.3, gx = o.zurdo ? m : W - gc - m, gy = H - gc - m;
    crucetaBotones = [
      { n: 'arriba', x: cx + c, y: cy, w: c, h: c, s: 'arriba' }, { n: 'izq', x: cx, y: cy + c, w: c, h: c, s: 'izq' },
      { n: 'der', x: cx + 2 * c, y: cy + c, w: c, h: c, s: 'der' }, { n: 'abajo', x: cx + c, y: cy + 2 * c, w: c, h: c, s: 'abajo' }
    ];
    if (pulsados.arriba && !j.volando) {
      crucetaBotones.push({ n: 'arribaIzq', x: cx, y: cy, w: c, h: c, s: 'arribaIzq' });
      crucetaBotones.push({ n: 'arribaDer', x: cx + 2 * c, y: cy, w: c, h: c, s: 'arribaDer' });
    }
    var medio = { x: cx + c, y: cy + c, w: c, h: c }, grande = { x: gx, y: gy, w: gc, h: gc };
    if (j.volando) {
      crucetaBotones.push({ n: 'subir', x: gx, y: gy - gc - 2 * E, w: gc, h: gc, s: 'volarArriba' });
      crucetaBotones.push({ n: 'bajar', x: gx, y: gy, w: gc, h: gc, s: 'volarAbajo' });
    } else {
      var bs = o.intercambiar ? medio : grande, ba = o.intercambiar ? grande : medio;
      crucetaBotones.push({ n: 'saltar', x: bs.x, y: bs.y, w: bs.w, h: bs.h, s: 'saltar' });
      crucetaBotones.push({ n: 'agachar', x: ba.x, y: ba.y, w: ba.w, h: ba.h, s: 'agachar', alterna: true });
    }
    for (i = 0; i < crucetaBotones.length; i++) {
      var b = crucetaBotones[i], s = S[b.s], on = b.alterna ? I.control.agacharTactil : pulsados[b.n];
      ctx.globalAlpha = on ? 1 : 0.7;
      ctx.drawImage(img.gui, s[0], s[1], s[2], s[3], Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h));
      ctx.globalAlpha = 1;
    }
    // el anillo de romper (el "progress indicator" del juego): en el dedo, se llena mientras se
    // mantiene y se vuelve a llenar con cada bloque
    if (j.anillo) {
      var a = j.anillo, r = 13 * E;
      ctx.lineWidth = Math.max(2, 2 * E);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(a.x, a.y, r + E, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(a.x, a.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, a.p))); ctx.stroke();
    }
    // los nombres de los otros jugadores, arriba de su cabeza (el cartelito gris del juego)
    for (i = 0; i < j.nombres.length; i++) {
      var nn = j.nombres[i], ew = I.anchoTexto(nn.t) + 2 * E;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(Math.round(nn.x - ew / 2), Math.round(nn.y - 10 * E), Math.round(ew), 10 * E);
      I.texto(nn.t, nn.x, nn.y - 9 * E, '#ffffff', E, 'centro', true);
    }
    // el nombre del bloque elegido
    if (ahora < j.nombreHasta && j.nombreItem) {
      ctx.globalAlpha = Math.min(1, (j.nombreHasta - ahora) / 400);
      I.texto(j.nombreItem, W / 2, by - (j.conVida ? 24 : 12) * E, '#ffffff', E, 'centro');
      ctx.globalAlpha = 1;
    }
    if (ahora < j.mensajeHasta && j.mensaje) I.texto(j.mensaje, W / 2, H * 0.3, '#ffffff', E, 'centro');
    // el chat: los últimos mensajes arriba a la izquierda, se van a los 10 segundos
    var yc = 4 * E;
    if (j.red) {
      var col = j.red.estado === 'enlinea' ? '#55ff55' : j.red.estado === 'conectando' ? '#ffff55' : '#ff5555';
      ctx.fillStyle = col; ctx.fillRect(4 * E, yc + 2 * E, 4 * E, 4 * E);
      I.texto(j.red.texto, 10 * E, yc, '#ffffff', E);
      yc += 11 * E;
    }
    if (j.mostrarFps) { I.texto(j.fps + ' fps', 4 * E, yc, '#ffffff', E); yc += 10 * E; }
    var vis = j.chat.filter(function (l) { return ahora - l.t < 10000; }).slice(-6);
    for (i = 0; i < vis.length; i++) {
      var al = Math.min(1, (10000 - (ahora - vis[i].t)) / 1000);
      ctx.globalAlpha = al * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(2 * E, yc - E, Math.min(W * 0.5, I.anchoTexto(vis[i].s) + 4 * E), 10 * E);
      ctx.globalAlpha = al;
      I.texto(vis[i].s, 4 * E, yc, vis[i].c || '#ffffff', E);
      ctx.globalAlpha = 1;
      yc += 10 * E;
    }
    // la mira: con mouse o con "Controles divididos" (se apunta con el centro, como el juego)
    if (I.conMouse || o.dividido) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(W / 2 - 5 * E, H / 2 - E / 2, 10 * E, E); ctx.fillRect(W / 2 - E / 2, H / 2 - 5 * E, E, 10 * E);
    }
    // el golpe: la pantalla se pone roja un instante
    if (j.dano > 0) { ctx.fillStyle = 'rgba(255,0,0,' + (j.dano * 0.35) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------------------------------------
  // Pantallas
  // ------------------------------------------------------------------------------------------
  I.mundos = [];            // los mundos guardados
  I.publicos = [];          // los 3 mundos públicos (servidores fijados)
  I.servidores = [];        // los servidores agregados
  I.nuevo = { nombre: '', semilla: '', tipo: 'infinito', siempreDia: false };
  var invTab = 0, invScroll = 0, invLista = [];
  I.ponerInventario = function (lista) { invLista = lista; };
  I.acciones.tab = function (b) { invTab = b.i; invScroll = 0; sucio = true; };
  var apretado = null, apretadoN = -1;
  function apretadoEs(b) { return apretado === b.accion && apretadoN === I.botones.indexOf(b); }
  function botonDe(x, y, w, h, texto, accion, extra) {
    var b = { x: x, y: y, w: w, h: h, accion: accion };
    if (extra) for (var k in extra) b[k] = extra[k];
    I.botones.push(b);
    var est = apretado === b.accion && apretadoN === I.botones.length - 1 ? 2 : 0;
    if (extra && extra.oscuro) botonOscuro(x, y, w, h, texto, est, extra);
    else botonClaro(x, y, w, h, texto, est, extra);
    return b;
  }
  I.botonDe = botonDe;
  // el fondo de los menús: el panorama con el negro al 75 % de la 1.2 (screen_background)
  function fondoOscuro(a) { ctx.fillStyle = 'rgba(0,0,0,' + (a === undefined ? 0.75 : a) + ')'; ctx.fillRect(0, 0, W, H); }

  // la primera vez: el idioma (inglés, castellano o portugués)
  function dibujarIdioma() {
    fondoOscuro(0.55);
    var pw = Math.min(W - 16 * E, 200 * E), bh = 30 * E, ph = 3 * bh + 2 * 4 * E + 40 * E, px = (W - pw) / 2, py = (H - ph) / 2;
    panel(px, py, pw, ph);
    var ic = UI.language_glyph_color;
    if (ic) I.dibujo('language_glyph_color', W / 2 - ic[2] * E / 2, py + 9 * E);
    I.texto('Language · Idioma', W / 2, py + 24 * E, '#ffffff', E, 'centro');
    var y = py + 36 * E;
    [['en', 'English'], ['es', 'Español'], ['pt', 'Português']].forEach(function (l) {
      botonDe(px + 10 * E, y, pw - 20 * E, bh, l[1], 'elegirIdioma', { idioma: l[0] });
      y += bh + 4 * E;
    });
  }
  // después: con o sin los shaders de Tito
  function dibujarShaders() {
    fondoOscuro(0.55);
    var pw = Math.min(W - 16 * E, 300 * E), ph = Math.min(H - 12 * E, 130 * E), px = (W - pw) / 2, py = (H - ph) / 2, bh = 30 * E;
    panel(px, py, pw, ph);
    I.texto(I.tp('shaders.titulo'), W / 2, py + 12 * E, '#ffff55', E, 'centro');
    I.texto(I.tp('shaders.pregunta'), W / 2, py + 26 * E, '#ffffff', E, 'centro');
    var bw = (pw - 26 * E) / 2, by = py + 42 * E;
    botonDe(px + 10 * E, by, bw, bh, I.tp('shaders.si'), 'shadersSi');
    botonDe(px + 16 * E + bw, by, bw, bh, I.tp('shaders.no'), 'shadersNo');
    I.textoCorto(I.tp('shaders.si2'), px + 10 * E + bw / 2, by + bh + 5 * E, bw, '#a0a0a0', E, 'centro');
    I.textoCorto(I.tp('shaders.no2'), px + 16 * E + bw * 1.5, by + bh + 5 * E, bw, '#a0a0a0', E, 'centro');
    I.texto(I.tp('shaders.despues'), W / 2, py + ph - 16 * E, '#808080', E, 'centro');
  }
  // el título de la 1.2: el logo arriba (al 10 % del alto, dos tercios del ancho), la frase
  // amarilla girada que late, Jugar y Ajustes, y abajo el copyright y la versión
  I.frase = '';
  function dibujarTitulo() {
    var lw = Math.min(W * 0.6625, H * 0.125 * W / H * 1.0 * 8), lh = 0;
    if (img.logo) {
      lw = Math.min(W * 0.6625, (H * 0.3) * img.logo.width / img.logo.height);
      lh = lw * img.logo.height / img.logo.width;
      // el logo viene de 1936 px y se achica: con la calidad alta el navegador promedia (la baja
      // saltea píxeles y los bordes de las letras salen serruchados)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img.logo, Math.round((W - lw) / 2), Math.round(H * 0.1), Math.round(lw), Math.round(lh));
      ctx.imageSmoothingEnabled = false;
    }
    if (I.frase) {
      var t = performance.now() / 1000, esc = 1.8 - Math.abs(Math.sin(t * Math.PI * 2 / 1)) * 0.1;
      // el tamaño de la frase del juego de PC: 1,8 x 100 / (ancho del texto + 32), latiendo
      var sw = I.anchoTexto(I.frase, E), k = Math.min(1.6, 100 / (sw / E + 32) * esc);
      ctx.save();
      ctx.translate(Math.round((W + lw) / 2 - 20 * E), Math.round(H * 0.1 + lh * 0.78));
      ctx.rotate(-20 * Math.PI / 180);
      ctx.scale(k, k);
      I.texto(I.frase, 0, -4 * E, '#ffff00', E, 'centro');
      ctx.restore();
    }
    // los botones: un panel de 150 de ancho cuyo borde de arriba está en el medio de la pantalla
    // (menos el 5 %), filas de 32 (Jugar; Ajustes sin la Tienda, que acá no hay)
    var bw = 148 * E, bh = 30 * E, x = (W - bw) / 2, y = Math.max(H * 0.1 + lh + 6 * E, H / 2 - H * 0.05);
    botonDe(x, y, bw, bh, I.t('menu.play', 'Play'), 'jugar');
    botonDe(x, y + 32 * E, bw, bh, I.t('menu.settings', 'Settings'), 'opciones');
    I.texto(I.t('menu.copyright', '©Mojang AB'), 2 * E, H - 10 * E, '#ffffff', E);
    I.texto(I.tp('version'), W - 2 * E, H - 10 * E, '#ffffff', E, 'der');
  }

  // ------------------------------------------------------------------------------------------
  // Jugar: las pestañas de arriba (Mundos, Amigos, Servidores y la X) y la lista de abajo, que se
  // corre arrastrando
  // ------------------------------------------------------------------------------------------
  I.tabJugar = 0;
  var listaScroll = 0, listaMax = 0;
  I.acciones.tabJugar = function (b) { I.tabJugar = b.i; listaScroll = 0; sucio = true; };
  function fecha(t) {
    if (!t) return '';
    var d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return I.t('playscreen.lastPlayed.today', 'Today');
    if (d === 1) return I.t('playscreen.lastPlayed.yesterday', 'Yesterday');
    if (d < 14) return I.f(I.t('playscreen.lastPlayed.daysAgo', '%1 days ago'), d);
    if (d < 60) return I.f(I.t('playscreen.lastPlayed.weeksAgo', '%1 weeks ago'), Math.floor(d / 7));
    return I.t('playscreen.lastPlayed.longAgo', 'Long ago');
  }
  function pestanas(x, y, w, h, lista, activa, accion) {
    var tw = Math.floor(w / lista.length);
    for (var i = 0; i < lista.length; i++) {
      var tx = x + i * tw, ancho = i === lista.length - 1 ? w - tw * i : tw, on = i === activa;
      var tex = on ? (i === 0 ? 'TabTopFrontLeftMost' : 'TabTopFront') : (i === 0 ? 'TabTopBackLeftMost' : 'TabTopBack');
      nueve(tex, tx, y + (on ? 0 : 2 * E), ancho + E, h - (on ? 0 : 2 * E));
      I.botones.push({ x: tx, y: y, w: ancho, h: h, accion: accion, i: i });
      var ic = UI[lista[i][1]], iw = ic ? ic[2] * E : 0, txt = lista[i][0], textW = I.anchoTexto(txt);
      var cx = tx + ancho / 2 - (iw + 4 * E + textW) / 2, cy = y + h / 2 + (on ? 0 : E);
      if (ic) I.dibujo(lista[i][1], cx, cy - ic[3] * E / 2);
      I.textoCorto(txt, cx + iw + 4 * E, cy - 4 * E, ancho - iw - 10 * E, GRIS, E, null, true);
    }
  }
  function dibujarJugar() {
    fondoOscuro();
    var pw = Math.min(W - 8 * E, 360 * E), px = (W - pw) / 2, py = 4 * E, ph = H - 8 * E, th = 30 * E;
    var tabs = [[I.t('selectWorld.tab.worlds', 'Worlds'), 'worldsIcon'], [I.t('selectWorld.tab.friends', 'Friends'), 'Friend1'],
      [I.t('selectWorld.tab.thirdParty', 'Servers'), 'servers']];
    pestanas(px, py, pw - th, th, tabs, I.tabJugar, 'tabJugar');
    // la X para volver (la pestaña de cerrar de la 1.2)
    var bx = { x: px + pw - th, y: py, w: th, h: th, accion: 'titulo' };
    I.botones.push(bx);
    nueve('TabTopBack', bx.x, bx.y + 2 * E, bx.w, bx.h - 2 * E);
    I.dibujo(apretadoEs(bx) ? 'x_pressed' : 'x_default', bx.x + (th - 12 * E) / 2, bx.y + (th - 12 * E) / 2 + E, 12 * E, 12 * E);
    var cy = py + th - E, ch = ph - th + E;
    panel(px, cy, pw, ch);
    var lx = px + 6 * E, lw = pw - 12 * E, ly = cy + 6 * E, lh = ch - 12 * E;
    ctx.save();
    ctx.beginPath(); ctx.rect(lx, ly, lw, lh); ctx.clip();
    var y = ly - listaScroll, ih = 30 * E;
    function etiqueta(t) { I.texto(t, lx + E, y + E, '#ffffff', E); y += 11 * E; }
    if (I.tabJugar === 0) {
      botonDe(lx, y, lw, ih, I.t('selectWorld.createNew', 'Create New'), 'crear', { enLista: true }); y += ih + 3 * E;
      // los tres mundos públicos, fijados arriba en una sola fila (así los mundos propios se ven sin
      // tener que correr la lista)
      etiqueta(I.tp('publico.etiqueta'));
      filaPublicos(lx, y, lw, ih); y += ih + 3 * E;
      if (I.mundos.length) etiqueta(I.t('selectWorld.tab.worlds', 'Worlds'));
      I.mundos.forEach(function (m, i) {
        filaMundo(lx, y, lw, ih - E, m, i); y += ih + E;
      });
    } else if (I.tabJugar === 1) {
      var l = I.lineas(I.t('networkWorld.no_joinable_friends_label', ''), lw - 8 * E, E);
      l.forEach(function (s) { I.texto(s, lx + lw / 2, y + 6 * E, '#c0c0c0', E, 'centro'); y += 10 * E; });
      y += 6 * E;
      etiqueta(I.tp('publico.etiqueta'));
      filaPublicos(lx, y, lw, ih); y += ih + 3 * E;
    } else {
      botonDe(lx, y, lw, ih, I.t('networkWorld.add_server', 'Add Server'), 'agregarServidor', { enLista: true, icono: 'addServer' }); y += ih + 3 * E;
      etiqueta(I.t('networkWorld.servers_label', 'Servers'));
      I.publicos.forEach(function (s, i) { filaServidor(lx, y, lw, ih, s, 'entrarPublico', i, false); y += ih + 2 * E; });
      if (I.servidores.length) { y += E; etiqueta(I.t('networkWorld.more_servers', 'More Servers')); }
      I.servidores.forEach(function (s, i) { filaServidor(lx, y, lw, ih, s, 'entrarServidor', i, true); y += ih + 2 * E; });
    }
    ctx.restore();
    listaMax = Math.max(0, y + listaScroll - ly - lh);
    I.botones.push({ x: lx, y: ly, w: lw, h: lh, accion: 'lista', debajo: true });
    barraScroll(lx + lw + E, ly, lh);
  }
  function filaPublicos(x, y, w, h) {
    var n = I.publicos.length, bw = (w - (n - 1) * 3 * E) / n;
    I.publicos.forEach(function (s, i) {
      var b = { x: x + i * (bw + 3 * E), y: y, w: bw, h: h, accion: 'entrarPublico', i: i, enLista: true };
      I.botones.push(b);
      var est = apretadoEs(b) ? 2 : 0, dy = est === 2 ? E : 0, color = est ? '#ffffff' : GRIS;
      botonClaro(b.x, b.y, b.w, b.h, '', est);
      var isz = h - 10 * E;
      I.dibujo(s.icono || 'World', b.x + 4 * E, b.y + 5 * E + dy, isz, isz);
      var tx = b.x + 7 * E + isz, tw = b.w - (tx - b.x) - 4 * E;
      I.textoCorto(s.corto || s.nombre, tx, b.y + 5 * E + dy, tw, color, E, null, true);
      var sub = s.jugadores ? I.f(I.tp('jugando'), s.jugadores) : s.fuera ? I.tp('red.desconectado') : I.tp('mundo.publico');
      I.textoCorto(sub, tx, b.y + h - 13 * E + dy, tw, est ? '#e0e0e0' : '#6b6b6b', E, null, true);
    });
  }
  function barraScroll(x, y, h) {
    if (listaMax <= 0) return;
    var total = h + listaMax, mano = Math.max(10 * E, h * h / total), my = y + (h - mano) * (listaScroll / listaMax);
    nueve('ScrollHandle', x, my, 3 * E, mano);
  }
  function filaMundo(x, y, w, h, m, i) {
    var ew = h, b = { x: x, y: y, w: w - ew + E, h: h, accion: 'abrir', i: i, enLista: true };
    I.botones.push(b);
    var est = apretadoEs(b) ? 2 : 0;
    botonOscuro(b.x, b.y, b.w, b.h, '', est);
    var dy = est === 2 ? E : 0;
    // la foto del mundo (default_world de la 1.2), el nombre, la fecha y el modo
    if (UI.default_world) { I.dibujo('default_world', x + 2 * E, y + 2 * E + dy, (h - 4 * E) * 16 / 9, h - 4 * E); }
    var tx = x + 4 * E + (h - 4 * E) * 16 / 9, tw = b.w - (tx - x) - 4 * E;
    I.textoCorto(m.nombre, tx, y + 4 * E + dy, tw, '#ffffff', E);
    I.textoCorto(fecha(m.jugado) + '  ' + I.t('selectWorld.gameMode.creative', 'Creative'), tx, y + h - 12 * E + dy, tw, '#a0a0a0', E, null, true);
    var eb = { x: x + w - ew, y: y, w: ew, h: h, accion: 'editarMundo', i: i, enLista: true };
    I.botones.push(eb);
    botonOscuro(eb.x, eb.y, eb.w, eb.h, '', apretadoEs(eb) ? 2 : 0);
    I.dibujo('editIcon', eb.x + (ew - 22 * E * 0.7) / 2, eb.y + (h - 16 * E * 0.7) / 2 + (apretadoEs(eb) ? E : 0), 22 * E * 0.7, 16 * E * 0.7);
  }
  // un servidor: su ícono, el nombre, la descripción y cuántos hay jugando (con la señal de la 1.2)
  function filaServidor(x, y, w, h, s, accion, i, editable) {
    var ew = editable ? h : 0, b = { x: x, y: y, w: w - ew + (ew ? E : 0), h: h, accion: accion, i: i, enLista: true };
    I.botones.push(b);
    var est = apretadoEs(b) ? 2 : 0, dy = est === 2 ? E : 0;
    if (editable) botonOscuro(b.x, b.y, b.w, b.h, '', est); else botonClaro(b.x, b.y, b.w, b.h, '', est);
    var color = editable || est ? '#ffffff' : GRIS, gris = editable || est ? '#c0c0c0' : '#6b6b6b';
    var ic = s.icono || 'World', isz = h - 8 * E;
    I.dibujo(ic, x + 4 * E, y + 4 * E + dy, isz, isz);
    var tx = x + 8 * E + isz, tw = b.w - (tx - x) - 26 * E;
    I.textoCorto(s.nombre, tx, y + 5 * E + dy, tw, color, E, null, true);
    I.textoCorto(s.desc || '', tx, y + h - 13 * E + dy, tw, gris, E, null, true);
    var ping = s.jugadores === null || s.jugadores === undefined ? null : s.jugadores > 0 ? 'Ping_Green' : 'Ping_Yellow';
    if (s.fuera) ping = 'Ping_Offline_Red';
    if (ping) I.dibujo(ping, b.x + b.w - 18 * E, y + 5 * E + dy);
    if (s.jugadores) I.texto(String(s.jugadores), b.x + b.w - 6 * E, y + h - 13 * E + dy, color, E, 'der', true);
    if (editable) {
      var eb = { x: x + w - ew, y: y, w: ew, h: h, accion: 'editarServidor', i: i, enLista: true };
      I.botones.push(eb);
      botonOscuro(eb.x, eb.y, eb.w, eb.h, '', apretadoEs(eb) ? 2 : 0);
      I.dibujo('editIcon', eb.x + (ew - 22 * E * 0.7) / 2, eb.y + (h - 16 * E * 0.7) / 2 + (apretadoEs(eb) ? E : 0), 22 * E * 0.7, 16 * E * 0.7);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Formularios (crear un mundo, editar un mundo, agregar un servidor): el encabezado de la 1.2, a
  // la izquierda el botón grande y a la derecha los campos. I.formulario = { titulo, boton,
  // accionBoton, volver, filas: [{ tipo: 'campo' | 'interruptor' | 'eleccion' | 'texto' | 'boton',
  // k, texto, valor(), placeholder, accion }] }
  // ------------------------------------------------------------------------------------------
  I.formulario = null;
  function dibujarFormulario() {
    fondoOscuro();
    var f = I.formulario, hh = encabezado(f.titulo, f.volver);
    var iz = 6 * E, lw = Math.min(110 * E, Math.floor(W * 0.3)), y0 = hh + 6 * E;
    if (f.boton) botonDe(iz, y0, lw, 30 * E, f.boton, f.accionBoton);
    if (f.boton2) botonDe(iz, y0 + 34 * E, lw, 30 * E, f.boton2, f.accionBoton2, f.peligro2 ? { oscuro: true } : null);
    var px = iz + lw + 6 * E, pw = W - px - 6 * E, py = y0, ph = H - py - 6 * E;
    panel(px, py, pw, ph);
    var x = px + 10 * E, w = pw - 20 * E, y = py + 10 * E;
    ctx.save();
    ctx.beginPath(); ctx.rect(px + 4 * E, py + 4 * E, pw - 8 * E, ph - 8 * E); ctx.clip();
    y -= listaScroll;
    f.filas.forEach(function (r) {
      if (r.tipo === 'texto') {
        I.lineas(r.texto, w, E).forEach(function (l) { I.texto(l, x, y, r.color || '#a0a0a0', E); y += 10 * E; });
        y += 2 * E;
        return;
      }
      if (r.tipo === 'interruptor') {
        I.texto(r.texto, x, y + 4 * E, '#ffffff', E);
        interruptor(x + w - 30 * E, y, !!r.valor());
        I.botones.push({ x: x, y: y - 2 * E, w: w, h: 20 * E, accion: 'formFila', fila: r, enLista: true });
        y += 22 * E;
        return;
      }
      I.texto(r.texto, x, y, '#ffffff', E); y += 11 * E;
      if (r.tipo === 'campo') {
        var b = { x: x, y: y, w: w, h: 20 * E, accion: 'formFila', fila: r, enLista: true };
        I.botones.push(b);
        campo(x, y, w, 20 * E, r.valor(), r.placeholder, apretadoEs(b));
      } else {
        botonDe(x, y, w, 20 * E, r.valorTexto ? r.valorTexto() : r.valor(), 'formFila', { fila: r, enLista: true });
      }
      y += 26 * E;
    });
    ctx.restore();
    listaMax = Math.max(0, y + listaScroll - py - ph + 6 * E);
    I.botones.push({ x: px, y: py, w: pw, h: ph, accion: 'lista', debajo: true });
  }

  // ------------------------------------------------------------------------------------------
  // Ajustes, como los de la 1.2: las secciones a la izquierda (con sus dibujos) y a la derecha los
  // interruptores, deslizadores y elecciones. Las filas las arma principal.js en I.ajustes:
  // [{ nombre, icono, filas: [{ tipo: 'casilla' | 'deslizador' | 'eleccion' | 'campo', k, texto,
  // min, max, paso, valor(), textoValor() }] }]
  // ------------------------------------------------------------------------------------------
  I.ajustes = [];
  var ajSeccion = 0;
  I.acciones.seccion = function (b) { ajSeccion = b.i; listaScroll = 0; sucio = true; };
  function dibujarOpciones() {
    fondoOscuro(I.enJuego ? 0.6 : 0.75);
    var hh = encabezado(I.t('menu.settings', 'Settings'), 'listoOpciones');
    var secs = I.ajustes, lw = Math.min(110 * E, Math.floor(W * 0.3)), lx = 6 * E, ly = hh + 6 * E, bh = 26 * E;
    if (ajSeccion >= secs.length) ajSeccion = 0;
    for (var i = 0; i < secs.length; i++) {
      var b = { x: lx, y: ly + i * (bh + 2 * E), w: lw, h: bh, accion: 'seccion', i: i };
      I.botones.push(b);
      var on = i === ajSeccion;
      if (on) botonClaro(b.x, b.y, b.w, b.h, '', 2); else botonOscuro(b.x, b.y, b.w, b.h, '', apretadoEs(b) ? 2 : 0);
      var ic = secs[i].icono, p = ic && UI[ic + '_color'] ? ic + '_color' : ic;
      var iw = 0;
      if (p && UI[p]) { iw = UI[p][2] * E; I.dibujo(p, b.x + 5 * E, b.y + (bh - UI[p][3] * E) / 2 + (on ? E : 0)); }
      I.textoCorto(secs[i].nombre, b.x + 9 * E + Math.max(iw, 20 * E), b.y + bh / 2 - 4 * E + (on ? E : 0), b.w - 14 * E - Math.max(iw, 20 * E), '#ffffff', E, null, true);
    }
    var px = lx + lw + 6 * E, pw = W - px - 6 * E, py = ly, ph = H - py - 6 * E, fh = 24 * E;
    panel(px, py, pw, ph);
    var filas = secs[ajSeccion] ? secs[ajSeccion].filas : [];
    ctx.save();
    ctx.beginPath(); ctx.rect(px + 4 * E, py + 4 * E, pw - 8 * E, ph - 8 * E); ctx.clip();
    var x = px + 10 * E, w = pw - 20 * E, y = py + 8 * E - listaScroll;
    for (i = 0; i < filas.length; i++) {
      var f = filas[i], vt = f.textoValor ? f.textoValor() : '';
      if (f.tipo === 'casilla') {
        I.textoCorto(f.texto, x, y + 4 * E, w - 36 * E, '#ffffff', E);
        interruptor(x + w - 30 * E, y, !!f.valor());
        I.botones.push({ x: px, y: y - 2 * E, w: pw, h: fh, accion: 'ajuste', fila: f, enLista: true });
        y += fh;
      } else if (f.tipo === 'deslizador') {
        I.textoCorto(f.texto + ': ' + vt, x, y, w, '#ffffff', E);
        var sy = y + 12 * E, v = Math.max(0, Math.min(1, (f.valor() - f.min) / (f.max - f.min)));
        nueve('slider_background', x, sy + 3 * E, w, 4 * E);
        nueve('slider_progress', x, sy + 3 * E, Math.max(2 * E, w * v), 4 * E);
        nueve('slider_button_default', x + (w - 8 * E) * v, sy - 2 * E, 8 * E, 14 * E);
        I.botones.push({ x: x - 6 * E, y: y, w: w + 12 * E, h: 28 * E, accion: 'deslizar', fila: f, x0: x + 4 * E, x1: x + w - 4 * E, enLista: true });
        y += 30 * E;
      } else if (f.tipo === 'campo') {
        I.texto(f.texto, x, y, '#ffffff', E);
        var bc = { x: x, y: y + 11 * E, w: w, h: 20 * E, accion: 'ajuste', fila: f, enLista: true };
        I.botones.push(bc);
        campo(x, bc.y, w, 20 * E, f.valor(), '', false);
        y += 34 * E;
      } else {
        I.textoCorto(f.texto, x, y + 6 * E, w * 0.55, '#ffffff', E);
        var ew = Math.min(110 * E, w * 0.42);
        var be = { x: x + w - ew, y: y, w: ew, h: 20 * E, accion: 'ajuste', fila: f, enLista: true };
        I.botones.push(be);
        nueve('dropdown_background', be.x, be.y, be.w, be.h);
        I.textoCorto(vt, be.x + 4 * E, be.y + 6 * E, be.w - 16 * E, '#ffffff', E, null, true);
        if (UI.dropdown_chevron) I.dibujo('dropdown_chevron', be.x + be.w - 11 * E, be.y + (be.h - UI.dropdown_chevron[3] * E) / 2);
        y += fh;
      }
    }
    ctx.restore();
    listaMax = Math.max(0, y + listaScroll - py - ph + 8 * E);
    I.botones.push({ x: px, y: py, w: pw, h: ph, accion: 'lista', debajo: true });
    barraScroll(px + pw - 5 * E, py + 4 * E, ph - 8 * E);
  }
  // la pausa de la 1.2: el menú del juego al medio (y en un servidor, quiénes están jugando)
  function dibujarPausa() {
    fondoOscuro(0.5);
    var bw = Math.min(W * 0.5, 200 * E), bh = 30 * E, x = (W - bw) / 2, y = H * 0.18;
    I.texto(I.t('pauseScreen.header', 'Game Menu'), W / 2, y - 16 * E, '#ffffff', E, 'centro');
    botonDe(x, y, bw, bh, I.t('pauseScreen.back', 'Back to Game'), 'seguir'); y += bh + 4 * E;
    botonDe(x, y, bw, bh, I.t('menu.settings', 'Settings'), 'opcionesJuego'); y += bh + 4 * E;
    botonDe(x, y, bw, bh, I.t('pauseScreen.quit', 'Save & Quit'), 'salir');
    var lj = I.juego.jugadores;
    if (lj && lj.length) {
      var pw = Math.min(120 * E, (W - bw) / 2 - 12 * E), px = W - pw - 6 * E, py = H * 0.18, ph = Math.min(H - py - 6 * E, 16 * E + lj.length * 11 * E);
      if (pw > 60 * E) {
        panel(px, py, pw, ph);
        lj.forEach(function (n, i) { if (14 * E + i * 11 * E < ph - 8 * E) I.textoCorto(n, px + 8 * E, py + 8 * E + i * 11 * E, pw - 16 * E, '#ffffff', E); });
      }
    }
  }
  // el inventario creativo de la 1.2 (bolsillo): las pestañas con sus dibujos a la izquierda, la
  // grilla de casillas y la barra rápida abajo
  function dibujarInventario() {
    fondoOscuro(0.5);
    var pw = Math.min(W - 12 * E, 330 * E), ph = H - 12 * E, px = (W - pw) / 2, py = 6 * E;
    panel(px, py, pw, ph);
    var tabs = [['craftingScreen.tab.construction', 'icon_recipe_construction', 'Construction'], ['craftingScreen.tab.nature', 'icon_recipe_nature', 'Nature'],
      ['craftingScreen.tab.items', 'icon_recipe_item', 'Items']];
    var tw = 26 * E;
    for (var t = 0; t < tabs.length; t++) {
      var b = { x: px + 8 * E + t * (tw + 2 * E), y: py + 8 * E, w: tw, h: 22 * E, accion: 'tab', i: t };
      I.botones.push(b);
      if (t === invTab) botonClaro(b.x, b.y, b.w, b.h, '', 2); else botonOscuro(b.x, b.y, b.w, b.h, '', 0);
      var ic = UI[tabs[t][1]];
      if (ic) I.dibujo(tabs[t][1], b.x + (tw - ic[2] * E) / 2, b.y + (22 * E - ic[3] * E) / 2 + (t === invTab ? E : 0));
    }
    I.texto(I.t(tabs[invTab][0], tabs[invTab][2]), px + 14 * E + tabs.length * (tw + 2 * E), py + 15 * E, '#ffffff', E);
    var cb = { x: px + pw - 22 * E, y: py + 8 * E, w: 16 * E, h: 16 * E, accion: 'cerrarInv' };
    I.botones.push(cb);
    I.dibujo(apretadoEs(cb) ? 'x_pressed' : 'x_default', cb.x, cb.y, 16 * E, 16 * E);
    var lista = invLista.filter(function (it) { return it.tab === invTab; });
    var lado = 20 * E, cols = Math.floor((pw - 16 * E) / lado), gx = px + (pw - cols * lado) / 2, gy = py + 34 * E;
    var filasVis = Math.floor((ph - 34 * E - 32 * E) / lado);
    var maxScroll = Math.max(0, Math.ceil(lista.length / cols) - filasVis);
    invScroll = Math.max(0, Math.min(invScroll, maxScroll));
    ctx.save();
    ctx.beginPath(); ctx.rect(px, gy, pw, filasVis * lado); ctx.clip();
    for (var i = 0; i < lista.length; i++) {
      var f = Math.floor(i / cols) - invScroll, c = i % cols;
      if (f < 0 || f >= filasVis) continue;
      var x = gx + c * lado, y = gy + f * lado;
      nueve('item_cell', x, y, lado, lado);
      icono(lista[i].id, lista[i].m, x + 2 * E, y + 2 * E, lado - 4 * E);
      I.botones.push({ x: x, y: y, w: lado, h: lado, accion: 'item', item: lista[i] });
    }
    ctx.restore();
    I.botones.push({ x: px, y: gy, w: pw, h: filasVis * lado, accion: 'rejilla', max: maxScroll, lado: lado });
    // la barra rápida del jugador abajo (para ver dónde va lo que se elige)
    var bw = 182 * E, bx = Math.round((W - bw) / 2), by = py + ph - 28 * E;
    barra(bx, by);
    var j = I.juego;
    for (i = 0; i < 9; i++) if (j.barra[i]) icono(j.barra[i].id, j.barra[i].m, bx + (3 + i * 20) * E, by + 3 * E, 16 * E);
    I.dibujo('selected_hotbar_slot', bx - E + j.elegido * 20 * E, by - E);
    I.botones.push({ x: bx, y: by, w: bw, h: 22 * E, accion: 'barra', bx: bx });
  }
  // una pregunta de sí o no (borrar un mundo o un servidor)
  I.pregunta = null;
  I.preguntar = function (texto, linea2, si) { I.pregunta = { texto: texto, linea2: linea2, si: si, volver: I.pantalla }; I.ir('pregunta'); };
  I.acciones.preguntaSi = function () { var p = I.pregunta; I.ir(p.volver); if (p.si) p.si(); };
  I.acciones.preguntaNo = function () { I.ir(I.pregunta.volver); };
  function dibujarPregunta() {
    var p = I.pregunta, pw = Math.min(W - 16 * E, 260 * E), ph = 100 * E, px = (W - pw) / 2, py = (H - ph) / 2, bh = 26 * E;
    fondoOscuro(0.75);
    panel(px, py, pw, ph);
    I.textoCorto(p.texto, W / 2, py + 14 * E, pw - 20 * E, '#ffffff', E, 'centro');
    if (p.linea2) I.textoCorto(p.linea2, W / 2, py + 28 * E, pw - 20 * E, '#a0a0a0', E, 'centro');
    var bw = (pw - 26 * E) / 2;
    botonDe(px + 10 * E, py + ph - 36 * E, bw, bh, I.t('gui.yes', 'Yes'), 'preguntaSi');
    botonDe(px + pw / 2 + 3 * E, py + ph - 36 * E, bw, bh, I.t('gui.no', 'No'), 'preguntaNo');
  }
  // la muerte (en los servidores): rojo, "¡Has muerto!", quién fue, reaparecer o salir
  I.muerte = { texto: '' };
  function dibujarMuerte() {
    ctx.fillStyle = 'rgba(80,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    I.texto(I.t('deathScreen.title', 'You died!'), W / 2, H * 0.2, '#ffffff', E * 2, 'centro');
    if (I.muerte.texto) I.texto(I.muerte.texto, W / 2, H * 0.2 + 24 * E, '#ffffff', E, 'centro');
    var bw = Math.min(W * 0.5, 200 * E), bh = 30 * E, x = (W - bw) / 2, y = H * 0.48;
    botonDe(x, y, bw, bh, I.t('deathScreen.respawn', 'Respawn'), 'reaparecer');
    botonDe(x, y + bh + 4 * E, bw, bh, I.t('deathScreen.quit', 'Main menu'), 'salir');
  }
  // el chat: los mensajes y el campo para escribir abajo, con el botón de mandar
  function dibujarChat() {
    dibujarJuego();
    I.botones = [];
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    var j = I.juego, y = H - 40 * E;
    var l = j.chat.slice(-14);
    for (var i = l.length - 1; i >= 0 && y > 30 * E; i--) {
      I.textoCorto(l[i].s, 6 * E, y, W - 12 * E, l[i].c || '#ffffff', E);
      y -= 10 * E;
    }
    nueve('header_bar', 0, 0, W, 24 * E);
    I.texto(I.t('chat.title', 'Chat'), W / 2, 7 * E, '#ffffff', E, 'centro');
    var vb = botonDe(2 * E, 2 * E, 26 * E, 18 * E, '', 'cerrarChat', { oscuro: true });
    flecha(vb.x + vb.w / 2, vb.y + vb.h / 2, apretadoEs(vb));
    var cw = W - 40 * E, cb = { x: 6 * E, y: H - 26 * E, w: cw - 6 * E, h: 20 * E, accion: 'escribirChat' };
    I.botones.push(cb);
    campo(cb.x, cb.y, cb.w, cb.h, '', I.tp('chat.escribir'), false);
    var sb = botonDe(W - 32 * E, H - 26 * E, 26 * E, 20 * E, '', 'escribirChat');
    if (UI.chat_send) I.dibujo('chat_send', sb.x + (sb.w - 21 * E * 0.8) / 2, sb.y + (sb.h - 18 * E * 0.8) / 2 + (apretadoEs(sb) ? E : 0), 21 * E * 0.8, 18 * E * 0.8);
  }
  function dibujarCargando() {
    fondoOscuro(0.5);
    if (I.cargandoTexto) I.texto(I.cargandoTexto, W / 2, H * 0.45, '#ffffff', E, 'centro');
    if (I.cargandoParte !== undefined) {
      var w = Math.min(W * 0.5, 160 * E), x = (W - w) / 2, y = H * 0.45 + 14 * E;
      ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, 2 * E);
      ctx.fillStyle = '#80ff80'; ctx.fillRect(x, y, w * I.cargandoParte, 2 * E);
    }
  }

  var ultimoFps = -1, ultimoMouse = false, animando = false;
  function hayQueDibujarJuego() {
    var j = I.juego, ahora = performance.now();
    var anima = ahora < j.nombreHasta + 100 || ahora < j.mensajeHasta + 100 || !!j.anillo || j.dano > 0 || j.nombres.length > 0 ||
      (j.chat.length && ahora - j.chat[j.chat.length - 1].t < 11000) || ahora < (j.parpadeoHasta || 0) + 100;
    var r = anima || animando || (j.mostrarFps && j.fps !== ultimoFps) || I.conMouse !== ultimoMouse;
    animando = anima;
    return r;
  }
  I.dibujar = function (forzar) {
    var p = I.pantalla;
    if (!sucio && !forzar && !((p === 'juego') && hayQueDibujarJuego()) && p !== 'titulo') return;
    sucio = false;
    ultimoFps = I.juego.fps; ultimoMouse = I.conMouse;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    I.botones = [];
    switch (p) {
      case 'juego': dibujarJuego(); break;
      case 'titulo': dibujarTitulo(); break;
      case 'jugar': dibujarJugar(); break;
      case 'formulario': dibujarFormulario(); break;
      case 'pausa': dibujarJuego(); I.botones = []; dibujarPausa(); break;
      case 'opciones': dibujarOpciones(); break;
      case 'inventario': dibujarInventario(); break;
      case 'cargando': dibujarCargando(); break;
      case 'pregunta': dibujarPregunta(); break;
      case 'idioma': dibujarIdioma(); break;
      case 'shaders': dibujarShaders(); break;
      case 'muerte': dibujarJuego(); I.botones = []; dibujarMuerte(); break;
      case 'chat': dibujarChat(); break;
    }
  };
  I.ir = function (p) { if (p !== I.pantalla) listaScroll = 0; I.pantalla = p; apretado = null; sucio = true; };
  I.menu = function () { var p = I.pantalla; return p !== 'juego' && p !== 'pausa' && p !== 'inventario' && p !== 'muerte' && p !== 'chat'; };

  // ------------------------------------------------------------------------------------------
  // Entrada
  // ------------------------------------------------------------------------------------------
  // lo que el juego lee: movimiento, saltar, subir/bajar volando, mirar (acumulado), y los toques
  // sobre el mundo (tocar = poner/usar, mantener = romper) con su posición en la pantalla
  I.control = { adelante: 0, costado: 0, saltar: false, subir: false, bajar: false, agachar: false, correr: false,
    agacharTactil: false, mirarX: 0, mirarY: 0, toque: null, rompiendo: null, rueda: 0 };
  var dedos = new Map();      // pointerId → estado del dedo
  function dentro(b, x, y) { return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h; }
  function botonEn(x, y) {
    for (var i = I.botones.length - 1; i >= 0; i--) if (dentro(I.botones[i], x, y) && !I.botones[i].debajo) return i;
    for (i = I.botones.length - 1; i >= 0; i--) if (dentro(I.botones[i], x, y)) return i;
    return -1;
  }
  function buscar(x, y, accion) {
    for (var i = I.botones.length - 1; i >= 0; i--) if (I.botones[i].accion === accion && dentro(I.botones[i], x, y)) return I.botones[i];
    return null;
  }
  // un deslizador de los ajustes: el valor según dónde está el dedo, redondeado al paso
  function moverDeslizador(b, x) {
    var f = b.fila, v = Math.max(0, Math.min(1, (x - b.x0) / (b.x1 - b.x0)));
    var valor = f.min + v * (f.max - f.min);
    valor = Math.round(valor / f.paso) * f.paso;
    valor = Math.max(f.min, Math.min(f.max, +valor.toFixed(4)));
    if (valor !== f.valor() && I.acciones.deslizar) I.acciones.deslizar(f, valor);
    sucio = true;
  }
  function crucetaEn(x, y) {
    for (var i = crucetaBotones.length - 1; i >= 0; i--) {
      var b = crucetaBotones[i];
      if (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) return b.n;
    }
    return null;
  }
  function actualizarCruceta() {
    var c = I.control;
    c.adelante = 0; c.costado = 0; c.saltar = false; c.subir = false; c.bajar = false;
    for (var k in pulsados) {
      if (!pulsados[k]) continue;
      if (k === 'arriba') c.adelante = 1;
      else if (k === 'abajo') c.adelante = -1;
      else if (k === 'izq') c.costado = -1;
      else if (k === 'der') c.costado = 1;
      else if (k === 'arribaIzq') { c.adelante = 1; c.costado = -1; }
      else if (k === 'arribaDer') { c.adelante = 1; c.costado = 1; }
      else if (k === 'saltar') c.saltar = true;
      else if (k === 'subir') c.subir = true;
      else if (k === 'bajar') c.bajar = true;
    }
    teclasACruceta();
  }
  var teclas = {};
  function teclasACruceta() {
    var c = I.control;
    if (teclas.KeyW) c.adelante = 1; if (teclas.KeyS) c.adelante = -1;
    if (teclas.KeyA) c.costado = -1; if (teclas.KeyD) c.costado = 1;
    if (teclas.Space) { c.saltar = true; c.subir = true; }
    if (teclas.ShiftLeft || teclas.ShiftRight) c.bajar = true;
    c.agachar = !!(teclas.ShiftLeft || teclas.ShiftRight || c.agacharTactil);
    c.correr = !!(teclas.ControlLeft || teclas.ControlRight);
  }

  function punto(e) { var r = hud.getBoundingClientRect(); return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; }
  function conLista() { var p = I.pantalla; return p === 'jugar' || p === 'opciones' || p === 'formulario'; }

  function entrada() {
    var objetivo = document.getElementById('lienzo').parentNode;
    objetivo.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && I.pantalla === 'juego' && document.pointerLockElement) return mouseAbajo(e);
      var p = punto(e), x = p[0], y = p[1];
      if (I.pantalla === 'juego') {
        var cr = crucetaEn(x, y);
        if (cr === 'agachar') {
          I.control.agacharTactil = !I.control.agacharTactil;
          actualizarCruceta(); sucio = true;
          dedos.set(e.pointerId, { tipo: 'boton' });
          return;
        }
        if (cr) {
          // el doble toque de saltar en creativo: volar (y en "subir", dejar de volar), como el juego
          // con la hora del toque (no la de cuando se atiende: con cuadros lentos llegan juntos)
          if ((cr === 'saltar' || cr === 'subir') && I.acciones.saltoDoble) I.acciones.saltoDoble(e.timeStamp);
          dedos.set(e.pointerId, { tipo: 'cruceta', b: cr });
          pulsados[cr] = true; actualizarCruceta(); sucio = true;
          return;
        }
        var bi = botonEn(x, y);
        if (bi >= 0) {
          var b = I.botones[bi];
          if (b.accion === 'barra') {
            var slot = Math.max(0, Math.min(8, Math.floor((x - b.bx) / (20 * E))));
            if (I.acciones.elegir) I.acciones.elegir(slot);
          } else if (I.acciones[b.accion]) I.acciones[b.accion](b);
          dedos.set(e.pointerId, { tipo: 'boton' });
          return;
        }
        if (e.pointerType === 'mouse' && I.acciones.bloquearMouse) { I.acciones.bloquearMouse(); return; }
        // un dedo sobre el mundo: mirar si se mueve; tocar o mantener si no
        dedos.set(e.pointerId, { tipo: 'mundo', x0: x, y0: y, x: x, y: y, t0: e.timeStamp || performance.now(), movio: false });
        return;
      }
      if (I.pantalla === 'opciones') {
        var desl = buscar(x, y, 'deslizar');
        if (desl) { dedos.set(e.pointerId, { tipo: 'deslizador', b: desl }); moverDeslizador(desl, x); return; }
      }
      if (conLista()) {
        var lista = buscar(x, y, 'lista');
        if (lista) {
          // en una lista que se corre: el botón de abajo se decide al soltar sin haber arrastrado
          var i3 = botonEn(x, y), bb = i3 >= 0 && I.botones[i3].accion !== 'lista' ? I.botones[i3] : null;
          if (bb) { apretado = bb.accion; apretadoN = i3; sucio = true; }
          dedos.set(e.pointerId, { tipo: 'lista', y0: y, s0: listaScroll, b: bb, movio: false });
          return;
        }
      }
      var i2 = botonEn(x, y);
      if (I.pantalla === 'inventario') {
        if (i2 >= 0 && I.botones[i2].accion === 'rejilla') {
          dedos.set(e.pointerId, { tipo: 'rejilla', y0: y, s0: invScroll, b: I.botones[i2], x0: x, movio: false, item: null });
          // el ítem debajo, por si es un toque
          for (var k = I.botones.length - 1; k >= 0; k--) if (I.botones[k].accion === 'item' && dentro(I.botones[k], x, y)) { dedos.get(e.pointerId).item = I.botones[k].item; break; }
          return;
        }
      }
      if (i2 >= 0) {
        apretado = I.botones[i2].accion; apretadoN = i2; sucio = true;
        dedos.set(e.pointerId, { tipo: 'menu', i: i2, b: I.botones[i2] });
      }
    });
    objetivo.addEventListener('pointermove', function (e) {
      var d = dedos.get(e.pointerId);
      if (!d) { if (e.pointerType === 'mouse' && document.pointerLockElement && I.pantalla === 'juego') { I.control.mirarX += e.movementX; I.control.mirarY += e.movementY; } return; }
      var p = punto(e), x = p[0], y = p[1];
      if (d.tipo === 'cruceta') {
        // deslizar el dedo entre flechas (como el juego)
        var cr = crucetaEn(x, y);
        if (cr && cr !== d.b && cr !== 'agachar') { pulsados[d.b] = false; d.b = cr; pulsados[cr] = true; actualizarCruceta(); sucio = true; }
      } else if (d.tipo === 'mundo') {
        var dx = x - d.x, dy = y - d.y;
        d.x = x; d.y = y;
        if (!d.movio && Math.hypot(x - d.x0, y - d.y0) > 12 * dpr) d.movio = true;
        if (d.movio) { I.control.mirarX += dx / dpr; I.control.mirarY += dy / dpr; }
        if (d.rompiendo) I.control.rompiendo = (I.opc && I.opc.dividido) ? [0.5, 0.5] : [x / W, y / H];
      } else if (d.tipo === 'deslizador') {
        moverDeslizador(d.b, x);
      } else if (d.tipo === 'lista') {
        if (Math.abs(y - d.y0) > 6 * dpr) { if (!d.movio) { apretado = null; } d.movio = true; }
        if (d.movio) { listaScroll = Math.max(0, Math.min(listaMax, d.s0 - (y - d.y0))); sucio = true; }
      } else if (d.tipo === 'rejilla') {
        var lado = d.b.lado;
        if (Math.abs(y - d.y0) > 6 * dpr) d.movio = true;
        invScroll = Math.max(0, Math.min(d.b.max, d.s0 - Math.round((y - d.y0) / lado)));
        sucio = true;
      }
    });
    function soltar(e) {
      var d = dedos.get(e.pointerId);
      if (!d) return;
      dedos.delete(e.pointerId);
      var p = punto(e), x = p[0], y = p[1];
      if (d.tipo === 'cruceta') { pulsados[d.b] = false; actualizarCruceta(); sucio = true; }
      else if (d.tipo === 'mundo') {
        if (d.rompiendo) I.control.rompiendo = null;
        else if (!d.movio && (e.timeStamp || performance.now()) - d.t0 < 400) I.control.toque = (I.opc && I.opc.dividido) ? [0.5, 0.5] : [x / W, y / H];
      } else if (d.tipo === 'menu') {
        apretado = null; sucio = true;
        if (dentro(d.b, x, y) && I.acciones[d.b.accion]) I.acciones[d.b.accion](d.b);
      } else if (d.tipo === 'rejilla') {
        if (!d.movio && d.item && I.acciones.item) I.acciones.item({ item: d.item });
      } else if (d.tipo === 'lista') {
        apretado = null; sucio = true;
        if (!d.movio && d.b && dentro(d.b, x, y) && I.acciones[d.b.accion]) I.acciones[d.b.accion](d.b);
      } else if (d.tipo === 'deslizador') {
        if (I.acciones.soltarDeslizador) I.acciones.soltarDeslizador(d.b.fila);
      }
    }
    objetivo.addEventListener('pointerup', soltar);
    objetivo.addEventListener('pointercancel', soltar);
    // mantener un dedo quieto sobre el mundo: romper. Se decide en el cuadro (I.revisarToques, desde
    // el bucle del juego) y no con un reloj aparte: el navegador entrega los movimientos del dedo al
    // principio de cada cuadro, así que ahí ya se sabe si se movió
    function mouseAbajo(e) {
      if (e.button === 0) I.control.rompiendo = [0.5, 0.5];
      else if (e.button === 2) I.control.toque = [0.5, 0.5];
    }
    objetivo.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse' && e.button === 0 && document.pointerLockElement) I.control.rompiendo = null; });
    objetivo.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    objetivo.addEventListener('wheel', function (e) {
      if (I.pantalla === 'juego') I.control.rueda += Math.sign(e.deltaY);
      else if (I.pantalla === 'inventario') { invScroll += Math.sign(e.deltaY); sucio = true; }
      else if (conLista()) { listaScroll = Math.max(0, Math.min(listaMax, listaScroll + Math.sign(e.deltaY) * 24 * E)); sucio = true; }
    }, { passive: true });
    addEventListener('keydown', function (e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      teclas[e.code] = true;
      if (I.pantalla === 'juego') {
        if (/^Digit[1-9]$/.test(e.code) && I.acciones.elegir) I.acciones.elegir(+e.code.slice(5) - 1);
        if (e.code === 'KeyE' && I.acciones.inventario) I.acciones.inventario();
        if ((e.code === 'KeyT' || e.code === 'Enter') && I.juego.red && I.acciones.abrirChat) { e.preventDefault(); I.acciones.abrirChat(); }
        if (e.code === 'Space' && I.acciones.saltoDoble && !e.repeat) I.acciones.saltoDoble(e.timeStamp);
        if (e.code === 'F3') { I.juego.mostrarFps = !I.juego.mostrarFps; e.preventDefault(); }
      } else if (I.pantalla === 'inventario' && (e.code === 'KeyE' || e.code === 'Escape')) { if (I.acciones.cerrarInv) I.acciones.cerrarInv(); }
      actualizarCruceta();
    });
    addEventListener('keyup', function (e) { teclas[e.code] = false; actualizarCruceta(); });
    addEventListener('blur', function () { teclas = {}; for (var k in pulsados) pulsados[k] = false; actualizarCruceta(); I.control.rompiendo = null; });
    document.addEventListener('pointerlockchange', function () {
      I.conMouse = !!document.pointerLockElement;
      if (!document.pointerLockElement && I.pantalla === 'juego' && I.acciones.pausa && I.ultimoMouse) I.acciones.pausa();
      I.ultimoMouse = I.conMouse;
      sucio = true;
    });
  }
  // tras un cuadro trabado (más de 150 ms) puede haber un "soltar" esperando: se decide en el siguiente
  // (salvo que el dedo lleve casi un segundo quieto)
  var ultimaRevision = 0;
  I.revisarToques = function () {
    var ahora = performance.now(), hueco = ahora - ultimaRevision;
    ultimaRevision = ahora;
    dedos.forEach(function (d) {
      var quieto = ahora - d.t0;
      if (d.tipo === 'mundo' && !d.movio && !d.rompiendo && ((quieto > 300 && hueco < 150) || quieto > 900)) {
        d.rompiendo = true;
        I.control.rompiendo = (I.opc && I.opc.dividido) ? [0.5, 0.5] : [d.x / W, d.y / H];
      }
    });
  };
  // el dedo que está sobre el mundo (quieto o rompiendo), para el anillo
  I.dedoMundo = function () {
    var r = null;
    dedos.forEach(function (d) { if (!r && d.tipo === 'mundo' && (!d.movio || d.rompiendo)) r = d; });
    return r;
  };
  I.soltarTodo = function () {
    dedos.clear(); for (var k in pulsados) pulsados[k] = false;
    actualizarCruceta(); I.control.rompiendo = null; I.control.toque = null;
  };
  I.E = function () { return E; };
  I.dpr = function () { return dpr; };
  I.tam = function () { return [W, H]; };
  return I;
})();
