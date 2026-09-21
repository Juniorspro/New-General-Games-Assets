#!/usr/bin/env python3
"""Baja un video de TikTok sin marca de agua, via ssstik.

    python3 bajar.py <url> <salida.mp4>

La trampa: el token 'tt' se genera por pagina y hay que scrapearlo de
https://ssstik.io/en antes de cada tanda. El POST va con cabeceras de htmx
(HX-Request) o devuelve la pagina entera en vez del bloque con los enlaces.
"""
import re
import sys

import requests

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0 Safari/537.36")


def sesion():
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    tt = re.search(r"tt\s*=\s*'([^']+)'", s.get("https://ssstik.io/en", timeout=30).text)
    if not tt:
        raise SystemExit("ssstik cambio: no aparece el token tt")
    return s, tt.group(1)


def bajar(s, tt, url, destino):
    r = s.post("https://ssstik.io/abc?url=dl", timeout=90,
               headers={"HX-Request": "true", "HX-Current-URL": "https://ssstik.io/en",
                        "Origin": "https://ssstik.io", "Referer": "https://ssstik.io/en"},
               data={"id": url, "locale": "en", "tt": tt})
    r.raise_for_status()
    enlaces = re.findall(r'href="(https://tikcdn\.io/[^"]+)"', r.text)
    if not enlaces:
        raise SystemExit(f"sin enlaces para {url}")
    v = s.get(enlaces[0], timeout=180)   # el primero es el mp4 sin marca
    v.raise_for_status()
    open(destino, "wb").write(v.content)
    return len(v.content)


if __name__ == "__main__":
    s, tt = sesion()
    print(bajar(s, tt, sys.argv[1], sys.argv[2]), "bytes")
