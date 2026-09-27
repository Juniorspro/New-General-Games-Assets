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
        if (tinte > 0) { r += (1f - r) * tinte; g *= 1 - tinte; b *= 1 - tinte; }
        GLES20.glUniform4f(cUColor, r, g, b, a);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 36);
    }

    /** 0..1: cuánto se pone rojo lo que se dibuja (el soldado al que le acaban de pegar). */
    private float tinte;

    // colores del uniforme, por tipo: normal (verde oliva muy oscuro), pesado (blindado gris azulado), rápido (arena)
    private float UR, UG, UB, PR, PG, PB, CR, CG, CB, VR, VG, VB;

    private void colores(int tipo) {
        switch (tipo) {
            case Juego.PESADO:
                UR = 0.13f; UG = 0.15f; UB = 0.18f; PR = 0.08f; PG = 0.09f; PB = 0.1f;
                CR = 0.1f; CG = 0.11f; CB = 0.13f; VR = 0.2f; VG = 0.22f; VB = 0.26f;
                break;
            case Juego.RAPIDO:
                UR = 0.42f; UG = 0.36f; UB = 0.24f; PR = 0.25f; PG = 0.22f; PB = 0.16f;
                CR = 0.55f; CG = 0.08f; CB = 0.06f; VR = 0.3f; VG = 0.26f; VB = 0.17f;
                break;
            default:
                UR = 0.16f; UG = 0.17f; UB = 0.12f; PR = 0.10f; PG = 0.10f; PB = 0.09f;
                CR = 0.07f; CG = 0.08f; CB = 0.06f; VR = 0.12f; VG = 0.13f; VB = 0.09f;
        }
    }

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
            colores(s.tipo);
            tinte = s.herido > 0 && Juego.enPie(s) ? Math.min(0.45f, s.herido * 4f) : 0;
            // el pesado es más ancho (blindaje); el rápido, más flaco
            if (s.tipo == Juego.PESADO) Matrix.scaleM(m, 0, 1.22f, 1f, 1.22f);
            else if (s.tipo == Juego.RAPIDO) Matrix.scaleM(m, 0, 0.92f, 1f, 0.92f);
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
            if (s.tipo != Juego.RAPIDO) caja(0, 1.2f, 0.02f, 0.4f, 0.4f, 0.24f, VR, VG, VB, a);
            if (s.tipo == Juego.PESADO) {   // hombreras y placa
                caja(-0.24f, 1.4f, 0, 0.14f, 0.08f, 0.2f, VR, VG, VB, a);
                caja(0.24f, 1.4f, 0, 0.14f, 0.08f, 0.2f, VR, VG, VB, a);
                caja(0, 1.2f, 0.14f, 0.3f, 0.3f, 0.03f, 0.26f, 0.28f, 0.32f, a);
            }
            // cabeza y casco
            empujar();
            mover(0, 1.5f, 0);
            girarX(cae ? 0.5f : 0);
            caja(0, 0.12f, 0, 0.19f, 0.22f, 0.21f, 0.18f, 0.14f, 0.11f, a);
            if (s.tipo == Juego.RAPIDO) caja(0, 0.24f, 0, 0.21f, 0.07f, 0.23f, CR, CG, CB, a);   // boina roja
            else caja(0, 0.2f, -0.01f, 0.25f, 0.13f, 0.27f, CR, CG, CB, a);
            if (s.tipo == Juego.PESADO) caja(0, 0.13f, 0.1f, 0.2f, 0.08f, 0.04f, 0.02f, 0.03f, 0.04f, a);   // visor
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
        tinte = 0;
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
     * Dónde está la boca de cada arma en su modelo (y arriba, z adelante negativo),
     * con el origen en la base de la corredera (arriba y adelante del mango).
     */
    static final float[][] BOCA = {{0.028f, -0.14f}, {0.025f, -0.505f}, {0.04f, -0.565f}, {0.04f, -0.345f}};

    /**
     * Dónde va el arma en la vista: abajo a la derecha, en proporción al
     * campo visual (la cámara del teléfono es angosta: en metros fijos quedaría
     * fuera de cuadro o gigante). Las largas, más al centro y más abajo.
     * Devuelve {x, y, z, escala}.
     */
    static float[] lugarArma(float[] proy, int tipo) {
        boolean larga = tipo != Juego.PISTOLA;
        float z = larga ? -0.5f : -0.4f;
        float s = (larga ? 1.45f : 1.9f) / proy[5];   // como si la vista tuviera ~55° de alto
        return new float[]{(larga ? 0.44f : 0.52f) * -z / proy[0], (larga ? -0.6f : -0.58f) * -z / proy[5], z, s};
    }

    /** La boca del arma en el espacio de la vista (de ahí sale la trazadora y el fogonazo). */
    static float[] bocaArma(float[] proy, int tipo) {
        float[] l = lugarArma(proy, tipo);
        return new float[]{l[0], l[1] + BOCA[tipo][0] * l[3], l[2] + BOCA[tipo][1] * l[3]};
    }

    /** La boca del arma en la mano (hand tracking): pos es el centro del mango. */
    static void bocaEnMano(int tipo, float[] pos, float[] adelante, float[] arriba, float[] salida) {
        float up = Mano.BASE_ARRIBA + BOCA[tipo][0], fw = Mano.BASE_ADELANTE - BOCA[tipo][1];
        for (int i = 0; i < 3; i++) salida[i] = pos[i] + adelante[i] * fw + arriba[i] * up;
    }

    /**
     * El arma, en el espacio de la vista (pegada a la cámara/ojo).
     * @param proy   la proyección del ojo (con su corrimiento de IPD)
     * @param recarga 0..1..0 durante la recarga (baja y gira)
     * @param saca   0..1 al cambiar de arma (1 = abajo, fuera de vista)
     */
    void dibujarArma(float[] proy, int tipo, float retroceso, float recarga, float saca, float tiempo) {
        float[] l = lugarArma(proy, tipo);
        empezarCajas(proy);
        Matrix.setIdentityM(m, 0);
        nivel = 0;
        float bamboleo = (float) Math.sin(tiempo * 1.7f) * 0.004f;
        mover(l[0], l[1] + (bamboleo - recarga * 0.12f - saca * 0.3f) * l[3], l[2] + retroceso * (tipo == Juego.PISTOLA ? 0.05f : 0.035f) * l[3]);
        Matrix.scaleM(m, 0, l[3], l[3], l[3]);
        girarX(retroceso * (tipo == Juego.PISTOLA ? 0.35f : 0.12f) - recarga * 0.9f - saca * 0.8f);
        girarY(0.05f);
        cajasArma(tipo, true, retroceso);
        terminarCajas();
    }

    /**
     * El arma EN LA MANO (hand tracking): en el mundo, con el caño hacia
     * "adelante" y la corredera hacia "arriba"; pos es el centro del mango.
     */
    void dibujarArmaEnMano(float[] vp, int tipo, float[] pos, float[] adelante, float[] arriba, float retroceso, float saca) {
        empezarCajas(vp);
        // ejes locales: X derecha, Y arriba, Z atrás (el caño va hacia −Z)
        float zx = -adelante[0], zy = -adelante[1], zz = -adelante[2];
        float yx = arriba[0], yy = arriba[1], yz = arriba[2];
        float xx = yy * zz - yz * zy, xy = yz * zx - yx * zz, xz = yx * zy - yy * zx;
        Matrix.setIdentityM(m, 0);
        nivel = 0;
        m[0] = xx; m[1] = xy; m[2] = xz;
        m[4] = yx; m[5] = yy; m[6] = yz;
        m[8] = zx; m[9] = zy; m[10] = zz;
        // pos es el centro del mango; el origen del modelo es la base de la corredera (arriba y adelante del mango)
        m[12] = pos[0] + yx * Mano.BASE_ARRIBA + adelante[0] * Mano.BASE_ADELANTE;
        m[13] = pos[1] + yy * Mano.BASE_ARRIBA + adelante[1] * Mano.BASE_ADELANTE;
        m[14] = pos[2] + yz * Mano.BASE_ARRIBA + adelante[2] * Mano.BASE_ADELANTE;
        girarX(retroceso * (tipo == Juego.PISTOLA ? 0.35f : 0.15f));
        if (saca > 0) { float e = 1 - saca * 0.9f; Matrix.scaleM(m, 0, e, e, e); }   // aparece al cambiar
        cajasArma(tipo, false, retroceso);
        terminarCajas();
    }

    /** Las cajas del arma, en el marco actual. conGuante: la mano virtual (en la mano real no hace falta). */
    private void cajasArma(int tipo, boolean conGuante, float retroceso) {
        switch (tipo) {
            case Juego.FUSIL: cajasFusil(); break;
            case Juego.ESCOPETA: cajasEscopeta(retroceso); break;
            case Juego.LANZAGRANADAS: cajasLanzagranadas(retroceso); break;
            default: cajasPistola();
        }
        // la mano (un guante oscuro)
        if (conGuante) caja(0.008f, -0.06f, 0.07f, 0.05f, 0.08f, 0.07f, 0.12f, 0.1f, 0.09f, 1);
    }

    /** El mango, igual en todas (la mano real lo agarra en el mismo lugar). */
    private void mango(float r, float g, float b) {
        empujar();
        mover(0, -0.05f, 0.055f);
        girarX(0.28f);
        caja(0, -0.01f, 0, 0.03f, 0.1f, 0.045f, r, g, b, 1);
        sacar();
        caja(0, -0.025f, -0.01f, 0.012f, 0.03f, 0.05f, 0.04f, 0.04f, 0.045f, 1);   // guardamonte
    }

    private void cajasPistola() {
        // corredera, armazón, cañón
        caja(0, 0.025f, -0.02f, 0.034f, 0.035f, 0.2f, 0.09f, 0.09f, 0.1f, 1);
        caja(0, 0.0f, 0.0f, 0.03f, 0.025f, 0.17f, 0.05f, 0.05f, 0.055f, 1);
        caja(0, 0.028f, -0.125f, 0.014f, 0.014f, 0.03f, 0.02f, 0.02f, 0.02f, 1);
        mango(0.04f, 0.035f, 0.035f);
    }

    // fusil: negro con partes color arena
    private void cajasFusil() {
        final float nr = 0.06f, ng = 0.06f, nb = 0.065f, ar = 0.32f, ag = 0.27f, ab = 0.19f;
        caja(0, 0.02f, -0.02f, 0.05f, 0.065f, 0.3f, nr, ng, nb, 1);          // cajón de mecanismos
        caja(0, 0.022f, -0.26f, 0.056f, 0.06f, 0.2f, ar, ag, ab, 1);         // guardamanos
        caja(0, 0.025f, -0.43f, 0.02f, 0.02f, 0.15f, 0.03f, 0.03f, 0.03f, 1); // cañón
        caja(0, 0.025f, -0.495f, 0.032f, 0.032f, 0.03f, 0.02f, 0.02f, 0.02f, 1); // apagallamas
        caja(0, 0.062f, -0.33f, 0.012f, 0.03f, 0.012f, nr, ng, nb, 1);       // mira delantera
        // la mira telescópica, con los lentes que brillan un poco
        caja(0, 0.088f, -0.04f, 0.04f, 0.042f, 0.17f, 0.03f, 0.03f, 0.035f, 1);
        caja(0, 0.088f, -0.13f, 0.05f, 0.05f, 0.025f, 0.03f, 0.03f, 0.035f, 1);
        caja(0, 0.088f, -0.144f, 0.036f, 0.036f, 0.004f, 0.25f, 0.5f, 0.9f, 1);
        caja(0, 0.06f, -0.04f, 0.02f, 0.02f, 0.06f, nr, ng, nb, 1);          // montura
        // el cargador curvo
        empujar();
        mover(0, -0.03f, -0.08f);
        girarX(-0.22f);
        caja(0, -0.07f, 0, 0.034f, 0.14f, 0.07f, ar, ag, ab, 1);
        sacar();
        mango(nr, ng, nb);
        caja(0, 0.005f, 0.22f, 0.045f, 0.075f, 0.2f, ar, ag, ab, 1);        // culata
        caja(0, -0.015f, 0.33f, 0.05f, 0.12f, 0.03f, 0.05f, 0.05f, 0.05f, 1); // cantonera
    }

    // escopeta de corredera: madera y metal pavonado; la corredera va y viene al tirar
    private void cajasEscopeta(float bombeo) {
        final float mr = 0.11f, mg = 0.11f, mb = 0.12f, wr = 0.38f, wg = 0.22f, wb = 0.11f;
        caja(0, 0.02f, -0.02f, 0.05f, 0.07f, 0.22f, mr, mg, mb, 1);           // cajón
        caja(0, 0.042f, -0.33f, 0.03f, 0.03f, 0.47f, 0.08f, 0.08f, 0.09f, 1); // cañón
        caja(0, 0.062f, -0.55f, 0.01f, 0.012f, 0.01f, 0.9f, 0.85f, 0.7f, 1);  // mira de punto
        caja(0, 0.006f, -0.27f, 0.026f, 0.026f, 0.34f, mr, mg, mb, 1);       // tubo del cargador
        float b = (float) Math.sin(Math.min(1f, bombeo) * Math.PI) * 0.08f;
        caja(0, 0.006f, -0.27f + b, 0.048f, 0.048f, 0.14f, wr, wg, wb, 1);   // la corredera (madera)
        mango(wr * 0.8f, wg * 0.8f, wb * 0.8f);
        caja(0, 0.0f, 0.2f, 0.045f, 0.08f, 0.22f, wr, wg, wb, 1);            // culata
        caja(0, -0.02f, 0.31f, 0.048f, 0.13f, 0.03f, 0.06f, 0.05f, 0.05f, 1);
    }

    // lanzagranadas de tambor: verde oliva, caño gordo, el tambor gira al tirar
    private void cajasLanzagranadas(float retroceso) {
        final float or = 0.2f, og = 0.25f, ob = 0.14f;
        caja(0, 0.04f, -0.19f, 0.085f, 0.085f, 0.3f, or, og, ob, 1);         // caño
        caja(0, 0.04f, -0.335f, 0.098f, 0.098f, 0.025f, 0.05f, 0.05f, 0.05f, 1);
        caja(0, 0.04f, -0.345f, 0.06f, 0.06f, 0.004f, 0.01f, 0.01f, 0.01f, 1); // la boca (negra)
        caja(0, 0.1f, -0.12f, 0.02f, 0.05f, 0.02f, 0.05f, 0.05f, 0.05f, 1);   // mira
        // el tambor: un prisma de 6 caras (3 cajas giradas)
        empujar();
        mover(0, 0.03f, 0.02f);
        girarZ(retroceso * 1.05f);
        for (int k = 0; k < 3; k++) {
            empujar();
            girarZ(k * (float) Math.PI / 3f);
            caja(0, 0, 0, 0.14f, 0.08f, 0.1f, 0.12f, 0.14f, 0.09f, 1);
            sacar();
        }
        sacar();
        mango(0.05f, 0.05f, 0.05f);
        caja(0, -0.005f, 0.15f, 0.03f, 0.05f, 0.14f, 0.05f, 0.05f, 0.05f, 1); // culata plegable
        caja(0, -0.01f, 0.22f, 0.035f, 0.1f, 0.025f, 0.05f, 0.05f, 0.05f, 1);
    }

    // ── granadas en vuelo y blancos de práctica ──

    void dibujarGranadas(List<Juego.Granada> gs, float[] vp) {
        if (gs.isEmpty()) return;
        empezarCajas(vp);
        for (Juego.Granada g : gs) {
            Matrix.setIdentityM(m, 0);
            nivel = 0;
            mover(g.x, g.y, g.z);
            float vl = (float) Math.sqrt(g.vx * g.vx + g.vz * g.vz);
            if (vl > 0.1f) girarY((float) Math.atan2(g.vx, g.vz));
            girarX(g.giro);
            caja(0, 0, 0, 0.045f, 0.045f, 0.07f, 0.2f, 0.25f, 0.14f, 1);
            caja(0, 0, -0.03f, 0.05f, 0.05f, 0.012f, 0.55f, 0.45f, 0.2f, 1);   // la punta de bronce
            boolean luz = ((int) (g.t * (g.t > 1.6f ? 16 : 7))) % 2 == 0;
            if (luz) caja(0, 0.026f, 0.01f, 0.014f, 0.01f, 0.014f, 3f, 0.4f, 0.3f, 1);
        }
        terminarCajas();
    }

    private FloatBuffer disco;

    /** Radios de los anillos del blanco (de afuera hacia adentro; el último es el centro). */
    static final float[] ANILLOS = {1f, 0.78f, 0.56f, 0.34f, 0.14f};
    static final int LADOS = 32;

    /**
     * El blanco en el plano XY mirando a +Z, radio 1: un centro (abanico) y
     * coronas que NO se superponen (tiras entre dos radios), así no hay dos
     * polígonos en el mismo lugar peleando por la profundidad (con 16 bits, a
     * 5 m, se vería rayado). Primero el centro (34 vértices), después cada
     * corona de afuera hacia adentro (2·(LADOS+1) vértices cada una).
     */
    static float[] disco() {
        int nc = LADOS + 2, na = 2 * (LADOS + 1);
        float[] v = new float[(nc + na * (ANILLOS.length - 1)) * 6];
        int k = 0;
        float rc = ANILLOS[ANILLOS.length - 1];
        v[k++] = 0; v[k++] = 0; v[k++] = 0; v[k++] = 0; v[k++] = 0; v[k++] = 1;
        for (int i = 0; i <= LADOS; i++) {
            double a = 2 * Math.PI * i / LADOS;
            v[k++] = rc * (float) Math.cos(a); v[k++] = rc * (float) Math.sin(a); v[k++] = 0;
            v[k++] = 0; v[k++] = 0; v[k++] = 1;
        }
        for (int r = 0; r < ANILLOS.length - 1; r++) {
            for (int i = 0; i <= LADOS; i++) {
                double a = 2 * Math.PI * i / LADOS;
                float c = (float) Math.cos(a), sn = (float) Math.sin(a);
                v[k++] = ANILLOS[r] * c; v[k++] = ANILLOS[r] * sn; v[k++] = 0; v[k++] = 0; v[k++] = 0; v[k++] = 1;
                v[k++] = ANILLOS[r + 1] * c; v[k++] = ANILLOS[r + 1] * sn; v[k++] = 0; v[k++] = 0; v[k++] = 0; v[k++] = 1;
            }
        }
        return v;
    }

    /** Los blancos de la práctica: anillos rojos y blancos pegados a la pared; al pegarles se dan vuelta. */
    void dibujarBlancos(List<Juego.Blanco> bs, float[] vp) {
        if (bs.isEmpty()) return;
        if (disco == null) disco = Gl.bufer(disco());
        this.vp = vp;
        GLES20.glUseProgram(progCaja);
        disco.position(0);
        GLES20.glVertexAttribPointer(cAPos, 3, GLES20.GL_FLOAT, false, 24, disco);
        disco.position(3);
        GLES20.glVertexAttribPointer(cANor, 3, GLES20.GL_FLOAT, false, 24, disco);
        GLES20.glEnableVertexAttribArray(cAPos);
        GLES20.glEnableVertexAttribArray(cANor);
        GLES20.glUniform3f(cULuz, 0.37f, 0.84f, 0.4f);
        GLES20.glDisable(GLES20.GL_CULL_FACE);
        GLES20.glEnable(GLES20.GL_POLYGON_OFFSET_FILL);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glPolygonOffset(-1f, -2f);   // un poquito adelante de la malla de la pared
        for (Juego.Blanco b : bs) {
            // marco: Z = la normal, X horizontal
            float nx = b.nx, ny = b.ny, nz = b.nz;
            float xx = nz, xy = 0, xz = -nx;   // arriba × normal
            float xl = (float) Math.sqrt(xx * xx + xz * xz);
            if (xl < 0.1f) { xx = 1; xz = 0; xl = 1; }
            xx /= xl; xz /= xl;
            float yx = ny * xz - nz * xy, yy = nz * xx - nx * xz, yz = nx * xy - ny * xx;
            Matrix.setIdentityM(m, 0);
            m[0] = xx; m[1] = xy; m[2] = xz;
            m[4] = yx; m[5] = yy; m[6] = yz;
            m[8] = nx; m[9] = ny; m[10] = nz;
            m[12] = b.x; m[13] = b.y; m[14] = b.z;
            float esc = b.radio, alfa = 1f;
            if (b.golpe >= 0) {   // pegado: se da vuelta y se achica
                girarX(b.golpe * 7f);
                esc *= Math.max(0, 1 - b.golpe / 0.5f);
            } else {
                esc *= Math.min(1f, b.t / 0.2f);                  // aparece
                if (b.t > 4.5f && ((int) (b.t * 8)) % 2 == 0) alfa = 0.35f;   // se va: titila
            }
            if (esc <= 0.001f) continue;
            Matrix.scaleM(m, 0, esc, esc, esc);
            Matrix.multiplyMM(mvp, 0, vp, 0, m, 0);
            GLES20.glUniformMatrix4fv(cUMvp, 1, false, mvp, 0);
            GLES20.glUniformMatrix4fv(cUModelo, 1, false, m, 0);
            int nc = LADOS + 2, na = 2 * (LADOS + 1);
            GLES20.glUniform4f(cUColor, 1.4f, 1.2f, 0.28f, alfa);   // el centro, amarillo
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_FAN, 0, nc);
            for (int r = 0; r < ANILLOS.length - 1; r++) {
                boolean rojo = r % 2 == 0;
                if (rojo) GLES20.glUniform4f(cUColor, 1.2f, 0.14f, 0.11f, alfa);
                else GLES20.glUniform4f(cUColor, 1.33f, 1.33f, 1.29f, alfa);
                GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, nc + r * na, na);
            }
        }
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisable(GLES20.GL_POLYGON_OFFSET_FILL);
        GLES20.glDisableVertexAttribArray(cAPos);
        GLES20.glDisableVertexAttribArray(cANor);
    }

    // ── el láser de la mira y el esqueleto de la mano ──

    /** El láser rojo del caño al punto donde pega, con un punto brillante ahí. */
    void dibujarLaser(float[] vp, float[] a, float[] b, float escalaPx) {
        lineas.position(0);
        lineas.put(a[0]).put(a[1]).put(a[2]).put(1f).put(0.1f).put(0.1f).put(0.05f);
        lineas.put(b[0]).put(b[1]).put(b[2]).put(1f).put(0.15f).put(0.1f).put(0.7f);
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
        GLES20.glLineWidth(2.5f);
        GLES20.glDrawArrays(GLES20.GL_LINES, 0, 2);
        GLES20.glDisableVertexAttribArray(lAPos);
        GLES20.glDisableVertexAttribArray(lACol);
        // el punto
        puntos.position(0);
        puntos.put(b[0]).put(b[1]).put(b[2]).put(0.025f).put(1f).put(0.2f).put(0.15f).put(1f);
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
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDrawArrays(GLES20.GL_POINTS, 0, 1);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(pAPos);
        GLES20.glDisableVertexAttribArray(pATam);
        GLES20.glDisableVertexAttribArray(pACol);
    }

    /** Los huesos de la mano (21 puntos de MediaPipe). */
    private static final int[] HUESOS = {0, 1, 1, 2, 2, 3, 3, 4, 0, 5, 5, 6, 6, 7, 7, 8, 5, 9, 9, 10, 10, 11, 11, 12,
            9, 13, 13, 14, 14, 15, 15, 16, 13, 17, 0, 17, 17, 18, 18, 19, 19, 20};

    void dibujarEsqueleto(float[] vp, float[][] p, boolean empuna) {
        lineas.position(0);
        float r = empuna ? 1f : 0.3f, g = empuna ? 0.85f : 0.9f, b = empuna ? 0.2f : 1f;
        for (int i = 0; i < HUESOS.length; i++) {
            float[] q = p[HUESOS[i]];
            lineas.put(q[0]).put(q[1]).put(q[2]).put(r).put(g).put(b).put(0.9f);
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
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glLineWidth(3f);
        GLES20.glDrawArrays(GLES20.GL_LINES, 0, HUESOS.length);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(lAPos);
        GLES20.glDisableVertexAttribArray(lACol);
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
                case Juego.P_FUEGO: r = 1f; g = 0.3f + 0.6f * f; b = 0.08f + 0.3f * f * f; a = Math.min(1f, 1.4f * f); break;
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
