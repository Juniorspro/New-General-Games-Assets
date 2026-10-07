#!/usr/bin/env python3
"""Exporta una zona del mundo de Slime Rancher (la escena worldGenerated del APK) para el motor web.

    python -I exportar.py DATOS SALIDA [--zona zoneRANCH] [--tex-max 1024]

DATOS es assets/bin/Data del APK (sacado con unzip). Escribe en SALIDA:
    zona.json   ambiente y luces, materiales, shaders, texturas, piezas y dibujos
    geo.bin     la geometría de las piezas y las matrices de las instancias
    tex/*.webp  las texturas

Todo queda en las coordenadas de Unity (mano izquierda, Y arriba): el motor web arma las
matrices como Unity y los shaders originales (el GLSL de Android, que WebGL 2 corre tal cual)
reciben lo mismo que en el juego.
  - Cada malla se guarda una vez y se dibuja con instancias: el rancho dibuja 1,47 millones
    de triángulos pero guardados son 200 mil.
  - La geometría que Unity juntó para el static batching ya está en el mundo: va por material
    y por celda, con una sola instancia.
  - Recolorizer: los materiales del rancho y de la casa toman la paleta DEFAULT de RanchDirector.
  - AmbianceDirector, TimeDirector y las luces con TimeOfDayRotator: el día y la noche.

Lo bajado es de terceros: los datos se leen, no se ejecuta nada. Correr con python -I.
"""
import argparse
import collections
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from unitydatos import Juego, Mallas, Shaders, Texturas, color, cuaternion, log, trs  # noqa: E402

# RanchDirector.SetColors: los 16 colores de la paleta y su propiedad en el shader Recolor x8
PALETA = [("_Color00", "redDark"), ("_Color01", "redLight"), ("_Color10", "greenDark"), ("_Color11", "greenLight"),
          ("_Color20", "blueDark"), ("_Color21", "blueLight"), ("_Color30", "blackDark"), ("_Color31", "blackLight"),
          ("_Color40", "magentaDark"), ("_Color41", "magentaLight"), ("_Color50", "yellowDark"), ("_Color51", "yellowLight"),
          ("_Color60", "cyanDark"), ("_Color61", "cyanLight"), ("_Color70", "whiteDark"), ("_Color71", "whiteLight")]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("datos")
    ap.add_argument("salida", type=Path)
    ap.add_argument("--zona", default="zoneRANCH")
    ap.add_argument("--tex-max", type=int, default=1024)
    a = ap.parse_args()
    t0 = time.time()
    a.salida.mkdir(parents=True, exist_ok=True)

    j = Juego(a.datos)
    nivel = j.archivo("level3")
    objs = nivel.objects
    log(f"escena: {len(objs):,} objetos ({time.time() - t0:.0f} s)")

    def comps(go):
        out = {}
        for c in go.m_Component:
            try:
                o = c.component.deref()
            except Exception:
                continue
            out.setdefault(o.type.name, []).append(o)
        return out

    def transform(go):
        c = comps(go)
        return (c.get("Transform") or c.get("RectTransform"))[0].read()

    def mundo(t):
        """Matriz de mundo de un Transform (sube por los padres)."""
        m = trs(t)
        p = t.m_Father
        while p.path_id:
            pt = p.deref().read()
            m = trs(pt) @ m
            p = pt.m_Father
        return m

    # ── los scripts que importan, en toda la escena ──
    por_clase = collections.defaultdict(list)
    for o in objs.values():
        if o.type.name == "MonoBehaviour":
            try:
                por_clase[j.clase(o)[0]].append(o)
            except Exception:
                pass
    ranch = j.mb(por_clase["RanchDirector"][0])
    amb_dir = j.mb(por_clase["AmbianceDirector"][0])
    time_dir = j.mb(por_clase["TimeDirector"][0])

    # Recolorizer: qué materiales se recolorean y con qué colores (paleta DEFAULT = 0).
    def entrada(tipo_paleta):
        for e in ranch["palettes"]:
            if e["palette"] == 0:
                return e
    recolor = {}
    for lista in ("ranchMats", "houseMats"):
        for ref in ranch[lista]:
            o = j.ptr(por_clase["RanchDirector"][0].assets_file, ref)
            if o is not None:
                recolor[(o.assets_file.name, o.path_id)] = {p: color(entrada(0)[c]) for p, c in PALETA}
    recolorizados = set()
    for o in por_clase["Recolorizer"]:
        recolorizados.add(j.mb(o)["m_GameObject"]["m_PathID"])

    # ── la zona: recorrido con matrices, activo, celda, física y recoloreo ──
    raiz = next((o.read() for o in objs.values() if o.type.name == "GameObject" and o.read().m_Name == a.zona), None)
    if raiz is None:
        raise SystemExit(f"no está {a.zona}")
    t_raiz = transform(raiz)
    m_raiz = mundo(t_raiz) @ np.linalg.inv(trs(t_raiz))
    nodos = []
    pila = [(raiz, m_raiz, True, None, False, False)]
    while pila:
        go, m_padre, activo, celda, dinamico, reco = pila.pop()
        c = comps(go)
        t = (c.get("Transform") or c.get("RectTransform"))[0].read()
        m = m_padre @ trs(t)
        activo = activo and bool(go.m_IsActive)
        if go.m_Name.startswith("cell"):
            celda = go.m_Name
        dinamico = dinamico or "Rigidbody" in c or "Animator" in c or "Animation" in c
        reco = reco or go.object_reader.path_id in recolorizados
        nodos.append((go, c, m, activo, celda, dinamico, reco))
        for h in t.m_Children:
            pila.append((h.deref().read().m_GameObject.read(), m, activo, celda, dinamico, reco))
    log(f"{a.zona}: {len(nodos)} GameObjects ({time.time() - t0:.0f} s)")

    lod_fuera = set()
    for go, c, *_ in nodos:
        for lg in c.get("LODGroup", []):
            for i, lod in enumerate(lg.read().m_LODs):
                if i:
                    lod_fuera.update(r.renderer.path_id for r in lod.renderers if r.renderer.path_id)

    mallas = Mallas()
    shaders = Shaders()
    texturas = Texturas(a.salida / "tex", a.tex_max)
    materiales, mat_indice = [], {}

    def material(o, reco=False):
        k = (o.assets_file.name, o.path_id)
        colores = recolor.get(k) if reco else None
        kk = (k, bool(colores))
        if kk in mat_indice:
            return mat_indice[kk]
        md = o.read()
        sh = md.m_Shader.read()
        palabras = set(md.m_ShaderKeywords.split()) if md.m_ShaderKeywords else set()
        palabras |= {"DIRECTIONAL", "FOG_EXP2"}
        props = md.m_SavedProperties
        tex = {}
        for nombre, te in props.m_TexEnvs:
            i = None
            if te.m_Texture.path_id:
                try:
                    i = texturas.indice(te.m_Texture.deref(), nombre)
                except Exception:
                    i = None
            tex[nombre] = {"t": i, "st": [te.m_Scale.x, te.m_Scale.y, te.m_Offset.x, te.m_Offset.y]}
        cols = {n: color(c) for n, c in props.m_Colors}
        if colores:
            cols.update(colores)
        materiales.append({"nombre": md.m_Name + (" (recoloreado)" if colores else ""), "shader": shaders.indice(sh, palabras),
                           "cola": md.m_CustomRenderQueue, "keywords": sorted(palabras), "tex": tex,
                           "floats": {n: v for n, v in props.m_Floats}, "colores": cols})
        mat_indice[kk] = len(materiales) - 1
        return mat_indice[kk]

    # piezas: (malla, submalla) en su espacio, o lo combinado por (material, celda) en el mundo
    piezas = {}
    instanciadas = collections.defaultdict(list)   # (pieza, material, celda) -> [matrices]
    combinadas = collections.defaultdict(list)     # (material, celda) -> [(malla, submalla)]
    omitidos = collections.Counter()
    for go, c, m, activo, celda, dinamico, reco in nodos:
        if not activo or "MeshRenderer" not in c or "MeshFilter" not in c:
            continue
        rd_o = c["MeshRenderer"][0]
        rd = rd_o.read()
        if not rd.m_Enabled:
            omitidos["renderer apagado"] += 1
            continue
        if rd_o.path_id in lod_fuera:
            omitidos["LOD 1 o más"] += 1
            continue
        if dinamico:
            omitidos["con física o animación (va aparte)"] += 1
            continue
        mf = c["MeshFilter"][0].read()
        if not mf.m_Mesh.path_id:
            continue
        mo = mf.m_Mesh.deref()
        try:
            malla = mallas.leer(mo)
        except Exception as e:
            omitidos["malla sin leer: " + type(e).__name__] += 1
            continue
        mk = (mo.assets_file.name, mo.path_id)
        sb = rd.m_StaticBatchInfo
        subs = list(range(sb.firstSubMesh, sb.firstSubMesh + sb.subMeshCount)) if sb.subMeshCount else list(range(len(malla["sub"])))
        for i, ptr in enumerate(rd.m_Materials):
            if not ptr.path_id:
                continue
            s = subs[min(i, len(subs) - 1)]
            if malla["sub"][s].size == 0:
                continue
            try:
                mi = material(ptr.deref(), reco)
            except Exception as e:
                omitidos["material sin leer: " + type(e).__name__] += 1
                continue
            if sb.subMeshCount:
                combinadas[(mi, celda or "")].append((mk, s))
            else:
                instanciadas[((mk, s), mi, celda or "")].append(m)

    # ── geo.bin ──
    geo = bytearray()

    def poner(arr):
        while len(geo) % 4:
            geo.append(0)
        off = len(geo)
        geo.extend(np.ascontiguousarray(arr).tobytes())
        return off

    lista_piezas, pieza_indice = [], {}

    def pieza(partes):
        """Una pieza de geometría: partes = [(malla, submalla, matriz o None)]; se juntan y se escriben."""
        pos, nrm, uv0, uv1, col, idx, n = [], [], [], [], [], [], 0
        for mk, s, mm in partes:
            malla = mallas.cache[mk]
            usados, local = np.unique(malla["sub"][s], return_inverse=True)
            p = malla["pos"][usados].astype(np.float64)
            nm = malla["nrm"][usados] if malla["nrm"] is not None else np.tile([0.0, 1.0, 0.0], (len(usados), 1))
            loc = local.reshape(-1, 3)
            if mm is not None:
                p = (np.c_[p, np.ones(len(p))] @ mm.T)[:, :3]
                nm = nm @ np.linalg.inv(mm[:3, :3])
                if np.linalg.det(mm[:3, :3]) < 0:
                    loc = loc[:, [0, 2, 1]]
            nm = nm / np.maximum(np.linalg.norm(nm, axis=1, keepdims=True), 1e-8)
            pos.append(p.astype(np.float32)); nrm.append(nm.astype(np.float32))
            for lista, canal, dim, defecto in ((uv0, "uv0", 2, 0.0), (uv1, "uv1", 2, 0.0), (col, "col", 4, 1.0)):
                v = malla[canal]
                lista.append(v[usados] if v is not None else np.full((len(usados), dim), defecto, np.float32))
            idx.append(loc.reshape(-1) + n)
            n += len(usados)
        pos = np.concatenate(pos); nrm = np.concatenate(nrm); idx = np.concatenate(idx)
        uv1 = np.concatenate(uv1); col = np.concatenate(col)
        tipo = np.uint16 if n < 65536 else np.uint32
        info = {"n": n, "indices": int(idx.size), "min": pos.min(0).tolist(), "max": pos.max(0).tolist(),
                "pos": poner(pos), "nrm": poner(np.clip(np.round(nrm * 127), -127, 127).astype(np.int8)),
                "uv0": poner(np.concatenate(uv0).astype(np.float32)), "idx": poner(idx.astype(tipo)), "idx32": tipo is np.uint32}
        if np.any(uv1):
            info["uv1"] = poner(uv1.astype(np.float32))
        if not np.allclose(col, 1.0):
            info["col"] = poner(np.clip(np.round(col * 255), 0, 255).astype(np.uint8))
        lista_piezas.append(info)
        return len(lista_piezas) - 1

    def caja_mundo(pz, matrices):
        lo, hi = np.array(pz["min"]), np.array(pz["max"])
        esquinas = np.array([[x, y, z, 1] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
        todos = np.concatenate([esquinas @ m.T for m in matrices])[:, :3]
        return todos.min(0).round(3).tolist(), todos.max(0).round(3).tolist()

    dibujos = []
    tris_guardados = tris_dibujados = 0
    for (mi, celda), partes in sorted(combinadas.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        pi = pieza([(mk, s, None) for mk, s in partes])
        pz = lista_piezas[pi]
        dibujos.append({"pieza": pi, "material": mi, "celda": celda, "inst": None, "n": 1,
                        "min": [round(v, 3) for v in pz["min"]], "max": [round(v, 3) for v in pz["max"]]})
        tris_guardados += pz["indices"] // 3; tris_dibujados += pz["indices"] // 3
    for (pk, mi, celda), matrices in sorted(instanciadas.items(), key=lambda kv: (kv[0][2], kv[0][1])):
        if pk not in pieza_indice:
            pieza_indice[pk] = pieza([(pk[0], pk[1], None)])
            tris_guardados += lista_piezas[pieza_indice[pk]]["indices"] // 3
        pi = pieza_indice[pk]
        pz = lista_piezas[pi]
        # matrices por columnas (como hlslcc_mtx4x4 de Unity)
        inst = poner(np.stack([m.T.reshape(-1) for m in matrices]).astype(np.float32))
        lo, hi = caja_mundo(pz, matrices)
        dibujos.append({"pieza": pi, "material": mi, "celda": celda, "inst": inst, "n": len(matrices), "min": lo, "max": hi})
        tris_dibujados += pz["indices"] // 3 * len(matrices)
    (a.salida / "geo.bin").write_bytes(bytes(geo))

    # ── ambiente, tiempo, luces que giran y cielo ──
    rs = next(o.read() for o in objs.values() if o.type.name == "RenderSettings")
    ambiente = {"modo": rs.m_AmbientMode, "cielo": color(rs.m_AmbientSkyColor), "intensidad": rs.m_AmbientIntensity,
                "niebla": bool(rs.m_Fog), "niebla_modo": rs.m_FogMode, "niebla_color": color(rs.m_FogColor),
                "niebla_densidad": rs.m_FogDensity, "niebla_inicio": rs.m_LinearFogStart, "niebla_fin": rs.m_LinearFogEnd}
    cielo = material(rs.m_SkyboxMaterial.deref()) if rs.m_SkyboxMaterial.path_id else None
    zonas = []
    for z in amb_dir["zones"]:
        zonas.append({k: (color(v) if isinstance(v, dict) else v) for k, v in z.items()})
    ambiancia = {"zonas": zonas, "dusk": color(amb_dir["duskLightColor"]), "agua_niebla": amb_dir["waterFogDensity"],
                 "transicion": amb_dir["zoneSettingTransitionTime"]}
    rotadores = []
    for o in por_clase["TimeOfDayRotator"]:
        d = j.mb(o)
        go = objs[d["m_GameObject"]["m_PathID"]].read()
        if not go.m_IsActive:
            continue
        t = transform(go)
        m_rot = mundo(t)
        luces = []
        pila = [go]
        while pila:
            g = pila.pop()
            cg = comps(g)
            for lo in cg.get("Light", []):
                l = lo.read()
                ml = mundo((cg.get("Transform") or cg.get("RectTransform"))[0].read())
                local = np.linalg.inv(m_rot) @ ml
                luces.append({"tipo": l.m_Type, "color": color(l.m_Color)[:3], "intensidad": l.m_Intensity,
                              "activa": bool(l.m_Enabled and g.m_IsActive), "rot_local": cuaternion(local)})
            for h in (cg.get("Transform") or cg.get("RectTransform"))[0].read().m_Children:
                pila.append(h.deref().read().m_GameObject.read())
        rotadores.append({"nombre": go.m_Name, "noche": bool(d["isNightLight"]), "rot": cuaternion(m_rot), "luces": luces})

    zona = {"zona": a.zona, "ambiente": ambiente, "ambiancia": ambiancia, "segundos_por_dia": time_dir["secsPerGameDay"],
            "rotadores": rotadores, "cielo": cielo, "shaders": shaders.lista, "materiales": materiales,
            "texturas": texturas.lista, "piezas": lista_piezas, "dibujos": dibujos}
    (a.salida / "zona.json").write_text(json.dumps(zona, ensure_ascii=False, separators=(",", ":")))
    log(f"piezas {len(lista_piezas)}, dibujos {len(dibujos)}, triángulos guardados {tris_guardados:,} "
        f"(dibujados {tris_dibujados:,}), materiales {len(materiales)}, shaders {len(shaders.lista)}, "
        f"texturas {len(texturas.lista)}, geo.bin {len(geo) / 1048576:.1f} MB ({time.time() - t0:.0f} s)")
    log("omitidos:", dict(omitidos))
    sin = [s["nombre"] for s in shaders.lista if not s["pasadas"]]
    if sin:
        log("shaders sin pasada usable:", sin)
    for aviso in sorted(shaders.avisos):
        log("swizzle sin arreglar:", aviso)


if __name__ == "__main__":
    main()
