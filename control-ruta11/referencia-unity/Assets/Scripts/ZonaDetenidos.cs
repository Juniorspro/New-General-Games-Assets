// ════════════════════════════════════════════════════════════════════════
// Zona de Detenidos: el rectángulo pintado al costado del puesto. Cuando
// entra alguien esposado detrás del policía, queda ahí esperando el patrullero.
// ════════════════════════════════════════════════════════════════════════
using System.Collections.Generic;
using UnityEngine;

namespace Ruta11
{
    public class ZonaDetenidos : MonoBehaviour
    {
        public Vector3 tamanio = new Vector3(6f, 3f, 4f);
        readonly List<Vector3> ocupados = new List<Vector3>();
        float chequeo;

        public bool Contiene(Vector3 p)
        {
            Vector3 l = transform.InverseTransformPoint(p);
            return Mathf.Abs(l.x) <= tamanio.x / 2 && Mathf.Abs(l.z) <= tamanio.z / 2;
        }

        // Lugares en fila, contra el banco del fondo.
        public Vector3 LugarLibre()
        {
            int i = ocupados.Count;
            var p = transform.TransformPoint(new Vector3(-tamanio.x / 2 + 0.8f + (i % 6) * 0.9f, 0, tamanio.z / 2 - 0.8f - (i / 6) * 1.0f));
            ocupados.Add(p);
            return p;
        }

        void Update()
        {
            chequeo -= Time.deltaTime;
            if (chequeo > 0) return;
            chequeo = 0.3f;
            var gestor = PoliceCheckpointManager.Instancia;
            if (gestor == null) return;
            foreach (var d in FindObjectsOfType<DriverAI>())
                if (d.modo == ModoConductor.Siguiendo && Contiene(d.transform.position)) gestor.EntroAZona(d);
        }

        void OnDrawGizmos()
        {
            Gizmos.color = new Color(1f, 0.85f, 0.1f, 0.35f);
            Gizmos.matrix = transform.localToWorldMatrix;
            Gizmos.DrawCube(Vector3.up * tamanio.y / 2, tamanio);
        }
    }
}
