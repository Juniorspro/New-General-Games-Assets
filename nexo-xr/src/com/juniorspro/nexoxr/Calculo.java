package com.juniorspro.nexoxr;

import java.util.Locale;

/**
 * LAS CUENTAS de la calculadora: + − × ÷ con la precedencia de siempre,
 * paréntesis, potencias (^), porcentaje (%), raíz (√), π, el menos adelante,
 * y la coma o el punto para los decimales. Sin Android (se prueba en la PC).
 *
 *   Calculo.resolver("2+3×4")      → 14
 *   Calculo.resolver("√(9)+10%")   → 3.1
 *   Calculo.mostrar(0.1 + 0.2)     → "0,3"
 */
public final class Calculo {
    private final String s;
    private int i;
    /** El último término fue un porcentaje solo ("10%"): en a + b% se suma el b% de a (como en el celular). */
    private boolean fuePorcentaje;

    private Calculo(String s) { this.s = s; }

    /** El resultado, o NaN si la cuenta está mal escrita (o divide por cero). */
    public static double resolver(String texto) {
        if (texto == null) return Double.NaN;
        String t = texto.replace('×', '*').replace('÷', '/').replace('−', '-').replace(',', '.').replace("π", "p").replace(" ", "");
        if (t.isEmpty()) return Double.NaN;
        // los paréntesis que faltan cerrar, se cierran
        int abiertos = 0;
        for (char ch : t.toCharArray()) { if (ch == '(') abiertos++; else if (ch == ')') abiertos--; }
        StringBuilder b = new StringBuilder(t);
        for (; abiertos > 0; abiertos--) b.append(')');
        Calculo c = new Calculo(b.toString());
        try {
            double v = c.suma();
            if (c.i != c.s.length()) return Double.NaN;
            return Double.isInfinite(v) ? Double.NaN : v;
        } catch (RuntimeException e) {
            return Double.NaN;
        }
    }

    private char ver() { return i < s.length() ? s.charAt(i) : '\0'; }

    private double suma() {
        double v = producto();
        while (true) {
            char c = ver();
            if (c == '+') { i++; double r = producto(); v += fuePorcentaje ? v * r : r; }
            else if (c == '-') { i++; double r = producto(); v -= fuePorcentaje ? v * r : r; }
            else return v;
        }
    }

    private double producto() {
        fuePorcentaje = false;
        double v = potencia();
        boolean solo = true, pct = fuePorcentaje;
        while (true) {
            char c = ver();
            if (c == '*') { i++; v *= potencia(); solo = false; }
            else if (c == '/') { i++; double d = potencia(); if (d == 0) throw new ArithmeticException(); v /= d; solo = false; }
            else if (c == '(' || c == 'p' || c == '√' || Character.isDigit(c) || c == '.') { v *= potencia(); solo = false; }   // 2(3) = 6, 2π
            else { fuePorcentaje = solo && pct; return v; }
        }
    }

    private double potencia() {
        double b = unario();
        if (ver() == '^') { i++; return Math.pow(b, potencia()); }   // de derecha a izquierda
        return b;
    }

    private double unario() {
        char c = ver();
        if (c == '-') { i++; return -unario(); }
        if (c == '+') { i++; return unario(); }
        if (c == '√') { i++; double v = unario(); if (v < 0) throw new ArithmeticException(); return Math.sqrt(v); }
        return porcentaje();
    }

    private double porcentaje() {
        double v = primario();
        boolean pct = false;
        while (ver() == '%') { i++; v /= 100; pct = true; }
        fuePorcentaje = pct;
        return v;
    }

    private double primario() {
        char c = ver();
        if (c == '(') {
            i++;
            double v = suma();
            if (ver() != ')') throw new IllegalStateException();
            i++;
            return v;
        }
        if (c == 'p') { i++; return Math.PI; }
        int ini = i;
        while (Character.isDigit(ver()) || ver() == '.') i++;
        if (ini == i) throw new IllegalStateException();
        String n = s.substring(ini, i);
        if (n.indexOf('.') != n.lastIndexOf('.')) throw new IllegalStateException();
        return Double.parseDouble(n);
    }

    /**
     * Para mostrar: hasta 10 cifras, sin ceros de más, con coma decimal y
     * puntos de miles; muy grande o muy chico, con exponente.
     */
    public static String mostrar(double v) {
        if (Double.isNaN(v)) return "Error";
        if (v == 0) return "0";
        double a = Math.abs(v);
        if (a >= 1e12 || a < 1e-7) {
            String e = String.format(Locale.ROOT, "%.6e", v);
            String[] p = e.split("e");
            String m = p[0].contains(".") ? p[0].replaceAll("0+$", "").replaceAll("\\.$", "") : p[0];
            return m.replace('.', ',') + "×10^" + Integer.parseInt(p[1]);
        }
        // redondear a 10 cifras significativas (0.1 + 0.2 = 0.3)
        java.math.BigDecimal d = new java.math.BigDecimal(v).round(new java.math.MathContext(10));
        String t = d.stripTrailingZeros().toPlainString();
        String ent = t, dec = "";
        int k = t.indexOf('.');
        if (k >= 0) { ent = t.substring(0, k); dec = t.substring(k + 1); }
        boolean neg = ent.startsWith("-");
        if (neg) ent = ent.substring(1);
        StringBuilder b = new StringBuilder();
        for (int j = 0; j < ent.length(); j++) {
            if (j > 0 && (ent.length() - j) % 3 == 0) b.append('.');
            b.append(ent.charAt(j));
        }
        return (neg ? "-" : "") + b + (dec.isEmpty() ? "" : "," + dec);
    }
}
