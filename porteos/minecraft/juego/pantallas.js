// porteo: lo que en Minecraft PE 1.2 es código C++ detrás de cada pantalla (sus "screen
// controllers"): qué contestar a cada binding ("#version", "#local_world_name"...), qué hacer con cada
// botón ("button.menu_play") e interruptor ("view_bobbing"). Las pantallas en sí (cómo se ven) las
// arma Jui desde los ui/*.json del juego. G es el juego (principal.js): opciones, mundos, red...
var Pantallas = (function () {
  'use strict';
  var P = {};
  var G = null;

  // los textos del port que el juego no trae (en los tres idiomas)
  var TEXTOS = {
    es: { 'porteo.shaders': 'Shaders de Tito Crack 6000', 'porteo.resolucion': 'Resolución', 'porteo.auto': 'Automática',
      'porteo.fps': 'Mostrar cuadros por segundo', 'porteo.idioma': 'Language · Idioma · Idioma', 'porteo.idiomaPregunta': 'Choose your language\nElegí tu idioma\nEscolha seu idioma',
      'porteo.shadersPregunta': '¿Jugar con los shaders de Tito? Se ven mejor pero piden más del teléfono. Se cambia después en Ajustes > Video.',
      'porteo.shadersTitulo': 'Shaders', 'porteo.si': 'Sí, con shaders', 'porteo.no': 'No, sin shaders',
      'porteo.tienda': 'La tienda necesita una conexión con los servidores de Minecraft, que esta versión no tiene.',
      'porteo.xbox': 'Xbox Live no está disponible en esta versión.', 'porteo.publico': 'Mundo público',
      'porteo.publicoDesc': 'El mismo mundo para todos', 'porteo.jugadores': '%s jugando', 'porteo.sinServidor': 'Sin conexión',
      'porteo.direccion': 'Dirección (cualquier nombre: el mismo nombre es el mismo mundo)',
      'porteo.borrarMundo': '¿Seguro que querés borrar este mundo? Se pierde para siempre.', 'porteo.version': 'v1.2.0.2' },
    en: { 'porteo.shaders': 'Tito Crack 6000 shaders', 'porteo.resolucion': 'Resolution', 'porteo.auto': 'Automatic',
      'porteo.fps': 'Show frames per second', 'porteo.idioma': 'Language · Idioma · Idioma', 'porteo.idiomaPregunta': 'Choose your language\nElegí tu idioma\nEscolha seu idioma',
      'porteo.shadersPregunta': 'Play with Tito\'s shaders? They look better but ask more of the phone. You can change it later in Settings > Video.',
      'porteo.shadersTitulo': 'Shaders', 'porteo.si': 'Yes, with shaders', 'porteo.no': 'No, without shaders',
      'porteo.tienda': 'The Marketplace needs a connection to the Minecraft servers, which this version does not have.',
      'porteo.xbox': 'Xbox Live is not available in this version.', 'porteo.publico': 'Public world',
      'porteo.publicoDesc': 'The same world for everyone', 'porteo.jugadores': '%s playing', 'porteo.sinServidor': 'Offline',
      'porteo.direccion': 'Address (any name: the same name is the same world)',
      'porteo.borrarMundo': 'Are you sure you want to delete this world? It will be lost forever.', 'porteo.version': 'v1.2.0.2' },
    pt: { 'porteo.shaders': 'Shaders do Tito Crack 6000', 'porteo.resolucion': 'Resolução', 'porteo.auto': 'Automática',
      'porteo.fps': 'Mostrar quadros por segundo', 'porteo.idioma': 'Language · Idioma · Idioma', 'porteo.idiomaPregunta': 'Choose your language\nElegí tu idioma\nEscolha seu idioma',
      'porteo.shadersPregunta': 'Jogar com os shaders do Tito? Ficam mais bonitos mas pedem mais do celular. Dá para mudar depois em Configurações > Vídeo.',
      'porteo.shadersTitulo': 'Shaders', 'porteo.si': 'Sim, com shaders', 'porteo.no': 'Não, sem shaders',
      'porteo.tienda': 'A loja precisa de uma conexão com os servidores do Minecraft, que esta versão não tem.',
      'porteo.xbox': 'O Xbox Live não está disponível nesta versão.', 'porteo.publico': 'Mundo público',
      'porteo.publicoDesc': 'O mesmo mundo para todos', 'porteo.jugadores': '%s jogando', 'porteo.sinServidor': 'Sem conexão',
      'porteo.direccion': 'Endereço (qualquer nome: o mesmo nome é o mesmo mundo)',
      'porteo.borrarMundo': 'Tem certeza de que quer apagar este mundo? Ele será perdido para sempre.', 'porteo.version': 'v1.2.0.2' }
  };
  var IDIOMAS = [{ corto: 'en', nombre: 'English (US)' }, { corto: 'es', nombre: 'Español (México)' }, { corto: 'pt', nombre: 'Português (Brasil)' }];
  function t(k) { return Jui.t(k); }
  function f(s) {
    var a = arguments, i = 1;
    return String(s).replace(/%(\d+\$)?[sd]/g, function (m, n) { return n ? String(a[parseInt(n, 10)]) : String(a[i++]); });
  }

  P.iniciar = function (juego) {
    G = juego;
    agregarOpcionesDelPort();
    Jui.renderers.splash_text_renderer = frase;
    Jui.renderers.panorama_renderer = function () { /* el panorama lo dibuja WebGL atrás */ };
    Jui.renderers.paper_doll_renderer = muñeco;
    Jui.renderers.progress_bar_renderer = barraDeProgreso;
    Jui.renderers.gradient_renderer = degrade;
    Jui.renderers.inventory_item_renderer = dibujarObjeto;
    Jui.renderers.hover_text_renderer = textoFlotante;
    Jui.renderers.armor_renderer = barraArmadura;
    Jui.renderers.live_player_renderer = jugadorVivo;
    Jui.renderers.name_tag_renderer = function (ctx, c, k) {
      var n = c.b['#playername'] || G.nombre();
      var w = Jui.anchoTexto(n);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(Math.round((c.x + c.w / 2 - w / 2 - 1) * k), Math.round((c.y - 10) * k), Math.round((w + 2) * k), Math.round(9 * k));
      Jui.escribir(ctx, n, Math.round((c.x + c.w / 2 - w / 2) * k), Math.round((c.y - 9) * k), k, [1, 1, 1], false);
    };
  };
  P.textos = TEXTOS;
  // el fondo de la muerte: un degradé de arriba (color1) a abajo (color2), como el del juego
  function degrade(ctx, c, k) {
    var a = c.p.color1 || [0, 0, 0, 0], b = c.p.color2 || [0, 0, 0, 0];
    var css = function (q) { return 'rgba(' + Math.round(q[0] * 255) + ',' + Math.round(q[1] * 255) + ',' + Math.round(q[2] * 255) + ',' + (q[3] === undefined ? 1 : q[3]) + ')'; };
    var g = ctx.createLinearGradient(0, c.y * k, 0, (c.y + c.h) * k);
    g.addColorStop(0, css(a)); g.addColorStop(1, css(b));
    ctx.fillStyle = g;
    ctx.fillRect(c.x * k, c.y * k, c.w * k, c.h * k);
  }
  // el muñeco (paper doll): el jugador con su skin, girado con el dedo (el gesto del control) y con
  // el balanceo quieto de los brazos; el elegidor de skins le pasa la que se está mirando
  function muñeco(ctx, c, k) {
    if (!window.Muneco) return;
    var skin = G.skin ? G.skin() : 'steve', yaw = G.muñecoYaw ? G.muñecoYaw() : 0.45;
    // los de las grillas de skins muestran cada uno la suya, quietos; el grande, la que se mira
    var si = c.b['#skin_index'], y0 = c.y, y1 = c.y + c.h;
    if (typeof si === 'number' && SKINS[si]) {
      skin = SKINS[si].id; yaw = 0.45;
      // la grilla corre al muñeco 10 unidades para arriba: se lo achica a lo que queda dentro de su
      // celda para que no pise el título del marco ("Por defecto")
      var cel = c;
      while (cel.padre && cel.padre.t !== 'grid') cel = cel.padre;
      if (cel.padre) { y0 = Math.max(y0, cel.y); y1 = Math.min(y1, cel.y + cel.h); }
    } else if (typeof c.b['#preview_skin'] === 'string') skin = c.b['#preview_skin'];
    if (y1 > y0) Muneco.dibujar(ctx, skin, c.x * k, y0 * k, c.w * k, (y1 - y0) * k, yaw, performance.now() / 50);
  }

  // la frase amarilla del título: girada 20°, latiendo, del tamaño que el juego le da por su largo
  function frase(ctx, c, k) {
    var s = G.frase();
    if (!s) return;
    var t0 = performance.now() / 1000;
    var esc = 1.8 - Math.abs(Math.sin(t0 * Math.PI * 2)) * 0.1;
    esc = esc * 100 / (Jui.anchoTexto(s) + 32);
    var x = (c.x + c.w / 2) * k, y = (c.y + c.h / 2) * k;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(-20 * Math.PI / 180);
    var kk = k * esc, w = Jui.anchoTexto(s) * kk;
    Jui.escribir(ctx, s, -w / 2, -8 * kk, kk, [1, 1, 0], true);
    ctx.restore();
  }
  // ------------------------------------------------------------------------------------------
  // Las cosas en los casilleros (inventory_item_renderer): el ícono de "#item_id_aux" (número del
  // objeto × 65536 + su variante, como el juego), atenuado si está inactivo
  // ------------------------------------------------------------------------------------------
  function dibujarObjeto(ctx, c, k) {
    var v = c.b['#item_id_aux'];
    if (typeof v !== 'number' || v <= 0) return;
    var id = Math.floor(v / 65536), m = v % 65536;
    var x = c.x * k, y = c.y * k, w = c.w * k;
    // centrado en su panel (el "$item_renderer_offset" de los casilleros de bolsillo lo compensa el
    // código del juego: así quedan en el medio de la celda, con la barra de durabilidad abajo)
    var pp = c.padre;
    if (pp && pp.w > c.w && pp.h > c.h && Array.isArray(c.p.offset)) { x = (pp.x + (pp.w - c.w) / 2) * k; y = (pp.y + (pp.h - c.h) / 2) * k; }
    if (c.b['#disabled_filter_visible']) ctx.globalAlpha *= 0.4;
    Interfaz.iconoEn(ctx, id, m, x, y, Math.round(w));
  }
  // la barra de armadura (diez pecheras de icons.png: llena, media, vacía) con los puntos puestos
  function barraArmadura(ctx, c, k) {
    var im = Interfaz.imagen('iconos'), p = G.puntosArmadura ? G.puntosArmadura() : 0;
    if (!im) return;
    for (var i = 0; i < 10; i++) {
      var u = p >= i * 2 + 2 ? 34 : p === i * 2 + 1 ? 25 : 16;
      // (el control está 5 unidades arriba, sobre el título: el juego dibuja la fila debajo)
      ctx.drawImage(im, u, 9, 9, 9, Math.round((c.x + i * 8) * k), Math.round((c.y + 7) * k), Math.round(9 * k), Math.round(9 * k));
    }
  }
  // el jugador en la pestaña de armadura (sobre el fondo negro), con su skin
  function jugadorVivo(ctx, c, k) {
    if (!window.Muneco) return;
    var f = c.padre || c, skin = G.skin ? G.skin() : 'steve';
    Muneco.dibujar(ctx, skin, f.x * k, (f.y + f.h * 0.06) * k, f.w * k, f.h * 0.88 * k, 0.45 + (G.muñecoYaw ? G.muñecoYaw() - 0.45 : 0), performance.now() / 50);
  }
  // el nombre de la cosa (el cartelito violeta de Minecraft) arriba del lugar del control
  function textoFlotante(ctx, c, k) {
    var s = c.b['#hover_text'];
    if (typeof s !== 'string' || !s) return;
    var w = Jui.anchoTexto(s), x = Math.round((c.x + c.w / 2 - w / 2 - 3) * k), y = Math.round((c.y - 16) * k);
    var W = Math.round((w + 6) * k), H = Math.round(13 * k);
    if (x < 0) x = 0;
    ctx.fillStyle = 'rgba(16,0,16,0.94)'; ctx.fillRect(x, y, W, H);
    ctx.strokeStyle = 'rgba(80,0,255,0.6)'; ctx.lineWidth = Math.max(1, k * 0.8);
    ctx.strokeRect(x + k, y + k, W - 2 * k, H - 2 * k);
    Jui.escribir(ctx, s, x + 3 * k, y + 2.5 * k, k, [1, 1, 1], true);
  }
  function barraDeProgreso(ctx, c, k) {
    // la durabilidad de una herramienta y el "mantener" del inventario: barras de los bindings
    if (c.b['#progress_bar_visible'] !== undefined || (c.p.property_bag && c.p.property_bag.is_durability)) {
      if (!c.b['#progress_bar_visible']) return;
      var tot = c.b['#progress_bar_total_amount'] || 1, act = c.b['#progress_bar_current_amount'] || 0, fr = Math.max(0, Math.min(1, act / tot));
      var bx = Math.round(c.x * k), by = Math.round(c.y * k), bw = Math.round(c.w * k), bh = Math.max(1, Math.round(c.h * k));
      ctx.fillStyle = '#000000'; ctx.fillRect(bx, by, bw, bh + Math.round(k));
      if (c.p.property_bag && c.p.property_bag.is_durability) {
        // de verde a rojo según lo que queda (como el juego)
        var r = Math.round(255 * (1 - fr)), g = Math.round(255 * fr);
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',0)';
      } else ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, by, Math.round(bw * fr), bh);
      return;
    }
    var v = c.b['#progress_percentage'] !== undefined ? c.b['#progress_percentage'] : G.cargaParte();
    if (typeof v !== 'number') return;
    var x = Math.round(c.x * k), y = Math.round(c.y * k), w = Math.round(c.w * k), h = Math.max(1, Math.round(c.h * k));
    ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#80ff80'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, v))), h);
  }

  // las opciones que el port agrega a Ajustes > Video (con el estilo de las del juego)
  function agregarOpcionesDelPort() {
    var d = Jui.cruda('general_section', 'video_section');
    if (!d || !Array.isArray(d.controls)) return;
    var nuevas = [
      { 'porteo_shaders@settings_common.option_toggle': { '$option_label': 'porteo.shaders', '$option_binding_name': '#porteo_shaders',
        '$option_enabled_binding_name': '#porteo_shaders_enabled', '$toggle_name': 'porteo_shaders' } },
      { 'porteo_resolucion@settings_common.option_slider': { '$option_label': '#porteo_resolucion_slider_label', '$slider_name': 'porteo_resolucion',
        '$slider_value_binding_name': '#porteo_resolucion', '$slider_steps_binding_name': '#porteo_resolucion_steps',
        '$option_enabled_binding_name': '#porteo_resolucion_enabled', '$label_bindings': [{ binding_name: '#porteo_resolucion_slider_label' }] } },
      { 'porteo_fps@settings_common.option_toggle': { '$option_label': 'porteo.fps', '$option_binding_name': '#porteo_fps',
        '$option_enabled_binding_name': '#porteo_fps_enabled', '$toggle_name': 'porteo_fps' } }
    ];
    // después de "iluminación suave" (antes de lo que sigue en la lista de la 1.2)
    var i = 0;
    for (; i < d.controls.length; i++) if (Object.keys(d.controls[i])[0].indexOf('option_toggle_5') === 0) break;
    if (i >= d.controls.length) i = d.controls.length - 1;
    Array.prototype.splice.apply(d.controls, [i + 1, 0].concat(nuevas));
  }

  // ------------------------------------------------------------------------------------------
  // Navegación
  // ------------------------------------------------------------------------------------------
  var REFS = {
    inicio: 'start.start_screen', jugar: 'play.play_screen', plantillas: 'world_templates.world_templates_screen',
    crear: 'settings.screen_world_create', editar: 'settings.screen_world_edit', ajustes: 'settings.screen_controls_and_settings',
    ajustesJuego: 'settings.screen_world_controls_and_settings', servidorNuevo: 'add_external_server.add_external_server_screen_new',
    servidorEditar: 'add_external_server.add_external_server_screen_edit', carga: 'progress.world_loading_progress_screen',
    guardando: 'progress.world_saving_progress_screen', pausa: 'pause.pause_screen', chat: 'chat.chat_screen',
    muerte: 'death.death_screen', skins: 'skin_picker.skin_picker_screen', comoJugar: 'how_to_play.how_to_play_screen',
    desconectado: 'disconnect.disconnect_screen', inventario: 'crafting_pocket.survival_inventory_screen_pocket',
    inventarioCreativo: 'crafting_pocket.creative_inventory_screen_pocket', mesa: 'crafting_pocket.crafting_screen_pocket'
  };
  // variables de plataforma de cada pantalla ($is_pregame: fuera del mundo; sin elegir una imagen
  // propia para la skin: el botón "Aspecto nuevo" no aparece)
  // lo que el código del juego contesta en cualquier pantalla: cómo se está jugando (tocando la
  // pantalla) y los textos "preprocesados" con los íconos de la fuente (":touch_jump:" → el ícono)
  function comun(n) {
    switch (n) {
      case '#touch_being_used': case '#gamepad_not_being_used': case '#touch_supported': return true;
      case '#touch_not_being_used': case '#gamepad_being_used': case '#keyboard_being_used': case '#is_using_gamepad':
      case '#splitscreen_enabled': return false;
      // el "foco" de un lado u otro es del mando: tocando no hay velos sobre la lista ni el contenido
      case '#selector_area_focused': case '#content_area_focused': case '#gamepad_helper_visible': return false;
    }
    if (n.indexOf('#pre_process_') === 0) return conIconos(t(n.slice(13)));
    return undefined;
  }
  function conIconos(s) {
    return String(s).replace(/:([A-Za-z0-9_.]+):/g, function (m, nombre) {
      var cod = Jui.emoticonos[nombre];
      return cod ? String.fromCharCode(cod) : (nombre.indexOf('_input_key.') === 0 ? '' : m);
    });
  }
  P.conIconos = conIconos;
  function abrir(nombre, ctrl, encima) {
    var propio = ctrl.binding;
    ctrl.binding = function (n, c) {
      var v = propio ? propio.call(ctrl, n, c) : undefined;
      return v === undefined ? comun(n) : v;
    };
    var vars = { '$is_pregame': !G.jugando(), '$image_picking_not_supported': true };
    if (ctrl.vars) for (var kv in ctrl.vars) vars[kv] = ctrl.vars[kv];
    var pan = encima ? Jui.abrir(REFS[nombre], ctrl, vars) : Jui.cambiar(REFS[nombre], ctrl, vars);
    if (pan) pan.nombre = nombre;
    G.pantallaAbierta(nombre);
    return pan;
  }
  P.ir = function (nombre, datos) {
    var c = CTRL[nombre];
    if (!c) return null;
    return abrir(nombre, c(datos || {}), false);
  };
  P.encima = function (nombre, datos) {
    var c = CTRL[nombre];
    if (!c) return null;
    return abrir(nombre, c(datos || {}), true);
  };
  P.cerrar = function () {
    Jui.cerrar();
    var a = Jui.arriba();
    G.pantallaAbierta(a ? a.nombre : null);
  };
  P.nombre = function () { var a = Jui.arriba(); return a ? a.nombre : null; };
  P.vaciar = function () { Jui.vaciar(); G.pantallaAbierta(null); };

  // un cartel del juego (popup_dialog.modal_dialog_popup) con hasta tres botones
  // (los textos van en el cartel como propiedades, como hace el juego, y cada botón tiene su nombre)
  P.cartel = function (titulo, texto, botones) {
    var pan = Jui.arriba();
    if (!pan) return;
    var anterior = pan.ctrl;
    var envoltorio = Object.create(anterior);
    var cartel = null;
    var btn = botones || [{ texto: 'gui.ok' }];
    var n = btn.length;
    // izquierda, medio y derecha según cuántos botones hay (con uno, el del medio)
    var orden = n === 1 ? ['medio'] : n === 2 ? ['izq', 'der'] : ['izq', 'medio', 'der'];
    function cerrar(lado) {
      Jui.quitar(cartel);
      pan.ctrl = anterior;
      var b = btn[orden.indexOf(lado)];
      if (b && b.hacer) b.hacer();
    }
    envoltorio.boton = function (id, c) {
      if (id === 'button.porteo_cartel_izq') return cerrar('izq');
      if (id === 'button.porteo_cartel_medio') return cerrar('medio');
      if (id === 'button.porteo_cartel_der') return cerrar('der');
      if (id === 'button.menu_cancel') return cerrar(orden[orden.length - 1]);
      return undefined;
    };
    pan.ctrl = envoltorio;
    cartel = Jui.fabricar(pan, 'popup_dialog_factory', 'modal_dialog_popup', {
      '$single_button_visible': n === 1, '$two_buttons_visible': n === 2, '$three_buttons_visible': n === 3, '$no_buttons_visible': n === 0,
      '$popup_dialog_left_button_name': 'button.porteo_cartel_izq', '$popup_dialog_middle_button_name': 'button.porteo_cartel_medio',
      '$popup_dialog_rightcancel_button_name': 'button.porteo_cartel_der'
    });
    if (!cartel) { pan.ctrl = anterior; return null; }
    var props = { '#modal_title_text': t(titulo), '#modal_label_text': t(texto) };
    props['#modal_left_button_text'] = orden.indexOf('izq') >= 0 ? t(btn[orden.indexOf('izq')].texto) : '';
    props['#modal_middle_button_text'] = orden.indexOf('medio') >= 0 ? t(btn[orden.indexOf('medio')].texto) : '';
    props['#modal_rightcancel_button_text'] = orden.indexOf('der') >= 0 ? t(btn[orden.indexOf('der')].texto) : '';
    var fuente = Jui.buscar(cartel, 'modal_bg_buttons');
    for (var k in props) { cartel.b[k] = props[k]; if (fuente) fuente.b[k] = props[k]; }
    return cartel;
  };

  // ------------------------------------------------------------------------------------------
  // Título (start_screen)
  // ------------------------------------------------------------------------------------------
  var CTRL = {};
  CTRL.inicio = function () {
    return {
      binding: function (n) {
        switch (n) {
          case '#version': return t('porteo.version');
          case '#playername': return G.nombre();
          case '#achievements_visible': case '#sign_in_visible': case '#signingin_visible': case '#trial_game_mode':
          case '#new_offers': case '#update_icon_visible': case '#realms_notification_visible': case '#y_helper_visible':
            return false;
          case '#feedback_visible': return false;
          case '#howtoplay_visible': return true;
          case '#development_version': return '';
        }
      },
      boton: function (id) {
        switch (id) {
          case 'button.menu_play': P.ir('jugar'); return;
          case 'button.menu_settings': P.ir('ajustes'); return;
          case 'button.menu_store': P.cartel('menu.store', 'porteo.tienda'); return;
          case 'button.menu_skins': P.ir('skins'); return;
          case 'button.menu_how_to_play': P.ir('comoJugar'); return;
          case 'button.xbl_signin': case 'button.menu_achievements': P.cartel('xbox.signin', 'porteo.xbox'); return;
          case 'button.menu_cancel': case 'button.menu_exit': return false;
        }
      },
      gesto: function (id, dx) { G.girarMuñeco(dx); }
    };
  };

  // ------------------------------------------------------------------------------------------
  // Jugar (play_screen): Mundos (los 3 públicos fijados arriba + los propios), Amigos, Servidores
  // ------------------------------------------------------------------------------------------
  P.pestañaJugar = 0;
  function fecha(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
  function tamaño(b) {
    if (!b) return '';
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
    return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }
  CTRL.jugar = function () {
    // la lista: primero los mundos públicos (los "fijados"), después los guardados
    function lista() {
      var l = [];
      G.publicos().forEach(function (p, i) { l.push({ publico: i, p: p }); });
      G.mundos().forEach(function (m) { l.push({ mundo: m }); });
      return l;
    }
    function servidores() { return G.servidores(); }
    return {
      binding: function (n) {
        switch (n) {
          case '#local_worlds_visible': return true;
          case '#no_local_worlds': return false;
          case '#local_world_item_grid_dimension': return [1, lista().length];
          case '#servers_network_world_item_grid_dimension': return [1, servidores().length];
          case '#third_party_featured_item_grid_dimension': return [1, G.publicos().length];
          case '#lan_network_world_item_grid_dimension': return [1, 0];
          case '#friends_network_world_item_grid_dimension': return [1, 0];
          case '#personal_realms_grid_dimension': case '#friend_realms_grid_dimension': case '#legacy_world_item_grid_dimension':
          case '#loading_personal_realms_grid_dimension': case '#loading_friends_realms_grid_dimension': return [1, 0];
          case '#servers_grid_visible': return servidores().length > 0;
          case '#featured_servers_visible': return true;
          case '#loading_servers_progress_visible': case '#realms_grids_visible': case '#friends_realms_visible':
          case '#friends_grid_visible': case '#lan_grid_visible': case '#legacy_worlds_visible': case '#loading_legacy_worlds_grid_visible':
          case '#loading_bars_animation_visible': case '#realm_trial_button_visible': case '#realms_notification_button_visible':
          case '#multiplayer_privileges_blocked_visible': case '#coming_soon_message_visible': case '#loading_personal_realms_grid_visible':
          case '#loading_friends_realms_grid_visible': case '#leave_realm_button_visible': case '#realms_edit_visible':
          case '#cloud_only_storage_visible': case '#local_and_cloud_storage_visible': case '#local_only_storage_visible':
          case '#no_local_worlds_switch_setting_visible': case '#bumper_tooltips_visible': case '#friends_tab_bouncing':
          case '#third_party_screenshot_visible': case '#realm_label_visible':
            return false;
          case '#no_friends_grid_visible': return true;
          case '#realms_notification_button_invisible': return true;
          case '#player_gamertag': return G.nombre();
        }
      },
      longitud: function (col) {
        if (col === 'local_worlds') return lista().length;
        if (col === 'servers_network_worlds') return servidores().length;
        if (col === 'third_party_server_network_worlds') return G.publicos().length;
        return 0;
      },
      coleccion: function (col, i, n) {
        if (col === 'local_worlds') {
          var e = lista()[i];
          if (!e) return undefined;
          if (e.publico !== undefined) {
            var j = G.jugadoresEn(e.p.sala);
            switch (n) {
              case '#local_world_name': return e.p.nombre || f(t('porteo.publico') + ' %s', e.publico + 1);
              case '#local_world_date': return j > 0 ? f(t('porteo.jugadores'), j) : '';
              case '#local_world_game_mode': return t('porteo.publicoDesc');
              case '#local_worldfile_size': return '';
              case '#local_world_image': return 'textures/ui/World';
              case '#world_lock_visible': return false;
            }
            return undefined;
          }
          var m = e.mundo;
          switch (n) {
            case '#local_world_name': return m.nombre;
            case '#local_world_date': return fecha(m.jugado || m.creado);
            case '#local_world_game_mode': return t(m.modo === 'supervivencia' ? 'createWorldScreen.gameMode.survival' : m.modo === 'aventura' ? 'createWorldScreen.gameMode.adventure' : 'createWorldScreen.gameMode.creative');
            case '#local_worldfile_size': return tamaño(m.tamaño);
            case '#local_world_image': return m.foto ? 'mundo:' + m.id : 'textures/ui/default_world';
            case '#world_lock_visible': return false;
          }
        }
        if (col === 'servers_network_worlds') {
          var s = servidores()[i];
          if (!s) return undefined;
          switch (n) {
            case '#network_world_header': return s.nombre;
            case '#network_world_details': return s.direccion;
            case '#network_world_player_count': var js = G.jugadoresEn(G.salaDe(s.direccion)); return js > 0 ? String(js) : '';
            case '#game_online': return true;
            case '#game_offline': case '#game_unavailable': return false;
          }
        }
        if (col === 'third_party_server_network_worlds') {
          var p = G.publicos()[i];
          if (!p) return undefined;
          switch (n) {
            case '#third_party_server_name': return p.nombre || f(t('porteo.publico') + ' %s', i + 1);
            case '#third_party_server_message': var jp = G.jugadoresEn(p.sala); return jp > 0 ? f(t('porteo.jugadores'), jp) : t('porteo.publicoDesc');
            case '#third_party_server_logo_texture_path': return 'textures/ui/World';
          }
        }
        return undefined;
      },
      grupoInicial: function (nombre) { if (nombre === 'navigation_tab') return P.pestañaJugar; },
      alternar: function (nombre, v, i) { if (nombre === 'navigation_tab') P.pestañaJugar = i; },
      boton: function (id, c) {
        var i = c ? c.indice : -1;
        switch (id) {
          case 'button.menu_local_world_create': P.ir('crear', { nuevo: true }); return;
          case 'button.menu_start_local_world': {
            var e = lista()[i];
            if (!e) return;
            if (e.publico !== undefined) G.entrarPublico(e.publico); else G.abrirMundo(e.mundo);
            return;
          }
          case 'button.menu_local_world_item_edit': {
            var e2 = lista()[i];
            if (!e2) return;
            if (e2.publico !== undefined) { G.entrarPublico(e2.publico); return; }
            P.ir('editar', { mundo: e2.mundo });
            return;
          }
          case 'button.menu_network_add_external': P.ir('servidorNuevo', {}); return;
          case 'button.menu_network_world_item': { var s = servidores()[i]; if (s) G.entrarServidor(s); return; }
          case 'button.menu_network_server_world_edit': { P.ir('servidorEditar', { indice: i }); return; }
          case 'button.connect_to_third_party_server': G.entrarPublico(i); return;
          case 'button.menu_import_level': return;
          case 'button.menu_cancel': case 'button.menu_exit': P.ir('inicio'); return;
          case 'button.menu_tab_left': case 'button.menu_tab_right': return;
        }
      }
    };
  };

  // ------------------------------------------------------------------------------------------
  // Ajustes (settings_screen): los generales, los táctiles y los del mundo (crear y editar)
  // ------------------------------------------------------------------------------------------
  // interruptor del juego → opción del port ([nombre, al revés])
  var INTERRUPTORES = {
    view_bobbing: 'balanceo', graphics_toggle: 'sofisticados', render_clouds: 'nubes', fancy_skies: 'cielos',
    smooth_lighting: 'suave', hide_hud: 'ocultarInterfaz', hide_hand: 'ocultarMano', hide_paperdoll: 'ocultarMuñeco',
    ingame_player_names: 'nombresJugadores', show_auto_save_icon: 'iconoGuardado', classic_box_selection: 'cajaClasica',
    touch_invert_y_axis: 'invertirY', touch_autojump: 'autoSalto', touch_vibration: 'vibrar', touch_toggle_crouch: 'agacharFijo',
    split_controls: 'dividido', left_handed: 'zurdo', swap_jump_and_sneak: 'intercambiar', full_screen: 'pantallaCompleta',
    porteo_shaders: 'shaders', porteo_fps: 'fps', texel_aa: 'texelAA', limit_world_size: 'limiteMundo',
    allow_cellular_data: 'datosMoviles', websocket_encryption: 'cifrado', enable_chat_text_to_speech: 'leerChat'
  };
  // deslizador → [opción, mínimo, máximo, pasos, cómo se muestra]
  var DESLIZADORES = {
    gamma: ['brillo', 0, 1, 0, function (v) { return f('%s: %s%', t('options.gamma'), Math.round(v * 100)); }],
    field_of_view: ['fov', 30, 110, 81, function (v) { return f('%s: %s', t('options.fov'), f(t('options.fov.format'), Math.round(v))); }],
    render_distance: ['dist', 2, 12, 11, function (v) { return f('%s: %s', t('options.renderDistance'), f(t('options.renderDistanceFormat'), Math.round(v))); }],
    gui_scale: ['escalaGui', -1, 0, 2, function (v) { return f('%s: %s', t('options.guiScale.optionName'), t(v < 0 ? 'options.guiScale.small' : 'options.guiScale.normal')); }],
    interface_opacity: ['opacidad', 0.2, 1, 0, function (v) { return f('%s: %s%', t('options.interfaceOpacity'), Math.round(v * 100)); }],
    music_volume: ['musica', 0, 1, 0, function (v) { return f('%s: %s%', t('options.music'), Math.round(v * 100)); }],
    sound_volume: ['volumen', 0, 1, 0, function (v) { return f('%s: %s%', t('options.sound'), Math.round(v * 100)); }],
    touch_sensitivity: ['sens', 0.2, 2, 0, function (v) { return f('%s: %s%', t('options.sensitivity'), Math.round(v * 100)); }],
    button_size: ['tamBoton', 0.6, 1.4, 0, function (v) { return f('%s: %s%', t('options.buttonSize'), Math.round(v * 100)); }],
    porteo_resolucion: ['resolucion', 0, 1, 5, function (v) { return f('%s: %s', t('porteo.resolucion'), v <= 0 ? t('porteo.auto') : Math.round(v * 100) + '%'); }],
    max_framerate: ['limite', 30, 60, 2, function (v) { return f('%s: %s', t('options.maxFramerate'), f(t('options.maxFramerateFormat'), Math.round(v))); }]
  };
  function aDeslizador(k, v) {
    var d = DESLIZADORES[k];
    if (k === 'porteo_resolucion') return [0, 0.5, 0.625, 0.75, 0.875, 1].indexOf(v) >= 0 ? [0, 0.5, 0.625, 0.75, 0.875, 1].indexOf(v) / 5 : 0;
    return (v - d[1]) / (d[2] - d[1]);
  }
  function deDeslizador(k, x) {
    var d = DESLIZADORES[k];
    if (k === 'porteo_resolucion') return [0, 0.5, 0.625, 0.75, 0.875, 1][Math.round(x * 5)];
    var v = d[1] + x * (d[2] - d[1]);
    if (d[3] > 1) v = d[1] + Math.round(x * (d[3] - 1)) * (d[2] - d[1]) / (d[3] - 1);
    return +v.toFixed(3);
  }
  // los desplegables: nombre del binding de cada opción → [opción, valor]
  var RADIOS = {
    '#thirdperson_radio_first': ['camara', 0], '#thirdperson_radio_third_back': ['camara', 1], '#thirdperson_radio_third_front': ['camara', 2],
    '#ui_profile_radio_classic': ['perfilUi', 'clasico'], '#ui_profile_radio_pocket': ['perfilUi', 'pocket']
  };
  var DESPLEGABLES = {
    third_person_dropdown: ['camara', ['options.thirdperson.firstperson', 'options.thirdperson.thirdpersonback', 'options.thirdperson.thirdpersonfront']],
    ui_profile_dropdown: ['perfilUi', { clasico: 'options.uiprofile.classic', pocket: 'options.uiprofile.pocket' }]
  };
  // los del mundo (crear y editar)
  var RADIOS_MUNDO = {
    '#world_game_mode_radio_survival': ['modo', 'supervivencia'], '#world_game_mode_radio_creative': ['modo', 'creativo'],
    '#world_game_mode_radio_adventure': ['modo', 'aventura'],
    '#player_game_mode_radio_survival': ['modo', 'supervivencia'], '#player_game_mode_radio_creative': ['modo', 'creativo'],
    '#player_game_mode_radio_adventure': ['modo', 'aventura'],
    '#world_difficulty_radio_peaceful': ['dificultad', 0], '#world_difficulty_radio_easy': ['dificultad', 1],
    '#world_difficulty_radio_normal': ['dificultad', 2], '#world_difficulty_radio_hard': ['dificultad', 3],
    '#world_type_radio_infinite': ['tipo', 'infinito'], '#world_type_radio_flat': ['tipo', 'plano'], '#world_type_radio_old': ['tipo', 'antiguo']
  };
  var DESPLEGABLES_MUNDO = {
    world_game_mode_dropdown: ['modo', { supervivencia: 'createWorldScreen.gameMode.survival', creativo: 'createWorldScreen.gameMode.creative', aventura: 'createWorldScreen.gameMode.adventure' }],
    player_game_mode_dropdown: ['modo', { supervivencia: 'createWorldScreen.gameMode.survival', creativo: 'createWorldScreen.gameMode.creative', aventura: 'createWorldScreen.gameMode.adventure' }],
    world_difficulty_dropdown: ['dificultad', ['options.difficulty.peaceful', 'options.difficulty.easy', 'options.difficulty.normal', 'options.difficulty.hard']],
    world_type_dropdown: ['tipo', { infinito: 'generator.infinite', plano: 'generator.flat', antiguo: 'generator.old' }]
  };
  var INTERRUPTORES_MUNDO = {
    always_day: 'siempreDia', daylight_cycle: ['siempreDia', true], mob_spawn: 'bichos', keep_inventory: 'guardarInventario',
    mob_griefing: 'romperBichos', mob_loot: 'botinBichos', natural_regeneration: 'regenerar', tile_drops: 'soltarBloques',
    tnt_explodes: 'tntExplota', fire_spreads: 'fuegoSeExtiende', weather_cycle: 'clima', entities_drop_loot: 'botinEntidades',
    allow_cheats: 'trucos', bonus_chest: 'cofreBonus', start_with_map: 'conMapa', trust_players: 'confiar',
    multiplayer_game: 'multijugador', server_visible: 'visibleLan'
  };
  var DEF_MUNDO = { modo: 'creativo', dificultad: 2, tipo: 'infinito', siempreDia: false, bichos: true, guardarInventario: false,
    romperBichos: true, botinBichos: true, regenerar: true, soltarBloques: true, tntExplota: true, fuegoSeExtiende: true, clima: true,
    botinEntidades: true, trucos: true, cofreBonus: false, conMapa: false, confiar: true, multijugador: true, visibleLan: true };

  function ctrlAjustes(datos) {
    var op = G.opciones();
    // el mundo que se crea o se edita (o el de la partida, en los ajustes del juego)
    var mundo = null;
    if (datos.nuevo) {
      mundo = { nombre: t('createWorldScreen.defaultName'), semilla: '' };
      for (var k in DEF_MUNDO) mundo[k] = DEF_MUNDO[k];
    } else if (datos.mundo) {
      mundo = datos.mundo;
      for (k in DEF_MUNDO) if (mundo[k] === undefined) mundo[k] = DEF_MUNDO[k];
      if (mundo.modo === undefined) mundo.modo = mundo.creativo === false ? 'supervivencia' : 'creativo';
    } else if (datos.partida) {
      mundo = datos.partida;
      for (k in DEF_MUNDO) if (mundo[k] === undefined) mundo[k] = DEF_MUNDO[k];
    }
    function valorMundo(k) {
      var e = INTERRUPTORES_MUNDO[k];
      if (!mundo || !e) return undefined;
      if (Array.isArray(e)) return !mundo[e[0]];
      return mundo[e] !== false && !!mundo[e];
    }
    var cambios = {};
    var inicial = datos.seccion;
    return {
      binding: function (n, c) {
        if (n === '#dialog_title' || n === '#title_text') {
          if (datos.nuevo) return t('selectWorld.create');
          if (datos.mundo) return mundo.nombre;
          return t('options.title');
        }
        if (n === '#panel_title') return '';
        var base = n.slice(1);
        // interruptores de los ajustes generales
        if (INTERRUPTORES[base]) return !!op[INTERRUPTORES[base]];
        if (base.slice(-8) === '_enabled') {
          var b0 = base.slice(0, -8);
          if (INTERRUPTORES[b0] || DESLIZADORES[b0] || DESPLEGABLES[b0] || DESPLEGABLES_MUNDO[b0]) return true;
          if (INTERRUPTORES_MUNDO[b0]) return !(datos.partida && G.esPublica());
          if (b0 === 'world_name' || b0 === 'world_seed') return !!datos.nuevo || b0 === 'world_name';
          return true;
        }
        // deslizadores
        if (DESLIZADORES[base]) return aDeslizador(base, op[DESLIZADORES[base][0]]);
        if (base.slice(-13) === '_slider_label' && DESLIZADORES[base.slice(0, -13)]) {
          var d = DESLIZADORES[base.slice(0, -13)];
          return d[4](op[d[0]]);
        }
        if (base.slice(-6) === '_steps' && DESLIZADORES[base.slice(0, -6)]) return DESLIZADORES[base.slice(0, -6)][3] || 1;
        // desplegables (sus opciones de radio y el texto del botón)
        if (RADIOS[n]) return op[RADIOS[n][0]] === RADIOS[n][1];
        if (RADIOS_MUNDO[n]) return !!mundo && mundo[RADIOS_MUNDO[n][0]] === RADIOS_MUNDO[n][1];
        if (base.slice(-13) === '_toggle_label') {
          var dn = base.slice(0, -13), e = DESPLEGABLES[dn] || DESPLEGABLES_MUNDO[dn];
          if (e) {
            var v = DESPLEGABLES[dn] ? op[e[0]] : mundo && mundo[e[0]];
            return t(Array.isArray(e[1]) ? e[1][v | 0] : e[1][v]);
          }
        }
        if (base === 'player_game_mode_dropdown_visible') return false;
        if (INTERRUPTORES_MUNDO[base]) return valorMundo(base);
        // el mundo
        if (n === '#world_name') return mundo ? mundo.nombre : '';
        if (n === '#world_seed') return mundo ? String(mundo.semilla === undefined ? '' : mundo.semilla) : '';
        if (n === '#world_texture_name') return 'textures/ui/default_world';
        // el ícono de los botones de paquetes: el del paquete de recursos de la 1.2 (no hay otros)
        if (n === '#cycling_icon_path_global' || n === '#cycling_icon_path_level') return 'pack_icon';
        if (n === '#cycling_icon_path_addon') return 'pack_icon_comportamientos';
        if (n === '#show_world_type_options' || n === '#show_permissions_dropdown') return n === '#show_world_type_options' && !!datos.nuevo;
        if (n === '#server_settings_visible' || n === '#achievment_warning_visible' || n === '#multiplayer_warning_visible' || n === '#show_broadcast_dropdown' ||
          n === '#show_convert_to_infinite_button' || n === '#can_be_server_visible') return false;
        if (n === '#not_logged_in') return true;
        if (n === '#logged_in') return false;
        if (n === '#gamertag_label') return '';
        if (n === '#language_grid_dimension') return [1, IDIOMAS.length];
        if (n === '#navigation_tab_focus_precedence' || n === '#toggle_on_hover') return undefined;
        return undefined;
      },
      longitud: function (col) { return col === 'languages' ? IDIOMAS.length : 0; },
      coleccion: function (col, i, n) {
        if (col === 'languages') {
          var l = IDIOMAS[i];
          if (!l) return undefined;
          if (n === '#language_description') return l.nombre;
          if (n === '#language_initial_selected' || n === '#toggle_state') return op.idioma === l.corto;
        }
        return undefined;
      },
      grupoInicial: function (nombre) {
        if (nombre !== 'navigation_tab') return undefined;
        if (inicial !== undefined) return inicial;
        if (datos.nuevo || datos.mundo) return 2;           // Juego
        if (datos.partida) return 2;
        return 12;                                           // Táctil
      },
      alternar: function (nombre, v, i, c) {
        if (nombre === 'navigation_tab') return;
        if (nombre === 'languages') { var l = IDIOMAS[i]; if (l) { op.idioma = l.corto; G.ponerIdioma(l.corto); G.guardarOpciones(); } return; }
        if (INTERRUPTORES[nombre]) { op[INTERRUPTORES[nombre]] = v; G.guardarOpciones(); G.aplicarOpciones(INTERRUPTORES[nombre]); return; }
        if (INTERRUPTORES_MUNDO[nombre] && mundo) {
          var e = INTERRUPTORES_MUNDO[nombre];
          if (Array.isArray(e)) mundo[e[0]] = !v; else mundo[e] = v;
          cambios[nombre] = true;
          if (datos.partida) G.cambioDePartida(nombre);
          return;
        }
        // una opción de un desplegable: el nombre del interruptor es el de su binding
        var r = RADIOS[nombre] || RADIOS[c && Jui.bindingEstado(c)];
        if (r) { op[r[0]] = r[1]; G.guardarOpciones(); G.aplicarOpciones(r[0]); return; }
        var rm = RADIOS_MUNDO[nombre] || RADIOS_MUNDO[c && Jui.bindingEstado(c)];
        if (rm && mundo) { mundo[rm[0]] = rm[1]; if (datos.partida) G.cambioDePartida(rm[0]); }
      },
      deslizador: function (nombre, x) {
        var d = DESLIZADORES[nombre];
        if (!d) return;
        op[d[0]] = deDeslizador(nombre, x);
        if (d[0] !== 'dist' && d[0] !== 'resolucion') G.aplicarOpciones(d[0]);
      },
      deslizadorSuelto: function (nombre) {
        var d = DESLIZADORES[nombre];
        if (!d) return;
        G.guardarOpciones();
        G.aplicarOpciones(d[0]);
      },
      textoInicial: function (nombre) {
        if (nombre === 'world_name_text_box') return mundo ? mundo.nombre : '';
        if (nombre === 'world_seed_text_box') return mundo ? String(mundo.semilla || '') : '';
        if (nombre === 'player_name_text_box') return op.nombre;
      },
      texto: function (nombre, v) {
        if (nombre === 'world_name_text_box' && mundo) mundo.nombre = v;
        else if (nombre === 'world_seed_text_box' && mundo) mundo.semilla = v;
        else if (nombre === 'player_name_text_box' && v) { op.nombre = v.slice(0, 20); G.guardarOpciones(); G.aplicarOpciones('nombre'); }
      },
      boton: function (id) {
        switch (id) {
          case 'create_world_button': case 'button.create_world_button':
            G.crearMundo(mundo); return;
          case 'play_world_button': case 'button.play_world_button':
            G.guardarMundo(mundo).then(function () { G.abrirMundo(mundo); }); return;
          case 'delete_world_button': case 'button.delete_world_button':
            P.cartel('selectWorld.deleteQuestion', 'porteo.borrarMundo', [
              { texto: 'selectWorld.deleteButton', hacer: function () { G.borrarMundo(mundo).then(function () { P.ir('jugar'); }); } },
              { texto: 'gui.cancel' }]);
            return;
          case 'button.menu_cancel': case 'button.menu_exit':
            G.guardarOpciones();
            if (datos.partida) { P.ir('pausa'); return; }
            if (datos.mundo) { G.guardarMundo(mundo).then(function () { P.ir('jugar'); }); return; }
            if (datos.nuevo) { P.ir('jugar'); return; }
            P.ir('inicio');
            return;
        }
      }
    };
  }
  CTRL.ajustes = ctrlAjustes;
  CTRL.ajustesJuego = ctrlAjustes;
  CTRL.crear = ctrlAjustes;
  CTRL.editar = ctrlAjustes;

  // ------------------------------------------------------------------------------------------
  // Agregar o editar un servidor (para el port: una "dirección" es el nombre de una sala)
  // ------------------------------------------------------------------------------------------
  function ctrlServidor(datos) {
    var l = G.servidores(), s = datos.indice >= 0 && l[datos.indice] ? { nombre: l[datos.indice].nombre, direccion: l[datos.indice].direccion } : { nombre: '', direccion: '' };
    function valido() { return !!(s.direccion && s.direccion.trim()); }
    function guardar() {
      var l2 = G.servidores();
      var n = { nombre: (s.nombre || s.direccion).slice(0, 32), direccion: s.direccion.trim().slice(0, 64) };
      if (datos.indice >= 0) l2[datos.indice] = n; else l2.push(n);
      G.guardarServidores(l2);
      return n;
    }
    return {
      binding: function (n) {
        switch (n) {
          case '#title_text': return t(datos.indice >= 0 ? 'addExternalServerScreen.editTitle' : 'addExternalServerScreen.addTitle');
          case '#play_button_enabled': case '#save_button_enabled': return valido();
          case '#play_button_disabled': case '#save_button_disabled': return !valido();
          case '#name_text_box_content': return s.nombre;
          case '#ip_text_box_content': return s.direccion;
          case '#port_text_box_content': return '19132';
          case '#enabled': return true;
        }
      },
      textoInicial: function (n) {
        if (n === '#name_text_box' || n === 'name_text_box') return s.nombre;
        if (n === '#ip_text_box' || n === 'ip_text_box') return s.direccion;
        if (n === '#port_text_box' || n === 'port_text_box') return '19132';
      },
      texto: function (n, v) {
        if (n === '#name_text_box' || n === 'name_text_box') s.nombre = v;
        if (n === '#ip_text_box' || n === 'ip_text_box') s.direccion = v;
      },
      boton: function (id) {
        switch (id) {
          case 'button.save_button': if (valido()) { guardar(); P.pestañaJugar = 2; P.ir('jugar'); } return;
          case 'button.play_button': if (valido()) G.entrarServidor(guardar()); return;
          case 'button.remove_button':
            if (datos.indice >= 0) { var l3 = G.servidores(); l3.splice(datos.indice, 1); G.guardarServidores(l3); }
            P.pestañaJugar = 2; P.ir('jugar'); return;
          case 'button.menu_cancel': case 'button.menu_exit': P.pestañaJugar = 2; P.ir('jugar'); return;
        }
      }
    };
  }
  CTRL.servidorNuevo = ctrlServidor;
  CTRL.servidorEditar = ctrlServidor;

  // ------------------------------------------------------------------------------------------
  // Carga y guardado (progress_screen)
  // ------------------------------------------------------------------------------------------
  function ctrlCarga(datos) {
    return {
      binding: function (n) {
        switch (n) {
          case '#title_text': return datos.titulo || G.cargaTitulo();
          case '#progress_text': return G.cargaTexto();
          case '#progress_bar_visible': case '#loading_bar_visible': return true;
          case '#bar_animation_visible': return false;
          case '#cancel_visible': return false;
          case '#cancel_not_visible': return true;
          case '#clip_ratio': return 1 - Math.max(0, Math.min(1, G.cargaParte()));
          case '#auto_save_animation_visible': return false;
          case '#progress_bar_total_amount': case '#loading_bar_total_amount': return 100;
          case '#progress_bar_current_amount': case '#loading_bar_current_amount': return Math.round(G.cargaParte() * 100);
          case '#loading_bar_percentage': return Math.round(G.cargaParte() * 100) + '%';
        }
      },
      boton: function () { return false; }
    };
  }
  CTRL.carga = ctrlCarga;
  CTRL.guardando = ctrlCarga;

  // ------------------------------------------------------------------------------------------
  // Pausa
  // ------------------------------------------------------------------------------------------
  CTRL.pausa = function () {
    return {
      binding: function (n) {
        switch (n) {
          case '#playername': return G.nombre();
          case '#achievements_visible': case '#invite_button_visible': case '#server_store_button_visible': case '#is_trial_version':
          case '#permissions_visible': case '#gamerpic_visible':
            return false;
          case '#is_full_version': return true;
          case '#players_grid_dimension': return [1, G.jugadores().length];
          case '#ip': case '#ip_address_text': return '';
        }
      },
      longitud: function (col) { return col === 'players_collection' ? G.jugadores().length : 0; },
      coleccion: function (col, i, n) {
        if (col !== 'players_collection') return undefined;
        var j = G.jugadores()[i];
        if (!j) return undefined;
        if (n === '#gamertag') return j.nombre;
        if (n === '#local_icon_visible') return !!j.local;
        // sin tarjetas de perfil de Xbox: todas las filas son el cartel, no el botón
        if (n === '#button_enabled') return false;
        if (n === '#button_disabled') return true;
        if (n === '#gamerpic_visible' || n === '#permissions_visible') return false;
        return undefined;
      },
      boton: function (id) {
        switch (id) {
          case 'button.menu_continue': case 'button.menu_cancel': G.seguir(); return;
          case 'button.menu_settings': P.ir('ajustesJuego', { partida: G.partida(), seccion: 16 }); return;
          case 'button.menu_how_to_play': P.encima('comoJugar'); return;
          case 'button.menu_quit': case 'button.menu_exit': G.salir(); return;
          case 'button.menu_skins': P.encima('skins'); return;
          case 'button.menu_achievements': P.cartel('xbox.signin', 'porteo.xbox'); return;
        }
      },
      gesto: function (id, dx) { G.girarMuñeco(dx); }
    };
  };

  // ------------------------------------------------------------------------------------------
  // Chat
  // ------------------------------------------------------------------------------------------
  // las opciones de anfitrión de la 1.2 (el botón "/" al lado del texto del chat): hora, clima y
  // teletransportarse a otro jugador. Cada una es un comando, como si se lo escribiera
  var ANF_MENU = ['teleport', 'time', 'weather'];
  var ANF_HORAS = [['sunrise', 'time_1sunrise'], ['day', 'time_2day'], ['noon', 'time_3noon'], ['sunset', 'time_4sunset'],
    ['night', 'time_5night'], ['midnight', 'time_6midnight']];
  var ANF_CLIMAS = [['clear', 'weather_clear', 'clear'], ['rain', 'weather_rain', 'rain'], ['thunder', 'weather_thunderstorm', 'thunderstorm']];
  CTRL.chat = function () {
    var texto = '', anf = null;   // el panel de anfitrión abierto: null, 'main', 'teleport', 'time' o 'weather'
    function enviar() {
      if (!texto.trim()) return;
      G.enviarChat(texto.trim());
      texto = '';
      Jui.sucio();
    }
    function otros() { return G.jugadores().filter(function (j) { return !j.local; }); }
    return {
      binding: function (n) {
        switch (n) {
          case '#chat_title_text': return t(G.trucos() ? 'chat.title.cheats' : 'chat.title');
          case '#text_box_text': case '#message_text_box': return texto;
          case '#send_button_visible': return true;
          case '#chat_visible': return true;
          case '#hide_chat': return false;
          case '#hide_chat_enabled': return false;
          case '#text': return G.textoChat();
          case '#back_button_text': return t('gui.back');
          case '#text_chat_hidden': return t('gui.no');
          case '#cheats_on': return G.trucos();
          case '#host_main_visible': return anf === 'main';
          case '#host_time_visible': return anf === 'time';
          case '#host_weather_visible': return anf === 'weather';
          // "a quién / a dónde" se saltea: la lista de jugadores para ir hasta uno
          case '#host_teleport_main_visible': return false;
          case '#host_teleport_players_visible': return anf === 'teleport';
          case '#host_main_grid_dimension': return [1, ANF_MENU.length];
          case '#host_time_grid_dimension': return [1, ANF_HORAS.length];
          case '#host_weather_grid_dimension': return [1, ANF_CLIMAS.length];
          case '#host_teleport_grid_dimension': return [1, 0];
          case '#players_grid_dimension': return [1, otros().length];
          case '#get_grid_size': return [1, 0];
        }
      },
      longitud: function (col) {
        if (col === 'host_main_collection') return ANF_MENU.length;
        if (col === 'host_time_collection') return ANF_HORAS.length;
        if (col === 'host_weather_collection') return ANF_CLIMAS.length;
        if (col === 'players_collection') return otros().length;
        return 0;
      },
      coleccion: function (col, i, n) {
        if (col === 'host_main_collection') {
          if (n === '#button_text') return t('hostOption.' + ANF_MENU[i]);
          if (n === '#button_navigation') return i;
          if (n === '#button_glyph_visible') return true;
        } else if (col === 'host_time_collection' && ANF_HORAS[i]) {
          if (n === '#button_text') return t('hostOption.time.' + ANF_HORAS[i][0]);
          if (n === '#texture') return 'textures/ui/' + ANF_HORAS[i][1];
          if (n === '#sub_command') return '/time set ' + ANF_HORAS[i][0];
          if (n === '#button_glyph_visible') return true;
        } else if (col === 'host_weather_collection' && ANF_CLIMAS[i]) {
          if (n === '#button_text') return t('hostOption.weather.' + ANF_CLIMAS[i][2]);
          if (n === '#texture') return 'textures/ui/' + ANF_CLIMAS[i][1];
          if (n === '#sub_command') return '/weather ' + ANF_CLIMAS[i][0];
          if (n === '#button_glyph_visible') return true;
        } else if (col === 'players_collection') {
          var j = otros()[i];
          if (n === '#gamertag') return j ? j.nombre : '';
        }
        return undefined;
      },
      textoInicial: function () { return texto; },
      texto: function (n, v) { texto = v; },
      enviar: function () { enviar(); },
      boton: function (id, c) {
        switch (id) {
          case 'button.send_message': case 'button.menu_ok': enviar(); return;
          case 'button.menu_cancel': case 'button.menu_exit': if (anf) { anf = null; return; } G.seguir(); return;
          case 'button.host_toggle': anf = anf ? null : 'main'; return;
          case 'button.host_main': anf = 'main'; return;
          case 'button.menu_navigation': if (c && c.indice >= 0) anf = ANF_MENU[c.indice]; return;
          case 'button.sub_command': {
            var cmd = c && c.b['#sub_command'];
            if (!cmd) return;
            G.comando(anf === 'teleport' ? '/tp ' + cmd : cmd);
            anf = null;
            return;
          }
        }
      }
    };
  };

  // ------------------------------------------------------------------------------------------
  // Muerte
  // ------------------------------------------------------------------------------------------
  // ------------------------------------------------------------------------------------------
  // El inventario (crafting_pocket): a la izquierda las pestañas de la 1.2 (en creativo, todo lo que
  // hay; en supervivencia, el libro de recetas y la mochila), a la derecha fabricar y la armadura,
  // abajo la barra. Los casilleros son colecciones; tocar, mantener y tocar dos veces hacen lo de
  // Inventario.tocar / mitad / juntar con lo agarrado (que sigue al dedo)
  // ------------------------------------------------------------------------------------------
  // el lugar de cada pestaña (las variables que pone el código del juego)
  var PESTANA = { '$search_index': 0, '$construction_index': 1, '$equipment_index': 2, '$items_index': 3, '$nature_index': 4,
    '$survival_index': 5, '$crafting_index': 0, '$armor_index': 1 };
  // las colecciones de la izquierda → la pestaña de Objetos.creativo (construcción 0, naturaleza 1,
  // equipo 2, objetos 3)
  var LISTA_CREATIVA = { recipe_construction: 0, recipe_nature: 1, recipe_equipment: 2, recipe_items: 3 };
  function ctrlInventario(datos) {
    var inv = G.inventario(), creativo = G.creativo(), mesa = !!datos.mesa;
    var todos = G.listaCreativa(), porTab = {}, busqueda = '';
    function lista(tab) {
      if (!porTab[tab]) porTab[tab] = todos.filter(function (it) { return it.tab === tab; });
      return porTab[tab];
    }
    function buscados() {
      var q = busqueda.trim().toLowerCase();
      return q ? todos.filter(function (it) { return Objetos.nombre(it.id, it.m).toLowerCase().indexOf(q) >= 0; }) : todos;
    }
    // la lista de una colección (los casilleros del jugador) o null si es de las creativas
    function casilleros(col) {
      switch (col) {
        case 'inventory_items': return inv.mochila;
        case 'hotbar_items': return inv.barra;
        case 'armor_items': return inv.armadura;
        case 'offhand_items': return inv.mano2;
        case 'crafting_input_items': return inv.fabricar;
      }
      return null;
    }
    function creativaDe(col) {
      if (col === 'recipe_search') return creativo ? buscados() : [];
      var tab = LISTA_CREATIVA[col];
      return tab === undefined ? null : (creativo ? lista(tab) : []);
    }
    var tamFabricar = creativo || mesa ? 9 : 4;
    function cosaEn(col, i) {
      var l = casilleros(col);
      if (l) return col === 'crafting_input_items' && i >= tamFabricar ? null : l[i];
      if (col === 'crafting_output_items') return G.resultadoFabricar ? G.resultadoFabricar(inv, tamFabricar) : null;
      var cr = creativaDe(col);
      return cr && cr[i] ? Inventario.cosa(cr[i].id, cr[i].m, 1) : null;
    }
    function idAux(c) { return c ? c.id * 65536 + c.m : 0; }
    function cerrar() {
      Inventario.devolver(inv, G.tirarObjeto);
      P.cerrar();
      G.cerrarInventario();
    }
    return {
      vars: PESTANA,
      grupoInicial: function (n) {
        if (n === 'navigation_tab') return creativo ? PESTANA['$construction_index'] : PESTANA['$survival_index'];
        if (n === 'right_inventory_navigation_tab') return PESTANA['$crafting_index'];
      },
      binding: function (n) {
        var h = inv.mano;
        switch (n) {
          case '#inventory_selected_item': return idAux(h);
          case '#inventory_selected_item_stack_count': return h && h.n > 1 && !creativo ? String(h.n) : '';
          case '#hover_text': return h ? Objetos.nombre(h.id, h.m) : '';
          case '#recipe_item_name': { var r = cosaEn('crafting_output_items', 0); return r ? Objetos.nombre(r.id, r.m) : ''; }
          case '#progress_bar_visible': return Jui.progresoMantener() >= 0;
          case '#progress_bar_total_amount': return 1;
          case '#progress_bar_current_amount': return Math.max(0, Jui.progresoMantener());
          case '#selected_item_durability_visible': { var dh = h && Items.def[h.id]; return !!(dh && dh.dur && h.d); }
          case '#selected_item_durability_total_amount': { var dt = h && Items.def[h.id]; return dt && dt.dur ? dt.dur : 1; }
          case '#selected_item_durability_current_amount': { var dc = h && Items.def[h.id]; return dc && dc.dur ? dc.dur - (h.d || 0) : 0; }
          case '#is_creative_mode': return creativo;
          case '#is_survival_mode': return !creativo;
        }
      },
      longitud: function (col) {
        var l = casilleros(col);
        if (l) return col === 'crafting_input_items' ? tamFabricar : l.length;
        if (col === 'crafting_output_items') return 1;
        var cr = creativaDe(col);
        return cr ? cr.length : undefined;
      },
      coleccion: function (col, i, n) {
        var c = cosaEn(col, i), d = c && Items.def[c.id], cr = !casilleros(col) && col !== 'crafting_output_items';
        switch (n) {
          case '#item_id_aux': return idAux(c);
          case '#show_item': return !!c;
          case '#inventory_stack_count': case '#recipe_craftable_count': return c && c.n > 1 && !creativo && !cr ? String(c.n) : '';
          case '#item_durability_visible': return !!(d && d.dur && c.d);
          case '#item_durability_total_amount': return d && d.dur ? d.dur : 1;
          case '#item_durability_current_amount': return d && d.dur ? d.dur - (c.d || 0) : 0;
          case '#hover_text': return c ? Objetos.nombre(c.id, c.m) : '';
          case '#inactive_item': return false;
          case '#container_item_background': return 0;
          case '#container_item_modifier': return 0;
          case '#empty_armor_image_visible': return !c;
          case '#item_custom_color': return 0;
        }
      },
      arrastrable: function (c) {
        var q = Jui.coleccionDe(c);
        return !!(q && cosaEn(q.col, q.i));
      },
      boton: function (id, c) {
        var q = c ? Jui.coleccionDe(c) : null;
        if (id === 'button.menu_exit' || id === 'button.menu_cancel' || id === 'button.try_menu_exit') { cerrar(); return; }
        if (!q) {
          // tocar fuera de los casilleros con algo agarrado: en creativo se borra; si no, se tira
          if (id === 'button.cursor_drop_all' || id === 'button.cursor_destroy_all') {
            if (inv.mano && !creativo && G.tirarObjeto) G.tirarObjeto(inv.mano);
            inv.mano = null;
          }
          return;
        }
        var l = casilleros(q.col);
        if (id === 'button.coalesce_stack') { if (l) Inventario.juntar(inv); return; }
        if (q.col === 'crafting_output_items') { if (G.fabricar) G.fabricar(inv, tamFabricar, id !== 'button.crafting_output_primary'); return; }
        if (!l) {
          // de la lista creativa: una (tocar) o una pila entera (mantener); si ya se tenía algo
          // distinto, se cambia
          var nueva = cosaEn(q.col, q.i);
          if (!nueva) return;
          if (id === 'button.recipe_secondary') nueva.n = Inventario.pila(nueva);
          if (inv.mano && Inventario.iguales(inv.mano, nueva) && id !== 'button.recipe_secondary') inv.mano.n = Math.min(Inventario.pila(nueva), inv.mano.n + 1);
          else inv.mano = nueva;
          return;
        }
        if (id === 'button.container_take_half_place_one') Inventario.mitad(inv, l, q.i);
        else Inventario.tocar(inv, l, q.i);
        if (q.col === 'hotbar_items' || q.col === 'armor_items') G.inventarioCambio();
      },
      texto: function (nombre, v) { busqueda = v || ''; },
      textoInicial: function () { return busqueda; }
    };
  }
  CTRL.inventario = ctrlInventario;
  CTRL.inventarioCreativo = ctrlInventario;
  CTRL.mesa = function (d) { d.mesa = true; return ctrlInventario(d); };

  CTRL.muerte = function () {
    return {
      binding: function (n) { if (n === '#death_message' || n === '#text') return G.mensajeMuerte(); },
      boton: function (id) {
        switch (id) {
          case 'button.respawn_button': G.reaparecer(); return;
          case 'button.main_menu_button': G.salir(); return;
          case 'button.menu_cancel': return false;
        }
      }
    };
  };

  // ------------------------------------------------------------------------------------------
  // Skins (Steve y Alex), cómo jugar, desconectado
  // ------------------------------------------------------------------------------------------
  var SKINS = [{ id: 'steve', nombre: 'skin.Standard.Steve' }, { id: 'alex', nombre: 'skin.Standard.Alex' }];
  function indiceSkin(id) { return id === 'alex' ? 1 : 0; }
  // el elegidor de la 1.2: "Por defecto" (Steve y Alex) y "Reciente" a la izquierda; a la derecha el
  // muñeco de la que se está mirando, Deshacer y Confirmar
  CTRL.skins = function () {
    var op = G.opciones();
    var actual = indiceSkin(op.skin), vista = actual;
    function recientes() {
      var l = (op.skinsRecientes || []).filter(function (id) { return id === 'steve' || id === 'alex'; });
      if (!l.length) l = [SKINS[actual].id];
      return l.map(indiceSkin);
    }
    return {
      binding: function (n) {
        switch (n) {
          case '#skin_content_visible': return true;
          case '#skin_search_progress_visible': case '#show_preview_skin_lock': case '#show_reload_custom_skin_button':
          case '#pack_loading_progress_visible': return false;
          case '#default_skins_grid_dimensions': return [2, 1];
          case '#recent_skins_grid_dimensions': return [recientes().length, 1];
          case '#premium_packs_grid_dimensions': case '#premium_skins_grid_dimensions': return [0, 0];
          case '#accept_skin_button_text': return t('skins.picker.accept.button');
          case '#accept_skin_button_enabled': return vista !== actual;
          case '#skin_name': return t(SKINS[vista].nombre);
          case '#preview_skin': return SKINS[vista].id;
          case '#playername': return G.nombre();
          case '#pack_name': return '';
        }
      },
      longitud: function (col) {
        if (col === 'default_skins_collection') return 2;
        if (col === 'recent_skins_collection') return recientes().length;
        return 0;
      },
      coleccion: function (col, i, n) {
        var idx = col === 'recent_skins_collection' ? recientes()[i] : i;
        if (n === '#skin_index') return idx;
        if (n === '#skin_name' || n === '#name') return SKINS[idx] && t(SKINS[idx].nombre);
        if (n === '#skin_lock_visible' || n === '#show_pack_locked' || n === '#show_new_pack_icon') return false;
        return undefined;
      },
      boton: function (id, c) {
        if (id === 'button.view_default_skin' && c && c.indice >= 0) { vista = c.indice; return; }
        if (id === 'button.view_recent_skin' && c && c.indice >= 0) { vista = recientes()[c.indice]; return; }
        if (id === 'button.undo_skin') { vista = actual; return; }
        if (id === 'button.accept_skin') {
          // la que se deja pasa a "Reciente" junto con la nueva
          var r = recientes().map(function (i) { return SKINS[i].id; });
          actual = vista;
          op.skin = SKINS[vista].id;
          r = r.filter(function (x) { return x !== op.skin; });
          r.unshift(op.skin);
          op.skinsRecientes = r.slice(0, 2);
          G.guardarOpciones(); G.aplicarOpciones('skin');
          return;
        }
        if (id === 'button.menu_cancel' || id === 'button.menu_exit') { if (G.jugando()) P.cerrar(); else P.ir('inicio'); }
      },
      gesto: function (id, dx) { G.girarMuñeco(dx); }
    };
  };
  // el título de la sección elegida en la lista de la izquierda (el "#panel_title" de su interruptor)
  function tituloSeccion() {
    var pan = Jui.arriba(), g = pan && pan.grupos && pan.grupos.navigation_tab;
    if (!g) return '';
    for (var i = 0; i < g.miembros.length; i++) {
      var m = g.miembros[i];
      if (m.b['#toggle_state'] && m.b['#panel_title']) return t(m.b['#panel_title']);
    }
    return '';
  }
  CTRL.comoJugar = function () {
    return {
      // la primera sección es la que el juego marca por defecto en la lista (Controles)
      binding: function (n) {
        if (n === '#title_text' || n === '#dialog_title') return t('menu.howToPlay');
        if (n === '#section_title') return tituloSeccion();
        if (n === '#navigation_tab_focus_precedence') return undefined;
      },
      boton: function (id) {
        if (id === 'button.menu_cancel' || id === 'button.menu_exit') { if (G.jugando()) P.cerrar(); else P.ir('inicio'); }
      }
    };
  };
  CTRL.desconectado = function (datos) {
    return {
      binding: function (n) {
        if (n === '#title_text') return t(datos.titulo || 'disconnectionScreen.disconnected');
        if (n === '#disconnect_text') return t(datos.texto || '');
      },
      boton: function (id) { if (id === 'button.menu_leave_screen' || id === 'button.menu_continue' || id === 'button.menu_cancel') P.ir('jugar'); }
    };
  };

  // la primera vez: el idioma (tres botones) y después con o sin los shaders de Tito, en carteles de
  // la 1.2 sobre el título
  P.primeraVez = function (listo) {
    var op = G.opciones();
    function shaders() {
      if (op.shaders !== null && op.shaders !== undefined) { listo(); return; }
      P.cartel('porteo.shadersTitulo', 'porteo.shadersPregunta', [
        { texto: 'porteo.si', hacer: function () { op.shaders = true; G.guardarOpciones(); G.aplicarOpciones('shaders'); listo(); } },
        { texto: 'porteo.no', hacer: function () { op.shaders = false; G.guardarOpciones(); G.aplicarOpciones('shaders'); listo(); } }]);
    }
    if (op.idioma) { shaders(); return; }
    function elegir(c) { op.idioma = c; G.ponerIdioma(c); G.guardarOpciones(); shaders(); }
    P.cartel('porteo.idioma', 'porteo.idiomaPregunta', [
      { texto: 'English', hacer: function () { elegir('en'); } },
      { texto: 'Español', hacer: function () { elegir('es'); } },
      { texto: 'Português', hacer: function () { elegir('pt'); } }]);
  };

  return P;
})();
