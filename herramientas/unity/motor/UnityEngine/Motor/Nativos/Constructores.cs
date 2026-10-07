namespace UnityEngine
{
    // (al escribir a mano una parte de un tipo, la base la declara esta parte: el generador la omite)
    // Los constructores que usa el cargador para los assets que vienen de los archivos del juego
    // (los públicos de Unity piden datos que el cargador recién tiene después de crearlos).
    public partial class Material : Object { internal Material(bool desdeArchivo) { } }
    public partial class Texture2D : Texture { internal Texture2D(bool desdeArchivo) { } }
    public partial class Mesh : Object { internal Mesh(bool desdeArchivo) { } }
    public partial class TextAsset : Object { internal TextAsset(bool desdeArchivo) { } }
    public partial class AnimationClip : Motion { internal AnimationClip(bool desdeArchivo) { } }
    public partial class RenderTexture : Texture { internal RenderTexture(bool desdeArchivo) { } }
    public partial class Texture3D : Texture { internal Texture3D(bool desdeArchivo) { } }
    public partial class Font : Object { internal Font(bool desdeArchivo) { } }
    public partial class PhysicMaterial : Object { internal PhysicMaterial(bool desdeArchivo) { } }
    public partial class TerrainData : Object { internal TerrainData(bool desdeArchivo) { } }
    public partial class Sprite : Object { internal Sprite(bool desdeArchivo) { } }
}
