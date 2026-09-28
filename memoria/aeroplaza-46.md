# AEROPLAZA — cuadragésima quinta vuelta (28/09/2026): el celu, con amigos

Pidió: "agreguemos un teléfono celular para convertirlo en algo así como Roblox, y podemos tener amigos y solicitudes
de amistad etc". Antes: [aeroplaza-45](aeroplaza-45.md) (las actualizaciones). La red: [aeroplaza](aeroplaza.md) › La red.

## Qué hay

- **El celu** (`js/celu.js` y el final de `css/aeroplaza.css`): 📱 en el HUD, la M, Select en el mando o "📱 Celu" en la
  pausa (así se abre en el VR). Es de vidrio blanco y adentro tiene el fondo Aero de siempre.
  - Apps: Amigos, Mensajes, Juegos (cada lugar con cuánta gente hay y las caras de tus amigos, como la portada de
    Roblox), Casas (las abiertas) y Perfil (tu código, las opciones y los bloqueados). También atajos a cámara, probador,
    tienda, misiones y ajustes; al cerrar esas, se vuelve al celu.
  - Amigos tiene tres pestañas: la lista (los conectados primero, dónde están, "▶ Unirse" y 💬), las solicitudes
    (aceptar, rechazar, cancelar) y agregar (por código, o "Cerca": los de la sala).
  - Charlas de a dos, con "✓ Enviado", "✓✓ Visto" y aviso con lo que dice. Cada perfil tiene unirse, mensaje, quitar y
    bloquear; el "¿seguro?" va adentro del celu.
  - **Parado** en pantallas altas, abajo de la fila de botones del HUD; **acostado** (html.b460) en el celu con el
    juego acostado. El juego no se pausa (es en línea): la entrada queda bloqueada y los dedos se esconden.
- **El celu en la mano** (`meeple.js › celuEnMano`): a la altura de la cara y al costado de la cabeza, en la mano
  derecha, con la pantalla prendida. Los demás lo ven porque va `cel: 1` en el estado de la red. Caminando también;
  nadando, montado o con un gesto, no.
- **Unirse** (`main.js › unirseA`): a la misma sala (`entrarReino(…, { sala })`, solo lugares públicos, `PUBLICOS`). En
  una casa, a esa casa; en el parkour, a su nivel; en tiro, runner o tienda, a ese lugar; adentro de un edificio, a la
  plaza. Si la sala está llena (14), a otra del mismo lugar.

## La identidad y el correo (`js/amigos.js`), sin servidor

El broker es público: cualquiera publica cualquier cosa. Por eso:
- **La llave**: un par ECDH P-256 por aparato (WebCrypto), guardado en `localStorage['aeroplaza_llave']`. **El id de la
  red ES la huella de la llave pública** (12 hex del SHA-256): el mismo formato que antes, y es el código de amigo.
  `main.js` hace `await Llave.cargar()` antes del id; `guardar.js › cambiarId` reemplaza el viejo y la casa retenida
  con el id viejo se borra al conectar (`red.aBorrar`). Sin WebCrypto (una página sin https) queda el id al azar de
  antes y el celu dice por qué no hay amigos.
- **`perfil/<id>`, retenido**: la llave, el nombre y el muñeco. Sirve para encontrar a alguien por código aunque esté
  desconectado. La llave se comprueba con la huella; el nombre de ahí vale solo hasta que llegue una carta.
- **`buzon/<para>/<de>`, retenido: una carta por par y por sentido, con todo**: `rel` (pide · amigo · no), el nombre, el
  muñeco, los últimos 30 mensajes y `vi` (hasta cuál leyó). Va cifrada con AES-GCM, con la clave de ECDH + HKDF entre
  las dos llaves, y con `de>para` como dato asociado. Abrirla prueba que la escribió el otro.
  - `n` sube siempre (`seq`, la hora); la vieja repetida no vale.
  - Se manda de a una por amigo y en orden (`mandar` → `_mandar`): si dos se cruzan, la retenida puede quedar la vieja.
- **Amigos = los dos dijeron que sí** (`estadoDe`): uno pide, el otro acepta, y el primero, al ver el sí, pasa a
  `amigo` solo. Si se piden a la vez, también. `no` sirve para rechazar, cancelar o quitar, y además olvida lo que dijo
  el otro (`suya = null`): para volver a ser amigos, el otro tiene que aceptar de nuevo. Un pedido nuevo después de un
  rechazo vuelve a aparecer (`pideSuya !== rechazo`); el mismo repetido, no.
- **Quién está en línea y dónde**: del vestíbulo de `red.js`, la presencia de cada 4 s, que ya tenía el id.
  `revisarEnLinea` avisa "se conectó" (los primeros 10 s después de conectar no avisa).
- Límites: 100 amigos, 40 pedidos, 200 letras por mensaje, 80 mensajes guardados por charla, 400 registros (los
  tachados más viejos se van). Opciones: "me pueden mandar solicitudes: todos / nadie" y avisar al conectarse.

## Trampas

- **No borrar el registro del que ya no tiene nada conmigo**: queda tachado con el `n` de su última carta. Si se
  borraba, una carta vieja suya (el broker la guarda, o alguien la repite) volvía a aparecer como pedido. Lo prueba
  `celu.mjs` (Carla repite la carta de Ana de cuando eran amigas).
- **En una clase, los métodos no llevan coma** entre ellos (un `},` suelto de copiar de un objeto rompe todo el módulo).
- La vista previa del código ("Es Beto") no puede esperar a que llegue el perfil para pintarse: puede haber llegado
  antes (por "Cerca"). Se pinta al escribir (`pintarRes`).
- "Cerca" solo ofrece agregar al que tiene perfil: uno con un juego de antes de los amigos no tiene llave, y su id va a
  cambiar cuando se actualice.
- El espejo del VR lee todos los botones de la ventana: los de solo ícono llevan `aria-label` ("💬 Mensaje a Beto"). El
  "¿seguro?" no puede ser `UI.confirmar`, que es otra ventana y no se ve en el VR.
- `UI.limpiar` saca el celu sin cerrarlo: `main.js` suelta la entrada si `J.celuAbierto` quedó y el celu ya no está.
- Nombres sin caracteres invisibles ni de dar vuelta el texto (`limpiarNombre`): con eso alguien se disfraza de otro.
- El brazo derecho del muñeco es `bl` (`brazos[0]`, el de -x: mirando a +z, su derecha es -x).
- El celu en la mano, agarrado desde abajo y asomando arriba del puño; si no, de atrás lo tapa el brazo.

## Pruebas

- `pruebas/celu.mjs` (31, ~70 s; está en la tanda): tres jugadores contra `broker.mjs`, que ahora da `retenido(tema)`.
  - la llave y el perfil retenido;
  - el celu, la M y el celu en la mano visto por el otro;
  - pedir por código (con puntos y en mayúscula), el aviso y el globito, aceptar;
  - la lista con dónde está;
  - los mensajes: el broker solo ve `id, pub, iv, c`, se ven como texto y vuelve el visto;
  - unirse en otro reino, y el mensaje de cuando estaba desconectado;
  - las trampas de Carla (otra llave; la llave de Ana sin su privada; la carta vieja);
  - quitar, rechazar, el pedido nuevo, bloquear y "nadie";
  - el espejo, los tres idiomas y que acostado entre en la pantalla.
- Fotos: `pruebas/salida/celu-inicio.png`, `celu-charla.png`, `celu-acostado.png` y `celu-en-la-mano.png`.
- **No se probó contra el broker público de verdad** (desde el contenedor no hay WebSocket) ni en un teléfono.
