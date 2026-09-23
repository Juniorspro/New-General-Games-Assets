# Genera kuntur/js/mapas.js: la grilla de cada capítulo.
#
#     python3 kuntur/herramientas/mapas.py
#
# Cada mapa se arma con rectángulos, en coordenadas con la y para arriba (la
# fila 0 del mapa es la de arriba). Letras que entiende la física: # roca,
# _ hielo, = tablón, H escalera o soga, ^ espinas, ~ agua salada, % hielo que
# se rompe, D tranquera, O nido o traba para Apu, B piedra que se empuja,
# A apacheta, K copla, N alguien para hablar, t disparo de la historia,
# T térmica, S salida, F llegada. Las minúsculas que quedan son adornos
# (c cardón, y llama, u vicuña, a casa, i iglesia, p poste, s sal, f fogón,
# w poste de corral, e estación, m flamenco, n nido): la física no las ve.
import os

class Mapa:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.g = [['.'] * w for _ in range(h)]
    def put(s, x, y, ch):
        assert 0 <= x < s.w and 0 <= y < s.h, (x, y)
        s.g[s.h - 1 - y][x] = ch
    def get(s, x, y): return s.g[s.h - 1 - y][x]
    def rect(s, x0, y0, x1, y1, ch='#'):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                s.put(x, y, ch)
    def suelo(s, x0, x1, alto, ch='#'):
        """roca de abajo hasta alto-1: se camina a la altura alto"""
        s.rect(x0, 0, x1, alto - 1, ch)
    def tapa(s, x0, x1):
        s.rect(x0, 0, x1, s.h - 1)
    def filas(s): return [''.join(r) for r in s.g]

MAPAS = {}

# ---------------------------------------------------------------- prólogo
m = Mapa(66, 16)
m.suelo(0, 65, 4)
m.tapa(0, 1)
m.rect(2, 8, 17, 8)            # techo de la casa
m.rect(2, 4, 2, 7)             # pared de atrás
m.rect(17, 7, 17, 7)           # dintel de la puerta
m.rect(5, 9, 5, 9)             # chimenea
m.put(9, 4, 'S'); m.put(5, 4, 'N'); m.put(3, 4, 'f')
m.put(19, 4, 't')              # afuera
m.rect(25, 4, 25, 5)           # pirca del corral
for x in (27, 31, 35, 38): m.put(x, 4, 'w')
m.put(30, 4, 'y'); m.put(34, 4, 'y')
m.put(28, 4, 't')              # el corral
m.put(32, 4, 'A')
m.suelo(40, 65, 7)             # la terraza: 3 de alto
m.rect(46, 8, 51, 10)          # la piedra caída: por abajo, agachada
m.put(43, 7, 'A')
m.put(58, 7, 'c')
m.put(56, 7, 't')              # el pichón
m.put(60, 7, 'F')
m.rect(64, 7, 65, 15)
MAPAS['prologo'] = m.filas()

# ---------------------------------------------------------------- 1. Siete Colores
m = Mapa(214, 28)
m.tapa(0, 1)
m.suelo(2, 23, 5)
m.put(3, 5, 'S')
m.put(6, 5, 'a'); m.put(9, 5, 'i'); m.put(16, 5, 'a'); m.put(18, 5, 'y')
m.put(13, 5, 'N')              # doña Rosa
m.put(21, 5, 'A')
m.suelo(24, 26, 6); m.suelo(27, 29, 7); m.suelo(30, 33, 9)
m.put(25, 6, 'c')
# 34..36: el primer barranco
m.suelo(37, 49, 9)
m.put(41, 9, 'B')              # la piedra para subir
m.put(38, 9, 't')              # pista: empujá la piedra
m.suelo(50, 63, 14)            # pared de 5
m.put(54, 14, 'c'); m.put(61, 14, 'c')
m.rect(57, 14, 57, 16)         # el pilar de la copla (3: se salta con el borde)
m.put(57, 17, 'K')
m.suelo(64, 86, 11)
m.put(69, 11, 'A')
m.rect(72, 12, 82, 17)         # la roca con el pasadizo
m.put(77, 11, 'K')
m.suelo(83, 92, 11)
m.rect(92, 11, 92, 15, 'H')    # escalera de palo
m.suelo(93, 126, 16)
m.put(100, 16, '^'); m.put(101, 16, '^'); m.put(108, 16, '^'); m.put(114, 16, '^'); m.put(115, 16, '^')
m.put(96, 16, 'c'); m.put(105, 16, 'c'); m.put(122, 16, 'c')
m.put(104, 16, 't')            # el mirador
m.put(111, 16, 'A')
m.rect(118, 16, 118, 19)       # pilar
m.rect(120, 21, 122, 21, '=')
m.put(121, 22, 'K')
# 127..146: la quebrada con tablones
m.rect(130, 15, 131, 15, '='); m.rect(135, 16, 136, 16, '='); m.rect(140, 15, 141, 15, '=')
m.suelo(147, 160, 16)
m.suelo(161, 166, 20)          # pared de 4
m.suelo(167, 212, 23)          # pared de 3
m.put(180, 23, 'c'); m.put(190, 23, 'y'); m.put(199, 23, 'c')
m.put(195, 23, 't')            # la cuesta
m.put(207, 23, 'F')
m.tapa(212, 213)
MAPAS['colores'] = m.filas()

# ---------------------------------------------------------------- 2. Salinas Grandes
m = Mapa(224, 22)
m.tapa(0, 1)
m.suelo(2, 223, 5)
m.put(3, 5, 'S')
m.rect(8, 5, 11, 7)            # la casita de sal de don Ceferino
m.put(9, 8, 'K')
m.put(14, 5, 'N')
for x in (12, 17, 19): m.put(x, 5, 's')
m.put(22, 5, 'A')
# charcos de salmuera y bloques de sal para reparo (el viento viene de adelante)
for (a, b) in ((31, 32), (40, 42), (50, 51), (58, 60), (66, 67)):
    m.rect(a, 4, b, 4, '~')
for x in (37, 47, 56, 64): m.put(x, 5, '#')
m.suelo(70, 85, 8)             # la meseta: 3 de alto
m.put(76, 8, 'B')
m.put(72, 8, 's')
m.suelo(86, 95, 13)            # pared de 5: con la piedra
m.put(88, 13, 'A')
m.put(91, 13, 't')             # Apu aletea
# 96..102: el hueco que solo se cruza con el aleteo; abajo, salmuera
m.rect(96, 4, 102, 4, '~')
m.suelo(103, 109, 13)
m.suelo(110, 117, 18)          # pared de 5: aleteo y borde
m.suelo(122, 130, 16)
m.rect(126, 16, 126, 20); m.put(126, 21, 'K')
m.suelo(131, 136, 12); m.suelo(137, 139, 9)
m.put(140, 5, 'A')
for (a, b) in ((150, 152), (160, 163), (170, 172)):
    m.rect(a, 4, b, 4, '~')
m.put(161, 5, '#'); m.put(161, 6, 'K')   # islita en el charco
m.suelo(180, 223, 6)
for x in (185, 195, 205): m.put(x, 6, 'p')
m.put(212, 6, 'e')
m.put(200, 6, 't')             # la estación
m.put(218, 6, 'F')
m.tapa(222, 223)
MAPAS['salinas'] = m.filas()

# ---------------------------------------------------------------- 3. Tren a las Nubes
m = Mapa(176, 16)
m.tapa(0, 1)
vagones = []
x = 2
for i in range(11):
    largo = 12 if i < 10 else 16
    vagones.append((x, x + largo - 1))
    x += largo + 2
for i, (a, b) in enumerate(vagones):
    if i in (3, 4, 7):         # vagones de pasajeros: se puede ir por adentro
        m.rect(a, 1, b, 1); m.rect(a, 5, b, 5)
        m.rect(a + 1, 2, b - 1, 4, '.')
        m.rect(a, 2, a, 4, '.'); m.rect(b, 2, b, 4, '.')
    else:
        m.rect(a, 1, b, 5)
    if i < 10:
        g0, g1 = b + 1, b + 2
        m.rect(g0, 1, g1, 1, '=')          # el enganche
        m.rect(g1, 2, g1, 5, 'H')          # la escalerita del vagón siguiente
        m.rect(g0, 2, g0, 5, 'H')
la, lb = vagones[10]
m.rect(la, 6, la + 4, 8)                   # la cabina de la locomotora
m.put(3, 6, 'S')
m.put(6, 6, 't')                           # arranca
m.put(vagones[3][0] + 5, 6, 'A')
m.put(vagones[5][0] + 2, 6, 't')           # el viaducto
m.put(vagones[6][0] + 6, 6, 'A')
m.put(vagones[7][0] + 1, 6, 't')           # túnel
m.put(vagones[4][0] + 6, 3, 'K')           # adentro del vagón
m.put(vagones[8][0] + 6, 6, 'A')
m.rect(vagones[9][0] + 3, 6, vagones[9][0] + 5, 6)   # el carbón
m.put(vagones[9][0] + 4, 7, 'K')
m.put(vagones[1][0] + 11, 7, 'K')           # arriba de un farol
m.rect(vagones[1][0] + 11, 6, vagones[1][0] + 11, 6)
m.put(la - 5, 6, 't')                       # Tomás: se lo ve desde el techo del último vagón
m.put(la - 1, 6, 'N')
m.put(la + 1, 9, 'F')
MAPAS['tren'] = m.filas()
TREN_VAGONES = vagones

# ---------------------------------------------------------------- 4. La Puna
m = Mapa(224, 28)
m.tapa(0, 1)
m.suelo(2, 29, 6)
m.put(3, 6, 'S')
for x in (8, 15, 23): m.put(x, 6, 'u')
m.rect(25, 8, 27, 8, '='); m.put(26, 9, 'K')   # un tablón alto: con el aleteo
m.put(12, 6, 'A')
m.suelo(30, 33, 9); m.suelo(34, 40, 12)
m.put(39, 12, 't')             # Apu ya planea
# 41..52: la bajada que solo se cruza planeando; abajo, la laguna
m.suelo(41, 52, 3); m.rect(41, 2, 52, 2, '~')
m.suelo(53, 64, 9)
m.put(56, 9, 'A')
# la laguna con pilares
m.suelo(65, 100, 3); m.rect(65, 2, 100, 2, '~')
for (a, b, h) in ((70, 71, 10), (79, 80, 11), (88, 89, 10), (96, 100, 9)):
    m.suelo(a, b, h)
m.put(80, 11, 'm'); m.put(71, 10, 'm')
m.rect(84, 14, 85, 14); m.put(84, 15, 'K')   # arriba, a la copla se llega planeando
m.suelo(101, 133, 9)
m.put(104, 9, 't')             # llamar a Apu
m.rect(110, 9, 110, 11, 'D'); m.rect(110, 12, 110, 20)   # la tranquera, con la roca arriba
m.put(109, 16, 'O')            # la traba, colgada de la roca: allá va Apu
m.put(116, 9, 'A')
m.rect(121, 9, 123, 11)        # un peñasco para subir
m.rect(128, 9, 128, 11, 'D'); m.rect(128, 12, 128, 20)
m.put(127, 17, 'O')
m.put(131, 9, 'K')
m.put(134, 9, 't')             # el puma
m.suelo(134, 150, 9)
m.suelo(151, 156, 12)          # pared de 3
m.put(154, 12, '^')
m.suelo(157, 162, 12)
# 163..170: hueco para planear
m.suelo(171, 180, 11)
m.suelo(181, 190, 14)
m.suelo(191, 223, 9)
m.put(192, 9, 't')             # Coquena
m.put(194, 9, 'N')
m.put(197, 9, 'A')
for x in (202, 207): m.put(x, 9, 'u')
m.put(218, 9, 'F')
m.tapa(222, 223)
MAPAS['puna'] = m.filas()

# ---------------------------------------------------------------- 5. El Nevado
m = Mapa(150, 52)
m.tapa(0, 1)
m.suelo(2, 16, 5)
m.put(3, 5, 'S'); m.put(8, 5, 'A')
m.put(14, 5, 't')              # el viento blanco
m.suelo(17, 26, 5, '_')        # hielo
m.suelo(27, 30, 7)
# grieta con puente que se rompe
m.rect(31, 6, 36, 6, '%')
m.suelo(37, 44, 7)
m.put(41, 9, 'K')             # una copla en medio de la ventisca: saltando
m.suelo(45, 48, 10)            # pared de 3
m.suelo(49, 58, 10, '_')
m.rect(59, 9, 64, 9, '%')
m.suelo(65, 72, 10)
m.rect(66, 13, 67, 13); m.put(66, 14, 'K')
m.suelo(73, 80, 12)
m.suelo(81, 86, 12, '_')
m.rect(87, 11, 91, 11, '%')
m.suelo(92, 104, 14)
m.put(100, 14, 'A')
# la subida: en zigzag hacia la izquierda y la derecha
m.suelo(105, 112, 17)
m.rect(113, 14, 113, 21, 'H'); m.suelo(114, 149, 22)
m.rect(98, 25, 110, 25)        # repisa de vuelta
m.rect(111, 22, 112, 25)
m.rect(97, 25, 97, 29, 'H')
m.rect(98, 30, 108, 30)
m.put(104, 31, 'A')
m.rect(98, 31, 98, 31, '#')
# térmicas hacia la cumbre
m.put(110, 22, 'T')
m.rect(116, 32, 124, 32)
m.put(126, 22, 'T')
m.rect(128, 38, 135, 38)
m.put(132, 39, 'K')
m.put(137, 22, 'T')
m.suelo(140, 149, 44)
m.put(143, 44, 't')            # la cumbre
m.put(145, 44, 'n')
m.put(147, 44, 'F')
MAPAS['nevado'] = m.filas()

# ---------------------------------------------------------------- epílogo
m = Mapa(48, 14)
m.suelo(0, 47, 4)
m.tapa(0, 1)
m.rect(33, 8, 45, 8); m.rect(45, 4, 45, 7); m.rect(33, 7, 33, 7)   # la casa, ahora a la derecha
m.rect(38, 9, 38, 9)           # chimenea
m.put(3, 4, 'S'); m.put(31, 4, 't'); m.put(37, 4, 'N'); m.put(42, 4, 'f')
m.put(9, 4, 'y'); m.put(15, 4, 'c'); m.put(21, 4, 'c'); m.put(26, 4, 'w')
m.tapa(46, 47)
MAPAS['epilogo'] = m.filas()

# ---------------------------------------------------------------- la portada (el título)
m = Mapa(44, 14)
m.suelo(0, 43, 4)
m.suelo(15, 29, 5); m.suelo(18, 26, 6)
m.put(21, 6, 'S'); m.put(24, 6, 'A')
m.put(6, 4, 'a'); m.put(10, 4, 'c'); m.put(13, 4, 'y'); m.put(31, 4, 'c'); m.put(35, 4, 'u'); m.put(39, 4, 'c')
MAPAS['portada'] = m.filas()

def js():
    sal = ['/* kuntur/js/mapas.js — lo genera herramientas/mapas.py; no se toca a mano. */', 'export const MAPAS = {']
    for k, v in MAPAS.items():
        sal.append(f'  {k}: [')
        for f in v: sal.append(f"    '{f}',")
        sal.append('  ],')
    sal.append('};')
    sal.append('export const TREN_VAGONES = ' + str([list(v) for v in TREN_VAGONES]) + ';')
    return '\n'.join(sal) + '\n'

aqui = os.path.dirname(os.path.abspath(__file__))
open(os.path.join(aqui, '..', 'js', 'mapas.js'), 'w').write(js())
print('mapas.js:', ', '.join(f'{k} {len(v[0])}x{len(v)}' for k, v in MAPAS.items()))
