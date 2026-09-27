# De punta a punta, con fotos reales de manos: foto → YUV como la da la cámara
# de Android → Mano.yuvARgb (el código Java de la app) → el modelo de manos de
# MediaPipe (el mismo del APK). Se compara con pasarle la foto directo:
#  - los colores de la conversión,
#  - que encuentre la misma mano en el mismo lugar,
#  - que con la pantalla al revés (imagen girada 180°) y Mano.desgirar dé lo mismo.
#
#   python3 pruebas/manos-camara.py        (pide: pip install mediapipe; baja las fotos)
import os, subprocess, sys, tempfile, urllib.request
import numpy as np, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELO = os.path.expanduser("~/.cache/mundo-ar/mediapipe/hand_landmarker.task")
obra = tempfile.mkdtemp()
subprocess.run(["javac", "-nowarn", "-d", obra, os.path.join(AQUI, "../src/com/juniorspro/asaltomr/Mano.java"), os.path.join(AQUI, "herramientas/Yuv.java")], check=True, stderr=subprocess.DEVNULL)
det = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODELO), num_hands=1, running_mode=vision.RunningMode.IMAGE))

def puntos(rgb):
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
    if not r.hand_landmarks: return None, None
    return np.array([[p.x, p.y] for p in r.hand_landmarks[0]]), np.array([[p.x, p.y, p.z] for p in r.hand_world_landmarks[0]])

def leer_ppm(f):
    d = open(f, "rb").read()
    partes = d.split(b"\n", 3)
    w, h = map(int, partes[1].split())
    return np.frombuffer(partes[3], dtype=np.uint8).reshape(h, w, 3)

fallas = 0
def ver(ok, s):
    global fallas
    print(("✓ " if ok else "✗ ") + s)
    if not ok: fallas += 1

for nombre in ["pointing_up", "fist", "thumb_up"]:
    f = os.path.join(obra, nombre + ".jpg")
    urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-assets/" + nombre + ".jpg", f)
    img = mp.Image.create_from_file(f).numpy_view()[:, :, :3]
    # a 640×480 como la cámara (vecino más cercano)
    ys = (np.arange(480) * img.shape[0] / 480).astype(int); xs = (np.arange(640) * img.shape[1] / 640).astype(int)
    rgb = img[ys][:, xs].astype(np.float32)
    # RGB → YUV (BT.601 rango completo, como la cámara), U y V a la mitad e intercalados
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    Y = np.clip(0.299 * R + 0.587 * G + 0.114 * B, 0, 255)
    U = np.clip(-0.168736 * R - 0.331264 * G + 0.5 * B + 128, 0, 255)[::2, ::2]
    V = np.clip(0.5 * R - 0.418688 * G - 0.081312 * B + 128, 0, 255)[::2, ::2]
    uv = np.zeros((240, 640), np.uint8); uv[:, 0::2] = U.astype(np.uint8); uv[:, 1::2] = V.astype(np.uint8)
    Y.astype(np.uint8).tofile(os.path.join(obra, "y.bin")); uv.tofile(os.path.join(obra, "uv.bin"))
    subprocess.run(["java", "-cp", obra, "Yuv", obra, "640", "480"], check=True, stderr=subprocess.DEVNULL)
    normal, girada = leer_ppm(os.path.join(obra, "normal.ppm")), leer_ppm(os.path.join(obra, "girada.ppm"))
    directo = rgb[::2, ::2].astype(np.uint8)
    err = np.abs(normal.astype(int) - directo.astype(int)).mean()
    ver(err < 4, f"{nombre}: colores de YUV → RGB (error medio {err:.1f} de 255)")
    ver(np.abs(girada[::-1, ::-1].astype(int) - normal.astype(int)).max() == 0, f"{nombre}: la imagen girada es la misma dada vuelta")
    p0, w0 = puntos(directo)
    p1, w1 = puntos(normal)
    p2, w2 = puntos(girada)
    ver(p0 is not None and p1 is not None, f"{nombre}: encuentra la mano en la imagen convertida")
    if p0 is None or p1 is None: continue
    d = np.abs(p1 - p0).mean() * 320
    ver(d < 3, f"{nombre}: en el mismo lugar que en la foto directa ({d:.1f} px de 320)")
    if p2 is None:
        ver(False, f"{nombre}: encuentra la mano con la pantalla al revés"); continue
    # Mano.desgirar: x → 1−x, y → 1−y en la imagen; x, y → −x, −y en metros
    p2 = 1 - p2; w2 = w2 * np.array([-1, -1, 1])
    dg = np.abs(p2 - p1).mean() * 320
    dw = np.abs(w2 - w1).mean() * 1000
    ver(dg < 4 and dw < 6, f"{nombre}: con la pantalla al revés, desgirada da lo mismo ({dg:.1f} px, {dw:.1f} mm)")

print("\n✓ todo bien" if fallas == 0 else f"\n✗ {fallas} fallas")
sys.exit(1 if fallas else 0)
