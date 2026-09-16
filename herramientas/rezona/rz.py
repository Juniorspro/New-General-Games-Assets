#!/usr/bin/env python3
"""Cliente stdio para el MCP de Rezona Lab.

Existe porque los servidores MCP se cargan al arrancar la sesión: si el
servidor se declara después, esa sesión no lo ve y hay que hablarle a mano.

    python3 herramientas/rezona/rz.py tools
    python3 herramientas/rezona/rz.py call <herramienta> '<json>'
    python3 herramientas/rezona/rz.py batch '<json con lista de llamadas>'

LA TRAMPA QUE RESUELVE: el servidor contesta a medida que termina cada
llamada, así que con varias en vuelo las respuestas vuelven DESORDENADAS.
Emparejarlas por posición cruza los resultados en silencio. Aquí se
emparejan por el `id` del JSON-RPC, y nunca por el orden de llegada.
"""
import json, subprocess, sys, threading, queue, time

CMD = ["npx", "-y", "rezona@latest", "mcp"]


class Mcp:
    def __init__(self, timeout=600):
        self.timeout = timeout
        self.p = subprocess.Popen(
            CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, bufsize=1,
        )
        self.q = queue.Queue()
        self.n = 0
        threading.Thread(target=self._leer, daemon=True).start()
        threading.Thread(target=self._stderr, daemon=True).start()

    def _leer(self):
        for linea in self.p.stdout:
            linea = linea.strip()
            if not linea:
                continue
            try:
                self.q.put(json.loads(linea))
            except json.JSONDecodeError:
                pass          # en modo mcp nada más debería salir por stdout

    def _stderr(self):
        for linea in self.p.stderr:
            if linea.strip():
                print("  [srv]", linea.rstrip(), file=sys.stderr)

    def _enviar(self, obj):
        self.p.stdin.write(json.dumps(obj) + "\n")
        self.p.stdin.flush()

    def notify(self, metodo, params=None):
        self._enviar({"jsonrpc": "2.0", "method": metodo, "params": params or {}})

    def pedir(self, metodo, params=None):
        """Manda una petición y devuelve su id. No espera."""
        self.n += 1
        self._enviar({"jsonrpc": "2.0", "id": self.n,
                      "method": metodo, "params": params or {}})
        return self.n

    def recoger(self, ids):
        """Espera las respuestas de esos ids y las devuelve indexadas POR ID."""
        pendientes, hechas = set(ids), {}
        limite = time.time() + self.timeout
        while pendientes and time.time() < limite:
            try:
                m = self.q.get(timeout=2)
            except queue.Empty:
                continue
            i = m.get("id")
            if i in pendientes:          # ← el emparejamiento correcto
                hechas[i] = m
                pendientes.discard(i)
        for i in pendientes:
            hechas[i] = {"id": i, "error": {"message": "sin respuesta (timeout)"}}
        return hechas

    def llamar(self, metodo, params=None):
        i = self.pedir(metodo, params)
        return self.recoger([i])[i]

    def arrancar(self):
        r = self.llamar("initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "rz.py", "version": "1.0"},
        })
        self.notify("notifications/initialized")
        return r

    def cerrar(self):
        try:
            self.p.stdin.close()
            self.p.wait(timeout=5)
        except Exception:
            self.p.kill()


def texto(res):
    """Saca el contenido útil de un resultado de tools/call."""
    r = res.get("result", res)
    partes = []
    for c in (r.get("content") or []):
        if c.get("type") == "text":
            partes.append(c["text"])
    if r.get("structuredContent"):
        partes.append(json.dumps(r["structuredContent"], ensure_ascii=False, indent=2))
    return "\n".join(partes) or json.dumps(r, ensure_ascii=False, indent=2)


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    modo = sys.argv[1]
    m = Mcp()
    try:
        m.arrancar()

        if modo == "tools":
            r = m.llamar("tools/list")
            for t in r.get("result", {}).get("tools", []):
                print(f"\n▸ {t['name']}")
                d = (t.get("description") or "").strip().split("\n")[0]
                print(f"    {d[:150]}")
                req = (t.get("inputSchema") or {}).get("required") or []
                props = list(((t.get("inputSchema") or {}).get("properties") or {}).keys())
                if req:   print(f"    obligatorios: {', '.join(req)}")
                if props: print(f"    acepta: {', '.join(props[:14])}")

        elif modo == "call":
            args = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
            print(texto(m.llamar("tools/call", {"name": sys.argv[2], "arguments": args})))

        elif modo == "batch":
            # [{"name": "...", "arguments": {...}}, ...]  →  resultados por id
            lote = json.loads(sys.argv[2])
            ids = {}
            for j, c in enumerate(lote):
                i = m.pedir("tools/call", {"name": c["name"], "arguments": c.get("arguments", {})})
                ids[i] = (j, c["name"])
            for i, res in sorted(m.recoger(list(ids)).items()):
                j, nombre = ids[i]
                print(f"\n═══ [{j}] {nombre}  (id {i}) ═══")
                print(texto(res))

        else:
            print(__doc__); sys.exit(1)
    finally:
        m.cerrar()


if __name__ == "__main__":
    main()
