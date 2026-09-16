// Proveedor "cloud": API oficial de WhatsApp de Meta (Cloud API).
// Responder dentro de la ventana de 24 h que abre el usuario no se cobra.
// Necesita un número dedicado (no puede ser tu WhatsApp normal) y una URL
// pública con HTTPS para el webhook.

import { responder } from "../comandos.js";

const GRAPH = process.env.GRAPH_VERSION || "v23.0";

async function enviar(a, texto) {
  const url = `https://graph.facebook.com/${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: a,
      type: "text",
      text: { preview_url: false, body: texto },
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Meta devolvió ${respuesta.status}: ${detalle}`);
  }
  return respuesta.json();
}

export async function arrancar() {
  const faltan = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_VERIFY_TOKEN"].filter(
    (v) => !process.env[v]
  );
  if (faltan.length) {
    console.error(`❌ Faltan variables en .env: ${faltan.join(", ")}`);
    process.exit(1);
  }

  const { default: express } = await import("express");
  const app = express();
  app.use(express.json());

  // 1) Meta llama una vez con GET para comprobar que el webhook es tuyo.
  app.get("/webhook", (req, res) => {
    const modo = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    if (modo === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("✅ Webhook verificado por Meta.");
      return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.sendStatus(403);
  });

  // 2) A partir de ahí, cada mensaje llega por POST.
  app.post("/webhook", async (req, res) => {
    const recibidoEn = Date.now();
    res.sendStatus(200); // Meta reintenta si tardas: confirma primero, procesa después.

    try {
      for (const entrada of req.body?.entry || []) {
        for (const cambio of entrada.changes || []) {
          const valor = cambio.value || {};
          const perfil = valor.contacts?.[0]?.profile?.name;

          for (const mensaje of valor.messages || []) {
            if (mensaje.type !== "text") continue;

            const salida = await responder({
              texto: mensaje.text?.body,
              de: mensaje.from,
              nombre: perfil,
              chatId: mensaje.from,
              proveedor: "cloud (oficial)",
              recibidoEn,
            });

            if (salida) {
              await enviar(mensaje.from, salida);
              console.log(`← ${mensaje.from}: ${mensaje.text?.body}`);
            }
          }
        }
      }
    } catch (error) {
      console.error("[webhook]", error);
    }
  });

  app.get("/", (_req, res) => res.send("Bot de WhatsApp en pie."));

  const puerto = process.env.PUERTO || 3000;
  app.listen(puerto, () => {
    console.log(`✅ Webhook escuchando en el puerto ${puerto}`);
    console.log(`   Exponlo con:  npx localtunnel --port ${puerto}`);
    console.log(`   y registra    https://TU-URL/webhook   en el panel de Meta.`);
  });
}
