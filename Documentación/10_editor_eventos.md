# 10 — Editor de Eventos Automáticos
*Módulo: `event_editor.html` + `event_editor.js` | IPC: `backend/ipc/events.js`*

> **¿Qué es este módulo?**
> El Editor de Eventos es la ventana donde se configura completamente un evento automático: qué audio reproducir, cuándo dispararse, con qué frecuencia, cómo interrumpir (o no) la música en curso, y cómo identificarlo visualmente en la lista principal. Es la herramienta de programación horaria de la emisora: permite que jingles, tandas de publicidad y otros contenidos se reproduzcan solos en el momento exacto.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Configurar Evento |
| **Modo** | Ventana flotante independiente (se abre desde el calendario o la lista principal) |
| **Archivo HTML** | `frontend/event_editor.html` |
| **Ancho mínimo** | 760px |
| **Comportamiento especial** | Recibe los datos del evento a editar a través del canal IPC `load-event-data`. Si recibe `null`, se inicializa en modo creación. Al guardar exitosamente, el backend cierra automáticamente esta ventana. |

---

## 🧩 Elementos de la Interfaz

La interfaz está dividida en 5 secciones numeradas (Section Boxes), cada una con borde y título en azul.

---

### Sección 1: Origen del Audio

Define la fuente del contenido que se reproducirá cuando el evento se active.

#### Radio de Tipo de Fuente (`input[name="ev-source-type"]`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | 5 radio buttons con name `ev-source-type` |
| ⚡ **Qué** | Cambia el modo de selección de origen y actualiza la UI de la ruta |
| ⏱️ **Cuándo** | Al cambiar la selección, la UI se adapta automáticamente |
| 📍 **Dónde** | El campo de ruta (`#ev-filepath`), el selector de bloques (`#ev-commercial-block`) y el botón "Examinar" aparecen/desaparecen según el tipo |
| 💡 **Por qué** | La emisora necesita diferentes tipos de origen: un archivo puntual, toda una carpeta rotativa, una playlist pre-armada o los bloques de comerciales configurados |

**Tipos de fuente disponibles:**

| Valor | Etiqueta | Descripción |
|---|---|---|
| `file` | 🎵 Archivo | Un archivo de audio individual (MP3, WAV, etc.) |
| `playlist` | 📄 Playlist | Una playlist `.lfplay` generada por LF Automatizador |
| `folder` | 📁 Carpeta Rotativa | Una carpeta de audio; reproduce archivos rotativamente |
| `commercial` | Comerciales | Selecciona un bloque comercial configurado en el módulo de comerciales |
| `macro` | ⚙️ Macro / Comando de Red | **🚧 Próximamente** — funcionalidad deshabilitada visualmente (opacity 0.4, pointer-events none) |

---

#### Campo de Ruta (`#ev-filepath`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="text" id="ev-filepath" readonly>` |
| ⚡ **Qué** | Muestra la ruta del archivo/carpeta/playlist seleccionado |
| ⏱️ **Cuándo** | Solo se rellena mediante el botón "Examinar" o al cargar un evento existente; es `readonly` (no se puede escribir directamente) |
| 📍 **Dónde** | En la sección 1; se oculta cuando el tipo es `commercial` |
| 💡 **Por qué** | Muestra de forma clara qué archivo va a reproducirse para que el operador pueda verificarlo |

---

#### Selector de Bloque Comercial (`#ev-commercial-block`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select id="ev-commercial-block">` |
| ⚡ **Qué** | Lista los bloques de comerciales disponibles; al cambiar la selección, actualiza `#ev-filepath` con el ID del bloque y auto-rellena el nombre del evento |
| ⏱️ **Cuándo** | Solo visible cuando `sourceType === 'commercial'`; los bloques se cargan vía `commercial-get-blocks` |
| 📍 **Dónde** | Reemplaza el campo de ruta y el botón "Examinar" |
| 💡 **Por qué** | Permite vincular el evento con la tanda de publicidad configurada, que tiene su propia lógica de rotación de anuncios |

---

#### Botón: Examinar (`#btn-browse`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-browse">` |
| ⚡ **Qué** | Abre el diálogo nativo del sistema operativo según el tipo de fuente seleccionado |
| ⏱️ **Cuándo** | Solo visible cuando `sourceType !== 'commercial'`; deshabilitado implícitamente en tipo `macro` |
| 📍 **Dónde** | Se llena `#ev-filepath` y se auto-sugiere el nombre del evento si el campo de nombre estaba vacío |
| 💡 **Por qué** | El operador navega por el sistema de archivos para seleccionar el audio exacto |

**Diálogo según tipo de fuente:**

| `sourceType` | Canal IPC invocado | Tipo de diálogo |
|---|---|---|
| `folder` | `dialog:selectFolder` | Selector de carpeta |
| `playlist` | `dialog:openPlaylist` | Selector de archivo `.lfplay` |
| `file` (o cualquier otro) | `dialog:openFile` | Selector de archivo de audio |

**Auto-nombre:** Si el campo `#ev-name` está vacío al seleccionar una ruta, el editor extrae el nombre base del archivo/carpeta y lo coloca automáticamente. Para carpetas, añade el prefijo `[Carpeta]`.

---

### Sección 2: Programación y Caducidad

Define **cuándo** se ejecutará el evento: hora, días, semanas y rango de validez.

#### Campo: Hora de Inicio (`#ev-time`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="time" id="ev-time" step="1">` |
| ⚡ **Qué** | Define la hora exacta (HH:MM:SS) de disparo del evento |
| ⏱️ **Cuándo** | Valor por defecto: `12:00:00`; al cambiar, sincroniza la hora principal en el grid de repetición de horas |
| 📍 **Dónde** | La hora aparece en la tarjeta del evento en el calendario |
| 💡 **Por qué** | La precisión al segundo permite disparar un jingle exactamente en el segundo cero de un break publicitario |

---

#### Repetición en Otras Horas (`#chk-other-hours`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="checkbox" id="chk-other-hours">` + grid de 24 checkboxes (uno por hora) |
| ⚡ **Qué** | Al activar, expande un grid de 24 checkboxes (00 hrs a 23 hrs) para seleccionar horas adicionales donde se clonará el evento con los mismos minutos y segundos que la hora principal |
| ⏱️ **Cuándo** | La hora principal (`#ev-time`) siempre aparece marcada y deshabilitada en el grid; no se puede desmarcar |
| 📍 **Dónde** | Se guardan como el campo `otherHours` del evento |
| 💡 **Por qué** | Un jingle de identificación de la emisora puede necesitar dispararse, por ejemplo, en el minuto :30 de cada hora. Esta función lo configura con un solo evento en lugar de crear 24 eventos separados |

---

#### Modo de Recurrencia de Días (`input[name="ev-days"]`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | 4 radio buttons con name `ev-days` |
| ⚡ **Qué** | Determina la lógica de qué días de la semana o del mes se activa el evento |
| ⏱️ **Cuándo** | El modo por defecto es "Una sola vez"; al cambiar muestra/oculta los sub-controles correspondientes |
| 📍 **Dónde** | Afecta cómo el calendario distribuye el evento en las columnas de días |
| 💡 **Por qué** | La programación de radio requiere flexibilidad: un jingle puede ser solo una vez, o cada lunes a viernes, o cada primera semana del mes |

**Modos de recurrencia:**

| Valor | Etiqueta | Sub-control visible | Descripción |
|---|---|---|---|
| `once` | Una sola vez | Ninguno | Se ejecuta solo la próxima vez que llegue esa hora |
| `daily` | Diariamente | Ninguno | Se repite todos los días de la semana |
| `specific` | Días de la Semana | Grid de 7 checkboxes (Lun–Dom) | Se repite solo en los días seleccionados |
| `monthlyWeeks` | Semana del Mes | Grid de semanas (1ra, 2da, 3ra, 4ta, Última) | Se repite en la(s) semana(s) del mes seleccionadas |

---

#### Selector de Días Específicos (`#specific-days-container`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | 7 checkboxes `.chk-day` con valores 0 (Dom) a 6 (Sáb) |
| ⚡ **Qué** | Define exactamente en qué días de la semana se activa el evento cuando `dayMode === 'specific'` |
| ⏱️ **Cuándo** | Solo visible cuando se selecciona "Días de la Semana" |
| 📍 **Dónde** | Al guardar, genera el campo `specificDays: [1, 2, 3...]` |
| 💡 **Por qué** | La programación de lunes a viernes es diferente a la del fin de semana en la mayoría de las emisoras |

---

#### Selector de Semanas del Mes (`#monthly-weeks-container`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | 5 checkboxes `.chk-week` con valores 1 a 5 |
| ⚡ **Qué** | Define en qué semanas del mes se activa el evento cuando `dayMode === 'monthlyWeeks'`; si no se selecciona ninguna, muestra un alert y cancela el guardado |
| ⏱️ **Cuándo** | Solo visible cuando se selecciona "Semana del Mes" |
| 📍 **Dónde** | Al guardar, genera el campo `targetWeeks: [1, 3...]` |
| 💡 **Por qué** | Para programas mensuales especiales: "el primer viernes del mes", "la última semana del mes" |

**Opciones de semana:**
| Valor | Etiqueta |
|---|---|
| 1 | 1ra Semana |
| 2 | 2da Semana |
| 3 | 3ra Semana |
| 4 | 4ta Semana |
| 5 | Última Semana |

---

#### Rango de Validez (`#chk-validity`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="checkbox" id="chk-validity">` + campos `#ev-date-start` y `#ev-date-end` |
| ⚡ **Qué** | Al activar, habilita los campos de fecha "Desde" y "Hasta"; los campos de fecha son de tipo `date` y comienzan deshabilitados |
| ⏱️ **Cuándo** | Por defecto, el evento no tiene caducidad (rango de validez desactivado) |
| 📍 **Dónde** | Al guardar, genera `validityStart` y `validityEnd` en el evento |
| 💡 **Por qué** | Una campaña publicitaria tiene fechas de inicio y fin. El evento se programa hoy pero solo se activará entre las fechas indicadas |

**Iconos de calendario (`#icon-date-start` / `#icon-date-end`):**
Los emojis 📆 junto a los campos de fecha activan el selector nativo de fecha del sistema operativo al hacer clic. También funciona con **doble clic** directamente sobre el input de fecha.

---

#### Repetición Cíclica (`#chk-cyclic-active`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="checkbox" id="chk-cyclic-active">` + campos de intervalo, unidad y límite |
| ⚡ **Qué** | Al activar, habilita la configuración de repetición: "Cada X minutos/horas, máximo N veces" |
| ⏱️ **Cuándo** | Por defecto desactivado; los campos numéricos y el selector de unidad están `disabled` hasta activar el checkbox |
| 📍 **Dónde** | Al guardar, genera `cyclicActive`, `cyclicInterval`, `cyclicUnit` y `cyclicLimit` |
| 💡 **Por qué** | Para eventos que deben repetirse periódicamente durante el día: un jingle cada 30 minutos, un spot de identificación cada 2 horas con máximo 5 repeticiones |

| Campo | ID | Descripción |
|---|---|---|
| Intervalo | `#ev-cyclic-interval` | Número entero de la frecuencia |
| Unidad | `#ev-cyclic-unit` | `minutes` (Minutos) o `hours` (Horas) |
| Límite | `#ev-cyclic-limit` | Número máximo de repeticiones (0 = ilimitado) |

---

### Sección 3: Comportamiento en la Lista Principal

Define cómo interactúa el evento con la playlist del reproductor principal cuando se dispara.

#### Acción en la Lista (`input[name="ev-action"]`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | 4 radio buttons activos + 2 deshabilitados con name `ev-action` |
| ⚡ **Qué** | Determina qué le sucede a la playlist del reproductor cuando llega la hora del evento |
| ⏱️ **Cuándo** | La selección afecta qué opciones de Reglas de Ejecución están disponibles (la opción `append-end` deshabilita todas las reglas de interrupción) |
| 📍 **Dónde** | El reproductor principal reacciona según esta configuración |
| 💡 **Por qué** | Cada tipo de contenido requiere un comportamiento diferente: la publicidad interrumpe, los jingles se insertan suavemente, y una lista de madrugada reemplaza toda la programación |

**Acciones disponibles:**

| Valor | Etiqueta | Comportamiento |
|---|---|---|
| `add` | ➕ Insertar a la playlist | Agrega el audio después de la pista actual (como siguiente en la cola) |
| `temp` | ⏳ Temporal | Se inserta y se borra automáticamente al terminar; ideal para bloques de comerciales |
| `clear` | 🗑️ Borrar toda la lista | Vacía la playlist actual y carga solo este evento; útil para iniciar bloques de madrugada |
| `append-end` | 🔽 Agregar al final | Agrega el audio al final de la lista, sin interrumpir nada |
| `ducking` *(Próximamente)* | 🎙️ Superposición / Pisador | Baja el volumen maestro sin afectar la lista; **deshabilitado** — badge "PRÓXIMAMENTE" |

**Opciones deshabilitadas (próximas funciones):**
- `ducking` — Radio button deshabilitado con `disabled-feature` class
- Checkbox de fade In/Out — Deshabilitado con badge "PRÓXIMAMENTE"

---

### Sección 4: Reglas de Ejecución

Define cómo el motor de eventos maneja el momento exacto del disparo en relación a la canción que está sonando.

#### Modo de Ejecución (`input[name="ev-exec"]`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | 3 radio buttons con name `ev-exec` |
| ⚡ **Qué** | Determina si el evento interrumpe inmediatamente, espera o tiene tolerancia máxima |
| ⏱️ **Cuándo** | Deshabilitado completamente cuando `action === 'append-end'` (fuerza modo "esperar") |
| 📍 **Dónde** | El motor de eventos del backend decide cuándo disparar el evento según esta regla |
| 💡 **Por qué** | Cortar una canción a mitad puede sonar brusco en radio en vivo; la tolerancia permite esperar el fin de la canción pero con un límite para no retrasarse demasiado |

**Modos de ejecución:**

| Valor | Etiqueta | Comportamiento |
|---|---|---|
| `interrupt` | ⚡ Interrumpir Inmediatamente | Corta la canción actual al llegar la hora exacta |
| `wait` | ⏳ Esperar a que finalice la canción actual | Espera a que termine la pista actual antes de ejecutar el evento |
| `max-delay` | ⌛ Tiempo Máx de Espera (Tolerancia) | Espera hasta N minutos/segundos; si la canción sigue, fuerza o cancela según configuración |

---

#### Tiempo Máximo de Espera (solo con `max-delay`)
| Campo | ID | Descripción |
|---|---|---|
| Minutos | `#ev-max-delay-minutes` | Número entero (≥0), habilitado solo con `max-delay` |
| Segundos | `#ev-max-delay-seconds` | Número entero (0–59), habilitado solo con `max-delay` |
| Acción al agotar | `#ev-max-delay-action` | `force` (Forzar evento) o `omit` (Omitir este evento) |

**Validación:** Si el modo es `max-delay` y el tiempo total es menor a 1 segundo, se muestra un alert y no se guarda.

---

#### No ejecutar si detenido (`#chk-require-playing`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="checkbox" id="chk-require-playing">` |
| ⚡ **Qué** | Si activado, el evento se cancela si el reproductor principal no está en reproducción activa |
| ⏱️ **Cuándo** | Por defecto: desactivado (el evento se ejecuta aunque el reproductor esté detenido) |
| 📍 **Dónde** | Genera el campo `requirePlaying: true` en el objeto del evento |
| 💡 **Por qué** | Evita que se disparen eventos automáticos cuando el operador ha detenido manualmente la transmisión (corte de emergencia, mantenimiento) |

---

#### Nivel de Prioridad (`#ev-priority`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select id="ev-priority">` |
| ⚡ **Qué** | Establece la importancia del evento cuando varios colisionan a la misma hora |
| ⏱️ **Cuándo** | Valor por defecto: `normal` |
| 📍 **Dónde** | El motor de eventos usa la prioridad para resolver conflictos |
| 💡 **Por qué** | Un informe de emergencia o una cadena nacional tiene prioridad crítica sobre los comerciales normales |

**Niveles de prioridad:**
| Valor | Etiqueta |
|---|---|
| `low` | Baja |
| `normal` | Normal (por defecto) |
| `high` | Alta |
| `critical` | Crítica |

---

### Sección 5: Apariencia y Organización

Define cómo se identifica visualmente el evento.

#### Nombre del Evento (`#ev-name`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="text" id="ev-name">` |
| ⚡ **Qué** | Nombre libre del evento; si está vacío al guardar, se usa el nombre base del archivo |
| ⏱️ **Cuándo** | Se auto-rellena cuando se selecciona una ruta de archivo; editable manualmente |
| 📍 **Dónde** | Aparece como título en la tarjeta del evento en el calendario y en la lista principal |
| 💡 **Por qué** | "Bloque de Publicidad 12:30" es más descriptivo que "C:\comerciales\tanda.mp3" |

---

#### Grupo (`#ev-group`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<select id="ev-group">` |
| ⚡ **Qué** | Asigna el evento a un grupo de organización; los grupos se cargan desde la DB en tiempo real |
| ⏱️ **Cuándo** | Siempre disponible; por defecto "General"; se actualiza automáticamente si el gestor de grupos emite `refresh-event-groups` |
| 📍 **Dónde** | El grupo determina el color del evento en el calendario si el evento no tiene color propio; también aparece en la descripción de la tarjeta |
| 💡 **Por qué** | Organizar eventos por categoría (Publicidad, Jingles, Identificaciones) facilita la gestión visual |

---

#### Botón: Gestionar Grupos (`#btn-edit-groups`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-edit-groups">` con ícono ⚙️ |
| ⚡ **Qué** | Abre la ventana del Gestor de Grupos de Eventos (`event_groups.html`) |
| ⏱️ **Cuándo** | Siempre activo |
| 📍 **Dónde** | Se abre una nueva ventana Electron; al cerrarla, el selector `#ev-group` se actualiza automáticamente |
| 💡 **Por qué** | Permite crear, editar y eliminar grupos sin salir del editor de eventos |

---

#### Color de Texto (`#ev-color-txt`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="color" id="ev-color-txt">` |
| ⚡ **Qué** | Define el color del texto (nombre y hora) del evento en el calendario y la lista principal |
| ⏱️ **Cuándo** | Valor por defecto: `#ffffff` (blanco) |
| 📍 **Dónde** | Afecta la tarjeta del evento en el calendario |
| 💡 **Por qué** | Contraste visual para diferentes fondos |

---

#### Color de Fondo (`#ev-color-bg`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<input type="color" id="ev-color-bg">` |
| ⚡ **Qué** | Define el color de fondo de la tarjeta del evento |
| ⏱️ **Cuándo** | Valor por defecto: `#1a1a1c` |
| 📍 **Dónde** | Afecta la tarjeta del evento en el calendario (al 25% de opacidad) y el borde izquierdo |
| 💡 **Por qué** | Diferenciar visualmente tipos de eventos; por ejemplo, rojo para publicidad, azul para identificaciones |

---

#### Botón: Restablecer Colores (`#btn-reset-ev-colors`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | `<button id="btn-reset-ev-colors">` |
| ⚡ **Qué** | Resetea `#ev-color-txt` a `#ffffff` y `#ev-color-bg` a `#1a1a1c` |
| ⏱️ **Cuándo** | Siempre activo |
| 📍 **Dónde** | Los selectores de color se actualizan visualmente |
| 💡 **Por qué** | Forma rápida de volver a los colores neutros si el operador personalizó y no le gustó el resultado |

---

#### Nota Informativa: Sistema de Semáforo
Un recuadro azul-naranja muestra la siguiente información al operador:

> **🚥 Sistema de Semáforo Activado:** El color de fondo cambiará automáticamente en la lista principal según se acerque la hora de ejecución:
> - **15 min:** Naranja transparente
> - **5 min:** Naranja sólido
> - **1 min:** Rojo sólido
> - **Modo Manual:** Parpadeo por 10 segundos

Este sistema opera sobre los colores configurados en la lista principal; el color personalizado del evento coexiste con el semáforo automático.

---

### Barra de Botones Inferior

| Botón | ID | Comportamiento |
|---|---|---|
| **Cancelar** | `#btn-cancel` | Cierra la ventana (`window.close()`) sin guardar |
| **💾 Guardar Evento** | `#btn-save` | Valida y construye el objeto evento; envía `save-event` por IPC; el backend guarda en SQLite, notifica cambios a otras ventanas y cierra automáticamente esta ventana |

**Validaciones al guardar:**
| Validación | Mensaje |
|---|---|
| Ruta de origen vacía o inválida | Alert: "Debes seleccionar una ruta válida en Origen del Audio." |
| Modo `monthlyWeeks` sin semanas seleccionadas | Alert: "Debes seleccionar al menos una semana del mes." |
| Modo `max-delay` con tiempo < 1 segundo | Alert: "Debes indicar un Tiempo Máx de Espera válido (mínimo 1 segundo)." |

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo | Retorna |
|---|---|---|
| `commercial-get-blocks` | Al cargar la ventana (siempre) y cuando `sourceType === 'commercial'` | Array de bloques comerciales configurados |
| `db-get-groups` | Al cargar la ventana y al recibir `refresh-event-groups` | Array de grupos de eventos |
| `dialog:selectFolder` | Al hacer clic en "Examinar" con `sourceType === 'folder'` | Ruta de carpeta seleccionada (string) o null |
| `dialog:openPlaylist` | Al hacer clic en "Examinar" con `sourceType === 'playlist'` | Ruta del archivo `.lfplay` o null |
| `dialog:openFile` | Al hacer clic en "Examinar" con `sourceType === 'file'` | Ruta del archivo de audio o null |

### Mensajes enviados (`ipcRenderer.send`)

| Canal | Cuándo | Datos enviados |
|---|---|---|
| `save-event` | Al hacer clic en "💾 Guardar Evento" (tras pasar validaciones) | Objeto completo del evento con todos sus campos |
| `open-event-groups` | Al hacer clic en el botón ⚙️ "Gestionar Grupos" | *(sin datos)* |

### Mensajes recibidos (`ipcRenderer.on`)

| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `load-event-data` | Al abrir la ventana; enviado por el proceso principal con los datos del evento a editar (o `null` para nuevo evento) | Rellena todos los campos del formulario con los datos del evento existente; si es `null`, inicializa valores por defecto |
| `refresh-event-groups` | Cuando el gestor de grupos guarda cambios | Recarga el selector `#ev-group` con los grupos actualizados |

---

## 🗂️ Estructura del Objeto Evento (Datos Guardados)

Al guardar, se construye y envía el siguiente objeto:

```json
{
  "id": "ev_<timestamp>",
  "name": "Bloque de Publicidad",
  "group": "g_general",
  "sourceType": "commercial | file | folder | playlist",
  "filePath": "C:\\ruta\\al\\archivo.mp3",
  "primaryTime": "12:00:00",
  "otherHours": [14, 18, 20],
  "dayMode": "once | daily | specific | monthlyWeeks",
  "specificDays": [1, 2, 3, 4, 5],
  "targetWeeks": [1, 3],
  "validityStart": "2026-01-01",
  "validityEnd": "2026-12-31",
  "action": "add | temp | clear | append-end",
  "execution": "interrupt | wait | max-delay",
  "priority": "low | normal | high | critical",
  "colorText": "#ffffff",
  "colorBg": "#1a1a1c",
  "lastFired": null,
  "requirePlaying": false,
  "maxDelayActive": false,
  "maxDelayMinutes": 0,
  "maxDelaySeconds": 0,
  "maxDelayTime": 0,
  "maxDelayAction": "omit | force",
  "cyclicActive": false,
  "cyclicInterval": 0,
  "cyclicUnit": "minutes | hours",
  "cyclicLimit": 0
}
```

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento actual | Equivalente en Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('commercial-get-blocks')` | Comando Tauri `get_commercial_blocks` → retorna `Vec<CommercialBlock>` |
| `ipcRenderer.invoke('db-get-groups')` | Comando Tauri `get_event_groups` → retorna `Vec<EventGroup>` |
| `ipcRenderer.invoke('dialog:selectFolder')` | Plugin Tauri `dialog::open()` con `directory: true` |
| `ipcRenderer.invoke('dialog:openPlaylist')` | Plugin Tauri `dialog::open()` con filtro `.lfplay` |
| `ipcRenderer.invoke('dialog:openFile')` | Plugin Tauri `dialog::open()` con filtros de audio |
| `ipcRenderer.send('save-event', newEvent)` | Comando Tauri `save_event(event: Event)` → upsert en SQLite + notificaciones |
| `ipcRenderer.send('open-event-groups')` | Tauri `WebviewWindow::new("event-groups", ...)` |
| `ipcRenderer.on('load-event-data', ...)` | Estado inicial inyectado en la URL como query param o mediante `window.__INITIAL_DATA__` |
| `ipcRenderer.on('refresh-event-groups', ...)` | Listener Tauri `listen("refresh-event-groups", ...)` |
| Cierre automático de ventana tras guardar | `appWindow.close()` desde JS tras recibir confirmación de guardado, o Rust emite evento `close-editor` |
| Validación de formulario (alertas) | Migrar a componentes de error inline en lugar de `alert()` nativo |
| Sincronización de UI entre controles (syncActionExecutionCompatibility) | Permanece completamente en frontend; Rust solo persistencia |
| Sistema de semáforo (nota informativa) | Solo documentación visual; la lógica está en el motor de eventos del backend |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
