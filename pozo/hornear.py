# Mete las pistas nuevas adentro del HTML, en el mismo sitio donde estaban las
# viejas: la tabla SONB, que el juego ya sabe decodificar. No hay codigo nuevo
# que mantener — el sistema de musica del juego ya andaba, lo que fallaba era
# que las pistas duraban ocho segundos.
import re, json, base64, os, sys

HTML = "/tmp/claude-0/pozo/pozo_nuevo.html"
NUEVAS = "/tmp/claude-0/pozo/pistas_nuevas"

s = open(HTML).read()
m = re.search(r"const\s+SONB\s*=\s*", s)
j = m.end(); d = 0
for k in range(j, len(s)):
    if s[k] == '{': d += 1
    elif s[k] == '}':
        d -= 1
        if d == 0: fin = k; break
T = json.loads(s[j:fin+1])

antes = {k: len(base64.b64decode(v.split(",")[-1])) for k, v in T.items() if k.startswith("m_")}
cambiadas = []
for amb in ("menu", "pelea", "jefe"):
    p = f"{NUEVAS}/m_{amb}.mp3"
    if not os.path.exists(p): print(f"  falta {p}"); continue
    T[f"m_{amb}"] = base64.b64encode(open(p, "rb").read()).decode()
    cambiadas.append(amb)

nuevo = json.dumps(T, separators=(",", ":"))
s = s[:j] + nuevo + s[fin+1:]
open(HTML, "w").write(s)

print("  pistas cambiadas:", ", ".join(cambiadas))
for k, v in antes.items():
    ahora = len(base64.b64decode(T[k]))
    print(f"    {k:9s} {v/1024:6.1f} KB -> {ahora/1024:7.1f} KB")
print(f"  el HTML quedo en {os.path.getsize(HTML)/1024/1024:.2f} MB")
