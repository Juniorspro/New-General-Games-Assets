package com.juniorspro.nexoxr;

import java.util.Locale;

/**
 * EL CLIMA sin Android: qué quiere decir cada código del tiempo (los de la
 * OMM, los que da Open-Meteo), qué ícono va, y las direcciones de la consulta
 * (Open-Meteo: libre, sin cuenta ni clave). Se prueba en la PC.
 */
public final class Clima {
    private Clima() {}

    /** La descripción de un código de la OMM. */
    public static String descripcion(int c) {
        switch (c) {
            case 0: return "Despejado";
            case 1: return "Casi despejado";
            case 2: return "Parcialmente nublado";
            case 3: return "Nublado";
            case 45: case 48: return "Niebla";
            case 51: case 53: case 55: return "Llovizna";
            case 56: case 57: return "Llovizna helada";
            case 61: return "Lluvia débil";
            case 63: return "Lluvia";
            case 65: return "Lluvia fuerte";
            case 66: case 67: return "Lluvia helada";
            case 71: return "Nevada débil";
            case 73: return "Nieve";
            case 75: return "Nevada fuerte";
            case 77: return "Granizo fino";
            case 80: case 81: return "Chaparrones";
            case 82: return "Chaparrones fuertes";
            case 85: case 86: return "Chaparrones de nieve";
            case 95: return "Tormenta";
            case 96: case 99: return "Tormenta con granizo";
            default: return "—";
        }
    }

    /** El ícono (de TiposIcono) para un código, de día o de noche. */
    public static int icono(int c, boolean dia) {
        if (c == 0 || c == 1) return dia ? TiposIcono.SOL : TiposIcono.LUNA;
        if (c == 2 || c == 3) return TiposIcono.NUBE;
        if (c == 45 || c == 48) return TiposIcono.NIEBLA;
        if (c >= 71 && c <= 77 || c == 85 || c == 86) return TiposIcono.NIEVE;
        if (c >= 95) return TiposIcono.TORMENTA;
        if (c >= 51 && c <= 82) return TiposIcono.LLUVIA;
        return TiposIcono.NUBE;
    }

    /** Un color de fondo para el tiempo que hace (el cielo). */
    public static int[] cielo(int c, boolean dia) {
        if (!dia) return new int[]{0xFF10183A, 0xFF1B2552};
        if (c == 0 || c == 1) return new int[]{0xFF2F7DE0, 0xFF5AB0F5};
        if (c >= 95) return new int[]{0xFF2B2F45, 0xFF4B4F66};
        if (c >= 51) return new int[]{0xFF3B4A63, 0xFF5E6E88};
        return new int[]{0xFF46618A, 0xFF7C93B5};
    }

    /** Buscar una ciudad (el nombre como se escribe). */
    public static String urlBuscar(String ciudad) {
        return "https://geocoding-api.open-meteo.com/v1/search?count=5&language=es&format=json&name=" + codificar(ciudad.trim());
    }

    /** El tiempo de un lugar: ahora, las próximas horas y 7 días, en su hora. */
    public static String urlTiempo(double lat, double lon) {
        return String.format(Locale.ROOT, "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f"
                + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day"
                + "&hourly=temperature_2m,weather_code,precipitation_probability,is_day"
                + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
                + "&timezone=auto&forecast_days=7", lat, lon);
    }

    static String codificar(String s) {
        StringBuilder b = new StringBuilder();
        for (byte x : s.getBytes(java.nio.charset.StandardCharsets.UTF_8)) {
            int c = x & 0xFF;
            if (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.') b.append((char) c);
            else if (c == ' ') b.append("%20");
            else b.append(String.format("%%%02X", c));
        }
        return b.toString();
    }

    /** "2026-09-28" → "lun 28" (el día de la semana en castellano). */
    public static String dia(String fecha, boolean hoy) {
        if (hoy) return "Hoy";
        try {
            String[] p = fecha.split("-");
            int y = Integer.parseInt(p[0]), m = Integer.parseInt(p[1]), d = Integer.parseInt(p[2]);
            // Zeller (0 = sábado)
            if (m < 3) { m += 12; y -= 1; }
            int k = y % 100, j = y / 100;
            int h = (d + 13 * (m + 1) / 5 + k + k / 4 + j / 4 + 5 * j) % 7;
            String[] nombres = {"sáb", "dom", "lun", "mar", "mié", "jue", "vie"};
            return nombres[h] + " " + Integer.parseInt(p[2]);
        } catch (Exception e) {
            return fecha;
        }
    }
}
