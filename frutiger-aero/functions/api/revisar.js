/* La cola de pedidos, para el que administra.
 *
 * EL ADMINISTRADOR ES UNA CUENTA, NO UNA CONTRASENIA COMPARTIDA. Escribir la
 * misma clave en cada pantalla es una llave suelta: no se sabe quien entro, no
 * se le puede sacar el acceso a uno solo, y si se filtra hay que cambiarla para
 * todos. Ahora se entra con el mismo usuario y contrasenia que cualquiera, y la
 * cuenta lleva una marca.
 *
 * COMO SE NOMBRA AL PRIMERO: con la clave vieja, una sola vez. Quien la sepa y
 * este con su sesion abierta se convierte en jefe. Despues no se usa mas.
 *
 * APROBAR HACE TRES COSAS: marca el pedido, habilita la cuenta, y AVISA. Sin lo
 * tercero la persona pago y tiene que adivinar cuando mirar.
 */
import { quienEs, iguales, json } from "./_social.js";
import { avisar } from "./_avisar.js";

async function jefe(env, request) {
  const yo = await quienEs(env, request);
  if (!yo) return null;
  const u = await env.DB.prepare("SELECT id, usuario, jefe FROM usuarios WHERE id = ?")
    .bind(yo.u).first();
  return u && u.jefe ? u : null;
}

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin configurar" }, 503);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  /* ------------------------------------------------- nombrar al primero */
  if (c.hacer === "nombrarme") {
    const yo = await quienEs(env, request);
    if (!yo) return json({ error: "Entrá con tu cuenta primero." }, 401);
    if (!env.CLAVE_ADMIN || !iguales(String(c.clave || ""), env.CLAVE_ADMIN)) {
      await new Promise((r) => setTimeout(r, 500));
      return json({ error: "clave incorrecta" }, 403);
    }
    await env.DB.prepare("UPDATE usuarios SET jefe = 1 WHERE id = ?").bind(yo.u).run();
    return json({ ok: true });
  }

  const j = await jefe(env, request);
  if (!j) return json({ error: "No sos administrador." }, 403);

  /* --------------------------------------------------------- ver la cola
     Llega UNA fila por persona, no una por comprobante: quien mando cincuenta
     dos veces es un solo pedido de cien con dos comprobantes, y hay que
     mirarlos juntos para decidir. Los que todavia estan juntando NO aparecen:
     hacer revisar algo que no llega al piso es hacer trabajar al pedo. */
  if (c.hacer === "ver") {
    const { results } = await env.DB.prepare(
      "SELECT a.id, a.moneda, a.monto, a.refer, a.titular, a.nota, a.creado, a.foto_tipo, " +
      "       u.id AS uid, u.usuario, u.nombre " +
      "FROM aportes a JOIN usuarios u ON u.id = a.usuario " +
      "WHERE a.estado = 'espera' ORDER BY u.id, a.creado ASC LIMIT 200").all();

    const porGente = [];
    const indice = {};
    for (const a of results) {
      if (!indice[a.uid]) {
        indice[a.uid] = { uid: a.uid, usuario: a.usuario, nombre: a.nombre,
                          titular: a.titular || "", moneda: a.moneda, total: 0,
                          desde: a.creado, aportes: [] };
        porGente.push(indice[a.uid]);
      }
      const g = indice[a.uid];
      g.total += a.monto;
      g.desde = Math.min(g.desde, a.creado);
      if (a.titular && a.titular !== g.titular && g.titular)
        g.varios = true;      /* mando con dos nombres distintos: hay que mirar */
      g.aportes.push({ id: a.id, monto: a.monto, refer: a.refer, titular: a.titular,
                       nota: a.nota, creado: a.creado, foto: !!a.foto_tipo });
    }

    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE acceso = 1").first();
    const jun = await env.DB.prepare(
      "SELECT COUNT(DISTINCT usuario) AS n FROM aportes WHERE estado = 'juntando'").first();
    return json({ pedidos: porGente, conAcceso: n.n, juntando: jun.n, yo: j.usuario });
  }

  /* ------------------------------------------------------------ resolver */
  /* Se resuelve la persona entera, no un comprobante suelto: lo que se aprueba
     es «este junto los cien», y eso son todos sus aportes a la vez. */
  if (c.hacer === "aprobar" || c.hacer === "rechazar") {
    const uid = parseInt(c.uid, 10);
    if (!uid) return json({ error: "pedido inválido" }, 400);
    const hay = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM aportes WHERE usuario = ? AND estado = 'espera'")
      .bind(uid).first();
    if (!hay.n) return json({ error: "Ese pedido ya no está esperando." }, 404);

    const aprueba = c.hacer === "aprobar";
    /* las fotos se borran al resolver: la base no es un album de comprobantes
       ajenos, y ya cumplieron su unica funcion */
    await env.DB.prepare(
      "UPDATE aportes SET estado = ?, visto = ?, quien_vio = ?, foto = NULL, foto_tipo = '' " +
      "WHERE usuario = ? AND estado = 'espera'")
      .bind(aprueba ? "aprobado" : "rechazado", Date.now(), j.id, uid).run();

    if (aprueba) {
      await env.DB.prepare("UPDATE usuarios SET acceso = 1 WHERE id = ?").bind(uid).run();
      await avisar(env, uid,
        "¡Listo! Confirmamos tu aporte y la zona de donantes ya te quedó abierta.", "bueno");
    } else {
      await avisar(env, uid,
        "No pudimos encontrar tu transferencia. Si creés que hay un error, " +
        "volvé a mandar el comprobante con el número completo.", "malo");
    }
    return json({ ok: true });
  }

  /* --------------------------------------- moderar: ocultar o suspender */
  if (c.hacer === "ocultar") {
    await env.DB.prepare("UPDATE publicaciones SET oculto = 1 WHERE id = ?")
      .bind(parseInt(c.id, 10)).run();
    return json({ ok: true });
  }
  if (c.hacer === "suspender") {
    await env.DB.prepare("UPDATE usuarios SET bloqueado = 1 WHERE usuario = ? AND jefe = 0")
      .bind(String(c.usuario || "").toLowerCase()).run();
    return json({ ok: true });
  }

  return json({ error: "no sé qué hacer" }, 400);
};

/* el comprobante, solo para el administrador */
export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return new Response("no", { status: 503 });
  const j = await jefe(env, request);
  if (!j) return new Response("no", { status: 403 });
  const id = parseInt(new URL(request.url).searchParams.get("foto") || "0", 10);
  const r = await env.DB.prepare("SELECT foto, foto_tipo FROM aportes WHERE id = ?")
    .bind(id).first();
  if (!r || !r.foto) return new Response("no hay", { status: 404 });
  return new Response(r.foto, {
    headers: { "content-type": r.foto_tipo || "image/jpeg", "cache-control": "no-store" },
  });
};
