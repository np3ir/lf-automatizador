# LF Automatizador v1.0 — Instrucciones para Claude Code

## Directorio real del proyecto

El proyecto corre desde: `C:\LF Automatizador v1.0\`

**NUNCA trabajes en un worktree.** Si al iniciar la sesión tu directorio activo contiene `.claude\worktrees\`, detente y avisá al usuario antes de hacer cualquier cambio. Todos los archivos deben leerse y editarse desde la raíz real del proyecto.

## Cómo verificar que estás en el lugar correcto

Antes de editar cualquier archivo, confirmá que el path comienza con `C:\LF Automatizador v1.0\` y NO contiene `.claude\worktrees\`.

## Arquitectura de audio — estado actual de la migración

Este proyecto está migrando de Web Audio API a un motor nativo en Rust (`audio-engine-rust/`). El motor Rust es 100% funcional en producción.

### Regla principal de la migración
- **La consola de audio virtual (`frontend/consola.js`) es exclusiva del motor Rust.**
- Web Audio API opera solo como detector pasivo para identificar qué falta migrar.
- Los vúmetros de la consola solo reflejan datos del motor Rust.

### Lo que NO se toca sin autorización explícita
- El routing de audio (cómo el sonido entra y sale por los buses físicos: master, monitor, cue, jingle, cartwall, pl1-pl4).
- La configuración de dispositivos de salida del motor Rust.
- El bus PGM / MASTER.

### Archivos clave
| Archivo | Rol |
|---------|-----|
| `frontend/consola.js` | Consola virtual — exclusiva Rust |
| `backend/ipc/ui.js` | IPC de vúmetros — bloquea datos Web Audio |
| `backend/audio_engine_process.js` | Orquestador del motor Rust |
| `frontend/audio_engine_client.js` | Adaptadores WebAudio/Rust |
| `frontend/render.js` | Renderer principal (aún usa Web Audio para reproducción) |
| `config/audio_engine_report.jsonl` | Log del motor Rust — registra rechazos de Web Audio |

### Estado del motor Rust
- `pcmBridgeReady: true` — el encoder ya está bajo control Rust
- Meters activos por bus: master, monitor, pl1-4, jingle, cartwall, encoder
- Los rechazos de Web Audio quedan en `config/audio_engine_report.jsonl`

## Idioma del código

Los comentarios en el código fuente deben escribirse en **español**. No agregar comentarios en inglés.

## Estilo de trabajo

- Leer el archivo real antes de cualquier edición.
- Cambios quirúrgicos: no refactorizar lo que no fue pedido.
- No crear archivos de documentación salvo que se pida explícitamente.
- Reportar al usuario como si se tratara de una consola de audio profesional real, no como un proyecto de laboratorio.
