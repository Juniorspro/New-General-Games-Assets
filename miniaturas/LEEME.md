# Miniaturas Papuchón

Hace miniaturas para YouTube, Shorts/TikTok/Reels e Instagram. Escribís de qué
es el video, tocás **Crear**, y la app hace el resto: fondo con IA, tu foto
recortada encima, el título grande y el logo del canal.

- Web: https://raw.githack.com/juniorspro/new-general-games-assets/claude/papa-del-patron-3cpe64/miniaturas/index.html
- App de Android: `android/` (ver abajo). Es la única que puede usar Rezona.

## Cómo elige con qué dibujar (solo, sin preguntar)

| motor | cuándo | costo |
|---|---|---|
| **Rezona** | primero, si la app está conectada (y no pasó el tope, si se puso uno) | créditos de Rezona (~54–81 por imagen) |
| **AI Horde** | gratis, sin cuenta; si la cola pasa de 5 minutos, se suelta | gratis, sin límite |
| **Hugging Face** | gratis con una cuota diaria por conexión | gratis |
| **Pollinations** | gratis, 1 imagen cada 45 s por conexión; deja su marquita abajo a la derecha | gratis |
| **Diseño sin IA** | si no hay internet o fallan todos | gratis |

Con varias miniaturas a la vez, se reparten entre motores distintos. Si Horde tiene
cola, mientras tanto aparece una rápida de Pollinations y después se cambia sola
por la mejor. Si Rezona contesta "sin créditos" (402) o llega al tope del día,
las que siguen salen con los gratis.

El título no lo dibuja la IA: lo pone el diseño (siempre legible y con tildes). Si
no se escribe, lo propone un modelo de texto gratis (Pollinations) o, si no
contesta, uno de una lista por tema. La palabra entre `*asteriscos*` sale resaltada.

## La foto de la persona

Se recorta en el teléfono con MediaPipe (modelo de 16 MB que se baja una vez). Se
queda solo con las manchas que tienen cara: si el modelo confunde un auto o fuego
con "ropa", no se cuela. Si no puede recortar, la foto va entera en un recuadro.

## App de Android y Rezona

`bash miniaturas/android/armar.sh salida.apk` (sin Android Studio; baja solo
las herramientas). La llave de Rezona:

- **Viene adentro** si existe `~/.papuchon/rezona-miniaturas.json` al armar
  (una llave aparte, sacada con el login por dispositivo). Ofuscada, no
  cifrada: el APK no se publica.
- **O se conecta desde la app**: Motores → *Conectar con Rezona* → se aprueba
  el link (se puede mandar por WhatsApp a quien tenga la cuenta).

La llave nunca pasa por la página: Java hace los pedidos (la API de Rezona solo
acepta páginas de rezona.ai) y trae las imágenes por `/rz-pv/…` desde el mismo
origen, así se pueden exportar. Sin tope por defecto; `TOPE_REZONA=N` al armar
pone un máximo de N imágenes por día por teléfono. Si se pierde el teléfono, se borra esa llave en
rezona.ai/api-keys y listo.

## Por dentro

Scripts clásicos en `js/` (React 18 + htm, sin compilar): `base.js` (formatos,
plataforma, IndexedDB), `textos.js` (traducción y títulos), `motores.js` (motores y
la fábrica que los reparte), `recorte.js`, `diseno.js` (el canvas), `ui-*.js`.
