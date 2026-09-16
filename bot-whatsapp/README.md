# Bot de WhatsApp — comandos de prueba

Un motor de comandos y **dos proveedores intercambiables**. El motor
(`src/comandos.js`) no sabe nada de WhatsApp: recibe texto y devuelve texto.
Por eso puedes probarlo en la terminal sin teléfono, y cambiar de proveedor
sin tocar un solo comando.

```
npm install
npm run probar        # la batería completa, sin WhatsApp
npm run probar -- /dado 20
```

## ¿Se puede gratis? Sí, con matices

| Camino | Coste | Tu número | Peso | El pero |
|---|---|---|---|---|
| **`baileys`** · WebSocket | Gratis del todo | **El tuyo** | Ligero, sin navegador. Corre en un VPS mínimo o en Termux | **No oficial.** WhatsApp puede banear el número |
| **`web`** · WhatsApp Web | Gratis del todo | **El tuyo** | Descarga Chromium (~150 MB) y come RAM | Igual de no oficial, y más pesado |
| **`cloud`** · Cloud API de Meta | Responder dentro de la ventana de 24 h que abre el usuario no se cobra; las plantillas que inicias tú sí | **Número aparte** — el que migres deja de funcionar en la app normal | Un servidor con HTTPS público | Cuenta Business, app y webhook. Meta presta un número de prueba gratis |

Para **probar hoy**: `baileys` — es lo que usan casi todos los bots gratuitos.
Para el **negocio**: `cloud`, empezando por el número de prueba que regala Meta.

> Las tarifas de Meta han cambiado varias veces. Confirma la vigente en la
> documentación de precios de WhatsApp Business antes de calcular costes.

## Comandos

| Comando | Qué hace |
|---|---|
| `/bot` | Menú con todos los comandos |
| `/ping` | Responde `pong` y mide cuánto tardó |
| `/hora` | Fecha y hora del servidor, local y UTC |
| `/eco <texto>` | Repite lo que le escribas |
| `/dado [caras]` | Tira un dado, 6 caras por defecto |
| `/id` | Tu nombre, número y id de chat — para depurar |
| `/estado` | Tiempo encendido, mensajes atendidos, memoria |
| `/ia <pregunta>` | Le pregunta a una IA. Ver la tabla de proveedores |
| `/modelos` | Lista los modelos que ofrece el proveedor activo |

Los mensajes que no empiezan por `/` se ignoran: el bot no interrumpe
conversaciones normales.

## Arrancar con tu número (`baileys`, recomendado)

```bash
cp .env.example .env
npm install
npm run baileys
```

Si pones `TU_NUMERO` en el `.env` (formato internacional, sin `+`), imprime un
**código de 8 dígitos**: WhatsApp del teléfono → **Dispositivos vinculados** →
*Vincular con número de teléfono*. Si lo dejas vacío, imprime un QR.

La sesión queda en `.baileys_auth/`, así que la próxima vez arranca sola. Ahora
pídele a alguien que te escriba `/bot`.

### La alternativa pesada (`web`)

`npm run web` hace lo mismo con `whatsapp-web.js`, que maneja un Chromium de
verdad por debajo: descarga ~150 MB y come bastante más RAM. Solo tiene sentido
si Baileys te falla con alguna función concreta.

## Arrancar con la API oficial (`cloud`)

1. developers.facebook.com → crea una app de tipo **Business** → añade el
   producto **WhatsApp**.
2. Copia a `.env`: el **token** temporal y el **Phone number ID**. Inventa
   cualquier cadena para `WHATSAPP_VERIFY_TOKEN`.
3. `npm run cloud` y expón el puerto:
   ```bash
   npx localtunnel --port 3000
   ```
4. En el panel → WhatsApp → Configuración → Webhook: pega
   `https://TU-URL/webhook`, el mismo verify token, y **suscríbete al campo
   `messages`** (sin esto no llega nada y es el error más común).
5. Añade tu número a la lista de destinatarios de prueba y mándale `/bot`.

El token que da el panel dura unas horas; para algo permanente hace falta un
token de sistema. `GRAPH_VERSION` en `.env` fija la versión de Graph API —
comprueba cuál es la vigente.

## La IA: pon una clave y ya

El bot habla el dialecto de OpenAI, que es el que usan casi todos, así que un
solo cliente cubre varios servicios. **Pones UNA clave en el `.env` y detecta
sola cuál usar.**

| Proveedor | Clave | Gratis | Notas |
|---|---|---|---|
| **Groq** | `GROQ_API_KEY` | Sí, sin tarjeta | El más rápido |
| **Google Gemini** | `GEMINI_API_KEY` | Sí, sin tarjeta | Capa amplia y **con visión** — la mejor para analizar fotos |
| **OpenRouter** | `OPENROUTER_API_KEY` | Los modelos que acaban en `:free` | Mucho catálogo |
| **Cerebras** | `CEREBRAS_API_KEY` | Sí, sin tarjeta | Muy rápido, catálogo pequeño |
| **Mistral** | `MISTRAL_API_KEY` | Capa gratuita | |
| **Claude** | `ANTHROPIC_API_KEY` | No, por uso | El más capaz |
| Cualquier otra | `IA_API_KEY` + `IA_BASE_URL` + `IA_MODELO` | | Si es compatible con OpenAI, entra |

Los límites y los nombres de modelo cambian seguido. Por eso existe
**`/modelos`**: te lista lo que ofrece tu proveedor ahora mismo, sin que tengas
que buscarlo. Fijas el que quieras con `IA_MODELO=` en el `.env`.

Dos avisos sobre las capas gratuitas: suelen tener **límite por minuto**, y
varias **usan tus datos para entrenar**. Para probar da igual; para datos de
clientes, léete su política antes.

`src/ia.js` ya trae `describirImagen()` lista: recibe una foto y devuelve nombre
y descripción de venta. Es la pieza del proyecto de la tienda, solo falta
enchufarla a las fotos que llegan por WhatsApp.

## Añadir un comando

Un objeto más en `src/comandos.js`. Aparece solo en el menú de `/bot`:

```js
saludo: {
  descripcion: "Saluda por tu nombre",
  uso: "/saludo",
  ejecutar(args, ctx) {
    return `Hola ${ctx.nombre || "desconocido"} 👋`;
  },
},
```

`ejecutar` puede ser `async` y recibe `ctx` con `de`, `nombre`, `chatId` y
`proveedor`. Si lanza una excepción, el bot responde con el error en vez de
caerse.

## Qué está probado y qué no

`npm run probar` recorre los diez casos del enrutador y pasa: comandos válidos,
argumentos, comando inexistente y mensaje sin `/`.

**La llamada real a la IA no está probada contra ningún proveedor**, porque en
la máquina donde se escribió esto no había ninguna clave. El formato de la
petición es el estándar de OpenAI y el error crudo del proveedor se muestra tal
cual en el chat, así que si algo falla (modelo retirado, cuota agotada) lo vas a
leer completo en vez de un "error genérico".
