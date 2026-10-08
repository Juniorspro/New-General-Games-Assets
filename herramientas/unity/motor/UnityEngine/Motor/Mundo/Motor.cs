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
            // los RenderSettings de cada escena (niebla, ambiente, cielo): los usan los scripts aunque no se dibuje
            Datos.Ajustes.alCargarAjusteDeEscena += o =>
            {
                if (o is Datos.AjusteEscena a && a.Clase == 104 && a.crudo != null && a.archivo != null) UnityEngine.RenderSettings.Leer(a.crudo, a.archivo);
            };
            Fisica.Simulacion.Iniciar();
            Animacion.Animadores.Iniciar();
            Audio.Sonido.Iniciar();
            Entrada.Iniciar();
            UI.Lienzos.Iniciar();
            // lo que se puede pedir en cualquier momento (Resources.Load, Shader.Find) se trae antes
            // de empezar; la primera escena se arma en el primer cuadro, cuando están sus datos
            Mundo.Arranque = new Datos.Espera(Datos.Alcance.Recursos(Datos.Ajustes.Siempre()));
            Escenas.Pedir(primera, LoadSceneMode.Single, false);
        }
    }
}
