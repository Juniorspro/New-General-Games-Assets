# Los 13 idiomas (08/10)

Pedido: "add these 13 languages to your games: Brazil, Egypt, Indonesia, Iraq, Japan, Myanmar,
Mexico, Malaysia, Philippines, Pakistan, Saudi Arabia, Thailand, Türkiye… a language option
instead of a popup… a los zip y sacarles mi intro". Hecho en los 5 de los zip: SALAMANCA,
FILETE, NEBULOSA, TAJO y DORADO. Los demás juegos siguen con el cartel de 3 idiomas.

## Países → idiomas (13 opciones)

es (Argentina) · es-MX (México, tuteo) · en · pt (Brasil) · ar (Egipto, Irak y Arabia Saudita:
el árabe estándar) · id · ms · fil · tr · ur (Pakistán) · th · my (Myanmar) · ja.

## Cómo está armado

- `motor2d/idiomas.js`: la lista (`IDIOMAS`, cada nombre en su idioma), `idiomaInicial(guardado)`:
  el guardado o el del celu (es-AR/UY/PY → es, el resto del español → es-MX, tl → fil, in → id,
  si no, en). `escrituraDe(str)` (arab/thai/mymr/jpan/latn), letras del sistema por escritura
  (`fuenteEscritura`, urdu con su lista), `escalaEscritura` (árabe ×1.18, thai ×1.12, ja ×0.92),
  `partirMedido` (ja/th/my no separan con espacios: `Intl.Segmenter`), `dibujarGlobo` y `globoPx`.
- Sin cartel al arrancar: el juego entra al menú en el idioma del celu; botón IDIOMA con el
  globito → lista de los 13 (el puesto, resaltado) → se guarda en `<juego>.idioma`.
- Traducciones en `<juego>/js/idiomas.js`, después de `base.js`:
  `TXT['es-MX'] = Object.assign({}, TXT.es, {…tuteo})` y `Object.assign(TXT, {ar, id, …})`.
  `tr()` cae a en → es → la clave. México: tuteo, "pilón" por "yapa", "chido" por "groso".
  SALAMANCA: `CARTAS_IDIOMA` y `ALTAR_IDIOMA` con `[nombre, descripción]` (null = la original).
- Lienzo liso (TAJO, DORADO, NEBULOSA): `font` según la escritura, `direction='rtl'` en árabe y
  urdu (y volver a 'ltr'), sin `letterSpacing` ni cursiva fuera del latín; DORADO dibuja lo que
  la letra Limelight no tiene con serifa del sistema y el mismo dorado.
- Píxeles (SALAMANCA, FILETE): el lienzo va a la resolución real, `RES = clamp(floor(esc), 1, 4)`,
  `lienzo.width = W * RES`, `g.setTransform(RES,0,0,RES,0,0)` cada cuadro y `ESCALA_TEXTO = RES`:
  los píxeles quedan iguales y lo que la fuente de píxeles no tiene (`esPx` en `motor2d/fuente.js`)
  sale con `lienzoSis` nítido. El turco va en píxeles (se sumaron Ş Ğ İ Ö). Los lienzos que se
  guardan con texto (las cartas de SALAMANCA) se hacen a `W*RES` con `scale(RES)`.
  Renglones: `pasoRenglon(str, base)` (la letra del sistema pide 12); títulos al doble solo si entran.
- Intro: afuera en los 5 (`intro.js` borrados; SALAMANCA usaba el iris solo después de la intro).
  Queda el crédito JXSTUDIOS chico en los menús, el sello "JX" de TAJO y la moneda de las portadas.

## Probar

`node herramientas/idiomas/probar.mjs <juego> todos "menu,idioma,…"` (pasos en `escenas.json`;
`DPR=3` para los de píxeles; letras de prueba en `$FUENTES`, ver la cabecera) y
`python3 herramientas/idiomas/hoja.py` arma la hoja. Marca errores y textos fuera de pantalla;
los carteles que entran deslizándose dan falso "fuera". Resultado del 08/10: los 5 juegos,
13 idiomas, 0 errores.

## Empaquetar

`herramientas/empaquetar_juegos.py`: los 5 dicen "13 idiomas" (`IDIOMAS_13` en el LEEME) y del
`motor2d/` va solo lo que arma el `juego.json` (así no viaja la intro que no usan).
