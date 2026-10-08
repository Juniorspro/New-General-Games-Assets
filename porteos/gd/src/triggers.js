'use strict';
// Los triggers: se activan cuando el jugador pasa su x (o los genera un spawn) y lo que
// hacen dura en el tiempo (segundos del nivel). Propiedades como las lee gdclone
// (src/level/trigger.rs): 10 duración, 51 grupo, 28/29 desplazamiento en unidades del juego…

GD.Triggers = class {
  constructor(juego) {
    this.juego = juego;
    const nivel = juego.nivel;
    // los grupos que se mueven (move, rotate, follow) no pueden quedar fijos en una sección
    this.gruposQueSeMueven = new Set();
    for (const o of nivel.objetos) {
      if (o.tipo !== 'trigger') continue;
      if (o.sub === 'mover' || o.sub === 'rotar' || o.sub === 'seguir' || o.sub === 'seguir_y') this.gruposQueSeMueven.add(+o.p[51] || 0);
    }
    this.reiniciar();
  }

  reiniciar() {
    this.acciones = [];
    this.alfa = new Map();          // grupo → {v, de, a, t, dur}
    this.apagados = new Set();      // grupos desactivados (toggle)
    this.items = new Map();
    this.esperandoConteo = [];
    this.alMorir = [];
    this.demorados = [];            // spawn con demora: {t, grupo}
    this.efectoEntrada = 'nada';
    this.estela = false;
    this.sacudida = null;
    this.jugadorOculto = false;
  }

  num(o, k, def) { const v = o.p[k]; return v === undefined || v === '' ? def : +v; }

  objetoActivo(o) {
    if (!this.apagados.size) return true;
    for (const g of o.grupos) if (this.apagados.has(g)) return false;
    return true;
  }

  alfaDeObjeto(o) {
    if (!this.alfa.size || !o.grupos.length) return 1;
    let a = 1;
    for (const g of o.grupos) { const e = this.alfa.get(g); if (e) a *= e.v; }
    return a;
  }

  activar(o) {
    if (!this.objetoActivo(o)) return;
    const j = this.juego;
    if (o.tipo === 'entrada') { this.efectoEntrada = o.sub; return; }
    const grupo = this.num(o, 51, 0);
    switch (o.sub) {
      case 'color': {
        const canal = o.def.canal ?? this.num(o, 23, 1);
        const destino = {
          rgb: [this.num(o, 7, 255) / 255, this.num(o, 8, 255) / 255, this.num(o, 9, 255) / 255],
          a: this.num(o, 35, 1), mezcla: o.p[17] === '1',
          jugador: o.p[15] === '1' ? 1 : o.p[16] === '1' ? 2 : 0,
          copia: this.num(o, 50, 0), hsv: o.p[49] ? GD.leerHSV(o.p[49]) : null, copiaOpacidad: o.p[60] === '1',
        };
        const dur = this.num(o, 10, 0.5);
        j.colores.cambiar(canal, destino, dur);
        if (canal === 1000 && o.p[14] === '1') j.colores.cambiar(1001, destino, dur);   // "tint ground"
        break;
      }
      case 'pulso': {
        const p = {
          objetivo: grupo, grupo: o.p[52] === '1',
          entra: Math.max(0, this.num(o, 45, 0)), queda: Math.max(0, this.num(o, 46, 0)), sale: Math.max(0, this.num(o, 47, 0)),
          base: o.p[65] === '1', detalle: o.p[66] === '1', exclusivo: o.p[86] === '1',
        };
        if (o.p[48] === '1') {
          p.hsv = GD.leerHSV(o.p[49] || '0a1a1a0a0');
          p.copia = this.num(o, 50, 0) || (p.grupo ? 0 : grupo);
        } else p.rgb = [this.num(o, 7, 255) / 255, this.num(o, 8, 255) / 255, this.num(o, 9, 255) / 255];
        j.colores.pulso(p);
        break;
      }
      case 'mover':
        this.acciones.push({ tipo: 'mover', grupo, t: 0, dur: Math.max(0, this.num(o, 10, 0.5)), k: 0,
                             dx: this.num(o, 28, 0), dy: this.num(o, 29, 0), curva: this.num(o, 30, 0), tasa: this.num(o, 85, 2),
                             fijaX: o.p[58] === '1', fijaY: o.p[59] === '1' });
        break;
      case 'rotar': {
        const grados = this.num(o, 68, 0) + this.num(o, 69, 0) * 360;
        this.acciones.push({ tipo: 'rotar', grupo, centro: this.num(o, 71, 0), t: 0, dur: Math.max(0, this.num(o, 10, 0.5)), k: 0,
                             grados, curva: this.num(o, 30, 0), tasa: this.num(o, 85, 2), fija: o.p[70] === '1' });
        break;
      }
      case 'seguir':
        this.acciones.push({ tipo: 'seguir', grupo, lider: this.num(o, 71, 0), t: 0, dur: Math.max(0, this.num(o, 10, 0.5)),
                             mx: this.num(o, 72, 1), my: this.num(o, 73, 1), ultimo: null });
        break;
      case 'alfa': {
        const actual = this.alfa.get(grupo);
        const de = actual ? actual.v : 1;
        const dur = Math.max(0, this.num(o, 10, 0.5));
        const a = this.num(o, 35, 1);
        this.alfa.set(grupo, { v: dur ? de : a, de, a, t: 0, dur });
        break;
      }
      case 'alternar':
        if (o.p[56] === '1') this.apagados.delete(grupo); else this.apagados.add(grupo);
        break;
      case 'generar': {
        const demora = Math.max(0, this.num(o, 63, 0));
        if (demora) this.demorados.push({ t: demora, grupo }); else this.generar(grupo);
        break;
      }
      case 'parar':
        this.acciones = this.acciones.filter((a) => a.grupo !== grupo);
        break;
      case 'sacudir':
        this.sacudida = { fuerza: this.num(o, 75, 1), intervalo: this.num(o, 84, 0), t: 0, dur: this.num(o, 10, 0.5), proximo: 0, dx: 0, dy: 0 };
        break;
      case 'recoger': {
        const item = this.num(o, 80, 0);
        this.items.set(item, (this.items.get(item) || 0) + this.num(o, 77, 0));
        this.revisarConteos();
        break;
      }
      case 'contar':
        this.esperandoConteo.push({ item: this.num(o, 80, 0), cuenta: this.num(o, 77, 0), grupo, activar: o.p[56] === '1', multi: o.p[104] === '1' });
        this.revisarConteos();
        break;
      case 'contar_ya': {
        const v = this.items.get(this.num(o, 80, 0)) || 0, c = this.num(o, 77, 0), cmp = this.num(o, 88, 0);
        if (cmp === 1 ? v > c : cmp === 2 ? v < c : v === c) this.encender(grupo, o.p[56] === '1');
        break;
      }
      case 'al_morir':
        this.alMorir.push({ grupo, activar: o.p[56] === '1' });
        break;
      case 'estela_si': this.estela = true; break;
      case 'estela_no': this.estela = false; break;
      case 'ocultar_jugador': this.jugadorOculto = true; break;
      case 'mostrar_jugador': this.jugadorOculto = false; break;
      default: break;     // animar, partículas, fondo con la música: sin efecto en el juego
    }
  }

  // toggle y spawn juntos: lo que hacen count, instant count y on death con "activar"
  encender(grupo, activar) {
    if (activar) { this.apagados.delete(grupo); this.generar(grupo); } else this.apagados.add(grupo);
  }

  generar(grupo) {
    const lista = this.juego.nivel.grupos.get(grupo);
    if (!lista) return;
    for (const o of lista) if (o.tipo === 'trigger' || o.tipo === 'entrada') this.activar(o);
  }

  revisarConteos() {
    this.esperandoConteo = this.esperandoConteo.filter((c) => {
      if ((this.items.get(c.item) || 0) !== c.cuenta) return true;
      this.encender(c.grupo, c.activar);
      return c.multi;
    });
  }

  murio() { for (const m of this.alMorir) this.encender(m.grupo, m.activar); }

  // ── un paso (dt en segundos) ─────────────────────────────────────────────
  paso(dt) {
    const j = this.juego;
    for (const d of this.demorados) d.t -= dt;
    if (this.demorados.length && this.demorados.some((d) => d.t <= 0)) {
      const listos = this.demorados.filter((d) => d.t <= 0);
      this.demorados = this.demorados.filter((d) => d.t > 0);
      for (const d of listos) this.generar(d.grupo);
    }
    for (const [g, e] of this.alfa) {
      if (e.t < e.dur) { e.t = Math.min(e.dur, e.t + dt); e.v = GD.mezclar(e.de, e.a, e.t / e.dur); }
    }
    if (this.sacudida) {
      const s = this.sacudida;
      s.t += dt;
      if (s.t >= s.dur) this.sacudida = null;
      else if (s.t >= s.proximo) { s.proximo = s.t + s.intervalo; s.dx = (Math.random() * 2 - 1) * s.fuerza; s.dy = (Math.random() * 2 - 1) * s.fuerza; }
    }
    if (!this.acciones.length) return;
    const jug = j.jugador;
    for (const a of this.acciones) {
      a.t = Math.min(a.dur, a.t + dt);
      const k = a.dur ? GD.curva(a.curva, a.t / a.dur, a.tasa) : 1;
      const lista = j.nivel.grupos.get(a.grupo);
      if (a.tipo === 'mover') {
        let dx = a.dx * (k - a.k), dy = a.dy * (k - a.k);
        if (a.fijaX) dx = jug.x - jug.xAnterior;
        if (a.fijaY) dy = jug.y - jug.yAnterior;
        a.k = k;
        if (lista && (dx || dy)) for (const o of lista) { o.x += dx; o.y += dy; }
      } else if (a.tipo === 'rotar') {
        const d = a.grados * (k - a.k);
        a.k = k;
        if (!lista || !d) continue;
        const c = a.centro && j.nivel.grupos.get(a.centro);
        const centro = c && c[0];
        const rad = d * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
        for (const o of lista) {
          if (centro && o !== centro) {
            const rx = o.x - centro.x, ry = o.y - centro.y;
            o.x = centro.x + rx * cos + ry * sin;      // grados de GD: horario
            o.y = centro.y - rx * sin + ry * cos;
          }
          if (!a.fija) o.rot += d;
        }
      } else if (a.tipo === 'seguir') {
        const l = j.nivel.grupos.get(a.lider);
        const lider = l && l[0];
        if (!lider || !lista) continue;
        if (a.ultimo) {
          const dx = (lider.x - a.ultimo[0]) * a.mx, dy = (lider.y - a.ultimo[1]) * a.my;
          if (dx || dy) for (const o of lista) { o.x += dx; o.y += dy; }
        }
        a.ultimo = [lider.x, lider.y];
      }
    }
    this.acciones = this.acciones.filter((a) => a.t < a.dur);
  }
};
