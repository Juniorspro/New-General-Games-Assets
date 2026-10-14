// Reemplazo mínimo de la API de Unity SOLO para compilar los scripts con mcs
// fuera de Unity y atrapar errores de tipos. No va dentro del proyecto.
//   mcs -target:library -out:/tmp/r11.dll herramientas/UnityStubs.cs Unity/Assets/Scripts/*.cs
#pragma warning disable 0067, 0649, 0169, 0414
using System;
using System.Collections;
namespace UnityEngine
{
    public class Object { public string name; public static void Destroy(Object o) { } public static void Destroy(Object o, float t) { } public static T FindObjectOfType<T>() where T : Object => null; public static T[] FindObjectsOfType<T>() where T : Object => new T[0]; public static implicit operator bool(Object o) => o != null; }
    public class Component : Object { public Transform transform; public GameObject gameObject; public T GetComponent<T>() => default; public T GetComponentInChildren<T>() => default; public T GetComponentInParent<T>() => default; }
    public class Behaviour : Component { public bool enabled; }
    public class Coroutine { }
    public class YieldInstruction { }
    public class WaitForSeconds : YieldInstruction { public WaitForSeconds(float s) { } }
    public class MonoBehaviour : Behaviour { public Coroutine StartCoroutine(IEnumerator e) => null; public void StopCoroutine(Coroutine c) { } public void Invoke(string m, float t) { } public void CancelInvoke(string m) { } }
    public enum PrimitiveType { Sphere, Capsule, Cylinder, Cube, Plane, Quad }
    public class GameObject : Object { public GameObject() { } public GameObject(string n) { } public GameObject(string n, params Type[] c) { } public Transform transform; public string tag; public bool activeSelf; public T AddComponent<T>() where T : Component => default; public T GetComponent<T>() => default; public void SetActive(bool v) { } public static GameObject CreatePrimitive(PrimitiveType t) => null; }
    public struct Matrix4x4 { }
    public class Transform : Component, IEnumerable
    {
        public Vector3 position, localPosition, localScale, forward, right, up; public Quaternion rotation, localRotation; public Transform parent; public int childCount; public Matrix4x4 localToWorldMatrix;
        public void SetParent(Transform p) { } public void SetParent(Transform p, bool w) { } public void Rotate(float x, float y, float z) { }
        public Vector3 InverseTransformPoint(Vector3 p) => p; public Vector3 TransformPoint(Vector3 p) => p; public Vector3 InverseTransformDirection(Vector3 d) => d;
        public Transform GetChild(int i) => null; public void SetAsFirstSibling() { } public void SetAsLastSibling() { } public IEnumerator GetEnumerator() => null;
    }
    public struct Rect { public float width, height; }
    public class RectTransform : Transform { public Vector2 anchorMin, anchorMax, offsetMin, offsetMax, sizeDelta; public Rect rect; }
    public struct Vector2
    {
        public float x, y; public Vector2(float x, float y) { this.x = x; this.y = y; } public static Vector2 zero; public float magnitude => 0;
        public static Vector2 ClampMagnitude(Vector2 v, float m) => v; public static Vector2 operator +(Vector2 a, Vector2 b) => a; public static Vector2 operator *(Vector2 a, float b) => a;
    }
    public struct Vector3
    {
        public float x, y, z; public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public static Vector3 zero, one, up, forward, right; public float magnitude => 0; public float sqrMagnitude => 0; public Vector3 normalized => this;
        public static float Distance(Vector3 a, Vector3 b) => 0; public static Vector3 ProjectOnPlane(Vector3 v, Vector3 n) => v;
        public static Vector3 operator +(Vector3 a, Vector3 b) => a; public static Vector3 operator -(Vector3 a, Vector3 b) => a; public static Vector3 operator -(Vector3 a) => a;
        public static Vector3 operator *(Vector3 a, float b) => a; public static Vector3 operator *(float b, Vector3 a) => a; public static Vector3 operator /(Vector3 a, float b) => a;
    }
    public struct Quaternion { public static Quaternion identity; public static Quaternion Euler(float x, float y, float z) => identity; public static Quaternion LookRotation(Vector3 f) => identity; public static Quaternion Slerp(Quaternion a, Quaternion b, float t) => a; public static Quaternion operator *(Quaternion a, Quaternion b) => a; }
    public struct Color
    {
        public float r, g, b, a; public Color(float r, float g, float b) { this.r = r; this.g = g; this.b = b; a = 1; } public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public static Color white, black, gray; public static Color Lerp(Color a, Color b, float t) => a; public static Color HSVToRGB(float h, float s, float v) => white; public static Color operator *(Color c, float f) => c;
    }
    public static class Mathf
    {
        public const float PI = 3.14159f; public static float Clamp(float v, float a, float b) => v; public static int Clamp(int v, int a, int b) => v; public static float Clamp01(float v) => v; public static float Abs(float v) => v;
        public static float Sin(float v) => v; public static float Sqrt(float v) => v; public static float PerlinNoise(float x, float y) => 0; public static float Repeat(float t, float l) => t; public static float PingPong(float t, float l) => t;
        public static float Lerp(float a, float b, float t) => a; public static float Min(float a, float b) => a; public static float Max(float a, float b) => a; public static float Pow(float a, float b) => a; public static int FloorToInt(float v) => 0;
    }
    public static class Time { public static float deltaTime, time; }
    public enum KeyCode { E, F, R, Q, B, Tab, Escape, LeftShift }
    public static class Input { public static bool GetKeyDown(KeyCode k) => false; public static bool GetKey(KeyCode k) => false; public static float GetAxis(string n) => 0; public static float GetAxisRaw(string n) => 0; public static bool GetMouseButtonDown(int b) => false; }
    public enum CursorLockMode { None, Locked, Confined }
    public static class Cursor { public static CursorLockMode lockState; }
    public static class Application { public static bool isMobilePlatform; }
    public class Camera : Behaviour { public float nearClipPlane, farClipPlane; }
    public enum LightType { Spot, Directional, Point }
    public enum LightShadows { None, Hard, Soft }
    public class Light : Behaviour { public LightType type; public float range, spotAngle, intensity; public Color color; public LightShadows shadows; }
    public class Shader : Object { public static Shader Find(string n) => null; }
    public class Texture : Object { }
    public enum TextureFormat { RGBA32 }
    public enum FilterMode { Point, Bilinear }
    public enum TextureWrapMode { Repeat, Clamp }
    public class Texture2D : Texture { public Texture2D(int w, int h, TextureFormat f, bool m) { } public FilterMode filterMode; public TextureWrapMode wrapMode; public void SetPixels(Color[] c) { } public void Apply() { } }
    public class Material : Object { public Material(Shader s) { } public Material(Material m) { } public Color color; public Texture mainTexture; public Shader shader; }
    public class Renderer : Component { public Material material; }
    public class Collider : Component { }
    public class CharacterController : Collider { public float height, radius; public Vector3 center; public bool isGrounded; public void Move(Vector3 m) { } }
    public class AudioClip : Object { public static AudioClip Create(string n, int l, int c, int f, bool s) => null; public bool SetData(float[] d, int o) => true; }
    public class AudioSource : Behaviour { public AudioClip clip; public float pitch, spatialBlend, maxDistance; public void Play() { } }
    public class Font : Object { }
    public static class Resources { public static T GetBuiltinResource<T>(string p) where T : Object => null; }
    public enum TextAnchor { UpperLeft, UpperCenter, MiddleLeft, MiddleCenter, MiddleRight, LowerLeft }
    public enum HorizontalWrapMode { Wrap, Overflow }
    public enum VerticalWrapMode { Truncate, Overflow }
    public class TextMesh : Component { public string text; public float characterSize; public int fontSize; public TextAnchor anchor; public Color color; }
    public enum FogMode { Linear, Exponential }
    public static class RenderSettings { public static float ambientIntensity, fogStartDistance, fogEndDistance; public static Rendering.AmbientMode ambientMode; public static Color ambientSkyColor, ambientEquatorColor, ambientGroundColor, fogColor; public static bool fog; public static FogMode fogMode; }
    public static class Gizmos { public static Color color; public static Matrix4x4 matrix; public static void DrawCube(Vector3 c, Vector3 s) { } }
    public enum RenderMode { ScreenSpaceOverlay }
    public class Canvas : Behaviour { public RenderMode renderMode; }
    public static class RectTransformUtility { public static bool ScreenPointToLocalPointInRectangle(RectTransform r, Vector2 p, Camera c, out Vector2 l) { l = default; return true; } }
    public class HeaderAttribute : Attribute { public HeaderAttribute(string s) { } }
    public class TooltipAttribute : Attribute { public TooltipAttribute(string s) { } }
    public class HideInInspector : Attribute { }
    public class RequireComponent : Attribute { public RequireComponent(Type t) { } }
}
namespace UnityEngine.Rendering { public enum AmbientMode { Skybox, Trilight, Flat } }
namespace UnityEngine.Events { public delegate void UnityAction(); public class UnityEvent { public void AddListener(UnityAction a) { } } }
namespace UnityEngine.SceneManagement { public struct Scene { public int buildIndex; } public static class SceneManager { public static void LoadScene(int i) { } public static Scene GetActiveScene() => default; } }
namespace UnityEngine.EventSystems
{
    public class EventSystem : MonoBehaviour { }
    public class StandaloneInputModule : MonoBehaviour { }
    public class PointerEventData { public Vector2 position, delta; public Camera pressEventCamera; }
    public interface IPointerDownHandler { void OnPointerDown(PointerEventData e); }
    public interface IPointerUpHandler { void OnPointerUp(PointerEventData e); }
    public interface IDragHandler { void OnDrag(PointerEventData e); }
}
namespace UnityEngine.UI
{
    public class CanvasScaler : MonoBehaviour { public enum ScaleMode { ConstantPixelSize, ScaleWithScreenSize } public ScaleMode uiScaleMode; public Vector2 referenceResolution; public float matchWidthOrHeight; }
    public class GraphicRaycaster : MonoBehaviour { }
    public class Graphic : MonoBehaviour { public Color color; public bool raycastTarget; }
    public class Image : Graphic { }
    public class RawImage : Graphic { public Texture texture; }
    public class Text : Graphic { public Font font; public string text; public int fontSize; public TextAnchor alignment; public bool supportRichText; public HorizontalWrapMode horizontalOverflow; public VerticalWrapMode verticalOverflow; }
    public class Shadow : MonoBehaviour { }
    public class Selectable : MonoBehaviour { public Graphic targetGraphic; }
    public class Button : Selectable { public class ButtonClickedEvent : Events.UnityEvent { } public ButtonClickedEvent onClick; }
    public class InputField : Selectable { public string text; public Text textComponent; public Graphic placeholder; }
    public class Toggle : Selectable { public bool isOn; public Graphic graphic; }
}
