// porteo: los modelos de los bichos y de los jugadores, de models/mobs.json de la 1.2 (huesos con
// cajas y su lugar en la textura, como los de Minecraft) y las poses que el juego les da en su código
// (setupAnim: el cuerpo acostado de los cuadrúpedos, las patas al caminar, la cabeza que mira, los
// brazos del zombi). Cada cuadro se escriben los vértices de todos, ya ubicados en el mundo
// (relativos a la cámara) y con la luz del lugar: render.js los dibuja de a una llamada por textura.
var Modelos = (function () {
  'use strict';
  var Mo = {};
  var modelos = {};       // nombre → [capa]: { tex, huesos: [{ n, p, caras: Float32Array }] }
  var PI = Math.PI;

  // las seis caras de una caja con el reparto de la textura de Minecraft ("box UV": arriba y abajo
  // en la primera fila; derecha, frente, izquierda y atrás en la segunda). Las esquinas y la
  // asignación de uv son las de ModelBox de la versión de PC (pasadas a y para arriba)
  function caja(c, espejo, sal) {
    var u = c.uv[0], v = c.uv[1], w = c.t[0], h = c.t[1], d = c.t[2], f = c.i || 0;
    var x0 = c.o[0] - f, x1 = c.o[0] + w + f, abajo = c.o[1] - f, arriba = c.o[1] + h + f, z0 = c.o[2] - f, z1 = c.o[2] + d + f;
    if (espejo) { var tx = x0; x0 = x1; x1 = tx; }
    var v7 = [x0, arriba, z0], v0 = [x1, arriba, z0], v1 = [x1, abajo, z0], v2 = [x0, abajo, z0];
    var v3 = [x0, arriba, z1], v4 = [x1, arriba, z1], v5 = [x1, abajo, z1], v6 = [x0, abajo, z1];
    var quads = [
      [[v4, v0, v1, v5], u + d + w, v + d, u + d + w + d, v + d + h, [1, 0, 0]],
      [[v7, v3, v6, v2], u, v + d, u + d, v + d + h, [-1, 0, 0]],
      [[v4, v3, v7, v0], u + d, v, u + d + w, v + d, [0, 1, 0]],
      [[v1, v2, v6, v5], u + d + w, v + d, u + d + w + w, v, [0, -1, 0]],
      [[v0, v7, v2, v1], u + d, v + d, u + d + w, v + d + h, [0, 0, -1]],
      [[v3, v4, v5, v6], u + d + w + d, v + d, u + d + w + d + w, v + d + h, [0, 0, 1]]
    ];
    for (var q = 0; q < 6; q++) {
      var p = quads[q][0], u1 = quads[q][1], v1_ = quads[q][2], u2 = quads[q][3], v2_ = quads[q][4], n = quads[q][5];
      // TexturedQuad: esquina 0 → (u2, v1), 1 → (u1, v1), 2 → (u1, v2), 3 → (u2, v2)
      var uv = [[u2, v1_], [u1, v1_], [u1, v2_], [u2, v2_]];
      if (espejo) { p = [p[3], p[2], p[1], p[0]]; uv = [uv[3], uv[2], uv[1], uv[0]]; }
      var orden = [0, 1, 2, 0, 2, 3];
      for (var k = 0; k < 6; k++) {
        var e = orden[k];
        sal.push(p[e][0], p[e][1], p[e][2], uv[e][0], uv[e][1], n[0], n[1], n[2]);
      }
    }
  }

  Mo.preparar = function (bichos) {
    for (var nombre in bichos) {
      modelos[nombre] = bichos[nombre].map(function (capa) {
        return {
          tex: capa.tex, tw: capa.tw, th: capa.th,
          huesos: capa.huesos.map(function (h) {
            var sal = [];
            h.c.forEach(function (c) { caja(c, !!h.m, sal); });
            // las uv en 0..1 de la textura
            for (var i = 0; i < sal.length; i += 8) { sal[i + 3] /= capa.tw; sal[i + 4] /= capa.th; }
            return { n: h.n, p: h.p, caras: new Float32Array(sal) };
          })
        };
      });
    }
  };
  Mo.existe = function (nombre) { return !!modelos[nombre]; };

  // ------------------------------------------------------------------------------------------
  // Poses (los ángulos como en los modelos de la versión de PC, en radianes; al armar la matriz se
  // pasan a "y para arriba": x y z cambian de signo). e: { tipo, paso, amplitud, cabezaYaw,
  // cabezaPitch, tiempo, ... }
  // ------------------------------------------------------------------------------------------
  function patas(pose, e, nombres, fase) {
    var s = e.paso * 0.6662, a = Math.min(1, e.amplitud);
    for (var i = 0; i < nombres.length; i++) pose[nombres[i]] = [Math.cos(s + fase[i]) * 1.4 * a, 0, 0];
  }
  var ANIMAR = {
    cuadrupedo: function (pose, e) {
      pose.body = [PI / 2, 0, 0];
      pose.head = [e.cabezaPitch, e.cabezaYaw, 0];
      patas(pose, e, ['leg0', 'leg1', 'leg2', 'leg3'], [0, PI, PI, 0]);
    },
    gallina: function (pose, e) {
      pose.head = pose.beak = pose.comb = [e.cabezaPitch, e.cabezaYaw, 0];
      pose.body = [PI / 2, 0, 0];
      patas(pose, e, ['leg0', 'leg1'], [0, PI]);
      // las alas aletean cuando cae
      var ala = e.cayendo ? Math.sin(e.tiempo * 1.5) * 0.9 + 0.9 : 0;
      pose.wing0 = [0, 0, ala]; pose.wing1 = [0, 0, -ala];
    },
    humanoide: function (pose, e) {
      pose.head = pose.hat = [e.cabezaPitch, e.cabezaYaw, 0];
      var s = e.paso * 0.6662, a = Math.min(1, e.amplitud);
      pose.rightLeg = pose.rightPants = [Math.cos(s) * 1.4 * a, 0, 0];
      pose.leftLeg = pose.leftPants = [Math.cos(s + PI) * 1.4 * a, 0, 0];
      if (e.brazosAdelante) {
        // los zombis y los esqueletos: los brazos estirados hacia adelante (con un balanceo)
        var b = Math.sin(e.tiempo * 0.067) * 0.05;
        pose.rightArm = pose.rightSleeve = [-PI / 2 + b, -0.1, 0];
        pose.leftArm = pose.leftSleeve = [-PI / 2 - b, 0.1, 0];
      } else {
        var golpe = e.golpe || 0, g = Math.sin(Math.sqrt(golpe) * PI);
        pose.rightArm = pose.rightSleeve = [Math.cos(s + PI) * a - g * 1.2, 0, 0];
        pose.leftArm = pose.leftSleeve = [Math.cos(s) * a, 0, 0];
      }
      pose.body = pose.jacket = [0, 0, 0];
      if (e.agachado) { pose.body = pose.jacket = [0.5, 0, 0]; }
    },
    creeper: function (pose, e) {
      pose.head = [e.cabezaPitch, e.cabezaYaw, 0];
      patas(pose, e, ['leg0', 'leg1', 'leg2', 'leg3'], [0, PI, PI, 0]);
    },
    arana: function (pose, e) {
      pose.head = [e.cabezaPitch, e.cabezaYaw, 0];
      // las ocho patas abiertas (ModelSpider) y su vaivén al caminar
      var z = [-PI / 4, PI / 4, -0.58119464, 0.58119464, -0.58119464, 0.58119464, -PI / 4, PI / 4];
      var y = [PI / 4, -PI / 4, PI / 8, -PI / 8, -PI / 8, PI / 8, -PI / 4, PI / 4];
      var s = e.paso * 0.6662 * 2, a = Math.min(1, e.amplitud);
      var fy = [0, PI, PI / 2, PI * 1.5], fz = [0, PI, PI / 2, PI * 1.5];
      for (var i = 0; i < 8; i++) {
        var par = i >> 1, sg = i & 1 ? -1 : 1;
        var dy = -(Math.cos(s + fy[par]) * 0.4) * a, dz = Math.abs(Math.sin(s / 2 + fz[par]) * 0.4) * a;
        pose['leg' + i] = [0, y[i] + sg * dy, z[i] + sg * dz];
      }
    }
  };
  var TIPO = { pig: 'cuadrupedo', cow: 'cuadrupedo', sheep: 'cuadrupedo', chicken: 'gallina', zombie: 'humanoide',
    skeleton: 'humanoide', steve: 'humanoide', alex: 'humanoide', creeper: 'creeper', spider: 'arana' };

  // la matriz de un hueso (3x4): girar alrededor del pivote. Orden de la versión de PC: z, y, x
  function matriz(r, p, m) {
    var ax = -r[0], ay = r[1], az = -r[2];
    var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    // R = Rz * Ry * Rx
    var a00 = cz * cy, a01 = cz * sy * sx - sz * cx, a02 = cz * sy * cx + sz * sx;
    var a10 = sz * cy, a11 = sz * sy * sx + cz * cx, a12 = sz * sy * cx - cz * sx;
    var a20 = -sy, a21 = cy * sx, a22 = cy * cx;
    m[0] = a00; m[1] = a01; m[2] = a02; m[3] = p[0] - (a00 * p[0] + a01 * p[1] + a02 * p[2]);
    m[4] = a10; m[5] = a11; m[6] = a12; m[7] = p[1] - (a10 * p[0] + a11 * p[1] + a12 * p[2]);
    m[8] = a20; m[9] = a21; m[10] = a22; m[11] = p[2] - (a20 * p[0] + a21 * p[1] + a22 * p[2]);
  }

  // e: { modelo, x, y, z, yaw (como el del jugador: 0 mira al norte), luz, dano (0..1), escala }
  Mo.capas = function (e) { return modelos[e.modelo] || []; };
  Mo.vertices = function (e) {
    var l = modelos[e.modelo], n = 0;
    if (!l) return 0;
    for (var i = 0; i < l.length; i++) for (var j = 0; j < l[i].huesos.length; j++) n += l[i].huesos[j].caras.length / 8;
    return n;
  };
  var pose = {}, m = new Float32Array(12), CERO = [0, 0, 0];
  // escribe los vértices de una capa de e en d desde o (en floats); devuelve el o nuevo
  Mo.escribir = function (d, o, e, capa, cam, colorLuz) {
    for (var k in pose) delete pose[k];
    var an = ANIMAR[TIPO[e.modelo] || 'cuadrupedo'];
    if (an) an(pose, e);
    var luz = colorLuz(e.luz === undefined ? 0xF0 : e.luz), alfa = 1 - Math.min(1, e.dano || 0);
    var tinte = e.quema ? [1.25, 0.7, 0.35] : e.tinte || null;
    // muriendo: el cuerpo cae de costado (como el "deathTime" del juego)
    var muere = e.muerte > 0, rc = 1, rs = 0;
    if (muere) { var ang = Math.min(1, e.muerte * 1.6) * PI / 2; rc = Math.cos(ang); rs = Math.sin(ang); }
    var cyw = Math.cos(e.yaw), syw = Math.sin(e.yaw), esc = (e.escala || 1) / 16;
    var bx = e.x - cam.x, by = e.y - cam.y, bz = e.z - cam.z;
    for (var j = 0; j < capa.huesos.length; j++) {
      var h = capa.huesos[j], r = pose[h.n] || CERO, f = h.caras;
      matriz(r, h.p, m);
      for (var i = 0; i < f.length; i += 8) {
        var x = f[i], y = f[i + 1], z = f[i + 2];
        var px = m[0] * x + m[1] * y + m[2] * z + m[3], py = m[4] * x + m[5] * y + m[6] * z + m[7], pz = m[8] * x + m[9] * y + m[10] * z + m[11];
        if (muere) { var qx = px * rc - py * rs; py = px * rs + py * rc; px = qx; }
        // del modelo al mundo: dado vuelta en x (como el de PC) y girado según hacia dónde mira
        var wx = -(px * cyw + pz * syw), wz = -px * syw + pz * cyw;
        d[o++] = bx + wx * esc; d[o++] = by + py * esc; d[o++] = bz + wz * esc; d[o++] = 1;
        // la luz de la cara según hacia dónde da (arriba clara, abajo oscura, como el juego)
        var nx = f[i + 5], ny = f[i + 6], nz = f[i + 7];
        var gy = m[4] * nx + m[5] * ny + m[6] * nz, gx = m[0] * nx + m[1] * ny + m[2] * nz;
        var sombra = 0.75 + 0.25 * gy - 0.08 * Math.abs(gx);
        var cr = luz[0] * sombra, cg = luz[1] * sombra, cb = luz[2] * sombra;
        if (tinte) { cr *= tinte[0]; cg *= tinte[1]; cb *= tinte[2]; }
        d[o++] = cr; d[o++] = cg; d[o++] = cb; d[o++] = alfa;
        d[o++] = f[i + 3]; d[o++] = f[i + 4];
      }
    }
    return o;
  };
  return Mo;
})();
