#!/usr/bin/env python3
"""Exporta los datos de un juego de Unity (Mono; probado con 2018.4 de Android y 2022.2 de Windows)
al formato del motor.

    python -I exportar.py DATA SALIDA [--solo level0,globalgamemanagers ...] [--arreglar-swizzles]
                          [--dxbc-glsl RUTA]

DATA es assets/bin/Data del APK (sacado con unzip) o la carpeta JUEGO_Data de un build de PC. En
SALIDA quedan:
    paquetes/NOMBRE.paq   un archivo serializado de Unity entero (ver arbol.py)
    recursos/ID.bin       lo grande (texturas, mallas, audio, video, código de shaders), aparte
    indice.json           los archivos, las escenas en orden, la tabla de recursos y la convención
                          de los shaders ("gles3" o "d3d11")

Cada objeto se lee con su typetree (UnityPy trae los de las clases del motor para cada
versión; los de los MonoBehaviour se generan desde las DLL del juego) y se guarda entero: el
motor ve lo mismo que Unity al cargar. Lo que cambia:
  - los datos que Unity guarda aparte (.resS, .resource) se traen como recursos;
  - de cada Shader, en vez de los blobs comprimidos de cada plataforma, va el GLSL de GLES3 de
    cada subprograma (con --arreglar-swizzles, reparado: ver shaders.py). Si el build sólo trae
    DirectX 11 (uno de PC), cada variante se traduce con HLSLcc (ver dxbc.py; --dxbc-glsl es la
    herramienta que arma dxbc/compilar.sh);
  - las texturas de PC (DXT1, DXT5, BC7...) pasan a ETC2, que es lo que leen los teléfonos (y el
    motor lo descomprime donde no hay ETC2); las HDR (BC6H), a RGBA de 8 bits;
  - OcclusionCullingData no va (es el formato propio de Umbra; el motor hace su descarte).

Lo bajado es de terceros: los datos se leen, no se ejecuta nada de ellos. Correr con python -I.
"""
import argparse
import os
import shutil
import subprocess
import tempfile
import hashlib
import json
import struct
import sys
import time
from pathlib import Path

import lz4.block
import UnityPy
from UnityPy.export.ShaderConverter import ShaderProgram
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
from UnityPy.helpers.TypeTreeHelper import FUNCTION_READ_MAP
from UnityPy.helpers.TypeTreeNode import TypeTreeNode
from UnityPy.streams import EndianBinaryReader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from arbol import Escritor  # noqa: E402
from shaders import arreglar_swizzles, partir_glsl  # noqa: E402
import dxbc  # noqa: E402
import texturas  # noqa: E402

GLES3 = 4             # ShaderGpuProgramType.kShaderGpuProgramGLES3
PLATAFORMA_GLES3 = 9  # ShaderCompilerPlatform.kShaderCompPlatformGLES3Plus
OMITIR = {"OcclusionCullingData"}

# TextureFormat de Unity
RGBA32, RGBA_HALF, DXT1, DXT5, BC6H, BC7, BC4, BC5 = 4, 17, 10, 12, 24, 25, 26, 27
ETC2_RGB, ETC2_RGBA8 = 45, 47


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def nombre_archivo(ruta):
    """Como se nombran los archivos entre sí (externos): sin carpetas, en minúsculas."""
    return ruta.replace("\\", "/").split("/")[-1].lower()


def arreglar_arreglos(raiz):
    """Los arreglos de primitivos y de strings (string[], int[], List<float>...) los genera con el
    tipo del elemento ("string args" con un Array adentro) y UnityPy, que mira primero el tipo, los
    lee como un valor suelto: todo lo que sigue sale corrido (XlateText.args). En Unity esos nodos
    son "vector"; un string de verdad es el único con un Array de char adentro. El árbol se arma de
    nuevo: el lector en C de UnityPy fija el tipo de cada nodo al crearlo y no ve un m_Type cambiado."""
    def es_vector(n):
        hijos = n.m_Children
        if not (hijos and hijos[0].m_Type == "Array" and n.m_Type in FUNCTION_READ_MAP):
            return False
        datos = hijos[0].m_Children[1] if len(hijos[0].m_Children) > 1 else None
        return not (n.m_Type == "string" and datos is not None and datos.m_Type == "char")
    nodos = list(raiz.traverse())
    if not any(es_vector(n) for n in nodos):
        return raiz
    return TypeTreeNode.from_list([
        TypeTreeNode(n.m_Level, "vector" if es_vector(n) else n.m_Type, n.m_Name, n.m_ByteSize, n.m_Version,
                     m_MetaFlag=n.m_MetaFlag)
        for n in nodos])


class Recursos:
    """Lo grande, aparte y una sola vez (por contenido)."""

    def __init__(self, carpeta):
        self.carpeta = Path(carpeta)
        self.carpeta.mkdir(parents=True, exist_ok=True)
        self.por_hash = {}
        self.tabla = []   # id -> {"bytes": n}

    def __call__(self, datos):
        h = hashlib.sha1(datos).digest()
        i = self.por_hash.get(h)
        if i is None:
            i = self.por_hash[h] = len(self.tabla)
            (self.carpeta / f"{i}.bin").write_bytes(datos)
            self.tabla.append({"bytes": len(datos)})
        return i


def a_webm(datos, nombre):
    """Un video a WebM (VP9 + Opus) con ffmpeg: lo abre cualquier navegador (los Chromium sin
    códecs propietarios no tienen H.264, y Chrome no abre el audio PCM de los .mov). Más de 1280
    de lado no hace falta en un teléfono. Sin ffmpeg (o si falla) queda como estaba."""
    ff = shutil.which("ffmpeg")
    if not ff:
        print(f"  {nombre}: sin ffmpeg, el video queda como está (puede no abrir en el navegador)")
        return datos
    with tempfile.TemporaryDirectory() as d:
        ent, sal = os.path.join(d, "e.bin"), os.path.join(d, "s.webm")
        with open(ent, "wb") as f:
            f.write(datos)
        r = subprocess.run([ff, "-v", "error", "-y", "-i", ent, "-map", "0:v:0", "-map", "0:a?",
                            "-vf", "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
                            "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "1M", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
                            "-c:a", "libopus", "-b:a", "96k", sal], capture_output=True)
        if r.returncode != 0 or not os.path.exists(sal):
            print(f"  {nombre}: ffmpeg no pudo ({r.stderr.decode(errors='replace')[:200]}); queda como estaba")
            return datos
        with open(sal, "rb") as f:
            nuevo = f.read()
    print(f"  {nombre}: video a WebM VP9 ({len(datos) / 1e6:.1f} MB a {len(nuevo) / 1e6:.1f} MB)")
    return nuevo


class Exportador:
    def __init__(self, datos, salida, arreglar, dxbc_glsl=None):
        self.datos = Path(datos)
        self.salida = Path(salida)
        self.arreglar = arreglar
        self.dxbc_glsl = dxbc_glsl
        log("cargando", self.datos)
        self.env = UnityPy.load(str(self.datos))
        self.archivos = {nombre_archivo(n): f for n, f in self.env.files.items() if hasattr(f, "objects")}
        # la versión de Unity del build: las reglas de serialización de los scripts cambian con ella
        self.version = next((f.unity_version for f in self.archivos.values() if getattr(f, "unity_version", None)), "2018.4.36f1")
        log("Unity", self.version)
        self.gen = TypeTreeGenerator(self.version)
        self.gen.load_local_dll_folder(str(self.datos / "Managed"))
        self.env.typetree_generator = self.gen
        self.recursos = Recursos(self.salida / "recursos")
        (self.salida / "paquetes").mkdir(parents=True, exist_ok=True)
        self.scripts = {}       # (archivo, pathID del MonoScript) -> (ensamblado, ns, clase)
        self.nodos = {}         # (ensamblado, clase) -> nodos del typetree (o None)
        self.avisos = set()
        self.fallas = {}
        self.convencion = "gles3"
        self.shaders_d3d = {}   # (id del archivo, pathID) -> árbol ya traducido (ver traducir_shaders)

    # ── MonoBehaviour ──
    def _archivo_externo(self, af, fid):
        if fid == 0:
            return af
        return self.archivos.get(nombre_archivo(af.externals[fid - 1].path))

    def encabezado(self, o):
        """m_GameObject, m_Enabled y m_Script de un MonoBehaviour, leídos a mano: los nodos
        generados no alinean después de m_Enabled en 2018.4 y m_Script sale corrido 3 bytes
        (lo que sigue se realinea solo con la cadena m_Name)."""
        r = o.reader
        r.Position = o.byte_start
        go = (r.read_int(), r.read_long()); en = r.read_u_byte(); r.align_stream()
        sc = (r.read_int(), r.read_long())
        return go, en, sc

    def script(self, o):
        """El MonoScript de un MonoBehaviour (ensamblado, espacio de nombres, clase)."""
        _, _, (fid, pid) = self.encabezado(o)
        af = self._archivo_externo(o.assets_file, fid)
        if af is None or pid not in af.objects:
            return None
        k = (af.name, pid)
        if k not in self.scripts:
            ms = af.objects[pid].read()
            self.scripts[k] = (ms.m_AssemblyName.replace(".dll", ""), ms.m_Namespace, ms.m_ClassName)
        return self.scripts[k]

    def nodos_de(self, ens, ns, clase):
        k = (ens, ns, clase)
        if k not in self.nodos:
            nombre = f"{ns}.{clase}" if ns else clase
            try:
                self.nodos[k] = arreglar_arreglos(self.gen.get_nodes_up(ens, nombre))
            except Exception as e:
                self.avisos.add(f"sin typetree para {ens}:{nombre}: {e}")
                self.nodos[k] = None
        return self.nodos[k]

    # ── objetos ──
    def leer(self, o):
        """(árbol, script) de un objeto."""
        tipo = o.type.name
        if tipo == "MonoBehaviour":
            sc = self.script(o)
            nodos = self.nodos_de(*sc) if sc else None
            go, en, scr = self.encabezado(o)
            cab = {"m_GameObject": {"m_FileID": go[0], "m_PathID": go[1]}, "m_Enabled": en,
                   "m_Script": {"m_FileID": scr[0], "m_PathID": scr[1]}}
            if nodos is not None:
                try:
                    arbol = o.read_typetree(nodes=nodos, check_read=False)
                    arbol.update(cab)
                    return arbol, sc
                except Exception as e:
                    self.avisos.add(f"MonoBehaviour {sc}: {e}")
            return cab, sc
        arbol = o.read_typetree(check_read=False)
        if tipo == "TextAsset" and isinstance(arbol.get("m_Script"), str):
            # el contenido tal cual: puede ser binario (UnityPy lo deja en un str con surrogateescape)
            arbol["m_Script"] = arbol["m_Script"].encode("utf-8", "surrogateescape")
        if tipo == "Shader":
            arbol = self.shader(o, arbol)
        elif tipo == "AudioClip":
            arbol = self.audio(o, arbol)
        elif tipo in ("Texture2D", "Cubemap", "Texture3D", "Texture2DArray"):
            arbol = self.textura(o, arbol)
        elif tipo == "Mesh":
            arbol = self.malla(o, arbol)
        elif tipo == "VideoClip":
            arbol = self.video(o, arbol)
        return arbol, None

    def leer_stream(self, af, ruta, desde, largo):
        nombre = nombre_archivo(ruta)
        # los nombres se comparan en minúsculas (en el APK lo están; en un build de PC no:
        # "resources.assets.resS")
        if not hasattr(self, "_por_nombre"):
            self._por_nombre = {x.name.lower(): x for x in self.datos.iterdir() if x.is_file()}
        p = self._por_nombre.get(nombre)
        if p is None:
            # partido en .split0, .split1... como en el APK
            partes = sorted((x for k, x in self._por_nombre.items() if k.startswith(nombre + ".split")), key=lambda x: int(x.suffix[6:]))
            if not partes:
                raise FileNotFoundError(ruta)
            return b"".join(x.read_bytes() for x in partes)[desde:desde + largo]
        with open(p, "rb") as f:
            f.seek(desde)
            return f.read(largo)

    def textura(self, o, a):
        sd = a.get("m_StreamData")
        datos = None
        if sd and sd.get("size"):
            datos = self.leer_stream(o.assets_file, sd["path"], sd["offset"], sd["size"])
            a["m_StreamData"] = {"offset": 0, "size": 0, "path": ""}
        elif isinstance(a.get("image data"), (bytes, bytearray)) and texturas.es_de_pc(a.get("m_TextureFormat")):
            datos = bytes(a["image data"])
        if datos is not None and texturas.es_de_pc(a.get("m_TextureFormat")):
            caras = 6 if o.type.name == "Cubemap" else max(1, a.get("m_ImageCount", 1))
            nuevo = texturas.para_telefono(a["m_TextureFormat"], a["m_Width"], a["m_Height"], a.get("m_MipCount", 1), datos, caras)
            if nuevo:
                a["m_TextureFormat"], datos = nuevo
                a["m_CompleteImageSize"] = len(datos) // caras
        if datos is not None:
            a["image data"] = {"_recurso": self.recursos(datos)}
        return a

    def malla(self, o, a):
        """En los builds nuevos los vértices van aparte (.resS): se traen a m_VertexData."""
        sd = a.get("m_StreamData")
        if sd and sd.get("size") and isinstance(a.get("m_VertexData"), dict):
            a["m_VertexData"]["m_DataSize"] = self.leer_stream(o.assets_file, sd["path"], sd["offset"], sd["size"])
            a["m_StreamData"] = {"offset": 0, "size": 0, "path": ""}
        return a

    def video(self, o, a):
        """El archivo del video, pasado a WebM (ver a_webm): el navegador lo pasa a la textura."""
        r = a.get("m_ExternalResources")
        if r and r.get("m_Size"):
            datos = self.leer_stream(o.assets_file, r["m_Source"], r["m_Offset"], r["m_Size"])
            datos = a_webm(datos, a.get("m_Name") or "video")
            a["_datos"] = {"_recurso": self.recursos(datos)}
        return a

    def audio(self, o, a):
        r = a.get("m_Resource")
        if r and r.get("m_Size"):
            datos = self.leer_stream(o.assets_file, r["m_Source"], r["m_Offset"], r["m_Size"])
            a["_datos"] = {"_recurso": self.recursos(datos)}   # FSB5 tal cual: después fsb-ogg lo pasa a Ogg
        return a

    def traducir_shaders(self):
        """Si el build sólo trae DirectX 11 (uno de PC), todos los shaders se traducen antes, juntos
        (HLSLcc tarda segundos con miles de variantes), y quedan en la convención de D3D."""
        candidatos = []
        for af in self.archivos.values():
            for pid, o in af.objects.items():
                if o.type.name == "Shader":
                    candidatos.append((id(af), pid, o))
        hay_gles = solo_d3d = False
        arboles = {}
        for nombre, pid, o in candidatos:
            t = o.read_typetree(check_read=False)
            plats = list(t.get("platforms") or [])
            hay_gles |= PLATAFORMA_GLES3 in plats
            solo_d3d |= dxbc.PLATAFORMA_D3D11 in plats and PLATAFORMA_GLES3 not in plats
            arboles[(nombre, pid)] = t
        if not solo_d3d:
            return
        if not self.dxbc_glsl:
            raise SystemExit("los shaders son de DirectX 11: hace falta --dxbc-glsl (ver dxbc/compilar.sh)")
        self.convencion = "d3d11"
        preps, trabajos = {}, []
        for k, t in arboles.items():
            p = dxbc.preparar_shader(t)
            if p is None:
                continue
            p["base"] = len(trabajos)
            trabajos.extend(p["trabajos"])
            preps[k] = p
        t0 = time.time()
        avisos = []
        glsl = dxbc.traducir(trabajos, self.dxbc_glsl, avisos)
        log(f"shaders de D3D11: {len(trabajos)} variantes, {sum(1 for g in glsl if g)} traducidas ({time.time() - t0:.0f} s)")
        for a in avisos[:10]:
            self.avisos.add(a)
        for k, p in preps.items():
            t = arboles[k]
            programas = dxbc.aplicar(t, p, glsl[p["base"]:p["base"] + len(p["trabajos"])])
            for c in ("compressedBlob", "offsets", "compressedLengths", "decompressedLengths", "stageCounts"):
                t.pop(c, None)
            t["_gles3"] = {"_recurso": self.recursos(json.dumps(programas, ensure_ascii=False).encode("utf-8"))}
            self.shaders_d3d[k] = t

    def shader(self, o, a):
        """El GLSL de GLES3 de cada subprograma, en vez de los blobs de todas las plataformas."""
        ya = self.shaders_d3d.get((id(o.assets_file), o.path_id))
        if ya is not None:
            return ya
        programas = []
        sh = o.read()
        for i, plat in enumerate(sh.platforms):
            if plat != PLATAFORMA_GLES3:
                continue
            off, cl, dl = (v[0] if isinstance(v, list) else v for v in (sh.offsets[i], sh.compressedLengths[i], sh.decompressedLengths[i]))
            crudo = lz4.block.decompress(bytes(sh.compressedBlob)[off:off + cl], uncompressed_size=dl)
            prog = ShaderProgram(EndianBinaryReader(crudo, endian="<"), o.version)
            for sub in prog.m_SubPrograms:
                codigo = bytes(sub.m_ProgramCode).decode("utf-8", "replace")
                vs, fs = partir_glsl(codigo)
                if self.arreglar:
                    vs = arreglar_swizzles(vs, sh.m_ParsedForm.m_Name, self.avisos)
                    fs = arreglar_swizzles(fs, sh.m_ParsedForm.m_Name, self.avisos)
                programas.append({"vs": vs, "fs": fs, "kw": list(sub.m_Keywords or []) + list(sub.m_LocalKeywords or [])})
        for k in ("compressedBlob", "offsets", "compressedLengths", "decompressedLengths"):
            a.pop(k, None)
        a["_gles3"] = {"_recurso": self.recursos(json.dumps(programas, ensure_ascii=False).encode("utf-8"))}
        return a

    # ── archivos ──
    def exportar_archivo(self, nombre, af):
        t0 = time.time()
        esc = Escritor(self.recursos)
        esc.externos = [nombre_archivo(e.path) for e in af.externals]
        indices_script = {}
        n = 0
        for o in af.objects.values():
            tipo = o.type.name
            try:
                if tipo in OMITIR:
                    arbol, sc = {}, None
                else:
                    arbol, sc = self.leer(o)
            except Exception as e:
                self.fallas[f"{nombre}:{o.path_id} {tipo}"] = repr(e)[:200]
                arbol, sc = {}, None
            si = -1
            if sc is not None:
                si = indices_script.get(sc)
                if si is None:
                    si = indices_script[sc] = len(esc.scripts)
                    esc.scripts.append(sc)
            esc.objeto(o.path_id, int(o.class_id), si, arbol)
            n += 1
        datos = esc.bytes()
        (self.salida / "paquetes" / (nombre + ".paq")).write_bytes(datos)
        log(f"  {nombre}: {n} objetos, {len(datos) / 1e6:.1f} MB ({time.time() - t0:.0f} s)")
        return {"objetos": n, "bytes": len(datos)}

    def correr(self, solo=None):
        indice = {"archivos": {}, "escenas": [], "recursos": None}
        self.traducir_shaders()
        for nombre, af in sorted(self.archivos.items()):
            if solo and nombre not in solo:
                continue
            indice["archivos"][nombre] = self.exportar_archivo(nombre, af)
        # las escenas en el orden del build (level0, level1...)
        gg = self.archivos.get("globalgamemanagers")
        if gg:
            for o in gg.objects.values():
                if o.type.name == "BuildSettings":
                    indice["escenas"] = list(o.read_typetree(check_read=False)["scenes"])
        indice["recursos"] = self.recursos.tabla
        indice["unity"] = self.version
        indice["convencion"] = self.convencion
        indice["fallas"] = self.fallas
        (self.salida / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1))
        for a in sorted(self.avisos)[:60]:
            log("aviso:", a)
        if self.fallas:
            log(f"{len(self.fallas)} objetos sin leer; los primeros:")
            for k, v in list(self.fallas.items())[:20]:
                log("  ", k, v)
        log(f"recursos: {len(self.recursos.tabla)}, {sum(r['bytes'] for r in self.recursos.tabla) / 1e6:.1f} MB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("datos")
    ap.add_argument("salida")
    ap.add_argument("--solo", default="", help="archivos a exportar, separados por comas")
    ap.add_argument("--arreglar-swizzles", action="store_true", help="reparar los shaders decompilados (ver shaders.py)")
    ap.add_argument("--dxbc-glsl", default=None, help="el traductor de shaders de D3D11 (dxbc/compilar.sh): hace falta con builds de PC")
    a = ap.parse_args()
    solo = set(x.strip().lower() for x in a.solo.split(",") if x.strip()) or None
    Exportador(a.datos, a.salida, a.arreglar_swizzles, a.dxbc_glsl).correr(solo)


if __name__ == "__main__":
    main()
