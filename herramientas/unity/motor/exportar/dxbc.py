"""Los shaders de DirectX 11 de un build de Unity 2021.2 o más nuevo (Windows) para el motor.

Un build de PC trae sólo el bytecode de D3D11 (DXBC), y además Unity le saca la reflexión (el
chunk RDEF: los nombres de los constant buffers, de sus variables y de las texturas). Para
traducirlo a GLSL con HLSLcc (dxbc/dxbc-glsl, el traductor de Unity) se arma un RDEF nuevo con
lo que el shader sí guarda: los parámetros comunes de cada programa (m_CommonParameters) y los
de cada variante (un blob aparte en 2021.2+). Así el GLSL sale con los mismos nombres que el de
GLES3 de un APK (_MainTex_ST, hlslcc_mtx4x4unity_ObjectToWorld...) y el motor lo usa igual.

Queda en la convención de D3D (Z invertida de 0 a 1, la fila 0 arriba): al final del vertex se
pasa a la de GL (ver EPILOGO) y el motor dibuja como Unity en D3D11 (ver Render/Convencion.cs).
"""
import os
import re
import struct
import subprocess
import tempfile

import lz4.block

PLATAFORMA_D3D11 = 4
VERSION_PROGRAMA = 202012090
# ShaderGpuProgramType de 2021+: vertex SM4/SM5, pixel SM4/SM5
VERTEX_D3D11 = (15, 16)
PIXEL_D3D11 = (17, 18)

# ── el blob de la plataforma ──

def entradas(t, plataforma=PLATAFORMA_D3D11):
    """Las entradas (programas y parámetros) del blob de una plataforma, o None si no la tiene."""
    plats = list(t.get("platforms") or [])
    if plataforma not in plats:
        return None
    i = plats.index(plataforma)
    blob = bytes(t["compressedBlob"])

    def lista(v):
        return v if isinstance(v, list) else [v]
    offs, cls, dls = lista(t["offsets"][i]), lista(t["compressedLengths"][i]), lista(t["decompressedLengths"][i])
    segs = [lz4.block.decompress(blob[o:o + c], uncompressed_size=d) for o, c, d in zip(offs, cls, dls)]
    d = segs[0]
    n = struct.unpack_from("<i", d, 0)[0]
    res = []
    for k in range(n):
        o, l, s = struct.unpack_from("<iii", d, 4 + 12 * k)
        res.append(segs[s][o:o + l])
    return res


class Lector:
    def __init__(self, d):
        self.d, self.o = d, 0

    def i(self):
        v = struct.unpack_from("<i", self.d, self.o)[0]
        self.o += 4
        return v

    def s(self):
        n = self.i()
        v = self.d[self.o:self.o + n].decode("utf-8", "replace")
        self.o = (self.o + n + 3) & ~3
        return v

    def b(self):
        n = self.i()
        v = self.d[self.o:self.o + n]
        self.o = (self.o + n + 3) & ~3
        return v


def leer_programa(e):
    """Una entrada de programa: el tipo, las palabras clave y el DXBC."""
    r = Lector(e)
    ver = r.i()
    if ver != VERSION_PROGRAMA:
        raise ValueError(f"versión de programa {ver}")
    tipo = r.i()
    r.o += 16                       # estadísticas: ALU, TEX, flujo, registros temporales
    claves = [r.s() for _ in range(r.i())]
    datos = r.b()
    i = datos.find(b"DXBC")
    if i < 0:
        raise ValueError("sin DXBC")
    largo = struct.unpack_from("<I", datos, i + 24)[0]
    return {"tipo": tipo, "claves": claves, "dxbc": datos[i:i + largo]}


def leer_parametros(e):
    """Una entrada de parámetros de una variante: los constant buffers que usa (con las variables
    que no están entre las comunes) y las ligaduras propias (texturas, buffers, samplers)."""
    r = Lector(e)
    ver = r.i()
    if ver != VERSION_PROGRAMA:
        raise ValueError(f"versión de parámetros {ver}")
    grupos = []
    for _ in range(r.i()):
        nombre, tam = r.s(), r.i()
        ps = []
        for _ in range(r.i()):
            n = r.s()
            tipo, filas, cols, matriz, arreglo, indice = (r.i() for _ in range(6))
            ps.append({"nombre": n, "tipo": tipo, "filas": filas, "cols": cols, "matriz": bool(matriz), "arreglo": arreglo, "offset": indice})
        structs = []
        for _ in range(r.i()):
            sn, idx, arr, tam_s, nm = r.s(), r.i(), r.i(), r.i(), r.i()
            for _ in range(nm):
                r.s(); [r.i() for _ in range(6)]
            structs.append(sn)
        grupos.append({"nombre": nombre, "tam": tam, "vars": ps, "structs": structs})
    ligaduras = []
    for _ in range(r.i()):
        n, tipo, indice, extra = r.s(), r.i(), r.i(), r.i()
        x = r.i() if tipo == 0 else None
        ligaduras.append({"nombre": n, "tipo": tipo, "slot": indice, "extra": extra, "textura": x})
    if r.o != len(e):
        raise ValueError(f"parámetros: sobran {len(e) - r.o} bytes")
    return grupos, ligaduras


# ── la reflexión de una variante ──

def reflexion(nombres, comunes, grupos, ligaduras):
    """Los constant buffers (con sus variables) y las ligaduras de texturas y samplers de una
    variante: las comunes del programa más las de la variante (que pisan a las comunes)."""
    def nom(i):
        return nombres.get(i, f"_porteo_{i}")
    cb_comunes = {}
    for cb in comunes.get("m_ConstantBuffers", []):
        vs = {}
        for v in cb.get("m_VectorParams", []):
            vs[nom(v["m_NameIndex"])] = {"tipo": v["m_Type"], "filas": 1, "cols": v["m_Dim"], "matriz": False, "arreglo": v["m_ArraySize"], "offset": v["m_Index"]}
        for m in cb.get("m_MatrixParams", []):
            vs[nom(m["m_NameIndex"])] = {"tipo": m["m_Type"], "filas": m["m_RowCount"], "cols": m.get("m_ColumnCount", 4), "matriz": True, "arreglo": m["m_ArraySize"], "offset": m["m_Index"]}
        cb_comunes[nom(cb["m_NameIndex"])] = (cb["m_Size"], vs)
    cbs = []
    for g in grupos:
        if not g["nombre"]:
            continue   # los uniforms sueltos: en D3D11 no hay
        tam, vs = cb_comunes.get(g["nombre"], (g["tam"], {}))
        vs = dict(vs)
        for v in g["vars"]:
            vs[v["nombre"]] = v
        cbs.append({"nombre": g["nombre"], "tam": max(tam, g["tam"]), "vars": sorted(vs.items(), key=lambda kv: kv[1]["offset"])})
    slots_cb = {nom(b["m_NameIndex"]): b["m_Index"] for b in comunes.get("m_ConstantBufferBindings", [])}
    texturas = {}
    for t in comunes.get("m_TextureParams", []):
        texturas[nom(t["m_NameIndex"])] = {"slot": t["m_Index"], "sampler": t["m_SamplerIndex"], "dim": t["m_Dim"], "ms": t["m_MultiSampled"]}
    samplers = {s["bindPoint"]: s["sampler"] for s in comunes.get("m_Samplers", [])}
    for b in ligaduras:
        if b["tipo"] == 0:
            texturas[b["nombre"]] = {"slot": b["slot"], "sampler": b["extra"], "dim": b["textura"] >> 1, "ms": bool(b["textura"] & 1)}
        elif b["tipo"] == 1:
            slots_cb[b["nombre"]] = b["slot"]
        elif b["tipo"] == 4:
            samplers[b["slot"]] = b["extra"]
    return {"cbs": cbs, "slots_cb": slots_cb, "texturas": texturas, "samplers": samplers}


# ── el RDEF ──

# D3D_SHADER_VARIABLE_TYPE según el ShaderParamType de Unity (float, int, bool, half, short, uint)
_TIPO_VAR = {0: 3, 1: 2, 2: 1, 3: 3, 4: 2, 5: 19}
# D3D_SRV_DIMENSION según el TextureDimension de Unity (2D, 3D, Cube, 2DArray, CubeArray)
_DIM_TEX = {2: 4, 3: 8, 4: 9, 5: 5, 6: 10}


def armar_rdef(refl, mayor, menor, es_pixel):
    """El chunk RDEF (D3D11 shader reflection) con lo que HLSLcc lee: ligaduras, constant buffers,
    variables y tipos."""
    cadenas = bytearray()
    pos_cadena = {}
    pendientes = []   # (lugar en el chunk, cadena): los offsets se completan al final

    ligs = []
    for cb in refl["cbs"]:
        slot = refl["slots_cb"].get(cb["nombre"])
        if slot is not None:
            ligs.append((cb["nombre"], 0, 0, 0, 0, slot, 1, 0))
    usados_s = set()
    for nombre, t in sorted(refl["texturas"].items(), key=lambda kv: kv[1]["slot"]):
        ligs.append((nombre, 2, 5, _DIM_TEX.get(t["dim"], 4) + (2 if t["ms"] and t["dim"] == 2 else 0), 0xFFFFFFFF if not t["ms"] else 0, t["slot"], 1, 0x0C))
        s = t["sampler"]
        if 0 <= s < 16 and s not in usados_s:
            usados_s.add(s)
            ligs.append(("sampler" + nombre, 3, 0, 0, 0, s, 1, 0))
    for s in sorted(refl["samplers"]):
        if 0 <= s < 16 and s not in usados_s:
            usados_s.add(s)
            ligs.append((f"sampler_porteo{s}", 3, 0, 0, 0, s, 1, 0))

    cbs = [cb for cb in refl["cbs"] if cb["nombre"] in refl["slots_cb"]]
    sm5 = mayor >= 5
    tam_var = 40 if sm5 else 24
    cab = 28
    off_ligs = cab
    off_cbs = off_ligs + 32 * len(ligs)
    off_vars = off_cbs + 24 * len(cbs)
    n_vars = sum(len(cb["vars"]) for cb in cbs)
    off_tipos = off_vars + tam_var * n_vars
    off_cadenas = off_tipos + 16 * n_vars
    datos = bytearray(off_cadenas)

    def cadena(s):
        if s not in pos_cadena:
            pos_cadena[s] = len(cadenas)
            cadenas.extend(s.encode("utf-8") + b"\0")
        return pos_cadena[s]

    tipo_prog = 0xFFFF if es_pixel else 0xFFFE
    struct.pack_into("<IIIIII", datos, 0, len(cbs), off_cbs, len(ligs), off_ligs, (tipo_prog << 16) | (mayor << 4) | menor, 0)
    pendientes.append((24, cadena("porteo")))
    for k, (n, tipo, ret, dim, mues, slot, cant, fl) in enumerate(ligs):
        o = off_ligs + 32 * k
        struct.pack_into("<IIIIIIII", datos, o, 0, tipo, ret, dim, mues, slot, cant, fl)
        pendientes.append((o, cadena(n)))
    iv = 0
    for k, cb in enumerate(cbs):
        o = off_cbs + 24 * k
        struct.pack_into("<IIIIII", datos, o, 0, len(cb["vars"]), off_vars + tam_var * iv, cb["tam"], 0, 0)
        pendientes.append((o, cadena(cb["nombre"])))
        for nombre, v in cb["vars"]:
            ov = off_vars + tam_var * iv
            ot = off_tipos + 16 * iv
            cols, filas, arr = max(1, v["cols"]), max(1, v["filas"]), v["arreglo"]
            if v["matriz"]:
                clase = 3   # D3D_SVC_MATRIX_COLUMNS: cada columna en un registro
                un = 16 * (cols - 1) + 4 * filas
                tam = (max(arr, 1) - 1) * 16 * cols + un
            else:
                clase = 0 if cols == 1 else 1
                tam = (max(arr, 1) - 1) * 16 + 4 * cols
            struct.pack_into("<IIIIII", datos, ov, 0, v["offset"], tam, 2, ot, 0)
            if sm5:
                struct.pack_into("<IIII", datos, ov + 24, 0xFFFFFFFF, 0, 0xFFFFFFFF, 0)
            pendientes.append((ov, cadena(nombre)))
            struct.pack_into("<HHHHHHI", datos, ot, clase, _TIPO_VAR.get(v["tipo"], 3), filas, cols, arr, 0, 0)
            iv += 1
    for lugar, pos in pendientes:
        struct.pack_into("<I", datos, lugar, off_cadenas + pos)
    return bytes(datos + cadenas)


def con_rdef(dxbc, rdef):
    """El contenedor DXBC con el RDEF agregado (HLSLcc no mira la suma de control)."""
    n = struct.unpack_from("<I", dxbc, 28)[0]
    offs = struct.unpack_from(f"<{n}I", dxbc, 32)
    chunks = []
    for o in offs:
        fourcc = dxbc[o:o + 4]
        tam = struct.unpack_from("<I", dxbc, o + 4)[0]
        if fourcc != b"RDEF":
            chunks.append(dxbc[o:o + 8 + tam])
    chunks.insert(0, b"RDEF" + struct.pack("<I", len(rdef)) + rdef)
    cab = 32 + 4 * len(chunks)
    lugares, o = [], cab
    for c in chunks:
        lugares.append(o)
        o += len(c)
    salida = bytearray(dxbc[:20]) + struct.pack("<III", 1, o, len(chunks)) + struct.pack(f"<{len(chunks)}I", *lugares)
    for c in chunks:
        salida += c
    return bytes(salida)


def version_sm(dxbc):
    """(mayor, menor) del SHDR/SHEX."""
    n = struct.unpack_from("<I", dxbc, 28)[0]
    for o in struct.unpack_from(f"<{n}I", dxbc, 32):
        if dxbc[o:o + 4] in (b"SHDR", b"SHEX"):
            tok = struct.unpack_from("<I", dxbc, o + 8)[0]
            return (tok >> 4) & 0xF, tok & 0xF
    return 4, 0


# ── la traducción ──

def traducir(trabajos, herramienta, avisos=None):
    """Traduce los DXBC (con RDEF) con dxbc-glsl, todos juntos. Devuelve el GLSL de cada uno (o
    None si no se pudo). Si la herramienta se cae con alguno, se sigue desde el próximo."""
    res = [None] * len(trabajos)
    with tempfile.TemporaryDirectory() as tmp:
        ent, sal = os.path.join(tmp, "trabajos"), os.path.join(tmp, "salida")
        with open(ent, "wb") as f:
            f.write(b"PDXB" + struct.pack("<I", len(trabajos)))
            for t in trabajos:
                f.write(struct.pack("<I", len(t)) + t)
        desde = 0
        while desde < len(trabajos):
            p = subprocess.run([herramienta, ent, sal] + (["--desde", str(desde)] if desde else []), capture_output=True)
            leidos = 0
            with open(sal, "rb") as f:
                d = f.read()
            o, k = 0, 0
            while o < len(d) and k < len(trabajos):
                if o + 8 > len(d):
                    break
                ok, n = struct.unpack_from("<II", d, o)
                if o + 8 + n + 4 > len(d):
                    break
                glsl = d[o + 8:o + 8 + n].decode("utf-8", "replace")
                m = struct.unpack_from("<I", d, o + 8 + n)[0]
                if o + 12 + n + m > len(d):
                    break
                diag = d[o + 12 + n:o + 12 + n + m].decode("utf-8", "replace")
                res[k] = glsl if ok else None
                if not ok and k >= desde and avisos is not None:
                    avisos.append(f"dxbc-glsl #{k}: {diag.strip()[:300]}")
                o += 12 + n + m
                k += 1
                leidos = k
            if p.returncode == 0 and leidos >= len(trabajos):
                break
            # se cayó con el trabajo `leidos`: queda sin traducir y se sigue con el siguiente
            if avisos is not None:
                avisos.append(f"dxbc-glsl se cayó con el #{leidos}: {p.stderr.decode('utf-8', 'replace')[-300:]}")
            with open(sal, "r+b") as f:
                f.truncate(o)
                f.seek(o)
                f.write(struct.pack("<III", 0, 0, 0))
            desde = leidos + 1
    return res


# ── del GLSL de HLSLcc al que usa el motor ──

# Al final del vertex: de las coordenadas de D3D (Z de 0 a w, invertida; la fila 0 arriba) a las de
# GL (Z de -w a w). Y se da vuelta: así la memoria de cada destino queda como en D3D, que es lo que
# suponen los shaders (UNITY_UV_STARTS_AT_TOP, los triángulos de pantalla completa de los efectos);
# el lienzo se muestra dado vuelta con CSS. La Z queda guardada como en D3D (1 cerca, 0 lejos): el
# motor compara al revés y borra con 0 (Render/Convencion.cs).
EPILOGO = "void main()\n{\n    porteo_main();\n    gl_Position.y = -gl_Position.y;\n    gl_Position.z = 2.0 * gl_Position.z - gl_Position.w;\n}\n"
_MAIN = re.compile(r"\bvoid\s+main\s*\(\s*\)")


def vertex_para_motor(glsl):
    return _MAIN.sub("void porteo_main()", glsl, count=1) + EPILOGO


_LAYER = re.compile(r"^\s*(#extension\s+GL_AMD_vertex_shader_layer\b.*|gl_Layer\s*=.*;)\s*$")
_CUBO_SOMBRA = re.compile(r"uniform\s+(?:\w+\s+)?samplerCubeShadow\s+(\w+)\s*;")


def limpiar(glsl):
    """Lo que GLSL ES 3.00 no tiene: sin la línea de versión (el motor pone la suya); sin gl_Layer
    (sólo lo escriben las variantes de realidad virtual, que nunca se eligen); textureLod de un
    samplerCubeShadow (las sombras de las luces puntuales) como texture, que en el nivel 0 es lo
    mismo; y sin ubicaciones explícitas de uniforms."""
    lineas = [l for l in glsl.splitlines() if not l.startswith("#version") and not _LAYER.match(l)]
    g = "\n".join(lineas).strip() + "\n"
    for s in _CUBO_SOMBRA.findall(g):
        g = re.sub(r"textureLod\(\s*" + re.escape(s) + r"\s*,([^;]*?),\s*0\.0\s*\)", "texture(" + s + r",\1)", g)
    return g.replace("#define UNITY_SUPPORTS_UNIFORM_LOCATION 1", "#define UNITY_SUPPORTS_UNIFORM_LOCATION 0")


_FLAT_IN = re.compile(r"^\s*flat\s+in\s+(?:\w+\s+)?\w+\s+(\w+)\s*;", re.M)


def varyings_planos(fs):
    return set(_FLAT_IN.findall(fs))


def poner_planos(vs, nombres):
    """Lo que el fragment recibe sin interpolar (flat) el vertex lo tiene que declarar igual."""
    if not nombres:
        return vs

    def cambio(m):
        return m.group(0) if m.group(0).lstrip().startswith("flat") or m.group(2) not in nombres else "flat " + m.group(0).lstrip()
    return re.sub(r"^(\s*)out\s+(?:\w+\s+)?\w+\s+(\w+)\s*;", cambio, vs, flags=re.M)


# ── un shader entero ──

def preparar_shader(t):
    """Los trabajos de traducción de un Shader (el typetree de UnityPy) y lo que hace falta para
    después armar su forma (ver aplicar). None si el shader no tiene D3D11."""
    es = entradas(t)
    if es is None:
        return None
    pf = t["m_ParsedForm"]
    nombres_kw = list(pf.get("m_KeywordNames") or [])
    trabajos, variantes = [], []
    for si, ss in enumerate(pf["m_SubShaders"]):
        for pi, pa in enumerate(ss["m_Passes"]):
            nombres = {i: n for n, i in pa.get("m_NameIndices", [])}
            for etapa, tipos in (("progVertex", VERTEX_D3D11), ("progFragment", PIXEL_D3D11)):
                pr = pa.get(etapa) or {}
                listas = [l for l in (pr.get("m_PlayerSubPrograms") or []) if l]
                blobs = [l for l in (pr.get("m_ParameterBlobIndices") or []) if l]
                if not listas:
                    continue
                comunes = pr.get("m_CommonParameters") or {}
                for sp, bi in zip(listas[0], blobs[0] if blobs else [None] * len(listas[0])):
                    if sp["m_GpuProgramType"] not in tipos:
                        continue
                    try:
                        prog = leer_programa(es[sp["m_BlobIndex"]])
                        grupos, ligs = leer_parametros(es[bi]) if bi is not None else ([], [])
                        refl = reflexion(nombres, comunes, grupos, ligs)
                        mayor, menor = version_sm(prog["dxbc"])
                        dx = con_rdef(prog["dxbc"], armar_rdef(refl, mayor, menor, etapa == "progFragment"))
                    except Exception as e:   # noqa: BLE001 - una variante rara no frena el resto
                        variantes.append({"ss": si, "pa": pi, "etapa": etapa, "trabajo": None, "error": repr(e)[:200],
                                          "kw": [nombres_kw[k] for k in sp.get("m_KeywordIndices", []) if k < len(nombres_kw)]})
                        continue
                    variantes.append({"ss": si, "pa": pi, "etapa": etapa, "trabajo": len(trabajos),
                                      "kw": [nombres_kw[k] for k in sp.get("m_KeywordIndices", []) if k < len(nombres_kw)]})
                    trabajos.append(dx)
    return {"trabajos": trabajos, "variantes": variantes}


def aplicar(t, prep, glsl):
    """Deja el Shader como lo lee el motor: m_SubPrograms de "GLES3" (tipo 4) que apuntan a la lista
    de programas traducidos (vs o fs, con sus palabras clave), y saca lo de D3D. Devuelve la lista."""
    programas = []
    pf = t["m_ParsedForm"]
    por_prog = {}
    planos = {}
    for v in prep["variantes"]:
        g = glsl[v["trabajo"]] if v["trabajo"] is not None else None
        if g is None:
            continue
        g = limpiar(g)
        if v["etapa"] == "progFragment":
            planos.setdefault((v["ss"], v["pa"]), set()).update(varyings_planos(g))
    for v in prep["variantes"]:
        g = glsl[v["trabajo"]] if v["trabajo"] is not None else None
        if g is None:
            continue
        g = limpiar(g)
        if v["etapa"] == "progVertex":
            g = vertex_para_motor(poner_planos(g, planos.get((v["ss"], v["pa"]), set())))
            programas.append({"vs": g, "fs": "", "kw": v["kw"]})
        else:
            programas.append({"vs": "", "fs": g, "kw": v["kw"]})
        por_prog.setdefault((v["ss"], v["pa"], v["etapa"]), []).append(
            {"m_BlobIndex": len(programas) - 1, "m_GpuProgramType": 4, "m_ShaderHardwareTier": 1})
    for si, ss in enumerate(pf["m_SubShaders"]):
        for pi, pa in enumerate(ss["m_Passes"]):
            for etapa in ("progVertex", "progFragment", "progGeometry", "progHull", "progDomain", "progRayTracing"):
                pr = pa.get(etapa)
                if not isinstance(pr, dict):
                    continue
                pr["m_SubPrograms"] = por_prog.get((si, pi, etapa), [])
                for k in ("m_PlayerSubPrograms", "m_ParameterBlobIndices", "m_CommonParameters"):
                    pr.pop(k, None)
    return programas
