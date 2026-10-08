"""Los shaders de Unity para el motor: el GLSL de GLES de cada subprograma, partido en sus dos
etapas, y el arreglo de los swizzles que perdieron los shaders decompilados de algunos ports."""
import re

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
            if re.fullmatch(r"_Color\d\d", u):
                # el compilador guardó los colores de Recolor x8 como (a, r, g, b): .x es el alfa
                return u + ".wxyz"
            if u == "_Color":
                # sólo si el otro operando también está en ese orden (u_xlat3.wxyz * _Color): en los
                # shaders de Unity (UI/Default, Sprites, Standard...) `in_COLOR0 * _Color` está bien
                # así, y darlo vuelta tiñe mal y deja el alfa en 1 (el cono de la aspiradora opaco)
                return u + ".wxyz" if ".wxyz" in expr else u
            if u == "_Tint" and expr.strip() == u:
                return u  # copia entera: no le faltaba nada
            if avisos is not None:
                avisos.add(f"{nombre}: {u} sin swizzle en «{linea.strip()}»")
            return u
        lineas[i] = m.group(1) + m.group(2) + m.group(3) + sueltos.sub(cambio, expr) + ";" + m.group(5)
    return "\n".join(lineas)
