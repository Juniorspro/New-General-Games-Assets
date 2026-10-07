// porteo: Slime Rancher en el navegador (WebGL). Lo que el juego no sabe del navegador:
//  - las partidas se escriben en un disco en memoria (/idbfs) y hay que volcarlas a IndexedDB:
//    FileStorageProvider.Flush llama a GuardarDisco (lo agrega arreglar.py);
//  - WebAudio decodifica cada clip entero a float32 y Unity no lo suelta: la música (~2 h)
//    serían 3 GB. Se suelta la que ya no suena; SECTR la vuelve a cargar antes de tocarla;
//  - el navegador no avisa al cerrar la pestaña (no hay OnApplicationQuit): la página avisa
//    cuando se oculta y ahí se guarda.
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

public class Porteo : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
	[DllImport("__Internal")]
	private static extern void PorteoGuardarDisco();

	[DllImport("__Internal")]
	private static extern void PorteoListo();
#endif

	public static void GuardarDisco()
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		PorteoGuardarDisco();
#endif
	}

	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
	private static void Arrancar()
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		// el nombre lo usa la página: gameInstance.SendMessage("Porteo", ...)
		GameObject objeto = new GameObject("Porteo");
		DontDestroyOnLoad(objeto);
		objeto.AddComponent<Porteo>();
#endif
	}

	private void Start()
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		PorteoListo();  // la página saca la pantalla de carga
#endif
	}

	// ---- la música ----
	private const float LARGO = 45f;  // segundos: de acá para arriba es música o ambiente
	private const float CADA = 5f;
	private readonly HashSet<AudioClip> sonando = new HashSet<AudioClip>();
	private float proxima;

	private void Update()
	{
		if (Time.unscaledTime < proxima)
			return;
		proxima = Time.unscaledTime + CADA;
		sonando.Clear();
		foreach (AudioSource fuente in FindObjectsOfType<AudioSource>())
		{
			// time > 0 sin isPlaying: está en pausa y va a seguir desde ahí
			if (fuente.clip != null && (fuente.isPlaying || fuente.time > 0f))
				sonando.Add(fuente.clip);
		}
		foreach (AudioClip clip in Resources.FindObjectsOfTypeAll<AudioClip>())
		{
			if (clip.length >= LARGO && clip.loadState == AudioDataLoadState.Loaded && !sonando.Contains(clip))
				clip.UnloadAudioData();
		}
	}

	// ---- la pestaña se ocultó (puede que no vuelva) ----
	public void AlOcultarse()
	{
		if (Levels.isSpecial() || SRSingleton<GameContext>.Instance == null)
			return;
		SRSingleton<GameContext>.Instance.AutoSaveDirector.SaveAllNow();
	}
}
