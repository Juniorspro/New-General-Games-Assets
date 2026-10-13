// porteo: comerciar con los aldeanos, con la pantalla de bolsillo de la 1.2 (trade_screen_pocket:
// el inventario a la izquierda; a la derecha las flechas para pasar las ofertas, lo que pide arriba
// de sus dos lugares y lo que da arriba del de salida). Las ofertas son las de su oficio en las
// tablas del behavior pack (trading/*_trades.json): empiezan con el primer nivel y cada vez que se
// usa por primera vez una del último nivel se abre el siguiente; cada oferta se puede usar 7 veces
// y después se tacha hasta que el aldeano se renueva (al comerciar otra cosa). Comerciar da
// experiencia ("reward_exp").
var Comercio = (function () {
  'use strict';
  var K = {}, tablas = {};
  K.preparar = function (t) { tablas = t || {}; };
  function rango(v) {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') { var a = v.min || 1, b = v.max === undefined ? a : v.max; return a + Math.floor(Math.random() * (b - a + 1)); }
    return 1;
  }
  // { item, quantity, functions } → una cosa (lo que no se conoce, nada)
  function cosa(x) {
    var id = Botin.numero(x.item), m = 0;
    if (id === undefined) return null;
    (x.functions || []).forEach(function (f) {
      var n = String(f.function || '').replace('minecraft:', '');
      if (n === 'set_data') m = f.data | 0;
      if (n === 'random_aux_value' && f.values) m = rango(f.values);
    });
    var n2 = Math.max(1, Math.min(Inventario.pila({ id: id, m: m }), rango(x.quantity)));
    return Inventario.cosa(id, m, n2);
  }
  function ofertasDe(tabla, nivel) {
    var t = tablas[tabla] || tablas['trading/' + String(tabla).split('/').pop()], tier = t && t.tiers ? t.tiers[nivel] : null, r = [];
    if (!tier) return r;
    (tier.trades || []).forEach(function (tr) {
      var pide = (tr.wants || []).map(cosa).filter(Boolean), da = cosa((tr.gives || [])[0] || {});
      if (!pide.length || !da) return;
      r.push({ pide: pide, da: da, usos: 0, max: 7, nivel: nivel, xp: tr.reward_exp !== false });
    });
    return r;
  }
  // el estado del aldeano (se arma la primera vez): su tabla, el nivel y las ofertas
  function estado(e, t) {
    if (!e.comercio) e.comercio = { tabla: t.table, nivel: 0, ofertas: ofertasDe(t.table, 0) };
    return e.comercio;
  }

  // ------------------------------------------------------------------------------------------
  // La pantalla
  // ------------------------------------------------------------------------------------------
  var G = null;      // lo de la página: inventario(), tirarObjeto(c), xp(n), sonar(e, ev), nombre(cosa), abrir(), cerrar()
  K.iniciar = function (g) { G = g; };
  K.abrir = function (e, t) {
    var est = estado(e, t);
    if (!est.ofertas.length) return;
    e.comerciando = true;
    G.sonar(e, 'haggle');
    Pantallas.ir('comercio', { e: e, t: t, est: est });
    G.abrir();
  };
  function ctrl(d) {
    var inv = G.inventario(), e = d.e, est = d.est, sel = 0, lugares = { a: [null], b: [null] };
    function oferta() { return est.ofertas[sel] || null; }
    // ¿lo puesto alcanza para la oferta? (cada lugar, lo suyo: el primero lo primero que pide)
    function alcanza(o) {
      if (!o || o.usos >= o.max) return false;
      var a = lugares.a[0], b = lugares.b[0];
      if (!a || !Inventario.iguales(a, o.pide[0]) && !(a.id === o.pide[0].id && a.m === o.pide[0].m) || a.n < o.pide[0].n) return false;
      if (o.pide[1]) { if (!b || b.id !== o.pide[1].id || b.m !== o.pide[1].m || b.n < o.pide[1].n) return false; }
      return true;
    }
    function lugar(col, i) {
      switch (col) {
        case 'combined_hotbar_and_inventory_items': return i < 9 ? [inv.barra, i] : i < 36 ? [inv.mochila, i - 9] : null;
        // (los lugares de la grilla de compra: su índice es su lugar en la grilla, no 0)
        case 'trade_ingredient1_items': return [lugares.a, 0];
        case 'trade_ingredient2_items': return oferta() && oferta().pide[1] ? [lugares.b, 0] : null;
      }
      return null;
    }
    function cosaEn(col, i) {
      var o = oferta();
      switch (col) {
        case 'trade_item_A': return o ? o.pide[0] : null;
        case 'trade_item_B': return o ? o.pide[1] || null : null;
        case 'sell_item': return o ? o.da : null;
        case 'trade_result_item': return alcanza(o) ? o.da : null;
      }
      var l = lugar(col, i);
      return l ? l[0][l[1]] : null;
    }
    function idAux(x) { return x ? x.id * 65536 + x.m : 0; }
    function cerrar() {
      [lugares.a, lugares.b].forEach(function (l) { if (l[0]) { if (Inventario.agregar(inv, l[0]) > 0) G.tirarObjeto(l[0]); l[0] = null; } });
      Inventario.devolver(inv, G.tirarObjeto);
      e.comerciando = false;
      G.cerrar();
    }
    // sacar lo que da: se cobra, se cuenta el uso, la experiencia y quizás el nivel siguiente
    function comprar() {
      var o = oferta();
      if (!alcanza(o)) return;
      var h = inv.mano;
      if (h && !(Inventario.iguales(h, o.da) && h.n + o.da.n <= Inventario.pila(h))) return;
      if (h) h.n += o.da.n; else inv.mano = Inventario.copia(o.da);
      lugares.a[0].n -= o.pide[0].n; if (lugares.a[0].n <= 0) lugares.a[0] = null;
      if (o.pide[1]) { lugares.b[0].n -= o.pide[1].n; if (lugares.b[0].n <= 0) lugares.b[0] = null; }
      var primera = o.usos === 0;
      o.usos++;
      if (o.xp) G.xp(3 + Math.floor(Math.random() * 4));
      G.sonar(e, 'accept');
      // la primera vez que se usa una del último nivel se abre el siguiente (y lo agotado se renueva)
      if (primera && o.nivel === est.nivel) {
        var nuevas = ofertasDe(est.tabla, est.nivel + 1);
        if (nuevas.length) { est.nivel++; est.ofertas = est.ofertas.concat(nuevas); }
      }
      est.ofertas.forEach(function (x) { if (x !== o && x.usos >= x.max) x.max += 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6); });
    }
    return {
      vars: { '$villager_name': Jui.t(d.t.display_name || 'entity.villager.name') },
      binding: function (n) {
        var h = inv.mano, o = oferta();
        switch (n) {
          case '#inventory_selected_item': return idAux(h);
          case '#inventory_selected_item_stack_count': return h && h.n > 1 ? String(h.n) : '';
          case '#hover_text': case '#selected_item_name': return h ? Objetos.nombre(h.id, h.m) : '';
          case '#progress_bar_visible': return Jui.progresoMantener() >= 0;
          case '#progress_bar_total_amount': return 1;
          case '#progress_bar_current_amount': return Math.max(0, Jui.progresoMantener());
          case '#show_second_trade_slot': return !!(o && o.pide[1]);
          case '#left_button_enabled': return sel > 0;
          case '#right_button_enabled': return sel < est.ofertas.length - 1;
          case '#cross_out_icon': return !!(o && o.usos >= o.max);
          case '#sell_item_name': return o ? Objetos.nombre(o.da.id, o.da.m) : '';
          case '#is_creative_mode': return G.creativo();
          case '#is_survival_mode': return !G.creativo();
        }
      },
      longitud: function (col) { return col === 'combined_hotbar_and_inventory_items' ? 36 : 1; },
      coleccion: function (col, i, n) {
        var x = cosaEn(col, i), dd = x && Items.def[x.id];
        switch (n) {
          case '#item_id_aux': return idAux(x);
          case '#show_item': return !!x;
          case '#collection_total_items': return col === 'combined_hotbar_and_inventory_items' ? 36 : 1;
          case '#inventory_stack_count': case '#stack_count': case '#item_stack_count': return x && x.n > 1 ? String(x.n) : '';
          case '#item_durability_visible': return !!(dd && dd.dur && x.d);
          case '#item_durability_total_amount': return dd && dd.dur ? dd.dur : 1;
          case '#item_durability_current_amount': return dd && dd.dur ? dd.dur - (x.d || 0) : 0;
          case '#hover_text': return x ? Objetos.nombre(x.id, x.m) : '';
          case '#inactive_item': return false;
          case '#container_item_background': case '#container_item_modifier': case '#item_custom_color': return 0;
        }
      },
      arrastrable: function (b) { var q = Jui.coleccionDe(b); return !!(q && cosaEn(q.col, q.i)); },
      boton: function (id, b) {
        if (id === 'button.menu_exit' || id === 'button.menu_cancel' || id === 'button.try_menu_exit') { cerrar(); return; }
        if (id === 'button.cycle_recipe_left') { if (sel > 0) sel--; return; }
        if (id === 'button.cycle_recipe_right') { if (sel < est.ofertas.length - 1) sel++; return; }
        var q = b ? Jui.coleccionDe(b) : null;
        if (!q) return;
        if (q.col === 'trade_result_item') { comprar(); return; }
        var l = lugar(q.col, q.i);
        if (!l) return;
        if (id === 'button.coalesce_stack') { Inventario.juntar(inv); return; }
        if (id === 'button.container_take_half_place_one') Inventario.mitad(inv, l[0], l[1]);
        else Inventario.tocar(inv, l[0], l[1]);
        if (q.col === 'combined_hotbar_and_inventory_items') G.inventarioCambio();
      }
    };
  }
  K.registrar = function () { Pantallas.registrar('comercio', 'trade.trade_screen', ctrl); };
  return K;
})();
