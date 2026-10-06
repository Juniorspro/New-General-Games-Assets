import dnfile, struct, sys
pe = dnfile.dnPE(sys.argv[1])
md = pe.net.mdtables
us = pe.net.user_strings
# tabla de opcodes: (nombre, tipo de operando)
OP = {}
def d(c, n, t=None): OP[c] = (n, t)
for c, n in [(0,'nop'),(1,'break'),(2,'ldarg.0'),(3,'ldarg.1'),(4,'ldarg.2'),(5,'ldarg.3'),(6,'ldloc.0'),(7,'ldloc.1'),(8,'ldloc.2'),(9,'ldloc.3'),(10,'stloc.0'),(11,'stloc.1'),(12,'stloc.2'),(13,'stloc.3'),(0x14,'ldnull'),(0x15,'ldc.i4.m1'),(0x16,'ldc.i4.0'),(0x17,'ldc.i4.1'),(0x18,'ldc.i4.2'),(0x19,'ldc.i4.3'),(0x1a,'ldc.i4.4'),(0x1b,'ldc.i4.5'),(0x1c,'ldc.i4.6'),(0x1d,'ldc.i4.7'),(0x1e,'ldc.i4.8'),(0x25,'dup'),(0x26,'pop'),(0x2a,'ret'),(0x58,'add'),(0x59,'sub'),(0x5a,'mul'),(0x5b,'div'),(0x5d,'rem'),(0x5f,'and'),(0x60,'or'),(0x65,'neg'),(0x66,'not'),(0x69,'conv.i4'),(0x6b,'conv.r4'),(0x6c,'conv.r8'),(0x76,'conv.r.un'),(0x8e,'ldlen'),(0x14,'ldnull')]: d(c,n)
for c, n in [(0x0e,'ldarg.s'),(0x0f,'ldarga.s'),(0x10,'starg.s'),(0x11,'ldloc.s'),(0x12,'ldloca.s'),(0x13,'stloc.s'),(0x1f,'ldc.i4.s')]: d(c,n,'i1')
d(0x20,'ldc.i4','i4'); d(0x21,'ldc.i8','i8'); d(0x22,'ldc.r4','r4'); d(0x23,'ldc.r8','r8')
for c, n in [(0x27,'jmp'),(0x28,'call'),(0x6f,'callvirt'),(0x70,'cpobj'),(0x71,'ldobj'),(0x73,'newobj'),(0x74,'castclass'),(0x75,'isinst'),(0x79,'unbox'),(0x7b,'ldfld'),(0x7c,'ldflda'),(0x7d,'stfld'),(0x7e,'ldsfld'),(0x7f,'ldsflda'),(0x80,'stsfld'),(0x81,'stobj'),(0x8c,'box'),(0x8d,'newarr'),(0x8f,'ldelema'),(0xa3,'ldelem'),(0xa4,'stelem'),(0xa5,'unbox.any'),(0xd0,'ldtoken'),(0xfe06,'ldftn')]: d(c,n,'tok')
d(0x72,'ldstr','str')
for c, n in [(0x41,'bge.un.s'),(0x42,'bgt.un.s'),(0x43,'ble.un.s'),(0x44,'blt.un.s'),(0x2b,'br.s'),(0x2c,'brfalse.s'),(0x2d,'brtrue.s'),(0x2e,'beq.s'),(0x2f,'bge.s'),(0x30,'bgt.s'),(0x31,'ble.s'),(0x32,'blt.s'),(0x33,'bne.un.s'),(0x34,'bge.un.s'),(0x35,'bgt.un.s'),(0x36,'ble.un.s'),(0x37,'blt.un.s'),(0xde,'leave.s')]: d(c,n,'b1')
for c, n in [(0x38,'br'),(0x39,'brfalse'),(0x3a,'brtrue'),(0x3b,'beq'),(0x3c,'bge'),(0x3d,'bgt'),(0x3e,'ble'),(0x3f,'blt'),(0x40,'bne.un'),(0xdd,'leave')]: d(c,n,'b4')
for c in range(0x90, 0xa3): d(c, 'ldelem/stelem')
for c, n in [(0xfe01,'ceq'),(0xfe02,'cgt'),(0xfe03,'cgt.un'),(0xfe04,'clt'),(0xfe05,'clt.un'),(0xdc,'endfinally')]: d(c,n)
def tok(t):
    tb, row = t >> 24, t & 0xffffff
    try:
        if tb == 0x06: m = md.MethodDef[row-1]; return f'{m.Name}'
        if tb == 0x04: f = md.Field[row-1]; return f'.{f.Name}'
        if tb == 0x0a:
            m = md.MemberRef[row-1]; cls = m.Class.row
            return f'{getattr(cls, "TypeName", "?")}.{m.Name}'
        if tb == 0x01: r = md.TypeRef[row-1]; return r.TypeName
        if tb == 0x02: r = md.TypeDef[row-1]; return r.TypeName
    except Exception as e: return f'tok{hex(t)}'
    return f'tok{hex(t)}'
data = pe.__data__
for td in md.TypeDef:
    if not td.MethodList: continue
    print(f'\n== class {td.TypeName}  fields: ' + ', '.join(str(f.row.Name) for f in td.FieldList))
    for mref in td.MethodList:
        m = mref.row
        if not m.Rva: continue
        off = pe.get_offset_from_rva(m.Rva)
        h = data[off]
        if h & 3 == 2: size = h >> 2; code = data[off+1:off+1+size]
        else: size = struct.unpack_from('<I', data, off+4)[0]; code = data[off+12:off+12+size]
        out = []; i = 0
        while i < len(code):
            p0 = i
            c = code[i]; i += 1
            if c == 0xfe: c = 0xfe00 | code[i]; i += 1
            n, t = OP.get(c, (f'op{hex(c)}', None))
            a = ''
            if t == 'i1': a = str(struct.unpack_from('<b', code, i)[0]); i += 1
            elif t == 'i4': a = str(struct.unpack_from('<i', code, i)[0]); i += 4
            elif t == 'i8': i += 8
            elif t == 'r4': a = f'{struct.unpack_from("<f", code, i)[0]:g}'; i += 4
            elif t == 'r8': a = f'{struct.unpack_from("<d", code, i)[0]:g}'; i += 8
            elif t == 'tok': a = tok(struct.unpack_from('<I', code, i)[0]); i += 4
            elif t == 'str':
                k = struct.unpack_from('<I', code, i)[0] & 0xffffff; i += 4
                try: a = repr(us.get(k).value)
                except Exception: a = '"?"'
            elif t == 'b1': a = f'->{i+1+struct.unpack_from("<b", code, i)[0]}'; i += 1
            elif t == 'b4': a = f'->{i+4+struct.unpack_from("<i", code, i)[0]}'; i += 4
            if n in ('nop',): continue
            out.append((f'{p0}:' if len(sys.argv) > 2 else '') + f'{n} {a}'.strip())
        print(f'  {m.Name}: ' + ' ; '.join(out))
