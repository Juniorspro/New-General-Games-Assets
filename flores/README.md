# Flores amarillas — diez regalos para Leonelita

Diez páginas sueltas para el 21 de septiembre. Cada una es **un archivo HTML
solo**: se abre con doble clic, anda sin internet y se manda por WhatsApp o
Telegram tal cual está. Ninguna pide una imagen, una fuente ni un script de
afuera — eso lo comprueba la prueba automática, no es una promesa.

Cada una tiene **su propio estilo y su propia mecánica**. No es la misma página
diez veces con otro color.

| | archivo | estilo | qué se hace |
|---|---|---|---|
| 1 | `01-ramo-infinito.html` | acuarela sobre papel crema | arrastrar el dedo y plantar flores; cada una dice algo |
| 2 | `02-lluvia-de-petalos.html` | papel de carta con renglones | atajar pétalos con el florero; cada uno escribe un renglón |
| 3 | `03-raspa-y-descubri.html` | tarjeta dorada sobre bordó | raspar el dorado con el dedo hasta que aparece el mensaje |
| 4 | `04-constelacion.html` | cielo de noche | unir las estrellas **en orden** hasta que se dibuja una flor |
| 5 | `05-jardin-pixel.html` | pixel art, grilla de 4 px | **mantener** el dedo para regar; cada flor que abre trae un recuerdo |
| 6 | `06-memotest.html` | mesa de paño verde | ocho pares, y cada par es una razón |
| 7 | `07-maquina-de-escribir.html` | sepia, monoespaciada | cualquier tecla saca una letra: la carta la escribe ella |
| 8 | `08-burbujas.html` | vidrio y neón violeta | reventar la que brilla; se va armando el poema |
| 9 | `09-laberinto.html` | line art, trazo a mano | llevar la flor hasta el corazón sin cruzar paredes |
| 10 | `10-caja-de-musica.html` | art déco, dorado sobre verde | dar cuerda: **la única que suena una melodía de verdad** |

## Decisiones que no se ven

- **La 5 se riega sosteniendo, no tocando.** Un jardín que crece a toques premia
  apretar rápido; sosteniendo, la única forma de que crezca es quedarse.
- **La 4 y la 8 van en orden y marcan cuál sigue.** Dejando tocar cualquiera, la
  frase se arma desordenada y no dice nada; con una sola marcada no hay que
  explicar nada, se ve.
- **La 6 no cuenta errores ni tiempo.** Es un regalo, no una prueba.
- **La 3 se destapa sola pasado el 55 %.** El último pedazo es limpieza sin
  premio: el mensaje ya se leyó.
- **Sólo la 10 tiene música.** Las demás suenan poco o nada a propósito: diez
  páginas que arrancan a sonar todas juntas cansan a la tercera.

## Las pruebas

```
node pruebas/todas.mjs .
```

Abre las diez en Chromium, hace avanzar cada mecánica por la sonda `window.__flores`
y comprueba que el estado cambió. **Que abra sin tirar error no alcanza**: una
página que carga y cuya mecánica no avanza se ve idéntica en una captura.

Medido, no estimado: **23 de 23**.

Dos cosas las encontró la prueba y no el ojo:

- En la **9** la flor no podía moverse en horizontal. `intentar()` probaba los
  dos ejes en un bucle y en cada vuelta asignaba las dos coordenadas, así que la
  vuelta del eje Y le devolvía a X el valor viejo y deshacía el movimiento. Se
  veía como un laberinto difícil.
- En la **5** el cielo se cortaba en el 55 % del alto y de ahí hasta la tierra no
  se pintaba nada: **8960 píxeles de 32000**, el 28 % del lienzo, quedaban del
  color del fondo de la página, y las flores crecían dentro de ese pozo. La
  sonda daba bien igual, porque las flores sí abrían. Por eso ahora se mira el
  lienzo además del contador.
