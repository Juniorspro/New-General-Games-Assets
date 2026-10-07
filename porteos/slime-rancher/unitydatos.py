"""Leer los datos de Slime Rancher (Unity 2018.4, Android) con UnityPy: escena, mallas,
materiales, shaders (GLSL de GLES3), texturas y los datos de los scripts (MonoBehaviour).

Lo usan exportar.py y las demás herramientas del porteo. Lo bajado es de terceros: los datos se
leen, no se ejecuta nada de ellos.
"""
import re
import sys
from pathlib import Path

import lz4.block
import numpy as np
import UnityPy
from UnityPy.export.ShaderConverter import ShaderProgram
from UnityPy.helpers.MeshHelper import MeshHandler
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
from UnityPy.streams import EndianBinaryReader

GLES3 = 4             # ShaderGpuProgramType.kShaderGpuProgramGLES3
PLATAFORMA_GLES3 = 9  # ShaderCompilerPlatform.kShaderCompPlatformGLES3Plus


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# ── matrices (Unity: vectores columna, M = T·R·S) ────────────────────────────
def rot(q):
    x, y, z, w = q.x, q.y, q.z, q.w
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def trs(t):
    m = np.eye(4)
    s = t.m_LocalScale
    m[:3, :3] = rot(t.m_LocalRotation) * np.array([s.x, s.y, s.z])
    p = t.m_LocalPosition
    m[:3, 3] = [p.x, p.y, p.z]
    return m


def cuaternion(m):
    """Cuaternión (x, y, z, w) de la rotación de una matriz (se le saca la escala)."""
    r = m[:3, :3] / np.maximum(np.linalg.norm(m[:3, :3], axis=0), 1e-9)
    t = np.trace(r)
    if t > 0:
        s = np.sqrt(t + 1) * 2
        return [(r[2, 1] - r[1, 2]) / s, (r[0, 2] - r[2, 0]) / s, (r[1, 0] - r[0, 1]) / s, s / 4]
    i = int(np.argmax(np.diag(r)))
    if i == 0:
        s = np.sqrt(1 + r[0, 0] - r[1, 1] - r[2, 2]) * 2
        return [s / 4, (r[0, 1] + r[1, 0]) / s, (r[0, 2] + r[2, 0]) / s, (r[2, 1] - r[1, 2]) / s]
    if i == 1:
        s = np.sqrt(1 + r[1, 1] - r[0, 0] - r[2, 2]) * 2
        return [(r[0, 1] + r[1, 0]) / s, s / 4, (r[1, 2] + r[2, 1]) / s, (r[0, 2] - r[2, 0]) / s]
    s = np.sqrt(1 + r[2, 2] - r[0, 0] - r[1, 1]) * 2
    return [(r[0, 2] + r[2, 0]) / s, (r[1, 2] + r[2, 1]) / s, s / 4, (r[1, 0] - r[0, 1]) / s]


def color(c):
    if isinstance(c, dict):
        return [c["r"], c["g"], c["b"], c["a"]]
    return [c.r, c.g, c.b, c.a]


# ── el juego ─────────────────────────────────────────────────────────────────
class Juego:
    """Los datos del APK (assets/bin/Data) con UnityPy, y lo que le falta para este juego."""

    def __init__(self, datos):
        self.datos = Path(datos)
        self.env = UnityPy.load(str(self.datos))
        self.gen = TypeTreeGenerator("2018.4.36f1")
        self.gen.load_local_dll_folder(str(self.datos / "Managed"))
        self.env.typetree_generator = self.gen
        self.scripts = {}

    def archivo(self, nombre):
        return next(f for n, f in self.env.files.items() if Path(n).name.startswith(nombre))

    def _externo(self, af, fid):
        if fid == 0:
            return af
        ext = af.externals[fid - 1].path.rsplit("/")[-1].lower()
        for k, f in af.parent.files.items():
            if k.lower() == ext or Path(k).name.lower() == ext:
                return f
        return self.env.find_file(ext)

    def ptr(self, af, ref):
        """ObjectReader de un {m_FileID, m_PathID} (como vienen en los datos de un script)."""
        if not ref or not ref.get("m_PathID"):
            return None
        f = self._externo(af, ref["m_FileID"])
        return f.objects.get(ref["m_PathID"]) if f else None

    # UnityPy lee mal el encabezado de MonoBehaviour en 2018.4 (no alinea después de
    # m_Enabled): el puntero al script se lee a mano y los campos con el typetree generado.
    def clase(self, o):
        r = o.reader
        r.Position = o.byte_start
        r.read_int(); r.read_long(); r.read_u_byte(); r.align_stream()
        fid, pid = r.read_int(), r.read_long()
        k = (o.assets_file.name, fid, pid)
        if k not in self.scripts:
            ms = self._externo(o.assets_file, fid).objects[pid].read()
            nombre = f"{ms.m_Namespace}.{ms.m_ClassName}" if ms.m_Namespace else ms.m_ClassName
            self.scripts[k] = (nombre, ms.m_AssemblyName)
        return self.scripts[k]

    def mb(self, o):
        nombre, ens = self.clase(o)
        return o.read_typetree(nodes=self.gen.get_nodes_up(ens, nombre), check_read=False)


# ── shaders ──────────────────────────────────────────────────────────────────
def partir_glsl(codigo):
    """El GLSL de GLES de Unity trae las dos etapas en un texto: #ifdef VERTEX / #ifdef FRAGMENT."""
    def etapa(nombre):
        i = codigo.find("#ifdef " + nombre)
        if i < 0:
            return ""
        j = codigo.find("\n", i) + 1
        sig = [codigo.find("#ifdef " + o, j) for o in ("VERTEX", "FRAGMENT")]
        sig = [s for s in sig if s > 0]
        bloque = codigo[j:min(sig) if sig else len(codigo)]
        bloque = bloque[:bloque.rfind("#endif")]
        return "\n".join(l for l in bloque.splitlines() if not l.startswith("#version")).strip() + "\n"
    return etapa("VERTEX"), etapa("FRAGMENT")


_DECL_VEC4 = re.compile(r"uniform\s+(?:(?:highp|mediump|lowp)\s+)?vec4\s+(\w+);")
_ASIG_ENTERA = re.compile(r"^(\s*)(u_xlat\w+|vs_\w+|SV_Target\d)(\s*=\s*)(.*);(\s*)$")


def arreglar_swizzles(codigo, nombre="", avisos=None):
    """Los shaders de este APK salen de shaders de PC decompilados, y el decompilador perdió el
    swizzle de los uniforms en las operaciones de 4 componentes: `uv * _Tex_ST + _Tex_ST` en vez
    de `uv * _Tex_ST.xyxy + _Tex_ST.zwzw`. Así, la segunda proyección de cada triplanar lee siempre
    el mismo texel (caras de un color plano) y Recolor x8 toma (g, b, a) como color (la tecnología
    del rancho sale amarilla y verde). Se vuelve a poner el swizzle que corresponde; lo que no se
    reconoce se avisa."""
    vec4 = [u for u in _DECL_VEC4.findall(codigo) if not u.startswith("hlslcc_mtx")]
    if not vec4:
        return codigo
    sueltos = re.compile(r"(?<![\w.])(" + "|".join(map(re.escape, vec4)) + r")\b(?!\s*[.\[])")
    lineas = codigo.split("\n")
    for i, linea in enumerate(lineas):
        m = _ASIG_ENTERA.match(linea)
        if not m or not sueltos.search(m.group(4)):
            continue
        expr = m.group(4)

        def cambio(mu):
            u = mu.group(1)
            antes, despues = expr[:mu.start()].rstrip(), expr[mu.end():].lstrip()
            if u.endswith("_ST"):
                # escala (xy) si multiplica, desplazamiento (zw) si suma: las dos UV del triplanar
                return u + (".xyxy" if antes.endswith("*") or despues.startswith("*") else ".zwzw")
            if u == "_Time":
                return u + ".yyyy"  # los segundos, como el nodo Time del editor de shaders
            if re.fullmatch(r"_Color(\d\d)?", u):
                # el compilador guardó el color como (a, r, g, b): .x es el alfa (brillo y borde)
                return u + ".wxyz"
            if u == "_Tint" and expr.strip() == u:
                return u  # copia entera: no le faltaba nada
            if avisos is not None:
                avisos.add(f"{nombre}: {u} sin swizzle en «{linea.strip()}»")
            return u
        lineas[i] = m.group(1) + m.group(2) + m.group(3) + sueltos.sub(cambio, expr) + ";" + m.group(5)
    return "\n".join(lineas)


def _valor(v):
    return {"v": v.val, "p": v.name} if v.name else v.val


def _estado(s):
    b = s.rtBlend0
    return {"zwrite": _valor(s.zWrite), "ztest": _valor(s.zTest), "cull": _valor(s.culling),
            "blend": [_valor(b.srcBlend), _valor(b.destBlend), _valor(b.srcBlendAlpha), _valor(b.destBlendAlpha)],
            "blendop": _valor(b.blendOp), "mask": _valor(b.colMask), "offset": [_valor(s.offsetFactor), _valor(s.offsetUnits)]}


def _propiedades(pf):
    out = {}
    for p in pf.m_PropInfo.m_Props:
        if p.m_Type == 4:
            out[p.m_Name] = {"tipo": "tex", "def": p.m_DefTexture.m_DefaultName}
        elif p.m_Type in (0, 1):
            out[p.m_Name] = {"tipo": "vec", "def": [p.m_DefValue_0_, p.m_DefValue_1_, p.m_DefValue_2_, p.m_DefValue_3_]}
        else:
            out[p.m_Name] = {"tipo": "float", "def": p.m_DefValue_0_}
    return out


class Shaders:
    """Cada shader usado, una entrada por juego de keywords: sus pasadas de dibujo (ForwardBase
    o sin LightMode) con el GLSL de GLES3 de la variante que corresponde."""

    MODOS = ("FORWARDBASE", "ALWAYS", "VERTEX", "VERTEXLMRGBM", "VERTEXLM")

    def __init__(self):
        self.lista = []
        self.por_clave = {}
        self.programas = {}
        self.avisos = set()  # swizzles perdidos que arreglar_swizzles no sabe reponer

    def _programa(self, sh):
        k = (sh.assets_file.name, sh.object_reader.path_id)
        if k not in self.programas:
            prog = None
            for i, plat in enumerate(sh.platforms):
                if plat == PLATAFORMA_GLES3:
                    off, cl, dl = (v[0] if isinstance(v, list) else v for v in (sh.offsets[i], sh.compressedLengths[i], sh.decompressedLengths[i]))
                    crudo = lz4.block.decompress(bytes(sh.compressedBlob)[off:off + cl], uncompressed_size=dl)
                    prog = ShaderProgram(EndianBinaryReader(crudo, endian="<"), sh.object_reader.version)
            self.programas[k] = prog
        return self.programas[k]

    def indice(self, sh, palabras):
        pf = sh.m_ParsedForm
        clave = (pf.m_Name, frozenset(palabras))
        if clave in self.por_clave:
            return self.por_clave[clave]
        prog = self._programa(sh)
        pasadas = []
        if prog is not None and pf.m_SubShaders:
            for p in pf.m_SubShaders[0].m_Passes:
                tags = {t[0].upper(): t[1] for t in p.m_State.m_Tags.tags}
                modo = tags.get("LIGHTMODE", "ALWAYS").upper()
                if modo not in self.MODOS or p.m_Type != 0:
                    continue
                elegido = None
                for sp in p.progVertex.m_SubPrograms:
                    if sp.m_GpuProgramType != GLES3:
                        continue
                    sub = prog.m_SubPrograms[sp.m_BlobIndex]
                    kw = set(sub.m_Keywords) | set(sub.m_LocalKeywords or [])
                    if kw <= palabras and (elegido is None or len(kw) > len(elegido[0])):
                        elegido = (kw, sub)
                if elegido is None:
                    continue
                vs, fs = (arreglar_swizzles(g, pf.m_Name, self.avisos)
                          for g in partir_glsl(bytes(elegido[1].m_ProgramCode).decode("utf-8")))
                pasadas.append({"modo": modo, "keywords": sorted(elegido[0]), "estado": _estado(p.m_State),
                                "tags": tags, "vs": vs, "fs": fs})
                if modo != "ALWAYS":
                    break  # una pasada de luz alcanza; las ALWAYS se suman en orden
        ss_tags = {t[0]: t[1] for t in pf.m_SubShaders[0].m_Tags.tags} if pf.m_SubShaders else {}
        self.lista.append({"nombre": pf.m_Name, "tags": ss_tags, "pasadas": pasadas, "propiedades": _propiedades(pf)})
        self.por_clave[clave] = len(self.lista) - 1
        return self.por_clave[clave]


# ── texturas ─────────────────────────────────────────────────────────────────
class Texturas:
    """Las texturas de abajo hacia arriba, como las quiere Unity (y WebGL sin dar vuelta), en
    el formato que conviene a cada uso (lo dice el nombre de la propiedad del material):
      - máscaras (Recolor x8 elige 1 de 8 colores por canal): WebP sin pérdida;
      - datos (normales, oclusión, profundidad, ruido, trazos, rampas): AVIF 4:4:4. Sin
        submuestreo de croma cada canal queda en su lugar (error medio de 1 a 3 sobre 255)
        y pesa un tercio del WebP sin pérdida;
      - color: AVIF con pérdida (la mitad que WebP a calidad pareja).
    Si una textura se usa de dos formas, gana la más exigente."""

    MASCARAS = ("mask", "override")
    DATOS = ("normal", "bump", "depth", "noise", "stroke", "occlusion", "ramp", "specular", "gloss", "height",
             "parallax", "flow", "dissolve", "lut")
    EXIGENCIA = {"color": 0, "dato": 1, "mascara": 2}

    def __init__(self, carpeta, tex_max, calidad_color=60, calidad_datos=70):
        self.carpeta = Path(carpeta)
        self.carpeta.mkdir(parents=True, exist_ok=True)
        self.tex_max = tex_max
        self.calidad_color, self.calidad_datos = calidad_color, calidad_datos
        self.lista = []
        self.por_clave = {}

    @classmethod
    def clase(cls, propiedad):
        p = propiedad.lower()
        if any(d in p for d in cls.MASCARAS) and "noisemask" not in p:
            return "mascara"
        if any(d in p for d in cls.DATOS) or "noisemask" in p:
            return "dato"
        return "color"

    def indice(self, o, propiedad=""):
        if o is None:
            return None
        k = (o.assets_file.name, o.path_id)
        clase = self.clase(propiedad)
        if k in self.por_clave:
            i = self.por_clave[k]
            if i is not None and self.EXIGENCIA[clase] > self.EXIGENCIA[self.lista[i]["clase"]]:
                self._guardar(o, i, clase)  # ya estaba y ahora se usa de una forma más exigente
            return i
        if o.type.name != "Texture2D":
            self.por_clave[k] = None  # cubemaps y render textures: aparte
            return None
        self.lista.append(None)
        i = len(self.lista) - 1
        if not self._guardar(o, i, clase):
            self.lista.pop()
            self.por_clave[k] = None
            return None
        self.por_clave[k] = i
        return i

    def _guardar(self, o, i, clase):
        t = o.read()
        try:
            img = t.image
        except Exception as e:
            log("  textura sin leer:", t.m_Name, e)
            return False
        w, h = img.size
        escala = min(1.0, self.tex_max / max(w, h))
        if escala < 1:
            img = img.resize((max(1, round(w * escala)), max(1, round(h * escala))), resample=3)
        img = img.transpose(1)
        alfa = img.mode in ("RGBA", "LA") and img.getextrema()[-1][0] < 255
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if alfa else "RGB")
        if not alfa and img.mode == "RGBA":
            img = img.convert("RGB")
        anterior = self.lista[i]["archivo"] if self.lista[i] else None
        if clase == "mascara":
            nombre = f"{i:04d}.webp"
            img.save(self.carpeta / nombre, "WEBP", lossless=True, quality=100, method=6, exact=True)
        else:
            nombre = f"{i:04d}.avif"
            if clase == "dato":
                img.save(self.carpeta / nombre, "AVIF", quality=self.calidad_datos, subsampling="4:4:4", speed=4)
            else:
                img.save(self.carpeta / nombre, "AVIF", quality=self.calidad_color, speed=4)
        if anterior and anterior != nombre:
            (self.carpeta / anterior).unlink(missing_ok=True)
        ts = t.m_TextureSettings
        self.lista[i] = {"archivo": nombre, "nombre": t.m_Name, "w": img.size[0], "h": img.size[1],
                         "wrap": [ts.m_WrapU, ts.m_WrapV], "filtro": ts.m_FilterMode, "mips": t.m_MipCount > 1,
                         "alfa": bool(alfa), "clase": clase}
        return True


# ── mallas ───────────────────────────────────────────────────────────────────
class Mallas:
    def __init__(self):
        self.cache = {}

    def leer(self, o):
        k = (o.assets_file.name, o.path_id)
        if k not in self.cache:
            m = o.read()
            h = MeshHandler(m)
            h.process()
            n = h.m_VertexCount

            def arr(x, dim):
                if not x:
                    return None
                a = np.asarray(x, dtype=np.float32)
                return a.reshape(n, -1)[:, :dim]
            self.cache[k] = {
                "nombre": m.m_Name, "n": n,
                "pos": arr(h.m_Vertices, 3), "nrm": arr(h.m_Normals, 3), "uv0": arr(h.m_UV0, 2),
                "uv1": arr(h.m_UV1, 2), "col": arr(h.m_Colors, 4),
                "sub": [np.asarray(t, dtype=np.int64).reshape(-1) for t in h.get_triangles()],
            }
        return self.cache[k]
