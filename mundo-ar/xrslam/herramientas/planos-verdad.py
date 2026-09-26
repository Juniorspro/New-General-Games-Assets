#!/usr/bin/env python3
"""Lleva los planos detectados al marco de la verdad de EuRoC.

    planos-verdad.py <salida de planos-euroc> <state_groundtruth_estimate0/data.csv>

Alinea la trayectoria estimada con la real (Umeyama, sin escala, como el
ATE) y transforma los planos con esa misma alineación. En la sala Vicon de
EuRoC el origen de la verdad está en el piso, con z hacia arriba: el piso
detectado tiene que dar altura ~0 y las paredes, normales horizontales.
"""
import json, sys
import numpy as np
sys.path.insert(0, __file__.rsplit("/", 1)[0])
carpeta, gt = sys.argv[1], sys.argv[2]
e = np.loadtxt(carpeta + "/trayectoria.tum"); g = np.loadtxt(gt, delimiter=",", comments="#")
tg = g[:, 0] * 1e-9
idx = np.clip(np.searchsorted(tg, e[:, 0]), 1, len(tg) - 1)
idx = np.where(np.abs(tg[idx - 1] - e[:, 0]) < np.abs(tg[idx] - e[:, 0]), idx - 1, idx)
ok = np.abs(tg[idx] - e[:, 0]) < 0.01
a, b = e[ok, 1:4], g[idx[ok], 1:4]
ma, mb = a.mean(0), b.mean(0)
U, D, Vt = np.linalg.svd((b - mb).T @ (a - ma) / len(a))
S = np.eye(3); S[2, 2] = -1 if np.linalg.det(U) * np.linalg.det(Vt) < 0 else 1
R = U @ S @ Vt; t = mb - R @ ma
err = np.linalg.norm(b - (a @ R.T + t), axis=1)
print(f"trayectoria: ATE {np.sqrt((err**2).mean()):.3f} m · el dron voló entre z={b[:,2].min():.2f} y z={b[:,2].max():.2f} m (verdad)")
for p in json.load(open(carpeta + "/planos.json")):
    pol = np.array(p["poligono"]) @ R.T + t
    n = R @ np.array(p["normal"])
    if p["tipo"] == "pared":
        d = -n @ pol.mean(0)
        print(f"  pared      {p['puntos']:4d} pts · normal (verdad) [{n[0]:+.2f} {n[1]:+.2f} {n[2]:+.2f}] · a {abs(d):.2f} m del origen · alto z {pol[:,2].min():.2f}..{pol[:,2].max():.2f}")
    else:
        print(f"  {p['tipo']:10s} {p['puntos']:4d} pts · altura (verdad) {pol[:,2].mean():+.3f} m · inclinación {np.degrees(np.arccos(abs(n[2]))):.1f}° · {p['area']:.2f} m²")
