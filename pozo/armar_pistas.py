# Arma una pista larga con los segmentos generados.
#
# EL PROBLEMA QUE RESUELVE: el generador corta en ~10 s por mas que se le pidan
# 30 (medido: 8,78 a 10,29 s en los nueve pedidos). Un bucle de 10 s se
# reconoce enseguida y a los dos minutos cansa. Encadenando A-B-A-C el oido
# tarda el CUADRUPLE en volver a oir lo mismo, con el mismo material.
#
# Y LOS CRUCES NO SON ADORNO: dos MP3 pegados de punta dan un chasquido en la
# junta, porque la onda salta de golpe. Se cruzan 400 ms y ademas la cola de la
# pista se funde sobre su propia cabeza, que es lo que hace que el bucle cierre
# sin golpe cuando `s.loop = true` lo repite.
import subprocess, sys, os, glob, json, math
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
D = "/tmp/claude-0/pozo/assets"
SAL = "/tmp/claude-0/pozo/pistas_nuevas"
os.makedirs(SAL, exist_ok=True)

CRUCE = 0.40          # entre segmentos
CIERRE = 0.70         # de la cola sobre la cabeza, para que el bucle no golpee
SR = 44100

def wav(mp3, out):
    subprocess.run([FF, "-y", "-i", mp3, "-ac", "2", "-ar", str(SR), out],
                   capture_output=True, check=True)
    return out

def dur(f):
    r = subprocess.run([FF, "-i", f], capture_output=True, text=True)
    import re
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1))*3600 + int(m.group(2))*60 + float(m.group(3))

import wave, array
def leer(f):
    with wave.open(f) as w:
        n = w.getnframes()
        a = array.array("h"); a.frombytes(w.readframes(n))
        return a, w.getnchannels()

def escribir(f, a, ch):
    with wave.open(f, "w") as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(a.tobytes())

def encadena(segs, ch=2):
    """Pega con cruce de igual potencia: con un cruce lineal el medio del cruce
    BAJA de volumen, porque dos senales distintas no se suman en amplitud."""
    n = int(CRUCE * SR) * ch
    out = array.array("h", segs[0])
    for s in segs[1:]:
        m = min(n, len(out), len(s))
        cola = out[len(out)-m:]
        for i in range(m):
            t = (i // ch) / (m // ch)
            g1, g2 = math.cos(t*math.pi/2), math.sin(t*math.pi/2)
            v = int(cola[i]*g1 + s[i]*g2)
            out[len(out)-m+i] = max(-32768, min(32767, v))
        out.extend(s[m:])
    return out

def cierra_bucle(a, ch=2):
    """Funde la cola sobre la cabeza para que el salto del bucle no se oiga."""
    n = int(CIERRE * SR) * ch
    n = min(n, len(a)//3)
    for i in range(n):
        t = (i // ch) / (n // ch)
        g = math.sin(t*math.pi/2)
        j = len(a) - n + i
        v = int(a[j]*g + a[i]*(1-g))
        a[i] = max(-32768, min(32767, v))
    return a[:len(a)-n]

AMB = {"menu": ["a","b","a","c"], "pelea": ["a","b","a","c"], "jefe": ["a","b","a","c"]}
res = {}
for amb, orden in AMB.items():
    trozos = {}
    for l in set(orden):
        g = glob.glob(f"{D}/mus_{amb}_{l}-g*.mp3")
        if not g: continue
        trozos[l] = leer(wav(sorted(g)[0], f"/tmp/claude-0/pozo/_{amb}_{l}.wav"))[0]
    usa = [l for l in orden if l in trozos]
    if not usa: print(f"  {amb}: sin segmentos"); continue
    a = cierra_bucle(encadena([trozos[l] for l in usa]))
    w = f"/tmp/claude-0/pozo/_{amb}.wav"; escribir(w, a, 2)
    mp3 = f"{SAL}/m_{amb}.mp3"
    subprocess.run([FF, "-y", "-i", w, "-codec:a", "libmp3lame", "-b:a", "96k",
                    "-ar", str(SR), mp3], capture_output=True, check=True)
    res[amb] = (dur(mp3), os.path.getsize(mp3)//1024, "".join(usa))
    print(f"  m_{amb}.mp3  {res[amb][0]:5.2f} s  {res[amb][1]:4d} KB  orden {res[amb][2].upper()}")
json.dump({k:{"seg":v[0],"kb":v[1],"orden":v[2]} for k,v in res.items()},
          open(f"{SAL}/medido.json","w"), indent=1)
