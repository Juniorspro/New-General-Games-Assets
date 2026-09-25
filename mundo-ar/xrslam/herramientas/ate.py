#!/usr/bin/env python3
"""Error absoluto de trayectoria (ATE) contra la verdad de EuRoC.

    ate.py <estimada.tum> <state_groundtruth_estimate0/data.csv> [--sim3]

Empareja cada pose estimada con la verdad más cercana en tiempo (< 10 ms),
alinea las dos trayectorias (Umeyama: rotación + traslación, y escala con
--sim3) y da el RMSE de posición en metros. Es la cuenta estándar de los
papers de VIO; con IMU la escala es observable, así que sin --sim3 es la
comparación justa.
"""
import sys
import numpy as np

def leer_tum(ruta):
    d = np.loadtxt(ruta)
    return d[:, 0], d[:, 1:4]

def leer_euroc(ruta):
    d = np.loadtxt(ruta, delimiter=",", comments="#")
    return d[:, 0] * 1e-9, d[:, 1:4]

def umeyama(a, b, escala):
    """R, t, s que minimizan |b - (s R a + t)|."""
    ma, mb = a.mean(0), b.mean(0)
    A, B = a - ma, b - mb
    U, D, Vt = np.linalg.svd(B.T @ A / len(a))
    S = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        S[2, 2] = -1
    R = U @ S @ Vt
    s = (D * np.diag(S)).sum() / A.var(0).sum() if escala else 1.0
    return R, mb - s * R @ ma, s

def main():
    te, pe = leer_tum(sys.argv[1])
    tg, pg = leer_euroc(sys.argv[2])
    sim3 = "--sim3" in sys.argv
    idx = np.searchsorted(tg, te).clip(1, len(tg) - 1)
    idx = np.where(np.abs(tg[idx - 1] - te) < np.abs(tg[idx] - te), idx - 1, idx)
    ok = np.abs(tg[idx] - te) < 0.01
    a, b = pe[ok], pg[idx[ok]]
    R, t, s = umeyama(a, b, sim3)
    err = np.linalg.norm(b - (s * (R @ a.T).T + t), axis=1)
    largo = np.linalg.norm(np.diff(b, axis=0), axis=1).sum()
    print(f"poses {ok.sum()} · ATE RMSE {np.sqrt((err**2).mean()):.3f} m · mediana {np.median(err):.3f} m · "
          f"máx {err.max():.3f} m · escala {s:.3f} · recorrido {largo:.1f} m")

main()
