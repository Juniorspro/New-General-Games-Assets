'use strict';
// La partida (el PlayLayer del original): pasos de física a 240 por segundo, choques, el
// pasillo de los modos que vuelan, la cámara, los intentos y el final.

GD.MARGEN_SUBIDA = 10;      // collidedWithObjectInternal: cuánto puede "subirse" a un bloque
GD.MARGEN_VOLANDO = 6;

GD.Juego = class {
  constructor(nivel) {
    this.nivel = nivel;
    this.colores = new GD.Colores(nivel.colores);
    this.jugador = new GD.Jugador(false);
    this.jugador.alSaltar = () => this.emitir('salto');       // las estadísticas del final
    this.triggers = new GD.Triggers(this);
    // objetos que se mueven: van aparte, los demás quedan fijos en su sección
    const mueve = this.triggers.gruposQueSeMueven;
    this.dinamicos = nivel.objetos.filter((o) => o.tipo !== 'trigger' && o.tipo !== 'entrada' && o.grupos.some((g) => mueve.has(g)));
    for (const o of nivel.objetos) o.dinamico = false;
    for (const o of this.dinamicos) o.dinamico = true;
    this.secciones = nivel.secciones.map((s) => s.filter((o) => !o.dinamico));
    this.formas = new Map();       // forma de choque de los fijos, calculada una vez
    this.intento = 0;
    this.eventos = {};
    this.reiniciar();
  }

  on(nombre, fn) { this.eventos[nombre] = fn; }
  emitir(nombre, ...a) { const f = this.eventos[nombre]; if (f) f(...a); }

  reiniciar() {
    for (const o of this.dinamicos) { o.x = o.x0; o.y = o.y0; o.rot = o.rot0; }
    this.colores.reiniciar();
    this.triggers.reiniciar();
    const aj = this.nivel.ajustes;
    this.jugador.reiniciar(aj, 0, null);
    this.suelo = 0; this.techo = null; this.centro = 150;
    this.ponerPasillo(aj.modo, 0);
    this.jugador.y = this.jugador.invertido ? (this.techo ?? 300) - this.jugador.medio() : this.suelo + this.jugador.medio();
    this.jugador.enSuelo = !this.jugador.invertido;
    this.indiceTrigger = 0;
    this.usados = new Set();
    this.monedas = new Set();
    this.rotos = new Set();          // bloques rompibles que ya se rompieron
    this.muerto = false;
    this.completo = false;
    this.tiempo = 0;
    this.pasos = 0;
    this.espejo = false;
    this.intento++;
    this.camX = -1e9; this.camY = -90;
    this.mejorX = 0;
  }

  // Pasillo de nave/ovni/onda/swing (10 bloques) y de bola/araña (8), centrado en el portal y
  // ajustado a la grilla (PlayLayer::changeGameMode de OpenGD). Cubo y robot: sin techo.
  ponerPasillo(modo, portalY) {
    let alto = 0;
    if (modo === 'nave' || modo === 'ovni' || modo === 'onda' || modo === 'swing') alto = 300;
    else if (modo === 'bola' || modo === 'arana') alto = 240;
    if (!alto) { this.suelo = 0; this.techo = null; return; }
    let centro = portalY < alto / 2 + 30 ? alto / 2 : Math.floor(portalY / 30) * 30;
    centro = Math.max(alto / 2, centro);
    this.centro = centro;
    this.suelo = centro - alto / 2;
    this.techo = centro + alto / 2;
  }

  get progreso() { return GD.limitar(this.jugador.x / this.nivel.largo, 0, 1); }

  // ── pasos ────────────────────────────────────────────────────────────────
  paso() {
    if (this.muerto || this.completo) return;
    const j = this.jugador;
    const dt = 60 / GD.PASOS;
    if (j.pidioArana) { j.pidioArana = false; this.saltoArana(); }
    // la rampa en la que venía: el salto desde ella y la salida por arriba usan su velocidad
    const rampa = j.enRampa;
    j.rampaPrev = rampa;
    j.rampaAntes = rampa && rampa.pend * j.signo() > 0 ? rampa : null;
    j.enRampa = null;
    j.toco = false;
    j.paso(dt);
    this.colisiones();
    if (this.muerto) return;
    // Salir por arriba de una rampa que subía lanza al jugador con la velocidad vertical que
    // traía (m_slopeVelocity de la 2.2): así la bola cruza los huecos de Hexagon Force. Si en
    // este mismo paso se apoyó en otra cosa, no.
    if (j.rampaAntes && !j.enRampa && !j.toco) {
      const v = GD.velocidadRampa(j.rampaAntes, j);
      if (j.vy * j.signo() < v) j.vy = v * j.signo();
    }
    const ts = this.nivel.triggers;
    while (this.indiceTrigger < ts.length && ts[this.indiceTrigger].x <= j.x) this.triggers.activar(ts[this.indiceTrigger++]);
    this.triggers.paso(1 / GD.PASOS);
    this.colores.actualizar(1 / GD.PASOS);
    j.girar(dt);
    this.tiempo += 1 / GD.PASOS;
    this.pasos++;
    if (j.x > this.mejorX) this.mejorX = j.x;
    if (j.x >= this.nivel.largo) { this.completo = true; this.emitir('completo'); }
  }

  // ── choques ──────────────────────────────────────────────────────────────
  cerca(x0, x1) {
    const res = [];
    const s0 = Math.max(0, Math.floor(x0 / GD.SECCION)), s1 = Math.min(this.secciones.length - 1, Math.floor(x1 / GD.SECCION));
    for (let s = s0; s <= s1; s++) for (const o of this.secciones[s]) res.push(o);
    for (const o of this.dinamicos) if (o.x > x0 - 150 && o.x < x1 + 150) res.push(o);
    return res;
  }

  forma(o) {
    const hb = o.def.hitbox;
    if (!hb) return null;
    const fijo = !o.dinamico;
    if (fijo && this.formas.has(o)) return this.formas.get(o);
    const f = GD.formaDe(o, hb);
    if (fijo) this.formas.set(o, f);
    return f;
  }

  colisiones() {
    const j = this.jugador;
    // El piso y el techo primero, como PlayLayer::checkCollisions: un pad azul apoyado en el piso
    // da vuelta la gravedad en este paso, y si el piso se revisara después lo mataría ahí mismo.
    this.limites();
    if (this.muerto) return;
    let c = j.caja();
    const lista = this.cerca(c.x0 - 60, c.x1 + 60);
    const solidos = [], peligros = [];
    for (const o of lista) {
      if (!this.triggers.objetoActivo(o) || this.rotos.has(o)) continue;
      const t = o.tipo;
      if (t === 'deco') continue;
      const f = this.forma(o);
      if (!f) continue;
      if (t === 'solido' || t === 'rampa') { if (GD.toca(f, c)) solidos.push([o, f]); continue; }
      if (t === 'peligro') { peligros.push([o, f]); continue; }
      if (GD.toca(f, c)) this.tocar(o, f);
    }
    // Los sólidos, del más cercano al más lejano en la dirección de la gravedad, con las rampas
    // primero: mientras va por una rampa, los bloques que la tocan no lo frenan (GD los ignora,
    // boolE/boolG en collidedWithObjectInternal). Así el borde al final de una rampa no corta
    // el lanzamiento.
    if (solidos.length) {
      const esRampa = (o) => (o.tipo === 'rampa' ? 0 : 1);
      solidos.sort((a, b) => esRampa(a[0]) - esRampa(b[0]) || (j.invertido ? a[1].y0 - b[1].y0 : b[1].y1 - a[1].y1));
      for (const [o, f] of solidos) {
        if (this.muerto) return;
        const r = o.tipo === 'rampa' ? null : j.enRampa || j.rampaPrev;
        if (r && GD.cruzaRampa(f, r)) continue;
        if (GD.toca(f, j.caja())) this.resolverSolido(j, o, f);
      }
    }
    if (this.muerto) return;
    c = j.caja(j.modo === 'onda' ? 0.4 : 1);
    for (const [o, f] of peligros) {
      if (GD.toca(f, c, true)) { this.morir(o); return; }
    }
  }

  tocar(o, f) {
    const j = this.jugador;
    switch (o.tipo) {
      case 'portal':
        if (this.usados.has(o)) return;
        this.usados.add(o);
        this.portal(o);
        break;
      case 'velocidad':
        if (this.usados.has(o)) return;
        this.usados.add(o);
        j.ponerVelocidad(o.sub);
        break;
      case 'pad':
        if (this.usados.has(o)) return;
        this.usados.add(o);
        j.pad(o.sub);
        this.emitir('impulso', o);
        break;
      case 'orbe':
        if (this.usados.has(o) && o.p[99] !== '1') return;
        if (!(j.toqueNuevo && j.sosteniendo)) return;
        this.usados.add(o);
        j.toqueNuevo = false;
        j.orbe(o.sub, o);
        this.emitir('impulso', o);
        this.emitir('salto');
        break;
      case 'moneda':
        if (!this.monedas.has(o)) { this.monedas.add(o); this.emitir('moneda', o); }
        break;
      default: break;
    }
  }

  portal(o) {
    const j = this.jugador;
    switch (o.sub) {
      case 'gravedad_normal': j.invertirGravedad(false); break;
      case 'gravedad_invertida': j.invertirGravedad(true); break;
      case 'tamano_normal': j.mini = false; break;
      case 'tamano_mini': j.mini = true; break;
      case 'espejo_si': this.espejo = true; break;
      case 'espejo_no': this.espejo = false; break;
      case 'dual_si': case 'dual_no': break;           // el modo dual va en otra etapa
      default:
        j.cambiarModo(o.sub);
        this.ponerPasillo(o.sub, o.y);
        break;
    }
    this.emitir('portal', o);
  }

  // Sólidos (PlayerObject::collidedWithObjectInternal de la 2.2, sin plataformas ni bloques que
  // se mueven). Primero la cara de arriba del bloque: si el borde de abajo del jugador está a menos
  // del margen (ahora o en el paso anterior), se apoya, salvo que vaya subiendo. Después la de
  // abajo, que sólo cuenta con gravedad invertida o para los que vuelan y la bola. Si no, es un
  // choque de costado: mata cuando lo toca la caja interior (×0,3), y un bloque rompible se rompe.
  // La onda no se apoya nunca.
  resolverSolido(j, o, f) {
    if (o.tipo === 'rampa') return this.resolverRampa(j, o, f);
    const m = j.medio();
    const margen = j.volador ? GD.MARGEN_VOLANDO : GD.MARGEN_SUBIDA;
    const dy = j.y - j.yAnterior;
    const rompible = o.sub === 'rompible';
    const libre = j.volador || j.modo === 'bola';       // los que se apoyan en las dos caras
    if (j.modo !== 'onda') {
      const abajo = j.y - m;
      if (abajo + margen >= f.y1 || abajo + margen - dy >= f.y1) {
        if (j.invertido && j.modo === 'ovni' && rompible) { if (GD.toca(f, j.caja(0.3))) this.romper(o); return; }
        if (j.vy > 0) return;                            // se aleja del bloque: ni se apoya ni muere
        j.y = f.y1 + m;
        if (j.vy < 0) j.vy = 0;
        if (!j.invertido || libre) j.tocarSuelo();       // el cubo invertido sólo se golpea la cabeza
        return;
      }
      if (j.invertido || libre) {
        const arriba = j.y + m;
        if (arriba - margen <= f.y0 || arriba - margen - dy <= f.y0) {
          if (!j.invertido && j.modo === 'ovni' && rompible) { if (GD.toca(f, j.caja(0.3))) this.romper(o); return; }
          if (j.vy >= 0) {
            j.y = f.y0 - m;
            if (j.vy > 0) j.vy = 0;
            j.tocarSuelo();
            return;
          }
        }
      }
    }
    if (GD.toca(f, j.caja(0.3))) { if (rompible) this.romper(o); else this.morir(o); }
  }

  romper(o) {
    this.rotos.add(o);
    this.emitir('romper', o);
  }

  // Rampas: se camina sobre la hipotenusa; de costado o desde abajo mata igual que un bloque.
  resolverRampa(j, o, f) {
    const m = j.medio();
    const sube = f.normal[1] > 0;                       // la superficie mira para arriba
    const enX = (x) => GD.limitar(x, f.hx0, f.hx1);
    const superficie = (x) => f.ay + (enX(x) - f.ax) * f.pend;
    if (sube !== j.invertido) {
      // el rincón que toca primero: el de adelante si sube, el de atrás si baja
      const esq = (f.pend > 0) !== j.invertido ? j.x + m : j.x - m;
      const sy = superficie(esq);
      if (!j.invertido) {
        const abajo = j.y - m;
        if (abajo + GD.MARGEN_SUBIDA + Math.abs(f.pend) * 2 * m >= sy && (j.vy <= 0 || j.volador || abajo >= sy - 4)) {
          j.y = sy + m;
          if (j.vy < 0) j.vy = 0;
          j.tocarSuelo();
          j.enRampa = f;
          return;
        }
      } else {
        const arriba = j.y + m;
        if (arriba - GD.MARGEN_SUBIDA - Math.abs(f.pend) * 2 * m <= sy && (j.vy >= 0 || j.volador || arriba <= sy + 4)) {
          j.y = sy - m;
          if (j.vy > 0) j.vy = 0;
          j.tocarSuelo();
          j.enRampa = f;
          return;
        }
      }
    } else if (j.volador || j.modo === 'bola') {
      const esq = (f.pend > 0) !== j.invertido ? j.x - m : j.x + m;
      const sy = superficie(esq);
      if (!j.invertido && j.y + m - GD.MARGEN_VOLANDO <= sy + 2 * m) { j.y = Math.min(j.y, sy - m); if (j.vy > 0) j.vy = 0; return; }
      if (j.invertido && j.y - m + GD.MARGEN_VOLANDO >= sy - 2 * m) { j.y = Math.max(j.y, sy + m); if (j.vy < 0) j.vy = 0; return; }
    }
    if (GD.toca(f, j.caja(0.3), true)) this.morir(o);
  }

  limites() {
    const j = this.jugador, m = j.medio();
    if (j.y - m <= this.suelo) {
      if (j.invertido && this.techo === null && j.modo !== 'onda') { this.morir(null); return; }
      j.y = this.suelo + m;
      if (!j.invertido) j.tocarSuelo();
      if (j.vy < 0) j.vy = 0;
    }
    if (this.techo !== null && j.y + m >= this.techo) {
      j.y = this.techo - m;
      if (j.invertido) j.tocarSuelo();
      if (j.vy > 0) j.vy = 0;
    }
    if (this.techo === null && j.y > 1200) this.morir(null);
  }

  // Araña: se pega a la superficie de enfrente (spiderTestJump).
  saltoArana() {
    const j = this.jugador, m = j.medio();
    const arriba = !j.invertido;
    let destino = arriba ? (this.techo ?? 1200) : this.suelo;
    for (const o of this.cerca(j.x - m - 30, j.x + m + 30)) {
      if (o.tipo !== 'solido' || !this.triggers.objetoActivo(o) || this.rotos.has(o)) continue;
      const f = this.forma(o);
      if (!f || f.x1 <= j.x - m || f.x0 >= j.x + m) continue;
      if (arriba && f.y0 >= j.y + m - 1 && f.y0 < destino) destino = f.y0;
      if (!arriba && f.y1 <= j.y - m + 1 && f.y1 > destino) destino = f.y1;
    }
    j.invertirGravedad(arriba);
    j.y = arriba ? destino - m : destino + m;
    j.vy = 0;
    j.tocarSuelo();
    this.emitir('arana');
  }

  morir(o) {
    if (this.muerto || this.invencible) return;
    this.muerto = true;
    this.jugador.muerto = true;
    this.triggers.murio();
    this.emitir('muerte', o);
  }

  // ── guardar y volver (los puntos de control de práctica, y el bot de las pruebas) ──
  guardar() {
    const j = this.jugador, t = this.triggers, c = this.colores;
    const pos = new Float64Array(this.dinamicos.length * 3);
    this.dinamicos.forEach((o, i) => { pos[i * 3] = o.x; pos[i * 3 + 1] = o.y; pos[i * 3 + 2] = o.rot; });
    return {
      jugador: { ...j, dash: j.dash && { ...j.dash } },
      juego: { suelo: this.suelo, techo: this.techo, centro: this.centro, indiceTrigger: this.indiceTrigger,
               usados: new Set(this.usados), monedas: new Set(this.monedas), rotos: new Set(this.rotos),
               tiempo: this.tiempo, pasos: this.pasos,
               espejo: this.espejo, mejorX: this.mejorX },
      pos,
      triggers: { acciones: t.acciones.map((a) => ({ ...a, ultimo: a.ultimo && [...a.ultimo] })),
                  alfa: new Map([...t.alfa].map(([k, v]) => [k, { ...v }])), apagados: new Set(t.apagados),
                  items: new Map(t.items), esperandoConteo: t.esperandoConteo.map((x) => ({ ...x })),
                  alMorir: t.alMorir.slice(), demorados: t.demorados.map((x) => ({ ...x })), efectoEntrada: t.efectoEntrada,
                  estela: t.estela, sacudida: t.sacudida && { ...t.sacudida }, jugadorOculto: t.jugadorOculto },
      colores: { canales: new Map([...c.canales].map(([k, v]) => [k, { ...v, rgb: v.rgb.slice() }])),
                 fundidos: new Map([...c.fundidos].map(([k, v]) => [k, { ...v, de: v.de.slice() }])),
                 pulsos: c.pulsos.map((p) => ({ ...p })) },
    };
  }

  restaurar(s) {
    Object.assign(this.jugador, s.jugador, { dash: s.jugador.dash && { ...s.jugador.dash } });
    Object.assign(this, s.juego, { usados: new Set(s.juego.usados), monedas: new Set(s.juego.monedas), rotos: new Set(s.juego.rotos) });
    this.muerto = false; this.completo = false; this.jugador.muerto = false;
    this.dinamicos.forEach((o, i) => { o.x = s.pos[i * 3]; o.y = s.pos[i * 3 + 1]; o.rot = s.pos[i * 3 + 2]; });
    const t = this.triggers, T = s.triggers;
    t.acciones = T.acciones.map((a) => ({ ...a, ultimo: a.ultimo && [...a.ultimo] }));
    t.alfa = new Map([...T.alfa].map(([k, v]) => [k, { ...v }]));
    t.apagados = new Set(T.apagados); t.items = new Map(T.items);
    t.esperandoConteo = T.esperandoConteo.map((x) => ({ ...x })); t.alMorir = T.alMorir.slice();
    t.demorados = T.demorados.map((x) => ({ ...x }));
    Object.assign(t, { efectoEntrada: T.efectoEntrada, estela: T.estela, sacudida: T.sacudida && { ...T.sacudida }, jugadorOculto: T.jugadorOculto });
    const c = this.colores, C = s.colores;
    c.canales = new Map([...C.canales].map(([k, v]) => [k, { ...v, rgb: v.rgb.slice() }]));
    c.fundidos = new Map([...C.fundidos].map(([k, v]) => [k, { ...v, de: v.de.slice() }]));
    c.pulsos = C.pulsos.map((p) => ({ ...p }));
    c.memo.clear();
  }

  // ── cámara ───────────────────────────────────────────────────────────────
  // El jugador queda a la mitad del ancho menos 75; en altura la cámara lo sigue (cubo) o
  // se centra en el pasillo (los que vuelan).
  camara(ancho, dt) {
    const j = this.jugador;
    this.camX = j.x - (ancho / 2 - 75);
    let objetivo;
    if (this.techo !== null) objetivo = this.centro - GD.ALTO / 2;
    else {
      objetivo = this.camY;
      const enPantalla = j.y - this.camY;
      if (enPantalla > GD.ALTO - 90) objetivo = j.y - (GD.ALTO - 90);
      else if (enPantalla < 120) objetivo = j.y - 120;
      objetivo = Math.max(-90, objetivo);
      if (j.ultimoSueloY <= j.medio() + 1 && j.y < this.camY + GD.ALTO - 90) objetivo = -90;
    }
    const k = this.camY === -90 && objetivo === -90 ? 1 : Math.min(1, dt * 6);
    this.camY += (objetivo - this.camY) * k;
  }
};

// ── geometría ────────────────────────────────────────────────────────────
// Velocidad vertical al dejar una rampa que sube (collidedWithSlopeInternal de la 2.2): la de
// avanzar por la pendiente, aumentada según el ángulo, y un cuarto menos para la bola y los que
// vuelan.
GD.velocidadRampa = function (f, j) {
  const m = Math.abs(f.pend), ang = Math.atan(m);
  if (ang < 0.01) return 0;
  return Math.min(1.12 / ang, 1.54) * m * j.avance * j.velocidad * (j.volador || j.modo === 'bola' ? 0.75 : 1);
};

// La forma de choque de un objeto, con su escala, volteo y giro (los grados de GD son horarios).
GD.formaDe = function (o, hb) {
  const sx = o.sx, sy = o.sy, ax = Math.abs(sx), ay = Math.abs(sy);
  const rad = -(o.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const ox = (hb.x || 0) * sx, oy = (hb.y || 0) * sy;
  const cx = o.x + ox * cos - oy * sin, cy = o.y + ox * sin + oy * cos;
  if (hb.type === 'Circle') {
    const r = (hb.radius ?? hb.width / 2) * Math.max(ax, ay);     // object.json guarda "radius" en los círculos
    return { tipo: 'circulo', cx, cy, r, x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r };
  }
  const w = hb.width * ax / 2, h = hb.height * ay / 2;
  if (hb.type === 'Slope') {
    // rampa base: sube hacia la derecha (◢), sólida abajo de la hipotenusa
    const pts = [[-w, -h], [w, -h], [w, h]].map(([x, y]) => {
      x *= Math.sign(sx) || 1; y *= Math.sign(sy) || 1;
      return [o.x + x * cos - y * sin, o.y + x * sin + y * cos];
    });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    // la hipotenusa es el lado que no es horizontal ni vertical
    let a = pts[0], b = pts[2];
    for (const [p, q] of [[pts[0], pts[1]], [pts[1], pts[2]], [pts[2], pts[0]]]) {
      if (Math.abs(p[0] - q[0]) > 0.5 && Math.abs(p[1] - q[1]) > 0.5) { a = p; b = q; }
    }
    if (a[0] > b[0]) [a, b] = [b, a];
    const tercero = pts.find((p) => p !== a && p !== b);
    const pend = (b[1] - a[1]) / ((b[0] - a[0]) || 1e-6);
    // normal de la hipotenusa hacia afuera (lejos del tercer vértice)
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    if ((tercero[0] - a[0]) * nx + (tercero[1] - a[1]) * ny > 0) { nx = -nx; ny = -ny; }
    return { tipo: 'rampa', pts, ax: a[0], ay: a[1], hx0: a[0], hx1: b[0], pend, normal: [nx, ny],
             x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  const recto = Math.abs(((o.rot || 0) % 90 + 90) % 90) < 0.01;
  if (recto) {
    const gira = Math.abs(((o.rot || 0) % 180 + 180) % 180 - 90) < 0.01;
    const hw = gira ? h : w, hh = gira ? w : h;
    return { tipo: 'caja', x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
  }
  const pts = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { tipo: 'girada', pts, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

// ¿Un bloque toca la rampa (su rectángulo agrandado ×1,2 de ancho y ×1,1 de alto, como
// getObjectRect(1.2, 1.1))?
GD.cruzaRampa = function (f, r) {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, w = (r.x1 - r.x0) * 0.6, h = (r.y1 - r.y0) * 0.55;
  return f.x1 > cx - w && f.x0 < cx + w && f.y1 > cy - h && f.y0 < cy + h;
};

// ¿La forma toca la caja del jugador? (exacto: con giro, círculo y triángulo)
GD.toca = function (f, c, exacto) {
  if (f.x1 <= c.x0 || f.x0 >= c.x1 || f.y1 <= c.y0 || f.y0 >= c.y1) return false;
  if (f.tipo === 'caja') return true;
  if (f.tipo === 'circulo') {
    const px = GD.limitar(f.cx, c.x0, c.x1), py = GD.limitar(f.cy, c.y0, c.y1);
    return (px - f.cx) ** 2 + (py - f.cy) ** 2 < f.r * f.r;
  }
  if (!exacto && f.tipo === 'girada') return true;
  // separación de ejes: los de la caja y las normales de los lados del polígono
  const caja = [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1]];
  const ejes = [[1, 0], [0, 1]];
  for (let i = 0; i < f.pts.length; i++) {
    const p = f.pts[i], q = f.pts[(i + 1) % f.pts.length];
    ejes.push([-(q[1] - p[1]), q[0] - p[0]]);
  }
  for (const [ex, ey] of ejes) {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of f.pts) { const v = x * ex + y * ey; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
    for (const [x, y] of caja) { const v = x * ex + y * ey; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
};
