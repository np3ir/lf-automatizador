@echo off
title LF Automatizador 0.9.0
cd /d "%~dp0"

:: Crear un script temporal VBScript para ejecutar el comando de forma totalmente oculta
echo Set WshShell = CreateObject("WScript.Shell") > run_hidden.vbs
echo WshShell.Run "cmd.exe /c npm start", 0, False >> run_hidden.vbs
wscript.exe run_hidden.vbs
del run_hidden.vbs

:: Salir de este script (esto cerrará la ventana negra)
exit
