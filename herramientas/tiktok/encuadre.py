"""Donde recortar el 9:16 de un plano 4:3 para no cortarle la cara a nadie.

Recortar por el centro es lo comodo y lo que sale mal: en 960x720 el 9:16 se
lleva 405 px de 960, o sea que el 58% de la imagen se tira. Si el actor esta
a un costado, el recorte del medio se lo come.

Dos medidores, porque el material tiene planos en color y en blanco y negro:
  · color  -> centroide horizontal de los pixeles con tono de piel
  · B/N    -> centroide de la energia de bordes (donde esta el detalle)
Se promedia sobre varios cuadros del plano para que un gesto no lo corra.
"""
import subprocess, sys
import imageio_ffmpeg, numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()


def cuadros(v, t0, t1, n=5):
    """n cuadros del plano, como arrays RGB chicos."""
    salida = []
    for k in range(n):
        t = t0 + (t1 - t0) * (k + 0.5) / n
        r = subprocess.run(
            [FF, "-hide_banner", "-loglevel", "error", "-ss", str(t), "-i", v,
             "-frames:v", "1", "-vf", "scale=240:180", "-f", "rawvideo",
             "-pix_fmt", "rgb24", "-"], capture_output=True)
        if len(r.stdout) == 240 * 180 * 3:
            salida.append(np.frombuffer(r.stdout, np.uint8).reshape(180, 240, 3).astype(np.int16))
    return salida


def piel(f):
    R, G, B = f[:, :, 0], f[:, :, 1], f[:, :, 2]
    mx, mn = f.max(2), f.min(2)
    return ((R > 80) & (G > 30) & (B > 15) & (mx - mn > 12) &
            (R - G > 10) & (R > B)).astype(np.float32)


def bordes(f):
    g = f.mean(2)
    return np.abs(np.diff(g, axis=1, prepend=g[:, :1])) + np.abs(np.diff(g, axis=0, prepend=g[:1, :]))


def centro(v, t0, t1):
    """Devuelve x del centro del recorte, en fraccion 0..1 del ancho."""
    xs, pesos = [], []
    for f in cuadros(v, t0, t1):
        sat = (f.max(2) - f.min(2)).mean()
        m = piel(f) if sat > 18 else None
        if m is None or m.sum() < 150:      # B/N, o sin piel detectable
            m = bordes(f)
            m = m * (m > np.percentile(m, 80))
        col = m.sum(0)
        if col.sum() <= 0:
            continue
        xs.append(float((col * np.arange(len(col))).sum() / col.sum() / len(col)))
        pesos.append(float(col.sum()))
    if not xs:
        return 0.5
    return float(np.average(xs, weights=pesos))


if __name__ == "__main__":
    v = sys.argv[1]
    for linea in open(sys.argv[2]):
        i, a, b, d = linea.split()
        print(f"{i}\t{centro(v, float(a), float(b)):.3f}")
