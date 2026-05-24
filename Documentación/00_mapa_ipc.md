# 00 — Mapa de Comunicación IPC (Inter-Process Communication)
*Módulo: `backend/ipc/*.js`*

> **¿Qué es este documento?**
> Este es el mapa maestro de cómo se comunican las distintas partes del sistema en la arquitectura Electron v1.0. Muestra qué canales utiliza el Frontend (los módulos HTML/JS) para solicitar datos o enviar órdenes al Backend (Node.js/SQLite).

---

## 🏗️ Arquitectura General de Comunicación

El sistema v1.0 utiliza el puente IPC nativo de Electron a través de un `preload.js` que expone los métodos seguros al frontend:
1. **Peticiones síncronas/asíncronas (`ipcRenderer.invoke`)**: El frontend pide datos y espera una respuesta (ej. buscar canciones en la BD).
2. **Mensajes asíncronos (`ipcRenderer.send`)**: El frontend envía un comando sin esperar respuesta (ej. abrir una ventana nueva).
3. **Eventos (Listeners `ipcRenderer.on`)**: El backend empuja información a las ventanas (ej. niveles de volumen, cambios en la base de datos).

Los manejadores (`handlers`) en el backend están divididos en 6 archivos modulares dentro de la carpeta `backend/ipc/`:

---

## 📁 1. `windows.js` (Gestión de Ventanas y Sistema)

Maneja la apertura de ventanas flotantes, diálogos del sistema operativo y controles maestros del Encoder.

| Canal IPC | Tipo | Función Principal |
|---|---|---|
| `dialog:openFile` | Invoke | Abre el selector de archivos nativo para elegir audios |
| `dialog:selectFolder` | Invoke | Abre el selector nativo para elegir carpetas |
| `open-library` | Send | Abre la ventana de la Biblioteca Musical |
| `open-settings` | Send | Abre la ventana de Ajustes Generales |
| `open-calendar` | Send | Abre la vista del Calendario de Eventos |
| `open-audio-editor` | Send | Abre el Editor de Audio Avanzado (Cues) |
| `open-console` | Send | Abre la Consola Virtual de Monitoreo (Vu-Meters) |
| `rust-pcm-encoder-status` | Invoke | Consulta el estado del encoder nativo (Motor Rust) |
| `show-context-menu` | Invoke | Dibuja un menú contextual nativo (Clic derecho) |

---

## 📁 2. `ui.js` (Diagnósticos, Vu-Meters y Mantenimiento)

Comandos para comunicación directa con el motor de audio nativo y mantenimiento de la base de datos.

| Canal IPC | Tipo | Función Principal |
|---|---|---|
| `db-maintenance-vacuum` | Invoke | Ejecuta VACUUM en SQLite para limpiar espacio |
| `db-maintenance-path-audit`| Invoke | Revisa problemas de mayúsculas/minúsculas en archivos |
| `audio-engine-rust-status`| Invoke | Obtiene el estado vital del motor de audio Rust |
| `audio-engine-command` | Invoke | Envía comandos de control remoto al motor Rust |
| `audio-engine-snapshot` | Invoke | Genera un volcado de memoria/estado del motor |
| `vu-levels` | Send | El frontend envía la amplitud (RMS/Peak) al backend |
| `incident-sync-broadcast` | Send | Envía logs de advertencias a la ventana de Reportes |

---

## 📁 3. `library.js` (Biblioteca Musical)

Todas las consultas (CRUD) de pistas y metadata de la librería.

| Canal IPC | Tipo | Función Principal |
|---|---|---|
| `db-get-tracks` | Invoke | Busca canciones (paginadas) con filtro/query |
| `db-get-artists` | Invoke | Obtiene la lista normalizada de perfiles de artistas |
| `db-save-track` | Invoke | Actualiza metadata manual de una canción |
| `db-delete-track` | Invoke | Elimina una canción de la base de datos |
| `lib-start-scan` | Invoke | Lanza el worker para escanear carpetas masivamente |
| `lib-start-analyzer` | Invoke | Lanza el worker para analizar audios (Mix/Fin) |

---

## 📁 4. `events.js` (Calendario y Eventos)

Control de la parrilla de programación y acciones programadas.

| Canal IPC | Tipo | Función Principal |
|---|---|---|
| `db-get-events` | Invoke | Descarga la lista de eventos automáticos |
| `db-get-schedule` | Invoke | Descarga la parrilla de programas editoriales |
| `db-save-events-full` | Send | Guarda la lista completa de eventos |
| `db-save-schedule-item` | Send | Actualiza un programa de la parrilla |
| `refresh-events` | Event | (Broadcast) Notifica que la BD de eventos cambió |

---

## 📁 5. `commercials.js` (Gestor de Publicidad)

CRUD específico para tandas y spots comerciales.

| Canal IPC | Tipo | Función Principal |
|---|---|---|
| `db-get-commercial-assets`| Invoke | Descarga los spots/cuñas |
| `db-get-commercial-blocks`| Invoke | Descarga la lista de tandas armadas |
| `db-save-commercial-block`| Invoke | Guarda una nueva tanda publicitaria |
| `db-log-commercial-play` | Invoke | Registra en la BD que un spot acaba de sonar (facturación) |

---

## 📁 6. `cartwall.js` (Botonera)

Manejo de estados de la botonera de efectos rápidos.

| Canal IPC | Tipo | Función Principal |
|---|---|---|
| `cartwall-get-pages` | Invoke | Obtiene la configuración de páginas y botones |
| `cartwall-save-button` | Invoke | Asigna un audio y color a un pad específico |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

En Tauri, el concepto de IPC se mantiene pero cambia su sintaxis y rendimiento:
1. **Comandos de Tauri (`invoke`)**: Reemplazan a `ipcRenderer.invoke`. En Tauri, las funciones de backend se exponen macro `#[tauri::command]`.
2. **Eventos Globales (`emit` / `listen`)**: Reemplazan a `ipcRenderer.send` / `ipcRenderer.on`.

### El Mayor Cambio (Eventos Frecuentes)
En la v1.0, se enviaban paquetes IPC masivos (ej. `vu-levels` 60 veces por segundo). En la v2.0 (Rust), **no se debe** enviar audio por IPC. El motor Rust maneja el audio y emite los Vu-Meters al frontend de forma optimizada. 

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
*Referencia para LF Automatizador v2.0 (Tauri + Rust)*
