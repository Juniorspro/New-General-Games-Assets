package com.juniorspro.nexoxr;

import java.util.ArrayList;
import java.util.Locale;

/**
 * El CRONÓMETRO y el TEMPORIZADOR del reloj, sin Android (con la hora que se
 * les pasa, en ms): se prueban en la PC. Siguen andando aunque se cierre la
 * ventana (viven en el sistema, no en la vista).
 */
public final class Tiempos {
    private Tiempos() {}

    public static final class Cronometro {
        private long acumulado, desde = -1;
        public final ArrayList<Long> vueltas = new ArrayList<>();

        public boolean andando() { return desde >= 0; }
        public void empezar(long ahora) { if (desde < 0) desde = ahora; }
        public void parar(long ahora) { if (desde >= 0) { acumulado += ahora - desde; desde = -1; } }
        public void reiniciar() { acumulado = 0; desde = -1; vueltas.clear(); }
        public long ms(long ahora) { return acumulado + (desde >= 0 ? ahora - desde : 0); }
        /** Una vuelta: el tiempo desde la vuelta anterior. */
        public void vuelta(long ahora) {
            long t = ms(ahora), antes = 0;
            for (long v : vueltas) antes += v;
            vueltas.add(t - antes);
        }
    }

    public static final class Temporizador {
        private long total, fin = -1, restaPausado;
        /** Si ya sonó (para no sonar dos veces). */
        public boolean sono;

        public void poner(long ms) { total = Math.max(0, ms); fin = -1; restaPausado = total; sono = false; }
        public long total() { return total; }
        public boolean andando() { return fin >= 0; }
        public void empezar(long ahora) { if (fin < 0 && restaPausado > 0) { fin = ahora + restaPausado; sono = false; } }
        public void pausar(long ahora) { if (fin >= 0) { restaPausado = Math.max(0, fin - ahora); fin = -1; } }
        public void sumar(long ms, long ahora) {
            if (fin >= 0) fin = Math.max(ahora, fin + ms);
            else restaPausado = Math.max(0, restaPausado + ms);
            total = Math.max(0, total + ms);
            sono = false;
        }
        public long resta(long ahora) { return fin >= 0 ? Math.max(0, fin - ahora) : restaPausado; }
        /** true una sola vez, cuando llega a cero. */
        public boolean termino(long ahora) {
            if (fin >= 0 && ahora >= fin && !sono) { sono = true; fin = -1; restaPausado = 0; return true; }
            return false;
        }
        public float progreso(long ahora) { return total <= 0 ? 0 : 1 - resta(ahora) / (float) total; }
    }

    /** 3725000 ms → "1:02:05"; 65000 → "01:05"; con décimas: "01:05,3". */
    public static String formato(long ms, boolean decimas) {
        long t = Math.max(0, ms);
        long h = t / 3600000, m = (t / 60000) % 60, s = (t / 1000) % 60, d = (t / 100) % 10;
        String b = h > 0 ? String.format(Locale.ROOT, "%d:%02d:%02d", h, m, s) : String.format(Locale.ROOT, "%02d:%02d", m, s);
        return decimas ? b + "," + d : b;
    }

    /** Para el temporizador: redondea hacia arriba al segundo (a 0.2 s de terminar muestra 00:01). */
    public static String restante(long ms) { return formato(((Math.max(0, ms) + 999) / 1000) * 1000, false); }
}
