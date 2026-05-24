# 📻 LF Automatizador v1.0 — Documentación Técnica y Funcional

> **Propósito de este documento:** Este libro es la "biblia" de comportamiento del software LF Automatizador v1.0.
> Su objetivo NO es explicar cómo está escrito el código, sino **qué hace el programa, por qué lo hace y cuándo lo hace**.
> Sirve como guía maestra para la reconstrucción de la versión 2.0 en Tauri + Rust.

---

## 📖 Cómo leer este libro

Cada capítulo documenta un módulo (ventana o componente) del programa usando la **Plantilla Periodística**:

| Símbolo | Pregunta | Significado |
|---|---|---|
| 🧩 **Quién** | ¿Cuál es el elemento? | El nombre exacto del botón, atajo, campo, etc. |
| ⚡ **Qué** | ¿Qué hace? | La acción inmediata que desencadena |
| ⏱️ **Cuándo** | ¿Bajo qué condiciones? | Los estados o prerequisitos necesarios para que funcione |
| 📍 **Dónde** | ¿Dónde se ve el efecto? | Qué cambia en la interfaz o en el sistema |
| 💡 **Por qué** | ¿Para qué existe? | El propósito de negocio — por qué el operador lo necesita |

---

## 🗂️ Tabla de Contenidos

### 🔧 Parte 0 — Fundamentos
- [Glosario de Términos](./GLOSARIO.md) — Vocabulario técnico y de radio
- [Arquitectura General](./00_arquitectura_general.md) — Cómo se conectan todos los módulos
- [Puentes IPC → Comandos Tauri](./00_mapa_ipc.md) — Mapa de comunicación frontend ↔ backend
- [Guía de Íconos Multiplataforma](./00_guia_iconos_multiplataforma.md) — Emojis vs. SVG, solución para Windows/Linux

---

### 🎛️ Parte 1 — Módulos de Reproducción (Núcleo)
- [01 — Consola Principal](./01_consola_principal.md) *(render.js + index.html — 562 KB)*
- [02 — Consola de Audio](./02_consola_audio.md) *(consola.js + consola.html)*
- [03 — Motor de Audio](./03_motor_audio.md) *(audio_engine_process.js)*

---

### 🎵 Parte 2 — Gestión de Contenido
- [04 — Librería Musical](./04_libreria_musical.md) *(libreria.js + libreria.html)*
- [05 — Editor de Audio](./05_editor_audio.md) *(audio_editor.js + audio_editor.html)*
- [06 — CartWall de Jingles](./06_cartwall.md) *(cartwall.js + cartwall.html)*
- [07 — Vista Previa de Audio](./07_preview.md) *(preview.js + preview.html)*

---

### 📢 Parte 3 — Comerciales y Eventos
- [08 — Gestor de Comerciales](./08_gestor_comerciales.md) *(commercial_manager.js)*
- [09 — Calendario de Eventos](./09_calendario.md) *(calendar.js + calendar.html)*
- [10 — Editor de Eventos](./10_editor_eventos.md) *(event_editor.js + event_editor.html)*
- [11 — Grupos de Eventos](./11_grupos_eventos.md) *(event_groups.js + event_groups.html)*

---

### 🎚️ Parte 4 — Editores y Configuración
- [12 — Editor de Jingles](./12_editor_jingles.md) *(jingle_editor.js + jingle_editor.html)*
- [13 — Editor de Transiciones](./13_editor_transiciones.md) *(transition_editor.js)*
- [14 — Editor de Géneros](./14_editor_generos.md) *(genre_editor.js + genre_editor.html)*
- [15 — Catálogo de Artistas](./15_catalogo_artistas.md) *(artist_catalog.js + artist_catalog.html)*
- [16 — Ficha de Artista](./16_ficha_artista.md) *(artist_card.js + artist_card.html)*
- [17 — Configuración General](./17_configuracion.md) *(settings.js + settings.html)*

---

### 📡 Parte 5 — Transmisión y Reportes
- [18 — Encoder / Stream](./18_encoder.md) *(encoder.js + encoder.html)*
- [19 — Reportes](./19_reportes.md) *(reportes.js + reportes.html)*
- [20 — Gestor de Tareas](./20_gestor_tareas.md) *(task_manager.js)*

---

### 🏗️ Parte 6 — Backend y Workers
- [21 — Base de Datos](./21_base_datos.md) *(database.js)*
- [22 — Workers de Procesamiento](./22_workers.md) *(library_worker, audio_analysis_worker, etc.)*
- [23 — Servicios de Artistas y Géneros](./23_servicios.md) *(backend/services/)*

---

## 📊 Estado de Documentación

| Módulo | Estado | Última actualización |
|---|---|---|
| Glosario | ✅ Listo | Fase 1 |
| Arquitectura General | ✅ Listo | Fase 5 |
| Consola Principal | ✅ Listo | Fase 1 |
| Todos los demás (20 módulos) | ✅ Listo | Fases 2, 3 y 4 |

---

*Generado automáticamente por auditoría de código — LF Automatizador v1.0*
*Destino: base de diseño para LF Automatizador v2.0 (Tauri + Rust)*
