package com.juniorspro.asaltomr;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.Image;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraIntrinsics;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.Plane;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingFailureReason;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.NotYetAvailableException;
import com.google.ar.core.exceptions.UnavailableApkTooOldException;
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableSdkTooOldException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

import java.nio.ByteOrder;
import java.util.EnumSet;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * Asalto MR: el shooter de realidad mixta del video (soldados que corren por
 * tu patio y salen volando de un tiro), con ARCore.
 *
 * - El entorno se ESCANEA como malla de polígonos con la Depth API (Tsdf +
 *   Mallador, en su propio hilo): no hay "mesas" ni "sillas", hay superficie.
 *   Esa malla tapa a lo virtual (oclusión), es el piso por donde caminan los
 *   soldados, lo que esquivan, y donde pegan las balas.
 * - La IA del entorno (Mapa, en el hilo del escaneo): la red de Scene
 *   Semantics de ARCore etiqueta cada superficie (pasto, vereda, calle, agua,
 *   árbol, edificio…), el mapa decide por dónde se puede ir, dónde hay
 *   cubierta y qué falta escanear, y COMPLETA lo que no se ve. Los soldados
 *   lo usan para moverse (rutas, cubiertas, asomarse).
 * - Pantalla normal o SBS para un visor tipo Cardboard: dos ojos con su IPD,
 *   corrección de los lentes y, si se quiere, el entorno reproyectado con la
 *   malla para que lo real también tenga profundidad.
 * - La cámara con más campo visual que dé ARCore, y un intento de ultra
 *   angular (ver Camara).
 *
 * Se dispara tocando la pantalla (o el botón del visor), con las teclas de
 * volumen, o con un control / disparador Bluetooth.
 */
public class Principal extends Activity implements GLSurfaceView.Renderer, Panel.Oyente, Camara.Aviso {
    private static final int PERMISO_CAMARA = 7;

    private GLSurfaceView vista;
    private TextView aviso;
    private LinearLayout botones;
    private Panel panel;
    private final Ajustes ajustes = new Ajustes();
    private volatile Ajustes vistos;

    private Session sesion;
    private Config config;
    private Camara compartida;
    private HandlerThread hiloCamara;
    private Handler manejadorCamara;
    private volatile boolean corriendo, hayProfundidad, haySemantica;
    private boolean pidioInstalar, texturaPuesta;
    private volatile String textoCamara = "";
    private volatile boolean linterna;

    private final Fondo fondo = new Fondo();
    private final MallaGl mallaGl = new MallaGl();
    private final Figuras figuras = new Figuras();
    private final Hud hud = new Hud();
    private final Lentes lentes = new Lentes();
    private final ZonasGl zonasGl = new ZonasGl();
    private final Sonido sonido = new Sonido();
    private Escaneo escaneo;
    private Juego juego;
    private EntornoReal entorno;
    private Vibrator vibrador;

    private final AtomicInteger tiros = new AtomicInteger();
    private volatile boolean pedirReescaneo, pedirReinicio;
    private int ancho = 1, alto = 1, rotacion = -1, geoW = -1, geoH = -1;
    private boolean cambioVista = true;
    private long ultimaProf = -1, t0 = SystemClock.elapsedRealtime(), ultimoCuadro, ultimoHud, inicioSeguimiento, listoDesde, finDesde;
    private int cuadros, fps;
    private float xdpi = 400;

    private final float[] proy = new float[16], vistaM = new float[16], vpCam = new float[16], vistaOjo = new float[16],
            vpOjo = new float[16], desplazar = new float[16], proyOjo = new float[16], poseM = new float[16], boca = new float[3];

    // ───────────────────────── interfaz ─────────────────────────

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        Fallo.instalar(this);
        ajustes.cargar(this);
        // si la vez anterior se cayó, primero mostrar por qué
        String error = Fallo.leer(this);
        if (error != null) { mostrarFallo(error); return; }
        try {
            armar();
        } catch (Throwable e) {
            Fallo.guardar("al abrir", e);
            mostrarFallo(Fallo.leer(this));
        }
    }

    /** La pantalla del error: el texto, copiarlo, y abrir (normal o en modo seguro). */
    private void mostrarFallo(String error) {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setBackgroundColor(0xFF07030F);
        l.setPadding(dp(18), dp(14), dp(18), dp(14));
        TextView t = new TextView(this);
        t.setText("La vez anterior Asalto MR se cerró por un error. Copialo y pegalo en el chat para arreglarlo:");
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        l.addView(t);
        LinearLayout fila = new LinearLayout(this);
        fila.setOrientation(LinearLayout.HORIZONTAL);
        Button copiar = boton("COPIAR EL ERROR"), seguro = boton("ABRIR EN MODO SEGURO"), igual = boton("ABRIR IGUAL");
        final String texto = error == null ? "(sin texto)" : error;
        copiar.setOnClickListener(v -> {
            android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("Asalto MR", texto));
            android.widget.Toast.makeText(this, "Copiado", android.widget.Toast.LENGTH_SHORT).show();
        });
        seguro.setOnClickListener(v -> { ajustes.ponerSeguro(); ajustes.guardar(this); Fallo.borrar(this); recreate(); });
        igual.setOnClickListener(v -> { Fallo.borrar(this); recreate(); });
        for (Button b : new Button[]{copiar, seguro, igual}) {
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
            lp.setMargins(dp(4), dp(10), dp(4), dp(10));
            fila.addView(b, lp);
        }
        l.addView(fila);
        android.widget.ScrollView sv = new android.widget.ScrollView(this);
        TextView e = new TextView(this);
        e.setText(texto);
        e.setTextColor(0xFFFFB0A0);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        e.setTypeface(Typeface.MONOSPACE);
        e.setTextIsSelectable(true);
        sv.addView(e);
        l.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(l);
    }

    /** Arma la app de verdad (la vista de GL, el HUD, los botones, el panel). */
    private void armar() {
        vistos = ajustes.copia();
        DisplayMetrics dm = getResources().getDisplayMetrics();
        xdpi = dm.xdpi > 100 ? dm.xdpi : dm.densityDpi;
        vibrador = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        escaneo = new Escaneo(ajustes.voxel());
        entorno = new EntornoReal(escaneo);
        juego = new Juego(SystemClock.elapsedRealtime());
        juego.dificultad = ajustes.dificultad;
        sonido.cargar(this);
        sonido.activo = ajustes.sonido == 1;

        FrameLayout raiz = new FrameLayout(this);
        vista = new GLSurfaceView(this);
        vista.setPreserveEGLContextOnPause(true);
        vista.setEGLContextClientVersion(2);
        vista.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        vista.setRenderer(this);
        vista.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        vista.setOnTouchListener((v, e) -> {
            int a = e.getActionMasked();
            if (a == MotionEvent.ACTION_DOWN || a == MotionEvent.ACTION_POINTER_DOWN) tiros.incrementAndGet();
            return true;
        });
        raiz.addView(vista);

        aviso = new TextView(this);
        aviso.setTextColor(Color.WHITE);
        aviso.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        aviso.setTypeface(Typeface.DEFAULT_BOLD);
        aviso.setGravity(Gravity.CENTER);
        aviso.setShadowLayer(6, 0, 1, Color.BLACK);
        GradientDrawable fa = new GradientDrawable();
        fa.setColor(0xCC07030F);
        fa.setCornerRadius(dp(12));
        aviso.setBackground(fa);
        aviso.setPadding(dp(14), dp(10), dp(14), dp(10));
        aviso.setVisibility(View.GONE);
        FrameLayout.LayoutParams la = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER);
        la.setMargins(dp(40), dp(40), dp(40), dp(40));
        raiz.addView(aviso, la);

        botones = new LinearLayout(this);
        botones.setOrientation(LinearLayout.VERTICAL);
        Button bSbs = boton("SBS");
        bSbs.setOnClickListener(v -> { ajustes.sbs = 1; ajustes.guardar(this); cambio("sbs"); });
        Button bAjustes = boton("AJUSTES");
        bAjustes.setOnClickListener(v -> abrirPanel(true));
        Button bLinterna = boton("LINTERNA");
        bLinterna.setOnClickListener(v -> cambiarLinterna());
        botones.addView(bSbs);
        botones.addView(bAjustes, margenArriba());
        botones.addView(bLinterna, margenArriba());
        FrameLayout.LayoutParams lb = new FrameLayout.LayoutParams(-2, -2, Gravity.END | Gravity.CENTER_VERTICAL);
        lb.setMargins(0, 0, dp(14), 0);
        raiz.addView(botones, lb);

        panel = new Panel(this, ajustes, this);
        panel.vista.setVisibility(View.GONE);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(420), -1, Gravity.CENTER);
        lp.setMargins(0, dp(12), 0, dp(12));
        raiz.addView(panel.vista, lp);

        setContentView(raiz);
        aplicarVisibilidad();
        armada = true;
    }

    /** ¿Se armó la app? (si se mostró la pantalla del error, no) */
    private boolean armada;

    private LinearLayout.LayoutParams margenArriba() {
        LinearLayout.LayoutParams l = new LinearLayout.LayoutParams(-2, -2);
        l.topMargin = dp(8);
        return l;
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private Button boton(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextColor(Color.WHITE);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setAllCaps(false);
        GradientDrawable f = new GradientDrawable();
        f.setColor(0xB35A2FD9);
        f.setStroke(dp(1), 0xFFC9B0FF);
        f.setCornerRadius(dp(14));
        b.setBackground(f);
        b.setPadding(dp(14), dp(8), dp(14), dp(8));
        b.setMinHeight(dp(44));
        return b;
    }

    private void abrirPanel(boolean abrir) {
        panel.refrescar();
        panel.info.setText(textoCamara + (hayProfundidad ? "\nDepth API: sí (escaneo de malla)" : "\nDepth API: no (sólo planos)")
                + (haySemantica ? "\nScene Semantics: sí (la IA sabe qué es cada superficie)" : "\nScene Semantics: no (la IA usa sólo la forma)"));
        panel.vista.setVisibility(abrir ? View.VISIBLE : View.GONE);
        escaneo.pausado = false;
        aplicarVisibilidad();
    }

    /** En SBS no hay botones (no se ven bien en el visor); se sale con Atrás. */
    private void aplicarVisibilidad() {
        boolean sbs = ajustes.sbs == 1;
        botones.setVisibility(sbs || panel.vista.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE);
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

    // ── Panel.Oyente ──

    @Override
    public void cambio(String clave) {
        vistos = ajustes.copia();
        switch (clave) {
            case "detalle": pedirReescaneo = true; break;
            case "dificultad": juego.dificultad = ajustes.dificultad; break;
            case "sonido": sonido.activo = ajustes.sonido == 1; break;
            case "sbs": aplicarVisibilidad(); cambioVista = true; break;
            case "camara": reabrirCamara(); break;
            default: cambioVista = true;
        }
    }

    @Override
    public void accion(String cual) {
        switch (cual) {
            case "cerrar": abrirPanel(false); break;
            case "reescanear": pedirReescaneo = true; break;
            case "reiniciar": pedirReinicio = true; abrirPanel(false); break;
            default: break;
        }
    }

    // ── teclas: volumen, control Bluetooth, disparador de selfie ──

    @Override
    public boolean onKeyDown(int codigo, KeyEvent e) {
        switch (codigo) {
            case KeyEvent.KEYCODE_VOLUME_UP:
            case KeyEvent.KEYCODE_VOLUME_DOWN:
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_BUTTON_R1:
            case KeyEvent.KEYCODE_BUTTON_R2:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_SPACE:
            case KeyEvent.KEYCODE_CAMERA:
                if (e.getRepeatCount() == 0) tiros.incrementAndGet();
                return true;
            case KeyEvent.KEYCODE_BUTTON_X:
            case KeyEvent.KEYCODE_BUTTON_B:
                vista.queueEvent(() -> juego.recargar());
                return true;
            default:
                return super.onKeyDown(codigo, e);
        }
    }

    @Override
    public boolean onKeyUp(int codigo, KeyEvent e) {
        if (codigo == KeyEvent.KEYCODE_VOLUME_UP || codigo == KeyEvent.KEYCODE_VOLUME_DOWN) return true;
        return super.onKeyUp(codigo, e);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (panel.vista.getVisibility() == View.VISIBLE) { abrirPanel(false); return; }
        if (ajustes.sbs == 1) { ajustes.sbs = 0; ajustes.guardar(this); cambio("sbs"); return; }
        super.onBackPressed();
    }

    private void vibrar(int ms) {
        if (vibrador == null || vistos.vibrar == 0) return;
        if (android.os.Build.VERSION.SDK_INT >= 26) vibrador.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        else vibrador.vibrate(ms);
    }

    // ───────────────────────── ARCore ─────────────────────────

    @Override
    protected void onResume() {
        super.onResume();
        if (!armada) return;
        pantallaCompleta();
        escaneo.arrancar();
        if (sesion == null && !crearSesion()) return;
        reanudar();
    }

    private boolean crearSesion() {
        try {
            if (ArCoreApk.getInstance().requestInstall(this, !pidioInstalar) == ArCoreApk.InstallStatus.INSTALL_REQUESTED) {
                pidioInstalar = true;
                return false;
            }
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISO_CAMARA);
                return false;
            }
            boolean ultra = ajustes.camara == 2 && ajustes.seguro == 0;
            sesion = ultra ? new Session(this, EnumSet.of(Session.Feature.SHARED_CAMERA)) : new Session(this);
            // la cámara: la de ARCore, o la de más campo visual
            if (ajustes.camara >= 1 && ajustes.seguro == 0) {
                CameraConfig c = Camara.masAncha(this, sesion);
                if (c != null) sesion.setCameraConfig(c);
            }
            textoCamara = Camara.describir(this, sesion.getCameraConfig());
            config = new Config(sesion);
            config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
            config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL);
            config.setFocusMode(Config.FocusMode.AUTO);
            config.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
            hayProfundidad = sesion.isDepthModeSupported(Config.DepthMode.AUTOMATIC);
            config.setDepthMode(hayProfundidad ? Config.DepthMode.AUTOMATIC : Config.DepthMode.DISABLED);
            // la red neuronal de ARCore que etiqueta cada píxel (anda sobre todo al aire libre)
            try { haySemantica = ajustes.seguro == 0 && sesion.isSemanticModeSupported(Config.SemanticMode.ENABLED); } catch (Exception e) { haySemantica = false; }
            config.setSemanticMode(haySemantica ? Config.SemanticMode.ENABLED : Config.SemanticMode.DISABLED);
            if (!ultra) config.setFlashMode(linterna ? Config.FlashMode.TORCH : Config.FlashMode.OFF);
            sesion.configure(config);
            texturaPuesta = false;
            cambioVista = true;
            if (ultra) {
                hiloCamara = new HandlerThread("camara");
                hiloCamara.start();
                manejadorCamara = new Handler(hiloCamara.getLooper());
                compartida = new Camara(this, sesion, manejadorCamara, this);
                compartida.linterna = linterna;
            }
            if (!hayProfundidad) avisar("Tu teléfono no tiene la Depth API de ARCore: no hay escaneo de malla, se juega sobre los planos del piso.");
            return true;
        } catch (UnavailableArcoreNotInstalledException | UnavailableUserDeclinedInstallationException e) {
            avisar("Hace falta instalar \"Servicios de Google Play para RA\" (ARCore).");
        } catch (UnavailableApkTooOldException e) {
            avisar("Actualizá \"Servicios de Google Play para RA\" desde el Play Store.");
        } catch (UnavailableSdkTooOldException e) {
            avisar("Esta app es más vieja que tu ARCore: hace falta una versión nueva.");
        } catch (UnavailableDeviceNotCompatibleException e) {
            avisar("Este teléfono no es compatible con ARCore.");
        } catch (Exception e) {
            avisar("No pude arrancar ARCore: " + e.getMessage());
        }
        sesion = null;
        return false;
    }

    private void reanudar() {
        if (compartida != null) {
            // modo compartido: primero se abre la cámara; ARCore arranca en camaraLista()
            try { compartida.abrir(); } catch (Exception e) { camaraFallo(e.getMessage()); return; }
        } else {
            try {
                sesion.resume();
            } catch (CameraNotAvailableException e) {
                avisar("La cámara está ocupada por otra app. Cerrala y volvé.");
                sesion = null;
                return;
            }
            corriendo = true;
        }
        vista.onResume();
    }

    @Override
    public void camaraLista() {
        try {
            sesion.resume();
            compartida.repetir();
            corriendo = true;
            textoCamara = Camara.describir(this, sesion.getCameraConfig()) + "\n" + compartida.estado;
        } catch (Exception e) {
            camaraFallo("resume: " + e.getMessage());
        }
    }

    @Override
    public void camaraFallo(String por) {
        runOnUiThread(() -> {
            avisar("Ultra angular no anduvo (" + por + "). Vuelvo a \"Más ancha\".");
            ajustes.camara = 1;
            ajustes.guardar(this);
            vistos = ajustes.copia();
            reabrirCamara();
        });
    }

    /** Cerrar y abrir la sesión (para cambiar de cámara). El escaneo se pierde: las poses cambian de origen. */
    private void reabrirCamara() {
        pausar();
        cerrarSesion();
        pedirReescaneo = true;
        if (crearSesion()) reanudar();
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(codigo, permisos, resultados);
        if (codigo == PERMISO_CAMARA && (resultados.length == 0 || resultados[0] != PackageManager.PERMISSION_GRANTED))
            avisar("Sin permiso de cámara no hay realidad mixta. Dálo en Ajustes → Apps → Asalto MR.");
    }

    private void pausar() {
        corriendo = false;
        if (sesion != null) {
            vista.onPause();
            sesion.pause();
        }
        if (compartida != null) compartida.cerrar();
    }

    private void cerrarSesion() {
        if (sesion != null) sesion.close();
        sesion = null;
        compartida = null;
        if (hiloCamara != null) hiloCamara.quitSafely();
        hiloCamara = null;
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (!armada) return;
        pausar();
        escaneo.parar();
    }

    @Override
    protected void onDestroy() {
        if (!armada) { super.onDestroy(); return; }
        cerrarSesion();
        sonido.liberar();
        super.onDestroy();
    }

    private void cambiarLinterna() {
        final boolean querer = !linterna;
        if (compartida != null) {
            linterna = querer;
            compartida.linterna = querer;
            compartida.repetir();
            return;
        }
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
        });
    }

    // ───────────────────────── dibujo (hilo de GL) ─────────────────────────

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig c) {
        try {
            crearGl();
        } catch (Throwable e) {
            falloGl(e);
        }
    }

    /** Si el dibujo falla: se guarda, se muestra, y se deja de dibujar (en vez de cerrar la app). */
    private volatile Throwable errorGl;

    private void falloGl(Throwable e) {
        if (errorGl != null) return;
        errorGl = e;
        Fallo.guardar("dibujo (GL)", e);
        avisar("Error dibujando. Cerrá y volvé a abrir para ver el error completo y copiarlo:\n" + e);
    }

    private void crearGl() {
        GLES20.glClearColor(0f, 0f, 0f, 1f);
        fondo.crear();
        mallaGl.crear();
        zonasGl.crear();
        figuras.crear();
        hud.crear();
        lentes.crear();
        texturaPuesta = false;
        pedirReescaneo = true;   // las mallas viejas se perdieron con el contexto
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int w, int h) {
        ancho = w; alto = h;
        cambioVista = true;
    }

    /** Un ojo: dónde se dibuja (viewport y recorte) y dónde está el centro de su lente. */
    private final float[][] ojos = new float[2][6];
    private final int[][] vistaOjos = new int[2][4];

    private void acomodarOjos(Ajustes a) {
        int mitad = ancho / 2;
        float sep = a.lentesMm / 25.4f * xdpi;
        float t = a.tamano / 100f;
        int ew = Math.round(mitad * t), eh = Math.round(alto * t);
        for (int o = 0; o < 2; o++) {
            float cx = ancho / 2f + (o == 0 ? -sep / 2 : sep / 2), cy = alto / 2f;
            vistaOjos[o][0] = Math.round(cx - ew / 2f);
            vistaOjos[o][1] = Math.round(cy - eh / 2f);
            vistaOjos[o][2] = ew;
            vistaOjos[o][3] = eh;
            ojos[o][0] = o == 0 ? 0 : mitad; ojos[o][1] = 0; ojos[o][2] = o == 0 ? mitad : ancho; ojos[o][3] = alto;
            ojos[o][4] = cx; ojos[o][5] = cy;
        }
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        if (errorGl != null) {
            GLES20.glClearColor(0.1f, 0, 0, 1);
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);
            return;
        }
        try {
            dibujarCuadro();
        } catch (Throwable e) {
            falloGl(e);
        }
    }

    private void dibujarCuadro() {
        GLES20.glViewport(0, 0, ancho, alto);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        Ajustes a = vistos;
        long ahora = SystemClock.elapsedRealtime();
        float t = (ahora - t0) / 1000f;
        float dt = ultimoCuadro == 0 ? 0 : Math.min(0.1f, (ahora - ultimoCuadro) / 1000f);
        ultimoCuadro = ahora;

        if (pedirReescaneo) {
            pedirReescaneo = false;
            escaneo.reiniciar(a.voxel());
            mallaGl.vaciar();
            listoDesde = 0;
        }
        if (pedirReinicio) { pedirReinicio = false; juego.estado = Juego.ESPERA; juego.soldados.clear(); listoDesde = 0; }
        if (!corriendo || sesion == null) return;
        if (!texturaPuesta) { sesion.setCameraTextureName(fondo.textura()); texturaPuesta = true; }

        // geometría: la pantalla entera o un ojo (los dos ojos usan la misma)
        boolean sbs = a.sbs == 1;
        if (sbs) acomodarOjos(a);
        int gw = sbs ? vistaOjos[0][2] : ancho, gh = sbs ? vistaOjos[0][3] : alto;
        int rot = getWindowManager().getDefaultDisplay().getRotation();
        if (cambioVista || rot != rotacion || gw != geoW || gh != geoH) {
            sesion.setDisplayGeometry(rot, gw, gh);
            rotacion = rot; geoW = gw; geoH = gh; cambioVista = false;
        }

        Frame cuadro;
        try {
            cuadro = sesion.update();
        } catch (CameraNotAvailableException e) {
            avisar("Se perdió la cámara.");
            return;
        } catch (Exception e) {
            return;   // la sesión se está cerrando
        }
        Camera camara = cuadro.getCamera();
        fondo.actualizar(cuadro);

        // mallas nuevas del escaneo → GPU (unas cuantas por cuadro)
        int gen = escaneo.generacion;
        for (int i = 0; i < 48; i++) {
            Escaneo.Resultado r = escaneo.listos.poll();
            if (r == null) break;
            if (r.generacion == gen) mallaGl.subir(r.clave, r.malla);
        }

        boolean sigue = camara.getTrackingState() == TrackingState.TRACKING;
        Pose ojoPose = camara.getDisplayOrientedPose();
        float px = ojoPose.tx(), py = ojoPose.ty(), pz = ojoPose.tz();
        float[] adelante = ojoPose.getTransformedAxis(2, -1f);
        Mapa.Grilla grilla = escaneo.mapa.actual;
        juego.grilla = grilla;
        escaneo.mapa.rellenar = a.rellenar == 1;
        boolean verZonas = a.zonas == 2 || (a.zonas == 1 && juego.estado == Juego.ESPERA);
        if (verZonas) zonasGl.actualizar(grilla, juego.estado == Juego.ESPERA);
        if (sigue) {
            if (inicioSeguimiento == 0) inicioSeguimiento = ahora;
            escaneo.jx = px; escaneo.jy = py; escaneo.jz = pz; escaneo.jfx = adelante[0]; escaneo.jfz = adelante[2];
            escaneo.hayJugador = true;
            camara.getProjectionMatrix(proy, 0, 0.05f, 80f);
            camara.getViewMatrix(vistaM, 0);
            Matrix.multiplyMM(vpCam, 0, proy, 0, vistaM, 0);
            if (hayProfundidad) darProfundidad(cuadro, camara);
            pisoDeRespaldo(py, ahora);
            actualizarJuego(dt, px, py, pz, adelante, ojoPose, ahora);
        } else {
            tiros.set(0);
        }

        // ── dibujar ──
        boolean conLentes = sbs && a.corregirLentes == 1;
        if (conLentes) {
            lentes.empezar(ancho, alto);
            GLES20.glViewport(0, 0, ancho, alto);
            GLES20.glClearColor(0, 0, 0, 1);
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        }
        int nOjos = sbs ? 2 : 1;
        if (sbs) GLES20.glEnable(GLES20.GL_SCISSOR_TEST);
        for (int o = 0; o < nOjos; o++) {
            // qué ojo es: izquierdo (−IPD/2) o derecho; "cambiados" los invierte
            float lado = !sbs ? 0 : (o == 0 ? -1 : 1) * (a.intercambiar == 1 ? -1 : 1);
            if (sbs) {
                GLES20.glScissor((int) ojos[o][0], 0, (int) (ojos[o][2] - ojos[o][0]), alto);
                GLES20.glViewport(vistaOjos[o][0], vistaOjos[o][1], vistaOjos[o][2], vistaOjos[o][3]);
                GLES20.glClear(GLES20.GL_DEPTH_BUFFER_BIT);
            }
            float mediaIpd = a.ipdMm / 2000f;
            Matrix.setIdentityM(desplazar, 0);
            Matrix.translateM(desplazar, 0, -lado * mediaIpd, 0, 0);   // el mundo se corre al revés que el ojo
            Matrix.multiplyMM(vistaOjo, 0, desplazar, 0, vistaM, 0);
            Matrix.multiplyMM(vpOjo, 0, proy, 0, vistaOjo, 0);
            Matrix.multiplyMM(proyOjo, 0, proy, 0, desplazar, 0);

            fondo.dibujar();
            if (!sigue) continue;
            if (sbs && a.estereo == 1) mallaGl.dibujarReproyectada(vpOjo, vpCam, fondo);
            else mallaGl.dibujarProfundidad(vpOjo);
            figuras.dibujarSoldados(juego.soldados, vpOjo);
            if (verZonas) zonasGl.dibujar(vpOjo);
            if (a.zonas == 2) figuras.dibujarRutas(juego.soldados, vpOjo);
            float escalaPx = proy[5] * (sbs ? vistaOjos[o][3] : alto) / 2f;
            figuras.dibujarTrazos(juego.trazos, vpOjo);
            figuras.dibujarParticulas(juego.particulas, vpOjo, escalaPx);
            if (a.malla >= 1) {
                // la onda del escaneo sale de vos cada 3 s; mientras se escanea, las líneas brillan más
                float radio = (t % 3f) * 4f;
                float base = juego.estado == Juego.ESPERA ? 0.4f : a.malla == 2 ? 0.2f : 0.1f;
                if (a.malla == 2) mallaGl.dibujarSolida(vpOjo, 0.28f);
                mallaGl.dibujarLineas(vpOjo, px, py, pz, radio, base);
            }
            GLES20.glClear(GLES20.GL_DEPTH_BUFFER_BIT);   // la pistola va siempre adelante de todo
            figuras.dibujarPistola(proyOjo, juego.retroceso, juego.recargando > 0 ? (float) Math.sin(Math.min(1, (1.3f - juego.recargando) / 1.3f) * Math.PI) : 0, t);
            float aspecto = sbs ? vistaOjos[o][2] / (float) vistaOjos[o][3] : ancho / (float) alto;
            hud.dibujarGolpe(juego.golpe * 0.8f);
            hud.dibujarMira(aspecto, juego.retroceso, apuntaASoldado(px, py, pz, adelante));
            hud.dibujar(sbs ? 0.72f : 0.94f, aspecto);
        }
        if (sbs) GLES20.glDisable(GLES20.GL_SCISSOR_TEST);
        if (conLentes) lentes.terminar(ancho, alto, ojos, a.k1 / 100f, a.k2 / 100f);

        cuadros++;
        if (ahora - ultimoHud > 250) {
            fps = Math.round(cuadros * 1000f / Math.max(1, ahora - ultimoHud));
            cuadros = 0; ultimoHud = ahora;
        }
        hud.mapa(grilla, px, pz, adelante[0], adelante[2], juego.soldados, juego.estado == Juego.ESPERA);
        ponerHud(camara, sigue, sbs, ahora);
    }

    /** Le pasa la profundidad cruda (y su confianza) al hilo del escaneo, si está libre. */
    private void darProfundidad(Frame cuadro, Camera camara) {
        if (!escaneo.libre()) return;
        Image prof = null, conf = null, sem = null;
        try {
            prof = cuadro.acquireRawDepthImage16Bits();
            if (prof.getTimestamp() == ultimaProf) return;
            ultimaProf = prof.getTimestamp();
            try { conf = cuadro.acquireRawDepthConfidenceImage(); } catch (Exception e) { conf = null; }
            int w = prof.getWidth(), h = prof.getHeight();
            Image.Plane pp = prof.getPlanes()[0];
            java.nio.ShortBuffer sb = pp.getBuffer().order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();
            int filaProf = pp.getRowStride() / 2;
            java.nio.ByteBuffer cb = null;
            int filaConf = 0;
            if (conf != null && conf.getWidth() == w && conf.getHeight() == h) {
                Image.Plane pc = conf.getPlanes()[0];
                cb = pc.getBuffer();
                filaConf = pc.getRowStride();
            }
            // los intrínsecos de la textura, llevados a la resolución de la profundidad
            CameraIntrinsics in = camara.getTextureIntrinsics();
            float[] f = in.getFocalLength(), c = in.getPrincipalPoint();
            int[] dim = in.getImageDimensions();
            float sx = w / (float) dim[0], sy = h / (float) dim[1];
            // lo que dice la red semántica de cada píxel (si el teléfono la tiene)
            java.nio.ByteBuffer sb2 = null;
            int filaSem = 0, semW = 0, semH = 0;
            if (haySemantica) {
                try {
                    sem = cuadro.acquireSemanticImage();
                    Image.Plane ps = sem.getPlanes()[0];
                    sb2 = ps.getBuffer();
                    filaSem = ps.getRowStride();
                    semW = sem.getWidth(); semH = sem.getHeight();
                } catch (Exception e) { sb2 = null; }
            }
            camara.getPose().toMatrix(poseM, 0);
            // de cerca y con detalle fino, todos los píxeles; si no, uno de cada dos alcanza
            int paso = w * h > 30000 ? 2 : 1;
            escaneo.dejar(sb, filaProf, cb, filaConf, w, h, f[0] * sx, f[1] * sy, c[0] * sx, c[1] * sy, poseM, 5.5f, paso,
                    sb2, filaSem, semW, semH);
        } catch (NotYetAvailableException e) {
            // todavía no hay profundidad para este cuadro
        } catch (Exception e) {
            // si algo raro pasa con una imagen, se saltea
        } finally {
            if (prof != null) prof.close();
            if (conf != null) conf.close();
            if (sem != null) sem.close();
        }
    }

    /** El piso por si la malla todavía no llegó: el plano horizontal más bajo, o la altura de la cámara − 1.45 m. */
    private void pisoDeRespaldo(float py, long ahora) {
        float mejor = Float.NaN;
        for (Plane p : sesion.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
            if (p.getType() != Plane.Type.HORIZONTAL_UPWARD_FACING) continue;
            float y = p.getCenterPose().ty();
            if (py - y < 0.7f) continue;   // una mesa, no el piso
            if (mejor != mejor || y < mejor) mejor = y;
        }
        if (mejor == mejor) juego.pisoRespaldo = mejor;
        else if (juego.pisoRespaldo != juego.pisoRespaldo && ahora - inicioSeguimiento > 6000) juego.pisoRespaldo = py - 1.45f;
    }

    private volatile boolean escaneoCompleto;

    private boolean pisoListo(float px, float py, float pz) {
        float s = escaneo.tsdf.suelo(px, pz, py - 0.3f, py - 2.5f);
        return s == s || juego.pisoRespaldo == juego.pisoRespaldo;
    }

    private void actualizarJuego(float dt, float px, float py, float pz, float[] adelante, Pose ojoPose, long ahora) {
        int pedidos = tiros.getAndSet(0);
        if (juego.estado == Juego.ESPERA) {
            Mapa.Grilla g = juego.grilla;
            float cob = g == null ? 0 : g.cobertura;
            boolean listo = pisoListo(px, py, pz) && (mallaGl.triangulos > 1500 || !hayProfundidad || ahora - inicioSeguimiento > 20000);
            escaneoCompleto = listo && (cob >= 0.75f || !hayProfundidad);
            if (listo && listoDesde == 0) listoDesde = ahora;
            if (!listo) listoDesde = 0;
            // tocar para empezar; en el visor arranca solo a los 3 s
            // tocar para empezar (cuando ya hay piso); en el visor arranca solo con el escaneo completo (o a los 25 s)
            if (listo && (pedidos > 0 || (vistos.sbs == 1 && (escaneoCompleto || ahora - listoDesde > 25000)))) { juego.empezar(); pedidos = 0; }
        } else if (juego.estado == Juego.FIN) {
            if (finDesde == 0) finDesde = ahora;
            if (pedidos > 0 && ahora - finDesde > 1500) { juego.empezar(); finDesde = 0; }
            pedidos = 0;
        }
        juego.actualizar(dt, px, py, pz, adelante[0], adelante[2], entorno);
        for (int i = 0; i < Math.min(pedidos, 3); i++) {
            float[] b = ojoPose.transformPoint(Figuras.bocaPistola(proy));
            juego.disparar(px, py, pz, adelante[0], adelante[1], adelante[2], b[0], b[1], b[2], entorno);
        }
        sonar(juego.tomarEventos(), px, pz, adelante);
    }

    private void sonar(int ev, float px, float pz, float[] adelante) {
        if (ev == 0) return;
        if ((ev & Juego.EV_DISPARO) != 0) { sonido.tocar(Sonido.DISPARO, 1f, 0); vibrar(14); }
        if ((ev & Juego.EV_VACIO) != 0) sonido.tocar(Sonido.VACIO, 0.8f, 0);
        if ((ev & Juego.EV_IMPACTO) != 0) sonido.tocar(Sonido.IMPACTO, 0.5f, 0);
        if ((ev & Juego.EV_CARNE) != 0) sonido.tocar(Sonido.CARNE, 0.9f, 0);
        if ((ev & Juego.EV_RECARGA) != 0) sonido.tocar(Sonido.RECARGA, 0.8f, 0);
        if ((ev & Juego.EV_OLEADA) != 0) sonido.tocar(Sonido.OLEADA, 0.6f, 0);
        if ((ev & Juego.EV_ZUMBIDO) != 0) sonido.tocar(Sonido.ZUMBIDO, 0.5f, 0);
        if ((ev & Juego.EV_DANO) != 0) { sonido.tocar(Sonido.DANO, 1f, 0); vibrar(70); }
        if ((ev & Juego.EV_FIN) != 0) sonido.tocar(Sonido.FIN, 0.9f, 0);
        if ((ev & Juego.EV_ENEMIGO_DISPARA) != 0) {
            // de qué lado viene: el que tiene fogonazo
            for (Juego.Soldado s : juego.soldados) {
                if (s.fogonazo <= 0) continue;
                float dx = s.x - px, dz = s.z - pz;
                float d = (float) Math.sqrt(dx * dx + dz * dz);
                // derecha del jugador = adelante × arriba
                float rx = -adelante[2], rz = adelante[0];
                float pan = d > 0.01f ? (dx * rx + dz * rz) / d / (float) Math.sqrt(rx * rx + rz * rz + 1e-6f) : 0;
                sonido.tocar(Sonido.ENEMIGO, Math.min(1f, 3f / Math.max(1f, d)), Math.max(-1, Math.min(1, pan)) * 0.8f);
                break;
            }
        }
    }

    private boolean apuntaASoldado(float px, float py, float pz, float[] f) {
        for (Juego.Soldado s : juego.soldados) {
            if (!Juego.enPie(s)) continue;
            float top = s.y + 1.75f - s.agachado * Juego.BAJA_AGACHADO;
            if (Juego.cilindro(px, py, pz, f[0], f[1], f[2], s.x, s.z, Juego.RADIO + 0.04f, s.y + 0.1f, top) > 0) return true;
        }
        return false;
    }

    private void ponerHud(Camera camara, boolean sigue, boolean sbs, long ahora) {
        String arriba;
        String abajo = null;
        if (juego.estado == Juego.ESPERA || !sigue) {
            Mapa.Grilla g = juego.grilla;
            arriba = String.format(Locale.ROOT, "ESCANEO COMPLETO · %d%% · %d polígonos\n%s%s · %d FPS",
                    g == null ? 0 : Math.round(g.cobertura * 100), mallaGl.triangulos,
                    hayProfundidad ? "malla por profundidad" : "sin Depth API: planos",
                    haySemantica ? " + IA semántica" : "", fps);
            if (!sigue) abajo = motivo(camara);
            else if (listoDesde == 0) abajo = "Mirá el piso y alrededor,\nmoviéndote despacio";
            else if (escaneoCompleto) abajo = sbs ? "Escaneo completo ✓\narranca…" : "Escaneo completo ✓\nTocá para empezar";
            else abajo = guia(g, camara) + (sbs ? "" : "\n(o tocá para empezar ya)");
        } else {
            arriba = String.format(Locale.ROOT, "PUNTOS %d%s\nOLEADA %d · %d bajas · %d FPS", juego.puntos,
                    juego.combo > 1 ? "  x" + juego.combo : "", juego.oleada, juego.bajas, fps);
            if (juego.estado == Juego.FIN)
                abajo = "Te dieron. " + juego.puntos + " puntos\n" + (sbs ? "Tocá o volumen para seguir" : "Tocá para volver a empezar");
        }
        hud.poner(arriba, juego.vidaJugador, juego.balas, Juego.CARGADOR, juego.recargando > 0, abajo);
    }

    /** Hacia dónde mirar para completar el escaneo, dicho en criollo. */
    private static String guia(Mapa.Grilla g, Camera camara) {
        if (g == null || Math.hypot(g.faltaX, g.faltaZ) < 0.05f) return "Mirá el piso y alrededor";
        if (g.faltaCerca > 0.45f) return "Mirá el piso cerca tuyo ↓";
        float[] f = camara.getDisplayOrientedPose().getTransformedAxis(2, -1f);
        float fl = (float) Math.hypot(f[0], f[2]);
        if (fl < 1e-3f) return "Mirá alrededor";
        float fx = f[0] / fl, fz = f[2] / fl, rx = -fz, rz = fx;
        float adelante = g.faltaX * fx + g.faltaZ * fz, derecha = g.faltaX * rx + g.faltaZ * rz;
        double ang = Math.toDegrees(Math.atan2(derecha, adelante));
        if (Math.abs(ang) < 35) return "Falta adelante: acercate ↑";
        if (Math.abs(ang) > 135) return "Falta atrás tuyo: date vuelta";
        return ang > 0 ? "Girá a la derecha →" : "Girá a la izquierda ←";
    }

    private static String motivo(Camera camara) {
        TrackingFailureReason r = camara.getTrackingFailureReason();
        switch (r) {
            case INSUFFICIENT_LIGHT: return "Falta luz (probá la linterna)";
            case EXCESSIVE_MOTION: return "Más despacio";
            case INSUFFICIENT_FEATURES: return "Apuntá a algo con textura";
            case CAMERA_UNAVAILABLE: return "La cámara está ocupada";
            default: return "Buscando el entorno…\nmové el teléfono despacio";
        }
    }
}
