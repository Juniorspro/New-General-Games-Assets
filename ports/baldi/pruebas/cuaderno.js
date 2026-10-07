// pone al jugador frente al cuaderno más cercano, mirándolo
(() => {
  const m = window.__baldi.mundo, V = window.__baldi.THREE.Vector3;
  const pl = m.buscar('Player');
  const nbs = m.comps.filter((c) => c.constructor.name === 'NotebookScript' && c.nodo._activoH);
  const pp = pl.position;
  nbs.sort((a, b) => a.nodo.position.distanceTo(pp) - b.nodo.position.distanceTo(pp));
  const nb = nbs[0].nodo, np = nb.position;
  // a 6 unidades, del lado del pasillo: probar 4 direcciones y elegir la que tenga piso libre
  const F = m.fisica;
  let mejor = null;
  for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
    const o = new V(np.x + dx, 4, np.z + dz), d = new V(np.x - o.x, np.y - 4, np.z - o.z);
    const h = F.Raycast(new V(o.x, 5, o.z), new V(np.x - o.x, np.y - 5, np.z - o.z), 20);
    if (h && h.transform === nb) { mejor = o; break; }
  }
  if (!mejor) mejor = new V(np.x + 6, 4, np.z);
  pl.position = mejor;
  const ps = pl.GetComponent('PlayerScript');
  const yaw = Math.atan2(np.x - mejor.x, np.z - mejor.z) * 180 / Math.PI;
  ps.playerRotation = window.__baldi.THREE ? new window.__baldi.THREE.Quaternion().setFromEuler(new window.__baldi.THREE.Euler(0, yaw * Math.PI / 180, 0, 'YXZ')) : ps.playerRotation;
  return { nb: nb.name, np: np.toArray().map((x) => +x.toFixed(1)), pl: mejor.toArray().map((x) => +x.toFixed(1)), tag: nb.tag };
})()
