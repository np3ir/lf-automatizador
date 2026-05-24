# 15 — Catálogo de Artistas (Biblioteca de Cédulas)
*Módulo: `artist_catalog.html` + `artist_catalog.js` | Servicio backend: `backend/services/artists.js`*

> **¿Qué es este módulo?**
> Es la galería central donde el operador de radio visualiza y administra todas las fichas de artistas registrados en la biblioteca musical. Permite buscar, filtrar, seleccionar en masa, ordenar, fusionar duplicados y lanzar el autocompletado de metadatos desde internet. Funciona como el punto de entrada para acceder a cualquier Ficha de Artista individual.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Biblioteca de Cédulas — LF Automatizador |
| **Modo** | Ventana principal independiente (flotante no modal) |
| **Diseño** | Barra superior fija + panel lateral de filtros + galería principal scrollable |
| **Responsive** | Se adapta a pantallas < 920px apilando el sidebar arriba de la galería |

---

## 🧩 Elementos de la Interfaz

### 1. Barra Superior (Header)

#### Logo / Título (`logo-section`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Círculo con letra "C" + texto "BIBLIOTECA DE CEDULAS" |
| ⚡ **Qué** | Elemento decorativo de identidad — no es interactivo |
| ⏱️ **Cuándo** | Siempre visible |
| 📍 **Dónde** | Esquina superior izquierda |
| 💡 **Por qué** | Identificar el módulo de un vistazo en el flujo de trabajo de radio |

#### Campo de Búsqueda (`#search-input`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Input de texto con icono de lupa, placeholder: "Buscar por artista, genero, nacionalidad o etiquetas..." |
| ⚡ **Qué** | Filtra la galería en tiempo real con debounce de 120ms. Busca en: nombre, género, nacionalidades, subgéneros, tipo de artista |
| ⏱️ **Cuándo** | Siempre disponible. La búsqueda ignora acentos y mayúsculas (normalización NFD) |
| 📍 **Dónde** | La galería de tarjetas se actualiza al instante mostrando solo los artistas que coincidan |
| 💡 **Por qué** | En producción en vivo, el operador necesita localizar artistas al vuelo sin perder tiempo |

#### Botón "Actualizar" (`#btn-refresh`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón secundario gris |
| ⚡ **Qué** | Vuelve a pedir el catálogo completo al backend (`artist-catalog-get-data`) y re-renderiza la galería |
| ⏱️ **Cuándo** | Siempre activo, excepto durante un proceso de Auto-completar en curso |
| 📍 **Dónde** | La galería se refresca con los datos más recientes de la base de datos |
| 💡 **Por qué** | Permite ver cambios hechos desde otras ventanas (ej. el editor de biblioteca) sin cerrar el catálogo |

#### Botón "Auto-completar" (`#btn-autofill`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón gris que se deshabilita durante la operación |
| ⚡ **Qué** | Lanza la búsqueda masiva en internet de metadatos (foto, nacionalidad, tipo) para artistas pendientes o los seleccionados. Solo rellena campos vacíos — no sobreescribe curación manual |
| ⏱️ **Cuándo** | Si hay artistas seleccionados → auto-completa solo esos. Si no hay selección → auto-completa todos los pendientes. Requiere confirmación con `confirm()`. Deshabilitado mientras está en proceso |
| 📍 **Dónde** | El progreso se muestra en la franja `#bulk-status` (ej. "3/12: Marc Anthony"). Al terminar, muestra resumen de actualizados/fallidos |
| 💡 **Por qué** | Ahorra horas de trabajo manual al operador; las fotos y datos biográficos son esenciales para la presentación en pantalla de la emisora |

**Estados del auto-completar:**
| Estado | Visual |
|---|---|
| Inactivo | Botón habilitado, bulk-status vacío |
| En progreso | Botones principales deshabilitados, bulk-status muestra "N/total: NombreArtista" |
| Finalizado | bulk-status muestra "Listo: X actualizados, Y con foto, Z fallidos" |

#### Selector de Orden (`#sort-mode`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Select estilizado con 4 opciones |
| ⚡ **Qué** | Reordena la galería completa sin filtros adicionales |
| ⏱️ **Cuándo** | Deshabilitado durante auto-completar en curso |
| 📍 **Dónde** | La galería se re-renderiza inmediatamente al cambiar |
| 💡 **Por qué** | El operador puede priorizar artistas que más necesitan atención (pendientes) o trabajar en un género específico |

**Opciones de orden:**
| Valor | Criterio |
|---|---|
| `name` | Alfabético por nombre de artista (collation español, numérico) |
| `tracks` | Mayor cantidad de canciones primero |
| `pending` | Fichas pendientes (sin curación) primero |
| `genre` | Alfabético por género principal, luego por nombre |

#### Botón "Vista lista" / "Vista tarjetas" (`#btn-view-toggle`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón de alternancia |
| ⚡ **Qué** | Alterna entre vista cuadrícula (grid de tarjetas con foto) y vista de lista (filas compactas con columnas: foto, nombre, género, estado) |
| ⏱️ **Cuándo** | Deshabilitado durante auto-completar. El estado actual se conserva en la sesión |
| 📍 **Dónde** | La galería se re-renderiza con el nuevo layout. El botón cambia su texto al modo contrario |
| 💡 **Por qué** | Vista en cuadrícula para explorar visualmente; vista lista para gestión masiva rápida |

#### Botón "+ Nuevo Artista" (`#btn-new`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón primario azul |
| ⚡ **Qué** | Muestra un `prompt()` nativo pidiendo el nombre del artista y abre su ficha de creación |
| ⏱️ **Cuándo** | Deshabilitado durante auto-completar. Si el nombre está vacío, no hace nada |
| 📍 **Dónde** | Se abre la ventana Ficha de Artista (artist_card) con el nombre pre-cargado |
| 💡 **Por qué** | Permite registrar manualmente un artista que no existe aún en la base de datos |

---

### 2. Panel Lateral — Filtros (`sidebar`)

#### Filtros de Género (`#genre-filters`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Lista dinámica de chips clicables, generada a partir del backend. El primero es siempre "Todos" |
| ⚡ **Qué** | Al clicar un género, filtra la galería mostrando solo artistas cuyo conjunto de géneros incluye el seleccionado. El chip activo se resalta en azul |
| ⏱️ **Cuándo** | Siempre disponible. Un artista puede pertenecer a múltiples géneros |
| 📍 **Dónde** | La galería y los contadores de estado se actualizan. El filtro de género activo es el que usa el menú contextual para "Asignar género principal" |
| 💡 **Por qué** | Permite hacer curación por género: revisar todas las fichas de Salsa antes de salir al aire |

Cada chip muestra: **[Nombre del género]** + **[contador de artistas]**

#### Filtros de Estado de Curación (`#status-filters`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Tres chips fijos: Todos / Completos / Pendientes |
| ⚡ **Qué** | Filtra por estado de curación. "Completos" = ficha con nombre, nacionalidad y género definidos. "Pendientes" = al menos un campo principal vacío |
| ⏱️ **Cuándo** | Combinable con el filtro de género simultáneamente |
| 📍 **Dónde** | El título de la sección cambia a "Cédulas Pendientes" cuando el filtro activo es "pendientes" |
| 💡 **Por qué** | El operador puede ver exactamente cuántas fichas faltan por completar antes del turno |

**Estados de cédula:**
| Indicador visual | Significado |
|---|---|
| Badge verde "OK" | Ficha curada: tiene nombre, nacionalidad y género |
| Badge naranja "!" | Ficha pendiente: le faltan datos |

#### Ajustes de Indexación (`#btn-init-curation`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Elemento de lista en la parte inferior del sidebar |
| ⚡ **Qué** | Muestra un `alert()` con instrucciones para inicializar la curación desde la carpeta raíz mediante el menú Herramientas |
| ⏱️ **Cuándo** | Siempre disponible (no está deshabilitado) |
| 📍 **Dónde** | No modifica nada; es solo informativo |
| 💡 **Por qué** | Guía al operador sobre cómo poblar la base de datos si el catálogo está vacío |

---

### 3. Galería Principal

#### Título de Sección + Contador de Selección (`#section-title`, `#selection-info`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Título h2 dinámico + texto de conteo |
| ⚡ **Qué** | El título muestra "Artistas Curados" o "Cédulas Pendientes" según el filtro de estado. El contador muestra "N seleccionado(s) de Total" |
| ⏱️ **Cuándo** | Se actualiza con cada acción de selección o cambio de filtro |
| 📍 **Dónde** | Encabezado de la galería |
| 💡 **Por qué** | El operador sabe cuántos artistas tiene bajo análisis de un vistazo |

#### Franja de Estado Masivo (`#bulk-status`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Texto azul en la esquina superior derecha de la galería |
| ⚡ **Qué** | Muestra el progreso del auto-completar ("N/Total: Nombre") y el resumen final |
| ⏱️ **Cuándo** | Solo visible durante y después del auto-completar. Vacío en reposo |
| 📍 **Dónde** | Área de estado, alineado a la derecha del título |
| 💡 **Por qué** | Retroalimentación visual sin interrumpir el flujo de trabajo |

#### Barra de Acciones Rápidas (`#quick-actions`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Franja oscura con título dinámico, hint de instrucciones y 3 botones |
| ⚡ **Qué** | Cambia de "Gestión rápida" a "N cédula(s) seleccionada(s)" cuando hay selección activa |
| ⏱️ **Cuándo** | Siempre visible |
| 📍 **Dónde** | Justo encima de la galería de tarjetas |
| 💡 **Por qué** | Centraliza las acciones masivas en un lugar visible sin usar el menú contextual |

**Botones de acción rápida:**

| Botón | ID | Condición de activación | Acción |
|---|---|---|---|
| Abrir seleccionado | `#btn-open-selected` | ≥ 1 seleccionado | Abre la ficha del primer artista seleccionado |
| Unificar | `#btn-merge-selected` | ≥ 2 seleccionados | Abre el modal de fusión de artistas |
| Limpiar selección | `#btn-clear-selection` | ≥ 1 seleccionado | Deselecciona todo |

#### Tarjeta de Artista (`.artist-card`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Elemento `article` generado dinámicamente por cada artista. Contiene foto, nombre, género, nacionalidad, conteo de canciones y badge de estado |
| ⚡ **Qué** | Múltiples interacciones (ver tabla de eventos) |
| ⏱️ **Cuándo** | Las primeras 72 tarjetas se renderizan al cargar; el resto se agregan con scroll infinito (chunks de 48) |
| 📍 **Dónde** | Dentro de `#artist-grid` |
| 💡 **Por qué** | Representación visual inmediata de cada artista; la foto ayuda al operador a identificarlos rápidamente |

**Eventos por tarjeta:**
| Interacción | Resultado |
|---|---|
| **Clic simple** | Selecciona el artista (deselecciona el anterior) |
| **Clic + Ctrl/Cmd** | Agrega/quita el artista de la selección múltiple |
| **Clic + Shift** | Selecciona rango desde el último seleccionado hasta aquí |
| **Doble clic** | Abre la Ficha de Artista directamente |
| **Clic en "Abrir cédula"** | Abre la Ficha de Artista (sin cambiar selección) |
| **Clic derecho** | Selecciona el artista (si no estaba en la selección) y abre el menú contextual |

**Elementos visuales de la tarjeta (modo grid):**
| Elemento | Descripción |
|---|---|
| `status-curated` (verde "OK") | Ficha completa; posición: esquina superior izquierda |
| `status-pending` (naranja "!") | Ficha incompleta; posición: esquina superior izquierda |
| `genre-pill` | Género principal en píldora, color del género; posición: esquina superior derecha |
| `card-photo img` | Foto del artista (si existe); de lo contrario, muestra el nombre como texto en fallback |
| `card-name` | Nombre del artista en blanco negrita, truncado con ellipsis |
| `card-meta` | Nacionalidad + conteo de canciones en texto gris |
| `card-open` button | Botón pequeño "Abrir cédula" |

**Tarjeta en modo lista (`.list-mode`):**
Organizada en 5 columnas: foto (72px) | nombre+meta | género pill | estado badge | botón abrir

#### Estado "Sin resultados" (`.empty`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Div con borde punteado |
| ⚡ **Qué** | Se muestra cuando los filtros activos o la búsqueda no tienen coincidencias |
| ⏱️ **Cuándo** | Reemplaza toda la galería |
| 📍 **Dónde** | Dentro del área de galería |
| 💡 **Por qué** | Indica claramente al operador que debe ajustar los filtros |

---

### 4. Menú Contextual (`#artist-context-menu`)

Se abre con clic derecho sobre cualquier tarjeta. Se cierra con cualquier clic fuera de él o `Escape`.

| Opción | ID | Condición | Acción |
|---|---|---|---|
| Abrir cédula | `#ctx-open` | Siempre disponible | Abre la Ficha del primer artista seleccionado |
| Unificar artistas | `#ctx-merge` | Activo si ≥ 2 seleccionados (opacidad 45% si no) | Abre el modal de fusión |
| Asignar "[género]" como género principal | `#ctx-set-main-genre` | Activo si hay un filtro de género específico activo | Asigna el género del filtro como género principal de todos los artistas seleccionados |
| ─ separador ─ | — | — | — |
| Eliminar cédulas | `#ctx-delete` | Siempre disponible (peligroso) | Elimina las fichas seleccionadas (no las canciones) tras confirmación |

---

### 5. Modal de Unificación de Artistas (`#merge-modal`)

Se abre desde "Unificar" (barra de acciones o menú contextual). Requiere ≥ 2 artistas seleccionados.

| Campo | ID | Descripción |
|---|---|---|
| Resumen informativo | `#merge-summary` | "Se unificarán N fichas. Revisa el nombre antes de confirmar." |
| Selector "Ficha principal" | `#merge-target` | Select con todos los artistas seleccionados. Cambia el nombre sugerido al elegir otro |
| Campo "Nombre a conservar" | `#merge-name` | Texto editable; por defecto, el nombre del primer artista seleccionado |
| Botón Cancelar | `#btn-cancel-merge` | Cierra el modal sin cambios |
| Botón Unificar | `#btn-confirm-merge` | Ejecuta la fusión vía IPC |

**Lógica de fusión:**
- El artista seleccionado como "principal" absorbe a los demás.
- Las canciones de los artistas fuente se reasignan al artista destino.
- Los artistas fuente son eliminados de la base de datos.
- Solo queda la selección del artista destino después de la operación.

---

## ⌨️ Atajos de Teclado

| Tecla | Condición | Acción |
|---|---|---|
| `Escape` | Modal abierto | Cierra el modal de fusión |
| `Escape` | Modal cerrado | Limpia el menú contextual + la selección |
| `Enter` | ≥ 1 seleccionado | Abre la ficha del primer artista seleccionado |
| `Delete` | ≥ 1 seleccionado | Inicia el proceso de eliminación (con confirmación) |
| `←` | Galería enfocada | Mueve la selección al artista anterior |
| `→` | Galería enfocada | Mueve la selección al artista siguiente |
| `↑` | Galería enfocada | Sube una fila en la cuadrícula |
| `↓` | Galería enfocada | Baja una fila en la cuadrícula |
| `Shift + ←/→/↑/↓` | Galería enfocada | Extiende la selección en esa dirección |

> Los atajos de navegación calculan la cantidad de columnas activas del CSS Grid para que `↑`/`↓` salten filas correctamente.

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo | Retorna |
|---|---|---|
| `artist-catalog-get-data` | Al cargar el módulo, al actualizar, al terminar cualquier operación masiva | `{ success, artists[], genres[], status: {all, curated, pending} }` |
| `artist-catalog-delete` | Tras confirmar la eliminación | `{ success, error? }` |
| `artist-catalog-merge` | Al confirmar el modal de fusión | `{ success, error? }` |
| `artist-catalog-set-main-genre` | Al confirmar "Asignar género principal" | `{ success, error? }` |
| `artist-catalog-autofill` | Al confirmar Auto-completar | `{ success, updated, withPhoto, failed, error? }` |

### Mensajes enviados al Backend (`ipcRenderer.send`)

| Canal | Cuándo | Datos |
|---|---|---|
| `open-artist-card-by-key` | Al abrir una ficha desde doble clic o botones | `{ artistKey, displayName }` |
| `open-artist-card-by-name` | Al crear un artista nuevo | `name` (string) |

### Mensajes recibidos (`ipcRenderer.on`)

| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `artist-catalog-updated` | Cuando otro módulo modifica el catálogo | Recarga el catálogo completo (`loadCatalog()`) |
| `artist-catalog-autofill-progress` | Durante el auto-completar masivo, por cada artista procesado | Actualiza `#bulk-status` con progreso "N/total: Nombre" |

---

## 🔧 Carga Virtual (Scroll Infinito)

El catálogo puede tener cientos de artistas. La renderización es virtualmente paginada:
- **Carga inicial**: 72 tarjetas al abrir o filtrar.
- **Carga por scroll**: Cuando el scroll llega a 700px del fondo, se agregan 48 tarjetas más.
- **Navegación por teclado**: Si el artista destino aún no está renderizado, se renderiza antes de seleccionarlo.

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| IPC actual | Equivalente en Tauri/Rust |
|---|---|
| `artist-catalog-get-data` (invoke) | Comando Tauri `get_artist_catalog` → query SQL en Rust al store de artistas |
| `artist-catalog-delete` (invoke) | Comando Tauri `delete_artist_cards` → DELETE en SQLite con cascada de reasignación |
| `artist-catalog-merge` (invoke) | Comando Tauri `merge_artist_cards` → transacción SQL que reasigna tracks y borra duplicados |
| `artist-catalog-set-main-genre` (invoke) | Comando Tauri `set_artist_main_genre` → UPDATE masivo en SQLite |
| `artist-catalog-autofill` (invoke) | Comando Tauri `autofill_artist_cards` → tarea async Rust que llama MusicBrainz/LastFM APIs |
| `open-artist-card-by-key` (send) | Evento de window manager Tauri para abrir `artist_card` window con payload |
| `open-artist-card-by-name` (send) | Ídem, busca o crea artista por nombre antes de abrir |
| `artist-catalog-updated` (on) | Evento Tauri `emit` desde el backend cuando cualquier operación sobre artistas termine |
| `artist-catalog-autofill-progress` (on) | Evento Tauri `emit` durante la tarea async de autofill (channel de progreso) |

---
*Documentado mediante auditoría automática — LF Automatizador v1.0*
