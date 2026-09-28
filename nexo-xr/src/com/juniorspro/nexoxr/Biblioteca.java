package com.juniorspro.nexoxr;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.drawable.Drawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Collections;
import java.util.List;

/**
 * LAS APPS (la biblioteca): las del sistema en baldosas grandes, y abajo las
 * apps del teléfono (esas se abren en el teléfono, fuera del visor).
 */
final class Biblioteca {
    View crear(Context c, Sistema s) {
        ScrollView sv = new ScrollView(c);
        sv.setBackgroundColor(Estilo.FONDO);
        LinearLayout col = new LinearLayout(c);
        col.setOrientation(LinearLayout.VERTICAL);
        int m = Estilo.dp(c, 22);
        col.setPadding(m, m, m, m);
        sv.addView(col);
        col.addView(Estilo.texto(c, "Apps", 26, Estilo.TEXTO, true));
        // las del sistema
        GridLayout g = new GridLayout(c);
        g.setColumnCount(4);
        String[][] apps = {{"navegador", "Navegador", "Navegá la web en una pantalla gigante"}, {"galeria", "Galería", "Tus fotos y videos"},
                {"ajustes", "Ajustes", "Entorno, visor, manos, control"}, {"bienvenida", "Cómo se usa", "Los gestos y los botones"}};
        int[] ic = {Iconos.WEB, Iconos.GALERIA, Iconos.AJUSTES, Iconos.INFO};
        int[] col1 = {0xFF3D7BFF, 0xFFFF7A59, 0xFF7C8394, 0xFF35C28B}, col2 = {0xFF1A3C8F, 0xFF8F2E1A, 0xFF3A3F4B, 0xFF16624A};
        for (int i = 0; i < apps.length; i++) {
            final String app = apps[i][0];
            LinearLayout b = new LinearLayout(c);
            b.setOrientation(LinearLayout.VERTICAL);
            int p = Estilo.dp(c, 16);
            b.setPadding(p, p, p, p);
            android.graphics.drawable.GradientDrawable fondo = new android.graphics.drawable.GradientDrawable(
                    android.graphics.drawable.GradientDrawable.Orientation.TL_BR, new int[]{col1[i], col2[i]});
            fondo.setCornerRadius(Estilo.dp(c, 22));
            b.setBackground(fondo);
            b.addView(Estilo.icono(c, ic[i], 0xFFFFFFFF, 40));
            View esp = new View(c);
            b.addView(esp, new LinearLayout.LayoutParams(1, 0, 1));
            b.addView(Estilo.texto(c, apps[i][1], 18, 0xFFFFFFFF, true));
            TextView d = Estilo.texto(c, apps[i][2], 12, 0xDDFFFFFF, false);
            b.addView(d);
            b.setClickable(true);
            b.setOnClickListener(v -> { s.sonido(Sonido.CLIC); s.abrir(app); });
            b.setForeground(Estilo.apretable(0x00000000, 0x33FFFFFF, Estilo.dp(c, 22)));
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams(GridLayout.spec(i / 4), GridLayout.spec(i % 4, 1f));
            lp.width = 0;
            lp.height = Estilo.dp(c, 150);
            lp.setMargins(Estilo.dp(c, 6), Estilo.dp(c, 6), Estilo.dp(c, 6), Estilo.dp(c, 6));
            g.addView(b, lp);
        }
        LinearLayout.LayoutParams lg = new LinearLayout.LayoutParams(-1, -2);
        lg.topMargin = Estilo.dp(c, 14);
        col.addView(g, lg);
        // las del teléfono
        TextView t = Estilo.texto(c, "Del teléfono", 18, Estilo.TEXTO, true);
        LinearLayout.LayoutParams lt = new LinearLayout.LayoutParams(-2, -2);
        lt.topMargin = Estilo.dp(c, 22);
        col.addView(t, lt);
        TextView aviso = Estilo.texto(c, "Se abren en la pantalla del teléfono (fuera del visor). Para volver, abrí Nexo.", 12, Estilo.TEXTO2, false);
        col.addView(aviso);
        GridLayout tel = new GridLayout(c);
        tel.setColumnCount(6);
        LinearLayout.LayoutParams ltel = new LinearLayout.LayoutParams(-1, -2);
        ltel.topMargin = Estilo.dp(c, 10);
        col.addView(tel, ltel);
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
