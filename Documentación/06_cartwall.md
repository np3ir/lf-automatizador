# 06 — CartWall (Botonera de Efectos)
*Módulo: `cartwall.html` + `cartwall.js` | IPC: `backend/ipc/cartwall.js`*

> **¿Qué es este módulo?**
> La Botonera de Efectos es una ventana flotante (o acoplada a la consola principal) que permite al operador de radio reproducir sonidos pregrabados de forma instantánea con un solo clic. Funciona como un tablero de botones físicos digitalizados, cada uno con un efecto de sonido, jingle o locución asignada.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| Título | 🎛️ Botonera de efectos |
| Modo | Flotante (ventana independiente) o Acoplada a la consola principal |
| Comportamiento | Sin barra de título de Windows — usa barra personalizada con zona de arrastre |

---

## 🧩 Elementos de la Interfaz

### 1. Barra Superior

#### 👤 Botón de Perfil (`#cw-profile-button`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón en la esquina superior derecha que muestra el nombre del perfil activo |
| ⚡ **Qué** | Abre un menú desplegable flotante con opciones de gestión de perfiles |
| ⏱️ **Cuándo** | Siempre disponible. No requiere ninguna condición previa |
| 📍 **Dónde** | Aparece un menú contextual debajo del botón con las opciones de perfil |
| 💡 **Por qué** | Permite al operador tener múltiples configuraciones de botonera (ej: "Noticias", "Música", "Especial") y cambiar entre ellas según el programa que esté transmitiendo |

**Opciones del menú de perfil:**
- `Nuevo Perfil...` → Abre modal para crear un perfil nuevo con nombre y color
- `Editar Perfil actual...` → Abre modal para modificar el perfil activo
- `Importar Perfil (.bdeplf)` → Carga un perfil desde un archivo externo
- `Exportar Perfil (.bdeplf)` → Guarda el perfil activo como archivo para respaldo o compartir
- `Eliminar Perfil actual` → Elimina el perfil (requiere confirmación; no permite eliminar si es el único)
- Lista de perfiles existentes para cambiar entre ellos directamente

---

#### ⎋ Botón Acoplar (`#btn-dock-cartwall`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón con ícono ⏏️ en la esquina superior derecha |
| ⚡ **Qué** | Cambia la botonera del modo flotante al modo acoplado dentro de la consola principal |
| ⏱️ **Cuándo** | Solo visible cuando la ventana está en modo flotante (ventana separada) |
| 📍 **Dónde** | La ventana flotante se cierra y la botonera aparece integrada en la consola principal |
| 💡 **Por qué** | Da flexibilidad al operador: en pantallas grandes puede tener la botonera separada; en pantallas pequeñas, la integra a la consola para ahorrar espacio |

> **→ IPC enviado:** `cartwall-dock`

---

### 2. Pestañas de Botonera (Tabs)

Cada perfil puede tener múltiples "botoneras" (grupos de botones) organizadas en pestañas.

#### 📑 Pestaña Activa (Tab)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Las pestañas en la parte superior del grid, debajo de la barra de título |
| ⚡ **Qué** | Cambia la botonera visible (y activa) al hacer clic en ella |
| ⏱️ **Cuándo** | Siempre disponibles. Si una pestaña tiene audio reproduciéndose, se resalta aunque no esté activa |
| 📍 **Dónde** | El grid de botones cambia para mostrar los efectos de la pestaña seleccionada |
| 💡 **Por qué** | Permite organizar los efectos por categoría (ej: Pestaña 1: Jingles de estación, Pestaña 2: Efectos de comedia, Pestaña 3: Cortinas) sin cambiar de perfil |

#### ➕ Botón "+" (Agregar Botonera)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Pestaña especial con el símbolo `+` al final de la lista de tabs |
| ⚡ **Qué** | Abre el modal de configuración para crear una nueva botonera en el perfil actual |
| ⏱️ **Cuándo** | Siempre disponible |
| 📍 **Dónde** | Aparece el **Modal de Nueva Botonera** |
| 💡 **Por qué** | Permite expandir el conjunto de efectos sin límite de pestañas |

#### Menú contextual de pestaña (clic derecho sobre una pestaña)
| Opción | Qué hace |
|---|---|
| `✏️ Editar Botonera...` | Abre el modal para renombrar la pestaña y cambiar su tamaño (filas/columnas) y colores |
| `❌ Eliminar Botonera` | Elimina la pestaña (pide confirmación si tiene efectos cargados; no permite eliminar si es la única) |

---

### 3. Grid de Botones

El área principal. Una cuadrícula configurable (por defecto 5×5) donde cada celda es un "cartucho".

#### 🔘 Botón de Efecto (Cartucho)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Cada celda del grid. Muestra: número de índice, nombre del efecto, timer y barra de progreso |
| ⚡ **Qué** | Al hacer clic, reproduce el audio asignado (o la locución de hora si es tipo `time`) |
| ⏱️ **Cuándo** | Solo reproduce si tiene un archivo de audio asignado. Si está vacío, el clic no hace nada |
| 📍 **Dónde** | La celda se ilumina (clase CSS `cw-playing`), la barra de progreso avanza, y el timer muestra `tiempo actual / duración total` |
| 💡 **Por qué** | Es la función núcleo del CartWall — reproducción instantánea de efectos sin interrumpir el flujo de la transmisión |

> **→ IPC enviado:** `remote-cw-play` con datos del botón incluyendo el índice de pestaña

**Estados visuales del botón:**
| Estado | Visual |
|---|---|
| Vacío | Sin nombre, sin color de fondo personalizado |
| Listo (tiene audio) | Muestra el nombre del efecto y el texto "LISTO" en el timer |
| Reproduciendo | Se ilumina, la barra de progreso avanza de izquierda a derecha |
| Pestaña con audio (pero en otra tab) | La pestaña correspondiente tiene un indicador visual de "reproduciéndose" |

**Modos de comportamiento del botón (configurables via menú contextual):**

| Modo | Ícono | Qué hace cuando está activo |
|---|---|---|
| Bucle | 🔁 | El audio se repite en bucle hasta que el operador lo detiene manualmente |
| Superposición | 🔀 | Permite que este botón suene encima de otros botones que ya están sonando |
| Reiniciar al hacer clic | ↺ | Si el audio ya está sonando y se hace clic de nuevo, reinicia desde el inicio |
| Detener otros | ⏹ | Al reproducirse, detiene automáticamente todos los demás efectos activos |

---

#### Drag & Drop (Arrastrar y soltar)
| Acción | Qué hace |
|---|---|
| Arrastrar un archivo de audio desde el explorador de Windows hacia un botón | Asigna ese archivo al botón (lo configura automáticamente: nombre, color aleatorio) |
| Arrastrar un archivo hacia el área vacía del grid | Lo asigna al primer botón vacío disponible |
| `Ctrl` + Arrastrar un botón ya configurado hacia otro botón | **Mueve** la configuración del botón de origen al destino (el origen queda vacío) |

---

#### Menú contextual de botón (clic derecho sobre un botón)
| Opción | Qué hace |
|---|---|
| `✏️ Editar...` | Abre el **Modal de Edición de Efecto** para cambiar archivo, nombre, volumen y colores |
| `🗑️ Limpiar` | Detiene el audio si está sonando y borra toda la configuración del botón (lo deja vacío) |
| `🔁 Bucle` | Activa/desactiva el modo bucle (toggle con indicador ✓) |
| `🔀 Superposición` | Activa/desactiva el modo superposición (toggle) |
| `↺ Reiniciar al hacer clic` | Activa/desactiva el modo reinicio (toggle) |
| `⏹ Detener otros` | Activa/desactiva el modo "detener otros" (toggle) |
| `🎧 Escucha previa` | Abre la ventana de preview para escuchar el audio en la salida de monitoreo sin emitirlo al aire |

> **→ IPC enviado (escucha previa):** `open-preview` con la ruta del archivo

---

### 4. Modales (Ventanas Emergentes)

#### Modal: Editar Efecto (`#cw-edit-modal`)
Se abre desde el menú contextual de un botón → `✏️ Editar...`

| Campo | Descripción |
|---|---|
| Ruta del archivo (texto, solo lectura) | Muestra la ruta del audio asignado |
| Tipo (`audio` / `Locución de hora`) | Cambia el comportamiento: "audio" reproduce un archivo fijo; "Locución de hora" reproduce automáticamente el archivo de audio que corresponde a la hora actual desde una carpeta |
| Botón `...` | Abre el explorador de archivos para seleccionar un archivo de audio (si es tipo `audio`) o una carpeta (si es tipo `time`) |
| Nombre | El texto que aparece en el botón |
| Volumen | Slider de 0 a 1 para el volumen de reproducción de este efecto específico |
| Color de fondo | Color personalizado del botón |
| Color de texto | Color del texto del nombre en el botón |
| `Cancelar` | Cierra el modal sin guardar cambios (`Escape` también cierra) |
| `Aceptar` | Guarda los cambios, detiene el audio si el archivo cambió, y actualiza el grid (`Enter` también confirma) |

> **→ IPC invocado al guardar:** `save-cartwall-profiles`

---

#### Modal: Configurar Botonera (`#cw-tab-modal`)
Se abre al crear una nueva pestaña (`+`) o al editar una existente (menú contextual de pestaña → `✏️ Editar Botonera...`)

| Campo | Descripción |
|---|---|
| Nombre de la botonera | Nombre de la pestaña |
| Vertical (Filas) | Número de filas del grid (mín. 1, máx. 20) |
| Horizontal (Col) | Número de columnas del grid (mín. 1, máx. 20) |
| Color Fondo | Color de fondo de la pestaña |
| Color Texto | Color del texto de la pestaña |
| `Cancelar` | Cierra sin guardar |
| `Aceptar` | Guarda. Si es nueva: crea la botonera con botones vacíos. Si es editar: redimensiona (agrega/elimina botones del final) |

> **→ IPC invocado al guardar:** `save-cartwall-profiles`

---

#### Modal: Nuevo/Editar Perfil (`#cw-profile-modal`)
Se abre desde el menú de perfiles.

| Campo | Descripción |
|---|---|
| Nombre del Perfil | Nombre identificador del perfil |
| Color Texto | Color del texto del nombre del perfil en el botón de selección |
| `Cancelar` | Cierra sin guardar |
| `Guardar Perfil` | Crea o actualiza el perfil. Si es nuevo: detiene todo el audio activo antes de cambiar |

---

## 📡 Mapa de Comunicación IPC

### Mensajes enviados al Backend (`ipcRenderer.send`)
| Canal | Cuándo se envía | Datos |
|---|---|---|
| `cartwall-dock` | Al hacer clic en el botón ⏏️ | — |
| `set-cartwall-ui-state` | Al cambiar pestaña, perfil o modo | `{ activeProfileId, activeTabIndex, mode }` |
| `remote-cw-play` | Al hacer clic en un botón con audio | Datos completos del botón + índice de pestaña |
| `remote-cw-stop` | Al limpiar un botón desde el menú contextual | Datos del botón |
| `remote-cw-stopall` | Al eliminar un perfil o cambiar de perfil | — |
| `remote-cw-stop-tab` | Al eliminar una pestaña | Índice de la pestaña |
| `remote-cw-move-button` | Al hacer Ctrl+Drag entre botones | `{ fromTabIndex, fromId, toTabIndex, toId }` |

### Mensajes invocados al Backend (`ipcRenderer.invoke` — espera respuesta)
| Canal | Cuándo se invoca | Retorna |
|---|---|---|
| `get-cartwall-profiles` | Al cargar la ventana | Estado completo del CartWall (perfiles, paletas, botones) |
| `get-cartwall-ui-state` | Al cargar la ventana | `{ activeProfileId, activeTabIndex, mode }` |
| `save-cartwall-profiles` | Al cualquier cambio de configuración | — |
| `dialog:openFile` | Al seleccionar archivo en el modal de edición | Ruta del archivo seleccionado |
| `dialog:selectFolder` | Al seleccionar carpeta (tipo `time`) | Ruta de la carpeta |
| `dialog:confirm` | Al eliminar perfil o pestaña con contenido | `true` / `false` |
| `importar-bdeplf` | Al importar perfil | Datos del perfil importado |
| `exportar-bdeplf` | Al exportar perfil | — |

### Mensajes recibidos del Backend (`ipcRenderer.on`)
| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `sync-cartwall-state` | El backend solicita sincronización | Recarga el estado completo desde el backend |
| `cartwall-ui-state` | El estado de UI cambió (ej: desde la consola principal) | Aplica el nuevo perfil y pestaña activos |
| `cartwall-play-state` | Un botón empezó o terminó de reproducir | Actualiza la clase CSS `cw-playing` y resetea la barra de progreso |
| `cartwall-progress` | El audio de un botón está avanzando | Actualiza la barra de progreso y el timer del botón |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento | Qué debe hacer Rust/Tauri |
|---|---|
| Reproducción de audio por botón | Rust manejará el motor de audio; cada `remote-cw-play` se convierte en un **comando Tauri** |
| Gestión de perfiles | Los perfiles pueden seguir en JSON o migrarse a SQLite; Rust leerá/escribirá el archivo |
| Progreso en tiempo real | Rust usará **eventos Tauri** (`emit`) para enviar el progreso al frontend |
| Tipo "Locución de hora" | Rust calculará la hora actual y buscará el archivo correspondiente en la carpeta configurada |
| Importar/Exportar `.bdeplf` | Rust manejará el diálogo de archivo nativo y la serialización del perfil |

---

*Documentado mediante auditoría automática de código — LF Automatizador v1.0*
*Referencia para LF Automatizador v2.0 (Tauri + Rust)*
