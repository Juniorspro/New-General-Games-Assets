#!/usr/bin/env python3
"""Cliente para el MCP de Mint (mint.gg), que genera assets 3D, mundos,
materiales, imágenes y audio.

EL MCP DE MINT NO SE BAJA. No es un paquete de npm ni un binario: es un
servidor REMOTO en https://mcp.mint.gg/mcp que habla Streamable HTTP y exige un
bearer de OAuth. "Bajarlo", entonces, es registrar un cliente y conseguir el
token; no hay nada que instalar.

Y hay una vuelta más: esta sesión corre en un contenedor remoto, así que el
navegador donde vos autorizás NO puede llegar a un `localhost` de acá. Por eso
el ida y vuelta es a mano —te doy la URL, la abrís, y me pegás a dónde te
mandó—. Es el mismo intercambio que hace un cliente con callback, sólo que el
código lo traés vos.

    python3 herramientas/mint/mint.py entrar          # registra y da la URL
    python3 herramientas/mint/mint.py canjear '<url o código>'
    python3 herramientas/mint/mint.py tools
    python3 herramientas/mint/mint.py call <herramienta> '<json>'
    python3 herramientas/mint/mint.py estado

El token va a ~/.mint/credenciales.json con permisos 600, NUNCA al repositorio.
"""
import base64, hashlib, json, os, secrets, sys, time, urllib.error, urllib.parse, urllib.request

BASE = "https://mcp.mint.gg"
MCP = BASE + "/mcp"
CASA = os.path.expanduser("~/.mint")
CRED = os.path.join(CASA, "credenciales.json")
REDIR = "http://127.0.0.1:7391/callback"
ALCANCE = "mint:read mint:projects:write mint:generate:start mint:generate:approve"
PROTO = "2025-06-18"


# ---------------------------------------------------------------- guardado
def leer():
    try:
        with open(CRED) as f:
            return json.load(f)
    except Exception:
        return {}


def guardar(d):
    os.makedirs(CASA, mode=0o700, exist_ok=True)
    tmp = CRED + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f, indent=1)
    os.chmod(tmp, 0o600)
    os.replace(tmp, CRED)


# -------------------------------------------------------------------- http
def pedir(url, datos=None, cab=None, metodo=None):
    cuerpo = None
    cab = dict(cab or {})
    if datos is not None:
        cuerpo = json.dumps(datos).encode()
        cab.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=cuerpo, headers=cab, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


# ------------------------------------------------------------------ oauth
def metadatos():
    _, _, b = pedir(BASE + "/.well-known/oauth-authorization-server")
    return json.loads(b)


def registrar():
    d = leer()
    if d.get("client_id"):
        return d["client_id"]
    md = metadatos()
    st, _, b = pedir(md.get("registration_endpoint", BASE + "/oauth/register"), {
        "client_name": "Claude Code (General-Assets-Games)",
        "redirect_uris": [REDIR],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
        "scope": ALCANCE,
    })
    if st >= 300:
        raise SystemExit("MINT: no se pudo registrar el cliente (%d): %s" % (st, b[:400].decode("utf8", "replace")))
    r = json.loads(b)
    d.update({"client_id": r["client_id"], "registro": r})
    guardar(d)
    return r["client_id"]


def entrar():
    cid = registrar()
    md = metadatos()
    ver = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode()
    reto = base64.urlsafe_b64encode(hashlib.sha256(ver.encode()).digest()).rstrip(b"=").decode()
    estado = secrets.token_urlsafe(16)
    d = leer(); d.update({"verificador": ver, "estado": estado}); guardar(d)
    url = md["authorization_endpoint"] + "?" + urllib.parse.urlencode({
        "response_type": "code", "client_id": cid, "redirect_uri": REDIR,
        "scope": ALCANCE, "state": estado,
        "code_challenge": reto, "code_challenge_method": "S256",
        # el servidor lo pide para saber a qué recurso vale el token
        "resource": MCP,
    })
    print("MINT: 1) abrí esto en tu navegador y autorizá:\n")
    print(url)
    print("\nMINT: 2) vas a caer en una página que NO carga (127.0.0.1 es de este")
    print("      contenedor, no de tu máquina). No importa: copiá la URL entera")
    print("      de la barra de direcciones y pasámela:\n")
    print("      python3 herramientas/mint/mint.py canjear '<la url>'")


def canjear(entrada):
    d = leer()
    if not d.get("client_id") or not d.get("verificador"):
        raise SystemExit("MINT: falta 'entrar' primero")
    cod = entrada.strip()
    if "://" in cod or cod.startswith("?") or "code=" in cod:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(cod).query or cod.lstrip("?"))
        if q.get("error"):
            raise SystemExit("MINT: el servidor devolvió error: %s" % q["error"][0])
        if q.get("state", [None])[0] not in (None, d.get("estado")):
            raise SystemExit("MINT: el 'state' no coincide — no canjeo eso")
        cod = q.get("code", [""])[0]
    if not cod:
        raise SystemExit("MINT: no encontré el código en lo que me pasaste")
    md = metadatos()
    cuerpo = urllib.parse.urlencode({
        "grant_type": "authorization_code", "code": cod,
        "redirect_uri": REDIR, "client_id": d["client_id"],
        "code_verifier": d["verificador"], "resource": MCP,
    }).encode()
    req = urllib.request.Request(md["token_endpoint"], data=cuerpo,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            t = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit("MINT: el canje falló (%d): %s" % (e.code, e.read()[:400].decode("utf8", "replace")))
    d.pop("verificador", None); d.pop("estado", None)
    d["token"] = t
    d["vence"] = time.time() + float(t.get("expires_in", 3600)) - 60
    guardar(d)
    print("MINT: adentro. Alcances: %s" % t.get("scope", ALCANCE))


def refrescar(d):
    t = d.get("token") or {}
    if not t.get("refresh_token"):
        return False
    md = metadatos()
    cuerpo = urllib.parse.urlencode({
        "grant_type": "refresh_token", "refresh_token": t["refresh_token"],
        "client_id": d["client_id"], "resource": MCP,
    }).encode()
    req = urllib.request.Request(md["token_endpoint"], data=cuerpo,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            n = json.loads(r.read())
    except urllib.error.HTTPError:
        return False
    n.setdefault("refresh_token", t["refresh_token"])
    d["token"] = n
    d["vence"] = time.time() + float(n.get("expires_in", 3600)) - 60
    guardar(d)
    return True


def bearer():
    d = leer()
    if not d.get("token"):
        raise SystemExit("MINT: no hay token. Corré 'entrar' y después 'canjear'.")
    if time.time() > d.get("vence", 0):
        refrescar(d)
        d = leer()
    return d["token"]["access_token"]


# -------------------------------------------------------------------- mcp
class Mcp:
    """Streamable HTTP: cada llamada es un POST y la respuesta puede volver
    como JSON o como un flujo SSE. Hay que aceptar las dos y quedarse con el
    último `data:`, o se pierden las respuestas de las herramientas lentas."""

    def __init__(self):
        self.tok = bearer()
        self.sesion = None
        self.n = 0

    def _cab(self):
        c = {"Authorization": "Bearer " + self.tok,
             "Accept": "application/json, text/event-stream",
             "MCP-Protocol-Version": PROTO}
        if self.sesion:
            c["Mcp-Session-Id"] = self.sesion
        return c

    def _leer(self, cab, cuerpo):
        tipo = (cab.get("Content-Type") or cab.get("content-type") or "")
        txt = cuerpo.decode("utf8", "replace")
        if "text/event-stream" in tipo:
            ultimo = None
            for linea in txt.splitlines():
                if linea.startswith("data:"):
                    try:
                        ultimo = json.loads(linea[5:].strip())
                    except json.JSONDecodeError:
                        pass
            return ultimo if ultimo is not None else {}
        return json.loads(txt) if txt.strip() else {}

    def rpc(self, metodo, params=None, aviso=False):
        m = {"jsonrpc": "2.0", "method": metodo, "params": params or {}}
        if not aviso:
            self.n += 1
            m["id"] = self.n
        st, cab, b = pedir(MCP, m, self._cab())
        sid = cab.get("Mcp-Session-Id") or cab.get("mcp-session-id")
        if sid:
            self.sesion = sid
        if st == 401:
            d = leer()
            if refrescar(d):
                self.tok = leer()["token"]["access_token"]
                st, cab, b = pedir(MCP, m, self._cab())
            else:
                raise SystemExit("MINT: el token no sirve más. Corré 'entrar' otra vez.")
        if st >= 400:
            raise SystemExit("MINT: %s devolvió %d: %s" % (metodo, st, b[:600].decode("utf8", "replace")))
        return {} if aviso else self._leer(cab, b)

    def arrancar(self):
        r = self.rpc("initialize", {"protocolVersion": PROTO, "capabilities": {},
                                    "clientInfo": {"name": "mint.py", "version": "1.0"}})
        self.rpc("notifications/initialized", aviso=True)
        return r


def texto(res):
    r = res.get("result", res)
    partes = [c["text"] for c in (r.get("content") or []) if c.get("type") == "text"]
    if r.get("structuredContent"):
        partes.append(json.dumps(r["structuredContent"], ensure_ascii=False, indent=2))
    return "\n".join(partes) or json.dumps(r, ensure_ascii=False, indent=2)


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    modo = sys.argv[1]

    if modo == "entrar":
        entrar(); return
    if modo == "canjear":
        canjear(sys.argv[2]); return
    if modo == "estado":
        d = leer()
        print("MINT: cliente %s · token %s · vence en %s" % (
            d.get("client_id", "—"),
            "sí" if d.get("token") else "no",
            ("%d s" % (d.get("vence", 0) - time.time())) if d.get("token") else "—"))
        return

    m = Mcp()
    ini = m.arrancar()
    if modo == "tools":
        srv = (ini.get("result") or {}).get("serverInfo") or {}
        if srv:
            print("MINT: %s %s" % (srv.get("name", "?"), srv.get("version", "")))
        r = m.rpc("tools/list")
        for t in (r.get("result") or {}).get("tools", []):
            print("\n▸ %s" % t["name"])
            d = (t.get("description") or "").strip().split("\n")[0]
            print("    %s" % d[:160])
            esq = t.get("inputSchema") or {}
            if esq.get("required"):
                print("    obligatorios: %s" % ", ".join(esq["required"]))
            props = list((esq.get("properties") or {}).keys())
            if props:
                print("    acepta: %s" % ", ".join(props[:16]))
    elif modo == "call":
        args = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
        print(texto(m.rpc("tools/call", {"name": sys.argv[2], "arguments": args})))
    elif modo == "raw":
        print(json.dumps(m.rpc(sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}),
                         ensure_ascii=False, indent=2))
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main()
