package com.juniorspro.nexoxr;

import android.app.Activity;
import android.app.Presentation;
import android.content.Context;
import android.graphics.SurfaceTexture;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;

import java.nio.FloatBuffer;

/**
 * Una PANTALLA DE VERDAD en el espacio: una vista de Android (un navegador,
 * la galería, los ajustes, la barra de abajo) que se dibuja en una pantalla
 * virtual privada de la app, y de ahí a una textura de OpenGL que el visor
 * pone donde está la ventana.
 *
 *   vista → Presentation → VirtualDisplay → Surface → SurfaceTexture (OES)
 *         → copia con mipmaps (textura normal: el texto no parpadea de lejos)
 *
 * Los toques del puntero (u, v) se vuelven MotionEvent en la vista (bajar,
 * mover, subir: Android hace el resto: clics, scroll, arrastrar), y el teclado
 * del sistema manda sus letras como KeyEvent. El teclado de Android no se abre
 * (FLAG_ALT_FOCUSABLE_IM): se usa el nuestro, que está en el espacio.
 *
 * Se crea en el hilo de dibujo (la textura) y se muestra en el hilo de la app.
 */
final class PanelVirtual implements SurfaceTexture.OnFrameAvailableListener {
    final Ventana ventana;
    final int ancho, alto, dpi;
    private final Activity actividad;
    private final Handler ui = new Handler(Looper.getMainLooper());
    /** Arma la vista con el contexto de la pantalla virtual (su densidad: si no, todo sale enorme). */
    interface Fabrica { View crear(Context pantalla); }
    private final Fabrica fabrica;
    private volatile View vista;

    // en la app
    private VirtualDisplay pantalla;
    private Presentation presentacion;
    private long bajoEn;
    private boolean abajo;

    // en el hilo de dibujo
    private int texOes, fbo, texMip;
    final int mipW, mipH;
    private SurfaceTexture st;
    private Surface superficie;
    private volatile boolean hayCuadro;
    private final float[] matriz = new float[16];
    boolean tieneImagen;
    private static int progCopia, cPos, cMat, cTex;
    private static final FloatBuffer CUADRO = Gl.bufer(new float[]{-1, -1, 1, -1, -1, 1, 1, 1});

    PanelVirtual(Activity a, Ventana v, Fabrica f, int dpi) {
        actividad = a;
        ventana = v;
        fabrica = f;
        ancho = v.px; alto = v.py;
        this.dpi = dpi;
        mipW = Gl.potencia2(ancho);
        mipH = Gl.potencia2(alto);
    }

    View vista() { return vista; }

    /** En el hilo de dibujo: la textura, la superficie, y (en la app) la pantalla virtual con la vista. */
    void crearGl() {
        int[] t = new int[2];
        GLES20.glGenTextures(2, t, 0);
        texOes = t[0];
        texMip = t[1];
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, texOes);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        // la copia con mipmaps (potencia de 2: en OpenGL ES 2 los mipmaps la piden)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texMip);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, mipW, mipH, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR_MIPMAP_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glGenerateMipmap(GLES20.GL_TEXTURE_2D);
        int[] f = new int[1];
        GLES20.glGenFramebuffers(1, f, 0);
        fbo = f[0];
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo);
        GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0, GLES20.GL_TEXTURE_2D, texMip, 0);
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0);
        tieneImagen = false;
        if (progCopia == 0 || !GLES20.glIsProgram(progCopia)) {
            progCopia = Gl.programa(
                    "attribute vec2 aPos; uniform mat4 uMat; varying vec2 vTex;\n"
                            + "void main() { gl_Position = vec4(aPos, 0.0, 1.0); vTex = (uMat * vec4(aPos * 0.5 + 0.5, 0.0, 1.0)).xy; }",
                    "#extension GL_OES_EGL_image_external : require\n"
                            + "precision mediump float; uniform samplerExternalOES uTex; varying vec2 vTex;\n"
                            + "void main() { gl_FragColor = texture2D(uTex, vTex); }");
            cPos = Gl.atributo(progCopia, "aPos");
            cMat = Gl.uniforme(progCopia, "uMat");
            cTex = Gl.uniforme(progCopia, "uTex");
        }
        Surface vieja = superficie;
        SurfaceTexture stVieja = st;
        st = new SurfaceTexture(texOes);
        st.setDefaultBufferSize(ancho, alto);
        st.setOnFrameAvailableListener(this);
        superficie = new Surface(st);
        final Surface nueva = superficie;
        ui.post(() -> {
            if (pantalla != null) pantalla.setSurface(nueva);   // se perdió el contexto de OpenGL: la misma pantalla, otra superficie
            else mostrar(nueva);
            if (vieja != null) vieja.release();
            if (stVieja != null) stVieja.release();
        });
    }

    /** En la app: la pantalla virtual (privada) y la vista en ella. */
    private void mostrar(Surface s) {
        try {
            DisplayManager dm = (DisplayManager) actividad.getSystemService(Context.DISPLAY_SERVICE);
            pantalla = dm.createVirtualDisplay("nexo-" + ventana.app, ancho, alto, dpi, s, 0);
            presentacion = new Presentation(actividad, pantalla.getDisplay());
            presentacion.getWindow().addFlags(WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
            presentacion.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
            vista = fabrica.crear(presentacion.getContext());
            presentacion.setContentView(vista);
            presentacion.show();
            ui.postDelayed(mirarFoco, 300);
        } catch (Throwable e) {
            Fallo.guardar("pantalla virtual (" + ventana.app + ")", e);
        }
    }

    @Override
    public void onFrameAvailable(SurfaceTexture s) { hayCuadro = true; }

    /** En el hilo de dibujo, cada cuadro: si llegó una imagen nueva, se copia con mipmaps. */
    void actualizar() {
        if (!hayCuadro || st == null) return;
        hayCuadro = false;
        try { st.updateTexImage(); } catch (Exception e) { return; }
        st.getTransformMatrix(matriz);
        int[] vp = new int[4];
        GLES20.glGetIntegerv(GLES20.GL_VIEWPORT, vp, 0);
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo);
        GLES20.glViewport(0, 0, mipW, mipH);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glUseProgram(progCopia);
        GLES20.glUniformMatrix4fv(cMat, 1, false, matriz, 0);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, texOes);
        GLES20.glUniform1i(cTex, 0);
        CUADRO.position(0);
        GLES20.glVertexAttribPointer(cPos, 2, GLES20.GL_FLOAT, false, 0, CUADRO);
        GLES20.glEnableVertexAttribArray(cPos);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(cPos);
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texMip);
        GLES20.glGenerateMipmap(GLES20.GL_TEXTURE_2D);
        GLES20.glViewport(vp[0], vp[1], vp[2], vp[3]);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        tieneImagen = true;
    }

    int textura() { return texMip; }

    // ── los toques y las teclas (en la app) ──

    /** Un toque del puntero: accion de Puntero (BAJA, MUEVE, SUBE, CANCELA), u, v ∈ 0..1. */
    void tocar(int accion, float u, float v) {
        ui.post(() -> {
            if (presentacion == null) return;
            long ahora = SystemClock.uptimeMillis();
            int a;
            switch (accion) {
                case Puntero.BAJA: a = MotionEvent.ACTION_DOWN; bajoEn = ahora; abajo = true; break;
                case Puntero.MUEVE: if (!abajo) return; a = MotionEvent.ACTION_MOVE; break;
                case Puntero.SUBE: if (!abajo) return; a = MotionEvent.ACTION_UP; abajo = false; break;
                default: if (!abajo) return; a = MotionEvent.ACTION_CANCEL; abajo = false;
            }
            MotionEvent e = MotionEvent.obtain(bajoEn, ahora, a, u * ancho, v * alto, 0);
            e.setSource(InputDevice.SOURCE_TOUCHSCREEN);
            try { presentacion.dispatchTouchEvent(e); } catch (Throwable ignorado) { }
            e.recycle();
        });
    }

    /** El scroll del joystick del control (o de dos dedos): mueve lo que haya en (u, v). */
    void rodar(float u, float v, float cuanto) {
        ui.post(() -> {
            if (presentacion == null) return;
            long ahora = SystemClock.uptimeMillis();
            MotionEvent.PointerProperties[] pp = {new MotionEvent.PointerProperties()};
            pp[0].id = 0; pp[0].toolType = MotionEvent.TOOL_TYPE_MOUSE;
            MotionEvent.PointerCoords[] pc = {new MotionEvent.PointerCoords()};
            pc[0].x = u * ancho; pc[0].y = v * alto;
            pc[0].setAxisValue(MotionEvent.AXIS_VSCROLL, cuanto);
            MotionEvent e = MotionEvent.obtain(ahora, ahora, MotionEvent.ACTION_SCROLL, 1, pp, pc, 0, 0, 1, 1, 0, 0, InputDevice.SOURCE_MOUSE, 0);
            try { presentacion.getWindow().getDecorView().dispatchGenericMotionEvent(e); } catch (Throwable ignorado) { }
            e.recycle();
        });
    }

    private static final KeyCharacterMap TECLAS = KeyCharacterMap.load(KeyCharacterMap.VIRTUAL_KEYBOARD);

    /** Escribe texto donde esté el foco (un campo de texto, una página). */
    void escribir(String texto) {
        ui.post(() -> {
            if (presentacion == null) return;
            View foco = presentacion.getWindow().getDecorView().findFocus();
            if (foco instanceof EditText) {
                EditText t = (EditText) foco;
                int a = Math.max(0, Math.min(t.getSelectionStart(), t.getSelectionEnd())), b = Math.max(t.getSelectionStart(), t.getSelectionEnd());
                t.getText().replace(a, Math.max(a, b), texto);
                return;
            }
            KeyEvent[] ev = TECLAS.getEvents(texto.toCharArray());
            if (ev != null) for (KeyEvent k : ev) presentacion.dispatchKeyEvent(k);
            else presentacion.dispatchKeyEvent(new KeyEvent(SystemClock.uptimeMillis(), texto, KeyCharacterMap.VIRTUAL_KEYBOARD, 0));
        });
    }

    /** Una tecla especial (borrar, enter, flechas). */
    void tecla(int codigo) {
        ui.post(() -> {
            if (presentacion == null) return;
            long t = SystemClock.uptimeMillis();
            presentacion.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, codigo, 0));
            presentacion.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, codigo, 0));
        });
    }

    /** ¿Tiene un campo de texto con el foco? (para mostrar el teclado; se mira en la app cada 300 ms) */
    volatile boolean escribiendo;

    private final Runnable mirarFoco = new Runnable() {
        @Override
        public void run() {
            Presentation p = presentacion;
            if (p == null) return;
            View f = p.getWindow().getDecorView().findFocus();
            escribiendo = f instanceof EditText || (f instanceof android.webkit.WebView && f.onCheckIsTextEditor());
            ui.postDelayed(this, 300);
        }
    };


    /** En el hilo de dibujo: suelta las texturas de esta pantalla (≈ 11 MB cada una). */
    void liberarGl() {
        if (texOes != 0) GLES20.glDeleteTextures(2, new int[]{texOes, texMip}, 0);
        if (fbo != 0) GLES20.glDeleteFramebuffers(1, new int[]{fbo}, 0);
        texOes = texMip = fbo = 0;
        tieneImagen = false;
    }

    void cerrar() {
        ui.post(() -> {
            ui.removeCallbacks(mirarFoco);
            try { if (presentacion != null) presentacion.dismiss(); } catch (Throwable ignorado) { }
            if (pantalla != null) pantalla.release();
            presentacion = null;
            pantalla = null;
            if (superficie != null) superficie.release();
            if (st != null) st.release();
        });
    }
}
