@echo off
setlocal

set "SCRIPT=%~dp0scripts\watch_bugs_visual_writes.ps1"

if not exist "%SCRIPT%" (
  echo [ERROR] No se encontro el script: "%SCRIPT%"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"

endlocal
