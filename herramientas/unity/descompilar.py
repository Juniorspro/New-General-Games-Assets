#!/usr/bin/env python3
"""El código de un juego Unity IL2CPP (libil2cpp.so, ARM64) descompilado a C con Ghidra, con los nombres
y tipos de Il2CppDumper: cada método con su nombre y su firma, las clases como structs (il2cpp.h, así
los campos salen por nombre: __this->fields.Progress), las cadenas literales como s_<texto> y los
TypeInfo/MethodInfo con su nombre.

    python descompilar.py preparar GHIDRA LIBIL2CPP.so DUMP PROYECTO     una vez (unos minutos)
    python descompilar.py servir GHIDRA PROYECTO DUMP SOCKET             queda corriendo
    python descompilar.py pedir SOCKET 'Clase\\$\\$Metodo$' 0x24268c0 …  el C de cada método

GHIDRA es la carpeta de Ghidra (11.x, con Java 21); DUMP, la salida de Il2CppDumper con
GenerateStruct (script.json, il2cpp.h). Necesita pyghidra, que viene con Ghidra
(Ghidra/Features/PyGhidra/pypkg/dist: jpype1, packaging, pyghidra).
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
    gp.save(prog)
    gp.close()
    print(f'[listo en {time.time() - t0:.0f} s]', file=sys.stderr)


# ------------------------------------------------------------------ servidor
def _limpiar_c(c):
    """Menos ruido: sin advertencias de Ghidra ni la inicialización perezosa de metadatos de IL2CPP."""
    out = []
    for l in c.splitlines():
        if not l.strip() or l.strip().startswith('/* WARNING'):
            continue
        out.append(l)
    return '\n'.join(out)


def servir(ghidra, proyecto, dump, ruta_socket):
    arrancar(ghidra)
    from ghidra.base.project import GhidraProject
    from ghidra.app.decompiler import DecompInterface, DecompileOptions
    from ghidra.util.task import ConsoleTaskMonitor
    gp = GhidraProject.openProject(proyecto, 'il2cpp', True)
    prog = gp.openProgram('/', 'libil2cpp.so', True)
    ifc = DecompInterface()
    op = DecompileOptions()
    op.grabFromProgram(prog)
    ifc.setOptions(op)
    ifc.openProgram(prog)
    base = prog.getImageBase()
    fm = prog.getFunctionManager()
    metodos = [(m['Name'], m['Address']) for m in json.load(open(os.path.join(dump, 'script.json'), encoding='utf-8'))['ScriptMethod']]
    mon = ConsoleTaskMonitor()

    def un_metodo(addr):
        f = fm.getFunctionContaining(base.add(addr))
        if f is None:
            return f'// {addr:#x}: sin función'
        r = ifc.decompileFunction(f, 120, mon)
        if not r.decompileCompleted():
            return f'// {f.getName()}: {r.getErrorMessage()}'
        return f'// {f.getName()} @ {f.getEntryPoint()}\n' + _limpiar_c(r.getDecompiledFunction().getC())

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
        servir(*a[1:5])
    else:
        pedir(a[1], a[2:])
