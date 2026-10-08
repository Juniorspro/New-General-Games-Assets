using System;
using System.Collections.Generic;
using Porteo;

namespace UnityEngine
{
    // Los eventos de IMGUI que lee el InputField de uGUI con Event.PopEvent: cada tecla apretada o
    // soltada y cada carácter escrito (como en Unity: una tecla con su keyCode y el texto aparte,
    // con keyCode None y el carácter).
    public sealed partial class Event
    {
        EventType tipo = EventType.Ignore;
        KeyCode tecla;
        char caracter;
        EventModifiers mods;
        string comando = "";
        Vector2 posicion;

        public Event() { }

        public Event(Event other)
        {
            if (other == null) return;
            tipo = other.tipo; tecla = other.tecla; caracter = other.caracter; mods = other.mods; comando = other.comando; posicion = other.posicion;
        }

        public EventType rawType => tipo;
        public EventType type { get => tipo; set => tipo = value; }
        public KeyCode keyCode { get => tecla; set => tecla = value; }
        public char character { get => caracter; set => caracter = value; }
        public EventModifiers modifiers { get => mods; set => mods = value; }
        public string commandName { get => comando; set => comando = value ?? ""; }
        public Vector2 mousePosition { get => posicion; set => posicion = value; }
        public bool shift => (mods & EventModifiers.Shift) != 0;
        public bool control => (mods & EventModifiers.Control) != 0;
        public bool alt => (mods & EventModifiers.Alt) != 0;
        public bool command => (mods & EventModifiers.Command) != 0;
        public bool isKey => tipo == EventType.KeyDown || tipo == EventType.KeyUp;
        public bool isMouse => tipo == EventType.MouseDown || tipo == EventType.MouseUp || tipo == EventType.MouseMove || tipo == EventType.MouseDrag;
        public void Use() => tipo = EventType.Used;

        static readonly Queue<(EventType tipo, KeyCode tecla, char c, EventModifiers mods)> cola = new Queue<(EventType, KeyCode, char, EventModifiers)>();

        internal static void Encolar(EventType tipo, KeyCode tecla, char c)
        {
            // si nadie los lee (no hay un campo de texto con foco) no tienen que juntarse para siempre
            if (cola.Count > 256) cola.Dequeue();
            cola.Enqueue((tipo, tecla, c, Modificadores()));
        }

        static EventModifiers Modificadores()
        {
            var m = EventModifiers.None;
            var a = Entrada.abajo;
            if (a.Contains(KeyCode.LeftShift) || a.Contains(KeyCode.RightShift)) m |= EventModifiers.Shift;
            if (a.Contains(KeyCode.LeftControl) || a.Contains(KeyCode.RightControl)) m |= EventModifiers.Control;
            if (a.Contains(KeyCode.LeftAlt) || a.Contains(KeyCode.RightAlt)) m |= EventModifiers.Alt;
            if (a.Contains(KeyCode.LeftCommand) || a.Contains(KeyCode.RightCommand)) m |= EventModifiers.Command;
            return m;
        }

        public static bool PopEvent(Event outEvent)
        {
            if (cola.Count == 0 || outEvent == null) return false;
            var e = cola.Dequeue();
            outEvent.tipo = e.tipo; outEvent.tecla = e.tecla; outEvent.caracter = e.c; outEvent.mods = e.mods; outEvent.comando = "";
            return true;
        }

        public static int GetEventCount() => cola.Count;
    }
}
