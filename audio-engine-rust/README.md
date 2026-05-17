# LF Audio Engine Rust

Prototipo aislado del futuro motor nativo. Esta fase no reemplaza el motor WebAudio actual.

## Objetivo

- Mantener Electron como control remoto.
- Recibir comandos por `stdin`.
- Emitir estado por `stdout` en lineas JSON.
- Servir como base para migrar players, buses, medidores y encoder.

## Proceso de control

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

Este proceso ya reproduce audio real para pruebas de players, buses y medidores. Su `stdout` se reserva para JSON de control.

## Puente PCM del encoder

El ejecutable tambien puede arrancar en modo laboratorio:

```powershell
lf-audio-engine.exe --pcm-bridge
```

En ese modo:

- `stdout` entrega audio crudo `pcm_s16le`, stereo, 44100 Hz.
- `stderr` entrega eventos JSON (`pcmBridge`, `pcmBridgeError`) para no mezclar binario con control.
- `stdin` acepta comandos simples: `status`, `loadAudio`, `play`, `pause`, `stop`, `seek`, `setGain`, `quit`.

Este puente aun no reemplaza al encoder en vivo. Es la base segura para validar transporte Rust -> FFmpeg antes de conectar el master mix real.
