# 16 — Ficha de Artista (Cédula)
*Módulo: `artist_card.html` + `artist_card.js`*

> **¿Qué es este módulo?**
> Es la vista detallada de un artista individual: su perfil biográfico (foto, tipo, nacionalidad, género, biografía), estadísticas de curación y la lista completa de canciones enlazadas a él en la biblioteca. Permite editar todos los campos de la ficha, consultar fuentes en internet para autocompletar, aplicar géneros en masa a las canciones, preescuchar pistas y navegar a fichas de colaboradores.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Cédula de Artista — LF Automatizador |
| **Modo** | Ventana flotante independiente (puede haber múltiples abiertas simultáneamente) |
| **Diseño** | Barra superior fija + panel izquierdo de perfil (360px fijo) + panel derecho de contenido (flexible) |
| **Estado inicial** | MODO LECTURA (los campos son solo lectura al abrir) |
| **Advertencia al cerrar** | Si hay cambios sin guardar, bloquea el cierre con `beforeunload` |
| **Responsive** | < 980px: apila los paneles verticalmente |

---

## 🧩 Elementos de la Interfaz

### 1. Barra Superior (`top-bar`)

#### Título del Módulo
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Texto "Curaduria Musical (Cedulas)" en azul |
| ⚡ **Qué** | Identificación del módulo — no interactivo |
| ⏱️ **Cuándo** | Siempre visible |
| 📍 **Dónde** | Barra superior izquierda |
| 💡 **Por qué** | Contexto rápido para el operador cuando tiene múltiples ventanas abiertas |

#### Indicador de Estado (`#artist-status`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Texto de estado con color dinámico |
| ⚡ **Qué** | Muestra mensajes informativos del ciclo de vida de la ficha |
| ⏱️ **Cuándo** | Siempre visible |
| 📍 **Dónde** | Barra superior, antes del botón de guardar |
| 💡 **Por qué** | Retroalimentación inmediata de operaciones de guardado, carga y errores |

**Estados posibles:**
| Texto | Color | Momento |
|---|---|---|
| "Listo." | Gris | Al abrir la ventana vacía |
| "Cargando cédula..." | Gris | Mientras se obtienen datos |
| "Cédula cargada." | Verde | Carga exitosa |
| "Cambios sin guardar." | Naranja | Al editar cualquier campo |
| "Guardando cédula..." | Gris | Durante el guardado |
| "Cédula guardada." | Verde | Guardado exitoso |
| "Consultando internet..." | Gris | Durante fetch de metadatos |
| "Metadatos listos. Tipo: X. Guarda para descargar la imagen." | Verde | Después de obtener datos en línea |
| "Selecciona una o más canciones." | Naranja | Al intentar aplicar género sin selección |
| Mensaje de error | Naranja | Cualquier fallo de operación |

#### Botón "Guardar cambios" (`#btn-save-top`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón verde, se ilumina con borde brillante cuando hay cambios sin guardar |
| ⚡ **Qué** | Guarda todos los campos de la ficha y descarga la foto si hay una URL pendiente |
| ⏱️ **Cuándo** | Requiere que haya una ficha cargada (`currentCard.artistKey`). Disponible en ambos modos |
| 📍 **Dónde** | Persiste los cambios en la base de datos; recarga la ficha; muestra "Cédula guardada." |
| 💡 **Por qué** | El operador puede editar varios campos y guardar todo de una vez |

**Atajo de teclado:** `Ctrl + S` (o `Cmd + S` en Mac) — guarda desde cualquier campo.

#### Alternador de Modo Edición/Lectura (`.edit-toggle`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Dos botones agrupados: "MODO LECTURA" / "MODO EDICION" |
| ⚡ **Qué** | Alterna la visibilidad de los campos editables (`.show-edit`) versus las vistas de solo lectura (`.show-read`) mediante clases CSS en el `body` |
| ⏱️ **Cuándo** | La ficha abre en MODO LECTURA. El botón activo se resalta en azul |
| 📍 **Dónde** | Cambia la apariencia del panel izquierdo (inputs aparecen/desaparecen) |
| 💡 **Por qué** | En modo lectura el operador consulta datos rápidamente en vivo sin riesgo de modificaciones accidentales |

---

### 2. Panel Izquierdo — Perfil del Artista (`.profile-side`)

#### Foto Hero (`#photo-hero`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Área de 210px de altura con imagen de fondo, título del artista superpuesto |
| ⚡ **Qué** | Muestra la foto del artista con opacidad reducida; si no hay foto, muestra el nombre del artista como texto en blanco |
| ⏱️ **Cuándo** | Se actualiza al escribir el nombre (modo edición), al cargar la ficha, y al obtener metadatos en línea |
| 📍 **Dónde** | Cabecera del panel de perfil. La foto usa `photoLocalPath` (preferida) o `photoUrl` |
| 💡 **Por qué** | Identificación visual inmediata del artista; esencial para validar que la foto descargada es la correcta |

#### Botón "Auto-completar desde Internet" (`#btn-fetch`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón azul ancho, solo visible en MODO EDICION |
| ⚡ **Qué** | Consulta fuentes externas (MusicBrainz, LastFM, etc.) buscando el nombre del artista escrito en el campo de nombre. Rellena automáticamente: país/nacionalidad (solo si está vacío), tipo de artista y foto (como URL pendiente) |
| ⏱️ **Cuándo** | Solo visible en MODO EDICION. Requiere que haya un nombre en `#artist-name`. No sobreescribe campos ya curados |
| 📍 **Dónde** | Los campos de nacionalidad y tipo se rellenan en los inputs; la foto se pre-visualiza en el hero. El estado muestra las fuentes consultadas |
| 💡 **Por qué** | Reduce drásticamente el trabajo manual de investigación; el operador valida y guarda con un clic |

#### Campo "Nombre del artista" (`#artist-name`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Input de texto, solo visible en MODO EDICION |
| ⚡ **Qué** | Al escribir, actualiza el título del hero en tiempo real. Marca la ficha como "con cambios" |
| ⏱️ **Cuándo** | Solo en MODO EDICION |
| 📍 **Dónde** | Modifica `displayName` al guardar |
| 💡 **Por qué** | Permite corregir nombres mal escritos o abreviaturas que llegaron desde los tags de audio |

#### Campo "Tipo de Artista" (`#artist-type` / `#read-artist-type`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Select en modo edición, texto plano en modo lectura |
| ⚡ **Qué** | Define la categoría del artista |
| ⏱️ **Cuándo** | Solo editable en MODO EDICION |
| 📍 **Dónde** | Guardado como `artistType` en la base de datos |
| 💡 **Por qué** | Permite discriminar entre solistas y grupos para la locución y reportes de emisión |

**Opciones disponibles:**
- Solista (M)
- Solista (F)
- Duo
- Agrupacion / Banda
- Orquesta

#### Campo "Nacionalidad(es)" (`#artist-nationalities` / `#read-nationalities`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Input de texto con datalist de países. Modo lectura: texto plano |
| ⚡ **Qué** | Al presionar coma `,` o al perder el foco (`blur`), normaliza y formatea las nacionalidades automáticamente (ej. "colombia / mexico" → "Colombia / México") eliminando duplicados. Incluye autocompletado de países |
| ⏱️ **Cuándo** | Solo editable en MODO EDICION. El datalist se pobla desde `lib-get-country-profiles` |
| 📍 **Dónde** | Guardado como `nationalities` y `country` |
| 💡 **Por qué** | La nacionalidad es clave para la localización de artistas en pantalla durante la emisión |

**Comportamiento especial:** Al presionar `,` el separador se convierte automáticamente en ` / ` y el siguiente país se puede escribir de inmediato.

#### Campo "Género Principal (Master)" (`#artist-main-genre` / `#read-main-genre`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Select en modo edición (solo muestra géneros padre, sin subgéneros). Modo lectura: píldora clicable |
| ⚡ **Qué** | Define el género principal del artista. En lectura, la píldora es clicable y abre el editor de ese género |
| ⏱️ **Cuándo** | El select se puebla dinámicamente desde `lib-get-genre-profiles` al cargar |
| 📍 **Dónde** | Guardado como `mainGenre`, `mainGenreKey` y `habitualGenre` |
| 💡 **Por qué** | Es el género que determina el filtro y el color del artista en el catálogo |

#### Campo "Géneros Secundarios (Subgéneros)" (`#artist-subgenres` / `#read-subgenres`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Input de texto libre (separado por comas). Modo lectura: píldoras clicables |
| ⚡ **Qué** | Lista de subgéneros adicionales. En lectura, cada píldora abre el editor de ese género |
| ⏱️ **Cuándo** | Solo editable en MODO EDICION |
| 📍 **Dónde** | Guardado como `subgenresCsv` |
| 💡 **Por qué** | Un artista puede tener múltiples facetas; los subgéneros permiten búsquedas más precisas |

#### Campo "Biografía / Notas (Wiki)" (`#artist-biography` / `#read-biography`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Textarea redimensionable en modo edición. Modo lectura: texto con enlaces Wiki |
| ⚡ **Qué** | Campo de texto libre para notas biográficas. Soporta la sintaxis `[Nombre Artista]` para crear enlaces a otras fichas |
| ⏱️ **Cuándo** | Solo editable en MODO EDICION. En lectura, los `[nombres]` se convierten en spans clicables |
| 📍 **Dónde** | Al clicar un enlace wiki, se abre la ficha del artista mencionado (vía `open-artist-card-by-name`) |
| 💡 **Por qué** | Documenta el historial del artista para el locutor; los enlaces conectan artistas relacionados |

---

### 3. Panel Derecho — Contenido (`content-side`)

#### Tarjetas de Resumen (`.summary-strip`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Tres tarjetas pequeñas en fila: Canciones / Género principal / Estado |
| ⚡ **Qué** | Resumen estadístico de la ficha actual |
| ⏱️ **Cuándo** | Se actualiza al cargar la ficha o guardar cambios |
| 📍 **Dónde** | Parte superior del panel derecho |
| 💡 **Por qué** | Vista de diagnóstico rápido: ¿el artista tiene canciones? ¿está curado? |

**Tarjetas:**
| ID | Dato | Lógica |
|---|---|---|
| `#summary-tracks` | Total de canciones enlazadas | Conteo de `currentTracks` |
| `#summary-main-genre` | Género principal | `mainGenreName` o "N/A Multigenero" |
| `#summary-curation` | Estado de curación | "Lista para usar" si tiene nombre + nacionalidad + género; "Completar datos" si no |

#### Red de Colaboradores Frecuentes (`#collab-grid`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Chips clicables con los nombres de otros artistas que aparecen frecuentemente en los tags de canciones junto a este artista |
| ⚡ **Qué** | Al clicar un colaborador, abre su Ficha de Artista (por nombre). Muestra hasta 8 colaboradores ordenados por frecuencia |
| ⏱️ **Cuándo** | Se calcula analizando el campo `artist` de cada canción enlazada, separando por `feat.`, `,`, `&` |
| 📍 **Dónde** | Bajo las tarjetas de resumen. Si no hay colaboradores: "Sin colaboradores detectados" (no clicable) |
| 💡 **Por qué** | Permite navegar rápidamente entre artistas relacionados, útil para curación en cadena |

#### Biblioteca Musical Enlazada (`.table-container`)

Es la sección de mayor interactividad: muestra todas las canciones vinculadas al artista.

##### Barra de Herramientas de la Tabla (`.table-tools`)

| Elemento | ID | Modo | Función |
|---|---|---|---|
| Buscador de canciones | `#track-filter` | Siempre visible | Filtra la tabla por título, artista, género, subgénero, año o ruta de archivo. Sin debounce |
| Contador de seleccionadas | `#selected-track-count` | Siempre visible | "N seleccionada(s)" |
| Botón "Seleccionar todo" | `#btn-select-all` | Solo EDICION | Selecciona todas las filas visibles (filtradas) |
| Input "Género principal" | `#bulk-main-genre` | Solo EDICION | Texto con autocomplete de géneros. Default: género actual del artista |
| Botón "Aplicar género" | `#btn-apply-main-genre` | Solo EDICION | Aplica el género a todas las canciones seleccionadas + escribe tags ID3 |
| Input "Subgénero" | `#bulk-subgenre` | Solo EDICION | Texto con autocomplete de géneros |
| Botón "Aplicar subgénero" | `#btn-apply-subgenre` | Solo EDICION | Aplica el subgénero a todas las canciones seleccionadas + escribe tags ID3 |

> **Nota importante:** Los botones de aplicar género requieren que haya canciones seleccionadas y un género válido. Escriben los tags ID3 directamente en los archivos de audio (`writeTags: true`).

##### Tabla de Canciones (`#artist-tracks-body`)

| Columna | Dato | Notas |
|---|---|---|
| **Título** | `track.title` o nombre de archivo | Fondo blanco negrita; tooltip con ruta completa del archivo |
| **Género Canción** | `track.genre` o `primaryGenre` | Mostrado como píldora clicable que abre el editor de ese género |
| **Subgéneros** | `track.subgenresCsv` o `subgenre` | Múltiples píldoras clicables |
| **Rol del Artista** | `track.role` | Verde "Principal" si `role === 'main'`, naranja "Colaboración" si es otro valor |
| **Año** | `track.year` | Año de la pista |
| **▶ Preescucha** | Botón circular | Toca/detiene la pista en la salida CUE |

**Interacciones de la tabla:**

| Interacción | Elemento | Resultado |
|---|---|---|
| Clic en una fila | Fila de la tabla | Toggle de selección (azul si seleccionada) |
| Clic en ▶ (parado) | Botón preescucha | Inicia reproducción en salida CUE; botón se vuelve ■ azul |
| Clic en ■ (tocando) | Botón preescucha activo | Detiene la reproducción |
| Clic en píldora de género | Píldora en columna Género/Subgénero | Abre el editor del género correspondiente |
| Clic en colaborador | Chip de colaborador (sección arriba) | Abre la Ficha de Artista del colaborador |

**Preescucha de audio:**
- Solo funciona si el motor de audio **no** es `rustAudio` en modo exclusivo.
- En modo Rust: muestra advertencia "Preescucha Web Audio bloqueada en modo Rust."
- La preescucha usa la salida CUE configurada en Ajustes (vía `loadAudioPrefs()`).
- Al cerrar la ventana, la preescucha se detiene automáticamente.

---

## ⌨️ Atajos de Teclado

| Tecla | Condición | Acción |
|---|---|---|
| `Ctrl + S` / `Cmd + S` | Cualquier momento | Guarda la ficha del artista |

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo | Retorna |
|---|---|---|
| `lib-get-artist-card` | Al abrir por `artistKey` | `{ success, card, tracks[] }` |
| `lib-get-artist-card-for-track` | Al abrir por `filePath` de una canción | `{ success, card, tracks[] }` |
| `lib-fetch-artist-metadata` | Al pulsar "Auto-completar desde Internet" | `{ success, country, artistType, photoUrl, photoDownloadAllowed, metadataSources[], externalSource, externalId, fetchedAt }` |
| `lib-save-artist-card` | Al pulsar "Guardar cambios" | `{ success, card, error? }` |
| `lib-set-track-genre` | Al aplicar género o subgénero masivo | `{ success, updatedTracks, tagUpdated, error? }` |
| `lib-get-genre-profiles` | Al cargar la ventana | Array de perfiles de géneros |
| `lib-get-country-profiles` | Al cargar la ventana | Array de perfiles de países |

### Mensajes enviados al Backend (`ipcRenderer.send`)

| Canal | Cuándo | Datos |
|---|---|---|
| `open-artist-card-by-name` | Al clicar un enlace wiki o un colaborador | Nombre del artista (string) |
| `open-genre-editor` | Al clicar una píldora de género | `{ genreKey, displayName }` |

### Mensajes recibidos (`ipcRenderer.on`)

| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `load-artist-card` | Cuando el catálogo solicita abrir esta ventana | Carga la ficha del artista indicado en el payload |
| `settings-updated` | Cuando el usuario cambia configuración de audio | Actualiza la salida de la preescucha activa |
| `genre-profiles-updated` | Cuando se edita un género | Recarga los perfiles de géneros y re-renderiza la ficha |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| IPC actual | Equivalente en Tauri/Rust |
|---|---|
| `lib-get-artist-card` (invoke) | Comando Tauri `get_artist_card` → query JOIN entre artistas y tracks |
| `lib-get-artist-card-for-track` (invoke) | Comando Tauri `get_artist_card_for_track` → busca artista por ruta de archivo |
| `lib-fetch-artist-metadata` (invoke) | Comando Tauri `fetch_artist_metadata` → llamadas HTTP async a MusicBrainz/LastFM desde Rust |
| `lib-save-artist-card` (invoke) | Comando Tauri `save_artist_card` → UPDATE en SQLite + descarga de foto con `reqwest` |
| `lib-set-track-genre` (invoke) | Comando Tauri `set_track_genre_bulk` → UPDATE en SQLite + escritura de tags ID3 con `id3` crate |
| `lib-get-genre-profiles` (invoke) | Comando Tauri `get_genre_profiles` → SELECT en tabla de géneros |
| `lib-get-country-profiles` (invoke) | Comando Tauri `get_country_profiles` → SELECT en tabla de países o JSON embebido |
| `open-artist-card-by-name` (send) | Evento de ventana Tauri: buscar artista → abrir `artist_card` window |
| `open-genre-editor` (send) | Evento de ventana Tauri: abrir `genre_editor` window con payload |
| `load-artist-card` (on) | Evento Tauri `emit_to` dirigido a la ventana `artist_card` específica |
| Motor de preescucha Web Audio | Se mantiene en Web API dentro de WebView; `setSinkId` sigue siendo la técnica de routing de CUE |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
