package com.juniorspro.mundoar;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingFailureReason;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.UnavailableApkTooOldException;
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableSdkTooOldException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

import java.util.Collection;
import java.util.concurrent.ArrayBlockingQueue;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * Mundo AR: una prueba de 6DoF nativo con ARCore. Acostada, pantalla
 * completa, con la cámara de fondo, un mundo 3D anclado al cuarto, blancos
 * para tocar y un botón de linterna.
 *
 * POR QUÉ NATIVO Y NO UN WEBVIEW. El WebView de Android no trae WebXR: una
 * página adentro de una app no puede pedirle poses a ARCore. Con ARCore
 * directo el seguimiento lo hace el sistema (cámara + giróscopo +
 * acelerómetro fundidos) a la frecuencia de la cámara, sin gastar JavaScript.
 */
public class Principal extends Activity implements GLSurfaceView.Renderer {
    private static final int PERMISO_CAMARA = 7;

    private GLSurfaceView vista;
    private TextView hud, aviso;
    private Button botonLinterna;

    private Session sesion;
    private Config config;
    private boolean pidioInstalar;
    private volatile boolean linterna;
    private boolean texturaPuesta;

    private final Fondo fondo = new Fondo();
    private final Cubo cubo = new Cubo();
    private final Planos planos = new Planos();
    private final Mundo mundo = new Mundo();

    private final ArrayBlockingQueue<float[]> toques = new ArrayBlockingQueue<>(16);
    private volatile boolean pedirReinicio;
    private int ancho = 1, alto = 1, rotacion = -1;
    private boolean cambioVista = true;

    private final float[] proy = new float[16], vistaM = new float[16], vp = new float[16], inversa = new float[16];
    private long t0 = SystemClock.elapsedRealtime(), ultimoCuadro, ultimoHud;
    private int cuadros, fps;
    private ToneGenerator tono;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout raiz = new FrameLayout(this);
        vista = new GLSurfaceView(this);
        vista.setPreserveEGLContextOnPause(true);
        vista.setEGLContextClientVersion(2);
        // Sin multimuestreo (antialias apagado): en gama baja es fill-rate que no sobra.
        vista.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        vista.setRenderer(this);
        vista.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        vista.setOnTouchListener((v, e) -> {
            if (e.getActionMasked() == MotionEvent.ACTION_DOWN || e.getActionMasked() == MotionEvent.ACTION_POINTER_DOWN) {
                int i = e.getActionIndex();
                toques.offer(new float[]{e.getX(i), e.getY(i)});
            }
            return true;
        });
        raiz.addView(vista);

        hud = texto(15, Gravity.START);
        hud.setText("PUNTOS 0");
        FrameLayout.LayoutParams lh = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.START);
        lh.setMargins(dp(16), dp(12), 0, 0);
        raiz.addView(hud, lh);

        aviso = texto(16, Gravity.CENTER);
        FrameLayout.LayoutParams la = new FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        la.setMargins(dp(24), 0, dp(24), dp(20));
        raiz.addView(aviso, la);

        LinearLayout botones = new LinearLayout(this);
        botones.setOrientation(LinearLayout.VERTICAL);
        botonLinterna = boton("LINTERNA: NO");
        botonLinterna.setOnClickListener(v -> cambiarLinterna());
        Button reiniciar = boton("REINICIAR");
        reiniciar.setOnClickListener(v -> pedirReinicio = true);
        botones.addView(botonLinterna);
        LinearLayout.LayoutParams lr = new LinearLayout.LayoutParams(-2, -2);
        lr.topMargin = dp(8);
        botones.addView(reiniciar, lr);
        FrameLayout.LayoutParams lb = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.END);
        lb.setMargins(0, dp(12), dp(16), 0);
        raiz.addView(botones, lb);

        setContentView(raiz);
        try { tono = new ToneGenerator(AudioManager.STREAM_MUSIC, 70); } catch (RuntimeException e) { tono = null; }
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private TextView texto(float sp, int gravedad) {
        TextView t = new TextView(this);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(gravedad);
        t.setShadowLayer(6, 0, 1, Color.BLACK);
        GradientDrawable f = new GradientDrawable();
        f.setColor(0x8C07030F);
        f.setCornerRadius(dp(12));
        t.setBackground(f);
        t.setPadding(dp(12), dp(8), dp(12), dp(8));
        return t;
    }

    private Button boton(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextColor(Color.WHITE);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setAllCaps(false);
        GradientDrawable f = new GradientDrawable();
        f.setColor(0xCC5A2FD9);
        f.setStroke(dp(1), 0xFFC9B0FF);
        f.setCornerRadius(dp(14));
        b.setBackground(f);
        b.setPadding(dp(16), dp(10), dp(16), dp(10));
        b.setMinHeight(dp(48));
        return b;
    }

    private void pantallaCompleta() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean foco) {
        super.onWindowFocusChanged(foco);
        if (foco) pantallaCompleta();
    }

    private void avisar(final String s) {
        runOnUiThread(() -> { aviso.setText(s); aviso.setVisibility(s == null || s.isEmpty() ? View.GONE : View.VISIBLE); });
    }

    @Override
    protected void onResume() {
        super.onResume();
        pantallaCompleta();
        if (sesion == null) {
            try {
                // Si el teléfono no tiene "Servicios de Google Play para RA", esto
                // abre la instalación y vuelve a onResume cuando termina.
                if (ArCoreApk.getInstance().requestInstall(this, !pidioInstalar) == ArCoreApk.InstallStatus.INSTALL_REQUESTED) {
                    pidioInstalar = true;
                    return;
                }
                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISO_CAMARA);
                    return;
                }
                sesion = new Session(this);
                config = new Config(sesion);
                config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
                config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL);
                config.setFocusMode(Config.FocusMode.AUTO);
                config.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
                config.setFlashMode(linterna ? Config.FlashMode.TORCH : Config.FlashMode.OFF);
                sesion.configure(config);
                texturaPuesta = false;
            } catch (UnavailableArcoreNotInstalledException | UnavailableUserDeclinedInstallationException e) {
                avisar("Hace falta instalar \"Servicios de Google Play para RA\" (ARCore).");
                return;
            } catch (UnavailableApkTooOldException e) {
                avisar("Actualizá \"Servicios de Google Play para RA\" desde el Play Store.");
                return;
            } catch (UnavailableSdkTooOldException e) {
                avisar("Esta app es más vieja que tu ARCore: hace falta una versión nueva.");
                return;
            } catch (UnavailableDeviceNotCompatibleException e) {
                avisar("Este teléfono no es compatible con ARCore: no tiene 6DoF nativo.");
                return;
            } catch (Exception e) {
                avisar("No pude arrancar ARCore: " + e.getMessage());
                return;
            }
        }
        try {
            sesion.resume();
        } catch (CameraNotAvailableException e) {
            avisar("La cámara está ocupada por otra app. Cerrala y volvé.");
            sesion = null;
            return;
        }
        vista.onResume();
        avisar("Mové el teléfono despacio para que encuentre el cuarto…");
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(codigo, permisos, resultados);
        if (codigo == PERMISO_CAMARA && (resultados.length == 0 || resultados[0] != PackageManager.PERMISSION_GRANTED)) {
            avisar("Sin permiso de cámara no hay realidad aumentada. Dálo en Ajustes → Apps → Mundo AR.");
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (sesion != null) {
            vista.onPause();
            sesion.pause();
        }
    }

    @Override
    protected void onDestroy() {
        if (sesion != null) { sesion.close(); sesion = null; }
        if (tono != null) tono.release();
        super.onDestroy();
    }

    private void cambiarLinterna() {
        final boolean querer = !linterna;
        vista.queueEvent(() -> {
            if (sesion == null || config == null) return;
            try {
                config.setFlashMode(querer ? Config.FlashMode.TORCH : Config.FlashMode.OFF);
                sesion.configure(config);
                linterna = querer;
            } catch (Exception e) {
                config.setFlashMode(Config.FlashMode.OFF);
                try { sesion.configure(config); } catch (Exception ignorada) { /* queda como estaba */ }
                linterna = false;
                avisar("Este teléfono no deja prender la linterna mientras ARCore usa la cámara.");
            }
            runOnUiThread(() -> botonLinterna.setText(linterna ? "LINTERNA: SÍ" : "LINTERNA: NO"));
        });
    }

    // ───────────────────────── el dibujo (hilo de GL) ─────────────────────────

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig c) {
        GLES20.glClearColor(0.03f, 0.01f, 0.06f, 1f);
        fondo.crear();
        cubo.crear();
        planos.crear();
        texturaPuesta = false;
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int w, int h) {
        GLES20.glViewport(0, 0, w, h);
        ancho = w; alto = h;
        cambioVista = true;
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        if (sesion == null) return;
        long ahora = SystemClock.elapsedRealtime();
        float t = (ahora - t0) / 1000f;
        float dt = ultimoCuadro == 0 ? 0 : Math.min(0.1f, (ahora - ultimoCuadro) / 1000f);
        ultimoCuadro = ahora;

        if (!texturaPuesta) { sesion.setCameraTextureName(fondo.textura()); texturaPuesta = true; }
        // Acostado para un lado o para el otro: ARCore tiene que saber cómo está la pantalla.
        int rot = getWindowManager().getDefaultDisplay().getRotation();
        if (cambioVista || rot != rotacion) {
            sesion.setDisplayGeometry(rot, ancho, alto);
            rotacion = rot; cambioVista = false;
        }
        if (pedirReinicio) { pedirReinicio = false; mundo.reiniciar(); }

        Frame cuadro;
        try {
            cuadro = sesion.update();
        } catch (CameraNotAvailableException e) {
            avisar("Se perdió la cámara.");
            return;
        }
        Camera camara = cuadro.getCamera();
        fondo.dibujar(cuadro);

        cuadros++;
        if (ahora - ultimoHud > 250) {
            fps = Math.round(cuadros * 1000f / Math.max(1, ahora - ultimoHud));
            cuadros = 0; ultimoHud = ahora;
            actualizarHud(camara);
        }

        if (camara.getTrackingState() != TrackingState.TRACKING) {
            toques.clear();
            return;
        }
        camara.getProjectionMatrix(proy, 0, 0.05f, 60f);
        camara.getViewMatrix(vistaM, 0);
        Matrix.multiplyMM(vp, 0, proy, 0, vistaM, 0);
        Matrix.invertM(inversa, 0, vp, 0);

        if (!mundo.hayAnillo()) mundo.ponerAnillo(sesion, camara.getPose());

        // Toques: primero contra los blancos; si no pegó en ninguno, contra el piso.
        float[] toque;
        while ((toque = toques.poll()) != null) {
            float nx = toque[0] / ancho * 2 - 1, ny = 1 - toque[1] / alto * 2;
            int gano = mundo.tocar(inversa, nx, ny, t);
            if (gano > 0) {
                if (tono != null) tono.startTone(ToneGenerator.TONE_PROP_BEEP, 60);
                continue;
            }
            for (HitResult h : cuadro.hitTest(toque[0], toque[1])) {
                if (!(h.getTrackable() instanceof Plane)) continue;
                Plane p = (Plane) h.getTrackable();
                if (!p.isPoseInPolygon(h.getHitPose())) continue;
                if (!mundo.hayArena()) mundo.ponerArena(h.createAnchor());
                else if (mundo.cantidadBlancos() < 24) mundo.ponerBlanco(h.createAnchor());
                break;
            }
        }

        Collection<Plane> todos = sesion.getAllTrackables(Plane.class);
        int n = planos.dibujar(todos, vp, mundo.hayArena() ? 0.45f : 1f);
        mundo.actualizar(dt);
        mundo.dibujar(cubo, vp, t);
        planosVistos = n;
    }

    private volatile int planosVistos;

    private void actualizarHud(Camera camara) {
        final String seguimiento;
        if (camara.getTrackingState() == TrackingState.TRACKING) seguimiento = "6DoF: OK";
        else {
            TrackingFailureReason r = camara.getTrackingFailureReason();
            switch (r) {
                case INSUFFICIENT_LIGHT: seguimiento = "6DoF: falta luz (probá la linterna)"; break;
                case EXCESSIVE_MOTION: seguimiento = "6DoF: más despacio"; break;
                case INSUFFICIENT_FEATURES: seguimiento = "6DoF: apuntá a algo con textura"; break;
                case CAMERA_UNAVAILABLE: seguimiento = "6DoF: cámara ocupada"; break;
                default: seguimiento = "6DoF: buscando…";
            }
        }
        final float[] p = camara.getPose().getTranslation();
        final String texto = "PUNTOS " + mundo.puntos + (mundo.combo > 1 ? "  x" + mundo.combo : "")
                + "\n" + seguimiento + " · " + fps + " FPS"
                + "\nplanos " + planosVistos + " · pos " + String.format(java.util.Locale.ROOT, "%.2f %.2f %.2f", p[0], p[1], p[2]);
        final String ayuda = camara.getTrackingState() != TrackingState.TRACKING ? "Mové el teléfono despacio para que encuentre el cuarto…"
                : !mundo.hayArena() ? (planosVistos > 0 ? "Tocá la grilla del piso para poner la arena" : "Apuntá al piso y movete un poco para encontrarlo")
                : "Tocá los cubos · caminá alrededor: tienen que quedarse quietos";
        runOnUiThread(() -> {
            hud.setText(texto);
            aviso.setText(ayuda);
            aviso.setVisibility(View.VISIBLE);
        });
    }
}
