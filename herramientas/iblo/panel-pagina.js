/* La pantalla «La página»: lo que deja cambiar la web sin tocar código.
 *
 * Vive aparte del guion grande del panel a propósito. Usa lo que ya está
 * —`$`, `pedir`, `irA`, `decir`— y se engancha sin editar nada de adentro, así
 * que se puede volver a generar con el script sin riesgo de romper lo que
 * funciona.
 *
 * DOS DECISIONES QUE IMPORTAN:
 *
 * · Se trabaja sobre una copia. Nada se manda al servidor hasta «Publicar los
 *   cambios», y el servidor guarda la versión anterior antes de pisarla. Entre
 *   las dos cosas, equivocarse no cuesta nada.
 * · Los colores se eligen con el selector del teléfono, no escribiendo
 *   hexadecimales, y cada uno tiene el nombre de lo que hace —«Fondo»,
 *   «Tarjetas», «Bordes»— en vez del nombre de la variable CSS.
 */
(function () {
  var TONOS = [
    ["ac", "Acento", "El color fuerte: botones, títulos, luces."],
    ["ac2", "Acento 2", "El secundario, más apagado."],
    ["ac3", "Detalle", "Un tercero claro, para remates."],
    ["tinta", "Fondo", "El fondo de la página. Va oscuro."],
    ["tinta2", "Fondo 2", "Un escalón más claro que el fondo."],
    ["humo", "Tarjetas", "El relleno de las cajas."],
    ["linea", "Bordes", "Las líneas finitas."],
    ["papel", "Texto", "El color de las letras. Va claro."],
  ];
  var estado = { esteticas: [], marca: null, abierta: null, cargado: false };

  /* LO QUE HOY MUESTRA LA WEB, ADENTRO DEL PANEL.
     La base arranca vacía y la página, mientras tanto, sigue mostrando la copia
     que trae el HTML. Para que el panel no abra con una lista vacía —que es lo
     que hace que el dueño piense que se borró todo— viene esto: las nueve
     estéticas tal cual están publicadas, diez kilobytes, y un botón que las
     carga. Antes esto se hacía desde la terminal con la contraseña del panel;
     así no hace falta ni la terminal ni la contraseña. */
  var DEFABRICA = {"esteticas":[{"k":"realeza","n":"Realeza","sub":"Elección de Rey y Reina · 19.09.2026","flyer":"realeza","pieza":"corona","dec":"realeza","clip":"upd","mov":"late","wsp":"Hola IBLO! Vi la fiesta de Elección de Rey y Reina y quiero info para el 19/09.","des":"Oro, esmeralda y corona de verdad. La fiesta zonal de la Primavera y del Estudiante cierra con la coronación del Rey y la Reina de toda la zona, con jurado y con las promos de varios pueblos adentro del mismo salón.","f":[["Lugar","Club Juventud · Margarita Belén"],["Arranca","22:00 hs"],["Cabina","DJ Agus Mendoza (set live)"],["Conduce","Maury Abraham"],["Momento","Coronación zonal"]],"paleta":{"tinta":"#0a0906","tinta2":"#13110a","humo":"#1d1a0f","linea":"#3d3418","papel":"#f4f1f6","ac":"#e8bf4e","ac2":"#0f6b45","ac3":"#4ade9a"},"oculta":false,"flyerUrl":""},{"k":"euphoria","n":"Euphoria","sub":"Pre Promo 26 · 02.05.2026","flyer":"euphoria","pieza":"bola","dec":"euphoria","clip":"euphoria","mov":"flota","wsp":"Hola IBLO! Me interesa una fiesta estilo Euphoria, con el stand de glitter. ¿Cómo lo armamos?","des":"Violeta, magenta y neón hasta en el piso. La estética que más nos piden: luz de tubo, brillo en la cara y un stand de glitter abierto toda la noche para que nadie salga como entró.","f":[["Lugar","Club Juventud"],["Start party","00:30 hs"],["Cabina","DJ Agus Mendoza + invitados"],["Clothing code","Colores"],["Adentro","Stand de glitter exclusivo"],["Extra","Conservadora gratis hasta 02:30"]],"paleta":{"tinta":"#0d0716","tinta2":"#170a26","humo":"#1f0f33","linea":"#3a1c5c","papel":"#f4f1f6","ac":"#c34bff","ac2":"#6a1fd0","ac3":"#ff5ce1"},"oculta":false,"flyerUrl":""},{"k":"western","n":"Wéstern","sub":"Cowboy Night · 06.06.2026","flyer":"western","pieza":"sombrero","dec":"western","clip":"western","mov":"gira","wsp":"Hola IBLO! Quiero armar una Cowboy Night con toro mecánico. ¿Me pasás info?","des":"Óxido, madera y revólver cruzado. Se entra de bota y sombrero, hay toro mecánico con premio en tragos para el que aguante arriba, y los mejores outfits se llevan entradas libres para todo el año.","f":[["Lugar","Club Juventud"],["Opening","00:30 hs"],["Cabina","Alan Inamorato · Rodri Ojeda"],["Anima","Gera Animador"],["Dress style","Wéstern (cowboy)"],["Adentro","Toro mecánico · shot de tekila"]],"paleta":{"tinta":"#100905","tinta2":"#1b0f08","humo":"#28170d","linea":"#4a2a17","papel":"#f4f1f6","ac":"#e8863a","ac2":"#8c3d1c","ac3":"#f0d0a0"},"oculta":false,"flyerUrl":""},{"k":"halloween","n":"Halloween","sub":"Noche de brujas · 01.11.2025","flyer":"halloween","pieza":null,"dec":"halloween","clip":"halloween","mov":"flota","wsp":"Hola IBLO! Quiero una fiesta de Halloween con concurso de disfraces. ¿Qué necesito?","des":"Rojo sangre sobre negro, telaraña en el techo y la entrada convertida en cementerio de la joda. Es nuestro evento más grande del año: concurso de disfraces con jurado invitado y premios que se preparan con meses de anticipación.","f":[["Lugar","Club Juventud"],["Open party","00:00 hs"],["Cabina","Alan Inamorato ft Javier Ríos"],["Concurso","Mejor disfraz, con jurado"],["Extra","Conservadora gratis hasta 02:30"],["Deco","Cementerio en el ingreso"]],"paleta":{"tinta":"#0a0405","tinta2":"#150607","humo":"#210809","linea":"#451012","papel":"#f4f1f6","ac":"#ff2020","ac2":"#8a0505","ac3":"#ff8a3d"},"oculta":false,"flyerUrl":""},{"k":"audiocar","n":"Audio Car","sub":"Despedida de año · 27.12.2025","flyer":"audiocar","pieza":"parlante","dec":"audiocar","clip":"noche","mov":"late","wsp":"Hola IBLO! Me interesa un evento Audio Car al aire libre. ¿Cómo es la producción?","des":"Cromo, magenta y cian: los equipos de sonido más grandes del NEA estacionados en el mismo predio. Abre de tarde al aire libre y sigue de noche adentro. Es la despedida del año y la única fecha donde la música la ponen los autos.","f":[["Lugar","Predio Camping Municipal"],["Open predio","18:00 hs"],["Open boliche","00:00 hs"],["Sonido","Los equipos más grandes del NEA"],["Ingreso","Con conservadora (sin vidrios)"],["Cabina","DJs invitados"]],"paleta":{"tinta":"#0c0512","tinta2":"#17081f","humo":"#230c2e","linea":"#451857","papel":"#f4f1f6","ac":"#ff2ba6","ac2":"#1fb6e0","ac3":"#ffb020"},"oculta":false,"flyerUrl":""},{"k":"semaforo","n":"Semáforo","sub":"Día de los enamorados · 15.02.2025","flyer":"semaforo","pieza":null,"dec":"semaforo","clip":"semaforo","mov":"flota","wsp":"Hola IBLO! Quiero hacer una Fiesta del Semáforo. ¿Me pasás info?","des":"Verde, amarillo y rojo, y cada color dice algo. Rojo si venís en pareja, amarillo si es amistad con derechos, verde si estás soltero. Se entra con la pulsera puesta y la noche se ordena sola.","f":[["Rojo","En pareja"],["Amarillo","Amigos con derechos"],["Verde","Soltero"],["Cabina","Javier Ríos · Alan Inamorato · Agus Mendoza"],["Anima","Gera Animador"],["Extra","Conservadora gratis hasta 02:00"]],"paleta":{"tinta":"#050a06","tinta2":"#08130b","humo":"#0d1f11","linea":"#1a3d22","papel":"#f4f1f6","ac":"#2ce65a","ac2":"#b81717","ac3":"#ffe14d"},"oculta":false,"flyerUrl":""},{"k":"ice","n":"Ice Party","sub":"Recibimiento del invierno · 21.06.2025","flyer":"ice","pieza":null,"dec":"ice","clip":"pre5to","mov":"flota","wsp":"Hola IBLO! Me interesa una Ice Party para mi promo. ¿Cómo lo vemos?","des":"Cian, hielo roto y vidrio suspendido. La fecha con la que recibimos el invierno, hecha junto a la pre promo de Colonia Benítez. Estética helada y la cabina más caliente que tenemos.","f":[["Lugar","Salón Multiusos · Colonia Benítez"],["Open","00:30 hs"],["Cabina","Alan Inamorato"],["Con","Pre promo 4to 1ra"],["Extra","Conservadora gratis hasta 02:30"]],"paleta":{"tinta":"#03090c","tinta2":"#061318","humo":"#0a2028","linea":"#134450","papel":"#f4f1f6","ac":"#2fd8e8","ac2":"#0e6f86","ac3":"#d6f7ff"},"oculta":false,"flyerUrl":""},{"k":"pirata","n":"Noche Pirata","sub":"Presentación de la 23 · 03.05.2023","flyer":"pirata","pieza":null,"dec":"pirata","clip":"disfraz","mov":"flota","wsp":"Hola IBLO! Quiero una fiesta temática tipo Noche Pirata. ¿Me pasás info?","des":"Oro viejo, negro y bandera. Una de las primeras temáticas de la casa, en Las Garcitas, con premio al mejor disfraz pirata y la presentación oficial de la promo 2023.","f":[["Lugar","Las Garcitas"],["Premio","Mejor disfraz pirata"],["Presenta","La 23"],["Época","Los primeros años"]],"paleta":{"tinta":"#080706","tinta2":"#12100b","humo":"#1c1810","linea":"#3a301a","papel":"#f4f1f6","ac":"#d4af37","ac2":"#7a1414","ac3":"#e8d9a0"},"oculta":false,"flyerUrl":""},{"k":"zonal","n":"Zonal Party","sub":"Complejo Luzzi · 14.10.2023","flyer":"zonal","pieza":"bola","dec":"zonal","clip":"vibras","mov":"late","wsp":"Hola IBLO! Quiero armar una fiesta zonal en mi localidad. ¿Llegan hasta acá?","des":"El primer mega evento: traer a un artista de afuera de la provincia a un pueblo del interior. Sonido y show de luces de la nueva generación, y el Complejo Luzzi transformado entero para una sola noche.","f":[["Lugar","Complejo Luzzi · Las Garcitas"],["Invitado","Facu Vázquez (1ª vez en Chaco)"],["DJ zonal","Yona Pérez"],["Anima","Gera Animador"],["Ingreso","Con conservadora"]],"paleta":{"tinta":"#0a0714","tinta2":"#130b20","humo":"#1c1030","linea":"#372058","papel":"#f4f1f6","ac":"#a855f7","ac2":"#c81e5a","ac3":"#38bdf8"},"oculta":false,"flyerUrl":""}],"marca":{"paleta":{"ac":"#ff1e8e","ac2":"#8b2fd6","ac3":"#ffd23f","tinta":"#08070c","tinta2":"#100d18","humo":"#1a1622","linea":"#2b2436","papel":"#f4f1f6"},"curva":18,"grano":0.045,"titular":"Anton","texto":"Barlow"}};

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var aviso = function (t, c) {
    var n = document.getElementById("pgAviso");
    if (!t) { n.hidden = true; return; }
    n.hidden = false; n.textContent = t; n.className = "aviso" + (c ? " " + c : "");
  };

  /* ------------------------------------------------------------ dibujar */
  function tonos(p, prefijo) {
    var h = "";
    for (var i = 0; i < TONOS.length; i++) {
      var t = TONOS[i];
      h += '<label class="tono" title="' + esc(t[2]) + '">' +
           '<input type="color" data-tono="' + t[0] + '" data-pref="' + prefijo + '" value="' +
             esc(p[t[0]] || "#000000") + '">' +
           '<span>' + esc(t[1]) + '</span></label>';
    }
    return h;
  }
  var paleta = function (p, pref) { return '<div class="paleta">' + tonos(p, pref) + "</div>"; };

  function fichas(e, i) {
    var h = '<div class="fichasEd" data-i="' + i + '">';
    for (var k = 0; k < e.f.length; k++)
      h += '<div class="fichaFila"><input class="fk" value="' + esc(e.f[k][0]) +
           '" placeholder="Lugar" maxlength="30"><input class="fv" value="' + esc(e.f[k][1]) +
           '" placeholder="Club Juventud" maxlength="90">' +
           '<button type="button" class="mini" data-fuera="' + k + '" aria-label="Sacar">×</button></div>';
    return h + '<button type="button" class="chip" data-masficha="1">+ Otro dato</button></div>';
  }

  function tarjeta(e, i) {
    var abierta = estado.abierta === i;
    var h = '<div class="estCard' + (e.oculta ? " apagada" : "") + '" data-i="' + i + '">' +
      '<div class="estCab" data-abre="1" role="button" tabindex="0" ' +
           'aria-expanded="' + (abierta ? "true" : "false") + '">' +
        '<span class="punto" style="background:' + esc(e.paleta.ac) + '"></span>' +
        '<div class="estNom"><b>' + esc(e.n || "Sin nombre") + '</b>' +
          '<span>' + esc(e.sub || "—") + '</span></div>' +
        '<button type="button" class="mini" data-ojo="1" ' +
          'aria-label="' + (e.oculta ? "Mostrar en la web" : "Esconder de la web") + '">' +
          (e.oculta ? "◌" : "●") + '</button>' +
        '<button type="button" class="mini" data-sube="1" aria-label="Subir">▲</button>' +
        '<button type="button" class="mini" data-baja="1" aria-label="Bajar">▼</button>' +
        '<span class="chevron">' + (abierta ? "▴" : "▾") + '</span>' +
      '</div>';
    if (abierta) {
      h += '<div class="estCuerpo">' +
        '<div class="campo"><label>Nombre</label>' +
          '<input data-c="n" value="' + esc(e.n) + '" maxlength="40"></div>' +
        '<div class="campo"><label>Bajada</label>' +
          '<input data-c="sub" value="' + esc(e.sub) + '" maxlength="90" ' +
          'placeholder="Cowboy Night · 06.06.2026"></div>' +
        '<div class="campo"><label>Descripción</label>' +
          '<textarea data-c="des" maxlength="700" style="min-height:96px">' + esc(e.des) + '</textarea></div>' +
        '<div class="campo"><label>Los datos que se listan</label>' + fichas(e, i) + '</div>' +
        '<div class="campo"><label>Mensaje de WhatsApp</label>' +
          '<input data-c="wsp" value="' + esc(e.wsp) + '" maxlength="300"></div>' +
        '<div class="campo"><label>Foto del flyer</label>' +
          '<input type="file" accept="image/*" data-flyer="1">' +
          (e.flyerUrl ? '<img class="previaFlyer" src="' + esc(e.flyerUrl) + '" alt="">' : "") +
          '<p class="baja">Si no subís ninguna, queda la que ya tenía.</p></div>' +
        '<label>Colores de esta fiesta</label>' + paleta(e.paleta, "e" + i) +
        '<button type="button" class="bt malo" data-borra="1" style="margin-top:14px">' +
          'Sacar esta estética</button>' +
      "</div>";
    }
    return h + "</div>";
  }

  function pintar() {
    var l = document.getElementById("pgLista");
    l.innerHTML = estado.esteticas.map(tarjeta).join("");
  }

  function pintarMarca() {
    var m = estado.marca || {};
    document.getElementById("pgPalMarca").innerHTML = tonos(m.paleta || {}, "m");
    document.getElementById("pgCurva").value = m.curva == null ? 18 : m.curva;
    document.getElementById("pgCurvaV").textContent = (m.curva == null ? 18 : m.curva) + " px";
    var g = Math.round((m.grano == null ? 0.045 : m.grano) * 1000);
    document.getElementById("pgGrano").value = g;
    document.getElementById("pgGranoV").textContent = (g / 10).toFixed(1).replace(".", ",") + " %";
  }

  /* --------------------------------------------------------- traer/guardar */
  function cargarPagina() {
    if (estado.cargado) return;
    aviso("");
    pedir("/sitio").then(function (d) {
      var a = (d && d.areas) || {};
      estado.esteticas = Array.isArray(a.esteticas) ? a.esteticas : [];
      /* cuántas está mostrando la web AHORA: las de la base si hay, y si no las
         de fábrica, que son las que el HTML dibuja de respaldo */
      estado.enLaWeb = estado.esteticas.length
        ? estado.esteticas.filter(function (e) { return !e.oculta; }).length
        : DEFABRICA.esteticas.length;
      /* Si la base todavía no tiene nada, se arranca de los colores que ya trae
         la web, no de negro: abrir el panel no tiene que ofrecer romper todo. */
      estado.marca = a.marca || { paleta: {
        ac: "#ff1e8e", ac2: "#8b2fd6", ac3: "#ffd23f", tinta: "#08070c",
        tinta2: "#100d18", humo: "#1a1622", linea: "#2b2436", papel: "#f4f1f6" },
        curva: 18, grano: 0.045 };
      if (!estado.marca.paleta) estado.marca.paleta = {};
      estado.cargado = true;
      /* La base arranca vacía: hasta que el dueño publique algo, la web sigue
         mostrando lo que trae el HTML. Se avisa, porque si no parece un error. */
      document.getElementById("pgTraer").hidden = estado.esteticas.length > 0;
      if (!estado.esteticas.length)
        aviso("La web está mostrando las nueve de siempre. Traelas acá y quedan " +
              "todas editables.", "");
      pintar(); pintarMarca();
    }).catch(function (e) { aviso(e.message, "mal"); });
  }

  /* LO QUE MAS DUELE ES PUBLICAR DE MENOS.
     Lo que se publica REEMPLAZA a lo que muestra la web, no se suma. Alcanza
     con tocar «empezar una en blanco» y publicar para que las nueve de siempre
     desaparezcan y quede una sola vacía. Pasó. Así que antes de subir se cuenta
     qué va a quedar contra qué hay hoy, y si es menos hay que confirmarlo. */
  function loQueSeVe() {
    return estado.esteticas.filter(function (e) { return !e.oculta; }).length;
  }
  function sinCargar() {
    return estado.esteticas.filter(function (e) {
      return !e.oculta && !e.des && !(e.f && e.f.length);
    });
  }
  function puedePublicar() {
    var quedan = loQueSeVe();
    if (!quedan) {
      aviso("Así la web se queda sin ninguna fiesta. Si querés sacar una, " +
            "usá el ojito; no las borres todas.", "mal");
      return false;
    }
    var hoy = estado.enLaWeb == null ? DEFABRICA.esteticas.length : estado.enLaWeb;
    if (quedan < hoy && !confirm(
        "La web muestra " + hoy + " fiestas y vas a dejar " + quedan + ".\n\n" +
        "Las otras " + (hoy - quedan) + " desaparecen. ¿Seguro?")) return false;
    var flojas = sinCargar();
    if (flojas.length && !confirm(
        (flojas.length === 1 ? "«" + (flojas[0].n || "Una") + "» está sin cargar"
                             : "Hay " + flojas.length + " sin cargar") +
        " (sin descripción ni datos).\n\n¿Publicar igual?")) return false;
    return true;
  }

  function guardar() {
    if (!puedePublicar()) return;
    var bt = document.getElementById("pgBtGuardar");
    bt.disabled = true;
    var antes = bt.textContent; bt.textContent = "Publicando…";
    pedir("/sitio", { metodo: "PUT", cuerpo: { area: "esteticas", valor: estado.esteticas } })
      .then(function () {
        return pedir("/sitio", { metodo: "PUT", cuerpo: { area: "marca", valor: estado.marca } });
      })
      .then(function () {
        estado.enLaWeb = loQueSeVe();
        aviso("Listo, la web ya está cambiada: " + estado.enLaWeb + " fiestas.", "bien");
      })
      .catch(function (e) { aviso(e.message, "mal"); })
      .then(function () { bt.disabled = false; bt.textContent = antes; });
  }

  function deshacer() {
    if (!confirm("¿Volver la página a como estaba antes del último cambio?")) return;
    pedir("/sitio", { metodo: "POST", cuerpo: { area: "esteticas" } })
      .then(function (d) {
        if (d && d.valor) estado.esteticas = d.valor;
        return pedir("/sitio", { metodo: "POST", cuerpo: { area: "marca" } }).catch(function () { return null; });
      })
      .then(function (d) {
        if (d && d.valor) estado.marca = d.valor;
        pintar(); pintarMarca(); aviso("Volvió a como estaba.", "bien");
      })
      .catch(function (e) { aviso(e.message, "mal"); });
  }

  /* --------------------------------------------------------------- la IA */
  function porIA() {
    var idea = document.getElementById("pgIdea").value.trim();
    if (!idea) { aviso("Contame de qué va la fiesta.", "mal"); return; }
    var bt = document.getElementById("pgBtIA");
    bt.disabled = true; var antes = bt.textContent; bt.textContent = "Pensando…";
    pedir("/estilo", { metodo: "POST", cuerpo: { idea: idea } })
      .then(function (d) {
        estado.esteticas.push(d.estetica);
        estado.abierta = estado.esteticas.length - 1;
        pintar();
        document.getElementById("pgIdea").value = "";
        aviso("La escribió " + (d.de || "la IA") + ". Miralo bien y corregí lo que quieras: " +
              "todavía no está publicada.", "bien");
      })
      .catch(function (e) { aviso(e.message, "mal"); })
      .then(function () { bt.disabled = false; bt.textContent = antes; });
  }

  /* ------------------------------------------------------------- eventos */
  function idx(n) {
    var c = n.closest("[data-i]");
    return c ? +c.dataset.i : -1;
  }

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) {
      /* Tocar la fila abre el editor. Va DESPUÉS de buscar el botón: las
         flechitas y el ojo están adentro de la fila y tienen que seguir
         haciendo lo suyo sin desplegarla. Cuatro botoncitos iguales de medio
         centímetro en un teléfono no se distinguen; el blanco grande es la
         fila entera. */
      var cab = ev.target.closest(".estCab[data-abre]");
      if (cab) {
        var ic = idx(cab);
        if (ic >= 0) { estado.abierta = estado.abierta === ic ? null : ic; pintar(); }
      }
      return;
    }
    if (b.id === "pgBtGuardar") return guardar();
    if (b.id === "pgBtDeshacer") return deshacer();
    if (b.id === "pgBtIA") return porIA();
    /* LOS DOS BOTONES DE VOLVER ATRAS.
       «Deshacer» va un paso para atras y depende del historial. Esto es otra
       cosa: no importa cuantos pasos se dieron ni si el historial llega, vuelve
       a los valores de fabrica, que viajan adentro del panel. Es el boton que
       hace falta el dia en que algo quedo feo y nadie se acuerda que toco. */
    if (b.id === "pgResetColor") {
      if (!confirm("Devuelve los colores de fábrica: los de la página y los de " +
                   "cada fiesta.\n\nLos nombres y los textos quedan como están. ¿Dale?")) return;
      var deFab = {};
      DEFABRICA.esteticas.forEach(function (x) { deFab[x.k] = x.paleta; });
      estado.esteticas.forEach(function (e) {
        e.paleta = JSON.parse(JSON.stringify(deFab[e.k] || DEFABRICA.marca.paleta));
      });
      estado.marca = JSON.parse(JSON.stringify(DEFABRICA.marca));
      /* la vista previa del panel tambien se tiñe con esto, hay que devolverla */
      for (var t = 0; t < TONOS.length; t++)
        document.documentElement.style.removeProperty("--" + TONOS[t][0]);
      document.documentElement.style.removeProperty("--curva");
      pintar(); pintarMarca();
      aviso("Colores de fábrica puestos. Tocá «Publicar» para que se vean en la web.", "bien");
      return;
    }
    if (b.id === "pgResetTodo") {
      if (!confirm("Vuelve TODO como el primer día: las nueve fiestas de siempre, " +
                   "con sus colores y sus textos.\n\nLo que hayas cambiado se pierde. ¿Dale?")) return;
      estado.esteticas = JSON.parse(JSON.stringify(DEFABRICA.esteticas));
      estado.marca = JSON.parse(JSON.stringify(DEFABRICA.marca));
      estado.enLaWeb = estado.esteticas.length;   // que no vuelva a preguntar por «dejás menos»
      for (var u = 0; u < TONOS.length; u++)
        document.documentElement.style.removeProperty("--" + TONOS[u][0]);
      document.documentElement.style.removeProperty("--curva");
      document.getElementById("pgTraer").hidden = true;
      pintar(); pintarMarca();
      guardar();                                   // este si se publica solo
      return;
    }
    if (b.id === "pgTraer") {
      estado.esteticas = JSON.parse(JSON.stringify(DEFABRICA.esteticas));
      estado.marca = JSON.parse(JSON.stringify(DEFABRICA.marca));
      document.getElementById("pgTraer").hidden = true;
      pintar(); pintarMarca();
      aviso("Listas las nueve. Cambiá lo que quieras y tocá «Publicar los cambios».", "bien");
      document.querySelector(".masFiesta").open = false;
      return;
    }
    if (b.id === "pgBtNueva") {
      var base = {}; for (var i = 0; i < TONOS.length; i++) base[TONOS[i][0]] =
        (estado.marca && estado.marca.paleta && estado.marca.paleta[TONOS[i][0]]) || "#888888";
      estado.esteticas.push({ k: "nueva-" + Date.now().toString(36).slice(-4), n: "Nueva",
        sub: "", des: "", wsp: "", f: [], paleta: base, flyer: "", flyerUrl: "",
        pieza: null, dec: null, clip: null, mov: "flota", oculta: false });
      estado.abierta = estado.esteticas.length - 1;
      return pintar();
    }
    var s = b.closest("#pgSolapas");
    if (s) {
      [].forEach.call(s.children, function (x) { x.classList.toggle("viva", x === b); });
      document.getElementById("pgEst").hidden = b.dataset.s !== "est";
      document.getElementById("pgMarca").hidden = b.dataset.s !== "marca";
      return;
    }
    var i = idx(b); if (i < 0) return;
    var e = estado.esteticas[i]; if (!e) return;
    if (b.dataset.ojo) { e.oculta = !e.oculta; return pintar(); }
    if (b.dataset.sube && i > 0) {
      estado.esteticas.splice(i - 1, 0, estado.esteticas.splice(i, 1)[0]);
      estado.abierta = null; return pintar();
    }
    if (b.dataset.baja && i < estado.esteticas.length - 1) {
      estado.esteticas.splice(i + 1, 0, estado.esteticas.splice(i, 1)[0]);
      estado.abierta = null; return pintar();
    }
    if (b.dataset.borra) {
      if (!confirm("¿Sacar «" + (e.n || "esta") + "» de la web?")) return;
      estado.esteticas.splice(i, 1); estado.abierta = null; return pintar();
    }
    if (b.dataset.masficha) { e.f.push(["", ""]); return pintar(); }
    if (b.dataset.fuera != null) { e.f.splice(+b.dataset.fuera, 1); return pintar(); }
  });

  /* Los textos se anotan al salir del campo y no en cada tecla: volver a
     dibujar la tarjeta en cada letra le saca el foco al que está escribiendo. */
  document.addEventListener("input", function (ev) {
    var n = ev.target;
    if (n.id === "pgCurva") {
      estado.marca.curva = +n.value;
      document.getElementById("pgCurvaV").textContent = n.value + " px";
      document.documentElement.style.setProperty("--curva", n.value + "px");
      return;
    }
    if (n.id === "pgGrano") {
      estado.marca.grano = +n.value / 1000;
      document.getElementById("pgGranoV").textContent = (+n.value / 10).toFixed(1).replace(".", ",") + " %";
      return;
    }
    if (n.dataset && n.dataset.tono) {
      var p = n.dataset.pref;
      if (p === "m") {
        estado.marca.paleta = estado.marca.paleta || {};
        estado.marca.paleta[n.dataset.tono] = n.value;
        /* se ve en el panel mismo: es la forma más rápida de saber si un color
           se lee o no, sin ir a la web y volver */
        document.documentElement.style.setProperty("--" + n.dataset.tono, n.value);
      } else {
        var j = +p.slice(1);
        if (estado.esteticas[j]) {
          estado.esteticas[j].paleta[n.dataset.tono] = n.value;
          var pt = document.querySelector('.estCard[data-i="' + j + '"] .punto');
          if (pt && n.dataset.tono === "ac") pt.style.background = n.value;
        }
      }
      return;
    }
    var i = idx(n); if (i < 0) return;
    var e = estado.esteticas[i]; if (!e) return;
    if (n.dataset.c) { e[n.dataset.c] = n.value; return; }
    if (n.classList.contains("fk") || n.classList.contains("fv")) {
      var fila = n.closest(".fichaFila");
      var k = [].indexOf.call(fila.parentNode.querySelectorAll(".fichaFila"), fila);
      if (e.f[k]) e.f[k][n.classList.contains("fk") ? 0 : 1] = n.value;
    }
  });

  /* La foto del flyer se sube al depósito que ya usa el archivo y queda como
     dirección: meterla en base64 adentro del contenido lo haría pesar megas. */
  document.addEventListener("change", function (ev) {
    var n = ev.target;
    if (!n.dataset || !n.dataset.flyer || !n.files || !n.files[0]) return;
    var i = idx(n); if (i < 0) return;
    var f = n.files[0];
    if (f.size > 6e6) { aviso("Esa foto pesa mucho. Mandá una más liviana.", "mal"); return; }
    aviso("Subiendo la foto…");
    var lector = new FileReader();
    lector.onload = function () {
      pedir("/archivo", { metodo: "POST", cuerpo: { nuevaSeccion: "Flyers" } })
        .catch(function () { return null; })
        .then(function () {
          return pedir("/archivo", { metodo: "POST", cuerpo: {
            seccion: "flyers", titulo: estado.esteticas[i].n || "Flyer", medio: lector.result } });
        })
        .then(function (d) {
          estado.esteticas[i].flyerUrl = API + "/archivo?id=" + d.id;
          pintar(); aviso("Foto lista. Falta publicar los cambios.", "bien");
        })
        .catch(function (e) { aviso(e.message, "mal"); });
    };
    lector.readAsDataURL(f);
  });

  /* --------------------------------------------------------- engancharse */
  if (typeof PANTALLAS !== "undefined" && PANTALLAS.indexOf("pPagina") < 0)
    PANTALLAS.push("pPagina");
  if (typeof irA === "function") {
    var original = irA;
    irA = function (p) { original(p); if (p === "pPagina") cargarPagina(); };
  }
  window.cargarPagina = cargarPagina;
})();
