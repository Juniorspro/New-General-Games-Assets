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
    int doblePellizco = 1;
    int tresDof = 0;          // 3DoF: sólo girar con el giroscopio (ARCore sólo para la cámara y las manos)    // el clic con la mano: dos pellizcos (0 = uno solo, como antes)
    int mirada = 1;           // clic mirando fijo
    int sonido = 1;
    int tutorial = 0;         // ya se vio la bienvenida
    int apuntarAbajo = 10;    // el punto de mira de las manos, cm debajo de la cámara
    int fov = 90;             // el campo visual del visor (grados, vertical, por ojo)
    int anticipo = 30;        // Nexo Track: cuánto se predice el giro (ms: lo que tarda la imagen en llegar a los ojos)
    int ojoAuto = 1;          // los ojos: medirlos solos (girando la cabeza) o a mano
    int ojoX = 0, ojoY = 0, ojoZ = 70;   // los ojos desde la cámara, en el visor (mm: derecha, arriba, atrás)
    int prepararEspacio = 1;  // Nexo Inicio al empezar (escanear la mesa o el cuarto)
    int modoEspacio = Inicio.MESA;   // el último elegido (MESA, CUARTO, GIRAR)
    int verMesa = 1;          // la mesa marcada en el mundo
    int barraEnMesa = 1;      // la barra de abajo apoyada en la mesa
    int soloConMesa = 1;      // sólo moverse cuando se ve la mesa
    int escalaMano = 1000;    // el tamaño de tus manos medido en la mesa (×1000)

    private static final String[] CLAVES = {"entorno", "sbs", "ipdMm", "k1", "k2", "tamano", "corregirLentes", "manos", "verManos", "dedo",
            "mirada", "sonido", "tutorial", "apuntarAbajo", "fov", "anticipo", "ojoAuto", "ojoX", "ojoY", "ojoZ",
            "prepararEspacio", "modoEspacio", "verMesa", "barraEnMesa", "soloConMesa", "escalaMano", "doblePellizco", "tresDof"};

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
            case "anticipo": return anticipo;
            case "ojoAuto": return ojoAuto;
            case "ojoX": return ojoX;
            case "ojoY": return ojoY;
            case "ojoZ": return ojoZ;
            case "prepararEspacio": return prepararEspacio;
            case "modoEspacio": return modoEspacio;
            case "verMesa": return verMesa;
            case "barraEnMesa": return barraEnMesa;
            case "soloConMesa": return soloConMesa;
            case "escalaMano": return escalaMano;
            case "doblePellizco": return doblePellizco;
            case "tresDof": return tresDof;
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
            case "anticipo": anticipo = v; break;
            case "ojoAuto": ojoAuto = v; break;
            case "ojoX": ojoX = v; break;
            case "ojoY": ojoY = v; break;
            case "ojoZ": ojoZ = v; break;
            case "prepararEspacio": prepararEspacio = v; break;
            case "modoEspacio": modoEspacio = v; break;
            case "verMesa": verMesa = v; break;
            case "barraEnMesa": barraEnMesa = v; break;
            case "soloConMesa": soloConMesa = v; break;
            case "escalaMano": escalaMano = v; break;
            case "doblePellizco": doblePellizco = v; break;
            case "tresDof": tresDof = v; break;
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
