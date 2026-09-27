package com.juniorspro.asaltomr;

/** El entorno del juego = lo escaneado (el volumen actual del hilo de escaneo). */
final class EntornoReal implements Juego.Entorno, Juego.EntornoNormales {
    private final Escaneo escaneo;

    EntornoReal(Escaneo e) { escaneo = e; }

    @Override
    public float suelo(float x, float z, float yArriba, float yAbajo) { return escaneo.tsdf.suelo(x, z, yArriba, yAbajo); }

    @Override
    public float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float max) {
        return escaneo.tsdf.rayo(ox, oy, oz, dx, dy, dz, max);
    }

    @Override
    public boolean ocupado(float x, float y, float z) { return escaneo.tsdf.ocupado(x, y, z); }

    @Override
    public boolean normal(float x, float y, float z, float[] n) { return escaneo.tsdf.normal(x, y, z, n); }
}
