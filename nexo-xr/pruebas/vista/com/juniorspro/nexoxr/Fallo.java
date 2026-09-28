package com.juniorspro.nexoxr;

/** Sólo para la vista previa en la PC: el Fallo de verdad usa Android. */
final class Fallo {
    static void guardar(String donde, Throwable e) { System.err.println("fallo en " + donde + ": " + e); }
}
