# Código de Android compartido

Lo usan las dos apps (`estudio-papuchon/android` y `miniaturas/android`); cada
`armar.sh` lo compila junto con su `Principal.java`.

- `PuenteBase.java`: lo que la página le pide a Android por
  `window.AndroidPapuchon`: descargar a Descargas/Papuchon (MediaStore en
  Android 10+, carpeta pública con permiso antes), con aviso de "Descarga
  completa" que abre el archivo; compartir; abrir links; `trabajo(...)`.
- `Trabajo.java`: servicio en primer plano (tipo `dataSync`) con aviso de
  progreso y WakeLock parcial (tope 3 h), mientras se exporta o se crea. Sin
  esto Android duerme o mata la app al salir o apagar la pantalla.

Cada app declara en su manifiesto el servicio `ar.papuchon.comun.Trabajo` y los
permisos FOREGROUND_SERVICE, FOREGROUND_SERVICE_DATA_SYNC, WAKE_LOCK,
POST_NOTIFICATIONS y WRITE_EXTERNAL_STORAGE (maxSdk 28).
