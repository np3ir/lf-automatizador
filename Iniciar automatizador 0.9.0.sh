#!/bin/bash
cd "$(dirname "$0")"

# Ejecutar en segundo plano (nohup) y redirigir toda la salida a null para que se desacople de la terminal
nohup npm start >/dev/null 2>&1 &

# Salir inmediatamente, cerrando la terminal
exit 0
