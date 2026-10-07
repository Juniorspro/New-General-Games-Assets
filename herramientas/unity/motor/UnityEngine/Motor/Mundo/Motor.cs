using UnityEngine.SceneManagement;

namespace Porteo
{
    // El arranque: los ajustes del proyecto y la primera escena del build (como Unity, antes del
    // primer cuadro: Awake y OnEnable ya corrieron cuando empieza el bucle).
    public static class Motor
    {
        public static void Iniciar(string[] escenasBuild, int primera = 0)
        {
            Escenas.Iniciar(escenasBuild);
            Datos.Ajustes.Cargar();
            Escenas.CargarAhora(primera, LoadSceneMode.Single);
        }
    }
}
