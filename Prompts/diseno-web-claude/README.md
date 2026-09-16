# Flujo de diseño web con Claude Code

Fuente: TikTok @danielbrown.ia (capturas guardadas en esta carpeta).

---

## 0. Primero, conoce a tu enemigo: el contenido IA genérico

Lo que delata a un sitio generado por IA: gradientes azul-púrpura, tipografía
Inter por todos lados, siempre la misma estructura.

La verdad:
- No es un problema técnico — es genérico.
- Mejores modelos solo mueven el promedio.
- Lo que importa es el gusto que rompe el molde.

La corrección en 3 pasos:
1. **Cura el contenido** — una biblioteca de diseños que realmente te encantan.
2. **Entrena a Claude** — habilidades + MCPs que sí van con tu estilo.
3. **Construye a lo grande** — nunca con un solo intento; itera visualmente.

Resultado: un sitio que parece hecho para ti, un flujo de trabajo reutilizable,
y adiós a la lotería de prompts.

---

## Paso 1 — Crea una biblioteca de estilos

> Tu estilo es tu ventaja. Cuídalo.

1. **Dribbble** — busca diseño web, ordena lo popular.
2. **Pinterest** — maquetas que nunca se te ocurrirían.
3. **X / Twitter** — diseñadores compartiendo UI en vivo.
4. **Capturas de pantalla** — todo lo que detiene tu scroll.
5. **Guardar enlaces** — sitios reales superan imágenes estáticas.
6. **Agrupar** — por familia de diseño, no por proyecto.
7. **Nómbralo** — el vocabulario es poder.
8. **Reutilizar** — cada futuro proyecto empieza aquí.

---

## Paso 2 — Instala `impecable`

Una habilidad, 23 comandos, 46 patrones de slop.

- `/BOLDER` → empuja tus diseños hacia el impacto: más contraste, movimientos
  más grandes, sin caos.
- **Auditoría de slop** → escanea tu sitio buscando 46 patrones de slop; corre
  en un servidor de desarrollo en vivo, componente por componente.
- **7 dimensiones** donde se esconde el slop: tipografía, color, espacial,
  responsivo, interacción, movimiento, redacción UX.

### El resto del cinturón de herramientas

- **Taste Skill v2** — layout, tipografía, movimiento, espaciado.
- **Higgsfield MCP** — generación de imágenes + videos dentro de Claude Code.
- **Selección de modelos** — GPT Image 2 para fotos, SeaDance para videos.
- **21st.dev** — copiar y pegar prompts para botones, tarjetas, precios.
- **Taste de componentes** — bordes, fondos, paginación que nunca considerarías.
- ⚠️ **Habilidades con un clic** — preciso, prescriptivo, misma salida siempre.
- **Ritmos flexibles y prescriptivos** — tu gusto guía el resultado.

---

## Paso 3 — Nunca en una toma. Proyecta en grande.

1. **Cinco estilos** — una página, cinco familias estéticas, lado a lado.
2. **Elige uno** — luego tres variantes de ese estilo.
3. **Elige de nuevo** — ahora clava la imagen héroe (Higgsfield).
4. **Ajusta** — tipografías, colores, movimiento. Pequeños movimientos.

5 estilos → 3 variantes → 1 ganador → ajustes.

Por qué: ves todas las opciones en una sola pantalla, comparas en vez de
adivinar, la terminal oculta tus opciones, y la fidelidad sube a medida que te
enfocas.

---

## Paso 4 — El prompt de 4 partes que sí funciona

Cuatro inputs, cada build:

1. **Estética** — la familia de diseño, directo desde tu biblioteca.
2. **Referencia** — capturas de pantalla o URLs en vivo. Iguala la sensación,
   nunca copies.
3. **Intención** — qué es, para quién es, qué deben hacer.
4. **Guías** — lista de *siempre* / *nunca*. Mata el slop antes de que se
   renderice.

### Ejemplo del prompt completo

> Crea una landing page para "Kestrel" — una plataforma de analíticas con IA
> para startups pequeñas.
> Objetivo de conversión: reservar una demo. CTA principal en cada versión:
> "Reservar una demo". Debe verse en el héroe y repetirse al final de la página.
>
> **Intención:** desventaja injusta de un equipo pequeño. Tono: serio,
> inteligente, seguro y con empatía. Fundamento: los datos como ventaja. Debe
> hacer pensar "estos son exactamente como nosotros y entienden lo que parece
> imposible en 3 segundos".
>
> **Guías:** siempre una imagen monumental; el héroe anclado a la página; la
> imagen procesada, nunca cruda (halftone, dither, grano, ASCII, linework);
> detalles técnicos sutiles (coordenadas, IDs, reglas, timestamps); tipografía
> en extremos — display monumental o etiquetas pequeñas; look monocromático
> cálido, con un solo color de acento y detalles mínimos.
> **Nunca:** horizontes neutros en degradado púrpura, SaaS brillante, fotos de
> stock sin contexto, gráficos redondeados, tipografía solo para
> sistema/Inter, paletas de color distribuidas sin coherencia.
>
> Crea 5 versiones de esta página, cada una en su propia carpeta (v1/ ... v5/),
> una por instrucción a continuación. Misma intención y guías para todas las
> cinco. NO mezcles instrucciones — cada versión debe comprometerse
> completamente con su propia estética.
>
> **IMPORTANTE** — las imágenes del héroe van después. NO generes ni busques
> ninguna imagen. Para cada versión, reserva el espacio del héroe exactamente
> donde irá (nota de ubicación ej. "imagen de héroe aquí en el aspecto correcto
> y posición") y rellena con un CSS plano que coincida con la dirección y
> paleta. Ajusta todo el tipo y el espaciado a la estética desde el inicio, ya
> que ya existían caídas de imagen, así que los cambios del layout real son
> cero.
>
> — DIRECCIÓN 1 (v1) — Paper técnico de impresión
> Estética: impresión técnica × datos — ilustración lineal topográfica en gris
> salvia claro…

---

## Paso 5 — Itera hasta que sea tuyo

> Ajusta visualmente. Nunca adivines en la terminal.
> No te conformes con "más premium". Construye los controles, luego gira las
> perillas.

- **Primero:** clava al héroe. Cuatro opciones de Higgsfield, elige una, refina
  el color.
- **Luego:** transiciones. Sin cortes bruscos entre héroe y cuerpo.
- **Después:** movimiento. Cargas de página pesadas y con peso.
- **Luego de eso:** pídele a Claude la barra de ajustes — fuentes, tamaños,
  acentos, en vivo.
- **Siempre:** aliméntalo con referencias hasta que se sienta como tú.

---

## Extra — Haz que Claude construya tu app de biblioteca

Un lugar, cada estilo que amas, explicado. Lo que cada entrada te da:

| Campo | Para qué |
| --- | --- |
| Familia de diseño | agrupadas automáticamente |
| Vocabulario | las palabras del estilo se crean de ahí |
| Palabras clave | se integran directo en los prompts |
| Prompt de imagen | para fondos tipo héroe |
| Brief | la base completa del sitio |

Piénsalo así: capturas de pantalla → biblioteca → mejores prompts cada vez.
