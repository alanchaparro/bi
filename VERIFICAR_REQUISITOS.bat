@echo off
REM Comprueba Docker, Compose y archivos del repo. Use -Install para intentar instalar Docker Desktop (winget).
cd /d "%~dp0"
set "ARGS=%*"
if "%ARGS%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check_prerequisites.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check_prerequisites.ps1" %ARGS%
)
set ERR=%ERRORLEVEL%
echo.
pause
exit /b %ERR%
