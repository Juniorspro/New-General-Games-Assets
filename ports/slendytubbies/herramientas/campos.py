# Los campos que Unity guarda de cada script (MonoBehaviour), sacados de los metadatos de sus DLL:
# públicos, no estáticos, no [NonSerialized]; en el orden en que están declarados (primero los de la
# clase base). Con eso se leen los bytes crudos del MonoBehaviour (los builds no traen typetree).
import dnfile, struct, os

OBJ_UNITY = {'Object', 'GameObject', 'Transform', 'Component', 'Behaviour', 'MonoBehaviour', 'ScriptableObject', 'AudioSource', 'AudioClip',
             'Texture', 'Texture2D', 'RenderTexture', 'MovieTexture', 'Material', 'Light', 'Camera', 'Rigidbody', 'Animation', 'AnimationClip',
             'GUISkin', 'Font', 'Shader', 'Renderer', 'MeshRenderer', 'SkinnedMeshRenderer', 'ParticleEmitter', 'Mesh', 'Collider', 'BoxCollider',
             'MeshFilter', 'TextMesh', 'GUIText', 'GUITexture', 'CharacterController', 'Cubemap', 'Terrain', 'TerrainData', 'PhysicMaterial',
             'Projector', 'AudioListener', 'Flare', 'LensFlare', 'Animator', 'NavMeshAgent'}
VALOR = {'Vector2': 8, 'Vector3': 12, 'Vector4': 16, 'Quaternion': 16, 'Color': 16, 'Rect': 16, 'Color32': 4, 'LayerMask': 4, 'Bounds': 24, 'Matrix4x4': 64}

class Esquemas:
    def __init__(self, dlls):
        self.tipos = {}   # nombre -> (pe, typedef)
        for d in dlls:
            if not os.path.exists(d): continue
            pe = dnfile.dnPE(d)
            for td in pe.net.mdtables.TypeDef:
                self.tipos.setdefault(str(td.TypeName), (pe, td))
        self.cache = {}

    def _base(self, td):
        ext = td.Extends
        if ext is None or ext.row is None: return None
        nombre = str(getattr(ext.row, 'TypeName', ''))
        ns = str(getattr(ext.row, 'TypeNamespace', '') or '')
        if ns == 'System' and nombre in ('Object', 'ValueType'): return 'System.' + nombre
        if ns == 'System' and nombre == 'Enum': return 'Enum'
        return nombre

    def es_objeto(self, nombre):
        vistos = 0
        while nombre and vistos < 20:
            if nombre in OBJ_UNITY: return True
            t = self.tipos.get(nombre)
            if not t: return False
            nombre = self._base(t[1]); vistos += 1
        return False

    def _tipo(self, pe, blob, i):
        """lee un tipo de una firma; devuelve (descripción, i)"""
        e = blob[i]; i += 1
        prim = {0x02: 'bool', 0x03: 'char', 0x04: 'i1', 0x05: 'u1', 0x06: 'i2', 0x07: 'u2', 0x08: 'i4', 0x09: 'u4', 0x0a: 'i8', 0x0b: 'u8', 0x0c: 'r4', 0x0d: 'r8', 0x0e: 'string', 0x1c: 'object'}
        if e in prim: return prim[e], i
        if e in (0x11, 0x12):
            tok, i = self._comprimido(blob, i)
            tabla, fila = tok & 3, tok >> 2
            md = pe.net.mdtables
            try:
                if tabla == 0: nombre = str(md.TypeDef[fila - 1].TypeName)
                elif tabla == 1: nombre = str(md.TypeRef[fila - 1].TypeName)
                else: nombre = '?spec'
            except Exception: nombre = '?'
            return (('valor:' if e == 0x11 else 'clase:') + nombre), i
        if e == 0x1d:
            t, i = self._tipo(pe, blob, i); return ('arr', t), i
        if e == 0x15:  # GENERICINST: List<T>
            base, i = self._tipo(pe, blob, i)
            n, i = self._comprimido(blob, i)
            args = []
            for _ in range(n): a, i = self._tipo(pe, blob, i); args.append(a)
            if base.endswith('List`1'): return ('arr', args[0]), i
            return '?gen', i
        return f'?{e:x}', i

    @staticmethod
    def _comprimido(b, i):
        x = b[i]
        if x & 0x80 == 0: return x, i + 1
        if x & 0xc0 == 0x80: return ((x & 0x3f) << 8) | b[i + 1], i + 2
        return ((x & 0x1f) << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3], i + 4

    def campos(self, nombre):
        if nombre in self.cache: return self.cache[nombre]
        t = self.tipos.get(nombre)
        if not t: self.cache[nombre] = []; return []
        pe, td = t
        out = []
        b = self._base(td)
        if b and b not in OBJ_UNITY: out += self.campos(b)
        for fr in td.FieldList:
            f = fr.row
            F = f.Flags
            if not getattr(F, 'fdPublic', False) or getattr(F, 'fdStatic', False) or getattr(F, 'fdNotSerialized', False) or getattr(F, 'fdLiteral', False) or getattr(F, 'fdInitOnly', False): continue
            blob = bytes(f.Signature.value_bytes())
            tipo, _ = self._tipo(pe, blob, 1)
            out.append((str(f.Name), tipo))
        self.cache[nombre] = out
        return out

    def leer(self, nombre, raw, off, ppt):
        """lee los campos de 'nombre' desde raw[off:]; ppt(fid, pid) traduce un PPtr"""
        vals = {}
        for n, t in self.campos(nombre):
            if off >= len(raw): break
            v, off = self._valor(t, raw, off, ppt)
            if v is _PARAR: vals['_cortado'] = n; break
            vals[n] = v
        return vals, off

    def _valor(self, t, raw, off, ppt):
        al = lambda o: (o + 3) & ~3
        if t == 'bool': return bool(raw[off]), al(off + 1)
        if t in ('i1', 'u1'): return raw[off], al(off + 1)
        if t in ('i2', 'u2', 'char'): return struct.unpack_from('<h', raw, off)[0], al(off + 2)
        if t in ('i4', 'u4'): return struct.unpack_from('<i', raw, off)[0], off + 4
        if t in ('i8', 'u8'): return struct.unpack_from('<q', raw, off)[0], off + 8
        if t == 'r4': return round(struct.unpack_from('<f', raw, off)[0], 5), off + 4
        if t == 'r8': return struct.unpack_from('<d', raw, off)[0], off + 8
        if t == 'string':
            n = struct.unpack_from('<i', raw, off)[0]
            return raw[off + 4: off + 4 + n].decode('utf8', 'replace'), al(off + 4 + n)
        if isinstance(t, tuple) and t[0] == 'arr':
            n = struct.unpack_from('<i', raw, off)[0]; off += 4
            if n < 0 or n > 100000: return _PARAR, off
            out = []
            for _ in range(n):
                v, off = self._valor(t[1], raw, off, ppt)
                if v is _PARAR: return _PARAR, off
                out.append(v)
            return out, off
        if isinstance(t, str) and t.startswith('valor:'):
            nm = t[6:]
            if nm in VALOR:
                k = VALOR[nm] // 4
                return [round(x, 5) for x in struct.unpack_from(f'<{k}f', raw, off)], off + VALOR[nm]
            td = self.tipos.get(nm)
            if td is not None and self._base(td[1]) == 'Enum': return struct.unpack_from('<i', raw, off)[0], off + 4
            if td is not None:  # struct propio serializable
                return self.leer_anidado(nm, raw, off, ppt)
            return _PARAR, off
        if isinstance(t, str) and t.startswith('clase:'):
            nm = t[6:]
            if nm == 'AnimationCurve':
                n = struct.unpack_from('<i', raw, off)[0]; off += 4
                ks = [struct.unpack_from('<4f', raw, off + 16 * k) for k in range(n)]; off += 16 * n
                return {'curva': ks, 'pre': struct.unpack_from('<2i', raw, off)}, off + 8
            if nm == 'GUIStyle': return _PARAR, off
            if self.es_objeto(nm):
                fid, pid = struct.unpack_from('<ii', raw, off)
                return ppt(fid, pid), off + 8
            if nm in self.tipos: return self.leer_anidado(nm, raw, off, ppt)
            return _PARAR, off
        return _PARAR, off

    def leer_anidado(self, nm, raw, off, ppt):
        v, off = self.leer(nm, raw, off, ppt)
        return (v if '_cortado' not in v else _PARAR), off

_PARAR = object()
