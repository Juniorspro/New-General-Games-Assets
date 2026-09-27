import com.juniorspro.asaltomr.Control;

/**
 * El control Bluetooth del VR Box en sus modos (lo que manda cada uno, según
 * cómo vienen: música, gamepad, teclado, mouse), el joystick analógico, el
 * disparo sostenido y aprender los botones.
 */
public class PruebaControl {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static String a(int x) { return Control.ACCIONES[x]; }

    public static void main(String[] args) {
        Control c = new Control();
        // modo música (@ + A): gatillo = play/pausa, joystick = volumen y siguiente/anterior
        ver(c.accion(85) == Control.DISPARAR, "música: el gatillo (play/pausa) dispara");
        ver(c.accion(87) == Control.SIGUIENTE && c.accion(88) == Control.ANTERIOR, "música: el joystick a los costados cambia de arma");
        ver(c.accion(24) == Control.DISPARAR, "el volumen del teléfono sigue disparando");
        // modo gamepad (@ + B): A, B, X, Y, R1, L1, start
        ver(c.accion(96) == Control.DISPARAR && c.accion(103) == Control.DISPARAR, "gamepad: A y R1 disparan");
        ver(c.accion(97) == Control.RECARGAR && c.accion(99) == Control.RECARGAR, "gamepad: B y X recargan");
        ver(c.accion(100) == Control.SIGUIENTE, "gamepad: Y cambia de arma");
        ver(c.accion(108) == Control.MENU, "gamepad: start abre el menú");
        // modo teclado / flechas: Enter y las flechas
        ver(c.accion(66) == Control.DISPARAR && c.accion(20) == Control.RECARGAR && c.accion(22) == Control.SIGUIENTE, "flechas: Enter dispara, ↓ recarga, → cambia");
        // modo mouse: el clic derecho llega como Atrás
        ver(c.accion(4) == Control.MENU, "el Atrás del control abre el menú (no sale del visor)");
        ver(c.accion(3) == Control.NADA, "Home no es del juego");

        // el joystick analógico: con histéresis, sin rebotes
        int[] e = c.ejes(0.2f, 0, 0, 0);
        ver(e.length == 0, "joystick apenas movido: nada");
        e = c.ejes(0.8f, 0, 0, 0);
        ver(e.length == 1 && e[0] == Control.JOY_DER && c.accion(e[0]) == Control.SIGUIENTE, "joystick a la derecha: arma siguiente");
        e = c.ejes(0.5f, 0, 0, 0);
        ver(e.length == 0, "baja un poco (0.5): sigue apretado, no rebota");
        e = c.ejes(0.1f, 0, 0, 0);
        ver(e.length == 1 && e[0] == -Control.JOY_DER, "vuelve al centro: se suelta");
        e = c.ejes(0, 0.9f, 0.9f, 0);
        boolean abajo = false, gatillo = false;
        for (int x : e) { abajo |= x == Control.JOY_ABA; gatillo |= x == Control.GATILLO_DER; }
        ver(abajo && gatillo && c.accion(Control.JOY_ABA) == Control.RECARGAR && c.accion(Control.GATILLO_DER) == Control.DISPARAR,
                "joystick abajo recarga; el gatillo analógico dispara");
        c.soltarTodo();

        // el disparo sostenido (el fusil): mientras esté apretado
        ver(c.evento(103, true, false, 0) == Control.DISPARAR && c.sostenido(), "apretar R1: un tiro, y queda apretado");
        ver(c.evento(103, true, true, 50) == Control.NADA && c.sostenido(), "la repetición de Android no es otro tiro");
        ver(c.evento(103, false, false, 300) == Control.NADA && !c.sostenido(), "soltarlo: deja de tirar");

        // aprender: disparar = el botón 190, recargar = joystick ↑, arma = (se saltea), menú = 191
        c.empezarAprender(1000);
        ver(c.aprendiendo() && c.pidiendo() == Control.DISPARAR, "aprender: primero pide disparar");
        ver(c.evento(190, true, false, 1100) == Control.NADA, "mientras aprende, el botón no hace otra cosa");
        ver(c.pidiendo() == Control.RECARGAR, "después pide recargar");
        c.evento(190, true, false, 1200);   // el mismo botón otra vez: no cuenta
        ver(c.pidiendo() == Control.RECARGAR, "el mismo botón no sirve para dos cosas");
        c.evento(Control.JOY_ARR, true, false, 1300);
        ver(c.pidiendo() == Control.SIGUIENTE, "joystick ↑ para recargar; ahora pide arma");
        ver(!c.esperar(5000) && c.pidiendo() == Control.SIGUIENTE, "a los 4 s todavía espera");
        c.esperar(1300 + Control.ESPERA_PASO + 1);
        ver(c.pidiendo() == Control.MENU, "a los 8 s saltea el paso");
        c.evento(191, true, false, 12000);
        ver(!c.aprendiendo(), "con el último, termina");
        ver(c.accion(190) == Control.DISPARAR && c.accion(Control.JOY_ARR) == Control.RECARGAR && c.accion(191) == Control.MENU,
                "lo aprendido manda: 190 dispara, ↑ recarga, 191 menú");
        ver(c.accion(100) == Control.SIGUIENTE, "lo salteado queda como venía (Y: arma)");
        // guardar y cargar
        Control d = new Control();
        d.cargar(c.guardar());
        ver(d.accion(190) == Control.DISPARAR && d.accion(Control.JOY_ARR) == Control.RECARGAR && d.accion(191) == Control.MENU,
                "se guarda y se carga (" + c.guardar() + ")");
        d.cargar("basura,1:x,:,99:7");
        ver(d.accion(99) == Control.RECARGAR, "lo guardado roto no rompe nada");

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
