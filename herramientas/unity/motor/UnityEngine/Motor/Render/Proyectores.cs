using System;
using System.Collections.Generic;
using Porteo;
using Porteo.Datos;
using Porteo.Render;
using UnityEngine;
using Object = UnityEngine.Object;

namespace UnityEngine
{
    // Un proyector (las manchas de los slimes): su material se dibuja otra vez sobre cada objeto
    // visible que cae dentro de su volumen, con las matrices que arma Unity para el shader.
    public sealed partial class Projector : Behaviour
    {
        internal float cerca = 0.1f, lejos = 100f, fov = 60f, aspecto = 1f, tamOrto = 10f;
        internal bool orto;
        internal Material mat;
        internal int ignorar;

        internal override void LeerNativo(Mapa m, IResolutor r)
        {
            cerca = m.F("m_NearClipPlane", 0.1f);
            lejos = m.F("m_FarClipPlane", 100f);
            fov = m.F("m_FieldOfView", 60f);
            aspecto = m.F("m_AspectRatio", 1f);
            orto = m.B("m_Orthographic");
            tamOrto = m.F("m_OrthographicSize", 10f);
            mat = r.Resolver(m.P("m_Material")) as Material;
            ignorar = (int)(uint)(m.M("m_IgnoreLayers")?.I("m_Bits", 0) ?? 0);
        }

        internal override void CopiarDe(Object o, Func<Object, Object> remap)
        {
            base.CopiarDe(o, remap);
            var p = (Projector)o;
            cerca = p.cerca; lejos = p.lejos; fov = p.fov; aspecto = p.aspecto; orto = p.orto; tamOrto = p.tamOrto; mat = p.mat; ignorar = p.ignorar;
        }

        internal override void AlActivarse() => Proyectores.activos.Add(this);
        internal override void AlDesactivarse() => Proyectores.activos.Remove(this);
        internal override void AlDestruirse() => Proyectores.activos.Remove(this);

        public float nearClipPlane { get => cerca; set => cerca = value; }
        public float farClipPlane { get => lejos; set => lejos = value; }
        public float fieldOfView { get => fov; set => fov = value; }
        public float aspectRatio { get => aspecto; set => aspecto = value; }
        public bool orthographic { get => orto; set => orto = value; }
        public float orthographicSize { get => tamOrto; set => tamOrto = value; }
        public int ignoreLayers { get => ignorar; set => ignorar = value; }
        public Material material { get => mat; set => mat = value; }

        // Como Projector.cpp de Unity: el proyector mira hacia +z de su Transform (sin la escala);
        //  - mundoAClip: el volumen del proyector (para descartar objetos);
        //  - textura: de -1..1 a 0..1 en x/y (unity_Projector, por la matriz del objeto);
        //  - recorte: x es la distancia a lo largo del proyector sobre el plano lejano (unity_ProjectorClip).
        internal void Matrices(out Matrix4x4 mundoAClip, out Matrix4x4 textura, out Matrix4x4 recorte)
        {
            var t = transform;
            var w2l = Matrix4x4.TRS(t.position, t.rotation, Vector3.one).inverse;
            var proy = orto
                ? Matrix4x4.Ortho(-tamOrto * aspecto, tamOrto * aspecto, -tamOrto, tamOrto, cerca, lejos)
                : Matrix4x4.Perspective(fov, aspecto, cerca, lejos);
            mundoAClip = proy * Matrix4x4.Scale(new Vector3(1, 1, -1)) * w2l;
            var escala = Matrix4x4.identity;
            escala.m00 = 0.5f; escala.m11 = 0.5f; escala.m03 = 0.5f; escala.m13 = 0.5f;
            textura = escala * mundoAClip;
            var r = default(Matrix4x4);
            r.m02 = lejos != 0 ? 1f / lejos : 0;
            r.m33 = 1;
            recorte = r * w2l;
        }
    }
}

namespace Porteo.Render
{
    public static class Proyectores
    {
        internal static readonly List<Projector> activos = new List<Projector>();
    }
}

namespace UnityEngine
{
    // Las sondas de reflejo en tiempo real: por ahora el reflejo es el del cielo de la escena
    // (RenderSettings); RenderProbe responde como Unity para los scripts que la refrescan.
    public sealed partial class ReflectionProbe : Behaviour
    {
        static int siguienteRender = 1;
        public int RenderProbe() => siguienteRender++;
        public int RenderProbe(RenderTexture targetTexture) => siguienteRender++;
        public bool IsFinishedRendering(int renderId) => true;
    }
}
