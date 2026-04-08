@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_lan.ps1" %*
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo.
  echo INICIAR_LAN fallo con codigo %ERR%. Revise el mensaje de PowerShell arriba.
  pause
  exit /b %ERR%
)
echo.
pause
