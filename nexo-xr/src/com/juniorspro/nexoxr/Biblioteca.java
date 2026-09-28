package com.juniorspro.nexoxr;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Collections;
import java.util.List;

/**
 * LAS APPS (la biblioteca):
 *  - las de NEXO (en su ventana): el navegador, la galería, el cine, la
 *    música, las notas, la calculadora, el reloj, el clima, los archivos…;
 *  - las APPS WEB: el catálogo y las que agregaste desde el navegador (cada
 *    una en su ventana, con su sesión);
 *  - las del TELÉFONO (esas se abren en la pantalla del teléfono, fuera del visor).
 */
final class Biblioteca {
    /** Las de Nexo: app, nombre, detalle, ícono, dos colores. */
    static final Object[][] NEXO = {
            {"navegador", "Navegador", "La web, con pestañas", Iconos.WEB, 0xFF3D7BFF, 0xFF1A3C8F},
            {"galeria", "Galería", "Tus fotos y videos", Iconos.GALERIA, 0xFFFF7A59, 0xFF8F2E1A},
            {"cine", "Cine", "Tus videos, en grande", Iconos.CINE, 0xFFE8457A, 0xFF6B1B3A},
            {"musica", "Música", "Tus canciones", Iconos.MUSICA, 0xFFB38CFF, 0xFF4A2A8F},
            {"notas", "Notas", "Escribí lo que quieras", Iconos.NOTAS, 0xFFF1C14B, 0xFF8A6412},
            {"calculadora", "Calculadora", "Con historial", Iconos.CALCULADORA, 0xFF5C6275, 0xFF2A2E3B},
            {"reloj", "Reloj", "Temporizador y cronómetro", Iconos.RELOJ, 0xFF16A0A0, 0xFF0B4F55},
            {"clima", "Clima", "Hoy y la semana", Iconos.CLIMA, 0xFF5AB0F5, 0xFF2F5FB8},
            {"archivos", "Archivos", "PDF, textos, fotos…", Iconos.ARCHIVOS, 0xFF35C28B, 0xFF16624A},
            {"ajustes", "Ajustes", "Entorno, espacio, visor", Iconos.AJUSTES, 0xFF7C8394, 0xFF3A3F4B},
            {"espacio", "Tu espacio", "Escanear la mesa otra vez", Iconos.MESA, 0xFFFFB347, 0xFF8A4B12},
            {"bienvenida", "Cómo se usa", "Los gestos y los botones", Iconos.INFO, 0xFF4CC38A, 0xFF1B5E45}};

    private Context c;
    private Sistema s;
    private LinearLayout col;
    private GridLayout web;

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        ScrollView sv = new ScrollView(c);
        sv.setBackgroundColor(Estilo.FONDO);
        col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        int m = Estilo.dp(c, 22);
        col.setPadding(m, m, m, m);
        sv.addView(col);
        col.addView(Estilo.texto(c, "Apps", 26, Estilo.TEXTO, true));
        // las de Nexo
        titulo("De Nexo", "Se abren en su ventana, acá en el espacio");
        GridLayout g = new GridLayout(c);
        g.setColumnCount(4);
        for (int i = 0; i < NEXO.length; i++) {
            Object[] a = NEXO[i];
            String app = (String) a[0];
            View b = tarjeta((int) a[3], (String) a[1], (String) a[2], (int) a[4], (int) a[5], v -> {
                s.sonido(Sonido.CLIC);
                if (app.equals("espacio")) s.prepararEspacio(); else s.abrir(app);
            });
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(i / 4), GridLayout.spec(i % 4, 1f));
            lp.width = 0;
            lp.height = Estilo.dp(c, 118);
            lp.setMargins(Estilo.dp(c, 5), Estilo.dp(c, 5), Estilo.dp(c, 5), Estilo.dp(c, 5));
            g.addView(b, lp);
        }
        col.addView(g, new LinearLayout.LayoutParams(-1, -2));
        // las apps web
        titulo("Apps web", "Cada una en su ventana, con tu sesión. Agregá más desde el navegador (★)");
        web = new GridLayout(c);
        web.setColumnCount(6);
        col.addView(web, new LinearLayout.LayoutParams(-1, -2));
        armarWeb();
        // las del teléfono
        titulo("Del teléfono", "Se abren en la pantalla del teléfono (fuera del visor). Para volver, abrí Nexo.");
        GridLayout tel = new GridLayout(c);
        tel.setColumnCount(6);
        col.addView(tel, new LinearLayout.LayoutParams(-1, -2));
        Handler ui = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            PackageManager pm = c.getPackageManager();
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> l = pm.queryIntentActivities(i, 0);
            Collections.sort(l, (a, b) -> String.valueOf(a.loadLabel(pm)).compareToIgnoreCase(String.valueOf(b.loadLabel(pm))));
            for (ResolveInfo r : l) {
                if (r.activityInfo.packageName.equals(c.getPackageName())) continue;
                String nombre = String.valueOf(r.loadLabel(pm));
                Drawable d;
                try { d = r.loadIcon(pm); } catch (Throwable e) { d = null; }
                Drawable fd = d;
                ui.post(() -> tel.addView(baldosa(c, fd, nombre, v -> {
                    Intent a = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                            .setClassName(r.activityInfo.packageName, r.activityInfo.name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try { c.getApplicationContext().startActivity(a); } catch (Throwable e) { /* no se puede abrir */ }
                })));
            }
        }, "apps").start();
        return sv;
    }

    private void titulo(String t, String d) {
        TextView a = Estilo.texto(c, t, 18, Estilo.TEXTO, true);
        LinearLayout.LayoutParams la = new LinearLayout.LayoutParams(-2, -2);
        la.topMargin = Estilo.dp(c, 18);
        col.addView(a, la);
        TextView b = Estilo.texto(c, d, 12, Estilo.TEXTO2, false);
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-2, -2);
        lb.bottomMargin = Estilo.dp(c, 8);
        col.addView(b, lb);
    }

    /** Una app de Nexo: el degradé, el ícono, el nombre y qué es. */
    private View tarjeta(int icono, String nombre, String detalle, int c1, int c2, View.OnClickListener l) {
        LinearLayout b = new LinearLayout(c);
        b.setOrientation(LinearLayout.VERTICAL);
        int p = Estilo.dp(c, 14);
        b.setPadding(p, p, p, p);
        GradientDrawable fondo = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{c1, c2});
        fondo.setCornerRadius(Estilo.dp(c, 20));
        b.setBackground(fondo);
        b.addView(Estilo.icono(c, icono, 0xFFFFFFFF, 34));
        View esp = new View(c);
        b.addView(esp, new LinearLayout.LayoutParams(1, 0, 1));
        b.addView(Estilo.texto(c, nombre, 16, 0xFFFFFFFF, true));
        TextView d = Estilo.texto(c, detalle, 11, 0xDDFFFFFF, false);
        d.setMaxLines(1);
        b.addView(d);
        b.setClickable(true);
        b.setOnClickListener(l);
        b.setForeground(Estilo.apretable(0x00000000, 0x33FFFFFF, Estilo.dp(c, 20)));
        return b;
    }

    /** Las apps web: las tuyas primero (con ✕ para quitarlas) y el catálogo. */
    private void armarWeb() {
        web.removeAllViews();
        List<AppsWeb.App> tuyas = Navegador.tuyas(c);
        for (AppsWeb.App a : tuyas) web.addView(baldosaWeb(a, true));
        for (AppsWeb.App a : AppsWeb.CATALOGO) {
            boolean ya = false;
            for (AppsWeb.App t : tuyas) if (AppsWeb.mismaUrl(t.url, a.url)) ya = true;
            if (!ya) web.addView(baldosaWeb(a, false));
        }
    }

    private View baldosaWeb(AppsWeb.App a, boolean tuya) {
        FrameLayout f = new FrameLayout(c);
        LinearLayout b = new LinearLayout(c);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setGravity(Gravity.CENTER_HORIZONTAL);
        int p = Estilo.dp(c, 8);
        b.setPadding(p, p, p, p);
        b.setBackground(Estilo.apretable(0x00000000, Estilo.TARJETA, Estilo.dp(c, 14)));
        TextView ic = Estilo.texto(c, a.inicial(), 22, 0xFFFFFFFF, true);
        ic.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{a.color, oscuro(a.color)});
        g.setCornerRadius(Estilo.dp(c, 14));
        ic.setBackground(g);
        b.addView(ic, new LinearLayout.LayoutParams(Estilo.dp(c, 48), Estilo.dp(c, 48)));
        TextView t = Estilo.texto(c, a.nombre, 11, Estilo.TEXTO, false);
        t.setGravity(Gravity.CENTER);
        t.setMaxLines(1);
        b.addView(t);
        b.setClickable(true);
        b.setOnClickListener(v -> { s.sonido(Sonido.ABRIR); s.abrir(a.id()); });
        f.addView(b, new FrameLayout.LayoutParams(-1, -2));
        if (tuya) {
            FrameLayout x = Estilo.botonIcono(c, Iconos.CERRAR, 22, v -> {
                s.sonido(Sonido.CERRAR);
                Navegador.guardar(c, AppsWeb.quitar(Navegador.tuyas(c), a.url));
                armarWeb();
            });
            x.setBackground(Estilo.forma(0xCC2A2B34, Estilo.dp(c, 11)));
            f.addView(x, new FrameLayout.LayoutParams(Estilo.dp(c, 22), Estilo.dp(c, 22), Gravity.TOP | Gravity.END));
        }
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED), GridLayout.spec(GridLayout.UNDEFINED, 1f));
        lp.width = 0;
        f.setLayoutParams(lp);
        return f;
    }

    private static int oscuro(int c) {
        int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
        return 0xFF000000 | (r * 55 / 100) << 16 | (g * 55 / 100) << 8 | (b * 55 / 100);
    }

    private static View baldosa(Context c, Drawable icono, String nombre, View.OnClickListener l) {
        LinearLayout b = new LinearLayout(c);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setGravity(Gravity.CENTER_HORIZONTAL);
        int p = Estilo.dp(c, 8);
        b.setPadding(p, p, p, p);
        b.setBackground(Estilo.apretable(0x00000000, Estilo.TARJETA, Estilo.dp(c, 14)));
        ImageView i = new ImageView(c);
        i.setImageDrawable(icono);
        b.addView(i, new LinearLayout.LayoutParams(Estilo.dp(c, 46), Estilo.dp(c, 46)));
        TextView t = Estilo.texto(c, nombre, 11, Estilo.TEXTO, false);
        t.setGravity(Gravity.CENTER);
        t.setMaxLines(2);
        b.addView(t);
        b.setClickable(true);
        b.setOnClickListener(l);
        GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED), GridLayout.spec(GridLayout.UNDEFINED, 1f));
        lp.width = 0;
        b.setLayoutParams(lp);
        return b;
    }
}
