package com.juniorspro.asaltomr;

import android.content.Context;
import android.content.SharedPreferences;

/** Todo lo configurable, guardado entre usos. */
final class Ajustes {
    // visor
    int sbs = 0;               // 0 = pantalla normal, 1 = SBS (visor tipo Cardboard)
    int ipdMm = 63;            // separación de los ojos virtuales
    int lentesMm = 63;         // separación de los centros de los lentes del visor, en la pantalla
    int tamano = 92;           // % de cada mitad que ocupa la imagen
    int corregirLentes = 1;    // deformar al revés para los lentes
    int k1 = 22, k2 = 12;      // ×100
    int intercambiar = 0;      // cambiar ojo izquierdo y derecho (para mirar cruzado)
    int estereo = 1;           // 0 = fondo plano en los dos ojos, 1 = entorno reproyectado con la malla (3D real)
    // escaneo
    int malla = 1;             // 0 = oculta (sólo tapa), 1 = escaneo (líneas), 2 = sólida
    int detalle = 1;           // 0 = fino 5 cm, 1 = normal 7 cm, 2 = grueso 10 cm
    int rellenar = 1;          // la IA completa lo que no se ve (piso debajo y detrás de las cosas, el fondo de los objetos)
    int zonas = 1;             // 0 = no, 1 = al escanear, 2 = siempre (con las rutas de los soldados)
    // mano
    int mano = 1;              // la pistola en la mano (hand tracking con MediaPipe) y el gesto de disparo
    // cámara
    int camara = 1;            // 0 = la de ARCore, 1 = la configuración más ancha, 2 = ultra angular (experimental)
    // juego
    int dificultad = 1;
    int sonido = 1;
    int vibrar = 1;
    int seguro = 0;            // modo seguro: sin semántica, sin completar, cámara de ARCore, sin mano

    /** Lo mínimo para arrancar (después de un error). */
    void ponerSeguro() {
        seguro = 1; sbs = 0; camara = 0; rellenar = 0; zonas = 0; mano = 0;
    }

    float voxel() { return detalle == 0 ? 0.05f : detalle == 2 ? 0.10f : 0.07f; }

    private static final String[] CLAVES = {"sbs", "ipdMm", "lentesMm", "tamano", "corregirLentes", "k1", "k2", "intercambiar",
            "estereo", "malla", "detalle", "rellenar", "zonas", "camara", "dificultad", "sonido", "vibrar", "seguro", "mano"};

    int valor(String c) {
        switch (c) {
            case "sbs": return sbs;
            case "ipdMm": return ipdMm;
            case "lentesMm": return lentesMm;
            case "tamano": return tamano;
            case "corregirLentes": return corregirLentes;
            case "k1": return k1;
            case "k2": return k2;
            case "intercambiar": return intercambiar;
            case "estereo": return estereo;
            case "malla": return malla;
            case "detalle": return detalle;
            case "rellenar": return rellenar;
            case "zonas": return zonas;
            case "camara": return camara;
            case "dificultad": return dificultad;
            case "sonido": return sonido;
            case "seguro": return seguro;
            case "mano": return mano;
            default: return vibrar;
        }
    }

    void poner(String c, int v) {
        switch (c) {
            case "sbs": sbs = v; break;
            case "ipdMm": ipdMm = v; break;
            case "lentesMm": lentesMm = v; break;
            case "tamano": tamano = v; break;
            case "corregirLentes": corregirLentes = v; break;
            case "k1": k1 = v; break;
            case "k2": k2 = v; break;
            case "intercambiar": intercambiar = v; break;
            case "estereo": estereo = v; break;
            case "malla": malla = v; break;
            case "detalle": detalle = v; break;
            case "rellenar": rellenar = v; break;
            case "zonas": zonas = v; break;
            case "camara": camara = v; break;
            case "dificultad": dificultad = v; break;
            case "sonido": sonido = v; break;
            case "seguro": seguro = v; break;
            case "mano": mano = v; break;
            default: vibrar = v;
        }
    }

    void cargar(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences("ajustes", Context.MODE_PRIVATE);
        for (String c : CLAVES) if (p.contains(c)) poner(c, p.getInt(c, valor(c)));
    }

    void guardar(Context ctx) {
        SharedPreferences.Editor e = ctx.getSharedPreferences("ajustes", Context.MODE_PRIVATE).edit();
        for (String c : CLAVES) e.putInt(c, valor(c));
        e.apply();
    }

    /** Lo que se lee en el render: una copia para no ver valores a medio cambiar. */
    Ajustes copia() {
        Ajustes a = new Ajustes();
        for (String c : CLAVES) a.poner(c, valor(c));
        return a;
    }
}
