@echo off
title LF Automatizador v1.0
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" .
exit