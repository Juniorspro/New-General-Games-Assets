package com.juniorspro.nexoxr;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Las mini-apps sin Android: la calculadora, el cronómetro y el temporizador, el clima, las apps web. */
public class PruebaApps {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static void cuenta(String e, double esperado) {
        double v = Calculo.resolver(e);
        boolean ok = Double.isNaN(esperado) ? Double.isNaN(v) : Math.abs(v - esperado) < 1e-9 * Math.max(1, Math.abs(esperado));
        ver(ok, String.format("%s = %s", e, Calculo.mostrar(v)));
    }

    public static void main(String[] a) {
        // ── la calculadora ──
        cuenta("2+3×4", 14);
        cuenta("(2+3)×4", 20);
        cuenta("2^3^2", 512);
        cuenta("−5+2", -3);
        cuenta("10÷4", 2.5);
        cuenta("1,5×2", 3);
        cuenta("√(9)+1", 4);
        cuenta("√16×2", 8);
        cuenta("2π", 2 * Math.PI);
        cuenta("2(3+1)", 8);
        cuenta("(1+2", 3);
        cuenta("200+10%", 220);
        cuenta("200−10%", 180);
        cuenta("50×10%", 5);
        cuenta("10%", 0.1);
        cuenta("1÷0", Double.NaN);
        cuenta("2++", Double.NaN);
        cuenta("1.2.3", Double.NaN);
        cuenta("√(−4)", Double.NaN);
        ver(Calculo.mostrar(0.1 + 0.2).equals("0,3"), "0,1 + 0,2 se muestra 0,3 (" + Calculo.mostrar(0.1 + 0.2) + ")");
        ver(Calculo.mostrar(1234567.5).equals("1.234.567,5"), "miles con punto y decimales con coma: " + Calculo.mostrar(1234567.5));
        ver(Calculo.mostrar(-1000).equals("-1.000"), "negativos: " + Calculo.mostrar(-1000));
        ver(Calculo.mostrar(6.02e23).startsWith("6,02×10^23"), "muy grande, con exponente: " + Calculo.mostrar(6.02e23));
        ver(Calculo.mostrar(2.0 / 3).equals("0,6666666667"), "10 cifras: " + Calculo.mostrar(2.0 / 3));

        // ── el cronómetro ──
        Tiempos.Cronometro c = new Tiempos.Cronometro();
        c.empezar(1000);
        c.vuelta(4000);
        c.parar(6000);
        long quieto = c.ms(60000);
        c.empezar(70000);
        c.vuelta(71500);
        ver(quieto == 5000 && c.ms(72000) == 7000, "el cronómetro: pausado no suma (5 s + 2 s = " + c.ms(72000) + " ms)");
        ver(c.vueltas.size() == 2 && c.vueltas.get(0) == 3000 && c.vueltas.get(1) == 3500, "las vueltas: " + c.vueltas);
        ver(Tiempos.formato(3725000, false).equals("1:02:05") && Tiempos.formato(65300, true).equals("01:05,3"), "el formato: 1:02:05 y 01:05,3");

        // ── el temporizador ──
        Tiempos.Temporizador t = new Tiempos.Temporizador();
        t.poner(60000);
        t.empezar(0);
        t.pausar(20000);
        long r1 = t.resta(50000);
        t.empezar(50000);
        boolean antes = t.termino(89000), justo = t.termino(90000), otraVez = t.termino(95000);
        ver(r1 == 40000, "pausado a los 20 s: quedan 40 s aunque pase el tiempo");
        ver(!antes && justo && !otraVez, "suena una sola vez, justo al llegar a cero");
        t.poner(30000);
        t.empezar(0);
        t.sumar(60000, 10000);
        ver(t.resta(10000) == 80000 && Tiempos.restante(t.resta(89800)).equals("00:01"), "+1 min andando; a 0,2 s de terminar muestra 00:01");

        // ── el clima ──
        ver(Clima.descripcion(0).equals("Despejado") && Clima.descripcion(63).equals("Lluvia") && Clima.descripcion(95).equals("Tormenta"), "los códigos del tiempo");
        ver(Clima.icono(0, true) == TiposIcono.SOL && Clima.icono(0, false) == TiposIcono.LUNA && Clima.icono(61, true) == TiposIcono.LLUVIA
                && Clima.icono(73, true) == TiposIcono.NIEVE && Clima.icono(96, true) == TiposIcono.TORMENTA && Clima.icono(45, true) == TiposIcono.NIEBLA, "los íconos (de día y de noche)");
        ver(Clima.urlBuscar("San Miguel de Tucumán").endsWith("name=San%20Miguel%20de%20Tucum%C3%A1n"), "buscar una ciudad con tildes: " + Clima.urlBuscar("San Miguel de Tucumán"));
        boolean dias = true;
        String[] nombres = {"lun", "mar", "mié", "jue", "vie", "sáb", "dom"};
        for (int d = 0; d < 400; d += 7) {
            LocalDate f = LocalDate.of(2026, 1, 1).plusDays(d * 3L % 3000);
            String esp = nombres[f.getDayOfWeek().getValue() - 1] + " " + f.getDayOfMonth();
            if (!Clima.dia(f.toString(), false).equals(esp)) { dias = false; System.out.println("   " + f + " → " + Clima.dia(f.toString(), false) + " (era " + esp + ")"); }
        }
        ver(dias, "el día de la semana de cada fecha (" + Clima.dia("2026-09-28", false) + ")");

        // ── las apps web ──
        List<AppsWeb.App> l = new ArrayList<>();
        l = AppsWeb.agregar(l, new AppsWeb.App("Mi diario", "https://www.diario.com.ar/", 0xFF123456, false));
        l = AppsWeb.agregar(l, new AppsWeb.App("Juego\tcon tab", "https://juego.io", 0xFFABCDEF, true));
        l = AppsWeb.agregar(l, new AppsWeb.App("Mi diario (otra vez)", "https://diario.com.ar", 0xFF654321, false));
        List<AppsWeb.App> leidas = AppsWeb.leer(AppsWeb.serializar(l));
        ver(leidas.size() == 2 && leidas.get(1).nombre.equals("Mi diario (otra vez)") && leidas.get(0).escritorio && leidas.get(0).color == 0xFFABCDEF,
                "guardar y leer las tuyas (sin repetir la misma dirección, con el modo escritorio y el color)");
        ver(AppsWeb.deId("web:https://web.whatsapp.com", leidas).escritorio, "WhatsApp Web va en modo escritorio");
        ver(AppsWeb.deId("web:https://juego.io", leidas).nombre.startsWith("Juego"), "una tuya se encuentra por su dirección");
        AppsWeb.App nueva = AppsWeb.deId("web:https://www.ejemplo.com.ar/algo?x=1", leidas);
        ver(nueva.nombre.equals("Ejemplo") && AppsWeb.host(nueva.url).equals("ejemplo.com.ar"), "una desconocida: nombre y host de la dirección (" + nueva.nombre + ")");
        ver(AppsWeb.colorDe("https://a.com") == AppsWeb.colorDe("https://a.com/otra"), "el color sale del host (siempre el mismo)");
        ver(AppsWeb.quitar(leidas, "https://juego.io/").size() == 1, "quitar una");

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }
}
