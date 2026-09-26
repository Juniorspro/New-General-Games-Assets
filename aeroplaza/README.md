# AEROPLAZA

Un juego social en 3D con estética Frutiger Aero, para pasear con gente de
todo el mundo. Cada quien es un muñeco de gelatina brillante que se viste a
gusto. Hay una isla con lago y una cascada que cae de un globo de vidrio, un
tren que lleva a otros reinos, misiones con los vecinos, delfines para montar
y una casa propia para amueblar.

Recrea el juego que muestra @frutiger_space en TikTok, con otro nombre y otra
interfaz. El arte es de Rezona: los motivos del muñeco, el pasto, la arena, las
nubes, la ciudad, la mariposa, el fondo del menú y el delfín 3D (Tripo).

**Para jugar:** `aeroplaza.html`. Es un solo archivo: abre con doble clic y
anda sin servidor.

- Primero se elige el idioma (castellano, inglés o portugués). Después viene el
  aviso y el menú de canales; el canal Plaza lleva al juego.
- **Sin internet anda igual.** Se juega solo y el cartel de arriba dice
  "sin conexión".
- Solo suenan las canciones que mandó quien pide: Wii Party (menú), Mii Maker
  (plaza), Aquatic Ambience, Frutiger Aero Ahhh y la de itsalyzee. Cada lugar
  tiene su tema y, mientras no llegue la suya, suena la que más se parece
  (`EN_VEZ` en `js/main.js`). Van solo en `aeroplaza-con-canciones.html`, que
  no está en el repo (es público): se arma en la máquina que tenga los MP3.
  `aeroplaza.html` y el artefacto salen sin música.
- Con el celu parado el juego se acuesta solo, sin pantalla completa
  (Opciones › "Con el celu parado": girar solo, ⟳, ⟲ o no girar).

## Multijugador

No hay servidor propio: el relevo es un broker MQTT público,
`wss://broker.emqx.io:8084/mqtt`. El cliente se carga de unpkg.

- Cada reino tiene salas públicas sin código (`plaza-1`, `plaza-2`…). Al
  entrar se elige sola la más llena que tenga lugar (hasta 14 personas).
- No hay anfitrión: cada cliente es dueño de su muñeco y avisa dónde está cada
  ~100 ms, y solo si algo cambió. Los otros se dibujan interpolados.
- El chat y las acciones van por la sala: burbujazos (`hit_player`), orbes,
  frutas y el sueño colectivo.
- El plano de la casa queda retenido en el broker. Así se puede visitar desde
  el tren aunque su dueño no esté.

Detalle: `js/red.js` y `js/remotos.js`.

## Qué hay

| reino | qué tiene |
|---|---|
| La isla (Plaza) | una isla grande con seis regiones: el centro (lago con medusas, globo con cascada, peceras, Aero·Mart, probador, barrio, huerta, fuente de burbujas), la Terminal Aero con los trenes a los reinos, la Ciudad de Vidrio, la Bahía del Faro (muelle, velero, faro), la Pradera de los Molinos, el Bosque de Hongos (casa del árbol) y el Monte de la Cascada. Un monorriel da la vuelta con seis paradas, y en el spawn hay un cartel con el mapa |
| Aqua | hotel en la playa, palmeras, islotes, medusas, delfines para montar, carrera de 10 aros, arrecife con aros hundidos |
| Aurora | noche con aurora, cristales, lago de hielo, delfines que vuelan por aros dorados, estrellas que caen, el cristal del sueño colectivo |
| Jardín de géiseres | nenúfares que se pisan, lotos, flores de agua gigantes, géiseres que soplan, flores que rebotan |
| Aero·Mart | la tienda por dentro: vitrinas, percheros, sombrerero, estantes, globos, neón, maniquíes y Menta |
| Mi casa | una isla entre las nubes, con la casa y 16 muebles para poner |
| Zona de Juegos | un mapa propio: una plaza con 11 puertas que te llevan (con su efecto) a cada juego o lugar, y más de 10 cosas para hacer: 6 mesas para sentarse a jugar de a dos (damas, ta-te-ti, cuatro en línea, memotest y piedra, papel o tijera; contra otra persona de la sala o contra la compu), la canchita de fútbol con arcos y marcador, básquet, bolos, siete trampolines, hamacas, tobogán y una pista de baile con bola de espejos |
| Runner · Aero.exe | un solo nivel largo: se corre solo y rápido saltando plataformas grandes y separadas, deslizándose por debajo de compuertas, saltando vallas y esquivando paredes y cubos que se mueven al ritmo. Hay que llegar al portal antes de que termine la canción (el breakcore suena solo acá), y todo arranca Frutiger y se va rompiendo en glitches con la música. Y se pone extremo con la canción: tres sustos (se apagan en Opciones), DESPIERTA / WAKE UP gigantes en los golpes, cajas de rastreo, siluetas negras que se deshacen al acercarte, la cámara que pega y cuadros congelados |
| Parkour Aero | el primer minijuego, en la Zona de Juegos: 6 mapas (Nubes, Acuario, Jardín, Ciudad, Órbita y Azoteas) con plataformas que se mueven, barras que giran, rebotes, cintas, géiseres, tubos y muros, controles, estrellas por tiempo y récords. Se corre, se salta, se desliza, se rueda, se trepan bordes y se rebota en paredes (C, Q o ⤓ para bajar), y se puede jugar en primera persona (👁) |
| Tiro de Burbujas | minijuego en primera persona desde un balcón sobre la laguna: 60 s para reventar burbujas de 1, 2 y 5 puntos que se mueven, con racha que multiplica hasta ×4 |
| Adentro de los edificios | en primera persona, con un punto para apuntar y usar: los 5 hoteles (lobby con recepción, columna-acuario y piano; ascensor de vidrio a la suite y a la azotea con pileta, bar y telescopio, que abre el Estelario: el cielo de verdad de Buenos Aires, con 5044 estrellas, constelaciones, la Luna con su fase, los planetas, la Vía Láctea y el tiempo para adelantar), el Café Burbuja del pabellón y las casas de dos vecinos |

Además hay:

- doce misiones y diez discos escondidos que desbloquean canciones;
- la calidad arranca según el aparato (`js/aparato.js`: placa, memoria, núcleos, pantalla) y después se ajusta midiendo. Son cuatro: alta, media, baja y **mínima** (para los celus más flojos: sin sombras, sin brillo ni posproceso, sin barniz en los materiales, menos píxeles y lo lejano cortado detrás de la niebla, `js/detalle.js`); los shaders se compilan con la pantalla de carga puesta;
- menús con pestañas y páginas, pensados para entrar sin desplazar en un celu acostado;
- una barra de 5 lugares (burbujero, gestos, música, foto y mapa);
- día y noche iguales para todos: 5 minutos de día y 5 de noche, por el reloj;
- en el celu, un teclado propio de vidrio (acostado, con acentos, símbolos y emojis) y botones Frutiger con onda de luz;
- chat de voz por cercanía (botón 🎤): se escucha a los que están a menos de 12 m, del lado donde están y más bajo cuanto más lejos. Usa WebRTC y pide el micrófono; en el visor de artefactos no hay micrófono, así que ahí solo se escucha;
- animaciones por poses clave, estilo Roblox, en tres estilos para elegir en Opciones: suave, lineal y chop (a saltos, a 12 cuadros);
- en primera persona se ven los brazos, que acompañan cada movimiento, y mirando abajo el cuerpo y las piernas;
- los caminos de la isla sin nada que estorbe, y nada que se vea se atraviesa (`pruebas/choques.mjs` lo revisa en cada reino);
- efectos especiales (el gesto ✦ Poder: carga, estrella, destello, onda, grietas y un orbe con estelas) y el movimiento del video: al correr la cámara se inclina y tiembla, se saltan vallas solo, se suben paredes corriendo y se corre por las paredes;
- caminar y correr copiados del video que mandó quien pide, y deslizarse (C, Q o ⤓) siempre, caminando o parado, y sosteniéndolo se sigue deslizando;
- avisos arriba, chiquitos, estilo Windows 7 y con sus campanitas; las misiones se abren con el botón 📜 y en el parkour no queda nada que tape;
- siete estilos retro con el botón 👾: Normal, Pixel, PS1, Tele de tubo, Game
  Boy, 8 bits y VHS. Dibujan de verdad a baja resolución, así que además van
  más rápido;
- controles de dedo personalizables: mover, agrandar, transparencia, tipo de
  palanca, zurdos y vibración;
- las construcciones armadas en código (`js/construcciones.js`), copiando
  las referencias que se hicieron con Rezona: casa, estación, tienda, hotel,
  tren, fuente, bancos, faroles, árboles, palmeras y muebles.

## Probador, joyas, anuncios y compras

- En el probador, tocar lo que no se tiene **te lo probás** en el muñeco del
  estudio. Abajo aparece cuánto sale, con Comprar o Sacar, y el muñeco queda
  siempre a la vista del panel.
- **Joyas (💎)**: 10 de regalo por día. Nueve cosas nuevas cuestan de 100 a
  300: holográfico, diamante, arcoíris, tiara, anteojos estrella, alas de
  mariposa, capa de estrellas y destellos.
- **Anuncios con premio**: +5 💎 en la tienda, +30 orbes en el probador o
  duplicar lo ganado en un minijuego, hasta 5 por día.
- **Paquetes de joyas** y el de bienvenida (una sola vez).
- En TikTok Minis usa `TTMinis.createRewardedVideoAd` y `TTMinis.game.pay`.
  La página que envuelve el juego pone `window.AEROPLAZA_CAJA = { tiktok: {
  anuncio: 'id del bloque', servidor: 'https://…' } }`. El servidor crea la
  orden (`POST /orden`) y confirma la entrega (`GET /entrega?orden=`) cuando
  le llega el aviso de TikTok. Ese servidor no está en el repo.
- En el navegador todo va en **modo de prueba**: el anuncio es propio y la
  compra dice que no cobra nada.

## Modo VR

Pausa › 🥽 Modo VR: con visor de cartón (pantalla doble, SBS), sin visor, o
**Visor VR** si el navegador tiene uno (Meta Quest, Pico, la compu con visor).

- Se mira moviendo el celu, sin botones.
- Un toque camina o frena, o usa lo que haya cerca, y dos toques saltan.
- Para salir, mirar abajo 2 segundos, o Escape.
- En la compu se mira arrastrando.

**A lo que dé la pantalla (120 donde hay 120)**, sin bajar los gráficos
(`js/vr-dibujo.js`):

- El mundo se dibuja una vez, desde el medio de los ojos y con todos los
  efectos (brillo, color, viñeta). Cada ojo lo reproyecta con la cabeza de ese
  instante (*timewarp*) y con la profundidad (paralaje).
- Si el celu no llega, se dibuja partido: la mitad en un cuadro y la otra en
  el siguiente. La cabeza va a la velocidad de la pantalla.
- La pose del giroscopio se adelanta al momento en que se va a ver.
- Llave **⏱ Cuadros por segundo**: los muestra arriba de cada ojo, los de la
  cabeza y los del mundo.

**Manos como en Meta Quest** (llave **✋ Manos con la cámara**):

- La cámara de atrás del celu las sigue con MediaPipe en un worker. Se baja
  la primera vez, unos 20 MB, de jsdelivr y de Google; se puede servir desde
  otro lado con `window.AEROPLAZA_MANOS = { base, modelo }`.
- En el Visor VR son las manos del visor.
- **Usar:** el rayo sale del hombro; pellizcar (pulgar con índice) usa lo que
  se apunta.
- **Ir:** apuntando al piso sale un arco; al soltar el pellizco se salta ahí,
  con un parpadeo.
- **Menú:** la palma a la cara y un pellizco abren el menú (caminar, girar
  45°, FPS, salir). Se toca con la yema o con el rayo.
- **Tocar:** la yema del índice revienta burbujas y junta orbes.
- **Saltar:** dos pellizcos a la vez.

**Visor VR** (`js/vr-xr.js`, WebXR):

- Pide la frecuencia más alta hasta 120 Hz.
- **Controles:** palanca izquierda camina, la derecha gira 45°, el gatillo
  usa y A/X salta.

## El tráiler

`trailer/` arma el tráiler para TikTok: 61 s en 9:16 (1080×1920, 30 fps), con
cuatro canciones del juego cortadas en sus golpes. Todo lo que se ve es el juego
de verdad, grabado cuadro por cuadro con un reloj propio; el montaje y los
carteles (estilo Wii y Windows 7, como la interfaz) los hace Remotion.

```
node aeroplaza/herramientas/armar.mjs
node aeroplaza/trailer/grabar.mjs tomas      # ~1,5 h en SwiftShader (--vista: chiquitas, para encuadrar)
node aeroplaza/trailer/grabar.mjs audio      # necesita musica-ajena/ (no está en el repo)
node aeroplaza/trailer/grabar.mjs video      # → trailer/salida/aeroplaza-tiktok.mp4 y su portada
```

## Para tocarlo

- `node herramientas/armar.mjs [--dev]` arma `aeroplaza.html`. Si están los
  MP3 en `brillo/musica/` o en `musica-ajena/` (no se commitean), arma también
  `aeroplaza-con-canciones.html`.
- `node herramientas/assets.mjs` pasa lo de Rezona de `crudo/` a `assets/`
  (texturas, el cielo, las nubes y el delfín).
- `python3 herramientas/musica.py` cosía los temas de Rezona; ya no se usa
  (25/09: solo las canciones que manda quien pide).
- `pruebas/`:
  - `multijugador.mjs`: dos navegadores contra `broker.mjs`, un broker MQTT
    mínimo en Node puro;
  - `flujo.mjs [--movil]`: recorre las pantallas como una persona;
  - `reinos.mjs`: una foto de cada reino;
  - `rendimiento.mjs`: llamadas, triángulos y ms;
  - `canciones.mjs`: que solo estén y suenen las canciones de quien pide (y que sin ellas no suene nada);
  - `dedos.mjs`: toques de verdad, sin girar y girado;
  - `construcciones.mjs`: cada construcción de tres cuartos, para compararla
    con su referencia; `modelos.mjs`: cada una en 4 giros;
  - `muneco.mjs` y `fotos.mjs`: el muñeco en el probador y la isla;
  - `mundo.mjs [lugar,…]`: recorre las regiones con fotos y prueba el monorriel;
  - `menus.mjs`: que ninguna ventana se pase del alto (celu 844×390 y compu);
  - `vr120.mjs`: cada ojo reproyectado contra dibujarlo derecho, el
    timewarp, el dibujo partido, la predicción y el ritmo;
  - `manos.mjs`: las manos (filtro, pellizco, rayo, arco, menú, burbujas) y
    MediaPipe de verdad con las fotos de `pruebas/manos/` (hechas con Rezona);
  - `manos-celu.mjs`: las manos por la cámara con el atraso y las fallas de un
    celu, simuladas sin navegador (que no titilen, no se dupliquen ni peguen
    tirones);
  - `xr.mjs`: el Visor VR con IWER, el Quest 3 de mentira de Meta.

  MediaPipe e IWER se bajan con curl la primera vez y no se commitean.
- En la dirección:
  - `?directo`: saltea los menús;
  - `?reino=aqua`: arranca en ese reino;
  - `?broker=ws://…`: usa otro broker;
  - `?calidad=baja`: fija la calidad;
  - `?hora=0.5`: fija la hora del día;
  - `?giro=no|normal|reves`: el giro del celu parado;
  - `?sinInstanciar`: sin juntar las copias de un mismo modelo (para comparar).
- Las trampas que ya se pagaron están en `memoria/aeroplaza.md`.
