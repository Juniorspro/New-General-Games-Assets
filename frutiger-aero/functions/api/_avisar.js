/* Avisos dentro del sitio.
 *
 * No hay correo. Se probo y se descarto: los servicios de envio solo dejan
 * escribirle a cualquiera desde un dominio verificado, y con un `.pages.dev`
 * prestado no hay dominio que verificar. Mandarlo igual desde un remitente de
 * prueba es que caiga en spam, que es peor que no mandarlo, porque uno cree que
 * aviso y la otra persona nunca se entera.
 *
 * El aviso de aca adentro llega siempre, y la campanita lo muestra sin recargar.
 */
export async function avisar(env, usuario, texto, tipo) {
  await env.DB.prepare(
    "INSERT INTO avisos (usuario, texto, tipo, creado) VALUES (?,?,?,?)")
    .bind(usuario, texto, tipo || "info", Date.now()).run();
}
