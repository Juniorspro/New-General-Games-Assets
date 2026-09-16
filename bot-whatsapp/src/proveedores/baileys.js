// Proveedor "baileys": WhatsApp Web por WebSocket, sin navegador.
// Es lo que usa la mayoría de los bots gratuitos: mucho más ligero que
// whatsapp-web.js (no descarga Chromium, corre en un VPS mínimo o en Termux)
// y permite vincular con un código de 8 dígitos en vez de escanear un QR.
//
// Sigue siendo NO oficial: WhatsApp puede banear el número.

import { responder } from "../comandos.js";

export async function arrancar() {
  const baileys = await import("@whiskeysockets/baileys");
  const makeSocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

  const { state, saveCreds } = await useMultiFileAuthState(".baileys_auth");
  const { version } = await fetchLatestBaileysVersion();

  // Si pones TU_NUMERO en .env vincula por código; si no, imprime un QR.
  const numero = (process.env.TU_NUMERO || "").replace(/\D/g, "");
  const porCodigo = Boolean(numero) && !state.creds.registered;

  const sock = makeSocket({
    version,
    auth: state,
    printQRInTerminal: !porCodigo,
    browser: ["Bot Sabueso", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  if (porCodigo) {
    // Baileys necesita un momento antes de poder pedir el código.
    setTimeout(async () => {
      try {
        const codigo = await sock.requestPairingCode(numero);
        console.log(`\n🔑 Código de vinculación: ${codigo.match(/.{1,4}/g).join("-")}`);
        console.log("   WhatsApp › Dispositivos vinculados › Vincular con número de teléfono\n");
      } catch (error) {
        console.error("No se pudo pedir el código:", error?.message || error);
      }
    }, 4000);
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ Bot conectado. Mándate /bot desde otro teléfono.");
    }
    if (connection === "close") {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      const cerradoPorTi = codigo === DisconnectReason.loggedOut;
      console.error(`⚠️  Conexión cerrada (${codigo}).`);
      if (cerradoPorTi) {
        console.error("   Cerraste la sesión. Borra .baileys_auth/ y vuelve a vincular.");
        process.exit(1);
      }
      console.error("   Reconectando…");
      arrancar().catch((e) => console.error(e));
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const recibidoEn = Date.now();

    for (const m of messages) {
      if (m.key.fromMe) continue;
      const chatId = m.key.remoteJid;
      if (!chatId || chatId === "status@broadcast") continue;

      const texto =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        "";
      if (!texto) continue;

      const salida = await responder({
        texto,
        de: chatId.replace(/@s\.whatsapp\.net$/, ""),
        nombre: m.pushName,
        chatId,
        proveedor: "baileys (no oficial)",
        recibidoEn,
      });

      if (salida) {
        await sock.sendMessage(chatId, { text: salida }, { quoted: m });
        console.log(`← ${chatId}: ${texto}`);
      }
    }
  });
}
