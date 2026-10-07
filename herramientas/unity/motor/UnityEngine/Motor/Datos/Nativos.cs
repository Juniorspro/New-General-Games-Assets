using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Porteo.Datos
{
    // Las clases nativas de Unity por su número de clase (el classID de los archivos serializados).
    public static class Nativos
    {
        static readonly Dictionary<int, Func<Object>> fabricas = new Dictionary<int, Func<Object>>
        {
            [1] = () => new GameObject(true),
            [4] = () => new Transform(),
            [20] = () => new Camera(),
            [21] = () => new Material(true),
            [23] = () => new MeshRenderer(),
            [28] = () => new Texture2D(true),
            [29] = () => new AjusteEscena(29),
            [33] = () => new MeshFilter(),
            [43] = () => new Mesh(true),
            [48] = () => new Shader(),
            [49] = () => new TextAsset(true),
            [54] = () => new Rigidbody(),
            [59] = () => new HingeJoint(),
            [64] = () => new MeshCollider(),
            [65] = () => new BoxCollider(),
            [74] = () => new AnimationClip(true),
            [81] = () => new AudioListener(),
            [82] = () => new AudioSource(),
            [83] = () => new AudioClip(),
            [84] = () => new RenderTexture(true),
            [89] = () => new Cubemap(true),
            [90] = () => new Avatar(),
            [91] = () => new RuntimeAnimatorController(),
            [92] = () => new GUILayer(),
            [95] = () => new Animator(),
            [96] = () => new TrailRenderer(),
            [104] = () => new AjusteEscena(104),
            [108] = () => new Light(),
            [109] = () => new TextAsset(true),
            [111] = () => new Animation(),
            [115] = () => new MonoScriptDatos(),
            [117] = () => new Texture3D(true),
            [119] = () => new Projector(),
            [121] = () => new Flare(),
            [123] = () => new LensFlare(),
            [124] = () => new FlareLayer(),
            [128] = () => new Font(true),
            [134] = () => new PhysicMaterial(true),
            [135] = () => new SphereCollider(),
            [136] = () => new CapsuleCollider(),
            [137] = () => new SkinnedMeshRenderer(),
            [138] = () => new FixedJoint(),
            [143] = () => new CharacterController(),
            [144] = () => new CharacterJoint(),
            [145] = () => new SpringJoint(),
            [153] = () => new ConfigurableJoint(),
            [154] = () => new TerrainCollider(),
            [156] = () => new TerrainData(true),
            [157] = () => new AjusteEscena(157),
            [196] = () => new AjusteEscena(196),
            [198] = () => new ParticleSystem(),
            [199] = () => new ParticleSystemRenderer(),
            [205] = () => new LODGroup(),
            [212] = () => new SpriteRenderer(),
            [213] = () => new Sprite(true),
            [215] = () => new ReflectionProbe(),
            [218] = () => new Terrain(),
            [221] = () => new AnimatorOverrideController(true),
            [222] = () => new CanvasRenderer(),
            [223] = () => new Canvas(),
            [224] = () => new RectTransform(),
            [225] = () => new CanvasGroup(),
            [258] = () => new LightProbes(),
        };

        public static Object Crear(int clase) => fabricas.TryGetValue(clase, out var f) ? f() : null;

        public static void Registrar(int clase, Func<Object> f) => fabricas[clase] = f;
    }

    // RenderSettings, LightmapSettings, OcclusionCullingSettings, NavMeshSettings de una escena
    public sealed class AjusteEscena : Object
    {
        public readonly int Clase;
        public AjusteEscena(int clase) { Clase = clase; }
    }

    // MonoScript: el script de un MonoBehaviour (sólo interesa el nombre y el orden)
    public sealed class MonoScriptDatos : Object { }

    // Lo que Unity trae de fábrica ("unity default resources"): Arial, las mallas primitivas...
    public static class Integrados
    {
        public static Object Buscar(Type tipo, string ruta)
        {
            var a = Cargador.Archivo("unity default resources");
            if (a == null || ruta == null) return null;
            var nombre = ruta;
            int p = nombre.LastIndexOf('.');
            if (p > 0) nombre = nombre.Substring(0, p);
            foreach (var pid in a.Paq.Orden)
            {
                var m = a.Datos(pid);
                if (m == null || !string.Equals(m.S("m_Name"), nombre, StringComparison.OrdinalIgnoreCase)) continue;
                var o = a.Objeto(pid);
                if (o != null && tipo.IsInstanceOfType(o)) return o;
            }
            return null;
        }
    }
}

namespace UnityEngine
{
    // Tipos nativos que el juego no nombra pero que están en sus escenas: existen para que
    // GetComponents los encuentre y la jerarquía sea la misma que en Unity.
    public sealed partial class GUILayer : Behaviour { }
    public sealed partial class FlareLayer : Behaviour { }
    public sealed partial class LensFlare : Behaviour { }
    public sealed partial class Flare : Object { }
    public sealed partial class HingeJoint : Joint { }
    public sealed partial class CharacterJoint : Joint { }
    public partial class LODGroup : Component { }
    public sealed partial class TerrainCollider : Collider { }
    public sealed partial class Avatar : Object { }
    public sealed partial class LightProbes : Object { }
    public partial class RuntimeAnimatorController : Object { }
    public partial class AnimatorOverrideController : RuntimeAnimatorController
    {
        internal AnimatorOverrideController(bool desdeArchivo) { }
    }
    public sealed partial class Cubemap : Texture
    {
        internal Cubemap(bool desdeArchivo) { }
    }
}
