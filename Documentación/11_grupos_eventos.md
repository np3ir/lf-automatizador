# 11 — Gestor de Grupos de Eventos
*Módulo: `event_groups.html` + `event_groups.js` | IPC: `backend/ipc/events.js`*

> **¿Qué es este módulo?**
> El Gestor de Grupos de Eventos es una ventana auxiliar que permite crear, editar y eliminar las categorías bajo las que se organizan los eventos automáticos de la emisora. Cada grupo tiene nombre y colores propios que se propagan visualmente a todas las tarjetas de eventos asignados a él en el calendario y en la lista principal. Existe un grupo "General" protegido que no puede eliminarse ni renombrarse.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Gestor de Grupos de Eventos |
| **Modo** | Ventana flotante independiente, se abre desde el botón ⚙️ del Editor de Eventos |
| **Archivo HTML** | `frontend/event_groups.html` |
| **Comportamiento especial** | Al abrir, carga los grupos desde SQLite. Si la base de datos está vacía, crea automáticamente el grupo "General" con colores por defecto y lo guarda. Al cerrar con "💾 Guardar Cambios", notifica a todas las ventanas abiertas (lista principal, editor de eventos, calendario) para que actualicen sus selectores de grupo. |

---

## 🧩 Elementos de la Interfaz

La ventana está dividida en dos columnas: lista de grupos a la izquierda, panel de edición a la derecha.

---

### 1. Lista de Grupos (`#groups-list`)

#### Lista de grupos (`ul#groups-list`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<ul id="groups-list" class="dark-list">` |
| ⚡ **Qué** | Muestra todos los grupos existentes como elementos de lista; el grupo seleccionado recibe la clase CSS `selected` |
| ⏱️ **Cuándo** | Se llena al cargar la ventana y se actualiza en tiempo real al añadir o eliminar grupos |
| 📍 **Dónde** | Columna izquierda, 40% del ancho de la ventana |
| 💡 **Por qué** | El operador necesita ver todos los grupos de un vistazo para seleccionar cuál editar |

**Interacción:**
| Acción | Efecto |
|---|---|
| **Clic en un ítem** | Selecciona el grupo y carga sus datos (nombre, colores) en el panel de edición derecho |

---

#### Botón: Añadir Grupo (`#btn-add-group`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-add-group" class="icon-btn">` con ícono ➕ |
| ⚡ **Qué** | Crea un nuevo grupo con valores por defecto: nombre "Nuevo Grupo", fondo `#222225`, texto `#00a8ff`; lo selecciona automáticamente para edición inmediata |
| ⏱️ **Cuándo** | Siempre activo |
| 📍 **Dónde** | El nuevo grupo aparece al final de la lista y el panel de edición carga sus datos |
| 💡 **Por qué** | Crear una nueva categoría de organización (ej: "Jingles de Mediodia", "Publicidad Local") |

**Datos iniciales del nuevo grupo:**
| Campo | Valor |
|---|---|
| `id` | `g_<timestamp>` (generado con `Date.now()`) |
| `name` | "Nuevo Grupo" |
| `colorBg` | `#222225` |
| `colorText` | `#00a8ff` |
| `readonly` | `false` |

---

#### Botón: Eliminar Grupo (`#btn-del-group`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-del-group" class="icon-btn">` con ícono ❌ en color rojo |
| ⚡ **Qué** | Elimina el grupo actualmente seleccionado de la lista local (en memoria); selecciona automáticamente el primero de la lista restante |
| ⏱️ **Cuándo** | Si el grupo es `readonly` (grupo "General"), el botón se muestra con `opacity: 0.3` y `cursor: not-allowed` — no hace nada al clicar |
| 📍 **Dónde** | El grupo desaparece de la lista; los eventos asignados a él se reasignan a "General" al guardar (lógica en backend) |
| 💡 **Por qué** | Limpiar grupos que ya no se necesitan; el backend garantiza que ningún evento quede huérfano |

> **Nota importante:** La eliminación es solo local hasta que el usuario hace clic en "💾 Guardar Cambios". Si cierra con "Cerrar", los cambios se pierden.

---

### 2. Panel de Edición (Columna Derecha)

#### Campo: Nombre del Grupo (`#grp-name`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="text" id="grp-name" class="settings-input">` |
| ⚡ **Qué** | Define el nombre del grupo seleccionado; cualquier cambio se refleja inmediatamente en la lista y en la vista previa |
| ⏱️ **Cuándo** | Deshabilitado (`disabled`) si el grupo seleccionado es `readonly` (grupo "General") |
| 📍 **Dónde** | El cambio se muestra en tiempo real en la `ul#groups-list` y en `#preview-text` |
| 💡 **Por qué** | El nombre es lo que verá el operador en el selector de grupos del editor de eventos |

---

#### Color de Fondo (`#grp-color-bg`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="color" id="grp-color-bg" class="color-picker-native">` |
| ⚡ **Qué** | Selector de color nativo del sistema operativo; cualquier cambio se aplica instantáneamente a la vista previa |
| ⏱️ **Cuándo** | Valor por defecto: `#222225`; siempre editable (incluso para el grupo "General") |
| 📍 **Dónde** | El color de fondo se propaga a las tarjetas de eventos de ese grupo en el calendario (como base del RGBA) |
| 💡 **Por qué** | Diferenciar visualmente las categorías: rojo para publicidad, verde para música, azul para jingles |

---

#### Color de Texto (Título) (`#grp-color-txt`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="color" id="grp-color-txt" class="color-picker-native">` |
| ⚡ **Qué** | Define el color del texto del título del grupo en las tarjetas de eventos |
| ⏱️ **Cuándo** | Valor por defecto: `#00a8ff` (azul LF); siempre editable |
| 📍 **Dónde** | Afecta el texto del nombre y hora de los eventos asignados a este grupo en el calendario |
| 💡 **Por qué** | Garantizar contraste legible entre el texto y el fondo del grupo |

**Sincronización en tiempo real:**
Los tres campos (`#grp-name`, `#grp-color-bg`, `#grp-color-txt`) actualizan el estado interno y la vista previa en tiempo real con el evento `input`, sin necesidad de confirmar.

---

#### Botón: Restablecer Colores (`#btn-reset-colors`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-reset-colors" class="settings-btn">` |
| ⚡ **Qué** | Restaura los colores del grupo seleccionado a los valores por defecto de fábrica: fondo `#222225`, texto `#00a8ff` |
| ⏱️ **Cuándo** | Solo actúa si hay un grupo seleccionado |
| 📍 **Dónde** | Actualiza los inputs de color y la vista previa |
| 💡 **Por qué** | Forma rápida de deshacer personalizaciones de color sin recordar los valores originales |

---

#### Vista Previa (`#preview-box`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `div#preview-box` con `span#preview-text` y `span#preview-arrow` |
| ⚡ **Qué** | Muestra en tiempo real cómo lucirá el encabezado del grupo en la lista principal con los colores seleccionados |
| ⏱️ **Cuándo** | Se actualiza con cada cambio de nombre o color |
| 📍 **Dónde** | Panel derecho, debajo de los controles de color |
| 💡 **Por qué** | El operador puede ver el resultado visual antes de guardar, evitando colores ilegibles |

**Componentes de la vista previa:**
| Elemento | ID | Descripción |
|---|---|---|
| Fondo del box | `#preview-box` | Fondo con el color `grp-color-bg` |
| Texto del nombre | `#preview-text` | Muestra el nombre del grupo en color `grp-color-txt` |
| Flecha indicadora | `#preview-arrow` | Ícono `▼` en color `grp-color-txt`; simula el comportamiento de expansión de grupo en la lista |

---

### 3. Barra de Botones Inferior

| Botón | ID | Comportamiento |
|---|---|---|
| **Cerrar** | `#btn-cancel` | Cierra la ventana (`window.close()`) sin guardar cambios; cualquier modificación local se pierde |
| **💾 Guardar Cambios** | `#btn-save` | Filtra grupos con nombre vacío, invoca `db-save-groups` con el array actualizado, y cierra la ventana |

**Lógica al guardar:**
1. Se filtran de la lista local todos los grupos cuyo nombre sea vacío o solo espacios.
2. Se invoca `db-save-groups` con el array resultante.
3. El backend garantiza que "General" exista siempre (lo re-inserta si falta).
4. Los eventos huérfanos (grupo eliminado) se reasignan automáticamente a `g_general`.
5. El backend notifica a la ventana principal, al editor de eventos y al calendario mediante `refresh-event-groups`.
6. La ventana se cierra.

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo | Retorna |
|---|---|---|
| `db-get-groups` | Al cargar la ventana (`DOMContentLoaded`) | Array de grupos: `[{ id, name, colorBg, colorText, readonly }]` |
| `db-save-groups` | Al hacer clic en "💾 Guardar Cambios" | `{ success: boolean }` |

### Mensajes enviados (`ipcRenderer.send`)
*Este módulo no envía mensajes `ipcRenderer.send`; toda la comunicación es por `invoke`.*

### Mensajes recibidos (`ipcRenderer.on`)
*Este módulo no escucha canales IPC entrantes. Las actualizaciones de grupos las reciben el editor de eventos y el calendario, no este gestor.*

---

## 🗂️ Estructura del Objeto Grupo

```json
{
  "id": "g_general | g_<timestamp>",
  "name": "General | Publicidad | Jingles",
  "colorBg": "#222225",
  "colorText": "#00a8ff",
  "readonly": true
}
```

**Reglas especiales del grupo "General":**
| Regla | Descripción |
|---|---|
| `id` protegido | `g_general` — el backend lo re-inserta si falta en el array |
| `readonly: true` | El nombre no se puede editar (campo `disabled`) |
| Eliminar | El botón de eliminar aparece deshabilitado visualmente |
| Fallback | Todos los eventos sin grupo o con grupo eliminado se reasignan a "General" |

---

## 🔗 Propagación de Cambios al Guardar

Cuando el usuario guarda cambios, el backend ejecuta en una transacción SQLite:

1. **Reasignación de huérfanos:** Cualquier evento con `group_id` no presente en la nueva lista se mueve a `g_general`.
2. **Eliminación de grupos obsoletos:** Se borran de la tabla `event_groups` los grupos no readonly que ya no están en la lista.
3. **Upsert de grupos:** Se insertan o actualizan todos los grupos del array.
4. **Notificaciones:** Se envía `refresh-event-groups` a la ventana principal, al editor de eventos y al calendario.
5. **Notificación de eventos:** Se envía también `refresh-events` porque los colores de los eventos cambiaron.

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento actual | Equivalente en Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('db-get-groups')` | Comando Tauri `get_event_groups` → `Vec<EventGroup>` desde SQLite |
| `ipcRenderer.invoke('db-save-groups', groups)` | Comando Tauri `save_event_groups(groups: Vec<EventGroup>)` → transacción SQLite con reasignación de huérfanos |
| `window.close()` al cancelar o guardar | `appWindow.close()` desde JS o `WindowBuilder::close()` desde Rust |
| Notificación `refresh-event-groups` a otras ventanas | Rust emite evento Tauri `emit_all("refresh-event-groups", ())` para que todos los WebviewWindows lo escuchen |
| Notificación `refresh-events` tras guardar grupos | Rust emite `emit_all("refresh-events", ())` |
| Grupo "General" por defecto | Lógica de fallback en Rust: `ensure_general_group_exists(&db)` antes de cada consulta |
| Vista previa en tiempo real | Permanece completamente en frontend JS/CSS; no requiere lógica Rust |
| Estado local en memoria hasta guardar | Permanece en frontend; solo se persiste al invocar `save_event_groups` |
| Filtrado de grupos con nombre vacío | Puede moverse a Rust como validación del comando, devolviendo error si hay nombres vacíos |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
