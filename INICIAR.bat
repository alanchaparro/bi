@echo off
REM Requisitos: Docker en ejecucion + Compose V2. Primera vez o fallos: VERIFICAR_REQUISITOS.bat
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_one_click.ps1"
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo.
  echo INICIAR fallo con codigo %ERR%. Revise el mensaje de PowerShell arriba.
  pause
  exit /b %ERR%
)
echo.
pause
