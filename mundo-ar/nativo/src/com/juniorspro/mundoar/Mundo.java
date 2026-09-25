package com.juniorspro.mundoar;

import android.opengl.GLES20;
import android.opengl.Matrix;

import com.google.ar.core.Anchor;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * El mundo 3D. Todo cuelga de "anclas" de ARCore: un punto del espacio real
 * que ARCore corrige a medida que entiende mejor la habitación. Si el 6DoF
 * anda, los cubos se quedan quietos EN EL CUARTO mientras caminás alrededor.
 *
 *  · el anillo: ocho blancos flotando alrededor de donde arrancaste, para
 *    probar el seguimiento apenas abre, sin buscar el piso;
 *  · la arena: al tocar el piso detectado aparece una plataforma con pilares,
 *    un tótem que gira y blancos encima.
 *
 * Tocar un blanco suma puntos (con combo si venís rápido); el blanco estalla
 * y reaparece en otro lugar.
 */
final class Mundo {
    static final class Objeto {
        Anchor ancla;
        float x, y, z, tam;
        float sx = 1, sy = 1, sz = 1;          // escala por eje (pilares, plataforma)
        float r, g, b, brillo;
        boolean blanco;
        float giro, fase;
        float estalla = -1;                     // segundos desde que lo tocaron
        float aparece = 1;                      // 0..1 al reaparecer
        float rango = 0.35f, altoMin = 0.15f, altoMax = 0.6f;   // dónde puede reaparecer
    }

    final List<Objeto> objetos = new ArrayList<>();
    private final Random azar = new Random(7);
    private Anchor anillo, arena;
    int puntos, combo, tocados;
    private float ultimoAcierto = -99;
    private final float[] ancla = new float[16], modelo = new float[16], tmp = new float[16], v = new float[4], w = new float[4];

    boolean hayAnillo() { return anillo != null; }
    boolean hayArena() { return arena != null; }

    void reiniciar() {
        for (Objeto o : objetos) if (o.ancla != null && o.ancla != anillo && o.ancla != arena) o.ancla.detach();
        if (anillo != null) anillo.detach();
        if (arena != null) arena.detach();
        anillo = arena = null;
        objetos.clear();
        puntos = combo = tocados = 0;
    }

    /** El anillo de blancos alrededor de la cámara, alineado con la gravedad. */
    void ponerAnillo(Session s, Pose camara) {
        anillo = s.createAnchor(Pose.makeTranslation(camara.tx(), camara.ty(), camara.tz()));
        for (int i = 0; i < 8; i++) {
            double a = i / 8.0 * Math.PI * 2;
            Objeto o = blanco(anillo, (float) Math.cos(a) * 1.4f, -0.25f + azar.nextFloat() * 0.5f, (float) Math.sin(a) * 1.4f, 0.16f);
            o.rango = 1.6f; o.altoMin = -0.35f; o.altoMax = 0.35f;
            // Del anillo, los de adelante dorados y los de atrás violetas: se ve hacia dónde mirás.
            if (i % 2 == 0) colorear(o, 0.85f, 0.66f, 0.25f); else colorear(o, 0.48f, 0.24f, 1f);
        }
    }

    /** La arena sobre el piso: plataforma, pilares, tótem y blancos. */
    void ponerArena(Anchor a) {
        arena = a;
        Objeto piso = fijo(a, 0, 0.015f, 0, 1f, 0.12f, 0.07f, 0.22f);
        piso.sx = 1.1f; piso.sy = 0.03f; piso.sz = 1.1f;
        for (int i = 0; i < 4; i++) {
            float px = (i % 2 == 0 ? -0.5f : 0.5f), pz = (i < 2 ? -0.5f : 0.5f);
            Objeto p = fijo(a, px, 0.28f, pz, 1f, 0.8f, 0.62f, 0.25f);
            p.sx = 0.06f; p.sy = 0.52f; p.sz = 0.06f;
            Objeto luz = fijo(a, px, 0.58f, pz, 0.09f, 0.55f, 0.9f, 1f);
            luz.brillo = 0.35f; luz.giro = 1.5f;
        }
        for (int i = 0; i < 3; i++) {
            Objeto t = fijo(a, 0, 0.12f + i * 0.17f, 0, 0.14f - i * 0.03f, 0.48f, 0.24f, 1f);
            t.giro = (i % 2 == 0 ? 0.9f : -1.3f); t.brillo = 0.1f * i;
        }
        for (int i = 0; i < 5; i++) {
            Objeto o = blanco(a, 0, 0, 0, 0.12f);
            reubicar(o);
            if (i % 2 == 0) colorear(o, 0.85f, 0.66f, 0.25f); else colorear(o, 0.48f, 0.24f, 1f);
        }
    }

    /** Un blanco suelto sobre el piso, donde tocaste. */
    void ponerBlanco(Anchor a) {
        Objeto o = blanco(a, 0, 0.2f, 0, 0.12f);
        o.rango = 0.2f; o.altoMin = 0.15f; o.altoMax = 0.35f;
        colorear(o, azar.nextBoolean() ? 0.85f : 0.48f, azar.nextBoolean() ? 0.66f : 0.24f, 1f);
    }

    int cantidadBlancos() { int n = 0; for (Objeto o : objetos) if (o.blanco) n++; return n; }

    private Objeto blanco(Anchor a, float x, float y, float z, float tam) {
        Objeto o = fijo(a, x, y, z, tam, 1, 1, 1);
        o.blanco = true;
        o.giro = 1.2f + azar.nextFloat();
        o.fase = azar.nextFloat() * 6.28f;
        return o;
    }

    private Objeto fijo(Anchor a, float x, float y, float z, float tam, float r, float g, float b) {
        Objeto o = new Objeto();
        o.ancla = a; o.x = x; o.y = y; o.z = z; o.tam = tam;
        colorear(o, r, g, b);
        objetos.add(o);
        return o;
    }

    private static void colorear(Objeto o, float r, float g, float b) { o.r = r; o.g = g; o.b = b; }

    private void reubicar(Objeto o) {
        double a = azar.nextDouble() * Math.PI * 2;
        float d = (float) (0.3 + 0.7 * azar.nextDouble()) * o.rango;
        o.x = (float) Math.cos(a) * d;
        o.z = (float) Math.sin(a) * d;
        o.y = o.altoMin + azar.nextFloat() * (o.altoMax - o.altoMin);
        o.aparece = 0;
    }

    /** La matriz de un objeto en el tiempo t. Devuelve false si su ancla no sigue. */
    private boolean matriz(Objeto o, float t, float[] out) {
        if (o.ancla.getTrackingState() != TrackingState.TRACKING) return false;
        o.ancla.getPose().toMatrix(ancla, 0);
        float y = o.y + (o.blanco ? 0.025f * (float) Math.sin(t * 2.2f + o.fase) : 0);
        Matrix.setIdentityM(tmp, 0);
        Matrix.translateM(tmp, 0, o.x, y, o.z);
        if (o.giro != 0) {
            Matrix.rotateM(tmp, 0, (float) Math.toDegrees(t * o.giro + o.fase), 0, 1, 0);
            if (o.blanco) Matrix.rotateM(tmp, 0, 35f, 1, 0, 1);
        }
        float esc = o.tam;
        if (o.estalla >= 0) esc *= 1 + o.estalla * 3.2f;
        else if (o.aparece < 1) esc *= salida(o.aparece);
        Matrix.scaleM(tmp, 0, esc * o.sx, esc * o.sy, esc * o.sz);
        Matrix.multiplyMM(out, 0, ancla, 0, tmp, 0);
        return true;
    }

    private static float salida(float k) { float c = 1.7f; return 1 + (c + 1) * (float) Math.pow(k - 1, 3) + c * (float) Math.pow(k - 1, 2); }

    void actualizar(float dt) {
        for (Objeto o : objetos) {
            if (o.estalla >= 0) {
                o.estalla += dt;
                if (o.estalla > 0.28f) { o.estalla = -1; reubicar(o); }
            } else if (o.aparece < 1) o.aparece = Math.min(1, o.aparece + dt * 3.5f);
        }
    }

    void dibujar(Cubo cubo, float[] vistaProy, float t) {
        cubo.empezar();
        // Primero lo opaco; después lo que estalla, translúcido y sin escribir profundidad.
        for (int pasada = 0; pasada < 2; pasada++) {
            if (pasada == 1) {
                GLES20.glEnable(GLES20.GL_BLEND);
                GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE);
                GLES20.glDepthMask(false);
            }
            for (Objeto o : objetos) {
                boolean translucido = o.estalla >= 0;
                if (translucido != (pasada == 1)) continue;
                if (!matriz(o, t, modelo)) continue;
                float alfa = translucido ? Math.max(0, 1 - o.estalla / 0.28f) : 1;
                float brillo = o.brillo + (translucido ? 0.6f : 0) + (o.blanco ? 0.08f * (float) Math.sin(t * 4 + o.fase) + 0.08f : 0);
                cubo.dibujar(vistaProy, modelo, o.r, o.g, o.b, brillo, alfa);
            }
        }
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        cubo.terminar();
    }

    /**
     * El rayo del toque contra los blancos. `inversa` es la inversa de
     * proyección × vista; (nx, ny) el toque en coordenadas de -1 a 1.
     * Devuelve los puntos ganados (0 si no tocó nada).
     */
    int tocar(float[] inversa, float nx, float ny, float t) {
        float[] cerca = desproyectar(inversa, nx, ny, -1, new float[3]);
        float[] lejos = desproyectar(inversa, nx, ny, 1, new float[3]);
        float dx = lejos[0] - cerca[0], dy = lejos[1] - cerca[1], dz = lejos[2] - cerca[2];
        float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        dx /= l; dy /= l; dz /= l;
        Objeto mejor = null;
        float mejorT = Float.MAX_VALUE;
        for (Objeto o : objetos) {
            if (!o.blanco || o.estalla >= 0 || !matriz(o, t, modelo)) continue;
            float cx = modelo[12] - cerca[0], cy = modelo[13] - cerca[1], cz = modelo[14] - cerca[2];
            float proy = cx * dx + cy * dy + cz * dz;
            if (proy < 0) continue;
            float d2 = cx * cx + cy * cy + cz * cz - proy * proy;
            // Radio generoso: un dedo es más grande que un cubo de 12 cm a dos metros.
            float r = o.tam * 1.1f + 0.03f;
            if (d2 < r * r && proy < mejorT) { mejorT = proy; mejor = o; }
        }
        if (mejor == null) return 0;
        mejor.estalla = 0;
        combo = (t - ultimoAcierto < 1.6f) ? Math.min(5, combo + 1) : 1;
        ultimoAcierto = t;
        int gano = 10 * combo;
        puntos += gano;
        tocados++;
        return gano;
    }

    private float[] desproyectar(float[] inv, float x, float y, float z, float[] out) {
        v[0] = x; v[1] = y; v[2] = z; v[3] = 1;
        Matrix.multiplyMV(w, 0, inv, 0, v, 0);
        out[0] = w[0] / w[3]; out[1] = w[1] / w[3]; out[2] = w[2] / w[3];
        return out;
    }
}
