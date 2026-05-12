# LF Automatizador v1.0

![Estado](https://img.shields.io/badge/Estado-Optimizaci%C3%B3n_Activa-green)
![Plataforma](https://img.shields.io/badge/Plataforma-Windows%20%7C%20Linux-blue)

**LF Automatizador** es un software avanzado de automatización de radio, creado por y para operadores de radio. Ofrece herramientas de ruteo de audio, programación de eventos, gestión de librerías y control de emisión de primer nivel.

---

## 🏗️ Arquitectura Actual

El sistema utiliza una arquitectura distribuida y asíncrona dentro del ecosistema de **Node.js** y **Electron**, diseñada para garantizar **latencia cero** en el motor de audio y cero congelamientos en la UI.

1. **Frontend (Capa de Presentación):**
   - Construido en HTML5, CSS3 y **JavaScript (Vanilla)** para máxima velocidad de respuesta sin overhead de frameworks pesados.
   - **Web Audio API**: Se encarga del ruteo complejo, compresión, limitadores y "ducking" (atenuación) en tiempo real.
   - Listas grandes (como la librería de música) se renderizan usando técnicas de *Virtual Scroll* para evitar colapsar el DOM.

2. **Backend (Capa de Negocio y Control):**
   - El archivo `main.js` coordina el ciclo de vida, ventanas y el flujo de IPC (Inter-Process Communication).
   - **Web Workers**: Todo proceso pesado se delega a hilos paralelos para no bloquear el motor de audio de la interfaz:
     - `library_worker.js`: Escaneo veloz de la música.
     - `audio_analysis_worker.js`: FFmpeg para procesar picos y mezclas automáticas de audio.
     - `metadata_worker.js` y `meta_net_worker.js`: Lectura de tags ID3 y comunicación con APIs externas.

3. **Almacenamiento e I/O (Base de Datos):**
   - **SQLite (`better-sqlite3`)** actúa como el motor relacional ultrarrápido y sincrónico.
   - Configurado con modo `WAL` (Write-Ahead Logging), memoria compartida mapeada (`mmap`), tablas temporales en RAM y cachés agresivas para accesos en milisegundos.

---

## 📦 Dependencias Reales

Tras una estricta auditoría de seguridad y limpieza, el ecosistema utiliza exclusivamente las siguientes dependencias vitales:

- **`better-sqlite3`**: Driver nativo ultrarrápido de base de datos.
- **`ffmpeg-static`**: Análisis sónico, escaneo de pistas y extracciones.
- **`fuse.js`**: Búsquedas aproximadas y ultrarrápidas ("fuzzy search") en el catálogo musical.
- **`node-id3`**: Lectura y escritura de metadatos (etiquetas de audio).
- *Entorno:* `electron` y `@electron/rebuild`.

*(Librerías obsoletas como Babel han sido eliminadas para reducir vulnerabilidades y el peso del proyecto).*

---

## 🚀 Despliegue y Ejecución

Para inicializar la estación de trabajo y ejecutar el automatizador:

1. **Requisitos Previos:**
   - [Node.js](https://nodejs.org/) (v18 LTS o superior).
   - Python y Visual Studio Build Tools (Windows) / `build-essential` (Linux) para compilar SQLite.

2. **Instalación:**
   ```bash
   # Instalar las dependencias estrictamente necesarias
   npm install
   
   # Recompilar módulos nativos (SQLite) con los headers de Electron
   npx electron-rebuild
   ```

3. **Ejecución:**
   ```bash
   npm start
   ```

---

## ⚡ Historial de Optimizaciones Técnicas (Performance Audit)

Durante la última auditoría integral, se implementaron mejoras críticas para la transmisión 24/7:

1. **Limpieza de Código y Estructura:**
   - Eliminación masiva de código huérfano, archivos `.tmp`, `.bat` obsoletos, y volcados `.js` duplicados ("renderer - copia.js", "main - copia.js", scripts temporales y logs de desarrollo).
2. **Gestión Extremada de RAM (Librería Musical):**
   - Refactorización del escaneo masivo en el `library_worker.js`. En lugar de almacenar toda la tabla `tracks` en arreglos de JavaScript (volcado masivo vía `.all()`), se migró a iteradores directos (`.iterate()`). Esto minimiza drásticamente el consumo de RAM (Out-of-Memory) en catálogos de más de 50,000 pistas.
3. **I/O y Base de Datos Instantánea:**
   - Se activó el `mmap_size` (Memory-Mapped I/O) a 300MB en SQLite para que las lecturas a los discos se realicen directamente desde RAM física acelerada.
   - Se cuadruplicó el caché de la DB a `32MB` para búsquedas en caliente y se forzó `temp_store = MEMORY`.
4. **Respuesta de UI y Motor de Audio (Latencia):**
   - Los medidores VU y refrescos visuales están limitados a 12.5 FPS (~80ms), priorizando que todos los recursos de la CPU alimenten la Web Audio API y garanticen **cero latencia** de cruces de audio.
   - Refactorización de las dependencias, erradicando Babel y módulos externos que ya no cumplían funciones esenciales en el *bundle*.

---
*Diseñado con arquitectura de misión crítica. La cabina nunca se detiene.*
