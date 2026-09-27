import com.juniorspro.asaltomr.Juego;
import com.juniorspro.asaltomr.Tsdf;

/**
 * Las armas, los tipos de soldado y los modos, contra la escena escaneada de
 * PruebaEscaneo (piso, pared, mesa, tronco): la escopeta abre, el fusil tira
 * seguido, las granadas rebotan en el piso real y la pared protege de la
 * explosión, los blancos de práctica se pegan a las superficies reales.
 */
public class PruebaArmas {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static final class Ent implements Juego.Entorno, Juego.EntornoNormales {
        final Tsdf t;
        Ent(Tsdf t) { this.t = t; }
        public float suelo(float x, float z, float y0, float y1) { return t.suelo(x, z, y0, y1); }
        public float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float m) { return t.rayo(ox, oy, oz, dx, dy, dz, m); }
        public boolean ocupado(float x, float y, float z) { return t.ocupado(x, y, z); }
        public boolean normal(float x, float y, float z, float[] n) { return t.normal(x, y, z, n); }
    }

    static Juego.Soldado soldado(Juego j, float x, float z, int tipo) {
        Juego.Soldado s = new Juego.Soldado();
        s.x = x; s.y = 0; s.z = z; s.tipo = tipo; s.vida = tipo == Juego.PESADO ? 4 : 1;
        s.estado = Juego.APUNTA;
        j.soldados.add(s);
        return s;
    }

    static float[] hacia(float ox, float oy, float oz, float x, float y, float z) {
        float dx = x - ox, dy = y - oy, dz = z - oz, l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        return new float[]{dx / l, dy / l, dz / l};
    }

    /** Deja pasar la cadencia (sin mover a nadie: con un entorno vacío para los soldados no cuenta). */
    static void esperar(Juego j, float s, Ent e) { for (int i = 0; i < s * 30; i++) j.actualizar(1 / 30f, 0, 1.5f, 1.2f, 0, -1, e); }

    public static void main(String[] a) {
        Tsdf t = new Tsdf(0.07f);
        PruebaEscaneo.escanear(t, 60, true);
        Ent e = new Ent(t);
        final float JX = 0, JY = 1.5f, JZ = 1.2f;

        // 1) cada arma guarda sus balas; cambiar tarda un poco
        {
            Juego j = new Juego(1);
            j.empezar(Juego.PRACTICA);
            j.blancos.clear();
            j.disparar(JX, JY, JZ, 0, 0, -1, JX, JY, JZ, e);
            ver(j.balas == 11, "la pistola gasta una bala (" + j.balas + ")");
            j.cambiarArma(Juego.FUSIL);
            ver(j.balas == 30 && j.cargador() == 30, "el fusil tiene su cargador de 30");
            ver(!j.puedeDisparar(), "recién cambiada, el arma tarda en estar lista");
            j.cambiarArma(Juego.PISTOLA);
            ver(j.balas == 11, "al volver a la pistola sigue con 11");
        }

        // 2) el fusil: automático, 30 balas, recarga de 2 s
        {
            Juego j = new Juego(2);
            j.empezar(Juego.PRACTICA);
            j.cambiarArma(Juego.FUSIL);
            esperar(j, 1, e);
            int tiros = 0;
            for (int i = 0; i < 90; i++) {   // 3 s con el gatillo apretado
                j.actualizar(1 / 30f, JX, JY, JZ, 0, -1, e);
                j.blancos.clear();
                int antes = j.balas;
                j.disparar(JX, JY, JZ, 0, 0.2f, -1, JX, JY, JZ, e);
                if (j.balas < antes) tiros++;
            }
            ver(tiros >= 30 && tiros <= 34, "el fusil, 3 s apretado: vacía el cargador y recarga (" + tiros + " tiros)");
            ver(Juego.ARMAS[Juego.FUSIL].automatica && !Juego.ARMAS[Juego.PISTOLA].automatica, "el fusil es automático, la pistola no");
        }

        // 3) la escopeta: 9 perdigones que abren; a 3 m voltea, a 12 m casi no
        {
            Juego j = new Juego(3);
            j.empezar(Juego.OLEADAS);
            j.soldados.clear();
            j.cambiarArma(Juego.ESCOPETA);
            esperar(j, 1, e);
            j.soldados.clear();
            Juego.Soldado s = soldado(j, -0.6f, -1.5f, Juego.NORMAL);
            float[] d = hacia(JX, JY, JZ, s.x, 1.1f, s.z);
            int trazosAntes = j.trazos.size();
            j.disparar(JX, JY, JZ, d[0], d[1], d[2], JX, JY, JZ, e);
            ver(s.estado == Juego.CAE, "la escopeta de cerca lo voltea");
            ver(j.trazos.size() - trazosAntes >= 5, "se ven varios perdigones (" + (j.trazos.size() - trazosAntes) + ")");
            // dispersión: a 10 m, de 200 tiros sólo algunos perdigones pegan en un blanco de 40 cm
            int pegan = 0, total = 0;
            java.util.Random r = new java.util.Random(1);
            for (int k = 0; k < 200; k++) {
                Juego q = new Juego(k);
                q.empezar(Juego.PRACTICA);
                q.blancos.clear();
                q.cambiarArma(Juego.ESCOPETA);
                esperar(q, 0.5f, e);
                q.blancos.clear();
                Juego.Blanco b = new Juego.Blanco();
                b.x = 0; b.y = 1.5f; b.z = JZ - 10; b.nx = 0; b.ny = 0; b.nz = 1; b.radio = 0.2f;
                q.blancos.add(b);
                q.disparar(JX, JY, JZ, 0, 0, -1, JX, JY, JZ, new Juego.Entorno() {   // al aire: sin paredes
                    public float suelo(float x, float z, float y0, float y1) { return Float.NaN; }
                    public float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float m) { return -1; }
                    public boolean ocupado(float x, float y, float z) { return false; }
                });
                total++;
                if (b.golpe >= 0) pegan++;
            }
            ver(pegan > 40 && pegan < 200, "a 10 m la escopeta abre: pega en el blanco " + pegan + " de 200 veces (la pistola, siempre)");
        }

        // 4) el pesado aguanta 4 tiros de pistola en el cuerpo, 2 en la cabeza (casco)
        {
            Juego j = new Juego(4);
            j.empezar(Juego.OLEADAS);
            j.soldados.clear();
            Juego.Soldado p = soldado(j, 0.3f, -1.0f, Juego.PESADO);
            int n = 0;
            while (Juego.enPie(p) && n < 10) {
                esperar(j, 0.2f, e);
                j.soldados.clear(); j.soldados.add(p);
                float[] d = hacia(JX, JY, JZ, p.x, 1.0f, p.z);
                j.disparar(JX, JY, JZ, d[0], d[1], d[2], JX, JY, JZ, e);
                n++;
            }
            ver(n == 4, "el pesado cae con 4 tiros al cuerpo (" + n + ")");
            Juego k = new Juego(5);
            k.empezar(Juego.OLEADAS);
            k.soldados.clear();
            Juego.Soldado c = soldado(k, 0.3f, -1.0f, Juego.PESADO);
            int m = 0;
            while (Juego.enPie(c) && m < 10) {
                esperar(k, 0.2f, e);
                k.soldados.clear(); k.soldados.add(c);
                float[] d = hacia(JX, JY, JZ, c.x, c.y + Juego.CABEZA_Y, c.z);
                k.disparar(JX, JY, JZ, d[0], d[1], d[2], JX, JY, JZ, e);
                m++;
            }
            ver(m == 2, "el pesado cae con 2 a la cabeza (" + m + ")");
            ver(k.cabezas == 2, "se cuentan los tiros a la cabeza (" + k.cabezas + ")");
        }

        // 5) la granada: rebota en el piso REAL, explota, voltea a los de cerca, la pared protege
        {
            Juego j = new Juego(6);
            j.empezar(Juego.OLEADAS);
            j.soldados.clear();
            j.pisoRespaldo = 0;
            j.cambiarArma(Juego.LANZAGRANADAS);
            esperar(j, 1, e);
            j.soldados.clear();
            Juego.Soldado cerca = soldado(j, -0.5f, -2.9f, Juego.NORMAL);
            Juego.Soldado lejos = soldado(j, 2.8f, -3.2f, Juego.NORMAL);
            float[] d = hacia(JX, JY, JZ, -0.5f, 0.5f, -2.6f);
            j.disparar(JX, JY, JZ, d[0], d[1], d[2], JX + 0.1f, JY - 0.1f, JZ - 0.3f, e);
            ver(j.granadas.size() == 1, "sale una granada");
            float minBajoPiso = 0;
            int rebotes = 0, eventos = 0;
            float yAnt = 99;
            boolean exploto = false;
            for (int i = 0; i < 120 && !exploto; i++) {
                if (!j.granadas.isEmpty()) {
                    Juego.Granada g = j.granadas.get(0);
                    float piso = t.suelo(g.x, g.z, g.y + 0.5f, g.y - 2f);
                    if (piso == piso) minBajoPiso = Math.min(minBajoPiso, g.y - piso);
                    yAnt = g.y;
                }
                j.actualizar(1 / 30f, JX, JY, JZ, 0, -1, e);
                j.soldados.remove(j.soldados.size() > 2 ? j.soldados.get(2) : null);
                int ev = j.tomarEventos();
                if ((ev & Juego.EV_EXPLOSION) != 0) exploto = true;
            }
            ver(exploto, "la granada explota");
            ver(minBajoPiso > -0.08f, String.format("nunca atraviesa el piso real (lo más abajo: %.3f m)", minBajoPiso));
            ver(!Juego.enPie(cerca), "voltea al que estaba cerca");
            ver(Juego.enPie(lejos), "no le hace nada al que estaba lejos");
            // detrás de la mesa: la explosión del otro lado casi no lo lastima
            Juego k = new Juego(7);
            k.empezar(Juego.OLEADAS);
            k.soldados.clear();
            Juego.Soldado tapado = soldado(k, 1.0f, -2.9f, Juego.PESADO);    // detrás de la mesa (z −2.5 a −1.5)
            Juego.Soldado expuesto = soldado(k, 0.25f, -1.3f, Juego.PESADO); // a la vista
            k.explotar(1.0f, 0.25f, -1.2f, e);                                 // delante de la mesa
            ver(tapado.vida > expuesto.vida + 0.8f, String.format("la mesa real protege de la explosión (vida %.1f tapado vs %.1f expuesto)", tapado.vida, expuesto.vida));
        }

        // 6) práctica: los blancos se pegan a superficies reales, de cara al jugador
        {
            Juego j = new Juego(8);
            j.empezar(Juego.PRACTICA);
            j.actualizar(1 / 30f, JX, JY, JZ, 0, -1, e);
            j.blancos.clear();
            int bien = 0, total = 0, deFrente = 0;
            for (int k = 0; k < 60; k++) {
                if (j.ponerBlanco(e)) {
                    Juego.Blanco b = j.blancos.get(j.blancos.size() - 1);
                    total++;
                    if (Math.abs(PruebaEscaneo.escena(b.x, b.y, b.z)) < 0.06f) bien++;
                    float vx = JX - b.x, vy = JY - b.y, vz = JZ - b.z, vl = (float) Math.sqrt(vx * vx + vy * vy + vz * vz);
                    if ((vx * b.nx + vy * b.ny + vz * b.nz) / vl > 0.3f) deFrente++;
                }
            }
            ver(total >= 50, "encuentra lugar para blancos (" + total + " de 60)");
            ver(bien >= total * 0.9, "pegados a la superficie real (" + bien + " de " + total + " a menos de 6 cm)");
            ver(deFrente == total, "todos de cara al jugador (" + deFrente + " de " + total + ")");
            // tirarle a uno
            Juego q = new Juego(9);
            q.empezar(Juego.PRACTICA);
            q.blancos.clear();
            q.ponerBlanco(e);
            Juego.Blanco b = q.blancos.get(0);
            float[] d = hacia(JX, JY, JZ, b.x, b.y, b.z);
            int antes = q.puntos;
            Juego.Impacto im = q.disparar(JX, JY, JZ, d[0], d[1], d[2], JX, JY, JZ, e);
            ver(im.tipo == Juego.Impacto.BLANCO && q.puntos > antes && b.golpe >= 0, "tirarle al centro del blanco suma (" + (q.puntos - antes) + " puntos)");
            ver(q.precision() == 1f, "precisión 100 % con un tiro y un acierto");
        }

        // 7) contrarreloj: 90 s y termina solo
        {
            Juego j = new Juego(10);
            j.pisoRespaldo = 0;
            j.empezar(Juego.CONTRARRELOJ);
            int fin = 0, maxVivos = 0;
            for (int i = 0; i < 30 * 95; i++) {
                j.actualizar(1 / 30f, JX, JY, JZ, 0, -1, e);
                j.vidaJugador = 100;
                if ((j.tomarEventos() & Juego.EV_FIN) != 0) fin++;
                maxVivos = Math.max(maxVivos, j.vivos());
            }
            ver(j.estado == Juego.FIN && fin == 1, "el contrarreloj termina solo a los 90 s");
            ver(maxVivos >= 4, "en contrarreloj siempre hay enemigos (hasta " + maxVivos + " a la vez)");
        }

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }
}
