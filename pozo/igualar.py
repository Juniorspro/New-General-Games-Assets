# Iguala el volumen de las pistas nuevas al de las que traia el juego.
#
# EL GENERADOR DEVUELVE TODO MASTERIZADO FUERTE, y una pista mas caliente que
# la anterior no se arregla bajando el bus: los numeros de mezcla de este
# archivo (bus del menu, bus de partida, y de ahi la relacion con cada efecto)
# estan medidos contra las pistas viejas. Si se toca el bus hay que volver a
# medir TODO; si se iguala la pista, no se toca ninguna constante.
# El patron es la pista vieja: se mide el RMS de las dos y se escala.
import subprocess, os, wave, array, math, json, glob
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
VIEJAS = "/tmp/claude-0/pozo/pistas"          # las que venian horneadas
NUEVAS = "/tmp/claude-0/pozo/pistas_nuevas"

def rms(mp3):
    w = mp3 + ".ref.wav"
    subprocess.run([FF, "-y", "-i", mp3, "-ac", "2", "-ar", "44100", w],
                   capture_output=True, check=True)
    with wave.open(w) as f:
        a = array.array("h"); a.frombytes(f.readframes(f.getnframes()))
    os.remove(w)
    if not len(a): return 0
    return math.sqrt(sum(float(x)*x for x in a) / len(a)) / 32768.0

info = {}
for amb in ("menu", "pelea", "jefe"):
    viejo, nuevo = f"{VIEJAS}/m_{amb}.mp3", f"{NUEVAS}/m_{amb}.mp3"
    rv, rn = rms(viejo), rms(nuevo)
    g = rv / rn if rn else 1.0
    fin = f"{NUEVAS}/m_{amb}_igual.mp3"
    subprocess.run([FF, "-y", "-i", nuevo, "-filter:a", f"volume={g:.5f}",
                    "-codec:a", "libmp3lame", "-b:a", "96k", fin],
                   capture_output=True, check=True)
    rf = rms(fin)
    info[amb] = {"vieja": round(rv,5), "nueva": round(rn,5),
                 "ganancia": round(g,4), "quedo": round(rf,5)}
    print(f"  m_{amb:6s} vieja {rv:.5f}  nueva {rn:.5f}  x{g:.3f}  ->  {rf:.5f}")
    os.replace(fin, nuevo)
json.dump(info, open(f"{NUEVAS}/igualado.json","w"), indent=1)
