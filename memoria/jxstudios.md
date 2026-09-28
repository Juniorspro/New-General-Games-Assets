# JXSTUDIOS — la página del estudio (28/09/2026)

Pidió: "una página sobre mí, hosteada por Cloudflare con mi app, y una llave para que en otra sesión también puedan
modificarla". Mandó dos imágenes del logo (la moneda de metal y el rombo de fibra de carbono). Ver también:
[desplegar](desplegar.md), [sitios](sitios.md).

## Qué es

- **`jxstudios/index.html`**: un solo archivo con estilos, textos y script. Pesa 30 KB.
  - Estilo del logo: fibra de carbono hecha con gradientes, metal cepillado y la moneda que se inclina con el mouse.
  - Idiomas: español, inglés y portugués. Toma el del navegador (si no es ninguno de los tres, inglés) y recuerda el
    elegido (`jx-idioma`).
  - Los textos van en `TEXTOS` y los juegos en `JUEGOS`: para cambiar algo, se cambia ahí en los tres idiomas.
- **`jxstudios/img/`**: el logo recortado (`moneda`, `jxs`, `rombo`, `icono.png`, `og.jpg`) y una captura por juego,
  en webp de 15 a 77 KB.
- **Lo que no está en el repo lo copia `desplegar.sh` a `jxstudios/dist/`** (gitignoreado):
  - los 6 juegos de un archivo (BRILLO, KUNTUR, ZONDA, LUZ MALA, RUTA 40, BOSQUE) en `juegos/`;
  - AEROPLAZA web en `aeroplaza/`;
  - la APK en `app/aeroplaza.apk`.
  - En total, 40 MB. Lo más grande es la APK (18,7 MB); Pages no acepta archivos de más de 25 MiB.
- **La APK del sitio es la SIN canciones** (`apk.mjs` sin `--canciones`): las canciones son de otros y la
  `--canciones` es solo para el dueño.

## Publicar (`jxstudios/desplegar.sh`)

- **La llave se lee del entorno**: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`. Se cargan en la configuración del
  entorno de claude.ai; nunca en el repo ni en el chat.
  - Permisos del token: "Cloudflare Pages: Edit" y "Account Settings: Read".
  - Una sesión ve la variable recién si arranca después de cargarla.
- **El proyecto es `jxstudios`**, así que la dirección queda `https://jxstudios.pages.dev`.
  - La primera vez lo crea con `wrangler pages project create`.
  - Después sube con `--branch main` y prueba 4 direcciones con `curl`.
- **`--armar`** solo arma `dist/`; se mira con `python3 -m http.server -d jxstudios/dist`.
- **La APK, en este orden**:
  1. la compilada en la sesión, si es más nueva que la fuente;
  2. si hay `ANDROID_HOME`, se compila;
  3. si no, se baja la ya publicada. Cada despliegue de Pages sube todo: si falta, desaparece.
- **Freno**: si el tamaño de la APK no coincide con el que dice la página (`<small>18,7 MB</small>`), no sube.
- **El 28/09 no se pudo subir**: el entorno no tenía la llave. Todo lo demás quedó armado y probado.

## Pruebas

- Con `http.server` y Playwright, a 390 × 844 (celu) y 1280 × 800: 17 de 17 bien.
  - los 8 links dan 200 y las 12 imágenes cargan;
  - no se corre de costado;
  - cambia de idioma, lo recuerda al volver, y no da errores.
- **Trampas**:
  - `<img height="500">` con `aspect-ratio` en CSS queda estirada: hace falta `height: auto`;
  - el `requestfailed` de Playwright marca los HEAD al `http.server` de Python como `ERR_ABORTED`, aunque den 200;
  - desde el Chromium del contenedor, Google Fonts falla por el certificado del proxy: las capturas salen con la letra
    de repuesto.
