@echo off
setlocal

REM Launcher rapido para recovery dev en Windows
REM Uso:
REM   RECUPERAR_DEV.bat
REM   RECUPERAR_DEV.bat nofetch

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%scripts\recovery_dev_execute.ps1"

if not exist "%SCRIPT%" (
  echo [ERROR] No se encontro el script: %SCRIPT%
  exit /b 1
)

if /I "%~1"=="nofetch" (
  powershell -ExecutionPolicy Bypass -File "%SCRIPT%" -NoFetch
) else (
  powershell -ExecutionPolicy Bypass -File "%SCRIPT%"
)

exit /b %ERRORLEVEL%
