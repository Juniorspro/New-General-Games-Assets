using UnityEngine;

namespace Porteo
{
    // GameObject.CreatePrimitive: la malla integrada de Unity, un MeshRenderer con el material
    // por defecto y el colisionador que le corresponde (el cilindro usa una cápsula, como en Unity).
    public static class Primitivas
    {
        public static void Armar(GameObject go, PrimitiveType tipo)
        {
            string malla = tipo switch
            {
                PrimitiveType.Sphere => "Sphere.fbx",
                PrimitiveType.Capsule => "Capsule.fbx",
                PrimitiveType.Cylinder => "Cylinder.fbx",
                PrimitiveType.Plane => "Plane.fbx",
                PrimitiveType.Quad => "Quad.fbx",
                _ => "Cube.fbx",
            };
            var mf = go.AddComponent<MeshFilter>();
            mf.sharedMesh = Datos.Integrados.Buscar(typeof(Mesh), malla) as Mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = Datos.Integrados.Buscar(typeof(Material), "Default-Material") as Material;
            switch (tipo)
            {
                case PrimitiveType.Sphere: go.AddComponent<SphereCollider>(); break;
                case PrimitiveType.Capsule: case PrimitiveType.Cylinder: go.AddComponent<CapsuleCollider>(); break;
                case PrimitiveType.Cube: go.AddComponent<BoxCollider>(); break;
                default: go.AddComponent<MeshCollider>(); break;   // toma sola la malla del MeshFilter
            }
        }
    }
}
