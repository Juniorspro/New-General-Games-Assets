// Prueba el motor de comandos desde la terminal, sin WhatsApp ni teléfono.
//   npm run probar            → ejecuta la batería completa
//   npm run probar -- /dado 20 → prueba un comando suelto

import "dotenv/config";
import { responder } from "./comandos.js";

const ctx = {
  de: "5215512345678",
  nombre: "Prueba",
  chatId: "5215512345678@c.us",
  proveedor: "terminal",
};

const sueltos = process.argv.slice(2);
const bateria = sueltos.length
  ? [sueltos.join(" ")]
  : ["/bot", "/ping", "/hora", "/eco hola mundo", "/dado 20", "/id", "/estado", "/ia hola", "/noexiste", "hola"];

for (const texto of bateria) {
  const salida = await responder({ ...ctx, texto, recibidoEn: Date.now() });
  console.log(`\n\x1b[1m→ ${texto}\x1b[0m`);
  console.log(salida === null ? "\x1b[2m(ignorado: no empieza por /)\x1b[0m" : salida);
}
console.log("");
