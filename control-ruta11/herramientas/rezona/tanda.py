"""Tanda de generaciones en Rezona para Control Ruta 11: manda, espera, baja y anota.

Uso: python3 tanda.py pedidos.json carpeta_destino
Cada pedido que sale bien queda en estado.json (repetirlo cuesta créditos).
Los códigos transitorios se reintentan con espera; los terminales no.
La llave vive en ~/.rezona/credentials.json (fuera del repo, nunca se imprime).
"""
import json, os, sys, time
sys.path.insert(0, "/home/user/New-General-Games-Assets/estancia/herramientas/rezona")
from rz import api, bajar, BASE
AQUI = os.path.dirname(os.path.abspath(__file__))
ESTADO = os.path.join(AQUI, "estado.json")
TRANSITORIOS = {"CREDIT_RESERVE_FAILED", "GENERATION_RATE_LIMITED", "UPSTREAM_UNAVAILABLE", "GENERATION_TOO_MANY_IN_FLIGHT", "NO_JSON"}
E = json.load(open(ESTADO)) if os.path.exists(ESTADO) else {"pid": None, "pedidos": {}}
def guardar(): json.dump(E, open(ESTADO, "w"), indent=1, ensure_ascii=False)
if not E["pid"]:
    r = api("POST", "/api/projects", {"name": "control-ruta11"})
    E["pid"] = (r.get("data") or {}).get("ref") or (r.get("data") or {}).get("id") or (r.get("data") or {}).get("project_id"); guardar()
    print("proyecto:", E["pid"], flush=True)
PID = E["pid"]
# La URL pública usa el public_id (texto), no el id numérico: con el número la
# referencia no existe y el 3D sale "desde texto" sin avisar.
if not E.get("ref"):
    E["ref"] = (api("GET", f"/api/projects/{PID}").get("data") or {}).get("public_id"); guardar()
def publica(salida): return f"{BASE}/pv/{E['ref']}/{salida}"

def resolver(p):
    """Los pedidos pueden apuntar a otros ya hechos: "@clave" en source_url o source_task_id."""
    pr = dict(p["params"])
    for k in ("source_url", "source_task_id"):
        v = pr.get(k)
        if isinstance(v, str) and v.startswith("@"):
            dep = E["pedidos"].get(v[1:])
            if not dep or not dep.get("archivo"): return None
            pr[k] = publica(dep["output_path"]) if k == "source_url" else dep["task_id"]
    return pr

def mandar(p, pr):
    cuerpo = {"type": p["type"], "output_path": p["output_path"], p["type"]: pr}
    for espera in (0, 8, 20, 45, 90):
        if espera: time.sleep(espera)
        r = api("POST", f"/api/projects/{PID}/generations", cuerpo)
        if r.get("success"): return r["data"]
        if r.get("code") not in TRANSITORIOS:
            print(f"  ✗ {p['clave']}: {r.get('code')} {r.get('message')}", flush=True); return None
        print(f"  … {p['clave']}: {r.get('code')}, reintento", flush=True)
    return None

def correr(pedidos, carpeta, esperar_max=1500):
    os.makedirs(carpeta, exist_ok=True)
    saldo0 = api("GET", "/api/credits/pat-balance")["data"]["balance"]
    vivos, pendientes = {}, list(pedidos)
    # Retomar lo que ya se mandó y todavía no bajó (no se paga dos veces).
    for p in pedidos:
        ent = E["pedidos"].get(p["clave"])
        if ent and ent.get("task_id") and not ent.get("archivo") and not ent.get("error"):
            vivos[ent["task_id"]] = p; pendientes.remove(p)
    t0 = time.time()
    while (pendientes or vivos) and time.time() - t0 < esperar_max:
        for p in list(pendientes):
            if E["pedidos"].get(p["clave"], {}).get("archivo"): pendientes.remove(p); continue
            pr = resolver(p)
            if pr is None: continue  # espera a su dependencia
            pendientes.remove(p)
            d = mandar(p, pr)
            if d:
                E["pedidos"][p["clave"]] = {"type": p["type"], "params": pr, "task_id": d["task_id"], "output_path": d.get("output_path")}
                vivos[d["task_id"]] = p; guardar()
                print(f"  → {p['clave']}: {d['task_id']}", flush=True)
        if not vivos:
            if pendientes: print("  dependencias sin resolver:", [p["clave"] for p in pendientes], flush=True)
            break
        time.sleep(10)
        r = api("POST", "/api/generations/status", {"task_ids": list(vivos)})
        for it in (r.get("data") or {}).get("items") or []:
            tid, st = it.get("task_id"), it.get("status")
            if tid not in vivos or st in ("pending", "queued", "running", "processing", "generating", None): continue
            p = vivos.pop(tid); ent = E["pedidos"][p["clave"]]; ent["estado"] = st
            if st in ("succeeded", "success", "completed", "done", "ready"):
                rel = (ent["output_path"] or "").replace("assets/", "", 1)
                destino = os.path.join(carpeta, os.path.basename(rel))
                if bajar(PID, rel, destino): ent["archivo"] = destino; print(f"  ✓ {p['clave']}: {os.path.getsize(destino)/1024:.0f} KB ({time.time()-t0:.0f}s)", flush=True)
                else: print(f"  ✗ {p['clave']}: no se pudo bajar {rel}", flush=True)
            else: ent["error"] = it.get("error"); print(f"  ✗ {p['clave']}: {st} {it.get('error')}", flush=True)
            guardar()
    for tid, p in vivos.items(): print(f"  ⏳ {p['clave']}: sigue sin terminar", flush=True)
    saldo1 = api("GET", "/api/credits/pat-balance")["data"]["balance"]
    print(f"gastado en esta tanda: {saldo0 - saldo1} créditos (saldo {saldo1})", flush=True)

if __name__ == "__main__":
    correr(json.load(open(sys.argv[1])), sys.argv[2])
