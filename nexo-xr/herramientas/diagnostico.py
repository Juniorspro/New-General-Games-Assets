#!/usr/bin/env python3
"""Analiza un diagnóstico de Nexo XR (Ajustes → Acerca de → Grabar).

    python3 herramientas/diagnostico.py nexo-diagnostico-AAAAMMDD-HHMMSS.jsonl

Dice, con números de ESE teléfono: cuánto se perdió el seguimiento y por qué,
cuánto tiembla y cuánto se desliza ARCore quieto (y cuánto lo que dibuja Nexo
Track), los saltos, la demora, y cómo andan las manos (cuánto se ven, cuánto
tiemblan, cuántas veces se cortan).
"""
import json
import math
import statistics as st
import sys


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(p / 100 * len(v)))] if v else float("nan")


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a[:3], b[:3])))


def angulo(qa, qb):
    d = abs(sum(x * y for x, y in zip(qa, qb)))
    return math.degrees(2 * math.acos(min(1.0, d)))


def main(ruta):
    with open(ruta, encoding="utf-8") as f:
        cab = json.loads(f.readline())
        cs = [json.loads(l) for l in f if l.strip()]
    if not cs:
        print("el archivo no tiene cuadros")
        return
    dur = (cs[-1]["t"] - cs[0]["t"]) / 1000
    print(f"Nexo {cab.get('nexo')} · {cab.get('modelo')} · Android {cab.get('android')} · cámara: {cab.get('camara')}")
    print(f"visor: {'sí' if cab.get('sbs') else 'no'} · campo {cab.get('fov')}° · predicción {cab.get('anticipo')} ms · "
          f"ojos {'medidos' if cab.get('ojoAuto') else 'a mano'} {[round(x * 100, 1) for x in cab.get('ojos', [])]} cm "
          f"({cab.get('cuello', {}).get('medidas')} medidas)")
    fotos = sum(c.get("n", 0) for c in cs)
    print(f"\n{len(cs)} cuadros en {dur:.1f} s: {len(cs) / dur:.0f} cuadros/s dibujados, {fotos / dur:.0f} fotos/s de la cámara")

    # ── el seguimiento ──
    rastrea = [c["r"] for c in cs]
    print(f"\nSEGUIMIENTO: {100 * sum(rastrea) / len(rastrea):.0f}% del tiempo con ARCore")
    perdidas, razones, largo, desde = 0, {}, 0, None
    for i, c in enumerate(cs):
        if not c["r"] and (i == 0 or cs[i - 1]["r"]):
            perdidas += 1
            desde = c["t"]
        if not c["r"] and c.get("f"):
            razones[c["f"]] = razones.get(c["f"], 0) + 1
        if c["r"] and desde is not None:
            largo = max(largo, c["t"] - desde)
            desde = None
    print(f"  se perdió {perdidas} veces (la más larga {largo / 1000:.1f} s)")
    for r, n in sorted(razones.items(), key=lambda x: -x[1]):
        print(f"    · {r}: {100 * n / len(cs):.0f}% de los cuadros")
    ds = [c["d"] for c in cs if c.get("d") is not None]
    print(f"  se lleva con el giroscopio {st.median(ds):.0f} ms (p95 {pct(ds, 95):.0f})")

    # saltos de ARCore (entre fotos nuevas) y de lo que se dibuja
    saltosA, saltosO = [], []
    prevA = prevO = None
    for c in cs:
        if c.get("a") and c.get("n"):
            if prevA is not None:
                saltosA.append(dist(c["a"], prevA))
            prevA = c["a"]
        if c.get("o"):
            if prevO is not None:
                saltosO.append(dist(c["o"], prevO))
            prevO = c["o"]
    grandesA = sum(1 for s in saltosA if s > 0.05)
    grandesO = sum(1 for s in saltosO if s > 0.03)
    print(f"  saltos de ARCore de más de 5 cm entre fotos: {grandesA} (el más grande {100 * max(saltosA or [0]):.1f} cm)")
    print(f"  saltos de lo que se ve de más de 3 cm entre cuadros: {grandesO} (el más grande {100 * max(saltosO or [0]):.1f} cm)")
    print(f"  el ancla corrigió hasta {max(c['c'][0] for c in cs):.1f} cm y {max(c['c'][1] for c in cs):.2f}°")

    # quieto: la cabeza casi sin girar (< 4°/s) al menos 1 s
    ventanas, actual = [], []
    for c in cs:
        if c.get("w", 99) < 4 and c.get("a") and c.get("o"):
            actual.append(c)
        else:
            if len(actual) > 1 and actual[-1]["t"] - actual[0]["t"] >= 1000:
                ventanas.append(actual)
            actual = []
    if len(actual) > 1 and actual[-1]["t"] - actual[0]["t"] >= 1000:
        ventanas.append(actual)
    if ventanas:
        tA, tO, rO, desl = [], [], [], []
        for v in ventanas:
            for clave, lista in (("a", tA), ("o", tO)):
                m = [sum(c[clave][k] for c in v) / len(v) for k in range(3)]
                lista.append(1000 * math.sqrt(sum(dist(c[clave], m) ** 2 for c in v) / len(v)))
            q0 = v[0]["o"][3:]
            rO.append(max(angulo(c["o"][3:], q0) for c in v))
            desl.append(100 * dist(v[-1]["a"], v[0]["a"]) / ((v[-1]["t"] - v[0]["t"]) / 1000))
        print(f"  quieto ({len(ventanas)} ratos, {sum((v[-1]['t'] - v[0]['t']) for v in ventanas) / 1000:.0f} s):")
        print(f"    ARCore tiembla {st.median(tA):.1f} mm y se desliza {st.median(desl):.2f} cm/s")
        print(f"    lo que se ve tiembla {st.median(tO):.1f} mm y gira hasta {st.median(rO):.2f}°")
    else:
        print("  no hubo ratos quieto (> 1 s sin girar): para medir el temblor, quedate quieto unos segundos")

    # ── las manos ──
    if cab.get("manos"):
        print("\nMANOS:")
        for s in range(2):
            vis = [c for c in cs if c.get("h") and len(c["h"]) > s and c["h"][s]]
            if not vis:
                print(f"  mano {s + 1}: no se vio")
                continue
            cortes, i = 0, 0
            vistas = [bool(c.get("h") and len(c["h"]) > s and c["h"][s]) for c in cs]
            for i in range(1, len(cs) - 1):
                if vistas[i - 1] and not vistas[i]:
                    j = i
                    while j < len(cs) and not vistas[j]:
                        j += 1
                    if j < len(cs) and cs[j]["t"] - cs[i]["t"] < 300:
                        cortes += 1
            pell = sum(1 for a, b in zip(vis, vis[1:]) if b["h"][s]["p"] and not a["h"][s]["p"])
            # temblor de la punta del índice (8) cuando la mano está casi quieta (ventanas de 0.5 s)
            temb, v = [], []
            for c in vis:
                p = c["h"][s]["x"][24:27]
                if v and (c["t"] - v[0][0] > 500):
                    pts = [x[1] for x in v]
                    m = [sum(q[k] for q in pts) / len(pts) for k in range(3)]
                    r = math.sqrt(sum(dist(q, m) ** 2 for q in pts) / len(pts))
                    if r < 0.02:
                        temb.append(1000 * r)
                    v = []
                v.append((c["t"], p))
            print(f"  mano {s + 1}: se ve {100 * len(vis) / len(cs):.0f}% del tiempo · se cortó {cortes} veces un ratito (< 0.3 s) · "
                  f"{pell} pellizcos · la punta del índice tiembla {st.median(temb) if temb else float('nan'):.1f} mm quieta")

    # ── lo que conviene ──
    print("\nLO QUE SE VE:")
    if perdidas and razones:
        r = max(razones.items(), key=lambda x: x[1])[0]
        print(f"  · la causa de pérdida más común: {r}")
    if ventanas and st.median(desl) > 0.5:
        print("  · ARCore se desliza quieto: poca textura o la cámara tapada (¿la tapa del visor?)")
    if grandesO:
        print("  · hay saltos en lo que se ve: mandame este archivo")
    if fotos / dur < 25:
        print("  · la cámara da pocas fotos por segundo: más luz ayuda (con poca luz baja a 15)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
