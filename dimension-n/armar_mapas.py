#!/usr/bin/env python3
"""Escribe js/mapas.js con los quince niveles del modo portales.

    python3 armar_mapas.py

POR QUÉ UNA HERRAMIENTA Y NO ESCRIBIR EL .js A MANO. Cada nivel son 22 por 34
caracteres: 748. Escritos a mano, una fila con 21 en vez de 22 corre el mapa
entero una columna a partir de ahí y no se ve leyéndolo — se ve jugando, con
una pared donde no va. Acá se escribe sólo el INTERIOR, el borde se agrega
solo, y todo se valida antes de salir.

LEYENDA
    #  pared por la que SE PUEDE disparar un portal
    X  pared negra: frena igual, pero rebota el disparo
    S  dónde aparecen        E  la salida
    ^  púas                  ~  gelatina (frena)      =  resorte
    o  chatarra              B  placa de peso         D  puerta (abre con B)
"""
import pathlib

ANCHO, ALTO = 22, 34
INT_AN, INT_AL = ANCHO - 2, ALTO - 2


def N(nombre, pista, filas):
    return {"nombre": nombre, "pista": pista, "filas": filas}


# Cada string es una fila del INTERIOR (20 de ancho). Las que falten se
# completan con aire, así que sólo hace falta escribir hasta la última que
# tenga algo.
NIVELES = [
 N("Del otro lado", "Tocá para disparar. Hacen falta los dos portales.", [
  "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  "          #         ",
  "          #         ",
  "          #         ",
  "          #    o    ",
  "          #         ",
  "          #         ",
  "          #         ",
  "  S       #       E ",
  "####################",
 ]),

 N("El pozo", "Las púas duelen aunque llegues despacio.", [
  "", "", "", "", "", "", "", "", "", "", "", "", "",
  "                    ",
  "         ###        ",
  "         ###        ",
  "         ###        ",
  "         ###   o    ",
  "         ###        ",
  "         ###        ",
  "  S      ###      E ",
  "####^^^^^###^^^^^###",
 ]),

 N("Impulso", "Caer por un portal conserva la velocidad.", [
  "", "", "", "",
  "                 ###",
  "                 #E#",
  "                 ###",
  "", "", "", "", "", "", "", "",
  "  S                 ",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####     o    #####",
  "#####          #####",
  "#####          #####",
  "####################",
 ]),

 N("Techo", "Si tirás al techo de allá, caés de allá.", [
  "", "", "", "", "", "",
  "  S        #        ",
  "#####      #        ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #   o    ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #        ",
  "           #   E    ",
  "           #########",
  "           #        ",
  "^^^^^^^^^^^#^^^^^^^^",
 ]),

 N("El peso de Tito", "La placa se aprieta con peso. Tenés uno colgando.", [
  "", "", "", "", "", "", "", "", "", "", "", "",
  "         #          ",
  "         #          ",
  "         #          ",
  "         #          ",
  "         #     o    ",
  "         #          ",
  "         #  DDD     ",
  "  S   B  #  DDD   E ",
  "####################",
 ]),

 N("Gelatina", "Adentro del verde todo va en cámara lenta.", [
  "", "", "", "", "", "",
  "  S                 ",
  "#####               ",
  "          #         ",
  "          #         ",
  "      ~~~~#         ",
  "      ~~~~#         ",
  "      ~~~~#         ",
  "      ~~~~#    o    ",
  "      ~~~~#         ",
  "          #         ",
  "          #         ",
  "          #         ",
  "          #         ",
  "          #         ",
  "          #         ",
  "          #     E   ",
  "####################",
 ]),

 N("Pared negra", "En lo negro el disparo rebota. Buscá otra cara.", [
  "", "", "", "", "", "", "", "", "", "", "",
  "         XXX        ",
  "         XXX        ",
  "         XXX        ",
  "         XXX   o    ",
  "         XXX        ",
  "         ###        ",
  "         ###        ",
  "  S      ###      E ",
  "####################",
 ]),

 N("Dos placas", "Las dos a la vez, y sos uno solo.", [
  "", "", "", "", "", "", "", "", "", "",
  "        #           ",
  "        #           ",
  "        #      o    ",
  "        #           ",
  "        #           ",
  "        #    DDDD   ",
  "        #    DDDD   ",
  "  S  B  #  B      E ",
  "####################",
 ]),

 N("El resorte", "Lo verde te devuelve para arriba.", [
  "", "", "", "",
  "  ##                ",
  "  #E                ",
  "  ###          o    ",
  "", "", "", "", "", "", "", "", "", "", "",
  "  S                 ",
  "#######     ========",
  "####################",
 ]),

 N("Torre", "Para arriba también se puede.", [
  "               #####",
  "               #####",
  "  E            #####",
  "#####          #####",
  "#####          #####",
  "#####     o    #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####          #####",
  "#####     S    #####",
  "####################",
 ]),

 N("Vaivén", "Entrás por una cara y salís por la de al lado.", [
  "", "", "", "", "", "", "", "",
  "     #########      ",
  "     #########      ",
  "     #########      ",
  "     #########      ",
  "  S  #########      ",
  "#############       ",
  "             #      ",
  "      o      #      ",
  "             #      ",
  "             #      ",
  "             #  E   ",
  "             ########",
 ]),

 N("Las dos púas", "No hay piso limpio en el medio.", [
  "", "", "", "", "", "", "", "", "", "",
  "       ######       ",
  "       ######       ",
  "       ######       ",
  "       ######  o    ",
  "       ######       ",
  "       ######       ",
  "  S    ######     E ",
  "###^^^^######^^^^###",
 ]),

 N("El desvío", "La placa está en un pozo. Alguien tiene que caer ahí.", [
  "", "", "", "", "", "", "", "",
  "                    ",
  "  S                 ",
  "#########    #######",
  "        #    #      ",
  "        #    #      ",
  "        #    #      ",
  "        #    #  o   ",
  "        #    #      ",
  "        #    #      ",
  "        ######      ",
  "        #    #      ",
  "   DDD  #    #      ",
  "   DDD  #  B #      ",
  " E DDD  ######      ",
  "####################",
 ]),

 N("Caída larga", "Cuanto más alto entrás, más lejos salís.", [
  "", "", "",
  "        S           ",
  "       #####        ",
  "", "", "", "", "", "",
  "                   #",
  "                   #",
  "###                #",
  "###                #",
  "#E                 #",
  "###                #",
  "###                #",
  "", "", "", "", "", "", "", "", "", "", "", "", "",
 ]),

 N("El último puente", "Todo junto. Suerte.", [
  "", "", "", "", "",
  "              XXXXXX",
  "              XXXXXX",
  "  S           XXXXXX",
  "#######       XXXXXX",
  "              XXXXXX",
  "      ~~~~    XXXXXX",
  "      ~~~~          ",
  "      ~~~~     o    ",
  "      ~~~~          ",
  "              ######",
  "              ######",
  "   #####      ######",
  "   #####      ######",
  "   #####   B  ######",
  "   #####DDDD########",
  "   #####DDDD        ",
  "   #####        E   ",
  "####################",
 ]),
]


def armar(filas):
    """Interior → mapa completo con su borde.

    EL TECHO Y EL PISO SON PORTALEABLES, los costados no, y eso es una regla de
    diseño y no una decoración. Si el borde entero fuera negro, un nivel con un
    tabique en el medio no tendría solución: desde un lado no hay ninguna cara
    disparable del otro, porque el tabique tapa la única línea recta que
    llegaba. Con el techo disponible siempre hay una salida — se tira arriba,
    pasando por encima del tabique, y se sale cayendo del otro lado. Los
    costados quedan negros para que no se pueda escapar del escenario por el
    borde.
    """
    cuerpo = [(f or "").ljust(INT_AN)[:INT_AN] for f in filas]
    cuerpo += [" " * INT_AN] * (INT_AL - len(cuerpo))
    borde = "X" + "#" * INT_AN + "X"
    return [borde] + ["X" + f + "X" for f in cuerpo] + [borde]


def main():
    salida = ["// Los quince niveles del modo portales.",
              "//",
              "// LO ESCRIBE armar_mapas.py: no se edita a mano. Cada nivel son 22 por 34",
              "// caracteres y una fila a la que le falte uno corre el mapa entero una columna",
              "// a partir de ahí, sin que se note leyéndolo.",
              "//",
              "//   #  pared por la que SE PUEDE disparar     X  pared negra: rebota el tiro",
              "//   S  dónde aparecen    E  la salida         ^  púas    ~  gelatina",
              "//   =  resorte           o  chatarra          B  placa   D  puerta",
              "export const NIVELES_P = ["]
    for n in NIVELES:
        mapa = armar(n["filas"])
        assert len(mapa) == ALTO, (n["nombre"], len(mapa))
        for f in mapa:
            assert len(f) == ANCHO, (n["nombre"], f, len(f))
        texto = "".join(mapa)
        assert texto.count("S") == 1, f'{n["nombre"]}: {texto.count("S")} spawns'
        assert texto.count("E") == 1, f'{n["nombre"]}: {texto.count("E")} salidas'
        if "D" in texto:
            assert "B" in texto, f'{n["nombre"]}: puerta sin placa'
        salida.append(f'  {{ nombre: {n["nombre"]!r}, pista: {n["pista"]!r}, mapa: [')
        for f in mapa:
            salida.append(f'    "{f}",')
        salida.append("  ] },")
    salida.append("];")
    txt = "\n".join(salida).replace("'", '"') + "\n"
    pathlib.Path("js/mapas.js").write_text(txt, encoding="utf-8")
    print(f"  js/mapas.js: {len(NIVELES)} niveles, {len(txt) // 1024} KB")


if __name__ == "__main__":
    main()
