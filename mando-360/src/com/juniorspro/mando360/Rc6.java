package com.juniorspro.mando360;

/**
 * RC6 modo 6A: el protocolo del control remoto multimedia de la Xbox 360.
 *
 * Genera el patrón de microsegundos (marca/espacio/marca/…) que se le pasa a
 * ConsumerIrManager.transmit. Es la traducción a Java de pruebas/rc6.mjs, que
 * está probado: codificar y decodificar cada botón da el mismo número.
 *
 * NO tiene nada que ver con la seguridad de los joysticks (XSM3). El receptor
 * infrarrojo de la 360 es un canal aparte, para menús y multimedia.
 */
public final class Rc6 {
    public static final int PORTADORA = 36000;   // 36 kHz
    static final int T = 444;                     // unidad RC6, en µs
    static final int BITS = 36;
    static final int IDX_TOGGLE = BITS - 1 - 16;  // el bit de máscara 0x8000
    public static final long TOGGLE = 0x8000L;

    /** Los 36 bits de cada botón (MSB primero), como en las bases de IR. */
    public static final long ENCENDER   = 0xc800f740cL;
    public static final long GUIA       = 0xc800f7464L;
    public static final long A          = 0xc800f7466L;
    public static final long B          = 0xc800ff425L;
    public static final long X          = 0xc800ff468L;
    public static final long Y          = 0xc800f7426L;
    public static final long ARRIBA     = 0xc800ff41eL;
    public static final long ABAJO      = 0xc800f741fL;
    public static final long IZQUIERDA  = 0xc800f7420L;
    public static final long DERECHA    = 0xc800ff421L;
    public static final long OK         = 0xc800ff422L;
    public static final long ATRAS      = 0xc800ff423L;
    public static final long REPRODUCIR = 0xc800ff416L;
    public static final long PAUSA      = 0xc800f7418L;
    public static final long DETENER    = 0xc800ff419L;
    public static final long ADELANTAR  = 0xc800f7415L;
    public static final long RETROCEDER = 0xc800ff414L;
    public static final long INFO       = 0xc800ff40fL;

    private Rc6() {}

    /**
     * Un valor de 36 bits → patrón de µs [marca, espacio, marca, …].
     * RC6 es Manchester: "1" = marca y después espacio; "0" al revés. El bit
     * de rastreo mide el doble. Se juntan tramos consecutivos del mismo nivel.
     */
    public static int[] patron(long valor36) {
        // medios[i] en unidades t, con signo: +marca / -espacio.
        int[] medios = new int[2 + BITS * 4];
        int n = 0;
        medios[n++] = 6;   // cabecera: 6t marca
        medios[n++] = -2;  //           2t espacio
        for (int i = 0; i < BITS; i++) {
            int bit = (int) ((valor36 >> (BITS - 1 - i)) & 1L);
            int u = (i == IDX_TOGGLE) ? 2 : 1;
            if (bit == 1) { medios[n++] = u; medios[n++] = -u; }
            else { medios[n++] = -u; medios[n++] = u; }
        }
        // Juntar niveles iguales y pasar a µs.
        int[] tmp = new int[n + 1];
        int m = 0, nivel = 1, acc = 0;
        for (int i = 0; i < n; i++) {
            int lvl = medios[i] > 0 ? 1 : 0;
            int u = Math.abs(medios[i]);
            if (lvl == nivel) acc += u;
            else { tmp[m++] = acc * T; nivel = lvl; acc = u; }
        }
        tmp[m++] = acc * T;
        // Empezar y terminar en marca: cantidad impar de tramos + guarda.
        if (m % 2 == 0) tmp[m++] = 6 * T;
        int[] pat = new int[m];
        System.arraycopy(tmp, 0, pat, 0, m);
        return pat;
    }
}
