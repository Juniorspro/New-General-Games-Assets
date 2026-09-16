#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Firma pases de sesion de prueba, para no tener que entrar a mano.

POR QUE EXISTE: las pruebas necesitan una sesion, y entrar de verdad pide
Google/Discord/llave de acceso, que en una maquina sin navegador de persona no
se puede. Un pase es un JSON firmado con HMAC-SHA256 usando SECRETO: con el
mismo secreto que usa el servidor, se puede fabricar uno valido aca.

SOLO SIRVE EN LOCAL. Usa el SECRETO de .dev.vars, que es distinto al de
produccion —el de produccion es un secreto de Cloudflare y no se puede leer—,
asi que un pase hecho aca no abre nada en el sitio de verdad.

    python3 pases.py            -> escribe /tmp/pase.txt (jefe) y /tmp/pase2.txt
"""
import base64, hashlib, hmac, json, os, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
DEV = os.path.join(AQUI, "..", ".dev.vars")

def secreto():
    if not os.path.exists(DEV):
        sys.exit("No encontre .dev.vars al lado de wrangler.toml. Sin SECRETO no hay pase.")
    for linea in open(DEV, encoding="utf-8"):
        if linea.startswith("SECRETO="):
            return linea.split("=", 1)[1].strip().encode()
    sys.exit("No hay una linea SECRETO= en .dev.vars.")

def b64u(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")

def pase(sec, uid, nombre, dias=90):
    cuerpo = {"u": uid, "n": nombre, "exp": int(time.time() * 1000) + dias * 86400000}
    txt = b64u(json.dumps(cuerpo, separators=(",", ":")).encode())
    return txt + "." + b64u(hmac.new(sec, txt.encode(), hashlib.sha256).digest())

if __name__ == "__main__":
    s = secreto()
    for archivo, uid, nombre in (("/tmp/pase.txt", 1, "probador"),
                                 ("/tmp/pase2.txt", 2, "otro")):
        open(archivo, "w").write(pase(s, uid, nombre))
        print(archivo, "->", nombre, "(cuenta", str(uid) + ")")
