# BARRO · Motocross

Motocross de costado, del estilo de Mad Skills. Se juega con el celular parado o
acostado, o en la compu. Es un solo archivo, `barro.html`, que abre con doble clic
y anda sin internet. Un juego de JXSTUDIOS.

## Cómo se juega

- **GAS** acelera y **FRENO** frena (en la compu, ↑ / ↓ o W / S).
- **ATRÁS** y **ADELANTE** echan al piloto (← / → o A / D):
  - en el aire giran la moto;
  - en el piso controlan el willy, porque a fondo la trompa se levanta.
- Si caés con las ruedas paralelas a la bajada, es **¡PERFECTO!** y te da un empujón.
- Si caés de punta o de espalda, te vas al piso y volvés a la pista donde pisaste
  firme por última vez.

### Modos

- **Campeonato:** 4 sedes con 5 pistas cada una (Patagonia, Talampaya, Misiones y
  un supercross nocturno). Con el podio se abre la pista siguiente.
- **Jam del día:** la misma pista para todos, cambia cada día.
- **Contrarreloj:** corrés solo contra tu fantasma.

En el **Garage** se mejoran el motor, la suspensión, las gomas y el piloto, y se
eligen los colores, el número y el nombre.

En **Ajustes** están la música, los efectos, la vibración, la calidad y el idioma
(español, inglés y portugués). También el editor de controles: mover y agrandar
cada botón, cambiar la transparencia y modo zurdo.

## Armar y probar

```
python3 barro/herramientas/arte.py        # el arte crudo de Rezona → arte/*.webp
node barro/herramientas/armar.mjs         # → barro.html
node barro/pruebas/bot.mjs                # las 20 pistas con seis pilotos
node barro/pruebas/navegador.mjs          # una carrera entera, idiomas, acostado, controles
```

Para desarrollar, servir el repo y abrir `barro/index.html`.

## Créditos

- Arte pintado: Rezona.
- Letra: Barlow Condensed (SIL Open Font License).
- La moto, el piloto, el sonido y la música están hechos en código.
