# 14 — Editor de Géneros Musicales (Curaduría)
*Módulo: `genre_editor.html` + `genre_editor.js` | IPC: `genre-editor-get-catalog`, `genre-editor-save`, `genre-editor-delete`, `genre-editor-reclassify`, `genre-editor-merge-genres`, `genre-profiles-updated`*

> **¿Qué es este módulo?**
> Es una herramienta de curaduría musical que permite al operador de radio organizar, clasificar y unificar la taxonomía de géneros musicales de toda la biblioteca. Funciona con un sistema de tres columnas (Géneros Padre, Subgéneros, Sin Identificar) donde los géneros se pueden crear, editar, reclasificar mediante drag & drop, y fusionar duplicados con un motor de unificación de 5 pasos. Cada género muestra cuántas canciones tiene vinculadas.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Editor de Géneros - LF Automatizador |
| **Encabezado** | "Curaduría de Géneros Musicales" |
| **Modo** | Ventana completa (ocupa 100vh), no modal |
| **Layout** | Grid de dos columnas: panel lateral izquierdo (280px fijo) + área principal de tres columnas |
| **Comportamiento especial** | Se actualiza automáticamente si el backend emite `genre-profiles-updated` (ej: cuando otra parte del sistema modifica los géneros) |
| **Indicador de estado** | Label `#status` en el header muestra mensajes en tiempo real: "Sincronizado y listo.", "Guardando...", "Eliminando...", etc. |

---

## 🧩 Elementos de la Interfaz

### 1. Panel Lateral Izquierdo — Crear / Editar Género

#### Campo Nombre (`#genre-name`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="text" #genre-name>` con placeholder "Ej: Reggaeton" |
| ⚡ **Qué** | Campo de texto para introducir el nombre del género. Aplica **normalización automática en tiempo real**: elimina acentos (NFD), capitaliza la primera letra de cada palabra excepto números y décadas (ej: "80s", "2000") |
| ⏱️ **Cuándo** | La normalización ocurre en cada tecla pulsada mientras se escribe |
| 📍 **Dónde** | Panel lateral izquierdo |
| 💡 **Por qué** | Evita duplicados por inconsistencia tipográfica (ej: "reggaetón" vs "Reggaeton"); la normalización automática garantiza un catálogo limpio sin esfuerzo del operador |

**Normalización aplicada:**
- Elimina tildes y diacríticos (NFD)
- Primera letra de cada palabra en mayúsculas
- Excepción: décadas numéricas quedan intactas (ej: "Rock 80s", "Pop 2000s")

#### Selector de Categoría (`#genre-type`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select #genre-type>` |
| ⚡ **Qué** | Define el tipo del género. Las opciones son: "Género Padre (Raíz)", "Subgénero / Estilo", "Sin Identificar (En Cola)" |
| ⏱️ **Cuándo** | Al seleccionar "Subgénero", aparece el selector de Género Padre. Al seleccionar cualquier otra opción, ese selector se oculta |
| 📍 **Dónde** | Panel lateral, debajo del nombre |
| 💡 **Por qué** | La taxonomía jerárquica permite filtrar la playlist por géneros padres (ej: "Rock") y sus subgéneros (ej: "Rock Alternativo", "Rock Clásico"), dando flexibilidad al programador musical |

**Opciones disponibles:**
| Valor | Etiqueta | Uso |
|---|---|---|
| `padre` | Género Padre (Raíz) | Categorías de primer nivel: Rock, Pop, Reggaeton, etc. |
| `subgenero` | Subgénero / Estilo | Subdivisiones de un padre: Rock Alternativo, Salsa Romántica, etc. |
| `sin_identificar` | Sin Identificar (En Cola) | Géneros detectados automáticamente que aún no han sido clasificados |

#### Selector de Género Padre (`#genre-parent`, grupo `#parent-selector-group`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select #genre-parent>` dentro del div `#parent-selector-group` |
| ⚡ **Qué** | Lista desplegable con todos los géneros tipo "padre" existentes. Permite asignar a qué padre pertenece el subgénero que se está creando/editando |
| ⏱️ **Cuándo** | Solo visible cuando el tipo seleccionado es "Subgénero / Estilo". Si hay un padre activo en el filtro de la columna, se preselecciona automáticamente |
| 📍 **Dónde** | Panel lateral, aparece/desaparece dinámicamente |
| 💡 **Por qué** | Mantiene la jerarquía del catálogo: un subgénero sin padre pierde su contexto de filtrado y programación |

#### Botón Guardar Cambios (`#btn-save`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón azul `#btn-save` con texto "Guardar Cambios" (ancho completo) |
| ⚡ **Qué** | En modo creación: crea un nuevo género. En modo edición: actualiza el género seleccionado. Valida que el nombre no esté vacío antes de proceder |
| ⏱️ **Cuándo** | Siempre disponible; si el campo nombre está vacío muestra alert nativo |
| 📍 **Dónde** | Panel lateral, sección inferior. Actualiza `#status` durante la operación |
| 💡 **Por qué** | Centraliza la creación y edición en un único flujo, diferenciado por si hay un género activo en edición (`currentEditKey` definido o no) |

#### Botón Cancelar Edición (`#btn-cancel`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón gris `#btn-cancel` (oculto por defecto) |
| ⚡ **Qué** | Descarta la edición en curso, limpia el formulario y vuelve al modo de creación |
| ⏱️ **Cuándo** | Solo visible cuando hay un género en modo edición (`currentEditKey` activo) |
| 📍 **Dónde** | Panel lateral, debajo del botón Guardar |
| 💡 **Por qué** | Permite al operador salir del modo edición sin hacer cambios accidentales |

#### Botón Eliminar Registro (`#btn-delete`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón rojo transparente `#btn-delete` (oculto por defecto) |
| ⚡ **Qué** | Elimina el género del catálogo de géneros. **Las canciones NO se borran**: solo se elimina la etiqueta de género |
| ⏱️ **Cuándo** | Solo visible cuando hay un género en modo edición. Muestra un `confirm()` nativo antes de ejecutar la eliminación |
| 📍 **Dónde** | Panel lateral, debajo del botón Cancelar |
| 💡 **Por qué** | Limpieza del catálogo de géneros obsoletos o mal importados, sin riesgo de perder las pistas asociadas |

---

### 2. Área Principal — Tres Columnas de Géneros

#### Columna "Padres (Raíz)" (`#list-padres`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Columna izquierda del área principal, lista `#list-padres` con badge `#count-padres` |
| ⚡ **Qué** | Muestra todos los géneros de tipo "padre". Al hacer clic en uno: activa el filtro de subgéneros (solo muestra los hijos) y carga el género en el formulario de edición |
| ⏱️ **Cuándo** | Siempre visible con todos los padres; el badge muestra el conteo total |
| 📍 **Dónde** | Primera columna del área principal |
| 💡 **Por qué** | La organización jerárquica permite al programador navegar la taxonomía completa de la biblioteca rápidamente |

#### Columna "Subgéneros" (`#list-subgeneros`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Columna central, lista `#list-subgeneros` con badge `#count-subgeneros`, label de filtro `#subgenre-filter-label` y enlace `#btn-show-all-subgenres` |
| ⚡ **Qué** | Muestra todos los subgéneros o solo los del padre activo. Al hacer clic en un padre de la columna izquierda, esta columna se filtra automáticamente mostrando solo sus hijos |
| ⏱️ **Cuándo** | Sin filtro activo: muestra todos. Con filtro activo: muestra solo los hijos del padre seleccionado, con el label "▸ NombrePadre" y el enlace "Ver Todos" |
| 📍 **Dónde** | Columna central del área principal |
| 💡 **Por qué** | Navegación contextual: al seleccionar "Rock" en padres, solo aparecen "Rock Alternativo", "Rock Clásico", etc. |

#### Columna "Sin Identificar" (`#list-sin-identificar`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Columna derecha, lista `#list-sin-identificar` con badge `#count-sin-identificar` |
| ⚡ **Qué** | Muestra géneros detectados automáticamente (importados desde metadatos de MP3/FLAC) que aún no han sido clasificados como padres o subgéneros |
| ⏱️ **Cuándo** | Siempre visible; badge muestra cuántos géneros pendientes de clasificar hay |
| 📍 **Dónde** | Columna derecha del área principal |
| 💡 **Por qué** | Cola de trabajo del curador: cada vez que se importan pistas nuevas con géneros desconocidos, aparecen aquí para clasificación manual |

#### Ítem de Género (elemento genérico en cualquier columna)
| Estado visual | Descripción |
|---|---|
| Normal | Fondo casi transparente, hover con `translateX(2px)` |
| `active` | Borde azul, fondo azul suave — género cargado en el formulario de edición |
| `multi-selected` | Borde azul con glow — seleccionado para unificación (Ctrl+Clic) |
| `duplicate` | Borde rojo, fondo rojo oscuro, texto rosado — marcado como duplicado posible |
| `duplicate + multi-selected` | Borde rojo con glow intenso — duplicado seleccionado para fusión |
| Con borde izquierdo azul | Género activo como filtro (padre o subgénero activo en el filtro) |

Cada ítem muestra: `NombreGénero` a la izquierda y `N ♫` (conteo de pistas) a la derecha.

**Interacción Ctrl+Clic:**
- Agrega/quita el ítem de la selección múltiple (`selectedKeys`)
- Si hay ≥ 2 géneros seleccionados, aparece la barra de unificación flotante

---

### 3. Barra de Unificación Flotante (`#unify-bar`)

| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Barra flotante con glassmorphism que aparece desde abajo (`bottom: -100px` → `bottom: 30px`) |
| ⚡ **Qué** | Aparece cuando hay 2 o más géneros seleccionados con Ctrl+Clic; muestra el conteo y ofrece el botón "Unificar (Resolver Duplicado)" |
| ⏱️ **Cuándo** | Solo visible con ≥ 2 géneros seleccionados. Desaparece al cancelar la selección o completar la fusión |
| 📍 **Dónde** | Flotante centrada en la parte inferior de la pantalla, sobre todos los demás elementos (z-index: 100) |
| 💡 **Por qué** | La presencia de duplicados ("Reggaeton" y "Reggaetón", "Rock & Roll" y "Rock And Roll") es un problema real en catálogos importados; esta barra agiliza la resolución |

**Texto dinámico:** "N géneros seleccionados para unificar" donde N cambia en tiempo real.

---

### 4. Modal de Unificación (`#unify-modal`)

Se activa al presionar el botón "Unificar (Resolver Duplicado)" en la barra flotante.

#### Selector de nombre que prevalece (`#unify-target`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select #unify-target>` dentro del modal |
| ⚡ **Qué** | Lista desplegable con los géneros seleccionados para fusionar. El operador elige cuál nombre y cuál ID será el "sobreviviente" de la fusión |
| ⏱️ **Cuándo** | Se llena dinámicamente con los géneros seleccionados al abrir el modal |
| 📍 **Dónde** | Modal centrado con backdrop semitransparente |
| 💡 **Por qué** | En una fusión, el género que "gana" es el que mantiene su ID en base de datos; todas las canciones de los otros IDs se reasignan a este ID automáticamente |

**Formato de cada opción:** `NombreGénero (N ♫)` — incluye el conteo de pistas para ayudar a elegir el "más completo".

#### Selector de Categoría Final (`#unify-target-type`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select #unify-target-type>` |
| ⚡ **Qué** | Define si el género resultante de la fusión será "Padre" o "Subgénero" |
| ⏱️ **Cuándo** | Pre-selecciona automáticamente según el tipo del primer género seleccionado |
| 📍 **Dónde** | Modal, debajo del selector de nombre |
| 💡 **Por qué** | La fusión puede cambiar la categoría: "Reggaeton" (sin_identificar) + "Reggaeton" (padre) → resultado: "Reggaeton" (padre) |

#### Botón Ejecutar Fusión (`#btn-confirm-unify`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón azul "Ejecutar Fusión" en el modal |
| ⚡ **Qué** | Ejecuta la fusión: el backend reasigna todas las canciones de los IDs "perdedores" al ID "ganador", y elimina los registros de los géneros fusionados |
| ⏱️ **Cuándo** | Se desactiva durante la operación (`disabled = true`) para evitar doble envío. Al completarse, cierra el modal y recarga el catálogo |
| 📍 **Dónde** | Modal, esquina inferior derecha |
| 💡 **Por qué** | Operación destructiva pero segura: consolida duplicados en un solo registro sin perder ninguna pista |

---

## 🖱️ Drag & Drop entre Columnas (Reclasificación)

| Evento | Comportamiento |
|---|---|
| `dragstart` en un ítem | Ítem se vuelve semitransparente (opacity: 0.4), guarda `draggedGenreKey` |
| `dragover` en una columna | Muestra resaltado azul (`boxShadow: inset 0 0 0 2px var(--accent)`) |
| `dragleave` en una columna | Quita el resaltado (solo si el cursor realmente salió de la columna) |
| `drop` en una columna | Reclasifica el género al tipo de esa columna via `genre-editor-reclassify`. Si se suelta en la columna de Subgéneros y hay un padre activo en el filtro, se asigna ese padre automáticamente |
| `dragend` | Restaura opacity a 1 |

**Regla de negocio:** Si se arrastra un género ya en esa categoría, no hace nada (evita llamadas innecesarias al backend).

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)
| Canal | Cuándo | Retorna |
|---|---|---|
| `genre-editor-get-catalog` | Al cargar la ventana y tras cada operación de guardado/eliminación/fusión | `{ genres: GenreItem[] }` donde cada item tiene `genreKey, displayName, tipo, parentGenre, trackCount, isDuplicate` |
| `genre-editor-save` | Al presionar "Guardar Cambios" | — (lanza excepción en error) |
| `genre-editor-delete` | Al presionar "Eliminar Registro" (con confirmación) | — |
| `genre-editor-reclassify` | Al soltar un ítem en una columna diferente (drag & drop) | `{ success: bool, error?: string }` |
| `genre-editor-merge-genres` | Al confirmar en el modal de unificación | — (lanza excepción en error) |

### Mensajes recibidos (`ipcRenderer.on`)
| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `genre-profiles-updated` | Emitido por el backend cuando otra parte del sistema modifica géneros | Recarga el catálogo completo (`loadCatalog()`) y actualiza las 3 columnas |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento v1.0 | Equivalente Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('genre-editor-get-catalog')` | `tauri::command get_genre_catalog() -> Vec<GenreItem>` |
| `ipcRenderer.invoke('genre-editor-save', {displayName, tipo, parentGenre})` | `tauri::command save_genre(name: String, tipo: GenreTipo, parent: Option<String>)` |
| `ipcRenderer.invoke('genre-editor-delete', genreKey)` | `tauri::command delete_genre(genre_key: String)` |
| `ipcRenderer.invoke('genre-editor-reclassify', {...})` | `tauri::command reclassify_genre(genre_key, tipo, parent_genre)` |
| `ipcRenderer.invoke('genre-editor-merge-genres', {...})` | `tauri::command merge_genres(target_key, source_keys: Vec<String>, final_type: GenreTipo)` |
| `ipcRenderer.on('genre-profiles-updated')` | `tauri::event emit_to("genre-editor", "genre-profiles-updated", ())` |
| Normalización de texto en JS (input handler) | Puede mantenerse en JS (WebView) o delegarse a `tauri::command normalize_genre_name(raw: String) -> String` |
| Drag & Drop HTML nativo | Compatible con WebView de Tauri sin cambios |
| Modal de unificación | Compatible con WebView de Tauri sin cambios |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
