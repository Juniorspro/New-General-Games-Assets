/* Da el pase. Tres caminos, y NINGUNO le cree al navegador.
 *
 * 1 · PAYPAL. Llega el numero de orden. Eso solo no prueba nada: cualquiera
 *     inventa uno. El servidor CAPTURA la orden con sus propias credenciales
 *     —capturar es el paso que mueve la plata de verdad— y despues comprueba
 *     tres cosas: que quede COMPLETED, que el dinero haya ido a NUESTRA cuenta
 *     (sin eso alguien pega la orden de un pago suyo a otra persona y entra) y
 *     que llegue al minimo.
 *
 * 2 · MERCADO PAGO. Vuelve con un identificador de pago en la direccion. Se le
 *     pregunta a Mercado Pago por ese pago: que este `approved`, en pesos, y
 *     por el monto minimo.
 *
 * 3 · CODIGO. Para transferencias sueltas, que no avisan a nadie. Va firmado.
 *
 * SI SE PIDE DOS VECES LA MISMA ORDEN no pasa nada malo: capturar algo ya
 * capturado devuelve un error que se reconoce, y ahi se lee el estado y se da
 * el pase igual. Es el caso normal de alguien que recarga la pagina.
 */
import { darPase, codigoVale } from "./_firma.js";
import { quienEs } from "./_social.js";
import { API_PP, fichaPaypal } from "./pagar.js";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/* Anota el pago y, si habia sesion, le deja el acceso pegado a la CUENTA y no
   solo a este navegador. Asi entrar desde el telefono despues de haber pagado
   en la compu no obliga a pagar de nuevo. */
async function anotar(env, request, medio, ref, monto, moneda) {
  if (!env.DB) return;
  const yo = await quienEs(env, request);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO pagos (medio, ref, usuario, monto, moneda, estado, creado) " +
    "VALUES (?,?,?,?,?,'approved',?)")
    .bind(medio, String(ref), yo ? yo.u : null, monto, moneda, Date.now()).run();
  if (yo) await env.DB.prepare("UPDATE usuarios SET acceso = 1 WHERE id = ?").bind(yo.u).run();
}

export const onRequestPost = async ({ request, env }) => {
  if (!env.SECRETO) return json({ error: "falta SECRETO" }, 503);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  /* ---------------------------------------------------------- por codigo */
  if (c.codigo) {
    if (!(await codigoVale(env.SECRETO, c.codigo)))
      return json({ error: "Ese código no es válido. Fijate que esté completo." }, 403);

    /* EL CODIGO TIENE QUE VALER LO MISMO QUE UN PAGO, y no valia. Devolvia solo
       un pase de navegador y nunca marcaba la cuenta, asi que el que entraba
       con un codigo quedaba con medio acceso: sin Aero+, sin insignia, y lo
       perdia al cambiar de telefono o al borrar el navegador. Nadie se enteraba
       hasta que abria el celular y no le aparecia nada. */
    await anotar(env, request, "codigo", c.codigo.trim().toUpperCase(), 0, "ARS");
    return json({ pase: await darPase(env.SECRETO, { via: "codigo" }) });
  }

  /* ---------------------------------------------------------- por PayPal */
  if (c.orden) {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET)
      return json({ error: "PayPal todavía no está configurado" }, 503);
    if (typeof c.orden !== "string" || !/^[A-Z0-9]{6,32}$/i.test(c.orden))
      return json({ error: "orden inválida" }, 400);

    const ficha = await fichaPaypal(env);
    if (!ficha) return json({ error: "no pude hablar con PayPal" }, 502);
    const cab = { authorization: "Bearer " + ficha, "content-type": "application/json" };

    let o = null;
    const cap = await fetch(API_PP(env) + "/v2/checkout/orders/" + c.orden + "/capture",
                            { method: "POST", headers: cab });
    if (cap.ok) {
      o = await cap.json();
    } else {
      /* ya estaba capturada (recargó la página) u otro problema: se mira */
      const r = await fetch(API_PP(env) + "/v2/checkout/orders/" + c.orden, { headers: cab });
      if (!r.ok) return json({ error: "PayPal no reconoce esa orden" }, 403);
      o = await r.json();
    }

    if (o.status !== "COMPLETED")
      return json({ error: "El pago figura como " + o.status + ", no como completado." }, 402);

    const u = (o.purchase_units || [])[0] || {};
    const pago = ((u.payments || {}).captures || [])[0] || {};

    const nuestro = env.PAYPAL_MERCHANT_ID;
    const destino = (pago.payee || u.payee || {}).merchant_id;
    if (nuestro && destino && destino !== nuestro)
      return json({ error: "Ese pago no fue a esta cuenta." }, 403);

    const monto = parseFloat((pago.amount || u.amount || {}).value || "0");
    const minimo = parseFloat(env.ACCESO_MINIMO_USD || "1");
    if (!(monto >= minimo))
      return json({ error: "El acceso anticipado arranca en US$ " + minimo + "." }, 402);

    await anotar(env, request, "paypal", c.orden, monto, "USD");
    return json({ pase: await darPase(env.SECRETO, { via: "paypal", ord: c.orden.slice(-8) }), monto });
  }

  /* --------------------------------------------------- por Mercado Pago */
  if (c.mpPago) {
    if (!env.MP_TOKEN) return json({ error: "Mercado Pago todavía no está configurado" }, 503);
    if (!/^\d{6,24}$/.test(String(c.mpPago))) return json({ error: "pago inválido" }, 400);

    const r = await fetch("https://api.mercadopago.com/v1/payments/" + c.mpPago, {
      headers: { authorization: "Bearer " + env.MP_TOKEN },
    });
    if (!r.ok) return json({ error: "Mercado Pago no reconoce ese pago" }, 403);
    const p = await r.json();

    if (p.status !== "approved")
      return json({ error: "El pago figura como " + p.status + "." }, 402);
    if (p.currency_id !== "ARS")
      return json({ error: "moneda inesperada" }, 402);

    const monto = Number(p.transaction_amount || 0);
    const minimo = parseInt(env.ACCESO_MINIMO_ARS || "1", 10);
    if (!(monto >= minimo))
      return json({ error: "El acceso anticipado arranca en $ " + minimo + "." }, 402);

    await anotar(env, request, "mp", c.mpPago, monto, "ARS");
    return json({
      pase: await darPase(env.SECRETO, { via: "mp", pag: String(c.mpPago).slice(-8) }),
      monto,
    });
  }

  return json({ error: "falta el código, la orden o el pago" }, 400);
};
