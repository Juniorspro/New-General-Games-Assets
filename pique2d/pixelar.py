#!/usr/bin/env python3
"""Convierte una hoja de fotogramas en PIXEL ART DE VERDAD.

    python3 pixelar.py <entrada.webp> <salida.webp> <cols> <filas> <ancho de celda>

QUE QUIERE DECIR "DE VERDAD". Los fotogramas del video son dibujo digital
suave: degrades finos, bordes con antialias, miles de colores. Achicarlos y
listo NO los hace pixel art — los hace una foto chiquita y borrosa, que al
lado de los sprites del juego canta. El pixel art tiene dos propiedades
medibles y esta herramienta las impone las dos:

  1. UN PIXEL ES UN PIXEL. Se achica con NEAREST, no con LANCZOS ni bilineal:
     cada pixel de salida es UN pixel del original, sin promediar con los
     vecinos. Promediando salen medios tonos en los bordes, que es justo lo
     que el pixel art no tiene. Antes de achicar se pasa un suavizado corto
     —ahi si promediando— para que el NEAREST no agarre justo el pixel de
     ruido; eso es remuestreo con prefiltro, y es lo que hace la diferencia
     entre una imagen achicada y una dibujada.

  2. UNA SOLA PALETA CORTA PARA TODA LA ANIMACION. Se reduce a N colores con
     corte por mediana y sin tramado: el tramado imita tonos que no existen
     salpicando pixeles, y a esta escala se lee como suciedad. Sin tramado
     quedan manchas planas, que es como se ve un dibujo hecho pixel por pixel.

     Y la paleta se saca de la HOJA ENTERA, no de cada cuadro. Cuadro por
     cuadro, cada uno elige sus veinticuatro mejores colores y el mismo tono
     sale distinto en cuadros seguidos: la animacion TIRITA de color aunque
     el dibujo no se mueva. Con una sola paleta eso no puede pasar, y de paso
     la hoja pesa un tercio —se midio: 1138 KB por cuadro contra 383 con
     paleta unica, porque un archivo con menos colores distintos se comprime
     muchisimo mejor.

Despues se vuelve a agrandar por un numero ENTERO, tambien con NEAREST, para
que cada pixel del dibujo sea un bloque exacto de NxN en la pantalla. Agrandar
por un numero con coma parte los bloques y unos salen de 3 pixeles y otros de
4: es la falla que hace que un pixel art se vea "sucio" sin que se sepa por
que.
"""
import pathlib
import sys

from PIL import Image, ImageFilter


def achicar(im, ancho):
    alto = max(1, round(im.height * ancho / im.width))
    # Prefiltro: un desenfoque corto proporcional a cuanto se va a achicar.
    radio = max(0.5, im.width / ancho / 3)
    return im.filter(ImageFilter.GaussianBlur(radio)).resize((ancho, alto), Image.NEAREST)


def main():
    if len(sys.argv) < 5:
        raise SystemExit("uso: pixelar.py <entrada> <salida> <cols> <filas> [ancho] [colores] [zoom]")
    ent = pathlib.Path(sys.argv[1])
    sal = pathlib.Path(sys.argv[2])
    cols, filas = int(sys.argv[3]), int(sys.argv[4])
    anchoCelda = int(sys.argv[5]) if len(sys.argv) > 5 else 112
    colores = int(sys.argv[6]) if len(sys.argv) > 6 else 32
    zoom = int(sys.argv[7]) if len(sys.argv) > 7 else 2

    hoja = Image.open(ent).convert("RGB")
    cw, ch = hoja.width // cols, hoja.height // filas
    celdas = [achicar(hoja.crop((k * cw, f * ch, (k + 1) * cw, (f + 1) * ch)), anchoCelda)
              for f in range(filas) for k in range(cols)]
    pw, ph = celdas[0].size
    armada = Image.new("RGB", (pw * cols, ph * filas))
    for i, im in enumerate(celdas):
        armada.paste(im, ((i % cols) * pw, (i // cols) * ph))
    # La paleta, de la hoja ENTERA y de una sola vez.
    armada = armada.quantize(colors=colores, method=Image.MEDIANCUT,
                             dither=Image.NONE).convert("RGB")
    salida = armada if zoom == 1 else armada.resize(
        (armada.width * zoom, armada.height * zoom), Image.NEAREST)
    sal.parent.mkdir(parents=True, exist_ok=True)
    # Sin perdida: a esta altura la imagen tiene 32 colores y bloques planos.
    # Comprimirla con perdida le volveria a meter medios tonos en los bordes,
    # que es exactamente lo que se acaba de sacar — y ademas pesa MAS, porque
    # WebP sin perdida come manchas planas para el desayuno. Se midio.
    sal_lossless = sal.with_suffix(".webp")
    salida.save(sal_lossless, "WEBP", lossless=True, method=6)
    print(f"celda {cw}x{ch} → {pw}x{ph} de {colores} colores, mostrada a x{zoom}")
    print(f"→ {sal_lossless} ({sal_lossless.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
