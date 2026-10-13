// porteo: los modelos de los bichos y de los jugadores, de models/mobs.json de la 1.2 (huesos con
// cajas y su lugar en la textura, como los de Minecraft) y las poses que el juego les da en su código
// (setupAnim de cada modelo: las patas al caminar, la cabeza que mira, los brazos del zombi, las alas
// del murciélago, los tentáculos del calamar y del ghast, las varas del blaze, el slime que se
// aplasta, la tapa del shulker...). Cada cuadro se escriben los vértices de todos, ya ubicados en el
// mundo (relativos a la cámara) y con la luz del lugar: render.js los dibuja de a una llamada por
// textura.
//
// Las rotaciones van como en los modelos de la versión de PC (radianes, y para abajo); las de los
// huesos en mobs.json están en esa misma convención (en grados) y la pose se les suma. Una pose
// puede traer también un corrimiento del hueso [rx, ry, rz, dx, dy, dz] (en píxeles del modelo, y
// para arriba).
var Modelos = (function () {
  'use strict';
  var Mo = {};
  var modelos = {};       // nombre → [capa]: { tex, huesos: [{ n, p, rr, caras: Float32Array }], ...opciones }
  var variantes = {};     // bicho → [textura de cada variante]
  var PI = Math.PI, GR = PI / 180;

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

  Mo.preparar = function (bichos, vars) {
    for (var nombre in bichos) {
      modelos[nombre] = bichos[nombre].map(function (capa) {
        var c = {};
        for (var k in capa) if (k !== 'huesos') c[k] = capa[k];
        c.huesos = capa.huesos.map(function (h) {
          var sal = [];
          h.c.forEach(function (cu) { caja(cu, !!h.m, sal); });
          // las uv en 0..1 de la textura
          for (var i = 0; i < sal.length; i += 8) { sal[i + 3] /= capa.tw; sal[i + 4] /= capa.th; }
          return { n: h.n, p: h.p, rr: h.r ? [h.r[0] * GR, h.r[1] * GR, h.r[2] * GR] : null, caras: new Float32Array(sal) };
        });
        return c;
      });
    }
    variantes = vars || {};
  };
  Mo.existe = function (nombre) { return !!modelos[nombre]; };
  Mo.variantes = function (nombre) { return variantes[nombre] || null; };

  // ------------------------------------------------------------------------------------------
  // Poses. e: { modelo, paso (limbSwing), amplitud (limbSwingAmount), cabezaYaw, cabezaPitch (rad),
  // tiempo (ageInTicks), golpe (0..1 del ataque), atacando, apuntando, sentado, cargando, vuela,
  // salto (0..1), aplastado (slime), peek (shulker), ... }
  // ------------------------------------------------------------------------------------------
  var cos = Math.cos, sin = Math.sin, abs = Math.abs;
  function patas(pose, e, nombres, fase, k) {
    var s = e.paso * 0.6662, a = Math.min(1, e.amplitud);
    for (var i = 0; i < nombres.length; i++) pose[nombres[i]] = [cos(s + fase[i]) * (k || 1.4) * a, 0, 0];
  }
  function cabeza(pose, e, nombres) {
    for (var i = 0; i < nombres.length; i++) pose[nombres[i]] = [e.cabezaPitch, e.cabezaYaw, 0];
  }
  function onda(x, periodo) { return (abs(x % periodo - periodo * 0.5) - periodo * 0.25) / (periodo * 0.25); }
  // ModelBiped: brazos y piernas al caminar, el vaivén quieto de los brazos y el golpe
  function bipedo(pose, e, nombres) {
    var n = nombres || BIPEDO;
    var s = e.paso * 0.6662, a = Math.min(1, e.amplitud), t = e.tiempo || 0;
    cabeza(pose, e, [n.cabeza, n.sombrero]);
    var ra = [cos(s + PI) * a, 0, cos(t * 0.09) * 0.05 + 0.05], la = [cos(s) * a, 0, -(cos(t * 0.09) * 0.05 + 0.05)];
    ra[0] += sin(t * 0.067) * 0.05; la[0] -= sin(t * 0.067) * 0.05;
    var g = e.golpe || 0;
    if (g > 0) {
      var f = sin(Math.sqrt(g) * PI);
      ra[0] -= f * 1.2; ra[1] = sin(Math.sqrt(g) * PI * 2) * 0.2;
    }
    pose[n.brazoD] = ra; pose[n.brazoI] = la;
    pose[n.piernaD] = [cos(s) * 1.4 * a, 0, 0];
    pose[n.piernaI] = [cos(s + PI) * 1.4 * a, 0, 0];
    if (e.agachado) { pose[n.cuerpo] = [0.5, 0, 0]; }
    // las capas de afuera de los jugadores siguen a lo de adentro
    pose.rightSleeve = pose[n.brazoD]; pose.leftSleeve = pose[n.brazoI];
    pose.rightPants = pose[n.piernaD]; pose.leftPants = pose[n.piernaI]; pose.jacket = pose[n.cuerpo];
  }
  var BIPEDO = { cabeza: 'head', sombrero: 'hat', cuerpo: 'body', brazoD: 'rightArm', brazoI: 'leftArm', piernaD: 'rightLeg', piernaI: 'leftLeg' };
  // ModelZombie: los brazos adelante (más arriba cuando ataca)
  function brazosZombi(pose, e, n) {
    n = n || BIPEDO;
    var g = e.golpe || 0, f = sin(g * PI), f1 = sin((1 - (1 - g) * (1 - g)) * PI), t = e.tiempo || 0;
    var alto = -PI / (e.atacando ? 1.5 : 2.25);
    var d = [alto + f * 1.2 - f1 * 0.4, -(0.1 - f * 0.6), cos(t * 0.09) * 0.05 + 0.05];
    var i = [alto + f * 1.2 - f1 * 0.4, 0.1 - f * 0.6, -(cos(t * 0.09) * 0.05 + 0.05)];
    d[0] += sin(t * 0.067) * 0.05; i[0] -= sin(t * 0.067) * 0.05;
    pose[n.brazoD] = d; pose[n.brazoI] = i;
  }
  // ModelVillager / ModelIllager: brazos cruzados, piernas a medio paso
  function aldeano(pose, e, conBrazos) {
    cabeza(pose, e, ['head', 'nose', 'hat', 'hat2', 'hat3', 'hat4']);
    var s = e.paso * 0.6662, a = Math.min(1, e.amplitud);
    pose.arms = [-0.75, 0, 0];
    pose.leg0 = [cos(s) * 1.4 * a * 0.5, 0, 0];
    pose.leg1 = [cos(s + PI) * 1.4 * a * 0.5, 0, 0];
    if (conBrazos) {
      // los illagers: atacando, los brazos sueltos levantados; si no, cruzados
      var t = e.tiempo || 0;
      if (e.hechizo) {
        pose.rightarm = [cos(t * 0.6662) * 0.25 - PI * 0.6, 0, PI * 0.75];
        pose.leftarm = [cos(t * 0.6662) * 0.25 - PI * 0.6, 0, -PI * 0.75];
      } else if (e.atacando) {
        var g = e.golpe || 0, f = sin(g * PI);
        pose.rightarm = [-PI / 2.25 + f * 1.2, 0.15, 0];
        pose.leftarm = [-PI / 2.25 - f * 0.4, -0.15, 0];
      }
    }
  }
  var A = {
    humanoide: function (pose, e) { bipedo(pose, e); if (e.brazosAdelante) brazosZombi(pose, e); },
    zombi: function (pose, e) { bipedo(pose, e); brazosZombi(pose, e); },
    esqueleto: function (pose, e) {
      bipedo(pose, e);
      if (e.apuntando) {
        // ModelSkeleton con el arco: los dos brazos hacia adelante, mirando como la cabeza
        pose.rightArm = [-PI / 2 + e.cabezaPitch, -0.1 + e.cabezaYaw, 0];
        pose.leftArm = [-PI / 2 + e.cabezaPitch, 0.1 + e.cabezaYaw + 0.4, 0];
      }
    },
    enderman: function (pose, e) {
      bipedo(pose, e);
      // ModelEnderman: los pasos cortos (el doble de largo de pierna) y los brazos adelante si lleva un bloque
      ['rightArm', 'leftArm', 'rightLeg', 'leftLeg'].forEach(function (k) {
        var r = pose[k];
        r[0] = Math.max(-0.4, Math.min(0.4, r[0] * 0.5));
      });
      if (e.cargando) { pose.rightArm = [-0.5, 0, 0.05]; pose.leftArm = [-0.5, 0, -0.05]; }
      if (e.atacando) pose.head = [e.cabezaPitch, e.cabezaYaw, 0, 0, 5, 0];
    },
    vex: function (pose, e) {
      bipedo(pose, e, { cabeza: 'head', sombrero: 'hat', cuerpo: 'body', brazoD: 'rightarm', brazoI: 'leftarm', piernaD: 'leg0', piernaI: 'leg0' });
      pose.leg0 = [PI / 5, 0, 0];
      var t = e.tiempo || 0;
      pose.leftwing = [0.47, 0.47 + cos(t * 0.8) * PI * 0.05, -0.47];
      pose.rightwing = [0.47, -(0.47 + cos(t * 0.8) * PI * 0.05), 0.47];
      if (e.atacando) { pose.rightarm = [-PI * 0.75, 0, 0]; }
    },
    aldeano: function (pose, e) { aldeano(pose, e, false); },
    bruja: function (pose, e) {
      aldeano(pose, e, false);
      // la nariz que se mueve (ModelWitch)
      var t = e.tiempo || 0;
      pose.nose = [e.cabezaPitch, e.cabezaYaw, 0, sin(t * 0.13) * 0.4 * (e.bebe ? 1 : 0.2), 0, 0];
    },
    illager: function (pose, e) { aldeano(pose, e, true); },
    golem: function (pose, e) {
      // ModelIronGolem: los brazos que se balancean al caminar y suben al pegar
      cabeza(pose, e, ['head']);
      var s = e.paso, a = Math.min(1, e.amplitud);
      pose.leg0 = [-1.5 * onda(s, 13) * a, 0, 0];
      pose.leg1 = [1.5 * onda(s, 13) * a, 0, 0];
      if (e.golpe > 0) {
        var g = -2 + 1.5 * onda(e.golpe * 10, 10);
        pose.arm0 = [g, 0, 0]; pose.arm1 = [g, 0, 0];
      } else if (e.ofrece) {
        pose.arm0 = [-0.8 + 0.025 * onda(e.tiempo, 70), 0, 0];
      } else {
        pose.arm0 = [(-0.2 + 1.5 * onda(s, 13)) * a, 0, 0];
        pose.arm1 = [(-0.2 - 1.5 * onda(s, 13)) * a, 0, 0];
      }
    },
    nieve: function (pose, e) {
      // ModelSnowMan: la cabeza mira; el cuerpo de arriba gira un poco con ella
      cabeza(pose, e, ['head']);
      var y = e.cabezaYaw * 0.25;
      pose.piece1 = [0, y, 0];
      pose.arm1 = [0, y, 0]; pose.arm2 = [0, y, 0];
    },
    cuadrupedo: function (pose, e) {
      pose.body = [PI / 2, 0, 0];
      pose.head = [e.cabezaPitch + (e.come || 0), e.cabezaYaw, 0, 0, -(e.comeY || 0), 0];
      patas(pose, e, ['leg0', 'leg1', 'leg2', 'leg3'], [0, PI, PI, 0]);
    },
    oso: function (pose, e) {
      A.cuadrupedo(pose, e);
      // ModelPolarBear: se para en dos patas cuando ataca
      var p = e.parado || 0;
      if (p > 0) {
        pose.body = [PI / 2 - p * PI * 0.35, 0, 0, 0, p * 9, p * 1];
        pose.head = [e.cabezaPitch + p * PI * 0.15, e.cabezaYaw, 0, 0, p * 13, p * 9];
        pose.leg2 = [pose.leg2[0] - p * PI * 0.45, 0, 0, 0, p * 9, p * 5];
        pose.leg3 = [pose.leg3[0] - p * PI * 0.45, 0, 0, 0, p * 9, p * 5];
      }
    },
    llama: function (pose, e) {
      pose.body = [PI / 2, 0, 0];
      cabeza(pose, e, ['head']);
      patas(pose, e, ['leg0', 'leg1', 'leg2', 'leg3'], [0, PI, PI, 0]);
    },
    gallina: function (pose, e) {
      pose.head = pose.beak = pose.comb = [e.cabezaPitch, e.cabezaYaw, 0];
      pose.body = [PI / 2, 0, 0];
      patas(pose, e, ['leg0', 'leg1'], [0, PI]);
      // las alas aletean cuando cae (ModelChicken: rotateAngleZ = ageInTicks)
      var ala = e.cayendo ? (sin(e.tiempo * 1.5) + 1) * 0.9 : 0;
      pose.wing0 = [0, 0, ala]; pose.wing1 = [0, 0, -ala];
    },
    lobo: function (pose, e) {
      cabeza(pose, e, ['head']);
      var s = e.paso * 0.6662, a = Math.min(1, e.amplitud);
      var cola = e.enojado ? 1.5393804 : e.domado ? (0.55 - (20 - (e.vida || 20)) * 0.02) * PI : PI / 5;
      if (e.sentado) {
        // sentado: el cuerpo inclinado, las patas de atrás dobladas
        pose.upperBody = [2 * PI / 5, 0, 0, 0, -1, 0];
        pose.body = [PI / 4, 0, 0, 0, -3, 0];
        pose.leg0 = [3 * PI / 2, 0, 0, 0, -6.3, -2]; pose.leg1 = [3 * PI / 2, 0, 0, 0, -6.3, -2];
        pose.leg2 = [5.811947, 0, 0, 0.01, -1.3, 1]; pose.leg3 = [5.811947, 0, 0, -0.01, -1.3, 1];
        pose.tail = [cola, 0, 0, 0, -5.4, -2];
      } else {
        pose.body = [PI / 2, 0, 0]; pose.upperBody = [PI / 2, 0, 0];
        patas(pose, e, ['leg0', 'leg1', 'leg2', 'leg3'], [0, PI, PI, 0]);
        pose.tail = [cola, e.enojado ? 0 : cos(s) * 1.4 * a, 0];
      }
      if (e.ladea) pose.head = [e.cabezaPitch, e.cabezaYaw, e.ladea];
    },
    ocelote: function (pose, e) {
      cabeza(pose, e, ['head']);
      pose.body = [PI / 2, 0, 0];
      var s = e.paso * 0.6662, a = Math.min(1, e.amplitud);
      if (e.sentado) {
        pose.body = [PI / 4, 0, 0, 0, -4, 0];
        pose.tail1 = [PI / 4 - 0.9, 0, 0, 0, -9, 1]; pose.tail2 = [PI / 2, 0, 0, 0, -10, 3];
        pose.frontLegL = [-PI / 20, 0, 0, 0, -2, -4]; pose.frontLegR = [-PI / 20, 0, 0, 0, -2, -4];
        pose.backLegL = [-PI / 2, 0, 0, 0, -6, -2]; pose.backLegR = [-PI / 2, 0, 0, 0, -6, -2];
      } else {
        pose.backLegL = [cos(s) * a, 0, 0]; pose.backLegR = [cos(s + PI) * a, 0, 0];
        pose.frontLegL = [cos(s + PI) * a, 0, 0]; pose.frontLegR = [cos(s) * a, 0, 0];
        pose.tail2 = [1.7278 - 0.9 + PI / 4 * cos(s) * a, 0, 0];
      }
    },
    conejo: function (pose, e) {
      // ModelRabbit: todo sale del salto (0 a 1)
      var f = sin((e.salto || 0) * PI);
      cabeza(pose, e, ['head', 'nose']);
      pose.earRight = [e.cabezaPitch, e.cabezaYaw, 0]; pose.earLeft = [e.cabezaPitch, e.cabezaYaw, 0];
      pose.haunchLeft = [f * 50 * GR, 0, 0]; pose.haunchRight = [f * 50 * GR, 0, 0];
      pose.rearFootLeft = [f * 50 * GR, 0, 0]; pose.rearFootRight = [f * 50 * GR, 0, 0];
      pose.frontLegLeft = [-f * 40 * GR, 0, 0]; pose.frontLegRight = [-f * 40 * GR, 0, 0];
    },
    caballo: function (pose, e) {
      // el ModelHorse de la 1.2: las tres partes de cada pata giran juntas desde la cadera
      var s = e.paso * 0.6662, a = Math.min(1, e.amplitud), t = e.tiempo || 0;
      var fases = [PI, 0, 0, PI];
      for (var i = 0; i < 4; i++) {
        var r = [cos(s + fases[i]) * 1.4 * a, 0, 0];
        pose['Leg' + (i + 1) + 'A'] = r; pose['Leg' + (i + 1) + 'B'] = r; pose['Leg' + (i + 1) + 'C'] = r;
      }
      var cab = [e.cabezaPitch * 0.5 + (e.come ? 1.2 : 0), e.cabezaYaw * 0.5, 0];
      ['Head', 'UMouth', 'LMouth', 'Ear1', 'Ear2', 'MuleEarL', 'MuleEarR', 'Neck', 'Mane', 'HeadSaddle',
        'SaddleMouthL', 'SaddleMouthR', 'SaddleMouthLine', 'SaddleMouthLineR'].forEach(function (k) { pose[k] = cab; });
      var cola = [a * 0.5 - 0.1 * (1 - a), cos(t * 0.7) * 0.15 * (e.mueveCola ? 1 : 0), 0];
      pose.TailA = cola; pose.TailB = cola; pose.TailC = cola;
    },
    loro: function (pose, e) {
      cabeza(pose, e, ['head', 'head2', 'beak1', 'beak2', 'feather']);
      var t = e.tiempo || 0;
      if (e.vuela) {
        var al = t * 0.3;
        pose.wing0 = [0, 0, -0.0873 - al % 1 * 0]; pose.wing1 = [0, 0, 0.0873];
        var f = sin(t * 0.8) * 0.6 + 0.6;
        pose.wing0 = [0, 0, -0.0873 - f]; pose.wing1 = [0, 0, 0.0873 + f];
        pose.leg0 = [0.6, 0, 0]; pose.leg1 = [0.6, 0, 0];
      } else {
        patas(pose, e, ['leg0', 'leg1'], [0, PI], 1.4);
      }
      pose.tail = [0.3 + cos(e.paso * 0.6662) * 0.3 * Math.min(1, e.amplitud), 0, 0];
    },
    murcielago: function (pose, e) {
      var t = e.tiempo || 0;
      if (e.colgado) {
        // cabeza abajo, colgado del techo, con las alas cerradas
        pose.head = [e.cabezaPitch, PI - e.cabezaYaw, PI];
        pose.body = [PI, 0, 0];
        pose.rightWing = [-0.15708, -1.2566371, 0]; pose.leftWing = [-0.15708, 1.2566371, 0];
        pose.rightWingTip = [0, -1.7278761, 0]; pose.leftWingTip = [0, 1.7278761, 0];
        pose.rightEar = pose.leftEar = pose.head;
        return;
      }
      cabeza(pose, e, ['head', 'rightEar', 'leftEar']);
      var w = cos(t * 1.3) * PI * 0.25;
      pose.body = [PI / 4 + cos(t * 0.1) * 0.15, 0, 0];
      pose.rightWing = [0, w, 0]; pose.leftWing = [0, -w, 0];
      pose.rightWingTip = [0, w * 0.5, 0]; pose.leftWingTip = [0, -w * 0.5, 0];
    },
    calamar: function (pose, e) {
      // los tentáculos se abren y cierran (ModelSquid: tentacleAngle); el cuerpo se inclina al nadar
      var ang = e.tentaculos !== undefined ? e.tentaculos : (sin((e.tiempo || 0) * 0.25) + 1) * 0.35;
      for (var i = 1; i <= 8; i++) pose['tentacle' + i] = [ang, 0, 0];
      if (e.inclina) pose.body = [e.inclina, 0, 0];
    },
    guardian: function (pose, e) {
      var t = e.tiempo || 0;
      cabeza(pose, e, ['head', 'eye']);
      // las púas que entran y salen, la cola que se mueve (ModelGuardian)
      var f = (1 - (e.puas || 0)) * 0.55;
      for (var i = 0; i < 12; i++) pose['spikepart' + i] = [0, 0, 0, 0, 0, 0];
      var c = sin(t * 0.25) * PI * 0.05;
      pose.tailpart0 = [0, c, 0]; pose.tailpart1 = [0, c * 2, 0]; pose.tailpart2 = [0, c * 3, 0];
      void f;
    },
    ghast: function (pose, e) {
      var t = e.tiempo || 0;
      for (var i = 0; i < 9; i++) pose['tentacles_' + i] = [0.2 * sin(t * 0.3 + i) + 0.4, 0, 0];
    },
    blaze: function (pose, e) {
      // ModelBlaze: tres anillos de varas que giran alrededor (corrimientos desde donde están quietas)
      var t = e.tiempo || 0;
      cabeza(pose, e, ['head']);
      function anillo(desde, hasta, f0, df, r, y0, fy, ky) {
        for (var i = desde; i < hasta; i++) {
          var j = i - desde;
          var f = f0 + df * t + j * PI / 2, g = f0 + j * PI / 2;
          var x = cos(f) * r - cos(g) * r, z = sin(f) * r - sin(g) * r;
          var y = cos((i * fy + t) * ky) - cos(i * fy * ky);
          pose['upperBodyParts' + i] = [0, 0, 0, x, -y, z];
        }
      }
      anillo(0, 4, 0, PI * -0.1, 9, -2, 2, 0.25);
      anillo(4, 8, PI / 4, PI * 0.03, 7, 2, 2, 0.25);
      anillo(8, 12, 0.47123894, PI * -0.05, 5, 11, 1.5, 0.5);
    },
    lepisma: function (pose, e) {
      // ModelSilverfish: el cuerpo ondula
      var t = e.tiempo || 0, an = [];
      for (var i = 0; i < 7; i++) {
        var ry = cos(t * 0.9 + i * 0.15 * PI) * PI * 0.05 * (1 + abs(i - 2)), dx = sin(t * 0.9 + i * 0.15 * PI) * PI * 0.2 * abs(i - 2);
        pose['bodyPart_' + i] = an[i] = [0, ry, 0, dx, 0, 0];
      }
      pose.bodyLayer_0 = an[2]; pose.bodyLayer_1 = an[4]; pose.bodyLayer_2 = an[1];
    },
    endermite: function (pose, e) {
      var t = e.tiempo || 0;
      for (var i = 0; i < 4; i++) {
        pose['section_' + i] = [0, cos(t * 0.9 + i * 0.15 * PI) * PI * 0.01 * (1 + abs(i - 1)), 0,
          sin(t * 0.9 + i * 0.15 * PI) * PI * 0.1 * abs(i - 1), 0, 0];
      }
    },
    magma: function (pose, e) {
      // ModelMagmaCube: las capas se separan al saltar
      var a = e.aplastado || 0;
      for (var i = 0; i < 8; i++) pose['bodyCube_' + i] = [0, 0, 0, 0, Math.max(0, a) * (4 - i) * 1.7, 0];
    },
    shulker: function (pose, e) {
      var p = e.peek || 0;
      pose.lid = [0, (e.tiempo || 0) * 0 + p * PI * 0.25 * (e.gira || 0), 0, 0, p * 8, 0];
      cabeza(pose, e, ['head']);
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
        var dy = -(cos(s + fy[par]) * 0.4) * a, dz = abs(sin(s / 2 + fz[par]) * 0.4) * a;
        pose['leg' + i] = [0, y[i] + sg * dy, z[i] + sg * dz];
      }
    },
    creeper: function (pose, e) {
      pose.head = [e.cabezaPitch, e.cabezaYaw, 0];
      patas(pose, e, ['leg0', 'leg1', 'leg2', 'leg3'], [0, PI, PI, 0]);
    },
    wither: function (pose, e) {
      var t = e.tiempo || 0;
      pose.upperBodyPart2 = [(0.065 + 0.05 * cos(t * 0.1)) * PI, 0, 0];
      pose.upperBodyPart3 = [(0.265 + 0.1 * cos(t * 0.1)) * PI, 0, 0];
      cabeza(pose, e, ['head1']);
      pose.head2 = [e.cabezaPitch * 0.5, e.cabezaYaw - 0.3, 0];
      pose.head3 = [e.cabezaPitch * 0.5, e.cabezaYaw + 0.3, 0];
    },
    dragon: function (pose, e) {
      // las alas que aletean (el resto del dragón, quieto, como en el End sin pelear)
      var t = (e.tiempo || 0) * 0.05, f = cos(t * PI * 2);
      pose.wing = [0.125 - cos(t * PI * 2) * 0.2, 0, f * 0.6 + 0.6];
      pose.wing1 = [0.125 - cos(t * PI * 2) * 0.2, 0, -(f * 0.6 + 0.6)];
      pose.wingtip = [0, 0, -(sin(t * PI * 2 + 2) + 0.5) * 0.75];
      pose.wingtip1 = [0, 0, (sin(t * PI * 2 + 2) + 0.5) * 0.75];
      pose.head = [e.cabezaPitch, e.cabezaYaw, 0];
      pose.jaw = [e.mandibula || 0, 0, 0];
    },
    quieto: function () {},
    // proyectiles: miran hacia donde van (cabezaYaw / cabezaPitch)
    flecha: function (pose, e) {
      var r = [0, 0, 0];
      ['shaft0', 'shaft1', 'tail'].forEach(function (k) { pose[k] = [0, -PI / 2, 0]; });
      void r; void e;
    },
    giratorio: function (pose, e) { var t = e.tiempo || 0; pose.main = [t * 0.2, t * 0.3, 0]; pose.body = [0, 0, 0]; },
    // los colmillos del evocador (ModelEvokerFangs.render): suben del piso con las mandíbulas
    // abiertas y se cierran en la primera mitad
    colmillos: function (pose, e) {
      var f = e.progreso || 0, a = Math.min(1, f * 2), sube = (f + sin(f * 2.7)) * 0.6 * 12;
      a = 1 - a * a * a;
      pose.base = [0, 0, 0, 0, sube, 0];
      pose.upper_jaw = [0, 0, -a * 0.35 * PI, 0, sube, 0];
      pose.lower_jaw = [0, 0, a * 0.35 * PI, 0, sube, 0];
    }
  };
  var TIPO = {
    steve: 'humanoide', alex: 'humanoide', zombie: 'zombi', husk: 'zombi', zombie_villager: 'zombi', zombie_pigman: 'zombi',
    skeleton: 'esqueleto', stray: 'esqueleto', wither_skeleton: 'esqueleto', enderman: 'enderman', vex: 'vex',
    villager: 'aldeano', witch: 'bruja', vindicator: 'illager', evocation_illager: 'illager',
    iron_golem: 'golem', snow_golem: 'nieve', pig: 'cuadrupedo', cow: 'cuadrupedo', mooshroom: 'cuadrupedo', sheep: 'cuadrupedo',
    polar_bear: 'oso', llama: 'llama', chicken: 'gallina', wolf: 'lobo', ocelot: 'ocelote', rabbit: 'conejo',
    horse: 'caballo', donkey: 'caballo', mule: 'caballo', skeleton_horse: 'caballo', zombie_horse: 'caballo',
    parrot: 'loro', bat: 'murcielago', squid: 'calamar', guardian: 'guardian', elder_guardian: 'guardian',
    ghast: 'ghast', blaze: 'blaze', silverfish: 'lepisma', endermite: 'endermite', slime: 'quieto', magma_cube: 'magma',
    shulker: 'shulker', spider: 'arana', cave_spider: 'arana', creeper: 'creeper', wither: 'wither', ender_dragon: 'dragon',
    arrow: 'flecha', shulker_bullet: 'giratorio', llama_spit: 'quieto', wither_skull: 'quieto', wither_skull_dangerous: 'quieto',
    evocation_fang: 'colmillos'
  };
  // los huesos que no se ven salvo que el bicho los muestre (la montura, las alforjas, las orejas de
  // mula, los cofres de la llama)
  var OCULTOS = {
    horse: ['MuleEarL', 'MuleEarR', 'Bag1', 'Bag2', 'Saddle', 'SaddleB', 'SaddleC', 'SaddleL', 'SaddleL2', 'SaddleR', 'SaddleR2',
      'SaddleMouthL', 'SaddleMouthR', 'SaddleMouthLine', 'SaddleMouthLineR', 'HeadSaddle'],
    donkey: ['Ear1', 'Ear2', 'Bag1', 'Bag2', 'Saddle', 'SaddleB', 'SaddleC', 'SaddleL', 'SaddleL2', 'SaddleR', 'SaddleR2',
      'SaddleMouthL', 'SaddleMouthR', 'SaddleMouthLine', 'SaddleMouthLineR', 'HeadSaddle', 'Mane'],
    llama: ['chest1', 'chest2']
  };
  OCULTOS.mule = OCULTOS.donkey;
  OCULTOS.skeleton_horse = OCULTOS.horse; OCULTOS.zombie_horse = OCULTOS.horse;
  var ocultosSet = {};
  for (var mk in OCULTOS) { ocultosSet[mk] = {}; OCULTOS[mk].forEach(function (b) { ocultosSet[mk][b] = true; }); }

  // la matriz de un hueso (3x4): girar alrededor del pivote y correrlo. Orden de la versión de PC:
  // z, y, x (con x y z al revés porque acá y va para arriba)
  function matriz(r, p, m) {
    var ax = -r[0], ay = r[1], az = -r[2];
    var cx = cos(ax), sx = sin(ax), cy = cos(ay), sy = sin(ay), cz = cos(az), sz = sin(az);
    // R = Rz * Ry * Rx
    var a00 = cz * cy, a01 = cz * sy * sx - sz * cx, a02 = cz * sy * cx + sz * sx;
    var a10 = sz * cy, a11 = sz * sy * sx + cz * cx, a12 = sz * sy * cx - cz * sx;
    var a20 = -sy, a21 = cy * sx, a22 = cy * cx;
    var dx = r[3] || 0, dy = r[4] || 0, dz = r[5] || 0;
    m[0] = a00; m[1] = a01; m[2] = a02; m[3] = p[0] - (a00 * p[0] + a01 * p[1] + a02 * p[2]) + dx;
    m[4] = a10; m[5] = a11; m[6] = a12; m[7] = p[1] - (a10 * p[0] + a11 * p[1] + a12 * p[2]) + dy;
    m[8] = a20; m[9] = a21; m[10] = a22; m[11] = p[2] - (a20 * p[0] + a21 * p[1] + a22 * p[2]) + dz;
  }

  // e: { modelo, x, y, z, yaw (como el del jugador: 0 mira al norte), luz, dano (0..1), escala,
  // escalas [x, y, z], texturas (las de la variante), tinte, ocultos, mostrar }
  Mo.capas = function (e) { return modelos[e.modelo] || []; };
  // la textura con la que se dibuja una capa de un bicho (la de su variante en la primera capa)
  Mo.textura = function (e, capa, i) {
    if (i === 0 && e.textura) return e.textura;
    return capa.tex;
  };
  Mo.vertices = function (e) {
    var l = modelos[e.modelo], n = 0;
    if (!l) return 0;
    for (var i = 0; i < l.length; i++) {
      if (l[i].cartel) { n += 6; continue; }
      for (var j = 0; j < l[i].huesos.length; j++) n += l[i].huesos[j].caras.length / 8;
    }
    return n;
  };
  var pose = {}, m = new Float32Array(12), CERO = [0, 0, 0], rt = [0, 0, 0, 0, 0, 0];
  // escribe los vértices de una capa de e en d desde o (en floats); devuelve el o nuevo
  Mo.escribir = function (d, o, e, capa, cam, colorLuz) {
    // la lana de la oveja esquilada no se dibuja
    if (capa.lana && !e.lana) return o;
    var luzE = capa.brilla ? 0xFF : (e.luz === undefined ? 0xF0 : e.luz);
    var luz = colorLuz(luzE), alfa = 1 - Math.min(1, e.dano || 0);
    var tinte = capa.tenido ? (e.lana || null) : null;
    if (e.tinte && !capa.tenido) tinte = e.tinte;
    var esc = (e.escala || 1) / 16, ex = e.escalas ? e.escalas[0] : 1, ey = e.escalas ? e.escalas[1] : 1, ez = e.escalas ? e.escalas[2] : 1;
    var bx = e.x - cam.x, by = e.y - cam.y, bz = e.z - cam.z;
    if (capa.cartel) {
      // un dibujo plano que mira a la cámara (bolas de nieve, de fuego, pociones)
      var lado = (capa.grande ? 1 : 0.5) * (e.escala || 1) * 0.5;
      var cyaw = cos(cam.yaw), syaw = sin(cam.yaw), cp = cos(cam.pitch), sp = sin(cam.pitch);
      var rx = cyaw * lado, rz = syaw * lado, ux = sp * syaw * lado, uy = cp * lado, uz = -sp * cyaw * lado;
      var cy0 = by + lado;
      var esq = [[-1, -1, 0, 1], [1, -1, 1, 1], [1, 1, 1, 0], [-1, -1, 0, 1], [1, 1, 1, 0], [-1, 1, 0, 0]];
      for (var q = 0; q < 6; q++) {
        var s0 = esq[q][0], s1 = esq[q][1];
        d[o++] = bx + rx * s0 + ux * s1; d[o++] = cy0 + uy * s1; d[o++] = bz + rz * s0 + uz * s1; d[o++] = 1;
        d[o++] = luz[0]; d[o++] = luz[1]; d[o++] = luz[2]; d[o++] = 1;
        d[o++] = esq[q][2]; d[o++] = esq[q][3];
      }
      return o;
    }
    for (var k in pose) delete pose[k];
    var an = A[TIPO[e.modelo] || 'cuadrupedo'];
    if (an) an(pose, e);
    // muriendo: el cuerpo cae de costado (como el "deathTime" del juego)
    var muere = e.muerte > 0, rc = 1, rs = 0;
    if (muere) { var ang = Math.min(1, e.muerte * 1.6) * PI / 2; rc = cos(ang); rs = sin(ang); }
    var cyw = cos(e.yaw), syw = sin(e.yaw);
    var pitchE = e.pitch || 0, cpe = cos(pitchE), spe = sin(pitchE);
    var ocultos = ocultosSet[e.modelo];
    for (var j = 0; j < capa.huesos.length; j++) {
      var h = capa.huesos[j], f = h.caras;
      if (ocultos && ocultos[h.n] && !(e.mostrar && e.mostrar[h.n])) {
        // no se dibuja: los vértices quedan en un punto (sin área)
        for (var z0 = 0; z0 < f.length; z0 += 8) { for (var w0 = 0; w0 < 10; w0++) d[o + w0] = 0; o += 10; }
        continue;
      }
      if (e.ocultos && e.ocultos[h.n]) { for (var z1 = 0; z1 < f.length; z1 += 8) { for (var w1 = 0; w1 < 10; w1++) d[o + w1] = 0; o += 10; } continue; }
      var r = pose[h.n], base = h.rr || CERO;
      if (r) {
        rt[0] = base[0] + r[0]; rt[1] = base[1] + r[1]; rt[2] = base[2] + r[2];
        rt[3] = r[3] || 0; rt[4] = r[4] || 0; rt[5] = r[5] || 0;
      } else { rt[0] = base[0]; rt[1] = base[1]; rt[2] = base[2]; rt[3] = rt[4] = rt[5] = 0; }
      matriz(rt, h.p, m);
      for (var i = 0; i < f.length; i += 8) {
        var x = f[i], y = f[i + 1], zz = f[i + 2];
        var px = m[0] * x + m[1] * y + m[2] * zz + m[3], py = m[4] * x + m[5] * y + m[6] * zz + m[7], pz = m[8] * x + m[9] * y + m[10] * zz + m[11];
        px *= ex; py *= ey; pz *= ez;
        if (muere) { var qx = px * rc - py * rs; py = px * rs + py * rc; px = qx; }
        // los proyectiles y lo que vuela de cabeza: inclinados hacia donde van
        if (pitchE) { var qy = py * cpe - pz * spe; pz = py * spe + pz * cpe; py = qy; }
        // del modelo al mundo: dado vuelta en x (como el de PC) y girado según hacia dónde mira
        var wx = -(px * cyw + pz * syw), wz = -px * syw + pz * cyw;
        d[o++] = bx + wx * esc; d[o++] = by + py * esc; d[o++] = bz + wz * esc; d[o++] = 1;
        // la luz de la cara según hacia dónde da (arriba clara, abajo oscura, como el juego)
        var nx = f[i + 5], ny = f[i + 6], nz = f[i + 7];
        var gy = m[4] * nx + m[5] * ny + m[6] * nz, gx = m[0] * nx + m[1] * ny + m[2] * nz;
        var sombra = capa.brilla ? 1 : 0.75 + 0.25 * gy - 0.08 * abs(gx);
        var cr = luz[0] * sombra, cg = luz[1] * sombra, cb = luz[2] * sombra;
        if (tinte) { cr *= tinte[0]; cg *= tinte[1]; cb *= tinte[2]; }
        d[o++] = cr; d[o++] = cg; d[o++] = cb; d[o++] = alfa;
        d[o++] = f[i + 3]; d[o++] = f[i + 4];
      }
    }
    return o;
  };
  // el fuego de un bicho que se quema (Render.renderEntityOnFire): carteles con las dos texturas del
  // fuego, de cara a la cámara, apilados de abajo para arriba y cada uno más angosto y más atrás
  function capasFuego(e) {
    var f = (e.radio || 0.6) * 1.4;
    return Math.max(1, Math.ceil((e.alto || 1.8) / f / 0.45));
  }
  Mo.verticesFuego = function (e) { return e.quema ? capasFuego(e) * 6 : 0; };
  Mo.fuego = function (d, o, e, cam, luz, uvs) {
    var f = (e.radio || 0.6) * 1.4, n = capasFuego(e), f3 = (e.alto || 1.8) / f;
    var cyaw = cos(cam.yaw), syaw = sin(cam.yaw), fx = syaw, fz = -cyaw;
    var bx = e.x - cam.x, by = e.y - cam.y, bz = e.z - cam.z;
    var f1 = 0.5, f4 = 0, f5 = -0.3 + Math.floor(f3) * 0.02;
    for (var i = 0; i < n; i++) {
      var r = uvs[i % 2], u0 = r[0], u1 = r[2], v0 = r[1], v1 = r[3];
      if (((i / 2) | 0) % 2 === 0) { var t = u0; u0 = u1; u1 = t; }
      var ax = f1 * f, y0 = by + f4 * f, y1 = by + (f4 + 1.4) * f, zx = fx * f5 * f, zz = fz * f5 * f;
      var esq = [[1, y0, u1, v1], [-1, y0, u0, v1], [-1, y1, u0, v0], [1, y0, u1, v1], [-1, y1, u0, v0], [1, y1, u1, v0]];
      for (var q = 0; q < 6; q++) {
        var sx = esq[q][0] * ax;
        d[o++] = bx + cyaw * sx + zx; d[o++] = esq[q][1]; d[o++] = bz + syaw * sx + zz; d[o++] = 1;
        d[o++] = luz[0]; d[o++] = luz[1]; d[o++] = luz[2]; d[o++] = 1;
        d[o++] = esq[q][2]; d[o++] = esq[q][3];
      }
      f4 += 0.45; f1 *= 0.9; f5 += 0.03;
    }
    return o;
  };
  return Mo;
})();
