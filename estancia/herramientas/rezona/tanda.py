"""Tanda de generaciones en Rezona: manda, espera, baja y anota.

Cada pedido que sale bien queda en estado-estancia.json con sus parámetros:
repetir una tanda cuesta créditos, y lo más caro de averiguar son los
parámetros que funcionan (GUIA-JUEGOS.md § 1). Los códigos transitorios se
reintentan con espera; los terminales no.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rz import api, bajar
TRANSITORIOS = {"CREDIT_RESERVE_FAILED", "GENERATION_RATE_LIMITED", "UPSTREAM_UNAVAILABLE", "GENERATION_TOO_MANY_IN_FLIGHT", "NO_JSON"}
E = json.load(open("estado-estancia.json")); PID = E["pid"]
def guardar(): json.dump(E, open("estado-estancia.json", "w"), indent=1, ensure_ascii=False)

def mandar(p):
    cuerpo = {"type": p["type"], "output_path": p["output_path"], p["type"]: p["params"]}
    for espera in (0, 8, 20, 45, 90):
        if espera: time.sleep(espera)
        r = api("POST", f"/api/projects/{PID}/generations", cuerpo)
        if r.get("success"): return r["data"]
        if r.get("code") not in TRANSITORIOS:
            print(f"  ✗ {p['clave']}: {r.get('code')} {r.get('message')}", flush=True); return None
        print(f"  … {p['clave']}: {r.get('code')}, reintento", flush=True)
    return None

def correr(pedidos, carpeta, esperar_max=900):
    os.makedirs(carpeta, exist_ok=True)
    saldo0 = api("GET", "/api/credits/pat-balance")["data"]["balance"]
    vivos = {}
    for p in pedidos:
        if p["clave"] in E["pedidos"] and E["pedidos"][p["clave"]].get("archivo"): continue
        d = mandar(p)
        if d:
            E["pedidos"][p["clave"]] = {"type": p["type"], "params": p["params"], "task_id": d["task_id"], "output_path": d.get("output_path")}
            vivos[d["task_id"]] = p
            guardar()
            print(f"  → {p['clave']}: {d['task_id']}", flush=True)
    t0 = time.time()
    while vivos and time.time() - t0 < esperar_max:
        time.sleep(8)
        r = api("POST", "/api/generations/status", {"task_ids": list(vivos)})
        for it in (r.get("data") or {}).get("items") or []:
            tid, st = it.get("task_id"), it.get("status")
            if tid not in vivos or st in ("pending", "queued", "running", "processing", "generating", None): continue
            p = vivos.pop(tid)
            ent = E["pedidos"][p["clave"]]
            ent["estado"] = st
            if st in ("succeeded", "success", "completed", "done", "ready"):
                rel = (ent["output_path"] or "").replace("assets/", "", 1)
                destino = os.path.join(carpeta, os.path.basename(rel))
                if bajar(PID, rel, destino):
                    ent["archivo"] = destino; ent["public_url"] = it.get("public_url")
                    print(f"  ✓ {p['clave']}: {os.path.getsize(destino)/1024:.0f} KB", flush=True)
                else: print(f"  ✗ {p['clave']}: no se pudo bajar {rel}", flush=True)
            else:
                ent["error"] = it.get("error"); print(f"  ✗ {p['clave']}: {st} {it.get('error')}", flush=True)
            guardar()
    for tid, p in vivos.items(): print(f"  ⏳ {p['clave']}: sigue sin terminar", flush=True)
    saldo1 = api("GET", "/api/credits/pat-balance")["data"]["balance"]
    print(f"gastado en esta tanda: {saldo0 - saldo1} créditos (saldo {saldo1})", flush=True)

if __name__ == "__main__":
    correr(json.load(open(sys.argv[1])), sys.argv[2])
