// porteo: la interfaz, dibujada en un lienzo 2D encima del 3D con los dibujos del juego (gui.png:
// barra rápida, cruceta, saltar, volar, pausa, "..." del inventario; los botones de newgui; la fuente
// default8.png de Minecraft) y los controles táctiles como los de MCPE 0.16: cruceta abajo a la
// izquierda, arrastrar para mirar, tocar un bloque para poner, mantener para romper. En la
// computadora: mouse (con el puntero bloqueado), WASD, espacio, shift, rueda y 1-9.
var Interfaz = (function () {
  'use strict';
  var I = {};
  var hud, ctx, img = {}, E = 3, W = 0, H = 0, dpr = 1;
  I.pantalla = 'cargando';
  I.botones = [];          // lo tocable de la pantalla actual: {x, y, w, h, accion}
  I.acciones = {};         // los manejadores que pone principal.js
  I.textos = {};
  var sucio = true;
  I.sucio = function () { sucio = true; };

  // ------------------------------------------------------------------------------------------
  // La fuente de Minecraft (default8.png, 16x16 de 8x8, con el orden de caracteres del juego)
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
  I.anchoTexto = function (s, esc) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var k = letra[s[i]];
      w += (k === undefined ? 4 : anchoLetra[k]) + 1;
    }
    return w * (esc || E);
  };
  // el texto con su sombra (un píxel abajo a la derecha, al 25 %), como el juego
  I.texto = function (s, x, y, color, esc, alineado, sinSombra) {
    esc = esc || E;
    var w = I.anchoTexto(s, esc);
    if (alineado === 'centro') x -= w / 2; else if (alineado === 'der') x -= w;
    if (!sinSombra) dibujarTexto(s, x + esc, y + esc, sombraDe(color || '#ffffff'), esc);
    dibujarTexto(s, x, y, color || '#ffffff', esc);
    return w;
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
      if (k === undefined) { x += 4 * esc; continue; }
      if (k !== 32) ctx.drawImage(f, (k & 15) * celda, (k >> 4) * celda, anchoLetra[k], celda, Math.round(x), Math.round(y), anchoLetra[k] * esc, celda * esc);
      x += (anchoLetra[k] + 1) * esc;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Dibujos de gui.png (celdas de 26 en la cruceta, como el juego de bolsillo)
  // ------------------------------------------------------------------------------------------
  var S = {
    barra: [0, 0, 182, 22], elegida: [0, 22, 24, 24], pausa: [200, 64, 18, 18], tres: [227, 247, 29, 9],
    arriba: [0, 107, 26, 26], izq: [26, 107, 26, 26], abajo: [52, 107, 26, 26], der: [78, 107, 26, 26], saltar: [104, 107, 26, 26],
    arribaIzq: [0, 133, 26, 26], arribaDer: [26, 133, 26, 26], volarArriba: [52, 133, 26, 26], volarAbajo: [78, 133, 26, 26], agachar: [104, 133, 26, 26]
  };
  function sprite(nombre, x, y, esc, alfa) {
    var s = S[nombre];
    if (alfa !== undefined) ctx.globalAlpha = alfa;
    ctx.drawImage(img.gui, s[0], s[1], s[2], s[3], Math.round(x), Math.round(y), s[2] * (esc || E), s[3] * (esc || E));
    ctx.globalAlpha = 1;
  }
  // un botón de nueve partes (newgui/buttons/border: 7x7, borde de 2)
  function boton(x, y, w, h, texto, estado, color) {
    var b = estado === 2 ? img.botonApretado : estado === 1 ? img.botonEncima : img.boton, e = E, k = 2;
    var a = b.width;
    // esquinas, bordes y centro
    var sx = [0, k, a - k], sw = [k, a - 2 * k, k], dx = [x, x + k * e, x + w - k * e], dw = [k * e, w - 2 * k * e, k * e];
    var sy = [0, k, a - k], sh = [k, a - 2 * k, k], dy = [y, y + k * e, y + h - k * e], dh = [k * e, h - 2 * k * e, k * e];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) ctx.drawImage(b, sx[i], sy[j], sw[i], sh[j], Math.round(dx[i]), Math.round(dy[j]), Math.ceil(dw[i]), Math.ceil(dh[j]));
    if (texto) I.texto(texto, x + w / 2, y + h / 2 - 4 * E + (estado === 2 ? E : 0), color || (estado === 1 ? '#ffffa0' : '#404040'), E, 'centro', true);
  }

  // ------------------------------------------------------------------------------------------
  // Íconos de los bloques: un cubo isométrico con las tres caras (arriba, izquierda y derecha) de su
  // textura "de mano" (carried_textures) o la del mundo, como en la barra del juego; las plantas y
  // lo que no es un cubo, la textura plana
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
      var ox = (n % cols) * LADO, oy = Math.floor(n / cols) * LADO, b = C.bloques[it.id], f = C.FORMA[it.id];
      // las texturas "de mano" (carried) ya traen su color: ésas no se tiñen
      var tn = b.texMano ? 0 : b.tinte;
      iconosPos[it.id + ':' + it.m] = [ox, oy];
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
      if (it.id === 17 || it.id === 162) { arriba = caraTex(b, 'up', m & 3); lado = caraTex(b, 'side', m & 3); frente = lado; }
      if (!arriba) return;
      var alto = f === C.F.losa ? 0.5 : f === C.F.capa ? 0.125 : f === C.F.alfombra ? 0.0625 : 1;
      var L = LADO - 2, cx = ox + 1, cy = oy + 1 + (1 - alto) * L / 2;
      // arriba: un rombo
      cara(x, arriba, [cx + L / 2, cy, cx + L, cy + L / 4, cx, cy + L / 4], 1, tn === 1 || tn === 2 ? tn : 0, alto, true);
      // izquierda y derecha
      cara(x, frente, [cx, cy + L / 4, cx + L / 2, cy + L / 2, cx, cy + L / 4 + L / 2 * alto], 0.8, tn === 2 ? 2 : 0, alto);
      cara(x, lado, [cx + L / 2, cy + L / 2, cx + L, cy + L / 4, cx + L / 2, cy + L / 2 + L / 2 * alto], 0.6, tn === 2 ? 2 : 0, alto);
    });
    function cara(x, r, p, sombra, tinte, alto, arriba) {
      if (!r) return;
      // la textura (una parte si el bloque es bajo) a un paralelogramo: p = origen, fin del eje u, fin del eje v
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
      x.globalCompositeOperation = 'destination-in';
      x.restore();
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
  I.iniciar = function (lienzoHud, imagenes, textos) {
    hud = lienzoHud; ctx = hud.getContext('2d'); img = imagenes; I.textos = textos || {};
    prepararFuente();
    ajustar();
    addEventListener('resize', function () { ajustar(); sucio = true; });
    entrada();
  };
  function ajustar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(hud.clientWidth * dpr); H = Math.round(hud.clientHeight * dpr);
    hud.width = W; hud.height = H;
    ctx.imageSmoothingEnabled = false;
    // que la barra rápida ocupe cerca de la mitad del ancho en un teléfono acostado
    E = Math.max(2, Math.min(Math.floor(W / 300), Math.floor(H / 150)));
    sucio = true;
  }
  I.t = function (k, d) { return I.textos[k] || d || k; };

  // ------------------------------------------------------------------------------------------
  // HUD del juego
  // ------------------------------------------------------------------------------------------
  I.juego = {
    barra: [], elegido: 0, creativo: true, volando: false, vida: 20, hambre: 20, fps: 0, mostrarFps: false,
    mensaje: '', mensajeHasta: 0, nombreItem: '', nombreHasta: 0, debajoAgua: false
  };
  var pulsados = {};        // botones de la cruceta apretados (por nombre)
  var crucetaBotones = [];
  function dibujarJuego() {
    var j = I.juego, ahora = performance.now();
    // barra rápida, abajo al medio ("Ocultar interfaz de juego" la saca, como el juego)
    var bw = 182 * E, bx = Math.round((W - bw) / 2), by = H - 22 * E - 2, oculta = I.opc && I.opc.ocultarInterfaz;
    if (oculta) ctx.globalAlpha = 0;
    sprite('barra', bx, by);
    for (var i = 0; i < 9; i++) {
      var it = j.barra[i];
      if (it) icono(it.id, it.m, bx + (3 + i * 20) * E, by + 3 * E, 16 * E);
    }
    if (oculta) ctx.globalAlpha = 0;
    sprite('elegida', bx - E + j.elegido * 20 * E, by - E);
    if (oculta) ctx.globalAlpha = 0;
    I.botones.push({ x: bx, y: by, w: bw, h: 22 * E, accion: 'barra', bx: bx });
    // "..." el inventario, a la derecha de la barra
    var tx = bx + bw + 2 * E, tw = 22 * E;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(tx, by, tw, 22 * E);
    sprite('tres', tx + (tw - 29 * E * 0.6) / 2, by + 9 * E, E * 0.6);
    I.botones.push({ x: tx, y: by, w: tw, h: 22 * E, accion: 'inventario' });
    ctx.globalAlpha = 1;
    // pausa, arriba a la derecha
    var pw = 18 * E;
    sprite('pausa', W - pw - 4 * E, 4 * E);
    I.botones.push({ x: W - pw - 6 * E, y: 0, w: pw + 6 * E, h: pw + 8 * E, accion: 'pausa' });
    // los controles táctiles como MCPE 1.0: la cruceta abajo a un costado con agacharse (el botón
    // redondo: se prende y se apaga) en el medio, y saltar aparte, grande, abajo del otro costado;
    // volando, subir y bajar van ahí. "Para zurdos" los da vuelta, "Intercambiar salto y agacharse"
    // cambia esos dos de lugar y "Tamaño de botón" los agranda o achica
    var o = I.opc || {}, c = 26 * E * 0.95 * (o.tamBoton || 1), m = 8 * E;
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
    // vida y hambre (supervivencia)
    if (!j.creativo && img.iconos) {
      for (i = 0; i < 10; i++) {
        var hx = bx + i * 8 * E, hy = by - 10 * E;
        ctx.drawImage(img.iconos, 16, 0, 9, 9, hx, hy, 9 * E, 9 * E);
        if (j.vida > i * 2) ctx.drawImage(img.iconos, j.vida > i * 2 + 1 ? 52 : 61, 0, 9, 9, hx, hy, 9 * E, 9 * E);
        var fx = bx + bw - (i + 1) * 8 * E - E;
        ctx.drawImage(img.iconos, 16, 27, 9, 9, fx, hy, 9 * E, 9 * E);
        if (j.hambre > i * 2) ctx.drawImage(img.iconos, j.hambre > i * 2 + 1 ? 52 : 61, 27, 9, 9, fx, hy, 9 * E, 9 * E);
      }
    }
    // el nombre del bloque elegido
    if (ahora < j.nombreHasta && j.nombreItem) {
      ctx.globalAlpha = Math.min(1, (j.nombreHasta - ahora) / 400);
      I.texto(j.nombreItem, W / 2, by - (j.creativo ? 12 : 22) * E, '#ffffff', E, 'centro');
      ctx.globalAlpha = 1;
    }
    if (ahora < j.mensajeHasta && j.mensaje) I.texto(j.mensaje, W / 2, H * 0.3, '#ffffff', E, 'centro');
    if (j.mostrarFps) I.texto(j.fps + ' fps', 4 * E, 4 * E, '#ffffff', E);
    // la mira: con mouse o con "Controles divididos" (se apunta con el centro, como el juego)
    if (I.conMouse || (I.opc && I.opc.dividido)) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(W / 2 - 5 * E, H / 2 - E / 2, 10 * E, E); ctx.fillRect(W / 2 - E / 2, H / 2 - 5 * E, E, 10 * E);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Pantallas
  // ------------------------------------------------------------------------------------------
  I.mundos = [];
  I.nuevo = { nombre: 'Mi mundo', semilla: '', creativo: true };
  I.opciones = null;
  var invTab = 0, invScroll = 0, invLista = [];
  I.ponerInventario = function (lista) { invLista = lista; };
  I.acciones.tab = function (b) { invTab = b.i; invScroll = 0; sucio = true; };

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = E; ctx.strokeRect(x + E / 2, y + E / 2, w - E, h - E);
  }
  function botonDe(x, y, w, h, texto, accion, extra) {
    var b = { x: x, y: y, w: w, h: h, accion: accion };
    if (extra) for (var k in extra) b[k] = extra[k];
    I.botones.push(b);
    boton(x, y, w, h, texto, apretado === b.accion && apretadoN === I.botones.length - 1 ? 2 : 0);
    return b;
  }
  var apretado = null, apretadoN = -1;

  function dibujarTitulo() {
    var bw = Math.min(W * 0.5, 200 * E), bh = 20 * E, x = (W - bw) / 2, y = Math.max(H * 0.52, H - 2 * bh - 16 * E);
    botonDe(x, y, bw, bh, I.t('menu.play', 'Jugar'), 'jugar');
    botonDe(x, y + bh + 4 * E, bw, bh, I.t('menu.options', 'Opciones'), 'opciones');
    var ty = H * 0.08;
    if (img.icono) {
      var lado = Math.round(Math.min(H * 0.16, 32 * E));
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img.icono, Math.round((W - lado) / 2), Math.round(ty), lado, lado);
      ctx.imageSmoothingEnabled = false;
      ty += lado + 4 * E;
    }
    I.texto('Craftsman PTGI', W / 2, ty, '#ffffff', E * 2, 'centro');
    I.texto('Shaders: Tito Crack 6000', W / 2, ty + 20 * E, '#ffff55', E, 'centro');
  }
  function dibujarMundos() {
    var pw = Math.min(W - 16 * E, 260 * E), px = (W - pw) / 2, py = 8 * E, ph = H - 16 * E;
    panel(px, py, pw, ph);
    I.texto(I.t('selectWorld.title', 'Mundos'), W / 2, py + 6 * E, '#ffffff', E, 'centro');
    var bh = 20 * E, y = py + 20 * E;
    botonDe(px + 6 * E, y, pw - 12 * E, bh, I.t('selectWorld.create', 'Crear un mundo nuevo'), 'crear');
    y += bh + 6 * E;
    for (var i = 0; i < I.mundos.length && y + bh < py + ph - 26 * E; i++) {
      var m = I.mundos[i];
      botonDe(px + 6 * E, y, pw - 40 * E, bh, m.nombre, 'abrir', { i: i });
      botonDe(px + pw - 32 * E, y, 26 * E, bh, 'X', 'borrar', { i: i });
      y += bh + 3 * E;
    }
    botonDe(px + 6 * E, py + ph - 26 * E, 80 * E, bh, I.t('gui.back', 'Volver'), 'titulo');
  }
  // crear un mundo: los campos de la pantalla del juego (createWorldScreen.*)
  function filaCasilla(x, y, w, texto, on, accion) {
    var bh = 20 * E;
    I.botones.push({ x: x, y: y, w: w, h: bh, accion: accion });
    I.texto(texto, x + 2 * E, y + 6 * E, '#ffffff', E);
    casilla(x + w - 18 * E, y + 3 * E, on);
  }
  function casilla(x, y, on) {
    var im = on ? img.casilla1 : img.casilla0;
    if (im) ctx.drawImage(im, Math.round(x), Math.round(y), 16 * E, 13 * E);
    else { ctx.fillStyle = on ? '#e0e0e0' : '#404040'; ctx.fillRect(x, y, 16 * E, 13 * E); }
  }
  function dibujarCrear() {
    var pw = Math.min(W - 16 * E, 260 * E), px = (W - pw) / 2, py = 6 * E, ph = H - 12 * E, bh = 20 * E, n = I.nuevo;
    panel(px, py, pw, ph);
    I.texto(I.t('createWorldScreen.header.local', 'Crear un mundo'), W / 2, py + 5 * E, '#ffffff', E, 'centro');
    var y = py + 18 * E, iz = px + 6 * E, an = pw - 12 * E, mitad = (an - 4 * E) / 2;
    I.texto(I.t('createWorldScreen.levelName', 'Nombre'), iz + 2 * E, y, '#a0a0a0', E);
    I.texto(I.t('createWorldScreen.levelSeed', 'Semilla'), iz + mitad + 6 * E, y, '#a0a0a0', E); y += 9 * E;
    botonDe(iz, y, mitad, bh, n.nombre, 'nombre');
    botonDe(iz + mitad + 4 * E, y, mitad, bh, n.semilla || 'al azar', 'semilla'); y += bh + 5 * E;
    botonDe(iz, y, an, bh, I.t('createWorldScreen.gameMode', 'Modo de juego') + ': ' + I.t('createWorldScreen.gameMode.creative', 'Creativo'), 'modo'); y += bh + 4 * E;
    botonDe(iz, y, an, bh, I.t('createWorldScreen.worldType', 'Tipo de mundo') + ': ' + (n.tipo === 'plano' ? 'Plano' : 'Infinito'), 'tipoMundo'); y += bh + 4 * E;
    filaCasilla(iz, y, an, I.t('createWorldScreen.alwaysDay', 'Siempre de día'), n.siempreDia, 'siempreDia');
    botonDe(iz, py + ph - 24 * E, mitad, bh, I.t('gui.cancel', 'Cancelar'), 'mundos');
    botonDe(iz + mitad + 4 * E, py + ph - 24 * E, mitad, bh, I.t('createWorldScreen.action.local', 'Crear mundo'), 'crearYa');
  }
  // la primera vez: con o sin los shaders de Tito (sobre el menú difuminado)
  function dibujarShaders() {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(W - 16 * E, 300 * E), ph = Math.min(H - 12 * E, 120 * E), px = (W - pw) / 2, py = (H - ph) / 2, bh = 26 * E;
    panel(px, py, pw, ph);
    I.texto('Shaders de Tito Crack 6000', W / 2, py + 8 * E, '#ffff55', E, 'centro');
    I.texto('¿Querés jugar con los shaders?', W / 2, py + 22 * E, '#ffffff', E, 'centro');
    var bw = (pw - 18 * E) / 2, by = py + 38 * E;
    botonDe(px + 6 * E, by, bw, bh, 'Sí, con shaders', 'shadersSi');
    botonDe(px + 12 * E + bw, by, bw, bh, 'No, sin shaders', 'shadersNo');
    I.texto('Agua, cielo y luz de Tito', px + 6 * E + bw / 2, by + bh + 5 * E, '#a0a0a0', E, 'centro');
    I.texto('Más rápido (normal)', px + 12 * E + bw * 1.5, by + bh + 5 * E, '#a0a0a0', E, 'centro');
    I.texto('Se cambia en Opciones > Gráficos', W / 2, py + ph - 12 * E, '#808080', E, 'centro');
  }
  function dibujarPausa() {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    I.texto(I.t('menu.game', 'Menú del juego'), W / 2, H * 0.15, '#ffffff', E, 'centro');
    var bw = Math.min(W * 0.6, 200 * E), bh = 20 * E, x = (W - bw) / 2, y = H * 0.3;
    botonDe(x, y, bw, bh, I.t('menu.returnToGame', 'Volver al juego'), 'seguir'); y += bh + 4 * E;
    botonDe(x, y, bw, bh, I.t('menu.options', 'Opciones'), 'opcionesJuego'); y += bh + 4 * E;
    botonDe(x, y, bw, bh, 'Guardar y salir', 'salir');
  }
  // ------------------------------------------------------------------------------------------
  // Opciones, como las del juego (MCPE 1.0): las secciones Juego, Controles, Gráficos y Sonido a la
  // izquierda y sus casillas y deslizadores a la derecha, con los nombres del juego (options.*). Las
  // filas las arma principal.js en I.ajustes: { nombre, filas: [{ tipo: 'casilla' | 'deslizador' |
  // 'eleccion', k, texto, min, max, paso, valor() / texto del valor }] }
  // ------------------------------------------------------------------------------------------
  I.ajustes = [];
  var ajSeccion = 0, ajScroll = 0;
  I.acciones.seccion = function (b) { ajSeccion = b.i; ajScroll = 0; sucio = true; };
  function dibujarOpciones() {
    ctx.fillStyle = I.enJuego ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
    var bh = 20 * E, top = 4 * E;
    I.texto(I.t('options.title', 'Opciones'), W / 2, top + 6 * E, '#ffffff', E, 'centro');
    botonDe(W - 26 * E, top, 22 * E, 18 * E, 'X', 'listoOpciones');
    var secs = I.ajustes, lw = Math.min(100 * E, Math.floor(W * 0.3)), lx = 6 * E, ly = top + 24 * E;
    if (ajSeccion >= secs.length) ajSeccion = 0;
    for (var i = 0; i < secs.length; i++) {
      var b = { x: lx, y: ly + i * (bh + 3 * E), w: lw, h: bh, accion: 'seccion', i: i };
      I.botones.push(b);
      boton(b.x, b.y, b.w, b.h, secs[i].nombre, i === ajSeccion ? 2 : 0, i === ajSeccion ? '#ffffff' : null);
    }
    var px = lx + lw + 6 * E, pw = W - px - 6 * E, py = ly, ph = H - py - 6 * E, fh = 24 * E;
    panel(px, py, pw, ph);
    var filas = secs[ajSeccion] ? secs[ajSeccion].filas : [], alto = filas.length * fh + 8 * E;
    var maxScroll = Math.max(0, alto - ph);
    ajScroll = Math.max(0, Math.min(ajScroll, maxScroll));
    ctx.save();
    ctx.beginPath(); ctx.rect(px, py + E, pw, ph - 2 * E); ctx.clip();
    for (i = 0; i < filas.length; i++) {
      var f = filas[i], y = py + 4 * E + i * fh - ajScroll;
      if (y + fh < py || y > py + ph) continue;
      var vt = f.textoValor ? f.textoValor() : '';
      if (f.tipo === 'casilla') {
        I.texto(f.texto, px + 8 * E, y + 8 * E, '#ffffff', E);
        casilla(px + pw - 26 * E, y + 5 * E, !!f.valor());
        I.botones.push({ x: px, y: y, w: pw, h: fh, accion: 'ajuste', fila: f, enLista: true });
      } else if (f.tipo === 'deslizador') {
        I.texto(f.texto + ': ' + vt, px + 8 * E, y + 8 * E, '#ffffff', E);
        var x0 = px + Math.round(pw * 0.55), x1 = px + pw - 12 * E, v = (f.valor() - f.min) / (f.max - f.min);
        v = Math.max(0, Math.min(1, v));
        ctx.fillStyle = 'rgb(64,64,64)'; ctx.fillRect(x0, y + 10 * E, x1 - x0, 4 * E);
        ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(x0, y + 10 * E, (x1 - x0) * v, 4 * E);
        // la perilla: el botón de borde del juego (slider_button_layout), 10x16
        var kx = x0 + (x1 - x0) * v - 5 * E;
        boton(kx, y + 4 * E, 10 * E, 16 * E, '', 0);
        I.botones.push({ x: x0 - 6 * E, y: y, w: x1 - x0 + 12 * E, h: fh, accion: 'deslizar', fila: f, x0: x0, x1: x1, enLista: true });
      } else {
        I.texto(f.texto, px + 8 * E, y + 8 * E, '#ffffff', E);
        var ew = Math.min(90 * E, pw * 0.42);
        boton(px + pw - ew - 8 * E, y + 2 * E, ew, bh, vt, 0);
        I.botones.push({ x: px, y: y, w: pw, h: fh, accion: 'ajuste', fila: f, enLista: true });
      }
    }
    ctx.restore();
    // la lista se corre arrastrando (lo tocable de cada fila se resuelve al soltar sin arrastrar)
    I.botones.push({ x: px, y: py, w: pw, h: ph, accion: 'listaAjustes', max: maxScroll, debajo: true });
  }
  function dibujarInventario() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    var pw = Math.min(W - 12 * E, 330 * E), ph = H - 12 * E, px = (W - pw) / 2, py = 6 * E;
    panel(px, py, pw, ph);
    // pestañas
    var tabs = ['Construcción', 'Naturaleza', 'Decoración', 'Varios'], tabIco = [[45, 0], [2, 0], [47, 0], [46, 0]];
    var tw = Math.min(40 * E, (pw - 30 * E) / tabs.length);
    for (var t = 0; t < tabs.length; t++) {
      var b = { x: px + 6 * E + t * tw, y: py + 4 * E, w: tw - 2 * E, h: 18 * E, accion: 'tab', i: t };
      I.botones.push(b);
      boton(b.x, b.y, b.w, b.h, '', t === invTab ? 2 : 0);
      icono(tabIco[t][0], tabIco[t][1], b.x + (b.w - 14 * E) / 2, b.y + 2 * E + (t === invTab ? E : 0), 14 * E);
    }
    I.texto(tabs[invTab], px + 10 * E + tabs.length * tw, py + 10 * E, '#ffffff', E);
    botonDe(px + pw - 22 * E, py + 6 * E, 16 * E, 16 * E, 'X', 'cerrarInv');
    var lista = invLista.filter(function (it) { return it.tab === invTab; });
    var lado = 20 * E, cols = Math.floor((pw - 12 * E) / lado), gx = px + (pw - cols * lado) / 2, gy = py + 26 * E;
    var filasVis = Math.floor((ph - 30 * E - 26 * E) / lado);
    var maxScroll = Math.max(0, Math.ceil(lista.length / cols) - filasVis);
    invScroll = Math.max(0, Math.min(invScroll, maxScroll));
    ctx.save();
    ctx.beginPath(); ctx.rect(px, gy, pw, filasVis * lado); ctx.clip();
    for (var i = 0; i < lista.length; i++) {
      var f = Math.floor(i / cols) - invScroll, c = i % cols;
      if (f < 0 || f >= filasVis) continue;
      var x = gx + c * lado, y = gy + f * lado;
      ctx.fillStyle = 'rgba(139,139,139,0.35)'; ctx.fillRect(x + E, y + E, lado - 2 * E, lado - 2 * E);
      icono(lista[i].id, lista[i].m, x + 2 * E, y + 2 * E, lado - 4 * E);
      I.botones.push({ x: x, y: y, w: lado, h: lado, accion: 'item', item: lista[i] });
    }
    ctx.restore();
    I.botones.push({ x: px, y: gy, w: pw, h: filasVis * lado, accion: 'rejilla', max: maxScroll, lado: lado });
    // la barra rápida del jugador abajo (para ver dónde va lo que se elige)
    var bw = 182 * E, bx = Math.round((W - bw) / 2), by = py + ph - 24 * E;
    sprite('barra', bx, by);
    var j = I.juego;
    for (i = 0; i < 9; i++) if (j.barra[i]) icono(j.barra[i].id, j.barra[i].m, bx + (3 + i * 20) * E, by + 3 * E, 16 * E);
    sprite('elegida', bx - E + j.elegido * 20 * E, by - E);
    I.botones.push({ x: bx, y: by, w: bw, h: 22 * E, accion: 'barra', bx: bx });
  }
  // una pregunta de sí o no (borrar un mundo)
  I.pregunta = null;
  I.preguntar = function (texto, linea2, si) { I.pregunta = { texto: texto, linea2: linea2, si: si, volver: I.pantalla }; I.ir('pregunta'); };
  I.acciones.preguntaSi = function () { var p = I.pregunta; I.ir(p.volver); if (p.si) p.si(); };
  I.acciones.preguntaNo = function () { I.ir(I.pregunta.volver); };
  function dibujarPregunta() {
    var p = I.pregunta, pw = Math.min(W - 16 * E, 260 * E), ph = 90 * E, px = (W - pw) / 2, py = (H - ph) / 2, bh = 20 * E;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    panel(px, py, pw, ph);
    I.texto(p.texto, W / 2, py + 10 * E, '#ffffff', E, 'centro');
    if (p.linea2) I.texto(p.linea2, W / 2, py + 24 * E, '#a0a0a0', E, 'centro');
    var bw = (pw - 18 * E) / 2;
    botonDe(px + 6 * E, py + ph - 26 * E, bw, bh, I.t('gui.yes', 'Sí'), 'preguntaSi');
    botonDe(px + pw / 2 + 3 * E, py + ph - 26 * E, bw, bh, I.t('gui.no', 'No'), 'preguntaNo');
  }
  function dibujarCargando() {
    if (I.cargandoTexto) I.texto(I.cargandoTexto, W / 2, H * 0.7, '#ffffff', E, 'centro');
    if (I.cargandoParte !== undefined) {
      var w = Math.min(W * 0.5, 160 * E), x = (W - w) / 2, y = H * 0.7 + 14 * E;
      ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, 2 * E);
      ctx.fillStyle = '#80ff80'; ctx.fillRect(x, y, w * I.cargandoParte, 2 * E);
    }
  }

  var ultimoFps = -1, ultimoMouse = false, animando = false;
  function hayQueDibujarJuego() {
    var j = I.juego, ahora = performance.now();
    var anima = ahora < j.nombreHasta + 100 || ahora < j.mensajeHasta + 100 || !!j.anillo;
    var r = anima || animando || (j.mostrarFps && j.fps !== ultimoFps) || I.conMouse !== ultimoMouse;
    animando = anima;
    return r;
  }
  I.dibujar = function (forzar) {
    if (!sucio && !forzar && !((I.pantalla === 'juego') && hayQueDibujarJuego())) return;
    sucio = false;
    ultimoFps = I.juego.fps; ultimoMouse = I.conMouse;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    I.botones = [];
    switch (I.pantalla) {
      case 'juego': dibujarJuego(); break;
      case 'titulo': dibujarTitulo(); break;
      case 'mundos': dibujarMundos(); break;
      case 'crear': dibujarCrear(); break;
      case 'pausa': dibujarJuego(); I.botones = []; dibujarPausa(); break;
      case 'opciones': dibujarOpciones(); break;
      case 'inventario': dibujarInventario(); break;
      case 'cargando': dibujarCargando(); break;
      case 'pregunta': dibujarPregunta(); break;
      case 'shaders': dibujarShaders(); break;
    }
  };
  I.ir = function (p) { I.pantalla = p; apretado = null; sucio = true; };

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
  // un deslizador de las opciones: el valor según dónde está el dedo, redondeado al paso
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
        var lista = buscar(x, y, 'listaAjustes');
        if (lista) {
          var fb = buscar(x, y, 'ajuste');
          dedos.set(e.pointerId, { tipo: 'listaAj', y0: y, s0: ajScroll, b: lista, fila: fb && fb.fila, movio: false });
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
      } else if (d.tipo === 'listaAj') {
        if (Math.abs(y - d.y0) > 6 * dpr) d.movio = true;
        if (d.movio) { ajScroll = Math.max(0, Math.min(d.b.max, d.s0 - (y - d.y0))); sucio = true; }
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
      } else if (d.tipo === 'listaAj') {
        if (!d.movio && d.fila && I.acciones.ajuste) { I.acciones.ajuste(d.fila); sucio = true; }
      } else if (d.tipo === 'deslizador') {
        if (I.acciones.soltarDeslizador) I.acciones.soltarDeslizador(d.b.fila);
      }
    }
    objetivo.addEventListener('pointerup', soltar);
    objetivo.addEventListener('pointercancel', soltar);
    // mantener un dedo quieto sobre el mundo: romper. Se decide en el cuadro (I.revisarToques, desde
    // el bucle del juego) y no con un reloj aparte: el navegador entrega los movimientos del dedo al
    // principio de cada cuadro, así que ahí ya se sabe si se movió (con cuadros lentos, un reloj
    // tomaba un arrastre para mirar por un dedo quieto y rompía)
    // mouse con el puntero bloqueado
    function mouseAbajo(e) {
      if (e.button === 0) I.control.rompiendo = [0.5, 0.5];
      else if (e.button === 2) I.control.toque = [0.5, 0.5];
    }
    objetivo.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse' && e.button === 0 && document.pointerLockElement) I.control.rompiendo = null; });
    objetivo.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    objetivo.addEventListener('wheel', function (e) {
      if (I.pantalla === 'juego') I.control.rueda += Math.sign(e.deltaY);
      else if (I.pantalla === 'inventario') { invScroll += Math.sign(e.deltaY); sucio = true; }
      else if (I.pantalla === 'opciones') { ajScroll += Math.sign(e.deltaY) * 24 * E; sucio = true; }
    }, { passive: true });
    addEventListener('keydown', function (e) {
      teclas[e.code] = true;
      if (I.pantalla === 'juego') {
        if (/^Digit[1-9]$/.test(e.code) && I.acciones.elegir) I.acciones.elegir(+e.code.slice(5) - 1);
        if (e.code === 'KeyE' && I.acciones.inventario) I.acciones.inventario();
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
  return I;
})();
