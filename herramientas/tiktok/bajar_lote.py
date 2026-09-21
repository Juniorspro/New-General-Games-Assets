#!/usr/bin/env python3
"""Baja una lista de videos de TikTok, uno por linea.

    python3 bajar_lote.py corpus.txt carpeta_destino

LA TRAMPA, que cuesta media hora si no se sabe: el token de ssstik se genera
POR PAGINA. Reusarlo devuelve una respuesta sin enlaces, que no parece un error
de token sino que el video no existe. Hay que pedir uno nuevo en CADA descarga.

Salta lo ya bajado, asi que se puede volver a correr sobre la misma lista.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bajar import bajar, sesion  # noqa: E402


def nombre(url):
    """@cuenta/video/123 -> cuenta_123.mp4"""
    partes = url.rstrip("/").split("/")
    return f"{partes[-3].lstrip('@').replace('.', '_')}_{partes[-1].split('?')[0]}.mp4"


if __name__ == "__main__":
    lista, destino = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "."
    os.makedirs(destino, exist_ok=True)
    urls = [l.strip() for l in open(lista) if l.strip() and not l.startswith("#")]

    ok = saltados = fallos = 0
    for i, u in enumerate(urls, 1):
        salida = os.path.join(destino, nombre(u))
        if os.path.exists(salida):
            saltados += 1
            continue
        try:
            s, tt = sesion()                       # token fresco: ver arriba
            n = bajar(s, tt, u, salida)
            ok += 1
            print(f"[{i}/{len(urls)}] {os.path.basename(salida)}  {n//1024} KB")
        # SystemExit, no Exception: bajar() corta con sys.exit cuando el video
        # no devuelve enlaces, y eso NO lo agarra un `except Exception`. Sin
        # esto, un solo video caido termina el lote entero en silencio.
        except (Exception, SystemExit) as e:
            fallos += 1
            print(f"[{i}/{len(urls)}] FALLO {u.split('/')[-1]}: {str(e)[:60]}")
        time.sleep(1.5)                            # no apurar al servicio

    print(f"\nbajados {ok} · ya estaban {saltados} · fallaron {fallos}")
