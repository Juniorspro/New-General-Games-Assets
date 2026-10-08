#if UNITY_2022
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;

// Lo de la API de Unity 2022 que nombra tipos que en los juegos viejos no existen (y entonces no
// están en su esqueleto): sólo se compila con el perfil de un juego 2022 (UNITY_2022).
namespace UnityEngine.Rendering
{
    public sealed partial class GraphicsSettings
    {
        // sin pipeline programable: el de siempre, como el juego en PC
        public static RenderPipelineAsset currentRenderPipeline => null;
        public static BuiltinShaderMode GetShaderMode(BuiltinShaderType type) => BuiltinShaderMode.UseBuiltin;
    }
}

namespace UnityEngine
{
    public sealed partial class SystemInfo
    {
        public static CopyTextureSupport copyTextureSupport => CopyTextureSupport.Basic | CopyTextureSupport.RTToTexture;
        public static bool IsFormatSupported(GraphicsFormat format, FormatUsage usage) => true;
    }
}
#endif
