/* Fabrica codigos para las transferencias en pesos.
 *
 * POR QUE ES UNA RUTA Y NO UN SCRIPT: el que administra esto no usa terminal.
 * Un script de linea de comandos seria una herramienta que nadie va a correr.
 *
 * Se pide con la clave de administrador. Se compara en tiempo constante y se
 * espera medio segundo antes de contestar mal, para que probar claves a lo
 * bruto sea lento: son dos lineas y sacan del juego a los intentos por fuerza.
 */
import { darCodigo, iguales } from "./_firma.js";

export const onRequestPost = async ({ request, env }) => {
  const json = (o, s = 200) =>
    new Response(JSON.stringify(o), {
      status: s,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });

  if (!env.SECRETO || !env.CLAVE_ADMIN) return json({ error: "sin configurar" }, 503);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  if (!iguales(String(c.clave || ""), env.CLAVE_ADMIN)) {
    await new Promise((r) => setTimeout(r, 500));
    return json({ error: "clave incorrecta" }, 403);
  }

  const cuantos = Math.min(Math.max(parseInt(c.cuantos, 10) || 1, 1), 50);
  const desde = Math.max(parseInt(c.desde, 10) || 1, 1);
  const codigos = [];
  for (let i = 0; i < cuantos; i++) codigos.push(await darCodigo(env.SECRETO, desde + i));
  return json({ codigos, siguiente: desde + cuantos });
};
