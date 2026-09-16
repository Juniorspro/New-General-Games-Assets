/* Lo que la pagina necesita saber del servidor y cambia de instalacion en
   instalacion: el identificador de Google y los datos de cobro.
 *
 * NADA DE ESTO ESTA EN EL CODIGO a proposito. Son variables de entorno, que se
 * ponen en Cloudflare Pages -> Settings -> Variables, y asi se cambian sin
 * volver a publicar el sitio. No son secretos —un alias de Mercado Pago y un
 * usuario de PayPal viajan al navegador y son publicos por definicion, es como
 * cobran— pero si son cosas que cambian, y tenerlas escritas obliga a un
 * despliegue por cada correccion.
 *
 * Si falta alguna, la pagina lo dice en pantalla en lugar de mostrar un boton
 * que no lleva a ningun lado.
 */
export const onRequestGet = ({ env }) => {
  const pago = {};
  if (env.PAGO_MP_ALIAS) pago.mpAlias = env.PAGO_MP_ALIAS;
  if (env.PAGO_MP_LINK)  pago.mpLink  = env.PAGO_MP_LINK;
  if (env.PAGO_PAYPAL)   pago.paypal  = env.PAGO_PAYPAL;

  return new Response(JSON.stringify({
    google: env.GOOGLE_CLIENT_ID || null,
    /* Discord solo necesita saberse encendido: su identificador y su secreto
       viajan entre servidores, no por el navegador. */
    discord: !!(env.DISCORD_CLIENT_ID && env.DISCORD_SECRET),
    pago: Object.keys(pago).length ? pago : null,
    // que vias pueden cobrar y verificar solas
    auto: {
      paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET) ? env.PAYPAL_CLIENT_ID : null,
      // EN PRUEBA SE COBRA CON PLATA QUE NO EXISTE. Si esto no se avisara en
      // pantalla, se podria anunciar la tienda creyendo que entra dinero y
      // regalar accesos a cambio de nada. Es el error caro de este montaje.
      prueba: env.PAYPAL_MODO === "sandbox",
      mp: !!env.MP_TOKEN,
      minUsd: parseFloat(env.ACCESO_MINIMO_USD || "1"),
      minArs: parseInt(env.ACCESO_MINIMO_ARS || "1", 10),
    },
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
};
