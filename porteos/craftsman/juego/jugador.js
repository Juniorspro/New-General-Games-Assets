// porteo: el jugador. La física es la de Minecraft (la de MCPE viene de ahí): 20 pasos por segundo,
// gravedad 0,08, roce 0,91 en el aire y 0,546 en el piso, salto de 0,42, subir escalones de 0,6,
// nadar, escaleras de mano y volar en creativo. La cámara se interpola entre pasos para que se vea
// a 60 cuadros.
var Jugador = (function () {
  'use strict';
  var J = {};
  var ANCHO = 0.3, ALTO = 1.8, OJOS = 1.62;
  J.x = 0.5; J.y = 80; J.z = 0.5; J.vx = 0; J.vy = 0; J.vz = 0;
  J.px = 0; J.py = 0; J.pz = 0;     // la posición del paso anterior (para interpolar)
  J.yaw = 0; J.pitch = 0;           // pitch > 0 mira hacia abajo, como el juego
  J.enPiso = false; J.volando = false; J.enAgua = false; J.cabezaEnAgua = false; J.corriendo = false; J.agachado = false;
  J.creativo = true;
  J.autoSalto = true;               // el "salto automático" de MCPE en pantallas táctiles (viene prendido)
  J.entrada = { adelante: 0, costado: 0, saltar: false, bajar: false, subir: false };
  J.caminado = 0;                   // para los pasos (sonido) y el bamboleo de la cámara

  // las cajas de choque de un bloque (en coordenadas del bloque)
  function cajas(id, m, sal, x, y, z) {
    sal.length = 0;
    if (id <= 0) { if (id < 0) sal.push([0, 0, 0, 1, 1, 1]); return sal; }
    if (!C.SOLIDO[id]) return sal;
    var f = C.FORMA[id], F = C.F;
    if (f === F.losa) {
      if (id === 92) sal.push([1 / 16, 0, 1 / 16, 15 / 16, 0.5, 15 / 16]);
      else if (id === 26) sal.push([0, 0, 0, 1, 0.5625, 1]);
      else if (m & 8) sal.push([0, 0.5, 0, 1, 1, 1]); else sal.push([0, 0, 0, 1, 0.5, 1]);
    } else if (f === F.escalera) {
      var inv = (m & 4) !== 0, d = m & 3;
      sal.push([0, inv ? 0.5 : 0, 0, 1, inv ? 1 : 0.5, 1]);
      sal.push([d === 0 ? 0.5 : 0, inv ? 0 : 0.5, d === 2 ? 0.5 : 0, d === 1 ? 0.5 : 1, inv ? 0.5 : 1, d === 3 ? 0.5 : 1]);
    } else if (f === F.capa) sal.push([0, 0, 0, 1, (m & 7) / 8, 1]);
    else if (f === F.alfombra) sal.push([0, 0, 0, 1, 1 / 16, 1]);
    else if (f === F.bajo) sal.push([0, 0, 0, 1, 15 / 16, 1]);
    else if (f === F.cactus) sal.push([1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]);
    else if (f === F.cerca || f === F.muro) sal.push([0.375, 0, 0.375, 0.625, 1.5, 0.625]);
    else if (f === F.panel) sal.push([0.4375, 0, 0.4375, 0.5625, 1, 0.5625]);
    else if (f === F.puerta) {
      // como la dibuja el trabajador: una tabla de 3/16 del lado que corresponde (la mitad de arriba
      // toma el giro y si está abierta de la de abajo)
      var mm = (m & 8) ? Mundo.meta(x, y - 1, z) : m, g = 3 / 16;
      var d2 = ((mm & 3) + ((mm & 4) ? 1 : 0)) & 3;
      sal.push(d2 === 0 ? [0, 0, 0, g, 1, 1] : d2 === 1 ? [0, 0, 0, 1, 1, g] : d2 === 2 ? [1 - g, 0, 0, 1, 1, 1] : [0, 0, 1 - g, 1, 1, 1]);
    } else if (f === F.trampilla) {
      if (!(m & 4)) sal.push([0, (m & 8) ? 13 / 16 : 0, 0, 1, (m & 8) ? 1 : 3 / 16, 1]);
    } else if (f === F.nenufar) sal.push([0, 0, 0, 1, 1 / 64, 1]);
    else sal.push([0, 0, 0, 1, 1, 1]);
    return sal;
  }
  var cc = [];

  // mover una caja (los pies en x,y,z) contra los bloques, eje por eje, recortando el movimiento
  function choques(x0, y0, z0, x1, y1, z1, lista) {
    lista.length = 0;
    for (var x = Math.floor(x0); x <= Math.floor(x1); x++)
      for (var y = Math.floor(y0) - 1; y <= Math.floor(y1); y++)
        for (var z = Math.floor(z0); z <= Math.floor(z1); z++) {
          var id = Mundo.bloque(x, y, z);
          if (id === 0) continue;
          cajas(id, id > 0 ? Mundo.meta(x, y, z) : 0, cc, x, y, z);
          for (var k = 0; k < cc.length; k++) {
            var b = cc[k];
            lista.push(x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
          }
        }
    return lista;
  }
  var lista = [];
  function mover(dx, dy, dz) {
    var bx0 = J.x - ANCHO, by0 = J.y, bz0 = J.z - ANCHO, bx1 = J.x + ANCHO, by1 = J.y + ALTO, bz1 = J.z + ANCHO;
    choques(Math.min(bx0, bx0 + dx) - 0.001, Math.min(by0, by0 + dy) - 0.001, Math.min(bz0, bz0 + dz) - 0.001,
      Math.max(bx1, bx1 + dx) + 0.001, Math.max(by1, by1 + dy) + 0.001, Math.max(bz1, bz1 + dz) + 0.001, lista);
    var ody = dy, odx = dx, odz = dz, i;
    // y
    for (i = 0; i < lista.length; i += 6) {
      if (bx1 <= lista[i] || bx0 >= lista[i + 3] || bz1 <= lista[i + 2] || bz0 >= lista[i + 5]) continue;
      if (dy > 0 && by1 <= lista[i + 1]) dy = Math.min(dy, lista[i + 1] - by1);
      else if (dy < 0 && by0 >= lista[i + 4]) dy = Math.max(dy, lista[i + 4] - by0);
    }
    by0 += dy; by1 += dy;
    // x
    for (i = 0; i < lista.length; i += 6) {
      if (by1 <= lista[i + 1] || by0 >= lista[i + 4] || bz1 <= lista[i + 2] || bz0 >= lista[i + 5]) continue;
      if (dx > 0 && bx1 <= lista[i]) dx = Math.min(dx, lista[i] - bx1);
      else if (dx < 0 && bx0 >= lista[i + 3]) dx = Math.max(dx, lista[i + 3] - bx0);
    }
    bx0 += dx; bx1 += dx;
    // z
    for (i = 0; i < lista.length; i += 6) {
      if (by1 <= lista[i + 1] || by0 >= lista[i + 4] || bx1 <= lista[i] || bx0 >= lista[i + 3]) continue;
      if (dz > 0 && bz1 <= lista[i + 2]) dz = Math.min(dz, lista[i + 2] - bz1);
      else if (dz < 0 && bz0 >= lista[i + 5]) dz = Math.max(dz, lista[i + 5] - bz0);
    }
    return [dx, dy, dz, odx !== dx, ody !== dy, odz !== dz];
  }

  // subir escalones de hasta 0,6 (losas, escaleras): si choca de costado estando en el piso, prueba
  // subir, avanzar y volver a bajar; se queda con eso si avanzó más
  function moverConEscalon(dx, dy, dz) {
    var r = mover(dx, dy, dz);
    if ((r[3] || r[5]) && J.enPiso && !J.volando) {
      var sx = J.x, sy = J.y, sz = J.z;
      var up = mover(0, 0.6, 0);
      J.y += up[1];
      var h = mover(dx, 0, dz);
      J.x += h[0]; J.z += h[2];
      var dn = mover(0, -up[1] + Math.min(dy, 0), 0);
      J.y += dn[1];
      if (h[0] * h[0] + h[2] * h[2] > r[0] * r[0] + r[2] * r[2] + 1e-6) return [h[0], 0, h[2], h[3], true, h[5], true];
      J.x = sx; J.y = sy; J.z = sz;
    }
    J.x += r[0]; J.y += r[1]; J.z += r[2];
    return r;
  }

  function enLiquido(dy) {
    var id = Mundo.bloque(Math.floor(J.x), Math.floor(J.y + dy), Math.floor(J.z));
    return id === 8 || id === 9 ? 1 : id === 10 || id === 11 ? 2 : 0;
  }
  function escalonAdelante(fwd, str, sin, cos) {
    var dx = str * cos + fwd * sin, dz = str * sin - fwd * cos, l = Math.sqrt(dx * dx + dz * dz);
    if (l < 1e-6) return false;
    dx /= l; dz /= l;
    var x = Math.floor(J.x + dx * 0.6), z = Math.floor(J.z + dz * 0.6), y = Math.floor(J.y + 0.01);
    var b = Mundo.bloque(x, y, z), a1 = Mundo.bloque(x, y + 1, z), a2 = Mundo.bloque(x, y + 2, z);
    var techo = Mundo.bloque(Math.floor(J.x), y + 2, Math.floor(J.z));
    return b > 0 && C.SOLIDO[b] === 1 && !(a1 > 0 && C.SOLIDO[a1]) && !(a2 > 0 && C.SOLIDO[a2]) && !(techo > 0 && C.SOLIDO[techo]) &&
      C.FORMA[b] !== C.F.cerca && C.FORMA[b] !== C.F.muro;
  }
  function enEscalera() {
    var id = Mundo.bloque(Math.floor(J.x), Math.floor(J.y), Math.floor(J.z));
    return id === 65 || id === 106;
  }

  // un paso de física (1/20 s)
  J.paso = function () {
    J.px = J.x; J.py = J.y; J.pz = J.z;
    if (!Mundo.cargado(J.x, J.z)) return;   // esperar a que llegue el trozo
    var e = J.entrada;
    J.enAgua = enLiquido(0.4) > 0;
    J.cabezaEnAgua = enLiquido(OJOS) > 0;
    var fwd = e.adelante, str = e.costado, len = Math.sqrt(fwd * fwd + str * str);
    if (len > 1) { fwd /= len; str /= len; }
    if (J.agachado && !J.volando) { fwd *= 0.3; str *= 0.3; }
    var sin = Math.sin(J.yaw), cos = Math.cos(J.yaw);
    function empujar(f) {
      // el "moveFlying" del juego: la entrada en el sentido de la mirada
      J.vx += (str * cos + fwd * sin) * f;
      J.vz += (str * sin - fwd * cos) * f;
    }
    if (J.volando) {
      empujar(J.corriendo ? 0.1 : 0.05);
      if (e.saltar || e.subir) J.vy += 0.15;
      if (e.bajar) J.vy -= 0.15;
      moverConEscalon(J.vx, J.vy, J.vz);
      J.vy *= 0.6; J.vx *= 0.91; J.vz *= 0.91;
      var r0 = mover(0, -0.01, 0);
      if (r0[4] && !e.subir && !e.saltar && J.vy <= 0 && Math.abs(r0[1]) < 0.009) { J.volando = false; }
    } else if (J.enAgua) {
      empujar(0.02);
      var r = moverConEscalon(J.vx, J.vy, J.vz);
      J.vx *= 0.8; J.vy *= 0.8; J.vz *= 0.8;
      J.vy -= 0.02;
      if (e.saltar) J.vy += 0.04;
      if (e.bajar) J.vy -= 0.02;
      // contra un borde con la cabeza afuera del agua: un saltito para salir (como el juego)
      if ((r[3] || r[5]) && enLiquido(1.2) === 0) J.vy = 0.3;
      J.enPiso = r[4] && J.vy < 0;
    } else {
      var roce = J.enPiso ? 0.546 : 0.91;
      var f = J.enPiso ? 0.1 * (0.16277136 / (roce * roce * roce)) : 0.02;
      if (J.corriendo) f *= 1.3;
      empujar(f);
      if (enEscalera()) {
        J.vx = Math.max(-0.15, Math.min(0.15, J.vx)); J.vz = Math.max(-0.15, Math.min(0.15, J.vz));
        J.vy = Math.max(J.vy, -0.15);
        if (J.agachado && J.vy < 0) J.vy = 0;
      }
      if (e.saltar && J.enPiso) {
        J.vy = 0.42;
        if (J.corriendo) { J.vx += sin * 0.2; J.vz -= cos * 0.2; }
      }
      var antes = J.vy;
      r = moverConEscalon(J.vx, J.vy, J.vz);
      if ((r[3] || r[5]) && enEscalera()) J.vy = 0.2;
      J.enPiso = (r[4] && antes < 0) || r[6] === true;
      if (r[4]) J.vy = 0;
      if (r[3]) J.vx = 0;
      if (r[5]) J.vz = 0;
      J.vy -= 0.08; J.vy *= 0.98;
      J.vx *= roce; J.vz *= roce;
      // salto automático: caminando contra un escalón de un bloque con lugar arriba, salta solo (el
      // salto sale en el paso siguiente, como si se hubiera apretado saltar)
      if (J.autoSalto && (r[3] || r[5]) && J.enPiso && len > 0 && !J.agachado && escalonAdelante(fwd, str, sin, cos)) J.vy = 0.42;
    }
    var dx = J.x - J.px, dz = J.z - J.pz;
    if (J.enPiso) J.caminado += Math.sqrt(dx * dx + dz * dz);
    if (J.y < -64) { J.y = 100; J.vy = 0; }
  };

  // la cámara entre dos pasos
  J.camara = function (alfa, cam) {
    cam.x = J.px + (J.x - J.px) * alfa;
    cam.y = J.py + (J.y - J.py) * alfa + OJOS - (J.agachado && !J.volando ? 0.08 : 0);
    cam.z = J.pz + (J.z - J.pz) * alfa;
    cam.yaw = J.yaw; cam.pitch = J.pitch;
    return cam;
  };

  J.mirada = function () {
    var cp = Math.cos(J.pitch);
    return [Math.sin(J.yaw) * cp, -Math.sin(J.pitch), -Math.cos(J.yaw) * cp];
  };

  // ¿se puede poner un bloque en esta celda sin pisar al jugador?
  J.ocupa = function (x, y, z) {
    return x + 1 > J.x - ANCHO && x < J.x + ANCHO && y + 1 > J.y && y < J.y + ALTO && z + 1 > J.z - ANCHO && z < J.z + ANCHO;
  };

  J.ubicar = function (x, y, z) { J.x = J.px = x; J.y = J.py = y; J.z = J.pz = z; J.vx = J.vy = J.vz = 0; };
  J.OJOS = OJOS;
  return J;
})();
