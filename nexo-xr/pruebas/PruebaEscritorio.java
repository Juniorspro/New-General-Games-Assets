import com.juniorspro.nexoxr.Escritorio;
import com.juniorspro.nexoxr.Puntero;
import com.juniorspro.nexoxr.Ventana;

import java.util.ArrayList;
import java.util.Locale;

/**
 * El escritorio en el espacio y el puntero: dónde se abren las ventanas, a qué
 * le pega el rayo, clic, arrastre, scroll, tocar con el dedo, mirar fijo,
 * mover una ventana de su barra, cerrar, modo cine, recentrar.
 */
public class PruebaEscritorio {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static float[] norm(float x, float y, float z) {
        float l = (float) Math.sqrt(x * x + y * y + z * z);
        return new float[]{x / l, y / l, z / l};
    }

    /** Lo que llega de un toque. */
    static final class Toque {
        final Ventana v; final int accion; final float u, w;
        Toque(Ventana v, int a, float u, float w) { this.v = v; accion = a; this.u = u; this.w = w; }
    }

    static final ArrayList<Toque> toques = new ArrayList<>();
    static final ArrayList<String> botones = new ArrayList<>();
    static int nada, nadaLarga;

    static final Puntero.Oyente OYENTE = new Puntero.Oyente() {
        public void toque(Ventana v, int accion, float u, float w, int fuente) { toques.add(new Toque(v, accion, u, w)); }
        public void boton(Ventana v, int que) { botones.add(v.app + ":" + (que == Ventana.CERRAR ? "cerrar" : "ampliar")); }
        public void enLaNada(int fuente, boolean largo) { if (largo) nadaLarga++; else nada++; }
    };

    /** Apunta la fuente k desde la cabeza (0, 1.6, 0) hacia el punto p, apretando o no. */
    static void apuntar(Puntero p, int k, float[] hacia, boolean aprieta) {
        Puntero.Fuente f = p.fuentes[k];
        f.activa = true;
        f.ox = 0; f.oy = 1.5f; f.oz = 0;
        float[] d = norm(hacia[0] - f.ox, hacia[1] - f.oy, hacia[2] - f.oz);
        f.dx = d[0]; f.dy = d[1]; f.dz = d[2];
        f.aprieta = aprieta;
    }

    static long ms = 10_000;

    static void pasos(Escritorio e, Puntero p, int n) {
        for (int i = 0; i < n; i++) { ms += 16; p.paso(e, 0.016f, ms, 0, 1.6f, 0, OYENTE); }
    }

    public static void main(String[] a) {
        Escritorio e = new Escritorio();
        e.recentrar(0, 1.6f, 0, 0);
        e.ponerDock(1400, 200, 0.62f, 0);
        Ventana nav = e.abrir("navegador", 1280, 800, 1);
        Ventana gal = e.abrir("galeria", 1280, 800, 2);
        Ventana aju = e.abrir("ajustes", 1000, 800, 3);
        System.out.printf(Locale.ROOT, "navegador en (%.2f %.2f %.2f) · galería (%.2f %.2f %.2f) · ajustes (%.2f %.2f %.2f) · dock (%.2f %.2f %.2f)%n",
                nav.cx, nav.cy, nav.cz, gal.cx, gal.cy, gal.cz, aju.cx, aju.cy, aju.cz, e.dock.cx, e.dock.cy, e.dock.cz);
        ver(Math.abs(nav.cx) < 1e-3f && nav.cz < -1f, "la primera se abre adelante, a 1.1 m");
        ver(gal.cx < -0.5f && aju.cx > 0.5f, "la segunda a la izquierda, la tercera a la derecha");
        float[] hacia = new float[3];
        for (Ventana v : new Ventana[]{nav, gal, aju, e.dock}) {
            float dx = -v.cx, dy = 1.6f - v.cy, dz = -v.cz, l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
            float c = (v.n[0] * dx + v.n[1] * dy + v.n[2] * dz) / l;
            if (c < 0.999f) ver(false, v.app + " no mira a la cabeza (" + c + ")");
        }
        ver(true, "todas miran de frente a la cabeza (el dock, inclinado hacia arriba)");
        ver(e.dock.cy < 1.3f && e.dock.cz < -0.5f && e.dock.pitch > 0.3f, String.format(Locale.ROOT, "el dock abajo y adelante, inclinado (%.0f°)", Math.toDegrees(e.dock.pitch)));
        Ventana cuarta = e.abrir("biblioteca", 1280, 800, 4);
        ver(e.ventanas.stream().filter(v -> v.tipo == Ventana.APP).count() == 3 && !e.ventanas.contains(nav),
                "la cuarta reemplaza a la más vieja que no está enfocada (el navegador)");
        ver(cuarta.lugar == nav.lugar, "y usa su lugar");
        ver(e.abrir("galeria", 1280, 800, 5) == gal && e.enfocada == gal, "abrir una que ya está abierta la trae al foco");

        // ── el rayo y el clic ──
        Puntero p = new Puntero();
        p.clicConMirada = false;
        float[] punto = new float[3];
        gal.aMundo(0.1f * gal.ancho, 0.2f * gal.alto, punto);   // (u, v) = (0.6, 0.3)
        apuntar(p, Puntero.MANO_DER, punto, false);
        pasos(e, p, 10);
        Puntero.Fuente f = p.fuentes[Puntero.MANO_DER];
        ver(f.sobre == gal && Math.abs(f.u - 0.6f) < 0.01f && Math.abs(f.v - 0.3f) < 0.01f, String.format(Locale.ROOT, "el rayo le pega a la galería en (%.2f, %.2f)", f.u, f.v));
        toques.clear();
        // pellizco: la mano se corre 2 cm al pellizcar (el rayo de hace 80 ms no)
        apuntar(p, Puntero.MANO_DER, punto, false);
        pasos(e, p, 6);
        float[] corrido = {punto[0] + 0.02f, punto[1] - 0.02f, punto[2]};
        apuntar(p, Puntero.MANO_DER, corrido, false);
        pasos(e, p, 1);
        apuntar(p, Puntero.MANO_DER, corrido, true);
        pasos(e, p, 3);
        apuntar(p, Puntero.MANO_DER, corrido, false);
        pasos(e, p, 1);
        ver(toques.size() >= 3 && toques.get(0).accion == Puntero.BAJA && toques.get(toques.size() - 1).accion == Puntero.SUBE,
                "pellizcar y soltar: bajar, (mover) y subir");
        Toque baja = toques.get(0), sube = toques.get(toques.size() - 1);
        ver(Math.abs(baja.u - 0.6f) < 0.01f && Math.abs(baja.w - 0.3f) < 0.01f,
                String.format(Locale.ROOT, "el clic cae donde apuntabas antes de pellizcar (%.3f, %.3f), no donde se corrió la mano", baja.u, baja.w));
        ver(sube.u == baja.u && sube.w == baja.w, "y sube en el mismo lugar: un clic no se vuelve un arrastre");

        // el doble pellizco: la mano se corre en los dos pellizcos (más que 80 ms); el clic va al rayo de antes del primero
        for (int caso = 0; caso < 2; caso++) {
            float corre = caso == 0 ? 0.03f : 0.25f;   // 1.5° (sin querer) o 13° (te moviste a propósito)
            float[] lejos = {punto[0] + corre, punto[1], punto[2]};
            apuntar(p, Puntero.MANO_DER, punto, false);
            pasos(e, p, 4);
            f.fox = f.ox; f.foy = f.oy; f.foz = f.oz; f.fdx = f.dx; f.fdy = f.dy; f.fdz = f.dz;
            f.fijoVale = true;
            apuntar(p, Puntero.MANO_DER, lejos, false);
            pasos(e, p, 20);
            toques.clear();
            apuntar(p, Puntero.MANO_DER, lejos, true);
            pasos(e, p, 3);
            apuntar(p, Puntero.MANO_DER, lejos, false);
            pasos(e, p, 1);
            f.fijoVale = false;
            Toque b = toques.get(0);
            if (caso == 0) ver(Math.abs(b.u - 0.6f) < 0.01f && Math.abs(b.w - 0.3f) < 0.01f,
                    String.format(Locale.ROOT, "doble pellizco: el clic cae donde apuntabas antes del primero (%.3f, %.3f) aunque la mano se corrió 1.5°", b.u, b.w));
            else ver(b.u > 0.7f, String.format(Locale.ROOT, "pero si moviste la mano 13° a propósito, va a donde apuntás ahora (u = %.3f)", b.u));
        }
        toques.clear();

        // scroll: pellizcar y mover 10 cm para arriba
        toques.clear();
        float[] desde = new float[3], hasta = new float[3];
        gal.aMundo(0, -0.1f, desde);
        gal.aMundo(0, 0.1f, hasta);
        apuntar(p, Puntero.MANO_DER, desde, false);
        pasos(e, p, 8);
        for (int i = 0; i <= 20; i++) {
            float t = i / 20f;
            float[] q = {desde[0] + (hasta[0] - desde[0]) * t, desde[1] + (hasta[1] - desde[1]) * t, desde[2] + (hasta[2] - desde[2]) * t};
            apuntar(p, Puntero.MANO_DER, q, true);
            pasos(e, p, 1);
        }
        apuntar(p, Puntero.MANO_DER, hasta, false);
        pasos(e, p, 1);
        Toque ult = toques.get(toques.size() - 1);
        ver(toques.get(0).accion == Puntero.BAJA && ult.accion == Puntero.SUBE && toques.get(0).w - ult.w > 0.15f,
                String.format(Locale.ROOT, "pellizcar y mover hace scroll (v de %.2f a %.2f)", toques.get(0).w, ult.w));
        // arrastrar fuera de la ventana: sigue siendo de la misma (no se corta)
        toques.clear();
        gal.aMundo(gal.ancho * 0.4f, 0, desde);
        apuntar(p, Puntero.MANO_DER, desde, false);
        pasos(e, p, 8);
        apuntar(p, Puntero.MANO_DER, desde, true);
        pasos(e, p, 1);
        gal.aMundo(gal.ancho * 0.9f, 0, hasta);
        apuntar(p, Puntero.MANO_DER, hasta, true);
        pasos(e, p, 3);
        boolean todos = true;
        for (Toque t : toques) todos &= t.v == gal;
        ver(todos && toques.get(toques.size() - 1).accion == Puntero.MUEVE, "agarrado, si el rayo se sale de la ventana sigue siendo de ella");
        apuntar(p, Puntero.MANO_DER, hasta, false);
        pasos(e, p, 1);

        // ── mover la ventana de su barra ──
        float[] barra = new float[3];
        gal.aMundo(0, gal.barraY(), barra);
        apuntar(p, Puntero.MANO_DER, barra, false);
        pasos(e, p, 8);
        ver(f.que == Ventana.BARRA, "el rayo encuentra la barra debajo de la ventana");
        apuntar(p, Puntero.MANO_DER, barra, true);
        pasos(e, p, 2);
        float x0 = gal.cx;
        // girar el rayo 20° a la derecha
        float[] nuevo = {barra[0] + 0.45f, barra[1] + 0.1f, barra[2]};
        apuntar(p, Puntero.MANO_DER, nuevo, true);
        pasos(e, p, 2);
        float dx = gal.cx, dz = gal.cz, dy = gal.cy - 1.6f;
        float dist = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        ver(gal.cx > x0 + 0.25f, String.format(Locale.ROOT, "arrastrando la barra la ventana se mueve (x %.2f → %.2f)", x0, gal.cx));
        float c = (gal.n[0] * -gal.cx + gal.n[1] * (1.6f - gal.cy) + gal.n[2] * -gal.cz) / dist;
        ver(c > 0.99f, "y queda de frente a vos");
        apuntar(p, Puntero.MANO_DER, nuevo, false);
        pasos(e, p, 1);
        ver(gal.lugar == -1 && !e.arrastrando(), "al soltar queda donde la dejaste");

        // ── cerrar y ampliar (los botones al lado de la barra) ──
        botones.clear();
        float[] cerrar = new float[3];
        aju.aMundo(aju.cerrarX(), aju.barraY(), cerrar);
        apuntar(p, Puntero.MANO_DER, cerrar, false);
        pasos(e, p, 8);
        apuntar(p, Puntero.MANO_DER, cerrar, true);
        pasos(e, p, 2);
        apuntar(p, Puntero.MANO_DER, cerrar, false);
        pasos(e, p, 1);
        ver(botones.size() == 1 && botones.get(0).equals("ajustes:cerrar"), "el botón de cerrar (" + botones + ")");
        e.cerrar(aju);
        float[] amp = new float[3];
        cuarta.aMundo(cuarta.ampliarX(), cuarta.barraY(), amp);
        botones.clear();
        apuntar(p, Puntero.MANO_DER, amp, false);
        pasos(e, p, 8);
        apuntar(p, Puntero.MANO_DER, amp, true);
        pasos(e, p, 2);
        // se va del botón antes de soltar: no cuenta
        apuntar(p, Puntero.MANO_DER, new float[]{amp[0], amp[1] + 0.3f, amp[2]}, true);
        pasos(e, p, 2);
        apuntar(p, Puntero.MANO_DER, new float[]{amp[0], amp[1] + 0.3f, amp[2]}, false);
        pasos(e, p, 1);
        ver(botones.isEmpty(), "si te vas del botón antes de soltar, no se toca");
        e.cine(cuarta, true);
        float dc = (float) Math.sqrt(cuarta.cx * cuarta.cx + cuarta.cz * cuarta.cz);
        ver(cuarta.ancho > 3 && dc > 3, String.format(Locale.ROOT, "modo cine: %.1f m de ancho a %.1f m", cuarta.ancho, dc));
        e.cine(cuarta, false);
        ver(Math.abs(cuarta.ancho - Escritorio.ANCHO_APP) < 1e-3f && cuarta.lugar >= 0, "y vuelve a su lugar");

        // ── tocar con el dedo ──
        toques.clear();
        Puntero.Fuente izq = p.fuentes[Puntero.MANO_IZQ];
        izq.activa = true; izq.conDedo = true; izq.aprieta = false;
        apuntar(p, Puntero.MANO_IZQ, new float[]{0, 0, -5}, false);   // el rayo a otro lado
        float[] sobre = new float[3];
        cuarta.aMundo(-0.2f, 0.1f, sobre);
        for (int i = 0; i <= 12; i++) {
            float d = 0.06f - i * 0.006f;   // de 6 cm adelante a 1.2 cm detrás
            izq.tx = sobre[0] + cuarta.n[0] * d; izq.ty = sobre[1] + cuarta.n[1] * d; izq.tz = sobre[2] + cuarta.n[2] * d;
            pasos(e, p, 1);
        }
        ver(toques.size() > 0 && toques.get(0).accion == Puntero.BAJA && toques.get(0).v == cuarta, "el dedo toca la ventana al llegar al plano");
        for (int i = 0; i <= 8; i++) {
            float d = -0.012f + i * 0.008f;
            izq.tx = sobre[0] + cuarta.n[0] * d; izq.ty = sobre[1] + cuarta.n[1] * d; izq.tz = sobre[2] + cuarta.n[2] * d;
            pasos(e, p, 1);
        }
        ver(toques.get(toques.size() - 1).accion == Puntero.SUBE && Math.abs(toques.get(0).u - toques.get(toques.size() - 1).u) < 1e-4f,
                "y suelta al alejarse, en el mismo lugar (un toque)");
        izq.activa = false;
        pasos(e, p, 1);

        // ── mirar fijo ──
        Puntero pm = new Puntero();
        toques.clear();
        float[] centro = new float[3];
        cuarta.aMundo(0, 0, centro);
        apuntar(pm, Puntero.MIRADA, centro, false);
        for (int i = 0; i < 60; i++) { ms += 16; pm.paso(e, 0.016f, ms, 0, 1.6f, 0, OYENTE); }
        ver(toques.isEmpty() && pm.fuentes[Puntero.MIRADA].carga > 0.5f, "mirando fijo, se va cargando (sin clic todavía)");
        for (int i = 0; i < 20; i++) { ms += 16; pm.paso(e, 0.016f, ms, 0, 1.6f, 0, OYENTE); }
        ver(toques.size() == 2 && toques.get(0).accion == Puntero.BAJA && toques.get(1).accion == Puntero.SUBE, "a los 1.1 s: clic");
        for (int i = 0; i < 60; i++) { ms += 16; pm.paso(e, 0.016f, ms, 0, 1.6f, 0, OYENTE); }
        ver(toques.size() == 2, "y no vuelve a hacer clic enseguida");

        // ── pellizcar en la nada ──
        nada = 0; nadaLarga = 0;
        apuntar(p, Puntero.MANO_DER, new float[]{0, 5, 0}, false);
        pasos(e, p, 10);
        apuntar(p, Puntero.MANO_DER, new float[]{0, 5, 0}, true);
        pasos(e, p, 5);
        apuntar(p, Puntero.MANO_DER, new float[]{0, 5, 0}, false);
        pasos(e, p, 1);
        ver(nada == 1 && nadaLarga == 0, "un pellizco en la nada (muestra / esconde la barra de abajo)");
        apuntar(p, Puntero.MANO_DER, new float[]{0, 5, 0}, true);
        pasos(e, p, 60);
        apuntar(p, Puntero.MANO_DER, new float[]{0, 5, 0}, false);
        pasos(e, p, 1);
        ver(nadaLarga == 1 && nada == 1, "sostenido 0.8 s: recentrar (y el corto no cuenta)");

        // ── recentrar: todo delante de donde mirás ──
        float yaw = (float) Math.toRadians(90);   // mirando a −X
        e.recentrar(2, 1.6f, 1, yaw);
        Ventana dockR = e.dock;
        ver(dockR.cx < 2 - 0.5f && Math.abs(dockR.cz - 1) < 0.05f, String.format(Locale.ROOT, "recentrar: el dock va delante tuyo (%.2f, %.2f)", dockR.cx, dockR.cz));
        boolean frente = true;
        for (Ventana v : e.ventanas) if (v.tipo == Ventana.APP && v.lugar == 0) frente &= v.cx < 2 - 1 && Math.abs(v.cz - 1) < 0.05f;
        ver(frente, "y la del centro, a 1.1 m delante de donde mirás");
        ver(gal.cx < 2 && Math.abs(gal.cy - 1.7f) < 0.3f, String.format(Locale.ROOT, "la que moviste a mano gira con vos (%.2f %.2f %.2f)", gal.cx, gal.cy, gal.cz));

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
