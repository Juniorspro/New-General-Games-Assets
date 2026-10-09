#!/usr/bin/env python3
"""Traduce a C el código ARM64 de Anger of Stick 5 (libMyGame.so), instrucción por instrucción.

    recompilar.py libMyGame.so salida/

Deja en salida/:
  rec_*.c        las funciones del juego traducidas (una C por función ARM, con gotos)
  rec.h          sus declaraciones, las de la capa propia (H_*) y la tabla de llamadas indirectas
  imagen.bin     la memoria inicial del .so (.rodata, .data, .got… con las relocaciones hechas)
  rec.json       qué se tradujo, qué quedó afuera, los nombres (para depurar)

Cómo funciona (PORTEO.md §4.4):
- La memoria es plana: una dirección ARM es la misma dirección en la memoria de WebAssembly. El .so
  va en 0..0xC41090 y el runtime vive arriba de AOS_BASE.
- Cada función ARM es una función C sin argumentos; los registros son variables locales y entre
  funciones viajan por la estructura global C (x0..x8, v0..v7, sp), sólo los que la otra función lee.
- Las banderas NZCV no se calculan: cada instrucción que las pone guarda sus operandos y cada
  instrucción que las lee arma la comparación (como haría el compilador).
- Las llamadas a cocos2d, a la capa k* (kSprite, kScene…), a libc y a anuncios van a funciones H_*
  hechas a mano (hle.c), que leen los argumentos de C.x/C.v como lo haría la función original.
"""
import re, sys, struct, subprocess, collections, json, os

# --------------------------------------------------------------------------------------------- ELF
R_ABS64, R_GLOB_DAT, R_JUMP_SLOT, R_RELATIVE = 257, 1025, 1026, 1027


class Elf:
    def __init__(self, path):
        self.d = d = open(path, 'rb').read()
        assert d[:4] == b'\x7fELF' and d[4] == 2 and d[18] == 183, 'no es ELF64 AArch64'
        shoff, = struct.unpack_from('<Q', d, 0x28)
        shentsize, shnum, shstrndx = struct.unpack_from('<HHH', d, 0x3a)
        secs = []
        for i in range(shnum):
            name, typ, flags, addr, off, size, link, info, align, entsize = struct.unpack_from(
                '<IIQQQQIIQQ', d, shoff + i * shentsize)
            secs.append(dict(name=name, type=typ, addr=addr, off=off, size=size))
        for s in secs:
            s['name'] = self.cstr(secs[shstrndx]['off'] + s['name'])
        self.secs = {s['name']: s for s in secs}
        phoff, = struct.unpack_from('<Q', d, 0x20)
        phentsize, phnum = struct.unpack_from('<HH', d, 0x36)
        self.loads = []
        for i in range(phnum):
            typ, flags, off, vaddr, paddr, filesz, memsz, align = struct.unpack_from(
                '<IIQQQQQQ', d, phoff + i * phentsize)
            if typ == 1:
                self.loads.append((vaddr, off, filesz, memsz))
        ds, dstr = self.secs['.dynsym'], self.secs['.dynstr']
        self.syms = []
        for i in range(ds['size'] // 24):
            st_name, st_info, st_other, st_shndx, st_value, st_size = struct.unpack_from(
                '<IBBHQQ', d, ds['off'] + 24 * i)
            self.syms.append((self.cstr(dstr['off'] + st_name), st_value, st_size, st_info & 15, st_shndx))
        self.relocs = []
        for nm in ('.rela.dyn', '.rela.plt'):
            s = self.secs[nm]
            for i in range(s['size'] // 24):
                off, info, add = struct.unpack_from('<QQq', d, s['off'] + 24 * i)
                self.relocs.append((off, info & 0xffffffff, info >> 32, add, nm))

    def cstr(self, o):
        return self.d[o:self.d.index(b'\0', o)].decode('latin-1')

    def read(self, addr, n):
        for vaddr, off, filesz, memsz in self.loads:
            if vaddr <= addr < vaddr + memsz:
                k = addr - vaddr
                b = self.d[off + k: off + min(filesz, k + n)] if k < filesz else b''
                return b + b'\0' * (n - len(b))
        raise KeyError(hex(addr))

    def u32(self, a):
        return struct.unpack('<I', self.read(a, 4))[0]

    def i32(self, a):
        return struct.unpack('<i', self.read(a, 4))[0]


# ------------------------------------------------------------------------------ desarmado (texto)
LIN = re.compile(r'^\s+([0-9a-f]+):\s+(\S+)\s*(.*)$')
LAB = re.compile(r'^([0-9a-f]{16}) <(.+)>:$')


def desarmar(so):
    """llvm-objdump con AArch64 (el de LLVM 18 es el probado; el de Emscripten sólo trae WebAssembly).
    Otro se elige con OBJDUMP=..."""
    od = os.environ.get('OBJDUMP', 'llvm-objdump')
    r = subprocess.run([od, '-d', '--no-show-raw-insn', so], capture_output=True, text=True, errors='replace')
    out = r.stdout
    if r.returncode or not any(LIN.match(l) for l in out[:100000].split('\n')):
        sys.exit(f'{od} no desarmó {so} (¿le falta AArch64?): {r.stderr.strip()[:300]}')
    ins, labels = {}, {}
    for l in out.split('\n'):
        m = LIN.match(l)
        if m:
            ops = re.sub(r'\s*//.*$', '', m.group(3))
            ops = re.sub(r'\s*<[^>]*>', '', ops).strip()
            ins[int(m.group(1), 16)] = (m.group(2), ops)
            continue
        m = LAB.match(l)
        if m:
            labels[int(m.group(1), 16)] = m.group(2)
    return ins, labels


def fdes(so):
    out = subprocess.run(['llvm-dwarfdump', '--eh-frame', so], capture_output=True, text=True).stdout
    r = {}
    for m in re.finditer(r'FDE cie=\w+ pc=([0-9a-f]+)\.\.\.([0-9a-f]+)', out):
        r[int(m.group(1), 16)] = int(m.group(2), 16)
    return r


def demangle(names):
    names = list(names)
    out = subprocess.run(['llvm-cxxfilt'], input='\n'.join(names), capture_output=True, text=True).stdout
    return dict(zip(names, out.split('\n')))


# ------------------------------------------------------------------------------------- operandos
def split_ops(s):
    """Separa por comas que no estén dentro de [] o {}."""
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch in '[{':
            depth += 1
        elif ch in ']}':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def imm(tok):
    t = tok.strip()
    assert t.startswith('#'), tok
    t = t[1:]
    if re.fullmatch(r'-?0x[0-9a-f]+', t):
        return int(t, 16)
    if re.fullmatch(r'-?\d+', t):
        return int(t)
    raise ValueError(tok)


def fimm(tok):
    return float(tok.strip()[1:])


GPR = re.compile(r'^([wx])(\d+|zr)$')
FPR = re.compile(r'^([bhsdq])(\d+)$')
VEC = re.compile(r'^v(\d+)\.(\d+)([bhsd])$')
VEL = re.compile(r'^v(\d+)\.([bhsd])\[(\d+)\]$')
CONDS = ('eq', 'ne', 'hs', 'lo', 'mi', 'pl', 'vs', 'vc', 'hi', 'ls', 'ge', 'lt', 'gt', 'le', 'al', 'cs', 'cc')
INV = {'eq': 'ne', 'ne': 'eq', 'hs': 'lo', 'lo': 'hs', 'cs': 'lo', 'cc': 'hs', 'mi': 'pl', 'pl': 'mi',
       'vs': 'vc', 'vc': 'vs', 'hi': 'ls', 'ls': 'hi', 'ge': 'lt', 'lt': 'ge', 'gt': 'le', 'le': 'gt'}


class Unsupported(Exception):
    pass


def gpr(tok):
    """('x'|'w', n) — n=31 es el registro cero; ('sp', 31) es la pila."""
    if tok in ('sp', 'wsp'):
        return ('sp' if tok == 'sp' else 'wsp', 31)
    m = GPR.match(tok)
    if not m:
        raise Unsupported('registro ' + tok)
    return (m.group(1), 31 if m.group(2) == 'zr' else int(m.group(2)))


def is_gpr(tok):
    return tok in ('sp', 'wsp') or GPR.match(tok) is not None


def rd_gpr(tok, w=None):
    """Expresión C para leer un registro entero."""
    k, n = gpr(tok)
    if k == 'sp':
        return 'sp'
    if k == 'wsp':
        return '((u32)sp)'
    if n == 31:
        return '0U' if k == 'w' else '0ULL'
    return f'((u32)x{n})' if k == 'w' else f'x{n}'


def wr_gpr(tok, expr):
    k, n = gpr(tok)
    if k == 'sp':
        return f'sp = (u64)({expr});'
    if k == 'wsp':
        return f'sp = (u32)({expr});'
    if n == 31:
        return f'(void)({expr});'
    if k == 'w':
        return f'x{n} = (u32)({expr});'
    return f'x{n} = (u64)({expr});'


def width(tok):
    k, _ = gpr(tok)
    return 32 if k in ('w', 'wsp') else 64


def gpr_num(tok):
    k, n = gpr(tok)
    return None if (n == 31 and k not in ('sp', 'wsp')) else ('sp' if k in ('sp', 'wsp') else n)


# ------------------------------------------------------------------------------------- banderas
def cond_expr(kind, cc):
    """Condición `cc` sobre las banderas que dejó una instrucción del tipo `kind`."""
    if cc == 'al':
        return '1'
    cc = {'cs': 'hs', 'cc': 'lo'}.get(cc, cc)
    if kind in ('S32', 'S64', 'A32', 'A64', 'N32', 'N64'):
        W = 32 if kind.endswith('32') else 64
        u, s = ('u32', 's32') if W == 32 else ('u64', 's64')
        a, b = f'(({u})fa)', f'(({u})fb)'
        if kind[0] == 'S':
            r = f'(({u})({a}-{b}))'
            N, Z = f'(({s}){r}<0)', f'({a}=={b})'
            Cy = f'({a}>={b})'
            V = f'((({a}^{b})&({a}^{r}))>>{W - 1})'
            direct = {'eq': f'{a}=={b}', 'ne': f'{a}!={b}', 'hs': f'{a}>={b}', 'lo': f'{a}<{b}',
                      'hi': f'{a}>{b}', 'ls': f'{a}<={b}', 'ge': f'({s}){a}>=({s}){b}',
                      'lt': f'({s}){a}<({s}){b}', 'gt': f'({s}){a}>({s}){b}', 'le': f'({s}){a}<=({s}){b}',
                      'mi': N, 'pl': f'!{N}', 'vs': V, 'vc': f'!{V}'}
            return '(' + direct[cc] + ')'
        if kind[0] == 'A':
            r = f'(({u})({a}+{b}))'
            N, Z, Cy = f'(({s}){r}<0)', f'({r}==0)', f'({r}<{a})'
            V = f'((((~({a}^{b}))&({a}^{r}))>>{W - 1})&1)'
        else:  # AND (tst/ands): C=V=0
            r = a
            N, Z, Cy, V = f'(({s}){r}<0)', f'({r}==0)', '0', '0'
            direct = {'eq': Z, 'ne': f'!{Z}', 'mi': N, 'pl': f'!{N}', 'hs': '0', 'lo': '1', 'hi': '0',
                      'ls': '1', 'vs': '0', 'vc': '1', 'ge': f'(({s}){r}>=0)', 'lt': f'(({s}){r}<0)',
                      'gt': f'(({s}){r}>0)', 'le': f'(({s}){r}<=0)'}
            return '(' + direct[cc] + ')'
    elif kind == 'F':
        a, b = 'fda', 'fdb'
        direct = {'eq': f'{a}=={b}', 'ne': f'!({a}=={b})', 'mi': f'{a}<{b}', 'lo': f'{a}<{b}',
                  'pl': f'!({a}<{b})', 'hs': f'!({a}<{b})', 'gt': f'{a}>{b}', 'le': f'!({a}>{b})',
                  'ge': f'{a}>={b}', 'lt': f'!({a}>={b})', 'hi': f'!({a}<={b})', 'ls': f'{a}<={b}',
                  'vs': f'__builtin_isunordered({a},{b})', 'vc': f'!__builtin_isunordered({a},{b})'}
        return '(' + direct[cc] + ')'
    elif kind == 'Z':
        N, Z, Cy, V = '((fnz>>3)&1)', '((fnz>>2)&1)', '((fnz>>1)&1)', '(fnz&1)'
    else:
        raise Unsupported('banderas ' + kind)
    gen = {'eq': Z, 'ne': f'!{Z}', 'hs': Cy, 'lo': f'!{Cy}', 'mi': N, 'pl': f'!{N}', 'vs': V,
           'vc': f'!{V}', 'hi': f'({Cy}&&!{Z})', 'ls': f'(!{Cy}||{Z})', 'ge': f'({N}=={V})',
           'lt': f'({N}!={V})', 'gt': f'(!{Z}&&{N}=={V})', 'le': f'({Z}||{N}!={V})'}
    return '(' + gen[cc] + ')'


KIND_ID = {'S32': 1, 'S64': 2, 'A32': 3, 'A64': 4, 'N32': 5, 'N64': 6, 'F': 7, 'Z': 8}


def cond_c(kinds, cc):
    kinds = sorted(k for k in kinds if k != 'U')
    if not kinds:
        raise Unsupported('condición sin banderas definidas')
    if len(kinds) == 1:
        return cond_expr(kinds[0], cc)
    e = '0'
    for k in reversed(kinds):
        e = f'(fk=={KIND_ID[k]}?{cond_expr(k, cc)}:{e})'
    return e


def nzcv_pack(kind):
    """Expresión que empaqueta NZCV (N=8, Z=4, C=2, V=1) de las banderas de `kind`."""
    if kind == 'Z':
        return 'fnz'
    if kind == 'F':
        return '(__builtin_isunordered(fda,fdb)?3u:fda==fdb?6u:fda<fdb?8u:2u)'
    parts = []
    for cc, bit in (('mi', 8), ('eq', 4), ('hs', 2), ('vs', 1)):
        parts.append(f'({cond_expr(kind, cc)}?{bit}u:0u)')
    return '(' + '|'.join(parts) + ')'


# --------------------------------------------------------------------------- vectores y flotantes
def vreg(tok):
    m = FPR.match(tok)
    if m:
        return m.group(1), int(m.group(2))
    raise Unsupported('registro fp ' + tok)


def rd_fp(tok):
    """Lee s/d como float/double C."""
    k, n = vreg(tok)
    if k == 's':
        return f'F32(v{n})'
    if k == 'd':
        return f'F64(v{n})'
    raise Unsupported('fp ' + tok)


def wr_fp(tok, expr):
    k, n = vreg(tok)
    if k == 's':
        return f'v{n} = B32({expr}); v{n}h = 0;'
    if k == 'd':
        return f'v{n} = B64({expr}); v{n}h = 0;'
    raise Unsupported('fp ' + tok)


SHIFT_RE = re.compile(r'^(lsl|lsr|asr|ror|sxtw|uxtw|sxtb|uxtb|sxth|uxth|sxtx|uxtx)(?:\s+#(\S+))?$')


def shifted(tok, mod, W):
    """Operando registro con desplazamiento o extensión, como valor de W bits."""
    base = rd_gpr(tok)
    if mod is None:
        return base
    m = SHIFT_RE.match(mod)
    if not m:
        raise Unsupported('modificador ' + mod)
    op, amt = m.group(1), int(m.group(2), 0) if m.group(2) else 0
    u, s = ('u32', 's32') if W == 32 else ('u64', 's64')
    if op == 'lsl':
        return f'(({u}){base}<<{amt})'
    if op == 'lsr':
        return f'(({u}){base}>>{amt})'
    if op == 'asr':
        return f'(({u})(({s}){base}>>{amt}))'
    if op == 'ror':
        return f'ROR{W}({base},{amt})'
    ext = {'sxtw': '(u64)(s64)(s32)', 'uxtw': '(u64)(u32)', 'sxtb': '(u64)(s64)(s8)',
           'uxtb': '(u64)(u8)', 'sxth': '(u64)(s64)(s16)', 'uxth': '(u64)(u16)',
           'sxtx': '(u64)', 'uxtx': '(u64)'}[op]
    return f'(({u})({ext}{base})<<{amt})'


MEM_RE = re.compile(r'^\[([^\]]+)\](!?)$')


def addr_expr(mem):
    """'[x1, #8]' → (expresión de la dirección, registro base, desplazamiento para escritura previa)."""
    m = MEM_RE.match(mem)
    if not m:
        raise Unsupported('memoria ' + mem)
    parts = [p.strip() for p in m.group(1).split(',')]
    base = parts[0]
    b = rd_gpr(base)
    if len(parts) == 1:
        return b, base, 0, m.group(2) == '!'
    if parts[1].startswith('#'):
        off = imm(parts[1])
        return f'({b}+(u64)({off}LL))', base, off, m.group(2) == '!'
    idx = parts[1]
    mod = parts[2] if len(parts) > 2 else None
    if mod is None:
        e = rd_gpr(idx) if width(idx) == 64 else f'(u64)(u32){rd_gpr(idx)}'
        return f'({b}+{e})', base, None, False
    mm = SHIFT_RE.match(mod)
    op, amt = mm.group(1), int(mm.group(2), 0) if mm.group(2) else 0
    if op == 'lsl':
        return f'({b}+({rd_gpr(idx)}<<{amt}))', base, None, False
    ext = {'sxtw': '(u64)(s64)(s32)', 'uxtw': '(u64)(u32)', 'sxtx': '(u64)', 'uxtx': '(u64)'}[op]
    return f'({b}+(({ext}{rd_gpr(idx)})<<{amt}))', base, None, False


LOADS = {  # mnemónico: (bytes, extensión con signo, ancho destino)
    'ldr': None, 'ldur': None, 'ldrb': (1, False), 'ldurb': (1, False), 'ldrh': (2, False),
    'ldurh': (2, False), 'ldrsb': (1, True), 'ldursb': (1, True), 'ldrsh': (2, True),
    'ldursh': (2, True), 'ldrsw': (4, True), 'ldursw': (4, True), 'ldar': None, 'ldarb': (1, False),
    'ldarh': (2, False), 'ldaxr': None, 'ldxr': None,
}
STORES = {'str': None, 'stur': None, 'strb': 1, 'sturb': 1, 'strh': 2, 'sturh': 2, 'stlr': None,
          'stlrb': 1}


def reg_size(tok):
    if is_gpr(tok):
        return 4 if width(tok) == 32 else 8
    k, n = vreg(tok)
    return {'b': 1, 'h': 2, 's': 4, 'd': 8, 'q': 16}[k]


def load_into(tok, a, nbytes=None, signed=False):
    """Instrucciones C para cargar en `tok` desde la dirección `a`."""
    if is_gpr(tok):
        W = width(tok)
        if nbytes is None:
            nbytes = W // 8
        ld = {1: 'RD8', 2: 'RD16', 4: 'RD32', 8: 'RD64'}[nbytes]
        v = f'{ld}({a})'
        if signed:
            st = {1: 's8', 2: 's16', 4: 's32'}[nbytes]
            v = f'(u64)(s64)({st}){v}' if W == 64 else f'(u32)(s32)({st}){v}'
        return wr_gpr(tok, v)
    k, n = vreg(tok)
    if k == 'q':
        return f'v{n} = RD64({a}); v{n}h = RD64(({a})+8);'
    ld = {'b': 'RD8', 'h': 'RD16', 's': 'RD32', 'd': 'RD64'}[k]
    return f'v{n} = (u64){ld}({a}); v{n}h = 0;'


def store_from(tok, a, nbytes=None):
    if is_gpr(tok):
        W = width(tok)
        if nbytes is None:
            nbytes = W // 8
        st = {1: 'WR8', 2: 'WR16', 4: 'WR32', 8: 'WR64'}[nbytes]
        cast = {1: 'u8', 2: 'u16', 4: 'u32', 8: 'u64'}[nbytes]
        return f'{st}({a}, ({cast}){rd_gpr(tok)});'
    k, n = vreg(tok)
    if k == 'q':
        return f'WR64({a}, v{n}); WR64(({a})+8, v{n}h);'
    st = {'b': ('WR8', 'u8'), 'h': ('WR16', 'u16'), 's': ('WR32', 'u32'), 'd': ('WR64', 'u64')}[k]
    return f'{st[0]}({a}, ({st[1]})v{n});'


# ----------------------------------------------------------------------------- una instrucción
class Ctx:
    """Lo que la traducción de una instrucción necesita saber de su función."""

    def __init__(self, fn):
        self.fn = fn


def logical_imm_ok(v):
    return True


def translate(addr, mn, ops_s, ctx):
    """Devuelve una lista de líneas C (sin los saltos, que maneja la función)."""
    ops = split_ops(ops_s)
    fk = ctx.flags_at.get(addr, set())
    o = []

    def setf(kind, a, b):
        o.append(f'fa = (u64)({a}); fb = (u64)({b}); fk = {KIND_ID[kind]};')

    # ---- movimientos
    if mn == 'nop':
        return []
    if mn == 'mov':
        d, s = ops[0], ops[1]
        if is_gpr(d) and s.startswith('#'):
            v = imm(s)
            W = width(d)
            v &= (1 << W) - 1
            return [wr_gpr(d, f'{v:#x}ULL')]
        if is_gpr(d) and is_gpr(s):
            return [wr_gpr(d, rd_gpr(s))]
        m_d, m_s = VEC.match(d), VEC.match(s)
        if m_d and m_s:  # mov v.16b / v.8b
            nd, ns = int(m_d.group(1)), int(m_s.group(1))
            if m_d.group(2) + m_d.group(3) == '16b':
                return [f'v{nd} = v{ns}; v{nd}h = v{ns}h;']
            return [f'v{nd} = v{ns}; v{nd}h = 0;']
        e_s = VEL.match(s)
        if e_s and FPR.match(d):  # mov s1, v0.s[1]
            k, nd = vreg(d)
            ns, ek, idx = int(e_s.group(1)), e_s.group(2), int(e_s.group(3))
            return [f'v{nd} = (u64){lane_get(ns, ek, idx)}; v{nd}h = 0;']
        if e_s and is_gpr(d):  # mov w9, v1.s[1] (umov)
            ns, ek, idx = int(e_s.group(1)), e_s.group(2), int(e_s.group(3))
            return [wr_gpr(d, lane_get(ns, ek, idx))]
        e_d = VEL.match(d)
        if e_d and is_gpr(s):  # mov v1.s[0], w23 (ins)
            nd, ek, idx = int(e_d.group(1)), e_d.group(2), int(e_d.group(3))
            return lane_set(nd, ek, idx, rd_gpr(s))
        if e_d and VEL.match(s):
            nd, ek, idx = int(e_d.group(1)), e_d.group(2), int(e_d.group(3))
            m2 = VEL.match(s)
            return lane_set(nd, ek, idx, lane_get(int(m2.group(1)), m2.group(2), int(m2.group(3))))
        raise Unsupported(f'mov {ops_s}')
    if mn in ('movz', 'movn'):
        raise Unsupported(mn)
    if mn == 'movk':
        d = ops[0]
        v = imm(ops[1])
        sh = int(ops[2].split('#')[1], 0) if len(ops) > 2 else 0
        W = width(d)
        mask = ((0xffff << sh) ^ ((1 << W) - 1)) & ((1 << W) - 1)
        return [wr_gpr(d, f'({rd_gpr(d)} & {mask:#x}ULL) | {v << sh:#x}ULL')]
    if mn in ('adrp', 'adr'):
        v = int(ops[1], 16)
        return [wr_gpr(ops[0], f'{v:#x}ULL')]
    if mn == 'mrs':
        if ops[1] == 'TPIDR_EL0':
            return [wr_gpr(ops[0], 'AOS_TLS')]
        raise Unsupported('mrs ' + ops[1])

    # ---- aritmética
    if mn in ('add', 'sub', 'adds', 'subs', 'cmp', 'cmn'):
        if mn in ('cmp', 'cmn'):
            d, n, rest = None, ops[0], ops[1:]
        else:
            d, n, rest = ops[0], ops[1], ops[2:]
        if VEC.match(n):
            return simd_arith(mn, ops)
        W = width(n) if d is None else width(d)
        u = 'u32' if W == 32 else 'u64'
        a = rd_gpr(n)
        if rest[0].startswith('#'):
            v = imm(rest[0])
            if len(rest) > 1:
                v <<= int(rest[1].split('#')[1], 0)
            b = f'({u}){v:#x}ULL' if v >= 0 else f'({u})({v}LL)'
        else:
            b = shifted(rest[0], rest[1] if len(rest) > 1 else None, W)
        isadd = mn in ('add', 'adds', 'cmn')
        res = f'({u})(({u}){a} {"+" if isadd else "-"} ({u}){b})'
        if mn in ('adds', 'subs', 'cmp', 'cmn'):
            setf(('A' if isadd else 'S') + str(W), a, b)
        if d is not None:
            o.append(wr_gpr(d, res))
        return o
    if mn in ('neg', 'negs'):
        W = width(ops[0])
        u = 'u32' if W == 32 else 'u64'
        b = shifted(ops[1], ops[2] if len(ops) > 2 else None, W)
        if mn == 'negs':
            setf('S' + str(W), '0', b)
        return o + [wr_gpr(ops[0], f'({u})(0 - ({u}){b})')]
    if mn in ('mul', 'madd', 'msub', 'mneg'):
        W = width(ops[0])
        u = 'u32' if W == 32 else 'u64'
        p = f'(({u}){rd_gpr(ops[1])} * ({u}){rd_gpr(ops[2])})'
        if mn == 'mul':
            e = p
        elif mn == 'mneg':
            e = f'(0 - {p})'
        elif mn == 'madd':
            e = f'(({u}){rd_gpr(ops[3])} + {p})'
        else:
            e = f'(({u}){rd_gpr(ops[3])} - {p})'
        return [wr_gpr(ops[0], f'({u}){e}')]
    if mn in ('smaddl', 'smull', 'umull', 'umaddl', 'smsubl', 'umsubl', 'smnegl'):
        sg = mn.startswith('s')
        c = '(s64)(s32)' if sg else '(u64)(u32)'
        p = f'(u64)(({c}{rd_gpr(ops[1])}) * ({c}{rd_gpr(ops[2])}))'
        if mn in ('smull', 'umull'):
            e = p
        elif mn in ('smaddl', 'umaddl'):
            e = f'({rd_gpr(ops[3])} + {p})'
        elif mn == 'smnegl':
            e = f'(0 - {p})'
        else:
            e = f'({rd_gpr(ops[3])} - {p})'
        return [wr_gpr(ops[0], e)]
    if mn in ('umulh', 'smulh'):
        if mn == 'umulh':
            return [wr_gpr(ops[0], f'(u64)(((unsigned __int128){rd_gpr(ops[1])} * (unsigned __int128){rd_gpr(ops[2])}) >> 64)')]
        return [wr_gpr(ops[0], f'(u64)(((__int128)(s64){rd_gpr(ops[1])} * (__int128)(s64){rd_gpr(ops[2])}) >> 64)')]
    if mn in ('sdiv', 'udiv'):
        W = width(ops[0])
        f = {('sdiv', 32): 'SDIV32', ('sdiv', 64): 'SDIV64', ('udiv', 32): 'UDIV32', ('udiv', 64): 'UDIV64'}[(mn, W)]
        return [wr_gpr(ops[0], f'{f}({rd_gpr(ops[1])}, {rd_gpr(ops[2])})')]

    # ---- lógicas
    if mn in ('and', 'orr', 'eor', 'bic', 'orn', 'eon', 'ands', 'bics', 'tst', 'mvn'):
        if mn == 'tst':
            d, n, rest = None, ops[0], ops[1:]
        elif mn == 'mvn':
            d, n, rest = ops[0], None, ops[1:]
        else:
            d, n, rest = ops[0], ops[1], ops[2:]
        W = width(d if d is not None else n)
        u = 'u32' if W == 32 else 'u64'
        if rest[0].startswith('#'):
            b = f'({u}){imm(rest[0]) & ((1 << W) - 1):#x}ULL'
        else:
            b = shifted(rest[0], rest[1] if len(rest) > 1 else None, W)
        if mn == 'mvn':
            return [wr_gpr(d, f'({u})~({u}){b}')]
        a = f'({u}){rd_gpr(n)}'
        e = {'and': f'{a} & ({u}){b}', 'ands': f'{a} & ({u}){b}', 'tst': f'{a} & ({u}){b}',
             'orr': f'{a} | ({u}){b}', 'eor': f'{a} ^ ({u}){b}', 'bic': f'{a} & ~({u}){b}',
             'bics': f'{a} & ~({u}){b}', 'orn': f'{a} | ~({u}){b}', 'eon': f'{a} ^ ~({u}){b}'}[mn]
        if mn in ('ands', 'tst', 'bics'):
            setf('N' + str(W), f'({u})({e})', '0')
        if d is not None:
            o.append(wr_gpr(d, f'({u})({e})'))
        return o
    if mn in ('lsl', 'lsr', 'asr', 'ror'):
        W = width(ops[0])
        u, s = ('u32', 's32') if W == 32 else ('u64', 's64')
        a = f'({u}){rd_gpr(ops[1])}'
        if ops[2].startswith('#'):
            sh = imm(ops[2])
        else:
            sh = f'({rd_gpr(ops[2])} & {W - 1})'
        e = {'lsl': f'{a} << {sh}', 'lsr': f'{a} >> {sh}', 'asr': f'({u})(({s}){a} >> {sh})',
             'ror': f'ROR{W}({a}, {sh})'}[mn]
        return [wr_gpr(ops[0], f'({u})({e})')]
    if mn in ('ubfx', 'sbfx', 'ubfiz', 'sbfiz', 'bfi', 'bfxil'):
        W = width(ops[0])
        u, s = ('u32', 's32') if W == 32 else ('u64', 's64')
        lsb, wd = imm(ops[2]), imm(ops[3])
        mask = (1 << wd) - 1
        a = f'({u}){rd_gpr(ops[1])}'
        if mn == 'ubfx':
            e = f'(({a} >> {lsb}) & {mask:#x}ULL)'
        elif mn == 'sbfx':
            e = f'({u})((({s})({a} << {W - lsb - wd})) >> {W - wd})'
        elif mn == 'ubfiz':
            e = f'(({a} & {mask:#x}ULL) << {lsb})'
        elif mn == 'sbfiz':
            e = f'({u})(((({s})({a} << {W - wd})) >> {W - wd}) << {lsb})'
        elif mn == 'bfi':
            fm = (mask << lsb) & ((1 << W) - 1)
            e = f'((({u}){rd_gpr(ops[0])} & ~({u}){fm:#x}ULL) | (({a} & {mask:#x}ULL) << {lsb}))'
        else:  # bfxil
            e = f'((({u}){rd_gpr(ops[0])} & ~({u}){mask:#x}ULL) | (({a} >> {lsb}) & {mask:#x}ULL))'
        return [wr_gpr(ops[0], f'({u})({e})')]
    if mn in ('sxtw', 'sxtb', 'sxth', 'uxtb', 'uxth'):
        W = width(ops[0])
        c = {'sxtw': '(s64)(s32)', 'sxtb': '(s64)(s8)', 'sxth': '(s64)(s16)', 'uxtb': '(u8)', 'uxth': '(u16)'}[mn]
        u = 'u32' if W == 32 else 'u64'
        return [wr_gpr(ops[0], f'({u})({c}{rd_gpr(ops[1])})')]

    # ---- selecciones
    if mn in ('csel', 'csinc', 'csinv', 'csneg'):
        W = width(ops[0])
        u = 'u32' if W == 32 else 'u64'
        c = cond_c(fk, ops[3])
        a, b = f'({u}){rd_gpr(ops[1])}', f'({u}){rd_gpr(ops[2])}'
        alt = {'csel': b, 'csinc': f'({u})({b}+1)', 'csinv': f'({u})~{b}', 'csneg': f'({u})(0-{b})'}[mn]
        return [wr_gpr(ops[0], f'({c} ? {a} : {alt})')]
    if mn in ('cset', 'csetm'):
        W = width(ops[0])
        u = 'u32' if W == 32 else 'u64'
        c = cond_c(fk, ops[1])
        return [wr_gpr(ops[0], f'({c} ? ({u}){"1" if mn == "cset" else "-1"} : ({u})0)')]
    if mn in ('cinc', 'cinv', 'cneg'):
        W = width(ops[0])
        u = 'u32' if W == 32 else 'u64'
        c = cond_c(fk, ops[2])
        a = f'({u}){rd_gpr(ops[1])}'
        alt = {'cinc': f'({u})({a}+1)', 'cinv': f'({u})~{a}', 'cneg': f'({u})(0-{a})'}[mn]
        return [wr_gpr(ops[0], f'({c} ? {alt} : {a})')]
    if mn in ('ccmp', 'ccmn'):
        W = width(ops[0])
        u = 'u32' if W == 32 else 'u64'
        a = f'({u}){rd_gpr(ops[0])}'
        b = f'({u}){imm(ops[1]):#x}ULL' if ops[1].startswith('#') else f'({u}){rd_gpr(ops[1])}'
        nz = imm(ops[2])
        c = cond_c(fk, ops[3])
        kind = ('S' if mn == 'ccmp' else 'A') + str(W)
        pack = nzcv_pack(kind).replace('fa', '_ca').replace('fb', '_cb')
        return [f'{{ u64 _ca = (u64)({a}), _cb = (u64)({b}); fnz = {c} ? {pack} : {nz}u; fk = {KIND_ID["Z"]}; }}']
    if mn == 'fccmp':
        a, b = rd_fp(ops[0]), rd_fp(ops[1])
        nz = imm(ops[2])
        c = cond_c(fk, ops[3])
        pack = nzcv_pack('F').replace('fda', '_ca').replace('fdb', '_cb')
        return [f'{{ double _ca = (double)({a}), _cb = (double)({b}); fnz = {c} ? {pack} : {nz}u; fk = {KIND_ID["Z"]}; }}']

    # ---- memoria
    if mn in LOADS:
        spec = LOADS[mn]
        mem = ops[1]
        a, base, off, pre = addr_expr(mem)
        post = imm(ops[2]) if len(ops) > 2 else None
        nbytes, signed = (spec if spec else (None, False))
        out = [f'{{ u64 _a = {a};']
        if post is not None:
            out = [f'{{ u64 _a = {rd_gpr(base)};']
        out.append(load_into(ops[0], '_a', nbytes, signed))
        if pre:
            out.append(wr_gpr(base, '_a'))
        if post is not None:
            out.append(wr_gpr(base, f'_a + (u64)({post}LL)'))
        out.append('}')
        return [' '.join(out)]
    if mn in STORES:
        nbytes = STORES[mn]
        mem = ops[1]
        a, base, off, pre = addr_expr(mem)
        post = imm(ops[2]) if len(ops) > 2 else None
        out = [f'{{ u64 _a = {a};' if post is None else f'{{ u64 _a = {rd_gpr(base)};']
        out.append(store_from(ops[0], '_a', nbytes))
        if pre:
            out.append(wr_gpr(base, '_a'))
        if post is not None:
            out.append(wr_gpr(base, f'_a + (u64)({post}LL)'))
        out.append('}')
        return [' '.join(out)]
    if mn in ('stlxr', 'stxr', 'stlxrb', 'stxrb'):
        a, _, _, _ = addr_expr(ops[2])
        nb = 1 if mn.endswith('b') else None
        return [f'{{ u64 _a = {a}; {store_from(ops[1], "_a", nb)} }}', wr_gpr(ops[0], '0')]
    if mn in ('ldp', 'stp', 'ldpsw', 'ldnp', 'stnp'):
        t1, t2, mem = ops[0], ops[1], ops[2]
        a, base, off, pre = addr_expr(mem)
        post = imm(ops[3]) if len(ops) > 3 else None
        sz = 4 if mn == 'ldpsw' else reg_size(t1)
        out = [f'{{ u64 _a = {a};' if post is None else f'{{ u64 _a = {rd_gpr(base)};']
        if mn.startswith('ld'):
            if mn == 'ldpsw':
                out.append(load_into(t1, '_a', 4, True))
                out.append(load_into(t2, f'_a + 4', 4, True))
            else:
                out.append(load_into(t1, '_a'))
                out.append(load_into(t2, f'_a + {sz}'))
        else:
            out.append(store_from(t1, '_a'))
            out.append(store_from(t2, f'_a + {sz}'))
        if pre:
            out.append(wr_gpr(base, '_a'))
        if post is not None:
            out.append(wr_gpr(base, f'_a + (u64)({post}LL)'))
        out.append('}')
        return [' '.join(out)]
    if mn == 'ld2':
        m = re.match(r'^\{\s*v(\d+)\.4s,\s*v(\d+)\.4s\s*\}$', ops[0])
        if not m:
            raise Unsupported('ld2 ' + ops_s)
        r1, r2 = int(m.group(1)), int(m.group(2))
        a, _, _, _ = addr_expr(ops[1])
        return [f'{{ u64 _a = {a}; u64 e0 = RD32(_a), e1 = RD32(_a+4), e2 = RD32(_a+8), e3 = RD32(_a+12), '
                f'e4 = RD32(_a+16), e5 = RD32(_a+20), e6 = RD32(_a+24), e7 = RD32(_a+28); '
                f'v{r1} = e0 | (e2 << 32); v{r1}h = e4 | (e6 << 32); v{r2} = e1 | (e3 << 32); v{r2}h = e5 | (e7 << 32); }}']

    # ---- flotantes escalares
    if mn in ('fadd', 'fsub', 'fmul', 'fdiv', 'fnmul', 'fmax', 'fmin'):
        if VEC.match(ops[0]):
            return simd_fp(mn, ops)
        a, b = rd_fp(ops[1]), rd_fp(ops[2])
        e = {'fadd': f'{a} + {b}', 'fsub': f'{a} - {b}', 'fmul': f'{a} * {b}', 'fdiv': f'{a} / {b}',
             'fnmul': f'-({a} * {b})', 'fmax': f'FMAX({a}, {b})', 'fmin': f'FMIN({a}, {b})'}[mn]
        return [wr_fp(ops[0], e)]
    if mn in ('fneg', 'fabs', 'fsqrt'):
        a = rd_fp(ops[1])
        k, _ = vreg(ops[0])
        e = {'fneg': f'-({a})', 'fabs': f'__builtin_fabs{"f" if k == "s" else ""}({a})',
             'fsqrt': f'__builtin_sqrt{"f" if k == "s" else ""}({a})'}[mn]
        return [wr_fp(ops[0], e)]
    if mn in ('fmadd', 'fmsub', 'fnmadd', 'fnmsub'):
        raise Unsupported(mn)
    if mn == 'fcmp' or mn == 'fcmpe':
        a = rd_fp(ops[0])
        b = '0.0' if ops[1].startswith('#') else rd_fp(ops[1])
        return [f'fda = (double)({a}); fdb = (double)({b}); fk = {KIND_ID["F"]};']
    if mn == 'fcsel':
        c = cond_c(fk, ops[3])
        k, nd = vreg(ops[0])
        _, n1 = vreg(ops[1])
        _, n2 = vreg(ops[2])
        mask = '0xffffffffULL' if k == 's' else '~0ULL'
        return [f'v{nd} = ({c} ? v{n1} : v{n2}) & {mask}; v{nd}h = 0;']
    if mn == 'fcvt':
        a = rd_fp(ops[1])
        k, _ = vreg(ops[0])
        return [wr_fp(ops[0], f'({"float" if k == "s" else "double"})({a})')]
    if mn in ('fcvtzs', 'fcvtzu'):
        if VEC.match(ops[0]):
            return simd_cvt(mn, ops)
        if is_gpr(ops[0]):
            W = width(ops[0])
            k, _ = vreg(ops[1])
            fn = {('fcvtzs', 32): 'CVT_S32', ('fcvtzs', 64): 'CVT_S64', ('fcvtzu', 32): 'CVT_U32',
                  ('fcvtzu', 64): 'CVT_U64'}[(mn, W)]
            return [wr_gpr(ops[0], f'(u{W})({fn}((double){rd_fp(ops[1])}))')]
        raise Unsupported('fcvtzs ' + ops_s)
    if mn in ('scvtf', 'ucvtf'):
        if VEC.match(ops[0]):
            return simd_cvt(mn, ops)
        k, _ = vreg(ops[0])
        ty = 'float' if k == 's' else 'double'
        if is_gpr(ops[1]):
            W = width(ops[1])
            src = f'(s{W}){rd_gpr(ops[1])}' if mn == 'scvtf' else f'(u{W}){rd_gpr(ops[1])}'
        else:
            k2, n2 = vreg(ops[1])
            W = 32 if k2 == 's' else 64
            src = f'(s{W})v{n2}' if mn == 'scvtf' else f'(u{W})v{n2}'
        return [wr_fp(ops[0], f'({ty})({src})')]
    if mn == 'fmov':
        d, s = ops[0], ops[1]
        if VEC.match(d):
            m = VEC.match(d)
            n = int(m.group(1))
            v = fimm(s)
            if m.group(2) + m.group(3) == '2s':
                return [f'v{n} = B32((float){v!r}) | (B32((float){v!r}) << 32); v{n}h = 0;']
            if m.group(2) + m.group(3) == '4s':
                return [f'v{n} = B32((float){v!r}) | (B32((float){v!r}) << 32); v{n}h = v{n};']
            raise Unsupported('fmov ' + ops_s)
        if s.startswith('#'):
            k, n = vreg(d)
            v = fimm(s)
            return [wr_fp(d, f'({"(float)" if k == "s" else "(double)"}{v!r})')]
        if is_gpr(s) and FPR.match(d):  # fmov s0, w9 / fmov d1, x22 / fmov s0, wzr
            k, n = vreg(d)
            return [f'v{n} = (u64){rd_gpr(s)}; v{n}h = 0;']
        if is_gpr(d) and FPR.match(s):  # fmov w8, s0 / fmov x8, d0
            k, n = vreg(s)
            return [wr_gpr(d, f'v{n}')]
        if FPR.match(d) and FPR.match(s):
            k, n = vreg(d)
            k2, n2 = vreg(s)
            mask = '0xffffffffULL' if k == 's' else '~0ULL'
            return [f'v{n} = v{n2} & {mask}; v{n}h = 0;']
        raise Unsupported('fmov ' + ops_s)

    # ---- SIMD
    if mn == 'movi' or mn == 'mvni':
        d = ops[0]
        if FPR.match(d):  # movi d0, #0000000000000000
            k, n = vreg(d)
            v = int(ops[1][1:], 16)
            return [f'v{n} = {v:#x}ULL; v{n}h = 0;']
        m = VEC.match(d)
        n, arr = int(m.group(1)), m.group(2) + m.group(3)
        if arr in ('2d',):
            v = int(ops[1][1:], 16)
            return [f'v{n} = {v:#x}ULL; v{n}h = {v:#x}ULL;']
        v = imm(ops[1])
        if len(ops) > 2:
            v <<= int(ops[2].split('#')[1], 0)
        if mn == 'mvni':
            v = ~v
        if arr in ('2s', '4s'):
            v &= 0xffffffff
            lane = v | (v << 32)
        elif arr in ('8b', '16b'):
            v &= 0xff
            lane = int.from_bytes(bytes([v]) * 8, 'little')
        elif arr in ('4h', '8h'):
            v &= 0xffff
            lane = v * 0x0001000100010001
        else:
            raise Unsupported('movi ' + ops_s)
        hi = f'{lane:#x}ULL' if arr in ('4s', '16b', '8h') else '0'
        return [f'v{n} = {lane:#x}ULL; v{n}h = {hi};']
    if mn == 'dup':
        m = VEC.match(ops[0])
        n, arr = int(m.group(1)), m.group(2) + m.group(3)
        src = rd_gpr(ops[1])
        if arr == '2d':
            return [f'v{n} = {src}; v{n}h = {src};']
        if arr == '2s':
            return [f'v{n} = (u64)(u32){src} | ((u64)(u32){src} << 32); v{n}h = 0;']
        if arr == '4s':
            return [f'v{n} = (u64)(u32){src} | ((u64)(u32){src} << 32); v{n}h = v{n};']
        raise Unsupported('dup ' + ops_s)
    if mn in ('cmgt', 'cmhi', 'cmeq', 'cmge', 'cmhs'):
        return simd_arith(mn, ops)
    if mn in ('ushll', 'ushll2', 'sshll', 'sshll2', 'xtn', 'xtn2'):
        return simd_widen(mn, ops)
    raise Unsupported(f'{mn} {ops_s}')


def lane_get(n, ek, idx):
    bits = {'b': 8, 'h': 16, 's': 32, 'd': 64}[ek]
    per = 64 // bits
    half = f'v{n}' if idx < per else f'v{n}h'
    i = idx % per
    if bits == 64:
        return half
    return f'(u{bits})({half} >> {i * bits})'


def lane_set(n, ek, idx, val):
    bits = {'b': 8, 'h': 16, 's': 32, 'd': 64}[ek]
    per = 64 // bits
    half = f'v{n}' if idx < per else f'v{n}h'
    i = idx % per
    if bits == 64:
        return [f'{half} = (u64)({val});']
    m = ((1 << bits) - 1) << (i * bits)
    return [f'{half} = ({half} & ~{m:#x}ULL) | ((u64)(u{bits})({val}) << {i * bits});']


def vec_lanes(tok):
    m = VEC.match(tok)
    return int(m.group(1)), int(m.group(2)), m.group(3)


def simd_arith(mn, ops):
    d, cnt, ek = vec_lanes(ops[0])
    _, _, _ = vec_lanes(ops[1])
    a, b = vec_lanes(ops[1])[0], vec_lanes(ops[2])[0]
    bits = {'b': 8, 'h': 16, 's': 32, 'd': 64}[ek]
    total = cnt * bits
    out = ['{']
    for half in (('', 0), ('h', 1)):
        if total == 64 and half[1] == 1:
            out.append(f'u64 _r{half[0]} = 0;')
            continue
        lanes = []
        for i in range(64 // bits):
            sh = i * bits
            ua, ub = f'(u{bits})(v{a}{half[0]} >> {sh})', f'(u{bits})(v{b}{half[0]} >> {sh})'
            if bits == 64:
                ua, ub = f'v{a}{half[0]}', f'v{b}{half[0]}'
            sa, sb = f'(s{bits}){ua}', f'(s{bits}){ub}'
            e = {'add': f'(u{bits})({ua} + {ub})', 'sub': f'(u{bits})({ua} - {ub})',
                 'cmgt': f'({sa} > {sb} ? (u{bits})-1 : 0)', 'cmhi': f'({ua} > {ub} ? (u{bits})-1 : 0)',
                 'cmeq': f'({ua} == {ub} ? (u{bits})-1 : 0)', 'cmge': f'({sa} >= {sb} ? (u{bits})-1 : 0)',
                 'cmhs': f'({ua} >= {ub} ? (u{bits})-1 : 0)'}[mn]
            lanes.append(f'((u64)(u{bits})({e}) << {sh})' if bits < 64 else f'(u64)({e})')
        out.append(f'u64 _r{half[0]} = ' + ' | '.join(lanes) + ';')
    out.append(f'v{d} = _r; v{d}h = _rh; }}')
    return [' '.join(out)]


def simd_fp(mn, ops):
    d, cnt, ek = vec_lanes(ops[0])
    a, b = vec_lanes(ops[1])[0], vec_lanes(ops[2])[0]
    if ek != 's':
        raise Unsupported('simd fp ' + mn)
    op = {'fadd': '+', 'fsub': '-', 'fmul': '*', 'fdiv': '/'}[mn]
    out = ['{']
    for half in ('', 'h'):
        if cnt == 2 and half == 'h':
            out.append('u64 _rh = 0;')
            continue
        out.append(f'u64 _r{half} = B32(F32(v{a}{half}) {op} F32(v{b}{half})) | '
                   f'(B32(F32(v{a}{half} >> 32) {op} F32(v{b}{half} >> 32)) << 32);')
    out.append(f'v{d} = _r; v{d}h = _rh; }}')
    return [' '.join(out)]


def simd_cvt(mn, ops):
    d, cnt, ek = vec_lanes(ops[0])
    s = vec_lanes(ops[1])[0]
    if ek != 's':
        raise Unsupported('simd cvt')
    out = ['{']
    for half in ('', 'h'):
        if cnt == 2 and half == 'h':
            out.append('u64 _rh = 0;')
            continue
        if mn == 'scvtf':
            f = lambda x: f'B32((float)(s32)({x}))'
        elif mn == 'ucvtf':
            f = lambda x: f'B32((float)(u32)({x}))'
        elif mn == 'fcvtzs':
            f = lambda x: f'(u64)(u32)CVT_S32((double)F32({x}))'
        else:
            f = lambda x: f'(u64)(u32)CVT_U32((double)F32({x}))'
        out.append(f'u64 _r{half} = {f(f"v{s}{half}")} | ({f(f"v{s}{half} >> 32")} << 32);')
    out.append(f'v{d} = _r; v{d}h = _rh; }}')
    return [' '.join(out)]


def simd_widen(mn, ops):
    d, cd, ed = vec_lanes(ops[0])
    s, cs, es = vec_lanes(ops[1])
    bd = {'b': 8, 'h': 16, 's': 32, 'd': 64}[ed]
    bs = {'b': 8, 'h': 16, 's': 32, 'd': 64}[es]
    if mn.startswith('xtn'):
        # estrechar: cs elementos de bs bits → mitad baja (xtn) o alta (xtn2) de d
        n = 128 // bs
        lanes = []
        for i in range(n):
            src = f'v{s}' if i * bs < 64 else f'v{s}h'
            sh = (i * bs) % 64
            lanes.append(f'((u64)(u{bd})({src} >> {sh}) << {i * bd})' if bs < 64 else f'((u64)(u{bd}){src} << {i * bd})')
        e = ' | '.join(lanes)
        if mn == 'xtn':
            return [f'{{ u64 _r = {e}; v{d} = _r; v{d}h = 0; }}']
        return [f'{{ u64 _r = {e}; v{d}h = _r; }}']
    # ensanchar: mitad baja (ushll) o alta (ushll2) de s
    shift = imm(ops[2]) if len(ops) > 2 else 0
    src = f'v{s}' if not mn.endswith('2') else f'v{s}h'
    sg = mn.startswith('s')
    n = 64 // bs
    res = []
    for i in range(n):
        el = f'(u{bs})({src} >> {i * bs})' if bs < 64 else src
        if sg:
            el = f'(u64)(s64)(s{bs}){el}'
        el = f'((u64)(u{bd})(({el}) << {shift}))'
        res.append((i * bd, el))
    lo = ' | '.join(f'({e} << {p})' for p, e in res if p < 64) or '0'
    hi = ' | '.join(f'({e} << {p - 64})' for p, e in res if p >= 64) or '0'
    return [f'{{ u64 _l = {lo}, _h = {hi}; v{d} = _l; v{d}h = _h; }}']


# ------------------------------------------------------------------------ funciones y saltos
BRANCHES = ('b', 'bl', 'br', 'blr', 'ret', 'cbz', 'cbnz', 'tbz', 'tbnz')


def is_cond_branch(mn):
    return mn.startswith('b.') or mn in ('cbz', 'cbnz', 'tbz', 'tbnz')


def target_of(mn, ops_s):
    ops = split_ops(ops_s)
    return int(ops[-1], 16)


class Prog:
    def __init__(self, so, out):
        self.so, self.out = so, out
        self.elf = Elf(so)
        self.ins, self.labels = desarmar(so)
        self.fde = fdes(so)
        self.sym_at = {}
        self.sym_addr = {}
        self.func_syms = set()
        for name, val, size, typ, shndx in self.elf.syms:
            if shndx != 0 and val:
                self.sym_at.setdefault(val, name)
                self.sym_addr.setdefault(name, val)
                if typ == 2:
                    self.func_syms.add(val)
        self.imports = sorted({name for name, val, size, typ, shndx in self.elf.syms if shndx == 0 and name})
        self.plt = {}
        plt = self.elf.secs['.plt']
        relplt = [r for r in self.elf.relocs if r[4] == '.rela.plt']
        for i, (off, typ, si, add, _) in enumerate(relplt):
            self.plt[plt['addr'] + 32 + 16 * i] = self.elf.syms[si][0]
        for a, n in self.labels.items():  # comprobación con lo que nombra objdump
            if n.endswith('@plt') and a in self.plt:
                assert self.plt[a] == n[:-4], (hex(a), n, self.plt[a])
        self.text = self.elf.secs['.text']
        self.dem = {}

    # nombres -------------------------------------------------------------------------------
    def name(self, a):
        if a in self.plt:
            return self.plt[a]
        return self.sym_at.get(a)

    def is_func_start(self, a):
        return a in self.fde or a in self.plt or a in self.func_syms


def cident(name):
    return re.sub(r'[^A-Za-z0-9_]', '_', name)


# --------------------------------------------------------------------------- uso/def de registros
# Bits: x0..x8 → 0..8, v0..v7 → 9..16. Sólo importan éstos entre funciones (argumentos y retornos).
ARGBITS = (1 << 17) - 1
RETBITS = (1 << 0) | (1 << 1) | (1 << 9) | (1 << 10) | (1 << 11) | (1 << 12)  # x0 x1 v0..v3
RET_LIST = [('x', 0), ('x', 1), ('v', 0), ('v', 1), ('v', 2), ('v', 3)]


def reg_bit(tok):
    """Bit del registro si es x0..x8 o v0..v7; 0 si no importa entre funciones."""
    tok = tok.strip()
    m = GPR.match(tok)
    if m:
        if m.group(2) == 'zr':
            return 0
        n = int(m.group(2))
        return 1 << n if n <= 8 else 0
    m = FPR.match(tok) or re.match(r'^v(\d+)', tok)
    if m:
        n = int(m.group(2) if FPR.match(tok) else m.group(1))
        return 1 << (9 + n) if n <= 7 else 0
    return 0


def regs_in(tok):
    """Todos los bits de registros que aparecen en un operando (memoria, listas)."""
    b = 0
    for t in re.findall(r'\b(?:[wx](?:\d+)|[bhsdq]\d+|v\d+)\b', tok):
        b |= reg_bit(t)
    return b


def use_def(mn, ops_s):
    """(usa, define) de una instrucción común (no llamadas ni saltos a funciones)."""
    ops = split_ops(ops_s)
    if not ops:
        return 0, 0
    if mn in STORES or mn in ('stp', 'stnp'):
        u = 0
        for t in ops:
            u |= regs_in(t)
        d = 0
        return u, d
    if mn in ('stlxr', 'stxr', 'stlxrb', 'stxrb'):
        return regs_in(ops[1]) | regs_in(ops[2]), reg_bit(ops[0])
    if mn in ('cmp', 'cmn', 'tst', 'fcmp', 'fcmpe', 'ccmp', 'ccmn', 'fccmp'):
        u = 0
        for t in ops:
            u |= regs_in(t)
        return u, 0
    if mn in ('cbz', 'cbnz', 'tbz', 'tbnz', 'br', 'blr'):
        return regs_in(ops[0]), 0
    if mn in ('b', 'bl', 'ret', 'nop') or mn.startswith('b.'):
        return 0, 0
    if mn in ('ldp', 'ldpsw', 'ldnp'):
        u = regs_in(ops[2])
        return u, reg_bit(ops[0]) | reg_bit(ops[1])
    if mn == 'ld2':
        return regs_in(ops[1]), regs_in(ops[0])
    # destino = ops[0]; el resto se lee
    u = 0
    for t in ops[1:]:
        u |= regs_in(t)
    d = reg_bit(ops[0]) if not VEL.match(ops[0]) else 0
    if mn in ('movk', 'bfi', 'bfxil', 'xtn2') or VEL.match(ops[0]):
        u |= regs_in(ops[0])
    if mn in LOADS and len(ops) > 1:
        m = MEM_RE.match(ops[1])
        if m and (m.group(2) == '!' or len(ops) > 2):
            pass  # la base se reescribe pero es la misma (ya está en u)
    return u, d


NORETURN = {'abort', '__stack_chk_fail', '__cxa_throw', '__cxa_rethrow', '_Unwind_Resume', 'exit', '_exit',
            '_ZSt9terminatev', '__cxa_bad_cast', '__cxa_bad_typeid', '__cxa_call_unexpected',
            '__android_log_assert', '__assert2', '__cxa_pure_virtual'}


def is_noreturn(name):
    return name is not None and (name in NORETURN or name.startswith('_ZSt') and '__throw_' in name)


# ------------------------------------------------------------------- constantes en registros generales
ATOM_RE = re.compile(r'^(ld(add|clr|eor|set|smax|smin|umax|umin)|swp|cas)')
NO_DEF = ('cmp', 'cmn', 'tst', 'fcmp', 'fcmpe', 'ccmp', 'ccmn', 'fccmp', 'prfm', 'prfum', 'stp', 'stnp')


def cp_paso(ins, st):
    """Estado de x0..x30 (constante o None) después de la instrucción. Sólo arma constantes con adrp, adr,
    add/sub inmediato, mov y movk; cualquier otra escritura deja el registro en None."""
    mn, ops_s = ins
    if mn in ('b', 'ret', 'nop', 'br', 'cbz', 'cbnz', 'tbz', 'tbnz') or mn.startswith('b.'):
        return st
    if mn in ('bl', 'blr'):
        return (None,) * 19 + st[19:30] + (None,)
    ops = split_ops(ops_s)
    defs = []
    for i, t in enumerate(ops):
        if t.startswith('['):
            mm = MEM_RE.match(t)
            if mm and (mm.group(2) == '!' or i + 1 < len(ops)):   # la base se reescribe
                g = GPR.match(mm.group(1).split(',')[0].strip())
                if g and g.group(2) != 'zr':
                    defs.append(int(g.group(2)))
            break
    dst, val = None, None
    if mn not in STORES and mn not in NO_DEF and ops:
        n = 2 if mn in ('ldp', 'ldpsw', 'ldnp', 'ldxp', 'ldaxp') or ATOM_RE.match(mn) else 1
        for t in ops[:n]:
            g = GPR.match(t)
            if g and g.group(2) != 'zr':
                defs.append(int(g.group(2)))
        g = GPR.match(ops[0])
        if g and g.group(2) != 'zr':
            dst = int(g.group(2))
            mask = 0xffffffffffffffff if g.group(1) == 'x' else 0xffffffff

            def src(t):
                h = GPR.match(t)
                return None if not h or h.group(2) == 'zr' else st[int(h.group(2))]
            if mn in ('adrp', 'adr') and len(ops) == 2:
                val = int(ops[1], 16)
            elif mn in ('add', 'sub') and len(ops) in (3, 4) and ops[2].startswith('#'):
                b = src(ops[1])
                sh = 12 if len(ops) == 4 and ops[3] == 'lsl #12' else 0
                if b is not None and (len(ops) == 3 or sh):
                    k = imm(ops[2]) << sh
                    val = (b + k if mn == 'add' else b - k) & mask
            elif mn == 'mov' and len(ops) == 2:
                if ops[1].startswith('#'):
                    val = imm(ops[1]) & mask
                else:
                    b = src(ops[1])
                    val = None if b is None else b & mask
            elif mn == 'movk' and len(ops) in (2, 3) and st[dst] is not None:
                sh = int(ops[2].split('#')[1], 0) if len(ops) == 3 else 0
                val = ((st[dst] & ~(0xffff << sh)) | (imm(ops[1]) << sh)) & mask
    if not defs:
        return st
    st = list(st)
    for r in defs:
        st[r] = None
    if dst is not None:
        st[dst] = val
    return tuple(st)


# ------------------------------------------------------------------------------------ una función
class Func:
    def __init__(self, prog, entry):
        self.p, self.e = prog, entry
        self.end = prog.fde.get(entry)
        self.code = {}          # addr → (mn, ops)
        self.leaders = {entry}
        self.targets = set()    # direcciones con etiqueta
        self.calls = []         # (addr, kind, target)
        self.jt = {}            # addr del br → (registro, [(valor, destino)])
        self.problems = []
        self.tailcalls = {}     # addr → target (b a otra función)
        self.ctails = {}        # addr → target (salto condicional a otra función)
        self.falloff = set()    # instrucciones después de las cuales el código se cae

    def inrange(self, a):
        return self.end is not None and self.e <= a < self.end

    def explore(self):
        """Recorre la función. Los br cuya tabla no sale mirando hacia atrás se reintentan con constantes
        propagadas por el grafo ya conocido (la base de la tabla puede quedar guardada en x19..x28, prestarse
        y volver); lo nuevo que aparezca se recorre, y al final se confirma cada tabla con el grafo completo."""
        work = [self.e]
        seen = set()
        pend = []
        self._cp = None
        self._jtprob = {}
        por_cp = set()
        while True:
            self.walk(work, seen, pend)
            if not pend:
                break
            self._cp = self.constprop()
            work, quedan = [], []
            for a in pend:
                tabla = self.jump_table(a)
                if tabla:
                    self.jt[a] = tabla
                    por_cp.add(a)
                    for v, t in tabla[2]:
                        work.append(t)
                        self.leaders.add(t)
                        self.targets.add(t)
                else:
                    quedan.append(a)
            self._cp = None
            pend = quedan
            if not work:
                break
        if por_cp:
            self._cp = self.constprop()
            for a in por_cp:
                if self.jump_table(a) != self.jt[a]:
                    self.problems.append(f'tabla en {a:#x}: cambia con el grafo completo')
            self._cp = None
        for a in pend:
            self.problems += self._jtprob.get(a, [])
        return self

    def succs(self, a):
        """Sucesores de la instrucción `a` dentro de lo recorrido."""
        mn, ops = self.code[a]
        nxt = a + 4
        if mn == 'b':
            return [] if a in self.tailcalls else [target_of(mn, ops)]
        if mn == 'ret':
            return []
        if mn == 'br':
            return [t for _, t in self.jt[a][2]] if a in self.jt else []
        if mn == 'bl' and is_noreturn(self.p.name(target_of(mn, ops))):
            return []
        out = []
        if is_cond_branch(mn) and a not in self.ctails:
            out.append(target_of(mn, ops))
        if a not in self.falloff and nxt in self.code:
            out.append(nxt)
        return out

    def constprop(self):
        """Valor constante de cada registro general a la entrada de cada instrucción (None si varía)."""
        inn = {self.e: (None,) * 31}
        work = [self.e]
        while work:
            a = work.pop()
            st = cp_paso(self.code[a], inn[a])
            for s in self.succs(a):
                if s not in self.code:
                    continue
                old = inn.get(s)
                new = st if old is None else tuple(x if x == y else None for x, y in zip(old, st))
                if new != old:
                    inn[s] = new
                    work.append(s)
        return inn

    def walk(self, work, seen, pend):
        p = self.p
        while work:
            a = work.pop()
            while True:
                if a in seen:
                    break
                if a not in p.ins:
                    self.problems.append(f'sin instrucción en {a:#x}')
                    break
                seen.add(a)
                mn, ops = p.ins[a]
                self.code[a] = (mn, ops)
                nxt = a + 4
                stop = False
                if mn == 'b':
                    t = target_of(mn, ops)
                    if self.inrange(t) or (not p.is_func_start(t) and t not in p.plt):
                        work.append(t)
                        self.leaders.add(t)
                        self.targets.add(t)
                    else:
                        self.tailcalls[a] = t
                    stop = True
                elif is_cond_branch(mn):
                    t = target_of(mn, ops)
                    if self.inrange(t) or (not p.is_func_start(t) and t not in p.plt):
                        work.append(t)
                        self.leaders.add(t)
                        self.targets.add(t)
                    else:
                        self.ctails[a] = t
                    self.leaders.add(nxt)
                elif mn == 'bl':
                    t = target_of(mn, ops)
                    if is_noreturn(p.name(t)):
                        stop = True
                elif mn == 'ret':
                    stop = True
                elif mn == 'br':
                    tabla = self.jump_table(a)
                    if tabla:
                        self.jt[a] = tabla
                        for v, t in tabla[2]:
                            work.append(t)
                            self.leaders.add(t)
                            self.targets.add(t)
                    else:
                        pend.append(a)
                    stop = True
                if stop:
                    break
                if not self.inrange(a):
                    # veneer (erratum 843419 del Cortex-A53): una o dos instrucciones y un b de vuelta
                    vlen = getattr(self, '_vlen', 0) + 1
                    self._vlen = vlen
                    if vlen > 6:
                        self.problems.append(f'veneer largo en {a:#x}')
                        break
                    a = nxt
                    continue
                self._vlen = 0
                if not self.inrange(nxt):
                    self.falloff.add(a)
                    break
                a = nxt

    # --- tablas de saltos -----------------------------------------------------------------
    def jump_table(self, a_br):
        p = self.p
        ins = p.ins
        mn, ops = ins[a_br]
        reg = split_ops(ops)[0]
        self._jtprob[a_br] = []

        def back(start, regname, limit=40):
            """Busca hacia atrás (en orden de direcciones) la instrucción que define `regname`."""
            a = start - 4
            n = 0
            while n < limit and a in ins and (self.inrange(a) or a in self.code):
                m2, o2 = ins[a]
                os2 = split_ops(o2)
                if m2 in ('b', 'ret', 'br') and a != start:
                    pass
                if os2 and m2 not in STORES and m2 not in ('stp', 'cmp', 'cmn', 'tst', 'cbz', 'cbnz', 'tbz',
                                                          'tbnz', 'b', 'bl', 'blr', 'br') and not m2.startswith('b.'):
                    if norm(os2[0]) == norm(regname):
                        return a, m2, os2
                if m2 == 'bl' or m2 == 'blr':
                    mm = GPR.match(regname)
                    if not (mm and mm.group(2) != 'zr' and 19 <= int(mm.group(2)) <= 29):
                        return None   # las llamadas pisan x0..x18 y x30, no x19..x29
                a -= 4
                n += 1
            return None

        def norm(r):
            m = GPR.match(r)
            return ('r', m.group(2)) if m else r

        def unica_def(regname):
            """Si en toda la función el registro sólo se arma con adrp(+add) o adr, ese valor."""
            if self.end is None:
                return None
            defs = []
            a = self.e
            while a < self.end:
                if a in ins:
                    m2, o2 = ins[a]
                    os2 = split_ops(o2)
                    if os2 and m2 not in STORES and m2 not in ('stp', 'cmp', 'cmn', 'tst', 'cbz', 'cbnz', 'tbz',
                                                              'tbnz', 'b', 'bl', 'blr', 'br', 'ret') \
                            and not m2.startswith('b.'):
                        if norm(os2[0]) == norm(regname) or (m2 in ('ldp', 'ldpsw') and norm(os2[1]) == norm(regname)):
                            defs.append((m2, os2))
                a += 4
            if len(defs) == 1 and defs[0][0] == 'adr':
                return int(defs[0][1][1], 16)
            if len(defs) == 2 and defs[0][0] == 'adrp' and defs[1][0] == 'add' and len(defs[1][1]) == 3 \
                    and norm(defs[1][1][1]) == norm(regname) and defs[1][1][2].startswith('#'):
                return int(defs[0][1][1], 16) + imm(defs[1][1][2])
            return None

        def const_of(start, regname, depth=0):
            v = const_of1(start, regname, depth)
            m = GPR.match(regname)
            if v is None and m and m.group(2) != 'zr' and 19 <= int(m.group(2)) <= 28:
                v = unica_def(regname)   # guardado en un registro que las llamadas no tocan
            if v is None and m and m.group(2) != 'zr' and self._cp is not None:
                st = self._cp.get(start)   # propagado por el grafo (segunda vuelta de explore)
                if st is not None and st[int(m.group(2))] is not None:
                    v = st[int(m.group(2))] & (0xffffffff if m.group(1) == 'w' else 0xffffffffffffffff)
            return v

        def const_of1(start, regname, depth=0):
            if depth > 6:
                return None
            d = back(start, regname, 400)
            if not d:
                return None
            a, m2, o2 = d
            if m2 in ('adrp', 'adr'):
                return int(o2[1], 16)
            if m2 == 'add' and len(o2) == 3 and o2[2].startswith('#'):
                b = const_of(a, o2[1], depth + 1)
                return None if b is None else b + imm(o2[2])
            if m2 == 'mov' and is_gpr(o2[1]):
                return const_of(a, o2[1], depth + 1)
            return None

        d = back(a_br, reg)
        if not d or d[1] != 'add':
            return None
        a_add, _, o_add = d
        # add xD, xA, xB{, mod}
        A, B = o_add[1], o_add[2]
        mod = o_add[3] if len(o_add) > 3 else None
        cands = [(A, B, mod)]
        if mod is None:
            cands.append((B, A, None))
        for basereg, entreg, emod in cands:
            base = const_of(a_add, basereg)
            if base is None:
                continue
            ld = back(a_add, entreg)
            if not ld:
                continue
            a_ld, m_ld, o_ld = ld
            if m_ld not in ('ldrsw', 'ldrb', 'ldrh', 'ldrsb', 'ldrsh'):
                continue
            mm = MEM_RE.match(o_ld[1])
            parts = [x.strip() for x in mm.group(1).split(',')]
            tbase = const_of(a_ld, parts[0])
            if tbase is None:
                continue
            idxreg = parts[1]
            esz = {'ldrsw': 4, 'ldrb': 1, 'ldrh': 2, 'ldrsb': 1, 'ldrsh': 2}[m_ld]
            # cota: cmp wI, #N ; b.hi/b.hs antes de la carga (siguiendo copias mov wI, wJ)
            bound = None
            cur = {norm(idxreg)}
            a = a_ld - 4
            k = 0
            while k < 80 and a in p.ins and cur:
                m3, o3 = p.ins[a]
                os3 = split_ops(o3)
                if m3 == 'cmp' and len(os3) == 2 and norm(os3[0]) in cur and os3[1].startswith('#'):
                    bb = a + 4
                    while bb < a_ld and p.ins[bb][0] not in ('b.hi', 'b.hs', 'b.cs'):
                        bb += 4
                    if bb < a_ld:
                        bound = imm(os3[1]) + (1 if p.ins[bb][0] == 'b.hi' else 0)
                    break
                if os3 and m3 not in STORES and m3 not in ('stp', 'cmp', 'cmn', 'tst', 'cbz', 'cbnz', 'tbz',
                                                           'tbnz', 'b', 'bl', 'blr', 'br', 'ret') \
                        and not m3.startswith('b.') and norm(os3[0]) in cur:
                    cur.discard(norm(os3[0]))
                    if m3 == 'mov' and is_gpr(os3[1]):
                        cur.add(norm(os3[1]))
                a -= 4
                k += 1
            if bound is None:
                self._jtprob[a_br] = [f'tabla en {a_br:#x} sin cota']
                return None
            shift = 0
            sext = m_ld in ('ldrsw', 'ldrsb', 'ldrsh')
            if emod:
                ms = SHIFT_RE.match(emod)
                if ms.group(1) in ('lsl', 'sxtb', 'sxth', 'sxtw', 'uxtb', 'uxth', 'uxtw'):
                    shift = int(ms.group(2), 0) if ms.group(2) else 0
                    if ms.group(1).startswith('sxt'):
                        sext = True
            out = []
            for i in range(bound):
                raw = p.elf.read(tbase + i * esz, esz)
                v = int.from_bytes(raw, 'little', signed=sext)
                t = (base + (v << shift)) & 0xffffffffffffffff
                out.append((t - base, t))
            if not all(self.inrange(t) and t in ins for _, t in out):
                self._jtprob.setdefault(a_br, []).append(
                    f'tabla en {a_br:#x}: destinos fuera de la función (base {base:#x})')
                continue
            return (o_add[0], base, out)
        return None


# ------------------------------------------------------------------------------------ análisis
def analyze_flags(f):
    """Para cada instrucción que lee banderas: qué tipos de instrucción pudieron ponerlas."""
    p = f.p
    blocks = sorted(f.leaders & set(f.code))
    succ = {}
    binsns = {}
    leaders = set(blocks)
    for b in blocks:
        a = b
        lst = []
        while True:
            lst.append(a)
            mn, ops = f.code[a]
            nxt = a + 4
            term = False
            if mn == 'b':
                term = True
                t = target_of(mn, ops)
                succ[b] = [t] if a not in f.tailcalls else []
            elif mn == 'ret' or mn == 'br' or (mn == 'bl' and is_noreturn(p.name(target_of(mn, ops)))):
                term = True
                succ[b] = [t for _, t in f.jt[a][2]] if a in f.jt else []
            elif is_cond_branch(mn):
                term = True
                t = target_of(mn, ops)
                succ[b] = ([] if a in f.ctails else [t]) + [nxt]
            elif a in f.falloff:
                term = True
                succ[b] = []
            if term:
                break
            if nxt in leaders or nxt not in f.code:
                succ[b] = [nxt] if nxt in f.code else []
                break
            a = nxt
        binsns[b] = lst
    f.blocks, f.succ, f.binsns = blocks, succ, binsns

    def transfer(state, a):
        mn, ops = f.code[a]
        if mn in ('cmp', 'subs', 'negs'):
            return {'S' + str(width(split_ops(ops)[0]))}
        if mn in ('cmn', 'adds'):
            return {'A' + str(width(split_ops(ops)[0]))}
        if mn in ('tst', 'ands', 'bics'):
            return {'N' + str(width(split_ops(ops)[0]))}
        if mn in ('fcmp', 'fcmpe'):
            return {'F'}
        if mn in ('ccmp', 'ccmn', 'fccmp'):
            return {'Z'}
        if mn in ('bl', 'blr'):
            return {'U'}
        return state

    inn = {b: set() for b in blocks}
    inn[f.e] = {'U'}
    work = list(blocks)
    outs = {}
    while work:
        b = work.pop()
        st = set(inn[b])
        for a in binsns[b]:
            st = transfer(st, a)
        if outs.get(b) != st:
            outs[b] = st
            for s in succ.get(b, []):
                if s in inn and not st <= inn[s]:
                    inn[s] |= st
                    work.append(s)
    flags_at = {}
    for b in blocks:
        st = set(inn[b])
        for a in binsns[b]:
            flags_at[a] = st
            st = transfer(st, a)
    f.flags_at = flags_at


def callee_of(p, f, a):
    """Para una llamada o salto a función en `a`: ('F', addr) traducida, ('H', nombre) propia, ('I', None)."""
    mn, ops = f.code[a]
    if mn in ('blr', 'br'):
        return ('I', None)
    t = target_of(mn, ops)
    if t in HLE_ADDR:
        return ('H', HLE_ADDR[t])
    if t in p.plt:
        nm = p.plt[t]
        real = p.sym_addr.get(nm)
        if real is not None and real in p.rec:
            return ('F', real)
        return ('H', nm)
    if t in p.rec:
        return ('F', t)
    nm = p.name(t)
    return ('H', nm if nm else f'sub_{t:x}')


def analyze_liveness(p, f, L):
    """Vivos a la entrada (bits de x0..x8, v0..v7) y vivos después de cada llamada."""
    defs_all = 0
    for a, (mn, ops) in f.code.items():
        try:
            u, d = use_def(mn, ops)
        except Exception:
            u, d = ARGBITS, 0
        defs_all |= d
    f.defs = defs_all

    def call_use(a):
        mn, ops = f.code[a]
        k, t = callee_of(p, f, a)
        if k == 'F':
            return L.get(t, ARGBITS)
        return ARGBITS

    live_in_b = {b: 0 for b in f.blocks}
    after = {}
    changed = True
    while changed:
        changed = False
        for b in reversed(f.blocks):
            live = 0
            for s in f.succ.get(b, []):
                live |= live_in_b.get(s, 0)
            for a in reversed(f.binsns[b]):
                mn, ops = f.code[a]
                if mn == 'ret':
                    live = RETBITS
                elif a in f.tailcalls or (mn == 'br' and a not in f.jt):
                    live = call_use(a) if a in f.tailcalls else ARGBITS
                elif mn in ('bl', 'blr'):
                    after[a] = live
                    live = (live & ~ARGBITS) | call_use(a)
                    if mn == 'blr':
                        live |= regs_in(split_ops(ops)[0])
                    if mn == 'bl' and is_noreturn(p.name(target_of(mn, ops))):
                        after[a] = 0
                elif a in f.ctails:
                    live = live | call_use(a)
                    u, d = use_def(mn, ops)
                    live |= u
                elif a in f.falloff and not (mn in ('b', 'ret', 'br')):
                    u, d = use_def(mn, ops)
                    live = u
                else:
                    u, d = use_def(mn, ops)
                    live = (live & ~d) | u
            if live != live_in_b[b]:
                live_in_b[b] = live
                changed = True
    f.after_call = after
    return live_in_b[f.e]


# ------------------------------------------------------------------------------------- emisión
def store_args(bits):
    out = []
    for i in range(9):
        if bits >> i & 1:
            out.append(f'C.x[{i}]=x{i};')
    for i in range(8):
        if bits >> (9 + i) & 1:
            out.append(f'C.v[{i}]=v{i};')
    out.append('C.sp=sp;')
    return ' '.join(out)


def reload_ret(bits):
    out = []
    for k, n in RET_LIST:
        b = 1 << (n if k == 'x' else 9 + n)
        if bits & b:
            out.append(f'x{n}=C.x[{n}];' if k == 'x' else f'v{n}=C.v[{n}]; v{n}h=0;')
    return ' '.join(out)


WRITEBACK = 'C.x[0]=x0; C.x[1]=x1; C.v[0]=v0; C.v[1]=v1; C.v[2]=v2; C.v[3]=v3;'


def emit_call(p, f, a, L, tail=False):
    k, t = callee_of(p, f, a)
    mn, ops = f.code[a]
    if k == 'F':
        pre = store_args(L.get(t, ARGBITS))
        call = f'F_{t:x}();'
        p.used_f.add(t)
    elif k == 'H':
        pre = store_args(ARGBITS)
        call = f'H_{cident(t)}();'
        p.used_h.add(t)
    else:
        pre = store_args(ARGBITS)
        call = f'aos_call({rd_gpr(split_ops(ops)[0])});'
    pre = f'AOS_VIGIA(0x{a:x}); ' + pre
    if tail:
        return f'{pre} {call} return;'
    post = reload_ret(f.after_call.get(a, RETBITS))
    return f'{pre} {call} {post}'


def emit_func(p, f, L):
    o = []
    nm = p.name(f.e)
    dn = p.dem.get(nm, nm) if nm else f'sub_{f.e:x}'
    o.append(f'/* {dn} */')
    o.append(f'void F_{f.e:x}(void) {{')
    o.append('  u64 ' + ', '.join(f'x{i}=0' for i in range(31)) + ', sp=C.sp;')
    o.append('  u64 ' + ', '.join(f'v{i}=0, v{i}h=0' for i in range(32)) + ';')
    o.append('  u64 fa=0, fb=0; double fda=0, fdb=0; u32 fnz=0; int fk=0; (void)fa; (void)fb; (void)fda; (void)fdb; (void)fnz; (void)fk;')
    li = L[f.e]
    loads = []
    for i in range(9):
        if li >> i & 1:
            loads.append(f'x{i}=C.x[{i}];')
    for i in range(8):
        if li >> (9 + i) & 1:
            loads.append(f'v{i}=C.v[{i}];')
    if loads:
        o.append('  ' + ' '.join(loads))
    ctx = Ctx(f)
    ctx.flags_at = f.flags_at
    order = f.blocks
    for bi, b in enumerate(order):
        if b in f.targets or b == f.e:
            o.append(f' L_{b:x}:;')
        o.append(f'  AOS_VIGIA(0x{b:x});')
        lst = f.binsns[b]
        for a in lst:
            mn, ops = f.code[a]
            try:
                if mn == 'b':
                    if a in f.tailcalls:
                        o.append(f'  {emit_call(p, f, a, L, tail=True)}')
                    else:
                        o.append(f'  goto L_{target_of(mn, ops):x};')
                elif mn.startswith('b.'):
                    c = cond_c(f.flags_at.get(a, set()), mn[2:])
                    t = target_of(mn, ops)
                    if a in f.ctails:
                        o.append(f'  if ({c}) {{ {emit_call(p, f, a, L, tail=True)} }}')
                    else:
                        o.append(f'  if ({c}) goto L_{t:x};')
                elif mn in ('cbz', 'cbnz'):
                    os_ = split_ops(ops)
                    t = int(os_[1], 16)
                    c = f'{rd_gpr(os_[0])} {"==" if mn == "cbz" else "!="} 0'
                    if a in f.ctails:
                        o.append(f'  if ({c}) {{ {emit_call(p, f, a, L, tail=True)} }}')
                    else:
                        o.append(f'  if ({c}) goto L_{t:x};')
                elif mn in ('tbz', 'tbnz'):
                    os_ = split_ops(ops)
                    bit = imm(os_[1])
                    t = int(os_[2], 16)
                    c = f'(({rd_gpr(os_[0])} >> {bit}) & 1) {"==" if mn == "tbz" else "!="} 0'
                    if a in f.ctails:
                        o.append(f'  if ({c}) {{ {emit_call(p, f, a, L, tail=True)} }}')
                    else:
                        o.append(f'  if ({c}) goto L_{t:x};')
                elif mn == 'bl':
                    o.append(f'  {emit_call(p, f, a, L)}')
                    if is_noreturn(p.name(target_of(mn, ops))):
                        o.append(f'  aos_trap(0x{a:x}ULL, "no vuelve");')
                elif mn == 'blr':
                    o.append(f'  {emit_call(p, f, a, L)}')
                elif mn == 'br':
                    if a in f.jt:
                        reg, base, tab = f.jt[a]
                        cases = {}
                        for v, t in tab:
                            cases.setdefault(v, t)
                        cs = ' '.join(f'case {v}LL: goto L_{t:x};' for v, t in cases.items())
                        o.append(f'  switch ((s64)({rd_gpr(split_ops(ops)[0])} - {base:#x}ULL)) {{ {cs} }}')
                        o.append(f'  aos_trap(0x{a:x}ULL, "tabla");')
                    else:
                        o.append(f'  {emit_call(p, f, a, L, tail=True)}')
                elif mn == 'ret':
                    o.append(f'  {WRITEBACK} return;')
                else:
                    for line in translate(a, mn, ops, ctx):
                        o.append('  ' + line)
            except Unsupported as e:
                p.unsupported[(mn, str(e))] += 1
                o.append(f'  aos_trap(0x{a:x}ULL, "no traducida: {mn} {ops}");')
            if a in f.falloff:
                o.append(f'  aos_trap(0x{a:x}ULL, "se cae del final");')
        # caída al bloque siguiente
        last = lst[-1]
        mn, ops = f.code[last]
        ends = mn in ('b', 'ret', 'br') or last in f.falloff or (mn == 'bl' and is_noreturn(p.name(target_of(mn, ops))))
        if not ends:
            nxt = last + 4
            if bi + 1 >= len(order) or order[bi + 1] != nxt:
                if nxt in f.code:
                    o.append(f'  goto L_{nxt:x};')
                    f.targets.add(nxt)
                else:
                    o.append(f'  aos_trap(0x{last:x}ULL, "sin siguiente");')
    o.append('}')
    # las etiquetas que se agregaron por caídas después de emitir: rehacer si hace falta
    return o


# --------------------------------------------------------------------------------------- imagen
def build_image(p, import_addr):
    """Memoria inicial: .rodata y el segmento RW con relocaciones aplicadas."""
    e = p.elf
    ro = e.secs['.rodata']
    lo1, hi1 = ro['addr'], ro['addr'] + ro['size']
    rw_lo = e.secs['.init_array']['addr']
    bss = e.secs['.bss']
    rw_hi = bss['addr']
    rw = bytearray(e.read(rw_lo, rw_hi - rw_lo))
    rodata = bytearray(e.read(lo1, hi1 - lo1))
    missing = collections.Counter()
    for off, typ, si, add, sec in e.relocs:
        if typ == R_RELATIVE:
            val = add
        elif typ in (R_GLOB_DAT, R_JUMP_SLOT, R_ABS64):
            name, sval, ssize, styp, shndx = e.syms[si]
            if shndx != 0:
                val = sval + add
            elif name in import_addr:
                val = import_addr[name] + add
            else:
                missing[name] += 1
                val = 0
        else:
            raise SystemExit(f'relocación {typ} no soportada en {off:#x}')
        if rw_lo <= off < rw_hi:
            struct.pack_into('<Q', rw, off - rw_lo, val & 0xffffffffffffffff)
        elif lo1 <= off < hi1:
            struct.pack_into('<Q', rodata, off - lo1, val & 0xffffffffffffffff)
        else:
            raise SystemExit(f'relocación fuera de la imagen en {off:#x}')
    hdr = struct.pack('<4sIIIII', b'AOSi', 2, lo1, len(rodata), rw_lo, len(rw))
    return hdr + bytes(rodata) + bytes(rw), (lo1, hi1, rw_lo, rw_hi, bss['addr'] + bss['size']), missing


# ------------------------------------------------------------------------------------- principal
ROOT_PAT = re.compile(r'bzStateGame|dataLoad|convertScreenCoord|convertTouchCoord|getSysDate|AppDelegate|'
                      r'Java_org_cocos2dx_cpp_AppActivity|^on[A-Z]\w*\(char\*\)|InterstitialClose|InterstitialFail|'
                      r'^byebye|^(kSprite|kFont|kScene|kDraw|kFile|kDate|SoundClip)::')
# Lo que no se traduce: cocos2d (sus piezas se reemplazan en hle_cocos.c), la red, los anuncios, las
# compras, JNI y el runtime de C++.
HLE_PAT = re.compile(r'^(cocos2d::|kScene::(httpPost|clearResData|initResData|getSysInfo|setParticle)|kPopup::|'
                     r'sdkbox::|_JNIEnv::|CocosDenshion::|firebase::|BannerInterface|InterstitialInterface|'
                     r'RewardInterface|CommonInterface|BannerController|InterstitialController|RewardController|'
                     r'GoogleGDPR|operator new|operator delete|__cxa_|_Unwind_|std::terminate|std::exception::|'
                     r'(void|bool|int|std::string) cocos2d::|std::string cocos2d::)')
# Funciones internas (sin símbolo) que se reemplazan: std::ios_base::Init::Init() arma cout/cin con
# todo el sistema de locales y el juego no usa flujos.
HLE_ADDR = {0x89554c: 'std_ios_base_Init_Init'}
# Inicializadores estáticos de los .cpp del juego (AppDelegate, bzStateGame, kScene…): los primeros de
# .init_array, antes de los de cocos2d (que usan "org/cocos2dx/lib/…"). Son de la versión 1.1.94.
INIT_ROOTS = [0x29581c, 0x295864, 0x295cf0, 0x296400, 0x296460, 0x2964c0]
# lo que la capa propia necesita llamar del código original
EXTRA_ROOTS = ['_ZNSt8_Rb_treeIiSt4pairIKiP7kSpriteESt10_Select1stIS4_ESt4lessIiESaIS4_EE16_M_insert_uniqueIS0_IiS3_EEES0_ISt17_Rb_tree_iteratorIS4_EbEOT_']


def address_taken(p, f):
    """Funciones cuya dirección arma el código (adrp+add, adr, o leída de la GOT): punteros a función
    que después se llaman con blr (pthread_once, std::function, qsort…)."""
    out = set()
    pages = {}
    txt_lo, txt_hi = p.text['addr'], p.text['addr'] + p.text['size']
    got = p.elf.secs['.got']
    gotrel = getattr(p, '_gotrel', None)
    if gotrel is None:
        gotrel = {}
        for off, typ, si, add, sec in p.elf.relocs:
            if got['addr'] <= off < got['addr'] + got['size']:
                if typ == R_RELATIVE:
                    gotrel[off] = add
                elif typ in (R_GLOB_DAT, R_ABS64):
                    nm, val, sz, styp, shndx = p.elf.syms[si]
                    if shndx and styp == 2:
                        gotrel[off] = val + add
        p._gotrel = gotrel
    for a in sorted(f.code):
        mn, ops = f.code[a]
        o = split_ops(ops)
        if mn == 'adrp':
            pages[o[0]] = int(o[1], 16)
            continue
        v = None
        if mn == 'adr':
            v = int(o[1], 16)
        elif mn == 'add' and len(o) == 3 and o[1] in pages and o[2].startswith('#'):
            v = pages[o[1]] + imm(o[2])
        elif mn == 'ldr' and len(o) == 2 and o[0].startswith('x'):
            m = re.match(r'^\[(x\d+), #(0x[0-9a-f]+)\]$', o[1])
            if m and m.group(1) in pages:
                v = gotrel.get(pages[m.group(1)] + int(m.group(2), 16))
        if v is not None and txt_lo <= v < txt_hi and v in p.fde and v != f.e:
            out.add(v)
    return out


def main():
    so, out = sys.argv[1], sys.argv[2]
    capa = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.abspath(__file__))
    os.makedirs(out, exist_ok=True)
    p = Prog(so, out)
    allnames = set(p.sym_at.values()) | set(p.plt.values())
    p.dem = demangle(allnames)

    def is_hle(name):
        if name is None:
            return False
        if name in p.imports:
            return True
        d = p.dem.get(name, name)
        return HLE_PAT.search(d) is not None

    roots = [a for a, n in p.sym_at.items() if a in p.fde and ROOT_PAT.search(p.dem.get(n, n)) and not is_hle(n)]
    roots += [p.sym_addr[n] for n in EXTRA_ROOTS if n in p.sym_addr]
    roots += INIT_ROOTS

    p.rec = {}
    p.hle_names = set()
    work = list(roots)
    while work:
        a = work.pop()
        if a in p.rec:
            continue
        if a not in p.fde:
            print(f'aviso: {a:#x} ({p.name(a)}) sin FDE, se salta', file=sys.stderr)
            continue
        nm = p.name(a)
        if is_hle(nm):
            p.hle_names.add(nm)
            continue
        if a in HLE_ADDR:
            p.hle_names.add(HLE_ADDR[a])
            continue
        f = Func(p, a).explore()
        p.rec[a] = f
        for t in address_taken(p, f):
            if t in HLE_ADDR:
                p.hle_names.add(HLE_ADDR[t])
            elif not is_hle(p.name(t)):
                work.append(t)
        for b, (mn, ops) in f.code.items():
            if mn in ('bl', 'b') or (is_cond_branch(mn) and b in f.ctails):
                if mn == 'b' and b not in f.tailcalls:
                    continue
                t = target_of(mn, ops)
                tn = p.name(t)
                if t in p.plt:
                    real = p.sym_addr.get(tn)
                    if is_hle(tn) or real is None:
                        p.hle_names.add(tn)
                    else:
                        work.append(real)
                elif is_hle(tn):
                    p.hle_names.add(tn)
                else:
                    work.append(t)
    print(f'funciones traducidas: {len(p.rec)}; instrucciones: {sum(len(f.code) for f in p.rec.values())}',
          file=sys.stderr)
    for f in p.rec.values():
        analyze_flags(f)
        for pr in f.problems:
            print(f'problema en {f.e:#x} {p.name(f.e)}: {pr}', file=sys.stderr)
    if os.environ.get('AOS_BR'):   # br sin tabla: deberían ser sólo saltos a funciones por puntero
        for f in p.rec.values():
            for a in sorted(f.code):
                if f.code[a][0] == 'br' and a not in f.jt:
                    print(f'br sin tabla en {a:#x} ({p.dem.get(p.name(f.e), p.name(f.e))})', file=sys.stderr)
    # vivos a la entrada: punto fijo
    L = {a: 0 for a in p.rec}
    for it in range(50):
        changed = False
        for a, f in p.rec.items():
            v = analyze_liveness(p, f, L)
            if v != L[a]:
                L[a] = v
                changed = True
        if not changed:
            break
    print(f'vivos: {it + 1} vueltas', file=sys.stderr)

    p.used_f, p.used_h = set(), set()
    p.unsupported = collections.Counter()
    # importaciones: funciones → direcciones ficticias; datos → bloque propio
    import_addr = {}
    imp_data = {}
    THUNK = 0xF0000000
    DATA = 0xC50000
    dpos = DATA
    for i, name in enumerate(p.imports):
        styp = next(t for n, v, s, t, sh in p.elf.syms if n == name and sh == 0)
        if styp == 1:  # OBJECT
            imp_data[name] = dpos
            import_addr[name] = dpos
            dpos += 0x400
        else:
            import_addr[name] = THUNK + 16 * i
    img, (ro_lo, ro_hi, rw_lo, rw_hi, bss_hi), missing = build_image(p, import_addr)
    open(os.path.join(out, 'imagen.bin'), 'wb').write(img)

    # funciones C
    chunks = []
    cur = []
    size = 0
    for a in sorted(p.rec):
        f = p.rec[a]
        lines = emit_func(p, f, L)
        txt = '\n'.join(lines) + '\n\n'
        cur.append(txt)
        size += len(txt)
        if size > 1_500_000:
            chunks.append(cur)
            cur, size = [], 0
    if cur:
        chunks.append(cur)
    for i, ch in enumerate(chunks):
        with open(os.path.join(out, f'rec_{i:02d}.c'), 'w') as fh:
            fh.write('#include "rec.h"\n\n')
            fh.writelines(ch)

    hle = sorted(p.hle_names | p.used_h)
    with open(os.path.join(out, 'rec.h'), 'w') as fh:
        fh.write('#pragma once\n#include "aos.h"\n\n')
        fh.write(f'#define AOS_RO_LO {ro_lo:#x}u\n#define AOS_RO_HI {ro_hi:#x}u\n#define AOS_RW_LO {rw_lo:#x}u\n'
                 f'#define AOS_RW_HI {rw_hi:#x}u\n#define AOS_BSS_HI {bss_hi:#x}u\n#define AOS_IMPDATA {DATA:#x}u\n'
                 f'#define AOS_IMPDATA_HI {dpos:#x}u\n#define AOS_THUNK {THUNK:#x}u\n\n')
        for a in sorted(p.rec):
            fh.write(f'void F_{a:x}(void);\n')
        fh.write('\n')
        for n in hle:
            fh.write(f'void H_{cident(n)}(void);\n')
        fh.write('\n')
        for n, ad in sorted(imp_data.items()):
            fh.write(f'#define AOS_IMP_{cident(n)} {ad:#x}u\n')
    # despachador de llamadas indirectas
    with open(os.path.join(out, 'disp.c'), 'w') as fh:
        fh.write('#include "rec.h"\n\nvoid aos_call(u64 a) {\n  switch (a) {\n')
        for a in sorted(p.rec):
            fh.write(f'  case {a:#x}ULL: F_{a:x}(); return;\n')
        for n in hle:
            if n in import_addr and n not in imp_data:
                fh.write(f'  case {import_addr[n]:#x}ULL: H_{cident(n)}(); return;\n')
            elif n in p.sym_addr:
                fh.write(f'  case {p.sym_addr[n]:#x}ULL: H_{cident(n)}(); return;\n')
        fh.write('  }\n  aos_bad_call(a);\n}\n')
    # stubs débiles para lo que la capa propia todavía no tiene
    with open(os.path.join(out, 'hle_auto.c'), 'w') as fh:
        fh.write('#include "rec.h"\n\n')
        for n in hle:
            d = p.dem.get(n, n).replace('\\', '\\\\').replace('"', '\\"')
            fh.write(f'__attribute__((weak)) void H_{cident(n)}(void) {{ aos_missing("{d}"); }}\n')
    # nombres (para mensajes)
    # nombres: los de lo traducido, la capa propia y las vtables; con AOS_NOMBRES=todos, todas las
    # funciones del .so (sirve para depurar: dice el nombre de cualquier llamada sin reemplazo)
    capa_defs = set()
    for fn in sorted(os.listdir(capa)):
        if fn.endswith('.c'):
            capa_defs |= set(re.findall(r'^void H_(\w+)\(void\)', open(os.path.join(capa, fn)).read(), re.M))
    todos = os.environ.get('AOS_NOMBRES') == 'todos'
    names = {}
    for a, n in p.sym_at.items():
        en_texto = p.text['addr'] <= a < p.text['addr'] + p.text['size']
        if n.startswith('_ZTV') or (en_texto and (todos or a in p.rec or n in hle or n in capa_defs)):
            names[a] = p.dem.get(n, n)
    json.dump(dict(rec={f'{a:x}': (p.dem.get(p.name(a), p.name(a)) if p.name(a) else '') for a in p.rec},
                   live_in={f'{a:x}': L[a] for a in p.rec},
                   hle=hle, missing_relocs=dict(missing),
                   unsupported=[f'{k[0]} {k[1]}: {v}' for k, v in p.unsupported.items()],
                   imports={n: f'{a:#x}' for n, a in import_addr.items()}),
              open(os.path.join(out, 'rec.json'), 'w'), indent=1)
    with open(os.path.join(out, 'nombres.c'), 'w') as fh:
        fh.write('#include "rec.h"\n\nconst AosNombre aos_nombres[] = {\n')
        def esc(x):
            return x[:160].replace(chr(92), chr(92) * 2).replace(chr(34), chr(92) + chr(34))
        for a in sorted(names):
            fh.write(f'  {{{a:#x}u, "{esc(p.sym_at[a])}", "{esc(names[a])}"}},\n')
        fh.write('};\nconst int aos_nnombres = sizeof(aos_nombres) / sizeof(aos_nombres[0]);\n')
        fh.write('const u32 aos_inits[] = {' + ', '.join(f'{a:#x}u' for a in INIT_ROOTS) + '};\n')
        fh.write('const int aos_ninits = %d;\n' % len(INIT_ROOTS))
    # registro de la capa propia: toda H_<símbolo del .so> se puede llamar por su dirección original
    # (las virtuales de cocos2d llegan así a aos_call)
    defs = set()
    for fn in sorted(os.listdir(capa)):
        if fn.endswith('.c'):
            defs |= set(re.findall(r'^void H_(\w+)\(void\)', open(os.path.join(capa, fn)).read(), re.M))
    reg = sorted(d for d in defs if d in p.sym_addr and d not in p.imports)
    with open(os.path.join(out, 'registro.c'), 'w') as fh:
        fh.write('#include "rec.h"\n\n')
        for d in reg:
            fh.write(f'void H_{d}(void);\n')
        fh.write('\ntypedef struct { const char *n; void (*f)(void); } Reg;\nconst Reg aos_registro[] = {\n')
        for d in reg:
            fh.write(f'  {{"{d}", H_{d}}},\n')
        fh.write('};\nconst int aos_nregistro = %d;\n' % len(reg))
    if p.unsupported:
        print('SIN TRADUCIR:', file=sys.stderr)
        for k, v in p.unsupported.most_common():
            print(f'  {v:5d}  {k[0]}  {k[1]}', file=sys.stderr)
    print(f'capa propia: {len(hle)} funciones; relocaciones sin resolver: {len(missing)}', file=sys.stderr)


if __name__ == '__main__':
    main()
