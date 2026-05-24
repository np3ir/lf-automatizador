# 09 — Calendario Semanal y Parrilla de Programación
*Módulo: `calendar.html` + `calendar.js` | IPC: `backend/ipc/events.js`*

> **¿Qué es este módulo?**
> El Calendario Semanal es la vista maestra de toda la programación de la emisora. Muestra en una cuadrícula de 7 columnas (lunes a domingo) tanto los programas de la parrilla editorial (bloques con locutor y horario fijo) como los eventos automáticos (acciones que se disparan a una hora específica sin intervención humana). Es el punto central de planificación de una emisora de radio.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | 🗓️ Calendario Semanal y Parrilla de Programación |
| **Modo** | Ventana flotante independiente (se abre desde la app principal) |
| **Archivo HTML** | `frontend/calendar.html` |
| **Comportamiento especial** | Al abrirse, carga simultáneamente eventos, grupos de eventos y programas de parrilla desde SQLite. El día actual se resalta automáticamente en el encabezado. |

---

## 🧩 Elementos de la Interfaz

### 1. Barra Superior (Header)

#### Título del módulo
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `div.header-title` — texto "🗓️ Calendario Semanal y Parrilla de Programación" |
| ⚡ **Qué** | Solo descriptivo, no es interactivo |
| ⏱️ **Cuándo** | Siempre visible |
| 📍 **Dónde** | Esquina superior izquierda del header |
| 💡 **Por qué** | Identifica visualmente el módulo para el operador |

---

#### Selector de Modo de Vista (`#view-mode`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select id="view-mode">` con opciones "📝 Modo Lista" y "⏱️ Modo Horas" |
| ⚡ **Qué** | Cambia la forma en que se renderiza el calendario al instante (sin recarga) |
| ⏱️ **Cuándo** | Siempre disponible |
| 📍 **Dónde** | El grid del calendario cambia su presentación visual |
| 💡 **Por qué** | El operador puede elegir ver una lista simple de lo que hay cada día, o una grilla de 24 horas con posicionamiento visual exacto de cada programa/evento |

**Opciones disponibles:**

| Valor | Etiqueta | Comportamiento |
|---|---|---|
| `list` | 📝 Modo Lista | Cada día muestra tarjetas apiladas ordenadas por hora |
| `hours` | ⏱️ Modo Horas | Añade una columna de hora (0–23) a la izquierda; los programas se posicionan con altura proporcional a su duración; los eventos se ubican en el slot de su hora exacta |

---

#### Filtro: Ver Parrilla (`#chk-parrilla`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="checkbox" id="chk-parrilla">` con etiqueta "📻 Ver Parrilla" |
| ⚡ **Qué** | Muestra u oculta todos los bloques de programa de la parrilla editorial |
| ⏱️ **Cuándo** | Activado por defecto (checked) |
| 📍 **Dónde** | Todas las tarjetas de tipo PROGRAMA desaparecen del grid |
| 💡 **Por qué** | Permite al programador de radio enfocarse solo en los eventos automáticos sin la distracción visual de la parrilla completa |

---

#### Filtro: Ver Eventos (`#chk-eventos`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="checkbox" id="chk-eventos">` con etiqueta "⚡ Ver Eventos" |
| ⚡ **Qué** | Muestra u oculta todos los eventos automáticos del calendario |
| ⏱️ **Cuándo** | Activado por defecto (checked) |
| 📍 **Dónde** | Todas las tarjetas de tipo EVENTO desaparecen del grid |
| 💡 **Por qué** | Permite ver la parrilla editorial limpia, sin las interrupciones automáticas, útil para planificación de contenidos |

---

#### Botón: + Programa (`#btn-add-program`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-add-program">` clase `btn` |
| ⚡ **Qué** | Abre el modal interno de creación de programas de parrilla con todos los campos vacíos |
| ⏱️ **Cuándo** | Siempre activo |
| 📍 **Dónde** | Aparece el modal superpuesto `#program-modal` |
| 💡 **Por qué** | Registrar un nuevo bloque de programa con su locutor, estilo y horario en la parrilla semanal |

---

#### Botón: + Evento (`#btn-add-event`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-add-event">` clase `btn primary` |
| ⚡ **Qué** | Abre la ventana flotante del Editor de Eventos (`event_editor.html`) en modo creación |
| ⏱️ **Cuándo** | Siempre activo |
| 📍 **Dónde** | Se abre una nueva ventana Electron con el editor de eventos |
| 💡 **Por qué** | Crear un nuevo evento automático (jingle, tanda de publicidad, acción) para programar a una hora exacta |

---

### 2. Grilla del Calendario (`#calendar-grid`)

La grilla tiene 7 columnas fijas, una por cada día de la semana (Lunes=1, Martes=2, Miércoles=3, Jueves=4, Viernes=5, Sábado=6, Domingo=0).

#### Encabezados de Día (`.day-header`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `div.day-header` con `data-day` de 0 a 6 |
| ⚡ **Qué** | Solo visual; el día actual recibe la clase CSS `today` |
| ⏱️ **Cuándo** | Se marca al cargar la página o al re-renderizar |
| 📍 **Dónde** | El encabezado del día actual aparece visualmente diferenciado |
| 💡 **Por qué** | Orientación rápida visual para el operador de radio en vivo, que necesita saber cuál es el día en curso |

---

#### Tarjeta de Programa (`.item.parrilla`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `div.item.parrilla` con `data-program-id` |
| ⚡ **Qué** | Representa un bloque de programa en la parrilla editorial |
| ⏱️ **Cuándo** | Se muestra si `chk-parrilla` está activo y el programa tiene `enabled: true` |
| 📍 **Dónde** | En la columna del día correspondiente, ordenado por hora de inicio |
| 💡 **Por qué** | Visualizar el esquema de programación editorial: quién habla, cuándo y qué tipo de contenido |

**Información mostrada en la tarjeta:**
| Campo | Descripción |
|---|---|
| Badge `PROGRAMA` | Distingue visualmente el tipo de ítem |
| Hora | Rango `HH:MM - HH:MM` de inicio a fin |
| Título | Nombre del programa |
| Descripción | Locutor: [nombre] / Estilo: [etiqueta] |
| Color | Fondo y borde izquierdo según colores personalizados del programa |

**Interacciones de la tarjeta:**
| Acción | Efecto |
|---|---|
| **Doble clic** | Abre el modal `#program-modal` en modo edición con los datos del programa cargados |
| **Clic derecho** | Muestra el menú contextual con opciones "✏️ Editar Programa" y "🗑️ Eliminar Programa" |
| **Drag & Drop** | La tarjeta es arrastrable (`draggable="true"`); al soltarla en otra columna de día o slot de hora, actualiza el día y/o la hora del programa y guarda en base de datos |

---

#### Tarjeta de Evento (`.item.evento`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `div.item.evento` con `data-event-id` |
| ⚡ **Qué** | Representa un evento automático programado |
| ⏱️ **Cuándo** | Se muestra si `chk-eventos` está activo y el evento tiene `primaryTime` definido |
| 📍 **Dónde** | En la columna del día correspondiente, ordenado por hora |
| 💡 **Por qué** | Visualizar qué acciones automáticas están programadas (tandas de publicidad, jingles, spots de identificación) |

**Información mostrada en la tarjeta:**
| Campo | Descripción |
|---|---|
| Badge `EVENTO` | Distingue visualmente el tipo de ítem |
| Hora | Hora exacta `HH:MM` del disparo |
| Título | Nombre del evento |
| Descripción | Tipo de fuente + comportamiento + nombre de grupo |
| Color | Fondo semitransparente y borde izquierdo según colores del evento o su grupo |

**Clasificación visual automática por tipo de contenido:**
| Clase CSS | Se aplica cuando |
|---|---|
| `publi` | `sourceType === 'commercial'` o ruta contiene "publi"/"comer" o grupo contiene "publi"/"comer" |
| `jingle` | Nombre del grupo contiene "jingle" o "pisador", o ruta contiene "jingle"/"pisador" |
| `musica` | `sourceType === 'file'` o `'folder'` (sin indicadores especiales) |
| `general` | `sourceType === 'lfplay'` o fuente no reconocida |

**Interacciones de la tarjeta:**
| Acción | Efecto |
|---|---|
| **Doble clic** | Envía `ipcRenderer.send('open-event-editor', ev)` — abre la ventana del editor cargando los datos del evento |
| **Clic derecho** | Muestra el menú contextual con opciones "✏️ Editar Evento" y "🗑️ Eliminar Evento" |

> **Nota:** Los eventos NO son arrastrables (sin `draggable`). Solo los programas de parrilla soportan drag & drop.

---

#### Columna de Horas (Modo Horas únicamente)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `div.time-column` generada dinámicamente al seleccionar "Modo Horas" |
| ⚡ **Qué** | Muestra etiquetas de 00:00 a 23:00 en la columna izquierda del calendario |
| ⏱️ **Cuándo** | Solo visible cuando `#view-mode` está en `hours` |
| 📍 **Dónde** | Columna adicional al inicio del grid |
| 💡 **Por qué** | Permite leer la hora exacta de cada bloque o evento alineado en la grilla |

**Comportamiento de hover en fila:**
Al pasar el mouse sobre un slot de hora, se resalta toda la fila horizontal (todos los días a esa hora) y la etiqueta de hora correspondiente en la columna izquierda, facilitando la lectura cruzada.

---

#### Slots de Hora (`.hour-slot`) — Modo Horas
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `div.hour-slot` con `data-day` y `data-hour` |
| ⚡ **Qué** | Contenedor de una hora específica en un día específico; acepta drop de programas |
| ⏱️ **Cuándo** | Generado solo en modo horas |
| 📍 **Dónde** | Cada celda del grid en modo horas |
| 💡 **Por qué** | Permite reposicionar programas en el tiempo arrastrándolos a la hora correcta |

**Drag & Drop en slot de hora:**
| Fase | Comportamiento |
|---|---|
| `dragover` | Cursor cambia a "move"; slot recibe clase `drag-over` |
| `dragleave` | Se quita la clase `drag-over` |
| `drop` | Actualiza la hora del programa al slot destino; si cambia de columna de día, actualiza también `specificDays`; guarda con `db-save-schedule-item` |

**Menú contextual en slot vacío (clic derecho):**
Cuando se hace clic derecho en un slot vacío (no sobre una tarjeta), aparece un menú con:
- 📻 Nuevo Programa a las `HH`:00
- ⚡ Nuevo Evento a las `HH`:00

Ambas opciones pre-rellenan la hora y el día correspondiente al slot clickeado.

---

### 3. Modal: Crear/Editar Programa de Parrilla (`#program-modal`)

Este modal es interno al calendario (no abre una ventana nueva). Se usa para gestionar los bloques de la parrilla editorial.

#### Campo: Nombre del Programa (`#pm-name`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="text" id="pm-name">` |
| ⚡ **Qué** | Campo obligatorio; si está vacío al guardar, se marca en rojo y el foco vuelve a él |
| ⏱️ **Cuándo** | Requerido para poder guardar |
| 📍 **Dónde** | En el modal superpuesto |
| 💡 **Por qué** | Identificar el programa en el calendario (ej: "El Mañanero", "La Previa") |

#### Campo: Locutor(es) (`#pm-host`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="text" id="pm-host">` |
| ⚡ **Qué** | Campo opcional; se muestra en la tarjeta del programa |
| ⏱️ **Cuándo** | Siempre editable |
| 📍 **Dónde** | En la tarjeta del programa en el calendario |
| 💡 **Por qué** | Registrar quién está a cargo del micrófono en ese bloque |

#### Campo: Estilo del Programa (`#pm-style`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select id="pm-style">` |
| ⚡ **Qué** | Clasifica el tipo de contenido del programa |
| ⏱️ **Cuándo** | Siempre editable; valor por defecto: "musical" |
| 📍 **Dónde** | Se muestra como texto en la tarjeta del programa |
| 💡 **Por qué** | Permitir un rápido reconocimiento del formato del programa al ver el calendario |

**Opciones de estilo:**

| Valor | Etiqueta |
|---|---|
| `musical` | 🎵 Musical |
| `informativo` | 📰 Informativo |
| `cultural` | 🎭 Cultural |
| `educativo` | 📚 Educativo |
| `opinion` | 💬 Opinión |
| `deportivo` | ⚽ Deportivo |
| `religioso` | 🙏 Religioso |
| `entretenimiento` | 🎉 Entretenimiento |
| `otro` | 📌 Otro |

#### Campos de Hora (`#pm-start` / `#pm-end`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="time" id="pm-start">` y `<input type="time" id="pm-end">` |
| ⚡ **Qué** | Definen el rango horario del bloque de programa |
| ⏱️ **Cuándo** | Valores por defecto: 06:00 y 09:00 |
| 📍 **Dónde** | En modo Horas, el programa se posiciona y dimensiona en la grilla con estos valores |
| 💡 **Por qué** | El operador necesita ver exactamente a qué hora empieza y termina cada programa para no solapar bloques |

#### Selector de Días (`#pm-days`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | 7 checkboxes `data-day` de 0 a 6 en `#pm-days` |
| ⚡ **Qué** | Determina en qué días de la semana aparece el programa |
| ⏱️ **Cuándo** | Por defecto: Lun–Vie marcados, Sáb y Dom desmarcados. Al crear desde un slot, pre-selecciona el día del slot |
| 📍 **Dónde** | El programa aparece en las columnas de los días seleccionados |
| 💡 **Por qué** | La programación varía entre días laborables y fin de semana |

#### Colores (`#pm-color-bg` / `#pm-color-text`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="color" id="pm-color-bg">` y `<input type="color" id="pm-color-text">` |
| ⚡ **Qué** | Personalizan el color de fondo y texto de la tarjeta del programa |
| ⏱️ **Cuándo** | Valores por defecto: fondo `#34495e`, texto `#ffffff` |
| 📍 **Dónde** | La tarjeta del programa en el calendario refleja los colores (fondo al 25% de opacidad, borde izquierdo al 100%) |
| 💡 **Por qué** | Diferenciar visualmente bloques de distintos locutores o formatos (ej: el programa musical en azul, el informativo en rojo) |

#### Campo: Notas (`#pm-notes`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="text" id="pm-notes">` |
| ⚡ **Qué** | Campo libre de observaciones, no afecta la lógica |
| ⏱️ **Cuándo** | Siempre opcional |
| 📍 **Dónde** | Solo en base de datos; no se muestra en la tarjeta del calendario |
| 💡 **Por qué** | Almacenar información operativa como el teléfono del locutor o instrucciones especiales |

#### Botones del Modal

| Botón | ID | Comportamiento |
|---|---|---|
| **Cancelar** | `#pm-cancel` | Cierra el modal sin guardar |
| **💾 Guardar** | `#pm-save` | Valida nombre y días, construye el objeto programa, envía `db-save-schedule-item` por IPC y re-renderiza el calendario |
| **🗑️ Eliminar** | `#pm-delete` | Solo visible en modo edición; pide confirmación con `dialog:confirm`; si confirma, elimina con `db-delete-schedule-item` |

**Atajo de teclado:**
| Tecla | Efecto |
|---|---|
| `Escape` | Cierra el modal (si está abierto) |

**Cierre por clic en el overlay:**
Hacer clic fuera del contenedor del modal (en el overlay oscuro) cierra el modal sin guardar.

---

### 4. Menú Contextual (`#ctx-menu`)

El menú contextual es flotante y aparece al hacer clic derecho sobre tarjetas o slots de hora.

**Modo ítem (sobre una tarjeta):**
| Opción | ID | Efecto |
|---|---|---|
| ✏️ Editar Evento / Editar Programa | `#ctx-edit` | Para eventos: abre editor con `open-event-editor`. Para programas: abre modal interno |
| 🗑️ Eliminar Evento / Eliminar Programa | `#ctx-delete` | Pide confirmación; si confirma, elimina de la DB y re-renderiza |

**Modo slot (sobre celda vacía en modo horas):**
| Opción | ID | Efecto |
|---|---|---|
| 📻 Nuevo Programa a las HH:00 | `#ctx-add-program` | Abre modal pre-relleno con la hora y el día del slot |
| ⚡ Nuevo Evento a las HH:00 | `#ctx-add-event` | Abre editor de eventos con hora y día pre-rellenos |

**Cierre del menú contextual:**
- Cualquier clic en la página cierra el menú
- La tecla `Escape` cierra el menú

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo | Retorna |
|---|---|---|
| `db-get-events` | Al cargar el calendario (y al recibir `refresh-events`) | Array de todos los eventos programados |
| `db-get-groups` | Al cargar el calendario (y al recibir `refresh-event-groups`) | Array de grupos de eventos |
| `db-get-schedule` | Al cargar el calendario (y al recibir `refresh-schedule`) | Array de programas de parrilla |
| `dialog:confirm` | Al intentar eliminar un programa o evento (desde menú contextual o modal) | `boolean` — true si el usuario confirmó |
| `db-delete-schedule-item` | Tras confirmar eliminación de un programa de parrilla | `{ success: boolean }` |

### Mensajes enviados (`ipcRenderer.send`)

| Canal | Cuándo | Datos enviados |
|---|---|---|
| `open-event-editor` | Al hacer doble clic en evento, clic en "✏️ Editar Evento" del menú contextual, o clic en "+ Evento" del header | Objeto evento completo (o `null` para nuevo evento; o objeto parcial con hora/día desde contexto de slot) |
| `db-save-schedule-item` | Al guardar desde el modal de programa, o al soltar un drag & drop en un nuevo slot/día | Objeto programa completo |
| `db-save-events-full` | Al eliminar un evento desde el menú contextual | Array completo de eventos restantes (reemplaza toda la tabla) |
| `refresh-events-from-calendar` | Inmediatamente después de `db-save-events-full` al eliminar un evento | *(sin datos)* — señal para que la ventana principal recargue eventos |

### Mensajes recibidos (`ipcRenderer.on`)

| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `refresh-events` | Cuando el editor de eventos guarda o el main notifica cambios | Recarga `eventsDB` y `eventGroupsDB` desde DB y re-renderiza el calendario |
| `refresh-schedule` | Cuando se guarda o elimina un programa de parrilla desde otro punto de la app | Recarga `scheduleDB` y re-renderiza el calendario |
| `refresh-event-groups` | Cuando se guardan cambios en los grupos desde el gestor de grupos | Recarga `eventGroupsDB` y re-renderiza el calendario |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento actual | Equivalente en Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('db-get-events')` | Comando Tauri `get_events` → Rust consulta SQLite y retorna `Vec<Event>` |
| `ipcRenderer.invoke('db-get-groups')` | Comando Tauri `get_event_groups` → retorna `Vec<EventGroup>` |
| `ipcRenderer.invoke('db-get-schedule')` | Comando Tauri `get_schedule` → retorna `Vec<ScheduleProgram>` |
| `ipcRenderer.send('db-save-schedule-item', item)` | Comando Tauri `save_schedule_item(item: ScheduleProgram)` |
| `ipcRenderer.invoke('db-delete-schedule-item', id)` | Comando Tauri `delete_schedule_item(id: String)` |
| `ipcRenderer.send('db-save-events-full', events)` | Comando Tauri `save_events_bulk(events: Vec<Event>)` — operación transaccional |
| `ipcRenderer.send('open-event-editor', ev)` | Tauri `WebviewWindow::new()` con URL del editor; datos pasados como query params o estado compartido |
| `ipcRenderer.send('refresh-events-from-calendar')` | Evento Tauri `emit_to_window("main", "refresh-events", ())` |
| `ipcRenderer.on('refresh-events', ...)` | Listener Tauri `listen("refresh-events", ...)` en el frontend Rust |
| `ipcRenderer.on('refresh-schedule', ...)` | Listener Tauri `listen("refresh-schedule", ...)` |
| `ipcRenderer.on('refresh-event-groups', ...)` | Listener Tauri `listen("refresh-event-groups", ...)` |
| `ipcRenderer.invoke('dialog:confirm', msg)` | Plugin Tauri `dialog::confirm()` |
| Drag & Drop de programas entre columnas | Implementado completamente en frontend JS/HTML; Rust solo persiste el resultado via `save_schedule_item` |
| Renderizado del calendario (lista/horas) | Lógica de presentación permanece en frontend; Rust solo provee datos |
| Clasificación visual por tipo (publi/jingle/musica) | Permanece en frontend como lógica de presentación |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
