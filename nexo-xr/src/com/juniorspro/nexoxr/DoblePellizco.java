package com.juniorspro.nexoxr;

/**
 * EL CLIC CON LA MANO ES UN DOBLE PELLIZCO (como un doble clic del mouse):
 * un pellizco solo no hace nada, así la mano que se cierra sin querer, que
 * agarra algo o que se rasca no aprieta botones.
 *
 *   1. el PRIMERO: corto (se suelta antes de PRIMERO_MAX). Deja la mano
 *      ARMADA: el cursor lo muestra (la mitad del anillo prendida y una cuenta
 *      que se acaba);
 *   2. el SEGUNDO, antes de ESPERA después de soltar el primero: ése aprieta.
 *      Soltarlo es el clic; sostenerlo y mover es arrastrar o hacer scroll
 *      (y la barra de la ventana se agarra igual: doble pellizco y mover).
 *
 * Un primer pellizco sostenido de más no arma (es agarrar algo, no un clic).
 * Después del clic se vuelve a empezar: un tercer pellizco no es otro clic.
 *
 * Sin Android: se prueba en la PC (pruebas/PruebaGestos.java).
 */
public final class DoblePellizco {
    public static final long PRIMERO_MAX = 450, ESPERA = 550;
    public static final int QUIETO = 0, PRIMERO = 1, ARMADO = 2, APRETANDO = 3, SOSTENIDO = 4;
    /** false = como antes: un pellizco ya aprieta. */
    public boolean doble = true;
    public int fase = QUIETO;
    private long desde;

    /** Un cuadro nuevo con el pellizco crudo (Gestos): ¿aprieta? */
    public boolean paso(boolean pellizca, long ms) {
        if (!doble) { fase = pellizca ? APRETANDO : QUIETO; return pellizca; }
        switch (fase) {
            case QUIETO:
                if (pellizca) { fase = PRIMERO; desde = ms; }
                break;
            case PRIMERO:
                if (!pellizca) { fase = ARMADO; desde = ms; }
                else if (ms - desde > PRIMERO_MAX) fase = SOSTENIDO;
                break;
            case ARMADO:
                if (pellizca) { fase = APRETANDO; desde = ms; }
                else if (ms - desde > ESPERA) fase = QUIETO;
                break;
            default:   // APRETANDO, SOSTENIDO: hasta soltar
                if (!pellizca) fase = QUIETO;
        }
        return fase == APRETANDO;
    }

    /** Para el cursor: 1 recién armado → 0 se acabó la espera (0 si no está armado). */
    public float armado(long ms) {
        if (fase == PRIMERO) return 1;
        if (fase != ARMADO) return 0;
        return Math.max(0, 1 - (ms - desde) / (float) ESPERA);
    }

    /** ¿Empezó el primer pellizco en este cuadro? (para guardar dónde apuntabas). */
    public boolean empezando(long ms) { return fase == PRIMERO && desde == ms; }

    public void soltar() { fase = QUIETO; }
}
