/* La cuota de quien publica apps pagas.
 *
 * EL MODELO, y por qué es este. El que quiere vender su app en esta tienda le
 * paga una cuota mensual al dueño del sitio. La plata de las VENTAS no pasa por
 * acá: va del que compra al que hizo la app, por afuera. El sitio cobra por
 * publicar, no intermedia plata ajena —manejar la plata de otro es otra cosa
 * completamente distinta: hay que devolver, hay que responder por lo que no
 * llega, y las pasarelas lo tratan como pagos a terceros, con todo lo que eso
 * arrastra—.
 *
 * NO SE LE CREE AL NAVEGADOR. Llega un número de orden, que solo no prueba
 * nada: cualquiera inventa uno. El servidor CAPTURA la orden con sus propias
 * credenciales —capturar es el paso que mueve la plata— y después comprueba que
 * quede COMPLETED, que el dinero haya ido a NUESTRA cuenta (sin eso alguien pega
 * la orden de un pago suyo a otro lado y entra) y que llegue al monto.
 *
 * Y LO MÁS IMPORTANTE DE TODO EL ARCHIVO: extender una suscripción NO es
 * idempotente. Si alguien recarga la página después de pagar, PayPal contesta
 * con la misma orden ya capturada y un código ingenuo sumaría otros treinta
 * días. Treinta días por cada F5. Por eso la cuota se anota en una tabla con
 * `ref` ÚNICA, y los días se suman SOLO si esa inserción agregó una fila de
 * verdad. Es la diferencia entre cobrar una vez y regalar el mes.
 */
import { quienEs, limpio, json } from "./_social.js";
import { API_PP, fichaPaypal } from "./pagar.js";

const DIAS = 30;
const cuotaUSD = (env) => parseFloat(env.CUOTA_EDITOR_USD || "10");

export async function esEditor(env, id) {
  const u = await env.DB.prepare(
    "SELECT editor_hasta, jefe FROM usuarios WHERE id = ?").bind(id).first();
  if (!u) return false;
  /* el jefe publica sin pagarse una cuota a sí mismo */
  return !!u.jefe || (u.editor_hasta || 0) > Date.now();
}

async function ficha(env, id) {
  const u = await env.DB.prepare(
    "SELECT editor_hasta, jefe FROM usuarios WHERE id = ?").bind(id).first();
  const hasta = (u && u.editor_hasta) || 0;
  return {
    hasta,
    activo: !!(u && u.jefe) || hasta > Date.now(),
    porSerJefe: !!(u && u.jefe),
    mensual: cuotaUSD(env),
    dias: DIAS,
  };
}

export const onRequestGet = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "Entrá con tu cuenta." }, 403);
  return json(await ficha(env, yo.u));
};

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "Entrá con tu cuenta." }, 403);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  /* --- a mano, para las transferencias en pesos que no avisan a nadie --- */
  if (c.hacer === "dar") {
    const jefe = await env.DB.prepare("SELECT jefe FROM usuarios WHERE id = ?")
      .bind(yo.u).first();
    if (!jefe || !jefe.jefe) return json({ error: "Eso lo hace el dueño del sitio." }, 403);
    /* se acepta el número de cuenta o el nombre de usuario: el jefe tiene el
       @ de la persona que le transfirió, no su número interno */
    const quien = await buscarCuenta(env, c.usuario);
    const meses = Math.min(12, Math.max(1, parseInt(c.meses, 10) || 1));
    if (!quien) return json({ error: "No encontré esa cuenta." }, 404);
    /* La referencia es el número del comprobante de la transferencia, y conviene
       ponerla: con el mismo comprobante, cargar dos veces no suma dos meses.
       Sin ella se genera una distinta cada vez, así que dos clicks sí serían
       dos meses —que a veces es lo que se quiere, pero conviene saberlo—. */
    const ref = limpio(c.ref, 80) || ("mano-" + quien + "-" + Date.now());
    const r = await sumarDias(env, quien, DIAS * meses, "mano", ref, 0, "ARS");
    const q = await env.DB.prepare("SELECT usuario FROM usuarios WHERE id = ?")
      .bind(quien).first();
    /* se devuelve a QUIÉN se le dio: sin esto, escribir mal un nombre de usuario
       le da el mes a otra persona y nadie se entera hasta que uno reclama */
    return json({ ...r, aQuien: q ? q.usuario : String(quien) });
  }

  /* ------------------------------------------------------------ PayPal */
  if (typeof c.orden !== "string" || !/^[A-Z0-9]{6,32}$/i.test(c.orden))
    return json({ error: "orden inválida" }, 400);
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET)
    return json({ error: "PayPal todavía no está configurado" }, 503);

  const fp = await fichaPaypal(env);
  if (!fp) return json({ error: "no pude hablar con PayPal" }, 502);
  const cab = { authorization: "Bearer " + fp, "content-type": "application/json" };

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
  const minimo = cuotaUSD(env);
  if (!(monto >= minimo))
    return json({ error: "La cuota para publicar es de US$ " + minimo + " por mes." }, 402);

  return json(await sumarDias(env, yo.u, DIAS, "paypal", c.orden, monto, "USD"));
};

async function buscarCuenta(env, texto) {
  const t = String(texto == null ? "" : texto).trim().replace(/^@/, "");
  if (!t) return 0;
  if (/^\d+$/.test(t)) {
    const u = await env.DB.prepare("SELECT id FROM usuarios WHERE id = ?")
      .bind(parseInt(t, 10)).first();
    return u ? u.id : 0;
  }
  const u = await env.DB.prepare("SELECT id FROM usuarios WHERE usuario = ?")
    .bind(t.toLowerCase()).first();
  return u ? u.id : 0;
}

/* Suma los días UNA sola vez por referencia. Ver el comentario de arriba: sin
   esto, recargar la página después de pagar regala un mes por cada recarga. */
async function sumarDias(env, quien, dias, medio, ref, monto, moneda) {
  const ahora = Date.now();
  const actual = await env.DB.prepare("SELECT editor_hasta FROM usuarios WHERE id = ?")
    .bind(quien).first();

  /* si todavía le queda tiempo, el mes nuevo se le SUMA al que tiene; si ya
     venció, arranca hoy. Pisar la fecha con «hoy + 30» le comería los días que
     le quedaban por pagar antes de tiempo. */
  const desde = Math.max(ahora, (actual && actual.editor_hasta) || 0);
  const hasta = desde + dias * 86400000;

  const ins = await env.DB.prepare(
    "INSERT OR IGNORE INTO cuotas (usuario, medio, ref, monto, moneda, desde, hasta, creado) " +
    "VALUES (?,?,?,?,?,?,?,?)")
    .bind(quien, medio, String(ref), monto, moneda, desde, hasta, ahora).run();

  if (ins.meta.changes > 0) {
    await env.DB.prepare("UPDATE usuarios SET editor_hasta = ? WHERE id = ?")
      .bind(hasta, quien).run();
  }

  return { ...(await ficha(env, quien)), yaEstaba: ins.meta.changes === 0 };
}
