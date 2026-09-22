# Sitios

Todo el detalle está en `ESTADO.md`: abrilo por título, con
`grep -n "^#" ESTADO.md`. Para desplegar: [desplegar](desplegar.md). Para
probar: [maquina](maquina.md).

| | Frutiger Aero | IBLO Eventos |
|---|---|---|
| qué es | escritorio tipo Vista en el navegador: cuentas, muro, Aero+ (donantes) y tienda de apps | productora de eventos de Margarita Belén (Chaco), con panel propio |
| dirección | frutiger-aero-86q.pages.dev | iblo-eventos.pages.dev |
| carpeta | `frutiger-aero/` | `docs/paginas/` (la portada es `iblo.html`) |
| base D1 | `frutiger-social`, 12 tablas | `iblo`, 16 tablas |
| endpoints | 25 | 27 |

Los dos corren en Cloudflare Pages (estáticos, Functions y D1), en el plan
gratuito.

## Frutiger Aero

- Permisos:
  - `usuarios.acceso = 1`: donó;
  - `jefe = 1`: el dueño, que entra a todo sin donar;
  - `bloqueado = 1`: le gana a todo, incluso a jefe.
- **La pantalla no decide nada:** toda puerta se pregunta en el servidor.
- La API está en `functions/api/`:
  - `_social`: sesiones;
  - `_firma`: pases HMAC;
  - `_llave`: WebAuthn;
  - `acceso` y `pagar`: PayPal, Mercado Pago o código;
  - `aeromas`, `tienda` y `editor` (la cuota);
  - `fabrica`: fondos con Workers AI.
- Cobro con PayPal: el servidor captura la orden y comprueba que quede
  `COMPLETED`, que la plata vaya a la cuenta propia y que llegue al mínimo de
  US$ 1 (PayPal cobra un fijo de ~30 centavos por operación). Para probar sin
  gastar, sandbox con `PAYPAL_MODO=sandbox`.
- Pruebas: 71 comprobaciones en `frutiger-aero/pruebas/`. Se corre
  `preparar.sh`, se deja andando `npx wrangler pages dev --port 8788 --local` y
  después `node navegacion.mjs` y las demás.
- En producción hay 2 cuentas, 1 publicación, 1 app y 15 visitas
  (`ESTADO.md § Dónde está todo ahora`). Funciona y todavía no tiene gente.
- Trampas del navegador (`ARRANQUE.md § 8`):
  - un `<img>` no manda cabeceras: se usa un pase firmado en la URL;
  - `url()` dentro de una variable CSS se resuelve desde la hoja que la usa;
  - contra un `sticky` no alcanza el z-index: conviene correr el elemento;
  - las firmas de WebAuthn vienen en DER y WebCrypto las quiere en r||s.

## IBLO Eventos y lo demás

- IBLO tiene 12 páginas públicas y el panel, y se publica con
  `./desplegar-iblo.sh`. El material está en `iblo-eventos/`, los modelos en
  `modelos-cdn/` (con el hash en el nombre) y las herramientas en
  `herramientas/iblo/`.
- Electro Silver está en electro-silver.pages.dev con `noindex`, porque los
  datos y las reseñas son de ejemplo. Detalle en `electro-silver/LEEME.md`.
- En `docs/paginas/` están Humo Lento, Gabinete y Kane, demostraciones con
  assets de Rezona (`estado.json › proyectos`).

## Pendiente

- Lo tiene que hacer el dueño:
  - la llave de VirusTotal;
  - habilitar R2 para los APK;
  - las credenciales de PayPal sandbox para probar la cuota;
  - rotar la clave de IBLO, que pasó por el chat.
- Trabado: entrar con Google (pide ser mayor de edad) y compilar el APK acá.
- Se puede hacer: la IA de respaldo en IBLO (Groq o Gemini) y las publicaciones
  21 y 22, que salen duplicadas.
