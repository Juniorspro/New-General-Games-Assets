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
- La música de este archivo es sintetizada. La versión con las canciones que
  mandó quien pide (el menú de Wii Party y Mii Maker) es
  `aeroplaza-con-canciones.html`. No está en el repo, que es público: se arma
  en la máquina que tenga los MP3.

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
| Plaza | lago, globo con cascada, peceras, estación hexagonal, Aero·Mart, probador, huerta de frutas con poderes, fuente de burbujas manejables, ciudad de vidrio |
| Aqua | hotel en la playa, palmeras, islotes, delfines para montar, carrera de 10 aros, arrecife con aros hundidos |
| Aurora | noche con aurora, cristales, lago de hielo, delfines que vuelan por aros dorados, estrellas que caen, el cristal del sueño colectivo |
| Jardín de géiseres | nenúfares que se pisan, lotos, géiseres que soplan, flores gigantes que rebotan |
| Aero·Mart | la tienda por dentro, con vitrinas y Menta |
| Mi casa | una isla entre las nubes con 16 muebles para poner |

Además hay:

- ocho misiones y seis discos escondidos que desbloquean canciones;
- una barra de 5 lugares (burbujero, gestos, música, foto y mapa);
- día y noche sincronizados para todos, por el reloj;
- siete estilos retro con el botón 👾: Normal, Pixel, PS1, Tele de tubo, Game
  Boy, 8 bits y VHS. Dibujan de verdad a baja resolución, así que además van
  más rápido;
- controles de dedo personalizables: mover, agrandar, transparencia, tipo de
  palanca, zurdos y vibración.

## Para tocarlo

- `node herramientas/armar.mjs [--dev]` arma `aeroplaza.html`. Si están los
  MP3 en `brillo/musica/`, arma también `aeroplaza-con-canciones.html`.
- `node herramientas/assets.mjs` pasa lo de Rezona de `crudo/` a `assets/`.
- `pruebas/`:
  - `multijugador.mjs`: dos navegadores contra `broker.mjs`, un broker MQTT
    mínimo en Node puro;
  - `flujo.mjs [--movil]`: recorre las pantallas como una persona;
  - `reinos.mjs`: una foto de cada reino;
  - `rendimiento.mjs`: llamadas, triángulos y ms;
  - `canciones.mjs`: comprueba las canciones.
- En la dirección:
  - `?directo`: saltea los menús;
  - `?reino=aqua`: arranca en ese reino;
  - `?broker=ws://…`: usa otro broker;
  - `?calidad=baja`: fija la calidad;
  - `?hora=0.5`: fija la hora del día.
- Las trampas que ya se pagaron están en `memoria/aeroplaza.md`.
