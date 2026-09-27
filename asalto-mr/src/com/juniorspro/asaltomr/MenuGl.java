package com.juniorspro.asaltomr;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.opengl.GLES20;
import android.opengl.GLUtils;

import java.nio.FloatBuffer;

/**
 * Dibuja el Menu en el mundo: el panel se pinta con Canvas en una textura
 * (sólo cuando cambia: otro texto u otro botón apuntado) y va en un
 * rectángulo 3D de frente al jugador. La barrita de "mirando" (lo que falta
 * para elegir con la mirada) se dibuja aparte, sin repintar la textura.
 */
final class MenuGl {
    private static final int W = 768, H = 1536;
    private static final float PXM = W / Menu.ANCHO;   // píxeles por metro del panel

    private final Bitmap lienzo = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
    private final Canvas canvas = new Canvas(lienzo);
    private final Paint fondo = new Paint(Paint.ANTI_ALIAS_FLAG), borde = new Paint(Paint.ANTI_ALIAS_FLAG),
            titulo = new Paint(Paint.ANTI_ALIAS_FLAG), texto = new Paint(Paint.ANTI_ALIAS_FLAG),
            linea = new Paint(Paint.ANTI_ALIAS_FLAG), detalle = new Paint(Paint.ANTI_ALIAS_FLAG),
            boton = new Paint(Paint.ANTI_ALIAS_FLAG);
    private int textura, prog, aPos, aTex, uVp, uTex, progColor, cAPos, cUVp, cUColor;
    private final FloatBuffer quad = Gl.bufer(20), barra = Gl.bufer(12);
    private final float[] p = new float[12];
    private int versionPintada = -1;
    private float altoPx;

    MenuGl() {
        fondo.setColor(0xE60B0616);
        borde.setStyle(Paint.Style.STROKE);
        borde.setStrokeWidth(5);
        borde.setColor(0xFFC9B0FF);
        titulo.setColor(Color.WHITE);
        titulo.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        titulo.setTextSize(64);
        texto.set(titulo);
        texto.setTextSize(50);
        linea.setColor(0xFFE0D6FF);
        linea.setTextSize(38);
        linea.setTypeface(Typeface.DEFAULT);
        detalle.setColor(0xFFFFD84A);
        detalle.setTextSize(34);
        detalle.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
    }

    void crear() {
        int[] t = new int[1];
        GLES20.glGenTextures(1, t, 0);
        textura = t[0];
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textura);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        versionPintada = -1;
        prog = Gl.programa(
                "uniform mat4 uVp; attribute vec3 aPos; attribute vec2 aTex; varying vec2 vTex;\n"
                        + "void main() { gl_Position = uVp * vec4(aPos, 1.0); vTex = aTex; }",
                "precision mediump float; uniform sampler2D uTex; varying vec2 vTex;\n"
                        + "void main() { gl_FragColor = texture2D(uTex, vTex); }");
        aPos = Gl.atributo(prog, "aPos");
        aTex = Gl.atributo(prog, "aTex");
        uVp = Gl.uniforme(prog, "uVp");
        uTex = Gl.uniforme(prog, "uTex");
        progColor = Gl.programa(
                "uniform mat4 uVp; attribute vec3 aPos; void main() { gl_Position = uVp * vec4(aPos, 1.0); }",
                "precision mediump float; uniform vec4 uColor; void main() { gl_FragColor = uColor; }");
        cAPos = Gl.atributo(progColor, "aPos");
        cUVp = Gl.uniforme(progColor, "uVp");
        cUColor = Gl.uniforme(progColor, "uColor");
    }

    /** Pinta el panel en el lienzo (y lo sube). */
    private void pintar(Menu m) {
        versionPintada = m.version;
        float h = Math.min(H, m.alto() * PXM);
        altoPx = h;
        lienzo.eraseColor(Color.TRANSPARENT);
        RectF r = new RectF(3, 3, W - 3, h - 3);
        canvas.drawRoundRect(r, 36, 36, fondo);
        canvas.drawRoundRect(r, 36, 36, borde);
        float y = Menu.MARGEN * PXM;
        // el título, centrado
        float tw = titulo.measureText(m.titulo);
        canvas.drawText(m.titulo, (W - tw) / 2, y + Menu.CABECERA * PXM * 0.68f, titulo);
        y += Menu.CABECERA * PXM;
        for (String s : m.lineas) {
            Paint pl = linea;
            float w = pl.measureText(s);
            canvas.drawText(s, Math.max(24, (W - w) / 2), y + Menu.LINEA * PXM * 0.75f, pl);
            y += Menu.LINEA * PXM;
        }
        float x0 = Menu.MARGEN * PXM, x1 = W - Menu.MARGEN * PXM;
        for (int i = 0; i < m.opciones.size(); i++) {
            Menu.Opcion o = m.opciones.get(i);
            boolean ap = i == m.apuntada;
            float yb = y + i * (Menu.ALTO + Menu.SEP) * PXM, yb1 = yb + Menu.ALTO * PXM;
            RectF b = new RectF(x0, yb, x1, yb1);
            boton.setStyle(Paint.Style.FILL);
            boton.setColor(ap ? 0xFF8A5CFF : 0xB35A2FD9);
            canvas.drawRoundRect(b, 26, 26, boton);
            boton.setStyle(Paint.Style.STROKE);
            boton.setStrokeWidth(ap ? 6 : 3);
            boton.setColor(ap ? Color.WHITE : 0xFFC9B0FF);
            canvas.drawRoundRect(b, 26, 26, boton);
            float base = (yb + yb1) / 2 + texto.getTextSize() * 0.35f;
            String t = o.texto;
            float ancho = x1 - x0 - 60 - (o.detalle != null ? detalle.measureText(o.detalle) + 20 : 0);
            Paint pt = texto;
            if (texto.measureText(t) > ancho) { pt = new Paint(texto); pt.setTextSize(texto.getTextSize() * ancho / texto.measureText(t)); }
            canvas.drawText(t, x0 + 30, base, pt);
            if (o.detalle != null) canvas.drawText(o.detalle, x1 - 30 - detalle.measureText(o.detalle), base - 4, detalle);
        }
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textura);
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, lienzo, 0);
    }

    void dibujar(Menu m, float[] vp) {
        if (!m.abierto) return;
        if (m.version != versionPintada) pintar(m);
        float w = Menu.ANCHO / 2, h = m.alto() / 2, tv = altoPx / H;
        quad.position(0);
        esquina(m, -w, -h, 0, tv);
        esquina(m, w, -h, 1, tv);
        esquina(m, -w, h, 0, 0);
        esquina(m, w, h, 1, 0);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDisable(GLES20.GL_CULL_FACE);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glUseProgram(prog);
        GLES20.glUniformMatrix4fv(uVp, 1, false, vp, 0);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textura);
        GLES20.glUniform1i(uTex, 0);
        quad.position(0);
        GLES20.glVertexAttribPointer(aPos, 3, GLES20.GL_FLOAT, false, 20, quad);
        quad.position(3);
        GLES20.glVertexAttribPointer(aTex, 2, GLES20.GL_FLOAT, false, 20, quad);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnableVertexAttribArray(aTex);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glDisableVertexAttribArray(aTex);
        // la barrita de lo que falta mirando
        if (m.apuntada >= 0 && m.mirando > 0) {
            float f = Math.min(1, m.mirando / Menu.PERMANENCIA);
            float u0 = -w + Menu.MARGEN + 0.02f, u1 = u0 + (2 * w - 2 * Menu.MARGEN - 0.04f) * f;
            float v0 = m.arribaOpcion(m.apuntada) - Menu.ALTO + 0.008f, v1 = v0 + 0.014f;
            m.aMundo(u0, v0, p, 0); m.aMundo(u1, v0, p, 3); m.aMundo(u0, v1, p, 6); m.aMundo(u1, v1, p, 9);
            barra.position(0);
            barra.put(p);
            barra.position(0);
            GLES20.glUseProgram(progColor);
            GLES20.glUniformMatrix4fv(cUVp, 1, false, vp, 0);
            GLES20.glUniform4f(cUColor, 1f, 0.85f, 0.3f, 1f);
            GLES20.glVertexAttribPointer(cAPos, 3, GLES20.GL_FLOAT, false, 12, barra);
            GLES20.glEnableVertexAttribArray(cAPos);
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
            GLES20.glDisableVertexAttribArray(cAPos);
        }
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }

    private void esquina(Menu m, float u, float v, float s, float t) {
        m.aMundo(u, v, p, 0);
        quad.put(p[0]).put(p[1]).put(p[2]).put(s).put(t);
    }
}
