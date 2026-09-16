/* ===========================================================================
   Frutiger Aero — el escritorio

   Cinco cosas, en este orden:
     1. la sesión (invitado o Google)
     2. las ventanas, el menú de inicio y la barra de abajo
     3. el panel de control, que retiñe el vidrio de verdad
     4. buscaminas, el bloc y el reproductor
     5. los adornos: reloj y burbujas

   NADA SE GUARDA EN UN SERVIDOR. El perfil de Google se verifica del lado del
   servidor —para que nadie entre con un token inventado— pero después vive en
   el navegador de quien entró. Las notas, el color del vidrio y el récord del
   buscaminas también. Es un escritorio de adorno: no hay nada que proteger, y
   una base de datos acá sería pedir datos de gente a cambio de nada.
   =========================================================================== */
(function(){
"use strict";

var $  = function(i){ return document.getElementById(i); };
var $$ = function(s, r){ return [].slice.call((r||document).querySelectorAll(s)); };
var quieto = matchMedia("(prefers-reduced-motion:reduce)").matches;

/* almacenamiento que no explota: en pestaña privada localStorage tira, y una
   página que se cae por no poder guardar una preferencia es una página rota */
var caja = {
  leer: function(k, x){ try{ var v = localStorage.getItem("fa."+k); return v===null?x:JSON.parse(v); }catch(e){ return x; } },
  poner: function(k, v){ try{ localStorage.setItem("fa."+k, JSON.stringify(v)); }catch(e){} },
  sacar: function(k){ try{ localStorage.removeItem("fa."+k); }catch(e){} }
};

/* =========================================================== 1 · la sesión */
var usuario = caja.leer("usuario", null);

function retratoDe(u){
  if (u && u.foto) return '<img class="r" src="'+u.foto+'" alt="" referrerpolicy="no-referrer">';
  return '<img class="r" src="img/mascota/m-saludando.463f6804.webp" alt="">';
}

function entrar(u){
  usuario = u;
  caja.poner("usuario", u);
  var b = $("bienvenida");
  b.hidden = false;
  $("logon").classList.add("yendo");
  setTimeout(function(){
    $("logon").hidden = true;
    b.hidden = true;
    document.body.classList.remove("sinsesion");
    $("escritorio").hidden = false;
    arrancarCelu();
    pintarUsuario();
    quizasColaborar();
    document.dispatchEvent(new CustomEvent("hay-sesion"));
  }, quieto ? 60 : 1500);
}

function salir(){
  caja.sacar("usuario");
  location.reload();
}

function pintarUsuario(){
  if (!usuario) return;
  $("quien-nombre").textContent = usuario.nombre;
  $("quien-rol").textContent = usuario.via === "cuenta"
    ? (usuario.correo || "Cuenta de Frutiger Aero")
    : "Cuenta local de este dispositivo";
  $("quien-retrato").innerHTML = retratoDe(usuario);
  $("hola").textContent = "Hola, " + usuario.nombre.split(" ")[0];
}

/* --- invitado --- */
function comoInvitado(){
  var n = ($("nombre").value || "").trim().slice(0, 28);
  if (!n){ $("nombre").focus(); $("nombre").placeholder = "Escribí un nombre, el que quieras"; return; }
  entrar({ nombre:n, via:"local" });
}
$("flecha").addEventListener("click", comoInvitado);
$("nombre").addEventListener("keydown", function(e){ if (e.key === "Enter") comoInvitado(); });

/* --- las tres puertas: llave de acceso, Discord y Google ---
   Las tres terminan en lo mismo: una cuenta de verdad, con el mismo pase que
   la de usuario y contraseña. No son tres sesiones distintas.

   La que manda es LA LLAVE DE ACCESO, porque es la única que no depende de
   nadie: no hay consola de un tercero que registrar, no hay secreto que se
   pueda filtrar, y no hay edad mínima que cumplirle a nadie. La clave privada
   vive en el teléfono o en la computadora y no sale de ahí; acá queda la
   pública, que no sirve para entrar. Y no se puede pescar: la firma lleva
   adentro de qué sitio salió, así que una copia de esta página en otra
   dirección no puede usarla, aunque la persona caiga y apoye el dedo. */
var CLIENTE = null, NUMERO = null, TICKET = null, PUERTA = null;

var HAY_LLAVES = !!(window.PublicKeyCredential && navigator.credentials &&
                    window.AuthenticatorAttestationResponse &&
                    AuthenticatorAttestationResponse.prototype.getPublicKey);

fetch("api/config").then(function(r){ return r.ok ? r.json() : null; }).then(function(c){
  if (c && c.auto) {
    AUTO = c.auto;
    if (AUTO.prueba) avisarPrueba();
    armarPaypal();
  }
  if (c && c.pago) { pago = c.pago; }
  pintarMontos();
  mirarLaVuelta();

  if (HAY_LLAVES){ $("llave-btn").hidden = false; $("pie-llave").hidden = false; }
  if (c && c.discord) $("discord-btn").hidden = false;

  CLIENTE = c && c.google;
  if (!CLIENTE){ if (!HAY_LLAVES && !(c && c.discord)) $("sin-google").hidden = false; return; }
  var g = document.createElement("script");
  g.src = "https://accounts.google.com/gsi/client";
  g.async = true; g.defer = true;
  g.onload = armarGoogle;
  g.onerror = function(){ $("sin-google").hidden = false; };
  document.head.appendChild(g);
}).catch(function(){ $("sin-google").hidden = false; });

/* ------------------------------------------------------- cosas compartidas */
function llamar(ruta, cuerpo){
  var o = { method:"POST", headers:{"content-type":"application/json"},
            body: JSON.stringify(cuerpo) };
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) o.headers.authorization = "Bearer " + ses.pase;
  return fetch("api/" + ruta, o).then(function(r){
    return r.json().then(function(j){
      if (!r.ok) throw new Error(j.error || ("error " + r.status));
      return j;
    });
  });
}

function avisoG(t){
  var a = $("g-aviso");
  if (!t){ a.hidden = true; return; }
  a.hidden = false; a.textContent = t;
}
function errorG(t){
  $("paso2").hidden = true; $("paso1").hidden = false;
  var n = $("g-error"); n.hidden = false; n.textContent = t;
}

/* la sesión de la cuenta es la MISMA que usa el muro: se guarda donde la
   busca, y se avisa por si esa parte de la página ya se cargó */
function conCuenta(j){
  var ses = { pase: j.pase, yo: j.yo };
  caja.poner("sesion", ses);
  document.dispatchEvent(new CustomEvent("cuenta-lista", { detail: ses }));
  entrar({ nombre: j.yo.nombre, foto: j.foto || null,
           correo: j.correo || null, via: "cuenta" });
}

/* el segundo paso: Google y Discord ya dijeron quién es, pero no cómo quiere
   que lo vean acá. El nombre de usuario es la dirección del perfil. */
function pedirUsuario(j, puerta){
  PUERTA = puerta; TICKET = j.ticket;
  $("paso1").hidden = true; $("paso2").hidden = false;
  $("g-error").hidden = true;
  avisoG("");
  $("g-quien").textContent = j.correo ? "Entraste como " + j.correo + ". Falta una cosa:"
                                      : "Falta una cosa:";
  $("g-conclave").hidden = (puerta === "llave");
  $("g-usuario").value = j.sugerido || "";
  $("g-usuario").dataset.nombre = j.nombre || "";
  verMuestra();
  $("g-usuario").focus(); $("g-usuario").select();
}

function verMuestra(){
  var v = ($("g-usuario").value || "").toLowerCase().trim();
  $("g-muestra").textContent = "@" + (v || "vos");
}

/* ============================================== 1 · llaves de acceso */
var cod = new TextEncoder();
function aB64u(b){
  var s = "", u = new Uint8Array(b);
  for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function deB64u(t){
  var s = String(t).replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  var b = atob(s), u = new Uint8Array(b.length);
  for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
/* un nombre para poder distinguirla después en la lista y borrar la correcta */
function nombreDelAparato(){
  var u = navigator.userAgent;
  if (/Android/.test(u)) return "Android";
  if (/iPhone|iPad|iPod/.test(u)) return "iPhone o iPad";
  if (/Mac OS X/.test(u)) return "Mac";
  if (/Windows/.test(u)) return "Windows";
  if (/Linux/.test(u)) return "Linux";
  return "Este dispositivo";
}
/* el navegador cancela y avisa igual que si fallara: hay que distinguirlos, o
   el que cierra el diálogo a propósito ve un error de sistema */
function porQueFallo(e){
  if (e && e.name === "NotAllowedError")
    return "Se canceló, o pasó demasiado tiempo. Probá otra vez.";
  if (e && e.name === "InvalidStateError")
    return "Este aparato ya tiene una llave en esa cuenta: entrá con ella.";
  if (e && e.name === "SecurityError")
    return "Las llaves sólo andan en la dirección oficial del sitio.";
  return (e && e.message) || "No se pudo.";
}

function entrarConLlave(){
  $("g-error").hidden = true;
  llamar("llave", { hacer:"reto" }).then(function(j){
    return navigator.credentials.get({ publicKey: {
      challenge: cod.encode(j.reto),
      rpId: location.hostname,
      userVerification: "preferred",
      timeout: 60000
    }});
  }).then(function(c){
    if (!c) throw new Error("No se eligió ninguna llave.");
    var r = c.response;
    return llamar("llave", { hacer:"entrar", cred: aB64u(c.rawId),
      cliente: aB64u(r.clientDataJSON), auth: aB64u(r.authenticatorData),
      firma: aB64u(r.signature) });
  }).then(conCuenta).catch(function(e){ errorG(porQueFallo(e)); });
}

/* La ceremonia en sí: el navegador crea el par de claves, y acá sube sólo la
   pública. La privada no sale del aparato ni pasando por este código. */
function ceremonia(j){
  return navigator.credentials.create({ publicKey: {
    challenge: cod.encode(j.reto),
    rp: { name: "Frutiger Aero", id: location.hostname },
    user: { id: deB64u(j.handle), name: j.usuario, displayName: j.nombre || j.usuario },
    /* los dos tipos que entiende todo el mundo: curva elíptica y RSA */
    pubKeyCredParams: [{ type:"public-key", alg:-7 }, { type:"public-key", alg:-257 }],
    /* «residentKey» es lo que permite entrar SIN escribir el usuario: la llave
       se acuerda a qué cuenta pertenece y el aparato la ofrece sola */
    authenticatorSelection: { residentKey:"required", userVerification:"preferred" },
    /* para que no ofrezca poner una segunda llave del mismo aparato en la
       misma cuenta, que sólo sirve para confundir después al borrarlas */
    excludeCredentials: (j.tiene || []).map(function(id){
      return { type:"public-key", id: deB64u(id) }; }),
    attestation: "none",
    timeout: 60000
  }}).then(function(c){
    if (!c) throw new Error("No se creó la llave.");
    var r = c.response;
    return llamar("llave", { hacer:"guardar", ticket: j.ticket,
      cred: aB64u(c.rawId), cliente: aB64u(r.clientDataJSON),
      clave: aB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(),
      nombre: nombreDelAparato() });
  });
}

/* crear la cuenta: primero el nombre de usuario, DESPUÉS la llave. La cuenta se
   crea recién cuando la llave ya existe, para no dejar cuentas huérfanas a las
   que nadie pueda entrar si se cancela el diálogo del navegador. */
function hacerLlave(usuario){
  avisoG("Pedile a tu dispositivo que la cree…");
  return llamar("llave", { hacer:"empezar", usuario: usuario,
                           nombre: $("g-usuario").dataset.nombre })
    .then(ceremonia).then(conCuenta);
}

/* desde adentro, para el que ya tiene cuenta con contraseña y quiere dejar de
   escribirla, o para sumar el segundo aparato */
window.FA = window.FA || {};
window.FA.hayLlaves = HAY_LLAVES;
window.FA.agregarLlave = function(){
  return llamar("llave", { hacer:"empezar" }).then(ceremonia);
};
window.FA.porQueFallo = porQueFallo;

if ($("llave-btn")) $("llave-btn").addEventListener("click", entrarConLlave);
if ($("crear-llave")) $("crear-llave").addEventListener("click", function(){
  pedirUsuario({ sugerido:"", nombre:"" }, "llave");
  $("g-quien").textContent = "Elegí tu nombre de usuario y listo:";
});

/* ============================================== 2 · Discord */
if ($("discord-btn")) $("discord-btn").addEventListener("click", function(){
  location.href = "api/discord";
});

/* La vuelta de Discord llega por la dirección. Viene en el pedacito de después
   del `#`, que NO se manda a ningún servidor; igual se borra apenas se lee,
   para que no quede en el historial ni en un enlace compartido. */
(function volvioDeDiscord(){
  var h = location.hash || "";
  if (h.length < 2) return;
  var m = /^#(entra|nuevo|mal)=(.*)$/.exec(h);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  var dato = decodeURIComponent(m[2]);
  if (m[1] === "mal"){ errorG(dato); return; }
  var j; try { j = JSON.parse(dato); } catch(e){ return; }
  if (m[1] === "entra") conCuenta(j); else pedirUsuario(j, "discord");
})();

/* ============================================== 3 · Google */
function pedirNumero(){
  return fetch("api/entrar").then(function(r){ return r.json(); })
    .then(function(j){ NUMERO = j.numero; return NUMERO; });
}
function armarGoogle(){
  if (!window.google || !google.accounts || !google.accounts.id) return;
  pedirNumero().then(dibujarGoogle).catch(function(){ $("sin-google").hidden = false; });
  /* el número vence: mientras la pantalla siga abierta se pide otro */
  setInterval(function(){
    if ($("logon").hidden) return;
    pedirNumero().then(dibujarGoogle).catch(function(){});
  }, 20 * 60000);
}
function dibujarGoogle(){
  google.accounts.id.initialize({
    client_id: CLIENTE, nonce: NUMERO,
    callback: function(resp){
      $("g-error").hidden = true;
      llamar("entrar", { credential: resp.credential, numero: NUMERO })
        .then(function(j){
          if (j.pase) conCuenta(j); else if (j.nuevo) pedirUsuario(j, "google");
        })
        .catch(function(e){ errorG(e.message); });
    }
  });
  $("gbt").hidden = true;
  $("gsi").textContent = "";
  google.accounts.id.renderButton($("gsi"), {
    theme:"outline", size:"large", shape:"rectangular", width:330,
    text:"continue_with", locale:"es"
  });
}
$("gbt").addEventListener("click", function(){
  if (!CLIENTE) { $("sin-google").hidden = false; $("sin-google").scrollIntoView({block:"nearest"}); }
});

/* ============================================== el 2º paso, para las tres */
if ($("g-usuario")) {
  $("g-usuario").addEventListener("input", verMuestra);
  $("g-usuario").addEventListener("keydown", function(e){
    if (e.key === "Enter") $("g-listo").click();
  });

  $("g-listo").addEventListener("click", function(){
    var u = ($("g-usuario").value || "").toLowerCase().trim();
    if (!/^[a-z0-9](?:[a-z0-9_.]{1,18}[a-z0-9])$/.test(u)){
      avisoG("En minúsculas, de 3 a 20, sin espacios ni acentos."); return;
    }
    if (PUERTA === "llave"){
      hacerLlave(u).catch(function(e){ avisoG(porQueFallo(e)); });
      return;
    }
    avisoG("Creando tu cuenta…");
    llamar("entrar", { hacer:"registrar", ticket: TICKET, usuario: u,
                       nombre: $("g-usuario").dataset.nombre })
      .then(conCuenta).catch(function(e){ avisoG(e.message); });
  });

  $("g-vincular").addEventListener("click", function(){
    avisoG("Pegando tu cuenta…");
    llamar("entrar", { hacer:"vincular", ticket: TICKET,
                       usuario: $("g-vi-us").value, clave: $("g-vi-cl").value })
      .then(conCuenta).catch(function(e){ avisoG(e.message); });
  });
  $("g-vi-cl").addEventListener("keydown", function(e){
    if (e.key === "Enter") $("g-vincular").click();
  });

  $("g-volver").addEventListener("click", function(){
    TICKET = null; PUERTA = null; avisoG("");
    $("paso2").hidden = true; $("paso1").hidden = false;
  });
}

/* --- apagar --- */
$("apagar").addEventListener("click", function(){
  var n = document.createElement("div");
  n.style.cssText = "position:fixed;inset:0;z-index:400;background:#000;opacity:0;" +
    "transition:opacity .8s ease;display:grid;place-items:center;color:#8ea6c0;" +
    "font:300 20px/1 var(--tipo)";
  n.textContent = "Cerrando sesión…";
  document.body.appendChild(n);
  requestAnimationFrame(function(){ n.style.opacity = "1"; });
  setTimeout(function(){ location.reload(); }, 2600);
});

if (usuario){
  $("logon").hidden = true;
  document.body.classList.remove("sinsesion");
  $("escritorio").hidden = false;
  arrancarCelu();
  pintarUsuario();
} else {
  document.body.classList.add("sinsesion");
}

/* ================================================= 2 · las ventanas
   LA CRUZ CIERRA. Antes minimizaba: la ventana se iba a una fila de botones
   abajo, y esa fila se llenaba de cosas que nadie iba a volver a abrir. Cerrar
   y minimizar hacían exactamente lo mismo, así que había dos botones para una
   sola acción y ninguno hacía lo que decía.

   Se puede cerrar todo sin quedar encerrado: cada ventana tiene de dónde volver
   a abrirse —las aplicaciones desde el menú de inicio, el muro, los avisos y el
   perfil desde la barra de arriba, las secciones desde el menú de «Frutiger
   Aero», y la zona de donantes desde su ícono del escritorio— así que no hace
   falta guardarlas en ningún lado por las dudas. */
/* DE TODO LO QUE SE ABRE, SE SALE. Tres cosas que estaban rotas resultaron ser
   la misma:

   · En el teléfono las ventanas se APILABAN. Cada una tapa la pantalla entera,
     así que abrir cuatro dejaba cuatro pantallas idénticas una encima de otra:
     cerrabas una y aparecía otra abajo. La sensación de no poder salir nunca
     era literal, había que cerrar cuatro veces.
   · El «atrás» de Android —el botón, el gesto y el del navegador— no hacía
     nada, porque la página nunca dejó una entrada en el historial. Atrás no te
     sacaba de la ventana: te sacaba DEL SITIO.
   · Escape cerraba el menú de inicio y Aero+, pero no la ventana de adelante.

   Se arregla con una sola idea: todo lo que tapa la pantalla se anota en una
   pila, atrás cierra lo de arriba, y recién con la pila vacía el «atrás» sale
   del sitio.

   POR QUÉ UNA SOLA ENTRADA DE HISTORIAL Y NO UNA POR PANTALLA. Una por pantalla
   fue lo primero que probé y se desincroniza al toque: en el escritorio se
   cierra cualquier ventana del medio con su cruz, y ahí el historial queda con
   entradas de pantallas que ya no existen —el «atrás» empieza a no hacer nada
   una o dos veces antes de funcionar—. Con una sola marca no hay nada que
   sincronizar: la marca existe si y sólo si hay algo abierto, y se vuelve a
   poner cuando al cerrar una todavía queda otra abajo. */

var pila = [];        /* [{clave, cerrar}]; la de arriba es la última */
var marca = false;    /* ¿hay una entrada nuestra en el historial? */
var saltear = 0;      /* popstates que provocamos nosotros y no cierran nada */

function esCelu(){ return matchMedia("(max-width:720px)").matches; }

function enPila(clave){
  for (var i = 0; i < pila.length; i++) if (pila[i].clave === clave) return i;
  return -1;
}

/* La marca existe si y sólo si hay algo abierto. Todo lo que abre o cierra
   termina llamando acá, así que no hay un segundo lugar donde se pueda olvidar. */
function acomodarHistorial(){
  if (pila.length){
    if (marca) return;
    try { history.pushState({ fa:1 }, ""); marca = true; } catch(e){}
  } else {
    if (!marca) return;
    marca = false; saltear++;
    try { history.back(); } catch(e){ saltear--; }
  }
}

function apilar(clave, cerrar){
  if (enPila(clave) >= 0) return;
  pila.push({ clave: clave, cerrar: cerrar });
  acomodarHistorial();
}

/* `callado` la saca de la pila sin tocar el historial. Lo usa el teléfono
   cuando una aplicación reemplaza a la anterior: ahí la pila nunca llega a
   quedar vacía, y pedir «atrás» en el medio dejaría el historial corriendo
   atrás de la pantalla —`history.back()` no es inmediato, y el `pushState` de
   la que abre llegaría antes que el `popstate` de la que cerró—. */
function desapilar(clave, callado){
  var i = enPila(clave);
  if (i < 0) return false;
  pila.splice(i, 1)[0].cerrar();
  if (!callado) acomodarHistorial();
  return true;
}

window.addEventListener("popstate", function(){
  if (saltear > 0){ saltear--; return; }
  marca = false;                       /* la entrada nuestra ya no está */
  if (!pila.length) return;            /* no había nada abierto: que se vaya */
  pila.pop().cerrar();
  acomodarHistorial();                 /* si queda algo abajo, se marca de nuevo */
});

function cerrarVentana(id){
  var v = $(id); if (!v) return;
  /* el `|| v.hidden = true` es para la ventana que abrió algo que no pasó por
     acá: igual se cierra, sólo que sin historial */
  if (!desapilar(id)) v.hidden = true;
}

function abrir(id){
  var v = $(id); if (!v) return;
  /* EN EL TELÉFONO, UNA SOLA A LA VEZ. Una ventana abierta tapa la pantalla
     entera, así que dos abiertas son dos pantallas iguales encimadas y cerrar
     la de arriba parece no hacer nada. Se cierra la anterior, como hace
     cualquier teléfono. En el escritorio no: ahí tener varias abiertas es
     justamente la gracia. */
  if (esCelu()) pila.slice().forEach(function(x){
    if (x.clave !== id && x.clave.slice(0,2) === "v-") desapilar(x.clave, true);
  });
  v.hidden = false;
  apilar(id, function(){ v.hidden = true; });
  cerrarInicio();
  alFrente(v);
  /* Dos motivos para NO desplazar la página acá: en el teléfono la ventana es
     `position:fixed` y pedirlo mueve el fondo por atrás; y si está despegada ya
     se ve donde la dejaste, así que desplazarse sería mover la página para
     llegar a algo que no se mueve con ella. */
  if (!esCelu() && !v.classList.contains("suelta"))
    v.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block:"start" });
}

/* lo usa social.js, que también abre ventanas: si tuviera su propia copia,
   la mitad de las pantallas quedaría fuera de la pila y el «atrás» andaría
   en unas sí y en otras no, que es peor que no andar nunca */
window.FA = window.FA || {};
window.FA.abrir = abrir;
window.FA.cerrar = cerrarVentana;

document.addEventListener("click", function(e){
  var b = e.target.closest("[data-cerrar],[data-abrir]");
  if (!b) return;
  if (b.dataset.abrir) { abrir(b.dataset.abrir); return; }
  cerrarVentana(b.dataset.cerrar);
});

/* ========================================== las ventanas se mueven

   POR QUÉ NO ARRANCAN FLOTANDO. Esta página es un documento que se baja con el
   dedo y las ventanas son sus secciones: si todas empezaran sueltas habría que
   acomodar nueve antes de poder leer nada. La primera vez que agarrás una de
   su barra de título, ESA se despega —se queda fija donde está y ya no se va
   con el scroll— y las demás siguen en su lugar.

   SE AGARRA DE LA BARRA DE TÍTULO Y NO DE LA VENTANA ENTERA: adentro hay
   textos que se seleccionan, campos que se escriben y botones que se tocan.
   La cruz y los mandos quedan afuera del agarre, si no cerrar sería arrastrar
   un píxel sin querer y que no pase nada.

   NO SE PUEDE PERDER UNA VENTANA. Se le exige que siempre queden 60px de barra
   dentro de la pantalla: una ventana arrastrada afuera es una ventana que no
   se puede volver a agarrar, y la única salida sería borrar el navegador.

   EN EL TELÉFONO NO SE MUEVEN, y además hay que LIMPIARLES el estilo: la
   ventana de teléfono es a pantalla completa por CSS, y un `left` puesto a
   mano le gana a la regla de la media query. Sin esta limpieza, girar el
   teléfono después de haber movido ventanas en la compu deja la aplicación
   corrida y media pantalla afuera. */

var zTope = 50;

function moverVentanas(){ return !esCelu(); }

function despegar(v){
  if (v.classList.contains("suelta")) return;
  var r = v.getBoundingClientRect();
  v.style.width = Math.round(r.width) + "px";
  v.style.left  = Math.round(r.left) + "px";
  v.style.top   = Math.round(r.top) + "px";
  v.classList.add("suelta");
}

function alFrente(v){ if (v.classList.contains("suelta")) v.style.zIndex = ++zTope; }

function altoDe(nombre, siNo){
  var v = parseInt(getComputedStyle(document.documentElement).getPropertyValue(nombre), 10);
  return v > 0 ? v : siNo;
}

/* EL CORRAL. Que siempre quede barra de título para volver a agarrarla, y que
   NUNCA se meta debajo de las barras del sistema.

   Lo segundo no es cosmético y lo encontré probando: #barraSocial está en
   z-index 70 y la barra de tareas en 80, o sea que las dos le ganan a una
   ventana suelta. Una ventana arrastrada contra el borde de arriba queda con su
   barra de título tapada: no se puede volver a agarrar NI tocar su cruz, que es
   exactamente el mismo encierro que tenía el teléfono. Se arregla acá y no
   subiéndole el z-index a la ventana, porque esas dos barras tienen que quedar
   arriba: son el sistema, no una ventana más. */
function dentroDePantalla(v){
  /* si está cerrada, `offsetWidth` es 0 y la cuenta la correría sola; el ancho
     guardado es el que vale hasta que se vuelva a abrir */
  var w = v.offsetWidth || parseInt(v.style.width, 10) || 260;
  var x = parseInt(v.style.left, 10) || 0, y = parseInt(v.style.top, 10) || 0;
  var arriba = altoDe("--barra-alta", 52);
  var abajo  = altoDe("--tareas-alta", 56);
  /* Horizontalmente NO se permite que sobresalga nada, ni siquiera un poco.
     Dejar asomar 60px parece más cómodo y lo probé así, pero la cruz vive en la
     PUNTA DERECHA de la barra de título: apenas la ventana se corre a la
     derecha, la cruz se va de la pantalla y quedás con una ventana que no se
     puede cerrar. Como `.suelta` tiene `max-width:calc(100vw - 16px)`, siempre
     entra entera; el Math.max(0, …) es para el caso raro de una pantalla más
     angosta que la ventana. */
  x = Math.min(Math.max(x, 0), Math.max(0, innerWidth - w));
  y = Math.min(Math.max(y, arriba), innerHeight - abajo - 36);
  v.style.left = Math.round(x) + "px";
  v.style.top  = Math.round(y) + "px";
}

function guardarLugares(){
  var m = {};
  $$("#escritorio .ventana.suelta").forEach(function(v){
    m[v.id] = { x: parseInt(v.style.left,10) || 0, y: parseInt(v.style.top,10) || 0,
                w: parseInt(v.style.width,10) || 0 };
  });
  caja.poner("lugares", m);
}

function pegarDeVuelta(v){
  v.classList.remove("suelta");
  v.style.left = v.style.top = v.style.width = v.style.zIndex = "";
  guardarLugares();
}

/* Se llama al arrancar y cada vez que cambia el tamaño: es el único lugar que
   decide si las ventanas están sueltas o no, así que no hay dos verdades. */
function acomodarVentanas(){
  if (!moverVentanas()){
    $$("#escritorio .ventana.suelta").forEach(function(v){
      v.classList.remove("suelta");
      v.style.left = v.style.top = v.style.width = v.style.zIndex = "";
    });
    return;
  }
  var m = caja.leer("lugares", {});
  Object.keys(m).forEach(function(id){
    var v = $(id); if (!v) return;
    if (m[id].w) v.style.width = m[id].w + "px";
    v.style.left = m[id].x + "px";
    v.style.top  = m[id].y + "px";
    v.classList.add("suelta");
    alFrente(v);
    dentroDePantalla(v);          /* por si la guardó en una pantalla más grande */
  });
}

document.addEventListener("pointerdown", function(e){
  if (!moverVentanas()) return;
  if (e.button) return;                                   /* sólo el principal */
  var t = e.target.closest("#escritorio .ventana > .titulo");
  if (!t) return;
  if (e.target.closest("button, a, input, select, textarea")) return;
  var v = t.parentElement;

  despegar(v); alFrente(v);
  var r = v.getBoundingClientRect();
  var dx = e.clientX - r.left, dy = e.clientY - r.top;
  t.classList.add("agarrando");
  try { t.setPointerCapture(e.pointerId); } catch(err){}

  function mover(ev){
    v.style.left = Math.round(ev.clientX - dx) + "px";
    v.style.top  = Math.round(ev.clientY - dy) + "px";
    dentroDePantalla(v);
  }
  function soltar(){
    t.classList.remove("agarrando");
    try { t.releasePointerCapture(e.pointerId); } catch(err){}
    t.removeEventListener("pointermove", mover);
    t.removeEventListener("pointerup", soltar);
    t.removeEventListener("pointercancel", soltar);
    guardarLugares();
  }
  t.addEventListener("pointermove", mover);
  t.addEventListener("pointerup", soltar);
  t.addEventListener("pointercancel", soltar);
  e.preventDefault();                       /* que no seleccione el título */
});

/* Doble clic en la barra: vuelve a su lugar en la página. Es la salida para el
   que movió ocho ventanas y quiere leer la página de corrido otra vez. */
document.addEventListener("dblclick", function(e){
  var t = e.target.closest("#escritorio .ventana > .titulo");
  if (!t || e.target.closest("button, a")) return;
  if (t.parentElement.classList.contains("suelta")) pegarDeVuelta(t.parentElement);
});

addEventListener("resize", acomodarVentanas);
acomodarVentanas();

/* --- menú de inicio --- */
function ocultarInicio(){ $("inicio").hidden = true; $("orbe").setAttribute("aria-expanded","false"); }
function cerrarInicio(){ if ($("inicio").hidden) return; if (!desapilar("inicio")) ocultarInicio(); }
function abrirInicio(){
  $("inicio").hidden = false; $("orbe").setAttribute("aria-expanded","true");
  apilar("inicio", ocultarInicio);
}
$("orbe").addEventListener("click", function(e){
  e.stopPropagation();
  if ($("inicio").hidden) abrirInicio(); else cerrarInicio();
});
document.addEventListener("click", function(e){
  if (!$("inicio").hidden && !e.target.closest("#inicio") && !e.target.closest("#orbe")) cerrarInicio();
});

/* UN SOLO Escape para todo. Antes había tres —uno del menú, uno de la ventana
   de colaborar y uno de Aero+— y cada uno cerraba lo suyo mirara o no lo que
   tenía encima: con Aero+ abierto sobre el menú, Escape cerraba el menú de
   abajo. Ahora cierra lo de arriba, que es lo único que Escape puede querer
   decir. Va por el historial para no llevar dos cuentas de lo mismo. */
document.addEventListener("keydown", function(e){
  if (e.key === "Escape" && pila.length) history.back();
});
$("cerrar-sesion").addEventListener("click", salir);

/* ============================================== 3 · el panel de control */
var ajustes = caja.leer("ajustes", { tono:210, sat:52, vidrio:82, fondo:"pasto", burbujas:true });

/* Las direcciones van desde la raíz y no relativas. Un `url()` que se mete en
   una variable de CSS no se resuelve desde el documento sino desde la hoja de
   estilos donde la variable SE USA —que está en /css/—, así que «img/fondo»
   terminaba pidiendo «/css/img/fondo» y el escritorio se quedaba sin fondo,
   con el azul liso de abajo. No daba error en pantalla: sólo faltaba el pasto. */
var FONDOS = {
  pasto:  { ancho:'url("/img/fondo.06222548.webp")', alto:'url("/img/fondo-alto.550e8e84.webp")' },
  aurora: { ancho:"linear-gradient(180deg,#04203f,#0c4a7e 40%,#1e8fa8 70%,#7fe0cf)",
            alto:  "linear-gradient(180deg,#04203f,#0c4a7e 40%,#1e8fa8 70%,#7fe0cf)" },
  vidrio: { ancho:"radial-gradient(120% 90% at 30% 10%,#bfe9ff,#2f7fd0 45%,#0a3a6b)",
            alto:  "radial-gradient(120% 90% at 30% 10%,#bfe9ff,#2f7fd0 45%,#0a3a6b)" }
};

function aplicar(){
  var r = document.documentElement.style;
  r.setProperty("--tono", ajustes.tono);
  r.setProperty("--sat", ajustes.sat + "%");
  r.setProperty("--vidrio", ajustes.vidrio + "%");
  var f = FONDOS[ajustes.fondo] || FONDOS.pasto;
  r.setProperty("--fondo", f.ancho);
  r.setProperty("--fondo-alto", f.alto);
  document.querySelector('meta[name="theme-color"]')
    .setAttribute("content", "hsl(" + ajustes.tono + " " + ajustes.sat + "% 34%)");
  caja.poner("ajustes", ajustes);
}
aplicar();

function conectarControl(){
  var t = $("c-tono"), s = $("c-sat"), v = $("c-vidrio");
  t.value = ajustes.tono; s.value = ajustes.sat; v.value = ajustes.vidrio;
  function cambia(){
    ajustes.tono = +t.value; ajustes.sat = +s.value; ajustes.vidrio = +v.value;
    aplicar();
  }
  [t,s,v].forEach(function(x){ x.addEventListener("input", cambia); });

  $$("#c-fondos button").forEach(function(b){
    b.setAttribute("aria-pressed", String(b.dataset.fondo === ajustes.fondo));
    b.addEventListener("click", function(){
      ajustes.fondo = b.dataset.fondo; aplicar();
      $$("#c-fondos button").forEach(function(o){
        o.setAttribute("aria-pressed", String(o === b));
      });
    });
  });

  var bu = $("c-burbujas");
  bu.checked = !!ajustes.burbujas;
  bu.addEventListener("change", function(){
    ajustes.burbujas = bu.checked; caja.poner("ajustes", ajustes); burbujas();
  });

  $("c-reset").addEventListener("click", function(){
    ajustes = { tono:210, sat:52, vidrio:82, fondo:"pasto", burbujas:true };
    aplicar(); conectarControl(); burbujas();
  });
}

/* ==================================================== 4 · el buscaminas */
var MINAS = (function(){
  var L = 9, BOMBAS = 10;
  var campo, tapa, bandera, viva, empezado, t0, reloj, marcadas;

  function vecinos(i){
    var f = Math.floor(i/L), c = i%L, r = [];
    for (var df=-1; df<=1; df++) for (var dc=-1; dc<=1; dc++){
      if (!df && !dc) continue;
      var nf = f+df, nc = c+dc;
      if (nf>=0 && nf<L && nc>=0 && nc<L) r.push(nf*L+nc);
    }
    return r;
  }

  function nuevo(){
    campo = new Array(L*L).fill(0);
    tapa = new Array(L*L).fill(true);
    bandera = new Array(L*L).fill(false);
    viva = true; empezado = false; marcadas = 0;
    clearInterval(reloj); $("m-tiempo").textContent = "000";
    $("m-minas").textContent = String(BOMBAS).padStart(3,"0");
    $("m-estado").textContent = "Tocá una casilla para empezar";
    dibujar();
  }

  /* las bombas se reparten DESPUÉS del primer toque y nunca sobre él: si no,
     se puede perder en el primer clic, que es lo único que no se perdona */
  function sembrar(libre){
    var prohibidas = vecinos(libre).concat([libre]);
    var puestas = 0;
    while (puestas < BOMBAS){
      var i = Math.floor(Math.random()*L*L);
      if (campo[i] === -1 || prohibidas.indexOf(i) >= 0) continue;
      campo[i] = -1; puestas++;
    }
    for (var j=0; j<L*L; j++){
      if (campo[j] === -1) continue;
      campo[j] = vecinos(j).filter(function(v){ return campo[v] === -1; }).length;
    }
  }

  function destapar(i){
    if (!viva || !tapa[i] || bandera[i]) return;
    tapa[i] = false;
    if (campo[i] === -1){ perder(); return; }
    if (campo[i] === 0) vecinos(i).forEach(destapar);
  }

  function perder(){
    viva = false; clearInterval(reloj);
    for (var i=0;i<L*L;i++) if (campo[i] === -1) tapa[i] = false;
    $("m-estado").textContent = "Explotó. Probá de nuevo.";
  }

  function ganar(){
    viva = false; clearInterval(reloj);
    var seg = Math.floor((Date.now()-t0)/1000);
    var rec = caja.leer("minas-record", null);
    if (rec === null || seg < rec){ caja.poner("minas-record", seg); rec = seg; }
    $("m-estado").textContent = "¡Ganaste en " + seg + " s! Récord: " + rec + " s";
  }

  function dibujar(){
    var g = $("m-campo"), h = "";
    for (var i=0;i<L*L;i++){
      if (tapa[i]){
        h += '<button type="button" data-i="'+i+'">' + (bandera[i] ? "⚑" : "") + "</button>";
      } else if (campo[i] === -1){
        h += '<button type="button" class="abierta boom" disabled>✳</button>';
      } else {
        h += '<button type="button" class="abierta n'+campo[i]+'" disabled>' +
             (campo[i] || "") + "</button>";
      }
    }
    g.style.gridTemplateColumns = "repeat("+L+",auto)";
    g.innerHTML = h;
    $("m-minas").textContent = String(Math.max(0, BOMBAS - marcadas)).padStart(3,"0");
  }

  function tocar(i, conBandera){
    if (!viva) return;
    if (!empezado){
      sembrar(i); empezado = true; t0 = Date.now();
      reloj = setInterval(function(){
        $("m-tiempo").textContent =
          String(Math.min(999, Math.floor((Date.now()-t0)/1000))).padStart(3,"0");
      }, 500);
      $("m-estado").textContent = "En juego · mantené apretado para la bandera";
    }
    if (conBandera){
      if (!tapa[i]) return;
      bandera[i] = !bandera[i];
      marcadas += bandera[i] ? 1 : -1;
    } else {
      destapar(i);
      if (viva && tapa.filter(Boolean).length === BOMBAS) ganar();
    }
    dibujar();
  }

  return { nuevo:nuevo, tocar:tocar };
})();

function conectarMinas(){
  MINAS.nuevo();
  $("m-nuevo").addEventListener("click", MINAS.nuevo);
  var largo = null;
  var g = $("m-campo");
  g.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  g.addEventListener("pointerdown", function(e){
    var b = e.target.closest("button[data-i]"); if (!b) return;
    var i = +b.dataset.i;
    if (e.button === 2){ MINAS.tocar(i, true); largo = "hecho"; return; }
    /* en el celular no hay clic derecho: la bandera es mantener apretado */
    largo = setTimeout(function(){ largo = "hecho"; MINAS.tocar(i, true); }, 420);
  });
  g.addEventListener("pointerup", function(e){
    var b = e.target.closest("button[data-i]");
    if (largo && largo !== "hecho"){ clearTimeout(largo); if (b) MINAS.tocar(+b.dataset.i, false); }
    largo = null;
  });
  g.addEventListener("pointercancel", function(){ if (largo && largo !== "hecho") clearTimeout(largo); largo = null; });
}

/* ========================================================= el bloc */
function conectarBloc(){
  var t = $("bloc"), aviso = $("bloc-ok"), tid;
  t.value = caja.leer("notas", "");
  t.addEventListener("input", function(){
    clearTimeout(tid);
    tid = setTimeout(function(){
      caja.poner("notas", t.value);
      aviso.textContent = "Guardado " + new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    }, 400);
  });
  $("bloc-borrar").addEventListener("click", function(){
    if (!t.value || confirm("¿Borrar todas las notas?")){ t.value = ""; caja.poner("notas",""); aviso.textContent = "Vacío."; }
  });
}

/* ==================================================== el reproductor */
function conectarRepro(){
  var a = $("audio"), cv = $("visor"), X = cv.getContext("2d");
  var barra = $("r-barra"), vol = $("r-vol"), tt = $("r-t"), bp = $("r-play");
  var ctx, an, datos, lazo;

  function reloj(s){
    if (!isFinite(s)) return "0:00";
    var m = Math.floor(s/60), q = Math.floor(s%60);
    return m + ":" + (q<10?"0":"") + q;
  }
  function icono(tocando){
    bp.innerHTML = tocando
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.6l12 7.4-12 7.4z" fill="currentColor"/></svg>';
    bp.setAttribute("aria-label", tocando ? "Pausar" : "Reproducir");
  }
  icono(false);

  /* el analizador se crea al primer toque: un AudioContext armado antes de que
     la persona interactúe arranca suspendido y no vuelve solo */
  function analizar(){
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    an = ctx.createAnalyser(); an.fftSize = 128;
    ctx.createMediaElementSource(a).connect(an);
    an.connect(ctx.destination);
    datos = new Uint8Array(an.frequencyBinCount);
  }

  function pintar(){
    var w = cv.width = cv.clientWidth * (devicePixelRatio > 1 ? 2 : 1);
    var h = cv.height = 152;
    X.clearRect(0,0,w,h);
    var g = X.createLinearGradient(0,0,0,h);
    g.addColorStop(0,"#8ff0e0"); g.addColorStop(.5,"#4fc3ea"); g.addColorStop(1,"#1a6ea8");
    X.fillStyle = g;
    var n = 32, an2 = an;
    if (an2) an2.getByteFrequencyData(datos);
    var ancho = w/n;
    for (var i=0;i<n;i++){
      var v = an2 ? datos[i]/255 : 0.06 + 0.05*Math.sin(i*0.7 + Date.now()/700);
      var alto = Math.max(3, v*h*0.92);
      X.fillRect(i*ancho+ancho*0.18, h-alto, ancho*0.64, alto);
    }
    lazo = requestAnimationFrame(pintar);
  }

  bp.addEventListener("click", function(){
    analizar();
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (a.paused){ a.play(); } else { a.pause(); }
  });
  a.addEventListener("play", function(){ icono(true); if (!lazo && !quieto) pintar(); });
  a.addEventListener("pause", function(){ icono(false); cancelAnimationFrame(lazo); lazo = null; });
  a.addEventListener("timeupdate", function(){
    if (!a.duration) return;
    barra.value = (a.currentTime / a.duration * 1000) | 0;
    tt.textContent = reloj(a.currentTime) + " / " + reloj(a.duration);
  });
  barra.addEventListener("input", function(){
    if (a.duration) a.currentTime = barra.value / 1000 * a.duration;
  });
  vol.value = Math.round((caja.leer("volumen", 0.7)) * 100);
  a.volume = vol.value/100;
  vol.addEventListener("input", function(){
    a.volume = vol.value/100; caja.poner("volumen", a.volume);
  });
  pintar(); cancelAnimationFrame(lazo); lazo = null;   /* un cuadro en reposo */
}

/* ================================================== 5 · reloj y burbujas */
var DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto",
             "septiembre","octubre","noviembre","diciembre"];
function dos(n){ return (n<10?"0":"") + n; }
function hora(){
  var f = new Date(), hm = dos(f.getHours()) + ":" + dos(f.getMinutes());
  if ($("reloj")) $("reloj").textContent = hm;
  if ($("t-hora")) $("t-hora").textContent = hm;
  var d = DIAS[f.getDay()] + ", " + f.getDate() + " de " + MESES[f.getMonth()];
  /* mayúscula sólo en la primera letra: `capitalize` las pone en cada palabra
     y quedaba «Miércoles, 9 De Septiembre» */
  if ($("fecha")) $("fecha").textContent = d.charAt(0).toUpperCase() + d.slice(1);
  if ($("t-dia")) $("t-dia").textContent = f.getDate() + "/" + dos(f.getMonth()+1);
}
hora(); setInterval(hora, 15000);

function burbujas(){
  var c = $("burbujas");
  if (quieto || !ajustes.burbujas){ c.innerHTML = ""; return; }
  var h = "";
  for (var i=0;i<16;i++){
    var d = 10 + Math.random()*46;
    h += '<span class="bu" style="left:'+(Math.random()*100).toFixed(1)+'%;'+
         'width:'+d.toFixed(0)+'px;height:'+d.toFixed(0)+'px;'+
         '--dx:'+(Math.random()*90-45).toFixed(0)+'px;'+
         'animation-duration:'+(13+Math.random()*16).toFixed(1)+'s;'+
         'animation-delay:-'+(Math.random()*24).toFixed(1)+'s"></span>';
  }
  c.innerHTML = h;
}
burbujas();

/* ==================================================== la paleta y las poses */
var COLORES = [
  ["#4580c4","Aero"], ["#1c4f8f","Profundo"], ["#7fd6e8","Agua"],
  ["#bff0f6","Espuma"], ["#7cc242","Pasto"], ["#2b9c62","Hoja"],
  ["#ffd23f","Sol"], ["#f0f0f0","Cara"], ["#0b1420","Dark Aero"]
];
$("paleta").innerHTML = COLORES.map(function(c){
  return '<li><button type="button" data-hex="'+c[0]+'" title="'+c[1]+'">'+
         '<i style="background:'+c[0]+'"></i><small>'+c[0]+'</small></button></li>';
}).join("");
$("paleta").addEventListener("click", function(e){
  var b = e.target.closest("button[data-hex]"); if (!b) return;
  var hex = b.dataset.hex, aviso = $("copiado");
  var listo = function(){
    aviso.textContent = "Copiado " + hex; aviso.hidden = false;
    clearTimeout(listo.t); listo.t = setTimeout(function(){ aviso.hidden = true; }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(hex).then(listo, listo);
  else listo();
});

var POSES = [
  ["m-saludando.463f6804.webp","saludando"], ["m-paz.b7d4f491.webp","haciendo la V"],
  ["m-burbuja.b9fcd8c5.webp","con una burbuja"], ["m-agua.f3af4fab.webp","en el agua"],
  ["m-surf.b7132097.webp","haciendo surf"], ["m-nube.684daf29.webp","en una nube"],
  ["m-juego.66c8b81c.webp","jugando"], ["m-dormido.13aeff0c.webp","dormida"]
];
$("poses").innerHTML = POSES.map(function(p,i){
  return '<li><button type="button" data-src="img/mascota/'+p[0]+'" aria-pressed="'+(i===0)+'" '+
         'title="La mascota '+p[1]+'"><img src="img/mascota/'+p[0]+'" alt="La mascota '+p[1]+'" '+
         'loading="lazy" width="760" height="760"></button></li>';
}).join("");
$("poses").addEventListener("click", function(e){
  var b = e.target.closest("button[data-src]"); if (!b) return;
  var l = $("lienzo");
  if (l && !l.hidden) return;      /* si el 3D ya tomó el mando, no lo pisamos */
  $("respaldo").src = b.dataset.src;
  $$("button", this).forEach(function(o){ o.setAttribute("aria-pressed", String(o === b)); });
});

/* =========================================================== 6 · colaborar
   Aparece una vez, DESPUÉS de entrar, y siempre se puede cerrar. Un muro de
   donaciones que no deja pasar no recauda: espanta. Por eso «Ahora no» es un
   botón normal, del mismo tamaño que el otro, y la respuesta se recuerda:

     · «Ahora no»          -> no vuelve por 30 días
     · «Ya colaboré»       -> no vuelve más
     · el icono y el menú  -> se puede abrir cuando se quiera

   Los datos de cobro NO están en el código: los sirve /api/config desde
   variables de entorno, igual que el identificador de Google. Así se cambian
   desde el panel de Cloudflare sin volver a publicar, y si no hay ninguno la
   pantalla lo dice en vez de mostrar botones que no llevan a ningún lado. */
var MONTOS = {
  ars: { simbolo: "$",   pasos: [1000, 2500, 5000, 10000], porDefecto: 2500 },
  usd: { simbolo: "US$", pasos: [3, 5, 10, 25],            porDefecto: 5 }
};
var pago = null, moneda = "ars", monto = MONTOS.ars.porDefecto;

function plata(n){ return n.toLocaleString("es-AR"); }

function pintarMontos(){
  var m = MONTOS[moneda];
  $("dona-simbolo").textContent = m.simbolo;
  $("dona-montos").innerHTML = m.pasos.map(function(v){
    return '<button type="button" data-monto="' + v + '" aria-pressed="' +
           (v === monto) + '">' + m.simbolo + " " + plata(v) + "</button>";
  }).join("");
  $$("#dona-monedas button").forEach(function(b){
    b.setAttribute("aria-pressed", String(b.dataset.moneda === moneda));
  });
  enlacesDePago();
}

function enlacesDePago(){
  var mp = $("dona-mp"), pp = $("dona-pp");

  /* Mercado Pago cobra en pesos y PayPal en dólares. Ofrecer el que no
     corresponde es mandar a alguien a una pantalla que no le va a servir. */
  var autoMP = AUTO && AUTO.mp && moneda === "ars";
  var autoPP = AUTO && AUTO.paypal && moneda === "usd";
  var hayMP = (autoMP || (pago && (pago.mpLink || pago.mpAlias))) && moneda === "ars";
  var hayPP = (autoPP || (pago && pago.paypal)) && moneda === "usd";

  /* con PayPal automático mandan los botones propios de PayPal, no el enlace */
  if ($("pp-botones")) $("pp-botones").hidden = !autoPP;
  if (autoPP && window.paypal) pintarPaypal();
  $("dona-pp").hidden = !!autoPP;

  mp.setAttribute("aria-disabled", String(!hayMP));
  pp.setAttribute("aria-disabled", String(!hayPP));

  if (hayMP){
    mp.href = pago.mpLink || "#";
    $("dona-mp-pie").textContent = autoMP
      ? "Pagás y entrás solo · " + MONTOS.ars.simbolo + " " + plata(monto)
      : (pago.mpLink ? "Link de pago · " + MONTOS.ars.simbolo + " " + plata(monto)
                     : "Copiá el alias de acá abajo · " + MONTOS.ars.simbolo + " " + plata(monto));
  } else {
    mp.href = "#";
    $("dona-mp-pie").textContent = moneda === "usd"
      ? "Es en pesos — pasá a pesos" : "Sin datos cargados";
  }

  if (hayPP){
    /* paypal.me sí acepta el monto en la dirección, así que llega escrito */
    pp.href = "https://www.paypal.com/paypalme/" +
              encodeURIComponent(pago.paypal) + "/" + monto + "USD";
    $("dona-pp-pie").textContent = "Tarjeta o saldo · US$ " + plata(monto);
  } else {
    pp.href = "#";
    $("dona-pp-pie").textContent = moneda === "ars"
      ? "Cobra en dólares — pasá a dólares" : "Sin datos cargados";
  }

  var fila = $("dona-alias");
  if (pago && pago.mpAlias && moneda === "ars" && !autoMP){
    fila.hidden = false; $("dona-alias-txt").textContent = pago.mpAlias;
  } else fila.hidden = true;

  $("dona-nada").hidden = !!(hayMP || hayPP || (pago && (pago.mpAlias || pago.paypal)));
}

function ocultarDona(recordar){
  $("fondoDona").hidden = true;
  if (recordar === "listo") caja.poner("colaboro", 1);
  else if (recordar === "luego") caja.poner("donaVisto", Date.now());
}

/* Cerrarla con «atrás» cuenta como «ahora no», igual que la cruz: si no
   recordara nada, volvería a aparecer sola a los pocos minutos y el «atrás»
   se sentiría roto sin estarlo. */
function cerrarDona(recordar){
  if (!desapilar("dona")) ocultarDona(recordar);
}

function abrirDona(){
  $("fondoDona").hidden = false;
  cerrarInicio();
  apilar("dona", function(){ ocultarDona("luego"); });
  pintarMontos();
}

function quizasColaborar(){
  if (caja.leer("colaboro", 0)) return;              // ya dijo que sí
  var visto = caja.leer("donaVisto", 0);
  if (Date.now() - visto < 30*24*3600*1000) return;  // dijo «ahora no» hace poco
  setTimeout(abrirDona, 900);
}

$("dona-x").addEventListener("click", function(){ cerrarDona("luego"); });
$("dona-luego").addEventListener("click", function(){ cerrarDona("luego"); });
$("dona-listo").addEventListener("click", function(){ cerrarDona("listo"); });
$("ic-dona").addEventListener("click", abrirDona);
$("mi-dona").addEventListener("click", abrirDona);
$("fondoDona").addEventListener("click", function(e){
  if (e.target === this) cerrarDona("luego");
});


$("dona-monedas").addEventListener("click", function(e){
  var b = e.target.closest("button[data-moneda]"); if (!b) return;
  moneda = b.dataset.moneda;
  monto = MONTOS[moneda].porDefecto;
  $("dona-otro").value = "";
  pintarMontos();
});
$("dona-montos").addEventListener("click", function(e){
  var b = e.target.closest("button[data-monto]"); if (!b) return;
  monto = +b.dataset.monto; $("dona-otro").value = "";
  pintarMontos();
});
$("dona-otro").addEventListener("input", function(){
  var v = Math.floor(+this.value);
  if (v > 0){ monto = v; pintarMontos();
    $$("#dona-montos button").forEach(function(b){ b.setAttribute("aria-pressed","false"); });
  }
});
$("dona-copiar").addEventListener("click", function(){
  var t = $("dona-alias-txt").textContent, b = this;
  var ok = function(){ b.textContent = "Copiado"; setTimeout(function(){ b.textContent = "Copiar"; }, 1600); };
  if (navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(t).then(ok, ok);
  else ok();
});
["dona-mp","dona-pp"].forEach(function(id){
  $(id).addEventListener("click", function(e){
    if (this.getAttribute("aria-disabled") === "true"){ e.preventDefault(); return; }
    /* con cobro automático el botón no lleva a un enlace: arranca el trámite */
    if (id === "dona-mp" && AUTO && AUTO.mp){ e.preventDefault(); irAMercadoPago(); }
  });
});
pintarMontos();

/* ==================================================== 7 · zona de donantes
   El pase lo firma el servidor y el navegador solo lo guarda. Acá no se decide
   nada: se pregunta. Si alguien se inventa un pase en el localStorage, la lista
   vuelve 403 y no hay nada que mostrar.

   Lo que este candado SÍ hace: que la lista y sus enlaces no estén en el HTML
   de la página, donde cualquiera los lee con ver-código-fuente.
   Lo que NO hace: impedir que un donante pase el archivo. Con un APK eso no
   tiene solución, y prometerlo sería mentir. */
var pase = caja.leer("pase", null);

/* Si la cuenta ya pago alguna vez, el servidor manda el pase junto con el
   perfil. Asi entrar desde otro telefono no obliga a pagar de nuevo: el acceso
   viaja con la cuenta y no con el navegador donde se pago. */
document.addEventListener("hay-pase-de-cuenta", function(e){
  if (!e.detail) return;
  pase = e.detail; caja.poner("pase", pase); revisarPase();
});

function pintarZona(datos){
  var caja2 = $("zona-lista");
  if (!datos || !datos.items || !datos.items.length){
    caja2.innerHTML =
      '<div class="grupo"><h2>Todavía no hay nada para bajar</h2>' +
      '<p>Tu acceso ya quedó guardado. Lo primero que va a aparecer acá es el ' +
      '<b>launcher de Android</b>, que está en desarrollo — cuando salga, lo ' +
      'vas a ver en esta ventana sin tener que hacer nada.</p></div>';
    return;
  }
  caja2.innerHTML = '<ul class="lista">' + datos.items.map(function(i){
    return '<li><a href="' + i.url + '" target="_blank" rel="noopener">' +
      '<span class="bola" style="background:radial-gradient(circle at 32% 26%,#fff3d0,#ffd23f 45%,#c98f10)"></span>' +
      '<span><b>' + i.nombre + '</b><span>' + (i.desc || "") + '</span></span></a></li>';
  }).join("") + "</ul>";
}

function revisarPase(){
  if (!pase) return;
  fetch("api/zona?pase=" + encodeURIComponent(pase))
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if (!d){ pase = null; caja.sacar("pase"); return; }   /* venció o ya no vale */
      /* la ventana vieja de la zona ya no se abre: la reemplazó Aero+, que es
         una interfaz entera. Lo único que queda de ella es el ícono. */
      $("ic-zona").hidden = false;
      amPintarIcono();
      caja.poner("colaboro", 1);        /* no le pedimos plata a quien ya puso */
      pintarZona(d);
    })
    .catch(function(){});
}

$("cod-btn").addEventListener("click", function(){
  var v = ($("cod-txt").value || "").trim().toUpperCase();
  var av = $("cod-aviso"), bt = this;
  if (!v){ $("cod-txt").focus(); return; }
  bt.disabled = true; av.hidden = false; av.style.color = "var(--tinta-2)";
  av.textContent = "Comprobando…";
  fetch("api/acceso", { method:"POST", headers:{"content-type":"application/json"},
                        body: JSON.stringify({ codigo: v }) })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
    .then(function(res){
      bt.disabled = false;
      if (!res.ok){ av.style.color = "#a3231b"; av.textContent = res.j.error || "No se pudo."; return; }
      pase = res.j.pase; caja.poner("pase", pase);
      av.style.color = "#0e5a2c"; av.textContent = "Listo. Ya tenés acceso.";
      revisarPase();
      setTimeout(function(){ cerrarDona("listo"); abrir("v-zona"); }, 900);
    })
    .catch(function(){
      bt.disabled = false; av.style.color = "#a3231b";
      av.textContent = "No se pudo conectar. Probá de nuevo.";
    });
});
$("cod-txt").addEventListener("keydown", function(e){
  if (e.key === "Enter") $("cod-btn").click();
});
revisarPase();

/* ================================================ 8 · cobro automático
   Las dos vías terminan igual: el que paga vuelve con un identificador, y ese
   identificador se manda a /api/acceso, que lo verifica CONTRA EL SERVIDOR DE
   LA PASARELA. Acá no se decide nada. Si esta parte mintiera —«pagó, dale el
   pase»— el servidor igual diría que no.

   El monto tampoco viaja como verdad: /api/pagar arma la orden con el precio
   del lado del servidor. Lo que se manda desde acá es una intención. */
var AUTO = null;

/* el cartel de modo de prueba. Va arriba de todo, en rojo, y no se puede
   cerrar: cobrar con plata que no existe y no darse cuenta es el error caro
   de este montaje. */
function avisarPrueba(){
  if ($("aviso-prueba")) return;
  var d = document.createElement("div");
  d.id = "aviso-prueba";
  d.style.cssText = "margin:0 0 12px;padding:10px 13px;border-radius:4px;" +
    "border:1px solid #d98b7a;background:linear-gradient(180deg,#fff1ec,#ffdfd6);" +
    "color:#8a2412;font-size:13.5px;line-height:1.45";
  d.innerHTML = "<b>Modo de prueba de PayPal.</b> Los pagos son simulados: " +
    "<b>no entra dinero de verdad</b>. Sirve para probar el circuito, no para " +
    "cobrar. Cambiar las credenciales a Live antes de anunciar nada.";
  var cuerpo = document.querySelector("#fondoDona .cuerpo");
  if (cuerpo) cuerpo.insertBefore(d, cuerpo.firstChild);
}

function decirEspera(t, mal){
  var e = $("pp-espera"); e.hidden = false;
  e.style.color = mal ? "#a3231b" : "var(--tinta-2)"; e.textContent = t;
}

function entregarPase(j){
  pase = j.pase; caja.poner("pase", pase);
  revisarPase();
  decirEspera("¡Listo! Ya tenés acceso anticipado.", false);
  setTimeout(function(){ cerrarDona("listo"); abrir("v-zona"); }, 1200);
}

/* --- PayPal: se paga adentro de la página, sin salir --- */
function armarPaypal(){
  if (!AUTO || !AUTO.paypal || window.paypal) return;
  var sc = document.createElement("script");
  sc.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(AUTO.paypal) +
           "&currency=USD&intent=capture&components=buttons&locale=es_AR";
  sc.onload = pintarPaypal;
  sc.onerror = function(){ decirEspera("No se pudo cargar PayPal.", true); };
  document.head.appendChild(sc);
}

function pintarPaypal(){
  if (!window.paypal || !$("pp-botones")) return;
  $("pp-botones").innerHTML = "";
  paypal.Buttons({
    style: { layout:"vertical", shape:"rect", height:44, label:"pay" },
    createOrder: function(){
      decirEspera("Preparando el pago…", false);
      return fetch("api/pagar", { method:"POST", headers:{"content-type":"application/json"},
                                  body: JSON.stringify({ via:"paypal", monto: monto }) })
        .then(function(r){ return r.json(); })
        .then(function(j){ if (!j.orden) throw new Error(j.error || "sin orden"); return j.orden; });
    },
    onApprove: function(datos){
      decirEspera("Confirmando el pago…", false);
      return fetch("api/acceso", { method:"POST", headers:{"content-type":"application/json"},
                                   body: JSON.stringify({ orden: datos.orderID }) })
        .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
        .then(function(res){
          if (!res.ok){ decirEspera(res.j.error || "No se pudo confirmar.", true); return; }
          entregarPase(res.j);
        });
    },
    onCancel: function(){ decirEspera("Cancelaste el pago. No se cobró nada.", false); },
    onError: function(){ decirEspera("PayPal tuvo un problema. Probá de nuevo.", true); }
  }).render("#pp-botones");
  $("pp-botones").hidden = false;
}

/* --- Mercado Pago: se va y vuelve --- */
function irAMercadoPago(){
  decirEspera("Abriendo Mercado Pago…", false);
  fetch("api/pagar", { method:"POST", headers:{"content-type":"application/json"},
                       body: JSON.stringify({ via:"mp", monto: monto }) })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (!j.ir) throw new Error(j.error || "sin enlace");
      /* se recuerda que salimos a pagar, para reconocer la vuelta */
      caja.poner("volviendo", 1);
      location.href = j.ir;
    })
    .catch(function(e){ decirEspera("No se pudo abrir Mercado Pago.", true); });
}

/* la vuelta: Mercado Pago devuelve el identificador en la dirección */
function mirarLaVuelta(){
  var q = new URLSearchParams(location.search);
  if (q.get("pago") !== "mp") return;
  var id = q.get("payment_id") || q.get("collection_id");
  /* se limpia la dirección para que recargar no repita el trámite */
  history.replaceState(null, "", location.pathname);
  caja.sacar("volviendo");
  if (!id) return;
  abrirDona();
  decirEspera("Confirmando el pago…", false);
  fetch("api/acceso", { method:"POST", headers:{"content-type":"application/json"},
                        body: JSON.stringify({ mpPago: id }) })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
    .then(function(res){
      if (!res.ok){ decirEspera(res.j.error || "No se pudo confirmar.", true); return; }
      entregarPase(res.j);
    })
    .catch(function(){ decirEspera("No se pudo confirmar. Escribinos.", true); });
}

conectarControl();
conectarMinas();
conectarBloc();
conectarRepro();


/* ================================================= 5 · Aero+
   La zona de donantes. No es una ventana más: es otra interfaz a pantalla
   completa, con su barra, sus aplicaciones y su fondo. Lo que se desbloquea
   tiene que SENTIRSE distinto, no ser la misma pantalla con un cartel.

   QUIÉN DECIDE SI ENTRÁS: el servidor, no esta página. Acá no hay ningún
   `if (esDonante)` que alguien pueda dar vuelta desde la consola del navegador;
   se le pide `api/aeromas` y si contesta 403 no hay nada que pintar. Poner esa
   decisión de este lado sería dejar la puerta cerrada con un cartel en vez de
   con llave. */
var AM = null;                 /* lo que contestó el servidor */
var amTema = { fondo:"cristal", tono:210, sat:52, vidrio:82 };

var AM_FONDOS = {
  cristal:  "Cristal",   pasto: "Pasto",     nocturno: "Aurora",
  oceano:   "Océano",    cielo: "Cielo"
};
var AM_MARCOS = { agua:"Agua", oro:"Oro", vidrio:"Vidrio" };
/* Íconos de verdad y no los aros: tres anillos casi iguales en la columna no
   distinguen una aplicación de otra, que es para lo único que sirve un ícono. */
var AM_LAMS = { "i-orbe":"img/zona/app.webp",
                "i-vidrio":"img/zona/ico-temas.webp",
                "i-personaje":"img/zona/ico-perfil.webp",
                "i-ventana":"img/zona/ico-galeria.webp",
                "i-fabrica":"img/zona/ico-fabrica.webp" };

function amPedir(cuerpo){
  var o = { headers:{} };
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) o.headers.authorization = "Bearer " + ses.pase;
  if (cuerpo){ o.method = "POST"; o.headers["content-type"] = "application/json";
               o.body = JSON.stringify(cuerpo); }
  return fetch("api/aeromas", o).then(function(r){
    return r.json().then(function(j){
      if (!r.ok) throw new Error(j.error || ("error " + r.status));
      return j; });
  });
}

/* --- el ícono del escritorio: instalar la primera vez, abrir después --- */
function amInstalado(){ return !!caja.leer("aeromas", false); }

function amPintarIcono(){
  var t = $("ic-zona-txt");
  if (t) t.textContent = amInstalado() ? "Aero+" : "Instalar Aero+";
}

/* El instalador. Es teatro —una barra que avanza— pero no miente: cada paso
   espera a que la cosa que nombra haya terminado de verdad. Un progreso que
   corre solo mientras atrás no pasa nada es de las cosas que más rápido hacen
   desconfiar de un programa. */
function amInstalar(){
  var caja1 = $("am-instalar"), lleno = $("am-lleno"), paso = $("am-paso");
  caja1.hidden = false;
  var pasos = [
    ["Comprobando tu acceso…", function(){ return amPedir(null).then(function(j){ AM = j; }); }],
    ["Bajando los fondos…", function(){ return amPrecargar(); }],
    ["Escribiendo en el escritorio…", function(){
        return new Promise(function(r){ caja.poner("aeromas", true); setTimeout(r, quieto?0:450); }); }]
  ];
  var i = 0;
  function seguir(){
    if (i >= pasos.length){
      lleno.style.width = "100%"; paso.textContent = "Listo.";
      setTimeout(function(){ caja1.hidden = true; amPintarIcono(); amAbrir(); }, quieto?0:600);
      return;
    }
    paso.textContent = pasos[i][0];
    lleno.style.width = Math.round(i / pasos.length * 100) + "%";
    pasos[i][1]().then(function(){ i++; seguir(); })
      .catch(function(e){
        paso.textContent = e.message;
        lleno.style.background = "#d6432a";
        setTimeout(function(){ caja1.hidden = true; }, 2600);
      });
  }
  seguir();
}

/* que el fondo no aparezca a pedazos la primera vez que se elige */
function amPrecargar(){
  return Promise.all(Object.keys(AM_FONDOS).map(function(f){
    return new Promise(function(r){
      var im = new Image(); im.onload = im.onerror = r; im.src = "img/zona/f-" + f + ".webp";
    });
  }));
}

function amAbrir(){
  (AM ? Promise.resolve(AM) : amPedir(null).then(function(j){ AM = j; }))
    .then(function(){
      if (AM.yo.tema){ try { amTema = JSON.parse(AM.yo.tema); } catch(e){} }
      $("aeromas").hidden = false;
      document.body.style.overflow = "hidden";
      apilar("aeromas", ocultarAeromas);
      $("am-quien").textContent = "@" + AM.yo.usuario +
        (AM.cuantos > 1 ? "  ·  " + AM.cuantos + " la tienen" : "");
      amPintarApps();
      amAplicarFondo();
      amVer(AM.estrena ? "bienvenida" : "temas");
    })
    .catch(function(e){ alert(e.message); });
}

function ocultarAeromas(){
  $("aeromas").hidden = true;
  document.body.style.overflow = "";
}

function amCerrar(){
  if (!desapilar("aeromas")) ocultarAeromas();
}

function amPintarApps(){
  var n = $("am-apps"); n.textContent = "";
  AM.apps.forEach(function(a){
    var b = document.createElement("button");
    b.type = "button"; b.dataset.app = a.id;
    var im = document.createElement("img");
    im.className = "lam"; im.src = AM_LAMS[a.icono] || "img/zona/app.webp"; im.alt = "";
    var t = document.createElement("div");
    var bb = document.createElement("b"); bb.textContent = a.nombre;
    var sp = document.createElement("span"); sp.textContent = a.que;
    t.appendChild(bb); t.appendChild(sp);
    b.appendChild(im); b.appendChild(t);
    b.addEventListener("click", function(){ amVer(a.id); });
    n.appendChild(b);
  });
}

function amAplicarFondo(){
  $("am-fondo").style.backgroundImage = 'url("img/zona/f-' + amTema.fondo + '.webp")';
}

function amVer(cual){
  Array.prototype.forEach.call($("am-apps").children, function(b){
    b.setAttribute("aria-current", String(b.dataset.app === cual));
  });
  var p = $("am-panel"); p.textContent = "";
  if (cual === "bienvenida") return amBienvenida(p);
  if (cual === "temas")   return amTemas(p);
  if (cual === "perfil")  return amPerfil(p);
  if (cual === "galeria") return amGaleria(p);
  if (cual === "fabrica") return amFabrica(p);
  if (cual === "tienda")  return amTienda(p);
}

function amTitulo(p, t, b){
  var h = document.createElement("h2"); h.textContent = t; p.appendChild(h);
  var q = document.createElement("p"); q.className = "baja"; q.textContent = b; p.appendChild(q);
}
function amCaja(p, t){
  var c = document.createElement("div"); c.className = "am-caja";
  if (t){ var h = document.createElement("h3"); h.textContent = t; c.appendChild(h); }
  p.appendChild(c); return c;
}

function amBienvenida(p){
  amTitulo(p, "Bienvenido a Aero+",
    "Se instaló. Desde ahora el ícono del escritorio te trae directo acá.");
  var c = amCaja(p, null);
  var q = document.createElement("p");
  q.style.cssText = "margin:0;font-size:14.5px;line-height:1.6";
  q.textContent = "Hay cuatro cosas adentro: un estudio de temas con fondos que no " +
    "están en el escritorio común, marcos para tu retrato que se ven en el muro, " +
    "la galería para bajarte los fondos en grande, y una fábrica donde pedís un " +
    "fondo con palabras y una máquina te lo dibuja. Todo lo que elijas queda " +
    "guardado en tu cuenta, así que te sigue si entrás desde el teléfono.";
  c.appendChild(q);
  var b = document.createElement("button");
  b.className = "am-bt"; b.type = "button"; b.textContent = "Empezar por los temas";
  b.style.marginTop = "12px";
  b.addEventListener("click", function(){ amVer("temas"); });
  c.appendChild(b);
}

/* ------------------------------------------------------- estudio de temas */
function amTemas(p){
  amTitulo(p, "Estudio de temas",
    "El fondo es de acá adentro. El color del vidrio y la transparencia también " +
    "pintan el escritorio de afuera, en vivo.");

  var c = amCaja(p, "Fondo");
  var r = document.createElement("div"); r.className = "am-rej";
  Object.keys(AM_FONDOS).forEach(function(f){
    var b = document.createElement("button"); b.type = "button";
    b.setAttribute("aria-pressed", String(amTema.fondo === f));
    var im = document.createElement("img");
    im.src = "img/zona/f-" + f + ".webp"; im.alt = AM_FONDOS[f]; im.loading = "lazy";
    var pie = document.createElement("span"); pie.className = "pie"; pie.textContent = AM_FONDOS[f];
    b.appendChild(im); b.appendChild(pie);
    b.addEventListener("click", function(){
      amTema.fondo = f;
      Array.prototype.forEach.call(r.children, function(x){
        x.setAttribute("aria-pressed", String(x === b)); });
      amAplicarFondo(); amGuardar();
    });
    r.appendChild(b);
  });
  c.appendChild(r);

  var c2 = amCaja(p, "El vidrio");
  [["tono","Color", 0, 360], ["sat","Saturación", 0, 100], ["vidrio","Transparencia", 40, 100]]
    .forEach(function(x){
      var l = document.createElement("label"); l.textContent = x[1];
      var i = document.createElement("input");
      i.type = "range"; i.min = x[2]; i.max = x[3]; i.value = amTema[x[0]];
      i.addEventListener("input", function(){
        amTema[x[0]] = +this.value;
        /* el escritorio de afuera usa las mismas variables: se retiñe solo */
        var raiz = document.documentElement.style;
        raiz.setProperty("--tono", amTema.tono);
        raiz.setProperty("--sat", amTema.sat + "%");
        raiz.setProperty("--vidrio", amTema.vidrio + "%");
      });
      i.addEventListener("change", amGuardar);
      c2.appendChild(l); c2.appendChild(i);
    });
}

/* ------------------------------------------------------------- Perfil+ */
function amPerfil(p){
  amTitulo(p, "Perfil+",
    "El marco y el lema se ven en el muro, así que los ve el resto. " +
    "La banda es el fondo de tu perfil.");

  var c = amCaja(p, "Marco del retrato");
  var fila = document.createElement("div"); fila.className = "am-fila";
  var prev = document.createElement("div"); prev.className = "am-previa";
  var rt = document.createElement("img"); rt.className = "rt"; rt.alt = "";
  var ses = caja.leer("sesion", null);
  rt.src = (ses && ses.yo) ? retratoDe2(ses.yo.retrato) : "img/mascota/m-saludando.463f6804.webp";
  var ar = document.createElement("img"); ar.className = "ar"; ar.alt = "";
  prev.appendChild(rt); prev.appendChild(ar);
  fila.appendChild(prev);
  c.appendChild(fila);

  function pintarAro(){
    ar.src = AM.yo.marco ? "img/zona/marco-" + AM.yo.marco + ".webp" : "";
    ar.style.display = AM.yo.marco ? "" : "none";
  }
  pintarAro();

  var r = document.createElement("div"); r.className = "am-rej aros";
  r.style.marginTop = "12px";
  [""].concat(Object.keys(AM_MARCOS)).forEach(function(m){
    var b = document.createElement("button"); b.type = "button";
    b.setAttribute("aria-pressed", String((AM.yo.marco || "") === m));
    b.title = m ? AM_MARCOS[m] : "Sin marco";
    if (m){
      var im = document.createElement("img");
      im.alt = b.title; im.loading = "lazy";
      im.src = "img/zona/marco-" + m + ".webp";
      b.appendChild(im);
    } else {
      /* el «sin marco» es un hueco, no otra opción de aro: con la mascota
         adentro parecía un cuarto marco y no la forma de sacárselos */
      var v = document.createElement("span");
      v.style.cssText = "display:grid;place-items:center;aspect-ratio:1;font-size:12.5px;" +
        "color:rgba(226,242,255,.75);border-radius:50%;" +
        "background:repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 7px," +
        "rgba(255,255,255,.11) 7px 14px)";
      v.textContent = "Sin marco";
      b.appendChild(v);
    }
    b.addEventListener("click", function(){
      AM.yo.marco = m;
      Array.prototype.forEach.call(r.children, function(x){
        x.setAttribute("aria-pressed", String(x === b)); });
      pintarAro(); amGuardar();
    });
    r.appendChild(b);
  });
  c.appendChild(r);

  var c2 = amCaja(p, "Tu lema");
  var l = document.createElement("label");
  l.htmlFor = "am-lema"; l.textContent = "Una línea, la que quieras";
  var i = document.createElement("input");
  i.type = "text"; i.id = "am-lema"; i.maxLength = 80; i.value = AM.yo.lema || "";
  i.placeholder = "Hago cosas con vidrio y burbujas";
  i.addEventListener("change", function(){ AM.yo.lema = this.value; amGuardar(); });
  c2.appendChild(l); c2.appendChild(i);

  var c3 = amCaja(p, "Banda del perfil");
  var r2 = document.createElement("div"); r2.className = "am-rej";
  [""].concat(Object.keys(AM_FONDOS)).forEach(function(f){
    var b = document.createElement("button"); b.type = "button";
    b.setAttribute("aria-pressed", String((AM.yo.banda || "") === f));
    if (f){
      var im = document.createElement("img");
      im.src = "img/zona/f-" + f + ".webp"; im.alt = AM_FONDOS[f]; im.loading = "lazy";
      b.appendChild(im);
    } else {
      var v = document.createElement("span");
      v.style.cssText = "display:block;aspect-ratio:16/9;background:rgba(255,255,255,.08)";
      b.appendChild(v);
    }
    var pie = document.createElement("span");
    pie.className = "pie"; pie.textContent = f ? AM_FONDOS[f] : "Sin banda";
    b.appendChild(pie);
    b.addEventListener("click", function(){
      AM.yo.banda = f;
      Array.prototype.forEach.call(r2.children, function(x){
        x.setAttribute("aria-pressed", String(x === b)); });
      amGuardar();
    });
    r2.appendChild(b);
  });
  c3.appendChild(r2);
}

/* el mismo mapa de retratos que usa el muro, sin duplicar la lista */
function retratoDe2(r){
  if (r && /^https?:/.test(r)) return r;
  var e = document.querySelector('#retratos [data-r="' + r + '"] img');
  return e ? e.src : "img/mascota/m-saludando.463f6804.webp";
}

/* ------------------------------------------------------------- galería */
function amGaleria(p){
  amTitulo(p, "Galería",
    "Los cinco fondos en grande. Son tuyos: usalos donde quieras.");
  var c = amCaja(p, null);
  var r = document.createElement("div"); r.className = "am-rej";
  Object.keys(AM_FONDOS).forEach(function(f){
    var a = document.createElement("a");
    a.href = "img/zona/f-" + f + ".webp"; a.target = "_blank"; a.rel = "noopener";
    a.className = "";
    a.style.cssText = "display:block;border-radius:5px;overflow:hidden;" +
      "border:2px solid rgba(255,255,255,.22);text-decoration:none;color:inherit";
    var im = document.createElement("img");
    im.src = "img/zona/f-" + f + ".webp"; im.alt = AM_FONDOS[f]; im.loading = "lazy";
    im.style.cssText = "display:block;width:100%;aspect-ratio:16/9;object-fit:cover";
    var pie = document.createElement("span");
    pie.className = "pie"; pie.style.display = "block";
    pie.textContent = AM_FONDOS[f] + " — abrir en grande";
    a.appendChild(im); a.appendChild(pie);
    r.appendChild(a);
  });
  c.appendChild(r);
}

/* -------------------------------------------------- la fábrica de fondos
   Se escribe una idea y una máquina dibuja el fondo. Tres cosas que esta
   pantalla hace a propósito:

   NO GUARDA LA IMAGEN ACÁ. Lo que vuelve del servidor es la ficha (número,
   idea, forma) y la imagen se pide después por su dirección, como cualquier
   `<img>`. Así el navegador la cachea y volver a esta pantalla no vuelve a
   bajar varios megabytes.

   EL BOTÓN SE APAGA MIENTRAS DIBUJA. Un dibujo tarda unos segundos y gasta
   cuota del día: dejar el botón vivo es invitar a que alguien lo toque tres
   veces y se quede sin cuota por la misma idea.

   EL TOPE SE MUESTRA ANTES Y NO DESPUÉS. Enterarse de que había un límite
   recién cuando se choca es lo que hace que un límite razonable se sienta una
   trampa. */
var FAB = null;

function fabPedir(cuerpo){
  var o = { headers:{} };
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) o.headers.authorization = "Bearer " + ses.pase;
  if (cuerpo){ o.method = "POST"; o.headers["content-type"] = "application/json";
               o.body = JSON.stringify(cuerpo); }
  return fetch("api/fabrica", o).then(function(r){
    return r.json().then(function(j){
      if (!r.ok) throw new Error(j.error || ("error " + r.status));
      return j; });
  });
}

/* El pedido de dibujo NO vuelve en JSON: vuelve la imagen en crudo. Por eso se
   mira el `content-type` antes de leer: si es una imagen, es el dibujo; si es
   JSON, es el motivo por el que no hay dibujo. Leerlo siempre como JSON haría
   que un error de verdad apareciera como «unexpected token» y nadie entienda
   qué pasó. */
function fabDibujar(idea, forma){
  var h = { "content-type": "application/json" };
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) h.authorization = "Bearer " + ses.pase;
  return fetch("api/fabrica?hacer=dibujar", { method:"POST", headers:h,
      body: JSON.stringify({ idea:idea, forma:forma }) })
    .then(function(r){
      var t = r.headers.get("content-type") || "";
      if (!r.ok || t.indexOf("image/") !== 0){
        return r.json().then(function(j){ throw new Error(j.error || ("error " + r.status)); },
                             function(){ throw new Error("error " + r.status); });
      }
      return r.blob().then(function(b){
        return { blob: b, hechos: parseInt(r.headers.get("x-hechos"), 10) || 0 };
      });
    });
}

/* Lo que dibuja el servidor es un PNG de más de un megabyte. Acá se vuelve a
   comprimir a JPEG antes de mandarlo a guardar, porque una fila de la base
   corta cerca de 1 MB y porque después hay que bajarlo cada vez que se abre
   esta pantalla. Se hace en el navegador y no en el servidor por lo mismo que
   está explicado en `functions/api/fabrica.js`: la máquina de la persona ya
   sabe hacerlo y no cuesta nada. */
function fabAchicar(blob){
  return createImageBitmap(blob).then(function(im){
    var lz = document.createElement("canvas");
    lz.width = im.width; lz.height = im.height;
    lz.getContext("2d").drawImage(im, 0, 0);
    im.close && im.close();
    return new Promise(function(ok, mal){
      /* se baja la calidad de a poco hasta que entre; empezar directo en algo
         muy comprimido arruinaría los degradés, que es de lo que está hecho
         este estilo */
      var pasos = [0.86, 0.74, 0.62, 0.5], i = 0;
      (function probar(){
        lz.toBlob(function(b){
          if (!b) return mal(new Error("no se pudo achicar"));
          if (b.size <= 780000 || i >= pasos.length - 1) return ok(b);
          i++; probar();
        }, "image/jpeg", pasos[i]);
      })();
    });
  });
}

function fabGuardar(jpg, idea, forma){
  var h = { "content-type": "image/jpeg" };
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) h.authorization = "Bearer " + ses.pase;
  return fetch("api/fabrica?hacer=guardar&idea=" + encodeURIComponent(idea) +
               "&forma=" + encodeURIComponent(forma),
               { method:"POST", headers:h, body: jpg })
    .then(function(r){
      return r.json().then(function(j){
        if (!r.ok) throw new Error(j.error || ("error " + r.status));
        return j; });
    });
}

function fabDir(id){
  return "api/fabrica?id=" + id + "&pase=" + encodeURIComponent(FAB.pase || "");
}

function fabBorrar(id){
  var h = {};
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) h.authorization = "Bearer " + ses.pase;
  return fetch("api/fabrica?hacer=borrar&id=" + id, { method:"POST", headers:h })
    .then(function(r){
      return r.json().then(function(j){
        if (!r.ok) throw new Error(j.error || ("error " + r.status));
        return j; });
    });
}

/* Las ideas de arranque. Una pantalla que abre con un campo vacío y un botón
   deja a la persona pensando qué escribir; con ejemplos tocables, la primera
   prueba sale en dos segundos. */
var FAB_IDEAS = [
  "Una isla de pasto flotando sobre el océano",
  "Burbujas gigantes sobre un campo verde al amanecer",
  "Un pez de cristal nadando entre nubes",
  "Rascacielos de vidrio con cascadas cayendo",
  "Un delfín saltando sobre agua turquesa",
  "Hojas mojadas con gotas enormes, sol atrás"
];

function amFabrica(p){
  amTitulo(p, "Fábrica de fondos",
    "Escribí lo que querés ver y la máquina lo dibuja en Frutiger Aero.");

  var carga = amCaja(p, null);
  carga.textContent = "Abriendo la fábrica…";

  /* El mensaje de error se pone en el PANEL y no en la caja de «abriendo»,
     porque para cuando algo puede fallar al pintar, esa caja ya fue sacada de
     la pantalla: escribir ahí es escribir en un nodo que nadie ve, y la
     pantalla queda a medias sin decir por qué. */
  fabPedir(null).then(function(j){
    FAB = j;
    p.textContent = "";
    amTitulo(p, "Fábrica de fondos",
      "Escribí lo que querés ver y la máquina lo dibuja en Frutiger Aero.");
    fabPintar(p);
  }).catch(function(e){
    p.textContent = "";
    amTitulo(p, "Fábrica de fondos", "");
    amCaja(p, null).textContent = e.message;
  });
}

function fabPintar(p){
  var c = amCaja(p, null);

  if (!FAB.hay){
    var sin = document.createElement("p");
    sin.style.cssText = "margin:0;font-size:14px;line-height:1.6";
    sin.textContent = "La fábrica todavía no está enchufada de este lado. " +
      "Vas a poder pedir fondos en cuanto lo esté.";
    c.appendChild(sin);
    return;
  }

  /* --- la forma --- */
  var lf = document.createElement("div");
  lf.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px";
  var forma = "telefono";
  Object.keys(FAB.formas).forEach(function(k){
    var b = document.createElement("button");
    b.type = "button"; b.className = "am-bt"; b.dataset.forma = k;
    b.style.cssText = "padding:6px 13px;font-size:13px";
    b.textContent = FAB.formas[k].que;
    b.setAttribute("aria-current", String(k === forma));
    b.addEventListener("click", function(){
      forma = k;
      Array.prototype.forEach.call(lf.children, function(x){
        x.setAttribute("aria-current", String(x.dataset.forma === forma)); });
    });
    lf.appendChild(b);
  });
  c.appendChild(lf);

  /* --- la idea --- */
  var fila = document.createElement("div");
  fila.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
  var ent = document.createElement("input");
  ent.type = "text"; ent.maxLength = 160;
  ent.placeholder = "Un lago de cristal entre montañas…";
  ent.style.cssText = "flex:1 1 210px;min-width:0;padding:9px 11px;border-radius:4px;" +
    "border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);" +
    "color:#eaf6ff;font:inherit;font-size:14px";
  var bot = document.createElement("button");
  bot.type = "button"; bot.className = "am-bt";
  bot.style.cssText = "padding:9px 18px";
  bot.textContent = "Dibujar";
  fila.appendChild(ent); fila.appendChild(bot);
  c.appendChild(fila);

  /* --- ideas para empezar --- */
  var ideas = document.createElement("div");
  ideas.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:9px";
  FAB_IDEAS.forEach(function(t){
    var b = document.createElement("button");
    b.type = "button";
    b.style.cssText = "padding:4px 10px;border-radius:999px;font:inherit;font-size:12.5px;" +
      "cursor:pointer;color:#dff0ff;background:rgba(255,255,255,.1);" +
      "border:1px solid rgba(255,255,255,.22)";
    b.textContent = t;
    b.addEventListener("click", function(){ ent.value = t; ent.focus(); });
    ideas.appendChild(b);
  });
  c.appendChild(ideas);

  /* --- cuánto queda --- */
  var cuota = document.createElement("p");
  cuota.className = "pie";
  cuota.style.cssText = "margin:10px 0 0";
  function verCuota(){
    var quedan = Math.max(0, FAB.tope - FAB.hechos);
    cuota.textContent = "Te quedan " + quedan + " de " + FAB.tope + " dibujos hoy. " +
      "Se guardan los últimos " + FAB.guarda + "; el más viejo se cae solo.";
  }
  verCuota();
  c.appendChild(cuota);

  var aviso = document.createElement("p");
  aviso.style.cssText = "margin:8px 0 0;font-size:12.5px;line-height:1.55;color:rgba(226,242,255,.7)";
  aviso.textContent = "Los dibuja una máquina: a veces sale raro, a veces sale hermoso. " +
    "Si no te gusta, borralo y probá con otras palabras.";
  c.appendChild(aviso);

  /* --- la rejilla de lo hecho --- */
  var rej = document.createElement("div");
  rej.className = "am-rej";
  rej.style.marginTop = "14px";
  p.appendChild(rej);

  function vacia(){
    rej.textContent = "";
    if (FAB.fondos.length) return false;
    var v = document.createElement("p");
    v.className = "pie";
    v.textContent = "Todavía no hiciste ninguno.";
    rej.appendChild(v);
    return true;
  }

  function pintarRej(){
    if (vacia()) return;
    FAB.fondos.forEach(function(f){
      var t = document.createElement("figure");
      t.style.cssText = "margin:0;border-radius:5px;overflow:hidden;" +
        "border:2px solid rgba(255,255,255,.22);background:rgba(0,0,0,.2)";
      var im = document.createElement("img");
      /* el pase va en la dirección y no en una cabecera: un `<img>` no puede
         mandar cabeceras, así que con el pase en `Authorization` todas las
         miniaturas darían 403 con la pantalla entera pintada */
      im.src = fabDir(f.id); im.alt = f.idea; im.loading = "lazy";
      /* cada miniatura con la forma que tiene el fondo de verdad. Si todas
         salieran en la misma caja, uno elegiría «Teléfono» y vería un
         rectángulo acostado: justo lo que no va a recibir. */
      im.style.cssText = "display:block;width:100%;object-fit:cover;aspect-ratio:" +
        (f.forma === "escritorio" ? "16/9" : f.forma === "cuadrado" ? "1/1" : "9/16");
      t.appendChild(im);
      var pie = document.createElement("figcaption");
      pie.style.cssText = "padding:7px 9px;font-size:12.5px;line-height:1.45";
      var q = document.createElement("div");
      q.textContent = f.idea;
      q.style.cssText = "color:rgba(226,242,255,.9);margin-bottom:6px";
      pie.appendChild(q);
      var bots = document.createElement("div");
      bots.style.cssText = "display:flex;gap:7px;flex-wrap:wrap";

      var baj = document.createElement("a");
      baj.href = fabDir(f.id);
      baj.setAttribute("download", "frutiger-" + f.id + ".jpg");
      baj.textContent = "Bajar";
      baj.style.cssText = "color:#bfe6ff;font-size:12.5px";
      bots.appendChild(baj);

      var bor = document.createElement("button");
      bor.type = "button";
      bor.textContent = "Borrar";
      bor.style.cssText = "background:none;border:0;padding:0;cursor:pointer;" +
        "color:#ffc9bd;font:inherit;font-size:12.5px";
      bor.addEventListener("click", function(){
        bor.disabled = true;
        fabBorrar(f.id).then(function(){
          FAB.fondos = FAB.fondos.filter(function(x){ return x.id !== f.id; });
          pintarRej();
        }).catch(function(e){ bor.disabled = false; alert(e.message); });
      });
      bots.appendChild(bor);

      pie.appendChild(bots);
      t.appendChild(pie);
      rej.appendChild(t);
    });
  }
  pintarRej();

  bot.addEventListener("click", function(){
    var idea = ent.value.trim();
    if (idea.length < 3){ ent.focus(); return; }
    bot.disabled = true; ent.disabled = true;
    var antes = bot.textContent;
    bot.textContent = "Dibujando…";
    fabDibujar(idea, forma)
      .then(function(d){
        /* la cuota se gastó apenas dibujó, aunque después falle el guardado:
           mostrarlo recién al final haría creer que el intento fue gratis */
        FAB.hechos = d.hechos || (FAB.hechos + 1);
        verCuota();
        bot.textContent = "Guardando…";
        return fabAchicar(d.blob).then(function(jpg){
          return fabGuardar(jpg, idea, forma);
        });
      })
      .then(function(j){
        FAB.fondos.unshift(j.fondo);
        if (FAB.fondos.length > FAB.guarda) FAB.fondos.length = FAB.guarda;
        if (j.hechos) FAB.hechos = j.hechos;
        verCuota(); pintarRej();
        ent.value = "";
      })
      .catch(function(e){ alert(e.message); })
      .then(function(){
        bot.disabled = false; ent.disabled = false; bot.textContent = antes;
      });
  });
  ent.addEventListener("keydown", function(e){ if (e.key === "Enter") bot.click(); });
}

/* ------------------------------------------------------------- la tienda
   Las apps que hace el dueño, gratis para el que colaboró. El catálogo lo manda
   el servidor: si viviera acá, agregarse una app sería editar un objeto en la
   consola del navegador. */
/* ------------------------------------------------------------- la tienda
   Partida en dos: lo que hace el dueño y lo que propone la gente. No es una
   separación decorativa: quien baja algo tiene derecho a saber si lo hizo el
   que mantiene el sitio o un desconocido, porque es lo que decide cuánta
   confianza corresponde. Lo de la comunidad además pasa por revisión antes de
   aparecer. */
function amTienda(p){
  amTitulo(p, "Tienda",
    "Las apps, gratis para vos por haber colaborado. Se bajan de acá y se " +
    "instalan a mano.");

  seccionTienda(p, "Del sitio", AM.tienda,
    "Las que hago yo. Salen de acá mismo y pasan por la puerta de tu cuenta.");
  seccionTienda(p, "De la comunidad", AM.comunidad,
    "Las que propone la gente. Están revisadas antes de aparecer, pero no las " +
    "hago yo: mirá la huella y los permisos antes de instalar.");

  if (AM.esperando && AM.esperando.length) colaDeRevision(p);

  var bots = document.createElement("div"); bots.className = "bots";
  bots.style.marginTop = "16px";
  if (AM.jefe){
    var b1 = document.createElement("button");
    b1.type = "button"; b1.className = "am-bt"; b1.style.padding = "8px 16px";
    b1.textContent = "Cargar una app";
    b1.addEventListener("click", function(){ formTienda(p, null); });
    bots.appendChild(b1);
  }
  var b2 = document.createElement("button");
  b2.type = "button";
  b2.style.cssText = "margin-left:8px;padding:8px 14px;border-radius:4px;cursor:pointer;" +
    "font:inherit;font-size:13.5px;color:#dff0ff;background:rgba(255,255,255,.12);" +
    "border:1px solid rgba(255,255,255,.28)";
  b2.textContent = "Proponer una app";
  b2.addEventListener("click", function(){ formProponer(p); });
  bots.appendChild(b2);
  p.appendChild(bots);

  panelEditor(p);
}

/* ------------------------------------------------- la cuota para publicar
   Lo que se cobra es PUBLICAR una app que cobra, no la venta. La plata de las
   ventas va del que compra al que hizo la app, por afuera de este sitio: acá no
   pasa plata ajena. Eso está dicho en la pantalla y no sólo en el código,
   porque es lo que alguien necesita saber ANTES de pagar una cuota. */
function panelEditor(p){
  var c = amCaja(p, "Publicar apps que cobran");
  c.style.marginTop = "18px";
  var q = document.createElement("p");
  q.style.cssText = "margin:0 0 10px;font-size:13.5px;line-height:1.6";
  c.appendChild(q);
  q.textContent = "Leyendo tu estado…";

  fetch("api/editor", { headers: cabeceraSesion() })
    .then(function(r){ return r.json(); })
    .then(function(j){
      if (j.error){ q.textContent = j.error; return; }

      if (j.porSerJefe){
        q.textContent = "Sos el dueño del sitio: publicás apps que cobran sin cuota. " +
          "Acá le das la cuota a quien te pagó por afuera —una transferencia en pesos, " +
          "por ejemplo—, que es plata que ninguna pasarela te va a avisar.";
        formDarCuota(c);
        return;
      }

      var explica = "Subir apps gratis no cuesta nada. Si querés publicar una que " +
        "cobre, la cuota es de US$ " + j.mensual + " por mes. Lo que se paga es " +
        "publicar: la plata de tus ventas va de quien te compra a vos, por afuera " +
        "de este sitio —acá no pasa plata de nadie más—.";

      if (j.activo){
        q.textContent = "Tu cuota está al día hasta el " + fechaCorta(j.hasta) + ". " +
          "Podés publicar apps que cobran. " + explica;
      } else {
        q.textContent = explica;
        if (j.hasta) {
          var v = document.createElement("p");
          v.className = "pie"; v.style.cssText = "margin:0 0 10px";
          v.textContent = "Tu última cuota venció el " + fechaCorta(j.hasta) + ".";
          c.insertBefore(v, c.children[c.children.length - 1]);
        }
      }

      var caja2 = document.createElement("div");
      caja2.id = "cuota-botones";
      caja2.style.marginTop = "10px";
      c.appendChild(caja2);
      var aviso = document.createElement("p");
      aviso.className = "pie"; aviso.style.cssText = "margin:8px 0 0";
      c.appendChild(aviso);

      botonesDeCuota(caja2, aviso, j);
    })
    .catch(function(){ q.textContent = "No se pudo leer tu estado de editor."; });
}

/* Dar la cuota a mano. Existe porque una transferencia en pesos no le avisa a
   nadie: la plata entra y el sitio no se entera nunca. Sin este formulario, la
   unica forma de cobrar en pesos era que alguien llamara la API a mano, o sea
   que en la practica no existia.

   EL COMPROBANTE NO ES UN CAMPO DE ADORNO: con el mismo numero cargado dos
   veces no se suman dos meses. Es la red que evita regalar un mes por haber
   tocado el boton dos veces sin estar seguro de que anduvo la primera. */
function formDarCuota(c){
  var caja2 = document.createElement("div");
  caja2.style.cssText = "margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.18)";
  var h = document.createElement("div");
  h.style.cssText = "font-size:13px;font-weight:600;margin-bottom:8px";
  h.textContent = "Darle la cuota a alguien";
  caja2.appendChild(h);

  var fila = document.createElement("div");
  fila.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end";
  function campo(ancho, marca, valor){
    var e = document.createElement("input");
    e.type = "text"; e.placeholder = marca; if (valor) e.value = valor;
    e.style.cssText = "flex:" + ancho + ";min-width:0;padding:7px 9px;border-radius:4px;" +
      "border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);" +
      "color:#eaf6ff;font:inherit;font-size:13px";
    fila.appendChild(e); return e;
  }
  var quien = campo("2 1 140px", "@usuario o número de cuenta");
  var meses = campo("0 1 70px", "meses", "1");
  var ref   = campo("2 1 150px", "n° de comprobante");

  var b = document.createElement("button");
  b.type = "button"; b.className = "am-bt"; b.style.padding = "8px 14px";
  b.textContent = "Dar cuota";
  fila.appendChild(b);
  caja2.appendChild(fila);

  var av = document.createElement("p");
  av.className = "pie"; av.style.cssText = "margin:8px 0 0";
  av.textContent = "Poné el comprobante: con el mismo número, cargarlo dos veces no suma dos meses.";
  caja2.appendChild(av);

  b.addEventListener("click", function(){
    if (!quien.value.trim()){ quien.focus(); return; }
    b.disabled = true; av.textContent = "Dando…";
    fetch("api/editor", { method:"POST",
        headers: Object.assign({"content-type":"application/json"}, cabeceraSesion()),
        body: JSON.stringify({ hacer:"dar", usuario:quien.value, meses:meses.value, ref:ref.value }) })
      .then(function(r){ return r.json().then(function(x){ return {ok:r.ok, x:x}; }); })
      .then(function(res){
        b.disabled = false;
        if (!res.ok){ av.textContent = res.x.error || "No se pudo."; return; }
        av.textContent = res.x.yaEstaba
          ? "Ese comprobante ya estaba cargado: no se sumó de nuevo. @" + res.x.aQuien +
            " tiene cuota hasta el " + fechaCorta(res.x.hasta) + "."
          : "Listo: @" + res.x.aQuien + " puede publicar apps que cobran hasta el " +
            fechaCorta(res.x.hasta) + ".";
      })
      .catch(function(){ b.disabled = false; av.textContent = "No se pudo."; });
  });

  c.appendChild(caja2);
}

function fechaCorta(ms){
  if (!ms) return "—";
  var d = new Date(ms);
  return d.toLocaleDateString("es-AR", { day:"numeric", month:"long", year:"numeric" });
}

function cabeceraSesion(){
  var h = {};
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) h.authorization = "Bearer " + ses.pase;
  return h;
}

/* El botón de PayPal de la cuota es el mismo mecanismo que el de colaborar,
   pero termina en `api/editor` y no en `api/acceso`: son dos cosas distintas y
   confundirlas daría acceso de donante a quien pagó por publicar, o al revés. */
function botonesDeCuota(donde, aviso, j){
  if (!AUTO || !AUTO.paypal){
    aviso.textContent = "PayPal no está configurado, así que la cuota se arregla a mano por ahora.";
    return;
  }
  function pintar(){
    if (!window.paypal) return;
    donde.innerHTML = "";
    paypal.Buttons({
      style: { layout:"vertical", shape:"rect", height:42, label:"pay" },
      createOrder: function(){
        aviso.textContent = "Preparando el pago…";
        return fetch("api/pagar", { method:"POST", headers:{"content-type":"application/json"},
            body: JSON.stringify({ via:"paypal", monto: j.mensual, concepto:"editor" }) })
          .then(function(r){ return r.json(); })
          .then(function(x){ if (!x.orden) throw new Error(x.error || "sin orden"); return x.orden; });
      },
      onApprove: function(datos){
        aviso.textContent = "Confirmando el pago…";
        return fetch("api/editor", { method:"POST",
            headers: Object.assign({"content-type":"application/json"}, cabeceraSesion()),
            body: JSON.stringify({ orden: datos.orderID }) })
          .then(function(r){ return r.json().then(function(x){ return {ok:r.ok, x:x}; }); })
          .then(function(res){
            if (!res.ok){ aviso.textContent = res.x.error || "No se pudo confirmar."; return; }
            /* `yaEstaba` es el caso de recargar después de pagar: no se sumó de
               nuevo, y decirlo evita que alguien crea que pagó dos veces */
            aviso.textContent = res.x.yaEstaba
              ? "Ese pago ya estaba tomado. Tu cuota va hasta el " + fechaCorta(res.x.hasta) + "."
              : "¡Listo! Podés publicar apps que cobran hasta el " + fechaCorta(res.x.hasta) + ".";
            setTimeout(function(){ amVer("tienda"); }, 1800);
          });
      },
      onCancel: function(){ aviso.textContent = "Cancelaste el pago. No se cobró nada."; },
      onError: function(){ aviso.textContent = "PayPal tuvo un problema. Probá de nuevo."; }
    }).render("#" + donde.id);
  }
  if (window.paypal) return pintar();
  var sc = document.createElement("script");
  sc.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(AUTO.paypal) +
           "&currency=USD&intent=capture&components=buttons&locale=es_AR";
  sc.onload = pintar;
  sc.onerror = function(){ aviso.textContent = "No se pudo cargar PayPal."; };
  document.head.appendChild(sc);
}

function seccionTienda(p, titulo, lista, bajada){
  var h = document.createElement("h3");
  h.style.cssText = "margin:18px 0 2px;font-size:15px;font-weight:600";
  h.textContent = titulo;
  p.appendChild(h);
  var q = document.createElement("p");
  q.className = "pie"; q.style.cssText = "margin:0 0 8px";
  q.textContent = bajada;
  p.appendChild(q);

  if (!lista || !lista.length){
    var v = amCaja(p, null);
    v.style.marginTop = "0";
    v.appendChild(document.createTextNode("Todavía no hay nada acá."));
    return;
  }
  lista.forEach(function(a){ tarjetaApp(p, a, false); });
}

/* La cola de revisión. El jefe la ve entera; el que propuso ve la suya, porque
   mandar algo y no volver a saber nunca más si entró o no es la forma más
   rápida de que nadie proponga una segunda vez. */
function colaDeRevision(p){
  var h = document.createElement("h3");
  h.style.cssText = "margin:20px 0 2px;font-size:15px;font-weight:600";
  h.textContent = AM.jefe ? "Esperando que las revises" : "Lo que propusiste";
  p.appendChild(h);
  AM.esperando.forEach(function(a){ tarjetaApp(p, a, true); });
}

function tarjetaApp(p, a, enRevision){
  var c = amCaja(p, null);
  c.style.marginTop = "10px";

  var cab = document.createElement("div");
  cab.style.cssText = "display:flex;gap:12px;align-items:flex-start";
  var im = document.createElement("img");
  im.src = a.icono || "img/zona/app.webp"; im.alt = ""; im.loading = "lazy";
  im.style.cssText = "width:56px;height:56px;flex:none";
  cab.appendChild(im);

  var t = document.createElement("div"); t.style.flex = "1";
  var h = document.createElement("h3"); h.style.margin = "0 0 2px";
  h.textContent = a.nombre;
  t.appendChild(h);
  var meta = document.createElement("div");
  meta.style.cssText = "font-size:12.5px;color:rgba(226,242,255,.75)";
  meta.textContent = [a.version, a.para, a.peso,
                      a.paga ? (a.precio || "de paga") : null,
                      a.origen === "comunidad" ? "de la comunidad" : null,
                      a.estado === "rechazada" ? "rechazada" :
                      a.estado === "pendiente" ? "esperando revisión" : null]
                     .filter(Boolean).join("  ·  ");
  t.appendChild(meta);
  if (a.que){
    var q = document.createElement("p");
    q.style.cssText = "margin:7px 0 0;font-size:14px;line-height:1.55";
    q.textContent = a.que;
    t.appendChild(q);
  }
  cab.appendChild(t);
  c.appendChild(cab);

  /* Lo que pide y el aviso van ANTES del botón, no escondidos detrás. Quien
     instala tiene derecho a saber qué le va a pedir sin tener que leerlo recién
     en la pantalla de Android, cuando ya lo bajó. */
  if (a.permisos && a.permisos.length){
    var d = document.createElement("details");
    d.style.cssText = "margin-top:10px;font-size:13.5px";
    var r = document.createElement("summary");
    r.style.cursor = "pointer";
    r.textContent = "Qué permisos te va a pedir (" + a.permisos.length + ")";
    d.appendChild(r);
    var ul = document.createElement("ul");
    ul.style.cssText = "margin:7px 0 0;padding-left:18px;line-height:1.6";
    a.permisos.forEach(function(x){
      var li = document.createElement("li"); li.textContent = x; ul.appendChild(li);
    });
    d.appendChild(ul);
    c.appendChild(d);
  }
  if (a.aviso) c.appendChild(cartel(a.aviso, "rgba(255,210,63,"));
  if (a.estado === "rechazada" && a.motivo)
    c.appendChild(cartel("Rechazada: " + a.motivo, "rgba(224,64,42,"));

  c.appendChild(bloqueDeRevision(a));

  var bots = document.createElement("div"); bots.className = "bots";
  if (a.estado === "aprobada") bots.appendChild(botonDeBajar(a));
  var nota = a.estado === "aprobada" ? notaDeEnlace(a) : null;

  if (AM.jefe && enRevision){
    bots.appendChild(botonChico("Aprobar", function(){
      mandarTienda({ hacer:"revisar", id:a.id, decision:"aprobar" }, p);
    }));
    bots.appendChild(botonChico("Rechazar", function(){
      var m = prompt("¿Por qué la rechazás? Lo va a leer quien la propuso.");
      if (m == null) return;
      mandarTienda({ hacer:"revisar", id:a.id, decision:"rechazar", motivo:m }, p);
    }));
    if (a.huella) bots.appendChild(botonChico("Revisar la huella", function(){
      mandarTienda({ hacer:"escanear", id:a.id }, p);
    }));
  }
  if (AM.jefe && !enRevision){
    if (a.origen === "sitio") bots.appendChild(botonChico("Editar", function(){ formTienda(p, a); }));
    bots.appendChild(botonChico("Borrar", function(){
      if (!confirm("¿Sacar «" + a.nombre + "» de la tienda?")) return;
      mandarTienda({ hacer:"borrar", id:a.id }, p);
    }));
  }
  if (bots.children.length) c.appendChild(bots);
  if (nota) c.appendChild(nota);
}

function cartel(texto, colorBase){
  var e = document.createElement("p");
  e.style.cssText = "margin:10px 0 0;padding:9px 11px;border-radius:4px;font-size:13px;" +
    "line-height:1.5;background:" + colorBase + ".14);border:1px solid " + colorBase + ".4)";
  e.textContent = texto;
  return e;
}

/* LO QUE SE SABE DEL ARCHIVO, dicho sin adornos. Tres estados y ninguno se
   pinta de verde por las dudas:
   · sin huella      -> no hay nada que revisar, y se dice.
   · con huella y sin preguntar -> la huella sirve igual: cualquiera que lo baje
     puede sacarle el sha256 al suyo y comparar.
   · preguntado      -> lo que contestó, tal cual, incluido «no lo conoce».
   «No lo conoce» NO es «limpio»: es que nadie lo analizó, que es lo normal en
   una app recién hecha. Mostrar eso como un tilde verde sería mentir justo en
   la pantalla donde alguien decide instalar algo en su teléfono. */
function bloqueDeRevision(a){
  var c = document.createElement("div");
  c.style.cssText = "margin-top:10px;font-size:12.5px;line-height:1.55;" +
    "color:rgba(226,242,255,.8)";
  if (!a.huella){
    c.textContent = "Sin huella del archivo: no hay forma de revisarlo ni de " +
      "comprobar que lo que se baja sea lo mismo que se publicó.";
    return c;
  }
  var h = document.createElement("div");
  h.style.cssText = "font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;" +
    "word-break:break-all;color:rgba(226,242,255,.62)";
  h.textContent = "sha256  " + a.huella;
  c.appendChild(h);
  var e = document.createElement("div");
  e.style.marginTop = "4px";
  e.textContent = a.escaneo
    ? "Revisión: " + a.escaneo
    : "Sin revisar todavía. La huella igual te sirve: sacale el sha256 al que " +
      "bajaste y tiene que dar este mismo.";
  c.appendChild(e);
  return c;
}

function guardarRespuesta(j){
  if (j.sitio) AM.tienda = j.sitio;
  if (j.comunidad) AM.comunidad = j.comunidad;
  if (j.esperando) AM.esperando = j.esperando;
}

function mandarTienda(cuerpo, p){
  return amPedirTienda(cuerpo)
    .then(function(j){ guardarRespuesta(j); amVer("tienda"); })
    .catch(function(e){ alert(e.message); });
}

function botonDeBajar(a){
  var b = document.createElement("a");
  b.className = "am-bt";
  b.style.cssText = "display:inline-block;text-decoration:none;padding:8px 16px";
  b.textContent = "Bajar " + a.nombre;

  if (a.archivo){
    /* el pase va en la dirección porque un enlace no puede mandar cabeceras;
       del otro lado hay una función que lo comprueba antes de servir nada */
    b.href = "apps/" + a.archivo + "?pase=" + encodeURIComponent(AM.pase || "");
    b.setAttribute("download", a.archivo);
    return b;
  }

  /* Se vuelve a mirar el protocolo acá aunque el servidor ya lo haya mirado: un
     `href` es donde un `javascript:` guardado se volvería código ejecutándose en
     la pantalla del que entra. Dos puertas para lo mismo cuestan tres líneas. */
  var u = String(a.enlace || "");
  if (!/^https?:\/\//i.test(u)) { b.textContent = "Enlace roto"; b.href = "#"; }
  else { b.href = u; b.target = "_blank"; b.rel = "noopener noreferrer"; }
  return b;
}

/* Que la app se baje de afuera cambia quién puede bajarla, así que se dice en
   la tarjeta y no sólo en el formulario del que la carga: alguien que colaboró
   tiene derecho a saber si lo que baja estaba guardado para él o lo tiene
   cualquiera con el link. */
function notaDeEnlace(a){
  if (a.archivo || !a.enlace) return null;
  var n = document.createElement("p");
  n.className = "pie";
  n.style.cssText = "margin:8px 0 0";
  n.textContent = "Se baja de otro sitio, y ese enlace es público: lo abre " +
    "cualquiera que lo tenga, tenga cuenta acá o no.";
  return n;
}

function botonChico(texto, alTocar){
  var b = document.createElement("button");
  b.type = "button";
  b.style.cssText = "margin-left:8px;padding:8px 13px;border-radius:4px;cursor:pointer;" +
    "font:inherit;font-size:13px;color:#dff0ff;background:rgba(255,255,255,.12);" +
    "border:1px solid rgba(255,255,255,.28)";
  b.textContent = texto;
  b.addEventListener("click", alTocar);
  return b;
}

function amPedirTienda(cuerpo){
  var o = { headers:{} };
  var ses = caja.leer("sesion", null);
  if (ses && ses.pase) o.headers.authorization = "Bearer " + ses.pase;
  if (cuerpo){ o.method = "POST"; o.headers["content-type"] = "application/json";
               o.body = JSON.stringify(cuerpo); }
  return fetch("api/tienda", o).then(function(r){
    return r.json().then(function(j){
      if (!r.ok) throw new Error(j.error || ("error " + r.status));
      return j; });
  });
}

/* Arma los campos de un formulario y devuelve de dónde leerlos después. */
function camposDe(c, lista, a){
  var e = {};
  lista.forEach(function(f){
    var l = document.createElement("label");
    l.style.cssText = "display:block;margin-bottom:9px;font-size:13px";
    var t = document.createElement("span");
    t.style.cssText = "display:block;margin-bottom:3px;color:rgba(226,242,255,.85)";
    t.textContent = f[1];
    var x = document.createElement(f[2] === "textarea" ? "textarea" : "input");
    if (f[2] !== "textarea") x.type = f[2];
    else x.rows = 2;
    x.placeholder = f[3];
    x.value = a && a[f[0]] != null
      ? (f[0] === "permisos" && a.permisos && a.permisos.join ? a.permisos.join("\n") : a[f[0]])
      : "";
    x.style.cssText = "width:100%;box-sizing:border-box;padding:7px 9px;border-radius:4px;" +
      "border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);" +
      "color:#eaf6ff;font:inherit;font-size:13.5px";
    e[f[0]] = x;
    l.appendChild(t); l.appendChild(x);
    c.appendChild(l);
  });
  return e;
}

/* EL SELECTOR DE APK NO SUBE NADA. Lee el archivo de tu máquina y le saca el
   sha256 ahí mismo con la propia criptografía del navegador; lo único que viaja
   son 64 caracteres. Esto es lo que hace que una app publicada con un enlace a
   otro sitio se pueda revisar y verificar: sin la huella, lo único que se puede
   mirar es la página de descarga, y decir «sin virus» mirando una página sería
   inventar una seguridad que no existe. */
function selectorDeHuella(c, alTener){
  var l = document.createElement("label");
  l.style.cssText = "display:block;margin-bottom:9px;font-size:13px";
  var t = document.createElement("span");
  t.style.cssText = "display:block;margin-bottom:3px;color:rgba(226,242,255,.85)";
  t.textContent = "El APK, para sacarle la huella";
  var f = document.createElement("input");
  f.type = "file"; f.accept = ".apk,application/vnd.android.package-archive";
  f.style.cssText = "width:100%;font:inherit;font-size:13px;color:#dff0ff";
  var v = document.createElement("div");
  v.style.cssText = "margin-top:5px;font-size:11.5px;line-height:1.5;" +
    "color:rgba(226,242,255,.7);word-break:break-all";
  v.textContent = "No se sube: se lee en tu máquina y sólo viajan los 64 caracteres del sha256.";
  f.addEventListener("change", function(){
    var ar = f.files && f.files[0];
    if (!ar) return;
    v.textContent = "Calculando…";
    ar.arrayBuffer()
      .then(function(b){ return crypto.subtle.digest("SHA-256", b); })
      .then(function(d){
        var h = Array.prototype.map.call(new Uint8Array(d), function(x){
          return ("0" + x.toString(16)).slice(-2); }).join("");
        alTener(h, ar);
        v.textContent = "sha256  " + h;
      })
      .catch(function(){ v.textContent = "No se pudo leer el archivo."; });
  });
  l.appendChild(t); l.appendChild(f); l.appendChild(v);
  c.appendChild(l);
}

/* La casilla de «esta app cobra». Devuelve una función que dice cómo quedó, en
   vez del elemento: quien la usa sólo necesita saber si está tildada. Que el
   servidor la vuelva a comprobar no es desconfianza del formulario, es que
   destildar una casilla desde la consola no puede alcanzar para publicar gratis
   lo que se cobra. */
function casillaDePago(c, tildada){
  var l = document.createElement("label");
  l.style.cssText = "display:flex;gap:8px;align-items:flex-start;margin-bottom:9px;font-size:13px";
  var x = document.createElement("input");
  x.type = "checkbox"; x.checked = !!tildada;
  x.style.cssText = "margin-top:2px;flex:none";
  var t = document.createElement("span");
  t.textContent = "Esta app cobra (tiene precio o pagos adentro). Publicar una app " +
    "que cobra pide la cuota de editor al día; las gratis no piden nada.";
  l.appendChild(x); l.appendChild(t);
  c.appendChild(l);
  return function(){ return x.checked; };
}

/* El formulario del jefe. Sólo lo ve él, pero quien decide si la carga entra es
   el servidor: acá se puede poner `AM.jefe = true` desde la consola y lo único
   que pasa es que se ve un formulario que después contesta 403. */
function formTienda(p, a){
  a = a || {};
  var c = amCaja(p, a.id ? "Editar «" + a.nombre + "»" : "Cargar una app");
  c.style.marginTop = "14px";

  var nota = document.createElement("p");
  nota.style.cssText = "margin:4px 0 12px;padding:9px 11px;border-radius:4px;font-size:12.5px;" +
    "line-height:1.55;background:rgba(87,184,232,.14);border:1px solid rgba(87,184,232,.4)";
  nota.textContent = "El ENLACE es cómodo —lo cargás ahora mismo— pero es público: " +
    "cualquiera con el link se baja la app, tenga cuenta o no. El ARCHIVO en /apps/ " +
    "sí queda detrás de la puerta y pide haber colaborado, pero hay que subirlo al " +
    "sitio y desplegar. Si ponés los dos, manda el archivo.";
  c.appendChild(nota);

  var e = camposDe(c, [
    ["nombre",  "Nombre",              "text",     "Aero Launcher"],
    ["version", "Versión",             "text",     "beta 39"],
    ["para",    "Para qué es",         "text",     "Android"],
    ["peso",    "Cuánto pesa",         "text",     "2,2 MB"],
    ["que",     "De qué se trata",     "textarea", "Qué hace la app, en una o dos líneas."],
    ["enlace",  "Enlace de descarga",  "url",      "https://www.mediafire.com/file/…"],
    ["archivo", "…o archivo en /apps/","text",     "aero-launcher-39.apk"],
    ["icono",   "Ícono (dirección)",   "text",     "img/zona/app-launcher.webp"],
    ["permisos","Permisos que pide (uno por línea)", "textarea", "Cámara — para el fondo en vivo"],
    ["aviso",   "Aviso",               "textarea", "Algo que quien instala tenga que saber antes."],
    ["precio",  "Si cobra, cuánto",    "text",     "US$ 3 · o dejalo vacío si es gratis"]
  ], a);

  var paga = casillaDePago(c, a.paga);
  var huella = a.huella || "";
  selectorDeHuella(c, function(h){ huella = h; });

  var bots = document.createElement("div"); bots.className = "bots";
  var g = document.createElement("button");
  g.type = "button"; g.className = "am-bt"; g.style.padding = "8px 16px";
  g.textContent = "Guardar";
  g.addEventListener("click", function(){
    var d = { hacer:"guardar", id:a.id || 0, huella:huella, paga: paga() ? 1 : 0 };
    Object.keys(e).forEach(function(k){ d[k] = e[k].value; });
    g.disabled = true;
    amPedirTienda(d)
      .then(function(j){ guardarRespuesta(j); amVer("tienda"); })
      .catch(function(err){ g.disabled = false; alert(err.message); });
  });
  bots.appendChild(g);
  bots.appendChild(botonChico("Cancelar", function(){ amVer("tienda"); }));
  c.appendChild(bots);
  c.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block:"nearest" });
}

/* Proponer: lo puede hacer cualquiera que tenga acceso, y queda esperando
   revisión. La huella es obligatoria acá y el formulario lo dice antes, no
   después de que la persona llene ocho campos. */
function formProponer(p){
  var c = amCaja(p, "Proponer una app");
  c.style.marginTop = "14px";

  var nota = document.createElement("p");
  nota.style.cssText = "margin:4px 0 12px;padding:9px 11px;border-radius:4px;font-size:12.5px;" +
    "line-height:1.55;background:rgba(87,184,232,.14);border:1px solid rgba(87,184,232,.4)";
  nota.textContent = "Subí el APK a donde quieras (MediaFire, Drive) y pegá el enlace acá. " +
    "Hace falta además elegir el archivo abajo: el navegador le saca la huella en tu " +
    "máquina, sin subirlo. Sin esa huella no hay forma de revisar lo que compartís, " +
    "así que no se publica. No aparece en la tienda hasta que la revisen.";
  c.appendChild(nota);

  var e = camposDe(c, [
    ["nombre",  "Nombre",             "text",     "Mi app"],
    ["version", "Versión",            "text",     "1.0"],
    ["para",    "Para qué es",        "text",     "Android"],
    ["peso",    "Cuánto pesa",        "text",     "4 MB"],
    ["que",     "De qué se trata",    "textarea", "Qué hace, en una o dos líneas."],
    ["enlace",  "Enlace de descarga", "url",      "https://www.mediafire.com/file/…"],
    ["permisos","Permisos que pide (uno por línea)", "textarea", "Cámara — para sacar fotos"],
    ["aviso",   "Aviso",              "textarea", "Algo que quien instala tenga que saber antes."],
    ["precio",  "Si cobra, cuánto",   "text",     "US$ 3 · o dejalo vacío si es gratis"]
  ], null);

  var paga = casillaDePago(c);
  var huella = "";
  selectorDeHuella(c, function(h){ huella = h; });

  var bots = document.createElement("div"); bots.className = "bots";
  var g = document.createElement("button");
  g.type = "button"; g.className = "am-bt"; g.style.padding = "8px 16px";
  g.textContent = "Mandar a revisión";
  g.addEventListener("click", function(){
    var d = { hacer:"proponer", huella:huella, paga: paga() ? 1 : 0 };
    Object.keys(e).forEach(function(k){ d[k] = e[k].value; });
    g.disabled = true;
    amPedirTienda(d)
      .then(function(j){ guardarRespuesta(j); amVer("tienda"); })
      .catch(function(err){ g.disabled = false; alert(err.message); });
  });
  bots.appendChild(g);
  bots.appendChild(botonChico("Cancelar", function(){ amVer("tienda"); }));
  c.appendChild(bots);
  c.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block:"nearest" });
}

/* Se guarda solo, en cuanto se toca algo. Un botón «Guardar» en una pantalla de
   personalización es una forma de que alguien pruebe cinco fondos, cierre, y
   pierda el que le gustaba. */
var amReloj = null;
function amGuardar(){
  clearTimeout(amReloj);
  amReloj = setTimeout(function(){
    amPedir({ hacer:"guardar", marco: AM.yo.marco || "", banda: AM.yo.banda || "",
              lema: AM.yo.lema || "", tema: JSON.stringify(amTema) })
      .then(function(){ caja.poner("ajustes", { tono:amTema.tono, sat:amTema.sat,
              vidrio:amTema.vidrio, fondo:ajustes.fondo, burbujas:ajustes.burbujas }); })
      .catch(function(){});
  }, 600);
}

if ($("ic-zona")){
  amPintarIcono();
  $("ic-zona").addEventListener("click", function(){
    if (amInstalado()) amAbrir(); else amInstalar();
  });
}
if ($("am-salir")) $("am-salir").addEventListener("click", amCerrar);



/* ============================================ 6 · el escritorio en el teléfono
   En una pantalla grande el escritorio arranca con las ventanas abiertas y se
   lee como un escritorio. En un teléfono eso mismo es una tira de nueve cosas
   apiladas: no se parece a un escritorio, se parece a una página larga. Así que
   en el teléfono arranca como arranca un teléfono —fondo, grilla de íconos y un
   muelle abajo— y cada ventana se abre encima, entera, y se cierra.

   Se decide UNA vez al cargar y no se escucha el cambio de tamaño: si alguien
   gira el teléfono a mitad de camino, cerrarle de golpe lo que estaba leyendo
   sería peor que dejarlo como está. */
/* Se pregunta ADENTRO y no en una variable de arriba: una de las dos entradas
   al escritorio —la de quien ya tenía sesión guardada— corre antes de que esta
   parte del archivo se haya ejecutado, así que una variable declarada acá
   todavía valdría `undefined` y el teléfono se quedaría sin su pantalla de
   inicio. Sin error en la consola, además: simplemente no pasaba. */
/* Le dice al CSS cuánto mide la barra de arriba, para que la ventana a pantalla
   completa del teléfono empiece justo abajo y su cruz quede a la vista. Se mide
   en vez de escribirse a mano porque el alto depende del tamaño de letra del
   aparato: con la letra grande de accesibilidad, un 52 fijo vuelve a tapar la
   cruz y el error es el mismo de antes pero sólo para algunos. */
function medirBarras(){
  var r = document.documentElement.style;
  var b = $("barraSocial");
  if (b){ var h = Math.round(b.getBoundingClientRect().height);
          if (h > 0) r.setProperty("--barra-alta", h + "px"); }
  var t = document.querySelector(".tareas");
  if (t){ var h2 = Math.round(t.getBoundingClientRect().height);
          if (h2 > 0) r.setProperty("--tareas-alta", h2 + "px"); }
}
medirBarras();
addEventListener("resize", medirBarras);
addEventListener("load", medirBarras);

function arrancarCelu(){
  if (!esCelu()) return;
  $$("#escritorio .ventana").forEach(function(v){ v.hidden = true; });
  $("muelle").hidden = false;
}

/* el muelle: los cuatro de todos los días, a un toque y donde está el pulgar */
if ($("muelle")) $("muelle").addEventListener("click", function(e){
  var b = e.target.closest("[data-muelle]"); if (!b) return;
  /* lo social vive en el otro archivo: se le avisa en vez de duplicarlo acá */
  document.dispatchEvent(new CustomEvent("ir-a", { detail: b.dataset.muelle }));
});

/* ------------------------------------------ los avisos, cada uno su ventana
   Antes eran un puntito rojo en la barra: había que darse cuenta, tocarlo y
   leer una lista. Ahora cada aviso llega como una ventanita, con su barra de
   título y su cruz, y se van cerrando de a una. Cerrar es lo que lo marca
   leído: sacarlo de la pantalla y darlo por visto son el mismo gesto, así que
   no hacen falta dos. */
var avisosVistos = {};

function colorDeAviso(t){
  return t === "bueno" ? "radial-gradient(circle at 32% 26%,#e8ffd9,#7cc242 45%,#3f7a17)"
       : t === "malo"  ? "radial-gradient(circle at 32% 26%,#ffdcd4,#e0402a 45%,#9a1e0c)"
       :                 "radial-gradient(circle at 32% 26%,#dff6ff,#57b8e8 45%,#1a6ea8)";
}

function mostrarAvisito(a, cerrarlo){
  if (avisosVistos[a.id]) return;
  avisosVistos[a.id] = 1;

  var v = document.createElement("div"); v.className = "avisito";
  var t = document.createElement("div"); t.className = "titulo";
  var b = document.createElement("span"); b.className = "bola";
  b.style.background = colorDeAviso(a.tipo);
  var n = document.createElement("span");
  n.textContent = a.tipo === "bueno" ? "Buenas noticias"
                : a.tipo === "malo"  ? "Atención" : "Aviso";
  var x = document.createElement("button");
  x.type = "button"; x.className = "x"; x.setAttribute("aria-label", "Cerrar aviso");
  x.innerHTML = '<svg viewBox="0 0 11 11" aria-hidden="true"><path d="M2 2l7 7M9 2l-7 7"' +
                ' stroke="currentColor" stroke-width="1.8" fill="none"/></svg>';
  t.appendChild(b); t.appendChild(n); t.appendChild(x);

  var c = document.createElement("div"); c.className = "cuerpo3";
  c.appendChild(document.createTextNode(a.texto));
  var h = document.createElement("time"); h.textContent = cuandoCorto(a.creado);
  c.appendChild(h);

  v.appendChild(t); v.appendChild(c);
  $("avisitos").appendChild(v);

  x.addEventListener("click", function(){
    v.classList.add("yendo");
    setTimeout(function(){ v.remove(); }, quieto ? 0 : 220);
    cerrarlo(a.id);
  });
}

/* lo usa el otro archivo, que es el que sabe cuándo llegó un aviso */
window.mostrarAvisito = mostrarAvisito;

function cuandoCorto(ms){
  var d = Math.floor((Date.now() - ms) / 60000);
  if (d < 1) return "recién";
  if (d < 60) return "hace " + d + " min";
  if (d < 1440) return "hace " + Math.floor(d / 60) + " h";
  return "hace " + Math.floor(d / 1440) + " días";
}


/* ============================================ 7 · el latido
   Le avisa al servidor que esta pestaña sigue abierta, y SOLO mientras está a
   la vista. Esa es la diferencia entre saber cuánto se queda alguien y saber
   cuánto tiempo dejó la pestaña olvidada en el fondo: sin esto, una pestaña de
   ayer sumaría veinte horas de «uso» y el número no diría nada.

   El identificador es al azar y vive en `sessionStorage`, o sea que se muere
   al cerrar la pestaña. No sirve para seguir a nadie entre días, a propósito:
   lo que hace falta es contar visitas, no armar el prontuario de un
   desconocido. */
var LATE = 45000;

function idDeVisita(){
  var k = "fa.visita", v = null;
  try { v = sessionStorage.getItem(k); } catch(e){}
  if (!v){
    v = ([].map.call(crypto.getRandomValues(new Uint8Array(12)),
         function(x){ return (x + 256).toString(16).slice(1); })).join("");
    try { sessionStorage.setItem(k, v); } catch(e){}
  }
  return v;
}

(function latir(){
  var id = idDeVisita();
  var movil = matchMedia("(max-width:720px)").matches;

  function tirar(){
    if (document.hidden) return;
    var o = { method:"POST", headers:{"content-type":"application/json"},
              body: JSON.stringify({ id: id, movil: movil }) };
    /* si hay sesión, el latido la lleva: así la visita pasa a tener nombre */
    var ses = caja.leer("sesion", null);
    if (ses && ses.pase) o.headers.authorization = "Bearer " + ses.pase;
    fetch("api/visitas", o).catch(function(){});
  }

  tirar();
  setInterval(tirar, LATE);
  /* al volver a la pestaña se late enseguida, para no esperar 45 s a que
     aparezca en «quién está ahora» */
  document.addEventListener("visibilitychange", function(){
    if (!document.hidden) tirar();
  });
})();

})();
