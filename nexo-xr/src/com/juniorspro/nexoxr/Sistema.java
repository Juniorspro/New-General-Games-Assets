package com.juniorspro.nexoxr;

/**
 * Lo que las pantallas le piden al sistema (se llama desde el hilo de la app;
 * el sistema lo pasa al hilo de dibujo).
 */
interface Sistema {
    void abrir(String app);
    void abrirUrl(String url);
    void entorno(int cual);
    int entorno();
    /** Passthrough ↔ el último entorno virtual. */
    void alternarPassthrough();
    /** Pide el permiso de las fotos y videos (lo pregunta el teléfono). */
    void permisoFotos();
    void recentrar();
    void captura();
    void visor(boolean sbs);
    boolean visor();
    void mostrarRapidos(boolean si);
    void mostrarTeclado(boolean si);
    void cambio(String clave, int valor);
    Ajustes ajustes();
    /** Cómo están las manos, el seguimiento, la batería (para mostrar). */
    String estado();
    void aprenderControl();
    void sonido(int cual);
}
