using System;
using System.Collections.Generic;
using UnityEngine;

namespace Porteo
{
    // La versión de Android sólo se maneja con los controles de TouchControlsKit (el joystick, el
    // touchpad para mirar y los botones, hijos de "VirtualController"). Para jugar con teclado y
    // mouse (controles.js en la página) o con un guion de prueba (la consola) se aprietan esos mismos
    // controles con dedos virtuales: hace falta saber dónde está cada uno en la pantalla.
    public static class ControlesTactiles
    {
        static readonly Dictionary<string, RectTransform> controles = new Dictionary<string, RectTransform>();
        static float ultimaBusqueda = -10;

        // [centro x, centro y, ancho, alto, radio del joystick] en píxeles de la pantalla (origen abajo
        // a la izquierda, como Input.mousePosition); vacío si el control no está activo
        public static double[] Rect(string nombre)
        {
            try
            {
                if (!controles.TryGetValue(nombre, out var rt) || rt == null)
                {
                    // se buscan todos juntos (y no más de una vez cada 5 s: recorrer todos los objetos cuesta)
                    if (Time.realtimeSinceStartup - ultimaBusqueda < 5) return Array.Empty<double>();
                    ultimaBusqueda = Time.realtimeSinceStartup;
                    foreach (var x in Resources.FindObjectsOfTypeAll<RectTransform>())
                        if (x.gameObject.scene.IsValid() && x.parent != null && x.parent.name == "VirtualController") controles[x.name] = x;
                    if (!controles.TryGetValue(nombre, out rt) || rt == null) return Array.Empty<double>();
                }
                if (rt == null || !rt.gameObject.activeInHierarchy) return Array.Empty<double>();
                var esq = new Vector3[4];
                rt.GetWorldCorners(esq);
                // en un canvas de cámara las esquinas están en el mundo: a píxeles con esa cámara
                var lienzo = rt.GetComponentInParent<Canvas>()?.rootCanvas;
                var cam = lienzo != null && lienzo.renderMode != RenderMode.ScreenSpaceOverlay ? lienzo.worldCamera : null;
                Vector2 a = cam != null ? (Vector2)cam.WorldToScreenPoint(esq[0]) : (Vector2)esq[0];
                Vector2 b = cam != null ? (Vector2)cam.WorldToScreenPoint(esq[2]) : (Vector2)esq[2];
                double radio = 0;
                // el joystick satura a (diagonal del fondo / 2) * borderSize / 16 (TCKJoystick.UpdatePosition),
                // comparado con la distancia del dedo en el mundo de su cámara (GuiCamera.ScreenToWorldPoint):
                // en píxeles es eso dividido lo que mide un píxel en ese mundo
                foreach (var c in rt.GetComponents<MonoBehaviour>())
                {
                    if (c.GetType().Name != "TCKJoystick") continue;
                    var fondo = c.GetType().GetField("backgroundRT")?.GetValue(c) as RectTransform;
                    var borde = c.GetType().GetField("borderSize")?.GetValue(c) is float bs ? bs : 5.85f;
                    if (fondo == null) continue;
                    float mundo = fondo.sizeDelta.magnitude / 2 * borde / 16;
                    var gui = GuiCamara();
                    if (gui == null) { radio = mundo; continue; }
                    var p0 = gui.ScreenToWorldPoint(new Vector3(0, 0, 0));
                    var p1 = gui.ScreenToWorldPoint(new Vector3(100, 0, 0));
                    float porPixel = Vector2.Distance(p0, p1) / 100f;
                    radio = porPixel > 0 ? mundo / porPixel : mundo;
                }
                return new double[] { (a.x + b.x) / 2, (a.y + b.y) / 2, b.x - a.x, b.y - a.y, radio };
            }
            catch (Exception e) { Debug.LogException(e); return Array.Empty<double>(); }
        }

        // la cámara con la que TouchControlsKit pasa los toques a su mundo (GuiCamera.getCamera)
        static Camera guiCamara;
        static Camera GuiCamara()
        {
            if (guiCamara != null) return guiCamara;
            foreach (var mb in Resources.FindObjectsOfTypeAll<MonoBehaviour>())
                if (mb.GetType().Name == "GuiCamera" && mb.gameObject.scene.IsValid() && mb.GetComponent<Camera>() is Camera c) return guiCamara = c;
            return null;
        }

        // se puede jugar (no en un menú ni en pausa): ahí el mouse trabado mira y dispara
        public static bool EnJuego() => Time.timeScale > 0 && Rect("Touchpad").Length > 0;
    }
}
