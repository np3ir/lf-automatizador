# 00 — Guía de Íconos y Consistencia Visual entre Plataformas

> ✅ **DECISIÓN TOMADA (v2.0):** Se usará **Lucide Icons** (librería SVG) como sistema de íconos oficial. Los emojis de la v1.0 serán mapeados a íconos Lucide equivalentes durante la construcción de la v2.0.

> **¿Por qué existe este documento?**
> La versión 1.0 de LF Automatizador usa emojis del sistema (Unicode) para íconos en la interfaz.
> En Windows funcionan perfectamente (Segoe UI Emoji), pero en Linux su apariencia depende
> de qué fuente de emojis tenga instalada el usuario — y pueden no aparecer o verse completamente diferentes.
> Este documento registra el problema, cómo se manejó en la v1.0, y la decisión de diseño para la v2.0.

---

## El Problema: Emojis del Sistema

Los emojis como `🎛️ 👤 🔁 🔀 ⏹ 🎧 ✏️ 🗑️` que aparecen en los botones, menús y pestañas de la
interfaz **no son imágenes**: son caracteres Unicode que el sistema operativo renderiza usando
su propia fuente de emojis.

| Sistema Operativo | Fuente nativa | Resultado en la app |
|---|---|---|
| Windows 10 / 11 | Segoe UI Emoji | ✅ Coloridos, consistentes |
| macOS | Apple Color Emoji | ✅ Coloridos, estilo diferente |
| Ubuntu con Noto instalado | Noto Color Emoji | ⚠️ Estilo diferente pero visible |
| Ubuntu sin Noto | (ninguna o incompleta) | ❌ Cuadros vacíos (`□`) |
| Arch / Fedora / otras | Variable | ❌ Impredecible |

---

## Dónde se usan emojis en la v1.0

La v1.0 usa emojis en toda la interfaz. Los lugares más críticos son:

| Módulo | Ejemplos de emojis usados |
|---|---|
| CartWall | `🎛️` `👤` `🔁` `🔀` `⏹` `🎧` `✏️` `🗑️` |
| Consola Principal | `▶` `⏹` `⏭` `⏮` `🔊` `📁` |
| Menús contextuales | `✏️` `🗑️` `✓` `❌` `📋` |
| Pestañas y etiquetas | `🎵` `📻` `📢` `🎤` |
| Mensajes del sistema | `⚠️` `✅` `❌` `ℹ️` |

---

## Solución Recomendada para la v2.0: Twemoji

**Twemoji** es la biblioteca de emojis open source de Twitter/X. Reemplaza todos los emojis
Unicode del HTML por archivos SVG (o PNG) incrustados, garantizando un aspecto 100% idéntico
en cualquier sistema operativo.

- **Licencia:** Creative Commons BY 4.0 (libre para uso comercial)
- **Repositorio:** https://github.com/twitter/twemoji
- **Peso:** ~100 KB (JS) + los SVGs (se pueden bundlear o servir localmente)

### Cómo implementarlo en Tauri v2.0

```html
<!-- En el <head> de cada ventana HTML -->
<script src="./assets/twemoji.min.js"></script>
```

```javascript
// Activar al cargar la página — reemplaza todos los emojis automáticamente
document.addEventListener('DOMContentLoaded', () => {
    twemoji.parse(document.body, {
        folder: 'svg',
        ext: '.svg',
        base: './assets/twemoji/'
    });
});
```

Con esto, un emoji como `🎛️` en el HTML se convierte automáticamente en:
```html
<img
  class="emoji"
  draggable="false"
  alt="🎛️"
  src="./assets/twemoji/svg/1f39b.svg"
/>
```

### Estructura de archivos sugerida para la v2.0

```
src/
  assets/
    twemoji/
      twemoji.min.js    ← La librería
      svg/              ← Los SVGs de cada emoji (solo los que uses)
        1f39b.svg       ← 🎛️
        1f464.svg       ← 👤
        ...
```

> [!TIP]
> No es necesario incluir los ~3,000 SVGs de Twemoji. Solo copia los que realmente
> uses en la interfaz. Puedes usar la herramienta en https://twemoji-cheatsheet.vercel.app/
> para identificar el nombre de archivo de cada emoji.

---

## Alternativa: Usar una librería de íconos SVG

Si en la v2.0 se prefiere un estilo más "profesional" y menos "emoji", se puede reemplazar
el sistema de emojis completo por una librería de íconos vectoriales:

| Librería | Estilo | Licencia | Bundle size |
|---|---|---|---|
| **Lucide Icons** | Líneas limpias, moderno | ISC (libre) | ~50 KB |
| **Heroicons** | Tailwind-style | MIT (libre) | ~60 KB |
| **Font Awesome Free** | Clásico, muy completo | CC BY 4.0 | ~100 KB |
| **Phosphor Icons** | Moderno, múltiples pesos | MIT (libre) | ~40 KB |

### Ejemplo con Lucide (recomendado)

```html
<!-- Antes (v1.0 con emoji) -->
<button id="btn-dock-cartwall">⏏️ Acoplar</button>

<!-- Después (v2.0 con Lucide) -->
<button id="btn-dock-cartwall">
    <i data-lucide="panel-left-close"></i> Acoplar
</button>
```

---

## Decisión para la Documentación (archivos `.md`)

**Los emojis en los archivos Markdown de esta documentación NO tienen este problema.**

Los lectores de Markdown (VS Code, GitHub, Obsidian, el navegador) renderizan los emojis
usando sus propias fuentes internas, no las del sistema operativo. Son consistentes en
todas las plataformas dentro del contexto de la documentación.

**Conclusión:** No es necesario hacer nada especial en los archivos `.md` de esta documentación.
El problema de consistencia de emojis solo aplica al código HTML/CSS/JS de la aplicación.

---

## Checklist para la v2.0

- [ ] Decidir entre **Twemoji** (mantiene los emojis actuales) o **librería de íconos SVG** (rediseño visual)
- [ ] Si se elige Twemoji: descargar el bundle y los SVGs necesarios, agregar el script de inicialización a todas las ventanas HTML
- [ ] Si se elige librería SVG: hacer un inventario de todos los emojis usados en la v1.0 y mapearlos a íconos equivalentes
- [ ] Definir el sistema de íconos en el CSS global antes de construir cualquier componente de la v2.0

---

*Referencia técnica para LF Automatizador v2.0 (Tauri + Rust)*
