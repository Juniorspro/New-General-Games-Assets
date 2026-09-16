/* Los aportes: se juntan hasta llegar al minimo, y recien ahi piden turno.
 *
 * LA REGLA QUE MANDA: el acceso anticipado arranca en un piso. Quien manda la
 * mitad NO entra en la cola —seria hacer trabajar al que revisa por algo que
 * todavia no alcanza— pero TAMPOCO se le pierde lo que mando. Su aporte queda
 * juntando, y el dia que completa, todo lo suyo pasa a la cola de una vez y con
 * todos los comprobantes juntos.
 *
 * Se acumula POR MONEDA y no se convierte nada. Poner una cotizacion aca seria
 * inventar un numero que cambia todos los dias y del que este servidor no sabe
 * nada; cada moneda llega a su propio piso.
 *
 * Y lo que se junta es lo DECLARADO, que no es lo verificado: por eso al final
 * hay una persona mirando los comprobantes. Esto ordena la cola, no reemplaza
 * la revision.
 */
import { quienEs, limpio, json } from "./_social.js";

const PISOS = (env) => ({
  ARS: parseFloat(env.ACCESO_MINIMO_ARS || "100"),
  USD: parseFloat(env.ACCESO_MINIMO_USD || "0.10"),
});

/* «$ 2.500,50» -> 2500.5 . Se acepta como lo escribe la gente, con puntos de
   miles y coma decimal, porque pedir «numero sin puntos» es pedir que se
   equivoquen. */
function aNumero(t) {
  const s = String(t == null ? "" : t).replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const coma = s.lastIndexOf(","), punto = s.lastIndexOf(".");
  let limpio2;
  if (coma > punto) limpio2 = s.replace(/\./g, "").replace(",", ".");
  else if (punto > coma) limpio2 = s.replace(/,/g, "");
  else limpio2 = s.replace(/[.,]/g, "");
  const n = parseFloat(limpio2);
  return isFinite(n) ? n : NaN;
}

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "Entrá con tu cuenta para pedir el acceso." }, 401);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  const u = await env.DB.prepare("SELECT acceso FROM usuarios WHERE id = ?").bind(yo.u).first();
  if (u && u.acceso) return json({ ya: true });

  const refer = limpio(c.refer, 80);
  if (refer.length < 4)
    return json({ error: "Poné el número de operación del comprobante." }, 400);

  /* EL NOMBRE DEL QUE TRANSFIRIO, y no el del perfil: son dos cosas distintas
     y confundirlas es no poder cruzar nada. En el resumen del banco figura el
     titular de la cuenta que mando la plata, que puede llamarse cualquier cosa
     y no tiene por que parecerse al «@pepe123» del sitio. Sin esto, un pedido
     de cien pesos entre veinte transferencias de cien pesos es imposible de
     identificar. */
  const titular = limpio(c.titular, 70);
  if (titular.length < 5 || titular.indexOf(" ") < 1)
    return json({ error: "Poné tu nombre y apellido, igual que en la transferencia." }, 400);

  const moneda = c.moneda === "USD" ? "USD" : "ARS";
  const monto = aNumero(c.monto);
  if (!(monto > 0))
    return json({ error: "Poné cuánto mandaste, en números." }, 400);

  /* el mismo comprobante no se cuenta dos veces */
  const repe = await env.DB.prepare(
    "SELECT id FROM aportes WHERE usuario = ? AND refer = ? AND estado IN ('juntando','espera')")
    .bind(yo.u, refer).first();
  if (repe) return json({ error: "Ese comprobante ya lo mandaste." }, 409);

  const enEspera = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM aportes WHERE usuario = ? AND estado = 'espera'")
    .bind(yo.u).first();
  if (enEspera.n) return json({ error: "Ya tenés un pedido esperando revisión." }, 409);

  /* la imagen: achicada en el navegador, revisada de nuevo aca porque lo que
     valida el cliente no vale, el pedido se puede armar a mano */
  let foto = null, tipo = "";
  if (typeof c.foto === "string" && c.foto.startsWith("data:image/")) {
    const cab = c.foto.slice(5, c.foto.indexOf(";"));
    if (["image/jpeg", "image/png", "image/webp"].includes(cab)) {
      const crudo = atob(c.foto.slice(c.foto.indexOf(",") + 1));
      if (crudo.length <= 400 * 1024) {
        foto = new Uint8Array(crudo.length);
        for (let i = 0; i < crudo.length; i++) foto[i] = crudo.charCodeAt(i);
        tipo = cab;
      }
    }
  }

  await env.DB.prepare(
    "INSERT INTO aportes (usuario, moneda, monto, refer, titular, nota, foto, foto_tipo, creado) " +
    "VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(yo.u, moneda, monto, refer, titular, limpio(c.nota, 200), foto, tipo, Date.now()).run();

  /* ¿llegó al piso de SU moneda? */
  const piso = PISOS(env)[moneda];
  const suma = await env.DB.prepare(
    "SELECT COALESCE(SUM(monto),0) AS t FROM aportes " +
    "WHERE usuario = ? AND moneda = ? AND estado = 'juntando'")
    .bind(yo.u, moneda).first();

  if (suma.t >= piso) {
    await env.DB.prepare(
      "UPDATE aportes SET estado = 'espera' WHERE usuario = ? AND moneda = ? AND estado = 'juntando'")
      .bind(yo.u, moneda).run();
    return json({ enCola: true, juntado: suma.t, piso, moneda });
  }
  return json({ juntando: true, juntado: suma.t, falta: piso - suma.t, piso, moneda });
};

/* como voy */
export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "sin sesión" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT moneda, estado, COALESCE(SUM(monto),0) AS t, COUNT(*) AS n, MAX(creado) AS ult " +
    "FROM aportes WHERE usuario = ? AND estado IN ('juntando','espera') " +
    "GROUP BY moneda, estado").bind(yo.u).all();
  /* el titular de la vez pasada, para no hacerlo escribir el nombre de nuevo
     en cada aporte */
  const ult = await env.DB.prepare(
    "SELECT titular FROM aportes WHERE usuario = ? AND titular <> '' " +
    "ORDER BY creado DESC LIMIT 1").bind(yo.u).first();
  return json({ tramos: results, pisos: PISOS(env), titular: (ult && ult.titular) || "" });
};
