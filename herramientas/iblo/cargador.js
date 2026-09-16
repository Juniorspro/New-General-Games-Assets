/* Trae de /api/sitio lo que el dueño cambió desde el panel y lo aplica.
 *
 * TRES REGLAS QUE DECIDEN EL DISEÑO:
 *
 * 1. La página nunca queda en blanco. El HTML sigue trayendo su copia de las
 *    estéticas y sus colores, y eso es lo que se ve al instante. Esto llega
 *    después y sólo pisa lo que cambió. Si la API está caída, se ve lo de hoy.
 * 2. Los colores no necesitan volver a dibujar nada. Son variables CSS: se
 *    reemplaza una hoja de estilos y la página se retiñe sola, sin parpadeo.
 *    Por eso "cambiar colores" es la parte barata y segura.
 * 3. Agregar o sacar estéticas sí necesita redibujar, y eso lo hace la página,
 *    no esto: cada página expone `window.ibloPintar(lista)` porque el
 *    escritorio y el celular dibujan distinto. Si una página no lo expone, los
 *    colores y las secciones igual funcionan.
 *
 * La copia en localStorage es para que el cambio se vea EN EL PRIMER CUADRO de
 * la segunda visita: sin eso, el que entra ve un instante los colores viejos y
 * después el salto.
 */
(function () {
  var CACHE = "iblo.sitio.v1";
  var TONOS = ["ac", "ac2", "ac3", "tinta", "tinta2", "humo", "linea", "papel"];

  function css(areas) {
    var t = "";
    var m = areas.marca;
    if (m) {
      var v = "";
      if (m.paleta) for (var i = 0; i < TONOS.length; i++)
        if (m.paleta[TONOS[i]]) v += "--" + TONOS[i] + ":" + m.paleta[TONOS[i]] + ";";
      if (m.paleta && m.paleta.ac) v += "--acs:" + rgb(m.paleta.ac) + ";";
      if (m.curva != null) v += "--curva:" + m.curva + "px;";
      if (m.grano != null) v += "--grano:" + m.grano + ";";
      if (v) t += ":root{" + v + "}";
    }
    var e = areas.esteticas || [];
    for (var j = 0; j < e.length; j++) {
      var p = e[j].paleta; if (!p) continue;
      var s = "";
      for (var k = 0; k < TONOS.length; k++)
        if (p[TONOS[k]]) s += "--" + TONOS[k] + ":" + p[TONOS[k]] + ";";
      if (p.ac) s += "--acs:" + rgb(p.ac) + ";";
      if (s) t += '[data-est="' + e[j].k + '"]{' + s + "}";
    }
    return t;
  }
  /* --acs es el mismo acento en componentes, que las sombras usan con alfa */
  function rgb(h) {
    return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16) || 0; }).join(",");
  }

  function secciones(lista) {
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      var n = document.querySelector('[data-sec="' + s.id + '"]') || document.getElementById(s.id);
      if (!n) continue;
      n.hidden = !!s.oculta;
      if (s.titulo) { var h = n.querySelector("h1,h2,h3"); if (h) h.textContent = s.titulo; }
      if (s.texto) { var p = n.querySelector("p"); if (p) p.textContent = s.texto; }
    }
  }

  /* El flyer de una estética nueva no está adentro del HTML —los que están
     vienen en base64 desde antes—, así que llega por dirección. Se cambia el
     src después de dibujar en vez de tocar el código que dibuja: así funciona
     igual en la versión de escritorio y en la de celular, que arman la tarjeta
     distinto. Y si no hay ni foto vieja ni dirección, se esconde el hueco. */
  function flyers(lista) {
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      var sec = document.querySelector('[data-est="' + e.k + '"]');
      if (!sec) continue;
      var im = sec.querySelector(".flyer img, .fondoHoja img");
      if (!im) continue;
      if (e.flyerUrl) im.src = e.flyerUrl;
      else if (!im.getAttribute("src") || im.getAttribute("src") === "undefined") im.hidden = true;
    }
  }

  function aplicar(areas, deLaRed) {
    if (!areas) return;
    try {
      var hoja = document.getElementById("ibloTemas");
      if (!hoja) {
        hoja = document.createElement("style");
        hoja.id = "ibloTemas";
        document.head.appendChild(hoja);      // al final: gana por orden, sin !important
      }
      hoja.textContent = css(areas);
      if (areas.secciones) secciones(areas.secciones);
      var e = areas.esteticas;
      if (e && e.length && window.ibloPintar) {
        var vivas = e.filter(function (x) { return !x.oculta; });
        if (vivas.length) window.ibloPintar(vivas);
      }
      if (e) flyers(e);
    } catch (err) {
      if (deLaRed) try { localStorage.removeItem(CACHE); } catch (e2) {}
    }
  }

  /* Qué estéticas se dibujaron REALMENTE en este cargado. El bloque de datos
     de la página ya leyó esta misma copia antes de dibujar, así que esto es lo
     que el visitante tiene en pantalla. */
  function llaves(a) {
    return ((a && a.esteticas) || []).filter(function (x) { return !x.oculta; })
      .map(function (x) { return x.k; }).join(",");
  }
  /* Salida de emergencia: iblo-eventos.pages.dev/?limpiar borra la copia local
     y recarga. Existe porque la copia vive en el teléfono de cada uno y desde
     el servidor no se la puede tocar: si alguna vez queda pegada algo raro, es
     un link que se manda por WhatsApp y listo. */
  if (location.search.indexOf("limpiar") >= 0) {
    try {
      localStorage.removeItem(CACHE);
      sessionStorage.removeItem("iblo.recargo");
    } catch (e) {}
    location.replace(location.pathname);
    return;
  }

  var previo = null;
  try {
    var g = localStorage.getItem(CACHE);
    if (g) { previo = JSON.parse(g); aplicar(previo, false); }
  } catch (e) {}

  function tieneAlgo(o) {
    for (var q in (o || {})) return true;
    return false;
  }

  /* Colores, textos y esconder secciones se aplican en caliente y listo.
     AGREGAR O SACAR una estética es otra cosa: hay que volver a dibujar la
     baraja, los observadores de scroll, los videos y las piezas 3D. Volver a
     correr todo eso a mano en una página de dos megas es donde se rompen las
     cosas; recargar una vez es feo por medio segundo y no falla nunca. Pasa
     sólo en la primera visita después del cambio, porque enseguida queda en la
     copia local y se dibuja de entrada.

     El candado guarda A QUÉ se recargó, no un simple «ya recargué»: con un
     booleano, el segundo cambio del día no se aplicaba nunca. */
  function recargarSiHaceFalta(antes, ahora) {
    if (ahora === antes) return;
    try {
      if (sessionStorage.getItem("iblo.recargo") === ahora) return;
      sessionStorage.setItem("iblo.recargo", ahora);
      location.reload();
    } catch (e) {}
  }

  if (!window.fetch) return;
  fetch("/api/sitio", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.areas) return;

      if (!tieneAlgo(d.areas)) {
        /* EL SERVIDOR SE QUEDÓ SIN NADA. Si acá había una copia guardada hay
           que BORRARLA y sacar la hoja de estilos, o el que la tenía sigue
           viendo lo viejo PARA SIEMPRE y arreglar el servidor no lo alcanza.
           Pasó de verdad: una paleta celeste quedó pegada en un teléfono con
           la base ya limpia, y desde el sitio no había forma de despegarla. */
        try { localStorage.removeItem(CACHE); } catch (e) {}
        if (tieneAlgo(previo)) {
          var hoja = document.getElementById("ibloTemas");
          if (hoja) hoja.textContent = "";             // los colores vuelven ya
          recargarSiHaceFalta(llaves(previo), "");     // la lista, al recargar
        }
        return;
      }

      var antes = llaves(previo), ahora = llaves(d.areas);
      try { localStorage.setItem(CACHE, JSON.stringify(d.areas)); } catch (e) {}
      aplicar(d.areas, true);
      recargarSiHaceFalta(antes, ahora);
    })
    .catch(function () {});
})();
