#!/usr/bin/env python3
"""Convierte lo que sale de Higgsfield en lo que el juego carga.

    python3 herramientas/procesar_assets.py <carpeta-con-lo-crudo>

Lo crudo NO entra al repo: son ~150 MB de PNG de 2048 y GLB con texturas de
4096. Lo que queda en assets/ es lo que el navegador baja, y cada paso de acá
existe porque sin él algo se veía mal. Están en el orden en que duelen.

CIELO. El modelo pinta un panorama "360" pero no sabe de proyecciones: el
horizonte le cae donde quiere (en el 54 % de la altura, medido) y los bordes
izquierdo y derecho no coinciden. Un equirectangular necesita el horizonte
EXACTO en la mitad —si no, el sol queda más alto o más bajo que la luz que lo
imita y la sombra no apunta adonde está el sol— y necesita que el borde cierre,
porque al girar la cámara la costura se ve como un corte vertical en el cielo.

TEXTURAS QUE SE REPITEN. Pedir "seamless" no alcanza: el modelo lo intenta y
casi nunca le sale. Y además cada foto trae un degradé de luz de lado a lado,
que repetido cada tres metros dibuja una cuadrícula en el piso que se ve desde
lejos aunque la costura en sí no se vea. Se aplana la luz a escala grande y
después se cierra la costura fundiendo un borde sobre el otro.

RECORTES. El que saca el fondo deja los bordes semitransparentes con el blanco
del fondo mezclado adentro. En un juego eso es un halo blanco alrededor de cada
hoja, que en la sombra brilla como si tuviera luz propia. Se le resta el blanco
a cada pixel según su alfa, y después se "sangra" el color hacia los pixeles
transparentes: el mipmap promedia vecinos, y si los vecinos transparentes son
blancos el halo vuelve a aparecer de lejos.
"""
import json, math, pathlib, sys

import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = pathlib.Path(__file__).resolve().parent.parent
SALIDA = AQUI / "assets"


def cargar(p, modo="RGB"):
    return np.asarray(Image.open(p).convert(modo)).astype(np.float32) / 255.0


def guardar(arr, nombre, calidad=80, sin_perdida=False, **extra):
    im = Image.fromarray(np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8))
    destino = SALIDA / nombre
    im.save(destino, "WEBP", quality=calidad, lossless=sin_perdida, method=6, **extra)
    print(f"  {nombre:28s} {im.size[0]}x{im.size[1]}  {destino.stat().st_size / 1024:7.1f} KB")
    return destino


def redimensionar(arr, ancho, alto):
    modo = "RGBA" if arr.shape[2] == 4 else "RGB"
    im = Image.fromarray(np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8), modo)
    return np.asarray(im.resize((ancho, alto), Image.LANCZOS)).astype(np.float32) / 255.0


# ───────────────────────────────────────────────────────────────────────────
# costura
# ───────────────────────────────────────────────────────────────────────────
def cerrar_costura_x(img, banda):
    """Funde las últimas `banda` columnas sobre las primeras y las descarta.

    Después de esto la columna final y la primera eran VECINAS en la imagen
    original, así que el borde cierra sin salto. El precio es una franja de
    `banda` columnas donde se ven las dos imágenes a la vez; en pasto o nubes no
    se nota, en un ladrillo se notaría.
    """
    w = img.shape[1]
    t = (np.arange(banda, dtype=np.float32) / banda)
    # suavizado: una rampa lineal deja un cambio de pendiente que se ve como
    # una línea de contraste en el medio de la franja
    t = t * t * (3 - 2 * t)
    t = t.reshape(1, -1, 1)
    fuera = img[:, : w - banda].copy()
    fuera[:, :banda] = img[:, :banda] * t + img[:, w - banda:] * (1 - t)
    return fuera


def cerrar_costura(img, frac=0.12):
    b = int(img.shape[1] * frac)
    img = cerrar_costura_x(img, b)
    img = np.transpose(cerrar_costura_x(np.transpose(img, (1, 0, 2)), int(img.shape[0] * frac)), (1, 0, 2))
    return img


def aplanar_luz(img, sigma_frac=0.12, fuerza=0.85):
    """Saca el degradé de luz de escala grande sin tocar el detalle.

    Divide por la versión MUY borroneada y multiplica por la media. `fuerza` < 1
    deja algo de variación, que es natural; en 1 el piso sale de un gris plano
    de televisor.
    """
    s = img.shape[0] * sigma_frac
    grande = np.stack([ndimage.gaussian_filter(img[..., c], s, mode="wrap") for c in range(3)], -1)
    media = img.reshape(-1, 3).mean(0)
    plano = img / np.maximum(grande, 1e-3) * media
    return np.clip(img * (1 - fuerza) + plano * fuerza, 0, 1)


def mapa_normal(img, fuerza=3.0, sigma=1.1):
    """Normal de espacio tangente sacada de la luminancia como si fuera altura.

    No es un escaneo: es la aproximación de siempre (lo oscuro es hondo). En
    corteza, musgo y hojarasca acierta casi siempre porque las grietas SON lo
    oscuro. Las diferencias son con `np.roll` para que el mapa también se repita
    sin costura, igual que el color.
    """
    lum = img[..., 0] * 0.3 + img[..., 1] * 0.59 + img[..., 2] * 0.11
    h = ndimage.gaussian_filter(lum, sigma, mode="wrap")
    # se le saca la escala grande: la altura "media" de una foto es luz, no relieve
    h = h - ndimage.gaussian_filter(h, img.shape[0] * 0.05, mode="wrap")
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    escala = fuerza * img.shape[0] / 256.0
    n = np.stack([-dx * escala, dy * escala, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def textura_repetible(crudo, nombre, lado=1024, fuerza_normal=3.0, aplanar=0.85, lado_normal=512):
    # LAS NORMALES VAN A 512. Son el relieve fino: a 1024 cada una pesaba
    # ~400 KB y entre las seis sumaban 2,4 MB de descarga para un detalle que
    # la cámara, a 480 líneas, no llega a resolver.
    img = cargar(crudo)
    img = aplanar_luz(img, fuerza=aplanar)
    img = cerrar_costura(img)
    img = redimensionar(img, lado, lado)
    guardar(img, f"{nombre}.webp", calidad=76)
    n = mapa_normal(img, fuerza=fuerza_normal)
    ln = lado_normal or lado
    if ln != lado:
        n = redimensionar(n, ln, ln)
    guardar(n, f"{nombre}-n.webp", calidad=88)


# ───────────────────────────────────────────────────────────────────────────
# recortes
# ───────────────────────────────────────────────────────────────────────────
def descontaminar(rgba, fondo=1.0):
    """Le resta el fondo blanco a los bordes: c = (C - (1-a)·fondo) / a."""
    rgb, a = rgba[..., :3], rgba[..., 3:4]
    semi = (a > 0.02) & (a < 0.98)
    limpio = np.where(semi, (rgb - (1 - a) * fondo) / np.maximum(a, 1e-3), rgb)
    return np.concatenate([np.clip(limpio, 0, 1), a], -1)


def sangrar(rgba, pasos=48):
    """Extiende el color de los pixeles opacos hacia los transparentes.

    Cada paso copia a cada pixel vacío el promedio de sus vecinos ya llenos.
    Con 48 pasos alcanza para que ningún mip —hasta el de 16 px— promedie
    contra el blanco del fondo que ya no está.
    """
    rgb = rgba[..., :3].copy()
    lleno = rgba[..., 3] > 0.5
    rgb[~lleno] = 0
    peso = lleno.astype(np.float32)
    k = np.array([[1, 1, 1], [1, 0, 1], [1, 1, 1]], np.float32)
    for _ in range(pasos):
        if lleno.all():
            break
        suma = np.stack([ndimage.convolve(rgb[..., c] * peso, k, mode="nearest") for c in range(3)], -1)
        cuenta = ndimage.convolve(peso, k, mode="nearest")
        nuevo = (~lleno) & (cuenta > 0)
        rgb[nuevo] = suma[nuevo] / cuenta[nuevo, None]
        lleno = lleno | nuevo
        peso = lleno.astype(np.float32)
    rgb[~lleno] = rgb[lleno].mean(0)
    return np.concatenate([rgb, rgba[..., 3:4]], -1)


def recorte(crudo, nombre, alto, base_abajo=True, margen=0.02):
    """Recorta al contenido, deja la base donde el juego la espera y achica.

    `base_abajo`: para lo que crece del piso (pasto, flores, ramas que salen del
    tronco), el pie tiene que tocar el borde de abajo del cuadro. Si queda un
    margen, la planta flota a esa altura sobre el suelo en todo el bosque.
    """
    img = cargar(crudo, "RGBA")
    img = descontaminar(img)
    a = img[..., 3]
    ys, xs = np.where(a > 0.35)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    m = int(margen * max(y1 - y0, x1 - x0))
    y0 = max(0, y0 - m); x0 = max(0, x0 - m); x1 = min(img.shape[1], x1 + m)
    y1 = y1 if base_abajo else min(img.shape[0], y1 + m)
    img = img[y0:y1, x0:x1]
    h, w = img.shape[:2]
    # potencia de dos en el alto; el ancho se redondea a múltiplo de 4
    ancho = max(4, int(round(alto * w / h / 4)) * 4)
    img = redimensionar(img, ancho, alto)
    img = sangrar(img)
    guardar(img, f"{nombre}.webp", calidad=84, alpha_quality=90)
    return {"ancho": ancho, "alto": alto, "proporcion": round(w / h, 4)}


# ───────────────────────────────────────────────────────────────────────────
# cielo
# ───────────────────────────────────────────────────────────────────────────
def cielo(crudo, horizonte_frac=0.54, ancho=4096, elevar=5.0):
    """Lleva el panorama a equirectangular de verdad: horizonte en la mitad.

    Arriba del horizonte la imagen se estira de 0..horizonte a 90°..0°; abajo,
    de horizonte..1 a 0°..-90°. Es un reajuste lineal por tramos, no una
    reproyección: el modelo no pintó con ninguna proyección en particular, así
    que no hay una "correcta" que invertir. Lo que importa es dónde queda el
    horizonte y dónde queda el sol, y esas dos cosas quedan donde se miden.
    """
    img = cargar(crudo)
    h, w, _ = img.shape
    img = cerrar_costura_x(img, int(w * 0.07))
    h, w, _ = img.shape
    alto = ancho // 2
    filas = np.arange(alto, dtype=np.float32) + 0.5
    # EL HORIZONTE DE LA FOTO VA 5° POR ENCIMA DEL DE VERDAD. Con el sol a
    # 7,8° quedaba escondido detrás de la línea de abetos de la otra orilla
    # desde cualquier lugar del lago: 28 m de árbol a 120 m tapan 13°. Subiendo
    # el panorama el sol queda a ~12°, justo asomando sobre las copas, que es de
    # donde salen los rayos. Las montañas quedan un poco altas; con la bruma de
    # abajo no se nota.
    e = 90.0 - filas / alto * 180.0        # elevación de cada fila de salida
    origen = np.where(e >= elevar, (90.0 - e) / (90.0 - elevar) * horizonte_frac,
                      horizonte_frac + (elevar - e) / (elevar + 90.0) * (1 - horizonte_frac)) * h
    origen = np.clip(origen, 0, h - 1)
    i0 = np.floor(origen).astype(int); i1 = np.minimum(i0 + 1, h - 1); t = (origen - i0)[:, None, None]
    col = img[i0] * (1 - t) + img[i1] * t
    col = np.asarray(Image.fromarray((col * 255).astype(np.uint8)).resize((ancho, alto), Image.LANCZOS)).astype(np.float32) / 255

    # el sol, medido sobre el resultado: es la fuente de verdad para la luz
    lum = col.mean(2)
    s = ndimage.gaussian_filter(lum, 6)
    sy, sx = np.unravel_index(np.argmax(s[: alto // 2]), s[: alto // 2].shape)
    u, vv = (sx + 0.5) / ancho, 1 - (sy + 0.5) / alto     # v de three: 1 arriba
    # colores de la niebla: la franja de bruma justo debajo del horizonte, del
    # lado del sol y del lado opuesto. La niebla del juego tiene que ser ESTE
    # color, o el horizonte se ve como una línea donde termina el mundo.
    fila = int(alto * 0.515)
    franja = col[fila: fila + 12].mean(0)
    cols = np.arange(ancho)
    dist = np.minimum(np.abs(cols - sx), ancho - np.abs(cols - sx)) / ancho
    lado_sol = franja[dist < 0.06].mean(0)
    lado_opuesto = franja[dist > 0.35].mean(0)
    cenit = col[: alto // 12].reshape(-1, 3).mean(0)
    guardar(col, "cielo.webp", calidad=84)
    return {
        "sol_u": round(float(u), 5), "sol_v": round(float(vv), 5),
        "sol_elevacion_grados": round(float((vv - 0.5) * 180), 2),
        "niebla_sol": [round(float(c), 4) for c in lado_sol],
        "niebla": [round(float(c), 4) for c in lado_opuesto],
        "cenit": [round(float(c), 4) for c in cenit],
    }


def normal_agua(lado=512):
    """Olas chicas, repetibles: suma de ondas con números de onda enteros.

    Con frecuencias enteras cada onda cierra en el borde por construcción, así
    que no hace falta fundir nada. Se usan muchas direcciones para que no se vea
    un peine de olas paralelas.
    """
    rng = np.random.default_rng(7)
    y, x = np.mgrid[0:lado, 0:lado].astype(np.float32) / lado
    h = np.zeros((lado, lado), np.float32)
    for _ in range(48):
        kx, ky = rng.integers(-12, 13, 2)
        if kx == 0 and ky == 0:
            continue
        k = math.hypot(kx, ky)
        amp = 1.0 / (k ** 1.35)
        h += amp * np.sin(2 * math.pi * (kx * x + ky * y) + rng.uniform(0, 6.283))
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * lado / 8
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * lado / 8
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    guardar(n * 0.5 + 0.5, "agua-n.webp", calidad=90)


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    crudo = pathlib.Path(sys.argv[1])
    SALIDA.mkdir(exist_ok=True)
    datos = json.loads((SALIDA / "datos.json").read_text()) if (SALIDA / "datos.json").exists() else {}

    print("cielo")
    datos["cielo"] = cielo(crudo / "cielo-nano.png")
    if "--solo-cielo" in sys.argv:
        (SALIDA / "datos.json").write_text(json.dumps(datos, indent=1, ensure_ascii=False))
        print("datos.json:", json.dumps(datos["cielo"]))
        return

    print("suelo y corteza")
    textura_repetible(crudo / "suelo-bosque.png", "suelo", 1024, 3.2)
    textura_repetible(crudo / "musgo.png", "musgo", 1024, 2.4)
    textura_repetible(crudo / "sendero.png", "sendero", 1024, 2.6)
    textura_repetible(crudo / "roca.png", "roca", 1024, 2.8)
    # la corteza se repite solo a lo ALTO del tronco en la práctica, pero se
    # cierra en los dos sentidos porque el tronco también da la vuelta
    textura_repetible(crudo / "corteza-abeto.png", "corteza-abeto", 1024, 4.0, aplanar=0.7)
    textura_repetible(crudo / "corteza-abedul.png", "corteza-abedul", 1024, 2.2, aplanar=0.6)

    print("follaje")
    datos["recortes"] = {
        "rama-abeto": recorte(crudo / "r-abeto.png", "rama-abeto", 1024),
        "rama-picea": recorte(crudo / "r-picea.png", "rama-picea", 1024),
        "helecho": recorte(crudo / "r-helecho.png", "helecho", 1024),
        "pasto": recorte(crudo / "r-pasto.png", "pasto", 512),
        "hojas-abedul": recorte(crudo / "r-hojas-abedul.png", "hojas-abedul", 512),
        "flores": recorte(crudo / "r-flores.png", "flores", 512),
    }

    print("agua")
    normal_agua()

    (SALIDA / "datos.json").write_text(json.dumps(datos, indent=1, ensure_ascii=False))
    print("datos.json:", json.dumps(datos["cielo"]))


if __name__ == "__main__":
    main()
