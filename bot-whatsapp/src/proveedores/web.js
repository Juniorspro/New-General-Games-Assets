// Proveedor "web": usa TU número a través de WhatsApp Web.
// Gratis y sin trámites, pero NO es oficial: WhatsApp puede banear el número.
// Úsalo para probar, no para el negocio.

import { responder } from "../comandos.js";

export async function arrancar() {
  const { default: pkg } = await import("whatsapp-web.js");
  const { default: qr } = await import("qrcode-terminal");
  const { Client, LocalAuth } = pkg;

  const cliente = new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  cliente.on("qr", (codigo) => {
    console.log("\nEscanea este QR con WhatsApp › Dispositivos vinculados:\n");
    qr.generate(codigo, { small: true });
  });

  cliente.on("authenticated", () => console.log("Sesión guardada. La próxima vez no pedirá QR."));
  cliente.on("ready", () => console.log("✅ Bot conectado. Mándate /bot desde otro teléfono."));
  cliente.on("auth_failure", (m) => console.error("❌ Fallo de autenticación:", m));
  cliente.on("disconnected", (m) => console.error("⚠️  Desconectado:", m));

  cliente.on("message", async (mensaje) => {
    const recibidoEn = Date.now();
    if (mensaje.from === "status@broadcast") return;

    let nombre;
    try {
      nombre = (await mensaje.getContact())?.pushname;
    } catch {
      nombre = undefined;
    }

    const salida = await responder({
      texto: mensaje.body,
      de: mensaje.from.replace(/@c\.us$/, ""),
      nombre,
      chatId: mensaje.from,
      proveedor: "web (no oficial)",
      recibidoEn,
    });

    if (salida) {
      await mensaje.reply(salida);
      console.log(`← ${mensaje.from}: ${mensaje.body}`);
    }
  });

  await cliente.initialize();
}
