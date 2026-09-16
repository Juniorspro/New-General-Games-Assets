// Pasar la pantalla de idioma.
//
// Con el guardado vacio, lo primero que ve un jugador nuevo es el selector de
// idiomas: eso ES el comportamiento, no un estorbo. Las pruebas que van a
// probar otra cosa lo pasan eligiendo castellano —que es el idioma en el que
// estan escritas las comprobaciones de texto— y siguen. Del selector en si se
// ocupa pruebas/idioma.mjs.
export async function pasarIdioma(pg, cual = "es") {
  const pant = await pg.$("#p-idioma:not([hidden])");
  if (!pant) return false;
  await pg.click(`#idiomas [data-idioma="${cual}"]`);
  // Se espera el MENU y no "#p-idioma[hidden]": waitForSelector espera a que el
  // elemento sea VISIBLE, y un elemento con [hidden] nunca lo es — la espera se
  // agotaba mirando justo lo que ya habia pasado.
  await pg.waitForSelector("#p-inicio:not([hidden])", { timeout: 20000 });
  return true;
}
