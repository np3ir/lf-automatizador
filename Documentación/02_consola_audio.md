# 02 — Consola Virtual de Buses (Consola de Audio)
*Módulo: `consola.html` + `consola.js` (75 KB)*

> **¿Qué es este módulo?**
> La Consola Virtual de Buses es una ventana secundaria que muestra en tiempo real los VU Meters (medidores de nivel) de cada bus de audio del sistema: el bus principal (PGM), monitores, pre-escucha (cue), CartWall, y las salidas independientes por playlist. No es una herramienta de edición — es puramente un **visualizador de audio en tiempo real** para que el operador o un técnico vea los niveles de todas las salidas simultáneamente.

> [!NOTE]
> El panel de diagnósticos técnicos (`diagnostics-panel`) está **oculto por CSS** en la v1.0 (`display: none`). Solo el visualizador de VU Meters es visible para el operador. El panel de diagnóstico es una herramienta de desarrollo.

---

## 🪟 La Ventana

| Propiedad | Valor |
|---|---|
| Título | Consola Virtual LF |
| Modo | Ventana secundaria flotante |
| Fuente de datos | Recibe niveles de audio en tiempo real vía IPC desde `render.js` |
| Fuente de tipografía | Consolas (monospace) — estética de consola de mezclas profesional |

---

## 🧩 Elementos de la Interfaz

### 1. Grid de Canales de Audio (`#console-grid`)

El área principal. Se genera dinámicamente (no está en el HTML) — cada canal del sistema de audio aparece como una tira (channel strip) con sus VU Meters L/R.

**Canales que aparecen (generados desde `consola.js`):**

| Canal | Descripción |
|---|---|
| **PGM (Programa)** | La señal master que va al aire. Los VU Meters más importantes |
| **MON (Monitor)** | Señal para los altavoces de cabina del operador |
| **CUE / Pre-escucha** | Señal para los auriculares de pre-escucha del operador |
| **CartWall** | Nivel de los efectos del CartWall |
| **Playlist 1–4** | Cuando está activo el modo de salidas independientes por playlist, cada playlist tiene su propia columna de VU |

**Estructura de cada Channel Strip:**
```
┌──────────────────┐
│  [VU Meter L]  [VU Meter R]  │  ← Medidores verticales estéreo
│       [Nombre del Bus]       │  ← Etiqueta (PGM, MON, etc.)
│     [Destino de audio]       │  ← Dispositivo de salida configurado
│     [Valor de nivel dB]      │  ← Valor numérico en tiempo real
└──────────────────┘
```

**Colores del VU Meter:**
| Rango de nivel | Color |
|---|---|
| 0% — 79.5% (señal normal) | Verde (`#27ae60`) |
| 79.5% — 89.7% (señal alta) | Naranja (`#f39c12`) |
| 89.7% — 100% (clipping/saturación) | Rojo (`#e74c3c`) |

---

### 2. Panel de Diagnósticos (Solo Desarrolladores — Oculto en producción)

Este panel está oculto para el operador normal. Solo visible al activarlo manualmente en el código.

| Elemento | ID | Descripción |
|---|---|---|
| Estado del Motor | `#diag-engine` | Muestra si el motor activo es "rustAudio" o "webAudio" |
| Estado operativo | `#operator-engine-state` | Banner de color que indica el motor en uso y su estado |
| Resumen de diagnóstico | `#diag-summary` | Tarjetas con datos resumidos del motor |
| Detalle técnico | `#diag-detail-grid` | Grid de cajas con información detallada: players activos, mezcla A/B, FX, rutas, latencia, reporte Rust, buses Rust |
| Botón "Probar IPC Rust" | `#btn-rust-probe` | Envía un comando de prueba al motor Rust |
| Botón "Salidas Rust" | `#btn-rust-devices` | Lista los dispositivos de audio disponibles en el motor Rust |
| Selector de salida Rust | `#rust-output-select` | Cambia el dispositivo de salida del motor Rust |
| Botones de laboratorio | varios | Pruebas de reproducción, preview, routing, players, PCM, contrato |

---

## 📡 Comunicación

La Consola Virtual **no envía IPC** — solo recibe datos.

### Mensajes recibidos (`ipcRenderer.on` en `consola.js`)
| Canal | Cuándo llega | Efecto en la UI |
|---|---|---|
| `vu-levels` | Cada ~20ms mientras hay audio | Actualiza la altura de los VU Meters de todos los canales |
| `consola-state` | Cuando cambia la configuración de audio | Reconstruye el grid de canales (agrega/quita columnas) |
| `incident-sync` | Cuando cambia el estado del sistema | Actualiza el panel de diagnóstico (solo si está visible) |

---

## 🔮 Implicaciones para la v2.0 (Tauri/Rust)

| Elemento | Qué debe hacer Rust/Tauri |
|---|---|
| VU Meters | Rust emitirá los niveles de audio vía `emit()` de Tauri cada 20ms. El frontend los dibuja igual |
| Detección de buses | Rust reportará qué buses están activos y con qué dispositivos |
| Panel de diagnósticos | Puede expandirse en v2.0 como herramienta de depuración con información del motor Rust |

---

*Documentado mediante auditoría automática — LF Automatizador v1.0*
*Referencia para LF Automatizador v2.0 (Tauri + Rust)*
