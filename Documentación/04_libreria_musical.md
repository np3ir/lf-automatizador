# 04 — Librería Musical (Biblioteca de Canciones)
*Módulo: `frontend/libreria.html` + `frontend/libreria.js` | IPC: `backend/ipc/library.js`*

> **¿Qué es este módulo?**
> La Librería Musical es el corazón de la gestión de contenido del automatizador. Permite al operador de radio escanear carpetas del disco duro, visualizar miles de canciones en una tabla virtual de alto rendimiento, realizar búsquedas difusas por título/artista/género, y lanzar procesos masivos de análisis de audio y búsqueda de metadatos. Desde aquí se originan todas las pistas que luego se envían a los reproductores o a la playlist de emisión.

---

## 🪟 La Ventana

| Propiedad | Detalle |
|---|---|
| **Título** | Biblioteca de Música - LF Automatizador |
| **Modo** | Ventana secundaria flotante (se abre desde la ventana principal) |
| **Layout** | Tres zonas: barra de herramientas superior (`lib-header`) · explorador de archivos lateral izquierdo (`lib-sidebar`) · tabla de canciones central (`lib-content`) · barra de estado inferior (`lib-footer`) |
| **Comportamiento especial** | Renderizado virtual: solo pinta las filas visibles en pantalla (26 px por fila, con 50 filas de margen `OVERSCAN`). La tabla soporta decenas de miles de pistas sin degradación de rendimiento |
| **Selección de archivo** | Formatos de audio reconocidos: `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`, `.aac` |
| **Persistencia de sesión** | La lista de trabajo (rutas) y las carpetas raíz rastreadas se guardan en `config/lib_session.json` al cerrar o vaciar |
| **Preferencias** | Anchos de columna, carpeta raíz y opciones de carga automática se guardan en `config/library_prefs.json` |

---

## 🧩 Elementos de la Interfaz

### 1. Barra de Herramientas Superior (`lib-header`)

#### Campo de Búsqueda Fuzzy (`#lib-search-input`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Input de texto ancho que ocupa casi toda la barra superior |
| ⚡ **Qué** | Filtra la lista de canciones usando **Fuse.js** (búsqueda difusa) con un debounce de 300 ms. Busca simultáneamente en título (peso 0.38), artista (0.24), género (0.16), país del artista (0.10) y ruta completa (0.12). Umbral de coincidencia: 0.3 |
| ⏱️ **Cuándo** | Siempre que haya pistas cargadas en la lista de trabajo. Si el campo queda vacío, restaura la lista completa |
| 📍 **Dónde** | La tabla central se actualiza instantáneamente, mostrando solo las pistas coincidentes. El contador del pie también se actualiza |
| 💡 **Por qué** | Permite al operador encontrar una canción específica en segundos sin necesidad de filtros exactos ni conocer la ortografía exacta del artista |

**Estados del campo:**
- Vacío → muestra toda la lista de trabajo (`workQueueTracks`)
- Con texto → muestra `filteredTracks` resultado de Fuse.js
- El estado de ordenamiento de columnas se aplica **sobre** el resultado filtrado

---

#### Botón Refrescar (`#btn-refresh`, 🔄)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón icono en la barra superior |
| ⚡ **Qué** | Re-detecta las unidades de disco del sistema, verifica que las carpetas raíz rastreadas sigan existiendo, y vuelve a escanear las carpetas cargadas para detectar altas, bajas y reemplazos de archivos |
| ⏱️ **Cuándo** | Bloqueado mientras hay un proceso de análisis activo (`isAnalyzing = true`). Se deshabilita visualmente con la clase `ui-locked-buttons` |
| 📍 **Dónde** | La tabla se reconstruye con los archivos actuales en disco. Las pistas eliminadas del disco desaparecen de la lista |
| 💡 **Por qué** | Si el operador agrega música nueva a la carpeta de trabajo entre turnos, puede sincronizar la lista sin reiniciar la app |

---

#### Botón Mostrar Raíz (`#btn-load-root`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón de texto en la barra superior |
| ⚡ **Qué** | Si hay una carpeta raíz configurada: limpia la lista actual y la repuebla completa desde esa carpeta raíz. Si no hay carpeta configurada: abre el modal de Ajustes de Biblioteca para configurarla |
| ⏱️ **Cuándo** | Bloqueado durante análisis activo |
| 📍 **Dónde** | La lista de trabajo se reemplaza completamente. El texto del botón cambia dinámicamente: `📁 Mostrar Raíz` (si hay raíz) o `📁 Configurar Raíz` (si no la hay) |
| 💡 **Por qué** | Restauración rápida al estado de biblioteca completa, útil al inicio del turno cuando el operador quiere tener toda su música disponible |

---

#### Botón Ajustes de Biblioteca (`#btn-library-settings`, ⚙)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón icono en la barra superior |
| ⚡ **Qué** | Abre el modal `#library-settings-modal` con opciones de carpeta raíz persistente y comportamiento de carga automática |
| ⏱️ **Cuándo** | Siempre disponible |
| 📍 **Dónde** | Modal superpuesto con fondo oscuro difuminado |
| 💡 **Por qué** | Centraliza la configuración de biblioteca sin mezclarla con los controles de emisión |

---

#### Botón Centro de Procesamiento (`#btn-analyze-main`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón especial con barra de progreso integrada (clase `btn-progress`). Texto: `▶ Centro de Procesamiento` |
| ⚡ **Qué** | Abre el modal `#analysis-modal` con opciones de análisis masivo de audio y metadatos |
| ⏱️ **Cuándo** | Si la lista de trabajo está vacía y no hay análisis activo, muestra alerta. Solo disponible con pistas cargadas |
| 📍 **Dónde** | El botón cambia a modo naranja/amarillo (`working`) durante el proceso y muestra el porcentaje de progreso. Al terminar vuelve al estado normal |
| 💡 **Por qué** | Permite al operador procesar en lote la biblioteca completa antes de empezar la emisión, asegurando que todas las canciones tienen datos de inicio/fin/BPM |

**Estados visuales del botón:**
| Estado | Color | Texto |
|---|---|---|
| Inactivo | Verde oscuro (`#1e6c31`) | `▶ Centro de Procesamiento` |
| Procesando | Naranja (`#d35400`) + barra amarilla | `Procesando... 45%` |
| Completado | Verde oscuro (restaurado) | `▶ Centro de Procesamiento` |

---

### 2. Explorador de Archivos Lateral (`lib-sidebar`)

#### Árbol de Navegación Local (`#lib-explorer`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Panel lateral izquierdo (280 px de ancho) con árbol de nodos expandibles |
| ⚡ **Qué** | Navega por el sistema de archivos local. Muestra accesos rápidos (Escritorio, Descargas, Música) y todas las unidades de disco detectadas |
| ⏱️ **Cuándo** | Los nodos se cargan perezosamente: al expandir una carpeta por primera vez, pide el contenido al backend vía IPC |
| 📍 **Dónde** | Indicador de carga `⏳` visible en el encabezado del sidebar durante la solicitud |
| 💡 **Por qué** | Permite explorar el disco sin abrir el explorador del sistema operativo, manteniendo el foco en la app de radio |

**Nodos raíz siempre visibles:**
| Icono | Nombre | Descripción |
|---|---|---|
| 💻 | Escritorio | `app.getPath('desktop')` (solo Windows) |
| 📥 | Descargas | `app.getPath('downloads')` |
| 🎵 | Música | `app.getPath('music')` |
| 💽 | Disco Local (X:) | Cada unidad detectada por `wmic logicaldisk` (Windows) o puntos de montaje `/media` y `/mnt` (Linux) |

**Interacciones con nodos del árbol:**

| Acción | Comportamiento |
|---|---|
| **Clic simple** | Selecciona el nodo (resaltado azul `active`). Limpia selección previa |
| **Ctrl + Clic** | Agrega o quita el nodo de la selección múltiple |
| **Shift + Clic** | Selecciona rango de nodos visibles entre el último seleccionado y el actual |
| **Doble clic en carpeta** | Expande/colapsa el árbol de esa carpeta |
| **Doble clic en archivo de audio** | Carga el archivo (o la selección múltiple) a la lista de trabajo |
| **Clic en `▶` (caret)** | Expande/colapsa la carpeta (igual que doble clic) |
| **Drag & drop desde árbol → tabla** | Arrastra carpeta(s) o archivo(s) hacia la zona de la tabla para cargarlos |

---

### 3. Zona de la Tabla de Canciones (`lib-content` / `#lib-dropzone`)

#### Zona de Arrastrar y Soltar
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | La sección central completa actúa como zona de drop |
| ⚡ **Qué** | Acepta rutas de archivos o carpetas arrastradas desde el explorador del sistema operativo o desde el árbol lateral |
| ⏱️ **Cuándo** | Deshabilitado durante análisis activo |
| 📍 **Dónde** | Borde azul pulsante (`box-shadow: inset 0 0 0 2px #00a8ff`) mientras el elemento está siendo arrastrado sobre la zona |
| 💡 **Por qué** | Flujo de trabajo natural: el operador arrastra una carpeta de géneros directamente a la biblioteca |

**Tipos de datos aceptados en el drop:**
- Archivos del SO: usa `e.dataTransfer.files`
- Items internos (del árbol): usa `application/json` con array de rutas
- Item interno único: usa `text/plain` con la ruta

---

#### Mensaje de Lista Vacía (`#empty-queue`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Texto centrado superpuesto a la tabla |
| ⚡ **Qué** | Solo visible cuando no hay pistas cargadas. Indica al operador cómo empezar |
| ⏱️ **Cuándo** | Se oculta automáticamente en cuanto hay al menos 1 pista en la lista |
| 📍 **Dónde** | Centro de la zona de contenido |
| 💡 **Por qué** | Guía al operador nuevo sin necesidad de leer un manual |

---

#### Encabezado de Tabla con Columnas Ordenables y Redimensionables

**Columnas de la tabla** (orden y ancho predeterminado):

| # | ID | Título | Ancho (px) | Ancho Mínimo (px) |
|---|---|---|---|---|
| 1 | `status` | Estado | 50 | 50 |
| 2 | `fullPath` | Ruta Completa | 230 | 180 |
| 3 | `title` | Título | 160 | 140 |
| 4 | `artist` | Artista | 130 | 120 |
| 5 | `album` | Álbum | 120 | 120 |
| 6 | `genre` | Género | 110 | 105 |
| 7 | `year` | Año | 50 | 50 |
| 8 | `inicio` | Ini (s) | 55 | 55 |
| 9 | `mix` | Mix (s) | 55 | 55 |
| 10 | `fin` | Fin (s) | 55 | 55 |
| 11 | `db` | dB | 60 | 60 |

**Interacciones con el encabezado:**

| Acción | Comportamiento |
|---|---|
| **Clic en columna** | Ordena por esa columna (▲ ascendente). Segundo clic invierte (▼ descendente). Columnas numéricas (`inicio`, `fin`, `mix`, `db`, `year`) ordenan numéricamente |
| **Arrastrar borde derecho de columna** | Redimensiona el ancho de la columna en tiempo real. El ancho se persiste en `library_prefs.json` |
| **Clic derecho en columna `dB`** | Muestra menú contextual para cambiar modo de visualización: **Modo DJ (Pico)** o **Modo Estudio (Promedio)**. La preferencia se guarda en `localStorage` como `lib_db_view_mode` |

---

#### Filas de la Tabla de Pistas (Tabla Virtual)

**Columna Estado (`status`):**

| Badge | Color | Código | Significado |
|---|---|---|---|
| `⏳` | Amarillo (`status-pending`) | `0` | Sin análisis: faltan datos de inicio/fin/mix/dB |
| `✅` | Verde (`status-ok`) | `1` | Completo: tiene todos los datos de audio |
| `♻` | Naranja (`status-changed`) | `2` | Archivo cambiado: el archivo en disco fue modificado desde el último análisis; conviene reanalizar |

**Columna Título:**
- Si la pista tiene `metaError = true`: muestra `⚠️` en rojo seguido del título
- Si no tiene error: muestra título en blanco

**Columna dB:**
- En **Modo DJ (Pico)**: muestra `peak_db` (valor de pico de la onda)
- En **Modo Estudio (Promedio)**: muestra `db` (volumen RMS promedio)
- Formato: `{valor} dB`

**Selección de filas:**

| Acción | Comportamiento |
|---|---|
| **Clic simple** | Selecciona solo esa fila (resaltado azul) |
| **Ctrl + Clic** | Agrega/quita la fila de la selección múltiple |
| **Shift + Clic** | Selecciona rango desde la última fila seleccionada hasta la actual |
| **Clic derecho** | Si la fila no estaba seleccionada: la selecciona primero. Luego abre el menú contextual |
| **↑ / ↓** | Navega fila a fila. La tabla hace scroll automático para mantener la selección visible |
| **Ctrl + A** | Selecciona todas las pistas del filtro actual |
| **Delete** | Elimina las pistas seleccionadas de la lista de trabajo (NO borra el archivo del disco ni la base de datos) |

**Drag & Drop desde la tabla hacia los reproductores:**

| Acción | Datos enviados |
|---|---|
| Arrastrar 1 pista | `text/plain` con la ruta absoluta del archivo |
| Arrastrar N pistas seleccionadas | `application/json` con array de rutas + `text/plain: 'multiple_internal_rows'` |
| La pista arrastrada se auto-selecciona | Si se arrastra una pista que no estaba seleccionada, se deselecciona todo y se selecciona solo la arrastrada |

---

### 4. Menú Contextual de Pistas (`#lib-context-menu`)

Se abre con **clic derecho** sobre cualquier fila de la tabla. Opera sobre la selección actual.

#### 🔊 Escucha Previa (`#ctx-preview`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Abre el reproductor de previa con la primera pista seleccionada |
| ⏱️ **Cuándo** | Solo con 1 o más pistas seleccionadas (usa `selectedPaths[0]`) |
| 📍 **Dónde** | Abre ventana de previa independiente |
| 💡 **Por qué** | El operador puede escuchar rápidamente una canción antes de incluirla en la emisión |

#### ➕ Añadir a la Playlist (`#ctx-add-playlist`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Envía todas las pistas seleccionadas a la playlist de emisión |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas |
| 📍 **Dónde** | Las pistas aparecen al final de la cola de reproducción |
| 💡 **Por qué** | Flujo principal de trabajo: buscar en biblioteca → añadir a playlist → emitir |

#### 🎧 Editor de Pistas Avanzado (`#ctx-edit-audio`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Abre el Editor de Pistas Avanzado con la primera pista seleccionada |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas (usa `selectedPaths[0]`) |
| 📍 **Dónde** | Ventana de editor de pistas avanzado |
| 💡 **Por qué** | Ajuste manual fino de puntos de entrada, mezcla y cuñas para canciones específicas |

#### 🏷️ Leer Metadatos Locales (`#ctx-read-meta`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Lee las etiquetas ID3/Vorbis del archivo MP3/FLAC en disco y guarda título/artista/álbum/año/género en la base de datos |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas |
| 📍 **Dónde** | Activa la barra de progreso en el pie y el modal de procesamiento |
| 💡 **Por qué** | Para pistas con tags bien etiquetadas, es más rápido leer del archivo que buscar en Internet |

#### 💾 Incrustar Metadatos al MP3 (`#ctx-embed-meta`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Escribe los metadatos guardados en la base de datos como tags físicos dentro del archivo MP3 |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas |
| 📍 **Dónde** | Modifica el archivo físico en disco. Muestra progreso |
| 💡 **Por qué** | Asegura que la metadata de la estación quede incrustada en el archivo para compatibilidad con otros softwares |

#### 🧹 Eliminar puntos Inicio/Fin/Mix (`#ctx-clear-cues`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Borra los valores de `inicio`, `fin` y `mix` en la base de datos para las pistas seleccionadas, requiere confirmación |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas. Solicita `confirm()` antes de proceder |
| 📍 **Dónde** | La tabla se actualiza inmediatamente (el badge de estado vuelve a `⏳`) |
| 💡 **Por qué** | Permite re-analizar pistas con datos incorrectos de corte/mezcla |

#### 🧼 Eliminar Metadatos (`#ctx-clear-meta`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Borra título, artista, álbum, año, género, subgénero, géneros JSON y enlaces de artista/género en la base de datos, requiere confirmación |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas. Solicita `confirm()` |
| 📍 **Dónde** | La tabla muestra el nombre del archivo como título temporal |
| 💡 **Por qué** | Restablece pistas con metadatos erróneos para volver a buscarlos desde cero |

#### 🗑️ Eliminar todo de la Base de Datos (`#ctx-delete-db`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Elimina el registro completo de las pistas seleccionadas en la base de datos (cues + metadatos + firma de archivo), requiere confirmación |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas. Solicita `confirm()`. **No elimina el archivo físico** |
| 📍 **Dónde** | La tabla muestra la pista como nueva (badge `⏳`, sin datos) |
| 💡 **Por qué** | Limpieza profunda cuando una pista fue reemplazada por una versión diferente |

#### Editar género / estilo (`#ctx-edit-genre`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Abre el modal de edición de género (`#track-genre-modal`) para asignar manualmente género y subgénero a la(s) pista(s) seleccionadas |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas |
| 📍 **Dónde** | Modal con campos de texto y lista de géneros guardados |
| 💡 **Por qué** | Clasificación manual cuando el género automático no es correcto o cuando el operador quiere un criterio propio de estación |

#### Género desde carpeta (`#ctx-sync-folder-genre`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Infiere el género desde el nombre de la carpeta que contiene cada pista seleccionada y lo aplica automáticamente |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas. Solicita `confirm()` antes de proceder |
| 📍 **Dónde** | Base de datos actualizada; tabla refleja el nuevo género |
| 💡 **Por qué** | Para estaciones con música organizada por carpetas de género (e.g., `/Salsa/`, `/Rock/`), es el método más rápido de clasificación |

#### Editar cédula de artista (`#ctx-edit-artist-card`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Abre la ventana de Cédula de Artista (`artist_card.html`) para la primera pista seleccionada |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas (usa `selectedPaths[0]`) |
| 📍 **Dónde** | Nueva ventana del editor de artista |
| 💡 **Por qué** | Información biográfica y de perfil del artista enriquece las menciones del locutor en antena |

#### Actualizar cédula de artista (`#ctx-rebuild-artist-card`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Reconstruye automáticamente el perfil del artista para las pistas seleccionadas (re-enlaza tracks, cuenta artistas) |
| ⏱️ **Cuándo** | Con 1 o más pistas seleccionadas |
| 📍 **Dónde** | Muestra alerta con resumen: pistas enlazadas y artistas detectados |
| 💡 **Por qué** | Mantiene el catálogo de artistas actualizado tras importaciones masivas |

---

### 5. Barra de Estado Inferior (`lib-footer`)

#### Contador de Pistas (`#lib-status-count`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Muestra `Mostrando: X / Lista Total: Y pistas` cuando hay filtro activo, o `Lista: 0 pistas` cuando está vacía |
| 📍 **Dónde** | Esquina inferior izquierda |
| 💡 **Por qué** | El operador sabe cuántas canciones están en la búsqueda actual vs. el total de la biblioteca |

#### Estado de Proceso (`#lib-processing-status`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Texto azul en el pie que muestra el proceso activo y el progreso `(N/Total)`. Se oculta automáticamente 3 segundos después de terminar |
| ⏱️ **Cuándo** | Solo visible durante análisis activo |
| 📍 **Dónde** | Junto al contador de pistas |
| 💡 **Por qué** | Visibilidad del progreso incluso si el modal de análisis está oculto |

#### Botón Detener (`#btn-stop-inline`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Detiene el proceso de análisis activo. Alias del botón `⏹ Detener Proceso` del modal |
| ⏱️ **Cuándo** | Solo visible durante análisis activo |
| 📍 **Dónde** | Junto al estado de proceso en el pie |
| 💡 **Por qué** | Permite cancelar sin tener que abrir el modal de procesamiento |

#### Botón Abrir Lista (`#btn-open-list`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Abre un diálogo para cargar una lista de trabajo previamente guardada (JSON de pistas) |
| ⏱️ **Cuándo** | Bloqueado durante análisis activo |
| 📍 **Dónde** | La lista de trabajo se reemplaza con el contenido del archivo cargado |
| 💡 **Por qué** | El operador puede preparar listas de trabajo para días o programas específicos |

#### Botón Guardar Lista (`#btn-save-list`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Abre diálogo para guardar la lista de trabajo actual (incluyendo todos los metadatos) como archivo JSON |
| ⏱️ **Cuándo** | No actúa si la lista está vacía |
| 📍 **Dónde** | Archivo JSON en la ruta elegida por el operador |
| 💡 **Por qué** | Permite preparar setlists o listas de trabajo temáticas reutilizables |

#### Botón Vaciar Lista (`#btn-clear-list`, clase `btn-danger`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Muestra un diálogo de confirmación de 3 opciones. Si el usuario confirma, vacía completamente la lista de trabajo y limpia las carpetas raíz rastreadas |
| ⏱️ **Cuándo** | Bloqueado durante análisis activo. No actúa si la lista ya está vacía |
| 📍 **Dónde** | La tabla queda vacía, el buscador se limpia, `lib_session.json` se actualiza |
| 💡 **Por qué** | Permite empezar desde cero para cargar una biblioteca completamente diferente |

---

### 6. Modal: Ajustes de Biblioteca (`#library-settings-modal`)

Accesible desde el botón ⚙ de la barra superior.

#### Campo Carpeta Raíz (`#library-root-path`)
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Campo de texto de solo lectura que muestra la ruta de la carpeta raíz persistente configurada |
| 📍 **Dónde** | Si la carpeta fue movida o desconectada, el estado indica: "La carpeta configurada no está disponible ahora mismo" |
| 💡 **Por qué** | Una carpeta raíz fija es la fuente principal de música, independiente de la lista temporal |

**Botones dentro del ajuste de carpeta raíz:**
| Botón | Acción |
|---|---|
| `Examinar...` | Abre selector de carpeta del SO vía `dialog:selectFolder` |
| `Quitar` | Limpia la carpeta raíz configurada y desmarca las opciones de carga automática |
| `Cargar Ahora` | Cierra el modal e inmediatamente carga la carpeta raíz en la lista de trabajo |
| `Guardar` | Guarda las preferencias y cierra el modal |

**Opciones de la carpeta raíz:**

| ID | Opción | Comportamiento |
|---|---|---|
| `#chk-lib-auto-root` | Cargar la carpeta raíz al abrir la biblioteca | Si la lista está vacía al abrir la librería, la repuebla automáticamente |
| `#chk-lib-root-rescan` | Reescanear la carpeta raíz al abrir | Detecta nuevos archivos/cambios en el disco al inicio. Puede tardar más con miles de pistas |

#### Botón Asistente de Géneros
| Pregunta | Respuesta |
|---|---|
| ⚡ **Qué** | Abre el modal `#genre-assistant-modal` para mapear carpetas de la raíz musical a géneros/subgéneros de la base de datos |
| ⏱️ **Cuándo** | Requiere carpeta raíz configurada. Si no la hay, la solicita primero |
| 📍 **Dónde** | Modal del asistente de géneros |
| 💡 **Por qué** | Primer uso: establece la taxonomía musical de la estación mapeando la organización de carpetas existente |

---

### 7. Modal: Asistente de Géneros (`#genre-assistant-modal`)

Diseñado para el primer uso o cuando se reorganiza la biblioteca musical.

#### Tabla del Asistente
| Columna | Descripción |
|---|---|
| **Usar** | Checkbox para incluir/excluir esa carpeta del proceso |
| **Carpeta** | Nombre de la carpeta (subcarpetas con sangría `-`) |
| **Género** | Campo editable con el género propuesto (inferido del nombre de carpeta) |
| **Subgénero** | Campo editable con el subgénero propuesto |
| **Pistas** | Cantidad de archivos de audio encontrados en esa carpeta |

**Controles del asistente:**
| Control | Acción |
|---|---|
| `Seleccionar todo` | Marca todos los checkboxes de la tabla |
| `Limpiar` | Desmarca todos los checkboxes |
| Checkbox `Aplicar también a las canciones dentro de esas carpetas` | Si activo, además de crear los perfiles de género, asigna el género a cada canción de las carpetas seleccionadas |
| `Guardar selección` | Persiste los géneros en la base de datos y cierra el modal automáticamente tras 0.9 s |
| `Cancelar` | Cierra el modal sin guardar |

---

### 8. Modal: Edición de Género de Pista (`#track-genre-modal`)

Accesible desde el menú contextual → "Editar género / estilo".

#### Campos de Género
| ID | Campo | Descripción |
|---|---|---|
| `#track-genre-name` | Género principal | Texto libre con autocompletado (`datalist`) de géneros guardados en la BD |
| `#track-subgenre-name` | Subgénero / estilo | Texto libre con mismo autocompletado |

#### Picker de Géneros Guardados
Lista visual de géneros ya existentes en la base de datos, organizados en tres grupos:
- **GÉNEROS PADRE (RAÍZ)**: géneros de nivel superior
- **SUBGÉNEROS**: géneros secundarios con padre definido
- **SIN IDENTIFICAR**: géneros sin clasificar

Cada género del picker tiene dos botones: `A género` y `A subgénero`, que llenan los campos correspondientes con un clic.

**Pie del modal:**
| Botón | Acción |
|---|---|
| `Cancelar` | Cierra el modal sin guardar |
| `Aplicar a canciones` | Guarda el género en la BD para todas las pistas seleccionadas. Requiere que `Género principal` no esté vacío |

**Información contextual (`#track-genre-summary`):**
- Si 1 pista: "Editando género de: [Título de la pista]"
- Si N pistas: "El género se aplicará a N pista(s) seleccionada(s)"

---

### 9. Modal: Centro de Procesamiento Masivo (`#analysis-modal`)

Accesible desde el botón `▶ Centro de Procesamiento` de la barra superior.

#### Pestaña 🌊 Analizador Automático (`#tab-audio`)

**Motor de análisis:**
| Opción | Descripción |
|---|---|
| **Motor Rust** (predeterminado) | Usa el motor nativo de alto rendimiento para análisis de la cola completa |
| **FFmpeg** | Motor anterior, disponible para comparar resultados o como respaldo |

**Tareas disponibles** (checkboxes individuales):
| ID | Tarea | Notas |
|---|---|---|
| `#chk-task-gain` | Analizar Volumen Promedio (dB) | Activo por defecto. Calcula energía de la canción como dato informativo |
| `#chk-task-cues` | Detectar Inicio, Fin y Punto Mix | Activo por defecto. Corta silencios y detecta el cruce automático |
| `#chk-master-all` | Analizar Todo | Checkbox maestro: activa/desactiva los tres a la vez |
| `#chk-task-bpm` | Analizar Ritmo (BPM) | Desactivo por defecto. **Alta carga de recursos.** |

**Umbrales de detección personalizables** (oculto por defecto, activar con `#chk-custom-db`):
| Campo | Valor predeterminado | Descripción |
|---|---|---|
| `#val-db-mix` | -14 dB | Umbral del Punto de Mezcla/Cruce |
| `#val-db-start` | -36 dB | Umbral de detección de inicio (fin del silencio inicial) |
| `#val-db-fin` | -48 dB | Umbral de detección de fin (corte de cola) |

**Comportamiento con pistas existentes:**
| Opción | Descripción |
|---|---|
| `scope-skip` (predeterminado) | Omite pistas que ya tienen los datos solicitados |
| `scope-force` | Re-analiza y sobreescribe toda la lista sin excepción |

#### Pestaña 🏷️ Metadatos (`#tab-meta`)

**Fuente de metadatos:**
| Opción | Descripción |
|---|---|
| `meta-source-internet` (predeterminado) | Busca en MusicBrainz (con respaldo en iTunes) la versión más antigua del tema |
| `meta-source-local` | Lee tags existentes del archivo MP3/FLAC. No inventa BPM |

**Comportamiento con pistas existentes:**
| Opción | Descripción |
|---|---|
| `scope-meta-skip` (predeterminado) | Omite pistas que ya tienen los campos solicitados |
| `scope-meta-force` | Re-busca y sobreescribe toda la lista |

**Nota importante del modal:**
> Los datos de metadatos se guardan temporalmente en la Base de Datos. Para incrustarlos físicamente al archivo, el operador debe usar "Incrustar Metadatos al MP3" del menú contextual.

#### Barra de Progreso del Modal (`#modal-progress-section`)

Solo visible durante el proceso activo:
- Nombre del archivo actual y progreso `(N/Total)`
- Porcentaje numérico y barra visual
- Aviso de cancelación: "Deteniendo al terminar la pista actual... (Máximo 10s por pista)"

**Botones del modal:**
| ID | Botón | Visible | Acción |
|---|---|---|---|
| `#btn-modal-start` | `▶ Iniciar Proceso` | Antes del inicio | Lanza el proceso masivo |
| `#btn-modal-cancel` | `Cerrar` | Antes del inicio | Cierra el modal |
| `#btn-modal-hide` | `👁️ Ocultar ventana` | Durante proceso | Oculta el modal (el proceso sigue en el pie) |
| `#btn-modal-stop` | `⏹ Detener Proceso` | Durante proceso | Cancela el proceso. El botón de estado en pie también lo detiene |

---

### 10. Modal: Importación Masiva (`#import-modal`)

Modal no interactivo que aparece automáticamente durante el escaneo de carpetas.

| Campo | Descripción |
|---|---|
| `#import-status-text` | Mensaje de estado: "Escaneando directorios..." → "Leyendo datos guardados..." → "Agregando a la lista: N de Total" |
| `#import-progress-fill` | Barra de progreso azul |
| `#import-progress-percent` | Porcentaje grande en verde (`0%` a `100%`) |

El escaneo procesa en chunks de 1000 archivos por frame de animación para no congelar la UI. El modal se cierra solo al finalizar.

---

### 11. Menú Contextual de la Columna dB (`#db-header-menu`)

Accesible con **clic derecho en el encabezado de la columna `dB`**.

| Opción ID | Modo | Descripción |
|---|---|---|
| `#ctx-db-peak` | `peak` | **Modo DJ (Pico)**: muestra el valor de pico de la forma de onda |
| `#ctx-db-rms` | `rms` | **Modo Estudio (Promedio)**: muestra el nivel RMS promedio |

La opción activa muestra `✓` como prefijo. La preferencia se persiste en `localStorage`.

---

## ⌨️ Atajos de Teclado

| Atajo | Contexto | Acción |
|---|---|---|
| `Delete` | Tabla con selección, sin análisis activo | Elimina las pistas seleccionadas de la lista de trabajo (no del disco) |
| `Ctrl + A` | Tabla con pistas | Selecciona todas las pistas visibles del filtro actual |
| `↑` | Tabla con pistas | Mueve la selección una fila hacia arriba. Con `Shift`: extiende la selección |
| `↓` | Tabla con pistas | Mueve la selección una fila hacia abajo. Con `Shift`: extiende la selección |

> **Nota:** Los atajos se deshabilitan automáticamente cuando el foco está en un campo de texto (`e.target.tagName === 'INPUT'`).

---

## 📡 Mapa de Comunicación IPC

### Mensajes enviados al Backend (`ipcRenderer.send`)

| Canal | Cuándo | Datos |
|---|---|---|
| `open-preview` | Clic en "🔊 Escucha previa" | `filePath: string` — ruta de la primera pista seleccionada |
| `lib-add-to-playlist` | Clic en "➕ Añadir a la Playlist" | `Array<string>` — rutas de todas las pistas seleccionadas |
| `open-audio-editor` | Clic en "🎧 Editor de Pistas Avanzado" | `filePath: string` — primera pista seleccionada |
| `open-artist-card-editor` | Clic en "Editar cédula de artista" | `filePath: string` — primera pista seleccionada |
| `lib-clear-cues` | Confirmar "🧹 Eliminar puntos Inicio/Fin/Mix" | `Array<string>` — rutas seleccionadas |
| `lib-clear-meta` | Confirmar "🧼 Eliminar Metadatos" | `Array<string>` — rutas seleccionadas |
| `lib-delete-db-tracks` | Confirmar "🗑️ Eliminar todo de la BD" | `Array<string>` — rutas seleccionadas |
| `lib-start-meta-local-read` | Clic en "🏷️ Leer Metadatos Locales" o proceso masivo de lectura local | `Array<{filePath, forceOverwrite}>` |
| `lib-start-meta-local-write` | Clic en "💾 Incrustar Metadatos al MP3" | `Array<string>` — rutas seleccionadas |
| `lib-start-meta-internet` | Proceso masivo → fuente Internet | `Array<{filePath, forceOverwrite}>` |
| `lib-start-analyzer-ffmpeg` | Proceso masivo → análisis de audio | `Array<{filePath, dbMix, dbStart, dbFin, analyzerProvider, forceOverwrite}>` |
| `save-file-sync` | Guardar Lista | `filePath: string, content: string` (JSON de pistas) |

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo | Retorna |
|---|---|---|
| `get-default-paths` | Inicialización del explorador | `{desktop, downloads, music, home?}` — rutas del sistema |
| `get-system-drives` | Inicialización y al refrescar | `Array<string>` — unidades del sistema (e.g., `['C:\\', 'D:\\']`) |
| `lib-read-dir` | Expandir nodo del árbol (shallow) o escanear carpeta (recursivo) | `{success, dirs: Array<string>, files: Array<{path, name}>}` |
| `lib-get-db-tracks` | Al cargar sesión, al refrescar, al importar masivamente | `{[filePath]: trackData}` — datos de BD por cada ruta |
| `lib-preview-root-genres` | Abrir asistente de géneros | `{success, items: Array<{name, path, depth, suggestedGenre, suggestedSubgenre, trackCount}>}` |
| `lib-apply-folder-genres` | Confirmar asistente de géneros | `{success, updatedTracks, savedFolders, details}` |
| `lib-set-track-genre` | Confirmar modal de edición de género | `{success}` |
| `lib-sync-folder-genre` | Confirmar "Género desde carpeta" | `{success, updatedTracks}` |
| `lib-get-genre-profiles` | Inicialización y tras cambios de género | `Array<{genreKey, displayName, tipo, parentGenre, trackCount}>` |
| `lib-rebuild-artist-profiles` | Clic en "Actualizar cédula de artista" | `{success, linkedTracks, linkedArtists}` |
| `dialog:selectFolder` | Botón "Examinar..." en ajustes y en asistente | `string` — ruta seleccionada o `null` |
| `dialog:saveLibraryList` | Botón "💾 Guardar Lista" | `string` — ruta de archivo o `null` |
| `dialog:openLibraryList` | Botón "📂 Abrir Lista" | Maneja internamente la apertura y carga |
| `dialog:askClearLibrary` | Botón "🧹 Vaciar" | `0` (Guardar y vaciar) / `1` (Solo vaciar) / `2` (Cancelar) |

### Mensajes recibidos (`ipcRenderer.on`)

| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `analyzer-done` | El backend termina de analizar 1 pista (Rust o FFmpeg) | Actualiza `db`, `peak_db`, `inicio`, `mix`, `fin` de la pista en la tabla. Actualiza barra de progreso |
| `meta-local-read-done` | El backend termina de leer tags de 1 archivo | Actualiza `title`, `artist`, `album`, `year`, `genre` en la tabla |
| `meta-local-write-done` | El backend termina de escribir tags en 1 archivo MP3 | Actualiza barra de progreso |
| `meta-net-done` | El backend termina de buscar metadatos en Internet para 1 pista | Actualiza metadatos en la tabla |
| `refresh-manual-cues` | Cualquier módulo modifica datos en la BD (editor de artistas, cédula, etc.) | Recarga todos los datos de la BD para las pistas en lista y re-renderiza la tabla |

---

## 🔧 Lógica Interna Destacada

### Sistema de Renderizado Virtual
La tabla usa renderizado virtual para soportar decenas de miles de canciones:
- Solo renderiza las filas del viewport + 50 filas de margen (`OVERSCAN`)
- Altura de fila fija: 26 px
- Un `virtual-spacer` invisible mantiene la altura total del scroll
- La tabla se posiciona con `translateY` en lugar de paginación

### Motor de Búsqueda Fuse.js
```
Configuración:
  - keys: title (0.38), artist (0.24), genre (0.16), artistCountry (0.10), fullPath (0.12)
  - threshold: 0.3 (coincidencia bastante estricta)
  - ignoreLocation: true (busca en toda la cadena, no solo al inicio)
  - useExtendedSearch: true (soporta operadores como `!`, `'`, `^`, `$`)
  - Debounce de 300 ms sobre el input
```

### Estados de Pista (Track Status)
| Código | Condición |
|---|---|
| `0` (Pendiente) | Falta al menos uno de: `inicio`, `mix`, `fin`, `db` |
| `1` (Completo) | Tiene todos los campos: `inicio`, `mix`, `fin`, `db` |
| `2` (Cambiado) | `fileChanged === true` (el archivo en disco cambió desde el último análisis) |

### Procesamiento en Chunks (processPathsMassively)
El escaneo de carpetas y la carga de pistas se realizan en bloques de 1000 elementos por frame de animación (`setTimeout(processChunk, 15)`) para evitar que la UI se congele con bibliotecas grandes.

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Canal IPC actual | Equivalente en Tauri/Rust | Notas |
|---|---|---|
| `get-default-paths` | `tauri::command` retornando `dirs::download_dir()`, `dirs::audio_dir()`, etc. | Usar crate `dirs` |
| `get-system-drives` | `tauri::command` con lógica de `wmic` en Windows / leer `/proc/mounts` en Linux | Puede ser un `async_command` |
| `lib-read-dir` | `tauri::command` con `std::fs::read_dir()` | Distinguir `recursive: bool` |
| `lib-get-db-tracks` | `tauri::command` con consulta SQLite vía `rusqlite` | Procesamiento en batches de 500 ya implementado en el backend actual |
| `lib-get-db-track` | `tauri::command` individual | Para uso rápido del editor |
| `lib-save-db-track` | `tauri::command` con transacción SQLite | Incluye normalización de artista y sync de links |
| `lib-delete-db-tracks` | `tauri::command` + evento `emit` para `refresh-manual-cues` | Usar `app_handle.emit_all()` |
| `lib-clear-cues` | `tauri::command` + evento `refresh-manual-cues` | UPDATE simple en SQLite |
| `lib-clear-meta` | `tauri::command` + evento `refresh-manual-cues` | UPDATE + DELETE en múltiples tablas |
| `lib-start-analyzer-ffmpeg` | `tauri::command` lanzando proceso hijo de análisis Rust nativo | El motor Rust ya existe; en v2 puede ser inline |
| `lib-start-meta-local-read` | `tauri::command` usando `id3` o `lofty` crate para leer tags | |
| `lib-start-meta-local-write` | `tauri::command` usando `lofty` para escribir tags | |
| `lib-start-meta-internet` | `tauri::command` con `reqwest` hacia MusicBrainz/iTunes API | |
| `lib-preview-root-genres` | `tauri::command` que lee el árbol de carpetas y hace sugerencias | |
| `lib-apply-folder-genres` | `tauri::command` con transacción masiva SQLite | |
| `lib-set-track-genre` | `tauri::command` | |
| `lib-sync-folder-genre` | `tauri::command` que infiere género del nombre de carpeta | |
| `lib-get-genre-profiles` | `tauri::command` consultando `genre_profiles` + `track_genre_links` | |
| `lib-rebuild-artist-profiles` | `tauri::command` asíncrono delegado a `tauri::async_runtime::spawn` | |
| `analyzer-done` | Evento Tauri: `app_handle.emit_to("libreria", "analyzer-done", payload)` | |
| `meta-*-done` | Eventos Tauri equivalentes por tipo de procesamiento | |
| `refresh-manual-cues` | Evento Tauri broadcast a la ventana de librería | |
| `open-preview` | `tauri::command` que abre ventana de previa | |
| `lib-add-to-playlist` | `tauri::command` que agrega pistas a la playlist activa | |
| `open-audio-editor` | `tauri::command` que abre ventana del editor | |
| `open-artist-card-editor` | `tauri::command` que abre ventana de cédula de artista | |
| `dialog:selectFolder` | `tauri::api::dialog::blocking::FileDialogBuilder::new().pick_folder()` | |
| `dialog:saveLibraryList` | `tauri::api::dialog::blocking::FileDialogBuilder::new().save_file()` | |
| `dialog:openLibraryList` | `tauri::api::dialog::blocking::FileDialogBuilder::new().pick_file()` | |
| `dialog:askClearLibrary` | `tauri::api::dialog::blocking::ask()` o panel de confirmación personalizado | |
| `save-file-sync` | `tauri::command` con `std::fs::write()` | |
| `localStorage` para `lib_db_view_mode` | Mantener en `localStorage` de WebView o persistir en `tauri::plugin::store` | |
| Sesión (`lib_session.json`) | Persistir en `app_data_dir()` vía `std::fs` | |
| Preferencias (`library_prefs.json`) | Persistir en `app_config_dir()` o vía `tauri::plugin::store` | |

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
