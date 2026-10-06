"""Resuelve materiales de UE (instancias → padre) en algo simple para three.js.
Uso: materiales.py lista.txt salida.json"""
import sys, json, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ue4 import Paquetes, color, r4
P = Paquetes()

def cargar(ruta):
    pkg, _, nom = ruta.rpartition('.')
    d = P.paquete(pkg)
    if not d: return None
    for e in d:
        if e['Name'] == nom and e['Type'] in ('Material', 'MaterialInstanceConstant', 'MaterialInstanceDynamic'): return e
    return None

def ref_de(e, nombre):
    return (e.get('Properties') or {}).get(nombre)

def resolver(ruta):
    cadena = []
    e = cargar(ruta)
    while e is not None and len(cadena) < 10:
        cadena.append(e)
        par = ref_de(e, 'Parent')
        e = P.obj(par) if par else None
    if not cadena: return {'falta': True}
    raiz = cadena[-1]
    texp, sc, vc, sw = {}, {}, {}, {}
    # valores por defecto del material raíz: expresiones-parámetro
    pkg = raiz.get('Package') or ''
    d = P.paquete(pkg) or []
    muestras = []
    for x in d:
        pr = x.get('Properties') or {}
        t = x['Type']
        if t in ('MaterialExpressionTextureSampleParameter2D', 'MaterialExpressionTextureObjectParameter', 'MaterialExpressionTextureSampleParameterCube'):
            if pr.get('ParameterName') and pr.get('Texture'): texp[pr['ParameterName']] = P.ruta(pr['Texture'])
        elif t == 'MaterialExpressionScalarParameter':
            if pr.get('ParameterName'): sc[pr['ParameterName']] = pr.get('DefaultValue', 0.0)
        elif t == 'MaterialExpressionVectorParameter':
            if pr.get('ParameterName'): vc[pr['ParameterName']] = color(pr.get('DefaultValue') or {'R': 0, 'G': 0, 'B': 0}, True)
        elif t == 'MaterialExpressionStaticSwitchParameter':
            if pr.get('ParameterName'): sw[pr['ParameterName']] = pr.get('DefaultValue', False)
        elif t == 'MaterialExpressionTextureSample' and pr.get('Texture'):
            muestras.append((x['Name'], P.ruta(pr['Texture'])))
    # las instancias pisan (de la raíz hacia la hoja)
    for e in reversed(cadena[:-1]):
        pr = e.get('Properties') or {}
        for p in pr.get('TextureParameterValues') or []:
            if p.get('ParameterValue'): texp[p['ParameterName']] = P.ruta(p['ParameterValue'])
        for p in pr.get('ScalarParameterValues') or []: sc[p['ParameterName']] = p.get('ParameterValue', 0.0)
        for p in pr.get('VectorParameterValues') or []: vc[p['ParameterName']] = color(p.get('ParameterValue') or {}, True)
        so = (pr.get('StaticParameters') or {})
        for p in so.get('StaticSwitchParameters') or []: sw[p.get('ParameterInfo', {}).get('Name') or p.get('ParameterName')] = p.get('Value')
    rp = raiz.get('Properties') or {}
    def ent(n):
        x = rp.get(n) or {}
        return x.get('ExpressionName')
    out = {'raiz': raiz['Name']}
    bm = rp.get('BlendMode', 'BLEND_Opaque'); out['blend'] = bm.split('_')[-1]
    for e in cadena[:-1]:
        bo = ((e.get('Properties') or {}).get('BasePropertyOverrides') or {})
        if bo.get('bOverride_BlendMode') and bo.get('BlendMode'): out['blend'] = bo['BlendMode'].split('_')[-1]; break
    if rp.get('TwoSided'): out['doble'] = True
    for e in cadena[:-1]:
        bo = ((e.get('Properties') or {}).get('BasePropertyOverrides') or {})
        if bo.get('bOverride_TwoSided'): out['doble'] = bo.get('TwoSided', False); break
    sm = rp.get('ShadingModel', 'MSM_DefaultLit')
    if 'Unlit' in sm: out['unlit'] = True
    dom = rp.get('MaterialDomain')
    if dom: out['dominio'] = dom.split('_')[-1]
    if rp.get('OpacityMaskClipValue') is not None: out['corte'] = rp['OpacityMaskClipValue']
    # Qué entra a cada salida
    entradas = {k: ent(k) for k in ('BaseColor', 'EmissiveColor', 'Normal', 'Opacity', 'OpacityMask')}
    # Expresión → parámetro (si la salida está conectada directo a un parámetro/muestra)
    exp_param = {}
    for x in d:
        pr = x.get('Properties') or {}
        if pr.get('ParameterName'): exp_param[x['Name']] = pr['ParameterName']
    tex_por_exp = dict(muestras)
    def textura_de(salida, patron):
        en = entradas.get(salida)
        if en in exp_param and exp_param[en] in texp: return texp[exp_param[en]]
        if en in tex_por_exp: return tex_por_exp[en]
        for k, v in texp.items():
            if re.search(patron, k, re.I): return v
        return None
    base = textura_de('BaseColor', r'alb|diff|base|color|col$|^tex|texture|albedo|^d$|_d$|main')
    if not base and not texp and muestras:
        # sin parámetros: la primera muestra que no parezca normal
        for n, t in muestras:
            if not re.search(r'_n(rm)?$|norm', t, re.I): base = t; break
    if not base:
        cand = [v for k, v in texp.items() if not re.search(r'nrm|norm|rough|rma|orm|mask|spec|metal|ao|height|emis|_n$', k, re.I)]
        if cand: base = cand[0]
    if base: out['base'] = base
    nrm = textura_de('Normal', r'nrm|norm|_n$')
    if nrm and nrm != base: out['normal'] = nrm
    em = None
    if entradas['EmissiveColor']:
        em = textura_de('EmissiveColor', r'emis|emit|glow|light')
        if em == base and not out.get('unlit'): em = None
    if em: out['emisivo'] = em
    # color: un vector de tinte
    for k, v in vc.items():
        if re.search(r'tint|color|colour|base|albedo|diffuse', k, re.I) and not re.search(r'emis|metal|spec', k, re.I):
            out['color'] = v; break
    for k, v in vc.items():
        if re.search(r'emis|glow', k, re.I): out['color_em'] = v; break
    for k, v in sc.items():
        if re.search(r'emis|glow|bright|intens', k, re.I): out['k_em'] = v; break
    for k, v in sc.items():
        if re.search(r'opac', k, re.I): out['opacidad'] = v; break
    if not base and 'color' not in out:
        bc = rp.get('BaseColor') or {}
        if bc.get('UseConstant') and bc.get('Constant'): out['color'] = color(bc['Constant'])
    out['params'] = {'tex': texp, 'esc': sc, 'vec': vc}
    if sw: out['params']['sw'] = sw
    return r4(out)

if __name__ == '__main__':
    lista = [l.strip() for l in open(sys.argv[1]) if l.strip()]
    res = {r: resolver(r) for r in lista}
    json.dump(res, open(sys.argv[2], 'w'), separators=(',', ':'), ensure_ascii=False)
    sin = [r for r, m in res.items() if 'base' not in m and 'color' not in m]
    print(len(res), 'materiales', len(sin), 'sin base:', [r.split('.')[-1] for r in sin][:30])
