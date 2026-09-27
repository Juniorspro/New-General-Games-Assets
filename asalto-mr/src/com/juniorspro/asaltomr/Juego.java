package com.juniorspro.asaltomr;

import java.util.ArrayList;
import java.util.Random;

/**
 * El juego, sin nada de Android ni de OpenGL: soldados que aparecen sobre el
 * suelo escaneado, corren esquivando lo que hay (árboles, paredes, muebles:
 * todo lo que tiene la malla), se paran a tirarte, y cuando les pegás salen
 * volando para atrás y caen sobre el piso de verdad. Los tiros que no pegan en
 * un soldado pegan en la superficie real, con chispas y polvo.
 *
 * Con el mapa de zonas (Mapa.Grilla) la IA es táctica: aparecen en lugares
 * alcanzables, van por rutas (A*) que rodean árboles, mesas y agua, buscan
 * CUBIERTA (algo alto entre ellos y vos), se agachan detrás, se asoman a
 * tirar y vuelven a cubrirse o flanquean. Sin mapa, corren derecho esquivando.
 *
 * Coordenadas del mundo de ARCore: metros, +Y arriba. El soldado mira hacia
 * su +Z local: adelante = (sen yaw, 0, cos yaw).
 *
 * Se prueba en la PC contra una escena escaneada (pruebas/PruebaJuego.java).
 */
public final class Juego {

    /** Lo que el juego necesita saber del entorno real (lo da el escaneo). */
    public interface Entorno {
        /** Altura del suelo bajo (x, z) buscando entre yArriba y yAbajo, o NaN. */
        float suelo(float x, float z, float yArriba, float yAbajo);

        /** Distancia a la primera superficie real por el rayo (d unitario), o −1. */
        float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float max);

        /** ¿Hay algo sólido ahí? */
        boolean ocupado(float x, float y, float z);
    }

    // ── estados y eventos ──
    public static final int ESPERA = 0, JUEGA = 1, FIN = 2;
    public static final int CORRE = 0, APUNTA = 1, CAE = 2, TIRADO = 3, CUBIERTA = 4;
    static final int DIRECTO = 0, A_CUBIERTA = 1, ASOMARSE = 2, FLANCO = 3;
    public static final int EV_DISPARO = 1, EV_IMPACTO = 2, EV_CARNE = 4, EV_MUERTE = 8, EV_ENEMIGO_DISPARA = 16,
            EV_DANO = 32, EV_OLEADA = 64, EV_RECARGA = 128, EV_FIN = 256, EV_CABEZA = 512, EV_VACIO = 1024, EV_ZUMBIDO = 2048;
    public static final int P_CHISPA = 0, P_POLVO = 1, P_TROZO = 2, P_HUMO = 3, P_FOGONAZO = 4;

    public static final float ALTO = 1.75f, RADIO = 0.22f, CABEZA_Y = 1.62f, CABEZA_R = 0.13f;
    public static final int CARGADOR = 12;

    public static final class Soldado {
        public float x, y, z, yaw;
        public int estado = CORRE;
        public float fase;              // ciclo de la carrera (radianes)
        public float caida;             // giro sobre su X local al caer (negativo = de espaldas)
        public float fogonazo;          // > 0: se ve el fogonazo del arma
        public float desvanecer;        // 0..1 al final
        public float apunta;            // 0..1 cuánto levanta el arma
        public float agachado;          // 0..1 (detrás de una cubierta)
        public float[] ruta;            // puntos (x, y, z) por donde va (del mapa), o null
        public int rutaI, tactica, celdaCubierta = -1;
        public int id;
        float vx, vy, vz, vCaida, t, proxTiro, objX, objZ, tiempoCorriendo, trabado, espera, cubX, cubY, cubZ;
        int tirosQuedan;
    }

    public static final class Particula {
        public float x, y, z, vx, vy, vz, vida, vidaMax, tam;
        public int tipo;
        float piso;
    }

    public static final class Trazo {
        public float x0, y0, z0, x1, y1, z1, vida;
        public boolean enemigo;
    }

    public static final class Impacto {
        public static final int NADA = 0, ENTORNO = 1, SOLDADO = 2, CABEZA = 3;
        public int tipo;
        public float x, y, z, distancia;
        public Soldado soldado;
    }

    // ── estado ──
    public final ArrayList<Soldado> soldados = new ArrayList<>();
    public final ArrayList<Particula> particulas = new ArrayList<>();
    public final ArrayList<Trazo> trazos = new ArrayList<>();
    public int estado = ESPERA;
    public int puntos, combo = 1, oleada, bajas, balas = CARGADOR, dificultad = 1;
    public float vidaJugador = 100, golpe, retroceso, recargando;
    /** El mapa de zonas de la IA (lo arma el escaneo), o null. */
    public volatile Mapa.Grilla grilla;
    /** Piso de respaldo (plano de ARCore o altura estimada), NaN si no hay. */
    public float pisoRespaldo = Float.NaN;
    private int eventos, porSalir, siguienteId;
    private float proxAparicion, pausaOleada, sinBaja, sinDano, cadencia;
    private final Random azar;
    private float jx, jy, jz, jfx = 0, jfz = -1;   // jugador: posición y adelante (horizontal)

    public Juego(long semilla) { azar = new Random(semilla); }

    /** Los eventos desde la última llamada (para los sonidos). */
    public int tomarEventos() { int e = eventos; eventos = 0; return e; }

    public void empezar() {
        soldados.clear(); particulas.clear(); trazos.clear();
        puntos = 0; combo = 1; bajas = 0; balas = CARGADOR; recargando = 0;
        vidaJugador = 100; golpe = 0; oleada = 0; estado = JUEGA;
        nuevaOleada();
    }

    private void nuevaOleada() {
        oleada++;
        porSalir = Math.min(16, 2 + 2 * oleada);
        proxAparicion = 1.5f;
        eventos |= EV_OLEADA;
    }

    public int vivos() {
        int n = 0;
        for (Soldado s : soldados) if (enPie(s)) n++;
        return n;
    }

    /** ¿Vivo y en pie (corriendo, apuntando o cubierto)? */
    public static boolean enPie(Soldado s) { return s.estado == CORRE || s.estado == APUNTA || s.estado == CUBIERTA; }

    /** Cuánto baja la cabeza agachado. */
    public static final float BAJA_AGACHADO = 0.55f;

    private float velocidad() { return dificultad == 0 ? 1.5f : dificultad == 2 ? 2.8f : 2.1f; }

    // ── cada cuadro ──

    /**
     * @param cx,cy,cz posición de la cámara (el jugador)
     * @param fx,fz    hacia dónde mira, en el plano (no hace falta normalizar)
     */
    public void actualizar(float dt, float cx, float cy, float cz, float fx, float fz, Entorno e) {
        jx = cx; jy = cy; jz = cz;
        float fl = (float) Math.sqrt(fx * fx + fz * fz);
        if (fl > 1e-3f) { jfx = fx / fl; jfz = fz / fl; }
        golpe = Math.max(0, golpe - dt * 1.5f);
        retroceso = Math.max(0, retroceso - dt * 7f);
        cadencia = Math.max(0, cadencia - dt);
        if (recargando > 0) {
            recargando -= dt;
            if (recargando <= 0) { recargando = 0; balas = CARGADOR; }
        }

        if (estado == JUEGA) {
            sinBaja += dt;
            // como en los shooters: si aguantás 4 s sin que te den, te vas curando
            sinDano += dt;
            if (sinDano > 4f && vidaJugador > 0) vidaJugador = Math.min(100, vidaJugador + dt * 5f);
            if (sinBaja > 4f) combo = 1;
            int maxVivos = Math.min(7, 2 + oleada);
            if (porSalir > 0) {
                proxAparicion -= dt;
                if (proxAparicion <= 0 && vivos() < maxVivos) {
                    if (aparecer(e)) { porSalir--; proxAparicion = 0.8f + azar.nextFloat() * 1.4f; }
                    else proxAparicion = 0.3f;   // no hubo lugar: probar en un rato
                }
            } else if (vivos() == 0) {
                pausaOleada += dt;
                if (pausaOleada > 3.5f) { pausaOleada = 0; nuevaOleada(); }
            }
        }

        for (int i = soldados.size() - 1; i >= 0; i--) {
            Soldado s = soldados.get(i);
            s.fogonazo = Math.max(0, s.fogonazo - dt);
            float quiereAgachado = s.estado == CUBIERTA ? 1 : 0;
            s.agachado += (quiereAgachado - s.agachado) * Math.min(1f, dt * 7f);
            switch (s.estado) {
                case CORRE: correr(s, dt, e); break;
                case APUNTA: apuntar(s, dt, e); break;
                case CUBIERTA: cubrirse(s, dt, e); break;
                case CAE: caer(s, dt, e); break;
                default:
                    s.t += dt;
                    if (s.t > 2.5f) s.desvanecer = Math.min(1, (s.t - 2.5f) / 1.2f);
                    if (s.desvanecer >= 1) soldados.remove(i);
            }
        }

        for (int i = particulas.size() - 1; i >= 0; i--) {
            Particula p = particulas.get(i);
            p.vida -= dt;
            if (p.vida <= 0) { particulas.remove(i); continue; }
            float g = p.tipo == P_HUMO || p.tipo == P_POLVO ? -0.6f : p.tipo == P_FOGONAZO ? 0 : 9.8f;
            p.vy -= g * dt;
            if (p.tipo == P_HUMO || p.tipo == P_POLVO) { p.vx *= 1 - dt * 2; p.vz *= 1 - dt * 2; p.vy *= 1 - dt; p.tam += dt * 0.25f; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.y < p.piso && p.vy < 0) {        // rebota en el piso real
                p.y = p.piso;
                p.vy *= -0.3f; p.vx *= 0.6f; p.vz *= 0.6f;
            }
        }

        for (int i = trazos.size() - 1; i >= 0; i--) {
            Trazo t = trazos.get(i);
            t.vida -= dt;
            if (t.vida <= 0) trazos.remove(i);
        }

        if (estado == JUEGA && vidaJugador <= 0) {
            vidaJugador = 0;
            estado = FIN;
            eventos |= EV_FIN;
        }
    }

    /**
     * Busca un lugar sobre el suelo, adelante del jugador, sin nada sólido y
     * a la vista (que no aparezca detrás de una pared). Primero lejos (5–9 m,
     * afuera); si no hay lugar, más cerca (2.5–5 m, adentro de una casa).
     */
    private boolean aparecer(Entorno e) {
        Mapa.Grilla g = grilla;
        for (int intento = 0; intento < 16; intento++) {
            float x, z, y;
            float[] lugar = g == null ? null : g.lugarParaAparecer(azar, jx, jz, jfx, jfz, intento < 8 ? 5f : 2.5f, intento < 8 ? 9f : 5f);
            if (lugar != null) {
                // el mapa sabe qué es piso alcanzable
                x = lugar[0]; y = lugar[1]; z = lugar[2];
            } else {
                float ang = (azar.nextFloat() - 0.5f) * 2f * 1.4f;   // ±80° de adonde mirás
                float dist = intento < 8 ? 5f + azar.nextFloat() * 4f : 2.5f + azar.nextFloat() * 2.5f;
                float c = (float) Math.cos(ang), sn = (float) Math.sin(ang);
                float dx = jfx * c - jfz * sn, dz = jfx * sn + jfz * c;
                x = jx + dx * dist; z = jz + dz * dist;
                y = e.suelo(x, z, jy + 0.3f, jy - 3.5f);
                if (y != y) {
                    if (pisoRespaldo != pisoRespaldo) continue;
                    y = pisoRespaldo;
                }
            }
            if (jy - y < 0.6f) continue;                          // eso no es el piso: está a la altura de la cara
            if (e.ocupado(x, y + 0.9f, z) || e.ocupado(x, y + 1.5f, z)) continue;
            float vx = x - jx, vy = y + 1.2f - jy, vz = z - jz;
            float vl = (float) Math.sqrt(vx * vx + vy * vy + vz * vz);
            float tapa = e.rayo(jx, jy, jz, vx / vl, vy / vl, vz / vl, vl);
            if (tapa > 0 && tapa < vl - 0.3f) continue;          // hay algo en el medio
            Soldado s = new Soldado();
            s.id = siguienteId++;
            s.x = x; s.y = y; s.z = z;
            s.yaw = (float) Math.atan2(jx - x, jz - z);
            s.fase = azar.nextFloat() * 6.28f;
            elegirObjetivo(s);
            soldados.add(s);
            return true;
        }
        return false;
    }

    /**
     * A dónde va. Con mapa: casi siempre a una cubierta libre (por una ruta),
     * si no, a flanquear por el costado. Sin mapa: un punto a 2.5–5 m del
     * jugador, corrido de costado.
     */
    private void elegirObjetivo(Soldado s) {
        s.tiempoCorriendo = 0;
        s.ruta = null;
        s.rutaI = 0;
        s.celdaCubierta = -1;
        s.tactica = DIRECTO;
        Mapa.Grilla g = grilla;
        if (g != null) {
            float gusta = dificultad == 0 ? 0.45f : dificultad == 2 ? 0.85f : 0.7f;
            if (azar.nextFloat() < gusta) {
                boolean[] tomadas = new boolean[g.n * g.n];
                for (Soldado o : soldados) if (o != s && o.celdaCubierta >= 0 && o.celdaCubierta < tomadas.length) tomadas[o.celdaCubierta] = true;
                int c = g.mejorCubierta(s.x, s.z, jx, jz, tomadas);
                if (c >= 0) {
                    float cx = g.x(c % g.n), cz = g.z(c / g.n);
                    float[] r = g.camino(s.x, s.z, cx, cz);
                    if (r != null) {
                        s.ruta = r; s.tactica = A_CUBIERTA; s.celdaCubierta = c;
                        s.cubX = cx; s.cubY = g.piso[c]; s.cubZ = cz;
                        return;
                    }
                }
            }
            // flanquear: un lugar alcanzable a 2.5–5 m del jugador, del lado donde ya está el soldado
            float[] p = g.lugarParaAparecer(azar, jx, jz, s.x - jx, s.z - jz, 2.5f, 5f);
            if (p != null) {
                float[] r = g.camino(s.x, s.z, p[0], p[2]);
                if (r != null) { s.ruta = r; s.tactica = FLANCO; return; }
            }
        }
        float ax = s.x - jx, az = s.z - jz;
        float l = (float) Math.max(0.01, Math.sqrt(ax * ax + az * az));
        ax /= l; az /= l;
        float ang = (azar.nextFloat() - 0.5f) * 1.6f;
        float r = 2.5f + azar.nextFloat() * 2.5f;
        float c = (float) Math.cos(ang), sn = (float) Math.sin(ang);
        s.objX = jx + (ax * c - az * sn) * r;
        s.objZ = jz + (ax * sn + az * c) * r;
    }

    /** Llegó al final de la ruta: según a qué iba. */
    private void llego(Soldado s) {
        s.ruta = null;
        if (s.tactica == A_CUBIERTA) {
            s.estado = CUBIERTA;
            s.espera = 0.8f + azar.nextFloat() * (dificultad == 2 ? 1f : 1.8f);
        } else pasarAApuntar(s);
    }

    /**
     * Detrás de la cubierta, agachado: espera y después se asoma (a un lugar
     * al lado desde donde te ve) o, si no hay, se para y tira por encima.
     */
    private void cubrirse(Soldado s, float dt, Entorno e) {
        s.apunta = Math.max(0, s.apunta - dt * 3);
        s.fase *= 1 - Math.min(1, dt * 6);
        s.yaw = girarHacia(s.yaw, (float) Math.atan2(jx - s.x, jz - s.z), dt * 6f);
        s.espera -= dt;
        if (s.espera > 0) return;
        Mapa.Grilla g = grilla;
        if (g != null) {
            int c = g.indice(s.x, s.z);
            float mejor = Float.MAX_VALUE;
            float[] asomo = null;
            if (c >= 0) {
                int ci = c % g.n, ck = c / g.n;
                for (int dk = -2; dk <= 2; dk++) for (int di = -2; di <= 2; di++) {
                    int ni = ci + di, nk = ck + dk;
                    if ((di == 0 && dk == 0) || ni < 0 || nk < 0 || ni >= g.n || nk >= g.n) continue;
                    int v = nk * g.n + ni;
                    if (!g.alcanzable[v]) continue;
                    float x = g.x(ni), z = g.z(nk), y = g.piso[v] + 1.4f;
                    if (!g.rectaLibre(s.x, s.z, x, z)) continue;
                    float ax = jx - x, ay = jy - y, az = jz - z, l = (float) Math.sqrt(ax * ax + ay * ay + az * az);
                    if (e.rayo(x, y, z, ax / l, ay / l, az / l, l - 0.3f) > 0) continue;   // desde ahí tampoco te ve
                    float d = di * di + dk * dk;
                    if (d < mejor) { mejor = d; asomo = new float[]{x, g.piso[v], z}; }
                }
            }
            if (asomo != null) {
                s.estado = CORRE;
                s.tactica = ASOMARSE;
                s.ruta = asomo;
                s.rutaI = 0;
                s.tiempoCorriendo = 0;
                return;
            }
        }
        pasarAApuntar(s);   // se para y tira por encima (una mesa tapa agachado, no parado)
    }

    private void correr(Soldado s, float dt, Entorno e) {
        s.apunta = Math.max(0, s.apunta - dt * 3);
        s.tiempoCorriendo += dt;
        float dx, dz, d;
        if (s.ruta != null) {
            // por la ruta del mapa, punto por punto
            while (true) {
                dx = s.ruta[s.rutaI * 3] - s.x; dz = s.ruta[s.rutaI * 3 + 2] - s.z;
                d = (float) Math.sqrt(dx * dx + dz * dz);
                if (d > 0.25f) break;
                s.rutaI++;
                if (s.rutaI * 3 >= s.ruta.length) { llego(s); return; }
            }
            if (s.tiempoCorriendo > 12f) { elegirObjetivo(s); return; }
        } else {
            dx = s.objX - s.x; dz = s.objZ - s.z;
            d = (float) Math.sqrt(dx * dx + dz * dz);
            if (d < 0.35f || s.tiempoCorriendo > 3.5f + (s.id % 3)) { pasarAApuntar(s); return; }
        }
        float quiere = (float) Math.atan2(dx, dz);
        // esquivar: probar derecho, después abriéndose de a 40°
        float v = velocidad();
        float paso = v * dt;
        float[] prueba = {0, 0.7f, -0.7f, 1.4f, -1.4f, 2.1f, -2.1f};
        for (float off : prueba) {
            float yaw = quiere + off;
            float sx = (float) Math.sin(yaw), sz = (float) Math.cos(yaw);
            float mx = s.x + sx * 0.45f, mz = s.z + sz * 0.45f;   // medio metro adelante
            if (e.ocupado(mx, s.y + 0.9f, mz) || e.ocupado(mx, s.y + 1.4f, mz)) continue;
            float nx = s.x + sx * paso, nz = s.z + sz * paso;
            float ny = e.suelo(nx, nz, s.y + 0.5f, s.y - 1.2f);
            if (ny != ny) ny = pisoRespaldo == pisoRespaldo && Math.abs(pisoRespaldo - s.y) < 0.5f ? pisoRespaldo : s.y;
            if (ny - s.y > 0.4f) continue;                          // un escalón muy alto: es una pared o una mesa
            s.x = nx; s.z = nz;
            s.y += (ny - s.y) * Math.min(1f, dt * 12f);
            s.yaw = girarHacia(s.yaw, yaw, dt * 8f);
            s.fase += paso * 4.2f;
            s.trabado = 0;
            return;
        }
        // encerrado: que se pare y tire, y después busque otro lado
        s.trabado += dt;
        if (s.trabado > 0.4f) { s.trabado = 0; if (s.ruta != null) elegirObjetivo(s); else pasarAApuntar(s); }
    }

    private void pasarAApuntar(Soldado s) {
        s.estado = APUNTA;
        s.t = 0;
        s.tirosQuedan = 1 + azar.nextInt(dificultad == 2 ? 4 : 3);
        s.proxTiro = (dificultad == 0 ? 1.3f : dificultad == 2 ? 0.6f : 0.9f) + azar.nextFloat() * 0.4f;
    }

    private void apuntar(Soldado s, float dt, Entorno e) {
        s.t += dt;
        s.apunta = Math.min(1, s.apunta + dt * 4);
        s.yaw = girarHacia(s.yaw, (float) Math.atan2(jx - s.x, jz - s.z), dt * 10f);
        s.fase *= 1 - Math.min(1, dt * 6);   // se queda quieto
        if (s.t < s.proxTiro) return;
        // ¿te ve? (el rayo del arma al jugador no puede cruzar la malla)
        float mx = s.x + (float) Math.sin(s.yaw) * 0.5f, my = s.y + 1.4f, mz = s.z + (float) Math.cos(s.yaw) * 0.5f;
        float ax = jx - mx, ay = jy - my, az = jz - mz;
        float dist = (float) Math.sqrt(ax * ax + ay * ay + az * az);
        ax /= dist; ay /= dist; az /= dist;
        float choca = e.rayo(mx, my, mz, ax, ay, az, dist - 0.3f);
        if (choca > 0) { volverOIrse(s); return; }   // tapado: moverse
        s.fogonazo = 0.07f;
        eventos |= EV_ENEMIGO_DISPARA;
        // la bala: pega o pasa zumbando cerca
        float base = dificultad == 0 ? 0.10f : dificultad == 2 ? 0.30f : 0.16f;
        float prob = base * Math.min(1f, 4f / Math.max(1f, dist));
        boolean pega = azar.nextFloat() < prob;
        Trazo t = new Trazo();
        t.x0 = mx; t.y0 = my; t.z0 = mz;
        float err = pega ? 0.05f : 0.5f + azar.nextFloat() * 0.6f;
        t.x1 = jx + (azar.nextFloat() - 0.5f) * err * 2; t.y1 = jy - 0.1f + (azar.nextFloat() - 0.5f) * err; t.z1 = jz + (azar.nextFloat() - 0.5f) * err * 2;
        t.vida = 0.09f; t.enemigo = true;
        trazos.add(t);
        if (pega) {
            vidaJugador -= dificultad == 0 ? 5 : dificultad == 2 ? 12 : 7;
            golpe = 1;
            sinDano = 0;
            eventos |= EV_DANO;
        } else eventos |= EV_ZUMBIDO;
        s.tirosQuedan--;
        s.t = 0;
        s.proxTiro = 0.3f + azar.nextFloat() * 0.3f;
        if (s.tirosQuedan <= 0) volverOIrse(s);
    }

    /** Después de tirar: si tenía cubierta cerca, vuelve a ella; si no, busca otra cosa. */
    private void volverOIrse(Soldado s) {
        s.estado = CORRE;
        Mapa.Grilla g = grilla;
        if (g != null && s.celdaCubierta >= 0 && Math.hypot(s.cubX - s.x, s.cubZ - s.z) < 1.2f && azar.nextFloat() < 0.7f
                && g.indice(s.cubX, s.cubZ) == s.celdaCubierta && g.cubierta[s.celdaCubierta]) {
            s.ruta = new float[]{s.cubX, s.cubY, s.cubZ};
            s.rutaI = 0;
            s.tactica = A_CUBIERTA;
            s.tiempoCorriendo = 0;
            return;
        }
        elegirObjetivo(s);
    }

    private void caer(Soldado s, float dt, Entorno e) {
        s.t += dt;
        s.vy -= 9.8f * dt;
        float nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
        // no atravesar la malla: si adelante hay algo sólido, rebota
        if (e.ocupado(nx, s.y + 0.5f, nz)) { s.vx *= -0.3f; s.vz *= -0.3f; nx = s.x; nz = s.z; }
        s.x = nx; s.z = nz;
        s.y += s.vy * dt;
        s.caida += s.vCaida * dt;
        if (s.caida < -1.62f) { s.caida = -1.62f; s.vCaida = 0; }   // de espaldas, apenas pasado 90°
        float piso = e.suelo(s.x, s.z, s.y + 0.8f, s.y - 1.5f);
        if (piso != piso) piso = pisoRespaldo == pisoRespaldo ? pisoRespaldo : s.y - 10;
        if (s.y <= piso && s.vy < 0) {
            s.y = piso;
            s.vy *= -0.2f;
            s.vx *= 0.45f; s.vz *= 0.45f;
            if (Math.abs(s.vy) < 0.4f && s.caida <= -1.5f) {
                s.vy = 0; s.vx = 0; s.vz = 0;
                s.estado = TIRADO;
                s.t = 0;
            }
        }
        if (s.t > 4f) { s.estado = TIRADO; s.t = 0; s.y = Math.max(s.y, piso); }
    }

    private static float girarHacia(float a, float b, float max) {
        float d = b - a;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        return a + Math.max(-max, Math.min(max, d));
    }

    // ── el tiro del jugador ──

    public boolean puedeDisparar() { return estado != FIN && cadencia <= 0 && recargando <= 0; }

    /**
     * Un tiro desde (ox,oy,oz) hacia d (unitario). Pega en el soldado más
     * cercano o en la superficie real, lo que venga primero.
     * @param bx,by,bz de dónde sale la bala que se ve (la boca del arma)
     */
    public Impacto disparar(float ox, float oy, float oz, float dx, float dy, float dz,
                            float bx, float by, float bz, Entorno e) {
        Impacto imp = new Impacto();
        if (!puedeDisparar()) return imp;
        if (balas <= 0) { recargar(); eventos |= EV_VACIO; return imp; }
        balas--;
        cadencia = 0.14f;
        retroceso = 1;
        eventos |= EV_DISPARO;
        float maxD = 40f;
        float tEnt = e.rayo(ox, oy, oz, dx, dy, dz, maxD);
        float mejor = tEnt > 0 ? tEnt : maxD;
        Soldado quien = null;
        boolean cabeza = false;
        for (Soldado s : soldados) {
            if (s.desvanecer > 0) continue;
            if (enPie(s)) {
                float baja = s.agachado * BAJA_AGACHADO;
                float th = esfera(ox, oy, oz, dx, dy, dz, s.x, s.y + CABEZA_Y - baja, s.z, CABEZA_R + 0.03f);
                if (th > 0 && th < mejor) { mejor = th; quien = s; cabeza = true; }
                float tc = cilindro(ox, oy, oz, dx, dy, dz, s.x, s.z, RADIO + 0.04f, s.y + 0.1f, s.y + 1.5f - baja);
                if (tc > 0 && tc < mejor) { mejor = tc; quien = s; cabeza = false; }
            } else {
                // el cuerpo que cae o está tirado también recibe
                float[] c = centroCuerpo(s);
                float tb = esfera(ox, oy, oz, dx, dy, dz, c[0], c[1], c[2], 0.35f);
                if (tb > 0 && tb < mejor) { mejor = tb; quien = s; cabeza = false; }
            }
        }
        imp.distancia = mejor;
        imp.x = ox + dx * mejor; imp.y = oy + dy * mejor; imp.z = oz + dz * mejor;
        Trazo t = new Trazo();
        t.x0 = bx; t.y0 = by; t.z0 = bz; t.x1 = imp.x; t.y1 = imp.y; t.z1 = imp.z;
        t.vida = 0.06f;
        trazos.add(t);
        fogonazoJugador(bx, by, bz);
        if (quien != null) {
            imp.tipo = cabeza ? Impacto.CABEZA : Impacto.SOLDADO;
            imp.soldado = quien;
            pegarleA(quien, dx, dz, cabeza, imp);
        } else if (tEnt > 0) {
            imp.tipo = Impacto.ENTORNO;
            eventos |= EV_IMPACTO;
            chispas(imp.x, imp.y, imp.z, -dx, -dy, -dz);
        }
        if (balas == 0) recargar();
        return imp;
    }

    public void recargar() {
        if (recargando > 0 || balas == CARGADOR) return;
        recargando = 1.3f;
        eventos |= EV_RECARGA;
    }

    private void pegarleA(Soldado s, float dx, float dz, boolean cabeza, Impacto imp) {
        eventos |= EV_CARNE;
        trozos(imp.x, imp.y, imp.z, dx, dz, cabeza ? 14 : 9, s.y);
        float h = (float) Math.sqrt(dx * dx + dz * dz);
        float hx = h > 1e-4f ? dx / h : 0, hz = h > 1e-4f ? dz / h : 0;
        if (enPie(s)) {
            // de un tiro: sale volando para atrás, como en el video
            s.estado = CAE;
            s.t = 0;
            s.yaw = (float) Math.atan2(-hx, -hz);          // de cara al tiro
            float fuerza = cabeza ? 5.5f : 4.2f;
            s.vx = hx * fuerza + (azar.nextFloat() - 0.5f) * 0.8f;
            s.vz = hz * fuerza + (azar.nextFloat() - 0.5f) * 0.8f;
            s.vy = 2.4f + azar.nextFloat() * 0.8f;
            s.vCaida = -(4.5f + azar.nextFloat() * 2f);
            s.apunta = 0;
            bajas++;
            sinBaja = 0;
            puntos += 100 * combo + (cabeza ? 50 : 0);
            combo = Math.min(5, combo + 1);
            eventos |= EV_MUERTE;
            if (cabeza) eventos |= EV_CABEZA;
        } else if (s.estado == CAE) {
            s.vx += hx * 1.5f; s.vz += hz * 1.5f; s.vy += 1.2f;
        }
    }

    /** Centro del torso de un cuerpo que cae (sigue el giro de la caída). */
    public static float[] centroCuerpo(Soldado s) {
        float ly = 0.9f * (float) Math.cos(s.caida), lz = 0.9f * (float) Math.sin(s.caida);
        float sy = (float) Math.sin(s.yaw), cy = (float) Math.cos(s.yaw);
        return new float[]{s.x + lz * sy, s.y + ly, s.z + lz * cy};
    }

    // ── partículas ──

    private Particula particula(int tipo, float x, float y, float z, float vida, float tam, float piso) {
        if (particulas.size() > 500) particulas.remove(0);
        Particula p = new Particula();
        p.tipo = tipo; p.x = x; p.y = y; p.z = z; p.vida = p.vidaMax = vida; p.tam = tam; p.piso = piso;
        particulas.add(p);
        return p;
    }

    private void chispas(float x, float y, float z, float nx, float ny, float nz) {
        for (int i = 0; i < 8; i++) {
            Particula p = particula(P_CHISPA, x, y, z, 0.25f + azar.nextFloat() * 0.25f, 0.018f, y - 2f);
            p.vx = nx * 3 + (azar.nextFloat() - 0.5f) * 5; p.vy = ny * 3 + azar.nextFloat() * 3; p.vz = nz * 3 + (azar.nextFloat() - 0.5f) * 5;
        }
        for (int i = 0; i < 6; i++) {
            Particula p = particula(P_POLVO, x, y, z, 0.8f + azar.nextFloat() * 0.8f, 0.06f + azar.nextFloat() * 0.06f, y - 2f);
            p.vx = nx * 0.8f + (azar.nextFloat() - 0.5f); p.vy = ny * 0.8f + azar.nextFloat() * 0.6f; p.vz = nz * 0.8f + (azar.nextFloat() - 0.5f);
        }
        Particula h = particula(P_HUMO, x, y, z, 1.6f, 0.12f, y - 2f);
        h.vx = nx * 0.3f; h.vy = 0.3f; h.vz = nz * 0.3f;
    }

    private void trozos(float x, float y, float z, float dx, float dz, int n, float piso) {
        for (int i = 0; i < n; i++) {
            Particula p = particula(P_TROZO, x, y, z, 1.5f + azar.nextFloat(), 0.03f + azar.nextFloat() * 0.04f, piso);
            p.vx = dx * (1.5f + azar.nextFloat() * 2) + (azar.nextFloat() - 0.5f) * 2.5f;
            p.vy = azar.nextFloat() * 3f;
            p.vz = dz * (1.5f + azar.nextFloat() * 2) + (azar.nextFloat() - 0.5f) * 2.5f;
        }
    }

    private void fogonazoJugador(float x, float y, float z) {
        particula(P_FOGONAZO, x, y, z, 0.05f, 0.09f, y - 5f);
        Particula h = particula(P_HUMO, x, y, z, 0.7f, 0.04f, y - 5f);
        h.vy = 0.25f;
    }

    // ── geometría de los tiros ──

    static float esfera(float ox, float oy, float oz, float dx, float dy, float dz, float cx, float cy, float cz, float r) {
        float lx = cx - ox, ly = cy - oy, lz = cz - oz;
        float tc = lx * dx + ly * dy + lz * dz;
        if (tc < 0) return -1;
        float d2 = lx * lx + ly * ly + lz * lz - tc * tc;
        if (d2 > r * r) return -1;
        return tc - (float) Math.sqrt(r * r - d2);
    }

    /** Rayo contra un cilindro vertical de radio r en (cx, cz), entre y0 e y1. */
    static float cilindro(float ox, float oy, float oz, float dx, float dy, float dz, float cx, float cz, float r, float y0, float y1) {
        float px = ox - cx, pz = oz - cz;
        float a = dx * dx + dz * dz;
        if (a < 1e-8f) return -1;
        float b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - r * r;
        float disc = b * b - 4 * a * c;
        if (disc < 0) return -1;
        float t = (-b - (float) Math.sqrt(disc)) / (2 * a);
        if (t < 0) return -1;
        float y = oy + dy * t;
        return y >= y0 && y <= y1 ? t : -1;
    }
}
