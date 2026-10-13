// porteo: las cosas tiradas en el piso y los orbes de experiencia, como EntityItem y EntityXPOrb del
// juego: caen (0,04 por paso las cosas, 0,03 los orbes), rozan (0,98 en el aire, 0,588 en el piso),
// rebotan un poco, se juntan con las iguales de al lado, se van a los 5 minutos, se queman en la lava
// y el jugador las levanta al pasar (las cosas después de un rato: 10 pasos si las soltó un bloque, 40
// si las tiró él). Los orbes buscan al jugador que esté a menos de 8 bloques.
var Tirados = (function () {
  'use strict';
  var T = {}, lista = [];
  T.lista = lista;
  T.limpiar = function () { lista.length = 0; };
  var ANCHO_COSA = 0.125, ALTO_COSA = 0.25, ANCHO_ORBE = 0.25, ALTO_ORBE = 0.5;
  var MAXIMO = 400;
  function nueva(e) {
    e.px = e.x; e.py = e.y; e.pz = e.z; e.edad = e.edad || 0; e.enPiso = false;
    e.giro = e.giro !== undefined ? e.giro : Math.random() * Math.PI * 2;
    if (lista.length >= MAXIMO) lista.shift();
    lista.push(e);
    return e;
  }
  // una cosa en x, y, z (los pies) con su velocidad; espera: pasos antes de que se pueda levantar
  T.cosa = function (c, x, y, z, vx, vy, vz, espera) {
    if (!c || c.n <= 0) return null;
    return nueva({ c: { id: c.id, m: c.m || 0, n: c.n, d: c.d || 0 }, x: x, y: y, z: z, vx: vx || 0, vy: vy || 0, vz: vz || 0,
      espera: espera === undefined ? 10 : espera });
  };
  // lo que suelta un bloque (Block.spawnAsEntity): en un lugar al azar del bloque, saltando un poco
  T.deBloque = function (c, bx, by, bz) {
    return T.cosa(c, bx + Math.random() * 0.7 + 0.15, by + Math.random() * 0.7 + 0.15, bz + Math.random() * 0.7 + 0.15,
      Math.random() * 0.2 - 0.1, 0.2, Math.random() * 0.2 - 0.1, 10);
  };
  // la experiencia en orbes de los tamaños del juego (EntityXPOrb.getXPSplit)
  var PARTES = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
  T.orbes = function (x, y, z, n) {
    while (n > 0) {
      var v = 1;
      for (var i = 0; i < PARTES.length; i++) if (n >= PARTES[i]) { v = PARTES[i]; break; }
      n -= v;
      nueva({ xp: v, x: x, y: y, z: z, vx: (Math.random() * 0.2 - 0.1) * 2, vy: Math.random() * 0.2 * 2, vz: (Math.random() * 0.2 - 0.1) * 2,
        espera: 0, color: Math.floor(Math.random() * 1000) });
    }
  };
  // el dibujo de un orbe según cuánto vale (getXpOrbSize: 0 a 10 de los 16 de experience_orb.png)
  T.tamOrbe = function (v) {
    return v >= 2477 ? 10 : v >= 1237 ? 9 : v >= 617 ? 8 : v >= 307 ? 7 : v >= 149 ? 6 : v >= 73 ? 5 : v >= 37 ? 4 : v >= 17 ? 3 :
      v >= 7 ? 2 : v >= 3 ? 1 : 0;
  };

  // ------------------------------------------------------------------------------------------
  // Moverse contra los bloques (una caja chica, eje por eje)
  // ------------------------------------------------------------------------------------------
  var cc = [], cajas = [];
  function choques(x0, y0, z0, x1, y1, z1) {
    cajas.length = 0;
    for (var x = Math.floor(x0); x <= Math.floor(x1); x++)
      for (var y = Math.floor(y0) - 1; y <= Math.floor(y1); y++)
        for (var z = Math.floor(z0); z <= Math.floor(z1); z++) {
          var id = Mundo.bloque(x, y, z);
          if (id === 0) continue;
          Jugador.cajas(id, id > 0 ? Mundo.meta(x, y, z) : 0, cc, x, y, z);
          for (var k = 0; k < cc.length; k++) {
            var b = cc[k];
            cajas.push(x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
          }
        }
  }
  function mover(e, an, al) {
    var dx = e.vx, dy = e.vy, dz = e.vz;
    var bx0 = e.x - an, by0 = e.y, bz0 = e.z - an, bx1 = e.x + an, by1 = e.y + al, bz1 = e.z + an, i;
    choques(Math.min(bx0, bx0 + dx) - 0.001, Math.min(by0, by0 + dy) - 0.001, Math.min(bz0, bz0 + dz) - 0.001,
      Math.max(bx1, bx1 + dx) + 0.001, Math.max(by1, by1 + dy) + 0.001, Math.max(bz1, bz1 + dz) + 0.001);
    var ody = dy, odx = dx, odz = dz;
    for (i = 0; i < cajas.length; i += 6) {
      if (bx1 <= cajas[i] || bx0 >= cajas[i + 3] || bz1 <= cajas[i + 2] || bz0 >= cajas[i + 5]) continue;
      if (dy > 0 && by1 <= cajas[i + 1]) dy = Math.min(dy, cajas[i + 1] - by1);
      else if (dy < 0 && by0 >= cajas[i + 4]) dy = Math.max(dy, cajas[i + 4] - by0);
    }
    by0 += dy; by1 += dy;
    for (i = 0; i < cajas.length; i += 6) {
      if (by1 <= cajas[i + 1] || by0 >= cajas[i + 4] || bz1 <= cajas[i + 2] || bz0 >= cajas[i + 5]) continue;
      if (dx > 0 && bx1 <= cajas[i]) dx = Math.min(dx, cajas[i] - bx1);
      else if (dx < 0 && bx0 >= cajas[i + 3]) dx = Math.max(dx, cajas[i + 3] - bx0);
    }
    bx0 += dx; bx1 += dx;
    for (i = 0; i < cajas.length; i += 6) {
      if (by1 <= cajas[i + 1] || by0 >= cajas[i + 4] || bx1 <= cajas[i] || bx0 >= cajas[i + 3]) continue;
      if (dz > 0 && bz1 <= cajas[i + 2]) dz = Math.min(dz, cajas[i + 2] - bz1);
      else if (dz < 0 && bz0 >= cajas[i + 5]) dz = Math.max(dz, cajas[i + 5] - bz0);
    }
    e.x += dx; e.y += dy; e.z += dz;
    e.enPiso = ody < 0 && dy !== ody;
    if (dx !== odx) e.vx = 0;
    if (dz !== odz) e.vz = 0;
    if (dy !== ody) e.vy = 0;
  }
  // quedó adentro de un bloque (lo soltó un bloque que se puso encima): sale para arriba de a poco
  // (Entity.pushOutOfBlocks)
  function empujarAfuera(e) {
    var x = Math.floor(e.x), y = Math.floor(e.y + 0.1), z = Math.floor(e.z), b = Mundo.bloque(x, y, z);
    if (b > 0 && C.SOLIDO[b] && C.OPACO[b]) { e.vy = 0.1; e.y += 0.1; return true; }
    return false;
  }
  function resbala(e) {
    var b = Mundo.bloque(Math.floor(e.x), Math.floor(e.y - 0.05), Math.floor(e.z));
    // el hielo resbala (0,98), el bloque de slime (0,8), lo demás 0,6
    return (b === 79 || b === 174 || b === 207 ? 0.98 : b === 165 ? 0.8 : 0.6) * 0.98;
  }
  function liquido(e) {
    var b = Mundo.bloque(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z));
    return b === 8 || b === 9 ? 1 : b === 10 || b === 11 ? 2 : b === 51 ? 3 : 0;
  }

  // ------------------------------------------------------------------------------------------
  // Un paso (1/20 s). jug: { x, y, z, vivo }; o: { levantar(c) → cuántas no entraron, xp(n),
  // sonido(evento, vol, tono, x, y, z) }
  // ------------------------------------------------------------------------------------------
  var pasos = 0, esperaXp = 0;
  T.paso = function (jug, o) {
    pasos++;
    if (esperaXp > 0) esperaXp--;
    for (var i = lista.length - 1; i >= 0; i--) {
      var e = lista[i];
      if (e.borrar) continue;
      e.px = e.x; e.py = e.y; e.pz = e.z;
      // volando hacia el jugador que la levantó (EntityPickupFX): tres pasos y se va
      if (e.levantada !== undefined) {
        if (++e.levantada > 3) { lista.splice(i, 1); continue; }
        var f = e.levantada / 3;
        e.x += (jug.x - e.x) * f; e.y += (jug.y + 0.5 - e.y) * f; e.z += (jug.z - e.z) * f;
        continue;
      }
      if (!Mundo.cargado(e.x, e.z)) continue;
      if (e.espera > 0) e.espera--;
      var orbe = e.xp !== undefined, an = orbe ? ANCHO_ORBE / 2 : ANCHO_COSA, al = orbe ? ALTO_ORBE / 2 : ALTO_COSA;
      e.vy -= orbe ? 0.03 : 0.04;
      var liq = liquido(e);
      if (liq === 2 || liq === 3) {
        // la lava y el fuego queman las cosas (los orbes saltan)
        if (!orbe) { lista.splice(i, 1); if (o.sonido) o.sonido('random.fizz', 0.4, 2 + Math.random() * 0.4, e.x, e.y, e.z); continue; }
        e.vy = 0.2; e.vx = (Math.random() - Math.random()) * 0.2; e.vz = (Math.random() - Math.random()) * 0.2;
      } else if (liq === 1) {
        // en el agua flotan (como en la versión de bolsillo)
        e.vy += 0.05; if (e.vy > 0.06) e.vy = 0.06;
        e.vx *= 0.9; e.vz *= 0.9;
      }
      if (empujarAfuera(e)) continue;
      // los orbes van hacia el jugador cercano (más fuerte cuanto más cerca)
      if (orbe && jug.vivo) {
        var dx = (jug.x - e.x) / 8, dy = (jug.y + 1.62 - e.y) / 8, dz = (jug.z - e.z) / 8, d = Math.sqrt(dx * dx + dy * dy + dz * dz), q = 1 - d;
        if (q > 0 && d > 0) { q *= q; e.vx += dx / d * q * 0.1; e.vy += dy / d * q * 0.1; e.vz += dz / d * q * 0.1; }
      }
      mover(e, an, al);
      var roce = e.enPiso ? resbala(e) : 0.98;
      e.vx *= roce; e.vy *= 0.98; e.vz *= roce;
      if (e.enPiso) e.vy *= orbe ? -0.9 : -0.5;
      if (++e.edad >= 6000) { lista.splice(i, 1); continue; }
      if (orbe) e.color++;
      // juntarse con las iguales de al lado (cada 25 pasos o al cambiar de bloque)
      if (!orbe && (pasos % 25 === (i % 25) || Math.floor(e.px) !== Math.floor(e.x) || Math.floor(e.pz) !== Math.floor(e.z))) juntar(e);
      // levantar: la caja del jugador agrandada 1 de costado y 0,5 de alto
      if (!jug.vivo || e.espera > 0) continue;
      if (e.x + an < jug.x - 1.3 || e.x - an > jug.x + 1.3 || e.z + an < jug.z - 1.3 || e.z - an > jug.z + 1.3 ||
          e.y + al < jug.y - 0.5 || e.y > jug.y + 2.3) continue;
      if (orbe) {
        if (esperaXp > 0) continue;
        esperaXp = 2;
        if (o.xp) o.xp(e.xp);
        if (o.sonido) o.sonido('random.orb', 0.1, 0.5 * ((Math.random() - Math.random()) * 0.7 + 1.8));
        lista.splice(i, 1);
        continue;
      }
      var antes = e.c.n, sobra = o.levantar ? o.levantar(e.c) : antes;
      if (sobra >= antes) continue;
      if (o.sonido) o.sonido('random.pop', 0.2, ((Math.random() - Math.random()) * 0.7 + 1) * 2);
      if (sobra > 0) { e.c.n = sobra; continue; }
      e.levantada = 0;
    }
    // las que se juntaron con otra
    for (var k = lista.length - 1; k >= 0; k--) if (lista[k].borrar) lista.splice(k, 1);
  };
  function juntar(e) {
    var max = Inventario.pila(e.c);
    if (e.c.n >= max || e.c.d) return;
    for (var k = lista.length - 1; k >= 0; k--) {
      var o = lista[k];
      if (o === e || !o.c || o.borrar || o.levantada !== undefined || !Inventario.iguales(o.c, e.c)) continue;
      if (Math.abs(o.x - e.x) > 0.75 || Math.abs(o.z - e.z) > 0.75 || Math.abs(o.y - e.y) > 0.5) continue;
      var pasa = Math.min(max - e.c.n, o.c.n);
      if (pasa <= 0) return;
      e.c.n += pasa; o.c.n -= pasa;
      e.espera = Math.max(e.espera, o.espera); e.edad = Math.min(e.edad, o.edad);
      if (o.c.n <= 0) o.borrar = true;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Para guardar en el mundo (compacto) y para dibujar (interpolado)
  // ------------------------------------------------------------------------------------------
  T.guardar = function () {
    var r = [];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      if (e.levantada !== undefined) continue;
      r.push(e.c ? [e.c.id, e.c.m, e.c.n, e.c.d, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), e.edad] :
        [-1, e.xp, 0, 0, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), e.edad]);
    }
    return r;
  };
  T.cargar = function (g) {
    lista.length = 0;
    if (!Array.isArray(g)) return;
    g.forEach(function (a) {
      if (!Array.isArray(a)) return;
      if (a[0] === -1) nueva({ xp: a[1], x: a[4], y: a[5], z: a[6], vx: 0, vy: 0, vz: 0, espera: 0, edad: a[7], color: 0 });
      else nueva({ c: { id: a[0], m: a[1], n: a[2], d: a[3] }, x: a[4], y: a[5], z: a[6], vx: 0, vy: 0, vz: 0, espera: 0, edad: a[7] });
    });
  };
  // cuántas copias se dibujan según cuántas hay (RenderEntityItem: 1, 2, 3, 4 o 5)
  // (la TNT prendida usa la misma física: una caja de 0,98)
  T.mover = mover;
  T.copias = function (n) { return n > 48 ? 5 : n > 32 ? 4 : n > 16 ? 3 : n > 1 ? 2 : 1; };
  return T;
})();
