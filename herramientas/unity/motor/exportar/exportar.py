#!/usr/bin/env python3
"""Exporta los datos de un juego de Unity 2018.4 (Mono) al formato del motor.

    python -I exportar.py DATA SALIDA [--solo level0,globalgamemanagers ...] [--arreglar-swizzles]

DATA es assets/bin/Data del APK (sacado con unzip). En SALIDA quedan:
    paquetes/NOMBRE.paq   un archivo serializado de Unity entero (ver arbol.py)
    recursos/ID.bin       lo grande (texturas, mallas, audio, código de shaders), aparte
    indice.json           los archivos, las escenas en orden y la tabla de recursos

Cada objeto se lee con su typetree (UnityPy trae los de las clases del motor para cada
versión; los de los MonoBehaviour se generan desde las DLL del juego) y se guarda entero: el
motor ve lo mismo que Unity al cargar. Lo que cambia:
  - los datos que Unity guarda aparte (.resS, .resource) se traen como recursos;
  - de cada Shader, en vez de los blobs comprimidos de cada plataforma, va el GLSL de GLES3 de
    cada subprograma (con --arreglar-swizzles, reparado: ver shaders.py);
  - OcclusionCullingData no va (es el formato propio de Umbra; el motor hace su descarte).

Lo bajado es de terceros: los datos se leen, no se ejecuta nada de ellos. Correr con python -I.
"""
import argparse
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
from UnityPy.streams import EndianBinaryReader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from arbol import Escritor  # noqa: E402
from shaders import arreglar_swizzles, partir_glsl  # noqa: E402

GLES3 = 4             # ShaderGpuProgramType.kShaderGpuProgramGLES3
PLATAFORMA_GLES3 = 9  # ShaderCompilerPlatform.kShaderCompPlatformGLES3Plus
OMITIR = {"OcclusionCullingData"}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def nombre_archivo(ruta):
    """Como se nombran los archivos entre sí (externos): sin carpetas, en minúsculas."""
    return ruta.replace("\\", "/").split("/")[-1].lower()


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


class Exportador:
    def __init__(self, datos, salida, arreglar):
        self.datos = Path(datos)
        self.salida = Path(salida)
        self.arreglar = arreglar
        log("cargando", self.datos)
        self.env = UnityPy.load(str(self.datos))
        self.gen = TypeTreeGenerator("2018.4.36f1")
        self.gen.load_local_dll_folder(str(self.datos / "Managed"))
        self.env.typetree_generator = self.gen
        self.recursos = Recursos(self.salida / "recursos")
        (self.salida / "paquetes").mkdir(parents=True, exist_ok=True)
        self.archivos = {nombre_archivo(n): f for n, f in self.env.files.items() if hasattr(f, "objects")}
        self.scripts = {}       # (archivo, pathID del MonoScript) -> (ensamblado, ns, clase)
        self.nodos = {}         # (ensamblado, clase) -> nodos del typetree (o None)
        self.avisos = set()
        self.fallas = {}

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
                self.nodos[k] = self.gen.get_nodes_up(ens, nombre)
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
        return arbol, None

    def leer_stream(self, af, ruta, desde, largo):
        nombre = nombre_archivo(ruta)
        p = self.datos / nombre
        if not p.exists():
            # partido en .split0, .split1... como en el APK
            partes = sorted(self.datos.glob(nombre + ".split*"), key=lambda x: int(x.suffix[6:]))
            if not partes:
                raise FileNotFoundError(ruta)
            datos = b"".join(x.read_bytes() for x in partes)
        else:
            datos = p.read_bytes()
        return datos[desde:desde + largo]

    def textura(self, o, a):
        sd = a.get("m_StreamData")
        if sd and sd.get("size"):
            datos = self.leer_stream(o.assets_file, sd["path"], sd["offset"], sd["size"])
            a["image data"] = {"_recurso": self.recursos(datos)}
            a["m_StreamData"] = {"offset": 0, "size": 0, "path": ""}
        return a

    def audio(self, o, a):
        r = a.get("m_Resource")
        if r and r.get("m_Size"):
            datos = self.leer_stream(o.assets_file, r["m_Source"], r["m_Offset"], r["m_Size"])
            a["_datos"] = {"_recurso": self.recursos(datos)}   # FSB5 tal cual: después fsb-ogg lo pasa a Ogg
        return a

    def shader(self, o, a):
        """El GLSL de GLES3 de cada subprograma, en vez de los blobs de todas las plataformas."""
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
    a = ap.parse_args()
    solo = set(x.strip().lower() for x in a.solo.split(",") if x.strip()) or None
    Exportador(a.datos, a.salida, a.arreglar_swizzles).correr(solo)


if __name__ == "__main__":
    main()
