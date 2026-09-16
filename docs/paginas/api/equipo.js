import { json, preflight, exigirSesion } from "./_comun.js";
export const onRequestOptions = preflight;

/* El equipo de la página de Servicios: DJs, animación, staff y RRPP.
   Antes estaba escrito a mano dentro del HTML, así que sumar a alguien era
   tocar dos archivos y publicar de nuevo. Ahora vive en la base y se edita
   desde la app.

   Del Instagram se guarda SÓLO el usuario, sin arroba y sin dirección: el dueño
   escribe «@fulano» y la página arma el link. Guardar la dirección entera
   invita a pegar cualquier cosa —un link a un posteo, uno con parámetros de
   seguimiento— y después la tarjeta lleva a otro lado. */
const t = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

export function limpiarIg(v) {
  let s = t(v, 120).replace(/\s+/g, "");
  if (!s) return "";
  /* si pegaron la dirección entera, nos quedamos con el usuario */
  const m = s.match(/instagram\.com\/+([^/?#]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@+/, "").replace(/\/+$/, "");
  /* Instagram admite letras, números, punto y guion bajo, hasta 30 */
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
}

async function leer(env) {
  const r = await env.DB.prepare(
    "SELECT id, grupo, cargo, nombre, ig, destacado, orden FROM equipo WHERE estado = 'activo' ORDER BY orden ASC, id ASC"
  ).all();
  /* La página quiere los grupos armados, no una lista plana: si el agrupado lo
     hiciera cada página por su cuenta, las dos —la grande y la del celular—
     tendrían que ponerse de acuerdo en el orden. */
  const grupos = [];
  for (const p of r.results || []) {
    let g = grupos.find((x) => x.grupo === p.grupo);
    if (!g) grupos.push((g = { grupo: p.grupo, cargo: p.cargo, gente: [] }));
    g.gente.push({ id: p.id, nombre: p.nombre, ig: p.ig, destacado: p.destacado });
  }
  return grupos;
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ grupos: [] });
  return new Response(JSON.stringify({ grupos: await leer(env) }), {
    headers: { "Access-Control-Allow-Origin": "*",
               "Content-Type": "application/json; charset=utf-8",
               "Cache-Control": "public, max-age=120" },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }

  const grupo = t(b.grupo, 40), nombre = t(b.nombre, 60);
  if (!grupo) return json({ error: "Falta el grupo." }, 400);
  if (!nombre) return json({ error: "Falta el nombre." }, 400);
  const ig = limpiarIg(b.ig);
  if (ig === null) return json({ error: "Ese usuario de Instagram no existe: va sólo @nombre." }, 400);

  const repe = await env.DB.prepare(
    "SELECT id FROM equipo WHERE estado = 'activo' AND grupo = ? AND lower(nombre) = lower(?)"
  ).bind(grupo, nombre).first();
  if (repe) return json({ error: "Ese ya está en " + grupo + "." }, 409);

  /* el cargo lo hereda del grupo si ya existe: es una etiqueta del grupo, no de
     la persona, y pedirlo en cada alta era una forma segura de que se
     desincronizara */
  const g0 = await env.DB.prepare(
    "SELECT cargo FROM equipo WHERE grupo = ? ORDER BY orden ASC LIMIT 1").bind(grupo).first();
  const cargo = t(b.cargo, 30) || (g0 ? g0.cargo : "");

  const fin = await env.DB.prepare(
    "SELECT MAX(orden) AS m FROM equipo WHERE grupo = ?").bind(grupo).first();
  const tope = await env.DB.prepare("SELECT MAX(orden) AS m FROM equipo").first();
  const orden = (fin?.m ?? tope?.m ?? 0) + 10;
  /* si entra en el medio de un grupo, hay que correr lo de atrás */
  await env.DB.prepare("UPDATE equipo SET orden = orden + 10 WHERE orden >= ?").bind(orden).run();

  const r = await env.DB.prepare(
    "INSERT INTO equipo (grupo, cargo, nombre, ig, destacado, orden) VALUES (?,?,?,?,?,?)"
  ).bind(grupo, cargo, nombre, ig, b.destacado ? 1 : 0, orden).run();
  return json({ id: r.meta?.last_row_id, grupos: await leer(env) });
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }

  /* renombrar un grupo entero o cambiarle la etiqueta */
  if (b.grupoViejo) {
    const nuevo = t(b.grupo, 40);
    if (!nuevo) return json({ error: "Falta el nombre del grupo." }, 400);
    await env.DB.prepare("UPDATE equipo SET grupo = ?, cargo = ? WHERE grupo = ?")
      .bind(nuevo, t(b.cargo, 30), t(b.grupoViejo, 40)).run();
    return json({ grupos: await leer(env) });
  }

  const id = Number(b.id || 0);
  if (!id) return json({ error: "falta el id" }, 400);
  const hay = await env.DB.prepare("SELECT id FROM equipo WHERE id = ?").bind(id).first();
  if (!hay) return json({ error: "Ese ya no está." }, 404);

  const campos = [], args = [];
  if (b.nombre !== undefined) {
    const n = t(b.nombre, 60);
    if (!n) return json({ error: "Falta el nombre." }, 400);
    campos.push("nombre = ?"); args.push(n);
  }
  if (b.ig !== undefined) {
    const ig = limpiarIg(b.ig);
    if (ig === null) return json({ error: "Ese usuario de Instagram no existe: va sólo @nombre." }, 400);
    campos.push("ig = ?"); args.push(ig);
  }
  if (b.destacado !== undefined) { campos.push("destacado = ?"); args.push(b.destacado ? 1 : 0); }
  if (b.grupo !== undefined) {
    const g = t(b.grupo, 40);
    if (!g) return json({ error: "Falta el grupo." }, 400);
    campos.push("grupo = ?"); args.push(g);
  }
  if (!campos.length) return json({ error: "No mandaste nada para cambiar." }, 400);

  args.push(id);
  await env.DB.prepare("UPDATE equipo SET " + campos.join(", ") + " WHERE id = ?").bind(...args).run();
  return json({ grupos: await leer(env) });
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  const u = new URL(request.url);

  const grupo = u.searchParams.get("grupo");
  if (grupo) {
    await env.DB.prepare("DELETE FROM equipo WHERE grupo = ?").bind(t(grupo, 40)).run();
    return json({ grupos: await leer(env) });
  }
  const id = Number(u.searchParams.get("id") || 0);
  if (!id) return json({ error: "falta el id" }, 400);
  const r = await env.DB.prepare("DELETE FROM equipo WHERE id = ?").bind(id).run();
  if (!r.meta?.changes) return json({ error: "Ese ya no está." }, 404);
  return json({ grupos: await leer(env) });
}
