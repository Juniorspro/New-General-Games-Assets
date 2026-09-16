/* El latido: le avisa a la web que esta pestaña sigue abierta.
 *
 * SOLO LATE CON LA PESTAÑA A LA VISTA. Esa es la diferencia entre saber cuánto
 * se queda alguien y saber cuánto dejó la pestaña olvidada en el fondo: sin
 * esto, una pestaña de ayer sumaría veinte horas de «visita».
 *
 * El identificador es al azar y vive en `sessionStorage`, así que se muere al
 * cerrar la pestaña. No sirve para reconocer a nadie mañana, a propósito: lo
 * que hace falta es contar visitas, no seguir gente.
 */
(function(){
  "use strict";
  var CADA = 45000;

  var id = null;
  try { id = sessionStorage.getItem("iblo.visita"); } catch(e){}
  if (!id){
    try {
      id = [].map.call(crypto.getRandomValues(new Uint8Array(12)), function(x){
        return (x + 256).toString(16).slice(1); }).join("");
      sessionStorage.setItem("iblo.visita", id);
    } catch(e){ return; }        /* sin dónde guardar el número, no se cuenta */
  }

  /* la página, en corto: «/» o «iblo-publicaciones». Sirve para saber qué
     miran, no para reconstruir por dónde anduvo nadie. */
  var pagina = location.pathname.replace(/^\/|\.html$/g, "").replace(/^m\//, "m:") || "portada";
  var movil = matchMedia("(max-width:760px)").matches;
  /* el referente se manda entero y el servidor se queda sólo con el dominio */
  var vino = document.referrer || "";

  function latir(){
    if (document.hidden) return;
    fetch("/api/visitas", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: id, pagina: pagina, movil: movil, vino: vino }),
      keepalive: true
    }).catch(function(){});
  }

  latir();
  setInterval(latir, CADA);
  document.addEventListener("visibilitychange", function(){ if (!document.hidden) latir(); });
})();
