#!/usr/bin/env python3
"""Corta cada cuerpo entero en las seis piezas que usa el ragdoll.

    python3 cortar_cuerpos.py            # corta y guarda en assets/partes/
    python3 cortar_cuerpos.py contacto   # además deja una hoja para mirar

EL CORTE ES GEOMÉTRICO, no una negociación con un modelo. Ésa es toda la razón
de generar el cuerpo entero en vez de doce piezas sueltas: pedirle a un modelo
"un torso sin cabeza" devuelve un torso con un mechón de pelo colgando del
cuello, porque un torso suelto no es una imagen que exista y el modelo empuja
hacia lo que sí existe. Un cuerpo entero sale limpio, y dónde termina el cuello
lo decide un número, no la suerte.

Y DE AHÍ QUE LA POSE SEA UNA T: con los brazos en cruz cada miembro ocupa su
propia franja de la imagen y las separaciones se leen del alfa.

LO QUE SE DETECTA SOLO Y LO QUE VA A MANO. La banda de los brazos y el ancho
del torso se detectan: en la fila del medio de los hombros el alfa deja tres
manchas —brazo, torso, brazo— y las tres se miden. La altura de la cadera y de
la rodilla van a mano, una por personaje, porque no hay nada en el alfa que las
marque: el guardapolvo de Rilo le tapa medio muslo, así que el hueco entre las
piernas aparece mucho más abajo que la cadera real y detectarlo daría un torso
que llega a las rodillas.

SIN NUMPY. Está roto en esta máquina, y para esto no hace falta: Pillow tiene
getbbox() en C y una fila de 1024 píxeles se lee con getdata(). Una dependencia
menos que instalar para correr una herramienta del repo.
"""
import json, pathlib, sys
from PIL import Image

AQUI = pathlib.Path(__file__).parent
DESTINO = AQUI / "assets" / "partes"

# DÓNDE CORTAR, en fracciones de la caja de la figura. Están escritas a mano y
# leídas del dibujo con una grilla de porcentajes encima, no detectadas.
#
# La detección automática se intentó y se tiró: en una T-pose los brazos salen
# del torso, así que a la altura del hombro el alfa es UNA sola mancha de una
# punta de los dedos a la otra y no hay separación que encontrar; y la cadera
# de Rilo no está en ningún borde del alfa, porque el guardapolvo le tapa medio
# muslo. Son dos personajes y diez números: mirarlos una vez sale más barato y
# más confiable que un detector que hay que depurar.
#
#   cuello  → dónde termina la cabeza
#   hombro/axila → la franja horizontal donde están los brazos
#   cadera  → dónde termina el torso
#   rodilla → dónde se parte la pierna
#   torso_x → las dos columnas que encierran el tronco
#   mano_x/codo_x → la punta de los dedos y el codo, en columnas
CORTES = {
    # cabeza_extra: cuánto BAJA el corte de la cabeza por debajo del hombro.
    # A Tito la pera le cuelga sobre la remera, así que cortando justo en el
    # hombro se queda sin mentón.
    # limpiar: color a borrar del borde de arriba del torso, para la pera de
    # Tito que queda dentro de su propia pieza.
    "rilo": {"cadera": 0.740, "rodilla": 0.880, "torso_x": (0.355, 0.645),
             "codo_x": 0.210, "cabeza_extra": 0.0, "limpiar": None},
    "tito": {"cadera": 0.560, "rodilla": 0.800, "torso_x": (0.355, 0.645),
             "codo_x": 0.200, "cabeza_extra": 0.045, "limpiar": (245, 200, 165)},
}

# Alto máximo en píxeles de cada pieza guardada. Nada se dibuja más grande que
# unos 60 px en pantalla; guardar 1024 es pagar memoria por detalle invisible.
TOPE = 200


def mascarita(im, umbral=100):
    # UMBRAL ALTO A PROPÓSITO. El recorte de fondo del generador deja un halo
    # de alfa bajo por toda la imagen y, en el cuerpo de Rilo, una raya
    # horizontal fantasma que cruza los 1024 píxeles de ancho: invisible a ojo
    # y suficiente para que el recorte de la cabeza saliera de 1024 de ancho.
    return im.getchannel("A").point(lambda v: 255 if v > umbral else 0)


def fila(m, y):
    return m.crop((0, y, m.width, y + 1)).getdata()


def manchas(datos):
    """Los tramos contiguos de tinta en una fila: [(desde, hasta), ...]."""
    out, ini = [], None
    for i, v in enumerate(datos):
        if v and ini is None:
            ini = i
        elif not v and ini is not None:
            out.append((ini, i)); ini = None
    if ini is not None:
        out.append((ini, len(datos)))
    return out


def extension(m, y):
    caja = m.crop((0, y, m.width, y + 1)).getbbox()
    return (caja[2] - caja[0]) if caja else 0


def banda_brazos(m, bb):
    """Las filas donde la figura es más ancha: los brazos en cruz."""
    x0, y0, x1, y1 = bb
    ext = [extension(m, y) for y in range(y0, y1)]
    tope = max(ext)
    anchas = [i for i, e in enumerate(ext) if e > tope * 0.8]
    return y0 + anchas[0], y0 + anchas[-1] + 1


def recortar(im, m, x0, y0, x1, y1):
    """Recortar a esa caja Y DESPUÉS al contenido real que quedó adentro.

    EL AJUSTE FINO SE MIDE SOBRE LA MÁSCARA, no sobre la imagen. Dos trampas,
    las dos costaron una vuelta:

    1. getbbox() sobre RGBA mira las CUATRO bandas, así que un píxel
       transparente con RGB distinto de cero cuenta como contenido — y los PNG
       del generador vienen llenos de eso.
    2. getbbox() sobre el alfa crudo tampoco alcanza: el recorte del fondo deja
       un halo de alfa 1 a 10 por toda la imagen, invisible a ojo y suficiente
       para que el recorte no recorte nada. Las cabezas salían de 1024 de ancho
       por 270 de alto.

    La máscara ya está umbralada en 40, así que mide lo que se ve.
    """
    caja = (max(0, x0), max(0, y0), min(im.width, x1), min(im.height, y1))
    fina = m.crop(caja).getbbox()
    if not fina:
        return im.crop(caja)
    return im.crop((caja[0] + fina[0], caja[1] + fina[1],
                    caja[0] + fina[2], caja[1] + fina[3]))


def escalar(im, tope=TOPE):
    lado = max(im.size)
    if lado <= tope:
        return im
    k = tope / lado
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def borrar_arriba(im, color, hasta, tol=62):
    """Borrar de la franja de arriba los píxeles de ese color.

    La pera de Tito cae sobre el cuello de la remera, así que el recorte del
    torso la trae adentro. Cortarlo más abajo dejaría al torso sin hombros y
    ahí sí se vería un agujero, porque los brazos se dibujan DETRÁS. Borrando
    el color de la piel del borde de arriba se va la pera y quedan los hombros.
    """
    im = im.copy()
    px = im.load()
    tope = int(im.height * hasta)
    for y in range(tope):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a > 20 and sum((c - d) ** 2 for c, d in zip((r, g, b), color)) ** 0.5 < tol:
                px[x, y] = (r, g, b, 0)
    caja = im.getchannel("A").getbbox()
    return im.crop(caja) if caja else im


def perfil(m, y0, y1):
    """El ancho de la figura fila por fila."""
    out = []
    for y in range(y0, y1):
        b = m.crop((0, y, m.width, y + 1)).getbbox()
        out.append((b[0], b[2]) if b else None)
    return out


def cortar(quien):
    cfg = CORTES[quien]
    im = Image.open(AQUI / "assets" / f"cuerpo_{quien}-g1.png").convert("RGBA")
    m = mascarita(im)
    x0, y0, x1, y1 = m.getbbox()
    an, al = x1 - x0, y1 - y0
    Y = lambda f: y0 + int(al * f)
    X = lambda f: x0 + int(an * f)

    # LA BANDA DE LOS BRAZOS SE DETECTA: son las únicas filas donde la figura
    # pasa la mitad del ancho total, porque están en cruz. Esto sí es fiable y
    # no hace falta escribirlo a mano — y encima se acomoda solo si alguna vez
    # se regenera el dibujo con otra pose.
    pf = perfil(m, y0, y1)
    anchos = [(b[1] - b[0]) if b else 0 for b in pf]
    y_hombro = y0 + next(i for i, a in enumerate(anchos) if a > an * 0.5)
    y_axila = y1 - next(i for i, a in enumerate(reversed(anchos)) if a > an * 0.5)

    # LAS COLUMNAS DE LA CABEZA TAMBIÉN: es lo más ancho que hay arriba de los
    # brazos. Sin esto, el recorte de la cabeza agarraba el ancho entero de la
    # figura —porque la primera fila de brazos entra en la caja— y la pieza
    # salía de 776 píxeles de ancho por 322 de alto.
    arriba = [b for b in pf[:y_hombro - y0] if b]
    cx0 = min(b[0] for b in arriba) - 4
    cx1 = max(b[1] for b in arriba) + 4

    y_cadera, y_rodilla = Y(cfg["cadera"]), Y(cfg["rodilla"])
    tx0, tx1 = X(cfg["torso_x"][0]), X(cfg["torso_x"][1])
    codo = X(cfg["codo_x"])

    piezas = {
        "cabeza": recortar(im, m, cx0, y0, cx1,
                           y_hombro + 2 + int(al * cfg["cabeza_extra"])),
        "torso": recortar(im, m, tx0, y_hombro - 2, tx1, y_cadera),
        # El brazo está horizontal en el dibujo y vertical en el juego: se rota
        # 90° para que el hombro quede ARRIBA, que es la convención del dibujo.
        # Se usa UN solo brazo para los dos lados: son simétricos y el ragdoll
        # los rota igual, así que la segunda pieza sería el mismo dibujo
        # espejado ocupando otros cinco kilobytes.
        # LA ROTACIÓN VA EN +90 Y NO EN −90. En el dibujo el brazo apunta a la
        # izquierda: el hombro está en el borde DERECHO del recorte y los dedos
        # en el izquierdo. Girando −90 (horario) el borde derecho cae abajo y
        # la pieza queda dada vuelta — el hombro en los dedos. Se veía como un
        # antebrazo con la mano saliendo del codo.
        "brazo_alto": recortar(im, m, codo, y_hombro, tx0 + 6, y_axila).rotate(90, expand=True),
        "brazo_bajo": recortar(im, m, x0, y_hombro, codo + 6, y_axila).rotate(90, expand=True),
    }
    # LAS COLUMNAS DE LA PIERNA SE MIDEN ABAJO, donde las dos están separadas.
    # Arriba no se puede: a la altura del muslo las piernas se tocan —y en Rilo
    # encima las tapa el guardapolvo— así que cortar "la mitad izquierda de la
    # figura" traía medio abrigo y la otra pierna.
    if cfg["limpiar"]:
        piezas["torso"] = borrar_arriba(piezas["torso"], cfg["limpiar"], 0.30)
    ms = [a for a in manchas(fila(m, y1 - int(al * 0.06))) if a[1] - a[0] > an * 0.03]
    pierna = ms[0] if ms else (x0, X(0.5))
    hol = int(an * 0.015)
    piezas["pierna_alta"] = recortar(im, m, pierna[0] - hol, y_cadera, pierna[1] + hol, y_rodilla + 4)
    piezas["pierna_baja"] = recortar(im, m, pierna[0] - hol, y_rodilla - 4, pierna[1] + hol, y1)

    # Las medidas del dibujo, en fracciones de la altura de la figura: de acá
    # sale el esqueleto del juego, así que el muñeco armado tiene las
    # proporciones del dibujo original en vez de las que alguien tipeó.
    f = lambda px: round(px / al, 4)
    medidas = {
        "figura": [an, al],
        "cabeza": f(y_hombro - y0), "torso": f(y_cadera - y_hombro),
        "muslo": f(y_rodilla - y_cadera), "canilla": f(y1 - y_rodilla),
        "brazo_alto": f(tx0 - codo), "brazo_bajo": f(codo - x0),
        "hombro_ancho": f(tx1 - tx0),
    }
    return piezas, medidas


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    medidas, total = {}, 0
    for quien in CORTES:
        piezas, info = cortar(quien)
        medidas[quien] = {"medidas": info, "piezas": {}}
        for nombre, im in piezas.items():
            im = escalar(im)
            f = DESTINO / f"{quien}_{nombre}.webp"
            im.save(f, "WEBP", quality=90, method=6)
            kb = f.stat().st_size / 1024
            total += kb
            medidas[quien]["piezas"][nombre] = list(im.size)
            print(f"  {quien}_{nombre:12} {im.size[0]:4}x{im.size[1]:<4} {kb:5.1f} KB")
        print(f"  {quien}: {info}")
    (AQUI / "assets" / "medidas.json").write_text(json.dumps(medidas, indent=1))
    escribir_medidas(medidas)
    print(f"\n  {total:.0f} KB en piezas")

    if len(sys.argv) > 1 and sys.argv[1] == "armado":
        fs = [armar(q, medidas) for q in CORTES]
        h = Image.new("RGBA", (sum(f.width for f in fs) + 30, max(f.height for f in fs)),
                      (36, 42, 58, 255))
        x = 0
        for f in fs:
            h.alpha_composite(f, (x, 0)); x += f.width + 30
        h.save("/tmp/armado.png")
        print("  armado en /tmp/armado.png")

    if len(sys.argv) > 1 and sys.argv[1] == "contacto":
        from PIL import ImageDraw
        cel = 210
        # Fondo oscuro: con fondo blanco, el guardapolvo blanco de Rilo se lee
        # como una pieza vacía y parece un error que no existe.
        h = Image.new("RGBA", (6 * cel, 2 * (cel + 18)), (36, 42, 58, 255))
        d = ImageDraw.Draw(h)
        orden = ["cabeza", "torso", "brazo_alto", "brazo_bajo", "pierna_alta", "pierna_baja"]
        for fi, quien in enumerate(CORTES):
            for i, n in enumerate(orden):
                f = DESTINO / f"{quien}_{n}.webp"
                if not f.exists():
                    continue
                im = Image.open(f).convert("RGBA"); im.thumbnail((cel - 8, cel - 8))
                x, y = i * cel, fi * (cel + 18)
                h.paste(im, (x + 4, y + 4), im)
                d.text((x + 6, y + cel), f"{quien}_{n}", fill=(200, 220, 255, 255))
        h.save("/tmp/piezas.png")
        print("  hoja de contacto en /tmp/piezas.png")


def escribir_medidas(medidas):
    """Escribir js/medidas.js con las proporciones leídas del dibujo.

    EL ESQUELETO SALE DEL DIBUJO Y NO AL REVÉS. Escrito a mano, el muñeco
    armado nunca coincide del todo con la ilustración: el torso queda un poco
    largo, la cabeza un poco chica, y se termina moviendo números a ojo hasta
    que "más o menos va". Midiendo el dibujo una vez, coincide por
    construcción — y si mañana se regenera el personaje, se vuelve a medir y
    el muñeco se acomoda solo.
    """
    lineas = ["// Las proporciones de cada personaje, medidas del dibujo del que salieron",
              "// las piezas. LO ESCRIBE cortar_cuerpos.py: no se edita a mano.",
              "//",
              "// Todo va en fracciones de la altura de la figura, así que el juego elige",
              "// cuántos píxeles mide cada uno y las proporciones se mantienen.",
              "export const MEDIDAS = {"]
    for quien, d in medidas.items():
        m = d["medidas"]
        campos = ", ".join(f"{k}: {v}" for k, v in m.items() if k != "figura")
        lineas.append(f"  {quien}: {{ {campos} }},")
    lineas.append("};")
    (AQUI / "js" / "medidas.js").write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print("  js/medidas.js escrito")


def armar(quien, medidas, alto=420):
    """Rearmar la figura con las piezas, como la dibuja el juego.

    ES LA ÚNICA PRUEBA QUE VALE. Mirar las piezas sueltas no dice si el brazo
    quedó girado al revés ni si la cabeza va a flotar: eso sólo se ve armado.
    Esto dibuja exactamente como dibuja `cuerpo.js` —cada pieza estirada entre
    dos articulaciones— así que lo que se vea acá es lo que se va a ver jugando.
    """
    med = medidas[quien]["medidas"]
    k = alto
    hom = med["cabeza"] * k                    # y del hombro
    cad = hom + med["torso"] * k
    rod = cad + med["muslo"] * k
    pie = rod + med["canilla"] * k
    cod = med["brazo_alto"] * k
    man = cod + med["brazo_bajo"] * k
    ancho = med["hombro_ancho"] * k
    cx = int(k * 0.42)

    lienzo = Image.new("RGBA", (int(k * 0.85), int(pie * 1.06)), (36, 42, 58, 255))
    P = {n: Image.open(DESTINO / f"{quien}_{n}.webp").convert("RGBA")
         for n in ["cabeza", "torso", "brazo_alto", "brazo_bajo", "pierna_alta", "pierna_baja"]}

    def tramo(img, ax, ay, bx, by, kx=1.0, sobra=1.15):
        d = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5 or 1
        h = d * sobra
        w = h * (img.width / img.height) * kx
        pz = img.resize((max(1, int(w)), max(1, int(h))), Image.LANCZOS)
        ang = -(180 / 3.14159265 * __import__("math").atan2(by - ay, bx - ax) - 90)
        pz = pz.rotate(ang, expand=True, resample=Image.BICUBIC)
        lienzo.alpha_composite(pz, (int(ax - pz.width / 2), int(ay - (h - d) / 2)))

    hx = ancho * 0.42
    # atrás: brazo y pierna derechos
    tramo(P["brazo_alto"], cx + hx, hom, cx + hx * 1.5, hom + cod)
    tramo(P["brazo_bajo"], cx + hx * 1.5, hom + cod, cx + hx * 1.8, hom + man)
    tramo(P["pierna_alta"], cx + hx * 0.5, cad, cx + hx * 0.6, rod)
    tramo(P["pierna_baja"], cx + hx * 0.6, rod, cx + hx * 0.6, pie)
    # adelante
    tramo(P["pierna_alta"], cx - hx * 0.5, cad, cx - hx * 0.6, rod)
    tramo(P["pierna_baja"], cx - hx * 0.6, rod, cx - hx * 0.6, pie)
    tramo(P["torso"], cx, hom, cx, cad, 1.0, 1.04)
    tramo(P["brazo_alto"], cx - hx, hom, cx - hx * 1.5, hom + cod)
    tramo(P["brazo_bajo"], cx - hx * 1.5, hom + cod, cx - hx * 1.8, hom + man)
    ca = P["cabeza"]
    alt_c = med["cabeza"] * k * 1.05
    anc_c = alt_c * (ca.width / ca.height)
    ca = ca.resize((max(1, int(anc_c)), max(1, int(alt_c))), Image.LANCZOS)
    lienzo.alpha_composite(ca, (int(cx - anc_c / 2), int(hom - alt_c * 0.97)))
    return lienzo


if __name__ == "__main__":
    main()
