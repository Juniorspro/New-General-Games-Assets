// porteo: el port de Android cambió la entrada de PC (SRInput: teclado, mouse y mando, con sus
// teclas de siempre) por botones y palancas de pantalla (TouchControlsKit). En el navegador
// vuelven las dos: TCKInput.GetAction y GetAxis (arreglar.py) preguntan también acá.
using InControl;
using TouchControlsKit;
using UnityEngine;

public static class PorteoEntrada
{
	// Los botones de pantalla, por el nombre que les dio el port, y su acción de PC.
	public static bool Accion(string boton, EActionEvent evento)
	{
		switch (boton)
		{
			case "Attack": return Estado(SRInput.Actions.attack, evento);          // clic izquierdo
			case "Vacum": return Estado(SRInput.Actions.vac, evento);              // clic derecho
			case "Burst": return Estado(SRInput.Actions.burst, evento);            // clic del medio, Q
			case "PrevSlot": return Estado(SRInput.Actions.prevSlot, evento);      // rueda
			case "NextSlot": return Estado(SRInput.Actions.nextSlot, evento);
			case "Gadget": return Estado(SRInput.Actions.toggleGadgetMode, evento); // T
			case "Interact": return Estado(SRInput.Actions.interact, evento);      // E
			case "Jump": return Estado(SRInput.Actions.jump, evento);              // espacio
			case "Map": return Estado(SRInput.Actions.openMap, evento);            // M
			// Un solo botón de pausa hacía de Escape en todos lados: abrir el menú, cerrarlo y volver.
			case "Pause":
				return Estado(SRInput.Actions.menu, evento) || Estado(SRInput.PauseActions.unmenu, evento) ||
					Estado(SRInput.PauseActions.cancel, evento);
			default: return false;
		}
	}

	private static bool Estado(PlayerAction accion, EActionEvent evento)
	{
		if (accion == null)
			return false;
		switch (evento)
		{
			case EActionEvent.Press: return accion.IsPressed;
			case EActionEvent.Up: return accion.WasReleased;
			default: return accion.WasPressed;  // Down y Click
		}
	}

	// La palanca de moverse: WASD o el stick del mando se suman a la de pantalla.
	public static Vector2 Eje(string palanca, Vector2 tactil)
	{
		if (palanca != "Joystick")
			return tactil;
		Vector2 pc = new Vector2(SRInput.Actions.horizontal, SRInput.Actions.vertical);
		return Vector2.ClampMagnitude(tactil + pc, 1f);
	}

	// Los controles de pantalla sólo en pantallas táctiles: con mouse estorban y se comen clics.
	public static bool MostrarTactil()
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		return Input.touchSupported;
#else
		return true;
#endif
	}
}
