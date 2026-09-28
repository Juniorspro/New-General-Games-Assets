package com.juniorspro.nexoxr;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * EL CLIMA: el de tu ciudad (la buscás escribiendo), ahora, las próximas horas
 * y los próximos 7 días, con el cielo de fondo. Los datos, de Open-Meteo
 * (libre, sin cuenta): sólo se manda el nombre de la ciudad que buscás y su
 * ubicación, nada tuyo.
 */
final class ClimaApp {
    private Context c;
    private Sistema s;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private FrameLayout raiz;
    private LinearLayout contenido;
    private EditText buscar;
    private SharedPreferences prefs;

    View crear(Context ctx, Sistema sis) {
        c = ctx;
        s = sis;
        prefs = c.getSharedPreferences("clima", Context.MODE_PRIVATE);
        raiz = new FrameLayout(c);
        raiz.setBackgroundColor(Estilo.FONDO);
        ScrollView sv = new ScrollView(c);
        contenido = new LinearLayout(c);
        contenido.setOrientation(LinearLayout.VERTICAL);
        int m = Estilo.dp(c, 22);
        contenido.setPadding(m, Estilo.dp(c, 16), m, m);
        sv.addView(contenido);
        raiz.addView(sv, new FrameLayout.LayoutParams(-1, -1));
        if (prefs.contains("lat")) cargar(); else pedirCiudad(null);
        return raiz;
    }

    // ── buscar la ciudad ──

    private void pedirCiudad(String mensaje) {
        contenido.removeAllViews();
        raiz.setBackgroundColor(Estilo.FONDO);
        contenido.addView(Estilo.texto(c, "Clima", 26, Estilo.TEXTO, true));
        TextView t = Estilo.texto(c, mensaje != null ? mensaje : "¿De qué ciudad? Escribila y buscá.", 15, Estilo.TEXTO2, false);
        t.setPadding(0, Estilo.dp(c, 4), 0, Estilo.dp(c, 12));
        contenido.addView(t);
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        buscar = new EditText(c);
        buscar.setSingleLine(true);
        buscar.setTextSize(17);
        buscar.setTextColor(Estilo.TEXTO);
        buscar.setHintTextColor(Estilo.TEXTO2);
        buscar.setHint("Buenos Aires, Córdoba, Madrid…");
        buscar.setBackground(Estilo.forma(Estilo.TARJETA, Estilo.dp(c, 20)));
        buscar.setPadding(Estilo.dp(c, 16), Estilo.dp(c, 10), Estilo.dp(c, 16), Estilo.dp(c, 10));
        buscar.setShowSoftInputOnFocus(false);
        buscar.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        buscar.setOnFocusChangeListener((v, f) -> { if (f) s.mostrarTeclado(true); });
        buscar.setOnKeyListener((v, k, e) -> {
            if (k == KeyEvent.KEYCODE_ENTER && e.getAction() == KeyEvent.ACTION_UP) { buscar(); return true; }
            return k == KeyEvent.KEYCODE_ENTER;
        });
        buscar.setOnEditorActionListener((v, a, e) -> { buscar(); return true; });
        fila.addView(buscar, new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(-2, -2);
        lb.leftMargin = Estilo.dp(c, 10);
        fila.addView(Estilo.boton(c, Iconos.BUSCAR, "Buscar", true, v -> { s.sonido(Sonido.CLIC); buscar(); }), lb);
        contenido.addView(fila);
        buscar.requestFocus();
    }

    private void buscar() {
        String q = buscar.getText().toString().trim();
        if (q.isEmpty()) return;
        s.mostrarTeclado(false);
        esperando("Buscando " + q + "…");
        new Thread(() -> {
            try {
                JSONObject j = new JSONObject(bajar(Clima.urlBuscar(q)));
                JSONArray r = j.optJSONArray("results");
                ui.post(() -> resultados(q, r));
            } catch (Exception e) {
                ui.post(() -> pedirCiudad("No se pudo buscar (¿hay internet?). Probá de nuevo."));
            }
        }, "clima-buscar").start();
    }

    private void resultados(String q, JSONArray r) {
        if (r == null || r.length() == 0) { pedirCiudad("No encontré \"" + q + "\". Probá con otro nombre."); return; }
        contenido.removeAllViews();
        contenido.addView(Estilo.texto(c, "¿Cuál?", 24, Estilo.TEXTO, true));
        for (int i = 0; i < r.length(); i++) {
            JSONObject o = r.optJSONObject(i);
            if (o == null) continue;
            String nombre = o.optString("name"), zona = o.optString("admin1", ""), pais = o.optString("country", "");
            double lat = o.optDouble("latitude"), lon = o.optDouble("longitude");
            LinearLayout fila = Estilo.renglon(c, Iconos.CLIMA, nombre, (zona.isEmpty() ? "" : zona + ", ") + pais, null);
            fila.setBackground(Estilo.apretable(Estilo.TARJETA, Estilo.TARJETA_ALTA, Estilo.dp(c, 14)));
            fila.setClickable(true);
            fila.setOnClickListener(v -> {
                s.sonido(Sonido.CLIC);
                prefs.edit().putString("nombre", nombre).putFloat("lat", (float) lat).putFloat("lon", (float) lon).apply();
                cargar();
            });
            contenido.addView(fila);
        }
    }

    private void esperando(String t) {
        contenido.removeAllViews();
        TextView v = Estilo.texto(c, t, 18, Estilo.TEXTO2, false);
        v.setPadding(0, Estilo.dp(c, 40), 0, 0);
        v.setGravity(Gravity.CENTER);
        contenido.addView(v, new LinearLayout.LayoutParams(-1, -2));
    }

    // ── el tiempo ──

    private void cargar() {
        String nombre = prefs.getString("nombre", "");
        double lat = prefs.getFloat("lat", 0), lon = prefs.getFloat("lon", 0);
        esperando("El clima en " + nombre + "…");
        new Thread(() -> {
            try {
                JSONObject j = new JSONObject(bajar(Clima.urlTiempo(lat, lon)));
                ui.post(() -> mostrar(nombre, j));
            } catch (Exception e) {
                ui.post(() -> {
                    esperando("No se pudo traer el clima (¿hay internet?).");
                    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
                    lp.gravity = Gravity.CENTER_HORIZONTAL;
                    lp.topMargin = Estilo.dp(c, 12);
                    contenido.addView(Estilo.boton(c, Iconos.RECARGAR, "Reintentar", true, v -> cargar()), lp);
                });
            }
        }, "clima").start();
    }

    private void mostrar(String nombre, JSONObject j) {
        JSONObject ahora = j.optJSONObject("current");
        if (ahora == null) { pedirCiudad("El clima vino raro. Probá de nuevo."); return; }
        int cod = ahora.optInt("weather_code");
        boolean dia = ahora.optInt("is_day", 1) == 1;
        int[] cielo = Clima.cielo(cod, dia);
        raiz.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{cielo[0], cielo[1], 0xFF15161B}));
        contenido.removeAllViews();
        // la cabecera: la ciudad y cambiarla
        LinearLayout cab = new LinearLayout(c);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.addView(Estilo.texto(c, nombre, 24, 0xFFFFFFFF, true), new LinearLayout.LayoutParams(0, -2, 1));
        cab.addView(Estilo.botonIcono(c, Iconos.RECARGAR, 40, v -> { s.sonido(Sonido.CLIC); cargar(); }));
        cab.addView(Estilo.botonIcono(c, Iconos.BUSCAR, 40, v -> { s.sonido(Sonido.CLIC); pedirCiudad(null); }));
        contenido.addView(cab);
        // ahora
        LinearLayout fila = new LinearLayout(c);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        fila.addView(Estilo.icono(c, Clima.icono(cod, dia), 0xFFFFFFFF, 84));
        LinearLayout t = new LinearLayout(c);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setPadding(Estilo.dp(c, 18), 0, 0, 0);
        t.addView(Estilo.texto(c, Math.round(ahora.optDouble("temperature_2m")) + "°", 58, 0xFFFFFFFF, true));
        t.addView(Estilo.texto(c, Clima.descripcion(cod), 18, 0xEEFFFFFF, true));
        fila.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout datos = new LinearLayout(c);
        datos.setOrientation(LinearLayout.VERTICAL);
        datos.addView(Estilo.texto(c, "Sensación " + Math.round(ahora.optDouble("apparent_temperature")) + "°", 15, 0xEEFFFFFF, false));
        datos.addView(Estilo.texto(c, "Humedad " + ahora.optInt("relative_humidity_2m") + " %", 15, 0xEEFFFFFF, false));
        datos.addView(Estilo.texto(c, "Viento " + Math.round(ahora.optDouble("wind_speed_10m")) + " km/h", 15, 0xEEFFFFFF, false));
        fila.addView(datos);
        LinearLayout.LayoutParams lf = new LinearLayout.LayoutParams(-1, -2);
        lf.topMargin = Estilo.dp(c, 10);
        contenido.addView(fila, lf);
        // las próximas horas
        JSONObject horas = j.optJSONObject("hourly");
        if (horas != null) {
            JSONArray hs = horas.optJSONArray("time"), ts = horas.optJSONArray("temperature_2m"), cs = horas.optJSONArray("weather_code"),
                    ps = horas.optJSONArray("precipitation_probability"), ds = horas.optJSONArray("is_day");
            String hoyHora = ahora.optString("time", "");
            int desde = 0;
            if (hs != null) for (int i = 0; i < hs.length(); i++) if (hs.optString(i).compareTo(hoyHora) >= 0) { desde = i; break; }
            HorizontalScrollView hsv = new HorizontalScrollView(c);
            hsv.setHorizontalScrollBarEnabled(false);
            LinearLayout tira = new LinearLayout(c);
            for (int i = desde; hs != null && i < Math.min(hs.length(), desde + 18); i++) {
                LinearLayout h = new LinearLayout(c);
                h.setOrientation(LinearLayout.VERTICAL);
                h.setGravity(Gravity.CENTER_HORIZONTAL);
                h.setBackground(Estilo.forma(0x33000000, Estilo.dp(c, 14)));
                h.setPadding(Estilo.dp(c, 10), Estilo.dp(c, 8), Estilo.dp(c, 10), Estilo.dp(c, 8));
                String hora = hs.optString(i);
                h.addView(Estilo.texto(c, i == desde ? "Ahora" : hora.substring(Math.max(0, hora.length() - 5), hora.length() - 3) + " h", 12, 0xDDFFFFFF, false));
                h.addView(Estilo.icono(c, Clima.icono(cs.optInt(i), ds == null || ds.optInt(i, 1) == 1), 0xFFFFFFFF, 30));
                h.addView(Estilo.texto(c, Math.round(ts.optDouble(i)) + "°", 16, 0xFFFFFFFF, true));
                int lluvia = ps == null ? 0 : ps.optInt(i);
                h.addView(Estilo.texto(c, lluvia >= 10 ? lluvia + " %" : " ", 11, 0xFF9FD3FF, false));
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(Estilo.dp(c, 64), -2);
                lp.rightMargin = Estilo.dp(c, 6);
                tira.addView(h, lp);
            }
            hsv.addView(tira);
            LinearLayout.LayoutParams lh = new LinearLayout.LayoutParams(-1, -2);
            lh.topMargin = Estilo.dp(c, 16);
            contenido.addView(hsv, lh);
        }
        // los próximos días
        JSONObject dias = j.optJSONObject("daily");
        if (dias != null) {
            JSONArray fs = dias.optJSONArray("time"), max = dias.optJSONArray("temperature_2m_max"), min = dias.optJSONArray("temperature_2m_min"),
                    cs = dias.optJSONArray("weather_code"), ps = dias.optJSONArray("precipitation_probability_max");
            double tmin = 99, tmax = -99;
            for (int i = 0; fs != null && i < fs.length(); i++) { tmin = Math.min(tmin, min.optDouble(i)); tmax = Math.max(tmax, max.optDouble(i)); }
            for (int i = 0; fs != null && i < fs.length(); i++) {
                LinearLayout d = new LinearLayout(c);
                d.setGravity(Gravity.CENTER_VERTICAL);
                d.setPadding(Estilo.dp(c, 12), Estilo.dp(c, 6), Estilo.dp(c, 12), Estilo.dp(c, 6));
                d.setBackground(Estilo.forma(0x26000000, Estilo.dp(c, 12)));
                d.addView(Estilo.texto(c, Clima.dia(fs.optString(i), i == 0), 15, 0xFFFFFFFF, true), new LinearLayout.LayoutParams(Estilo.dp(c, 70), -2));
                d.addView(Estilo.icono(c, Clima.icono(cs.optInt(i), true), 0xFFFFFFFF, 26));
                int lluvia = ps == null ? 0 : ps.optInt(i);
                TextView pl = Estilo.texto(c, lluvia >= 10 ? lluvia + " %" : "", 12, 0xFF9FD3FF, false);
                d.addView(pl, new LinearLayout.LayoutParams(Estilo.dp(c, 48), -2));
                d.addView(Estilo.texto(c, Math.round(min.optDouble(i)) + "°", 14, 0xCCFFFFFF, false), new LinearLayout.LayoutParams(Estilo.dp(c, 36), -2));
                // la barra de la mínima a la máxima (sobre todo el rango de la semana)
                LinearLayout barra = new LinearLayout(c);
                float a = (float) ((min.optDouble(i) - tmin) / Math.max(1, tmax - tmin)), b = (float) ((max.optDouble(i) - tmin) / Math.max(1, tmax - tmin));
                View v0 = new View(c), v1 = new View(c), v2 = new View(c);
                v1.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{0xFF7AC4FF, 0xFFFFC46B}));
                barra.addView(v0, new LinearLayout.LayoutParams(0, Estilo.dp(c, 6), Math.max(0.001f, a)));
                barra.addView(v1, new LinearLayout.LayoutParams(0, Estilo.dp(c, 6), Math.max(0.05f, b - a)));
                barra.addView(v2, new LinearLayout.LayoutParams(0, Estilo.dp(c, 6), Math.max(0.001f, 1 - b)));
                barra.setBackground(Estilo.forma(0x33FFFFFF, Estilo.dp(c, 3)));
                d.addView(barra, new LinearLayout.LayoutParams(0, Estilo.dp(c, 6), 1));
                TextView mx = Estilo.texto(c, Math.round(max.optDouble(i)) + "°", 14, 0xFFFFFFFF, true);
                mx.setGravity(Gravity.END);
                d.addView(mx, new LinearLayout.LayoutParams(Estilo.dp(c, 40), -2));
                LinearLayout.LayoutParams ld = new LinearLayout.LayoutParams(-1, -2);
                ld.topMargin = Estilo.dp(c, 6);
                contenido.addView(d, ld);
            }
        }
        TextView pie = Estilo.texto(c, "Datos: Open-Meteo · " + ahora.optString("time", "").replace('T', ' '), 11, 0x99FFFFFF, false);
        pie.setPadding(0, Estilo.dp(c, 12), 0, 0);
        contenido.addView(pie);
    }

    private static String bajar(String url) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(10000);
        h.setReadTimeout(15000);
        try (InputStream in = h.getInputStream()) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
            return b.toString("UTF-8");
        } finally { h.disconnect(); }
    }
}
