#!/usr/bin/env python3
"""Cliente de Neko (PC virtual en Docker con WebRTC) por HTTP + WebSocket.

Neko expone dos superficies:
  - REST (/api/...): login, captura de pantalla, dueño del control, teclado
    "de alto nivel", portapapeles, subida de archivos, ajustes.
  - WebSocket (/api/ws): los eventos control/* , que son los unicos que
    mueven el mouse. Por REST no hay endpoint de mouse.

Este cliente usa las dos: pide la pantalla como JPG por REST y manda los
clics y las teclas por el WebSocket.

Credenciales: solo por variables de entorno, nunca en el archivo.
  NEKO_URL   https://mi-neko.ejemplo.com
  NEKO_USER  usuario (por defecto "admin")
  NEKO_PASS  contrasena
  NEKO_TOKEN token ya emitido (alternativa a usuario/contrasena)

Uso:
  neko.py estado
  neko.py ver [salida.jpg] [--calidad 90]
  neko.py tomar | soltar
  neko.py hacer '[{"mover":[640,400]},{"clic":[640,400]},{"escribir":"hola"}]'

Acciones de "hacer" (se ejecutan en orden, en una sola conexion):
  {"mover":[x,y]}                mover el puntero
  {"clic":[x,y]}                 clic izquierdo (boton 1 por defecto)
  {"clic":[x,y],"boton":3}       1 izq, 2 medio, 3 der
  {"doble":[x,y]}                doble clic
  {"apretar":[x,y],"boton":1}    boton abajo (para arrastrar)
  {"largar":[x,y],"boton":1}     boton arriba
  {"rueda":[dx,dy]}              scroll
  {"escribir":"texto"}           tipear texto (keysym por caracter)
  {"pegar":"texto largo"}        via portapapeles (rapido, unicode entero)
  {"pegar":"x","atajo":["Control_L","Shift_L","v"]}   pegar con otro atajo
  {"tecla":"Return"}             una tecla con nombre
  {"combo":["Control_L","c"]}    varias teclas juntas
  {"esperar":0.5}                pausa en segundos
  {"ver":"paso1.jpg"}            captura en ese punto de la secuencia
"""

import asyncio
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# --- keysyms X11 con nombre -------------------------------------------------
TECLAS = {
    "BackSpace": 0xFF08, "Tab": 0xFF09, "Return": 0xFF0D, "Enter": 0xFF0D,
    "Escape": 0xFF1B, "Esc": 0xFF1B, "Delete": 0xFFFF, "Insert": 0xFF63,
    "Home": 0xFF50, "End": 0xFF57, "Prior": 0xFF55, "PageUp": 0xFF55,
    "Next": 0xFF56, "PageDown": 0xFF56,
    "Left": 0xFF51, "Up": 0xFF52, "Right": 0xFF53, "Down": 0xFF54,
    "Shift_L": 0xFFE1, "Shift_R": 0xFFE2,
    "Control_L": 0xFFE3, "Control_R": 0xFFE4,
    "Caps_Lock": 0xFFE5, "Alt_L": 0xFFE9, "Alt_R": 0xFFEA,
    "Super_L": 0xFFEB, "Super_R": 0xFFEC, "Menu": 0xFF67,
    "space": 0x0020, "Print": 0xFF61,
}
for _i in range(1, 13):
    TECLAS["F%d" % _i] = 0xFFBD + _i  # F1 = 0xffbe


def keysym(ch):
    """Keysym X11 de un caracter suelto."""
    c = ord(ch)
    if c == 0x0A or c == 0x0D:
        return 0xFF0D
    if c == 0x09:
        return 0xFF09
    if 0x20 <= c <= 0x7E or 0xA0 <= c <= 0xFF:
        return c
    return 0x01000000 | c


# Neko resuelve el keysym contra el estado actual de modificadores
# (XkbKeysymToKeycode usa los mods vivos). Un keysym de mayuscula suelto cae
# en la tecla minuscula y sale minuscula: medido, "J" solo -> "j". Hay que
# mantener Shift apretado. Los simbolos salen bien con o sin Shift.
def necesita_shift(ch):
    # cualquier mayuscula, no solo A-Z: medido, "N" sin Shift sale "n"
    return ch.isalpha() and ch != ch.lower() and ch == ch.upper()


def keysym_nombre(n):
    if n in TECLAS:
        return TECLAS[n]
    if len(n) == 1:
        return keysym(n)
    if n.startswith("0x"):
        return int(n, 16)
    raise SystemExit("tecla desconocida: %s" % n)


# --- REST -------------------------------------------------------------------
CA = "/root/.ccr/ca-bundle.crt"


def contexto_ssl():
    if os.path.exists(CA):
        try:
            return ssl.create_default_context(cafile=CA)
        except Exception:
            pass
    return ssl.create_default_context()


class Neko:
    def __init__(self, base=None, usuario=None, clave=None, token=None):
        self.base = (base or os.environ.get("NEKO_URL") or "").rstrip("/")
        if not self.base:
            raise SystemExit("falta NEKO_URL")
        self.usuario = usuario or os.environ.get("NEKO_USER") or "admin"
        self.clave = clave if clave is not None else os.environ.get("NEKO_PASS")
        self.token = token or os.environ.get("NEKO_TOKEN")
        self.cookie = None
        self.id = None
        self.ctx = contexto_ssl()

    # -- transporte
    def pedir(self, ruta, metodo="GET", cuerpo=None, crudo=False, intentos=4):
        url = self.base + ruta
        if self.token:
            sep = "&" if "?" in url else "?"
            url += sep + urllib.parse.urlencode({"token": self.token})
        datos = None
        cab = {"Accept": "application/json", "Origin": self.base}
        if cuerpo is not None:
            datos = json.dumps(cuerpo).encode()
            cab["Content-Type"] = "application/json"
        if self.cookie:
            cab["Cookie"] = self.cookie
        espera = 2
        for n in range(intentos):
            req = urllib.request.Request(url, data=datos, headers=cab, method=metodo)
            try:
                with urllib.request.urlopen(req, timeout=45, context=self.ctx) as r:
                    b = r.read()
                    for k, v in r.getheaders():
                        if k.lower() == "set-cookie" and "NEKO_SESSION" in v:
                            self.cookie = v.split(";")[0]
                    if crudo:
                        return b, r.headers.get("Content-Type", "")
                    if not b:
                        return None
                    try:
                        return json.loads(b)
                    except ValueError:
                        return b.decode("utf8", "replace")
            except urllib.error.HTTPError as e:
                cuerpo_err = e.read().decode("utf8", "replace")[:400]
                raise SystemExit("HTTP %s en %s %s: %s" % (e.code, metodo, ruta, cuerpo_err))
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if n == intentos - 1:
                    raise SystemExit("red: %s %s: %s" % (metodo, ruta, e))
                time.sleep(espera)
                espera *= 2

    # -- sesion
    def entrar(self):
        if self.token:
            yo = self.pedir("/api/whoami")
            self.id = (yo or {}).get("id")
            return yo
        if not self.clave:
            raise SystemExit("falta NEKO_PASS (o NEKO_TOKEN)")
        r = self.pedir("/api/login", "POST",
                       {"username": self.usuario, "password": self.clave})
        if isinstance(r, dict):
            self.id = r.get("id")
            if r.get("token"):
                self.token = r["token"]
        return r

    def salir(self):
        try:
            self.pedir("/api/logout", "POST", intentos=1)
        except SystemExit:
            pass

    # -- pantalla y control
    def pantalla(self):
        return self.pedir("/api/room/screen")

    def captura(self, destino, calidad=90):
        b, tipo = self.pedir("/api/room/screen/shot.jpg?quality=%d" % calidad, crudo=True)
        with open(destino, "wb") as f:
            f.write(b)
        return destino, len(b), tipo

    def portapapeles(self, texto=None):
        if texto is None:
            return self.pedir("/api/room/clipboard")
        self.pedir("/api/room/clipboard", "POST", {"text": texto})

    def control(self):
        return self.pedir("/api/room/control")

    def tomar(self):
        self.pedir("/api/room/control/take", "POST")

    def soltar(self):
        self.pedir("/api/room/control/release", "POST")

    # -- websocket (lo unico que mueve el mouse)
    def url_ws(self):
        u = urllib.parse.urlsplit(self.base)
        esquema = "wss" if u.scheme == "https" else "ws"
        q = urllib.parse.urlencode({"token": self.token}) if self.token else ""
        return urllib.parse.urlunsplit((esquema, u.netloc, "/api/ws", q, ""))


ORDEN_BOTON = {1: 1, 2: 2, 3: 3}


async def correr(neko, acciones, verboso=True):
    import websockets

    cab = {}
    if neko.cookie and not neko.token:
        cab["Cookie"] = neko.cookie
    ctx = contexto_ssl() if neko.url_ws().startswith("wss") else None
    # close_timeout corto a proposito: Neko no contesta el handshake de cierre,
    # asi que el timeout se quema entero al salir. Medido: con 5 s cada corrida
    # tardaba 6,1 s de los cuales 5 eran esto; con 0,3 s baja a ~1,4 s. Antes
    # de cerrar ya se espera 0,3 s, asi que no se pierde ningun evento.
    async with websockets.connect(neko.url_ws(), additional_headers=cab,
                                  origin=neko.base, ssl=ctx,
                                  open_timeout=30, close_timeout=.3) as ws:
        init = None
        fin = time.time() + 10
        while time.time() < fin:
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=fin - time.time()))
            except asyncio.TimeoutError:
                break
            if m.get("event") == "system/init":
                init = m.get("payload") or {}
                break
        if init and verboso:
            print("conectado: sesion %s, pantalla %sx%s" % (
                init.get("session_id"),
                (init.get("screen_size") or {}).get("width"),
                (init.get("screen_size") or {}).get("height")))

        async def mandar(ev, carga=None):
            await ws.send(json.dumps({"event": ev, "payload": carga or {}}))
            await asyncio.sleep(.035)

        for a in acciones:
            b = ORDEN_BOTON.get(int(a.get("boton", 1)), 1)
            if "mover" in a:
                x, y = a["mover"]
                await mandar("control/move", {"x": int(x), "y": int(y)})
            elif "clic" in a or "doble" in a:
                x, y = a.get("clic") or a["doble"]
                await mandar("control/move", {"x": int(x), "y": int(y)})
                vueltas = 2 if "doble" in a else 1
                for _ in range(vueltas):
                    await mandar("control/buttondown", {"x": int(x), "y": int(y), "code": b})
                    await mandar("control/buttonup", {"x": int(x), "y": int(y), "code": b})
                    await asyncio.sleep(.05)
            elif "apretar" in a:
                x, y = a["apretar"]
                await mandar("control/buttondown", {"x": int(x), "y": int(y), "code": b})
            elif "largar" in a:
                x, y = a["largar"]
                await mandar("control/buttonup", {"x": int(x), "y": int(y), "code": b})
            elif "rueda" in a:
                dx, dy = a["rueda"]
                await mandar("control/scroll", {"delta_x": int(dx), "delta_y": int(dy),
                                                "control_key": bool(a.get("ctrl"))})
            elif "escribir" in a:
                for ch in str(a["escribir"]):
                    k = keysym(ch)
                    sh = necesita_shift(ch)
                    if sh:
                        await mandar("control/keydown", {"keysym": TECLAS["Shift_L"]})
                    await mandar("control/keydown", {"keysym": k})
                    await mandar("control/keyup", {"keysym": k})
                    if sh:
                        await mandar("control/keyup", {"keysym": TECLAS["Shift_L"]})
            elif "tecla" in a:
                n = str(a["tecla"])
                k = keysym_nombre(n)
                sh = len(n) == 1 and necesita_shift(n)
                if sh:
                    await mandar("control/keydown", {"keysym": TECLAS["Shift_L"]})
                await mandar("control/keydown", {"keysym": k})
                await mandar("control/keyup", {"keysym": k})
                if sh:
                    await mandar("control/keyup", {"keysym": TECLAS["Shift_L"]})
            elif "combo" in a:
                ks = [keysym_nombre(n) for n in a["combo"]]
                for k in ks:
                    await mandar("control/keydown", {"keysym": k})
                for k in reversed(ks):
                    await mandar("control/keyup", {"keysym": k})
            elif "pegar" in a:
                # tipear letra por letra son ~14 car/s; para texto largo se
                # carga el portapapeles por REST (pide ser host) y se dispara
                # el pegado. control/paste manda Ctrl+V: sirve en campos de
                # texto y navegadores, NO en una terminal (medido: xfce4-
                # terminal lo ignora). Para esos casos pasar el atajo real,
                # p.ej. {"pegar":"...","atajo":["Control_L","Shift_L","v"]}
                neko.portapapeles(str(a["pegar"]))
                await asyncio.sleep(.25)
                if a.get("atajo"):
                    ks = [keysym_nombre(n) for n in a["atajo"]]
                    for k in ks:
                        await mandar("control/keydown", {"keysym": k})
                    for k in reversed(ks):
                        await mandar("control/keyup", {"keysym": k})
                else:
                    await mandar("control/paste", {})
            elif "esperar" in a:
                await asyncio.sleep(float(a["esperar"]))
            elif "ver" in a:
                await asyncio.sleep(.4)
                d, n, _ = neko.captura(a["ver"], int(a.get("calidad", 90)))
                if verboso:
                    print("captura %s (%d bytes)" % (d, n))
            else:
                raise SystemExit("accion desconocida: %s" % json.dumps(a))
            if verboso and "esperar" not in a and "ver" not in a:
                print("ok %s" % json.dumps(a, ensure_ascii=False))
        await asyncio.sleep(.3)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    cmd = argv[1]
    neko = Neko()
    neko.entrar()

    if cmd == "estado":
        print(json.dumps({
            "yo": neko.pedir("/api/whoami"),
            "pantalla": neko.pantalla(),
            "control": neko.control(),
        }, indent=2, ensure_ascii=False))
    elif cmd == "ver":
        destino = argv[2] if len(argv) > 2 and not argv[2].startswith("-") else "pantalla.jpg"
        calidad = 90
        if "--calidad" in argv:
            calidad = int(argv[argv.index("--calidad") + 1])
        d, n, t = neko.captura(destino, calidad)
        print("%s (%d bytes, %s)" % (d, n, t))
    elif cmd == "tomar":
        neko.tomar()
        print(json.dumps(neko.control()))
    elif cmd == "soltar":
        neko.soltar()
        print(json.dumps(neko.control()))
    elif cmd == "hacer":
        acciones = json.loads(argv[2]) if len(argv) > 2 else json.load(sys.stdin)
        if isinstance(acciones, dict):
            acciones = [acciones]
        try:
            neko.tomar()
        except SystemExit as e:
            print("aviso: no pude tomar el control (%s); sigo igual" % e)
        asyncio.run(correr(neko, acciones))
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
