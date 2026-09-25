# AEROPLAZA — undécima vuelta (26/09/2026): probador, joyas, anuncios, choques, VR y alta

Sigue de [aeroplaza-11](aeroplaza-11.md). Rama `claude/fijate-iszyer`.

## Lo que pidió

- Más mejoras en general.
- En la personalización se tapaba el muñeco.
- Previsualizar la ropa antes de comprarla.
- Joyas: 10 de regalo por día, y ropa que cuesta 100 o más en joyas.
- IAA e IAP (anuncios con premio y compras).
- No atravesar edificios ni cosas.
- Optimizar también la calidad alta.
- Un modo VR: primera persona con giroscopio, sin controles, con o sin SBS.

## Probador (`probador.js` + `ui.js › probador`)

- **Se tapaba** porque el corrimiento de la cámara era fijo (el 20 % del
  ancho) y el panel mide 460 px fijos: en pantallas angostas lo tapaba.
- Ahora `UI.libreProbador()` da lo que deja libre el panel (en píxeles
  lógicos, con `offsetLeft/Top`, que ya vienen girados) y el estudio:
  - centra ahí al muñeco con `setViewOffset`;
  - abre el campo para que entre entero con 2,3 m de alto y 1,9 de ancho
    (el arcoíris y las alas).
- El cartel del nombre no va en el estudio; en el mundo sube arriba de lo que
  lleve en la cabeza (`Meeple.altoNombre`, medido con la caja de los
  accesorios).
- **Probarse antes de comprar**:
  - tocar lo que no se tiene lo pone en el muñeco del estudio
    (`J.probarPuestos`), no en el del mundo ni en la red;
  - el borde del pedestal se pone dorado;
  - una barra abajo dice qué es, cuánto sale y da Comprar o Sacar. Si
    faltan orbes, ofrece un anuncio (+30); si faltan joyas, la tienda;
  - las joyas preguntan antes de gastarse;
  - al salir, lo no comprado se saca;
  - al comprar, festejo: chispas y un salto.

## Joyas y la ropa de joyas

- `G.joyas`, `G.regalo` (la fecha), `G.anuncios` (los de hoy) y
  `G.compras`, en `guardar.js`.
- El regalo lo da `joyas.js › regaloDelDia` al entrar: 10 por día, con aviso.
- `catalogo.js › PRECIO_JOYAS` tiene 9 cosas nuevas, de 100 a 300:
  - holográfico (tornasol grueso) y diamante (facetas: celdas con destellos
    que dependen de la vista, `uFacetas`);
  - motivo arcoíris (textura dibujada);
  - tiara y arcoíris en la cabeza;
  - anteojos estrella;
  - alas de mariposa y capa de estrellas (se levanta al correr);
  - destellos.
- La píldora 💎 del HUD abre la tienda. También se abre desde la pausa y
  desde la barra del probador.

## Anuncios y compras (`caja.js`, `joyas.js`)

- **Dos proveedores**:
  - `tiktok`: hay `window.TTMinis`;
  - `prueba`: en el navegador, un anuncio propio de 5 s y una compra que
    dice que no cobra nada.
- **Lo de TikTok** sale de la documentación (leída el 25/09):
  - anuncio: `TTMinis.createRewardedVideoAd({ adUnitId })`, `show()`
    (promesa) y `onClose(res)`, con `res.isEnded` para dar el premio;
    una instancia por anuncio;
  - compra: el servidor propio crea la orden (`POST
    open.tiktokapis.com/v2/minis/trade_order/create/`, con el token del
    usuario), el juego paga con `TTMinis.game.pay({ trade_order_id,
    success, fail })` y lo entrega el servidor cuando le llega el webhook;
  - el login da el código para el token. La forma de lo que devuelve no
    está verificada.
- **La configuración va en `window.AEROPLAZA_CAJA`**, nunca en el repo:
  `{ tiktok: { anuncio, servidor } }`. El contrato del servidor propio:
  `POST /orden` → `{ trade_order_id, orden }` y `GET /entrega?orden=` →
  `{ entregado, joyas, orbes }`. **El servidor no está hecho**: sin él, las
  compras en TikTok dicen que no están disponibles.
- **Topes**: 5 anuncios por día en total (+5 💎 en la tienda, +30 orbes en
  el probador o duplicar lo ganado en un minijuego).
- **Paquetes**: 100; 500 + 50; 1000 + 200; y la bienvenida (300 💎 y 500
  orbes, una sola vez).

## Choques (`pruebas/choques.mjs`)

- **La prueba**: rayos horizontales contra cada cosa dibujada, más un
  muñeco que camina por el mismo rayo. Se compara dónde lo frenan los
  sólidos con dónde toca lo dibujado. Lo que se atraviesa a propósito lleva
  `userData.pasa` (orbes, burbujas, portales, aros, peces, medusas, la
  pelota, los chorros, las botellas).
- **Lo que se atravesaba**:
  - **los hoteles**: el sólido era solo la torre, y el zócalo de 0,8 m, el
    césped, las macetas y la marquesina se cruzaban. Ahora todo es sólido
    (`plaza.js › solidosHotel`, el superelipse con dos cajas y cuatro
    cilindros), y hay una escalinata nueva;
  - reposeras, estantes de la tienda, el espejo del probador, corales, pinos
    de hielo y sillas de las mesas (el sólido se apaga mientras uno está
    sentado);
  - sillón, tele, lámpara, heladera y macetas de los interiores;
  - los vagones del monorriel: sólidos que se mueven (`mundo.movil`), fuera
    de la rejilla.
- **El túnel**: deslizándose a más de 10 m/s, de un salto se metía más de la
  mitad en una pared fina y el empujón lo sacaba del otro lado. Ahora se
  avanza de a medio radio (`jugador.js`). La prueba: a 12 m/s y 10 cuadros
  por segundo contra 16 cm; antes cruzaba.

## Modo VR (`vr.js`)

- **Cómo se entra**: Pausa › 🥽 Modo VR, con visor (SBS) o sin.
- **La cámara es la del celu**: DeviceOrientation pasado a cuaternión, con el
  giro de la pantalla. Si el juego está girado por CSS, ese giro cuenta como
  si la pantalla estuviera acostada.
- **El toque**:
  - uno camina o frena, o usa lo que haya cerca;
  - dos saltan;
  - mirar abajo 2 s sale;
  - en la compu se mira arrastrando;
  - Escape sale.
- **SBS**: `StereoCamera` (6,4 cm), las dos mitades dibujadas derecho, sin la
  cadena de efectos, y las sombras una vez por cuadro.
- Una ventana, una charla o el probador sacan del VR, porque son interfaz
  plana.
- En iOS el permiso del giroscopio se pide en el toque del botón.

## Alta más liviana (medida en SwiftShader, 1266×585)

- **Qué pesaba**:
  - brillo y sombras de 1024 casi no cambiaban nada;
  - sin sombras, −14 %;
  - el pasto a la mitad, −11 % (era lo más caro).
- **Lo que se hizo**:
  - pasto en dos capas: densa hasta 13 m, y rala y un 20 % más grande hasta
    26 m (`naturaleza.js › pastoDoble`);
  - sombras un cuadro sí y uno no en el celu (`sombraCada`);
  - la viga del monorriel en tramos de 40 m;
  - alcance por instanciado (`userData.alcance`): faroles a 160 m, bancos a
    90 m;
  - copas de lejos 7×5, burbujas 16×12, terreno de la plaza en 256.
- **Resultado**: de ~1500 a 1297 ms por cuadro, y de 2,58 a 2,12 millones de
  triángulos. En la captura no se nota.

## Trampas de esta vuelta

- **Un `//` en una línea con más código después** se comió el resto: esbuild
  dio "Expected )". En las líneas largas va `/* */`.
- **`if (!this.q0)` con un rumbo de 0** lo recalculaba en cada cuadro: el
  giro de 30° daba 0°. Va `== null`.
- **El pasto tiene la caja de una mata en el origen**: `detalle.js` lo
  cortaba lejos del centro. Lleva `sinCorte`.
- **`detalle.js` le ponía la cantidad entera a lo que se corta solo** (las
  flores, 60 m) cuando notaba que se movía: durante medio segundo se
  dibujaban las 2600.
- **`modelo(n, { ancho })` escala por lo más ancho**: la escalinata alargó
  el hotel y lo achicaba. Va por `escala`.
- **El giroscopio de mentira tiene que coincidir con la pantalla**: la de
  Playwright en celu acostado está a 90°, así que mirar derecho es gama -90.
  Con beta 90 salía el horizonte vertical.
- **`git stash` y después armar**: el HTML armado con el código viejo no
  deja hacer `stash pop`. Primero `git checkout -- aeroplaza/aeroplaza.html`.
- **Achicar un sólido de hotel cambia los caminos**: dos quedaban contra el
  zócalo o el espejo. `pruebas/caminos.mjs` lo encontró y se corrieron.
- **La viga del monorriel junto a la terminal**: sus sólidos se salteaban a
  menos de 22 m de la terminal, y la rampa baja al foso se atravesaba. Ahora
  se saltean solo adentro (`enTerminal < 0,5`) y el foso tiene tapas en las
  puntas (`plaza.js`).
- **La prueba del flujo compraba con el `confirm` viejo**: con el probador
  nuevo se compra desde la barra (`.prob-prueba [data-a=comprar]`).

## Pruebas

- Nuevas:
  - `choques` (12): las fugas por reino y el túnel;
  - `joyas` (23): el regalo, probarse, comprar, el encuadre en cuatro
    pantallas, la tienda, el anuncio, TikTok falso y duplicar;
  - `vr` (14).
- `caminos` da bien después de correr dos caminos.
- `interiores`: "el telescopio abre el Estelario" contaba los nombres del
  cielo a la hora real y fallaba según cuándo se corriera (ya pasaba antes de
  esta vuelta). Ahora la prueba fija la hora (`Date.UTC(2026, 8, 26, 6)`) y
  el cielo quieto: 32 bien.
- `flujo` compra con la barra del probador: 14 bien.
