"""Pantallas de Unity UI (Canvas, RectTransform, Image, Text, botones y los MonoBehaviour del juego)
→ un árbol JSON que ui.js arma en HTML con el mismo layout.

    from ui import ExportadorUI
    ex = ExportadorUI(paquete, carpeta_sprites, carpeta_fuentes, clase_de)
    arbol = ex.arbol(transform_raiz)          # {'n', 'id', 'rt', 'c': [componentes], 'h': [hijos]}
    ex.guardar_indices(carpeta)               # sprites.json (tamaños y bordes 9-slice) y fuentes.json

Cada componente va con su clase y sus campos (typetree): las referencias a sprites, fuentes, texturas
y sonidos quedan por nombre (y se exportan), las de objetos de la misma pantalla por id de GameObject
({'go': id}), para que la página pueda hacer lo que hacía cada script del juego.
"""
import io
import json
import os

NO_SIRVE = {'m_GameObject', 'm_Script', 'm_Name', 'm_OnCullStateChanged', 'm_RaycastPadding', 'm_Maskable',
            'm_EditorClassIdentifier'}


def _r(x):
    return round(x, 4) if isinstance(x, float) else x


class ExportadorUI:
    def __init__(self, paquete, carpeta_sprites, carpeta_fuentes, clase_de, calidad=90, anim=None):
        self.b = paquete
        self.anim = anim         # ExportadorAnim (animui.py): los Animator de las pantallas
        self.cs, self.cf = carpeta_sprites, carpeta_fuentes
        self.clase_de = clase_de
        self.calidad = calidad
        self.sprites = {}        # (archivo, path_id) → nombre
        self.info_sprites = {}   # nombre → {w, h, b: [izq, abajo, der, arriba], ppu}
        self.fuentes = {}
        self.archivos_fuente = {}
        self.texturas = {}
        self.audios = {}
        self.avisos = []

    # ------------------------------------------------------------ referencias
    def _objeto(self, f, fid, pid):
        if not pid:
            return None
        try:
            if fid:
                ext = f.externals[fid - 1]
                f = self.b.files[ext.name]
            return f.objects[pid]
        except Exception:
            return None

    def _nombre_libre(self, base, usados):
        n, i = base, 1
        while n in usados:
            i += 1
            n = f'{base}~{i}'
        return n

    def sprite(self, o):
        k = (o.assets_file.name, o.path_id)
        if k in self.sprites:
            return self.sprites[k]
        s = o.read()
        try:
            im = s.image
        except Exception as e:
            self.avisos.append(f'sprite {s.m_Name}: {e}')
            self.sprites[k] = None
            return None
        nombre = self._nombre_libre(s.m_Name, self.info_sprites)
        b = s.m_Border
        self.info_sprites[nombre] = {'w': im.width, 'h': im.height,
                                     'b': [_r(b.x), _r(b.y), _r(b.z), _r(b.w)],
                                     'ppu': _r(getattr(s, 'm_PixelsToUnits', None) or getattr(s, 'm_PixelsPerUnit', 100))}
        if im.mode != 'RGBA':
            im = im.convert('RGBA')
        if im.getchannel('A').getextrema()[0] == 255:
            im = im.convert('RGB')
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=self.calidad, method=4, alpha_quality=100)
        os.makedirs(self.cs, exist_ok=True)
        with open(os.path.join(self.cs, nombre + '.webp'), 'wb') as f:
            f.write(buf.getvalue())
        self.sprites[k] = nombre
        return nombre

    def fuente(self, o):
        k = (o.assets_file.name, o.path_id)
        if k in self.fuentes:
            return self.fuentes[k]
        fo = o.read()
        datos = bytes(fo.m_FontData) if getattr(fo, 'm_FontData', None) else b''
        nombre = fo.m_Name
        if datos:
            os.makedirs(self.cf, exist_ok=True)
            ext = '.otf' if datos[:4] == b'OTTO' else '.ttf'
            with open(os.path.join(self.cf, nombre + ext), 'wb') as f:
                f.write(datos)
            self.archivos_fuente[nombre] = nombre + ext
        self.fuentes[k] = nombre
        return nombre

    def textura(self, o):
        k = (o.assets_file.name, o.path_id)
        if k in self.texturas:
            return self.texturas[k]
        t = o.read()
        nombre = self._nombre_libre(t.m_Name, set(self.texturas.values()))
        try:
            im = t.image
            buf = io.BytesIO()
            im.save(buf, 'WEBP', quality=self.calidad, method=4, alpha_quality=100)
            os.makedirs(self.cs, exist_ok=True)
            with open(os.path.join(self.cs, nombre + '.webp'), 'wb') as f:
                f.write(buf.getvalue())
        except Exception as e:
            self.avisos.append(f'textura {t.m_Name}: {e}')
        self.texturas[k] = nombre
        return nombre

    def ref(self, f, x):
        """Un PPtr del typetree → algo útil para la página."""
        o = self._objeto(f, x['m_FileID'], x['m_PathID'])
        if o is None:
            return None
        tipo = o.type.name
        try:
            if tipo == 'Sprite':
                return {'sprite': self.sprite(o)}
            if tipo == 'Font':
                return {'fuente': self.fuente(o)}
            if tipo == 'Texture2D':
                return {'textura': self.textura(o)}
            if tipo == 'GameObject':
                return {'go': o.path_id} if o.assets_file is f else {'obj': 'GameObject', 'n': o.read().m_Name}
            if tipo in ('Transform', 'RectTransform') or tipo == 'MonoBehaviour' or tipo.endswith(('Renderer', 'Collider', 'Group')) \
                    or tipo in ('Animator', 'Animation', 'Camera', 'Canvas', 'AudioSource', 'ParticleSystem'):
                if o.assets_file is f:
                    try:
                        r = o.reader
                        r.Position = o.byte_start
                        go_f, go_p = r.read_int(), r.read_long()
                        return {'comp': o.path_id, 'go': go_p, 't': tipo}
                    except Exception:
                        return {'comp': o.path_id, 't': tipo}
                return {'obj': tipo}
            if tipo == 'AudioClip':
                return {'audio': o.read().m_Name}
            if tipo == 'Material':
                return {'mat': o.read().m_Name}
            n = None
            try:
                n = o.read().m_Name
            except Exception:
                pass
            return {'obj': tipo, 'n': n}
        except Exception as e:
            self.avisos.append(f'ref {tipo}: {e}')
            return {'obj': tipo}

    def limpiar(self, f, x):
        if isinstance(x, dict):
            if set(x) == {'m_FileID', 'm_PathID'}:
                return self.ref(f, x)
            return {k: self.limpiar(f, v) for k, v in x.items() if k not in NO_SIRVE}
        if isinstance(x, list):
            return [self.limpiar(f, v) for v in x]
        if isinstance(x, (bytes, bytearray)):
            return None
        return _r(x)

    # ------------------------------------------------------------ árbol
    def componente(self, f, o, t=None):
        tipo = o.type.name
        if tipo == 'MonoBehaviour':
            try:
                d = o.read_typetree()
            except Exception as e:
                return {'c': self.clase_de(o) or '?', 'error': str(e)[:80]}
            out = {'c': self.clase_de(o) or '?'}
            if not d.get('m_Enabled', 1):
                out['off'] = 1
            d.pop('m_Enabled', None)
            out.update(self.limpiar(f, d))
            return out
        if tipo == 'Canvas':
            c = o.read()
            return {'c': 'Canvas', 'modo': c.m_RenderMode, 'orden': c.m_SortingOrder,
                    'propio': int(bool(getattr(c, 'm_OverrideSorting', 0))), 'pixel': int(bool(getattr(c, 'm_PixelPerfect', 0)))}
        if tipo == 'CanvasGroup':
            c = o.read()
            return {'c': 'CanvasGroup', 'alfa': _r(c.m_Alpha), 'interact': int(bool(c.m_Interactable)),
                    'bloquea': int(bool(c.m_BlocksRaycasts)), 'ignora': int(bool(getattr(c, 'm_IgnoreParentGroups', 0)))}
        if tipo == 'Animator':
            c = o.read()
            n = None
            if self.anim is not None and t is not None:
                try:
                    n = self.anim.animator(o, t)
                except Exception as e:
                    self.avisos.append(f'animator: {e}')
            if n is None:
                try:
                    n = c.m_Controller.read().m_Name
                except Exception:
                    pass
            return {'c': 'Animator', 'ctl': n, **({} if c.m_Enabled else {'off': 1})}
        if tipo in ('CanvasRenderer', 'Transform', 'RectTransform'):
            return None
        return {'c': tipo}

    def arbol(self, t):
        f = t.assets_file
        go = t.m_GameObject.read()
        n = {'n': go.m_Name, 'id': t.m_GameObject.path_id}
        if not go.m_IsActive:
            n['off'] = 1
        if hasattr(t, 'm_AnchorMin'):
            n['rt'] = [_r(t.m_AnchorMin.x), _r(t.m_AnchorMin.y), _r(t.m_AnchorMax.x), _r(t.m_AnchorMax.y),
                       _r(t.m_AnchoredPosition.x), _r(t.m_AnchoredPosition.y), _r(t.m_SizeDelta.x),
                       _r(t.m_SizeDelta.y), _r(t.m_Pivot.x), _r(t.m_Pivot.y)]
        else:
            p = t.m_LocalPosition
            n['p'] = [_r(p.x), _r(p.y), _r(p.z)]
        s = t.m_LocalScale
        if (round(s.x, 4), round(s.y, 4), round(s.z, 4)) != (1, 1, 1):
            n['s'] = [_r(s.x), _r(s.y), _r(s.z)]
        q = t.m_LocalRotation
        if (round(q.x, 4), round(q.y, 4), round(q.z, 4)) != (0, 0, 0):
            n['q'] = [_r(q.x), _r(q.y), _r(q.z), _r(q.w)]
        p = t.m_LocalPosition
        if 'rt' in n and abs(p.z) > 1e-4:
            n['z'] = _r(p.z)
        comps = []
        for c in go.m_Component:
            try:
                o = c.component.deref()
            except Exception:
                continue
            x = self.componente(f, o, t)
            if x:
                comps.append(x)
        if comps:
            n['c'] = comps
        hijos = [self.arbol(h.read()) for h in t.m_Children]
        if hijos:
            n['h'] = hijos
        return n

    def guardar_indices(self, carpeta):
        os.makedirs(carpeta, exist_ok=True)
        with open(os.path.join(carpeta, 'sprites.json'), 'w') as f:
            json.dump(self.info_sprites, f, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(carpeta, 'fuentes.json'), 'w') as f:
            json.dump(sorted(set(self.archivos_fuente.values())), f)
