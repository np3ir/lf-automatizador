# LF Audio Engine Rust

Prototipo aislado del futuro motor nativo. Esta fase no reemplaza el motor WebAudio actual.

## Objetivo

- Mantener Electron como control remoto.
- Recibir comandos por `stdin`.
- Emitir estado por `stdout` en lineas JSON.
- Servir como base para migrar despues players, buses, medidores y encoder.

## Comandos iniciales

Cada comando es una linea JSON simple:

```json
{"cmd":"status"}
{"cmd":"load","player":"probe","path":"C:\\Audio\\tema.mp3"}
{"cmd":"play","player":"probe"}
{"cmd":"pause","player":"probe"}
{"cmd":"stop","player":"probe"}
{"cmd":"seek","player":"probe","positionMs":15000}
{"cmd":"setGain","player":"probe","gain":0.75}
```

Por ahora el prototipo no reproduce audio real; mantiene estado de transporte para validar IPC y contrato.
