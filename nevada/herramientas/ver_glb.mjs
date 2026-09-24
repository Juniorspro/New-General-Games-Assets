// Lista lo que trae un GLB: mallas (vértices, triángulos), caja, materiales y texturas.
//     node herramientas/ver_glb.mjs crudo/m-auto.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const r = doc.getRoot();
  console.log('==', f);
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), idx = p.getIndices();
    console.log(`  malla ${m.getName().slice(0, 20)}: ${pos.getCount()} vértices, ${idx ? idx.getCount() / 3 : '?'} triángulos, atributos ${p.listSemantics().join(',')}`);
  }
  for (const mt of r.listMaterials()) {
    const t = (x) => x ? `${x.getMimeType()} ${x.getSize()?.join('×')}` : '-';
    console.log(`  material ${mt.getName()}: color ${t(mt.getBaseColorTexture())} · metal/rugos ${t(mt.getMetallicRoughnessTexture())} · normal ${t(mt.getNormalTexture())} · emisión ${t(mt.getEmissiveTexture())} · metal ${mt.getMetallicFactor()} rugos ${mt.getRoughnessFactor()}`);
  }
  console.log('  animaciones', r.listAnimations().length, 'pieles', r.listSkins().length);
}
