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
- Cada reino tiene su tema, hecho con Rezona (`musica/`). La versión con las
  canciones que mandó quien pide (el menú de Wii Party y la plaza de Mii
  Maker) es `aeroplaza-con-canciones.html`. No está en el repo, que es
  público: se arma en la máquina que tenga los MP3.
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
| Plaza | lago con medusas, globo con cascada, peceras, estación y tren, Aero·Mart, probador, barrio de casas (la tuya lleva a Mi casa), huerta de frutas con poderes, fuente de burbujas manejables, hoteles en islotes, arcoíris y la ciudad de vidrio |
| Aqua | hotel en la playa, palmeras, islotes, medusas, delfines para montar, carrera de 10 aros, arrecife con aros hundidos |
| Aurora | noche con aurora, cristales, lago de hielo, delfines que vuelan por aros dorados, estrellas que caen, el cristal del sueño colectivo |
| Jardín de géiseres | nenúfares que se pisan, lotos, flores de agua gigantes, géiseres que soplan, flores que rebotan |
| Aero·Mart | la tienda por dentro, con vitrinas y Menta |
| Mi casa | una isla entre las nubes, con la casa y 16 muebles para poner |

Además hay:

- ocho misiones y seis discos escondidos que desbloquean canciones;
- una barra de 5 lugares (burbujero, gestos, música, foto y mapa);
- día y noche sincronizados para todos, por el reloj;
- siete estilos retro con el botón 👾: Normal, Pixel, PS1, Tele de tubo, Game
  Boy, 8 bits y VHS. Dibujan de verdad a baja resolución, así que además van
  más rápido;
- controles de dedo personalizables: mover, agrandar, transparencia, tipo de
  palanca, zurdos y vibración;
- las construcciones armadas en código (`js/construcciones.js`), copiando
  las referencias que se hicieron con Rezona: casa, estación, tienda, hotel,
  tren, fuente, bancos, faroles, árboles, palmeras y muebles.

## Para tocarlo

- `node herramientas/armar.mjs [--dev]` arma `aeroplaza.html`. Si están los
  MP3 en `brillo/musica/`, arma también `aeroplaza-con-canciones.html`.
- `node herramientas/assets.mjs` pasa lo de Rezona de `crudo/` a `assets/`
  (texturas, el cielo, las nubes y el delfín).
- `python3 herramientas/musica.py` cose las tomas de 10 s de Rezona en un tema
  por reino, con su bucle.
- `pruebas/`:
  - `multijugador.mjs`: dos navegadores contra `broker.mjs`, un broker MQTT
    mínimo en Node puro;
  - `flujo.mjs [--movil]`: recorre las pantallas como una persona;
  - `reinos.mjs`: una foto de cada reino;
  - `rendimiento.mjs`: llamadas, triángulos y ms;
  - `canciones.mjs`: comprueba las canciones y los temas de cada reino;
  - `dedos.mjs`: toques de verdad, sin girar y girado;
  - `construcciones.mjs`: cada construcción de tres cuartos, para compararla
    con su referencia; `modelos.mjs`: cada una en 4 giros;
  - `muneco.mjs` y `fotos.mjs`: el muñeco en el probador y la isla.
- En la dirección:
  - `?directo`: saltea los menús;
  - `?reino=aqua`: arranca en ese reino;
  - `?broker=ws://…`: usa otro broker;
  - `?calidad=baja`: fija la calidad;
  - `?hora=0.5`: fija la hora del día;
  - `?giro=no|normal|reves`: el giro del celu parado.
- Las trampas que ya se pagaron están en `memoria/aeroplaza.md`.
