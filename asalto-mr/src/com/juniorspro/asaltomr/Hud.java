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
 * El HUD dibujado con OpenGL (no con vistas de Android) para que en SBS
 * salga en los dos ojos: puntos, oleada, vida, balas, avisos, la mira y el
 * borde rojo cuando te pegan. El texto se pinta en un Bitmap con Canvas y se
 * sube como textura sólo cuando cambia.
 *
 * Y el MINIMAPA: las zonas de la IA vistas desde arriba, girado para que
 * adelante quede arriba, con los soldados y (escaneando) la cobertura y una
 * flecha hacia donde falta. Se repinta a lo sumo 4 veces por segundo.
 */
final class Hud {
    private static final int W = 1024, H = 512;
    private final Bitmap lienzo = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
    private final Canvas canvas = new Canvas(lienzo);
    private final Paint grande = new Paint(Paint.ANTI_ALIAS_FLAG), chico = new Paint(Paint.ANTI_ALIAS_FLAG),
            caja = new Paint(Paint.ANTI_ALIAS_FLAG), barra = new Paint(Paint.ANTI_ALIAS_FLAG);
    private int textura;
    private String ultimo = "";
    private int prog, aPos, aTex, uTex, uAlfa;
    private int progMira, mAPos, mUColor;
    private int progBorde, bAPos, bUAlfa;
    private final FloatBuffer quad = Gl.bufer(16);
    private final FloatBuffer mira = Gl.bufer(32);
    private final Paint celda = new Paint(), punto = new Paint(Paint.ANTI_ALIAS_FLAG), flecha = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final android.graphics.Path camino = new android.graphics.Path();
    // lo que se dibuja en el minimapa
    private Mapa.Grilla grilla;
    private java.util.List<Juego.Soldado> soldados;
    private float mpx, mpz, mfx, mfz = -1;
    private boolean escaneando;
    private long ultimoMapa;

    Hud() {
        grande.setColor(Color.WHITE);
        grande.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        grande.setTextSize(58);
        grande.setShadowLayer(6, 0, 2, Color.BLACK);
        chico.set(grande);
        chico.setTextSize(34);
        caja.setColor(0x9907030F);
        barra.setStyle(Paint.Style.FILL);
        punto.setStyle(Paint.Style.FILL);
        flecha.setStyle(Paint.Style.FILL);
    }

    /** Lo que va en el minimapa (se llama en cada cuadro; se repinta cuando toca). */
    void mapa(Mapa.Grilla g, float px, float pz, float fx, float fz, java.util.List<Juego.Soldado> ss, boolean escaneando) {
        grilla = g; soldados = ss; mpx = px; mpz = pz;
        float l = (float) Math.hypot(fx, fz);
        if (l > 1e-3f) { mfx = fx / l; mfz = fz / l; }
        this.escaneando = escaneando;
    }

    private void dibujarMapa() {
        Mapa.Grilla g = grilla;
        if (g == null) return;
        final float cx = 150, cy = 330, radio = 130, esc = 12f;   // 12 px por metro: se ven 10 m alrededor
        canvas.save();
        camino.reset();
        camino.addCircle(cx, cy, radio, android.graphics.Path.Direction.CW);
        canvas.clipPath(camino);
        canvas.drawColor(0xB307030F);
        // derecha = adelante × arriba
        float rx = -mfz, rz = mfx;
        float lado = Mapa.CELDA * esc;
        for (int c = 0; c < g.n * g.n; c++) {
            int cl = g.clase[c];
            int color;
            if (cl == Mapa.SUELO) color = g.cubierta[c] ? 0xFFFFD84A : g.inferida[c] ? 0x7040C8F0 : 0xB030E080;
            else if (cl == Mapa.AGUA) color = 0xFF3080FF;
            else if (cl == Mapa.OBSTACULO) color = g.inferida[c] ? 0x90FF5040 : 0xFFFF4030;
            else if (escaneando && g.frontera[c]) color = 0xFFFF40E0;
            else continue;
            float dx = g.x(c % g.n) - mpx, dz = g.z(c / g.n) - mpz;
            float sx = cx + (dx * rx + dz * rz) * esc, sy = cy - (dx * mfx + dz * mfz) * esc;
            if (Math.abs(sx - cx) > radio + lado || Math.abs(sy - cy) > radio + lado) continue;
            celda.setColor(color);
            canvas.drawRect(sx - lado / 2, sy - lado / 2, sx + lado / 2, sy + lado / 2, celda);
        }
        if (soldados != null) {
            for (Juego.Soldado s : soldados) {
                float dx = s.x - mpx, dz = s.z - mpz;
                float sx = cx + (dx * rx + dz * rz) * esc, sy = cy - (dx * mfx + dz * mfz) * esc;
                punto.setColor(Juego.enPie(s) ? (s.estado == Juego.CUBIERTA ? 0xFFFFA020 : 0xFFFF2020) : 0x80A0A0A0);
                canvas.drawCircle(sx, sy, 7, punto);
            }
        }
        // vos: un triángulo blanco mirando para arriba
        camino.reset();
        camino.moveTo(cx, cy - 12); camino.lineTo(cx - 8, cy + 8); camino.lineTo(cx + 8, cy + 8); camino.close();
        punto.setColor(Color.WHITE);
        canvas.drawPath(camino, punto);
        canvas.restore();
        punto.setStyle(Paint.Style.STROKE);
        punto.setStrokeWidth(3);
        punto.setColor(0xFFC9B0FF);
        canvas.drawCircle(cx, cy, radio, punto);
        punto.setStyle(Paint.Style.FILL);
        if (escaneando) {
            // la flecha hacia donde falta, en el borde del círculo
            float fl = (float) Math.hypot(g.faltaX, g.faltaZ);
            if (fl > 0.05f && g.cobertura < 0.85f) {
                float ax = (g.faltaX * rx + g.faltaZ * rz) / fl, ay = -(g.faltaX * mfx + g.faltaZ * mfz) / fl;
                float bx = cx + ax * (radio - 18), by = cy + ay * (radio - 18);
                camino.reset();
                camino.moveTo(bx + ax * 16, by + ay * 16);
                camino.lineTo(bx - ay * 12, by + ax * 12);
                camino.lineTo(bx + ay * 12, by - ax * 12);
                camino.close();
                flecha.setColor(0xFFFF40E0);
                canvas.drawPath(camino, flecha);
            }
            String t = Math.round(g.cobertura * 100) + " %";
            canvas.drawText(t, cx - chico.measureText(t) / 2, cy + radio + 36, chico);
        }
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
        ultimo = "";
        prog = Gl.programa(
                "attribute vec2 aPos; attribute vec2 aTex; varying vec2 vTex; void main() { gl_Position = vec4(aPos, 0.0, 1.0); vTex = aTex; }",
                "precision mediump float; uniform sampler2D uTex; uniform float uAlfa; varying vec2 vTex;\n"
                        + "void main() { vec4 c = texture2D(uTex, vTex); gl_FragColor = vec4(c.rgb, c.a * uAlfa); }");
        aPos = Gl.atributo(prog, "aPos");
        aTex = Gl.atributo(prog, "aTex");
        uTex = Gl.uniforme(prog, "uTex");
        uAlfa = Gl.uniforme(prog, "uAlfa");
        progMira = Gl.programa(
                "attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }",
                "precision mediump float; uniform vec4 uColor; void main() { gl_FragColor = uColor; }");
        mAPos = Gl.atributo(progMira, "aPos");
        mUColor = Gl.uniforme(progMira, "uColor");
        progBorde = Gl.programa(
                "attribute vec2 aPos; varying vec2 vP; void main() { gl_Position = vec4(aPos, 0.0, 1.0); vP = aPos; }",
                "precision mediump float; uniform float uAlfa; varying vec2 vP;\n"
                        + "void main() { float r = length(vP); gl_FragColor = vec4(0.75, 0.0, 0.0, uAlfa * smoothstep(0.55, 1.35, r)); }");
        bAPos = Gl.atributo(progBorde, "aPos");
        bUAlfa = Gl.uniforme(progBorde, "uAlfa");
    }

    /** Repinta el texto si cambió. arriba = estado; abajo = aviso grande (o null). */
    void poner(String arriba, float vida, int balas, int cargador, boolean recargando, String abajo) {
        String clave = arriba + "|" + (int) vida + "|" + balas + "|" + recargando + "|" + abajo;
        long ahora = System.currentTimeMillis();
        boolean mapaViejo = grilla != null && ahora - ultimoMapa > 250;
        if (clave.equals(ultimo) && !mapaViejo) return;
        if (mapaViejo) ultimoMapa = ahora;
        ultimo = clave;
        lienzo.eraseColor(Color.TRANSPARENT);
        dibujarMapa();
        // arriba: puntos · oleada
        canvas.drawRoundRect(new RectF(8, 8, W - 8, 150), 24, 24, caja);
        String[] l = arriba.split("\n");
        canvas.drawText(l[0], 32, 72, grande);
        if (l.length > 1) canvas.drawText(l[1], 32, 126, chico);
        // vida
        float x0 = 620, x1 = W - 32;
        barra.setColor(0x66000000);
        canvas.drawRoundRect(new RectF(x0, 36, x1, 64), 12, 12, barra);
        barra.setColor(vida > 50 ? 0xFF3DDC84 : vida > 25 ? 0xFFFFC107 : 0xFFFF3B30);
        canvas.drawRoundRect(new RectF(x0, 36, x0 + (x1 - x0) * Math.max(0, vida) / 100f, 64), 12, 12, barra);
        // balas: rayitas
        for (int i = 0; i < cargador; i++) {
            barra.setColor(i < balas ? 0xFFFFE0A0 : 0x44FFFFFF);
            float bx = x1 - (cargador - i) * 30;
            canvas.drawRoundRect(new RectF(bx, 84, bx + 18, 128), 5, 5, barra);
        }
        if (recargando) canvas.drawText("RECARGANDO", x0, 126, chico);
        if (abajo != null && !abajo.isEmpty()) {
            String[] a = abajo.split("\n");
            float y = 300;
            float x0 = 300, ancho = W - 40 - x0;   // a la derecha del minimapa
            canvas.drawRoundRect(new RectF(x0, 230, W - 40, 250 + a.length * 70), 28, 28, caja);
            for (String s : a) {
                float w = grande.measureText(s);
                Paint p = grande;
                if (w > ancho - 40) { p = chico; w = chico.measureText(s); }
                canvas.drawText(s, x0 + (ancho - w) / 2, y, p);
                y += 70;
            }
        }
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textura);
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, lienzo, 0);
    }

    /**
     * Dibuja el HUD en la vista actual. escala < 1 lo achica hacia el centro
     * (en el visor, las esquinas quedan fuera de lo que se ve bien).
     */
    void dibujar(float escala, float aspecto) {
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        // un rectángulo 2:1 que ocupa el ancho (achicado)
        float w = escala, h = escala * 0.5f * aspecto;
        if (h > escala) { h = escala; w = escala * 2f / aspecto; }
        float x0 = -w, x1 = w, y1 = escala, y0 = escala - 2 * h;
        quad.position(0);
        quad.put(x0).put(y0).put(0).put(1);
        quad.put(x1).put(y0).put(1).put(1);
        quad.put(x0).put(y1).put(0).put(0);
        quad.put(x1).put(y1).put(1).put(0);
        GLES20.glUseProgram(prog);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textura);
        GLES20.glUniform1i(uTex, 0);
        GLES20.glUniform1f(uAlfa, 1f);
        quad.position(0);
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 16, quad);
        quad.position(2);
        GLES20.glVertexAttribPointer(aTex, 2, GLES20.GL_FLOAT, false, 16, quad);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnableVertexAttribArray(aTex);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glDisableVertexAttribArray(aTex);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }

    /** La mira en el centro: cuatro rayitas y un punto; se abre con el retroceso. */
    void dibujarMira(float aspecto, float abre, boolean sobreEnemigo) {
        float s = 0.018f, g = 0.012f + abre * 0.02f, ax = 1f / aspecto;
        mira.position(0);
        mira.put(-(g + s) * ax).put(0).put(-g * ax).put(0);
        mira.put((g + s) * ax).put(0).put(g * ax).put(0);
        mira.put(0).put(-(g + s)).put(0).put(-g);
        mira.put(0).put(g + s).put(0).put(g);
        mira.put(-0.002f * ax).put(0).put(0.002f * ax).put(0);
        mira.put(0).put(-0.002f).put(0).put(0.002f);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glUseProgram(progMira);
        if (sobreEnemigo) GLES20.glUniform4f(mUColor, 1f, 0.3f, 0.25f, 1f);
        else GLES20.glUniform4f(mUColor, 1f, 1f, 1f, 0.95f);
        mira.position(0);
        GLES20.glVertexAttribPointer(mAPos, 2, GLES20.GL_FLOAT, false, 8, mira);
        GLES20.glEnableVertexAttribArray(mAPos);
        GLES20.glLineWidth(4f);
        GLES20.glDrawArrays(GLES20.GL_LINES, 0, 12);
        GLES20.glDisableVertexAttribArray(mAPos);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }

    /** El borde rojo cuando te pegan. */
    void dibujarGolpe(float alfa) {
        if (alfa <= 0.01f) return;
        quad.position(0);
        quad.put(-1).put(-1).put(1).put(-1).put(-1).put(1).put(1).put(1);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glUseProgram(progBorde);
        GLES20.glUniform1f(bUAlfa, alfa);
        quad.position(0);
        GLES20.glVertexAttribPointer(bAPos, 2, GLES20.GL_FLOAT, false, 8, quad);
        GLES20.glEnableVertexAttribArray(bAPos);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(bAPos);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }
}
