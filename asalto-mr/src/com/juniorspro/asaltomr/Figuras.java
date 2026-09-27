package com.juniorspro.asaltomr;

import android.opengl.GLES20;
import android.opengl.Matrix;

import java.nio.FloatBuffer;
import java.util.List;

/**
 * Lo virtual: soldados hechos de cajas (con carrera, puntería y caída), la
 * pistola del jugador, las partículas (chispas, polvo, trozos, humo,
 * fogonazos) y las trazadoras de las balas.
 *
 * Los soldados son siluetas oscuras de uniforme, casco y fusil, como en el
 * video: se leen bien contra un patio a pleno sol.
 */
final class Figuras {
    // un cubo unitario centrado en el origen: 36 vértices (posición + normal)
    private static final float[] CUBO = cubo();

    private FloatBuffer cubo;
    private int progCaja, cAPos, cANor, cUMvp, cUModelo, cUColor, cULuz;
    private int progPunto, pAPos, pATam, pACol, pUVp, pUEscala;
    private int progLinea, lAPos, lACol, lUVp;
    private final FloatBuffer puntos = Gl.bufer(600 * 8);
    private final FloatBuffer lineas = Gl.bufer(512 * 14);

    private final float[] m = new float[16], t = new float[16], mvp = new float[16], pila = new float[16 * 8];
    private int nivel;

    private static float[] cubo() {
        float[][] caras = {
                {1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}};
        float[] v = new float[36 * 6];
        int k = 0;
        for (float[] n : caras) {
            // dos ejes del plano de la cara
            float[] u = Math.abs(n[1]) > 0.5f ? new float[]{1, 0, 0} : new float[]{0, 1, 0};
            float[] w = {n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]};
            float[][] esq = new float[4][3];
            float[][] s = {{-1, -1}, {1, -1}, {1, 1}, {-1, 1}};
            for (int i = 0; i < 4; i++) for (int c = 0; c < 3; c++) esq[i][c] = 0.5f * (n[c] + s[i][0] * u[c] + s[i][1] * w[c]);
            int[] orden = {0, 1, 2, 0, 2, 3};
            for (int i : orden) {
                v[k++] = esq[i][0]; v[k++] = esq[i][1]; v[k++] = esq[i][2];
                v[k++] = n[0]; v[k++] = n[1]; v[k++] = n[2];
            }
        }
        return v;
    }

    void crear() {
        cubo = Gl.bufer(CUBO);
        progCaja = Gl.programa(
                "uniform mat4 uMvp; uniform mat4 uModelo; attribute vec3 aPos; attribute vec3 aNor; varying vec3 vNor;\n"
                        + "void main() { gl_Position = uMvp * vec4(aPos, 1.0); vNor = (uModelo * vec4(aNor, 0.0)).xyz; }",
                "precision mediump float; uniform vec4 uColor; uniform vec3 uLuz; varying vec3 vNor;\n"
                        + "void main() {\n"
                        + "  vec3 n = normalize(vNor);\n"
                        + "  float d = max(dot(n, uLuz), 0.0);\n"
                        + "  float cielo = 0.5 + 0.5 * n.y;\n"
                        + "  vec3 c = uColor.rgb * (0.35 + 0.25 * cielo + 0.75 * d);\n"
                        + "  gl_FragColor = vec4(c, uColor.a);\n"
                        + "}");
        cAPos = Gl.atributo(progCaja, "aPos");
        cANor = Gl.atributo(progCaja, "aNor");
        cUMvp = Gl.uniforme(progCaja, "uMvp");
        cUModelo = Gl.uniforme(progCaja, "uModelo");
        cUColor = Gl.uniforme(progCaja, "uColor");
        cULuz = Gl.uniforme(progCaja, "uLuz");

        progPunto = Gl.programa(
                "uniform mat4 uVp; uniform float uEscala; attribute vec3 aPos; attribute float aTam; attribute vec4 aCol; varying vec4 vCol;\n"
                        + "void main() { gl_Position = uVp * vec4(aPos, 1.0); gl_PointSize = clamp(aTam * uEscala / max(gl_Position.w, 0.05), 1.0, 256.0); vCol = aCol; }",
                "precision mediump float; varying vec4 vCol;\n"
                        + "void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p); if (r > 1.0) discard;\n"
                        + "  gl_FragColor = vec4(vCol.rgb, vCol.a * (1.0 - r * r)); }");
        pAPos = Gl.atributo(progPunto, "aPos");
        pATam = Gl.atributo(progPunto, "aTam");
        pACol = Gl.atributo(progPunto, "aCol");
        pUVp = Gl.uniforme(progPunto, "uVp");
        pUEscala = Gl.uniforme(progPunto, "uEscala");

        progLinea = Gl.programa(
                "uniform mat4 uVp; attribute vec3 aPos; attribute vec4 aCol; varying vec4 vCol;\n"
                        + "void main() { gl_Position = uVp * vec4(aPos, 1.0); vCol = aCol; }",
                "precision mediump float; varying vec4 vCol; void main() { gl_FragColor = vCol; }");
        lAPos = Gl.atributo(progLinea, "aPos");
        lACol = Gl.atributo(progLinea, "aCol");
        lUVp = Gl.uniforme(progLinea, "uVp");
    }

    // ── cajas con una pila de matrices chiquita ──

    private void empujar() { System.arraycopy(m, 0, pila, nivel++ * 16, 16); }

    private void sacar() { System.arraycopy(pila, --nivel * 16, m, 0, 16); }

    private void mover(float x, float y, float z) { Matrix.translateM(m, 0, x, y, z); }

    private void girarX(float rad) { Matrix.rotateM(m, 0, (float) Math.toDegrees(rad), 1, 0, 0); }

    private void girarY(float rad) { Matrix.rotateM(m, 0, (float) Math.toDegrees(rad), 0, 1, 0); }

    private void girarZ(float rad) { Matrix.rotateM(m, 0, (float) Math.toDegrees(rad), 0, 0, 1); }

    private float[] vp;

    private void empezarCajas(float[] vp) {
        this.vp = vp;
        GLES20.glUseProgram(progCaja);
        cubo.position(0);
        GLES20.glVertexAttribPointer(cAPos, 3, GLES20.GL_FLOAT, false, 24, cubo);
        cubo.position(3);
        GLES20.glVertexAttribPointer(cANor, 3, GLES20.GL_FLOAT, false, 24, cubo);
        GLES20.glEnableVertexAttribArray(cAPos);
        GLES20.glEnableVertexAttribArray(cANor);
        GLES20.glUniform3f(cULuz, 0.37f, 0.84f, 0.4f);
    }

    private void terminarCajas() {
        GLES20.glDisableVertexAttribArray(cAPos);
        GLES20.glDisableVertexAttribArray(cANor);
    }

    /** Una caja de lado (sx, sy, sz) centrada en (x, y, z) del marco actual. */
    private void caja(float x, float y, float z, float sx, float sy, float sz, float r, float g, float b, float a) {
        System.arraycopy(m, 0, t, 0, 16);
        Matrix.translateM(t, 0, x, y, z);
        Matrix.scaleM(t, 0, sx, sy, sz);
        Matrix.multiplyMM(mvp, 0, vp, 0, t, 0);
        GLES20.glUniformMatrix4fv(cUMvp, 1, false, mvp, 0);
        // escala no uniforme: la normal se corrige en el shader con normalize (aproximado, alcanza)
        GLES20.glUniformMatrix4fv(cUModelo, 1, false, t, 0);
        GLES20.glUniform4f(cUColor, r, g, b, a);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 36);
    }

    // colores del uniforme
    private static final float UR = 0.16f, UG = 0.17f, UB = 0.12f;   // verde oliva muy oscuro
    private static final float PR = 0.10f, PG = 0.10f, PB = 0.09f;   // pantalón / botas
    private static final float CR = 0.07f, CG = 0.08f, CB = 0.06f;   // casco

    void dibujarSoldados(List<Juego.Soldado> soldados, float[] vp) {
        empezarCajas(vp);
        boolean mezcla = false;
        for (Juego.Soldado s : soldados) {
            float a = 1f - s.desvanecer;
            if (a <= 0) continue;
            if (a < 1 && !mezcla) {
                GLES20.glEnable(GLES20.GL_BLEND);
                GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
                mezcla = true;
            }
            Matrix.setIdentityM(m, 0);
            mover(s.x, s.y, s.z);
            girarY(s.yaw);
            girarX(s.caida);
            nivel = 0;
            float paso = (float) Math.sin(s.fase), corre = s.estado == Juego.CORRE ? 1f : s.estado == Juego.APUNTA ? 0.15f : 0f;
            float ag = s.agachado;                 // detrás de una cubierta
            float brazos = Math.max(s.apunta, 0.5f * ag);
            boolean cae = s.estado == Juego.CAE || s.estado == Juego.TIRADO;
            float vaiven = cae ? 0.3f : 0;   // al caer, brazos y piernas abiertos
            float saltito = corre * Math.abs((float) Math.cos(s.fase)) * 0.05f;
            mover(0, saltito - 0.5f * ag, 0);   // agachado: la cadera baja 50 cm

            // piernas (cadera a 0.9 m)
            for (int lado = -1; lado <= 1; lado += 2) {
                empujar();
                mover(0.1f * lado, 0.9f, 0);
                girarX(corre * 0.75f * paso * lado + (cae ? -0.3f : 0) - 1.3f * ag);   // muslo al frente
                girarZ(vaiven * 0.4f * lado);
                caja(0, -0.22f, 0, 0.14f, 0.46f, 0.16f, PR, PG, PB, a);
                mover(0, -0.44f, 0);
                girarX(corre * (0.6f + 0.5f * paso * lado) * 0.8f + 2.2f * ag);   // rodilla (agachado: bien doblada)
                caja(0, -0.21f, 0, 0.12f, 0.44f, 0.13f, PR, PG, PB, a);
                caja(0, -0.44f, 0.05f, 0.12f, 0.07f, 0.26f, 0.05f, 0.05f, 0.04f, a);   // bota
                sacar();
            }
            // torso con chaleco
            caja(0, 1.18f, 0, 0.38f, 0.56f, 0.23f, UR, UG, UB, a);
            caja(0, 1.2f, 0.02f, 0.4f, 0.4f, 0.24f, 0.12f, 0.13f, 0.09f, a);
            // cabeza y casco
            empujar();
            mover(0, 1.5f, 0);
            girarX(cae ? 0.5f : 0);
            caja(0, 0.12f, 0, 0.19f, 0.22f, 0.21f, 0.18f, 0.14f, 0.11f, a);
            caja(0, 0.2f, -0.01f, 0.25f, 0.13f, 0.27f, CR, CG, CB, a);
            sacar();
            // brazos (hombro a 1.42 m): corriendo se balancean, apuntando van al frente con el fusil
            for (int lado = -1; lado <= 1; lado += 2) {
                empujar();
                mover(0.25f * lado, 1.42f, 0);
                float adelante = -1.45f * brazos + (1 - brazos) * (-corre * 0.7f * paso * lado - 0.25f);
                girarX(adelante - (cae ? 1.2f : 0));
                girarZ(lado * (0.12f + vaiven) - (lado > 0 ? brazos * 0.15f : -brazos * 0.45f));
                caja(0, -0.16f, 0, 0.12f, 0.34f, 0.13f, UR, UG, UB, a);
                mover(0, -0.32f, 0);
                girarX(-0.5f * (1 - brazos) - 0.2f);
                caja(0, -0.14f, 0, 0.1f, 0.3f, 0.11f, UR, UG, UB, a);
                sacar();
            }
            // el fusil: apuntando, a la altura del hombro; corriendo, cruzado al pecho
            empujar();
            mover(0.08f, 1.32f - 0.12f * (1 - brazos), 0.3f);
            girarX(-0.6f * (1 - brazos));
            girarY(0.9f * (1 - brazos));
            caja(0, 0, 0.1f, 0.05f, 0.08f, 0.72f, 0.04f, 0.04f, 0.04f, a);
            caja(0, -0.08f, 0.1f, 0.04f, 0.14f, 0.06f, 0.04f, 0.04f, 0.04f, a);   // cargador
            if (s.fogonazo > 0) caja(0, 0, 0.5f, 0.12f, 0.12f, 0.18f, 3f, 2.4f, 1.2f, 1f);
            sacar();
        }
        if (mezcla) GLES20.glDisable(GLES20.GL_BLEND);
        terminarCajas();
    }

    /** Dónde está la boca del fusil de un soldado (para el fogonazo y la trazadora). */
    static void bocaSoldado(Juego.Soldado s, float[] salida) {
        float sy = (float) Math.sin(s.yaw), cy = (float) Math.cos(s.yaw);
        float lx = 0.08f, lz = 0.8f;
        salida[0] = s.x + lx * cy + lz * sy;
        salida[1] = s.y + 1.32f;
        salida[2] = s.z - lx * sy + lz * cy;
    }

    /**
     * Dónde va la pistola en la vista: abajo a la derecha, en proporción al
     * campo visual (la cámara del teléfono es angosta: en metros fijos quedaría
     * fuera de cuadro o gigante). Devuelve {x, y, z, escala}.
     */
    static float[] lugarPistola(float[] proy) {
        float z = -0.4f;
        float s = 1.9f / proy[5];                   // como si la vista tuviera ~55° de alto
        return new float[]{0.52f * -z / proy[0], -0.58f * -z / proy[5], z, s};
    }

    /** La boca de la pistola en el espacio de la vista (de ahí sale la trazadora y el fogonazo). */
    static float[] bocaPistola(float[] proy) {
        float[] l = lugarPistola(proy);
        return new float[]{l[0], l[1] + 0.028f * l[3], l[2] - 0.14f * l[3]};
    }

    /**
     * La pistola, en el espacio de la vista (pegada a la cámara/ojo).
     * @param proy la proyección del ojo (con su corrimiento de IPD)
     */
    void dibujarPistola(float[] proy, float retroceso, float recarga, float t) {
        float[] l = lugarPistola(proy);
        empezarCajas(proy);
        Matrix.setIdentityM(m, 0);
        float bamboleo = (float) Math.sin(t * 1.7f) * 0.004f;
        mover(l[0], l[1] + (bamboleo - recarga * 0.12f) * l[3], l[2] + retroceso * 0.05f * l[3]);
        Matrix.scaleM(m, 0, l[3], l[3], l[3]);
        girarX(retroceso * 0.35f - recarga * 0.9f);
        girarY(0.05f);
        // corredera, armazón, cañón, empuñadura, guardamonte
        caja(0, 0.025f, -0.02f, 0.034f, 0.035f, 0.2f, 0.09f, 0.09f, 0.1f, 1);
        caja(0, 0.0f, 0.0f, 0.03f, 0.025f, 0.17f, 0.05f, 0.05f, 0.055f, 1);
        caja(0, 0.028f, -0.125f, 0.014f, 0.014f, 0.03f, 0.02f, 0.02f, 0.02f, 1);
        empujar();
        mover(0, -0.05f, 0.055f);
        girarX(0.28f);
        caja(0, -0.01f, 0, 0.03f, 0.1f, 0.045f, 0.04f, 0.035f, 0.035f, 1);
        sacar();
        caja(0, -0.025f, -0.01f, 0.012f, 0.03f, 0.05f, 0.04f, 0.04f, 0.045f, 1);
        // la mano (un guante oscuro)
        caja(0.008f, -0.06f, 0.07f, 0.05f, 0.08f, 0.07f, 0.12f, 0.1f, 0.09f, 1);
        terminarCajas();
    }

    // ── partículas ──

    void dibujarParticulas(List<Juego.Particula> ps, float[] vp, float escalaPx) {
        if (ps.isEmpty()) return;
        puntos.position(0);
        int n = 0;
        for (Juego.Particula p : ps) {
            if (n >= 600) break;
            float f = p.vida / p.vidaMax;
            float r, g, b, a;
            switch (p.tipo) {
                case Juego.P_CHISPA: r = 1f; g = 0.75f; b = 0.3f; a = f; break;
                case Juego.P_POLVO: r = 0.55f; g = 0.47f; b = 0.36f; a = 0.55f * f; break;
                case Juego.P_TROZO: r = 0.07f; g = 0.06f; b = 0.05f; a = Math.min(1f, f * 3); break;
                case Juego.P_FOGONAZO: r = 1f; g = 0.85f; b = 0.45f; a = 1f; break;
                default: r = 0.75f; g = 0.75f; b = 0.72f; a = 0.35f * f;   // humo
            }
            puntos.put(p.x).put(p.y).put(p.z).put(p.tam).put(r).put(g).put(b).put(a);
            n++;
        }
        GLES20.glUseProgram(progPunto);
        GLES20.glUniformMatrix4fv(pUVp, 1, false, vp, 0);
        GLES20.glUniform1f(pUEscala, escalaPx);
        puntos.position(0);
        GLES20.glVertexAttribPointer(pAPos, 3, GLES20.GL_FLOAT, false, 32, puntos);
        puntos.position(3);
        GLES20.glVertexAttribPointer(pATam, 1, GLES20.GL_FLOAT, false, 32, puntos);
        puntos.position(4);
        GLES20.glVertexAttribPointer(pACol, 4, GLES20.GL_FLOAT, false, 32, puntos);
        GLES20.glEnableVertexAttribArray(pAPos);
        GLES20.glEnableVertexAttribArray(pATam);
        GLES20.glEnableVertexAttribArray(pACol);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        GLES20.glDrawArrays(GLES20.GL_POINTS, 0, n);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(pAPos);
        GLES20.glDisableVertexAttribArray(pATam);
        GLES20.glDisableVertexAttribArray(pACol);
    }

    // ── las rutas de la IA (para ver qué piensan) ──

    void dibujarRutas(List<Juego.Soldado> ss, float[] vp) {
        lineas.position(0);
        int n = 0;
        for (Juego.Soldado s : ss) {
            if (s.ruta == null || !Juego.enPie(s)) continue;
            float ax = s.x, ay = s.y + 0.06f, az = s.z;
            boolean cubierta = s.tactica == 1;
            for (int j = s.rutaI; j * 3 < s.ruta.length && n < 500; j++) {
                float bx = s.ruta[j * 3], by = s.ruta[j * 3 + 1] + 0.06f, bz = s.ruta[j * 3 + 2];
                float r = cubierta ? 1f : 1f, g = cubierta ? 0.85f : 0.4f, b = cubierta ? 0.2f : 0.3f;
                lineas.put(ax).put(ay).put(az).put(r).put(g).put(b).put(0.9f);
                lineas.put(bx).put(by).put(bz).put(r).put(g).put(b).put(0.9f);
                ax = bx; ay = by; az = bz;
                n++;
            }
        }
        if (n == 0) return;
        GLES20.glUseProgram(progLinea);
        GLES20.glUniformMatrix4fv(lUVp, 1, false, vp, 0);
        lineas.position(0);
        GLES20.glVertexAttribPointer(lAPos, 3, GLES20.GL_FLOAT, false, 28, lineas);
        lineas.position(3);
        GLES20.glVertexAttribPointer(lACol, 4, GLES20.GL_FLOAT, false, 28, lineas);
        GLES20.glEnableVertexAttribArray(lAPos);
        GLES20.glEnableVertexAttribArray(lACol);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        GLES20.glLineWidth(4f);
        GLES20.glDrawArrays(GLES20.GL_LINES, 0, n * 2);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(lAPos);
        GLES20.glDisableVertexAttribArray(lACol);
    }

    // ── trazadoras ──

    void dibujarTrazos(List<Juego.Trazo> ts, float[] vp) {
        if (ts.isEmpty()) return;
        lineas.position(0);
        int n = 0;
        for (Juego.Trazo tr : ts) {
            if (n >= 64) break;
            float a = Math.min(1f, tr.vida * 14f);
            float r = tr.enemigo ? 1f : 1f, g = tr.enemigo ? 0.55f : 0.85f, b = tr.enemigo ? 0.3f : 0.5f;
            // sólo el tramo final (una bala, no un láser)
            float x0 = tr.x0 + (tr.x1 - tr.x0) * 0.25f, y0 = tr.y0 + (tr.y1 - tr.y0) * 0.25f, z0 = tr.z0 + (tr.z1 - tr.z0) * 0.25f;
            lineas.put(x0).put(y0).put(z0).put(r).put(g).put(b).put(0f);
            lineas.put(tr.x1).put(tr.y1).put(tr.z1).put(r).put(g).put(b).put(a);
            n++;
        }
        GLES20.glUseProgram(progLinea);
        GLES20.glUniformMatrix4fv(lUVp, 1, false, vp, 0);
        lineas.position(0);
        GLES20.glVertexAttribPointer(lAPos, 3, GLES20.GL_FLOAT, false, 28, lineas);
        lineas.position(3);
        GLES20.glVertexAttribPointer(lACol, 4, GLES20.GL_FLOAT, false, 28, lineas);
        GLES20.glEnableVertexAttribArray(lAPos);
        GLES20.glEnableVertexAttribArray(lACol);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE);
        GLES20.glDepthMask(false);
        GLES20.glLineWidth(3f);
        GLES20.glDrawArrays(GLES20.GL_LINES, 0, n * 2);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(lAPos);
        GLES20.glDisableVertexAttribArray(lACol);
    }
}
