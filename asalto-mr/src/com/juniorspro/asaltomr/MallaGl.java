package com.juniorspro.asaltomr;

import android.opengl.GLES11Ext;
import android.opengl.GLES20;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.HashMap;
import java.util.Iterator;

/**
 * La malla del entorno en la GPU, un pedazo por bloque de voxeles.
 *
 * Se dibuja de cuatro maneras:
 *  - profundidad: invisible, sólo escribe el z-buffer. Es la OCLUSIÓN: lo real
 *    tapa a lo virtual (un soldado detrás de un árbol no se ve).
 *  - líneas: el "escaneo", los polígonos que se ven brillar con una onda que
 *    sale del jugador, de color según hacia dónde mira la cara (piso, pared).
 *  - sólida: caras semitransparentes sombreadas.
 *  - reproyectada: pintada con la imagen de la cámara. En SBS eso hace que el
 *    mundo real también tenga profundidad en cada ojo (no una foto plana).
 *
 * Lo INFERIDO (lo que completó la IA sin verlo) sale en ámbar, punteado y más
 * tenue: se ve qué es real y qué es supuesto.
 */
final class MallaGl {
    private static final class Pedazo {
        int vbo, iboTri, iboLin, nTri, nLin, version;
    }

    private final HashMap<Long, Pedazo> pedazos = new HashMap<>();
    private int progProf, pAPos, pUVp;
    private int progLin, lAPos, lANor, lAInf, lUVp, lUCentro, lURadio, lUAlfa, lUAncho;
    private int progSol, sAPos, sANor, sAInf, sUVp, sUAlfa;
    private static final int PASO = Mallador.PASO * 4;   // bytes por vértice
    private int progRep, rAPos, rUVp, rUVpCam, rUT0, rUEjeX, rUEjeY, rUTex;
    int vertices, triangulos;

    void crear() {
        pedazos.clear();
        progProf = Gl.programa(
                "uniform mat4 uVp; attribute vec3 aPos; void main() { gl_Position = uVp * vec4(aPos, 1.0); }",
                "precision mediump float; void main() { gl_FragColor = vec4(0.0); }");
        pAPos = Gl.atributo(progProf, "aPos");
        pUVp = Gl.uniforme(progProf, "uVp");

        // Líneas: el color depende de la normal (piso verde-agua, paredes violeta),
        // y una onda que avanza desde el jugador las enciende al pasar.
        progLin = Gl.programa(
                "uniform mat4 uVp; uniform vec3 uCentro; attribute vec3 aPos; attribute vec3 aNor; attribute float aInf;\n"
                        + "varying vec3 vCol; varying float vDist; varying float vInf; varying vec3 vPos;\n"
                        + "void main() {\n"
                        + "  gl_Position = uVp * vec4(aPos, 1.0);\n"
                        + "  float arriba = abs(aNor.y);\n"
                        + "  vCol = mix(vec3(0.62, 0.36, 1.0), vec3(0.2, 1.0, 0.78), smoothstep(0.55, 0.9, arriba));\n"
                        + "  vCol = mix(vCol, vec3(1.0, 0.62, 0.18), aInf);\n"   // lo supuesto: ámbar
                        + "  vDist = distance(aPos, uCentro);\n"
                        + "  vInf = aInf; vPos = aPos;\n"
                        + "}",
                "precision mediump float; uniform float uRadio; uniform float uAlfa; uniform float uAncho;\n"
                        + "varying vec3 vCol; varying float vDist; varying float vInf; varying vec3 vPos;\n"
                        + "void main() {\n"
                        + "  float d = (vDist - uRadio) / uAncho;\n"
                        + "  float onda = exp(-d * d) * step(vDist, uRadio + uAncho * 2.0);\n"
                        + "  float lejos = 1.0 - smoothstep(4.0, 9.0, vDist);\n"
                        + "  float punteado = mix(1.0, step(0.45, fract((vPos.x + vPos.y + vPos.z) * 7.0)), step(0.5, vInf));\n"
                        + "  float a = (uAlfa + onda * 0.9) * lejos * punteado * (1.0 - 0.35 * vInf);\n"
                        + "  gl_FragColor = vec4(vCol * (0.7 + onda * 1.3) * a, 1.0);\n"   // aditivo
                        + "}");
        lAPos = Gl.atributo(progLin, "aPos");
        lANor = Gl.atributo(progLin, "aNor");
        lAInf = Gl.atributo(progLin, "aInf");
        lUVp = Gl.uniforme(progLin, "uVp");
        lUCentro = Gl.uniforme(progLin, "uCentro");
        lURadio = Gl.uniforme(progLin, "uRadio");
        lUAlfa = Gl.uniforme(progLin, "uAlfa");
        lUAncho = Gl.uniforme(progLin, "uAncho");

        progSol = Gl.programa(
                "uniform mat4 uVp; attribute vec3 aPos; attribute vec3 aNor; attribute float aInf; varying vec3 vNor; varying float vInf;\n"
                        + "void main() { gl_Position = uVp * vec4(aPos, 1.0); vNor = aNor; vInf = aInf; }",
                "precision mediump float; uniform float uAlfa; varying vec3 vNor; varying float vInf;\n"
                        + "void main() {\n"
                        + "  vec3 n = normalize(vNor);\n"
                        + "  float luz = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.4, 1.0, 0.3))), 0.0);\n"
                        + "  vec3 c = mix(vec3(0.45, 0.3, 0.85), vec3(0.15, 0.75, 0.6), smoothstep(0.55, 0.9, abs(n.y)));\n"
                        + "  c = mix(c, vec3(0.95, 0.55, 0.15), vInf);\n"
                        + "  gl_FragColor = vec4(c * luz, uAlfa * (1.0 - 0.3 * vInf));\n"
                        + "}");
        sAPos = Gl.atributo(progSol, "aPos");
        sANor = Gl.atributo(progSol, "aNor");
        sAInf = Gl.atributo(progSol, "aInf");
        sUVp = Gl.uniforme(progSol, "uVp");
        sUAlfa = Gl.uniforme(progSol, "uAlfa");

        // Reproyectada: cada vértice se ubica con la vista del OJO, pero se pinta
        // con el píxel de la cámara donde lo ve la cámara del teléfono.
        progRep = Gl.programa(
                "uniform mat4 uVp; uniform mat4 uVpCam; attribute vec3 aPos; varying vec3 vCam;\n"
                        + "void main() { gl_Position = uVp * vec4(aPos, 1.0); vec4 c = uVpCam * vec4(aPos, 1.0); vCam = c.xyw; }",
                "#extension GL_OES_EGL_image_external : require\n"
                        + "precision mediump float; uniform samplerExternalOES uTex; uniform vec2 uT0; uniform vec2 uEjeX; uniform vec2 uEjeY;\n"
                        + "varying vec3 vCam;\n"
                        + "void main() {\n"
                        + "  if (vCam.z <= 0.0) discard;\n"
                        + "  vec2 ndc = vCam.xy / vCam.z;\n"
                        + "  if (abs(ndc.x) > 1.0 || abs(ndc.y) > 1.0) discard;\n"     // fuera de la cámara: queda el fondo
                        + "  vec2 t = uT0 + (ndc.x + 1.0) * 0.5 * uEjeX + (ndc.y + 1.0) * 0.5 * uEjeY;\n"
                        + "  gl_FragColor = texture2D(uTex, t);\n"
                        + "}");
        rAPos = Gl.atributo(progRep, "aPos");
        rUVp = Gl.uniforme(progRep, "uVp");
        rUVpCam = Gl.uniforme(progRep, "uVpCam");
        rUT0 = Gl.uniforme(progRep, "uT0");
        rUEjeX = Gl.uniforme(progRep, "uEjeX");
        rUEjeY = Gl.uniforme(progRep, "uEjeY");
        rUTex = Gl.uniforme(progRep, "uTex");
    }

    /** Sube (o reemplaza) la malla de un bloque. m.nTri == 0 la borra. */
    void subir(long clave, Mallador.Malla m) {
        Pedazo p = pedazos.get(clave);
        if (m == null || m.nTri == 0) {
            if (p != null) { borrar(p); pedazos.remove(clave); }
            return;
        }
        if (p != null && p.version > m.version) return;   // llegó tarde una versión vieja
        if (p == null) {
            p = new Pedazo();
            int[] b = new int[3];
            GLES20.glGenBuffers(3, b, 0);
            p.vbo = b[0]; p.iboTri = b[1]; p.iboLin = b[2];
            pedazos.put(clave, p);
        }
        FloatBuffer fv = ByteBuffer.allocateDirect(m.nVert * PASO).order(ByteOrder.nativeOrder()).asFloatBuffer();
        fv.put(m.vert, 0, m.nVert * Mallador.PASO).position(0);
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, p.vbo);
        GLES20.glBufferData(GLES20.GL_ARRAY_BUFFER, m.nVert * PASO, fv, GLES20.GL_STATIC_DRAW);
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, p.iboTri);
        GLES20.glBufferData(GLES20.GL_ELEMENT_ARRAY_BUFFER, m.nTri * 2, Gl.buferCortos(m.tri, m.nTri), GLES20.GL_STATIC_DRAW);
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, p.iboLin);
        GLES20.glBufferData(GLES20.GL_ELEMENT_ARRAY_BUFFER, m.nLin * 2, Gl.buferCortos(m.lin, m.nLin), GLES20.GL_STATIC_DRAW);
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, 0);
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, 0);
        p.nTri = m.nTri; p.nLin = m.nLin; p.version = m.version;
        contar();
    }

    private void contar() {
        int t = 0;
        for (Pedazo p : pedazos.values()) t += p.nTri / 3;
        triangulos = t;
    }

    private void borrar(Pedazo p) {
        GLES20.glDeleteBuffers(3, new int[]{p.vbo, p.iboTri, p.iboLin}, 0);
    }

    void vaciar() {
        for (Iterator<Pedazo> it = pedazos.values().iterator(); it.hasNext(); ) { borrar(it.next()); it.remove(); }
        triangulos = 0;
    }

    int cantidad() { return pedazos.size(); }

    private void atributos(int aPos, int aNor, Pedazo p) { atributos(aPos, aNor, -1, p); }

    private void atributos(int aPos, int aNor, int aInf, Pedazo p) {
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, p.vbo);
        GLES20.glVertexAttribPointer(aPos, 3, GLES20.GL_FLOAT, false, PASO, 0);
        GLES20.glEnableVertexAttribArray(aPos);
        if (aNor >= 0) {
            GLES20.glVertexAttribPointer(aNor, 3, GLES20.GL_FLOAT, false, PASO, 12);
            GLES20.glEnableVertexAttribArray(aNor);
        }
        if (aInf >= 0) {
            GLES20.glVertexAttribPointer(aInf, 1, GLES20.GL_FLOAT, false, PASO, 24);
            GLES20.glEnableVertexAttribArray(aInf);
        }
    }

    private void soltar(int aPos, int aNor) { soltar(aPos, aNor, -1); }

    private void soltar(int aPos, int aNor, int aInf) {
        GLES20.glDisableVertexAttribArray(aPos);
        if (aNor >= 0) GLES20.glDisableVertexAttribArray(aNor);
        if (aInf >= 0) GLES20.glDisableVertexAttribArray(aInf);
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER, 0);
        GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, 0);
    }

    /** Sólo el z-buffer (oclusión). Un poquito corrida para atrás: las líneas y lo apoyado encima no titilan. */
    void dibujarProfundidad(float[] vp) {
        GLES20.glUseProgram(progProf);
        GLES20.glUniformMatrix4fv(pUVp, 1, false, vp, 0);
        GLES20.glColorMask(false, false, false, false);
        GLES20.glEnable(GLES20.GL_POLYGON_OFFSET_FILL);
        GLES20.glPolygonOffset(1.5f, 2f);
        for (Pedazo p : pedazos.values()) {
            atributos(pAPos, -1, p);
            GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, p.iboTri);
            GLES20.glDrawElements(GLES20.GL_TRIANGLES, p.nTri, GLES20.GL_UNSIGNED_SHORT, 0);
        }
        soltar(pAPos, -1);
        GLES20.glDisable(GLES20.GL_POLYGON_OFFSET_FILL);
        GLES20.glColorMask(true, true, true, true);
    }

    void dibujarReproyectada(float[] vpOjo, float[] vpCamara, Fondo fondo) {
        GLES20.glUseProgram(progRep);
        GLES20.glUniformMatrix4fv(rUVp, 1, false, vpOjo, 0);
        GLES20.glUniformMatrix4fv(rUVpCam, 1, false, vpCamara, 0);
        GLES20.glUniform2f(rUT0, fondo.t0[0], fondo.t0[1]);
        GLES20.glUniform2f(rUEjeX, fondo.ejeX[0], fondo.ejeX[1]);
        GLES20.glUniform2f(rUEjeY, fondo.ejeY[0], fondo.ejeY[1]);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, fondo.textura());
        GLES20.glUniform1i(rUTex, 0);
        GLES20.glEnable(GLES20.GL_POLYGON_OFFSET_FILL);
        GLES20.glPolygonOffset(1.5f, 2f);
        for (Pedazo p : pedazos.values()) {
            atributos(rAPos, -1, p);
            GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, p.iboTri);
            GLES20.glDrawElements(GLES20.GL_TRIANGLES, p.nTri, GLES20.GL_UNSIGNED_SHORT, 0);
        }
        soltar(rAPos, -1);
        GLES20.glDisable(GLES20.GL_POLYGON_OFFSET_FILL);
    }

    /**
     * Las líneas del escaneo (aditivas, sin escribir profundidad).
     * @param radio hasta dónde llegó la onda (m); alfa = brillo de base
     */
    void dibujarLineas(float[] vp, float cx, float cy, float cz, float radio, float alfa) {
        GLES20.glUseProgram(progLin);
        GLES20.glUniformMatrix4fv(lUVp, 1, false, vp, 0);
        GLES20.glUniform3f(lUCentro, cx, cy, cz);
        GLES20.glUniform1f(lURadio, radio);
        GLES20.glUniform1f(lUAlfa, alfa);
        GLES20.glUniform1f(lUAncho, 0.45f);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE);
        GLES20.glDepthMask(false);
        GLES20.glDepthFunc(GLES20.GL_LEQUAL);
        GLES20.glLineWidth(1.5f);
        for (Pedazo p : pedazos.values()) {
            atributos(lAPos, lANor, lAInf, p);
            GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, p.iboLin);
            GLES20.glDrawElements(GLES20.GL_LINES, p.nLin, GLES20.GL_UNSIGNED_SHORT, 0);
        }
        soltar(lAPos, lANor, lAInf);
        GLES20.glDepthFunc(GLES20.GL_LESS);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
    }

    void dibujarSolida(float[] vp, float alfa) {
        GLES20.glUseProgram(progSol);
        GLES20.glUniformMatrix4fv(sUVp, 1, false, vp, 0);
        GLES20.glUniform1f(sUAlfa, alfa);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        GLES20.glDepthFunc(GLES20.GL_LEQUAL);
        for (Pedazo p : pedazos.values()) {
            atributos(sAPos, sANor, sAInf, p);
            GLES20.glBindBuffer(GLES20.GL_ELEMENT_ARRAY_BUFFER, p.iboTri);
            GLES20.glDrawElements(GLES20.GL_TRIANGLES, p.nTri, GLES20.GL_UNSIGNED_SHORT, 0);
        }
        soltar(sAPos, sANor, sAInf);
        GLES20.glDepthFunc(GLES20.GL_LESS);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
    }
}
