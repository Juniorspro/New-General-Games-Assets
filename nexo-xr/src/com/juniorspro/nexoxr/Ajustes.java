package com.juniorspro.nexoxr;

import android.content.Context;
import android.content.SharedPreferences;

/** Todo lo configurable del sistema, guardado entre usos. */
final class Ajustes {
    int entorno = Entornos.LAGO;
    int sbs = 0;              // 0 = pantalla del teléfono, 1 = visor (SBS)
    int ipdMm = 63, k1 = 22, k2 = 12, tamano = 92, corregirLentes = 1;
    int manos = 1;            // hand tracking
    int verManos = 1;         // las manos fantasma
    int dedo = 1;             // tocar las pantallas con el dedo
    int mirada = 1;           // clic mirando fijo
    int sonido = 1;
    int tutorial = 0;         // ya se vio la bienvenida
    int apuntarAbajo = 10;    // el punto de mira de las manos, cm debajo de la cámara
    int fov = 90;             // el campo visual del visor (grados, vertical, por ojo)

    private static final String[] CLAVES = {"entorno", "sbs", "ipdMm", "k1", "k2", "tamano", "corregirLentes", "manos", "verManos", "dedo",
            "mirada", "sonido", "tutorial", "apuntarAbajo", "fov"};

    int valor(String c) {
        switch (c) {
            case "entorno": return entorno;
            case "sbs": return sbs;
            case "ipdMm": return ipdMm;
            case "k1": return k1;
            case "k2": return k2;
            case "tamano": return tamano;
            case "corregirLentes": return corregirLentes;
            case "manos": return manos;
            case "verManos": return verManos;
            case "dedo": return dedo;
            case "mirada": return mirada;
            case "sonido": return sonido;
            case "tutorial": return tutorial;
            case "fov": return fov;
            default: return apuntarAbajo;
        }
    }

    void poner(String c, int v) {
        switch (c) {
            case "entorno": entorno = v; break;
            case "sbs": sbs = v; break;
            case "ipdMm": ipdMm = v; break;
            case "k1": k1 = v; break;
            case "k2": k2 = v; break;
            case "tamano": tamano = v; break;
            case "corregirLentes": corregirLentes = v; break;
            case "manos": manos = v; break;
            case "verManos": verManos = v; break;
            case "dedo": dedo = v; break;
            case "mirada": mirada = v; break;
            case "sonido": sonido = v; break;
            case "tutorial": tutorial = v; break;
            case "fov": fov = v; break;
            default: apuntarAbajo = v;
        }
    }

    void cargar(Context c) {
        SharedPreferences p = c.getSharedPreferences("nexo", Context.MODE_PRIVATE);
        for (String k : CLAVES) if (p.contains(k)) poner(k, p.getInt(k, valor(k)));
    }

    void guardar(Context c) {
        SharedPreferences.Editor e = c.getSharedPreferences("nexo", Context.MODE_PRIVATE).edit();
        for (String k : CLAVES) e.putInt(k, valor(k));
        e.apply();
    }

    Ajustes copia() {
        Ajustes a = new Ajustes();
        for (String k : CLAVES) a.poner(k, valor(k));
        return a;
    }
}
