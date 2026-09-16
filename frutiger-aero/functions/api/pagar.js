/* Arranca un pago y devuelve lo que el navegador necesita para seguirlo.
 *
 * EL MONTO SE FIJA ACA, no en el navegador. Si la orden se armara del lado del
 * cliente, cualquiera cambia el numero antes de mandarlo y paga un peso por lo
 * que sale diez. Al crearla el servidor, el precio que se cobra es el que este
 * archivo escribio, y despues `acceso.js` vuelve a comprobar contra el minimo.
 *
 * Las dos vias terminan igual: el que paga vuelve con un identificador, y ese
 * identificador se verifica CONTRA EL SERVIDOR DE LA PASARELA antes de dar
 * nada. Nunca se le cree al navegador.
 */
import { quienEs } from "./_social.js";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const API_PP = (env) => env.PAYPAL_MODO === "sandbox"
  ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

export async function fichaPaypal(env) {
  const r = await fetch(API_PP(env) + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  return r.ok ? (await r.json()).access_token : null;
}

export const onRequestPost = async ({ request, env }) => {
  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  /* De quien es este pago. Va pegado a la orden en la pasarela, asi que cuando
     el aviso vuelve —incluso si la persona cerro la pestania— se sabe a quien
     darle el acceso. Sin esto, un pago sin vuelta al sitio es plata cobrada y
     nada entregado. */
  const yo = await quienEs(env, request);
  const dueno = yo ? String(yo.u) : "";

  const monto = Math.floor(Number(c.monto));
  if (!(monto > 0) || monto > 5000000) return json({ error: "monto inválido" }, 400);

  const raiz = new URL(request.url).origin;

  /* ------------------------------------------------------------- PayPal */
  if (c.via === "paypal") {
    const min = parseFloat(env.ACCESO_MINIMO_USD || "1");
    if (monto < min) return json({ error: "El mínimo es US$ " + min }, 400);
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET)
      return json({ error: "PayPal no está configurado" }, 503);

    const ficha = await fichaPaypal(env);
    if (!ficha) return json({ error: "no pude hablar con PayPal" }, 502);

    const r = await fetch(API_PP(env) + "/v2/checkout/orders", {
      method: "POST",
      headers: { authorization: "Bearer " + ficha, "content-type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: monto.toFixed(2) },
          /* Que el recibo diga QUE se pagó. Con una sola descripción para
             todo, el resumen de PayPal de quien paga la cuota de editor le
             dice «acceso anticipado», que no es lo que compró; y si algún día
             pide una devolución, nadie sabe de cuál de las dos cosas habla. */
          description: c.concepto === "editor"
            ? "Frutiger Aero - cuota mensual para publicar apps"
            : "Frutiger Aero - acceso anticipado",
          ...(dueno ? { custom_id: dueno } : {}),
        }],
        application_context: {
          shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW",
          brand_name: "Frutiger Aero",
        },
      }),
    });
    if (!r.ok) return json({ error: "PayPal rechazó la orden" }, 502);
    return json({ orden: (await r.json()).id });
  }

  /* ------------------------------------------------------ Mercado Pago */
  if (c.via === "mp") {
    const min = parseInt(env.ACCESO_MINIMO_ARS || "1", 10);
    if (monto < min) return json({ error: "El mínimo es $ " + min }, 400);
    if (!env.MP_TOKEN) return json({ error: "Mercado Pago no está configurado" }, 503);

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { authorization: "Bearer " + env.MP_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ title: "Frutiger Aero - acceso anticipado", quantity: 1,
                  unit_price: monto, currency_id: "ARS" }],
        /* el que paga vuelve solo, sin tener que apretar «volver al sitio» */
        back_urls: { success: raiz + "/?pago=mp", pending: raiz + "/?pago=mp",
                     failure: raiz + "/?pago=no" },
        auto_return: "approved",
        statement_descriptor: "FRUTIGERAERO",
        ...(dueno ? { external_reference: dueno } : {}),
        notification_url: raiz + "/api/mp-aviso",
      }),
    });
    if (!r.ok) return json({ error: "Mercado Pago rechazó la preferencia" }, 502);
    const p = await r.json();
    return json({ ir: p.init_point || p.sandbox_init_point });
  }

  return json({ error: "vía desconocida" }, 400);
};
