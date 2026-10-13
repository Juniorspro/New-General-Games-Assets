// porteo: el muñeco de papel de la 1.2 ("paper_doll_renderer": el jugador con su skin en el título,
// la pausa y el elegidor de skins). La interfaz se dibuja en el canvas 2D de arriba, así que el
// muñeco también: con una cámara ortográfica cada cara de cada caja del modelo (los huesos de
// geometry.humanoid.custom de models/mobs.json) es un paralelogramo, y la textura de la skin se le
// pega con una transformación afín (drawImage sin suavizar, píxeles como en el juego).
var Muneco = (function () {
  'use strict';
  var M = {};
  var modelos = {};     // nombre → { img, tw, th, huesos: [{ n, p, cajas: [{ centro, inflado, quads }] }] }
  var sombras = {};     // imagen → { nivel: canvas con la skin oscurecida }
  var NIVELES = [0.5, 0.58, 0.67, 0.75, 0.83, 0.92, 1];

  // las seis caras de una caja con el reparto "box UV" de Minecraft (como modelos.js), como
  // cuadriláteros con su rectángulo de textura: la esquina 1 va a (u1, v1), la 0 a (u2, v1) y la 2 a
  // (u1, v2). En espejo (las extremidades izquierdas de algunos modelos) se cambian x0 y x1, que da
  // vuelta la textura en la cara como en el juego
  function caja(c, espejo) {
    var u = c.uv[0], v = c.uv[1], w = c.t[0], h = c.t[1], d = c.t[2], f = c.i || 0;
    var x0 = c.o[0] - f, x1 = c.o[0] + w + f, abajo = c.o[1] - f, arriba = c.o[1] + h + f, z0 = c.o[2] - f, z1 = c.o[2] + d + f;
    var centro = [(x0 + x1) / 2, (abajo + arriba) / 2, (z0 + z1) / 2];
    if (espejo) { var tx = x0; x0 = x1; x1 = tx; }
    var v7 = [x0, arriba, z0], v0 = [x1, arriba, z0], v1 = [x1, abajo, z0], v2 = [x0, abajo, z0];
    var v3 = [x0, arriba, z1], v4 = [x1, arriba, z1], v5 = [x1, abajo, z1], v6 = [x0, abajo, z1];
    var l = [
      [[v4, v0, v1, v5], u + d + w, v + d, u + d + w + d, v + d + h],
      [[v7, v3, v6, v2], u, v + d, u + d, v + d + h],
      [[v4, v3, v7, v0], u + d, v, u + d + w, v + d],
      [[v1, v2, v6, v5], u + d + w, v + d, u + d + w + w, v],
      [[v0, v7, v2, v1], u + d, v + d, u + d + w, v + d + h],
      [[v3, v4, v5, v6], u + d + w + d, v + d, u + d + w + d + w, v + d + h]
    ];
    // TexturedQuad: esquina 0 → (ub, va), 1 → (ua, va), 2 → (ua, vb), 3 → (ub, vb)
    var quads = l.map(function (q) { return { p: q[0], u1: q[1], v1: q[2], u2: q[3], v2: q[4] }; });
    return { centro: centro, inflado: f > 0, quads: quads };
  }

  M.preparar = function (bichos, imagenes) {
    ['steve', 'alex'].forEach(function (nombre) {
      var capas = bichos[nombre];
      if (!capas || !capas.length) return;
      var capa = capas[0], img = imagenes[capa.tex];
      if (!img) return;
      modelos[nombre] = {
        img: img, tw: capa.tw, th: capa.th,
        huesos: capa.huesos.map(function (h) {
          return { n: h.n, p: h.p, cajas: h.c.map(function (c) { return caja(c, !!h.m); }) };
        })
      };
    });
  };
  M.existe = function (nombre) { return !!modelos[nombre]; };

  // la skin oscurecida (multiplicada, sin tocar la transparencia de la capa de afuera): las caras se
  // sombrean como en el juego (arriba clara, abajo oscura, los costados en el medio)
  function sombreada(img, nivel) {
    var s = sombras[img.src] || (sombras[img.src] = {});
    if (s[nivel]) return s[nivel];
    var cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    var c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    if (nivel < 1) {
      c.globalCompositeOperation = 'multiply';
      var g = Math.round(255 * nivel);
      c.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
      c.fillRect(0, 0, cv.width, cv.height);
      // multiply pinta también lo transparente: se recorta con la forma original
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(img, 0, 0);
    }
    s[nivel] = cv;
    return cv;
  }

  // la matriz de un hueso como en modelos.js (girar alrededor del pivote; orden z, y, x de la versión
  // de PC con x y z al revés porque acá y va para arriba)
  function matriz(r, p) {
    var ax = -r[0], ay = r[1], az = -r[2];
    var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    var a00 = cz * cy, a01 = cz * sy * sx - sz * cx, a02 = cz * sy * cx + sz * sx;
    var a10 = sz * cy, a11 = sz * sy * sx + cz * cx, a12 = sz * sy * cx - cz * sx;
    var a20 = -sy, a21 = cy * sx, a22 = cy * cx;
    return [a00, a01, a02, p[0] - (a00 * p[0] + a01 * p[1] + a02 * p[2]),
      a10, a11, a12, p[1] - (a10 * p[0] + a11 * p[1] + a12 * p[2]),
      a20, a21, a22, p[2] - (a20 * p[0] + a21 * p[1] + a22 * p[2])];
  }

  // la pose quieta de ModelBiped: los brazos se balancean apenas (t en ticks); la cabeza mira hacia
  // donde está el dedo si se le pasa ([x, y] en -1..1)
  function pose(t, mirar) {
    var z = Math.cos(t * 0.09) * 0.05 + 0.05, x = Math.sin(t * 0.067) * 0.05;
    var p = {};
    p.rightArm = p.rightSleeve = [x, 0, z];
    p.leftArm = p.leftSleeve = [-x, 0, -z];
    if (mirar) p.head = p.hat = [mirar[1] * 0.5, mirar[0] * 0.7, 0];
    return p;
  }

  // dibuja al jugador parado en el rectángulo (px de pantalla), girado yaw (0 = de frente)
  M.dibujar = function (ctx, nombre, x, y, w, h, yaw, t, mirar) {
    var mo = modelos[nombre] || modelos.steve;
    if (!mo) return;
    var P = pose(t, mirar), cy = Math.cos(yaw), sy = Math.sin(yaw);
    // 32 unidades de alto (de los pies a la coronilla) + un poco de aire
    var k = Math.min(h / 34, w / 20), ox = x + w / 2, oy = y + h - (h - 32 * k) / 2;
    var su = mo.img.width / mo.tw, sv = mo.img.height / mo.th;
    // del modelo a la vista: como modelos.js (dado vuelta en x y girado), con la cámara del lado de
    // -z mirando hacia +z: a la derecha de la pantalla queda +x del modelo
    function ver(m, a) {
      var px = m[0] * a[0] + m[1] * a[1] + m[2] * a[2] + m[3], py = m[4] * a[0] + m[5] * a[1] + m[6] * a[2] + m[7], pz = m[8] * a[0] + m[9] * a[1] + m[10] * a[2] + m[11];
      return [px * cy + pz * sy, py, -px * sy + pz * cy];
    }
    var cajas = [];
    for (var j = 0; j < mo.huesos.length; j++) {
      var hu = mo.huesos[j], m = matriz(P[hu.n] || [0, 0, 0], hu.p);
      for (var b = 0; b < hu.cajas.length; b++) {
        var cj = hu.cajas[b], B = ver(m, cj.centro), caras = [];
        for (var q = 0; q < 6; q++) {
          var Q = cj.quads[q], s = [], F = [0, 0, 0];
          for (var e = 0; e < 4; e++) {
            var V = ver(m, Q.p[e]);
            F[0] += V[0] / 4; F[1] += V[1] / 4; F[2] += V[2] / 4;
            s.push([ox + V[0] * k, oy - V[1] * k]);
          }
          // hacia afuera de la caja: del centro de la caja al de la cara; sólo las que miran a la cámara
          var nx = F[0] - B[0], ny = F[1] - B[1], nz = F[2] - B[2], ln = Math.hypot(nx, ny, nz) || 1;
          if (nz / ln > -1e-3) continue;
          caras.push({ s: s, Q: Q, luz: 0.75 + 0.25 * ny / ln - 0.08 * Math.abs(nx / ln) });
        }
        // la capa de afuera (sombrero, campera, mangas: "inflate") va encima de la de adentro
        if (caras.length) cajas.push({ prof: B[2] - (cj.inflado ? 0.01 : 0), caras: caras });
      }
    }
    cajas.sort(function (a, b2) { return b2.prof - a.prof; });
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (var i = 0; i < cajas.length; i++) {
      for (var f = 0; f < cajas[i].caras.length; f++) {
        var c = cajas[i].caras[f], Qc = c.Q, sc = c.s;
        var du = (Qc.u2 - Qc.u1) * su, dv = (Qc.v2 - Qc.v1) * sv;
        if (!du || !dv) continue;
        // de la textura a la pantalla: (u1, v1) → esquina 1; hacia u2 → esquina 0; hacia v2 → esquina 2
        var e0x = sc[0][0] - sc[1][0], e0y = sc[0][1] - sc[1][1], e1x = sc[2][0] - sc[1][0], e1y = sc[2][1] - sc[1][1];
        var ux = Math.min(Qc.u1, Qc.u2) * su, vy = Math.min(Qc.v1, Qc.v2) * sv, aw = Math.abs(du), ah = Math.abs(dv);
        var fu = (ux - Qc.u1 * su) / du, fv = (vy - Qc.v1 * sv) / dv;
        ctx.setTransform(e0x / du, e0y / du, e1x / dv, e1y / dv, sc[1][0] + fu * e0x + fv * e1x, sc[1][1] + fu * e0y + fv * e1y);
        // un poquito más grande que la cara: sin esto quedan rayitas del fondo entre caras vecinas
        var px = Math.max(Math.hypot(e0x, e0y) / aw, Math.hypot(e1x, e1y) / ah) || 1, eps = 0.45 / px;
        var nivel = NIVELES[0];
        for (var n = 1; n < NIVELES.length; n++) if (Math.abs(NIVELES[n] - c.luz) < Math.abs(nivel - c.luz)) nivel = NIVELES[n];
        ctx.drawImage(sombreada(mo.img, nivel), ux, vy, aw, ah, -eps, -eps, aw + 2 * eps, ah + 2 * eps);
      }
    }
    ctx.restore();
  };
  return M;
})();
