# 17 — Configuración General (Ajustes)
*Módulo: `settings.html` + `settings.js`*

> **¿Qué es este módulo?**
> Es la ventana central de configuración del sistema LF Automatizador. Agrupa en pestañas todo lo referente al comportamiento de faders y mezclas, tipos de archivos de audio, enrutamiento de tarjetas de sonido, fuentes de hora/clima para locuación automática, comportamiento del ducking (pisadores), y la gestión de perfiles de la botonera (Cartwall). Los cambios se persisten en archivos JSON locales y se notifican al motor de audio en caliente.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Ajustes Generales |
| **Modo** | Ventana modal/flotante secundaria (se abre desde el menú principal) |
| **Diseño** | Sidebar de pestañas (izquierda) + área de contenido (derecha) + barra de botones fija al fondo |
| **Persistencia** | Los cambios se guardan en `config/file_types.json` y `config/general_settings.json` |
| **Snapshot de Cancelar** | Captura el estado de la UI 1500ms después de abrirse; Cancelar revierte a ese estado |

---

## 🧩 Elementos de la Interfaz

### 1. Sidebar de Pestañas (`.settings-sidebar`)

| Pestaña | ID del panel destino | Estado |
|---|---|---|
| Excepciones Mezclar | `tab-fades` | **Activa por defecto** |
| Tipos de Archivos | `tab-types` | Disponible |
| Salidas de Audio | `tab-audio` | Disponible |
| Hora y Clima | `tab-time` | Disponible |
| Pisadores (Ducking) | `tab-ducking` | Disponible |
| Perfiles Cartwall | `tab-cartwall` | Disponible |
| Atajos (Próximamente) | `tab-shortcuts` | Deshabilitado visualmente (color gris, módulo en desarrollo) |

Al hacer clic en una pestaña: la pestaña anterior se desactiva, su panel se oculta, y la nueva pestaña y su panel se muestran.

---

### 2. Pestaña: Excepciones de Faders por Tipo (`#tab-fades`)

Esta pestaña define el comportamiento de transición de audio (fades, mezclas) para cada tipo de archivo de la biblioteca.

#### Selector "Seleccionar Tipo de Archivo" (`#sel-tipo-archivo`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Select dropdown que lista: "Música (Predeterminado General)" + todos los tipos de archivo creados |
| ⚡ **Qué** | Al cambiar, carga los valores de faders para ese tipo específico en los campos de la pestaña |
| ⏱️ **Cuándo** | Siempre disponible |
| 📍 **Dónde** | Los campos de fader debajo se actualizan automáticamente |
| 💡 **Por qué** | Los comerciales, jingles y la voz horaria tienen comportamientos de fade completamente distintos a la música |

#### Sección "Entrada (Fade In)"

| Campo | ID | Tipo | Descripción |
|---|---|---|---|
| Activar | `#chk-fadein` | Checkbox | Habilita el fade in al inicio de la reproducción |
| Duración | `#num-fadein` | Número (seg, paso 0.1) | Tiempo en segundos del fade in |

#### Sección "Salida (Fade Out) Manual"

| Campo | ID | Tipo | Descripción |
|---|---|---|---|
| Al Stop — Activar | `#chk-fadeout-stop` | Checkbox | Fade out al presionar STOP |
| Al Stop — Duración | `#num-fadeout-stop` | Número (seg, paso 0.1) | Tiempo del fade al detener |
| Al Siguiente — Activar | `#chk-fadeout-next` | Checkbox | Fade out al avanzar manualmente (NEXT) |
| Al Siguiente — Duración | `#num-fadeout-next` | Número (seg, paso 0.1) | Tiempo del fade al avanzar |

#### Sección "Punto de Mezcla (MIX)"

| Campo | ID | Tipo | Descripción |
|---|---|---|---|
| Fijo — Activar | `#chk-mix` | Checkbox | Punto de mezcla fijo (N segundos antes del final) |
| Fijo — Valor | `#num-mix` | Número (seg, paso 0.1) | Tiempo antes del final en que inicia la mezcla |
| Inteligente (dB) — Activar | `#chk-mix-db` | Checkbox | El motor calcula el punto de mezcla cuando el nivel cae al umbral configurado |
| Inteligente — Nivel | `#num-mix-db` | Número (dB, paso 1, máx 0) | Umbral de decibelios para el punto de mezcla. Default: -14 dB |

#### Sección "Fade Out de Mezcla"

| Campo | ID | Tipo | Descripción |
|---|---|---|---|
| Activar | `#chk-mix-fadeout` | Checkbox | Si está activo, la cola baja gradualmente desde el MIX hasta el FIN. Si no, la cola se mantiene al volumen completo hasta que termine |

> **Comportamiento scroll:** Todos los campos numéricos (`type="number"`) permiten usar la rueda del ratón para incrementar/decrementar el valor respetando el paso (`step`) y los límites (`min`/`max`).

---

### 3. Pestaña: Tipos de Archivos (`#tab-types`)

Define los "tipos" de contenido que el sistema puede reconocer automáticamente para aplicarles colores, comportamientos y reglas de emisión.

#### Lista de Tipos (`#file-types-list`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Lista `<ul>` donde cada `<li>` es un tipo de archivo, coloreado según su color asignado |
| ⚡ **Qué** | Al clicar un tipo, se cargan sus propiedades en el panel de detalles y sus faders en la pestaña de Excepciones |
| ⏱️ **Cuándo** | Los tipos `readonly` (Comercial, Locución horaria, Station ID) tienen sus campos de nombre/identificador/color deshabilitados |
| 📍 **Dónde** | Panel izquierdo de la pestaña |
| 💡 **Por qué** | Un operador puede tener decenas de tipos de contenido diferentes (cuñas, promos, separadores, etc.) |

**Tipos predeterminados del sistema (solo lectura):**
| Nombre | Identificador | Color | Locución/Voz | Reportes |
|---|---|---|---|---|
| Comercial | `comercial` | Rojo `#ff0000` | No | Sí |
| Locución horaria | `saytime` | Verde `#2ecc71` | Sí | Sí |
| Station ID | `id` | Azul `#3498db` | No | Sí |

#### Botones de Gestión de Tipos

| Botón | ID | Acción |
|---|---|---|
| + | `#btn-add-type` | Crea un nuevo tipo con valores por defecto y lo selecciona |
| X | `#btn-del-type` | Elimina el tipo seleccionado (solo tipos no `readonly`) |

#### Panel de Propiedades del Tipo

| Campo | ID | Editable en readonly | Descripción |
|---|---|---|---|
| Nombre | `#type-name` | ❌ | Nombre visible del tipo en las listas |
| Identificador | `#type-identifier` | ❌ | Texto/sufijo que el sistema busca en el nombre de archivo o carpeta para auto-clasificar |
| Color (Lista) | `#type-color` | ❌ | Color de resaltado en la playlist y otras listas. Input nativo de color |
| Nivel (Amp) | `#type-amp` | ✅ | Ajuste de ganancia automático en dB (0 = sin cambio) |
| Incluir en Reportes | `#type-report` | ✅ | Si las emisiones de este tipo se cuentan en reportes de emisión |
| Es Locución/Voz | `#type-voice` | ✅ | Si este tipo activa el ducking (baja la música de fondo al reproducirse) |

> Al cambiar cualquier propiedad del tipo, el estado se guarda automáticamente en memoria (no en disco). La persistencia real ocurre al pulsar "Aplicar" o "Aceptar y Cerrar".

---

### 4. Pestaña: Motor y Salidas de Audio (`#tab-audio`)

Define el enrutamiento de audio para cada función del sistema. El motor es siempre **Rust Audio** (el modo WebAudio fue retirado).

#### Sección "Motor"

| Campo | ID | Valor fijo | Descripción |
|---|---|---|---|
| Motor activo | `#sel-audio-engine-mode` | `rustAudio` (única opción) | Motor Rust: enumera y controla tarjetas de sonido nativas del sistema operativo |

> El selector muestra solo "Rust Audio (motor principal)". Al guardar, siempre se fuerza `audioEngineMode: 'rustAudio'` independientemente del valor visible.

#### Sección "Ruta Principal"

| Campo | ID | Descripción |
|---|---|---|
| Salida Master (Aire) | `#sel-out-main` | La tarjeta de sonido principal; todo el audio al aire sale por aquí |
| Activar salida de monitores | `#chk-monitor-enabled` | Checkbox que habilita/deshabilita la segunda salida de monitoreo. Despliega más opciones al activarse |
| Salida de Monitores | `#sel-out-monitor` | (Visible si monitor habilitado) Tarjeta de sonido para los monitores del estudio |
| Escucha de monitor | `#sel-monitor-source-mode` | (Visible si monitor habilitado) Fuente para el monitor: **Post-FX** (señal procesada) o **Pre-FX** (mezcla limpia sin efectos) |
| Mostrar control MON en ventana principal | `#chk-monitor-volume-ui` | (Visible si monitor habilitado) Muestra el fader de volumen MON en la interfaz principal |
| Ubicación del control MON | `#sel-monitor-volume-ui-mode` | (Visible si monitor y UI habilitados) **Junto al fader Master** o **Como icono desplegable arriba** |

#### Sección "Preescucha y Editores"

| Campo | ID | Descripción |
|---|---|---|
| Salida CUE / Preescucha | `#sel-out-cue` | Tarjeta de sonido para la preescucha y los tres editores de audio. También se guarda en `localStorage` |

#### Sección "Playlists"

| Campo | ID | Descripción |
|---|---|---|
| Modo de salida auxiliar | `#sel-playlist-output-mode` | **Desactivado** / **Todas por la misma tarjeta** / **Una tarjeta por playlist** |
| Salida compartida playlists | `#sel-playlist-shared` | (Visible si modo = "compartida") Tarjeta para todas las playlists |
| Playlist 1–4 | `#sel-pl-out-1` a `#sel-pl-out-4` | (Visible si modo = "independiente") Una tarjeta por cada playlist |

> Estas son salidas **auxiliares** de flujo de trabajo. Las playlists siempre siguen conectadas al Master para la emisión continua.

#### Sección "Botonera / Cartwall"

| Campo | ID | Descripción |
|---|---|---|
| Destino del cartwall | `#sel-cartwall-mode` | **Master** / **Monitores** / **CUE / Preescucha** / **Tarjeta dedicada** |
| Tarjeta dedicada | `#sel-out-cartwall` | (Visible si modo = "Tarjeta dedicada") Dispositivo exclusivo para el cartwall |

**Enumeración de dispositivos:**
- Al abrir la pestaña, el sistema consulta automáticamente al motor Rust via `audio-engine-rust-command` para obtener la lista de salidas de audio nativas.
- Si el motor Rust no responde, cae al API del navegador (`navigator.mediaDevices.enumerateDevices`).
- Al cerrar/abrir Ajustes, los ID de tarjetas se reconocen aunque cambien entre sesiones mediante un algoritmo de coincidencia por tokens del nombre del dispositivo.

---

### 5. Pestaña: Hora y Clima (`#tab-time`)

#### Sección "Locuación Horaria"

| Campo | ID | Descripción |
|---|---|---|
| Ruta de audios | `#txt-time-folder` | Ruta de la carpeta con archivos de voz horaria (HRS01.mp3, MIN15.mp3, etc.). Solo lectura; se selecciona con el botón |
| Botón "Examinar..." | `#btn-browse-time` | Abre el diálogo nativo de selección de carpeta (vía `dialog:selectFolder`) |

#### Sección "Locuación de Clima"

| Campo | ID | Descripción |
|---|---|---|
| Ciudad/Municipio | `#txt-weather-city` | Nombre de la ciudad para obtener clima. Con autocompletado (datalist) vía API de Open-Meteo mientras escribe (debounce 500ms, mínimo 3 caracteres) |
| Unidad | `#sel-weather-unit` | Centígrados (°C) o Fahrenheit (°F) |
| Botón "Comprobar" | `#btn-weather-fetch` | Consulta Open-Meteo: primero hace geocoding de la ciudad, luego obtiene temperatura y humedad actuales |
| Temperatura actual | `#lbl-weather-temp` | Muestra el dato obtenido en verde. Ejemplo: "🌡️ 23 °C" |
| Humedad actual | `#lbl-weather-humidity` | Muestra el dato obtenido en azul. Ejemplo: "💧 68 %" |
| Última actualización | `#lbl-weather-updated` | Hora de la última consulta exitosa (se carga desde `config/weather.json` al abrir) |
| Carpeta de audios | `#txt-weather-folder` | Ruta de los audios de locución de clima |
| Botón "Examinar..." | `#btn-browse-weather` | Abre el diálogo nativo de selección de carpeta |

**Flujo de consulta de clima:**
1. El usuario escribe la ciudad → autocompletado sugiere opciones de la API de geocoding
2. Al clicar "Comprobar" → geocoding → coordenadas → consulta de temperatura/humedad
3. Los datos se muestran en pantalla
4. Al guardar Ajustes, la ciudad y unidad se persisten en `general_settings.json`

---

### 6. Pestaña: Pisadores / Ducking (`#tab-ducking`)

Define cómo reacciona la música principal cuando se lanza contenido superpuesto (locución horaria, overlay P1/P2, o cartwall).

| Campo | ID | Rango | Default | Descripción |
|---|---|---|---|---|
| Volumen de fondo durante ducking | `#num-duck-vol` | 0–100% | 20% | A qué volumen baja la música mientras se reproduce la locución o jingle superpuesto |
| Tiempo de fundido (fade up/down) | `#num-duck-fade` | ≥ 0.1 seg (paso 0.1) | 1.0 seg | Cuánto tarda el audio en bajar y en volver a su nivel original |

---

### 7. Pestaña: Perfiles de la Botonera Cartwall (`#tab-cartwall`)

Gestiona múltiples configuraciones de la botonera para diferentes locutores o programas.

#### Lista de Perfiles (`#cw-profile-list`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Lista `<ul>` con los perfiles existentes. El activo aparece marcado con "[ACTIVO]" |
| ⚡ **Qué** | Al clicar un perfil, se cargan sus propiedades en el panel de detalles |
| ⏱️ **Cuándo** | Los perfiles se cargan desde el backend vía `get-cartwall-profiles` al abrir la pestaña |
| 📍 **Dónde** | Panel izquierdo de la pestaña |
| 💡 **Por qué** | Diferentes locutores pueden tener sets de sonidos completamente distintos en la botonera |

#### Botones de Gestión de Perfiles

| Botón | ID | Acción |
|---|---|---|
| + | `#btn-cw-add` | Crea un nuevo perfil con paleta de 5×5 botones vacíos |
| X | `#btn-cw-del` | Elimina el perfil seleccionado (mínimo 1 perfil; abre diálogo con opción de exportar antes de eliminar) |
| IMP | `#btn-cw-import` | Importa un perfil desde un archivo `.bdeplf` (formato propio de LF Automatizador) |
| EXP | `#btn-cw-export` | Exporta el perfil seleccionado a un archivo `.bdeplf` |

#### Panel de Propiedades del Perfil

| Campo | ID | Descripción |
|---|---|---|
| Nombre | `#cw-prof-name` | Nombre del perfil (ej. "Matutino", "Tarde", "Locutor 1") |
| Color Fondo | `#cw-prof-bg` | Color de fondo de los botones del cartwall para este perfil |
| Color Texto | `#cw-prof-text` | Color del texto de los botones para este perfil |
| Botón "Activar este Perfil" | `#btn-cw-activate` | Marca este perfil como el activo; la botonera en la ventana principal cambia a sus colores y botones |

> Los cambios de nombre y colores se guardan automáticamente en el backend al modificar el campo (sin necesidad de pulsar "Aplicar").

---

### 8. Pestaña: Atajos de Teclado (`#tab-shortcuts`)

> **Módulo en desarrollo** — La pestaña está visualmente deshabilitada (opacidad 0.3, sin interacción). Muestra un badge "MÓDULO EN DESARROLLO" superpuesto.

**Vista previa de los atajos planificados:**
| Acción | Tecla (planificada) |
|---|---|
| Play / Pausa (Playlist) | P |
| Detener Todo | S |
| Siguiente Canción | N |
| Marcar como Siguiente | Q |
| Pausar al Finalizar | F |
| Locución de Hora | Ctrl + H |

---

### 9. Barra de Botones (`.settings-footer-buttons`)

| Botón | ID | Comportamiento |
|---|---|---|
| Cancelar | `#btn-cancel` | Revierte la UI al estado snapshot (capturado 1500ms después de abrir) y **cierra sin guardar**. Los cambios en selectores se descartan sin enviar comandos al motor |
| Aplicar | `#btn-apply` | Persiste todos los cambios + notifica al motor Rust en caliente + **actualiza el snapshot** (para que un posterior Cancelar revierta a este nuevo estado) + **NO cierra la ventana** |
| Aceptar y Cerrar | `#btn-accept` | Persiste + notifica al motor + **cierra la ventana** |

**Comportamiento del Cancelar (snapshot):**
- 1500ms después de abrir, se captura el estado de todos los selectores y checkboxes relevantes.
- El snapshot se actualiza cada vez que se pulsa "Aplicar".
- Cancelar revierte a ese snapshot y dispara eventos `change` para que los listeners de visibilidad recalculen qué opciones mostrar.

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo | Retorna |
|---|---|---|
| `audio-engine-rust-command` | Al abrir la pestaña de Audio (con `{ cmd: 'devices' }`) | `{ success, message: { outputs[], defaultOutputId, defaultOutput } }` |
| `dialog:selectFolder` | Al pulsar "Examinar..." en Time o Weather | Ruta de carpeta seleccionada (string) o undefined |
| `get-cartwall-profiles` | Al abrir la pestaña de Cartwall | `{ profiles[], activeProfileId }` |
| `save-cartwall-profiles` | Al modificar nombre/colores o activar perfil | — |
| `preguntar-eliminar-perfil` | Al pulsar X en perfiles Cartwall | 0 = eliminar / 1 = exportar y eliminar / otro = cancelar |
| `exportar-bdeplf` | Al elegir exportar al eliminar, o al pulsar EXP | Resultado de la exportación |
| `importar-bdeplf` | Al pulsar IMP | Objeto perfil importado |

### Mensajes enviados al Backend (`ipcRenderer.send`)

| Canal | Cuándo | Datos |
|---|---|---|
| `settings-updated` | Al pulsar Aplicar o Aceptar | `{ audioChanged: bool, audioEngineModeChanged: bool }` |

### Llamadas externas HTTP (directo desde el frontend)

| API | Cuándo | Propósito |
|---|---|---|
| `geocoding-api.open-meteo.com` | Al escribir ciudad (debounce 500ms) y al pulsar "Comprobar" | Autocompleto de ciudades + geocoding |
| `api.open-meteo.com` | Al pulsar "Comprobar" | Temperatura y humedad actual de las coordenadas obtenidas |

> **Nota para v2.0:** Estas llamadas HTTP deberían moverse al backend Rust para evitar problemas de CORS y mejorar la seguridad.

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| IPC / Función actual | Equivalente en Tauri/Rust |
|---|---|
| `audio-engine-rust-command` `devices` (invoke) | Comando Tauri `get_audio_devices` → lista de outputs del motor Rust |
| `dialog:selectFolder` (invoke) | API de diálogos nativa de Tauri `tauri::api::dialog::pick_folder` |
| `get-cartwall-profiles` / `save-cartwall-profiles` (invoke) | Comandos Tauri `get_cartwall_profiles` / `save_cartwall_profiles` → JSON en disco |
| `preguntar-eliminar-perfil` (invoke) | Diálogo nativo Tauri con opciones |
| `exportar-bdeplf` / `importar-bdeplf` (invoke) | Comandos Tauri con `tauri::api::dialog::save_file` / `pick_file` + serialización JSON |
| `settings-updated` (send) | Evento Tauri `emit` hacia la ventana principal para reinicializar el motor |
| Lectura/escritura directa de JSON (`file_types.json`, `general_settings.json`) | Comandos Tauri `get_settings` / `save_settings` → acceso a disco en el proceso Rust |
| Consultas HTTP clima (fetch desde frontend) | Comando Tauri `fetch_weather` → `reqwest` async desde Rust (mejor para CORS y seguridad) |
| Snapshot de Cancelar (estado en memoria JS) | Estado en el frontend Tauri; la lógica de snapshot puede mantenerse en JS/TS dentro del WebView |
| Rueda del ratón en inputs numéricos (`wheel` event) | Se mantiene en JS dentro del WebView (comportamiento de UI) |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
