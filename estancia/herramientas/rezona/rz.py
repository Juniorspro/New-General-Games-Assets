"""Cliente mínimo de la API de Rezona por curl (sin correr el paquete de npm)."""
import json, subprocess, sys, time
CRED = json.load(open("/root/.rezona/credentials.json"))
BASE, AUTH = CRED["baseUrl"].rstrip("/"), f"Authorization: Bearer {CRED['token']}"
def api(m, ruta, cuerpo=None):
    cmd = ["curl", "-s", "--max-time", "60", "-X", m, "-H", AUTH]
    if cuerpo is not None: cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(cuerpo)]
    out = subprocess.run(cmd + [BASE + ruta], capture_output=True, text=True).stdout
    try: return json.loads(out)
    except Exception: return {"success": False, "code": "NO_JSON", "message": out[:200]}
def bajar(pid, rel, destino):
    return subprocess.run(["curl", "-s", "--max-time", "300", "-f", "-H", AUTH, "-o", destino, f"{BASE}/api/projects/{pid}/files/assets/{rel}"]).returncode == 0
