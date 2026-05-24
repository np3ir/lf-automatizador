# 08 — Gestor de Comerciales (Gestor de Pautas)
*Módulo: `frontend/commercial_manager.html` + `frontend/commercial_manager.js` | IPC: `backend/ipc/commercials.js`*

> **¿Qué es este módulo?**
> El Gestor de Comerciales es la herramienta central para administrar toda la pauta publicitaria de la emisora. Permite registrar spots y jingles en una biblioteca con metadatos de tráfico completos, organizar esos spots en pautas con horarios exactos de emisión, y visualizar en una grilla horaria de 24 horas cómo quedará distribuida la programación comercial. Opera de forma autónoma en su propia ventana y persiste toda la información en SQLite.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| **Título** | Gestor de Pautas |
| **Modo** | Ventana independiente (referenciada como `commercialManagerWindow` en el backend) |
| **Comportamiento especial** | Ocupa el 100 % del viewport (`height: 100vh`, `overflow: hidden`); no tiene barra de desplazamiento global, cada sección tiene su propio scroll interno |
| **Tecnología de datos** | Toda la persistencia se realiza en SQLite mediante IPC; no hay archivos de configuración separados |
| **Selección múltiple** | Soporta `Ctrl+Click` para seleccionar varios spots simultáneamente en la tabla de biblioteca |

---

## 🧩 Elementos de la Interfaz

### 1. Barra Superior (`topbar`)

#### Título (`div.title`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Etiqueta estática con el texto "Gestor de Pautas" |
| ⚡ **Qué** | Es solo visual; identifica la ventana |
| ⏱️ **Cuándo** | Siempre visible |
| 📍 **Dónde** | Esquina superior izquierda |
| 💡 **Por qué** | Distingue esta ventana de otras ventanas de la aplicación cuando hay varias abiertas |

---

#### Pestañas de navegación (`.nav-tab`)

| Pestaña | `data-view` | Vista que activa |
|---|---|---|
| Biblioteca | `library` | Vista de catálogo de spots con inspector |
| Editor de pautas | `scheduler` | Vista de creación y programación de bloques |
| Continuidad | `continuity` | Vista de grilla horaria semanal de revisión |

| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Tres botones de navegación en la parte superior central |
| ⚡ **Qué** | Al hacer clic cambia la vista activa; la pestaña seleccionada recibe clase `active` (fondo azul acento) |
| ⏱️ **Cuándo** | Disponibles en todo momento |
| 📍 **Dónde** | La vista anterior desaparece (`display: none`), la nueva aparece (`display: flex`) |
| 💡 **Por qué** | Divide el flujo de trabajo en tres fases: catalogar → programar → revisar continuidad |

---

#### Buscador global (`#global-search`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Campo de texto con placeholder "Buscar spot, cliente, campana o ruta..." |
| ⚡ **Qué** | Filtra la tabla de spots con un retardo de 180 ms (debounce) desde el último carácter escrito |
| ⏱️ **Cuándo** | Funciona en cualquier pestaña; la búsqueda se ejecuta en el backend contra los campos `title`, `file_path`, `client_name`, `campaign_name` y `contract_code` |
| 📍 **Dónde** | La tabla `#asset-body` y las listas de inventario lateral se recargan con los resultados filtrados |
| 💡 **Por qué** | En una biblioteca con cientos de spots, encontrar el comercial de un cliente específico de forma rápida es crítico durante emisión |

---

#### Botón Refrescar (`#btn-refresh`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón etiquetado "Refrescar" a la derecha del buscador |
| ⚡ **Qué** | Recarga tanto los assets (spots) como los bloques de pauta desde SQLite |
| ⏱️ **Cuándo** | Disponible siempre; útil si otro proceso externo modificó la base de datos |
| 📍 **Dónde** | Actualiza tabla de biblioteca, inventarios laterales y grillas horarias |
| 💡 **Por qué** | Sincroniza la vista si el operador añadió archivos manualmente o si el reproductor modificó registros en segundo plano |

---

### 2. Vista Biblioteca (`#view-library`)

Esta es la vista principal para gestionar el catálogo de spots. Se divide en tres columnas: panel izquierdo de carpetas, tabla central de spots, e inspector derecho.

---

#### 2.1 Panel Izquierdo — Carpetas Monitorizadas

##### Tarjeta "Comerciales"
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Tarjeta con nombre de la carpeta raíz comercial (`#commercials-root-path`) y dos botones: `#btn-set-commercials-root` (Elegir) y `#btn-scan-commercials` (Escanear) |
| ⚡ **Qué** | "Elegir" abre diálogo del sistema operativo para seleccionar carpeta; "Escanear" recorre recursivamente esa carpeta e importa todos los archivos de audio encontrados |
| ⏱️ **Cuándo** | "Elegir" requiere que el usuario confirme en el diálogo; "Escanear" requiere que la ruta esté ya configurada (si no lo está, el backend retorna error "Raiz no configurada") |
| 📍 **Dónde** | La ruta se guarda en tabla `commercial_settings` con clave `commercialsRoot`; los archivos escaneados aparecen en la tabla central |
| 💡 **Por qué** | La raíz maestra evita que el operador tenga que importar spot por spot; con un solo clic escanea toda la producción entregada por el departamento de tráfico |

##### Tarjeta "Jingles e IDs"
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Tarjeta con ruta en `#jingles-root-path` y botones `#btn-set-jingles-root` / `#btn-scan-jingles` |
| ⚡ **Qué** | Igual que la tarjeta de comerciales pero para el tipo `jingles`; al escanear, asigna automáticamente categoría `jingle` |
| ⏱️ **Cuándo** | Ídem tarjeta comerciales |
| 📍 **Dónde** | Ruta en `jinglesRoot` de `commercial_settings` |
| 💡 **Por qué** | Separa el catálogo de jingles e IDs de estación del catálogo comercial, permitiendo filtrarlos independientemente |

##### Selector "Categoría al importar" (`#import-category`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Desplegable poblado dinámicamente con las categorías de `commercial_categories` |
| ⚡ **Qué** | Determina la categoría que se asignará a los spots al escanear la carpeta de comerciales |
| ⏱️ **Cuándo** | Solo aplica en el escaneo de comerciales (no de jingles, que siempre usan `jingle`) |
| 📍 **Dónde** | La categoría queda grabada en el campo `category` de cada registro en `commercial_assets` |
| 💡 **Por qué** | Permite pre-clasificar toda una entrega de un cliente antes de importarla |

##### Botón Nueva Categoría (`#btn-new-category`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón "Nueva categoria" debajo del selector |
| ⚡ **Qué** | Muestra un `prompt()` del navegador pidiendo el nombre; si el usuario escribe algo, crea la categoría en SQLite y selecciona automáticamente la nueva categoría en `#import-category` |
| ⏱️ **Cuándo** | Siempre disponible; falla si el nombre está vacío; no permite renombrar categorías predeterminadas (marcadas como `is_builtin = 1`) |
| 📍 **Dónde** | Nueva fila en tabla `commercial_categories`; se refleja en todos los selectores de categoría |
| 💡 **Por qué** | El departamento de tráfico puede necesitar categorías personalizadas (ej: "Campaña Navidad 2026") |

---

#### 2.2 Zona Central — Tabla de Spots (`#asset-dropzone`)

##### Filtros de la barra de herramientas

| Filtro | ID | Opciones |
|---|---|---|
| Tipo de carpeta | `#filter-root` | Todo / Comerciales / Jingles |
| Categoría | `#filter-category` | Todas + categorías de la BD |
| Estado | `#filter-status` | Todos / Sin metadata / Vigentes / Próximos / Vencidos |

Cada cambio en cualquier filtro recarga automáticamente la tabla desde SQLite.

##### Botón "Etiquetar seleccionados" (`#btn-apply-category`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón en la barra de filtros de la tabla central |
| ⚡ **Qué** | Aplica la categoría seleccionada en `#import-category` a todos los spots que el usuario tenga seleccionados (`Ctrl+Click`) |
| ⏱️ **Cuándo** | Requiere que haya al menos un spot seleccionado en la tabla; si no hay selección, no hace nada |
| 📍 **Dónde** | Actualiza el campo `category` en `commercial_assets` para cada ruta seleccionada |
| 💡 **Por qué** | Permite reclasificar masivamente spots cuando llega una entrega mixta |

##### Tabla de spots (`#asset-body`)
| Columna | Descripción |
|---|---|
| ST | Punto de estado coloreado: verde (listo), amarillo (sin metadata), rojo (vencido) |
| Archivo | Nombre del archivo (tooltip muestra ruta completa) |
| Cliente / Marca | Nombre del cliente o campaña |
| Tipo | Badge coloreado con el tipo de elemento (COMERCIAL, PROMO, JINGLE, etc.) |
| Vigencia | Rango de fechas `válido desde – válido hasta` |
| Cues / dB | Duración en MM:SS o "Pendiente" si no tiene metadatos de audio |

**Colores de badges por tipo:**
| Tipo | Color | CSS |
|---|---|---|
| COMERCIAL / CORTESÍA | Verde | `.pag` → `--ok` |
| PROMO / TEMPORAL | Azul | `.pro` → `--accent` |
| SERV. PÚBLICO / GOBIERNO / SOCIAL | Rojo | `.gob` → `--bad` |
| ID EMISORA / JINGLE / PISADOR | Morado | `.id` → `--purple` |

**Comportamiento de clic y selección:**
- **Clic simple**: selecciona el spot, deselecciona los demás; carga el inspector derecho
- **Ctrl+Clic**: agrega o quita el spot de la selección múltiple sin desmarcar los demás
- **Drag (arrastrar)**: inicia transferencia de datos `application/json` con el array de spots seleccionados (o solo el spot si no hay multi-selección)

**Drop (soltar archivos externos):**
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Toda la zona central (`#asset-dropzone`) actúa como zona de drop de archivos del sistema operativo |
| ⚡ **Qué** | Al soltar archivos de audio desde el explorador de Windows, los importa a la biblioteca comercial |
| ⏱️ **Cuándo** | Acepta cualquier archivo; el backend filtra por extensiones de audio (mp3, wav, ogg, flac, m4a, aac) |
| 📍 **Dónde** | Los archivos importados aparecen en la tabla con estado "draft" |
| 💡 **Por qué** | Flujo rápido para el operador: arrastrar desde el explorador = disponible en pauta |

**Mensaje cuando la tabla está vacía (`#empty-assets`):**
> "Arrastra carpetas o escanea las raíces maestras para construir la biblioteca comercial."

---

#### 2.3 Panel Derecho — Inspector de Spot

El inspector se activa al seleccionar cualquier spot de la tabla. Su encabezado muestra `#asset-state-label` con "Listo" o "Falta info" según el estado del spot.

##### Mini-reproductor
| Elemento | ID | Función |
|---|---|---|
| Etiqueta de ruta | `#asset-file-label` | Muestra la ruta completa del archivo seleccionado |
| Forma de onda visual | `.wave` | Indicador decorativo de onda (no es waveform real); una línea roja fija simula el cursor de reproducción |
| Botón Play | `#btn-preview-asset` | **[Documentado en UI pero sin binding IPC en el código actual]** — botón para preescuchar el spot |
| Info de audio | `#asset-audio-info` | Muestra "Dur: MM:SS \| dB: --" con la duración del spot |

##### Formulario de metadatos del spot

| Campo | ID | Descripción |
|---|---|---|
| Tipo de elemento | `#type-buttons` | Cuadrícula de 11 botones tipo toggle (uno activo a la vez) |
| Cliente / Marca | `#asset-client` | Nombre del anunciante o cliente |
| Campaña / Pieza | `#asset-campaign` | Nombre de la campaña o pieza específica |
| Categoría / motivo | `#asset-category` | Desplegable dinámico que cambia según el tipo seleccionado |
| Condición de emisión | `#asset-billing` | Desplegable dinámico según el tipo (contrato, canje, cortesía, etc.) |
| Válido desde | `#asset-validity-start` | Fecha de inicio de vigencia (tipo `date`) |
| Válido hasta | `#asset-validity-end` | Fecha de fin de vigencia |
| Prioridad | `#asset-priority` | Alta estricta / Normal / Baja relleno |
| Límite diario | `#asset-daily-limit` | Número máximo de emisiones por día (0 = sin límite) |
| Cómo debe salir al aire | `#asset-traffic-notes` | Instrucciones de tráfico para el operador (textarea) |
| Notas internas | `#asset-notes` | Notas privadas (textarea) |

**Tipos de elemento disponibles (11 tipos):**
| Valor interno | Etiqueta UI | Grupo visual |
|---|---|---|
| `commercial` | COMERCIAL | Verde |
| `promo` | PROMO | Azul |
| `courtesy` | CORTESÍA | Verde |
| `public_service` | SERV. PÚBLICO | Rojo |
| `government` | GOBIERNO | Rojo |
| `social` | SOCIAL | Rojo |
| `station_id` | ID EMISORA | Morado |
| `jingle` | JINGLE | Morado |
| `sweeper` | PISADOR | Morado |
| `temporary` | TEMPORAL | Azul |
| `other` | OTRO | Sin color |

**Jerarquía dinámica de categorías y condiciones según tipo:**

El formulario adapta sus desplegables de "Categoría" y "Condición de emisión" automáticamente al cambiar el tipo. Las opciones son:

| Grupo | Tipos que lo usan | Categorías disponibles |
|---|---|---|
| `commercial` | COMERCIAL | Bebidas Gaseosas, Automotriz, Finanzas, Retail, Educación, Salud, Conciertos, Comida/Restaurantes, Inmobiliaria, Otra categoría comercial |
| `internal` | PROMO, ID EMISORA, JINGLE, PISADOR | Promoción Programa, Evento Emisora, Branding General, Identificación Legal |
| `courtesy` | CORTESÍA | Pedido Social, Cortesía Amigo, Mención Especial |
| `public` | SERV. PÚBLICO, GOBIERNO, SOCIAL | Gubernamental Legal, Campaña Cívica, Salud Pública, Nota Luctuosa |
| `temporary` | TEMPORAL, OTRO | Campaña Temporal, Prueba Técnica, Pieza Única, Otro Motivo |

##### Botones de acción del inspector

###### Botón Guardar en SQLite (`#btn-save-asset`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón verde "Guardar en SQLite" en el pie del panel derecho |
| ⚡ **Qué** | Lee todos los campos del formulario y los persiste en `commercial_assets`; actualiza el estado a `active` y `enabled = true` |
| ⏱️ **Cuándo** | Requiere que haya un spot seleccionado y que el archivo ya exista en la biblioteca (importado previamente); si no existe, muestra alert de error |
| 📍 **Dónde** | Actualiza la fila en `commercial_assets` y genera un log en `commercial_logs` con acción `metadata`; recarga la tabla inmediatamente |
| 💡 **Por qué** | El paso clave del flujo de tráfico: convierte un spot "Sin metadata" (draft) en un spot "Vigente" listo para rotar al aire |

###### Botón Desactivar (`#btn-disable-asset`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón rojo "Desactivar" en el pie del panel derecho |
| ⚡ **Qué** | Marca el spot como `enabled = false` y `status = 'draft'`; lo saca de la rotación sin eliminarlo de la biblioteca |
| ⏱️ **Cuándo** | Requiere spot seleccionado; la acción es inmediata (sin confirmación de diálogo) |
| 📍 **Dónde** | El punto de estado en la tabla pasa de verde a amarillo; el spot deja de aparecer en los inventarios del Scheduler y Continuidad |
| 💡 **Por qué** | Cuando un cliente cancela o vence un contrato, el operador saca el spot de rotación sin perder el historial |

---

### 3. Vista Editor de Pautas (`#view-scheduler`)

Esta vista permite crear y configurar bloques de pauta comercial (tandas) con sus spots y horarios de emisión.

---

#### 3.1 Panel Izquierdo — Librería de Recursos

##### Tarjeta de Alertas Inteligentes

| Tarjeta | ID | Color | Descripción |
|---|---|---|---|
| Spots por expirar | `#expiring-card` | Amarillo (`.warn`) | Muestra cuántos spots vencen en los próximos 7 días |
| Spots sin metadata | `#orphans-card` | Rojo (`.bad`) | Muestra cuántos spots importados aún no tienen ficha completa |

Ambas tarjetas son clickeables (tienen `cursor: pointer`) aunque en v1.0 no tienen acción asignada.

##### Inventario de spots listos (`#inventory-list`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Lista de hasta 120 tarjetas de spot (`spot-card`) coloreadas por tipo |
| ⚡ **Qué** | Cada tarjeta es arrastrable (drag) hacia la tabla de pauta o hacia celdas de la grilla horaria; al hacer clic en una tarjeta, navega a la vista Biblioteca y selecciona ese spot en el inspector |
| ⏱️ **Cuándo** | Solo muestra spots que cumplen `assetReady`: tienen nombre de cliente/campaña, no son `draft` y están habilitados |
| 📍 **Dónde** | Las tarjetas muestran: cliente/nombre, tipo (badge), categoría y duración MM:SS |
| 💡 **Por qué** | El operador ve de un vistazo qué spots están disponibles para armar una pauta sin tener que ir a la biblioteca |

**Cada spot-card muestra:**
- Borde izquierdo coloreado por tipo (verde/azul/rojo/morado)
- Nombre del cliente o campaña
- Badge del tipo
- Categoría de competencia
- Duración en MM:SS

---

#### 3.2 Sección Central — Modo Básico vs. Avanzado

##### Toggle Modo Básico / Avanzado (`#mode-toggle`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Interruptor tipo pill con etiquetas "Modo básico" y "Modo avanzado" |
| ⚡ **Qué** | Alterna entre la subvista de lista manual (`#sub-basic`) y la grilla horaria avanzada (`#sub-advanced`); también cambia el panel derecho entre `#editor-basic` y `#editor-advanced` |
| ⏱️ **Cuándo** | Disponible siempre; afecta el modo (`mode`) del bloque activo entre `'basic'` y `'advanced'` |
| 📍 **Dónde** | Las etiquetas "Modo básico"/"Modo avanzado" se iluminan según el estado |
| 💡 **Por qué** | Modo básico = el operador construye la pauta manualmente spot a spot. Modo avanzado = el sistema distribuye automáticamente los spots según reglas de vigencia, prioridad y separación de competencia |

##### Botón "Guardar pauta" (`#btn-save-block`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón verde en la barra de herramientas central |
| ⚡ **Qué** | Lee todos los campos del editor de pauta derecho y los persiste en `commercial_blocks` junto con sus items en `commercial_block_items` |
| ⏱️ **Cuándo** | Requiere que haya un bloque activo (`currentBlockId` definido); si no hay bloque, no hace nada |
| 📍 **Dónde** | Transacción SQLite: upsert en `commercial_blocks` + delete + re-insert de items en `commercial_block_items` |
| 💡 **Por qué** | Confirma la pauta para que el motor de reproducción la detecte en el momento programado |

---

#### 3.2.1 Subvista Modo Básico (`#sub-basic`)

##### Tabla de pauta manual (`#basic-body`)
| Columna | Descripción |
|---|---|
| Ord | Número de orden del bloque en la lista |
| Hora | Hora exacta de emisión programada (`HH:MM`) |
| Spot | Nombres de los spots contenidos en el bloque |
| Regla | "Cada N min" (repetición) o "Hora exacta" |
| Acción | Botón rojo "X" para eliminar el bloque |

**Clic en fila:** carga el bloque en el editor del panel derecho.
**Clic en botón X:** elimina el bloque de SQLite inmediatamente (sin confirmación) y actualiza la lista y la grilla de continuidad.

##### Botón "Nuevo evento limpio" (`#btn-new-basic-block`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón en la barra de herramientas de la subvista básica |
| ⚡ **Qué** | Crea un bloque nuevo en memoria con valores por defecto (`mode: 'basic'`, hora `10:00`, prioridad `normal`) y lo carga en el editor |
| ⏱️ **Cuándo** | Siempre disponible; el bloque no se persiste hasta hacer "Guardar pauta" |
| 📍 **Dónde** | Aparece en la tabla de pauta y el editor derecho se llena con sus datos |
| 💡 **Por qué** | Punto de partida para programar una nueva tanda comercial con hora y spots específicos |

##### Botón "Limpiar lista" (`#btn-clear-basic`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón rojo en la barra de herramientas básica |
| ⚡ **Qué** | Borra todos los items (`spots`) del bloque activo; el bloque en sí no se elimina, solo queda vacío |
| ⏱️ **Cuándo** | Solo afecta el bloque activo; no tiene confirmación de diálogo |
| 📍 **Dónde** | La tabla de pauta muestra "(Sin spots)"; la barra de progreso de la tanda va a 0 |
| 💡 **Por qué** | Permite rearmar completamente una pauta existente sin tener que eliminarla y recrearla |

##### Zona de drop de spots (`#basic-drop`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Área con texto "Suelta un spot aquí para agregarlo a la lista manual." |
| ⚡ **Qué** | Acepta arrastre de spot-cards o filas de la tabla; los agrega al bloque activo |
| ⏱️ **Cuándo** | Siempre activa; si no hay bloque activo, crea uno automáticamente |
| 📍 **Dónde** | Los spots aparecen en la tabla de pauta y en el editor de tanda del panel derecho |
| 💡 **Por qué** | Flujo de trabajo visual: el operador arrastra spots desde la librería lateral a la secuencia de la pauta |

---

#### 3.2.2 Subvista Modo Avanzado (`#sub-advanced`)

##### Selector de día (`#advanced-day`)
Desplegable con los 7 días de la semana (Lunes a Domingo, valores 1-6 y 0).

##### Grilla horaria avanzada (`#advanced-grid`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Cuadrícula de 24 filas × 4 columnas (horas × cuartos de hora: :00, :15, :30, :45) |
| ⚡ **Qué** | Cada celda (`slot-cell`) muestra las pautas programadas para ese slot horario; al hacer clic crea o selecciona el bloque de esa hora |
| ⏱️ **Cuándo** | Las celdas sin pauta muestran "(Sin programar)"; las celdas con pauta muestran mini-fichas (`micro`) con nombre y conteo/duración |
| 📍 **Dónde** | La celda seleccionada queda resaltada con borde azul; el editor derecho se actualiza |
| 💡 **Por qué** | Da una visión panorámica del día para identificar huecos o sobrecargas de pauta |

**Drop en celda de grilla:**
Si el operador suelta un spot sobre una celda de la grilla, se crea automáticamente un bloque para ese slot horario y el spot queda asignado.

##### Botón "Generar grilla SQLite" (`#btn-generate-grid`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón en la barra de herramientas de la subvista avanzada |
| ⚡ **Qué** | En v1.0 muestra un mensaje en la barra de estado: "Generador automático preparado; falta motor de reparto en el siguiente paso" |
| ⏱️ **Cuándo** | Siempre disponible |
| 📍 **Dónde** | Barra de estado inferior |
| 💡 **Por qué** | Función pendiente de implementación: debería distribuir automáticamente los spots por vigencia, prioridad y reglas de separación de competencia en toda la grilla del día |

---

#### 3.3 Panel Derecho — Inspector / Configuración de Pauta

##### Editor Básico (`#editor-basic`)
Visible en modo básico.

| Campo | ID | Descripción |
|---|---|---|
| Nombre de pauta | `#block-name` | Identificador descriptivo del bloque |
| Hora exacta | `#block-time` | Campo de tiempo `HH:MM:SS` para la emisión |
| Prioridad evento | `#block-priority` | Baja / Normal / Alta / Crítica |
| Comportamiento con música | `#block-execution` | Ver tabla siguiente |
| Repetición | `#repeat-active` | Sin repetición / Repetir |
| Cada (minutos) | `#repeat-interval` | Intervalo de repetición en minutos |
| Notas | `#block-notes` | Observaciones sobre esta pauta |

**Opciones de "Comportamiento con música" (`#block-execution`):**
| Valor | Etiqueta | Comportamiento |
|---|---|---|
| `wait` | Esperar canción actual | La pauta espera a que la canción en curso termine |
| `interrupt` | Cortar con prioridad | La pauta interrumpe la música inmediatamente al llegar la hora |
| `max-delay` | Retardo máximo | La pauta espera hasta un máximo configurable antes de forzar la interrupción |

##### Editor Avanzado (`#editor-advanced`)
Visible en modo avanzado. Muestra un aviso que explica el uso de SQLite para reparto automático, más dos campos adicionales:

| Campo | ID | Opciones |
|---|---|---|
| Frecuencia automática | `#asset-frequency` | Manual / 1 vez por hora / Repartido en el día / Solo mañana / Solo tarde / Solo noche |
| Separación obligatoria | `#asset-separation` | Separar misma categoría / Separar mismo cliente / Permitir junto a competencia |

---

### 4. Vista Continuidad (`#view-continuity`)

Vista de solo-lectura/edición de la pauta semanal ya programada, organizada por días y slots de cuarto de hora.

---

#### 4.1 Panel Izquierdo — Inventario SQLite (`#continuity-inventory`)

Muestra hasta 80 spot-cards de spots listos (arrastrable a la grilla), funcionando como fuente de recursos para ajustes finales de la pauta.

---

#### 4.2 Sección Central — Grilla de Continuidad

##### Pestañas de día (`#continuity-day-tabs`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Siete botones: Dom / Lun / Mar / Mié / Jue / Vie / Sáb |
| ⚡ **Qué** | Al hacer clic en un día, actualiza `currentSlot.day` y regenera la grilla para ese día |
| ⏱️ **Cuándo** | Las pestañas se crean solo una vez (la función `renderDayTabs` comprueba si ya existen); el día activo tiene clase `active` |
| 📍 **Dónde** | La grilla central `#continuity-grid` se regenera |
| 💡 **Por qué** | Permite al programador de tráfico revisar la distribución de pautas para cada día de la semana |

##### Etiqueta de slot seleccionado (`#selected-slot-label`)
Texto a la derecha de las pestañas que muestra "Bloque seleccionado: HH:MM" al hacer clic en una celda.

##### Grilla de continuidad (`#continuity-grid`)
Igual estructura que la grilla avanzada (24h × 4 cuartos), pero en modo edición de continuidad (no edición de configuración de bloque). Al hacer clic en una celda y al soltar spots, el comportamiento es el mismo que en la grilla avanzada.

---

#### 4.3 Panel Derecho — Editor de Tanda

##### Encabezado de tanda (`#tanda-title`)
Muestra nombre y hora del bloque seleccionado: `"Nombre de pauta - HH:MM"`.

##### Barra de progreso de duración
| Elemento | ID | Descripción |
|---|---|---|
| Barra visual | `#tanda-progress` | Porcentaje de ocupación respecto al límite de 3 minutos (180 s) |
| Texto | `#tanda-progress-text` | "Ocupado: MM:SS" y "Límite: 03:00" |

**Colores de la barra de progreso:**
| Estado | Umbral | Color |
|---|---|---|
| Normal | `< 85%` de 180 s | Verde (`--ok`) |
| Advertencia | `85% – 100%` | Amarillo (`--warn`) |
| Superado | `> 100%` | Rojo (`--bad`) |

##### Lista de items de la tanda (`#tanda-items`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Lista de tarjetas (`tanda-item`) con los spots del bloque activo; siempre encabezada por una tarjeta fija "Apertura de tanda / ID" de 5 segundos (no editable, es una regla global del sistema) |
| ⚡ **Qué** | Cada item muestra: nombre del spot, duración, y orden + estado ("Temporal") |
| ⏱️ **Cuándo** | Se actualiza al seleccionar un bloque en la grilla o en la tabla básica |
| 📍 **Dónde** | Visual únicamente; los cambios solo se persisten al guardar |
| 💡 **Por qué** | El operador puede revisar el orden y duración total de la tanda antes de confirmar |

##### Zona de drop en tanda
Área dashed con texto "+ Arrastra un spot aquí" al final de la lista. Acepta spot-cards arrastrados y los agrega al bloque activo.

##### Botones del editor de tanda

###### Botón "Guardar cambios" (`#btn-save-tanda`)
Idéntico en comportamiento a `#btn-save-block` — persiste el bloque activo en SQLite.

###### Botón "Vaciar bloque" (`#btn-empty-tanda`)
| Pregunta | Respuesta |
|---|---|
| 🧩 **Quién** | Botón rojo "Vaciar bloque" |
| ⚡ **Qué** | Borra todos los items del bloque activo en memoria y actualiza la barra de progreso y la grilla de continuidad |
| ⏱️ **Cuándo** | Solo en memoria; no persiste hasta guardar explícitamente |
| 📍 **Dónde** | La tanda queda solo con la tarjeta fija "Apertura de tanda / ID" |
| 💡 **Por qué** | Permite rearmar una tanda de continuidad sin tener que ir al editor de pautas |

---

#### 4.4 Monitor Flotante de Pauta (`.floating`)

Panel flotante en la esquina inferior derecha de la vista Continuidad. Visible solo cuando esta vista está activa.

| Elemento | ID | Descripción |
|---|---|---|
| Encabezado | `.float-head` | "Monitor de pauta" + indicador rojo "Al aire" |
| Tipo de reproducción | `#monitor-type` | Tipo del elemento en emisión (ej: "COMERCIAL") |
| Título actual | `#monitor-title` | Nombre del spot/pieza en reproducción |
| Barra de progreso | (sin ID específico) | Progreso de reproducción en azul |
| Siguiente | `#monitor-next` | "Siguiente: [nombre del próximo spot]" |
| Fin de tanda | `#monitor-end` | Hora estimada de fin de la tanda actual |

> **Nota de implementación v1.0:** El monitor flotante está definido en HTML con valores de ejemplo estáticos ("Esperando pauta", "Sin reproducción"). El binding con el reproductor en tiempo real **no está implementado** en el código de este módulo — está pensado para recibir eventos desde el motor de reproducción en una versión futura.

---

### 5. Barra de Estado Inferior (`footer`)

| Elemento | ID | Descripción |
|---|---|---|
| Estado textual | `#cm-status` | Mensajes de operación: "Listo", "Escaneo listo: N audio(s)", "Spot guardado en SQLite", etc. |
| Contador | `#cm-count` | "N elemento(s)" — total de spots en la consulta actual |

---

### 6. Atajos de Teclado

| Atajo | Vista activa | Acción |
|---|---|---|
| `Ctrl + S` | Biblioteca (`library`) | Guarda el spot seleccionado en SQLite (`saveAsset()`) |
| `Ctrl + S` | Editor de pautas o Continuidad | Guarda el bloque activo en SQLite (`saveBlock()`) |

---

## 📡 Mapa de Comunicación IPC

### Mensajes invocados (`ipcRenderer.invoke`)

| Canal | Cuándo se invoca | Retorna |
|---|---|---|
| `commercial-get-categories` | Al iniciar el módulo y al crear una nueva categoría | `Array<{id, name, color, isBuiltin, sortOrder}>` |
| `commercial-get-settings` | Al iniciar el módulo | `{commercialsRoot, jinglesRoot}` (objeto clave-valor de `commercial_settings`) |
| `commercial-get-assets` | Al iniciar, al cambiar filtros, al buscar, al guardar un spot | `Array<AssetDTO>` (máx. 3000 registros) |
| `commercial-get-blocks` | Al iniciar y al guardar/eliminar bloques | `Array<BlockDTO>` con items anidados |
| `commercial-set-root` | Al hacer clic en "Elegir" para carpeta de comerciales o jingles | `{success, path}` — abre diálogo de carpeta del SO |
| `commercial-scan-root` | Al hacer clic en "Escanear" | `{success, count}` — escanea la carpeta raíz con worker |
| `commercial-import-paths` | Al soltar archivos en la zona de drop | `{success, count}` — importa rutas específicas |
| `commercial-save-category` | Al crear nueva categoría vía `prompt()` | `{success, id}` |
| `commercial-update-assets-category` | Al hacer clic en "Etiquetar seleccionados" | `{success, count}` |
| `commercial-save-asset-metadata` | Al guardar un spot (botón guardar o Ctrl+S en biblioteca) | `{success}` |
| `commercial-save-asset-metadata` | Al desactivar un spot (botón Desactivar) | `{success}` — con `enabled: false, status: 'draft'` |
| `commercial-save-block` | Al guardar una pauta (Ctrl+S fuera de biblioteca, botón guardar pauta, botón guardar tanda) | `{success, id}` |
| `commercial-delete-block` | Al hacer clic en botón "X" de una fila en la tabla básica | `{success}` |

### Mensajes enviados al Backend (`ipcRenderer.send`)
Este módulo **no usa** `ipcRenderer.send` — toda comunicación es mediante `ipcRenderer.invoke` (bidireccional con respuesta).

### Mensajes recibidos (`ipcRenderer.on`)
Este módulo **no registra** listeners `ipcRenderer.on` en v1.0 — no recibe push del backend. El monitor flotante es estático.

---

## 🗄️ Modelo de Datos SQLite

### Tablas involucradas

| Tabla | Propósito |
|---|---|
| `commercial_assets` | Catálogo de todos los spots (uno por fila, PK = `file_path`) |
| `commercial_blocks` | Pautas/tandas programadas (PK = `id` tipo `com_TIMESTAMP_RANDOM`) |
| `commercial_block_items` | Spots individuales dentro de cada bloque (relación N:1 con blocks) |
| `commercial_categories` | Categorías de clasificación (algunas predeterminadas `is_builtin = 1`) |
| `commercial_settings` | Configuración clave-valor (rutas raíz, etc.) |
| `commercial_logs` | Historial de acciones por asset (importación, edición de metadatos) |

### Estados computados de un spot (`computedStatus`)

| Estado | Condición |
|---|---|
| `draft` | Sin metadata (`status = 'draft'`) o sin `enabled` |
| `paused` | `enabled = 0` |
| `expired` | `validity_end` en el pasado |
| `upcoming` | `validity_start` en el futuro |
| `active` | Ninguna de las anteriores |

### Compatibilidad con tipos legacy
El sistema convierte automáticamente tipos de nomenclatura antigua:
| Tipo antiguo | Tipo nuevo |
|---|---|
| `paid` | `commercial` |
| `station_promo` | `promo` |
| `unpaid` | `courtesy` |
| `psa` | `public_service` |
| `legal_id` | `station_id` |
| `sweep` | `sweeper` |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Canal IPC v1.0 | Equivalente en Tauri/Rust | Consideraciones |
|---|---|---|
| `commercial-get-categories` | Comando Tauri `get_commercial_categories` | Query directa a SQLite con `rusqlite`; retorna JSON |
| `commercial-get-settings` | Comando Tauri `get_commercial_settings` | Puede derivarse al sistema de configuración global de Tauri (`tauri-plugin-store`) |
| `commercial-get-assets` | Comando Tauri `get_commercial_assets` con struct de filtros | El filtrado de hasta 3000 registros debe hacerse en Rust con consulta parametrizada |
| `commercial-set-root` | Comando Tauri `set_commercial_root` + `tauri::api::dialog::pick_folder` | El diálogo nativo de carpeta es equivalente directo en Tauri |
| `commercial-scan-root` | Comando Tauri async `scan_commercial_root` | El worker de escaneo (`scanCommercialPathsInWorker`) debe reescribirse como tarea Tokio asíncrona en Rust; usar `walkdir` crate |
| `commercial-import-paths` | Comando Tauri async `import_commercial_paths` | Misma lógica: escaneo + insert transaccional en SQLite |
| `commercial-save-category` | Comando Tauri `save_commercial_category` | Lógica de slug (normalización de nombre) debe reescribirse en Rust |
| `commercial-update-assets-category` | Comando Tauri `update_assets_category` | Transacción simple con lista de rutas |
| `commercial-save-asset-metadata` | Comando Tauri `save_asset_metadata` con struct `CommercialAsset` | El UPDATE con 22 campos debe mapearse a un struct Rust tipado |
| `commercial-save-block` | Comando Tauri `save_commercial_block` | Transacción compleja: upsert de bloque + delete + re-insert de items |
| `commercial-delete-block` | Comando Tauri `delete_commercial_block` | Transacción: delete en dos tablas |
| `commercial-get-blocks` | Comando Tauri `get_commercial_blocks` | JOIN o dos queries: blocks + items; mapear a struct `CommercialBlock { items: Vec<BlockItem> }` |
| Monitor flotante (`.floating`) | Evento Tauri `emit("commercial-now-playing", ...)` | En v2.0, el motor de reproducción debe emitir eventos al frontend con el estado actual de la pauta; el frontend los escucha con `listen()` de Tauri |
| Drag & Drop de archivos externos | `tauri::api::drag_drop` o `webview_window.on_drag_drop_event` | El manejo de rutas de archivos soltados desde el explorador requiere el plugin `tauri-plugin-drag` en v2 |
| `commercial-get-asset-logs` | Comando Tauri `get_asset_logs` | Query simple con LIMIT 80; útil para un futuro panel de historial |

### Notas arquitectónicas clave para v2.0

1. **Tipos dinámicos de formulario**: La jerarquía `typeMap` + `trafficHierarchy` puede mantenerse como JSON estático en el frontend; Rust no necesita conocerla.
2. **Separación de competencia**: La lógica de `separationRule` y `frequencyRule` debe implementarse en el motor de programación Rust, no solo almacenarse.
3. **Monitor en tiempo real**: El elemento `.floating` exige un sistema de eventos push desde el motor de reproducción. En v2.0, usar el sistema de eventos de Tauri (`emit`/`listen`) en lugar de polling.
4. **Límite de 3 minutos por tanda**: El valor `limit = 180` está hardcodeado en el frontend. En v2.0 debería ser configurable desde `commercial_settings`.
5. **Generador automático de grilla**: El botón `#btn-generate-grid` no tiene implementación real en v1.0. En v2.0 este es el algoritmo central de distribución automática de pauta que debe escribirse en Rust.

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
