package com.juniorspro.nexoxr;

import java.util.ArrayList;
import java.util.List;

/**
 * LAS APPS WEB: páginas que se usan como apps (cada una en su ventana, con su
 * sesión guardada). Un catálogo de las de siempre y las que agregás vos desde
 * el navegador ("Agregar a Apps"). Sin logos de marca: una baldosa de color
 * con la inicial y el nombre.
 *
 * Se guardan como texto (una por línea: nombre, dirección, color, escritorio),
 * sin Android: se prueba en la PC.
 */
public final class AppsWeb {
    public static final class App {
        public final String nombre, url;
        public final int color;
        /** Pedir la versión de computadora (WhatsApp Web la necesita). */
        public final boolean escritorio;

        public App(String nombre, String url, int color, boolean escritorio) {
            this.nombre = nombre; this.url = url; this.color = color; this.escritorio = escritorio;
        }

        /** El nombre de la ventana: "web:" + la dirección. */
        public String id() { return "web:" + url; }

        public String inicial() { return nombre.isEmpty() ? "?" : nombre.substring(0, 1).toUpperCase(); }
    }

    public static final App[] CATALOGO = {
            new App("YouTube", "https://m.youtube.com", 0xFFE53935, false),
            new App("WhatsApp", "https://web.whatsapp.com", 0xFF25A35A, true),
            new App("Mapas", "https://www.google.com/maps", 0xFF2E9E57, false),
            new App("Gmail", "https://mail.google.com", 0xFFC8423A, false),
            new App("YT Música", "https://music.youtube.com", 0xFFE8457A, false),
            new App("Twitch", "https://m.twitch.tv", 0xFF8047F0, false),
            new App("Wikipedia", "https://es.wikipedia.org", 0xFF7D8494, false),
            new App("Noticias", "https://news.google.com", 0xFFE89A2E, false),
            new App("Drive", "https://drive.google.com", 0xFF2F8FE0, false),
            new App("Traductor", "https://translate.google.com", 0xFF3D7BFF, false),
            new App("Instagram", "https://www.instagram.com", 0xFFD1437A, false),
            new App("X", "https://x.com", 0xFF2A2D35, false)};

    /** El "user agent" de una compu (para el modo escritorio). */
    public static final String UA_ESCRITORIO = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    // ───────────────────────── guardar y leer ─────────────────────────

    public static String serializar(List<App> apps) {
        StringBuilder b = new StringBuilder();
        for (App a : apps)
            b.append(limpio(a.nombre)).append('\t').append(limpio(a.url)).append('\t')
                    .append(Integer.toHexString(a.color)).append('\t').append(a.escritorio ? 1 : 0).append('\n');
        return b.toString();
    }

    public static List<App> leer(String texto) {
        ArrayList<App> o = new ArrayList<>();
        if (texto == null) return o;
        for (String l : texto.split("\n")) {
            String[] c = l.split("\t");
            if (c.length < 2 || c[1].isEmpty()) continue;
            int color;
            try { color = c.length > 2 ? (int) Long.parseLong(c[2], 16) : colorDe(c[0]); } catch (NumberFormatException e) { color = colorDe(c[0]); }
            o.add(new App(c[0], c[1], color, c.length > 3 && c[3].equals("1")));
        }
        return o;
    }

    private static String limpio(String s) { return s == null ? "" : s.replace('\t', ' ').replace('\n', ' ').trim(); }

    /** Agrega (o reemplaza, si ya estaba esa dirección) y devuelve la lista nueva. */
    public static List<App> agregar(List<App> apps, App a) {
        ArrayList<App> o = new ArrayList<>();
        for (App x : apps) if (!mismaUrl(x.url, a.url)) o.add(x);
        o.add(a);
        return o;
    }

    public static List<App> quitar(List<App> apps, String url) {
        ArrayList<App> o = new ArrayList<>();
        for (App x : apps) if (!mismaUrl(x.url, url)) o.add(x);
        return o;
    }

    /** La app de una ventana ("web:https://…"): del catálogo, de las tuyas, o una nueva con esa dirección. */
    public static App deId(String id, List<App> tuyas) {
        String url = id.startsWith("web:") ? id.substring(4) : id;
        for (App a : CATALOGO) if (mismaUrl(a.url, url)) return a;
        if (tuyas != null) for (App a : tuyas) if (mismaUrl(a.url, url)) return a;
        return new App(nombreDe(url), url, colorDe(url), false);
    }

    static boolean mismaUrl(String a, String b) { return normal(a).equals(normal(b)); }

    private static String normal(String u) {
        String s = u == null ? "" : u.trim().toLowerCase();
        s = s.replaceFirst("^https?://", "").replaceFirst("^www\\.", "");
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s;
    }

    /** "https://www.ejemplo.com.ar/algo" → "ejemplo.com.ar". */
    public static String host(String url) {
        String s = url == null ? "" : url.replaceFirst("^[a-zA-Z]+://", "");
        int i = s.indexOf('/');
        if (i >= 0) s = s.substring(0, i);
        i = s.indexOf('?');
        if (i >= 0) s = s.substring(0, i);
        return s.replaceFirst("^www\\.", "").replaceFirst("^m\\.", "");
    }

    /** Un nombre lindo de la dirección: "ejemplo.com.ar" → "Ejemplo". */
    public static String nombreDe(String url) {
        String h = host(url);
        int i = h.indexOf('.');
        String n = i > 0 ? h.substring(0, i) : h;
        return n.isEmpty() ? "Web" : n.substring(0, 1).toUpperCase() + n.substring(1);
    }

    /** Un color de la paleta, siempre el mismo para el mismo texto. */
    public static int colorDe(String s) {
        int[] paleta = {0xFF3D7BFF, 0xFF7A4DFF, 0xFF1FA37A, 0xFFE8457A, 0xFFE89A2E, 0xFF2F8FE0, 0xFFC8423A, 0xFF8047F0, 0xFF16A0A0, 0xFF5C6275};
        int h = 0;
        for (char c : (s == null ? "" : host(s).isEmpty() ? s : host(s)).toCharArray()) h = h * 31 + c;
        return paleta[Math.floorMod(h, paleta.length)];
    }
}
