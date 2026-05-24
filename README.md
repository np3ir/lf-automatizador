# LF Automatizador v0.9.0

> "Un software diseñado por un operador de audio para operadores de audio"

> 📖 **¿No eres desarrollador?** Si estás aquí porque te interesa el proyecto y quieres conocer cómo y por qué nació este software, por favor tómate un momento para leer **[Mi Historia y la Filosofía detrás del Automatizador](#-la-historia-y-filosofía-detrás-de-lf-automatizador)**.

![Estado](https://img.shields.io/badge/Estado-Open_Source-green)
![Plataforma](https://img.shields.io/badge/Plataforma-Windows%20%7C%20Linux%20(Beta)-blue)

**LF Automatizador** es un software multiplataforma avanzado diseñado específicamente para **radio profesional** y **transmisión por Internet** (Web Radio / Streaming). Ofrece herramientas precisas de ruteo, programación de eventos, gestión de librerías y control de emisión de primer nivel.

> **Nota Técnica:** El motor de audio interno ha sido migrado exitosamente al lenguaje **Rust**, brindando un rendimiento nativo y calidad *broadcast* superior. La interfaz y control siguen operando en el entorno Node.js/Electron. La compatibilidad en Linux es un logro reciente y aunque funcional, puede presentar cierta inestabilidad (en fase Beta/Estabilización).

## 🎛️ Características Principales

- **Consola de Audio Virtual (El Corazón del Sistema):** Concebida y tratada como una mesa de mezclas física real. Aquí se le indica al programa qué hacer con el audio desde que nace y hacia dónde se tiene que enrutar (Aire/Master, Monitores, Preescucha), brindando flexibilidad absoluta.
- **Biblioteca de Música con SQLite:** Analizador de alta precisión para almacenar *Punto de Inicio, Fin, Punto de Mezcla (Mix)*, Metadatos, Volumen (Normalización) y BPM.
- **Gestión Avanzada de Catálogos:** Módulos de biblioteca independientes para canciones, *Artistas* y *Géneros Musicales*, lo que permite un control estricto sobre el ecosistema musical.
- **Tres Editores de Pistas de Nivel Profesional:**
  - *Editor de Audio Avanzado (1 Pista):* Marcación manual de *Intro, Outro, Inicio, Fin, Mix*, edición de metadatos y configuración de hasta 3 *pisadores* (incluyendo automatización de locución horaria).
  - *Editor de Dos Pistas:* Interfaz gráfica para ajustar y preescuchar *crossfades* manuales y elegantes.
  - *Editor de Tres Pistas:* Herramienta ideal para armar ensambles perfectos: "Fin de Canción A -> Identificador/Pisador -> Inicio de Canción B".
- **Programador de Eventos (Scheduler):** Con calendario visual integrado. Ideal para automatizar una estación terrestre o Web Radio operando las 24 horas del día.
- **Cartwall (Botonera de Efectos):** Matrices de acceso instantáneo con diferentes funciones configurables según las necesidades del operador en vivo.
- **Encoder Integrado:** Módulo para transmitir la señal directamente por Internet.

> ⚠️ **Nota de Desarrollo:** Muchas de estas funciones están operativas y listas para el uso diario. Sin embargo, algunas características complejas (como el *Programador de Pautas Comerciales*) tienen sólidos cimientos construidos y esperan el apoyo de la comunidad para ser culminadas.

---

## 🎯 Guía de Primer Uso: Configuración y Análisis

**¿Por qué es vital configurar y analizar la carpeta raíz al principio?**
Hacer este proceso en tu primer uso es la práctica más recomendada porque optimiza drásticamente el rendimiento del programa. 

Al hacer un análisis masivo previo, el automatizador calcula y guarda permanentemente los metadatos de cada canción (nivel de volumen, eliminación de silencios al inicio y al final, y los puntos de cruce o mix). Si no haces esto, el programa tendría que calcular estos datos "al vuelo" (en tiempo real) justo antes de reproducir cada canción, lo que consumiría muchos recursos del procesador (CPU), generando posibles retrasos (lag) y transiciones torpes. Al pre-analizar todo, el programa se vuelve mucho más ligero, rápido y garantiza una emisión ininterrumpida y profesional.

![Guía Rápida - Primer Uso](Documentaci%C3%B3n/guia_primer_uso.jpg?v=2)

### Paso a Paso: Cómo cargar y analizar tu biblioteca musical

**Paso 1: Abrir la Biblioteca de Música**
* Dirígete a la barra de menú principal en la parte superior.
* Haz clic en **Herramientas**.
* Selecciona **Biblioteca de Música** en el menú desplegable (también puedes usar el atajo de teclado `Ctrl+B`).

**Paso 2: Acceder a los Ajustes**
* Se abrirá una nueva ventana vacía correspondiente a la Biblioteca.
* Dirígete a la esquina superior derecha y haz clic en el ícono de engranaje (Ajustes), ubicado justo a la izquierda del botón verde.

**Paso 3: Definir la Carpeta Raíz**
* En la ventana emergente de Ajustes de Biblioteca, busca el apartado *"Carpeta raíz de música"*.
* Haz clic en el botón **Examinar...** y navega por tus carpetas para seleccionar el directorio principal donde guardas todos tus archivos de audio.
* Asegúrate de tener marcada la casilla *"Cargar la carpeta raíz al abrir la biblioteca"* para que tu música siempre esté disponible, y luego haz clic en **Guardar**.

**Paso 4: Ingresar al Centro de Procesamiento**
* De vuelta en la pantalla de la Biblioteca de Música (ahora con la ruta de tus archivos reconocida), ve nuevamente a la esquina superior derecha.
* Haz clic en el botón verde que dice **► Centro de Procesamiento**.

**Paso 5: Iniciar el Análisis Masivo**
* Se abrirá la ventana del Centro de Procesamiento Masivo.
* Verifica que estén marcadas las opciones esenciales de análisis (como *Analizar Volumen Promedio* y *Detectar Inicio, Fin y Punto Mix*).
* En la sección de *Comportamiento con pistas existentes*, es recomendable dejar marcado *"Omitir archivos que ya tienen datos"* para que futuros escaneos sean más rápidos.
* Por último, haz clic en el botón verde **► Iniciar Proceso** en la esquina inferior derecha.

El sistema comenzará a escanear y guardar los parámetros de cada canción de tu carpeta raíz. Una vez termine, tu LF Automatizador estará completamente optimizado y listo para salir al aire con la máxima fluidez.

---

## 🏗️ Arquitectura Actual

El sistema utiliza una arquitectura distribuida y asíncrona dentro del ecosistema de **Node.js** y **Electron**, diseñada para garantizar **latencia cero** en el motor de audio y cero congelamientos en la UI.

1. **Frontend (Capa de Presentación):**
   - Construido en HTML5, CSS3 y **JavaScript (Vanilla)** para máxima velocidad de respuesta sin overhead de frameworks pesados.
   - **Frontend Pasivo (Control Remoto):** Electron NO procesa audio. Toda la antigua infraestructura de *Web Audio API* está siendo desconectada por completo para evitar *cuelgues*. El frontend funciona como un humilde control remoto que se limita a enviar comandos al motor Rust y dibujar sus respuestas.
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

Para inicializar la estación de trabajo y ejecutar el automatizador, ahora contamos con instaladores totalmente automatizados que se encargan de compilar módulos nativos (SQLite) y el motor de audio en Rust de forma transparente.

1. **Clonar el Repositorio (Línea de Comandos):**
   Abre tu terminal y descarga el código del proyecto ejecutando:
   ```bash
   git clone https://github.com/yosoyluisfernando/lf-automatizador.git
   cd lf-automatizador
   ```

2. **Requisitos Previos:**
   - [Node.js](https://nodejs.org/) (v18 LTS o superior).
   - Rust y Cargo (se recomienda descargar la última versión).
   - En Windows: Visual Studio Build Tools y Python.
   - En Linux: `build-essential` y `ffmpeg` del sistema.

2. **Instalación y Ejecución en Windows 🪟:**
   - Ejecuta el archivo `Instalar_Dependencias.bat` con doble clic para preparar el entorno.
   - Para iniciar el programa, simplemente ejecuta `Iniciar_Automatizador.bat`.

3. **Instalación y Ejecución en Linux 🐧:**
   - Abre la terminal en la carpeta del proyecto y dota de permisos a los scripts (si es necesario):
     ```bash
     chmod +x *.sh
     ./instalar_dependencias.sh
     ```
   - Para iniciar el programa, ejecuta:
     ```bash
     ./iniciar.sh
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

## 📖 La Historia y Filosofía detrás de LF Automatizador

**LF Automatizador** no es solo un proyecto de software; es el resultado de la pasión, la resiliencia y el amor por la radio. 

Mi nombre es Luis Fernando Velázquez. Fui operador de audio durante 11 años en una emisora comunitaria en Venezuela, mi tierra natal, la cual tuve que dejar para emigrar a Perú. Desde muy niño perdí mi ojo derecho a causa de un glaucoma congénito, y en los últimos años la visión de mi ojo izquierdo ha decaído significativamente. 

Comencé este proyecto sin saber escribir una sola línea de código. Apoyándome en herramientas de Inteligencia Artificial (Gemini, Claude, Cursor, entre otras), la lupa de Windows y lectores de pantalla, trabajé desde una computadora antigua, sacrificando horas de sueño y mi propia salud visual. Tras meses de ensayo y error, logramos construir una arquitectura robusta de más de 10,000 líneas de código, logrando el inmenso hito de migrar el corazón del sistema a un motor nativo en Rust.

### ¿Por qué Código Abierto?

> *"Linux necesita más software de calidad profesional hecho por operadores para operadores."*

He decidido hacer **LF Automatizador** 100% de código abierto porque sé que mi salud visual no me permitirá mantenerlo solo a largo plazo. Si conservo el control total, mi pasión me impedirá detenerme, y eso perjudicará mi visión aún más. Planto esta semilla en el mundo del Open Source con la esperanza de que desarrolladores y programadores apasionados la rieguen, mejoren el código (especialmente el renderizador principal) y hagan de este software el corazón de muchas emisoras comunitarias y comerciales en el futuro. 

Todo desarrollo nuevo bajo este proyecto deberá mantenerse libre y de código abierto.

*(Próximamente publicaré un video en mi canal de YouTube personal contando esta historia y mostrando el proyecto en acción).*

---

## 🤝 Contribuciones y Documentación

Este software necesita de la comunidad. Si eres programador y quieres ayudar a estabilizar el proyecto, eres más que bienvenido. 

> 💡 **Nota de Humildad:** Construir este proyecto sin saber programar tuvo una consecuencia clara: tener un archivo de renderizado gigantesco de casi 10,000 líneas de código. Soy consciente de que esto no es una victoria, sino un problema técnico. Necesito de su ayuda para reducir este archivo masivo, limpiar los "códigos fantasma" y el código muerto heredado de la antigua *Web Audio API* que aún vive allí.

Para entender la complejidad y hacia dónde va el proyecto, por favor revisa los siguientes archivos antes de modificar el código:
- [`POR_HACER.md`](POR_HACER.md): Contiene todas las ideas, tareas pendientes y el rumbo que deseo para el software.
- [`entendiendo la consola virtual.md`](entendiendo%20la%20consola%20virtual.md): Explica la compleja programación del corazón del software y cómo se distribuye el audio a sus respectivos destinos.

---

## 💬 Comunidad y Contacto

¡Únete a la familia de LF Automatizador! He creado estos espacios para que podamos conversar, reportar errores, discutir nuevas ideas y organizar el futuro desarrollo del proyecto (¡y pronto tendremos un logo oficial!):

- 📢 **Canal de Telegram (Noticias y Anuncios):** [Suscríbete al Canal](https://t.me/+XKof2wDvGVw1YTRh)
- 👥 **Grupo de Telegram (Charla y Desarrollo):** [Únete al Grupo de la Comunidad](https://t.me/+bXppwWvJvSg5YjNh)

---

## 💖 Apoyo y Donaciones

Si este software es útil para tu emisora, o si valoras el esfuerzo monumental que costó crearlo, te invito a apoyarme. Las donaciones están destinadas exclusivamente a ayudarme a costear mis consultas médicas y los tratamientos para mi vista, los cuales no he podido mantener de forma regular desde que emigré. 

💙 **[Haz clic aquí para apoyarme a través de PayPal](https://www.paypal.com/paypalme/yosoyluisfernando)**

---

## ✒️ Licencia y Autoría

💻 **Desarrollado y Arquitecturado originalmente por Luis Fernando Velázquez.**  

⚖️ **Modelo de Licencia y Distribución (Open Source):**
El código fuente de **LF Automatizador** siempre será libre y de código abierto (bajo un espíritu similar a la licencia GPLv3), garantizando que su evolución pertenezca a la comunidad y que todo trabajo derivado se mantenga gratuito y abierto, aportando especialmente al ecosistema **Linux**. 

Para el entorno **Windows**, si la comunidad así lo decide y respalda, se podría establecer en el futuro un modelo de distribución de los binarios precompilados (el instalador .exe listo para usar) mediante un costo netamente simbólico o una donación sugerida ("paga lo que quieras"). El objetivo de esto no es un lucro desmedido, sino:
1. Desmotivar el modelo de piratería y *cracking*, al hacer que el software oficial sea accesible para cualquier persona a un precio casi simbólico.
2. Generar un fondo de donaciones legítimo y transparente que me permita costear y continuar los tratamientos médicos para mi salud visual.

---
*📻 Diseñado con arquitectura de misión crítica. La cabina nunca se detiene.*
