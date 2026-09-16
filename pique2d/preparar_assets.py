#!/usr/bin/env python3
"""Convierte lo que bajo de Rezona en lo que carga el juego.

    python3 preparar_assets.py            # todo lo que cambio
    python3 preparar_assets.py fauces_morder fondo_llano_cielo
    python3 preparar_assets.py --todo     # de nuevo aunque no haya cambiado

EXISTE PORQUE ESTE PASO SE HACIA A MANO. El servidor entrega PNG de un mega
cada uno con nombre versionado (`fauces_morder-g5.png`) y el juego carga webp
con nombre fijo en carpetas por tipo (`assets/hojas/fauces_morder.webp`). En
el medio hay que despegar el fondo, achicar a la medida de cada tipo y
comprimir. Hecho a mano una vez funciona; hecho a mano la quinta vez alguien
se olvida de una hoja y el juego carga un sprite viejo sin que nada avise.

Las medidas de destino NO son gusto, salen de cuanto se estira cada cosa en
pantalla (el juego dibuja a 2x la resolucion logica, ver ESC en mundo.js):

  hoja   1024 -> 512   = 128 px por cuadro para dibujar un bicho de 20 a 52
                         pixeles de juego, o sea 40 a 104 de lienzo. Sobra.
  fondo  ancho 1024    = el fondo cubre 1,7 pantallas; a 640 se veia estirado
                         en el lienzo grande. Es lo que mas se agranda de todo.
  tubo   256           = estaba en 64 y se notaba: un tubo mide dos tiles de
                         ancho por hasta cuatro de alto, o sea 128x256 de
                         lienzo sacados de una imagen de 64. Se veia borroso.
  tile   256           = se vuelve a achicar a 32 en el navegador para el
                         patron, asi que de aca solo importa que no falte.
"""
import json, pathlib, subprocess, sys
from PIL import Image

AQUI = pathlib.Path(__file__).parent
REG = AQUI / "assets" / "hojas.json"
sys.path.insert(0, str(AQUI))
import generar_sprites as G
import despegar_fondo as DF


def destino(clave):
    """Donde va cada clave y como se achica. None = no se toca."""
    if clave in G.HOJAS or clave in G.OBJETOS:
        return ("hojas", clave, (512, 512), True)
    if clave.startswith("fondo_"):
        _, tema, capa = clave.split("_", 2)
        # El cielo es opaco y llena la pantalla; las otras dos son recortes.
        return ("fondo", f"{tema}_{capa}", (1024, None), capa != "cielo")
    if clave.startswith("tile_"):
        return ("tile", clave[5:], (256, 256), False)
    # Las piezas se enumeran DEL DICCIONARIO y no por prefijo. Con prefijos,
    # `plataforma` no empezaba con "tubo_" ni con "icono_": se bajo, se pago y
    # se quedo afuera sin que nada avisara, y el juego siguio dibujando la
    # barra de color plano.
    if clave in G.PIEZAS:
        # Ancho fijo y alto por proporcion: la plataforma es ancha y baja, y
        # forzada a cuadrada se aplastaba.
        return ("piezas", clave, (256, None), True)
    if clave == "logo":
        return (".", "logo", (592, None), True)
    if clave in ("portada", "titulo_fondo"):
        return (".", clave, (720, None), False)
    return None


def opacidad(im):
    """Que fraccion de la imagen no es transparente. Es la medida con la que
    pruebas/assets.py rechaza una hoja: arriba de 0,90 el fondo quedo pegado y
    en pantalla el bicho sale adentro de un cuadrado de color."""
    h = im.convert("RGBA").split()[3].histogram()
    return sum(h[25:]) / max(1, sum(h))


def recortar_alfa(im):
    """Saca el margen transparente. Una imagen suelta con margen se dibuja
    mas chica de lo pedido, porque el margen cuenta como parte del alto."""
    caja = im.getbbox()
    return im.crop(caja) if caja else im


def preparar(clave, origen, forzar=False):
    d = destino(clave)
    if not d:
        return None
    carpeta, nombre, (aw, ah), con_alfa = d
    salida = AQUI / "assets" / carpeta / f"{nombre}.webp"
    salida.parent.mkdir(parents=True, exist_ok=True)
    src = AQUI / origen
    if not src.exists():
        return f"✗ {clave}: falta {origen}"
    if not forzar and salida.exists() and salida.stat().st_mtime >= src.stat().st_mtime:
        return None

    im = Image.open(src).convert("RGBA")
    # Despegar el fondo llave ANTES de achicar: despues de interpolar, el
    # color llave ya se mezclo con el borde del dibujo y deja un halo.
    if con_alfa:
        # Dos pasos, encadenados en memoria. El primero mira las esquinas de
        # cada celda y borra el fondo plano; el segundo borra el color llave
        # este donde este, que es el caso de la hoja que salio con el recuadro
        # magenta ADENTRO de la celda y las esquinas limpias.
        cols, filas = (4, 4) if (clave in G.HOJAS or clave in G.OBJETOS) else (1, 1)
        r = DF.despegar(src, cols, filas)
        if r:
            im = r[0]
        im = im.copy()
        # Las lineas de division PRIMERO. Si quedan, el anillo opaco del borde
        # hace que el despegado por esquinas crea que toda la celda es fondo.
        rb = DF.borrar_bordes(im, cols, filas) if (clave in G.HOJAS or clave in G.OBJETOS) else None
        if rb:
            im = rb[0]
        r2 = DF.sacar_llave_im(im)
        if r2:
            im = r2[0]
        # Y el tercero solo si hace falta. La inundacion es cara —recorre cada
        # celda pixel por pixel— y no tiene sentido pagarla en una hoja que ya
        # quedo limpia con los dos pasos de antes.
        if opacidad(im) > 0.70:
            r3 = DF.despegar_halo(im, cols, filas)
            if r3:
                im = r3[0]
    if carpeta == "piezas" or clave == "logo":
        im = recortar_alfa(im)
    if ah is None:
        ah = max(1, round(im.height * aw / im.width))
    im = im.resize((aw, ah), Image.LANCZOS)
    if not con_alfa:
        fondo = Image.new("RGB", im.size, (0, 0, 0))
        fondo.paste(im, mask=im.split()[3])
        im = fondo
    # NO SE PISA UNA HOJA BUENA CON UNA PEOR. El servidor entrega a veces el
    # PNG con el fondo a medio recortar, y el despegado por esquinas no puede
    # arreglarlo cuando las esquinas YA vienen transparentes y lo opaco esta
    # en el medio. Sin esta comprobacion, volver a correr este script pisaba
    # dos hojas que ya estaban bien con la version rota del PNG —y el juego
    # dibujaba al bicho adentro de un cuadrado— sin que nada avisara. Pasar
    # por arriba de contenido bueno en silencio es peor que no hacer el paso.
    if con_alfa and salida.exists():
        antes = opacidad(Image.open(salida))
        ahora = opacidad(im)
        if ahora > 0.90 and ahora > antes + 0.02:
            return (f"✗ {clave:22} el PNG viene {ahora*100:.0f}% opaco y lo que hay "
                    f"esta en {antes*100:.0f}%: NO se pisa. Hay que regenerarlo.")
    # Calidad 80 y no 88. Se midio hoja por hoja: 88 costaba un 30% mas de
    # bytes y la diferencia no se ve, porque nada de esto se muestra a tamano
    # completo —un bicho de 256 pixeles se dibuja a 20—. Con los fondos nuevos
    # a 1024 el archivo unico se habia ido a 5,3 MB, y eso se paga de verdad
    # en un telefono. Lossless esta descartado por medicion: estos dibujos no
    # son pixel art indexado sino imagenes con mucho matiz, y sale al TRIPLE.
    im.save(salida, "WEBP", quality=80, method=6)
    return f"↻ {clave:22} → assets/{carpeta}/{nombre}.webp  {aw}x{ah}  {salida.stat().st_size // 1024} KB"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    forzar = "--todo" in sys.argv
    reg = json.loads(REG.read_text())
    hechos, saltados = [], 0
    for clave, v in sorted(reg.items()):
        if args and clave not in args:
            continue
        if not v.get("local") and not v.get("output_path"):
            continue
        msg = preparar(clave, v["output_path"], forzar)
        if msg:
            hechos.append(msg)
        else:
            saltados += 1
    for m in hechos:
        print("  " + m)
    print(f"  {len(hechos)} preparados · {saltados} sin cambios")
    return 1 if any(m.startswith("✗") for m in hechos) else 0


if __name__ == "__main__":
    sys.exit(main())
