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
 * LA PISTOLA EN LA MANO (hand tracking, ManoRastreo + Mano): la cámara ve tu
 * mano, MediaPipe saca sus 21 puntos, y la pistola va en tu mano de verdad.
 * Empuñando con el índice estirado y cerrando el índice (apretar el
 * gatillo) dispara; la mano abierta recarga. Sin mano a la vista, la pistola
 * vuelve a la vista y se dispara tocando la pantalla (o el botón del visor),
 * con el volumen, o con un control / disparador Bluetooth.
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
    private final Menu menu = new Menu();
    private final MenuGl menuGl = new MenuGl();
    private android.content.SharedPreferences records;
    /** El juego está en pausa (con el menú de pausa abierto). */
    private boolean pausado, seguirEscaneando, recordNuevo;
    private volatile boolean tocando, teclaApretada, hayToque, pedirMenu;
    private volatile float toqueX, toqueY;
    private long vDesde, miraAbajoDesde, cambioArmaEn = -10000, menuFinEn;
    private boolean vUsada;
    private int apuntadaAntes = -1;
    private final boolean[] armaAprieta = new boolean[2];
    private final float[] invVp = new float[16], rayo = new float[6];
    /** El nombre corto de cada arma para el HUD. */
    private static final String[] ARMA_CORTA = {"PISTOLA", "FUSIL", "ESCOPETA", "GRANADAS"};
    private static final String[] DIFICULTADES = {"Fácil", "Normal", "Difícil"};
    private ManoRastreo manos;
    private long ultimaMano, abiertaDesde;
    private final float[] manoPos = new float[3], manoAdel = new float[3], manoArriba = new float[3], manoBoca = new float[3], laserFin = new float[3];
    private final float[][] manoPuntos = new float[21][3];
    private final boolean[] armaActiva = new boolean[2];
    private final float[][] armaPos = new float[2][3], armaAdel = new float[2][3], armaArriba = new float[2][3], armaFin = new float[2][3];
    private final int[] armaPose = new int[2];
    private final float[][][] armaPuntos = new float[2][21][3];
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
        records = getSharedPreferences("records", MODE_PRIVATE);
        sonido.activo = ajustes.sonido == 1;
        if (ajustes.mano > 0 && ajustes.seguro == 0) manos = new ManoRastreo(this);

        FrameLayout raiz = new FrameLayout(this);
        vista = new GLSurfaceView(this);
        vista.setPreserveEGLContextOnPause(true);
        vista.setEGLContextClientVersion(2);
        vista.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        vista.setRenderer(this);
        vista.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        vista.setOnTouchListener((v, e) -> {
            int a = e.getActionMasked();
            if (a == MotionEvent.ACTION_DOWN || a == MotionEvent.ACTION_POINTER_DOWN) {
                int i = e.getActionIndex();
                toqueX = e.getX(i); toqueY = e.getY(i); hayToque = true;
                tocando = true;
                tiros.incrementAndGet();
            } else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) tocando = false;
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
        Button bMenu = boton("MENÚ");
        bMenu.setOnClickListener(v -> pedirMenu = true);
        Button bArma = boton("ARMA");
        bArma.setOnClickListener(v -> vista.queueEvent(() -> juego.siguienteArma()));
        botones.addView(bMenu);
        botones.addView(bArma, margenArriba());
        botones.addView(bSbs, margenArriba());
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
                teclaApretada = true;
                return true;
            case KeyEvent.KEYCODE_BUTTON_X:
            case KeyEvent.KEYCODE_BUTTON_B:
                vista.queueEvent(() -> juego.recargar());
                return true;
            case KeyEvent.KEYCODE_BUTTON_Y:
            case KeyEvent.KEYCODE_BUTTON_L1:
            case KeyEvent.KEYCODE_TAB:
                if (e.getRepeatCount() == 0) vista.queueEvent(() -> juego.siguienteArma());
                return true;
            case KeyEvent.KEYCODE_BUTTON_START:
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_BUTTON_SELECT:
                if (e.getRepeatCount() == 0) pedirMenu = true;
                return true;
            default:
                return super.onKeyDown(codigo, e);
        }
    }

    @Override
    public boolean onKeyUp(int codigo, KeyEvent e) {
        teclaApretada = false;
        if (codigo == KeyEvent.KEYCODE_VOLUME_UP || codigo == KeyEvent.KEYCODE_VOLUME_DOWN) return true;
        return super.onKeyUp(codigo, e);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (panel.vista.getVisibility() == View.VISIBLE) { abrirPanel(false); return; }
        if (ajustes.sbs == 1) { ajustes.sbs = 0; ajustes.guardar(this); cambio("sbs"); return; }
        if (juego != null && juego.estado == Juego.JUEGA) { pedirMenu = true; return; }   // Atrás en el juego: pausa
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
        if (manos != null) manos.arrancar();
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
        if (manos != null) manos.parar();
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
        menuGl.crear();
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
        if (pedirReinicio) { pedirReinicio = false; juego.estado = Juego.ESPERA; juego.soldados.clear(); listoDesde = 0; menu.cerrar(); pausado = false; }
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
            if (manos != null && a.mano > 0 && ahora - ultimaMano > 40) darMano(cuadro, camara, ahora);
            leerManos(ahora);
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
            figuras.dibujarBlancos(juego.blancos, vpOjo);
            figuras.dibujarGranadas(juego.granadas, vpOjo);
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
            boolean enMano = armaActiva[0] || armaActiva[1];
            for (int s2 = 0; s2 < 2; s2++) {
                if (armaPose[s2] != Mano.NADA && (a.mano == 2 || juego.estado == Juego.ESPERA))
                    figuras.dibujarEsqueleto(vpOjo, armaPuntos[s2], armaActiva[s2]);
            }
            menuGl.dibujar(menu, vpOjo);   // el menú flota en el mundo, adelante de todo
            GLES20.glClear(GLES20.GL_DEPTH_BUFFER_BIT);   // el arma va siempre adelante de todo
            float saca = Math.max(0, 1 - (ahora - cambioArmaEn) / 350f);
            if (enMano) {
                for (int s2 = 0; s2 < 2; s2++) {
                    if (!armaActiva[s2]) continue;
                    figuras.dibujarArmaEnMano(vpOjo, juego.arma, armaPos[s2], armaAdel[s2], armaArriba[s2], juego.retroceso, saca);
                    Figuras.bocaEnMano(juego.arma, armaPos[s2], armaAdel[s2], armaArriba[s2], manoBoca);
                    figuras.dibujarLaser(vpOjo, manoBoca, armaFin[s2], proy[5] * (sbs ? vistaOjos[o][3] : alto) / 2f);
                }
            } else {
                float rc = juego.armaActual().recarga;
                float anim = juego.recargando > 0 ? (float) Math.sin(Math.min(1, (rc - juego.recargando) / rc) * Math.PI) : 0;
                figuras.dibujarArma(proyOjo, juego.arma, juego.retroceso, anim, saca, t);
            }
            float aspecto = sbs ? vistaOjos[o][2] / (float) vistaOjos[o][3] : ancho / (float) alto;
            hud.dibujarGolpe(juego.golpe * 0.8f);
            if (!enMano) hud.dibujarMira(aspecto, juego.retroceso, apuntaASoldado(px, py, pz, adelante));
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
        boolean toque = hayToque;
        float tx = toqueX, ty = toqueY;
        hayToque = false;
        boolean sbs = vistos.sbs == 1;
        // los gatillos de la mano (cada mano con pistola)
        int gatillo = 0;
        int[] gat = new int[2];
        for (int s2 = 0; s2 < 2; s2++) {
            gat[s2] = manos == null ? 0 : manos.tiros[s2].getAndSet(0);
            if (!armaActiva[s2]) gat[s2] = 0;
            gatillo += gat[s2];
        }
        boolean hayArma = armaActiva[0] || armaActiva[1];
        int conArma = armaActiva[0] ? 0 : 1;

        // ¿se pidió el menú? (botón, tecla, Atrás, o mirar tus pies 1.2 s)
        boolean abajo = adelante[1] < -0.93f;   // ≈ 70° para abajo
        if (abajo && !menu.abierto) { if (miraAbajoDesde == 0) miraAbajoDesde = ahora; }
        else miraAbajoDesde = 0;
        boolean quiereMenu = pedirMenu || (miraAbajoDesde > 0 && ahora - miraAbajoDesde > 1200);
        pedirMenu = false;

        if (juego.estado == Juego.ESPERA) {
            Mapa.Grilla g = juego.grilla;
            float cob = g == null ? 0 : g.cobertura;
            boolean listo = pisoListo(px, py, pz) && (mallaGl.triangulos > 1500 || !hayProfundidad || ahora - inicioSeguimiento > 20000);
            escaneoCompleto = listo && (cob >= 0.75f || !hayProfundidad);
            if (listo && listoDesde == 0) listoDesde = ahora;
            if (!listo) listoDesde = 0;
            // el menú principal sale solo con el escaneo completo (o a los 25 s en el visor); o tocando / con el gatillo
            boolean solo = !seguirEscaneando && (escaneoCompleto || (sbs && ahora - listoDesde > 25000));
            if (listo && !menu.abierto && (solo || pedidos > 0 || gatillo > 0 || quiereMenu)) {
                abrirPrincipal(px, py, pz, adelante);
                pedidos = 0; gatillo = 0; gat[0] = gat[1] = 0; toque = false;
            }
        } else if (juego.estado == Juego.FIN) {
            if (finDesde == 0) finDesde = ahora;
            if (!menu.abierto && ahora - finDesde > 1500) abrirFin(px, py, pz, adelante);
            if (!menu.abierto) { pedidos = 0; gatillo = 0; gat[0] = gat[1] = 0; }
        } else if (quiereMenu && !menu.abierto) {
            abrirPausa(px, py, pz, adelante);
            pedidos = 0; gatillo = 0; gat[0] = gat[1] = 0; toque = false;
        }

        // ── con el menú abierto, lo que apunta y lo que aprieta es para el menú ──
        if (menu.abierto) {
            boolean permanencia;
            boolean clic;
            if (toque && !sbs && rayoDeToque(tx, ty)) {
                permanencia = false; clic = true;
            } else if (hayArma) {
                Figuras.bocaEnMano(juego.arma, armaPos[conArma], armaAdel[conArma], armaArriba[conArma], manoBoca);
                rayo[0] = manoBoca[0]; rayo[1] = manoBoca[1]; rayo[2] = manoBoca[2];
                rayo[3] = armaAdel[conArma][0]; rayo[4] = armaAdel[conArma][1]; rayo[5] = armaAdel[conArma][2];
                permanencia = false; clic = gatillo > 0 || pedidos > 0;
            } else {
                rayo[0] = px; rayo[1] = py; rayo[2] = pz; rayo[3] = adelante[0]; rayo[4] = adelante[1]; rayo[5] = adelante[2];
                permanencia = true; clic = pedidos > 0;
            }
            menu.seguir(dt, px, py, pz, adelante[0], adelante[2]);
            String elegido = menu.actualizar(dt, rayo[0], rayo[1], rayo[2], rayo[3], rayo[4], rayo[5], permanencia, clic);
            if (menu.apuntada != apuntadaAntes) {
                if (menu.apuntada >= 0) { sonido.tocar(Sonido.MENU, 0.5f, 0); vibrar(6); }
                apuntadaAntes = menu.apuntada;
            }
            // el láser de la mano termina en el panel
            if (hayArma && menu.tocaPanel) System.arraycopy(menu.punto, 0, armaFin[conArma], 0, 3);
            if (elegido != null) { sonido.tocar(Sonido.ELIGE, 0.8f, 0); elegir(elegido, px, py, pz, adelante); }
            pedidos = 0; gat[0] = gat[1] = 0;
        }

        if (!pausado) juego.actualizar(dt, px, py, pz, adelante[0], adelante[2], entorno);

        if (juego.estado == Juego.JUEGA && !pausado && !menu.abierto) {
            // cambiar de arma: la V medio segundo (una vez por V)
            boolean ve = false;
            for (int s2 = 0; s2 < 2; s2++) if (armaPose[s2] == Mano.VE) ve = true;
            if (ve) {
                if (vDesde == 0) vDesde = ahora;
                if (!vUsada && ahora - vDesde > 350) { juego.siguienteArma(); vUsada = true; }
            } else { vDesde = 0; vUsada = false; }
            // los tiros del gesto (gatillo con el índice), de cada mano con pistola
            for (int s2 = 0; s2 < 2; s2++) for (int i = 0; i < Math.min(gat[s2], 3); i++) dispararDesdeMano(s2);
            for (int i = 0; i < Math.min(pedidos, 3); i++) {
                if (hayArma) { dispararDesdeMano(conArma); continue; }   // tocar / volumen: con el arma de la mano
                dispararDesdeVista(px, py, pz, adelante, ojoPose);
            }
            // el fusil tira mientras el gatillo esté apretado (el índice cerrado, el dedo en la pantalla o la tecla)
            if (juego.armaActual().automatica) {
                for (int s2 = 0; s2 < 2; s2++) if (armaActiva[s2] && armaAprieta[s2]) dispararDesdeMano(s2);
                if (tocando || teclaApretada) {
                    if (hayArma) dispararDesdeMano(conArma);
                    else dispararDesdeVista(px, py, pz, adelante, ojoPose);
                }
            }
        }
        sonar(juego.tomarEventos(), px, pz, adelante, ahora);
    }

    private void dispararDesdeVista(float px, float py, float pz, float[] adelante, Pose ojoPose) {
        float[] b = ojoPose.transformPoint(Figuras.bocaArma(proy, juego.arma));
        juego.disparar(px, py, pz, adelante[0], adelante[1], adelante[2], b[0], b[1], b[2], entorno);
    }

    /** El rayo del dedo en la pantalla (sin visor): de la cámara por ese píxel. */
    private boolean rayoDeToque(float x, float y) {
        if (!Matrix.invertM(invVp, 0, vpCam, 0)) return false;
        float nx = 2 * x / ancho - 1, ny = 1 - 2 * y / alto;
        float[] a = {nx, ny, -1, 1}, b = {nx, ny, 1, 1}, wa = new float[4], wb = new float[4];
        Matrix.multiplyMV(wa, 0, invVp, 0, a, 0);
        Matrix.multiplyMV(wb, 0, invVp, 0, b, 0);
        if (Math.abs(wa[3]) < 1e-9f || Math.abs(wb[3]) < 1e-9f) return false;
        for (int i = 0; i < 3; i++) { wa[i] /= wa[3]; wb[i] /= wb[3]; }
        float dx = wb[0] - wa[0], dy = wb[1] - wa[1], dz = wb[2] - wa[2], l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (l < 1e-6f) return false;
        rayo[0] = wa[0]; rayo[1] = wa[1]; rayo[2] = wa[2]; rayo[3] = dx / l; rayo[4] = dy / l; rayo[5] = dz / l;
        return true;
    }

    // ── los menús ──

    private int record(int modo) { return records == null ? 0 : records.getInt("modo" + modo, 0); }

    /** Cómo se elige (lo que se dice en el menú). */
    private String comoElegir() {
        if (armaActiva[0] || armaActiva[1]) return "Apuntá con el arma y apretá el gatillo";
        if (vistos.sbs == 1) return "Mirá un botón 1 segundo (o apretá el botón)";
        return "Tocá un botón (o mirálo 1 segundo)";
    }

    private void opcionesComunes() {
        menu.opcion("arma", "Arma: " + Juego.ARMAS[juego.arma].nombre, "cambiar ▸");
        menu.opcion("dificultad", "Dificultad: " + DIFICULTADES[Math.max(0, Math.min(2, juego.dificultad))], "▸");
    }

    private void abrirPrincipal(float px, float py, float pz, float[] f) {
        Mapa.Grilla g = juego.grilla;
        menu.limpiar("principal", "ASALTO MR");
        menu.linea(String.format(Locale.ROOT, "Escaneo %d%% · %d polígonos%s", g == null ? 0 : Math.round(g.cobertura * 100),
                mallaGl.triangulos, haySemantica ? " · IA semántica" : ""));
        menu.linea(comoElegir());
        menu.opcion("oleadas", "Oleadas", record(Juego.OLEADAS) > 0 ? "récord " + record(Juego.OLEADAS) : null);
        menu.opcion("contra", "Contrarreloj 90 s", record(Juego.CONTRARRELOJ) > 0 ? "récord " + record(Juego.CONTRARRELOJ) : null);
        menu.opcion("practica", "Práctica: blancos", record(Juego.PRACTICA) > 0 ? "récord " + record(Juego.PRACTICA) : null);
        opcionesComunes();
        menu.opcion("escanear", "Seguir escaneando", null);
        if (vistos.sbs == 0) menu.opcion("ajustes", "Ajustes", null);
        menu.abrir(px, py, pz, f[0], f[2]);
        pausado = false;
    }

    private void abrirPausa(float px, float py, float pz, float[] f) {
        menu.limpiar("pausa", "PAUSA");
        menu.linea(String.format(Locale.ROOT, "%s · %d puntos · %d bajas", Juego.MODOS[juego.modo], juego.puntos, juego.bajas));
        menu.linea("V con la mano = cambiar de arma · mano abierta = recargar");
        menu.opcion("seguir", "Seguir", null);
        opcionesComunes();
        menu.opcion("reiniciar", "Empezar de nuevo", null);
        menu.opcion("principal", "Menú principal", null);
        menu.opcion("reescanear", "Reescanear el lugar", null);
        menu.abrir(px, py, pz, f[0], f[2]);
        pausado = true;
    }

    private void abrirFin(float px, float py, float pz, float[] f) {
        int m = juego.modo, r = record(m);
        recordNuevo = juego.puntos > r;
        if (recordNuevo && records != null) records.edit().putInt("modo" + m, juego.puntos).apply();
        menu.limpiar("fin", juego.vidaJugador <= 0 ? "TE DIERON" : "¡TIEMPO!");
        menu.linea(recordNuevo ? "¡RÉCORD NUEVO! " + juego.puntos + " puntos" : juego.puntos + " puntos · récord " + r);
        if (m == Juego.PRACTICA)
            menu.linea(String.format(Locale.ROOT, "%d blancos · reacción %.2f s", juego.blancosPegados, juego.reaccionMedia()));
        else
            menu.linea(String.format(Locale.ROOT, "%s%d bajas · %d a la cabeza", m == Juego.OLEADAS ? "Oleada " + juego.oleada + " · " : "",
                    juego.bajas, juego.cabezas));
        menu.linea(String.format(Locale.ROOT, "Precisión %d %% (%d de %d) · %d:%02d", Math.round(juego.precision() * 100),
                juego.aciertos, juego.disparos, (int) juego.tiempoJuego / 60, (int) juego.tiempoJuego % 60));
        menu.opcion("otra", "Otra vez", null);
        menu.opcion("principal", "Menú principal", null);
        opcionesComunes();
        menu.abrir(px, py, pz, f[0], f[2]);
        if (recordNuevo) sonido.tocar(Sonido.RECORD, 0.9f, 0);
    }

    private void elegir(String id, float px, float py, float pz, float[] f) {
        switch (id) {
            case "oleadas": empezarModo(Juego.OLEADAS); break;
            case "contra": empezarModo(Juego.CONTRARRELOJ); break;
            case "practica": empezarModo(Juego.PRACTICA); break;
            case "otra": empezarModo(juego.modo); break;
            case "reiniciar": empezarModo(juego.modo); break;
            case "seguir": menu.cerrar(); pausado = false; break;
            case "arma":
                juego.siguienteArma();
                menu.texto("arma", "Arma: " + Juego.ARMAS[juego.arma].nombre, "cambiar ▸");
                break;
            case "dificultad":
                ajustes.dificultad = (ajustes.dificultad + 1) % 3;
                ajustes.guardar(this);
                vistos = ajustes.copia();
                juego.dificultad = ajustes.dificultad;
                menu.texto("dificultad", "Dificultad: " + DIFICULTADES[juego.dificultad], "▸");
                break;
            case "escanear": menu.cerrar(); seguirEscaneando = true; break;
            case "principal":
                juego.estado = Juego.ESPERA; juego.soldados.clear(); juego.blancos.clear(); juego.granadas.clear();
                pausado = false; finDesde = 0;
                abrirPrincipal(px, py, pz, f);
                break;
            case "reescanear":
                juego.estado = Juego.ESPERA; juego.soldados.clear(); juego.blancos.clear(); juego.granadas.clear();
                pausado = false; seguirEscaneando = false; finDesde = 0;
                menu.cerrar();
                pedirReescaneo = true;
                break;
            case "ajustes": runOnUiThread(() -> abrirPanel(true)); break;
            default: break;
        }
    }

    private void empezarModo(int modo) {
        juego.dificultad = ajustes.dificultad;
        juego.empezar(modo);
        menu.cerrar();
        pausado = false; finDesde = 0; seguirEscaneando = false;
    }

    private void dispararDesdeMano(int s) {
        float[] f = armaAdel[s];
        Figuras.bocaEnMano(juego.arma, armaPos[s], f, armaArriba[s], manoBoca);
        juego.disparar(manoBoca[0], manoBoca[1], manoBoca[2], f[0], f[1], f[2], manoBoca[0], manoBoca[1], manoBoca[2], entorno);
    }

    /**
     * Le pasa la imagen de la cámara (la CPU, 640×480) al rastreador de manos,
     * con su pose, sus intrínsecos y la profundidad de ARCore.
     */
    private void darMano(Frame cuadro, Camera camara, long ahora) {
        if (!manos.libre()) return;
        Image img = null, prof = null;
        try {
            img = cuadro.acquireCameraImage();
            CameraIntrinsics in = camara.getImageIntrinsics();
            float[] f = in.getFocalLength(), c = in.getPrincipalPoint();
            int[] dim = in.getImageDimensions();
            // los intrínsecos son para dim; la imagen puede venir de otro tamaño
            float kx = img.getWidth() / (float) dim[0], ky = img.getHeight() / (float) dim[1];
            camara.getPose().toMatrix(poseMano, 0);
            // de la imagen (normalizada) a la de profundidad (alineada con la textura)
            short[] pd = null;
            int pw = 0, ph = 0;
            if (hayProfundidad) {
                try {
                    prof = cuadro.acquireDepthImage16Bits();
                    pw = prof.getWidth(); ph = prof.getHeight();
                    Image.Plane pl = prof.getPlanes()[0];
                    java.nio.ShortBuffer sb = pl.getBuffer().order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();
                    int fila = pl.getRowStride() / 2;
                    if (profMano.length != pw * ph) profMano = new short[pw * ph];
                    for (int v = 0; v < ph; v++) { sb.position(v * fila); sb.get(profMano, v * pw, pw); }
                    pd = profMano;
                    float[] ent = {0, 0, 1, 0, 0, 1}, sal = new float[6];
                    cuadro.transformCoordinates2d(com.google.ar.core.Coordinates2d.IMAGE_NORMALIZED, ent, com.google.ar.core.Coordinates2d.TEXTURE_NORMALIZED, sal);
                    imagenAProf[0] = sal[0]; imagenAProf[1] = sal[2] - sal[0]; imagenAProf[2] = sal[4] - sal[0];
                    imagenAProf[3] = sal[1]; imagenAProf[4] = sal[3] - sal[1]; imagenAProf[5] = sal[5] - sal[1];
                } catch (Exception e) { pd = null; }
            }
            boolean girada = getWindowManager().getDefaultDisplay().getRotation() == android.view.Surface.ROTATION_270;
            if (manos.dejar(img, f[0] * kx, f[1] * ky, c[0] * kx, c[1] * ky, poseMano, girada, ahora, pd, pw, ph, imagenAProf)) ultimaMano = ahora;
        } catch (NotYetAvailableException e) {
            // todavía no hay imagen
        } catch (Exception e) {
            // se saltea esta
        } finally {
            if (img != null) img.close();
            if (prof != null) prof.close();
        }
    }

    private final float[] poseMano = new float[16], imagenAProf = new float[6];
    private short[] profMano = new short[0];

    /** Copia lo último de cada mano (el hilo de las manos lo va cambiando) y decide qué pistolas se ven. */
    private void leerManos(long ahora) {
        armaActiva[0] = armaActiva[1] = false;
        if (manos == null) return;
        boolean alguienAbierta = false;
        for (int s2 = 0; s2 < 2; s2++) {
            Mano m = manos.manos[s2];
            synchronized (m) {
                boolean reciente = m.hay && ahora - m.ultimaVez < 400;
                armaPose[s2] = m.pose;
                armaAprieta[s2] = false;
                if (reciente && (m.pose == Mano.EMPUNA || m.pose == Mano.APRIETA)) {
                    armaActiva[s2] = true;
                    armaAprieta[s2] = m.apretado();
                    System.arraycopy(m.pos, 0, armaPos[s2], 0, 3);
                    System.arraycopy(m.adelante, 0, armaAdel[s2], 0, 3);
                    System.arraycopy(m.arriba, 0, armaArriba[s2], 0, 3);
                }
                if (reciente) for (int i = 0; i < 21; i++) System.arraycopy(m.mundo[i], 0, armaPuntos[s2][i], 0, 3);
                if (reciente && m.pose == Mano.ABIERTA) alguienAbierta = true;
                if (!reciente) armaPose[s2] = Mano.NADA;
            }
        }
        // la mano abierta medio segundo: recargar
        if (alguienAbierta && !menu.abierto) { if (abiertaDesde == 0) abiertaDesde = ahora; else if (ahora - abiertaDesde > 500) { juego.recargar(); abiertaDesde = ahora + 100000; } }
        else abiertaDesde = 0;
        // el láser: hasta donde pega cada caño
        for (int s2 = 0; s2 < 2; s2++) {
            if (!armaActiva[s2]) continue;
            float[] f = armaAdel[s2];
            Figuras.bocaEnMano(juego.arma, armaPos[s2], f, armaArriba[s2], manoBoca);
            float d = entorno.rayo(manoBoca[0], manoBoca[1], manoBoca[2], f[0], f[1], f[2], 25f);
            if (d < 0) d = 25f;
            armaFin[s2][0] = manoBoca[0] + f[0] * d; armaFin[s2][1] = manoBoca[1] + f[1] * d; armaFin[s2][2] = manoBoca[2] + f[2] * d;
        }
    }

    private void sonar(int ev, float px, float pz, float[] adelante, long ahora) {
        if (ev == 0) return;
        if ((ev & Juego.EV_DISPARO) != 0) {
            sonido.tocar(Sonido.DE_ARMA[juego.arma], 1f, 0);
            vibrar(juego.arma == Juego.ESCOPETA ? 45 : juego.arma == Juego.LANZAGRANADAS ? 30 : juego.arma == Juego.FUSIL ? 9 : 14);
        }
        if ((ev & Juego.EV_EXPLOSION) != 0) { sonido.tocar(Sonido.EXPLOSION, 1f, 0); vibrar(90); }
        if ((ev & Juego.EV_CAMBIO) != 0) { sonido.tocar(Sonido.CAMBIO, 0.7f, 0); cambioArmaEn = ahora; }
        if ((ev & Juego.EV_BLANCO) != 0) sonido.tocar(Sonido.BLANCO, 0.9f, 0);
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
            arriba = String.format(Locale.ROOT, "ESCANEO COMPLETO · %d%% · %d polígonos\n%s%s · %d FPS%s",
                    g == null ? 0 : Math.round(g.cobertura * 100), mallaGl.triangulos,
                    hayProfundidad ? "malla por profundidad" : "sin Depth API: planos",
                    haySemantica ? " + IA semántica" : "", fps, textoMano());
            if (!sigue) abajo = motivo(camara);
            else if (menu.abierto) abajo = null;
            else if (listoDesde == 0) abajo = "Mirá el piso y alrededor,\nmoviéndote despacio";
            else if (escaneoCompleto) abajo = "Escaneo completo ✓\n" + (sbs ? "Mirá tus pies: menú" : "Tocá para el menú");
            else abajo = guia(g, camara) + (sbs ? "\n(mirá tus pies: menú)" : "\n(o tocá para el menú)");
        } else {
            int tr = (int) Math.ceil(juego.tiempoRestante);
            String reloj = String.format(Locale.ROOT, "%d:%02d", tr / 60, tr % 60);
            if (juego.modo == Juego.PRACTICA)
                arriba = String.format(Locale.ROOT, "PUNTOS %d\nTIEMPO %s · %d blancos · %d%% · %d FPS%s", juego.puntos, reloj,
                        juego.blancosPegados, Math.round(juego.precision() * 100), fps, textoMano());
            else if (juego.modo == Juego.CONTRARRELOJ)
                arriba = String.format(Locale.ROOT, "PUNTOS %d%s\nTIEMPO %s · %d bajas · %d FPS%s", juego.puntos,
                        juego.combo > 1 ? "  x" + juego.combo : "", reloj, juego.bajas, fps, textoMano());
            else
                arriba = String.format(Locale.ROOT, "PUNTOS %d%s\nOLEADA %d · %d bajas · %d FPS%s", juego.puntos,
                        juego.combo > 1 ? "  x" + juego.combo : "", juego.oleada, juego.bajas, fps, textoMano());
            if (pausado) arriba = "PAUSA\n" + arriba.substring(arriba.indexOf('\n') + 1);
        }
        hud.poner(arriba, juego.vidaJugador, juego.balas, juego.cargador(), juego.recargando > 0, ARMA_CORTA[juego.arma], abajo);
    }

    /** Qué ve el hand tracking (para el HUD). */
    private String textoMano() {
        if (manos == null) return "";
        if (!manos.anda) return " · " + manos.estado;
        String t = "";
        for (int s2 = 0; s2 < 2; s2++) if (armaPose[s2] != Mano.NADA) t += (t.isEmpty() ? "" : "+") + Mano.NOMBRES[armaPose[s2]];
        return " · mano: " + (t.isEmpty() ? "no se ve" : t);
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
