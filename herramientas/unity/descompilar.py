#!/usr/bin/env python3
"""El código de un juego Unity IL2CPP (libil2cpp.so, ARM64) descompilado a C con Ghidra, con los nombres
y tipos de Il2CppDumper: cada método con su nombre y su firma, las clases como structs (il2cpp.h, así
los campos salen por nombre: __this->fields.Progress), las cadenas literales como s_<texto> y los
TypeInfo/MethodInfo con su nombre.

    python descompilar.py preparar GHIDRA LIBIL2CPP.so DUMP PROYECTO     una vez (unos minutos)
    python descompilar.py servir GHIDRA PROYECTO DUMP SOCKET [AYUDAS]    queda corriendo
    python descompilar.py pedir SOCKET 'Clase\\$\\$Metodo$' 0x24268c0 …  el C de cada método

GHIDRA es la carpeta de Ghidra (11.x, con Java 21); DUMP, la salida de Il2CppDumper con
GenerateStruct (script.json, il2cpp.h). AYUDAS (opcional) es un JSON con las funciones internas de
IL2CPP de ese binario, {"0x127c48c": ["il2cpp_init_metadata", false], "0x127c700": ["il2cpp_null", true]}
(true = no vuelve): se nombran y la inicialización perezosa de metadatos se saca del C.
Necesita pyghidra, que viene con Ghidra (Ghidra/Features/PyGhidra/pypkg/dist: jpype1, packaging,
pyghidra). El socket UNIX tiene que tener una ruta corta (p. ej. /tmp/gh/s).
"""
import json
import os
import re
import socket
import sys
import time

PRELUDIO = ('typedef unsigned __int8 uint8_t;\ntypedef unsigned __int16 uint16_t;\n'
            'typedef unsigned __int32 uint32_t;\ntypedef unsigned __int64 uint64_t;\n'
            'typedef __int8 int8_t;\ntypedef __int16 int16_t;\ntypedef __int32 int32_t;\n'
            'typedef __int64 int64_t;\ntypedef __int64 intptr_t;\ntypedef __int64 uintptr_t;\n'
            'typedef unsigned __int64 size_t;\ntypedef _Bool bool;\n')

def arrancar(ghidra, memoria='10g'):
    from pyghidra.launcher import HeadlessPyGhidraLauncher
    lz = HeadlessPyGhidraLauncher(install_dir=ghidra)
    lz.add_vmargs(f'-Xmx{memoria}')
    lz.start()


def _limpio(n):
    return n.replace(' ', '-')


def preparar(ghidra, so, dump, proyecto):
    t0 = time.time()
    arrancar(ghidra)
    from java.io import File
    from ghidra.base.project import GhidraProject
    from ghidra.app.util.cparser.C import CParser, CParserUtils
    from ghidra.app.cmd.function import ApplyFunctionSignatureCmd, CreateFunctionCmd
    from ghidra.program.model.symbol import SourceType
    from ghidra.program.model.data import PointerDataType
    from ghidra.program.model.listing import CodeUnit
    from ghidra.util.task import TaskMonitor
    mon = TaskMonitor.DUMMY
    os.makedirs(proyecto, exist_ok=True)
    gp = GhidraProject.createProject(proyecto, 'il2cpp', False)
    prog = gp.importProgram(File(so))
    tx = prog.startTransaction('il2cpp')
    dtm = prog.getDataTypeManager()
    # 1) las clases y estructuras de il2cpp.h (la herencia, como primer campo "super")
    texto = PRELUDIO + re.sub(r': (\w+) {', r'{\n \1 super;', open(os.path.join(dump, 'il2cpp.h'), encoding='utf-8').read())
    try:
        CParser(dtm, True, None).parse(texto)
    except Exception as e:     # lo que se alcanzó a leer queda
        print('il2cpp.h:', str(e)[:300], file=sys.stderr)
    print(f'[tipos: {dtm.getDataTypeCount(True)} en {time.time() - t0:.0f} s]', file=sys.stderr)
    datos = json.load(open(os.path.join(dump, 'script.json'), encoding='utf-8'))
    base = prog.getImageBase()
    st, fm, lst = prog.getSymbolTable(), prog.getFunctionManager(), prog.getListing()
    U = SourceType.USER_DEFINED
    # 2) funciones en todas las direcciones de métodos, con nombre y firma
    for a in datos['Addresses']:
        d = base.add(a)
        if fm.getFunctionAt(d) is None:
            CreateFunctionCmd(d).applyTo(prog, mon)
    malos = 0
    for i, m in enumerate(datos['ScriptMethod']):
        d = base.add(m['Address'])
        if fm.getFunctionAt(d) is None:
            CreateFunctionCmd(d).applyTo(prog, mon)
        try:
            st.createLabel(d, _limpio(m['Name']), U)
        except Exception:
            pass
        try:
            sig = CParserUtils.parseSignature(None, prog, m['Signature'][:-1], False)
            if sig is not None:
                ApplyFunctionSignatureCmd(d, sig, U, False, True).applyTo(prog, mon)
        except Exception:
            malos += 1
        if i % 20000 == 0:
            print(f'[métodos {i}/{len(datos["ScriptMethod"])} {time.time() - t0:.0f} s]', file=sys.stderr)
    print(f'[firmas que no se pudieron poner: {malos}]', file=sys.stderr)
    # 3) cadenas literales: s_<texto> (y el texto entero como comentario)
    usados = set()
    for s in datos['ScriptString']:
        d = base.add(s['Address'])
        v = s['Value']
        n = 's_' + (re.sub(r'[^0-9A-Za-z_]', '_', v)[:48] or 'vacia')
        k = n
        i = 2
        while k in usados:
            k = f'{n}_{i}'
            i += 1
        usados.add(k)
        try:
            st.createLabel(d, k, U)
            lst.setComment(d, CodeUnit.EOL_COMMENT, v[:500])
        except Exception:
            pass
    # 4) TypeInfo, MethodInfo y demás metadatos, con su tipo cuando se puede
    def tipo(sig):
        n = sig.rstrip('*').strip()
        lista = []
        dtm.findDataTypes(n, lista)
        if not lista:
            return None
        t = lista[0]
        for _ in range(sig.count('*')):
            t = PointerDataType(t, dtm)
        return t
    for m in datos['ScriptMetadata']:
        d = base.add(m['Address'])
        try:
            st.createLabel(d, _limpio(m['Name']), U)
            if m.get('Signature'):
                t = tipo(m['Signature'])
                if t is not None:
                    lst.clearCodeUnits(d, d.add(7), False)
                    lst.createData(d, t)
        except Exception:
            pass
    for m in datos['ScriptMetadataMethod']:
        try:
            st.createLabel(base.add(m['Address']), _limpio(m['Name']), U)
        except Exception:
            pass
    prog.endTransaction(tx, True)
    gp.saveAs(prog, '/', 'libil2cpp.so', True)      # recién importado: todavía no tiene lugar en el proyecto
    gp.close()
    print(f'[listo en {time.time() - t0:.0f} s]', file=sys.stderr)


# ------------------------------------------------------------------ servidor
def _limpiar_c(c, init=None):
    """Menos ruido: sin advertencias de Ghidra ni la inicialización perezosa de metadatos de IL2CPP
    (if (flag == 0) { init(&TypeInfo); …; flag = 1; })."""
    out = []
    lineas = c.splitlines()
    i = 0
    rx = re.compile(r"^(\s*)if \(\(?[bc]Ram[0-9a-f]+( & 1\))? == (0|'\\0')\) \{$")
    while i < len(lineas):
        l = lineas[i]
        m = rx.match(l) if init else None
        if m:
            fin = m.group(1) + '}'
            j = i + 1
            while j < len(lineas) and lineas[j] != fin:
                j += 1
            cuerpo = '\n'.join(lineas[i + 1:j])
            if init in cuerpo and 'Ram' in cuerpo:
                i = j + 1
                continue
        if l.strip() and not l.strip().startswith('/* WARNING'):
            out.append(l)
        i += 1
    return '\n'.join(out)


def _flotante(h):
    """Un entero de 32 bits que parece un float lindo (0.2, 1.65, -3.1…) → su valor, si no None."""
    import struct
    v = struct.unpack('<f', struct.pack('<I', h))[0]
    if v != v or v == 0 or not (1e-4 <= abs(v) <= 1e6):
        return None
    for d in range(0, 7):
        if abs(round(v, d) - v) <= abs(v) * 1e-6:
            return round(v, d)
    return None


def _anotar_flotantes(t):
    def uno(m):
        x = m.group(0)
        h = int(x, 16)
        if len(x) <= 10:
            f = _flotante(h) if h >= 0x30000000 else None
            return f'{x}/*{f}*/' if f is not None else x
        lo, hi = _flotante(h & 0xffffffff), _flotante(h >> 32)
        if lo is not None or hi is not None:
            return f'{x}/*{lo if lo is not None else hex(h & 0xffffffff)},{hi if hi is not None else hex(h >> 32)}*/'
        return x
    return re.sub(r'0x[0-9a-f]{8}(?:[0-9a-f]{8})?\b', uno, t)


def _corto(c, prefijos):
    """Para leer: sin el bloque de declaraciones, sin namespaces, sin los MethodInfo de IL2CPP, con las
    líneas partidas unidas y los floats escritos en hexadecimal anotados con su valor."""
    for pre in prefijos:
        c = c.replace(pre, '')
    lineas = c.splitlines()
    # unir lo que Ghidra partió (paréntesis abiertos)
    unidas, buf, abiertos = [], None, 0
    for l in lineas:
        if buf is not None:
            buf += ' ' + l.strip()
            abiertos += l.count('(') - l.count(')')
            if abiertos <= 0:
                unidas.append(buf)
                buf = None
            continue
        abiertos = l.count('(') - l.count(')')
        if abiertos > 0 and not l.rstrip().endswith('{'):
            buf = l.rstrip()
        else:
            unidas.append(l)
    if buf is not None:
        unidas.append(buf)
    out, en_decl, previa = [], False, None
    for l in unidas:
        if l == '{':
            en_decl = True
            out.append(l)
            continue
        if en_decl:
            e = l.strip()
            if not any(x in e for x in ('=', '(', '{', '}', 'goto ', 'return')) and not e.endswith(':'):
                continue
            en_decl = False
        out.append(l)
    t = '\n'.join(out)
    t = re.sub(r',\s*\(MethodInfo \*\)0x0\)', ')', t)
    t = re.sub(r',\s*method(_\d+)?\)', ')', t)
    t = re.sub(r',\s*(extraout_x\d+(_\d+)?|pMVar\d+)\)', ')', t)
    t = re.sub(r'\(MethodInfo \*\)0x0', '0', t)
    t = re.sub(r'\(\s+', '(', t)
    t = re.sub(r'\s+\)', ')', t)
    # los chequeos de null que sólo tiran la excepción, y las barreras del recolector
    sin_asig = r'(?:[^=;{}\n]|==)*'
    t = re.sub(r'\n\s*if \(' + sin_asig + r'\)\s*\n?\s*goto code_r0x[0-9a-f]+;', '', t)
    t = re.sub(r'\n\s*(\w+ = )?il2cpp_write_barrier\([^;]*\);', '', t)
    return _anotar_flotantes(t)


def servir(ghidra, proyecto, dump, ruta_socket, ayudas=None):
    arrancar(ghidra)
    from ghidra.base.project import GhidraProject
    from ghidra.app.decompiler import DecompInterface, DecompileOptions
    from ghidra.app.cmd.function import CreateFunctionCmd
    from ghidra.program.model.symbol import SourceType
    from ghidra.util.task import ConsoleTaskMonitor, TaskMonitor
    gp = GhidraProject.openProject(proyecto, 'il2cpp', True)
    prog = gp.openProgram('/', 'libil2cpp.so', False)
    init = None
    if ayudas:
        # las funciones internas de IL2CPP con nombre, y las que tiran excepción, sin vuelta
        tx = prog.startTransaction('ayudas')
        b0, fm0 = prog.getImageBase(), prog.getFunctionManager()
        for a, (n, sin_vuelta) in json.load(open(ayudas)).items():
            d = b0.add(int(a, 16))
            f = fm0.getFunctionAt(d)
            if f is None:
                CreateFunctionCmd(d).applyTo(prog, TaskMonitor.DUMMY)
                f = fm0.getFunctionAt(d)
            if f is not None:
                f.setName(n, SourceType.USER_DEFINED)
                f.setNoReturn(bool(sin_vuelta))
            if 'init' in n and not sin_vuelta and init is None:
                init = n
        prog.endTransaction(tx, True)
    ifc = DecompInterface()
    op = DecompileOptions()
    op.grabFromProgram(prog)
    ifc.setOptions(op)
    ifc.openProgram(prog)
    base = prog.getImageBase()
    fm = prog.getFunctionManager()
    datos_script = json.load(open(os.path.join(dump, 'script.json'), encoding='utf-8'))
    metodos = [(m['Name'], m['Address']) for m in datos_script['ScriptMethod']]
    # las cadenas literales con su texto entero (los nombres s_<texto> son los de preparar())
    textos, usados = {}, set()
    for x in datos_script['ScriptString']:
        v = x['Value']
        n = 's_' + (re.sub(r'[^0-9A-Za-z_]', '_', v)[:48] or 'vacia')
        k, i = n, 2
        while k in usados:
            k = f'{n}_{i}'
            i += 1
        usados.add(k)
        textos[k] = v
    del datos_script
    # los namespaces (de dump.cs), del más largo al más corto, como prefijos de los nombres en C
    prefijos = set()
    for l in open(os.path.join(dump, 'dump.cs'), encoding='utf-8'):
        if l.startswith('// Namespace: ') and len(l) > 15:
            prefijos.add(l[14:].strip().replace('.', '_') + '_')
    prefijos = sorted(prefijos, key=len, reverse=True)
    mon = ConsoleTaskMonitor()

    def un_metodo(addr):
        f = fm.getFunctionContaining(base.add(addr))
        if f is None:
            return f'// {addr:#x}: sin función'
        r = ifc.decompileFunction(f, 120, mon)
        if not r.decompileCompleted():
            return f'// {f.getName()}: {r.getErrorMessage()}'
        c = _corto(_limpiar_c(r.getDecompiledFunction().getC(), init), prefijos)
        c = re.sub(r'(?:\*\(\w+ \*\*?\))?&?(?<![A-Za-z0-9_])_?(s_[A-Za-z0-9_]+)',
                   lambda m: json.dumps(textos[m.group(1)], ensure_ascii=False) if m.group(1) in textos else m.group(0), c)
        return f'// {f.getName()} @ {f.getEntryPoint()}\n' + c

    if os.path.exists(ruta_socket):
        os.unlink(ruta_socket)
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(ruta_socket)
    srv.listen(4)
    print('[sirviendo]', file=sys.stderr, flush=True)
    while True:
        con, _ = srv.accept()
        with con:
            pedido = b''
            while not pedido.endswith(b'\n\n'):
                x = con.recv(65536)
                if not x:
                    break
                pedido += x
            partes = []
            for q in pedido.decode().split('\n'):
                q = q.strip()
                if not q:
                    continue
                if re.fullmatch(r'0x[0-9a-fA-F]+', q):
                    partes.append(un_metodo(int(q, 16)))
                    continue
                rx = re.compile(q)
                hallados = [(n, a) for n, a in metodos if rx.search(n)]
                if not hallados:
                    partes.append(f'// nada coincide con {q}')
                for n, a in hallados[:40]:
                    partes.append(un_metodo(a))
                if len(hallados) > 40:
                    partes.append(f'// … y {len(hallados) - 40} más')
            con.sendall(('\n\n'.join(partes) + '\n').encode())


def pedir(ruta_socket, consultas):
    c = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    c.connect(ruta_socket)
    c.sendall(('\n'.join(consultas) + '\n\n').encode())
    datos = b''
    while True:
        x = c.recv(1 << 20)
        if not x:
            break
        datos += x
    sys.stdout.write(datos.decode())


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('preparar', 'servir', 'pedir'):
        sys.exit(__doc__)
    if a[0] == 'preparar':
        preparar(*a[1:5])
    elif a[0] == 'servir':
        servir(*a[1:6])
    else:
        pedir(a[1], a[2:])
