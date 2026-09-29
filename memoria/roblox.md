# Roblox Studio

Quiere hacer juegos en Roblox Studio (29/09/2026). El traspaso completo para la sesión de su PC está en
`TRASPASO-ROBLOX.md` (en la raíz).

- **Studio va en su PC** (Windows 11), con Claude Code instalado ahí y manejado desde el celu con
  `/remote-control`. El MCP de Studio es local (stdio): `cmd.exe /c "cd /d %LOCALAPPDATA%\Roblox && .\mcp.bat"`,
  y se agrega con `claude mcp add --scope user Roblox_Studio -- …`.
- **Instalar Claude Code en su PC:** anduvo `powershell -ExecutionPolicy Bypass -Command "irm
  https://claude.ai/install.ps1 | iex"`. El de CMD no. Tarda sin mostrar nada en "launcher and shell integration".
  - Queda en `%USERPROFILE%\.local\bin`, afuera del PATH: se agrega al PATH del usuario con
    `[Environment]::SetEnvironmentVariable`.
- **En el contenedor de la nube no sirve:**
  - Wine 9 (apt) con Xvfb corre el instalador oficial (`setup.rbxcdn.com/RobloxStudioInstaller.exe`) y Studio
    abre en llvmpipe.
  - Pero el inicio rápido da "no pudimos hacer coincidir tu ubicación": exige la misma red. No saltearlo, y no
    pedir contraseña ni la cookie.
  - Tampoco sirve como conector de claude.ai, porque no tiene URL.
- **Trampa del contenedor:** `pkill -f` con el nombre del programa en la misma línea mata al propio shell (el
  comando lo contiene). Se hace desde un script aparte.
- El 29/09 pegó un token de Kaggle en el chat: se le dijo que lo regenere. No se usó.
