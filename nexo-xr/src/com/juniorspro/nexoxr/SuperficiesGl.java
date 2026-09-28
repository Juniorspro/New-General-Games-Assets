package com.juniorspro.nexoxr;

import android.opengl.GLES20;

import java.nio.FloatBuffer;

/**
 * EL DIBUJO DEL ESPACIO: lo que ARCore encontró, en el mundo.
 *
 *  - los PLANOS: una grilla fina y un borde que brilla (a 2.5 cm del borde de
 *    verdad: la distancia al borde va en metros, exacta, en cada triángulo) y un
 *    halo que se apaga hacia afuera;
 *  - TU MESA, marcada especial: puntitos cada 5 cm, el borde que late, una luz
 *    que la recorre y, al confirmarla, una onda que sale de donde mirabas;
 *  - la NUBE DE PUNTOS mientras se escanea (lo que ARCore sigue en esta foto),
 *    que titila;
 *  - una ETIQUETA apoyada sobre la mesa ("Tu mesa"), una textura.
 *
 * Todo llega en el mundo de ARCore y se lleva al escritorio con la matriz
 * uModelo (Seguimiento.desdeMundo): así el ancla corrige también esto.
 */
final class SuperficiesGl {
    static final int OTRO = 0, CANDIDATA = 1, MESA = 2, CUARTO = 3;
    /** Hasta cuántos lados por plano (ARCore da polígonos de unos 10 a 40). */
    static final int MAX_LADOS = 96;
    /** El halo, hacia afuera del borde (m). */
    static final float HALO = 0.06f;

    private int progPlano, pVp, pModelo, pColor, pColor2, pAlfa, pT, pMesa, pOnda, pPaso, pPos, pDato;
    private int progPuntos, qVp, qModelo, qT, qTam, qColor, qAlfa, qPos;
    private int progEtq, eVp, eModelo, eC, eR, eU, eTex, eAlfa, ePos;
    private final FloatBuffer malla = Gl.bufer(MAX_LADOS * 9 * 6);
    private final float[] vertices = new float[MAX_LADOS * 9 * 6];
    private FloatBuffer nube = Gl.bufer(4 * 1024);
    private final FloatBuffer cuadro = Gl.bufer(new float[]{-0.5f, -0.5f, 0.5f, -0.5f, -0.5f, 0.5f, 0.5f, 0.5f});

    static final String VS_PLANO =
            "attribute vec3 aPos; attribute vec3 aDato;\n"
                    + "uniform mat4 uVp; uniform mat4 uModelo;\n"
                    + "varying vec3 vDato;\n"
                    + "void main() { vDato = aDato; gl_Position = uVp * uModelo * vec4(aPos, 1.0); }";

    static final String FS_PLANO =
            "precision mediump float;\n"
                    // vDato.x: la distancia al borde (m; + adentro, − en el halo); yz: el punto en el marco del plano (m)
                    + "varying vec3 vDato;\n"
                    + "uniform vec3 uColor; uniform vec3 uColor2; uniform float uAlfa; uniform float uT; uniform float uMesa; uniform float uPaso;\n"
                    + "uniform vec3 uOnda;\n"
                    + "void main() {\n"
                    + "  float d = vDato.x;\n"
                    + "  vec2 p = vDato.yz;\n"
                    + "  vec2 g = abs(fract(p / uPaso + 0.5) - 0.5) * uPaso;\n"
                    + "  float linea = 1.0 - smoothstep(0.0012, 0.0035, min(g.x, g.y));\n"
                    + "  float punto = 1.0 - smoothstep(0.0025, 0.0055, length(g));\n"
                    + "  float borde = 1.0 - smoothstep(0.0, 0.025, d);\n"
                    + "  float pulso = 0.72 + 0.28 * sin(uT * 3.2);\n"
                    + "  float barre = exp(-pow((p.x + p.y) * 2.4 - mod(uT * 1.5, 9.0) + 4.5, 2.0) * 5.0);\n"
                    + "  float onda = 0.0;\n"
                    + "  if (uOnda.z > 0.0) { float r = length(p - uOnda.xy); onda = exp(-pow((r - uOnda.z) * 12.0, 2.0)) * (1.0 - clamp(uOnda.z / 1.8, 0.0, 1.0)); }\n"
                    + "  vec3 c = mix(uColor2, uColor, smoothstep(0.0, 0.35, d));\n"
                    + "  float a;\n"
                    + "  if (d < 0.0) {\n"
                    + "    float h = 1.0 + d / " + HALO + ";\n"
                    + "    a = 0.55 * h * h * pulso + 0.6 * onda;\n"
                    + "  } else {\n"
                    + "    a = 0.05 + 0.16 * linea * (1.0 - uMesa) + 0.5 * punto * uMesa + 0.06 * uMesa\n"
                    + "      + 0.95 * borde * pulso + 0.3 * barre * (0.35 + uMesa) + onda;\n"
                    + "  }\n"
                    + "  gl_FragColor = vec4(c * (1.0 + onda + 0.4 * barre), clamp(a, 0.0, 1.0) * uAlfa);\n"
                    + "}";

    static final String VS_PUNTOS =
            "attribute vec4 aPos;\n"
                    + "uniform mat4 uVp; uniform mat4 uModelo; uniform float uTam; uniform float uT;\n"
                    + "varying float vA;\n"
                    + "void main() {\n"
                    + "  gl_Position = uVp * uModelo * vec4(aPos.xyz, 1.0);\n"
                    + "  gl_PointSize = clamp(uTam / max(0.25, gl_Position.w), 2.0, 12.0);\n"
                    + "  float f = fract(sin(dot(aPos.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n"
                    + "  vA = clamp(aPos.w, 0.0, 1.0) * (0.55 + 0.45 * sin(uT * 4.0 + f * 6.2831));\n"
                    + "}";

    static final String FS_PUNTOS =
            "precision mediump float;\n"
                    + "varying float vA; uniform vec3 uColor; uniform float uAlfa;\n"
                    + "void main() {\n"
                    + "  vec2 c = gl_PointCoord - 0.5; float r = length(c);\n"
                    + "  if (r > 0.5) discard;\n"
                    + "  gl_FragColor = vec4(uColor * (1.25 - r), (1.0 - smoothstep(0.12, 0.5, r)) * vA * uAlfa);\n"
                    + "}";

    static final String VS_ETIQUETA =
            "attribute vec2 aPos;\n"
                    + "uniform mat4 uVp; uniform mat4 uModelo; uniform vec3 uC; uniform vec3 uR; uniform vec3 uU;\n"
                    + "varying vec2 vTex;\n"
                    + "void main() { vTex = vec2(aPos.x + 0.5, 0.5 - aPos.y); gl_Position = uVp * uModelo * vec4(uC + uR * aPos.x + uU * aPos.y, 1.0); }";

    static final String FS_ETIQUETA =
            "precision mediump float;\n"
                    + "varying vec2 vTex; uniform sampler2D uTex; uniform float uAlfa;\n"
                    // la textura viene premultiplicada (un Bitmap de Android)
                    + "void main() { gl_FragColor = texture2D(uTex, vTex) * uAlfa; }";

    void crear() {
        progPlano = Gl.programa(VS_PLANO, FS_PLANO);
        pPos = Gl.atributo(progPlano, "aPos"); pDato = Gl.atributo(progPlano, "aDato");
        pVp = Gl.uniforme(progPlano, "uVp"); pModelo = Gl.uniforme(progPlano, "uModelo");
        pColor = Gl.uniforme(progPlano, "uColor"); pColor2 = Gl.uniforme(progPlano, "uColor2");
        pAlfa = Gl.uniforme(progPlano, "uAlfa"); pT = Gl.uniforme(progPlano, "uT"); pMesa = Gl.uniforme(progPlano, "uMesa");
        pOnda = Gl.uniforme(progPlano, "uOnda"); pPaso = Gl.uniforme(progPlano, "uPaso");
        progPuntos = Gl.programa(VS_PUNTOS, FS_PUNTOS);
        qPos = Gl.atributo(progPuntos, "aPos");
        qVp = Gl.uniforme(progPuntos, "uVp"); qModelo = Gl.uniforme(progPuntos, "uModelo"); qT = Gl.uniforme(progPuntos, "uT");
        qTam = Gl.uniforme(progPuntos, "uTam"); qColor = Gl.uniforme(progPuntos, "uColor"); qAlfa = Gl.uniforme(progPuntos, "uAlfa");
        progEtq = Gl.programa(VS_ETIQUETA, FS_ETIQUETA);
        ePos = Gl.atributo(progEtq, "aPos");
        eVp = Gl.uniforme(progEtq, "uVp"); eModelo = Gl.uniforme(progEtq, "uModelo"); eC = Gl.uniforme(progEtq, "uC");
        eR = Gl.uniforme(progEtq, "uR"); eU = Gl.uniforme(progEtq, "uU"); eTex = Gl.uniforme(progEtq, "uTex"); eAlfa = Gl.uniforme(progEtq, "uAlfa");
    }

    // ───────────────────────── la malla de un plano (sin OpenGL: se prueba en la PC) ─────────────────────────

    /**
     * Los triángulos de un plano: un abanico desde el centro (cada triángulo con
     * sus propios vértices: el del centro lleva la distancia de ESE borde, así
     * que interpolada da la distancia exacta al borde) y el halo, una banda de
     * 6 cm hacia afuera con las esquinas unidas (inglete). Cada vértice: posición
     * en el mundo (3) + dato (distancia al borde, x, z del plano). Devuelve
     * cuántos vértices escribió en o.
     */
    static int malla(Mesa.Plano p, float[] o) {
        int n = Math.min(p.lados(), MAX_LADOS);
        if (n < 3) return 0;
        float[] c = new float[2], w = new float[3];
        p.centroLocal(c);
        float area = 0;
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            area += p.poligono[i * 2] * p.poligono[j * 2 + 1] - p.poligono[j * 2] * p.poligono[i * 2 + 1];
        }
        float signo = area >= 0 ? 1 : -1;
        // las normales hacia afuera de cada borde, y el inglete en cada vértice
        float[] nx = new float[n], nz = new float[n];
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            float ex = p.poligono[j * 2] - p.poligono[i * 2], ez = p.poligono[j * 2 + 1] - p.poligono[i * 2 + 1];
            float l = (float) Math.sqrt(ex * ex + ez * ez);
            if (l < 1e-6f) { nx[i] = 0; nz[i] = 0; continue; }
            nx[i] = ez / l * signo; nz[i] = -ex / l * signo;
        }
        float[] mx = new float[n], mz = new float[n];
        for (int i = 0; i < n; i++) {
            int a = (i - 1 + n) % n;
            float sx = nx[a] + nx[i], sz = nz[a] + nz[i], sl = (float) Math.sqrt(sx * sx + sz * sz);
            if (sl < 1e-6f) { mx[i] = nx[i]; mz[i] = nz[i]; continue; }
            sx /= sl; sz /= sl;
            float cosm = sx * nx[i] + sz * nz[i];
            float k = 1 / Math.max(0.35f, cosm);   // el inglete, sin picos en las esquinas muy agudas
            mx[i] = sx * k; mz[i] = sz * k;
        }
        int k = 0;
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            float ax = p.poligono[i * 2], az = p.poligono[i * 2 + 1], bx = p.poligono[j * 2], bz = p.poligono[j * 2 + 1];
            // la distancia del centro a este borde
            float h = Math.max(0, (c[0] - ax) * -nx[i] + (c[1] - az) * -nz[i]);
            k = vertice(p, o, k, c[0], c[1], h, w);
            k = vertice(p, o, k, ax, az, 0, w);
            k = vertice(p, o, k, bx, bz, 0, w);
            // el halo: dos triángulos del borde hacia afuera
            float oax = ax + mx[i] * HALO, oaz = az + mz[i] * HALO, obx = bx + mx[j] * HALO, obz = bz + mz[j] * HALO;
            k = vertice(p, o, k, ax, az, 0, w);
            k = vertice(p, o, k, oax, oaz, -HALO, w);
            k = vertice(p, o, k, bx, bz, 0, w);
            k = vertice(p, o, k, bx, bz, 0, w);
            k = vertice(p, o, k, oax, oaz, -HALO, w);
            k = vertice(p, o, k, obx, obz, -HALO, w);
        }
        return k / 6;
    }

    private static int vertice(Mesa.Plano p, float[] o, int k, float x, float z, float d, float[] w) {
        p.aMundo(x, z, w);
        o[k] = w[0]; o[k + 1] = w[1]; o[k + 2] = w[2];
        o[k + 3] = d; o[k + 4] = x; o[k + 5] = z;
        return k + 6;
    }

    // ───────────────────────── dibujar ─────────────────────────

    /**
     * Un plano. tipo: OTRO / CANDIDATA / MESA / CUARTO; onda: (x, z, radio) en
     * el marco del plano, o null. Aditivo (brilla sobre la cámara), sin escribir
     * la profundidad (las ventanas van arriba).
     */
    void plano(Mesa.Plano p, int tipo, float[] vp, float[] modelo, float alfa, float t, float[] onda) {
        int nv = malla(p, vertices);
        if (nv == 0 || alfa <= 0.001f) return;
        malla.position(0);
        malla.put(vertices, 0, nv * 6).position(0);
        GLES20.glUseProgram(progPlano);
        GLES20.glUniformMatrix4fv(pVp, 1, false, vp, 0);
        GLES20.glUniformMatrix4fv(pModelo, 1, false, modelo, 0);
        switch (tipo) {
            case MESA:   // la mesa: celeste en el medio, un dorado cálido en el borde
                GLES20.glUniform3f(pColor, 0.40f, 0.78f, 1.0f); GLES20.glUniform3f(pColor2, 1.0f, 0.82f, 0.45f); break;
            case CANDIDATA:
                GLES20.glUniform3f(pColor, 0.45f, 0.70f, 1.0f); GLES20.glUniform3f(pColor2, 0.75f, 0.92f, 1.0f); break;
            case CUARTO:
                GLES20.glUniform3f(pColor, 0.55f, 0.50f, 1.0f); GLES20.glUniform3f(pColor2, 0.80f, 0.70f, 1.0f); break;
            default:
                GLES20.glUniform3f(pColor, 0.55f, 0.60f, 0.72f); GLES20.glUniform3f(pColor2, 0.70f, 0.75f, 0.85f);
        }
        GLES20.glUniform1f(pAlfa, alfa * (tipo == OTRO ? 0.35f : 1f));
        GLES20.glUniform1f(pT, t);
        GLES20.glUniform1f(pMesa, tipo == MESA ? 1 : 0);
        GLES20.glUniform1f(pPaso, tipo == MESA ? 0.05f : 0.1f);
        if (onda != null) GLES20.glUniform3f(pOnda, onda[0], onda[1], onda[2]);
        else GLES20.glUniform3f(pOnda, 0, 0, -1);
        malla.position(0);
        GLES20.glVertexAttribPointer(pPos, 3, GLES20.GL_FLOAT, false, 24, malla);
        GLES20.glEnableVertexAttribArray(pPos);
        malla.position(3);
        GLES20.glVertexAttribPointer(pDato, 3, GLES20.GL_FLOAT, false, 24, malla);
        GLES20.glEnableVertexAttribArray(pDato);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE);
        GLES20.glDepthMask(false);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);   // siempre a la vista (también dentro de un entorno con muebles)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, nv);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(pPos);
        GLES20.glDisableVertexAttribArray(pDato);
    }

    /** La nube de puntos (x, y, z, confianza; n puntos), en el mundo de ARCore. */
    void puntos(float[] datos, int n, float[] vp, float[] modelo, float alfa, float t, float tamPx) {
        if (n <= 0 || alfa <= 0.001f) return;
        if (nube.capacity() < n * 4) nube = Gl.bufer(n * 4);
        nube.position(0);
        nube.put(datos, 0, n * 4).position(0);
        GLES20.glUseProgram(progPuntos);
        GLES20.glUniformMatrix4fv(qVp, 1, false, vp, 0);
        GLES20.glUniformMatrix4fv(qModelo, 1, false, modelo, 0);
        GLES20.glUniform1f(qT, t);
        GLES20.glUniform1f(qTam, tamPx);
        GLES20.glUniform3f(qColor, 0.62f, 0.9f, 1f);
        GLES20.glUniform1f(qAlfa, alfa);
        GLES20.glVertexAttribPointer(qPos, 4, GLES20.GL_FLOAT, false, 0, nube);
        GLES20.glEnableVertexAttribArray(qPos);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE);
        GLES20.glDepthMask(false);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDrawArrays(GLES20.GL_POINTS, 0, n);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(qPos);
    }

    /** Una etiqueta (textura premultiplicada) apoyada: centro c, derecha r y "arriba del texto" u ya con su largo (m), en el mundo. */
    void etiqueta(int tex, float[] c, float[] r, float[] u, float[] vp, float[] modelo, float alfa) {
        if (tex == 0 || alfa <= 0.001f) return;
        GLES20.glUseProgram(progEtq);
        GLES20.glUniformMatrix4fv(eVp, 1, false, vp, 0);
        GLES20.glUniformMatrix4fv(eModelo, 1, false, modelo, 0);
        GLES20.glUniform3f(eC, c[0], c[1], c[2]);
        GLES20.glUniform3f(eR, r[0], r[1], r[2]);
        GLES20.glUniform3f(eU, u[0], u[1], u[2]);
        GLES20.glUniform1f(eAlfa, alfa);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex);
        GLES20.glUniform1i(eTex, 0);
        cuadro.position(0);
        GLES20.glVertexAttribPointer(ePos, 2, GLES20.GL_FLOAT, false, 0, cuadro);
        GLES20.glEnableVertexAttribArray(ePos);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(ePos);
    }
}
