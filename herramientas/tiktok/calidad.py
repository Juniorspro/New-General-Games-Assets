#!/usr/bin/env python3
"""Mira y baja un video de TikTok en su MEJOR variante.

    python3 calidad.py ver   <url> [<url>...]        # metadatos, no baja nada
    python3 calidad.py bajar <url> <salida.mp4>      # baja la mejor variante

POR QUE EXISTE, si ya esta bajar.py: ssstik devuelve UNA sola version, y no
siempre la mejor. TikTok publica varias variantes con distinto bitrate en el
JSON de la propia pagina; aca se elige la de bitrate mas alto.

Ojo con la conclusion facil: que salga poca resolucion no siempre es culpa del
bajador. Medido el 2026-09-21 sobre @tekno_edit_/7656541594300222727: la mejor
variante que ofrece TikTok es 720x720 a 350 kb/s, porque el video se subio en
576x576. Ahi no hay nada que rescatar — el que mide primero no rehace el
bajador al pedo.

LA TRAMPA DE LA BAJADA: la URL del CDN exige Referer de tiktok.com. Sin eso
devuelve 403. Y hay que reusar la misma sesion que leyo la pagina, por las
cookies.
"""
import json
import re
import sys

import requests

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")


def sesion():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    return s


def ficha(s, url):
    """Devuelve los datos del video sin bajar un solo byte de video."""
    h = s.get(url, timeout=60).text
    m = re.search(r'id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', h, re.S)
    if not m:
        raise SystemExit(f"{url}: la pagina no trae el JSON de rehidratacion")
    d = json.loads(m.group(1))["__DEFAULT_SCOPE__"]
    it = d.get("webapp.video-detail", {}).get("itemInfo", {}).get("itemStruct")
    if not it:
        raise SystemExit(f"{url}: sin itemStruct (privado, borrado o bloqueado)")
    v = it["video"]
    # de mayor a menor bitrate: la primera es la que queremos
    variantes = sorted(v.get("bitrateInfo", []), key=lambda b: -b.get("Bitrate", 0))
    return {
        "id": it["id"], "autor": it["author"]["uniqueId"], "desc": it.get("desc", ""),
        "duracion": v.get("duration"), "ancho": v.get("width"), "alto": v.get("height"),
        "variantes": [{
            "nombre": b.get("GearName"), "bitrate": b.get("Bitrate"),
            "ancho": b["PlayAddr"].get("Width"), "alto": b["PlayAddr"].get("Height"),
            "urls": b["PlayAddr"].get("UrlList", []),
        } for b in variantes],
    }


def bajar(s, url, destino):
    f = ficha(s, url)
    if not f["variantes"]:
        raise SystemExit(f"{url}: sin variantes de video")
    mejor = f["variantes"][0]
    ultimo = None
    for u in mejor["urls"]:                      # las 3 URLs son CDNs distintos
        try:
            r = s.get(u, timeout=240, headers={"Referer": "https://www.tiktok.com/"})
            if r.status_code == 200 and len(r.content) > 10000:
                open(destino, "wb").write(r.content)
                return f, mejor, len(r.content)
            ultimo = f"HTTP {r.status_code}, {len(r.content)} bytes"
        except Exception as e:
            ultimo = str(e)
    raise SystemExit(f"{url}: no se pudo bajar ninguna URL ({ultimo})")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    s = sesion()
    if sys.argv[1] == "ver":
        for u in sys.argv[2:]:
            try:
                f = ficha(s, u)
            except SystemExit as e:
                print(f"\n{u}\n   {e}")
                continue
            v = f["variantes"][0] if f["variantes"] else {}
            print(f"\n@{f['autor']}/{f['id']}  {f['duracion']}s  {f['ancho']}x{f['alto']}")
            print(f"   mejor: {v.get('ancho')}x{v.get('alto')} @ {v.get('bitrate')} bps ({v.get('nombre')})")
            print(f"   desc: {f['desc'][:110]}")
    elif sys.argv[1] == "bajar":
        f, mejor, n = bajar(s, sys.argv[2], sys.argv[3])
        print(f"@{f['autor']}/{f['id']} -> {sys.argv[3]}  "
              f"{mejor['ancho']}x{mejor['alto']} @ {mejor['bitrate']} bps, {n} bytes")
    else:
        sys.exit(__doc__)
