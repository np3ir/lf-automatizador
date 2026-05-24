# 23 — Servicios de Backend
*Módulo: `backend/services/*.js`*

> **¿Qué es este módulo?**
> Los "Servicios" en el backend contienen la lógica de negocio pura y pesada, separada de las llamadas directas de IPC o la capa de interfaz. 
> Son responsables de la limpieza, normalización y mantenimiento de la coherencia de datos complejos como perfiles de artistas y taxonomías de géneros musicales.

---

## 🎭 1. Servicio de Artistas (`artists.js`)
*(859 líneas de código)*

Es el cerebro detrás de la identificación de músicos. Su objetivo principal es evitar que existan decenas de variaciones del mismo nombre (ej. "Shakira", "Shakira feat. Maluma", "Shakira ft Maluma").

### Funcionalidades Clave:
- **Normalización de Nombres (`normalizeArtistKey`)**: Convierte cualquier string en una llave única quitando acentos, caracteres especiales y convirtiendo todo a minúsculas.
- **Extracción de Invitados (Feats)**: Usa complejas expresiones regulares (`/feat\.?|ft\.?|featuring| x | y | vs/i`) para desglosar una cadena de texto en un "Artista Principal" y un array de "Artistas Invitados".
- **Agrupaciones Protegidas**: Mantiene una lista blanca (`PROTECTED_ARTIST_GROUP_NAMES`) de dúos o grupos que no deben ser divididos (ej. "Wisin y Yandel", "Chino y Nacho").
- **Catálogo y Tarjetas**: Construye los objetos enriquecidos que la interfaz utiliza en "Catálogo de Artistas" y la "Ficha de Artista", calculando estadísticas como el número de canciones vinculadas (`trackCount`).
- **Nacionalidades**: Usa un mapeo para convertir alias de países en perfiles normalizados (ej. "RD", "Dominicana" -> "República Dominicana").

---

## 🎵 2. Servicio de Géneros (`genres.js` y relacionados)
*(~880 líneas de código)*

Maneja la organización de la música mediante un sistema de etiquetas jerárquicas (Taxonomía).

### Funcionalidades Clave:
- **Árbol Jerárquico**: Soporta géneros Padre e Hijo. (Ej. Padre: "Merengue", Hijo: "Merengue Mambo").
- **Autodescubrimiento desde Carpetas (`inferGenreFromFolderName`)**: Es capaz de deducir el género de una canción analizando la ruta de la carpeta donde se encuentra. Tiene un diccionario de raíces (`KNOWN_GENRE_ROOTS`) para adivinar subgéneros (ej. Si la carpeta es "Salsa Baul", deduce Padre: "Salsa", Hijo: "Salsa Baul").
- **Alias Canónicos (`GENRE_CANONICAL_ALIASES`)**: Fuerza correcciones ortográficas automáticas (ej. "tecnomerengue", "techno merengue" -> "tecno merengue" / "regueton" -> "reggaeton").
- **Escritura ID3 de Retorno (`writeGenreTagsToFiles`)**: Permite que cuando un operador cambia el género de una canción en el sistema, este cambio se guarde permanentemente en el archivo físico MP3 usando `node-id3`.

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

Estos servicios son el candidato perfecto para ser portados 1:1 a Rust, donde las operaciones con *strings* y Expresiones Regulares son significativamente más eficientes.

| Lógica Actual | Implementación Recomendada en Rust |
|---|---|
| Expresiones Regulares (Regex) | Usar el crate `regex` pre-compilado usando `lazy_static!` para máxima velocidad al procesar millones de canciones. |
| Inyección de Dependencias | En lugar del patrón `_injectDeps()` usado en Node.js, usar estructuras Rust que compartan un `AppHandle` y una pool de base de datos (`r2d2`). |
| Manipulación de Strings | Reemplazar `normalize('NFD')` de JS por el crate `unicode-normalization` en Rust. |

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
*Referencia para LF Automatizador v2.0 (Tauri + Rust)*
