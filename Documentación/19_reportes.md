# 19 — Centro de Estado e Incidencias (Reportes)
*Módulo: `reportes.html` + `reportes.js` | IPC: `incident-sync-update`, `incident-request-sync`*

> **¿Qué es este módulo?**
> Es una ventana de monitoreo en tiempo real que consolida en un solo panel el estado operativo completo de la emisora: qué está pasando en el aire, cuántas acciones automáticas se han ejecutado, el estado del encoder de streaming, los próximos eventos programados, y un log histórico de incidencias clasificadas por categoría. Es el "panel de control de operaciones" para el operador de turno.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Centro de Estado e Incidencias |
| **Subtítulo** | "Vista completa del aire, eventos, encoder, sesión y acciones automáticas." |
| **Modo** | Ventana independiente (probablemente flotante o panel secundario) |
| **Comportamiento especial** | Al abrirse, solicita inmediatamente un snapshot de estado (`incident-request-sync`). Se actualiza en tiempo real mediante push del backend (`incident-sync-update`). No hace polling: solo responde a actualizaciones recibidas. |
| **Actualización manual** | Botón "Actualizar" que dispara `incident-request-sync` bajo demanda |

---

## 🧩 Elementos de la Interfaz

### 1. Header del Panel

#### Título y subtítulo
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Div `.reports-title` y `.reports-subtitle` |
| ⚡ **Qué** | Identificación del panel; el subtítulo enumera las categorías monitoreadas |
| ⏱️ **Cuándo** | Estático (no cambia) |
| 📍 **Dónde** | Cabecera del panel |
| 💡 **Por qué** | Orientación rápida para el operador que abre la ventana buscando información específica |

#### Botón Actualizar (`#btn-refresh-reports`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón miniatura `#btn-refresh-reports` con texto "Actualizar" |
| ⚡ **Qué** | Solicita al backend un snapshot fresco del estado del sistema |
| ⏱️ **Cuándo** | Siempre disponible; útil cuando el operador sospecha que la pantalla no está al día |
| 📍 **Dónde** | Esquina superior derecha del header |
| 💡 **Por qué** | El sistema funciona por push (el backend envía cuando hay cambios), pero si la conexión IPC se rompe momentáneamente, el operador puede forzar una actualización sin reiniciar |

---

### 2. Sección de Monitoreo en Tiempo Real

#### Badge "AUTO N" (`#incident-auto-count`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Badge `#incident-auto-count` en el header del panel de monitoreo |
| ⚡ **Qué** | Muestra el conteo de acciones automáticas ejecutadas durante la sesión actual (ej: "AUTO 7") |
| ⏱️ **Cuándo** | Se actualiza con cada snapshot recibido del backend |
| 📍 **Dónde** | Encabezado de la sección "Monitoreo en Tiempo Real" |
| 💡 **Por qué** | Indicador rápido de cuánto está "pilotando solo" el automatizador; un número alto en un turno tranquilo puede indicar que el operador no está atendiendo |

---

### 3. Tarjetas de Estado del Sistema

Cuatro tarjetas de estado (`#status-air`, `#status-events`, `#status-encoder`, `#status-session`) cada una con un tono visual (`data-tone`) que cambia el color según el estado.

#### Tarjeta Estado del Aire (`#status-air`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Card `#status-air` con label "Aire" |
| ⚡ **Qué** | Muestra si el automatizador está transmitiendo al aire o detenido |
| ⏱️ **Cuándo** | Valor por defecto: "Detenido". Cambia con cada snapshot |
| 📍 **Dónde** | Primera tarjeta de la barra de estado |
| 💡 **Por qué** | Indicador crítico: si marca "Detenido" y debería estar al aire, hay un problema de transmisión |

#### Tarjeta Estado de Eventos (`#status-events`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Card `#status-events` con label "Eventos" |
| ⚡ **Qué** | Indica si el motor de eventos programados está activo y monitoreando |
| ⏱️ **Cuándo** | Valor por defecto: "Activos". Cambia con cada snapshot |
| 📍 **Dónde** | Segunda tarjeta |
| 💡 **Por qué** | Si los eventos están inactivos, los bloques de publicidad y programas especiales no se ejecutarán automáticamente |

#### Tarjeta Estado del Encoder (`#status-encoder`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Card `#status-encoder` con label "Encoder" |
| ⚡ **Qué** | Muestra el estado de la conexión con el servidor de streaming (Icecast, SHOUTcast, etc.) |
| ⏱️ **Cuándo** | Valor por defecto: "Desconectado". Cambia con cada snapshot |
| 📍 **Dónde** | Tercera tarjeta |
| 💡 **Por qué** | El encoder es el puente entre el automatizador y el stream online; si está desconectado, la emisora deja de estar en internet aunque el audio suene localmente |

#### Tarjeta Estado de Sesión (`#status-session`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Card `#status-session` con label "Sesion" |
| ⚡ **Qué** | Muestra el estado de la sesión de trabajo actual |
| ⏱️ **Cuándo** | Valor por defecto: "Nueva". Cambia con cada snapshot |
| 📍 **Dónde** | Cuarta tarjeta |
| 💡 **Por qué** | Permite saber si se está trabajando con una sesión guardada (reanudación) o una sesión fresca |

**Tonos visuales de las tarjetas (`data-tone`):**
| Tono | Significado | Ejemplo |
|---|---|---|
| `ok` | Estado normal y esperado | Eventos Activos |
| `manual` | Estado neutro o controlado manualmente | Detenido |
| `warning` | Algo requiere atención | Encoder reconectando |
| `error` | Problema crítico | Encoder Desconectado en horario de emisión |

---

### 4. Guardia de Eventos / Timeline

#### Resumen de eventos próximos (`#reports-events-summary`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Span `#reports-events-summary` en el header de la guardia |
| ⚡ **Qué** | Texto resumido del próximo evento, ej: "Próximo: Comerciales en 4:32" |
| ⏱️ **Cuándo** | Se actualiza con cada snapshot. Valor por defecto: "Sin eventos proximos" |
| 📍 **Dónde** | Encabezado de la sección "Guardia eventos" |
| 💡 **Por qué** | Vista rápida sin necesidad de leer la línea de tiempo completa |

#### Timeline de eventos (`#reports-events-timeline`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Contenedor `#reports-events-timeline` con items dinámicos |
| ⚡ **Qué** | Lista visual de los próximos eventos programados en vigilancia. Cada item muestra: hora, nombre del evento, cuenta regresiva/metadata y etiqueta de estado |
| ⏱️ **Cuándo** | Se renderiza con cada snapshot. Si no hay eventos: muestra "No hay eventos programados en vigilancia." |
| 📍 **Dónde** | Sección de guardia de eventos, lista vertical |
| 💡 **Por qué** | El operador puede anticipar qué va a pasar en los próximos minutos sin salir de la ventana de estado |

**Campos por item de evento:**
| Campo | Descripción |
|---|---|
| `time` | Hora programada del evento (ej: "14:30") |
| `name` | Nombre del evento (ej: "Bloque Comercial") |
| `countdownText` / `message` | Cuenta regresiva o mensaje de estado (ej: "En 4 minutos") |
| `sourceSummary` | Fuente o descripción adicional del evento |
| `label` | Etiqueta de estado abreviada (ej: "PROG", "EJEC") |
| `status` | Estado del evento para estilos visuales: `scheduled`, `running`, `completed` |

---

### 5. Indicador de Última Acción Automática

#### `#incident-last-action`
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Div `#incident-last-action` |
| ⚡ **Qué** | Muestra el texto de la última acción ejecutada automáticamente por el sistema (ej: "Ultima autoaccion: Fade y siguiente pista ejecutados 14:25:03") |
| ⏱️ **Cuándo** | Se actualiza con cada snapshot |
| 📍 **Dónde** | Debajo de la guardia de eventos, antes de los filtros |
| 💡 **Por qué** | Trazabilidad: si suena algo inesperado, el operador puede verificar qué hizo el sistema automáticamente y cuándo |

---

### 6. Filtros de Categoría del Log

Botones de filtro que determinan qué categoría de incidencias se muestra en el log:

| Botón (`data-filter`) | Categoría |
|---|---|
| `all` (activo por defecto) | Todos los registros |
| `air` | Eventos relacionados con el aire (play, stop, pistas) |
| `guard` | Acciones de guardia automática |
| `audio` | Eventos del motor de audio (carga, error de archivo, etc.) |
| `events` | Ejecución de eventos programados |
| `encoder` | Conexión/desconexión del encoder de streaming |
| `session` | Inicio/fin de sesión, guardados |
| `system` | Eventos del sistema operativo o Electron |

**Comportamiento:**
- Solo un filtro puede estar activo a la vez
- El botón activo recibe la clase CSS `.active`
- Al cambiar el filtro, el log se re-renderiza inmediatamente con las entradas visibles (sin nueva petición al backend)

---

### 7. Log de Incidencias (`#sys-log`)

#### Entradas del log
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Contenedor `#sys-log` con entradas `.incident-entry` generadas dinámicamente |
| ⚡ **Qué** | Lista cronológica de eventos registrados. Cada entrada muestra: hora, tag de categoría y mensaje descriptivo |
| ⏱️ **Cuándo** | Se re-renderiza con cada snapshot o al cambiar el filtro. Mantiene la posición de scroll si el usuario ya había bajado en el log (scroll > 8px) |
| 📍 **Dónde** | Sección inferior del panel, con scroll propio |
| 💡 **Por qué** | Auditoría completa de lo que ha ocurrido en la emisora durante la sesión; fundamental para investigar incidentes ("¿por qué sonó ese jingle dos veces?") |

**Estructura de cada entrada:**
```
[HH:MM:SS]  [CATEGORÍA]
Mensaje descriptivo del evento
```

**Niveles de entrada (`data-level`):**
| Nivel | Uso |
|---|---|
| `info` | Eventos normales de operación |
| `warning` | Situaciones que requieren atención |
| `error` | Fallos o errores críticos |

**Scroll inteligente:**
Si el log ya estaba desplazado (el operador estaba leyendo entradas antiguas), la posición de scroll se preserva tras cada actualización. Si el usuario estaba en la parte superior, el scroll vuelve al inicio para mostrar la entrada más reciente.

**Estado vacío:** Si no hay incidencias para el filtro activo, muestra: "No hay incidencias para este filtro."

---

## 📡 Mapa de Comunicación IPC

### Mensajes enviados al Backend (`ipcRenderer.send`)
| Canal | Cuándo | Datos |
|---|---|---|
| `incident-request-sync` | Al cargar la ventana (inmediatamente en `DOMContentLoaded`) y al presionar el botón "Actualizar" | Sin payload — solicita un push del snapshot actual |

### Mensajes recibidos (`ipcRenderer.on`)
| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `incident-sync-update` | Enviado por el backend en respuesta a `incident-request-sync` o cuando hay cambios de estado | Reemplaza `currentSnapshot` completo y llama `renderSnapshot()`: actualiza badge AUTO, tarjetas de estado, timeline de eventos, última acción y log |

**Estructura del snapshot recibido:**
```json
{
  "statuses": {
    "air":     { "value": "Transmitiendo", "tone": "ok" },
    "events":  { "value": "Activos",       "tone": "ok" },
    "encoder": { "value": "Conectado",     "tone": "ok" },
    "session": { "value": "Activa",        "tone": "ok" }
  },
  "autoCount": 12,
  "lastAction": "Ultima autoaccion: Fade y siguiente pista 14:25:03",
  "eventWatch": {
    "summary": "Próximo: Bloque Comercial en 3:45",
    "items": [
      { "time": "14:30", "name": "Bloque Comercial", "countdownText": "En 3 min", "status": "scheduled", "label": "PROG" }
    ]
  },
  "entries": [
    { "time": "14:22:15", "category": "air", "level": "info", "message": "Pista iniciada: 'Bohemian Rhapsody'" },
    { "time": "14:22:10", "category": "audio", "level": "warning", "message": "Archivo no encontrado: track_123.mp3" }
  ]
}
```

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento v1.0 | Equivalente Tauri/Rust |
|---|---|
| `ipcRenderer.send('incident-request-sync')` | `tauri::command request_incident_sync()` — Rust responde emitiendo el evento |
| `ipcRenderer.on('incident-sync-update', snapshot)` | `tauri::event emit_to("reports", "incident-sync-update", IncidentSnapshot)` |
| `currentSnapshot` en memoria JS | El snapshot es un struct serializado desde Rust: `IncidentSnapshot { statuses, auto_count, last_action, event_watch, entries }` |
| Filtros de categoría (JS puro) | Mantener en JS/WebView; no requieren comunicación con Rust |
| Scroll inteligente (JS puro) | Mantener en JS/WebView |
| Push de actualizaciones en tiempo real | Tauri puede usar `tauri::EventEmitter` desde el hilo Rust del automatizador cada vez que cambia el estado, sin necesidad de polling |
| Renderizado dinámico del log | Mantener en JS/WebView; Rust solo envía los datos estructurados |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
