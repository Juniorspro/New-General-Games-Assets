import "dotenv/config";

const proveedor = (process.env.PROVEEDOR || "baileys").toLowerCase();

const disponibles = {
  baileys: () => import("./proveedores/baileys.js"),
  web: () => import("./proveedores/web.js"),
  cloud: () => import("./proveedores/cloud.js"),
};

if (!disponibles[proveedor]) {
  console.error(`Proveedor desconocido: "${proveedor}". Usa "baileys", "web" o "cloud".`);
  process.exit(1);
}

console.log(`Arrancando bot con el proveedor: ${proveedor}`);
const modulo = await disponibles[proveedor]();
await modulo.arrancar();
