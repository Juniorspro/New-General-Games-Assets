/* El aviso de Mercado Pago (webhook).
 *
 * POR QUE HACE FALTA, Y ES UN AGUJERO DE VERDAD: hasta ahora el acceso se daba
 * cuando el que pagaba VOLVIA al sitio con el identificador en la direccion. Si
 * cerraba la pestania, se le cortaba el 4G o Mercado Pago tardaba en
 * devolverlo, pagaba y no recibia nada. Peor: del lado de aca no quedaba
 * rastro de que habia pagado, asi que ni reclamando se podia comprobar.
 *
 * Con esto Mercado Pago avisa por su cuenta, apenas se acredita, sin depender
 * de que el navegador de la persona siga vivo.
 *
 * NO SE LE CREE AL AVISO. El aviso solo trae un numero de pago; podria mandarlo
 * cualquiera. Lo unico que se hace con el es ir a preguntarle a Mercado Pago
 * por ese pago con nuestro token. La verdad sale de la consulta, nunca del
 * cuerpo del pedido.
 */
import { json } from "./_social.js";

export const onRequestPost = async ({ request, env }) => {
  /* a un webhook se le contesta 200 aunque no se pueda procesar: si contesta
     error, Mercado Pago lo reintenta durante horas y llena todo de ruido */
  const ok = () => new Response("ok", { status: 200 });

  if (!env.MP_TOKEN || !env.DB) return ok();

  let id = null;
  try {
    const c = await request.json();
    id = (c.data && c.data.id) || c["data.id"] || null;
    if (c.type && c.type !== "payment" && c.action !== "payment.updated" &&
        c.action !== "payment.created") return ok();
  } catch { /* algunos avisos vienen por la direccion, no por el cuerpo */ }
  if (!id) id = new URL(request.url).searchParams.get("data.id");
  if (!id || !/^\d{6,24}$/.test(String(id))) return ok();

  const r = await fetch("https://api.mercadopago.com/v1/payments/" + id, {
    headers: { authorization: "Bearer " + env.MP_TOKEN },
  });
  if (!r.ok) return ok();
  const p = await r.json();
  if (p.status !== "approved") return ok();

  /* external_reference es el id de quien estaba con la sesion abierta cuando
     arranco el pago. Puede no haber ninguno: se anota el pago igual */
  const usuario = parseInt(p.external_reference, 10) || null;

  await env.DB.prepare(
    "INSERT OR IGNORE INTO pagos (medio, ref, usuario, monto, moneda, estado, creado) " +
    "VALUES ('mp', ?, ?, ?, ?, ?, ?)")
    .bind(String(id), usuario, Number(p.transaction_amount || 0),
          p.currency_id || "ARS", p.status, Date.now()).run();

  const minimo = parseInt(env.ACCESO_MINIMO_ARS || "1", 10);
  if (usuario && Number(p.transaction_amount || 0) >= minimo)
    await env.DB.prepare("UPDATE usuarios SET acceso = 1 WHERE id = ?").bind(usuario).run();

  return ok();
};

/* Mercado Pago comprueba la direccion con un GET antes de usarla */
export const onRequestGet = () => new Response("ok", { status: 200 });
