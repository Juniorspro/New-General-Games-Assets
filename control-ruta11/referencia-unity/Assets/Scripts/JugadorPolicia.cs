// ════════════════════════════════════════════════════════════════════════
// JugadorPolicia: primera persona. WASD + mouse en PC; palanca y botones en
// Android (los botones llaman a los mismos métodos públicos).
// Teclas: E papeles · F linterna / revisar baúl · R esposas · Q patrullero ·
//         B alcoholímetro · Tab tablet · Shift correr · Esc soltar el mouse
// ════════════════════════════════════════════════════════════════════════
using UnityEngine;

namespace Ruta11
{
    [RequireComponent(typeof(CharacterController))]
    public class JugadorPolicia : MonoBehaviour
    {
        public Camera camara;
        public Light linterna;
        public float velocidad = 3.2f, velocidadCorrer = 5.5f, sensibilidad = 2.2f, sensibilidadTactil = 0.18f;

        [HideInInspector] public Vector2 movimientoTactil;   // lo escribe la palanca virtual
        [HideInInspector] public Vector2 miradaTactil;       // lo escribe el arrastre del dedo
        public bool UIAbierta { get; set; }                   // con la tablet abierta no se mueve la cámara

        CharacterController cc;
        float pitch, vy;
        PoliceCheckpointManager gestor;

        void Start()
        {
            cc = GetComponent<CharacterController>();
            gestor = PoliceCheckpointManager.Instancia;
            if (linterna) linterna.enabled = false;
            if (!Application.isMobilePlatform) Cursor.lockState = CursorLockMode.Locked;
        }

        void Update()
        {
            Mirar();
            Mover();
            if (UIAbierta) return;
            if (Input.GetKeyDown(KeyCode.E)) PedirPapeles();
            if (Input.GetKeyDown(KeyCode.F)) Linterna();
            if (Input.GetKeyDown(KeyCode.R)) Esposar();
            if (Input.GetKeyDown(KeyCode.Q)) LlamarPatrullero();
            if (Input.GetKeyDown(KeyCode.B)) Alcoholimetro();
            if (Input.GetKeyDown(KeyCode.Escape)) Cursor.lockState = CursorLockMode.None;
            if (Input.GetMouseButtonDown(0) && !Application.isMobilePlatform) Cursor.lockState = CursorLockMode.Locked;
        }

        void Mirar()
        {
            Vector2 d = miradaTactil * sensibilidadTactil; miradaTactil = Vector2.zero;
            if (!UIAbierta && Cursor.lockState == CursorLockMode.Locked) d += new Vector2(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y")) * sensibilidad;
            transform.Rotate(0, d.x, 0);
            pitch = Mathf.Clamp(pitch - d.y, -80f, 80f);
            camara.transform.localRotation = Quaternion.Euler(pitch, 0, 0);
        }

        void Mover()
        {
            Vector2 m = movimientoTactil;
            if (!UIAbierta) m += new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            m = Vector2.ClampMagnitude(m, 1f);
            float v = Input.GetKey(KeyCode.LeftShift) || movimientoTactil.magnitude > 0.95f ? velocidadCorrer : velocidad;
            Vector3 mov = (transform.right * m.x + transform.forward * m.y) * v;
            vy = cc.isGrounded ? -1f : vy - 20f * Time.deltaTime;
            mov.y = vy;
            cc.Move(mov * Time.deltaTime);
        }

        // ── acciones (también para los botones táctiles) ──
        public void PedirPapeles() => gestor.PedirPapeles();
        public void Esposar() => gestor.Esposar();
        public void LlamarPatrullero() => gestor.LlamarPatrullero();
        public void Alcoholimetro() => gestor.UsarAlcoholimetro();
        public void Linterna()
        {
            var v = gestor.VehiculoActual;
            bool atras = v != null && Vector3.Distance(transform.position, v.PuntoBaul()) < gestor.distanciaInteraccion;
            if (atras) { if (linterna && gestor.EsDeNoche) linterna.enabled = true; gestor.InspeccionarBaul(linterna && linterna.enabled); }
            else if (linterna) linterna.enabled = !linterna.enabled;
        }
        public bool LinternaPrendida => linterna && linterna.enabled;
    }
}
