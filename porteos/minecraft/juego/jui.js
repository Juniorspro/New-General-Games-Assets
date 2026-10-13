// porteo: la interfaz de Minecraft PE 1.2 como la arma el juego. Sus 112 pantallas (título, Jugar,
// ajustes, pausa, inventario, el HUD...) están en ui/*.json y el juego las interpreta con su motor
// de interfaz (C++); acá se interpretan igual, para que salgan idénticas: plantillas con herencia
// ("boton@common_buttons.light_text_button"), variables ($), tamaños relativos ("100% - 4px",
// "100%c", "fill", "56.25%x"), anclas, capas, pilas, grillas con colecciones, botones,
// interruptores, deslizadores, campos de texto, paneles que se deslizan, "bindings" (lo que el
// código del juego le pasa a cada control) y animaciones. Lo que en el juego es código C++ (qué hace
// cada botón, de dónde salen los mundos de la lista) lo ponen los controladores (pantallas.js).
var Jui = (function () {
  'use strict';
  var J = {};
  var D = null;                       // interfaz.json
  var imgs = {};                      // archivo → Image
  var lang = {}, langEn = {};         // textos del idioma elegido (y el inglés si falta alguno)
  var indice = Object.create(null);   // "espacio.nombre" → { ns, def, base }
  var raiz = null;                    // variables globales y de plataforma
  J.escala = 2;                       // píxeles de pantalla por unidad de la interfaz
  J.renderers = {};                   // los controles "custom" (renderer → función)
  J.sonido = null;                    // (nombre) → suena (random.click de los botones)

  // ------------------------------------------------------------------------------------------
  // Definiciones y herencia
  // ------------------------------------------------------------------------------------------
  // cada lista de hijos recuerda en qué espacio está escrita: "x@base" sin espacio se busca ahí
  function anotar(def, ns) {
    if (!def || typeof def !== 'object' || Array.isArray(def)) return;
    var hs = def.controls;
    if (Array.isArray(hs)) {
      hs.ns = ns;
      for (var i = 0; i < hs.length; i++) for (var k in hs[i]) anotar(hs[i][k], ns);
    }
  }
  J.emoticonos = {};
  J.iniciar = function (datos, imagenes, plataforma) {
    J.emoticonos = datos.emoticonos || {};
    D = datos;
    imgs = imagenes;
    for (var ns in D.espacios) {
      var e = D.espacios[ns];
      for (var k in e) {
        var at = k.indexOf('@');
        var nombre = at < 0 ? k : k.slice(0, at);
        indice[ns + '.' + nombre] = { ns: ns, def: e[k], base: at < 0 ? null : k.slice(at + 1), cache: null };
        anotar(e[k], ns);
      }
    }
    raiz = Object.create(null);
    for (k in D.globales) raiz[k] = D.globales[k];
    for (k in plataforma) raiz[k] = plataforma[k];
  };
  J.variable = function (k, v) { raiz[k] = v; };
  // la definición tal cual está en el archivo (para agregarle controles antes de usarla)
  J.cruda = function (ns, nombre) { var e = indice[ns + '.' + nombre]; return e ? e.def : null; };
  // textos propios que se suman a los del juego ({ es: {clave: texto}, ... })
  J.textos = function (extra) {
    for (var l in extra) {
      if (!D.textos[l]) D.textos[l] = {};
      for (var k in extra[l]) D.textos[l][k] = extra[l][k];
    }
  };
  J.idioma = function (corto) {
    lang = (D.textos && D.textos[corto]) || {};
    langEn = (D.textos && D.textos.en) || {};
  };
  J.t = function (k) {
    if (typeof k !== 'string') return k === undefined || k === null ? '' : String(k);
    var v = lang[k];
    if (v === undefined) v = langEn[k];
    return v === undefined ? k : v;
  };
  J.existe = function (ref) { return !!indice[ref]; };

  function mezclar(b, d) {
    var r = {}, k;
    for (k in b) r[k] = b[k];
    for (k in d) r[k] = d[k];
    return r;
  }
  function refDe(base, ns) { return base.indexOf('.') < 0 ? ns + '.' + base : base; }
  // ¿la cadena de herencia tiene alguna base que es una variable? (no se puede guardar resuelta)
  function dinamica(e, prof) {
    if (e.din !== undefined) return e.din;
    var r = false;
    if (e.base) {
      if (e.base.charCodeAt(0) === 36) r = true;
      else {
        var b = indice[refDe(e.base, e.ns)];
        r = !!(b && prof < 40 && dinamica(b, prof + 1));
      }
    }
    e.din = r;
    return r;
  }
  // "espacio.nombre" → la definición con toda su herencia (lo de la base y encima lo propio)
  function definicionDe(ref, s, prof) {
    var e = indice[ref];
    if (!e) return null;
    if (e.cache) return e.cache;
    var d = e.def;
    if (e.base && (prof || 0) < 40) {
      var base = e.base;
      if (base.charCodeAt(0) === 36) base = s ? s[base] : undefined;
      if (typeof base === 'string' && base) {
        var b = definicionDe(refDe(base.charAt(0) === '@' ? base.slice(1) : base, e.ns), s, (prof || 0) + 1);
        if (b) d = mezclar(b, d);
      }
    }
    if (!dinamica(e, 0)) e.cache = d;
    return d;
  }
  J.definicion = function (ref) { return definicionDe(ref, raiz, 0); };

  // ------------------------------------------------------------------------------------------
  // Variables y expresiones
  // ------------------------------------------------------------------------------------------
  // un valor de la definición con sus variables puestas ("$texto" → lo que valga en este lugar)
  function valor(v, s) {
    if (typeof v === 'string') {
      var c0 = v.charCodeAt(0);
      if (c0 === 36) return s[v];
      // "($dropdown_name + '_toggle')": las expresiones con variables se calculan acá (las que
      // miran "#propiedades" se calculan al pedir el binding)
      if (c0 === 40 && v.indexOf('$') > 0 && !propSuelta(v)) return evaluar(v, s, null);
      return v;
    }
    if (Array.isArray(v)) {
      var a = new Array(v.length);
      for (var i = 0; i < v.length; i++) a[i] = valor(v[i], s);
      return a;
    }
    if (v && typeof v === 'object') {
      var o = {};
      for (var k in v) o[k] = valor(v[k], s);
      return o;
    }
    return v;
  }
  // ¿tiene un "#propiedad" fuera de las comillas?
  function propSuelta(t) {
    var q = 0;
    for (var i = 0; i < t.length; i++) {
      var ch = t.charCodeAt(i);
      if (ch === 39 || ch === 34) q = q ? 0 : ch;
      else if (ch === 35 && !q) return true;
    }
    return false;
  }
  // expresiones: "(not $a and ($b = default))", "(#collection_length > 0)"
  var cacheExpr = Object.create(null);
  var TOKEN = /\s*(\(|\)|'[^']*'|"[^"]*"|<=|>=|!=|<>|==|=|<|>|\+|-|\*|\/|%|[$#]?[A-Za-z_][\w.:]*|\d+(?:\.\d+)?)/y;
  function tokens(t) {
    var l = [], m;
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < t.length && (m = TOKEN.exec(t))) l.push(m[1]);
    return l;
  }
  function compilar(t) {
    var tk = tokens(t), i = 0;
    function ver() { return tk[i]; }
    function comer() { return tk[i++]; }
    function o() {
      var a = y();
      while (ver() === 'or') { comer(); a = ['or', a, y()]; }
      return a;
    }
    function y() {
      var a = no();
      while (ver() === 'and') { comer(); a = ['and', a, no()]; }
      return a;
    }
    function no() {
      if (ver() === 'not') { comer(); return ['not', no()]; }
      return cmp();
    }
    function cmp() {
      var a = suma(), op = ver();
      if (op === '=' || op === '==' || op === '!=' || op === '<>' || op === '<' || op === '>' || op === '<=' || op === '>=') {
        comer();
        a = [op, a, suma()];
      }
      return a;
    }
    function suma() {
      var a = mult();
      while (ver() === '+' || ver() === '-') { var op = comer(); a = [op, a, mult()]; }
      return a;
    }
    function mult() {
      var a = unario();
      while (ver() === '*' || ver() === '/' || ver() === '%') { var op = comer(); a = [op, a, unario()]; }
      return a;
    }
    function unario() {
      if (ver() === '-') { comer(); return ['neg', unario()]; }
      return prim();
    }
    function prim() {
      var x = comer();
      if (x === undefined) return ['lit', undefined];
      if (x === '(') { var a = o(); if (ver() === ')') comer(); return a; }
      if (/^\d/.test(x)) return ['lit', parseFloat(x)];
      if (x.charAt(0) === "'" || x.charAt(0) === '"') return ['lit', x.slice(1, -1)];
      if (x === 'true') return ['lit', true];
      if (x === 'false') return ['lit', false];
      if (x.charAt(0) === '$') return ['var', x];
      if (x.charAt(0) === '#') return ['prop', x];
      return ['lit', x];
    }
    return o();
  }
  function evaluarArbol(a, s, b) {
    switch (a[0]) {
      case 'lit': return a[1];
      case 'var': return s ? s[a[1]] : undefined;
      case 'prop': return b ? b[a[1]] : undefined;
      case 'not': return !verdad(evaluarArbol(a[1], s, b));
      case 'and': return verdad(evaluarArbol(a[1], s, b)) && verdad(evaluarArbol(a[2], s, b));
      case 'or': return verdad(evaluarArbol(a[1], s, b)) || verdad(evaluarArbol(a[2], s, b));
      case 'neg': return -num(evaluarArbol(a[1], s, b));
    }
    var x = evaluarArbol(a[1], s, b), w = evaluarArbol(a[2], s, b);
    switch (a[0]) {
      case '=': case '==': return igual(x, w);
      case '!=': case '<>': return !igual(x, w);
      case '<': return num(x) < num(w);
      case '>': return num(x) > num(w);
      case '<=': return num(x) <= num(w);
      case '>=': return num(x) >= num(w);
      case '+': return (typeof x === 'string' || typeof w === 'string') ? String(x === undefined ? '' : x) + String(w === undefined ? '' : w) : num(x) + num(w);
      case '-': return num(x) - num(w);
      case '*': return num(x) * num(w);
      case '/': return num(w) ? num(x) / num(w) : 0;
      case '%': return num(w) ? num(x) % num(w) : 0;
    }
    return undefined;
  }
  function num(x) { return typeof x === 'number' ? x : typeof x === 'boolean' ? (x ? 1 : 0) : (parseFloat(x) || 0); }
  function igual(x, w) {
    if (x === undefined || x === null) x = '';
    if (w === undefined || w === null) w = '';
    if (typeof x === 'boolean' || typeof w === 'boolean') return verdad(x) === verdad(w);
    return String(x) === String(w);
  }
  function verdad(x) {
    if (typeof x === 'string') return x !== '' && x !== 'false' && x !== '0';
    return !!x;
  }
  function evaluar(t, s, b) {
    var a = cacheExpr[t] || (cacheExpr[t] = compilar(t));
    return evaluarArbol(a, s, b);
  }
  J.evaluar = evaluar;
  // un valor que es condición: true/false, "$variable" o "(expresión)"
  function condicion(v, s, b) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v !== 'string') return !!v;
    var c = v.charCodeAt(0);
    if (c === 36) return verdad(s[v]);
    if (c === 40) return verdad(evaluar(v, s, b));
    if (c === 35) return verdad(b ? b[v] : undefined);
    return verdad(v);
  }

  // las variables de un control: primero las propias, después las condicionales ("variables" con
  // "requires"), al final las "|default" (sólo si nadie más arriba las puso)
  function aplicarVariables(def, s) {
    var defs = null, k;
    for (k in def) {
      if (k.charCodeAt(0) !== 36) continue;
      if (k.indexOf('|') > 0) { (defs || (defs = [])).push(k); continue; }
      s[k] = valor(def[k], s);
    }
    var vs = def.variables;
    if (vs) {
      if (!Array.isArray(vs)) vs = [vs];
      for (var i = 0; i < vs.length; i++) {
        var e = vs[i];
        if (!e || (e.requires !== undefined && !condicion(e.requires, s))) continue;
        for (k in e) if (k.charCodeAt(0) === 36) {
          var bar = k.indexOf('|');
          if (bar > 0) { var n0 = k.slice(0, bar); if (s[n0] === undefined) s[n0] = valor(e[k], s); }
          else s[k] = valor(e[k], s);
        }
      }
    }
    if (defs) for (var j = 0; j < defs.length; j++) {
      var n = defs[j].slice(0, defs[j].indexOf('|'));
      if (s[n] === undefined) s[n] = valor(def[defs[j]], s);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Controles
  // ------------------------------------------------------------------------------------------
  // los que se ven: los que tienen dibujo propio
  var DIBUJABLES = { image: 1, label: 1, custom: 1 };
  var uid = 0;
  // un control desde "nombre@base" + lo que le cambia quien lo pone
  function crearControl(nombre, base, over, ns, sp, padre) {
    var def;
    if (base) {
      var b = base;
      if (b.charCodeAt(0) === 36) b = sp[b];
      if (typeof b !== 'string' || !b) return null;
      if (b.charAt(0) === '@') b = b.slice(1);
      var bd = definicionDe(refDe(b, ns), sp, 0);
      if (!bd) return null;
      def = over && Object.keys(over).length ? mezclar(bd, over) : bd;
      var eb = indice[refDe(b, ns)];
      ns = eb ? eb.ns : ns;
    } else def = over || {};
    var s = Object.create(sp);
    aplicarVariables(def, s);
    if (def.ignored !== undefined && condicion(valor(def.ignored, s), s)) return null;
    if (nombre && nombre.charCodeAt(0) === 36) nombre = s[nombre] || nombre;
    var c = {
      id: ++uid, n: nombre || '', base: base || '', d: def, s: s, ns: ns, padre: padre, hijos: [], b: Object.create(null),
      t: valor(def.type, s) || 'panel', p: {}, x: 0, y: 0, w: 0, h: 0, ver: true
    };
    var p = c.p;
    for (var k in def) {
      if (k === 'controls' || k === 'variables' || k.charCodeAt(0) === 36) continue;
      p[k] = valor(def[k], s);
    }
    if (p.property_bag && typeof p.property_bag === 'object') for (k in p.property_bag) c.b[k] = p.property_bag[k];
    if (padre) { c.indice = padre.indice; c.col = padre.col; c.pantalla = padre.pantalla; }
    if (c.t === 'toggle') iniciarInterruptor(c);
    if (c.t === 'slider') c.valor = 0;
    if (c.t === 'scroll_view') c.desp = 0;
    if (c.t === 'edit_box') c.texto = '';
    // los hijos pueden venir en una variable ("controls": "$radio_buttons")
    var hs = def.controls;
    if (typeof hs === 'string' && hs.charCodeAt(0) === 36) hs = s[hs];
    // una grilla sin plantilla trae sus elementos escritos (la armadura, la salida de fabricar)
    if (Array.isArray(hs) && (c.t !== 'grid' || !p.grid_item_template)) crearHijos(c, hs);
    if (p.anims) iniciarAnimaciones(c);
    // "uv": "@animación" (un flip_book que mueve el pedazo de la textura)
    if (typeof p.uv === 'string' && p.uv.charAt(0) === '@') {
      var au = animDe(p.uv, c.ns);
      if (au) (c.anims || (c.anims = [])).push({ a: au, t0: performance.now(), ns: c.ns, s: c.s });
    }
    return c;
  }
  function crearHijos(c, lista) {
    var ns = lista.ns || c.ns;
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      for (var k in e) {
        // el nombre puede venir de una variable con su herencia: "$button_layout" →
        // "@disconnect.button_panel" (el botón de "desconectado"), "$icon_image_ref" → "icon@..."
        var clave = k;
        if (clave.charCodeAt(0) === 36 && typeof c.s[clave] === 'string' && c.s[clave].indexOf('@') >= 0) clave = c.s[clave];
        var at = clave.indexOf('@');
        var h = crearControl(at < 0 ? clave : clave.slice(0, at), at < 0 ? null : clave.slice(at + 1), e[k], ns, c.s, c);
        if (h) c.hijos.push(h);
      }
    }
  }
  function buscar(c, nombre) {
    if (c.n === nombre) return c;
    for (var i = 0; i < c.hijos.length; i++) {
      var r = buscar(c.hijos[i], nombre);
      if (r) return r;
    }
    return null;
  }
  J.buscar = buscar;
  // el control "nombre" más cercano: entre los hermanos y sus descendientes, y si no, subiendo
  function cercano(c, nombre) {
    for (var q = c.padre; q; q = q.padre) {
      var r = buscar(q, nombre);
      if (r) return r;
    }
    return null;
  }

  // ------------------------------------------------------------------------------------------
  // Pantallas
  // ------------------------------------------------------------------------------------------
  var pila = [];
  J.pila = pila;
  // abre una pantalla del juego ("start.start_screen") con su controlador encima de las otras
  // una pantalla que no va en la pila: el HUD del juego, que se dibuja debajo de todo
  J.suelta = function (ref, ctrl, extra) { return nueva(ref, ctrl, extra); };
  J.abrir = function (ref, ctrl, extra) {
    var pan = nueva(ref, ctrl, extra);
    if (!pan) return null;
    pila.push(pan);
    if (pan.ctrl.abierta) pan.ctrl.abierta(pan);
    J.sucio();
    return pan;
  };
  function nueva(ref, ctrl, extra) {
    var e = indice[ref];
    if (!e) { console.warn('jui: no existe ' + ref); return null; }
    var vars = Object.create(raiz);
    if (extra) for (var k in extra) vars[k] = extra[k];
    var pan = { ref: ref, ctrl: ctrl || {}, raiz: null, sucio: true, grupos: {}, anims: [], creada: performance.now() };
    var r = { pantalla: pan };
    var c = crearControl(ref.slice(ref.indexOf('.') + 1), ref, null, e.ns, vars, r);
    if (!c) return null;
    c.padre = null;
    pan.raiz = c;
    marcarPantalla(c, pan);
    return pan;
  }
  function marcarPantalla(c, pan) {
    c.pantalla = pan;
    for (var i = 0; i < c.hijos.length; i++) marcarPantalla(c.hijos[i], pan);
  }
  J.cerrar = function (pan) {
    var i = pan ? pila.indexOf(pan) : pila.length - 1;
    if (i < 0) return;
    var p = pila.splice(i, 1)[0];
    if (p.ctrl.cerrada) p.ctrl.cerrada(p);
    soltar();
    J.sucio();
  };
  J.arriba = function () { return pila[pila.length - 1] || null; };
  J.vaciar = function () { while (pila.length) J.cerrar(); };
  // una pantalla nueva en lugar de la de arriba
  J.cambiar = function (ref, ctrl, extra) {
    if (pila.length) J.cerrar();
    return J.abrir(ref, ctrl, extra);
  };
  // un control dentro de una "factory" (los carteles emergentes de base_screen, los mensajes del chat)
  // la "factory" por su nombre: un control "type": "factory" o uno con "factory": { "name": ... }.
  // Si hay varias (el HUD tiene la barra dos veces: la centrada y la de bolsillo), la que se ve
  function buscarFabrica(c, nombre, l) {
    var todas = l || [];
    if (c.n === nombre || (c.p.factory && c.p.factory.name === nombre)) todas.push(c);
    for (var i = 0; i < c.hijos.length; i++) buscarFabrica(c.hijos[i], nombre, todas);
    if (l) return null;
    for (var k = 0; k < todas.length; k++) {
      var q = todas[k];
      while (q && q.ver !== false) q = q.padre;
      if (!q) return todas[k];
    }
    return todas[0] || null;
  }
  J.fabricar = function (pan, nombreFabrica, idControl, vars) {
    var f = buscarFabrica(pan.raiz, nombreFabrica);
    if (!f) return null;
    var ids = f.p.control_ids || (f.p.factory && f.p.factory.control_ids) || {};
    var ref = ids[idControl] || (f.p.factory && f.p.factory.control_name) || idControl;
    if (typeof ref !== 'string') return null;
    // "@base" o "nombre@base" (los renglones del chat: "chat_item@hud.chat_grid_item")
    var nombre = idControl, arroba = ref.indexOf('@');
    if (arroba === 0) ref = ref.slice(1);
    else if (arroba > 0) { nombre = ref.slice(0, arroba); ref = ref.slice(arroba + 1); }
    var s = Object.create(f.s);
    if (vars) for (var k in vars) s[k] = vars[k];
    var h = crearControl(nombre, ref, null, f.ns, s, f);
    if (!h) return null;
    marcarPantalla(h, pan);
    f.hijos.push(h);
    J.sucio();
    return h;
  };
  J.quitar = function (c) {
    if (!c || !c.padre) return;
    var i = c.padre.hijos.indexOf(c);
    if (i >= 0) c.padre.hijos.splice(i, 1);
    J.sucio();
  };

  // ------------------------------------------------------------------------------------------
  // Bindings: lo que el código del juego le dice a cada control
  // ------------------------------------------------------------------------------------------
  // (en el juego la mayoría se piden cada cuadro: acá también, pero sólo en lo que se ve)
  function ctrlDe(c) { return c.pantalla ? c.pantalla.ctrl : null; }
  function pedir(c, nombre) {
    var k = ctrlDe(c);
    if (!k) return undefined;
    if (k.binding) { var v = k.binding(nombre, c); if (v !== undefined) return v; }
    return k[nombre];
  }
  // la colección y el lugar de un control que está en una grilla: { col, i } o null
  J.coleccionDe = function (c) {
    for (var q = c; q; q = q.padre) if (q.itemDe !== undefined) return { col: q.itemDe, i: q.indice };
    return null;
  };
  function pedirColeccion(c, col, nombre) {
    var k = ctrlDe(c), i = indiceEn(c, col);
    if (!k || !k.coleccion || i < 0) return undefined;
    return k.coleccion(col, i, nombre, c);
  }
  // el índice dentro de la colección (el elemento de la grilla que lo contiene)
  function indiceEn(c, col) {
    for (var q = c; q; q = q.padre) if (q.itemDe !== undefined && (!col || q.itemDe === col)) return q.indice;
    return c.indice === undefined ? -1 : c.indice;
  }
  function aplicarBindings(c) {
    var bs = c.p.bindings;
    if (!bs || !bs.length) return;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (!b) continue;
      var tipo = b.binding_type || 'global';
      if (tipo === 'none' || (typeof tipo === 'string' && tipo.charCodeAt(0) === 36)) continue;
      if (b.binding_condition === 'once' && c.yaUna && c.yaUna[i]) continue;
      var nombre = b.binding_name, destino = b.binding_name_override || nombre, v;
      if (tipo === 'global') {
        if (!nombre || typeof nombre !== 'string' || nombre.charAt(0) !== '#') continue;
        v = pedir(c, nombre);
        if (v === undefined) continue;
      } else if (tipo === 'collection') {
        if (!nombre || typeof nombre !== 'string' || nombre.charAt(0) !== '#') continue;
        v = pedirColeccion(c, b.binding_collection_name, nombre);
        if (v === undefined) continue;
      } else if (tipo === 'collection_details') {
        continue;
      } else if (tipo === 'view') {
        var fuente = b.source_control_name ? (b.resolve_sibling_scope ? cercano(c, b.source_control_name) : (cercano(c, b.source_control_name))) : c;
        if (!fuente) continue;
        var prop = b.source_property_name;
        if (typeof prop !== 'string') continue;
        if (prop.charAt(0) === '(') v = evaluar(prop, fuente.s, fuente.b);
        else v = fuente.b[prop];
        destino = b.target_property_name;
        if (v === undefined || !destino) continue;
      } else continue;
      if (typeof destino === 'string' && destino.charAt(0) === '#') c.b[destino] = v;
      if (b.binding_condition === 'once') (c.yaUna || (c.yaUna = {}))[i] = true;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Tamaños: "100% - 4px", "100%c", "50%x", "default", "fill"
  // ------------------------------------------------------------------------------------------
  var cacheTam = Object.create(null);
  // → [porcentaje del padre, % de los hijos, % del ancho propio, % del alto propio, px, default, fill]
  function tamExpr(v) {
    if (typeof v === 'number') return [0, 0, 0, 0, v, 0, 0];
    if (typeof v !== 'string') return [100, 0, 0, 0, 0, 0, 0];
    var e = cacheTam[v];
    if (e) return e;
    e = [0, 0, 0, 0, 0, 0, 0];
    var t = v.replace(/\s+/g, '');
    if (t.indexOf('default') >= 0) { e[5] = 1; t = t.replace('default', ''); }
    if (t.indexOf('fill') >= 0) { e[6] = 1; t = t.replace('fill', ''); }
    var re = /([+-]?)(\d+(?:\.\d+)?)(%cm|%sm|%c|c%|%x|%y|%|px)?/g, m;
    while ((m = re.exec(t))) {
      var n = parseFloat(m[2]) * (m[1] === '-' ? -1 : 1), u = m[3] || 'px';
      if (u === '%') e[0] += n;
      else if (u === '%c' || u === 'c%' || u === '%cm' || u === '%sm') e[1] += n;
      else if (u === '%x') e[2] += n;
      else if (u === '%y') e[3] += n;
      else e[4] += n;
    }
    cacheTam[v] = e;
    return e;
  }
  function par(v, defX, defY) {
    if (Array.isArray(v)) return [v[0] === undefined ? defX : v[0], v[1] === undefined ? defY : v[1]];
    if (v === undefined || v === null) return [defX, defY];
    return [v, v];
  }
  // el tamaño de un control que no dice "size": una etiqueta mide su texto; una pila mide lo que
  // sus hijos en su eje (la lista de la izquierda de los ajustes son pilas sin tamaño dentro de un
  // contenido "100%c": si llenaran al padre se pisarían), salvo que tenga un hijo "fill", que
  // necesita el lugar del padre para repartir; lo demás llena al padre
  function tamDe(c) {
    // una grilla sin tamaño mide lo que sus elementos (la barra rápida del HUD: 9 casillas de 20×22
    // adentro de una pila que se mide por sus hijos)
    if (c.t === 'grid' && c.p.size === undefined && c.dims && !c.dims.porAncho) return ['100%c', '100%c'];
    if (c.t === 'label') return par(c.p.size, 'default', 'default');
    if (c.t === 'stack_panel') {
      var horiz = c.p.orientation === 'horizontal', eje = '100%c';
      for (var i = 0; i < c.hijos.length; i++) {
        var hs = c.hijos[i].p.size;
        var v = Array.isArray(hs) ? hs[horiz ? 0 : 1] : hs;
        if (typeof v === 'string' && v.indexOf('fill') >= 0) { eje = '100%'; break; }
      }
      return par(c.p.size, horiz ? eje : '100%', horiz ? '100%' : eje);
    }
    var sz = par(c.p.size, '100%', '100%');
    // un elemento de grilla "default" ocupa su celda (los de skins y de NPC tienen sólo hijos en %)
    if (c.padre && c.padre.t === 'grid') sz = [sz[0] === 'default' ? '100%' : sz[0], sz[1] === 'default' ? '100%' : sz[1]];
    return sz;
  }
  function ancla(a) {
    switch (a) {
      case 'top_left': return [0, 0];
      case 'top_middle': return [0.5, 0];
      case 'top_right': return [1, 0];
      case 'left_middle': return [0, 0.5];
      case 'right_middle': return [1, 0.5];
      case 'bottom_left': return [0, 1];
      case 'bottom_middle': return [0.5, 1];
      case 'bottom_right': return [1, 1];
    }
    return [0.5, 0.5];
  }

  // ------------------------------------------------------------------------------------------
  // Visibilidad y estado
  // ------------------------------------------------------------------------------------------
  function visible(c) {
    // lo que diga un binding manda sobre el "visible" escrito (las pestañas del inventario arrancan
    // con "visible": false y las muestra su interruptor)
    if (c.b['#visible'] !== undefined) return verdad(c.b['#visible']);
    if (c.p.visible !== undefined && !condicion(c.p.visible, c.s, c.b)) return false;
    return true;
  }
  function habilitado(c) {
    if (c.p.enabled !== undefined && !condicion(c.p.enabled, c.s, c.b)) return false;
    if (c.b['#enabled'] !== undefined && !verdad(c.b['#enabled'])) return false;
    return true;
  }
  // los hijos de estado de botones e interruptores: se ve sólo el del estado actual
  function nombreEstado(c) {
    var p = c.p;
    if (c.t === 'slider' || c.t === 'slider_box') {
      var lks = !habilitado(c.t === 'slider_box' && c.padre ? c.padre : c);
      if (lks && p.locked_control) return p.locked_control;
      if ((c.t === 'slider' ? c.encima : c.padre && c.padre.encima) && p.hover_control) return p.hover_control;
      return p.default_control || 'default';
    }
    if (c.t === 'button') {
      var lk = !habilitado(c);
      if (lk && p.locked_control) return p.locked_control;
      if (c.apretado && c.encima) return p.pressed_control || 'pressed';
      if (c.encima && !lk) return p.hover_control || 'hover';
      return p.default_control || 'default';
    }
    if (c.t === 'toggle') {
      var m = !!c.b['#toggle_state'], bloq = !habilitado(c), h = !!(c.encima && !bloq);
      var nom = (m ? 'checked' : 'unchecked') + (bloq ? '_locked' : '') + (h ? '_hover' : '');
      return p[nom + '_control'] || nom;
    }
    return null;
  }
  function esEstado(c, h) {
    // ¿h es uno de los hijos de estado de c (y no el actual)?
    var p = c.p;
    if (c.t === 'button' || c.t === 'slider' || c.t === 'slider_box') return h.n === p.default_control || h.n === p.hover_control || h.n === p.pressed_control || (p.locked_control && h.n === p.locked_control);
    if (c.t === 'toggle') return h.n === p.checked_control || h.n === p.unchecked_control || h.n === p.checked_hover_control ||
      h.n === p.unchecked_hover_control || h.n === p.checked_locked_control || h.n === p.unchecked_locked_control ||
      h.n === p.checked_locked_hover_control || h.n === p.unchecked_locked_hover_control;
    return false;
  }

  // ------------------------------------------------------------------------------------------
  // Interruptores (toggle) y grupos de radio
  // ------------------------------------------------------------------------------------------
  function iniciarInterruptor(c) {
    var p = c.p;
    c.b['#toggle_state'] = !!p.toggle_default_state;
  }
  function grupo(c) {
    var p = c.p;
    if (!p.radio_toggle_group || !p.toggle_name || !c.pantalla) return null;
    var g = c.pantalla.grupos[p.toggle_name];
    if (!g) g = c.pantalla.grupos[p.toggle_name] = { miembros: [], elegido: -1, iniciado: false };
    return g;
  }
  // el índice de un interruptor en su grupo: el forzado, el de la colección o el orden
  function indiceEnGrupo(c, g) {
    var f = c.p.toggle_group_forced_index;
    if (typeof f === 'number' && f >= 0) return f;
    if (c.indice !== undefined && c.p.toggle_grid_collection_name) return c.indice;
    var i = g.miembros.indexOf(c);
    return i < 0 ? g.miembros.length : i;
  }
  J.elegirEnGrupo = function (pan, nombre, i) {
    var g = pan.grupos[nombre];
    if (!g) return;
    g.elegido = i;
    for (var k = 0; k < g.miembros.length; k++) g.miembros[k].b['#toggle_state'] = indiceEnGrupo(g.miembros[k], g) === i;
    J.sucio();
  };
  function registrarGrupos(c) {
    // en cada armado se juntan los interruptores de cada grupo (los de las grillas cambian)
    if (c.t === 'toggle') {
      var g = grupo(c);
      if (g && g.miembros.indexOf(c) < 0) g.miembros.push(c);
    }
    for (var i = 0; i < c.hijos.length; i++) registrarGrupos(c.hijos[i]);
  }
  function iniciarGrupos(pan) {
    for (var n in pan.grupos) {
      var g = pan.grupos[n];
      g.miembros = g.miembros.filter(function (m) { return enArbol(m, pan.raiz); });
      if (!g.iniciado && g.miembros.length) {
        g.iniciado = true;
        var k = pan.ctrl, ini;
        if (k && k.grupoInicial) ini = k.grupoInicial(n);
        if (ini === undefined) {
          var m0 = g.miembros[0], d = m0.p.toggle_group_default_selected;
          ini = typeof d === 'number' ? d : 0;
        }
        g.elegido = ini;
      }
      // (los que tienen binding de estado, después los pisa lo que diga el código del juego)
      for (var j = 0; j < g.miembros.length; j++) {
        var m = g.miembros[j];
        m.b['#toggle_state'] = indiceEnGrupo(m, g) === g.elegido;
      }
    }
  }
  function enArbol(c, r) {
    for (var q = c; q; q = q.padre) if (q === r) return true;
    return false;
  }

  // ------------------------------------------------------------------------------------------
  // Grillas: tantos elementos como diga la colección
  // ------------------------------------------------------------------------------------------
  function dimensionesGrilla(c) {
    var p = c.p, dims = null, n;
    if (p.grid_dimension_binding) {
      var v = c.b[p.grid_dimension_binding];
      if (v === undefined) v = pedir(c, p.grid_dimension_binding);
      if (Array.isArray(v)) dims = [v[0] | 0, v[1] | 0];
      else if (typeof v === 'number') n = v;
    }
    if (!dims && p.collection_name) {
      var k = ctrlDe(c);
      if (k && k.longitud) { var l = k.longitud(p.collection_name, c); if (typeof l === 'number') n = l; }
    }
    if (!dims) {
      var gd = Array.isArray(p.grid_dimensions) ? p.grid_dimensions : null;
      if (n !== undefined) {
        if (gd && p.grid_rescaling_type === 'horizontal') dims = [Math.ceil(n / Math.max(1, gd[1])), gd[1]];
        else if (gd) dims = [gd[0], Math.ceil(n / Math.max(1, gd[0]))];
        // sin dimensiones y "horizontal": tantas columnas como entren a lo ancho (las grillas del
        // inventario); se cuentan al armarla, cuando se sabe el ancho
        else if (p.grid_rescaling_type === 'horizontal') return { col: 0, fil: 0, n: Math.max(0, n), porAncho: true };
        else dims = [1, n];
      } else dims = gd ? [gd[0] | 0, gd[1] | 0] : [0, 0];
    }
    var max = p.maximum_grid_items;
    var total = dims[0] * dims[1];
    if (n !== undefined && n < total) total = n;
    if (typeof max === 'number' && max > 0 && total > max) total = max;
    return { col: Math.max(0, dims[0]), fil: Math.max(0, dims[1]), n: Math.max(0, total) };
  }
  function armarGrilla(c) {
    var d = dimensionesGrilla(c);
    c.dims = d;
    c.b['#collection_length'] = d.n;
    if (typeof c.p.grid_item_template !== 'string') {
      var t = null;
      // los elementos escritos: su lugar en la colección es el de su "grid_position" (o su orden)
      if (!c.indizada) {
        c.indizada = true;
        var cols = Math.max(1, d.col || 1);
        for (var e = 0; e < c.hijos.length; e++) {
          var he = c.hijos[e], gp = he.p.grid_position, ie = Array.isArray(gp) ? gp[1] * cols + gp[0] : e;
          if (Array.isArray(gp) && d.col === 1) ie = gp[1];
          he.itemDe = c.p.collection_name || '';
          propagarIndice(he, ie, he.itemDe);
          he.indice = ie;
        }
      }
      return;
    }
    if (c.hijos.length === d.n && c.plantilla === c.p.grid_item_template) return;
    c.plantilla = c.p.grid_item_template;
    t = c.plantilla;
    if (t.charAt(0) === '@') t = t.slice(1);
    var nuevos = [];
    for (var i = 0; i < d.n; i++) {
      var h = c.hijos[i];
      if (!h) {
        var s = Object.create(c.s);
        h = crearControl('grid_item_' + i, t, null, c.ns, s, c);
        if (!h) continue;
        h.indice = i;
        h.itemDe = c.p.collection_name || '';
        propagarIndice(h, i, h.itemDe);
        marcarPantalla(h, c.pantalla);
      }
      nuevos.push(h);
    }
    c.hijos = nuevos;
  }
  function propagarIndice(c, i, col) {
    c.indice = i;
    if (c.col === undefined) c.col = col;
    for (var k = 0; k < c.hijos.length; k++) propagarIndice(c.hijos[k], i, col);
  }

  // ------------------------------------------------------------------------------------------
  // Texto (la fuente default8 del juego; lo que no está, con la del navegador)
  // ------------------------------------------------------------------------------------------
  var MAPA = 'ÀÁÂÈÊËÍÓÔÕÚßãõğİıŒœŞşŴŵžȇ\u0000\u0000\u0000\u0000\u0000\u0000\u0000 !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u0000ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»';
  var anchoLetra = new Uint8Array(256), letra = Object.create(null), fuente = null, celda = 8;
  var fuentesColor = Object.create(null);
  J.fuente = function (im) {
    var c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    var d = x.getImageData(0, 0, c.width, c.height).data;
    celda = im.width / 16;
    for (var i = 0; i < 256; i++) {
      var cx = (i & 15) * celda, cy = (i >> 4) * celda, ancho = 0;
      for (var col = celda - 1; col >= 0 && !ancho; col--)
        for (var f = 0; f < celda; f++) if (d[((cy + f) * c.width + cx + col) * 4 + 3] > 0) { ancho = col + 1; break; }
      anchoLetra[i] = ancho;
    }
    for (i = 0; i < MAPA.length; i++) if (MAPA[i] !== '\u0000') letra[MAPA[i]] = i;
    anchoLetra[32] = 3;
    fuente = c;
    fuentesColor = Object.create(null);
  };
  function fuenteDe(color) {
    var f = fuentesColor[color];
    if (f) return f;
    var c = document.createElement('canvas');
    c.width = fuente.width; c.height = fuente.height;
    var x = c.getContext('2d');
    x.drawImage(fuente, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return (fuentesColor[color] = c);
  }
  // las páginas de íconos de la fuente (U+E000..U+E1FF: botones táctiles, de mando, la comida...):
  // van en el texto como un carácter más, con su color propio y sin sombra
  var glifos = {}, anchoGlifo = {};
  J.glifos = function (paginas) {
    for (var pg in paginas) {
      var im = paginas[pg];
      if (!im) continue;
      var c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      var x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      var d = x.getImageData(0, 0, c.width, c.height).data, cel = im.width / 16, base = +pg << 8;
      for (var i = 0; i < 256; i++) {
        var cx = (i & 15) * cel, cy = (i >> 4) * cel, ancho = 0;
        for (var col = cel - 1; col >= 0 && !ancho; col--)
          for (var f = 0; f < cel; f++) if (d[((cy + f) * c.width + cx + col) * 4 + 3] > 0) { ancho = col + 1; break; }
        if (ancho) anchoGlifo[base + i] = ancho * 8 / cel;
      }
      glifos[pg] = { img: c, cel: cel };
    }
  };
  function glifoDe(ch) {
    var cp = ch.charCodeAt(0);
    if (cp < 0xE000 || cp > 0xE1FF || !anchoGlifo[cp]) return null;
    return glifos[cp >> 8];
  }
  var lienzoMedida = null;
  function anchoAjeno(ch) {
    if (!lienzoMedida) lienzoMedida = document.createElement('canvas').getContext('2d');
    lienzoMedida.font = '8px sans-serif';
    return Math.ceil(lienzoMedida.measureText(ch).width) + 1;
  }
  // ancho de un texto en unidades de la interfaz (a escala 1), sin los códigos de color §
  function anchoTexto(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '§') { i++; continue; }
      var k = letra[ch];
      if (k === undefined && glifoDe(ch)) { w += anchoGlifo[ch.charCodeAt(0)] + 1; continue; }
      w += k === undefined ? anchoAjeno(ch) : anchoLetra[k] + 1;
    }
    return w;
  }
  J.anchoTexto = anchoTexto;
  var COLORES = { '0': '#000000', '1': '#0000aa', '2': '#00aa00', '3': '#00aaaa', '4': '#aa0000', '5': '#aa00aa', '6': '#ffaa00',
    '7': '#aaaaaa', '8': '#555555', '9': '#5555ff', a: '#55ff55', b: '#55ffff', c: '#ff5555', d: '#ff55ff', e: '#ffff55', f: '#ffffff' };
  // partir en líneas que entren en "ancho" (por palabras, y una palabra larga por letras)
  function lineas(s, ancho) {
    var res = [], partes = String(s).split('\n');
    for (var p = 0; p < partes.length; p++) {
      var pal = partes[p].split(' '), act = '';
      for (var i = 0; i < pal.length; i++) {
        var prueba = act ? act + ' ' + pal[i] : pal[i];
        if (ancho > 0 && anchoTexto(prueba) > ancho && act) { res.push(act); act = pal[i]; }
        else act = prueba;
        while (ancho > 0 && anchoTexto(act) > ancho && act.length > 1) {
          var corte = act.length - 1;
          while (corte > 1 && anchoTexto(act.slice(0, corte)) > ancho) corte--;
          res.push(act.slice(0, corte));
          act = act.slice(corte);
        }
      }
      res.push(act);
    }
    return res;
  }
  J.lineas = lineas;
  function colorCss(c, alfa) {
    if (typeof c === 'string') return c;
    if (!Array.isArray(c)) return '#ffffff';
    var r = Math.round(Math.max(0, Math.min(1, c[0])) * 255), g = Math.round(Math.max(0, Math.min(1, c[1])) * 255), b = Math.round(Math.max(0, Math.min(1, c[2])) * 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  J.colorCss = colorCss;
  function sombraDe(css) {
    var n = parseInt(css.slice(1), 16);
    var r = (n >> 16) >> 2, g = ((n >> 8) & 255) >> 2, b = (n & 255) >> 2;
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  // escribe una línea; x, y en píxeles de pantalla, k = píxeles por píxel de la fuente
  function escribir(ctx, s, x, y, k, css, sombra) {
    if (!fuente) return;
    var actual = css;
    if (sombra) escribirSin(ctx, s, x + k, y + k, k, sombraDe(css), true);
    escribirSin(ctx, s, x, y, k, actual, false);
  }
  function escribirSin(ctx, s, x, y, k, css, esSombra) {
    var col = css;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '§') {
        var cod = (s[i + 1] || '').toLowerCase();
        if (COLORES[cod]) col = esSombra ? sombraDe(COLORES[cod]) : COLORES[cod];
        else if (cod === 'r') col = css;
        i++;
        continue;
      }
      var g = letra[ch];
      var gl = g === undefined ? glifoDe(ch) : null;
      if (gl) {
        var cp = ch.charCodeAt(0), q = cp & 255;
        if (!esSombra) ctx.drawImage(gl.img, (q & 15) * gl.cel, (q >> 4) * gl.cel, anchoGlifo[cp] * gl.cel / 8, gl.cel,
          Math.round(x), Math.round(y), Math.round(anchoGlifo[cp] * k), Math.round(8 * k));
        x += (anchoGlifo[cp] + 1) * k;
        continue;
      }
      if (g === undefined) {
        ctx.font = 'bold ' + Math.round(8 * k) + 'px sans-serif';
        ctx.fillStyle = col; ctx.textBaseline = 'top';
        ctx.fillText(ch, Math.round(x), Math.round(y - k * 0.5));
        x += anchoAjeno(ch) * k;
        continue;
      }
      if (g !== 32) {
        var f = fuenteDe(col);
        ctx.drawImage(f, (g & 15) * celda, (g >> 4) * celda, anchoLetra[g], celda,
          Math.round(x), Math.round(y), Math.round(anchoLetra[g] * k * 8 / celda), Math.round(8 * k));
      }
      x += (anchoLetra[g] + 1) * k * 8 / celda;
    }
  }
  J.escribir = function (ctx, s, x, y, k, color, sombra) { escribir(ctx, s, x, y, k, colorCss(color), sombra); };
  var ESCALA_FUENTE = { small: 0.5, normal: 1, medium: 1, large: 2, extra_large: 4 };
  function escalaFuente(c) {
    var k = ESCALA_FUENTE[c.p.font_size] || 1;
    if (typeof c.p.font_scale_factor === 'number') k *= c.p.font_scale_factor;
    return k;
  }
  // el texto de una etiqueta, traducido y con sus "#propiedades"
  // una "#propiedad" del control o, si no la tiene, de los de afuera (el texto de los botones de un
  // cartel lo pone el juego en el cartel)
  function propiedad(c, k) {
    for (var q = c; q; q = q.padre) if (q.b[k] !== undefined) return q.b[k];
    return undefined;
  }
  function textoDe(c) {
    var t = c.p.text;
    if (typeof t === 'string' && t.charAt(0) === '#') t = propiedad(c, t);
    if (t === undefined || t === null) return '';
    if (typeof t !== 'string') t = String(t);
    if (c.p.localize !== false) t = J.t(t);
    return t;
  }

  // ------------------------------------------------------------------------------------------
  // Armado (tamaños y posiciones), en unidades de la interfaz
  // ------------------------------------------------------------------------------------------
  var pantallaW = 320, pantallaH = 180;
  function tamTextura(c) {
    var tex = c.b['#texture'] !== undefined ? c.b['#texture'] : c.p.texture;
    var t = tex && D.texturas[tex];
    if (!t) return [0, 0];
    var uv = c.p.uv_size;
    if (Array.isArray(uv)) return [uv[0], uv[1]];
    if (Array.isArray(t[6])) return [t[6][0], t[6][1]];
    return [t[3], t[4]];
  }
  // lo que mide un control por su contenido (texto o textura), para "default"
  function propio(c, anchoDisp) {
    if (c.t === 'label') {
      var k = escalaFuente(c), txt = textoDe(c);
      // una etiqueta de alto fijo de una línea no parte el texto: lo que no entra sobresale (el
      // "Fabricación" arriba de la grilla de 2x2)
      var ey = tamExpr(tamDe(c)[1]), unaLinea = !ey[0] && !ey[1] && !ey[5] && !ey[6] && ey[4] > 0 && ey[4] < 18;
      var ls = lineas(txt, anchoDisp > 0 && !unaLinea ? anchoDisp / k : 0), w = 0;
      for (var i = 0; i < ls.length; i++) w = Math.max(w, anchoTexto(ls[i]));
      var lp = typeof c.p.line_padding === 'number' ? c.p.line_padding : 0;
      c.lineas = ls;
      return [w * k, (ls.length * 9 + Math.max(0, ls.length - 1) * lp) * k - (txt ? 1 : 0) * 0];
    }
    if (c.t === 'image') return tamTextura(c);
    return null;
  }
  function armar(c, pw, ph) {
    var p = c.p;
    if (c.t === 'grid') armarGrilla(c);
    var vis = c.ver;
    var sz = tamDe(c);
    var ex = tamExpr(sz[0]), ey = tamExpr(sz[1]);
    var maxS = p.max_size ? par(p.max_size, '100%', '100%') : null, minS = p.min_size ? par(p.min_size, 0, 0) : null;
    // mientras el padre se mide por sus hijos ("100%c") todavía no tiene tamaño: un máximo en % de él
    // no limita (el "Atrás" del chat: una etiqueta "default" con máximo "100%" adentro de un "100%c")
    var midiendo = c.padre && c.padre.midiendo;
    var sinMaxX = !!(midiendo && midiendo[0] && maxS && tamExpr(maxS[0])[0]), sinMaxY = !!(midiendo && midiendo[1] && maxS && tamExpr(maxS[1])[0]);
    var mx = maxS && !sinMaxX ? limite(tamExpr(maxS[0]), pw, ph, 0, 0, undefined, Infinity) : Infinity;
    var w = ex[0] * pw / 100 + ex[4], h = ey[0] * ph / 100 + ey[4];
    // "fill" es lo que sobra en una pila; fuera de una pila no ocupa nada (la columna de botones de
    // la pausa cuelga de un panel así, anclado al centro)
    if (ex[6]) w += c.llenoW !== undefined ? c.llenoW : 0;
    if (ey[6]) h += c.llenoH !== undefined ? c.llenoH : 0;
    var conTexto = c.t === 'label';
    if (ex[5] || ey[5] || conTexto) {
      // una etiqueta de ancho "default" mide su texto en una línea (sólo parte con "max_size": las de
      // "Entrada" y "Combustible" del horno sobresalen de su casillero, como en el juego)
      var disp = ex[5] ? (conTexto ? mx : Math.min(mx, pw)) : w;
      var pr = propio(c, conTexto ? disp : 0);
      if (pr) {
        if (ex[5]) w += pr[0];
        if (ey[5]) {
          if (conTexto && !ex[5]) { pr = propio(c, w); }
          h += pr[1];
        }
      }
    }
    if (ex[2]) w += ex[2] * h / 100;
    if (ey[3]) h += ey[3] * w / 100;
    if (ey[2]) h += ey[2] * w / 100;
    if (ex[3]) w += ex[3] * h / 100;
    var porHijos = ex[1] || ey[1] || ((ex[5] || ey[5]) && !conTexto && c.t !== 'image');
    if (porHijos) {
      c.midiendo = [!!(ex[1] || ex[5]), !!(ey[1] || ey[5])];
      armarHijos(c, w, h);
      c.midiendo = null;
      var ext = extension(c);
      if (ex[1]) w += ex[1] * ext[0] / 100;
      if (ey[1]) h += ey[1] * ext[1] / 100;
      if (ex[5] && c.t !== 'image' && !conTexto) w += ext[0];
      if (ey[5] && c.t !== 'image' && !conTexto) h += ext[1];
      if (ex[2] && ey[1]) w = ex[0] * pw / 100 + ex[4] + ex[2] * h / 100;
      if (ey[3] && ex[1]) h = ey[0] * ph / 100 + ey[4] + ey[3] * w / 100;
    }
    // los límites con "%c" (lo que miden los hijos) necesitan a los hijos armados
    var extL = null;
    // (una etiqueta no tiene hijos: su "100%c" es "lo que mida el texto", no limita)
    if (c.t !== 'label' && ((maxS && (tamExpr(maxS[0])[1] || tamExpr(maxS[1])[1])) || (minS && (tamExpr(minS[0])[1] || tamExpr(minS[1])[1])))) {
      if (!porHijos) armarHijos(c, w, h);
      extL = extension(c);
    }
    if (maxS) {
      var mxw = sinMaxX ? Infinity : limite(tamExpr(maxS[0]), pw, ph, w, h, extL && extL[0], Infinity);
      var mxh = sinMaxY ? Infinity : limite(tamExpr(maxS[1]), pw, ph, w, h, extL && extL[1], Infinity);
      if (w > mxw) w = mxw;
      if (h > mxh) h = mxh;
    }
    if (minS) {
      var mnw = limite(tamExpr(minS[0]), pw, ph, w, h, extL && extL[0], 0), mnh = limite(tamExpr(minS[1]), pw, ph, w, h, extL && extL[1], 0);
      if (w < mnw) w = mnw;
      if (h < mnh) h = mnh;
    }
    c.w = Math.max(0, w); c.h = Math.max(0, h);
    if (conTexto && ex[5] && c.lineas) {
      // la etiqueta quedó más angosta que el texto: se vuelve a partir
      var maxL = 0;
      for (var i = 0; i < c.lineas.length; i++) maxL = Math.max(maxL, anchoTexto(c.lineas[i]) * escalaFuente(c));
      if (maxL > c.w + 0.01) propio(c, c.w);
    } else if (conTexto) propio(c, c.w);
    if (!porHijos || true) armarHijos(c, c.w, c.h);
    return vis;
  }
  // un tamaño máximo o mínimo. "100%c" en un límite es "lo que mida su contenido": no limita (el
  // botón que se ajusta a su texto le pone eso a la etiqueta)
  function limite(e, pw, ph, w, h, ext, sinHijos) {
    if (e[1]) {
      if (typeof ext !== 'number') return sinHijos === undefined ? Infinity : sinHijos;
      return e[1] * ext / 100 + e[0] * pw / 100 + e[4] + e[2] * w / 100 + e[3] * h / 100;
    }
    return e[0] * pw / 100 + e[4] + e[2] * w / 100 + e[3] * h / 100 + (e[6] ? pw : 0) + (e[5] ? w : 0);
  }
  // lo que ocupan los hijos (para "100%c")
  function extension(c) {
    var w = 0, h = 0, hs = c.hijos;
    if (c.t === 'stack_panel') {
      var horiz = c.p.orientation === 'horizontal';
      for (var i = 0; i < hs.length; i++) {
        if (!hs[i].ver) continue;
        if (horiz) { w += hs[i].w; h = Math.max(h, hs[i].h); } else { h += hs[i].h; w = Math.max(w, hs[i].w); }
      }
      return [w, h];
    }
    if (c.t === 'grid' && c.dims) {
      var cw = 0, ch = 0;
      for (var j = 0; j < hs.length; j++) { cw = Math.max(cw, hs[j].w); ch = Math.max(ch, hs[j].h); }
      return [cw * c.dims.col, ch * c.dims.fil];
    }
    for (var k = 0; k < hs.length; k++) {
      if (!hs[k].ver || esEstado(c, hs[k]) && hs[k].n !== nombreEstado(c)) continue;
      w = Math.max(w, hs[k].w); h = Math.max(h, hs[k].h);
    }
    return [w, h];
  }
  function offsetDe(c, pw, ph) {
    var o = c.p.offset;
    if (c.animOffset) o = c.animOffset;
    if (!o) return [0, 0];
    var oo = par(o, 0, 0), ex = tamExpr(oo[0]), ey = tamExpr(oo[1]);
    return [ex[0] * pw / 100 + ex[4] + ex[2] * c.w / 100 + ex[3] * c.h / 100, ey[0] * ph / 100 + ey[4] + ey[3] * c.h / 100 + ey[2] * c.w / 100];
  }
  function armarHijos(c, w, h) {
    var hs = c.hijos, i, hj;
    var estado = (c.t === 'button' || c.t === 'toggle' || c.t === 'slider' || c.t === 'slider_box') ? nombreEstado(c) : null;
    for (i = 0; i < hs.length; i++) {
      hj = hs[i];
      aplicarBindings(hj);
      hj.ver = visible(hj) && !(estado !== null && esEstado(c, hj) && hj.n !== estado);
    }
    if (c.t === 'stack_panel') { armarPila(c, w, h); return; }
    if (c.t === 'grid') { armarGrillaHijos(c, w, h); return; }
    for (i = 0; i < hs.length; i++) {
      hj = hs[i];
      if (!hj.ver) { hj.w = hj.h = 0; continue; }
      hj.llenoW = hj.llenoH = undefined;
      armar(hj, w, h);
      var af = ancla(hj.p.anchor_from), at = ancla(hj.p.anchor_to), o = offsetDe(hj, w, h);
      hj.rx = af[0] * w - at[0] * hj.w + o[0];
      hj.ry = af[1] * h - at[1] * hj.h + o[1];
    }
    if (c.t === 'scroll_view') desplazar(c);
    if (c.t === 'slider') ubicarDeslizador(c, w, h);
  }
  // el deslizador: el botón donde diga el valor y la barra llena hasta ahí (recortada desde la
  // derecha: "clip_direction": "left"); las marcas de los pasos, como la fábrica del juego
  function valorDeslizador(c) {
    var v = c.arrastrando ? c.valor : c.b['#slider_value'];
    if (typeof v !== 'number') v = c.valor || 0;
    return Math.max(0, Math.min(1, v));
  }
  function ubicarDeslizador(c, w, h) {
    var v = valorDeslizador(c), caja = null, prog = null;
    for (var i = 0; i < c.hijos.length; i++) if (c.hijos[i].t === 'slider_box' || c.hijos[i].n === c.p.slider_box_control) caja = c.hijos[i];
    prog = buscar(c, c.p.progress_control || 'slider_progress');
    if (caja) { caja.rx = v * (w - caja.w); caja.ry = (h - caja.h) / 2; }
    if (prog) prog.b['#clip_ratio'] = 1 - v;
    var pasos = c.b['#slider_steps'];
    if (typeof pasos !== 'number') pasos = c.p.slider_steps;
    c.pasos = pasos;
  }
  function armarPila(c, w, h) {
    var horiz = c.p.orientation === 'horizontal', hs = c.hijos, i, hj, usado = 0, llenos = [];
    for (i = 0; i < hs.length; i++) {
      hj = hs[i];
      if (!hj.ver) { hj.w = hj.h = 0; continue; }
      var sz = tamDe(hj);
      var e = tamExpr(horiz ? sz[0] : sz[1]);
      if (e[6]) { llenos.push(hj); continue; }
      hj.llenoW = hj.llenoH = undefined;
      armar(hj, w, h);
      usado += horiz ? hj.w : hj.h;
    }
    var resto = Math.max(0, (horiz ? w : h) - usado) / Math.max(1, llenos.length);
    for (i = 0; i < llenos.length; i++) {
      hj = llenos[i];
      if (horiz) { hj.llenoW = resto; hj.llenoH = undefined; } else { hj.llenoH = resto; hj.llenoW = undefined; }
      armar(hj, horiz ? 0 : w, horiz ? h : 0);
    }
    var acum = 0;
    for (i = 0; i < hs.length; i++) {
      hj = hs[i];
      if (!hj.ver) continue;
      var af = ancla(hj.p.anchor_from), at = ancla(hj.p.anchor_to), o = offsetDe(hj, w, h);
      if (horiz) {
        hj.rx = acum + o[0];
        hj.ry = af[1] * h - at[1] * hj.h + o[1];
        acum += hj.w;
      } else {
        hj.ry = acum + o[1];
        hj.rx = af[0] * w - at[0] * hj.w + o[0];
        acum += hj.h;
      }
    }
  }
  function armarGrillaHijos(c, w, h) {
    var d = c.dims || { col: 1, fil: 1 }, hs = c.hijos;
    if (d.porAncho) {
      // el tamaño de un elemento dice cuántas columnas entran
      var h0 = null;
      for (var q = 0; q < hs.length && !h0; q++) if (hs[q].ver) h0 = hs[q];
      if (h0) armar(h0, w, h);
      var ew = h0 ? Math.max(1, h0.w) : 18;
      d.col = Math.max(1, Math.floor(w / ew));
      d.fil = Math.ceil(d.n / d.col);
    }
    var cw = d.col ? w / d.col : w, ch = d.fil ? h / d.fil : h;
    if (d.porAncho && hs.length) { cw = Math.max(1, hs[0].w); ch = Math.max(1, hs[0].h); }
    var porColumnas = c.p.grid_fill_direction === 'vertical';
    // si la grilla mide por sus hijos, el tamaño de la celda es el del elemento
    var sz = par(c.p.size, '100%', '100%');
    var ex = tamExpr(sz[0]), ey = tamExpr(sz[1]);
    for (var i = 0; i < hs.length; i++) {
      var hj = hs[i];
      if (!hj.ver) { hj.w = hj.h = 0; continue; }
      armar(hj, ex[1] && !ex[0] ? w : cw, ey[1] && !ey[0] ? h : ch);
      var cellW = ex[1] && !ex[0] && !d.porAncho ? hj.w : cw, cellH = ey[1] && !ey[0] && !d.porAncho ? hj.h : ch;
      var col = porColumnas ? Math.floor(i / Math.max(1, d.fil)) : i % Math.max(1, d.col);
      var fil = porColumnas ? i % Math.max(1, d.fil) : Math.floor(i / Math.max(1, d.col));
      if (Array.isArray(hj.p.grid_position)) { col = hj.p.grid_position[0]; fil = hj.p.grid_position[1]; }
      var af = ancla(hj.p.anchor_from), at = ancla(hj.p.anchor_to), o = offsetDe(hj, cellW, cellH);
      hj.rx = col * cellW + af[0] * cellW - at[0] * hj.w + o[0];
      hj.ry = fil * cellH + af[1] * cellH - at[1] * hj.h + o[1];
    }
  }
  // los paneles que se deslizan: el contenido corrido por el desplazamiento, la barra a su altura
  function desplazar(c) {
    var vp = buscar(c, c.p.scroll_view_port || 'scrolling_view_port'), cont = vp && buscar(vp, c.p.scroll_content || 'scrolling_content');
    if (!vp || !cont) return;
    var max = Math.max(0, cont.h - vp.h);
    c.maxDesp = max;
    if (c.desp > max) c.desp = max;
    if (c.desp < 0) c.desp = 0;
    cont.ry -= c.desp;
    c.vp = vp; c.cont = cont;
    var caja = buscar(c, c.p.scrollbar_box || 'box'), pista = buscar(c, c.p.scrollbar_track || 'track');
    if (caja && pista) {
      var alto = max > 0 ? Math.max(6, pista.h * vp.h / cont.h) : pista.h;
      caja.h = alto;
      caja.w = pista.w;
      armarHijos(caja, caja.w, caja.h);
      caja.ry = max > 0 ? (pista.h - alto) * c.desp / max : 0;
      caja.ver = max > 0 && caja.ver;
    }
  }
  function posicionar(c, x, y) {
    c.x = x; c.y = y;
    for (var i = 0; i < c.hijos.length; i++) {
      var h = c.hijos[i];
      if (!h.ver) continue;
      // lo que "sigue al cursor" (el objeto agarrado en el inventario) va donde está el dedo
      if (h.p.follows_cursor && J.cursor) { posicionar(h, J.cursor[0] - h.w / 2, J.cursor[1] - h.h / 2); continue; }
      posicionar(h, x + (h.rx || 0), y + (h.ry || 0));
    }
  }
  var sucio = true;
  J.sucio = function () { sucio = true; };
  // tamaño de la pantalla en píxeles (del lienzo) → unidades de la interfaz
  J.tamano = function (wPx, hPx, escala) {
    J.escala = escala;
    pantallaW = wPx / escala; pantallaH = hPx / escala;
    sucio = true;
  };
  J.medidas = function () { return [pantallaW, pantallaH]; };
  function armarPantalla(pan) {
    var r = pan.raiz;
    registrarGrupos(r);
    iniciarGrupos(pan);
    aplicarBindings(r);
    r.ver = visible(r);
    armar(r, pantallaW, pantallaH);
    r.rx = (pantallaW - r.w) / 2; r.ry = (pantallaH - r.h) / 2;
    var af = ancla(r.p.anchor_from), at = ancla(r.p.anchor_to);
    r.rx = af[0] * pantallaW - at[0] * r.w; r.ry = af[1] * pantallaH - at[1] * r.h;
    posicionar(r, r.rx, r.ry);
    registrarGrupos(r);
  }

  // ------------------------------------------------------------------------------------------
  // Animaciones ("anims": alpha, offset, size, color, flip_book, wait; con "next" encadenadas)
  // ------------------------------------------------------------------------------------------
  function animDe(ref, ns) {
    if (typeof ref !== 'string') return null;
    if (ref.charAt(0) === '@') ref = ref.slice(1);
    var a = definicionDe(refDe(ref, ns), raiz, 0);
    // una animación de otro espacio sin nombrarlo (el ícono de guardado del HUD usa la de
    // auto_save_info): la primera con ese nombre
    if (!a && ref.indexOf('.') < 0) for (var k in indice) if (k.slice(k.indexOf('.') + 1) === ref) { a = definicionDe(k, raiz, 0); if (a) break; }
    return a;
  }
  function iniciarAnimaciones(c) {
    var l = Array.isArray(c.p.anims) ? c.p.anims : [c.p.anims];
    c.anims = [];
    for (var i = 0; i < l.length; i++) {
      var a = animDe(l[i], c.ns);
      if (a) c.anims.push({ a: a, t0: performance.now(), ns: c.ns, s: c.s });
    }
  }
  // lo de una animación que puede venir en una variable del control ("$chat_item_lifetime")
  function deAnim(v, an) { return typeof v === 'string' && v.charCodeAt(0) === 36 && an.s ? an.s[v] : v; }
  var FACIL = {
    linear: function (t) { return t; },
    in_quad: function (t) { return t * t; }, out_quad: function (t) { return t * (2 - t); },
    in_out_quad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    in_sine: function (t) { return 1 - Math.cos(t * Math.PI / 2); }, out_sine: function (t) { return Math.sin(t * Math.PI / 2); },
    in_out_sine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    in_cubic: function (t) { return t * t * t; }, out_cubic: function (t) { return (--t) * t * t + 1; },
    in_expo: function (t) { return t === 0 ? 0 : Math.pow(2, 10 * t - 10); }, out_expo: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    in_back: function (t) { return 2.70158 * t * t * t - 1.70158 * t * t; },
    out_back: function (t) { t -= 1; return 1 + 2.70158 * t * t * t + 1.70158 * t * t; },
    out_bounce: function (t) {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
      if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
      t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
    }
  };
  function interp(a, b, f) {
    if (Array.isArray(a) && Array.isArray(b)) return a.map(function (x, i) { return interp(x, b[i], f); });
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * f;
    return f < 1 ? a : b;
  }
  // avanza las animaciones de un control; true si algo cambió
  function animar(c, ahora) {
    var hubo = false;
    for (var i = 0; i < c.anims.length; i++) {
      var an = c.anims[i], a = an.a;
      var d0 = deAnim(a.duration, an), dur = (typeof d0 === 'number' ? d0 : 0) * 1000;
      var t = ahora - an.t0;
      var tipo = a.anim_type;
      if (tipo === 'flip_book') {
        var fps = a.fps || 10, n = a.frame_count || 1, paso = a.frame_step || 1;
        var cuadro = Math.floor(t / 1000 * fps) % n;
        // "reversible": va y vuelve
        if (a.reversible && n > 1) { cuadro = Math.floor(t / 1000 * fps) % (2 * n - 2); if (cuadro >= n) cuadro = 2 * n - 2 - cuadro; }
        if (cuadro !== c.cuadroFlip) { c.cuadroFlip = cuadro; c.flip = { ini: a.initial_uv || [0, 0], paso: paso, cuadro: cuadro }; hubo = true; }
        continue;
      }
      var f = dur > 0 ? Math.min(1, t / dur) : 1;
      var e = (FACIL[a.easing] || FACIL.linear)(f);
      var v = interp(deAnim(a.from, an), deAnim(a.to, an), e);
      if (tipo === 'alpha') { c.animAlpha = v; hubo = true; }
      else if (tipo === 'offset') { c.animOffset = v; hubo = true; }
      else if (tipo === 'size') { c.animSize = v; hubo = true; }
      else if (tipo === 'color') { c.animColor = v; hubo = true; }
      if (f >= 1) {
        if (a.next) {
          var sig = animDe(a.next, an.ns);
          if (sig) { an.a = sig; an.t0 = ahora; }
        } else if (a.destroy_at_end) {
          // se va el control que nombra (él o uno de los que lo contienen: el renglón entero del chat)
          var q = c, de = a.destroy_at_end;
          while (q && q.n !== de && q.base.slice(q.base.lastIndexOf('.') + 1) !== de) q = q.padre;
          (q || c).destruir = true;
        }
      }
    }
    return hubo;
  }

  // ------------------------------------------------------------------------------------------
  // Dibujo
  // ------------------------------------------------------------------------------------------
  var tenidas = Object.create(null);
  // una textura (o un pedazo) teñida con un color (multiplicado, como el juego)
  function tenida(im, sx, sy, sw, sh, css) {
    var k = (im.__id || (im.__id = ++uid)) + ':' + sx + ':' + sy + ':' + sw + ':' + sh + ':' + css;
    var c = tenidas[k];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    var x = c.getContext('2d');
    x.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = css; x.fillRect(0, 0, sw, sh);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    return (tenidas[k] = c);
  }
  function texturaDe(c) {
    var tex = c.b['#texture'] !== undefined ? c.b['#texture'] : c.p.texture;
    if (typeof tex !== 'string') return null;
    var t = D.texturas[tex];
    if (!t) {
      var k = ctrlDe(c);
      if (k && k.imagen) { var im = k.imagen(tex, c); if (im) return [im, 0, 0, im.width || im.naturalWidth, im.height || im.naturalHeight, 0, 0]; }
      return null;
    }
    var img = imgs[t[0]];
    if (!img) return null;
    return [img, t[1], t[2], t[3], t[4], t[5], t[6]];
  }
  // una textura del atlas por su ruta ("textures/ui/heart"), para los renderers del código; x, y,
  // w, h en píxeles del lienzo. false si no está
  J.textura = function (ctx, ruta, x, y, w, h) {
    var t = D.texturas[ruta], img = t && imgs[t[0]];
    if (!img) return false;
    ctx.drawImage(img, t[1], t[2], t[3], t[4], Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return true;
  };
  function dibujarImagen(ctx, c, k, alfa) {
    var t = texturaDe(c);
    if (!t) return;
    var im = t[0], sx = t[1], sy = t[2], sw = t[3], sh = t[4], ns = t[5];
    var uv = c.b['#uv'] !== undefined ? c.b['#uv'] : c.p.uv, uvs = c.b['#uv_size'] !== undefined ? c.b['#uv_size'] : c.p.uv_size;
    // los cuadros van para el costado si la textura es una tira horizontal (el ícono de guardado), si
    // no hacia abajo
    if (c.flip && Array.isArray(uvs)) {
      var deCostado = sw >= uvs[0] * 2 && sh < uvs[1] * 2;
      uv = deCostado ? [c.flip.ini[0] + c.flip.cuadro * c.flip.paso, c.flip.ini[1]] : [c.flip.ini[0], c.flip.ini[1] + c.flip.cuadro * c.flip.paso];
    } else if (typeof uv === 'string' && Array.isArray(uvs)) uv = [0, 0];
    if (Array.isArray(uv) && Array.isArray(uvs)) { sx += uv[0]; sy += uv[1]; sw = uvs[0]; sh = uvs[1]; ns = 0; }
    var color = c.animColor || (c.b['#color'] !== undefined ? c.b['#color'] : c.p.color);
    var fuenteIm = im;
    if (Array.isArray(color) && !(color[0] === 1 && color[1] === 1 && color[2] === 1)) {
      fuenteIm = tenida(im, sx, sy, sw, sh, colorCss(color));
      sx = 0; sy = 0;
      if (color.length > 3) alfa *= color[3];
    }
    var x = c.x * k, y = c.y * k, w = c.w * k, h = c.h * k;
    // recorte de las barras de progreso (clip_direction + clip_ratio)
    var cr = c.b['#clip_ratio'] !== undefined ? c.b['#clip_ratio'] : c.p.clip_ratio;
    if (typeof cr === 'number' && c.p.clip_direction) {
      cr = Math.max(0, Math.min(1, cr));
      ctx.save();
      ctx.beginPath();
      // la dirección es hacia donde se achica: "left" deja la parte izquierda (la barra del
      // deslizador y la de experiencia se llenan de izquierda a derecha)
      var d = c.p.clip_direction;
      if (d === 'left') ctx.rect(x, y, w * (1 - cr), h);
      else if (d === 'right') ctx.rect(x + w * cr, y, w * (1 - cr), h);
      else if (d === 'up') ctx.rect(x, y, w, h * (1 - cr));
      else if (d === 'down') ctx.rect(x, y + h * cr, w, h * (1 - cr));
      else ctx.rect(x, y, w, h);
      ctx.clip();
    }
    ctx.globalAlpha = alfa;
    if (Array.isArray(ns) && (ns[0] || ns[1] || ns[2] || ns[3])) nueve(ctx, fuenteIm, sx, sy, sw, sh, ns, x, y, w, h, k);
    else if (c.p.tiled) {
      var tw = sw * k, th = sh * k;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      for (var yy = 0; yy < h; yy += th) for (var xx = 0; xx < w; xx += tw)
        ctx.drawImage(fuenteIm, sx, sy, sw, sh, Math.round(x + xx), Math.round(y + yy), Math.ceil(tw), Math.ceil(th));
      ctx.restore();
    } else if (c.p.keep_ratio !== false && sw > 4 && sh > 4 && !c.p.fill && Math.abs(w / h - sw / sh) > 0.02 && !Array.isArray(ns)) {
      // como el juego: sin nineslice la imagen no se deforma (entra entera, centrada); los colores
      // lisos (White, Black: 2x2) sí se estiran, son los fondos oscuros de pantalla completa
      var esc = Math.min(w / sw, h / sh), dw = sw * esc, dh = sh * esc;
      ctx.drawImage(fuenteIm, sx, sy, sw, sh, Math.round(x + (w - dw) / 2), Math.round(y + (h - dh) / 2), Math.round(dw), Math.round(dh));
    } else ctx.drawImage(fuenteIm, sx, sy, sw, sh, Math.round(x), Math.round(y), Math.round(x + w) - Math.round(x), Math.round(y + h) - Math.round(y));
    if (typeof cr === 'number' && c.p.clip_direction) ctx.restore();
    ctx.globalAlpha = 1;
  }
  // los nueve pedazos: las esquinas del tamaño de la escala, lo de adentro estirado
  function nueve(ctx, im, sx, sy, sw, sh, ns, x, y, w, h, k) {
    var l = ns[0], t = ns[1], r = ns[2], b = ns[3];
    var L = Math.round(l * k), T = Math.round(t * k), R = Math.round(r * k), B = Math.round(b * k);
    if (L + R > w) { L = Math.floor(w / 2); R = Math.ceil(w / 2); }
    if (T + B > h) { T = Math.floor(h / 2); B = Math.ceil(h / 2); }
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    var cw = sw - l - r, ch = sh - t - b, iw = w - L - R, ih = h - T - B;
    // texturas de 1×1 o 2×2 con borde 1 ("control", "Black", el fondo de las pantallas): el centro
    // no tiene píxeles y el juego estira el del borde; acá se toma el pixel de ahí
    var cx = sx + l, cy = sy + t;
    if (cw <= 0) { cw = 1; cx = sx + Math.min(l, sw - 1); }
    if (ch <= 0) { ch = 1; cy = sy + Math.min(t, sh - 1); }
    var rx = sx + Math.max(0, sw - r), by = sy + Math.max(0, sh - b);
    function p(a, bb, c, d, e, f, g, hh) { if (c > 0 && d > 0 && g > 0 && hh > 0) ctx.drawImage(im, a, bb, c, d, e, f, g, hh); }
    p(sx, sy, Math.min(l, sw), Math.min(t, sh), x, y, L, T);
    p(cx, sy, cw, Math.min(t, sh), x + L, y, iw, T);
    p(rx, sy, Math.min(r, sw), Math.min(t, sh), x + w - R, y, R, T);
    p(sx, cy, Math.min(l, sw), ch, x, y + T, L, ih);
    p(cx, cy, cw, ch, x + L, y + T, iw, ih);
    p(rx, cy, Math.min(r, sw), ch, x + w - R, y + T, R, ih);
    p(sx, by, Math.min(l, sw), Math.min(b, sh), x, y + h - B, L, B);
    p(cx, by, cw, Math.min(b, sh), x + L, y + h - B, iw, B);
    p(rx, by, Math.min(r, sw), Math.min(b, sh), x + w - R, y + h - B, R, B);
  }
  J.nueve = nueve;
  function dibujarEtiqueta(ctx, c, k, alfa) {
    var ls = c.lineas;
    if (!ls || !ls.length) return;
    var kf = escalaFuente(c), lp = typeof c.p.line_padding === 'number' ? c.p.line_padding : 0;
    var color = c.animColor || (c.b['#color'] !== undefined ? c.b['#color'] : c.p.color);
    var css = colorCss(color === undefined ? [1, 1, 1] : color);
    ctx.globalAlpha = alfa * (Array.isArray(color) && color.length > 3 ? color[3] : 1);
    var al = c.p.text_alignment || 'left';
    for (var i = 0; i < ls.length; i++) {
      var w = anchoTexto(ls[i]) * kf, x = c.x;
      if (al === 'center') x = c.x + (c.w - w) / 2;
      else if (al === 'right') x = c.x + c.w - w;
      var y = c.y + i * (9 + lp) * kf;
      if (y - c.y > c.h + 0.5 && i > 0) break;
      escribir(ctx, ls[i], Math.round(x * k), Math.round(y * k), k * kf, css, !!c.p.shadow);
    }
    ctx.globalAlpha = 1;
  }
  // todo lo que se dibuja, con su capa absoluta (la de los padres + la propia) y su recorte
  var lista = [];
  function juntar(c, capa, clip, alfa, lista) {
    if (!c.ver) return;
    // lo modal (un desplegable abierto) se dibuja entero, fuera del recorte del panel
    if (c.p.modal) clip = null;
    var cp = capa + (typeof c.p.layer === 'number' ? c.p.layer : 0);
    var a = c.p.alpha;
    if (c.animAlpha !== undefined) a = c.animAlpha;
    if (c.b['#alpha'] !== undefined) a = c.b['#alpha'];
    var al = alfa * (typeof a === 'number' ? a : 1);
    if (DIBUJABLES[c.t]) lista.push({ c: c, capa: cp, clip: clip, alfa: al, orden: lista.length });
    if (c.p.clips_children) {
      var r = [c.x, c.y, c.x + c.w, c.y + c.h];
      clip = clip ? [Math.max(clip[0], r[0]), Math.max(clip[1], r[1]), Math.min(clip[2], r[2]), Math.min(clip[3], r[3])] : r;
    }
    var aHijos = c.p.propagate_alpha ? al : alfa;
    for (var i = 0; i < c.hijos.length; i++) juntar(c.hijos[i], cp, clip, aHijos, lista);
  }
  J.dibujar = function (ctx) {
    var pan = J.arriba();
    if (!pan) return;
    revisarMantener();
    dibujarPantalla(ctx, pan, lista);
    sucio = false;
  };
  var listaSuelta = [];
  J.dibujarSuelta = function (ctx, pan) { if (pan) dibujarPantalla(ctx, pan, listaSuelta); };
  // tocar una pantalla suelta (los casilleros de la barra del HUD): el botón que había ahí o false
  J.tocarSuelta = function (pan, x, y) {
    if (!pan) return false;
    var l = [];
    interactivos(pan.raiz, 0, null, l);
    l.sort(function (a, b) { return b.capa - a.capa || b.orden - a.orden; });
    for (var i = 0; i < l.length; i++) {
      var c = l[i].c;
      // (el que sigue al dedo, lo agarrado en los inventarios, no ataja toques)
      if (c.t === 'button' && !c.p.follows_cursor && x >= c.x && y >= c.y && x <= c.x + c.w && y <= c.y + c.h && habilitado(c)) { apretar(c); return c; }
    }
    return false;
  };
  function dibujarPantalla(ctx, pan, lista) {
    var ahora = performance.now();
    animarArbol(pan.raiz, ahora);
    // los bindings cambian cada cuadro (el texto de una barra de progreso, lo visible): se rearma
    armarPantalla(pan);
    lista.length = 0;
    juntar(pan.raiz, 0, null, 1, lista);
    lista.sort(function (a, b) { return a.capa - b.capa || a.orden - b.orden; });
    var k = J.escala;
    ctx.imageSmoothingEnabled = false;
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i], c = e.c;
      if (e.alfa <= 0.003) continue;
      if (e.clip) {
        if (e.clip[2] <= e.clip[0] || e.clip[3] <= e.clip[1]) continue;
        if (c.x > e.clip[2] || c.y > e.clip[3] || c.x + c.w < e.clip[0] || c.y + c.h < e.clip[1]) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.round(e.clip[0] * k), Math.round(e.clip[1] * k), Math.round((e.clip[2] - e.clip[0]) * k), Math.round((e.clip[3] - e.clip[1]) * k));
        ctx.clip();
      }
      if (c.t === 'image') dibujarImagen(ctx, c, k, e.alfa);
      else if (c.t === 'label') dibujarEtiqueta(ctx, c, k, e.alfa);
      else if (c.t === 'custom') {
        var f = J.renderers[c.p.renderer];
        if (f) { ctx.globalAlpha = e.alfa; f(ctx, c, k); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; }
      }
      if (e.clip) ctx.restore();
    }
  }
  function animarArbol(c, ahora) {
    if (c.anims) animar(c, ahora);
    for (var i = 0; i < c.hijos.length; i++) {
      var h = c.hijos[i];
      if (h.destruir) { c.hijos.splice(i--, 1); continue; }
      animarArbol(h, ahora);
    }
  }
  // los controles de un tipo de "custom" en la pantalla de arriba (para dibujar lo 3D detrás)
  J.controlesCustom = function (renderer) {
    var r = [];
    for (var i = 0; i < lista.length; i++) if (lista[i].c.t === 'custom' && lista[i].c.p.renderer === renderer) r.push(lista[i].c);
    return r;
  };

  // ------------------------------------------------------------------------------------------
  // Tocar y hacer clic
  // ------------------------------------------------------------------------------------------
  var activo = null, encima = null, inicio = null, arrastre = null, foco = null;
  // el control interactivo de más arriba en (x, y) (unidades de la interfaz)
  function interactivos(c, capa, clip, l) {
    if (!c.ver) return;
    if (c.p.modal) clip = null;
    var cp = capa + (typeof c.p.layer === 'number' ? c.p.layer : 0);
    var dentro = clip ? (c.x < clip[2] && c.y < clip[3] && c.x + c.w > clip[0] && c.y + c.h > clip[1]) : true;
    var t = c.t;
    if (dentro && (t === 'button' || t === 'toggle' || t === 'slider' || t === 'scroll_view' || t === 'edit_box' || t === 'scrollbar_box' ||
        t === 'scroll_track' || (t === 'input_panel' && (c.p.modal || c.p.gesture_tracking_button || tieneAccion(c)))))
      l.push({ c: c, capa: cp, clip: clip, orden: l.length });
    if (c.p.clips_children) {
      var r = [c.x, c.y, c.x + c.w, c.y + c.h];
      clip = clip ? [Math.max(clip[0], r[0]), Math.max(clip[1], r[1]), Math.min(clip[2], r[2]), Math.min(clip[3], r[3])] : r;
    }
    if (c.t === 'button' || c.t === 'toggle') return;   // lo de adentro de un botón no es otro botón
    for (var i = 0; i < c.hijos.length; i++) interactivos(c.hijos[i], cp, clip, l);
  }
  function tieneAccion(c) {
    var m = c.p.button_mappings;
    if (!Array.isArray(m)) return false;
    for (var i = 0; i < m.length; i++) if (m[i] && m[i].from_button_id === 'button.menu_select' && m[i].mapping_type === 'pressed') return true;
    return false;
  }
  function enPunto(x, y, filtro) {
    var pan = J.arriba();
    if (!pan) return [];
    var l = [];
    interactivos(pan.raiz, 0, null, l);
    l.sort(function (a, b) { return b.capa - a.capa || b.orden - a.orden; });
    var r = [];
    for (var i = 0; i < l.length; i++) {
      var e = l[i], c = e.c;
      if (e.clip && (x < e.clip[0] || y < e.clip[1] || x > e.clip[2] || y > e.clip[3])) continue;
      if (x >= c.x && y >= c.y && x <= c.x + c.w && y <= c.y + c.h && (!filtro || filtro(c))) r.push(c);
    }
    return r;
  }
  function panelDesplazable(c) {
    for (var q = c; q; q = q.padre) if (q.t === 'scroll_view') return q;
    return null;
  }
  // el botón de un toque mantenido (0,4 s): su "button.menu_secondary_select" (en el inventario,
  // agarrar la mitad); el doble toque: su "double_pressed" (juntar los iguales)
  var MANTENER = 400, DOBLE = 300, ultimoToque = null;
  function mapeo(c, desde, tipo) {
    var m = c && c.p.button_mappings;
    if (!Array.isArray(m)) return null;
    for (var i = 0; i < m.length; i++) if (m[i] && m[i].from_button_id === desde && m[i].mapping_type === tipo && m[i].to_button_id) return m[i].to_button_id;
    return null;
  }
  J.cursor = null;
  // cuánto lleva apretado un botón que se puede mantener (0 a 1), o -1
  J.progresoMantener = function () {
    if (!activo || !arrastre || !arrastre.mantener || arrastre.movido || arrastre.mantenido) return -1;
    return Math.min(1, (performance.now() - inicio.t) / MANTENER);
  };
  function revisarMantener() {
    if (!activo || !arrastre || !arrastre.mantener || arrastre.movido || arrastre.mantenido || arrastre.objeto) return;
    if (performance.now() - inicio.t < MANTENER) return;
    arrastre.mantenido = true;
    var k = ctrlDe(activo);
    if (k && k.boton) k.boton(arrastre.mantener, activo);
    activo.apretado = false;
    J.sucio();
  }
  J.bajar = function (x, y, raton) {
    J.cursor = [x, y];
    if (cerrarDesplegablesFuera(x, y)) { activo = null; inicio = null; arrastre = null; return true; }
    var en = enPunto(x, y);
    if (foco && (!en.length || en[0] !== foco)) cerrarTeclado();
    inicio = { x: x, y: y, t: performance.now() };
    arrastre = null;
    var c = en[0] || null;
    // un input_panel modal se traga el toque (los carteles emergentes)
    if (c && c.t === 'input_panel' && !c.p.gesture_tracking_button && !tieneAccion(c)) { activo = null; return true; }
    activo = c;
    if (c) {
      var sv = panelDesplazable(c) || (c.t === 'scroll_view' ? c : null);
      arrastre = { sv: sv, desp0: sv ? sv.desp : 0, movido: false, c: c };
      if (c.t === 'button' || c.t === 'toggle') { c.apretado = true; c.encima = true; }
      if (c.t === 'button') arrastre.mantener = mapeo(c, 'button.menu_secondary_select', 'pressed');
      if (c.t === 'slider') moverDeslizador(c, x);
      if (c.t === 'scrollbar_box' || c.t === 'scroll_track') arrastre.barra = true;
      if (c.p.gesture_tracking_button) arrastre.gesto = { x0: x };
    }
    J.sucio();
    return !!c;
  };
  J.mover = function (x, y, raton) {
    if (!raton || inicio) J.cursor = [x, y];
    if (raton && !inicio) {
      // el ratón sin apretar: el estado "encima" de botones e interruptores
      var en = enPunto(x, y), c = en[0] || null;
      if (c !== encima) {
        if (encima) encima.encima = false;
        encima = (c && (c.t === 'button' || c.t === 'toggle')) ? c : null;
        if (encima) encima.encima = true;
        J.sucio();
      }
      return;
    }
    if (!inicio || !arrastre) return;
    var dx = x - inicio.x, dy = y - inicio.y;
    var a = activo;
    if (a && a.t === 'slider') { moverDeslizador(a, x); return; }
    if (arrastre.gesto && a) {
      var k = ctrlDe(a);
      if (k && k.gesto) k.gesto(a.p.gesture_tracking_button, x - arrastre.gesto.x0, a);
      arrastre.gesto.x0 = x;
      return;
    }
    // arrastrar un objeto del inventario: de costado en una lista (para arriba y abajo se desliza
    // la lista) o en cualquier dirección fuera de una; agarra lo del casillero y lo suelta donde se
    // levante el dedo
    var kk = a && ctrlDe(a), sv = arrastre.sv;
    if (arrastre.objeto) { J.sucio(); return; }
    if (a && a.t === 'button' && !arrastre.movido && kk && kk.arrastrable && (Math.abs(dx) > 6 || Math.abs(dy) > 6) &&
        (!sv || Math.abs(dx) > Math.abs(dy)) && kk.arrastrable(a)) {
      arrastre.objeto = true;
      a.apretado = false; a.encima = false;
      var tomar = mapeo(a, 'button.menu_select', 'pressed');
      if (tomar && kk.boton) kk.boton(tomar, a);
      J.sucio();
      return;
    }
    if (sv && (Math.abs(dy) > 3 || arrastre.movido)) {
      arrastre.movido = true;
      if (a && a.apretado) { a.apretado = false; a.encima = false; }
      if (arrastre.barra && sv.maxDesp > 0 && sv.vp) sv.desp = arrastre.desp0 + dy * sv.cont.h / sv.vp.h;
      else sv.desp = arrastre.desp0 - dy;
      if (sv.desp < 0) sv.desp = 0;
      if (sv.desp > (sv.maxDesp || 0)) sv.desp = sv.maxDesp || 0;
      J.sucio();
      return;
    }
    if (a && (a.t === 'button' || a.t === 'toggle')) {
      var den = x >= a.x && y >= a.y && x <= a.x + a.w && y <= a.y + a.h;
      if (den !== a.encima) { a.encima = den; J.sucio(); }
    }
  };
  J.subir = function (x, y, raton) {
    var a = activo, mov = arrastre && arrastre.movido;
    activo = null; inicio = null;
    if (!a) { arrastre = null; return false; }
    var den = x >= a.x && y >= a.y && x <= a.x + a.w && y <= a.y + a.h;
    if (arrastre && arrastre.objeto) {
      // se suelta lo arrastrado en el casillero de abajo del dedo (si hay)
      var dest = enPunto(x, y, function (c) { return c.t === 'button' && !!mapeo(c, 'button.menu_select', 'pressed'); })[0];
      if (dest && dest !== a) apretar(dest);
      arrastre = null;
      J.sucio();
      return true;
    }
    if (arrastre && arrastre.mantenido) { a.apretado = false; arrastre = null; J.sucio(); return true; }
    if (a.t === 'button') {
      a.apretado = false;
      if (!raton) a.encima = false;
      if (den && !mov && habilitado(a)) {
        // el segundo toque seguido en el mismo casillero es otra cosa (juntar los iguales en lo que
        // agarró el primero), no un toque más
        var ahora = performance.now(), doble = mapeo(a, 'button.menu_select', 'double_pressed');
        if (doble && ultimoToque && ultimoToque.c === a && ahora - ultimoToque.t < DOBLE) {
          var kd = ctrlDe(a);
          suena();
          if (kd && kd.boton) kd.boton(doble, a);
          ultimoToque = null;
        } else {
          apretar(a);
          ultimoToque = { c: a, t: ahora };
        }
      }
    } else if (a.t === 'toggle') {
      a.apretado = false;
      if (!raton) a.encima = false;
      if (den && !mov && habilitado(a)) alternar(a);
    } else if (a.t === 'edit_box' && den && !mov) {
      abrirTeclado(a);
    } else if (a.t === 'slider') {
      a.arrastrando = false;
      var k = ctrlDe(a);
      if (k && k.deslizadorSuelto) k.deslizadorSuelto(a.p.slider_name, a.valor, a);
    }
    arrastre = null;
    J.sucio();
    return true;
  };
  J.rueda = function (x, y, dy) {
    var en = enPunto(x, y);
    for (var i = 0; i < en.length; i++) {
      var sv = panelDesplazable(en[i]) || (en[i].t === 'scroll_view' ? en[i] : null);
      if (sv) { sv.desp = Math.max(0, Math.min(sv.maxDesp || 0, sv.desp + dy)); J.sucio(); return true; }
    }
    return false;
  };
  function suena() { if (J.sonido) J.sonido('random.click'); }
  function apretar(c) {
    var m = c.p.button_mappings || [];
    suena();
    var k = ctrlDe(c);
    for (var i = 0; i < m.length; i++) {
      var e = m[i];
      if (!e || e.ignored === true) continue;
      if (e.from_button_id === 'button.menu_select' && e.mapping_type === 'pressed' && e.to_button_id) {
        if (k && k.boton) k.boton(e.to_button_id, c);
        return;
      }
    }
    if (c.p.property_bag && c.p.property_bag['#hyperlink'] && k && k.enlace) k.enlace(c.p.property_bag['#hyperlink'], c);
  }
  J.apretar = apretar;
  // el binding que da el estado de un interruptor ("#thirdperson_radio_first"): las opciones de
  // radio de los ajustes son cada una su propio grupo y el código del juego apaga las otras
  function bindingEstado(c) {
    var bs = c.p.bindings || [];
    for (var i = 0; i < bs.length; i++) if (bs[i] && bs[i].binding_name_override === '#toggle_state' && bs[i].binding_type !== 'none') return bs[i].binding_name;
    return null;
  }
  J.bindingEstado = bindingEstado;
  function alternar(c) {
    suena();
    var g = grupo(c), k = ctrlDe(c);
    if (g) {
      var i = indiceEnGrupo(c, g);
      if (verdad(c.b['#toggle_state']) && !c.p.toggle_group_deselectable) return;
      J.elegirEnGrupo(c.pantalla, c.p.toggle_name, i);
      if (k && k.alternar) k.alternar(c.p.toggle_name, true, i, c);
      cerrarDesplegable(c);
      return;
    }
    var nuevo = !verdad(c.b['#toggle_state']);
    c.b['#toggle_state'] = nuevo;
    c.estadoPropio = true;
    if (k && k.alternar) k.alternar(c.p.toggle_name, nuevo, c.indice === undefined ? -1 : c.indice, c);
  }
  // elegir una opción de un desplegable lo cierra (en el juego lo hace su código)
  function cerrarDesplegable(c) {
    for (var q = c.padre; q; q = q.padre) {
      if (q.n === 'dropdown_content' && q.padre) {
        for (var i = 0; i < q.padre.hijos.length; i++) {
          var d = q.padre.hijos[i];
          if (d.t === 'dropdown') { var t = buscarTipo(d, 'toggle'); if (t) t.b['#toggle_state'] = false; }
        }
        J.sucio();
        return;
      }
    }
  }
  function buscarTipo(c, tipo) {
    if (c.t === tipo) return c;
    for (var i = 0; i < c.hijos.length; i++) { var r = buscarTipo(c.hijos[i], tipo); if (r) return r; }
    return null;
  }
  // tocar fuera de un desplegable abierto lo cierra
  function cerrarDesplegablesFuera(x, y) {
    var pan = J.arriba();
    if (!pan) return false;
    var hubo = false;
    (function rec(c) {
      if (!c.ver) return;
      if (c.n === 'dropdown_content' && c.t === 'input_panel') {
        var dentro = x >= c.x && y >= c.y && x <= c.x + c.w && y <= c.y + c.h;
        if (!dentro && c.padre) {
          for (var i = 0; i < c.padre.hijos.length; i++) {
            var d = c.padre.hijos[i];
            if (d.t === 'dropdown') { var t = buscarTipo(d, 'toggle'); if (t && verdad(t.b['#toggle_state'])) { t.b['#toggle_state'] = false; hubo = true; } }
          }
        }
        return;
      }
      for (var j = 0; j < c.hijos.length; j++) rec(c.hijos[j]);
    })(pan.raiz);
    if (hubo) J.sucio();
    return hubo;
  }
  function moverDeslizador(c, x) {
    var pasos = c.pasos, caja = 0;
    for (var i = 0; i < c.hijos.length; i++) if (c.hijos[i].t === 'slider_box') caja = c.hijos[i].w;
    var v = (x - c.x - caja / 2) / Math.max(1, c.w - caja);
    v = Math.max(0, Math.min(1, v));
    if (typeof pasos === 'number' && pasos > 1) v = Math.round(v * (pasos - 1)) / (pasos - 1);
    c.arrastrando = true;
    if (v !== c.valor) {
      c.valor = v;
      c.b['#slider_value'] = v;
      var k = ctrlDe(c);
      if (k && k.deslizador) k.deslizador(c.p.slider_name, v, c);
      J.sucio();
    }
  }
  // atrás (Android) / Escape: el "button.menu_cancel" de la pantalla
  J.atras = function () {
    var pan = J.arriba();
    if (!pan) return false;
    if (pan.ctrl.boton) return pan.ctrl.boton('button.menu_cancel', null) !== false;
    return false;
  };

  // ------------------------------------------------------------------------------------------
  // Campos de texto: un <input> del navegador encima (así aparece el teclado del teléfono)
  // ------------------------------------------------------------------------------------------
  var entrada = null;
  function abrirTeclado(c) {
    foco = c;
    if (!entrada) {
      entrada = document.createElement('input');
      entrada.type = 'text';
      entrada.autocomplete = 'off';
      entrada.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;';
      document.body.appendChild(entrada);
      entrada.addEventListener('input', function () {
        if (!foco) return;
        var max = foco.p.max_length || 0;
        var v = entrada.value;
        if (max > 0 && v.length > max) { v = v.slice(0, max); entrada.value = v; }
        foco.texto = v;
        foco.b['#item_name'] = v;
        var k = ctrlDe(foco);
        if (k && k.texto) k.texto(foco.p.text_box_name, v, foco);
        J.sucio();
      });
      entrada.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var f = foco;
          cerrarTeclado();
          var k = f && ctrlDe(f);
          if (k && k.enviar) k.enviar(f.p.text_box_name, f.texto, f);
        }
      });
      entrada.addEventListener('blur', function () { if (foco) { foco = null; J.sucio(); } });
    }
    var k = ctrlDe(c);
    var v = c.texto;
    if (k && k.textoInicial) { var t = k.textoInicial(c.p.text_box_name, c); if (typeof t === 'string') v = t; }
    entrada.value = v || '';
    c.texto = entrada.value;
    entrada.focus();
    J.sucio();
  }
  function cerrarTeclado() {
    if (entrada) entrada.blur();
    foco = null;
  }
  J.foco = function () { return foco; };
  function soltar() {
    if (encima) encima.encima = false;
    encima = null; activo = null; inicio = null; arrastre = null;
    cerrarTeclado();
  }
  J.soltar = soltar;

  return J;
})();
