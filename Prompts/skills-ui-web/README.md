# 5 skills de Claude Code para UIs de páginas

Fuente: TikTok @sebas.soto222 (capturas guardadas en esta carpeta).
Complementa el flujo de [`../diseno-web-claude/`](../diseno-web-claude/).

---

## 1. UI-UX-Pro-Max

**La más completa.**

Le dices qué tipo de app quieres y genera un sistema de diseño completo —
colores, fuentes y estilos — automáticamente.

Úsala al principio, cuando todavía no tienes dirección visual definida.

---

## 2. Anthropic Frontend Design

**El skill oficial de Anthropic.**

Diseñado para evitar que Claude genere interfaces genéricas y sin personalidad.

Es el antídoto directo al "slop" de IA: gradientes azul-púrpura, Inter en todos
lados, siempre la misma estructura.

---

## 3. Vercel Web Design Guidelines

Audita tu UI contra más de 100 reglas de accesibilidad y buenas prácticas.

**No crea: revisa y corrige.** Se usa después de tener la interfaz construida.

---

## 4. React Native Skills

**Específico para mobile.**

Da guías de componentes y patrones de iOS y Android que Claude no considera por
default.

---

## 5. AccessLint

Revisa contraste de colores, estados de focus y accesibilidad.

Tu app se ve más profesional sin que sepas todo eso de memoria.

---

## Cómo encajan entre sí

| Momento | Skill |
| --- | --- |
| Antes de escribir código (sistema de diseño) | UI-UX-Pro-Max |
| Mientras Claude genera la UI (evitar lo genérico) | Anthropic Frontend Design |
| Si el target es app móvil | React Native Skills |
| Ya construido: auditoría general | Vercel Web Design Guidelines |
| Ya construido: contraste, focus, a11y | AccessLint |
