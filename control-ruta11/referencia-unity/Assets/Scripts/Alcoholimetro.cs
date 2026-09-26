// ════════════════════════════════════════════════════════════════════════
// Alcoholímetro: el conductor sopla y la barra sube de 0,0 a 2,5 g/l.
// Más de 0,5 g/l es positivo (conductor DETENIDO, vehículo retenido).
// ════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using UnityEngine;

namespace Ruta11
{
    public class Alcoholimetro : MonoBehaviour
    {
        public const float Limite = 0.5f, Maximo = 2.5f;
        [Tooltip("Cuánto dura el soplido")] public float duracion = 3.2f;
        public AudioSource pitido;

        public bool Midiendo { get; private set; }
        public float Valor { get; private set; }            // lo que marca la barra ahora
        public event Action<float, float> AlProgresar;        // (valor g/l, avance 0..1)
        public event Action<float, bool> AlTerminar;           // (resultado, positivo)

        public void Medir(DriverAI conductor)
        {
            if (Midiendo || conductor == null) return;
            StartCoroutine(Soplido(conductor));
        }

        IEnumerator Soplido(DriverAI conductor)
        {
            Midiendo = true; Valor = 0;
            float resultado = conductor.Soplar();
            // La barra sube rápido al principio y se asienta en el resultado; si el soplido
            // es flojo (borracho), tiembla más.
            for (float t = 0; t < duracion; t += Time.deltaTime)
            {
                float k = 1f - Mathf.Pow(1f - t / duracion, 3f);
                float ruido = Mathf.Sin(t * 23f) * 0.03f * (conductor.estado == EstadoConductor.Borracho ? 2f : 1f) * (1f - k);
                Valor = Mathf.Clamp(resultado * k + ruido, 0f, Maximo);
                AlProgresar?.Invoke(Valor, t / duracion);
                yield return null;
            }
            Valor = resultado;
            bool positivo = resultado > Limite;
            if (pitido != null) { pitido.pitch = positivo ? 0.6f : 1.4f; pitido.Play(); }
            AlProgresar?.Invoke(Valor, 1f);
            AlTerminar?.Invoke(resultado, positivo);
            Midiendo = false;
        }
    }
}
