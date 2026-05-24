# 21 — Base de Datos (SQLite)
*Módulo: `database.js` (692 líneas) | Motor: `better-sqlite3`*

> **¿Qué es este módulo?**
> Es el módulo central de persistencia del automatizador. Inicializa y configura la base de datos SQLite (en `config/lf_data.sqlite`), define todos los esquemas (tablas y columnas), y ejecuta las migraciones necesarias (por ejemplo, desde los antiguos archivos JSON).
> Todo el backend y frontend interactúan con esta base de datos a través de los canales de IPC.

---

## 🗄️ Archivos y Entorno

| Propiedad | Detalle |
|---|---|
| **Archivo de Base de Datos** | `config/lf_data.sqlite` (o `lf_data.beta.sqlite` si el canal de la app es "beta") |
| **Librería** | `better-sqlite3` (síncrona, de altísimo rendimiento en Node.js) |
| **Optimizaciones** | WAL mode (`journal_mode = WAL`), caché de 32MB en RAM, tablas temporales en RAM, Memory-Mapped I/O (300MB) |
| **Mantenimiento** | Hace `wal_checkpoint(TRUNCATE)` automático cada 30 minutos |
| **Canal de App** | Lee `config/app_channel.json` para saber si está en versión `stable` o `beta` |

---

## 📊 Tablas de la Base de Datos

La base de datos contiene múltiples dominios de información (librería musical, eventos, comerciales, artistas, etc.).

### 1. Dominio: Librería Musical y Pistas
| Tabla | Descripción principal |
|---|---|
| `tracks` | **La tabla más grande**. Almacena los metadatos de cada canción de la biblioteca. PK es `file_path`. Tiene campos para metadata básica (título, artista), análisis de audio (inicio, fin, mix, intro, outro, db, bpm), datos extendidos (feat, remix), json incrustados, y configuración de pisadores (p1, p2, p3, phora). |
| `library_virtual_folders` | Carpetas virtuales para la visualización del árbol de la biblioteca (si está estructurada internamente). |

### 2. Dominio: Eventos y Parrilla Semanal
| Tabla | Descripción principal |
|---|---|
| `events` | Eventos automáticos programados. Define qué suena (`file_path`, `source_type`), a qué hora (`primary_time`, `other_hours`), días de repetición, prioridad, y comportamiento (esperar o interrumpir). |
| `event_groups` | Agrupaciones de eventos (carpetas/categorías para organizarlos) con colores asignados. |
| `schedule_programs` | Los bloques de la parrilla editorial (ej. "El Mañanero", locutor, estilo, hora inicio y fin, días). |

### 3. Dominio: Gestor de Comerciales (Tandas y Spots)
| Tabla | Descripción principal |
|---|---|
| `commercial_assets` | Todos los audios (spots, jingles, cuñas) disponibles. PK es `file_path`. Tiene metadatos complejos de facturación/emisión: tipo, cliente, campaña, validez (fecha inicio/fin), límites diarios y reglas de separación. |
| `commercial_blocks` | Las "tandas" o "cortes comerciales" (cuándo suenan). |
| `commercial_block_items` | Relación de qué audios (`commercial_assets`) van dentro de qué tanda (`commercial_blocks`), y en qué orden (`sort_order`). |
| `commercial_categories` | Categorías de pago (Publicidad pagada, cortesía, promoción, servicio público, etc.). |
| `commercial_logs` | Historial de emisión (cuándo sonó exactamente cada cuña, para reportes). |
| `commercial_settings` | Preferencias clave/valor exclusivas del gestor de comerciales. |

### 4. Dominio: Artistas, Géneros y Taxonomía
| Tabla | Descripción principal |
|---|---|
| `artist_profiles` | Cédula maestra de cada artista (biografía, país, imagen, género habitual). PK es `artist_key` (nombre normalizado). |
| `artist_aliases` | Nombres alternativos de un artista que apuntan a una misma cédula maestra. |
| `genre_profiles` | Perfil de cada género musical (nombre, si es activo, energía, padre, tipo). |
| `genre_aliases` | Nombres alternativos para un género. |
| `track_artist_links` | Relación muchos-a-muchos: Qué pista tiene a qué artistas y con qué rol (Principal, Feat, Remix). |
| `track_genre_links` | Relación muchos-a-muchos: Qué pista pertenece a qué género y con qué nivel de confianza. |
| `relacion_generos` | Jerarquía (qué género es padre de cuál otro). |
| `country_profiles` | Diccionario de países con sus alias (ej: RD, Dominicana -> República Dominicana). |

### 5. Dominio: Sistema
| Tabla | Descripción principal |
|---|---|
| `app_settings` | Preferencias generales clave/valor (ej. banderas de migración). |

---

## 🛠️ Índices (Performance)

Se crearon índices clave para acelerar búsquedas en una biblioteca de decenas de miles de canciones:
- `commercial_blocks(primary_time)`
- `commercial_items_block(block_id, sort_order)`
- `commercial_assets(category)` y `(root_type, folder_path)` y `(validity_start, validity_end)`
- `commercial_logs(asset_path, at)`
- `schedule_programs(start_time)`
- `artist_profiles(country_code)` y `(main_genre_key)`
- `track_artist_links(artist_key)`
- `track_genre_links(genre_key)`
- `tracks(subgenres_csv)`

---

## 🔄 Migración de Rescate Automática

Si la tabla `tracks` está vacía al iniciar, el sistema intenta recuperar los datos de la versión `0.x` que estaban guardados en archivos JSON planos:
1. `track_cache.json` y `manual_cues.json` → Se importan a `tracks`.
2. `event_groups.json` → Se importa a `event_groups`.
3. `events_db.json` → Se importa a `events`.

También ejecuta un *Seed* automático para inyectar:
- Categorías comerciales por defecto (`paid`, `unpaid`, `station_promo`, etc.)
- Lista de países de Latinoamérica y el mundo con sus alias (`DO` -> `República Dominicana` / `RD`).

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento | Cómo migrar a Tauri |
|---|---|
| Librería | Cambiar de `better-sqlite3` (Node) a **`rusqlite`** (Rust). |
| Inicialización | Crear un módulo `src/db/schema.rs` que ejecute estos mismos `CREATE TABLE`. |
| Conexión | Mantener la DB en un `Mutex<rusqlite::Connection>` o usar un pool como `r2d2` en el State de Tauri para acceso concurrente. |
| Migración inicial | La lógica de rescate desde JSON (`migrateDataFromJSON`) ya no será tan necesaria si la DB SQLite ya existe de la v1.0, pero se puede mantener como fallback en Rust leyendo con `serde_json`. |
| Mantenimiento WAL | En Rust, se puede iniciar un hilo (`std::thread::spawn`) o un task de Tokio que haga un checkpoint periódicamente. |

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
*Referencia para LF Automatizador v2.0 (Tauri + Rust)*
