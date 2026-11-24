package ar.papuchon.comun;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Trabajo en segundo plano: mientras se exporta un video o se crean miniaturas,
 * la app queda "en primer plano" para Android (con su notificación de progreso)
 * y con la CPU despierta aunque se apague la pantalla. Sin esto, al salir de la
 * app o bloquear el teléfono, Android la duerme o la mata y el trabajo se corta.
 */
public class Trabajo extends Service {
    static final String CANAL = "trabajo", CANAL_LISTO = "listo";
    static final int ID = 7001;
    static volatile boolean corriendo = false;
    static int nListo = 7100;
    PowerManager.WakeLock despierto;

    static void canales(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel t = new NotificationChannel(CANAL, "Trabajando", NotificationManager.IMPORTANCE_LOW);
            t.setDescription("Progreso mientras exporta o crea, aunque salgas de la app");
            nm.createNotificationChannel(t);
        }
        if (nm.getNotificationChannel(CANAL_LISTO) == null)
            nm.createNotificationChannel(new NotificationChannel(CANAL_LISTO, "Terminado y descargas", NotificationManager.IMPORTANCE_DEFAULT));
    }

    static Notification.Builder base(Context c, String canal) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, canal) : new Notification.Builder(c);
        Intent abrir = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (abrir != null) {
            abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            b.setContentIntent(PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        return b.setSmallIcon(android.R.drawable.stat_sys_download);
    }

    static Notification progreso(Context c, String titulo, String texto, int avance) {
        Notification.Builder b = base(c, CANAL).setContentTitle(titulo).setContentText(texto).setOngoing(true).setOnlyAlertOnce(true);
        if (avance >= 0) b.setProgress(100, Math.min(100, avance), false); else b.setProgress(0, 0, true);
        return b.build();
    }

    /** estado: "inicio" | "avance" | "fin" | "error". avance 0-100, o -1 si no se sabe. */
    public static void actualizar(Context c, String estado, String titulo, String texto, int avance) {
        canales(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if ("fin".equals(estado) || "error".equals(estado)) {
            c.stopService(new Intent(c, Trabajo.class));
            nm.notify(nListo++, base(c, CANAL_LISTO).setSmallIcon("fin".equals(estado) ? android.R.drawable.stat_sys_download_done : android.R.drawable.stat_notify_error)
                    .setContentTitle(titulo).setContentText(texto).setAutoCancel(true).build());
            return;
        }
        if (corriendo) { nm.notify(ID, progreso(c, titulo, texto, avance)); return; }   // ya está: solo se actualiza
        Intent i = new Intent(c, Trabajo.class).putExtra("titulo", titulo).putExtra("texto", texto).putExtra("avance", avance);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception e) { nm.notify(ID, progreso(c, titulo, texto, avance)); }   // si Android no deja, al menos se ve el aviso
    }

    @Override
    public int onStartCommand(Intent i, int flags, int startId) {
        canales(this);
        Notification n = progreso(this, i == null ? "Trabajando" : i.getStringExtra("titulo"), i == null ? "" : i.getStringExtra("texto"), i == null ? -1 : i.getIntExtra("avance", -1));
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC); else startForeground(ID, n);
        corriendo = true;
        if (despierto == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            despierto = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "papuchon:trabajo");
            despierto.acquire(3 * 60 * 60 * 1000L);   // tope de 3 h por si la página nunca avisa que terminó
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        corriendo = false;
        if (despierto != null && despierto.isHeld()) despierto.release();
        despierto = null;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent i) { return null; }
}
