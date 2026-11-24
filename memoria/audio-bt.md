# Audio Bluetooth (24/11/2026)
Ver también: [maquina](maquina.md) para armar APKs.

## "Forzar bits, bitrate, kbps y códec" en auriculares SBC
- Lo pidió como APK. **No se armó**: desde una app no se puede, y una que
  "fuerce" sería humo. Se le explicó y se le pidió teléfono, Android y modelo
  de auriculares.
- Por qué (de lo que hace AOSP; **sin comprobar** en su teléfono):
  - El SBC de Android sale con 44,1 kHz, 16 bits, estéreo conjunto y bitpool
    ≤ 53 ≈ **328 kbps** (229 kbps si el auricular no tiene EDR). Ese tope está
    adentro del Bluetooth del sistema (`a2dp_sbc`, `a2dp_sbc_encoder`):
    ninguna API lo expone.
  - `BluetoothA2dp.setCodecConfigPreference` y `getCodecStatus` son API
    ocultas; **desde Android 13 piden `BLUETOOTH_PRIVILEGED`** (solo apps del
    sistema). Hasta Android 12 andaban por reflexión (las apps tipo "Codec
    Changer").
  - Cuenta SBC: kbps = 8 × largo_del_cuadro × fs / (subbandas × bloques). Con
    bitpool 53, estéreo conjunto, 8 subbandas y 16 bloques, el cuadro pesa
    119 bytes → 328 kbps. "SBC XQ" (canal dual, bitpool 38 por canal, 164
    bytes) → 452 kbps: solo con root parcheando el Bluetooth del sistema.
- Lo que sí sirve: Opciones de desarrollador → "Códec de audio Bluetooth" (ver
  si **AAC** aparece habilitado y probarlo), dejar el volumen absoluto como
  viene, no saturar con el ecualizador, fuente de buena calidad, buena señal.
