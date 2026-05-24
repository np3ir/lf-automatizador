# 20 — Administrador de Tareas LF
*Módulo: `task_manager.html` + `task_manager.js` | IPC: `task-manager-snapshot`*

> **¿Qué es este módulo?**
> Es una ventana de diagnóstico de rendimiento del sistema, equivalente a un "Task Manager" simplificado pero específico para LF Automatizador. Muestra en tiempo real el consumo de CPU y RAM de cada proceso Electron de la aplicación, así como el estado de los "trabajos dedicados" (workers) internos. Está marcado explícitamente como "En desarrollo" y es solo de lectura.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Administrador de tareas LF |
| **Modo** | Flotante, solo lectura, **se cierra al perder el foco** |
| **Badge de estado** | "EN DESARROLLO" (naranja) — visible en el header principal |
| **Subtítulo** | "Vista de diagnostico. Solo lectura, se cierra al perder foco." |
| **Actualización automática** | Cada 1 segundo (polling con `setInterval(refresh, 1000)`) |
| **Primera carga** | `refresh()` se llama inmediatamente al cargar, sin esperar el primer segundo |

> [!IMPORTANT]
> Esta ventana **se cierra automáticamente al perder el foco** (comportamiento gestionado desde el proceso principal de Electron, no desde este JS). Es una herramienta de diagnóstico rápido, no una ventana de trabajo permanente.

---

## 🧩 Elementos de la Interfaz

### 1. Sección de Métricas Globales (Summary Bar)

Cuatro tarjetas métricas en grid horizontal que muestran los totales de la aplicación:

#### CPU Total (`#total-cpu`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Métrica `#total-cpu` con label "CPU App real" |
| ⚡ **Qué** | Muestra el porcentaje total de CPU consumido por todos los procesos Electron de la aplicación en el momento actual |
| ⏱️ **Cuándo** | Se actualiza cada segundo |
| 📍 **Dónde** | Primera tarjeta del summary, valor grande en blanco |
| 💡 **Por qué** | Alerta al técnico si la aplicación está consumiendo demasiada CPU (ej: analizando muchos archivos de audio simultáneamente), lo que podría causar glitches en la reproducción |

**Formato:** `X.X%` (con un decimal)

#### RAM Total (`#total-memory`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Métrica `#total-memory` con label "RAM App real" |
| ⚡ **Qué** | Muestra el consumo total de memoria RAM de la aplicación en el momento actual |
| ⏱️ **Cuándo** | Se actualiza cada segundo |
| 📍 **Dónde** | Segunda tarjeta del summary |
| 💡 **Por qué** | Monitorear fugas de memoria durante sesiones largas de transmisión; si la RAM sube sin parar, indica un problema en el código |

**Formato:** `X MB` (sin decimal si ≥ 100 MB; con un decimal si < 100 MB)

#### Pico de RAM en sesión (`#peak-memory`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Métrica `#peak-memory` con label "Pico RAM sesion" |
| ⚡ **Qué** | Muestra el valor máximo de RAM que ha alcanzado la aplicación desde que se abrió el Administrador de Tareas. **Nunca decrece** dentro de una sesión del panel |
| ⏱️ **Cuándo** | Se actualiza cada segundo con `Math.max(peakMemoryKb, currentMemoryKb)` |
| 📍 **Dónde** | Tercera tarjeta del summary |
| 💡 **Por qué** | Indicador de eficiencia de memoria: si el pico es muy alto aunque el actual sea bajo, indica que hubo un momento de consumo elevado (ej: durante la carga masiva de una biblioteca) |

#### Estado de Disco (`disk-status`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Métrica `#disk-status` con label "Disco" |
| ⚡ **Qué** | Muestra el estado del uso de disco |
| ⏱️ **Cuándo** | Valor fijo: "N/D" (No Disponible) — funcionalidad no implementada aún |
| 📍 **Dónde** | Cuarta tarjeta del summary |
| 💡 **Por qué** | Reservado para futura monitorización de velocidad de I/O de disco, relevante durante la importación masiva de archivos de audio |

---

### 2. Tabla de Procesos Electron

Muestra cada proceso del sistema Electron con sus métricas individuales.

#### Tabla de procesos (`#process-body`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Tabla con `tbody#process-body` generado dinámicamente |
| ⚡ **Qué** | Lista cada proceso Electron (proceso principal, renderers, GPU, utilities) con sus métricas en tiempo real |
| ⏱️ **Cuándo** | Se re-renderiza cada segundo con los datos del snapshot |
| 📍 **Dónde** | Sección "Procesos Electron" en el área principal |
| 💡 **Por qué** | Permite identificar qué ventana o proceso específico está causando problemas de rendimiento |

**Columnas de la tabla:**

| Columna | Descripción | Formato |
|---|---|---|
| PID | Identificador del proceso | Número entero |
| Tipo | Tipo de proceso Electron | Texto localizado (ver tabla abajo) |
| Ventana | Nombre/label de la ventana asociada | Texto o "-" |
| CPU | Uso de CPU del proceso | `X.X%` |
| RAM | Memoria RAM del proceso | `X.X MB` |
| Privada | Memoria privada del proceso | `X.X MB` |
| Disco | I/O de disco del proceso | "N/D" (no implementado) |

**Tipos de proceso y su etiqueta localizada:**

| Tipo Electron | Etiqueta mostrada | Descripción |
|---|---|---|
| `Browser` | Principal | El proceso main de Electron |
| `Tab` | Renderer | Cada ventana/webview (playlist, editores, etc.) |
| `GPU` | GPU | Proceso de aceleración gráfica |
| `Utility` | Utilidad | Procesos auxiliares del sistema Electron |
| `Zygote` | Zygote | Proceso de inicialización (Linux) |
| `Sandbox_helper` | Sandbox | Proceso de aislamiento de seguridad |
| (desconocido) | Desconocido | Tipo no catalogado |

**Indicador de diagnóstico:** Si un proceso tiene `diagnostic: true`, su tipo muestra un asterisco `*` adicional.

---

### 3. Tabla de Trabajos Dedicados (Workers)

Muestra el estado de los workers internos de LF Automatizador.

#### Tabla de workers (`#worker-body`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Tabla con `tbody#worker-body` generado dinámicamente |
| ⚡ **Qué** | Lista los trabajos en segundo plano del automatizador (ej: analizador de picos, importador de biblioteca, motor de eventos) con su estado activo/inactivo y un detalle descriptivo |
| ⏱️ **Cuándo** | Se re-renderiza cada segundo con los datos del snapshot |
| 📍 **Dónde** | Sección "Trabajos dedicados" en el área principal |
| 💡 **Por qué** | Permite verificar si los workers críticos están funcionando (ej: "¿está el analizador de peaks corriendo o se colgó?") |

**Columnas de la tabla:**

| Columna | Descripción |
|---|---|
| Trabajo | Nombre descriptivo del worker |
| Estado | "Activo" (verde) o "Inactivo" (gris) |
| Detalle | Información adicional del estado del worker |

**Estados visuales:**
| Estado | Clase CSS | Color |
|---|---|---|
| Activo | `.active` | Verde (`#2ecc71`) |
| Inactivo | `.idle` | Gris (`#8795a3`) |

---

### 4. Footer — Nota de Precisión

| Elemento | Contenido |
|---|---|
| Footer informativo | "Los valores de uso de CPU y RAM son estimaciones del motor interno de Chromium (Electron) y pueden no ser 100% exactos con respecto a los medidos de manera nativa por el Administrador de tareas de Windows." |

> [!NOTE]
> Esta aclaración es importante para el técnico: los valores mostrados son los que reporta Chromium internamente, que pueden diferir de lo que muestra el Task Manager de Windows porque Chromium agrupa procesos y calcula el CPU de forma diferente al sistema operativo.

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)
| Canal | Cuándo | Retorna |
|---|---|---|
| `task-manager-snapshot` | Cada 1 segundo (polling) y al cargar la ventana | `{ totals: { cpu, memoryKb }, metrics: ProcessMetric[], workers: WorkerStatus[] }` |

**Estructura del snapshot:**
```json
{
  "totals": {
    "cpu": 12.5,
    "memoryKb": 524288
  },
  "metrics": [
    {
      "pid": 1234,
      "type": "Browser",
      "label": "Main Process",
      "cpu": 2.1,
      "memoryKb": 102400,
      "privateKb": 98304,
      "diagnostic": false
    },
    {
      "pid": 1235,
      "type": "Tab",
      "label": "Playlist Principal",
      "cpu": 8.3,
      "memoryKb": 204800,
      "privateKb": 196608,
      "diagnostic": false
    }
  ],
  "workers": [
    { "name": "Analizador de Peaks",   "active": true,  "detail": "Procesando 12 archivos" },
    { "name": "Motor de Eventos",      "active": true,  "detail": "Vigilando 3 eventos" },
    { "name": "Importador Biblioteca", "active": false, "detail": "Inactivo" }
  ]
}
```

### Sin mensajes enviados (`ipcRenderer.send`)
Este módulo es **solo lectura**: no envía ningún mensaje al backend (aparte del invoke de polling).

### Sin mensajes recibidos (`ipcRenderer.on`)
No hay suscripciones a eventos push. Toda la información llega por polling via invoke.

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento v1.0 | Equivalente Tauri/Rust |
|---|---|
| `ipcRenderer.invoke('task-manager-snapshot')` | `tauri::command get_task_manager_snapshot() -> TaskManagerSnapshot` |
| `setInterval(refresh, 1000)` | En Tauri, considerar cambiar a push: Rust emite `task-manager-update` cada 1s vía `EventEmitter`, eliminando el polling y reduciendo el overhead IPC |
| Métricas de procesos Electron | En Tauri: `tauri::api::process::current()` + `sysinfo` crate para CPU/RAM de procesos individuales |
| `snapshot.totals.cpu` y `memoryKb` | `sysinfo::System::refresh_processes()` → sumatoria de procesos de la app |
| Workers (`snapshot.workers`) | Rust mantiene una lista de `Arc<Worker>` con flags `is_active` y `detail: String` actualizables desde cada worker |
| Cierre al perder foco | `tauri::WindowBuilder::on_window_event(WindowEvent::Focused(false)) { window.close() }` |
| Nota de precisión del footer | Mantener en el HTML de Tauri WebView; el texto cambiará de "Chromium" a "Tauri/WebKit" según la plataforma |
| Disco ("N/D") | Implementar con `sysinfo::Disk::total_space()` y `available_space()` en Rust |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
