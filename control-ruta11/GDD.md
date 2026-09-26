# CONTROL POLICIAL: RUTA 11 — Documento de diseño

Simulador en primera persona de un puesto caminero sobre la Ruta Nacional 11,
en Presidencia Roca (Chaco). Se juega en el navegador, en PC y en el celular
(`index.html` + `js/`; descarga de un solo archivo con
`herramientas/descargable/empaquetar.py`). Los scripts C# de
`referencia-unity/` son la misma lógica escrita para Unity, como referencia
de trabajo. El juego que vale es el de HTML.

Es ficción: la fuerza se llama "Policía Caminera", sin escudo oficial, y las
personas y los casos son inventados.

## 1. GDD en tabla

| Área | Diseño | Dónde está |
|---|---|---|
| Género | Simulador de inspección en 3D, en primera persona. Low-poly realista ("tipo Roblox, pero serio") | todo |
| Objetivo | Inspeccionar cada vehículo y decidir: **dejar pasar, multar, retener o arrestar**. Terminar el turno con la mejor reputación | `juego.js` |
| Escenario | Ruta 11 con monte chaqueño (quebrachos y algarrobos), garita blanca, motos azules, patrullero con balizas, conos, cebrado blanco, lomo de burro, luminarias LED, postes de luz con cables, Zona de Detenidos y playa de secuestro | `mundo.js` |
| Turnos | Día 09–17, **Tarde 17–01** (atardecer real de fin de septiembre: sol a las 19:25), Noche 21–05. Duración: 10, 16 o 24 min. 8, 12 o 16 vehículos | `base.js`, `mundo.js` |
| Tránsito | Hasta 3 vehículos en fila por la mano derecha; frenan en el lomo de burro y ante el policía. Por la otra mano pasa tránsito que no para. Los conos se abren cuando sale un auto | `juego.js` |
| Vehículos | Toyota Hilux, Ford Ranger, Renault 12, Fiat Siena, Chevrolet Prisma, VW Gol, Peugeot 206, Mercedes-Benz 1114 y Honda Wave. 9 colores (el shader tiñe solo la chapa). Faros siempre prendidos (luz baja obligatoria en ruta). Patente vieja (negra) o Mercosur | `generador.js`, `modelos.js` |
| Mecánica 1: Documentos | [E] en la ventanilla. Se piden **DNI, licencia, cédula verde y seguro**. Hay que comparar: patente de la cédula contra la del vehículo, vencimientos contra la fecha de hoy, foto del DNI contra la cara del conductor, clase de licencia contra el vehículo | `ui.js` (Documentos) |
| Mecánica 2: Alcoholímetro | Barra de 0,0 a 2,5 g/l con marca en 0,5. Más de 0,5: positivo (retención y conductor demorado). El borracho tiene **ojos rojos**, cachetes colorados, se hamaca y habla **arrastrado** ("eshtá bien, oficial… *hip*") | `ui.js` (Alcoholímetro), `generador.js` |
| Mecánica 3: Faltas | **Leves → multa**: sin cinturón (o sin casco), luces quemadas, sin seguro vigente, licencia vencida hace menos de un año. **Graves → retener**: alcohol, licencia vencida hace más de un año, sin cédula, sin licencia para ese vehículo | `generador.js` (FALTAS) |
| Mecánica 4: Arresto | Delitos: pedido de captura, drogas, armas, DNI adulterado, vehículo con pedido de secuestro. El conductor baja, se lo **esposa con [R]**, se lo lleva a la **Zona de Detenidos** y se pide el **patrullero con [Q]**, que viene con sirena, los sube y se va | `juego.js` |
| Mecánica 5: Sospechosos (30 %) | **Nerviosos**: tiemblan, esquivan la mirada (más cuando la pregunta los compromete), transpiran y cambian la historia. **Identidad falsa**: el nombre del DNI no es el que el sistema tiene para ese número y la foto se parece pero no es; al preguntarle el nombre se le escapa el verdadero. **Baúl**: [F] con la linterna; droga o armas, muchas veces **escondidas abajo de todo**. Algunos nerviosos no esconden nada | `generador.js`, `ui.js` (Retrato, Baúl) |
| Radio | La central avisa de vehículos robados y pedidos de captura (a veces antes de que lleguen) y agrega charla de fondo. Todo queda en Novedades | `juego.js` |
| Puntaje | Pasar bien +25 · Multa exacta +25 (parcial si falta un cargo, −10 por cargo injusto) · Retener bien +50 · Arrestar bien +100 · Hallazgo +15 · Detenido en la zona +10 · Trasladado +10 · Dejar ir un delito −80 · Retener en vez de arrestar −50 · Retener sin falta grave −40 · Otros errores −30 · **Arrestar a un inocente −100** | `juego.js` (evaluar) |
| Derrota | Reputación bajo cero: "Te relevaron del puesto" | `juego.js` |
| Resumen | Calificación (Agente en prueba → Comisario de Caminera), aciertos, recaudado y la tabla de cada vehículo con la decisión correcta y las faltas reales (y el nombre verdadero de los que mentían) | `ui.js` (Resumen) |
| Controles PC | WASD, Shift corre, mouse para mirar (clic lo captura; si no se puede, se arrastra), E, F, R, Q, Esc/P | `juego.js` |
| Controles celular | Palanca a la izquierda, arrastrar para mirar, botones de acción según dónde estés, linterna, patrullero, pausa | `ui.js` (Tactil) |
| Sonido | Todo sintetizado: chicharras de tarde, grillos de noche, motor del vehículo más cercano, radio, sirena, bips del alcoholímetro, esposas, baúl, puerta, impresora del acta y voces (murmullo con entonación; el borracho, grave y lento) | `sonido.js` |
| Rendimiento | ~540 mil triángulos en calidad alta y ~400 mil en media (medido en la prueba). Solo dan sombra los árboles cercanos; la calidad baja saca los del fondo | `mundo.js` |

## 2. Diseño de la tablet policial

```
┌─────────────────────────────────────────────────────────────────┐
│ SISTEMA POLICIAL · CONSULTAS                            18:42   │
├───────────────┬─────────────────┬───────────────────────────────┤
│   Personas    │    Vehículos    │        Novedades (3)          │
├───────────────┴─────────────────┴───────────────────────────────┤
│ [ N.º de DNI ______________ ]  [BUSCAR]                         │
│ ┆Usar el DNI presentado (28.754.646)┆                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⚠ PEDIDO DE CAPTURA VIGENTE                (titila en rojo)  │ │
│ │ ┌──────┐  Nombre        GIMÉNEZ, ÁNGEL GABRIEL              │ │
│ │ │ foto │  DNI           28.754.646                          │ │
│ │ │ sist.│  Nacimiento    18/10/1976                          │ │
│ │ └──────┘  Antecedentes  Sin antecedentes                    │ │
│ │           Motivo        Robo calificado — Juzgado de …      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

- **Personas**: se busca el número de DNI. La ficha trae la **foto del
  sistema**, que es la que hay que comparar con la cara de la ventanilla y
  con la del DNI. Si el nombre de la ficha no es el del documento, el DNI es
  trucho.
- **Vehículos**: dos atajos, "patente del vehículo" y "patente de la cédula".
  Un robado aparece con la banda **PEDIDO DE SECUESTRO**, y la patente de su
  cédula no figura en el registro.
- **Novedades**: todo lo que dijo la radio en el turno, con la hora. Los
  avisos de búsqueda van marcados en rojo.
- A la izquierda de la ventana de inspección queda siempre el **retrato
  animado** del conductor (tiembla, esquiva la mirada, transpira o tiene los
  ojos rojos, y se ve si lleva el cinturón o el casco), con el diálogo y las
  seis preguntas.
- Las otras pestañas: **Documentos** (las cuatro tarjetas y la fecha de hoy;
  con ayudas, los días vencidos en rojo), **Alcoholímetro** y **Resolver**
  (cuatro decisiones, con los cargos del acta y su total en pesos).

## 3. Assets

Todo lo que se ve en 3D salió de **Rezona** (`herramientas/rezona/pedidos.json`,
35 pedidos, 6.030 créditos): imagen de referencia → modelo 3D → rig con
caminar y quieto para los personajes. Después pasan por `herramientas/gltf/`
(simplificación con meshoptimizer), `herramientas/procesar.py` (texturas a
JPEG) y `herramientas/armar_datos.py` (van adentro de `js/datos.js`, 6,2 MB).

| Asset | Origen | Triángulos |
|---|---|---|
| Pickup, sedán, compacto, hatch, camión, moto | Rezona | 4.000–7.000 |
| Patrullero, moto policial, garita | Rezona | 3.000–8.000 |
| Quebracho, algarrobo | Rezona | 2.500 / 2.360 |
| Conductor, conductora, policía (con caminar y quieto) | Rezona | 9.000 |
| Portada de la pantalla de carga | Rezona (imagen) | — |
| Caras de DNI, sistema y ventanilla | Dibujadas por código (`dibujarRostro`) | — |
| Cielo, asfalto, carteles, conos, patentes, sonido | Por código | — |

Para la versión de Unity (referencia), el equivalente gratuito del Asset Store
sería:

| Uso | Asset gratuito |
|---|---|
| Autos | "Low Poly Vehicles — Free" / "ARCADE: FREE Racing Car" |
| Personajes | "Low Poly Characters — Free" / "Mixamo" (animaciones caminar y quieto) |
| Árboles y monte | "Low Poly Nature — Free" / "Free Trees" |
| Ruta y señales | "Low Poly Road Pack — Free" / "Traffic Cones & Barriers — Free" |
| Interfaz | "Modern UI Pack — Free" / TextMeshPro |
| Sonido | "Free Sound Effects Pack" / "Nature Sound FX — Free" |
